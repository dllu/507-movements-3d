import * as THREE from 'three';
import {circle, plate, poly, polygonClipping, ring} from './finite-plate-geometry.js';
import {castFootGeometry} from './rotary-engine-cast-feet.js';
import {portedCasingGeometry, roundPortPipeGeometry, squarePortHole} from './round-port-pipes.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function wrappedAngle(angle) {
  return THREE.MathUtils.euclideanModulo(angle + Math.PI, FULL_TURN)
    - Math.PI;
}

function makeLiningGeometry(nodeCount) {
  const positions = new Float32Array(nodeCount * 4 * 3);
  const indices = [];
  for (let index = 0; index < nodeCount; index += 1) {
    const next = (index + 1) % nodeCount;
    const innerBack = index * 4;
    const outerBack = innerBack + 1;
    const innerFront = innerBack + 2;
    const outerFront = innerBack + 3;
    const nextInnerBack = next * 4;
    const nextOuterBack = nextInnerBack + 1;
    const nextInnerFront = nextInnerBack + 2;
    const nextOuterFront = nextInnerBack + 3;
    indices.push(
      innerFront, nextInnerFront, nextOuterFront,
      innerFront, nextOuterFront, outerFront,
      innerBack, outerBack, nextOuterBack,
      innerBack, nextOuterBack, nextInnerBack,
      innerBack, nextInnerBack, nextInnerFront,
      innerBack, nextInnerFront, innerFront,
      outerBack, outerFront, nextOuterFront,
      outerBack, nextOuterFront, nextOuterBack,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  geometry.setIndex(indices);
  return geometry;
}

function rubberLinedRotaryEngine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const rollerCount = 3;
  const armRadius = 2;
  const rollerRadius = 0.5;
  const rollerSpinRatio = armRadius / rollerRadius;
  const linerContactRadius = armRadius + rollerRadius;
  const linerRestRadius = 2.93;
  const linerIndentationDepth = linerRestRadius - linerContactRadius;
  const linerInfluenceHalfAngle = 0.78;
  const linerThickness = 0.105;
  const linerNodeCount = 720;
  const housingInnerRadius = 3.10;
  const housingOuterRadius = 3.48;
  const sourcePoseFirstRollerAngle = Math.PI;
  const materialAngles = Array.from(
    { length: linerNodeCount },
    (_, index) => FULL_TURN * index / linerNodeCount,
  );

  const carrierAngleAtInput = (inputAngle) => -inputAngle;
  const rollerCenterAngleAtInput = (rollerIndex, inputAngle) =>
    sourcePoseFirstRollerAngle
      + rollerIndex * FULL_TURN / rollerCount
      + carrierAngleAtInput(inputAngle);

  const linerIndentationWeight = (angleDifference) => {
    const distance = Math.abs(wrappedAngle(angleDifference));
    if (distance >= linerInfluenceHalfAngle) return 0;
    const cosine = Math.cos(
      Math.PI * distance / (2 * linerInfluenceHalfAngle),
    );
    return cosine ** 4;
  };

  const linerRadiusAtWorldAngle = (worldAngle, inputAngle) => {
    let indentationWeight = 0;
    for (let rollerIndex = 0; rollerIndex < rollerCount;
      rollerIndex += 1) {
      const rollerAngle = rollerCenterAngleAtInput(
        rollerIndex,
        inputAngle,
      );
      indentationWeight = Math.max(
        indentationWeight,
        linerIndentationWeight(worldAngle - rollerAngle),
      );
    }
    return linerRestRadius - linerIndentationDepth * indentationWeight;
  };

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const carrierAngle = carrierAngleAtInput(inputAngle);
    const carrierAngularSpeed = -inputSpeed;
    const carrierAngularAcceleration = -inputAcceleration;
    const rollerAngularSpeed = -carrierAngularSpeed * rollerSpinRatio;
    const rollerAngularAcceleration = -carrierAngularAcceleration
      * rollerSpinRatio;
    const rollerWorldAngle = rollerSpinRatio * inputAngle;
    const rollerLocalAngle = rollerWorldAngle - carrierAngle;
    const rollers = [];
    for (let rollerIndex = 0; rollerIndex < rollerCount;
      rollerIndex += 1) {
      const centerAngle = rollerCenterAngleAtInput(
        rollerIndex,
        inputAngle,
      );
      const radial = new THREE.Vector3(
        Math.cos(centerAngle),
        Math.sin(centerAngle),
        0,
      );
      const tangent = new THREE.Vector3(-radial.y, radial.x, 0);
      const center = radial.clone().multiplyScalar(armRadius);
      const centerVelocity = tangent.clone().multiplyScalar(
        armRadius * carrierAngularSpeed,
      );
      const centerAcceleration = tangent.clone().multiplyScalar(
        armRadius * carrierAngularAcceleration,
      ).addScaledVector(
        radial,
        -armRadius * carrierAngularSpeed ** 2,
      );
      const contactPoint = radial.clone().multiplyScalar(
        linerContactRadius,
      );
      const rollerSurfaceVelocityAtContact = tangent.clone()
        .multiplyScalar(rollerRadius * rollerAngularSpeed);
      const rollingContactVelocity = centerVelocity.clone().add(
        rollerSurfaceVelocityAtContact,
      );
      const linerRadiusAtContact = linerRadiusAtWorldAngle(
        centerAngle,
        inputAngle,
      );
      rollers.push({
        center,
        centerAcceleration,
        centerAngle,
        centerVelocity,
        contactPoint,
        index: rollerIndex,
        linerContactResidual:
          linerRadiusAtContact - linerContactRadius,
        linerRadiusAtContact,
        localSpinAngle: rollerLocalAngle,
        radial,
        rollerAngularAcceleration,
        rollerAngularSpeed,
        rollerSurfaceVelocityAtContact,
        rollingContactVelocity,
        rollingWithoutSlipResidual: rollingContactVelocity.length(),
        tangent,
        worldSpinAngle: rollerWorldAngle,
      });
    }
    const linerMaterialRadii = materialAngles.map((materialAngle) =>
      linerRadiusAtWorldAngle(materialAngle, inputAngle));
    return {
      carrierAngle,
      carrierAngularAcceleration,
      carrierAngularSpeed,
      inputAcceleration,
      inputAngle,
      inputSpeed,
      linerMaterialRadii,
      rollerAngularAcceleration,
      rollerAngularSpeed,
      rollerLocalAngle,
      rollers,
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
    armRadius,
    cycleDuration,
    housingInnerRadius,
    housingOuterRadius,
    inputAngularSpeed,
    linerContactRadius,
    linerIndentationDepth,
    linerInfluenceHalfAngle,
    linerNodeCount,
    linerRestRadius,
    linerThickness,
    materialAngles: [...materialAngles],
    rollerCount,
    rollerRadius,
    rollerSpinRatio,
    sourcePoseFirstRollerAngle,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.25,
    roughness: 0.54,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.34,
    roughness: 0.42,
  });
  const rotorMaterial = matte(PALETTE.driven, {
    metalness: 0.22,
    roughness: 0.46,
  });
  const rollerMaterial = matte(PALETTE.driver, {
    metalness: 0.20,
    roughness: 0.43,
  });
  const rubberMaterial = matte(0x263d38, {
    metalness: 0.02,
    roughness: 0.88,
    side: THREE.DoubleSide,
  });
  const witnessMaterial = matte(PALETTE.white, { roughness: 0.48 });
  const inletMaterial = matte(PALETTE.driver, {
    opacity: 0.25,
    roughness: 0.62,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const exhaustMaterial = matte(PALETTE.fluid, {
    opacity: 0.25,
    roughness: 0.62,
    side: THREE.DoubleSide,
    transparent: true,
  });

  const rearHousing = new THREE.Mesh(
    new THREE.RingGeometry(
      housingInnerRadius,
      housingOuterRadius,
      96,
    ),
    frameMaterial,
  );
  // Brown's casing is round but blends in concave fillets into the two port
  // necks; the bore stays the exact circle the liner E rests on.
  const portHalfHeight = 0.52;
  // The front lips lie in front of the port pipes, so they stay whole.
  const cutRing = (inner, outer, low, high) => plate(polygonClipping.difference(
    poly(circle([0,0],outer,1024)), poly(circle([0,0],inner,1024))), low, high);
  // Pass 56: each port is a round bored pipe; its bore opens through the wall
  // to the space outside E by a square hole in the wall's middle layer only.
  const portZ = 0.24, portBore = 0.24;
  rearHousing.geometry.dispose();rearHousing.geometry=portedCasingGeometry(polygonClipping.difference(
    poly(circle([0,0],housingOuterRadius,1024)),
    poly(circle([0,0],housingInnerRadius,1024))),-0.42,0.90,portZ,portBore,
    [squarePortHole([-1,0],housingInnerRadius-0.1,housingOuterRadius+0.1,portBore),
      squarePortHole([1,0],housingInnerRadius-0.1,housingOuterRadius+0.1,portBore)]);
  rearHousing.position.z = 0;
  rearHousing.userData.role =
    'fixed-rigid-cylinder-surrounding-flexible-lining';
  root.add(rearHousing);
  const innerHousingWall = new THREE.Mesh(
    new THREE.TorusGeometry(housingInnerRadius, 0.095, 10, 96),
    frameMaterial,
  );
  innerHousingWall.geometry.dispose();innerHousingWall.geometry=cutRing(housingInnerRadius,housingInnerRadius+0.095,0.90,0.94);
  innerHousingWall.position.z = 0;
  innerHousingWall.userData.role =
    'fixed-inner-wall-containing-steam-outside-liner-E';
  root.add(innerHousingWall);
  const outerHousingWall = new THREE.Mesh(
    new THREE.TorusGeometry(housingOuterRadius, 0.12, 10, 96),
    frameMaterial,
  );
  outerHousingWall.geometry.dispose();outerHousingWall.geometry=cutRing(housingOuterRadius-0.12,housingOuterRadius,0.90,0.94);
  outerHousingWall.position.z = 0;
  outerHousingWall.userData.role = 'fixed-outer-cylinder-wall';
  root.add(outerHousingWall);

  // Brown stands the casing on one cast foot with concave flanks, not a bed slab.
  const foundation = new THREE.Mesh(
    castFootGeometry({casingRadius: housingOuterRadius, padHalfWidth: 3.05, neckHalfWidth: 2.25, footY: -housingOuterRadius - 0.30}, -0.42, 0.90),
    frameMaterial,
  );
  foundation.userData.role = 'fixed-cast-foot-under-cylinder';
  root.add(foundation);
  for (const side of [-1, 1]) {
    // Each port is a round bored pipe run into the casing wall up to its bore.
    const port = new THREE.Mesh(
      roundPortPipeGeometry(new THREE.Vector3(side * housingInnerRadius, 0, portZ),
        new THREE.Vector3(side * 4.39, 0, portZ), portBore, portHalfHeight),
      frameMaterial,
    );
    port.userData.role = side < 0
      ? 'left-induction-port-to-space-outside-rubber-liner'
      : 'right-eduction-port-from-space-outside-rubber-liner';
    root.add(port);
    const passage = new THREE.Mesh(
      new THREE.BoxGeometry(1.47, 0.52, 0.58),
      side < 0 ? inletMaterial : exhaustMaterial,
    );
    passage.position.set(side * 3.70, 0, 0.35);
    passage.userData.role = side < 0
      ? 'induction-steam-path-indicator'
      : 'eduction-steam-path-indicator';
    root.add(passage);
  }

  const highPressureArc = new THREE.Mesh(
    new THREE.RingGeometry(2.66, 3.04, 72, 1, 0.20, 2.58),
    inletMaterial,
  );
  highPressureArc.position.z = 0.02;
  highPressureArc.userData.role =
    'illustrative-high-pressure-steam-outside-flexible-liner';
  const exhaustArc = new THREE.Mesh(
    new THREE.RingGeometry(2.66, 3.04, 48, 1, 4.92, 1.12),
    exhaustMaterial,
  );
  exhaustArc.position.z = 0.02;
  exhaustArc.userData.role =
    'illustrative-eduction-region-outside-flexible-liner';
  root.add(highPressureArc, exhaustArc);

  const rotor = new THREE.Group();
  rotor.userData.role =
    'three-arm-carrier-fast-on-main-shaft-B-turning-clockwise';
  root.add(rotor);
  const centralHub = cylinderAlongZ(0.48, 0.70, rotorMaterial, 40);
  centralHub.position.z = 0.28;
  centralHub.userData.role = 'central-carrier-hub-fast-on-shaft-B';
  rotor.add(centralHub);
  // Pass 57: B runs back through a bore in the back head (Brown's view only
  // removes the front head) into a blind bearing boss on its outer face.
  const shaftB = cylinderAlongZ(0.27, 1.639, darkMaterial, 36);
  shaftB.position.z = (1.10 - 0.539) / 2;
  shaftB.userData.role = 'main-shaft-B-in-fixed-cylinder-bearings';
  // The carrier hub and arms are fast on B, so B turns with them.
  rotor.add(shaftB);
  const backHead = new THREE.Mesh(plate(polygonClipping.difference(poly(circle([0,0],housingInnerRadius-0.0005,1024)),
    poly(circle([0,0],0.274,96))),-0.42,-0.30), frameMaterial);
  backHead.userData.role = 'fixed-back-head-closing-cylinder';
  const backBoss = new THREE.Mesh(plate(polygonClipping.difference(poly(circle([0,0],0.50,96)),poly(circle([0,0],0.274,96))),-0.54,-0.42), frameMaterial);
  backBoss.userData.role = 'fixed-back-bearing-boss-for-shaft-B';
  const backBossCap = new THREE.Mesh(plate(poly(circle([0,0],0.50,96)),-0.60,-0.54), frameMaterial);
  backBossCap.userData.role = 'fixed-back-bearing-boss-cap';
  for (const part of [backHead, backBoss, backBossCap]) {part.castShadow = true;part.receiveShadow = true;root.add(part);}

  const rollerParts = [];
  for (let rollerIndex = 0; rollerIndex < rollerCount;
    rollerIndex += 1) {
    const localAngle = sourcePoseFirstRollerAngle
      + rollerIndex * FULL_TURN / rollerCount;
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(armRadius, 0.22, 0.20),
      rotorMaterial,
    );
    arm.position.set(
      Math.cos(localAngle) * armRadius / 2,
      Math.sin(localAngle) * armRadius / 2,
      -0.10,
    );
    arm.rotation.z = localAngle;
    arm.userData.role = `radial-arm-${rollerIndex + 1}-from-B-to-A`;
    rotor.add(arm);

    const rollerGroup = new THREE.Group();
    rollerGroup.position.set(
      Math.cos(localAngle) * armRadius,
      Math.sin(localAngle) * armRadius,
      0,
    );
    rollerGroup.userData.role =
      `roller-A-${rollerIndex + 1}-counterspinning-on-radial-arm`;
    const roller = cylinderAlongZ(
      rollerRadius,
      0.80,
      rollerMaterial,
      44,
    );
    roller.geometry.dispose();roller.geometry=ring(0.164,rollerRadius,-0.40,0.40,256);
    roller.rotation.set(0,0,0);roller.position.z = 0.46;
    roller.userData.role = `working-roller-A-${rollerIndex + 1}`;
    rollerGroup.add(roller);
    // The axle stands in front of its arm's face.
    const rollerPin = cylinderAlongZ(0.16, 0.98, darkMaterial, 28);
    rollerPin.position.z = 0.50;
    rollerPin.userData.role = `roller-A-${rollerIndex + 1}-axle-pin`;
    rollerGroup.add(rollerPin);
    const spinMarker = new THREE.Mesh(
      new THREE.BoxGeometry(0.67, 0.09, 0.10),
      witnessMaterial,
    );
    spinMarker.position.set(0.18, 0, 0.91);
    spinMarker.userData.role =
      `visible-spin-marker-on-roller-A-${rollerIndex + 1}`;
    rollerGroup.add(spinMarker);
    rotor.add(rollerGroup);
    rollerParts.push({ arm, roller, rollerGroup, rollerPin, spinMarker });
  }

  const liningGeometry = makeLiningGeometry(linerNodeCount);
  const linerE = new THREE.Mesh(liningGeometry, rubberMaterial);
  linerE.userData.role =
    'flexible-india-rubber-cylinder-lining-E-with-fixed-material-angles';
  root.add(linerE);

  const materialWitnesses = [];
  const witnessStride = 60;
  for (let nodeIndex = 0; nodeIndex < linerNodeCount;
    nodeIndex += witnessStride) {
    const materialAngle = materialAngles[nodeIndex];
    const witness = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.045, 0.075),
      witnessMaterial,
    );
    witness.rotation.z = materialAngle + Math.PI / 2;
    witness.position.z = 0.80;
    witness.userData.role =
      `fixed-angular-material-witness-on-liner-E-${nodeIndex}`;
    root.add(witness);
    materialWitnesses.push({ materialAngle, nodeIndex, witness });
  }

  const writeLiningGeometry = (state) => {
    const positions = liningGeometry.getAttribute('position');
    const backZ = 0.12;
    const frontZ = 0.72;
    for (let nodeIndex = 0; nodeIndex < linerNodeCount;
      nodeIndex += 1) {
      const materialAngle = materialAngles[nodeIndex];
      const cosine = Math.cos(materialAngle);
      const sine = Math.sin(materialAngle);
      const innerRadius = state.linerMaterialRadii[nodeIndex];
      const outerRadius = innerRadius + linerThickness;
      const offset = nodeIndex * 4;
      positions.setXYZ(offset,
        cosine * innerRadius, sine * innerRadius, backZ);
      positions.setXYZ(offset + 1,
        cosine * outerRadius, sine * outerRadius, backZ);
      positions.setXYZ(offset + 2,
        cosine * innerRadius, sine * innerRadius, frontZ);
      positions.setXYZ(offset + 3,
        cosine * outerRadius, sine * outerRadius, frontZ);
    }
    positions.needsUpdate = true;
    liningGeometry.computeVertexNormals();
    liningGeometry.computeBoundingBox();
    liningGeometry.computeBoundingSphere();
    for (const { materialAngle, nodeIndex, witness } of materialWitnesses) {
      const witnessRadius = state.linerMaterialRadii[nodeIndex]
        + linerThickness + 0.025;
      witness.position.set(
        Math.cos(materialAngle) * witnessRadius,
        Math.sin(materialAngle) * witnessRadius,
        0.80,
      );
    }
  };

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.z = state.carrierAngle;
    for (let rollerIndex = 0; rollerIndex < rollerCount;
      rollerIndex += 1) {
      rollerParts[rollerIndex].rollerGroup.rotation.z =
        state.rollers[rollerIndex].localSpinAngle;
    }
    writeLiningGeometry(state);
  };

  const sourceState = stateAtInputAngle(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'three-arm-clockwise-rotor-with-counterspinning-rollers-deforming-fixed-material-rubber-liner',
    blocks: {
      centralHub,
      exhaustArc,
      foundation,
      highPressureArc,
      innerHousingWall,
      linerE,
      materialWitnesses: materialWitnesses.map(({ witness }) => witness),
      outerHousingWall,
      rearHousing,
      rollerArms: rollerParts.map(({ arm }) => arm),
      rollerGroups: rollerParts.map(({ rollerGroup }) => rollerGroup),
      rollerPins: rollerParts.map(({ rollerPin }) => rollerPin),
      rollersA: rollerParts.map(({ roller }) => roller),
      rotor,
      shaftB,
      spinMarkers: rollerParts.map(({ spinMarker }) => spinMarker),
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      linerMaterialNodeRadiiIndependent: false,
      operatingDegreesOfFreedom: 1,
      rollerSpinIndependent: false,
    },
    dynamics: {
      elasticConstitutiveLawMembraneTensionPressureFlowCutoffLeakageFrictionInertiaAndLoadsModeled:
        false,
      linerModel:
        'The stationary-material rubber lining is represented by fixed angular nodes with a smooth compact-support radial indentation at every roller. This is a kinematically constrained explanatory envelope, not a finite-element membrane or thermodynamic solution.',
      pressureArcs:
        'The translucent induction and eduction regions explain Brown’s arrows but do not assert unprovided valve timing or solve steam pressure.',
      rollingContact:
        'Each roller is assigned the exact no-slip angular speed for a stationary lining at its radial contact point.',
    },
    fidelity: 'authored',
    geometry,
    linerIndentationWeight,
    linerRadiusAtWorldAngle,
    mechanism:
      'Three rollers A replace rigid pistons and are carried clockwise on three arms fast to main shaft B. The fixed-material india-rubber cylinder lining E deforms radially inward only where each roller passes, remaining exactly tangent at the roller’s outer radial point. Every roller counterspins at arm-radius divided by roller-radius times the carrier speed, so its instantaneous surface velocity at E is zero. Brown describes steam outside E driving the rollers; this prescribed radial-contact illustration does not solve the asymmetric pressure and deformation needed to generate shaft torque.',
    motion: {
      carrierDirection: 'clockwise',
      carrierRevolutionsPerCycle: 1,
      cycleDuration,
      inputAngularSpeed,
      rollerAbsoluteDirection: 'counterclockwise',
      rollerAbsoluteRevolutionsPerCarrierRevolution: rollerSpinRatio,
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 428 page exposes only Brown’s static engraving and description; unlike neighboring animated pages, it contains no Canvas construction or source timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      carrierAngle: sourceState.carrierAngle,
      linerMaterialRadii: [...sourceState.linerMaterialRadii],
      rollerCenters: sourceState.rollers.map(({ center }) => center.clone()),
      rollerContactPoints: sourceState.rollers.map(
        ({ contactPoint }) => contactPoint.clone(),
      ),
    },
    sourceReference: {
      brownPlate428: {
        imageHeight: 525,
        imageWidth: 525,
        mainShaftBApproximateCenterPixels: [260, 282],
        measurementUncertaintyPixels: 14,
        rollerAApproximateCentersPixels: [
          [145, 259],
          [319, 148],
          [329, 369],
        ],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the cylinder has a flexible lining E of india-rubber',
          'rollers A replace pistons',
          'the rollers are attached to arms radiating from main shaft B',
          'steam acts between the india-rubber and the surrounding rigid cylinder',
          'steam presses the india-rubber against the rollers',
          'the rollers revolve around the cylinder and turn the shaft',
        ],
        engravingEvidence:
          'Brown’s cutaway visibly contains three circular rollers labeled A, three arms meeting shaft B, a continuously shaded flexible lining labeled E, a surrounding rigid casing, a left induction arrow, a right eduction arrow, and a clockwise rotor arrow.',
        reconstructionDisclosure:
          'Brown provides no absolute dimensions, exact arm lengths or angular spacing, roller radii, elastic material law, liner attachment detail, pressure, port timing, speed, friction, inertia, or loads. Equal 120-degree arms, a 4:1 ideal rolling ratio, the smooth fixed-material radial liner field, axial depths, supports, colors, and four-second demonstration cycle are independently engineered. The labeled topology, three visible rollers, clockwise direction, flexible-liner contact, and pressure side are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 428',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      fixedMaterialLiner:
        'each liner node keeps a constant world polar angle and changes radius smoothly',
      linerContactConstraint:
        'linerRadius(rollerCenterAngle)=armRadius+rollerRadius',
      rollerNoSlip:
        'rollerAngularSpeed=-(armRadius/rollerRadius)*carrierAngularSpeed',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.48, -3.96, -1.04),
    new THREE.Vector3(4.48, 3.66, 1.42),
  );
  root.userData.cameraDistanceScale = 1.03;
  root.userData.cameraDirection = new THREE.Vector3(5.2, 3.8, 11.9);
  root.userData.groundFloorY = -3.96;
  root.userData.hideGround=true;
  root.userData.solidReview={rollerBoreRadius:0.164,
    qualification:'Bored rollers with rear carrier arms; closed rigid casing and outward-wound, finer finite liner mesh. Liner deformation is prescribed; its radial contact supplies no independently validated steam-driven torque or elastic response.'};
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

export function createAuthoredRubberLinedRotaryEngineMovement(movement) {
  if (movement.id !== 428) return null;
  return rubberLinedRotaryEngine(movement);
}
