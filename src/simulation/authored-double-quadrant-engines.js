import * as THREE from 'three';
import { PALETTE, markShadows, matte } from './primitives.js';
import { fitPistonGuide } from './piston-guide-parts.js';
import { latheSectionGeometry } from './cutaway-section.js';
import { engineRod } from './steam-engine-parts.js';
import {
  arcPoints,
  bandPolygon,
  circlePolygon,
  multiArea,
  partPlate,
  piecesContaining,
  polygonClipping,
  ringPolygon,
  safeClip,
  exhaustElbowGeometry,
  sectionPlate,
  steamVolume,
} from './steam-section-kit.js';

const FULL_TURN = Math.PI * 2;
const DEG = Math.PI / 180;

// Movement 423, Root's double-quadrant engine (pass 69 rebuild from Brown's
// plate).
//
// One open working cavity holds both pistons B. Each B is a vane on its own
// pivot; its outer side works in a quadrant closed by a curved wall and an
// end wall, its inner side faces the common space between the pistons in
// which crank D turns. Nothing divides that space: it is the exhaust. The
// top quadrant's steam passage runs over its curved wall (Brown's hatched
// bar) and turns down round the bar's end into the corner; the bottom
// quadrant's passage runs down the right wall behind the end wall and enters
// at the bottom corner. Valve a is a rocking plug with two hollows: the upper
// joins the inlet to one passage, or to both at mid-travel, while the lower
// joins the other passage to the port that opens into the space between the
// pistons. The plug rocks a quarter-turn out of phase with the overlap of the
// two power strokes, so each B takes steam through its whole working stroke
// (about 212 degrees of the crank's turn) and both take it where the strokes
// overlap: there is no dead point.
function doubleQuadrantEngine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  const inputAngularSpeed = FULL_TURN / cycleDuration;

  // Units: Brown's plate at 44.4 px per unit, origin at the crank centre D.
  const crankRadius = 1.3;
  const rodLength = 3.58;
  const rockerRadius = 4.3; // wrist pins
  const vaneRadius = 5.0; // tip of B
  const arcRadius = 5.02; // curved wall of each quadrant
  const lugAngle = 8.5 * DEG; // B leads its wrist pin
  const pivotTop = [-3.6, 0];
  const pivotBottom = [3.6, 0];
  const hubRadius = 0.5;
  const boreRadius = 0.52;
  const vaneHalfWidth = 0.1;
  const sourceCrankAngle = Math.atan2(-1.126, 0.676); // Brown's pose
  const depth = 1.2;
  const zBack = -depth;
  const backThickness = 0.2;
  const valveCenter = [2.88, 2.36];
  const valveBore = 0.96;
  const plugRadius = 0.95;
  const plugHubRadius = 0.5;
  const valveAmplitude = 18 * DEG;
  const valvePhase = 196 * DEG; // alpha = A sin(i - 196 deg), i clockwise crank turn
  const portHalf = Math.asin(0.14 / 0.96); // channel half-width 0.14 at the bore
  const lap = 1 * DEG;
  const portAngles = { inlet: 90 * DEG, top: 163 * DEG, bottom: -56 * DEG };
  const openCenter = 7 * DEG;
  // Upper hollow X (always over the inlet) reaches the top port for
  // alpha > -a0 and the bottom port for alpha < +a0; lower hollow Y (always
  // over the exhaust port) reaches the top port for alpha < -a0 and the
  // bottom port for alpha > +a0. The lands between them are exactly a port
  // wide plus a one-degree lap either side.
  const hollowX = [portAngles.bottom + portHalf - openCenter, portAngles.top - portHalf + openCenter];
  const hollowY = [portAngles.top + portHalf + openCenter + 2 * lap, portAngles.bottom + FULL_TURN - portHalf - openCenter - 2 * lap];

  const rockerAt = (pivot, crankAngle) => {
    const crankPin = [crankRadius * Math.cos(crankAngle), crankRadius * Math.sin(crankAngle)];
    const dx = crankPin[0] - pivot[0];
    const dy = crankPin[1] - pivot[1];
    const distance = Math.hypot(dx, dy);
    const ex = dx / distance;
    const ey = dy / distance;
    const along = (rockerRadius ** 2 - rodLength ** 2 + distance ** 2) / (2 * distance);
    const height = Math.sqrt(Math.max(0, rockerRadius ** 2 - along ** 2));
    const wrist = [pivot[0] + ex * along - ey * height, pivot[1] + ey * along + ex * height];
    const pinAngle = Math.atan2(wrist[1] - pivot[1], wrist[0] - pivot[0]);
    return { crankPin, wrist, pinAngle, vaneAngle: pinAngle + lugAngle };
  };
  const stateAtInputAngle = (inputAngle) => {
    const crankAngle = sourceCrankAngle - inputAngle; // clockwise
    const top = rockerAt(pivotTop, crankAngle);
    const bottom = rockerAt(pivotBottom, crankAngle);
    const ahead = 1e-3;
    const topNext = rockerAt(pivotTop, crankAngle - ahead);
    const bottomNext = rockerAt(pivotBottom, crankAngle - ahead);
    const valveAngle = valveAmplitude * Math.sin(inputAngle - valvePhase);
    const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
    const norm = (angle, base) => base + THREE.MathUtils.euclideanModulo(angle - base, FULL_TURN);
    const opening = (port, hollow) => {
      const start = hollow[0] + valveAngle;
      const end = hollow[1] + valveAngle;
      const center = norm(port, start - portHalf);
      return overlap(center - portHalf, center + portHalf, start, end);
    };
    const pressure = (live, exhaust) => THREE.MathUtils.clamp(0.5 + (live - exhaust) / (4 * DEG), 0, 1);
    const topLive = opening(portAngles.top, hollowX);
    const topExhaust = opening(portAngles.top, hollowY);
    const bottomLive = opening(portAngles.bottom, hollowX);
    const bottomExhaust = opening(portAngles.bottom, hollowY);
    return {
      inputAngle,
      crankAngle,
      crankPin: top.crankPin,
      top: { ...top, powered: topNext.vaneAngle < top.vaneAngle },
      bottom: { ...bottom, powered: bottomNext.vaneAngle < bottom.vaneAngle },
      valveAngle,
      topLive, topExhaust, bottomLive, bottomExhaust,
      topPressure: pressure(topLive, topExhaust),
      bottomPressure: pressure(bottomLive, bottomExhaust),
    };
  };
  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return { ...stateAtInputAngle(inputAngularSpeed * cycleTime), cycleTime, phase: cycleTime / cycleDuration };
  };
  // swept ranges of B
  let topMin = Infinity; let topMax = -Infinity; let bottomMin = Infinity; let bottomMax = -Infinity;
  for (let i = 0; i < 720; i += 1) {
    const state = stateAtInputAngle(i / 720 * FULL_TURN);
    topMin = Math.min(topMin, state.top.vaneAngle); topMax = Math.max(topMax, state.top.vaneAngle);
    bottomMin = Math.min(bottomMin, state.bottom.vaneAngle); bottomMax = Math.max(bottomMax, state.bottom.vaneAngle);
  }

  // ---- fixed outlines ---------------------------------------------------------
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const polar = (center, radius, angle) => [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)];
  // End wall of a quadrant: a line parallel to axis angle psi, `offset` to
  // its anticlockwise side, clear of B at the top of its swing.
  const wallPoint = (pivot, psi, offset, s) => [
    pivot[0] + s * Math.cos(psi) - offset * Math.sin(psi),
    pivot[1] + s * Math.sin(psi) + offset * Math.cos(psi),
  ];
  const wallAtRadius = (pivot, psi, offset, radius) => wallPoint(pivot, psi, offset, Math.sqrt(radius ** 2 - offset ** 2));
  const quadrant = (pivot, fromAngle, psi, offset, radius, hub = 0) => {
    const end = wallAtRadius(pivot, psi, offset, radius);
    const endAngle = Math.atan2(end[1] - pivot[1], end[0] - pivot[0]);
    return ringPolygon([
      polar(pivot, hub, fromAngle),
      ...arcPoints(pivot, radius, fromAngle, endAngle, 48),
      wallAtRadius(pivot, psi, offset, Math.max(hub, Math.abs(offset) + 1e-3)),
    ]);
  };
  const topWallAxis = 93 * DEG;
  const bottomWallAxis = -92 * DEG;
  const wallOffset = 0.13;
  const topInnerEnd = 26.7 * DEG; // curved wall meets the wedge under a
  const bottomInnerEnd = -161 * DEG; // curved wall meets the lower-left wall
  const barEnd = 88.5 * DEG;
  const barOuter = 5.25;
  const passageOuter = 5.55;
  const wallThickness = 0.28;

  // Pass 90: the steam passage over the top quadrant is one smooth channel
  // of constant width: the arc between bar and outer wall down to
  // channelStart, then a tangent-continuous cubic into valve a's top port,
  // entering along the port's radius. Below channelStart the quadrant ends
  // at its own curved wall, so the casing between channel and quadrant is
  // solid (Brown's hatched wedge) and no pocket or kink is left.
  const channelStart = 36 * DEG;
  const passageMid = (barOuter + passageOuter) / 2;
  const topQuadrant = polygonClipping.union(
    quadrant(pivotTop, topInnerEnd, topWallAxis, wallOffset, arcRadius, 0),
    quadrant(pivotTop, channelStart, topWallAxis, wallOffset, passageOuter, 0),
  );
  const bar = polygonClipping.union(
    ringPolygon([
      ...arcPoints(pivotTop, barOuter, topInnerEnd - 2 * DEG, barEnd, 40),
      ...arcPoints(pivotTop, arcRadius, barEnd, topInnerEnd - 2 * DEG, 40),
    ]),
    circlePolygon(polar(pivotTop, (arcRadius + barOuter) / 2, barEnd), (barOuter - arcRadius) / 2, 24),
  );
  const bottomQuadrant = quadrant(pivotBottom, bottomInnerEnd, bottomWallAxis, wallOffset, arcRadius, 0);
  const valveOnBore = (angle, radius = valveBore) => polar(valveCenter, radius, angle);
  const topChannelLine = (() => {
    const arc = arcPoints(pivotTop, passageMid, channelStart + 6 * DEG, channelStart, 8);
    const p0 = new THREE.Vector2(...polar(pivotTop, passageMid, channelStart));
    const t0 = new THREE.Vector2(Math.sin(channelStart), -Math.cos(channelStart));
    const p3 = new THREE.Vector2(...valveOnBore(portAngles.top, valveBore - 0.1));
    const t3 = new THREE.Vector2(-Math.cos(portAngles.top), -Math.sin(portAngles.top));
    const reach = p0.distanceTo(p3) * 0.42;
    const curve = new THREE.CubicBezierCurve(p0, p0.clone().addScaledVector(t0, reach), p3.clone().addScaledVector(t3, -reach), p3);
    return [...arc.slice(0, -1), ...curve.getSpacedPoints(40).map((p) => [p.x, p.y])];
  })();
  const topChannel = bandPolygon(topChannelLine, (passageOuter - barOuter) / 2);
  const bottomPassageLine = [
    valveOnBore(portAngles.bottom, valveBore - 0.1), valveOnBore(portAngles.bottom, 1.2),
    [3.72, 1.12], [4.1, 0.66], [4.32, 0.0],
    [4.25, -0.8], wallPoint(pivotBottom, bottomWallAxis, wallOffset + 0.45, 1.6),
    wallPoint(pivotBottom, bottomWallAxis, wallOffset + 0.45, 4.4),
  ];
  const smoothLine = (points, count = 72) => new THREE.SplineCurve(points.map((p) => new THREE.Vector2(...p)))
    .getSpacedPoints(count).map((p) => [p.x, p.y]);
  // The passage turns in under the end of the end wall into the corner.
  const bottomMouth = ringPolygon([
    wallPoint(pivotBottom, bottomWallAxis, wallOffset + 0.6, 4.2),
    wallPoint(pivotBottom, bottomWallAxis, wallOffset + 0.6, 4.88),
    wallPoint(pivotBottom, bottomWallAxis, 0, 4.88),
    wallPoint(pivotBottom, bottomWallAxis, 0, 4.62),
    wallPoint(pivotBottom, bottomWallAxis, wallOffset + 0.3, 4.62),
    wallPoint(pivotBottom, bottomWallAxis, wallOffset + 0.3, 4.2),
  ]);
  const bottomPassage = polygonClipping.union(bandPolygon(smoothLine(bottomPassageLine), 0.15), bottomMouth);
  const inletBore = ringPolygon([[valveCenter[0] - 0.17, valveCenter[1]], [valveCenter[0] + 0.17, valveCenter[1]],
    [valveCenter[0] + 0.17, 4.5], [valveCenter[0] - 0.17, 4.5]]);
  const wedgeTip = [1.24, 1.28];
  const wedgeRight = valveOnBore(205 * DEG);
  const blockCorner = valveOnBore(243 * DEG);
  const central = ringPolygon([
    [-3.38, -0.2], pivotTop, polar(pivotTop, arcRadius, topInnerEnd), wedgeTip, wedgeRight,
    ...arcPoints(valveCenter, valveBore, 205 * DEG, 243 * DEG, 12).slice(1, -1),
    blockCorner, [blockCorner[0], 0.45], [3.3, 0.45], pivotBottom,
    polar(pivotBottom, arcRadius, bottomInnerEnd), [-1.24, -1.65], [-3.38, -1.91],
  ]);
  const workingCavity = polygonClipping.difference(
    polygonClipping.union(
      topQuadrant, bottomQuadrant, central, topChannel, bottomPassage,
      circlePolygon(pivotTop, boreRadius, 32), circlePolygon(pivotBottom, boreRadius, 32),
      circlePolygon(valveCenter, valveBore, 64), inletBore,
    ),
    bar,
  );

  // Outer contour: the cavity walls thickened, the hub bosses, the valve
  // housing with its flanged inlet and the lower-left wall with its packing.
  const outerTop = quadrant(pivotTop, 18 * DEG, topWallAxis, wallOffset + wallThickness + 0.1, passageOuter + wallThickness, 0);
  const outerBottom = quadrant(pivotBottom, bottomInnerEnd - 3 * DEG, bottomWallAxis, wallOffset + 0.88, arcRadius + wallThickness, 0);
  const outerOutline = polygonClipping.union(
    outerTop, outerBottom, central,
    bandPolygon(topChannelLine, (passageOuter - barOuter) / 2 + wallThickness),
    bandPolygon(smoothLine(bottomPassageLine), 0.15 + wallThickness),
    ringPolygon([wallPoint(pivotBottom, bottomWallAxis, wallOffset + 0.88, 4.0), wallPoint(pivotBottom, bottomWallAxis, wallOffset + 0.88, 5.16),
      wallPoint(pivotBottom, bottomWallAxis, -0.3, 5.16), wallPoint(pivotBottom, bottomWallAxis, -0.3, 4.0)]),
    circlePolygon(pivotTop, 1.0, 64), circlePolygon(pivotBottom, 0.95, 64),
    circlePolygon(valveCenter, 1.3, 96),
    ringPolygon([[valveCenter[0] - 0.45, valveCenter[1]], [valveCenter[0] + 0.45, valveCenter[1]],
      [valveCenter[0] + 0.45, 3.95], [valveCenter[0] - 0.45, 3.95]]),
    ringPolygon([[valveCenter[0] - 0.8, 3.95], [valveCenter[0] + 0.72, 3.95],
      [valveCenter[0] + 0.72, 4.35], [valveCenter[0] - 0.8, 4.35]]),
    ringPolygon([[-3.94, -2.19], [-1.3, -1.93], [-1.0, -1.6], [-3.38, -1.6], [-3.38, -0.4], [-3.94, -0.4]]),
    ringPolygon([[-1.24, -1.65], polar(pivotBottom, arcRadius + wallThickness, bottomInnerEnd - 3 * DEG), [-1.1, -1.95]]),
    // Brown's hatched wedge under a and the block beside the exhaust port
    ringPolygon([polar(pivotTop, arcRadius, topInnerEnd - 3 * DEG), wedgeTip, wedgeRight, [2.2, 2.9], [0.6, 2.9]]),
    ringPolygon([[blockCorner[0] - 0.05, 0.3], [4.2, 0.3], [4.2, 1.6], [blockCorner[0] - 0.05, 1.6]]),
  );
  const casingOutline = polygonClipping.difference(outerOutline, workingCavity)
    .filter((polygon) => multiArea([polygon]) > 1e-3)
    .map(([outer, ...holes]) => [outer, ...holes.filter((hole) => multiArea([[hole]]) > 5e-3)]);
  // Brown's cast frame behind the casing, down to its base plate.
  const px = ([x, y]) => [(x - 270) / 44.4, (265 - y) / 44.4];
  const frame = ringPolygon([
    [22, 510], [502, 510], [502, 490], [486, 490], [470, 300], [440, 270], [300, 270], [110, 300],
    [78, 322], [72, 380], [26, 490], [22, 490],
  ].map(px));
  const exhaustOutlet = [-2.35, -1.05];
  const backOutline = polygonClipping.difference(
    polygonClipping.union(outerOutline, frame),
    circlePolygon(exhaustOutlet, 0.3, 48),
    circlePolygon([0, 0], 0.26, 48),
    circlePolygon(pivotTop, 0.21, 40),
    circlePolygon(pivotBottom, 0.21, 40),
    circlePolygon(valveCenter, 0.14, 32),
  );

  const frameMaterial = matte(PALETTE.frame, { metalness: 0.24, roughness: 0.54 });
  const backMaterial = matte(0x7d8786, { metalness: 0.18, roughness: 0.6 });
  const darkMaterial = matte(PALETTE.ink, { metalness: 0.33, roughness: 0.42 });
  const pistonMaterial = matte(PALETTE.driven, { metalness: 0.2, roughness: 0.47 });
  const rodMaterial = matte(PALETTE.driver, { metalness: 0.21, roughness: 0.46 });
  const valveMaterial = matte(0xd9a62b, { metalness: 0.23, roughness: 0.43 });

  const casing = sectionPlate(casingOutline, zBack, 0, frameMaterial,
    'sectioned-casing-of-both-quadrants-with-passages-and-valve-housing');
  root.add(casing);
  const back = sectionPlate(backOutline, zBack - backThickness, zBack, backMaterial,
    'cast-frame-and-back-of-casing-with-exhaust-outlet');
  back.material = [backMaterial, backMaterial];
  root.add(back);
  const exhaustPipe = new THREE.Mesh(exhaustElbowGeometry(exhaustOutlet, zBack - backThickness, 0.3, 0.06), backMaterial);
  exhaustPipe.userData.role = 'exhaust-pipe-from-the-space-between-the-pistons';
  root.add(exhaustPipe);

  // ---- pistons B ----------------------------------------------------------------
  const vaneOutline = (extra = 0) => polygonClipping.union(
    circlePolygon([0, 0], extra > 0 ? boreRadius + 0.006 : hubRadius, extra > 0 ? 32 : 64),
    ringPolygon([[0.2, -vaneHalfWidth], [vaneRadius + extra, -vaneHalfWidth],
      [vaneRadius + extra, vaneHalfWidth], [0.2, vaneHalfWidth]]),
  );
  const pinRadius = 0.12;
  const lugOutline = (() => {
    const pin = [rockerRadius * Math.cos(-lugAngle), rockerRadius * Math.sin(-lugAngle)];
    return polygonClipping.union(
      ringPolygon([[rockerRadius - 0.55, 0], [rockerRadius + 0.3, 0], [pin[0] + 0.25, pin[1]], [pin[0] - 0.3, pin[1] + 0.05]]),
      circlePolygon(pin, 0.24, 32),
    );
  })();
  const makePiston = (pivot, name) => {
    const group = new THREE.Group();
    group.position.set(pivot[0], pivot[1], 0);
    group.userData.role = `${name}-single-acting-piston-B`;
    const vane = partPlate(polygonClipping.difference(vaneOutline(), circlePolygon([0, 0], 0.2, 32)),
      zBack + 0.01, -0.01, pistonMaterial, `${name}-vane-of-piston-B`);
    const lug = partPlate(lugOutline, zBack + 0.01, zBack + 0.3, pistonMaterial, `${name}-wrist-lug-of-piston-B`);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(pinRadius, pinRadius, 0.9, 24), darkMaterial);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(rockerRadius * Math.cos(-lugAngle), rockerRadius * Math.sin(-lugAngle), zBack + 0.3 + 0.45 - 0.01);
    pin.userData.role = `${name}-wrist-pin-of-piston-B`;
    const spindle = new THREE.Mesh(latheSectionGeometry(
      [[0, zBack - backThickness - 0.5], [0.2, zBack - backThickness - 0.5], [0.2, -0.012], [0, -0.012]],
      { segments: 32, phiStart: 0, phiLength: FULL_TURN },
    ), darkMaterial);
    spindle.rotation.x = Math.PI / 2;
    spindle.userData.role = `${name}-pivot-spindle-of-piston-B`;
    group.add(vane, lug, pin, spindle);
    root.add(group);
    return { group, vane, lug, pin };
  };
  const topPiston = makePiston(pivotTop, 'top');
  const bottomPiston = makePiston(pivotBottom, 'bottom');

  // ---- crank D and rods ------------------------------------------------------------
  const crank = new THREE.Group();
  crank.userData.role = 'common-crank-D';
  const crankArm = partPlate(polygonClipping.union(
    circlePolygon([0, 0], 0.36, 40), circlePolygon([crankRadius, 0], 0.26, 32),
    ringPolygon([[0, -0.2], [crankRadius, -0.15], [crankRadius, 0.15], [0, 0.2]]),
  ), zBack + 0.35, zBack + 0.55, darkMaterial, 'arm-of-common-crank-D');
  const crankShaft = new THREE.Mesh(latheSectionGeometry(
    [[0, zBack - backThickness - 0.6], [0.25, zBack - backThickness - 0.6], [0.25, zBack + 0.36], [0, zBack + 0.36]],
    { segments: 32, phiStart: 0, phiLength: FULL_TURN },
  ), darkMaterial);
  crankShaft.rotation.x = Math.PI / 2;
  crankShaft.userData.role = 'shaft-of-crank-D-through-the-back';
  const crankPin = new THREE.Mesh(new THREE.CylinderGeometry(pinRadius, pinRadius, 0.62, 24), darkMaterial);
  crankPin.rotation.x = Math.PI / 2;
  crankPin.position.set(crankRadius, 0, zBack + 0.55 + 0.3);
  crankPin.userData.role = 'common-crank-pin-of-both-rods';
  crank.add(crankArm, crankShaft, crankPin);
  root.add(crank);
  const topRod = engineRod(rodLength, 0.16, 0.24, pinRadius + 0.005, 0.18, rodMaterial, 'top-connecting-rod');
  const bottomRod = engineRod(rodLength, 0.16, 0.24, pinRadius + 0.005, 0.18, rodMaterial, 'bottom-connecting-rod');
  root.add(topRod, bottomRod);
  const topRodZ = zBack + 0.66;
  const bottomRodZ = zBack + 0.88;

  // ---- valve a ---------------------------------------------------------------------------
  const plugOutline = polygonClipping.difference(
    circlePolygon([0, 0], plugRadius, 96),
    ringPolygon([...arcPoints([0, 0], plugRadius + 0.01, hollowX[0], hollowX[1], 48),
      ...arcPoints([0, 0], plugHubRadius, hollowX[1], hollowX[0], 48)]),
    ringPolygon([...arcPoints([0, 0], plugRadius + 0.01, hollowY[0], hollowY[1], 48),
      ...arcPoints([0, 0], plugHubRadius, hollowY[1], hollowY[0], 48)]),
  );
  const valveA = new THREE.Group();
  valveA.position.set(valveCenter[0], valveCenter[1], 0);
  valveA.userData.role = 'rocking-plug-valve-a';
  const plug = partPlate(polygonClipping.difference(plugOutline, circlePolygon([0, 0], 0.13, 24)),
    zBack + 0.01, -0.01, valveMaterial, 'plug-of-valve-a-with-inlet-and-exhaust-hollows');
  const valveSpindle = new THREE.Mesh(latheSectionGeometry(
    [[0, zBack - backThickness - 0.4], [0.13, zBack - backThickness - 0.4], [0.13, -0.012], [0, -0.012]],
    { segments: 24, phiStart: 0, phiLength: FULL_TURN },
  ), darkMaterial);
  valveSpindle.rotation.x = Math.PI / 2;
  valveSpindle.userData.role = 'spindle-of-valve-a';
  valveA.add(plug, valveSpindle);
  root.add(valveA);

  // ---- steam -------------------------------------------------------------------------------
  const steamZ = [zBack + 0.012, -0.012];
  const topSteam = steamVolume('steam-behind-top-piston-B', ...steamZ);
  const bottomSteam = steamVolume('steam-behind-bottom-piston-B', ...steamZ);
  const inletSteam = steamVolume('live-steam-in-inlet-and-valve-hollow', ...steamZ);
  const exhaustSteam = steamVolume('exhaust-steam-between-the-pistons', ...steamZ);
  root.add(topSteam, bottomSteam, inletSteam, exhaustSteam);
  const transform = (multi, center, angle) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return multi.map((polygon) => polygon.map((ring) => ring.map(([x, y]) => [center[0] + x * c - y * s, center[1] + x * s + y * c])));
  };
  const vaneSplitter = vaneOutline(0.12);
  // The plug as a splitter covers its running clearance, so the lands shut
  // the ports exactly at the bore.
  const plugSplitter = polygonClipping.difference(
    circlePolygon([0, 0], valveBore + 0.004, 64),
    ringPolygon([...arcPoints([0, 0], valveBore + 0.01, hollowX[0], hollowX[1], 28),
      ...arcPoints([0, 0], plugHubRadius, hollowX[1], hollowX[0], 12)]),
    ringPolygon([...arcPoints([0, 0], valveBore + 0.01, hollowY[0], hollowY[1], 20),
      ...arcPoints([0, 0], plugHubRadius, hollowY[1], hollowY[0], 8)]),
  );
  const probes = {
    top: polar(pivotTop, (barOuter + passageOuter) / 2, 60 * DEG),
    bottom: smoothLine(bottomPassageLine)[50],
    inlet: [valveCenter[0], 4.3],
    exhaust: exhaustOutlet,
  };
  const valveZone = polygonClipping.union(circlePolygon(valveCenter, valveBore + 0.02, 48), inletBore);
  const steamReport = {};
  const updateSteam = (state) => {
    const spaces = safeClip('difference', workingCavity,
      transform(vaneSplitter, pivotTop, state.top.vaneAngle),
      transform(vaneSplitter, pivotBottom, state.bottom.vaneAngle),
      transform(plugSplitter, valveCenter, state.valveAngle));
    const inlet = piecesContaining(spaces, [probes.inlet]);
    const exhaust = piecesContaining(spaces, [probes.exhaust]);
    const topWithInlet = inlet.some((p) => piecesContaining([p], [probes.top]).length);
    const bottomWithInlet = inlet.some((p) => piecesContaining([p], [probes.bottom]).length);
    // Each steam volume keeps to its own region so it changes shape smoothly:
    // the valve bore (inlet pipe and the two plug hollows) apart from the
    // top space, the bottom space and the space between the pistons. The
    // passages show the valve's port-opening pressure (live while joined to
    // the inlet hollow, exhausted while joined to the exhaust hollow).
    const outside = safeClip('difference', spaces, valveZone);
    const inside = safeClip('intersection', spaces, valveZone);
    const withProbe = (pieces, probe) => piecesContaining(pieces, [probe]);
    inletSteam.userData.setRegion(withProbe(inside, probes.inlet), 1);
    exhaustSteam.userData.setRegion([
      ...withProbe(outside, probes.exhaust),
      ...inside.filter((piece) => !withProbe([piece], probes.inlet).length),
    ], 0);
    topSteam.userData.setRegion(withProbe(outside, probes.top), state.topPressure);
    bottomSteam.userData.setRegion(withProbe(outside, probes.bottom), state.bottomPressure);
    steamReport.pieceCount = spaces.length;
    steamReport.topJoinedToInlet = topWithInlet;
    steamReport.bottomJoinedToInlet = bottomWithInlet;
    steamReport.topJoinedToExhaust = exhaust.some((p) => piecesContaining([p], [probes.top]).length);
    steamReport.bottomJoinedToExhaust = exhaust.some((p) => piecesContaining([p], [probes.bottom]).length);
    steamReport.inletArea = multiArea(inlet);
    steamReport.exhaustArea = multiArea(exhaust);
  };

  const update = (time) => {
    const state = stateAtTime(time);
    topPiston.group.rotation.z = state.top.vaneAngle;
    bottomPiston.group.rotation.z = state.bottom.vaneAngle;
    crank.rotation.z = state.crankAngle;
    topRod.userData.setEndpoints(
      new THREE.Vector3(state.crankPin[0], state.crankPin[1], topRodZ),
      new THREE.Vector3(state.top.wrist[0], state.top.wrist[1], topRodZ),
    );
    bottomRod.userData.setEndpoints(
      new THREE.Vector3(state.crankPin[0], state.crankPin[1], bottomRodZ),
      new THREE.Vector3(state.bottom.wrist[0], state.bottom.wrist[1], bottomRodZ),
    );
    valveA.rotation.z = state.valveAngle;
    updateSteam(state);
  };

  let poweredOverlap = 0;
  let topPoweredCount = 0;
  for (let i = 0; i < 720; i += 1) {
    const state = stateAtInputAngle(i / 720 * FULL_TURN);
    if (state.top.powered) topPoweredCount += 1;
    if (state.top.powered && state.bottom.powered) poweredOverlap += 1;
  }
  root.userData = {
    animationTiming: { authoredCyclePeriod: cycleDuration, targetCycleDuration: 3 },
    archetype: 'two-single-acting-vane-pistons-on-one-crank-in-one-open-casing-with-rocking-plug-valve',
    blocks: { casing, back, topPiston, bottomPiston, crank, topRod, bottomRod, valveA, plug, topSteam, bottomSteam, inletSteam, exhaustSteam },
    degreesOfFreedom: { independentPrescribedInputs: 1, operatingDegreesOfFreedom: 1 },
    dynamics: {
      steam: 'Steam volumes are the actual connected pieces of the casting’s one working cavity after the two pistons and the valve plug divide it: pieces joined to the inlet are live, pieces joined to the space between the pistons are exhaust.',
      pressureForcesLeakageAndThermodynamicsModeled: false,
    },
    fidelity: 'authored',
    geometry: {
      crankRadius, rodLength, rockerRadius, vaneRadius, arcRadius, lugAngle, pivotTop, pivotBottom, valveCenter,
      valveAmplitude, openCenter, hollowX, hollowY, portAngles, portHalf, topInnerEnd, bottomInnerEnd, barEnd,
      topWallAxis, bottomWallAxis, wallOffset, topMin, topMax, bottomMin, bottomMax,
      powerStrokeFraction: topPoweredCount / 720,
      overlapFraction: poweredOverlap / 720,
      workingCavity, casingOutline, depth, topChannelLine, channelStart, passageHalfWidth: (passageOuter - barOuter) / 2, wallThickness,
    },
    mechanism: 'Two single-acting vane pistons B on their own pivots share one open cavity with crank D between them. Each works on its outer side in a quadrant closed by a curved wall and an end wall; the space between the pistons is not walled off and is the exhaust. Rocking plug valve a joins the inlet to the top passage (over the top quadrant’s curved wall and round its end), to the bottom passage (down the right wall into the bottom corner), or to both at mid-travel, and joins the idle passage to the port into the space between the pistons.',
    motion: { cycleDuration, inputAngularSpeed },
    sourceAnimation: {
      available: true,
      independentlyReconstructed: true,
      reason: 'The official Movement 423 page draws the same arrangement (two pivoted pistons on one crank, the passage over the top quadrant turning round the end of its wall, the passage down the right side round the right pivot, and a rocking valve under the inlet). It was studied for topology only; the proportions here are measured from Brown’s plate, whose pose (bottom B at the end of its stroke, rods and crank in line) the linkage reproduces.',
    },
    sourceReference: {
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 423',
      brownPlate423: { imageWidth: 525, imageHeight: 525, pixelsPerUnit: 44.4, crankCenterPixels: [270, 265], leftPivotPixels: [107, 267], rightPivotPixels: [425, 272], valveCenterPixels: [398, 160] },
      reconstructionDisclosure: 'Brown gives no dimensions or valve details. The plug’s two hollows, its open-centre lap, the exhaust outlet through the back of the casting, the casting depth and the four-second turn are engineered. The pivots are set symmetric about D (Brown’s differ by about 0.1 unit).',
    },
    stateAtInputAngle,
    stateAtTime,
    steamReport,
    update,
  };
  root.userData.cameraDirection = new THREE.Vector3(0.8, 0.3, 14);
  root.userData.cameraFov = 8;
  update(0);
  markShadows(root);
  for (const steam of [topSteam, bottomSteam, inletSteam, exhaustSteam]) { steam.castShadow = false; steam.receiveShadow = false; }
  fitPistonGuide(root, update, cycleDuration);
  return { cameraDirection: root.userData.cameraDirection, root, update };
}

export function createAuthoredDoubleQuadrantEngineMovement(movement) {
  if (movement.id !== 423) return null;
  return doubleQuadrantEngine(movement);
}
