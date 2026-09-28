import * as THREE from 'three';
import { correctPantographParts } from './pantograph-working-parts.js';
import {
  PALETTE,
  makeDynamicLink,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderAlongY(radius, length, material, segments = 32) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function ringAroundY(radius, tube, material, segments = 36) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 10, segments),
    material,
  );
  ring.rotation.x = Math.PI / 2;
  return ring;
}

class EllipseCurveXZ extends THREE.Curve {
  constructor(semiMajor, semiMinor, height) {
    super();
    this.semiMajor = semiMajor;
    this.semiMinor = semiMinor;
    this.height = height;
  }

  getPoint(parameter, target = new THREE.Vector3()) {
    const angle = FULL_TURN * parameter;
    return target.set(
      -this.semiMajor * Math.cos(angle),
      this.height,
      -this.semiMinor * Math.sin(angle),
    );
  }
}

function makeBoredTraverseBar({
  startStation,
  endStation,
  width,
  thickness,
  boreRecords,
  material,
}) {
  const shape = new THREE.Shape();
  shape.moveTo(startStation, -width / 2);
  shape.lineTo(endStation, -width / 2);
  shape.lineTo(endStation, width / 2);
  shape.lineTo(startStation, width / 2);
  shape.closePath();
  for (const record of boreRecords) {
    const hole = new THREE.Path();
    hole.absarc(record.station, 0, record.radius, 0, FULL_TURN, true);
    hole.closePath();
    shape.holes.push(hole);
  }

  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.016,
    bevelThickness: 0.016,
    curveSegments: 40,
    depth: thickness,
  });
  geometry.translate(0, 0, -thickness / 2);
  geometry.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(geometry, material);
  body.userData.role = 'rigid-three-bore-traverse-bar';
  body.userData.bores = boreRecords.map((record) => ({
    name: record.name,
    radius: record.radius,
    station: record.station,
  }));
  return body;
}

function twoStudEllipsograph() {
  const root = new THREE.Group();

  // Brown's engraving is a plan view.  The middle circle on the oblique bar
  // is the horizontal-groove stud, the lower-right circle is the vertical-
  // groove stud, and the upper-left circle is the pencil.  These measured
  // centers determine the complete ideal trammel; no linkage dimensions are
  // guessed from a generic ellipsograph.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.014;
  const sourceCrossDatum = new THREE.Vector2(263, 277.5);
  const sourceHorizontalStud = new THREE.Vector2(207, 277.5);
  const sourceVerticalStud = new THREE.Vector2(263, 330);
  const sourcePencil = new THREE.Vector2(83, 159.5);
  const sourceBarStart = new THREE.Vector2(39, 119.5);
  const sourceBarEnd = new THREE.Vector2(320.5, 384);
  const sourceEllipseMinimum = new THREE.Vector2(15, 106);
  const sourceEllipseMaximum = new THREE.Vector2(511, 449);
  const sourceHorizontalCrossMinimumX = 52;
  const sourceHorizontalCrossMaximumX = 456;
  const sourceVerticalCrossMinimumY = 136;
  const sourceVerticalCrossMaximumY = 427;

  const sourceStudVector = sourceVerticalStud.clone()
    .sub(sourceHorizontalStud);
  const sourceStudSpacing = sourceStudVector.length();
  const sourceBarDirection = sourceStudVector.clone().normalize();
  const sourcePencilVector = sourcePencil.clone()
    .sub(sourceHorizontalStud);
  const sourcePencilOffset = -sourcePencilVector.dot(sourceBarDirection);
  const sourcePencilProjected = sourceHorizontalStud.clone()
    .addScaledVector(sourceBarDirection, -sourcePencilOffset);
  const sourcePencilProjectionError = sourcePencilProjected.distanceTo(
    sourcePencil,
  );
  const sourceAngle = Math.atan2(
    sourceBarDirection.y,
    sourceBarDirection.x,
  );

  const studSpacing = sourceStudSpacing * sourceScale;
  const pencilOffset = sourcePencilOffset * sourceScale;
  const semiMajor = studSpacing + pencilOffset;
  const semiMinor = pencilOffset;
  const pencilSideOverhang = 60 * sourceScale;
  const farSideOverhang = 78.5 * sourceScale;
  const barStartStation = -pencilOffset - pencilSideOverhang;
  const barEndStation = studSpacing + farSideOverhang;
  const barLength = barEndStation - barStartStation;
  const barWidth = 0.59;
  const barThickness = 0.18;
  const barCenterY = 0.70;
  const barBottomY = barCenterY - barThickness / 2;
  const barTopY = barCenterY + barThickness / 2;

  const horizontalCrossMinimumX = (
    sourceHorizontalCrossMinimumX - sourceCrossDatum.x
  ) * sourceScale;
  const horizontalCrossMaximumX = (
    sourceHorizontalCrossMaximumX - sourceCrossDatum.x
  ) * sourceScale;
  const verticalCrossMinimumZ = (
    sourceVerticalCrossMinimumY - sourceCrossDatum.y
  ) * sourceScale;
  const verticalCrossMaximumZ = (
    sourceVerticalCrossMaximumY - sourceCrossDatum.y
  ) * sourceScale;
  const horizontalCrossLength = horizontalCrossMaximumX
    - horizontalCrossMinimumX;
  const verticalCrossLength = verticalCrossMaximumZ
    - verticalCrossMinimumZ;
  const horizontalGrooveWidth = 0.34;
  const verticalGrooveWidth = 0.42;
  const horizontalCrossOuterWidth = 1.08;
  const verticalCrossOuterWidth = 1.33;
  const railHeight = 0.22;
  const railCenterY = 0.31;
  const railTopY = railCenterY + railHeight / 2;
  const grooveFloorThickness = 0.055;
  const grooveFloorCenterY = 0.175;
  const grooveFloorTopY = grooveFloorCenterY
    + grooveFloorThickness / 2;
  const endCapThickness = 0.12;

  const studRadius = 0.12;
  const studBoreRadius = 0.18;
  const pencilRadius = 0.072;
  const pencilBoreRadius = 0.18;
  const pinLowerY = grooveFloorTopY + 0.006;
  const pinUpperY = barTopY + 0.075;
  const pinLength = pinUpperY - pinLowerY;
  const pinCenterY = (pinUpperY + pinLowerY) / 2;
  const horizontalStudRadialClearance = horizontalGrooveWidth / 2
    - studRadius;
  const verticalStudRadialClearance = verticalGrooveWidth / 2
    - studRadius;
  const studBoreRadialClearance = studBoreRadius - studRadius;
  const pencilBoreRadialClearance = pencilBoreRadius - pencilRadius;

  const traceY = 0.045;
  const pencilTipY = traceY;
  const pencilConeHeight = 0.19;
  const pencilShaftTopY = barTopY + 0.24;
  const pencilShaftBottomY = pencilTipY + pencilConeHeight;
  const pencilShaftLength = pencilShaftTopY - pencilShaftBottomY;
  const cyclePeriod = 6;
  const cycleAngularSpeed = FULL_TURN / cyclePeriod;

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.68,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.16,
    roughness: 0.58,
  });
  const barMaterial = matte(PALETTE.driver, {
    metalness: 0.09,
    roughness: 0.63,
  });
  const studMaterial = matte(PALETTE.driven, {
    metalness: 0.11,
    roughness: 0.60,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.46 });
  const pencilMaterial = matte(PALETTE.accent, {
    metalness: 0.04,
    roughness: 0.66,
  });

  const fixedCross = new THREE.Group();
  fixedCross.userData.role = 'fixed-orthogonal-open-groove-cross-piece';
  const horizontalTrackFloor = new THREE.Mesh(
    new THREE.BoxGeometry(
      horizontalCrossLength,
      grooveFloorThickness,
      horizontalGrooveWidth,
    ),
    darkMaterial,
  );
  horizontalTrackFloor.position.set(
    (horizontalCrossMinimumX + horizontalCrossMaximumX) / 2,
    grooveFloorCenterY,
    0,
  );
  horizontalTrackFloor.userData.role = 'recessed-horizontal-groove-floor';
  horizontalTrackFloor.userData.axis = X_AXIS.clone();
  const verticalTrackFloor = new THREE.Mesh(
    new THREE.BoxGeometry(
      verticalGrooveWidth,
      grooveFloorThickness,
      verticalCrossLength,
    ),
    darkMaterial,
  );
  verticalTrackFloor.position.set(
    0,
    grooveFloorCenterY + 0.002,
    (verticalCrossMinimumZ + verticalCrossMaximumZ) / 2,
  );
  verticalTrackFloor.userData.role = 'recessed-vertical-groove-floor';
  verticalTrackFloor.userData.axis = Z_AXIS.clone();

  const horizontalRailWidth = (
    horizontalCrossOuterWidth - horizontalGrooveWidth
  ) / 2;
  const verticalRailWidth = (
    verticalCrossOuterWidth - verticalGrooveWidth
  ) / 2;
  const horizontalRailZs = [
    -(horizontalGrooveWidth + horizontalRailWidth) / 2,
    (horizontalGrooveWidth + horizontalRailWidth) / 2,
  ];
  const verticalRailXs = [
    -(verticalGrooveWidth + verticalRailWidth) / 2,
    (verticalGrooveWidth + verticalRailWidth) / 2,
  ];
  const horizontalRailIntervals = [
    [horizontalCrossMinimumX, -verticalCrossOuterWidth / 2],
    [verticalCrossOuterWidth / 2, horizontalCrossMaximumX],
  ];
  const verticalRailIntervals = [
    [verticalCrossMinimumZ, -horizontalCrossOuterWidth / 2],
    [horizontalCrossOuterWidth / 2, verticalCrossMaximumZ],
  ];
  const horizontalRails = [];
  for (const [sideIndex, z] of horizontalRailZs.entries()) {
    for (const [intervalIndex, [minimum, maximum]]
      of horizontalRailIntervals.entries()) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(maximum - minimum, railHeight, horizontalRailWidth),
        frameMaterial,
      );
      rail.position.set((minimum + maximum) / 2, railCenterY, z);
      rail.userData.role = 'horizontal-groove-side-wall';
      rail.userData.side = sideIndex === 0 ? 'negative-z' : 'positive-z';
      rail.userData.segment = intervalIndex === 0 ? 'left' : 'right';
      horizontalRails.push(rail);
    }
  }
  const verticalRails = [];
  for (const [sideIndex, x] of verticalRailXs.entries()) {
    for (const [intervalIndex, [minimum, maximum]]
      of verticalRailIntervals.entries()) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(verticalRailWidth, railHeight, maximum - minimum),
        frameMaterial,
      );
      rail.position.set(x, railCenterY, (minimum + maximum) / 2);
      rail.userData.role = 'vertical-groove-side-wall';
      rail.userData.side = sideIndex === 0 ? 'negative-x' : 'positive-x';
      rail.userData.segment = intervalIndex === 0 ? 'rear' : 'front';
      verticalRails.push(rail);
    }
  }

  const cornerBlockWidth = (
    verticalCrossOuterWidth - verticalGrooveWidth
  ) / 2;
  const cornerBlockDepth = (
    horizontalCrossOuterWidth - horizontalGrooveWidth
  ) / 2;
  const cornerBlockXs = [
    -(verticalGrooveWidth / 2 + cornerBlockWidth / 2),
    verticalGrooveWidth / 2 + cornerBlockWidth / 2,
  ];
  const cornerBlockZs = [
    -(horizontalGrooveWidth / 2 + cornerBlockDepth / 2),
    horizontalGrooveWidth / 2 + cornerBlockDepth / 2,
  ];
  const crossingCornerBlocks = [];
  for (const x of cornerBlockXs) {
    for (const z of cornerBlockZs) {
      const corner = new THREE.Mesh(
        new THREE.BoxGeometry(
          cornerBlockWidth,
          railHeight,
          cornerBlockDepth,
        ),
        frameMaterial,
      );
      corner.position.set(x, railCenterY, z);
      corner.userData.role = 'solid-corner-around-crossed-open-grooves';
      crossingCornerBlocks.push(corner);
    }
  }

  const horizontalEndCaps = [
    horizontalCrossMinimumX,
    horizontalCrossMaximumX,
  ].map((x, index) => {
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(
        endCapThickness,
        railHeight,
        horizontalCrossOuterWidth,
      ),
      frameMaterial,
    );
    cap.position.set(x, railCenterY, 0);
    cap.userData.role = 'closed-horizontal-groove-end';
    cap.userData.side = index === 0 ? 'left' : 'right';
    return cap;
  });
  const verticalEndCaps = [
    verticalCrossMinimumZ,
    verticalCrossMaximumZ,
  ].map((z, index) => {
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(
        verticalCrossOuterWidth,
        railHeight,
        endCapThickness,
      ),
      frameMaterial,
    );
    cap.position.set(0, railCenterY, z);
    cap.userData.role = 'closed-vertical-groove-end';
    cap.userData.side = index === 0 ? 'rear' : 'front';
    return cap;
  });
  fixedCross.add(
    horizontalTrackFloor,
    verticalTrackFloor,
    ...horizontalRails,
    ...verticalRails,
    ...crossingCornerBlocks,
    ...horizontalEndCaps,
    ...verticalEndCaps,
  );

  const barBoreRecords = [
    { name: 'pencil', radius: pencilBoreRadius, station: -pencilOffset },
    { name: 'horizontal-stud', radius: studBoreRadius, station: 0 },
    { name: 'vertical-stud', radius: studBoreRadius, station: studSpacing },
  ];
  const traverseBar = new THREE.Group();
  traverseBar.userData.role = 'continuously-turned-rigid-traverse-bar';
  traverseBar.userData.axis = Y_AXIS.clone();
  const barBody = makeBoredTraverseBar({
    startStation: barStartStation,
    endStation: barEndStation,
    width: barWidth,
    thickness: barThickness,
    boreRecords: barBoreRecords,
    material: barMaterial,
  });
  traverseBar.add(barBody);

  const makeStud = (name, station, guideAxis) => {
    const assembly = new THREE.Group();
    assembly.position.x = station;
    assembly.userData.role = `${name}-bar-fixed-groove-stud`;
    assembly.userData.guideAxis = guideAxis.clone();
    assembly.userData.station = station;
    const pin = cylinderAlongY(studRadius, pinLength, studMaterial);
    pin.position.y = pinCenterY - barCenterY;
    pin.userData.role = `${name}-stud-pin-running-inside-groove`;
    const topFace = cylinderAlongY(
      studBoreRadius * 0.78,
      0.044,
      whiteMaterial,
      36,
    );
    topFace.position.y = barTopY + 0.040 - barCenterY;
    topFace.userData.role = `${name}-stud-white-motion-index`;
    assembly.add(pin, topFace);
    assembly.userData.blocks = { pin, topFace };
    return assembly;
  };
  const horizontalStudAssembly = makeStud(
    'horizontal',
    0,
    X_AXIS,
  );
  const verticalStudAssembly = makeStud(
    'vertical',
    studSpacing,
    Z_AXIS,
  );

  const pencilAssembly = new THREE.Group();
  pencilAssembly.position.x = -pencilOffset;
  pencilAssembly.userData.role = 'bar-fixed-pencil-holder-and-pencil';
  pencilAssembly.userData.station = -pencilOffset;
  const pencilShaft = cylinderAlongY(
    pencilRadius,
    pencilShaftLength,
    pencilMaterial,
    28,
  );
  pencilShaft.position.y = (
    pencilShaftTopY + pencilShaftBottomY
  ) / 2 - barCenterY;
  pencilShaft.userData.role = 'ellipse-drawing-pencil-shaft';
  const pencilPoint = new THREE.Mesh(
    new THREE.ConeGeometry(pencilRadius * 1.30, pencilConeHeight, 28),
    darkMaterial,
  );
  pencilPoint.rotation.z = Math.PI;
  pencilPoint.position.y = pencilTipY + pencilConeHeight / 2
    - barCenterY;
  pencilPoint.userData.role = 'pencil-point-at-ellipse-contact';
  const pencilTopFace = cylinderAlongY(
    pencilBoreRadius * 0.78,
    0.044,
    whiteMaterial,
    36,
  );
  pencilTopFace.position.y = barTopY + 0.040 - barCenterY;
  pencilTopFace.userData.role = 'pencil-white-motion-index';
  pencilAssembly.add(
    pencilShaft,
    pencilPoint,
    pencilTopFace,
  );
  pencilAssembly.userData.blocks = {
    pencilPoint,
    pencilShaft,
    pencilTopFace,
  };
  traverseBar.add(
    horizontalStudAssembly,
    verticalStudAssembly,
    pencilAssembly,
  );

  const ellipseCurve = new EllipseCurveXZ(semiMajor, semiMinor, traceY);
  const ellipseTrace = new THREE.Mesh(
    new THREE.TubeGeometry(ellipseCurve, 320, 0.022, 7, true),
    matte(PALETTE.driven, { roughness: 0.74 }),
  );
  ellipseTrace.userData.role = 'fixed-complete-ellipse-traced-by-pencil';
  ellipseTrace.userData.curve = ellipseCurve;
  ellipseTrace.userData.semiMajor = semiMajor;
  ellipseTrace.userData.semiMinor = semiMinor;
  const traceMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.070, 20, 14),
    whiteMaterial,
  );
  traceMarker.userData.role = 'moving-pencil-to-paper-contact-index';

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(9.25, 1.32, 6.90),
    new THREE.MeshBasicMaterial({
      color: PALETTE.paper,
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0, 0.66, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = 'invisible-full-traverse-bar-sweep-envelope';

  root.add(
    cameraEnvelope,
    ellipseTrace,
    fixedCross,
    traverseBar,
    traceMarker,
  );

  const pointAtStation = (angle, station) => new THREE.Vector2(
    (station - studSpacing) * Math.cos(angle),
    station * Math.sin(angle),
  );
  const pointVelocityAtStation = (
    angle,
    angularSpeed,
    station,
  ) => new THREE.Vector2(
    -(station - studSpacing) * angularSpeed * Math.sin(angle),
    station * angularSpeed * Math.cos(angle),
  );
  const pointAccelerationAtStation = (
    angle,
    angularSpeed,
    angularAcceleration,
    station,
  ) => new THREE.Vector2(
    -(station - studSpacing) * (
      angularAcceleration * Math.sin(angle)
        + angularSpeed ** 2 * Math.cos(angle)
    ),
    station * (
      angularAcceleration * Math.cos(angle)
        - angularSpeed ** 2 * Math.sin(angle)
    ),
  );
  const toWorldPoint = (planar, y) => new THREE.Vector3(
    planar.x,
    y,
    planar.y,
  );
  const toWorldVector = (planar) => new THREE.Vector3(
    planar.x,
    0,
    planar.y,
  );

  const stateAtAngle = (
    angle,
    angularSpeed = cycleAngularSpeed,
    angularAcceleration = 0,
  ) => {
    const horizontalPlanar = pointAtStation(angle, 0);
    const verticalPlanar = pointAtStation(angle, studSpacing);
    const pencilPlanar = pointAtStation(angle, -pencilOffset);
    const barStartPlanar = pointAtStation(angle, barStartStation);
    const barEndPlanar = pointAtStation(angle, barEndStation);
    const horizontalVelocityPlanar = pointVelocityAtStation(
      angle,
      angularSpeed,
      0,
    );
    const verticalVelocityPlanar = pointVelocityAtStation(
      angle,
      angularSpeed,
      studSpacing,
    );
    const pencilVelocityPlanar = pointVelocityAtStation(
      angle,
      angularSpeed,
      -pencilOffset,
    );
    const horizontalAccelerationPlanar = pointAccelerationAtStation(
      angle,
      angularSpeed,
      angularAcceleration,
      0,
    );
    const verticalAccelerationPlanar = pointAccelerationAtStation(
      angle,
      angularSpeed,
      angularAcceleration,
      studSpacing,
    );
    const pencilAccelerationPlanar = pointAccelerationAtStation(
      angle,
      angularSpeed,
      angularAcceleration,
      -pencilOffset,
    );
    const barDirectionPlanar = new THREE.Vector2(
      Math.cos(angle),
      Math.sin(angle),
    );
    const barNormalPlanar = new THREE.Vector2(
      -Math.sin(angle),
      Math.cos(angle),
    );
    const studDifference = verticalPlanar.clone().sub(horizontalPlanar);
    const studRelativeVelocity = verticalVelocityPlanar.clone()
      .sub(horizontalVelocityPlanar);
    const studRelativeAcceleration = verticalAccelerationPlanar.clone()
      .sub(horizontalAccelerationPlanar);
    const expectedRelativeVelocity = barNormalPlanar.clone()
      .multiplyScalar(studSpacing * angularSpeed);
    const expectedRelativeAcceleration = barNormalPlanar.clone()
      .multiplyScalar(studSpacing * angularAcceleration)
      .addScaledVector(
        barDirectionPlanar,
        -studSpacing * angularSpeed ** 2,
      );
    const pencilFromHorizontal = pencilPlanar.clone()
      .sub(horizontalPlanar);
    const ellipseConstraint = pencilPlanar.x ** 2 / semiMajor ** 2
      + pencilPlanar.y ** 2 / semiMinor ** 2 - 1;
    const ellipseVelocityConstraint = 2 * (
      pencilPlanar.x * pencilVelocityPlanar.x / semiMajor ** 2
        + pencilPlanar.y * pencilVelocityPlanar.y / semiMinor ** 2
    );
    const ellipseAccelerationConstraint = 2 * (
      (pencilVelocityPlanar.x ** 2
        + pencilPlanar.x * pencilAccelerationPlanar.x) / semiMajor ** 2
        + (pencilVelocityPlanar.y ** 2
          + pencilPlanar.y * pencilAccelerationPlanar.y) / semiMinor ** 2
    );

    return {
      angle,
      angularAcceleration,
      angularSpeed,
      barDirection: toWorldVector(barDirectionPlanar),
      barEnd: {
        planarPosition: barEndPlanar,
        position: toWorldPoint(barEndPlanar, barCenterY),
      },
      barNormal: toWorldVector(barNormalPlanar),
      barStart: {
        planarPosition: barStartPlanar,
        position: toWorldPoint(barStartPlanar, barCenterY),
      },
      ellipseAccelerationConstraint,
      ellipseConstraint,
      ellipseVelocityConstraint,
      horizontalStud: {
        acceleration: toWorldVector(horizontalAccelerationPlanar),
        accelerationNormalError: horizontalAccelerationPlanar.y,
        guidePositionError: horizontalPlanar.y,
        guideVelocityError: horizontalVelocityPlanar.y,
        planarAcceleration: horizontalAccelerationPlanar,
        planarPosition: horizontalPlanar,
        planarVelocity: horizontalVelocityPlanar,
        position: toWorldPoint(horizontalPlanar, barCenterY),
        velocity: toWorldVector(horizontalVelocityPlanar),
      },
      pencil: {
        acceleration: toWorldVector(pencilAccelerationPlanar),
        planarAcceleration: pencilAccelerationPlanar,
        planarPosition: pencilPlanar,
        planarVelocity: pencilVelocityPlanar,
        position: toWorldPoint(pencilPlanar, pencilTipY),
        velocity: toWorldVector(pencilVelocityPlanar),
      },
      pencilCollinearityError: pencilFromHorizontal.dot(barNormalPlanar),
      pencilStationError: pencilFromHorizontal.dot(barDirectionPlanar)
        + pencilOffset,
      stage: 'continuous-clockwise-traverse-bar-rotation',
      studRelativeAccelerationError: studRelativeAcceleration.distanceTo(
        expectedRelativeAcceleration,
      ),
      studRelativeVelocityError: studRelativeVelocity.distanceTo(
        expectedRelativeVelocity,
      ),
      studSpacingError: studDifference.length() - studSpacing,
      studVectorCollinearityError: studDifference.dot(barNormalPlanar),
      studVectorStationError: studDifference.dot(barDirectionPlanar)
        - studSpacing,
      verticalStud: {
        acceleration: toWorldVector(verticalAccelerationPlanar),
        accelerationNormalError: verticalAccelerationPlanar.x,
        guidePositionError: verticalPlanar.x,
        guideVelocityError: verticalVelocityPlanar.x,
        planarAcceleration: verticalAccelerationPlanar,
        planarPosition: verticalPlanar,
        planarVelocity: verticalVelocityPlanar,
        position: toWorldPoint(verticalPlanar, barCenterY),
        velocity: toWorldVector(verticalVelocityPlanar),
      },
    };
  };

  const stateAtTime = (time) => {
    const angle = sourceAngle + cycleAngularSpeed * time;
    const state = stateAtAngle(angle);
    state.cyclePhase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    state.time = time;
    return state;
  };
  const stateAtCyclePhase = (phase) => stateAtTime(phase * cyclePeriod);

  const sourceState = stateAtTime(0);
  const worldToSource = (point) => new THREE.Vector2(
    sourceCrossDatum.x + point.x / sourceScale,
    sourceCrossDatum.y + point.z / sourceScale,
  );
  const sourceHorizontalStudMapped = worldToSource(
    sourceState.horizontalStud.position,
  );
  const sourceVerticalStudMapped = worldToSource(
    sourceState.verticalStud.position,
  );
  const sourcePencilMapped = worldToSource(sourceState.pencil.position);
  const sourceBarStartMapped = worldToSource(sourceState.barStart.position);
  const sourceBarEndMapped = worldToSource(sourceState.barEnd.position);

  root.userData.mechanism =
    'two-stud-orthogonal-groove-trammel-continuous-ellipse-pencil';
  root.userData.blocks = {
    barBody,
    barBoreRecords,
    cameraEnvelope,
    crossingCornerBlocks,
    ellipseTrace,
    fixedCross,
    horizontalEndCaps,
    horizontalRails,
    horizontalStudAssembly,
    horizontalTrackFloor,
    pencilAssembly,
    traceMarker,
    traverseBar,
    verticalEndCaps,
    verticalRails,
    verticalStudAssembly,
    verticalTrackFloor,
  };
  root.userData.canonicalStates = {
    bottomExtreme: stateAtAngle(3 * Math.PI / 2),
    leftExtreme: stateAtAngle(0),
    rightExtreme: stateAtAngle(Math.PI),
    source: sourceState,
    topExtreme: stateAtAngle(Math.PI / 2),
  };
  root.userData.curves = { ellipse: ellipseCurve };
  root.userData.geometry = {
    axis: Y_AXIS.clone(),
    barBottomY,
    barCenterY,
    barEndStation,
    barLength,
    barStartStation,
    barThickness,
    barTopY,
    barWidth,
    cycleAngularSpeed,
    cyclePeriod,
    endCapThickness,
    farSideOverhang,
    grooveFloorCenterY,
    grooveFloorThickness,
    grooveFloorTopY,
    horizontalCrossLength,
    horizontalCrossMaximumX,
    horizontalCrossMinimumX,
    horizontalCrossOuterWidth,
    horizontalGrooveWidth,
    horizontalStudRadialClearance,
    pencilBoreRadialClearance,
    pencilBoreRadius,
    pencilOffset,
    pencilRadius,
    pencilSideOverhang,
    pencilTipY,
    pinCenterY,
    pinLength,
    pinLowerY,
    pinUpperY,
    railCenterY,
    railHeight,
    railTopY,
    semiMajor,
    semiMinor,
    sourceAngle,
    sourceBarDirection: sourceBarDirection.clone(),
    sourceBarEnd: sourceBarEnd.clone(),
    sourceBarEndMapped,
    sourceBarStart: sourceBarStart.clone(),
    sourceBarStartMapped,
    sourceCrossDatum: sourceCrossDatum.clone(),
    sourceEllipseMaximum: sourceEllipseMaximum.clone(),
    sourceEllipseMinimum: sourceEllipseMinimum.clone(),
    sourceHorizontalCrossMaximumX,
    sourceHorizontalCrossMinimumX,
    sourceHorizontalStud: sourceHorizontalStud.clone(),
    sourceHorizontalStudMapped,
    sourceImageHeight,
    sourceImageWidth,
    sourcePencil: sourcePencil.clone(),
    sourcePencilMapped,
    sourcePencilOffset,
    sourcePencilProjected: sourcePencilProjected.clone(),
    sourcePencilProjectionError,
    sourceScale,
    sourceStudSpacing,
    sourceStudVector: sourceStudVector.clone(),
    sourceVerticalCrossMaximumY,
    sourceVerticalCrossMinimumY,
    sourceVerticalStud: sourceVerticalStud.clone(),
    sourceVerticalStudMapped,
    studBoreRadialClearance,
    studBoreRadius,
    studRadius,
    studSpacing,
    traceY,
    verticalCrossLength,
    verticalCrossMaximumZ,
    verticalCrossMinimumZ,
    verticalCrossOuterWidth,
    verticalGrooveWidth,
    verticalStudRadialClearance,
  };
  root.userData.stateAtAngle = stateAtAngle;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    traverseBar.position.set(
      state.horizontalStud.position.x,
      barCenterY,
      state.horizontalStud.position.z,
    );
    traverseBar.rotation.set(0, -state.angle, 0);
    traverseBar.userData.angularSpeed = state.angularSpeed;
    horizontalStudAssembly.userData.velocity =
      state.horizontalStud.velocity.clone();
    horizontalStudAssembly.userData.acceleration =
      state.horizontalStud.acceleration.clone();
    verticalStudAssembly.userData.velocity =
      state.verticalStud.velocity.clone();
    verticalStudAssembly.userData.acceleration =
      state.verticalStud.acceleration.clone();
    pencilAssembly.userData.velocity = state.pencil.velocity.clone();
    pencilAssembly.userData.acceleration = state.pencil.acceleration.clone();
    traceMarker.position.copy(state.pencil.position);
    root.userData.contacts = {
      horizontalGroove: {
        accelerationNormalError:
          state.horizontalStud.accelerationNormalError,
        axis: X_AXIS.clone(),
        centerlinePositionError: state.horizontalStud.guidePositionError,
        centerlineVelocityError: state.horizontalStud.guideVelocityError,
        radialClearance: horizontalStudRadialClearance,
      },
      pencilTrace: {
        accelerationConstraintError: state.ellipseAccelerationConstraint,
        contactPoint: state.pencil.position.clone(),
        ellipseConstraintError: state.ellipseConstraint,
        velocityConstraintError: state.ellipseVelocityConstraint,
      },
      rigidTraverseBar: {
        pencilCollinearityError: state.pencilCollinearityError,
        pencilStationError: state.pencilStationError,
        relativeAccelerationError: state.studRelativeAccelerationError,
        relativeVelocityError: state.studRelativeVelocityError,
        spacingError: state.studSpacingError,
        studCollinearityError: state.studVectorCollinearityError,
        studStationError: state.studVectorStationError,
      },
      verticalGroove: {
        accelerationNormalError:
          state.verticalStud.accelerationNormalError,
        axis: Z_AXIS.clone(),
        centerlinePositionError: state.verticalStud.guidePositionError,
        centerlineVelocityError: state.verticalStud.guideVelocityError,
        radialClearance: verticalStudRadialClearance,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);

  root.userData.fidelity = 'authored';
  root.userData.cameraDistanceScale = 0.98;
  markShadows(root);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  for (const object of [cameraEnvelope, traceMarker]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }

  return {
    cameraDirection: new THREE.Vector3(7.8, 7.2, 10.8),
    root,
    update,
  };
}

function adjustablePantograph(movement) {
  const root = new THREE.Group();
  const cyclePeriod = 6;
  const traceAngularSpeed = FULL_TURN / cyclePeriod;
  const scaleFactor = 2;
  const areaScaleFactor = scaleFactor ** 2;
  const parallelBarLength = 2.4;
  const adjacentBarLength = 2.4;
  const lowerLayerY = 0.43;
  const upperLayerY = 0.61;
  const barThickness = 0.105;
  const layerClearance = upperLayerY - lowerLayerY - barThickness;
  const jointCenterY = (lowerLayerY + upperLayerY) / 2;
  const paperTopY = -0.02;
  const fixedPointC = new THREE.Vector2(-2.35, 1.45);
  const tracerBaseFromC = new THREE.Vector2(0.18, -2);
  // Brown runs both long arms on past pencil A and fixed point C (about a
  // quarter of a 2.4-unit side), where their slides are adjusted.
  const lowerRailOverhang = 0.55;
  const upperRailOverhang = 0.65;
  const rightRailOverhang = 0.14;

  const traceOffsetAtAngle = (angle) => new THREE.Vector2(
    0.19 * Math.cos(angle)
      + 0.055 * Math.cos(2 * angle)
      - 0.025 * Math.sin(3 * angle),
    0.16 * Math.sin(angle)
      + 0.045 * Math.sin(2 * angle)
      + 0.02 * Math.cos(3 * angle),
  );
  const traceOffsetFirstDerivative = (angle) => new THREE.Vector2(
    -0.19 * Math.sin(angle)
      - 0.11 * Math.sin(2 * angle)
      - 0.075 * Math.cos(3 * angle),
    0.16 * Math.cos(angle)
      + 0.09 * Math.cos(2 * angle)
      - 0.06 * Math.sin(3 * angle),
  );
  const traceOffsetSecondDerivative = (angle) => new THREE.Vector2(
    -0.19 * Math.cos(angle)
      - 0.22 * Math.cos(2 * angle)
      + 0.225 * Math.sin(3 * angle),
    -0.16 * Math.sin(angle)
      - 0.18 * Math.sin(2 * angle)
      - 0.18 * Math.cos(3 * angle),
  );
  const tracerPositionAtAngle = (angle) => fixedPointC.clone()
    .add(tracerBaseFromC)
    .add(traceOffsetAtAngle(angle));
  const pencilPositionForTracer = (tracerPosition) => fixedPointC.clone()
    .add(tracerPosition.clone().sub(fixedPointC).multiplyScalar(scaleFactor));

  const solvePantographAtAngle = (angle) => {
    const tracerPosition = tracerPositionAtAngle(angle);
    const tracerFromC = tracerPosition.clone().sub(fixedPointC);
    const centerDistance = tracerFromC.length();
    const unitToTracer = tracerFromC.clone().divideScalar(centerDistance);
    const along = (
      parallelBarLength ** 2
      - adjacentBarLength ** 2
      + centerDistance ** 2
    ) / (2 * centerDistance);
    const heightSquared = parallelBarLength ** 2 - along ** 2;
    if (heightSquared <= 0) {
      throw new RangeError('Movement 246 pantograph reached a singular pose.');
    }
    const height = Math.sqrt(heightSquared);
    const perpendicular = new THREE.Vector2(
      -unitToTracer.y,
      unitToTracer.x,
    );
    const lowerJointFromC = unitToTracer.multiplyScalar(along)
      .add(perpendicular.multiplyScalar(height));
    const lowerJoint = fixedPointC.clone().add(lowerJointFromC);
    const upperJoint = tracerPosition.clone().add(lowerJointFromC);
    const rightJoint = fixedPointC.clone().addScaledVector(
      lowerJointFromC,
      2,
    );
    const pencilPosition = pencilPositionForTracer(tracerPosition);
    const tracerVelocity = traceOffsetFirstDerivative(angle)
      .multiplyScalar(traceAngularSpeed);
    const tracerAcceleration = traceOffsetSecondDerivative(angle)
      .multiplyScalar(traceAngularSpeed ** 2);
    const pencilVelocity = tracerVelocity.clone().multiplyScalar(scaleFactor);
    const pencilAcceleration = tracerAcceleration.clone()
      .multiplyScalar(scaleFactor);
    const parallelogramClosureResidual = rightJoint.clone().sub(
      upperJoint.clone().add(lowerJoint).sub(tracerPosition),
    );
    const copyResidual = pencilPosition.clone().sub(
      fixedPointC.clone().add(
        tracerPosition.clone().sub(fixedPointC).multiplyScalar(scaleFactor),
      ),
    );
    return {
      areaScaleFactor,
      centerDistance,
      copyResidual,
      cycleCoordinate: positiveModulo(angle, FULL_TURN) / FULL_TURN,
      lowerJoint,
      lowerJointFromC,
      parallelogramClosureResidual,
      pencilAcceleration,
      pencilPosition,
      pencilSpeed: pencilVelocity.length(),
      pencilVelocity,
      rightJoint,
      scaleFactor,
      sourcePose: positiveModulo(angle, FULL_TURN) < 1e-12,
      traceAngle: angle,
      tracerAcceleration,
      tracerPosition,
      tracerSpeed: tracerVelocity.length(),
      tracerVelocity,
      upperJoint,
    };
  };
  const stateAtTime = (time) => solvePantographAtAngle(
    time * traceAngularSpeed,
  );

  const toWorld = (point, y) => new THREE.Vector3(point.x, y, point.y);
  const barOptions = (color) => ({
    color,
    depth: 0.17,
    jointRadius: 0.001,
    thickness: barThickness,
  });
  const lowerLongArm = makeDynamicLink(barOptions(PALETTE.driven));
  const upperLongArm = makeDynamicLink(barOptions(PALETTE.driver));
  const blueParallelBar = makeDynamicLink(barOptions(PALETTE.driven));
  const redParallelBar = makeDynamicLink(barOptions(PALETTE.driver));
  lowerLongArm.userData.role =
    'rigid-lower-arm-through-fixed-slide-C-lower-joint-and-right-joint';
  upperLongArm.userData.role =
    'rigid-upper-arm-through-pencil-slide-A-upper-joint-and-right-joint';
  blueParallelBar.userData.role = 'blue-parallelogram-side-from-B-to-upper-joint';
  redParallelBar.userData.role = 'red-parallelogram-side-from-B-to-lower-joint';
  root.add(lowerLongArm, upperLongArm, blueParallelBar, redParallelBar);

  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.2,
    roughness: 0.48,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.5 });
  // Brass washers: white ones would read as holes on the cream page.
  const washerMaterial = matte(PALETTE.brass, { metalness: 0.18, roughness: 0.5 });
  const makeJointPin = (role) => {
    const group = new THREE.Group();
    const shaft = cylinderAlongY(
      0.105,
      upperLayerY - lowerLayerY + 0.29,
      darkMaterial,
      28,
    );
    shaft.position.y = jointCenterY;
    const lowerWasher = ringAroundY(0.155, 0.032, washerMaterial, 36);
    lowerWasher.position.y = lowerLayerY - 0.075;
    const upperWasher = ringAroundY(0.155, 0.032, washerMaterial, 36);
    upperWasher.position.y = upperLayerY + 0.075;
    group.add(shaft, lowerWasher, upperWasher);
    group.userData.role = role;
    return group;
  };
  const jointPins = {
    B: makeJointPin('compound-revolute-joint-at-tracing-point-B'),
    L: makeJointPin('revolute-joint-at-lower-parallelogram-corner'),
    R: makeJointPin('revolute-joint-at-right-parallelogram-corner'),
    U: makeJointPin('revolute-joint-at-upper-parallelogram-corner'),
  };
  root.add(...Object.values(jointPins));

  const paper = new THREE.Mesh(
    new THREE.BoxGeometry(7.4, 0.07, 6.2),
    matte(PALETTE.paper, { roughness: 0.98 }),
  );
  paper.position.set(0, paperTopY - 0.035, -0.42);
  paper.userData.role = 'common-drawing-plane-for-tracer-and-pencil';
  const paperOutline = new THREE.LineSegments(
    new THREE.EdgesGeometry(paper.geometry),
    new THREE.LineBasicMaterial({ color: 0xc6c0b5 }),
  );
  paperOutline.position.copy(paper.position);
  paperOutline.userData.noShadow = true;
  paperOutline.userData.role = 'drawing-sheet-outline';
  root.add(paper, paperOutline);

  const traceSampleCount = 320;
  const tracerTracePoints = Array.from(
    { length: traceSampleCount },
    (_, index) => toWorld(
      tracerPositionAtAngle(FULL_TURN * index / traceSampleCount),
      paperTopY + 0.006,
    ),
  );
  const pencilTracePoints = tracerTracePoints.map((point) => {
    const tracedPoint = new THREE.Vector2(point.x, point.z);
    return toWorld(
      pencilPositionForTracer(tracedPoint),
      paperTopY + 0.008,
    );
  });
  const makeTrace = (points, color, role) => {
    const trace = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color }),
    );
    trace.userData.noShadow = true;
    trace.userData.points = points;
    trace.userData.role = role;
    return trace;
  };
  const tracerTrace = makeTrace(
    tracerTracePoints,
    PALETTE.ink,
    'small-source-locus-traced-by-point-B',
  );
  const pencilTrace = makeTrace(
    pencilTracePoints,
    PALETTE.driver,
    'two-times-linear-copy-drawn-by-pencil-A',
  );
  root.add(tracerTrace, pencilTrace);

  const fixedPivot = new THREE.Group();
  const fixedFoot = cylinderAlongY(0.3, 0.09, frameMaterial, 40);
  fixedFoot.position.y = paperTopY + 0.045;
  const fixedPost = cylinderAlongY(
    0.095,
    lowerLayerY - paperTopY,
    darkMaterial,
    28,
  );
  fixedPost.position.y = (lowerLayerY + paperTopY) / 2;
  const fixedPivotRing = ringAroundY(0.205, 0.052, frameMaterial, 40);
  fixedPivotRing.position.y = lowerLayerY;
  fixedPivot.add(fixedFoot, fixedPost, fixedPivotRing);
  fixedPivot.position.copy(toWorld(fixedPointC, 0));
  fixedPivot.userData.fixed = true;
  fixedPivot.userData.role = 'fixed-point-C-and-rotatable-slide';
  root.add(fixedPivot);

  const fixedSlideC = new THREE.Group();
  const fixedSlideBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.2, 0.35),
    frameMaterial,
  );
  fixedSlideBody.position.y = lowerLayerY;
  fixedSlideC.add(fixedSlideBody);
  fixedSlideC.userData.role = 'adjustable-fixed-pivot-slide-C-on-lower-arm';
  root.add(fixedSlideC);

  const tracerAssembly = new THREE.Group();
  const tracerShaftLength = 0.82;
  const tracerShaft = cylinderAlongY(
    0.055,
    tracerShaftLength,
    whiteMaterial,
    24,
  );
  tracerShaft.position.y = paperTopY + tracerShaftLength / 2;
  const tracerKnob = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 24, 16),
    whiteMaterial,
  );
  tracerKnob.position.y = paperTopY + tracerShaftLength;
  const tracerTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.047, 18, 12),
    darkMaterial,
  );
  tracerTip.position.y = paperTopY + 0.01;
  tracerAssembly.add(tracerShaft, tracerKnob, tracerTip);
  tracerAssembly.userData.role = 'ivory-tracing-point-B';
  root.add(tracerAssembly);

  const pencilAssembly = new THREE.Group();
  const pencilCarrier = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.23, 0.37),
    matte(PALETTE.brass, { metalness: 0.16, roughness: 0.56 }),
  );
  pencilCarrier.position.y = upperLayerY;
  const pencilShaftLength = 0.98;
  const pencilShaft = cylinderAlongY(
    0.072,
    pencilShaftLength,
    matte(PALETTE.driver, { roughness: 0.5 }),
    28,
  );
  pencilShaft.position.y = paperTopY + pencilShaftLength / 2;
  const pencilTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.082, 0.17, 28),
    darkMaterial,
  );
  pencilTip.rotation.z = Math.PI;
  pencilTip.position.y = paperTopY + 0.055;
  pencilAssembly.add(pencilCarrier, pencilShaft, pencilTip);
  pencilAssembly.userData.role = 'adjustable-pencil-slide-A';
  root.add(pencilAssembly);

  const orientHorizontal = (object, start, end) => {
    const direction = end.clone().sub(start).normalize();
    object.quaternion.setFromUnitVectors(X_AXIS, direction);
  };
  const slideSettingsForScale = (requestedScale) => {
    if (!(requestedScale > 1)) {
      throw new RangeError('Pantograph enlargement scale must exceed one.');
    }
    const pencilExtensionOverAdjacentBar = requestedScale - 1;
    const pivotExtensionOverParallelBar = 1
      / pencilExtensionOverAdjacentBar;
    return {
      areaScaleFactor: requestedScale ** 2,
      pencilExtensionOverAdjacentBar,
      pivotExtensionOverParallelBar,
      scaleFactor: requestedScale,
    };
  };

  root.userData.archetype =
    'adjustable-parallelogram-pantograph-with-two-to-one-homothety';
  root.userData.blocks = {
    blueParallelBar,
    fixedPivot,
    fixedSlideC,
    jointPins,
    lowerLongArm,
    paper,
    paperOutline,
    pencilAssembly,
    pencilCarrier,
    pencilShaft,
    pencilTip,
    pencilTrace,
    redParallelBar,
    tracerAssembly,
    tracerKnob,
    tracerShaft,
    tracerTip,
    tracerTrace,
    upperLongArm,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.02, -0.1, -3.02),
    new THREE.Vector3(3.05, 1.03, 2.08),
  );
  root.userData.geometry = {
    adjacentBarLength,
    areaScaleFactor,
    barThickness,
    cyclePeriod,
    fixedPointC,
    jointCenterY,
    layerClearance,
    lowerLayerY,
    lowerRailOverhang,
    paperTopY,
    parallelBarLength,
    rightRailOverhang,
    scaleFactor,
    traceAngularSpeed,
    traceSampleCount,
    tracerBaseFromC,
    upperLayerY,
    upperRailOverhang,
  };
  root.userData.mechanism =
    'fixed-slide-C-and-pencil-slide-A-extend-opposite-sides-of-a-four-bar-parallelogram-so-B-is-the-midpoint-of-C-A';
  root.userData.slideSettingsForScale = slideSettingsForScale;
  root.userData.solvePantographAtAngle = solvePantographAtAngle;
  root.userData.sourceAnimation = {
    available: true,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    referenceScope:
      'labeled topology, fixed point C, tracing point B, pencil A, and the demonstrated two-to-one copy',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate246: {
      imageHeight: 525,
      imageWidth: 525,
      officialAnimationAvailable: true,
      rasterFixedPointC: new THREE.Vector2(65, 448),
      rasterLowerJoint: new THREE.Vector2(294, 356),
      rasterPencilSlideA: new THREE.Vector2(84, 96),
      rasterRightJoint: new THREE.Vector2(492, 275),
      rasterTracingPointB: new THREE.Vector2(109, 274),
      rasterUpperJoint: new THREE.Vector2(293, 190),
      sourceTopology:
        'B-U-R-L is a parallelogram; C-L-R and A-U-R are collinear adjustable arms',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 63,
      edition: 21,
      illustrationPage: 62,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.tracerPositionAtAngle = tracerPositionAtAngle;
  root.userData.transmission = {
    adjustableBySlidingAAndC: true,
    areaScaleFactor,
    degreesOfFreedom: 2,
    drawingScaleFactor: scaleFactor,
    fixedPoint: 'C',
    input: 'ivory-tracing-point-B',
    output: 'pencil-A',
    parallelogramVertices: ['B', 'U', 'R', 'L'],
    pencilAndTracerRemainCollinearWithC: true,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    const C = toWorld(fixedPointC, jointCenterY);
    const B = toWorld(state.tracerPosition, jointCenterY);
    const L = toWorld(state.lowerJoint, jointCenterY);
    const R = toWorld(state.rightJoint, jointCenterY);
    const U = toWorld(state.upperJoint, jointCenterY);
    const A = toWorld(state.pencilPosition, jointCenterY);
    const lowerDirection = R.clone().sub(C).normalize();
    const upperDirection = R.clone().sub(A).normalize();
    const lowerStart = toWorld(fixedPointC, lowerLayerY)
      .addScaledVector(lowerDirection, -lowerRailOverhang);
    const lowerEnd = toWorld(state.rightJoint, lowerLayerY)
      .addScaledVector(lowerDirection, rightRailOverhang);
    const upperStart = toWorld(state.pencilPosition, upperLayerY)
      .addScaledVector(upperDirection, -upperRailOverhang);
    const upperEnd = toWorld(state.rightJoint, upperLayerY)
      .addScaledVector(upperDirection, rightRailOverhang);
    lowerLongArm.userData.setEndpoints(lowerStart, lowerEnd);
    upperLongArm.userData.setEndpoints(upperStart, upperEnd);
    const blueStart = toWorld(state.tracerPosition, lowerLayerY);
    const blueEnd = toWorld(state.upperJoint, lowerLayerY);
    const redStart = toWorld(state.tracerPosition, upperLayerY);
    const redEnd = toWorld(state.lowerJoint, upperLayerY);
    blueParallelBar.userData.setEndpoints(blueStart, blueEnd);
    redParallelBar.userData.setEndpoints(redStart, redEnd);
    lowerLongArm.userData.endpoints = {
      end: lowerEnd.clone(),
      start: lowerStart.clone(),
    };
    upperLongArm.userData.endpoints = {
      end: upperEnd.clone(),
      start: upperStart.clone(),
    };
    blueParallelBar.userData.endpoints = {
      end: blueEnd.clone(),
      start: blueStart.clone(),
    };
    redParallelBar.userData.endpoints = {
      end: redEnd.clone(),
      start: redStart.clone(),
    };
    jointPins.B.position.set(B.x, 0, B.z);
    jointPins.L.position.set(L.x, 0, L.z);
    jointPins.R.position.set(R.x, 0, R.z);
    jointPins.U.position.set(U.x, 0, U.z);
    tracerAssembly.position.set(B.x, 0, B.z);
    pencilAssembly.position.set(A.x, 0, A.z);
    fixedSlideC.position.set(C.x, 0, C.z);
    orientHorizontal(fixedSlideC, C, R);
    orientHorizontal(pencilAssembly, A, R);
    tracerAssembly.userData.velocity = toWorld(state.tracerVelocity, 0);
    tracerAssembly.userData.acceleration = toWorld(
      state.tracerAcceleration,
      0,
    );
    pencilAssembly.userData.velocity = toWorld(state.pencilVelocity, 0);
    pencilAssembly.userData.acceleration = toWorld(
      state.pencilAcceleration,
      0,
    );
    root.userData.contacts = {
      fixedPivotC: {
        active: true,
        position: C,
        translationalVelocity: new THREE.Vector3(),
      },
      jointB: {
        active: true,
        closureError: 0,
        position: B,
      },
      jointL: {
        active: true,
        closureError: 0,
        position: L,
      },
      jointR: {
        active: true,
        closureError: state.parallelogramClosureResidual.length(),
        position: R,
      },
      jointU: {
        active: true,
        closureError: 0,
        position: U,
      },
      pencilAToPaper: {
        active: true,
        point: new THREE.Vector3(A.x, paperTopY, A.z),
      },
      tracerBToPaper: {
        active: true,
        point: new THREE.Vector3(B.x, paperTopY, B.z),
      },
    };
    root.userData.kinematics = state;
  };
  update(0);

  root.userData.fidelity = 'authored';
  markShadows(root);
  for (const object of [paperOutline, tracerTrace, pencilTrace]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(6.8, 8.6, 8.2),
    root,
    update,
  };
}

export function createAuthoredDrawingInstrumentMovement(movement) {
  switch (movement.id) {
    case 152: return twoStudEllipsograph();
    case 246: return correctPantographParts(adjustablePantograph(movement));
    default: return null;
  }
}
