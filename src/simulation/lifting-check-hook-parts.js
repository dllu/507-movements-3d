import * as THREE from 'three';
import { PALETTE, matte } from './primitives.js';
import { capsule, circle, disk, plate, poly, polygonClipping, ring } from './finite-plate-geometry.js';

export function boredHookPlate(points, radius, depth, bore, eyeRadius = bore + .13, extraOutlines = []) {
  const outlines = points.slice(1).map((point, i) => capsule(points[i], point, radius, 24));
  const outer = polygonClipping.union(...outlines, poly(circle([0, 0], eyeRadius, 96)), ...extraOutlines.map(poly));
  return plate(polygonClipping.difference(outer, poly(circle([0, 0], bore, 96))), -depth / 2, depth / 2);
}

export function finishHookFamily(root, duration) {
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = duration;
  root.userData.cameraFov = 8;
  root.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true; object.receiveShadow = true;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.fog = false;
  });
}

export function correctCheckHookJournals(root) {
  const { hooks, hookPivots, flangeDisk, centerShaft, fixedBacking, ropeDrumBody } = root.userData.blocks;
  const { hookCenterline, hookBarRadius, hookBarbOutline } = root.userData.geometry;
  // Brown draws each hook eye as a round boss with a small bore on flange B;
  // a proportionate pin fills that bore rather than swamping the eye.
  const hookEyeRadius = .36, hookBoreRadius = .155, hookPinRadius = .145;
  const hookMaterial = matte(PALETTE.muted, { metalness: .3, roughness: .45 });
  const plates = [];
  hooks.forEach((hook, index) => {
    // Forged-steel hooks, distinct from flange B so each bored eye reads.
    const material = hookMaterial;
    for (const child of hook.children) child.visible = false;
    const body = new THREE.Mesh(boredHookPlate(hookCenterline.map(p => p.toArray()), hookBarRadius, .36, hookBoreRadius, hookEyeRadius, [hookBarbOutline.map(p => p.toArray())]), material);
    body.userData.role = 'bored-working-check-hook'; hook.add(body); plates.push(body);
    // Brown draws no hook stops: the deployed angle is prescribed, so no
    // stop stud is modelled beside the hook pivot.
    const pin=hookPivots[index].children.find(o=>o.userData.role?.endsWith('pivot-pin'));
    pin.geometry=new THREE.CylinderGeometry(hookPinRadius,hookPinRadius,.76,64);
    hookPivots[index].children.find(o=>o.userData.role?.endsWith('torsion-return-spring')).position.z=.27;
  });
  // Both the flange and load drum turn around the common shaft.
  for (const mesh of [flangeDisk, fixedBacking, ropeDrumBody]) {
    if (!mesh?.geometry.parameters?.radiusTop) continue;
    const { radiusTop, height } = mesh.geometry.parameters;
    const shaftRadius = centerShaft.geometry.parameters.radiusTop;
    mesh.geometry = ring(shaftRadius + .004, radiusTop, -height / 2, height / 2, 96);
    mesh.rotation.set(0, 0, 0);
  }
  root.userData.blocks.ropeDrumIndex.geometry = new THREE.BoxGeometry(.6,.13,.07);
  root.userData.blocks.ropeDrumIndex.position.set(.65,0,.825);
  root.userData.workingHooks = { plates, eyeRadius: hookEyeRadius, boreRadius: hookBoreRadius, pinRadius: hookPinRadius };
  root.userData.dynamics = { prescribedDeployment: true, prescribedCatchImpact: true,
    validatedPassiveCatch: false, springLaw: 'ideal unloaded torsional quarter-cycle followed by imposed holding and reset' };
  root.userData.reconstructionNote = 'The hook faces resist drum rotation. Brown draws no hook stops, so the deployed hook angle is prescribed rather than seated on a stop. Hook deployment, impact and subsequent holding are prescribed; the illustrated spring response does not validate a loaded mine-hoist arrest.';
  finishHookFamily(root, 12);
}
