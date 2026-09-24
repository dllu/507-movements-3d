import * as THREE from 'three';
import {
  PALETTE,
  makeDynamicCable,
  markShadows,
  matte,
} from './primitives.js';

import { fitPistonGuide } from './piston-guide-parts.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderBetween(start, end, radius, material, segments = 12) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.position.copy(start).add(end).multiplyScalar(0.5);
  cylinder.quaternion.setFromUnitVectors(
    Y_AXIS,
    direction.normalize(),
  );
  return cylinder;
}

function beamBetween(start, end, width, depth, material) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(length, width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    direction.normalize(),
  );
  return beam;
}

class CycloidalCheekCurve extends THREE.Curve {
  constructor({ cycloidRadius, lowestBobY, side, maximumParameter, z, offset = 0 }) {
    super();
    this.cycloidRadius = cycloidRadius;
    this.lowestBobY = lowestBobY;
    this.side = side;
    this.maximumParameter = maximumParameter;
    this.z = z;
    this.offset = offset;
  }

  getPoint(progress, target = new THREE.Vector3()) {
    const theta = this.side * this.maximumParameter * progress;
    return target.set(
      this.cycloidRadius * (theta - Math.sin(theta))
        + this.side * this.offset * Math.cos(theta / 2),
      this.lowestBobY
        + this.cycloidRadius * (3 + Math.cos(theta))
        + this.offset * Math.sin(Math.abs(theta) / 2),
      this.z,
    );
  }
}

class CycloidalBobPathCurve extends THREE.Curve {
  constructor({ amplitude, cycloidRadius, lowestBobY, z }) {
    super();
    this.amplitude = amplitude;
    this.cycloidRadius = cycloidRadius;
    this.lowestBobY = lowestBobY;
    this.z = z;
  }

  getPoint(progress, target = new THREE.Vector3()) {
    const theta = THREE.MathUtils.lerp(
      -this.amplitude,
      this.amplitude,
      progress,
    );
    return target.set(
      this.cycloidRadius * (theta + Math.sin(theta)),
      this.lowestBobY
        + this.cycloidRadius * (1 - Math.cos(theta)),
      this.z,
    );
  }
}

function cycloidalIsochronousPendulum(movement) {
  const root = new THREE.Group();

  const cycloidRadius = 0.82;
  const gravity = 9.81;
  const bobMass = 1;
  const totalCordLength = 4 * cycloidRadius;
  const naturalAngularFrequency = Math.sqrt(
    gravity / (4 * cycloidRadius),
  );
  const isochronousPeriod = FULL_TURN / naturalAngularFrequency;
  const oscillationAmplitude = THREE.MathUtils.degToRad(100);
  const maximumCheekParameter = THREE.MathUtils.degToRad(164);
  const arcAmplitude = totalCordLength
    * Math.sin(oscillationAmplitude / 2);
  const lowestBobY = -0.92;
  const cuspY = lowestBobY + totalCordLength;
  const mechanismPlaneZ = 0.20;
  const cheekDepth = 0.30;
  const cheekThickness = 0.18;
  const cordRadius = 0.028;
  const contactClearance = 0.0006;
  const wrappedCableSegments = 48;
  const freeCableSegments = 18;

  const normalizedCyclePhase = (time) => {
    const rawPhase = positiveModulo(time, isochronousPeriod)
      / isochronousPeriod;
    for (const boundary of [0, 0.25, 0.5, 0.75, 1]) {
      if (Math.abs(rawPhase - boundary) < 1e-12) {
        return boundary === 1 ? 0 : boundary;
      }
    }
    return rawPhase;
  };
  const trigonometryAtCyclePhase = (cyclePhase) => {
    if (cyclePhase === 0) return { cosine: 1, sine: 0 };
    if (cyclePhase === 0.25) return { cosine: 0, sine: 1 };
    if (cyclePhase === 0.5) return { cosine: -1, sine: 0 };
    if (cyclePhase === 0.75) return { cosine: 0, sine: -1 };
    const angle = FULL_TURN * cyclePhase;
    return { cosine: Math.cos(angle), sine: Math.sin(angle) };
  };

  const bobPointAtParameter = (theta, z = mechanismPlaneZ) => (
    new THREE.Vector3(
      cycloidRadius * (theta + Math.sin(theta)),
      lowestBobY + cycloidRadius * (1 - Math.cos(theta)),
      z,
    )
  );
  const cheekPointAtParameter = (theta, z = mechanismPlaneZ) => (
    new THREE.Vector3(
      cycloidRadius * (theta - Math.sin(theta)),
      lowestBobY + cycloidRadius * (3 + Math.cos(theta)),
      z,
    )
  );
  const signedArcCoordinateAtParameter = (theta) => (
    totalCordLength * Math.sin(theta / 2)
  );
  const parameterAtSignedArcCoordinate = (arcCoordinate) => (
    2 * Math.asin(THREE.MathUtils.clamp(
      arcCoordinate / totalCordLength,
      -1,
      1,
    ))
  );
  const wrappedCordLengthAtParameter = (theta) => (
    totalCordLength * (1 - Math.cos(Math.abs(theta) / 2))
  );
  const freeCordLengthAtParameter = (theta) => (
    totalCordLength * Math.cos(theta / 2)
  );
  const potentialHeightAtArcCoordinate = (arcCoordinate) => (
    arcCoordinate ** 2 / (8 * cycloidRadius)
  );
  const periodForAmplitude = (amplitude) => {
    if (!Number.isFinite(amplitude)
      || Math.abs(amplitude) >= Math.PI) {
      throw new RangeError(
        'Cycloidal-pendulum amplitude must be finite and below pi radians.',
      );
    }
    return isochronousPeriod;
  };

  const stateFromOscillator = ({
    arcCoordinate,
    arcAcceleration,
    arcVelocity,
    cyclePhase,
  }) => {
    const theta = parameterAtSignedArcCoordinate(arcCoordinate);
    const halfTheta = theta / 2;
    const thetaRate = arcVelocity
      / (2 * cycloidRadius * Math.cos(halfTheta));
    const bobPoint = bobPointAtParameter(theta);
    const contactPoint = cheekPointAtParameter(theta);
    const wrappedCordLength = wrappedCordLengthAtParameter(theta);
    const freeCordLength = freeCordLengthAtParameter(theta);
    const limitingTangent = new THREE.Vector3(
      Math.sin(halfTheta),
      -Math.cos(halfTheta),
      0,
    );
    const freeCordDirection = limitingTangent.clone();
    const cheekTangent = limitingTangent.clone();
    const bobPathTangent = new THREE.Vector3(
      Math.cos(halfTheta),
      Math.sin(halfTheta),
      0,
    );
    const bobVelocity = bobPathTangent.clone().multiplyScalar(arcVelocity);
    const potentialHeight = bobPoint.y - lowestBobY;
    const kineticEnergy = 0.5 * bobMass * arcVelocity ** 2;
    const potentialEnergy = bobMass * gravity * potentialHeight;
    const totalMechanicalEnergy = kineticEnergy + potentialEnergy;
    let stage;
    if (theta >= 0 && arcVelocity >= 0) {
      stage = 'outward-right-swing-wrapping-right-cheek';
    } else if (theta >= 0) {
      stage = 'returning-from-right-and-unwrapping-right-cheek';
    } else if (arcVelocity <= 0) {
      stage = 'outward-left-swing-wrapping-left-cheek';
    } else {
      stage = 'returning-from-left-and-unwrapping-left-cheek';
    }
    return {
      activeCheek: theta > 1e-12
        ? 'right'
        : theta < -1e-12 ? 'left' : 'cusp',
      arcAcceleration,
      arcCoordinate,
      arcVelocity,
      bobPathTangent,
      bobPoint,
      bobVelocity,
      cheekTangent,
      contactPoint,
      cyclePhase,
      freeCordDirection,
      freeCordLength,
      kineticEnergy,
      potentialEnergy,
      potentialHeight,
      stage,
      theta,
      thetaRate,
      totalCordLength: freeCordLength + wrappedCordLength,
      totalMechanicalEnergy,
      wrappedCordLength,
    };
  };

  const stateAtTimeForAmplitude = (
    time,
    amplitude = oscillationAmplitude,
  ) => {
    periodForAmplitude(amplitude);
    const amplitudeArcCoordinate = totalCordLength
      * Math.sin(amplitude / 2);
    const cyclePhase = normalizedCyclePhase(time);
    const { cosine, sine } = trigonometryAtCyclePhase(cyclePhase);
    const arcCoordinate = amplitudeArcCoordinate
      * sine;
    const arcVelocity = amplitudeArcCoordinate
      * naturalAngularFrequency * cosine;
    const arcAcceleration = -amplitudeArcCoordinate
      * naturalAngularFrequency ** 2 * sine;
    return stateFromOscillator({
      arcAcceleration,
      arcCoordinate,
      arcVelocity,
      cyclePhase,
    });
  };

  const releasedFromRestStateAtTime = (
    time,
    amplitude = oscillationAmplitude,
  ) => {
    periodForAmplitude(amplitude);
    const amplitudeArcCoordinate = totalCordLength
      * Math.sin(amplitude / 2);
    const cyclePhase = normalizedCyclePhase(time);
    const { cosine, sine } = trigonometryAtCyclePhase(cyclePhase);
    const arcCoordinate = amplitudeArcCoordinate
      * cosine;
    const arcVelocity = -amplitudeArcCoordinate
      * naturalAngularFrequency * sine;
    const arcAcceleration = -amplitudeArcCoordinate
      * naturalAngularFrequency ** 2 * cosine;
    return stateFromOscillator({
      arcAcceleration,
      arcCoordinate,
      arcVelocity,
      cyclePhase,
    });
  };

  const stateAtTime = (time) => stateAtTimeForAmplitude(
    time,
    oscillationAmplitude,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.17,
    roughness: 0.64,
  });
  const cheekMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.59,
    side: THREE.DoubleSide,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.47,
  });
  const bobMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.53,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const makeCheekPlate = (side) => {
    const shape = new THREE.Shape();
    const samples = 256;
    for (let index = 0; index <= samples; index += 1) {
      const magnitude = maximumCheekParameter * index / samples;
      const theta = side * magnitude;
      const point = cheekPointAtParameter(theta, 0);
      point.x += side * (cordRadius + contactClearance) * Math.cos(theta / 2);
      point.y += (cordRadius + contactClearance) * Math.sin(magnitude / 2);
      if (index === 0) shape.moveTo(point.x, point.y);
      else shape.lineTo(point.x, point.y);
    }
    for (let index = samples; index >= 0; index -= 1) {
      const magnitude = maximumCheekParameter * index / samples;
      const theta = side * magnitude;
      const point = cheekPointAtParameter(theta, 0);
      point.x += side * (cordRadius + contactClearance) * Math.cos(theta / 2);
      point.y += (cordRadius + contactClearance) * Math.sin(magnitude / 2);
      shape.lineTo(
        point.x + side * cheekThickness * 0.10,
        point.y + cheekThickness,
      );
    }
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: false,
      bevelSegments: 2,
      bevelSize: 0.018,
      bevelThickness: 0.018,
      curveSegments: 1,
      depth: cheekDepth,
    });
    geometry.translate(0, 0, mechanismPlaneZ - cheekDepth / 2);
    const plate = new THREE.Mesh(geometry, cheekMaterial);
    plate.userData.fixed = true;
    plate.userData.role = side > 0
      ? 'fixed-right-cycloidal-cheek-contact-surface'
      : 'fixed-left-cycloidal-cheek-contact-surface';
    return plate;
  };
  const cheekPlates = [-1, 1].map((side) => {
    const cheek = makeCheekPlate(side);
    root.add(cheek);
    return cheek;
  });

  const cheekCurves = {
    left: new CycloidalCheekCurve({
      cycloidRadius,
      lowestBobY,
      maximumParameter: maximumCheekParameter,
      side: -1,
      z: mechanismPlaneZ,
      offset: cordRadius + contactClearance + 0.012,
    }),
    right: new CycloidalCheekCurve({
      cycloidRadius,
      lowestBobY,
      maximumParameter: maximumCheekParameter,
      side: 1,
      z: mechanismPlaneZ,
      offset: cordRadius + contactClearance + 0.012,
    }),
  };
  const cheekContactRails = Object.entries(cheekCurves).map(([
    side,
    curve,
  ]) => {
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 256, 0.012, 8, false),
      darkMaterial,
    );
    rail.userData.fixed = true;
    rail.userData.role =
      `${side}-cycloidal-cheek-exact-cord-contact-edge`;
    root.add(rail);
    return rail;
  });

  const topBeam = new THREE.Mesh(
    new THREE.BoxGeometry(3.16, 0.23, 0.48),
    frameMaterial,
  );
  topBeam.position.set(0, cuspY + 0.18, -0.03);
  topBeam.userData.fixed = true;
  topBeam.userData.role = 'fixed-upper-crossbar-over-cycloidal-cheeks';
  root.add(topBeam);
  const sidePosts = [-1, 1].map((side) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.94, 0.38),
      frameMaterial,
    );
    post.position.set(side * 1.15, cuspY - 0.39, -0.04);
    post.userData.fixed = true;
    post.userData.role = 'fixed-side-bracket-supporting-cycloidal-cheek';
    root.add(post);
    return post;
  });
  const suspensionBoss = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 0.43, 28),
    darkMaterial,
  );
  suspensionBoss.rotation.x = Math.PI / 2;
  suspensionBoss.position.set(0, cuspY, -0.06);
  suspensionBoss.userData.fixed = true;
  suspensionBoss.userData.role =
    'central-cusp-anchor-of-inextensible-pendulum-cord';
  root.add(suspensionBoss);
  const anchorPin = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 24), darkMaterial);
  anchorPin.rotation.x = Math.PI / 2;
  anchorPin.position.set(0, cuspY, 0.17);
  anchorPin.userData.role = 'cord-anchor-stud-to-rear-suspension-boss';
  root.add(anchorPin);

  const braceMembers = [];
  for (const side of [-1, 1]) {
    const triangle = [
      [
        new THREE.Vector3(side * 0.58, cuspY + 0.02, -0.22),
        new THREE.Vector3(side * 0.92, cuspY - 0.55, -0.22),
      ],
      [
        new THREE.Vector3(side * 0.92, cuspY - 0.55, -0.22),
        new THREE.Vector3(side * 1.10, cuspY - 0.02, -0.22),
      ],
      [
        new THREE.Vector3(side * 1.10, cuspY - 0.02, -0.22),
        new THREE.Vector3(side * 0.58, cuspY + 0.02, -0.22),
      ],
    ];
    for (const [start, end] of triangle) {
      const brace = beamBetween(
        start,
        end,
        0.065,
        0.10,
        frameMaterial,
      );
      brace.userData.fixed = true;
      brace.userData.role = 'triangular-cheek-support-brace';
      root.add(brace);
      braceMembers.push(brace);
    }
  }

  const bobPathCurve = new CycloidalBobPathCurve({
    amplitude: oscillationAmplitude,
    cycloidRadius,
    lowestBobY,
    z: 0.035,
  });
  const pathDashes = [];
  const pathIntervals = 48;
  for (let index = 0; index < pathIntervals; index += 2) {
    const start = bobPathCurve.getPoint(index / pathIntervals);
    const end = bobPathCurve.getPoint((index + 1) / pathIntervals);
    const dash = cylinderBetween(start, end, 0.012, darkMaterial, 8);
    dash.userData.fixed = true;
    dash.userData.role = 'dashed-reference-of-bob-cycloidal-path';
    root.add(dash);
    pathDashes.push(dash);
  }

  const cord = makeDynamicCable({
    color: PALETTE.ink,
    maxSegments: wrappedCableSegments + freeCableSegments,
    radius: cordRadius,
  });
  cord.userData.role =
    'massless-inextensible-cord-wrapping-on-one-cycloidal-cheek';
  root.add(cord);

  const contactBead = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 18, 12).translate(0, 0, 0.19),
    whiteMaterial,
  );
  contactBead.userData.role =
    'moving-tangency-point-between-cord-and-active-cheek';
  root.add(contactBead);

  const bob = new THREE.Group();
  bob.userData.role = 'cycloidal-path-pendulum-bob';
  const bobSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.205, 36, 24),
    bobMaterial,
  );
  bobSphere.userData.role = 'pendulum-bob-mass';
  bob.add(bobSphere);
  const bobIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.048, 16, 12),
    whiteMaterial,
  );
  bobIndex.position.set(0.08, 0.06, 0.185);
  bobIndex.userData.role = 'white-bob-position-index';
  bob.add(bobIndex);
  root.add(bob);
  // Brown draws neither a tangency dot nor a mark on the bob; both remain
  // allocated for the constraint checks but are not presented.
  contactBead.visible = false;
  bobIndex.visible = false;

  const cordPointsAtState = (state) => {
    const points = [];
    for (let index = 0; index <= wrappedCableSegments; index += 1) {
      points.push(cheekPointAtParameter(
        state.theta * index / wrappedCableSegments,
      ));
    }
    for (let index = 1; index <= freeCableSegments; index += 1) {
      points.push(state.contactPoint.clone().lerp(
        state.bobPoint,
        index / freeCableSegments,
      ));
    }
    return points;
  };

  const update = (time) => {
    const state = stateAtTime(time);
    bob.position.copy(state.bobPoint);
    contactBead.position.copy(state.contactPoint);
    cord.userData.setPoints(cordPointsAtState(state));
    const tangentCross = new THREE.Vector3().crossVectors(
      state.cheekTangent,
      state.freeCordDirection,
    );
    root.userData.currentState = state;
    root.userData.constraints = {
      cord: {
        freeLength: state.freeCordLength,
        lengthError: state.totalCordLength - totalCordLength,
        totalLength: state.totalCordLength,
        wrappedLength: state.wrappedCordLength,
      },
      cycloidalPath: {
        arcCoordinate: state.arcCoordinate,
        arcCoordinateFromParameter:
          signedArcCoordinateAtParameter(state.theta),
        potentialHeight: state.potentialHeight,
        potentialHeightFromArc:
          potentialHeightAtArcCoordinate(state.arcCoordinate),
      },
      isochronousDynamics: {
        energy: state.totalMechanicalEnergy,
        harmonicResidual: state.arcAcceleration
          + naturalAngularFrequency ** 2 * state.arcCoordinate,
      },
      tangency: {
        cheekTangent: state.cheekTangent.clone(),
        collinearityError: tangentCross.length(),
        freeCordDirection: state.freeCordDirection.clone(),
      },
    };
  };

  root.userData = {
    archetype:
      'huygens-cycloidal-cheeks-isochronous-cord-pendulum',
    blocks: {
      anchorPin,
      bob,
      bobIndex,
      bobSphere,
      braceMembers,
      cheekContactRails,
      cheekPlates,
      contactBead,
      cord,
      pathDashes,
      sidePosts,
      suspensionBoss,
      topBeam,
    },
    curves: {
      bobPath: bobPathCurve,
      cheekCurves,
    },
    degreesOfFreedom: {
      independentDynamicCoordinates: 1,
      coordinate:
        'signed arc distance of the bob along its inverted cycloid',
      note:
        'the inextensible cord and unilateral cheek contact determine tangency, wrap length, bob position, and active side from that one coordinate',
      storedEnergyStates: 2,
    },
    dynamics: {
      idealizations: [
        'massless inextensible flexible cord',
        'frictionless wrapping on rigid cycloidal cheeks',
        'point-mass bob represented by a visible sphere',
        'uniform gravitational field',
      ],
      sourceSpecifiesDimensionsMassGravityOrAmplitude: false,
      treatment:
        'Brown supplies the isochronous claim but no numerical scale; the model uses an ideal Huygens cycloidal pendulum and discloses its engineered radius, gravity, and demonstration amplitude',
    },
    fidelity: 'authored',
    geometry: {
      arcAmplitude,
      bobMass,
      cheekDepth,
      cheekThickness,
      cuspPoint: new THREE.Vector3(0, cuspY, mechanismPlaneZ),
      cuspY,
      cycloidRadius,
      cordRadius,
      contactClearance,
      gravity,
      isochronousPeriod,
      lowestBobY,
      maximumCheekParameter,
      mechanismPlaneZ,
      naturalAngularFrequency,
      oscillationAmplitude,
      totalCordLength,
    },
    kinematics: {
      bobPointAtParameter,
      cheekPointAtParameter,
      freeCordLengthAtParameter,
      parameterAtSignedArcCoordinate,
      potentialHeightAtArcCoordinate,
      signedArcCoordinateAtParameter,
      wrappedCordLengthAtParameter,
    },
    mechanism:
      'one-flexible-inextensible-cord-wraps-alternately-on-two-opposed-cycloidal-cheeks-and-constrains-the-pendulum-bob-to-an-inverted-cycloidal-path',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate369: {
        centralCusp: new THREE.Vector2(273, 145),
        centerBob: new THREE.Vector2(273, 499),
        imageHeight: 525,
        imageWidth: 525,
        leftCheekOuterEnd: new THREE.Vector2(5, 321),
        leftExtremeBob: new THREE.Vector2(34, 397),
        measurementUncertaintyPixels: 8,
        rightCheekOuterEnd: new THREE.Vector2(520, 316),
        rightExtremeBob: new THREE.Vector2(509, 384),
        topBeamLeft: new THREE.Vector2(164, 120),
        topBeamRight: new THREE.Vector2(404, 120),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the constraining surfaces are cycloidal',
          'the pendulum itself moves in a cycloidal curve',
          'the purpose is isochronous or equal-timed oscillation',
        ],
        engravingEvidence:
          'the plate shows two opposed curved cheeks meeting at the central suspension cusp, a flexible line vertical at center and tangent to either cheek at the side positions, and a dotted symmetric bob trajectory',
        reconstructionDisclosure:
          'cycloid radius, cheek extent, bob mass, gravity, amplitude, plate depth, and rendering dimensions are engineered because Brown supplies no numerical values and the official page has no canvas animation',
      },
      officialPage: 'https://507movements.com/mm_369.html',
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    tautochrone: {
      angularFrequency: naturalAngularFrequency,
      equation:
        'signed arc coordinate acceleration = -gravity/(4*cycloid radius) times signed arc coordinate',
      periodForAmplitude,
      releasedFromRestStateAtTime,
      stateAtTimeForAmplitude,
      timeFromRestAtEitherExtremeToBottom: isochronousPeriod / 4,
    },
    timeline: {
      demonstrationPeriod: isochronousPeriod,
      note:
        'the ideal conservative trajectory starts at the bottom moving right, reaches the right extreme at one quarter-period, crosses bottom at one half-period, reaches the left extreme at three quarters, and closes at one period',
    },
    transmission: {
      bobCycloidLaw:
        'bob = (a*(theta+sin(theta)), y0+a*(1-cos(theta)))',
      cheekEvoluteLaw:
        'active cheek contact = (a*(theta-sin(theta)), y0+a*(3+cos(theta)))',
      cordLaw:
        'wrapped length = 4a*(1-cos(abs(theta)/2)); free tangent length = 4a*cos(theta/2); their sum is exactly 4a',
      energyLaw:
        'height above bottom = signed arc distance squared/(8a), making gravitational potential exactly quadratic',
      isochronousLaw:
        'signed bob arc distance s=4a*sin(theta/2) obeys s_ddot + gravity/(4a)*s = 0, so period 4*pi*sqrt(a/gravity) is amplitude-independent',
    },
  };

  root.userData.minimumDisplayCycleSeconds = 6;
  root.userData.reconstructionNote = 'The physical cheek faces are offset from the ideal cycloidal cord centerline by the visible cord radius, with 0.0006 discretization clearance. The tangency annotation dot and bob mark are hidden, as Brown draws neither. The cord is massless and the bob is a point mass for the exact Huygens motion law.';
  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.52, -1.16, -0.38),
    new THREE.Vector3(2.52, 2.67, 0.48),
  );
  root.userData.groundFloorY = -1.15;
  fitPistonGuide(root, update, isochronousPeriod);
  root.userData.cameraFov = 8;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.4, 0.2, 14),
    root,
    update,
  };
}

export function createAuthoredCycloidalPendulumMovement(movement) {
  if (movement.id !== 369) return null;
  return cycloidalIsochronousPendulum(movement);
}
