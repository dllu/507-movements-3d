import * as THREE from 'three';
import { PALETTE, markShadows, matte } from './primitives.js';
import { fitPistonGuide } from './piston-guide-parts.js';
import { latheSectionGeometry } from './cutaway-section.js';
import {
  arcPoints,
  circlePolygon,
  filletPath,
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

// Movement 422, oscillating piston engine (pass 69 rebuild).
//
// One sector chamber A is centred on rock-shaft C. The vane piston B, keyed
// to C, divides it into two working spaces. Above the chamber a fixed curved
// tongue closes its top; over the tongue run two passages from the valve
// face, one down round each end of the tongue into the corner of the chamber
// beside the side wall (Brown's two arrows). The D slide valve on the face
// admits chest steam to one passage while its hollow joins the other passage
// to the central exhaust port, which leaves through the back of the casting
// (Brown's small oval under D). The valve runs a quarter-cycle ahead of B,
// as in an ordinary engine, so the space behind B always takes steam and the
// space ahead of it always exhausts.
function sectorPistonEngine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  // Brown draws B upright at mid-stroke (swinging anticlockwise, steam
  // entering by the right passage, as his right arrow shows).
  const sourceInputAngle = Math.PI / 2;

  // Geometry in the units of the official canvas reconstruction (rock-shaft C
  // at the origin, sector radius 5), with Brown's plate as the check.
  const hubRadius = 0.6;
  const boreRadius = 0.625;
  const shaftRadius = 0.4;
  const chamberRadius = 5.0;
  const tongueOuterRadius = 5.3;
  const passageOuterRadius = 5.75;
  const tongueHalfSpan = (115.3 - 64.7) / 2 * DEG;
  const wallAxisAngle = 119.6 * DEG; // side-wall direction (left wall)
  const wallOffset = 0.2; // side walls stand 0.2 off C, tangent to the hub
  const wallThickness = 0.35;
  const pistonAngularAmplitude = 23.0 * DEG;
  const vaneHalfWidth = 0.12;
  const vaneTipRadius = chamberRadius - 0.02;
  const depth = 1.4;
  const zBack = -depth;
  const backThickness = 0.22;
  const valveFaceY = 6.0;
  const portInner = 0.45;
  const portOuter = 0.65;
  const valveHalfLength = 0.65;
  const valveHollowHalfWidth = 0.45;
  const valveTravelAmplitude = 0.22;
  const valveHeight = 0.6;
  const chestInnerHalfWidth = 0.92;
  const chestInnerTop = 6.95;
  const chestOuterHalfWidth = 1.2;
  const chestOuterTop = 7.25;
  const exhaustHalfWidth = 0.12;
  const exhaustBottom = 5.45;
  const rodY = 6.5;
  const rodZ = -depth / 2;
  const rodRadius = 0.07;
  const rodLength = 2.45;

  // Left wall: points s*u + offset*n, u along the wall, n outward (to the left).
  const wallPoint = (side, s, offset) => {
    const u = [Math.cos(wallAxisAngle), Math.sin(wallAxisAngle)];
    const n = [-Math.sin(wallAxisAngle), Math.cos(wallAxisAngle)];
    const x = s * u[0] + offset * n[0];
    const y = s * u[1] + offset * n[1];
    return [side < 0 ? x : -x, y];
  };
  const wallAtRadius = (side, radius, offset) => wallPoint(
    side,
    Math.sqrt(radius ** 2 - offset ** 2),
    offset,
  );

  const stateAtInputAngle = (inputAngle, inputSpeed = inputAngularSpeed) => {
    const sine = Math.sin(inputAngle);
    const cosine = Math.cos(inputAngle);
    const pistonAngle = Math.PI / 2 - pistonAngularAmplitude * cosine;
    const pistonAngularSpeed = pistonAngularAmplitude * sine * inputSpeed;
    // D leads B by a quarter cycle: it uncovers the right port (steam to the
    // space right of B) while B swings anticlockwise, and the left port while
    // B swings clockwise.
    const valveX = -valveTravelAmplitude * sine;
    const leftAdmission = THREE.MathUtils.clamp(valveX, 0, portOuter - portInner);
    const rightAdmission = THREE.MathUtils.clamp(-valveX, 0, portOuter - portInner);
    const leftExhaust = Math.max(0, Math.min(-portInner, valveHollowHalfWidth + valveX)
      - Math.max(-portOuter, -valveHollowHalfWidth + valveX));
    const rightExhaust = Math.max(0, Math.min(portOuter, valveHollowHalfWidth + valveX)
      - Math.max(portInner, -valveHollowHalfWidth + valveX));
    const pressure = (admission, exhaust) => THREE.MathUtils.clamp(
      0.5 + (admission - exhaust) / 0.08,
      0,
      1,
    );
    return {
      inputAngle,
      pistonAngle,
      pistonAngularSpeed,
      valveX,
      leftAdmission,
      rightAdmission,
      leftExhaust,
      rightExhaust,
      leftPressure: pressure(leftAdmission, leftExhaust),
      rightPressure: pressure(rightAdmission, rightExhaust),
      drivenSide: pistonAngularSpeed > 1e-9 ? 'right-of-B' : pistonAngularSpeed < -1e-9 ? 'left-of-B' : 'reversal',
      pistonTip: new THREE.Vector3(
        vaneTipRadius * Math.cos(pistonAngle),
        vaneTipRadius * Math.sin(pistonAngle),
        0,
      ),
    };
  };
  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return {
      ...stateAtInputAngle(sourceInputAngle + inputAngularSpeed * cycleTime),
      cycleTime,
      phase: cycleTime / cycleDuration,
    };
  };

  // ---- fixed outlines -----------------------------------------------------
  // Round the corner where a straight side wall (offset `offset` off C)
  // meets a circle of radius R about C with a fillet of radius rho lying
  // inside both. Returns the fillet arc from the wall to the circle.
  const wallCircleFillet = (side, offset, R, rho, count = 14) => {
    const centerS = Math.sqrt((R - rho) ** 2 - (offset - rho) ** 2);
    const center = wallPoint(side, centerS, offset - rho);
    const onWall = wallPoint(side, centerS, offset);
    const onCircle = [center[0] * R / (R - rho), center[1] * R / (R - rho)];
    const a0 = Math.atan2(onWall[1] - center[1], onWall[0] - center[0]);
    let sweep = Math.atan2(onCircle[1] - center[1], onCircle[0] - center[0]) - a0;
    while (sweep > Math.PI) sweep -= FULL_TURN;
    while (sweep < -Math.PI) sweep += FULL_TURN;
    return arcPoints(center, rho, a0, a0 + sweep, count);
  };
  const boreLeft = wallAtRadius(-1, boreRadius, wallOffset);
  const boreRight = wallAtRadius(1, boreRadius, wallOffset);
  const cavityCornerRight = wallCircleFillet(1, wallOffset, passageOuterRadius, 0.45);
  const cavityCornerLeft = wallCircleFillet(-1, wallOffset, passageOuterRadius, 0.45).reverse();
  const angleOf = ([x, y]) => Math.atan2(y, x);
  const wedge = ringPolygon([
    boreRight,
    ...cavityCornerRight,
    ...arcPoints([0, 0], passageOuterRadius, angleOf(cavityCornerRight.at(-1)), angleOf(cavityCornerLeft[0]), 64).slice(1, -1),
    ...cavityCornerLeft,
    boreLeft,
    [0, 0], // closed by the bore itself (unioned below), so no sliver is left
  ]);
  const tongueCap = (angle) => circlePolygon(
    [((chamberRadius + tongueOuterRadius) / 2) * Math.cos(angle),
      ((chamberRadius + tongueOuterRadius) / 2) * Math.sin(angle)],
    (tongueOuterRadius - chamberRadius) / 2,
    32,
  );
  const tongue = polygonClipping.union(
    ringPolygon([
      ...arcPoints([0, 0], tongueOuterRadius, Math.PI / 2 - tongueHalfSpan, Math.PI / 2 + tongueHalfSpan, 64),
      ...arcPoints([0, 0], chamberRadius, Math.PI / 2 + tongueHalfSpan, Math.PI / 2 - tongueHalfSpan, 64),
    ]),
    tongueCap(Math.PI / 2 - tongueHalfSpan),
    tongueCap(Math.PI / 2 + tongueHalfSpan),
    ringPolygon([[-portInner, 5.1], [portInner, 5.1], [portInner, valveFaceY], [-portInner, valveFaceY]]),
  );
  const risers = [-1, 1].map((side) => ringPolygon([
    [side * portInner, 5.45], [side * portOuter, 5.45],
    [side * portOuter, valveFaceY], [side * portInner, valveFaceY],
  ]));
  const workingCavity = polygonClipping.difference(
    polygonClipping.union(wedge, ...risers, circlePolygon([0, 0], boreRadius, 96)),
    tongue,
  );
  const exhaustChannel = polygonClipping.union(
    ringPolygon([[-exhaustHalfWidth, exhaustBottom], [exhaustHalfWidth, exhaustBottom],
      [exhaustHalfWidth, valveFaceY], [-exhaustHalfWidth, valveFaceY]]),
    circlePolygon([0, exhaustBottom], exhaustHalfWidth, 32),
  );
  const chestCavity = ringPolygon([[-chestInnerHalfWidth, valveFaceY], [chestInnerHalfWidth, valveFaceY],
    [chestInnerHalfWidth, chestInnerTop], [-chestInnerHalfWidth, chestInnerTop]]);
  const chestRightWall = ringPolygon([[chestInnerHalfWidth, valveFaceY], [chestOuterHalfWidth, valveFaceY],
    [chestOuterHalfWidth, chestInnerTop], [chestInnerHalfWidth, chestInnerTop]]);

  // Outer contour of casing A: foot, flared neck, walls a constant thickness
  // off the chamber sides, rounded shoulders and the valve chest.
  const outerOffset = wallOffset + wallThickness;
  const shoulderRadius = passageOuterRadius + wallThickness;
  const neckHalfWidth = 1.3;
  const neckMeet = (side) => wallPoint(
    side,
    (outerOffset * Math.sin(wallAxisAngle) - neckHalfWidth) / Math.cos(wallAxisAngle),
    outerOffset,
  );
  const chestShoulderY = Math.sqrt(shoulderRadius ** 2 - chestOuterHalfWidth ** 2);
  const shoulderRight = wallCircleFillet(1, outerOffset, shoulderRadius, 0.9);
  const shoulderLeft = wallCircleFillet(-1, outerOffset, shoulderRadius, 0.9).reverse();
  const neckFillet = (side) => {
    // concave fillet between the vertical neck side and the outer wall line
    const vertices = [[side * neckHalfWidth, -0.35], neckMeet(side), wallPoint(side, 4, outerOffset)];
    return filletPath(vertices, [0, 0.55, 0], 10).slice(1, -1);
  };
  const outerOutline = ringPolygon([
    [-2.3, -0.9], [2.3, -0.9], [2.3, -0.35], [neckHalfWidth, -0.35],
    ...neckFillet(1),
    ...shoulderRight,
    ...arcPoints([0, 0], shoulderRadius, angleOf(shoulderRight.at(-1)), Math.atan2(chestShoulderY, chestOuterHalfWidth), 24).slice(1),
    [chestOuterHalfWidth, chestOuterTop], [-chestOuterHalfWidth, chestOuterTop],
    ...arcPoints([0, 0], shoulderRadius, Math.atan2(chestShoulderY, -chestOuterHalfWidth), angleOf(shoulderLeft[0]), 24).slice(0, -1),
    ...shoulderLeft,
    ...neckFillet(-1).reverse(),
    [-neckHalfWidth, -0.35], [-2.3, -0.35],
  ]);
  const allVoids = polygonClipping.union(workingCavity, exhaustChannel, chestCavity, chestRightWall);
  const casingOutline = polygonClipping.difference(outerOutline, allVoids);

  const frameMaterial = matte(PALETTE.frame, { metalness: 0.24, roughness: 0.54 });
  const backMaterial = matte(0x7d8786, { metalness: 0.18, roughness: 0.6 });
  const darkMaterial = matte(PALETTE.ink, { metalness: 0.3, roughness: 0.43 });
  const pistonMaterial = matte(PALETTE.driver, { metalness: 0.2, roughness: 0.48 });
  const valveMaterial = matte(PALETTE.driven, { metalness: 0.23, roughness: 0.45 });

  const casingA = sectionPlate(casingOutline, zBack, 0, frameMaterial,
    'sectioned-cast-casing-A-with-sector-chamber-tongue-passages-and-chest');
  root.add(casingA);
  // The chest's right wall carries the valve-rod bore, so it is built across
  // the section with a round hole for the rod.
  const chestWallGeometry = (() => {
    // shape in (-z, y), extruded along +x
    const shape = new THREE.Shape([
      new THREE.Vector2(0, valveFaceY), new THREE.Vector2(depth, valveFaceY),
      new THREE.Vector2(depth, chestInnerTop), new THREE.Vector2(0, chestInnerTop),
    ]);
    shape.holes.push(new THREE.Path().absarc(-rodZ, rodY, rodRadius + 0.012, 0, FULL_TURN, true));
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: chestOuterHalfWidth - chestInnerHalfWidth,
      bevelEnabled: false,
      curveSegments: 24,
    });
    geometry.applyMatrix4(new THREE.Matrix4().set(
      0, 0, 1, chestInnerHalfWidth,
      0, 1, 0, 0,
      -1, 0, 0, 0,
      0, 0, 0, 1,
    ));
    return geometry;
  })();
  const chestWallCut = frameMaterial.clone();
  chestWallCut.color.multiplyScalar(0.84);
  const chestRodWall = new THREE.Mesh(chestWallGeometry, [frameMaterial, chestWallCut]);
  chestRodWall.userData.role = 'sectioned-right-wall-of-valve-chest-with-rod-bore';
  root.add(chestRodWall);
  const gland = new THREE.Mesh(latheSectionGeometry(
    [[rodRadius + 0.012, 0], [0.2, 0], [0.2, 0.08], [0.15, 0.08], [0.15, 0.26], [rodRadius + 0.012, 0.26]],
    { segments: 40, phiStart: 0, phiLength: FULL_TURN },
  ), [frameMaterial, frameMaterial]);
  gland.rotation.z = -Math.PI / 2;
  gland.position.set(chestOuterHalfWidth, rodY, rodZ);
  gland.userData.role = 'stuffing-box-of-valve-rod-on-chest';
  root.add(gland);

  const backCover = sectionPlate(polygonClipping.difference(
    outerOutline,
    circlePolygon([0, 0], shaftRadius + 0.01, 64),
    circlePolygon([0, exhaustBottom + 0.06], exhaustHalfWidth, 32),
  ), zBack - backThickness, zBack, backMaterial, 'solid-back-of-casing-A-with-exhaust-outlet-and-shaft-bore');
  // The back is not cut: all its faces take the wall shade.
  backCover.material = [backMaterial, backMaterial];
  root.add(backCover);
  const exhaustPipe = new THREE.Mesh(exhaustElbowGeometry([0, exhaustBottom + 0.06], zBack - backThickness,
    exhaustHalfWidth, 0.04, { back: 0.2, drop: 0.5 }), backMaterial);
  exhaustPipe.userData.role = 'exhaust-pipe-from-the-port-under-D';
  root.add(exhaustPipe);

  // ---- rock shaft C with vane B ---------------------------------------------
  const rockshaft = new THREE.Group();
  rockshaft.userData.role = 'rock-shaft-C-with-keyed-vane-piston-B';
  const vaneOutline = polygonClipping.union(
    circlePolygon([0, 0], hubRadius, 96),
    ringPolygon([
      [0.3, -vaneHalfWidth], [Math.sqrt(vaneTipRadius ** 2 - vaneHalfWidth ** 2), -vaneHalfWidth],
      ...arcPoints([0, 0], vaneTipRadius, -Math.asin(vaneHalfWidth / vaneTipRadius),
        Math.asin(vaneHalfWidth / vaneTipRadius), 8).slice(1, -1),
      [Math.sqrt(vaneTipRadius ** 2 - vaneHalfWidth ** 2), vaneHalfWidth], [0.3, vaneHalfWidth],
    ]),
  );
  const vaneOutlineWithoutShaft = polygonClipping.difference(vaneOutline, circlePolygon([0, 0], shaftRadius, 64));
  const pistonB = partPlate(vaneOutlineWithoutShaft, zBack + 0.01, -0.01, pistonMaterial,
    'vane-piston-B-with-hub-keyed-to-C');
  rockshaft.add(pistonB);
  const shaftBackZ = zBack - backThickness - 0.8;
  const shaftC = new THREE.Mesh(latheSectionGeometry(
    [[0, shaftBackZ], [shaftRadius, shaftBackZ], [shaftRadius, -0.005], [0, -0.005]],
    { segments: 48, phiStart: 0, phiLength: FULL_TURN },
  ), darkMaterial);
  // lathe axis (local y) turned onto z
  shaftC.rotation.x = Math.PI / 2;
  shaftC.userData.role = 'rock-shaft-C-through-back-of-casing';
  rockshaft.add(shaftC);
  root.add(rockshaft);

  // ---- slide valve D ----------------------------------------------------------
  const valveD = new THREE.Group();
  valveD.userData.role = 'slide-valve-D-on-port-face';
  const valveOutline = ringPolygon(filletPath([
    [-valveHalfLength, valveFaceY + 0.004], [-valveHollowHalfWidth, valveFaceY + 0.004],
    ...arcPoints([0, valveFaceY], valveHollowHalfWidth, Math.PI, 0, 24).map(([x, y]) => [x, valveFaceY + 0.004 + (y - valveFaceY) * 0.62]).slice(1, -1),
    [valveHollowHalfWidth, valveFaceY + 0.004], [valveHalfLength, valveFaceY + 0.004],
    [valveHalfLength, valveFaceY + valveHeight], [-valveHalfLength, valveFaceY + valveHeight],
  ], [0, 0, ...Array(23).fill(0), 0, 0, 0.1, 0.1], 6));
  const valveBody = partPlate(valveOutline, zBack + 0.1, -0.1, valveMaterial, 'D-slide-valve-body-with-exhaust-hollow');
  valveD.add(valveBody);
  // The rod's inner end runs 0.01 into D (its end cap lay in the plane where
  // the chest steam meets D and flickered); its outer end is unchanged.
  const rodInset = 0.01;
  const valveRod = new THREE.Mesh(new THREE.CylinderGeometry(rodRadius, rodRadius, rodLength + rodInset, 24), valveMaterial);
  valveRod.rotation.z = Math.PI / 2;
  valveRod.position.set(valveHalfLength - rodInset + (rodLength + rodInset) / 2, rodY, rodZ);
  valveRod.userData.role = 'valve-rod-of-D-through-stuffing-box';
  valveD.add(valveRod);
  root.add(valveD);

  // ---- steam --------------------------------------------------------------------
  const steamZ0 = zBack + 0.015;
  const steamZ1 = -0.015;
  const leftSteam = steamVolume('steam-in-left-working-space-of-A', steamZ0, steamZ1);
  const rightSteam = steamVolume('steam-in-right-working-space-of-A', steamZ0, steamZ1);
  const chestSteam = steamVolume('live-steam-in-valve-chest', steamZ0, steamZ1);
  const exhaustSteam = steamVolume('exhaust-steam-in-D-hollow-and-exhaust-port', steamZ0, steamZ1);
  root.add(leftSteam, rightSteam, chestSteam, exhaustSteam);
  const leftProbe = [-(portInner + portOuter) / 2, valveFaceY - 0.2];
  const rightProbe = [(portInner + portOuter) / 2, valveFaceY - 0.2];
  const rotate = (multi, angle) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return multi.map((polygon) => polygon.map((ring) => ring.map(([x, y]) => [x * c - y * s, x * s + y * c])));
  };
  const translateX = (multi, dx) => multi.map((polygon) => polygon.map((ring) => ring.map(([x, y]) => [x + dx, y])));
  // For splitting the chamber, B is taken up into the tongue it seals on.
  const vaneSplitter = polygonClipping.union(
    circlePolygon([0, 0], boreRadius + 0.001, 64),
    ringPolygon([[0, -vaneHalfWidth], [chamberRadius + 0.12, -vaneHalfWidth],
      [chamberRadius + 0.12, vaneHalfWidth], [0, vaneHalfWidth]]),
  );
  const valveEnvelope = ringPolygon([[-valveHalfLength, valveFaceY], [valveHalfLength, valveFaceY],
    [valveHalfLength, valveFaceY + valveHeight], [-valveHalfLength, valveFaceY + valveHeight]]);
  const valveHollow = ringPolygon([
    [-valveHollowHalfWidth, valveFaceY],
    ...arcPoints([0, valveFaceY], valveHollowHalfWidth, Math.PI, 0, 24)
      .map(([x, y]) => [x, valveFaceY + (y - valveFaceY) * 0.62]).slice(1, -1),
    [valveHollowHalfWidth, valveFaceY],
  ]);
  const steamReport = {};
  const updateSteam = (state) => {
    const spaces = safeClip('difference', workingCavity, rotate(vaneSplitter, state.pistonAngle));
    const left = piecesContaining(spaces, [leftProbe]);
    const right = piecesContaining(spaces, [rightProbe]);
    leftSteam.userData.setRegion(left, state.leftPressure);
    rightSteam.userData.setRegion(right, state.rightPressure);
    chestSteam.userData.setRegion(safeClip('difference', chestCavity, translateX(valveEnvelope, state.valveX)), 1);
    exhaustSteam.userData.setRegion(safeClip('union', exhaustChannel, translateX(valveHollow, state.valveX)), 0);
    steamReport.leftArea = multiArea(left);
    steamReport.rightArea = multiArea(right);
    steamReport.spaceCount = spaces.length;
  };

  const update = (time) => {
    const state = stateAtTime(time);
    rockshaft.rotation.z = state.pistonAngle;
    valveD.position.x = state.valveX;
    updateSteam(state);
  };

  const sourceState = stateAtTime(0);
  root.userData = {
    animationTiming: { authoredCyclePeriod: cycleDuration, targetCycleDuration: 2 },
    archetype: 'fixed-sector-chamber-with-vane-piston-on-rockshaft-and-D-slide-valve-over-two-passages',
    blocks: {
      casingA, chestRodWall, gland, backCover, rockshaft, pistonB, shaftC, valveD, valveBody, valveRod,
      leftSteam, rightSteam, chestSteam, exhaustSteam,
    },
    degreesOfFreedom: { independentPrescribedInputs: 1, operatingDegreesOfFreedom: 1 },
    dynamics: {
      steamSpaces: 'Each working space is the part of the chamber, passage and riser on one side of B, recomputed from B each frame; its steam is live while D uncovers its port to the chest and exhaust while the D hollow joins it to the exhaust port.',
      pressureForcesLeakageAndThermodynamicsModeled: false,
    },
    fidelity: 'authored',
    geometry: {
      hubRadius, boreRadius, chamberRadius, tongueOuterRadius, passageOuterRadius, tongueHalfSpan,
      wallAxisAngle, wallOffset, pistonAngularAmplitude, vaneHalfWidth, vaneTipRadius, depth,
      portInner, portOuter, valveHalfLength, valveHollowHalfWidth, valveTravelAmplitude, valveFaceY,
      cycleDuration, inputAngularSpeed, casingOutline, workingCavity, exhaustChannel, chestCavity,
    },
    mechanism: 'Sector chamber A is centred on rock-shaft C; vane piston B keyed to C divides it into two working spaces. A fixed curved tongue closes the top of the chamber, and the two passages from the valve face run over it and down round its ends into the chamber corners. The D slide valve admits chest steam to the passage behind B and joins the passage ahead of B, through its hollow, to the exhaust port that leaves through the back of the casting. D leads B by a quarter cycle.',
    motion: { cycleDuration, inputAngularSpeed, pistonAngularStroke: 2 * pistonAngularAmplitude, valveStroke: 2 * valveTravelAmplitude },
    sourceAnimation: {
      available: true,
      independentlyReconstructed: true,
      officialCanvasCyclePeriod: 4,
      reason: 'The official Movement 422 page draws one sector chamber whose top is a curved tongue with rounded ends; the two passages from the valve face pass over the tongue and turn down round its ends into the chamber corners, the centre port under D leads to a round exhaust opening, and B rocks between about 67 and 113 degrees with D a quarter cycle ahead. It was studied for topology, proportions and phase only.',
    },
    sourcePose: { pistonAngle: sourceState.pistonAngle, valveX: sourceState.valveX },
    sourceReference: {
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 422',
      brownPlate422: { imageWidth: 525, imageHeight: 525, rockshaftCApproximateCenterPixels: [264, 440], chestTopPixels: 87, pixelsPerUnit: 48.4 },
      reconstructionDisclosure: 'Brown gives no dimensions, port areas, lap, depth of the casting or pressures. The passage widths, zero-lap valve, casting depth, exhaust outlet through the back and the four-second cycle are engineered; the crank Brown mentions but does not draw is not built.',
    },
    stateAtInputAngle,
    stateAtTime,
    steamReport,
    update,
  };
  root.userData.cameraDirection = new THREE.Vector3(0.8, 0.3, 14);
  root.userData.cameraFov = 8;
  // Built in the official trace's units; shown at the earlier model scale.
  root.scale.setScalar(0.46);
  update(0);
  markShadows(root);
  for (const steam of [leftSteam, rightSteam, chestSteam, exhaustSteam]) {
    steam.castShadow = false;
    steam.receiveShadow = false;
  }
  fitPistonGuide(root, update, cycleDuration);
  return { cameraDirection: root.userData.cameraDirection, root, update };
}

export function createAuthoredSectorPistonEngineMovement(movement) {
  if (movement.id !== 422) return null;
  return sectorPistonEngine(movement);
}
