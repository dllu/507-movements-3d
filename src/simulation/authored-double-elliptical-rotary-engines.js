import * as THREE from 'three';
import {plate,poly,circle,polygonClipping} from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';
import {
  HOLLY_LEFT_PROFILE_PATHS,
  HOLLY_RIGHT_PROFILE_PATHS,
} from './movement-429-source-profiles.js';

const FULL_TURN = Math.PI * 2;

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function sampleSourcePath(path, arcSampleCount = 28) {
  if (path[0] === 0) {
    const points = [];
    for (let index = 1; index < path.length; index += 2) {
      points.push(new THREE.Vector2(path[index], path[index + 1]));
    }
    return points;
  }
  if (path[0] !== 2 && path[0] !== 4) {
    throw new Error(`Unsupported Holly profile path type ${path[0]}`);
  }
  let startAngle = path[4];
  let endAngle = path[5];
  if (path[0] === 4) {
    while (endAngle < startAngle) endAngle += FULL_TURN;
  } else {
    while (endAngle > startAngle) endAngle -= FULL_TURN;
  }
  const points = [];
  for (let sample = 0; sample <= arcSampleCount; sample += 1) {
    const angle = THREE.MathUtils.lerp(
      startAngle,
      endAngle,
      sample / arcSampleCount,
    );
    points.push(new THREE.Vector2(
      path[1] + path[3] * Math.cos(angle),
      path[2] + path[3] * Math.sin(angle),
    ));
  }
  return points;
}

function chainSourceProfile(paths) {
  const remaining = paths.slice(0, 8).map((path) =>
    sampleSourcePath(path));
  const points = remaining.shift();
  const connectionGaps = [];
  while (remaining.length > 0) {
    const endpoint = points.at(-1);
    let bestDistance = Infinity;
    let bestIndex = -1;
    let reverse = false;
    for (let index = 0; index < remaining.length; index += 1) {
      const startDistance = endpoint.distanceTo(remaining[index][0]);
      if (startDistance < bestDistance) {
        bestDistance = startDistance;
        bestIndex = index;
        reverse = false;
      }
      const endDistance = endpoint.distanceTo(remaining[index].at(-1));
      if (endDistance < bestDistance) {
        bestDistance = endDistance;
        bestIndex = index;
        reverse = true;
      }
    }
    const next = remaining.splice(bestIndex, 1)[0];
    if (reverse) next.reverse();
    connectionGaps.push(bestDistance);
    points.push(...next.slice(1));
  }
  connectionGaps.push(points.at(-1).distanceTo(points[0]));
  let signedAreaTwice = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const next = points[(index + 1) % points.length];
    signedAreaTwice += point.x * next.y - next.x * point.y;
  }
  if (signedAreaTwice < 0) points.reverse();
  return {
    connectionGaps,
    maximumConnectionGap: Math.max(...connectionGaps),
    points,
    signedArea: Math.abs(signedAreaTwice) / 2,
  };
}

function makeProfileGeometry(profile, scale, depth) {
  const shape = new THREE.Shape();
  const first = profile.points[0];
  shape.moveTo(first.x * scale, first.y * scale);
  for (const point of profile.points.slice(1)) {
    shape.lineTo(point.x * scale, point.y * scale);
  }
  shape.closePath();
  shape.holes.push(new THREE.Path(circle([0,0],0.364,128).map(p=>new THREE.Vector2(...p))));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    bevelSegments: 1,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    curveSegments: 1,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function capsulePoints(halfCenterDistance, radius, z, arcSamples = 56) {
  const points = [];
  for (let sample = 0; sample <= arcSamples; sample += 1) {
    const angle = -Math.PI / 2 + Math.PI * sample / arcSamples;
    points.push(new THREE.Vector3(
      halfCenterDistance + radius * Math.cos(angle),
      radius * Math.sin(angle),
      z,
    ));
  }
  for (let sample = 0; sample <= arcSamples; sample += 1) {
    const angle = Math.PI / 2 + Math.PI * sample / arcSamples;
    points.push(new THREE.Vector3(
      -halfCenterDistance + radius * Math.cos(angle),
      radius * Math.sin(angle),
      z,
    ));
  }
  return points;
}

function makeClosedTube(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    true,
    'centripetal',
  );
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(
      curve,
      points.length * 2,
      radius,
      9,
      true,
    ),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function makePackingStrips(paths, scale, material, prefix) {
  return paths.slice(8).map((path, index) => {
    const points = sampleSourcePath(path);
    const xs = points.map(({ x }) => x);
    const ys = points.map(({ y }) => y);
    const minimumX = Math.min(...xs);
    const maximumX = Math.max(...xs);
    const minimumY = Math.min(...ys);
    const maximumY = Math.max(...ys);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(
        Math.max(0.07, (maximumX - minimumX) * scale),
        Math.max(0.07, (maximumY - minimumY) * scale),
        0.030,
      ),
      material,
    );
    strip.position.set(
      (minimumX + maximumX) * scale / 2,
      (minimumY + maximumY) * scale / 2,
      0.625,
    );
    strip.userData.role = `${prefix}-radial-packing-strip-${index + 1}`;
    return strip;
  });
}

function doubleEllipticalRotaryEngine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const sourceScale = 0.36;
  const sourceCenterDistance = 8;
  const centerDistance = sourceCenterDistance * sourceScale;
  const halfCenterDistance = centerDistance / 2;
  const leftCenter = new THREE.Vector3(-halfCenterDistance, 0, 0);
  const rightCenter = new THREE.Vector3(halfCenterDistance, 0, 0);
  const sourceOuterHousingRadius = 6;
  const sourceInnerHousingRadius = 5.333333;
  const outerHousingRadius = sourceOuterHousingRadius * sourceScale;
  const innerHousingRadius = sourceInnerHousingRadius * sourceScale;
  const sourceShaftRadius = 1;
  const shaftRadius = sourceShaftRadius * sourceScale;
  const sourceProfilePhaseOffset = -Math.PI / 2;
  const leftProfile = chainSourceProfile(HOLLY_LEFT_PROFILE_PATHS);
  const rightProfile = chainSourceProfile(HOLLY_RIGHT_PROFILE_PATHS);

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const leftAngle = inputAngle;
    const rightAngle = -inputAngle;
    const leftAngularSpeed = inputSpeed;
    const rightAngularSpeed = -inputSpeed;
    const leftAngularAcceleration = inputAcceleration;
    const rightAngularAcceleration = -inputAcceleration;
    const leftMajorAxisAngle = Math.PI / 2 + leftAngle;
    const rightMajorAxisAngle = rightAngle;
    const leftReferenceRadial = new THREE.Vector3(
      Math.cos(leftMajorAxisAngle),
      Math.sin(leftMajorAxisAngle),
      0,
    );
    const rightReferenceRadial = new THREE.Vector3(
      Math.cos(rightMajorAxisAngle),
      Math.sin(rightMajorAxisAngle),
      0,
    );
    const leftReferenceRadius = 5.324122 * sourceScale;
    const rightReferenceRadius = 5.324122 * sourceScale;
    const leftReferencePoint = leftCenter.clone().addScaledVector(
      leftReferenceRadial,
      leftReferenceRadius,
    );
    const rightReferencePoint = rightCenter.clone().addScaledVector(
      rightReferenceRadial,
      rightReferenceRadius,
    );
    const leftReferenceTangent = new THREE.Vector3(
      -leftReferenceRadial.y,
      leftReferenceRadial.x,
      0,
    );
    const rightReferenceTangent = new THREE.Vector3(
      -rightReferenceRadial.y,
      rightReferenceRadial.x,
      0,
    );
    const leftReferenceVelocity = leftReferenceTangent.clone()
      .multiplyScalar(leftReferenceRadius * leftAngularSpeed);
    const rightReferenceVelocity = rightReferenceTangent.clone()
      .multiplyScalar(rightReferenceRadius * rightAngularSpeed);
    const leftReferenceAcceleration = leftReferenceTangent.clone()
      .multiplyScalar(leftReferenceRadius * leftAngularAcceleration)
      .addScaledVector(
        leftReferenceRadial,
        -leftReferenceRadius * leftAngularSpeed ** 2,
      );
    const rightReferenceAcceleration = rightReferenceTangent.clone()
      .multiplyScalar(rightReferenceRadius * rightAngularAcceleration)
      .addScaledVector(
        rightReferenceRadial,
        -rightReferenceRadius * rightAngularSpeed ** 2,
      );
    return {
      centerDistanceResidual: leftCenter.distanceTo(rightCenter)
        - centerDistance,
      conjugateAngularSpeedResidual:
        leftAngularSpeed + rightAngularSpeed,
      inputAcceleration,
      inputAngle,
      inputSpeed,
      leftAngle,
      leftAngularAcceleration,
      leftAngularSpeed,
      leftCenter: leftCenter.clone(),
      leftMajorAxisAngle,
      leftReferenceAcceleration,
      leftReferencePoint,
      leftReferenceVelocity,
      rightAngle,
      rightAngularAcceleration,
      rightAngularSpeed,
      rightCenter: rightCenter.clone(),
      rightMajorAxisAngle,
      rightReferenceAcceleration,
      rightReferencePoint,
      rightReferenceVelocity,
      sourceProfilePhaseConstraintResidual:
        leftMajorAxisAngle + rightMajorAxisAngle - Math.PI / 2,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return {
      ...stateAtInputAngle(inputAngularSpeed * cycleTime),
      cycleTime,
      phase: cycleTime / cycleDuration,
    };
  };

  const geometry = {
    centerDistance,
    cycleDuration,
    halfCenterDistance,
    innerHousingRadius,
    inputAngularSpeed,
    leftCenter: leftCenter.clone(),
    leftProfilePointCount: leftProfile.points.length,
    outerHousingRadius,
    rightCenter: rightCenter.clone(),
    rightProfilePointCount: rightProfile.points.length,
    shaftRadius,
    sourceCenterDistance,
    sourceInnerHousingRadius,
    sourceOuterHousingRadius,
    sourceProfilePhaseOffset,
    sourceScale,
    sourceShaftRadius,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.25,
    roughness: 0.54,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.34,
    roughness: 0.42,
  });
  const leftMaterial = matte(PALETTE.driver, {
    metalness: 0.20,
    roughness: 0.44,
  });
  const rightMaterial = matte(PALETTE.driven, {
    metalness: 0.22,
    roughness: 0.44,
  });
  const inletMaterial = matte(PALETTE.driver, {
    opacity: 0.22,
    roughness: 0.62,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const exhaustMaterial = matte(PALETTE.fluid, {
    opacity: 0.24,
    roughness: 0.62,
    side: THREE.DoubleSide,
    transparent: true,
  });

  const rearHousingShape = new THREE.Shape();
  const outerPoints = capsulePoints(
    halfCenterDistance,
    outerHousingRadius,
    0,
  );
  rearHousingShape.moveTo(outerPoints[0].x, outerPoints[0].y);
  for (const point of outerPoints.slice(1)) {
    rearHousingShape.lineTo(point.x, point.y);
  }
  rearHousingShape.closePath();
  const innerPoints = capsulePoints(
    halfCenterDistance,
    innerHousingRadius,
    0,
  ).reverse();
  const housingHole = new THREE.Path();
  housingHole.moveTo(innerPoints[0].x, innerPoints[0].y);
  for (const point of innerPoints.slice(1)) {
    housingHole.lineTo(point.x, point.y);
  }
  housingHole.closePath();
  rearHousingShape.holes.push(housingHole);
  const rearHousingGeometry = new THREE.ExtrudeGeometry(rearHousingShape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth: 0.32,
  });
  rearHousingGeometry.translate(0, 0, -0.66);
  const rearHousing = new THREE.Mesh(rearHousingGeometry, frameMaterial);
  const rectangle=(left,bottom,right,top)=>poly([[left,bottom],[right,bottom],[right,top],[left,top]]);
  const outerSection=polygonClipping.union(poly(circle([-halfCenterDistance,0],outerHousingRadius,1024)),
    poly(circle([halfCenterDistance,0],outerHousingRadius,1024)),rectangle(-0.525,-3.91,0.525,3.91));
  const cavitySection=polygonClipping.union(poly(circle([-halfCenterDistance,0],innerHousingRadius+0.00006,1024)),
    poly(circle([halfCenterDistance,0],innerHousingRadius+0.00006,1024)),rectangle(-0.26,-3.92,0.26,3.92));
  const housingSection=polygonClipping.difference(outerSection,cavitySection);
  rearHousing.geometry.dispose();rearHousing.geometry=plate(housingSection,-0.66,0.68);
  rearHousing.userData.role =
    'fixed-double-lobed-cylinder-around-both-elliptical-pistons';
  root.add(rearHousing);
  const innerHousingWall = makeClosedTube(
    capsulePoints(halfCenterDistance, innerHousingRadius, 0.00),
    0.095,
    frameMaterial,
    'fixed-inner-double-lobed-cylinder-wall',
  );
  const outerHousingWall = makeClosedTube(
    capsulePoints(halfCenterDistance, outerHousingRadius, -0.18),
    0.11,
    frameMaterial,
    'fixed-outer-double-lobed-cylinder-wall',
  );
  innerHousingWall.geometry.dispose();outerHousingWall.geometry.dispose();
  innerHousingWall.geometry=plate(housingSection,0.68,0.70);
  outerHousingWall.geometry=plate(housingSection,-0.68,-0.66);
  root.add(innerHousingWall, outerHousingWall);

  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(8.05, 0.29, 1.42),
    frameMaterial,
  );
  foundation.geometry.dispose();foundation.geometry=plate(polygonClipping.difference(rectangle(-4.025,-0.145,4.025,0.145),
    rectangle(-0.26,-0.15,0.26,0.15)),-0.71,0.71);
  foundation.position.set(0, -4.055, -0.18);
  foundation.userData.role = 'fixed-foundation-of-Holly-rotary-engine';
  root.add(foundation);
  for (const side of [-1, 1]) {
    const neck = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 1.62, 0.96),
      frameMaterial,
    );
    neck.geometry.dispose();neck.geometry=plate(polygonClipping.difference(rectangle(-0.525,-0.81,0.525,0.81),
      rectangle(-0.26,-0.82,0.26,0.82)),-0.48,0.48);
    neck.position.set(0, side * 3.10, -0.10);
    neck.userData.role = side > 0
      ? 'top-center-steam-induction-neck'
      : 'bottom-center-steam-eduction-neck';
    root.add(neck);
    const passage = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 1.74, 0.58),
      side > 0 ? inletMaterial : exhaustMaterial,
    );
    passage.position.set(0, side * 3.12, 0.36);
    passage.userData.role = side > 0
      ? 'downward-induction-steam-arrow-region'
      : 'downward-eduction-steam-arrow-region';
    root.add(passage);
  }

  const leftRotor = new THREE.Group();
  leftRotor.position.copy(leftCenter);
  leftRotor.userData.role =
    'left-Holly-conjugate-toothed-elliptical-piston';
  const leftPiston = new THREE.Mesh(
    makeProfileGeometry(leftProfile, sourceScale, 0.58),
    leftMaterial,
  );
  leftPiston.position.z = 0.32;
  leftPiston.userData.role =
    'left-exact-official-profile-elliptical-piston';
  leftRotor.add(leftPiston);
  const leftPackingStrips = makePackingStrips(
    HOLLY_LEFT_PROFILE_PATHS,
    sourceScale,
    darkMaterial,
    'left-piston',
  );
  leftRotor.add(...leftPackingStrips);
  root.add(leftRotor);

  const rightRotor = new THREE.Group();
  rightRotor.position.copy(rightCenter);
  rightRotor.userData.role =
    'right-Holly-conjugate-toothed-elliptical-piston';
  const rightPiston = new THREE.Mesh(
    makeProfileGeometry(rightProfile, sourceScale, 0.58),
    rightMaterial,
  );
  rightPiston.position.z = 0.32;
  rightPiston.userData.role =
    'right-exact-official-profile-elliptical-piston';
  rightRotor.add(rightPiston);
  const rightPackingStrips = makePackingStrips(
    HOLLY_RIGHT_PROFILE_PATHS,
    sourceScale,
    darkMaterial,
    'right-piston',
  );
  rightRotor.add(...rightPackingStrips);
  root.add(rightRotor);

  const leftShaft = cylinderAlongZ(shaftRadius, 1.22, darkMaterial, 36);
  leftShaft.position.copy(leftCenter);
  leftShaft.position.z = 0.57;
  leftShaft.userData.role = 'left-piston-shaft-in-fixed-bearing';
  const rightShaft = cylinderAlongZ(shaftRadius, 1.22, darkMaterial, 36);
  rightShaft.position.copy(rightCenter);
  rightShaft.position.z = 0.57;
  rightShaft.userData.role = 'right-piston-shaft-in-fixed-bearing';
  root.add(leftShaft, rightShaft);

  const update = (time) => {
    const state = stateAtTime(time);
    leftRotor.rotation.z = state.leftAngle;
    rightRotor.rotation.z = state.rightAngle;
  };

  const sourceState = stateAtInputAngle(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'holly-double-conjugate-toothed-elliptical-pistons-counterrotating-one-to-one-between-central-steam-ports',
    blocks: {
      foundation,
      innerHousingWall,
      leftPackingStrips,
      leftPiston,
      leftRotor,
      leftShaft,
      outerHousingWall,
      rearHousing,
      rightPackingStrips,
      rightPiston,
      rightRotor,
      rightShaft,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      leftAndRightRotationIndependent: false,
      operatingDegreesOfFreedom: 1,
    },
    dynamics: {
      pressureExpansionCutoffLeakageFrictionInertiaAndLoadsModeled: false,
      profileContactModel:
        'The two conjugate source profiles and their exact 1:-1 phase law are prescribed kinematically; compliant tooth contact forces and backlash are not solved.',
      steamPath:
        'Steam enters at the top center between the rotors and leaves at the bottom center as shown by Brown’s arrows; chamber thermodynamics are not solved.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Holly’s two distinct conjugate toothed elliptical piston profiles turn about fixed centers eight source units apart. The left piston turns counterclockwise while the right turns clockwise at exactly the same speed. Their official source profiles already contain the required quarter-turn major-axis offset, so left angle plus right angle remains zero and their teeth stay phased. Steam enters between them from the top and drives the rotors apart toward the enclosing double-lobed cylinder before exhausting below.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      leftDirection: 'counterclockwise',
      leftRevolutionsPerCycle: 1,
      rightDirection: 'clockwise',
      rightRevolutionsPerCycle: -1,
      speedRatioRightToLeft: -1,
    },
    sourceAnimation: {
      available: true,
      independentlyReconstructed: true,
      officialCanvasCyclePeriod: 4,
      officialCanvasCyclesPerMinute: 15,
      officialCanvasLeftRotationMultiplier: 1,
      officialCanvasModelPresent: true,
      officialCanvasRightRotationMultiplier: -1,
      reason:
        'The official Movement 429 Canvas model supplies two separate ten-path conjugate profiles, fixed pivots at (0,0) and (8,0), opposite unit rotation multipliers, and a 15-cycle-per-minute demonstration.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      leftAngle: sourceState.leftAngle,
      leftCenter: sourceState.leftCenter.clone(),
      leftMajorAxisAngle: sourceState.leftMajorAxisAngle,
      leftReferencePoint: sourceState.leftReferencePoint.clone(),
      rightAngle: sourceState.rightAngle,
      rightCenter: sourceState.rightCenter.clone(),
      rightMajorAxisAngle: sourceState.rightMajorAxisAngle,
      rightReferencePoint: sourceState.rightReferencePoint.clone(),
    },
    sourceProfiles: {
      leftConnectionGaps: [...leftProfile.connectionGaps],
      leftMaximumConnectionGap: leftProfile.maximumConnectionGap,
      leftPathCount: HOLLY_LEFT_PROFILE_PATHS.length,
      leftPoints: leftProfile.points.map(({ x, y }) => [x, y]),
      leftSignedArea: leftProfile.signedArea,
      rightConnectionGaps: [...rightProfile.connectionGaps],
      rightMaximumConnectionGap: rightProfile.maximumConnectionGap,
      rightPathCount: HOLLY_RIGHT_PROFILE_PATHS.length,
      rightPoints: rightProfile.points.map(({ x, y }) => [x, y]),
      rightSignedArea: rightProfile.signedArea,
    },
    sourceReference: {
      brownPlate429: {
        imageHeight: 525,
        imageWidth: 525,
        leftShaftApproximateCenterPixels: [177, 273],
        measurementUncertaintyPixels: 11,
        rightShaftApproximateCenterPixels: [348, 273],
        steamPortsApproximateCenterlinePixels: 263,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'this is Holly’s patent double-elliptical rotary engine',
          'there are two elliptical pistons',
          'the pistons are geared together',
          'steam enters between the pistons',
          'the pistons rotate in opposite directions',
          'the rotary engine can be converted into a pump',
        ],
        engravingEvidence:
          'Brown’s cutaway shows two intermeshing toothed noncircular pistons on fixed side-by-side shafts, a top-center induction arrow, a bottom-center eduction arrow, a clockwise arrow on the right piston, and packing strips at the housing contacts.',
        officialCanvasEvidence:
          'The official model fixes the piston pivots at source coordinates (0,0) and (8,0), defines distinct left and right conjugate profiles with ten paths apiece, rotates the left profile by +cyclePos and the right by -cyclePos, and encloses them with radius-5.333333 inner and radius-6 outer end arcs.',
        reconstructionDisclosure:
          'The planar piston profiles, centers, housing radii, opposite directions, 1:-1 speed ratio, source pose, and four-second website demonstration are directly reconstructed from the official Canvas model. Brown gives no absolute scale, axial depth, pressure, cutoff, leakage, friction, backlash, inertia, loads, or separate timing-gear detail; those unprovided physical properties are not asserted.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 429',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      centerConstraint: 'rightCenter-leftCenter=[8*sourceScale,0]',
      conjugateRotation: 'rightAngularSpeed=-leftAngularSpeed',
      sourcePhaseConstraint:
        'leftMajorAxisAngle+rightMajorAxisAngle=pi/2',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.08, -4.24, -1.04),
    new THREE.Vector3(4.08, 3.94, 1.42),
  );
  root.userData.cameraDistanceScale = 1.03;
  root.userData.cameraDirection = new THREE.Vector3(5.1, 3.6, 12.2);
  root.userData.groundFloorY = -3.94;
  root.userData.hideGround=true;
  root.userData.solidReview={housingRadialClearance:0.00006,
    qualification:'Unexpanded official mating profiles, bored shafts, closed double-circle working casing and open central port throats. The retained official polygonal mating outlines still have up to 0.0135 units sampled interference; conjugate-contact refinement remains open. Exact pressure, sealing, packing compression and load response are not modeled.'};
  root.traverse(object=>{for(const material of object.material?[].concat(object.material):[])material.fog=false;});
  markShadows(root);
  foundation.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredDoubleEllipticalRotaryEngineMovement(
  movement,
) {
  if (movement.id !== 429) return null;
  return doubleEllipticalRotaryEngine(movement);
}
