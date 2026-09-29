import * as THREE from 'three';
import { LaidRopeGeometry } from './laid-rope.js';
import { makeCrownRatchetGeometry, capstanPawlDimensions, capstanPawlProfile, capstanPawlReleasePhase, capstanPawlSeatPhase, capstanPawlSeatedPitch } from './capstan-pawl-contact.js';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { plate, poly, circle, polygonClipping } from './finite-plate-geometry.js';
import { capstanHeadGeometry, capstanSocketRimGeometry, capstanPackingProgress, capstanPawlGeometry } from './capstan-finite-parts.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderAlongZ(radius, length, material, segments = 24) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

class CapstanCableCurve extends THREE.Curve {
  constructor({
    barrelRadius,
    entryHeight,
    freeEndX,
    helixRise,
    wrapAngle,
  }) {
    super();
    this.barrelRadius = barrelRadius;
    this.entryHeight = entryHeight;
    this.freeEndX = freeEndX;
    this.freeSpanLength = freeEndX;
    this.helixProjectedLength = barrelRadius * wrapAngle;
    this.helixRise = helixRise;
    this.parameterLength = this.freeSpanLength
      + this.helixProjectedLength;
    this.wrapAngle = wrapAngle;
    this.arcLengthDivisions = 1600;
  }

  getPoint(value, target = new THREE.Vector3()) {
    const routeDistance = THREE.MathUtils.clamp(value, 0, 1)
      * this.parameterLength;
    if (routeDistance <= this.freeSpanLength) {
      return target.set(
        this.freeEndX - routeDistance,
        this.entryHeight,
        this.barrelRadius,
      );
    }
    const wrapDistance = routeDistance - this.freeSpanLength;
    const progress = wrapDistance / this.helixProjectedLength;
    const angle = Math.PI / 2 + this.wrapAngle * progress;
    return target.set(
      this.barrelRadius * Math.cos(angle),
      this.entryHeight - this.helixRise * capstanPackingProgress(progress, this.wrapAngle),
      this.barrelRadius * Math.sin(angle),
    );
  }
}

function commonCapstan(movement) {
  const root = new THREE.Group();

  // Brown fixes the topology but supplies no scale or operating speed. These
  // dimensions preserve the measured silhouette of plate 491 and leave the
  // pawl/ratchet contact open to inspection from the selected camera.
  const barrelRadius = 0.696;
  const ropeRadius = 0.055;
  const wrapCount = 3;
  const wrapAngle = wrapCount * FULL_TURN;
  const helixRise = 0.42;
  const ropeEntryHeight = 0.18;
  const freeCableEndX = 4.05;
  const handSpikeLength = 5.85;
  const headRadius = 1.30;
  const operatingPeriod = 8;
  // Mean hauling rate over the cycle (one turn per period).
  const operatingAngularSpeed = FULL_TURN / operatingPeriod;

  const ratchetToothCount = 18;
  const ratchetToothPitch = FULL_TURN / ratchetToothCount;
  const pawlDimensions = capstanPawlDimensions;
  const ratchetInnerRadius = pawlDimensions.innerRadius;
  const ratchetOuterRadius = pawlDimensions.outerRadius;
  const ratchetBottomHeight = pawlDimensions.bottomHeight;
  const ratchetLowHeight = pawlDimensions.lowHeight;
  const ratchetHighHeight = pawlDimensions.highHeight;
  // Brown's pawl swings in the plane of his drawing: flat against the front
  // of the lower capstan on a radial pivot pin, its nose hanging down and
  // toward the recoil side onto the crown teeth. Brown draws it holding: its
  // nose seated in the root of a tooth against the face. Each cycle opens in
  // that pose, hauls one turn and a little more, then eases off: the load
  // backs the capstan until the nose, sliding down the ramp it landed on,
  // seats in the root against the face again (tooth phases are measured
  // from the crest release).
  const pawlFreefallFraction = pawlDimensions.releaseFraction;
  const pawlInitialReleasePhase = capstanPawlSeatPhase;
  const pawlHaulEndPhase = pawlFreefallFraction + 0.035;
  const recoilTeeth = pawlHaulEndPhase - capstanPawlSeatPhase;
  const haulAngle = (ratchetToothCount + recoilTeeth) * FULL_TURN / ratchetToothCount;
  const recoilAngle = recoilTeeth * FULL_TURN / ratchetToothCount;
  const haulDuration = 6.9, haulRamp = 0.8, recoilDuration = 0.6;
  const haulPeakSpeed = haulAngle / (haulDuration - haulRamp);
  // Smooth start and stop: the speed eases in and out over haulRamp.
  const rampIntegral = x => x ** 3 - x ** 4 / 2;
  const rampRate = x => 3 * x ** 2 - 2 * x ** 3;
  const cycleAngle = (cycleTime) => {
    if (cycleTime <= haulDuration) {
      const t = cycleTime;
      if (t < haulRamp) return { angle: haulPeakSpeed * haulRamp * rampIntegral(t / haulRamp), rate: haulPeakSpeed * rampRate(t / haulRamp), stage: 'haul' };
      const left = haulDuration - t;
      if (left < haulRamp) return { angle: haulAngle - haulPeakSpeed * haulRamp * rampIntegral(left / haulRamp), rate: haulPeakSpeed * rampRate(left / haulRamp), stage: 'haul' };
      return { angle: haulPeakSpeed * (haulRamp / 2 + t - haulRamp), rate: haulPeakSpeed, stage: 'haul' };
    }
    const u = Math.min(1, (cycleTime - haulDuration) / recoilDuration);
    const smooth = u ** 3 * (10 + u * (-15 + 6 * u));
    const smoothRate = 30 * u ** 2 * (1 - u) ** 2 / recoilDuration;
    return {
      angle: haulAngle - recoilAngle * smooth,
      rate: -recoilAngle * smoothRate,
      stage: u < 1 ? 'recoil' : 'held',
    };
  };
  const pawlPivotAzimuth = pawlDimensions.pivotAzimuth;
  const pawlPlaneRadius = pawlDimensions.planeRadius;
  const pawlPivotHeight = pawlDimensions.pivotHeight;
  const pawlLength = pawlDimensions.length;
  const ratchetPhaseOffset = pawlPivotAzimuth
    - (capstanPawlReleasePhase + pawlInitialReleasePhase) * ratchetToothPitch;

  const toothSurfaceAtAzimuth = (azimuthRadian) => {
    const unwrappedToothCoordinate =
      (azimuthRadian - ratchetPhaseOffset) / ratchetToothPitch;
    const toothIndex = Math.floor(unwrappedToothCoordinate);
    const toothPhase = positiveModulo(unwrappedToothCoordinate, 1);
    return {
      azimuthRadian,
      height: THREE.MathUtils.lerp(
        ratchetLowHeight,
        ratchetHighHeight,
        toothPhase,
      ),
      toothIndex,
      toothPhase,
    };
  };

  // azimuthRadian is the world azimuth of the pawl's radial pivot pin. The
  // seated branch is the pawl lying below the crest line (after a drop, and
  // while the capstan backs off onto the tooth face).
  const pawlClosureAtAzimuth = (azimuthRadian, { seated = false } = {}) => {
    const toothSurface = toothSurfaceAtAzimuth(azimuthRadian);
    const releasePhase = toothSurface.toothPhase - capstanPawlReleasePhase;
    const finite = seated
      ? { phase: 1, pitch: capstanPawlSeatedPitch(releasePhase), airborneClearance: 0, falling: false }
      : capstanPawlProfile(releasePhase);
    const pawlPitchAngleRadian = finite.pitch;
    const verticalDifference = pawlLength * Math.sin(pawlPitchAngleRadian);
    const pawlTipHeight = pawlPivotHeight + verticalDifference;
    const falling = finite.falling;
    const fallProgress = Math.min(1, finite.phase / pawlFreefallFraction);
    // The nose trails the pivot tangentially, in the pawl's own plane.
    const tangentialProjection = pawlLength
      * Math.cos(pawlPitchAngleRadian);
    const pawlTipRadius = Math.hypot(pawlPlaneRadius, tangentialProjection);
    return {
      airborneClearance: finite.airborneClearance,
      finiteTipRadius: pawlDimensions.noseRadius,
      contactingRamp: !falling,
      fallProgress,
      falling,
      pawlPitchAngleRadian,
      pawlTipHeight,
      pawlTipRadius,
      tangentialProjection,
      toothSurface,
      verticalDifference,
    };
  };

  const cableCurve = new CapstanCableCurve({
    barrelRadius,
    entryHeight: ropeEntryHeight,
    freeEndX: freeCableEndX,
    helixRise,
    wrapAngle,
  });
  const cablePathLength = cableCurve.getLength();

  const stateAtTime = (time) => {
    const cycleTime = positiveModulo(time, operatingPeriod);
    const cycle = cycleAngle(cycleTime);
    const operatingAngleRadian = FULL_TURN * Math.round((time - cycleTime) / operatingPeriod) + cycle.angle;
    const capstanRotationY = -operatingAngleRadian;
    const pawlWorldAzimuthRadian = pawlPivotAzimuth + operatingAngleRadian;
    // Hauling from the seat, the nose rides the tooth it is seated on up to
    // its first crest below the crest line; backing off it stays there.
    const seated = cycle.stage !== 'haul'
      || cycle.angle < (-capstanPawlSeatPhase + pawlFreefallFraction) * ratchetToothPitch;
    const pawlClosure = pawlClosureAtAzimuth(pawlWorldAzimuthRadian, { seated });
    return {
      cableDistanceHauled: barrelRadius * operatingAngleRadian,
      cableSpeed: barrelRadius * cycle.rate,
      capstanAngularVelocityY: -cycle.rate,
      capstanRotationY,
      cycleTime,
      operatingAngleRadian,
      pawlClosure,
      pawlWorldAzimuthRadian,
      phase: cycleTime / operatingPeriod,
      stage: cycle.stage,
    };
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.55,
  });
  const ropeMaterial = matte(PALETTE.belt, {
    metalness: 0.03,
    roughness: 0.72,
  });
  const ratchetMaterial = matte(PALETTE.accent, {
    metalness: 0.34,
    roughness: 0.42,
  });
  ratchetMaterial.side = THREE.DoubleSide;
  const pawlMaterial = matte(PALETTE.accent, {
    metalness: 0.32,
    roughness: 0.42,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.34,
    roughness: 0.42,
  });
  const supportMaterial = matte(PALETTE.frame, {
    metalness: 0.22,
    roughness: 0.58,
  });
  const markerMaterial = matte(PALETTE.white, {
    opacity: 0.97,
    roughness: 0.18,
    transparent: true,
  });
  markerMaterial.depthWrite = false;

  const fixedBase = addRole(new THREE.Group(),
    'fixed-capstan-base-and-circular-ratchet');
  root.add(fixedBase);
  const basePlinth = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(1.88, 1.96, 0.24, 64),
    supportMaterial,
  ), 'fixed-circular-base-plinth');
  basePlinth.position.y = -1.73;
  fixedBase.add(basePlinth);
  const baseFoot = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(2.08, 2.08, 0.12, 64),
    darkMaterial,
  ), 'fixed-wide-capstan-base-foot');
  baseFoot.position.y = -1.89;
  fixedBase.add(baseFoot);
  const ratchet = addRole(new THREE.Mesh(
    makeCrownRatchetGeometry({
      // Pass 101: the ring's foot runs 0.06 down into the (now closed) deck,
      // so its bottom face no longer lies on the deck top.
      bottomHeight: ratchetBottomHeight - 0.06,
      highHeight: ratchetHighHeight,
      innerRadius: ratchetInnerRadius,
      lowHeight: ratchetLowHeight,
      outerRadius: ratchetOuterRadius,
      phaseOffset: ratchetPhaseOffset,
      toothCount: ratchetToothCount,
    }),
    ratchetMaterial,
  ), 'stationary-circular-crown-ratchet-on-base');
  fixedBase.add(ratchet);
  // Brown draws no band under the ratchet; the ring is let into the deck.

  const fixedSpindle = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 2.98, 64),
    darkMaterial,
  ), 'fixed-vertical-capstan-spindle');
  fixedSpindle.position.y = -0.36;
  root.add(fixedSpindle);

  const capstanRotor = addRole(new THREE.Group(),
    'one-rigid-capstan-head-barrel-handspike-and-pawl-carrier');
  root.add(capstanRotor);
  const bodyProfile = [
    new THREE.Vector2(1.03, -1.27),
    new THREE.Vector2(1.03, -1.03),
    new THREE.Vector2(0.84, -0.77),
    new THREE.Vector2(0.70, -0.43),
    new THREE.Vector2(0.64, -0.31),
    new THREE.Vector2(0.64, 0.35),
    new THREE.Vector2(0.73, 0.69),
    new THREE.Vector2(0.96, 1.00),
    new THREE.Vector2(1.11, 1.08),
  ];
  const barrelBody = addRole(new THREE.Mesh(
    boredLatheGeometry(bodyProfile.map(p => ({ radial: p.x, axial: p.y })), 0.15, 128),
    driverMaterial,
  ), 'rotating-waisted-capstan-barrel');
  capstanRotor.add(barrelBody);
  const lowerCollar = addRole(new THREE.Mesh(
    // Brown's lower drum runs down behind the teeth to just above the deck.
    boredLatheGeometry([{ radial: 1.10, axial: -0.345 }, { radial: 1.10, axial: 0.345 }], 0.152, 128),
    driverMaterial,
  ), 'rotating-lower-capstan-collar-carrying-pawl');
  lowerCollar.position.y = -1.245;
  capstanRotor.add(lowerCollar);

  const drumHead = addRole(new THREE.Mesh(
    capstanHeadGeometry(headRadius),
    driverMaterial,
  ), 'rotating-capstan-head-with-handspike-sockets');
  drumHead.position.y = 1.27;
  capstanRotor.add(drumHead);
  const headTop = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(headRadius * 0.94, 56, 18, 0, FULL_TURN,
      0, Math.PI / 2),
    driverMaterial,
  ), 'domed-top-of-capstan-head');
  headTop.scale.y = 0.23;
  headTop.position.y = 1.48;
  capstanRotor.add(headTop);
  const headBand = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(headRadius, 0.075, 10, 72),
    darkMaterial,
  ), 'dark-band-around-capstan-head');
  headBand.rotation.x = Math.PI / 2;
  headBand.position.y = 1.47;
  capstanRotor.add(headBand);
  // The head's edge is only inked on the plate, not a separate band.
  headBand.visible = false;
  headBand.userData.retiredInkOutline = true;

  const handSpike = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(handSpikeLength, 0.16, 0.18),
    driverMaterial,
  ), 'single-through-handspike-in-opposite-head-holes');
  handSpike.position.y = 1.29;
  capstanRotor.add(handSpike);
  // Pass 101: Brown's handspike ends are plain; the black end cubes are gone.
  const handSpikeEndCaps = [];

  const socketMarkers = Array.from({ length: 8 }, (_, index) => {
    const angle = index * FULL_TURN / 8;
    const socket = addRole(new THREE.Mesh(
      capstanSocketRimGeometry(),
      darkMaterial,
    ), `square-handspike-socket-${index + 1}`);
    socket.position.set(
      headRadius * Math.cos(angle),
      1.29,
      headRadius * Math.sin(angle),
    );
    socket.rotation.y = -angle;
    capstanRotor.add(socket);
    return socket;
  });
  const rotationIndex = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.055, 0.12),
    markerMaterial,
  ), 'white-rotation-index-on-capstan-head');
  rotationIndex.position.set(0.79, 1.505, 0);
  capstanRotor.add(rotationIndex);

  const pawlPivotAssembly = addRole(new THREE.Group(),
    'pawl-pivot-attached-to-rotating-lower-capstan');
  // Local +Z is the radial pivot axis (the pivot sits at azimuth +Z) and
  // local +X the recoil direction along which the pawl hangs.
  pawlPivotAssembly.position.set(
    pawlPlaneRadius * Math.cos(pawlPivotAzimuth),
    pawlPivotHeight,
    pawlPlaneRadius * Math.sin(pawlPivotAzimuth),
  );
  pawlPivotAssembly.rotation.y = Math.PI / 2 - pawlPivotAzimuth;
  capstanRotor.add(pawlPivotAssembly);
  const pawl = addRole(new THREE.Group(),
    'gravity-pawl-riding-fixed-circular-ratchet');
  pawlPivotAssembly.add(pawl);
  const pawlBar = addRole(new THREE.Mesh(
    capstanPawlGeometry(pawlDimensions),
    pawlMaterial,
  ), 'flat-pawl-swinging-on-radial-pin-to-ratchet');
  pawl.add(pawlBar);
  // Nose-centre reference (not drawn; source presentation removes it).
  const pawlTip = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(pawlDimensions.noseRadius, 40, 28),
    markerMaterial,
  ), 'white-pawl-tip-contact-marker');
  pawlTip.position.set(pawlLength, 0, 0);
  pawl.add(pawlTip);
  // The radial pin is driven into the lower capstan and carries a small head
  // outside the pawl.
  const pinInner = 1.05 - pawlPlaneRadius, pinOuter = pawlDimensions.thickness / 2 + 0.025;
  const pawlPivotPin = addRole(cylinderAlongZ(
    pawlDimensions.pinRadius,
    pinOuter - pinInner,
    darkMaterial,
    48,
  ), 'pawl-pivot-pin-fast-to-capstan-lower-part');
  pawlPivotPin.position.z = (pinOuter + pinInner) / 2;
  pawlPivotAssembly.add(pawlPivotPin);
  const pawlPinHead = addRole(cylinderAlongZ(0.085, 0.025, darkMaterial, 48),
    'pawl-pivot-pin-head');
  pawlPinHead.position.z = pawlDimensions.thickness / 2 + 0.0175;
  pawlPivotAssembly.add(pawlPinHead);
  const pawlMountCheeks = [];

  // Brown hatches the cable as a laid rope; its moving lay shows the haul,
  // so it carries no painted markers.
  const cable = addRole(new THREE.Mesh(
    new LaidRopeGeometry(
      cableCurve,
      300,
      ropeRadius,
      9,
      false,
    ),
    ropeMaterial,
  ), 'one-continuous-cable-hauled-tangentially-onto-capstan-barrel');
  cable.userData.isBelt = false;
  cable.userData.isSingleContinuousCable = true;
  root.add(cable);

  // Brown crops the hauled part at the plate edge. Pass 64: beyond it the
  // cable simply runs on straight along its own lead and ends cleanly (no
  // undrawn bollard or deck pipe). The lead is fixed geometry whose lay runs
  // with the cable's haul.
  const freeEnd = cableCurve.getPoint(0);
  const outward = cableCurve.getTangent(0).clone().negate().normalize();
  // Pass 82: the lead runs on far enough that its end leaves every rotated
  // view, instead of stopping at the old crop line.
  const leadLength = 12;
  const leadCurve = new THREE.LineCurve3(
    freeEnd.clone().addScaledVector(outward, leadLength), freeEnd.clone());
  const cableLead = addRole(new THREE.Mesh(
    new LaidRopeGeometry(leadCurve, 400, ropeRadius, 9, false),
    ropeMaterial,
  ), 'cable-lead-running-straight-past-plate-crop');
  cableLead.userData.beyondPlateCrop = true;
  root.add(cableLead);
  // Pass 56: the deck is Brown's ground line under the ratchet.
  const deckY = -1.61;
  const deck = addRole(new THREE.Mesh(
    // Pass 101: one closed deck (bored only for the spindle); the crown
    // ratchet's foot is sunk 0.06 into it, so the two never share a face and
    // nothing shows through from below (it used to be cut away under the
    // ring, whose bottom then lay flush with the deck top).
    plate(polygonClipping.difference(
      poly([[-2.5, -2.3], [2.5, -2.3], [2.5, 2.3], [-2.5, 2.3]]),
      poly(circle([0, 0], 0.145, 96)),
    ), deckY - 0.2, deckY).rotateX(-Math.PI / 2),
    supportMaterial,
  ), 'fixed-deck-under-capstan');
  root.add(deck);

  const update = (time) => {
    const state = stateAtTime(time);
    capstanRotor.rotation.y = state.capstanRotationY;
    pawl.rotation.z = state.pawlClosure.pawlPitchAngleRadian;
    cable.geometry.setTravel(state.cableDistanceHauled);
    cableLead.geometry.setTravel(state.cableDistanceHauled + leadLength);
  };

  const maximumAxialPitchPerRadian = helixRise / (wrapAngle - 0.125);
  const maximumHelixArcSpeedRatio = Math.hypot(
    barrelRadius,
    maximumAxialPitchPerRadian,
  ) / barrelRadius;
  const geometry = {
    barrelRadius,
    cablePathLength,
    freeCableEndX,
    handSpikeLength,
    headRadius,
    helixRise,
    maximumAxialPitchPerRadian,
    maximumHelixArcSpeedRatio,
    operatingAngularSpeed,
    operatingPeriod,
    pawlFreefallFraction,
    pawlTipRadius: pawlDimensions.noseRadius,
    pawlThickness: pawlDimensions.thickness,
    pawlReleasePhase: capstanPawlReleasePhase,
    pawlInitialReleasePhase,
    pawlHaulEndPhase,
    pawlSeatPhase: capstanPawlSeatPhase,
    haulAngle,
    haulDuration,
    recoilAngle,
    recoilDuration,
    pawlLength,
    pawlPivotAzimuth,
    pawlPivotHeight,
    pawlPlaneRadius,
    ratchetBottomHeight,
    ratchetHighHeight,
    ratchetInnerRadius,
    ratchetLowHeight,
    ratchetOuterRadius,
    ratchetPhaseOffset,
    ratchetToothCount,
    ratchetToothPitch,
    ropeEntryHeight,
    ropeRadius,
    wrapAngle,
    wrapCount,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: operatingPeriod,
      targetCycleDuration: operatingPeriod,
    },
    archetype:
      'handspike-driven-capstan-with-rotating-pawl-on-fixed-crown-ratchet',
    blocks: {
      barrelBody,
      baseFoot,
      basePlinth,
      cable,
      capstanRotor,
      drumHead,
      fixedBase,
      fixedSpindle,
      handSpike,
      handSpikeEndCaps,
      headBand,
      headTop,
      lowerCollar,
      pawl,
      pawlBar,
      pawlPivotAssembly,
      pawlPivotPin,
      pawlMountCheeks,
      pawlPinHead,
      pawlTip,
      ratchet,
      rotationIndex,
      socketMarkers,
    },
    cableRoute: {
      curve: cableCurve,
      pathLength: cablePathLength,
    },
    degreesOfFreedom: {
      cableMotionIndependent: 0,
      capstanOperatingCoordinates: 1,
      headBarrelAndHandspikeRelativeMotion: 0,
      pawlPassiveCoordinates: 1,
      ratchetBaseCoordinates: 0,
    },
    dynamics: {
      finiteContactResidual: 'Finite nose/crown clearance follows a baked triangle-contact envelope with a prescribed smooth crest release, and a second baked branch for the nose sliding back down into the tooth root. Gravity, impact, reverse load response and rope friction are not dynamically solved.',
      cableLayContinuity:
        'The laid cable follows one arc-length Curve3 whose free-span endpoint and barrel-wrap start share position and tangent; its lay advances by the hauled distance, so the rope moves at the barrel surface speed, without a jump, through that transition.',
      helixPackingDisclosure:
        'The three displayed turns use a 0.42-unit axial packing rise with a short smooth lead into constant pitch. Cable translation is exactly r_barrel times capstan angular speed; the small displayed helix makes the rope lay azimuth differ from rigid surface azimuth by less than 0.09 percent at the steepest packing point.',
      idealRatchetContact:
        'In the hauling direction the capstan-mounted pawl climbs each fixed tooth ramp on its pointed tip, passes its high vertical edge, falls continuously under the prescribed release schedule (as it swings down about its radial pin the nose also moves forward, so it lands about a third of a tooth up the next ramp), and recontacts that ramp. Each cycle ends with the hands easing off: the capstan backs about half a tooth (10 degrees) while the nose slides down that ramp and seats in the root against the tooth face, its toe along the ramp, the held pose Brown draws and the displayed start. The recoil and hold are prescribed; the reverse load response is not dynamically solved.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'One through hand-spike turns a single rigid head and waisted barrel around the fixed vertical spindle. The visible cable is hauled tangentially onto the barrel. A flat pawl lies against the front of the rotating lower capstan and turns on a radial pin, swinging in the plane Brown draws; carried round a stationary eighteen-tooth crown ratchet on the base, its nose trails the pin, rides up the ramps in the hauling direction and catches a steep tooth face against recoil.',
    motion: {
      capstanAxis: Y_AXIS.clone(),
      haulingDirectionAtVisibleTangent: new THREE.Vector3(-1, 0, 0),
      ratchetAllowedPawlTravelAroundY: 1,
      rotorRotationSignAroundY: -1,
    },
    pawlClosureAtAzimuth,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 491 HTML contains no canvas model or animation library and marks Animated unavailable.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      britannicaCapstanArticleUrl:
        'https://jimclifford.ca/britannica-articles-1/a/EB.4/144850374/635.html',
      brownBookScanUrl:
        'https://upload.wikimedia.org/wikipedia/commons/c/c3/Five_hundred_and_seven_mechanial_movements%2C_embracing_all_those_which_are_most_important_in_dynamics%2C_hydraulics%2C_hydrostatics%2C_pneumatics%2C_steam_engines%2C_mill_and_other_gearing_.._%28IA_fivehundredseven02brow%29.pdf',
      brownPlate491: {
        approximateBarrelCenterPixels: [270, 277],
        approximateHandSpikeEndpointsPixels: [14, 510],
        approximateHeadBoundsPixels: [181, 102, 360, 192],
        approximatePawlPivotPixels: [263, 386],
        approximatePawlTipPixels: [322, 424],
        approximateRatchetBoundsPixels: [165, 403, 378, 441],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 9,
      },
      constructionEvidence: {
        britannicaCorroboration:
          'The 1778–83 Encyclopaedia Britannica describes a vertical capstan with a barrel, drum-head holes receiving radial bars, two-and-a-half or three rope turns, and pawls preventing recoil.',
        explicitInBrownDescription: [
          'the mechanism is a capstan',
          'a cable or rope is wound on its barrel and hauled in',
          'hand-spikes or bars inserted in head holes turn the capstan',
          'the capstan turns on its own axis',
          'a pawl is attached to the lower rotating part',
          'the pawl works in a circular ratchet on the base',
          'the pawl prevents reverse rotation',
        ],
        engravingEvidence:
          'Brown shows one waisted vertical barrel, one drum head pierced by sockets, one diametral through hand-spike, a multi-turn rope with one visible free span, one pawl pivot on the lower collar, and an upward-facing circular sawtooth ring on the fixed foot.',
        knowltonPatentCorroboration:
          'David Knowlton’s 1857 ship-capstan patent explicitly places a ratchet around the top of the fixed capstan base and suitable pawls on the outside of the barrel, independently confirming Brown’s moving-pawl/fixed-ratchet topology.',
        reconstructionDisclosure:
          'The source fixes the component topology, rigid head/barrel relation, hauling direction, moving-pawl/fixed-ratchet relation, and one-way purpose. Exact dimensions, eighteen-tooth count, tooth and pawl profiles, three-turn display, line packing, the haul, ease-off and hold cycle, colors, and rope lay are independently engineered and exposed.',
      },
      knowlton1857PatentUrl:
        'https://patents.google.com/patent/US17971A/en',
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 491',
    },
    stateAtTime,
    toothSurfaceAtAzimuth,
    transmission: {
      cableHaulConstraint:
        'v_cable=r_barrel*abs(omega_capstan)',
      oneWayConstraint:
        'forward pawl azimuth rises along each fixed ramp; reverse travel is arrested by the preceding vertical tooth face',
      pawlCarrierConstraint:
        'theta_pawl_carrier=theta_head=theta_barrel',
      rigidCapstanConstraint:
        'theta_hand_spike=theta_head=theta_barrel',
      stationaryRatchetConstraint:
        'theta_circular_ratchet=theta_base=0',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.15, -2.02, -3.15),
    new THREE.Vector3(4.25, 2.02, 3.15),
  );
  root.userData.cameraDistanceScale = 1.08;
  root.userData.cameraDirection = new THREE.Vector3(7.8, 4.5, 9.4);
  root.userData.groundFloorY = -2.02;
  root.userData.hideGround = true;
  // Brown's side elevation: a narrow view keeps the bars and ratchet flat.
  root.userData.cameraFov = 10;
  root.traverse(object => {
    for (const material of object.material ? [].concat(object.material) : []) material.fog = false;
  });
  root.userData.minimumDisplayCycleSeconds = operatingPeriod;
  markShadows(root);
  for (const marker of [pawlTip, rotationIndex]) {
    marker.castShadow = false;
  }
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredCapstanMovement(movement) {
  if (movement.id !== 491) return null;
  return commonCapstan(movement);
}
