// Movements whose live MuJoCo simulation is baked into a seamless loop.
// Each entry names the baked bundle and builds the same geometry-only visual
// the live factory starts from (its visual.js call), without MuJoCo. The live
// factory in model-loader.js physicsFactories stays for validation and is
// used when the page URL carries ?live (see preferLiveMujoco there).
// Bake or rebake with: node scripts/bake-mujoco-movement.mjs <id>
export const bakedMujocoRoutes = {
  82: {
    asset: () => new URL('./assets/mujoco-082.json.gz', import.meta.url),
    geometry: () => import('../mujoco-treadle/geometry.js').then(m => m.makeTreadleRatchetCandidate({shortFaceFraction: .06})),
  },
  93: {
    asset: () => new URL('./assets/mujoco-093.json.gz', import.meta.url),
    geometry: () => import('../mujoco-scotch-yoke/geometry.js').then(m => m.makeScotchYokeGeometry()),
  },
  83: {
    asset: () => new URL('./assets/mujoco-083.json.gz', import.meta.url),
    geometry: () => import('../mujoco-spring-sector/geometry.js').then(m => m.makeSpringSectorGeometry()),
  },
  90: {
    asset: () => new URL('./assets/mujoco-090.json.gz', import.meta.url),
    geometry: () => import('../mujoco-eccentric-yoke/geometry.js').then(m => m.makeEccentricYokeGeometry()),
  },
  91: {
    asset: () => new URL('./assets/mujoco-091.json.gz', import.meta.url),
    geometry: () => import('../mujoco-triangular-eccentric/geometry.js').then(m => m.makeTriangularEccentricGeometry()),
  },
  92: {
    asset: () => new URL('./assets/mujoco-092.json.gz', import.meta.url),
    geometry: () => import('../mujoco-crank-slider/geometry.js').then(m => m.makeCrankSliderGeometry()),
  },
  94: {
    asset: () => new URL('./assets/mujoco-094.json.gz', import.meta.url),
    geometry: () => import('../mujoco-variable-crank/geometry.js').then(m => m.makeVariableCrankGeometry()),
  },
  95: {
    asset: () => new URL('./assets/mujoco-095.json.gz', import.meta.url),
    geometry: () => import('../mujoco-inclined-disk/geometry.js').then(m => m.makeInclinedDiskGeometry()),
  },
  96: {
    asset: () => new URL('./assets/mujoco-096.json.gz', import.meta.url),
    geometry: () => import('../mujoco-heart-cam/geometry.js').then(m => m.makeHeartCamGeometry()),
  },
  97: {
    asset: () => new URL('./assets/mujoco-097.json.gz', import.meta.url),
    geometry: () => import('../mujoco-grooved-heart/geometry.js').then(m => m.makeGroovedHeartGeometry()),
  },
  98: {
    asset: () => new URL('./assets/mujoco-098.json.gz', import.meta.url),
    geometry: () => import('../mujoco-endless-groove/geometry.js').then(m => m.makeEndlessGrooveGeometry()),
  },
  99: {
    asset: () => new URL('./assets/mujoco-099.json.gz', import.meta.url),
    geometry: () => import('../mujoco-spiral-feed/geometry.js').then(m => m.makeSpiralFeedGeometry()),
  },
  100: {
    asset: () => new URL('./assets/mujoco-100.json.gz', import.meta.url),
    geometry: () => import('../mujoco-quick-return/geometry.js').then(m => m.makeQuickReturnGeometry()),
  },
  101: {
    asset: () => new URL('./assets/mujoco-101.json.gz', import.meta.url),
    geometry: () => import('../mujoco-slotted-bar/geometry.js').then(m => m.makeSlottedBarGeometry()),
  },
  102: {
    asset: () => new URL('./assets/mujoco-102.json.gz', import.meta.url),
    geometry: () => import('../mujoco-screw/geometry.js').then(m => m.makeScrewGeometry()),
    // The section cap follows the nut, as the live sync does.
    sync: (u, qpos) => u.section.update(qpos[0], u.profile.nutBase + qpos[1]),
  },
  103: {
    asset: () => new URL('./assets/mujoco-103.json.gz', import.meta.url),
    geometry: () => import('../mujoco-leadscrew-slide/geometry.js').then(m => m.makeLeadscrewSlideGeometry()),
  },
  104: {
    asset: () => new URL('./assets/mujoco-104.json.gz', import.meta.url),
    geometry: () => Promise.all([import('../mujoco-worm-saddle/geometry.js'), import('../mujoco-worm-saddle/wheel-data.js')])
      .then(([m, data]) => m.makeWormSaddleGeometry(data.saddleWheelCut)),
  },
  105: {
    asset: () => new URL('./assets/mujoco-105.json.gz', import.meta.url),
    geometry: () => import('../mujoco-screw-press/geometry.js').then(m => m.makeScrewPressGeometry()),
  },
  106: {
    asset: () => new URL('./assets/mujoco-106.json.gz', import.meta.url),
    geometry: () => import('../mujoco-barrel-cam/geometry.js').then(m => m.makeBarrelCamGeometry()),
  },
  107: {
    asset: () => new URL('./assets/mujoco-107.json.gz', import.meta.url),
    geometry: () => import('../mujoco-serpentine-cam/geometry.js').then(m => m.makeSerpentineCamGeometry()),
  },
  113: {
    asset: () => new URL('./assets/mujoco-113.json.gz', import.meta.url),
    geometry: () => import('../mujoco-rack-pinion/geometry.js').then(m => m.makeRackPinionGeometry()),
  },
  120: {
    asset: () => new URL('./assets/mujoco-120.json.gz', import.meta.url),
    geometry: () => import('../mujoco-segment-clamp/geometry.js').then(m => m.makeSegmentClampGeometry()),
  },
  108: {
    asset: () => new URL('./assets/mujoco-108.json.gz', import.meta.url),
    // The groove lands are baked offline (baked/reverse-thread-lands.js).
    geometry: () => Promise.all([
      import('../mujoco-reverse-thread/geometry.js'),
      import('./reverse-thread-lands.js').then(m => m.loadReverseThreadLands()),
    ]).then(([m, bakedLands]) => m.makeReverseThreadGeometry({bakedLands})),
  },
  109: {
    asset: () => new URL('./assets/mujoco-109.json.gz', import.meta.url),
    geometry: () => import('../mujoco-thread-cutting/geometry.js').then(m => m.makeThreadCuttingGeometry()),
  },
  110: {
    asset: () => new URL('./assets/mujoco-110.json.gz', import.meta.url),
    geometry: () => import('../mujoco-half-nut/geometry.js').then(m => m.makeHalfNutGeometry()),
  },
  111: {
    asset: () => new URL('./assets/mujoco-111.json.gz', import.meta.url),
    geometry: () => import('../mujoco-micrometer/geometry.js').then(m => m.makeMicrometerGeometry()),
    // The section cap follows the sleeve turn and slide, as the live sync does
    // (it returns at once while the section view is off).
    sync: (u, qpos) => u.section.update(qpos[0], qpos[1]),
  },
  112: {
    asset: () => new URL('./assets/mujoco-112.json.gz', import.meta.url),
    geometry: () => import('../mujoco-persian-drill/geometry.js').then(m => m.makePersianDrillGeometry()),
  },
  114: {
    asset: () => new URL('./assets/mujoco-114.json.gz', import.meta.url),
    geometry: () => import('../mujoco-double-rack/geometry.js').then(m => m.makeDoubleRackGeometry()),
  },
  115: {
    asset: () => new URL('./assets/mujoco-115.json.gz', import.meta.url),
    geometry: () => import('../mujoco-equal-racks/geometry.js').then(m => m.makeEqualRacksGeometry()),
  },
  116: {
    asset: () => new URL('./assets/mujoco-116.json.gz', import.meta.url),
    geometry: () => import('../mujoco-rack-rectifier/geometry.js').then(m => m.makeRackRectifierGeometry()),
  },
  117: {
    asset: () => new URL('./assets/mujoco-117.json.gz', import.meta.url),
    geometry: () => import('../mujoco-roller-yoke/geometry.js').then(m => m.makeRollerYokeGeometry()),
  },
  118: {
    asset: () => new URL('./assets/mujoco-118.json.gz', import.meta.url),
    geometry: () => import('../mujoco-stroke-doubler/geometry.js').then(m => m.makeStrokeDoublerGeometry()),
  },
  119: {
    asset: () => new URL('./assets/mujoco-119.json.gz', import.meta.url),
    geometry: () => import('../mujoco-endless-rack/geometry.js').then(m => m.makeEndlessRackGeometry()),
  },
  121: {
    asset: () => new URL('./assets/mujoco-121.json.gz', import.meta.url),
    geometry: () => import('../mujoco-reversible-click/geometry.js').then(m => m.makeReversibleClickGeometry()),
  },
  122: {
    asset: () => new URL('./assets/mujoco-122.json.gz', import.meta.url),
    geometry: () => import('../mujoco-variable-traverse/geometry.js').then(m => m.makeVariableTraverseGeometry()),
  },
  124: (() => {
    let visual;
    return {
      asset: () => new URL('./assets/mujoco-124.json.gz', import.meta.url),
      geometry: () => import('../mujoco-bow-drill/geometry.js').then(m => (visual = m).makeBowDrillGeometry()),
      // The laid-rope cord is rebuilt from its recorded centreline, as the live sync does.
      sync: (u, qpos, curves) => visual.updateBowDrillCord(u.parts.initialCord, curves['parts.initialCord'], u.profile.cordRadius),
    };
  })(),
  125: {
    asset: () => new URL('./assets/mujoco-125.json.gz', import.meta.url),
    geometry: () => import('../mujoco-cascaded-traverse/geometry.js').then(m => m.makeCascadedTraverseGeometry()),
  },
  126: (() => {
    let updateCord, placeEnds, Vector3;
    return {
      asset: () => new URL('./assets/mujoco-126.json.gz', import.meta.url),
      // visual.js adds the rope ends beyond the crop before building physics.
      geometry: () => Promise.all([import('../mujoco-bell-crank/geometry.js'), import('../mujoco-bell-crank/ends.js'), import('../mujoco-bell-crank/finish.js')]).then(([g, ends, finish]) => {
        const visual = g.makeBellCrankGeometry();
        placeEnds = ends.addBellCrankRopeEnds(visual);updateCord = finish.updateBellCrankCord;Vector3 = g.THREE.Vector3;
        return visual;
      }),
      // Both laid-rope cords and the output lead beyond the crop are rebuilt
      // from the recorded cord centrelines, as the live sync does.
      sync: (u, qpos, curves) => {
        const input = curves['parts.inputCord'], output = curves['parts.outputCord'];
        updateCord(u.parts.inputCord, input, u.profile.cordRadius);updateCord(u.parts.outputCord, output, u.profile.cordRadius);
        placeEnds(new Vector3(...input[0]), new Vector3(...output.at(-1)));
      },
    };
  })(),
};
