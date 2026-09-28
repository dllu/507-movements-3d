import * as THREE from 'three';
import { fitPistonGuide } from './piston-guide-parts.js';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { circle, plate, poly, polygonClipping as clip } from './finite-plate-geometry.js';
import { makeSeeThrough } from './see-through-part.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  const remainder = value % modulus;
  if (remainder === 0) return 0;
  return remainder < 0 ? remainder + modulus : remainder;
}

function cylinderAlongZ(radius, depth, material, segments = 48) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function centeredExtrusion(shape, depth, bevel = 0.01) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevel > 0,
    bevelSegments: bevel > 0 ? 2 : 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 64,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function horizontalCapsuleShape(radius, straightHalfLength) {
  const shape = new THREE.Shape();
  shape.moveTo(-straightHalfLength, -radius);
  shape.lineTo(straightHalfLength, -radius);
  shape.absarc(
    straightHalfLength,
    0,
    radius,
    -Math.PI / 2,
    Math.PI / 2,
    false,
  );
  shape.lineTo(-straightHalfLength, radius);
  shape.absarc(
    -straightHalfLength,
    0,
    radius,
    Math.PI / 2,
    Math.PI * 1.5,
    false,
  );
  shape.closePath();
  return shape;
}

function horizontalCapsuleRingShape(
  innerRadius,
  outerRadius,
  straightHalfLength,
) {
  const shape = horizontalCapsuleShape(outerRadius, straightHalfLength);
  const hole = new THREE.Path();
  hole.moveTo(straightHalfLength, -innerRadius);
  hole.lineTo(-straightHalfLength, -innerRadius);
  hole.absarc(
    -straightHalfLength,
    0,
    innerRadius,
    -Math.PI / 2,
    Math.PI / 2,
    true,
  );
  hole.lineTo(straightHalfLength, innerRadius);
  hole.absarc(
    straightHalfLength,
    0,
    innerRadius,
    Math.PI / 2,
    -Math.PI / 2,
    true,
  );
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

function triangleDisplacementAtPhase(phase, halfStroke) {
  const normalizedPhase = positiveModulo(phase, 1);
  if (normalizedPhase < 0.5) {
    return halfStroke * (1 - 4 * normalizedPhase);
  }
  return halfStroke * (4 * normalizedPhase - 3);
}

function triangleSlopeAtPhase(phase, halfStroke) {
  return positiveModulo(phase, 1) < 0.5
    ? -4 * halfStroke
    : 4 * halfStroke;
}

function grooveCenterAtPhase(phase, crankRadius, outputHalfStroke) {
  const normalizedPhase = positiveModulo(phase, 1);
  const angle = normalizedPhase * Math.PI * 2;
  return new THREE.Vector2(
    -crankRadius * Math.sin(angle),
    crankRadius * Math.cos(angle)
      - triangleDisplacementAtPhase(normalizedPhase, outputHalfStroke),
  );
}

function grooveDerivativeAtPhase(phase, crankRadius, outputHalfStroke) {
  const normalizedPhase = positiveModulo(phase, 1);
  const angle = normalizedPhase * Math.PI * 2;
  return new THREE.Vector2(
    -Math.PI * 2 * crankRadius * Math.cos(angle),
    -Math.PI * 2 * crankRadius * Math.sin(angle)
      - triangleSlopeAtPhase(normalizedPhase, outputHalfStroke),
  );
}


function sampledGrooveEdge(
  crankRadius,
  outputHalfStroke,
  grooveHalfWidth,
  side,
  sampleCount = 384,
) {
  const points = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const phase = index / sampleCount;
    const center = grooveCenterAtPhase(
      phase,
      crankRadius,
      outputHalfStroke,
    );
    const tangent = grooveDerivativeAtPhase(
      phase,
      crankRadius,
      outputHalfStroke,
    ).normalize();
    const normal = new THREE.Vector2(-tangent.y, tangent.x);
    points.push(new THREE.Vector3(
      center.x + side * normal.x * grooveHalfWidth,
      center.y + side * normal.y * grooveHalfWidth,
      0,
    ));
  }
  return points;
}

function makeLineLoop(points, material, z) {
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map((point) => new THREE.Vector3(point.x, point.y, z)),
  );
  const line = new THREE.LineLoop(geometry, material);
  line.userData.noShadow = true;
  return line;
}

function uniformVelocityEndlessGrooveCrosshead(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // The dimensions below are the coordinates published by the site's canvas
  // model.  They also agree with the 525 px engraving: a ten-unit disk drives
  // a 9.7-unit wrist, while the crosshead moves 8.7 units either side of the
  // shaft.  Keeping those two radii distinct is essential to the groove law.
  const sourceScale = 0.255;
  const sourceDiskRadius = 10;
  const sourceCrankRadius = 9.7;
  const sourceWristRadius = 0.3;
  const sourceHubRadius = 0.8;
  const sourceOutputHalfStroke = 8.7;
  const sourceYokeEndCenter = 7.25;
  const sourceYokeOuterHalfHeight = 3.5;
  const sourceStemHalfWidth = 1;
  // Brown's stems run off the plate; 26 (not 23) keeps each stem end outside
  // the guide-to-guide frame even at the far end of the stroke.
  const sourceStemEnd = 26;
  const sourceGuideCenter = 13.25;
  const sourceGuideHalfWidth = 2.5;
  const sourceGuideHalfHeight = 0.75;

  const diskRadius = sourceDiskRadius * sourceScale;
  const crankRadius = sourceCrankRadius * sourceScale;
  const wristRadius = sourceWristRadius * sourceScale;
  const hubRadius = sourceHubRadius * sourceScale;
  const outputHalfStroke = sourceOutputHalfStroke * sourceScale;
  const outputStroke = outputHalfStroke * 2;
  const yokeEndCenter = sourceYokeEndCenter * sourceScale;
  const yokeOuterHalfHeight = sourceYokeOuterHalfHeight * sourceScale;
  const stemHalfWidth = sourceStemHalfWidth * sourceScale;
  const stemEnd = sourceStemEnd * sourceScale;
  const guideCenter = sourceGuideCenter * sourceScale;
  const guideHalfWidth = sourceGuideHalfWidth * sourceScale;
  const guideHalfHeight = sourceGuideHalfHeight * sourceScale;
  const grooveRunningClearance = 0.014;
  const grooveHalfWidth = wristRadius + grooveRunningClearance;

  // control.js drives the historical canvas at 15 coordinate cycles/minute,
  // while movement 354 divides that coordinate by two.  Its physical crank
  // therefore makes 7.5 rpm, or one revolution every eight seconds.
  const sourceCoordinateCyclesPerMinute = 15;
  const inputRevolutionsPerMinute = sourceCoordinateCyclesPerMinute / 2;
  const inputAngularSpeed = fullTurn * inputRevolutionsPerMinute / 60;
  const inputCyclePeriod = fullTurn / inputAngularSpeed;
  // Viewed from Brown's side (behind the model's +z), so the wrist sits
  // right of the shaft as on the plate.
  const sourcePoseAngle = 0.274;
  const sourcePosePhase = positiveModulo(sourcePoseAngle / fullTurn, 1);
  const shaftCenter = new THREE.Vector3(0, -0.1, 0);

  const diskDepth = 0.34;
  const diskCenterZ = -0.23;
  const diskFrontZ = diskCenterZ + diskDepth / 2;
  const shaftRadius = hubRadius * 0.67;
  // The shaft ends inside the disk: Brown draws no shaft end or bearing.
  const shaftLength = 0.465;
  const shaftCenterZ = -0.1525; // back end 0.005 inside the hub's back face (no shared cap)
  // The groove is blind: cut from the disk side of the crosshead into a
  // solid back plate, so the wrist ends 0.013 short of the groove floor.
  const grooveFloorZ = 0.298;
  const wristBackZ = -0.305;
  const wristTipZ = grooveFloorZ - 0.013;
  const wristLength = wristTipZ - wristBackZ;
  const wristCenterZ = (wristTipZ + wristBackZ) / 2;
  const wristFrontZ = wristCenterZ + wristLength / 2;
  const wristCapDepth = 0.08;
  const yokeDepth = 0.3;
  const yokePlaneZ = 0.23;
  const yokeFrontZ = yokePlaneZ + yokeDepth / 2;
  const grooveFaceZ = yokeFrontZ + 0.018;
  const grooveCornerRadius = grooveHalfWidth;
  // One straight stem runs the full length on the crosshead's back face,
  // where Brown dashes it behind the figure; it is embedded 0.005 in the
  // back plate so the two share no face.
  const stemDepth = 0.245;
  const stemPlaneZ = yokeFrontZ - 0.005 + stemDepth / 2;
  const guideRunningClearance = 0.018;
  const guideInnerHalfWidth = stemHalfWidth + guideRunningClearance;
  const frameZ = -0.78;
  const frameHalfWidth = diskRadius + 0.48;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.59,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.61,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.2,
    roughness: 0.49,
  });
  const wristMaterial = matte(PALETTE.brass, {
    metalness: 0.27,
    roughness: 0.43,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.69,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.47 });
  const grooveEdgeMaterial = new THREE.LineBasicMaterial({
    color: PALETTE.ink,
  });

  const input = new THREE.Group();
  input.position.copy(shaftCenter);
  input.userData.role = 'uniformly-rotating-source-disk-and-crank-wrist';
  const inputRotor = new THREE.Group();
  inputRotor.userData.role = 'one-rigid-input-rotor';
  input.add(inputRotor);

  // Brown draws the disk as a broad ring (outer edge and raised rim) in
  // front, with the groove and stem dashed behind it. The view is his: the
  // disk faces the viewer and is see-through (the standard style for parts
  // that cover dotted working details), so the groove and wrist show.
  const diskMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.59,
  });
  const diskBody = cylinderAlongZ(
    diskRadius,
    diskDepth,
    diskMaterial,
    128,
  );
  diskBody.position.z = diskCenterZ;
  diskBody.userData.role = 'ten-source-unit-solid-crank-disk';
  inputRotor.add(diskBody);

  const rimDepth = 0.06;
  const diskRim = new THREE.Mesh(
    new THREE.TorusGeometry(diskRadius - 0.034, 0.034, 10, 128),
    darkMaterial,
  );
  diskRim.position.z = diskFrontZ + rimDepth;
  diskRim.userData.role = 'visible-outline-of-input-disk';
  inputRotor.add(diskRim);
  diskRim.visible = false;
  diskRim.userData.retiredInkOutline = true;
  // Brown inks the disk edges only because the plate is a line drawing;
  // the dark outline rings stay as hidden placeholders.
  // Brown's broad raised rim, on the face toward the crosshead.
  const diskFaceRim = new THREE.Mesh(
    boredLatheGeometry([
      { radial: diskRadius, axial: -rimDepth / 2 },
      { radial: diskRadius, axial: rimDepth / 2 },
    ], diskRadius * 0.79, 128),
    diskMaterial,
  );
  diskFaceRim.rotation.x = Math.PI / 2;
  // The raised rim is on the viewer's face, as Brown's ring.
  diskFaceRim.position.z = diskCenterZ - diskDepth / 2 - rimDepth / 2;
  diskFaceRim.userData.role = 'raised-rim-on-crosshead-face-of-input-disk';
  inputRotor.add(diskFaceRim);
  const diskFaceRimEdge = new THREE.Mesh(
    new THREE.TorusGeometry(diskRadius * 0.79 + 0.02, 0.022, 8, 128),
    darkMaterial,
  );
  diskFaceRimEdge.position.z = diskFrontZ + rimDepth;
  diskFaceRimEdge.userData.role = 'inner-edge-of-raised-disk-rim';
  inputRotor.add(diskFaceRimEdge);
  diskFaceRimEdge.visible = false;
  diskFaceRimEdge.userData.retiredInkOutline = true;

  const inputShaft = cylinderAlongZ(
    shaftRadius,
    shaftLength,
    darkMaterial,
    48,
  );
  inputShaft.position.z = shaftCenterZ;
  inputShaft.userData.role = 'fixed-axis-input-shaft';
  inputRotor.add(inputShaft);

  const shaftHub = cylinderAlongZ(
    hubRadius,
    diskDepth + 0.115,
    darkMaterial,
    48,
  );
  // Ends inside the far face, where Brown draws no hub.
  shaftHub.position.z = diskCenterZ + 0.0675;
  shaftHub.userData.role = 'central-input-hub';
  inputRotor.add(shaftHub);

  const hubFace = cylinderAlongZ(
    hubRadius * 0.72,
    0.055,
    driverMaterial,
    40,
  );
  hubFace.position.z = diskFrontZ + 0.11;
  hubFace.userData.role = 'front-face-of-central-input-hub';
  inputRotor.add(hubFace);

  const diskRotationIndexes = Array.from({ length: 8 }, (_, index) => {
    const angle = index * fullTurn / 8;
    const sourceInnerRadius = 8.15;
    const sourceOuterRadius = 8.55;
    const length = (sourceOuterRadius - sourceInnerRadius) * sourceScale;
    const radius = (sourceInnerRadius + sourceOuterRadius) * sourceScale / 2;
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.035, 0.035),
      indexMaterial,
    );
    marker.position.set(
      radius * Math.cos(angle),
      radius * Math.sin(angle),
      diskFrontZ + 0.048,
    );
    marker.rotation.z = angle;
    marker.userData.role = 'visible-radial-index-on-input-disk';
    marker.userData.index = index;
    inputRotor.add(marker);
    return marker;
  });

  const crankWrist = cylinderAlongZ(
    wristRadius,
    wristLength,
    wristMaterial,
    48,
  );
  crankWrist.position.set(0, crankRadius, wristCenterZ);
  crankWrist.userData.role =
    'single-crank-wrist-running-in-the-shaped-endless-groove';
  inputRotor.add(crankWrist);

  const wristCap = cylinderAlongZ(
    wristRadius * 1.22,
    wristCapDepth,
    wristMaterial,
    48,
  );
  wristCap.position.set(
    0,
    crankRadius,
    wristFrontZ + wristCapDepth / 2 + 0.012,
  );
  wristCap.userData.role = 'visible-cap-showing-the-crank-wrist-path';
  inputRotor.add(wristCap);
  // The wrist ends inside the blind groove; no cap is drawn.
  wristCap.visible = false;

  const yoke = new THREE.Group();
  yoke.userData.role =
    'nonrotating-crosshead-with-one-shaped-endless-groove';

  // Subtract the wrist's actual swept section, including the two corner
  // envelopes at the ideal instantaneous reversals.
  const grooveLoops = [-1, 1].map(side => poly(sampledGrooveEdge(
    crankRadius, outputHalfStroke, grooveHalfWidth, side, 384).map(p => [p.x, p.y])));
  const grooveSection = clip.union(clip.xor(...grooveLoops), ...[0, 0.5].map(phase => {
    const center = grooveCenterAtPhase(phase, crankRadius, outputHalfStroke);
    return poly(circle([center.x, center.y], grooveCornerRadius, 64));
  }));
  const yokeSection = poly(horizontalCapsuleShape(yokeOuterHalfHeight, yokeEndCenter)
    .getPoints(128).map(p => [p.x, p.y]));
  // Grooved layer (disk side) and back plate as one closed solid: the
  // grooved layer runs 0.002 into the back plate, so no faces coincide.
  const yokeBackZ = yokeFrontZ;
  const yokeDiskZ = yokePlaneZ - yokeDepth / 2;
  const floorLocal = grooveFloorZ - yokePlaneZ;
  const groovedLayer = plate(clip.difference(yokeSection, grooveSection), yokeDiskZ - yokePlaneZ, floorLocal + 0.002);
  const yokeGeometry = mergeGeometries([
    groovedLayer,
    plate(yokeSection, floorLocal, yokeBackZ - yokePlaneZ),
  ]);
  // Keep the milled layer's outline for the finite groove audits.
  yokeGeometry.userData.plate = groovedLayer.userData.plate;
  const yokeBody = new THREE.Mesh(yokeGeometry, drivenMaterial);
  yokeBody.position.z = yokePlaneZ;
  yokeBody.userData.role = 'source-proportioned-capsule-crosshead-plate';
  yoke.add(yokeBody);
  // A raised retaining strap ties the groove's inner island to the outer
  // crosshead without crossing the wrist's working depth. It is cut to the
  // stem's width and runs the crosshead's full height on the stem's line, so
  // it reads as Brown's stem passing straight across the crosshead (he dashes
  // the stem right through the figure) rather than as an extra bar.
  const islandRetainer = new THREE.Group();
  islandRetainer.userData.role = 'raised-retainer-joining-groove-island-to-crosshead';
  const retainerZ = wristFrontZ + wristCapDepth + 0.12;
  const outerStation = yokeOuterHalfHeight - 0.065;
  const strapWidth = 2 * stemHalfWidth;
  for (const y of [-outerStation, 0, outerStation]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.07,
      retainerZ - yokeFrontZ + 0.06), drivenMaterial);
    post.position.set(0, y, (retainerZ + yokeFrontZ) / 2);
    islandRetainer.add(post);
  }
  const strap = new THREE.Mesh(new THREE.BoxGeometry(strapWidth,
    2 * yokeOuterHalfHeight, 0.06), drivenMaterial);
  strap.position.set(0, 0, retainerZ);
  islandRetainer.add(strap);
  yoke.add(islandRetainer);
  // The blind groove's back plate holds the islands: no retainer needed.
  islandRetainer.visible = false;
  islandRetainer.traverse((part) => { part.visible = false; });


  const yokeOutlineThickness = 0.055;
  const yokeOutline = new THREE.Mesh(
    centeredExtrusion(
      horizontalCapsuleRingShape(
        yokeOuterHalfHeight - yokeOutlineThickness,
        yokeOuterHalfHeight,
        yokeEndCenter,
      ),
      0.025,
      0.003,
    ),
    darkMaterial,
  );
  yokeOutline.position.z = yokeFrontZ + 0.017;
  yokeOutline.userData.role = 'front-outline-of-capsule-crosshead';
  yoke.add(yokeOutline);
  yokeOutline.visible = false;
  yokeOutline.userData.retiredInkOutline = true;

  // Inspection anchors describe the open channel; no painted face or
  // corner disk occupies the volume in which the wrist now runs.
  const grooveBand = new THREE.Group();
  grooveBand.userData.role = 'actual-through-groove-inspection-frame';
  grooveBand.userData.section = grooveSection;
  yoke.add(grooveBand);
  const grooveCornerPockets = [0, 0.5].map((phase, index) => {
    const center = grooveCenterAtPhase(phase, crankRadius, outputHalfStroke);
    const pocket = new THREE.Object3D();
    pocket.position.set(center.x, center.y, grooveFaceZ + 0.002);
    pocket.userData.role = 'open-groove-corner-envelope';
    pocket.userData.index = index;
    pocket.userData.phase = phase;
    pocket.userData.radius = grooveCornerRadius;
    yoke.add(pocket);
    return pocket;
  });

  const grooveEdges = [-1, 1].map((side) => {
    const edge = makeLineLoop(
      sampledGrooveEdge(
        crankRadius,
        outputHalfStroke,
        grooveHalfWidth,
        side,
      ),
      grooveEdgeMaterial,
      grooveFaceZ + 0.016,
    );
    edge.userData.role = 'front-edge-of-shaped-endless-groove';
    edge.userData.side = side;
    yoke.add(edge);
    edge.visible = false;
    edge.userData.retiredInkOutline = true;
    return edge;
  });

  const stemWidth = stemHalfWidth * 2;
  const stemStart = yokeOuterHalfHeight - 0.035;
  const stemLength = stemEnd - stemStart;
  // upperStem is the one full-length stem; lowerStem stays hidden.
  const upperStem = new THREE.Mesh(
    new THREE.BoxGeometry(stemWidth, 2 * stemEnd, stemDepth),
    drivenMaterial,
  );
  upperStem.position.set(0, 0, stemPlaneZ);
  upperStem.userData.role = 'upper-rectangular-output-stem-rigid-with-crosshead';
  const lowerStem = new THREE.Mesh(
    new THREE.BoxGeometry(stemWidth, stemLength, stemDepth),
    drivenMaterial,
  );
  lowerStem.position.set(
    0,
    -(stemStart + stemEnd) / 2,
    stemPlaneZ,
  );
  lowerStem.userData.role = 'lower-rectangular-output-stem-rigid-with-crosshead';
  lowerStem.visible = false;
  yoke.add(upperStem, lowerStem);

  const stemIndexes = [-1, 1].map((side) => {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(stemWidth * 0.88, 0.07, stemDepth + 0.035),
      indexMaterial,
    );
    marker.position.set(
      0,
      side * (yokeOuterHalfHeight + 0.58),
      stemPlaneZ + 0.018,
    );
    marker.userData.role = 'visible-linear-index-on-output-stem';
    marker.userData.side = side;
    yoke.add(marker);
    return marker;
  });

  const guideCheeks = [];
  const guideBridges = [];
  for (const sideY of [-1, 1]) {
    for (const sideX of [-1, 1]) {
      const innerX = guideInnerHalfWidth;
      const outerX = guideHalfWidth;
      const cheekWidth = outerX - innerX;
      const cheek = new THREE.Mesh(
        new THREE.BoxGeometry(
          cheekWidth,
          guideHalfHeight * 2,
          0.42,
        ),
        frameMaterial,
      );
      cheek.position.set(
        sideX * (innerX + outerX) / 2,
        shaftCenter.y + sideY * guideCenter,
        stemPlaneZ,
      );
      cheek.userData.role = 'fixed-cheek-guiding-rectangular-output-stem';
      cheek.userData.sideX = sideX;
      cheek.userData.sideY = sideY;
      guideCheeks.push(cheek);
    }
    // Brown draws each guide as one block across the stem: a bridge joins
    // the cheeks on the face toward the viewer.
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(guideHalfWidth * 2, guideHalfHeight * 2, 0.07),
      frameMaterial,
    );
    bridge.position.set(0, shaftCenter.y + sideY * guideCenter,
      stemPlaneZ - 0.21 + 0.035);
    bridge.userData.role = 'fixed-guide-bridge-across-output-stem';
    guideBridges.push(bridge);
  }

  // Brown draws only the two guide blocks: no rear frame, rails, brackets or
  // shaft bearing (p62 support rule). The guides and the input axis are fixed
  // ideal constraints; the shaft ends inside the disk.
  root.add(
    ...guideCheeks,
    ...guideBridges,
    input,
    yoke,
  );

  const stateAtDriverAngle = (driverAngle) => {
    const phase = positiveModulo(driverAngle / fullTurn, 1);
    const angle = phase * fullTurn;
    const outputDisplacement = triangleDisplacementAtPhase(
      phase,
      outputHalfStroke,
    );
    const outputPhaseSlope = triangleSlopeAtPhase(phase, outputHalfStroke);
    const outputAngleSlope = outputPhaseSlope / fullTurn;
    const outputSpeed = outputAngleSlope * inputAngularSpeed;
    const phaseRate = inputAngularSpeed / fullTurn;
    const pinPosition = new THREE.Vector3(
      shaftCenter.x - crankRadius * Math.sin(angle),
      shaftCenter.y + crankRadius * Math.cos(angle),
      wristCenterZ,
    );
    const pinVelocity = new THREE.Vector3(
      -crankRadius * Math.cos(angle) * inputAngularSpeed,
      -crankRadius * Math.sin(angle) * inputAngularSpeed,
      0,
    );
    const pinAcceleration = new THREE.Vector3(
      crankRadius * Math.sin(angle) * inputAngularSpeed ** 2,
      -crankRadius * Math.cos(angle) * inputAngularSpeed ** 2,
      0,
    );
    const outputPosition = new THREE.Vector3(
      shaftCenter.x,
      shaftCenter.y + outputDisplacement,
      0,
    );
    const outputVelocity = new THREE.Vector3(0, outputSpeed, 0);
    const relativePinPosition = new THREE.Vector2(
      pinPosition.x - outputPosition.x,
      pinPosition.y - outputPosition.y,
    );
    const relativePinVelocity = new THREE.Vector2(
      pinVelocity.x,
      pinVelocity.y - outputVelocity.y,
    );
    const grooveCenter = grooveCenterAtPhase(
      phase,
      crankRadius,
      outputHalfStroke,
    );
    const grooveDerivative = grooveDerivativeAtPhase(
      phase,
      crankRadius,
      outputHalfStroke,
    );
    const grooveTangent = grooveDerivative.clone().normalize();
    const grooveNormal = new THREE.Vector2(
      -grooveTangent.y,
      grooveTangent.x,
    );
    const grooveCenterWorld = new THREE.Vector3(
      outputPosition.x + grooveCenter.x,
      outputPosition.y + grooveCenter.y,
      yokePlaneZ,
    );
    const leftWallPoint = grooveCenterWorld.clone().add(new THREE.Vector3(
      grooveNormal.x * grooveHalfWidth,
      grooveNormal.y * grooveHalfWidth,
      0,
    ));
    const rightWallPoint = grooveCenterWorld.clone().add(new THREE.Vector3(
      -grooveNormal.x * grooveHalfWidth,
      -grooveNormal.y * grooveHalfWidth,
      0,
    ));
    const leftPinPoint = grooveCenterWorld.clone().add(new THREE.Vector3(
      grooveNormal.x * wristRadius,
      grooveNormal.y * wristRadius,
      0,
    ));
    const rightPinPoint = grooveCenterWorld.clone().add(new THREE.Vector3(
      -grooveNormal.x * wristRadius,
      -grooveNormal.y * wristRadius,
      0,
    ));
    const upperReversalDistance = Math.min(phase, 1 - phase);
    const lowerReversalDistance = Math.abs(phase - 0.5);
    const reversalTolerance = 1e-12;
    const atUpperReversal = upperReversalDistance < reversalTolerance;
    const atLowerReversal = lowerReversalDistance < reversalTolerance;
    const atReversal = atUpperReversal || atLowerReversal;
    const constantOutputSpeedMagnitude = (
      2 * outputHalfStroke * inputAngularSpeed / Math.PI
    );
    const incomingOutputVelocity = atUpperReversal
      ? constantOutputSpeedMagnitude
      : atLowerReversal
        ? -constantOutputSpeedMagnitude
        : outputSpeed;
    const outgoingOutputVelocity = atUpperReversal
      ? -constantOutputSpeedMagnitude
      : atLowerReversal
        ? constantOutputSpeedMagnitude
        : outputSpeed;
    const stage = atUpperReversal
      ? 'upper-instantaneous-reversal'
      : atLowerReversal
        ? 'lower-instantaneous-reversal'
        : outputSpeed < 0
          ? 'uniform-downstroke'
          : 'uniform-upstroke';
    return {
      atReversal,
      atUpperReversal,
      atLowerReversal,
      constantOutputSpeedMagnitude,
      driverAngle,
      driverAngularSpeed: inputAngularSpeed,
      driverPhase: phase,
      grooveCenter,
      grooveCenterError: relativePinPosition.distanceTo(grooveCenter),
      grooveCenterWorld,
      grooveDerivative,
      grooveNormal,
      grooveTangent,
      guideCenterlineError: Math.abs(outputPosition.x - shaftCenter.x),
      guideRunningClearance,
      incomingOutputVelocity,
      inputRevolutions: (driverAngle - sourcePoseAngle) / fullTurn,
      leftPinPoint,
      leftWallGap: leftPinPoint.distanceTo(leftWallPoint),
      leftWallPoint,
      normalizedDriverAngle: angle,
      outgoingOutputVelocity,
      outputAcceleration: new THREE.Vector3(0, 0, 0),
      outputDisplacement,
      outputPosition,
      outputVelocity,
      phaseRate,
      pinAcceleration,
      pinAxisPoint: pinPosition.clone(),
      pinOrbitError: Math.abs(
        Math.hypot(
          pinPosition.x - shaftCenter.x,
          pinPosition.y - shaftCenter.y,
        ) - crankRadius,
      ),
      pinPosition,
      pinVelocity,
      relativePinPosition,
      relativePinVelocity,
      relativeVelocityConstraintError: relativePinVelocity.distanceTo(
        grooveDerivative.clone().multiplyScalar(phaseRate),
      ),
      rightPinPoint,
      rightWallGap: rightPinPoint.distanceTo(rightWallPoint),
      rightWallPoint,
      stage,
      velocityJumpAtReversal: 2 * constantOutputSpeedMagnitude,
      yokeAngularSpeed: 0,
      yokeRotation: 0,
    };
  };

  const stateAtPhase = (phase) => stateAtDriverAngle(phase * fullTurn);
  const stateAtTime = (time) => stateAtDriverAngle(
    sourcePoseAngle + inputAngularSpeed * time,
  );

  const contacts = {
    crankWristGroove: {
      axis: Z_AXIS.clone(),
      centerError: 0,
      grooveHalfWidth,
      runningClearance: grooveRunningClearance,
      wristRadius,
    },
    stemGuides: {
      axis: Y_AXIS.clone(),
      centerlineError: 0,
      runningClearance: guideRunningClearance,
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.driverAngle;
    input.userData.angularSpeed = state.driverAngularSpeed;
    yoke.position.copy(state.outputPosition);
    yoke.rotation.set(0, 0, 0);
    yoke.userData.angularSpeed = 0;
    yoke.userData.velocity = state.outputVelocity.clone();

    contacts.crankWristGroove.centerError = state.grooveCenterError;
    contacts.crankWristGroove.grooveCenter =
      state.grooveCenterWorld.clone();
    contacts.crankWristGroove.leftPinPoint = state.leftPinPoint.clone();
    contacts.crankWristGroove.leftWallGap = state.leftWallGap;
    contacts.crankWristGroove.leftWallPoint = state.leftWallPoint.clone();
    contacts.crankWristGroove.pinAxisPoint = state.pinAxisPoint.clone();
    contacts.crankWristGroove.rightPinPoint = state.rightPinPoint.clone();
    contacts.crankWristGroove.rightWallGap = state.rightWallGap;
    contacts.crankWristGroove.rightWallPoint = state.rightWallPoint.clone();
    contacts.crankWristGroove.tangent = state.grooveTangent.clone();
    contacts.crankWristGroove.velocityConstraintError =
      state.relativeVelocityConstraintError;
    contacts.stemGuides.centerlineError = state.guideCenterlineError;
    contacts.stemGuides.outputPosition = state.outputPosition.clone();
    contacts.stemGuides.rotationError = state.yokeRotation;
    root.userData.kinematics = state;
  };

  root.userData.archetype =
    'uniform-velocity-endless-groove-crosshead';
  root.userData.blocks = {
    crankWrist,
    diskBody,
    diskRim,
    diskRotationIndexes,
    grooveBand,
    grooveCornerPockets,
    grooveEdges,
    guideCheeks,
    hubFace,
    input,
    inputRotor,
    inputShaft,
    islandRetainer,
    lowerStem,
    shaftHub,
    stemIndexes,
    upperStem,
    wristCap,
    yoke,
    yokeBody,
    yokeOutline,
  };
  root.userData.cameraDistanceScale = 1.06;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.25, -3.8, -0.92),
    new THREE.Vector3(3.25, 3.65, 0.88),
  );
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input: 'one uniformly rotating crank disk about its fixed z axis',
    mechanism: 1,
    output:
      'one nonrotating crosshead constrained to pure vertical translation',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    crankRadius,
    diskCenterZ,
    diskDepth,
    diskFrontZ,
    diskRadius,
    frameHalfWidth,
    frameZ,
    fullTurn,
    grooveCornerRadius,
    grooveFaceZ,
    grooveHalfWidth,
    grooveRunningClearance,
    guideAxis: Y_AXIS.clone(),
    guideCenter,
    guideHalfHeight,
    guideHalfWidth,
    guideInnerHalfWidth,
    guideRunningClearance,
    hubRadius,
    inputAngularSpeed,
    inputCyclePeriod,
    inputRevolutionsPerMinute,
    outputHalfStroke,
    outputMaximumY: shaftCenter.y + outputHalfStroke,
    outputMinimumY: shaftCenter.y - outputHalfStroke,
    outputStroke,
    shaftCenter: shaftCenter.clone(),
    shaftCenterZ,
    shaftLength,
    shaftRadius,
    sourceCrankRadius,
    sourceDiskRadius,
    sourceGuideCenter,
    sourceGuideHalfHeight,
    sourceGuideHalfWidth,
    sourceHubRadius,
    sourceOutputHalfStroke,
    sourcePoseAngle,
    sourcePosePhase,
    sourceScale,
    sourceStemEnd,
    sourceStemHalfWidth,
    sourceWristRadius,
    sourceYokeEndCenter,
    sourceYokeOuterHalfHeight,
    stemDepth,
    stemEnd,
    stemHalfWidth,
    stemLength,
    stemPlaneZ,
    stemStart,
    wristCenterZ,
    wristFrontZ,
    wristLength,
    wristRadius,
    yokeDepth,
    yokeEndCenter,
    yokeFrontZ,
    yokeOuterHalfHeight,
    yokePlaneZ,
  };
  root.userData.mechanism =
    'one-uniformly-rotating-nine-point-seven-radius-crank-wrist-follows-one-continuous-shaped-endless-groove-in-a-nonrotating-vertical-crosshead-whose-triangular-displacement-law-gives-equal-constant-speed-up-and-down-strokes-with-instantaneous-end-reversals';
  root.userData.sourceAnimation = {
    available: true,
    effectiveInputRevolutionsPerMinute: inputRevolutionsPerMinute,
    officialCanvasModelPresent: true,
    officialDurationSeconds: inputCyclePeriod,
    sourceCoordinateCyclesPerMinute,
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate354: {
      imageHeight: 525,
      imageWidth: 525,
      rasterCrankCenter: new THREE.Vector2(267, 294),
      rasterCrankWrist: new THREE.Vector2(317, 108),
      rasterMeasurementUncertaintyPixels: 7,
    },
    officialDescription: movement.description,
    officialModelCoordinates: {
      crankRadius: sourceCrankRadius,
      diskRadius: sourceDiskRadius,
      guideCenters: [-sourceGuideCenter, sourceGuideCenter],
      outputHalfStroke: sourceOutputHalfStroke,
      stemHalfWidth: sourceStemHalfWidth,
      wristRadius: sourceWristRadius,
      yokeEndCenter: sourceYokeEndCenter,
      yokeOuterHalfHeight: sourceYokeOuterHalfHeight,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      edition: 21,
      publicationYear: 1908,
    },
    referenceMovement93: {
      difference:
        'movement 93 uses a straight transverse slot and therefore gives sinusoidal Scotch-yoke output instead of uniform rectilinear velocity',
      sourceUrl: 'https://507movements.com/mm_093.html',
    },
  };
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtPhase = stateAtPhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    construction:
      'for crank phase p, the local groove center is the circular wrist position minus the prescribed triangular crosshead displacement',
    grooveEquation:
      'x=-r sin(2*pi*p); y=r cos(2*pi*p)-triangle(p, halfStroke)',
    idealReversal:
      'velocity is constant between endpoints and changes sign instantaneously at p=0 and p=1/2, as in the historical idealization',
    outputLaw:
      'the crosshead displacement is linear in crank phase on each half-turn, so equal crank-angle increments produce equal rectilinear increments',
  };
  // Brown dashes the groove, wrist and stem behind the disk: the disk,
  // its rim and hub take the standard see-through style.
  makeSeeThrough(diskBody);
  makeSeeThrough(diskFaceRim);
  makeSeeThrough(shaftHub);
  makeSeeThrough(hubFace);
  makeSeeThrough(inputShaft);
  root.userData.grooveCenterAtPhase = (phase) => grooveCenterAtPhase(
    phase,
    crankRadius,
    outputHalfStroke,
  );
  root.userData.grooveDerivativeAtPhase = (phase) => grooveDerivativeAtPhase(
    phase,
    crankRadius,
    outputHalfStroke,
  );

  update(0);
  fitPistonGuide(root, update, inputCyclePeriod);
  // Brown crops both stems at the plate edges, so the view is fitted to the
  // swept disk and crosshead and to the two guides he draws; the stems run
  // off the frame through their guides as they do on the plate (the removed
  // rear frame is not fitted).
  const stemParts = new Set([upperStem, lowerStem, ...stemIndexes]);
  const sweptBounds = new THREE.Box3();
  for (let index = 0; index <= 64; index += 1) {
    update(inputCyclePeriod * index / 64);
    root.updateMatrixWorld(true);
    for (const part of [input, ...yoke.children.filter(child => !stemParts.has(child)), ...guideCheeks, ...guideBridges]) {
      sweptBounds.union(new THREE.Box3().setFromObject(part));
    }
  }
  update(0);
  root.userData.sweptBounds = sweptBounds.clone();
  root.userData.cameraFitBounds = sweptBounds.clone().expandByScalar(0.04);
  markShadows(root);
  for (const line of grooveEdges) {
    line.castShadow = false;
    line.receiveShadow = false;
  }
  return {
    // source-presentation turns the model half a turn about y, so this
    // camera looks at the disk side, as Brown does.
    cameraDirection: new THREE.Vector3(1.2, 0.6, 14),
    root,
    update,
  };
}

export function createAuthoredUniformGrooveCrossheadMovement(movement) {
  if (movement.id !== 354) return null;
  return uniformVelocityEndlessGrooveCrosshead(movement);
}
