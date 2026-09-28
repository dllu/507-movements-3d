import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

import {boredCylinderGeometry,boredJournal,fitPistonGuide} from './piston-guide-parts.js';
import {makeBoredLinkRod} from './bored-link-rod.js';
import {circle,plate,poly,polygonClipping as clip} from './finite-plate-geometry.js';
import {bevelToothGeometry} from './bevel-geometry.js';
import { creaseIndexedNormals } from './crease-normals.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function wrappedAngle(value) {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

function quintic(progress) {
  const u = THREE.MathUtils.clamp(progress, 0, 1);
  return u * u * u * (10 + u * (-15 + 6 * u));
}

function quinticDerivative(progress) {
  const u = THREE.MathUtils.clamp(progress, 0, 1);
  return 30 * u * u * (1 - u) * (1 - u);
}

function cylinderAlongX(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function torusNormalToAxis(
  majorRadius,
  tubeRadius,
  material,
  axis,
  segments = 56,
) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(majorRadius, tubeRadius, 10, segments),
    material,
  );
  torus.quaternion.setFromUnitVectors(Z_AXIS, axis.clone().normalize());
  return torus;
}

function makePitchConeGear({
  axis,
  boreRadius,
  color,
  indexTooth,
  innerDistance,
  outerDistance,
  pitchConeAngle,
  teeth,
  toothHeight,
}) {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.add(rotor);
  root.quaternion.setFromUnitVectors(Z_AXIS, axis.clone().normalize());
  root.userData.axis = axis.clone().normalize();
  root.userData.rotor = rotor;

  const pitchRadiusAt = (distance) => distance * Math.tan(pitchConeAngle);
  const toothHeightAt = (distance) => toothHeight
    * distance / outerDistance;
  const innerRootRadius = pitchRadiusAt(innerDistance)
    - toothHeightAt(innerDistance) * .55 * Math.cos(pitchConeAngle);
  const outerRootRadius = pitchRadiusAt(outerDistance)
    - toothHeight * .55 * Math.cos(pitchConeAngle);
  const innerRootZ=innerDistance+toothHeightAt(innerDistance)*.55*Math.sin(pitchConeAngle);
  const outerRootZ=outerDistance+toothHeight*.55*Math.sin(pitchConeAngle);
  const bodyGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(boreRadius, innerRootZ),
    new THREE.Vector2(innerRootRadius, innerRootZ),
    new THREE.Vector2(outerRootRadius, outerRootZ),
    new THREE.Vector2(boreRadius, outerRootZ),
    new THREE.Vector2(boreRadius, innerRootZ),
  ], 72);
  bodyGeometry.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(
    bodyGeometry,
    matte(color, { metalness: 0.14, roughness: 0.60 }),
  );
  body.userData.role = 'pitch-cone-bevel-gear-body';
  rotor.add(body);

  const toothMaterial = matte(color, {
    metalness: 0.17,
    roughness: 0.54,
    side: THREE.DoubleSide,
  });
  const whiteMaterial = matte(PALETTE.white, {
    roughness: 0.44,
    side: THREE.DoubleSide,
  });
  const toothMeshes = [];
  for (let index = 0; index < teeth; index += 1) {
    const geometry=bevelToothGeometry({teeth,innerDistance,outerDistance,pitchConeAngle,toothHeight,
      toothThicknessFactor:.94,flankSegments:10,tipSegments:4});
    geometry.rotateZ(index/teeth*FULL_TURN);
    const tooth = new THREE.Mesh(
      geometry,
      toothMaterial,
    );
    tooth.userData.bevelTooth = true;
    tooth.userData.index = index;
    tooth.userData.role = 'closed-conical-bevel-gear-tooth';
    rotor.add(tooth);
    toothMeshes.push(tooth);
  }

  const faceRing = new THREE.Mesh(
    new THREE.TorusGeometry(
      pitchRadiusAt(outerDistance) * 0.62,
      0.030,
      8,
      56,
    ),
    matte(PALETTE.ink, { metalness: 0.18, roughness: 0.51 }),
  );
  faceRing.position.z = outerRootZ + .018;
  faceRing.userData.role = 'outer-face-ring-on-bevel-gear';
  rotor.add(faceRing);
  const faceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      pitchRadiusAt(outerDistance) * 0.48,
      0.048,
      0.025,
    ),
    whiteMaterial,
  );
  faceIndex.position.set(
    pitchRadiusAt(outerDistance) * 0.45,
    0,
    outerRootZ + .034,
  );
  faceIndex.userData.role = 'white-index-showing-bevel-gear-angle';
  rotor.add(faceIndex);
  // Brown hatches plain bevel wheels: no face ring or white index is drawn.
  faceRing.visible = false;
  faceIndex.visible = false;

  root.userData.body = body;
  root.userData.boreRadius = boreRadius;
  root.userData.faceIndex = faceIndex;
  root.userData.faceRing = faceRing;
  root.userData.innerDistance = innerDistance;
  root.userData.outerDistance = outerDistance;
  root.userData.outerPitchRadius = pitchRadiusAt(outerDistance);
  root.userData.pitchConeAngle = pitchConeAngle;
  root.userData.teeth = teeth;
  root.userData.toothHeight = toothHeight;
  root.userData.toothMeshes = toothMeshes;
  return markShadows(root);
}

function treadleBevelDrillingMachine(movement) {
  const root = new THREE.Group();

  const demonstrationPeriod = 8;
  const driverAngularSpeed = FULL_TURN / demonstrationPeriod;
  const driverTeeth = 32;
  const pinionTeeth = 16;
  const bevelRatio = driverTeeth / pinionTeeth;
  const pinionLocalAngularSpeed = -bevelRatio * driverAngularSpeed;
  const drillShaftAngularSpeed = pinionLocalAngularSpeed;
  const shaftAngle = Math.PI / 2;
  const driverPitchConeAngle = Math.atan2(driverTeeth, pinionTeeth);
  const pinionPitchConeAngle = Math.atan2(pinionTeeth, driverTeeth);
  const apex = new THREE.Vector3(0, 1.58, 0);
  const driverAxis = X_AXIS.clone();
  const pinionAxis = Y_AXIS.clone();
  const outerSlantDistance = 1.04;
  const driverOuterDistance = outerSlantDistance
    * Math.cos(driverPitchConeAngle);
  const pinionOuterDistance = outerSlantDistance
    * Math.cos(pinionPitchConeAngle);
  const driverInnerDistance = driverOuterDistance * 0.30;
  const pinionInnerDistance = pinionOuterDistance * .40;
  const driverOuterPitchRadius = driverOuterDistance
    * Math.tan(driverPitchConeAngle);
  const pinionOuterPitchRadius = pinionOuterDistance
    * Math.tan(pinionPitchConeAngle);
  const contactDirection = driverAxis.clone()
    .multiplyScalar(Math.cos(driverPitchConeAngle))
    .addScaledVector(pinionAxis, Math.sin(driverPitchConeAngle));
  const gearContactPoint = apex.clone().addScaledVector(
    contactDirection,
    outerSlantDistance,
  );

  // Brown's levers, link and treadle lie in the drill shaft's plane. They run
  // just behind the shaft (clear of the thrust collar and of the bit, which
  // Brown draws in front of the treadle) and in front of the C-frame.
  const linkagePlaneZ = -0.36;
  // Brown's treadle fulcrum lies well below the frame (plate pivots 404 px
  // apart against 78 px from the drill axis), so the treadle passes under
  // the frame and across the drill below its chuck.
  const lowerLeverPivot = new THREE.Vector3(-0.82, -0.35, linkagePlaneZ);
  const upperLeverPivot = new THREE.Vector3(-0.82, 3.47, linkagePlaneZ);
  const leftLeverArmLength = 0.86;
  const upperRightArmLength = 0.82;
  const treadleRightArmLength = 3.05;
  const restLeverAngle = THREE.MathUtils.degToRad(12);
  const depressedLeverAngle = THREE.MathUtils.degToRad(-7);
  // The upper lever's right end is an eye with a short slot riding the
  // thrust-collar pin on the shaft top, as Brown joins the lever straight to
  // the shaft; the slot takes up the 0.018 change in the tip's reach.
  const slotCentre = 0.8292, slotHalfTravel = 0.0095, slotPinRadius = 0.06;
  const drillAxisX = 0;
  const feedCycle = {
    pressStart: 0.12,
    pressEnd: 0.37,
    lowerDwellEnd: 0.63,
    releaseEnd: 0.88,
  };
  const normalizeFeedPhase = (phase) => {
    for (const boundary of [
      0,
      feedCycle.pressStart,
      feedCycle.pressEnd,
      feedCycle.lowerDwellEnd,
      feedCycle.releaseEnd,
      1,
    ]) {
      if (Math.abs(phase - boundary) < 1e-12) {
        return boundary === 1 ? 0 : boundary;
      }
    }
    return phase;
  };

  const pointOnLever = (pivot, length, angle) => new THREE.Vector3(
    pivot.x + length * Math.cos(angle),
    pivot.y + length * Math.sin(angle),
    pivot.z,
  );
  // The collar pin stays on the drill axis and on the lever's centreline.
  const collarYAtLeverAngle = (angle) => upperLeverPivot.y
    + (drillAxisX - upperLeverPivot.x) * Math.tan(angle);
  const neutralCollarY = collarYAtLeverAngle(restLeverAngle);
  const depressedCollarY = collarYAtLeverAngle(depressedLeverAngle);
  const maximumFeedDown = neutralCollarY - depressedCollarY;

  const depressionAtPhase = (cyclePhase) => {
    if (cyclePhase < feedCycle.pressStart) {
      return { fraction: 0, fractionRatePerSecond: 0,
        stage: 'treadle-raised-feed-dwell' };
    }
    if (cyclePhase < feedCycle.pressEnd) {
      const duration = feedCycle.pressEnd - feedCycle.pressStart;
      const u = (cyclePhase - feedCycle.pressStart) / duration;
      return {
        fraction: quintic(u),
        fractionRatePerSecond:
          quinticDerivative(u) / (duration * demonstrationPeriod),
        stage: 'operator-pressing-treadle-and-feeding-drill-down',
      };
    }
    if (cyclePhase < feedCycle.lowerDwellEnd) {
      return { fraction: 1, fractionRatePerSecond: 0,
        stage: 'drill-held-at-full-depth' };
    }
    if (cyclePhase < feedCycle.releaseEnd) {
      const duration = feedCycle.releaseEnd - feedCycle.lowerDwellEnd;
      const u = (cyclePhase - feedCycle.lowerDwellEnd) / duration;
      return {
        fraction: 1 - quintic(u),
        fractionRatePerSecond:
          -quinticDerivative(u) / (duration * demonstrationPeriod),
        stage: 'operator-releasing-treadle-and-withdrawing-drill',
      };
    }
    return { fraction: 0, fractionRatePerSecond: 0,
      stage: 'treadle-raised-feed-dwell' };
  };

  const localContactAngle = (gear) => {
    const local = gearContactPoint.clone().sub(apex)
      .applyQuaternion(gear.quaternion.clone().invert());
    return Math.atan2(local.y, local.x);
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.62,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.44,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.56,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.54,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.29,
    roughness: 0.43,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const driverGear = makePitchConeGear({
    axis: driverAxis,
    boreRadius: 0.105,
    color: PALETTE.driver,
    indexTooth: 0,
    innerDistance: driverInnerDistance,
    outerDistance: driverOuterDistance,
    pitchConeAngle: driverPitchConeAngle,
    teeth: driverTeeth,
    toothHeight: 0.105,
  });
  driverGear.position.copy(apex);
  driverGear.userData.role =
    'large-hand-crank-driven-horizontal-axis-bevel-gear';
  const pinionGear = makePitchConeGear({
    axis: pinionAxis,
    boreRadius: .099,
    color: PALETTE.driven,
    indexTooth: 0,
    innerDistance: pinionInnerDistance,
    outerDistance: pinionOuterDistance,
    pitchConeAngle: pinionPitchConeAngle,
    teeth: pinionTeeth,
    toothHeight: 0.105,
  });
  pinionGear.position.copy(apex);
  pinionGear.userData.role =
    'small-axially-fixed-keyed-bore-bevel-pinion';
  const driverContactAngle = localContactAngle(driverGear);
  const pinionContactAngle = localContactAngle(pinionGear);
  const driverBasePhase = driverContactAngle;
  const pinionBasePhase = pinionContactAngle - Math.PI / pinionTeeth;

  const pinionKeyway = new THREE.Object3D();
  pinionKeyway.userData.role='longitudinal-keyway-in-small-bevel-pinion-bore';
  pinionGear.userData.rotor.add(pinionKeyway);
  const pinionRootZ0=pinionInnerDistance+.105*(pinionInnerDistance/pinionOuterDistance)*.55*Math.sin(pinionPitchConeAngle);
  const pinionRootZ1=pinionOuterDistance+.105*.55*Math.sin(pinionPitchConeAngle);
  const rootR1=pinionOuterPitchRadius-.105*.55*Math.cos(pinionPitchConeAngle);
  const keyHole=clip.union(poly(circle([0,0],.099,80)),poly([[.075,-.031],[.135,-.031],[.135,.031],[.075,.031]]));
  // Revolve the cone about the star-shaped keyed bore (round bore plus one
  // rectangular keyway) so every section is a proper quad: shrinking a flat
  // triangulated cap onto the cone folded cap triangles across the keyway.
  const keyCornerAngle=Math.atan2(.031,.135),keyRootAngle=Math.asin(.031/.099);
  const keyedBoreRadius=(angle)=>{
    const a=Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle)));
    if(a<=keyCornerAngle)return .135/Math.cos(a);
    if(a<=keyRootAngle)return .031/Math.sin(a);
    return .099;
  };
  const keyAngles=new Set();
  for(let i=0;i<192;i++)keyAngles.add(i/192*FULL_TURN-Math.PI);
  for(const edge of[keyCornerAngle,keyRootAngle])for(const sign of[-1,1])for(const eps of[-1e-5,0,1e-5])keyAngles.add(sign*edge+eps);
  for(let i=0;i<=24;i++)for(const [lo,hi] of[[-keyRootAngle,-keyCornerAngle],[-keyCornerAngle,keyCornerAngle],[keyCornerAngle,keyRootAngle]])keyAngles.add(lo+(hi-lo)*i/24);
  const sortedKeyAngles=[...keyAngles].sort((x,y)=>x-y);
  const rootR0=rootR1*pinionRootZ0/pinionRootZ1;
  const keyedPositions=[],keyedIndices=[];
  for(const angle of sortedKeyAngles){
    const c=Math.cos(angle),sn=Math.sin(angle),rho=keyedBoreRadius(angle);
    for(const [r,z]of[[rho,pinionRootZ0],[rootR0,pinionRootZ0],[rootR1,pinionRootZ1],[rho,pinionRootZ1]])keyedPositions.push(r*c,r*sn,z);
  }
  const keyedCount=sortedKeyAngles.length;
  for(let i=0;i<keyedCount;i++){const j=(i+1)%keyedCount;for(let k=0;k<4;k++){const k2=(k+1)%4,a0=i*4+k,a1=i*4+k2,b0=j*4+k,b1=j*4+k2;keyedIndices.push(a0,b0,b1,a0,b1,a1);}}
  const keyedBody=new THREE.BufferGeometry();
  keyedBody.setAttribute('position',new THREE.Float32BufferAttribute(keyedPositions,3));
  keyedBody.setIndex(keyedIndices);
  {
    let volume=0;const va=new THREE.Vector3(),vb=new THREE.Vector3(),vc=new THREE.Vector3();
    for(let i=0;i<keyedIndices.length;i+=3){va.fromArray(keyedPositions,keyedIndices[i]*3);vb.fromArray(keyedPositions,keyedIndices[i+1]*3);vc.fromArray(keyedPositions,keyedIndices[i+2]*3);volume+=va.dot(vb.cross(vc));}
    if(volume<0){for(let i=0;i<keyedIndices.length;i+=3)[keyedIndices[i+1],keyedIndices[i+2]]=[keyedIndices[i+2],keyedIndices[i+1]];keyedBody.setIndex(keyedIndices);}
  }
  creaseIndexedNormals(keyedBody);
  pinionGear.userData.body.geometry.dispose();pinionGear.userData.body.geometry=keyedBody;
  // The fixed upper bearing supports a rotating keyed hub. The feather can
  // therefore traverse it without sweeping through a stationary round bore.
  const pinionHub=new THREE.Mesh(plate(clip.difference(poly(circle([0,0],.20,96)),keyHole),pinionOuterDistance,1.17),drivenMaterial);
  pinionHub.userData.role='keyed-pinion-hub-turning-in-fixed-upper-bearing';
  pinionGear.userData.rotor.add(pinionHub);
  const pinionBearingCollars=[[.97,1.00],[1.14,1.17]].map(([low,high])=>{
    const collar=new THREE.Mesh(plate(clip.difference(poly(circle([0,0],.235,96)),keyHole),low,high),drivenMaterial);
    collar.userData.role='rotating-pinion-bearing-axial-retainer';
    pinionGear.userData.rotor.add(collar);return collar;
  });
  root.add(driverGear, pinionGear);

  const inputRotor = new THREE.Group();
  inputRotor.position.copy(apex);
  inputRotor.userData.axis = driverAxis.clone();
  inputRotor.userData.role =
    'horizontal-input-shaft-crank-and-handle-one-rigid-rotor';
  const inputShaft = cylinderAlongX(.090,2.43,darkMaterial,32);
  inputShaft.position.x = 1.355;
  inputShaft.userData.role = 'horizontal-hand-crank-input-shaft';
  inputRotor.add(inputShaft);
  const crankArm = makeBeam(
    new THREE.Vector3(2.42, 0, 0),
    new THREE.Vector3(2.42, 0.60, 0),
    { color: PALETTE.driver, depth: 0.13, thickness: 0.14 },
  );
  crankArm.userData.role = 'radial-hand-crank-arm';
  inputRotor.add(crankArm);
  const crankHandle = cylinderAlongX(0.105, 0.58, darkMaterial, 28);
  crankHandle.position.set(2.67, 0.60, 0);
  crankHandle.userData.role = 'free-hand-grip-on-input-crank';
  inputRotor.add(crankHandle);
  const crankIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 18, 12),
    whiteMaterial,
  );
  crankIndex.position.set(2.42, 0.60, 0.14);
  crankIndex.userData.role = 'white-index-on-rotating-hand-crank';
  inputRotor.add(crankIndex);
  // Gear tooth indexing need not put the visible hand crank end-on at rest.
  for(const part of[crankArm,crankHandle,crankIndex])part.applyMatrix4(new THREE.Matrix4().makeRotationX(-driverBasePhase));
  root.add(inputRotor);

  const drillSlide = new THREE.Group();
  drillSlide.userData.role =
    'nonrotating-axial-slide-carrying-thrust-collar-and-rotating-drill';
  drillSlide.userData.translationAxis = Y_AXIS.clone();
  const shaftSpinRotor = new THREE.Group();
  shaftSpinRotor.userData.axis = Y_AXIS.clone();
  shaftSpinRotor.userData.role =
    'rotating-keyed-drillshaft-chuck-and-bit';
  // The shaft runs up past the frame to the collar and lever, as drawn.
  const drillShaftTop = neutralCollarY + .18;
  const drillShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(.095,.095,drillShaftTop-.115,32),
    drivenMaterial,
  );
  drillShaft.position.y = (drillShaftTop+.115)/2;
  drillShaft.userData.role =
    'vertical-drillshaft-sliding-through-small-bevel-pinion';
  shaftSpinRotor.add(drillShaft);
  const shaftFeather = new THREE.Mesh(
    new THREE.BoxGeometry(.050,.51,.054),
    accentMaterial,
  );
  // The feather stays inside the keyed pinion bore and hub over the whole
  // 0.27 feed, clear of the large bevel's inner tooth ends below the pinion
  // and hidden inside the hub at the top (Brown shows a plain shaft).
  shaftFeather.position.set(.102,2.485,0);
  shaftFeather.userData.role =
    'longitudinal-feather-key-sliding-in-pinion-groove';
  shaftSpinRotor.add(shaftFeather);
  const shaftSpinIndex = new THREE.Mesh(
    new THREE.BoxGeometry(.040,.26,.028),
    whiteMaterial,
  );
  shaftSpinIndex.position.set(0,.96,.110);
  shaftSpinIndex.userData.role =
    'white-index-showing-drillshaft-spin-during-axial-feed';
  shaftSpinRotor.add(shaftSpinIndex);
  const chuck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.14, 0.34, 32),
    darkMaterial,
  );
  chuck.position.y = 0.02;
  chuck.userData.role = 'rotating-drill-chuck-fixed-to-sliding-shaft';
  shaftSpinRotor.add(chuck);
  const drillBit = new THREE.Mesh(
    new THREE.ConeGeometry(0.115, 0.56, 8),
    drivenMaterial,
  );
  drillBit.position.y = -0.43;
  drillBit.rotation.x=Math.PI;
  drillBit.userData.role = 'rotating-pointed-drill-bit';
  shaftSpinRotor.add(drillBit);
  const bitFlutes = [0, Math.PI / 2].map((angle) => {
    const flute = new THREE.Mesh(
      new THREE.BoxGeometry(0.030, 0.42, 0.032),
      accentMaterial,
    );
    flute.position.set(
      Math.cos(angle) * 0.070,
      -0.35,
      Math.sin(angle) * 0.070,
    );
    flute.rotation.y = angle;
    flute.rotation.z = 0.18;
    flute.userData.role = 'visible-cutting-flute-on-drill-bit';
    // Brown draws a plain pointed bit; the flute strips stood proud of it.
    flute.visible = false;
    shaftSpinRotor.add(flute);
    return flute;
  });
  drillSlide.add(shaftSpinRotor);

  const thrustCollar = new THREE.Mesh(
    boredCylinderGeometry(.205,.100,.22),
    darkMaterial,
  );
  thrustCollar.position.y = neutralCollarY;
  thrustCollar.userData.role =
    'nonrotating-thrust-collar-translating-with-drillshaft';
  drillSlide.add(thrustCollar);
  root.add(drillSlide);

  const lowerLeverRotor = new THREE.Group();
  lowerLeverRotor.position.copy(lowerLeverPivot);
  lowerLeverRotor.userData.axis = Z_AXIS.clone();
  lowerLeverRotor.userData.role = 'foot-treadle-rocking-about-fixed-lower-pivot';
  const treadleBeam = new THREE.Mesh(
    new THREE.BoxGeometry(
      leftLeverArmLength + treadleRightArmLength,
      0.12,
      0.20,
    ),
    driverMaterial,
  );
  treadleBeam.position.x = (
    treadleRightArmLength - leftLeverArmLength
  ) / 2;
  treadleBeam.userData.role = 'long-two-sided-foot-treadle-lever';
  lowerLeverRotor.add(treadleBeam);
  const treadlePedal = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.13, 0.50),
    driverMaterial,
  );
  treadlePedal.position.x = treadleRightArmLength - 0.12;
  treadlePedal.userData.role = 'broad-foot-pad-at-end-of-treadle';
  lowerLeverRotor.add(treadlePedal);
  const lowerPivotHub = boredJournal(.16,.084,.48,darkMaterial);
  lowerPivotHub.userData.role = 'fixed-pivot-boss-of-foot-treadle';
  lowerLeverRotor.add(lowerPivotHub);
  root.add(lowerLeverRotor);

  const upperLeverRotor = new THREE.Group();
  upperLeverRotor.position.copy(upperLeverPivot);
  upperLeverRotor.userData.axis = Z_AXIS.clone();
  upperLeverRotor.userData.role =
    'upper-feed-lever-rocking-with-treadle-through-vertical-link';
  const upperLeverBeam = new THREE.Mesh(
    new THREE.BoxGeometry(
      leftLeverArmLength + upperRightArmLength,
      0.13,
      0.20,
    ),
    accentMaterial,
  );
  upperLeverBeam.position.x = (
    upperRightArmLength - leftLeverArmLength
  ) / 2;
  upperLeverBeam.userData.role = 'two-sided-upper-feed-lever';
  upperLeverRotor.add(upperLeverBeam);
  // Short enough to stay in front of the frame's top arm (front face -0.54).
  const upperPivotHub = boredJournal(.16,.084,.30,darkMaterial);
  upperPivotHub.userData.role = 'fixed-pivot-boss-of-upper-feed-lever';
  upperLeverRotor.add(upperPivotHub);
  root.add(upperLeverRotor);

  const makeFeedRod=(length,width,role)=>{
    const {rod}=makeBoredLinkRod({bodyMaterial:accentMaterial,length,width,depth:.13,planeZ:0,boreRadius:.064,role});
    rod.userData.setEndpoints=(a,b)=>{rod.position.set(a.x,a.y,linkagePlaneZ+.22);rod.rotation.z=Math.atan2(b.y-a.y,b.x-a.x);};
    root.add(rod);return rod;
  };
  const verticalConnector=makeFeedRod(upperLeverPivot.distanceTo(lowerLeverPivot),.10,'rigid-vertical-link-joining-left-ends-of-treadle-and-upper-lever');
  const feedPins=[];
  for(const [lever,x] of [[lowerLeverRotor,-leftLeverArmLength],[upperLeverRotor,-leftLeverArmLength]]){
    const pin=cylinderAlongZ(.06,.56,darkMaterial);pin.position.set(x,0,.14);lever.add(pin);feedPins.push(pin);
  }
  // The collar pin runs back from inside the collar wall through the lever slot.
  const collarPinFront=-.12,collarPinBack=linkagePlaneZ-.13;
  const collarPin=cylinderAlongZ(slotPinRadius,collarPinFront-collarPinBack,darkMaterial);collarPin.position.set(0,neutralCollarY,(collarPinFront+collarPinBack)/2);collarPin.userData.role='thrust-collar-pin-riding-in-upper-lever-slot';drillSlide.add(collarPin);
  const thrustRings=[neutralCollarY-.15,neutralCollarY+.15].map(y=>{
    const ring=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.06,48),drivenMaterial);ring.position.y=y;shaftSpinRotor.add(ring);return ring;
  });
  const pivotShafts=[lowerLeverPivot,upperLeverPivot].map(p=>{
    const pin=cylinderAlongZ(.08,.64,darkMaterial);pin.position.set(p.x,p.y,linkagePlaneZ-.06);root.add(pin);return pin;
  });
  for(const beam of [treadleBeam,upperLeverBeam]){
    const p=beam.geometry.parameters;
    let outline=poly([[-p.width/2,-p.height/2],[p.width/2,-p.height/2],[p.width/2,p.height/2],[-p.width/2,p.height/2]]);
    const holes=[poly(circle([-beam.position.x,0],.084,64))];
    // Pass 92: round eye at the left end, concentric with the link pin (as
    // Brown draws both lever ends), so the pin no longer stands on the
    // beam's square end: radius 0.095 about the 0.06 pin, just inside the link's own 0.099 eye.
    outline=clip.union(outline,poly(circle([-p.width/2,0],.095,96)));
    if(beam===upperLeverBeam){
      // Round eye at the right end, concentric with the slot, as one plate.
      const eye=slotCentre-beam.position.x;
      outline=clip.union(poly([[-p.width/2,-p.height/2],[eye,-p.height/2],[eye,p.height/2],[-p.width/2,p.height/2]]),poly(circle([eye,0],.15,96)),poly(circle([-p.width/2,0],.095,96)));
      const a=eye-slotHalfTravel,b=eye+slotHalfTravel,r=slotPinRadius+.004,slot=[];
      for(let i=0;i<=24;i++){const t=Math.PI/2+Math.PI*i/24;slot.push([a+r*Math.cos(t),r*Math.sin(t)]);}
      for(let i=0;i<=24;i++){const t=-Math.PI/2+Math.PI*i/24;slot.push([b+r*Math.cos(t),r*Math.sin(t)]);}
      holes.push([slot]);
    }
    beam.geometry.dispose();beam.geometry=plate(clip.difference(outline,...holes),-p.depth/2,p.depth/2);
  }

  const frame = new THREE.Group();
  frame.userData.fixed = true;
  frame.userData.role = 'fixed-c-frame-and-bearings-of-drilling-machine';
  const frameRearZ = -0.68;
  const frameBaseY = -1.05;
  const frameColumnX = 1.52;
  // Brown draws a C-bracket: a right-hand column (the crank shaft passes
  // through it) with upper and lower arms reaching left past the drill
  // shaft, open on the left, and no bed beneath it.
  const frameLeftX = -0.74;
  const frameBottomY = 0.48;
  const frameBase = makeBeam(
    new THREE.Vector3(frameLeftX - 0.09, frameBottomY, frameRearZ),
    new THREE.Vector3(frameColumnX + 0.11, frameBottomY, frameRearZ),
    { color: PALETTE.frame, depth: 0.28, thickness: 0.18 },
  );
  frameBase.userData.role = 'lower-arm-of-drill-c-frame';
  frame.add(frameBase);
  const frameColumn = makeBeam(
    new THREE.Vector3(frameColumnX, frameBottomY, frameRearZ),
    new THREE.Vector3(frameColumnX, 3.25, frameRearZ),
    { color: PALETTE.frame, depth: 0.28, thickness: 0.22 },
  );
  frameColumn.userData.role = 'right-upright-of-drill-c-frame';
  frame.add(frameColumn);
  const frameTop = makeBeam(
    new THREE.Vector3(frameLeftX - 0.09, 3.25, frameRearZ),
    new THREE.Vector3(frameColumnX, 3.25, frameRearZ),
    { color: PALETTE.frame, depth: 0.28, thickness: 0.18 },
  );
  frameTop.userData.role = 'upper-arm-of-drill-c-frame';
  frame.add(frameTop);
  const inputBearingBridge = makeBeam(
    new THREE.Vector3(1.48, apex.y, frameRearZ),
    new THREE.Vector3(1.48, apex.y, -.205),
    { color: PALETTE.frame, depth: 0.16, thickness: 0.16 },
  );
  inputBearingBridge.userData.role =
    'bridge-to-horizontal-input-shaft-bearing';
  frame.add(inputBearingBridge);
  const inputBearing = torusNormalToAxis(
    0.155,
    0.050,
    frameMaterial,
    X_AXIS,
    48,
  );
  inputBearing.position.set(1.48, apex.y, 0);
  inputBearing.userData.role = 'fixed-horizontal-input-shaft-bearing';
  frame.add(inputBearing);
  const lowerShaftGuide = torusNormalToAxis(
    .155,
    .050,
    frameMaterial,
    Y_AXIS,
    48,
  );
  lowerShaftGuide.position.set(0, 0.48, 0);
  lowerShaftGuide.userData.role =
    'fixed-lower-guide-bearing-for-sliding-rotating-drillshaft';
  frame.add(lowerShaftGuide);
  const upperShaftGuide = torusNormalToAxis(
    .255,
    .050,
    frameMaterial,
    Y_AXIS,
    48,
  );
  upperShaftGuide.position.set(0,2.65,0);
  upperShaftGuide.userData.role =
    'fixed-upper-bearing-around-keyed-pinion-hub';
  frame.add(upperShaftGuide);
  // The treadle fulcrum stands on its own post, as the plate's cropped
  // stand below the lever shows.
  const lowerLeverSupport = makeBeam(
    new THREE.Vector3(lowerLeverPivot.x, frameBaseY, linkagePlaneZ-.42),
    lowerLeverPivot.clone().setZ(linkagePlaneZ-.42),
    { color: PALETTE.frame, depth: 0.16, thickness: 0.16 },
  );
  lowerLeverSupport.userData.role = 'fixed-support-for-treadle-pivot';
  frame.add(lowerLeverSupport);
  const upperLeverSupport = makeBeam(
    new THREE.Vector3(upperLeverPivot.x, 3.25, frameRearZ),
    upperLeverPivot.clone().setZ(linkagePlaneZ-.36),
    { color: PALETTE.frame, depth: 0.16, thickness: 0.16 },
  );
  upperLeverSupport.userData.role = 'fixed-support-for-upper-lever-pivot';
  frame.add(upperLeverSupport);
  const shaftGuideBridges=[];
  for(const [guide,start] of [[lowerShaftGuide,null],
      [upperShaftGuide,new THREE.Vector3(0,3.25,frameRearZ)]]){
    const rear=new THREE.Vector3(0,guide.position.y,frameRearZ);
    // The closed frame's lower bar already carries the lower guide's stem.
    const spans=start?[[start,rear]]:[];
    for(const [a,b] of [...spans,[rear,new THREE.Vector3(0,guide.position.y,guide===upperShaftGuide?-.285:-.185)]]){
      const support=makeBeam(a,b,{color:PALETTE.frame,depth:.12,thickness:.12});
      frame.add(support);shaftGuideBridges.push(support);
    }
  }
  root.add(frame);

  const pitchConeNormal = (axis, pitchConeAngle) => {
    const offset = gearContactPoint.clone().sub(apex);
    const radial = offset.clone().addScaledVector(
      axis,
      -offset.dot(axis),
    ).normalize();
    return radial.addScaledVector(
      axis,
      -Math.tan(pitchConeAngle),
    ).normalize();
  };
  const driverPitchConeNormal = pitchConeNormal(
    driverAxis,
    driverPitchConeAngle,
  );
  const pinionPitchConeNormal = pitchConeNormal(
    pinionAxis,
    pinionPitchConeAngle,
  );

  const stateAtTime = (time) => {
    const driverTravelAngle = driverAngularSpeed * time;
    const driverAngle = driverBasePhase + driverTravelAngle;
    const pinionLocalAngle = pinionBasePhase
      + pinionLocalAngularSpeed * time;
    const drillShaftAngle = pinionLocalAngle;
    const cycleCoordinate = time / demonstrationPeriod;
    const cyclePhase = normalizeFeedPhase(
      positiveModulo(cycleCoordinate, 1),
    );
    const cycleIndex = Math.floor(cycleCoordinate);
    const depression = depressionAtPhase(cyclePhase);
    const leverAngle = THREE.MathUtils.lerp(
      restLeverAngle,
      depressedLeverAngle,
      depression.fraction,
    );
    const leverAngularSpeed = (
      depressedLeverAngle - restLeverAngle
    ) * depression.fractionRatePerSecond;
    const lowerLeftPoint = pointOnLever(
      lowerLeverPivot,
      -leftLeverArmLength,
      leverAngle,
    );
    const upperLeftPoint = pointOnLever(
      upperLeverPivot,
      -leftLeverArmLength,
      leverAngle,
    );
    const footPoint = pointOnLever(
      lowerLeverPivot,
      treadleRightArmLength,
      leverAngle,
    );
    const upperTip = pointOnLever(
      upperLeverPivot,
      upperRightArmLength,
      leverAngle,
    );
    const collarY = collarYAtLeverAngle(leverAngle);
    const collarConnectionPoint = new THREE.Vector3(
      drillAxisX,
      collarY,
      linkagePlaneZ,
    );
    const feedDown = neutralCollarY - collarY;
    const upperTipHorizontalRate = -upperRightArmLength
      * Math.sin(leverAngle) * leverAngularSpeed;
    const collarRatePerLeverRadian = (drillAxisX - upperLeverPivot.x)
      / Math.cos(leverAngle) ** 2;
    const slotPosition = (drillAxisX - upperLeverPivot.x) / Math.cos(leverAngle);
    const feedVelocityDown = -collarRatePerLeverRadian
      * leverAngularSpeed;
    const driverAngularVelocity = driverAxis.clone()
      .multiplyScalar(driverAngularSpeed);
    const pinionAngularVelocity = pinionAxis.clone()
      .multiplyScalar(pinionLocalAngularSpeed);
    const contactRadius = gearContactPoint.clone().sub(apex);
    const driverSurfaceVelocity = new THREE.Vector3().crossVectors(
      driverAngularVelocity,
      contactRadius,
    );
    const pinionSurfaceVelocity = new THREE.Vector3().crossVectors(
      pinionAngularVelocity,
      contactRadius,
    );
    return {
      collarConnectionPoint,
      collarRatePerLeverRadian,
      collarY,
      completedDriverTurns: driverTravelAngle / FULL_TURN,
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      depressionFraction: depression.fraction,
      drillShaftAngle,
      drillShaftAngularSpeed,
      driverAngle,
      driverAngularSpeed,
      driverSurfaceVelocity,
      featherPhaseError: wrappedAngle(
        drillShaftAngle - pinionLocalAngle,
      ),
      feedDown,
      feedVelocityDown,
      footPoint,
      gearMeshPhaseInvariant:
        driverTeeth * (driverAngle - driverBasePhase)
        + pinionTeeth * (pinionLocalAngle - pinionBasePhase),
      gearPitchLineSlipVelocity: driverSurfaceVelocity.clone()
        .sub(pinionSurfaceVelocity),
      leverAngle,
      leverAngularSpeed,
      lowerLeftPoint,
      pinionLocalAngle,
      pinionLocalAngularSpeed,
      pinionSurfaceVelocity,
      stage: depression.stage,
      slotPosition,
      // The collar pin lies on the lever centreline, inside the slot's travel.
      slotLineError: Math.abs((collarConnectionPoint.y - upperLeverPivot.y) * Math.cos(leverAngle)
        - (collarConnectionPoint.x - upperLeverPivot.x) * Math.sin(leverAngle)),
      slotTravelExcess: Math.max(0, Math.abs(slotPosition - slotCentre) - slotHalfTravel),
      upperLeftPoint,
      upperTip,
      upperTipHorizontalRate,
      verticalConnectorLengthError:
        upperLeftPoint.distanceTo(lowerLeftPoint)
        - upperLeverPivot.distanceTo(lowerLeverPivot),
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(driverGear, state.driverAngle);
    setSpin(pinionGear, state.pinionLocalAngle);
    inputRotor.rotation.x = state.driverAngle;
    drillSlide.position.y = -state.feedDown;
    shaftSpinRotor.rotation.y = state.drillShaftAngle;
    lowerLeverRotor.rotation.z = state.leverAngle;
    upperLeverRotor.rotation.z = state.leverAngle;
    verticalConnector.userData.setEndpoints(
      state.lowerLeftPoint,
      state.upperLeftPoint,
    );
    root.userData.currentState = state;
    root.userData.contacts = {
      bevelMesh: {
        contactPoint: gearContactPoint.clone(),
        normalOppositionError: driverPitchConeNormal.clone()
          .add(pinionPitchConeNormal).length(),
        phaseInvariant: state.gearMeshPhaseInvariant,
        pitchLineSlipSpeed: state.gearPitchLineSlipVelocity.length(),
      },
      featherAndGroove: {
        angularPhaseError: state.featherPhaseError,
        pinionAxialPositionError: pinionGear.position.distanceTo(apex),
        shaftFeedDown: state.feedDown,
      },
      feedLinkage: {
        slotLineError: state.slotLineError,
        slotTravelExcess: state.slotTravelExcess,
        verticalConnectorLengthError: state.verticalConnectorLengthError,
      },
    };
  };

  root.userData = {
    archetype:
      'hand-crank-bevel-keyed-sliding-spindle-treadle-feed-drill',
    blocks: {
      bitFlutes,
      chuck,
      crankArm,
      crankHandle,
      crankIndex,
      drillBit,
      drillShaft,
      drillSlide,
      driverGear,
      frame,
      frameBase,
      frameColumn,
      frameTop,
      inputBearing,
      inputBearingBridge,
      inputRotor,
      inputShaft,
      lowerLeverPivot: lowerLeverPivot.clone(),
      lowerLeverRotor,
      lowerLeverSupport,
      lowerPivotHub,
      lowerShaftGuide, shaftGuideBridges,
      pinionGear, pinionHub, pinionBearingCollars,
      pinionKeyway,
      shaftFeather,
      shaftSpinIndex,
      shaftSpinRotor,
      thrustCollar,
      treadleBeam,
      treadlePedal,
      upperLeverBeam,
      upperLeverPivot: upperLeverPivot.clone(),
      upperLeverRotor,
      upperLeverSupport,
      upperPivotHub,
      upperShaftGuide,
      verticalConnector, feedPins, collarPin, pivotShafts, thrustRings,
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'small bevel pinion and drillshaft rotation from the hand crank',
        'upper lever, thrust collar, and drillshaft axial feed from the treadle',
      ],
      independentPrescribedInputs: 2,
      inputs: [
        'continuous hand-crank rotation',
        'operator treadle depression and release',
      ],
      note:
        'the feather-and-groove permits axial sliding but removes relative rotation between the fixed-height pinion and drillshaft',
      storedEnergyStates: 0,
    },
    dynamics: {
      returnForceSpecifiedBySource: false,
      sourceSpecifiesGearSpeedInertiaOrDrillingLoad: false,
      treadleSchedule:
        'a smooth press, lower dwell, smooth release, and raised dwell demonstrate the operator-controlled feed without claiming a source spring or automatic return',
    },
    feedLaw: {
      collarYAtLeverAngle,
      depressionAtPhase,
      pointOnLever,
    },
    fidelity: 'authored',
    gearContact: {
      apex: apex.clone(),
      contactPoint: gearContactPoint.clone(),
      driverAxis: driverAxis.clone(),
      driverPitchConeNormal,
      pinionAxis: pinionAxis.clone(),
      pinionPitchConeNormal,
    },
    geometry: {
      bevelRatio,
      depressedCollarY,
      depressedLeverAngle,
      demonstrationPeriod,
      drillShaftAngularSpeed,
      driverBasePhase,
      driverInnerDistance,
      driverOuterDistance,
      driverOuterPitchRadius,
      driverPitchConeAngle,
      driverTeeth,
      driverAngularSpeed,
      feedCycle: { ...feedCycle },
      gearContactPoint: gearContactPoint.clone(),
      leftLeverArmLength,
      linkagePlaneZ,
      lowerLeverPivot: lowerLeverPivot.clone(),
      maximumFeedDown,
      neutralCollarY,
      outerSlantDistance,
      pinionBasePhase,
      pinionInnerDistance,
      pinionLocalAngularSpeed,
      pinionOuterDistance,
      pinionOuterPitchRadius,
      pinionPitchConeAngle,
      pinionTeeth,
      restLeverAngle,
      shaftAngle,
      slotCentre,
      slotHalfTravel,
      treadleRightArmLength,
      upperLeverPivot: upperLeverPivot.clone(),
      upperRightArmLength,
    },
    mechanism:
      'hand-cranked-large-bevel-gear-driving-a-small-fixed-height-keyed-bore-pinion-and-sliding-rotating-drillshaft-depressed-by-a-treadle-vertical-link-upper-lever-and-thrust-collar',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate366: {
        crankHandle: new THREE.Vector2(386, 119),
        drillAxisX: 213,
        drillBitTip: new THREE.Vector2(216, 507),
        imageHeight: 525,
        imageWidth: 525,
        lowerLeverPivot: new THREE.Vector2(130, 457),
        measurementUncertaintyPixels: 10,
        treadleFootEnd: new THREE.Vector2(459, 365),
        upperLeverLeftJoint: new THREE.Vector2(63, 75),
        upperLeverPivot: new THREE.Vector2(135, 53),
        upperLeverRightJoint: new THREE.Vector2(214, 31),
        verticalLinkBottomJoint: new THREE.Vector2(55, 481),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the machine is a drill',
          'the large bevel gear supplies rotary motion',
          'the vertical drillshaft slides through the small bevel gear',
          'a feather and groove make the shaft turn with the small bevel gear while it slides',
          'a treadle connected to the upper lever depresses the drillshaft',
        ],
        engravingEvidence:
          'the plate shows the right-hand crank and horizontal shaft, unequal right-angle bevel pair, fixed rectangular frame, vertical drillshaft and bit, long lower foot treadle, far-left vertical link, and two-sided upper lever attached to the shaft top',
        reconstructionDisclosure:
          'tooth counts, pitch-cone dimensions, speed, treadle travel, smooth operator schedule, lever slot, and omitted bearing details are engineered choices; Brown supplies the component chain but no dimensions or timing',
      },
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      demonstrationPeriod,
      feedCycle: { ...feedCycle },
      note:
        'one hand-crank turn produces two drillshaft turns while one independent operator treadle press-and-release cycle returns the feed linkage to its raised position',
    },
    transmission: {
      bevelLaw:
        'pinion local angular speed = -(32/16) times large-gear speed; pitch-line surface velocities are identical at the common pitch-cone contact',
      featherLaw:
        'drillshaft world angle equals pinion local angle because both axes point up; their physical world angular velocities are identical at every axial feed position',
      feedLaw:
        'equal-angle upper and lower levers keep the far-left connector rigid; the slotted end of the upper lever rides the thrust-collar pin on the drill axis, so the collar has exact vertical travel',
      motionSuperposition:
        'spindle rotation is independent of axial feed, so the bit continues rotating during press, both dwells, and release',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.12, -0.91, -1.26),
    new THREE.Vector3(3.08, 4.04, 1.18),
  );
  root.userData.groundFloorY = -0.89;
  // Undrawn markers stay allocated for kinematic checks but are not shown;
  // the treadle is Brown's plain bar without a foot pad.
  for (const part of [crankIndex, shaftSpinIndex, treadlePedal]) part.visible = false;
  // Brown draws both bevel wheels cut in section on the plane of their
  // axes. That is engraving notation: the model shows both wheels whole,
  // so rotating the view never reveals a half-wheel.
  const bevelSectionParts = [];
  root.userData.bevelSectionParts = bevelSectionParts;
  // Brown's plate is a flat front elevation.
  root.userData.cameraDirection=new THREE.Vector3(0,0.03,1);
  root.userData.cameraFov=18;
  fitPistonGuide(root,update,demonstrationPeriod);
  markShadows(root);
  return {
    cameraDirection:root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredTreadleDrillMovement(movement) {
  if (movement.id === 366) return treadleBevelDrillingMachine(movement);
  return null;
}
