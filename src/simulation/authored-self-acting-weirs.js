import {correctWeir} from './chain-weir-working-parts.js';
import * as THREE from 'three';
import { plate, poly, circle, polygonClipping } from './finite-plate-geometry.js';
import { waterJetGeometry, waterJetMaterial, waterVolumeGeometry, waterVolumeMaterial } from './water-volume.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x ** 3 * (10 + x * (-15 + 6 * x));
}

function panelAxis(angle) {
  return new THREE.Vector3(-Math.sin(angle), Math.cos(angle), 0);
}

function panelDownstreamNormal(angle) {
  return new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
}

function selfActingWeir(movement) {
  const root = new THREE.Group();
  const streamDirection = new THREE.Vector3(1, 0, 0);
  const upperLength = 2.55;
  const lowerLength = 1.25;
  // Brown's leaves are stout planks (about a ninth of the upper leaf's
  // height), not thin boards; the closed faces meet at x = 0.
  const upperThickness = 0.26;
  const lowerThickness = 0.26;
  const upperPivotFromBottom = 0.62;
  // The lower leaf stands on the bed when closed, so the closed weir does
  // not leak under it. Its pivot lies on its upstream face: turned back
  // against the stream, both of its bottom corners rise off the bed (none
  // digs in) and open the scour passage beneath it.
  const lowerPivotFromBottom = 0.35;
  const lowerCentreOffset = lowerThickness / 2;
  const upperPivot = new THREE.Vector3(upperThickness / 2, 1.40, 0);
  const lowerPivot = new THREE.Vector3(-lowerThickness, 0.30, 0);
  const upperTopLocal = upperLength - upperPivotFromBottom;
  const lowerTopLocal = lowerLength - lowerPivotFromBottom;
  const gateWidth = 2.40;
  // The caption's notch: a rectangular slot cut down from the top edge of
  // the upper leaf across the middle half of the channel. Brown's section
  // (the near end of the leaf) shows the full-height plank, with the head
  // standing about 0.37 of the leaf's height below its top and the water
  // leaving the downstream face below the top: that water runs through the
  // notch, which lies behind the section's near end.
  const notchWidth = 1.20;
  const notchDepth = 1.20;
  const notchBottomLocal = upperTopLocal - notchDepth;
  const notchBottomY = upperPivot.y + notchBottomLocal;
  const maximumUpperAngle = THREE.MathUtils.degToRad(40);
  const cycleDuration = 12;
  // Ordinary head over the notch sill: the plate's head (0.95 below the
  // leaf top, scaled to this leaf) less the sill depth. The flood head
  // (about five times the ordinary notch flow) stands below the shoulders,
  // and the turned leaf of Brown's right figure holds it at about its top;
  // the level is capped just under the shoulders, so every flow leaves
  // through the notch and none overtops the leaf's full-width top.
  const ordinaryCrestHead = 0.26;
  const shoulderFreeboard = 0.04;
  const floodCrestHead = 0.75;
  const ordinaryWaterLevel = notchBottomY + ordinaryCrestHead;
  const floodWaterLevel = notchBottomY + floodCrestHead;
  const downstreamWaterLevel = 0.46;
  const channelFloorY = -0.05;
  const groundY = -0.22;
  const ordinaryNotchHead = ordinaryWaterLevel - notchBottomY;
  const ordinaryNotchFlowFraction = 0.48;
  const riseEndPhase = 0.28;
  const openingEndPhase = 0.50;
  const drainEndPhase = 0.68;
  const closingEndPhase = 0.90;

  const contactStateForUpperAngle = (upperAngle) => {
    const upperAxis = panelAxis(upperAngle);
    const upperNormal = panelDownstreamNormal(upperAngle);
    const upperBottomCenter = upperPivot.clone().addScaledVector(
      upperAxis,
      -upperPivotFromBottom,
    );
    const contactPoint = upperBottomCenter.clone().addScaledVector(
      upperNormal,
      -upperThickness / 2,
    );
    const fromLowerPivot = contactPoint.clone().sub(lowerPivot);
    const contactRadius = fromLowerPivot.length();
    const polarAngle = Math.atan2(fromLowerPivot.y, fromLowerPivot.x);
    const faceOffsetRatio = THREE.MathUtils.clamp(
      (lowerCentreOffset + lowerThickness / 2) / contactRadius,
      -1,
      1,
    );
    let lowerAngle = polarAngle - Math.acos(faceOffsetRatio);
    if (Math.abs(lowerAngle) < 1e-12) lowerAngle = 0;
    const lowerAxis = panelAxis(lowerAngle);
    const lowerNormal = panelDownstreamNormal(lowerAngle);
    const lowerFaceReference = lowerPivot.clone().addScaledVector(
      lowerNormal,
      lowerCentreOffset + lowerThickness / 2,
    );
    const lowerFaceOffset = contactPoint.clone().sub(lowerFaceReference);
    const lowerContactCoordinate = lowerFaceOffset.dot(lowerAxis);
    const contactNormalResidual = lowerFaceOffset.dot(lowerNormal);
    return {
      contactNormalResidual,
      contactPoint,
      contactRadius,
      lowerAngle,
      lowerAxis,
      lowerContactCoordinate,
      lowerFaceReference,
      lowerNormal,
      upperAngle,
      upperAxis,
      upperBottomCenter,
      upperNormal,
    };
  };

  const stateAtDrive = (unclampedDrive) => {
    const contactDrive = THREE.MathUtils.clamp(unclampedDrive, 0, 1);
    const upperAngle = -maximumUpperAngle * contactDrive ** 2;
    const contact = contactStateForUpperAngle(upperAngle);
    const upperTopCenter = upperPivot.clone().addScaledVector(
      contact.upperAxis,
      upperTopLocal,
    );
    const lowerCentre = lowerPivot.clone().addScaledVector(contact.lowerNormal, lowerCentreOffset);
    const lowerBottomCenter = lowerCentre.clone().addScaledVector(
      contact.lowerAxis,
      -lowerPivotFromBottom,
    );
    const lowerTopCenter = lowerCentre.clone().addScaledVector(
      contact.lowerAxis,
      lowerTopLocal,
    );
    return {
      ...contact,
      bedPassageHorizontalOpening: Math.max(
        0,
        lowerBottomCenter.x - (lowerPivot.x + lowerCentreOffset),
      ),
      contactDrive,
      lowerBottomCenter,
      lowerTopCenter,
      upperTopCenter,
    };
  };

  const canonicalPhase = (unwrappedPhase) => {
    const raw = positiveModulo(unwrappedPhase, 1);
    return [0, riseEndPhase, openingEndPhase, drainEndPhase,
      closingEndPhase].find((boundary) =>
      Math.abs(raw - boundary) < 1e-12) ?? raw;
  };

  const stateAtPhase = (unwrappedPhase) => {
    const phase = canonicalPhase(unwrappedPhase);
    let contactDrive = 0;
    if (phase >= riseEndPhase && phase < openingEndPhase) {
      contactDrive = smootherStep(
        (phase - riseEndPhase) / (openingEndPhase - riseEndPhase),
      );
    } else if (phase >= openingEndPhase && phase < drainEndPhase) {
      contactDrive = 1;
    } else if (phase >= drainEndPhase && phase < closingEndPhase) {
      contactDrive = 1 - smootherStep(
        (phase - drainEndPhase) / (closingEndPhase - drainEndPhase),
      );
    }

    let waterLevel = ordinaryWaterLevel;
    if (phase < riseEndPhase) {
      waterLevel = THREE.MathUtils.lerp(
        ordinaryWaterLevel,
        floodWaterLevel,
        smootherStep(phase / riseEndPhase),
      );
    } else if (phase < drainEndPhase) {
      waterLevel = THREE.MathUtils.lerp(
        floodWaterLevel,
        ordinaryWaterLevel,
        smootherStep(
          (phase - riseEndPhase) / (drainEndPhase - riseEndPhase),
        ),
      );
    }
    const gate = stateAtDrive(contactDrive);
    const floodFraction = THREE.MathUtils.clamp(
      (waterLevel - ordinaryWaterLevel)
        / (floodWaterLevel - ordinaryWaterLevel),
      0,
      1,
    );
    // The turned upper leaf lowers its notch sill and shoulders. The head
    // never overtops the shoulders: the notch passes the flood, so the
    // scheduled level falls with the lowered leaf.
    const upstreamCornerY = (localY) => upperPivot.y
      - (upperThickness / 2) * Math.sin(gate.upperAngle)
      + localY * Math.cos(gate.upperAngle);
    const upperTopEdgeY = upstreamCornerY(upperTopLocal);
    const notchSillY = upstreamCornerY(notchBottomLocal);
    waterLevel = Math.min(waterLevel, upperTopEdgeY - shoulderFreeboard);
    // Notch discharge follows the head over the (possibly lowered) sill as
    // a sharp-crested weir, q ~ h^(3/2), scaled so the ordinary head gives
    // the ordinary flow.
    const notchHead = Math.max(0, waterLevel - notchSillY);
    const notchFlowFraction = ordinaryNotchFlowFraction
      * (notchHead / ordinaryNotchHead) ** 1.5;
    let regime = 'ordinary-closed-weir-with-notch-overflow';
    if (phase >= riseEndPhase && phase < openingEndPhase) {
      regime = 'rising-head-turns-upper-leaf-and-pushes-lower-leaf-back';
    } else if (phase >= openingEndPhase && phase < drainEndPhase) {
      regime = 'open-bed-sluice-scours-deposit';
    } else if (phase >= drainEndPhase && phase < closingEndPhase) {
      regime = 'falling-head-allows-contact-coupled-leaves-to-reclose';
    }
    return {
      ...gate,
      bedFlowFraction: contactDrive,
      floodFraction,
      notchFlowFraction,
      notchHead,
      phase,
      regime,
      sedimentRemainingFraction: 1 - 0.72 * contactDrive,
      waterLevel,
    };
  };

  const stateAtTime = (time) => stateAtPhase(time / cycleDuration);

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.16,
    roughness: 0.68,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.52,
  });
  const upperMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.58,
  });
  const lowerMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.58,
  });
  const contactMaterial = matte(PALETTE.brass, {
    metalness: 0.20,
    roughness: 0.48,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.20,
    roughness: 0.28,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const notchFlowMaterial = matte(PALETTE.fluid, {
    opacity: 0.58,
    roughness: 0.24,
    side: THREE.DoubleSide,
    transparent: true,
  });
  notchFlowMaterial.depthWrite = false;
  const bedFlowMaterial = notchFlowMaterial.clone();
  const sedimentMaterial = matte(PALETTE.brass, {
    roughness: 0.88,
  });

  const foundation = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(7.0, 0.17, 3.45),
    frameMaterial,
  ), 'fixed-channel-bed-beneath-self-acting-weir');
  foundation.position.set(0, groundY + 0.085, 0);
  root.add(foundation);

  const channelBanks = addRole(new THREE.Group(),
    'fixed-parallel-channel-side-walls');
  root.add(channelBanks);
  for (const z of [-1.64, 1.64]) {
    const bank = new THREE.Mesh(
      new THREE.BoxGeometry(7.0, 0.48, 0.17),
      frameMaterial,
    );
    bank.position.set(0, 0.11, z);
    channelBanks.add(bank);
  }

  const upperLeaf = addRole(new THREE.Group(),
    'larger-upper-leaf-turning-downstream-about-below-center-pivot');
  upperLeaf.position.copy(upperPivot);
  root.add(upperLeaf);
  const upperBodyHeight = upperTopLocal + upperPivotFromBottom;
  const upperBody = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(upperThickness, upperBodyHeight, gateWidth),
    upperMaterial,
  ), 'upper-leaf-plank-with-central-overflow-notch');
  upperBody.position.y = (-upperPivotFromBottom + upperTopLocal) / 2;
  upperLeaf.add(upperBody);
  // The two shoulders beside the notch rise from the body's full-width
  // part below the sill to the leaf top (geometry built below).
  const upperShoulders = [-1, 1].map((sign) => {
    const shoulder = addRole(new THREE.Mesh(new THREE.BufferGeometry(), upperMaterial),
      `upper-leaf-${sign < 0 ? 'far' : 'near'}-shoulder-beside-notch`);
    shoulder.userData.zRange = sign < 0 ? [-gateWidth / 2, -notchWidth / 2] : [notchWidth / 2, gateWidth / 2];
    upperLeaf.add(shoulder);
    return shoulder;
  });
  // The battens stay below the notch sill.
  const upperReinforcements = [-0.34, 0.20, 0.60].map((y, index) => {
    const rail = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.075, gateWidth + 0.09),
      darkMaterial,
    ), `upper-leaf-transverse-reinforcement-${index + 1}`);
    rail.position.set(-upperThickness / 2 - 0.025, y, 0);
    upperLeaf.add(rail);
    return rail;
  });
  const upperContactEdge = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.10, gateWidth + 0.12),
    contactMaterial,
  ), 'upper-leaf-upstream-bottom-edge-sliding-on-lower-leaf-face');
  upperContactEdge.position.set(
    -upperThickness / 2 - 0.0275,
    -upperPivotFromBottom,
    0,
  );
  upperLeaf.add(upperContactEdge);

  const lowerLeaf = addRole(new THREE.Group(),
    'smaller-lower-leaf-turning-upstream-under-upper-edge-contact');
  lowerLeaf.position.copy(lowerPivot);
  root.add(lowerLeaf);
  const lowerBody = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(lowerThickness, lowerLength, gateWidth),
    lowerMaterial,
  ), 'lower-leaf-full-width-body');
  lowerBody.position.y = (lowerTopLocal - lowerPivotFromBottom) / 2;
  lowerLeaf.add(lowerBody);
  const lowerReinforcements = [0.03, 0.56].map((y, index) => {
    const rail = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.075, gateWidth + 0.09),
      darkMaterial,
    ), `lower-leaf-transverse-reinforcement-${index + 1}`);
    rail.position.set(lowerCentreOffset + lowerThickness / 2 + 0.025, y, 0);
    lowerLeaf.add(rail);
    return rail;
  });

  const makePivotAssembly = (pivot, name) => {
    const assembly = addRole(new THREE.Group(),
      `${name}-fixed-pivot-and-end-bearings`);
    root.add(assembly);
    const axle = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.095, gateWidth + 0.55, 24),
      darkMaterial,
    ), `${name}-fixed-pivot-axle`);
    axle.rotation.x = Math.PI / 2;
    axle.position.copy(pivot);
    assembly.add(axle);
    const bearings = [-1, 1].map((sign) => {
      const bearing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.18, 24),
        contactMaterial,
      );
      bearing.rotation.x = Math.PI / 2;
      bearing.position.set(pivot.x, pivot.y, sign * (gateWidth / 2 + 0.17));
      assembly.add(bearing);
      return bearing;
    });
    return { assembly, axle, bearings };
  };
  const upperPivotAssembly = makePivotAssembly(upperPivot, 'upper-leaf');
  const lowerPivotAssembly = makePivotAssembly(lowerPivot, 'lower-leaf');

  const upstreamWater = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(3.15, 1, 3.08),
    waterMaterial,
  ), 'variable-head-upstream-water-volume');
  upstreamWater.position.x = -1.655;
  root.add(upstreamWater);
  const downstreamWater = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(3.05, 1, 3.08),
    waterMaterial,
  ), 'lower-level-downstream-water-volume');
  downstreamWater.position.set(
    1.605,
    (channelFloorY + downstreamWaterLevel) / 2,
    0,
  );
  downstreamWater.scale.y = downstreamWaterLevel - channelFloorY;
  root.add(downstreamWater);

  const notchFlowCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.32, notchBottomY + 0.14, 0),
    new THREE.Vector3(0.04, notchBottomY + 0.08, 0),
    new THREE.Vector3(0.48, notchBottomY - 0.32, 0),
    new THREE.Vector3(0.95, notchBottomY - 1.12, 0),
    new THREE.Vector3(1.35, downstreamWaterLevel + 0.15, 0),
  ]);
  const notchFlow = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(notchFlowCurve, 56, 0.13, 12, false),
    notchFlowMaterial,
  ), 'ordinary-overflow-stream-through-upper-leaf-notch');
  root.add(notchFlow);

  const bedFlowCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.45, 0.16, 0),
    new THREE.Vector3(-0.48, 0.13, 0),
    new THREE.Vector3(0.35, 0.12, 0),
    new THREE.Vector3(1.55, 0.16, 0),
  ]);
  const bedFlow = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(bedFlowCurve, 48, 0.16, 12, false),
    bedFlowMaterial,
  ), 'open-bed-scouring-flow-past-separated-leaves');
  root.add(bedFlow);

  // A low deposit bank lying across the whole channel on the bed, like
  // Brown's scoured deposit below the opened leaves, not a loose disc.
  const sedimentShape = new THREE.Shape();
  sedimentShape.moveTo(-0.52, 0);
  for (let i = 1; i < 32; i += 1) {
    const x = -0.52 + 1.04 * i / 32;
    sedimentShape.lineTo(x, 0.11 * Math.sqrt(Math.max(0, 1 - (x / 0.52) ** 2)));
  }
  sedimentShape.lineTo(0.52, 0);
  sedimentShape.closePath();
  const sedimentGeometry = new THREE.ExtrudeGeometry(sedimentShape, { depth: gateWidth - 0.10, bevelEnabled: false });
  sedimentGeometry.translate(0, 0, -(gateWidth - 0.10) / 2);
  const sedimentBank = addRole(new THREE.Mesh(
    sedimentGeometry,
    sedimentMaterial,
  ), 'bed-deposit-reduced-by-open-scouring-sluice');
  sedimentBank.scale.set(1.45, 1, 1);
  sedimentBank.position.set(0.82, channelFloorY, 0);
  root.add(sedimentBank);

  const update = (time) => {
    const state = stateAtTime(time);
    upperLeaf.rotation.z = state.upperAngle;
    lowerLeaf.rotation.z = state.lowerAngle;
    notchFlow.visible = state.notchFlowFraction > 1e-4;
    notchFlowMaterial.opacity = 0.18 + 0.44 * state.notchFlowFraction;
    bedFlow.visible = state.bedFlowFraction > 1e-4;
    bedFlowMaterial.opacity = 0.16 + 0.46 * state.bedFlowFraction;
    sedimentBank.scale.x = 1.45 * state.sedimentRemainingFraction;
    sedimentBank.scale.y = Math.max(1e-3, state.sedimentRemainingFraction);
    root.userData.updateWorkingParts?.(state);
  };

  const sourceState = stateAtPhase(0);
  const sourceOpenState = stateAtDrive(1);
  const geometry = {
    channelFloorY,
    closingEndPhase,
    cycleDuration,
    downstreamWaterLevel,
    drainEndPhase,
    floodWaterLevel,
    gateWidth,
    groundY,
    lowerLength,
    lowerCentreOffset,
    lowerPivot,
    lowerPivotFromBottom,
    lowerThickness,
    lowerTopLocal,
    maximumUpperAngle,
    notchBottomLocal,
    notchBottomY,
    notchDepth,
    notchWidth,
    openingEndPhase,
    ordinaryWaterLevel,
    riseEndPhase,
    streamDirection,
    upperLength,
    upperPivot,
    upperPivotFromBottom,
    upperThickness,
    upperTopLocal,
  };
  root.userData = {
    archetype:
      'self-acting-two-leaf-weir-with-overlap-contact-notch-overflow-and-bed-scour-opening',
    blocks: {
      bedFlow,
      channelBanks,
      downstreamWater,
      foundation,
      lowerBody,
      lowerLeaf,
      lowerPivotAssembly,
      lowerReinforcements,
      notchFlow,
      sedimentBank,
      upperBody,
      upperContactEdge,
      upperLeaf,
      upperPivotAssembly,
      upperReinforcements,
      upperShoulders,
      upstreamWater,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      lowerLeafIndependent: false,
      operatingDegreesOfFreedom: 1,
      upperLeafHydraulicTriggerDemonstration: true,
    },
    dynamics: {
      freeSurfacePressureDistributionImpactTurbulenceSedimentTransportBearingFrictionAndGateInertiaModeled:
        false,
      hydraulicDemonstration:
        'A C2 scheduled water-level cycle demonstrates the described ordinary overflow, flood opening, bed scour, and reclosure. It is not a computational-fluid or rigid-body dynamics solution, and Brown supplies no timing.',
      overlapConstraint:
        'At every opening state, the upstream bottom edge of the upper leaf lies exactly on the downstream face of the lower leaf. The lower angle is solved from this sliding unilateral-contact geometry and is never independently prescribed.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Two unequal leaves pivot below their centers across a left-to-right stream. At ordinary head they stand vertical and overlap, while the ordinary flow leaves through a notch cut down from the top of the upper leaf, below its shoulders. Rising head turns the much larger upper leaf downstream; its upstream bottom edge slides along and pushes the lower leaf upstream, opening a bed-level scouring passage. Falling head permits the same contact-coupled pair to return vertical.',
    motion: {
      cycleDuration,
      motionType:
        'C2-flood-cycle-driving-one-upper-leaf-with-contact-solved-opposed-lower-leaf',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      sourcePrescribedAbsoluteTiming: false,
      sourcePrescribedNormalizedTiming: false,
    },
    sourceOpenPose: {
      contactPoint: sourceOpenState.contactPoint.clone(),
      lowerAngle: sourceOpenState.lowerAngle,
      upperAngle: sourceOpenState.upperAngle,
    },
    sourcePose: {
      contactPoint: sourceState.contactPoint.clone(),
      lowerAngle: sourceState.lowerAngle,
      upperAngle: sourceState.upperAngle,
      waterLevel: sourceState.waterLevel,
    },
    sourceReference: {
      brownPlate463: {
        approximateClosedLowerLeafBoundsPixels: [96, 336, 40, 120],
        approximateClosedUpperLeafBoundsPixels: [117, 183, 30, 236],
        approximateOpenLowerLeafBoundsPixels: [283, 336, 84, 137],
        approximateOpenUpperLeafBoundsPixels: [315, 193, 96, 151],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 15,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'two leaves pivot below their centers',
          'the much larger upper leaf turns in the direction of the stream',
          'the lower leaf turns against the stream',
          'the top of the lower leaf overlaps the bottom of the upper leaf',
          'ordinary flow passes through a notch in the upper leaf',
          'rising water opens a bed passage that releases deposit',
        ],
        engravingEvidence:
          'Brown places a closed vertical pair and an open opposed-rotation pair side by side. The open upper leaf leans downstream, the lower leaf leans upstream, overflow falls to the downstream side, and the opened lower edge exposes the channel bed.',
        reconstructionDisclosure:
          'Brown gives no leaf dimensions, pivot coordinates, thickness, channel width, water levels, contact-face offset, opening angles, pressure law, return law or timing. Dimensions, a 40-degree maximum upper angle, exact sliding-contact closure, a twelve-second C2 explanatory cycle, colors and idealized water streams are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 463',
    },
    stateAtDrive,
    stateAtPhase,
    stateAtTime,
    transmission: {
      contactConstraint:
        'upper bottom upstream edge lies on lower downstream face; lower rotation follows from the circle-line intersection branch continuous from the vertical pose',
      directions:
        'stream +x; upper rotation negative about +z (downstream); lower rotation positive about +z (upstream)',
      overlap:
        'The lower top extends above the upper bottom contact coordinate throughout the modeled opening range.',
    },
    update,
  };
  correctWeir(root);
  // Brown's section draws the pivots only as pins through the leaves; the
  // channel walls that would carry them lie in front of and behind the
  // section plane. The fixed pins therefore end flush with the leaf ends
  // (the channel-wall planes that also bound the water), with no stub
  // bearings standing out in open air.
  for (const assembly of [upperPivotAssembly, lowerPivotAssembly]) {
    assembly.axle.geometry.dispose();
    assembly.axle.geometry = new THREE.CylinderGeometry(0.095, 0.095, gateWidth, 32);
    for (const bearing of assembly.bearings) bearing.visible = false;
  }
  // Keep the lower leaf's battens on its upstream face, which carries its
  // pivot.
  lowerReinforcements.forEach((rail) => { rail.position.x = -0.025; });
  // The shared correction bores the leaves at its thin-board thickness;
  // rebuild them as Brown's planks with the same bored pivot bosses.
  for (const [body, length, offset, thickness] of [
    [upperBody, upperBodyHeight, (-upperPivotFromBottom + upperTopLocal) / 2, upperThickness],
    [lowerBody, lowerLength, (lowerTopLocal - lowerPivotFromBottom) / 2, lowerThickness],
  ]) {
    const x0 = body === lowerBody ? lowerCentreOffset : 0;
    const plank = poly([[x0 - thickness / 2, offset - length / 2], [x0 + thickness / 2, offset - length / 2],
      [x0 + thickness / 2, offset + length / 2], [x0 - thickness / 2, offset + length / 2]]);
    const bored = polygonClipping.difference(polygonClipping.union(plank,
      poly(circle([0, 0], 0.16, 64))), poly(circle([0, 0], 0.097, 64)));
    body.geometry.dispose();
    if (body === upperBody) {
      // Full width below the notch sill; the two shoulders rise beside the
      // notch to the leaf top.
      const sill = notchBottomLocal;
      // The brass contact strip along the upstream bottom edge is let into
      // a rebate in the plank, so the strip alone owns the faces there (a
      // strip laid flush over the plank's faces z-fights with them).
      const strip = upperContactEdge.geometry.parameters, at = upperContactEdge.position;
      const rebate = poly([[at.x - strip.width / 2 - 0.05, at.y - strip.height / 2 - 0.05], [at.x + strip.width / 2, at.y - strip.height / 2 - 0.05],
        [at.x + strip.width / 2, at.y + strip.height / 2], [at.x - strip.width / 2 - 0.05, at.y + strip.height / 2]]);
      const below = polygonClipping.difference(polygonClipping.intersection(bored, poly([[-1, offset - length / 2 - 1],
        [1, offset - length / 2 - 1], [1, sill], [-1, sill]])), rebate);
      const shoulder = poly([[x0 - thickness / 2, sill], [x0 + thickness / 2, sill],
        [x0 + thickness / 2, upperTopLocal], [x0 - thickness / 2, upperTopLocal]]);
      body.geometry = plate(below, -gateWidth / 2, gateWidth / 2);
      for (const mesh of upperShoulders) {
        mesh.geometry.dispose();
        mesh.geometry = plate(shoulder, ...mesh.userData.zRange);
      }
    } else {
      body.geometry = plate(bored, -gateWidth / 2, gateWidth / 2);
    }
  }
  // Head and tail water are translucent bodies across the channel width.
  // The head water's downstream boundary is the leaves themselves: its
  // section runs along the lower leaf's upstream face, over that leaf's top,
  // down to where the upper leaf's bottom edge bears on it, and up the upper
  // leaf's upstream face to the free surface, so when the upper leaf leans
  // the water follows it instead of standing as an unsupported vertical face.
  // The tail water starts at the lower leaf's downstream face. The notch
  // overflow is a falling sheet the width of the notch.
  // Pass 88: every water face that meets a solid (the bed, the leaves' faces
  // and the channel-wall planes that bound the leaves' ends) stands 0.008
  // off it inside the water, so no water face is coplanar with a solid face
  // (z-fighting). When the lower leaf lifts off the bed, head water, scour
  // passage and tail water are one connected body, so they are drawn as one
  // closed section: the head body's outline then runs down the lower leaf's
  // downstream face, under its bottom edge and out along the bed to the tail
  // (no separate scour volume sharing faces with them).
  // (Every piece keeps its geometry object; only vertices and transforms move.)
  {
    const water = waterVolumeMaterial();
    const wet = 0.008;
    const halfWidth = gateWidth / 2 - wet;
    const onLeaf = (pivot, angle, x, y) => new THREE.Vector2(
      pivot.x + x * Math.cos(angle) - y * Math.sin(angle),
      pivot.y + x * Math.sin(angle) + y * Math.cos(angle));
    const maxSection = 13;
    const sectionBody = () => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((4 * maxSection - 4) * 9), 3));
      return geometry;
    };
    upstreamWater.geometry.dispose();
    upstreamWater.geometry = sectionBody();
    upstreamWater.material = water;
    upstreamWater.renderOrder = 1;
    upstreamWater.position.set(0, 0, 0);
    // The tail water and the scour flow are drawn by the one water mesh
    // (above); their separate volumes are retired.
    downstreamWater.removeFromParent();
    bedFlow.removeFromParent();
    const headLeftX = -3.30, tailRightX = 3.40;
    const lineAtY = (point, direction, y) => point.clone()
      .addScaledVector(direction, (y - point.y) / direction.y);
    // Offsets a counter-clockwise outline: each edge flagged wet (lying on a
    // solid) moves `wet` into the water, and each corner becomes the meeting
    // of its neighbouring (moved) edges; zero-length edges are skipped. Where
    // the neighbouring edges are so nearly parallel that their meeting runs
    // off (a leaf a hair off upright beside the vertical rise to the surface,
    // not a fold-back wedge), the corner just moves by both edges' offsets.
    const insetOutline = (points, wetEdges) => {
      const n = points.length, lines = [];
      for (let i = 0; i < n; i += 1) {
        const a = points[i], b = points[(i + 1) % n], d = b.clone().sub(a), length = d.length();
        if (length < 1e-9) { lines.push(null); continue; }
        d.divideScalar(length);
        const normal = new THREE.Vector2(-d.y, d.x);
        lines.push({ point: a.clone().addScaledVector(normal, wetEdges[i] ? wet : 0), d, normal, offset: wetEdges[i] ? wet : 0 });
      }
      const find = (i, step) => { for (let k = 0; k < n; k += 1) { const line = lines[(i + step * k + n) % n]; if (line) return line; } return null; };
      return points.map((p, i) => {
        const before = find(i - 1, -1), after = find(i, 1);
        const cross = before.d.x * after.d.y - before.d.y * after.d.x;
        if (Math.abs(cross) < 1e-9) return p.clone().addScaledVector(after.normal, Math.max(before.offset, after.offset));
        const w = after.point.clone().sub(before.point);
        const t = (w.x * after.d.y - w.y * after.d.x) / cross;
        const meet = before.point.clone().addScaledVector(before.d, t);
        // (A fold-back wedge's meeting is its true inset apex, far or not.)
        if (meet.distanceTo(p) <= 4 * wet || before.d.dot(after.d) < 0) return meet;
        return p.clone().addScaledVector(before.normal, before.offset).addScaledVector(after.normal, after.offset);
      });
    };
    // Fills one mesh with the closed prisms of one or more disjoint sections.
    const fillSection = (mesh, sections) => {
      const positions = mesh.geometry.attributes.position.array;
      let k = 0;
      const put = (point, z) => { positions[k++] = point.x; positions[k++] = point.y; positions[k++] = z; };
      for (const section of sections) {
        let triangles = THREE.ShapeUtils.triangulateShape(section, []);
        const ccw = !THREE.ShapeUtils.isClockWise(section);
        if (!ccw) triangles = triangles.map(([a, b, c]) => [a, c, b]);
        for (const [a, b, c] of triangles) {
          put(section[a], halfWidth); put(section[b], halfWidth); put(section[c], halfWidth);
          put(section[a], -halfWidth); put(section[c], -halfWidth); put(section[b], -halfWidth);
        }
        for (let i = 0; i < section.length; i += 1) {
          const p = section[i], q = section[(i + 1) % section.length];
          const [m, n] = ccw ? [p, q] : [q, p];
          put(m, -halfWidth); put(n, -halfWidth); put(n, halfWidth);
          put(m, -halfWidth); put(n, halfWidth); put(m, halfWidth);
        }
      }
      const used = k;
      // Unused slots collapse onto the first corner (no stray bounds).
      while (k < positions.length) put(sections[0][0], halfWidth);
      mesh.geometry.setDrawRange(0, used / 3);
      mesh.geometry.attributes.position.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      mesh.geometry.computeBoundingBox();
      mesh.geometry.computeBoundingSphere();
    };
    const bedPoint = (x) => new THREE.Vector2(x, channelFloorY);
    const updateHeadWater = (state) => {
      const ua = state.upperAngle, la = state.lowerAngle;
      const lowerAxis = new THREE.Vector2(-Math.sin(la), Math.cos(la));
      const upperAxis = new THREE.Vector2(-Math.sin(ua), Math.cos(ua));
      const lowerTopUp = onLeaf(lowerPivot, la, lowerCentreOffset - lowerThickness / 2, lowerTopLocal);
      const lowerTopDown = onLeaf(lowerPivot, la, lowerCentreOffset + lowerThickness / 2, lowerTopLocal);
      const lowerBottomUp = onLeaf(lowerPivot, la, lowerCentreOffset - lowerThickness / 2, -lowerPivotFromBottom);
      const lowerBottomDown = onLeaf(lowerPivot, la, lowerCentreOffset + lowerThickness / 2, -lowerPivotFromBottom);
      const upperBottomUp = onLeaf(upperPivot, ua, -upperThickness / 2, -upperPivotFromBottom);
      // Where the upper leaf's upstream face meets the lower leaf's
      // downstream face (the bearing contact); when the two faces are
      // parallel (closed), the corner is the lower leaf's top.
      let corner = lowerTopDown.clone();
      const det = lowerAxis.x * upperAxis.y - lowerAxis.y * upperAxis.x;
      if (Math.abs(det) > 1e-6) {
        const d = upperBottomUp.clone().sub(lowerTopDown);
        const t = (d.x * upperAxis.y - d.y * upperAxis.x) / det;
        if (t < 0) corner = lowerTopDown.clone().addScaledVector(lowerAxis, t);
        // A wedge between the leaves too thin to hold water once both faces
        // are inset (its inset apex would rise past the lower leaf's top) is
        // left dry: the water crosses its mouth at the lower leaf's top level
        // to the upper leaf's face, and the wedge fills from the mouth down
        // as it opens.
        const halfAngle = Math.acos(THREE.MathUtils.clamp(lowerAxis.dot(upperAxis), -1, 1)) / 2;
        if (wet / Math.max(Math.tan(halfAngle), 1e-12) >= corner.distanceTo(lowerTopDown)) corner = lineAtY(corner, upperAxis, lowerTopDown.y);
      }
      // Up the upper leaf's upstream face to its crest, then straight up to
      // the free surface standing over the crest (the head that spills);
      // the water never overhangs the turned leaf's downstream side.
      const upperTopUp = onLeaf(upperPivot, ua, -upperThickness / 2, upperTopLocal);
      const faceTop = lineAtY(corner, upperAxis, Math.min(upperTopUp.y, state.waterLevel - 0.002 - 2 * wet));
      const surface = new THREE.Vector2(faceTop.x, state.waterLevel);
      const head = [lowerTopUp, lowerTopDown, corner, faceTop, surface, new THREE.Vector2(headLeftX, state.waterLevel)];
      // The short rise from the crest face to the surface lies on the upper
      // leaf's face plane while that leaf stands upright, so it is wet too.
      const headWet = [true, true, true, true, false, false];
      const tailTop = lineAtY(lowerTopDown, lowerAxis, downstreamWaterLevel);
      const tail = [new THREE.Vector2(tailRightX, downstreamWaterLevel), tailTop];
      const passage = Math.min(lowerBottomUp.y, lowerBottomDown.y) - channelFloorY;
      // One body: bed, tail, down the lower leaf's downstream face, under
      // its bottom edge, up its upstream face and on round the head. It is
      // used once the inset passage under the (tilted) bottom edge is open at
      // both corners, so the outline never crosses the inset bed.
      const joined = passage > 2 * wet + 1e-4 ? insetOutline(
        [bedPoint(headLeftX), bedPoint(tailRightX), ...tail, lowerBottomDown, lowerBottomUp, ...head],
        [true, false, false, true, true, true, ...headWet]) : null;
      if (joined && Math.min(joined[4].y, joined[5].y) > channelFloorY + wet + 1e-4) {
        fillSection(upstreamWater, [joined]);
      } else {
        // Head and tail are two bodies parted by the seated lower leaf, drawn
        // in the same mesh, so the water does not switch meshes (or pop) as
        // the passage opens; the tail region is the same in both cases.
        // The tail runs down the lower leaf's downstream face and in under
        // its raised bottom edge (the turned leaf rests on, or has just
        // lifted from, its upstream bottom corner) to where that edge's line
        // meets the bed; once inset, the recess's apex lies under the leaf
        // and reaches the upstream corner just as the passage opens, so the
        // passage opens into water already standing there. A recess too thin
        // to hold water once inset (its apex would pass the downstream
        // corner) is left dry: the tail then drops straight from that corner
        // to the bed (or, with the corner within the inset of the bed, its
        // downstream face runs on down to the bed).
        let tailSection, tailWet;
        const recessDepth = (lowerBottomDown.y - channelFloorY) / Math.max(Math.sin(la), 1e-12);
        if (lowerBottomDown.y - channelFloorY < 2 * wet) {
          tailSection = [lineAtY(lowerTopDown, lowerAxis, channelFloorY), bedPoint(tailRightX), ...tail];
          tailWet = [true, false, false, true];
        } else if (wet / Math.tan(la / 2) >= recessDepth) {
          tailSection = [bedPoint(lowerBottomDown.x), bedPoint(tailRightX), ...tail, lowerBottomDown];
          tailWet = [true, false, false, true, false];
        } else {
          const contact = lowerBottomDown.clone().addScaledVector(
            lowerBottomUp.clone().sub(lowerBottomDown).normalize(), recessDepth);
          tailSection = [contact, bedPoint(tailRightX), ...tail, lowerBottomDown];
          tailWet = [true, false, false, true, true];
        }
        fillSection(upstreamWater, [insetOutline(
          [bedPoint(headLeftX), lineAtY(lowerTopUp, lowerAxis, channelFloorY), ...head],
          [true, true, ...headWet]), insetOutline(tailSection, tailWet)]);
      }
    };
    // Falling sheet over the notch crest, the notch wide. Its depth over the
    // crest follows the notch discharge (depth ~ q^(2/3), with q the scheduled
    // notch flow, the ordinary flow giving the ordinary head), it thins as it
    // accelerates down a parabolic nappe, throws farther the deeper it runs,
    // and breaks into spray where it lands in the tail water. It starts on
    // the notch crest of the (possibly turning) upper leaf and dwindles to
    // nothing as the flow stops, rather than switching off.
    const ordinaryNotchFraction = 0.48;
    const ordinarySheetHalfDepth = (ordinaryWaterLevel - notchBottomY) / 2;
    const sheetHalfWidth = notchWidth / 2 - 0.02;
    const nappe = Array.from({ length: 12 }, () => new THREE.Vector3());
    const nappeCurve = new THREE.CatmullRomCurve3(nappe);
    const nappeOptions = (flow) => {
      const halfDepth = Math.max(1e-4, ordinarySheetHalfDepth * flow ** (2 / 3));
      return {
        radius: halfDepth, endRadius: halfDepth * 0.5,
        // At a trickle the sheet draws in to a thin thread and vanishes.
        width: sheetHalfWidth * Math.min(1, flow / 0.35),
        // The spray flares the sheet; it stays inside the channel width.
        endWidth: sheetHalfWidth / 1.35 * Math.min(1, flow / 0.35),
        widthAxis: new THREE.Vector3(0, 0, 1), segments: 80, radialSegments: 24,
        fadeStart: 0.86, flare: 1.35,
      };
    };
    const layNappe = (state, flow) => {
      const ua = state.upperAngle;
      const halfDepth = ordinarySheetHalfDepth * flow ** (2 / 3);
      const lift = halfDepth + 0.004;
      const approach = onLeaf(upperPivot, ua, -upperThickness / 2 - 0.12, notchBottomLocal + lift);
      const up = onLeaf(upperPivot, ua, -upperThickness / 2, notchBottomLocal + lift);
      const crest = onLeaf(upperPivot, ua, 0, notchBottomLocal + lift);
      const down = onLeaf(upperPivot, ua, upperThickness / 2, notchBottomLocal + lift);
      const landY = downstreamWaterLevel - 0.10;
      // A turned leaf leans its downstream face out under the sheet; the
      // water leaving its sloping crest is thrown at least clear of it.
      // The sheet lands inside the drawn tail water, short of its end.
      const throwX = Math.min(3.05 - down.x, Math.max(1.26 * Math.max(0.12, flow ** (1 / 3)),
        (down.y - landY) * Math.tan(Math.abs(ua)) + 0.30));
      nappe[0].set(approach.x, approach.y, 0);
      nappe[1].set(up.x, up.y, 0);
      nappe[2].set(crest.x, crest.y, 0);
      // The sheet leaves the crest along its slope and falls on a parabola.
      const slope = Math.max(Math.tan(ua), -(down.y - landY) / throwX);
      const drop = down.y + slope * throwX - landY;
      for (let i = 0; i <= 8; i += 1) {
        const u = i / 8;
        nappe[3 + i].set(down.x + throwX * u, down.y + slope * throwX * u - drop * u * u, 0);
      }
      nappeCurve.updateArcLengths();
    };
    layNappe(stateAtPhase(0), 1);
    notchFlow.geometry.dispose();
    notchFlow.geometry = waterJetGeometry(nappeCurve, nappeOptions(1));
    notchFlow.geometry.userData.deforming = true;
    notchFlow.material = waterJetMaterial({ opacity: 0.42 });
    notchFlow.renderOrder = 1;
    const updateNappe = (state) => {
      const flow = state.notchFlowFraction / ordinaryNotchFraction;
      notchFlow.visible = flow > 1e-3;
      if (!notchFlow.visible) return;
      layNappe(state, flow);
      const next = waterJetGeometry(nappeCurve, nappeOptions(flow));
      for (const name of ['position', 'normal', 'color']) {
        notchFlow.geometry.attributes[name].array.set(next.attributes[name].array);
        notchFlow.geometry.attributes[name].needsUpdate = true;
      }
      next.dispose();
      notchFlow.geometry.computeBoundingBox();
      notchFlow.geometry.computeBoundingSphere();
    };
    const shared = root.userData.updateWorkingParts;
    root.userData.updateWorkingParts = (state) => {
      shared?.(state);
      updateHeadWater(state);
      updateNappe(state);
    };
    // The bed's top is the channel floor the water and the closed lower
    // leaf stand on.
    const bed = addRole(new THREE.Mesh(plate(poly([[-3.45, channelFloorY - 0.16], [3.45, channelFloorY - 0.16],
      [3.45, channelFloorY], [-3.45, channelFloorY]]), -gateWidth / 2, gateWidth / 2),
    matte(PALETTE.frame, { roughness: 0.7 })), 'fixed-channel-bed-under-weir');
    bed.material.fog = false;
    root.add(bed);
    Object.assign(root.userData.blocks, { bed });
  }
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.65, groundY - 0.02, -1.86),
    new THREE.Vector3(3.65, 3.64, 1.86),
  );
  root.userData.cameraDistanceScale = 1.04;
  // Brown's flat section: near-orthographic so the head volumes read as panels.
  root.userData.cameraDirection = new THREE.Vector3(0, 0.02, 1);
  root.userData.cameraFov = 9;
  root.userData.groundFloorY = groundY;
  markShadows(root);
  // The translucent head and tail water cast no opaque shadow (their
  // shadow striped the bed beneath them with acne).
  upstreamWater.castShadow = false;
  foundation.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredSelfActingWeirMovement(movement) {
  if (movement.id !== 463) return null;
  return selfActingWeir(movement);
}
