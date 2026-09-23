import * as THREE from 'three';
import sourcePresentation from '../data/source-presentation.js';

// Presents a constructed model the way Brown's engraving does: an optional
// whole-model rotation into the plate's upright orientation, an optional
// mirror to the plate's handedness, the plate's view
// direction for the initial camera, and removal of parts the plate does not
// show. Removal detaches the parts, so camera fitting and measured display
// bounds ignore them, and disposes only resources no remaining part uses.
export function applySourcePresentation(model, movement) {
  const entry = sourcePresentation[movement.id];
  if (!entry) return model;
  const root = model.root;
  if (entry.rotate) {
    root.quaternion.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...entry.rotate)));
    root.updateMatrixWorld(true);
  }
  if (entry.scale) {
    // A mirror (one negative component) reproduces the plate's handedness;
    // three.js flips face winding for negative-determinant transforms.
    root.scale.multiply(new THREE.Vector3(...entry.scale));
    root.updateMatrixWorld(true);
  }
  if (entry.camera) model.cameraDirection = new THREE.Vector3(...entry.camera);
  const removedRoles = [];
  if (entry.remove?.length) {
    const patterns = entry.remove.map((pattern) => new RegExp(`^(?:${pattern})$`));
    const doomed = [];
    root.traverse((object) => {
      if (object === root || doomed.some((parent) => isAncestor(parent, object))) return;
      const role = presentationRole(object);
      if (role && patterns.some((pattern) => pattern.test(role))) doomed.push(object);
    });
    const kept = resourcesOf(root, new Set(doomed));
    for (const object of doomed) {
      removedRoles.push(presentationRole(object));
      object.removeFromParent();
      const own = resourcesOf(object);
      for (const resource of own) if (!kept.has(resource)) resource.dispose();
    }
  }
  root.userData.sourcePresentation = {
    camera: entry.camera ?? null,
    note: entry.note,
    removedRoles,
    rotate: entry.rotate ?? null,
    scale: entry.scale ?? null,
  };
  return model;
}

// Older factories name parts without assigning a role.
function presentationRole(object) {
  const role = object.userData.role;
  if (typeof role === 'string' && role) return role;
  return object.name || null;
}

function isAncestor(parent, object) {
  for (let node = object.parent; node; node = node.parent) if (node === parent) return true;
  return false;
}

function resourcesOf(root, excluded = new Set()) {
  const resources = new Set();
  const visit = (object) => {
    if (excluded.has(object)) return;
    if (object.geometry) resources.add(object.geometry);
    for (const material of [object.material].flat()) if (material) resources.add(material);
    for (const child of object.children) visit(child);
  };
  visit(root);
  return resources;
}
