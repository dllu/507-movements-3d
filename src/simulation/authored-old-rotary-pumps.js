import { correctOldPump, oldPumpFoldAtHingeAngle, oldPumpContactGeometry } from './rotary-pump-contact.js';
import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function makeAnnularExtrusion(innerRadius, outerRadius, depth) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 96,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function oldRotaryPump(movement) {
  const root = new THREE.Group();
  const cycleDuration = 6.0;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const casingInnerRadius = 2.35;
  const casingOuterRadius = 2.62;
  const casingDepth = 0.76;
  // Brown's hexagonal ring rotor is about half the casing radius.
  const rotorRadius = oldPumpContactGeometry.rotorRadius;
  const valveLength = casingInnerRadius - rotorRadius;
  const valveCount = 2;
  const maximumFoldAngle = oldPumpContactGeometry.maximumFold;
  const abutmentStartAngle = -(oldPumpContactGeometry.fold.findIndex(v=>v>0)-1)*oldPumpContactGeometry.step;
  const foldInTravel = oldPumpContactGeometry.peakAngle + abutmentStartAngle;
  const foldHoldEndTravel = THREE.MathUtils.degToRad(145) + abutmentStartAngle;
  const abutmentTotalTravel = THREE.MathUtils.degToRad(178) + abutmentStartAngle;
  const abutmentClearance = oldPumpContactGeometry.clearance;
  const sweptVolumePerRadian = 0.5 * (
    casingInnerRadius ** 2 - rotorRadius ** 2
  ) * casingDepth;
  const groundY = -3.72;

  const foldProfileAtHingeAngle = oldPumpFoldAtHingeAngle;

  const tipRadiusForFoldFraction = fraction => Math.sqrt(rotorRadius**2+valveLength**2+2*rotorRadius*valveLength*Math.cos(maximumFoldAngle*fraction));

  // Nearest radius at which a ray from the axis enters the square block.
  const abutmentInnerRadiusAtAngle = (angle) => {
    const c = Math.cos(angle), s = Math.sin(angle), ring = oldPumpContactGeometry.block;
    let nearest = casingInnerRadius;
    for (let i = 0; i < ring.length - 1; i += 1) {
      const [ax, ay] = ring[i], [bx, by] = ring[i + 1], ex = bx - ax, ey = by - ay;
      const denominator = c * ey - s * ex;
      if (Math.abs(denominator) < 1e-14) continue;
      const t = (ax * ey - ay * ex) / denominator, u = (ax * s - ay * c) / denominator;
      if (t > 0 && u >= 0 && u <= 1) nearest = Math.min(nearest, t);
    }
    return nearest;
  };

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const phase = THREE.MathUtils.euclideanModulo(
      inputAngle / FULL_TURN,
      1,
    );
    const cycleAngle = FULL_TURN * phase;
    const rotorAngle = -cycleAngle;
    const rotorAngularSpeed = -inputSpeed;
    const rotorAngularAcceleration = -inputAcceleration;
    const valves = Array.from({ length: valveCount }, (_, index) => {
      const hingeAngle = rotorAngle + index * Math.PI;
      const profile = foldProfileAtHingeAngle(hingeAngle);
      const flapAngle = maximumFoldAngle * profile.fraction;
      const flapAngularSpeed = maximumFoldAngle
        * profile.fractionDerivativeByTravel * inputSpeed;
      const flapAngularAcceleration = maximumFoldAngle * (
        profile.fractionSecondDerivativeByTravel * inputSpeed ** 2
          + profile.fractionDerivativeByTravel * inputAcceleration
      );
      const hingePoint = new THREE.Vector3(
        rotorRadius * Math.cos(hingeAngle),
        rotorRadius * Math.sin(hingeAngle),
        0,
      );
      const absoluteBladeAngle = hingeAngle + flapAngle;
      const tipPoint = new THREE.Vector3(
        hingePoint.x + valveLength * Math.cos(absoluteBladeAngle),
        hingePoint.y + valveLength * Math.sin(absoluteBladeAngle),
        0,
      );
      const tipRadius = tipPoint.length();
      const abutmentInnerRadius = abutmentInnerRadiusAtAngle(Math.atan2(tipPoint.y,tipPoint.x));
      return {
        absoluteBladeAngle,
        abutmentInnerRadius,
        closedByAbutment: profile.fraction > 0,
        contactEngaged: profile.contactEngaged,
        flapAngle,
        flapAngularAcceleration,
        flapAngularSpeed,
        foldFraction: profile.fraction,
        foldFractionDerivativeByTravel:
          profile.fractionDerivativeByTravel,
        foldFractionSecondDerivativeByTravel:
          profile.fractionSecondDerivativeByTravel,
        hingeAngle,
        hingePoint,
        index,
        sealedToCasing: profile.fraction === 0,
        tipPoint,
        tipRadius,
        travelThroughAbutment: profile.travel,
      };
    });
    const activeSealFactor = valves.reduce(
      (sum, valve) => sum + 1 - valve.foldFraction,
      0,
    );
    const schematicSweptFlowRate = sweptVolumePerRadian
      * Math.max(0, -rotorAngularSpeed)
      * activeSealFactor;
    const foldedValve = valves.find(({ closedByAbutment }) =>
      closedByAbutment);
    return {
      activeSealFactor,
      clockwise: rotorAngularSpeed < 0,
      dischargePortAngle: THREE.MathUtils.degToRad(36),
      foldedValveIndex: foldedValve?.index ?? null,
      inletPortAngle: -Math.PI / 2,
      inputAcceleration,
      inputAngle: cycleAngle,
      inputSpeed,
      phase,
      rotorAngle,
      rotorAngularAcceleration,
      rotorAngularSpeed,
      schematicSweptFlowRate,
      valves,
    };
  };

  const stateAtTime = (time) => stateAtInputAngle(
    inputAngularSpeed * time,
    inputAngularSpeed,
    0,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.24,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.48,
  });
  const rotorMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.54,
  });
  const valveMaterial = matte(PALETTE.accent, {
    metalness: 0.14,
    roughness: 0.50,
  });
  const abutmentMaterial = matte(PALETTE.brass, {
    metalness: 0.20,
    roughness: 0.50,
  });
  const shellMaterial = matte(PALETTE.muted, {
    opacity: 0.24,
    roughness: 0.72,
    side: THREE.DoubleSide,
    transparent: true,
  });
  shellMaterial.depthWrite = false;
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.36,
    roughness: 0.30,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;

  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.16, 2.8),
    frameMaterial,
  ), 'fixed-old-rotary-pump-foundation');
  base.position.set(0.18, groundY + 0.08, 0);
  root.add(base);
  for (const x of [-1.45, 1.45]) {
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 1.12, 0.82),
      frameMaterial,
    );
    foot.position.set(x, -3.10, -0.18);
    foot.userData.role = 'fixed-casing-foot-not-drawn-by-brown';
    root.add(foot);
  }

  const casing = addRole(new THREE.Mesh(
    makeAnnularExtrusion(
      casingInnerRadius,
      casingOuterRadius,
      casingDepth,
    ),
    frameMaterial,
  ), 'fixed-circular-outer-cylinder-casing');
  root.add(casing);
  const frontCover = addRole(new THREE.Mesh(
    new THREE.CircleGeometry(casingInnerRadius, 96),
    shellMaterial,
  ), 'transparent-front-cover-exposing-rotary-valves');
  frontCover.position.z = casingDepth / 2 + 0.012;
  root.add(frontCover);
  const rearCover = new THREE.Mesh(
    new THREE.CircleGeometry(casingInnerRadius, 96),
    shellMaterial,
  );
  rearCover.position.z = -casingDepth / 2 - 0.012;
  root.add(rearCover);
  const annularWater = addRole(new THREE.Mesh(
    makeAnnularExtrusion(
      rotorRadius + 0.05,
      casingInnerRadius - 0.05,
      casingDepth * 0.74,
    ),
    waterMaterial,
  ), 'water-filled-annulus-between-rotor-and-casing');
  root.add(annularWater);

  const rotor = addRole(new THREE.Group(),
    'central-two-valve-rotor-turning-clockwise');
  root.add(rotor);
  const rotorBody = new THREE.Mesh(
    new THREE.CylinderGeometry(
      rotorRadius,
      rotorRadius,
      casingDepth * 0.86,
      8,
    ),
    rotorMaterial,
  );
  rotorBody.rotation.x = Math.PI / 2;
  rotor.add(rotorBody);
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 1.42, 32),
    darkMaterial,
  );
  shaft.rotation.x = Math.PI / 2;
  rotor.add(shaft);
  const shaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.09, 0.10),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  shaftIndex.position.set(0.36, 0, casingDepth * 0.56);
  shaftIndex.userData.role = 'white-rotor-rotation-index';
  rotor.add(shaftIndex);

  const valves = Array.from({ length: valveCount }, (_, index) => {
    const carrier = addRole(new THREE.Group(),
      `rotor-valve-${index + 1}-diametrical-carrier`);
    carrier.rotation.z = index * Math.PI;
    rotor.add(carrier);
    const hinge = addRole(new THREE.Group(),
      `hinged-sweeping-valve-${index + 1}`);
    hinge.position.x = rotorRadius;
    carrier.add(hinge);
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(
        valveLength,
        0.12,
        casingDepth * 0.66,
      ),
      valveMaterial,
    );
    blade.position.x = valveLength / 2;
    hinge.add(blade);
    const flexibleLip = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.18, casingDepth * 0.70),
      darkMaterial,
    );
    flexibleLip.position.x = valveLength - 0.06;
    hinge.add(flexibleLip);
    const hingePin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, casingDepth * 0.94, 26),
      darkMaterial,
    );
    hingePin.rotation.x = Math.PI / 2;
    hinge.add(hingePin);
    return { blade, carrier, flexibleLip, hinge, hingePin };
  });

  const abutmentSamples = 72;
  const wedgeShape = new THREE.Shape();
  for (let sample = 0; sample <= abutmentSamples; sample += 1) {
    const travel = abutmentTotalTravel * sample / abutmentSamples;
    const angle = abutmentStartAngle - travel;
    const x = casingInnerRadius * Math.cos(angle);
    const y = casingInnerRadius * Math.sin(angle);
    if (sample === 0) wedgeShape.moveTo(x, y);
    else wedgeShape.lineTo(x, y);
  }
  for (let sample = abutmentSamples; sample >= 0; sample -= 1) {
    const travel = abutmentTotalTravel * sample / abutmentSamples;
    const angle = abutmentStartAngle - travel;
    const radius = abutmentInnerRadiusAtAngle(angle);
    wedgeShape.lineTo(radius * Math.cos(angle), radius * Math.sin(angle));
  }
  wedgeShape.closePath();
  const abutmentGeometry = new THREE.ExtrudeGeometry(wedgeShape, {
    bevelEnabled: false,
    depth: casingDepth * 0.90,
    steps: 1,
  });
  abutmentGeometry.translate(0, 0, -casingDepth * 0.45);
  const abutment = addRole(new THREE.Mesh(
    abutmentGeometry,
    abutmentMaterial,
  ), 'fixed-lower-side-abutment-folding-each-passing-valve');
  root.add(abutment);

  const inletWidth = 0.78;
  const inlet = addRole(new THREE.Group(),
    'fixed-lower-aperture-water-entrance');
  root.add(inlet);
  const inletShell = new THREE.Mesh(
    new THREE.BoxGeometry(inletWidth, 1.42, casingDepth * 1.06),
    shellMaterial,
  );
  inletShell.position.y = -3.01;
  inlet.add(inletShell);
  const inletWater = new THREE.Mesh(
    new THREE.BoxGeometry(
      inletWidth * 0.66,
      1.40,
      casingDepth * 0.66,
    ),
    waterMaterial,
  );
  inletWater.position.copy(inletShell.position);
  inlet.add(inletWater);
  for (const x of [-inletWidth / 2, inletWidth / 2]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 1.46, casingDepth * 1.10),
      frameMaterial,
    );
    wall.position.set(x, -3.01, 0);
    inlet.add(wall);
  }

  const outletAngle = THREE.MathUtils.degToRad(36);
  const outletLength = 1.48;
  const outlet = addRole(new THREE.Group(),
    'fixed-upper-aperture-water-exit');
  outlet.rotation.z = outletAngle;
  outlet.position.set(
    (casingOuterRadius + outletLength / 2 - 0.12)
      * Math.cos(outletAngle),
    (casingOuterRadius + outletLength / 2 - 0.12)
      * Math.sin(outletAngle),
    0,
  );
  root.add(outlet);
  const outletShell = new THREE.Mesh(
    new THREE.BoxGeometry(
      outletLength,
      0.78,
      casingDepth * 1.06,
    ),
    shellMaterial,
  );
  outlet.add(outletShell);
  const outletWater = new THREE.Mesh(
    new THREE.BoxGeometry(
      outletLength,
      0.50,
      casingDepth * 0.66,
    ),
    waterMaterial,
  );
  outlet.add(outletWater);
  for (const y of [-0.39, 0.39]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(
        outletLength + 0.04,
        0.10,
        casingDepth * 1.10,
      ),
      frameMaterial,
    );
    wall.position.y = y;
    outlet.add(wall);
  }

  const inletArrow = addRole(new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -3.52, casingDepth * 0.58),
    0.82,
    PALETTE.ink,
    0.24,
    0.15,
  ), 'upward-flow-direction-at-lower-entrance');
  root.add(inletArrow);
  const outletDirection = new THREE.Vector3(
    Math.cos(outletAngle),
    Math.sin(outletAngle),
    0,
  );
  const outletArrow = addRole(new THREE.ArrowHelper(
    outletDirection,
    new THREE.Vector3(
      2.42 * Math.cos(outletAngle),
      2.42 * Math.sin(outletAngle),
      casingDepth * 0.58,
    ),
    0.90,
    PALETTE.ink,
    0.24,
    0.15,
  ), 'outward-flow-direction-at-upper-exit');
  root.add(outletArrow);

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.z = state.rotorAngle;
    state.valves.forEach((valveState, index) => {
      valves[index].hinge.rotation.z = valveState.flapAngle;
    });
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    abutmentClearance,
    abutmentStartAngle,
    abutmentTotalTravel,
    casingDepth,
    casingInnerRadius,
    casingOuterRadius,
    cycleDuration,
    foldHoldEndTravel,
    foldInTravel,
    groundY,
    inputAngularSpeed,
    maximumFoldAngle,
    outletAngle,
    rotorRadius,
    sweptVolumePerRadian,
    valveCount,
    valveLength,
  };
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'old-two-hinged-vane-rotary-pump-with-fixed-abutment-lower-inlet-and-upper-outlet',
    blocks: {
      abutment,
      annularWater,
      base,
      casing,
      frontCover,
      inlet,
      inletArrow,
      outlet,
      outletArrow,
      rotor,
      rotorBody,
      shaft,
      valves,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      valve1Independent: false,
      valve2Independent: false,
    },
    dynamics: {
      fullFluidPressureLeakageValveImpactFrictionTorqueAndCavitationModeled:
        false,
      flowModel:
        'Flow arrows and the swept-rate diagnostic show the captioned direction only. The annulus is treated as primed; the diagnostic weights ideal annular sweep by each valve’s sealing fraction and is not a pressure-resolved performance prediction.',
      valveContactModel:
        'Each finite hinged valve follows a baked polygon-contact closing branch against a rounded fixed abutment. A positive contact moment arm closes the vane; a prescribed hold and quintic return clear the projection continuously. Contact-entry velocity and fluid-driven return dynamics are not solved.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'A central octagonal rotor turns clockwise with two diametrically opposed hinged valves. Away from the lower-right projection each valve lies radial and reaches the inner cylinder wall, sweeping annular water from the lower entrance around the long left and upper path toward the upper-right exit. On reaching the fixed abutment, the valve folds inward about its rotor hinge, remains closed while passing the projection, and reopens after it; the opposite valve repeats the same event one half-turn later.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'uniform-clockwise-two-vane-rotation-with-periodic-abutment-induced-hinge-folding',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 455 page supplies Brown\'s static engraving and caption; its Animated control is unavailable and the page contains no Canvas mechanism or timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      clockwise: sourceState.clockwise,
      rotorAngle: sourceState.rotorAngle,
      valveFoldFractions: sourceState.valves.map(
        ({ foldFraction }) => foldFraction,
      ),
      valveHingeAngles: sourceState.valves.map(
        ({ hingeAngle }) => hingeAngle,
      ),
    },
    sourceReference: {
      brownPlate455: {
        approximateAbutmentCenterPixels: [344, 349],
        approximateCasingCenterPixels: [276, 250],
        approximateCasingInnerRadiusPixels: 178,
        approximateLowerEntranceCenterPixels: [259, 438],
        approximateRotorLeftHingePixels: [191, 237],
        approximateRotorRightHingePixels: [354, 244],
        approximateUpperExitCenterPixels: [434, 116],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 17,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the machine is an old rotary pump',
          'the lower aperture is the water entrance and the upper aperture the exit',
          'the central part revolves with its valves',
          'the valves fit accurately to the inner surface of the outer cylinder',
          'the lower-side projection is an abutment that closes each valve when it reaches that point',
        ],
        engravingEvidence:
          'Brown’s section shows a circular fixed casing, a central polygonal rotor with two opposite hinge pins and outward leaf valves, a bottom inlet arrow curving toward the left-hand sweep, an upper-right outlet arrow, and a hatched fixed wedge in the lower-right annulus.',
        reconstructionDisclosure:
          'Brown gives no casing depth, rotor speed, valve fold law, hinge limits, abutment contour, sealing compliance, pressure, leakage, torque or timing. Those values, the finite-contact 118.86-degree closing branch, rounded abutment, rotor pockets and prescribed hold/return, transparent cutaway, colors and 6-second cycle are independently engineered. The clockwise long-path transport inferred from the arrows, two opposed hinged valves, wall contact, port locations and fixed closing abutment are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 455',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      abutmentConstraint:
        'During closing, the full finite vane outline follows the rounded fixed abutment with a small numerical clearance and positive closing moment arm. It then holds clear before a prescribed quintic return; no free return dynamics or contact impact is claimed.',
      diametricalConstraint:
        'The two hinge carriers remain exactly pi radians apart on one rigid rotor and encounter the same fixed fold profile half a turn apart.',
      rotationDirection:
        'Positive input phase produces negative rotor angle: clockwise from the bottom inlet around the left/top annulus to the upper-right outlet.',
    },
    update,
  };
  root.userData.abutmentInnerRadiusAtAngle = abutmentInnerRadiusAtAngle;
  root.userData.foldProfileAtHingeAngle = foldProfileAtHingeAngle;
  root.userData.tipRadiusForFoldFraction = tipRadiusForFoldFraction;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.45, groundY, -1.45),
    new THREE.Vector3(4.10, 3.35, 1.45),
  );
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraDirection = new THREE.Vector3(5.8, 4.6, 11.8);
  root.userData.groundFloorY = groundY;
  correctOldPump(root);
  // Brown's section is drawn clear: no water fill or front cover washes over
  // the rotor and valves, and each aperture shows only its back wall.
  for (const object of [annularWater, inletWater, outletWater, frontCover]) {
    object.visible = false;
  }
  rearCover.material = matte(PALETTE.white, { roughness: 0.8 });
  rearCover.material.fog = false;
  // The hollow ring's rear end plate reads as the same blank paper.
  root.userData.blocks.rotorRearWeb.material = rearCover.material;
  for (const [shell, width, height] of [
    [inlet.children[0], 0.78, 1.42],
    [outlet.children[0], 1.48, 0.78],
  ]) {
    shell.geometry.dispose();
    shell.geometry = new THREE.BoxGeometry(width, height, 0.06)
      .translate(0, 0, -0.38);
  }
  markShadows(root);
  base.receiveShadow = true;
  // Brown's section carries no cast shadows on the blank back of the case.
  rearCover.receiveShadow = false;
  root.userData.blocks.rotorRearWeb.receiveShadow = false;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredOldRotaryPumpMovement(movement) {
  if (movement.id !== 455) return null;
  return oldRotaryPump(movement);
}
