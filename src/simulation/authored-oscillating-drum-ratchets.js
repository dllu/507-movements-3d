import {correctOscillatingDrum,finishOneWayFamily} from './one-way-clutch-working-parts.js';
import * as THREE from 'three';
import {circle,plate,poly,polygonClipping as clip,rotate as rotateXY,sector} from './finite-plate-geometry.js';
import {drumContact} from './oscillating-drum-contact.js';
import {makeSpokedWheel} from './spoked-wheel.js';
import {
  PALETTE,
  makeBeam,
  makeDynamicMovingBelt,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function makeAnnularDrum({
  depth,
  innerRadius,
  material,
  outerRadius,
  role,
  z,
}) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 64,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  const drum = new THREE.Mesh(geometry, material);
  drum.position.z = z;
  drum.userData.role = role;
  return drum;
}

function makeRatchetWheel({
  depth,
  material,
  outerRadius,
  rootRadius,
  toothCount,
  z,
}) {
  const shape = new THREE.Shape();
  const pitch = FULL_TURN / toothCount;
  let first = true;
  for (let tooth = 0; tooth < toothCount; tooth += 1) {
    for (const sample of [
      { offset: -0.50, radius: rootRadius },
      { offset: -0.38, radius: outerRadius },
      { offset: 0.34, radius: outerRadius * 0.91 },
      { offset: 0.50, radius: rootRadius },
    ]) {
      const angle = tooth * pitch + sample.offset * pitch;
      const x = sample.radius * Math.cos(angle);
      const y = sample.radius * Math.sin(angle);
      if (first) {
        shape.moveTo(x, y);
        first = false;
      } else shape.lineTo(x, y);
    }
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  const wheel = new THREE.Mesh(geometry, material);
  wheel.position.z = z;
  wheel.userData.role = 'ratchet-wheel-fast-on-flywheel-shaft';
  wheel.userData.rootRadius = rootRadius;
  wheel.userData.toothCount = toothCount;
  wheel.userData.toothPitch = pitch;
  return wheel;
}

// From the beam attachment the working cord follows the right circular
// sector, leaves it vertically, and winds clockwise onto the loose drum.  All
// three pieces are parameterized by material distance.  Their summed length
// is constant because R_sector * beamAngle = R_drum * drumAngle.
class BeamToDrumCordCurve extends THREE.Curve {
  constructor(geometry) {
    super();
    this.geometry = geometry;
  }

  getPoint(value, target = new THREE.Vector3()) {
    const data = this.geometry;
    const distance = THREE.MathUtils.clamp(value, 0, 1)
      * data.totalLength;
    if (distance <= data.sectorArcLength) {
      const progress = data.sectorArcLength > 1e-12
        ? distance / data.sectorArcLength
        : 1;
      const angle = data.sectorAttachmentPhase * (1 - progress);
      return target.set(
        data.beamPivot.x + data.sectorRadius * Math.cos(angle),
        data.beamPivot.y + data.sectorRadius * Math.sin(angle),
        data.sectorZ,
      );
    }
    const afterSector = distance - data.sectorArcLength;
    if (afterSector <= data.verticalLength) {
      const progress = afterSector / data.verticalLength;
      return target.set(
        data.tangentX,
        THREE.MathUtils.lerp(
          data.beamPivot.y,
          data.drumCenter.y,
          progress,
        ),
        THREE.MathUtils.lerp(data.sectorZ, data.z, progress),
      );
    }
    const progress = data.drumArcLength > 1e-12
      ? THREE.MathUtils.clamp(
        (afterSector - data.verticalLength) / data.drumArcLength,
        0,
        1,
      )
      : 1;
    const angle = data.drumAttachmentPhase * progress;
    return target.set(
      data.drumCenter.x + data.drumRadius * Math.cos(angle),
      data.drumCenter.y + data.drumRadius * Math.sin(angle),
      data.z,
    );
  }

  getPointAt(value, target = new THREE.Vector3()) {
    return this.getPoint(value, target);
  }

  getTangent(value, target = new THREE.Vector3()) {
    const data = this.geometry;
    const distance = THREE.MathUtils.clamp(value, 0, 1)
      * data.totalLength;
    if (distance < data.sectorArcLength - 1e-10) {
      const progress = distance / data.sectorArcLength;
      const angle = data.sectorAttachmentPhase * (1 - progress);
      return target.set(Math.sin(angle), -Math.cos(angle), 0).normalize();
    }
    if (distance < data.sectorArcLength + data.verticalLength - 1e-10) {
      return target.set(0, -data.verticalLength, data.z - data.sectorZ)
        .normalize();
    }
    const progress = data.drumArcLength > 1e-12
      ? THREE.MathUtils.clamp(
        (distance - data.sectorArcLength - data.verticalLength)
          / data.drumArcLength,
        0,
        1,
      )
      : 1;
    const angle = data.drumAttachmentPhase * progress;
    return target.set(Math.sin(angle), -Math.cos(angle), 0).normalize();
  }

  getTangentAt(value, target = new THREE.Vector3()) {
    return this.getTangent(value, target);
  }

  getLength() {
    return this.geometry.totalLength;
  }

  getLengths(divisions = 200) {
    return Array.from(
      { length: divisions + 1 },
      (_, index) => this.geometry.totalLength * index / divisions,
    );
  }

  getUtoTmapping(value) {
    return value;
  }
}

// The left cord wraps over the opposite sector and hangs vertically.  The
// tail and its weight rise or fall by exactly the arc length released or
// taken up by the rocking sector.
class CounterweightCordCurve extends THREE.Curve {
  constructor(geometry) {
    super();
    this.geometry = geometry;
  }

  getPoint(value, target = new THREE.Vector3()) {
    const data = this.geometry;
    const distance = THREE.MathUtils.clamp(value, 0, 1)
      * data.totalLength;
    if (distance <= data.sectorArcLength) {
      const progress = data.sectorArcLength > 1e-12
        ? distance / data.sectorArcLength
        : 1;
      const angle = THREE.MathUtils.lerp(
        data.sectorAttachmentPhase,
        Math.PI,
        progress,
      );
      return target.set(
        data.beamPivot.x + data.sectorRadius * Math.cos(angle),
        data.beamPivot.y + data.sectorRadius * Math.sin(angle),
        data.sectorZ,
      );
    }
    const progress = data.verticalLength > 1e-12
      ? THREE.MathUtils.clamp(
        (distance - data.sectorArcLength) / data.verticalLength,
        0,
        1,
      )
      : 1;
    return target.set(
      data.tangentX,
      THREE.MathUtils.lerp(data.beamPivot.y, data.tailY, progress),
      data.sectorZ,
    );
  }

  getPointAt(value, target = new THREE.Vector3()) {
    return this.getPoint(value, target);
  }

  getTangent(value, target = new THREE.Vector3()) {
    const data = this.geometry;
    const distance = THREE.MathUtils.clamp(value, 0, 1)
      * data.totalLength;
    if (distance < data.sectorArcLength - 1e-10) {
      const progress = distance / data.sectorArcLength;
      const angle = THREE.MathUtils.lerp(
        data.sectorAttachmentPhase,
        Math.PI,
        progress,
      );
      return target.set(-Math.sin(angle), Math.cos(angle), 0).normalize();
    }
    return target.set(0, -1, 0);
  }

  getTangentAt(value, target = new THREE.Vector3()) {
    return this.getTangent(value, target);
  }

  getLength() {
    return this.geometry.totalLength;
  }

  getLengths(divisions = 200) {
    return Array.from(
      { length: divisions + 1 },
      (_, index) => this.geometry.totalLength * index / divisions,
    );
  }

  getUtoTmapping(value) {
    return value;
  }
}

function oscillatingDrumRatchet(movement) {
  const root = new THREE.Group();

  const cyclePeriod = 12;
  const beamCyclesPerDemonstration = 2;
  const beamOscillationPeriod = cyclePeriod / beamCyclesPerDemonstration;
  const beamCycleRate = FULL_TURN / beamOscillationPeriod;
  const beamAmplitude = 0.38;
  const beamPivot = new THREE.Vector2(-0.62, 1.72);
  const drumCenter = new THREE.Vector2(0.29, 0.10);
  const sectorRadius = 1.55;
  const drumRadius = beamPivot.x + sectorRadius - drumCenter.x;
  const drumRatio = sectorRadius / drumRadius;
  const drumAmplitude = beamAmplitude * drumRatio;
  // The cords reach the rims' outer ends (Brown draws them over the ends).
  const sectorBaseWrap = 0.50;
  const drumBaseWrap = 1.35;
  const flywheelRadius = 1.34;
  const ratchetToothCount = drumContact.toothCount;
  const ratchetToothPitch = FULL_TURN / ratchetToothCount;
  const counterweightNominalFreeLength = 1.55;
  const cordZ = 0.67;
  // Both cords lie on their sectors' rims in the beam's plane; the drive
  // cord crosses forward to the drum's groove along its vertical run.
  const sectorCordZ = 0.16;
  const driveCordVerticalLength = beamPivot.y - drumCenter.y;
  const driveCordLength = sectorRadius * sectorBaseWrap
    + driveCordVerticalLength
    + drumRadius * drumBaseWrap;
  const counterweightCordLength = sectorRadius * sectorBaseWrap
    + counterweightNominalFreeLength;
  const flywheelAdvancePerCycle = FULL_TURN;
  const flywheelAngularSpeed = flywheelAdvancePerCycle / cyclePeriod;
  const pawlMaximumLift = 0.14;

  const driveCordAtBeamAngle = (beamAngle) => {
    const boundedBeamAngle = THREE.MathUtils.clamp(
      beamAngle,
      -beamAmplitude,
      beamAmplitude,
    );
    const drumAngle = drumRatio * boundedBeamAngle;
    const sectorAttachmentPhase = sectorBaseWrap + boundedBeamAngle;
    const drumAttachmentPhase = -drumBaseWrap + drumAngle;
    const sectorArcLength = sectorRadius * sectorAttachmentPhase;
    const drumArcLength = -drumRadius * drumAttachmentPhase;
    return {
      beamAngle: boundedBeamAngle,
      beamPivot,
      drumAngle,
      drumArcLength,
      drumAttachmentPhase,
      drumCenter,
      drumRadius,
      sectorArcLength,
      sectorAttachmentPhase,
      sectorRadius,
      tangentX: beamPivot.x + sectorRadius,
      totalLength: sectorArcLength
        + driveCordVerticalLength
        + drumArcLength,
      verticalLength: driveCordVerticalLength,
      sectorZ: sectorCordZ,
      z: cordZ,
    };
  };

  const counterweightCordAtBeamAngle = (beamAngle) => {
    const boundedBeamAngle = THREE.MathUtils.clamp(
      beamAngle,
      -beamAmplitude,
      beamAmplitude,
    );
    const sectorAttachmentPhase = Math.PI
      - sectorBaseWrap
      + boundedBeamAngle;
    const sectorArcLength = sectorRadius
      * (sectorBaseWrap - boundedBeamAngle);
    const verticalLength = counterweightNominalFreeLength
      + sectorRadius * boundedBeamAngle;
    const tailY = beamPivot.y - verticalLength;
    return {
      beamAngle: boundedBeamAngle,
      beamPivot,
      sectorArcLength,
      sectorAttachmentPhase,
      sectorRadius,
      tailY,
      tangentX: beamPivot.x - sectorRadius,
      totalLength: sectorArcLength + verticalLength,
      verticalLength,
      sectorZ: sectorCordZ,
      z: sectorCordZ,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cyclePeriod);
    const phase = cycleTime / cyclePeriod;
    const phaseAngle = FULL_TURN * beamCyclesPerDemonstration * phase;
    const beamAngle = -beamAmplitude * Math.cos(phaseAngle);
    const beamAngularSpeed = beamAmplitude
      * beamCycleRate * Math.sin(phaseAngle);
    const drumAngle = drumRatio * beamAngle;
    const drumAngularSpeed = drumRatio * beamAngularSpeed;
    const flywheelAngle = flywheelAdvancePerCycle * phase;
    const relativeToothPhase = positiveModulo(
      flywheelAngle - drumAngle + ratchetToothPitch * 0.08,
      ratchetToothPitch,
    ) / ratchetToothPitch;
    const pawlLift = pawlMaximumLift
      * Math.sin(Math.PI * relativeToothPhase) ** 2;
    const carrierCatching = drumAngularSpeed > flywheelAngularSpeed;
    const nearDrivingFace = relativeToothPhase < 0.10
      || relativeToothPhase > 0.90;
    const driveCord = driveCordAtBeamAngle(beamAngle);
    const counterweightCord = counterweightCordAtBeamAngle(beamAngle);
    return {
      beamAngle,
      beamAngularSpeed,
      carrierCatching,
      counterweightCenterY: counterweightCord.tailY + 0.28,
      counterweightCord,
      cycleTime,
      driveCord,
      drumAngle,
      drumAngularSpeed,
      drumDirection: drumAngularSpeed > 1e-9
        ? 'positive drive stroke'
        : drumAngularSpeed < -1e-9
          ? 'negative return stroke'
          : 'drum reversal',
      flywheelAngle,
      flywheelAngularSpeed,
      flywheelDirection: 'positive continuous rotation',
      pawlLift,
      pawlMode: carrierCatching && nearDrivingFace
        ? 'driving impulse against a ratchet tooth face'
        : 'overrunning and riding across the ratchet teeth',
      phase,
      relativeToothPhase,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.59,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.17,
    roughness: 0.53,
  });
  const brassMaterial = matte(PALETTE.accent, {
    metalness: 0.30,
    roughness: 0.42,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const frame = new THREE.Group();
  frame.userData.role = 'fixed-bearing-frame-for-beam-and-flywheel';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2.55, 0.18, 0.78),
    frameMaterial,
  );
  base.position.set(-0.56, -1.40, -0.30);
  base.userData.role = 'source-visible-frame-base';
  frame.add(base);
  // Pass 92: Brown's upright has a round top concentric with the beam's pivot
  // pin. One flat extrusion (same plane and depth as before), 0.30 wide, its
  // top a semicircle about the pin, so the pin stands with a 1.6x margin
  // instead of on the square end of a box.
  const postHalfWidth = 0.15;
  const post = new THREE.Mesh(
    plate(clip.union(
      poly([[beamPivot.x - postHalfWidth, -1.31], [beamPivot.x + postHalfWidth, -1.31],
        [beamPivot.x + postHalfWidth, beamPivot.y], [beamPivot.x - postHalfWidth, beamPivot.y]]),
      poly(circle([beamPivot.x, beamPivot.y], postHalfWidth, 64)),
    ), -0.51, -0.17),
    frameMaterial,
  );
  post.userData.role = 'beam-pivot-upright';
  frame.add(post);
  for (const [bottomX, topY] of [
    [-1.28, 0.12],
    [0.02, -0.15],
  ]) {
    const brace = makeBeam(
      new THREE.Vector3(bottomX, -1.31, -0.34),
      new THREE.Vector3(beamPivot.x, topY, -0.34),
      { color: PALETTE.frame, depth: 0.26, thickness: 0.14 },
    );
    brace.userData.role = 'triangular-frame-brace';
    frame.add(brace);
  }
  const rearBearingPost = makeBeam(
    new THREE.Vector3(drumCenter.x, -1.29, -0.62),
    new THREE.Vector3(drumCenter.x, drumCenter.y, -0.62),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.17 },
  );
  rearBearingPost.userData.role = 'rear-flywheel-shaft-bearing-post';
  frame.add(rearBearingPost);
  root.add(frame);

  const flywheelRotor = new THREE.Group();
  flywheelRotor.position.set(drumCenter.x, drumCenter.y, 0);
  flywheelRotor.userData.axis = Z_AXIS.clone();
  flywheelRotor.userData.role =
    'continuous-flywheel-ratchet-and-shaft-rotor';
  const flywheelRim = new THREE.Mesh(
    new THREE.TorusGeometry(flywheelRadius, 0.105, 14, 88),
    drivenMaterial,
  );
  flywheelRim.position.z = -0.27;
  flywheelRim.userData.role = 'heavy-continuously-rotating-flywheel-rim';
  flywheelRotor.add(flywheelRim);
  const flywheelSpokes = [];
  for (let index = 0; index < 4; index += 1) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(flywheelRadius * 1.76, 0.12, 0.16),
      drivenMaterial,
    );
    spoke.rotation.z = index * Math.PI / 2;
    spoke.position.z = -0.27;
    spoke.userData.role = 'flywheel-spoke-fast-on-shaft';
    flywheelRotor.add(spoke);
    flywheelSpokes.push(spoke);
  }
  const flywheelHub = cylinderAlongZ(0.19, 0.50, darkMaterial, 30);
  flywheelHub.position.z = -0.20;
  flywheelHub.userData.role = 'flywheel-shaft-hub';
  flywheelRotor.add(flywheelHub);
  const flywheelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.50, 0.075, 0.035),
    whiteMaterial,
  );
  flywheelIndex.position.set(flywheelRadius - 0.30, 0, -0.15);
  flywheelIndex.userData.role = 'white-continuous-flywheel-index';
  flywheelRotor.add(flywheelIndex);
  const ratchetWheel = makeRatchetWheel({
    depth: 0.14,
    material: brassMaterial,
    outerRadius: 0.39,
    rootRadius: 0.29,
    toothCount: ratchetToothCount,
    z: 0.62,
  });
  flywheelRotor.add(ratchetWheel);
  const frontShaft = cylinderAlongZ(0.10, 1.28, darkMaterial, 28);
  frontShaft.position.z = 0.12;
  frontShaft.userData.role = 'shaft-rigid-with-ratchet-and-flywheel';
  flywheelRotor.add(frontShaft);
  root.add(flywheelRotor);

  const looseDrum = new THREE.Group();
  looseDrum.position.set(drumCenter.x, drumCenter.y, 0);
  looseDrum.userData.axis = Z_AXIS.clone();
  looseDrum.userData.role = 'cord-drum-loose-on-flywheel-shaft';
  const drumBody = makeAnnularDrum({
    depth: 0.18,
    innerRadius: 0.47,
    material: driverMaterial,
    outerRadius: drumRadius,
    role: 'oscillating-annular-cord-drum',
    z: 0.39,
  });
  looseDrum.add(drumBody);
  // The grooved cord rim is part of the drum, in its own colour.
  const drumOuterRim = new THREE.Mesh(
    new THREE.TorusGeometry(drumRadius, 0.052, 10, 64),
    driverMaterial,
  );
  drumOuterRim.position.z = 0.50;
  drumOuterRim.userData.role = 'loose-drum-cord-groove';
  looseDrum.add(drumOuterRim);
  const drumIndex = new THREE.Mesh(
    new THREE.BoxGeometry(drumRadius * 0.42, 0.055, 0.032),
    whiteMaterial,
  );
  drumIndex.position.set(drumRadius * 0.72, 0, 0.51);
  drumIndex.userData.role = 'white-oscillating-drum-index';
  looseDrum.add(drumIndex);
  const drumCordKnot = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 12),
    brassMaterial,
  );
  drumCordKnot.position.set(
    drumRadius * Math.cos(-drumBaseWrap),
    drumRadius * Math.sin(-drumBaseWrap),
    cordZ,
  );
  drumCordKnot.userData.role = 'drive-cord-end-fixed-to-loose-drum';
  looseDrum.add(drumCordKnot);

  const pawlPivotPhase = 1.96;
  const pawlPivotRadius = 0.53;
  const pawlHinge = new THREE.Group();
  pawlHinge.position.set(
    pawlPivotRadius * Math.cos(pawlPivotPhase),
    pawlPivotRadius * Math.sin(pawlPivotPhase),
    0.73,
  );
  pawlHinge.userData.role = 'pawl-pivot-rigidly-carried-by-loose-drum';
  const pawlArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.075, 0.075),
    darkMaterial,
  );
  pawlArm.position.x = 0.12;
  pawlArm.userData.role = 'spring-loaded-driving-and-overrunning-pawl';
  pawlHinge.add(pawlArm);
  const pawlTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.075, 0.13, 3),
    darkMaterial,
  );
  pawlTip.rotation.z = -Math.PI / 2;
  pawlTip.position.x = 0.255;
  pawlTip.userData.role = 'pawl-tip-contacting-ratchet-teeth';
  pawlHinge.add(pawlTip);
  const pawlPin = cylinderAlongZ(0.075, 0.13, brassMaterial, 20);
  pawlPin.position.z = 0.015;
  pawlPin.userData.role = 'drum-mounted-pawl-pin';
  pawlHinge.add(pawlPin);
  looseDrum.add(pawlHinge);
  root.add(looseDrum);

  const rockingBeam = new THREE.Group();
  // The cords lie on the sectors' rims: each rim runs just inside the
  // cord's pitch circle in the cords' sector plane.
  const beamPlaneOffset = sectorCordZ - 0.16;
  const sectorRimRadius = sectorRadius - 0.12 - 0.033 - 0.004;
  rockingBeam.position.set(beamPivot.x, beamPivot.y, beamPlaneOffset);
  rockingBeam.userData.axis = Z_AXIS.clone();
  rockingBeam.userData.role = 'externally-vibrated-double-sector-beam';
  // Brown's beam is one flat plate: two short flat-ended rims concentric
  // with the pivot (about +/-30 degrees), each carried by a broad horizontal
  // arm and two narrower diagonal arms that butt into the rim's inner edge
  // well inside its ends.  The drive cord needs the right rim from the
  // vertical tangent (-beamAmplitude in the beam frame) up to its
  // attachment at sectorBaseWrap, which the symmetric rim covers.
  const sectorHalfSpan = 0.52;
  const sectorRimDepth = 0.15;
  const sectorRimInnerRadius = sectorRimRadius + 0.12 - sectorRimDepth;
  const diagonalSpokeAngle = 0.40;
  const hubHoleRadius = 0.18;
  const radialBar = (angle, halfWidth) => {
    const reach = sectorRimInnerRadius + 0.03;
    return poly([[0, -halfWidth], [reach, -halfWidth],
      [reach, halfWidth], [0, halfWidth]]
      .map((point) => rotateXY(point, angle)));
  };
  let beamRegion = poly(circle([0, 0], 0.25, 96));
  for (const side of [0, Math.PI]) {
    beamRegion = clip.union(
      beamRegion,
      sector(sectorRimInnerRadius, sectorRimRadius + 0.12,
        side - sectorHalfSpan, side + sectorHalfSpan, 128),
      radialBar(side, 0.11),
      radialBar(side + diagonalSpokeAngle, 0.05),
      radialBar(side - diagonalSpokeAngle, 0.05),
    );
  }
  beamRegion = clip.difference(beamRegion,
    poly(circle([0, 0], hubHoleRadius, 96)));
  const beamPlate = new THREE.Mesh(
    plate(beamRegion, 0.16 - 0.075, 0.16 + 0.075),
    driverMaterial,
  );
  beamPlate.userData.role = 'rocking-beam-double-sector-plate';
  beamPlate.userData.sectorHalfSpan = sectorHalfSpan;
  rockingBeam.add(beamPlate);
  const beamHub = cylinderAlongZ(hubHoleRadius, 0.44, darkMaterial, 30);
  beamHub.position.z = 0.15;
  beamHub.userData.role = 'rocking-beam-fixed-pivot-hub';
  rockingBeam.add(beamHub);
  const rightCordKnot = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 12),
    brassMaterial,
  );
  rightCordKnot.position.set(
    sectorRadius * Math.cos(sectorBaseWrap),
    sectorRadius * Math.sin(sectorBaseWrap),
    sectorCordZ - beamPlaneOffset,
  );
  rightCordKnot.userData.role = 'drive-cord-end-fixed-to-right-sector';
  rockingBeam.add(rightCordKnot);
  const leftCordKnot = rightCordKnot.clone();
  leftCordKnot.position.set(
    sectorRadius * Math.cos(Math.PI - sectorBaseWrap),
    sectorRadius * Math.sin(Math.PI - sectorBaseWrap),
    sectorCordZ - beamPlaneOffset,
  );
  leftCordKnot.userData.role =
    'counterweight-cord-end-fixed-to-left-sector';
  rockingBeam.add(leftCordKnot);
  // Brown draws the cords running over the sector ends and onto the drum
  // with no ball fastenings: the knots stay as the cords' anchor frames but
  // are not rendered.
  for (const knot of [drumCordKnot, rightCordKnot, leftCordKnot]) {
    knot.visible = false;
  }
  root.add(rockingBeam);

  const beamPivotPin = cylinderAlongZ(0.095, 0.92 + beamPlaneOffset,
    brassMaterial, 24);
  beamPivotPin.position.set(beamPivot.x, beamPivot.y,
    0.03 + beamPlaneOffset / 2);
  beamPivotPin.userData.role = 'fixed-beam-pivot-pin';
  root.add(beamPivotPin);

  const initialState = stateAtTime(0);
  const driveCord = makeDynamicMovingBelt(
    new BeamToDrumCordCurve(initialState.driveCord),
    {
      closed: false,
      color: PALETTE.belt,
      laid: true,
      radius: 0.033,
      tubularSegments: 196,
    },
  );
  // Brown hatches the cords: laid rope, whose lay replaces the markers.
  driveCord.userData.markers = [];
  driveCord.userData.materialLength = driveCordLength;
  driveCord.userData.role = 'one-inextensible-beam-to-drum-drive-cord';
  root.add(driveCord);

  const counterweightCord = makeDynamicMovingBelt(
    new CounterweightCordCurve(initialState.counterweightCord),
    {
      closed: false,
      color: PALETTE.belt,
      laid: true,
      radius: 0.030,
      tubularSegments: 150,
    },
  );
  // Brown hatches the cords: laid rope, whose lay replaces the markers.
  counterweightCord.userData.markers = [];
  counterweightCord.userData.materialLength = counterweightCordLength;
  counterweightCord.userData.role = 'left-sector-counterweight-cord';
  root.add(counterweightCord);

  const counterweight = new THREE.Group();
  counterweight.position.x = beamPivot.x - sectorRadius;
  counterweight.position.z = sectorCordZ;
  counterweight.userData.role = 'hanging-balance-weight-on-left-cord';
  const weightBody = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 24, 18),
    driverMaterial,
  );
  weightBody.userData.role = 'source-visible-hanging-round-weight';
  counterweight.add(weightBody);
  const weightCollar = cylinderAlongZ(0.07, 0.10, darkMaterial, 18);
  weightCollar.position.z = 0.02;
  weightCollar.userData.role = 'weight-cord-collar';
  counterweight.add(weightCollar);
  root.add(counterweight);

  const pawlBaseRotation = pawlPivotPhase + Math.PI;
  const update = (time) => {
    const state = stateAtTime(time);
    rockingBeam.rotation.z = state.beamAngle;
    looseDrum.rotation.z = state.drumAngle;
    flywheelRotor.rotation.z = state.flywheelAngle;
    pawlHinge.rotation.z = pawlBaseRotation - state.pawlLift;
    counterweight.position.y = state.counterweightCenterY;
    driveCord.userData.setCurve(
      new BeamToDrumCordCurve(state.driveCord),
    );
    driveCord.userData.updateDistance(0);
    counterweightCord.userData.setCurve(
      new CounterweightCordCurve(state.counterweightCord),
    );
    counterweightCord.userData.updateDistance(0);
    root.userData.currentState = state;
  };

  root.userData = {
    archetype: 'oscillating-loose-drum-flywheel-ratchet',
    blocks: {
      beamPivotPin,
      counterweight,
      counterweightCord,
      driveCord,
      drumCordKnot,
      drumBody,
      drumIndex,
      flywheelIndex,
      flywheelRim,
      flywheelRotor,
      flywheelSpokes,
      frame,
      looseDrum,
      pawlArm,
      pawlHinge,
      pawlTip,
      ratchetWheel,
      leftCordKnot,
      rightCordKnot,
      rockingBeam,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      input: 'one externally forced alternating angle of the rocking beam',
      note:
        'the flywheel angle is an inertial history-dependent state, not a fixed instantaneous ratio of beam angle',
      storedEnergyStates: 1,
    },
    dynamics: {
      displayAssumption:
        'the unspecified heavy flywheel and load are represented in periodic steady state by uniform positive shaft speed',
      flywheelAdvancePerCycle,
      flywheelAdvancePerBeamCycle:
        flywheelAdvancePerCycle / beamCyclesPerDemonstration,
      flywheelAngularSpeed,
      sourceSpecifiesInertiaOrLoad: false,
    },
    fidelity: 'authored',
    geometry: {
      beamAmplitude,
      beamCyclesPerDemonstration,
      beamOscillationPeriod,
      beamPivot: beamPivot.clone(),
      cordZ,
      counterweightCordLength,
      cyclePeriod,
      driveCordLength,
      drumAmplitude,
      drumBaseWrap,
      drumCenter: drumCenter.clone(),
      drumRadius,
      drumRatio,
      flywheelRadius,
      pawlMaximumLift,
      ratchetToothCount,
      ratchetToothPitch,
      sectorBaseWrap,
      sectorRadius,
    },
    mechanism:
      'oscillating-cord-drum-with-drum-mounted-pawl-driving-shaft-fixed-ratchet-and-flywheel',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate360: {
        beamPivot: new THREE.Vector2(210, 114),
        drumCenter: new THREE.Vector2(328, 307),
        drumRightTangent: new THREE.Vector2(403, 307),
        flywheelBottom: new THREE.Vector2(326, 484),
        flywheelCenter: new THREE.Vector2(326, 308),
        flywheelRight: new THREE.Vector2(504, 308),
        imageHeight: 525,
        imageWidth: 525,
        leftCordTangent: new THREE.Vector2(29, 113),
        measurementUncertaintyPixels: 8,
        pawlPivot: new THREE.Vector2(303, 247),
        ratchetCenter: new THREE.Vector2(328, 315),
        rightCordTangent: new THREE.Vector2(388, 160),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'beam vibrates',
          'cord is attached to drum',
          'drum is loose on flywheel shaft',
          'pawl is attached to drum',
          'ratchet wheel is fast on shaft',
        ],
        inference:
          'the large spoked wheel, shaft, and ratchet are one rotor; the smaller surrounding drum and its pawl are a distinct oscillating carrier',
      },
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        edition: 21,
        publicationYear: 1908,
      },
    },
    cordGeometry: {
      counterweightCordAtBeamAngle,
      driveCordAtBeamAngle,
    },
    stateAtTime,
    timeline: {
      demonstrationPeriod: cyclePeriod,
      driveStrokeMidpoints: [
        beamOscillationPeriod / 4,
        beamOscillationPeriod * 5 / 4,
      ],
      firstDrumReversal: 0,
      note:
        'Brown supplies no angle, inertia, load, or timing; the periodic schedule is an explicit display choice and does not claim a source-prescribed flywheel speed ratio',
      oppositeDrumReversals: [
        beamOscillationPeriod / 2,
        beamOscillationPeriod * 3 / 2,
      ],
      returnStrokeMidpoints: [
        beamOscillationPeriod * 3 / 4,
        beamOscillationPeriod * 7 / 4,
      ],
    },
    transmission: {
      counterweightCordLaw:
        'left sector arc length plus hanging free length is constant',
      driveCordLaw:
        'right sector arc length plus vertical span plus loose-drum wrap length is constant',
      looseDrumLaw:
        'sectorRadius * beamAngle = drumRadius * drumAngle',
      ratchetLaw:
        'the drum-mounted pawl may push the shaft-fixed ratchet only in the positive sense and overruns on relative return',
      shaftLaw:
        'ratchet wheel, shaft, and flywheel always share one angle and never follow the drum reversal',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.42, -1.58, -0.78),
    new THREE.Vector3(1.78, 3.03, 0.92),
  );
  root.userData.groundFloorY = -1.50;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(4.5, 3.0, 9.2),
    root,
    update,
  };
}

// Brown's twenty-tooth ratchet (the hooked pawl is generated offline), and
// his flat-rimmed, four-flat-spoked flywheel (the shared spoked-wheel
// extrusion) in place of the torus rim and rod spokes.
function fitBrownRatchetAndFlywheel(model) {
  const b = model.root.userData.blocks, p = drumContact;
  let profile = poly(circle([0, 0], p.rootRadius, 160));
  for (let i = 0; i < p.toothCount; i += 1) {
    const a = i * p.pitch, c = Math.cos(a), si = Math.sin(a);
    profile = clip.union(profile, poly(p.profile.map(([x, y]) => [c * x - si * y, si * x + c * y])));
  }
  profile = clip.difference(profile, poly(circle([0, 0], .104, 96)));
  b.ratchetWheel.geometry.dispose();
  b.ratchetWheel.geometry = plate(profile, -.07, .07);
  b.ratchetWheel.userData.toothCount = p.toothCount;
  b.ratchetWheel.userData.toothPitch = p.pitch;
  const rim = b.flywheelRim, R = model.root.userData.geometry.flywheelRadius;
  const wheel = makeSpokedWheel({
    spokes: 4, outerRadius: R + .105, rimInnerRadius: R - .105,
    spokeWidth: .13, hubRadius: .26, boreRadius: .102, thickness: .16,
    rimFillet: .03, hubFillet: .08, role: 'flat-four-spoked-flywheel',
  }, rim.material);
  // Brown draws the frame upright and brace in front of the flywheel. The
  // old rim plane (z -0.27) ran through them, so the wheel now turns behind
  // the rear shaft-bearing post (z -0.73..-0.51) at z -0.86, keyed straight
  // on the shaft, which is lengthened to end just behind it.
  wheel.position.z = -0.86;
  {
    const front = 0.76, back = -0.95;
    let frontShaft = null;
    model.root.traverse((o) => { if (o.userData.role === 'shaft-rigid-with-ratchet-and-flywheel') frontShaft = o; });
    frontShaft.geometry.dispose();
    frontShaft.geometry = new THREE.CylinderGeometry(.10, .10, front - back, 28);
    frontShaft.rotation.set(Math.PI / 2, 0, 0);
    frontShaft.position.z = (front + back) / 2;
  }
  rim.parent.add(wheel);
  rim.visible = false;
  for (const spoke of b.flywheelSpokes) spoke.visible = false;
  b.flywheelWheel = wheel;
  // Brown pivots the pawl on the drum's face well inside the cord band. The
  // drum here is open inside r 0.47, so one round boss, concentric with the
  // pawl pin and merged into the drum body and rim, carries the pawl eye on
  // its face (0.01 behind the pawl), clear of the ratchet tips by 0.04.
  {
    const bossRadius = 0.10;
    const boss = new THREE.Mesh(
      plate(clip.intersection(
        poly(circle(p.pivot, bossRadius, 96)),
        poly(circle([0, 0], 0.595, 192)),
      ), 0.31, 0.575),
      b.drumBody.material,
    );
    boss.userData.role = 'drum-boss-carrying-pawl-pivot';
    b.looseDrum.add(boss);
    markShadows(boss);
    b.pawlPivotBoss = boss;
  }
  // The least-clearance table drops the pawl from each crest in one frame.
  // That snap is physical here: during overrun a tooth passes in about 0.3 s,
  // and a pawl held up for even 0.01 s would have its hooked nose struck by
  // the next crest, so it must be down within a frame.
  return model;
}

export function createAuthoredOscillatingDrumRatchetMovement(movement) {
  if (movement.id !== 360) return null;
  const model = finishOneWayFamily(fitBrownRatchetAndFlywheel(correctOscillatingDrum(oscillatingDrumRatchet(movement))), 360);
  // Display time 0 is Brown's pose: the beam level at mid-swing, a quarter
  // of a beam oscillation into the physical cycle (stateAtTime keeps the
  // physical timeline; the loop stays whole because the shift is constant).
  const data = model.root.userData;
  const sourcePoseTime = data.geometry.beamOscillationPeriod / 4;
  const physicalUpdate = model.update;
  // The flywheel's plain spokes are set back by its advance over that
  // shift, so they stand upright and level at time 0 as Brown draws them.
  const spokeTurn = data.stateAtTime(0).flywheelAngle - data.stateAtTime(sourcePoseTime).flywheelAngle;
  for (const spoke of data.blocks.flywheelSpokes) spoke.rotation.z += spokeTurn;
  data.blocks.flywheelWheel.rotation.z += spokeTurn;
  model.update = (time) => physicalUpdate(time + sourcePoseTime);
  data.timeline.displayTimeOffset = sourcePoseTime;
  model.update(0);
  return model;
}
