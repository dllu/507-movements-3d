import * as THREE from 'three';
import sourcePresentation from '../data/source-presentation.js';
import rotationIndicators from '../data/rotation-indicators.js';
import { applyRotationIndicatorByRole } from './rotation-indicator.js';
import { creaseNormalsIn } from './crease-normals.js';

// Presents a constructed model the way Brown's engraving does: an optional
// whole-model rotation into the plate's upright orientation, an optional
// mirror to the plate's handedness, the plate's view
// direction for the initial camera, and removal of parts the plate does not
// show. Removal detaches the parts, so camera fitting and measured display
// bounds ignore them, and disposes only resources no remaining part uses.
export function applySourcePresentation(model, movement) {
  const entry = sourcePresentation[movement.id];
  // Brown draws no index marks on any pulley: the generic tread and face
  // marks of every makePulley sheave are hidden for all movements.
  hidePulleyIndexMarks(model.root);
  // Featureless turning parts carry the shared quadrant rotation cue.
  if (rotationIndicators[movement.id]) applyRotationIndicatorByRole(model.root, rotationIndicators[movement.id]);
  // Lathed parts and few-sided prisms authored directly with three's
  // generators would otherwise shade their flat faces and shoulders as domes
  // (see crease-normals.js).
  creaseNormalsIn(model.root);
  if (!entry) return model;
  const root = model.root;
  if (entry.hideWhiteMarks) hideWhiteMarks(root);
  if (entry.plainRims?.length) plainRims(root, entry.plainRims);
  root.updateMatrixWorld(true);
  const unpresentedWorld = root.matrixWorld.clone();
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
  // Authored fit bounds are world boxes of the unpresented model.
  const fitBounds = root.userData.cameraFitBounds;
  if (fitBounds?.isBox3 && (entry.rotate || entry.scale)) {
    fitBounds.applyMatrix4(root.matrixWorld.clone().multiply(unpresentedWorld.invert()));
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

const WHITE = new THREE.Color(0xfaf9f5);
const isWhite = (material) => Boolean(material?.color?.equals(WHITE));

function hidePulleyIndexMarks(root) {
  root.traverse((object) => {
    const marks = object.userData.faceIndicators;
    if (Array.isArray(marks)) for (const mark of marks) mark.visible = false;
    // The shared pulley and gear builders' white index blocks (tread and face
    // marks on a rotor, without a role) are hidden everywhere: Brown draws
    // none, and plain turning bodies carry the quadrant cue instead.
    const rotor = object.userData.rotor;
    if (!rotor?.isObject3D || (!Array.isArray(marks) && !object.userData.teeth)) return;
    for (const child of rotor.children) {
      if (child.isMesh && !child.userData.role && !child.userData.sourceDrawn
        && child.geometry?.type === 'BoxGeometry' && isWhite(child.material)) child.visible = false;
    }
  });
}

// White index stripes, chips and painted index teeth: white single-material
// meshes are hidden and white faces of multi-material meshes take the
// part's own material. Parts Brown draws white carry userData.sourceDrawn.
function hideWhiteMarks(root) {
  root.traverse((object) => {
    if (!object.isMesh || object.userData.sourceDrawn) return;
    if (Array.isArray(object.material)) {
      const base = object.material.find((material) => !isWhite(material));
      if (base) object.material = object.material.map((material) => (isWhite(material) ? base : material));
    } else if (isWhite(object.material)) object.visible = false;
  });
}

// Black outline rims take the metal of the part they finish: each entry is
// [rim role pattern, role pattern of the part lending its material].
function plainRims(root, pairs) {
  for (const [rimPattern, sourcePattern] of pairs) {
    const rimRegex = new RegExp(`^(?:${rimPattern})$`), sourceRegex = new RegExp(`^(?:${sourcePattern})$`);
    let source = null;
    const rims = [];
    root.traverse((object) => {
      if (!object.isMesh) return;
      const role = object.userData.role || object.name || '';
      if (rimRegex.test(role)) rims.push(object);
      else if (!source && sourceRegex.test(role)) source = object;
    });
    for (const rim of rims) {
      if (source) rim.material = source.material;
      else rim.visible = false;
    }
  }
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
