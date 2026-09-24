import { dualBandPawlDimensions, pawl390Angle, install390Pawls } from './dual-band-pawl-contact.js';
import { boredAxialCylinder, correctDualBandInterfaces, finishAlternatingDrive } from './alternating-drive-finite-parts.js';
import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { plate, poly, circle, polygonClipping as clip } from './finite-plate-geometry.js';
import {
  PALETTE,
  beltCurveCrossed,
  beltCurveOpen,
  makeDynamicLink,
  makeDynamicMovingBelt,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderAlongZ(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

class PlanarArcCurve3 extends THREE.Curve {
  constructor(center, radius, startAngle, sweep, z) {
    super();
    this.center = center.clone();
    this.radius = radius;
    this.startAngle = startAngle;
    this.sweep = sweep;
    this.z = z;
  }

  getPoint(parameter, target = new THREE.Vector3()) {
    const angle = this.startAngle + this.sweep * parameter;
    return target.set(
      this.center.x + this.radius * Math.cos(angle),
      this.center.y + this.radius * Math.sin(angle),
      this.z,
    );
  }

  getPointAt(parameter, target = new THREE.Vector3()) {
    return this.getPoint(parameter, target);
  }

  getTangent(parameter, target = new THREE.Vector3()) {
    const angle = this.startAngle + this.sweep * parameter;
    const direction = Math.sign(this.sweep) || 1;
    return target.set(
      -Math.sin(angle) * direction,
      Math.cos(angle) * direction,
      0,
    );
  }

  getTangentAt(parameter, target = new THREE.Vector3()) {
    return this.getTangent(parameter, target);
  }

  getLength() {
    return Math.abs(this.sweep) * this.radius;
  }

  getLengths(divisions = 200) {
    const length = this.getLength();
    return Array.from(
      { length: divisions + 1 },
      (_, index) => length * index / divisions,
    );
  }

  getUtoTmapping(value) {
    return value;
  }
}

function angleFrom(center, point) {
  return Math.atan2(point.y - center.y, point.x - center.x);
}

function tangentJoinDot(first, firstParameter, second, secondParameter) {
  return first.getTangent(firstParameter).dot(
    second.getTangent(secondParameter),
  );
}

function anchoredBandCurve({
  crossed,
  lowerCenter,
  lowerRadius,
  rockerAngle,
  sectorCenter,
  sectorRadius,
  upperBaseWrap,
  z,
}) {
  const base = crossed
    ? beltCurveCrossed(
      sectorCenter,
      lowerCenter,
      sectorRadius,
      lowerRadius,
      z,
    )
    : beltCurveOpen(
      sectorCenter,
      lowerCenter,
      sectorRadius,
      lowerRadius,
      z,
    );
  const firstSpan = base.curves[0];
  const lowerArc = base.curves[1];
  const secondSpan = base.curves[2];
  const firstDeparture = firstSpan.getPoint(0);
  const secondDeparture = secondSpan.getPoint(1);
  const firstDepartureAngle = angleFrom(sectorCenter, firstDeparture);
  const secondDepartureAngle = angleFrom(sectorCenter, secondDeparture);
  const firstWrapAngle = upperBaseWrap + rockerAngle;
  const secondWrapAngle = upperBaseWrap - rockerAngle;
  if (firstWrapAngle <= 0 || secondWrapAngle <= 0) {
    throw new RangeError('Rocking sector exhausted an anchored band wrap.');
  }
  const firstAnchorAngle = firstDepartureAngle + firstWrapAngle;
  const secondAnchorAngle = secondDepartureAngle - secondWrapAngle;
  const firstUpperWrap = new PlanarArcCurve3(
    sectorCenter,
    sectorRadius,
    firstAnchorAngle,
    -firstWrapAngle,
    z,
  );
  const secondUpperWrap = new PlanarArcCurve3(
    sectorCenter,
    sectorRadius,
    secondDepartureAngle,
    -secondWrapAngle,
    z,
  );
  const curve = new THREE.CurvePath();
  curve.add(firstUpperWrap);
  curve.add(firstSpan);
  curve.add(lowerArc);
  curve.add(secondSpan);
  curve.add(secondUpperWrap);
  const firstAnchor = firstUpperWrap.getPoint(0);
  const secondAnchor = secondUpperWrap.getPoint(1);
  curve.userData = {
    crossed,
    crossoverLift: base.userData.crossoverLift,
    firstAnchor,
    firstAnchorAngle,
    firstDeparture,
    firstDepartureAngle,
    firstWrapAngle,
    fixedLowerAndSpanLength: firstSpan.getLength()
      + lowerArc.getLength() + secondSpan.getLength(),
    joinTangentDots: [
      tangentJoinDot(firstUpperWrap, 1, firstSpan, 0),
      tangentJoinDot(firstSpan, 1, lowerArc, 0),
      tangentJoinDot(lowerArc, 1, secondSpan, 0),
      tangentJoinDot(secondSpan, 1, secondUpperWrap, 0),
    ],
    secondAnchor,
    secondAnchorAngle,
    secondDeparture,
    secondDepartureAngle,
    secondWrapAngle,
    upperWrapLength: sectorRadius
      * (firstWrapAngle + secondWrapAngle),
  };
  return curve;
}

function makeRatchetWheel({
  depth,
  material,
  outerRadius,
  rootRadius,
  toothCount,
  z,
  role,
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
  wheel.userData.role = role;
  wheel.userData.toothCount = toothCount;
  wheel.userData.toothPitch = pitch;
  return wheel;
}

function makeLoosePulleyCarrier({
  beltMaterial,
  darkMaterial,
  pawlMaterial,
  planeZ,
  pulleyRadius,
  ratchetOuterRadius,
  role,
  whiteMaterial,
}) {
  const carrier = new THREE.Group();
  carrier.userData.role = role;

  const pulley = cylinderAlongZ(
    pulleyRadius * 0.90,
    0.22,
    beltMaterial,
    48,
  );
  pulley.position.z = planeZ;
  pulley.userData.role = `${role}-loose-band-pulley-body`;
  carrier.add(pulley);

  const groove = new THREE.Mesh(
    new THREE.TorusGeometry(pulleyRadius, 0.052, 10, 56),
    darkMaterial,
  );
  groove.position.z = planeZ;
  groove.userData.role = `${role}-band-groove`;
  carrier.add(groove);

  const hub = cylinderAlongZ(0.13, 0.27, darkMaterial, 26);
  hub.position.z = planeZ;
  hub.userData.role = `${role}-loose-shaft-bushing`;
  carrier.add(hub);

  const faceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(pulleyRadius * 0.62, 0.055, 0.030),
    whiteMaterial,
  );
  faceIndex.position.set(
    pulleyRadius * 0.34,
    0,
    planeZ + 0.13,
  );
  faceIndex.userData.role = 'white-loose-pulley-spin-index';
  carrier.add(faceIndex);

  const pawlPhase = 0.72;
  const pawlHingeRadius = pulleyRadius * 0.73;
  const pawlLength = pawlHingeRadius - ratchetOuterRadius * 0.91;
  const pawl = new THREE.Group();
  pawl.position.set(
    pawlHingeRadius * Math.cos(pawlPhase),
    pawlHingeRadius * Math.sin(pawlPhase),
    planeZ + 0.15,
  );
  pawl.userData.baseAngle = pawlPhase + Math.PI;
  pawl.userData.role = `${role}-ratchet-driving-pawl`;
  const pawlBody = makeDynamicLink({
    color: PALETTE.ink,
    depth: 0.065,
    jointRadius: 0.052,
    thickness: 0.065,
  });
  pawlBody.userData.setEndpoints(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(pawlLength, 0, 0),
  );
  pawlBody.userData.role = `${role}-spring-loaded-pawl-body`;
  pawl.add(pawlBody);
  const pawlPin = cylinderAlongZ(0.060, 0.12, pawlMaterial, 20);
  pawlPin.userData.role = `${role}-pawl-hinge-pin`;
  pawl.add(pawlPin);
  const contactIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 16, 10),
    whiteMaterial,
  );
  contactIndex.position.x = pawlLength;
  contactIndex.userData.role = `${role}-white-active-pawl-contact-index`;
  pawl.add(contactIndex);
  carrier.add(pawl);

  carrier.userData.contactIndex = contactIndex;
  carrier.userData.faceIndex = faceIndex;
  carrier.userData.groove = groove;
  carrier.userData.hub = hub;
  carrier.userData.pawl = pawl;
  carrier.userData.pawlBody = pawlBody;
  carrier.userData.pawlLength = pawlLength;
  carrier.userData.pulley = pulley;
  return markShadows(carrier);
}

function dualBandOscillationRectifier(movement) {
  const root = new THREE.Group();

  const sectorCenter = new THREE.Vector2(0, 2.76);
  const lowerCenter = new THREE.Vector2(0, 0);
  const sectorRadius = 1.65;
  const loosePulleyRadius = 0.50;
  const pulleyRatio = sectorRadius / loosePulleyRadius;
  const carrierOvertravel = dualBandPawlDimensions.overtravel;
  const carrierAmplitude = (Math.PI + carrierOvertravel) / 2;
  const rockerAmplitude = carrierAmplitude / pulleyRatio;
  const upperBaseWrap = 0.57;
  const cycleDuration = 8;
  const inputAngularFrequency = FULL_TURN / cycleDuration;
  const flywheelRadius = 1.42;
  const ratchetToothCount = 12;
  const ratchetToothPitch = FULL_TURN / ratchetToothCount;
  const ratchetOuterRadius = 0.34;
  const ratchetRootRadius = 0.255;
  const pawlMaximumLift = 0.29;
  const openPlaneZ = 0.29;
  const crossedPlaneZ = 0.73;
  const outputAdvancePerCycle = FULL_TURN;

  const openCurveAtAngle = (rockerAngle) => anchoredBandCurve({
    crossed: false,
    lowerCenter,
    lowerRadius: loosePulleyRadius,
    rockerAngle,
    sectorCenter,
    sectorRadius,
    upperBaseWrap,
    z: openPlaneZ,
  });
  const crossedCurveAtAngle = (rockerAngle) => anchoredBandCurve({
    crossed: true,
    lowerCenter,
    lowerRadius: loosePulleyRadius,
    rockerAngle,
    sectorCenter,
    sectorRadius,
    upperBaseWrap,
    z: crossedPlaneZ,
  });
  const initialOpenCurve = openCurveAtAngle(0);
  const initialCrossedCurve = crossedCurveAtAngle(0);
  const openBandLength = initialOpenCurve.getLength();
  const crossedBandLength = initialCrossedCurve.getLength();

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.68,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.11,
    roughness: 0.59,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.54,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.29,
    roughness: 0.43,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.23,
    roughness: 0.48,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0,
    roughness: 0.43,
  });

  const frame = new THREE.Group();
  frame.userData.role = 'fixed-two-shaft-rectifier-bearing-frame';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(3.65, 0.22, 1.55),
    frameMaterial,
  );
  base.position.set(0, -1.61, -0.18);
  base.userData.role = 'rectifier-frame-base';
  frame.add(base);
  for (const side of [-1, 1]) {
    const post = makeDynamicLink({
      color: PALETTE.frame,
      depth: 0.20,
      jointRadius: 0.001,
      thickness: 0.18,
    });
    post.userData.setEndpoints(
      new THREE.Vector3(side * 1.48, -1.50, -0.55),
      new THREE.Vector3(side * 0.36, sectorCenter.y, -0.55),
    );
    post.userData.role = 'fixed-rocker-pivot-frame-side';
    frame.add(post);
  }
  const lowerBearingPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 1.53, 0.28),
    frameMaterial,
  );
  lowerBearingPost.position.set(0, -0.78, -0.68);
  lowerBearingPost.userData.role = 'fixed-flywheel-shaft-bearing-post';
  frame.add(lowerBearingPost);
  root.add(frame);

  const rockingSector = new THREE.Group();
  rockingSector.position.set(sectorCenter.x, sectorCenter.y, 0);
  rockingSector.userData.role = 'fulcrumed-semicircular-piece-A-and-lever';
  root.add(rockingSector);
  const sectorArc = new THREE.Mesh(
    new THREE.TubeGeometry(
      new PlanarArcCurve3(
        new THREE.Vector2(0, 0),
        sectorRadius,
        Math.PI,
        Math.PI,
        0.49,
      ),
      96,
      0.13,
      12,
      false,
    ),
    driverMaterial,
  );
  sectorArc.userData.role = 'rigid-lower-semicircular-rim-A';
  rockingSector.add(sectorArc);
  for (const z of [openPlaneZ, crossedPlaneZ]) {
    const groove = new THREE.Mesh(
      new THREE.TubeGeometry(
        new PlanarArcCurve3(
          new THREE.Vector2(0, 0),
          sectorRadius,
          Math.PI,
          Math.PI,
          z,
        ),
        96,
        0.035,
        8,
        false,
      ),
      darkMaterial,
    );
    groove.userData.role = 'semicircular-piece-band-groove';
    rockingSector.add(groove);
  }
  // Bar with Brown's round boss at fulcrum a, bored for the fixed pin.
  const topLever = new THREE.Mesh(
    plate(clip.difference(
      clip.union(
        poly([[-2.225, -0.08], [2.225, -0.08], [2.225, 0.08], [-2.225, 0.08]]),
        poly(circle([0, 0], 0.25, 96)),
      ),
      poly(circle([0, 0], 0.137, 96)),
    ), -0.19, 0.19),
    driverMaterial,
  );
  topLever.position.z = 0.49;
  topLever.userData.role = 'operating-lever-rigid-with-piece-A';
  rockingSector.add(topLever);
  for (const phase of [Math.PI, Math.PI * 1.5, FULL_TURN]) {
    const spoke = makeDynamicLink({
      color: PALETTE.driver,
      depth: 0.13,
      jointRadius: 0.001,
      thickness: 0.10,
    });
    spoke.userData.setEndpoints(
      new THREE.Vector3(0, 0, 0.49),
      new THREE.Vector3(
        sectorRadius * Math.cos(phase),
        sectorRadius * Math.sin(phase),
        0.49,
      ),
    );
    spoke.userData.role = 'piece-A-rigid-radial-web';
    rockingSector.add(spoke);
  }
  const rockerIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.055, 0.035),
    whiteMaterial,
  );
  rockerIndex.position.set(0.37, 0, 0.70);
  rockerIndex.userData.role = 'white-rocking-piece-angle-index';
  rockingSector.add(rockerIndex);

  const pivotPin = cylinderAlongZ(0.13, 1.10, darkMaterial, 32);
  pivotPin.position.set(sectorCenter.x, sectorCenter.y, 0.20);
  pivotPin.userData.role = 'fixed-fulcrum-a';
  root.add(pivotPin);

  const anchorKnots = [];
  for (const [curve, plane, bandName] of [
    [initialOpenCurve, openPlaneZ, 'open-band-C'],
    [initialCrossedCurve, crossedPlaneZ, 'crossed-band-D'],
  ]) {
    for (const [anchorNumber, angle] of [
      [0, curve.userData.firstAnchorAngle],
      [1, curve.userData.secondAnchorAngle],
    ]) {
      const knot = new THREE.Mesh(
        new THREE.SphereGeometry(0.070, 16, 10),
        brassMaterial,
      );
      knot.position.set(
        sectorRadius * Math.cos(angle),
        sectorRadius * Math.sin(angle),
        plane,
      );
      knot.userData.anchorNumber = anchorNumber;
      knot.userData.bandName = bandName;
      knot.userData.role = `${bandName}-end-fixed-to-piece-A`;
      rockingSector.add(knot);
      anchorKnots.push(knot);
    }
  }

  const flywheelRotor = new THREE.Group();
  flywheelRotor.position.set(lowerCenter.x, lowerCenter.y, 0);
  flywheelRotor.userData.role = 'continuous-one-direction-flywheel-B-shaft';
  root.add(flywheelRotor);
  // Brown draws flywheel B with a broad flat rim on four spokes.
  const flywheelRim = new THREE.Mesh(boredLatheGeometry([
    { axial: -0.12, radial: flywheelRadius + 0.12 },
    { axial: 0.12, radial: flywheelRadius + 0.12 },
  ], flywheelRadius - 0.30, 128), drivenMaterial);
  flywheelRim.rotation.x = Math.PI / 2;
  flywheelRim.position.z = -0.42;
  flywheelRim.userData.role = 'heavy-flywheel-B-rim-fast-on-shaft';
  flywheelRotor.add(flywheelRim);
  const flywheelSpokes = [];
  for (let index = 0; index < 4; index += 1) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(flywheelRadius * 1.74, 0.12, 0.16),
      drivenMaterial,
    );
    spoke.rotation.z = index * Math.PI / 2;
    spoke.position.z = -0.42;
    spoke.userData.role = 'flywheel-B-spoke-fast-on-shaft';
    flywheelRotor.add(spoke);
    flywheelSpokes.push(spoke);
  }
  const flywheelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.065, 0.035),
    whiteMaterial,
  );
  flywheelIndex.position.set(flywheelRadius - 0.40, 0, -0.31);
  flywheelIndex.userData.role = 'white-continuous-flywheel-spin-index';
  flywheelRotor.add(flywheelIndex);

  const openRatchet = makeRatchetWheel({
    depth: 0.10,
    material: brassMaterial,
    outerRadius: ratchetOuterRadius,
    role: 'open-band-ratchet-wheel-fast-on-flywheel-shaft',
    rootRadius: ratchetRootRadius,
    toothCount: ratchetToothCount,
    // Clear of the loose pulley's face (0.11) and its shortened hub.
    z: openPlaneZ + 0.165,
  });
  const crossedRatchet = makeRatchetWheel({
    depth: 0.10,
    material: brassMaterial,
    outerRadius: ratchetOuterRadius,
    role: 'crossed-band-ratchet-wheel-fast-on-flywheel-shaft',
    rootRadius: ratchetRootRadius,
    toothCount: ratchetToothCount,
    z: crossedPlaneZ + 0.165,
  });
  flywheelRotor.add(openRatchet, crossedRatchet);
  const shaft = cylinderAlongZ(0.105, 1.78, darkMaterial, 28);
  shaft.position.z = 0.02;
  shaft.userData.role = 'shaft-fast-with-both-ratchets-and-flywheel';
  flywheelRotor.add(shaft);

  const openCarrier = makeLoosePulleyCarrier({
    beltMaterial: drivenMaterial,
    darkMaterial,
    pawlMaterial: brassMaterial,
    planeZ: openPlaneZ,
    pulleyRadius: loosePulleyRadius,
    ratchetOuterRadius,
    role: 'open-band-C-loose-pulley-carrier',
    whiteMaterial,
  });
  openCarrier.position.set(lowerCenter.x, lowerCenter.y, 0);
  root.add(openCarrier);
  const crossedCarrier = makeLoosePulleyCarrier({
    beltMaterial: brassMaterial,
    darkMaterial,
    pawlMaterial: brassMaterial,
    planeZ: crossedPlaneZ,
    pulleyRadius: loosePulleyRadius,
    ratchetOuterRadius,
    role: 'crossed-band-D-loose-pulley-carrier',
    whiteMaterial,
  });
  crossedCarrier.position.set(lowerCenter.x, lowerCenter.y, 0);
  root.add(crossedCarrier);

  const openBand = makeDynamicMovingBelt(initialOpenCurve, {
    closed: false,
    color: PALETTE.ink,
    markerColor: PALETTE.white,
    markerCount: 6,
    radius: 0.034,
    tubularSegments: 220,
    // Brown draws flat leather bands, not round cord.
    thickness: 0.04,
    width: 0.05,
    widthDirection: new THREE.Vector3(0, 0, 1),
  });
  openBand.userData.isBelt = true;
  openBand.userData.markers = openBand.children.slice(0, 6);
  openBand.userData.markers.forEach((marker) => {
    marker.userData.role = 'open-band-C-fixed-material-marker';
  });
  openBand.userData.role = 'one-open-uncrossed-band-C';
  root.add(openBand);
  const crossedBand = makeDynamicMovingBelt(initialCrossedCurve, {
    closed: false,
    color: PALETTE.brass,
    markerColor: PALETTE.white,
    markerCount: 6,
    radius: 0.034,
    tubularSegments: 220,
    // Brown draws flat leather bands, not round cord.
    thickness: 0.04,
    width: 0.05,
    widthDirection: new THREE.Vector3(0, 0, 1),
  });
  crossedBand.userData.isBelt = true;
  crossedBand.userData.markers = crossedBand.children.slice(0, 6);
  crossedBand.userData.markers.forEach((marker) => {
    marker.userData.role = 'crossed-band-D-fixed-material-marker';
  });
  crossedBand.userData.role = 'one-crossed-band-D-with-axial-crossover';
  root.add(crossedBand);

  const accumulatedRockerTravel = (phase, rockerAngle) => {
    if (phase < 0.25) return rockerAngle;
    if (phase < 0.75) return 2 * rockerAmplitude - rockerAngle;
    return 4 * rockerAmplitude + rockerAngle;
  };

  const pawlState = (flywheelAngle, carrierAngle, active, overrunning, advance) => {
    const relativeAngle = flywheelAngle - carrierAngle;
    const relativeToothPhase = positiveModulo(
      relativeAngle,
      ratchetToothPitch,
    ) / ratchetToothPitch;
    const contactError = relativeAngle
      - Math.round(relativeAngle / ratchetToothPitch)
        * ratchetToothPitch;
    return {
      active,
      contactError: active ? contactError : null,
      liftAngle: pawl390Angle(relativeAngle, { overrunning, advance })
        - dualBandPawlDimensions.seatAngle,
      overrunning,
      advance,
      takingUp: !active && !overrunning,
      relativeAngle,
      relativeToothPhase,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = positiveModulo(time, cycleDuration);
    const phase = cycleTime / cycleDuration;
    const phaseAngle = FULL_TURN * phase;
    const rockerAngle = rockerAmplitude * Math.sin(phaseAngle);
    const rockerAngularSpeed = rockerAmplitude
      * inputAngularFrequency * Math.cos(phaseAngle);
    const openPulleyAngle = pulleyRatio * rockerAngle;
    const crossedPulleyAngle = -pulleyRatio * rockerAngle;
    const openPulleyAngularSpeed = pulleyRatio * rockerAngularSpeed;
    const crossedPulleyAngularSpeed = -pulleyRatio * rockerAngularSpeed;
    const rockerTravel = accumulatedRockerTravel(phase, rockerAngle);
    // The extra carrier travel lets an overrunning toe finish its finite drop.
    // On reversal the new carrier takes up that clearance before driving.
    const flywheelAngle = phase < .25 ? openPulleyAngle
      : phase < .75 ? Math.max(carrierAmplitude, crossedPulleyAngle + Math.PI)
        : Math.max(carrierAmplitude + Math.PI, openPulleyAngle + FULL_TURN);
    const openDriving = phase < .25 || (phase >= .75
      && openPulleyAngle + FULL_TURN >= carrierAmplitude + Math.PI - 1e-13);
    const crossedDriving = phase >= .25 && phase < .75
      && crossedPulleyAngle + Math.PI >= carrierAmplitude - 1e-13;
    const flywheelAngularSpeed = openDriving ? Math.max(0, openPulleyAngularSpeed)
      : crossedDriving ? Math.max(0, crossedPulleyAngularSpeed) : 0;
    const atHandoff = !openDriving && !crossedDriving;
    const openPawl = pawlState(
      flywheelAngle,
      openPulleyAngle,
      openDriving,
      phase >= .25 && phase < .75,
      flywheelAngle - openPulleyAngle,
    );
    const crossedPawl = pawlState(
      flywheelAngle,
      crossedPulleyAngle,
      crossedDriving,
      phase < .25 || phase >= .75,
      flywheelAngle - crossedPulleyAngle + (phase < .25 ? Math.PI : -Math.PI),
    );
    const openCurve = openCurveAtAngle(rockerAngle);
    const crossedCurve = crossedCurveAtAngle(rockerAngle);
    return {
      activeDrive: atHandoff
        ? 'output-dwell-during-finite-pawl-take-up'
        : openDriving
          ? 'open-band-C-pawl-driving'
          : 'crossed-band-D-pawl-driving',
      crossedBandMaterialTravel: -sectorRadius * rockerAngle,
      crossedCurve,
      crossedPawl,
      crossedPulleyAngle,
      crossedPulleyAngularSpeed,
      cycleTime,
      flywheelAngle,
      flywheelAngularSpeed,
      openBandMaterialTravel: sectorRadius * rockerAngle,
      openCurve,
      openPawl,
      openPulleyAngle,
      openPulleyAngularSpeed,
      phase,
      rockerAngle,
      rockerAngularSpeed,
      rockerTravel,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    rockingSector.rotation.z = state.rockerAngle;
    openCarrier.rotation.z = state.openPulleyAngle;
    crossedCarrier.rotation.z = state.crossedPulleyAngle;
    flywheelRotor.rotation.z = state.flywheelAngle;
    openCarrier.userData.pawl.rotation.z =
      openCarrier.userData.pawl.userData.baseAngle
      + state.openPawl.liftAngle;
    crossedCarrier.userData.pawl.rotation.z =
      crossedCarrier.userData.pawl.userData.baseAngle
      + state.crossedPawl.liftAngle;
    openCarrier.userData.contactIndex.visible = state.openPawl.active;
    crossedCarrier.userData.contactIndex.visible = state.crossedPawl.active;
    openBand.userData.setCurve(state.openCurve);
    openBand.userData.updateDistance(state.openBandMaterialTravel);
    crossedBand.userData.setCurve(state.crossedCurve);
    crossedBand.userData.updateDistance(
      state.crossedBandMaterialTravel,
    );
    root.userData.contacts = {
      crossedPawlToFastRatchet: {
        active: state.crossedPawl.active,
        contactError: state.crossedPawl.contactError,
        relativeToothPhase: state.crossedPawl.relativeToothPhase,
      },
      openPawlToFastRatchet: {
        active: state.openPawl.active,
        contactError: state.openPawl.contactError,
        relativeToothPhase: state.openPawl.relativeToothPhase,
      },
    };
    root.userData.kinematics = state;
  };

  root.userData = {
    archetype:
      'rocking-semicircular-sector-open-and-crossed-anchored-bands-dual-loose-pulley-ratchet-flywheel-rectifier',
    blocks: {
      anchorKnots,
      crossedBand,
      crossedBandMarkers: crossedBand.userData.markers,
      crossedCarrier,
      crossedCarrierFaceIndex: crossedCarrier.userData.faceIndex,
      crossedPawl: crossedCarrier.userData.pawl,
      crossedPawlContactIndex: crossedCarrier.userData.contactIndex,
      crossedRatchet,
      flywheelIndex,
      flywheelRim,
      flywheelRotor,
      flywheelSpokes,
      frame,
      openBand,
      openBandMarkers: openBand.userData.markers,
      openCarrier,
      openCarrierFaceIndex: openCarrier.userData.faceIndex,
      openPawl: openCarrier.userData.pawl,
      openPawlContactIndex: openCarrier.userData.contactIndex,
      openRatchet,
      pivotPin,
      rockerIndex,
      rockingSector,
      sectorArc,
      shaft,
      topLever,
    },
    constraintResiduals: {
      crossedBandInitialLength:
        initialCrossedCurve.getLength() - crossedBandLength,
      openBandInitialLength:
        initialOpenCurve.getLength() - openBandLength,
      outputCycleClosure: outputAdvancePerCycle - FULL_TURN,
      pulleyRatioClosure:
        loosePulleyRadius * pulleyRatio - sectorRadius,
      upperWrapSum:
        initialOpenCurve.userData.upperWrapLength
          - 2 * sectorRadius * upperBaseWrap,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      inputs: ['oscillation angle of fulcrumed semicircular piece A'],
      note:
        'the two fixed-length bands impose equal and opposite loose-pulley angles; opposed one-way pawls alternately couple the positive-moving pulley to two ratchets fast on the common flywheel shaft',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'piece A and its lever are one rigid oscillator about fixed fulcrum a',
        'bands C and D are inextensible, remain tangent to equal loose pulleys, and occupy separate axial planes',
        'the crossed band uses equal and opposite crossover lifts so its two free spans cannot intersect',
        'pawls and ratchets are rigid and frictionless; the active carrier matches shaft speed while the inactive pawl overruns',
        'flywheel inertia, torque ripple, belt mass and compliance, impact and friction are omitted; dimensions, sinusoidal input, one-turn display ratio, materials, depth and camera are reconstruction decisions',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      treatment:
        'constant-length anchored bands, no-slip carrier angles, finite geometric pawl contact with prescribed return and analytic take-up; no passive force solution',
    },
    fidelity: 'authored',
    geometry: {
      carrierOvertravel,
      carrierAmplitude,
      crossedBandLength,
      crossedPlaneZ,
      flywheelRadius,
      lowerCenter: lowerCenter.clone(),
      loosePulleyRadius,
      openBandLength,
      openPlaneZ,
      outputAdvancePerCycle,
      pawlMaximumLift,
      pulleyRatio,
      ratchetOuterRadius,
      ratchetRootRadius,
      ratchetToothCount,
      ratchetToothPitch,
      rockerAmplitude,
      sectorCenter: sectorCenter.clone(),
      sectorRadius,
      upperBaseWrap,
    },
    mechanism:
      'one-fulcrumed-semicircular-piece-A-two-simultaneous-fixed-end-bands-C-open-and-D-crossed-two-coaxial-loose-pulley-pawl-carriers-two-ratchets-fast-on-one-continuously-positive-flywheel-B-shaft',
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'the official Movement 390 page exposes no canvas animation; topology, belt routing, clutching sequence, and output direction are reconstructed from Brown\'s public-domain engraving and description',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate390: {
        crossedBandLabelPixels: [231, 258],
        flywheelCenterPixels: [260, 329],
        flywheelOuterRadiusPixels: 132,
        fulcrumAPixels: [253, 94],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 9,
        openBandLabelPixels: [346, 294],
        pieceAOuterArcPixels: {
          bottomY: 254,
          leftX: 96,
          rightX: 410,
          topY: 95,
        },
        pulleyAndRatchetRegionPixels: {
          maximumX: 315,
          maximumY: 376,
          minimumX: 210,
          minimumY: 271,
        },
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'semicircular piece A is rigid with a lever working about fulcrum a',
          'the ends of bands C and D are attached to A and run around two pulleys loose on the flywheel shaft',
          'band C is open and band D is crossed',
          'each loose pulley carries a pawl engaging its own ratchet wheel fast on the flywheel shaft',
          'the two pawls act on opposite directions of A and yield continuous one-direction shaft rotation',
        ],
        engravingEvidence:
          'the plate places the semicircular yoke above two superposed band paths and two coaxial loose-pulley/ratchet layers at the center of flywheel B',
        reconstructionDisclosure:
          'no official animation is available; the exact compensated sector wraps, tangent paths, crossover separation, radii, oscillation law and amplitude, twelve-tooth ratchets, one-turn display closure, pawl lift, axial stack, frame, materials, indexes, and camera are independently engineered',
      },
      officialPage: movement.sourceUrl,
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      cycleDuration,
      demonstrationPeriod: cycleDuration,
      events: {
        crossedPawlTakesDrive: cycleDuration * (.25 + Math.acos(1 - carrierOvertravel / carrierAmplitude) / FULL_TURN),
        crossedCarrierReverses: cycleDuration * .25,
        openPawlRetakesDrive: cycleDuration * (.75 + Math.acos(1 - carrierOvertravel / carrierAmplitude) / FULL_TURN),
        openCarrierReverses: cycleDuration * .75,
        oneInputOscillationAndOutputTurn: cycleDuration,
      },
      note:
        'one oscillation gives one positive output turn with brief stationary take-up after each carrier reversal; finite drop is prescribed and impact at pickup is omitted',
    },
    transmission: {
      bandLengthLaw:
        'each band has fixed lower wrap and tangent spans plus upper sector wraps R*(base+alpha) and R*(base-alpha), whose sum is constant',
      beltDirectionLaw:
        'open C gives theta_C=(R/r)*alpha while crossed D gives theta_D=-(R/r)*alpha',
      outputLaw:
        'theta_B follows the positive carrier after finite take-up; omega_B is either abs(omega_carrier) or zero during the two short dwells',
      pawlLaw:
        'a carrier with positive angular speed takes up the finite drop allowance before its pawl seats; the opposite pawl follows the finite tooth envelope',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.48, -1.87, -1.15),
    new THREE.Vector3(2.48, 3.28, 1.15),
  );
  root.userData.cameraDistanceScale = 1.17;
  root.userData.groundFloorY = -1.74;
  correctDualBandInterfaces(root);
  // The loose hubs end short of the fast ratchet wheels beside them.
  for (const carrier of [openCarrier, crossedCarrier]) {
    const {hub} = carrier.userData;
    hub.geometry.dispose();
    hub.geometry = boredAxialCylinder(0.13, 0.108, 0.21);
  }
  install390Pawls(root);
  finishAlternatingDrive(root, update, cycleDuration);
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.15, 0.12, 12),
    root,
    update,
  };
}

export function createAuthoredDualBandRatchetMovement(movement) {
  if (movement.id !== 390) return null;
  return dualBandOscillationRectifier(movement);
}
