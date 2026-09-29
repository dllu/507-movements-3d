import * as THREE from 'three';
import { PALETTE, matte, markShadows } from './primitives.js';
import { bandInvoluteGear } from './band-epicyclic-geometry.js';

// A standard 16/9/34 train (16 + 2 x 9 = 34) on Brown's orbit: one module and
// one 20-degree pressure angle at both meshes, so every tooth, the ring's
// included, keeps a broad flat top. The nine-tooth planet carries a +0.4
// profile shift (thicker teeth, no undercut); tips and roots are cut to keep
// 0.25-module clearance and the sun tip inside the planet's interference point.
export function makeBandEpicyclicGearTrain({ pressureAngle = Math.PI / 9, planetShift = 0.4,
  sunTip = 0.97, planetTip = 0.615, ringTip = 1.865, orbitRadius = 1.40625, loadGap = 0.000025, ringBlankOuter = 2.22 } = {}) {
  const teeth = { sunTeeth: 16, planetTeeth: 9, ringTeeth: 34 };
  const module = 2 * orbitRadius / (teeth.sunTeeth + teeth.planetTeeth), baseFactor = module / 2 * Math.cos(pressureAngle);
  const planetBaseHalf = (Math.PI / 2 + 2 * planetShift * Math.tan(pressureAngle)) / teeth.planetTeeth
    + Math.tan(pressureAngle) - pressureAngle;
  const p = { ...teeth, module, pressureAngle, planetShift, baseFactor, planetBaseHalf,
    sunTip, planetTip, ringTip, orbitRadius, loadGap, flankAllowance: 0.00004, ringOuter: 2.22, ringRoot: 2.05,
    sunRoot: 0.755, planetRoot: 0.41, sourceScale: 160, sourceCenter: [721, 870], driverCenter: [-3 / 160, 629 / 160],
    driverPitch: 0.82, sunDrumPitch: 1.2, ringDrumPitch: 2.2, inputSpeed: Math.PI, carrierPhase: Math.atan2(-225, 6) };
  const { sunTeeth: ns, planetTeeth: np, ringTeeth: nr } = p;
  p.sunBase = ns * baseFactor; p.planetBase = np * baseFactor; p.ringBase = nr * baseFactor;
  p.externalWorkingAngle = Math.acos((p.sunBase + p.planetBase) / orbitRadius);
  p.internalWorkingAngle = Math.acos((p.ringBase - p.planetBase) / orbitRadius);
  p.sunBaseHalf = (Math.PI + (ns + np) * (Math.tan(p.externalWorkingAngle) - p.externalWorkingAngle) - np * planetBaseHalf) / ns;
  p.ringBaseHalf = (Math.PI - (nr - np) * (Math.tan(p.internalWorkingAngle) - p.internalWorkingAngle) - np * planetBaseHalf) / nr;
  p.sunPhase = Math.PI / 2;
  p.planetPhase = ((np - 1) * Math.PI + (ns + np) * p.carrierPhase - ns * p.sunPhase) / np;
  p.ringPhase = (np * p.planetPhase + (nr - np) * p.carrierPhase - Math.PI) / nr;
  p.sunPhase += (2 * p.flankAllowance - loadGap) / p.sunBase;
  p.ringPhase += (2 * p.flankAllowance - loadGap) / p.ringBase;
  p.ringSpeed = p.inputSpeed * p.driverPitch / p.ringDrumPitch;
  p.sunSpeed = -p.inputSpeed * p.driverPitch / p.sunDrumPitch;
  p.carrierSpeed = (ns * p.sunSpeed + nr * p.ringSpeed) / (ns + nr);
  p.planetSpeed = p.carrierSpeed - ns / np * (p.sunSpeed - p.carrierSpeed);
  p.relativeToothPeriod = 2 * Math.PI / (np * Math.abs(p.planetSpeed - p.carrierSpeed));
  p.carrierPeriod = 2 * Math.PI / Math.abs(p.carrierSpeed);
  const root = new THREE.Group(), carrier = new THREE.Group(); root.add(carrier);
  const make = (teeth, baseRadius, baseHalfAngle, rootRadius, tipRadius, color, internal = false) => new THREE.Mesh(bandInvoluteGear({
    teeth, baseRadius, baseHalfAngle: baseHalfAngle - p.flankAllowance / baseRadius, rootRadius, tipRadius,
    outerRadius: internal ? ringBlankOuter : undefined, boreRadius: teeth === ns ? 0.32 : 0.131, internal }), matte(color));
  const sun = make(ns, p.sunBase, p.sunBaseHalf, p.sunRoot, sunTip, PALETTE.driver);
  const planet = make(np, p.planetBase, planetBaseHalf, p.planetRoot, planetTip, PALETTE.brass);
  const ring = make(nr, p.ringBase, p.ringBaseHalf, p.ringRoot, ringTip, PALETTE.driven, true);
  root.add(sun, ring); carrier.add(planet); planet.position.x = orbitRadius;
  for (const [name, mesh] of Object.entries({ sun, planet, ring })) mesh.name = name;
  const update = time => {
    sun.rotation.z = p.sunPhase + p.sunSpeed * time;
    ring.rotation.z = p.ringPhase + p.ringSpeed * time;
    carrier.rotation.z = p.carrierPhase + p.carrierSpeed * time;
    planet.rotation.z = p.planetPhase - p.carrierPhase + (p.planetSpeed - p.carrierSpeed) * time;
    root.userData.kinematics = { time, sunAngle: sun.rotation.z, ringAngle: ring.rotation.z,
      planetAngle: carrier.rotation.z + planet.rotation.z, carrierAngle: carrier.rotation.z };
  };
  root.userData = { geometry: p, parts: { sun, planet, ring }, blocks: { carrier }, hideGround: true, cameraFov: 17,
    reconstructionStatus: 'unvalidated-candidate', animationTiming: { authoredCyclePeriod: 2 } };
  update(0); markShadows(root); return { root, update, cameraDirection: new THREE.Vector3(0, 0, 10) };
}
