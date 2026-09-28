import * as THREE from 'three';
import {installWeightedRackSelector, selectorGeometry, selectorState} from './weighted-rack-selector-contact.js';
import {plate, capsule, circle, poly, polygonClipping as clip} from './finite-plate-geometry.js';
import { correctWeightedRackInterfaces, correctWeightedRackTeeth, finishAlternatingDrive } from './alternating-drive-finite-parts.js';
import {
  PALETTE,
  makeDynamicLink,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

// C's fixed pivot, relative to A1's upper guide corner (pass 91). It stands
// above guide b's top, and from there the roller on A1's diagonal protrusion
// meets C's curved arm over the last 0.86 of A1's working rise.
const ELBOW_PIVOT_FROM_CORNER = [-0.12, 1.63];
function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function wrappedSignedAngle(angle) {
  const wrapped = positiveModulo(angle + Math.PI, FULL_TURN) - Math.PI;
  return Math.abs(wrapped + Math.PI) < 1e-14 ? Math.PI : wrapped;
}

function quinticState(parameter) {
  const u = THREE.MathUtils.clamp(parameter, 0, 1);
  return {
    acceleration: 60 * u * (1 - u) * (1 - 2 * u),
    rate: 30 * u ** 2 * (1 - u) ** 2,
    value: u ** 3 * (10 + u * (-15 + 6 * u)),
  };
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function centeredExtrusion(shape, depth, bevelSize = 0.006) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevelSize > 0,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 12,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function makeSpurGear({
  depth,
  material,
  pitchRadius,
  toothCount,
  toothHeight,
  whiteMaterial,
  darkMaterial,
}) {
  const rotor = new THREE.Group();
  rotor.userData.role =
    'continuous-counterclockwise-fixed-axis-output-cog-wheel';
  const angularPitch = FULL_TURN / toothCount;
  const rootRadius = pitchRadius - toothHeight / 2;
  const outerRadius = pitchRadius + toothHeight / 2;
  const shape = new THREE.Shape();
  let first = true;
  for (let tooth = 0; tooth < toothCount; tooth += 1) {
    for (const [offset, radius] of [
      [-0.50, rootRadius],
      [-0.27, outerRadius],
      [0.27, outerRadius],
      [0.50, rootRadius],
    ]) {
      const angle = (tooth + offset) * angularPitch;
      const point = new THREE.Vector2(
        radius * Math.cos(angle),
        radius * Math.sin(angle),
      );
      if (first) {
        shape.moveTo(point.x, point.y);
        first = false;
      } else shape.lineTo(point.x, point.y);
    }
  }
  shape.closePath();
  const wheel = new THREE.Mesh(
    centeredExtrusion(shape, depth, 0.008),
    material,
  );
  wheel.userData.role = 'twenty-tooth-output-cog-wheel-body';
  rotor.add(wheel);

  const hub = cylinderAlongZ(0.22, depth * 1.48, darkMaterial, 36);
  hub.userData.role = 'output-cog-wheel-hub-fast-on-shaft';
  rotor.add(hub);
  const faceRing = new THREE.Mesh(
    new THREE.TorusGeometry(pitchRadius * 0.54, 0.045, 10, 64),
    darkMaterial,
  );
  faceRing.position.z = depth / 2 + 0.015;
  faceRing.userData.role = 'output-wheel-face-reference-ring';
  rotor.add(faceRing);
  // Plate ink, not a separate part.
  faceRing.visible = false;
  faceRing.userData.retiredInkOutline = true;
  const shaft = cylinderAlongZ(0.105, 1.12, darkMaterial, 28);
  shaft.userData.role = 'fixed-axis-output-shaft';
  rotor.add(shaft);

  const spinIndex = new THREE.Mesh(
    new THREE.BoxGeometry(pitchRadius * 0.62, 0.060, 0.035),
    whiteMaterial,
  );
  spinIndex.position.set(pitchRadius * 0.34, 0, depth / 2 + 0.065);
  spinIndex.userData.role =
    'white-index-making-continuous-output-rotation-legible';
  rotor.add(spinIndex);

  rotor.userData.angularPitch = angularPitch;
  rotor.userData.outerRadius = outerRadius;
  rotor.userData.pitchRadius = pitchRadius;
  rotor.userData.rootRadius = rootRadius;
  rotor.userData.shaft = shaft;
  rotor.userData.spinIndex = spinIndex;
  rotor.userData.toothCount = toothCount;
  rotor.userData.wheel = wheel;
  return markShadows(rotor);
}

function makeRack({
  bodyLength,
  bodyMaterial,
  bodyWidth,
  circularPitch,
  darkMaterial,
  depth,
  guideArm,
  guideY,
  side,
  toothCount,
  toothHeight,
  toothMaterial,
  whiteMaterial,
}) {
  const rack = new THREE.Group();
  const name = side < 0 ? 'left-rack-A' : 'right-rack-A1';
  rack.userData.role = `${name}-weighted-pivoted-rack`;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth, bodyLength, depth),
    bodyMaterial,
  );
  body.position.y = bodyLength / 2;
  body.userData.role = `${name}-straight-bar`;
  rack.add(body);

  const inward = -side;
  const rootX = inward * bodyWidth / 2;
  const tipX = inward * (bodyWidth / 2 + toothHeight);
  const toothShape = new THREE.Shape();
  toothShape.moveTo(rootX, -circularPitch * 0.42);
  toothShape.lineTo(tipX, -circularPitch * 0.20);
  toothShape.lineTo(tipX, circularPitch * 0.20);
  toothShape.lineTo(rootX, circularPitch * 0.42);
  toothShape.closePath();
  const toothGeometry = centeredExtrusion(toothShape, depth * 0.94, 0.004);
  const teeth = [];
  for (let toothIndex = 0; toothIndex < toothCount; toothIndex += 1) {
    const tooth = new THREE.Mesh(toothGeometry, toothMaterial);
    tooth.position.y = 0.24 + toothIndex * circularPitch;
    tooth.userData.materialToothIndex = toothIndex;
    tooth.userData.pitch = circularPitch;
    tooth.userData.role = `${name}-inward-facing-working-tooth`;
    rack.add(tooth);
    teeth.push(tooth);
  }

  // Each arm is one flat bar with round ends concentric with its pins.
  const flatArm = (from, to) => {
    const arm = new THREE.Group();
    const bar = new THREE.Mesh(plate(capsule(from, to, 0.0525, 32), -depth * 0.36, depth * 0.36), bodyMaterial);
    arm.add(bar);
    return arm;
  };
  const guideArmLink = flatArm([0, guideY], [side * guideArm, guideY]);
  guideArmLink.userData.role = `${name}-rigid-outward-guide-arm`;
  rack.add(guideArmLink);

  const guidePin = cylinderAlongZ(0.115, 1.05, darkMaterial, 28);
  guidePin.position.set(side * guideArm, guideY, 0);
  guidePin.userData.role = `${name}-pin-running-in-fixed-guide-groove-b`;
  rack.add(guidePin);
  const guidePinIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.135, 20, 12),
    whiteMaterial,
  );
  guidePinIndex.position.set(side * guideArm, guideY, depth / 2 + 0.36);
  guidePinIndex.userData.role = `${name}-white-guide-pin-index`;
  rack.add(guidePinIndex);

  const pivotBoss = cylinderAlongZ(0.20, depth * 1.38, bodyMaterial, 32);
  pivotBoss.userData.role = `${name}-lower-pivot-boss-a`;
  rack.add(pivotBoss);
  const pivotBore = cylinderAlongZ(0.085, depth * 1.66, darkMaterial, 24);
  pivotBore.userData.role = `${name}-lower-pivot-pin-a`;
  rack.add(pivotBore);

  // The unequal-looking lower arms follow the source plate: A has its
  // conspicuous weight outboard; A1's ball lies inboard of its lower pivot.
  const weightX = side < 0 ? -1.02 : -0.91;
  const weightArm = flatArm([0, 0.02], [weightX, 0.02]);
  weightArm.userData.role = `${name}-lower-weight-arm`;
  rack.add(weightArm);
  const weight = new THREE.Mesh(
    new THREE.SphereGeometry(0.30, 28, 18),
    bodyMaterial,
  );
  weight.position.set(weightX, 0.02, 0);
  weight.userData.role = `${name}-gravity-bias-weight`;
  rack.add(weight);

  const toothPhaseIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, circularPitch * 0.76, 0.035),
    whiteMaterial,
  );
  toothPhaseIndex.position.set(
    inward * (bodyWidth / 2 + toothHeight * 0.54),
    1.71,
    depth / 2 + 0.055,
  );
  toothPhaseIndex.userData.role = `${name}-white-rack-pitch-index`;
  rack.add(toothPhaseIndex);

  rack.userData.body = body;
  rack.userData.guideArm = guideArmLink;
  rack.userData.guidePin = guidePin;
  rack.userData.guidePinIndex = guidePinIndex;
  rack.userData.guidePinLocal = new THREE.Vector2(side * guideArm, guideY);
  rack.userData.pivotBoss = pivotBoss;
  rack.userData.pivotBore = pivotBore;
  rack.userData.side = side;
  rack.userData.teeth = teeth;
  rack.userData.toothPhaseIndex = toothPhaseIndex;
  rack.userData.weight = weight;
  rack.userData.weightArm = weightArm;
  return markShadows(rack);
}

class GuidePinCurve extends THREE.Curve {
  constructor(pointAtPhase, z) {
    super();
    this.pointAtPhase = pointAtPhase;
    this.z = z;
  }

  getPoint(parameter, target = new THREE.Vector3()) {
    const point = this.pointAtPhase(positiveModulo(parameter, 1));
    return target.set(point.x, point.y, this.z);
  }

  getPointAt(parameter, target = new THREE.Vector3()) {
    return this.getPoint(parameter, target);
  }
}

function makeGuideGroove({
  centerline,
  darkMaterial,
  frameMaterial,
  role,
}) {
  const guide = new THREE.Group();
  guide.userData.role = role;
  const casting = new THREE.Mesh(
    new THREE.TubeGeometry(centerline, 192, 0.155, 12, true),
    frameMaterial,
  );
  casting.userData.role = `${role}-fixed-cast-surround`;
  guide.add(casting);
  const slot = new THREE.Mesh(
    new THREE.TubeGeometry(centerline, 192, 0.068, 10, true),
    darkMaterial,
  );
  slot.position.z = 0.045;
  slot.userData.role = `${role}-dark-running-slot-centerline`;
  guide.add(slot);
  guide.userData.casting = casting;
  guide.userData.centerline = centerline;
  guide.userData.slot = slot;
  return markShadows(guide);
}

function makeDynamicCoilSpring(material, turns = 10) {
  // A solid close-wound coil built once along +X over unit length and
  // stretched between its end points, with straight end legs to its hooks.
  const coilRadius = 0.07;
  const wireRadius = 0.018;
  const legFraction = 0.08;
  const points = [new THREE.Vector3(0, 0, 0)];
  const samples = turns * 24;
  for (let index = 0; index <= samples; index += 1) {
    const u = index / samples;
    const phase = turns * FULL_TURN * u;
    points.push(new THREE.Vector3(
      legFraction + (1 - 2 * legFraction) * u,
      coilRadius * Math.sin(phase),
      coilRadius * Math.cos(phase),
    ));
  }
  points.push(new THREE.Vector3(1, 0, 0));
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const spring = new THREE.Mesh(
    new THREE.TubeGeometry(curve, samples + 24, wireRadius, 8, false),
    material,
  );
  spring.userData.role = 'tension-spring-d-returning-elbow-lever-C';
  spring.userData.setEndpoints = (start, end) => {
    const delta = end.clone().sub(start);
    const length = delta.length();
    spring.position.copy(start);
    spring.quaternion.setFromUnitVectors(
      new THREE.Vector3(1, 0, 0),
      delta.clone().multiplyScalar(1 / Math.max(length, 1e-12)),
    );
    spring.scale.set(length, 1, 1);
    spring.userData.currentLength = length;
    spring.userData.end = end.clone();
    spring.userData.start = start.clone();
  };
  return spring;
}

function alternatingWeightedRackDrive(movement) {
  const root = new THREE.Group();

  // Brown's page provides an engraving and description but no animation.
  // The working/return branches are therefore reconstructed as exact traces
  // of rigid rack guide pins.  Zero-velocity dwells at the two guide corners
  // let the rack pair exchange mesh without tooth interference.
  const cycleDuration = 8;
  // One quintic rise and one quintic fall: the racks exchange on the guide
  // arcs while the piston moves, not in separate dwells.
  const ascentEnd = 0.5;
  const topCrossoverEnd = 0.5;
  const descentEnd = 1;
  const pinionPitchRadius = 0.78;
  const pinionToothCount = 20;
  const pinionAngularPitch = FULL_TURN / pinionToothCount;
  const circularPitch = pinionPitchRadius * pinionAngularPitch;
  // Brown's guides stand about 2.15 gear tip diameters tall; a 13-pitch
  // stroke (1.3 wheel turns, 26 teeth, per cycle) brings the grooves to that
  // height. The crosshead's low point drops by the extra pitches and the
  // racks gain as many teeth at their lower ends, while the guide pins sit
  // that much higher on the racks: at the bottom corner everything above
  // the crosshead stands where it did, and the grooves grow upward.
  const extraStrokePitches = 3;
  const stroke = (10 + extraStrokePitches) * circularPitch;
  const outputAdvancePerCycle = 2 * stroke / pinionPitchRadius;
  const rackPitchesPerStroke = stroke / circularPitch;
  const rackRootExtension = .60;
  const crossheadLowY = -3.265-rackRootExtension
    - extraStrokePitches * circularPitch;
  const crossheadHighY = crossheadLowY + stroke;
  const rackPivotHalfSpacing = pinionPitchRadius + 0.26;
  const rackBodyLength = 3.63+rackRootExtension
    + extraStrokePitches * circularPitch;
  const rackBodyWidth = 0.26;
  const rackDepth = 0.37;
  const rackToothHeight = 0.26;
  const rackToothCount = 14 + extraStrokePitches;
  const guideArm = 0.68;
  const guideY = 3.35+rackRootExtension
    + extraStrokePitches * circularPitch;
  const outwardRackAngle = 0.17;
  const guidePlaneZ = -0.34;
  const rackPlaneZ = 0.12;
  const gearPlaneZ = 0.18;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.58,
  });
  const driverDarkMaterial = matte(0xb94531, {
    metalness: 0.17,
    roughness: 0.52,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.55,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.67,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.46,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.22,
    roughness: 0.49,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0,
    roughness: 0.42,
  });

  // Guide grooves b (pass 91). Each groove is Brown's: two straight vertical
  // branches, the inner one where the rack stands upright in mesh and the
  // outer one where it hangs out of mesh at outwardRackAngle, joined by an
  // arc at two opposite corners. The pin locus is written in pin space, and
  // the rack angle at any piston height follows from it exactly.
  //  - Upper arc (outer corner): tangent to the outer branch, it rises
  //    inward to a sharp corner at the top of the inner branch. Near the
  //    corner it runs a large-radius arc (radius 1/topCornerCurvature)
  //    leaving the corner along the rack's own swing about its pivot at the
  //    top of the stroke, then a fillet bends it down into the outer branch.
  //    Rack A rises on its outer branch and this arc's outer wall cams it
  //    upright as it rises; it lands in the corner, in mesh, at the top of
  //    the stroke. A1 leaves the same corner as it starts down, carried over
  //    the angle by C. Near the corner the piston hardly moves while the
  //    racks swing, so entering and leaving teeth stay within the flank
  //    clearance of the pinion.
  //  - Lower arc (inner corner): tangent to the inner branch, it falls
  //    outward to a sharp corner at the foot of the outer branch, meeting it
  //    at bottomCornerAngle below horizontal. A's outboard weight swings it
  //    out along this arc as it descends; A1's inboard weight swings it in
  //    along it as it rises.
  const topCornerCurvature = 0.4;
  const topCornerSwing = 0.105;
  const bottomCornerAngle = 20 * Math.PI / 180;
  const pinXAt = (angle) => rackPivotHalfSpacing + guideArm * Math.cos(angle)
    + guideY * Math.sin(angle);
  const pinYAt = (angle, crossheadY) => crossheadY + guideY * Math.cos(angle)
    - guideArm * Math.sin(angle);
  const innerBranchX = pinXAt(0);
  const outerBranchX = pinXAt(outwardRackAngle);
  const guideArcs = (() => {
    const corner = new THREE.Vector2(innerBranchX, pinYAt(0, crossheadHighY));
    const swingTangent = new THREE.Vector2(guideY, -guideArm).normalize();
    const cornerRadius = 1 / topCornerCurvature;
    const cornerCentre = corner.clone().addScaledVector(
      new THREE.Vector2(swingTangent.y, -swingTangent.x), cornerRadius);
    const filletStartX = pinXAt(topCornerSwing);
    const filletStartY = cornerCentre.y
      + Math.sqrt(cornerRadius ** 2 - (filletStartX - cornerCentre.x) ** 2);
    const towardCornerCentre = new THREE.Vector2(
      cornerCentre.x - filletStartX, cornerCentre.y - filletStartY,
    ).divideScalar(cornerRadius);
    const filletRadius = (outerBranchX - filletStartX)
      / (1 + towardCornerCentre.x);
    const filletCentre = new THREE.Vector2(filletStartX, filletStartY)
      .addScaledVector(towardCornerCentre, filletRadius);
    const upperY = (x) => (x <= filletStartX
      ? cornerCentre.y + Math.sqrt(Math.max(0, cornerRadius ** 2
        - (x - cornerCentre.x) ** 2))
      : filletCentre.y + Math.sqrt(Math.max(0, filletRadius ** 2
        - (x - filletCentre.x) ** 2)));
    const lowerCorner = new THREE.Vector2(outerBranchX,
      pinYAt(outwardRackAngle, crossheadLowY));
    const width = outerBranchX - innerBranchX;
    const lowerRadius = width / (1 - Math.sin(bottomCornerAngle));
    const lowerCentre = new THREE.Vector2(innerBranchX + lowerRadius,
      lowerCorner.y + Math.sqrt(lowerRadius ** 2 - (width - lowerRadius) ** 2));
    const lowerY = (x) => lowerCentre.y - Math.sqrt(Math.max(0,
      lowerRadius ** 2 - (x - lowerCentre.x) ** 2));
    // Piston height at which the pin, at rack angle a, lies on each arc.
    const upperCrossheadY = (angle) => upperY(pinXAt(angle))
      - guideY * Math.cos(angle) + guideArm * Math.sin(angle);
    const lowerCrossheadY = (angle) => lowerY(pinXAt(angle))
      - guideY * Math.cos(angle) + guideArm * Math.sin(angle);
    // Both are strictly decreasing in the angle; invert by bisection.
    const invert = (crossheadYAt, crossheadY) => {
      let low = 0;
      let high = outwardRackAngle;
      for (let index = 0; index < 64; index += 1) {
        const middle = (low + high) / 2;
        if (crossheadYAt(middle) > crossheadY) low = middle;
        else high = middle;
      }
      return (low + high) / 2;
    };
    const upperArcFoot = upperCrossheadY(outwardRackAngle);
    const lowerArcHead = lowerCrossheadY(0);
    return {
      corner,
      cornerCentre,
      cornerRadius,
      filletCentre,
      filletRadius,
      lowerArcHead,
      lowerCentre,
      lowerCorner,
      lowerRadius,
      upperArcFoot,
      upperAngle: (crossheadY) => (crossheadY >= crossheadHighY ? 0
        : crossheadY <= upperArcFoot ? outwardRackAngle
          : invert(upperCrossheadY, crossheadY)),
      lowerAngle: (crossheadY) => (crossheadY <= crossheadLowY
        ? outwardRackAngle
        : crossheadY >= lowerArcHead ? 0
          : invert(lowerCrossheadY, crossheadY)),
    };
  })();

  const phaseState = (unwrappedPhase) => {
    const phase = positiveModulo(unwrappedPhase, 1);
    const ascending = phase < ascentEnd;
    const stageProgress = ascending
      ? phase / ascentEnd
      : (phase - ascentEnd) / (descentEnd - ascentEnd);
    const stageDuration = ascending ? ascentEnd : descentEnd - ascentEnd;
    const motion = quinticState(stageProgress);
    const crossheadY = ascending
      ? crossheadLowY + stroke * motion.value
      : crossheadHighY - stroke * motion.value;
    const crossheadVelocityPerPhase = (ascending ? 1 : -1)
      * stroke * motion.rate / stageDuration;
    const crossheadAccelerationPerPhase2 = (ascending ? 1 : -1)
      * stroke * motion.acceleration / stageDuration ** 2;
    // A rises on its outer branch and is cammed upright by the upper arc; it
    // descends upright in mesh and swings out along the lower arc.
    // A1 swings in along the lower arc and rises upright in mesh; C carries
    // it over the upper angle and it descends on its outer branch.
    const angleOn = (arc, y) => (arc === 'upper'
      ? guideArcs.upperAngle(y) : guideArcs.lowerAngle(y));
    const leftArc = ascending ? 'upper' : 'lower';
    const rightArc = ascending ? 'lower' : 'upper';
    const angleRate = (arc) => {
      const step = 1e-6;
      const rate = (angleOn(arc, crossheadY + step)
        - angleOn(arc, crossheadY - step)) / (2 * step);
      return Number.isFinite(rate) ? rate * crossheadVelocityPerPhase : 0;
    };
    const leftAngle = angleOn(leftArc, crossheadY);
    const rightAngle = angleOn(rightArc, crossheadY);
    const outputWithinCycle = ascending
      ? (crossheadY - crossheadLowY) / pinionPitchRadius
      : stroke / pinionPitchRadius
        + (crossheadHighY - crossheadY) / pinionPitchRadius;
    return {
      crossheadAccelerationPerPhase2,
      crossheadVelocityPerPhase,
      crossheadY,
      leftAngle,
      leftOutwardFraction: leftAngle / outwardRackAngle,
      leftRate: angleRate(leftArc),
      outputAngularSpeedPerPhase: Math.abs(crossheadVelocityPerPhase)
        / pinionPitchRadius,
      outputWithinCycle,
      phase,
      rightAngle,
      rightOutwardFraction: rightAngle / outwardRackAngle,
      rightRate: angleRate(rightArc),
      stage: ascending
        ? 'right-rack-A1-working-upstroke'
        : 'left-rack-A-working-downstroke',
      stageProgress,
    };
  };

  const rackPose = (side, phase) => {
    const phaseData = phaseState(phase);
    const outwardFraction = side < 0
      ? phaseData.leftOutwardFraction
      : phaseData.rightOutwardFraction;
    const outwardAngle = side < 0 ? phaseData.leftAngle : phaseData.rightAngle;
    const outwardRate = side < 0 ? phaseData.leftRate : phaseData.rightRate;
    const rackAngle = -side * outwardAngle;
    const rackAngularRatePerPhase = -side * outwardRate;
    const pivot = new THREE.Vector2(
      side * rackPivotHalfSpacing,
      phaseData.crossheadY,
    );
    const guidePinLocal = new THREE.Vector2(side * guideArm, guideY);
    const cosine = Math.cos(rackAngle);
    const sine = Math.sin(rackAngle);
    const guidePin = new THREE.Vector2(
      pivot.x + cosine * guidePinLocal.x - sine * guidePinLocal.y,
      pivot.y + sine * guidePinLocal.x + cosine * guidePinLocal.y,
    );
    return {
      guidePin,
      guidePinLocal,
      outwardFraction,
      pivot,
      rackAngle,
      rackAngularRatePerPhase,
    };
  };

  const guideCurves = {
    left: new GuidePinCurve(
      (phase) => rackPose(-1, phase).guidePin,
      guidePlaneZ,
    ),
    right: new GuidePinCurve(
      (phase) => rackPose(1, phase).guidePin,
      guidePlaneZ,
    ),
  };
  const leftGuide = makeGuideGroove({
    centerline: guideCurves.left,
    darkMaterial,
    frameMaterial,
    role: 'left-fixed-closed-guide-groove-b',
  });
  const rightGuide = makeGuideGroove({
    centerline: guideCurves.right,
    darkMaterial,
    frameMaterial,
    role: 'right-fixed-closed-guide-groove-b',
  });
  root.add(leftGuide, rightGuide);

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role =
    'fixed-frame-carrying-guide-grooves-and-output-bearing';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(6.05, 0.26, 1.45),
    frameMaterial,
  );
  base.position.set(0, -3.58, -0.36);
  base.userData.role = 'fixed-machine-bed';
  fixedFrame.add(base);
  const bearingPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 3.35, 0.34),
    frameMaterial,
  );
  bearingPost.position.set(0, -1.67, -0.62);
  bearingPost.userData.role = 'fixed-output-shaft-bearing-standard';
  fixedFrame.add(bearingPost);
  for (const side of [-1, 1]) {
    const support = makeDynamicLink({
      color: PALETTE.frame,
      depth: 0.25,
      jointRadius: 0.001,
      thickness: 0.17,
    });
    const lowerPoint = new THREE.Vector3(side * 2.52, -3.47, -0.55);
    const guidePoint = side < 0
      ? guideCurves.left.getPoint(0.70)
      : guideCurves.right.getPoint(0.18);
    support.userData.setEndpoints(
      lowerPoint,
      new THREE.Vector3(guidePoint.x, guidePoint.y, -0.55),
    );
    support.userData.role = 'fixed-guide-groove-support-standard';
    fixedFrame.add(support);
  }
  const pistonGuide = new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.31, 0.50, 36),
    frameMaterial,
  );
  pistonGuide.position.set(0, -3.34, 0);
  pistonGuide.userData.role = 'fixed-piston-rod-guide-collar';
  fixedFrame.add(pistonGuide);
  root.add(fixedFrame);

  const outputGear = makeSpurGear({
    darkMaterial,
    depth: 0.48,
    material: drivenMaterial,
    pitchRadius: pinionPitchRadius,
    toothCount: pinionToothCount,
    toothHeight: rackToothHeight,
    whiteMaterial,
  });
  outputGear.position.set(0, 0, gearPlaneZ);
  root.add(outputGear);

  const crosshead = new THREE.Group();
  crosshead.position.z = rackPlaneZ - 0.12;
  crosshead.userData.role =
    'one-reciprocating-piston-rod-crosshead-carrying-both-rack-pivots';
  const crossheadBeam = new THREE.Mesh(
    new THREE.BoxGeometry(2.42, 0.18, 0.34),
    driverDarkMaterial,
  );
  crossheadBeam.userData.role = 'rigid-two-pivot-crosshead';
  crosshead.add(crossheadBeam);
  const pistonRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.10, 2.35, 24),
    darkMaterial,
  );
  pistonRod.position.y = -1.22;
  pistonRod.userData.role = 'reciprocating-input-piston-rod';
  crosshead.add(pistonRod);
  const inputIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 18, 12),
    whiteMaterial,
  );
  inputIndex.position.set(0, -0.28, 0.23);
  inputIndex.userData.role = 'white-crosshead-reciprocation-index';
  crosshead.add(inputIndex);
  root.add(markShadows(crosshead));

  const leftRack = makeRack({
    bodyLength: rackBodyLength,
    bodyMaterial: driverMaterial,
    bodyWidth: rackBodyWidth,
    circularPitch,
    darkMaterial,
    depth: rackDepth,
    guideArm,
    guideY,
    side: -1,
    toothCount: rackToothCount,
    toothHeight: rackToothHeight,
    toothMaterial: driverMaterial,
    whiteMaterial,
  });
  const rightRack = makeRack({
    bodyLength: rackBodyLength,
    bodyMaterial: driverMaterial,
    bodyWidth: rackBodyWidth,
    circularPitch,
    darkMaterial,
    depth: rackDepth,
    guideArm,
    guideY,
    side: 1,
    toothCount: rackToothCount,
    toothHeight: rackToothHeight,
    toothMaterial: driverMaterial,
    whiteMaterial,
  });
  leftRack.position.z = rackPlaneZ;
  rightRack.position.z = rackPlaneZ;
  root.add(leftRack, rightRack);

  const elbowPivot = new THREE.Vector3(
    rackPivotHalfSpacing + guideArm + ELBOW_PIVOT_FROM_CORNER[0],
    crossheadHighY + guideY + ELBOW_PIVOT_FROM_CORNER[1],
    0.13,
  );
  const elbowLever = new THREE.Group();
  elbowLever.position.copy(elbowPivot);
  elbowLever.userData.role =
    'spring-returned-elbow-lever-C-for-right-upper-guide-angle';
  const leverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.10, -0.58, 0),
    new THREE.Vector3(0.03, -1.12, 0),
    new THREE.Vector3(0.47, -1.52, 0),
  ]);
  const leverBody = new THREE.Mesh(
    new THREE.TubeGeometry(leverCurve, 48, 0.105, 12, false),
    brassMaterial,
  );
  leverBody.userData.role = 'curved-two-arm-body-of-elbow-lever-C';
  elbowLever.add(leverBody);
  const leverPivotPin = cylinderAlongZ(0.13, 0.78, darkMaterial, 28);
  leverPivotPin.userData.role = 'fixed-upper-pivot-of-elbow-lever-C';
  elbowLever.add(leverPivotPin);
  const leverContactIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 18, 12),
    whiteMaterial,
  );
  leverContactIndex.position.set(0.47, -1.52, 0.28);
  leverContactIndex.userData.role =
    'white-index-at-elbow-lever-C-upper-crossover-contact';
  elbowLever.add(leverContactIndex);
  root.add(markShadows(elbowLever));

  // Spring d rises to the right to its anchor, as drawn, clear above guide b.
  const springAnchor = new THREE.Vector3(elbowPivot.x + 1.53, elbowPivot.y + 0.05, 0.13);
  // Spring d runs in front of lever C (z 0.64), clear of C's link and stop.
  const springPlaneZ = 0.64;
  // A short fixed stud at spring d's far end (Brown's small circle).
  const springAnchorBoss = cylinderAlongZ(0.10, 0.26, darkMaterial, 24);
  springAnchorBoss.position.set(springAnchor.x, springAnchor.y, springPlaneZ);
  springAnchorBoss.userData.role = 'fixed-anchor-of-tension-spring-d';
  root.add(springAnchorBoss);
  const spring = makeDynamicCoilSpring(brassMaterial);
  root.add(spring);

  // Time zero shows Brown's pose: mid-descent, rack A upright and working,
  // A1 out on its outer branch and C at rest.
  const sourcePhase = 0.7;
  const stateAtTime = (playbackTime) => {
    const time = playbackTime + sourcePhase * cycleDuration;
    const cycles = Math.floor(time / cycleDuration);
    const cycleTime = positiveModulo(time, cycleDuration);
    const phase = cycleTime / cycleDuration;
    const phaseData = phaseState(phase);
    const leftPose = rackPose(-1, phase);
    const rightPose = rackPose(1, phase);
    const outputAngle = cycles * outputAdvancePerCycle
      + phaseData.outputWithinCycle;
    const outputAngularSpeed = phaseData.outputAngularSpeedPerPhase
      / cycleDuration;
    const crossheadVelocity = phaseData.crossheadVelocityPerPhase
      / cycleDuration;
    const crossheadAcceleration =
      phaseData.crossheadAccelerationPerPhase2 / cycleDuration ** 2;
    const contactState = selectorState(rightPose, elbowPivot);
    // While A1 rises in mesh its roller swings C round against spring d
    // (loading). From the top, C presses back on the roller and carries A1's
    // pin over the upper angle as A1 swings outward (assist).
    const topAssistActive = contactState.contact
      && phaseData.stage === 'left-rack-A-working-downstroke';
    const assistProgress = topAssistActive ? phaseData.stageProgress : 0;
    const leftRackPhaseError = wrappedSignedAngle(
      (phaseData.outputWithinCycle + (phaseData.crossheadY - crossheadLowY)
        / pinionPitchRadius) * pinionToothCount,
    );
    const rightRackPhaseError = wrappedSignedAngle(
      (phaseData.outputWithinCycle - (phaseData.crossheadY - crossheadHighY)
        / pinionPitchRadius + stroke/pinionPitchRadius) * pinionToothCount,
    );
    return {
      activeDrive: phaseData.stage,
      assistProgress,
      crossheadAcceleration,
      crossheadVelocity,
      crossheadY: phaseData.crossheadY,
      cycleTime,
      cycles,
      elbowAssist: {
        active: topAssistActive,
        ...contactState,
        loading: contactState.contact && !topAssistActive,
      },
      leftRack: {
        ...leftPose,
        angularSpeed: leftPose.rackAngularRatePerPhase / cycleDuration,
        engaged: phaseData.stage === 'left-rack-A-working-downstroke'
          && phaseData.leftAngle === 0,
        toothPhaseError: leftRackPhaseError/pinionToothCount,
      },
      outputAngle,
      outputAngularSpeed,
      phase,
      rightRack: {
        ...rightPose,
        angularSpeed: rightPose.rackAngularRatePerPhase / cycleDuration,
        engaged: phaseData.stage === 'right-rack-A1-working-upstroke'
          && phaseData.rightAngle === 0,
        toothPhaseError: rightRackPhaseError/pinionToothCount,
      },
      stageProgress: phaseData.stageProgress,
    };
  };

  const springAttachmentLocal = new THREE.Vector3(...selectorGeometry.springStud,
    springPlaneZ - elbowPivot.z);
  const springAnchorFront = new THREE.Vector3(springAnchor.x, springAnchor.y,
    springPlaneZ);
  const update = (time) => {
    const state = stateAtTime(time);
    crosshead.position.y = state.crossheadY;
    leftRack.position.set(
      state.leftRack.pivot.x,
      state.leftRack.pivot.y,
      rackPlaneZ,
    );
    leftRack.rotation.z = state.leftRack.rackAngle;
    rightRack.position.set(
      state.rightRack.pivot.x,
      state.rightRack.pivot.y,
      rackPlaneZ,
    );
    rightRack.rotation.z = state.rightRack.rackAngle;
    outputGear.rotation.z = state.outputAngle;
    elbowLever.rotation.z = state.elbowAssist.leverAngle;
    leverContactIndex.visible = state.elbowAssist.contact;
    root.userData.updateSelectorContact?.(state);
    const springAttachment = springAttachmentLocal.clone()
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), elbowLever.rotation.z)
      .add(elbowPivot);
    // The coil's end legs stop at the stud surfaces (hooked round them).
    const springAxis = springAnchorFront.clone().sub(springAttachment)
      .normalize();
    spring.userData.setEndpoints(
      springAttachment.clone().addScaledVector(springAxis, 0.056),
      springAnchorFront.clone().addScaledVector(springAxis, -0.101),
    );

    root.userData.contacts = {
      elbowLeverCToRightRackUpperCrossover: {
        active: state.elbowAssist.active,
        guidePin: state.rightRack.guidePin.clone(),
        progress: state.assistProgress,
        springDeflection: state.elbowAssist.springDeflection,
      },
      leftRackAToCogWheel: {
        active: state.leftRack.engaged,
        pitchLineVelocityError: state.leftRack.engaged
          ? state.crossheadVelocity
            + pinionPitchRadius * state.outputAngularSpeed
          : null,
        toothPhaseError: state.leftRack.engaged
          ? state.leftRack.toothPhaseError
          : null,
      },
      rightRackA1ToCogWheel: {
        active: state.rightRack.engaged,
        pitchLineVelocityError: state.rightRack.engaged
          ? state.crossheadVelocity
            - pinionPitchRadius * state.outputAngularSpeed
          : null,
        toothPhaseError: state.rightRack.engaged
          ? state.rightRack.toothPhaseError
          : null,
      },
    };
    root.userData.kinematics = state;
  };

  root.userData = {
    archetype:
      'dual-weighted-pivoted-racks-closed-guide-grooves-alternating-stroke-unidirectional-pinion',
    blocks: {
      crosshead,
      crossheadBeam,
      elbowLever,
      fixedFrame,
      guideCurves,
      inputIndex,
      leftGuide,
      leftRack,
      leverContactIndex,
      outputGear,
      pistonRod,
      rightGuide,
      rightRack,
      spring,
      springAnchorBoss,
    },
    constraintResiduals: {
      pitchesPerStroke: rackPitchesPerStroke - 10 - extraStrokePitches,
      outputCycleClosure: outputAdvancePerCycle
        - FULL_TURN * (10 + extraStrokePitches) / 10,
      rackPitchIdentity:
        circularPitch - pinionPitchRadius * pinionAngularPitch,
    },
    constraints: {
      commonCrosshead:
        'Both lower pivots a translate together on one rigid piston-rod crosshead.',
      guideClosure:
        'Each guide groove b is the closed fixed locus of its rigid rack guide pin: two straight vertical branches joined by an upper arc tangent to the outer branch and a lower arc tangent to the inner branch, with sharp corners at the top of the inner branch and the foot of the outer branch.',
      meshSelection:
        'Rack A1 is exactly vertical and meshes on ascent; rack A is exactly vertical and meshes on descent. The upper arc cams A upright as it rises; A\'s outboard weight swings it out on the lower arc; A1\'s inboard weight swings it in on the lower arc; elbow lever C, loaded by the roller on A1\'s rigid protrusion, carries A1 over the upper angle.',
      rigidRack:
        'Each rack, its teeth, lower weight arm, upper guide arm, and guide pin are one rigid body about pivot a.',
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'common crosshead height',
        'rack A angle selected by left guide groove b',
        'rack A1 angle selected by right guide groove b',
        'cog-wheel angle from whichever rack is working',
        'spring-loaded elbow lever C deflection at the upper right corner',
      ],
      independentPrescribedInputs: 1,
      inputs: ['one reciprocating piston-rod stroke'],
      note:
        'The fixed guide grooves select the two rack attitudes; which branch a pin takes at each corner is prescribed (weights, cam arcs and C shown kinematically); passive branch dynamics are not solved.',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid links and frame',
        'zero backlash and exact common circular pitch at the active mesh',
        'quintic piston rise and fall with zero speed at both ends of the stroke',
        'gravity weights and spring d shown kinematically without mass-force integration',
        'flywheel inertia, tooth compliance, friction, and impact omitted',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless kinematic reconstruction',
    },
    fidelity: 'authored',
    geometry: {
      ascentEnd,
      circularPitch,
      crossheadHighY,
      crossheadLowY,
      descentEnd,
      gearPlaneZ,
      guideArm,
      guidePlaneZ,
      guideY,
      outwardRackAngle,
      outputAdvancePerCycle,
      markedClosureCycles: 1,
      pinionAngularPitch,
      pinionPitchRadius,
      pinionToothCount,
      rackRootExtension,
      rackBodyLength,
      rackBodyWidth,
      rackDepth,
      rackPitchesPerStroke,
      rackPivotHalfSpacing,
      rackToothCount,
      rackToothHeight,
      sourcePhase,
      topCornerCurvature,
      topCornerSwing,
      bottomCornerAngle,
      guideArcs,
      stroke,
      topCrossoverEnd,
    },
    mechanism:
      'one-piston-rod-crosshead-reciprocates-two-weighted-pivoted-racks-A-and-A1-whose-end-pins-follow-opposed-fixed-closed-guide-grooves-b-so-A1-meshes-on-ascent-and-A-meshes-on-descent-to-turn-one-cog-wheel-continuously-counterclockwise-while-spring-d-returns-elbow-lever-C-at-the-right-upper-corner',
    motion: {
      outputDirection: 'counterclockwise only, with zero speed at guide crossovers',
      outputTurnsPerInputCycle: 1,
      rackExchange:
        'at the top A lands in mesh and A1 leaves it where the piston is at rest; at the bottom A leaves mesh before, and A1 enters after, the piston reverses',
      strokeLaw:
        'quintic rise, quintic fall',
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 391 page marks Animated unavailable and contains no canvas model.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate391: {
        elbowLeverUpperPivotPixels: [379, 26],
        gearCenterPixels: [249, 287],
        gearOuterRadiusPixels: 62,
        imageHeight: 525,
        imageWidth: 525,
        leftGuidePinPixels: [117, 193],
        leftLowerPivotPixels: [170, 480],
        measurementUncertaintyPixels: 10,
        rightGuidePinPixels: [419, 174],
        rightLowerPivotPixels: [321, 480],
      },
      constructionEvidence: {
        engravingEvidence:
          'The plate shows two inward-toothed racks on lower pivots a, two outboard D-shaped guide grooves b, one central cog wheel, unequal lower weights, and spring-loaded elbow lever C above the right upper corner.',
        explicitInBrownDescription: [
          'weighted racks A and A1',
          'both racks pivoted to the end of one piston rod',
          'rack-end pins working in fixed guide grooves b',
          'one rack operates ascending and the other descending',
          'elbow lever C and spring d carry the right-hand pin over the upper angle',
        ],
        reconstructionDisclosure:
          'Because no official animation is available, arc radii, dimensions, tooth count, colors, and timing are independently engineered. The groove shapes (straight branches, arcs at opposite corners tangent to one branch each) and the weights fix the circulation: A rises out of mesh and is cammed in at the top, A1 needs C to be carried over its upper angle.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 391',
    },
    stateAtTime,
    timeline: {
      ascent: [0, ascentEnd],
      cycleDuration,
      descent: [topCrossoverEnd, descentEnd],
    },
    transmission: {
      activeMeshLaw:
        'theta=DeltaY/R on rack A1 ascent; theta=theta_top-DeltaY/R on rack A descent',
      fullCycleLaw: 'Delta theta = 2 stroke / R = 2.6 pi; the wheel makes 1.3 counterclockwise turns (26 teeth) per piston cycle',
      guideLaw:
        'inner branch means rack angle zero and exact mesh; outer branch means rack angle is displaced outward by 0.17 rad',
      pitchLaw: 'p=2*pi*R/N and stroke=13*p; one piston cycle advances the wheel by 26 teeth (1.3 turns)',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.25, -4.69, -1.05),
    new THREE.Vector3(3.30, 6.29, 1.05),
  );
  root.userData.cameraDistanceScale = 1.08;
  root.userData.cameraDirection = new THREE.Vector3(0.15, 0.12, 12);
  root.userData.groundFloorY = -3.72;
  correctWeightedRackInterfaces(root);
  correctWeightedRackTeeth(root);
  installWeightedRackSelector(root);
  finishAlternatingDrive(root,update,cycleDuration);
  return { root, update, cameraDirection: root.userData.cameraDirection };
}

export function createAuthoredAlternatingWeightedRackMovement(movement) {
  if (movement.id !== 391) return null;
  return alternatingWeightedRackDrive(movement);
}
