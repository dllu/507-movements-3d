import * as THREE from 'three';
import { makeBandEpicyclicGearTrain } from './band-epicyclic-gears.js';
import { bandProfileExtrusion } from './band-epicyclic-geometry.js';
import { turnedClutchGeometry } from './clutch-section-geometry.js';
import { PALETTE, matte, markShadows, beltCurveOpen, beltCurveCrossed } from './primitives.js';
import { LaidRopeGeometry } from './laid-rope.js';

// Static clamped-span deflection under a concentrated crossover contact.
// The two cords support one another; pulley grooves constrain end slopes.
class ContactSpan extends THREE.Curve {
  constructor(start, end, height, contact) { super(); this.start = start; this.end = end; this.height = height; this.contact = contact; }
  displacement(u, derivative = false) {
    const a = this.contact, b = 1 - a;
    const green = (x, load, other, sign) => derivative
      ? sign * other ** 2 * (6 * load * x - 3 * (1 + 2 * load) * x ** 2) / 6
      : other ** 2 * x ** 2 * (3 * load - (1 + 2 * load) * x) / 6;
    return this.height * (u <= a ? green(u, a, b, 1) : green(1 - u, b, a, -1)) / (a ** 3 * b ** 3 / 3);
  }
  getPoint(u, target = new THREE.Vector3()) { return target.copy(this.start).lerp(this.end, u).add(new THREE.Vector3(0, 0, this.displacement(u))); }
  getTangent(u, target = new THREE.Vector3()) { return target.subVectors(this.end, this.start).add(new THREE.Vector3(0, 0, this.displacement(u, true))).normalize(); }
}

export function makeBandEpicyclic(options = {}) {
  const model = makeBandEpicyclicGearTrain({ ...options, ringBlankOuter: 2.10 });
  const { root } = model, { parts, blocks, geometry: p } = root.userData, gearUpdate = model.update;
  Object.assign(p, { ropeRadius: 0.04, grooveClearance: 0.0002, outerBeltZ: 0, innerBeltZ: -0.30, crossingHeight: options.crossingHeight ?? 0.0402 });
  const add = (name, mesh, parent = root) => { mesh.name = name; parts[name] = mesh; parent.add(mesh); return mesh; };
  const turned = (profile, boreRadius, color) => new THREE.Mesh(turnedClutchGeometry(profile, { boreRadius, angularSegments: 512, color }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1 }));
  const cylinder = (radius, low, high, color) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, high - low, 512), matte(color));
    mesh.rotation.x = Math.PI / 2; mesh.position.z = (low + high) / 2; return mesh;
  };
  const annulus = (radius, bore, low, high, color) => turned([[low, bore], [low, radius], [high, radius], [high, bore]], bore, color);
  const grooveProfile = (low, high, bore, rimRadius, grooves) => {
    const profile = [[low, bore], [low, rimRadius]], r = p.ropeRadius + p.grooveClearance;
    for (const [z, radius] of grooves) {
      profile.push([z - 0.052, rimRadius]);
      for (let i = 0; i <= 128; i += 1) {
        const angle = -Math.PI / 2 + Math.PI * i / 128;
        profile.push([z + r * Math.sin(angle), radius - r * Math.cos(angle)]);
      }
      profile.push([z + 0.052, rimRadius]);
    }
    profile.push([high, rimRadius], [high, bore]); return profile;
  };
  add('ringPulley', turned(grooveProfile(-0.11, 0.11, 2.10, p.ringOuter, [[0, p.ringDrumPitch]]), 2.10, PALETTE.driven), parts.ring);
  add('sunDrum', turned(grooveProfile(-0.39, -0.21, 0.32, 1.215, [[p.innerBeltZ, p.sunDrumPitch]]), 0.32, 0xb74834), parts.sun);
  add('sunHub', annulus(0.61, 0.32, 0.105, 0.15, PALETTE.driver), parts.sun);
  add('sunShaft', cylinder(0.32, -1.14, 0.215, PALETTE.muted), parts.sun);
  // The carrier runs between the rear sun drum and the gear plane. Keeping
  // its axle forward of the inner band clears that band throughout an orbit.
  add('carrierSleeve', annulus(0.40, 0.325, -0.205, -0.12, PALETTE.frame), blocks.carrier);
  // One flat link, free on the sun shaft: a hub arc round the sleeve and a
  // boss arc round the planet axle joined by straight tangents. The boss
  // stands clear of the sun drum's rim, so from behind the pinion reads as
  // carried round the common centre by this arm.
  const hubR = 0.46, bossR = 0.30, d = p.orbitRadius, tangent = Math.acos((hubR - bossR) / d);
  const armShape = new THREE.Shape();
  armShape.absarc(0, 0, hubR, tangent, 2 * Math.PI - tangent, false);
  armShape.absarc(d, 0, bossR, -tangent, tangent, false);
  armShape.closePath();
  const armBore = new THREE.Path(); armBore.absarc(d, 0, 0.13, 0, 2 * Math.PI, true); armShape.holes.push(armBore);
  const hubBore = new THREE.Path(); hubBore.absarc(0, 0, 0.36, 0, 2 * Math.PI, true); armShape.holes.push(hubBore);
  add('carrierArm', new THREE.Mesh(bandProfileExtrusion(armShape, -0.195, -0.145), matte(PALETTE.frame)), blocks.carrier);
  const axle = add('planetAxle', cylinder(0.13, -0.205, 0.20, PALETTE.muted), blocks.carrier); axle.position.x = p.orbitRadius;
  const rear = add('planetCollar', annulus(0.22, 0.13, -0.15, -0.12, PALETTE.muted), blocks.carrier); rear.position.x = p.orbitRadius;
  const cap = add('planetCap', cylinder(0.265, 0.14, 0.18, PALETTE.muted), blocks.carrier); cap.position.x = p.orbitRadius;
  const driver = new THREE.Group(); driver.position.set(...p.driverCenter, 0); root.add(driver); blocks.driver = driver;
  add('driverPulley', turned(grooveProfile(-0.41, 0.11, 0.21875, 0.845,
    [[p.innerBeltZ, p.driverPitch], [p.outerBeltZ, p.driverPitch]]), 0.21875, PALETTE.brass), driver);
  add('driverShaft', cylinder(0.21875, -1.0, 0.24, PALETTE.muted), driver);
  add('driverHub', annulus(0.39, 0.21875, 0.09, 0.17, PALETTE.brass), driver);
  const crankShape = new THREE.Shape(), point = (x, y) => [(x - 718) / 160, (241 - y) / 160];
  crankShape.moveTo(...point(681, 194)); crankShape.lineTo(...point(587, 151));
  crankShape.bezierCurveTo(...point(580, 130), ...point(567, 115), ...point(550, 115));
  crankShape.bezierCurveTo(...point(532, 115), ...point(518, 130), ...point(518, 149));
  crankShape.bezierCurveTo(...point(518, 168), ...point(532, 181), ...point(550, 181));
  crankShape.bezierCurveTo(...point(565, 181), ...point(576, 174), ...point(582, 170));
  crankShape.lineTo(...point(657, 210));
  crankShape.bezierCurveTo(...point(651, 227), ...point(650, 245), ...point(659, 264));
  crankShape.bezierCurveTo(...point(670, 291), ...point(695, 306), ...point(720, 306));
  crankShape.bezierCurveTo(...point(754, 306), ...point(783, 280), ...point(783, 244));
  crankShape.bezierCurveTo(...point(783, 208), ...point(756, 179), ...point(721, 179));
  crankShape.bezierCurveTo(...point(705, 179), ...point(691, 184), ...point(681, 194)); crankShape.closePath();
  for (const [x, y, r] of [[0, 0, 0.21875], [...point(552, 149), 0.09375]]) {
    const hole = new THREE.Path(); hole.absarc(x, y, r, 0, 2 * Math.PI, true); crankShape.holes.push(hole);
  }
  add('crankPlate', new THREE.Mesh(bandProfileExtrusion(crankShape, 0.16, 0.22), matte(PALETTE.brass)), driver);
  const first = new THREE.Vector2(...p.driverCenter), second = new THREE.Vector2();
  const outerCurve = beltCurveOpen(first, second, p.driverPitch, p.ringDrumPitch, p.outerBeltZ);
  const rawCrossed = beltCurveCrossed(first, second, p.driverPitch, p.sunDrumPitch, p.innerBeltZ), innerCurve = new THREE.CurvePath();
  const fraction = p.driverPitch / (p.driverPitch + p.sunDrumPitch);
  innerCurve.add(new ContactSpan(rawCrossed.curves[0].getPoint(0), rawCrossed.curves[0].getPoint(1), p.crossingHeight, fraction));
  innerCurve.add(rawCrossed.curves[1]);
  innerCurve.add(new ContactSpan(rawCrossed.curves[2].getPoint(0), rawCrossed.curves[2].getPoint(1), -p.crossingHeight, 1 - fraction));
  innerCurve.add(rawCrossed.curves[3]);
  const ropes = [];
  for (const [name, curve] of [['outerBelt', outerCurve], ['innerBelt', innerCurve]]) {
    // Brown hatches both bands as twisted cords: the shared three-strand laid
    // rope, whose lay moves with the band material.
    const geometry = new LaidRopeGeometry(curve, 2048, p.ropeRadius, 8, true), length = curve.getLength();
    const mesh = add(name, new THREE.Mesh(geometry, matte(PALETTE.belt, { roughness: 0.76 })));
    mesh.userData = { curve, length, radius: p.ropeRadius, crossSection: 'laid-rope', isYarn: true };
    const updateDistance = distance => geometry.setTravel(distance);
    mesh.userData.updateDistance = updateDistance; ropes.push(updateDistance);
  }
  model.update = time => { gearUpdate(time); driver.rotation.z = p.inputSpeed * time; ropes.forEach(update => update(-p.inputSpeed * p.driverPitch * time)); };
  root.userData.idealConstraints = 'Fixed sun and driver bearing axes, an independent coaxial carrier sleeve, and an external annular bearing for the ring. Bearing mounts outside this schematic are idealized.';
  root.userData.fullCameraDirection = new THREE.Vector3(4, 3, 8); root.userData.shadowCameraHalfExtent = 4; root.userData.shadowBias = -0.00003;
  Object.assign(root.userData, { fidelity: 'authored', mechanism: 'dual-band-opposed-sun-ring-epicyclic-train',
    reconstructionStatus: 'contact-verified-reconstruction', animationTiming: { authoredCyclePeriod: p.carrierPeriod } });
  model.update(0); markShadows(root); return model;
}
