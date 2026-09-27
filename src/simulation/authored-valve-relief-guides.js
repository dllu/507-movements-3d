import { plate, poly, circle, capsule, polygonClipping as clip } from './finite-plate-geometry.js';
import { boredPlanarLinkGeometry } from './bored-planar-link.js';
import * as THREE from 'three';
import {applyCutawayFor} from './cutaway-presentations.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';
import { creaseIndexedNormals } from './crease-normals.js';
import { sectionPlate, steamVolume, ringPolygon } from './steam-section-kit.js';

const FULL_TURN = Math.PI * 2;
const GAUSS_NODES = [
  -0.9602898564975363,
  -0.7966664774136267,
  -0.5255324099163290,
  -0.1834346424956498,
  0.1834346424956498,
  0.5255324099163290,
  0.7966664774136267,
  0.9602898564975363,
];
const GAUSS_WEIGHTS = [
  0.1012285362903763,
  0.2223810344533745,
  0.3137066458778873,
  0.3626837833783620,
  0.3626837833783620,
  0.3137066458778873,
  0.2223810344533745,
  0.1012285362903763,
];

function cylinderAlongZ(radius, length, material, segments = 40) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

// Back half of a solid of revolution about the vertical axis, closed by its
// two section faces in the z = 0 plane: Brown draws the casing in section.
function sectionedHalfLathe(profile, segments = 72) {
  const points = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const lathe = new THREE.LatheGeometry([...points, points[0]], segments,
    Math.PI / 2, Math.PI).toNonIndexed();
  const shape = new THREE.Shape(points);
  const right = new THREE.ShapeGeometry(shape).toNonIndexed();
  const left = right.clone();
  left.scale(-1, 1, 1);
  const leftPositions = left.getAttribute('position');
  for (let index = 0; index < leftPositions.count; index += 3) {
    for (const attributeName of ['position', 'normal', 'uv']) {
      const attribute = left.getAttribute(attributeName);
      for (let component = 0; component < attribute.itemSize; component += 1) {
        const first = attribute.getComponent(index + 1, component);
        attribute.setComponent(index + 1, component,
          attribute.getComponent(index + 2, component));
        attribute.setComponent(index + 2, component, first);
      }
    }
  }
  const merged = mergeGeometries([lathe, right, left]);
  [lathe, right, left].forEach(part => part.dispose());
  merged.deleteAttribute('normal');
  const welded = mergeVertices(merged, 1e-6);
  merged.dispose();
  // Hard edges where the section's cut faces meet the cone.
  return creaseIndexedNormals(welded);
}

function gaussIntegrate(start, end, evaluate) {
  const midpoint = (start + end) / 2;
  const halfSpan = (end - start) / 2;
  let sum = 0;
  for (let index = 0; index < GAUSS_NODES.length; index += 1) {
    sum += GAUSS_WEIGHTS[index]
      * evaluate(midpoint + halfSpan * GAUSS_NODES[index]);
  }
  return halfSpan * sum;
}

function valveReliefGuide(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  // Pass 71: a working slide-valve travel, a port width plus lap each way
  // (it was 0.95, more than half of A, which no port layout could serve).
  const valveAmplitude = 0.45;
  const valvePinY = -1.12;
  const rodLength = 3.50;
  const rollerFraction = 1 / 3;
  // Brown's roller and slot are slender beside the rod boss.
  const rollerRadius = 0.16;
  const guideRailRadius = 0.075;
  const guideClearance = 0.018;
  const guideCenterlineOffset = rollerRadius
    + guideRailRadius + guideClearance;
  const upperPinGuideX = 0;
  const guideAdjustmentY = 0;

  const riseAtValveX = (valveX) => Math.sqrt(
    rodLength ** 2 - valveX ** 2,
  );
  const rollerCenterAtValveX = (valveX) => {
    const rise = riseAtValveX(valveX);
    return new THREE.Vector3(
      valveX * (1 - rollerFraction),
      valvePinY + rollerFraction * rise,
      0.48,
    );
  };
  const centerPathDerivativeAtValveX = (valveX) => {
    const rise = riseAtValveX(valveX);
    return new THREE.Vector3(
      1 - rollerFraction,
      -rollerFraction * valveX / rise,
      0,
    );
  };
  const centerPathUnitTangentAtValveX = (valveX) =>
    centerPathDerivativeAtValveX(valveX).normalize();
  const centerPathUnitNormalAtValveX = (valveX) => {
    const tangent = centerPathUnitTangentAtValveX(valveX);
    return new THREE.Vector3(-tangent.y, tangent.x, 0);
  };
  const guidePointsAtValveX = (valveX) => {
    const center = rollerCenterAtValveX(valveX);
    const normal = centerPathUnitNormalAtValveX(valveX);
    return {
      center,
      lower: center.clone().addScaledVector(
        normal,
        -guideCenterlineOffset,
      ),
      normal,
      tangent: centerPathUnitTangentAtValveX(valveX),
      upper: center.clone().addScaledVector(
        normal,
        guideCenterlineOffset,
      ),
    };
  };
  const centerPathSpeedPerValveX = (valveX) =>
    centerPathDerivativeAtValveX(valveX).length();
  const centerPathSpeedDerivative = (valveX) => {
    const rise = riseAtValveX(valveX);
    const verticalSlope = rollerFraction * valveX / rise;
    const verticalSlopeDerivative = rollerFraction * rodLength ** 2
      / rise ** 3;
    return verticalSlope * verticalSlopeDerivative
      / centerPathSpeedPerValveX(valveX);
  };
  const signedCenterPathLength = (valveX) => gaussIntegrate(
    0,
    valveX,
    centerPathSpeedPerValveX,
  );

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const valveX = valveAmplitude * Math.sin(inputAngle);
    const valveSpeed = valveAmplitude * inputSpeed * Math.cos(inputAngle);
    const valveAcceleration = valveAmplitude * (
      inputAcceleration * Math.cos(inputAngle)
      - inputSpeed ** 2 * Math.sin(inputAngle)
    );
    const rise = riseAtValveX(valveX);
    const upperPinY = valvePinY + rise;
    const upperPinSpeed = -valveX * valveSpeed / rise;
    const upperPinAcceleration = -(
      valveSpeed ** 2 + valveX * valveAcceleration
    ) / rise - valveX ** 2 * valveSpeed ** 2 / rise ** 3;
    const lowerPin = new THREE.Vector3(valveX, valvePinY, 0.48);
    const upperPin = new THREE.Vector3(
      upperPinGuideX,
      upperPinY,
      0.48,
    );
    const lowerPinVelocity = new THREE.Vector3(valveSpeed, 0, 0);
    const upperPinVelocity = new THREE.Vector3(0, upperPinSpeed, 0);
    const lowerPinAcceleration = new THREE.Vector3(
      valveAcceleration,
      0,
      0,
    );
    const upperPinAccelerationVector = new THREE.Vector3(
      0,
      upperPinAcceleration,
      0,
    );
    const rodVector = upperPin.clone().sub(lowerPin);
    const relativePinVelocity = upperPinVelocity.clone()
      .sub(lowerPinVelocity);
    const relativePinAcceleration = upperPinAccelerationVector.clone()
      .sub(lowerPinAcceleration);
    const rollerCenter = lowerPin.clone().lerp(upperPin, rollerFraction);
    const rollerCenterVelocity = lowerPinVelocity.clone().lerp(
      upperPinVelocity,
      rollerFraction,
    );
    const rollerCenterAcceleration = lowerPinAcceleration.clone().lerp(
      upperPinAccelerationVector,
      rollerFraction,
    );
    const guide = guidePointsAtValveX(valveX);
    const pathScale = centerPathSpeedPerValveX(valveX);
    const pathScaleDerivative = centerPathSpeedDerivative(valveX);
    const signedPathSpeed = pathScale * valveSpeed;
    const signedPathAcceleration = pathScale * valveAcceleration
      + pathScaleDerivative * valveSpeed ** 2;
    const rollerAngle = -signedCenterPathLength(valveX) / rollerRadius;
    const rollerAngularSpeed = -signedPathSpeed / rollerRadius;
    const rollerAngularAcceleration = -signedPathAcceleration
      / rollerRadius;
    return {
      guideCenterLocusResidual: rollerCenter.distanceTo(guide.center),
      guideLowerCenterline: guide.lower,
      guideNormal: guide.normal,
      guideTangent: guide.tangent,
      guideUpperCenterline: guide.upper,
      inputAcceleration,
      inputAngle,
      inputSpeed,
      lowerGuideSurfaceGap: rollerCenter.distanceTo(guide.lower)
        - guideRailRadius - rollerRadius,
      lowerPin,
      lowerPinAcceleration,
      lowerPinVelocity,
      relativePinAcceleration,
      relativePinVelocity,
      rodAccelerationConstraintResidual:
        relativePinVelocity.lengthSq()
          + rodVector.dot(relativePinAcceleration),
      rodLengthResidual: rodVector.length() - rodLength,
      rodVector,
      rodVelocityConstraintResidual: rodVector.dot(relativePinVelocity),
      rollerAngle,
      rollerAngularAcceleration,
      rollerAngularSpeed,
      rollerCenter,
      rollerCenterAcceleration,
      rollerCenterVelocity,
      rollerNoSlipResidual: rollerAngularSpeed * rollerRadius
        + signedPathSpeed,
      rollerPathLength: signedCenterPathLength(valveX),
      signedPathAcceleration,
      signedPathSpeed,
      upperGuideSurfaceGap: rollerCenter.distanceTo(guide.upper)
        - guideRailRadius - rollerRadius,
      upperPin,
      upperPinAcceleration,
      upperPinAccelerationVector,
      upperPinSpeed,
      upperPinVelocity,
      valveAcceleration,
      valveDirection: valveSpeed > 1e-10
        ? 'right'
        : valveSpeed < -1e-10
          ? 'left'
          : 'reversal',
      valveSpeed,
      valveX,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return {
      ...stateAtInputAngle(inputAngularSpeed * cycleTime),
      cycleTime,
      phase: cycleTime / cycleDuration,
    };
  };

  const rollerPathHalfLength = signedCenterPathLength(valveAmplitude);
  const geometry = {
    cycleDuration,
    guideAdjustmentRange: [-0.26, 0.26],
    guideAdjustmentY,
    guideCenterlineOffset,
    guideClearance,
    guideRailRadius,
    inputAngularSpeed,
    rodLength,
    rollerFraction,
    rollerPathHalfLength,
    rollerRadius,
    upperPinGuideX,
    valveAmplitude,
    valvePinY,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.24,
    roughness: 0.55,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const rodMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.50,
  });
  const valveMaterial = matte(PALETTE.driven, {
    metalness: 0.20,
    roughness: 0.48,
  });
  const guideMaterial = matte(0x477b5c, {
    metalness: 0.17,
    roughness: 0.52,
  });
  const rollerMaterial = matte(PALETTE.accent, {
    metalness: 0.30,
    roughness: 0.42,
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-valve-seat-and-suspended-guide-frame';
  // Brown's hatched ground under the seat is the cylinder casting built
  // below (pass 71); no separate foundation slab is drawn.
  // Brown's port under A is a cavity in the seat, not a part: the seat is
  // bored through with a plain port that A covers at mid-stroke (the p57
  // dark port stub hung below the seat and is not built).
  // Pass 71: the seat has Brown's three ports: an exhaust port in the
  // middle and a steam port either side, each running down into the
  // cylinder casting below (Brown's hatched ground). A is a D slide valve:
  // its hollow joins one steam port to the exhaust while the other is
  // uncovered to the chest.
  const ports = { exhaust: [-0.12, 0.12], left: [-0.85, -0.5], right: [0.5, 0.85] };
  const portHalfDepth = 0.3;
  const valveSeat = new THREE.Mesh(
    plate(clip.difference(
      poly([[-2.10, -0.63], [2.10, -0.63], [2.10, 0.63], [-2.10, 0.63]]),
      ...Object.values(ports).map(([x0, x1]) => poly([[x0, -portHalfDepth], [x1, -portHalfDepth], [x1, portHalfDepth], [x0, portHalfDepth]])),
    ), -0.09, 0.09),
    frameMaterial,
  );
  // The plate is drawn in x-z (local y is world z) and 0.18 thick in y.
  valveSeat.rotation.x = Math.PI / 2;
  valveSeat.position.set(0, -2.09, 0);
  valveSeat.userData.role = 'fixed-horizontal-valve-seat';
  fixedFrame.add(valveSeat);
  // The cylinder casting under the seat, cut on the section plane like the
  // casing, with the three passages: the exhaust straight down under an
  // arch, the steam passages bending out and down to the cylinder ends.
  const seatBottom = -2.18;
  const blockBottom = -2.8;
  const bend = (x0, x1, side) => {
    const points = [];
    for (let i = 0; i <= 16; i += 1) {
      const t = i / 16;
      const y = seatBottom + 0.02 - t * (seatBottom + 0.02 - blockBottom - 0.02);
      const shift = side * 0.55 * t * t;
      points.push([x0 + shift, y]);
    }
    const back = [];
    for (let i = 16; i >= 0; i -= 1) {
      const t = i / 16;
      const y = seatBottom + 0.02 - t * (seatBottom + 0.02 - blockBottom - 0.02);
      back.push([x1 + side * 0.55 * t * t, y]);
    }
    return ringPolygon([...points, ...back]);
  };
  const passages = {
    left: bend(-0.85, -0.5, -1),
    right: bend(0.5, 0.85, 1),
    exhaust: clip.union(
      poly([[-0.12, seatBottom + 0.02], [0.12, seatBottom + 0.02], [0.12, -2.55], [-0.12, -2.55]]),
      clip.intersection(poly(circle([0, blockBottom - 0.02], 0.42, 64)),
        poly([[-0.5, blockBottom - 0.03], [0.5, blockBottom - 0.03], [0.5, -2.5], [-0.5, -2.5]]))),
  };
  // The passages are cut in half by the section: their back halves stay in
  // the casting behind z = -0.3, the depth of the seat ports.
  const cylinderOutline = poly([[-2.10, blockBottom], [2.10, blockBottom], [2.10, seatBottom], [-2.10, seatBottom]]);
  const cylinderCasting = sectionPlate(clip.difference(cylinderOutline, ...Object.values(passages)),
    -portHalfDepth, 0.48, frameMaterial, 'fixed-cylinder-casting-under-the-seat-with-three-passages');
  const castingBack = new THREE.Mesh(plate(cylinderOutline, -0.63, -portHalfDepth), frameMaterial);
  castingBack.userData.role = 'fixed-back-half-of-cylinder-casting-behind-the-passages';
  fixedFrame.add(cylinderCasting, castingBack);
  // The seat is the floor of the valve chest: a back wall and two end walls
  // (cut at the same section plane as the casing) join it to the chest
  // cover above, so it no longer floats below the chest.
  const chestBackWall = new THREE.Mesh(new THREE.BoxGeometry(4.20, 1.44, 0.10), frameMaterial);
  chestBackWall.position.set(0, -1.28, -0.61);
  chestBackWall.userData.role = 'fixed-valve-chest-back-wall';
  fixedFrame.add(chestBackWall);
  for (const side of [-1, 1]) {
    const endWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.44, 1.14), frameMaterial);
    endWall.position.set(side * 2.04, -1.28, -0.09);
    endWall.userData.role = 'fixed-valve-chest-end-wall';
    fixedFrame.add(endWall);
  }
  // Brown sections the fixed casing through the rod plane: a hollow cone
  // with a bored top and a foot flange stands on the hatched chest cover,
  // whose recess below encloses guide D. Only the half behind the section
  // plane (the mechanism plane z = 0.48) is modelled, as the plate shows it.
  const casingAxisZ = 0.48;
  const casingMaterial = matte(PALETTE.frame, {
    metalness: 0.24,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  const conicalCasing = new THREE.Mesh(sectionedHalfLathe([
    [0.12, 3.64], [0.98, 3.64], [1.45, 0.49], [1.93, 0.49],
    [1.93, 0.70], [1.62, 0.70], [1.16, 3.92], [0.12, 3.92],
  ]), casingMaterial);
  conicalCasing.position.z = casingAxisZ;
  conicalCasing.userData.role = 'fixed-sectioned-conical-casing-over-guide-D';
  fixedFrame.add(conicalCasing);
  const chestCoverDepth = 2.0;
  const chestCover = new THREE.Mesh(plate(clip.union(...[-1, 1].map(side =>
    poly([[side * 3.2, 0.19], [side * 1.75, 0.19], [side * 1.75, -0.56],
      [side * 1.20, -0.56], [side * 1.20, -0.46], [side * 1.45, -0.46],
      [side * 1.45, 0.49], [side * 3.2, 0.49]]))),
  casingAxisZ - chestCoverDepth, casingAxisZ), casingMaterial);
  chestCover.userData.role = 'fixed-sectioned-chest-cover-and-guide-recess';
  fixedFrame.add(chestCover);
  const recessBack = new THREE.Mesh(
    new THREE.BoxGeometry(2.9, 1.05, 0.30),
    casingMaterial,
  );
  recessBack.position.set(0, -0.035, casingAxisZ - chestCoverDepth + 0.15);
  recessBack.userData.role = 'fixed-back-wall-of-guide-recess';
  fixedFrame.add(recessBack);
  root.add(fixedFrame);

  const guideAssemblyD = new THREE.Group();
  guideAssemblyD.position.y = guideAdjustmentY;
  guideAssemblyD.userData.role =
    'vertically-adjustable-suspended-two-arc-guide-D';
  guideAssemblyD.userData.adjustmentRange = geometry.guideAdjustmentRange;
  // Brown draws D as one solid casting hung from its screw inside the cone:
  // a tapered plate whose bell-shaped window narrows to the vertical slot for
  // B's upper pin and spreads at the foot into the curved slot whose upper
  // and lower edges are the two arcs D bearing on roller C.
  const slotHalfWidth = rollerRadius + guideClearance;
  // Brown's slot is a long slender arc, square-ended and reaching well past
  // C's travel, separated from the bell-shaped window above by a thin web.
  // Both edges follow the exact roller locus, extended beyond the stroke.
  // Ends at a third of B's length each side of centre, as Brown draws
  // them; the exact locus then droops about as far as his slot does.
  const slotEndValveX = 1.75;
  const bandPoints = (offset, end = slotEndValveX) => {
    const points = [];
    for (let index = 0; index <= 96; index += 1) {
      const valveX = THREE.MathUtils.lerp(-end, end, index / 96);
      const center = rollerCenterAtValveX(valveX);
      const normal = centerPathUnitNormalAtValveX(valveX);
      points.push([center.x + normal.x * offset, center.y + normal.y * offset]);
    }
    return points;
  };
  const arcSlot = poly([...bandPoints(slotHalfWidth),
    ...bandPoints(-slotHalfWidth).reverse()]);
  const upperPinSlotHalfWidth = 0.155;
  const upperPinSlotTop = valvePinY + rodLength + 0.21 + 0.03;
  const windowFoot = bandPoints(slotHalfWidth + 0.12, 1.82)
    .filter(([x]) => x >= 0);
  const [footX, footY] = windowFoot.at(-1);
  const windowRight = [...windowFoot, [footX, footY + 0.12],
    [0.84, 0.62], [0.58, 0.78], [0.40, 1.02], [0.28, 1.40],
    [upperPinSlotHalfWidth, 2.00], [upperPinSlotHalfWidth, upperPinSlotTop]];
  const rodWindow = poly([...windowRight,
    ...windowRight.slice(1).map(([x, y]) => [-x, y]).reverse()]);
  const upperPinSlotCap = poly(circle([0, upperPinSlotTop], upperPinSlotHalfWidth, 48));
  const guideHeadY = 3.02;
  // Brown's casting foot arches up under the slot, parallel to it.
  const castingFoot = bandPoints(-(slotHalfWidth + 0.16), 1.92).reverse();
  const castingOutline = poly([
    [-0.90, guideHeadY], [0.90, guideHeadY], [1.38, 0.62],
    [1.38, castingFoot[0][1]], ...castingFoot,
    [-1.38, castingFoot.at(-1)[1]], [-1.38, 0.62],
  ]);
  const castingDepth = [0.335, 0.625];
  const slottedCastingD = new THREE.Mesh(plate(clip.difference(castingOutline,
    arcSlot, rodWindow, upperPinSlotCap), ...castingDepth), guideMaterial);
  slottedCastingD.userData.role =
    'suspended-slotted-casting-D-whose-slot-edges-are-both-coupler-locus-arcs';
  guideAssemblyD.add(slottedCastingD);
  const adjustmentStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 4.23 - guideHeadY, 24),
    guideMaterial,
  );
  adjustmentStem.position.set(0, (4.23 + guideHeadY) / 2, casingAxisZ);
  adjustmentStem.userData.role = 'vertical-adjustment-screw-for-arcs-D';
  guideAssemblyD.add(adjustmentStem);
  const adjustmentNut = new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.20, 0.16, 6),
    rollerMaterial,
  );
  adjustmentNut.position.set(0, 4.00, casingAxisZ);
  adjustmentNut.userData.role = 'guide-D-height-adjustment-nut';
  guideAssemblyD.add(adjustmentNut);
  root.add(guideAssemblyD);

  const valveA = new THREE.Group();
  valveA.position.set(0, valvePinY, 0);
  valveA.userData.role = 'horizontally-sliding-valve-A';
  // A D slide valve: the hollow underneath is closed front and back.
  const valveHalfLength = 0.9;
  const hollowHalf = 0.45;
  const valveBody = new THREE.Group();
  valveBody.add(
    new THREE.Mesh(plate(clip.difference(
      poly([[-valveHalfLength, -0.225], [valveHalfLength, -0.225], [valveHalfLength, 0.225], [-valveHalfLength, 0.225]]),
      poly([[-hollowHalf, -0.24], [hollowHalf, -0.24], [hollowHalf, 0.0], [-hollowHalf, 0.0]])), -0.44, 0.44), valveMaterial),
    new THREE.Mesh(plate(poly([[-valveHalfLength, -0.225], [valveHalfLength, -0.225], [valveHalfLength, 0.225], [-valveHalfLength, 0.225]]),
      0.44, 0.54), valveMaterial),
    new THREE.Mesh(plate(poly([[-valveHalfLength, -0.225], [valveHalfLength, -0.225], [valveHalfLength, 0.225], [-valveHalfLength, 0.225]]),
      -0.54, -0.44), valveMaterial),
  );
  valveBody.children.forEach((mesh, index) => { mesh.userData.role = ['valve-A-with-D-hollow', 'valve-A-front-wall', 'valve-A-back-wall'][index]; });
  // Brown draws A broad and low on its seat, the pin block rising from it.
  valveBody.position.y = -0.655;
  valveBody.userData.role = 'flat-slide-valve-A-body-on-seat';
  valveA.add(valveBody);
  const valveNeck = new THREE.Mesh(
    plate(clip.difference(clip.union(poly(circle([0, 0], 0.20, 64)),
      poly([[-0.34, -0.43], [0.34, -0.43], [0.34, 0.06], [-0.34, 0.06]])),
      poly(circle([0, 0], 0.09, 64))), -0.30, 0.30),
    valveMaterial,
  );
  valveNeck.userData.role = 'valve-A-neck-to-rod-B-pin';
  valveA.add(valveNeck);
  const lowerPinMarker = cylinderAlongZ(0.08, 1.40, darkMaterial);
  lowerPinMarker.position.z = 0.35;
  lowerPinMarker.userData.role = 'lower-axle-joining-B-to-valve-A';
  valveA.add(lowerPinMarker);
  root.add(valveA);

  const upperPinSlider = new THREE.Group();
  upperPinSlider.position.set(0, valvePinY + rodLength, 0.48);
  upperPinSlider.userData.role = 'upper-pin-of-B-sliding-only-vertically';
  const upperSliderBlock = new THREE.Mesh(
    plate(clip.difference(poly([[-0.15, -0.21], [0.15, -0.21],
      [0.15, 0.21], [-0.15, 0.21]]), poly(circle([0, 0], 0.09, 64))), -0.17, 0.17),
    valveMaterial,
  );
  upperSliderBlock.userData.role = 'upper-pin-vertical-slider-block';
  upperPinSlider.add(upperSliderBlock);
  const upperPinMarker = cylinderAlongZ(0.08, 1.10, darkMaterial);
  upperPinMarker.position.z = 0;
  upperPinMarker.userData.role = 'upper-axle-of-rod-B';
  upperPinSlider.add(upperPinMarker);
  root.add(upperPinSlider);

  // B runs in front of casting D, as Brown draws it over the slot.
  const rodPlaneZ = 0.76;
  const rodOutline = clip.union(capsule([0, 0], [rodLength, 0], 0.10, 32),
    poly(circle([0, 0], 0.17, 64)), poly(circle([rodLength, 0], 0.17, 64)),
    poly(circle([rollerFraction * rodLength, 0], 0.27, 64)));
  const rodHoles = [0, rollerFraction * rodLength, rodLength]
    .map(x => poly(circle([x, 0], 0.09, 64)));
  const rodB = new THREE.Mesh(plate(clip.difference(rodOutline, ...rodHoles), -0.08, 0.08), rodMaterial);
  rodB.userData.role = 'constant-length-relieving-rod-B';
  rodB.userData.setEndpoints = (start, end) => {
    rodB.position.set(start.x, start.y, rodPlaneZ);
    rodB.rotation.z = Math.atan2(end.y - start.y, end.x - start.x);
  };
  const rollerAxle = cylinderAlongZ(0.08, 0.54, darkMaterial);
  rollerAxle.position.set(rollerFraction * rodLength, 0, 0.60 - rodPlaneZ);
  rodB.add(rollerAxle);
  root.add(rodB);
  const rollerC = new THREE.Group();
  rollerC.userData.role = 'roller-C-fixed-one-third-along-rod-B';
  const rollerBody = new THREE.Mesh(boredPlanarLinkGeometry({ length: 0, width: 0,
    eyeRadius: rollerRadius, boreRadius: 0.09, depth: 0.26 }), rollerMaterial);
  rollerBody.userData.role = 'roller-C-body-captured-between-arcs-D';
  rollerC.add(rollerBody);
  root.add(rollerC);

  // ---- steam (pass 71) ------------------------------------------------------------------------
  const steamZ = [-0.55, 0.47];
  const passageZ = [-portHalfDepth + 0.015, 0.47];
  const steam = {
    chest: steamVolume('live-steam-in-the-valve-chest', ...steamZ),
    left: steamVolume('steam-in-left-port-and-passage', ...passageZ),
    right: steamVolume('steam-in-right-port-and-passage', ...passageZ),
    exhaust: steamVolume('exhaust-steam-in-middle-port-and-passage', ...passageZ),
  };
  for (const mesh of Object.values(steam)) root.add(mesh);
  const seatTop = -2.0;
  const portColumn = ([x0, x1]) => poly([[x0, seatBottom + 0.03], [x1, seatBottom + 0.03], [x1, seatTop], [x0, seatTop]]);
  steam.left.userData.base = clip.union(passages.left, portColumn(ports.left));
  steam.right.userData.base = clip.union(passages.right, portColumn(ports.right));
  steam.exhaust.userData.setRegion(clip.union(passages.exhaust, portColumn(ports.exhaust)), 0);
  const overlap = ([a0, a1], [b0, b1]) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  const portPressure = (port, valveX) => {
    const width = port[1] - port[0];
    const covered = overlap(port, [valveX - valveHalfLength, valveX + valveHalfLength]);
    const toChest = width - covered;
    const toHollow = overlap(port, [valveX - hollowHalf, valveX + hollowHalf]);
    return THREE.MathUtils.smoothstep(toChest - toHollow, -0.03, 0.03);
  };
  const chestInterior = poly([[-1.98, seatTop], [1.98, seatTop], [1.98, -0.57], [-1.98, -0.57]]);
  const updateSteam = (state) => {
    const x = state.valveX;
    const valveOutline = poly([[x - valveHalfLength, seatTop - 0.01], [x + valveHalfLength, seatTop - 0.01],
      [x + valveHalfLength, seatTop + 0.46], [x - valveHalfLength, seatTop + 0.46]]);
    steam.chest.userData.setRegion(clip.difference(chestInterior, valveOutline,
      poly(circle([x, valvePinY], 0.21, 48)), poly([[x - 0.35, seatTop + 0.44], [x + 0.35, seatTop + 0.44], [x + 0.35, valvePinY], [x - 0.35, valvePinY]]),
    ), 1);
    steam.left.userData.setRegion(steam.left.userData.base, portPressure(ports.left, x));
    steam.right.userData.setRegion(steam.right.userData.base, portPressure(ports.right, x));
  };

  const update = (time) => {
    const state = stateAtTime(time);
    valveA.position.x = state.valveX;
    updateSteam(state);
    upperPinSlider.position.y = state.upperPin.y;
    rodB.userData.setEndpoints(state.lowerPin, state.upperPin);
    rollerC.position.copy(state.rollerCenter);
    rollerC.rotation.z = state.rollerAngle;
  };

  const sourceState = stateAtTime(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'orthogonal-pin-guided-slide-valve-rod-with-one-third-roller-in-vertically-adjustable-captured-coupler-locus-arcs',
    blocks: {
      adjustmentNut,
      adjustmentStem,
      chestCover,
      conicalCasing,
      fixedFrame,
      recessBack,
      guideAssemblyD,
      rodB,
      rollerC,
      rollerBody,
      rollerAxle,
      valveBody,
      valveNeck,
      upperSliderBlock,
      lowerPinMarker,
      upperPinMarker,
      upperPinSlider,
      slottedCastingD,
      valveA,
      valveSeat,
    },
    degreesOfFreedom: {
      guideHeightConfigurationSettings: 1,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      rodAngleIndependent: false,
      rollerCenterIndependent: false,
      upperPinHeightIndependent: false,
    },
    dynamics: {
      clearanceComplianceSteamPressureLoadsAndBearingFrictionModeled: false,
      loadPath:
        'the suspended lower arc reacts the representative downward load at roller C so rod B need not transmit that full normal load into valve A’s seat',
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Valve A is prescribed to slide horizontally on its fixed seat. Constant-length rod B joins A’s lower horizontal pin to an upper pin constrained in one vertical slot. Roller C is rigidly located one-third along B and follows the resulting exact shallow coupler-locus arc between the two vertically adjustable suspended guides D. The lower guide can carry the downward load at C, relieving normal load and sliding friction at A.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      valveStroke: valveAmplitude * 2,
    },
    sourceAnimation: {
      available: true,
      independentlyReconstructed: true,
      officialCanvasCyclePeriod: 4,
      officialCanvasCyclesPerMinute: 15,
      officialCanvasModelPresent: true,
      reason:
        'The official Movement 418 page embeds a seven-part Canvas construction; it was inspected for topology, its 9.75-unit B rod, and C’s one-third placement. This 3D model is independently constructed and uses exact guide curves.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      rodAngle: Math.atan2(
        sourceState.rodVector.y,
        sourceState.rodVector.x,
      ),
      rollerCenter: sourceState.rollerCenter.clone(),
      valveX: sourceState.valveX,
    },
    sourceReference: {
      brownPlate418: {
        adjustableArcsDApproximateBoundsPixels: [149, 75, 386, 358],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 12,
        rodBApproximateBoundsPixels: [230, 92, 300, 399],
        rollerCApproximateCenterPixels: [259, 289],
        valveAApproximateBoundsPixels: [193, 384, 328, 457],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'A is a valve attached to the lower end of rod B',
          'A slides horizontally on its valve seat',
          'B’s upper pin slides in vertical slots',
          'roller C is attached to B',
          'C slides in two suspended arcs D',
          'D is vertically adjustable',
          'the purpose is to limit seat pressure and relieve valve friction',
        ],
        engravingEvidence:
          'Brown’s plate shows the valve and seat at the bottom, nearly vertical rod B, its upper pin captured in a straight vertical slot, roller C lower on B, and a two-sided suspended curved guide assembly D surrounding C.',
        officialCanvasEvidence:
          'The official page’s embedded model uses a 9.75-unit B rod, locates C at 3.25 units from its lower pin, constrains that pin horizontally and the upper pin vertically, and displays C between two close guide arcs. Its separate crank driver is not specified by Brown and is omitted here.',
        reconstructionDisclosure:
          'Brown gives no dimensions, guide-curve equation, roller diameter, adjustment range, pressure, loads, friction coefficient, input law, or timing. The 3.50 rod, one-third roller fraction corroborated by the official model, exact coupler-locus guide offsets, clearances, rail profiles, load-side rolling convention, frame, materials, and four-second display cycle are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 418',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      guideCenterLocus:
        'C=(1-fraction)*lowerPin+fraction*upperPin',
      lowerPinConstraint: 'lowerPin=(valveX,fixedY)',
      rodConstraint:
        'valveX^2+(upperPinY-valvePinY)^2=rodLength^2',
      rollerLoadedContact:
        'rollerAngularSpeed*rollerRadius+signedCenterPathSpeed=0 against the stationary lower guide',
      upperPinConstraint: 'upperPin=(fixedX,variableY)',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.25, -2.98, -1.55),
    new THREE.Vector3(3.25, 4.12, 1.18),
  );
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraDirection = new THREE.Vector3(1.2, 0.6, 12);
  root.userData.hideGround = true;
  root.userData.reconstruction = { rodPlaneZ,
    assumptions: 'The bored rod sits behind the roller guide; finite axles join the separated members. The existing prescribed input and illustrative roller-spin law do not solve steam loads or clearance take-up.' };
  root.traverse(object => { for (const material of [].concat(object.material ?? [])) material.fog = false; });
  root.userData.groundFloorY = -2.8;
  markShadows(root);
  cylinderCasting.receiveShadow = true;
  for (const mesh of Object.values(steam)) { mesh.castShadow = false; mesh.receiveShadow = false; }
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredValveReliefGuideMovement(movement) {
  if (movement.id !== 418) return null;
  return applyCutawayFor(valveReliefGuide(movement), movement.id);
}
