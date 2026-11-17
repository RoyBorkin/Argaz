// Parameter schema. Every control in the UI is generated from this list.
// `tab` decides which panel it lives in; `show` hides controls that don't apply.

export const TABS = [
  { id: 'body', label: 'Body', help: 'Overall form. Width is measured across the flats, not corner to corner.' },
  { id: 'ribs', label: 'Ribs', help: 'Horizontal bands that stiffen the walls. Openings fill the space between them.' },
  { id: 'rim', label: 'Rim', help: 'The top rim carries the load when crates stack. Pillars reinforce the corners.' },
  { id: 'holes', label: 'Holes', help: 'Openings on each face. They stay clear of ribs, pillars, hand holds and the label plate.' },
  { id: 'grips', label: 'Grips', help: 'Hand holds cut through the rim. The label plate is a solid area on the front for a logo.' },
  { id: 'base', label: 'Base', help: 'Floor thickness and drainage pattern.' },
  { id: 'stack', label: 'Stack', help: 'The foot sits inside the rim of the crate below. Clearance is the gap that lets it drop in.' },
  { id: 'look', label: 'Look', help: 'Preview only. Colour is also written into 3MF exports.' },
];

export const SCHEMA = [
  // Body
  { key: 'sides', tab: 'body', label: 'Faces', type: 'range', min: 3, max: 12, step: 1, unit: '', def: 4, hint: 'Number of sides, from a triangle to a dodecagon' },
  { key: 'width', tab: 'body', label: 'Width', type: 'range', min: 120, max: 600, step: 1, unit: 'mm', def: 330, hint: 'Across flats' },
  { key: 'height', tab: 'body', label: 'Height', type: 'range', min: 60, max: 500, step: 1, unit: 'mm', def: 280 },
  { key: 'corner', tab: 'body', label: 'Corner radius', type: 'range', min: 0, max: 80, step: 0.5, unit: 'mm', def: 18 },
  { key: 'wall', tab: 'body', label: 'Wall thickness', type: 'range', min: 1, max: 8, step: 0.1, unit: 'mm', def: 3, hint: 'Injection-moulded crates are usually 2.5 to 3.5 mm' },
  { key: 'taper', tab: 'body', label: 'Draft', type: 'range', min: 0, max: 8, step: 0.1, unit: '°', def: 0, hint: 'Flares walls so crates nest' },
  { key: 'scale', tab: 'body', label: 'Scale', type: 'range', min: 0.1, max: 2, step: 0.01, unit: '×', def: 1, hint: 'Scales everything, thickness too' },

  // Ribs & rims
  { key: 'ribCount', tab: 'ribs', label: 'Ribs', type: 'range', min: 0, max: 8, step: 1, unit: '', def: 3 },
  { key: 'ribHeight', tab: 'ribs', label: 'Rib height', type: 'range', min: 1, max: 20, step: 0.5, unit: 'mm', def: 6 },
  { key: 'ribDepth', tab: 'ribs', label: 'Rib depth', type: 'range', min: 0, max: 10, step: 0.1, unit: 'mm', def: 2.5, hint: 'How far ribs stand out from the wall' },
  { key: 'ribGrade', tab: 'ribs', label: 'Spacing grade', type: 'range', min: 0.6, max: 1.6, step: 0.01, unit: '', def: 1, hint: '<1 packs ribs toward the top' },
  { key: 'rimHeight', tab: 'rim', label: 'Top rim', type: 'range', min: 2, max: 40, step: 0.5, unit: 'mm', def: 14 },
  { key: 'rimDepth', tab: 'rim', label: 'Rim depth', type: 'range', min: 0, max: 12, step: 0.1, unit: 'mm', def: 3.5 },
  { key: 'baseBand', tab: 'ribs', label: 'Base band', type: 'range', min: 0, max: 40, step: 0.5, unit: 'mm', def: 12 },
  { key: 'pillars', tab: 'rim', label: 'Corner pillars', type: 'toggle', def: true },
  { key: 'pillarWidth', tab: 'rim', label: 'Pillar width', type: 'range', min: 4, max: 80, step: 0.5, unit: 'mm', def: 24, show: (p) => p.pillars },
  { key: 'pillarDepth', tab: 'rim', label: 'Pillar depth', type: 'range', min: 0, max: 10, step: 0.1, unit: 'mm', def: 2.5, show: (p) => p.pillars },
  // internal (not shown) – fixed sensible value
  { key: 'rimInner', tab: null, def: 1.5 },

  // Holes
  { key: 'holes', tab: 'holes', label: 'Openings', type: 'toggle', half: true, def: true },
  { key: 'holeShape', tab: 'holes', label: 'Shape', type: 'segment', options: [['slot', 'Slot'], ['rect', 'Square'], ['circle', 'Round'], ['hex', 'Hex'], ['diamond', 'Diamond']], def: 'slot', show: (p) => p.holes },
  { key: 'holeWidth', tab: 'holes', label: 'Opening width', type: 'range', min: 3, max: 60, step: 0.5, unit: 'mm', def: 9, show: (p) => p.holes },
  { key: 'holeHeight', tab: 'holes', label: 'Opening height', type: 'range', min: 3, max: 120, step: 0.5, unit: 'mm', def: 36, show: (p) => p.holes },
  { key: 'holeGapX', tab: 'holes', label: 'Bar width', type: 'range', min: 2, max: 30, step: 0.5, unit: 'mm', def: 6, show: (p) => p.holes, hint: 'Solid plastic left between neighbouring openings' },
  { key: 'holeGapY', tab: 'holes', label: 'Row gap', type: 'range', min: 2, max: 30, step: 0.5, unit: 'mm', def: 7, show: (p) => p.holes },
  { key: 'holeMargin', tab: 'holes', label: 'Edge margin', type: 'range', min: 2, max: 40, step: 0.5, unit: 'mm', def: 8, show: (p) => p.holes },
  { key: 'holeFill', tab: 'holes', label: 'Fill bands', type: 'toggle', half: true, def: true, show: (p) => p.holes, hint: 'On: openings stretch to fill each band. Off: they keep the exact height you set' },
  { key: 'holeRadius', tab: null, def: 2 },

  // Handles + label
  { key: 'handles', tab: 'grips', label: 'Hand holds', type: 'toggle', half: true, def: true },
  { key: 'handleFaces', tab: 'grips', label: 'On faces', type: 'segment', options: [['all', 'All'], ['pair', 'Opposite'], ['front', 'Front']], def: 'all', show: (p) => p.handles },
  { key: 'handleWidth', tab: 'grips', label: 'Grip width', type: 'range', min: 40, max: 200, step: 1, unit: 'mm', def: 110, show: (p) => p.handles },
  { key: 'handleHeight', tab: 'grips', label: 'Grip height', type: 'range', min: 15, max: 60, step: 0.5, unit: 'mm', def: 32, show: (p) => p.handles },
  { key: 'handleTop', tab: 'grips', label: 'From top', type: 'range', min: 6, max: 80, step: 0.5, unit: 'mm', def: 20, show: (p) => p.handles },
  { key: 'handleShape', tab: null, def: 'slot' },
  { key: 'handleRadius', tab: null, def: 8 },
  { key: 'label', tab: 'grips', label: 'Label plate', type: 'toggle', half: true, def: true, hint: 'Solid panel on the front for a logo' },
  { key: 'labelWidth', tab: 'grips', label: 'Plate width', type: 'range', min: 30, max: 260, step: 1, unit: 'mm', def: 120, show: (p) => p.label },
  { key: 'labelHeight', tab: 'grips', label: 'Plate height', type: 'range', min: 15, max: 160, step: 1, unit: 'mm', def: 44, show: (p) => p.label },
  { key: 'labelZ', tab: null, def: 0.42 },
  { key: 'labelRaise', tab: null, def: 1 },

  // Base
  { key: 'floor', tab: 'base', label: 'Floor thickness', type: 'range', min: 1, max: 10, step: 0.1, unit: 'mm', def: 3 },
  { key: 'floorPattern', tab: 'base', label: 'Floor', type: 'segment', options: [['none', 'Solid'], ['grid', 'Grid'], ['slots', 'Slots'], ['hex', 'Hex']], def: 'grid' },
  { key: 'floorHole', tab: 'base', label: 'Opening size', type: 'range', min: 3, max: 40, step: 0.5, unit: 'mm', def: 12, show: (p) => p.floorPattern !== 'none' },
  { key: 'floorSlotLen', tab: 'base', label: 'Slot length', type: 'range', min: 10, max: 120, step: 1, unit: 'mm', def: 40, show: (p) => p.floorPattern === 'slots' },
  { key: 'floorGap', tab: 'base', label: 'Bar width', type: 'range', min: 2, max: 20, step: 0.5, unit: 'mm', def: 5, show: (p) => p.floorPattern !== 'none' },
  { key: 'floorMargin', tab: 'base', label: 'Floor margin', type: 'range', min: 2, max: 60, step: 0.5, unit: 'mm', def: 12, show: (p) => p.floorPattern !== 'none' },
  { key: 'foot', tab: 'stack', label: 'Stacking foot', type: 'toggle', def: true, hint: 'Locks into the crate below' },
  { key: 'footHeight', tab: 'stack', label: 'Foot height', type: 'range', min: 2, max: 30, step: 0.5, unit: 'mm', def: 8, show: (p) => p.foot },
  { key: 'footClear', tab: 'stack', label: 'Fit clearance', type: 'range', min: 0, max: 4, step: 0.05, unit: 'mm', def: 0.8, show: (p) => p.foot },
  { key: 'footWall', tab: null, def: 3 },

  // Finish (viewer only — no rebuild)
  { key: 'color', tab: 'look', label: 'Colour', type: 'swatches', options: ['#295B2E', '#1E4FA0', '#2AA7E0', '#E2367E', '#2B2F2C', '#E8E6DF', '#F2B705'], def: '#295B2E', live: true },
  { key: 'gloss', tab: 'look', label: 'Gloss', type: 'range', min: 0, max: 1, step: 0.01, unit: '', def: 0.35, live: true },
  { key: 'stack', tab: 'stack', label: 'Stack preview', type: 'range', min: 1, max: 4, step: 1, unit: '', def: 1, live: true, hint: 'Shows how crates sit on top of each other' },
  { key: 'section', tab: 'look', label: 'Section cut', type: 'toggle', half: true, def: false, live: true, hint: 'Slices the view in half to check wall, rib and foot profiles' },
  { key: 'dims', tab: 'look', label: 'Dimensions', type: 'toggle', half: true, def: true, live: true },
];

export const DEFAULTS = Object.fromEntries(SCHEMA.map((s) => [s.key, s.def]));
export const LIVE_KEYS = new Set(SCHEMA.filter((s) => s.live).map((s) => s.key));

export const PRESETS = [
  { id: 'classic', name: 'Tnuva classic', p: {} },
  { id: 'tall', name: 'Tall bottle crate', p: { height: 360, ribCount: 4, holeShape: 'rect', holeWidth: 14, holeHeight: 20, holeFill: false, color: '#1E4FA0' } },
  { id: 'hex', name: 'Hex bin', p: { sides: 6, width: 300, height: 220, corner: 10, holeShape: 'hex', holeWidth: 16, holeHeight: 16, holeFill: false, handleFaces: 'pair', label: false, floorPattern: 'hex', color: '#F2B705' } },
  { id: 'nest', name: 'Nesting tray', p: { height: 140, taper: 5, ribCount: 1, foot: false, holeShape: 'slot', holeWidth: 8, handleFaces: 'pair', label: false, color: '#E2367E' } },
  { id: 'desk', name: 'Desk organiser', p: { scale: 0.3, wall: 5, floor: 5, color: '#2AA7E0' } },
  { id: 'solid', name: 'Closed tote', p: { holes: false, floorPattern: 'none', ribCount: 2, color: '#2B2F2C' } },
];

// Compact URL hash encoding: only values that differ from defaults.
export function encodeParams(p) {
  const diff = {};
  for (const k in p) if (p[k] !== DEFAULTS[k]) diff[k] = p[k];
  return Object.keys(diff).length ? '#' + new URLSearchParams(Object.entries(diff).map(([k, v]) => [k, String(v)])).toString() : '';
}
export function decodeParams(hash) {
  const out = { ...DEFAULTS };
  if (!hash || hash.length < 2) return out;
  const q = new URLSearchParams(hash.slice(1));
  for (const [k, v] of q) {
    if (!(k in DEFAULTS)) continue;
    const d = DEFAULTS[k];
    out[k] = typeof d === 'number' ? (Number.isFinite(+v) ? +v : d) : typeof d === 'boolean' ? v === 'true' : v;
  }
  return out;
}
