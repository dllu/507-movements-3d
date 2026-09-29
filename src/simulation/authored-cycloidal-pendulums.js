import * as THREE from 'three';
import {
  PALETTE,
  makeDynamicCable,
  markShadows,
  matte,
} from './primitives.js';

import { fitPistonGuide } from './piston-guide-parts.js';
import { plate, poly, polygonClipping } from './finite-plate-geometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
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
  // Brown draws each cheek as a thin double-lined band.
  const cheekThickness = 0.11;
  const cordRadius = 0.028;
  const contactClearance = 0.0006;
  const wrappedCableSegments = 48;
  const freeCableSegments = 18;
  const bobRadius = 0.205;

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

  // Pass 101: rougher, non-metallic paint, so the long cycloidal underside
  // no longer washes out to near-white by grazing (Fresnel) reflection.
  const cheekMaterial = matte(PALETTE.driver, {
    metalness: 0,
    roughness: 0.9,
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

  // Brown draws the crossbar, the two posts, the triangular bracing and the
  // two cycloidal cheeks with no line between them: one casting. It is one
  // flat extrusion in the cheeks' plane, bounded below by the exact cycloidal
  // contact curves (offset by the cord radius), with two triangular lightening
  // holes inside each bracket, placed from the plate.
  const contactOffset = cordRadius + contactClearance;
  const contactPoint = (magnitude) => {
    const point = cheekPointAtParameter(magnitude, 0);
    return [
      point.x + contactOffset * Math.cos(magnitude / 2),
      point.y + contactOffset * Math.sin(magnitude / 2),
    ];
  };
  const cheekSamples = 256;
  const contactCurve = Array.from({ length: cheekSamples + 1 },
    (_, index) => contactPoint(maximumCheekParameter * index / cheekSamples));
  // The cheek band: the contact curve and its back, a thin double-lined band.
  const cheekBand = [
    ...contactCurve,
    ...contactCurve.slice().reverse().map(([x, y]) => [
      x + cheekThickness * 0.10,
      y + cheekThickness,
    ]),
  ];
  // Brown's crossbar spans 240 of the cheeks' 515 px; its underside is at
  // the cusp, where the cord is tied: the cord's end bears on it.
  const barHalfSpan = 0.99;
  const barLow = cuspY;
  const barHigh = cuspY + 0.215;
  const postHalfSpan = 0.76;
  const postWidth = 0.14;
  const postOuterX = postHalfSpan + postWidth / 2;
  const postInnerX = postHalfSpan - postWidth / 2;
  // The bracket web fills the region between the crossbar, the post and the
  // contact curve.
  const webContact = contactCurve.filter(([x]) => x < postOuterX);
  const bracketWeb = [
    ...webContact,
    [postOuterX, webContact.at(-1)[1]],
    [postOuterX, barLow + 0.05],
    [webContact[0][0], barLow + 0.05],
  ];
  // Plate pixels (Brown's cusp at 273, 146; 0.00825 per px): hole A under
  // the crossbar, hole B against the post, the diagonal brace between them.
  const holes = [
    [[0.223, -0.012], [0.652, -0.012], [0.355, -0.314]],
    [[postInnerX, -0.18], [0.412, -0.47], [postInnerX, -0.742]],
  ];
  const mirror = (outline, side) => outline.map(([x, y]) => [side * x, y]);
  const sided = (outline, side) => (side > 0 ? mirror(outline, side) : mirror(outline, side).reverse());
  let castingOutline = polygonClipping.union(
    poly([[-barHalfSpan, barLow], [barHalfSpan, barLow], [barHalfSpan, barHigh], [-barHalfSpan, barHigh]]),
    ...[-1, 1].flatMap((side) => [poly(sided(bracketWeb, side)), poly(sided(cheekBand, side))]),
  );
  for (const side of [-1, 1]) {
    for (const hole of holes) {
      castingOutline = polygonClipping.difference(castingOutline,
        poly(sided(hole.map(([x, y]) => [x, cuspY + y]), side)));
    }
  }
  const castingFlat = plate(castingOutline, mechanismPlaneZ - cheekDepth / 2, mechanismPlaneZ + cheekDepth / 2);
  const castingGeometry = toCreasedNormals(castingFlat, Math.PI / 6);
  castingGeometry.userData.plate = castingFlat.userData.plate;
  castingFlat.dispose();
  const frameCasting = new THREE.Mesh(castingGeometry, cheekMaterial);
  frameCasting.userData.fixed = true;
  frameCasting.userData.role = 'fixed-one-piece-frame-with-bracing-and-cycloidal-cheek-contact-surfaces';
  frameCasting.userData.holes = holes;
  root.add(frameCasting);
  const cheekPlates = [frameCasting];

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
    // Brown's ink edge of the cheek only: kept as data, not drawn.
    rail.visible = false;
    rail.userData.retiredInkOutline = true;
    root.add(rail);
    return rail;
  });

  // The cord is tied at the cusp, inside the crossbar; Brown draws no boss
  // or stud there. Both are kept as hidden data only.
  const suspensionBoss = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 0.43, 28),
    darkMaterial,
  );
  suspensionBoss.rotation.x = Math.PI / 2;
  suspensionBoss.position.set(0, cuspY, -0.06);
  suspensionBoss.userData.fixed = true;
  suspensionBoss.userData.role =
    'central-cusp-anchor-of-inextensible-pendulum-cord';
  suspensionBoss.visible = false;
  root.add(suspensionBoss);
  const anchorPin = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 24), darkMaterial);
  anchorPin.rotation.x = Math.PI / 2;
  anchorPin.position.set(0, cuspY, mechanismPlaneZ - cordRadius - 0.036);
  anchorPin.userData.role = 'cord-anchor-stud-to-rear-suspension-boss';
  anchorPin.visible = false;
  root.add(anchorPin);

  const bobPathCurve = new CycloidalBobPathCurve({
    amplitude: oscillationAmplitude,
    cycloidRadius,
    lowestBobY,
    z: mechanismPlaneZ - bobRadius - 0.03,
  });
  // Brown's dotted bob path is notation; the curve is kept only as data.

  // Brown's cord is drawn as a cord: one continuous laid rope. It is tied
  // at the cusp, so its material does not run along the path (travel 0).
  const cord = makeDynamicCable({
    color: PALETTE.belt,
    laid: true,
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
    new THREE.SphereGeometry(bobRadius, 36, 24),
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
    }    for (let index = 1; index <= freeCableSegments; index += 1) {
      // The cord is tied at the bob's surface, not run into its centre.
      points.push(state.contactPoint.clone().lerp(
        state.bobPoint.clone().addScaledVector(
          state.freeCordDirection,
          -bobRadius,
        ),
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
      cheekContactRails,
      cheekPlates,
      frameCasting,
      contactBead,
      cord,
      suspensionBoss,
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
