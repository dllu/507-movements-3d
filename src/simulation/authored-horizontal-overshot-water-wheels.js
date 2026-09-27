import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {horizontalVane,horizontalRing,horizontalPlate,horizontalTurned} from './horizontal-turbine-solids.js';
import {poly,circle,polygonClipping} from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';
import {STREAM_GRAVITY,WaterSpray,WaterStream,ballisticPath,collectWaterStreams,guidedPath,joinPaths} from './water-stream.js';

const FULL_TURN = Math.PI * 2;

function smoothStep5(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return THREE.MathUtils.clamp(
    clamped ** 3 * (clamped * (clamped * 6 - 15) + 10),
    0,
    1,
  );
}

function horizontalRadial(angle) {
  return new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
}

function horizontalTangent(angle) {
  return new THREE.Vector3(-Math.sin(angle), 0, -Math.cos(angle));
}

function boxBetween(start, end, width, height, material, role) {
  const direction = end.clone().sub(start);
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(direction.length(), height, width),
    material,
  );
  box.position.copy(start).add(end).multiplyScalar(0.5);
  box.quaternion.setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    direction.normalize(),
  );
  box.userData.role = role;
  return box;
}

function makeTube(curve, radius, material, role) {
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 72, radius, 10, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function horizontalOvershotWaterWheel(movement) {
  const root = new THREE.Group();
  const cycleDuration = 5.4;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  // Brown draws about sixteen narrow boards.
  const bladeCount = 16;
  const bladePitch = FULL_TURN / bladeCount;
  const bladeInnerRadius = 0.52;
  const bladeOuterRadius = 2.72;
  const bladeCenterRadius = (bladeInnerRadius + bladeOuterRadius) / 2;
  const bladeRadialLength = bladeOuterRadius - bladeInnerRadius;
  const sourcePoseBladeOffset = 0;
  // Pass 80: the hub fills the support ring and the boards butt on it.
  const hubRadius = 0.52;
  const shaftRadius = 0.19;
  // Pass 70: the runner turns clockwise seen from above (spin -1 about +y).
  // The jet strikes the right-hand floats a little in front of the shaft,
  // travelling toward the viewer and obliquely inward (a real spout plays
  // on the boards at a slant), so its spout climbs away across Brown's view
  // to the upper right and the floats carry the broken water round the
  // near side: Brown's spray falls under the right and front of the runner.
  // (Pass 69 struck the far side with the runner turning the other way,
  // which shed the water under the left.) The source camera looks in from
  // 31 degrees round from +z; the strike is 10 degrees in front of that
  // view's right.
  const spin = -1;
  const impactAngle = THREE.MathUtils.degToRad(21);
  const impactRadius = 1.7;
  const impactHeight = 0.34;
  const jetForceMagnitudeNormalized = 18;
  const jetDownwardRatio = 0.86;
  // Inward (toward the shaft) horizontal slant of the jet per unit of its
  // tangential component.
  const jetInwardRatio = 0.7;

  const impactRadial = horizontalRadial(impactAngle);
  // Direction of float motion at the strike (clockwise from above).
  const impactTangent = horizontalTangent(impactAngle).multiplyScalar(spin);
  const impactPoint = impactRadial.clone().multiplyScalar(impactRadius);
  impactPoint.y = impactHeight;
  // Horizontal direction of the jet: along the float motion, slanted in.
  const jetHorizontal = impactTangent.clone()
    .addScaledVector(impactRadial, -jetInwardRatio).normalize();
  const jetDirection = jetHorizontal.clone()
    .add(new THREE.Vector3(0, -jetDownwardRatio, 0))
    .normalize();
  const jetForce = jetDirection.clone()
    .multiplyScalar(jetForceMagnitudeNormalized);
  const tangentialJetForceNormalized = jetForce.dot(impactTangent);
  const impulseTorqueNormalized = new THREE.Vector3()
    .crossVectors(impactPoint, jetForce).y;
  // Brown's spout mouth sits well below the overhead beam, about two-fifths
  // of the way up from the runner.
  // The mouth is placed so the free jet, leaving along the spout axis at the
  // speed the spout's own fall gives it (v^2 = 2 g L sin(slope)), lands on
  // the strike point: drop = reach tan(slope) + g reach^2 / (2 v^2 cos^2).
  const spoutRun = 1.62, spoutRise = 1.22, spoutExtensionLength = 1.4;
  const spoutSlope = Math.atan2(spoutRise, spoutRun);
  const spoutFallLength = Math.hypot(spoutRun, spoutRise) + spoutExtensionLength;
  const spoutExitSpeedSquared = 2 * 9.81 * spoutFallLength * Math.sin(spoutSlope);
  const jetReach = 1.5;
  const jetDrop = jetReach * Math.tan(spoutSlope)
    + 9.81 * jetReach ** 2 / (2 * spoutExitSpeedSquared * Math.cos(spoutSlope) ** 2);
  const nozzlePoint = impactPoint.clone()
    .addScaledVector(jetHorizontal, -jetReach)
    .add(new THREE.Vector3(0, jetDrop, 0));
  const flumeUpstreamPoint = nozzlePoint.clone()
    .addScaledVector(jetHorizontal, -spoutRun)
    .add(new THREE.Vector3(0, spoutRise, 0));

  const jetSharesAtWheelAngle = (wheelAngle) => {
    const coordinate = THREE.MathUtils.euclideanModulo(
      (impactAngle - wheelAngle - sourcePoseBladeOffset) / bladePitch,
      bladeCount,
    );
    const lowerIndex = Math.floor(coordinate) % bladeCount;
    const fraction = coordinate - Math.floor(coordinate);
    const upperIndex = (lowerIndex + 1) % bladeCount;
    const upperShare = smoothStep5(fraction);
    const shares = Array.from({ length: bladeCount }, () => 0);
    shares[lowerIndex] = 1 - upperShare;
    shares[upperIndex] += upperShare;
    return {
      fraction,
      lowerIndex,
      shares,
      upperIndex,
    };
  };

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const wheelAngle = spin * inputAngle;
    const wheelAngularSpeed = spin * inputSpeed;
    const wheelAngularAcceleration = spin * inputAcceleration;
    const jetSharing = jetSharesAtWheelAngle(wheelAngle);
    const blades = [];
    for (let bladeIndex = 0; bladeIndex < bladeCount; bladeIndex += 1) {
      const localAngle = sourcePoseBladeOffset + bladeIndex * bladePitch;
      const worldAngle = localAngle + wheelAngle;
      const radial = horizontalRadial(worldAngle);
      const tangent = horizontalTangent(worldAngle);
      const center = radial.clone().multiplyScalar(bladeCenterRadius);
      const centerVelocity = tangent.clone().multiplyScalar(
        bladeCenterRadius * wheelAngularSpeed,
      );
      const centerAcceleration = tangent.clone().multiplyScalar(
        bladeCenterRadius * wheelAngularAcceleration,
      ).addScaledVector(
        radial,
        -bladeCenterRadius * wheelAngularSpeed ** 2,
      );
      blades.push({
        center,
        centerAcceleration,
        centerVelocity,
        index: bladeIndex,
        jetShare: jetSharing.shares[bladeIndex],
        localAngle,
        radial,
        tangent,
        worldAngle,
      });
    }
    const rimReferenceRadial = horizontalRadial(wheelAngle);
    const rimReferenceTangent = horizontalTangent(wheelAngle);
    const rimReferencePoint = rimReferenceRadial.clone()
      .multiplyScalar(bladeOuterRadius);
    const rimReferenceVelocity = rimReferenceTangent.clone()
      .multiplyScalar(bladeOuterRadius * wheelAngularSpeed);
    const rimReferenceAcceleration = rimReferenceTangent.clone()
      .multiplyScalar(bladeOuterRadius * wheelAngularAcceleration)
      .addScaledVector(
        rimReferenceRadial,
        -bladeOuterRadius * wheelAngularSpeed ** 2,
      );
    return {
      blades,
      impactPoint: impactPoint.clone(),
      impulseTorqueNormalized,
      inputAcceleration,
      inputAngle,
      inputSpeed,
      jetDirection: jetDirection.clone(),
      jetForce: jetForce.clone(),
      jetSharing,
      rimReferenceAcceleration,
      rimReferencePoint,
      rimReferenceVelocity,
      tangentialJetForceNormalized,
      wheelAngle,
      wheelAngularAcceleration,
      wheelAngularSpeed,
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
    bladeCenterRadius,
    bladeCount,
    bladeInnerRadius,
    bladeOuterRadius,
    bladePitch,
    bladeRadialLength,
    cycleDuration,
    flumeUpstreamPoint: flumeUpstreamPoint.clone(),
    hubRadius,
    impactAngle,
    impactHeight,
    impactPoint: impactPoint.clone(),
    impactRadius,
    inputAngularSpeed,
    jetDirection: jetDirection.clone(),
    jetDownwardRatio,
    jetForce: jetForce.clone(),
    jetForceMagnitudeNormalized,
    nozzlePoint: nozzlePoint.clone(),
    shaftRadius,
    sourcePoseBladeOffset,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.60,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.31,
    roughness: 0.46,
  });
  const wheelMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.51,
  });
  const bucketMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.53,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.72,
    roughness: 0.33,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const paleWaterMaterial = matte(0x72c2d0, {
    opacity: 0.50,
    roughness: 0.30,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const rotor = new THREE.Group();
  rotor.userData.role =
    'horizontal-runner-turning-with-vertical-output-shaft';
  root.add(rotor);
  const bladeGroups = [];
  for (let bladeIndex = 0; bladeIndex < bladeCount; bladeIndex += 1) {
    const localAngle = sourcePoseBladeOffset + bladeIndex * bladePitch;
    const bladeGroup = new THREE.Group();
    bladeGroup.rotation.y = localAngle;
    bladeGroup.userData.role =
      `horizontal-overshot-scoop-blade-${bladeIndex + 1}-of-sixteen`;
    const bladeFloor = new THREE.Mesh(
      new THREE.BoxGeometry(bladeRadialLength, 0.11, 0.58),
      bucketMaterial,
    );
    bladeFloor.geometry.dispose();bladeFloor.geometry=horizontalVane(Array.from({length:33},(_,i)=>{const t=i/32,r=bladeInnerRadius+t*bladeRadialLength;return new THREE.Vector3(r*Math.cos(.20*Math.sin(Math.PI*t)),0,-r*Math.sin(.20*Math.sin(Math.PI*t)));}),.045,-.10,.43);
    bladeFloor.position.set(0,0,0);
    bladeFloor.userData.role =
      `radial-floor-of-horizontal-scoop-${bladeIndex + 1}`;
    bladeGroup.add(bladeFloor);
    const catchingLip = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.60, 0.12),
      bucketMaterial,
    );
    catchingLip.position.set(bladeOuterRadius - 0.24, 0.29, -0.20);
    catchingLip.rotation.y = 0.34;
    catchingLip.userData.role =
      `upturned-catching-lip-of-horizontal-scoop-${bladeIndex + 1}`;
    bladeGroup.add(catchingLip);
    // Brown draws broad flat radial boards, pitched about their radial axis
    // so their faces show from his raised viewpoint; no scoop lips.
    bladeFloor.geometry.dispose();
    bladeFloor.geometry = horizontalVane([new THREE.Vector3(bladeInnerRadius, 0, 0),
      new THREE.Vector3(bladeOuterRadius, 0, 0)], .04, -.28, .28).rotateX(-.62);
    bladeFloor.position.y = .16;
    catchingLip.visible = false;
    rotor.add(bladeGroup);
    bladeGroups.push(bladeGroup);
  }

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(hubRadius, hubRadius, 0.34, 40),
    wheelMaterial,
  );
  hub.position.y = 0.18;
  hub.userData.role = 'horizontal-wheel-hub-fast-on-vertical-shaft';
  rotor.add(hub);
  const hubRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.10, 10, 64),
    wheelMaterial,
  );
  hubRing.rotation.x = Math.PI / 2;
  hubRing.position.y = 0.11;
  hubRing.userData.role = 'horizontal-wheel-central-bucket-support-ring';
  rotor.add(hubRing);
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(shaftRadius, shaftRadius, 4.70, 64),
    darkMaterial,
  );
  shaft.position.y = 1.95;
  shaft.userData.role = 'rotating-vertical-output-shaft';
  rotor.add(shaft);
  const rotationMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.10, 0.12),
    whiteMaterial,
  );
  rotationMarker.position.set(0.34, 0.42, 0);
  rotationMarker.userData.role =
    'visible-positive-rotation-marker-on-horizontal-runner';
  rotor.add(rotationMarker);
  rotationMarker.visible = false;

  const lowerBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.10, 10, 48),
    frameMaterial,
  );
  lowerBearing.geometry.dispose();lowerBearing.geometry=horizontalRing(.194,.34,-.40,-.20);
  lowerBearing.rotation.set(0,0,0);lowerBearing.position.y=0;
  lowerBearing.userData.role = 'fixed-lower-vertical-shaft-bearing';
  root.add(lowerBearing);
  const upperBearing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.38, 32),
    frameMaterial,
  );
  upperBearing.geometry.dispose();upperBearing.geometry=horizontalRing(.194,.34,-.19,.19);
  upperBearing.position.y = 4.04;
  upperBearing.userData.role = 'fixed-overhead-vertical-shaft-bearing';
  root.add(upperBearing);
  const overheadBeam = new THREE.Mesh(
    new THREE.BoxGeometry(7.60, 0.28, 0.70),
    frameMaterial,
  );
  overheadBeam.geometry.dispose();overheadBeam.geometry=horizontalPlate(polygonClipping.difference(poly([[-3.8,-.35],[3.8,-.35],[3.8,.35],[-3.8,.35]]),poly(circle([.10,-.18],.194,128))),-.14,.14);
  // Turned about the shaft axis to run straight across the source view,
  // which looks in from 31 degrees round from +z (source-presentation).
  overheadBeam.geometry.translate(-0.10, 0, -0.18);
  overheadBeam.position.set(0, 4.20, 0);
  overheadBeam.rotation.y = Math.atan2(0.6, 1);
  overheadBeam.userData.role = 'fixed-overhead-bearing-beam';
  root.add(overheadBeam);
  const bearingCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.30, 0.54, 28),
    frameMaterial,
  );
  bearingCone.geometry.dispose();bearingCone.geometry=horizontalTurned([[-.27,.194],[-.27,.30],[.27,.205],[.27,.194]]);
  bearingCone.position.y = 3.71;
  bearingCone.userData.role = 'fixed-conical-upper-bearing-seat';
  root.add(bearingCone);

  const flume = boxBetween(
    flumeUpstreamPoint,
    nozzlePoint,
    0.92,
    0.20,
    frameMaterial,
    'inclined-fixed-headrace-flume-above-horizontal-wheel',
  );
  // Brown's spout is a long, narrow open trough (a floor and two side walls)
  // running up out of his frame.
  const spoutExtension = spoutExtensionLength;
  {
    const length = flume.geometry.parameters.width + spoutExtension;
    const parts = [new THREE.BoxGeometry(length, .05, .56).translate(-spoutExtension / 2, -.075, 0),
      ...[-1, 1].map(side => new THREE.BoxGeometry(length, .24, .05).translate(-spoutExtension / 2, .02, side * .255))];
    flume.geometry.dispose();
    flume.geometry = mergeGeometries(parts);
    parts.forEach(part => part.dispose());
  }
  root.add(flume);
  // Brown draws the spout free of the overhead beam, running on out of the
  // picture to the upper right, so no brace or hanger is modelled.
  const flumeWaterStart = flumeUpstreamPoint.clone()
    .add(new THREE.Vector3(0, 0.14, 0));
  const flumeWaterEnd = nozzlePoint.clone()
    .add(new THREE.Vector3(0, 0.14, 0));
  const flumeWater = boxBetween(
    flumeWaterStart,
    flumeWaterEnd,
    0.58,
    0.11,
    paleWaterMaterial,
    'water-approaching-horizontal-wheel-through-headrace',
  );
  {
    const length = flumeWater.geometry.parameters.width + spoutExtension;
    flumeWater.geometry.dispose();
    flumeWater.geometry = new THREE.BoxGeometry(length, .07, .44).translate(-spoutExtension / 2, 0, 0);
  }
  flumeWater.position.y -= .15;
  root.add(flumeWater);
  // The continuous stream below carries the spout's water now.
  flumeWater.visible = false;

  const jetControlPoint = nozzlePoint.clone().lerp(impactPoint, 0.50)
    .add(new THREE.Vector3(0, 0.30, 0));
  const jetCurve = new THREE.QuadraticBezierCurve3(
    nozzlePoint,
    jetControlPoint,
    impactPoint,
  );
  // Pass 69: the water is ONE continuous swept body (water-stream.js): it
  // runs down the spout floor, leaves the mouth along the spout axis and
  // falls on a true projectile path onto the floats. Its speed is what the
  // spout's own fall gives it (frictionless, v = sqrt(2 g h)), so the jet
  // sags only as much as gravity makes it and strikes where it lands.
  const jetAcross = new THREE.Vector3(0, 0, 1).applyQuaternion(flume.quaternion);
  const spoutAxis = nozzlePoint.clone().sub(flumeUpstreamPoint).normalize();
  const spoutFloorNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(flume.quaternion);
  const streamSurfaceOffset = -0.015;
  const mouth = nozzlePoint.clone().addScaledVector(spoutFloorNormal, streamSurfaceOffset);
  const spoutLength = nozzlePoint.distanceTo(flumeUpstreamPoint) + spoutExtension;
  const launchSpeed = Math.sqrt(2 * STREAM_GRAVITY * spoutLength * -spoutAxis.y);
  const flumeStreamPath = guidedPath([
    flumeUpstreamPoint.clone().addScaledVector(spoutAxis, -spoutExtension + 0.05)
      .addScaledVector(spoutFloorNormal, streamSurfaceOffset),
    mouth,
  ], {speed: launchSpeed, samples: 10});
  const fallPath = ballisticPath({
    origin: mouth, velocity: spoutAxis.clone().multiplyScalar(launchSpeed), endY: 0.53, samples: 30,
  });
  const strike = fallPath.points.at(-1).clone();
  const jet = new WaterStream(joinPaths(flumeStreamPath, fallPath), {
    width: 0.2, thickness: 0.032, widthAxis: jetAcross, widthExponent: 0.25,
    foam: {start: 0.9, amount: 0.55}, cyclePeriod: cycleDuration, streakRate: 1.2, opacity: 0.55,
  });
  jet.userData.role = 'falling-tangential-jet-striking-horizontal-scoop-wheel';
  // The broken jet leaves the struck floats as spray: the water runs out
  // along the float as the runner carries it on, so it is thrown off the
  // floats' outer ends downstream of the strike with their rim speed and
  // falls, spreading and thinning, below the runner.
  const rimSpeed = inputAngularSpeed * bladeOuterRadius;
  // Most of the water leaves soon after the strike; what the floats carry on
  // round is shed further downstream in thinner sheets (Brown's spray under
  // the near blades), so there are three spills of falling flow.
  const spills = [[0.3, 1.0], [0.75, 0.6], [1.2, 0.45]].map(([turn, flow], index) => {
    const angle = impactAngle + spin * turn;
    const radial = horizontalRadial(angle);
    const tangent = horizontalTangent(angle).multiplyScalar(spin);
    const start = radial.clone().multiplyScalar(bladeOuterRadius + 0.06).setY(-0.02);
    const velocity = tangent.clone().multiplyScalar(rimSpeed * 0.3)
      .addScaledVector(radial, 0.35).add(new THREE.Vector3(0, -0.3, 0));
    const stream = new WaterStream(ballisticPath({origin: start, velocity, endY: -1.55, samples: 24}), {
      width: 0.2, thickness: 0.025, widthAxis: tangent, widthExponent: 0.3, flow,
      spread: {start: 0.15, width: 1.8, thickness: 1.3}, fadeIn: 0.1, fadeOut: 0.7,
      cyclePeriod: cycleDuration, streakRate: 1.5, streakAcross: 5, opacity: 0.32,
    });
    stream.userData.role = index === 0 ? 'spray-falling-from-struck-blades'
      : `spray-shed-downstream-from-carried-blades-${index}`;
    root.add(stream);
    // Brown's broken drops falling beside the sheet.
    const drops = new WaterSpray({
      origin: start.clone().setY(-0.08), velocity, spread: 0.35, count: 20, lifetime: 0.55,
      radius: 0.028, cyclePeriod: cycleDuration, seed: 4330 + index, originSpread: tangent.clone().multiplyScalar(0.35),
    });
    drops.userData.role = `drops-falling-from-blade-tips-${index + 1}`;
    root.add(drops);
    return stream;
  });
  const spill = spills[0];
  root.add(jet);
  const impactSpray = new WaterSpray({
    origin: strike.clone().setY(0.56),
    velocity: impactTangent.clone().multiplyScalar(0.9).add(new THREE.Vector3(0, 1.3, 0)),
    spread: 0.9, count: 28, lifetime: 0.36, radius: 0.035, cyclePeriod: cycleDuration, seed: 433,
  });
  impactSpray.userData.role = 'splash-where-jet-strikes-floats';
  root.add(impactSpray);
  const updateWater = collectWaterStreams(root);
  const jetMarkers = [];
  for (let markerIndex = 0; markerIndex < 9; markerIndex += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.10, 18, 12),
      whiteMaterial,
    );
    marker.userData.role = `falling-jet-motion-marker-${markerIndex + 1}`;
    root.add(marker);
    jetMarkers.push(marker);
  }
  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.20, 24, 16),
    paleWaterMaterial,
  );
  contactMarker.position.copy(impactPoint);
  contactMarker.userData.role =
    'fixed-world-contact-point-of-tangential-jet-and-passing-scoops';
  root.add(contactMarker);

  const dischargeMarkers = [];
  for (let markerIndex = 0; markerIndex < 8; markerIndex += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 18, 12),
      paleWaterMaterial,
    );
    marker.userData.role =
      `downward-discharge-marker-after-scoop-impact-${markerIndex + 1}`;
    root.add(marker);
    dischargeMarkers.push(marker);
  }
  const splashBasin = new THREE.Mesh(
    new THREE.CylinderGeometry(3.15, 3.15, 0.18, 72),
    waterMaterial,
  );
  splashBasin.position.y = -0.52;
  splashBasin.userData.role =
    'fixed-shallow-basin-receiving-horizontal-wheel-discharge';
  root.add(splashBasin);
  const foundation = new THREE.Mesh(
    new THREE.CylinderGeometry(3.48, 3.48, 0.22, 72),
    frameMaterial,
  );
  foundation.position.y = -0.70;
  foundation.userData.role = 'fixed-horizontal-water-wheel-foundation';
  root.add(foundation);
  // Brown draws the runner free above falling spray: no basin, floor disc,
  // painted contact point or runner index.
  for (const unpainted of [contactMarker, splashBasin, foundation, ...dischargeMarkers]) unpainted.visible = false;
  const lowerPedestal=new THREE.Mesh(horizontalRing(.194,.34,-.59,-.40),frameMaterial);lowerPedestal.userData.role='fixed-lower-bearing-pedestal';root.add(lowerPedestal);

  const update = (time) => {
    const state = stateAtTime(time);
    rotor.rotation.y = state.wheelAngle;
    updateWater(time);
    const jetPhase = THREE.MathUtils.euclideanModulo(time / 0.82, 1);
    for (let markerIndex = 0; markerIndex < jetMarkers.length;
      markerIndex += 1) {
      const progress = THREE.MathUtils.euclideanModulo(
        jetPhase + markerIndex / jetMarkers.length,
        1,
      );
      jetMarkers[markerIndex].position.copy(jetCurve.getPoint(progress));
      const endFade = Math.min(progress / 0.07, (1 - progress) / 0.07, 1);
      jetMarkers[markerIndex].scale.setScalar(0.40 + 0.60 * endFade);
    }
    for (let markerIndex = 0; markerIndex < dischargeMarkers.length;
      markerIndex += 1) {
      const progress = THREE.MathUtils.euclideanModulo(
        time / 0.94 + markerIndex / dischargeMarkers.length,
        1,
      );
      const spread = (markerIndex - (dischargeMarkers.length - 1) / 2)
        * 0.12;
      dischargeMarkers[markerIndex].position.copy(impactPoint)
        .addScaledVector(impactTangent, 0.30 + 1.18 * progress)
        .addScaledVector(impactRadial, spread * progress);
      dischargeMarkers[markerIndex].position.y = impactHeight
        - 0.22 - 1.05 * progress ** 2;
      const endFade = Math.min(progress / 0.08, (1 - progress) / 0.08, 1);
      dischargeMarkers[markerIndex].scale.setScalar(0.34 + 0.66 * endFade);
    }
  };

  const sourceState = stateAtInputAngle(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: cycleDuration,
    },
    archetype:
      'horizontal-overshot-water-wheel-with-falling-tangential-jet-driving-scoops-on-vertical-shaft',
    blocks: {
      lowerPedestal,
      bearingCone,
      bladeGroups,
      contactMarker,
      dischargeMarkers,
      flume,
      flumeWater,
      foundation,
      hub,
      hubRing,
      impactSpray,
      jet,
      jetMarkers,
      lowerBearing,
      overheadBeam,
      rotationMarker,
      rotor,
      shaft,
      spill,
      spills,
      splashBasin,
      upperBearing,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      jetFlowIndependent: false,
      operatingDegreesOfFreedom: 1,
      shaftAndRunnerIndependent: false,
    },
    dynamics: {
      fluidPressureViscosityTurbulenceSplashLeakageBladeImpactBearingFrictionRunnerInertiaGeneratorLoadAndSpeedResponseModeled:
        false,
      jetMomentumDiagnostic:
        'A fixed normalized force follows the reconstructed falling jet at the illustrated contact point. Its horizontal component follows the floats’ motion at impact with an inward slant (0.7 of radial per unit tangential, as a spout plays obliquely on the boards) and its y-axis moment is negative (clockwise from above, the runner’s sense); runner speed remains prescribed.',
      smoothBladeHandoff:
        'The visual jet engagement is partitioned between the two neighboring scoop indices with complementary quintic weights, preserving unit total engagement and zero-slope handoff rather than popping between blades.',
    },
    fidelity: 'authored',
    geometry,
    jetSharesAtWheelAngle,
    mechanism:
      'A fixed elevated flume sends a falling jet obliquely onto the upper faces of scoop-like radial blades carried by a horizontal runner. The jet’s horizontal component runs with the floats at impact, slanting inward, so its momentum produces clockwise (negative-about-y) torque about the vertical shaft; water then spills downward into the surrounding basin. All sixteen scoops, hub, shaft, and visible marker rotate as one body about the vertical axis, while the flume, jet contact point, basin, and upper and lower bearings remain fixed.',
    motion: {
      bladePitch,
      cycleDuration,
      inputAngularSpeed,
      rotationDirectionViewedFromAbove: 'clockwise-negative-about-y',
      wheelRevolutionsPerCycle: 1,
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 433 page provides Brown’s static engraving and three-word caption but contains no Canvas construction or source timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      blades: sourceState.blades.map((blade) => ({
        center: blade.center.clone(),
        localAngle: blade.localAngle,
        worldAngle: blade.worldAngle,
      })),
      impactPoint: impactPoint.clone(),
      nozzlePoint: nozzlePoint.clone(),
      wheelAngle: sourceState.wheelAngle,
    },
    sourceReference: {
      brownPlate433: {
        approximateBladeCount: 16,
        approximateImpactPixels: [305, 350],
        approximateRunnerOuterRadiusPixels: 202,
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 18,
        nozzleOutletApproximatePixels: [384, 244],
        shaftAtRunnerApproximatePixels: [256, 370],
        upperBearingApproximatePixels: [256, 82],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the mechanism is a horizontal overshot water-wheel',
        ],
        engravingEvidence:
          'Brown’s perspective engraving shows a horizontal radial scoop runner fixed to a vertical shaft supported above, an elevated oblique flume at upper right, a falling jet striking the runner near its outer radius, and water spilling below the blade tips.',
        reconstructionDisclosure:
          'Brown gives no dimensions, exact scoop count, blade curvature, jet velocity, impact angle, shaft speed, direction arrow, materials, losses, efficiency, bearing friction, inertia, or load. Sixteen equal boards, clockwise rotation direction (chosen so the broken water falls under the right and front as drawn), dimensions, tangent-force diagnostic, smooth two-blade engagement display, colors, basin, and 5.4-second cycle are independently engineered; the horizontal runner, vertical shaft, upper bearing, elevated flume, falling outer-radius jet, and downward discharge are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 433',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      jetTorque:
        'tau_y=(impactPoint cross jetForce).y>0 with the horizontal force component tangent to the runner',
      runnerAttachment:
        'bladeWorldAngle=bladeLocalAngle+wheelAngle and shaftAngle=wheelAngle=-inputAngle',
      smoothJetHandoff:
        'two neighboring blade shares sum exactly to one at every wheel angle',
    },
    update,
  };
  // Frame the runner, shaft and bearing; like Brown, the overhead beam and
  // the spout run on out of the picture.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.85, -0.95, -2.85),
    new THREE.Vector3(2.85, 4.45, 2.85),
  );
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraDirection = new THREE.Vector3(6.3, 5.2, 10.5);
  root.userData.groundFloorY = -0.88;
  root.userData.hideGround=true;
  root.userData.solidReview={qualification:'Finite vanes, shaft clearances and open water passages; flow paths and angular-momentum diagnostics remain prescribed illustrations, not solved pressure, efficiency or load response.'};
  root.traverse(object=>{for(const material of object.material?[].concat(object.material):[])material.fog=false;});
  root.userData.minimumDisplayCycleSeconds = cycleDuration;
  markShadows(root);
  foundation.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredHorizontalOvershotWaterWheelMovement(movement) {
  if (movement.id !== 433) return null;
  return horizontalOvershotWaterWheel(movement);
}
