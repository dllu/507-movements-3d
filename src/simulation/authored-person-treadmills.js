import { correctRunnerTreadParts, finishRunnerTread } from './treadwheel-working-parts.js';
import { treadmillLegState } from './treadmill-gait.js';
import * as THREE from 'three';
import {
  circle,
  plate,
  poly,
  polygonClipping,
} from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';
import { bendingLimbGeometry, figureGeometry } from './figure-meshes.js';
import { makeGripFist } from './hauling-hand.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function tubeBetween(start, end, radius, material) {
  return new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.LineCurve3(start, end),
      1,
      radius,
      10,
      false,
    ),
    material,
  );
}

// Brown's walker is a tall, broad man: his standing foot is on a board a
// little below axle height, his raised knee is lifted onto the next board
// up, and his hands grip the rail at chin height near the top of the drum.
// FIGURE_SCALE sizes his jacket, head and arms; the legs have their own
// lengths and full trouser radii.
const FIGURE_SCALE = 1.2;
const UPPER_LEG_LENGTH = 0.74;
const LOWER_LEG_LENGTH = 0.70;
const THIGH_RADIUS = 0.09;
// The knee fillet is wider than the trouser leg's inner half-width (0.08) at
// the knee, so the bent leg never folds through itself.
const KNEE_FILLET_RADIUS = 0.11;
// Hip station relative to the drum axis; the standing leg is nearly
// straight at the lowest planted board and the stepping knee rises high.
const HIP_OFFSET = { x: 2.51, y: 0.75 };
// Pass 99: each sole stands on the outer part of its board, its heel at
// the board's edge, so the legs reach less far in toward the drum. Boards
// are met 10 degrees above the horizontal and left about 17 below it, near
// axle height as Brown draws; 52% stance keeps a foot on a board at all
// times. Chosen by a 2-D search of hip, touchdown, stance and swing
// (docs/p99-e-review.md): mean planted thigh 87 degrees from vertical
// against the old 98. Radial boards at the drum's side stop the raised
// knee from coming in over the feet, so a fully upright stance is not
// reachable with Brown's figure and drum proportions.
const TOUCHDOWN_DEGREES = 10;
const STANCE_FRACTION = 0.52;
const FOOT_RADIAL = 0.07;
const SWING_OUT = 2.0;
const SWING_UP = 1.70;
const LEAN_ANGLE = THREE.MathUtils.degToRad(0);
const ANKLE_EASE_START = THREE.MathUtils.degToRad(60);
const ANKLE_EASE_SPAN = THREE.MathUtils.degToRad(3);
// Hips stand just outboard of the jacket's lower half-width.
const HIP_HALF_SPACING = 0.182 * FIGURE_SCALE + THIGH_RADIUS + 0.01;

function externalPersonTreadmill(movement) {
  const root = new THREE.Group();

  const wheelCenter = new THREE.Vector3(-0.62, -0.23, 0);
  const wheelRadius = 1.62;
  const treadRadius = 1.50;
  const drumWidth = 2.32;
  const treadCount = 14;
  const treadPitch = FULL_TURN / treadCount;
  const wheelPeriod = 4;
  const wheelAngularSpeed = -FULL_TURN / wheelPeriod;
  // The boards' phase at the plate pose is chosen so that, as Brown draws
  // him, one leg is straight at the end of its stance while the other knee
  // is raised with its foot just set on a higher board.
  const wheelStartAngle = THREE.MathUtils.degToRad(9.6);
  const gaitCyclesPerWheelTurn = treadCount / 2;
  const gaitAngularSpeed = Math.abs(wheelAngularSpeed)
    * gaitCyclesPerWheelTurn;
  const personStationAngle = THREE.MathUtils.degToRad(20);
  const personStationPoint = wheelCenter.clone().add(new THREE.Vector3(
    Math.cos(personStationAngle) * treadRadius,
    Math.sin(personStationAngle) * treadRadius,
    0,
  ));
  const personRelativeClimbSpeed = treadRadius
    * Math.abs(wheelAngularSpeed);
  const personMass = 1.0;
  const gravity = 9.81;
  const personCenterOfMass = wheelCenter.clone().add(
    // Brown's man climbs on the descending side, centred across the drum's
    // width, behind the diagonal plank that stands at the wheel's face.
    // Scaled to Brown's figure, whose cap only just rises above the drum
    // top and whose feet are on the boards near axle height.
    new THREE.Vector3(HIP_OFFSET.x, HIP_OFFSET.y + 0.27 * FIGURE_SCALE, 0),
  );
  const personWeight = new THREE.Vector3(0, -personMass * gravity, 0);
  const personWeightTorque = personCenterOfMass.clone()
    .sub(wheelCenter).cross(personWeight).z;
  const outputPower = personWeightTorque * wheelAngularSpeed;
  const legPhaseOffsets = [0, Math.PI];
  const upperLegLength = UPPER_LEG_LENGTH;
  const lowerLegLength = LOWER_LEG_LENGTH;
  const gaitGeometry = { treadPitch, treadRadius, treadCount, wheelStartAngle,
    wheelPeriod, hipX: personCenterOfMass.x - wheelCenter.x,
    hipY: personCenterOfMass.y - wheelCenter.y - 0.27 * FIGURE_SCALE,
    upperLength: upperLegLength, lowerLength: lowerLegLength,
    touchdownAngle: THREE.MathUtils.degToRad(TOUCHDOWN_DEGREES),
    stanceFraction: STANCE_FRACTION, footRadial: FOOT_RADIAL,
    swingOut: SWING_OUT, swingUp: SWING_UP };

  const stateAtTime = (time) => {
    const wheelTravel = wheelAngularSpeed * time;
    const wheelAngle = wheelStartAngle + wheelTravel;
    const wheelAngularVelocity = Z_AXIS.clone()
      .multiplyScalar(wheelAngularSpeed);
    const treadStates = Array.from({ length: treadCount }, (_, index) => {
      const angle = wheelAngle + index * treadPitch;
      const localCenter = new THREE.Vector3(
        Math.cos(angle) * treadRadius,
        Math.sin(angle) * treadRadius,
        0,
      );
      const center = wheelCenter.clone().add(localCenter);
      const velocity = new THREE.Vector3().crossVectors(
        wheelAngularVelocity,
        localCenter,
      );
      return { angle, center, index, localCenter, velocity };
    });
    const stationRadiusVector = personStationPoint.clone()
      .sub(wheelCenter);
    const surfaceVelocityAtPerson = new THREE.Vector3().crossVectors(
      wheelAngularVelocity,
      stationRadiusVector,
    );
    const relativeClimbVelocity = surfaceVelocityAtPerson.clone().negate();
    const gaitPhase = gaitAngularSpeed * time;
    const legStates = legPhaseOffsets.map((_, index) => treadmillLegState(time, index, gaitGeometry));
    return {
      gaitAngularSpeed,
      gaitPhase,
      legStates,
      netPersonWorldVelocity: surfaceVelocityAtPerson.clone()
        .add(relativeClimbVelocity),
      outputPower,
      personCenterOfMass: personCenterOfMass.clone(),
      personRelativeClimbSpeed,
      personWeight: personWeight.clone(),
      personWeightTorque,
      relativeClimbVelocity,
      surfaceVelocityAtPerson,
      treadPassingFrequency: treadCount / wheelPeriod,
      treads: treadStates,
      wheelAngle,
      wheelAngularSpeed,
      wheelTravel,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.59,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const wheelMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.61,
  });
  const treadMaterial = matte(PALETTE.brass, {
    metalness: 0.10,
    roughness: 0.67,
  });
  const personMaterial = matte(PALETTE.driver, {
    metalness: 0.02,
    roughness: 0.76,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const wheelRotor = new THREE.Group();
  wheelRotor.position.copy(wheelCenter);
  wheelRotor.userData.axis = Z_AXIS.clone();
  wheelRotor.userData.role =
    'broad-horizontal-axis-treadmill-drum-and-output-shaft';
  root.add(wheelRotor);
  const endRings = [];
  const endSpokes = [];
  for (const side of [-1, 1]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(wheelRadius - 0.065, 0.065, 11, 84),
      wheelMaterial,
    );
    ring.position.z = side * drumWidth / 2;
    ring.userData.side = side;
    ring.userData.role = 'one-of-two-rigid-end-rings-of-treadmill-drum';
    endRings.push(ring);
    wheelRotor.add(ring);
    for (let index = 0; index < 4; index += 1) {
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(wheelRadius * 1.72, 0.075, 0.060),
        wheelMaterial,
      );
      spoke.position.z = side * drumWidth / 2;
      spoke.rotation.z = index * Math.PI / 4;
      spoke.userData.index = index;
      spoke.userData.side = side;
      spoke.userData.role = 'end-wheel-diameter-brace';
      endSpokes.push(spoke);
      wheelRotor.add(spoke);
    }
  }
  const treadBoards = [];
  const outerLugs = [];
  for (let index = 0; index < treadCount; index += 1) {
    const angle = index * treadPitch;
    const tread = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.105, drumWidth * 0.95),
      treadMaterial,
    );
    tread.position.set(
      Math.cos(angle) * treadRadius,
      Math.sin(angle) * treadRadius,
      0,
    );
    // Radial boards provide upward-facing steps on the descending side.
    // Tangential boards would present a nearly vertical wall to the walker.
    tread.rotation.z = angle;
    tread.userData.index = index;
    tread.userData.role =
      'cross-width-peripheral-step-board-rigid-with-treadmill';
    treadBoards.push(tread);
    wheelRotor.add(tread);
    for (const side of [-1, 1]) {
      const lug = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.16, 0.16),
        wheelMaterial,
      );
      lug.position.set(
        Math.cos(angle) * (wheelRadius + 0.03),
        Math.sin(angle) * (wheelRadius + 0.03),
        side * drumWidth / 2,
      );
      lug.rotation.z = angle + Math.PI / 2;
      lug.userData.index = index;
      lug.userData.side = side;
      lug.userData.role = 'end-ring-step-lug-at-one-tread-board';
      outerLugs.push(lug);
      wheelRotor.add(lug);
    }
  }
  const axle = cylinderAlongZ(0.13, drumWidth + 1.10,
    darkMaterial, 30);
  axle.userData.role = 'coaxial-output-shaft-rigid-with-treadmill-drum';
  wheelRotor.add(axle);
  const wheelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.060, 0.035),
    whiteMaterial,
  );
  wheelIndex.position.set(1.03, 0, drumWidth / 2 + 0.075);
  wheelIndex.userData.role =
    'white-index-showing-clockwise-treadmill-output-rotation';
  wheelRotor.add(wheelIndex);

  // Brown's near end shows a notched spur wheel on the axle, outboard of
  // the drum: a broad rim with round tooth spaces, a crossed pair of arms
  // and a hub, smaller than the tread circle.
  const gearRadius = 1.16;
  const gearNotchCount = 16;
  const gearNotchRadius = 0.105;
  const gearFaceZ = drumWidth / 2 + 0.14;
  const gearThickness = 0.10;
  const notches = Array.from({ length: gearNotchCount }, (_, index) => {
    const angle = (index + 0.5) * FULL_TURN / gearNotchCount;
    return poly(circle(
      [Math.cos(angle) * gearRadius, Math.sin(angle) * gearRadius],
      gearNotchRadius,
      48,
    ));
  });
  const gearWeb = polygonClipping.union(
    polygonClipping.difference(
      poly(circle([0, 0], gearRadius, 256)),
      poly(circle([0, 0], gearRadius * 0.70, 192)),
      ...notches,
    ),
    poly([[-0.84, -0.06], [0.84, -0.06], [0.84, 0.06], [-0.84, 0.06]]),
    poly([[-0.06, -0.84], [0.06, -0.84], [0.06, 0.84], [-0.06, 0.84]]),
    poly(circle([0, 0], 0.26, 96)),
  );
  const endGear = new THREE.Mesh(
    plate(
      polygonClipping.difference(gearWeb, poly(circle([0, 0], 0.13, 96))),
      gearFaceZ,
      gearFaceZ + gearThickness,
    ),
    wheelMaterial,
  );
  endGear.userData.role = 'source-visible-notched-spur-wheel-on-treadmill-axle';
  wheelRotor.add(endGear);

  const person = new THREE.Group();
  person.position.set(
    personCenterOfMass.x,
    personCenterOfMass.y,
    personCenterOfMass.z,
  );
  person.userData.fixedInWorld = true;
  person.userData.role =
    'world-stationary-person-stepping-up-descending-peripheral-boards';
  root.add(person);
  // Brown's walker, seen from behind: a loose jacket with broad, rounded
  // shoulders narrowing to the waist and flaring slightly at a hem just
  // above the hips (so the raised thigh passes under it), a short neck, a
  // round head in a close cap, bent arms reaching up to the rail, trousers
  // and shoes. The jacket is a lathe of that back-view outline, flattened
  // front to back (x).
  // Below the shoulders the jacket stays inside the thighs' inner faces
  // (|z| < 0.148), because the stepping thigh swings up beside it.
  const jacketProfile = [
    [0, -0.20], [0.16, -0.20], [0.178, -0.15], [0.172, -0.04],
    [0.165, 0.10], [0.178, 0.26], [0.182, 0.40], [0.255, 0.46],
    [0.265, 0.50], [0.235, 0.545], [0.16, 0.575], [0.08, 0.60], [0, 0.605],
  ].map(([radius, y]) => new THREE.Vector2(radius * FIGURE_SCALE, y * FIGURE_SCALE));
  const torso = new THREE.Mesh(
    new THREE.LatheGeometry(jacketProfile, 36),
    personMaterial,
  );
  torso.scale.x = 0.78;
  torso.userData.role = 'person-jacket-torso-seen-from-behind';
  person.add(torso);
  const skinMaterial = matte(0xe8b48f, { metalness: 0.0, roughness: 0.8 });
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.15 * FIGURE_SCALE, 28, 18),
    skinMaterial,
  );
  head.scale.set(0.92, 1.12, 0.88);
  head.position.y = 0.80 * FIGURE_SCALE;
  head.userData.role = 'person-head';
  person.add(head);
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065 * FIGURE_SCALE, 0.075 * FIGURE_SCALE, 0.14 * FIGURE_SCALE, 18),
    skinMaterial,
  );
  neck.position.y = -0.14 * FIGURE_SCALE;
  neck.userData.role = 'person-neck';
  head.add(neck);
  // Brown's close round cap with a band, set on the back of the head.
  const cap = new THREE.Mesh(
    new THREE.LatheGeometry(
      [new THREE.Vector2(0, 0), ...Array.from({ length: 12 }, (_, index) => {
        const angle = Math.PI / 2 * index / 11;
        return new THREE.Vector2(
          0.158 * FIGURE_SCALE * Math.cos(angle),
          0.158 * FIGURE_SCALE * Math.sin(angle),
        );
      })],
      28,
    ),
    darkMaterial,
  );
  cap.scale.set(0.95, 1.05, 0.92);
  cap.position.y = 0.82 * FIGURE_SCALE;
  cap.userData.role = 'source-visible-person-cap';
  const capBand = new THREE.Mesh(
    new THREE.TorusGeometry(0.15 * FIGURE_SCALE, 0.018 * FIGURE_SCALE, 8, 36),
    darkMaterial,
  );
  capBand.rotation.x = Math.PI / 2;
  capBand.position.y = 0.017 * FIGURE_SCALE;
  capBand.userData.role = 'person-cap-band';
  cap.add(capBand);
  person.add(cap);
  // Brown's walker stands upright (LEAN_ANGLE is zero). The jacket, head,
  // cap and arms could be turned together about the hip line; the legs
  // hang from the unmoved hip pivots.
  const leanPivot = new THREE.Vector2(0, -0.27 * FIGURE_SCALE);
  const leanPoint = (x, y, angle = LEAN_ANGLE) => {
    const dx = x - leanPivot.x;
    const dy = y - leanPivot.y;
    return new THREE.Vector2(
      leanPivot.x + dx * Math.cos(angle) - dy * Math.sin(angle),
      leanPivot.y + dx * Math.sin(angle) + dy * Math.cos(angle),
    );
  };
  const applyLean = (object) => {
    const point = leanPoint(object.position.x, object.position.y);
    object.position.x = point.x;
    object.position.y = point.y;
    object.rotation.z += LEAN_ANGLE;
  };
  for (const part of [torso, head, cap]) applyLean(part);
  // The jacket, head and cap are Blender models (scripts/blender/figures.py)
  // in the person frame; they replace the lathe jacket, sphere head and
  // cap, whose neck and band are part of the new meshes.
  for (const [part, name] of [[torso, 'man-jacket'], [head, 'man-head'], [cap, 'man-cap']]) {
    part.geometry.dispose();
    part.geometry = figureGeometry(name);
    part.position.set(0, 0, 0);
    part.scale.set(1, 1, 1);
    part.rotation.set(0, 0, LEAN_ANGLE);
  }
  neck.visible = false;
  capBand.visible = false;
  const arms = [];
  // He faces the drum and reaches up to a rail just above and in front of
  // his cap: Brown's topmost horizontal line along the drum.
  const leanedHead = leanPoint(0, 0.80 * FIGURE_SCALE);
  // Brown's hands grip the rail at the height of the cap's crown.
  const handRailY = personCenterOfMass.y + leanedHead.y + 0.12 * FIGURE_SCALE;
  const handRailX = personCenterOfMass.x + leanedHead.x - 0.18 * FIGURE_SCALE;
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Vector3(
      0,
      0.45 * FIGURE_SCALE,
      side * 0.22 * FIGURE_SCALE,
    );
    // The arm is built unleaned and turned with the body, so its hand is
    // placed at the rail point turned back by the lean.
    const handInBody = leanPoint(
      handRailX - personCenterOfMass.x,
      handRailY - personCenterOfMass.y,
      -LEAN_ANGLE,
    );
    const hand = new THREE.Vector3(
      handInBody.x,
      handInBody.y,
      side * 0.33 * FIGURE_SCALE,
    );
    // Upper arm out and up to an elbow held wide, forearm up to the rail.
    const elbow = new THREE.Vector3(
      hand.x * 0.45,
      0.72 * FIGURE_SCALE,
      side * 0.42 * FIGURE_SCALE,
    );
    const arm = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([shoulder, elbow, hand], false, 'centripetal'),
        24,
        0.058 * FIGURE_SCALE,
        12,
        false,
      ),
      personMaterial,
    );
    for (const [point, radius, material] of [
      [shoulder, 0.07 * FIGURE_SCALE, personMaterial],
      [elbow, 0.058 * FIGURE_SCALE, personMaterial],
      [hand, 0.062 * FIGURE_SCALE, skinMaterial],
    ]) {
      const joint = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 10), material);
      joint.position.copy(point);
      joint.userData.role = point === hand ? 'person-hand-gripping-rail' : 'person-arm-joint';
      arm.add(joint);
    }
    // Blender sleeve from the shoulder out to a wide elbow and up to the
    // wrist, and a closed fist round the rail, thumb inboard and the back of
    // the hand toward the viewer (the far hand is its mirror image).
    arm.geometry.dispose();
    arm.geometry = figureGeometry(side > 0 ? 'man-arm-left' : 'man-arm-right');
    for (const joint of [...arm.children]) {
      if (joint.userData.role === 'person-arm-joint') arm.remove(joint);
      else joint.visible = false;
    }
    const fist = makeGripFist(0.059, 0.75, skinMaterial);
    fist.position.copy(hand);
    fist.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0)));
    if (side > 0) fist.scale.x *= -1;
    fist.userData.role = 'person-hand-gripping-rail';
    arm.add(fist);
    applyLean(arm);
    arm.userData.side = side;
    arm.userData.role = 'person-arm-holding-fixed-safety-rail';
    arms.push(arm);
    person.add(arm);
  }
  // Brown's striped trousers read darker than the jacket.
  const trouserMaterial = matte(0x4d5d6c, { metalness: 0.02, roughness: 0.8 });
  // A trouser seat joins the two hips under the jacket's hem. It lies on
  // the hip axis and its rounded ends run into the tops of the trouser legs
  // (pass 82), which turn about that axis, so the legs stay joined to it.
  const seatHalfWidth = HIP_HALF_SPACING - 0.02;
  const seatRadius = 0.105;
  const seat = new THREE.Mesh(
    new THREE.CapsuleGeometry(seatRadius, 2 * (seatHalfWidth - seatRadius), 8, 18)
      .rotateX(Math.PI / 2),
    trouserMaterial,
  );
  seat.scale.x = 0.95;
  seat.position.set(0, -0.27 * FIGURE_SCALE, 0);
  seat.userData.role = 'person-trouser-seat-joining-hips';
  person.add(seat);
  const legRoots = [];
  const kneePivots = [];
  const legs = [];
  const feet = [];
  for (let index = 0; index < 2; index += 1) {
    const legRoot = new THREE.Group();
    // Stylized joints are layered side by side so the folding swing leg
    // never passes through itself or the torso: the thighs hang beside the
    // torso's 0.149 half-depth, and each shin and foot ride just outboard
    // of their thigh like the plates of a jointed lay figure.
    const legSide = index === 0 ? 1 : -1;
    legRoot.position.set(
      0,
      -0.27 * FIGURE_SCALE,
      legSide * HIP_HALF_SPACING,
    );
    legRoot.userData.index = index;
    legRoot.userData.role = 'person-hip-pivot';
    person.add(legRoot);
    legRoots.push(legRoot);
    // Pass 82: one continuous trouser leg (Blender, scripts/blender/figures.py)
    // from the hip through a modelled knee to the ankle, hung from the hip
    // pivot and bent at the knee pivot round a fillet each frame, so thigh,
    // knee and shin never part. Its cuff runs down into the shoe's top.
    const leg = new THREE.Mesh(
      bendingLimbGeometry('man-leg', { kneeDepth: upperLegLength, filletRadius: KNEE_FILLET_RADIUS }),
      trouserMaterial,
    );
    leg.userData.role = 'person-trouser-leg-hip-knee-and-shin';
    legRoot.add(leg);
    legs.push(leg);
    const knee = new THREE.Group();
    knee.position.y = -upperLegLength;
    knee.userData.index = index;
    knee.userData.role = 'person-knee-pivot';
    legRoot.add(knee);
    kneePivots.push(knee);
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.07, 0.11).translate(0, -0.015, 0),
      darkMaterial,
    );
    foot.position.set(-0.035, -lowerLegLength - 0.05, 0);
    foot.userData.role = 'person-foot-above-peripheral-step';
    knee.add(foot);
    foot.geometry.dispose();
    // The shoe keeps the old sole: flat at y = -0.05 with the 0.28 x 0.11
    // footprint that rests on the boards; its upper (pass 83) rises round
    // the ankle under the trouser cuff.
    foot.geometry = figureGeometry('man-shoe', (position) => {
      for (let i = 0; i < position.length; i += 3) {
        position[i] = THREE.MathUtils.clamp(position[i], -0.14, 0.14);
        position[i + 1] = THREE.MathUtils.clamp(position[i + 1], -0.05, 0.1);
        position[i + 2] = THREE.MathUtils.clamp(position[i + 2], -0.055, 0.055);
      }
    });
    feet.push(foot);
  }

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-bearing-pedestal-diagonal-guard-and-handrail';
  root.add(fixedFrame);
  // Brown's bearing standard stands in front of the spur wheel: a flared
  // A-frame whose legs spread to a plank on the ground.
  const pedestalZ = gearFaceZ + gearThickness + 0.20;
  const pedestalFootY = -1.96 - wheelCenter.y;
  const pedestalTopY = -0.22;
  const rearPedestal = new THREE.Mesh(
    plate(
      polygonClipping.difference(
        poly([
          [-0.86, pedestalFootY],
          [0.86, pedestalFootY],
          [0.20, pedestalTopY],
          [-0.20, pedestalTopY],
        ]),
        poly([
          [-0.56, pedestalFootY - 0.01],
          [0.56, pedestalFootY - 0.01],
          [0.07, pedestalTopY - 0.52],
          [-0.07, pedestalTopY - 0.52],
        ]),
      ),
      -0.09,
      0.09,
    ),
    frameMaterial,
  );
  rearPedestal.position.set(wheelCenter.x, wheelCenter.y, pedestalZ);
  rearPedestal.userData.role = 'source-visible-end-bearing-pedestal';
  fixedFrame.add(rearPedestal);
  const bearing = cylinderAlongZ(0.23, 0.32, frameMaterial, 30);
  bearing.position.set(
    wheelCenter.x,
    wheelCenter.y,
    pedestalZ,
  );
  bearing.userData.role = 'fixed-treadmill-end-bearing';
  fixedFrame.add(bearing);
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(4.92, 0.18, 3.36),
    frameMaterial,
  );
  base.position.set(0.02, -2.05, 0);
  base.userData.role = 'fixed-treadmill-foundation';
  fixedFrame.add(base);
  const pedestalPlank = new THREE.Mesh(
    new THREE.BoxGeometry(2.30, 0.12, 0.46),
    frameMaterial,
  );
  pedestalPlank.position.set(wheelCenter.x, -2.02, pedestalZ);
  pedestalPlank.userData.role = 'source-visible-plank-under-bearing-standard';
  fixedFrame.add(pedestalPlank);
  const handRailStart = new THREE.Vector3(
    handRailX,
    handRailY,
    -drumWidth / 2 - 0.20,
  );
  // The rail runs away from the viewer beyond the man's near hand, as
  // Brown draws it running off the plate to the right.
  const handRailEnd = new THREE.Vector3(
    handRailX,
    handRailY,
    drumWidth / 2,
  );
  const handRail = tubeBetween(
    handRailStart,
    handRailEnd,
    0.055,
    darkMaterial,
  );
  handRail.userData.role = 'fixed-hand-rail-above-person-station';
  fixedFrame.add(handRail);
  // Pass 90: Brown's diagonal plank stands in the plane of the wheel's face,
  // in front of the spur wheel and its bearing standard. It leans at about
  // 24 degrees from the upright, rising up and to the left from its foot on
  // the ground right of the wheel, and its top end rises above the rail. The
  // rail the man holds runs along the drum's axis and passes through Brown's
  // drawn hole about a seventh of the way down the plank, so the plank
  // carries the rail's near end.
  const plankZ = gearFaceZ + gearThickness + 0.20 + 0.90;
  const plankThickness = 0.10;
  const plankWidth = 0.26;
  const plankLean = THREE.MathUtils.degToRad(36);
  const plankFootY = -2.08;
  const railRadius = 0.055;
  const plankDown = new THREE.Vector2(Math.sin(plankLean), -Math.cos(plankLean));
  const plankAcross = new THREE.Vector2(Math.cos(plankLean), Math.sin(plankLean));
  const holeCenter = new THREE.Vector2(handRailX, handRailY);
  const plankTop = holeCenter.clone().addScaledVector(plankDown, -0.6);
  const plankRun = (plankFootY - plankTop.y) / plankDown.y;
  const plankFoot = plankTop.clone().addScaledVector(plankDown, plankRun);
  const plankOutline = [
    plankTop.clone().addScaledVector(plankAcross, -plankWidth / 2),
    plankTop.clone().addScaledVector(plankAcross, plankWidth / 2),
    // The foot is cut level where it stands on the ground.
    new THREE.Vector2(
      plankFoot.x + plankWidth / 2 / Math.cos(plankLean),
      plankFootY,
    ),
    new THREE.Vector2(
      plankFoot.x - plankWidth / 2 / Math.cos(plankLean),
      plankFootY,
    ),
  ].map((point) => [point.x, point.y]);
  const diagonalGuard = new THREE.Mesh(
    plate(
      polygonClipping.difference(
        poly(plankOutline),
        // The rail's 32 facets meet this 64-sided bore at their vertices.
        poly(circle([holeCenter.x, holeCenter.y], railRadius, 64)),
      ),
      plankZ - plankThickness / 2,
      plankZ + plankThickness / 2,
    ),
    frameMaterial,
  );
  diagonalGuard.userData.role =
    'source-visible-fixed-diagonal-side-frame';
  diagonalGuard.userData.plane = {
    z: plankZ,
    thickness: plankThickness,
    width: plankWidth,
    leanFromUpright: plankLean,
    holeCenter: holeCenter.clone(),
    top: plankTop.clone(),
    foot: plankFoot.clone(),
  };
  fixedFrame.add(diagonalGuard);
  const railPosts = [];
  for (const z of [-drumWidth / 2 - 0.16, personCenterOfMass.z + 0.48]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 2.12, 0.14),
      frameMaterial,
    );
    post.position.set(
      handRailX,
      handRailY - 1.03,
      z,
    );
    post.userData.role = 'fixed-hand-rail-support';
    railPosts.push(post);
    fixedFrame.add(post);
  }
  // The rail runs from beyond the drum's far end ring, over the man's hands
  // and through the plank's hole, standing 0.03 proud of its front face.
  const railNearZ = plankZ + plankThickness / 2 + 0.03;
  const railFarZ = handRailStart.z;
  handRail.geometry.dispose();
  handRail.geometry = new THREE.CylinderGeometry(railRadius, railRadius, railNearZ - railFarZ, 32)
    .rotateX(Math.PI / 2)
    .translate(handRailX, handRailY, (railNearZ + railFarZ) / 2);

  const update = (time) => {
    const state = stateAtTime(time);
    wheelRotor.rotation.z = state.wheelAngle;
    for (let index = 0; index < legRoots.length; index += 1) {
      const leg = state.legStates[index];
      legRoots[index].rotation.z = leg.upperAngle;
      kneePivots[index].rotation.z = leg.lowerAngle;
      legs[index].geometry.userData.setBend(leg.lowerAngle);
      // A planted sole lies on its board (the ankle turns at most 59 degrees
      // then). In the air the sole's prescribed angle would turn the ankle
      // to 79 degrees; it is eased smoothly toward 63, as a real ankle
      // stops, so the shoe stays clear of the trouser cuff.
      const rawAnkle = Math.atan2(
        Math.sin(leg.soleAngle - leg.upperAngle - leg.lowerAngle),
        Math.cos(leg.soleAngle - leg.upperAngle - leg.lowerAngle),
      );
      const ankleRotation = rawAnkle <= ANKLE_EASE_START
        ? rawAnkle
        : ANKLE_EASE_START + ANKLE_EASE_SPAN
          * Math.tanh((rawAnkle - ANKLE_EASE_START) / ANKLE_EASE_SPAN);
      feet[index].rotation.z = ankleRotation;
      feet[index].position.set(-0.035, -0.05, 0).applyAxisAngle(Z_AXIS, ankleRotation);
      feet[index].position.y -= lowerLegLength;
    }
    root.userData.currentState = state;
    root.userData.weightDrive = {
      outputPower: state.outputPower,
      torque: state.personWeightTorque,
    };
  };

  root.userData = {
    archetype: movement.archetype,
    blocks: {
      arms,
      axle,
      base,
      bearing,
      cap,
      diagonalGuard,
      endGear,
      endRings,
      endSpokes,
      feet,
      fixedFrame,
      handRail,
      head,
      kneePivots,
      legRoots,
      outerLugs,
      pedestalPlank,
      person,
      railPosts,
      rearPedestal,
      torso,
      treadBoards,
      legs,
      wheelIndex,
      wheelRotor,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      input:
        'person stepping upward relative to the descending peripheral boards on the right side of the broad treadmill',
      note:
        'the end wheels, cross-width tread boards, and output axle are one rigid rotor; planted feet track individual boards and two-link legs follow the prescribed feet',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid broad drum, output axle, end rings, and fourteen peripheral boards',
        'person torso held at one mean world station; feet alternate planted board tracking with a prescribed outside swing, using two-link inverse kinematics',
        'mean relative climb exactly cancels descending tread velocity',
        'constant person mass and gravitational field',
        'steady resisting load balances person-weight torque so wheel speed is uniform',
      ],
      sourceSpecifiesDimensionsTimingTreadCountPersonMassOrLoad: false,
      treatment:
        'Brown supplies the external stepping principle and historical uses but no dimensions, speed, tread count, person mass, or load; the broad drum and gait are engineered, while rigid tread motion, mean climb balance, gravity torque, and output power are analytic',
    },
    fidelity: 'authored',
    geometry: {
      drumWidth,
      gaitAngularSpeed,
      gaitCyclesPerWheelTurn,
      gaitGeometry,
      figureScale: FIGURE_SCALE,
      upperLegLength,
      lowerLegLength,
      legPhaseOffsets,
      personCenterOfMass,
      personStationAngle,
      personStationPoint,
      treadCount,
      treadPitch,
      treadRadius,
      wheelCenter,
      wheelPeriod,
      wheelRadius,
      wheelStartAngle,
    },
    mechanism:
      'one-person-steps-up-the-right-hand-descending-side-of-one-broad-horizontal-axis-treadmill-whose-fourteen-cross-width-peripheral-boards-end-rings-and-output-shaft-form-one-rigid-rotor',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate377: {
        diagonalFrameBottom: new THREE.Vector2(416, 500),
        diagonalFrameTop: new THREE.Vector2(230, 38),
        endWheelCenter: new THREE.Vector2(168, 278),
        endWheelLeft: new THREE.Vector2(45, 279),
        endWheelTop: new THREE.Vector2(169, 146),
        handRailY: 106,
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 9,
        personHeadCenter: new THREE.Vector2(461, 89),
        personTorsoCenter: new THREE.Vector2(431, 215),
        treadFieldRight: 519,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'people turn the treadmill by their weight while stepping on peripheral tread boards',
          'the machine was used for penal labor and grinding grain',
          'Brown attributes the invention to China',
          'the same principle was still used in China to raise irrigation water',
        ],
        engravingEvidence:
          'the plate shows a broad field of cross-width peripheral steps, one braced end wheel and output axle at left, one person standing externally on the right side, a fixed handrail, and a diagonal fixed side frame',
        reconstructionDisclosure:
          'drum depth, fourteen tread boards with radial working faces, end-ring structure, supports, colors, speed, person mass, and tread-indexed gait are engineered because Brown gives no values and the official page has no canvas animation; finite sole placement is prescribed, while balance and muscle/contact forces remain unqualified',
      },
      officialPage: 'https://507movements.com/mm_377.html',
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      demonstrationPeriod: wheelPeriod,
      note:
        'one clockwise treadmill revolution returns fourteen peripheral boards and both end wheels to their starting pose and contains seven smooth closed gait cycles',
    },
    transmission: {
      meanNoDriftLaw:
        'the person climbing velocity relative to the wheel is equal and opposite to the descending tread velocity at the right-hand station',
      outputPower,
      outputTorque: personWeightTorque,
      personRelativeClimbSpeed,
      treadPassingFrequency: treadCount / wheelPeriod,
      weightTorqueLaw:
        'the right-of-axis person weight produces a negative Z torque, matching the clockwise wheel angular velocity and positive delivered power',
    },
  };

  correctRunnerTreadParts(root, 377);
  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.55, -2.25, -1.75),
    new THREE.Vector3(2.26, 2.18, 2.06),
  );
  root.userData.groundFloorY = -2.15;
  // A narrow field keeps the drum's boards and rail near-parallel, as the
  // plate draws them.
  root.userData.cameraFov = 20;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(5.6, 3.2, 8.8),
    root,
    update,
  };
}

export function createAuthoredPersonTreadmillMovement(movement) {
  if (movement.id !== 377) return null;
  return finishRunnerTread(externalPersonTreadmill(movement), 377);
}
