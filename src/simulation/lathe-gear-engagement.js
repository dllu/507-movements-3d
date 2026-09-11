import * as THREE from 'three';
import { roundedRackGear } from './coaxial-gear-geometry.js';
import { turnedClutchGeometry } from './clutch-section-geometry.js';
import { PALETTE, matte, markShadows } from './primitives.js';
import { latheLeverMotion } from './lathe-engagement-motion.js';

export function makeLatheGearEngagement(options = {}) {
  const motion = latheLeverMotion(options), p = motion.parameters;
  const root = new THREE.Group(), fixed = new THREE.Group(), output = new THREE.Group(), input = new THREE.Group(), lever = new THREE.Group();
  root.add(fixed, output, input, lever); input.position.set(p.pinionX, p.pinionHeight, 0); lever.position.x = -p.leverRadius;
  const sourceCamera = new THREE.Vector3(0.65, -0.1, 10), forward = sourceCamera.clone().normalize();
  const right = new THREE.Vector3(forward.z, 0, -forward.x).normalize(), up = forward.clone().cross(right).normalize();
  const sourcePoint = (x, y, z = 0.35) => {
    const wx = ((x - 420) / 190 - right.z * (z - 0.66)) / right.x;
    const wy = ((667 - y) / 190 - up.z * (z - 0.66) - up.x * wx) / up.y;
    return new THREE.Vector2(wx, wy);
  };
  const path = (commands, z, offset = new THREE.Vector2()) => {
    const shape = new THREE.Shape();
    for (const [method, ...coordinates] of commands) {
      const values = []; for (let i = 0; i < coordinates.length; i += 2) { const v = sourcePoint(coordinates[i], coordinates[i + 1], z).sub(offset); values.push(v.x, v.y); }
      shape[method](...values);
    }
    shape.closePath(); return shape;
  };
  const hole = (shape, x, y, radius) => { const h = new THREE.Path(); h.absarc(x, y, radius, 0, 2 * Math.PI, true); shape.holes.push(h); };
  const rectangle = (x0, y0, x1, y1) => new THREE.Shape([new THREE.Vector2(x0, y0), new THREE.Vector2(x1, y0), new THREE.Vector2(x1, y1), new THREE.Vector2(x0, y1)]);
  const extrusionGeometry = (shape, low, high, segments = 96) => {
    // Triangulate the coordinates actually sent to WebGL. Otherwise small
    // curved-edge cap triangles can collapse only after Float32 conversion.
    const clean = values => {
      const points = values.map(v => new THREE.Vector2(Math.fround(v.x), Math.fround(v.y)));
      if (points[0].equals(points.at(-1))) points.pop();
      for (let i = points.length - 1; i >= 0 && points.length > 3; i -= 1) {
        const a = points[(i + points.length - 1) % points.length], b = points[i], c = points[(i + 1) % points.length];
        if ((b.x - a.x) * (c.y - b.y) === (b.y - a.y) * (c.x - b.x)) points.splice(i, 1);
      }
      return points;
    };
    const extracted = shape.extractPoints(segments), outside = clean(extracted.shape);
    if (!THREE.ShapeUtils.isClockWise(outside)) outside.reverse();
    const polygon = new THREE.Shape(outside);
    for (const h of extracted.holes) {
      const points = clean(h); if (THREE.ShapeUtils.isClockWise(points)) points.reverse();
      polygon.holes.push(new THREE.Path(points));
    }
    return new THREE.ExtrudeGeometry(polygon, { depth: high - low, bevelEnabled: false }).translate(0, 0, low);
  };
  const extrude = (shape, low, high, color) => new THREE.Mesh(extrusionGeometry(shape, low, high), matte(color));
  const shaft = (radius, low, high, color = PALETTE.ink) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, high - low, 192), matte(color));
    mesh.rotation.x = Math.PI / 2; mesh.position.z = (low + high) / 2; return mesh;
  };
  const turned = (profile, boreRadius, color) => new THREE.Mesh(turnedClutchGeometry(profile, { boreRadius, angularSegments: 192, color }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.64, metalness: 0.14 }));

  const gear = (teeth, boreRadius, color) => {
    const generated = roundedRackGear({ teeth, module: p.module, depth: 0.24, boreRadius });
    const shape = new THREE.Shape(generated.userData.outline); hole(shape, 0, 0, boreRadius);
    const geometry = extrusionGeometry(shape, -0.12, 0.12, 64);
    geometry.userData = generated.userData; generated.dispose(); return new THREE.Mesh(geometry, matte(color));
  };
  const largeGear = gear(p.largeTeeth, 0.12, PALETTE.driven), pinion = gear(p.pinionTeeth, 0.08, PALETTE.driver);
  largeGear.position.z = pinion.position.z = -0.42; output.add(largeGear); input.add(pinion);
  const frontWeb = turned([[-0.31, 0.12], [-0.31, 1.795], [-0.285, 1.795], [-0.285, 0.12]], 0.12, PALETTE.driven);
  const outputShaft = shaft(0.12, -0.62, 0.66), inputShaft = shaft(0.08, -2.10, 0.66);
  output.add(frontWeb, outputShaft); input.add(inputShaft);
  const pulley = turned([[-1.58, 0.08], [-1.58, 2.285], [-1.565, 2.30], [-1.295, 2.30],
    [-1.28, 2.285], [-1.28, 1.835], [-1.265, 1.82], [-0.995, 1.82], [-0.98, 1.805],
    [-0.98, 1.435], [-0.965, 1.42], [-0.695, 1.42], [-0.68, 1.405], [-0.68, 0.08]], 0.08, PALETTE.brass);
  input.add(pulley);

  const frameShape = path([
    ['moveTo', 207, 556], ['lineTo', 1087, 564], ['lineTo', 1089, 850],
    ['bezierCurveTo', 1089, 965, 1107, 1055, 1139, 1103], ['lineTo', 575, 1103],
    ['bezierCurveTo', 636, 1080, 687, 1049, 677, 966], ['bezierCurveTo', 685, 889, 630, 832, 555, 805],
    ['bezierCurveTo', 468, 774, 393, 791, 324, 805], ['bezierCurveTo', 252, 820, 196, 781, 180, 738],
    ['bezierCurveTo', 120, 749, 111, 673, 127, 611], ['bezierCurveTo', 142, 574, 180, 556, 207, 556],
  ], 0.35);
  const sliderWindow = new THREE.Path();
  const x0 = -p.throwDistance - 0.239, x1 = 0.419, y0 = -0.199, y1 = 0.399;
  sliderWindow.moveTo(x0, y0); sliderWindow.lineTo(x0, y1); sliderWindow.lineTo(x1, y1); sliderWindow.lineTo(x1, y0); sliderWindow.closePath();
  frameShape.holes.push(sliderWindow); hole(frameShape, p.pinionX, p.pinionHeight, 0.081);
  const frame = extrude(frameShape, 0.12, 0.35, PALETTE.frame); fixed.add(frame);
  const sliderShape = rectangle(-0.235, -0.195, 0.415, 0.395); hole(sliderShape, 0, 0, 0.1208);
  const slider = extrude(sliderShape, 0.07, 0.37, PALETTE.muted); root.add(slider);
  const fixedCapShape = rectangle(p.pinionX - 0.36, p.pinionHeight - 0.30, p.pinionX + 0.36, p.pinionHeight + 0.30);
  hole(fixedCapShape, p.pinionX, p.pinionHeight, 0.081);
  const bearingCap = extrude(fixedCapShape, 0.35, 0.40, PALETTE.muted); fixed.add(bearingCap);
  const topLip = extrude(path([['moveTo', 708, 565], ['lineTo', 1087, 570], ['lineTo', 1087, 601], ['lineTo', 708, 600]], 0.43), 0.34, 0.43, PALETTE.frame); fixed.add(topLip);
  const foot = extrude(path([['moveTo', 575, 1103], ['lineTo', 1139, 1103], ['lineTo', 1152, 1128], ['lineTo', 1152, 1206], ['lineTo', 571, 1206], ['lineTo', 571, 1128]], 0.42), -2.02, 0.42, PALETTE.frame);
  const footBand = extrude(path([['moveTo', 572, 1130], ['lineTo', 1152, 1130], ['lineTo', 1152, 1154], ['lineTo', 915, 1154], ['lineTo', 913, 1183], ['lineTo', 773, 1183], ['lineTo', 773, 1154], ['lineTo', 572, 1154]], 0.46), 0.40, 0.46, PALETTE.muted);
  fixed.add(foot, footBand);
  const rearShape = rectangle(p.pinionX - 0.28, -2.40, p.pinionX + 0.28, p.pinionHeight + 0.28);
  hole(rearShape, p.pinionX, p.pinionHeight, 0.081);
  const rearSupport = extrude(rearShape, -2.02, -1.80, PALETTE.frame); fixed.add(rearSupport);

  const leverShape = path([
    ['moveTo', 230, 577], ['lineTo', 233, 155], ['bezierCurveTo', 233, 143, 217, 126, 222, 85],
    ['bezierCurveTo', 223, 62, 231, 42, 244, 39], ['bezierCurveTo', 256, 42, 269, 66, 269, 87],
    ['bezierCurveTo', 273, 119, 251, 147, 251, 159], ['lineTo', 254, 577],
    ['bezierCurveTo', 258, 623, 290, 654, 322, 660], ['bezierCurveTo', 352, 666, 376, 641, 399, 619],
    ['bezierCurveTo', 430, 589, 470, 606, 479, 640], ['bezierCurveTo', 495, 683, 453, 750, 401, 780],
    ['bezierCurveTo', 351, 812, 293, 828, 248, 809], ['bezierCurveTo', 202, 796, 184, 761, 183, 715],
    ['bezierCurveTo', 180, 676, 188, 640, 208, 618], ['bezierCurveTo', 224, 602, 229, 590, 230, 577],
  ], 0.60, new THREE.Vector2(-p.leverRadius, 0));
  hole(leverShape, 0, 0, 0.071);
  const camCenter = new THREE.Vector2(p.camEccentricX, p.camEccentricY), clearance = 0.00004, pinRadius = 0.12;
  const workingStart = new THREE.Vector2(p.leverRadius, 0), workingEnd = new THREE.Vector2(motion.follower(p.leverAngle) * Math.cos(p.leverAngle), -motion.follower(p.leverAngle) * Math.sin(p.leverAngle));
  // Slight overrun keeps the working follower on the circular side wall
  // while the operator starts/stops the lever, clear of the rounded ends.
  const camOverrunAngle = 0.02;
  const highAngle = workingStart.clone().sub(camCenter).angle() + camOverrunAngle, lowAngle = workingEnd.clone().sub(camCenter).angle() - camOverrunAngle;
  const startPoint = camCenter.clone().add(new THREE.Vector2(Math.cos(highAngle), Math.sin(highAngle)).multiplyScalar(p.camRadius));
  const endPoint = camCenter.clone().add(new THREE.Vector2(Math.cos(lowAngle), Math.sin(lowAngle)).multiplyScalar(p.camRadius));
  const radius = pinRadius + clearance, camHole = new THREE.Path();
  const points = [];
  const arc = (center, r, a, b, segments) => { for (let i = 0; i <= segments; i += 1) { const t = a + (b - a) * i / segments; const point = new THREE.Vector2(center.x + r * Math.cos(t), center.y + r * Math.sin(t)); if (!points.length || point.distanceTo(points.at(-1)) > 1e-9) points.push(point); } };
  arc(camCenter, p.camRadius + radius, lowAngle, highAngle, 256);
  arc(startPoint, radius, highAngle, highAngle + Math.PI, 128);
  arc(camCenter, p.camRadius - radius, highAngle, lowAngle, 256);
  arc(endPoint, radius, lowAngle + Math.PI, lowAngle + 2 * Math.PI, 128);
  if (points[0].distanceTo(points.at(-1)) < 1e-8) points.pop();
  points.reverse(); camHole.setFromPoints(points); camHole.closePath(); leverShape.holes.push(camHole);
  const leverPlate = extrude(leverShape, 0.49, 0.60, PALETTE.brass); lever.add(leverPlate);
  const pivotShaft = shaft(0.07, 0.18, 0.69), pivotCap = shaft(0.135, 0.63, 0.67, PALETTE.muted);
  pivotShaft.position.x = pivotCap.position.x = -p.leverRadius; fixed.add(pivotShaft, pivotCap);
  const parts = { largeGear, pinion, frontWeb, outputShaft, inputShaft, pulley, frame, slider, bearingCap,
    topLip, foot, footBand, rearSupport, leverPlate, pivotShaft, pivotCap };
  for (const [name, mesh] of Object.entries(parts)) mesh.name = name;
  input.userData.role = 'lathe-cone-pulley-and-pinion'; output.userData.role = 'sliding-lathe-speed-gear';
  lever.userData.role = 'eccentric-slot-operating-lever';
  const update = time => {
    const state = motion.atTime(time); output.position.x = state.outputX; slider.position.x = state.outputX;
    output.rotation.z = state.largeAngle; input.rotation.z = state.pinionAngle; lever.rotation.z = state.leverAngle;
    root.userData.kinematics = state;
  };
  root.userData = { fidelity: 'authored', mechanism: 'eccentric-slot-lever-sliding-lathe-speed-gear',
    geometry: { ...p, gearDepth: 0.24, gearZ: -0.42, pressureAngle: Math.PI / 9, camClearance: clearance, followerRadius: pinRadius, camOverrunAngle,
    sourceProjection: { camera: sourceCamera.toArray(), origin: [420, 667], pixelsPerUnit: 190, datumZ: 0.66 } },
    parts, blocks: { fixed, output, input, lever, slider }, motion, hideGround: true,
    reconstructionStatus: 'contact-verified-reconstruction', cameraFov: 17, fullCameraDirection: new THREE.Vector3(4, 3, 8),
    shadowCameraHalfExtent: 4, shadowBias: -0.00003,
    idealConstraints: 'Fixed parallel input bearings; a horizontal sliding output bearing; operator-controlled lever travel from 0 to 53 degrees. Shafts stop before shifting. Friction and load inertia are not simulated.',
    animationTiming: { authoredCyclePeriod: p.cycleDuration } };
  update(0); markShadows(root); return { root, update, cameraDirection: sourceCamera };
}
