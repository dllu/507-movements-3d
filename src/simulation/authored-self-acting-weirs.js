import {correctWeir} from './chain-weir-working-parts.js';
import * as THREE from 'three';
import { plate, poly, circle, polygonClipping } from './finite-plate-geometry.js';
import { waterVolumeGeometry, waterVolumeMaterial } from './water-volume.js';
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
  const lowerPivotFromBottom = 0.30;
  const upperPivot = new THREE.Vector3(upperThickness / 2, 1.40, 0);
  const lowerPivot = new THREE.Vector3(-lowerThickness / 2, 0.30, 0);
  const upperTopLocal = upperLength - upperPivotFromBottom;
  const lowerTopLocal = lowerLength - lowerPivotFromBottom;
  const gateWidth = 2.40;
  const notchWidth = 0.70;
  const notchDepth = 0.78;
  const notchBottomLocal = upperTopLocal - notchDepth;
  const notchBottomY = upperPivot.y + notchBottomLocal;
  const maximumUpperAngle = THREE.MathUtils.degToRad(40);
  const cycleDuration = 12;
  const ordinaryWaterLevel = notchBottomY + 0.14;
  const floodWaterLevel = upperPivot.y + upperTopLocal - 0.18;
  const downstreamWaterLevel = 0.46;
  const channelFloorY = -0.05;
  const groundY = -0.22;
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
      (lowerThickness / 2) / contactRadius,
      -1,
      1,
    );
    let lowerAngle = polarAngle - Math.acos(faceOffsetRatio);
    if (Math.abs(lowerAngle) < 1e-12) lowerAngle = 0;
    const lowerAxis = panelAxis(lowerAngle);
    const lowerNormal = panelDownstreamNormal(lowerAngle);
    const lowerFaceReference = lowerPivot.clone().addScaledVector(
      lowerNormal,
      lowerThickness / 2,
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
    const lowerBottomCenter = lowerPivot.clone().addScaledVector(
      contact.lowerAxis,
      -lowerPivotFromBottom,
    );
    const lowerTopCenter = lowerPivot.clone().addScaledVector(
      contact.lowerAxis,
      lowerTopLocal,
    );
    return {
      ...contact,
      bedPassageHorizontalOpening: Math.max(
        0,
        lowerBottomCenter.x - lowerPivot.x,
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
    const notchHead = Math.max(0, waterLevel - notchBottomY);
    const notchFlowFraction = (1 - contactDrive)
      * (0.48 + 0.52 * floodFraction);
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
  const upperBodyHeight = notchBottomLocal + upperPivotFromBottom;
  const upperBody = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(upperThickness, upperBodyHeight, gateWidth),
    upperMaterial,
  ), 'upper-leaf-full-width-body-below-overflow-notch');
  upperBody.position.y = (-upperPivotFromBottom + notchBottomLocal) / 2;
  upperLeaf.add(upperBody);
  const shoulderWidth = (gateWidth - notchWidth) / 2;
  const upperShoulders = [-1, 1].map((sign, index) => {
    const shoulder = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(upperThickness, notchDepth, shoulderWidth),
      upperMaterial,
    ), index === 0
      ? 'upper-leaf-left-notch-shoulder'
      : 'upper-leaf-right-notch-shoulder');
    shoulder.position.set(
      0,
      notchBottomLocal + notchDepth / 2,
      sign * (notchWidth / 2 + shoulderWidth / 2),
    );
    upperLeaf.add(shoulder);
    return shoulder;
  });
  const upperReinforcements = [-0.34, 0.30, 0.94].map((y, index) => {
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
    rail.position.set(lowerThickness / 2 + 0.025, y, 0);
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
  sedimentBank.position.set(0.82, channelFloorY - 0.045, 0);
  root.add(sedimentBank);

  const update = (time) => {
    const state = stateAtTime(time);
    upperLeaf.rotation.z = state.upperAngle;
    lowerLeaf.rotation.z = state.lowerAngle;
    const upstreamDepth = state.waterLevel - channelFloorY;
    upstreamWater.scale.y = upstreamDepth;
    upstreamWater.position.y = channelFloorY + upstreamDepth / 2;
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
      'Two unequal leaves pivot below their centers across a left-to-right stream. At ordinary head they stand vertical and overlap, while water passes through the upper notch. Rising head turns the much larger upper leaf downstream; its upstream bottom edge slides along and pushes the lower leaf upstream, opening a bed-level scouring passage. Falling head permits the same contact-coupled pair to return vertical.',
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
  // The shared correction bores the leaves at its thin-board thickness;
  // rebuild them as Brown's planks with the same bored pivot bosses.
  for (const [body, length, offset, thickness] of [
    [upperBody, upperBodyHeight, (-upperPivotFromBottom + notchBottomLocal) / 2, upperThickness],
    [lowerBody, lowerLength, (lowerTopLocal - lowerPivotFromBottom) / 2, lowerThickness],
  ]) {
    const plank = poly([[-thickness / 2, offset - length / 2], [thickness / 2, offset - length / 2],
      [thickness / 2, offset + length / 2], [-thickness / 2, offset + length / 2]]);
    body.geometry.dispose();
    body.geometry = plate(polygonClipping.difference(polygonClipping.union(plank,
      poly(circle([0, 0], 0.16, 64))), poly(circle([0, 0], 0.097, 64))),
    -gateWidth / 2, gateWidth / 2);
  }
  // Head and tail water are translucent bodies across the channel width.
  // The head water runs up to the closed leaves' face (x = 0) and rises and
  // falls with the head; when the upper leaf leans downstream, a slab carried
  // on its upstream face, clipped to the head level and to x >= 0, fills the
  // wedge that opens between the leaves. The tail water starts at the closed
  // lower leaf's face. The notch overflow is a falling sheet the width of the
  // notch, and the scour flow fills the passage opened under the lower leaf.
  // (All pieces keep fixed geometry; only transforms and planes move.)
  {
    const water = waterVolumeMaterial();
    const halfWidth = gateWidth / 2;
    upstreamWater.geometry.dispose();
    upstreamWater.geometry = new THREE.BoxGeometry(3.30, 1, gateWidth);
    upstreamWater.material = water;
    upstreamWater.renderOrder = 1;
    upstreamWater.position.x = -1.65;
    downstreamWater.geometry.dispose();
    downstreamWater.geometry = waterVolumeGeometry({ xMin: 0, xMax: 3.40, surfaceY: downstreamWaterLevel, bottomY: channelFloorY, zMin: -halfWidth, zMax: halfWidth });
    downstreamWater.material = water;
    downstreamWater.renderOrder = 1;
    downstreamWater.scale.set(1, 1, 1);
    downstreamWater.position.set(0, 0, 0);
    const headLevelPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), ordinaryWaterLevel);
    const wedgeMaterial = water.clone();
    wedgeMaterial.clippingPlanes = [headLevelPlane, new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)];
    // In the leaf's frame the slab runs from the leaf bottom up to the flood
    // level line at the full lean, deep enough to reach the x = 0 plane.
    const face = -upperThickness / 2, wedgeDepth = 1.15;
    const floodLine = (x) => (floodWaterLevel - upperPivot.y
      - x * Math.sin(-maximumUpperAngle)) / Math.cos(maximumUpperAngle);
    const headWedge = addRole(new THREE.Mesh(
      plate(poly([[face - wedgeDepth, -upperPivotFromBottom], [face, -upperPivotFromBottom],
        [face, floodLine(face)], [face - wedgeDepth, floodLine(face - wedgeDepth)]]), -halfWidth, halfWidth),
      wedgeMaterial,
    ), 'head-water-wedge-behind-leaning-upper-leaf');
    headWedge.renderOrder = 1;
    upperLeaf.add(headWedge);
    root.userData.localClippingEnabled = true;
    // Falling sheet over the notch crest: a flattened tube whose section is
    // the ordinary head deep and the notch wide, on a parabolic nappe.
    const crestY = notchBottomY + (ordinaryWaterLevel - notchBottomY) / 2 + 0.015;
    const landX = 1.36, faceX = upperThickness;
    const nappe = [new THREE.Vector3(-0.30, crestY, 0), new THREE.Vector3(0, crestY, 0)];
    for (let i = 0; i <= 8; i += 1) {
      const u = i / 8, x = faceX + (landX - faceX) * u;
      nappe.push(new THREE.Vector3(x, crestY - (crestY - downstreamWaterLevel + 0.10) * u * u, 0));
    }
    const sheetHalfDepth = (ordinaryWaterLevel - notchBottomY) / 2;
    notchFlow.geometry.dispose();
    notchFlow.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(nappe), 80, sheetHalfDepth, 16, false)
      .scale(1, 1, (notchWidth / 2 - 0.02) / sheetHalfDepth);
    notchFlow.material = water;
    notchFlow.renderOrder = 1;
    bedFlow.geometry.dispose();
    bedFlow.geometry = new THREE.BoxGeometry(1, 1, gateWidth);
    bedFlow.material = water;
    bedFlow.renderOrder = 1;
    const onLeaf = (pivot, angle, x, y) => new THREE.Vector2(
      pivot.x + x * Math.cos(angle) - y * Math.sin(angle),
      pivot.y + x * Math.sin(angle) + y * Math.cos(angle));
    const shared = root.userData.updateWorkingParts;
    root.userData.updateWorkingParts = (state) => {
      shared?.(state);
      headLevelPlane.constant = state.waterLevel;
      headWedge.visible = state.upperAngle < -1e-4;
      if (bedFlow.visible) {
        const la = state.lowerAngle;
        const lowerBottomUp = onLeaf(lowerPivot, la, -lowerThickness / 2, -lowerPivotFromBottom);
        const lowerBottomDown = onLeaf(lowerPivot, la, lowerThickness / 2, -lowerPivotFromBottom);
        const x0 = lowerBottomUp.x, x1 = Math.max(0, lowerBottomDown.x);
        const top = Math.min(lowerBottomUp.y, lowerBottomDown.y);
        bedFlow.scale.set(Math.max(0.001, x1 - x0), Math.max(0.001, top - channelFloorY), 1);
        bedFlow.position.set((x0 + x1) / 2, (top + channelFloorY) / 2, 0);
      }
    };
    Object.assign(root.userData.blocks, { headWedge });
    const bed = addRole(new THREE.Mesh(plate(poly([[-3.45, channelFloorY - 0.16], [3.45, channelFloorY - 0.16],
      [3.45, channelFloorY - 0.045], [-3.45, channelFloorY - 0.045]]), -gateWidth / 2, gateWidth / 2),
    matte(PALETTE.frame, { roughness: 0.7 })), 'fixed-channel-bed-under-weir');
    bed.material.fog = false;
    root.add(bed);
    Object.assign(root.userData.blocks, { bed });
  }
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.65, groundY - 0.02, -1.86),
    new THREE.Vector3(3.65, 3.58, 1.86),
  );
  root.userData.cameraDistanceScale = 1.04;
  // Brown's flat section: near-orthographic so the head volumes read as panels.
  root.userData.cameraDirection = new THREE.Vector3(0, 0.02, 1);
  root.userData.cameraFov = 9;
  root.userData.groundFloorY = groundY;
  markShadows(root);
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
