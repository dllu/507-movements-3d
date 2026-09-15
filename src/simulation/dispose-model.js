export function disposeObject3D(root) {
  const geometries = new Set(), materials = new Set();
  root.traverse(object => {
    // Instance attributes belong to the mesh, not its shared geometry.
    if (object.isInstancedMesh) object.dispose();
    if (object.geometry) geometries.add(object.geometry);
    for (const material of [object.material].flat()) if (material) materials.add(material);
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
}

// A model with external resources owns its complete cleanup. Other authored
// models only own Three.js geometry and materials.
export function disposeMovementModel(model) {
  if (model.dispose) model.dispose();
  else disposeObject3D(model.root);
}
