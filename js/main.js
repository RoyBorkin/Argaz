import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Viewer } from './viewer.js';
import { SCHEMA, TABS, DEFAULTS, LIVE_KEYS, PRESETS, encodeParams, decodeParams } from './params.js';
import { download, toSTL, toOBJ, to3MF } from './exporters.js';

const $ = (id) => document.getElementById(id);
const STORE = 'argaz.v1';
const haptic = (ms = 4) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

// ---------------- state ----------------
let state = location.hash.length > 1 ? decodeParams(location.hash) : (() => {
  try { const s = JSON.parse(localStorage.getItem(STORE)); return s ? { ...DEFAULTS, ...s } : { ...DEFAULTS }; } catch (e) { return { ...DEFAULTS }; }
})();
let activeTab = 'body';
const hist = [structuredClone(state)];
let hIndex = 0;
let lastMesh = null;
let lastStats = null;
let first = true;

// ---------------- viewer ----------------
const viewer = new Viewer($('canvas'), $('dims'));

// ---------------- worker (latest-wins queue) ----------------
const worker = new Worker(new URL('./geometry.worker.js', import.meta.url), { type: 'module' });
let busy = false, pending = null, reqId = 0, builtKey = '', builtQuality = 0;
const geomParams = () => Object.fromEntries(Object.entries(state).filter(([k]) => !LIVE_KEYS.has(k)));

function requestBuild(quality = 1) {
  const p = geomParams();
  const key = JSON.stringify(p);
  if (key === builtKey && quality <= builtQuality && !busy) return;
  pending = { params: p, quality, key };
  pump();
}
function pump() {
  if (busy || !pending) return;
  busy = true;
  const job = pending; pending = null;
  setBuildState('busy');
  worker.postMessage({ id: ++reqId, params: job.params, quality: job.quality });
  worker._job = job;
}
worker.onmessage = (e) => {
  const d = e.data, job = worker._job;
  busy = false;
  if (d.ok) {
    builtKey = job.key; builtQuality = job.quality;
    lastMesh = d.mesh; lastStats = d.stats;
    viewer.setGeometry(d.positions, d.normals, d.stats, first);
    if (first) { viewer.setStack(state.stack); viewer.frame(true); first = false; }
    renderStats(d.stats);
    setBuildState(pending ? 'busy' : 'done', d.stats.ms);
  } else {
    setBuildState('error', 0, d.error);
  }
  pump();
};
worker.onerror = (e) => { busy = false; setBuildState('error', 0, e.message || 'Worker failed to start'); };

let buildTimer = 0;
function setBuildState(kind, ms, msg) {
  const el = $('buildState');
  clearTimeout(buildTimer);
  el.className = 'build-state on' + (kind === 'busy' ? ' busy' : '');
  if (kind === 'busy') el.textContent = 'Building';
  else if (kind === 'error') el.textContent = `Couldn't build this shape: ${msg}. Undo the last change to recover.`;
  else { el.textContent = `Built in ${Math.round(ms)} ms`; buildTimer = setTimeout(() => el.classList.remove('on'), 1400); }
}

function renderStats(s) {
  const w = s.bbox.max[0] - s.bbox.min[0], d = s.bbox.max[1] - s.bbox.min[1], h = s.bbox.max[2] - s.bbox.min[2];
  const fmt = (v) => (v >= 100 ? v.toFixed(0) : v.toFixed(1));
  $('sSize').textContent = `${fmt(w)}×${fmt(d)}×${fmt(h)}`;
  const g = (s.volume / 1000) * 0.905;
  $('sWeight').textContent = g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${g.toFixed(0)} g`;
  $('sCap').textContent = s.capacity >= 1 ? `${s.capacity.toFixed(1)} L` : `${(s.capacity * 1000).toFixed(0)} ml`;
  $('sHoles').textContent = `${s.holes + s.floorHoles}`;
}

// ---------------- UI generation ----------------
const controls = new Map(); // key → { el, sync() }

function fmtNum(v, step) {
  const dec = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return (+v).toFixed(dec);
}

function buildTabs() {
  const nav = $('tabs');
  nav.innerHTML = '';
  for (const t of TABS) {
    const b = document.createElement('button');
    b.className = 'tab'; b.role = 'tab'; b.id = 'tab-' + t.id; b.textContent = t.label;
    b.setAttribute('aria-selected', t.id === activeTab);
    b.setAttribute('aria-controls', 'pane');
    b.onclick = () => selectTab(t.id);
    nav.appendChild(b);
  }
  const ink = document.createElement('span');
  ink.className = 'tab-ink';
  nav.appendChild(ink);
  nav.addEventListener('keydown', (e) => {
    const i = TABS.findIndex((t) => t.id === activeTab);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id;
      selectTab(n); $('tab-' + n).focus();
    }
  });
  requestAnimationFrame(moveInk);
  new ResizeObserver(moveInk).observe(nav);
}
function moveInk() {
  const nav = $('tabs'), b = $('tab-' + activeTab), ink = nav.querySelector('.tab-ink');
  if (!b || !ink) return;
  const pad = 10;
  ink.style.transform = `translateX(${b.offsetLeft + pad}px) scaleX(${b.offsetWidth - pad * 2})`;
}
function selectTab(id) {
  if (id === activeTab) return;
  activeTab = id;
  for (const t of TABS) $('tab-' + t.id).setAttribute('aria-selected', t.id === id);
  moveInk();
  buildPane(true);
}

function buildPane(animate) {
  const pane = $('pane');
  pane.innerHTML = '';
  controls.clear();
  const items = SCHEMA.filter((s) => s.tab === activeTab);
  const halves = items.filter((s) => s.half);
  const rest = items.filter((s) => !s.half);
  for (const s of [...halves, ...rest]) pane.appendChild(makeControl(s));
  const help = document.createElement('p');
  help.className = 'help'; help.id = 'help';
  help.textContent = TABS.find((t) => t.id === activeTab).help || '';
  pane.appendChild(help);
  syncVisibility();
  if (animate) { pane.classList.remove('swap'); void pane.offsetWidth; pane.classList.add('swap'); }
}

function makeControl(s) {
  const row = document.createElement('div');
  row.className = 'ctl ctl-' + (s.type === 'range' ? 'range' : s.type === 'toggle' ? 'toggle' : s.type === 'segment' ? 'seg' : 'swatch') + (s.half ? ' half' : '');
  row.dataset.key = s.key;
  const showHelp = () => { const h = $('help'); if (h) h.textContent = s.hint || TABS.find((t) => t.id === activeTab).help || ''; };
  row.addEventListener('pointerenter', showHelp);
  row.addEventListener('focusin', showHelp);
  const lbl = document.createElement('label');
  lbl.className = 'lbl';
  lbl.textContent = s.label;
  lbl.title = (s.hint ? s.hint + '. ' : '') + 'Double-click to reset';
  lbl.ondblclick = () => { set(s.key, DEFAULTS[s.key], true); sync(s.key); };
  row.appendChild(lbl);

  if (s.type === 'range') {
    const id = 'r-' + s.key;
    lbl.htmlFor = id;
    const wrap = document.createElement('div'); wrap.className = 'slider';
    const inp = document.createElement('input');
    Object.assign(inp, { type: 'range', id, min: s.min, max: s.max, step: s.step });
    inp.setAttribute('aria-label', s.label);
    const def = document.createElement('span'); def.className = 'def';
    def.style.left = `calc(${((DEFAULTS[s.key] - s.min) / (s.max - s.min)) * 100}% + ${8 - ((DEFAULTS[s.key] - s.min) / (s.max - s.min)) * 16}px)`;
    wrap.append(def, inp);
    const val = document.createElement('input');
    val.className = 'val'; val.inputMode = 'decimal'; val.setAttribute('aria-label', s.label + ' value');
    let lastStep = null;
    inp.addEventListener('input', () => {
      const v = +inp.value;
      if (s.step >= 1 && v !== lastStep) { haptic(); lastStep = v; }
      set(s.key, v, false, 0.5);
      paint();
    });
    inp.addEventListener('change', () => { set(s.key, +inp.value, true, 1); });
    val.addEventListener('focus', () => val.select());
    val.addEventListener('keydown', (e) => { if (e.key === 'Enter') val.blur(); if (e.key === 'Escape') { paint(); val.blur(); } });
    val.addEventListener('blur', () => {
      const raw = parseFloat(val.value.replace(',', '.'));
      if (Number.isFinite(raw)) {
        // typed values may go beyond the slider range, within reason
        const v = Math.max(s.min * 0.5, Math.min(s.max * 2, raw));
        set(s.key, s.step >= 1 ? Math.round(v) : v, true, 1);
      }
      paint();
    });
    const paint = () => {
      const v = state[s.key];
      inp.value = v;
      const p = Math.max(0, Math.min(1, (v - s.min) / (s.max - s.min)));
      inp.style.setProperty('--p', `${p * 100}%`);
      if (document.activeElement !== val) val.value = fmtNum(v, s.step) + (s.unit && s.unit !== 'mm' ? s.unit : '');
      lbl.classList.toggle('changed', v !== DEFAULTS[s.key]);
    };
    row.append(wrap, val);
    controls.set(s.key, { row, sync: paint });
    paint();
  } else if (s.type === 'toggle') {
    const sw = document.createElement('button');
    sw.className = 'switch'; sw.role = 'switch'; sw.setAttribute('aria-label', s.label);
    sw.onclick = () => { haptic(); set(s.key, !state[s.key], true); paint(); syncVisibility(); };
    const paint = () => { sw.setAttribute('aria-checked', !!state[s.key]); lbl.classList.toggle('changed', state[s.key] !== DEFAULTS[s.key]); };
    lbl.onclick = () => sw.click();
    row.appendChild(sw);
    controls.set(s.key, { row, sync: paint });
    paint();
  } else if (s.type === 'segment') {
    const seg = document.createElement('div'); seg.className = 'seg'; seg.role = 'radiogroup'; seg.setAttribute('aria-label', s.label);
    const ink = document.createElement('span'); ink.className = 'seg-ink';
    seg.appendChild(ink);
    const btns = s.options.map(([v, t]) => {
      const b = document.createElement('button');
      b.role = 'radio'; b.textContent = t; b.dataset.v = v;
      b.onclick = () => { if (state[s.key] === v) return; haptic(); set(s.key, v, true); paint(); syncVisibility(); };
      seg.appendChild(b);
      return b;
    });
    const paint = () => {
      let on = null;
      for (const b of btns) { const sel = b.dataset.v === state[s.key]; b.setAttribute('aria-checked', sel); if (sel) on = b; }
      if (on) requestAnimationFrame(() => {
        const firstPaint = !ink.style.width;
        if (firstPaint) ink.style.transition = 'none';
        ink.style.width = on.offsetWidth + 'px';
        ink.style.transform = `translateX(${on.offsetLeft}px)`;
        if (firstPaint) requestAnimationFrame(() => (ink.style.transition = ''));
      });
      lbl.classList.toggle('changed', state[s.key] !== DEFAULTS[s.key]);
    };
    row.appendChild(seg);
    controls.set(s.key, { row, sync: paint });
    paint();
  } else if (s.type === 'swatches') {
    const box = document.createElement('div'); box.className = 'swatches'; box.role = 'radiogroup'; box.setAttribute('aria-label', s.label);
    const sws = s.options.map((c) => {
      const b = document.createElement('button');
      b.className = 'sw'; b.role = 'radio'; b.style.setProperty('--c', c); b.setAttribute('aria-label', c); b.dataset.c = c;
      b.onclick = () => { haptic(); set(s.key, c, true); paint(); };
      box.appendChild(b);
      return b;
    });
    const custom = document.createElement('label');
    custom.className = 'sw sw-custom'; custom.title = 'Custom colour';
    const ci = document.createElement('input'); ci.type = 'color'; ci.setAttribute('aria-label', 'Custom colour');
    ci.oninput = () => { set(s.key, ci.value.toUpperCase(), false); paint(); };
    ci.onchange = () => set(s.key, ci.value.toUpperCase(), true);
    custom.appendChild(ci); box.appendChild(custom);
    const paint = () => {
      const cur = String(state[s.key]).toUpperCase();
      let match = false;
      for (const b of sws) { const sel = b.dataset.c.toUpperCase() === cur; match ||= sel; b.setAttribute('aria-checked', sel); }
      custom.setAttribute('aria-checked', !match);
      if (!match) custom.style.setProperty('--c', cur);
      ci.value = cur.length === 7 ? cur : '#295B2E';
    };
    row.appendChild(box);
    controls.set(s.key, { row, sync: paint });
    paint();
  }
  return row;
}

function syncVisibility() {
  for (const s of SCHEMA) {
    const c = controls.get(s.key);
    if (c) c.row.classList.toggle('hidden', !!(s.show && !s.show(state)));
  }
}
function sync(key) {
  if (key) controls.get(key)?.sync();
  else for (const c of controls.values()) c.sync();
  syncVisibility();
}

// ---------------- state changes ----------------
let saveTimer = 0;
function set(key, value, commit, quality = 1) {
  state[key] = value;
  if (LIVE_KEYS.has(key)) applyLive(key);
  else requestBuild(quality);
  if (commit) pushHistory();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 250);
  markPreset();
}
function applyLive(key) {
  if (key === 'color') applyColor(state.color);
  if (key === 'gloss') viewer.setGloss(state.gloss);
  if (key === 'stack') { viewer.setStack(state.stack); viewer.frame(); }
  if (key === 'section') viewer.setSection(state.section);
  if (key === 'dims') viewer.setDims(state.dims);
}
function applyAll() {
  applyColor(state.color);
  viewer.setGloss(state.gloss);
  viewer.setSection(state.section);
  viewer.setDims(state.dims);
  if (!first) viewer.setStack(state.stack);
  requestBuild(1);
}
function applyColor(hex) {
  viewer.setColor(hex);
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const root = document.documentElement.style;
  // very light colours make a poor UI accent: darken them for the chrome only
  root.setProperty('--crate', lum > 0.72 ? `color-mix(in oklab, ${hex} 55%, #171A18)` : hex);
  root.setProperty('--crate-ink', lum > 0.55 && lum <= 0.72 ? '#171A18' : '#FFFFFF');
}
function persist() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {}
  window.history.replaceState(null, '', encodeParams(state) || location.pathname + location.search);
}
function pushHistory() {
  const snap = structuredClone(state);
  if (JSON.stringify(snap) === JSON.stringify(hist[hIndex])) return;
  hist.splice(hIndex + 1);
  hist.push(snap);
  if (hist.length > 120) hist.shift();
  hIndex = hist.length - 1;
  syncUndo();
}
function restore(snap) {
  const prevStack = state.stack;
  state = structuredClone(snap);
  sync();
  applyAll();
  if (state.stack !== prevStack) viewer.frame();
  persist();
  markPreset();
  syncUndo();
}
function undo() { if (hIndex > 0) { hIndex--; restore(hist[hIndex]); } }
function redo() { if (hIndex < hist.length - 1) { hIndex++; restore(hist[hIndex]); } }
function syncUndo() { $('undoBtn').disabled = hIndex === 0; $('redoBtn').disabled = hIndex >= hist.length - 1; }

// ---------------- presets ----------------
function presetState(pr) { return { ...DEFAULTS, ...pr.p, stack: state.stack, section: state.section, dims: state.dims }; }
function markPreset() {
  const cur = JSON.stringify(geomParams());
  const hit = PRESETS.find((pr) => { const ps = presetState(pr); return JSON.stringify(Object.fromEntries(Object.entries(ps).filter(([k]) => !LIVE_KEYS.has(k)))) === cur; });
  $('presetName').textContent = hit ? hit.name : 'Custom crate';
  return hit;
}
function buildPresetMenu() {
  const m = $('presetMenu');
  m.innerHTML = '';
  const cur = markPreset();
  for (const pr of PRESETS) {
    const b = document.createElement('button');
    b.role = 'menuitemradio';
    b.setAttribute('aria-checked', cur === pr);
    b.innerHTML = `<span class="preset-row"><span class="dot" style="--c:${pr.p.color || DEFAULTS.color}"></span><span></span></span>`;
    b.querySelector('.preset-row span:last-child').textContent = pr.name;
    b.onclick = () => { closeMenus(); state = presetState(pr); state.color = pr.p.color || DEFAULTS.color; pushHistory(); sync(); applyAll(); persist(); markPreset(); setTimeout(() => viewer.frame(), 420); };
    m.appendChild(b);
  }
  const hr = document.createElement('hr'); m.appendChild(hr);
  const reset = document.createElement('button');
  reset.textContent = 'Reset all settings';
  reset.onclick = () => { closeMenus(); state = { ...DEFAULTS }; pushHistory(); sync(); applyAll(); persist(); markPreset(); setTimeout(() => viewer.frame(), 420); };
  m.appendChild(reset);
}

// ---------------- menus ----------------
let openMenu = null;
function toggleMenu(menu, trigger, placement) {
  if (openMenu === menu) return closeMenus();
  closeMenus();
  if (menu.id === 'presetMenu') buildPresetMenu();
  const r = trigger.getBoundingClientRect();
  menu.hidden = false;
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  let left, top, origin;
  if (placement === 'up') {
    left = Math.max(8, Math.min(r.right - mw, innerWidth - mw - 8));
    top = Math.max(8, r.top - mh - 8); origin = 'bottom right';
  } else {
    left = Math.max(8, Math.min(r.left, innerWidth - mw - 8));
    top = r.bottom + 8; origin = 'top left';
  }
  Object.assign(menu.style, { left: left + 'px', top: top + 'px' });
  menu.style.setProperty('--origin', origin);
  trigger.setAttribute('aria-expanded', 'true');
  openMenu = menu; openMenu._trigger = trigger;
  menu.querySelector('button')?.focus({ preventScroll: true });
}
function closeMenus() {
  if (!openMenu) return;
  openMenu.hidden = true;
  openMenu._trigger?.setAttribute('aria-expanded', 'false');
  openMenu = null;
}
document.addEventListener('pointerdown', (e) => { if (openMenu && !openMenu.contains(e.target) && e.target !== openMenu._trigger && !openMenu._trigger.contains(e.target)) closeMenus(); });

// ---------------- exports ----------------
function fileBase() {
  const p = state, n = { 3: 'tri', 4: 'square', 5: 'penta', 6: 'hex', 8: 'octa' }[p.sides] || p.sides + 'side';
  return `crate-${n}-${Math.round(p.width * p.scale)}x${Math.round(p.height * p.scale)}`;
}
async function doExport(kind) {
  closeMenus();
  if (kind === 'load') return $('loadInput').click();
  if (kind === 'json') { download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), fileBase() + '.json'); return toast('Settings saved'); }
  if (kind === 'png') { download(await viewer.snapshot(), fileBase() + '.png'); return toast('Image saved'); }
  if (!lastMesh || busy || pending) { toast('Still building, export again in a moment'); return; }
  if (builtQuality < 1) { requestBuild(1); toast('Refining the mesh, export again in a moment'); return; }
  if (kind === 'stl') download(toSTL(lastMesh), fileBase() + '.stl');
  if (kind === 'obj') download(toOBJ(lastMesh), fileBase() + '.obj');
  if (kind === '3mf') download(to3MF(lastMesh, state.color), fileBase() + '.3mf');
  if (kind === 'glb') {
    const glb = await new GLTFExporter().parseAsync(viewer.exportObject(), { binary: true });
    download(new Blob([glb], { type: 'model/gltf-binary' }), fileBase() + '.glb');
  }
  toast(`${kind.toUpperCase()} exported, ${lastStats.tris.toLocaleString()} triangles`);
}
$('loadInput').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const obj = JSON.parse(await f.text());
    const next = { ...DEFAULTS };
    for (const k in DEFAULTS) if (k in obj && typeof obj[k] === typeof DEFAULTS[k]) next[k] = obj[k];
    state = next; pushHistory(); sync(); applyAll(); persist(); markPreset();
    toast('Settings loaded');
  } catch (err) { toast("That file isn't a settings file from this app"); }
  e.target.value = '';
};

let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
}

// ---------------- wiring ----------------
$('presetBtn').onclick = (e) => toggleMenu($('presetMenu'), e.currentTarget, 'down');
$('exportBtn').onclick = (e) => toggleMenu($('exportMenu'), e.currentTarget, 'up');
$('exportMenu').addEventListener('click', (e) => { const b = e.target.closest('[data-export]'); if (b) doExport(b.dataset.export); });
$('undoBtn').onclick = undo;
$('redoBtn').onclick = redo;
$('fitBtn').onclick = () => viewer.frame();
$('shareBtn').onclick = async () => {
  persist();
  const url = location.href;
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'My crate', url });
    else { await navigator.clipboard.writeText(url); toast('Link copied'); }
  } catch (e) { if (e.name !== 'AbortError') toast('Copy the address bar to share this crate'); }
};
addEventListener('keydown', (e) => {
  const typing = e.target.matches('input.val, input[type=color]');
  if (e.key === 'Escape') closeMenus();
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); }
  if (e.key.toLowerCase() === 'f' && !typing && !e.ctrlKey && !e.metaKey && e.target.type !== 'range') viewer.frame();
});
addEventListener('hashchange', () => { const s = decodeParams(location.hash); if (JSON.stringify(s) !== JSON.stringify(state)) { state = s; pushHistory(); sync(); applyAll(); markPreset(); } });

// tell the viewer how much of the stage is covered so framing stays centred
function measureInsets() {
  const st = $('stage').getBoundingClientRect();
  const plate = $('plate').getBoundingClientRect();
  const brand = document.querySelector('.brand').getBoundingClientRect();
  viewer.setInsets(brand.bottom - st.top + 8, st.bottom - plate.top + 8);
}
new ResizeObserver(() => { measureInsets(); }).observe($('stage'));
measureInsets();

buildTabs();
buildPane(false);
syncUndo();
applyAll();
markPreset();
