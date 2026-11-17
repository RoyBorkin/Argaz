// Runs Manifold off the main thread so sliders never stutter.
import Module from '../vendor/manifold/manifold.js';
import { buildCrate } from './crate.js';

let wasm = null;
const ready = Module({ locateFile: (f) => new URL('../vendor/manifold/' + f, import.meta.url).href }).then((m) => { m.setup(); wasm = m; });

self.onmessage = async (e) => {
  const { id, params, quality } = e.data;
  try {
    await ready;
    const t0 = performance.now();
    const res = buildCrate(wasm, params, quality);
    const { positions, normals } = creased(res.positions, res.numProp, res.index, 32);
    const ms = performance.now() - t0;
    self.postMessage(
      { id, ok: true, positions, normals, mesh: { pos: res.positions, numProp: res.numProp, index: res.index }, stats: { ...res.stats, ms } },
      [positions.buffer, normals.buffer, res.positions.buffer, res.index.buffer]
    );
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message ? err.message : err) });
  }
};

// Non-indexed positions + normals, smoothing only across edges flatter than `deg`.
function creased(vp, np, idx, deg) {
  const nt = idx.length / 3;
  const fn = new Float32Array(nt * 3);
  for (let t = 0; t < nt; t++) {
    const a = idx[t * 3] * np, b = idx[t * 3 + 1] * np, c = idx[t * 3 + 2] * np;
    const ux = vp[b] - vp[a], uy = vp[b + 1] - vp[a + 1], uz = vp[b + 2] - vp[a + 2];
    const vx = vp[c] - vp[a], vy = vp[c + 1] - vp[a + 1], vz = vp[c + 2] - vp[a + 2];
    let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    // keep area weighting in a separate pass: store unit normal here
    const l = Math.hypot(x, y, z) || 1;
    fn[t * 3] = x / l; fn[t * 3 + 1] = y / l; fn[t * 3 + 2] = z / l;
  }
  // vertex → incident triangles
  const nv = vp.length / np;
  const count = new Uint32Array(nv + 1);
  for (let i = 0; i < idx.length; i++) count[idx[i] + 1]++;
  for (let i = 0; i < nv; i++) count[i + 1] += count[i];
  const fill = count.slice(0, nv);
  const inc = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) inc[fill[idx[i]]++] = (i / 3) | 0;

  const cos = Math.cos((deg * Math.PI) / 180);
  const positions = new Float32Array(nt * 9);
  const normals = new Float32Array(nt * 9);
  for (let t = 0; t < nt; t++) {
    const fx = fn[t * 3], fy = fn[t * 3 + 1], fz = fn[t * 3 + 2];
    for (let j = 0; j < 3; j++) {
      const v = idx[t * 3 + j];
      let sx = 0, sy = 0, sz = 0;
      for (let q = count[v]; q < count[v + 1]; q++) {
        const o = inc[q];
        const ox = fn[o * 3], oy = fn[o * 3 + 1], oz = fn[o * 3 + 2];
        if (ox * fx + oy * fy + oz * fz >= cos) { sx += ox; sy += oy; sz += oz; }
      }
      const l = Math.hypot(sx, sy, sz) || 1;
      const o = t * 9 + j * 3;
      positions[o] = vp[v * np]; positions[o + 1] = vp[v * np + 1]; positions[o + 2] = vp[v * np + 2];
      normals[o] = sx / l; normals[o + 1] = sy / l; normals[o + 2] = sz / l;
    }
  }
  return { positions, normals };
}
