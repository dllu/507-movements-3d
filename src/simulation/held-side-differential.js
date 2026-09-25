import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { heldSideDifferentialMotion } from './held-side-differential-motion.js';
import { turnedClutchGeometry } from './clutch-section-geometry.js';
import { bevelToothGeometry } from './bevel-geometry.js';
import { flatBeltGeometry } from './belt-geometry.js';
import { PALETTE, matte, markShadows, beltCurveOpen } from './primitives.js';

export function makeHeldSideDifferential() {
  const motion = heldSideDifferentialMotion(), p = motion.parameters, root = new THREE.Group();
  const driver = new THREE.Group(), output = new THREE.Group(), loose = new THREE.Group();
  const carrier = new THREE.Group(), brake = new THREE.Group(), planetAxis = new THREE.Group(), planet = new THREE.Group();
  root.add(driver, output, loose, carrier, brake); driver.position.y = p.driverHeight;
  planetAxis.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
  planetAxis.position.z = p.bevelCenterZ; planetAxis.add(planet); carrier.add(planetAxis);
  const parts = {}, families = {}, sectioned = [], sectionCaps = new THREE.Group();
  root.add(sectionCaps);
  const add = (name, mesh, parent, family) => { mesh.name = name; parts[name] = mesh; families[name] = family; parent.add(mesh); return mesh; };
  const turned = (profile, color, paintIndex = false) => {
    const mesh = new THREE.Mesh(turnedClutchGeometry(profile, { angularSegments: 512, color, paintIndex }),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68, metalness: 0.1 }));
    mesh.userData.profile = profile; return mesh;
  };
  const drum = (radius, bore, [low, high], color, paintIndex = false) => turned([[low, bore], [low, radius], [high, radius], [high, bore]], color, paintIndex);
  add('driverShaft', drum(p.driverShaftRadius, 0, p.driverShaftSpan, PALETTE.muted), driver, 'driver');
  add('driverDrum', drum(p.pulleyRadius, p.driverShaftRadius, p.driverSpan, PALETTE.driver), driver, 'driver');
  add('outputShaft', drum(p.outputShaftRadius, 0, p.outputShaftSpan, PALETTE.muted), output, 'output');
  add('loosePulley', drum(p.pulleyRadius, p.looseBore,
    [p.laneZs[0] - p.pulleyWidths[0] / 2, p.laneZs[0] + p.pulleyWidths[0] / 2], PALETTE.muted), loose, 'loose');
  const directLow = -p.pulleyWidths[1] / 2, directHigh = p.pulleyWidths[1] / 2;
  sectioned.push(add('directPulley', turned([[directLow, p.outputShaftRadius], [directLow, p.pulleyRadius],
    [directHigh, p.pulleyRadius], [directHigh, p.rimInnerRadius], [p.directWebEnd, p.rimInnerRadius],
    [p.directWebEnd, p.outputShaftRadius]], PALETTE.driven), output, 'output'));
  const carrierLow = p.laneZs[2] - p.pulleyWidths[2] / 2, carrierHigh = p.laneZs[2] + p.pulleyWidths[2] / 2;
  sectioned.push(add('carrierPulley', turned([[carrierLow, p.rimInnerRadius], [carrierLow, p.pulleyRadius],
    [carrierHigh, p.pulleyRadius], [carrierHigh, p.carrierBore], [p.carrierWebStart, p.carrierBore],
    [p.carrierWebStart, p.rimInnerRadius]], PALETTE.brass), carrier, 'carrier'));
  const makeGear = (name, parent, family, axis, teeth, innerDistance, outerDistance, pitchConeAngle, bore, hubEnd, color) => {
    const group = new THREE.Group(); group.position.z = p.bevelCenterZ;
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis); parent.add(group);
    const tooth = bevelToothGeometry({ teeth, innerDistance, outerDistance, pitchConeAngle,
      toothHeight: p.toothHeight, toothThicknessFactor: p.toothThicknessFactor, pressureAngle: p.pressureAngle,
      flankSegments: p.flankSegments, tipSegments: p.tipSegments });
    const { root: r, innerScale: s } = tooth.userData;
    const profile = [[r.z * s, bore], [r.z * s, r.radius * s], [r.z, r.radius],
      [r.z, name === 'planet' ? 0.13 : p.brakeHubRadius], [hubEnd, name === 'planet' ? 0.13 : p.brakeHubRadius], [hubEnd, bore]];
    const body = add(`${name}Body`, turned(profile, color), group, family);
    const copies = Array.from({ length: teeth }, (_, i) => tooth.clone().rotateZ(i * 2 * Math.PI / teeth));
    const mesh = add(`${name}Teeth`, new THREE.Mesh(mergeGeometries(copies), matte(color, { roughness: 0.62, metalness: 0.13 })), group, family);
    copies.forEach(g => g.dispose()); tooth.dispose();
    group.userData = { body, mesh, teeth, innerDistance, outerDistance, pitchConeAngle, profile };
    return group;
  };
  const outputGear = makeGear('outputGear', output, 'output', new THREE.Vector3(0, 0, -1), p.sideTeeth,
    p.sideInnerDistance, p.sideOuterDistance, p.sideConeAngle, p.outputShaftRadius, 0.845, PALETTE.driven);
  outputGear.rotateZ(Math.PI);
  const brakeGear = makeGear('brakeGear', brake, 'brake', new THREE.Vector3(0, 0, 1), p.sideTeeth,
    p.sideInnerDistance, p.sideOuterDistance, p.sideConeAngle, p.looseBore, 1.30, PALETTE.muted);
  const planetGear = makeGear('planet', planet, 'planet', new THREE.Vector3(0, 0, 1), p.planetTeeth,
    p.planetInnerDistance, p.planetOuterDistance, p.planetConeAngle, p.planetBore, p.planetHubEnd, PALETTE.accent);
  planetGear.position.z = 0;
  add('planetSpindle', drum(p.planetSpindleRadius, 0, p.planetSpindleSpan, PALETTE.muted), planetAxis, 'carrier');
  const planetToe = planetGear.userData.profile[0][0];
  add('innerSpindleCollar', drum(0.095, p.planetSpindleRadius, [planetToe - 0.026, planetToe - 0.006], PALETTE.brass), planetAxis, 'carrier');
  add('outerSpindleCollar', drum(0.095, p.planetSpindleRadius, [p.planetHubEnd + 0.006, p.planetHubEnd + 0.026], PALETTE.brass), planetAxis, 'carrier');
  add('brakeDrum', drum(p.brakeDrumRadius, p.brakeHubRadius, p.brakeDrumSpan, PALETTE.muted), brake, 'brake');
  const brakePitch = p.brakeDrumRadius + p.brakeBandThickness / 2 + p.brakeBandClearance;
  const brakeCurve = new THREE.CurvePath();
  brakeCurve.add(new THREE.LineCurve3(new THREE.Vector3(-brakePitch, -p.brakeTailLength, 0), new THREE.Vector3(-brakePitch, 0, 0)));
  const arc = new THREE.Curve(); arc.getPoint = (t, target = new THREE.Vector3()) => target.set(-brakePitch * Math.cos(Math.PI * t), brakePitch * Math.sin(Math.PI * t), 0);
  brakeCurve.add(arc);
  brakeCurve.add(new THREE.LineCurve3(new THREE.Vector3(brakePitch, 0, 0), new THREE.Vector3(brakePitch, -p.brakeTailLength, 0)));
  const curb = add('frictionBand', new THREE.Mesh(flatBeltGeometry(brakeCurve, { width: p.brakeBandWidth,
    thickness: p.brakeBandThickness, segments: 2048, closed: false }), matte(PALETTE.ink)), root, 'restraint');
  curb.position.z = p.brakeBandZ;
  const weight = add('brakeWeight', new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.23), matte(PALETTE.ink)), root, 'restraint');
  weight.position.set(-brakePitch, -p.brakeTailLength - 0.10, p.brakeBandZ);
  const curve = beltCurveOpen(new THREE.Vector2(0, p.driverHeight), new THREE.Vector2(), p.beltPitchRadius, p.beltPitchRadius, 0);
  const segments = 2048, geometry = flatBeltGeometry(curve, { width: p.beltWidth, thickness: p.beltThickness, segments });
  // Brown draws the band as a plain flat belt: the shared belt colour, no
  // travelling stitch marks.
  const paper = new THREE.Color(PALETTE.belt), beltColors = new Float32Array(geometry.attributes.position.count * 3);
  for (let j = 0; j < beltColors.length; j += 3) paper.toArray(beltColors, j);
  geometry.setAttribute('color', new THREE.BufferAttribute(beltColors, 3));
  const belt = add('belt', new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 })), root, 'belt');
  belt.userData = { curve, length: curve.getLength(), crossSection: 'rectangular', width: p.beltWidth, thickness: p.beltThickness, isYarn: true };
  const sectionPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  for (const [i, mesh] of sectioned.entries()) for (const sign of [-1, 1]) {
    const shape = new THREE.Shape(mesh.userData.profile.map(([z, r]) => new THREE.Vector2(z, sign * r)));
    const cap = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateY(-Math.PI / 2),
      matte(i === 0 ? 0x7bb0be : 0xd8bf75, { roughness: 0.8, side: THREE.DoubleSide }));
    cap.userData.nonPhysicalSection = true; sectionCaps.add(cap);
  }
  const setSectionView = enabled => {
    for (const mesh of sectioned) {
      mesh.material.clippingPlanes = enabled ? [sectionPlane] : [];
      mesh.material.clipShadows = true; mesh.material.needsUpdate = true;
    }
    sectionCaps.visible = enabled; root.userData.sectionView = enabled;
  };
  const update = time => {
    const state = motion.atTime(time);
    driver.rotation.z = state.driverAngle; output.rotation.z = state.outputAngle;
    loose.rotation.z = state.looseAngle; carrier.rotation.z = state.carrierAngle; brake.rotation.z = state.brakeAngle;
    planet.rotation.z = -Math.PI / p.planetTeeth + state.planetAngle; belt.position.z = state.beltZ;
    root.userData.kinematics = state;
  };
  root.userData = { geometry: p, parts, families, blocks: { driver, output, loose, carrier, brake, planet, planetAxis },
    gears: { outputGear, brakeGear, planetGear }, motion, sectioned, sectionCaps, setSectionView,
    sectionView: false, localClippingEnabled: true, hideGround: true, cameraFov: 7,
    fullCameraDirection: new THREE.Vector3(-8, 3, 6), shadowCameraHalfExtent: 5, shadowBias: -0.00003,
    fidelity: 'authored', mechanism: 'enclosed-held-side-bevel-differential', reconstructionStatus: 'contact-verified-reconstruction', animationTiming: { authoredCyclePeriod: p.cycleDuration },
    idealConstraints: 'Shaft bearings and axial retention are ideal constraints. The carrier runs on the held-side sleeve. The friction curb is held stationary with an ideal anchored tail and weight; transient brake slip, friction, elasticity and inertia are not solved. An operator stops the driver before traversing the band.' };
  // Brown draws the pulleys as a closed drum (bevels only dotted inside);
  // the cutaway is offered through the section-view control.
  update(0); markShadows(root); setSectionView(false);
  sectionCaps.traverse(mesh => { mesh.castShadow = false; });
  return { root, update, cameraDirection: new THREE.Vector3(-10, 0, 0) };
}
