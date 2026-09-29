import {correctVariableIdler, idlerCircularGeometry} from './variable-idler-gear-parts.js';
import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import {
  PALETTE,
  makeBeam,
  makeGear,
  makeShaft,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  const remainder = value % modulus;
  if (remainder === 0) return 0;
  return remainder < 0 ? remainder + modulus : remainder;
}

function unwrapNear(principalAngle, referenceAngle) {
  return principalAngle + FULL_TURN * Math.round(
    (referenceAngle - principalAngle) / FULL_TURN,
  );
}

function rotateVector2(vector, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * vector.x - sine * vector.y,
    sine * vector.x + cosine * vector.y,
  );
}

function quarterTurn(vector) {
  return new THREE.Vector2(-vector.y, vector.x);
}

function cross2(left, right) {
  return left.x * right.y - left.y * right.x;
}

function makeGaussLegendreRule(order) {
  const nodes = new Float64Array(order);
  const weights = new Float64Array(order);
  const half = Math.ceil(order / 2);
  for (let index = 0; index < half; index += 1) {
    let root = Math.cos(Math.PI * (index + 0.75) / (order + 0.5));
    let derivative = 0;
    for (let iteration = 0; iteration < 24; iteration += 1) {
      let previous = 1;
      let current = root;
      for (let degree = 2; degree <= order; degree += 1) {
        const next = (
          (2 * degree - 1) * root * current
          - (degree - 1) * previous
        ) / degree;
        previous = current;
        current = next;
      }
      derivative = order * (root * current - previous)
        / (root * root - 1);
      const correction = current / derivative;
      root -= correction;
      if (Math.abs(correction) < 2e-16) break;
    }
    const weight = 2 / ((1 - root * root) * derivative * derivative);
    nodes[index] = -root;
    nodes[order - 1 - index] = root;
    weights[index] = weight;
    weights[order - 1 - index] = weight;
  }
  return { nodes, weights };
}

const QUADRATURE = makeGaussLegendreRule(32);

function integrateGaussLegendre(integrand, start, end) {
  if (start === end) return 0;
  const midpoint = (start + end) / 2;
  const halfWidth = (end - start) / 2;
  let sum = 0;
  for (let index = 0; index < QUADRATURE.nodes.length; index += 1) {
    sum += QUADRATURE.weights[index] * integrand(
      midpoint + halfWidth * QUADRATURE.nodes[index],
    );
  }
  return halfWidth * sum;
}

function centeredExtrusion(shape, depth, bevel = true) {
  const bevelSize = bevel ? Math.min(0.018, depth * 0.055) : 0;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevel,
    bevelSegments: bevel ? 1 : 0,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 2,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function shapeFromPoints(points, boreRadius = 0) {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  });
  shape.closePath();
  if (boreRadius > 0) {
    const bore = new THREE.Path();
    bore.absarc(0, 0, boreRadius, 0, FULL_TURN, true);
    shape.holes.push(bore);
  }
  return shape;
}

function ringShape(outerPoints, innerPoints) {
  const shape = shapeFromPoints(outerPoints);
  const hole = new THREE.Path();
  [...innerPoints].reverse().forEach((point, index) => {
    if (index === 0) hole.moveTo(point.x, point.y);
    else hole.lineTo(point.x, point.y);
  });
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

function cylinderAlongZ(radius, depth, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function ellipticalDriverCompoundIdler(movement) {
  const root = new THREE.Group();

  // Pixel centers measured from Brown's 525 px plate. Keeping D at the
  // origin makes the drawing itself the dimensional construction: the A-B
  // distance fixes the common circular pitch, while the B-D location fixes
  // the ellipse aspect ratio and its exact parallel guide curve.
  const sourceScale = 0.02;
  const sourceRasterD = new THREE.Vector2(313.5, 268);
  const sourceRasterA = new THREE.Vector2(155, 144.5);
  const sourceRasterB = new THREE.Vector2(354, 181);
  const sourcePointToModel = (point, z = 0) => new THREE.Vector3(
    (point.x - sourceRasterD.x) * sourceScale,
    (sourceRasterD.y - point.y) * sourceScale,
    z,
  );
  const driverCenter = new THREE.Vector2(0, 0);
  const outputCenter3 = sourcePointToModel(sourceRasterA);
  const sourceCompoundCenter3 = sourcePointToModel(sourceRasterB);
  const outputCenter = new THREE.Vector2(outputCenter3.x, outputCenter3.y);
  const sourceCompoundCenter = new THREE.Vector2(
    sourceCompoundCenter3.x,
    sourceCompoundCenter3.y,
  );

  const ellipseTeeth = 30;
  const compoundPinionTeeth = 15;
  const outputTeeth = 32;
  const compoundOuterTeeth = 32;
  const sourceAspectRatio = 0.8366193519994889;
  const semiMajor = 103.06980918802205 * sourceScale;
  const semiMinor = semiMajor * sourceAspectRatio;
  const focalDistance = Math.sqrt(semiMajor ** 2 - semiMinor ** 2);
  const pitchSpeedAtParameter = (parameter) => Math.hypot(
    semiMinor * Math.sin(parameter),
    semiMajor * Math.cos(parameter),
  );
  const pitchPerimeter = integrateGaussLegendre(
    pitchSpeedAtParameter,
    0,
    FULL_TURN,
  );
  const circularPitch = pitchPerimeter / ellipseTeeth;
  const module = circularPitch / Math.PI;
  const compoundPinionPitchRadius = module * compoundPinionTeeth / 2;
  const outputPitchRadius = module * outputTeeth / 2;
  const compoundOuterPitchRadius = module * compoundOuterTeeth / 2;
  const carrierLength = outputPitchRadius + compoundOuterPitchRadius;
  const driverAngularSpeed = 0.5;
  const driverCyclePeriod = FULL_TURN / driverAngularSpeed;

  const profileAtParameter = (parameter) => {
    const cosine = Math.cos(parameter);
    const sine = Math.sin(parameter);
    const pitchSpeed = Math.hypot(
      semiMinor * sine,
      semiMajor * cosine,
    );
    const point = new THREE.Vector2(
      semiMinor * cosine,
      -focalDistance + semiMajor * sine,
    );
    const tangent = new THREE.Vector2(
      -semiMinor * sine / pitchSpeed,
      semiMajor * cosine / pitchSpeed,
    );
    const outwardNormal = new THREE.Vector2(
      semiMajor * cosine / pitchSpeed,
      semiMinor * sine / pitchSpeed,
    );
    const curvature = semiMajor * semiMinor / pitchSpeed ** 3;
    return {
      curvature,
      outwardNormal,
      parameter,
      pitchSpeed,
      point,
      tangent,
    };
  };
  const offsetAtParameter = (parameter, distance) => {
    const profile = profileAtParameter(parameter);
    const point = profile.point.clone().addScaledVector(
      profile.outwardNormal,
      distance,
    );
    const speed = profile.pitchSpeed * (1 + distance * profile.curvature);
    return {
      ...profile,
      offsetDerivative: profile.tangent.clone().multiplyScalar(speed),
      offsetPoint: point,
      offsetSpeed: speed,
    };
  };
  const pitchArcFromZero = (parameter) => {
    const turns = Math.floor(parameter / FULL_TURN);
    const remainder = parameter - turns * FULL_TURN;
    return turns * pitchPerimeter + integrateGaussLegendre(
      pitchSpeedAtParameter,
      0,
      remainder,
    );
  };
  const parameterAtPitchArc = (pitchArc) => {
    const turns = Math.floor(pitchArc / pitchPerimeter);
    const localArc = positiveModulo(pitchArc, pitchPerimeter);
    if (localArc < 2e-15) return turns * FULL_TURN;
    let lower = 0;
    let upper = FULL_TURN;
    for (let iteration = 0; iteration < 58; iteration += 1) {
      const middle = (lower + upper) / 2;
      if (pitchArcFromZero(middle) < localArc) lower = middle;
      else upper = middle;
    }
    return turns * FULL_TURN + (lower + upper) / 2;
  };
  const normalAngleAtParameter = (parameter) => {
    const normal = profileAtParameter(parameter).outwardNormal;
    return unwrapNear(Math.atan2(normal.y, normal.x), parameter);
  };
  const offsetArcFromZero = (parameter) => pitchArcFromZero(parameter)
    + compoundPinionPitchRadius * normalAngleAtParameter(parameter);

  const sourceConstraintAtParameter = (parameter) => {
    const offset = offsetAtParameter(
      parameter,
      compoundPinionPitchRadius,
    ).offsetPoint;
    return offset.distanceToSquared(outputCenter) - carrierLength ** 2;
  };
  let sourceParameterLower = 1.05;
  let sourceParameterUpper = 1.5;
  let sourceLowerConstraint = sourceConstraintAtParameter(
    sourceParameterLower,
  );
  for (let iteration = 0; iteration < 64; iteration += 1) {
    const middle = (sourceParameterLower + sourceParameterUpper) / 2;
    const middleConstraint = sourceConstraintAtParameter(middle);
    if (sourceLowerConstraint * middleConstraint <= 0) {
      sourceParameterUpper = middle;
    } else {
      sourceParameterLower = middle;
      sourceLowerConstraint = middleConstraint;
    }
  }
  const sourceContactParameter = (
    sourceParameterLower + sourceParameterUpper
  ) / 2;
  const sourceOffset = offsetAtParameter(
    sourceContactParameter,
    compoundPinionPitchRadius,
  );
  const sourceCalculatedCompoundCenter = sourceOffset.offsetPoint.clone();
  const sourceCarrierVector = sourceCalculatedCompoundCenter.clone().sub(
    outputCenter,
  );
  const sourceCarrierAngle = Math.atan2(
    sourceCarrierVector.y,
    sourceCarrierVector.x,
  );
  const outputCenterDistance = outputCenter.length();
  const outputCenterAngle = Math.atan2(outputCenter.y, outputCenter.x);
  const offsetPolarAngleAtParameter = (parameter) => {
    const point = offsetAtParameter(
      parameter,
      compoundPinionPitchRadius,
    ).offsetPoint;
    return unwrapNear(Math.atan2(point.y, point.x), parameter);
  };
  const rawDriverAngleAtContactParameter = (parameter) => {
    const offsetPoint = offsetAtParameter(
      parameter,
      compoundPinionPitchRadius,
    ).offsetPoint;
    const offsetRadius = offsetPoint.length();
    const intersectionCosine = THREE.MathUtils.clamp(
      (
        offsetRadius ** 2 + outputCenterDistance ** 2 - carrierLength ** 2
      ) / (2 * offsetRadius * outputCenterDistance),
      -1,
      1,
    );
    return outputCenterAngle - Math.acos(intersectionCosine)
      - offsetPolarAngleAtParameter(parameter);
  };
  const sourceRawDriverAngle = rawDriverAngleAtContactParameter(
    sourceContactParameter,
  );
  const driverTravelAtContactParameter = (parameter) => (
    rawDriverAngleAtContactParameter(parameter) - sourceRawDriverAngle
  );
  const contactParameterAtDriverTravel = (driverTravel) => {
    const turns = Math.floor(driverTravel / FULL_TURN);
    const localTravel = driverTravel - turns * FULL_TURN;
    let upper = sourceContactParameter - turns * FULL_TURN;
    if (localTravel < 2e-15) return upper;
    let lower = upper - FULL_TURN;
    const targetAngle = sourceRawDriverAngle + driverTravel;
    let parameter = THREE.MathUtils.clamp(
      upper - localTravel,
      lower,
      upper,
    );
    for (let iteration = 0; iteration < 14; iteration += 1) {
      const resolvedAngle = rawDriverAngleAtContactParameter(parameter);
      const angleError = resolvedAngle - targetAngle;
      if (Math.abs(angleError) < 4e-15) return parameter;
      if (angleError > 0) {
        lower = parameter;
      } else {
        upper = parameter;
      }
      const offset = offsetAtParameter(
        parameter,
        compoundPinionPitchRadius,
      );
      const compoundCenter = rotateVector2(
        offset.offsetPoint,
        resolvedAngle,
      );
      const carrierVector = compoundCenter.clone().sub(outputCenter);
      const rotatedDerivative = rotateVector2(
        offset.offsetDerivative,
        resolvedAngle,
      );
      const parameterPerDriverAngle = -carrierVector.dot(
        quarterTurn(compoundCenter),
      ) / carrierVector.dot(rotatedDerivative);
      const anglePerParameter = 1 / parameterPerDriverAngle;
      const newtonCandidate = parameter - angleError / anglePerParameter;
      parameter = Number.isFinite(newtonCandidate)
        && newtonCandidate > lower && newtonCandidate < upper
        ? newtonCandidate
        : (lower + upper) / 2;
    }
    return parameter;
  };

  const sourcePitchArc = pitchArcFromZero(sourceContactParameter);
  const sourceOffsetArc = offsetArcFromZero(sourceContactParameter);
  const outputAngularPitch = FULL_TURN / outputTeeth;
  const compoundPinionAngularPitch = FULL_TURN / compoundPinionTeeth;
  const sourceOutputAngle = sourceCarrierAngle - outputAngularPitch / 2;
  const sourceCompoundAngle = 0;
  const compoundOuterLocalPhase = sourceCarrierAngle + Math.PI;
  const sourceInwardContactAngle = Math.atan2(
    -sourceOffset.outwardNormal.y,
    -sourceOffset.outwardNormal.x,
  );
  const compoundPinionLocalPhase = sourceInwardContactAngle
    - compoundPinionAngularPitch / 2;

  const stateAtDriverTravel = (
    driverTravel,
    resolvedDriverAngularSpeed = driverAngularSpeed,
  ) => {
    const driverAngle = driverTravel;
    const contactParameter = contactParameterAtDriverTravel(driverTravel);
    const offset = offsetAtParameter(
      contactParameter,
      compoundPinionPitchRadius,
    );
    const contactPoint = rotateVector2(offset.point, driverAngle);
    const compoundCenter = rotateVector2(offset.offsetPoint, driverAngle);
    const contactNormal = rotateVector2(
      offset.outwardNormal,
      driverAngle,
    );
    const contactTangent = rotateVector2(offset.tangent, driverAngle);
    const carrierVector = compoundCenter.clone().sub(outputCenter);
    const carrierAngle = unwrapNear(
      Math.atan2(carrierVector.y, carrierVector.x),
      sourceCarrierAngle,
    );
    const carrierUnit = carrierVector.clone().divideScalar(carrierLength);
    const rotatedOffsetDerivative = rotateVector2(
      offset.offsetDerivative,
      driverAngle,
    );
    const partialDriverDerivative = quarterTurn(compoundCenter);
    const constraintDriverDerivative = 2 * carrierVector.dot(
      partialDriverDerivative,
    );
    const constraintParameterDerivative = 2 * carrierVector.dot(
      rotatedOffsetDerivative,
    );
    const contactParameterPerDriverAngle = -constraintDriverDerivative
      / constraintParameterDerivative;
    const compoundCenterPerDriverAngle = partialDriverDerivative.clone()
      .addScaledVector(
        rotatedOffsetDerivative,
        contactParameterPerDriverAngle,
      );
    const carrierPerDriverAngle = cross2(
      carrierVector,
      compoundCenterPerDriverAngle,
    ) / carrierLength ** 2;
    const compoundPerDriverAngle = 1
      + offset.offsetSpeed * contactParameterPerDriverAngle
        / compoundPinionPitchRadius;
    const compoundAngle = sourceCompoundAngle + driverTravel
      + (
        offsetArcFromZero(contactParameter) - sourceOffsetArc
      ) / compoundPinionPitchRadius;
    const outputPerDriverAngle = carrierLength / outputPitchRadius
      * carrierPerDriverAngle
      - compoundOuterPitchRadius / outputPitchRadius
        * compoundPerDriverAngle;
    const outputAngle = sourceOutputAngle
      + carrierLength / outputPitchRadius
        * (carrierAngle - sourceCarrierAngle)
      - compoundOuterPitchRadius / outputPitchRadius
        * (compoundAngle - sourceCompoundAngle);
    const driverAngularVelocity = resolvedDriverAngularSpeed;
    const contactParameterSpeed = contactParameterPerDriverAngle
      * resolvedDriverAngularSpeed;
    const compoundCenterVelocity = compoundCenterPerDriverAngle.clone()
      .multiplyScalar(resolvedDriverAngularSpeed);
    const carrierAngularSpeed = carrierPerDriverAngle
      * resolvedDriverAngularSpeed;
    const compoundAngularSpeed = compoundPerDriverAngle
      * resolvedDriverAngularSpeed;
    const outputAngularSpeed = outputPerDriverAngle
      * resolvedDriverAngularSpeed;

    const compoundContactReconstruction = compoundCenter.clone()
      .addScaledVector(contactNormal, -compoundPinionPitchRadius);
    const outerContactFromOutput = outputCenter.clone().addScaledVector(
      carrierUnit,
      outputPitchRadius,
    );
    const outerContactFromCompound = compoundCenter.clone().addScaledVector(
      carrierUnit,
      -compoundOuterPitchRadius,
    );
    const guideLocalPoint = rotateVector2(compoundCenter, -driverAngle);
    const driverSurfaceVelocity = quarterTurn(contactPoint)
      .multiplyScalar(resolvedDriverAngularSpeed);
    const compoundPinionSurfaceVelocity = compoundCenterVelocity.clone()
      .addScaledVector(
        quarterTurn(contactPoint.clone().sub(compoundCenter)),
        compoundAngularSpeed,
      );
    const outerContactPoint = outerContactFromOutput.clone().add(
      outerContactFromCompound,
    ).multiplyScalar(0.5);
    const outputSurfaceVelocity = quarterTurn(
      outerContactPoint.clone().sub(outputCenter),
    ).multiplyScalar(outputAngularSpeed);
    const compoundOuterSurfaceVelocity = compoundCenterVelocity.clone()
      .addScaledVector(
        quarterTurn(outerContactPoint.clone().sub(compoundCenter)),
        compoundAngularSpeed,
      );

    return {
      armLengthError: Math.abs(carrierVector.length() - carrierLength),
      carrierAngle,
      carrierAngularSpeed,
      carrierPerDriverAngle,
      carrierUnit,
      compoundAngle,
      compoundAngularSpeed,
      compoundCenter,
      compoundCenterPerDriverAngle,
      compoundCenterVelocity,
      compoundOuterSurfaceVelocity,
      compoundPerDriverAngle,
      compoundPinionSurfaceVelocity,
      contactNormal,
      contactParameter,
      contactParameterPerDriverAngle,
      contactParameterSpeed,
      contactPoint,
      contactTangent,
      driverAngle,
      driverAngularSpeed: driverAngularVelocity,
      driverSurfaceVelocity,
      driverTravel,
      guideConstraintError: guideLocalPoint.distanceTo(offset.offsetPoint),
      guideLocalPoint,
      guideOffsetPoint: offset.offsetPoint,
      outerCenterDistanceError: outerContactFromOutput.distanceTo(
        outerContactFromCompound,
      ),
      outerContactPoint,
      outerNoSlipError: outputSurfaceVelocity.distanceTo(
        compoundOuterSurfaceVelocity,
      ),
      outputAngle,
      outputAngularSpeed,
      outputPerDriverAngle,
      outputSurfaceVelocity,
      pinionCenterNormalError: compoundContactReconstruction.distanceTo(
        contactPoint,
      ),
      smallMeshNoSlipError: driverSurfaceVelocity.distanceTo(
        compoundPinionSurfaceVelocity,
      ),
    };
  };
  const stateAtTime = (time) => stateAtDriverTravel(
    time * driverAngularSpeed,
    driverAngularSpeed,
  );

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.62,
    side: THREE.DoubleSide,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.59,
    side: THREE.DoubleSide,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.49,
    side: THREE.DoubleSide,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.5 });

  // Put C and B's small pinion on the front mesh plane. The equal 32-tooth
  // A/B pair occupies the rear plane, so the concentric pinion remains
  // visible instead of being hidden behind B's larger wheel.
  const driverGearZ = 0.18;
  const driverGearDepth = 0.28;
  const circularGearZ = -0.18;
  const circularGearDepth = 0.28;
  // The grooved plate g-h lies behind C and behind the A/B wheel plane, as
  // Brown dashes it, open toward the front. B's spindle runs back through its
  // wheel into the groove. The plate hangs from C on a post at the ellipse
  // centre, which B's and A's wheels never sweep (shaft D, which B's wheel
  // does sweep, stays in front of C).
  const carrierZ = 0.42;
  const guideFloorZ = -0.56;
  const guideFloorDepth = 0.1;
  const guideRailZ = -0.44;
  const guideRailDepth = 0.12;
  const grooveHalfWidth = 0.145;
  const guideRollerRadius = 0.095;
  const guidePlateMargin = 0.05;
  const boreRadius = 0.15;
  const renderProfileSamples = 720;
  const profilePointsAtOffset = (distance) => Array.from(
    { length: renderProfileSamples },
    (_, index) => offsetAtParameter(
      index / renderProfileSamples * FULL_TURN,
      distance,
    ).offsetPoint,
  );

  const driverAssembly = new THREE.Group();
  const driverRotor = new THREE.Group();
  driverAssembly.add(driverRotor);
  driverAssembly.userData.axis = Z_AXIS.clone();
  driverAssembly.userData.rotor = driverRotor;
  driverAssembly.userData.role = 'focus-mounted-elliptical-driver-c';
  root.add(driverAssembly);

  const addendum = module * 0.95;
  const dedendum = module * 1.12;
  const driverRootPoints = Array.from(
    { length: renderProfileSamples },
    (_, index) => {
      const profile = profileAtParameter(
        index / renderProfileSamples * FULL_TURN,
      );
      return profile.point.clone().addScaledVector(
        profile.outwardNormal,
        -dedendum,
      );
    },
  );
  const driverBody = new THREE.Mesh(
    centeredExtrusion(
      shapeFromPoints(driverRootPoints, boreRadius),
      driverGearDepth,
    ),
    driverMaterial,
  );
  driverBody.position.z = driverGearZ;
  driverBody.userData.role = 'elliptical-driver-root-body';
  driverRotor.add(driverBody);

  const driverToothParameters = [];
  const driverToothPitchArcs = [];
  const driverTeeth = [];
  const toothRootHalfWidth = circularPitch * 0.29;
  const toothTipHalfWidth = circularPitch * 0.18;
  for (let toothIndex = 0; toothIndex < ellipseTeeth; toothIndex += 1) {
    const pitchArc = sourcePitchArc + toothIndex * circularPitch;
    const parameter = parameterAtPitchArc(pitchArc);
    const profile = profileAtParameter(parameter);
    const rootCenter = profile.point.clone().addScaledVector(
      profile.outwardNormal,
      -dedendum,
    );
    const tipCenter = profile.point.clone().addScaledVector(
      profile.outwardNormal,
      addendum,
    );
    const toothPoints = [
      rootCenter.clone().addScaledVector(profile.tangent, -toothRootHalfWidth),
      rootCenter.clone().addScaledVector(profile.tangent, toothRootHalfWidth),
      tipCenter.clone().addScaledVector(profile.tangent, toothTipHalfWidth),
      tipCenter.clone().addScaledVector(profile.tangent, -toothTipHalfWidth),
    ];
    const tooth = new THREE.Mesh(
      centeredExtrusion(
        shapeFromPoints(toothPoints),
        driverGearDepth * 0.92,
        false,
      ),
      driverMaterial,
    );
    tooth.position.z = driverGearZ;
    tooth.userData.pitchArc = pitchArc;
    tooth.userData.pitchPoint = profile.point.clone();
    tooth.userData.role = 'equal-pitch-elliptical-driver-tooth';
    tooth.userData.toothIndex = toothIndex;
    driverRotor.add(tooth);
    driverTeeth.push(tooth);
    driverToothParameters.push(parameter);
    driverToothPitchArcs.push(pitchArc);
  }

  const driverHub = cylinderAlongZ(
    0.22,
    driverGearDepth * 1.5,
    inkMaterial,
    36,
  );
  driverHub.position.z = driverGearZ;
  driverHub.userData.role = 'driver-shaft-hub-d';
  driverRotor.add(driverHub);
  const driverIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.055, 0.026),
    whiteMaterial,
  );
  driverIndex.position.set(0.48, 0, driverGearZ + driverGearDepth * 0.58);
  driverIndex.userData.role = 'elliptical-driver-face-index';
  driverRotor.add(driverIndex);

  const guideOuterDistance = compoundPinionPitchRadius
    + grooveHalfWidth + guidePlateMargin;
  const grooveOuterDistance = compoundPinionPitchRadius + grooveHalfWidth;
  const grooveInnerDistance = compoundPinionPitchRadius - grooveHalfWidth;
  const guideOuterPoints = profilePointsAtOffset(guideOuterDistance);
  const grooveOuterPoints = profilePointsAtOffset(grooveOuterDistance);
  const grooveInnerPoints = profilePointsAtOffset(grooveInnerDistance);
  // The groove g-h is cut into the front face of one solid elliptical plate
  // behind C (Brown dashes it as hidden work): a plain floor bounded by the
  // outer groove line, with two rails in front of it forming the channel. The
  // plate is carried by the post at the ellipse centre, which C hides; no
  // spokes or openings are shown between C and the groove. The island inside
  // the groove is the plate's solid face, flush with the outer rail.
  const guideMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  const guideFloor = new THREE.Mesh(
    centeredExtrusion(
      shapeFromPoints(guideOuterPoints),
      guideFloorDepth,
    ),
    guideMaterial,
  );
  guideFloor.position.z = guideFloorZ;
  guideFloor.userData.guideGrooveFloor = true;
  guideFloor.userData.role = 'attached-recessed-elliptical-guide-floor';
  driverRotor.add(guideFloor);
  const guideOuterRail = new THREE.Mesh(
    centeredExtrusion(
      ringShape(guideOuterPoints, grooveOuterPoints),
      guideRailDepth,
    ),
    guideMaterial,
  );
  guideOuterRail.position.z = guideRailZ;
  guideOuterRail.userData.role = 'outer-wall-of-elliptical-guide-g-h';
  driverRotor.add(guideOuterRail);
  const guideInnerIsland = new THREE.Mesh(
    centeredExtrusion(
      shapeFromPoints(grooveInnerPoints),
      guideRailDepth,
    ),
    guideMaterial,
  );
  guideInnerIsland.position.z = guideRailZ;
  guideInnerIsland.userData.role = 'inner-wall-of-elliptical-guide-g-h';
  driverRotor.add(guideInnerIsland);
  const guidePostCenter = new THREE.Vector2(0, -focalDistance);
  const guideSpokes = [];
  // One post from C's back face to the plate, spanning the A/B wheel plane.
  const guidePostBack = guideFloorZ;
  const guidePostFront = driverGearZ - driverGearDepth / 2 + 0.01;
  const guideSpokeHub = cylinderAlongZ(0.18, guidePostFront - guidePostBack, guideMaterial, 40);
  guideSpokeHub.position.set(guidePostCenter.x, guidePostCenter.y, (guidePostFront + guidePostBack) / 2);
  guideSpokeHub.userData.role = 'guide-g-h-post-from-c-at-ellipse-centre';
  driverRotor.add(guideSpokeHub);

  const outputGear = makeGear({
    color: PALETTE.driven,
    depth: circularGearDepth,
    radius: outputPitchRadius,
    teeth: outputTeeth,
    toothHeight: module * 2.05,
  });
  outputGear.position.set(outputCenter.x, outputCenter.y, circularGearZ);
  outputGear.userData.role = 'irregularly-driven-output-wheel-a';
  root.add(outputGear);

  const compound = new THREE.Group();
  const compoundRotor = new THREE.Group();
  compound.add(compoundRotor);
  compound.userData.axis = Z_AXIS.clone();
  compound.userData.rotor = compoundRotor;
  compound.userData.role = 'moving-center-compound-wheel-and-pinion-b';
  root.add(compound);
  const compoundOuterGear = makeGear({
    color: PALETTE.driven,
    depth: circularGearDepth,
    radius: compoundOuterPitchRadius,
    teeth: compoundOuterTeeth,
    toothHeight: module * 2.05,
  });
  compoundOuterGear.position.z = circularGearZ;
  setSpin(compoundOuterGear, compoundOuterLocalPhase);
  compoundOuterGear.userData.role = 'thirty-two-tooth-outer-wheel-b';
  compoundRotor.add(compoundOuterGear);
  // p104: ochre, so the pinion reads against wheel B directly behind it
  // (both were the same blue) and its mesh with C shows.
  const compoundPinion = makeGear({
    color: PALETTE.accent,
    depth: driverGearDepth,
    radius: compoundPinionPitchRadius,
    teeth: compoundPinionTeeth,
    toothHeight: module * 2.05,
  });
  compoundPinion.position.z = driverGearZ;
  setSpin(compoundPinion, compoundPinionLocalPhase);
  compoundPinion.userData.role = 'fifteen-tooth-concentric-pinion-b';
  compoundRotor.add(compoundPinion);

  const carrier = new THREE.Group();
  carrier.position.set(outputCenter.x, outputCenter.y, 0);
  carrier.userData.role = 'fixed-length-vibrating-arm-a-b';
  const carrierBeam = makeBeam(
    new THREE.Vector3(0, 0, carrierZ),
    new THREE.Vector3(carrierLength, 0, carrierZ),
    {
      color: PALETTE.ink,
      depth: 0.095,
      thickness: 0.105,
    },
  );
  carrierBeam.userData.role = 'source-straight-arm-between-a-and-b';
  carrier.add(carrierBeam);
  const carrierCollars = [0, carrierLength].map((x, index) => {
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.23, 0.055, 10, 40),
      inkMaterial,
    );
    collar.position.set(x, 0, carrierZ);
    collar.userData.role = index === 0
      ? 'carrier-pivot-collar-at-a'
      : 'carrier-bearing-collar-at-b';
    carrier.add(collar);
    return collar;
  });
  const compoundSpindle = cylinderAlongZ(0.105, 1.2, inkMaterial, 28);
  compoundSpindle.position.set(carrierLength, 0, -0.02);
  compoundSpindle.userData.role = 'carrier-fixed-compound-spindle';
  carrier.add(compoundSpindle);
  const guideRoller = cylinderAlongZ(
    guideRollerRadius,
    0.2,
    whiteMaterial,
    30,
  );
  guideRoller.position.set(carrierLength, 0, guideRailZ);
  guideRoller.userData.guideFollower = true;
  guideRoller.userData.role = 'roller-concentric-with-b-in-guide-g-h';
  carrier.add(guideRoller);
  const carrierCompoundAnchor = new THREE.Object3D();
  carrierCompoundAnchor.position.set(carrierLength, 0, 0);
  carrierCompoundAnchor.userData.role = 'carrier-end-center-b';
  carrier.add(carrierCompoundAnchor);
  root.add(carrier);

  const outputShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 1.55,
    radius: 0.105,
  });
  outputShaft.position.set(outputCenter.x, outputCenter.y, 0.08);
  outputShaft.userData.role = 'output-shaft-a';
  root.add(outputShaft);
  const driverShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 1.55,
    radius: 0.105,
  });
  driverShaft.position.set(0, 0, -0.12);
  driverShaft.userData.role = 'driver-shaft-d';
  root.add(driverShaft);

  const smallMeshMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 18, 12),
    whiteMaterial,
  );
  smallMeshMarker.position.z = driverGearZ + driverGearDepth * 0.56;
  smallMeshMarker.userData.role = 'elliptical-driver-to-pinion-pitch-contact';
  root.add(smallMeshMarker);
  const outerMeshMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 18, 12),
    whiteMaterial,
  );
  outerMeshMarker.position.z = circularGearZ + circularGearDepth * 0.56;
  outerMeshMarker.userData.role = 'compound-wheel-to-output-pitch-contact';
  root.add(outerMeshMarker);

  const sourceState = stateAtDriverTravel(0);
  const cycleState = stateAtDriverTravel(FULL_TURN);
  const ratioSamples = Array.from({ length: 513 }, (_, index) => (
    stateAtDriverTravel(index / 512 * FULL_TURN)
  ));
  const outputRatios = ratioSamples.map((state) => state.outputPerDriverAngle);
  const carrierAngles = ratioSamples.map((state) => state.carrierAngle);
  const canonicalTimes = Object.freeze({
    sourcePose: 0,
    quarterCycle: driverCyclePeriod / 4,
    halfCycle: driverCyclePeriod / 2,
    threeQuarterCycle: driverCyclePeriod * 3 / 4,
    cycleClosure: driverCyclePeriod,
  });

  root.userData.archetype =
    'focus-mounted-elliptical-driver-guided-moving-compound-idler-irregular-output';
  root.userData.blocks = {
    carrier,
    carrierBeam,
    carrierCollars,
    carrierCompoundAnchor,
    compound,
    compoundOuterGear,
    compoundPinion,
    compoundSpindle,
    driverAssembly,
    driverBody,
    driverHub,
    driverIndex,
    driverShaft,
    driverTeeth,
    guideFloor,
    guideInnerIsland,
    guideOuterRail,
    guideRoller,
    outerMeshMarker,
    outputGear,
    outputShaft,
    smallMeshMarker,
  };
  root.userData.cameraDistanceScale = 0.99;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.5, -4.62, -1.05),
    new THREE.Vector3(3.35, 4.75, 1.05),
  );
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contactParameterAtDriverTravel =
    contactParameterAtDriverTravel;
  root.userData.driverTravelAtContactParameter =
    driverTravelAtContactParameter;
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    addendum,
    boreRadius,
    carrierLength,
    circularGearDepth,
    circularGearZ,
    circularPitch,
    compoundOuterLocalPhase,
    compoundOuterPitchRadius,
    compoundOuterTeeth,
    compoundPinionLocalPhase,
    compoundPinionPitchRadius,
    compoundPinionTeeth,
    dedendum,
    driverCenter,
    driverGearDepth,
    driverGearZ,
    driverToothParameters,
    driverToothPitchArcs,
    ellipseTeeth,
    focalDistance,
    grooveHalfWidth,
    grooveInnerDistance,
    grooveOuterDistance,
    guideFloorDepth,
    guideFloorZ,
    guideOuterDistance,
    guidePlateMargin,
    guideRailDepth,
    guideRailZ,
    guideRollerRadius,
    module,
    outputCenter,
    outputPitchRadius,
    outputTeeth,
    pitchPerimeter,
    renderProfileSamples,
    semiMajor,
    semiMinor,
    sourceAspectRatio,
    sourceCalculatedCompoundCenter,
    sourceCarrierAngle,
    sourceCompoundCenter,
    sourceContactParameter,
    sourceOutputAngle,
    sourcePitchArc,
    sourceScale,
  };
  root.userData.mechanism =
    'elliptical-c-drives-guided-compound-b-which-drives-output-a';
  root.userData.normalAngleAtParameter = normalAngleAtParameter;
  root.userData.offsetArcFromZero = offsetArcFromZero;
  root.userData.offsetAtParameter = offsetAtParameter;
  root.userData.parameterAtPitchArc = parameterAtPitchArc;
  root.userData.pitchArcFromZero = pitchArcFromZero;
  root.userData.profileAtParameter = profileAtParameter;
  root.userData.sourceAnimation = {
    available: false,
    reason: 'The official Movement 221 page marks its animation unavailable.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate221: {
      imageHeight: 525,
      imageWidth: 525,
      inferredCompoundOuterTeeth: compoundOuterTeeth,
      inferredCompoundPinionTeeth: compoundPinionTeeth,
      inferredEllipseTeeth: ellipseTeeth,
      inferredOutputTeeth: outputTeeth,
      rasterCompoundCenterB: sourceRasterB,
      rasterDriverCenterD: sourceRasterD,
      rasterOutputCenterA: sourceRasterA,
      rasterPitchSemiMajor: semiMajor / sourceScale,
      rasterPitchSemiMinor: semiMinor / sourceScale,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.stateAtDriverTravel = stateAtDriverTravel;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    armMotion: 'vibrating',
    armSwingMaximum: Math.max(...carrierAngles),
    armSwingMinimum: Math.min(...carrierAngles),
    compoundTurnsPerDriverTurn: (
      cycleState.compoundAngle - sourceState.compoundAngle
    ) / FULL_TURN,
    driverAngularSpeed,
    driverCyclePeriod,
    maximumOutputToDriverSpeedRatio: Math.max(...outputRatios),
    minimumOutputToDriverSpeedRatio: Math.min(...outputRatios),
    outputTurnsPerDriverTurn: (
      cycleState.outputAngle - sourceState.outputAngle
    ) / FULL_TURN,
    toothCounts: {
      compoundOuter: compoundOuterTeeth,
      compoundPinion: compoundPinionTeeth,
      ellipse: ellipseTeeth,
      output: outputTeeth,
    },
    variableOutputSpeed: true,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(driverAssembly, state.driverAngle);
    setSpin(driverShaft, state.driverAngle);
    setSpin(outputGear, state.outputAngle);
    setSpin(outputShaft, state.outputAngle);
    compound.position.set(state.compoundCenter.x, state.compoundCenter.y, 0);
    setSpin(compound, state.compoundAngle);
    carrier.rotation.z = state.carrierAngle;
    smallMeshMarker.position.x = state.contactPoint.x;
    smallMeshMarker.position.y = state.contactPoint.y;
    outerMeshMarker.position.x = state.outerContactPoint.x;
    outerMeshMarker.position.y = state.outerContactPoint.y;
    driverAssembly.userData.angularSpeed = state.driverAngularSpeed;
    driverShaft.userData.angularSpeed = state.driverAngularSpeed;
    compound.userData.angularSpeed = state.compoundAngularSpeed;
    outputGear.userData.angularSpeed = state.outputAngularSpeed;
    outputShaft.userData.angularSpeed = state.outputAngularSpeed;
    carrier.userData.angularSpeed = state.carrierAngularSpeed;
    root.userData.contacts = {
      compoundOuterToOutput: {
        noSlipError: state.outerNoSlipError,
        point: state.outerContactPoint,
      },
      ellipseToCompoundPinion: {
        noSlipError: state.smallMeshNoSlipError,
        point: state.contactPoint,
      },
      guideRollerInGroove: {
        localPoint: state.guideLocalPoint,
        residual: state.guideConstraintError,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  correctVariableIdler(root, movement.id, update);
  markShadows(root);
  // Brown draws no phase stripes. He dashes the guide groove g-h because it
  // lies behind C; here the real channel lies behind C and the A/B wheels.
  driverIndex.visible = false;
  for (const gear of [outputGear, compoundOuterGear, compoundPinion]) {
    // The white face index is the last part makeGear adds to the rotor.
    gear.userData.rotor.children.at(-1).visible = false;
  }
  guideRoller.material = inkMaterial;
  root.userData.blocks.guideSpokes = guideSpokes;
  root.userData.blocks.guideSpokeHub = guideSpokeHub;
  // Re-seat the shafts for the rear guide plate: D runs forward from C only
  // (B's wheel sweeps D's axis behind C), B's spindle from the arm back
  // through its wheel to the roller, and A's from its wheel up to the arm.
  carrierBeam.userData.boredMesh.position.z = carrierZ;
  const setShaftSpan = (mesh, back, front) => {
    mesh.geometry.dispose();
    mesh.geometry = new THREE.CylinderGeometry(0.105, 0.105, front - back, 48);
    return (back + front) / 2;
  };
  driverShaft.position.z = setShaftSpan(
    driverShaft.userData.rotor.children[0],
    driverGearZ - driverGearDepth / 2 + 0.02,
    driverGearZ + driverGearDepth / 2 + 0.04,
  );
  // The hub starts just inside C's back face (no coplanar faces).
  driverHub.scale.y = (driverGearDepth + 0.02) / 1.08;
  driverHub.position.z = driverGearZ + 0.02;
  guideRoller.position.z = guideRailZ;
  compoundSpindle.position.z = setShaftSpan(
    compoundSpindle,
    guideRailZ - guideRailDepth / 2 + 0.01,
    carrierZ + 0.07,
  );
  outputShaft.position.z = setShaftSpan(
    outputShaft.userData.rotor.children[0],
    circularGearZ - circularGearDepth / 2 + 0.01,
    carrierZ + 0.065,
  );
  // Fit the whole cycle: B orbits well above its source pose mid-cycle.
  const sweptBounds = new THREE.Box3();
  for (let index = 0; index <= 96; index += 1) {
    update(driverCyclePeriod * index / 96);
    root.updateMatrixWorld(true);
    root.traverseVisible((object) => {
      if (object.isMesh || object.isLine) sweptBounds.union(new THREE.Box3().setFromObject(object, true));
    });
  }
  update(0);
  root.userData.cameraFitBounds = sweptBounds.expandByScalar(0.12);
  root.userData.cameraDistanceScale = 1;
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(1.5, -1.8, 12),
  };
}

function eccentricSpurDriverLinkedIdler(movement) {
  const root = new THREE.Group();

  // The plate supplies four unambiguous centers: fixed A, moving B, the
  // geometric center of C, and C's eccentric shaft D. A and C each have 24
  // teeth and B has 18, so both center links are the same common-pitch length.
  const sourceRasterA = new THREE.Vector2(162, 177);
  const sourceRasterB = new THREE.Vector2(326, 192);
  const sourceRasterC = new THREE.Vector2(346.5, 357.5);
  const sourceRasterD = new THREE.Vector2(310, 356);
  const sourceABPixels = sourceRasterA.distanceTo(sourceRasterB);
  const sourceBCPixels = sourceRasterB.distanceTo(sourceRasterC);
  const sourceMeanLinkPixels = (sourceABPixels + sourceBCPixels) / 2;
  const carrierLength = 3.15;
  const sourceScale = carrierLength / sourceMeanLinkPixels;
  const sourcePointToModel = (point, z = 0) => new THREE.Vector3(
    (point.x - sourceRasterD.x) * sourceScale,
    (sourceRasterD.y - point.y) * sourceScale,
    z,
  );
  const outputCenter3 = sourcePointToModel(sourceRasterA);
  const sourceIdlerCenter3 = sourcePointToModel(sourceRasterB);
  const eccentricCenterVector3 = sourcePointToModel(sourceRasterC);
  const outputCenter = new THREE.Vector2(outputCenter3.x, outputCenter3.y);
  const sourceRasterIdlerCenter = new THREE.Vector2(
    sourceIdlerCenter3.x,
    sourceIdlerCenter3.y,
  );
  const eccentricCenterVector = new THREE.Vector2(
    eccentricCenterVector3.x,
    eccentricCenterVector3.y,
  );
  const eccentricity = eccentricCenterVector.length();
  const fixedCenterDistance = outputCenter.length();

  const outputTeeth = 24;
  const idlerTeeth = 18;
  const driverTeeth = 24;
  const module = 2 * carrierLength / (outputTeeth + idlerTeeth);
  const outputPitchRadius = module * outputTeeth / 2;
  const idlerPitchRadius = module * idlerTeeth / 2;
  const driverPitchRadius = module * driverTeeth / 2;
  const outputAngularPitch = FULL_TURN / outputTeeth;
  const idlerAngularPitch = FULL_TURN / idlerTeeth;
  const driverToIdlerRatio = driverPitchRadius / idlerPitchRadius;
  const idlerToOutputRatio = idlerPitchRadius / outputPitchRadius;
  const driverAngularSpeed = 0.55;
  const driverCyclePeriod = FULL_TURN / driverAngularSpeed;
  const branchSign = 1;

  const fourBarGeometryAtDriverAngle = (driverAngle) => {
    const driverGeometricCenter = rotateVector2(
      eccentricCenterVector,
      driverAngle,
    );
    const driverCenterPerDriverAngle = quarterTurn(driverGeometricCenter);
    const fixedToDriver = driverGeometricCenter.clone().sub(outputCenter);
    const centerSeparation = fixedToDriver.length();
    const fixedToDriverUnit = fixedToDriver.clone().divideScalar(
      centerSeparation,
    );
    const intersectionNormal = quarterTurn(fixedToDriverUnit);
    const halfSeparation = centerSeparation / 2;
    const triangleHeight = Math.sqrt(
      carrierLength ** 2 - halfSeparation ** 2,
    );
    const midpoint = outputCenter.clone().add(driverGeometricCenter)
      .multiplyScalar(0.5);
    const idlerCenter = midpoint.addScaledVector(
      intersectionNormal,
      branchSign * triangleHeight,
    );

    const separationRate = fixedToDriverUnit.dot(
      driverCenterPerDriverAngle,
    );
    const fixedToDriverUnitRate = driverCenterPerDriverAngle.clone()
      .addScaledVector(fixedToDriverUnit, -separationRate)
      .divideScalar(centerSeparation);
    const intersectionNormalRate = quarterTurn(fixedToDriverUnitRate);
    const triangleHeightRate = -centerSeparation * separationRate
      / (4 * triangleHeight);
    const idlerCenterPerDriverAngle = driverCenterPerDriverAngle.clone()
      .multiplyScalar(0.5)
      .addScaledVector(
        intersectionNormal,
        branchSign * triangleHeightRate,
      )
      .addScaledVector(
        intersectionNormalRate,
        branchSign * triangleHeight,
      );
    const outputLink = idlerCenter.clone().sub(outputCenter);
    const driverLink = idlerCenter.clone().sub(driverGeometricCenter);
    const outputLinkAnglePrincipal = Math.atan2(
      outputLink.y,
      outputLink.x,
    );
    const driverLinkAnglePrincipal = Math.atan2(
      driverLink.y,
      driverLink.x,
    );
    const outputLinkPerDriverAngle = cross2(
      outputLink,
      idlerCenterPerDriverAngle,
    ) / carrierLength ** 2;
    const driverLinkRelativeVelocity = idlerCenterPerDriverAngle.clone().sub(
      driverCenterPerDriverAngle,
    );
    const driverLinkPerDriverAngle = cross2(
      driverLink,
      driverLinkRelativeVelocity,
    ) / carrierLength ** 2;
    return {
      centerSeparation,
      driverCenterPerDriverAngle,
      driverGeometricCenter,
      driverLink,
      driverLinkAnglePrincipal,
      driverLinkPerDriverAngle,
      fixedToDriverUnit,
      idlerCenter,
      idlerCenterPerDriverAngle,
      intersectionNormal,
      outputLink,
      outputLinkAnglePrincipal,
      outputLinkPerDriverAngle,
      triangleHeight,
    };
  };
  const sourceFourBar = fourBarGeometryAtDriverAngle(0);
  const sourceOutputLinkAngle = sourceFourBar.outputLinkAnglePrincipal;
  const sourceDriverLinkAngle = sourceFourBar.driverLinkAnglePrincipal;
  const sourceDirectionIdlerToDriver = sourceDriverLinkAngle + Math.PI;
  const sourceIdlerAngle = sourceDirectionIdlerToDriver
    - idlerAngularPitch / 2;
  const driverGearLocalPhase = sourceDriverLinkAngle;
  const sourceDirectionIdlerToOutput = sourceOutputLinkAngle + Math.PI;
  const sourceIdlerPhaseAtOutputContact = (
    sourceDirectionIdlerToOutput - sourceIdlerAngle
  ) / idlerAngularPitch;
  const sourceOutputPhaseAtContact = 0.5
    - sourceIdlerPhaseAtOutputContact;
  const sourceOutputAngle = sourceOutputLinkAngle
    - sourceOutputPhaseAtContact * outputAngularPitch;

  const stateAtDriverTravel = (
    driverTravel,
    resolvedDriverAngularSpeed = driverAngularSpeed,
  ) => {
    const driverAngle = driverTravel;
    const fourBar = fourBarGeometryAtDriverAngle(driverAngle);
    const outputLinkAngle = unwrapNear(
      fourBar.outputLinkAnglePrincipal,
      sourceOutputLinkAngle,
    );
    const driverLinkAngle = unwrapNear(
      fourBar.driverLinkAnglePrincipal,
      sourceDriverLinkAngle,
    );
    const idlerPerDriverAngle = (1 + driverToIdlerRatio)
      * fourBar.driverLinkPerDriverAngle - driverToIdlerRatio;
    const idlerAngle = sourceIdlerAngle
      + (1 + driverToIdlerRatio)
        * (driverLinkAngle - sourceDriverLinkAngle)
      - driverToIdlerRatio * driverTravel;
    const outputPerDriverAngle = (1 + idlerToOutputRatio)
      * fourBar.outputLinkPerDriverAngle
      - idlerToOutputRatio * idlerPerDriverAngle;
    const outputAngle = sourceOutputAngle
      + (1 + idlerToOutputRatio)
        * (outputLinkAngle - sourceOutputLinkAngle)
      - idlerToOutputRatio * (idlerAngle - sourceIdlerAngle);
    const outputUnit = fourBar.outputLink.clone().divideScalar(carrierLength);
    const driverUnit = fourBar.driverLink.clone().divideScalar(carrierLength);
    const driverToIdlerContactFromDriver = fourBar.driverGeometricCenter
      .clone().addScaledVector(driverUnit, driverPitchRadius);
    const driverToIdlerContactFromIdler = fourBar.idlerCenter.clone()
      .addScaledVector(driverUnit, -idlerPitchRadius);
    const idlerToOutputContactFromOutput = outputCenter.clone()
      .addScaledVector(outputUnit, outputPitchRadius);
    const idlerToOutputContactFromIdler = fourBar.idlerCenter.clone()
      .addScaledVector(outputUnit, -idlerPitchRadius);
    const driverContactPoint = driverToIdlerContactFromDriver.clone().add(
      driverToIdlerContactFromIdler,
    ).multiplyScalar(0.5);
    const outputContactPoint = idlerToOutputContactFromOutput.clone().add(
      idlerToOutputContactFromIdler,
    ).multiplyScalar(0.5);

    const driverAngularVelocity = resolvedDriverAngularSpeed;
    const driverCenterVelocity = fourBar.driverCenterPerDriverAngle.clone()
      .multiplyScalar(resolvedDriverAngularSpeed);
    const idlerCenterVelocity = fourBar.idlerCenterPerDriverAngle.clone()
      .multiplyScalar(resolvedDriverAngularSpeed);
    const driverLinkAngularSpeed = fourBar.driverLinkPerDriverAngle
      * resolvedDriverAngularSpeed;
    const outputLinkAngularSpeed = fourBar.outputLinkPerDriverAngle
      * resolvedDriverAngularSpeed;
    const idlerAngularSpeed = idlerPerDriverAngle
      * resolvedDriverAngularSpeed;
    const outputAngularSpeed = outputPerDriverAngle
      * resolvedDriverAngularSpeed;
    const driverSurfaceVelocity = quarterTurn(driverContactPoint)
      .multiplyScalar(resolvedDriverAngularSpeed);
    const idlerAtDriverSurfaceVelocity = idlerCenterVelocity.clone()
      .addScaledVector(
        quarterTurn(driverContactPoint.clone().sub(fourBar.idlerCenter)),
        idlerAngularSpeed,
      );
    const outputSurfaceVelocity = quarterTurn(
      outputContactPoint.clone().sub(outputCenter),
    ).multiplyScalar(outputAngularSpeed);
    const idlerAtOutputSurfaceVelocity = idlerCenterVelocity.clone()
      .addScaledVector(
        quarterTurn(outputContactPoint.clone().sub(fourBar.idlerCenter)),
        idlerAngularSpeed,
      );

    return {
      driverAngle,
      driverAngularSpeed: driverAngularVelocity,
      driverCenterVelocity,
      driverGeometricCenter: fourBar.driverGeometricCenter,
      driverLinkAngle,
      driverLinkAngularSpeed,
      driverLinkLengthError: Math.abs(
        fourBar.driverLink.length() - carrierLength
      ),
      driverLinkPerDriverAngle: fourBar.driverLinkPerDriverAngle,
      driverSurfaceVelocity,
      driverToIdlerCenterDistanceError:
        driverToIdlerContactFromDriver.distanceTo(
          driverToIdlerContactFromIdler,
        ),
      driverToIdlerContactPoint: driverContactPoint,
      driverToIdlerNoSlipError: driverSurfaceVelocity.distanceTo(
        idlerAtDriverSurfaceVelocity,
      ),
      driverTravel,
      fixedToDriverCenterDistance: fourBar.centerSeparation,
      idlerAngle,
      idlerAngularSpeed,
      idlerCenter: fourBar.idlerCenter,
      idlerCenterPerDriverAngle: fourBar.idlerCenterPerDriverAngle,
      idlerCenterVelocity,
      idlerPerDriverAngle,
      idlerToOutputCenterDistanceError:
        idlerToOutputContactFromOutput.distanceTo(
          idlerToOutputContactFromIdler,
        ),
      idlerToOutputContactPoint: outputContactPoint,
      idlerToOutputNoSlipError: outputSurfaceVelocity.distanceTo(
        idlerAtOutputSurfaceVelocity,
      ),
      outputAngle,
      outputAngularSpeed,
      outputLinkAngle,
      outputLinkAngularSpeed,
      outputLinkLengthError: Math.abs(
        fourBar.outputLink.length() - carrierLength
      ),
      outputLinkPerDriverAngle: fourBar.outputLinkPerDriverAngle,
      outputPerDriverAngle,
      outputSurfaceVelocity,
      triangleHeight: fourBar.triangleHeight,
    };
  };
  const stateAtTime = (time) => stateAtDriverTravel(
    time * driverAngularSpeed,
    driverAngularSpeed,
  );

  const gearZ = 0;
  const gearDepth = 0.3;
  // p104: both links drop 0.12. C-B clears C's link boss (0.203) by 0.012
  // and A-B runs 0.01 in front of it; A carries a boss up to its link.
  const outputLinkZ = 0.36;
  const driverLinkZ = 0.26;
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.61,
  });
  const idlerMaterial = matte(PALETTE.accent, {
    metalness: 0.14,
    roughness: 0.58,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.49,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.5 });

  const driverAssembly = new THREE.Group();
  const driverRotor = new THREE.Group();
  driverAssembly.add(driverRotor);
  driverAssembly.userData.axis = Z_AXIS.clone();
  driverAssembly.userData.rotor = driverRotor;
  driverAssembly.userData.role = 'eccentric-shaft-ordinary-spur-driver-c';
  root.add(driverAssembly);
  const driverGear = makeGear({
    color: PALETTE.driver,
    depth: gearDepth,
    radius: driverPitchRadius,
    teeth: driverTeeth,
    toothHeight: module * 2.05,
  });
  driverGear.position.set(
    eccentricCenterVector.x,
    eccentricCenterVector.y,
    gearZ,
  );
  setSpin(driverGear, driverGearLocalPhase);
  driverGear.userData.role = 'twenty-four-tooth-eccentric-driver-c';
  driverRotor.add(driverGear);
  const driverGeometricCenterAnchor = new THREE.Object3D();
  driverGeometricCenterAnchor.position.set(
    eccentricCenterVector.x,
    eccentricCenterVector.y,
    0,
  );
  driverGeometricCenterAnchor.userData.role = 'moving-geometric-center-of-c';
  driverRotor.add(driverGeometricCenterAnchor);
  const driverCenterJoint = cylinderAlongZ(
    0.13,
    0.36,
    inkMaterial,
    30,
  );
  driverCenterJoint.position.set(
    eccentricCenterVector.x,
    eccentricCenterVector.y,
    driverLinkZ,
  );
  driverCenterJoint.userData.role = 'link-pivot-at-geometric-center-of-c';
  driverRotor.add(driverCenterJoint);

  const outputGear = makeGear({
    color: PALETTE.driven,
    depth: gearDepth,
    radius: outputPitchRadius,
    teeth: outputTeeth,
    toothHeight: module * 2.05,
  });
  outputGear.position.set(outputCenter.x, outputCenter.y, gearZ);
  outputGear.userData.role = 'twenty-four-tooth-irregular-output-a';
  root.add(outputGear);
  const idlerGear = makeGear({
    color: PALETTE.accent,
    depth: gearDepth,
    radius: idlerPitchRadius,
    teeth: idlerTeeth,
    toothHeight: module * 2.05,
  });
  idlerGear.position.set(
    sourceFourBar.idlerCenter.x,
    sourceFourBar.idlerCenter.y,
    gearZ,
  );
  idlerGear.userData.role = 'single-eighteen-tooth-moving-idler-b';
  root.add(idlerGear);

  const outputLink = makeBeam(
    new THREE.Vector3(outputCenter.x, outputCenter.y, outputLinkZ),
    new THREE.Vector3(
      sourceFourBar.idlerCenter.x,
      sourceFourBar.idlerCenter.y,
      outputLinkZ,
    ),
    { color: PALETTE.ink, depth: 0.09, thickness: 0.1 },
  );
  outputLink.userData.role = 'simple-fixed-length-link-a-to-b';
  root.add(outputLink);
  const driverLink = makeBeam(
    new THREE.Vector3(
      sourceFourBar.driverGeometricCenter.x,
      sourceFourBar.driverGeometricCenter.y,
      driverLinkZ,
    ),
    new THREE.Vector3(
      sourceFourBar.idlerCenter.x,
      sourceFourBar.idlerCenter.y,
      driverLinkZ,
    ),
    // p93: same role as link a-b, so the same material (it was grey).
    { color: PALETTE.ink, depth: 0.09, thickness: 0.1 },
  );
  driverLink.userData.role = 'simple-fixed-length-link-c-center-to-b';
  root.add(driverLink);

  const outputLinkCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.05, 10, 38),
    inkMaterial,
  );
  outputLinkCollar.position.set(outputCenter.x, outputCenter.y, outputLinkZ);
  outputLinkCollar.userData.role = 'link-pivot-collar-at-a';
  root.add(outputLinkCollar);
  const idlerLinkCollars = [outputLinkZ, driverLinkZ].map((z, index) => {
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.05, 10, 38),
      index === 0 ? inkMaterial : idlerMaterial,
    );
    collar.position.set(
      sourceFourBar.idlerCenter.x,
      sourceFourBar.idlerCenter.y,
      z,
    );
    collar.userData.role = index === 0
      ? 'a-b-link-bearing-at-b'
      : 'c-b-link-bearing-at-b';
    root.add(collar);
    return collar;
  });

  const driverShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 1.45,
    radius: 0.105,
  });
  driverShaft.position.z = -0.05;
  driverShaft.userData.role = 'fixed-eccentric-driver-shaft-d';
  root.add(driverShaft);
  const driverShaftCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.052, 10, 38),
    whiteMaterial,
  );
  driverShaftCollar.position.z = gearDepth / 2 + 0.035;
  driverShaftCollar.userData.role = 'visible-off-center-shaft-d';
  driverRotor.add(driverShaftCollar);
  const outputShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 1.35,
    radius: 0.095,
  });
  outputShaft.position.set(outputCenter.x, outputCenter.y, -0.05);
  outputShaft.userData.role = 'output-shaft-a';
  root.add(outputShaft);
  const idlerShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 1.05,
    radius: 0.09,
  });
  idlerShaft.position.set(
    sourceFourBar.idlerCenter.x,
    sourceFourBar.idlerCenter.y,
    0.08,
  );
  idlerShaft.userData.role = 'moving-idler-shaft-b';
  root.add(idlerShaft);

  const driverContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.048, 18, 12),
    whiteMaterial,
  );
  driverContactMarker.position.z = gearDepth / 2 + 0.045;
  driverContactMarker.userData.role = 'c-to-b-pitch-contact';
  root.add(driverContactMarker);
  const outputContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.048, 18, 12),
    whiteMaterial,
  );
  outputContactMarker.position.z = gearDepth / 2 + 0.045;
  outputContactMarker.userData.role = 'b-to-a-pitch-contact';
  root.add(outputContactMarker);

  const sourceState = stateAtDriverTravel(0);
  const closureState = stateAtDriverTravel(FULL_TURN);
  const ratioSamples = Array.from({ length: 513 }, (_, index) => (
    stateAtDriverTravel(index / 512 * FULL_TURN)
  ));
  const outputRatios = ratioSamples.map((state) => state.outputPerDriverAngle);
  const idlerRatios = ratioSamples.map((state) => state.idlerPerDriverAngle);
  const triangleHeights = ratioSamples.map((state) => state.triangleHeight);
  const canonicalTimes = Object.freeze({
    sourcePose: 0,
    quarterCycle: driverCyclePeriod / 4,
    halfCycle: driverCyclePeriod / 2,
    threeQuarterCycle: driverCyclePeriod * 3 / 4,
    cycleClosure: driverCyclePeriod,
  });

  root.userData.archetype =
    'eccentric-spur-driver-two-equal-center-links-moving-idler-irregular-output';
  root.userData.blocks = {
    driverAssembly,
    driverCenterJoint,
    driverContactMarker,
    driverGear,
    driverGeometricCenterAnchor,
    driverLink,
    driverShaft,
    driverShaftCollar,
    idlerGear,
    idlerLinkCollars,
    idlerShaft,
    outputContactMarker,
    outputGear,
    outputLink,
    outputLinkCollar,
    outputShaft,
  };
  root.userData.cameraDistanceScale = 0.94;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.95, -2.85, -0.95),
    new THREE.Vector3(2.85, 5.55, 0.95),
  );
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.fidelity = 'authored';
  root.userData.fourBarGeometryAtDriverAngle =
    fourBarGeometryAtDriverAngle;
  root.userData.geometry = {
    branchSign,
    carrierLength,
    driverGearLocalPhase,
    driverLinkZ,
    driverPitchRadius,
    driverTeeth,
    eccentricCenterVector,
    eccentricity,
    fixedCenterDistance,
    fullRotationAssemblyMargin: 2 * carrierLength
      - (fixedCenterDistance + eccentricity),
    gearDepth,
    gearZ,
    idlerPitchRadius,
    idlerTeeth,
    module,
    outputCenter,
    outputLinkZ,
    outputPitchRadius,
    outputTeeth,
    sourceCalculatedIdlerCenter: sourceFourBar.idlerCenter,
    sourceDriverLinkAngle,
    sourceIdlerAngle,
    sourceOutputAngle,
    sourceOutputLinkAngle,
    sourceRasterIdlerCenter,
    sourceScale,
  };
  root.userData.mechanism =
    'eccentric-circular-c-drives-single-b-through-c-b-and-a-b-links';
  root.userData.sourceAnimation = {
    available: true,
    independentlyReconstructed: true,
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate222: {
      imageHeight: 525,
      imageWidth: 525,
      inferredDriverTeeth: driverTeeth,
      inferredIdlerTeeth: idlerTeeth,
      inferredOutputTeeth: outputTeeth,
      rasterDriverGeometricCenterC: sourceRasterC,
      rasterDriverShaftD: sourceRasterD,
      rasterIdlerCenterB: sourceRasterB,
      rasterOutputCenterA: sourceRasterA,
      sourceABPixels,
      sourceBCPixels,
      sourceMeanLinkPixels,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtDriverTravel = stateAtDriverTravel;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    driverAngularSpeed,
    driverCyclePeriod,
    driverToIdlerRatio,
    idlerToOutputRatio,
    idlerTurnsPerDriverTurn: (
      closureState.idlerAngle - sourceState.idlerAngle
    ) / FULL_TURN,
    maximumIdlerToDriverSpeedRatio: Math.max(...idlerRatios),
    maximumOutputToDriverSpeedRatio: Math.max(...outputRatios),
    minimumFourBarTriangleHeight: Math.min(...triangleHeights),
    minimumIdlerToDriverSpeedRatio: Math.min(...idlerRatios),
    minimumOutputToDriverSpeedRatio: Math.min(...outputRatios),
    outputTurnsPerDriverTurn: (
      closureState.outputAngle - sourceState.outputAngle
    ) / FULL_TURN,
    toothCounts: {
      driver: driverTeeth,
      idler: idlerTeeth,
      output: outputTeeth,
    },
    variableOutputSpeed: true,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(driverAssembly, state.driverAngle);
    setSpin(driverShaft, state.driverAngle);
    setSpin(idlerGear, state.idlerAngle);
    setSpin(idlerShaft, state.idlerAngle);
    setSpin(outputGear, state.outputAngle);
    setSpin(outputShaft, state.outputAngle);
    idlerGear.position.x = state.idlerCenter.x;
    idlerGear.position.y = state.idlerCenter.y;
    idlerShaft.position.x = state.idlerCenter.x;
    idlerShaft.position.y = state.idlerCenter.y;
    idlerLinkCollars.forEach((collar) => {
      collar.position.x = state.idlerCenter.x;
      collar.position.y = state.idlerCenter.y;
    });
    outputLink.userData.setEndpoints(
      new THREE.Vector3(outputCenter.x, outputCenter.y, outputLinkZ),
      new THREE.Vector3(
        state.idlerCenter.x,
        state.idlerCenter.y,
        outputLinkZ,
      ),
    );
    driverLink.userData.setEndpoints(
      new THREE.Vector3(
        state.driverGeometricCenter.x,
        state.driverGeometricCenter.y,
        driverLinkZ,
      ),
      new THREE.Vector3(
        state.idlerCenter.x,
        state.idlerCenter.y,
        driverLinkZ,
      ),
    );
    driverContactMarker.position.x = state.driverToIdlerContactPoint.x;
    driverContactMarker.position.y = state.driverToIdlerContactPoint.y;
    outputContactMarker.position.x = state.idlerToOutputContactPoint.x;
    outputContactMarker.position.y = state.idlerToOutputContactPoint.y;
    driverAssembly.userData.angularSpeed = state.driverAngularSpeed;
    driverGear.userData.angularSpeed = state.driverAngularSpeed;
    driverShaft.userData.angularSpeed = state.driverAngularSpeed;
    idlerGear.userData.angularSpeed = state.idlerAngularSpeed;
    idlerShaft.userData.angularSpeed = state.idlerAngularSpeed;
    outputGear.userData.angularSpeed = state.outputAngularSpeed;
    outputShaft.userData.angularSpeed = state.outputAngularSpeed;
    root.userData.contacts = {
      driverCToIdlerB: {
        noSlipError: state.driverToIdlerNoSlipError,
        point: state.driverToIdlerContactPoint,
      },
      idlerBToOutputA: {
        noSlipError: state.idlerToOutputNoSlipError,
        point: state.idlerToOutputContactPoint,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  correctVariableIdler(root, movement.id, update);
  // C's eccentric sweep (Brown's dashed circle) passes over A's teeth, so C
  // and A must run in different planes. A sits one gear depth behind C and
  // the idler B is a double-width wheel spanning both planes, as the plate's
  // overlapping outlines imply.
  const idlerBody = idlerGear.userData.rotor.children[0];
  idlerBody.geometry.dispose();
  idlerBody.geometry = idlerCircularGeometry(
    idlerPitchRadius,
    idlerTeeth,
    2 * gearDepth + 0.02,
    0.092,
  );
  idlerGear.position.z = gearZ - gearDepth / 2 - 0.01;
  outputGear.position.z = gearZ - gearDepth - 0.02;
  // p104: a boss in A's metal rises from A's hub (front -0.117) to 0.005
  // behind the A-B link's eye, so the link no longer stands 0.6 off A's face
  // on a bare shaft.
  {
    const rotor = outputGear.userData.rotor;
    const back = -0.12 - outputGear.position.z;
    const front = outputLinkZ - 0.045 - 0.005 - outputGear.position.z;
    const boss = new THREE.Mesh(
      boredLatheGeometry([{ radial: 0.3, axial: back }, { radial: 0.3, axial: front }], 0.097, 96),
      rotor.children[0].material,
    );
    boss.rotation.x = Math.PI / 2;
    boss.userData.role = 'output-a-boss-up-to-a-b-link';
    rotor.add(boss);
    root.userData.blocks.outputBoss = boss;
  }
  // Plate 222 draws no face index stripes or pitch markers, and D is a plain
  // dark stud in the face of C rather than a white ring.
  for (const gear of [driverGear, idlerGear, outputGear]) {
    gear.userData.rotor.children[3].visible = false;
  }
  driverContactMarker.visible = false;
  outputContactMarker.visible = false;
  driverShaftCollar.material = inkMaterial;
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(1.2, -1.4, 12),
  };
}

export function createAuthoredEllipticalIdlerGearMovement(movement) {
  if (movement.id === 221) return ellipticalDriverCompoundIdler(movement);
  if (movement.id === 222) return eccentricSpurDriverLinkedIdler(movement);
  return null;
}
