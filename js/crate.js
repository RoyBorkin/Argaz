// Procedural crate + cover builder.
// Pure geometry: takes the Manifold WASM module + params, returns a list of parts (meshes + stats).
// Units: millimetres, Z up. Face 0 points to -Y (the "front").
// Printer tolerances (joint gaps, fit clearances, snap bumps) are absolute: they are NOT scaled.

const TAU = Math.PI * 2;

export function buildSet(wasm, P, quality = 1, logo = null) {
  const { Manifold, CrossSection } = wasm;
  const trash = [];
  const T = (o) => { trash.push(o); return o; };
  const S = P.scale || 1;
  const abs = (mm) => mm / S;            // absolute mm → model units (model is scaled by S at the end)
  const printMode = !!P.printReady;

  const N = Math.round(P.sides);
  const a = P.width / 2;
  const H = P.height;
  const t = Math.max(0.6, Math.min(P.wall, a * 0.4));
  const r = Math.max(0, Math.min(P.corner, a - t - 1));
  const s = 1 + Math.tan((P.taper * Math.PI) / 180) * H / a; // top scale for draft
  const seg = quality >= 1 ? 10 : 5;
  const half = Math.PI / N;
  const straight = 2 * (a - r) * Math.tan(half);
  const normalAngle = (k) => -Math.PI / 2 + k * (TAU / N);
  const scaleAt = (zz) => 1 + (s - 1) * (Math.max(0, Math.min(H, zz)) / H);
  const rimInner = P.rimInner > 0.05 ? P.rimInner : 0;

  // ---------- 2D helpers ----------
  function rpoly(A, R, segs = seg) {
    R = Math.max(0, R);
    const pts = [];
    const cd = (A - R) / Math.cos(half);
    for (let k = 0; k < N; k++) {
      const t0 = normalAngle(k), t1 = normalAngle(k + 1), cang = t0 + half;
      const cx = cd * Math.cos(cang), cy = cd * Math.sin(cang);
      if (R < 0.05) { pts.push([(A / Math.cos(half)) * Math.cos(cang), (A / Math.cos(half)) * Math.sin(cang)]); continue; }
      for (let i = 0; i <= segs; i++) {
        const th = t0 + (t1 - t0) * (i / segs);
        pts.push([cx + R * Math.cos(th), cy + R * Math.sin(th)]);
      }
    }
    return pts;
  }
  const offsetPoly = (d, segs) => rpoly(a + d, r + d, segs);
  const cs = (polys) => T(new CrossSection(polys, 'Positive'));
  const ringCS = (dOut, dIn) => T(CrossSection.difference(cs([offsetPoly(dOut)]), cs([offsetPoly(dIn)])));
  const ext = (c, z0, z1) => T(T(c.extrude(Math.max(0.01, z1 - z0))).translate([0, 0, z0]));
  const slab = (d, z0, z1) => ext(cs([offsetPoly(d)]), z0, z1);
  const ring = (dOut, dIn, z0, z1) => (z1 - z0 < 0.01 || dOut <= dIn ? null : ext(ringCS(dOut, dIn), z0, z1));
  const hull = (list) => T(Manifold.hull(list));
  const union = (list) => { const l = list.filter(Boolean); return l.length ? T(Manifold.union(l)) : null; };
  const diff = (A, B) => (B ? T(Manifold.difference(A, B)) : A);

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
      case 'hex': { const pts = []; for (let i = 0; i < 6; i++) pts.push([cx + (w / 2) * Math.cos((i / 6) * TAU), cy + (h / 2) * Math.sin((i / 6) * TAU)]); return pts; }
      case 'diamond': return [[cx + w / 2, cy], [cx, cy + h / 2], [cx - w / 2, cy], [cx, cy - h / 2]];
      case 'rect': return roundedRect(w, h, rr, cx, cy, segs);
      default: return roundedRect(w, h, Math.min(w, h) / 2, cx, cy, segs);
    }
  }
  function faceXform(m, k, nOff, zc, xc) {
    const th = normalAngle(k);
    const n = [Math.cos(th), Math.sin(th)], u = [-n[1], n[0]];
    return T(m.transform([u[0], u[1], 0, 0, 0, 0, 1, 0, n[0], n[1], 0, 0, n[0] * (a + nOff) + u[0] * xc, n[1] * (a + nOff) + u[1] * xc, zc, 1]));
  }
  function cornerMasks(fromCentre) {
    const R = (a + 80) / Math.cos(half) + 80, masks = [];
    for (let k = 0; k < N; k++) {
      const t0 = normalAngle(k), t1 = normalAngle(k + 1);
      const n0 = [Math.cos(t0), Math.sin(t0)], n1 = [Math.cos(t1), Math.sin(t1)];
      const u0 = [-n0[1], n0[0]], u1 = [-n1[1], n1[0]];
      const p0 = [u0[0] * fromCentre, u0[1] * fromCentre], p1 = [-u1[0] * fromCentre, -u1[1] * fromCentre];
      masks.push([[0, 0], p0, [p0[0] + n0[0] * R, p0[1] + n0[1] * R], [p1[0] + n1[0] * R, p1[1] + n1[1] * R], p1]);
    }
    return cs(masks);
  }
  // grid of openings inside a rounded polygon of apothem A (support-function containment test)
  function patternHoles(pattern, A, rr, fw, slotLen, fg) {
    const inside = (x, y, rad) => {
      for (let k = 0; k < N; k++) {
        const th = normalAngle(k);
        if (x * Math.cos(th) + y * Math.sin(th) > A - rad) return false;
        const bh = th + half;
        if (x * Math.cos(bh) + y * Math.sin(bh) > (A - rr) / Math.cos(half) + rr - rad) return false;
      }
      return true;
    };
    const hex = pattern === 'hex', slots = pattern === 'slots', round = pattern === 'round';
    const pitchX = fw + fg, pitchY = (slots ? slotLen : hex ? fw * 0.866 : fw) + fg;
    const polys = [];
    const nx = Math.ceil(A / pitchX) + 1, ny = Math.ceil(A / pitchY) + 1;
    for (let iy = -ny; iy <= ny; iy++) for (let ix = -nx; ix <= nx; ix++) {
      const x = ix * pitchX + ((hex || round) && (iy & 1) ? pitchX / 2 : 0), y = iy * (round ? pitchY * 0.866 : pitchY);
      if (slots) { if (inside(x, y, Math.hypot(fw / 2, slotLen / 2) * 0.9)) polys.push(holeShape('slot', fw, slotLen, 0, x, y)); }
      else if (hex) { if (inside(x, y, fw / 2)) polys.push(holeShape('hex', fw * 1.1547, fw, 0, x, y)); }
      else if (round) { if (inside(x, y, fw / 2)) polys.push(holeShape('circle', fw, fw, 0, x, y)); }
      else if (inside(x, y, fw * 0.71)) polys.push(holeShape('rect', fw, fw, Math.min(2, fw / 4), x, y));
    }
    return polys;
  }

  // ---------- vertical band layout ----------
  // A rib band can be several thin lines (the real crate uses pairs); the rim can have extra lines under it.
  const baseH = Math.min(P.baseBand, H * 0.3);
  const rimH = Math.min(P.rimHeight, H * 0.3);
  const ribs = Math.round(P.ribCount);
  const ribH = P.ribHeight;
  const nl = Math.max(1, Math.round(P.ribLines || 1));
  const lgap = nl > 1 ? Math.min(P.ribLineGap, (ribH * 0.6) / (nl - 1)) : 0;
  const lineH = (ribH - (nl - 1) * lgap) / nl;
  const rimL = Math.max(0, Math.round(P.rimLines || 0));
  const rimLineH = Math.min(nl > 1 ? lineH : ribH * 0.6, 6);
  const rimGap = Math.max(2, P.ribLineGap);
  const rimTotal = Math.min(rimH + rimL * (rimLineH + rimGap), H * 0.4);
  const span = Math.max(0, H - rimTotal - baseH - ribs * ribH);
  const weights = []; for (let i = 0; i <= ribs; i++) weights.push(Math.pow(P.ribGrade, i));
  const wsum = weights.reduce((x, y) => x + y, 0);
  const zones = [], bands = [];
  bands.push({ z0: 0, z1: baseH, depth: P.ribDepth, kind: 'base', lines: [[0, baseH, P.ribDepth]] });
  let z = baseH;
  for (let i = 0; i <= ribs; i++) {
    const zh = (span * weights[i]) / wsum;
    zones.push({ z0: z, z1: z + zh }); z += zh;
    if (i < ribs) {
      const lines = [];
      for (let j = 0; j < nl; j++) { const l0 = z + j * (lineH + lgap); lines.push([l0, l0 + lineH, P.ribDepth]); }
      bands.push({ z0: z, z1: z + ribH, depth: P.ribDepth, kind: 'rib', lines });
      z += ribH;
    }
  }
  {
    const lines = [[H - rimH, H, P.rimDepth]];
    for (let j = 0; j < rimL; j++) { const top = H - rimH - rimGap - j * (rimLineH + rimGap); lines.push([top - rimLineH, top, P.ribDepth]); }
    bands.push({ z0: H - rimTotal, z1: H, depth: P.rimDepth, kind: 'rim', lines });
  }

  const tf = Math.min(P.floor, H * 0.5);
  const footH = P.foot ? P.footHeight : 0;
  const footClear = abs(P.footClear);
  const footOut = -t - footClear - rimInner;
  const footIn = footOut - P.footWall;
  const holeM = P.holeMargin;

  // =====================================================================
  // CRATE BODY (z = 0 at the bottom of the walls; foot added below, then everything shifted up by footH)
  // =====================================================================
  const solids = [];
  const logoOn = !!(P.logo && logo && logo.rects && logo.rects.length);
  const label = P.label || logoOn ? { w: Math.min(P.labelWidth, straight - 2 * holeM), h: Math.min(P.labelHeight, H * 0.6), zc: P.labelZ * H, plate: !!P.label } : null;
  const onFaces = (mode, k) => mode === 'all' || (mode === 'pair' && (N % 2 === 0 ? k % (N / 2) === 0 : k === 0)) || k === 0;
  const labelFace = (k) => !!label && (k === 0 || (logoOn && onFaces(P.logoFaces, k)));
  const handle = P.handles ? { w: Math.min(P.handleWidth, straight - 10), h: Math.min(P.handleHeight, H * 0.4), top: H - P.handleTop } : null;
  const handleFace = (k) => !!handle && (P.handleFaces === 'all' || (P.handleFaces === 'pair' && (N % 2 === 0 ? k % (N / 2) === 0 : k === 0)) || (P.handleFaces === 'front' && k === 0));

  const wallRing = ringCS(0, -t);
  solids.push(T(T(wallRing.intersect(cornerMasks(straight / 2 - 0.5))).extrude(H)));

  let holeCount = 0;
  const hw = P.holeWidth, hh = P.holeHeight, gx = P.holeGapX, gy = P.holeGapY;
  const pillarClear = P.pillars ? Math.min(P.pillarWidth, straight * 0.45) : 0;
  const handleCutters = [];
  const handleLips = [];
  // columns across each face, separated by vertical ribs (the real crate has a solid centre column)
  const usableW = straight - 2 * Math.max(holeM, pillarClear + holeM * 0.5);
  const colsN = Math.max(1, Math.round(P.columns || 1));
  const vrw = P.vRibWidth;
  const colBounds = [-usableW / 2];
  if (colsN > 1) {
    const cw = colsN % 2 === 1 && P.centerCol > 0 ? Math.min(P.centerCol, usableW * 0.7) : 0;
    const side = cw ? (usableW - cw) / (colsN - 1) : usableW / colsN;
    for (let i = 1; i < colsN; i++) {
      const mid = (colsN - 1) / 2;
      let x;
      if (cw) x = i <= mid ? -usableW / 2 + side * i : usableW / 2 - side * (colsN - i);
      else x = -usableW / 2 + side * i;
      colBounds.push(x);
    }
  }
  colBounds.push(usableW / 2);
  const vRibXs = colBounds.slice(1, -1);
  for (let k = 0; k < N; k++) {
    const polys = [];
    if (P.holes && usableW > hw) {
      zones.forEach((zn, zi) => {
        const alt = P.altBands && (zones.length - 1 - zi) % 2 === 0;
        const shape = alt ? P.altShape : P.holeShape;
        const w = alt ? P.altSize : hw;
        const zh = zn.z1 - zn.z0 - 2 * holeM * 0.6;
        if (zh < 4) return;
        let rows, rowH;
        if (alt) { rows = Math.floor((zh + gy) / (P.altSize + gy)); rowH = P.altSize; }
        else if (P.holeFill) { rows = Math.max(1, Math.round((zh + gy) / (hh + gy))); rowH = (zh - (rows - 1) * gy) / rows; }
        else { rows = Math.floor((zh + gy) / (hh + gy)); rowH = hh; }
        if (rows < 1 || rowH < 2) return;
        const totalH = rows * rowH + (rows - 1) * gy;
        const zc0 = (zn.z0 + zn.z1) / 2 - totalH / 2 + rowH / 2;
        for (let c = 0; c < colBounds.length - 1; c++) {
          const x0 = colBounds[c] + (c > 0 ? vrw / 2 + gx * 0.6 : 0), x1 = colBounds[c + 1] - (c < colBounds.length - 2 ? vrw / 2 + gx * 0.6 : 0);
          const inner = x1 - x0;
          const cols = Math.floor((inner + gx) / (w + gx));
          if (cols < 1) continue;
          const totalW = cols * w + (cols - 1) * gx, start = (x0 + x1) / 2 - totalW / 2 + w / 2;
          for (let ri = 0; ri < rows; ri++) {
            const cz = zc0 + ri * (rowH + gy);
            for (let ci = 0; ci < cols; ci++) {
              const cx = start + ci * (w + gx);
              if (handleFace(k) && Math.abs(cx) < handle.w / 2 + gx + w / 2 + (P.handleLip ? P.handleLipWidth : 0) && cz + rowH / 2 > handle.top - handle.h - gy - (P.handleLip ? P.handleLipWidth : 0) && cz - rowH / 2 < handle.top + gy) continue;
              if (labelFace(k) && Math.abs(cx) < label.w / 2 + gx * 0.5 + w / 2 && Math.abs(cz - label.zc) < label.h / 2 + gy * 0.5 + rowH / 2) continue;
              polys.push(holeShape(shape, w, rowH, P.holeRadius, cx, cz));
              holeCount++;
            }
          }
        }
      });
    }
    if (handleFace(k)) {
      const hs = holeShape(P.handleShape === 'rect' ? 'rect' : 'slot', handle.w, handle.h, P.handleRadius, 0, handle.top - handle.h / 2);
      polys.push(hs);
      handleCutters.push(faceXform(T(cs([hs]).extrude(80, 0, 0, 1, true)), k, 0, 0, 0));
      if (P.handleLip && P.handleLipWidth > 0.2) {
        const frame = T(CrossSection.difference(T(cs([hs]).offset(P.handleLipWidth, 'Round', 2, 24)), cs([hs])));
        handleLips.push(faceXform(T(frame.extrude(Math.max(P.rimDepth, P.ribDepth) + t * 0.5)), k, -t * 0.5, 0, 0));
      }
    }
    let panel = cs([roundedRect(straight, H, 0, 0, H / 2)]);
    if (polys.length) panel = T(CrossSection.difference(panel, cs(polys)));
    solids.push(faceXform(T(panel.extrude(t)), k, -t, 0, 0));
  }

  // floor (normal mode: at the bottom of the walls; print mode: at the bottom of the foot)
  let floorHoles = 0;
  const floorAt = printMode && P.foot && footH > 0.1 ? 'foot' : 'wall';
  {
    const outer = floorAt === 'foot' ? footOut : -t + 0.3;
    const innerLimit = floorAt === 'foot' ? footIn : -t;
    let fcs = cs([offsetPoly(outer)]);
    if (P.floorPattern !== 'none') {
      const polys = patternHoles(P.floorPattern, a + innerLimit - P.floorMargin, Math.max(r + innerLimit - P.floorMargin, 0), P.floorHole, P.floorSlotLen, P.floorGap);
      floorHoles = polys.length;
      if (polys.length) fcs = T(CrossSection.difference(fcs, cs(polys)));
    }
    if (floorAt === 'wall') solids.push(T(fcs.extrude(tf)));
    else solids.push(ext(fcs, -footH, -footH + tf));
  }

  // bands (+ 45° chamfers under them in print mode so they print without supports)
  const bandSolids = [];
  for (const b of bands) {
    b.lines.forEach(([z0, z1, depth], li) => {
      if (depth <= 0.05) return;
      bandSolids.push(ring(depth, -t * 0.5, z0, z1));
      if (printMode && z0 > 0.5) {
        // room below this line: the gap to the next line down, or the hole margin at the bottom of the band
        const below = b.kind === 'rim' ? (li === b.lines.length - 1 ? holeM * 0.6 - 0.3 : rimGap - 0.2) : li === 0 ? holeM * 0.6 - 0.3 : lgap - 0.2;
        const ch = Math.max(0.6, Math.min(depth + t * 0.5, below, z0 - 0.5));
        const fr = hull([slab(depth, z0, z0 + 0.01), slab(-t * 0.5, z0 - ch, z0 - ch + 0.01)]);
        bandSolids.push(diff(fr, slab(-t * 0.6, z0 - ch - 1, z0 + 1)));
      }
    });
  }
  // vertical ribs between the columns
  if (vRibXs.length && P.ribDepth > 0.05) {
    for (let k = 0; k < N; k++) for (const x of vRibXs) {
      bandSolids.push(faceXform(T(cs([roundedRect(vrw, H - 0.2, 0, x, H / 2)]).extrude(P.ribDepth + t * 0.5)), k, -t * 0.5, 0, 0));
    }
  }
  bandSolids.push(...handleLips);
  if (rimInner) {
    const z0 = H - rimH;
    if (printMode) {
      const ch = Math.min(rimInner + 0.5, holeM * 0.6 - 0.3);
      const lip = slab(-t * 0.5, z0 - ch, H);
      const voidS = hull([slab(-t - rimInner, z0, H + 1), slab(-t + 0.01, z0 - ch - 0.01, z0 - ch)]);
      bandSolids.push(diff(lip, voidS));
    } else bandSolids.push(ring(-t * 0.5, -t - rimInner, z0, H));
  }
  if (P.pillars && P.pillarDepth > 0.05) {
    const pr = ringCS(P.pillarDepth, -t * 0.5);
    bandSolids.push(T(T(pr.intersect(cornerMasks(straight / 2 - Math.min(P.pillarWidth, straight * 0.45)))).extrude(H)));
  }
  if (label && label.plate && P.labelRaise > 0.05) for (let k = 0; k < N; k++) if (labelFace(k)) bandSolids.push(faceXform(T(cs([roundedRect(label.w, label.h, 6)]).extrude(P.labelRaise + t * 0.5)), k, -t * 0.5, label.zc, 0));
  // logo: emboss adds to the plate, engrave and cut-through are subtracted from the body below
  const logoCuts = [];
  let logoCSCache = null;
  const logoShape = (maxW, maxH) => {
    if (!logoCSCache) {
      const polys = [];
      const R = logo.rects;
      for (let i = 0; i < R.length; i += 4) polys.push([[R[i], R[i + 1]], [R[i + 2], R[i + 1]], [R[i + 2], R[i + 3]], [R[i], R[i + 3]]]);
      logoCSCache = T(T(new CrossSection(polys, "Positive")).simplify(0.4 * logo.px));
    }
    const k = Math.min(maxW / 1, maxH / logo.aspect);
    return T(T(logoCSCache.translate([-0.5, -logo.aspect / 2])).scale(k));
  };
  if (logoOn) {
    const sh = logoShape(label.w * 0.82, label.h * 0.72);
    const surf = label.plate ? P.labelRaise : 0;
    const depth = abs(P.logoDepth);
    for (let k = 0; k < N; k++) {
      if (!(k === 0 || onFaces(P.logoFaces, k))) continue;
      if (P.logoStyle === 'emboss') bandSolids.push(faceXform(T(sh.extrude(depth + 0.1)), k, surf - 0.1, label.zc, 0));
      else if (P.logoStyle === 'engrave') logoCuts.push(faceXform(T(sh.extrude(depth + 1)), k, surf - Math.min(depth, (t + surf) * 0.7), label.zc, 0));
      else logoCuts.push(faceXform(T(sh.extrude(t + surf + 4)), k, -t - 2, label.zc, 0));
    }
  }
  {
    let bs = union(bandSolids);
    if (bs && handleCutters.length) bs = diff(bs, union(handleCutters));
    if (bs) solids.push(bs);
  }

  let body = union(solids);
  if (logoCuts.length) body = diff(body, union(logoCuts));
  if (s !== 1) body = T(body.warp((v) => { const k = 1 + (s - 1) * (Math.max(0, v[2]) / H); v[0] *= k; v[1] *= k; }));

  // stacking foot
  if (P.foot && footH > 0.1) {
    let foot;
    if (floorAt === 'foot') {
      // print-friendly: ring + 45° shoulder up to the base band, floor already at the bottom
      const ch = Math.min(footH, P.ribDepth - footOut);
      const shoulder = diff(hull([slab(footOut, -ch, -ch + 0.01), slab(Math.max(P.ribDepth, 0), 0, 0.01)]), slab(footIn, -ch - 1, 1));
      foot = union([ring(footOut, footIn, -footH, 0.3), shoulder]);
    } else {
      foot = ring(footOut, footIn, -footH, tf * 0.5);
      if (P.floorPattern !== 'none') {
        const notches = [];
        for (let k = 0; k < N; k++) {
          const b = T(T(Manifold.cube([straight * 0.3, 40, footH * 0.55], true)).translate([0, 0, -footH + footH * 0.25 - 0.01]));
          const th = normalAngle(k);
          notches.push(T(T(b.rotate([0, 0, (th * 180) / Math.PI + 90])).translate([Math.cos(th) * (a + footOut), Math.sin(th) * (a + footOut), 0])));
        }
        foot = diff(foot, union(notches));
      }
    }
    body = union([body, foot]);
    body = T(body.translate([0, 0, footH]));
  }
  const crateTop = H + footH; // model units

  // =====================================================================
  // SPLITTING FOR PRINT
  // =====================================================================
  const parts = []; // { id, label, kind, solid, flip, joint }
  const notes = [];
  if (printMode && (P.splitBase || P.sections > 1)) {
    // candidate joints sit at the bottom of a band (no openings there); the lower part grows a tongue,
    // the upper part gets a matching groove, so every part prints upright on a flat face.
    const cands = [];
    if (P.splitBase) cands.push({ band: bands[0], base: true });
    const ribBands = bands.filter((b) => b.kind === 'rib');
    let want = Math.max(1, Math.round(P.sections)) - 1;
    if (want > ribBands.length) { notes.push(`Only ${ribBands.length + 1} wall section${ribBands.length ? 's' : ''} possible with ${ribBands.length} rib${ribBands.length === 1 ? '' : 's'}. Add ribs to split more.`); want = ribBands.length; }
    // pick ribs closest to equal division of the wall height
    const used = new Set();
    for (let i = 1; i <= want; i++) {
      const target = baseH + ((H - baseH) * i) / (want + 1);
      let best = null;
      for (const b of ribBands) if (!used.has(b) && (!best || Math.abs(b.z0 - target) < Math.abs(best.z0 - target))) best = b;
      if (best) { used.add(best); cands.push({ band: best }); }
    }
    cands.sort((x, y) => x.band.z0 - y.band.z0);

    const jointType = P.joint;
    const gap = abs(jointType === 'snap' ? P.snapGap : jointType === 'glue' ? P.glueGap : P.pressGap);
    const joints = cands.map((c) => {
      const bandH = c.band.z1 - c.band.z0;
      let zs = c.band.z0 + 0.3;
      if (c.base) zs = floorAt === 'foot' ? 0.3 : Math.max(tf + 0.5, 0.3);
      const hj = Math.max(abs(1.2), Math.min(abs(P.jointDepth), c.band.z1 - zs - 0.4));
      if (abs(P.jointDepth) > hj + 0.05) notes.push(`Joint depth limited to ${(hj * S).toFixed(1)} mm by the ${c.base ? 'base band' : 'rib'} height.`);
      return { zs: zs + footH, zLocal: zs, hj, base: !!c.base };
    });

    // cut body bottom-up
    let rest = body;
    const pieces = [];
    for (const j of joints) {
      const [up, low] = rest.splitByPlane([0, 0, 1], j.zs);
      T(up); T(low);
      pieces.push(low);
      rest = up;
    }
    pieces.push(rest);

    // joint features
    const dG = -t * 0.45;               // groove starts here (outer shell keeps 45% of the wall)
    for (let i = 0; i < joints.length; i++) {
      const j = joints[i];
      const k = scaleAt(j.zLocal);
      const scaled = (m) => (k !== 1 ? T(m.scale([k, k, 1])) : m);
      const zTop = j.zs + j.hj;
      // tongue on the lower part
      let tongue = scaled(ring(dG - gap, -t, j.zs - 0.6, zTop - gap));
      // groove in the upper part (clears tongue + gap)
      let groove = scaled(ring(dG, -t - rimInner - 3, j.zs - 1, zTop));
      if (jointType === 'glue') {
        const g = [];
        for (const f of [0.35, 0.7]) g.push(scaled(ring(dG - gap + 0.1, dG - gap - Math.min(0.5, t * 0.15), j.zs + j.hj * f - 0.4, j.zs + j.hj * f + 0.4)));
        tongue = diff(tongue, union(g));
      }
      let recesses = null;
      if (jointType === 'snap') {
        const bump = abs(P.snapBump);
        const rb = Math.max(bump * 1.6, abs(0.8));
        const len = Math.min(abs(10), straight * 0.25);
        const zc = j.zs + j.hj * 0.5;
        const nPer = Math.max(1, Math.round(P.snapsPerFace));
        const usable = straight - 2 * (pillarClear + 6);
        const bumps = [], recs = [], slits = [];
        for (let f = 0; f < N; f++) {
          for (let q = 0; q < nPer; q++) {
            const xc = nPer === 1 ? 0 : -usable / 2 + (usable * (q + 0.5)) / nPer;
            const cyl = (rad, l) => T(T(Manifold.cylinder(l, rad, rad, 16, true)).rotate([0, 90, 0]));
            // local frame: x = along face, y = up, z = outward; cylinder axis along x
            const off = dG - gap + bump - rb; // centre so it protrudes `bump` past the tongue face
            bumps.push(faceXform(T(cyl(rb, len)), f, off, zc, xc));
            recs.push(faceXform(T(cyl(rb + gap, len + 2 * gap)), f, off, zc, xc));
            for (const sx of [-1, 1]) {
              const sl = T(Manifold.cube([abs(1.0), j.hj, t * 2], true));
              slits.push(faceXform(T(sl.translate([0, j.hj / 2 + 0.2, 0])), f, -t * 0.7, j.zs + j.hj * 0.25, xc + sx * (len / 2 + abs(1.2))));
            }
          }
        }
        // bumps must stay inside the scaled wall position
        tongue = diff(union([tongue, scaled(union(bumps))]), scaled(union(slits)));
        recesses = scaled(union(recs));
      }
      pieces[i] = union([pieces[i], tongue]);
      pieces[i + 1] = diff(pieces[i + 1], union([groove, recesses]));
    }
    const hasBase = !!(joints[0] && joints[0].base);
    const wallCount = pieces.length - (hasBase ? 1 : 0);
    pieces.forEach((pc, i) => {
      const isBase = hasBase && i === 0;
      const n = i + (hasBase ? 0 : 1);
      parts.push({ id: isBase ? 'base' : 'wall' + n, label: isBase ? 'Base' : wallCount > 1 ? `Wall ${n}` : 'Walls', kind: isBase ? 'base' : 'section', solid: pc, flip: false, order: i });
    });
    parts.forEach((p, i) => { if (i < joints.length) p.jointAbove = jointType; });
  } else {
    parts.push({ id: 'crate', label: 'Crate', kind: 'crate', solid: body, flip: false, order: 0 });
  }

  // =====================================================================
  // COVER
  // =====================================================================
  let coverInfo = null;
  let coverOutline = null;
  if (P.cover) {
    const kTop = s;                          // the cover follows the draft at the rim
    const tp = P.lidThick;
    const plateOut = Math.max(-t * 0.5, P.rimDepth + P.lidOverhang);
    const lidClear = abs(P.lidClear);
    const skirtOut = -t - lidClear - rimInner, skirtIn = skirtOut - Math.max(1.6, P.footWall);
    const lipIn = -t - rimInner;               // same opening as the crate top, so a crate's foot drops in
    const lipH = P.lidLipHeight;
    const topParts = [], underParts = [];
    topParts.push(slab(plateOut, 0, tp));
    if (P.lidLip) topParts.push(ring(plateOut, lipIn, tp - 0.3, tp + lipH));
    if (P.lidSkirt) underParts.push(ring(skirtOut, skirtIn, -P.lidSkirtHeight, 0.3));
    // underside stiffeners
    const innerLim = P.lidSkirt ? skirtIn : lipIn;
    if (P.lidRibs !== 'none') {
      const rd = P.lidRibDepth, w = 2.4, bars = [];
      if (P.lidRibs === 'grid') {
        const g = Math.max(15, P.lidRibGap), n = Math.ceil(a / g) + 1;
        for (let i = -n; i <= n; i++) {
          bars.push(T(T(Manifold.cube([w, a * 3, rd + 0.3], true)).translate([i * g, 0, -rd / 2 + 0.15])));
          bars.push(T(T(Manifold.cube([a * 3, w, rd + 0.3], true)).translate([0, i * g, -rd / 2 + 0.15])));
        }
      } else {
        for (let i = 0; i < N * 2; i++) bars.push(T(T(T(Manifold.cube([a * 1.6, w, rd + 0.3], true)).translate([a * 0.8, 0, -rd / 2 + 0.15])).rotate([0, 0, (i * 180) / N - 90])));
        bars.push(ring(-a * 0.5 + w / 2, -a * 0.5 - w / 2, -rd, 0.3));
      }
      underParts.push(T(union(bars).intersect(slab(innerLim - 0.2, -rd, 0.3))));
    }
    let top = union(topParts);
    let under = union(underParts);
    // vents
    let ventCount = 0;
    const cutters = [];
    if (P.lidPattern !== 'none') {
      const lim = Math.min(innerLim, lipIn) - P.lidMargin;
      const polys = patternHoles(P.lidPattern, a + lim, Math.max(r + lim, 0), P.lidHole, P.lidSlotLen, P.lidGap);
      ventCount = polys.length;
      if (polys.length) cutters.push(ext(cs(polys), -P.lidRibDepth - 2, tp + 1));
    }
    // cushion fixing
    const marks = [];
    if (P.seat === 'straps') {
      const sl = [];
      const inset = Math.min(innerLim, lipIn) - P.strapInset;
      for (let k = 0; k < N; k++) {
        const th = normalAngle(k), n = [Math.cos(th), Math.sin(th)];
        const rr = roundedRect(Math.min(P.strapLen, straight * 0.6), 5, 2.5, 0, 0, 4);
        const ang = (th * 180) / Math.PI + 90;
        const c2 = T(T(cs([rr]).rotate(ang)).translate([n[0] * (a + inset), n[1] * (a + inset)]));
        marks.push(...c2.toPolygons());
        sl.push(T(T(c2.extrude(tp + 4)).translate([0, 0, -1])));
      }
      cutters.push(union(sl));
    } else if (P.seat === 'ties') {
      const holes = [];
      const inset = Math.min(innerLim, lipIn) - P.strapInset;
      for (let k = 0; k < N; k++) {
        const bh = normalAngle(k) + half, cd = (a + inset - Math.max(r + inset, 0)) / Math.cos(half);
        for (const off of [-6, 6]) {
          const px = Math.cos(bh) * cd - Math.sin(bh) * off, py = Math.sin(bh) * cd + Math.cos(bh) * off;
          holes.push(T(T(Manifold.cylinder(tp + 4, 2.6, 2.6, 16)).translate([px, py, -1])));
          marks.push(Array.from({ length: 12 }, (_, i) => [px + 2.6 * Math.cos((i / 12) * TAU), py + 2.6 * Math.sin((i / 12) * TAU)]));
        }
      }
      cutters.push(union(holes));
    } else if (P.seat === 'frame' && !P.lidLip) {
      top = union([top, ring(plateOut, plateOut - 6, tp - 0.3, tp + P.frameHeight)]);
    }
    // grips
    if (P.lidGrip === 'notches') {
      const ns = [];
      for (let k = 0; k < N; k++) {
        const th = normalAngle(k);
        ns.push(T(T(Manifold.cylinder(tp + lipH + 4, P.gripSize / 2, P.gripSize / 2, 32)).translate([Math.cos(th) * (a + plateOut), Math.sin(th) * (a + plateOut), -1])));
      }
      cutters.push(union(ns));
    } else if (P.lidGrip === 'slot') {
      cutters.push(ext(cs([holeShape('slot', P.gripSize * 3, P.gripSize * 0.75, 0, 0, 0)]), -P.lidRibDepth - 2, tp + 1));
    }
    if (logoOn && P.logoCover) {
      const lim = Math.min(innerLim, lipIn) - 10;
      const sh = logoShape((a + lim) * 1.1, (a + lim) * 0.5);
      const d = abs(P.logoDepth);
      if (P.logoStyle === 'emboss') top = union([top, ext(sh, tp - 0.1, tp + d)]);
      else cutters.push(ext(sh, P.logoStyle === 'engrave' ? tp - Math.min(d, tp * 0.6) : -P.lidRibDepth - 2, tp + 1));
    }
    const cut = union(cutters);
    top = diff(top, cut);
    if (under) under = diff(under, cut);
    const place = (m) => T(T(m.scale([kTop, kTop, 1])).translate([0, 0, crateTop]));
    const lidSolid = under ? union([top, under]) : top;
    if (printMode && P.lidLip && under) {
      // features on both faces: split through the middle of the plate so both halves print flat,
      // located by pegs in the corners (under the lip, clear of vents, straps and grips)
      const hz = tp / 2;
      const [upper, lower] = lidSolid.splitByPlane([0, 0, 1], hz);
      T(upper); T(lower);
      const pr = abs(2), ph = Math.min(abs(1.6), hz * 0.8), pg = abs(0.15);
      const pegOff = (plateOut + lipIn) / 2, cd = (a - r) / Math.cos(half);
      const pegs = [], sockets = [];
      for (let k = 0; k < N; k++) {
        const bh = normalAngle(k) + half, d = cd + Math.max(r + pegOff, 0);
        const x = Math.cos(bh) * d, y = Math.sin(bh) * d;
        pegs.push(T(T(Manifold.cylinder(ph + 0.3, pr, pr * 0.85, 20)).translate([x, y, hz - 0.3])));
        sockets.push(T(T(Manifold.cylinder(ph + pg + 1, pr + pg, pr + pg, 20)).translate([x, y, hz - 1])));
      }
      parts.push({ id: 'coverUnder', label: 'Cover, lower half', kind: 'cover', solid: place(union([lower, ...pegs])), flip: true, order: 99 });
      parts.push({ id: 'cover', label: 'Cover, upper half', kind: 'cover', solid: place(diff(upper, union(sockets))), flip: false, order: 100 });
    } else {
      // print the lid top-down when nothing sticks up from it
      parts.push({ id: 'cover', label: 'Cover', kind: 'cover', solid: place(lidSolid), flip: !P.lidLip && P.seat !== 'frame', order: 100 });
    }
    coverInfo = { vents: ventCount, lift: (P.lidLip ? tp + lipH - (P.foot ? footH : 0) : tp) * S, top: (crateTop + tp) * S };

    // cushion frame (printable tray the foam sits in) and the cushion preview
    const seatLim = (P.lidLip ? lipIn : P.seat === 'frame' ? plateOut - 6 : plateOut) - 1;
    let cushionLim = seatLim, cushionZ = tp;
    if (P.cushionFrame) {
      const fw = 2.4, fb = 2;
      let tray = union([slab(seatLim, 0, fb), ring(seatLim, seatLim - fw, fb - 0.3, fb + P.cushionFrameH)]);
      // lighten the tray floor with large openings, keep a 10 mm border
      const holes = patternHoles('grid', a + seatLim - fw - 10, Math.max(r + seatLim - fw - 10, 0), 34, 0, 8);
      if (holes.length) tray = diff(tray, ext(cs(holes), -1, fb + 1));
      parts.push({ id: 'cushionFrame', label: 'Cushion frame', kind: 'cover', solid: T(T(tray.scale([kTop, kTop, 1])).translate([0, 0, crateTop + tp])), flip: false, order: 102 });
      cushionLim = seatLim - fw - 0.5;
      cushionZ = tp + fb;
    }
    // the foam template is the cushion outline at full size, with strap or tie marks
    const outline = rpoly(a + cushionLim, Math.max(r + cushionLim, 0), 16).map(([x, y]) => [x * kTop * S, y * kTop * S]);
    coverOutline = { outline, marks: marks.map((poly) => poly.map(([x, y]) => [x * kTop * S, y * kTop * S])), thick: P.cushionThick * S };
    if (P.cushion) {
      const ct = P.cushionThick, R = Math.min(ct * 0.45, 20), layers = [];
      for (let i = 0; i <= 6; i++) {
        const ang = (i / 6) * Math.PI;
        const zc = ct / 2 - Math.cos(ang) * (ct / 2);
        const inset = R * (1 - Math.sin(ang)) * 0.9;
        layers.push(slab(cushionLim - inset, zc - 0.01, zc + 0.01));
      }
      const cushion = T(T(hull(layers).scale([kTop, kTop, 1])).translate([0, 0, crateTop + cushionZ]));
      parts.push({ id: 'cushion', label: 'Cushion', kind: 'cushion', solid: cushion, flip: false, order: 103, preview: true });
    }
  }

  // =====================================================================
  // VERTICAL SPLITS (for parts wider than the print bed), aligned with filament pins
  // =====================================================================
  if (printMode && P.vSplit && P.vSplit !== 'none') {
    // run the cut along a vertical rib when the faces have columns, so it crosses solid plastic
    let c0 = 0;
    if (N === 4 && vRibXs.length) c0 = vRibXs.reduce((m, x) => (Math.abs(x) < Math.abs(m) ? x : m), vRibXs[0]);
    const planes = [{ ax: 'x', c: c0 }];
    if (P.vSplit === 'quarters') planes.push({ ax: 'y', c: N === 4 ? c0 : 0 });
    const pr = abs(P.pinDia / 2 + P.pinClear), plen = abs(P.pinDepth) * 2;
    let pinCount = 0;
    const pinsFor = (m, pl) => {
      // slice the part on the cut plane, shrink the section so a pin has wall around it, sample points
      const rot = pl.ax === 'x' ? T(m.rotate([0, 90, 0])) : T(m.rotate([90, 0, 0]));
      const sec = T(rot.slice(pl.ax === 'x' ? -pl.c : pl.c));
      const safe = T(sec.offset(-(pr + abs(0.8)), 'Round', 2, 12));
      const pins = [];
      for (const comp of safe.decompose().map(T)) {
        if (comp.area() < pr * pr * 4) continue;           // too thin for a pin (or empty)
        const bb = comp.bounds();
        const dx = bb.max[0] - bb.min[0], dy = bb.max[1] - bb.min[1];
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) continue;
        const n = Math.min(24, Math.max(1, Math.floor(Math.max(dx, dy) / abs(70))));
        for (let i = 0; i < n; i++) {
          const f = (i + 0.5) / n;
          const u = dx >= dy ? bb.min[0] + dx * f : (bb.min[0] + bb.max[0]) / 2;
          const v = dx >= dy ? (bb.min[1] + bb.max[1]) / 2 : bb.min[1] + dy * f;
          const probe = T(T(CrossSection.square([0.2, 0.2], true)).translate([u, v]));
          if (T(comp.intersect(probe)).area() < 0.01) continue;
          const cyl = T(Manifold.cylinder(plen, pr, pr, 16, true));
          pins.push(pl.ax === 'x' ? T(T(cyl.rotate([0, 90, 0])).translate([pl.c, v, u])) : T(T(cyl.rotate([90, 0, 0])).translate([u, pl.c, -v])));
        }
      }
      pinCount += pins.length;
      return pins.length ? union(pins) : null;
    };
    const names = { x: ['left', 'right'], y: ['front', 'back'] };
    for (const pl of planes) {
      const next = [];
      for (const p of parts) {
        if (p.preview) { next.push(p); continue; }
        // the upper cover half is cut off-centre so its seam is bridged by the lower half when they are glued
        const c = p.id.startsWith('cover') && p.id !== 'coverUnder' && parts.some((q) => q.id.startsWith('coverUnder')) ? pl.c + a * 0.3 : pl.c;
        const [hi, lo] = p.solid.splitByPlane(pl.ax === 'x' ? [1, 0, 0] : [0, 1, 0], c);
        T(hi); T(lo);
        const vh = hi.volume(), vl = lo.volume();
        if (vh < 1 || vl < 1) { next.push(p); continue; }
        const pins = pinsFor(p.solid, { ...pl, c });
        const tag = (side) => (p.sideTag ? (pl.ax === 'y' ? `${side} ${p.sideTag}` : `${p.sideTag} ${side}`) : side);
        next.push({ ...p, id: p.id + '-' + names[pl.ax][0], sideTag: tag(names[pl.ax][0]), solid: diff(lo, pins) });
        next.push({ ...p, id: p.id + '-' + names[pl.ax][1], sideTag: tag(names[pl.ax][1]), solid: diff(hi, pins), order: p.order + 0.01 });
      }
      parts.length = 0; parts.push(...next);
    }
    for (const p of parts) if (p.sideTag) p.label = `${p.label}, ${p.sideTag}`;
    notes.push(`Vertical cuts are joined with ${pinCount} pins cut from ${P.pinDia} mm filament, ${P.pinDepth * 2} mm long, plus glue.`);
    if (parts.some((q) => q.id.startsWith('coverUnder'))) notes.push('The two cover halves are cut off-centre: glue them face to face so each half bridges the other half\'s seam.');
  }

  // ---------- output ----------
  const out = { parts: [], notes };
  let volume = 0, crateVolume = 0, coverVolume = 0, tris = 0;
  let bbAll = null;
  for (const p of parts) {
    let m = S !== 1 ? T(p.solid.scale(S)) : p.solid;
    // drop zero-volume slivers that a plane split can leave behind
    const comps = m.decompose().map(T);
    if (comps.length > 1) { const keep = comps.filter((c) => Math.abs(c.volume()) > 0.5); m = keep.length === 1 ? keep[0] : T(Manifold.compose(keep)); }
    const mesh = m.getMesh();
    const bb = m.boundingBox();
    const v = m.volume();
    if (!p.preview) { volume += v; tris += m.numTri(); if (p.kind === 'cover') coverVolume += v; else crateVolume += v; }
    if (p.kind !== 'cover' && p.kind !== 'cushion') {
      bbAll = bbAll ? { min: bbAll.min.map((x, i) => Math.min(x, bb.min[i])), max: bbAll.max.map((x, i) => Math.max(x, bb.max[i])) } : { min: Array.from(bb.min), max: Array.from(bb.max) };
    }
    out.parts.push({
      id: p.id, label: p.label, kind: p.kind, flip: p.flip, order: p.order, preview: !!p.preview, joint: p.jointAbove || null,
      positions: new Float32Array(mesh.vertProperties), numProp: mesh.numProp, index: new Uint32Array(mesh.triVerts),
      volume: v, bbox: { min: Array.from(bb.min), max: Array.from(bb.max) },
    });
  }
  out.stats = {
    volume, crateVolume, coverVolume, tris, holes: holeCount, floorHoles,
    bbox: bbAll,
    capacity: innerCapacity(),
    stackPitch: H * S,
    footH: footH * S,
    crateTop: crateTop * S,
    cover: coverInfo,
    cushionTemplate: coverOutline,
    thickness: { wall: t * S, floor: tf * S, rib: P.ribDepth * S, rim: (P.rimDepth + t * 0.5) * S, lid: P.cover ? P.lidThick * S : null },
  };
  for (const o of trash) { try { o.delete(); } catch (e) {} }
  return out;

  function innerCapacity() {
    const pts = rpoly(a - t, r - t, 16);
    let ar = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; ar += p[0] * q[1] - q[0] * p[1]; }
    ar = Math.abs(ar) / 2;
    const k = (1 + s) / 2;
    return (ar * k * k * (H - tf) * Math.pow(S, 3)) / 1e6;
  }
}
