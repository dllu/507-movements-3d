import * as THREE from 'three';

// Refill a TubeGeometry with the same topology, retaining its GPU buffers.
// Use Three's parallel-transport frames and arc-length sampling so existing
// rope paths keep the same cross-section orientation and vertex positions.
export function tubePathUpdater(geometry) {
  const {tubularSegments, radialSegments, radius, closed} = geometry.parameters;
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  position.setUsage(THREE.DynamicDrawUsage);
  normal.setUsage(THREE.DynamicDrawUsage);
  const point = new THREE.Vector3(), direction = new THREE.Vector3();
  const sections = Array.from({length: radialSegments + 1}, (_, j) => {
    const angle = j / radialSegments * Math.PI * 2;
    return [-Math.cos(angle), Math.sin(angle)];
  });
  return path => {
    const frames = path.computeFrenetFrames(tubularSegments, closed);
    geometry.parameters.path = path;
    geometry.tangents = frames.tangents;
    geometry.normals = frames.normals;
    geometry.binormals = frames.binormals;
    for (let i = 0; i <= tubularSegments; i++) {
      const frame = closed && i === tubularSegments ? 0 : i;
      path.getPointAt(frame / tubularSegments, point);
      const N = frames.normals[frame], B = frames.binormals[frame];
      for (let j = 0; j <= radialSegments; j++) {
        const [cos, sin] = sections[j];
        direction.copy(N).multiplyScalar(cos).addScaledVector(B, sin).normalize();
        const index = i * (radialSegments + 1) + j;
        normal.setXYZ(index, direction.x, direction.y, direction.z);
        position.setXYZ(index, point.x + radius * direction.x,
          point.y + radius * direction.y, point.z + radius * direction.z);
      }
    }
    position.needsUpdate = normal.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  };
}
