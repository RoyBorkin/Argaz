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
  { id: 'ribs', mode: 'crate', label: 'Ribs', help: 'Horizontal ribs stiffen the walls; the real crate uses pairs of thin lines. Openings fill the space between ribs.' },
  { id: 'faces', mode: 'crate', label: 'Faces', help: 'Vertical ribs split each face into columns. An odd number of columns gives a solid centre column for the hand hold and the logo.' },
  { id: 'holes', mode: 'crate', label: 'Holes', help: 'Openings on each face. They stay clear of ribs, pillars, hand holds and the label plate.' },
  { id: 'grips', mode: 'crate', label: 'Grips', help: 'Hand holds cut through the top band. The frame is a raised border around the opening, like on the real crate.' },
  { id: 'logo', mode: 'crate', label: 'Logo', help: 'Type a name or upload a PNG, JPG or SVG. Dark or opaque pixels become the logo. Hebrew text works too.' },
  { id: 'base', mode: 'crate', label: 'Base', help: 'Floor thickness and drainage pattern.' },
  { id: 'stack', mode: 'crate', label: 'Stack', help: 'The top rim carries the load when crates stack. The foot sits inside the rim of the crate below; clearance is the gap that lets it drop in and does not change with scale.' },
  { id: 'lid', mode: 'cover', label: 'Lid', help: 'A cover that sits on the rim. Overhang is measured from the outside of the rim.' },
  { id: 'cstack', mode: 'cover', label: 'Stack', help: 'The skirt locks the cover onto the crate below. The lip on top takes the foot of a crate stacked on the cover, so it stacks from both directions.' },
  { id: 'vents', mode: 'cover', label: 'Vents', help: 'Openings in the cover plate. They stay inside the skirt and the lip.' },
  { id: 'seat', mode: 'cover', label: 'Seat', help: 'Turn the crate into a stool. Straps or ties hold a cushion; the printable frame holds the foam. Export a 1:1 foam cutting template from the Export menu.' },
  { id: 'split', mode: 'print', label: 'Split', help: 'Print-ready adds 45° chamfers under every rib and moves the floor to the bottom of the foot, so every part prints upright without supports. Nothing here changes the crate unless Print-ready is on.' },
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
  { key: 'corner', tab: 'body', label: 'Corner radius', type: 'range', min: 0, max: 80, step: 0.5, unit: 'mm', def: 16 },
  { key: 'wall', tab: 'body', label: 'Wall thickness', type: 'range', min: 1, max: 8, step: 0.1, unit: 'mm', def: 3, hint: 'Injection-moulded crates are usually 2.5 to 3.5 mm' },
  { key: 'taper', tab: 'body', label: 'Draft', type: 'range', min: 0, max: 8, step: 0.1, unit: '°', def: 0, hint: 'Flares walls so crates nest' },
  { key: 'scale', tab: 'body', label: 'Scale', type: 'range', min: 0.1, max: 2, step: 0.01, unit: '×', def: 1 },

  // Ribs
  { key: 'ribCount', tab: 'ribs', label: 'Ribs', type: 'range', min: 0, max: 8, step: 1, unit: '', def: 3 },
  { key: 'ribLines', tab: 'ribs', label: 'Lines per rib', type: 'range', min: 1, max: 3, step: 1, unit: '', def: 2, hint: 'The Tnuva crate uses pairs of thin ribs' },
  { key: 'ribHeight', tab: 'ribs', label: 'Rib band', type: 'range', min: 1, max: 30, step: 0.5, unit: 'mm', def: 12, hint: 'Total height of a rib, all lines included' },
  { key: 'ribLineGap', tab: 'ribs', label: 'Line gap', type: 'range', min: 1, max: 12, step: 0.5, unit: 'mm', def: 4, show: (p) => p.ribLines > 1 || p.rimLines > 0 },
  { key: 'ribDepth', tab: 'ribs', label: 'Rib depth', type: 'range', min: 0, max: 10, step: 0.1, unit: 'mm', def: 2.5, hint: 'How far ribs stand out from the wall' },
  { key: 'ribGrade', tab: 'ribs', label: 'Spacing grade', type: 'range', min: 0.6, max: 1.6, step: 0.01, unit: '', def: 1, hint: '<1 packs ribs toward the top' },
  { key: 'baseBand', tab: 'ribs', label: 'Base band', type: 'range', min: 0, max: 40, step: 0.5, unit: 'mm', def: 14 },

  // Faces
  { key: 'altBands', tab: 'faces', label: 'Alternate bands', type: 'toggle', half: true, def: true, hint: 'Every other band gets a grid of small openings, starting at the top' },
  { key: 'columns', tab: 'faces', label: 'Columns', type: 'range', min: 1, max: 7, step: 1, unit: '', def: 3 },
  { key: 'centerCol', tab: 'faces', label: 'Centre column', type: 'range', min: 0, max: 260, step: 1, unit: 'mm', def: 128, show: (p) => p.columns > 1 && p.columns % 2 === 1, hint: '0 makes all columns equal' },
  { key: 'vRibWidth', tab: 'faces', label: 'Vertical rib', type: 'range', min: 1.5, max: 12, step: 0.5, unit: 'mm', def: 4, show: (p) => p.columns > 1 },
  { key: 'altShape', tab: 'faces', label: 'Band openings', type: 'segment', options: [['rect', 'Square'], ['circle', 'Round'], ['hex', 'Hex'], ['diamond', 'Diamond']], def: 'rect', show: showIf('altBands') },
  { key: 'altSize', tab: 'faces', label: 'Opening size', type: 'range', min: 3, max: 30, step: 0.5, unit: 'mm', def: 10, show: showIf('altBands') },

  // Holes
  { key: 'holes', tab: 'holes', label: 'Openings', type: 'toggle', half: true, def: true },
  { key: 'holeFill', tab: 'holes', label: 'Fill bands', type: 'toggle', half: true, def: true, show: showIf('holes'), hint: 'On: openings stretch to fill each band. Off: they keep the exact height you set' },
  { key: 'holeShape', tab: 'holes', label: 'Shape', type: 'segment', options: [['slot', 'Slot'], ['rect', 'Square'], ['circle', 'Round'], ['hex', 'Hex'], ['diamond', 'Diamond']], def: 'slot', show: showIf('holes') },
  { key: 'holeWidth', tab: 'holes', label: 'Opening width', type: 'range', min: 3, max: 60, step: 0.5, unit: 'mm', def: 8, show: showIf('holes') },
  { key: 'holeHeight', tab: 'holes', label: 'Opening height', type: 'range', min: 3, max: 120, step: 0.5, unit: 'mm', def: 36, show: showIf('holes') },
  { key: 'holeGapX', tab: 'holes', label: 'Bar width', type: 'range', min: 2, max: 30, step: 0.5, unit: 'mm', def: 5, show: showIf('holes'), hint: 'Solid plastic left between neighbouring openings' },
  { key: 'holeGapY', tab: 'holes', label: 'Row gap', type: 'range', min: 2, max: 30, step: 0.5, unit: 'mm', def: 6, show: showIf('holes') },
  { key: 'holeMargin', tab: 'holes', label: 'Edge margin', type: 'range', min: 2, max: 40, step: 0.5, unit: 'mm', def: 7, show: showIf('holes') },
  { key: 'holeRadius', tab: null, def: 1.5 },

  // Grips
  { key: 'handles', tab: 'grips', label: 'Hand holds', type: 'toggle', half: true, def: true },
  { key: 'handleLip', tab: 'grips', label: 'Frame', type: 'toggle', half: true, def: true, show: showIf('handles') },
  { key: 'handleFaces', tab: 'grips', label: 'On faces', type: 'segment', options: [['all', 'All'], ['pair', 'Opposite'], ['front', 'Front']], def: 'all', show: showIf('handles') },
  { key: 'handleShape', tab: 'grips', label: 'Shape', type: 'segment', options: [['rect', 'Rounded'], ['slot', 'Slot']], def: 'rect', show: showIf('handles') },
  { key: 'handleWidth', tab: 'grips', label: 'Grip width', type: 'range', min: 40, max: 200, step: 1, unit: 'mm', def: 110, show: showIf('handles') },
  { key: 'handleHeight', tab: 'grips', label: 'Grip height', type: 'range', min: 15, max: 60, step: 0.5, unit: 'mm', def: 30, show: showIf('handles') },
  { key: 'handleTop', tab: 'grips', label: 'From top', type: 'range', min: 6, max: 80, step: 0.5, unit: 'mm', def: 24, show: showIf('handles') },
  { key: 'handleRadius', tab: 'grips', label: 'Corner radius', type: 'range', min: 0, max: 20, step: 0.5, unit: 'mm', def: 7, show: (p) => p.handles && p.handleShape === 'rect' },
  { key: 'handleLipWidth', tab: null, def: 3.5 },

  // Logo + label plate
  { key: 'logo', tab: 'logo', label: 'Logo', type: 'toggle', half: true, def: true },
  { key: 'label', tab: 'logo', label: 'Label plate', type: 'toggle', half: true, def: true, hint: 'A raised panel behind the logo' },
  { key: 'logoSource', tab: 'logo', label: 'Source', type: 'segment', options: [['text', 'Text'], ['image', 'Image']], def: 'text', show: showIf('logo') },
  { key: 'logoText', tab: 'logo', label: 'Text', type: 'text', def: 'TNUVA', show: (p) => p.logo && p.logoSource === 'text', placeholder: 'Type a name' },
  { key: 'logoImage', tab: 'logo', label: 'Image', type: 'file', accept: 'image/png,image/jpeg,image/svg+xml,image/webp', def: '', show: (p) => p.logo && p.logoSource === 'image', noUrl: true },
  { key: 'logoStyle', tab: 'logo', label: 'Style', type: 'segment', options: [['emboss', 'Raised'], ['engrave', 'Engraved'], ['cut', 'Cut through']], def: 'emboss', show: showIf('logo') },
  { key: 'logoDepth', tab: 'logo', label: 'Depth', type: 'range', min: 0.2, max: 4, step: 0.1, unit: 'mm', def: 1, show: (p) => p.logo && p.logoStyle !== 'cut', hint: 'Real millimetres: stays the same at any scale' },
  { key: 'logoFaces', tab: 'logo', label: 'On faces', type: 'segment', options: [['front', 'Front'], ['pair', 'Opposite'], ['all', 'All']], def: 'pair', show: showIf('logo') },
  { key: 'labelWidth', tab: 'logo', label: 'Plate width', type: 'range', min: 30, max: 260, step: 1, unit: 'mm', def: 116, show: (p) => p.label || p.logo },
  { key: 'labelHeight', tab: 'logo', label: 'Plate height', type: 'range', min: 15, max: 160, step: 1, unit: 'mm', def: 40, show: (p) => p.label || p.logo },
  { key: 'logoFont', tab: null, def: 'sans' },
  { key: 'labelZ', tab: null, def: 0.6 },
  { key: 'labelRaise', tab: null, def: 1 },

  // Base
  { key: 'floor', tab: 'base', label: 'Floor thickness', type: 'range', min: 1, max: 10, step: 0.1, unit: 'mm', def: 3 },
  { key: 'floorPattern', tab: 'base', label: 'Floor', type: 'segment', options: [['none', 'Solid'], ['grid', 'Grid'], ['slots', 'Slots'], ['hex', 'Hex']], def: 'grid' },
  { key: 'floorHole', tab: 'base', label: 'Opening size', type: 'range', min: 3, max: 40, step: 0.5, unit: 'mm', def: 12, show: (p) => p.floorPattern !== 'none' },
  { key: 'floorSlotLen', tab: 'base', label: 'Slot length', type: 'range', min: 10, max: 120, step: 1, unit: 'mm', def: 40, show: (p) => p.floorPattern === 'slots' },
  { key: 'floorGap', tab: 'base', label: 'Bar width', type: 'range', min: 2, max: 20, step: 0.5, unit: 'mm', def: 5, show: (p) => p.floorPattern !== 'none' },
  { key: 'floorMargin', tab: 'base', label: 'Floor margin', type: 'range', min: 2, max: 60, step: 0.5, unit: 'mm', def: 12, show: (p) => p.floorPattern !== 'none' },

  // Stack: rim, pillars, foot
  { key: 'rimHeight', tab: 'stack', label: 'Top rim', type: 'range', min: 2, max: 40, step: 0.5, unit: 'mm', def: 14 },
  { key: 'rimDepth', tab: 'stack', label: 'Rim depth', type: 'range', min: 0, max: 12, step: 0.1, unit: 'mm', def: 3.5 },
  { key: 'rimLines', tab: 'stack', label: 'Lines under rim', type: 'range', min: 0, max: 3, step: 1, unit: '', def: 1 },
  { key: 'pillars', tab: 'stack', label: 'Corner pillars', type: 'toggle', half: true, def: true },
  { key: 'foot', tab: 'stack', label: 'Stacking foot', type: 'toggle', half: true, def: true, hint: 'Locks into the crate below' },
  { key: 'pillarWidth', tab: 'stack', label: 'Pillar width', type: 'range', min: 4, max: 80, step: 0.5, unit: 'mm', def: 22, show: showIf('pillars') },
  { key: 'footHeight', tab: 'stack', label: 'Foot height', type: 'range', min: 2, max: 30, step: 0.5, unit: 'mm', def: 8, show: showIf('foot') },
  { key: 'footClear', tab: 'stack', label: 'Fit clearance', type: 'range', min: 0, max: 4, step: 0.05, unit: 'mm', def: 0.8, show: showIf('foot') },
  { key: 'pillarDepth', tab: null, def: 2.5 },
  { key: 'rimInner', tab: null, def: 1.5 },
  { key: 'footWall', tab: null, def: 3 },

  // View popover (preview only, no rebuild)
  { key: 'color', tab: 'view', label: 'Colour', type: 'swatches', options: ['#295B2E', '#1E4FA0', '#2AA7E0', '#E2367E', '#2B2F2C', '#E8E6DF', '#F2B705'], def: '#295B2E', live: true },
  { key: 'mixColors', tab: 'view', label: 'Mixed colours', type: 'toggle', half: true, def: false, live: true, hint: 'Each crate in the stack gets a different colour' },
  { key: 'shuffle', tab: 'view', label: 'Shuffle', type: 'action', half: true, show: showIf('mixColors') },
  { key: 'colorSeed', tab: null, def: 1, live: true },
  { key: 'gloss', tab: 'view', label: 'Gloss', type: 'range', min: 0, max: 1, step: 0.01, unit: '', def: 0.35, live: true },
  { key: 'stack', tab: 'view', label: 'Stack preview', type: 'range', min: 1, max: 5, step: 1, unit: '', def: 1, live: true },
  { key: 'explode', tab: ['view', 'split'], label: 'Exploded view', type: 'range', min: 0, max: 1, step: 0.01, unit: '', def: 0, live: true },
  { key: 'section', tab: 'view', label: 'Section cut', type: 'toggle', half: true, def: false, live: true },
  { key: 'dims', tab: 'view', label: 'Dimensions', type: 'toggle', half: true, def: true, live: true },

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
  corner: 18, ribLines: 1, ribHeight: 6, baseBand: 12, rimLines: 0, columns: 1, altBands: false,
  holeWidth: 9, holeGapX: 6, holeGapY: 7, holeMargin: 8, holeRadius: 2,
  handleShape: 'slot', handleLip: false, handleHeight: 32, handleTop: 20, handleRadius: 8,
  logo: false, labelWidth: 120, labelHeight: 44, labelZ: 0.42, pillarWidth: 24,
};

export const PRESETS = [
  { id: 'classic', name: 'Tnuva classic', p: {} },
  { id: 'basic', name: 'Tnuva basic', p: { ...BASIC } },
  { id: 'tall', name: 'Tall bottle crate', p: { height: 360, ribCount: 4, altBands: false, holeShape: 'rect', holeWidth: 14, holeHeight: 20, holeFill: false, color: '#1E4FA0' } },
  { id: 'hex', name: 'Hex bin', p: { sides: 6, width: 300, height: 220, corner: 10, columns: 1, altBands: false, ribLines: 1, ribHeight: 6, holeShape: 'hex', holeWidth: 16, holeHeight: 16, holeFill: false, handleFaces: 'pair', logo: false, label: false, floorPattern: 'hex', color: '#F2B705' } },
  { id: 'nest', name: 'Nesting tray', p: { height: 140, taper: 5, ribCount: 1, foot: false, columns: 1, altBands: false, holeShape: 'slot', holeWidth: 8, handleFaces: 'pair', logo: false, label: false, color: '#E2367E' } },
  { id: 'desk', name: 'Desk organiser', p: { scale: 0.3, wall: 5, floor: 5, logoDepth: 0.6, color: '#2AA7E0' } },
  { id: 'stool', name: 'Crate stool', p: { cover: true, lidThick: 5, lidLip: false, seat: 'straps', cushion: true, lidRibs: 'radial', lidRibDepth: 10, color: '#2B2F2C' } },
  { id: 'print', name: 'Print kit, ⅓ scale', p: { scale: 0.33, wall: 6, floor: 6, ribHeight: 18, ribDepth: 4, baseBand: 20, logoDepth: 0.8, printReady: true, sections: 2, cover: true, color: '#E2367E' } },
  { id: 'full', name: 'Full size on a 256 bed', p: { printReady: true, sections: 2, vSplit: 'quarters', joint: 'glue' } },
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
