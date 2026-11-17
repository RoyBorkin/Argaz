// Argaz, parametric crate configurator. © 2026 Roy Borkin. All rights reserved.
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Viewer } from './viewer.js';
import { SCHEMA, TABS, MODES, DEFAULTS, LIVE_KEYS, NO_URL, PRESETS, PRINTERS, encodeParams, decodeParams } from './params.js';
import { rasterLogo, logoKey, fileToDataURL } from './logo.js';
import { download, toSTL, toOBJ, to3MF, posed, merge, zipFiles } from './exporters.js';

const $ = (id) => document.getElementById(id);
const STORE = 'argaz.v1';
const COPYRIGHT = '© 2026 Roy Borkin. All rights reserved.';
const haptic = (ms = 4) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

// ---------------- state ----------------
let state = location.hash.length > 1 ? decodeParams(location.hash) : (() => {
  try { const s = JSON.parse(localStorage.getItem(STORE)); return s ? { ...DEFAULTS, ...s } : { ...DEFAULTS }; } catch (e) { return { ...DEFAULTS }; }
})();
let activeMode = 'crate';
let activeTab = 'body';
const lastTabOf = { crate: 'body', cover: 'lid', print: 'split' };
let lastParts = [];
let lastLayout = null;
let lastNotes = [];
const hist = [structuredClone(state)];
let hIndex = 0;
let lastStats = null;
let first = true;

// ---------------- viewer ----------------
const viewer = new Viewer($('canvas'), $('dims'));

// ---------------- worker (latest-wins queue) ----------------
const worker = new Worker(new URL('./geometry.worker.js', import.meta.url), { type: 'module' });
let busy = false, pending = null, reqId = 0, builtKey = '', builtQuality = 0;
// geometry params: everything except preview-only keys and the raw logo image (sent as rectangles instead)
const geomParams = () => Object.fromEntries(Object.entries(state).filter(([k]) => !LIVE_KEYS.has(k) && !NO_URL.has(k)));
let logoCache = { key: null, data: null }, logoJob = null;

function requestBuild(quality = 1) {
  const lk = logoKey(state);
  if (lk !== logoCache.key) {
    // rasterise the logo first (image decoding is async), then build
    if (!logoJob || logoJob.key !== lk) {
      const job = { key: lk };
      logoJob = job;
      setBuildState('busy');
      rasterLogo(state).then((data) => { if (logoJob === job) { logoCache = { key: lk, data }; logoJob = null; requestBuild(quality); } })
        .catch(() => { if (logoJob === job) { logoCache = { key: lk, data: null }; logoJob = null; requestBuild(quality); } });
    }
    return;
  }
  const p = geomParams();
  const key = JSON.stringify(p) + '|' + lk;
  if (key === builtKey && quality <= builtQuality && !busy) return;
  pending = { params: p, quality, key, logo: logoCache.data };
  pump();
}
function pump() {
  if (busy || !pending) return;
  busy = true;
  const job = pending; pending = null;
  setBuildState('busy');
  worker.postMessage({ id: ++reqId, params: job.params, quality: job.quality, logo: job.logo });
  worker._job = job;
}
worker.onmessage = (e) => {
  const d = e.data, job = worker._job;
  busy = false;
  if (d.ok) {
    builtKey = job.key; builtQuality = job.quality;
    lastParts = d.parts; lastStats = d.stats; lastNotes = d.notes || [];
    viewer.setParts(d.parts, d.stats, first);
    relayout();
    if (first) { viewer.setStack(state.stack); viewer.setExplode(state.explode); if (state.bedView) viewer.setBedView(true); viewer.frame(true); first = false; }
    renderStats();
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
  else {
    const notes = allNotes();
    if (notes.length) { el.className = 'build-state on note'; el.textContent = notes[0] + (notes.length > 1 ? ` (+${notes.length - 1} more)` : ''); el.title = notes.join('\n'); }
    else { el.textContent = `Built in ${Math.round(ms)} ms`; el.title = ''; buildTimer = setTimeout(() => el.classList.remove('on'), 1400); }
  }
}
function allNotes() {
  const n = [];
  if (state.printReady || activeMode === 'print') n.push(...lastNotes);
  if (lastLayout && (activeMode === 'print' || state.bedView)) n.push(...lastLayout.warnings);
  const w = state.wall * state.scale;
  if (state.scale !== 1 && w < 0.8) n.push(`Walls are ${w.toFixed(2)} mm at this scale, thinner than two lines of a 0.4 mm nozzle.`);
  return [...new Set(n)];
}

function renderStats() {
  const s = lastStats;
  if (!s) return;
  const fmt = (v) => (v >= 100 ? v.toFixed(0) : v.toFixed(1));
  const kg = (vol) => { const g = (vol / 1000) * 0.905; return g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${g.toFixed(g < 10 ? 1 : 0)} g`; };
  const cells = [];
  if (activeMode === 'cover' && s.cover) {
    const cp = lastParts.filter((p) => p.kind === 'cover');
    const bb = cp.reduce((m, p) => ({ min: m.min.map((x, i) => Math.min(x, p.bbox.min[i])), max: m.max.map((x, i) => Math.max(x, p.bbox.max[i])) }), { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] });
    cells.push(['Cover', `${fmt(bb.max[0] - bb.min[0])}×${fmt(bb.max[1] - bb.min[1])}×${fmt(bb.max[2] - bb.min[2])}`]);
    cells.push(['Weight', kg(s.coverVolume)]);
    cells.push(['Vents', String(s.cover.vents)]);
    cells.push(['Stacks', state.lidSkirt && state.lidLip ? 'Both ways' : state.lidSkirt ? 'On crate' : state.lidLip ? 'Under crate' : 'Loose']);
  } else if (activeMode === 'print' && lastLayout) {
    const L = lastLayout;
    cells.push(['Parts', String(L.count)]);
    cells.push(['Plates', String(L.plates.length), L.plates.some((p) => !p.ok) ? 'bad' : '']);
    cells.push(['Tallest', `${fmt(L.tallest)} mm`, L.tallest > state.bedZ ? 'bad' : '']);
    cells.push(['Filament', kg(s.volume)]);
  } else {
    const w = s.bbox.max[0] - s.bbox.min[0], d = s.bbox.max[1] - s.bbox.min[1], h = s.bbox.max[2] - s.bbox.min[2];
    cells.push(['Size', `${fmt(w)}×${fmt(d)}×${fmt(h)}`]);
    cells.push(['Weight', kg(s.crateVolume)]);
    cells.push(['Holds', s.capacity >= 1 ? `${s.capacity.toFixed(1)} L` : `${(s.capacity * 1000).toFixed(0)} ml`]);
    if (state.scale !== 1) {
      const wall = s.thickness.wall;
      cells.push(['Wall', `${wall.toFixed(2)} mm`, wall < 0.8 ? 'bad' : wall < 1.2 ? 'warn' : '']);
    } else cells.push(['Openings', String(s.holes + s.floorHoles)]);
  }
  const dl = $('plateList');
  dl.innerHTML = '';
  for (const [k, v, cls] of cells) {
    const div = document.createElement('div');
    if (cls) div.className = cls;
    div.innerHTML = '<dt></dt><dd></dd>';
    div.firstChild.textContent = k; div.lastChild.textContent = v;
    dl.appendChild(div);
  }
}

// ---------------- print layout (shelf packing onto as many plates as needed) ----------------
function computeLayout(parts) {
  const bed = [state.bedX, state.bedY, state.bedZ], M = 6, GAP = Math.max(40, bed[0] * 0.15);
  const items = parts.filter((p) => !p.preview).map((p) => {
    const b = p.bbox;
    let [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
    if (p.flip) { [y0, y1] = [-y1, -y0]; [z0, z1] = [-z1, -z0]; }
    return { p, w: x1 - x0, d: y1 - y0, h: z1 - z0, min: [x0, y0, z0] };
  });
  items.sort((A, B) => B.w * B.d - A.w * A.d);
  const plates = [], warnings = [];
  for (const it of items) {
    const big = it.w > bed[0] - 2 * M || it.d > bed[1] - 2 * M;
    if (big) warnings.push(`${it.p.label} is ${it.w.toFixed(0)}×${it.d.toFixed(0)} mm, wider than the ${bed[0]}×${bed[1]} bed. Scale it down or use a larger printer.`);
    if (it.h > bed[2]) warnings.push(`${it.p.label} is ${it.h.toFixed(0)} mm tall, more than the ${bed[2]} mm build height. Add wall sections.`);
    let placed = false;
    if (!big) for (const pl of plates) {
      if (pl.big) continue;
      for (const sh of pl.shelves) {
        if (sh.x + it.w <= bed[0] - M && sh.y + it.d <= bed[1] - M && it.d <= sh.h + 0.01) { it.at = [sh.x, sh.y]; sh.x += it.w + M; placed = true; break; }
      }
      if (!placed) {
        const last = pl.shelves[pl.shelves.length - 1];
        const ny = last ? last.y + last.h + M : M;
        if (ny + it.d <= bed[1] - M) { pl.shelves.push({ y: ny, h: it.d, x: M + it.w + M }); it.at = [M, ny]; placed = true; }
      }
      if (placed) { pl.items.push(it); if (it.h > bed[2]) pl.ok = false; break; }
    }
    if (!placed) {
      const size = big ? [Math.max(bed[0], it.w + 2 * M), Math.max(bed[1], it.d + 2 * M)] : [bed[0], bed[1]];
      it.at = big ? [(size[0] - it.w) / 2, (size[1] - it.d) / 2] : [M, M];
      plates.push({ size, big, ok: !big && it.h <= bed[2], items: [it], shelves: big ? [] : [{ y: M, h: it.d, x: M + it.w + M }] });
    }
  }
  // arrange plates in a grid (roughly square), centred on the origin
  const cols = Math.max(1, Math.ceil(Math.sqrt(plates.length)));
  const rows = Math.ceil(plates.length / cols);
  const cellW = Math.max(...plates.map((p) => p.size[0]), bed[0]), cellD = Math.max(...plates.map((p) => p.size[1]), bed[1]);
  const total = cols * cellW + (cols - 1) * GAP, totalD = rows * cellD + (rows - 1) * GAP;
  const poses = new Map();
  let tallest = 0;
  plates.forEach((pl, i) => {
    const cx = i % cols, cy = Math.floor(i / cols);
    pl.origin = [-total / 2 + cx * (cellW + GAP), totalD / 2 - cellD - cy * (cellD + GAP)];
    for (const it of pl.items) {
      poses.set(it.p.id, { flip: it.p.flip, pos: [pl.origin[0] + it.at[0] - it.min[0], pl.origin[1] + it.at[1] - it.min[1], -it.min[2]] });
      tallest = Math.max(tallest, it.h);
    }
  });
  const maxD = totalD;
  return { plates: plates.map((p) => ({ origin: p.origin, size: p.size, ok: p.ok })), poses, count: items.length, tallest, warnings,
    bounds: [-total / 2, -totalD / 2, total / 2, totalD / 2, tallest] };
}
function relayout() {
  if (!lastParts.length) return;
  lastLayout = computeLayout(lastParts);
  viewer.setLayout(lastLayout);
}

// ---------------- UI generation ----------------
const controls = new Map(); // key → { el, sync() }

function fmtNum(v, step) {
  const dec = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return (+v).toFixed(dec);
}

function buildModes() {
  const nav = $('modes');
  nav.innerHTML = '';
  const ink = document.createElement('span'); ink.className = 'seg-ink'; nav.appendChild(ink);
  for (const m of MODES) {
    const b = document.createElement('button');
    b.role = 'radio'; b.id = 'mode-' + m.id; b.textContent = m.label;
    b.onclick = () => selectMode(m.id);
    nav.appendChild(b);
  }
  paintModes(true);
}
function paintModes(instant) {
  const ink = $('modes').querySelector('.seg-ink');
  let on = null;
  for (const m of MODES) { const b = $('mode-' + m.id), sel = m.id === activeMode; b.setAttribute('aria-checked', sel); if (sel) on = b; }
  requestAnimationFrame(() => {
    if (instant) ink.style.transition = 'none';
    ink.style.width = on.offsetWidth + 'px';
    ink.style.transform = `translateX(${on.offsetLeft}px)`;
    if (instant) requestAnimationFrame(() => (ink.style.transition = ''));
  });
}
function selectMode(id) {
  if (id === activeMode) return;
  haptic();
  lastTabOf[activeMode] = activeTab;
  activeMode = id;
  activeTab = lastTabOf[id];
  paintModes();
  // opening the cover maker turns the cover on
  if (id === 'cover' && !state.cover) set('cover', true, true);
  buildTabs();
  buildPane(true);
  renderStats();
  setBuildState(busy ? 'busy' : 'done', lastStats ? lastStats.ms : 0);
}

function buildTabs() {
  const nav = $('tabs');
  nav.innerHTML = '';
  const tabs = TABS.filter((t) => t.mode === activeMode);
  for (const t of tabs) {
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
  nav.onkeydown = (e) => {
    const i = tabs.findIndex((t) => t.id === activeTab);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].id;
      selectTab(n); $('tab-' + n).focus();
    }
  };
  ink.style.transition = 'none';
  requestAnimationFrame(() => { moveInk(); requestAnimationFrame(() => (ink.style.transition = '')); });
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
  for (const t of TABS.filter((x) => x.mode === activeMode)) $('tab-' + t.id).setAttribute('aria-selected', t.id === id);
  moveInk();
  buildPane(true);
}

function buildPane(animate) {
  const pane = $('pane');
  pane.innerHTML = '';
  for (const [k, c] of [...controls]) if (!c.row.isConnected || c.row.closest('#pane')) controls.delete(k);
  const items = SCHEMA.filter((s) => [].concat(s.tab || []).includes(activeTab));
  const halves = items.filter((s) => s.half);
  const rest = items.filter((s) => !s.half);
  for (const s of [...halves, ...rest]) pane.appendChild(makeControl(s));
  const help = document.createElement('p');
  help.className = 'help'; help.id = 'help';
  help.textContent = tabHelp();
  pane.appendChild(help);
  syncVisibility();
  if (animate) { pane.classList.remove('swap'); void pane.offsetWidth; pane.classList.add('swap'); }
}

function makeControl(s) {
  const row = document.createElement('div');
  row.className = 'ctl ctl-' + (s.type === 'range' ? 'range' : s.type === 'toggle' ? 'toggle' : s.type === 'segment' ? 'seg' : 'swatch') + (s.half ? ' half' : '');
  row.dataset.key = s.key;
  const showHelp = () => { const h = $('help'); if (h) h.textContent = s.key === 'scale' ? tabHelp() : s.hint || tabHelp(); };
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
  } else if (s.type === 'text') {
    const inp = document.createElement('input');
    inp.type = 'text'; inp.className = 'txt'; inp.id = 't-' + s.key; inp.placeholder = s.placeholder || ''; inp.maxLength = 40;
    inp.setAttribute('aria-label', s.label); inp.spellcheck = false; inp.autocomplete = 'off';
    lbl.htmlFor = inp.id;
    let tm = 0;
    inp.addEventListener('input', () => { clearTimeout(tm); state[s.key] = inp.value; tm = setTimeout(() => set(s.key, inp.value, false), 280); });
    inp.addEventListener('change', () => set(s.key, inp.value, true));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
    const paint = () => { if (document.activeElement !== inp) inp.value = state[s.key]; lbl.classList.toggle('changed', state[s.key] !== DEFAULTS[s.key]); };
    row.classList.replace('ctl-swatch', 'ctl-text');
    row.appendChild(inp);
    controls.set(s.key, { row, sync: paint });
    paint();
  } else if (s.type === 'file') {
    const box = document.createElement('div'); box.className = 'filebox';
    const btn = document.createElement('button'); btn.className = 'text-btn small'; btn.type = 'button';
    const thumb = document.createElement('img'); thumb.className = 'thumb'; thumb.alt = '';
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = s.accept || 'image/*'; inp.hidden = true;
    btn.onclick = () => inp.click();
    inp.onchange = async () => {
      const f = inp.files[0]; inp.value = '';
      if (!f) return;
      try { set(s.key, await fileToDataURL(f), true); paint(); toast('Logo image loaded'); }
      catch (err) { toast(err.message || "That file isn't an image this browser can read"); }
    };
    const paint = () => { const v = state[s.key]; btn.textContent = v ? 'Replace image' : 'Choose image'; thumb.hidden = !v; if (v) thumb.src = v; };
    row.classList.replace('ctl-swatch', 'ctl-file');
    box.append(thumb, btn, inp);
    row.appendChild(box);
    controls.set(s.key, { row, sync: paint });
    paint();
  } else if (s.type === 'action') {
    row.classList.replace('ctl-swatch', 'ctl-action');
    lbl.remove();
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'text-btn action'; btn.textContent = s.label;
    if (s.hint) btn.title = s.hint;
    btn.onclick = () => { haptic(); runAction(s.key); };
    row.appendChild(btn);
    controls.set(s.key, { row, sync: () => {} });
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

function tabHelp() {
  const base = TABS.find((t) => t.id === activeTab).help || '';
  if (activeTab === 'body' && state.scale !== 1) {
    const k = state.scale, f = (v) => (v * k).toFixed(2);
    const w = state.wall * k;
    return `At ${k.toFixed(2)}× the wall is ${f(state.wall)} mm, the floor ${f(state.floor)} mm, ribs stand out ${f(state.ribDepth)} mm and the rim ${f(state.rimDepth)} mm.` +
      (w < 0.8 ? ' That wall is thinner than two lines of a 0.4 mm nozzle: raise Wall thickness.' : w < 1.2 ? ' Thin but printable; 1.2 mm or more is sturdier.' : '');
  }
  return base;
}
function runAction(key) {
  if (key === 'shuffle') { set('colorSeed', Math.floor(Math.random() * 1e6) + 1, true); return; }
  if (key === 'fitBed') {
    // pick wall sections and vertical cuts so every part fits the bed
    const k = state.scale, draft = 1 + Math.tan((state.taper * Math.PI) / 180) * state.height / (state.width / 2);
    const out = Math.max(state.rimDepth, state.ribDepth, state.pillarDepth);
    const W = (state.width + 2 * out) * k * draft + 2, M = 14;
    const bx = state.bedX - M, by = state.bedY - M, bz = state.bedZ - 6;
    const vSplit = W <= Math.min(bx, by) ? 'none' : W / 2 <= bx && W <= by ? 'halves' : 'quarters';
    const tall = (state.height + (state.foot ? state.footHeight : 0)) * k;
    const sections = Math.max(1, Math.min(state.ribCount + 1, 5, Math.ceil(tall / bz)));
    Object.assign(state, { printReady: true, splitBase: true, sections, vSplit });
    pushHistory(); sync(); requestBuild(1); persist();
    const msg = vSplit === 'quarters' && W / 2 > Math.min(bx, by) ? 'Even quarters are wider than this bed: scale down or use a bigger printer' : `Set ${sections} wall section${sections > 1 ? 's' : ''}${vSplit !== 'none' ? ' and ' + vSplit : ''} for this bed`;
    toast(msg);
    if (Math.ceil(tall / bz) > state.ribCount + 1) setTimeout(() => toast('Add more ribs to split the walls into more sections'), 2400);
  }
}
function mixPalette() {
  // deterministic shuffle of the swatch colours, the chosen colour first
  const all = SCHEMA.find((x) => x.key === 'color').options.filter((c) => c.toUpperCase() !== String(state.color).toUpperCase());
  let seed = state.colorSeed >>> 0 || 1;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return [state.color, ...all];
}
function syncVisibility() {
  for (const s of SCHEMA) {
    const c = controls.get(s.key);
    if (c) c.row.classList.toggle('hidden', !!(s.show && !s.show(state)));
  }
  // tell the phone layout how many rows this tab needs, so rows shrink instead of scrolling
  const pane = $('pane');
  if (pane) {
    let full = 0, halves = 0;
    for (const r of pane.querySelectorAll('.ctl:not(.hidden)')) r.classList.contains('half') ? halves++ : full++;
    pane.style.setProperty('--n', Math.max(1, full + Math.ceil(halves / 2)));
  }
}
function sync(key) {
  if (typeof syncDock === 'function' && $('dock')) syncDock();
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
  if (key === 'scale' || key === 'wall') { const h = $('help'); if (h && activeTab === 'body') h.textContent = tabHelp(); }
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
  if (key === 'explode') { viewer.setExplode(state.explode); if (exploding !== state.explode > 0.002) { exploding = state.explode > 0.002; viewer.frame(); } }
  if (key === 'bedView') { viewer.setBedView(state.bedView); renderStats(); setBuildState('done', lastStats ? lastStats.ms : 0); }
  if (key === 'cushionColor') viewer.setFabric(state.cushionColor);
  if (key === 'mixColors' || key === 'colorSeed' || key === 'color') viewer.setMix(state.mixColors ? mixPalette() : null);
  if (key === 'printer' && state.printer !== 'custom') {
    [state.bedX, state.bedY, state.bedZ] = PRINTERS[state.printer];
    for (const k of ['bedX', 'bedY', 'bedZ']) controls.get(k)?.sync();
  }
  if (key === 'bedX' || key === 'bedY' || key === 'bedZ') {
    const match = Object.entries(PRINTERS).find(([, v]) => v[0] === state.bedX && v[1] === state.bedY && v[2] === state.bedZ);
    state.printer = match ? match[0] : 'custom';
    controls.get('printer')?.sync();
  }
  if (['printer', 'bedX', 'bedY', 'bedZ'].includes(key)) { relayout(); renderStats(); setBuildState('done', lastStats ? lastStats.ms : 0); }
}
let exploding = false;
function applyAll() {
  applyColor(state.color);
  viewer.setGloss(state.gloss);
  viewer.setSection(state.section);
  viewer.setDims(state.dims);
  viewer.setFabric(state.cushionColor);
  viewer.setMix(state.mixColors ? mixPalette() : null);
  if (!first) { viewer.setStack(state.stack); viewer.setExplode(state.explode); viewer.setBedView(state.bedView); relayout(); }
  exploding = state.explode > 0.002;
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
  const hit = PRESETS.find((pr) => { const ps = presetState(pr); return JSON.stringify(Object.fromEntries(Object.entries(ps).filter(([k]) => !LIVE_KEYS.has(k) && !NO_URL.has(k)))) === cur; });
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
  } else if (placement === 'down-right') {
    left = Math.max(8, r.right - mw); top = r.bottom + 8; origin = 'top right';
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
const isCrate = (p) => p.kind === 'crate' || p.kind === 'base' || p.kind === 'section';
// each printable part, flipped if needed, sitting on z = 0 and centred on the origin
function partForPrint(p) {
  const m = posed(p.mesh, { flip: p.flip, pos: [0, 0, 0] });
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < m.pos.length; i += 3) { x0 = Math.min(x0, m.pos[i]); x1 = Math.max(x1, m.pos[i]); y0 = Math.min(y0, m.pos[i + 1]); y1 = Math.max(y1, m.pos[i + 1]); z0 = Math.min(z0, m.pos[i + 2]); }
  return posed(m, { flip: false, pos: [-(x0 + x1) / 2, -(y0 + y1) / 2, -z0] });
}
async function doExport(kind) {
  closeMenus();
  if (kind === 'load') return $('loadInput').click();
  if (kind === 'json') { download(new Blob([JSON.stringify({ _copyright: COPYRIGHT, ...Object.fromEntries(Object.entries(state).filter(([k]) => k !== 'logoImage')) }, null, 2)], { type: 'application/json' }), fileBase() + '.json'); return toast('Settings saved'); }
  if (kind === 'png') { download(await viewer.snapshot(), fileBase() + '.png'); return toast('Image saved'); }
  if (!lastParts.length || busy || pending) { toast('Still building, export again in a moment'); return; }
  if (builtQuality < 1) { requestBuild(1); toast('Refining the mesh, export again in a moment'); return; }
  const printable = lastParts.filter((p) => !p.preview);
  const crate = printable.filter(isCrate), cover = printable.filter((p) => p.kind === 'cover');
  let tris = 0;
  const count = (m) => { tris += m.index.length / 3; return m; };
  if (kind === 'stl') download(toSTL(count(merge(crate.map((p) => p.mesh)))), fileBase() + '.stl');
  if (kind === 'cover-stl') {
    if (!cover.length) return toast('Turn on the cover first');
    const L = computeLayout(cover);
    download(toSTL(count(merge(cover.map((p) => posed(p.mesh, L.poses.get(p.id)))))), fileBase() + '-cover.stl');
  }
  if (kind === 'print-3mf') {
    const L = lastLayout || computeLayout(printable);
    download(to3MF(printable.map((p) => ({ name: p.label, mesh: count(posed(p.mesh, L.poses.get(p.id))) })), state.color), fileBase() + '-print.3mf');
  }
  if (kind === 'print-zip') {
    const enc = (p) => toSTL(count(partForPrint(p))).arrayBuffer();
    const files = [];
    for (const p of printable) files.push([`${fileBase()}-${p.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.stl`, await enc(p)]);
    files.push(['README.txt', printNotes(printable)]);
    download(zipFiles(files), fileBase() + '-parts.zip');
  }
  if (kind === 'foam-svg') {
    const tpl = lastStats.cushionTemplate;
    if (!tpl) return toast('Turn on the cover to make a cushion template');
    download(new Blob([foamSVG(tpl)], { type: 'image/svg+xml' }), fileBase() + '-foam-template.svg');
    return toast('Foam template saved at 1:1, print at 100% scale');
  }
  if (kind === 'obj') download(toOBJ(count(merge(printable.map((p) => p.mesh)))), fileBase() + '.obj');
  if (kind === 'glb') {
    const glb = await new GLTFExporter().parseAsync(viewer.exportObject(), { binary: true });
    download(new Blob([glb], { type: 'model/gltf-binary' }), fileBase() + '.glb');
  }
  toast(`Exported${tris ? `, ${Math.round(tris).toLocaleString()} triangles` : ''}`);
}
function foamSVG({ outline, marks, thick }) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of outline) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const m = 15, W = x1 - x0 + 2 * m, H = y1 - y0 + 2 * m + 22;
  const pt = (p) => `${(p[0] - x0 + m).toFixed(2)},${(y1 - p[1] + m).toFixed(2)}`;
  const path = (poly) => 'M' + poly.map(pt).join('L') + 'Z';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(1)}mm" height="${H.toFixed(1)}mm" viewBox="0 0 ${W.toFixed(2)} ${H.toFixed(2)}">
  <title>Cushion foam template, 1:1</title>
  <desc>${COPYRIGHT}</desc>
  <path d="${path(outline)}" fill="none" stroke="#000" stroke-width="0.4"/>
  ${marks.map((p) => `<path d="${path(p)}" fill="none" stroke="#c0392b" stroke-width="0.3" stroke-dasharray="1.5 1"/>`).join('\n  ')}
  <line x1="${m}" y1="${(H - 10).toFixed(2)}" x2="${m + 100}" y2="${(H - 10).toFixed(2)}" stroke="#000" stroke-width="0.4"/>
  <text x="${m}" y="${(H - 3).toFixed(2)}" font-family="Arial, sans-serif" font-size="4">100 mm check line. Foam ${(x1 - x0).toFixed(0)} × ${(y1 - y0).toFixed(0)} × ${thick.toFixed(0)} mm. Red: strap or tie positions.</text>
</svg>`;
}
function printNotes(parts) {
  const j = { snap: 'Snap: press each part straight down until the catches click.', glue: 'Glue: run a bead of CA or plastic cement into the groove, then press the part above onto the tongue.', press: 'Tight gap: press fit. If it is too tight, sand the tongue lightly; if loose, add a drop of glue.' }[state.joint];
  return [
    'Crate parts, exported from Argaz',
    COPYRIGHT,
    '',
    'Every file is already oriented for printing: put it on the bed as it is. No supports needed.',
    `Scale ${state.scale}x, wall ${(state.wall * state.scale).toFixed(2)} mm.`,
    '',
    'Parts, bottom to top:',
    ...parts.map((p) => `  ${p.label}`),
    '',
    state.printReady ? 'Joints: ' + j : '',
    state.printReady ? `Gap ${({ snap: state.snapGap, glue: state.glueGap, press: state.pressGap })[state.joint]} mm. Print one joint at small scale first to check the fit on your printer.` : '',
  ].join('\n');
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
// ---------------- view box on the stage ----------------
function syncDock() {
  $('dockSection').setAttribute('aria-pressed', !!state.section);
  $('dockDims').setAttribute('aria-pressed', !!state.dims);
  $('stackVal').textContent = state.stack;
  $('stackMinus').disabled = state.stack <= 1;
  $('stackPlus').disabled = state.stack >= 5;
  const ex = $('explodeRange');
  ex.value = state.explode;
  ex.style.setProperty('--p', `${state.explode * 100}%`);
}
$('dockSection').onclick = () => { haptic(); set('section', !state.section, true); syncDock(); };
$('dockDims').onclick = () => { haptic(); set('dims', !state.dims, true); syncDock(); };
$('stackMinus').onclick = () => { if (state.stack > 1) { haptic(); set('stack', state.stack - 1, true); syncDock(); } };
$('stackPlus').onclick = () => { if (state.stack < 5) { haptic(); set('stack', state.stack + 1, true); syncDock(); } };
$('explodeRange').addEventListener('input', (e) => { set('explode', +e.target.value, false); syncDock(); });
$('explodeRange').addEventListener('change', (e) => set('explode', +e.target.value, true));
$('viewBtn').onclick = (e) => {
  const pane = $('viewPane');
  if (openMenu !== $('viewPanel')) {
    pane.innerHTML = '';
    for (const [k, c] of [...controls]) if (c.row.closest('#viewPane')) controls.delete(k);
    const items = SCHEMA.filter((x) => [].concat(x.tab || []).includes('view'));
    for (const x of [...items.filter((i) => i.half), ...items.filter((i) => !i.half)]) pane.appendChild(makeControl(x));
    syncVisibility();
  }
  toggleMenu($('viewPanel'), e.currentTarget, 'down-right');
};
$('shareBtn').onclick = async () => {
  persist();
  const url = location.href;
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'My crate', url });
    else { await navigator.clipboard.writeText(url); toast('Link copied'); }
  } catch (e) { if (e.name !== 'AbortError') toast('Copy the address bar to share this crate'); }
};
addEventListener('keydown', (e) => {
  const typing = e.target.matches('input:not([type=range]), textarea');
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
  const dock = $('dock').getBoundingClientRect();
  const dockOnTop = dock.top < st.top + st.height / 2;
  const top = Math.max(brand.bottom, dockOnTop ? dock.bottom : 0) - st.top + 8;
  viewer.setInsets(top, st.bottom - plate.top + 8);
}
const insetRO = new ResizeObserver(() => measureInsets());
insetRO.observe($('stage'));
insetRO.observe($('plate'));
insetRO.observe($('dock'));
measureInsets();

new ResizeObserver(() => moveInk()).observe($('tabs'));
syncDock();
buildModes();
buildTabs();
buildPane(false);
syncUndo();
applyAll();
markPreset();
