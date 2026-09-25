import * as THREE from 'three';
import {
  FULL_TURN, capsule, cylinderAlongZ, smootherstepLaw, circle, poly, plate, polygonClipping, PALETTE, markShadows, matte,
  eccentricRodEnd, eccentricRodPose, gabRodFrame,
} from './gab-disengager-shared.js';

// Brown 187 ("Modifications of 186"): a two-handle gab disengager.
//
// Reading of the plate (525-pixel raster, y down):
// - valve arm: rockshaft boss (313,111) r 35 with the hatched shaft r 18, a
//   tapered neck, and a round lower eye r 45.5 about the gab pin (313,237.5)
//   r 16; the eye shows below the rod.
// - eccentric rod: broken-off left end at x 15 (modelled whole), bar y 224.5-258, a round crown
//   r 56 concentric with the gab, the gab slot cut up from the lower edge, and
//   the LOWER handle forged on it out to x 511.
// - upper handle: pivoted on the small pin (319,198) in the crown; its cam lies
//   behind the crown (Brown's dashed arc) and bears on the top of the gab pin.
//
// The grips are only ~32 px apart, so squeezing them turns the upper handle
// about 10 degrees, which cannot lift the gab its 37-px depth. The model
// therefore raises the upper grip (as 186's handle is pulled up) while the
// lower grip steadies the rod: the cam's spiral lobe, hidden behind the crown,
// rolls onto the pin top and pries the rod up until the gab clears the pin.
// The cam outline is the envelope of the pin in the handle frame, so it
// touches the pin throughout the lift without penetrating it.
//
// Brown draws no frame. Beyond the view the rod runs on to its strap round
// the eccentric; the eccentric shaft and the rockshaft turn in bearings on
// plain floor-standing columns (the rockshaft's hidden behind the valve arm).
// Lifted, the rod turns about the stopped sheave, so the pin's place in the
// rod frame (and hence the cam envelope) includes that small turn.
export function twoHandleGabDisengager() {
  const root = new THREE.Group();
  const s = 0.018; // model units per source pixel
  const PIN_RASTER = [313, 237.5];
  const P = (x, y) => [(x - PIN_RASTER[0]) * s, (PIN_RASTER[1] - y) * s];
  const toRaster = (p) => [PIN_RASTER[0] + p[0] / s, PIN_RASTER[1] - p[1] / s];

  const shaftCenter = P(313, 111);
  const armLength = shaftCenter[1];
  const bossRadius = 35 * s, shaftRadius = 18 * s;
  const eyeRadius = 45.5 * s;
  const pinRadius = 16 * s;
  const slotHalfWidth = pinRadius + 0.004;
  const pivotRest = P(319, 198);
  const pivotRadius = 5 * s;
  const boreClearance = 0.002;
  const rodBottomY = P(0, 258)[1];
  const crownRadius = 56 * s;
  const eccentricThrow = 12 * s; // horizontal half-stroke of the gab
  const maximumLift = 40 * s; // gab depth 36.8 px plus ~3 px clearance
  const maximumHandleAngle = THREE.MathUtils.degToRad(35);
  const camClearance = 0.0002; // above the 96-gon sag of the swept pin circles
  const rodLength = 16; // gab to the off-plate eccentric strap centre
  const strapLocal = [-rodLength, P(0, 241.25)[1]];
  const rodPose = eccentricRodPose(strapLocal);
  const zWall = -0.8;

  // Depth layers, front (+z) to back.
  const Z = {
    rod: [0.09, 0.33], handle: [-0.09, 0.07], arm: [-0.40, -0.13],
  };

  // ---------------------------------------------------------------- timing
  const cyclePeriod = 16;
  const runHalf = 4.75; // engaged running spans -4.75 .. +4.75 s about t = 0
  const runRamp = 1.75;
  const runTurns = 2; // even, so the eccentric stops where it started (sheave on top)
  const lift = {start: 5.25, end: 7.25};
  const lower = {start: 9.0, end: 11.0};
  const runProfile = (() => {
    // velocity shape: smootherstep ramps up/down, flat between
    const D = runHalf * 2;
    const shape = (u) => {
      if (u <= 0 || u >= D) return 0;
      if (u < runRamp) return smootherstepLaw(u / runRamp).value;
      if (u > D - runRamp) return smootherstepLaw((D - u) / runRamp).value;
      return 1;
    };
    // area of one smootherstep ramp is runRamp / 2
    const area = D - runRamp;
    const peak = runTurns * FULL_TURN / area;
    const integral = (u) => {
      const ramp = (x) => { // integral of smootherstep from 0..x (normalized)
        const n = x / runRamp;
        return runRamp * (n ** 6 - 3 * n ** 5 + 2.5 * n ** 4);
      };
      if (u <= 0) return 0;
      if (u <= runRamp) return ramp(u);
      if (u <= D - runRamp) return runRamp / 2 + (u - runRamp);
      if (u < D) return area - ramp(D - u);
      return area;
    };
    return {
      angle: (u) => peak * (integral(u) - area / 2),
      rate: (u) => peak * shape(u),
      peak,
    };
  })();

  const inputAt = (time) => {
    const t = THREE.MathUtils.euclideanModulo(time, cyclePeriod);
    const u = (t < cyclePeriod / 2 ? t : t - cyclePeriod) + runHalf;
    if (u >= 0 && u <= 2 * runHalf) return {angle: runProfile.angle(u), rate: runProfile.rate(u)};
    return {angle: runProfile.angle(2 * runHalf), rate: 0};
  };
  const handleAt = (time) => {
    const t = THREE.MathUtils.euclideanModulo(time, cyclePeriod);
    const seg = (a, b, from, to) => {
      const d = b - a, law = smootherstepLaw(THREE.MathUtils.clamp((t - a) / d, 0, 1));
      return {fraction: from + (to - from) * law.value, rate: (to - from) * law.firstDerivative / d};
    };
    if (t < lift.start || t >= lower.end) return {fraction: 0, rate: 0};
    if (t < lift.end) return seg(lift.start, lift.end, 0, 1);
    if (t < lower.start) return {fraction: 1, rate: 0};
    return seg(lower.start, lower.end, 1, 0);
  };
  const stageAt = (time) => {
    const t = THREE.MathUtils.euclideanModulo(time, cyclePeriod);
    if (t < runHalf - runRamp || t >= cyclePeriod - runHalf + runRamp) return 'engaged-eccentric-rod-driving-valve-arm';
    if (t < runHalf) return 'eccentric-slowing-to-stop-at-mid-stroke';
    if (t < lift.start) return 'stopped-with-gab-on-pin';
    if (t < lift.end) return 'raising-upper-handle-cam-lifting-gab-off-pin';
    if (t < lower.start) return 'gab-held-clear-of-pin';
    if (t < lower.end) return 'lowering-upper-handle-gab-dropping-onto-pin';
    if (t < cyclePeriod - runHalf) return 'gab-reseated-on-pin';
    return 'eccentric-starting-with-gab-engaged';
  };

  // The cam is designed for a lift proportional to handle angle; the lift
  // actually used is re-solved from the finished (trimmed) cam outline.
  const designLift = (psi) => maximumLift * psi / maximumHandleAngle;
  // Pin centre in the upper-handle frame (origin at its pivot) for a rod lift L.
  const pinInHandleFrame = (psi, L = liftAtHandleAngle(psi)) => {
    const pinInRod = rodPose.pinInRodLifted(L).pin;
    const v = [pinInRod[0] - pivotRest[0], pinInRod[1] - pivotRest[1]];
    const c = Math.cos(-psi), sn = Math.sin(-psi);
    return [c * v[0] - sn * v[1], sn * v[0] + c * v[1]];
  };

  // ------------------------------------------------------------ geometry
  const raster = (points) => points.map(([x, y]) => P(x, y));
  // Brown breaks the rod off at the left (a drawing convention); it runs on
  // whole toward its eccentric, past the view.
  const rodBar = poly(raster([[-300, 224.5], [262, 224.5], [262, 258], [-300, 258]]));
  const crown = polygonClipping.intersection(poly(circle([0, 0], crownRadius, 160)),
    poly([[-2, rodBottomY], [2, rodBottomY], [2, 2], [-2, 2]]));
  const lowerHandle = poly(raster([
    [330, 200], [355, 200], [362, 211], [370, 219], [380, 226], [392, 232], [405, 235.5], [450, 237.5],
    [495, 238.5], [504, 240.5], [510, 246], [509, 253], [503, 258], [330, 258],
  ]));
  const rodFilled = polygonClipping.union(rodBar, crown, lowerHandle);
  const slot = polygonClipping.union(
    poly([[-slotHalfWidth, 0], [slotHalfWidth, 0], [slotHalfWidth, rodBottomY - 0.05], [-slotHalfWidth, rodBottomY - 0.05]]),
    poly(circle([0, 0], slotHalfWidth, 96)),
  );
  const rodShape = polygonClipping.difference(rodFilled, slot,
    poly(circle(pivotRest, pivotRadius + boreClearance, 48)));

  // Upper handle: the traced visible body and grip ...
  const handleRasterOutline = [
    [271, 174], [360, 174], [368, 177], [378, 182], [390, 186], [480, 187], [495, 188], [503, 192],
    [505, 198], [501, 204], [490, 206.5], [420, 207], [400, 209], [385, 213], [372, 217], [360, 220],
    [345, 223], [330, 224], [313, 224], [298, 218], [287, 210], [280, 203], [274, 193], [271, 184],
  ];
  const toHandle = ([x, y]) => [x - pivotRest[0], y - pivotRest[1]];
  const rotate = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  const handleBody = poly(raster(handleRasterOutline).map(toHandle));
  // ... plus a spiral lobe hidden behind the rod, trimmed so that at every
  // handle angle it stays behind the rod (or inside the open gab over the pin).
  const shrink = 1.2 * s;
  const rodCover = polygonClipping.union(
    polygonClipping.intersection(rodFilled, poly(circle([0, 0], crownRadius - shrink, 160))),
    poly(raster([[262, 225.7], [330, 225.7], [330, 256.8], [262, 256.8]])),
    poly([[-slotHalfWidth, 0], [slotHalfWidth, 0], [slotHalfWidth, rodBottomY - 7 * s], [-slotHalfWidth, rodBottomY - 7 * s]]),
  );
  let lobe = polygonClipping.intersection(
    poly(circle([0, 0], 74 * s, 160)),
    poly([[-80 * s, -57 * s], [0, -57 * s], [0, 0], [-80 * s, 0]]),
  );
  for (let i = 0; i <= 12; i++) {
    const psi = maximumHandleAngle * i / 12;
    const cover = rodCover.map((polygon) => polygon.map((ring) => ring.map(([x, y]) => rotate(
      [x - pivotRest[0], y - pivotRest[1]], -psi))));
    lobe = polygonClipping.intersection(lobe, cover);
  }
  const sweep = [];
  for (let i = 0; i <= 160; i++) sweep.push(poly(circle(pinInHandleFrame(maximumHandleAngle * i / 160,
    designLift(maximumHandleAngle * i / 160)), pinRadius + camClearance, 96)));
  let handleShape = polygonClipping.difference(polygonClipping.union(handleBody, lobe),
    polygonClipping.union(...sweep), poly(circle([0, 0], pivotRadius + boreClearance, 48)));
  // keep the connected handle body only
  handleShape = [handleShape.reduce((best, p) => (ringArea(p[0]) > ringArea(best[0]) ? p : best))];
  const camEdges = [];
  for (const ring of handleShape[0]) for (let i = 0; i + 1 < ring.length; i++) camEdges.push([ring[i], ring[i + 1]]);
  const camDistance = (psi, L) => {
    const c = pinInHandleFrame(psi, L);
    let best = Infinity;
    for (const [a, b] of camEdges) best = Math.min(best, segmentDistance(c, a, b));
    return best - pinRadius;
  };
  // Rod lift at which the cam just touches the pin (bisection), never below
  // the seated gab (L = 0, the slot crown resting on the pin).
  const liftSamples = 240;
  const liftTable = Array.from({length: liftSamples + 1}, (_, i) => {
    const psi = maximumHandleAngle * i / liftSamples;
    if (camDistance(psi, 0) >= 0) return 0;
    let lo = 0, hi = designLift(psi) + 0.02;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (camDistance(psi, mid) < 0) lo = mid; else hi = mid;
    }
    return hi;
  });
  // The solved table carries ~5e-5 facet noise from the polygonal cam; a
  // Catmull-Rom spline through every fifth sample (+3e-4 so the cam never
  // bites) keeps the lift smooth; the cam stands off at most ~5e-4.
  const knotStep = 5, knots = liftSamples / knotStep, liftMargin = 3e-4;
  const knot = (j) => {
    const k = THREE.MathUtils.clamp(j, 0, knots);
    return k === 0 ? 0 : liftTable[k * knotStep] + liftMargin;
  };
  function liftAtHandleAngle(psi) {
    const x = THREE.MathUtils.clamp(psi / maximumHandleAngle, 0, 1) * knots;
    const i = Math.min(Math.floor(x), knots - 1), f = x - i;
    const m0 = i === 0 ? knot(1) - knot(0) : (knot(i + 1) - knot(i - 1)) / 2;
    const m1 = i + 1 === knots ? knot(knots) - knot(knots - 1) : (knot(i + 2) - knot(i)) / 2;
    const f2 = f * f, f3 = f2 * f;
    return (2 * f3 - 3 * f2 + 1) * knot(i) + (f3 - 2 * f2 + f) * m0 + (-2 * f3 + 3 * f2) * knot(i + 1) + (f3 - f2) * m1;
  }
  const camGapAt = (psi) => camDistance(psi, liftAtHandleAngle(psi));

  // Valve arm (arm frame: origin at the rockshaft, pin at (0, -armLength)).
  const pinLocal = [0, -armLength];
  const armShape = polygonClipping.difference(polygonClipping.union(
    poly(circle([0, 0], bossRadius, 128)),
    poly(circle(pinLocal, eyeRadius, 128)),
    poly([[-18.5 * s, -30 * s], [17.5 * s, -30 * s], [23 * s, -95 * s], [-24 * s, -95 * s]]),
  ), poly(circle([0, 0], shaftRadius + boreClearance, 96)),
  poly(circle(pinLocal, pinRadius + boreClearance, 96)));

  // ------------------------------------------------------------ meshes
  const rodMaterial = matte(PALETTE.driver, {metalness: 0.13, roughness: 0.58});
  const armMaterial = matte(PALETTE.driven, {metalness: 0.15, roughness: 0.58});
  const handleMaterial = matte(PALETTE.accent, {metalness: 0.19, roughness: 0.51});
  const pinMaterial = matte(PALETTE.brass, {metalness: 0.24, roughness: 0.47});
  const darkMaterial = matte(PALETTE.ink, {metalness: 0.28, roughness: 0.44});

  const valveRocker = new THREE.Group();
  valveRocker.position.set(shaftCenter[0], shaftCenter[1], 0);
  valveRocker.userData.role = 'valve-arm-on-rockshaft-carrying-gab-pin';
  const valveArm = new THREE.Mesh(plate(armShape, Z.arm[0], Z.arm[1]), armMaterial);
  valveArm.userData.role = 'valve-arm-with-rockshaft-boss-neck-and-round-pin-eye';
  const shaftMaterial = matte(PALETTE.muted, {metalness: 0.2, roughness: 0.6});
  // Front face flush (Brown's hatched section); it runs back into its bearing.
  const valveShaft = cylinderAlongZ(shaftRadius, Z.arm[1] - 0.001 - (zWall + 0.01), shaftMaterial, 48);
  valveShaft.position.z = (Z.arm[1] - 0.001 + zWall + 0.01) / 2;
  valveShaft.userData.role = 'sectioned-valve-rockshaft';
  // Brown hatches the cut rockshaft; the model shows its plain steel end.
  const valvePinLength = Z.rod[1] - Z.arm[0] - 0.002;
  const valvePin = cylinderAlongZ(pinRadius, valvePinLength, pinMaterial, 64);
  valvePin.position.set(pinLocal[0], pinLocal[1], Z.arm[0] + valvePinLength / 2);
  valvePin.userData.role = 'gab-pin-on-valve-arm';
  valveRocker.add(valveArm, valveShaft, valvePin);

  const eccentricRod = new THREE.Group();
  eccentricRod.userData.role = 'eccentric-rod-with-crown-gab-and-integral-lower-handle';
  // Brown's forked strap end: two engraved lines along the rod end mark the
  // seams where the strap meets the rod. The front 0.012 of the rod is a
  // skin with those seams cut through it as fine grooves (real joints, not
  // ink strokes painted on the face).
  const seamDepth = 0.012;
  const rodBody = new THREE.Mesh(plate(rodShape, Z.rod[0], Z.rod[1] - seamDepth), rodMaterial);
  rodBody.userData.role = 'eccentric-rod-crown-gab-slot-and-lower-handle';
  const forkLines = polygonClipping.union(...[
    [[29.5, 226], [29.5, 256]],
    [[31, 233.5], [100, 233.5], [106, 230], [111, 225.5]],
    [[33, 246], [97, 246], [104, 250], [110, 256.5]],
  ].flatMap((line) => line.slice(1).map((b, i) => capsule(P(...line[i]), P(...b), 0.6 * s, 8))));
  const rodForkLines = new THREE.Mesh(plate(polygonClipping.difference(rodShape, forkLines),
    Z.rod[1] - seamDepth, Z.rod[1]), rodMaterial);
  rodForkLines.userData.role = 'eccentric-rod-front-skin-with-forked-strap-seams';
  const pivotLength = Z.rod[1] - Z.handle[0] - 0.002;
  const pivotPin = cylinderAlongZ(pivotRadius, pivotLength, darkMaterial, 32);
  pivotPin.position.set(pivotRest[0], pivotRest[1], Z.handle[0] + 0.001 + pivotLength / 2);
  pivotPin.userData.role = 'upper-handle-pivot-pin-in-rod-crown';
  const upperHandle = new THREE.Group();
  upperHandle.position.set(pivotRest[0], pivotRest[1], 0);
  upperHandle.userData.role = 'upper-cam-handle';
  const upperHandleBody = new THREE.Mesh(plate(handleShape, Z.handle[0], Z.handle[1]), handleMaterial);
  upperHandleBody.userData.role = 'upper-handle-grip-and-spiral-cam-behind-crown';
  upperHandle.add(upperHandleBody);
  const eccentric = eccentricRodEnd({
    strapLocal, restGab: [0, 0], throw: eccentricThrow, fromX: P(-300, 0)[0] + 0.05, halfHeight: 16.75 * s,
    z: Z.rod, rodMaterial, sheaveMaterial: shaftMaterial, shaftBack: zWall + 0.01,
  });
  eccentricRod.add(rodBody, rodForkLines, pivotPin, upperHandle, eccentric.strap);
  root.add(valveRocker, eccentricRod);

  // Plate-square camera envelope (x 0-525, y 40-300 raster).
  const envelopeMin = P(0, 300), envelopeMax = P(525, 40);
  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(envelopeMax[0] - envelopeMin[0], envelopeMax[1] - envelopeMin[1], 0.8),
    new THREE.MeshBasicMaterial({colorWrite: false, depthWrite: false, transparent: true, opacity: 0}),
  );
  cameraEnvelope.position.set((envelopeMin[0] + envelopeMax[0]) / 2, (envelopeMin[1] + envelopeMax[1]) / 2, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.role = 'invisible-camera-envelope';
  root.add(cameraEnvelope);

  // ------------------------------------------------------------ state
  const stateAtTime = (time) => {
    const input = inputAt(time);
    const handle = handleAt(time);
    const handleAngle = maximumHandleAngle * handle.fraction;
    const gabLift = liftAtHandleAngle(handleAngle);
    const armAngle = Math.asin(eccentricThrow * Math.sin(input.angle) / armLength);
    const armRate = eccentricThrow * Math.cos(input.angle) * input.rate / (armLength * Math.cos(armAngle));
    const pin = [shaftCenter[0] + armLength * Math.sin(armAngle), shaftCenter[1] - armLength * Math.cos(armAngle)];
    // Engaged, the gab rides the pin and the rod turns about it to keep its
    // strap on the sheave; lifted, the eccentric is stopped with the arm plumb
    // and the rod turns about the sheave centre.
    const sheaveCentre = eccentric.centre(input.angle);
    const rodAngle = rodPose.angleFor(pin[1] + gabLift, sheaveCentre);
    const rodOffset = [gabLift > 0 ? rodPose.gabXAbout(sheaveCentre, rodAngle) : pin[0], pin[1] + gabLift];
    const cosine = Math.cos(rodAngle), sine = Math.sin(rodAngle);
    const relative = [pin[0] - rodOffset[0], pin[1] - rodOffset[1]];
    const pinInGab = [cosine * relative[0] + sine * relative[1], -sine * relative[0] + cosine * relative[1]];
    const pinTop = pinInGab[1] + pinRadius;
    return {
      time, stage: stageAt(time), inputAngle: input.angle, inputRate: input.rate,
      armAngle, armRate, handleAngle, handleRate: maximumHandleAngle * handle.rate, gabLift,
      rodOffset, rodAngle, pin, pinInGab,
      gabEngaged: gabLift === 0,
      gabClearance: rodBottomY - pinTop, // > 0 once the slot's mouth is above the pin
      camGap: camGapAt(handleAngle),
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    valveRocker.rotation.z = state.armAngle;
    eccentricRod.position.set(state.rodOffset[0], state.rodOffset[1], 0);
    eccentricRod.rotation.z = state.rodAngle;
    eccentric.setAngle(state.inputAngle);
    upperHandle.rotation.z = state.handleAngle;
    root.userData.kinematics = state;
  };

  root.userData.fidelity = 'authored';
  root.userData.mechanism = 'rod-integral-lower-grip-and-raised-upper-handle-spiral-cam-prying-gab-up-off-valve-pin';
  root.userData.archetype = 'two-handle-cam-lifted-eccentric-rod-gab-pin-release';
  root.userData.hideGround = true;
  root.userData.animationTiming = {authoredCyclePeriod: cyclePeriod};
  root.userData.minimumDisplayCycleSeconds = cyclePeriod;
  root.userData.stateAtTime = stateAtTime;
  root.userData.sourcePointFromRaster = (x, y) => new THREE.Vector2(...P(x, y));
  root.userData.sourceRasterFromPoint = (x, y) => new THREE.Vector2(...toRaster([x, y]));
  root.userData.pinInHandleFrame = pinInHandleFrame;
  root.userData.camGapAt = camGapAt;
  root.userData.liftAt = liftAtHandleAngle;
  root.userData.geometry = {
    cyclePeriod, sourceUnitsPerPixel: s, pinRadius, slotHalfWidth, crownRadius, rodBottomY,
    armLength, shaftCenter, pivotRest, pivotRadius, maximumLift, maximumHandleAngle, eccentricThrow,
    runTurns, runHalf, runRamp, lift, lower, camClearance, layers: Z,
    handlePolygon: handleShape, rodPolygon: rodShape, armPolygon: armShape,
  };
  root.userData.blocks = {
    valveRocker, valveArm, valveShaft, valveShaftFace: valveArm, valvePin,
    eccentricRod, rodBody, rodForkLines, pivotPin, upperHandle, upperHandleBody, cameraEnvelope,
  };
  root.userData.jointChecks = [
    [valveArm, valveShaft], [valveArm, valvePin], [rodBody, pivotPin], [upperHandleBody, pivotPin],
  ];
  root.userData.rigidBodies = [valveRocker, eccentricRod, upperHandle];

  // Past the view: the eccentric and its column, and the rockshaft's column.
  const frame = gabRodFrame({
    eccentric: {x: eccentric.O.x, y: eccentric.O.y, shaftRadius: eccentric.shaftRadius, zFront: Z.rod[0] - 0.02},
    rockshaft: {x: shaftCenter[0], y: shaftCenter[1], shaftRadius, zFront: Z.arm[0] - 0.02},
    floorY: P(0, 520)[1], zWall,
  });
  root.add(eccentric.sheave, frame);
  Object.assign(root.userData.blocks, {eccentricStrap: eccentric.strap, eccentricSheave: eccentric.sheave, frame});
  root.userData.geometry.rodLength = rodLength;
  root.userData.geometry.eccentricCentre = eccentric.O.toArray();
  // Frame Brown's plate (the envelope): the whole rod, its eccentric and the
  // frame run on past his break.
  cameraEnvelope.updateMatrixWorld(true);
  root.userData.cameraFitBounds = new THREE.Box3().setFromObject(cameraEnvelope);

  update(0);
  markShadows(root);
  cameraEnvelope.castShadow = false;
  cameraEnvelope.receiveShadow = false;
  return {root, update, cameraDirection: new THREE.Vector3(0.03, 0.02, 1)};
}

function ringArea(ring) {
  let a = 0;
  for (let i = 0; i + 1 < ring.length; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(a / 2);
}

function segmentDistance(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
