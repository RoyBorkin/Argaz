// Argaz, parametric crate configurator. © 2026 Roy Borkin. All rights reserved.
// Parameter schema. Every control in the UI is generated from this list.
// `tab` decides which panel(s) it lives in; `show` hides controls that don't apply.
// The defaults are the "Tnuva classic" crate, modelled on the real crate photo.

export const MODES = [
  { id: 'crate', label: 'Crate' },
  { id: 'cover', label: 'Cover' },
  { id: 'print', label: 'Print' },
];

export const TABS = [
  { id: 'body', mode: 'crate', label: 'Body', help: 'Overall form. Width is measured across the flats, not corner to corner.' },
  { id: 'ribs', mode: 'crate', label: 'Ribs', help: 'Band layout lists the bands between ribs from top to bottom, as relative heights. Add q for small square openings or s for a solid band, e.g. 48q 48 48q 48 28s 28s. Leave it empty to use Ribs and Spacing grade.' },
  { id: 'faces', mode: 'crate', label: 'Faces', help: 'Vertical ribs split each face into columns. Corner columns stay solid; corner ribs frame them like on the real crate. An odd number of columns gives a centre column for the hand hold and the plate.' },
  { id: 'holes', mode: 'crate', label: 'Holes', help: 'Openings on each face. They stay clear of ribs, pillars, hand holds and the label plate.' },
  { id: 'grips', mode: 'crate', label: 'Grips', help: 'Hand holds cut through the top band. The frame is a raised border around the opening, like on the real crate.' },
  { id: 'plate', mode: 'crate', label: 'Plate', help: 'A smooth raised panel on the front, like the one on the real crate. Band and span snap it to whole bands, counted from the top; raise it above the ribs to hide them.' },
  { id: 'logo', mode: 'crate', label: 'Logo', help: 'Type a name or upload a PNG, JPG or SVG. Dark or opaque pixels become the logo. Hebrew text works too.' },
  { id: 'base', mode: 'crate', label: 'Base', help: 'Floor thickness and drainage pattern.' },
  { id: 'stack', mode: 'crate', label: 'Stack', help: 'The top rim carries the load when crates stack. The foot sits inside the rim of the crate below; clearance is the gap that lets it drop in and does not change with scale.' },
  { id: 'lid', mode: 'cover', label: 'Lid', help: 'A cover that sits on the rim. Overhang is measured from the outside of the rim.' },
  { id: 'cstack', mode: 'cover', label: 'Stack', help: 'The skirt locks the cover onto the crate below. The lip on top takes the foot of a crate stacked on the cover, so it stacks from both directions.' },
  { id: 'vents', mode: 'cover', label: 'Vents', help: 'Openings in the cover plate. They stay inside the skirt and the lip.' },
  { id: 'seat', mode: 'cover', label: 'Seat', help: 'Turn the crate into a stool. Straps or ties hold a cushion; the printable frame holds the foam. Export a 1:1 foam cutting template from the Export menu.' },
  { id: 'split', mode: 'print', label: 'Split', help: 'Print-ready adds 45° chamfers under every rib so every part prints upright without supports. The original foot prints as its own ring that plugs into the floor; the 45° shoulder keeps it in one piece. Nothing here changes the crate unless Print-ready is on.' },
  { id: 'joint', mode: 'print', label: 'Joint', help: 'Joints sit at the bottom of a rib, where there are no openings: the lower part grows a tongue, the upper part gets a groove. Vertical cuts use filament pins. Gaps are real millimetres.' },
  { id: 'bed', mode: 'print', label: 'Bed', help: 'Set your printer bed. Parts are laid out on as many plates as needed; anything too big is marked in red. Fit to bed picks wall sections and vertical cuts for you.' },
  { id: 'view', mode: null, label: 'View' },
];

const showIf = (k) => (p) => p[k];
export const SCHEMA = [
  // Body
  { key: 'sides', tab: 'body', label: 'Faces', type: 'range', min: 3, max: 12, step: 1, unit: '', def: 4, hint: 'Number of sides, from a triangle to a dodecagon' },
  { key: 'width', tab: 'body', label: 'Width', type: 'range', min: 120, max: 600, step: 1, unit: 'mm', def: 330, hint: 'Across flats' },
  { key: 'height', tab: 'body', label: 'Height', type: 'range', min: 60, max: 500, step: 1, unit: 'mm', def: 280 },
  { key: 'corner', tab: 'body', label: 'Corner radius', type: 'range', min: 0, max: 80, step: 0.5, unit: 'mm', def: 10},
  { key: 'wall', tab: 'body', label: 'Wall thickness', type: 'range', min: 1, max: 8, step: 0.1, unit: 'mm', def: 2.5, hint: 'Injection-moulded crates are usually 2.5 to 3.5 mm' },
  { key: 'taper', tab: 'body', label: 'Draft', type: 'range', min: 0, max: 8, step: 0.1, unit: '°', def: 0, hint: 'Flares walls so crates nest' },
  { key: 'scale', tab: 'body', label: 'Scale', type: 'range', min: 0.1, max: 2, step: 0.01, unit: '×', def: 1 },

  // Ribs
  { key: 'bandSizes', tab: 'ribs', label: 'Band layout', type: 'text', def: '3.7q 3.7q 3.7q 5.3 5.3 11.1 11.1 11.1s', placeholder: 'e.g. 48q 48 48q 48 28s', hint: 'Bands from top to bottom. q = small squares, s = solid' },
  { key: 'ribCount', tab: 'ribs', label: 'Ribs', type: 'range', min: 0, max: 8, step: 1, unit: '', def: 3, show: (p) => !String(p.bandSizes || '').trim() },
  { key: 'ribLines', tab: null, label: 'Lines per rib', type: 'range', min: 1, max: 3, step: 1, unit: '', def: 1, hint: 'The Tnuva crate uses pairs of thin ribs' },
  { key: 'ribHeight', tab: 'ribs', label: 'Rib band', type: 'range', min: 1, max: 30, step: 0.5, unit: 'mm', def: 1.4, hint: 'Total height of a rib, all lines included' },
  { key: 'ribLineGap', tab: 'ribs', label: 'Line gap', type: 'range', min: 1, max: 12, step: 0.5, unit: 'mm', def: 5, show: (p) => p.ribLines > 1 || p.rimLines > 0 },
  { key: 'ribDepth', tab: 'ribs', label: 'Rib depth', type: 'range', min: 0, max: 10, step: 0.1, unit: 'mm', def: 3.5, hint: 'How far ribs stand out from the wall' },
  { key: 'ribGrade', tab: 'ribs', label: 'Spacing grade', type: 'range', min: 0.6, max: 1.6, step: 0.01, unit: '', def: 1, hint: '<1 packs ribs toward the top', show: (p) => !String(p.bandSizes || '').trim() },
  { key: 'baseBand', tab: 'ribs', label: 'Base band', type: 'range', min: 0, max: 40, step: 0.5, unit: 'mm', def: 1.6},

  // Faces
  { key: 'altBands', tab: 'faces', label: 'Alternate bands', type: 'toggle', half: true, def: true, hint: 'Every other band gets a grid of small openings, starting at the top. Ignored when Band layout is set', show: (p) => !String(p.bandSizes || '').trim() },
  { key: 'columns', tab: 'faces', label: 'Columns', type: 'range', min: 1, max: 7, step: 1, unit: '', def: 3},
  { key: 'centerCol', tab: 'faces', label: 'Centre column', type: 'range', min: 0, max: 260, step: 1, unit: 'mm', def: 134, show: (p) => p.columns > 1 && p.columns % 2 === 1, hint: '0 makes all columns equal' },
  { key: 'vRibWidth', tab: 'faces', label: 'Vertical rib', type: 'range', min: 1.5, max: 12, step: 0.5, unit: 'mm', def: 1.4, show: (p) => p.columns > 1 },
  { key: 'centerTopRibs', tab: 'faces', label: 'Ribs above grip', type: 'range', min: 0, max: 4, step: 1, unit: '', def: 2, show: (p) => p.columns % 2 === 1 && p.columns > 1 && p.handles, hint: 'Short vertical ribs in the centre column, from the hand hold up to the rim' },
  { key: 'cornerRibs', tab: 'faces', label: 'Corner ribs', type: 'range', min: 0, max: 2, step: 1, unit: '', def: 2, hint: '1: a rib at the inner edge of the corner column. 2: another at the corner itself' },
  { key: 'pillarWidth', tab: 'faces', label: 'Corner column', type: 'range', min: 4, max: 80, step: 0.5, unit: 'mm', def: 34, hint: 'Solid strip at each corner, measured along the flat face' },
  { key: 'altShape', tab: 'faces', label: 'Band openings', type: 'segment', options: [['rect', 'Square'], ['circle', 'Round'], ['hex', 'Hex'], ['diamond', 'Diamond']], def: 'rect', show: showIf('altBands') },
  { key: 'altSize', tab: 'faces', label: 'Opening size', type: 'range', min: 3, max: 30, step: 0.5, unit: 'mm', def: 8, show: showIf('altBands') },

  // Holes
  { key: 'holes', tab: 'holes', label: 'Openings', type: 'toggle', half: true, def: true },
  { key: 'holeFill', tab: 'holes', label: 'Fill bands', type: 'toggle', half: true, def: true, show: showIf('holes'), hint: 'On: openings stretch to fill each band. Off: they keep the exact height you set' },
  { key: 'holeShape', tab: 'holes', label: 'Shape', type: 'segment', options: [['slot', 'Slot'], ['rect', 'Square'], ['circle', 'Round'], ['hex', 'Hex'], ['diamond', 'Diamond']], def: 'rect', show: showIf('holes') },
  { key: 'holeWidth', tab: 'holes', label: 'Opening width', type: 'range', min: 3, max: 60, step: 0.5, unit: 'mm', def: 6, show: showIf('holes') },
  { key: 'holeHeight', tab: 'holes', label: 'Opening height', type: 'range', min: 3, max: 120, step: 0.5, unit: 'mm', def: 36, show: showIf('holes') },
  { key: 'holeGapX', tab: 'holes', label: 'Bar width', type: 'range', min: 2, max: 30, step: 0.5, unit: 'mm', def: 5, show: showIf('holes'), hint: 'Solid plastic left between neighbouring openings' },
  { key: 'holeGapY', tab: 'holes', label: 'Row gap', type: 'range', min: 2, max: 30, step: 0.5, unit: 'mm', def: 5, show: showIf('holes') },
  { key: 'holeMargin', tab: 'holes', label: 'Edge margin', type: 'range', min: 2, max: 40, step: 0.5, unit: 'mm', def: 5, show: showIf('holes') },
  { key: 'holeRadius', tab: null, def: 1.5 },

  // Grips
  { key: 'handles', tab: 'grips', label: 'Hand holds', type: 'toggle', half: true, def: true },
  { key: 'handleLip', tab: 'grips', label: 'Frame', type: 'toggle', half: true, def: true, show: showIf('handles') },
  { key: 'handleFaces', tab: 'grips', label: 'On faces', type: 'segment', options: [['all', 'All'], ['pair', 'Opposite'], ['front', 'Front']], def: 'all', show: showIf('handles') },
  { key: 'handleShape', tab: 'grips', label: 'Shape', type: 'segment', options: [['tub', 'Tub'], ['rect', 'Rounded'], ['slot', 'Slot']], def: 'tub', show: showIf('handles'), hint: 'Tub: flat top under the rim, round bottom, like the real crate' },
  { key: 'handleWidth', tab: 'grips', label: 'Grip width', type: 'range', min: 40, max: 200, step: 1, unit: 'mm', def: 104, show: showIf('handles') },
  { key: 'handleHeight', tab: 'grips', label: 'Grip height', type: 'range', min: 15, max: 60, step: 0.5, unit: 'mm', def: 50, show: showIf('handles') },
  { key: 'handleTop', tab: 'grips', label: 'From top', type: 'range', min: 6, max: 80, step: 0.5, unit: 'mm', def: 38, show: showIf('handles') },
  { key: 'handleRadius', tab: 'grips', label: 'Top radius', type: 'range', min: 0, max: 20, step: 0.5, unit: 'mm', def: 12, show: (p) => p.handles && p.handleShape !== 'slot' },
  { key: 'handleRadiusB', tab: 'grips', label: 'Bottom radius', type: 'range', min: 0, max: 60, step: 0.5, unit: 'mm', def: 32, show: (p) => p.handles && p.handleShape === 'tub' },
  { key: 'handleTaper', tab: 'grips', label: 'Taper', type: 'range', min: 0, max: 0.5, step: 0.01, unit: '', def: 0.04, show: (p) => p.handles && p.handleShape === 'tub', hint: 'How much narrower the bottom of the hand hold is than the top' },
  { key: 'handleLipWidth', tab: 'grips', label: 'Frame width', type: 'range', min: 0.6, max: 8, step: 0.1, unit: 'mm', def: 1.4, show: (p) => p.handles && p.handleLip },

  // Logo + label plate
  { key: 'logo', tab: 'logo', label: 'Logo', type: 'toggle', half: true, def: true },
  { key: 'label', tab: 'plate', label: 'Panel', type: 'toggle', half: true, def: true, hint: 'A plain panel in the centre column, raised or flush' },
  { key: 'plateClear', tab: 'plate', label: 'Ribs stop', type: 'toggle', half: true, def: true, show: (p) => p.label || p.logo, hint: 'Horizontal ribs stop at the panel edges, so the panel is plain like on the Grasshopper model' },
  { key: 'plateFaces', tab: 'plate', label: 'On faces', type: 'segment', options: [['front', 'Front'], ['pair', 'Opposite'], ['all', 'All']], def: 'all', show: (p) => p.label || p.logo },
  { key: 'logoSource', tab: 'logo', label: 'Source', type: 'segment', options: [['text', 'Text'], ['image', 'Image']], def: 'text', show: showIf('logo') },
  { key: 'logoText', tab: 'logo', label: 'Text', type: 'text', def: 'TNUVA', show: (p) => p.logo && p.logoSource === 'text', placeholder: 'Type a name' },
  { key: 'logoImage', tab: 'logo', label: 'Image', type: 'file', accept: 'image/png,image/jpeg,image/svg+xml,image/webp', def: '', show: (p) => p.logo && p.logoSource === 'image', noUrl: true },
  { key: 'logoStyle', tab: 'logo', label: 'Style', type: 'segment', options: [['emboss', 'Raised'], ['engrave', 'Engraved'], ['cut', 'Cut through']], def: 'emboss', show: showIf('logo') },
  { key: 'logoDepth', tab: 'logo', label: 'Depth', type: 'range', min: 0.2, max: 4, step: 0.1, unit: 'mm', def: 1, show: (p) => p.logo && p.logoStyle !== 'cut', hint: 'Real millimetres: stays the same at any scale' },
  { key: 'logoFaces', tab: 'logo', label: 'On faces', type: 'segment', options: [['front', 'Front'], ['pair', 'Opposite'], ['all', 'All']], def: 'pair', show: showIf('logo') },
  { key: 'labelBand', tab: 'plate', label: 'In band', type: 'range', min: 0, max: 6, step: 1, unit: '', def: 3, show: (p) => p.label || p.logo, hint: '0 places the plate freely with Height and Position' },
  { key: 'labelSpan', tab: 'plate', label: 'Bands tall', type: 'range', min: 1, max: 4, step: 1, unit: '', def: 4, show: (p) => (p.label || p.logo) && p.labelBand > 0 },
  { key: 'labelWidth', tab: 'plate', label: 'Plate width', type: 'range', min: 30, max: 260, step: 1, unit: 'mm', def: 128, show: (p) => p.label || p.logo },
  { key: 'labelHeight', tab: 'plate', label: 'Plate height', type: 'range', min: 15, max: 160, step: 1, unit: 'mm', def: 40, show: (p) => (p.label || p.logo) && !(p.labelBand > 0) },
  { key: 'logoFont', tab: null, def: 'sans' },
  { key: 'labelZ', tab: 'plate', label: 'Position', type: 'range', min: 0.1, max: 0.9, step: 0.01, unit: '', def: 0.6, show: (p) => (p.label || p.logo) && !(p.labelBand > 0), hint: 'Height of the plate centre, as a share of the wall' },
  { key: 'labelRaise', tab: 'plate', label: 'Raise', type: 'range', min: 0, max: 6, step: 0.1, unit: 'mm', def: 0, show: showIf('label'), hint: 'Raise it above the rib depth to hide the ribs behind it' },

  // Base
  { key: 'floor', tab: 'base', label: 'Floor thickness', type: 'range', min: 1, max: 10, step: 0.1, unit: 'mm', def: 2.5},
  { key: 'floorPattern', tab: 'base', label: 'Floor', type: 'segment', options: [['none', 'Solid'], ['grid', 'Grid'], ['slots', 'Slots'], ['hex', 'Hex']], def: 'grid' },
  { key: 'floorHole', tab: 'base', label: 'Opening size', type: 'range', min: 3, max: 40, step: 0.5, unit: 'mm', def: 12, show: (p) => p.floorPattern !== 'none' },
  { key: 'floorSlotLen', tab: 'base', label: 'Slot length', type: 'range', min: 10, max: 120, step: 1, unit: 'mm', def: 40, show: (p) => p.floorPattern === 'slots' },
  { key: 'floorGap', tab: 'base', label: 'Bar width', type: 'range', min: 2, max: 20, step: 0.5, unit: 'mm', def: 5, show: (p) => p.floorPattern !== 'none' },
  { key: 'floorMargin', tab: 'base', label: 'Floor margin', type: 'range', min: 2, max: 60, step: 0.5, unit: 'mm', def: 12, show: (p) => p.floorPattern !== 'none' },

  // Stack: rim, pillars, foot
  { key: 'rimHeight', tab: 'stack', label: 'Top rim', type: 'range', min: 2, max: 40, step: 0.5, unit: 'mm', def: 1.6},
  { key: 'rimDepth', tab: 'stack', label: 'Rim depth', type: 'range', min: 0, max: 12, step: 0.1, unit: 'mm', def: 3.5},
  { key: 'rimLines', tab: 'stack', label: 'Lines under rim', type: 'range', min: 0, max: 3, step: 1, unit: '', def: 0},
  { key: 'pillars', tab: 'stack', label: 'Corner pillars', type: 'toggle', half: true, def: false, hint: 'Corner columns stand proud of the wall' },
  { key: 'foot', tab: 'stack', label: 'Stacking foot', type: 'toggle', half: true, def: true, hint: 'Locks into the crate below' },
  { key: 'footHeight', tab: 'stack', label: 'Foot height', type: 'range', min: 2, max: 30, step: 0.5, unit: 'mm', def: 6, show: showIf('foot') },
  { key: 'footClear', tab: 'stack', label: 'Fit clearance', type: 'range', min: 0, max: 4, step: 0.05, unit: 'mm', def: 0.6, show: showIf('foot') },
  { key: 'pillarDepth', tab: null, def: 2.5 },
  { key: 'rimInner', tab: 'stack', label: 'Inner lip', type: 'range', min: 0, max: 6, step: 0.1, unit: 'mm', def: 0, hint: 'Thickens the rim on the inside. The foot is sized to drop inside it' },
  { key: 'footWall', tab: 'stack', label: 'Foot wall', type: 'range', min: 0.8, max: 6, step: 0.1, unit: 'mm', def: 2, show: showIf('foot') },

  // View popover (preview only, no rebuild)
  { key: 'color', tab: 'view', label: 'Colour', type: 'swatches', options: ['#295B2E', '#1E4FA0', '#2AA7E0', '#E2367E', '#2B2F2C', '#E8E6DF', '#F2B705'], def: '#295B2E', live: true },
  { key: 'mixColors', tab: 'view', label: 'Mixed colours', type: 'toggle', half: true, def: false, live: true, hint: 'Each crate in the stack gets a different colour' },
  { key: 'shuffle', tab: 'view', label: 'Shuffle', type: 'action', half: true, show: showIf('mixColors') },
  { key: 'colorSeed', tab: null, def: 1, live: true },
  { key: 'gloss', tab: 'view', label: 'Gloss', type: 'range', min: 0, max: 1, step: 0.01, unit: '', def: 0.35, live: true },
  { key: 'stack', tab: 'dock', label: 'Stack preview', type: 'range', min: 1, max: 5, step: 1, unit: '', def: 1, live: true },
  { key: 'explode', tab: 'dock', label: 'Exploded view', type: 'range', min: 0, max: 1, step: 0.01, unit: '', def: 0, live: true },
  { key: 'section', tab: 'dock', label: 'Section cut', type: 'toggle', half: true, def: false, live: true },
  { key: 'dims', tab: 'dock', label: 'Dimensions', type: 'toggle', half: true, def: true, live: true },

  // Cover
  { key: 'cover', tab: 'lid', label: 'Cover', type: 'toggle', half: true, def: false },
  { key: 'logoCover', tab: 'lid', label: 'Logo on top', type: 'toggle', half: true, def: false, show: (p) => p.cover && p.logo },
  { key: 'lidThick', tab: 'lid', label: 'Thickness', type: 'range', min: 1, max: 12, step: 0.1, unit: 'mm', def: 3.5, show: showIf('cover') },
  { key: 'lidOverhang', tab: 'lid', label: 'Overhang', type: 'range', min: -3, max: 15, step: 0.5, unit: 'mm', def: 1, show: showIf('cover') },
  { key: 'lidClear', tab: 'lid', label: 'Fit clearance', type: 'range', min: 0, max: 3, step: 0.05, unit: 'mm', def: 0.8, show: (p) => p.cover && p.lidSkirt, hint: 'Gap between the skirt and the crate wall' },
  { key: 'lidGrip', tab: 'lid', label: 'Grip', type: 'segment', options: [['none', 'None'], ['notches', 'Notches'], ['slot', 'Hand slot']], def: 'notches', show: showIf('cover') },
  { key: 'gripSize', tab: 'lid', label: 'Grip size', type: 'range', min: 12, max: 60, step: 1, unit: 'mm', def: 28, show: (p) => p.cover && p.lidGrip !== 'none' },

  { key: 'lidSkirt', tab: 'cstack', label: 'Skirt below', type: 'toggle', half: true, def: true, show: showIf('cover'), hint: 'Locks the cover onto the crate underneath' },
  { key: 'lidLip', tab: 'cstack', label: 'Lip on top', type: 'toggle', half: true, def: true, show: showIf('cover'), hint: 'Takes the foot of a crate stacked on top of the cover' },
  { key: 'lidSkirtHeight', tab: 'cstack', label: 'Skirt height', type: 'range', min: 2, max: 30, step: 0.5, unit: 'mm', def: 8, show: (p) => p.cover && p.lidSkirt },
  { key: 'lidLipHeight', tab: 'cstack', label: 'Lip height', type: 'range', min: 2, max: 30, step: 0.5, unit: 'mm', def: 9, show: (p) => p.cover && p.lidLip, hint: 'Make it taller than the foot height so stacked crates lock in' },
  { key: 'lidRibs', tab: 'cstack', label: 'Underside ribs', type: 'segment', options: [['none', 'None'], ['grid', 'Grid'], ['radial', 'Radial']], def: 'grid', show: showIf('cover') },
  { key: 'lidRibDepth', tab: 'cstack', label: 'Rib depth', type: 'range', min: 2, max: 25, step: 0.5, unit: 'mm', def: 6, show: (p) => p.cover && p.lidRibs !== 'none' },
  { key: 'lidRibGap', tab: 'cstack', label: 'Rib spacing', type: 'range', min: 15, max: 150, step: 1, unit: 'mm', def: 60, show: (p) => p.cover && p.lidRibs === 'grid' },

  { key: 'lidPattern', tab: 'vents', label: 'Vents', type: 'segment', options: [['none', 'None'], ['grid', 'Grid'], ['slots', 'Slots'], ['hex', 'Hex'], ['round', 'Round']], def: 'none', show: showIf('cover') },
  { key: 'lidHole', tab: 'vents', label: 'Opening size', type: 'range', min: 3, max: 40, step: 0.5, unit: 'mm', def: 10, show: (p) => p.cover && p.lidPattern !== 'none' },
  { key: 'lidSlotLen', tab: 'vents', label: 'Slot length', type: 'range', min: 10, max: 150, step: 1, unit: 'mm', def: 40, show: (p) => p.cover && p.lidPattern === 'slots' },
  { key: 'lidGap', tab: 'vents', label: 'Bar width', type: 'range', min: 2, max: 30, step: 0.5, unit: 'mm', def: 6, show: (p) => p.cover && p.lidPattern !== 'none' },
  { key: 'lidMargin', tab: 'vents', label: 'Margin', type: 'range', min: 2, max: 80, step: 0.5, unit: 'mm', def: 16, show: (p) => p.cover && p.lidPattern !== 'none' },

  { key: 'cushion', tab: 'seat', label: 'Show cushion', type: 'toggle', half: true, def: false, show: showIf('cover') },
  { key: 'cushionFrame', tab: 'seat', label: 'Cushion frame', type: 'toggle', half: true, def: false, show: showIf('cover'), hint: 'A printable tray that holds the foam and sits on the cover' },
  { key: 'seat', tab: 'seat', label: 'Cushion fixing', type: 'segment', options: [['none', 'None'], ['straps', 'Straps'], ['ties', 'Ties'], ['frame', 'Frame']], def: 'none', show: showIf('cover') },
  { key: 'strapLen', tab: 'seat', label: 'Strap width', type: 'range', min: 10, max: 80, step: 1, unit: 'mm', def: 30, show: (p) => p.cover && p.seat === 'straps', hint: 'Length of each strap slot, so it fits your strap or Velcro' },
  { key: 'strapInset', tab: 'seat', label: 'From edge', type: 'range', min: 4, max: 60, step: 0.5, unit: 'mm', def: 12, show: (p) => p.cover && (p.seat === 'straps' || p.seat === 'ties') },
  { key: 'frameHeight', tab: 'seat', label: 'Frame height', type: 'range', min: 2, max: 25, step: 0.5, unit: 'mm', def: 6, show: (p) => p.cover && p.seat === 'frame' && !p.lidLip, hint: 'With the lip on top, the lip already frames the cushion' },
  { key: 'cushionFrameH', tab: 'seat', label: 'Tray wall', type: 'range', min: 4, max: 40, step: 0.5, unit: 'mm', def: 12, show: (p) => p.cover && p.cushionFrame },
  { key: 'cushionThick', tab: 'seat', label: 'Cushion', type: 'range', min: 10, max: 120, step: 1, unit: 'mm', def: 45, show: (p) => p.cover && p.cushion },
  { key: 'cushionColor', tab: 'seat', label: 'Fabric', type: 'swatches', options: ['#C9B8A0', '#3C4A5C', '#8E3B2F', '#5E7354', '#D9D4CC', '#23262A'], def: '#C9B8A0', live: true, show: (p) => p.cover && p.cushion },

  // Print
  { key: 'printReady', tab: 'split', label: 'Print-ready', type: 'toggle', half: true, def: false },
  { key: 'bedView', tab: 'split', label: 'Bed view', type: 'toggle', half: true, def: false, live: true, hint: 'Shows the parts the way they will sit on the print bed' },
  { key: 'splitBase', tab: 'split', label: 'Separate base', type: 'toggle', half: true, def: true, show: showIf('printReady'), hint: 'Splits the floor and foot from the walls' },
  { key: 'sections', tab: 'split', label: 'Wall sections', type: 'range', min: 1, max: 5, step: 1, unit: '', def: 2, show: showIf('printReady'), hint: 'Splits the walls at ribs so tall crates fit your printer' },
  { key: 'footStyle', tab: 'split', label: 'Foot', type: 'segment', options: [['ring', 'Original, separate ring'], ['chamfer', '45° shoulder']], def: 'ring', show: (p) => p.printReady && p.foot, hint: 'Original: the foot prints as its own ring and plugs into the floor. 45°: one piece with a sloped shoulder and the floor at the bottom' },
  { key: 'vSplit', tab: 'split', label: 'Vertical cut', type: 'segment', options: [['none', 'None'], ['halves', 'Halves'], ['quarters', 'Quarters']], def: 'none', show: showIf('printReady'), hint: 'Cuts every part down the middle so a full-size crate fits a small bed' },

  { key: 'joint', tab: 'joint', label: 'Joint', type: 'segment', options: [['snap', 'Snap'], ['glue', 'Glue'], ['press', 'Tight gap']], def: 'snap', show: showIf('printReady') },
  { key: 'jointDepth', tab: 'joint', label: 'Joint depth', type: 'range', min: 2, max: 15, step: 0.5, unit: 'mm', def: 5, show: showIf('printReady'), hint: 'How far the tongue reaches into the part above. Limited by the rib height' },
  { key: 'snapGap', tab: 'joint', label: 'Gap', type: 'range', min: 0.05, max: 0.8, step: 0.01, unit: 'mm', def: 0.25, show: (p) => p.printReady && p.joint === 'snap', hint: 'Clearance around the tongue, in real millimetres' },
  { key: 'glueGap', tab: 'joint', label: 'Glue gap', type: 'range', min: 0.05, max: 0.8, step: 0.01, unit: 'mm', def: 0.2, show: (p) => p.printReady && p.joint === 'glue', hint: 'Room for the adhesive. Two grooves in the tongue hold extra glue' },
  { key: 'pressGap', tab: 'joint', label: 'Gap', type: 'range', min: 0, max: 0.5, step: 0.01, unit: 'mm', def: 0.1, show: (p) => p.printReady && p.joint === 'press', hint: 'Press fit: 0.05 to 0.15 mm for most printers. Test with a small scale first' },
  { key: 'snapBump', tab: 'joint', label: 'Snap bump', type: 'range', min: 0.2, max: 1.5, step: 0.05, unit: 'mm', def: 0.6, show: (p) => p.printReady && p.joint === 'snap', hint: 'How far each catch sticks out. Bigger holds harder and is harder to close' },
  { key: 'snapsPerFace', tab: 'joint', label: 'Snaps per face', type: 'range', min: 1, max: 4, step: 1, unit: '', def: 2, show: (p) => p.printReady && p.joint === 'snap' },
  { key: 'pinDia', tab: 'joint', label: 'Pin diameter', type: 'range', min: 1, max: 5, step: 0.05, unit: 'mm', def: 1.75, show: (p) => p.printReady && p.vSplit !== 'none', hint: '1.75 mm lets you use a piece of filament as the pin' },
  { key: 'pinDepth', tab: 'joint', label: 'Pin depth', type: 'range', min: 3, max: 15, step: 0.5, unit: 'mm', def: 6, show: (p) => p.printReady && p.vSplit !== 'none' },
  { key: 'pinClear', tab: null, def: 0.1 },

  { key: 'printer', tab: 'bed', label: 'Printer', type: 'segment', options: [['mini', '180'], ['mk4', '250×210'], ['x1', '256'], ['big', '350'], ['custom', 'Custom']], def: 'x1', live: true },
  { key: 'bedX', tab: 'bed', label: 'Bed width', type: 'range', min: 80, max: 1000, step: 1, unit: 'mm', def: 256, live: true },
  { key: 'bedY', tab: 'bed', label: 'Bed depth', type: 'range', min: 80, max: 1000, step: 1, unit: 'mm', def: 256, live: true },
  { key: 'bedZ', tab: 'bed', label: 'Max height', type: 'range', min: 80, max: 1000, step: 1, unit: 'mm', def: 256, live: true },
  { key: 'fitBed', tab: 'bed', label: 'Fit to bed', type: 'action', hint: 'Turns on Print-ready and picks wall sections and vertical cuts so every part fits' },
];

export const DEFAULTS = Object.fromEntries(SCHEMA.filter((s) => s.type !== 'action').map((s) => [s.key, s.def]));
export const PRINTERS = { mini: [180, 180, 180], mk4: [250, 210, 220], x1: [256, 256, 256], big: [350, 350, 350] };
export const LIVE_KEYS = new Set(SCHEMA.filter((s) => s.live).map((s) => s.key));
export const NO_URL = new Set(SCHEMA.filter((s) => s.noUrl).map((s) => s.key));

// The first version of the classic crate, before it was matched to the photo.
const BASIC = {
  corner: 18, ribLines: 1, ribHeight: 6, ribDepth: 2.5, ribLineGap: 4, baseBand: 12, rimHeight: 14, rimLines: 0,
  bandSizes: '', ribCount: 3, columns: 1, altBands: false, cornerRibs: 0, pillars: true, pillarWidth: 24,
  holeShape: 'slot', holeWidth: 9, holeGapX: 6, holeGapY: 7, holeMargin: 8, holeRadius: 2,
  handleShape: 'slot', handleLip: false, handleWidth: 110, handleHeight: 32, handleTop: 20, handleRadius: 8,
  logo: false, labelBand: 0, labelWidth: 120, labelHeight: 44, labelZ: 0.42, labelRaise: 1,
  handleTaper: 0, plateClear: false, plateFaces: 'front', centerTopRibs: 0, rimInner: 1.5, footHeight: 8, footWall: 3, footClear: 0.8, wall: 3, floor: 3,
};

// The previous classic, matched to the photo only (before the Grasshopper model was used).
const PHOTO = { width: 330, height: 280, corner: 12, wall: 3, ribHeight: 4, ribLineGap: 5, ribDepth: 2.8, baseBand: 5, rimHeight: 11, rimDepth: 3.5, rimLines: 2, rimInner: 1.5, columns: 3, centerCol: 126, vRibWidth: 3.5, altSize: 8, holeShape: 'rect', holeWidth: 6, holeGapX: 5, holeGapY: 6, holeMargin: 6, handleWidth: 112, handleHeight: 40, handleTop: 27, handleLip: false, handleLipWidth: 3.5, handleRadius: 4, handleRadiusB: 16, labelWidth: 114, labelBand: 2, labelSpan: 2, labelRaise: 3.2, bandSizes: '48q 48 48q 48 28s 28s', cornerRibs: 2, pillarWidth: 34, footHeight: 8, footWall: 3, footClear: 0.8, floor: 3, handleTaper: 0, plateClear: false, plateFaces: 'front', centerTopRibs: 0 };

// Exact proportions of the Grasshopper definition (TNUVA.gh) at 280 mm: 1 unit = 5.09 mm, no openings.
const GH = {
  width: 291, height: 280, corner: 10.2, wall: 1.5, floor: 1.5,
  bandSizes: '3.7 3.7 3.7 5.3 5.3 11.1 11.1 11.1', ribHeight: 1, ribDepth: 3.6, vRibWidth: 1, rimHeight: 1, rimDepth: 3.6, rimLines: 0, rimInner: 0, baseBand: 1,
  columns: 3, centerCol: 134, pillarWidth: 33.3, cornerRibs: 2, centerTopRibs: 2, pillars: false,
  holes: false, floorPattern: 'none',
  handleShape: 'tub', handleWidth: 96, handleHeight: 49, handleTop: 37.4, handleRadius: 12.5, handleRadiusB: 34, handleTaper: 0.04, handleLip: true, handleLipWidth: 1,
  label: true, plateClear: true, plateFaces: 'all', labelBand: 3, labelSpan: 4, labelWidth: 132, labelRaise: 0, logo: false,
  foot: true, footHeight: 3.6, footWall: 1.4, footClear: 0.36,
};

export const PRESETS = [
  { id: 'classic', name: 'Tnuva classic', p: {} },
  { id: 'gh', name: 'Tnuva Grasshopper', p: { ...GH } },
  { id: 'photo', name: 'Tnuva photo', p: { ...PHOTO } },
  { id: 'basic', name: 'Tnuva basic', p: { ...BASIC } },
  { id: 'tall', name: 'Tall bottle crate', p: { ...BASIC, height: 360, ribCount: 4, altBands: false, holeShape: 'rect', holeWidth: 14, holeHeight: 20, holeFill: false, color: '#1E4FA0' } },
  { id: 'hex', name: 'Hex bin', p: { ...BASIC, sides: 6, width: 300, height: 220, corner: 10, columns: 1, altBands: false, ribLines: 1, ribHeight: 6, holeShape: 'hex', holeWidth: 16, holeHeight: 16, holeFill: false, handleFaces: 'pair', logo: false, label: false, floorPattern: 'hex', color: '#F2B705' } },
  { id: 'nest', name: 'Nesting tray', p: { ...BASIC, height: 140, taper: 5, ribCount: 1, foot: false, columns: 1, altBands: false, holeShape: 'slot', holeWidth: 8, handleFaces: 'pair', logo: false, label: false, color: '#E2367E' } },
  { id: 'desk', name: 'Desk organiser', p: { ...PHOTO, scale: 0.3, wall: 5, floor: 5, logoDepth: 0.6, color: '#2AA7E0' } },
  { id: 'stool', name: 'Crate stool', p: { ...PHOTO, cover: true, lidThick: 5, lidLip: false, seat: 'straps', cushion: true, lidRibs: 'radial', lidRibDepth: 10, color: '#2B2F2C' } },
  { id: 'print', name: 'Print kit, ⅓ scale', p: { ...PHOTO, scale: 0.33, wall: 6, floor: 6, ribHeight: 15, ribDepth: 4, baseBand: 20, logoDepth: 0.8, labelRaise: 4.5, printReady: true, sections: 2, cover: true, color: '#E2367E' } },
  { id: 'full', name: 'Full size on a 256 bed', p: { ...PHOTO, ribHeight: 8, printReady: true, sections: 2, vSplit: 'quarters', joint: 'glue' } },
];

// Compact URL hash encoding: only values that differ from defaults (images stay out of the URL).
export function encodeParams(p) {
  const diff = {};
  for (const k in p) if (!NO_URL.has(k) && p[k] !== DEFAULTS[k]) diff[k] = p[k];
  return Object.keys(diff).length ? '#' + new URLSearchParams(Object.entries(diff).map(([k, v]) => [k, String(v)])).toString() : '';
}
export function decodeParams(hash) {
  const out = { ...DEFAULTS };
  if (!hash || hash.length < 2) return out;
  const q = new URLSearchParams(hash.slice(1));
  for (const [k, v] of q) {
    if (!(k in DEFAULTS) || NO_URL.has(k)) continue;
    const d = DEFAULTS[k];
    out[k] = typeof d === 'number' ? (Number.isFinite(+v) ? +v : d) : typeof d === 'boolean' ? v === 'true' : v;
  }
  return out;
}
