import * as THREE from 'three';
import {
  PALETTE,
  makeDynamicCable,
  markShadows,
  matte,
} from './primitives.js';

import {boreCurvedLink} from './spatial-linkage-parts.js';
import {LaidRopeGeometry} from './laid-rope.js';
import {makeHaulingHand} from './hauling-hand.js';
import {fitPistonGuide} from './piston-guide-parts.js';

const FULL_TURN = Math.PI * 2;

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function smootherstep(value) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  const parameter = THREE.MathUtils.clamp(value, 0, 1);
  return THREE.MathUtils.clamp(
    parameter ** 3 * (parameter * (parameter * 6 - 15) + 10),
    0,
    1,
  );
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function activationWindow(phase, riseStart, riseEnd, fallStart, fallEnd) {
  if (phase <= riseStart || phase >= fallEnd) return 0;
  if (phase < riseEnd) {
    return smootherstep((phase - riseStart) / (riseEnd - riseStart));
  }
  if (phase <= fallStart) return 1;
  return 1 - smootherstep((phase - fallStart) / (fallEnd - fallStart));
}

function rotateVector(vector, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * vector.x - sine * vector.y,
    sine * vector.x + cosine * vector.y,
  );
}

function centeredExtrusion(shape, depth, bevel = 0.025) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 3,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function tubeThrough(points, radius, material, role, segments = 42) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    false,
    'centripetal',
  );
  const tube = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(curve, segments, radius, 10, false),
    material,
  ), role);
  tube.userData.centerline = curve;
  return tube;
}

function cylinderAlongZ(radius, length, material, segments = 24) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function boatDetachingHooks(movement) {
  const root = new THREE.Group();

  // The source elevation is projected into each local XY plane. Two copies
  // are placed fore and aft along Z because Brown explicitly requires one at
  // each end of the boat.
  const unitCenterX = -0.95;
  const unitZPositions = [-1.42, 1.42];
  const leverPivot = new THREE.Vector2(0, 0.12);
  const tonguePivot = new THREE.Vector2(0, 1.39);
  const upperEyeVector = new THREE.Vector2(-0.53, 1.02);
  const lowerEyeVector = new THREE.Vector2(1.39, -1.02);
  const tongueStudLocal = upperEyeVector.clone()
    .add(leverPivot)
    .sub(tonguePivot);
  const tongueNoseLocal = new THREE.Vector2(-0.69, 0.31);
  const upperEyeInnerRadius = 0.235;
  const tongueStudRadius = 0.205;
  const leverReleaseAngle = THREE.MathUtils.degToRad(30);
  const tongueReleaseAngle = THREE.MathUtils.degToRad(-110);
  const eyeClearDistance = upperEyeInnerRadius + tongueStudRadius;
  const leverEyeClearAngle = 2 * Math.asin(
    eyeClearDistance / (2 * upperEyeVector.length()),
  );
  const tackleHookLift = 0.72;
  const cycleDuration = 10;
  const pullBarRestX = 3.38;
  const pullBarTravel = 0.62;
  const pullBarHeight = -0.52;
  const mechanismPlaneZ = 0.48;
  const latchPlaneZ = mechanismPlaneZ + .32;
  const tonguePlaneZ = 0.30;
  const tacklePlaneZ = tonguePlaneZ;

  const leverEyeCenterAtAngle = (angleRadian) => leverPivot.clone()
    .add(rotateVector(upperEyeVector, angleRadian));
  const leverRopeEyeCenterAtAngle = (angleRadian) => leverPivot.clone()
    .add(rotateVector(lowerEyeVector, angleRadian));
  const tongueStudCenterAtAngle = (angleRadian) => tonguePivot.clone()
    .add(rotateVector(tongueStudLocal, angleRadian));
  const tongueNoseCenterAtAngle = (angleRadian) => tonguePivot.clone()
    .add(rotateVector(tongueNoseLocal, angleRadian));
  const lockedStudCenter = tongueStudCenterAtAngle(0);
  const lockedTongueNoseCenter = tongueNoseCenterAtAngle(0);
  const tackleThroatAtLift = (lift) => new THREE.Vector2(
    lockedTongueNoseCenter.x,
    lockedTongueNoseCenter.y + lift,
  );

  const stateAtTime = (time) => {
    const cycleTime = positiveModulo(time, cycleDuration);
    const phase = cycleTime / cycleDuration;
    const leverProgress = activationWindow(
      phase,
      0.12,
      0.30,
      0.84,
      0.96,
    );
    const tongueProgress = activationWindow(
      phase,
      0.30,
      0.48,
      0.70,
      0.84,
    );
    const hookProgress = activationWindow(
      phase,
      0.46,
      0.58,
      0.62,
      0.70,
    );
    const leverAngleRadian = leverReleaseAngle * leverProgress;
    const tongueAngleRadian = tongueReleaseAngle * tongueProgress;
    const tackleLift = tackleHookLift * hookProgress;
    const upperEyeCenter = leverEyeCenterAtAngle(leverAngleRadian);
    const ropeEyeCenter = leverRopeEyeCenterAtAngle(leverAngleRadian);
    const tongueStudCenter = tongueStudCenterAtAngle(tongueAngleRadian);
    const tongueNoseCenter = tongueNoseCenterAtAngle(tongueAngleRadian);
    const tackleThroatCenter = tackleThroatAtLift(tackleLift);
    const lockedStudClearance = upperEyeCenter.distanceTo(
      lockedStudCenter,
    ) - eyeClearDistance;
    const currentStudClearance = upperEyeCenter.distanceTo(
      tongueStudCenter,
    ) - eyeClearDistance;
    const tongueToTackleSeparation = tongueNoseCenter.distanceTo(
      tackleThroatCenter,
    );
    return {
      cycleTime,
      currentStudClearance,
      hookProgress,
      leverAngleRadian,
      leverProgress,
      lockedStudClearance,
      phase,
      pullBarX: pullBarRestX + pullBarTravel * leverProgress,
      ropeEyeCenter,
      tackleLift,
      tackleThroatCenter,
      tongueAngleRadian,
      tongueNoseCenter,
      tongueProgress,
      tongueStudCenter,
      tongueToTackleSeparation,
      upperEyeCenter,
    };
  };

  const supportMaterial = matte(PALETTE.frame, {
    metalness: 0.25,
    roughness: 0.55,
  });
  const leverMaterial = matte(PALETTE.accent, {
    metalness: 0.30,
    roughness: 0.44,
  });
  const tongueMaterial = matte(PALETTE.driver, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const tackleMaterial = matte(PALETTE.driven, {
    metalness: 0.30,
    roughness: 0.42,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.36,
    roughness: 0.40,
  });
  const ropeMaterialColor = PALETTE.belt;
  const whiteMaterial = matte(PALETTE.white, {
    opacity: 0.98,
    roughness: 0.20,
    transparent: true,
  });
  whiteMaterial.depthWrite = false;

  const boatDeck = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(6.90, 0.22, 5.10),
    matte(PALETTE.muted, { roughness: 0.82 }),
  ), 'fixed-boat-deck-carrying-fore-and-aft-standards');
  boatDeck.position.set(0.18, -2.17, 0);
  root.add(boatDeck);
  const deckRails = [-1, 1].map((side, index) => {
    const rail = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(6.90, 0.28, 0.18),
      supportMaterial,
    ), `fixed-boat-side-rail-${index + 1}`);
    rail.position.set(0.18, -1.94, side * 2.47);
    root.add(rail);
    return rail;
  });

  const makeUnit = (unitIndex, unitZ) => {
    const unit = addRole(new THREE.Group(),
      `boat-detaching-apparatus-${unitIndex + 1}`);
    unit.position.set(unitCenterX, 0, unitZ);
    root.add(unit);

    const standard = addRole(new THREE.Group(),
      `fixed-upright-standard-${unitIndex + 1}`);
    unit.add(standard);
    const standardShape = new THREE.Shape();
    standardShape.moveTo(-0.19, -1.18);
    standardShape.lineTo(0.19, -1.18);
    standardShape.lineTo(0.28, -0.90);
    standardShape.lineTo(0.39, -0.69);
    standardShape.lineTo(0.24, -0.22);
    standardShape.lineTo(0.24, 0.48);
    standardShape.lineTo(0.34, 1.18);
    standardShape.quadraticCurveTo(0.34, 1.43, 0.16, 1.50);
    standardShape.lineTo(-0.16, 1.50);
    standardShape.quadraticCurveTo(-0.34, 1.43, -0.34, 1.18);
    standardShape.lineTo(-0.24, 0.48);
    standardShape.lineTo(-0.24, -0.22);
    standardShape.lineTo(-0.39, -0.69);
    standardShape.lineTo(-0.28, -0.90);
    standardShape.closePath();
    const standardPlate = addRole(new THREE.Mesh(
      centeredExtrusion(standardShape, 0.32),
      supportMaterial,
    ), `boat-fixed-standard-plate-${unitIndex + 1}`);
    standard.add(standardPlate);
    const standardCollar = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.25, 32),
      supportMaterial,
    ), `standard-deck-collar-${unitIndex + 1}`);
    standardCollar.position.y = -1.25;
    standard.add(standardCollar);
    const standardStem = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.74, 24),
      darkMaterial,
    ), `threaded-standard-shank-${unitIndex + 1}`);
    standardStem.position.y = -1.62;
    standard.add(standardStem);
    const standardThreads = Array.from({ length: 5 }, (_, index) => {
      const thread = addRole(new THREE.Mesh(
        new THREE.TorusGeometry(0.145, 0.025, 7, 28),
        darkMaterial,
      ), `standard-thread-${unitIndex + 1}-${index + 1}`);
      thread.rotation.x = Math.PI / 2;
      thread.position.y = -1.82 - index * 0.07;
      standard.add(thread);
      return thread;
    });

    const tongue = addRole(new THREE.Group(),
      `hinged-load-tongue-${unitIndex + 1}`);
    tongue.position.set(tonguePivot.x, tonguePivot.y, 0);
    unit.add(tongue);
    const tongueBody = tubeThrough([
      new THREE.Vector3(0, 0, tonguePlaneZ),
      new THREE.Vector3(-0.25, -0.17, tonguePlaneZ),
      new THREE.Vector3(
        tongueStudLocal.x,
        tongueStudLocal.y,
        tonguePlaneZ,
      ),
      new THREE.Vector3(-0.63, 0.08, tonguePlaneZ),
      new THREE.Vector3(
        tongueNoseLocal.x,
        tongueNoseLocal.y,
        tonguePlaneZ,
      ),
    ], 0.13, tongueMaterial,
    `curved-tongue-body-${unitIndex + 1}`, 48);
    boreCurvedLink(tongueBody, .13, .18, [{x: 0, y: 0, radius: .134}]);
    tongue.add(tongueBody);
    const lockingStud = addRole(cylinderAlongZ(
      tongueStudRadius,
      0.62,
      darkMaterial,
      22,
    ), `tongue-locking-stud-through-lever-eye-${unitIndex + 1}`);
    lockingStud.geometry.dispose();
    lockingStud.geometry = new THREE.LatheGeometry([
      new THREE.Vector2(0, -.31), new THREE.Vector2(tongueStudRadius, -.31),
      new THREE.Vector2(tongueStudRadius, 0), new THREE.Vector2(.075, .31),
      new THREE.Vector2(0, .31),
    ], 64);
    lockingStud.position.set(
      tongueStudLocal.x,
      tongueStudLocal.y,
      latchPlaneZ,
    );
    // The tongue end passes along the eye normal, so the lever can slide
    // its closed eye off the end instead of passing sideways through a pin.
    lockingStud.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(-upperEyeVector.y, upperEyeVector.x, 0).normalize());
    tongue.add(lockingStud);
    const tongueEndRoot = tongueStudLocal.clone().addScaledVector(
      new THREE.Vector2(-upperEyeVector.y, upperEyeVector.x).normalize(), -.31);
    const endNeck = cylinderAlongZ(.07, .54, tongueMaterial);
    endNeck.position.set(tongueEndRoot.x, tongueEndRoot.y, .53);
    endNeck.userData.role = 'tongue-end-offset-neck';
    tongue.add(endNeck);
    const tongueNoseMarker = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 18, 12),
      whiteMaterial,
    ), `white-tongue-to-tackle-contact-marker-${unitIndex + 1}`);
    tongueNoseMarker.position.set(
      tongueNoseLocal.x,
      tongueNoseLocal.y,
      tonguePlaneZ,
    );
    tongueNoseMarker.visible = false;
    tongue.add(tongueNoseMarker);

    const lever = addRole(new THREE.Group(),
      `eye-ended-release-lever-${unitIndex + 1}`);
    lever.position.set(leverPivot.x, leverPivot.y, 0);
    unit.add(lever);
    const leverUpperArm = tubeThrough([
      new THREE.Vector3(0, 0, mechanismPlaneZ),
      new THREE.Vector3(-0.16, 0.40, mechanismPlaneZ),
      new THREE.Vector3(-0.34, 0.76, mechanismPlaneZ),
      new THREE.Vector3(
        upperEyeVector.x * .79,
        upperEyeVector.y * .79,
        mechanismPlaneZ,
      ),
    ], 0.105, leverMaterial,
    `upper-arm-of-release-lever-${unitIndex + 1}`);
    boreCurvedLink(leverUpperArm, .105, .18, [{x: 0, y: 0, radius: .144}]);
    lever.add(leverUpperArm);
    const leverLowerArm = tubeThrough([
      new THREE.Vector3(0, 0, mechanismPlaneZ),
      new THREE.Vector3(0.48, -0.15, mechanismPlaneZ),
      new THREE.Vector3(0.92, -0.48, mechanismPlaneZ),
      new THREE.Vector3(
        lowerEyeVector.x,
        lowerEyeVector.y,
        mechanismPlaneZ,
      ),
    ], 0.105, leverMaterial,
    `lower-rope-arm-of-release-lever-${unitIndex + 1}`);
    boreCurvedLink(leverLowerArm, .105, .18, [{x: 0, y: 0, radius: .144}, {x: lowerEyeVector.x, y: lowerEyeVector.y, radius: .126}]);
    lever.add(leverLowerArm);
    const upperEye = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(
        upperEyeInnerRadius + 0.085,
        0.085,
        11,
        48,
      ),
      leverMaterial,
    ), `upper-eye-locking-tongue-${unitIndex + 1}`);
    upperEye.position.set(
      upperEyeVector.x,
      upperEyeVector.y,
      latchPlaneZ,
    );
    upperEye.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(-upperEyeVector.y, upperEyeVector.x, 0).normalize());
    lever.add(upperEye);
    const lowerEye = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(0.20, 0.075, 10, 42),
      leverMaterial,
    ), `lower-eye-receiving-release-rope-${unitIndex + 1}`);
    lowerEye.position.set(
      lowerEyeVector.x,
      lowerEyeVector.y,
      mechanismPlaneZ,
    );
    lever.add(lowerEye);

    const tonguePivotPin = addRole(cylinderAlongZ(
      0.13,
      0.84,
      darkMaterial,
      24,
    ), `fixed-upper-tongue-hinge-pin-${unitIndex + 1}`);
    tonguePivotPin.position.set(
      tonguePivot.x,
      tonguePivot.y,
      0.22,
    );
    unit.add(tonguePivotPin);
    const leverPivotPin = addRole(cylinderAlongZ(
      0.14,
      0.96,
      darkMaterial,
      24,
    ), `fixed-middle-lever-fulcrum-pin-${unitIndex + 1}`);
    leverPivotPin.position.set(
      leverPivot.x,
      leverPivot.y,
      0.24,
    );
    unit.add(leverPivotPin);
    const leverPivotIndex = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 16, 11),
      whiteMaterial,
    ), `white-lever-fulcrum-index-${unitIndex + 1}`);
    leverPivotIndex.position.set(
      leverPivot.x,
      leverPivot.y,
      0.74,
    );
    unit.add(leverPivotIndex);

    const tackleHookAssembly = addRole(new THREE.Group(),
      `external-tackle-hook-assembly-${unitIndex + 1}`);
    unit.add(tackleHookAssembly);
    // A finite J-hook bears under the tongue, rather than crossing its body.
    // The flat seat is located from the actual lowest tongue surface at lock.
    tongueBody.geometry.computeBoundingBox();
    const seatY = tonguePivot.y + tongueBody.geometry.boundingBox.min.y;
    const hookShape = new THREE.Shape();
    hookShape.moveTo(-.70, 2.66);
    hookShape.lineTo(-.88, 2.68);
    hookShape.quadraticCurveTo(-1.03, 2.62, -1.03, 2.30);
    hookShape.lineTo(-1.03, seatY + .13);
    hookShape.quadraticCurveTo(-1.03, seatY - .23, -.70, seatY - .23);
    hookShape.quadraticCurveTo(-.34, seatY - .23, -.24, seatY + .05);
    hookShape.lineTo(-.40, seatY);
    hookShape.lineTo(-.72, seatY);
    hookShape.quadraticCurveTo(-.82, seatY, -.82, seatY + .15);
    hookShape.lineTo(-.82, 2.30);
    hookShape.quadraticCurveTo(-.82, 2.48, -.70, 2.54);
    hookShape.closePath();
    const tackleHook = addRole(new THREE.Mesh(
      new THREE.ExtrudeGeometry(hookShape, {depth: .16, bevelEnabled: false, curveSegments: 24})
        .translate(0, 0, tacklePlaneZ - .08), tackleMaterial),
      `curved-hook-of-tackle-${unitIndex + 1}`);
    tackleHook.userData.seatY = seatY;
    tackleHookAssembly.add(tackleHook);
    const tackleHeadRing = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(0.31, 0.10, 11, 48),
      tackleMaterial,
    ), `upper-eye-of-tackle-hook-${unitIndex + 1}`);
    tackleHeadRing.position.set(-0.73, 2.92, tacklePlaneZ);
    tackleHookAssembly.add(tackleHeadRing);
    const tackleThroatMarker = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.073, 17, 12),
      whiteMaterial,
    ), `white-tackle-throat-contact-marker-${unitIndex + 1}`);
    tackleThroatMarker.position.set(
      lockedTongueNoseCenter.x,
      lockedTongueNoseCenter.y,
      tacklePlaneZ,
    );
    tackleThroatMarker.visible = false;
    tackleHookAssembly.add(tackleThroatMarker);
    // Brown draws the tackle falls and release ropes laid: the shared rope.
    const fallRope = addRole(makeDynamicCable({
      color: ropeMaterialColor,
      laid: true,
      maxSegments: 18,
      radius: 0.055,
    }), `external-vertical-tackle-fall-${unitIndex + 1}`);
    unit.add(fallRope);

    return {
      fallRope,
      lever,
      leverLowerArm,
      leverPivotIndex,
      leverPivotPin,
      leverUpperArm,
      lockingStud,
      lowerEye,
      standard,
      standardCollar,
      standardPlate,
      standardStem,
      standardThreads,
      tackleHeadRing,
      tackleHook,
      tackleHookAssembly,
      tackleThroatMarker,
      tongue,
      tongueBody,
      tongueNoseMarker,
      tonguePivotPin,
      unit,
      upperEye,
      unitIndex,
      unitZ,
    };
  };

  const units = unitZPositions.map((unitZ, index) => makeUnit(index, unitZ));
  const releaseCords = units.map((unit, index) => {
    const cord = addRole(makeDynamicCable({
      color: ropeMaterialColor,
      laid: true,
      // Exactly the pieces used: spare (hidden) pieces were left stacked at
      // the origin, where they overlapped one another.
      maxSegments: 36,
      radius: 0.045,
    }), `release-rope-attached-to-lower-lever-${index + 1}`);
    cord.userData.isBelt = false;
    cord.userData.isReleaseRope = true;
    root.add(cord);
    return cord;
  });
  // Brown crops the tackle fall above the hook and the release rope to the
  // right. Beyond the plate each runs on to a hand: a man on the davit holds
  // the tackle fall (it rises with the hook), and the release rope is pulled
  // by hand. The leads are rigid lengths of the same laid rope that move
  // with their rope ends.
  const leadMaterial = matte(ropeMaterialColor, { roughness: 0.76 });
  const fallLeadLength = 2.9;
  // Fixed lead sheave for the release rope beyond the plate.
  const releaseSheaveX = 6.0;
  const releaseSheaveRadius = 0.16;
  const releaseStanchionFootY = -2.2;
  const releaseRopeTailAtRest = 0.55;
  // Brown's release rope leaves the lower eye falling gently to the right
  // (about 0.115 down per unit across on the plate, 0.07 in the model seen in
  // the default perspective); the lead sheave's top is on that line.
  const restRopeEye = stateAtTime(0).ropeEyeCenter;
  const releaseLeadY = restRopeEye.y - 0.07 * (releaseSheaveX - (unitCenterX + restRopeEye.x));
  const ropeEnds = units.map((unit, index) => {
    const fallLead = addRole(new THREE.Mesh(new LaidRopeGeometry(new THREE.LineCurve3(
      new THREE.Vector3(-0.73, 3.88 + fallLeadLength, tacklePlaneZ),
      new THREE.Vector3(-0.73, 3.88, tacklePlaneZ)), 48, 0.055, 8, false), leadMaterial),
    `tackle-fall-lead-beyond-plate-${index + 1}`);
    const fallHand = makeHaulingHand(new THREE.Vector3(0, -1, 0), 0.055 / 0.8, {
      armDirection: new THREE.Vector3(0.3, 1, 0),
      tailPoints: [
        new THREE.Vector3(0, -0.15, 0), new THREE.Vector3(0, 0.24, 0),
        new THREE.Vector3(-0.15, 0.45, 0), new THREE.Vector3(-0.4, 0.45, 0),
        new THREE.Vector3(-0.55, 0.15, 0), new THREE.Vector3(-0.58, -0.25, 0),
      ],
    });
    fallHand.scale.setScalar(0.8);
    addRole(fallHand, `hand-holding-tackle-fall-${index + 1}`);
    unit.unit.add(fallLead, fallHand);
    // The release rope runs on to a fixed lead sheave on a stanchion just
    // beyond the plate, turns down over it and hangs as a short tail with a
    // wooden toggle, where the release is pulled. Rope length is conserved:
    // as the lower eye draws the rope in, the tail shortens.
    const releaseLead = addRole(new THREE.Mesh(new LaidRopeGeometry(new THREE.LineCurve3(
      new THREE.Vector3(), new THREE.Vector3(1, 0, 0)), 48, 0.045, 8, false),
    leadMaterial), `release-rope-lead-beyond-plate-${index + 1}`);
    const releaseHand = new THREE.Group();
    releaseHand.userData.role = `fixed-release-rope-lead-sheave-and-toggle-${index + 1}`;
    const sheaveCenter = new THREE.Vector3(releaseSheaveX, releaseLeadY - releaseSheaveRadius, unit.unitZ);
    const fittingMaterial = matte(PALETTE.frame, { metalness: 0.15, roughness: 0.62 });
    const sheave = addRole(new THREE.Mesh(new THREE.TorusGeometry(releaseSheaveRadius, 0.055, 12, 48), fittingMaterial),
      `release-rope-lead-sheave-${index + 1}`);
    sheave.position.copy(sheaveCenter);
    const sheaveWeb = addRole(new THREE.Mesh(new THREE.CylinderGeometry(releaseSheaveRadius - 0.03, releaseSheaveRadius - 0.03, 0.06, 40)
      .rotateX(Math.PI / 2), fittingMaterial), `release-rope-lead-sheave-web-${index + 1}`);
    sheaveWeb.position.copy(sheaveCenter);
    const stanchionZ = unit.unitZ - 0.24;
    const axle = addRole(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 20).rotateX(Math.PI / 2), fittingMaterial),
      `release-sheave-axle-${index + 1}`);
    axle.position.set(sheaveCenter.x, sheaveCenter.y, (unit.unitZ + stanchionZ) / 2 - 0.02);
    const stanchion = addRole(new THREE.Mesh(new THREE.BoxGeometry(0.14, sheaveCenter.y + 0.12 - releaseStanchionFootY, 0.12), fittingMaterial),
      `release-sheave-stanchion-${index + 1}`);
    stanchion.position.set(sheaveCenter.x, (sheaveCenter.y + 0.12 + releaseStanchionFootY) / 2, stanchionZ - 0.08);
    const foot = addRole(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.4), fittingMaterial),
      `release-sheave-stanchion-foot-${index + 1}`);
    foot.position.set(sheaveCenter.x, releaseStanchionFootY + 0.03, stanchionZ - 0.08);
    const tail = addRole(new THREE.Mesh(new LaidRopeGeometry(new THREE.LineCurve3(
      new THREE.Vector3(), new THREE.Vector3(0, -1, 0)), 48, 0.045, 8, false), leadMaterial),
    `release-rope-hanging-tail-${index + 1}`);
    tail.position.set(sheaveCenter.x + releaseSheaveRadius, sheaveCenter.y, unit.unitZ);
    const toggle = addRole(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.42, 20).rotateX(Math.PI / 2),
      matte(PALETTE.brass, { roughness: 0.7 })), `release-rope-wooden-toggle-${index + 1}`);
    releaseHand.add(sheave, sheaveWeb, axle, stanchion, foot, tail, toggle);
    releaseHand.userData.parts = { sheaveCenter, tail, toggle };
    root.add(releaseLead, releaseHand);
    for (const part of [fallHand, fallLead, releaseHand, releaseLead]) part.userData.beyondPlateCrop = true;
    return { fallHand, fallLead, releaseHand, releaseLead };
  });
  const pullBar = addRole(cylinderAlongZ(
    0.105,
    3.55,
    tongueMaterial,
    24,
  ), 'reconstructed-common-crossbar-pulling-both-release-ropes');
  pullBar.position.set(pullBarRestX, pullBarHeight, 0);
  root.add(pullBar);
  const pullBarGrip = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.075, 10, 40),
    tongueMaterial,
  ), 'common-pull-grip-for-one-operator');
  pullBarGrip.rotation.y = Math.PI / 2;
  pullBarGrip.position.set(pullBarRestX, pullBarHeight, 0);
  root.add(pullBarGrip);
  const pullDirectionIndex = addRole(new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.38, 20),
    whiteMaterial,
  ), 'white-index-showing-release-pull-direction');
  pullDirectionIndex.rotation.z = -Math.PI / 2;
  pullDirectionIndex.position.set(
    pullBarRestX + 0.38,
    pullBarHeight,
    0,
  );
  root.add(pullDirectionIndex);

  // The release rope: bent through the lower eye round its bar, then taut
  // and straight to the top of the fixed lead sheave beyond the plate.
  const releaseRopePath = (state, unit) => {
    const eyeCenter = new THREE.Vector3(
      unitCenterX + state.ropeEyeCenter.x,
      state.ropeEyeCenter.y,
      unit.unitZ + mechanismPlaneZ,
    );
    const lead = new THREE.Vector3(releaseSheaveX, releaseLeadY, unit.unitZ);
    const pull = new THREE.Vector3(lead.x - eyeCenter.x, lead.y - eyeCenter.y, 0)
      .normalize();
    // Keep the bend clear of the lever arm that joins the eye.
    const arm = new THREE.Vector3(unitCenterX + leverPivot.x - eyeCenter.x,
      leverPivot.y - eyeCenter.y, 0).normalize();
    const minimumArmAngle = THREE.MathUtils.degToRad(80);
    const armAngle = Math.acos(THREE.MathUtils.clamp(pull.dot(arm), -1, 1));
    if (armAngle < minimumArmAngle) {
      const turn = (minimumArmAngle - armAngle) * Math.sign(arm.x * pull.y - arm.y * pull.x || 1);
      pull.applyAxisAngle(new THREE.Vector3(0, 0, 1), turn);
    }
    const eyeBar = eyeCenter.clone().addScaledVector(pull, 0.20);
    // Wide enough to clear the lever boss (r 0.18, half-depth 0.105) and
    // still pass inside its 0.126 bore. Finely sampled, so adjacent straight
    // rope pieces meet at shallow bends.
    const loopRadius = 0.155;
    const loop = [];
    const loopSteps = 24;
    for (let i = 0; i <= loopSteps; i += 1) {
      const angle = -Math.PI / 2 - (FULL_TURN - 2.0) * (1 - i / loopSteps);
      loop.push(eyeBar.clone()
        .addScaledVector(pull, loopRadius * Math.cos(angle))
        .add(new THREE.Vector3(0, 0, loopRadius * Math.sin(angle))));
    }
    const start = loop.at(-1);
    const along = (state.pullBarX - start.x) / (lead.x - start.x);
    const end = start.clone().lerp(lead, along);
    return { start, loop, end, lead };
  };
  const restRelease = releaseRopePath(stateAtTime(0), units[0]);
  const restLeadLength = restRelease.lead.distanceTo(restRelease.end);
  const update = (time) => {
    const state = stateAtTime(time);
    for (const unit of units) {
      unit.lever.rotation.z = state.leverAngleRadian;
      unit.tongue.rotation.z = state.tongueAngleRadian;
      unit.tackleHookAssembly.position.y = state.tackleLift;
      // The fall is bent round the eye's top bar through its hole instead
      // of ending inside the ring.
      const barY = 2.92 + 0.31 + state.tackleLift;
      const loopRadius = 0.10 + 0.055 + 0.012;
      // The fall rises from the eye and is lifted with the hook.
      const fallPoints = [new THREE.Vector3(-0.73, barY + 0.65, tacklePlaneZ)];
      for (let i = 0; i <= 12; i += 1) {
        const angle = Math.PI / 2 - (FULL_TURN - 1.1) * i / 12;
        fallPoints.push(new THREE.Vector3(-0.73,
          barY + loopRadius * Math.sin(angle),
          tacklePlaneZ + loopRadius * Math.cos(angle)));
      }
      unit.fallRope.userData.setPoints(fallPoints);
    }
    pullBar.position.x = state.pullBarX;
    pullBarGrip.position.x = state.pullBarX;
    ropeEnds.forEach(({ fallHand, fallLead }) => {
      fallLead.position.y = state.tackleLift;
      fallHand.position.set(-0.73, 3.88 + fallLeadLength + state.tackleLift, tacklePlaneZ);
    });
    pullDirectionIndex.position.x = state.pullBarX + 0.38;
    units.forEach((unit, index) => {
      const { start, loop, end, lead } = releaseRopePath(state, unit);
      // Taut and straight from the lower eye to the lead sheave, as Brown
      // draws it: the pull bar grips the rope on that line.
      releaseCords[index].userData.setPoints([
        ...loop.slice(0, -1),
        ...Array.from({ length: 13 }, (_, i) => start.clone().lerp(end, i / 12)),
      ]);
      if (index === 0) {
        pullBar.position.y = end.y;
        pullBarGrip.position.y = end.y;
        pullDirectionIndex.position.y = end.y;
      }
      // The tail hanging from the sheave's far side takes up the length
      // drawn in.
      const { releaseHand, releaseLead } = ropeEnds[index];
      const { sheaveCenter, tail, toggle } = releaseHand.userData.parts;
      releaseLead.position.set(0, 0, 0);
      releaseLead.geometry.dispose();
      releaseLead.geometry = new LaidRopeGeometry(new THREE.LineCurve3(end.clone(), lead), 48, 0.045, 8, false);
      const tailLength = Math.max(0.12, releaseRopeTailAtRest + (restLeadLength - lead.distanceTo(end)));
      tail.geometry.dispose();
      tail.geometry = new LaidRopeGeometry(new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, -tailLength, 0)), 48, 0.045, 8, false);
      toggle.position.set(sheaveCenter.x + releaseSheaveRadius, sheaveCenter.y - tailLength - 0.05, sheaveCenter.z);
    });
  };

  const geometry = {
    cycleDuration,
    eyeClearDistance,
    leverEyeClearAngle,
    leverPivot,
    leverReleaseAngle,
    lockedStudCenter,
    lockedTongueNoseCenter,
    lowerEyeVector,
    mechanismPlaneZ,
    latchPlaneZ,
    pullBarHeight,
    pullBarRestX,
    pullBarTravel,
    tackleHookLift,
    tacklePlaneZ,
    tongueNoseLocal,
    tonguePivot,
    tonguePlaneZ,
    tongueReleaseAngle,
    tongueStudLocal,
    tongueStudRadius,
    unitCenterX,
    unitZPositions,
    upperEyeInnerRadius,
    upperEyeVector,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: cycleDuration,
    },
    minimumDisplayCycleSeconds: cycleDuration,
    archetype:
      'paired-eye-lever-boat-detachers-with-hinged-load-tongues',
    blocks: {
      boatDeck,
      deckRails,
      pullBar,
      pullBarGrip,
      pullDirectionIndex,
      releaseCords,
      units,
    },
    degreesOfFreedom: {
      independentReleaseInputs: 1,
      leverCoordinatesPerUnit: 1,
      tackleHookFreeAfterReleasePerUnit: 1,
      tongueCoordinatesPerUnit: 1,
      unitsCommandedSynchronously: true,
    },
    dynamics: {
      contactResiduals: ['Locked capture and the continuous prescribed release path are qualified against finite surfaces. Contact forces, latch preload, friction and passive load-driven timing remain unsolved; the tongue is commanded clockwise clear before the tackle rises.'],
      didacticResetDisclosure:
        'The first half of the cycle is the working release: pull levers, free both tongue studs, swing both unloaded tongues, and let the tackle hooks rise. The second half lowers the tackle hooks, reseats the tongues, and restores the lever eyes only to repeat the demonstration; that reset is not a claim of automatic reattachment.',
      eyeReleaseCriterion:
        'The transverse closed eye slides off the tongue end. The retained staged demonstration delays tongue rotation until the conservative projected center distance reaches r_eye_inner+r_stud; this is a schedule, not a unilateral-contact or force solve.',
      loadPath:
        'While locked, each external tackle hook bears on its hinged tongue; the tongue locking stud lies inside the release-lever eye; the lever reacts at the middle fulcrum; and the fixed standard transfers the load to the boat deck. Pulling the lower lever eye removes only the lock before the tongue and tackle separate.',
      synchronization:
        'Both source-required end units use the same scalar release coordinate. Two distinct release ropes terminate at one visibly disclosed reconstructed pull bar, consistent with the period report that one operator amidships disconnected the boat.',
    },
    fidelity: 'authored',
    geometry,
    leverEyeCenterAtAngle,
    leverRopeEyeCenterAtAngle,
    mechanism:
      'Two identical boat-fixed standards carry separate upper tongue hinges and middle release-lever fulcrums. In each unit the upper eye of a bent lever surrounds the tongue locking stud while a tackle hook bears on the tongue nose. Drawing the rope on the lever’s lower eye rotates the eye clear; the freed tongue swings out of the tackle hook, detaching that end. Both end units receive the same pull and release together.',
    motion: {
      hingeAxes: new THREE.Vector3(0, 0, 1),
      releasePullDirection: new THREE.Vector3(1, 0, 0),
      tackleReleaseDirection: new THREE.Vector3(0, 1, 0),
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 492 HTML contains no canvas model or animation library and marks Animated unavailable.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownAndLevel1866PatentUrl:
        'https://patents.google.com/patent/US55053A/en',
      brownBookScanUrl:
        'https://upload.wikimedia.org/wikipedia/commons/c/c3/Five_hundred_and_seven_mechanial_movements%2C_embracing_all_those_which_are_most_important_in_dynamics%2C_hydraulics%2C_hydrostatics%2C_pneumatics%2C_steam_engines%2C_mill_and_other_gearing_.._%28IA_fivehundredseven02brow%29.pdf',
      brownPlate492: {
        approximateLeverFulcrumPixels: [248, 239],
        approximateLowerRopeEyePixels: [368, 422],
        approximateStandardBottomPixels: [252, 486],
        approximateTackleHookBoundsPixels: [181, 34, 284, 217],
        approximateTongueHingePixels: [247, 151],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 9,
      },
      britishPatentNoticeUrl:
        'https://www.thegazette.co.uk/London/issue/24046/page/6047/data.pdf',
      constructionEvidence: {
        britishPatentNotice:
          'The official London Gazette patent index records British application 3228 of 7 December 1866 for an improved detaching hook, communicated by Samuel Brown and Leon Level.',
        explicitInBrownDescription: [
          'an upright standard is secured to the boat',
          'a tongue is hinged to the standard upper end',
          'the tongue enters an eye in a lever',
          'the lever fulcrum is at the middle of the standard',
          'one apparatus is used at each end of the boat',
          'the tackle hooks engage the tongues',
          'a rope attaches to the lower end of each lever',
          'pulling each rope slips the upper eye off the tongue',
          'the liberated tongue slips out of the tackle hook',
        ],
        engravingEvidence:
          'Brown’s elevation distinctly shows the boat-fixed threaded standard with two hinge centers, the upper hinged tongue, a tackle hook around its load nose, a separate bent lever with an eye surrounding the tongue stud, a middle fulcrum, and a lower rope eye.',
        frankLeslieCorroboration:
          'Frank Leslie’s Illustrated Newspaper of 24 February 1866 reports an operating trial of Brown & Level’s Safety Boat Tackle in which one oarsman amidships instantly disconnected the boat while it was lowered from two davits.',
        relatedPatentScope:
          'Brown and Level’s US 55,053 concerns their companion equal-fall lowering brake rather than this hook, but independently confirms the inventors, date, paired tackle falls, and purpose of placing both falls under one operator’s control.',
        reconstructionDisclosure:
          'Brown fixes the two-unit topology and complete eye/tongue release order but supplies only one locked elevation. Plate-projected member proportions, axial layer separation, exact eye clearance, release angles, common pull bar, staged timing, colors, deck, tackle lift, and didactic reset are independently engineered and exposed.',
      },
      frankLeslieArchiveUrl:
        'https://archive.org/details/sim_leslies-weekly_1866-02-24_21_543',
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 492',
    },
    stateAtTime,
    tackleThroatAtLift,
    tongueNoseCenterAtAngle,
    tongueStudCenterAtAngle,
    transmission: {
      pairedCommand:
        'delta_lever_fore=delta_lever_aft=delta_common_pull',
      releaseCondition:
        'distance(center_eye,center_stud)>=r_eye_inner+r_stud',
      resetOrder:
        'working release: lever then tongue then tackle; didactic reset: tackle then tongue then lever',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.40, -2.32, -2.70),
    new THREE.Vector3(4.70, 4.12, 2.70),
  );
  root.userData.cameraDistanceScale = 1.06;
  root.userData.cameraDirection = new THREE.Vector3(3, 2, 12);
  root.userData.groundFloorY = -2.32;
  markShadows(root);
  for (const unit of units) {
    for (const marker of [
      unit.leverPivotIndex,
      unit.tackleThroatMarker,
      unit.tongueNoseMarker,
    ]) marker.castShadow = false;
  }
  pullDirectionIndex.castShadow = false;
  fitPistonGuide(root, update, cycleDuration);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredBoatDetacherMovement(movement) {
  if (movement.id !== 492) return null;
  return boatDetachingHooks(movement);
}
