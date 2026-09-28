import {correctReciprocatingCordParts} from './reciprocating-cord-working-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeDynamicMovingBelt,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function cylinderAlongY(radius, length, material, segments = 32) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function ringAroundY(radius, tubeRadius, material, segments = 40) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tubeRadius, 10, segments),
    material,
  );
  ring.rotation.x = Math.PI / 2;
  return ring;
}

// The cord is one material length whose midpoint is secured at the spindle.
// It is rendered as two open branches only because each half follows its own
// path from that common anchorage to an end of the hand bar.  This curve uses
// material distance as its parameter, so a marker never jumps when its point
// passes between a free span and the portion wrapped around the spindle.
class PumpDrillCordBranchCurve extends THREE.Curve {
  constructor(geometry) {
    super();
    this.geometry = geometry;
  }

  getPoint(value, target = new THREE.Vector3()) {
    const data = this.geometry;
    const distance = THREE.MathUtils.clamp(value, 0, 1)
      * data.branchLength;

    if (distance <= data.connectorLength) {
      const progress = data.connectorLength > 1e-12
        ? distance / data.connectorLength
        : 1;
      return target.copy(data.eyePoint).lerp(data.helixStart, progress);
    }

    const afterConnector = distance - data.connectorLength;
    if (
      data.helixLength > 1e-10
      && afterConnector <= data.helixLength
    ) {
      const progress = afterConnector / data.helixLength;
      const phase = data.helixStartPhase
        + data.spindleAngle * progress;
      return target.set(
        data.spindleRadius * Math.cos(phase),
        THREE.MathUtils.lerp(
          data.helixStart.y,
          data.contactPoint.y,
          progress,
        ),
        data.spindleRadius * Math.sin(phase),
      );
    }

    const freeDistance = Math.max(0, afterConnector - data.helixLength);
    const progress = data.freeLength > 1e-12
      ? THREE.MathUtils.clamp(freeDistance / data.freeLength, 0, 1)
      : 1;
    return target.copy(data.contactPoint).lerp(data.handlePoint, progress);
  }

  getPointAt(value, target = new THREE.Vector3()) {
    return this.getPoint(value, target);
  }

  getTangent(value, target = new THREE.Vector3()) {
    const data = this.geometry;
    const distance = THREE.MathUtils.clamp(value, 0, 1)
      * data.branchLength;
    if (distance < data.connectorLength - 1e-9) {
      return target.subVectors(data.helixStart, data.eyePoint).normalize();
    }
    if (
      data.helixLength > 1e-10
      && distance < data.connectorLength + data.helixLength - 1e-9
    ) {
      const progress = (
        distance - data.connectorLength
      ) / data.helixLength;
      const phase = data.helixStartPhase
        + data.spindleAngle * progress;
      return target.set(
        -data.spindleRadius * Math.sin(phase) * data.spindleAngle,
        data.contactPoint.y - data.helixStart.y,
        data.spindleRadius * Math.cos(phase) * data.spindleAngle,
      ).normalize();
    }
    return target.subVectors(data.handlePoint, data.contactPoint).normalize();
  }

  getTangentAt(value, target = new THREE.Vector3()) {
    return this.getTangent(value, target);
  }

  getLength() {
    return this.geometry.branchLength;
  }

  getLengths(divisions = 200) {
    return Array.from(
      { length: divisions + 1 },
      (_, index) => this.geometry.branchLength * index / divisions,
    );
  }

  getUtoTmapping(value) {
    return value;
  }
}

function makePumpDrillKinematics({
  anchorY,
  connectorDrop,
  crossbarLowY,
  handleHalfSpan,
  maximumWindingAngle,
  spindleRadius,
  tangentTransitionAngle,
}) {
  const helixStartY = anchorY - connectorDrop;
  const connectorLength = Math.hypot(spindleRadius, connectorDrop);
  const unwoundHorizontalRun = handleHalfSpan - spindleRadius;
  const activeBranchLength = Math.hypot(
    unwoundHorizontalRun,
    helixStartY - crossbarLowY,
  );
  const branchLength = connectorLength + activeBranchLength;
  const tangentAngle = Math.acos(spindleRadius / handleHalfSpan);

  const geometryAtAngle = (unboundedAngle, side) => {
    const spindleAngle = THREE.MathUtils.clamp(
      unboundedAngle,
      -maximumWindingAngle,
      maximumWindingAngle,
    );
    const absoluteAngle = Math.abs(spindleAngle);
    const endpointPhase = side < 0 ? Math.PI : 0;
    // A taut free span tends toward the appropriate cylindrical tangent on
    // either side.  Around the exactly-unwound position that tangent changes
    // sides continuously through the radial position instead of teleporting.
    const handednessBlend = Math.tanh(
      spindleAngle / tangentTransitionAngle,
    );
    const contactPhase = endpointPhase
      - tangentAngle * handednessBlend;
    const phaseDifference = endpointPhase - contactPhase;
    const freeHorizontalRun = Math.sqrt(
      handleHalfSpan ** 2
      + spindleRadius ** 2
      - 2 * handleHalfSpan * spindleRadius * Math.cos(phaseDifference),
    );
    const circumferentialWrap = spindleRadius * absoluteAngle;
    const developedRun = circumferentialWrap + freeHorizontalRun;
    const axialDrop = Math.sqrt(Math.max(
      0,
      activeBranchLength ** 2 - developedRun ** 2,
    ));
    const helixShare = developedRun > 1e-12
      ? circumferentialWrap / developedRun
      : 0;
    const contactDrop = axialDrop * helixShare;
    const helixLength = activeBranchLength * helixShare;
    const freeLength = activeBranchLength - helixLength;
    const barY = helixStartY - axialDrop;
    const helixStartPhase = contactPhase - spindleAngle;
    const eyePoint = new THREE.Vector3(0, anchorY, 0);
    const helixStart = new THREE.Vector3(
      spindleRadius * Math.cos(helixStartPhase),
      helixStartY,
      spindleRadius * Math.sin(helixStartPhase),
    );
    const contactPoint = new THREE.Vector3(
      spindleRadius * Math.cos(contactPhase),
      helixStartY - contactDrop,
      spindleRadius * Math.sin(contactPhase),
    );
    const handlePoint = new THREE.Vector3(
      side * handleHalfSpan,
      barY,
      0,
    );

    return {
      absoluteAngle,
      activeBranchLength,
      axialDrop,
      barY,
      branchLength,
      circumferentialWrap,
      connectorLength,
      contactPhase,
      contactPoint,
      developedRun,
      endpointPhase,
      eyePoint,
      freeHorizontalRun,
      freeLength,
      handlePoint,
      handednessBlend,
      helixLength,
      helixStart,
      helixStartPhase,
      helixStartY,
      side,
      spindleAngle,
      spindleRadius,
    };
  };

  const stateAtSpindleAngle = (angle) => {
    const leftCord = geometryAtAngle(angle, -1);
    const rightCord = geometryAtAngle(angle, 1);
    const windingTurns = Math.abs(leftCord.spindleAngle) / FULL_TURN;
    return {
      barY: leftCord.barY,
      leftCord,
      rightCord,
      spindleAngle: leftCord.spindleAngle,
      windingHandedness: leftCord.spindleAngle < -1e-9
        ? 'negative-handed winding'
        : leftCord.spindleAngle > 1e-9
          ? 'positive-handed winding'
          : 'fully unwound',
      windingTurns,
    };
  };

  return {
    activeBranchLength,
    branchLength,
    connectorLength,
    helixStartY,
    stateAtSpindleAngle,
    tangentAngle,
    unwoundHorizontalRun,
  };
}

function pumpDrill(movement) {
  const root = new THREE.Group();

  const cyclePeriod = 8;
  const cycleRate = FULL_TURN / cyclePeriod;
  // With Brown's thicker spindle each turn takes up more cord, so the cord
  // winds about 1.1 turns each way and the crossbar travels a little lower.
  const maximumWindingAngle = 7.0;
  // Cord centreline radius. The visible spindle (0.037 less) is 0.157, about
  // 0.087 of the fly's diameter as Brown draws it.
  const spindleRadius = 0.194;
  const handleHalfSpan = 1.62;
  const anchorY = 2.45;
  const connectorDrop = 0.16; // gentler eye-to-helix bend for the thicker spindle
  const crossbarLowY = -0.40;
  const tangentTransitionAngle = 0.42;
  // Brown draws the fly as a heavy disk wider than the crossbar
  // (427 px against the crossbar's 383 px) with a thick rounded edge.
  const flywheelRadius = 1.81;
  const flywheelY = -0.90;
  const flywheelThickness = 0.50;

  const kinematics = makePumpDrillKinematics({
    anchorY,
    connectorDrop,
    crossbarLowY,
    handleHalfSpan,
    maximumWindingAngle,
    spindleRadius,
    tangentTransitionAngle,
  });

  const stateAtSpindleAngle = (angle) => (
    kinematics.stateAtSpindleAngle(angle)
  );
  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cyclePeriod);
    const phase = cycleTime / cyclePeriod;
    const phaseAngle = FULL_TURN * phase;
    const spindleAngle = -maximumWindingAngle * Math.cos(phaseAngle);
    const spindleAngularSpeed = maximumWindingAngle
      * cycleRate * Math.sin(phaseAngle);
    const spindleAngularAcceleration = maximumWindingAngle
      * cycleRate ** 2 * Math.cos(phaseAngle);
    const state = stateAtSpindleAngle(spindleAngle);
    let stage;
    if (phase < 0.25) stage = 'first hand-powered downstroke';
    else if (phase < 0.5) stage = 'first flywheel-powered rewind';
    else if (phase < 0.75) stage = 'second hand-powered downstroke';
    else stage = 'second flywheel-powered rewind';
    return {
      ...state,
      atDirectionReversal:
        Math.abs(Math.abs(spindleAngle) - maximumWindingAngle) < 1e-8,
      atUnwoundMidpoint: Math.abs(spindleAngle) < 1e-8,
      cycleTime,
      operatorAction: stage.includes('hand-powered')
        ? 'pressing the crossbar downward'
        : 'relieving the crossbar while flywheel momentum rewinds the cord',
      phase,
      rotationDirection: spindleAngularSpeed > 1e-9
        ? 'positive'
        : spindleAngularSpeed < -1e-9
          ? 'negative'
          : 'reversal',
      spindleAngularAcceleration,
      spindleAngularSpeed,
      stage,
    };
  };

  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.42,
  });
  const shaftMaterial = matte(PALETTE.driven, {
    metalness: 0.20,
    roughness: 0.49,
  });
  const flywheelMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.55,
  });
  const handleMaterial = matte(PALETTE.driver, {
    metalness: 0.09,
    roughness: 0.61,
  });
  const brassMaterial = matte(PALETTE.accent, {
    metalness: 0.30,
    roughness: 0.43,
  });

  const spindleRotor = new THREE.Group();
  spindleRotor.userData.axis = Y_AXIS.clone();
  spindleRotor.userData.role = 'alternately-rotating-drill-spindle-assembly';

  const spindle = cylinderAlongY(
    spindleRadius,
    4.03,
    shaftMaterial,
    36,
  );
  spindle.position.y = 0.60;
  spindle.userData.role = 'cord-wound-vertical-drill-spindle';
  spindleRotor.add(spindle);

  const topCap = cylinderAlongY(0.145, 0.10, darkMaterial, 32);
  topCap.position.y = 2.59;
  topCap.userData.role = 'cord-midpoint-anchorage-collar';
  spindleRotor.add(topCap);
  // Brown's spindle runs plain out of the plate: no top nut, and the cord's
  // anchorage pin stays inside the spindle.
  topCap.visible = false;

  const eyePin = cylinderAlongY(0.045, 0.33, brassMaterial, 20);
  eyePin.rotation.z = Math.PI / 2;
  eyePin.position.y = anchorY;
  eyePin.userData.role = 'transverse-cord-anchoring-eye';
  spindleRotor.add(eyePin);
  eyePin.visible = false;

  // A disk with a fully rounded (semicircular) rim, as the plate shades it.
  const flywheelProfile = [new THREE.Vector2(0, -flywheelThickness / 2)];
  const edgeRadius = flywheelThickness / 2;
  const edgeCentre = flywheelRadius - edgeRadius;
  for (let step = 0; step <= 16; step += 1) {
    const angle = -Math.PI / 2 + Math.PI * step / 16;
    flywheelProfile.push(new THREE.Vector2(
      edgeCentre + edgeRadius * Math.cos(angle),
      edgeRadius * Math.sin(angle),
    ));
  }
  flywheelProfile.push(new THREE.Vector2(0, flywheelThickness / 2));
  const flywheel = new THREE.Mesh(
    new THREE.LatheGeometry(flywheelProfile, 96),
    flywheelMaterial,
  );
  flywheel.position.y = flywheelY;
  flywheel.userData.role = 'heavy-momentum-flywheel-fixed-to-spindle';
  spindleRotor.add(flywheel);

  const flywheelHub = cylinderAlongY(0.25, 0.34, darkMaterial, 32);
  flywheelHub.position.y = flywheelY;
  flywheelHub.userData.role = 'flywheel-hub';
  spindleRotor.add(flywheelHub);

  const drillSocket = cylinderAlongY(0.25, 0.31, brassMaterial, 28);
  drillSocket.position.y = -1.54;
  drillSocket.userData.role = 'source-labeled-drill-socket-E';
  spindleRotor.add(drillSocket);

  const drillNeck = cylinderAlongY(0.075, 0.30, darkMaterial, 20);
  drillNeck.position.y = -1.80;
  drillNeck.userData.role = 'source-labeled-drill-F';
  spindleRotor.add(drillNeck);

  const drillBit = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.18, 0),
    darkMaterial,
  );
  drillBit.scale.set(0.68, 1.85, 0.28);
  drillBit.position.y = -2.04;
  drillBit.userData.role = 'bidirectionally-cutting-drill-point-G';
  spindleRotor.add(drillBit);

  root.add(spindleRotor);

  const crossbar = new THREE.Group();
  crossbar.userData.role = 'hand-pumped-transverse-sliding-crossbar';
  const sleeveOuterRadius = 0.30;
  const beamLength = handleHalfSpan - sleeveOuterRadius;
  for (const side of [-1, 1]) {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(beamLength, 0.14, 0.24),
      handleMaterial,
    );
    beam.position.x = side * (handleHalfSpan + sleeveOuterRadius) / 2;
    beam.userData.role = 'crossbar-hand-pressing-arm';
    crossbar.add(beam);

    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.20, 0.32),
      darkMaterial,
    );
    grip.position.x = side * handleHalfSpan;
    grip.userData.role = 'crossbar-hand-grip';
    crossbar.add(grip);

    const cordKnot = ringAroundY(0.09, 0.032, brassMaterial, 24);
    cordKnot.position.x = side * handleHalfSpan;
    cordKnot.position.y = 0;
    cordKnot.userData.role = 'single-cord-end-fastened-to-crossbar';
    crossbar.add(cordKnot);
  }
  const slidingSleeve = ringAroundY(
    sleeveOuterRadius,
    0.062,
    darkMaterial,
    36,
  );
  slidingSleeve.userData.role = 'loose-crossbar-guide-hole-around-spindle';
  crossbar.add(slidingSleeve);
  root.add(crossbar);

  const initialState = stateAtTime(0);
  const singleCord = new THREE.Group();
  singleCord.userData.role = 'one-cord-with-two-pump-drill-branches';
  const cordBranches = [
    { key: 'leftCord', side: -1 },
    { key: 'rightCord', side: 1 },
  ].map(({ key, side }) => {
    const initialGeometry = initialState[key];
    const branch = makeDynamicMovingBelt(
      new PumpDrillCordBranchCurve(initialGeometry),
      // Brown hatches the cord as laid rope; its lay replaces the markers.
      {
        closed: false,
        color: PALETTE.belt,
        laid: true,
        radius: 0.035,
        tubularSegments: 180,
      },
    );
    branch.userData.markers = [];
    branch.userData.materialLength = kinematics.branchLength;
    branch.userData.role = side < 0
      ? 'left-half-of-single-pump-drill-cord'
      : 'right-half-of-single-pump-drill-cord';
    branch.userData.side = side;
    singleCord.add(branch);
    return branch;
  });
  singleCord.userData.branches = cordBranches;
  singleCord.userData.materialTopology =
    'one cord secured at its midpoint to the spindle, with one end fastened to each crossbar grip';
  root.add(singleCord);

  const update = (time) => {
    const state = stateAtTime(time);
    spindleRotor.rotation.y = state.spindleAngle;
    crossbar.position.y = state.barY;
    for (const [index, key] of ['leftCord', 'rightCord'].entries()) {
      const geometry = state[key];
      cordBranches[index].userData.setCurve(
        new PumpDrillCordBranchCurve(geometry),
      );
      // Both ends are tied, so the lay keeps its material coordinate.
      cordBranches[index].userData.updateDistance(0);
    }
    root.userData.currentState = state;
  };

  const highState = stateAtSpindleAngle(maximumWindingAngle);
  root.userData = {
    archetype: 'single-cord-flywheel-pump-drill',
    blocks: {
      cordBranches,
      crossbar,
      drillBit,
      drillSocket,
      flywheel,
      singleCord,
      spindle,
      spindleRotor,
    },
    degreesOfFreedom: {
      input:
        'one alternating hand displacement of the loose transverse crossbar',
      mechanism: 1,
      output:
        'the spindle, flywheel, socket, and drill share one alternating rotation',
    },
    fidelity: 'authored',
    geometry: {
      anchorY,
      branchLength: kinematics.branchLength,
      connectorDrop,
      crossbarHighY: highState.barY,
      crossbarLowY,
      cyclePeriod,
      flywheelRadius,
      flywheelThickness,
      flywheelY,
      handleHalfSpan,
      maximumWindingAngle,
      maximumWindingTurns: maximumWindingAngle / FULL_TURN,
      spindleRadius,
      tangentAngle: kinematics.tangentAngle,
      tangentTransitionAngle,
    },
    mechanism:
      'single-cord-reciprocating-pump-drill-with-inertial-flywheel',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate359: {
        anchor: new THREE.Vector2(259, 184),
        crossbarLeft: new THREE.Vector2(70, 259),
        crossbarRight: new THREE.Vector2(453, 259),
        drillPoint: new THREE.Vector2(258, 507),
        flywheelBottom: new THREE.Vector2(259, 389),
        flywheelLeft: new THREE.Vector2(47, 354),
        flywheelRight: new THREE.Vector2(474, 354),
        flywheelTop: new THREE.Vector2(259, 321),
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 7,
        spindleBottom: new THREE.Vector2(259, 475),
        spindleTop: new THREE.Vector2(259, 23),
      },
      fullerAnalyticalTable: {
        movementNumber: 47,
        publication:
          'John Douglas Pitts Fuller, A Key to the Analytical Table of Mechanical Movements',
        publicationYear: 1834,
        use:
          'direct predecessor of Brown 359; identifies the horizontal piece as the hand input and the bands as the cause of alternate drill revolution',
      },
      lanzBetancourt: {
        figure: 'plate 9, figure F17',
        labels: {
          A: 'spindle or stem',
          BB: 'cord or band',
          CC: 'crosspiece',
          D: 'fly',
          E: 'socket',
          F: 'drill',
          G: 'cutting point',
        },
        page: 143,
        publication:
          'Jose Maria de Lanz and Agustin de Betancourt, Analytical Essay on the Construction of Machines',
        publicationYear: 1820,
        use:
          'earlier exact figure and description establishing alternate rectilinear crosspiece motion and alternate circular drill motion',
      },
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        edition: 21,
        publicationYear: 1908,
      },
    },
    stateAtSpindleAngle,
    stateAtTime,
    timeline: {
      demonstrationPeriod: cyclePeriod,
      firstDirectionReversal: 0,
      firstUnwoundSpeedMaximum: cyclePeriod / 4,
      note:
        'Brown supplies no timing; a sinusoidal alternating spindle angle is used solely as a smooth display cycle, preserving the required downstroke, inertial rewind, and reversal order',
      oppositeDirectionReversal: cyclePeriod / 2,
      secondUnwoundSpeedMaximum: cyclePeriod * 3 / 4,
    },
    transmission: {
      constantLengthLaw:
        'each half of the one cord has fixed material length; winding one cylindrical-helical portion shortens its free span and raises the crossbar',
      flywheelPhaseLaw:
        'flywheel angular speed is greatest when the cord is fully unwound and zero only at the two fully rewound direction reversals',
      noSlipWindingLaw:
        'circumferential cord take-up equals spindleRadius * absolute(spindleAngle)',
      outputSense:
        'successive hand downstrokes turn the drill in opposite directions',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-1.94, -2.28, -1.52),
    new THREE.Vector3(1.94, 2.72, 1.52),
  );
  root.userData.groundFloorY = -2.23;
  correctReciprocatingCordParts(root,359,update);
  // Brown draws a level side elevation with the fly seen edge-on; a long
  // lens keeps the flywheel faces from opening into an ellipse.
  root.userData.cameraDirection = new THREE.Vector3(0.12, 0.02, 15);
  root.userData.cameraFov = 16;
  markShadows(root);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredPumpDrillMovement(movement) {
  if (movement.id === 359) return pumpDrill(movement);
  return null;
}
