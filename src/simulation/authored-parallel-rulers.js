import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ornamentalRulerArmGeometry } from './ornamental-ruler-arm.js';
import {finishDrawingRuler} from './drawing-ruler-parts.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {circle, poly, plate, polygonClipping} from './finite-plate-geometry.js';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smootherstep(value) {
  return value ** 3 * (value * (value * 6 - 15) + 10);
}

function smootherstepFirst(value) {
  return 30 * value ** 2 * (1 - value) ** 2;
}

function smootherstepSecond(value) {
  return 60 * value * (1 - value) * (1 - 2 * value);
}

function planarToWorld(point, height = 0) {
  return new THREE.Vector3(point.x, height, point.y);
}

function translatedPoint(point, displacement) {
  return point.clone().add(displacement);
}

function makeTriangularPlate({
  color,
  depth,
  holeCenter,
  holeRadius,
  role,
  vertices,
}) {
  const shape = new THREE.Shape();
  shape.moveTo(vertices[0].x, vertices[0].y);
  for (let index = 1; index < vertices.length; index += 1) {
    shape.lineTo(vertices[index].x, vertices[index].y);
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(holeCenter.x, holeCenter.y, holeRadius, 0, FULL_TURN, true);
  hole.closePath();
  shape.holes.push(hole);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 48,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.rotateX(Math.PI / 2);

  const group = new THREE.Group();
  group.userData.role = role;
  group.userData.localVertices = vertices.map((point) => point.clone());
  group.userData.holeCenter = holeCenter.clone();
  group.userData.holeRadius = holeRadius;
  group.userData.solidDepth = depth;

  // Brown inks the plate's edges only because it is a line drawing: the
  // side walls share the plate's own colour.
  const body = new THREE.Mesh(geometry, [
    matte(color, { metalness: 0.08, roughness: 0.66 }),
    matte(color, { metalness: 0.08, roughness: 0.66 }),
  ]);
  body.userData.role = `${role}-solid-with-through-handling-hole`;
  body.userData.isRigidBody = true;

  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 24),
    new THREE.LineBasicMaterial({ color: PALETTE.ink }),
  );
  outline.userData.noShadow = true;
  outline.userData.role = `${role}-source-outline`;
  outline.visible = false; // ink edge line only: kept for references, not drawn
  outline.userData.retiredInkOutline = true;

  const holeRings = [];
  group.add(body, outline);
  group.userData.body = body;
  group.userData.holeRings = holeRings;
  return markShadows(group);
}

function addInsetBand(group, start, end, role, height, thickness = 0.055) {
  const band = makeBeam(
    planarToWorld(start, height),
    planarToWorld(end, height),
    {
      color: PALETTE.ink,
      depth: 0.032,
      jointRadius: 0.001,
      thickness,
    },
  );
  band.userData.role = role;
  group.add(band);
  return band;
}

function cylinderAlongX(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function ringAroundX(radius, tube, material, segments = 44) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 10, segments),
    material,
  );
  ring.rotation.y = Math.PI / 2;
  return ring;
}

function makeRulerPlate({
  depth,
  halfLength,
  halfWidth,
  slotCenters,
  slotHalfLength,
  slotHalfWidth,
}) {
  const shape = new THREE.Shape();
  shape.moveTo(-halfLength, -halfWidth);
  shape.lineTo(halfLength, -halfWidth);
  shape.lineTo(halfLength, halfWidth);
  shape.lineTo(-halfLength, halfWidth);
  shape.closePath();
  for (const center of slotCenters) {
    const hole = new THREE.Path();
    hole.moveTo(center - slotHalfLength, -slotHalfWidth);
    hole.lineTo(center - slotHalfLength, slotHalfWidth);
    hole.lineTo(center + slotHalfLength, slotHalfWidth);
    hole.lineTo(center + slotHalfLength, -slotHalfWidth);
    hole.closePath();
    shape.holes.push(hole);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.rotateX(Math.PI / 2);
  const group = new THREE.Group();
  group.userData.role = 'straight-ruler-B';
  group.userData.solidDepth = depth;
  group.userData.slotCenters = [...slotCenters];

  const body = new THREE.Mesh(geometry, [
    matte(PALETTE.driven, { metalness: 0.08, roughness: 0.66 }),
    matte(PALETTE.driven, { metalness: 0.08, roughness: 0.66 }),
  ]);
  body.userData.role = 'rigid-straight-ruler-B-with-two-wheel-apertures';
  body.userData.isRigidBody = true;
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 24),
    new THREE.LineBasicMaterial({ color: PALETTE.ink }),
  );
  outline.userData.noShadow = true;
  outline.userData.role = 'source-outline-of-straight-ruler-B';
  outline.visible = false; // ink edge line only: kept for references, not drawn
  outline.userData.retiredInkOutline = true;
  group.add(body, outline);
  group.userData.body = body;
  group.userData.outline = outline;
  return markShadows(group);
}


function boredCylinderAlongX(radius, length, boreRadius, material) {
  const geometry = boredLatheGeometry([
    {axial: -length/2, radial: radius}, {axial: length/2, radial: radius},
  ], boreRadius, 64);
  geometry.rotateZ(-Math.PI / 2);
  return new THREE.Mesh(geometry, material);
}

function makeNickedWheel({ radius, role, station, width }) {
  const group = new THREE.Group();
  group.position.x = station;
  group.userData.axis = X_AXIS.clone();
  group.userData.pitchRadius = radius;
  group.userData.role = role;
  group.userData.station = station;
  group.userData.width = width;

  const wheelMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.57,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.20,
    roughness: 0.48,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.46 });
  const body = boredCylinderAlongX(radius - 0.065, width, .084, wheelMaterial);
  body.userData.role = `${role}-solid-wheel-body`;
  group.add(body);

  const nickCount = 16;
  const nicks = [];
  for (let index = 0; index < nickCount; index += 1) {
    const angle = FULL_TURN * index / nickCount;
    const nick = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.96, 0.080, 0.105),
      index === 0 ? whiteMaterial : darkMaterial,
    );
    const radialStation = Math.sqrt(radius ** 2 - (0.105 / 2) ** 2) - 0.040;
    nick.position.set(
      0,
      Math.cos(angle) * radialStation,
      Math.sin(angle) * radialStation,
    );
    nick.rotation.x = angle;
    nick.userData.index = index;
    nick.userData.role = index === 0
      ? `${role}-white-rolling-index-nick`
      : `${role}-paper-gripping-edge-nick`;
    group.add(nick);
    nicks.push(nick);
  }

  const sideRings = [-1, 1].map((side) => {
    const ring = ringAroundX(radius - 0.031, 0.031, darkMaterial);
    ring.position.x = side * (width / 2 + 0.012);
    ring.userData.role = `${role}-side-rim`;
    ring.visible = false; // ink edge line only: kept for references, not drawn
    ring.userData.retiredInkOutline = true;
    group.add(ring);
    return ring;
  });
  const spokes = [];
  for (const side of [-1, 1]) {
    for (let index = 0; index < 4; index += 1) {
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.026, radius * .48, 0.065),
        index === 0 ? whiteMaterial : darkMaterial,
      );
      spoke.position.x = side * (width / 2 + 0.018);
      spoke.rotation.x = index * Math.PI / 4;
      spoke.position.y = Math.cos(spoke.rotation.x) * radius * .55;
      spoke.position.z = Math.sin(spoke.rotation.x) * radius * .55;
      spoke.userData.role = index === 0
        ? `${role}-white-face-rotation-index`
        : `${role}-face-spoke`;
      group.add(spoke);
      spokes.push(spoke);
    }
  }
  const hub = boredCylinderAlongX(0.145, width * 1.45, .084, darkMaterial);
  hub.userData.role = `${role}-hub-fixed-to-axle-C`;
  group.add(hub);
  group.userData.hub = hub;
  group.userData.body = body;
  group.userData.nickCount = nickCount;
  group.userData.nicks = nicks;
  group.userData.sideRings = sideRings;
  group.userData.spokes = spokes;
  return markShadows(group);
}

function rollingWheelParallelRuler(movement) {
  const root = new THREE.Group();

  // The source is a plan view.  The ruler outline, wheel stations, wheel
  // diameters, and transverse width below are measured from the engraving;
  // the vertical build and demonstration stroke are necessarily inferred.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterRectangle = {
    bottomLeft: new THREE.Vector2(8, 326),
    bottomRight: new THREE.Vector2(517, 326),
    topLeft: new THREE.Vector2(8, 169),
    topRight: new THREE.Vector2(517, 169),
  };
  const sourceRasterCenter = new THREE.Vector2(262.5, 247.5);
  const sourceRasterWheelLeft = new THREE.Vector2(72, 249);
  const sourceRasterWheelRight = new THREE.Vector2(453, 249);
  const sourceRasterAxleMarkC = new THREE.Vector2(242, 249);
  const sourceRasterWheelRadius = 33.75;
  const sourceRasterWheelWidth = 26;
  const sourceScaleX = 8 / 509;
  const sourceScaleZ = 2.45 / 157;

  const rulerLength = 8;
  const rulerWidth = 2.45;
  const rulerDepth = 0.22;
  const rulerTopY = rulerDepth / 2;
  const wheelRadius = sourceRasterWheelRadius * sourceScaleZ;
  const wheelWidth = sourceRasterWheelWidth * sourceScaleX;
  const wheelCenterY = 0.34;
  const paperTopY = wheelCenterY - wheelRadius;
  const wheelLeftStation = (sourceRasterWheelLeft.x
    - sourceRasterCenter.x) * sourceScaleX;
  const wheelRightStation = (sourceRasterWheelRight.x
    - sourceRasterCenter.x) * sourceScaleX;
  const axleMarkCStation = (sourceRasterAxleMarkC.x
    - sourceRasterCenter.x) * sourceScaleX;
  const axleLength = 7.45;
  const axleRadius = 0.082;
  const slotHalfLength = 0.37;
  const slotHalfWidth = 0.69;
  const housingOuterHalfLength = 0.48;
  const housingOuterHalfWidth = 0.78;
  const stroke = 2.55;
  const cyclePeriod = 6;
  const cycleAngularFrequency = FULL_TURN / cyclePeriod;

  const sourcePointToReferenceTop = (point) => new THREE.Vector3(
    (point.x - sourceRasterCenter.x) * sourceScaleX,
    rulerTopY,
    -(point.y - sourceRasterCenter.y) * sourceScaleZ,
  );

  const carrier = new THREE.Group();
  carrier.userData.role =
    'pure-translating-ruler-wheel-and-bearing-carriage';
  carrier.userData.translationAxis = new THREE.Vector3(0, 0, 1);
  const rulerB = makeRulerPlate({
    depth: rulerDepth,
    halfLength: rulerLength / 2,
    halfWidth: rulerWidth / 2,
    slotCenters: [wheelLeftStation, wheelRightStation],
    slotHalfLength,
    slotHalfWidth,
  });

  const rollingAssembly = new THREE.Group();
  rollingAssembly.position.y = wheelCenterY;
  rollingAssembly.userData.axis = X_AXIS.clone();
  rollingAssembly.userData.role =
    'single-rigid-rotor-axle-C-with-equal-wheels-A-A';
  const axleC = cylinderAlongX(
    axleRadius,
    axleLength,
    matte(PALETTE.ink, { metalness: 0.32, roughness: 0.38 }),
    28,
  );
  axleC.userData.axis = X_AXIS.clone();
  axleC.userData.role = 'common-rotating-axle-C';
  const wheelALeft = makeNickedWheel({
    radius: wheelRadius,
    role: 'left-equal-nicked-wheel-A',
    station: wheelLeftStation,
    width: wheelWidth,
  });
  const wheelARight = makeNickedWheel({
    radius: wheelRadius,
    role: 'right-equal-nicked-wheel-A',
    station: wheelRightStation,
    width: wheelWidth,
  });
  const collarC = boredCylinderAlongX(
    0.155,
    0.18,
    .084,
    matte(PALETTE.white, { metalness: 0.12, roughness: 0.48 }),
    28,
  );
  collarC.position.x = axleMarkCStation;
  collarC.userData.role = 'visible-axle-C-identification-collar';

  const axleEndNuts = [-1, 1].map((side) => {
    const nut = boredCylinderAlongX(
      0.155,
      0.20,
      .084,
      matte(PALETTE.ink, { metalness: 0.28, roughness: 0.42 }),
      6,
    );
    nut.position.x = side * (axleLength / 2 + 0.08);
    nut.userData.role = 'axle-C-end-retaining-nut';
    return nut;
  });
  rollingAssembly.add(
    axleC,
    wheelALeft,
    wheelARight,
    collarC,
    ...axleEndNuts,
  );

  const housingMaterial = matte(PALETTE.frame, {
    metalness: 0.15,
    roughness: 0.58,
  });
  const bearingHousings = [wheelLeftStation, wheelRightStation].map(
    (station, housingIndex) => {
      const housing = new THREE.Group();
      housing.position.x = station;
      housing.userData.role = housingIndex === 0
        ? 'left-fixed-bearing-housing-on-ruler-B'
        : 'right-fixed-bearing-housing-on-ruler-B';
      for (const side of [-1, 1]) {
        const journalGeometry = plate(polygonClipping.difference(
          poly([[-.17, 0], [.17, 0], [.17, .44], [-.17, .44]]),
          poly(circle([0, wheelCenterY], axleRadius + .005, 48)),
        ), -.07, .07);
        journalGeometry.rotateY(Math.PI / 2);
        const sideBearing = new THREE.Mesh(journalGeometry, housingMaterial);
        sideBearing.position.set(
          side * housingOuterHalfLength,
          0,
          0,
        );
        sideBearing.userData.role =
          'fixed-axle-C-journal-bearing-on-ruler-B';
        housing.add(sideBearing);
      }
      for (const zSide of [-1, 1]) {
        const crossRail = new THREE.Mesh(
          new THREE.BoxGeometry(
            housingOuterHalfLength * 2 + 0.14,
            0.12,
            0.13,
          ),
          housingMaterial,
        );
        crossRail.position.set(0, rulerTopY + 0.055,
          zSide * housingOuterHalfWidth);
        crossRail.userData.role = 'wheel-aperture-bearing-cross-rail';
        housing.add(crossRail);
      }
      return markShadows(housing);
    },
  );

  carrier.add(rulerB, rollingAssembly, ...bearingHousings);

  const paper = new THREE.Mesh(
    new THREE.BoxGeometry(10.0, 0.07, 7.2),
    matte(PALETTE.paper, { roughness: 0.98 }),
  );
  paper.position.set(0, paperTopY - 0.035, stroke / 2);
  paper.userData.role = 'paper-contact-plane-for-both-nicked-wheels';
  const paperOutline = new THREE.LineSegments(
    new THREE.EdgesGeometry(paper.geometry),
    new THREE.LineBasicMaterial({ color: 0xc5beb1 }),
  );
  paperOutline.position.copy(paper.position);
  paperOutline.userData.noShadow = true;
  paperOutline.userData.role = 'rolling-ruler-drawing-sheet-outline';
  const guideLineMaterial = new THREE.LineBasicMaterial({
    color: 0xbdb5a8,
    transparent: true,
    opacity: 0.58,
  });
  const guideLines = [0, stroke / 2, stroke].map((z, index) => {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-4.45, paperTopY + 0.006, z),
        new THREE.Vector3(4.45, paperTopY + 0.006, z),
      ]),
      guideLineMaterial,
    );
    line.userData.noShadow = true;
    line.userData.role = `parallel-line-preserved-by-ruler-${index + 1}`;
    return line;
  });
  root.add(paper, paperOutline, ...guideLines, carrier);

  const stateAtTime = (time) => {
    const phase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    const cycleAngle = FULL_TURN * phase;
    let sine = Math.sin(cycleAngle);
    let cosine = Math.cos(cycleAngle);
    if (phase === 0) {
      sine = 0;
      cosine = 1;
    } else if (phase === 0.5) {
      sine = 0;
      cosine = -1;
    }
    const travel = stroke * (1 - cosine) / 2;
    const travelRate = stroke * cycleAngularFrequency * sine / 2;
    const travelAcceleration = stroke * cycleAngularFrequency ** 2
      * cosine / 2;
    const wheelAngle = travel / wheelRadius;
    const wheelAngularVelocity = travelRate / wheelRadius;
    const wheelAngularAcceleration = travelAcceleration / wheelRadius;
    const carrierTranslation = new THREE.Vector3(0, 0, travel);
    const carrierVelocity = new THREE.Vector3(0, 0, travelRate);
    const carrierAcceleration = new THREE.Vector3(
      0,
      0,
      travelAcceleration,
    );
    const wheelState = (station) => ({
      angle: wheelAngle,
      angularAcceleration: new THREE.Vector3(
        wheelAngularAcceleration,
        0,
        0,
      ),
      angularVelocity: new THREE.Vector3(
        wheelAngularVelocity,
        0,
        0,
      ),
      center: new THREE.Vector3(station, wheelCenterY, travel),
      contact: {
        active: true,
        clearance: wheelCenterY - wheelRadius - paperTopY,
        point: new THREE.Vector3(station, paperTopY, travel),
        slipVelocity: new THREE.Vector3(
          0,
          0,
          travelRate - wheelAngularVelocity * wheelRadius,
        ),
      },
    });
    const leftWheel = wheelState(wheelLeftStation);
    const rightWheel = wheelState(wheelRightStation);
    const workingEdgeStart = new THREE.Vector3(
      -rulerLength / 2,
      rulerTopY,
      -rulerWidth / 2 + travel,
    );
    const workingEdgeEnd = new THREE.Vector3(
      rulerLength / 2,
      rulerTopY,
      -rulerWidth / 2 + travel,
    );
    return {
      axle: {
        angle: wheelAngle,
        angularAcceleration: wheelAngularAcceleration,
        angularVelocity: wheelAngularVelocity,
      },
      carrierAcceleration,
      carrierTranslation,
      carrierVelocity,
      cycleAngle,
      leftWheel,
      mode: phase === 0
        ? 'lower-line-turnaround'
        : phase < 0.5
          ? 'rolling-forward-normal-to-ruler'
          : phase === 0.5
            ? 'upper-line-turnaround'
            : 'rolling-backward-normal-to-ruler',
      phase,
      rightWheel,
      travel,
      travelAcceleration,
      travelRate,
      wheelAngle,
      wheelAngularAcceleration,
      wheelAngularVelocity,
      workingEdge: {
        direction: workingEdgeEnd.clone().sub(workingEdgeStart),
        end: workingEdgeEnd,
        parallelCrossResidual: 0,
        start: workingEdgeStart,
        yaw: 0,
      },
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    carrier.position.copy(state.carrierTranslation);
    carrier.rotation.set(0, 0, 0);
    rollingAssembly.rotation.set(state.wheelAngle, 0, 0);
    carrier.userData.velocity = state.carrierVelocity.clone();
    carrier.userData.acceleration = state.carrierAcceleration.clone();
    root.userData.contacts = {
      leftWheelToPaper: state.leftWheel.contact,
      rightWheelToPaper: state.rightWheel.contact,
    };
    root.userData.renderState = state;
  };
  update(0);

  root.userData.archetype =
    'common-axle-nicked-wheel-rolling-parallel-ruler';
  root.userData.blocks = {
    axleC,
    axleEndNuts,
    bearingHousings,
    carrier,
    collarC,
    guideLines,
    paper,
    paperOutline,
    rollingAssembly,
    rulerB,
    wheelALeft,
    wheelARight,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.0, paperTopY - 0.08, -2.2),
    new THREE.Vector3(5.0, wheelCenterY + wheelRadius + 0.14, 4.8),
  );
  root.userData.constraints = {
    commonAxle: 'angle_A_left = angle_C = angle_A_right',
    noSlip: 'travel = wheel_pitch_radius * axle_angle',
    noYaw: 'ruler_yaw = 0',
    twoPointContact: 'both wheel clearances and slip velocities equal zero',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    axleLength,
    axleMarkCStation,
    axleRadius,
    cycleAngularFrequency,
    cyclePeriod,
    housingOuterHalfLength,
    housingOuterHalfWidth,
    paperTopY,
    rulerDepth,
    rulerLength,
    rulerTopY,
    rulerWidth,
    slotHalfLength,
    slotHalfWidth,
    sourceImageHeight,
    sourceImageWidth,
    sourceScaleX,
    sourceScaleZ,
    stroke,
    wheelCenterY,
    wheelLeftStation,
    wheelRadius,
    wheelRightStation,
    wheelWidth,
  };
  root.userData.mechanism =
    'straight ruler B carries journaled axle C with two equal nicked wheels A, A fixed to one rigid rotor; the separated paper contacts roll without slip, forcing B to translate perpendicular to its long edge with zero yaw so every new drawing edge remains parallel';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'Brown supplies straight ruler B, longitudinal axle C, two equal wheels A, A, visible edge nicks, bearing housings, and slight protrusion beneath the ruler. The engraving does not dimension wheel radius, ruler thickness, bearing construction, travel, speed, or timing.',
    sourceUrl: 'https://507movements.com/mm_323.html',
  };
  root.userData.sourcePointToReferenceTop = sourcePointToReferenceTop;
  root.userData.sourceReference = {
    brownPlate323: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one straight ruler B, one common longitudinal axle C in two housings, and two equal nicked wheels A, A rolling on the paper',
      measurementUncertaintyPixels: 6,
      rasterAxleMarkC: sourceRasterAxleMarkC.clone(),
      rasterRectangle: {
        bottomLeft: sourceRasterRectangle.bottomLeft.clone(),
        bottomRight: sourceRasterRectangle.bottomRight.clone(),
        topLeft: sourceRasterRectangle.topLeft.clone(),
        topRight: sourceRasterRectangle.topRight.clone(),
      },
      rasterWheelLeft: sourceRasterWheelLeft.clone(),
      rasterWheelRadius: sourceRasterWheelRadius,
      rasterWheelRight: sourceRasterWheelRight.clone(),
      rasterWheelWidth: sourceRasterWheelWidth,
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 79,
      edition: 21,
      illustrationPage: 78,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cyclePeriod,
    schedule: [
      { event: 'ruler begins at source line', phase: 0 },
      { event: 'maximum forward rolling speed', phase: 0.25 },
      { event: 'ruler reaches parallel offset line', phase: 0.5 },
      { event: 'maximum return rolling speed', phase: 0.75 },
      { event: 'ruler returns to source line', phase: 1 },
    ],
  };
  root.userData.transmission = {
    contactEquation: 'v_contact = v_ruler - omega_C r_A = 0',
    input: 'manual translation of ruler B normal to its long edge',
    output: 'equal rotation of both wheels A and common axle C',
    wheelAnglePerUnitTravel: 1 / wheelRadius,
  };

  markShadows(root);
  for (const object of [paperOutline, ...guideLines]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  finishDrawingRuler(root, [paper, paperOutline, ...guideLines]);
  return {
    cameraDirection: new THREE.Vector3(0, 12, .9),
    root,
    update,
  };
}

function slidingTriangleParallelRuler(movement) {
  const root = new THREE.Group();

  // Brown's source quadrangle measures 428 by 286 pixels.  Using a 6 by 4
  // reference rectangle preserves that observed 3:2 proportion while making
  // the two diagonal translations especially transparent.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterRectangle = {
    bottomLeft: new THREE.Vector2(42, 401),
    bottomRight: new THREE.Vector2(470, 401),
    topLeft: new THREE.Vector2(42, 115),
    topRight: new THREE.Vector2(470, 115),
  };
  const sourceRasterHoleA = new THREE.Vector2(145, 192);
  const sourceRasterHoleB = new THREE.Vector2(366, 332);
  const sourceRasterHoleRadiusA = 25;
  const sourceRasterHoleRadiusB = 26;
  const sourceRasterCenter = new THREE.Vector2(256, 258);
  const sourceScaleX = 6 / 428;
  const sourceScaleZ = 4 / 286;

  const rectangleWidth = 6;
  const rectangleHeight = 4;
  const bottomLeft = new THREE.Vector2(-3, -2);
  const bottomRight = new THREE.Vector2(3, -2);
  const topLeft = new THREE.Vector2(-3, 2);
  const topRight = new THREE.Vector2(3, 2);
  const diagonal = topRight.clone().sub(bottomLeft);
  const diagonalLength = diagonal.length();
  const diagonalUnit = diagonal.clone().normalize();
  const diagonalNormal = new THREE.Vector2(
    -diagonalUnit.y,
    diagonalUnit.x,
  );
  const maximumPieceTravel = diagonalLength / 6;
  const minimumOverlapLength = diagonalLength * 2 / 3;
  const plateDepth = 0.28;
  const plateTopY = plateDepth / 2;
  const demonstrationPeriod = 5;
  const outwardEndPhase = 0.40;
  const outwardHoldEndPhase = 0.50;
  const returnEndPhase = 0.90;
  const transitionDuration = demonstrationPeriod * outwardEndPhase;

  const sourcePointToReferenceFront = (point) => new THREE.Vector3(
    (point.x - sourceRasterCenter.x) * sourceScaleX,
    plateTopY,
    -(point.y - sourceRasterCenter.y) * sourceScaleZ,
  );
  const holeCenterAWorld = sourcePointToReferenceFront(sourceRasterHoleA);
  const holeCenterBWorld = sourcePointToReferenceFront(sourceRasterHoleB);
  const holeCenterA = new THREE.Vector2(
    holeCenterAWorld.x,
    holeCenterAWorld.z,
  );
  const holeCenterB = new THREE.Vector2(
    holeCenterBWorld.x,
    holeCenterBWorld.z,
  );
  const holeRadiusA = sourceRasterHoleRadiusA
    * (sourceScaleX + sourceScaleZ) / 2;
  const holeRadiusB = sourceRasterHoleRadiusB
    * (sourceScaleX + sourceScaleZ) / 2;

  // A is the upper-left half and B the lower-right half, exactly as labelled
  // in the engraving.  Both shapes use counter-clockwise winding.
  const triangleAVertices = [bottomLeft, topRight, topLeft];
  const triangleBVertices = [bottomLeft, bottomRight, topRight];
  const pieceA = makeTriangularPlate({
    color: PALETTE.driven,
    depth: plateDepth,
    holeCenter: holeCenterA,
    holeRadius: holeRadiusA,
    role: 'upper-left-right-triangle-A',
    vertices: triangleAVertices,
  });
  const pieceB = makeTriangularPlate({
    color: PALETTE.driver,
    depth: plateDepth,
    holeCenter: holeCenterB,
    holeRadius: holeRadiusB,
    role: 'lower-right-right-triangle-B',
    vertices: triangleBVertices,
  });

  const inset = 0.075;
  const endInset = 0.055;
  const aSeamStart = bottomLeft.clone()
    .addScaledVector(diagonalUnit, endInset)
    .addScaledVector(diagonalNormal, inset);
  const aSeamEnd = topRight.clone()
    .addScaledVector(diagonalUnit, -endInset)
    .addScaledVector(diagonalNormal, inset);
  const bSeamStart = bottomLeft.clone()
    .addScaledVector(diagonalUnit, endInset)
    .addScaledVector(diagonalNormal, -inset);
  const bSeamEnd = topRight.clone()
    .addScaledVector(diagonalUnit, -endInset)
    .addScaledVector(diagonalNormal, -inset);
  const seamA = addInsetBand(
    pieceA,
    aSeamStart,
    aSeamEnd,
    'visible-contact-edge-on-hypotenuse-A',
    plateTopY + 0.025,
  );
  const seamB = addInsetBand(
    pieceB,
    bSeamStart,
    bSeamEnd,
    'visible-contact-edge-on-hypotenuse-B',
    plateTopY + 0.027,
  );
  const workingEdgeA = addInsetBand(
    pieceA,
    topLeft.clone().add(new THREE.Vector2(0.04, -0.06)),
    topRight.clone().add(new THREE.Vector2(-0.04, -0.06)),
    'parallel-drawing-edge-of-triangle-A',
    plateTopY + 0.025,
    0.045,
  );
  const workingEdgeB = addInsetBand(
    pieceB,
    bottomLeft.clone().add(new THREE.Vector2(0.04, 0.06)),
    bottomRight.clone().add(new THREE.Vector2(-0.04, 0.06)),
    'parallel-drawing-edge-of-triangle-B',
    plateTopY + 0.025,
    0.045,
  );

  const paperTopY = -plateDepth / 2 - 0.055;
  const paper = new THREE.Mesh(
    new THREE.BoxGeometry(9.2, 0.07, 6.8),
    matte(PALETTE.paper, { roughness: 0.98 }),
  );
  paper.position.y = paperTopY - 0.035;
  paper.userData.role = 'drawing-sheet-beneath-parallel-ruler';
  const paperOutline = new THREE.LineSegments(
    new THREE.EdgesGeometry(paper.geometry),
    new THREE.LineBasicMaterial({ color: 0xc5beb1 }),
  );
  paperOutline.position.copy(paper.position);
  paperOutline.userData.noShadow = true;
  paperOutline.userData.role = 'drawing-sheet-outline';

  const guideLineMaterial = new THREE.LineBasicMaterial({
    color: 0xc9c2b6,
    transparent: true,
    opacity: 0.56,
  });
  const guideLines = [-2, -4 / 3, 4 / 3, 2].map((z, index) => {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-4.25, paperTopY + 0.005, z),
        new THREE.Vector3(4.25, paperTopY + 0.005, z),
      ]),
      guideLineMaterial,
    );
    line.userData.noShadow = true;
    line.userData.role = `parallel-pencil-reference-line-${index + 1}`;
    return line;
  });

  root.add(paper, paperOutline, ...guideLines, pieceA, pieceB);

  const motionAtPhase = (phase) => {
    if (phase <= outwardEndPhase) {
      const progress = phase / outwardEndPhase;
      return {
        acceleration: maximumPieceTravel
          * smootherstepSecond(progress) / transitionDuration ** 2,
        mode: 'sliding-apart-along-coincident-hypotenuses',
        normalizedProgress: progress,
        rate: maximumPieceTravel
          * smootherstepFirst(progress) / transitionDuration,
        travel: maximumPieceTravel * smootherstep(progress),
      };
    }
    if (phase <= outwardHoldEndPhase) {
      return {
        acceleration: 0,
        mode: 'holding-maximum-parallel-offset',
        normalizedProgress: 1,
        rate: 0,
        travel: maximumPieceTravel,
      };
    }
    if (phase <= returnEndPhase) {
      const progress = (phase - outwardHoldEndPhase)
        / (returnEndPhase - outwardHoldEndPhase);
      return {
        acceleration: -maximumPieceTravel
          * smootherstepSecond(progress) / transitionDuration ** 2,
        mode: 'sliding-together-along-coincident-hypotenuses',
        normalizedProgress: progress,
        rate: -maximumPieceTravel
          * smootherstepFirst(progress) / transitionDuration,
        travel: maximumPieceTravel * (1 - smootherstep(progress)),
      };
    }
    return {
      acceleration: 0,
      mode: 'holding-reassembled-quadrangle',
      normalizedProgress: 1,
      rate: 0,
      travel: 0,
    };
  };

  const stateAtTime = (time) => {
    const phase = positiveModulo(time, demonstrationPeriod)
      / demonstrationPeriod;
    const motion = motionAtPhase(phase);
    const displacementAPlanar = diagonalUnit.clone()
      .multiplyScalar(-motion.travel);
    const displacementBPlanar = diagonalUnit.clone()
      .multiplyScalar(motion.travel);
    const velocityAPlanar = diagonalUnit.clone()
      .multiplyScalar(-motion.rate);
    const velocityBPlanar = diagonalUnit.clone()
      .multiplyScalar(motion.rate);
    const accelerationAPlanar = diagonalUnit.clone()
      .multiplyScalar(-motion.acceleration);
    const accelerationBPlanar = diagonalUnit.clone()
      .multiplyScalar(motion.acceleration);

    const aHypotenuseStart = translatedPoint(
      bottomLeft,
      displacementAPlanar,
    );
    const aHypotenuseEnd = translatedPoint(
      topRight,
      displacementAPlanar,
    );
    const bHypotenuseStart = translatedPoint(
      bottomLeft,
      displacementBPlanar,
    );
    const bHypotenuseEnd = translatedPoint(
      topRight,
      displacementBPlanar,
    );
    const overlapStart = bHypotenuseStart.clone();
    const overlapEnd = aHypotenuseEnd.clone();
    const aTopStart = translatedPoint(topLeft, displacementAPlanar);
    const aTopEnd = translatedPoint(topRight, displacementAPlanar);
    const bBottomStart = translatedPoint(bottomLeft, displacementBPlanar);
    const bBottomEnd = translatedPoint(bottomRight, displacementBPlanar);
    const aEdgeDirection = aTopEnd.clone().sub(aTopStart);
    const bEdgeDirection = bBottomEnd.clone().sub(bBottomStart);
    const aHypotenuseDirection = aHypotenuseEnd.clone()
      .sub(aHypotenuseStart);
    const bHypotenuseDirection = bHypotenuseEnd.clone()
      .sub(bHypotenuseStart);

    return {
      contact: {
        active: true,
        aHypotenuse: {
          end: planarToWorld(aHypotenuseEnd, 0),
          start: planarToWorld(aHypotenuseStart, 0),
        },
        bHypotenuse: {
          end: planarToWorld(bHypotenuseEnd, 0),
          start: planarToWorld(bHypotenuseStart, 0),
        },
        coincidentLineResidual: displacementBPlanar.clone()
          .sub(displacementAPlanar).dot(diagonalNormal),
        directionCrossResidual: aHypotenuseDirection.x
          * bHypotenuseDirection.y
          - aHypotenuseDirection.y * bHypotenuseDirection.x,
        normal: planarToWorld(diagonalNormal),
        overlapEnd: planarToWorld(overlapEnd, 0),
        overlapLength: overlapEnd.distanceTo(overlapStart),
        overlapStart: planarToWorld(overlapStart, 0),
        relativeSlidingSpeed: 2 * motion.rate,
        tangent: planarToWorld(diagonalUnit),
      },
      mode: motion.mode,
      normalizedProgress: motion.normalizedProgress,
      phase,
      pieceA: {
        acceleration: planarToWorld(accelerationAPlanar),
        holeCenter: planarToWorld(
          translatedPoint(holeCenterA, displacementAPlanar),
          plateTopY,
        ),
        hypotenuse: {
          end: planarToWorld(aHypotenuseEnd),
          start: planarToWorld(aHypotenuseStart),
        },
        rotation: 0,
        translation: planarToWorld(displacementAPlanar),
        velocity: planarToWorld(velocityAPlanar),
        vertices: triangleAVertices.map((point) => planarToWorld(
          translatedPoint(point, displacementAPlanar),
        )),
        workingEdge: {
          direction: planarToWorld(aEdgeDirection),
          end: planarToWorld(aTopEnd),
          start: planarToWorld(aTopStart),
        },
      },
      pieceB: {
        acceleration: planarToWorld(accelerationBPlanar),
        holeCenter: planarToWorld(
          translatedPoint(holeCenterB, displacementBPlanar),
          plateTopY,
        ),
        hypotenuse: {
          end: planarToWorld(bHypotenuseEnd),
          start: planarToWorld(bHypotenuseStart),
        },
        rotation: 0,
        translation: planarToWorld(displacementBPlanar),
        velocity: planarToWorld(velocityBPlanar),
        vertices: triangleBVertices.map((point) => planarToWorld(
          translatedPoint(point, displacementBPlanar),
        )),
        workingEdge: {
          direction: planarToWorld(bEdgeDirection),
          end: planarToWorld(bBottomEnd),
          start: planarToWorld(bBottomStart),
        },
      },
      rigidBodyCenterSum: planarToWorld(
        displacementAPlanar.clone().add(displacementBPlanar),
      ),
      travel: motion.travel,
      travelAcceleration: motion.acceleration,
      travelRate: motion.rate,
      workingEdges: {
        directionCrossResidual: aEdgeDirection.x * bEdgeDirection.y
          - aEdgeDirection.y * bEdgeDirection.x,
        separation: aTopStart.y - bBottomStart.y,
      },
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    pieceA.position.copy(state.pieceA.translation);
    pieceB.position.copy(state.pieceB.translation);
    pieceA.rotation.set(0, 0, 0);
    pieceB.rotation.set(0, 0, 0);
    pieceA.userData.velocity = state.pieceA.velocity.clone();
    pieceB.userData.velocity = state.pieceB.velocity.clone();
    pieceA.userData.acceleration = state.pieceA.acceleration.clone();
    pieceB.userData.acceleration = state.pieceB.acceleration.clone();
    root.userData.contacts = {
      slidingHypotenuses: state.contact,
    };
    root.userData.renderState = state;
  };
  update(0);

  root.userData.archetype =
    'sliding-triangle-diagonal-contact-parallel-ruler';
  root.userData.blocks = {
    guideLines,
    paper,
    paperOutline,
    pieceA,
    pieceB,
    seamA,
    seamB,
    workingEdgeA,
    workingEdgeB,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.35, -0.25, -3.05),
    new THREE.Vector3(4.35, 0.28, 3.05),
  );
  root.userData.constraints = {
    centerBalance: 'translation_A + translation_B = 0',
    contact: 'normal dot (translation_B - translation_A) = 0',
    noRotation: 'rotation_A = rotation_B = 0',
    overlap: 'L_overlap = L_diagonal - 2 travel',
    parallelEdges: 'top_edge_A cross bottom_edge_B = 0',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    bottomLeft: bottomLeft.clone(),
    bottomRight: bottomRight.clone(),
    demonstrationPeriod,
    diagonal: diagonal.clone(),
    diagonalLength,
    diagonalNormal: diagonalNormal.clone(),
    diagonalUnit: diagonalUnit.clone(),
    holeCenterA: holeCenterA.clone(),
    holeCenterB: holeCenterB.clone(),
    holeRadiusA,
    holeRadiusB,
    maximumPieceTravel,
    minimumOverlapLength,
    outwardEndPhase,
    outwardHoldEndPhase,
    plateDepth,
    rectangleHeight,
    rectangleWidth,
    returnEndPhase,
    sourceImageHeight,
    sourceImageWidth,
    sourceScaleX,
    sourceScaleZ,
    topLeft: topLeft.clone(),
    topRight: topRight.clone(),
    transitionDuration,
    triangleAVertices: triangleAVertices.map((point) => point.clone()),
    triangleBVertices: triangleBVertices.map((point) => point.clone()),
  };
  root.userData.mechanism =
    'one rectangular quadrangle is cut once on its diagonal into right triangles A and B; A and B undergo equal opposite pure translations tangent to their coincident hypotenuses, so their straight outer working edges remain parallel at every offset';
  root.userData.sourceAnimation = {
    available: true,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialKeyframes: [
      { phase: 0, upperA: new THREE.Vector2(0, 0), lowerB: new THREE.Vector2(0, 0) },
      { phase: 0.4, upperA: new THREE.Vector2(-0.833333, -0.5), lowerB: new THREE.Vector2(0.833333, 0.5) },
      { phase: 0.5, upperA: new THREE.Vector2(-0.833333, -0.5), lowerB: new THREE.Vector2(0.833333, 0.5) },
      { phase: 0.9, upperA: new THREE.Vector2(0, 0), lowerB: new THREE.Vector2(0, 0) },
      { phase: 1, upperA: new THREE.Vector2(0, 0), lowerB: new THREE.Vector2(0, 0) },
    ],
    officialNormalizedGeometry: {
      height: 3,
      lowerBHole: new THREE.Vector2(4, 0.73),
      upperAHole: new THREE.Vector2(1, 2.27),
      width: 5,
    },
    officialPageAnimatedTabDisabled: false,
    referenceScope: 'The source canvas confirms a 5 by 3 quadrangle, the two handling circles, equal opposite one-sixth-diagonal translations, and move/hold/return/hold keyframes at phases 0, 0.4, 0.5, 0.9, and 1. Plate thickness, material, and interpolation easing are not dimensioned; this reconstruction uses C2-continuous easing to prevent endpoint jerk.',
    sourceUrl: 'https://507movements.com/mm_322.html',
  };
  root.userData.sourcePointToReferenceFront = sourcePointToReferenceFront;
  root.userData.sourceReference = {
    brownPlate322: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one quadrangle cut on bottom-left to top-right diagonal, with upper-left triangle A and lower-right triangle B retaining their own circular handling holes',
      measurementUncertaintyPixels: 5,
      rasterHoleA: sourceRasterHoleA.clone(),
      rasterHoleB: sourceRasterHoleB.clone(),
      rasterHoleRadiusA: sourceRasterHoleRadiusA,
      rasterHoleRadiusB: sourceRasterHoleRadiusB,
      rasterRectangle: {
        bottomLeft: sourceRasterRectangle.bottomLeft.clone(),
        bottomRight: sourceRasterRectangle.bottomRight.clone(),
        topLeft: sourceRasterRectangle.topLeft.clone(),
        topRight: sourceRasterRectangle.topRight.clone(),
      },
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 79,
      edition: 21,
      illustrationPage: 78,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod,
    schedule: [
      { event: 'reassembled quadrangle begins opening', phase: 0 },
      { event: 'maximum offset reached', phase: outwardEndPhase },
      { event: 'maximum-offset hold ends', phase: outwardHoldEndPhase },
      { event: 'reassembled quadrangle reached', phase: returnEndPhase },
      { event: 'reassembled hold closes cycle', phase: 1 },
    ],
  };
  root.userData.transmission = {
    input: 'manual translation of either triangular half along the diagonal',
    output: 'parallel translation of the opposite working edge',
    relativeTravelRatio: -1,
  };

  markShadows(root);
  for (const object of [paperOutline, ...guideLines]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  finishDrawingRuler(root, [paper, paperOutline, ...guideLines, seamA, seamB, workingEdgeA, workingEdgeB]);
  return {
    cameraDirection: new THREE.Vector3(0, 12, .9),
    root,
    update,
  };
}

function graduatedArcParallelRuler(movement) {
  const root = new THREE.Group();
  const demonstrationPeriod = 8;
  const cycleRate = FULL_TURN / demonstrationPeriod;
  const linkLength = 1.60;
  const minimumLinkAngle = THREE.MathUtils.degToRad(116);
  const maximumLinkAngle = THREE.MathUtils.degToRad(145);
  const sourceLinkAngle = THREE.MathUtils.degToRad(119);
  const meanLinkAngle = (minimumLinkAngle + maximumLinkAngle) / 2;
  const linkAngleAmplitude = (maximumLinkAngle - minimumLinkAngle) / 2;
  const sourcePhaseAngle = Math.acos(
    (meanLinkAngle - sourceLinkAngle) / linkAngleAmplitude,
  );
  const bladeLength = 4.82;
  const bladeWidth = 0.48;
  const bladeThickness = 0.14;
  const lowerBladeCenterZ = -0.58;
  const lowerPivotXs = [-1.05, 1.55];
  const upperPivotLocalOffsetX = 0.82;
  const upperPivotLocalXs = lowerPivotXs.map(
    (position) => position - upperPivotLocalOffsetX,
  );
  const arcPivot = new THREE.Vector3(0.62, 0.205, lowerBladeCenterZ);
  const arcHeight = 0.205;
  const scaleEdgeInset = 0.018;
  // Ideal circle fitted to the visible arc contour (367 contour 21), rounded
  // slightly to keep one unambiguous scale crossing throughout the travel.
  const arcRadius = 1.28;
  const arcSweep = THREE.MathUtils.degToRad(103);
  const arcParameterAtRise = rise => Math.asin(THREE.MathUtils.clamp(rise / arcRadius, 0, 1)) / arcSweep;
  const arcXAtParameter = parameter => arcPivot.x + arcRadius * (Math.cos(parameter * arcSweep) - 1);
  const arcRiseAtParameter = parameter => arcRadius * Math.sin(parameter * arcSweep);
  const upperBladePositionAtAngle = (angle) => new THREE.Vector3(
    upperPivotLocalOffsetX + linkLength * Math.cos(angle),
    0.035,
    lowerBladeCenterZ + linkLength * Math.sin(angle),
  );
  const bladeGapAtAngle = (angle) => linkLength * Math.sin(angle)
    - bladeWidth;
  const scaleIncidenceAtAngle = (angle) => {
    const upperPosition = upperBladePositionAtAngle(angle);
    const scaleWorldZ = upperPosition.z - bladeWidth / 2
      + scaleEdgeInset;
    const rise = scaleWorldZ - arcPivot.z;
    const arcParameter = arcParameterAtRise(rise);
    const worldPoint = new THREE.Vector3(
      arcXAtParameter(arcParameter),
      arcHeight,
      scaleWorldZ,
    );
    return {
      arcParameter,
      localScaleX: worldPoint.x - upperPosition.x,
      rise,
      upperPosition,
      worldPoint,
    };
  };
  const minimumBladeGap = bladeGapAtAngle(maximumLinkAngle);
  const maximumBladeGap = bladeGapAtAngle(minimumLinkAngle);
  const linkAngleAtGap = (gap) => Math.PI - Math.asin(
    THREE.MathUtils.clamp((gap + bladeWidth) / linkLength, -1, 1),
  );
  const scaleXAtGap = (gap) => scaleIncidenceAtAngle(
    linkAngleAtGap(gap),
  ).localScaleX;
  const scaleTickCount = 11;
  const scaleCalibration = Array.from(
    { length: scaleTickCount },
    (_, index) => {
      const fraction = index / (scaleTickCount - 1);
      const gap = THREE.MathUtils.lerp(
        minimumBladeGap,
        maximumBladeGap,
        fraction,
      );
      return {
        fraction,
        gap,
        localX: scaleXAtGap(gap),
      };
    },
  );
  const scaleMinimumX = Math.min(
    ...scaleCalibration.map(({ localX }) => localX),
  );
  const scaleMaximumX = Math.max(
    ...scaleCalibration.map(({ localX }) => localX),
  );

  const arcCurve = new class extends THREE.Curve {
    getPoint(parameter, target = new THREE.Vector3()) {
      const u = THREE.MathUtils.clamp(parameter, 0, 1);
      return target.set(
        arcXAtParameter(u),
        arcHeight,
        arcPivot.z + arcRiseAtParameter(u),
      );
    }
  }();
  arcCurve.arcLengthDivisions = 180;

  const stateAtTime = (time) => {
    const cyclePhase = positiveModulo(time / demonstrationPeriod, 1);
    const phaseAngle = sourcePhaseAngle + FULL_TURN * cyclePhase;
    const linkAngle = THREE.MathUtils.clamp(meanLinkAngle
      - linkAngleAmplitude * Math.cos(phaseAngle), minimumLinkAngle, maximumLinkAngle);
    const linkAngularSpeed = linkAngleAmplitude * cycleRate
      * Math.sin(phaseAngle);
    const linkAngularAcceleration = linkAngleAmplitude * cycleRate ** 2
      * Math.cos(phaseAngle);
    const upperBladePosition = upperBladePositionAtAngle(linkAngle);
    const upperBladeVelocity = new THREE.Vector3(
      -linkLength * Math.sin(linkAngle) * linkAngularSpeed,
      0,
      linkLength * Math.cos(linkAngle) * linkAngularSpeed,
    );
    const upperBladeAcceleration = new THREE.Vector3(
      -linkLength * (
        Math.cos(linkAngle) * linkAngularSpeed ** 2
        + Math.sin(linkAngle) * linkAngularAcceleration
      ),
      0,
      linkLength * (
        -Math.sin(linkAngle) * linkAngularSpeed ** 2
        + Math.cos(linkAngle) * linkAngularAcceleration
      ),
    );
    const bladeGap = bladeGapAtAngle(linkAngle);
    const bladeGapRate = linkLength * Math.cos(linkAngle)
      * linkAngularSpeed;
    const incidence = scaleIncidenceAtAngle(linkAngle);
    const lowerLinkPoints = lowerPivotXs.map((x) => new THREE.Vector3(
      x,
      0.17,
      lowerBladeCenterZ,
    ));
    const upperLinkPoints = lowerLinkPoints.map((point) => new THREE.Vector3(
      point.x + linkLength * Math.cos(linkAngle),
      point.y,
      point.z + linkLength * Math.sin(linkAngle),
    ));
    const stage = Math.abs(linkAngularSpeed) < 1e-10
      ? linkAngle < meanLinkAngle
        ? 'maximum-blade-opening-reversal'
        : 'minimum-blade-opening-reversal'
      : bladeGapRate > 0
        ? 'opening-blades-while-reading-scale'
        : 'closing-blades-while-reading-scale';
    return {
      bladeGap,
      bladeGapRate,
      cyclePhase,
      incidenceArcParameter: incidence.arcParameter,
      incidencePoint: incidence.worldPoint,
      incidenceRise: incidence.rise,
      linkAngle,
      linkAngularAcceleration,
      linkAngularSpeed,
      lowerLinkPoints,
      scaleReading: bladeGap,
      scaleReadingLocalX: incidence.localScaleX,
      stage,
      upperBladeAcceleration,
      upperBladePosition,
      upperBladeVelocity,
      upperLinkPoints,
    };
  };

  const bladeMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.60,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.27,
    roughness: 0.47,
  });
  const linkMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.55,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.33,
    roughness: 0.40,
  });
  const ivoryMaterial = matte(PALETTE.white, {
    metalness: 0.02,
    roughness: 0.56,
  });

  const makeBlade = (role, pivotXs) => {
    const group = new THREE.Group();
    group.userData.role = role;
    const body = new THREE.Mesh(
      plate(polygonClipping.difference(poly([[-bladeLength/2, -bladeWidth/2], [bladeLength/2, -bladeWidth/2], [bladeLength/2, bladeWidth/2], [-bladeLength/2, bladeWidth/2]]),
        ...pivotXs.map(x => poly(circle([x, 0], .089, 64)))), -bladeThickness/2, bladeThickness/2).rotateX(Math.PI / 2),
      bladeMaterial,
    );
    body.userData.role = `${role}-straight-rigid-body`;
    group.add(body);
    const edgeRails = [-1, 1].map((side) => {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(
          bladeLength,
          bladeThickness + 0.020,
          0.038,
        ),
        darkMaterial,
      );
      rail.position.z = side * bladeWidth / 2;
      rail.userData.role = `${role}-straight-drawing-edge`;
      rail.visible = false; // ink edge line only: kept for references, not drawn
      rail.userData.retiredInkOutline = true;
      rail.userData.side = side;
      group.add(rail);
      return rail;
    });
    group.userData.body = body;
    group.userData.edgeRails = edgeRails;
    return group;
  };

  const lowerBlade = makeBlade('fixed-lower-ruler-blade', lowerPivotXs);
  lowerBlade.position.set(0, 0.035, lowerBladeCenterZ);
  lowerBlade.userData.fixed = true;
  root.add(lowerBlade);
  const upperBlade = makeBlade('translating-upper-ruler-blade', upperPivotLocalXs);
  root.add(upperBlade);

  // Brown's reading is where the arc's outer edge falls on the ivory. Near
  // full opening the arc runs almost tangent to the scale edge, so its band
  // lies across the strip well left of the calibrated incidence point; the
  // strip is carried left until the arc band (and its rounded tip) meets
  // ivory over the whole travel.
  const stripNearZ = -bladeWidth / 2 + 0.078 - 0.0675;
  const stripFarZ = -bladeWidth / 2 + 0.078 + 0.0675;
  let arcOverStripMinimumX = scaleMinimumX;
  for (let a = 0; a <= 32; a += 1) {
    const angle = THREE.MathUtils.lerp(minimumLinkAngle, maximumLinkAngle, a / 32);
    const upper = upperBladePositionAtAngle(angle);
    for (let k = 0; k <= 720; k += 1) {
      const theta = arcSweep * k / 720;
      for (const radius of [arcRadius - 0.06, arcRadius - 0.03, arcRadius]) {
        const x = arcPivot.x - arcRadius + radius * Math.cos(theta);
        const z = arcPivot.z + radius * Math.sin(theta) - upper.z;
        if (z >= stripNearZ && z <= stripFarZ) {
          arcOverStripMinimumX = Math.min(arcOverStripMinimumX, x - upper.x);
        }
      }
    }
    const tipCentreX = arcPivot.x + arcRadius * (Math.cos(arcSweep) - 1) - 0.03;
    const tipZ = arcPivot.z + arcRadius * Math.sin(arcSweep) - upper.z;
    if (tipZ + 0.055 >= stripNearZ && tipZ - 0.055 <= stripFarZ) {
      arcOverStripMinimumX = Math.min(arcOverStripMinimumX, tipCentreX - 0.055 - upper.x);
    }
  }
  const scaleLeftX = Math.min(scaleMinimumX - 0.12, arcOverStripMinimumX - 0.06);
  const scaleRightX = scaleMaximumX + 0.12;
  const scaleLength = scaleRightX - scaleLeftX;
  const ivoryScale = new THREE.Mesh(
    new THREE.BoxGeometry(scaleLength, 0.035, 0.135),
    ivoryMaterial,
  );
  ivoryScale.position.set(
    (scaleLeftX + scaleRightX) / 2,
    bladeThickness / 2 + 0.026,
    -bladeWidth / 2 + 0.078,
  );
  ivoryScale.userData.role =
    'graduated-ivory-scale-on-lower-edge-of-upper-blade';
  upperBlade.add(ivoryScale);
  const scaleTicks = scaleCalibration.map((calibration, index) => {
    const major = index === 0
      || index === scaleTickCount - 1
      || index === Math.floor((scaleTickCount - 1) / 2);
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.026, major ? 0.112 : 0.075),
      darkMaterial,
    );
    tick.position.set(
      calibration.localX,
      bladeThickness / 2 + 0.048,
      -bladeWidth / 2 + 0.078,
    );
    tick.userData.bladeGap = calibration.gap;
    tick.userData.calibrationFraction = calibration.fraction;
    tick.userData.index = index;
    tick.userData.role = major
      ? 'major-distance-graduation-on-ivory-scale'
      : 'minor-distance-graduation-on-ivory-scale';
    upperBlade.add(tick);
    return tick;
  });
  // The ivory strip is shown plain: at this scale Brown's hatched
  // divisions read only as faint marks (painted or finely incised alike),
  // so no division is drawn. The tick bars stay as hidden calibration
  // references for the arc's incidence reading.
  {
    const bottom = bladeThickness / 2, base = bottom + 0.018, top = bottom + 0.032;
    const zCenter = -bladeWidth / 2 + 0.078, halfWidth = 0.0675;
    const x0 = scaleLeftX;
    const x1 = scaleRightX;
    const strip = poly([[x0, zCenter - halfWidth], [x1, zCenter - halfWidth], [x1, zCenter + halfWidth], [x0, zCenter + halfWidth]]);
    const face = strip;
    for (const tick of scaleTicks) {
      tick.visible = false;
      tick.userData.retiredPaintedTick = true;
    }
    // plate() extrudes along +z; rotateX(pi/2) turns plate y into world z and
    // the extrusion into -y, so heights are passed negated.
    const baseLayer = plate(strip, -base, -bottom).rotateX(Math.PI / 2);
    const faceLayer = plate(face, -top, -base).rotateX(Math.PI / 2);
    const merged = mergeGeometries([baseLayer, faceLayer]);
    merged.computeVertexNormals();
    ivoryScale.geometry.dispose();
    ivoryScale.geometry = merged;
    // Ivory, not paper white: a plain warm cream strip.
    ivoryScale.material = ivoryMaterial.clone();
    ivoryScale.material.color.set(0xe3d6b4);
    ivoryScale.position.set(0, 0, 0);
  }

  const makeDecorativeLink = (index) => {
    const group = new THREE.Group();
    group.position.set(
      lowerPivotXs[index],
      0.17,
      lowerBladeCenterZ,
    );
    group.userData.axis = new THREE.Vector3(0, 1, 0);
    group.userData.index = index;
    group.userData.role =
      'one-of-two-equal-parallel-ornamental-link-arms';
    const arm = new THREE.Mesh(
      ornamentalRulerArmGeometry(367, linkLength, .10, .089).rotateX(Math.PI / 2),
      linkMaterial,
    );
    arm.position.y = .13;
    arm.userData.role = 'bored-extracted-outline-of-parallel-link';
    group.add(arm);
    const pivotBosses = [0, linkLength].map((x, end) => {
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(.085, .085, .44, 48), darkMaterial);
      pin.position.x = x;
      pin.userData.end = end === 0 ? 'lower-blade' : 'upper-blade';
      pin.userData.role = 'through-pin-of-parallel-link';
      group.add(pin);
      return pin;
    });
    group.userData.arm = arm;
    group.userData.pivotBosses = pivotBosses;
    return group;
  };
  const parallelLinks = [0, 1].map((index) => {
    const link = makeDecorativeLink(index);
    root.add(link);
    return link;
  });

  // The calibrated circle is the visible outer edge, not the center of
  // a thick tube. A flat strip below the links keeps the reading unobscured.
  const arcPoints = Array.from({ length: 181 }, (_, i) => {
    const p = arcCurve.getPoint(i / 180); return [p.x, p.z];
  });
  const arcOutline = polygonClipping.union(poly([...arcPoints,
    ...arcPoints.slice().reverse().map(([x, z]) => [arcPivot.x - arcRadius + (x - arcPivot.x + arcRadius) * (arcRadius - .06) / arcRadius,
      arcPivot.z + (z - arcPivot.z) * (arcRadius - .06) / arcRadius])]),
    poly(circle([arcPivot.x - .03, arcPivot.z], .10, 48)));
  const brassArc = new THREE.Mesh(plate(polygonClipping.difference(arcOutline,
    poly(circle([arcPivot.x - .03, arcPivot.z], .044, 48))), -.0175, .0175).rotateX(Math.PI / 2), brassMaterial);
  brassArc.position.y = arcHeight;
  brassArc.userData.role = 'fixed-to-lower-blade-brass-arc-crossing-graduated-scale';
  root.add(brassArc);
  const brassArcPivot = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .25, 32), darkMaterial);
  // The pin is centred in the arc's rounded lower end (the band's centre
  // line, 0.03 inside the calibrated outer edge), where its bore is.
  brassArcPivot.position.set(arcPivot.x - .03, .12, arcPivot.z);
  brassArcPivot.userData.role = 'fastening-pivot-of-brass-indicating-arc-on-lower-blade';
  root.add(brassArcPivot);
  const tip = arcCurve.getPoint(1);
  const brassArcTip = new THREE.Mesh(plate(polygonClipping.difference(
    poly(circle([tip.x - .03, tip.z], .055, 48)), poly(circle([tip.x - .03, tip.z], .025, 48))),
  -.0175, .0175).rotateX(Math.PI / 2), brassMaterial);
  brassArcTip.position.y = arcHeight;
  brassArcTip.userData.role = 'rounded-free-end-of-brass-indicating-arc';
  root.add(brassArcTip);

  const update = (time) => {
    const state = stateAtTime(time);
    upperBlade.position.copy(state.upperBladePosition);
    parallelLinks.forEach((link) => {
      link.rotation.y = -state.linkAngle;
    });
    root.userData.currentState = state;
    root.userData.constraints = {
      arcScaleIncidence: {
        arcParameter: state.incidenceArcParameter,
        incidencePoint: state.incidencePoint.clone(),
        scaleEdgeZ: upperBlade.position.z - bladeWidth / 2
          + scaleEdgeInset,
        scaleReading: state.scaleReading,
        scaleReadingLocalX: state.scaleReadingLocalX,
      },
      parallelBlades: {
        lowerDirection: new THREE.Vector3(1, 0, 0),
        rotationDifference: Math.abs(upperBlade.rotation.y
          - lowerBlade.rotation.y),
        upperDirection: new THREE.Vector3(1, 0, 0),
      },
      parallelLinks: state.lowerLinkPoints.map((point, index) => ({
        endpointError: point.distanceTo(
          state.upperLinkPoints[index],
        ) - linkLength,
        lowerPoint: point.clone(),
        upperPoint: state.upperLinkPoints[index].clone(),
      })),
    };
  };

  root.userData = {
    archetype:
      'graduated-ivory-scale-brass-arc-two-link-parallel-ruler',
    blocks: {
      brassArc,
      brassArcPivot,
      brassArcTip,
      ivoryScale,
      lowerBlade,
      parallelLinks,
      scaleTicks,
      upperBlade,
    },
    calibration: {
      linkAngleAtGap,
      scaleCalibration,
      scaleXAtGap,
    },
    curves: {
      brassArc: arcCurve,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      input: 'manual opening angle of either one of the two equal links',
      note:
        'the second equal link removes relative blade rotation, leaving one parallel-translation coordinate; the brass arc is an indicator, not a third pinned link',
      storedEnergyStates: 0,
    },
    dynamics: {
      sourceSpecifiesTimingMassOrFriction: false,
      treatment:
        'the harmonic opening cycle is only a smooth manual demonstration; the historical instrument is a position-setting device',
    },
    fidelity: 'authored',
    geometry: {
      arcHeight,
      arcPivot: arcPivot.clone(),
      arcRadius,
      arcSweep,
      bladeLength,
      bladeThickness,
      bladeWidth,
      demonstrationPeriod,
      linkAngleAmplitude,
      linkLength,
      lowerBladeCenterZ,
      lowerPivotXs: [...lowerPivotXs],
      maximumBladeGap,
      maximumLinkAngle,
      meanLinkAngle,
      minimumBladeGap,
      minimumLinkAngle,
      scaleEdgeInset,
      scaleMaximumX,
      scaleMinimumX,
      scaleTickCount,
      sourceLinkAngle,
      sourcePhaseAngle,
      upperPivotLocalOffsetX,
      upperPivotLocalXs: [...upperPivotLocalXs],
    },
    incidenceGeometry: {
      arcParameterAtRise,
      arcRiseAtParameter,
      arcXAtParameter,
      bladeGapAtAngle,
      scaleIncidenceAtAngle,
      upperBladePositionAtAngle,
    },
    mechanism:
      'two-straight-parallel-ruler-blades-joined-by-two-equal-parallel-links-with-a-lower-blade-brass-arc-reading-separation-on-the-upper-blade-ivory-scale',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate367: {
        brassArcLowerFastening: new THREE.Vector2(350, 334),
        brassArcScaleIncidence: new THREE.Vector2(213, 222),
        imageHeight: 525,
        imageWidth: 525,
        ivoryScaleLeft: new THREE.Vector2(188, 225),
        ivoryScaleRight: new THREE.Vector2(373, 225),
        leftLowerPivot: new THREE.Vector2(176, 330),
        leftUpperPivot: new THREE.Vector2(100, 193),
        lowerBladeLeft: new THREE.Vector2(22, 298),
        lowerBladeRight: new THREE.Vector2(466, 366),
        measurementUncertaintyPixels: 8,
        rightLowerPivot: new THREE.Vector2(436, 329),
        rightUpperPivot: new THREE.Vector2(361, 194),
        upperBladeLeft: new THREE.Vector2(68, 157),
        upperBladeRight: new THREE.Vector2(510, 232),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the instrument is a parallel ruler',
          'it sets required distances between parallel lines without separate setting out',
          'the lower edge of the upper blade carries a graduated ivory scale',
          'the outer edge of the brass arc indicates the width between blades on that scale',
        ],
        engravingEvidence:
          'the plate shows two long straight blades, two equal matching ornamental links with four pivots, one curved brass indicator fastened to the lower blade, and a ticked scale along the facing edge of the upper blade',
        reconstructionDisclosure:
          'blade dimensions, opening limits, smooth manual timing, fitted circular arc, and calibrated units are engineered from the engraving because Brown supplies no numerical dimensions or graduation values',
      },
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      demonstrationPeriod,
      note:
        'one smooth manual cycle opens and closes the blades through the calibrated range; Brown supplies no animation or operating speed',
    },
    transmission: {
      arcReadingLaw:
        'the fixed brass-arc curve is intersected with the moving lower edge of the upper blade; its upper-blade-local x coordinate selects the graduation for the actual edge gap',
      bladeLaw:
        'upper blade translation = fixed local-pivot offset + linkLength*(cos(angle), sin(angle)); neither blade rotates',
      linkLaw:
        'both equal links always have the same angle and length, so corresponding blade pivots form an exact parallelogram',
      scaleLaw:
        'each tick position is generated by inverting the same link-gap and arc-incidence equations, not by visual linear spacing',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.86, -0.12, -0.96),
    new THREE.Vector3(2.86, 0.48, 2.44),
  );
  finishDrawingRuler(root, []);
  root.userData.cameraFov = 8;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0, 12, .9),
    root,
    update,
  };
}

export function createAuthoredParallelRulerMovement(movement) {
  switch (movement.id) {
    case 322: return slidingTriangleParallelRuler(movement);
    case 323: return rollingWheelParallelRuler(movement);
    case 367: return graduatedArcParallelRuler(movement);
    default: return null;
  }
}
