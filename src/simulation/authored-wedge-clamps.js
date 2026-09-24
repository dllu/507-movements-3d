import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import {fitPistonGuide} from './piston-guide-parts.js';

const FULL_TURN = Math.PI * 2;

function planPrism(points, height, material) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    shape.lineTo(points[index].x, points[index].y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth: height,
    steps: 1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function boweryJoinersClamp(movement) {
  const root = new THREE.Group();

  const bedMinimumX = -2.76;
  const bedMaximumX = 2.82;
  const bedHalfWidth = 1.28;
  // Proportions follow Brown's transverse section: a deep bed, cheeks and
  // wedges flush at one height, and a narrow board standing on edge.
  const bedThickness = 0.45;
  const bedTopY = 0.05;
  const cheekMinimumX = -2.56;
  const cheekMaximumX = -0.36;
  const cheekThroatX = bedMinimumX;
  const cheekThroatHalfGap = 0.35;
  const cheekFaceSlope = 0.38;
  const cheekHeight = 0.40;
  const dovetailLipProjection = 0.13;
  const dovetailLipHeight = 0.11;
  const workpieceHalfWidth = 0.26;
  const workpieceMinimumX = -1.55;
  const workpieceMaximumX = 2.72;
  const workpieceHeight = 1.35;
  const wedgeMinimumX = -1.61;
  const wedgeMaximumX = -0.45;
  const wedgeTravel = 0.55;
  const maximumLateralTravel = cheekFaceSlope * wedgeTravel;
  const wedgeInnerHalfGapAtRest = workpieceHalfWidth
    + maximumLateralTravel;
  const wedgeHeight = 0.40;
  const demonstrationPeriod = 4.0;
  const insertionAngularFrequency = FULL_TURN / demonstrationPeriod;
  const cheekHalfGapAt = (x) => cheekThroatHalfGap
    + cheekFaceSlope * (x - cheekThroatX);

  const stateAtTime = (time) => {
    const insertionPhase = insertionAngularFrequency * time;
    const insertionFraction = 0.5 * (1 - Math.cos(insertionPhase));
    const insertionRate = 0.5 * insertionAngularFrequency
      * Math.sin(insertionPhase);
    const insertionAcceleration = 0.5 * insertionAngularFrequency ** 2
      * Math.cos(insertionPhase);
    const axialDisplacement = -wedgeTravel * insertionFraction;
    const axialVelocity = -wedgeTravel * insertionRate;
    const axialAcceleration = -wedgeTravel * insertionAcceleration;
    const wedgeStates = [-1, 1].map((side, index) => {
      const lateralDisplacement = side * cheekFaceSlope
        * axialDisplacement;
      const lateralVelocity = side * cheekFaceSlope * axialVelocity;
      const lateralAcceleration = side * cheekFaceSlope
        * axialAcceleration;
      const innerFaceZ = side * wedgeInnerHalfGapAtRest
        + lateralDisplacement;
      const workpieceFaceZ = side * workpieceHalfWidth;
      const contactGap = side * (innerFaceZ - workpieceFaceZ);
      return {
        axialAcceleration,
        axialDisplacement,
        axialVelocity,
        contactGap,
        index,
        innerFaceZ,
        lateralAcceleration,
        lateralDisplacement,
        lateralVelocity,
        pathSlope: lateralDisplacement / (axialDisplacement || 1),
        side,
        workpieceFaceZ,
      };
    });
    return {
      axialDisplacement,
      axialVelocity,
      insertionAcceleration,
      insertionFraction,
      insertionPhase,
      insertionRate,
      minimumContactGap: Math.min(
        ...wedgeStates.map(({ contactGap }) => contactGap),
      ),
      wedgeStates,
    };
  };

  const bedMaterial = matte(PALETTE.driven, {
    metalness: 0.06,
    roughness: 0.72,
  });
  const cheekMaterial = matte(PALETTE.frame, {
    metalness: 0.08,
    roughness: 0.68,
  });
  const wedgeMaterial = matte(PALETTE.driver, {
    metalness: 0.05,
    roughness: 0.69,
  });
  const woodMaterial = matte(PALETTE.brass, {
    metalness: 0.01,
    roughness: 0.86,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.12,
    roughness: 0.57,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.45 });

  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(
      bedMaximumX - bedMinimumX,
      bedThickness,
      bedHalfWidth * 2,
    ),
    bedMaterial,
  );
  bed.position.set(
    (bedMinimumX + bedMaximumX) / 2,
    bedTopY - bedThickness / 2,
    0,
  );
  bed.userData.fixed = true;
  bed.userData.role = 'fixed-oblong-clamp-bed';
  root.add(bed);

  const cheeks = [];
  const dovetailLips = [];
  for (const side of [-1, 1]) {
    const innerAtMinimum = side * cheekHalfGapAt(cheekMinimumX);
    const innerAtMaximum = side * cheekHalfGapAt(cheekMaximumX);
    const outerZ = side * bedHalfWidth;
    const points = side > 0
      ? [
        new THREE.Vector2(cheekMinimumX, innerAtMinimum),
        new THREE.Vector2(cheekMaximumX, innerAtMaximum),
        new THREE.Vector2(cheekMaximumX, outerZ),
        new THREE.Vector2(cheekMinimumX, outerZ),
      ]
      : [
        new THREE.Vector2(cheekMinimumX, outerZ),
        new THREE.Vector2(cheekMaximumX, outerZ),
        new THREE.Vector2(cheekMaximumX, innerAtMaximum),
        new THREE.Vector2(cheekMinimumX, innerAtMinimum),
      ];
    const cheek = planPrism(points, cheekHeight, cheekMaterial);
    const cp = cheek.geometry.attributes.position;
    for (let i = 0; i < cp.count; i += 1) {
      if (Math.abs(cp.getY(i) - side * cheekHalfGapAt(cp.getX(i))) < 1e-6) {
        cp.setY(i, cp.getY(i) - side * dovetailLipProjection * (1 - cp.getZ(i) / cheekHeight));
      }
    }
    cp.needsUpdate = true;
    cheek.geometry.computeVertexNormals();
    cheek.position.y = bedTopY + cheekHeight;
    cheek.userData.fixed = true;
    cheek.userData.innerFaceSlope = side * cheekFaceSlope;
    cheek.userData.side = side;
    cheek.userData.role = 'one-of-two-fixed-wedge-formed-cheeks';
    cheeks.push(cheek);
    root.add(cheek);

    const lipInnerAtMinimum = side * (
      cheekHalfGapAt(cheekMinimumX) - dovetailLipProjection
    );
    const lipInnerAtMaximum = side * (
      cheekHalfGapAt(cheekMaximumX) - dovetailLipProjection
    );
    const lipOuterAtMinimum = side * (
      cheekHalfGapAt(cheekMinimumX) + 0.08
    );
    const lipOuterAtMaximum = side * (
      cheekHalfGapAt(cheekMaximumX) + 0.08
    );
    const lipPoints = side > 0
      ? [
        new THREE.Vector2(cheekMinimumX, lipInnerAtMinimum),
        new THREE.Vector2(cheekMaximumX, lipInnerAtMaximum),
        new THREE.Vector2(cheekMaximumX, lipOuterAtMaximum),
        new THREE.Vector2(cheekMinimumX, lipOuterAtMinimum),
      ]
      : [
        new THREE.Vector2(cheekMinimumX, lipOuterAtMinimum),
        new THREE.Vector2(cheekMaximumX, lipOuterAtMaximum),
        new THREE.Vector2(cheekMaximumX, lipInnerAtMaximum),
        new THREE.Vector2(cheekMinimumX, lipInnerAtMinimum),
      ];
    const lip = planPrism(lipPoints, dovetailLipHeight, darkMaterial);
    lip.position.y = bedTopY + cheekHeight;
    // The continuous inclined cheek now supplies the undercut itself.
    lip.visible = false;
    lip.userData.fixed = true;
    lip.userData.inwardProjection = dovetailLipProjection;
    lip.userData.side = side;
    lip.userData.role =
      'inward-overhanging-upper-dovetail-retainer-lip';
    dovetailLips.push(lip);
    root.add(lip);
  }

  const workpiece = new THREE.Mesh(
    new THREE.BoxGeometry(
      workpieceMaximumX - workpieceMinimumX,
      workpieceHeight,
      workpieceHalfWidth * 2,
    ),
    woodMaterial,
  );
  workpiece.position.set(
    (workpieceMinimumX + workpieceMaximumX) / 2,
    bedTopY + workpieceHeight / 2,
    0,
  );
  workpiece.userData.fixedForDemonstration = true;
  workpiece.userData.role =
    'one-removable-board-held-for-planing-between-wedges';
  root.add(workpiece);
  const grainLines = [];
  for (const z of [-0.13, 0, 0.13]) {
    const grain = new THREE.Mesh(
      new THREE.BoxGeometry(
        workpieceMaximumX - workpieceMinimumX - 0.16,
        0.022,
        0.022,
      ),
      darkMaterial,
    );
    grain.position.set(
      (workpieceMinimumX + workpieceMaximumX) / 2,
      bedTopY + workpieceHeight + 0.012,
      z,
    );
    grain.userData.role = 'workpiece-longitudinal-grain-line';
    grainLines.push(grain);
    root.add(grain);
  }

  const wedges = [];
  const wedgeContactStrips = [];
  for (const side of [-1, 1]) {
    const outerAtMinimum = side * cheekHalfGapAt(wedgeMinimumX);
    const outerAtMaximum = side * cheekHalfGapAt(wedgeMaximumX);
    const innerZ = side * wedgeInnerHalfGapAtRest;
    const points = side > 0
      ? [
        new THREE.Vector2(wedgeMinimumX, innerZ),
        new THREE.Vector2(wedgeMaximumX, innerZ),
        new THREE.Vector2(wedgeMaximumX, outerAtMaximum),
        new THREE.Vector2(wedgeMinimumX, outerAtMinimum),
      ]
      : [
        new THREE.Vector2(wedgeMinimumX, outerAtMinimum),
        new THREE.Vector2(wedgeMaximumX, outerAtMaximum),
        new THREE.Vector2(wedgeMaximumX, innerZ),
        new THREE.Vector2(wedgeMinimumX, innerZ),
      ];
    const wedge = planPrism(points, wedgeHeight, wedgeMaterial);
    const wp = wedge.geometry.attributes.position;
    for (let i = 0; i < wp.count; i += 1) {
      if (Math.abs(wp.getY(i) - side * cheekHalfGapAt(wp.getX(i))) < 1e-6) {
        wp.setY(i, wp.getY(i) - side * dovetailLipProjection * (wedgeHeight - wp.getZ(i)) / cheekHeight);
      }
    }
    wp.needsUpdate = true;
    wedge.geometry.computeVertexNormals();
    wedge.position.y = bedTopY + wedgeHeight;
    wedge.userData.innerFaceLocalZ = innerZ;
    wedge.userData.outerFaceSlope = side * cheekFaceSlope;
    wedge.userData.side = side;
    wedge.userData.role =
      'one-of-two-sliding-dovetail-retained-clamping-wedges';
    wedges.push(wedge);
    root.add(wedge);

    const contactStrip = new THREE.Mesh(
      new THREE.BoxGeometry(
        wedgeMaximumX - wedgeMinimumX,
        wedgeHeight * 0.74,
        0.026,
      ),
      whiteMaterial,
    );
    contactStrip.position.set(
      (wedgeMinimumX + wedgeMaximumX) / 2,
      bedTopY + wedgeHeight * 0.54,
      innerZ + side * 0.014,
    );
    contactStrip.userData.side = side;
    contactStrip.userData.role =
      'white-wedge-to-workpiece-contact-face-index';
    wedgeContactStrips.push(contactStrip);
    root.add(contactStrip);
  }

  const throatDatum = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.055, cheekThroatHalfGap * 2),
    whiteMaterial,
  );
  throatDatum.position.set(cheekThroatX, bedTopY + 0.03, 0);
  throatDatum.userData.role = 'white-narrow-throat-datum';
  root.add(throatDatum);

  // Brown's plate draws two figures: the transverse section above and, below
  // it, the plan of the diverging cheeks and wedges. The default camera looks
  // along the bed at the section, so a display copy of the same parts is
  // turned to face the camera top-first and set below it at the same scale,
  // throat to the left as in the plan. It shares geometry and follows the
  // working wedges; it is a view, not a second clamp.
  const planDisplay = new THREE.Group();
  planDisplay.userData.role = 'plan-view-display-copy-of-clamp';
  planDisplay.userData.displayCopy = true;
  planDisplay.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, -1, 0),
  ));
  const planGap = 0.62;
  planDisplay.position.set(0, bed.position.y - bedThickness / 2 - planGap - bedHalfWidth, 0);
  const planCopy = (part) => {
    const copy = new THREE.Mesh(part.geometry, part.material);
    copy.position.copy(part.position);
    copy.quaternion.copy(part.quaternion);
    copy.userData.role = `plan-view-display-copy-of-${part.userData.role}`;
    copy.userData.displayCopy = true;
    planDisplay.add(copy);
    return copy;
  };
  const planParts = [bed, ...cheeks, workpiece].map(planCopy);
  const planWedges = wedges.map(planCopy);
  root.add(planDisplay);

  const update = (time) => {
    const state = stateAtTime(time);
    for (let index = 0; index < wedges.length; index += 1) {
      const wedgeState = state.wedgeStates[index];
      wedges[index].position.x = wedgeState.axialDisplacement;
      wedges[index].position.z = wedgeState.lateralDisplacement;
      planWedges[index].position.copy(wedges[index].position);
      wedgeContactStrips[index].position.x =
        (wedgeMinimumX + wedgeMaximumX) / 2
          + wedgeState.axialDisplacement;
      wedgeContactStrips[index].position.z =
        wedgeState.innerFaceZ + wedgeState.side * 0.014;
    }
    root.userData.currentState = state;
    root.userData.constraintResiduals = {
      lowerOuterFace:
        wedges[0].position.z
          + cheekFaceSlope * wedges[0].position.x,
      symmetryX: wedges[0].position.x - wedges[1].position.x,
      symmetryZ: wedges[0].position.z + wedges[1].position.z,
      upperOuterFace:
        wedges[1].position.z
          - cheekFaceSlope * wedges[1].position.x,
    };
  };

  root.userData = {
    archetype: movement.archetype,
    blocks: {
      bed,
      cheeks,
      dovetailLips,
      grainLines,
      planDisplay,
      planParts,
      planWedges,
      throatDatum,
      wedgeContactStrips,
      wedges,
      workpiece,
    },
    degreesOfFreedom: {
      independentPhysicalInputs: 2,
      independentPrescribedInputs: 1,
      input:
        'synchronized insertion and withdrawal of the two manually driven wedges for the demonstration',
      note:
        'each wedge is physically adjustable on its own; the exhibition schedule drives both equally so a centered workpiece remains centered while clamping',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid oblong bed and fixed wedge-formed cheeks',
        'frictionless sliding contact between each wedge and cheek face',
        'rigid centered removable board',
        'symmetric wedge insertion in the demonstration',
        'quasi-static clamping without wood deformation or impact forces',
      ],
      sourceSpecifiesDimensionsTimingWedgeAngleOrForce: false,
      treatment:
        'Brown specifies the plan topology, transverse dovetail retention, and wedge clamping principle but no dimensions or force; wedge paths, contact gaps, and ideal mechanical advantage are analytic while scale and timing are engineered',
    },
    fidelity: 'authored',
    geometry: {
      bedHalfWidth,
      bedMaximumX,
      bedMinimumX,
      bedThickness,
      bedTopY,
      cheekFaceSlope,
      cheekHeight,
      cheekMaximumX,
      cheekMinimumX,
      cheekThroatHalfGap,
      cheekThroatX,
      demonstrationPeriod,
      dovetailLipHeight,
      dovetailLipProjection,
      insertionAngularFrequency,
      maximumLateralTravel,
      wedgeHeight,
      wedgeInnerHalfGapAtRest,
      wedgeMaximumX,
      wedgeMinimumX,
      wedgeTravel,
      workpieceHalfWidth,
      workpieceHeight,
      workpieceMaximumX,
      workpieceMinimumX,
    },
    mechanism:
      'two-fixed-wedge-formed-cheeks-diverge-from-one-narrow-bed-throat-and-retain-two-matching-sliding-wedges-whose-insertion-moves-their-parallel-inner-faces-symmetrically-onto-one-planing-workpiece',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate381: {
        imageHeight: 525,
        imageWidth: 525,
        lowerPlanBedLeft: new THREE.Vector2(27, 264),
        lowerPlanBedRightBreak: new THREE.Vector2(490, 265),
        lowerPlanNarrowThroat: new THREE.Vector2(27, 339),
        measurementUncertaintyPixels: 8,
        transverseBedBottomLeft: new THREE.Vector2(149, 204),
        transverseBedBottomRight: new THREE.Vector2(355, 204),
        transverseCentralWorkpieceTop: new THREE.Vector2(257, 50),
        upperCheekInnerEnd: new THREE.Vector2(207, 280),
        upperCheekInnerStart: new THREE.Vector2(27, 325),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the appliance is Bowery\'s joiner\'s clamp',
          'the source supplies both plan and transverse section',
          'an oblong bed carries two wedge-formed cheeks at one end',
          'the adjacent cheek faces lie at an angle to each other',
          'the cheeks are dovetailed inward from their upper edges',
          'two received wedges clamp one or more wood pieces for planing',
        ],
        engravingEvidence:
          'the lower view shows opposed cheek faces diverging from a narrow left throat along the bed, while the upper section shows the bed, two side cheeks, inward upper retention, and a centered upright workpiece',
        reconstructionDisclosure:
          'bed depth, 0.38 face slope, dovetail-lip projection, one removable demonstration board, symmetric 0.55-unit wedge travel, colors, and four-second reversible schedule are engineered because Brown gives no values and the official page has no canvas animation',
      },
      officialPage: 'https://507movements.com/mm_381.html',
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      demonstrationPeriod,
      note:
        'both wedges advance smoothly from clear to exact workpiece contact at mid-cycle and withdraw along the identical cheek lines for seamless closure',
    },
    transmission: {
      idealAxialToLateralForceRatio: 1 / cheekFaceSlope,
      lateralTravelLaw:
        'each signed lateral displacement equals cheek-face slope times its axial displacement; mirrored signs make the two inner faces converge symmetrically',
      maximumLateralTravel,
      outerFaceContactLaw:
        'translating each rigid wedge by (dx, side*slope*dx) leaves its sloped outer face coincident with the corresponding fixed cheek line',
      wedgeAngle: Math.atan(cheekFaceSlope),
      workpieceContactLaw:
        'the positive clearance from each wedge inner plane to the fixed workpiece face reaches exactly zero only at full insertion',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.12, -0.42, -1.58),
    new THREE.Vector3(3.13, 1.42, 1.58),
  );
  root.userData.groundFloorY = -0.40;
  // A very narrow field keeps the end elevation close to Brown's flat
  // section: the long bed top and the far cheeks barely open in perspective.
  root.userData.cameraFov = 5;
  fitPistonGuide(root, update, demonstrationPeriod);
  markShadows(root);
  // The section above would shade the plan copy below it; Brown's plan is unshaded.
  planDisplay.traverse((object) => {
    object.castShadow = false;
    object.receiveShadow = false;
  });
  return {
    cameraDirection: new THREE.Vector3(5.8, 6.7, 8.8),
    root,
    update,
  };
}

export function createAuthoredWedgeClampMovement(movement) {
  if (movement.id !== 381) return null;
  return boweryJoinersClamp(movement);
}
