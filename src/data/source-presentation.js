// Per-movement presentation matched to Brown's engraving, applied after
// construction by src/simulation/source-presentation.js. `rotate` is an XYZ
// Euler (radians) premultiplied onto the model root, `scale` a model-local
// scale (a mirror when one component is -1), `camera` the initial view
// direction in world coordinates after that rotation, and `remove` the
// userData.role patterns (anchored regular expressions) of parts the plate does
// not show. `note` records what the engraving shows. Re-measure display
// profiles (scripts/measure-display-profiles.mjs ID) after changing an entry.
export default {
  234: {
    rotate: [-Math.PI / 2, 0, 0],
    camera: [2.2, 4.6, 9],
    note: 'Oblique view from above: crown wheel horizontal with its arbor hanging down and verge S across the top; no frame or bearings are drawn. The rim is cut into saw teeth whose slant matches the unmirrored model.',
  },
  309: {
    remove: ['fixed-Mudge-escapement-frame'],
    note: 'Front elevation of the wheel, the two pallet arms from their arbors C and the fork pins P, Q; no clock frame, crossbars or bearing brackets are drawn.',
  },
  312: {
    remove: ['fixed-bloxam-support-frame'],
    note: 'Front elevation of the two wheels and the gravity arms hung from C with fork pins E, F; the trapezoid outline is the arms themselves, and no separate support frame is drawn.',
  },
};
