import * as THREE from 'three';
import { LaidRopeGeometry } from './laid-rope.js';
import { makeCrownRatchetGeometry, capstanPawlLeadAngle, capstanPawlDimensions, capstanPawlProfile } from './capstan-pawl-contact.js';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { capstanHeadGeometry, capstanSocketRimGeometry, capstanPackingProgress, capstanPawlArmGeometry, capstanPawlCheekGeometry } from './capstan-finite-parts.js';
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
  const operatingAngularSpeed = FULL_TURN / operatingPeriod;

  const ratchetToothCount = 18;
  const ratchetToothPitch = FULL_TURN / ratchetToothCount;
  const ratchetInnerRadius = 1.37;
  const ratchetOuterRadius = 1.79;
  const ratchetBottomHeight = -1.61;
  const ratchetLowHeight = -1.50;
  const ratchetHighHeight = -1.27;
  const pawlInitialToothPhase = 0.30;
  const ratchetPhaseOffset = -pawlInitialToothPhase
    * ratchetToothPitch;
  const pawlFreefallFraction = 0.40;
  const pawlPivotRadius = 1.23;
  const pawlPivotHeight = -1.04;
  const pawlLength = 0.47;

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

  const pawlClosureAtAzimuth = (azimuthRadian) => {
    const toothSurface = toothSurfaceAtAzimuth(azimuthRadian);
    const finite = capstanPawlProfile(toothSurface.toothPhase + capstanPawlLeadAngle / ratchetToothPitch);
    const pawlPitchAngleRadian = finite.pitch;
    const verticalDifference = pawlLength * Math.sin(pawlPitchAngleRadian);
    const pawlTipHeight = pawlPivotHeight + verticalDifference;
    const falling = finite.falling;
    const fallProgress = Math.min(1, finite.phase / pawlFreefallFraction);
    const radialProjection = pawlLength
      * Math.cos(pawlPitchAngleRadian);
    const pawlTipRadius = Math.hypot(pawlPivotRadius + radialProjection, capstanPawlDimensions.tipLead);
    return {
      airborneClearance: finite.airborneClearance,
      finiteTipRadius: capstanPawlDimensions.tipRadius,
      contactingRamp: !falling,
      fallProgress,
      falling,
      pawlPitchAngleRadian,
      pawlTipHeight,
      pawlTipRadius,
      radialProjection,
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
  const cableSpeed = barrelRadius * operatingAngularSpeed;

  const stateAtTime = (time) => {
    const operatingAngleRadian = operatingAngularSpeed * time;
    const capstanRotationY = -operatingAngleRadian;
    const pawlWorldAzimuthRadian = operatingAngleRadian;
    const pawlClosure = pawlClosureAtAzimuth(pawlWorldAzimuthRadian);
    return {
      cableDistanceHauled: cableSpeed * time,
      cableSpeed,
      capstanAngularVelocityY: -operatingAngularSpeed,
      capstanRotationY,
      cycleTime: positiveModulo(time, operatingPeriod),
      operatingAngleRadian,
      pawlClosure,
      pawlWorldAzimuthRadian,
      phase: positiveModulo(time, operatingPeriod) / operatingPeriod,
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
      bottomHeight: ratchetBottomHeight,
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
  const ratchetInnerBand = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(1.24, 0.09, 10, 72),
    darkMaterial,
  ), 'fixed-inner-band-supporting-circular-ratchet');
  ratchetInnerBand.rotation.x = Math.PI / 2;
  ratchetInnerBand.position.y = -1.55;
  fixedBase.add(ratchetInnerBand);

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
    boredLatheGeometry([{ radial: 1.10, axial: -0.13 }, { radial: 1.10, axial: 0.13 }], 0.15, 128),
    driverMaterial,
  ), 'rotating-lower-capstan-collar-carrying-pawl');
  lowerCollar.position.y = -1.20;
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
  const handSpikeEndCaps = [-1, 1].map((side, index) => {
    const cap = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.30, 0.22, 0.24),
      darkMaterial,
    ), `handspike-end-grip-${index + 1}`);
    cap.position.set(side * handSpikeLength / 2, 1.29, 0);
    capstanRotor.add(cap);
    return cap;
  });

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
  pawlPivotAssembly.position.set(
    pawlPivotRadius,
    pawlPivotHeight,
    0,
  );
  capstanRotor.add(pawlPivotAssembly);
  const pawl = addRole(new THREE.Group(),
    'gravity-pawl-riding-fixed-circular-ratchet');
  pawlPivotAssembly.add(pawl);
  const pawlBar = addRole(new THREE.Mesh(
    capstanPawlArmGeometry(pawlLength, capstanPawlDimensions.tipLead),
    pawlMaterial,
  ), 'rigid-pawl-from-rotating-pivot-to-ratchet');
  pawlBar.position.x = 0;
  pawl.add(pawlBar);
  const pawlTip = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(capstanPawlDimensions.tipRadius, 40, 28),
    markerMaterial,
  ), 'white-pawl-tip-contact-marker');
  pawlTip.position.set(pawlLength, 0, capstanPawlDimensions.tipLead);
  pawl.add(pawlTip);
  const pawlPivotPin = addRole(cylinderAlongZ(
    0.055,
    0.34,
    darkMaterial,
    48,
  ), 'pawl-pivot-pin-fast-to-capstan-lower-part');
  pawlPivotAssembly.add(pawlPivotPin);
  const pawlMountCheeks = [[-0.15,-0.09],[0.09,0.15]].map(([low,high],index) => {
    const cheek = addRole(new THREE.Mesh(capstanPawlCheekGeometry(low,high),driverMaterial),
      `finite-bored-pawl-mount-cheek-${index+1}`);
    pawlPivotAssembly.add(cheek); return cheek;
  });

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

  const update = (time) => {
    const state = stateAtTime(time);
    capstanRotor.rotation.y = state.capstanRotationY;
    pawl.rotation.z = state.pawlClosure.pawlPitchAngleRadian;
    cable.geometry.setTravel(state.cableDistanceHauled);
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
    pawlTipRadius: capstanPawlDimensions.tipRadius,
    pawlTipLead: capstanPawlDimensions.tipLead,
    pawlLeadAngle: capstanPawlLeadAngle,
    pawlInitialToothPhase,
    pawlLength,
    pawlPivotHeight,
    pawlPivotRadius,
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
      pawlTip,
      ratchet,
      ratchetInnerBand,
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
      finiteContactResidual: 'Finite nose/crown clearance follows a baked triangle-contact envelope with a prescribed smooth crest release. Gravity, impact, reverse load response and rope friction are not dynamically solved.',
      cableLayContinuity:
        'The laid cable follows one arc-length Curve3 whose free-span endpoint and barrel-wrap start share position and tangent; its lay advances by the hauled distance, so the rope moves at constant speed through that transition.',
      helixPackingDisclosure:
        'The three displayed turns use a 0.42-unit axial packing rise with a short smooth lead into constant pitch. Cable translation is exactly r_barrel times capstan angular speed; the small displayed helix makes the rope lay azimuth differ from rigid surface azimuth by less than 0.09 percent at the steepest packing point.',
      idealRatchetContact:
        'In the hauling direction the capstan-mounted pawl climbs each fixed tooth ramp on its finite rounded nose, passes its high vertical edge, falls continuously under the prescribed release schedule, and recontacts the next ramp. Reverse motion meets that high face after at most one tooth of backlash; the reverse load response is not dynamically solved.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'One through hand-spike turns a single rigid head and waisted barrel around the fixed vertical spindle. The visible cable is hauled tangentially onto the barrel. A pawl pivot carried by the rotating lower collar travels around a stationary eighteen-tooth crown ratchet on the base: it rides up the ramps in the hauling direction and catches a steep tooth face against recoil.',
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
          'The source fixes the component topology, rigid head/barrel relation, hauling direction, moving-pawl/fixed-ratchet relation, and one-way purpose. Exact dimensions, eighteen-tooth count, tooth and pawl profiles, three-turn display, line packing, constant operating speed, colors, and rope lay are independently engineered and exposed.',
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
