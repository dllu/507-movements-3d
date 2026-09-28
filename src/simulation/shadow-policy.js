// One shadow policy for every movement: each visible, opaque, physical part
// casts and receives shadows. Individual factories had switched casting off
// on solid parts (pins, pegs, hubs), so those parts floated shadowless and
// white pegs read as holes. Exempt: camera-fit guides, see-through parts,
// transparent or depth-less materials (water, steam, glass, overlays) and
// anything tagged userData.noShadow.
const FLUID = /water|steam|fluid|jet|spray|stream|mercury|quicksilver|flame|smoke|spark/i;

export function applyShadowPolicy(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    const materials = [object.material].flat().filter(Boolean);
    const physical = !object.userData.cameraFitGuide && !object.userData.noShadow
      && materials.length > 0
      && materials.every((material) => !material.transparent && material.opacity >= 1
        && material.depthWrite !== false && material.colorWrite !== false && material.visible !== false)
      && !FLUID.test(object.userData.role ?? object.name ?? '');
    if (!physical) return;
    object.castShadow = !object.userData.seeThrough;
    object.receiveShadow = true;
  });
  return root;
}
