import * as THREE from 'three';
import { ropeDrumSpokeShape } from './rope-drum-spoke.js';
import { LAID_ROPE, LaidRopeGeometry, replaceWithLaidRope } from './laid-rope.js';
import { PALETTE, matte } from './primitives.js';
import polygonClipping from 'polygon-clipping';

// Movement 134 (pass 97): Brown's drum is a cage. Two spoked end wheels are
// joined by eight beams parallel to the axis, and the rope is wound once round
// the beams, so it lies on an octagon of straight chords (the eight hatched
// strips of the plate), not on a cylinder. Uniform rotation of the cage
// therefore draws the rope in and pays it out at a rate that pulses eight
// times a turn, as the caption's "uniform circular motion into rectilinear"
// holds only on average.
//
// Construction (one world unit is 100 engraving pixels):
// - Rear end wheel: the four traced spokes, the hub and a flange ring from
//   Brown's inner circle (r 151 px) to his outer circle (r 181 px); the outer
//   circle of the plate is this flange's rim, seen round the rope.
// - Front end wheel: the same spokes and hub with a narrow rim whose inner edge
//   is Brown's inner circle; it stops below the rope, which Brown draws in
//   full on the front face.
// - Eight beams, 18 px wide as drawn, standing radially on the rims (Brown's
//   eight radial blocks are their ends) with round noses the rope bends over.
// - The rope: one laid rope from a far guide on the left, once round the eight
//   beam noses on an octagonal helix, and away to a far guide on the right.
//   Each span runs from its guide (beyond the crop, on Brown's ground line) to
//   its tangent beam, so it tilts slightly as the beams pass; the rope never
//   slips on the beams, so the lay is carried round with the cage and flows
//   through the spans at the octagon's pulsing rate.
export function octagonalRopeCageDrive() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceScale = 0.01;
  const sourceRasterDrumCenter = new THREE.Vector2(253, 231);
  const sourceRasterDrumOuterRadius = 181;
  const sourceRasterRimInnerRadius = 151;
  const sourceRasterRopeCenterY = 404;
  const sourceRasterRopeLeftX = 20;
  const sourceRasterRopeRightX = 486;
  const sourceRasterHubOuterRadius = 43;
  const sourceRasterShaftHoleRadius = 25;
  const sourceRasterBeamWidth = 18;
  const beamCount = 8;
  const spokeCount = 4;
  const beamPitch = fullTurn / beamCount;

  const flangeOuterRadius = sourceRasterDrumOuterRadius * sourceScale;
  const rimInnerRadius = sourceRasterRimInnerRadius * sourceScale;
  const frontRimOuterRadius = rimInnerRadius + 0.035;
  const hubOuterRadius = sourceRasterHubOuterRadius * sourceScale;
  const shaftRadius = sourceRasterShaftHoleRadius * sourceScale;
  const beamHalfWidth = sourceRasterBeamWidth * sourceScale / 2;
  const ropeRadius = 0.05;
  const ropeBeamGap = 0.002;
  // The rope's centre passes over a beam at Brown's ground-line radius.
  const ropeVertexRadius = (sourceRasterRopeCenterY - sourceRasterDrumCenter.y) * sourceScale;
  const bendRadius = beamHalfWidth + ropeRadius + ropeBeamGap;
  const beamNoseCenterRadius = ropeVertexRadius - bendRadius;
  const beamFootRadius = rimInnerRadius + 0.01;
  const beamTopRadius = beamNoseCenterRadius + beamHalfWidth;
  const drumWidth = 0.5;
  const ringDepth = 0.07;
  const axialLead = 0.14;
  const leftCropX = (sourceRasterRopeLeftX - sourceRasterDrumCenter.x) * sourceScale;
  const rightCropX = (sourceRasterRopeRightX - sourceRasterDrumCenter.x) * sourceScale;
  const guideRun = 1.0;
  const leftGuide = new THREE.Vector3(leftCropX - guideRun, -ropeVertexRadius, -axialLead / 2);
  const rightGuide = new THREE.Vector3(rightCropX + guideRun, -ropeVertexRadius, axialLead / 2);
  const drumAngularSpeed = 0.72;
  const drumRotationPeriod = fullTurn / drumAngularSpeed;
  const arcStep = THREE.MathUtils.degToRad(3);

  const driverMaterial = matte(PALETTE.driver, { metalness: 0.14, roughness: 0.59 });
  const beamMaterial = matte(PALETTE.frame, { metalness: 0.14, roughness: 0.62 });
  const inkMaterial = matte(PALETTE.ink, { metalness: 0.23, roughness: 0.49 });
  const frameMaterial = matte(PALETTE.frame, { metalness: 0.14, roughness: 0.69 });
  const ropeMaterial = matte(PALETTE.rope, { roughness: 0.78 });

  // Extrusions keep their exact outline and depth; the small bevel is taken
  // from inside both.
  const extrude = (shape, depth, bevel = 0.004, z = 0) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: bevel > 0, bevelSegments: 2, bevelSize: bevel, bevelOffset: -bevel,
      bevelThickness: bevel, curveSegments: 64, depth: depth - 2 * bevel, steps: 1,
    });
    geometry.translate(0, 0, z - depth / 2 + bevel);
    geometry.computeVertexNormals();
    return geometry;
  };
  const annulus = (inner, outer) => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, 0, fullTurn, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, inner, 0, fullTurn, true);
    shape.holes.push(hole);
    return shape;
  };

  const drum = new THREE.Group();
  const drumRotor = new THREE.Group();
  drum.add(drumRotor);
  drum.userData.axis = new THREE.Vector3(0, 0, 1);
  drum.userData.role = 'single-fixed-axis-rope-driving-drum';
  drum.userData.rotor = drumRotor;

  const frontZ = drumWidth / 2 + ringDepth / 2;
  const rearZ = -frontZ;
  const rearFlange = new THREE.Mesh(extrude(annulus(rimInnerRadius, flangeOuterRadius), ringDepth, 0.004, rearZ), driverMaterial);
  rearFlange.userData.role = 'rear-flange-of-rope-cage';
  const frontRim = new THREE.Mesh(extrude(annulus(rimInnerRadius, frontRimOuterRadius), ringDepth, 0.004, frontZ), driverMaterial);
  frontRim.userData.role = 'front-rim-of-rope-cage';

  // Both end wheels carry the four traced spokes, set just inside their rim's
  // faces so no faces coincide.
  // The traced spoke runs out to r 1.60; it is trimmed to end inside the
  // narrow front rim so no corner stands past it.
  const spokeShape = (() => {
    const traced = ropeDrumSpokeShape().getPoints(48).map((p) => [p.x, p.y]);
    const trim = frontRimOuterRadius - 0.01;
    const disc = Array.from({ length: 256 }, (_, i) => [trim * Math.cos(fullTurn * i / 256), trim * Math.sin(fullTurn * i / 256)]);
    const [[ring]] = polygonClipping.intersection([traced], [disc]);
    return new THREE.Shape(ring.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y)));
  })();
  const spokes = [];
  for (const [end, z] of [['front', frontZ], ['rear', rearZ]]) {
    const spokeGeometry = extrude(spokeShape, ringDepth - 0.01, 0.005, z);
    for (let index = 0; index < spokeCount; index += 1) {
      const spoke = new THREE.Mesh(index ? spokeGeometry.clone() : spokeGeometry, driverMaterial);
      spoke.rotation.z = index * Math.PI / 2;
      spoke.userData.index = index;
      spoke.userData.end = end;
      spoke.userData.role = `one-of-four-curved-${end}-spokes`;
      spokes.push(spoke);
    }
  }

  // One hub through both end wheels, standing proud of the front rim.
  const hubFrontZ = frontZ + ringDepth / 2 + 0.04;
  const hubRearZ = rearZ - ringDepth / 2;
  const hubGeometry = new THREE.ExtrudeGeometry(annulus(shaftRadius + 0.001, hubOuterRadius), {
    bevelEnabled: true, bevelSegments: 4, bevelSize: 0.025, bevelOffset: -0.025,
    bevelThickness: 0.025, curveSegments: 48, depth: hubFrontZ - hubRearZ - 0.05, steps: 1,
  });
  hubGeometry.translate(0, 0, hubRearZ + 0.025);
  const hub = new THREE.Mesh(hubGeometry, driverMaterial);
  hub.userData.role = 'bored-hub-rigid-with-rope-cage';

  const inputShaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftRadius, shaftRadius, 1.18, 38), inkMaterial);
  inputShaft.rotation.x = Math.PI / 2;
  inputShaft.position.z = -0.10;
  inputShaft.userData.axis = new THREE.Vector3(0, 0, 1);
  inputShaft.userData.role = 'input-shaft-fast-to-rope-cage';

  // Eight beams: flat sides from the rim, a semicircular nose the rope bends
  // over. Each runs from inside the rear flange to just proud of the front rim.
  const beamShape = new THREE.Shape();
  beamShape.moveTo(beamFootRadius, -beamHalfWidth);
  beamShape.lineTo(beamNoseCenterRadius, -beamHalfWidth);
  beamShape.absarc(beamNoseCenterRadius, 0, beamHalfWidth, -Math.PI / 2, Math.PI / 2, false);
  beamShape.lineTo(beamFootRadius, beamHalfWidth);
  beamShape.closePath();
  const beamRearZ = rearZ + ringDepth / 2 - 0.012;
  const beamFrontZ = frontZ + ringDepth / 2 + 0.012;
  const beamGeometry = extrude(beamShape, beamFrontZ - beamRearZ, 0.006, (beamFrontZ + beamRearZ) / 2);
  const beams = Array.from({ length: beamCount }, (_, index) => {
    const beam = new THREE.Mesh(index ? beamGeometry.clone() : beamGeometry, beamMaterial);
    beam.rotation.z = -Math.PI / 2 + index * beamPitch;
    beam.userData.index = index;
    beam.userData.role = 'one-of-eight-axial-beams-of-rope-cage';
    return beam;
  });
  drumRotor.add(rearFlange, frontRim, ...spokes, hub, inputShaft, ...beams);

  // Rear pedestal (removed in the source presentation; kept for rotated views
  // of the offline catalog as before).
  const rearFrameZ = -0.52;
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.92, 0.38), frameMaterial);
  pedestal.position.set(0, -1.24, rearFrameZ);
  pedestal.userData.role = 'rear-fixed-pedestal-supporting-drum-axis';
  const pedestalFoot = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.16, 0.68), frameMaterial);
  pedestalFoot.position.set(0, -2.18, rearFrameZ);
  pedestalFoot.userData.role = 'fixed-foot-of-drum-bearing-pedestal';
  const rearBearing = new THREE.Mesh(extrude(annulus(shaftRadius + 0.003, hubOuterRadius * 0.7 + 0.075), 0.30, 0, -0.51), frameMaterial);
  rearBearing.userData.axis = new THREE.Vector3(0, 0, 1);
  rearBearing.userData.role = 'fixed-bearing-behind-drum-hub';

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(5.35, 4.85, 0.01),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, opacity: 0, transparent: true }),
  );
  cameraEnvelope.position.set(0, -0.14, rearFrameZ - 0.25);
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.noShadow = true;
  cameraEnvelope.userData.role = 'invisible-complete-rope-drum-envelope';
  root.add(cameraEnvelope, pedestal, pedestalFoot, rearBearing, drum);
  root.updateMatrixWorld(true);
  const cameraFitBounds = new THREE.Box3().setFromObject(root, true);

  // ---- Rope path over the beam noses -------------------------------------
  // Beam u (any integer; beam u mod 8 of the cage) has its nose centre at
  // angle -pi/2 + u pi/4 + drumAngle. The rope runs round the noses
  // counter-clockwise, the direction the cage turns, so its material order
  // is the order of u.
  const noseAngle = (u, drumAngle) => -Math.PI / 2 + u * beamPitch + drumAngle;
  const noseCenter = (u, drumAngle) => {
    const a = noseAngle(u, drumAngle);
    return new THREE.Vector2(beamNoseCenterRadius * Math.cos(a), beamNoseCenterRadius * Math.sin(a));
  };
  // Tangent from a guide into a nose (rope arriving, cage on its left) and
  // from a nose out to a guide (rope leaving).
  const tangentIn = (guide, center) => {
    const d = center.clone().sub(guide);
    const length = d.length();
    const direction = Math.atan2(d.y, d.x) - Math.asin(bendRadius / length);
    const run = Math.sqrt(length * length - bendRadius * bendRadius);
    const point = new THREE.Vector2(guide.x + run * Math.cos(direction), guide.y + run * Math.sin(direction));
    return { direction, point, angle: Math.atan2(point.y - center.y, point.x - center.x) };
  };
  const tangentOut = (guide, center) => {
    const d = new THREE.Vector2(guide.x, guide.y).sub(center);
    const length = d.length();
    const direction = Math.atan2(d.y, d.x) + Math.asin(bendRadius / length);
    const run = Math.sqrt(length * length - bendRadius * bendRadius);
    const point = new THREE.Vector2(guide.x - run * Math.cos(direction), guide.y - run * Math.sin(direction));
    return { direction, point, angle: Math.atan2(point.y - center.y, point.x - center.x) };
  };
  // Axial position: a stationary helix, one lead per turn, by the rope's
  // unwrapped polar angle from the bottom of the cage.
  const zAtPolar = (psi) => -axialLead / 2 + axialLead * psi / fullTurn;
  const polarFromBottom = (x, y) => Math.atan2(x, -y);

  const ropePathAt = (drumAngle) => {
    const u0 = -Math.round(drumAngle / beamPitch);
    const g2L = new THREE.Vector2(leftGuide.x, leftGuide.y);
    const g2R = new THREE.Vector2(rightGuide.x, rightGuide.y);
    let entry = null;
    for (let u = u0 - 2; u <= u0 + 2; u += 1) {
      const t = tangentIn(g2L, noseCenter(u, drumAngle));
      if (!entry || t.direction < entry.direction) entry = { ...t, u };
    }
    let exit = null;
    for (let u = entry.u + 6; u <= entry.u + 10; u += 1) {
      const t = tangentOut(g2R, noseCenter(u, drumAngle));
      if (!exit || t.direction > exit.direction) exit = { ...t, u };
    }
    // 2D points round the cage with the arc/chord structure recorded.
    const flat = [];
    const addArc = (u, from, to) => {
      const c = noseCenter(u, drumAngle);
      const steps = Math.max(1, Math.ceil((to - from) / arcStep));
      for (let k = 0; k <= steps; k += 1) {
        const a = from + (to - from) * k / steps;
        flat.push(new THREE.Vector2(c.x + bendRadius * Math.cos(a), c.y + bendRadius * Math.sin(a)));
      }
    };
    const unwrap = (angle, reference) => angle + fullTurn * Math.round((reference - angle) / fullTurn);
    const departures = [];
    for (let u = entry.u; u <= exit.u; u += 1) {
      const a = noseAngle(u, drumAngle);
      const from = u === entry.u ? unwrap(entry.angle, a) : a - beamPitch / 2;
      const to = u === exit.u ? unwrap(exit.angle, a) : a + beamPitch / 2;
      addArc(u, from, Math.max(from, to));
      if (u !== exit.u) departures.push({ u, index: flat.length - 1 });
    }
    // Lift to 3D on the stationary helix.
    let psi = polarFromBottom(flat[0].x, flat[0].y);
    const points = [leftGuide.clone()];
    flat.forEach((p, i) => {
      if (i) {
        const next = polarFromBottom(p.x, p.y);
        psi += THREE.MathUtils.euclideanModulo(next - psi + Math.PI, fullTurn) - Math.PI;
      }
      points.push(new THREE.Vector3(p.x, p.y, zAtPolar(psi)));
    });
    points.push(rightGuide.clone());
    const cumulative = [0];
    for (let i = 1; i < points.length; i += 1) cumulative.push(cumulative[i - 1] + points[i].distanceTo(points[i - 1]));
    // Material: the rope never slips on the noses, so the departure point from
    // nose u carries material coordinate u * e, e being one nose arc plus one
    // chord (the same for every fully wrapped nose).
    const [d0, d1] = departures;
    const pitchLength = cumulative[d1.index + 1] - cumulative[d0.index + 1];
    const startMaterial = d0.u * pitchLength - cumulative[d0.index + 1];
    return { points, cumulative, entry, exit, pitchLength, startMaterial, length: cumulative.at(-1) };
  };
  const polylineCurve = (points) => {
    const path = new THREE.CurvePath();
    for (let i = 1; i < points.length; i += 1) path.add(new THREE.LineCurve3(points[i - 1], points[i]));
    return path;
  };

  const initialPath = ropePathAt(0);
  // One turn carries eight pitch lengths through the guides; the lay is set
  // so that is a whole number of lays, so the loop has no seam.
  const nominalLay = LAID_ROPE.layPerDiameter * 2 * ropeRadius;
  const turnLength = beamCount * initialPath.pitchLength;
  const lay = turnLength / Math.round(turnLength / nominalLay);
  const ropeMesh = new THREE.Mesh(
    new LaidRopeGeometry(polylineCurve(initialPath.points), 256, ropeRadius, 8, false, { travel: -initialPath.startMaterial, lay }),
    ropeMaterial,
  );
  ropeMesh.userData.role = 'one-rope-wound-once-round-the-eight-beam-cage';
  const rope = new THREE.Group();
  rope.add(ropeMesh);
  rope.userData.mesh = ropeMesh;
  rope.userData.mechanismString = true;
  rope.userData.physicalCable = true;
  rope.userData.closed = false;
  rope.userData.ropeCount = 1;
  rope.userData.wrapTurns = 1;
  rope.userData.role = 'one-continuous-rope-wound-once-round-the-cage';
  root.add(rope);

  const stateAtDrumAngle = (drumAngle, time = null) => {
    const path = ropePathAt(drumAngle);
    // Rope drawn in through the left guide and paid out through the right
    // (material coordinates fall at both guides as the rope runs right).
    const leftFeed = -path.startMaterial;
    const rightFeed = -(path.startMaterial + path.length);
    return {
      time,
      drumAngle,
      angularSpeed: drumAngularSpeed,
      path,
      leftFeed,
      rightFeed,
      entryBeam: THREE.MathUtils.euclideanModulo(path.entry.u, beamCount),
      exitBeam: THREE.MathUtils.euclideanModulo(path.exit.u, beamCount),
      leftSpanAngle: path.entry.direction,
      rightSpanAngle: path.exit.direction,
      ropeLength: path.length,
      meanTravelPerDrumRadian: path.pitchLength / beamPitch,
      rotationPhase: THREE.MathUtils.euclideanModulo(drumAngle / fullTurn, 1),
      stage: 'cage-turns-counterclockwise-rope-travels-right',
    };
  };
  const stateAtTime = (time) => stateAtDrumAngle(drumAngularSpeed * time, time);
  // Rope speed through each guide, by central difference.
  const feedSpeedsAtTime = (time, h = 1e-4) => {
    const a = stateAtTime(time - h), b = stateAtTime(time + h);
    return { left: (b.leftFeed - a.leftFeed) / (2 * h), right: (b.rightFeed - a.rightFeed) / (2 * h) };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    drumRotor.rotation.set(0, 0, state.drumAngle);
    drum.userData.angularSpeed = state.angularSpeed;
    replaceWithLaidRope(ropeMesh, polylineCurve(state.path.points), {
      radius: ropeRadius, tubularSegments: 256, travel: -state.path.startMaterial, lay,
    });
    rope.userData.materialTravel = state.leftFeed;
    root.userData.kinematics = state;
  };

  Object.assign(root.userData, {
    mechanism: 'single-rope-one-turn-octagonal-cage-linear-drive',
    cameraDistanceScale: 1.06,
    cameraFitBounds,
    blocks: { cameraEnvelope, drum, drumRotor, rearFlange, frontRim, spokes, hub, inputShaft, beams, pedestal, pedestalFoot, rearBearing, rope, ropeMesh },
    geometry: {
      sourceScale, sourceRasterDrumCenter, sourceRasterDrumOuterRadius, sourceRasterRimInnerRadius,
      sourceRasterRopeCenterY, sourceRasterRopeLeftX, sourceRasterRopeRightX, sourceRasterHubOuterRadius,
      sourceRasterShaftHoleRadius, sourceRasterBeamWidth, beamCount, spokeCount, beamPitch,
      flangeOuterRadius, rimInnerRadius, frontRimOuterRadius, hubOuterRadius, spokeTrimRadius: frontRimOuterRadius - 0.01, shaftRadius, beamHalfWidth,
      beamFootRadius, beamNoseCenterRadius, beamTopRadius, beamRearZ, beamFrontZ, bendRadius, ropeRadius,
      ropeBeamGap, ropeVertexRadius, drumWidth, ringDepth, frontZ, rearZ, axialLead, leftCropX, rightCropX,
      leftGuide, rightGuide, drumAngularSpeed, drumRotationPeriod, rearFrameZ, lay, turnLength,
    },
    ropePathAt,
    stateAtDrumAngle,
    stateAtTime,
    feedSpeedsAtTime,
    materialsIgnoreSceneFog: true,
    hideGround: true,
    supportsRestart: true,
    minimumDisplayCycleSeconds: 4,
    animationTiming: { authoredCyclePeriod: drumRotationPeriod },
    tractionAssumption: 'The cage turns uniformly and the rope does not slip on the beam noses; the rope therefore moves at the octagon\'s pulsing rate. Its axial walk across the noses (a stationary helix) is kinematic; tension and friction are not solved.',
  });
  update(0);
  root.traverse((object) => {
    if (object.material) object.material.fog = false;
  });
  return { root, update, reset: () => update(0), cameraDirection: new THREE.Vector3(0.4, 0.2, 13.5) };
}
