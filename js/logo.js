// Argaz, parametric crate configurator. © 2026 Roy Borkin. All rights reserved.
// Turns a typed name or an uploaded image into geometry the worker can extrude.
// The browser renders the text or image to a canvas (so any installed font works, Hebrew included),
// then solid pixels are merged into rectangles: x0, y0, x1, y1 normalised so the logo is 1 unit wide.

const FONTS = {
  sans: '800 {px}px Archivo, "Noto Sans Hebrew", "Arial Hebrew", Arial, sans-serif',
  serif: '700 {px}px Georgia, "Noto Serif Hebrew", "Times New Roman", serif',
};

export function logoKey(st) {
  if (!st.logo) return 'none';
  return st.logoSource === 'image' ? 'img:' + (st.logoImage ? st.logoImage.length + ':' + st.logoImage.slice(-48) : '') : 'txt:' + st.logoFont + ':' + st.logoText;
}

export async function rasterLogo(st) {
  if (!st.logo) return null;
  let canvas;
  if (st.logoSource === 'image') {
    if (!st.logoImage) return null;
    canvas = await imageCanvas(st.logoImage);
  } else {
    const text = (st.logoText || '').trim();
    if (!text) return null;
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
    canvas = textCanvas(text, st.logoFont);
  }
  return canvas ? toRects(canvas.mask, canvas.w, canvas.h) : null;
}

function textCanvas(text, fontKey) {
  const px = 120;
  const font = (FONTS[fontKey] || FONTS.sans).replace('{px}', px);
  const c = document.createElement('canvas');
  const g = c.getContext('2d', { willReadFrequently: true });
  g.font = font;
  const rtl = /[֐-׿؀-ۿ]/.test(text);
  const m = g.measureText(text);
  const w = Math.ceil(m.width + px * 0.4), h = Math.ceil(px * 1.5);
  c.width = Math.min(w, 2400); c.height = h;
  g.font = font;
  g.direction = rtl ? 'rtl' : 'ltr';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#000';
  g.fillText(text, c.width / 2, h / 2);
  const d = g.getImageData(0, 0, c.width, h).data;
  const mask = new Uint8Array(c.width * h);
  for (let i = 0; i < mask.length; i++) mask[i] = d[i * 4 + 3] > 110 ? 1 : 0;
  return crop(mask, c.width, h);
}

function imageCanvas(src) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const max = 320;
      const k = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max));
      const w = Math.max(8, Math.round((img.naturalWidth || max) * k)), h = Math.max(8, Math.round((img.naturalHeight || max) * k));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data;
      // transparent images: opaque pixels are the logo; opaque images: dark pixels are the logo
      let transparent = false;
      for (let i = 3; i < d.length; i += 4) if (d[i] < 200) { transparent = true; break; }
      const mask = new Uint8Array(w * h);
      for (let i = 0; i < mask.length; i++) {
        const a = d[i * 4 + 3], lum = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
        mask[i] = transparent ? (a > 127 ? 1 : 0) : a > 127 && lum < 128 ? 1 : 0;
      }
      res(crop(mask, w, h));
    };
    img.onerror = () => res(null);
    img.src = src;
  });
}

function crop(mask, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, out = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) out[y * cw + x] = mask[(y + y0) * w + x + x0];
  return { mask: out, w: cw, h: ch };
}

// Merge horizontal runs that repeat on consecutive rows into taller rectangles.
function toRects(mask, w, h) {
  const px = 1 / w;
  const rects = [];
  let open = new Map(); // "x0,x1" → [x0, yTop]
  for (let y = 0; y <= h; y++) {
    const runs = new Map();
    if (y < h) {
      let x = 0;
      while (x < w) {
        if (!mask[y * w + x]) { x++; continue; }
        const s = x; while (x < w && mask[y * w + x]) x++;
        runs.set(s + ',' + x, [s, x]);
      }
    }
    const next = new Map();
    for (const [k, [s, e]] of runs) next.set(k, open.has(k) ? open.get(k) : [s, e, y]);
    for (const [k, v] of open) if (!runs.has(k)) rects.push(v[0], v[1], v[2], y);
    open = next;
  }
  // to normalised, y up
  const out = new Float32Array(rects.length);
  for (let i = 0; i < rects.length; i += 4) {
    out[i] = rects[i] * px; out[i + 2] = rects[i + 1] * px;
    out[i + 1] = (h - rects[i + 3]) * px; out[i + 3] = (h - rects[i + 2]) * px;
  }
  return { rects: out, px, aspect: h / w };
}

// Downscale an uploaded file to a small PNG data URL so it fits in local storage.
export function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = () => rej(fr.error);
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 512, k = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max));
        const c = document.createElement('canvas');
        c.width = Math.max(8, Math.round((img.naturalWidth || max) * k)); c.height = Math.max(8, Math.round((img.naturalHeight || max) * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/png'));
      };
      img.onerror = () => rej(new Error('That file is not an image this browser can read'));
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
