import * as THREE from 'three';
import { poly, circle, plate, ring, polygonClipping } from './finite-plate-geometry.js';

// Preserve the source profiles and their working corners. The generic outward
// bevel previously crossed the wheel even though the nominal polygons cleared.
export function finishSingleTooth241(model) {
  const { root } = model, { blocks: b, geometry: g } = root.userData;
  const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
  replace(b.driverTooth, plate(poly(g.driverToothOutlinePoints.map(p => p.toArray())), -0.09, 0.09));
  const click = polygonClipping.difference(poly(g.holdingClickOutlinePoints.map(p => p.toArray())), poly(circle([0, 0], 0.09, 96)));
  replace(b.holdingClickBody, plate(click, -0.09, 0.09));
  replace(b.driverDisk, ring(0.098, g.driverBodyRadius, -0.12, 0.12, 96));
  b.driverDisk.rotation.set(0, 0, 0);
  b.driverDisk.position.z = 0; // Recess the disk so the source curl stays visible.
  const driverHub = b.driver.userData.rotor.children.find(o => o.isMesh && o.geometry.type === 'CylinderGeometry');
  replace(driverHub, ring(0.098, 0.16, -0.32, 0.32, 96));
  driverHub.rotation.set(0, 0, 0);
  driverHub.userData.role = 'bored-single-tooth-driver-hub';
  replace(b.outputWheel.userData.hub, ring(0.122, 0.39, -0.213, 0.213, 96));
  b.outputWheel.userData.hub.material = b.outputWheelBody.material;
  const outputIndex = b.outputWheelIndicator;
  replace(outputIndex, new THREE.BoxGeometry(0.045, 0.72, 0.012));
  outputIndex.position.set(0, 1.08, 0.156);
  replace(b.driverIndicator, new THREE.BoxGeometry(0.3, 0.045, 0.012));
  b.driverIndicator.position.set(0.41, 0, 0.126);
  const clickWitness = b.holdingClick.children.find(o => o.userData.role === 'holding-click-rotation-witness');
  clickWitness.visible = false;
  root.userData.workingParts241 = { driverHub };
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = 8;
  root.userData.reconstructionNote = 'The finite single tooth indexes the wheel in the opposite direction; the upper click holds each dwell. Entry and release use ideal rigid impacts. Gravity seating, hinge forces and loaded holding capacity are prescribed, not dynamically solved.';
  root.userData.sourceAnimation.reason = 'The official page marks the animation unavailable and contains no inline animation registration.';
  root.userData.contactQualification241 = {
    workingGeometry: 'Original curved tooth and click outlines extruded without outward-expanding bevels; working corners retained.',
    forceLimit: 'Continuous position; ideal output velocity changes at engagement boundaries and singular click speed near final seating.',
  };
  root.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    for (const material of [].concat(o.material ?? [])) material.fog = false;
  });
  const update = model.update;
  model.update = time => {
    update(time);
    b.driverContactMarker.visible = false;
    b.holdingContactMarker.visible = false;
  };
  model.cameraDirection = new THREE.Vector3(0.5, 0.5, 14);
  root.userData.cameraFitBounds = new THREE.Box3(new THREE.Vector3(-3.4, -2.45, -0.6), new THREE.Vector3(2.45, 2.5, 0.7));
  model.update(0);
  return model;
}
