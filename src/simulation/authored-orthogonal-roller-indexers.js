import * as THREE from 'three';
import grooveData from './baked/roller-indexer-grooves.js';
import { radialGroovedWheelGeometry, finishGrooveDrive, boreCylinder } from './groove-drive-working-parts.js';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderAlongX(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function torusNormalToY(majorRadius, tubeRadius, material, segments = 64) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(majorRadius, tubeRadius, 10, segments),
    material,
  );
  torus.rotation.x = Math.PI / 2;
  return torus;
}

function quinticIndex(progress) {
  const u = THREE.MathUtils.clamp(progress, 0, 1);
  return u * u * u * (10 + u * (-15 + 6 * u));
}

function quinticIndexDerivative(progress) {
  const u = THREE.MathUtils.clamp(progress, 0, 1);
  return 30 * u * u * (1 - u) * (1 - u);
}

function quinticIndexSecondDerivative(progress) {
  const u = THREE.MathUtils.clamp(progress, 0, 1);
  return 60 * u * (1 - u) * (1 - 2 * u);
}

function orthogonalRollerGrooveIndexer(movement) {
  const root = new THREE.Group();

  const rollerCount = 8;
  const grooveCount = 8;
  const rollerPitch = FULL_TURN / rollerCount;
  const outputPitch = FULL_TURN / grooveCount;
  const inputCyclePeriod = 8;
  const inputAngularSpeed = FULL_TURN / inputCyclePeriod;
  const sourceDriverAngle = rollerPitch / 2;
  const contactHalfAngle = rollerPitch * 0.36;
  const contactStartPhase = 0.5 - contactHalfAngle / rollerPitch;
  const contactEndPhase = 0.5 + contactHalfAngle / rollerPitch;
  const contactFraction = contactEndPhase - contactStartPhase;

  const outputCenter = new THREE.Vector3(0, 1.45, 0);
  const outputRadius = 1.52;
  const driverToOutputTangent = 1.10;
  const driverCenter = new THREE.Vector3(
    -outputRadius - driverToOutputTangent,
    outputCenter.y,
    0,
  );
  const outputWorkingHalfHeight = driverToOutputTangent
    * Math.tan(contactHalfAngle);
  const outputBodyHalfHeight = outputWorkingHalfHeight + 0.035;
  const outputBodyHeight = outputBodyHalfHeight * 2;
  const driverDiskRadius = 0.78;
  const driverDiskDepth = 0.30;
  const driverShaftLength = 1.55;
  const rollerRadialCenter = 1.04;
  const rollerLength = 0.35;
  // Brown draws slender spool rollers, about a sixth of the pin-wheel radius
  // across, so the grooves read as narrow oblique cuts.
  const rollerRadius = 0.078;
  const rollerInnerRadius = rollerRadialCenter - rollerLength / 2;
  const rollerOuterRadius = rollerRadialCenter + rollerLength / 2;
  const grooveCenterRadius = outputRadius;
  const grooveFlankAngularOffset = 0.028;
  const grooveTubeRadius = 0.025;
  const grooveSegments = 112;

  const contactProgressAtRollerAngle = (rollerAngle) => {
    if (rollerAngle <= -contactHalfAngle) return 0;
    if (rollerAngle >= contactHalfAngle) return 1;
    return (
      Math.tan(rollerAngle) + Math.tan(contactHalfAngle)
    ) / (2 * Math.tan(contactHalfAngle));
  };

  const grooveLocalPoint = (
    grooveIndex,
    parameter,
    angularOffset = 0,
    target = new THREE.Vector3(),
  ) => {
    const u = THREE.MathUtils.clamp(parameter, 0, 1);
    const localAngle = Math.PI
      - grooveIndex * outputPitch
      - quinticIndex(u) * outputPitch
      + angularOffset;
    return target.set(
      grooveCenterRadius * Math.cos(localAngle),
      -outputWorkingHalfHeight + 2 * outputWorkingHalfHeight * u,
      grooveCenterRadius * Math.sin(localAngle),
    );
  };

  const makeGrooveCurve = (grooveIndex, angularOffset = 0) => {
    const curve = new class extends THREE.Curve {
      getPoint(parameter, target = new THREE.Vector3()) {
        return grooveLocalPoint(
          grooveIndex,
          parameter,
          angularOffset,
          target,
        );
      }
    }();
    curve.arcLengthDivisions = grooveSegments * 2;
    return curve;
  };

  const grooveCenterCurves = Array.from(
    { length: grooveCount },
    (_, index) => makeGrooveCurve(index),
  );

  const arcLengthSamples = 1024;
  const grooveArcLengths = new Float64Array(arcLengthSamples + 1);
  const grooveSpeedAtParameter = (parameter) => {
    const profileRate = quinticIndexDerivative(parameter);
    return Math.hypot(
      2 * outputWorkingHalfHeight,
      grooveCenterRadius * outputPitch * profileRate,
    );
  };
  for (let index = 1; index <= arcLengthSamples; index += 1) {
    const u0 = (index - 1) / arcLengthSamples;
    const u1 = index / arcLengthSamples;
    grooveArcLengths[index] = grooveArcLengths[index - 1]
      + (grooveSpeedAtParameter(u0) + grooveSpeedAtParameter(u1))
        / (2 * arcLengthSamples);
  }
  const grooveArcLength = grooveArcLengths[arcLengthSamples];
  const grooveArcLengthAt = (parameter) => {
    const scaled = THREE.MathUtils.clamp(parameter, 0, 1)
      * arcLengthSamples;
    const lowerIndex = Math.floor(scaled);
    if (lowerIndex >= arcLengthSamples) return grooveArcLength;
    return THREE.MathUtils.lerp(
      grooveArcLengths[lowerIndex],
      grooveArcLengths[lowerIndex + 1],
      scaled - lowerIndex,
    );
  };

  const stateAtDriverAngle = (driverAngle) => {
    const eventCoordinate = driverAngle / rollerPitch;
    const eventIndex = Math.floor(eventCoordinate);
    const eventPhase = eventCoordinate - eventIndex;
    const candidateRollerIndex = positiveModulo(eventIndex, rollerCount);
    const candidateGrooveIndex = positiveModulo(eventIndex, grooveCount);
    const rollerAngle = (eventPhase - 0.5) * rollerPitch;
    const engaged = rollerAngle >= -contactHalfAngle - 1e-12
      && rollerAngle <= contactHalfAngle + 1e-12;
    const beforeContact = rollerAngle < -contactHalfAngle;
    const grooveParameter = engaged
      ? contactProgressAtRollerAngle(rollerAngle)
      : null;
    const completedContactFraction = beforeContact
      ? 0
      : engaged
        ? quinticIndex(grooveParameter)
        : 1;
    const outputStepCoordinate = eventIndex + completedContactFraction;
    const outputAngle = -outputStepCoordinate * outputPitch;

    let outputRatePerDriverRadian = 0;
    let outputSecondRatePerDriverRadian = 0;
    let grooveParameterRatePerDriverRadian = 0;
    if (engaged) {
      const secantSquared = 1 / (Math.cos(rollerAngle) ** 2);
      grooveParameterRatePerDriverRadian = secantSquared
        / (2 * Math.tan(contactHalfAngle));
      const grooveParameterSecondRate = secantSquared
        * Math.tan(rollerAngle)
        / Math.tan(contactHalfAngle);
      const profileRate = quinticIndexDerivative(grooveParameter);
      const profileSecondRate = quinticIndexSecondDerivative(
        grooveParameter,
      );
      outputRatePerDriverRadian = -outputPitch
        * profileRate * grooveParameterRatePerDriverRadian;
      outputSecondRatePerDriverRadian = -outputPitch * (
        profileSecondRate
          * grooveParameterRatePerDriverRadian ** 2
        + profileRate * grooveParameterSecondRate
      );
    }
    const outputAngularSpeed = outputRatePerDriverRadian
      * inputAngularSpeed;
    const outputAngularAcceleration = outputSecondRatePerDriverRadian
      * inputAngularSpeed * inputAngularSpeed;

    const rollerAxisDirection = new THREE.Vector3(
      Math.cos(rollerAngle),
      Math.sin(rollerAngle),
      0,
    );
    const rollerAxisContactRadialCoordinate = driverToOutputTangent
      / Math.cos(rollerAngle);
    const rollerAxisContactPoint = driverCenter.clone().addScaledVector(
      rollerAxisDirection,
      rollerAxisContactRadialCoordinate,
    );
    const contactPoint = engaged ? rollerAxisContactPoint.clone() : null;
    let grooveWorldPoint = null;
    let contactError = null;
    if (engaged) {
      grooveWorldPoint = grooveLocalPoint(
        candidateGrooveIndex,
        grooveParameter,
      ).applyAxisAngle(Y_AXIS, outputAngle).add(outputCenter);
      contactError = grooveWorldPoint.distanceTo(contactPoint);
    }

    const partialArcLength = beforeContact
      ? 0
      : engaged
        ? grooveArcLengthAt(grooveParameter)
        : grooveArcLength;
    const rollerSpinAngles = Array.from(
      { length: rollerCount },
      (_, rollerIndex) => {
        const completedOwnContacts = Math.floor(
          (eventIndex + rollerCount - 1 - rollerIndex) / rollerCount,
        );
        const activeArcLength = rollerIndex === candidateRollerIndex
          ? partialArcLength
          : 0;
        return -(
          completedOwnContacts * grooveArcLength + activeArcLength
        ) / rollerRadius;
      },
    );

    const stage = !engaged
      ? eventPhase < contactStartPhase
        ? 'dwell-before-next-roller-enters'
        : 'dwell-after-roller-leaves'
      : grooveParameter < 0.5
        ? 'roller-driving-through-lower-half-of-oblique-groove'
        : grooveParameter > 0.5
          ? 'roller-driving-through-upper-half-of-oblique-groove'
          : 'roller-at-mid-height-and-half-index';
    return {
      activeGrooveIndex: engaged ? candidateGrooveIndex : null,
      activeRollerIndex: engaged ? candidateRollerIndex : null,
      candidateGrooveIndex,
      candidateRollerIndex,
      completedContactFraction,
      completedInputTurns: (driverAngle - sourceDriverAngle) / FULL_TURN,
      contactCount: engaged ? 1 : 0,
      contactError,
      contactPoint,
      driverAngle,
      driverAngularSpeed: inputAngularSpeed,
      engaged,
      eventCoordinate,
      eventIndex,
      eventPhase,
      grooveParameter,
      grooveParameterRatePerDriverRadian,
      grooveWorldPoint,
      outputAngle,
      outputAngularAcceleration,
      outputAngularSpeed,
      outputRatePerDriverRadian,
      outputSecondRatePerDriverRadian,
      outputStepCoordinate,
      rollerAngle,
      rollerAxisContactPoint,
      rollerAxisContactRadialCoordinate,
      rollerAxisDirection,
      rollerContactWithinBody:
        rollerAxisContactRadialCoordinate >= rollerInnerRadius
        && rollerAxisContactRadialCoordinate <= rollerOuterRadius,
      rollerSpinAngles,
      stage,
    };
  };

  const stateAtTime = (time) => stateAtDriverAngle(
    sourceDriverAngle + inputAngularSpeed * time,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.62,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.44,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.56,
  });
  const outputMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.54,
  });
  const rollerMaterial = matte(PALETTE.accent, {
    metalness: 0.30,
    roughness: 0.42,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const frame = new THREE.Group();
  frame.userData.fixed = true;
  frame.userData.role = 'fixed-two-axis-bearing-stand';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(5.18, 0.16, 2.30),
    frameMaterial,
  );
  base.position.set(-0.75, 0.02, 0);
  base.userData.role = 'fixed-bed-supporting-perpendicular-shafts';
  frame.add(base);
  const driverPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, driverCenter.y - 0.08, 0.34),
    frameMaterial,
  );
  driverPost.position.set(
    driverCenter.x,
    (driverCenter.y + 0.08) / 2,
    -0.67,
  );
  driverPost.userData.role = 'rear-upright-for-horizontal-driver-shaft';
  frame.add(driverPost);
  const driverBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.052, 10, 48),
    frameMaterial,
  );
  driverBearing.position.set(driverCenter.x, driverCenter.y, -0.47);
  driverBearing.userData.role = 'fixed-bearing-for-horizontal-driver-shaft';
  frame.add(driverBearing);
  const outputBearing = torusNormalToY(0.19, 0.058, frameMaterial, 48);
  outputBearing.position.set(outputCenter.x, 0.17, outputCenter.z);
  outputBearing.userData.role = 'fixed-lower-bearing-for-vertical-output-shaft';
  frame.add(outputBearing);
  const contactBackplate = makeBeam(
    new THREE.Vector3(-outputRadius - 0.02, 0.63, -0.57),
    new THREE.Vector3(-outputRadius - 0.02, 2.26, -0.57),
    { color: PALETTE.frame, depth: 0.16, thickness: 0.20 },
  );
  contactBackplate.userData.role =
    'fixed-rear-brace-beside-roller-and-groove-contact-zone';
  frame.add(contactBackplate);
  root.add(frame);

  const driverRotor = new THREE.Group();
  driverRotor.position.copy(driverCenter);
  driverRotor.userData.axis = Z_AXIS.clone();
  driverRotor.userData.role =
    'continuously-rotating-small-wheel-with-eight-radial-roller-studs';
  const driverDisk = cylinderAlongZ(
    driverDiskRadius,
    driverDiskDepth,
    driverMaterial,
    72,
  );
  driverDisk.userData.role = 'small-left-hand-continuous-driver-wheel';
  driverRotor.add(driverDisk);
  const driverRims = [-1, 1].map((side) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(driverDiskRadius, 0.040, 10, 72),
      darkMaterial,
    );
    rim.position.z = side * driverDiskDepth / 2;
    rim.userData.role = 'dark-rim-on-continuous-driver-wheel';
    rim.visible = false; // ink edge line only: kept for references, not drawn
    rim.userData.retiredInkOutline = true;
    rim.userData.side = side;
    driverRotor.add(rim);
    return rim;
  });
  const driverShaft = cylinderAlongZ(
    0.105,
    driverShaftLength,
    darkMaterial,
    32,
  );
  driverShaft.userData.role = 'horizontal-continuous-input-shaft';
  driverRotor.add(driverShaft);
  const driverHub = cylinderAlongZ(0.22, 0.42, darkMaterial, 36);
  driverHub.userData.role = 'driver-wheel-hub-fixed-to-input-shaft';
  driverRotor.add(driverHub);
  const driverIndex = new THREE.Mesh(
    new THREE.BoxGeometry(driverDiskRadius * 0.58, 0.060, 0.030),
    whiteMaterial,
  );
  driverIndex.position.set(driverDiskRadius * 0.42, 0, 0.18);
  driverIndex.userData.role =
    'white-face-index-showing-continuous-driver-angle-and-rate';
  driverRotor.add(driverIndex);

  const rollerMounts = [];
  const radialStuds = [];
  const rollerBodies = [];
  const rollerSpinRotors = [];
  const rollerSpinIndexes = [];
  for (let index = 0; index < rollerCount; index += 1) {
    const mountAngle = -(index + 0.5) * rollerPitch;
    const mount = new THREE.Group();
    mount.rotation.z = mountAngle;
    mount.userData.index = index;
    mount.userData.mountAngle = mountAngle;
    mount.userData.role = 'radial-stud-and-free-friction-roller-mount';

    const stud = cylinderAlongX(0.052, 0.64, darkMaterial, 20);
    stud.position.x = 0.89;
    stud.userData.index = index;
    stud.userData.role = 'radial-stud-on-small-driver-wheel';
    mount.add(stud);
    radialStuds.push(stud);

    const axisAlignment = new THREE.Group();
    axisAlignment.position.x = rollerRadialCenter;
    axisAlignment.rotation.z = -Math.PI / 2;
    const spinRotor = new THREE.Group();
    spinRotor.userData.axisInAlignedCoordinates = Y_AXIS.clone();
    spinRotor.userData.index = index;
    spinRotor.userData.role = 'free-bearing-friction-roller-spin-rotor';
    const roller = new THREE.Mesh(
      new THREE.CylinderGeometry(
        rollerRadius,
        rollerRadius,
        rollerLength,
        32,
      ),
      rollerMaterial,
    );
    boreCylinder(roller,rollerRadius,.055,rollerLength);
    roller.userData.index = index;
    roller.userData.role =
      'friction-roller-on-one-of-eight-radial-driver-studs';
    spinRotor.add(roller);
    const spinIndex = new THREE.Mesh(
      new THREE.BoxGeometry(.025,.002,.030),
      whiteMaterial,
    );
    spinIndex.position.set(.10,rollerLength/2+.001,0);
    spinIndex.userData.index = index;
    spinIndex.userData.role =
      'white-index-showing-free-friction-roller-bearing-spin';
    spinRotor.add(spinIndex);
    axisAlignment.add(spinRotor);
    mount.add(axisAlignment);
    driverRotor.add(mount);
    rollerMounts.push(mount);
    rollerBodies.push(roller);
    rollerSpinRotors.push(spinRotor);
    rollerSpinIndexes.push(spinIndex);
  }
  root.add(driverRotor);

  const outputRotor = new THREE.Group();
  outputRotor.position.copy(outputCenter);
  outputRotor.userData.axis = Y_AXIS.clone();
  outputRotor.userData.role =
    'intermittently-indexed-large-horizontal-grooved-wheel-and-vertical-shaft';
  const outputWheel = new THREE.Mesh(
    radialGroovedWheelGeometry(grooveData),
    outputMaterial,
  );
  outputWheel.userData.role =
    'large-horizontal-output-wheel-with-cylindrical-working-face';
  outputRotor.add(outputWheel);
  const outputEndRims = []; // The closed profiled end faces include the groove mouths.
  // Brown rules the drum face into panels: a vertical line stands where one
  // groove leaves the top and the next enters the bottom. Each line is a
  // flush dark strip over the intact face between those two groove mouths.
  const panelLineMaterial = matte(PALETTE.ink, { roughness: 0.7 });
  const panelLineHalfAngle = 0.011 / grooveData.radius;
  const panelLines = [];
  {
    const {angular, vertical, height, angles, values, pitch} = grooveData;
    const rowIntact = (row) => {
      for (let i = 0; i < angular; i += 1) {
        if (values[row * angular + i] >= grooveData.radius - 1e-8) continue;
        const delta = positiveModulo(angles[row * angular + i] + pitch / 2, pitch) - pitch / 2;
        if (Math.abs(delta) < panelLineHalfAngle + 0.004) return false;
      }
      return true;
    };
    let first = 0;
    while (first < vertical && !rowIntact(first)) first += 1;
    let last = vertical;
    while (last > first && !rowIntact(last)) last -= 1;
    const bottom = -height / 2 + height * (first + 1) / vertical;
    const top = -height / 2 + height * (last - 1) / vertical;
    for (let index = 0; index < grooveCount; index += 1) {
      const angle = Math.PI - index * pitch;
      const line = new THREE.Mesh(
        new THREE.CylinderGeometry(
          grooveData.radius + 0.0008,
          grooveData.radius + 0.0008,
          top - bottom,
          2,
          1,
          true,
          Math.PI / 2 - angle - panelLineHalfAngle,
          2 * panelLineHalfAngle,
        ),
        panelLineMaterial,
      );
      line.position.y = (top + bottom) / 2;
      line.castShadow = false;
      line.userData.surfacePaint = true;
      line.userData.role = 'engraved-panel-line-between-oblique-grooves';
      outputWheel.add(line);
      panelLines.push(line);
    }
  }
  const outputShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 3.20, 32),
    darkMaterial,
  );
  outputShaft.position.y = 0.18;
  outputShaft.userData.role =
    'vertical-output-shaft-fixed-to-intermittent-large-wheel';
  outputRotor.add(outputShaft);
  const outputHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.23, 0.23, outputBodyHeight * 1.36, 36),
    darkMaterial,
  );
  outputHub.userData.role = 'large-wheel-hub-fixed-to-vertical-output-shaft';
  outputRotor.add(outputHub);
  const grooveFlanks = [];
  const grooveEntries = [];
  // Working walls are the finite roller envelope baked into outputWheel;
  // no raised centerline tubes or spheres occupy the groove mouths.
  const outputIndex = new THREE.Mesh(
    new THREE.BoxGeometry(outputRadius * 0.82, 0.035, 0.060),
    whiteMaterial,
  );
  outputIndex.position.set(outputRadius * 0.48, outputBodyHalfHeight + 0.035, 0);
  outputIndex.userData.role =
    'white-top-face-index-showing-output-dwell-and-index-rate';
  outputRotor.add(outputIndex);
  const indexedGrooveMarker = new THREE.Mesh(
    new THREE.BoxGeometry(.05,.003,.07),
    whiteMaterial,
  );
  indexedGrooveMarker.position.set(-.75,outputBodyHalfHeight+.0015,.30);
  indexedGrooveMarker.userData.role =
    'white-marker-identifying-one-of-eight-oblique-output-grooves';
  outputRotor.add(indexedGrooveMarker);
  root.add(outputRotor);

  const update = (time) => {
    const state = stateAtTime(time);
    driverRotor.rotation.z = state.driverAngle;
    outputRotor.rotation.y = state.outputAngle;
    rollerSpinRotors.forEach((spinRotor, index) => {
      spinRotor.rotation.y = state.rollerSpinAngles[index];
    });
    root.userData.currentState = state;
    root.userData.contacts = {
      rollerToObliqueGroove: {
        activeGrooveIndex: state.activeGrooveIndex,
        activeRollerIndex: state.activeRollerIndex,
        contactCount: state.contactCount,
        contactError: state.contactError,
        contactPoint: state.contactPoint?.clone() ?? null,
        grooveWorldPoint: state.grooveWorldPoint?.clone() ?? null,
        rollerAxisContactRadialCoordinate:
          state.rollerAxisContactRadialCoordinate,
        rollerContactWithinBody: state.rollerContactWithinBody,
      },
      perpendicularShafts: {
        axisDot: Math.abs(Z_AXIS.dot(Y_AXIS)),
        driverAxis: Z_AXIS.clone(),
        outputAxis: Y_AXIS.clone(),
      },
    };
  };

  root.userData = {
    archetype:
      'perpendicular-axis-eight-roller-oblique-groove-intermittent-indexer',
    blocks: {
      base,
      contactBackplate,
      driverBearing,
      driverDisk,
      driverHub,
      driverIndex,
      driverPost,
      driverRims,
      driverRotor,
      driverShaft,
      frame,
      grooveEntries,
      grooveFlanks,
      indexedGrooveMarker,
      outputBearing,
      outputEndRims,
      outputHub,
      outputIndex,
      outputRotor,
      outputShaft,
      outputWheel,
      radialStuds,
      rollerBodies,
      rollerMounts,
      rollerSpinIndexes,
      rollerSpinRotors,
    },
    curves: {
      grooveCenterCurves,
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'large-wheel intermittent angle fixed by the engaged roller and oblique groove face',
        'each friction roller bearing spin while that roller traverses a groove',
      ],
      independentPrescribedInputs: 1,
      input: 'continuous rotation of the small horizontal-axis wheel',
      note:
        'only one roller can occupy the working-height interval at a time; the large vertical-axis wheel dwells while all rollers are outside it',
      storedEnergyStates: 0,
    },
    dynamics: {
      exactHistoricalGrooveProfileSpecified: false,
      frictionAssumption:
        'positive friction is assumed between the active free roller and one oblique groove face; force, compliance, and slip coefficients are absent from Brown',
      rollerBearingSpinModel:
        'during contact the displayed free roller rolls through the reconstructed groove-centerline arclength; between contacts its spin is held because Brown specifies no bearing drag',
      sourceSpecifiesInputSpeedOrInertia: false,
    },
    fidelity: 'authored',
    geometry: {
      contactEndPhase,
      contactFraction,
      contactHalfAngle,
      contactStartPhase,
      driverCenter: driverCenter.clone(),
      driverDiskDepth,
      driverDiskRadius,
      driverShaftLength,
      driverToOutputTangent,
      fullTurn: FULL_TURN,
      grooveArcLength,
      grooveCenterRadius,
      grooveCount,
      grooveFlankAngularOffset,
      grooveSegments,
      grooveTubeRadius,
      inputAngularSpeed,
      inputCyclePeriod,
      outputBodyHalfHeight,
      outputBodyHeight,
      outputCenter: outputCenter.clone(),
      outputPitch,
      outputRadius,
      outputWorkingHalfHeight,
      rollerCount,
      rollerInnerRadius,
      rollerLength,
      rollerOuterRadius,
      rollerPitch,
      rollerRadialCenter,
      rollerRadius,
      sourceDriverAngle,
    },
    grooveArcLengthAt,
    grooveLocalPoint,
    indexProfile: {
      acceleration: quinticIndexSecondDerivative,
      displacement: quinticIndex,
      velocity: quinticIndexDerivative,
    },
    mechanism:
      'continuous-small-horizontal-axis-wheel-with-eight-radial-friction-rollers-indexing-eight-oblique-rim-grooves-on-a-perpendicular-vertical-axis-wheel',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate364: {
        driverBodyRadiusPixels: 74,
        driverCenter: new THREE.Vector2(111, 259),
        driverRollerCenters: [
          new THREE.Vector2(111, 145),
          new THREE.Vector2(175, 181),
          new THREE.Vector2(190, 259),
          new THREE.Vector2(165, 328),
          new THREE.Vector2(111, 365),
          new THREE.Vector2(45, 328),
          new THREE.Vector2(8, 259),
          new THREE.Vector2(47, 191),
        ],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 8,
        outputAxisX: 348,
        outputBandBottomY: 304,
        outputBandTopY: 216,
        outputRimLeftX: 197,
        outputRimRightX: 514,
        visibleNearSideGrooveBranches: 4,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the small wheel on the left is the continuous driver',
          'its radial studs carry friction rollers',
          'the two rotary axes are at right angles',
          'the rollers work against oblique groove or projection faces on the larger wheel',
          'the larger wheel motion is intermittent',
        ],
        engravingEvidence:
          'the plate shows eight equally spaced driver rollers, a face-on horizontal-axis driver, an edge-on thick horizontal output wheel on a vertical shaft, and four oblique branches on the visible half of its cylindrical rim',
        reconstructionDisclosure:
          'eight matching output grooves and a zero-velocity/zero-acceleration quintic index profile reconstruct the hidden half and make the curved oblique faces dynamically continuous; Brown gives neither a section nor an exact groove equation',
      },
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtDriverAngle,
    stateAtTime,
    timeline: {
      contactDurationPerEvent:
        inputCyclePeriod / rollerCount * contactFraction,
      demonstrationPeriod: inputCyclePeriod,
      dwellDurationPerEvent:
        inputCyclePeriod / rollerCount * (1 - contactFraction),
      eventsPerInputTurn: rollerCount,
      note:
        'one deliberately uniform input revolution shows all eight roller engagements and eight intervening dwells; Brown supplies no speed',
    },
    transmission: {
      averageRatio:
        'eight equal roller events advance eight equal output pitches, so one input revolution produces one opposite-sense output revolution on average',
      contactGeometry:
        'the active radial roller axis intersects the output rim at y = centerY + tangentDistance*tan(rollerAngle); the matching groove local angle cancels the output index angle so that its centerline stays on that axis',
      dwellLaw:
        'output angle is exactly constant outside the single-roller contact window',
      indexLaw:
        'each contact advances exactly 2*pi/8 in the opposite sense using a quintic displacement profile through the oblique rim groove',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.92, -0.08, -1.72),
    new THREE.Vector3(1.72, 3.28, 1.72),
  );
  root.userData.finiteGrooveEnvelope={clearance:grooveData.clearance,profile:"offline swept finite cylinders, with retained driving walls"};
  root.userData.reconstructionNote = 'The caption gives oblique roller grooves but no exact profile or timing. This reconstruction prescribes a quintic index and dwell and cuts the finite roller envelope offline. Finite rollers clear the groove walls in sampled surface checks; clearance take-up, friction, roller traction and dwell holding are not dynamically solved.';
  finishGrooveDrive(root,inputCyclePeriod);
  root.userData.groundFloorY = -0.06;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(5.5, 3.5, 8.8),
    root,
    update,
  };
}

export function createAuthoredOrthogonalRollerIndexerMovement(movement) {
  if (movement.id === 364) return orthogonalRollerGrooveIndexer(movement);
  return null;
}
