// Parameter schema. Every control in the UI is generated from this list.
// `tab` decides which panel it lives in; `show` hides controls that don't apply.

export const MODES = [
  { id: 'crate', label: 'Crate' },
  { id: 'cover', label: 'Cover' },
  { id: 'print', label: 'Print' },
];

export const TABS = [
  { id: 'body', mode: 'crate', label: 'Body', help: 'Overall form. Width is measured across the flats, not corner to corner.' },
  { id: 'ribs', mode: 'crate', label: 'Ribs', help: 'Horizontal bands that stiffen the walls. Openings fill the space between them.' },
  { id: 'rim', mode: 'crate', label: 'Rim', help: 'The top rim carries the load when crates stack. Pillars reinforce the corners.' },
  { id: 'holes', mode: 'crate', label: 'Holes', help: 'Openings on each face. They stay clear of ribs, pillars, hand holds and the label plate.' },
  { id: 'grips', mode: 'crate', label: 'Grips', help: 'Hand holds cut through the rim. The label plate is a solid area on the front for a logo.' },
  { id: 'base', mode: 'crate', label: 'Base', help: 'Floor thickness and drainage pattern.' },
  { id: 'stack', mode: 'crate', label: 'Stack', help: 'The foot sits inside the rim of the crate below. Clearance is the gap that lets it drop in, and does not change with scale.' },
  { id: 'look', mode: 'crate', label: 'Look', help: 'Preview only. Colour is also written into 3MF exports.' },
  { id: 'lid', mode: 'cover', label: 'Lid', help: 'A cover that sits on the rim. Overhang is measured from the outside of the rim.' },
  { id: 'cstack', mode: 'cover', label: 'Stack', help: 'The skirt locks the cover onto the crate below. The lip on top takes the foot of a crate stacked on the cover, so it stacks from both directions.' },
  { id: 'vents', mode: 'cover', label: 'Vents', help: 'Openings in the cover plate. They stay inside the skirt and the lip.' },
  { id: 'seat', mode: 'cover', label: 'Seat', help: 'Turn the crate into a stool: straps or ties hold a cushion, a frame keeps it in place. The cushion is a preview and is not exported.' },
  { id: 'split', mode: 'print', label: 'Split', help: 'Print-ready adds 45° chamfers under every rib and moves the floor to the bottom of the foot, so every part prints upright without supports.' },
  { id: 'joint', mode: 'print', label: 'Joint', help: 'Joints sit at the bottom of a rib, where there are no openings. The lower part grows a tongue, the upper part gets a groove. Gaps are real millimetres and ignore scale.' },
  { id: 'bed', mode: 'print', label: 'Bed', help: 'Parts are laid out on as many plates of this size as needed. A part taller or wider than the bed is marked in red.' },
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

  // Cover
  { key: 'cover', tab: 'lid', label: 'Cover', type: 'toggle', half: true, def: false },
  { key: 'lidThick', tab: 'lid', label: 'Thickness', type: 'range', min: 1, max: 12, step: 0.1, unit: 'mm', def: 3.5, show: (p) => p.cover },
  { key: 'lidOverhang', tab: 'lid', label: 'Overhang', type: 'range', min: -3, max: 15, step: 0.5, unit: 'mm', def: 1, show: (p) => p.cover },
  { key: 'lidClear', tab: 'lid', label: 'Fit clearance', type: 'range', min: 0, max: 3, step: 0.05, unit: 'mm', def: 0.8, show: (p) => p.cover && p.lidSkirt, hint: 'Gap between the skirt and the crate wall' },
  { key: 'lidGrip', tab: 'lid', label: 'Grip', type: 'segment', options: [['none', 'None'], ['notches', 'Notches'], ['slot', 'Hand slot']], def: 'notches', show: (p) => p.cover },
  { key: 'gripSize', tab: 'lid', label: 'Grip size', type: 'range', min: 12, max: 60, step: 1, unit: 'mm', def: 28, show: (p) => p.cover && p.lidGrip !== 'none' },

  { key: 'lidSkirt', tab: 'cstack', label: 'Skirt below', type: 'toggle', half: true, def: true, show: (p) => p.cover, hint: 'Locks the cover onto the crate underneath' },
  { key: 'lidLip', tab: 'cstack', label: 'Lip on top', type: 'toggle', half: true, def: true, show: (p) => p.cover, hint: 'Takes the foot of a crate stacked on top of the cover' },
  { key: 'lidSkirtHeight', tab: 'cstack', label: 'Skirt height', type: 'range', min: 2, max: 30, step: 0.5, unit: 'mm', def: 8, show: (p) => p.cover && p.lidSkirt },
  { key: 'lidLipHeight', tab: 'cstack', label: 'Lip height', type: 'range', min: 2, max: 30, step: 0.5, unit: 'mm', def: 9, show: (p) => p.cover && p.lidLip, hint: 'Make it taller than the foot height so stacked crates lock in' },
  { key: 'lidRibs', tab: 'cstack', label: 'Underside ribs', type: 'segment', options: [['none', 'None'], ['grid', 'Grid'], ['radial', 'Radial']], def: 'grid', show: (p) => p.cover },
  { key: 'lidRibDepth', tab: 'cstack', label: 'Rib depth', type: 'range', min: 2, max: 25, step: 0.5, unit: 'mm', def: 6, show: (p) => p.cover && p.lidRibs !== 'none' },
  { key: 'lidRibGap', tab: 'cstack', label: 'Rib spacing', type: 'range', min: 15, max: 150, step: 1, unit: 'mm', def: 60, show: (p) => p.cover && p.lidRibs === 'grid' },

  { key: 'lidPattern', tab: 'vents', label: 'Vents', type: 'segment', options: [['none', 'None'], ['grid', 'Grid'], ['slots', 'Slots'], ['hex', 'Hex'], ['round', 'Round']], def: 'none', show: (p) => p.cover },
  { key: 'lidHole', tab: 'vents', label: 'Opening size', type: 'range', min: 3, max: 40, step: 0.5, unit: 'mm', def: 10, show: (p) => p.cover && p.lidPattern !== 'none' },
  { key: 'lidSlotLen', tab: 'vents', label: 'Slot length', type: 'range', min: 10, max: 150, step: 1, unit: 'mm', def: 40, show: (p) => p.cover && p.lidPattern === 'slots' },
  { key: 'lidGap', tab: 'vents', label: 'Bar width', type: 'range', min: 2, max: 30, step: 0.5, unit: 'mm', def: 6, show: (p) => p.cover && p.lidPattern !== 'none' },
  { key: 'lidMargin', tab: 'vents', label: 'Margin', type: 'range', min: 2, max: 80, step: 0.5, unit: 'mm', def: 16, show: (p) => p.cover && p.lidPattern !== 'none' },

  { key: 'seat', tab: 'seat', label: 'Cushion fixing', type: 'segment', options: [['none', 'None'], ['straps', 'Straps'], ['ties', 'Ties'], ['frame', 'Frame']], def: 'none', show: (p) => p.cover },
  { key: 'strapLen', tab: 'seat', label: 'Strap width', type: 'range', min: 10, max: 80, step: 1, unit: 'mm', def: 30, show: (p) => p.cover && p.seat === 'straps', hint: 'Length of each strap slot, so it fits your strap or Velcro' },
  { key: 'strapInset', tab: 'seat', label: 'From edge', type: 'range', min: 4, max: 60, step: 0.5, unit: 'mm', def: 12, show: (p) => p.cover && (p.seat === 'straps' || p.seat === 'ties') },
  { key: 'frameHeight', tab: 'seat', label: 'Frame height', type: 'range', min: 2, max: 25, step: 0.5, unit: 'mm', def: 6, show: (p) => p.cover && p.seat === 'frame' && !p.lidLip, hint: 'With the lip on top, the lip already frames the cushion' },
  { key: 'cushion', tab: 'seat', label: 'Show cushion', type: 'toggle', half: true, def: false, show: (p) => p.cover },
  { key: 'cushionThick', tab: 'seat', label: 'Cushion', type: 'range', min: 10, max: 120, step: 1, unit: 'mm', def: 45, show: (p) => p.cover && p.cushion },
  { key: 'cushionColor', tab: 'seat', label: 'Fabric', type: 'swatches', options: ['#C9B8A0', '#3C4A5C', '#8E3B2F', '#5E7354', '#D9D4CC', '#23262A'], def: '#C9B8A0', live: true, show: (p) => p.cover && p.cushion },

  // Print
  { key: 'printReady', tab: 'split', label: 'Print-ready', type: 'toggle', half: true, def: false },
  { key: 'bedView', tab: 'split', label: 'Bed view', type: 'toggle', half: true, def: false, live: true, hint: 'Shows the parts the way they will sit on the print bed' },
  { key: 'splitBase', tab: 'split', label: 'Separate base', type: 'toggle', half: true, def: true, show: (p) => p.printReady, hint: 'Splits the floor and foot from the walls' },
  { key: 'sections', tab: 'split', label: 'Wall sections', type: 'range', min: 1, max: 5, step: 1, unit: '', def: 2, show: (p) => p.printReady, hint: 'Splits the walls at ribs so tall crates fit your printer' },
  { key: 'explode', tab: ['split', 'look'], label: 'Exploded view', type: 'range', min: 0, max: 1, step: 0.01, unit: '', def: 0, live: true },

  { key: 'joint', tab: 'joint', label: 'Joint', type: 'segment', options: [['snap', 'Snap'], ['glue', 'Glue'], ['press', 'Tight gap']], def: 'snap', show: (p) => p.printReady },
  { key: 'jointDepth', tab: 'joint', label: 'Joint depth', type: 'range', min: 2, max: 15, step: 0.5, unit: 'mm', def: 5, show: (p) => p.printReady, hint: 'How far the tongue reaches into the part above. Limited by the rib height' },
  { key: 'snapGap', tab: 'joint', label: 'Gap', type: 'range', min: 0.05, max: 0.8, step: 0.01, unit: 'mm', def: 0.25, show: (p) => p.printReady && p.joint === 'snap', hint: 'Clearance around the tongue, in real millimetres' },
  { key: 'glueGap', tab: 'joint', label: 'Glue gap', type: 'range', min: 0.05, max: 0.8, step: 0.01, unit: 'mm', def: 0.2, show: (p) => p.printReady && p.joint === 'glue', hint: 'Room for the adhesive. Two grooves in the tongue hold extra glue' },
  { key: 'pressGap', tab: 'joint', label: 'Gap', type: 'range', min: 0, max: 0.5, step: 0.01, unit: 'mm', def: 0.1, show: (p) => p.printReady && p.joint === 'press', hint: 'Press fit: 0.05 to 0.15 mm for most printers. Test with a small scale first' },
  { key: 'snapBump', tab: 'joint', label: 'Snap bump', type: 'range', min: 0.2, max: 1.5, step: 0.05, unit: 'mm', def: 0.6, show: (p) => p.printReady && p.joint === 'snap', hint: 'How far each catch sticks out. Bigger holds harder and is harder to close' },
  { key: 'snapsPerFace', tab: 'joint', label: 'Snaps per face', type: 'range', min: 1, max: 4, step: 1, unit: '', def: 2, show: (p) => p.printReady && p.joint === 'snap' },

  { key: 'printer', tab: 'bed', label: 'Printer', type: 'segment', options: [['mini', '180'], ['mk4', '250×210'], ['x1', '256'], ['big', '350'], ['custom', 'Custom']], def: 'x1', live: true },
  { key: 'bedX', tab: 'bed', label: 'Bed width', type: 'range', min: 100, max: 600, step: 1, unit: 'mm', def: 256, live: true },
  { key: 'bedY', tab: 'bed', label: 'Bed depth', type: 'range', min: 100, max: 600, step: 1, unit: 'mm', def: 256, live: true },
  { key: 'bedZ', tab: 'bed', label: 'Max height', type: 'range', min: 100, max: 600, step: 1, unit: 'mm', def: 256, live: true },
];

export const DEFAULTS = Object.fromEntries(SCHEMA.map((s) => [s.key, s.def]));
export const PRINTERS = { mini: [180, 180, 180], mk4: [250, 210, 220], x1: [256, 256, 256], big: [350, 350, 350] };
export const LIVE_KEYS = new Set(SCHEMA.filter((s) => s.live).map((s) => s.key));

export const PRESETS = [
  { id: 'classic', name: 'Tnuva classic', p: {} },
  { id: 'tall', name: 'Tall bottle crate', p: { height: 360, ribCount: 4, holeShape: 'rect', holeWidth: 14, holeHeight: 20, holeFill: false, color: '#1E4FA0' } },
  { id: 'hex', name: 'Hex bin', p: { sides: 6, width: 300, height: 220, corner: 10, holeShape: 'hex', holeWidth: 16, holeHeight: 16, holeFill: false, handleFaces: 'pair', label: false, floorPattern: 'hex', color: '#F2B705' } },
  { id: 'nest', name: 'Nesting tray', p: { height: 140, taper: 5, ribCount: 1, foot: false, holeShape: 'slot', holeWidth: 8, handleFaces: 'pair', label: false, color: '#E2367E' } },
  { id: 'desk', name: 'Desk organiser', p: { scale: 0.3, wall: 5, floor: 5, color: '#2AA7E0' } },
  { id: 'stool', name: 'Crate stool', p: { cover: true, lidThick: 5, lidLip: false, seat: 'straps', cushion: true, lidRibs: 'radial', lidRibDepth: 10, color: '#2B2F2C' } },
  { id: 'print', name: 'Print kit, ⅓ scale', p: { scale: 0.33, wall: 6, floor: 6, ribHeight: 18, ribDepth: 4, baseBand: 20, printReady: true, sections: 2, cover: true, color: '#E2367E' } },
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
