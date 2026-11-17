import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Critically-damped-ish spring stepper (Apple-style "response" + damping ratio)
function spring(from, to, { response = 0.45, damping = 1, onUpdate, onDone }) {
  if (reduceMotion) { onUpdate(to); onDone && onDone(); return () => {}; }
  const k = Math.pow((2 * Math.PI) / response, 2), c = (4 * Math.PI * damping) / response;
  let x = from, v = 0, last = performance.now(), live = true;
  const step = (now) => {
    if (!live) return;
    const dt = Math.min(0.032, (now - last) / 1000); last = now;
    const f = -k * (x - to) - c * v; v += f * dt; x += v * dt;
    onUpdate(x);
    if (Math.abs(x - to) < 0.05 && Math.abs(v) < 0.05) { onUpdate(to); onDone && onDone(); return; }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return () => { live = false; };
}

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

    this.camera = new THREE.PerspectiveCamera(32, 1, 5, 40000);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minPolarAngle = 0.05;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.screenSpacePanning = true;

    const sun = (this.sun = new THREE.DirectionalLight(0xffffff, 1.6));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.6;
    this.scene.add(sun, sun.target);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f86, 0.35));

    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.16 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this.grid = new THREE.GridHelper(1, 1);
    this.scene.add(this.grid);

    // Z-up model space → Y-up world
    this.root = new THREE.Group();
    this.root.rotation.x = -Math.PI / 2;
    this.scene.add(this.root);

    this.clip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e5);
    this.mat = new THREE.MeshPhysicalMaterial({ color: '#295B2E', roughness: 0.55, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.6, sheen: 0.2, clippingPlanes: [this.clip], clipShadows: true, side: THREE.FrontSide });
    this.capMat = new THREE.MeshBasicMaterial({ color: '#1a3a1d', side: THREE.BackSide, clippingPlanes: [this.clip] });
    this.geom = new THREE.BufferGeometry();
    this.crates = [];
    this.stackCount = 1;
    this.stackPitch = 0;
    this.footH = 0;
    this.bbox = null;

    this.dimGroup = new THREE.Group();
    this.root.add(this.dimGroup);
    this.dimMat = new THREE.LineBasicMaterial({ color: 0x1b1f1c, transparent: true, opacity: 0.55 });
    this.labels = {};
    for (const k of ['w', 'h', 'd']) {
      const el = document.createElement('div');
      el.className = 'dim-label';
      labelsHost.appendChild(el);
      this.labels[k] = { el, pos: new THREE.Vector3() };
    }
    this.showDims = true;

    this._addCrate(0, false);
    this._resize = this._resize.bind(this);
    new ResizeObserver(this._resize).observe(host);
    this._resize();
    this._dirty = true;
    this.controls.addEventListener('change', () => (this._dirty = true));
    const loop = () => {
      requestAnimationFrame(loop);
      const moved = this.controls.update();
      if (moved || this._dirty || this._anim > 0) { this._render(); this._dirty = false; }
    };
    this._anim = 0;
    loop();
  }

  _addCrate(index, animate) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(this.geom, this.mat);
    m.castShadow = true; m.receiveShadow = true;
    const cap = new THREE.Mesh(this.geom, this.capMat);
    g.add(m, cap);
    this.root.add(g);
    this.crates.push(g);
    const target = index * this.stackPitch;
    if (animate) {
      this._anim++;
      const from = target + Math.max(200, this.stackPitch * 1.4);
      g.position.z = from;
      spring(from, target, { response: 0.55, damping: 0.78, onUpdate: (z) => { g.position.z = z; this._dirty = true; }, onDone: () => this._anim-- });
    } else g.position.z = target;
    return g;
  }

  setGeometry(positions, normals, stats, first) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    g.computeBoundingBox();
    const old = this.geom;
    this.geom = g;
    for (const c of this.crates) for (const m of c.children) m.geometry = g;
    old.dispose();
    this.bbox = g.boundingBox;
    const pitchChanged = Math.abs(stats.stackPitch - this.stackPitch) > 0.01;
    this.stackPitch = stats.stackPitch;
    this.footH = stats.footH;
    if (pitchChanged) this.crates.forEach((c, i) => (c.position.z = i * this.stackPitch));
    this._fitStage();
    this._updateDims();
    if (first) {
      this.frame(true);
      if (!reduceMotion) {
        const c = this.crates[0];
        this._anim++;
        c.scale.setScalar(0.96);
        spring(0, 1, { response: 0.6, damping: 1, onUpdate: (x) => { c.scale.setScalar(0.96 + 0.04 * x); c.position.z = (1 - x) * -20; this._dirty = true; }, onDone: () => this._anim-- });
      }
    }
    if (this.sectionOn) this.clip.constant = 0;
    this._dirty = true;
  }

  setStack(n) {
    n = Math.max(1, Math.round(n));
    while (this.crates.length < n) this._addCrate(this.crates.length, true);
    while (this.crates.length > n) { const g = this.crates.pop(); this.root.remove(g); }
    this.stackCount = n;
    this._fitStage();
    this._updateDims();
    this._dirty = true;
  }

  setColor(hex) {
    this.mat.color.set(hex);
    const c = new THREE.Color(hex); c.multiplyScalar(0.55);
    this.capMat.color.copy(c);
    this._dirty = true;
  }
  setGloss(g) {
    this.mat.roughness = 0.85 - g * 0.7;
    this.mat.clearcoat = g * 0.6;
    this.mat.clearcoatRoughness = 0.5 - g * 0.4;
    this._dirty = true;
  }
  setSection(on) {
    if (on === this.sectionOn) return;
    this.sectionOn = on;
    if (!this.bbox) return;
    const ext = Math.max(this.bbox.max.x, -this.bbox.min.x) + 5;
    this._anim++;
    spring(on ? ext : 0, on ? 0 : ext, { response: 0.42, damping: 1, onUpdate: (x) => { this.clip.constant = x; this._dirty = true; }, onDone: () => { this._anim--; if (!on) this.clip.constant = 1e5; } });
  }
  setDims(on) { this.showDims = on; this._updateDims(); this._dirty = true; }

  _fitStage() {
    if (!this.bbox) return;
    const b = this.bbox;
    const size = Math.max(b.max.x - b.min.x, b.max.y - b.min.y);
    const H = b.max.z + (this.stackCount - 1) * this.stackPitch;
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
    sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.near = 1; sc.far = (H + size) * 6;
    sc.updateProjectionMatrix();
  }

  frame(instant) {
    if (!this.bbox) return;
    const b = this.bbox;
    const size = Math.max(b.max.x - b.min.x, b.max.y - b.min.y);
    const H = b.max.z + (this.stackCount - 1) * this.stackPitch;
    const radius = Math.hypot(size, H) * 0.62;
    const fov = (this.camera.fov * Math.PI) / 180;
    const hh = this.host.clientHeight || 1;
    const vis = Math.max(0.35, (hh - this.insetTop - this.insetBottom) / hh);
    const aspect = this.camera.aspect / vis;
    const vfov = 2 * Math.atan(Math.tan(fov / 2) * vis);
    const fit = radius / Math.sin(Math.min(vfov, 2 * Math.atan(Math.tan(vfov / 2) * aspect)) / 2);
    const target = new THREE.Vector3(0, H * 0.45, 0);
    const dir = new THREE.Vector3(0.62, 0.48, 1).normalize();
    const pos = target.clone().addScaledVector(dir, fit * 1.02);
    if (instant || reduceMotion) { this.camera.position.copy(pos); this.controls.target.copy(target); this.controls.update(); this._dirty = true; return; }
    const p0 = this.camera.position.clone(), t0 = this.controls.target.clone();
    this._anim++;
    spring(0, 1, { response: 0.5, damping: 1, onUpdate: (x) => { this.camera.position.lerpVectors(p0, pos, x); this.controls.target.lerpVectors(t0, target, x); this._dirty = true; }, onDone: () => this._anim-- });
  }

  _updateDims() {
    this.dimGroup.clear();
    const vis = this.showDims && this.bbox;
    for (const k in this.labels) this.labels[k].el.style.opacity = vis ? 1 : 0;
    if (!vis) return;
    const b = this.bbox;
    const top = b.max.z + (this.stackCount - 1) * this.stackPitch;
    const off = (b.max.x - b.min.x) * 0.1 + 10;
    const pts = [];
    const tick = off * 0.25;
    // width: along front (−Y) bottom edge
    const y = b.min.y - off;
    pts.push(b.min.x, y, 0, b.max.x, y, 0, b.min.x, y - tick, 0, b.min.x, y + tick, 0, b.max.x, y - tick, 0, b.max.x, y + tick, 0);
    // depth: along right edge
    const x = b.max.x + off;
    pts.push(x, b.min.y, 0, x, b.max.y, 0, x - tick, b.min.y, 0, x + tick, b.min.y, 0, x - tick, b.max.y, 0, x + tick, b.max.y, 0);
    // height: front-right vertical
    const hx = b.min.x - off, hy = b.min.y - off;
    pts.push(hx, hy, 0, hx, hy, top, hx - tick, hy, top, hx + tick, hy, top);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.dimGroup.add(new THREE.LineSegments(g, this.dimMat));
    this.labels.w.pos.set(0, y - tick * 1.6, 0);
    this.labels.w.text = (b.max.x - b.min.x).toFixed(0);
    this.labels.d.pos.set(x + tick * 1.6, 0, 0);
    this.labels.d.text = (b.max.y - b.min.y).toFixed(0);
    this.labels.h.pos.set(hx - tick * 1.4, hy, top / 2);
    this.labels.h.text = top.toFixed(0);
    for (const k in this.labels) this.labels[k].el.textContent = this.labels[k].text;
  }

  _placeLabels() {
    if (!this.showDims || !this.bbox) return;
    const w = this.host.clientWidth, h = this.host.clientHeight;
    const v = new THREE.Vector3();
    this.root.updateMatrixWorld();
    for (const k in this.labels) {
      const L = this.labels[k];
      v.copy(L.pos).applyMatrix4(this.root.matrixWorld).project(this.camera);
      L.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -50%)`;
    }
  }

  _render() {
    this.renderer.render(this.scene, this.camera);
    this._placeLabels();
  }

  // keep the crate centred in the area not covered by overlays (brand on top, plate at bottom)
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

  snapshot() {
    this._render();
    return new Promise((res) => this.renderer.domElement.toBlob(res, 'image/png'));
  }

  // three.js mesh in Y-up world for GLB export (single crate)
  exportObject() {
    const m = new THREE.Mesh(this.geom, this.mat.clone());
    m.material.clippingPlanes = [];
    m.rotation.x = -Math.PI / 2;
    m.scale.setScalar(0.001); // glTF is in metres
    const g = new THREE.Group(); g.add(m); g.name = 'crate';
    return g;
  }
}
