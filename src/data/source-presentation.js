// Per-movement presentation matched to Brown's engraving, applied after
// construction by src/simulation/source-presentation.js. `rotate` is an XYZ
// Euler (radians) premultiplied onto the model root, `scale` a model-local
// scale (a mirror when one component is -1), `camera` the initial view
// direction in world coordinates after that rotation, and `remove` the
// userData.role patterns (anchored regular expressions; the object name stands
// in for a missing role) of parts the plate does not show. `note` records what the engraving shows. Re-measure display
// profiles (scripts/measure-display-profiles.mjs ID) after changing an entry.
export default {
  86: {
    remove: ['remote(?:BearingStandard|BearingLip|Base|DriveRim|DriveWeb|DriveHub|InputShaft)', 'rearDrive(?:Rim|Web|Hub)', 'rearShaftExtension', 'inputDriveBand'],
    note: 'Front elevation of the loose wheel A on its A-frame standard with catch B, cam C and the overhead stop; no belt drive or second driving pulley is drawn.',
  },
  89: {
    remove: ['bored-crosshead-cheek', 'crosshead-bridge-clear-of-swinging-eye', 'wrist-pin-(?:shank|retaining-head)', 'output-valve-stem', 'fixed-horizontal-crosshead-channel', 'base-rail', 'guide-support-\\d', 'bored-rear-shaft-support'],
    note: 'Front elevation of the sheave, strap and bolted rod flange, the rod broken off to the right; no crosshead, guides or bed are drawn.',
  },
  93: {
    remove: ['guide\\d', 'crossbar\\d', 'post\\d', 'shaftSupport'],
    note: 'Front elevation of the crank disk behind the slotted yoke and its stems; no frame, brackets or stem guides are drawn. Only the production MuJoCo model is presented; the synchronous registry model keeps its reconstructed frame for offline checks.',
  },
  134: {
    remove: ['rear-fixed-pedestal-supporting-drum-axis', 'fixed-foot-of-drum-bearing-pedestal', 'fixed-bearing-behind-drum-hub'],
    note: 'Front elevation of the spoked rope drum with its rim separators, the rope running off along the ground line; no pedestal or bearing is drawn.',
  },
  142: {
    remove: ['rear-post', 'output-guide-rail', 'guide-support-post', 'guide-(?:upper|lower)-bridge', 'base'],
    note: 'Face view of the carrier disk, fixed pinion, planet wheel and crank with the guided slider stem below; no base, pedestal or slider rails are drawn.',
  },
  150: {
    remove: ['fixed-longitudinal-base-rail', 'fixed-transverse-base-tie', 'fixed-camshaft-bearing-post', 'fixed-post-under-right-lever-fulcrum', 'output-guide-(?:-1|1|back|foot)'],
    note: 'The sliding cam series, rocking lever on its right-hand fulcrum and the valve rod; no base, posts or rod guide are drawn.',
  },
  151: {
    remove: ['guide-(?:back|upper|lower)-\\d', 'guide-post-\\d-.*', 'bearing-(?:post|foot)-.*', 'rear-base', 'upper-bearing-(?:arm|rear-tie|post)'],
    note: 'The opposite-hand screw shaft between its end bearings, the two nuts and the upper worm and hand wheel; no base, posts or upright are drawn.',
  },
  156: {
    remove: ['base', 'diskPost', 'pivotPost', 'guidePost', 'guideBack', 'guideRail.*', 'guideBackArm.*', 'guideStandoff.*'],
    note: 'The disk, slotted bell crank, link and output rod; no base, posts or guide rails are drawn.',
  },
  157: {
    remove: ['base', 'diskPost', 'pivotPost', 'guidePost', 'guideBack', 'guideRail.*', 'guideBackArm.*', 'guideStandoff.*'],
    note: 'The disk, rod, bell crank, link and output rod; no base, posts or guide rails are drawn.',
  },
  186: {
    camera: [0.2, 0.15, 1],
    remove: ['fixed-frame-supporting-valve-rockshaft'],
    note: 'The rockshaft, gab lever, eccentric rod and spring loop handle; no frame is drawn.',
  },
  187: {
    camera: [0.2, 0.15, 1],
    remove: ['fixed-frame-supporting-the-valve-rockshaft'],
    note: 'The rockshaft, valve lever, eccentric rod and upper handle; no frame is drawn.',
  },
  188: {
    camera: [0.2, 0.15, 1],
    remove: ['fixed-frame-and-valve-carrier-guide'],
    note: 'The eccentric rod with its loop handle a and leaf spring; no frame or guide is drawn.',
  },
  189: {
    camera: [0.2, 0.15, 1],
    remove: ['fixed-support-frame-behind-source-linkage'],
    note: 'The rockshaft, forked eccentric rod and the bell crank with its vertical rod; no frame is drawn.',
  },
  191: {
    remove: ['rear-fixed-bearing-standard', 'fixed-support-foot'],
    note: 'Face view of the two notched wheels; no standard or foot is drawn.',
  },
  192: {
    remove: ['rear-wheel-bearing-standard', 'fixed-mangle-wheel-support-foot'],
    note: 'Face view of the mangle wheel and its pinion; no standard or foot is drawn.',
  },
  193: {
    remove: ['rear-wheel-bearing-standard', 'fixed-mangle-wheel-support-foot'],
    note: 'Face view of the concentric mangle wheel and its pinion; no standard or foot is drawn.',
  },
  194: {
    remove: ['rear-wheel-bearing-standard', 'fixed-equal-speed-mangle-wheel-support-foot'],
    note: 'Face view of the pin mangle wheel and its pinion; no standard or foot is drawn.',
  },
  201: {
    remove: ['fixed-base-rail', 'fixed-rear-support-post', 'fixed-(?:output-pivot|input-shaft)-bearing-bridge'],
    note: 'The eccentric gears, belt, pulley and the guided rod A; no base, post or bearing bridges are drawn.',
  },
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
