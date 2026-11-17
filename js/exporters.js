// File exports. Mesh coordinates are millimetres, Z up (print-ready).

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

export function toSTL({ pos, numProp, index }) {
  const nt = index.length / 3;
  const buf = new ArrayBuffer(84 + nt * 50);
  const dv = new DataView(buf);
  const head = 'Crate configurator - binary STL, mm';
  for (let i = 0; i < head.length; i++) dv.setUint8(i, head.charCodeAt(i));
  dv.setUint32(80, nt, true);
  let o = 84;
  for (let t = 0; t < nt; t++) {
    const a = index[t * 3] * numProp, b = index[t * 3 + 1] * numProp, c = index[t * 3 + 2] * numProp;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true);
    o += 12;
    for (const v of [a, b, c]) { dv.setFloat32(o, pos[v], true); dv.setFloat32(o + 4, pos[v + 1], true); dv.setFloat32(o + 8, pos[v + 2], true); o += 12; }
    o += 2;
  }
  return new Blob([buf], { type: 'model/stl' });
}

export function toOBJ({ pos, numProp, index }) {
  const nv = pos.length / numProp;
  const lines = ['# Crate configurator - units: mm', 'o crate'];
  for (let i = 0; i < nv; i++) lines.push(`v ${pos[i * numProp].toFixed(4)} ${pos[i * numProp + 1].toFixed(4)} ${pos[i * numProp + 2].toFixed(4)}`);
  for (let t = 0; t < index.length; t += 3) lines.push(`f ${index[t] + 1} ${index[t + 1] + 1} ${index[t + 2] + 1}`);
  return new Blob([lines.join('\n')], { type: 'text/plain' });
}

export function to3MF({ pos, numProp, index }, colorHex = '#295B2E') {
  const nv = pos.length / numProp;
  const v = [], tr = [];
  for (let i = 0; i < nv; i++) v.push(`<vertex x="${pos[i * numProp].toFixed(4)}" y="${pos[i * numProp + 1].toFixed(4)}" z="${pos[i * numProp + 2].toFixed(4)}"/>`);
  for (let t = 0; t < index.length; t += 3) tr.push(`<triangle v1="${index[t]}" v2="${index[t + 1]}" v3="${index[t + 2]}" pid="1" p1="0"/>`);
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<resources><basematerials id="1"><base name="PP" displaycolor="${colorHex}FF"/></basematerials>
<object id="2" type="model" pid="1" pindex="0"><mesh><vertices>${v.join('')}</vertices><triangles>${tr.join('')}</triangles></mesh></object></resources>
<build><item objectid="2"/></build></model>`;
  const types = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;
  return zipStore([['[Content_Types].xml', types], ['_rels/.rels', rels], ['3D/3dmodel.model', model]], 'model/3mf');
}

// Minimal uncompressed ZIP writer (enough for 3MF).
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zipStore(files, type) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  for (const [name, text] of files) {
    const nb = enc.encode(name), data = enc.encode(text), crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nb.length, true);
    parts.push(lh.buffer, nb, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nb.length, true); ch.setUint32(42, offset, true);
    central.push(ch.buffer, nb);
    offset += 30 + nb.length + data.length;
  }
  const csize = central.reduce((s, b) => s + (b.byteLength ?? b.length), 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, csize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type });
}
