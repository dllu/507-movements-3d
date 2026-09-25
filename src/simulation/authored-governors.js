import * as THREE from 'three';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
import { bevelBodyGeometry, bevelToothGeometry } from './bevel-geometry.js';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function centeredExtrusion(shape, depth, bevel = 0.008) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 48,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function annularShape(innerRadius, outerRadius) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return shape;
}

function cylinderAlongX(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongY(radius, length, material, segments = 36) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function cylinderAlongZ(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function radialPoint(angle, radius, y) {
  return new THREE.Vector3(
    radius * Math.cos(angle),
    y,
    -radius * Math.sin(angle),
  );
}

export function makePitchBevelGear({
  axis,
  color,
  indexToothIndex = 0,
  innerDistance,
  outerDistance,
  pitchConeAngle,
  teeth,
  toothHeight,
}) {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.add(rotor);
  root.quaternion.setFromUnitVectors(Z_AXIS, axis.clone().normalize());
  root.userData.axis = axis.clone().normalize();
  root.userData.rotor = rotor;

  const pitchRadiusAt = (distance) => distance * Math.tan(pitchConeAngle);
  const toothGeometry = bevelToothGeometry({
    teeth, innerDistance, outerDistance, pitchConeAngle, toothHeight,
  });
  const body = new THREE.Mesh(
    bevelBodyGeometry(toothGeometry, 0),
    matte(color, { metalness: 0.14, roughness: 0.63 }),
  );
  body.userData.role = 'pitch-cone-bevel-gear-body';
  rotor.add(body);
  const toothMaterial = matte(color, { metalness: 0.16, roughness: 0.58 });
  const indexMaterial = matte(PALETTE.white, { metalness: 0.04, roughness: 0.49 });
  const halfToothAngle = Math.PI / (2 * teeth) * 0.96;
  const toothMeshes = [];
  for (let index = 0; index < teeth; index += 1) {
    const tooth = new THREE.Mesh(
      toothGeometry,
      index === indexToothIndex ? indexMaterial : toothMaterial,
    );
    tooth.rotation.z = index * Math.PI * 2 / teeth;
    tooth.userData.bevelTooth = true;
    tooth.userData.index = index;
    tooth.userData.role = index === indexToothIndex
      ? 'white-index-bevel-tooth' : 'working-bevel-tooth';
    toothMeshes.push(tooth);
    rotor.add(tooth);
  }
  const outerFaceZ = toothGeometry.userData.root.z;

  const hub = cylinderAlongZ(
    Math.max(0.13, pitchRadiusAt(outerDistance) * 0.21),
    outerDistance - innerDistance + 0.2,
    matte(PALETTE.ink, { metalness: 0.24, roughness: 0.48 }),
    32,
  );
  hub.position.z = (innerDistance + outerDistance) / 2 + 0.02;
  hub.userData.role = 'bevel-gear-hub';
  const faceRing = new THREE.Mesh(
    new THREE.TorusGeometry(
      pitchRadiusAt(outerDistance) * 0.57,
      0.032,
      8,
      48,
    ),
    matte(PALETTE.ink, { roughness: 0.55 }),
  );
  faceRing.position.z = outerFaceZ + 0.018;
  faceRing.userData.role = 'bevel-gear-face-ring';
  // Brown inks the face circle only as a drawing edge; keep the reference
  // hidden for code that positions it, but do not render a dark rim.
  faceRing.visible = false;
  faceRing.userData.retiredInkOutline = true;
  const faceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      pitchRadiusAt(outerDistance) * 0.46,
      0.055,
      0.028,
    ),
    indexMaterial,
  );
  faceIndex.position.set(
    pitchRadiusAt(outerDistance) * 0.47,
    0,
    outerDistance + 0.038,
  );
  faceIndex.userData.role = 'white-bevel-face-rotation-index';
  rotor.add(hub, faceRing, faceIndex);

  root.userData.body = body;
  root.userData.faceIndex = faceIndex;
  root.userData.faceRing = faceRing;
  root.userData.halfToothAngle = halfToothAngle;
  root.userData.hub = hub;
  root.userData.indexToothIndex = indexToothIndex;
  root.userData.innerDistance = innerDistance;
  root.userData.outerDistance = outerDistance;
  root.userData.outerPitchRadius = pitchRadiusAt(outerDistance);
  root.userData.pitchConeAngle = pitchConeAngle;
  root.userData.teeth = teeth;
  root.userData.toothHeight = toothHeight;
  root.userData.toothMeshes = toothMeshes;
  return markShadows(root);
}

function dragFanInclinedPlaneGovernorMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  const sourceScale = 0.32;
  const sourceFanOrbitRadius = 10.2;
  const sourceFanWidth = 3.2;
  const sourceFanHeight = 5;
  const sourceRollerOrbitRadius = 5.4;
  const sourceRollerRadius = 1.05;
  const sourceRampRadialHalfWidth = 1.3;
  const sourceWeightRadius = 3.4;
  const sourceWeightCenterY = 5.2;
  const sourceFollowerOffsetY = 10.2;
  const sourceShaftRadius = 0.43;

  const fanOrbitRadius = sourceFanOrbitRadius * sourceScale;
  const fanWidth = sourceFanWidth * sourceScale;
  const fanHeight = sourceFanHeight * sourceScale;
  const rollerOrbitRadius = sourceRollerOrbitRadius * sourceScale;
  const rollerRadius = sourceRollerRadius * sourceScale;
  const rampRadialHalfWidth = sourceRampRadialHalfWidth * sourceScale;
  const weightRadius = sourceWeightRadius * sourceScale;
  const weightCenterY = sourceWeightCenterY * sourceScale;
  const followerOffsetY = sourceFollowerOffsetY * sourceScale;
  const shaftRadius = sourceShaftRadius * sourceScale;

  const cyclePeriod = 10;
  const minimumTurnsPerSecond = 0.25;
  const maximumTurnsPerSecond = 0.55;
  const minimumShaftAngularSpeed = fullTurn * minimumTurnsPerSecond;
  const maximumShaftAngularSpeed = fullTurn * maximumTurnsPerSecond;
  const shaftAngularSpeedRange =
    maximumShaftAngularSpeed - minimumShaftAngularSpeed;
  const meanShaftAngularSpeed = (
    minimumShaftAngularSpeed + maximumShaftAngularSpeed
  ) / 2;
  const shaftRevolutionsPerGovernorCycle =
    meanShaftAngularSpeed * cyclePeriod / fullTurn;

  const minimumLagAngle = 0.15;
  const maximumLagAngle = 1.0;
  const lagAngleRange = maximumLagAngle - minimumLagAngle;
  const sourceLagAngle = (minimumLagAngle + maximumLagAngle) / 2;
  const sourceShaftAngle = sourceLagAngle;
  const rampRise = 1.0;
  const rampBaseY = -0.55;
  const rampFoundationY = rampBaseY - 0.28;
  const rampInnerRadius = rollerOrbitRadius - rampRadialHalfWidth;
  const rampOuterRadius = rollerOrbitRadius + rampRadialHalfWidth;
  const rampSlopePerRadian = rampRise / lagAngleRange;
  const rampArcLengthPerRadian = Math.hypot(
    rollerOrbitRadius,
    rampSlopePerRadian,
  );
  const sourceRollAngle = (
    sourceLagAngle - minimumLagAngle
  ) * rampArcLengthPerRadian / rollerRadius;
  const rollerWidth = 0.43;

  const crossheadArmY = 0.27;
  const looseSleeveInnerRadius = shaftRadius + 0.035;
  const looseSleeveOuterRadius = 0.43;
  const looseSleeveHeight = 0.66;
  const fanDepth = 0.18;
  const fanOutlineDepth = 0.16;
  const fanRivetRadius = 0.055;
  const crossheadArmThickness = 0.18;
  const weightCenterLocalY = weightCenterY;
  const weightVerticalScale = 1.08;
  const weightBottomY =
    weightCenterLocalY - weightRadius * weightVerticalScale;
  const followerBearingLocalY = followerOffsetY - 0.236;
  const leverPlaneZ = 0.92;
  const leverPivotToFollowerX = 0.78;
  const leverPivotX = -leverPivotToFollowerX;
  const minimumCrossheadCenterY = rampBaseY + rollerRadius;
  const maximumCrossheadCenterY = minimumCrossheadCenterY + rampRise;
  const followerMinimumY = minimumCrossheadCenterY + followerOffsetY;
  const followerMaximumY = maximumCrossheadCenterY + followerOffsetY;
  const followerMidpointY = (followerMinimumY + followerMaximumY) / 2;
  const leverPivotY = followerMidpointY;
  const leverLength = 4.55;
  const leverDepth = 0.19;
  const leverThickness = 0.17;
  const shaftMinimumY = -2.75;
  const shaftMaximumY = 4.55;
  const shaftLength = shaftMaximumY - shaftMinimumY;
  const shaftCenterY = (shaftMinimumY + shaftMaximumY) / 2;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.61,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.64,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.48,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.70,
  });
  const rollerMaterial = matte(PALETTE.brass, {
    metalness: 0.25,
    roughness: 0.44,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.45 });
  const rampMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.67,
  });
  rampMaterial.side = THREE.DoubleSide;

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-base-shaft-bearing-and-valve-lever-pivot-support';
  const baseRail = new THREE.Mesh(
    new THREE.BoxGeometry(7.5, 0.18, 1.25),
    frameMaterial,
  );
  baseRail.position.set(0, -2.52, -0.48);
  baseRail.userData.role = 'fixed-ground-rail-beneath-governor-spindle';
  const lowerBearing = new THREE.Mesh(
    centeredExtrusion(
      annularShape(shaftRadius + 0.018, shaftRadius + 0.22),
      0.58,
      0.008,
    ),
    frameMaterial,
  );
  lowerBearing.rotation.x = -Math.PI / 2;
  lowerBearing.position.set(0, -2.22, 0);
  lowerBearing.userData.role = 'fixed-lower-bearing-around-governor-shaft';
  const lowerBearingPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.72, 0.72),
    frameMaterial,
  );
  lowerBearingPost.position.set(0, -2.18, -0.38);
  lowerBearingPost.userData.role = 'fixed-pedestal-supporting-lower-bearing';
  const leverSupportPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, 4.45, 0.28),
    frameMaterial,
  );
  leverSupportPost.position.set(
    leverPivotX,
    leverPivotY - 2.05,
    leverPlaneZ - 0.34,
  );
  leverSupportPost.userData.role = 'fixed-rear-post-for-valve-lever-pivot';
  const leverPivotBracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.48, 0.38),
    frameMaterial,
  );
  leverPivotBracket.position.set(
    leverPivotX,
    leverPivotY,
    leverPlaneZ - 0.25,
  );
  leverPivotBracket.userData.role = 'fixed-valve-lever-pivot-bracket';
  const leverPivotPin = cylinderAlongZ(0.16, 0.74, darkMaterial, 40);
  leverPivotPin.position.set(leverPivotX, leverPivotY, leverPlaneZ);
  leverPivotPin.userData.role = 'fixed-pivot-pin-of-output-valve-lever';
  fixedFrame.add(
    baseRail,
    lowerBearingPost,
    lowerBearing,
    leverSupportPost,
    leverPivotBracket,
    leverPivotPin,
  );

  const shaftAssembly = new THREE.Group();
  shaftAssembly.userData.axis = Y_AXIS.clone();
  shaftAssembly.userData.role =
    'continuously-rotating-center-shaft-and-two-inclined-planes';
  const shaftRotor = new THREE.Group();
  shaftAssembly.add(shaftRotor);
  shaftAssembly.userData.rotor = shaftRotor;
  const centerShaft = cylinderAlongY(
    shaftRadius,
    shaftLength,
    darkMaterial,
    48,
  );
  centerShaft.position.y = shaftCenterY;
  centerShaft.userData.role = 'continuous-vertical-engine-governor-shaft';
  const rampBaseRing = new THREE.Mesh(
    centeredExtrusion(
      annularShape(rampInnerRadius - 0.14, rampOuterRadius + 0.14),
      0.18,
      0.008,
    ),
    driverMaterial,
  );
  rampBaseRing.rotation.x = -Math.PI / 2;
  rampBaseRing.position.y = rampFoundationY - 0.08;
  rampBaseRing.userData.role = 'shaft-fixed-annular-base-under-inclined-planes';
  const lowerShaftCollar = new THREE.Mesh(
    centeredExtrusion(
      annularShape(shaftRadius, shaftRadius + 0.24),
      0.38,
      0.008,
    ),
    driverMaterial,
  );
  lowerShaftCollar.rotation.x = -Math.PI / 2;
  lowerShaftCollar.position.y = -1.55;
  lowerShaftCollar.userData.role = 'keyed-collar-showing-shaft-rotation';
  const shaftRotationIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 18, 12),
    indexMaterial,
  );
  shaftRotationIndex.position.set(shaftRadius + 0.17, -1.55, 0);
  shaftRotationIndex.userData.role = 'visible-index-on-continuous-shaft';
  shaftRotor.add(
    centerShaft,
    rampBaseRing,
    lowerShaftCollar,
    shaftRotationIndex,
  );

  const rampSampleCount = 72;
  const rampRecords = [];
  const makeRampTrack = (centerAngle, index) => {
    const positions = [];
    const indices = [];
    const innerEdgePoints = [];
    const outerEdgePoints = [];
    const centerlinePoints = [];
    for (let sample = 0; sample <= rampSampleCount; sample += 1) {
      const fraction = sample / rampSampleCount;
      const localPhase = -maximumLagAngle
        + fraction * lagAngleRange;
      const heightFraction = (
        -localPhase - minimumLagAngle
      ) / lagAngleRange;
      const surfaceY = rampBaseY + rampRise * heightFraction;
      const angle = centerAngle + localPhase;
      const innerTop = radialPoint(angle, rampInnerRadius, surfaceY);
      const outerTop = radialPoint(angle, rampOuterRadius, surfaceY);
      const innerBottom = radialPoint(
        angle,
        rampInnerRadius,
        rampFoundationY,
      );
      const outerBottom = radialPoint(
        angle,
        rampOuterRadius,
        rampFoundationY,
      );
      for (const point of [innerTop, outerTop, innerBottom, outerBottom]) {
        positions.push(...point.toArray());
      }
      innerEdgePoints.push(innerTop);
      outerEdgePoints.push(outerTop);
      centerlinePoints.push(radialPoint(
        angle,
        rollerOrbitRadius,
        surfaceY,
      ));
      if (sample < rampSampleCount) {
        const current = sample * 4;
        const next = current + 4;
        indices.push(
          current,
          current + 1,
          next + 1,
          current,
          next + 1,
          next,
          current + 1,
          current + 3,
          next + 3,
          current + 1,
          next + 3,
          next + 1,
          current + 2,
          current,
          next,
          current + 2,
          next,
          next + 2,
          current + 2,
          next + 2,
          next + 3,
          current + 2,
          next + 3,
          current + 3,
        );
      }
    }
    indices.push(0, 2, 3, 0, 3, 1);
    const final = rampSampleCount * 4;
    indices.push(final, final + 1, final + 3, final, final + 3, final + 2);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, rampMaterial);
    mesh.userData.role = 'shaft-fixed-circular-inclined-plane';
    mesh.userData.index = index;
    mesh.userData.centerAngle = centerAngle;

    const innerEdge = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(innerEdgePoints),
        rampSampleCount,
        0.035,
        8,
        false,
      ),
      darkMaterial,
    );
    innerEdge.userData.role = 'inner-edge-of-circular-inclined-plane';
    innerEdge.userData.index = index;
    innerEdge.visible = false;
    innerEdge.userData.retiredInkOutline = true;
    const outerEdge = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(outerEdgePoints),
        rampSampleCount,
        0.035,
        8,
        false,
      ),
      darkMaterial,
    );
    outerEdge.userData.role = 'outer-edge-of-circular-inclined-plane';
    outerEdge.userData.index = index;
    outerEdge.visible = false;
    outerEdge.userData.retiredInkOutline = true;
    const ribs = [];
    for (let ribIndex = 0; ribIndex <= 8; ribIndex += 1) {
      const sampleIndex = Math.round(ribIndex / 8 * rampSampleCount);
      const surfacePoint = outerEdgePoints[sampleIndex];
      const rib = makeBeam(
        new THREE.Vector3(
          surfacePoint.x,
          rampFoundationY,
          surfacePoint.z,
        ),
        surfacePoint,
        { thickness: 0.045, depth: 0.055, color: PALETTE.ink },
      );
      rib.userData.role = 'vertical-rib-under-circular-inclined-plane';
      rib.userData.rampIndex = index;
      ribs.push(rib);
    }
    shaftRotor.add(mesh, innerEdge, outerEdge, ...ribs);
    const record = {
      centerAngle,
      centerlinePoints,
      innerEdge,
      innerEdgePoints,
      mesh,
      outerEdge,
      outerEdgePoints,
      ribs,
    };
    rampRecords.push(record);
    return record;
  };
  makeRampTrack(0, 0);
  makeRampTrack(Math.PI, 1);

  const crosshead = new THREE.Group();
  crosshead.userData.axis = Y_AXIS.clone();
  crosshead.userData.role =
    'loose-weighted-crosshead-with-opposed-air-fans-and-rollers';
  const looseSleeve = new THREE.Mesh(
    centeredExtrusion(
      annularShape(looseSleeveInnerRadius, looseSleeveOuterRadius),
      looseSleeveHeight,
      0.010,
    ),
    drivenMaterial,
  );
  looseSleeve.rotation.x = -Math.PI / 2;
  looseSleeve.position.y = crossheadArmY;
  looseSleeve.userData.role = 'loose-crosshead-sleeve-sliding-on-center-shaft';

  const crossheadArms = [-1, 1].map((side) => {
    const arm = makeBeam(
      new THREE.Vector3(side * 0.30, crossheadArmY, 0),
      new THREE.Vector3(
        side * (fanOrbitRadius - fanWidth / 2),
        crossheadArmY,
        0,
      ),
      {
        thickness: crossheadArmThickness,
        depth: 0.22,
        color: PALETTE.driven,
      },
    );
    arm.userData.role = 'rigid-radial-crosshead-arm-to-air-fan';
    arm.userData.side = side < 0 ? 'left' : 'right';
    return arm;
  });

  const fanAssemblies = [-1, 1].map((side) => {
    const assembly = new THREE.Group();
    assembly.position.set(side * fanOrbitRadius, crossheadArmY, 0);
    assembly.userData.role = 'radial-air-resistance-fan-assembly';
    assembly.userData.side = side < 0 ? 'left' : 'right';
    const outline = new THREE.Mesh(
      new THREE.BoxGeometry(fanWidth, fanHeight, fanOutlineDepth),
      darkMaterial,
    );
    outline.userData.role = 'dark-outline-of-governor-air-fan';
    // The plate's fan border is only its drawn edge: the blade itself fills
    // the whole fan rectangle and the former dark edging box is retired.
    outline.visible = false;
    outline.userData.retiredInkOutline = true;
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(
        fanWidth,
        fanHeight,
        fanDepth,
      ),
      drivenMaterial,
    );
    blade.userData.role = 'broad-radial-air-resistance-fan';
    const rivets = [-1, 1].map((offset) => {
      const rivet = cylinderAlongZ(
        fanRivetRadius,
        0.035,
        indexMaterial,
        20,
      );
      rivet.position.set(
        offset * fanWidth * 0.22,
        -fanHeight * 0.30,
        fanDepth / 2 + 0.0175,
      );
      rivet.userData.role = 'visible-fastener-on-air-fan';
      return rivet;
    });
    assembly.add(outline, blade, ...rivets);
    crosshead.add(assembly);
    return { assembly, blade, outline, rivets, side };
  });

  const rollerAssemblies = [-1, 1].map((side, index) => {
    const assembly = new THREE.Group();
    assembly.position.set(side * rollerOrbitRadius, 0, 0);
    assembly.userData.role = 'crosshead-carried-friction-roller-assembly';
    assembly.userData.side = side < 0 ? 'left' : 'right';
    const rotor = new THREE.Group();
    assembly.add(rotor);
    assembly.userData.rotor = rotor;
    const body = cylinderAlongX(
      rollerRadius,
      rollerWidth,
      rollerMaterial,
      48,
    );
    body.userData.role = 'friction-roller-on-circular-inclined-plane';
    body.userData.index = index;
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(
        rollerRadius - 0.025,
        0.035,
        8,
        48,
      ),
      darkMaterial,
    );
    rim.rotation.y = Math.PI / 2;
    rim.position.x = side * (rollerWidth / 2 + 0.015);
    rim.userData.role = 'visible-rim-of-inclined-plane-roller';
    rim.visible = false;
    rim.userData.retiredInkOutline = true;
    const indexMarkerRadius = rollerRadius * 0.97;
    const indexMarkerAngle = Math.PI / 2 - side * sourceRollAngle;
    const indexMarker = new THREE.Mesh(
      new THREE.BoxGeometry(rollerWidth + 0.08, 0.07, 0.07),
      indexMaterial,
    );
    indexMarker.position.set(
      0,
      indexMarkerRadius * Math.cos(indexMarkerAngle),
      indexMarkerRadius * Math.sin(indexMarkerAngle),
    );
    indexMarker.userData.role = 'visible-rolling-index-on-friction-roller';
    rotor.add(body, rim, indexMarker);
    crosshead.add(assembly);
    return {
      assembly,
      body,
      index: indexMarker,
      indexMarkerRadius,
      rim,
      rotor,
      side,
    };
  });

  const weightedBulb = new THREE.Mesh(
    new THREE.SphereGeometry(weightRadius, 64, 40),
    drivenMaterial,
  );
  weightedBulb.position.y = weightCenterLocalY;
  weightedBulb.scale.y = weightVerticalScale;
  weightedBulb.userData.role =
    'heavy-bulb-providing-crosshead-return-and-governor-load';
  const lowerBulbNeck = cylinderAlongY(0.40, 0.60, drivenMaterial, 40);
  lowerBulbNeck.position.y = weightBottomY + 0.14;
  lowerBulbNeck.userData.role = 'rigid-neck-from-crosshead-to-heavy-bulb';
  const upperBulbNeck = cylinderAlongY(0.30, 0.68, drivenMaterial, 40);
  upperBulbNeck.position.y = followerBearingLocalY - 0.42;
  upperBulbNeck.userData.role = 'upper-neck-under-thrust-bearing-collar';
  const rotatingThrustRing = new THREE.Mesh(
    centeredExtrusion(
      annularShape(0.30, 0.49),
      0.20,
      0.008,
    ),
    darkMaterial,
  );
  rotatingThrustRing.rotation.x = -Math.PI / 2;
  rotatingThrustRing.position.y = followerBearingLocalY;
  rotatingThrustRing.userData.role =
    'rotating-upper-thrust-ring-under-nonrotating-output-collar';
  const crossheadRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, 0.36),
    indexMaterial,
  );
  crossheadRotationIndex.position.set(
    looseSleeveOuterRadius + 0.05,
    crossheadArmY,
    0,
  );
  crossheadRotationIndex.userData.role =
    'visible-index-on-loose-rotating-crosshead';
  crosshead.add(
    looseSleeve,
    ...crossheadArms,
    weightedBulb,
    lowerBulbNeck,
    upperBulbNeck,
    rotatingThrustRing,
    crossheadRotationIndex,
  );

  const outputFollower = new THREE.Group();
  outputFollower.userData.role =
    'nonrotating-thrust-collar-following-crosshead-lift';
  const thrustCollar = new THREE.Mesh(
    centeredExtrusion(
      annularShape(0.31, 0.54),
      0.24,
      0.008,
    ),
    frameMaterial,
  );
  thrustCollar.rotation.x = -Math.PI / 2;
  thrustCollar.userData.role = 'nonrotating-output-thrust-collar';
  const followerPin = cylinderAlongZ(0.12, 1.48, rollerMaterial, 36);
  followerPin.position.z = leverPlaneZ / 2;
  followerPin.userData.role = 'collar-pin-sliding-in-valve-lever-slot';
  const followerIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 18, 12),
    indexMaterial,
  );
  followerIndex.position.set(0, 0, leverPlaneZ + 0.16);
  followerIndex.userData.role = 'visible-index-on-lifting-thrust-collar';
  outputFollower.add(thrustCollar, followerPin, followerIndex);

  const valveLever = new THREE.Group();
  valveLever.position.set(leverPivotX, leverPivotY, leverPlaneZ);
  valveLever.userData.role =
    'fixed-pivot-slotted-lever-operating-engine-regulating-valve';
  const valveLeverRotor = new THREE.Group();
  valveLever.add(valveLeverRotor);
  valveLever.userData.rotor = valveLeverRotor;
  const valveLeverBody = new THREE.Mesh(
    plate(clip.difference(clip.union(
      capsule([0,0],[leverLength,0],leverThickness/2,24),
      capsule([.45,0],[1.15,0],.20,32),poly(circle([0,0],.21,64))),
      capsule([.45,0],[1.15,0],.123,48),poly(circle([0,0],.163,64))),
    -leverDepth/2,leverDepth/2),
    drivenMaterial,
  );
  valveLeverBody.userData.role = 'long-output-arm-of-regulating-valve-lever';
  const valveLeverSlot = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.065, leverDepth + 0.025),
    darkMaterial,
  );
  valveLeverSlot.position.x = leverPivotToFollowerX;
  valveLeverSlot.userData.role = 'straight-slot-receiving-thrust-collar-pin';
  valveLeverSlot.visible = false;
  const valveLeverEnd = cylinderAlongZ(
    leverThickness * 0.72,
    leverDepth + 0.04,
    drivenMaterial,
    28,
  );
  valveLeverEnd.position.x = leverLength;
  valveLeverEnd.userData.role = 'rounded-output-end-of-valve-lever';
  const valveLeverIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.055, leverDepth + 0.05),
    indexMaterial,
  );
  valveLeverIndex.position.x = leverLength * 0.88;
  valveLeverIndex.userData.role = 'visible-index-on-output-valve-lever';
  valveLeverRotor.add(
    valveLeverBody,
    valveLeverSlot,
    valveLeverEnd,
    valveLeverIndex,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(9.4, 9.2, 8.4),
    new THREE.MeshBasicMaterial({
      color: PALETTE.paper,
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0.15, 0.65, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;

  root.add(
    cameraEnvelope,
    fixedFrame,
    shaftAssembly,
    crosshead,
    outputFollower,
    valveLever,
  );

  const stateAtTime = (time) => {
    const unwrappedCyclePhase = time / cyclePeriod;
    const cyclePhase = THREE.MathUtils.euclideanModulo(
      unwrappedCyclePhase,
      1,
    );
    const governorAngle = fullTurn * unwrappedCyclePhase;
    const sine = Math.sin(governorAngle);
    const cosine = Math.cos(governorAngle);
    const speedFraction = 0.5 + 0.5 * sine;
    const speedFractionRate = Math.PI / cyclePeriod * cosine;
    const speedFractionAcceleration = -2 * Math.PI ** 2
      / cyclePeriod ** 2 * sine;
    const shaftAngularSpeed = minimumShaftAngularSpeed
      + shaftAngularSpeedRange * speedFraction;
    const shaftAngularAcceleration =
      shaftAngularSpeedRange * speedFractionRate;
    const integratedSpeedFraction = time / 2
      + cyclePeriod / (4 * Math.PI) * (1 - cosine);
    const shaftAngle = sourceShaftAngle
      + minimumShaftAngularSpeed * time
      + shaftAngularSpeedRange * integratedSpeedFraction;
    const lagAngle = minimumLagAngle + lagAngleRange * speedFraction;
    const lagAngularSpeed = lagAngleRange * speedFractionRate;
    const lagAngularAcceleration =
      lagAngleRange * speedFractionAcceleration;
    const crossheadAngle = shaftAngle - lagAngle;
    const crossheadAngularSpeed = shaftAngularSpeed - lagAngularSpeed;
    const crossheadAngularAcceleration =
      shaftAngularAcceleration - lagAngularAcceleration;
    const lift = rampRise * speedFraction;
    const liftVelocity = rampRise * speedFractionRate;
    const liftAcceleration = rampRise * speedFractionAcceleration;
    const rampContactY = rampBaseY + lift;
    const crossheadCenterY = rampContactY + rollerRadius;
    const crossheadPosition = new THREE.Vector3(0, crossheadCenterY, 0);
    const crossheadVelocity = new THREE.Vector3(0, liftVelocity, 0);
    const crossheadAcceleration = new THREE.Vector3(
      0,
      liftAcceleration,
      0,
    );
    const followerY = crossheadCenterY + followerOffsetY;
    const followerPosition = new THREE.Vector3(0, followerY, 0);
    const followerVelocity = crossheadVelocity.clone();
    const followerAcceleration = crossheadAcceleration.clone();
    const leverOffsetY = followerY - leverPivotY;
    const leverSlotCoordinate = Math.hypot(
      leverPivotToFollowerX,
      leverOffsetY,
    );
    const leverAngle = Math.atan2(
      leverOffsetY,
      leverPivotToFollowerX,
    );
    const leverDenominator = leverPivotToFollowerX ** 2
      + leverOffsetY ** 2;
    const leverAngularSpeed = leverPivotToFollowerX
      * liftVelocity / leverDenominator;
    const leverAngularAcceleration = leverPivotToFollowerX * (
      liftAcceleration * leverDenominator
      - 2 * leverOffsetY * liftVelocity ** 2
    ) / leverDenominator ** 2;
    const leverPivotPoint = new THREE.Vector3(
      leverPivotX,
      leverPivotY,
      leverPlaneZ,
    );
    const followerPinPoint = new THREE.Vector3(
      0,
      followerY,
      leverPlaneZ,
    );
    const leverDirection = new THREE.Vector3(
      Math.cos(leverAngle),
      Math.sin(leverAngle),
      0,
    );
    const leverSlotPoint = leverPivotPoint.clone().addScaledVector(
      leverDirection,
      leverSlotCoordinate,
    );
    const leverOutputPoint = leverPivotPoint.clone().addScaledVector(
      leverDirection,
      leverLength,
    );
    const rollerRollingDistance = (
      lagAngle - minimumLagAngle
    ) * rampArcLengthPerRadian;
    const rollerRollAngle = rollerRollingDistance / rollerRadius;
    const rollerRollingSpeed =
      lagAngularSpeed * rampArcLengthPerRadian;
    const rollerAngularSpeed = rollerRollingSpeed / rollerRadius;
    const rollerRollingAcceleration =
      lagAngularAcceleration * rampArcLengthPerRadian;
    const rollerAngularAcceleration =
      rollerRollingAcceleration / rollerRadius;
    const rollerContacts = [-1, 1].map((side, index) => {
      const rollerAngle = crossheadAngle + (side < 0 ? Math.PI : 0);
      const rampCenterAngle = side < 0 ? Math.PI : 0;
      const localRampPhase = -lagAngle;
      const contactPoint = radialPoint(
        rollerAngle,
        rollerOrbitRadius,
        rampContactY,
      );
      const centerPoint = contactPoint.clone();
      centerPoint.y += rollerRadius;
      const expectedRampY = rampBaseY + rampRise * (
        -localRampPhase - minimumLagAngle
      ) / lagAngleRange;
      return {
        centerPoint,
        contactHeightError: contactPoint.y - expectedRampY,
        contactPoint,
        index,
        localRampPhase,
        rampCenterAngle,
        rampPhaseError: Math.atan2(
          Math.sin(
            rollerAngle - shaftAngle - rampCenterAngle - localRampPhase,
          ),
          Math.cos(
            rollerAngle - shaftAngle - rampCenterAngle - localRampPhase,
          ),
        ),
        rollingAcceleration: rollerRollingAcceleration,
        rollingDistance: rollerRollingDistance,
        rollingSpeed: rollerRollingSpeed,
        side,
        spinAcceleration: side * rollerAngularAcceleration,
        spinAngle: side * rollerRollAngle,
        spinSpeed: side * rollerAngularSpeed,
        tangentialRollingError:
          rollerRadius * rollerAngularSpeed - rollerRollingSpeed,
      };
    });
    const phaseTolerance = 1e-10;
    const atMaximumSpeed = Math.abs(cyclePhase - 0.25) < phaseTolerance;
    const atMinimumSpeed = Math.abs(cyclePhase - 0.75) < phaseTolerance;
    const stage = atMaximumSpeed
      ? 'maximum-speed-crosshead-at-upper-governor-position'
      : atMinimumSpeed
        ? 'minimum-speed-weight-at-lower-governor-position'
        : liftVelocity > 0
          ? 'speed-increasing-rollers-climbing-inclined-planes'
          : 'speed-decreasing-weight-descending-inclined-planes';
    return {
      airDragLagAngle: lagAngle,
      crossheadAcceleration,
      crossheadAngle,
      crossheadAngularAcceleration,
      crossheadAngularSpeed,
      crossheadPosition,
      crossheadVelocity,
      cyclePhase,
      followerAcceleration,
      followerPosition,
      followerVelocity,
      governorSpeedFraction: speedFraction,
      governorSpeedFractionAcceleration: speedFractionAcceleration,
      governorSpeedFractionRate: speedFractionRate,
      lagAngle,
      lagAngularAcceleration,
      lagAngularSpeed,
      leverAngle,
      leverAngularAcceleration,
      leverAngularSpeed,
      leverCollinearityError: new THREE.Vector3()
        .crossVectors(
          leverDirection,
          followerPinPoint.clone().sub(leverPivotPoint),
        ).z,
      leverOutputPoint,
      leverPivotPoint,
      leverSlotCoordinate,
      leverSlotPoint,
      leverSlotPositionError: leverSlotPoint.distanceTo(followerPinPoint),
      lift,
      liftAcceleration,
      liftVelocity,
      rampContactY,
      rollerContacts,
      rollerRollAngle,
      rollerRollingAcceleration,
      rollerRollingDistance,
      rollerRollingSpeed,
      rollerSpinAcceleration: rollerAngularAcceleration,
      rollerSpinSpeed: rollerAngularSpeed,
      shaftAngle,
      shaftAngularAcceleration,
      shaftAngularSpeed,
      shaftRevolutions: (
        shaftAngle - sourceShaftAngle
      ) / fullTurn,
      stage,
      unwrappedCyclePhase,
    };
  };
  const stateAtCyclePhase = (cyclePhase) => stateAtTime(
    cyclePhase * cyclePeriod
  );
  const timeAtCyclePhase = (cyclePhase) => {
    const normalizedCyclePhase = cyclePhase >= 0 && cyclePhase < 1
      ? cyclePhase
      : THREE.MathUtils.euclideanModulo(cyclePhase, 1);
    return normalizedCyclePhase * cyclePeriod;
  };

  root.userData.mechanism =
    'drag-fan-loose-crosshead-twin-roller-inclined-plane-governor';
  root.userData.blocks = {
    baseRail,
    cameraEnvelope,
    centerShaft,
    crosshead,
    crossheadArms,
    crossheadRotationIndex,
    fanAssemblies,
    fixedFrame,
    followerIndex,
    followerPin,
    leverPivotBracket,
    leverPivotPin,
    leverSupportPost,
    looseSleeve,
    lowerBearing,
    lowerBearingPost,
    lowerBulbNeck,
    lowerShaftCollar,
    outputFollower,
    rampBaseRing,
    rollerAssemblies,
    rotatingThrustRing,
    shaftAssembly,
    shaftRotationIndex,
    shaftRotor,
    thrustCollar,
    upperBulbNeck,
    valveLever,
    valveLeverBody,
    valveLeverEnd,
    valveLeverIndex,
    valveLeverRotor,
    valveLeverSlot,
    weightedBulb,
  };
  root.userData.canonicalStates = {
    decreasingMidpoint: stateAtCyclePhase(0.5),
    maximumSpeed: stateAtCyclePhase(0.25),
    minimumSpeed: stateAtCyclePhase(0.75),
    source: stateAtCyclePhase(0),
  };
  root.userData.geometry = {
    axis: Y_AXIS.clone(),
    crossheadArmThickness,
    crossheadArmY,
    cyclePeriod,
    fanDepth,
    fanHeight,
    fanOrbitRadius,
    fanOutlineDepth,
    fanRivetRadius,
    fanWidth,
    followerBearingLocalY,
    followerMaximumY,
    followerMidpointY,
    followerMinimumY,
    followerOffsetY,
    fullTurn,
    lagAngleRange,
    leverDepth,
    leverLength,
    leverPivotToFollowerX,
    leverPivotX,
    leverPivotY,
    leverPlaneZ,
    leverThickness,
    looseSleeveHeight,
    looseSleeveInnerRadius,
    looseSleeveOuterRadius,
    maximumCrossheadCenterY,
    maximumLagAngle,
    maximumShaftAngularSpeed,
    maximumTurnsPerSecond,
    meanShaftAngularSpeed,
    minimumCrossheadCenterY,
    minimumLagAngle,
    minimumShaftAngularSpeed,
    minimumTurnsPerSecond,
    rampArcLengthPerRadian,
    rampBaseY,
    rampFoundationY,
    rampInnerRadius,
    rampOuterRadius,
    rampRadialHalfWidth,
    rampRise,
    rampSampleCount,
    rampSlopePerRadian,
    rollerOrbitRadius,
    rollerRadius,
    rollerWidth,
    shaftAngularSpeedRange,
    shaftCenterY,
    shaftLength,
    shaftMaximumY,
    shaftMinimumY,
    shaftRadius,
    shaftRevolutionsPerGovernorCycle,
    sourceFanHeight,
    sourceFanOrbitRadius,
    sourceFanWidth,
    sourceFollowerOffsetY,
    sourceLagAngle,
    sourceRampRadialHalfWidth,
    sourceRollAngle,
    sourceRollerOrbitRadius,
    sourceRollerRadius,
    sourceScale,
    sourceShaftAngle,
    sourceShaftRadius,
    sourceWeightCenterY,
    sourceWeightRadius,
    weightBottomY,
    weightCenterLocalY,
    weightRadius,
    weightVerticalScale,
  };
  root.userData.rampRecords = rampRecords;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeAtCyclePhase = timeAtCyclePhase;

  const update = (time) => {
    const state = stateAtTime(time);
    shaftRotor.rotation.y = state.shaftAngle;
    shaftAssembly.userData.angularSpeed = state.shaftAngularSpeed;
    crosshead.position.copy(state.crossheadPosition);
    crosshead.rotation.set(0, state.crossheadAngle, 0);
    crosshead.userData.angularSpeed = state.crossheadAngularSpeed;
    crosshead.userData.velocity = state.crossheadVelocity.clone();
    for (const [index, roller] of rollerAssemblies.entries()) {
      roller.rotor.rotation.x = state.rollerContacts[index].spinAngle;
      roller.assembly.userData.spinSpeed =
        state.rollerContacts[index].spinSpeed;
    }
    outputFollower.position.copy(state.followerPosition);
    outputFollower.rotation.set(0, 0, 0);
    valveLeverRotor.rotation.z = state.leverAngle;
    valveLever.userData.angularSpeed = state.leverAngularSpeed;
    root.userData.contacts = {
      looseCrossheadSleeve: {
        angularSlip: state.lagAngle,
        axis: Y_AXIS.clone(),
        radialClearance: looseSleeveInnerRadius - shaftRadius,
        rotationFree: true,
        translation: state.lift,
      },
      outputThrustCollar: {
        axialPositionError: outputFollower.position.y
          - state.followerPosition.y,
        nonrotating: outputFollower.rotation.x === 0
          && outputFollower.rotation.y === 0
          && outputFollower.rotation.z === 0,
        pinPoint: new THREE.Vector3(
          0,
          state.followerPosition.y,
          leverPlaneZ,
        ),
      },
      regulatingValveLever: {
        angularAcceleration: state.leverAngularAcceleration,
        angularSpeed: state.leverAngularSpeed,
        collinearityError: state.leverCollinearityError,
        pinPositionError: state.leverSlotPositionError,
        slotCoordinate: state.leverSlotCoordinate,
      },
      rollerRampPairs: state.rollerContacts.map((contact) => ({
        contactHeightError: contact.contactHeightError,
        contactPoint: contact.contactPoint.clone(),
        rampPhaseError: contact.rampPhaseError,
        rollingAcceleration: contact.rollingAcceleration,
        rollingSpeed: contact.rollingSpeed,
        spinAcceleration: contact.spinAcceleration,
        spinSpeed: contact.spinSpeed,
        tangentialRollingError: contact.tangentialRollingError,
      })),
      shaft: {
        angularAcceleration: state.shaftAngularAcceleration,
        angularSpeed: state.shaftAngularSpeed,
        axialDisplacement: 0,
        centerlineError: 0,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);

  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  root.traverse((object) => {
    if (!object.userData.cameraFitGuide) return;
    object.castShadow = false;
    object.receiveShadow = false;
  });
  for (const index of [
    crossheadRotationIndex,
    followerIndex,
    shaftRotationIndex,
    valveLeverIndex,
    ...rollerAssemblies.map((roller) => roller.index),
    ...fanAssemblies.flatMap((fan) => fan.rivets),
  ]) {
    index.castShadow = false;
    index.receiveShadow = false;
  }
  root.userData.fidelity = 'authored';
  return {
    cameraDirection: new THREE.Vector3(8.5, 5.7, 12.5),
    root,
    update,
  };
}

function centrifugalBallSteamGovernorMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Brown's plate shows the solid low-speed pose and dotted high-speed pose.
  // The dimensions below are measured from that 525 px plate. Each top arm
  // continues through its elbow to a ball, while a second fixed-length link
  // joins the elbow to the coaxial sliding sleeve.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterSpindleAxisX = 279;
  const sourceRasterInputGearCenter = new THREE.Vector2(279, 43);
  const sourceRasterInputGearRadius = 35;
  const sourceRasterDrivenGearCenter = new THREE.Vector2(279, 78);
  const sourceRasterTopPivotLeft = new THREE.Vector2(258, 145);
  const sourceRasterTopPivotRight = new THREE.Vector2(303, 145);
  const sourceRasterElbowLeft = new THREE.Vector2(210, 269);
  const sourceRasterElbowRight = new THREE.Vector2(350, 269);
  const sourceRasterBallLeft = new THREE.Vector2(180, 345);
  const sourceRasterBallRight = new THREE.Vector2(379, 345);
  const sourceRasterBallRadius = 34;
  const sourceRasterHighBallLeft = new THREE.Vector2(124, 324);
  const sourceRasterHighBallRight = new THREE.Vector2(430, 324);
  const sourceRasterSleeveLeft = new THREE.Vector2(261, 389);
  const sourceRasterSleeveRight = new THREE.Vector2(298, 389);
  const sourceRasterOutputLeverY = 407;
  const sourceRasterValveCenter = new THREE.Vector2(279, 481);
  const sourceUnitsPerPixel = 0.018;
  const sourceTopPivotY = 2.8;
  const sourcePointFromRaster = (point) => new THREE.Vector2(
    (point.x - sourceRasterSpindleAxisX) * sourceUnitsPerPixel,
    sourceTopPivotY
      + (sourceRasterTopPivotLeft.y - point.y) * sourceUnitsPerPixel,
  );
  const sourceInputGearCenter = sourcePointFromRaster(
    sourceRasterInputGearCenter,
  );
  const sourceDrivenGearCenter = sourcePointFromRaster(
    sourceRasterDrivenGearCenter,
  );
  const sourceTopPivotLeft = sourcePointFromRaster(
    sourceRasterTopPivotLeft,
  );
  const sourceElbowLeft = sourcePointFromRaster(sourceRasterElbowLeft);
  const sourceBallLeft = sourcePointFromRaster(sourceRasterBallLeft);
  const sourceHighBallLeft = sourcePointFromRaster(
    sourceRasterHighBallLeft,
  );
  const sourceHighBallRight = sourcePointFromRaster(
    sourceRasterHighBallRight,
  );
  const sourceSleeveLeft = sourcePointFromRaster(sourceRasterSleeveLeft);
  const sourceValveCenter = sourcePointFromRaster(sourceRasterValveCenter);
  const outputLeverDrop = (
    sourceRasterOutputLeverY - sourceRasterSleeveLeft.y
  ) * sourceUnitsPerPixel;

  const topPivotY = sourceTopPivotY;
  const topPivotRadius = 0.405;
  const upperArmLength = 3.858;
  const elbowArmLength = 2.388;
  const lowerLinkLength = 2.351;
  const sleevePinRadius = 0.333;
  const minimumSpreadAngle = 0.365;
  const maximumSpreadAngle = 0.60;
  const ballRadius = sourceRasterBallRadius * sourceUnitsPerPixel;
  const ballIndexRadialOffset = ballRadius * 0.92;
  const ballMass = 1;
  const gravityAcceleration = 9.81;
  const equilibriumAtSpreadAngle = (spreadAngle) => {
    const ballOrbitRadius = topPivotRadius
      + upperArmLength * Math.sin(spreadAngle);
    const ballCenterY = topPivotY
      - upperArmLength * Math.cos(spreadAngle);
    const elbowOrbitRadius = topPivotRadius
      + elbowArmLength * Math.sin(spreadAngle);
    const elbowY = topPivotY
      - elbowArmLength * Math.cos(spreadAngle);
    const lowerHorizontalOffset = elbowOrbitRadius - sleevePinRadius;
    const lowerVerticalDrop = Math.sqrt(
      lowerLinkLength ** 2 - lowerHorizontalOffset ** 2,
    );
    const sleeveY = elbowY - lowerVerticalDrop;
    const spindleAngularSpeed = Math.sqrt(
      gravityAcceleration * Math.tan(spreadAngle) / ballOrbitRadius,
    );
    return {
      ballCenterY,
      ballOrbitRadius,
      elbowOrbitRadius,
      elbowY,
      lowerHorizontalOffset,
      lowerVerticalDrop,
      sleeveY,
      spindleAngularSpeed,
      spreadAngle,
    };
  };
  const minimumEquilibrium = equilibriumAtSpreadAngle(minimumSpreadAngle);
  const maximumEquilibrium = equilibriumAtSpreadAngle(maximumSpreadAngle);
  const minimumSpindleAngularSpeed =
    minimumEquilibrium.spindleAngularSpeed;
  const maximumSpindleAngularSpeed =
    maximumEquilibrium.spindleAngularSpeed;
  const spindleAngularSpeedRange = maximumSpindleAngularSpeed
    - minimumSpindleAngularSpeed;
  const meanSpindleAngularSpeed = (
    minimumSpindleAngularSpeed + maximumSpindleAngularSpeed
  ) / 2;
  const sleeveMinimumY = minimumEquilibrium.sleeveY;
  const sleeveMaximumY = maximumEquilibrium.sleeveY;
  const sleeveStroke = sleeveMaximumY - sleeveMinimumY;
  const speedCyclePeriod = 8;
  const speedCycleAngularFrequency = fullTurn / speedCyclePeriod;
  const equilibriumIterations = 56;
  const spreadAngleAtSpindleSpeed = (spindleAngularSpeed) => {
    let lower = minimumSpreadAngle - 0.08;
    let upper = maximumSpreadAngle + 0.08;
    const residual = (spreadAngle) => {
      const orbitRadius = topPivotRadius
        + upperArmLength * Math.sin(spreadAngle);
      return gravityAcceleration * Math.tan(spreadAngle)
        - spindleAngularSpeed ** 2 * orbitRadius;
    };
    let lowerResidual = residual(lower);
    const upperResidual = residual(upper);
    if (lowerResidual * upperResidual > 0) {
      throw new RangeError('Movement 161 lost its governor equilibrium branch.');
    }
    for (let iteration = 0; iteration < equilibriumIterations; iteration += 1) {
      const middle = (lower + upper) / 2;
      const middleResidual = residual(middle);
      if (lowerResidual * middleResidual <= 0) {
        upper = middle;
      } else {
        lower = middle;
        lowerResidual = middleResidual;
      }
    }
    return (lower + upper) / 2;
  };

  // The perpendicular pitch cones share this apex and outer contact point.
  // Their outer pitch radii and tooth counts have the same 30:18 ratio.
  const gearApex = new THREE.Vector3(0, sourceInputGearCenter.y, 0);
  const inputGearAxis = Z_AXIS.clone();
  const governorAxis = Y_AXIS.clone();
  const drivenGearConstructionAxis = Y_AXIS.clone().negate();
  const inputGearTeeth = 30;
  const drivenGearTeeth = 18;
  const inputGearOuterDistance = 0.45;
  const drivenGearOuterDistance = 0.75;
  const inputGearPitchRadius = drivenGearOuterDistance;
  const drivenGearPitchRadius = inputGearOuterDistance;
  const inputGearPitchConeAngle = Math.atan2(
    inputGearPitchRadius,
    inputGearOuterDistance,
  );
  const drivenGearPitchConeAngle = Math.atan2(
    drivenGearPitchRadius,
    drivenGearOuterDistance,
  );
  const gearContactPoint = gearApex.clone()
    .addScaledVector(drivenGearConstructionAxis, drivenGearOuterDistance)
    .addScaledVector(inputGearAxis, inputGearOuterDistance);
  const gearContactOffset = gearContactPoint.clone().sub(gearApex);
  const toothHeight = 0.12;

  const inputGear = makePitchBevelGear({
    axis: inputGearAxis,
    color: PALETTE.driver,
    indexToothIndex: 0,
    innerDistance: inputGearOuterDistance * 0.34,
    outerDistance: inputGearOuterDistance,
    pitchConeAngle: inputGearPitchConeAngle,
    teeth: inputGearTeeth,
    toothHeight,
  });
  inputGear.position.copy(gearApex);
  inputGear.userData.role = 'engine-driven-horizontal-input-bevel-gear';
  const inputGearRotor = inputGear.userData.rotor;
  const inputShaft = cylinderAlongZ(
    0.12,
    2.65,
    matte(PALETTE.ink, { metalness: 0.27, roughness: 0.45 }),
    38,
  );
  inputShaft.position.z = -0.43;
  inputShaft.userData.role = 'horizontal-engine-input-shaft';
  inputGearRotor.add(inputShaft);

  const drivenGear = makePitchBevelGear({
    axis: drivenGearConstructionAxis,
    color: PALETTE.driven,
    indexToothIndex: 0,
    innerDistance: drivenGearOuterDistance * 0.34,
    outerDistance: drivenGearOuterDistance,
    pitchConeAngle: drivenGearPitchConeAngle,
    teeth: drivenGearTeeth,
    toothHeight,
  });
  drivenGear.position.copy(gearApex);
  drivenGear.userData.role = 'vertical-spindle-driven-bevel-pinion';
  const drivenGearRotor = drivenGear.userData.rotor;
  const localContactAngle = (gear, point) => {
    const localPoint = point.clone().sub(gear.position).applyQuaternion(
      gear.quaternion.clone().invert(),
    );
    return Math.atan2(localPoint.y, localPoint.x);
  };
  const inputGearPhase = localContactAngle(inputGear, gearContactPoint);
  const drivenGearPhase = localContactAngle(drivenGear, gearContactPoint)
    - Math.PI / drivenGearTeeth;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.60,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.62,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.18,
    roughness: 0.54,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.47,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.69,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.44 });

  const spindleBottomY = -2.78;
  const spindleTopY = gearApex.y + 0.06;
  const governorRotor = new THREE.Group();
  governorRotor.userData.axis = governorAxis.clone();
  governorRotor.userData.role =
    'bevel-driven-central-spindle-head-arms-balls-and-sleeve';
  const spindle = cylinderAlongY(
    0.105,
    spindleTopY - spindleBottomY,
    darkMaterial,
    38,
  );
  spindle.position.y = (spindleTopY + spindleBottomY) / 2;
  spindle.userData.role = 'continuous-vertical-governor-spindle';
  const spindleIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, 0.42, 0.055),
    indexMaterial,
  );
  spindleIndex.position.set(0.14, 1.52, 0);
  spindleIndex.userData.role = 'white-index-on-rotating-spindle';

  const topHead = new THREE.Group();
  topHead.userData.role = 'spindle-fixed-two-arm-governor-head';
  const topHeadHub = cylinderAlongY(0.37, 0.50, drivenMaterial, 44);
  topHeadHub.position.y = topPivotY;
  topHeadHub.userData.role = 'rotating-upper-governor-head-hub';
  const topHeadCrossbar = makeBeam(
    new THREE.Vector3(-topPivotRadius, topPivotY, 0),
    new THREE.Vector3(topPivotRadius, topPivotY, 0),
    { color: PALETTE.driven, depth: 0.32, thickness: 0.22 },
  );
  topHeadCrossbar.userData.role = 'upper-head-crossbar-between-arm-pivots';
  topHead.add(topHeadHub, topHeadCrossbar);

  const sourceSleeveY = minimumEquilibrium.sleeveY;
  const rotatingSleeve = new THREE.Group();
  rotatingSleeve.position.y = sourceSleeveY;
  rotatingSleeve.userData.role =
    'spindle-rotating-axially-sliding-lower-link-sleeve';
  const rotatingSleeveBody = cylinderAlongY(
    0.34,
    0.70,
    accentMaterial,
    44,
  );
  rotatingSleeveBody.userData.role = 'rotating-sliding-sleeve-body';
  const sleeveCrossbar = makeBeam(
    new THREE.Vector3(-sleevePinRadius, 0, 0),
    new THREE.Vector3(sleevePinRadius, 0, 0),
    { color: PALETTE.accent, depth: 0.30, thickness: 0.20 },
  );
  sleeveCrossbar.userData.role = 'lower-link-pins-fixed-to-sleeve';
  const sleeveIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.22, 0.045),
    indexMaterial,
  );
  sleeveIndex.position.set(0.335, 0, 0);
  sleeveIndex.userData.role = 'white-index-on-rotating-sliding-sleeve';
  rotatingSleeve.add(rotatingSleeveBody, sleeveCrossbar, sleeveIndex);

  const ballAssemblies = [-1, 1].map((sign, index) => {
    const upperPivot = new THREE.Vector3(
      sign * topPivotRadius,
      topPivotY,
      0,
    );
    const sourceEquilibrium = minimumEquilibrium;
    const elbow = new THREE.Vector3(
      sign * sourceEquilibrium.elbowOrbitRadius,
      sourceEquilibrium.elbowY,
      0,
    );
    const ballPoint = new THREE.Vector3(
      sign * sourceEquilibrium.ballOrbitRadius,
      sourceEquilibrium.ballCenterY,
      0,
    );
    const sleevePin = new THREE.Vector3(
      sign * sleevePinRadius,
      sourceEquilibrium.sleeveY,
      0,
    );
    const upperArm = makeBeam(upperPivot, ballPoint, {
      color: PALETTE.driven,
      depth: 0.15,
      thickness: 0.13,
    });
    upperArm.userData.role = `rigid-upper-arm-through-ball-${index + 1}`;
    const lowerLink = makeBeam(elbow, sleevePin, {
      color: PALETTE.ink,
      depth: 0.14,
      thickness: 0.12,
    });
    lowerLink.userData.role = `fixed-length-lower-sleeve-link-${index + 1}`;
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(ballRadius, 40, 26),
      driverMaterial,
    );
    ball.position.copy(ballPoint);
    ball.userData.role = `centrifugal-governor-ball-${index + 1}`;
    const ballIndex = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 14, 10),
      indexMaterial,
    );
    ballIndex.position.set(
      sign * (sourceEquilibrium.ballOrbitRadius + ballIndexRadialOffset),
      sourceEquilibrium.ballCenterY,
      0,
    );
    ballIndex.userData.role = `white-orbit-index-on-ball-${index + 1}`;
    const topPivotHub = cylinderAlongZ(0.16, 0.40, darkMaterial, 30);
    topPivotHub.position.copy(upperPivot);
    topPivotHub.userData.role = `upper-arm-pivot-pin-${index + 1}`;
    const elbowHub = cylinderAlongZ(0.15, 0.38, darkMaterial, 30);
    elbowHub.position.copy(elbow);
    elbowHub.userData.role = `upper-to-lower-link-elbow-pin-${index + 1}`;
    const sleevePinHub = cylinderAlongZ(0.14, 0.38, darkMaterial, 30);
    sleevePinHub.position.copy(sleevePin);
    sleevePinHub.userData.role = `lower-link-sleeve-pin-${index + 1}`;
    governorRotor.add(
      upperArm,
      lowerLink,
      ball,
      ballIndex,
      topPivotHub,
      elbowHub,
      sleevePinHub,
    );
    return {
      ball,
      ballIndex,
      elbowHub,
      lowerLink,
      sign,
      sleevePinHub,
      topPivotHub,
      upperArm,
    };
  });
  governorRotor.add(spindle, spindleIndex, topHead, rotatingSleeve);

  const thrustCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.43, 0.075, 10, 48),
    accentMaterial,
  );
  thrustCollar.rotation.x = Math.PI / 2;
  thrustCollar.userData.role = 'nonrotating-thrust-collar-around-sleeve';
  const outputYoke = new THREE.Group();
  outputYoke.position.y = sourceSleeveY;
  outputYoke.userData.role =
    'nonrotating-guided-slide-connecting-sleeve-to-regulating-valve';
  const outputGuideX = -2.82;
  const yokeHandle = new THREE.Mesh(
    new THREE.BoxGeometry(2.22, 0.15, 0.18),
    accentMaterial,
  );
  yokeHandle.position.set(-1.70, -outputLeverDrop, 0.42);
  yokeHandle.userData.role = 'source-style-left-output-slide-arm';
  const yokeDropLink = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, outputLeverDrop + 0.15, 0.16),
    accentMaterial,
  );
  yokeDropLink.position.set(-0.70, -outputLeverDrop / 2, 0.42);
  yokeDropLink.userData.role =
    'vertical-leg-from-thrust-fork-to-lower-source-output-arm';
  const yokeForkA = new THREE.Mesh(
    new THREE.BoxGeometry(0.90, 0.13, 0.12),
    accentMaterial,
  );
  yokeForkA.position.set(-0.37, 0, 0.38);
  const yokeForkB = yokeForkA.clone();
  yokeForkB.position.z = -0.38;
  yokeForkA.userData.role = 'front-prong-of-sleeve-output-fork';
  yokeForkB.userData.role = 'rear-prong-of-sleeve-output-fork';
  const outputStemPin = cylinderAlongZ(0.10, 1.10, darkMaterial, 30);
  outputStemPin.position.z = 0.34;
  outputStemPin.userData.role = 'pin-bridging-thrust-collar-to-valve-rod-plane';
  outputYoke.add(
    thrustCollar,
    yokeHandle,
    yokeDropLink,
    yokeForkA,
    yokeForkB,
    outputStemPin,
  );

  const valvePortCenterY = -3.36;
  const valvePortHeight = 0.52;
  const valvePortBottomY = valvePortCenterY - valvePortHeight / 2;
  const valveGateHeight = valvePortHeight;
  const valveGateLowY = valvePortBottomY - valveGateHeight / 2;
  const valvePlaneZ = 0.72;
  const valveGate = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, valveGateHeight, 0.16),
    driverMaterial,
  );
  valveGate.position.set(0, valveGateLowY, valvePlaneZ);
  valveGate.userData.role =
    'rising-regulating-valve-gate-that-restricts-steam-port';
  const valveGateIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.055, 0.025),
    indexMaterial,
  );
  valveGateIndex.position.set(0, 0, 0.095);
  valveGateIndex.userData.role = 'white-index-on-moving-valve-gate';
  valveGate.add(valveGateIndex);
  const valveRod = makeBeam(
    new THREE.Vector3(0, sourceSleeveY, valvePlaneZ),
    new THREE.Vector3(0, valveGateLowY, valvePlaneZ),
    { color: PALETTE.ink, depth: 0.12, thickness: 0.10 },
  );
  valveRod.userData.role = 'vertical-link-from-output-slide-to-valve-gate';

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-bearings-slide-guides-and-regulating-valve-body';
  const frameZ = -3.46;
  const baseY = -4.02;
  const baseRail = makeBeam(
    new THREE.Vector3(-3.25, baseY, frameZ),
    new THREE.Vector3(3.25, baseY, frameZ),
    { color: PALETTE.frame, depth: 0.28, thickness: 0.20 },
  );
  baseRail.userData.role = 'fixed-base-beneath-governor-and-valve';
  const rearStandard = makeBeam(
    new THREE.Vector3(0, baseY, frameZ),
    new THREE.Vector3(0, gearApex.y + 0.62, frameZ),
    { color: PALETTE.frame, depth: 0.24, thickness: 0.16 },
  );
  rearStandard.userData.role = 'rear-standard-carrying-both-gear-bearings';
  const inputBearingArm = makeBeam(
    new THREE.Vector3(0, gearApex.y, frameZ),
    new THREE.Vector3(0, gearApex.y, -0.72),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.15 },
  );
  inputBearingArm.userData.role = 'rear-arm-to-horizontal-input-bearing';
  const inputBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.065, 10, 42),
    frameMaterial,
  );
  inputBearing.position.set(0, gearApex.y, -0.72);
  inputBearing.userData.role = 'fixed-horizontal-input-shaft-bearing';
  const verticalBearingY = sourceDrivenGearCenter.y - 0.25;
  const verticalBearingArm = makeBeam(
    new THREE.Vector3(0, verticalBearingY, frameZ),
    new THREE.Vector3(0, verticalBearingY, -0.34),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.15 },
  );
  verticalBearingArm.userData.role = 'rear-arm-to-vertical-spindle-bearing';
  const verticalBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.23, 0.065, 10, 42),
    frameMaterial,
  );
  verticalBearing.rotation.x = Math.PI / 2;
  verticalBearing.position.set(0, verticalBearingY, -0.34);
  verticalBearing.userData.role = 'fixed-upper-vertical-spindle-bearing';
  const guideMinimumY = sleeveMinimumY - 0.28;
  const guideMaximumY = sleeveMaximumY + 0.28;
  const guideCenterY = (guideMinimumY + guideMaximumY) / 2
    - outputLeverDrop;
  const guideHeight = guideMaximumY - guideMinimumY;
  const outputGuideA = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, guideHeight, 0.14),
    frameMaterial,
  );
  outputGuideA.position.set(outputGuideX, guideCenterY, 0.27);
  const outputGuideB = outputGuideA.clone();
  outputGuideB.position.z = 0.57;
  outputGuideA.userData.role = 'front-rail-of-nonrotating-output-slide-guide';
  outputGuideB.userData.role = 'rear-rail-of-nonrotating-output-slide-guide';
  const leftDuct = new THREE.Mesh(
    new THREE.BoxGeometry(2.30, 0.76, 0.86),
    drivenMaterial,
  );
  leftDuct.position.set(-1.57, valvePortCenterY, 0.24);
  leftDuct.userData.role = 'left-steam-duct-to-regulating-port';
  const rightDuct = leftDuct.clone();
  rightDuct.position.x = 1.57;
  rightDuct.userData.role = 'right-steam-duct-from-regulating-port';
  const leftDuctTopY = valvePortCenterY + 0.76 / 2;
  const outputGuideBottomY = guideCenterY - guideHeight / 2;
  const outputGuideSupportHeight = outputGuideBottomY - leftDuctTopY;
  const outputGuideSupport = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, outputGuideSupportHeight, 0.44),
    frameMaterial,
  );
  outputGuideSupport.position.set(
    outputGuideX,
    (outputGuideBottomY + leftDuctTopY) / 2,
    0.42,
  );
  outputGuideSupport.userData.role =
    'fixed-bracket-joining-output-slide-guide-to-valve-body';
  const valvePort = new THREE.Mesh(
    new THREE.BoxGeometry(0.84, valvePortHeight, 0.20),
    darkMaterial,
  );
  valvePort.position.set(0, valvePortCenterY, valvePlaneZ - 0.12);
  valvePort.userData.role = 'visible-steam-port-restricted-by-rising-gate';
  const valveFrameTop = new THREE.Mesh(
    new THREE.BoxGeometry(1.04, 0.14, 0.36),
    frameMaterial,
  );
  valveFrameTop.position.set(
    0,
    valvePortCenterY + valvePortHeight / 2 + 0.09,
    valvePlaneZ - 0.04,
  );
  const valveFrameBottom = valveFrameTop.clone();
  valveFrameBottom.position.y =
    valvePortCenterY - valvePortHeight / 2 - 0.09;
  const valveFrameLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, valvePortHeight + 0.32, 0.36),
    frameMaterial,
  );
  valveFrameLeft.position.set(-0.49, valvePortCenterY, valvePlaneZ - 0.04);
  const valveFrameRight = valveFrameLeft.clone();
  valveFrameRight.position.x = 0.49;
  valveFrameTop.userData.role = 'top-of-fixed-regulating-valve-guide';
  valveFrameBottom.userData.role = 'bottom-of-fixed-regulating-valve-guide';
  valveFrameLeft.userData.role = 'left-side-of-fixed-regulating-valve-guide';
  valveFrameRight.userData.role = 'right-side-of-fixed-regulating-valve-guide';
  fixedFrame.add(
    baseRail,
    rearStandard,
    inputBearingArm,
    inputBearing,
    verticalBearingArm,
    verticalBearing,
    outputGuideA,
    outputGuideB,
    outputGuideSupport,
    leftDuct,
    rightDuct,
    valvePort,
    valveFrameTop,
    valveFrameBottom,
    valveFrameLeft,
    valveFrameRight,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(7.4, 10.4, 7.2),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0, 0.65, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-for-both-ball-orbits-and-complete-valve-stroke';

  root.add(
    cameraEnvelope,
    fixedFrame,
    inputGear,
    drivenGear,
    governorRotor,
    outputYoke,
    valveRod,
    valveGate,
  );

  const rotatingPointKinematics = ({
    angle,
    angularAcceleration,
    angularSpeed,
    radius,
    radialAcceleration = 0,
    radialSpeed = 0,
    verticalAcceleration = 0,
    verticalSpeed = 0,
    y,
  }) => {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const centripetalRadial = radialAcceleration
      - radius * angularSpeed ** 2;
    const coriolisTangential = 2 * radialSpeed * angularSpeed
      + radius * angularAcceleration;
    return {
      acceleration: new THREE.Vector3(
        centripetalRadial * cosine - coriolisTangential * sine,
        verticalAcceleration,
        -centripetalRadial * sine - coriolisTangential * cosine,
      ),
      position: radialPoint(angle, radius, y),
      velocity: new THREE.Vector3(
        radialSpeed * cosine - radius * angularSpeed * sine,
        verticalSpeed,
        -radialSpeed * sine - radius * angularSpeed * cosine,
      ),
    };
  };

  const stateAtTime = (time) => {
    const speedCycleAngle = speedCycleAngularFrequency * time;
    const speedFraction = (1 - Math.cos(speedCycleAngle)) / 2;
    const speedFractionRate = speedCycleAngularFrequency
      * Math.sin(speedCycleAngle) / 2;
    const speedFractionAcceleration = speedCycleAngularFrequency ** 2
      * Math.cos(speedCycleAngle) / 2;
    const spindleAngularSpeed = minimumSpindleAngularSpeed
      + spindleAngularSpeedRange * speedFraction;
    const spindleAngularAcceleration = spindleAngularSpeedRange
      * speedFractionRate;
    const spindleAngularJerk = spindleAngularSpeedRange
      * speedFractionAcceleration;
    const governorAngle = meanSpindleAngularSpeed * time
      - spindleAngularSpeedRange
        * Math.sin(speedCycleAngle)
        / (2 * speedCycleAngularFrequency);
    const spreadAngle = spreadAngleAtSpindleSpeed(spindleAngularSpeed);
    const sine = Math.sin(spreadAngle);
    const cosine = Math.cos(spreadAngle);
    const tangent = Math.tan(spreadAngle);
    const secantSquared = 1 / cosine ** 2;
    const ballOrbitRadius = topPivotRadius + upperArmLength * sine;
    const equilibriumAngleSlope = gravityAcceleration * secantSquared
      - spindleAngularSpeed ** 2 * upperArmLength * cosine;
    const equilibriumOmegaSlope = -2 * spindleAngularSpeed
      * ballOrbitRadius;
    const spreadAngularSpeed = -equilibriumOmegaSlope
      * spindleAngularAcceleration / equilibriumAngleSlope;
    const equilibriumAngleCurvature = 2 * gravityAcceleration
      * secantSquared * tangent
      + spindleAngularSpeed ** 2 * upperArmLength * sine;
    const equilibriumMixedSlope = -2 * spindleAngularSpeed
      * upperArmLength * cosine;
    const equilibriumOmegaCurvature = -2 * ballOrbitRadius;
    const spreadAngularAcceleration = -(
      equilibriumAngleCurvature * spreadAngularSpeed ** 2
      + 2 * equilibriumMixedSlope * spreadAngularSpeed
        * spindleAngularAcceleration
      + equilibriumOmegaCurvature * spindleAngularAcceleration ** 2
      + equilibriumOmegaSlope * spindleAngularJerk
    ) / equilibriumAngleSlope;

    const ballCenterY = topPivotY - upperArmLength * cosine;
    const ballRadialSpeed = upperArmLength * cosine * spreadAngularSpeed;
    const ballVerticalSpeed = upperArmLength * sine * spreadAngularSpeed;
    const ballRadialAcceleration = upperArmLength * (
      -sine * spreadAngularSpeed ** 2
        + cosine * spreadAngularAcceleration
    );
    const ballVerticalAcceleration = upperArmLength * (
      cosine * spreadAngularSpeed ** 2
        + sine * spreadAngularAcceleration
    );
    const elbowOrbitRadius = topPivotRadius + elbowArmLength * sine;
    const elbowY = topPivotY - elbowArmLength * cosine;
    const elbowRadialSpeed = elbowArmLength * cosine * spreadAngularSpeed;
    const elbowVerticalSpeed = elbowArmLength * sine * spreadAngularSpeed;
    const elbowRadialAcceleration = elbowArmLength * (
      -sine * spreadAngularSpeed ** 2
        + cosine * spreadAngularAcceleration
    );
    const elbowVerticalAcceleration = elbowArmLength * (
      cosine * spreadAngularSpeed ** 2
        + sine * spreadAngularAcceleration
    );
    const lowerHorizontalOffset = elbowOrbitRadius - sleevePinRadius;
    const lowerHorizontalSpeed = elbowRadialSpeed;
    const lowerHorizontalAcceleration = elbowRadialAcceleration;
    const lowerVerticalDrop = Math.sqrt(
      lowerLinkLength ** 2 - lowerHorizontalOffset ** 2,
    );
    const sleeveY = elbowY - lowerVerticalDrop;
    const sleeveVelocityY = elbowVerticalSpeed
      + lowerHorizontalOffset * lowerHorizontalSpeed / lowerVerticalDrop;
    const sleeveAccelerationY = elbowVerticalAcceleration
      + (
        lowerHorizontalSpeed ** 2
          + lowerHorizontalOffset * lowerHorizontalAcceleration
      ) / lowerVerticalDrop
      + lowerHorizontalOffset ** 2 * lowerHorizontalSpeed ** 2
        / lowerVerticalDrop ** 3;
    const sleeveLift = sleeveY - sleeveMinimumY;
    const sleeveLiftFraction = sleeveLift / sleeveStroke;
    const valveOpenFraction = 1 - sleeveLiftFraction;
    const valveOpenFractionRate = -sleeveVelocityY / sleeveStroke;
    const valveOpenFractionAcceleration = -sleeveAccelerationY
      / sleeveStroke;
    const valveGateY = valveGateLowY + sleeveLift;
    const inputGearAngle = inputGearPhase
      + governorAngle * drivenGearTeeth / inputGearTeeth;
    const inputGearAngularSpeed = spindleAngularSpeed
      * drivenGearTeeth / inputGearTeeth;
    const inputGearAngularAcceleration = spindleAngularAcceleration
      * drivenGearTeeth / inputGearTeeth;
    const drivenGearAngle = drivenGearPhase - governorAngle;
    const drivenGearAngularSpeed = -spindleAngularSpeed;
    const drivenGearAngularAcceleration = -spindleAngularAcceleration;
    const inputSurfaceVelocity = new THREE.Vector3()
      .crossVectors(inputGearAxis, gearContactOffset)
      .multiplyScalar(inputGearAngularSpeed);
    const drivenSurfaceVelocity = new THREE.Vector3()
      .crossVectors(governorAxis, gearContactOffset)
      .multiplyScalar(spindleAngularSpeed);
    const inputSurfaceAcceleration = new THREE.Vector3()
      .crossVectors(inputGearAxis, gearContactOffset)
      .multiplyScalar(inputGearAngularAcceleration)
      .addScaledVector(
        gearContactOffset.clone().addScaledVector(
          inputGearAxis,
          -gearContactOffset.dot(inputGearAxis),
        ),
        -(inputGearAngularSpeed ** 2),
      );
    const drivenSurfaceAcceleration = new THREE.Vector3()
      .crossVectors(governorAxis, gearContactOffset)
      .multiplyScalar(spindleAngularAcceleration)
      .addScaledVector(
        gearContactOffset.clone().addScaledVector(
          governorAxis,
          -gearContactOffset.dot(governorAxis),
        ),
        -(spindleAngularSpeed ** 2),
      );
    const meshTangent = inputSurfaceVelocity.lengthSq() > 1e-18
      ? inputSurfaceVelocity.clone().normalize()
      : new THREE.Vector3()
        .crossVectors(inputGearAxis, gearContactOffset)
        .normalize();
    const inputTangentialAcceleration = inputSurfaceAcceleration.dot(
      meshTangent,
    );
    const drivenTangentialAcceleration = drivenSurfaceAcceleration.dot(
      meshTangent,
    );
    const localUpperPivot = (sign) => new THREE.Vector3(
      sign * topPivotRadius,
      topPivotY,
      0,
    );
    const localElbow = (sign) => new THREE.Vector3(
      sign * elbowOrbitRadius,
      elbowY,
      0,
    );
    const localBall = (sign) => new THREE.Vector3(
      sign * ballOrbitRadius,
      ballCenterY,
      0,
    );
    const localSleevePin = (sign) => new THREE.Vector3(
      sign * sleevePinRadius,
      sleeveY,
      0,
    );
    const ballStates = [-1, 1].map((sign, index) => {
      const angle = governorAngle + (sign < 0 ? Math.PI : 0);
      const upperPivotKinematics = rotatingPointKinematics({
        angle,
        angularAcceleration: spindleAngularAcceleration,
        angularSpeed: spindleAngularSpeed,
        radius: topPivotRadius,
        y: topPivotY,
      });
      const elbowKinematics = rotatingPointKinematics({
        angle,
        angularAcceleration: spindleAngularAcceleration,
        angularSpeed: spindleAngularSpeed,
        radialAcceleration: elbowRadialAcceleration,
        radialSpeed: elbowRadialSpeed,
        radius: elbowOrbitRadius,
        verticalAcceleration: elbowVerticalAcceleration,
        verticalSpeed: elbowVerticalSpeed,
        y: elbowY,
      });
      const ballKinematics = rotatingPointKinematics({
        angle,
        angularAcceleration: spindleAngularAcceleration,
        angularSpeed: spindleAngularSpeed,
        radialAcceleration: ballRadialAcceleration,
        radialSpeed: ballRadialSpeed,
        radius: ballOrbitRadius,
        verticalAcceleration: ballVerticalAcceleration,
        verticalSpeed: ballVerticalSpeed,
        y: ballCenterY,
      });
      const sleevePinKinematics = rotatingPointKinematics({
        angle,
        angularAcceleration: spindleAngularAcceleration,
        angularSpeed: spindleAngularSpeed,
        radius: sleevePinRadius,
        verticalAcceleration: sleeveAccelerationY,
        verticalSpeed: sleeveVelocityY,
        y: sleeveY,
      });
      return {
        angle,
        ballAcceleration: ballKinematics.acceleration,
        ballPosition: ballKinematics.position,
        ballVelocity: ballKinematics.velocity,
        elbowAcceleration: elbowKinematics.acceleration,
        elbowPosition: elbowKinematics.position,
        elbowVelocity: elbowKinematics.velocity,
        index,
        localBall: localBall(sign),
        localElbow: localElbow(sign),
        localSleevePin: localSleevePin(sign),
        localUpperPivot: localUpperPivot(sign),
        lowerLinkLengthError: elbowKinematics.position.distanceTo(
          sleevePinKinematics.position,
        ) - lowerLinkLength,
        sign,
        sleevePinAcceleration: sleevePinKinematics.acceleration,
        sleevePinPosition: sleevePinKinematics.position,
        sleevePinVelocity: sleevePinKinematics.velocity,
        upperArmLengthError: upperPivotKinematics.position.distanceTo(
          ballKinematics.position,
        ) - upperArmLength,
        upperPivotAcceleration: upperPivotKinematics.acceleration,
        upperPivotPosition: upperPivotKinematics.position,
        upperPivotVelocity: upperPivotKinematics.velocity,
      };
    });
    const stage = Math.abs(spindleAngularAcceleration) < 1e-10
      ? Math.cos(speedCycleAngle) >= 0
        ? 'minimum-speed-balls-in-valve-open'
        : 'maximum-speed-balls-out-valve-restricted'
      : spindleAngularAcceleration > 0
        ? 'engine-speed-rises-governor-closes-valve'
        : 'engine-speed-falls-governor-opens-valve';
    return {
      assemblyBranchMargin: lowerLinkLength
        - Math.abs(lowerHorizontalOffset),
      ballCenterY,
      ballCentrifugalForce: ballMass * spindleAngularSpeed ** 2
        * ballOrbitRadius,
      ballGravityForce: ballMass * gravityAcceleration,
      ballOrbitRadius,
      ballRadialAcceleration,
      ballRadialSpeed,
      ballStates,
      ballVerticalAcceleration,
      ballVerticalSpeed,
      drivenGearAngle,
      drivenGearAngularAcceleration,
      drivenGearAngularSpeed,
      drivenSurfaceAcceleration,
      drivenTangentialAcceleration,
      drivenSurfaceVelocity,
      elbowOrbitRadius,
      elbowRadialAcceleration,
      elbowRadialSpeed,
      elbowVerticalAcceleration,
      elbowVerticalSpeed,
      elbowY,
      equilibriumAngleSlope,
      equilibriumResidual: gravityAcceleration * Math.tan(spreadAngle)
        - spindleAngularSpeed ** 2 * ballOrbitRadius,
      gearSurfaceAccelerationDifference: inputSurfaceAcceleration.distanceTo(
        drivenSurfaceAcceleration,
      ),
      gearMeshInvariant: inputGearTeeth
        * (inputGearAngle - inputGearPhase)
        + drivenGearTeeth * (drivenGearAngle - drivenGearPhase),
      gearSurfaceVelocityError: inputSurfaceVelocity.distanceTo(
        drivenSurfaceVelocity,
      ),
      gearTangentialAccelerationError: Math.abs(
        inputTangentialAcceleration - drivenTangentialAcceleration,
      ),
      governorAngle,
      inputGearAngle,
      inputGearAngularAcceleration,
      inputGearAngularSpeed,
      inputSurfaceAcceleration,
      inputTangentialAcceleration,
      inputSurfaceVelocity,
      lowerHorizontalAcceleration,
      lowerHorizontalOffset,
      lowerHorizontalSpeed,
      lowerVerticalDrop,
      sleeveAccelerationY,
      sleeveLift,
      sleeveLiftFraction,
      sleeveVelocityY,
      sleeveY,
      speedCycleAngle,
      speedFraction,
      speedFractionAcceleration,
      speedFractionRate,
      spindleAngularAcceleration,
      spindleAngularJerk,
      spindleAngularSpeed,
      spreadAngle,
      spreadAngularAcceleration,
      spreadAngularSpeed,
      stage,
      valveGateAccelerationY: sleeveAccelerationY,
      valveGateVelocityY: sleeveVelocityY,
      valveGateY,
      valveOpenFraction,
      valveOpenFractionAcceleration,
      valveOpenFractionRate,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * speedCyclePeriod,
  );
  const canonicalTimes = {
    accelerating: speedCyclePeriod / 4,
    decelerating: speedCyclePeriod * 3 / 4,
    highSpeed: speedCyclePeriod / 2,
    lowSpeed: 0,
    nextLowSpeed: speedCyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const update = (time) => {
    const state = stateAtTime(time);
    inputGearRotor.rotation.z = state.inputGearAngle;
    drivenGearRotor.rotation.z = state.drivenGearAngle;
    inputGear.userData.angularAcceleration =
      state.inputGearAngularAcceleration;
    inputGear.userData.angularSpeed = state.inputGearAngularSpeed;
    drivenGear.userData.angularAcceleration =
      state.drivenGearAngularAcceleration;
    drivenGear.userData.angularSpeed = state.drivenGearAngularSpeed;
    governorRotor.rotation.y = state.governorAngle;
    governorRotor.userData.angularAcceleration =
      state.spindleAngularAcceleration;
    governorRotor.userData.angularSpeed = state.spindleAngularSpeed;
    rotatingSleeve.position.y = state.sleeveY;
    rotatingSleeve.userData.axialAcceleration = state.sleeveAccelerationY;
    rotatingSleeve.userData.axialSpeed = state.sleeveVelocityY;
    state.ballStates.forEach((ballState, index) => {
      const assembly = ballAssemblies[index];
      assembly.upperArm.userData.setEndpoints(
        ballState.localUpperPivot,
        ballState.localBall,
      );
      assembly.lowerLink.userData.setEndpoints(
        ballState.localElbow,
        ballState.localSleevePin,
      );
      assembly.ball.position.copy(ballState.localBall);
      assembly.ballIndex.position.set(
        ballState.sign * (
          state.ballOrbitRadius + ballIndexRadialOffset
        ),
        state.ballCenterY,
        0,
      );
      assembly.elbowHub.position.copy(ballState.localElbow);
      assembly.sleevePinHub.position.copy(ballState.localSleevePin);
    });
    outputYoke.position.y = state.sleeveY;
    outputYoke.userData.axialAcceleration = state.sleeveAccelerationY;
    outputYoke.userData.axialSpeed = state.sleeveVelocityY;
    valveGate.position.y = state.valveGateY;
    valveGate.userData.openFraction = state.valveOpenFraction;
    valveRod.userData.setEndpoints(
      new THREE.Vector3(0, state.sleeveY, valvePlaneZ),
      new THREE.Vector3(0, state.valveGateY, valvePlaneZ),
    );
    root.userData.contacts = {
      bevelMesh: {
        contactPoint: gearContactPoint.clone(),
        drivenAxis: governorAxis.clone(),
        drivenPitchRadius: drivenGearPitchRadius,
        gearSurfaceAccelerationDifference:
          state.gearSurfaceAccelerationDifference,
        gearSurfaceVelocityError: state.gearSurfaceVelocityError,
        gearTangentialAccelerationError:
          state.gearTangentialAccelerationError,
        inputAxis: inputGearAxis.clone(),
        inputPitchRadius: inputGearPitchRadius,
      },
      governorLinks: state.ballStates.map((ballState) => ({
        lowerLinkLengthError: ballState.lowerLinkLengthError,
        upperArmLengthError: ballState.upperArmLengthError,
      })),
      regulatingValve: {
        feedbackSign: -1,
        gatePositionY: state.valveGateY,
        openFraction: state.valveOpenFraction,
      },
      slidingSleeve: {
        axialPosition: state.sleeveY,
        axialSpeed: state.sleeveVelocityY,
        nonrotatingOutputYoke: true,
        rotatingSleeve: true,
        strokeFraction: state.sleeveLiftFraction,
      },
    };
    root.userData.kinematics = state;
  };

  root.userData.mechanism =
    'bevel-driven-watt-flyball-governor-sliding-sleeve-regulating-valve';
  root.userData.cameraDistanceScale = 0.93;
  root.userData.blocks = {
    ballAssemblies,
    baseRail,
    cameraEnvelope,
    drivenGear,
    drivenGearRotor,
    fixedFrame,
    governorRotor,
    inputBearing,
    inputGear,
    inputGearRotor,
    inputShaft,
    leftDuct,
    outputGuideA,
    outputGuideB,
    outputGuideSupport,
    outputStemPin,
    outputYoke,
    yokeDropLink,
    rearStandard,
    rightDuct,
    rotatingSleeve,
    rotatingSleeveBody,
    sleeveCrossbar,
    sleeveIndex,
    spindle,
    spindleIndex,
    thrustCollar,
    topHead,
    topHeadCrossbar,
    topHeadHub,
    valveFrameBottom,
    valveFrameLeft,
    valveFrameRight,
    valveFrameTop,
    valveGate,
    valveGateIndex,
    valvePort,
    valveRod,
    verticalBearing,
    yokeForkA,
    yokeForkB,
    yokeHandle,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.equilibriumAtSpreadAngle = equilibriumAtSpreadAngle;
  root.userData.geometry = {
    ballMass,
    ballIndexRadialOffset,
    ballRadius,
    baseY,
    drivenGearConstructionAxis: drivenGearConstructionAxis.clone(),
    drivenGearOuterDistance,
    drivenGearPhase,
    drivenGearPitchConeAngle,
    drivenGearPitchRadius,
    drivenGearTeeth,
    elbowArmLength,
    equilibriumIterations,
    frameZ,
    fullTurn,
    gearApex: gearApex.clone(),
    gearContactPoint: gearContactPoint.clone(),
    governorAxis: governorAxis.clone(),
    gravityAcceleration,
    inputGearAxis: inputGearAxis.clone(),
    inputGearOuterDistance,
    inputGearPhase,
    inputGearPitchConeAngle,
    inputGearPitchRadius,
    inputGearTeeth,
    lowerLinkLength,
    maximumSpreadAngle,
    maximumSpindleAngularSpeed,
    meanSpindleAngularSpeed,
    minimumSpreadAngle,
    minimumSpindleAngularSpeed,
    outputGuideX,
    outputGuideBottomY,
    outputGuideSupportHeight,
    outputLeverDrop,
    sleeveMaximumY,
    sleeveMinimumY,
    sleevePinRadius,
    sleeveStroke,
    sourceBallLeft: sourceBallLeft.clone(),
    sourceHighBallLeft: sourceHighBallLeft.clone(),
    sourceHighBallRight: sourceHighBallRight.clone(),
    sourceDrivenGearCenter: sourceDrivenGearCenter.clone(),
    sourceElbowLeft: sourceElbowLeft.clone(),
    sourceImageHeight,
    sourceImageWidth,
    sourceInputGearCenter: sourceInputGearCenter.clone(),
    sourceRasterBallLeft: sourceRasterBallLeft.clone(),
    sourceRasterBallRadius,
    sourceRasterBallRight: sourceRasterBallRight.clone(),
    sourceRasterDrivenGearCenter: sourceRasterDrivenGearCenter.clone(),
    sourceRasterElbowLeft: sourceRasterElbowLeft.clone(),
    sourceRasterElbowRight: sourceRasterElbowRight.clone(),
    sourceRasterInputGearCenter: sourceRasterInputGearCenter.clone(),
    sourceRasterInputGearRadius,
    sourceRasterHighBallLeft: sourceRasterHighBallLeft.clone(),
    sourceRasterHighBallRight: sourceRasterHighBallRight.clone(),
    sourceRasterOutputLeverY,
    sourceRasterSleeveLeft: sourceRasterSleeveLeft.clone(),
    sourceRasterSleeveRight: sourceRasterSleeveRight.clone(),
    sourceRasterSpindleAxisX,
    sourceRasterTopPivotLeft: sourceRasterTopPivotLeft.clone(),
    sourceRasterTopPivotRight: sourceRasterTopPivotRight.clone(),
    sourceRasterValveCenter: sourceRasterValveCenter.clone(),
    sourceSleeveLeft: sourceSleeveLeft.clone(),
    sourceTopPivotLeft: sourceTopPivotLeft.clone(),
    sourceTopPivotY,
    sourceUnitsPerPixel,
    sourceValveCenter: sourceValveCenter.clone(),
    speedCycleAngularFrequency,
    speedCyclePeriod,
    spindleAngularSpeedRange,
    spindleBottomY,
    spindleTopY,
    toothHeight,
    topPivotRadius,
    topPivotY,
    upperArmLength,
    valveGateHeight,
    valveGateLowY,
    valvePlaneZ,
    valvePortBottomY,
    valvePortCenterY,
    valvePortHeight,
  };
  root.userData.spreadAngleAtSpindleSpeed = spreadAngleAtSpindleSpeed;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;

  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  for (const object of [
    cameraEnvelope,
    inputGear.userData.faceIndex,
    drivenGear.userData.faceIndex,
    spindleIndex,
    sleeveIndex,
    valveGateIndex,
    ...inputGear.userData.toothMeshes.filter(({ userData }) => (
      userData.index === inputGear.userData.indexToothIndex
    )),
    ...drivenGear.userData.toothMeshes.filter(({ userData }) => (
      userData.index === drivenGear.userData.indexToothIndex
    )),
    ...ballAssemblies.map(({ ballIndex }) => ballIndex),
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.traverse((object) => {
    if (!object.userData.cameraFitGuide) return;
    object.castShadow = false;
    object.receiveShadow = false;
  });
  root.userData.fidelity = 'authored';
  return {
    cameraDirection: new THREE.Vector3(7.6, 5.2, 12.8),
    root,
    update,
  };
}

function crossedArmDirectValveRodGovernorMotion() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Brown's front elevation is the only pose supplied for Movement 170. The
  // dimensions below are measured from the 525 px public-domain plate. Each
  // ball arm passes straight through the central spindle pivot and continues
  // on the opposite side to an upper wrist. Two finite links join those
  // wrists to one axial valve-rod joint; there is deliberately no sleeve on
  // the spindle, which is the defining difference from Movement 161.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterSpindleAxisX = 264;
  const sourceRasterCrossPivot = new THREE.Vector2(264, 160);
  const sourceRasterValveRodJoint = new THREE.Vector2(264, 64);
  const sourceRasterLeftBallUpperWrist = new THREE.Vector2(295, 108);
  const sourceRasterRightBallUpperWrist = new THREE.Vector2(233, 108);
  const sourceRasterLeftBall = new THREE.Vector2(176, 319);
  const sourceRasterRightBall = new THREE.Vector2(355, 319);
  const sourceRasterBallRadius = 40;
  const sourceRasterSpreadArcLeft = new THREE.Vector2(181, 236);
  const sourceRasterSpreadArcMiddle = new THREE.Vector2(264, 281);
  const sourceRasterSpreadArcRight = new THREE.Vector2(347, 235);
  const sourceRasterGearApex = new THREE.Vector2(264, 456);
  const sourceRasterInputShaftEnd = new THREE.Vector2(95, 456);
  const sourceUnitsPerPixel = 0.017;
  const crossPivotY = 1.35;
  const sourcePointFromRaster = (point) => new THREE.Vector2(
    (point.x - sourceRasterSpindleAxisX) * sourceUnitsPerPixel,
    crossPivotY
      + (sourceRasterCrossPivot.y - point.y) * sourceUnitsPerPixel,
  );
  const sourceCrossPivot = sourcePointFromRaster(sourceRasterCrossPivot);
  const sourceValveRodJoint = sourcePointFromRaster(
    sourceRasterValveRodJoint,
  );
  const sourceLeftBallUpperWrist = sourcePointFromRaster(
    sourceRasterLeftBallUpperWrist,
  );
  const sourceRightBallUpperWrist = sourcePointFromRaster(
    sourceRasterRightBallUpperWrist,
  );
  const sourceLeftBall = sourcePointFromRaster(sourceRasterLeftBall);
  const sourceRightBall = sourcePointFromRaster(sourceRasterRightBall);
  const sourceGearApex = sourcePointFromRaster(sourceRasterGearApex);
  const sourceInputShaftEnd = sourcePointFromRaster(
    sourceRasterInputShaftEnd,
  );

  // The engraving is not perfectly symmetric (the two ball centers differ by
  // three pixels), so the kinematic centerline uses the mean of each mirrored
  // measurement. This leaves both rendered ball centers within 1.5 px of the
  // plate while providing an exact diametric three-dimensional mechanism.
  const sourceBallOrbitRadius = (
    sourceRasterSpindleAxisX - sourceRasterLeftBall.x
      + sourceRasterRightBall.x - sourceRasterSpindleAxisX
  ) * sourceUnitsPerPixel / 2;
  const sourceBallDrop = (
    sourceRasterLeftBall.y - sourceRasterCrossPivot.y
  ) * sourceUnitsPerPixel;
  const ballArmLength = Math.hypot(sourceBallOrbitRadius, sourceBallDrop);
  const sourceSpreadAngle = Math.atan2(
    sourceBallOrbitRadius,
    sourceBallDrop,
  );
  const sourceUpperWristRadius = (
    sourceRasterLeftBallUpperWrist.x - sourceRasterSpindleAxisX
      + sourceRasterSpindleAxisX - sourceRasterRightBallUpperWrist.x
  ) * sourceUnitsPerPixel / 2;
  const sourceUpperWristRise = (
    sourceRasterCrossPivot.y - sourceRasterLeftBallUpperWrist.y
  ) * sourceUnitsPerPixel;
  const upperArmExtensionLength = Math.hypot(
    sourceUpperWristRadius,
    sourceUpperWristRise,
  );
  const sourceClosedUpperWristRadius = upperArmExtensionLength
    * Math.sin(sourceSpreadAngle);
  const sourceClosedUpperWristY = crossPivotY
    + upperArmExtensionLength * Math.cos(sourceSpreadAngle);
  const shortLinkLength = Math.hypot(
    sourceClosedUpperWristRadius,
    sourceValveRodJoint.y - sourceClosedUpperWristY,
  );
  const sourceMeasuredShortLinkLength = sourceLeftBallUpperWrist.distanceTo(
    sourceValveRodJoint,
  );
  const completeCrossedArmLength = ballArmLength
    + upperArmExtensionLength;
  const ballRadius = sourceRasterBallRadius * sourceUnitsPerPixel;
  const armLayerOffset = 0.105;
  const ballIndexRadialOffset = ballRadius * 0.91;

  const minimumSpreadAngle = sourceSpreadAngle;
  const maximumSpreadAngle = 0.72;
  const gravityAcceleration = 9.81;
  const ballMass = 1;
  const equilibriumAtSpreadAngle = (spreadAngle) => {
    const sine = Math.sin(spreadAngle);
    const cosine = Math.cos(spreadAngle);
    const ballOrbitRadius = ballArmLength * sine;
    const ballCenterY = crossPivotY - ballArmLength * cosine;
    const upperWristRadius = upperArmExtensionLength * sine;
    const upperWristY = crossPivotY
      + upperArmExtensionLength * cosine;
    const shortLinkRise = Math.sqrt(
      shortLinkLength ** 2 - upperWristRadius ** 2,
    );
    const valveRodJointY = upperWristY + shortLinkRise;
    const spindleAngularSpeed = Math.sqrt(
      gravityAcceleration / (ballArmLength * cosine),
    );
    return {
      ballCenterY,
      ballOrbitRadius,
      shortLinkRise,
      spindleAngularSpeed,
      spreadAngle,
      upperWristRadius,
      upperWristY,
      valveRodJointY,
    };
  };
  const minimumEquilibrium = equilibriumAtSpreadAngle(minimumSpreadAngle);
  const maximumEquilibrium = equilibriumAtSpreadAngle(maximumSpreadAngle);
  const minimumSpindleAngularSpeed =
    minimumEquilibrium.spindleAngularSpeed;
  const maximumSpindleAngularSpeed =
    maximumEquilibrium.spindleAngularSpeed;
  const spindleAngularSpeedRange = maximumSpindleAngularSpeed
    - minimumSpindleAngularSpeed;
  const meanSpindleAngularSpeed = (
    minimumSpindleAngularSpeed + maximumSpindleAngularSpeed
  ) / 2;
  const valveRodJointMaximumY = minimumEquilibrium.valveRodJointY;
  const valveRodJointMinimumY = maximumEquilibrium.valveRodJointY;
  const valveRodStroke = valveRodJointMaximumY - valveRodJointMinimumY;
  const speedCyclePeriod = 8;
  const speedCycleAngularFrequency = fullTurn / speedCyclePeriod;
  const spreadAngleAtSpindleSpeed = (spindleAngularSpeed) => {
    const cosine = gravityAcceleration / (
      ballArmLength * spindleAngularSpeed ** 2
    );
    if (cosine <= 0 || cosine > 1) {
      throw new RangeError(
        'Movement 170 lost its positive conical-pendulum branch.',
      );
    }
    return Math.acos(cosine);
  };

  // The two equal 45-degree pitch cones share this apex and contact point.
  // The horizontal engine shaft extends to the left exactly as in the plate;
  // equal tooth counts make its angular speed the negative of the spindle's.
  const gearApex = new THREE.Vector3(0, sourceGearApex.y, 0);
  const inputGearAxis = X_AXIS.clone().negate();
  const governorAxis = Y_AXIS.clone();
  const drivenGearConstructionAxis = governorAxis.clone();
  const inputGearTeeth = 20;
  const drivenGearTeeth = 20;
  const gearOuterDistance = 0.58;
  const gearPitchRadius = gearOuterDistance;
  const gearPitchConeAngle = Math.PI / 4;
  const toothHeight = 0.105;
  const gearContactPoint = gearApex.clone()
    .addScaledVector(inputGearAxis, gearOuterDistance)
    .addScaledVector(drivenGearConstructionAxis, gearOuterDistance);
  const gearContactOffset = gearContactPoint.clone().sub(gearApex);
  const inputGear = makePitchBevelGear({
    axis: inputGearAxis,
    color: PALETTE.driver,
    indexToothIndex: 0,
    innerDistance: gearOuterDistance * 0.34,
    outerDistance: gearOuterDistance,
    pitchConeAngle: gearPitchConeAngle,
    teeth: inputGearTeeth,
    toothHeight,
  });
  inputGear.position.copy(gearApex);
  inputGear.userData.role = 'engine-input-equal-miter-bevel-gear';
  const inputGearRotor = inputGear.userData.rotor;
  const inputShaftReach = Math.abs(
    sourceInputShaftEnd.x - sourceGearApex.x,
  );
  const inputShaft = cylinderAlongZ(
    0.105,
    inputShaftReach + 0.42,
    matte(PALETTE.ink, { metalness: 0.28, roughness: 0.44 }),
    38,
  );
  inputShaft.position.z = (inputShaftReach + 0.12) / 2;
  inputShaft.userData.axis = inputGearAxis.clone();
  inputShaft.userData.role = 'left-extending-horizontal-engine-input-shaft';
  const inputShaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.25, 0.055),
    matte(PALETTE.white, { roughness: 0.43 }),
  );
  inputShaftIndex.position.set(0.145, 0, inputShaftReach * 0.72);
  inputShaftIndex.userData.role = 'white-input-shaft-spin-index';
  inputGearRotor.add(inputShaft, inputShaftIndex);

  const drivenGear = makePitchBevelGear({
    axis: drivenGearConstructionAxis,
    color: PALETTE.driven,
    indexToothIndex: 0,
    innerDistance: gearOuterDistance * 0.34,
    outerDistance: gearOuterDistance,
    pitchConeAngle: gearPitchConeAngle,
    teeth: drivenGearTeeth,
    toothHeight,
  });
  drivenGear.position.copy(gearApex);
  drivenGear.userData.role = 'vertical-spindle-equal-miter-bevel-gear';
  const drivenGearRotor = drivenGear.userData.rotor;
  const localContactAngle = (gear, point) => {
    const localPoint = point.clone().sub(gear.position).applyQuaternion(
      gear.quaternion.clone().invert(),
    );
    return Math.atan2(localPoint.y, localPoint.x);
  };
  const inputGearPhase = localContactAngle(inputGear, gearContactPoint);
  const drivenGearPhase = localContactAngle(drivenGear, gearContactPoint)
    - Math.PI / drivenGearTeeth;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.61,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.61,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.16,
    roughness: 0.55,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.46,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.69,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const spindleBottomY = gearApex.y - 0.82;
  const spindleTopY = crossPivotY + 0.25;
  const governorRotor = new THREE.Group();
  governorRotor.userData.axis = governorAxis.clone();
  governorRotor.userData.role =
    'bevel-driven-spindle-crossed-arms-balls-short-links-and-collar';
  const spindle = cylinderAlongY(
    0.095,
    spindleTopY - spindleBottomY,
    darkMaterial,
    38,
  );
  spindle.position.y = (spindleTopY + spindleBottomY) / 2;
  spindle.userData.role = 'continuous-vertical-governor-spindle';
  const spindleIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.42, 0.10),
    indexMaterial,
  );
  spindleIndex.position.set(0.135, -1.75, 0);
  spindleIndex.userData.role = 'white-index-on-rotating-spindle';

  const crossPivotHub = cylinderAlongY(0.255, 0.34, drivenMaterial, 40);
  crossPivotHub.position.y = crossPivotY;
  crossPivotHub.userData.role = 'spindle-fixed-central-cross-pivot-hub';
  const crossPivotPin = cylinderAlongZ(0.14, 0.60, darkMaterial, 32);
  crossPivotPin.position.y = crossPivotY;
  crossPivotPin.userData.role = 'single-pin-through-both-crossed-ball-arms';

  // This bowed piece is centered on the arm pivot and carries the engraved
  // graduation marks. It is a source-visible angle reference behind the
  // pendulum arms, not a sleeve, link, or closure constraint.
  const sourceSpreadArcMiddle = sourcePointFromRaster(
    sourceRasterSpreadArcMiddle,
  );
  const sourceSpreadArcLeft = sourcePointFromRaster(
    sourceRasterSpreadArcLeft,
  );
  const sourceSpreadArcRight = sourcePointFromRaster(
    sourceRasterSpreadArcRight,
  );
  const spreadArcRadius = crossPivotY - sourceSpreadArcMiddle.y;
  const spreadArcHalfAngle = (
    Math.atan2(
      Math.abs(sourceSpreadArcLeft.x),
      crossPivotY - sourceSpreadArcLeft.y,
    )
      + Math.atan2(
        Math.abs(sourceSpreadArcRight.x),
        crossPivotY - sourceSpreadArcRight.y,
      )
  ) / 2;
  const spreadArcZ = -0.27;
  const spreadArcPoints = Array.from({ length: 49 }, (_, index) => {
    const angle = -spreadArcHalfAngle
      + 2 * spreadArcHalfAngle * index / 48;
    return new THREE.Vector3(
      spreadArcRadius * Math.sin(angle),
      crossPivotY - spreadArcRadius * Math.cos(angle),
      spreadArcZ,
    );
  });
  const spreadArcCurve = new THREE.CatmullRomCurve3(
    spreadArcPoints,
    false,
    'centripetal',
  );
  const spreadArc = new THREE.Mesh(
    new THREE.TubeGeometry(spreadArcCurve, 96, 0.085, 10, false),
    accentMaterial,
  );
  spreadArc.userData.kinematicConstraint = false;
  spreadArc.userData.role =
    'source-visible-graduated-spread-angle-bow-reference';
  const spreadArcEndCaps = [spreadArcPoints[0], spreadArcPoints.at(-1)].map(
    (point, index) => {
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.115, 22, 14),
        accentMaterial,
      );
      cap.position.copy(point);
      cap.userData.role = `spread-angle-bow-end-cap-${index + 1}`;
      return cap;
    },
  );
  const spreadArcTicks = [-0.16, -0.08, 0, 0.08, 0.16].map(
    (angle, index) => {
      const inner = new THREE.Vector3(
        (spreadArcRadius - 0.10) * Math.sin(angle),
        crossPivotY - (spreadArcRadius - 0.10) * Math.cos(angle),
        spreadArcZ + 0.075,
      );
      const outer = new THREE.Vector3(
        (spreadArcRadius + 0.10) * Math.sin(angle),
        crossPivotY - (spreadArcRadius + 0.10) * Math.cos(angle),
        spreadArcZ + 0.075,
      );
      const tick = makeBeam(inner, outer, {
        color: PALETTE.white,
        depth: 0.035,
        thickness: 0.025,
      });
      tick.userData.role = `engraved-spread-angle-tick-${index + 1}`;
      return tick;
    },
  );

  const sourceState = minimumEquilibrium;
  const armAssemblies = [-1, 1].map((sign, index) => {
    const layer = sign * armLayerOffset;
    const localBall = new THREE.Vector3(
      sign * sourceState.ballOrbitRadius,
      sourceState.ballCenterY,
      layer,
    );
    const localCrossPivot = new THREE.Vector3(0, crossPivotY, layer);
    const localUpperWrist = new THREE.Vector3(
      -sign * sourceState.upperWristRadius,
      sourceState.upperWristY,
      layer,
    );
    const localOutputPin = new THREE.Vector3(
      0,
      sourceState.valveRodJointY,
      layer,
    );
    const longArm = makeBeam(localBall, localUpperWrist, {
      color: PALETTE.driven,
      depth: 0.12,
      thickness: 0.13,
    });
    longArm.userData.role = `one-piece-crossed-ball-arm-${index + 1}`;
    const shortLink = makeBeam(localUpperWrist, localOutputPin, {
      color: PALETTE.accent,
      depth: 0.115,
      thickness: 0.115,
    });
    shortLink.userData.role = `finite-upper-valve-rod-link-${index + 1}`;
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(ballRadius, 42, 28),
      driverMaterial,
    );
    ball.position.copy(localBall);
    ball.userData.role = `centrifugal-governor-ball-${index + 1}`;
    const ballIndex = new THREE.Mesh(
      new THREE.SphereGeometry(0.115, 16, 11),
      indexMaterial,
    );
    ballIndex.position.set(
      sign * (sourceState.ballOrbitRadius + ballIndexRadialOffset),
      sourceState.ballCenterY,
      layer,
    );
    ballIndex.userData.role = `white-orbit-index-on-ball-${index + 1}`;
    const upperWristPin = cylinderAlongZ(0.13, 0.34, darkMaterial, 30);
    upperWristPin.position.copy(localUpperWrist);
    upperWristPin.userData.role = `upper-wrist-revolute-pin-${index + 1}`;
    governorRotor.add(
      longArm,
      shortLink,
      ball,
      ballIndex,
      upperWristPin,
    );
    return {
      ball,
      ballIndex,
      layer,
      longArm,
      shortLink,
      sign,
      upperWristPin,
    };
  });

  const rotatingOutputCollar = new THREE.Group();
  rotatingOutputCollar.position.y = sourceState.valveRodJointY;
  rotatingOutputCollar.userData.role =
    'rotating-axially-moving-common-upper-link-collar';
  const rotatingOutputCollarBody = cylinderAlongY(
    0.25,
    0.34,
    accentMaterial,
    40,
  );
  rotatingOutputCollarBody.userData.role =
    'rotating-common-upper-link-collar-body';
  const outputCrossPin = cylinderAlongZ(0.13, 0.60, darkMaterial, 32);
  outputCrossPin.userData.role = 'common-crosspin-for-the-two-short-links';
  const outputCollarIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.16, 0.08),
    indexMaterial,
  );
  outputCollarIndex.position.x = 0.255;
  outputCollarIndex.userData.role = 'white-index-on-rotating-output-collar';
  rotatingOutputCollar.add(
    rotatingOutputCollarBody,
    outputCrossPin,
    outputCollarIndex,
  );
  governorRotor.add(
    spindle,
    spindleIndex,
    crossPivotHub,
    crossPivotPin,
    spreadArc,
    ...spreadArcEndCaps,
    ...spreadArcTicks,
    rotatingOutputCollar,
  );

  // A thrust race lets the link collar rotate with the governor while the
  // valve rod translates without rotating. This is an axial output bearing,
  // never the prohibited slide-on-spindle topology of Movement 161.
  const outputValveAssembly = new THREE.Group();
  outputValveAssembly.position.y = sourceState.valveRodJointY;
  outputValveAssembly.userData.role =
    'nonrotating-axially-guided-valve-rod-and-thrust-race';
  const thrustRace = new THREE.Mesh(
    new THREE.TorusGeometry(0.31, 0.058, 10, 48),
    drivenMaterial,
  );
  thrustRace.rotation.x = Math.PI / 2;
  thrustRace.userData.role =
    'nonrotating-thrust-race-around-rotating-link-collar';
  const valveRodLength = 1.62;
  const valveRod = cylinderAlongY(0.075, valveRodLength, darkMaterial, 30);
  valveRod.position.y = valveRodLength / 2;
  valveRod.userData.feedbackDirection = 'down-closes-throttle';
  valveRod.userData.role = 'vertical-nonrotating-throttle-valve-rod';
  const valveRodIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.075, 0.10),
    indexMaterial,
  );
  valveRodIndex.position.set(0.11, valveRodLength * 0.58, 0);
  valveRodIndex.userData.role = 'white-stroke-index-on-valve-rod';
  const valveRodClevis = cylinderAlongZ(0.14, 0.46, darkMaterial, 30);
  valveRodClevis.userData.role = 'nonrotating-valve-rod-bottom-clevis';
  outputValveAssembly.add(
    thrustRace,
    valveRod,
    valveRodIndex,
    valveRodClevis,
  );

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-base-shaft-bearings-spindle-bearings-and-valve-rod-guide';
  const frameZ = -3.18;
  const baseY = -4.64;
  const baseRail = makeBeam(
    new THREE.Vector3(-3.45, baseY, frameZ),
    new THREE.Vector3(3.45, baseY, frameZ),
    { color: PALETTE.frame, depth: 0.30, thickness: 0.22 },
  );
  baseRail.userData.role = 'fixed-transverse-governor-base-rail';
  const rearStandard = makeBeam(
    new THREE.Vector3(0, baseY, frameZ),
    new THREE.Vector3(0, 4.18, frameZ),
    { color: PALETTE.frame, depth: 0.26, thickness: 0.18 },
  );
  rearStandard.userData.role = 'rear-standard-clear-of-both-ball-orbits';
  const baseFeet = [-2.95, 2.95].map((x, index) => {
    const foot = makeBeam(
      new THREE.Vector3(x, baseY, frameZ),
      new THREE.Vector3(x, baseY, 1.30),
      { color: PALETTE.frame, depth: 0.28, thickness: 0.20 },
    );
    foot.userData.role = `front-to-rear-base-foot-${index + 1}`;
    return foot;
  });
  const inputBearingX = -2.18;
  const inputBearingSupport = makeBeam(
    new THREE.Vector3(0, gearApex.y, frameZ),
    new THREE.Vector3(inputBearingX, gearApex.y, 0),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.15 },
  );
  inputBearingSupport.userData.role = 'rear-arm-to-input-shaft-bearing';
  const inputBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.21, 0.065, 10, 42),
    frameMaterial,
  );
  inputBearing.rotation.y = Math.PI / 2;
  inputBearing.position.set(inputBearingX, gearApex.y, 0);
  inputBearing.userData.axis = inputGearAxis.clone();
  inputBearing.userData.role = 'fixed-horizontal-input-shaft-bearing';
  const lowerSpindleBearingY = gearApex.y + 0.98;
  const lowerSpindleBearingSupport = makeBeam(
    new THREE.Vector3(0, lowerSpindleBearingY, frameZ),
    new THREE.Vector3(0, lowerSpindleBearingY, 0),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.15 },
  );
  lowerSpindleBearingSupport.userData.role =
    'rear-arm-to-lower-spindle-bearing';
  const lowerSpindleBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.065, 10, 42),
    frameMaterial,
  );
  lowerSpindleBearing.rotation.x = Math.PI / 2;
  lowerSpindleBearing.position.set(0, lowerSpindleBearingY, 0);
  lowerSpindleBearing.userData.role = 'fixed-lower-vertical-spindle-bearing';
  const upperSpindleBearingY = 0.45;
  const upperSpindleBearingSupport = makeBeam(
    new THREE.Vector3(0, upperSpindleBearingY, frameZ),
    new THREE.Vector3(0, upperSpindleBearingY, 0),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.15 },
  );
  upperSpindleBearingSupport.userData.role =
    'rear-arm-to-upper-spindle-bearing';
  const upperSpindleBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.065, 10, 42),
    frameMaterial,
  );
  upperSpindleBearing.rotation.x = Math.PI / 2;
  upperSpindleBearing.position.set(0, upperSpindleBearingY, 0);
  upperSpindleBearing.userData.role = 'fixed-upper-vertical-spindle-bearing';
  const valveRodGuideY = 3.72;
  const valveRodGuideSupport = makeBeam(
    new THREE.Vector3(0, valveRodGuideY, frameZ),
    new THREE.Vector3(0, valveRodGuideY, 0),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.15 },
  );
  valveRodGuideSupport.userData.role = 'rear-arm-to-valve-rod-guide';
  const valveRodGuide = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.065, 10, 42),
    frameMaterial,
  );
  valveRodGuide.rotation.x = Math.PI / 2;
  valveRodGuide.position.set(0, valveRodGuideY, 0);
  valveRodGuide.userData.role = 'fixed-guide-for-nonrotating-valve-rod';
  const valveStrokeScale = makeBeam(
    new THREE.Vector3(0.47, valveRodJointMinimumY, -0.10),
    new THREE.Vector3(0.47, valveRodJointMaximumY, -0.10),
    { color: PALETTE.frame, depth: 0.06, thickness: 0.055 },
  );
  valveStrokeScale.userData.role =
    'fixed-reference-scale-for-downward-valve-closing-stroke';
  fixedFrame.add(
    baseRail,
    rearStandard,
    ...baseFeet,
    inputBearingSupport,
    inputBearing,
    lowerSpindleBearingSupport,
    lowerSpindleBearing,
    upperSpindleBearingSupport,
    upperSpindleBearing,
    valveRodGuideSupport,
    valveRodGuide,
    valveStrokeScale,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(7.6, 10.0, 7.4),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.y = -0.05;
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role =
    'invisible-envelope-for-ball-sweep-gears-frame-and-valve-rod';

  root.add(
    cameraEnvelope,
    fixedFrame,
    inputGear,
    drivenGear,
    governorRotor,
    outputValveAssembly,
  );

  const rotatingPointKinematics = ({
    angle,
    angularAcceleration,
    angularSpeed,
    radius,
    radialAcceleration = 0,
    radialSpeed = 0,
    verticalAcceleration = 0,
    verticalSpeed = 0,
    y,
  }) => {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const centripetalRadial = radialAcceleration
      - radius * angularSpeed ** 2;
    const coriolisTangential = 2 * radialSpeed * angularSpeed
      + radius * angularAcceleration;
    return {
      acceleration: new THREE.Vector3(
        centripetalRadial * cosine - coriolisTangential * sine,
        verticalAcceleration,
        -centripetalRadial * sine - coriolisTangential * cosine,
      ),
      position: radialPoint(angle, radius, y),
      velocity: new THREE.Vector3(
        radialSpeed * cosine - radius * angularSpeed * sine,
        verticalSpeed,
        -radialSpeed * sine - radius * angularSpeed * cosine,
      ),
    };
  };
  const visualPointAtAngle = (point, angle) => point.clone().applyAxisAngle(
    governorAxis,
    angle,
  );

  const stateAtTime = (time) => {
    const speedCycleAngle = speedCycleAngularFrequency * time;
    const speedFraction = (1 - Math.cos(speedCycleAngle)) / 2;
    const speedFractionRate = speedCycleAngularFrequency
      * Math.sin(speedCycleAngle) / 2;
    const speedFractionAcceleration = speedCycleAngularFrequency ** 2
      * Math.cos(speedCycleAngle) / 2;
    const spindleAngularSpeed = minimumSpindleAngularSpeed
      + spindleAngularSpeedRange * speedFraction;
    const spindleAngularAcceleration = spindleAngularSpeedRange
      * speedFractionRate;
    const spindleAngularJerk = spindleAngularSpeedRange
      * speedFractionAcceleration;
    const governorAngle = meanSpindleAngularSpeed * time
      - spindleAngularSpeedRange
        * Math.sin(speedCycleAngle)
        / (2 * speedCycleAngularFrequency);
    const spreadAngle = spreadAngleAtSpindleSpeed(spindleAngularSpeed);
    const sine = Math.sin(spreadAngle);
    const cosine = Math.cos(spreadAngle);
    const secant = 1 / cosine;
    const tangent = Math.tan(spreadAngle);

    // F(theta, omega) = g sec(theta) - L omega^2 = 0. Differentiating
    // that closure twice gives analytic angular velocity and acceleration,
    // avoiding finite-difference jitter at both ends of the speed cycle.
    const equilibriumAngleSlope = gravityAcceleration * secant * tangent;
    const equilibriumOmegaSlope = -2 * ballArmLength
      * spindleAngularSpeed;
    const spreadAngularSpeed = -equilibriumOmegaSlope
      * spindleAngularAcceleration / equilibriumAngleSlope;
    const equilibriumAngleCurvature = gravityAcceleration * secant
      * (tangent ** 2 + secant ** 2);
    const equilibriumOmegaCurvature = -2 * ballArmLength;
    const spreadAngularAcceleration = -(
      equilibriumAngleCurvature * spreadAngularSpeed ** 2
        + equilibriumOmegaCurvature * spindleAngularAcceleration ** 2
        + equilibriumOmegaSlope * spindleAngularJerk
    ) / equilibriumAngleSlope;

    const ballOrbitRadius = ballArmLength * sine;
    const ballCenterY = crossPivotY - ballArmLength * cosine;
    const ballRadialSpeed = ballArmLength * cosine * spreadAngularSpeed;
    const ballVerticalSpeed = ballArmLength * sine * spreadAngularSpeed;
    const ballRadialAcceleration = ballArmLength * (
      -sine * spreadAngularSpeed ** 2
        + cosine * spreadAngularAcceleration
    );
    const ballVerticalAcceleration = ballArmLength * (
      cosine * spreadAngularSpeed ** 2
        + sine * spreadAngularAcceleration
    );
    const upperWristRadius = upperArmExtensionLength * sine;
    const upperWristY = crossPivotY
      + upperArmExtensionLength * cosine;
    const upperWristRadialSpeed = upperArmExtensionLength * cosine
      * spreadAngularSpeed;
    const upperWristVerticalSpeed = -upperArmExtensionLength * sine
      * spreadAngularSpeed;
    const upperWristRadialAcceleration = upperArmExtensionLength * (
      -sine * spreadAngularSpeed ** 2
        + cosine * spreadAngularAcceleration
    );
    const upperWristVerticalAcceleration = -upperArmExtensionLength * (
      cosine * spreadAngularSpeed ** 2
        + sine * spreadAngularAcceleration
    );
    const upperWristRadiusSlope = upperArmExtensionLength * cosine;
    const upperWristRadiusCurvature = -upperArmExtensionLength * sine;
    const upperWristYSlope = -upperArmExtensionLength * sine;
    const upperWristYCurvature = -upperArmExtensionLength * cosine;
    const shortLinkRise = Math.sqrt(
      shortLinkLength ** 2 - upperWristRadius ** 2,
    );
    const shortLinkRiseSlope = -upperWristRadius
      * upperWristRadiusSlope / shortLinkRise;
    const shortLinkRiseCurvature = -(
      upperWristRadiusSlope ** 2
        + upperWristRadius * upperWristRadiusCurvature
    ) / shortLinkRise
      - upperWristRadius ** 2 * upperWristRadiusSlope ** 2
        / shortLinkRise ** 3;
    const valveRodJointSlope = upperWristYSlope + shortLinkRiseSlope;
    const valveRodJointCurvature = upperWristYCurvature
      + shortLinkRiseCurvature;
    const valveRodJointY = upperWristY + shortLinkRise;
    const valveRodJointVelocityY = valveRodJointSlope
      * spreadAngularSpeed;
    const valveRodJointAccelerationY = valveRodJointCurvature
      * spreadAngularSpeed ** 2
      + valveRodJointSlope * spreadAngularAcceleration;
    const valveClosureFraction = (
      valveRodJointMaximumY - valveRodJointY
    ) / valveRodStroke;
    const valveClosureFractionRate = -valveRodJointVelocityY
      / valveRodStroke;
    const valveClosureFractionAcceleration = -valveRodJointAccelerationY
      / valveRodStroke;

    const inputGearAngle = inputGearPhase - governorAngle;
    const inputGearAngularSpeed = -spindleAngularSpeed;
    const inputGearAngularAcceleration = -spindleAngularAcceleration;
    const drivenGearAngle = drivenGearPhase + governorAngle;
    const drivenGearAngularSpeed = spindleAngularSpeed;
    const drivenGearAngularAcceleration = spindleAngularAcceleration;
    const surfaceKinematics = (axis, angularSpeed, angularAcceleration) => {
      const tangentialVelocity = new THREE.Vector3()
        .crossVectors(axis, gearContactOffset)
        .multiplyScalar(angularSpeed);
      const tangentialAcceleration = new THREE.Vector3()
        .crossVectors(axis, gearContactOffset)
        .multiplyScalar(angularAcceleration);
      const radialOffset = gearContactOffset.clone().addScaledVector(
        axis,
        -gearContactOffset.dot(axis),
      );
      return {
        acceleration: tangentialAcceleration.clone().addScaledVector(
          radialOffset,
          -(angularSpeed ** 2),
        ),
        tangentialAcceleration,
        velocity: tangentialVelocity,
      };
    };
    const inputSurface = surfaceKinematics(
      inputGearAxis,
      inputGearAngularSpeed,
      inputGearAngularAcceleration,
    );
    const drivenSurface = surfaceKinematics(
      governorAxis,
      drivenGearAngularSpeed,
      drivenGearAngularAcceleration,
    );
    const meshTangent = inputSurface.velocity.lengthSq() > 1e-18
      ? inputSurface.velocity.clone().normalize()
      : new THREE.Vector3()
        .crossVectors(inputGearAxis, gearContactOffset)
        .normalize();

    const ballStates = [-1, 1].map((sign, index) => {
      const layer = sign * armLayerOffset;
      const ballAngle = governorAngle + (sign < 0 ? Math.PI : 0);
      const upperWristAngle = ballAngle + Math.PI;
      const ballKinematics = rotatingPointKinematics({
        angle: ballAngle,
        angularAcceleration: spindleAngularAcceleration,
        angularSpeed: spindleAngularSpeed,
        radialAcceleration: ballRadialAcceleration,
        radialSpeed: ballRadialSpeed,
        radius: ballOrbitRadius,
        verticalAcceleration: ballVerticalAcceleration,
        verticalSpeed: ballVerticalSpeed,
        y: ballCenterY,
      });
      const upperWristKinematics = rotatingPointKinematics({
        angle: upperWristAngle,
        angularAcceleration: spindleAngularAcceleration,
        angularSpeed: spindleAngularSpeed,
        radialAcceleration: upperWristRadialAcceleration,
        radialSpeed: upperWristRadialSpeed,
        radius: upperWristRadius,
        verticalAcceleration: upperWristVerticalAcceleration,
        verticalSpeed: upperWristVerticalSpeed,
        y: upperWristY,
      });
      const localBall = new THREE.Vector3(
        sign * ballOrbitRadius,
        ballCenterY,
        layer,
      );
      const localCrossPivot = new THREE.Vector3(0, crossPivotY, layer);
      const localUpperWrist = new THREE.Vector3(
        -sign * upperWristRadius,
        upperWristY,
        layer,
      );
      const localOutputPin = new THREE.Vector3(
        0,
        valveRodJointY,
        layer,
      );
      const visualBallPosition = visualPointAtAngle(
        localBall,
        governorAngle,
      );
      const visualCrossPivotPosition = visualPointAtAngle(
        localCrossPivot,
        governorAngle,
      );
      const visualUpperWristPosition = visualPointAtAngle(
        localUpperWrist,
        governorAngle,
      );
      const visualOutputPinPosition = visualPointAtAngle(
        localOutputPin,
        governorAngle,
      );
      const outputJointPosition = new THREE.Vector3(
        0,
        valveRodJointY,
        0,
      );
      const outputJointVelocity = new THREE.Vector3(
        0,
        valveRodJointVelocityY,
        0,
      );
      const outputJointAcceleration = new THREE.Vector3(
        0,
        valveRodJointAccelerationY,
        0,
      );
      return {
        ballAcceleration: ballKinematics.acceleration,
        ballAngle,
        ballPosition: ballKinematics.position,
        ballVelocity: ballKinematics.velocity,
        ballToPivotLengthError: ballKinematics.position.distanceTo(
          new THREE.Vector3(0, crossPivotY, 0),
        ) - ballArmLength,
        crossingCollinearityError: new THREE.Vector3().crossVectors(
          ballKinematics.position.clone().sub(
            new THREE.Vector3(0, crossPivotY, 0),
          ),
          upperWristKinematics.position.clone().sub(
            new THREE.Vector3(0, crossPivotY, 0),
          ),
        ).length(),
        index,
        layer,
        localBall,
        localCrossPivot,
        localOutputPin,
        localUpperWrist,
        longArmLengthError: visualBallPosition.distanceTo(
          visualUpperWristPosition,
        ) - completeCrossedArmLength,
        outputJointAcceleration,
        outputJointPosition,
        outputJointVelocity,
        pivotToUpperWristLengthError: upperWristKinematics.position.distanceTo(
          new THREE.Vector3(0, crossPivotY, 0),
        ) - upperArmExtensionLength,
        shortLinkLengthError: visualUpperWristPosition.distanceTo(
          visualOutputPinPosition,
        ) - shortLinkLength,
        sign,
        upperWristAcceleration: upperWristKinematics.acceleration,
        upperWristAngle,
        upperWristPosition: upperWristKinematics.position,
        upperWristVelocity: upperWristKinematics.velocity,
        visualBallPosition,
        visualCrossPivotPosition,
        visualOutputPinPosition,
        visualUpperWristPosition,
      };
    });
    const stage = Math.abs(spindleAngularAcceleration) < 1e-10
      ? Math.cos(speedCycleAngle) >= 0
        ? 'minimum-speed-source-pose-valve-open'
        : 'maximum-speed-balls-out-valve-closed'
      : spindleAngularAcceleration > 0
        ? 'engine-speed-rises-balls-pull-valve-rod-down'
        : 'engine-speed-falls-balls-release-valve-rod-up';
    return {
      assemblyBranchMargin: shortLinkLength - upperWristRadius,
      ballCenterY,
      ballCentrifugalForce: ballMass * spindleAngularSpeed ** 2
        * ballOrbitRadius,
      ballGravityForce: ballMass * gravityAcceleration,
      ballOrbitRadius,
      ballRadialAcceleration,
      ballRadialSpeed,
      ballStates,
      ballVerticalAcceleration,
      ballVerticalSpeed,
      drivenGearAngle,
      drivenGearAngularAcceleration,
      drivenGearAngularSpeed,
      drivenSurfaceAcceleration: drivenSurface.acceleration,
      drivenSurfaceVelocity: drivenSurface.velocity,
      equilibriumAngleSlope,
      equilibriumResidual: gravityAcceleration / cosine
        - ballArmLength * spindleAngularSpeed ** 2,
      gearMeshInvariant: (inputGearAngle - inputGearPhase)
        + (drivenGearAngle - drivenGearPhase),
      gearSurfaceVelocityError: inputSurface.velocity.distanceTo(
        drivenSurface.velocity,
      ),
      gearTangentialAccelerationError: Math.abs(
        inputSurface.tangentialAcceleration.dot(meshTangent)
          - drivenSurface.tangentialAcceleration.dot(meshTangent)
      ),
      governorAngle,
      inputGearAngle,
      inputGearAngularAcceleration,
      inputGearAngularSpeed,
      inputSurfaceAcceleration: inputSurface.acceleration,
      inputSurfaceVelocity: inputSurface.velocity,
      shortLinkRise,
      shortLinkRiseCurvature,
      shortLinkRiseSlope,
      speedCycleAngle,
      speedFraction,
      speedFractionAcceleration,
      speedFractionRate,
      spindleAngularAcceleration,
      spindleAngularJerk,
      spindleAngularSpeed,
      spreadAngle,
      spreadAngularAcceleration,
      spreadAngularSpeed,
      stage,
      upperWristRadialAcceleration,
      upperWristRadialSpeed,
      upperWristRadius,
      upperWristVerticalAcceleration,
      upperWristVerticalSpeed,
      upperWristY,
      valveClosureFraction,
      valveClosureFractionAcceleration,
      valveClosureFractionRate,
      valveRodJointAccelerationY,
      valveRodJointCurvature,
      valveRodJointSlope,
      valveRodJointVelocityY,
      valveRodJointY,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(
    phase * speedCyclePeriod,
  );
  const canonicalTimes = {
    accelerating: speedCyclePeriod / 4,
    decelerating: speedCyclePeriod * 3 / 4,
    highSpeed: speedCyclePeriod / 2,
    lowSpeedSourcePose: 0,
    nextLowSpeedSourcePose: speedCyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const update = (time) => {
    const state = stateAtTime(time);
    inputGearRotor.rotation.z = state.inputGearAngle;
    drivenGearRotor.rotation.z = state.drivenGearAngle;
    inputGear.userData.angularAcceleration =
      state.inputGearAngularAcceleration;
    inputGear.userData.angularSpeed = state.inputGearAngularSpeed;
    drivenGear.userData.angularAcceleration =
      state.drivenGearAngularAcceleration;
    drivenGear.userData.angularSpeed = state.drivenGearAngularSpeed;
    governorRotor.rotation.y = state.governorAngle;
    governorRotor.userData.angularAcceleration =
      state.spindleAngularAcceleration;
    governorRotor.userData.angularSpeed = state.spindleAngularSpeed;
    state.ballStates.forEach((ballState, index) => {
      const assembly = armAssemblies[index];
      assembly.longArm.userData.setEndpoints(
        ballState.localBall,
        ballState.localUpperWrist,
      );
      assembly.shortLink.userData.setEndpoints(
        ballState.localUpperWrist,
        ballState.localOutputPin,
      );
      assembly.ball.position.copy(ballState.localBall);
      assembly.ballIndex.position.set(
        ballState.sign * (
          state.ballOrbitRadius + ballIndexRadialOffset
        ),
        state.ballCenterY,
        ballState.layer,
      );
      assembly.upperWristPin.position.copy(ballState.localUpperWrist);
    });
    rotatingOutputCollar.position.y = state.valveRodJointY;
    rotatingOutputCollar.userData.axialAcceleration =
      state.valveRodJointAccelerationY;
    rotatingOutputCollar.userData.axialSpeed =
      state.valveRodJointVelocityY;
    outputValveAssembly.position.y = state.valveRodJointY;
    outputValveAssembly.userData.axialAcceleration =
      state.valveRodJointAccelerationY;
    outputValveAssembly.userData.axialSpeed =
      state.valveRodJointVelocityY;
    outputValveAssembly.userData.valveClosureFraction =
      state.valveClosureFraction;
    root.userData.contacts = {
      bevelMesh: {
        contactPoint: gearContactPoint.clone(),
        drivenAxis: governorAxis.clone(),
        drivenPitchRadius: gearPitchRadius,
        gearSurfaceVelocityError: state.gearSurfaceVelocityError,
        gearTangentialAccelerationError:
          state.gearTangentialAccelerationError,
        inputAxis: inputGearAxis.clone(),
        inputPitchRadius: gearPitchRadius,
        speedRatio: -1,
      },
      crossedArmLinkage: state.ballStates.map((ballState) => ({
        ballToPivotLengthError: ballState.ballToPivotLengthError,
        crossingCollinearityError: ballState.crossingCollinearityError,
        longArmLengthError: ballState.longArmLengthError,
        pivotToUpperWristLengthError:
          ballState.pivotToUpperWristLengthError,
        shortLinkLengthError: ballState.shortLinkLengthError,
      })),
      outputThrustConnection: {
        nonrotatingValveRod: true,
        rotatingLinkCollar: true,
        valveClosureFraction: state.valveClosureFraction,
        valveRodJointY: state.valveRodJointY,
      },
    };
    root.userData.kinematics = state;
  };

  root.userData.mechanism =
    'equal-miter-bevel-driven-crossed-arm-flyball-direct-valve-rod-governor';
  root.userData.cameraDistanceScale = 0.94;
  root.userData.blocks = {
    armAssemblies,
    baseFeet,
    baseRail,
    cameraEnvelope,
    crossPivotHub,
    crossPivotPin,
    drivenGear,
    drivenGearRotor,
    fixedFrame,
    governorRotor,
    inputBearing,
    inputBearingSupport,
    inputGear,
    inputGearRotor,
    inputShaft,
    inputShaftIndex,
    lowerSpindleBearing,
    lowerSpindleBearingSupport,
    outputCollarIndex,
    outputCrossPin,
    outputValveAssembly,
    rearStandard,
    rotatingOutputCollar,
    rotatingOutputCollarBody,
    spindle,
    spindleIndex,
    spreadArc,
    spreadArcEndCaps,
    spreadArcTicks,
    thrustRace,
    upperSpindleBearing,
    upperSpindleBearingSupport,
    valveRod,
    valveRodClevis,
    valveRodGuide,
    valveRodGuideSupport,
    valveRodIndex,
    valveStrokeScale,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.equilibriumAtSpreadAngle = equilibriumAtSpreadAngle;
  root.userData.geometry = {
    armLayerOffset,
    ballArmLength,
    ballIndexRadialOffset,
    ballMass,
    ballRadius,
    baseY,
    completeCrossedArmLength,
    crossPivotY,
    drivenGearConstructionAxis: drivenGearConstructionAxis.clone(),
    drivenGearPhase,
    drivenGearTeeth,
    frameZ,
    fullTurn,
    gearApex: gearApex.clone(),
    gearContactPoint: gearContactPoint.clone(),
    gearOuterDistance,
    gearPitchConeAngle,
    gearPitchRadius,
    governorAxis: governorAxis.clone(),
    gravityAcceleration,
    inputGearAxis: inputGearAxis.clone(),
    inputGearPhase,
    inputGearTeeth,
    inputShaftReach,
    maximumSpindleAngularSpeed,
    maximumSpreadAngle,
    meanSpindleAngularSpeed,
    minimumSpindleAngularSpeed,
    minimumSpreadAngle,
    shortLinkLength,
    sourceBallDrop,
    sourceBallOrbitRadius,
    sourceClosedUpperWristRadius,
    sourceClosedUpperWristY,
    sourceCrossPivot: sourceCrossPivot.clone(),
    sourceGearApex: sourceGearApex.clone(),
    sourceImageHeight,
    sourceImageWidth,
    sourceInputShaftEnd: sourceInputShaftEnd.clone(),
    sourceLeftBall: sourceLeftBall.clone(),
    sourceLeftBallUpperWrist: sourceLeftBallUpperWrist.clone(),
    sourceMeasuredShortLinkLength,
    sourceRasterBallRadius,
    sourceRasterCrossPivot: sourceRasterCrossPivot.clone(),
    sourceRasterGearApex: sourceRasterGearApex.clone(),
    sourceRasterInputShaftEnd: sourceRasterInputShaftEnd.clone(),
    sourceRasterLeftBall: sourceRasterLeftBall.clone(),
    sourceRasterLeftBallUpperWrist:
      sourceRasterLeftBallUpperWrist.clone(),
    sourceRasterRightBall: sourceRasterRightBall.clone(),
    sourceRasterRightBallUpperWrist:
      sourceRasterRightBallUpperWrist.clone(),
    sourceRasterSpindleAxisX,
    sourceRasterSpreadArcLeft: sourceRasterSpreadArcLeft.clone(),
    sourceRasterSpreadArcMiddle: sourceRasterSpreadArcMiddle.clone(),
    sourceRasterSpreadArcRight: sourceRasterSpreadArcRight.clone(),
    sourceRasterValveRodJoint: sourceRasterValveRodJoint.clone(),
    sourceRightBall: sourceRightBall.clone(),
    sourceRightBallUpperWrist: sourceRightBallUpperWrist.clone(),
    sourceSpreadAngle,
    sourceSpreadArcLeft: sourceSpreadArcLeft.clone(),
    sourceSpreadArcMiddle: sourceSpreadArcMiddle.clone(),
    sourceSpreadArcRight: sourceSpreadArcRight.clone(),
    sourceUnitsPerPixel,
    sourceUpperWristRadius,
    sourceUpperWristRise,
    sourceValveRodJoint: sourceValveRodJoint.clone(),
    speedCycleAngularFrequency,
    speedCyclePeriod,
    spindleAngularSpeedRange,
    spindleBottomY,
    spindleTopY,
    spreadArcHalfAngle,
    spreadArcRadius,
    toothHeight,
    upperArmExtensionLength,
    valveRodGuideY,
    valveRodJointMaximumY,
    valveRodJointMinimumY,
    valveRodLength,
    valveRodStroke,
  };
  root.userData.spreadAngleAtSpindleSpeed = spreadAngleAtSpindleSpeed;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;

  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  for (const object of [
    cameraEnvelope,
    drivenGear.userData.faceIndex,
    inputGear.userData.faceIndex,
    inputShaftIndex,
    outputCollarIndex,
    spindleIndex,
    valveRodIndex,
    ...spreadArcTicks,
    ...armAssemblies.map(({ ballIndex }) => ballIndex),
    ...inputGear.userData.toothMeshes.filter(({ userData }) => (
      userData.role === 'white-index-bevel-tooth'
    )),
    ...drivenGear.userData.toothMeshes.filter(({ userData }) => (
      userData.role === 'white-index-bevel-tooth'
    )),
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.traverse((object) => {
    if (!object.userData.cameraFitGuide) return;
    object.castShadow = false;
    object.receiveShadow = false;
  });
  root.userData.fidelity = 'authored';
  return {
    cameraDirection: new THREE.Vector3(8.2, 5.5, 13.6),
    root,
    update,
  };
}

export function createAuthoredGovernorMovement(movement) {
  switch (movement.id) {
    case 147: return dragFanInclinedPlaneGovernorMotion();
    case 161: return centrifugalBallSteamGovernorMotion();
    case 170: return crossedArmDirectValveRodGovernorMotion();
    default: return null;
  }
}
