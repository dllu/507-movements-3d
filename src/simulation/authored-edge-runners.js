import { correctRunnerTreadParts, finishRunnerTread } from './treadwheel-working-parts.js';
import { correctEdgeRunnerBevels } from './edge-runner-bevel-parts.js';
import * as THREE from 'three';
import { makePitchConeGear } from './authored-dynamometers.js';
import {
  PALETTE,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongX(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongY(radius, length, material, segments = 32) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function makeEdgeRunner({ axis, color, radius, width }) {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.add(rotor);
  root.quaternion.setFromUnitVectors(Z_AXIS, axis.clone().normalize());
  root.userData.axis = axis.clone().normalize();
  root.userData.radius = radius;
  root.userData.rotor = rotor;
  root.userData.width = width;

  const stoneMaterial = matte(color, {
    metalness: 0.03,
    roughness: 0.88,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.20,
    roughness: 0.52,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.46 });
  const stone = cylinderAlongZ(radius, width, stoneMaterial, 64);
  stone.userData.role = 'solid-cylindrical-edge-runner-stone';
  rotor.add(stone);
  const tread = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.94, radius * 0.06, 10, 72),
    darkMaterial,
  );
  tread.userData.role = 'edge-runner-circumferential-grinding-tread';
  tread.visible = false; // ink edge line only: kept for references, not drawn
  tread.userData.retiredInkOutline = true;
  rotor.add(tread);
  const hub = cylinderAlongZ(radius * 0.15, width * 1.34,
    darkMaterial, 28);
  hub.userData.role = 'edge-runner-bearing-hub';
  rotor.add(hub);
  const faceRings = [];
  const faceIndices = [];
  for (const side of [-1, 1]) {
    const faceRing = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.64, 0.025, 8, 56),
      darkMaterial,
    );
    faceRing.position.z = side * width * 0.51;
    faceRing.visible = false; // ink edge line only: kept for references, not drawn
    faceRing.userData.retiredInkOutline = true;
    rotor.add(faceRing);
    faceRings.push(faceRing);
    const index = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.62, 0.050, 0.026),
      whiteMaterial,
    );
    index.position.set(radius * 0.38, 0, side * width * 0.54);
    index.userData.role =
      'white-index-showing-edge-runner-spin-on-both-faces';
    rotor.add(index);
    faceIndices.push(index);
  }
  root.userData.faceIndices = faceIndices;
  root.userData.faceRings = faceRings;
  root.userData.stone = stone;
  root.userData.tread = tread;
  return markShadows(root);
}

function pairedEdgeRunnerMill(movement) {
  const root = new THREE.Group();

  const carrierPeriod = 4;
  const carrierAngularSpeed = FULL_TURN / carrierPeriod;
  // Brown draws both runners exactly edge-on at the sides of the pan.
  const carrierStartAngle = 0;
  // The plate's runners stand nearly as tall as the frame opening: their
  // radius about equals the track radius (97 px against 110 px) and their
  // width is about 0.3 of their diameter, so one carrier turn is one runner
  // counter-turn.
  const trackRadius = 1.20;
  const runnerRadius = 1.20;
  const runnerWidth = 0.66;
  const runnerRadiusRatio = trackRadius / runnerRadius;
  const panFloorY = -1.40;
  const runnerCenterY = panFloorY + runnerRadius;
  const runnerStartAngle = THREE.MathUtils.degToRad(14);
  const verticalShaftX = 0;
  const verticalShaftZ = 0;

  const largeGearTeeth = 36;
  const inputPinionTeeth = 12;
  const bevelRatio = largeGearTeeth / inputPinionTeeth;
  const bevelModule = 0.075;
  const largeGearPitchRadius = largeGearTeeth * bevelModule / 2;
  const inputPinionPitchRadius = inputPinionTeeth * bevelModule / 2;
  const largePitchConeAngle = Math.atan(bevelRatio);
  const pinionPitchConeAngle = Math.atan(1 / bevelRatio);
  const commonConeDistance = largeGearPitchRadius
    / Math.sin(largePitchConeAngle);
  const largeOuterAxialDistance = largeGearPitchRadius
    / Math.tan(largePitchConeAngle);
  const pinionOuterAxialDistance = inputPinionPitchRadius
    / Math.tan(pinionPitchConeAngle);
  const largeInnerAxialDistance = largeOuterAxialDistance * 0.28;
  const pinionInnerAxialDistance = pinionOuterAxialDistance * 0.28;
  const largeGearToothHeight = bevelModule * 1.75;
  const pinionToothHeight = bevelModule * 1.75;
  const bevelApex = new THREE.Vector3(0, 2.16, 0);
  const bevelContactPoint = bevelApex.clone().add(
    new THREE.Vector3(
      pinionOuterAxialDistance,
      -largeOuterAxialDistance,
      0,
    ),
  );
  const inputAngularSpeed = bevelRatio * carrierAngularSpeed;
  const inputStartAngle = THREE.MathUtils.degToRad(5);

  const stateAtTime = (time) => {
    const carrierTravel = carrierAngularSpeed * time;
    const carrierAngle = carrierStartAngle + carrierTravel;
    const runnerSpinAngle = runnerStartAngle
      - runnerRadiusRatio * carrierTravel;
    const runnerLocalAngularSpeed = -runnerRadiusRatio
      * carrierAngularSpeed;
    const inputTravel = inputAngularSpeed * time;
    const inputAngle = inputStartAngle + inputTravel;
    const largeBevelLocalAngle = -carrierAngle;
    const rotation = new THREE.Matrix4().makeRotationY(carrierAngle);
    const carrierAngularVelocity = Y_AXIS.clone()
      .multiplyScalar(carrierAngularSpeed);
    const runnerStates = [-1, 1].map((side, index) => {
      const localCenter = new THREE.Vector3(
        side * trackRadius,
        runnerCenterY,
        0,
      );
      const center = localCenter.clone().applyMatrix4(rotation);
      const outwardAxis = new THREE.Vector3(side, 0, 0)
        .applyMatrix4(rotation).normalize();
      const centerVelocity = new THREE.Vector3().crossVectors(
        carrierAngularVelocity,
        new THREE.Vector3(center.x, 0, center.z),
      );
      const spinAngularVelocity = outwardAxis.clone()
        .multiplyScalar(runnerLocalAngularSpeed);
      const totalAngularVelocity = carrierAngularVelocity.clone()
        .add(spinAngularVelocity);
      const contactPoint = center.clone().add(
        new THREE.Vector3(0, -runnerRadius, 0),
      );
      const contactVelocity = centerVelocity.clone().add(
        new THREE.Vector3().crossVectors(
          totalAngularVelocity,
          contactPoint.clone().sub(center),
        ),
      );
      return {
        center,
        centerVelocity,
        contactPoint,
        contactVelocity,
        index,
        localCenter,
        outwardAxis,
        side,
        spinAngularVelocity,
        totalAngularVelocity,
      };
    });
    const inputAngularVelocity = X_AXIS.clone()
      .multiplyScalar(inputAngularSpeed);
    const largeGearAngularVelocity = Y_AXIS.clone()
      .multiplyScalar(carrierAngularSpeed);
    const inputPitchVelocity = new THREE.Vector3().crossVectors(
      inputAngularVelocity,
      bevelContactPoint.clone().sub(bevelApex),
    );
    const largeGearPitchVelocity = new THREE.Vector3().crossVectors(
      largeGearAngularVelocity,
      bevelContactPoint.clone().sub(bevelApex),
    );
    return {
      bevelContact: {
        largeGearPitchVelocity,
        noSlipError: inputPitchVelocity.distanceTo(
          largeGearPitchVelocity,
        ),
        inputPitchVelocity,
        point: bevelContactPoint.clone(),
      },
      carrierAngle,
      carrierAngularSpeed,
      carrierTravel,
      inputAngle,
      inputAngularSpeed,
      inputTravel,
      largeBevelLocalAngle,
      runnerLocalAngularSpeed,
      runnerSpinAngle,
      runners: runnerStates,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.48,
  });
  const panMaterial = matte(PALETTE.brass, {
    metalness: 0.12,
    roughness: 0.68,
    side: THREE.DoubleSide,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const panInnerRadius = 0.78;
  const panOuterRadius = 1.92;
  const panLipY = panFloorY + 0.34;
  const pan = new THREE.Mesh(
    new THREE.LatheGeometry([
      new THREE.Vector2(panInnerRadius - 0.18, panLipY),
      new THREE.Vector2(panInnerRadius, panFloorY),
      new THREE.Vector2(panOuterRadius, panFloorY),
      new THREE.Vector2(panOuterRadius + 0.18, panLipY),
    ], 96),
    panMaterial,
  );
  pan.userData.fixed = true;
  pan.userData.role =
    'fixed-annular-pan-with-flat-circular-grinding-track';
  root.add(pan);
  const innerLip = new THREE.Mesh(
    new THREE.TorusGeometry(panInnerRadius - 0.18, 0.045, 9, 88),
    darkMaterial,
  );
  innerLip.rotation.x = Math.PI / 2;
  innerLip.position.y = panLipY;
  innerLip.userData.fixed = true;
  innerLip.userData.role = 'inner-rim-of-annular-grinding-trough';
  innerLip.visible = false; // ink edge line only: kept for references, not drawn
  innerLip.userData.retiredInkOutline = true;
  root.add(innerLip);
  const outerLip = new THREE.Mesh(
    new THREE.TorusGeometry(panOuterRadius + 0.18, 0.045, 9, 88),
    darkMaterial,
  );
  outerLip.rotation.x = Math.PI / 2;
  outerLip.position.y = panLipY;
  outerLip.userData.fixed = true;
  outerLip.userData.role = 'outer-rim-of-annular-grinding-trough';
  outerLip.visible = false; // ink edge line only: kept for references, not drawn
  outerLip.userData.retiredInkOutline = true;
  root.add(outerLip);

  const carrier = new THREE.Group();
  carrier.userData.axis = Y_AXIS.clone();
  carrier.userData.role =
    'vertical-shaft-and-horizontal-axles-rotating-as-one-carrier';
  root.add(carrier);
  const verticalShaft = cylinderAlongY(0.095, 3.42, darkMaterial, 30);
  verticalShaft.position.set(verticalShaftX, 0.43, verticalShaftZ);
  verticalShaft.userData.role =
    'vertical-shaft-rigidly-connected-to-both-runner-axles';
  carrier.add(verticalShaft);
  const crossAxle = cylinderAlongX(
    0.085,
    2 * (trackRadius + runnerWidth * 0.58),
    darkMaterial,
    26,
  );
  crossAxle.position.y = runnerCenterY;
  crossAxle.userData.role =
    'single-horizontal-cross-axle-connecting-opposed-edge-runners';
  carrier.add(crossAxle);
  const centralHub = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.46, 0.46),
    matte(PALETTE.driven, { metalness: 0.12, roughness: 0.56 }),
  );
  centralHub.position.y = runnerCenterY;
  centralHub.userData.role =
    'central-box-fastening-horizontal-axles-to-vertical-shaft';
  carrier.add(centralHub);
  const shaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.045, 0.055),
    whiteMaterial,
  );
  shaftIndex.position.set(0.39, 0.28, 0);
  shaftIndex.userData.role =
    'white-index-showing-vertical-carrier-shaft-revolution';
  carrier.add(shaftIndex);

  const edgeRunners = [-1, 1].map((side, index) => {
    const runner = makeEdgeRunner({
      axis: new THREE.Vector3(side, 0, 0),
      color: index === 0 ? PALETTE.driver : PALETTE.driven,
      radius: runnerRadius,
      width: runnerWidth,
    });
    runner.position.set(side * trackRadius, runnerCenterY, 0);
    runner.userData.index = index;
    runner.userData.role =
      'one-of-paired-opposed-edge-runners-rolling-in-annular-pan';
    carrier.add(runner);
    return runner;
  });

  const largeBevelGear = makePitchConeGear({
    axis: Y_AXIS.clone().negate(),
    boreRadius: 0.11,
    color: PALETTE.driven,
    indexTooth: 0,
    innerDistance: largeInnerAxialDistance,
    outerDistance: largeOuterAxialDistance,
    pitchConeAngle: largePitchConeAngle,
    teeth: largeGearTeeth,
    toothHeight: largeGearToothHeight,
  });
  largeBevelGear.position.copy(bevelApex);
  largeBevelGear.userData.role =
    'large-horizontal-bevel-gear-fast-on-vertical-runner-shaft';
  root.add(largeBevelGear);
  const inputPinion = makePitchConeGear({
    axis: X_AXIS,
    boreRadius: 0.085,
    color: PALETTE.driver,
    indexTooth: 0,
    innerDistance: pinionInnerAxialDistance,
    outerDistance: pinionOuterAxialDistance,
    pitchConeAngle: pinionPitchConeAngle,
    teeth: inputPinionTeeth,
    toothHeight: pinionToothHeight,
  });
  inputPinion.position.copy(bevelApex);
  inputPinion.userData.role =
    'small-horizontal-input-pinion-driving-vertical-shaft-at-right-angle';
  root.add(inputPinion);
  const inputShaft = cylinderAlongX(0.080, 1.66, darkMaterial, 26);
  inputShaft.position.set(1.96, 0, 0);
  inputShaft.userData.role = 'horizontal-input-shaft-for-upper-bevel-pinion';
  const inputShaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(1.12, 0.035, 0.045),
    whiteMaterial,
  );
  inputShaftIndex.position.set(1.96, 0.095, 0);
  inputShaftIndex.userData.role =
    'white-index-showing-three-to-one-input-pinion-speed';
  const inputShaftRotor = new THREE.Group();
  inputShaftRotor.position.set(0, bevelApex.y, 0);
  inputShaftRotor.userData.axis = X_AXIS.clone();
  root.add(inputShaftRotor);
  inputShaftRotor.add(inputShaft);
  inputShaftRotor.add(inputShaftIndex);

  const upperFrame = new THREE.Group();
  upperFrame.userData.fixed = true;
  upperFrame.userData.role = 'fixed-overhead-frame-supporting-right-angle-drive';
  root.add(upperFrame);
  const frameTop = new THREE.Mesh(
    new THREE.BoxGeometry(5.08, 0.18, 0.52),
    frameMaterial,
  );
  frameTop.position.set(0, 1.48, -0.38);
  upperFrame.add(frameTop);
  const framePosts = [];
  // Brown's rectangular standard is symmetric about the runner shaft.
  for (const x of [-2.45, 2.45]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 3.42, 0.48),
      frameMaterial,
    );
    post.position.set(x, -0.14, -0.38);
    post.userData.role = 'fixed-side-standard-of-edge-runner-mill';
    framePosts.push(post);
    upperFrame.add(post);
  }
  const inputBearing = cylinderAlongX(0.16, 0.34, frameMaterial, 28);
  inputBearing.position.set(2.45, bevelApex.y, 0);
  inputBearing.userData.role = 'fixed-bearing-for-horizontal-input-shaft';
  upperFrame.add(inputBearing);
  const lowerBase = new THREE.Mesh(
    new THREE.BoxGeometry(5.42, 0.16, 4.72),
    frameMaterial,
  );
  lowerBase.position.set(0.35, -1.83, -0.14);
  lowerBase.userData.fixed = true;
  lowerBase.userData.role = 'fixed-foundation-beneath-annular-pan';
  root.add(lowerBase);
  const lowerBearing = cylinderAlongY(0.18, 0.28, frameMaterial, 28);
  lowerBearing.position.y = -1.54;
  lowerBearing.userData.fixed = true;
  lowerBearing.userData.role = 'lower-bearing-for-vertical-runner-shaft';
  root.add(lowerBearing);

  const update = (time) => {
    const state = stateAtTime(time);
    carrier.rotation.y = state.carrierAngle;
    for (const runner of edgeRunners) {
      setSpin(runner, state.runnerSpinAngle);
    }
    setSpin(largeBevelGear, state.largeBevelLocalAngle);
    setSpin(inputPinion, state.inputAngle);
    inputShaftRotor.rotation.x = state.inputAngle;
    root.userData.currentState = state;
    root.userData.rollingContacts = state.runners;
    root.userData.bevelContact = state.bevelContact;
  };

  root.userData = {
    archetype: movement.archetype,
    blocks: {
      carrier,
      centralHub,
      crossAxle,
      edgeRunners,
      framePosts,
      frameTop,
      innerLip,
      inputBearing,
      inputPinion,
      inputShaft,
      inputShaftIndex,
      inputShaftRotor,
      largeBevelGear,
      lowerBase,
      lowerBearing,
      outerLip,
      pan,
      shaftIndex,
      upperFrame,
      verticalShaft,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      input:
        'uniform rotation of the upper horizontal bevel pinion',
      note:
        'the vertical shaft and axle carrier follow the 3:1 bevel reduction, while both opposed stones receive equal outward-axis spin from their no-slip rolling constraints on the fixed annular track',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid vertical shaft and horizontal runner axles',
        'two identical cylindrical edge-runner stones',
        'zero slip at both horizontal pan contacts',
        'rigid involute-like teeth on complementary bevel pitch cones',
        'lossless bearings and quasi-static grinding load omitted',
      ],
      sourceSpecifiesDimensionsTimingTeethMaterialOrLoad: false,
      treatment:
        'Brown specifies the paired edge-runner topology but no numerical scale, speed, tooth counts, stone material, or grinding load; proportions are reconstructed from the plate, with exact rolling-contact and right-angle bevel velocity constraints solved analytically',
    },
    fidelity: 'authored',
    geometry: {
      bevelApex,
      bevelContactPoint,
      bevelModule,
      carrierAngularSpeed,
      carrierPeriod,
      carrierStartAngle,
      commonConeDistance,
      inputAngularSpeed,
      inputPinionPitchRadius,
      inputPinionTeeth,
      inputStartAngle,
      largeGearPitchRadius,
      largeGearTeeth,
      largeOuterAxialDistance,
      largePitchConeAngle,
      panFloorY,
      panInnerRadius,
      panLipY,
      panOuterRadius,
      pinionOuterAxialDistance,
      pinionPitchConeAngle,
      runnerCenterY,
      runnerRadius,
      runnerRadiusRatio,
      runnerStartAngle,
      runnerWidth,
      trackRadius,
    },
    mechanism:
      'one-horizontal-input-bevel-pinion-drives-one-large-bevel-gear-and-vertical-shaft-carrying-one-horizontal-cross-axle-with-two-opposed-edge-runners-that-roll-without-slip-in-one-fixed-annular-pan',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate375: {
        annularPanBottom: new THREE.Vector2(277, 484),
        annularPanLeftLip: new THREE.Vector2(85, 430),
        annularPanRightLip: new THREE.Vector2(454, 430),
        frameLeft: 43,
        frameRight: 501,
        frameTopY: 179,
        imageHeight: 525,
        imageWidth: 525,
        inputPinionCenter: new THREE.Vector2(450, 83),
        leftRunnerCenter: new THREE.Vector2(170, 334),
        measurementUncertaintyPixels: 9,
        rightRunnerCenter: new THREE.Vector2(390, 334),
        verticalShaftX: 268,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'two edge runners or chasers perform crushing or grinding',
          'their horizontal axles are connected with a vertical shaft',
          'both wheels run in an annular pan or trough',
        ],
        engravingEvidence:
          'the plate shows two opposed upright cylindrical runners, one central horizontal cross-axle and hub on a vertical shaft, an annular trough beneath both stones, and a source-visible right-angle gear drive above the frame',
        reconstructionDisclosure:
          'the upper 36:12 complementary bevel pair, exact 2:1 track-to-stone ratio, colors, depth, supports, speed, and display period are engineered because Brown supplies no values and the official page has no canvas animation',
      },
      officialPage: 'https://507movements.com/mm_375.html',
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      demonstrationPeriod: carrierPeriod,
      note:
        'one input cycle contains three pinion turns, one vertical-carrier revolution, and two counter-turns of each indexed runner, so every visible rotational index closes exactly',
    },
    transmission: {
      bevelRatio: 1 / bevelRatio,
      bevelVelocityLaw:
        'the 12-tooth horizontal pinion turns three times for one turn of the 36-tooth vertical-shaft bevel gear',
      runnerSpinLaw:
        'each runner spins about its own outward radial axis at -trackRadius/runnerRadius times carrier speed',
      runnerSpinRatio: -runnerRadiusRatio,
    },
  };

  correctRunnerTreadParts(root, 375);
  correctEdgeRunnerBevels(root);
  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.48, -2.02, -2.48),
    new THREE.Vector3(3.02, 2.94, 2.48),
  );
  root.userData.groundFloorY = -1.94;
  // Brown's plate is a flat front elevation; a narrow field keeps the pan
  // rim and runner faces from opening up as if seen from above.
  root.userData.cameraFov = 16;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(6.5, 4.8, 8.6),
    root,
    update,
  };
}

export function createAuthoredEdgeRunnerMovement(movement) {
  if (movement.id !== 375) return null;
  return finishRunnerTread(pairedEdgeRunnerMill(movement), 375);
}
