import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeBoredPlanarLink } from './bored-planar-link.js';
import { boreBoxAtLocalPoint, boreZCylinder, addZJournal, finishSpringFamily, finiteSawSheave } from './spring-pivot-family-parts.js';
import {
  CircularArcCurve3,
  PALETTE,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';
import { makeLaidRopeMesh } from './laid-rope.js';
import { circle, plate, poly, polygonClipping } from './finite-plate-geometry.js';

const FULL_TURN = Math.PI * 2;

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

// A capped round bar whose lower end is cut level (flat on its pad).
function closedBarBetween(start, end, radius, material) {
  const axis = end.clone().sub(start);
  const length = axis.length();
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 24);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
  return mesh;
}

const ROPE_RADIUS = 0.025;

// One continuous laid rope per side: up from the carriage tie, half round
// the top of its pulley, and down to the counterweight. The path starts at
// the carriage tie, which moves with the rope's own material, so arc length
// from that end is a material coordinate and the lay needs no extra travel.
function counterweightRopePath({
  center,
  radius,
  innerX,
  outerX,
  tieY,
  weightY,
}) {
  const z = center.z;
  const path = new THREE.CurvePath();
  path.add(new THREE.LineCurve3(
    new THREE.Vector3(innerX, tieY, z),
    new THREE.Vector3(innerX, center.y, z),
  ));
  const radialStart = new THREE.Vector3(innerX - center.x, 0, 0);
  // Over the top: counter-clockwise from the right side of the left pulley,
  // clockwise from the left side of the right pulley.
  const sweep = innerX > center.x ? Math.PI : -Math.PI;
  path.add(new CircularArcCurve3(
    center,
    radialStart,
    new THREE.Vector3(0, 0, 1),
    sweep,
  ));
  path.add(new THREE.LineCurve3(
    new THREE.Vector3(outerX, center.y, z),
    new THREE.Vector3(outerX, weightY, z),
  ));
  path.userData = { radius };
  return path;
}

function pendulumTreeSaw(movement) {
  const root = new THREE.Group();

  const pendulumPivot = new THREE.Vector3(-3.25, 2.18, 0.34);
  const pendulumLength = 3.26;
  const rodAttachmentRadius = 2.02;
  const officialHalfSwingVector = new THREE.Vector2(
    1.001871,
    7.937018,
  );
  const pendulumAmplitude = Math.atan2(
    officialHalfSwingVector.x,
    officialHalfSwingVector.y,
  );
  const pendulumPeriod = 2.4;
  const pendulumAngularFrequency = FULL_TURN / pendulumPeriod;
  const connectingRodLength = 3.64;
  const feedMeanY = 0.23;
  const feedAmplitude = 0.47;
  const pendulumCyclesPerDemonstration = 6;
  const demonstrationPeriod = pendulumPeriod
    * pendulumCyclesPerDemonstration;
  const feedAngularFrequency = FULL_TURN / demonstrationPeriod;
  const sawPinZ = pendulumPivot.z;
  const pulleyRadius = 0.30;
  const pulleyY = 1.79;
  const pulleyCenters = [
    new THREE.Vector3(-0.70, pulleyY, 0.34),
    new THREE.Vector3(3.40, pulleyY, 0.34),
  ];
  const carriageAnchorLocalY = 0.64;
  const counterweightMeanY = 0.18;
  const counterweightRopeTopOffset = 0.25;
  const pulleyStartAngles = [0.19, -0.27];
  // Centred under the mean blade span (0.34..3.08 over the stroke), as
  // Brown draws the log beneath the middle of the saw.
  // The log lies end-on to the viewer, centred on the saw's plane
  // (z = 0.34), so the saw works in a kerf across the middle of the log
  // between the two frame posts.
  const logCenter = new THREE.Vector3(1.71, -1.24, 0.34);
  const logRadius = 0.67;
  const logLength = 2.0;

  const stateAtTime = (time) => {
    const pendulumPhase = pendulumAngularFrequency * time;
    const pendulumAngle = pendulumAmplitude
      * Math.sin(pendulumPhase);
    const pendulumAngularSpeed = pendulumAmplitude
      * pendulumAngularFrequency * Math.cos(pendulumPhase);
    const pendulumAngularAcceleration = -pendulumAmplitude
      * pendulumAngularFrequency ** 2 * Math.sin(pendulumPhase);
    const rodJoint = pendulumPivot.clone().add(new THREE.Vector3(
      Math.sin(pendulumAngle) * rodAttachmentRadius,
      -Math.cos(pendulumAngle) * rodAttachmentRadius,
      0,
    ));
    const rodJointVelocity = new THREE.Vector3(
      Math.cos(pendulumAngle) * rodAttachmentRadius
        * pendulumAngularSpeed,
      Math.sin(pendulumAngle) * rodAttachmentRadius
        * pendulumAngularSpeed,
      0,
    );
    const feedPhase = feedAngularFrequency * time;
    const guideY = feedMeanY + feedAmplitude * Math.cos(feedPhase);
    const guideVelocity = -feedAmplitude * feedAngularFrequency
      * Math.sin(feedPhase);
    const guideAcceleration = -feedAmplitude * feedAngularFrequency ** 2
      * Math.cos(feedPhase);
    const verticalSeparation = guideY - rodJoint.y;
    const horizontalRodProjection = Math.sqrt(
      connectingRodLength ** 2 - verticalSeparation ** 2,
    );
    const sawPin = new THREE.Vector3(
      rodJoint.x + horizontalRodProjection,
      guideY,
      sawPinZ,
    );
    const verticalSeparationSpeed = guideVelocity
      - rodJointVelocity.y;
    const sawPinVelocity = new THREE.Vector3(
      rodJointVelocity.x
        - verticalSeparation * verticalSeparationSpeed
          / horizontalRodProjection,
      guideVelocity,
      0,
    );
    const counterweightY = counterweightMeanY
      - (guideY - feedMeanY);
    const counterweightVelocity = -guideVelocity;
    const feedDisplacementFromStart = guideY
      - (feedMeanY + feedAmplitude);
    const pulleyAngles = [
      pulleyStartAngles[0]
        + feedDisplacementFromStart / pulleyRadius,
      pulleyStartAngles[1]
        - feedDisplacementFromStart / pulleyRadius,
    ];
    const pulleyAngularSpeeds = [
      guideVelocity / pulleyRadius,
      -guideVelocity / pulleyRadius,
    ];
    const anchorY = guideY + carriageAnchorLocalY;
    const counterweightRopeTopY = counterweightY
      + counterweightRopeTopOffset;
    const ropeLengths = pulleyCenters.map(() => (
      (pulleyY - anchorY)
        + Math.PI * pulleyRadius
        + (pulleyY - counterweightRopeTopY)
    ));
    return {
      anchorY,
      connectingRodLength,
      counterweightRopeTopY,
      counterweightVelocity,
      counterweightY,
      feedPhase,
      guideAcceleration,
      guideVelocity,
      guideY,
      horizontalRodProjection,
      pendulumAngle,
      pendulumAngularAcceleration,
      pendulumAngularSpeed,
      pendulumPhase,
      pulleyAngles,
      pulleyAngularSpeeds,
      rodJoint,
      rodJointVelocity,
      ropeLengths,
      sawPin,
      sawPinVelocity,
      verticalSeparation,
      verticalSeparationSpeed,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.59,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.47,
  });
  const pendulumMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.58,
  });
  const carriageMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const sawMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.51,
  });
  const ropeMaterial = matte(0x28704c, {
    metalness: 0.04,
    roughness: 0.72,
  });
  const woodMaterial = matte(0x8c5d31, {
    metalness: 0.01,
    roughness: 0.88,
  });
  const cutWoodMaterial = matte(0xc79a59, {
    metalness: 0.01,
    roughness: 0.84,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.44 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-overhead-frame-with-two-rope-pulleys-and-pendulum-a-frame';
  root.add(fixedFrame);
  const framePosts = [];
  for (const x of [-0.95, 3.65]) {
    const post = new THREE.Mesh(
      // Down to the feet on the common ground line (y -2.0) that also
      // carries the log's plank and the pendulum's A-frame.
      new THREE.BoxGeometry(0.16, 3.855, 0.22),
      frameMaterial,
    );
    post.position.set(x, 0.0125, 0);
    post.userData.role = 'fixed-overhead-frame-post';
    framePosts.push(post);
    fixedFrame.add(post);
  }
  const topBeam = new THREE.Mesh(
    new THREE.BoxGeometry(4.92, 0.17, 0.24),
    frameMaterial,
  );
  topBeam.position.set(1.35, 1.98, 0);
  topBeam.userData.role = 'fixed-pulley-supporting-top-beam';
  fixedFrame.add(topBeam);
  const frameFeet = [];
  for (const x of [-0.95, 3.65]) {
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(1.08, 0.17, 0.72),
      frameMaterial,
    );
    foot.position.set(x, -1.915, 0);
    foot.userData.role = 'fixed-overhead-frame-foot';
    frameFeet.push(foot);
    fixedFrame.add(foot);
  }

  const pendulumFrame = new THREE.Group();
  pendulumFrame.userData.fixed = true;
  pendulumFrame.userData.role = 'fixed-triangular-pendulum-standard';
  root.add(pendulumFrame);
  // The A-frame's two legs are closed round bars from the pivot down to the
  // common ground line, each ending on a small pad.
  const legGroundY = -2.0;
  const pendulumFeet = [];
  const pendulumSupports = [-4.32, -2.18].map((footX) => {
    const top = pendulumPivot.clone().setZ(0.16);
    const foot = new THREE.Vector3(footX, legGroundY + 0.06, 0.16);
    const leg = closedBarBetween(top, foot, 0.075, frameMaterial);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.06, 0.26), frameMaterial);
    pad.position.set(footX, legGroundY + 0.03, 0.16);
    pad.userData.role = 'pendulum-a-frame-leg-foot';
    pendulumFeet.push(pad);
    pendulumFrame.add(pad);
    return leg;
  });
  for (const support of pendulumSupports) {
    support.userData.role = 'pendulum-a-frame-leg';
    pendulumFrame.add(support);
  }
  const pendulumBase = new THREE.Mesh(
    new THREE.BoxGeometry(2.62, 0.18, 0.72),
    frameMaterial,
  );
  pendulumBase.position.set(-3.25, -1.82, 0.16);
  pendulumBase.userData.role = 'pendulum-a-frame-base';
  pendulumFrame.add(pendulumBase);
  const pendulumBearing = cylinderAlongZ(
    0.16,
    0.48,
    darkMaterial,
    28,
  );
  pendulumBearing.position.copy(pendulumPivot).setZ(0.04);
  boreZCylinder(pendulumBearing, .16, .063, .42);
  pendulumBearing.userData.role = 'fixed-pendulum-pivot-bearing';
  pendulumFrame.add(pendulumBearing);

  const pendulum = new THREE.Group();
  pendulum.position.copy(pendulumPivot);
  pendulum.userData.axis = new THREE.Vector3(0, 0, 1);
  pendulum.userData.role =
    'prescribed-small-angle-pendulum-driving-lower-rod-joint';
  root.add(pendulum);
  const pendulumRod = new THREE.Mesh(
    new THREE.BoxGeometry(0.105, pendulumLength, 0.13),
    pendulumMaterial,
  );
  pendulumRod.position.y = -pendulumLength / 2;
  boreBoxAtLocalPoint(pendulumRod, [0,pendulumLength/2], .063);
  const pendulumHub=addZJournal(pendulum,.14,.063,.15,pendulumMaterial,new THREE.Vector3(),'bored-pendulum-pivot-hub');
  const pendulumShaft=cylinderAlongZ(.06,.72,darkMaterial);
  pendulumShaft.position.copy(pendulumPivot).setZ(.16);root.add(pendulumShaft);
  pendulumRod.userData.role = 'rigid-pendulum-rod';
  pendulum.add(pendulumRod);
  // Brown's bob is a spade: a straight-sided blade whose lower end closes in
  // two circular arcs to a blunt point, one flat extrusion on the rod's end.
  const spadeHalfWidth = 0.27;
  const spadeTop = 0.24;
  const spadeShoulder = -0.12;
  const spadeTip = -0.46;
  const spadeOutline = [[-spadeHalfWidth, spadeTop], [spadeHalfWidth, spadeTop]];
  {
    // Arc through the shoulder corner and the tip, tangent to the side there.
    const drop = spadeShoulder - spadeTip;
    const radius = (spadeHalfWidth ** 2 + drop ** 2) / (2 * spadeHalfWidth);
    const centerX = spadeHalfWidth - radius;
    const end = Math.asin(drop / radius);
    for (let i = 0; i <= 32; i += 1) {
      const a = -end * i / 32;
      spadeOutline.push([centerX + radius * Math.cos(a), spadeShoulder + radius * Math.sin(a)]);
    }
    for (let i = 32; i >= 0; i -= 1) {
      const a = -end * i / 32;
      spadeOutline.push([-(centerX + radius * Math.cos(a)), spadeShoulder + radius * Math.sin(a)]);
    }
  }
  const pendulumBob = new THREE.Mesh(
    plate(poly(spadeOutline), -0.12, 0.12),
    pendulumMaterial,
  );
  pendulumBob.position.y = -pendulumLength;
  pendulumBob.userData.role = 'spade-shaped-source-style-pendulum-bob';
  pendulum.add(pendulumBob);
  const rodJointPin = cylinderAlongZ(0.11, 0.64, darkMaterial, 24);
  rodJointPin.position.y = -rodAttachmentRadius;
  rodJointPin.userData.role = 'pendulum-lower-driving-pin';
  pendulum.add(rodJointPin);
  const pendulumIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.58, 0.15),
    whiteMaterial,
  );
  pendulumIndex.position.y = -0.45;
  pendulumIndex.userData.role = 'white-pendulum-angle-index';
  pendulum.add(pendulumIndex);

  const carriage = new THREE.Group();
  carriage.userData.role =
    'vertically-fed-u-shaped-horizontal-saw-guide-carriage';
  root.add(carriage);
  const carriageTop = new THREE.Mesh(
    new THREE.BoxGeometry(3.54, 0.13, 0.24),
    carriageMaterial,
  );
  // Lowered 0.175 so the fully raised carriage stays clear under the fixed
  // top beam.
  carriageTop.position.set(1.35, 1.115, 0.08);
  carriageTop.userData.role = 'moving-carriage-top-crossbar';
  carriage.add(carriageTop);
  const carriageSides = [];
  for (const x of [-0.42, 3.12]) {
    const side = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 1.345, 0.24),
      carriageMaterial,
    );
    side.position.set(x, 0.4425, 0.08);
    side.userData.role = 'moving-carriage-vertical-guide-side';
    carriageSides.push(side);
    carriage.add(side);
  }
  const carriageGuide = new THREE.Group();
  carriageGuide.position.set(1.35, 0, 0.08);
  carriageGuide.userData.role = 'moving-horizontal-line-constraining-saw-pin';
  for(const y of [-.1475,.1475]){
    const rail=new THREE.Mesh(new THREE.BoxGeometry(3.54,.045,.12),carriageMaterial);
    rail.position.y=y;carriageGuide.add(rail);
  }
  carriage.add(carriageGuide);
  const carriageAnchors = [];
  for (const x of [-0.42, 3.12]) {
    const anchor = cylinderAlongZ(0.085, 0.30, darkMaterial, 22);
    anchor.position.set(x, carriageAnchorLocalY, 0.34);
    anchor.userData.role = 'moving-carriage-rope-anchor';
    carriageAnchors.push(anchor);
    carriage.add(anchor);
  }

  const connectingRod = makeBoredPlanarLink({length:connectingRodLength,width:.085,eyeRadius:.16,boreRadius:.123,depth:.10},ropeMaterial);
  connectingRod.userData.role =
    'constant-length-rod-from-pendulum-pin-to-horizontal-saw-slider';
  root.add(connectingRod);
  const sawPinMarker = cylinderAlongZ(0.12, 0.66, darkMaterial, 24);
  sawPinMarker.geometry.translate(0,-.08,0);
  sawPinMarker.userData.role = 'horizontal-saw-slider-pin';
  root.add(sawPinMarker);

  const saw = new THREE.Group();
  saw.userData.role =
    'bow-saw-translating-horizontally-with-fed-guide';
  root.add(saw);
  // Brown's bow saw is one symmetric frame: two waisted end standards whose
  // tops scroll outward, a stretcher across the middle (on the slider pin's
  // line) and the toothed blade strained across the bottom. The frame is one
  // extrusion; the blade and its 27 crosscut teeth are another.
  // Narrow enough that the outward scrolls clear the counterweights.
  const sawSpan = 2.58;
  const sawMid = sawSpan / 2;
  const standardBottomY = -0.60;
  // Low enough that the scrolls pass under the carriage's rope anchors.
  const standardTopY = 0.36;
  const standardWaist = 0.12;
  const standardHalfWidth = 0.065;
  const standardRing = (side) => {
    // Circular-arc centreline bowing inward, offset each side by the half width.
    const chord = standardTopY - standardBottomY;
    const radius = (chord * chord / 4 + standardWaist * standardWaist) / (2 * standardWaist);
    const midY = (standardTopY + standardBottomY) / 2;
    const baseX = side < 0 ? 0 : sawSpan;
    const inward = side < 0 ? 1 : -1;
    const centerX = baseX + inward * (standardWaist - radius);
    const half = Math.asin(chord / 2 / radius);
    const outer = [];
    const inner = [];
    for (let i = 0; i <= 48; i += 1) {
      const a = -half + 2 * half * i / 48;
      const y = midY + radius * Math.sin(a);
      const dx = inward * radius * Math.cos(a);
      outer.push([centerX + dx * (radius - standardHalfWidth) / radius, y]);
      inner.push([centerX + dx * (radius + standardHalfWidth) / radius, y]);
    }
    return poly([...outer, ...inner.reverse()]);
  };
  // Each standard's top curls outward and over: an arc of constant width
  // tangent to the standard's end, finished with a round end.
  const scroll = (side) => {
    const radius = 0.08;
    const baseX = side < 0 ? 0 : sawSpan;
    const cx = baseX + side * radius;
    const sweep = THREE.MathUtils.degToRad(200);
    const start = side < 0 ? 0 : Math.PI;
    const dir = side < 0 ? 1 : -1;
    const outer = [];
    const inner = [];
    for (let i = 0; i <= 64; i += 1) {
      const a = start + dir * sweep * i / 64;
      outer.push([cx + (radius + standardHalfWidth) * Math.cos(a), standardTopY + (radius + standardHalfWidth) * Math.sin(a)]);
      inner.push([cx + (radius - standardHalfWidth) * Math.cos(a), standardTopY + (radius - standardHalfWidth) * Math.sin(a)]);
    }
    const endAngle = start + dir * sweep;
    return polygonClipping.union(
      poly([...outer, ...inner.reverse()]),
      poly(circle([cx + radius * Math.cos(endAngle), standardTopY + radius * Math.sin(endAngle)], standardHalfWidth, 48)),
    );
  };
  const sawPinBore = 0.123;
  const frameRegion = polygonClipping.difference(
    polygonClipping.union(
      standardRing(-1),
      standardRing(1),
      poly([[0.05, -0.045], [sawSpan - 0.05, -0.045], [sawSpan - 0.05, 0.045], [0.05, 0.045]]),
      scroll(-1),
      scroll(1),
      poly(circle([0, 0], 0.18, 96)),
    ),
    poly(circle([0, 0], sawPinBore, 96)),
  );
  const sawFrame = new THREE.Mesh(plate(frameRegion, -0.05, 0.05), sawMaterial);
  sawFrame.userData.role = 'symmetric-bow-saw-frame-with-scrolled-standards-and-stretcher';
  saw.add(sawFrame);
  const sawTeethCount = 27;
  const toothPitch = 0.0925;
  const firstToothX = 0.09 - toothPitch / 2;
  const bladeTop = -0.49;
  const bladeBottom = -0.59;
  const toothTip = -0.705;
  const bladeOutline = [[-0.01, bladeTop], [sawSpan + 0.01, bladeTop], [sawSpan + 0.01, bladeBottom]];
  for (let index = sawTeethCount - 1; index >= 0; index -= 1) {
    const x0 = firstToothX + index * toothPitch;
    bladeOutline.push([x0 + toothPitch, bladeBottom], [x0 + toothPitch / 2, toothTip], [x0, bladeBottom]);
  }
  bladeOutline.push([-0.01, bladeBottom]);
  const sawBlade = new THREE.Mesh(plate(poly(bladeOutline), -0.03, 0.03), darkMaterial);
  sawBlade.userData.role = 'horizontal-crosscut-saw-blade';
  sawBlade.userData.teeth = sawTeethCount;
  saw.add(sawBlade);

  const pulleyRoots = [];
  const ropes = [];
  const counterweights = [];
  for (let index = 0; index < 2; index += 1) {
    const pulley = finiteSawSheave(carriageMaterial);
    const shaft=cylinderAlongZ(.035,.70,darkMaterial);shaft.position.copy(pulleyCenters[index]).setZ(.12);root.add(shaft);
    pulley.userData.shaft=shaft;
    const bracket=makeBoredPlanarLink({length:.19,width:.13,eyeRadius:.085,boreRadius:.038,depth:.12},frameMaterial);
    bracket.position.copy(pulleyCenters[index]).setZ(0);bracket.rotation.z=Math.PI/2;
    bracket.userData.role='bored-sheave-support-tab';fixedFrame.add(bracket);pulley.userData.bracket=bracket;
    pulley.position.copy(pulleyCenters[index]);
    pulley.userData.role =
      'fixed-axis-counterweight-rope-pulley';
    pulleyRoots.push(pulley);
    root.add(pulley);

    const rope = makeLaidRopeMesh(
      counterweightRopePath({
        center: pulleyCenters[index],
        radius: pulleyRadius,
        innerX: index === 0
          ? pulleyCenters[index].x + pulleyRadius
          : pulleyCenters[index].x - pulleyRadius,
        outerX: index === 0
          ? pulleyCenters[index].x - pulleyRadius
          : pulleyCenters[index].x + pulleyRadius,
        tieY: pulleyY - 1,
        weightY: pulleyY - 1,
      }),
      ropeMaterial,
      { radius: ROPE_RADIUS },
    );
    rope.userData.side = index === 0 ? 'left' : 'right';
    rope.userData.role =
      'continuous-laid-counterweight-rope-over-pulley';
    ropes.push(rope);
    root.add(rope);

    const counterweight = new THREE.Mesh(
      // 0.30 deep so the connecting rod's plane (z 0.50..0.60) passes clear.
      new THREE.BoxGeometry(0.34, 0.50, 0.30),
      carriageMaterial,
    );
    counterweight.position.x = index === 0
      ? pulleyCenters[index].x - pulleyRadius
      : pulleyCenters[index].x + pulleyRadius;
    counterweight.position.z = 0.34;
    counterweight.userData.side = index === 0 ? 'left' : 'right';
    counterweight.userData.role =
      'one-of-two-carriage-balancing-counterweights';
    counterweights.push(counterweight);
    root.add(counterweight);
  }

  const log = new THREE.Group();
  log.position.copy(logCenter);
  log.userData.fixed = true;
  log.userData.role = 'fixed-lying-tree-log-beneath-saw';
  root.add(log);
  const bark = cylinderAlongZ(logRadius, logLength, woodMaterial, 48);
  // The saw has cut a kerf across the log down to the lowest reach of its
  // teeth (0.28 above the log axis), so the blade runs in its own cut.
  {
    // The bow saw runs in the plane z = 0.34 (blade and set teeth span
    // 0.293..0.394).
    // log-local z of the saw plane (world z = 0.34).
    const kerfCenterZ = 0.34 - logCenter.z;
    const kerfHalfWidth = 0.10;
    const kerfFloorY = 0.28;
    const ends = [
      [-logLength / 2, kerfCenterZ - kerfHalfWidth],
      [kerfCenterZ + kerfHalfWidth, logLength / 2],
    ].map(([from, to]) => new THREE.CylinderGeometry(logRadius, logRadius, to - from, 48)
      .applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2))
      .translate(0, 0, (from + to) / 2));
    const floorShape = new THREE.Shape();
    const floorAngle = Math.asin(kerfFloorY / logRadius);
    floorShape.absarc(0, 0, logRadius, floorAngle, Math.PI - floorAngle, true);
    floorShape.closePath();
    const floor = new THREE.ExtrudeGeometry(floorShape, {
      bevelEnabled: false,
      curveSegments: 48,
      depth: 2 * kerfHalfWidth,
    }).translate(0, 0, kerfCenterZ - kerfHalfWidth);
    const merged = mergeGeometries(
      [...ends, floor].map((geometry) => (geometry.index ? geometry.toNonIndexed() : geometry)),
    );
    merged.computeVertexNormals();
    bark.geometry.dispose();
    bark.geometry = merged;
    bark.rotation.set(0, 0, 0);
    bark.userData.kerf = { centerZ: kerfCenterZ, halfWidth: kerfHalfWidth, floorY: kerfFloorY };
  }
  bark.userData.role = 'lying-tree-bark-cylinder';
  log.add(bark);
  const cutFace = new THREE.Mesh(
    new THREE.CircleGeometry(logRadius * 0.94, 48),
    cutWoodMaterial,
  );
  cutFace.position.z = logLength / 2 + 0.006;
  cutFace.userData.role = 'visible-tree-end-grain';
  log.add(cutFace);
  // The far end is sawn too: the same plain end grain.
  const farCutFace = cutFace.clone();
  farCutFace.position.z = -logLength / 2 - 0.006;
  farCutFace.rotation.y = Math.PI;
  farCutFace.userData.role = 'far-tree-end-grain';
  log.add(farCutFace);
  // The log lies on two plain sleepers bedded on a ground plank, so it is
  // carried rather than hanging below the frame's feet.
  const logSupports = [];
  {
    const plankTop = logCenter.y - logRadius - 0.02;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, logLength + 0.2), frameMaterial);
    plank.position.set(logCenter.x, plankTop - 0.035, logCenter.z);
    plank.userData.role = 'ground-plank-under-log';
    root.add(plank);
    logSupports.push(plank);
    for (const dz of [-0.62, 0.62]) {
      // A block hollowed to the log's round (4 mm clear), so it cradles the
      // log without cutting it: a rectangle less the log's circle.
      const half = 0.62, rise = 0.28, centerY = logRadius + 0.02;
      const section = polygonClipping.difference(
        poly([[-half, 0], [half, 0], [half, rise], [-half, rise]]),
        poly(circle([0, centerY], logRadius + 0.004, 96)));
      const chock = new THREE.Mesh(plate(section, 0, 0.2), frameMaterial);
      chock.position.set(logCenter.x, plankTop, logCenter.z + dz - 0.1);
      chock.userData.role = 'sleeper-cradling-log';
      root.add(chock);
      logSupports.push(chock);
    }
  }

  const groundRails = [];
  for (const z of [-0.80, 0.80]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(8.68, 0.14, 0.15),
      frameMaterial,
    );
    rail.position.set(-0.25, -1.92, z);
    rail.userData.role = 'common-fixed-foundation-rail';
    groundRails.push(rail);
    root.add(rail);
  }

  const update = (time) => {
    const state = stateAtTime(time);
    pendulum.rotation.z = state.pendulumAngle;
    carriage.position.y = state.guideY;
    saw.position.copy(state.sawPin);
    sawPinMarker.position.copy(state.sawPin);
    connectingRod.userData.setEndpoints(state.rodJoint.clone().setZ(.55),state.sawPin.clone().setZ(.55));
    for (let index = 0; index < 2; index += 1) {
      const pulleyCenter = pulleyCenters[index];
      const innerX = index === 0
        ? pulleyCenter.x + pulleyRadius
        : pulleyCenter.x - pulleyRadius;
      const outerX = index === 0
        ? pulleyCenter.x - pulleyRadius
        : pulleyCenter.x + pulleyRadius;
      ropes[index].userData.setCurve(counterweightRopePath({
        center: pulleyCenter,
        radius: pulleyRadius,
        innerX,
        outerX,
        // The rope is tied on top of the anchor stud, not run to its axis.
        tieY: state.anchorY + 0.083,
        weightY: state.counterweightRopeTopY,
      }), 0);
      ropes[index].geometry.userData.deforming = true;
      counterweights[index].position.y = state.counterweightY;
      setSpin(pulleyRoots[index], state.pulleyAngles[index]);
    }
    root.userData.currentState = state;
    root.userData.constraintResiduals = {
      connectingRodLength: state.rodJoint.distanceTo(state.sawPin)
        - connectingRodLength,
      leftRopeLength: state.ropeLengths[0]
        - root.userData.transmission.constantRopeLength,
      rightRopeLength: state.ropeLengths[1]
        - root.userData.transmission.constantRopeLength,
      sawGuide: state.sawPin.y - state.guideY,
    };
  };

  const initialState = stateAtTime(0);
  root.userData = {
    archetype: movement.archetype,
    blocks: {
      bark,
      carriage,
      carriageAnchors,
      carriageGuide,
      carriageSides,
      carriageTop,
      connectingRod,
      counterweights,
      cutFace,
      fixedFrame,
      frameFeet,
      framePosts,
      groundRails,
      log,
      pendulum,
      pendulumBase,
      pendulumBearing,
      pendulumHub,
      pendulumShaft,
      pendulumBob,
      pendulumFrame,
      pendulumIndex,
      pendulumRod,
      pendulumSupports,
      pendulumFeet,
      pulleyRoots,
      rodJointPin,
      ropes,
      saw,
      sawBlade,
      sawFrame,
      sawPinMarker,
      topBeam,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 2,
      inputs: [
        'small-angle pendulum oscillation driving the horizontal saw stroke',
        'slow reversible vertical carriage feed for the closed demonstration',
      ],
      note:
        'the pendulum angle and slow feed phase are prescribed; the rigid connecting rod determines saw position, and each constant-length rope determines its counterweight and pulley rotation',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'sinusoidal small-angle pendulum motion at the source-observed swing amplitude',
        'rigid massless pendulum-to-saw connecting rod',
        'frictionless horizontal saw slider carried by a slowly fed U-frame',
        'inextensible ropes without slip on two equal fixed pulleys',
        'periodic down-and-up feed used to close the exhibition loop',
      ],
      sourceSpecifiesPendulumPeriodRodLengthFeedRateOrMasses: false,
      treatment:
        'Brown specifies only that pendulum motion operates a saw cutting a lying tree; the official animation establishes the pendulum pin, horizontal rigid-rod slider, fed U-frame, paired pulleys, ropes, and counterweights, while dimensions, period, feed law, and masses remain engineered',
    },
    fidelity: 'authored',
    geometry: {
      carriageAnchorLocalY,
      connectingRodLength,
      counterweightMeanY,
      counterweightRopeTopOffset,
      feedAmplitude,
      feedAngularFrequency,
      feedMeanY,
      logCenter,
      logLength,
      logRadius,
      officialHalfSwingVector,
      pendulumAmplitude,
      pendulumAngularFrequency,
      pendulumCyclesPerDemonstration,
      pendulumLength,
      pendulumPeriod,
      pendulumPivot,
      pulleyCenters,
      pulleyRadius,
      pulleyStartAngles,
      pulleyY,
      rodAttachmentRadius,
      sawPinZ,
    },
    mechanism:
      'one-swinging-pendulum-lower-pin-drives-one-constant-length-connecting-rod-to-a-horizontal-bow-saw-slider-while-one-counterweighted-u-carriage-feeds-the-saw-through-a-lying-tree',
    officialDescription: movement.description,
    sourceAnimation: {
      available: true,
      officialCanvasModelPresent: true,
      sourcePrescribedTiming: false,
      sourceShowsThreePendulumOscillationsDuringOneDownwardFeedPass: true,
    },
    sourceReference: {
      brownPlate378: {
        frameTopLeft: new THREE.Vector2(165, 222),
        frameTopRight: new THREE.Vector2(484, 224),
        imageHeight: 525,
        imageWidth: 525,
        leftPulleyCenter: new THREE.Vector2(181, 275),
        logCenter: new THREE.Vector2(326, 432),
        measurementUncertaintyPixels: 9,
        pendulumBobCenter: new THREE.Vector2(90, 374),
        pendulumPivot: new THREE.Vector2(86, 146),
        rightPulleyCenter: new THREE.Vector2(478, 279),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'a pendulum supplies the motion',
          'the driven tool is a saw',
          'the illustrated operation is cutting a lying tree',
        ],
        officialAnimationEvidence:
          'the animation distinguishes a red pendulum and bow saw, a constant-length green link from the pendulum lower pin to the saw left pin, a blue U-shaped vertical-feed carriage, and two green ropes passing over fixed side pulleys to blue counterweights',
        reconstructionDisclosure:
          'the 7.19-degree half swing follows the official animation endpoint vectors; all physical scale, 2.4-second pendulum period, rigid-rod length, six-stroke smooth closed feed cycle, colors, and masses are independently engineered because Brown gives no dimensions or timing',
      },
      officialPage: 'https://507movements.com/mm_378.html',
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      demonstrationPeriod,
      note:
        'six pendulum and saw cycles occur during one smooth feed-down/feed-return loop; three cutting strokes occur during the downward half, matching the official animation count without retaining its end reset',
    },
    transmission: {
      constantRopeLength: initialState.ropeLengths[0],
      feedCounterweightLaw:
        'each counterweight rises by exactly the distance its carriage anchor descends, preserving the two straight lengths plus the fixed semicircular wrap',
      pendulumSliderLaw:
        'the saw pin is the right-hand intersection of the horizontal carriage guide and a circle whose center is the pendulum lower pin and whose radius is the rigid connecting-rod length',
      pulleyNoSlipLaw:
        'the equal pulleys rotate oppositely by carriage displacement divided by pulley radius, so the inner rope tangent speed equals the carriage feed speed',
      pendulumJointHorizontalSweep:
        2 * rodAttachmentRadius * Math.sin(pendulumAmplitude),
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.70, -2.04, -2.10),
    new THREE.Vector3(4.10, 2.55, 1.65),
  );
  root.userData.groundFloorY = -2.00;
  finishSpringFamily(root, 14.4);
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(3.8, 2.8, 10.2),
    root,
    update,
  };
}

export function createAuthoredPendulumSawMovement(movement) {
  if (movement.id !== 378) return null;
  return pendulumTreeSaw(movement);
}
