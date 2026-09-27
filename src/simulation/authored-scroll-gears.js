import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {circle, plate, poly, polygonClipping as clip} from './finite-plate-geometry.js';
import {involuteGearOutline} from './authored-parsons-racks.js';
import {PALETTE, markShadows, matte} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smootherStep(value) {
  const bounded = THREE.MathUtils.clamp(value, 0, 1);
  return bounded * bounded * bounded
    * (bounded * (bounded * 6 - 15) + 10);
}

function smootherStepDerivative(value) {
  const bounded = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * bounded * bounded
    * (bounded - 1) * (bounded - 1);
}

function smootherStepIntegral(value) {
  const bounded = THREE.MathUtils.clamp(value, 0, 1);
  return bounded ** 6 - 3 * bounded ** 5
    + 2.5 * bounded ** 4;
}

// One face tooth of scroll A: a prism running radially across its band (u
// from 0 at the band's inner edge to length at the outer edge). Its working
// part is straight-flanked about a pitch plane that falls outward to follow
// pinion B's taper; below the working depth it stands on straight sides, so
// the tooth is taller at the band's inner edge and never spreads into its
// neighbours.
function faceToothGeometry({length, pitchHalf, tan, pitchZ, addendum, dedendum}) {
  const tipHalf = pitchHalf - addendum * tan;
  const rootHalf = pitchHalf + dedendum * tan;
  const profile = (u) => {
    const zp = pitchZ(u);
    return [[-rootHalf, 0], [-rootHalf, zp - dedendum], [-tipHalf, zp + addendum],
      [tipHalf, zp + addendum], [rootHalf, zp - dedendum], [rootHalf, 0]];
  };
  const p0 = profile(0).map(([y, z]) => new THREE.Vector3(0, y, z));
  const p1 = profile(length).map(([y, z]) => new THREE.Vector3(length, y, z));
  const triangles = [];
  const n = p0.length;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    triangles.push([p0[i], p1[i], p1[j]], [p0[i], p1[j], p0[j]]);
  }
  for (let i = 1; i < n - 1; i += 1) triangles.push([p0[0], p0[i + 1], p0[i]], [p1[0], p1[i], p1[i + 1]]);
  const centroid = new THREE.Vector3(length / 2, 0, pitchZ(length / 2) / 2);
  const positions = [];
  const normal = new THREE.Vector3();
  for (const [a, b, c] of triangles) {
    normal.subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const ordered = normal.dot(new THREE.Vector3().subVectors(a, centroid)) < 0 ? [a, c, b] : [a, b, c];
    for (const v of ordered) positions.push(v.x, v.y, v.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function scrollGear(movement) {
  const root = new THREE.Group();
  // Timing: forward throw, dwell at the inner end, reverse throw, dwell.
  const cycleDuration = 12;
  const rampDuration = 0.9;
  const cruiseDuration = 3.2;
  const oneWayMotionDuration = rampDuration * 2 + cruiseDuration;
  const innerDwellDuration = 0.5;
  const outerDwellDuration = cycleDuration - 2 * oneWayMotionDuration - innerDwellDuration;
  const reverseStartTime = oneWayMotionDuration + innerDwellDuration;
  const outerDwellStartTime = reverseStartTime + oneWayMotionDuration;

  // Brown's scroll (measured on the plate at 60 px per unit): an Archimedean
  // band whose turns touch, band width = lead per turn = 25 px, wound
  // counterclockwise outward 2 3/8 turns from its inner end at 9 o'clock
  // (inner edge radius 48 px) to its cut outer end at half past four.
  const bandWidth = 25 / 60;
  const innerEdgeStart = 48 / 60;
  const innerEndAngle = Math.PI;
  const turns = 2.375;
  const outerEndAngle = innerEndAngle + turns * FULL_TURN;
  const spiralLeadPerRadian = bandWidth / FULL_TURN;
  const bandCenterRadius = (angle) => innerEdgeStart + bandWidth / 2
    + spiralLeadPerRadian * (angle - innerEndAngle);
  // Pinion B meshes at 6 o'clock on the band; the throw runs from the outer
  // turn (Brown's pose) inward until B sits a quarter turn short of the inner
  // end, where it still has a full band under it.
  const contactWorldAngle = -Math.PI / 2;
  const contactStartLocalAngle = outerEndAngle - Math.PI / 4; // 6 o'clock, unwrapped
  const contactStopLocalAngle = innerEndAngle + Math.PI / 2;
  const scrollSweep = contactStartLocalAngle - contactStopLocalAngle;
  // B's large end runs meshOffset outside the band centreline, 0.08 short
  // of the band's outer edge (the band curves away under B's ends); the
  // kinematic pitch spiral is the band centreline shifted out by that much.
  const meshOffset = bandWidth / 2 - 0.08;
  const scrollOuterRadius = bandCenterRadius(contactStartLocalAngle) + meshOffset;
  const scrollInnerRadius = bandCenterRadius(contactStopLocalAngle) + meshOffset;
  const spiralMaximumLocalAngle = contactStartLocalAngle;
  const spiralMinimumLocalAngle = contactStopLocalAngle;

  // Pinion B: 24 involute teeth, tapered with its small end toward A's centre
  // (as Brown draws it), the taper matching A's radial speed gradient at the
  // middle of the throw. Its face spans one band.
  const pinionTeeth = 24;
  const pinionPitchRadius = 0.72;
  const toothModule = 2 * pinionPitchRadius / pinionTeeth;
  const circularPitch = Math.PI * toothModule;
  // Short of the band width: the band curves away under B's ends.
  const pinionFaceLength = bandWidth - 0.1;
  // Brown's B narrows toward A's centre by about a sixth across its face
  // (80 to 94 px). It meshes at full depth at its large end; the flat face
  // teeth and the cone agree only there, the small end running shallower.
  const taperSlope = 0.3;
  const addendum = toothModule;
  const dedendum = 1.25 * toothModule;
  const pressureAngle = 20 * Math.PI / 180;
  const tan = Math.tan(pressureAngle);
  // A's band face is z = 0 and its pitch plane plateFaceZ; B's axis runs
  // one large-end pitch radius in front of that.
  const plateFaceZ = dedendum + 0.01;
  const pitchZ = () => plateFaceZ;
  const pinionAxisZ = plateFaceZ + pinionPitchRadius;

  const rolledDistance = scrollOuterRadius * scrollSweep
    - spiralLeadPerRadian * scrollSweep ** 2 / 2;
  const pinionMaximumAngle = rolledDistance / pinionPitchRadius;
  const cruisePinionAngularSpeed = pinionMaximumAngle
    / (cruiseDuration + rampDuration);
  const spiralRadiusAtPlateAngle = (plateAngle) =>
    scrollOuterRadius - spiralLeadPerRadian * plateAngle;
  const spiralLocalAngleAtPlateAngle = (plateAngle) =>
    contactWorldAngle - plateAngle;
  const plateAngleAtRolled = (distance) => (scrollOuterRadius
    - Math.sqrt(scrollOuterRadius ** 2 - 2 * spiralLeadPerRadian * distance)) / spiralLeadPerRadian;

  const scrollMaterial = matte(PALETTE.driven, {metalness: 0.12, roughness: 0.56});
  const pinionMaterial = matte(PALETTE.driver, {metalness: 0.16, roughness: 0.52});
  const steelMaterial = matte(PALETTE.ink, {metalness: 0.3, roughness: 0.45});

  // Scroll plate A: a web cut to the outline of its last turn, the raised
  // spiral band on it, the face teeth on the band, and a boss behind.
  const scrollRotor = new THREE.Group();
  scrollRotor.userData.role = 'variable-speed-scroll-plate-A-output-rotor';
  root.add(scrollRotor);
  const polar = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  const innerEdge = (a) => innerEdgeStart + spiralLeadPerRadian * (a - innerEndAngle);
  const samples = 600;
  const webPoints = [];
  for (let i = 0; i <= samples; i += 1) {
    const a = outerEndAngle - FULL_TURN + FULL_TURN * i / samples;
    webPoints.push(polar(innerEdge(a) + bandWidth, a));
  }
  const web = new THREE.Mesh(plate(poly(webPoints), -0.2, -0.06), scrollMaterial);
  web.userData.role = 'scroll-plate-A-web-cut-to-its-outer-turn';
  const bandPoints = [];
  const gap = 0.006;
  for (let i = 0; i <= samples * 2; i += 1) {
    const a = innerEndAngle + (outerEndAngle - innerEndAngle) * i / (samples * 2);
    bandPoints.push(polar(innerEdge(a) + bandWidth - gap, a));
  }
  for (let i = samples * 2; i >= 0; i -= 1) {
    const a = innerEndAngle + (outerEndAngle - innerEndAngle) * i / (samples * 2);
    bandPoints.push(polar(innerEdge(a), a));
  }
  const spiralRail = new THREE.Mesh(plate(poly(bandPoints), -0.06, 0), scrollMaterial);
  spiralRail.userData.role = 'single-finite-archimedean-scroll-band-on-plate-A';
  // A bored boss behind the web, keyed to the shaft that runs through it.
  const scrollHub = new THREE.Mesh(plate(clip.difference(poly(circle([0, 0], 0.34, 96)), poly(circle([0, 0], 0.154, 96))), -0.4, -0.2), scrollMaterial);
  scrollHub.userData.role = 'scroll-plate-A-boss-behind';
  const scrollShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.76, 40).rotateX(Math.PI / 2), steelMaterial);
  scrollShaft.position.z = -0.6;
  scrollShaft.userData.role = 'scroll-plate-A-output-shaft';
  scrollRotor.add(web, spiralRail, scrollHub, scrollShaft);

  // Face teeth, one per circular pitch of B along the band centreline,
  // counted from Brown's contact point (a tooth there at the start).
  const toothLength = bandWidth - gap - 0.012;
  const toothGeometry = faceToothGeometry({length: toothLength, pitchHalf: circularPitch * 0.24, tan,
    pitchZ: (u) => pitchZ(u + 0.006), addendum: addendum * 0.9, dedendum: addendum});
  const teethGeometries = [];
  const scrollTeeth = [];
  const margin = circularPitch * 0.4;
  for (let k = -40; k < 400; k += 1) {
    const theta = plateAngleAtRolled(k * circularPitch);
    if (!Number.isFinite(theta)) continue;
    const local = contactStartLocalAngle - theta;
    // Keep whole teeth on the band between its two ends.
    const r = bandCenterRadius(local) + meshOffset;
    if (local - margin / r < innerEndAngle || local + margin / r > outerEndAngle) continue;
    const g = toothGeometry.clone();
    g.translate(r - meshOffset - bandWidth / 2 + 0.006, 0, 0);
    g.rotateZ(local);
    teethGeometries.push(g);
    scrollTeeth.push({index: k, localAngle: local, radius: r});
  }
  const teethMesh = new THREE.Mesh(mergeGeometries(teethGeometries), scrollMaterial);
  teethGeometries.forEach((g) => g.dispose());
  toothGeometry.dispose();
  teethMesh.userData.role = 'scroll-plate-A-face-teeth-along-the-band';
  scrollRotor.add(teethMesh);

  // Input shaft with its feather, and pinion B sliding on it.
  const pinionShaftRotor = new THREE.Group();
  pinionShaftRotor.position.z = pinionAxisZ;
  pinionShaftRotor.userData.role = 'uniform-input-feathered-radial-pinion-shaft';
  root.add(pinionShaftRotor);
  const shaftRadius = 0.15;
  const pinionShaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftRadius, shaftRadius, 7.5, 48), steelMaterial);
  pinionShaft.position.y = -0.5;
  pinionShaft.userData.role = 'long-radial-pinion-input-shaft';
  pinionShaftRotor.add(pinionShaft);
  const featherTop = -0.55;
  const featherBottom = -(scrollOuterRadius + bandWidth / 2) - 0.25;
  const shaftFeather = new THREE.Mesh(new THREE.BoxGeometry(0.07, featherTop - featherBottom, 0.06), steelMaterial);
  shaftFeather.position.set(0, (featherTop + featherBottom) / 2, shaftRadius + 0.02);
  shaftFeather.userData.role = 'longitudinal-feather-key-on-input-shaft';
  pinionShaftRotor.add(shaftFeather);

  const slidingPinion = new THREE.Group();
  slidingPinion.userData.role = 'pinion-B-sliding-axially-on-shaft-feather';
  pinionShaftRotor.add(slidingPinion);
  // Built along local z (small end at -z), scaled for the taper, then turned
  // so local z runs down the shaft (world -y): the large end lies outward.
  const outline = involuteGearOutline({teeth: pinionTeeth, module: toothModule, pressureAngle,
    tipRadius: pinionPitchRadius + addendum, rootRadius: pinionPitchRadius - dedendum,
    pitchThickness: circularPitch * 0.48});
  // A tooth space faces A (world -z) at zero input angle.
  const spin = -Math.PI / 2 - Math.PI / pinionTeeth;
  const rotated = outline.map(([x, y]) => [x * Math.cos(spin) - y * Math.sin(spin), x * Math.sin(spin) + y * Math.cos(spin)]);
  const bore = clip.union(poly(circle([0, 0], shaftRadius + 0.006, 96)),
    poly([[-0.045, 0], [0.045, 0], [0.045, shaftRadius + 0.06], [-0.045, shaftRadius + 0.06]].map(([x, y]) => [x, y])));
  // Local +y becomes world +z after the turn below, so the keyway faces the feather.
  const pinionGeometry = plate(clip.difference(poly(rotated), bore), -pinionFaceLength / 2, pinionFaceLength / 2);
  const position = pinionGeometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i), r = Math.hypot(x, y);
    if (r < 0.3) continue;
    const f = 1 + (z - pinionFaceLength / 2) * taperSlope / pinionPitchRadius;
    position.setXY(i, x * f, y * f);
  }
  pinionGeometry.computeVertexNormals();
  pinionGeometry.rotateX(Math.PI / 2);
  const pinionBody = new THREE.Mesh(pinionGeometry, pinionMaterial);
  pinionBody.userData.role = 'tapered-involute-sliding-pinion-B';
  slidingPinion.add(pinionBody);
  const hubRadius = 0.46;
  const hubGeometry = plate(clip.difference(poly(circle([0, 0], hubRadius, 96)), bore), 0, 0.09).rotateX(Math.PI / 2);
  const pinionHub = new THREE.Mesh(hubGeometry, pinionMaterial);
  pinionHub.position.y = -pinionFaceLength / 2;
  pinionHub.userData.role = 'pinion-B-hub-collar-with-keyway';
  slidingPinion.add(pinionHub);

  function inputStateAtTime(cycleTime) {
    const rampDisplacement = cruisePinionAngularSpeed
      * rampDuration / 2;
    const cruiseStartAngle = rampDisplacement;
    const decelerationStartAngle = cruiseStartAngle
      + cruisePinionAngularSpeed * cruiseDuration;
    if (cycleTime < rampDuration) {
      const unitTime = cycleTime / rampDuration;
      return {
        acceleration: cruisePinionAngularSpeed
          * smootherStepDerivative(unitTime) / rampDuration,
        angle: cruisePinionAngularSpeed * rampDuration
          * smootherStepIntegral(unitTime),
        speed: cruisePinionAngularSpeed * smootherStep(unitTime),
        stage: 'forward-smooth-start',
      };
    }
    if (cycleTime < rampDuration + cruiseDuration) {
      const elapsed = cycleTime - rampDuration;
      return {
        acceleration: 0,
        angle: cruiseStartAngle + cruisePinionAngularSpeed * elapsed,
        speed: cruisePinionAngularSpeed,
        stage: 'forward-uniform-input-increasing-output-speed',
      };
    }
    if (cycleTime < oneWayMotionDuration) {
      const elapsed = cycleTime - rampDuration - cruiseDuration;
      const unitTime = elapsed / rampDuration;
      return {
        acceleration: -cruisePinionAngularSpeed
          * smootherStepDerivative(unitTime) / rampDuration,
        angle: decelerationStartAngle
          + cruisePinionAngularSpeed * rampDuration
            * (unitTime - smootherStepIntegral(unitTime)),
        speed: cruisePinionAngularSpeed * (1 - smootherStep(unitTime)),
        stage: 'forward-smooth-stop-at-inner-end',
      };
    }
    if (cycleTime < reverseStartTime) {
      return {
        acceleration: 0,
        angle: pinionMaximumAngle,
        speed: 0,
        stage: 'stationary-inner-end-reversal-dwell',
      };
    }
    const reverseTime = cycleTime - reverseStartTime;
    if (reverseTime < rampDuration) {
      const unitTime = reverseTime / rampDuration;
      return {
        acceleration: -cruisePinionAngularSpeed
          * smootherStepDerivative(unitTime) / rampDuration,
        angle: pinionMaximumAngle
          - cruisePinionAngularSpeed * rampDuration
            * smootherStepIntegral(unitTime),
        speed: -cruisePinionAngularSpeed * smootherStep(unitTime),
        stage: 'reverse-smooth-start',
      };
    }
    if (reverseTime < rampDuration + cruiseDuration) {
      const elapsed = reverseTime - rampDuration;
      return {
        acceleration: 0,
        angle: pinionMaximumAngle - cruiseStartAngle
          - cruisePinionAngularSpeed * elapsed,
        speed: -cruisePinionAngularSpeed,
        stage: 'reverse-uniform-input-decreasing-output-speed',
      };
    }
    if (cycleTime < outerDwellStartTime) {
      const elapsed = reverseTime - rampDuration - cruiseDuration;
      const unitTime = elapsed / rampDuration;
      return {
        acceleration: cruisePinionAngularSpeed
          * smootherStepDerivative(unitTime) / rampDuration,
        angle: pinionMaximumAngle - decelerationStartAngle
          - cruisePinionAngularSpeed * rampDuration
            * (unitTime - smootherStepIntegral(unitTime)),
        speed: -cruisePinionAngularSpeed
          * (1 - smootherStep(unitTime)),
        stage: 'reverse-smooth-stop-at-outer-end',
      };
    }
    return {
      acceleration: 0,
      angle: 0,
      speed: 0,
      stage: 'stationary-outer-end-cycle-dwell',
    };
  }

  function stateAtTime(time) {
    const cycleTime = positiveModulo(time, cycleDuration);
    const input = inputStateAtTime(cycleTime);
    const discriminant = Math.max(
      0,
      scrollOuterRadius ** 2
        - 2 * spiralLeadPerRadian
          * pinionPitchRadius * input.angle,
    );
    const contactRadius = Math.sqrt(discriminant);
    const plateAngle = (
      scrollOuterRadius - contactRadius
    ) / spiralLeadPerRadian;
    const plateAngularSpeed = pinionPitchRadius * input.speed
      / contactRadius;
    const plateAngularAcceleration = (
      pinionPitchRadius * input.acceleration
        + spiralLeadPerRadian * plateAngularSpeed ** 2
    ) / contactRadius;
    const contactRadiusSpeed = -spiralLeadPerRadian
      * plateAngularSpeed;
    const contactRadiusAcceleration = -spiralLeadPerRadian
      * plateAngularAcceleration;
    // B's large end sits on the pitch spiral; its face runs inward from there.
    const pinionCenterY = -contactRadius + pinionFaceLength / 2;
    const pinionSlideSpeed = -contactRadiusSpeed;
    const pinionSlideAcceleration = -contactRadiusAcceleration;
    const spiralLocalAngle = spiralLocalAngleAtPlateAngle(plateAngle);
    const spiralLocalContact = new THREE.Vector3(
      Math.cos(spiralLocalAngle) * contactRadius,
      Math.sin(spiralLocalAngle) * contactRadius,
      plateFaceZ,
    );
    const spiralWorldContact = spiralLocalContact.clone()
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), plateAngle);
    const pitchContact = new THREE.Vector3(
      0,
      -contactRadius,
      plateFaceZ,
    );
    const pinionPitchLineSpeed = pinionPitchRadius * input.speed;
    const platePitchLineSpeed = contactRadius * plateAngularSpeed;
    const integratedRollingResidual = pinionPitchRadius * input.angle
      - (scrollOuterRadius * plateAngle
        - spiralLeadPerRadian * plateAngle ** 2 / 2);
    const accelerationConstraintResidual = pinionPitchRadius
      * input.acceleration
      - (contactRadius * plateAngularAcceleration
        - spiralLeadPerRadian * plateAngularSpeed ** 2);
    return {
      accelerationConstraintResidual,
      contactRadius,
      contactRadiusAcceleration,
      contactRadiusSpeed,
      cyclePhase: cycleTime / cycleDuration,
      cycleTime,
      instantaneousOutputToInputRatio:
        pinionPitchRadius / contactRadius,
      integratedRollingResidual,
      pinionAngle: input.angle,
      pinionAngularAcceleration: input.acceleration,
      pinionAngularSpeed: input.speed,
      pinionCenterY,
      pinionPitchLineSpeed,
      pinionSlideAcceleration,
      pinionSlideSpeed,
      pitchContact,
      pitchLineSpeedResidual:
        platePitchLineSpeed - pinionPitchLineSpeed,
      plateAngle,
      plateAngularAcceleration,
      plateAngularSpeed,
      platePitchLineSpeed,
      spiralLocalAngle,
      spiralLocalContact,
      spiralRadiusResidual:
        contactRadius - spiralRadiusAtPlateAngle(plateAngle),
      spiralWorldContact,
      stage: input.stage,
    };
  }

  function update(time) {
    const state = stateAtTime(time);
    scrollRotor.rotation.z = state.plateAngle;
    // Rolling at the lower contact: A's face moves +x, so B turns about -y.
    pinionShaftRotor.rotation.y = -state.pinionAngle;
    slidingPinion.position.y = state.pinionCenterY;
    root.userData.kinematics = state;
  }

  const geometry = {
    bandWidth, circularPitch, contactWorldAngle, contactStartLocalAngle, cruiseDuration, cruisePinionAngularSpeed,
    cycleDuration, innerDwellDuration, innerEdgeStart, innerEndAngle, outerDwellDuration, outerEndAngle,
    pinionAxisZ, pinionFaceLength, pinionMaximumAngle, pinionPitchRadius, pinionTeeth, plateFaceZ,
    rampDuration, reverseStartTime, rolledDistance, scrollInnerRadius, scrollOuterRadius, scrollSweep,
    scrollToothCount: scrollTeeth.length, spiralLeadPerRadian, spiralMaximumLocalAngle, spiralMinimumLocalAngle,
    taperSlope, toothModule, turns, mechanismCyclePeriod: cycleDuration,
  };
  root.userData = {
    archetype: movement.archetype,
    fidelity: 'authored',
    blocks: {pinionBody, pinionHub, pinionShaft, pinionShaftRotor, scrollHub, scrollRotor, scrollShaft,
      shaftFeather, slidingPinion, spiralRail, teethMesh, web, workingScrollTeeth: [teethMesh]},
    geometry,
    scrollTeeth,
    motion: {cycleDuration, innerDwellDuration, oneWayMotionDuration, outerDwellDuration, reverseStartTime},
    mechanism: 'Uniform rotation of the radial shaft drives pinion B through its feather while B slides along it; B rolls on the Archimedean face scroll of plate A, so as the contact runs inward the plate speeds up (gain r_B/contact radius), and on reversal it runs outward and slows.',
    transmission: {
      integratedRollingConstraint: 'pinionRadius*pinionAngle=outerRadius*plateAngle-(lead/2)*plateAngle^2',
      instantaneousSpeedConstraint: 'pinionRadius*pinionSpeed=contactRadius*plateSpeed',
      scrollConstraint: 'contact radius=outer radius-lead*plate angle',
    },
    reconstructionNote: 'Scroll proportions measured on Brown\'s plate: touching turns, 2 3/8 turns, inner end at 9 o\'clock, outer end cut at half past four. B is a 24-tooth involute pinion tapered toward A\'s centre; its taper matches the plate\'s radial speed gradient only at mid-throw, so off that radius the face mesh relies on backlash (straight-flanked face teeth, 0.16 pitch play). Motion, the feather slide and the reversals are prescribed; loads are not modelled.',
    sourceAnimation: {available: false, officialPage: movement.sourceUrl},
    stateAtTime,
    update,
  };
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = cycleDuration;
  root.userData.cameraDirection = new THREE.Vector3(0, 0, 1);
  markShadows(root);
  root.traverse((o) => { for (const m of [].concat(o.material ?? [])) m.fog = false; });
  update(0);
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scrollRotor);
  bounds.expandByPoint(new THREE.Vector3(0, 3.2, 0)).expandByPoint(new THREE.Vector3(0, -4.2, 0));
  root.userData.cameraFitBounds = bounds.expandByScalar(0.05);
  root.userData.cameraDistanceScale = 1.02;
  return {cameraDirection: root.userData.cameraDirection, root, update};
}

export function createAuthoredScrollGearMovement(movement) {
  if (movement.id !== 414) return null;
  return scrollGear(movement);
}
