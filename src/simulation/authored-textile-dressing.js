import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import { boredRollGeometry, boredBlockGeometry, textileBrushGeometry, finishProcessPresentation } from './textile-planer-working-parts.js';
import { plate } from './finite-plate-geometry.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongZ(radius, length, material, segments = 40) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function solveSpacingForOneRollCircumference(rollRadius, drumRadius) {
  const radiusSum = rollRadius + drumRadius;
  const targetLength = FULL_TURN * rollRadius;
  const pathLengthAtSpacing = (spacing) => (
    2 * Math.sqrt(spacing ** 2 - radiusSum ** 2)
      + 2 * drumRadius * Math.asin(radiusSum / spacing)
  );
  let lower = radiusSum * (1 + 1e-10);
  let upper = radiusSum * 2;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const middle = (lower + upper) / 2;
    if (pathLengthAtSpacing(middle) < targetLength) {
      lower = middle;
    } else {
      upper = middle;
    }
  }
  return (lower + upper) / 2;
}

class TextileWebPath {
  constructor({ drumRadius, rollRadius, spacing }) {
    this.drumRadius = drumRadius;
    this.rollRadius = rollRadius;
    this.spacing = spacing;
    this.radiusSum = drumRadius + rollRadius;
    this.tangentHalfAngle = Math.asin(this.radiusSum / spacing);
    this.radialUnitX = Math.cos(this.tangentHalfAngle);
    this.radialUnitY = Math.sin(this.tangentHalfAngle);
    this.topCenter = new THREE.Vector3(0, spacing, 0);
    this.drumCenter = new THREE.Vector3(0, 0, 0);
    this.bottomCenter = new THREE.Vector3(0, -spacing, 0);
    this.topTangent = this.topCenter.clone().add(new THREE.Vector3(
      this.radialUnitX * rollRadius,
      -this.radialUnitY * rollRadius,
      0,
    ));
    this.drumUpperTangent = new THREE.Vector3(
      -this.radialUnitX * drumRadius,
      this.radialUnitY * drumRadius,
      0,
    );
    this.drumLowerTangent = new THREE.Vector3(
      -this.radialUnitX * drumRadius,
      -this.radialUnitY * drumRadius,
      0,
    );
    this.bottomTangent = this.bottomCenter.clone().add(
      new THREE.Vector3(
        this.radialUnitX * rollRadius,
        this.radialUnitY * rollRadius,
        0,
      ),
    );
    this.firstLine = this.drumUpperTangent.clone()
      .sub(this.topTangent);
    this.secondLine = this.bottomTangent.clone()
      .sub(this.drumLowerTangent);
    this.lineLength = this.firstLine.length();
    this.firstLineTangent = this.firstLine.clone().normalize();
    this.secondLineTangent = this.secondLine.clone().normalize();
    this.arcStartAngle = Math.PI - this.tangentHalfAngle;
    this.arcAngle = 2 * this.tangentHalfAngle;
    this.arcLength = drumRadius * this.arcAngle;
    this.length = 2 * this.lineLength + this.arcLength;
  }

  pointAtDistance(distance, target = new THREE.Vector3()) {
    const bounded = THREE.MathUtils.clamp(distance, 0, this.length);
    if (bounded <= this.lineLength) {
      return target.copy(this.topTangent).addScaledVector(
        this.firstLineTangent,
        bounded,
      );
    }
    if (bounded <= this.lineLength + this.arcLength) {
      const arcDistance = bounded - this.lineLength;
      const angle = this.arcStartAngle
        + arcDistance / this.drumRadius;
      return target.set(
        Math.cos(angle) * this.drumRadius,
        Math.sin(angle) * this.drumRadius,
        0,
      );
    }
    return target.copy(this.drumLowerTangent).addScaledVector(
      this.secondLineTangent,
      bounded - this.lineLength - this.arcLength,
    );
  }

  tangentAtDistance(distance, target = new THREE.Vector3()) {
    const bounded = THREE.MathUtils.clamp(distance, 0, this.length);
    if (bounded < this.lineLength) {
      return target.copy(this.firstLineTangent);
    }
    if (bounded <= this.lineLength + this.arcLength) {
      const angle = this.arcStartAngle
        + (bounded - this.lineLength) / this.drumRadius;
      return target.set(-Math.sin(angle), Math.cos(angle), 0);
    }
    return target.copy(this.secondLineTangent);
  }

  wrappedDistance(distance) {
    return THREE.MathUtils.euclideanModulo(distance, this.length);
  }
}

function makeRibbonGeometry(path, width, segments = 180) {
  const positions = [];
  const indices = [];
  for (let index = 0; index <= segments; index += 1) {
    const point = path.pointAtDistance(path.length * index / segments);
    positions.push(
      point.x,
      point.y,
      -width / 2,
      point.x,
      point.y,
      width / 2,
    );
    if (index === segments) continue;
    const lower = index * 2;
    indices.push(
      lower,
      lower + 1,
      lower + 2,
      lower + 1,
      lower + 3,
      lower + 2,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function textileDressingElements(movement) {
  const root = new THREE.Group();

  const rollRadius = 0.62;
  const dressingContactRadius = 0.93;
  const dressingCoreRadius = 0.76;
  const centerSpacing = solveSpacingForOneRollCircumference(
    rollRadius,
    dressingContactRadius,
  );
  const webPath = new TextileWebPath({
    drumRadius: dressingContactRadius,
    rollRadius,
    spacing: centerSpacing,
  });
  const webWidth = 1.72;
  const webSpeed = 0.72;
  const webCircuitPeriod = webPath.length / webSpeed;
  const demonstrationPeriod = 2 * webCircuitPeriod;
  const windingAngularSpeed = -webSpeed / rollRadius;
  const dressingAngularSpeed = 0.5 * windingAngularSpeed;
  const windingStartAngles = [
    THREE.MathUtils.degToRad(8),
    THREE.MathUtils.degToRad(-13),
  ];
  const dressingStartAngle = THREE.MathUtils.degToRad(6);
  const markerCount = 9;
  const brushCount = 12;
  const topContactRadius = webPath.topTangent.clone().sub(
    webPath.topCenter,
  );
  const bottomContactRadius = webPath.bottomTangent.clone().sub(
    webPath.bottomCenter,
  );
  const topPathTangent = webPath.firstLineTangent.clone();
  const bottomPathTangent = webPath.secondLineTangent.clone();

  const stateAtTime = (time) => {
    const webTravel = webSpeed * time;
    const windingAngles = [
      windingStartAngles[0] + windingAngularSpeed * time,
      windingStartAngles[1] + windingAngularSpeed * time,
    ];
    const dressingAngle = dressingStartAngle
      + dressingAngularSpeed * time;
    const topContactVelocity = new THREE.Vector3().crossVectors(
      Z_AXIS.clone().multiplyScalar(windingAngularSpeed),
      topContactRadius,
    );
    const bottomContactVelocity = new THREE.Vector3().crossVectors(
      Z_AXIS.clone().multiplyScalar(windingAngularSpeed),
      bottomContactRadius,
    );
    const webVelocityAtTop = topPathTangent.clone()
      .multiplyScalar(webSpeed);
    const webVelocityAtBottom = bottomPathTangent.clone()
      .multiplyScalar(webSpeed);
    const dressingSurfaceSpeed = dressingAngularSpeed
      * dressingContactRadius;
    const dressingRelativeSlipSpeed = webSpeed
      - dressingSurfaceSpeed;
    const markerStates = Array.from(
      { length: markerCount },
      (_, index) => {
        const unwrappedDistance = webTravel
          + index * webPath.length / markerCount;
        const distance = webPath.wrappedDistance(unwrappedDistance);
        return {
          distance,
          index,
          position: webPath.pointAtDistance(distance),
          tangent: webPath.tangentAtDistance(distance),
          unwrappedDistance,
          velocityMagnitude: webSpeed,
        };
      },
    );
    return {
      bottomContactVelocity,
      dressingAngle,
      dressingAngularSpeed,
      dressingRelativeSlipSpeed,
      dressingSurfaceSpeed,
      markerStates,
      topContactVelocity,
      webTravel,
      webVelocityAtBottom,
      webVelocityAtTop,
      windingAngles,
      windingAngularSpeed,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.21,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.27,
    roughness: 0.46,
  });
  const rollMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.64,
  });
  const dressingMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.60,
  });
  const brushMaterial = matte(0x855c2f, {
    metalness: 0.03,
    roughness: 0.87,
  });
  const clothMaterial = matte(PALETTE.brass, {
    metalness: 0.01,
    roughness: 0.84,
    side: THREE.DoubleSide,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-arched-frame-carrying-three-parallel-roller-axes';
  root.add(fixedFrame);
  const archCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.78, -2.64, -1.12),
    new THREE.Vector3(-1.52, 0.20, -1.12),
    new THREE.Vector3(-1.20, 2.72, -1.12),
    new THREE.Vector3(0, 3.05, -1.12),
    new THREE.Vector3(1.20, 2.72, -1.12),
    new THREE.Vector3(1.52, 0.20, -1.12),
    new THREE.Vector3(1.78, -2.64, -1.12),
  ]);
  // Brown draws the side frame as a broad flat arched strap (paired outer
  // and inner outlines), not a round tube.
  const archStrapHalfWidth = 0.15;
  const archPoints = archCurve.getSpacedPoints(120);
  const archOuter = [];
  const archInner = [];
  for (let index = 0; index < archPoints.length; index += 1) {
    const before = archPoints[Math.max(0, index - 1)];
    const after = archPoints[Math.min(archPoints.length - 1, index + 1)];
    const tangent = new THREE.Vector2(after.x - before.x, after.y - before.y)
      .normalize();
    const outward = new THREE.Vector2(-tangent.y, tangent.x);
    const point = archPoints[index];
    archOuter.push([
      point.x + outward.x * archStrapHalfWidth,
      point.y + outward.y * archStrapHalfWidth,
    ]);
    archInner.push([
      point.x - outward.x * archStrapHalfWidth,
      point.y - outward.y * archStrapHalfWidth,
    ]);
  }
  const arch = new THREE.Mesh(
    plate([[[...archOuter, ...archInner.reverse(), archOuter[0]]]], -1.18, -1.06),
    frameMaterial,
  );
  arch.userData.role = 'source-arched-side-frame';
  fixedFrame.add(arch);
  const frameFeet = [];
  for (const x of [-1.78, 1.78]) {
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.17, 0.70),
      frameMaterial,
    );
    foot.position.set(x, -2.71, -1.12);
    foot.userData.role = 'fixed-arched-frame-foot';
    frameFeet.push(foot);
    fixedFrame.add(foot);
  }
  const bearingBars = [];
  for (const y of [centerSpacing, 0, -centerSpacing]) {
    const bar = new THREE.Mesh(
      boredBlockGeometry(2.84, 0.34, 0.17, 0.14),
      frameMaterial,
    );
    bar.position.set(0, y, -1.12);
    bar.userData.role = 'fixed-winding-roll-bearing-crossbar';
    bearingBars.push(bar);
    fixedFrame.add(bar);
  }
  const bearingBlocks = [];
  for (const y of [centerSpacing, 0, -centerSpacing]) {
    const bearing = cylinderAlongZ(0.19, 0.30, darkMaterial, 28);
    bearing.geometry.dispose();
    // The dressing-cylinder bearing is shorter so its face clears the
    // rotating core's end.
    bearing.geometry = boredRollGeometry(0.19, y === 0 ? 0.24 : 0.30, y === 0 ? 0.134 : 0.114);
    bearing.position.set(0, y, y === 0 ? -1.11 : -1.08);
    bearing.userData.role = 'fixed-parallel-axis-bearing';
    bearingBlocks.push(bearing);
    fixedFrame.add(bearing);
  }

  const windingRollers = [];
  for (let index = 0; index < 2; index += 1) {
    const roller = new THREE.Group();
    roller.position.copy(index === 0
      ? webPath.topCenter
      : webPath.bottomCenter);
    roller.userData.axis = Z_AXIS.clone();
    roller.userData.index = index;
    roller.userData.role = index === 0
      ? 'upper-supply-winding-roll'
      : 'lower-takeup-winding-roll';
    root.add(roller);
    const rollBody = cylinderAlongZ(
      rollRadius,
      webWidth + 0.12,
      rollMaterial,
      128,
    );
    rollBody.geometry.dispose();
    rollBody.geometry = boredRollGeometry(rollRadius, webWidth + 0.12, 0.112);
    rollBody.userData.role = 'cloth-wound-roll-body';
    roller.add(rollBody);
    const rollRims = [];
    for (const z of [-webWidth / 2 - 0.09, webWidth / 2 + 0.09]) {
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(rollRadius, 0.045, 9, 56),
        darkMaterial,
      );
      rim.position.z = z;
      rim.userData.role = 'winding-roll-edge-rim';
      rollRims.push(rim);
      roller.add(rim);
    }
    const axle = cylinderAlongZ(
      0.11,
      2.60,
      darkMaterial,
      26,
    );
    axle.userData.role = 'winding-roll-axle';
    roller.add(axle);
    const indexMark = new THREE.Mesh(
      new THREE.BoxGeometry(rollRadius * 0.50, 0.055, 0.025),
      whiteMaterial,
    );
    indexMark.position.set(rollRadius * 0.51, 0, webWidth / 2 + 0.073);
    indexMark.userData.role = 'white-winding-roll-rotation-index';
    roller.add(indexMark);
    roller.userData.blocks = { axle, indexMark, rollBody, rollRims };
    windingRollers.push(roller);
  }

  const dressingCylinder = new THREE.Group();
  dressingCylinder.userData.axis = Z_AXIS.clone();
  dressingCylinder.userData.role =
    'interposed-brush-armed-dressing-cylinder';
  root.add(dressingCylinder);
  const dressingCore = cylinderAlongZ(
    dressingCoreRadius,
    webWidth + 0.20,
    dressingMaterial,
    48,
  );
  dressingCore.geometry.dispose();
  dressingCore.geometry = boredRollGeometry(dressingCoreRadius, webWidth + 0.20, 0.132);
  dressingCore.userData.role = 'dressing-cylinder-core';
  dressingCylinder.add(dressingCore);
  const brushBars = [];
  for (let index = 0; index < brushCount; index += 1) {
    const angle = index * FULL_TURN / brushCount;
    const brush = new THREE.Mesh(
      textileBrushGeometry(dressingCoreRadius - 0.015, dressingContactRadius - 0.0002, webWidth * 0.90),
      brushMaterial,
    );
    brush.rotation.z = angle;
    brush.userData.index = index;
    brush.userData.role = 'one-of-dressing-cylinder-brush-bars';
    brushBars.push(brush);
    dressingCylinder.add(brush);
  }
  const dressingAxle = cylinderAlongZ(
    0.13,
    2.60,
    darkMaterial,
    28,
  );
  dressingAxle.userData.role = 'dressing-cylinder-axle';
  dressingCylinder.add(dressingAxle);
  const dressingIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.50, 0.060, 0.025),
    whiteMaterial,
  );
  dressingIndex.position.set(0.40, 0, webWidth / 2 + 0.113);
  dressingIndex.userData.role = 'white-dressing-cylinder-rotation-index';
  dressingCylinder.add(dressingIndex);

  const webRibbon = new THREE.Mesh(
    makeRibbonGeometry(webPath, webWidth),
    clothMaterial,
  );
  webRibbon.userData.isBelt = false;
  webRibbon.userData.isContinuousOpenTextileWeb = true;
  webRibbon.userData.role =
    'one-continuous-cloth-or-warp-web-on-tangent-s-path';
  root.add(webRibbon);
  const webMarkers = [];
  for (let index = 0; index < markerCount; index += 1) {
    const marker = new THREE.Mesh(
      new THREE.PlaneGeometry(0.075, webWidth * 0.94).rotateX(Math.PI / 2),
      whiteMaterial,
    );
    marker.userData.index = index;
    marker.userData.role =
      'moving-transverse-cloth-material-registration-stripe';
    webMarkers.push(marker);
    root.add(marker);
  }

  const update = (time) => {
    const state = stateAtTime(time);
    for (let index = 0; index < windingRollers.length; index += 1) {
      windingRollers[index].rotation.z = state.windingAngles[index];
    }
    dressingCylinder.rotation.z = state.dressingAngle;
    for (let index = 0; index < webMarkers.length; index += 1) {
      const markerState = state.markerStates[index];
      webMarkers[index].position.copy(markerState.position);
      webMarkers[index].rotation.z = Math.atan2(
        markerState.tangent.y,
        markerState.tangent.x,
      );
    }
    root.userData.currentState = state;
    root.userData.constraintResiduals = {
      bottomWindingNoSlip: state.bottomContactVelocity.distanceTo(
        state.webVelocityAtBottom,
      ),
      circuitEqualsRollCircumference:
        webPath.length - FULL_TURN * rollRadius,
      topWindingNoSlip: state.topContactVelocity.distanceTo(
        state.webVelocityAtTop,
      ),
    };
  };

  root.userData = {
    archetype: movement.archetype,
    blocks: {
      arch,
      bearingBars,
      bearingBlocks,
      brushBars,
      dressingAxle,
      dressingCore,
      dressingCylinder,
      dressingIndex,
      fixedFrame,
      frameFeet,
      webMarkers,
      webRibbon,
      windingRollers,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 2,
      inputs: [
        'cloth transport and equal supply/takeup winding-roll surface speed',
        'independently driven dressing-cylinder rotation',
      ],
      note:
        'the two winding rolls are synchronized by the modeled constant web speed; the interposed brush cylinder intentionally has surface slip and its chosen ratio and direction are disclosed as conjectural',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'inextensible zero-thickness textile web following exact straight and circular tangent spans',
        'constant equal effective winding radii on supply and takeup rolls',
        'no slip between web and either winding roll at its tangent point',
        'rigid brush-armed dressing cylinder with prescribed opposed cloth-relative surface motion',
        'steady transport without roll-radius buildup, textile elasticity, tension, or process-force dynamics',
      ],
      sourceSpecifiesDimensionsTimingTurnRatioDirectionOrWebSpeed: false,
      treatment:
        'Brown specifies two winding rollers, one interposed selectable-surface cylinder, one transferred textile web, and several applications but no kinematic ratio; the official page explicitly calls its own ratio and direction conjectural, so this model states and tests one plausible internally consistent operating choice',
    },
    fidelity: 'authored',
    geometry: {
      brushCount,
      centerSpacing,
      dressingContactRadius,
      dressingCoreRadius,
      markerCount,
      rollRadius,
      webCircuitPeriod,
      webPathLength: webPath.length,
      webWidth,
    },
    mechanism:
      'one-open-textile-web-unwinds-from-one-upper-roll-follows-an-exact-tangent-s-path-around-one-interposed-brush-dressing-cylinder-and-winds-onto-one-lower-roll-with-equal-end-roll-surface-speeds',
    officialDescription: movement.description,
    sourceAnimation: {
      available: true,
      officialCanvasModelPresent: true,
      officialNotesTurnRatioAndDirectionAreConjectural: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate383: {
        bottomRollCenter: new THREE.Vector2(258, 442),
        bottomRollRadiusPixels: 54,
        dressingCylinderCenter: new THREE.Vector2(260, 278),
        dressingCylinderRadiusPixels: 91,
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 7,
        topRollCenter: new THREE.Vector2(256, 96),
        topRollRadiusPixels: 55,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'two rollers transfer yarn or cloth from one to the other',
          'one interposed cylinder acts on the passing material',
          'the interposed periphery may be smooth or armed with brushes, teasels, or other contrivances',
          'applications include sizing warps, gig-mills, and finishing woven fabrics',
        ],
        officialAnimationEvidence:
          'the animation shows equal upper and lower rolls, an interposed cylinder one-and-a-half times their radius, and a two-straight-plus-central-arc S-path; its written note says the turn ratio and direction are conjectural',
        reconstructionDisclosure:
          'roller scale, 0.72-unit web speed, brush-armed option, one-percent center-spacing adjustment that makes visible path length exactly one winding circumference, two-circuit loop, colors, and slip ratio are independently engineered rather than copied from the proprietary canvas',
      },
      officialPage: 'https://507movements.com/mm_383.html',
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    textilePath: {
      arcAngle: webPath.arcAngle,
      arcLength: webPath.arcLength,
      arcStartAngle: webPath.arcStartAngle,
      bottomCenter: webPath.bottomCenter,
      bottomTangent: webPath.bottomTangent,
      drumLowerTangent: webPath.drumLowerTangent,
      drumUpperTangent: webPath.drumUpperTangent,
      firstLineTangent: webPath.firstLineTangent,
      lineLength: webPath.lineLength,
      path: webPath,
      secondLineTangent: webPath.secondLineTangent,
      topCenter: webPath.topCenter,
      topTangent: webPath.topTangent,
    },
    timeline: {
      demonstrationPeriod,
      note:
        'two complete web-path circuits close nine material stripes, two winding-roll turns, and one dressing-cylinder turn exactly',
    },
    transmission: {
      dressingAngularSpeed,
      dressingRelativeSlipSpeed:
        webSpeed - dressingAngularSpeed * dressingContactRadius,
      dressingSurfaceSpeed:
        dressingAngularSpeed * dressingContactRadius,
      ratioAndDirectionChoice:
        'equal winding rolls turn clockwise at web speed divided by effective radius; the interposed brush cylinder turns clockwise at half their angular-speed magnitude, following the official animation’s conjectural choice',
      selectedInterposedSurface: 'armed-with-brush-bars',
      webSpeed,
      windingAngularSpeed,
      windingNoSlipLaw:
        'at both end-roll tangent points omega cross radius equals the material web velocity vector exactly',
    },
  };

  finishProcessPresentation(root, demonstrationPeriod, 'Equal winding radii and constant cloth transport are prescribed. The official animation also calls roller direction and ratio conjectural. Brush tips follow the cloth envelope; cloth thickness, tension, bristle deflection and finishing forces are not simulated.');
  root.userData.workingInterfaces = { windingRadius: rollRadius, brushOuterRadius: dressingContactRadius - 0.0002, nominalBrushClearance: 0.0002, clothThickness: 0 };
  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.30, -2.92, -1.58),
    new THREE.Vector3(2.30, 3.25, 1.58),
  );
  root.userData.groundFloorY = -2.84;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(2.5, 1.2, 16),
    root,
    update,
  };
}

export function createAuthoredTextileDressingMovement(movement) {
  if (movement.id !== 383) return null;
  return textileDressingElements(movement);
}
