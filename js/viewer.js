// Argaz, parametric crate configurator. © 2026 Roy Borkin. All rights reserved.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Spring stepper with Apple-style parameters: response (s) and damping ratio.
function spring(from, to, { response = 0.45, damping = 1, onUpdate, onDone }) {
  if (reduceMotion) { onUpdate(to); onDone && onDone(); return () => {}; }
  const k = Math.pow((2 * Math.PI) / response, 2), c = (4 * Math.PI * damping) / response;
  let x = from, v = 0, last = performance.now(), live = true;
  const step = (now) => {
    if (!live) return;
    const dt = Math.min(0.032, (now - last) / 1000); last = now;
    v += (-k * (x - to) - c * v) * dt; x += v * dt;
    onUpdate(x);
    if (Math.abs(x - to) < 0.0015 * Math.max(1, Math.abs(to - from)) && Math.abs(v) < 0.01) { onUpdate(to); onDone && onDone(); return; }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return () => { live = false; };
}

const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
const ID = new THREE.Quaternion();

export class Viewer {
  constructor(host, labelsHost) {
    this.host = host;
    this.labelsHost = labelsHost;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }));
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 0.95;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.localClippingEnabled = true;
    host.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.8;
    this.insetBottom = 0; this.insetTop = 0;

    this.camera = new THREE.PerspectiveCamera(32, 1, 5, 60000);
    this.controls = new OrbitControls(this.camera, r.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, minPolarAngle: 0.05, maxPolarAngle: Math.PI * 0.62, screenSpacePanning: true });

    const sun = (this.sun = new THREE.DirectionalLight(0xffffff, 1.6));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.6;
    this.scene.add(sun, sun.target, new THREE.HemisphereLight(0xffffff, 0x8a8f86, 0.35));

    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.16 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this.grid = new THREE.GridHelper(1, 1);
    this.scene.add(this.grid);

    this.root = new THREE.Group();            // Z-up model space → Y-up world
    this.root.rotation.x = -Math.PI / 2;
    this.scene.add(this.root);

    this.clip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e5);
    const plastic = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.55, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.6, sheen: 0.2, clippingPlanes: [this.clip], clipShadows: true });
    this.mat = plastic('#295B2E');
    this.capMat = new THREE.MeshBasicMaterial({ color: '#1a3a1d', side: THREE.BackSide, clippingPlanes: [this.clip] });
    this.fabric = new THREE.MeshPhysicalMaterial({ color: '#C9B8A0', roughness: 0.92, sheen: 0.45, sheenRoughness: 0.9, sheenColor: new THREE.Color('#d8d2c8'), clippingPlanes: [this.clip], clipShadows: true });
    this.fabricCap = new THREE.MeshBasicMaterial({ color: '#8d806f', side: THREE.BackSide, clippingPlanes: [this.clip] });

    this.parts = new Map();   // id → { info, geom, objs: [Group per stack copy], label }
    this.order = [];
    this.stack = 1;
    this.explode = 0;
    this.bedT = 0;            // 0 = assembled, 1 = on the print bed (animated)
    this.bedOn = false;
    this.layout = null;       // { plates, poses: Map id → {pos, flip} , bounds }
    this.stackPitch = 0;
    this.bbox = null;
    this.showDims = true;

    this.bedGroup = new THREE.Group();
    this.root.add(this.bedGroup);
    this.dimGroup = new THREE.Group();
    this.root.add(this.dimGroup);
    this.dimMat = new THREE.LineBasicMaterial({ color: 0x1b1f1c, transparent: true, opacity: 0.55 });
    this.dimLabels = {};
    for (const k of ['w', 'h', 'd']) {
      const el = document.createElement('div');
      el.className = 'dim-label';
      labelsHost.appendChild(el);
      this.dimLabels[k] = { el, pos: new THREE.Vector3() };
    }

    this._resize = this._resize.bind(this);
    new ResizeObserver(this._resize).observe(host);
    this._resize();
    this._dirty = true;
    this._anim = 0;
    this.controls.addEventListener('change', () => (this._dirty = true));
    const loop = () => {
      requestAnimationFrame(loop);
      const moved = this.controls.update();
      if (moved || this._dirty || this._anim > 0) { this._render(); this._dirty = false; }
    };
    loop();
  }

  // ---------------- geometry ----------------
  setParts(list, stats, first) {
    const seen = new Set();
    for (const p of list) {
      seen.add(p.id);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p.positions, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(p.normals, 3));
      g.computeBoundingBox();
      let e = this.parts.get(p.id);
      if (!e) {
        const label = document.createElement('div');
        label.className = 'part-label';
        label.innerHTML = '<b></b><small></small>';
        this.labelsHost.appendChild(label);
        e = { objs: [], label };
        this.parts.set(p.id, e);
      }
      const old = e.geom;
      e.geom = g; e.info = p;
      for (const o of e.objs) for (const m of o.children) m.geometry = g;
      if (old) old.dispose();
      e.label.querySelector('b').textContent = p.label;
      e.label.querySelector('small').textContent = p.joint ? `${{ snap: 'Snap', glue: 'Glue', press: 'Tight-gap' }[p.joint]} joint above` : p.preview ? 'Preview only' : '';
    }
    for (const [id, e] of this.parts) if (!seen.has(id)) { for (const o of e.objs) this.root.remove(o); e.geom.dispose(); e.label.remove(); this.parts.delete(id); }
    this.order = [...this.parts.values()].sort((a, b) => a.info.order - b.info.order);
    this.stats = stats;
    const prevPitch = this.stackPitch;
    this.stackPitch = stats.stackPitch;
    this.bbox = new THREE.Box3(new THREE.Vector3(...stats.bbox.min), new THREE.Vector3(...stats.bbox.max));
    this.fullBox = new THREE.Box3();
    for (const e of this.order) this.fullBox.union(e.geom.boundingBox);
    this._syncCopies();
    this._fitStage();
    this._pose();
    this._updateDims();
    if (first) {
      this.frame(true);
      if (!reduceMotion) {
        this._anim++;
        spring(0, 1, { response: 0.6, damping: 1, onUpdate: (x) => { this.root.position.y = (1 - x) * -20; this.root.scale.setScalar(0.96 + 0.04 * x); this._dirty = true; }, onDone: () => this._anim-- });
      }
    } else if (Math.abs(prevPitch - this.stackPitch) > 0.01) this._pose();
    if (this.sectionOn) this.clip.constant = 0;
    this._dirty = true;
  }

  _effStack() { return this.explode > 0.002 || this.bedOn || this.bedT > 0.001 ? 1 : this.stack; }

  _syncCopies(animateNew) {
    const n = this._effStack();
    for (const e of this.parts.values()) {
      const crateKind = e.info.kind === 'crate' || e.info.kind === 'base' || e.info.kind === 'section';
      const want = crateKind ? n : 1;
      while (e.objs.length < want) {
        const g = new THREE.Group();
        const fab = e.info.kind === 'cushion';
        const m = new THREE.Mesh(e.geom, fab ? this.fabric : this.mat);
        m.castShadow = true; m.receiveShadow = true;
        g.add(m, new THREE.Mesh(e.geom, fab ? this.fabricCap : this.capMat));
        this.root.add(g);
        g.userData.copy = e.objs.length;
        if (animateNew && e.objs.length > 0) g.userData.drop = 1; // drop in from above
        e.objs.push(g);
        this._paintCopy(e, g, e.objs.length - 1);
      }
      while (e.objs.length > want) this.root.remove(e.objs.pop());
    }
  }

  // ---------------- poses ----------------
  _pose() {
    if (!this.order.length) return;
    const gap = Math.max(40, (this.bbox ? this.bbox.max.z - this.bbox.min.z : 200) * 0.28) * this.explode;
    const n = this._effStack();
    const topLift = (n - 1) * this.stackPitch;
    let rank = 0;
    const p = new THREE.Vector3(), q = new THREE.Quaternion();
    for (const e of this.order) {
      const crateKind = e.info.kind === 'crate' || e.info.kind === 'base' || e.info.kind === 'section';
      const myRank = e.info.kind === 'cushion' ? rank : rank++;
      e.objs.forEach((o, i) => {
        // assembled (+ exploded) pose
        const az = crateKind ? i * this.stackPitch + myRank * gap + (o.userData.dropZ || 0) : topLift + myRank * gap;
        p.set(0, 0, az); q.copy(ID);
        // bed pose
        const bp = this.layout && this.layout.poses.get(e.info.id);
        if (bp && this.bedT > 0 && i === 0) {
          const t = this.bedT;
          const target = new THREE.Vector3(...bp.pos);
          p.lerp(target, t);
          q.slerpQuaternions(ID, bp.flip ? FLIP : ID, t);
        }
        o.position.copy(p);
        o.quaternion.copy(q);
        o.visible = !(e.info.preview && this.bedT > 0.5);
      });
    }
    this._dirty = true;
  }

  setStack(n) {
    n = Math.max(1, Math.round(n));
    const grow = n > this.stack;
    this.stack = n;
    this._syncCopies(grow);
    // new copies fall into place with a little bounce
    for (const e of this.parts.values()) for (const o of e.objs) if (o.userData.drop) {
      o.userData.drop = 0;
      const from = Math.max(200, this.stackPitch * 1.4);
      o.userData.dropZ = from;
      this._anim++;
      spring(from, 0, { response: 0.55, damping: 0.78, onUpdate: (z) => { o.userData.dropZ = z; this._pose(); }, onDone: () => this._anim-- });
    }
    this._pose(); this._fitStage(); this._updateDims();
  }

  setExplode(x) {
    const was = this._effStack();
    this.explode = x;
    if (was !== this._effStack()) { this._syncCopies(); this._fitStage(); }
    this._pose(); this._updateDims();
  }

  setLayout(layout) {
    this.layout = layout;
    this._drawBeds();
    this._pose();
  }

  setBedView(on) {
    if (on === this.bedOn && this._bedAnim) return;
    this.bedOn = on;
    this._syncCopies();
    if (this._bedStop) this._bedStop();
    this._anim++;
    const done = () => { this._anim--; this._bedAnim = false; this._syncCopies(); this._pose(); this._updateDims(); };
    this._bedAnim = true;
    this._bedStop = spring(this.bedT, on ? 1 : 0, {
      response: 0.7, damping: 1,
      onUpdate: (x) => { this.bedT = Math.max(0, Math.min(1, x)); this.bedGroup.children.forEach((c) => c.material && (c.material.opacity = c.userData.op * this.bedT)); this._pose(); this._updateDims(); },
      onDone: done,
    });
    this.frame(false, on);
  }

  _drawBeds() {
    this.bedGroup.clear();
    if (!this.layout) return;
    for (const pl of this.layout.plates) {
      const shape = new THREE.Shape();
      const [x0, y0] = pl.origin, w = pl.size[0], d = pl.size[1], rr = 8;
      shape.moveTo(x0 + rr, y0); shape.lineTo(x0 + w - rr, y0); shape.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + rr);
      shape.lineTo(x0 + w, y0 + d - rr); shape.quadraticCurveTo(x0 + w, y0 + d, x0 + w - rr, y0 + d);
      shape.lineTo(x0 + rr, y0 + d); shape.quadraticCurveTo(x0, y0 + d, x0, y0 + d - rr);
      shape.lineTo(x0, y0 + rr); shape.quadraticCurveTo(x0, y0, x0 + rr, y0);
      const fill = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: pl.ok ? 0x2b2f2c : 0xc0392b, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
      fill.userData.op = pl.ok ? 0.06 : 0.1;
      fill.position.z = 0.2;
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(shape.getPoints(6).map((v) => new THREE.Vector3(v.x, v.y, 0.4))), new THREE.LineBasicMaterial({ color: pl.ok ? 0x2b2f2c : 0xc0392b, transparent: true, opacity: 0 }));
      line.userData.op = pl.ok ? 0.5 : 0.9;
      this.bedGroup.add(fill, line);
    }
    this.bedGroup.children.forEach((c) => (c.material.opacity = c.userData.op * this.bedT));
  }

  // ---------------- look ----------------
  setColor(hex) { this.mat.color.set(hex); this.capMat.color.set(hex).multiplyScalar(0.55); this._dirty = true; }
  // per-crate colours in the stack preview (null = all the same)
  setMix(colors) {
    this.mix = colors;
    this.copyMats = this.copyMats || [];
    for (const e of this.parts.values()) e.objs.forEach((o, i) => this._paintCopy(e, o, i));
    this._dirty = true;
  }
  _matFor(i) {
    if (!this.mix || i === 0) return [this.mat, this.capMat];
    const c = this.mix[i % this.mix.length];
    let m = this.copyMats[i];
    if (!m) {
      m = this.copyMats[i] = [this.mat.clone(), this.capMat.clone()];
      m[0].clippingPlanes = [this.clip]; m[1].clippingPlanes = [this.clip];
    }
    m[0].color.set(c);
    for (const k of ['roughness', 'clearcoat', 'clearcoatRoughness']) m[0][k] = this.mat[k];
    m[1].color.set(c).multiplyScalar(0.55);
    return m;
  }
  _paintCopy(e, o, i) {
    if (e.info.kind === 'cushion') return;
    const crateKind = e.info.kind === 'crate' || e.info.kind === 'base' || e.info.kind === 'section';
    const [m, c] = this._matFor(crateKind ? i : 0);
    o.children[0].material = m; o.children[1].material = c;
  }
  setFabric(hex) { this.fabric.color.set(hex); this.fabricCap.color.set(hex).multiplyScalar(0.7); this._dirty = true; }
  setGloss(g) {
    this.mat.roughness = 0.85 - g * 0.7; this.mat.clearcoat = g * 0.6; this.mat.clearcoatRoughness = 0.5 - g * 0.4;
    for (const m of this.copyMats || []) if (m) for (const k of ['roughness', 'clearcoat', 'clearcoatRoughness']) m[0][k] = this.mat[k];
    this._dirty = true;
  }
  setSection(on) {
    if (on === this.sectionOn) return;
    this.sectionOn = on;
    if (!this.fullBox) return;
    const ext = Math.max(this.fullBox.max.x, -this.fullBox.min.x) + 5;
    this._anim++;
    spring(on ? ext : 0, on ? 0 : ext, { response: 0.42, damping: 1, onUpdate: (x) => { this.clip.constant = x; this._dirty = true; }, onDone: () => { this._anim--; if (!on) this.clip.constant = 1e5; } });
  }
  setDims(on) { this.showDims = on; this._updateDims(); this._dirty = true; }

  _sceneBox() {
    const b = new THREE.Box3();
    if (this.bedT > 0.5 && this.layout) { const L = this.layout.bounds; b.set(new THREE.Vector3(L[0], L[1], 0), new THREE.Vector3(L[2], L[3], L[4])); return b; }
    if (!this.fullBox) return null;
    b.copy(this.fullBox);
    const n = this._effStack();
    const gap = Math.max(40, (this.bbox.max.z - this.bbox.min.z) * 0.28) * this.explode;
    b.max.z += (n - 1) * this.stackPitch + gap * Math.max(0, this.order.filter((e) => !e.info.preview).length - 1);
    return b;
  }

  _fitStage() {
    const b = this._sceneBox();
    if (!b) return;
    const size = Math.max(b.max.x - b.min.x, b.max.y - b.min.y);
    const H = b.max.z;
    const span = Math.max(size, H) * 4;
    this.ground.scale.set(span, span, 1);
    const step = size > 220 ? 50 : size > 80 ? 10 : 5;
    const div = Math.max(2, Math.round(span / step / 2) * 2);
    this.scene.remove(this.grid);
    this.grid.geometry.dispose();
    this.grid = new THREE.GridHelper(div * step, div, 0x9aa198, 0xb9beb6);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.22;
    this.grid.position.y = 0.05;
    this.scene.add(this.grid);
    const s = this.sun;
    s.position.set(size * 0.9, H * 2.2 + size, size * 1.3);
    s.target.position.set(0, H * 0.3, 0);
    const sc = s.shadow.camera, e = Math.max(size, H) * 1.1;
    Object.assign(sc, { left: -e, right: e, top: e, bottom: -e, near: 1, far: (H + size) * 6 });
    sc.updateProjectionMatrix();
  }

  frame(instant, bed = this.bedT > 0.5) {
    const save = this.bedT;
    this.bedT = bed ? 1 : 0;
    const b = this._sceneBox();
    this.bedT = save;
    if (!b) return;
    this._fitStage();
    const sx = b.max.x - b.min.x, sy = b.max.y - b.min.y, H = b.max.z;
    const radius = Math.hypot(Math.max(sx, sy), H) * (bed ? 0.55 : 0.62);
    const fov = (this.camera.fov * Math.PI) / 180;
    const hh = this.host.clientHeight || 1;
    const vis = Math.max(0.35, (hh - this.insetTop - this.insetBottom) / hh);
    const aspect = this.camera.aspect / vis;
    const vfov = 2 * Math.atan(Math.tan(fov / 2) * vis);
    const fit = radius / Math.sin(Math.min(vfov, 2 * Math.atan(Math.tan(vfov / 2) * aspect)) / 2);
    // model (x, y, z) → world (x, z, -y)
    const cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2;
    const target = new THREE.Vector3(cx, H * (bed ? 0.2 : 0.45), -cy);
    const dir = bed ? new THREE.Vector3(0.25, 0.95, 0.75).normalize() : new THREE.Vector3(0.62, 0.48, 1).normalize();
    const pos = target.clone().addScaledVector(dir, fit * 1.02);
    if (instant || reduceMotion) { this.camera.position.copy(pos); this.controls.target.copy(target); this.controls.update(); this._dirty = true; return; }
    const p0 = this.camera.position.clone(), t0 = this.controls.target.clone();
    this._anim++;
    spring(0, 1, { response: 0.6, damping: 1, onUpdate: (x) => { this.camera.position.lerpVectors(p0, pos, x); this.controls.target.lerpVectors(t0, target, x); this._dirty = true; }, onDone: () => this._anim-- });
  }

  _updateDims() {
    this.dimGroup.clear();
    const vis = this.showDims && this.bbox && this.explode < 0.02 && this.bedT < 0.02;
    for (const k in this.dimLabels) this.dimLabels[k].el.style.opacity = vis ? 1 : 0;
    if (!vis) return;
    const b = this.bbox;
    const n = this._effStack();
    let top = b.max.z + (n - 1) * this.stackPitch;
    if (this.fullBox) top = Math.max(top, this.fullBox.max.z + (n - 1) * this.stackPitch);
    const off = (b.max.x - b.min.x) * 0.1 + 10, tick = off * 0.25, pts = [];
    const y = b.min.y - off, x = b.max.x + off, hx = b.min.x - off, hy = b.min.y - off;
    pts.push(b.min.x, y, 0, b.max.x, y, 0, b.min.x, y - tick, 0, b.min.x, y + tick, 0, b.max.x, y - tick, 0, b.max.x, y + tick, 0);
    pts.push(x, b.min.y, 0, x, b.max.y, 0, x - tick, b.min.y, 0, x + tick, b.min.y, 0, x - tick, b.max.y, 0, x + tick, b.max.y, 0);
    pts.push(hx, hy, 0, hx, hy, top, hx - tick, hy, top, hx + tick, hy, top);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.dimGroup.add(new THREE.LineSegments(g, this.dimMat));
    const L = this.dimLabels;
    L.w.pos.set(0, y - tick * 1.6, 0); L.w.el.textContent = (b.max.x - b.min.x).toFixed(0);
    L.d.pos.set(x + tick * 1.6, 0, 0); L.d.el.textContent = (b.max.y - b.min.y).toFixed(0);
    L.h.pos.set(hx - tick * 1.4, hy, top / 2); L.h.el.textContent = top.toFixed(0);
    this._dirty = true;
  }

  _placeLabels() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    const v = new THREE.Vector3();
    this.root.updateMatrixWorld();
    if (this.showDims) for (const k in this.dimLabels) {
      const L = this.dimLabels[k];
      v.copy(L.pos).applyMatrix4(this.root.matrixWorld).project(this.camera);
      L.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -50%)`;
    }
    // part callouts: visible when exploded or on the bed
    const show = Math.max(Math.min(1, this.explode * 4), this.bedT);
    for (const e of this.parts.values()) {
      const el = e.label;
      if (show < 0.02 || !e.objs[0] || !e.objs[0].visible) { el.style.opacity = 0; continue; }
      const gb = e.geom.boundingBox;
      const o = e.objs[0];
      o.updateMatrixWorld();
      const bed = this.bedT > 0.5;
      // anchor: right edge, mid height when exploded; centre top on the bed
      if (bed) v.set((gb.min.x + gb.max.x) / 2, (gb.min.y + gb.max.y) / 2, o.quaternion.x ? gb.min.z : gb.max.z);
      else v.set(gb.max.x, (gb.min.y + gb.max.y) / 2, (gb.min.z + gb.max.z) / 2);
      v.applyMatrix4(o.matrixWorld).project(this.camera);
      el.classList.toggle('on-bed', bed);
      el.classList.toggle('dense', this.parts.size > 6);
      el.style.opacity = show;
      el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
    }
  }

  _render() { this.renderer.render(this.scene, this.camera); this._placeLabels(); }

  setInsets(top, bottom) { this.insetTop = top; this.insetBottom = bottom; this._resize(); }
  _resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    const shift = (this.insetBottom - this.insetTop) / 2;
    if (shift) this.camera.setViewOffset(w, h, 0, shift, w, h); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this._dirty = true;
  }

  snapshot() { this._render(); return new Promise((res) => this.renderer.domElement.toBlob(res, 'image/png')); }

  // assembled scene for GLB export (metres, Y up)
  exportObject() {
    const g = new THREE.Group(); g.name = 'crate-set';
    for (const e of this.order) {
      if (e.info.preview) continue;
      const m = new THREE.Mesh(e.geom, this.mat.clone());
      m.material.clippingPlanes = [];
      m.name = e.info.label;
      g.add(m);
    }
    g.rotation.x = -Math.PI / 2;
    g.scale.setScalar(0.001);
    const w = new THREE.Group(); w.add(g); return w;
  }
}
