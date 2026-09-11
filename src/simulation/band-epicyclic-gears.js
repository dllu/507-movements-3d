import * as THREE from 'three';
import { PALETTE, matte, markShadows } from './primitives.js';
import { bandInvoluteGear } from './band-epicyclic-geometry.js';

export function makeBandEpicyclicGearTrain({ baseFactor = 0.048, planetBaseHalf = 0.175,
  sunTip = 0.955, planetTip = 0.6125, ringTip = 1.84, orbitRadius = 1.40625, loadGap = 0.000025, ringBlankOuter = 2.22 } = {}) {
  const p = { sunTeeth: 18, planetTeeth: 10, ringTeeth: 34, baseFactor, planetBaseHalf,
    sunTip, planetTip, ringTip, orbitRadius, loadGap, flankAllowance: 0.00004, ringOuter: 2.22, ringRoot: 2.045,
    sunRoot: 0.78, planetRoot: 0.43, sourceScale: 160, sourceCenter: [721, 870], driverCenter: [-3 / 160, 629 / 160],
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
