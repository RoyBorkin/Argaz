// Procedural crate builder.
// Pure geometry: takes the Manifold WASM module + a params object, returns a mesh + stats.
// Units: millimetres, Z up. Face 0 points to -Y (the "front").

const TAU = Math.PI * 2;

export function buildCrate(wasm, P, quality = 1) {
  const { Manifold, CrossSection } = wasm;
  const trash = [];
  const T = (o) => { trash.push(o); return o; };

  const N = Math.round(P.sides);
  const a = P.width / 2;                      // apothem (centre → face)
  const H = P.height;
  const t = Math.max(0.6, Math.min(P.wall, a * 0.4));
  const r = Math.max(0, Math.min(P.corner, a - t - 1));
  const s = 1 + Math.tan((P.taper * Math.PI) / 180) * H / a; // top scale for draft
  const seg = Math.max(3, Math.round((quality >= 1 ? 10 : 5)));  // segments per corner arc
  const half = Math.PI / N;
  const straight = 2 * (a - r) * Math.tan(half);  // flat length of one face

  // ----- 2D helpers -------------------------------------------------------
  const normalAngle = (k) => -Math.PI / 2 + k * (TAU / N);

  // Rounded regular polygon (offset of the master outline by d, outward +)
  function rpoly(A, R, segs = seg) {
    R = Math.max(0, R);
    const pts = [];
    const cd = (A - R) / Math.cos(half);
    for (let k = 0; k < N; k++) {
      const t0 = normalAngle(k), t1 = normalAngle(k + 1);
      const cang = t0 + half;
      const cx = cd * Math.cos(cang), cy = cd * Math.sin(cang);
      if (R < 0.05) { pts.push([A / Math.cos(half) * Math.cos(cang), A / Math.cos(half) * Math.sin(cang)]); continue; }
      for (let i = 0; i <= segs; i++) {
        const th = t0 + (t1 - t0) * (i / segs);
        pts.push([cx + R * Math.cos(th), cy + R * Math.sin(th)]);
      }
    }
    return pts;
  }
  const offsetPoly = (d, segs) => rpoly(a + d, r + d, segs);
  const cs = (polys) => T(new CrossSection(polys, 'Positive'));

  function roundedRect(w, h, rr, cx = 0, cy = 0, segs = 6) {
    rr = Math.max(0, Math.min(rr, w / 2 - 0.01, h / 2 - 0.01));
    const pts = [];
    const corners = [[w / 2 - rr, h / 2 - rr, 0], [-w / 2 + rr, h / 2 - rr, 1], [-w / 2 + rr, -h / 2 + rr, 2], [w / 2 - rr, -h / 2 + rr, 3]];
    for (const [x, y, q] of corners) {
      if (rr < 0.05) { pts.push([cx + Math.sign(x || 1) * w / 2, cy + Math.sign(y || 1) * h / 2]); continue; }
      for (let i = 0; i <= segs; i++) {
        const th = (q * Math.PI) / 2 + (Math.PI / 2) * (i / segs);
        pts.push([cx + x + rr * Math.cos(th), cy + y + rr * Math.sin(th)]);
      }
    }
    return pts;
  }
  function holeShape(shape, w, h, rr, cx, cy) {
    const segs = quality >= 1 ? 6 : 3;
    switch (shape) {
      case 'circle': {
        const d = Math.min(w, h), pts = [], n = quality >= 1 ? 20 : 10;
        for (let i = 0; i < n; i++) pts.push([cx + (d / 2) * Math.cos((i / n) * TAU), cy + (d / 2) * Math.sin((i / n) * TAU)]);
        return pts;
      }
      case 'hex': {
        const pts = [];
        for (let i = 0; i < 6; i++) pts.push([cx + (w / 2) * Math.cos((i / 6) * TAU), cy + (h / 2) * Math.sin((i / 6) * TAU)]);
        return pts;
      }
      case 'diamond': return [[cx + w / 2, cy], [cx, cy + h / 2], [cx - w / 2, cy], [cx, cy - h / 2]];
      case 'rect': return roundedRect(w, h, rr, cx, cy, segs);
      case 'slot':
      default: return roundedRect(w, h, Math.min(w, h) / 2, cx, cy, segs);
    }
  }

  // ----- vertical layout of bands ----------------------------------------
  const baseH = Math.min(P.baseBand, H * 0.3);
  const rimH = Math.min(P.rimHeight, H * 0.3);
  const ribs = Math.round(P.ribCount);
  const ribH = P.ribHeight;
  const spanLo = baseH, spanHi = H - rimH;
  const span = Math.max(0, spanHi - spanLo - ribs * ribH);
  const weights = []; for (let i = 0; i <= ribs; i++) weights.push(Math.pow(P.ribGrade, i));
  const wsum = weights.reduce((x, y) => x + y, 0);
  const zones = []; const bands = [];
  bands.push({ z0: 0, z1: baseH, depth: P.ribDepth });
  let z = spanLo;
  for (let i = 0; i <= ribs; i++) {
    const zh = (span * weights[i]) / wsum;
    zones.push({ z0: z, z1: z + zh });
    z += zh;
    if (i < ribs) { bands.push({ z0: z, z1: z + ribH, depth: P.ribDepth }); z += ribH; }
  }
  bands.push({ z0: H - rimH, z1: H, depth: P.rimDepth });

  // ----- solids (built straight; draft is applied as a warp at the end) -----
  function ring(dOut, dIn, z0, z1) {
    if (z1 - z0 < 0.01 || dOut <= dIn) return null;
    const c = T(CrossSection.difference(cs([offsetPoly(dOut)]), cs([offsetPoly(dIn)])));
    return T(T(c.extrude(z1 - z0)).translate([0, 0, z0]));
  }
  function faceXform(m, k, nOff, zc, xc) {
    // local: x→u (tangent), y→z (up), z→n (outward)
    const th = normalAngle(k);
    const n = [Math.cos(th), Math.sin(th)], u = [-n[1], n[0]];
    const M = [u[0], u[1], 0, 0, 0, 0, 1, 0, n[0], n[1], 0, 0, n[0] * (a + nOff) + u[0] * xc, n[1] * (a + nOff) + u[1] * xc, zc, 1];
    return T(m.transform(M));
  }
  // wedge masks around each corner, starting `inset` before the end of the flat face
  function cornerMasks(fromCentre) {
    const R = (a + 80) / Math.cos(half) + 80;
    const masks = [];
    for (let k = 0; k < N; k++) {
      const t0 = normalAngle(k), t1 = normalAngle(k + 1);
      const n0 = [Math.cos(t0), Math.sin(t0)], n1 = [Math.cos(t1), Math.sin(t1)];
      const u0 = [-n0[1], n0[0]], u1 = [-n1[1], n1[0]];
      const e = fromCentre;
      const p0 = [u0[0] * e, u0[1] * e], p1 = [-u1[0] * e, -u1[1] * e];
      masks.push([[0, 0], p0, [p0[0] + n0[0] * R, p0[1] + n0[1] * R], [p1[0] + n1[0] * R, p1[1] + n1[1] * R], p1]);
    }
    return cs(masks);
  }

  const solids = [];
  const tf = Math.min(P.floor, H * 0.5);
  const label = P.label ? { w: Math.min(P.labelWidth, straight - 2 * P.holeMargin), h: Math.min(P.labelHeight, H * 0.6), zc: P.labelZ * H } : null;
  const handle = P.handles ? { w: Math.min(P.handleWidth, straight - 10), h: Math.min(P.handleHeight, H * 0.4), top: H - P.handleTop } : null;
  const handleFace = (k) => !!handle && (P.handleFaces === 'all' || (P.handleFaces === 'pair' && (N % 2 === 0 ? k % (N / 2) === 0 : k === 0)) || (P.handleFaces === 'front' && k === 0));

  // corner columns of the wall (arc pieces), overlapping the flat panels by 0.5 mm
  const wallRing = T(CrossSection.difference(cs([offsetPoly(0)]), cs([offsetPoly(-t)])));
  solids.push(T(T(wallRing.intersect(cornerMasks(straight / 2 - 0.5))).extrude(H)));

  // flat face panels: openings are cut in 2D, then extruded (fast + always watertight)
  let holeCount = 0;
  const hw = P.holeWidth, hh = P.holeHeight, gx = P.holeGapX, gy = P.holeGapY, m = P.holeMargin;
  const pillarClear = P.pillars ? Math.min(P.pillarWidth, straight * 0.45) : 0;
  const handleCutters = [];
  for (let k = 0; k < N; k++) {
    const polys = [];
    const usable = straight - 2 * Math.max(m, pillarClear + m * 0.5);
    if (P.holes && usable > hw) {
      const cols = Math.max(0, Math.floor((usable + gx) / (hw + gx)));
      const totalW = cols * hw + (cols - 1) * gx;
      for (const zn of zones) {
        const zh = zn.z1 - zn.z0 - 2 * m * 0.6;
        if (zh < Math.min(hh, 4)) continue;
        let rows, rowH;
        if (P.holeFill) { rows = Math.max(1, Math.round((zh + gy) / (hh + gy))); rowH = (zh - (rows - 1) * gy) / rows; }
        else { rows = Math.floor((zh + gy) / (hh + gy)); rowH = hh; }
        if (rows < 1 || rowH < 2) continue;
        const totalH = rows * rowH + (rows - 1) * gy;
        const zc0 = (zn.z0 + zn.z1) / 2 - totalH / 2 + rowH / 2;
        for (let ri = 0; ri < rows; ri++) {
          const cz = zc0 + ri * (rowH + gy);
          for (let ci = 0; ci < cols; ci++) {
            const cx = -totalW / 2 + hw / 2 + ci * (hw + gx);
            if (handleFace(k) && Math.abs(cx) < handle.w / 2 + gx + hw / 2 && cz + rowH / 2 > handle.top - handle.h - gy && cz - rowH / 2 < handle.top + gy) continue;
            if (label && k === 0 && Math.abs(cx) < label.w / 2 + gx * 0.5 + hw / 2 && Math.abs(cz - label.zc) < label.h / 2 + gy * 0.5 + rowH / 2) continue;
            polys.push(holeShape(P.holeShape, hw, rowH, P.holeRadius, cx, cz));
            holeCount++;
          }
        }
      }
    }
    let hshape = null;
    if (handleFace(k)) {
      hshape = holeShape(P.handleShape === 'rect' ? 'rect' : 'slot', handle.w, handle.h, P.handleRadius, 0, handle.top - handle.h / 2);
      polys.push(hshape);
      handleCutters.push(faceXform(T(cs([hshape]).extrude(80, 0, 0, 1, true)), k, 0, 0, 0));
    }
    let panel = cs([roundedRect(straight, H, 0, 0, H / 2)]);
    if (polys.length) panel = T(CrossSection.difference(panel, cs(polys)));
    solids.push(faceXform(T(panel.extrude(t)), k, -t, 0, 0));
  }

  // floor (openings cut in 2D)
  let floorHoles = 0;
  let floorCS = cs([offsetPoly(-t + 0.3)]);
  if (P.floorPattern !== 'none') {
    const fw = P.floorHole, fg = P.floorGap, fm = P.floorMargin;
    const A = a - t - fm;
    const rr = Math.max(r - t - fm, 0);
    const inside = (x, y, rad) => {
      for (let k = 0; k < N; k++) {
        const th = normalAngle(k);
        if (x * Math.cos(th) + y * Math.sin(th) > A - rad) return false;
        const bh = th + half;
        if (x * Math.cos(bh) + y * Math.sin(bh) > (A - rr) / Math.cos(half) + rr - rad) return false;
      }
      return true;
    };
    const hex = P.floorPattern === 'hex', slots = P.floorPattern === 'slots';
    const pitchX = fw + fg, pitchY = (slots ? P.floorSlotLen : hex ? fw * 0.866 : fw) + fg;
    const polys = [];
    const nx = Math.ceil(a / pitchX) + 1, ny = Math.ceil(a / pitchY) + 1;
    for (let iy = -ny; iy <= ny; iy++) {
      for (let ix = -nx; ix <= nx; ix++) {
        const x = ix * pitchX + (hex && (iy & 1) ? pitchX / 2 : 0);
        const y = iy * pitchY;
        if (slots) { if (!inside(x, y, Math.hypot(fw / 2, P.floorSlotLen / 2) * 0.9)) continue; polys.push(holeShape('slot', fw, P.floorSlotLen, 0, x, y)); }
        else if (hex) { if (!inside(x, y, fw / 2)) continue; polys.push(holeShape('hex', fw * 1.1547, fw, 0, x, y)); }
        else { if (!inside(x, y, fw * 0.71)) continue; polys.push(holeShape('rect', fw, fw, Math.min(2, fw / 4), x, y)); }
        floorHoles++;
      }
    }
    if (polys.length) floorCS = T(CrossSection.difference(floorCS, cs(polys)));
  }
  solids.push(T(floorCS.extrude(tf)));

  // bands (base band, ribs, top rim) + inner rim lip, with hand holds cut through
  const bandSolids = [];
  for (const b of bands) if (b.depth > 0.05) { const mm = ring(b.depth, -t * 0.5, b.z0, b.z1); if (mm) bandSolids.push(mm); }
  if (P.rimInner > 0.05) bandSolids.push(ring(-t * 0.5, -t - P.rimInner, H - rimH, H));
  if (P.pillars && P.pillarDepth > 0.05) {
    const pr = T(CrossSection.difference(cs([offsetPoly(P.pillarDepth)]), cs([offsetPoly(-t * 0.5)])));
    bandSolids.push(T(T(pr.intersect(cornerMasks(straight / 2 - Math.min(P.pillarWidth, straight * 0.45)))).extrude(H)));
  }
  if (label && P.labelRaise > 0.05) {
    bandSolids.push(faceXform(T(cs([roundedRect(label.w, label.h, 6)]).extrude(P.labelRaise + t * 0.5)), 0, -t * 0.5, label.zc, 0));
  }
  if (bandSolids.length) {
    let bs = T(Manifold.union(bandSolids.filter(Boolean)));
    if (handleCutters.length) bs = T(Manifold.difference(bs, T(Manifold.union(handleCutters))));
    solids.push(bs);
  }

  let body = T(Manifold.union(solids.filter(Boolean)));
  if (s !== 1) body = T(body.warp((v) => { const k = 1 + (s - 1) * (v[2] / H); v[0] *= k; v[1] *= k; }));
  const scaleAt = (zz) => 1 + (s - 1) * (zz / H);

  // stacking foot (sits below z=0, nests into the crate below)
  const footH = P.foot ? P.footHeight : 0;
  if (P.foot && footH > 0.1) {
    const dOut = -t - P.footClear - (P.rimInner > 0 ? P.rimInner : 0);
    const dIn = dOut - P.footWall;
    const c = T(CrossSection.difference(cs([offsetPoly(dOut)]), cs([offsetPoly(dIn)])));
    let foot = T(T(c.extrude(footH + tf * 0.5)).translate([0, 0, -footH]));
    // drain/vent notches in the foot so it doesn't trap water
    if (P.floorPattern !== 'none') {
      const notches = [];
      for (let k = 0; k < N; k++) {
        const b = T(T(Manifold.cube([straight * 0.3, 40, footH * 0.55], true)).translate([0, 0, -footH + footH * 0.25 - 0.01]));
        const th = normalAngle(k);
        notches.push(T(T(b.rotate([0, 0, (th * 180) / Math.PI + 90])).translate([Math.cos(th) * (a + dOut), Math.sin(th) * (a + dOut), 0])));
      }
      foot = T(Manifold.difference(foot, T(Manifold.union(notches))));
    }
    body = T(Manifold.union(body, foot));
    body = T(body.translate([0, 0, footH]));
  }

  if (P.scale !== 1) body = T(body.scale(P.scale));

  const mesh = body.getMesh();
  const volume = body.volume();
  const tris = body.numTri();
  const bb = body.boundingBox();
  const out = {
    positions: new Float32Array(mesh.vertProperties),
    numProp: mesh.numProp,
    index: new Uint32Array(mesh.triVerts),
    stats: {
      volume, tris, holes: holeCount, floorHoles,
      bbox: { min: Array.from(bb.min), max: Array.from(bb.max) },
      capacity: innerCapacity(),
      stackPitch: H * P.scale,
      footH: footH * P.scale,
      genus: body.genus ? body.genus() : null,
    },
  };
  for (const o of trash) { try { o.delete(); } catch (e) {} }
  return out;

  function innerCapacity() {
    // area of inner outline × usable height (litres)
    const pts = rpoly(a - t, r - t, 16);
    let ar = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; ar += p[0] * q[1] - q[0] * p[1]; }
    ar = Math.abs(ar) / 2;
    const k = (1 + s) / 2;
    return (ar * k * k * (H - tf) * Math.pow(P.scale, 3)) / 1e6;
  }
}
