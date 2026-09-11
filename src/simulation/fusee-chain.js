import * as THREE from 'three';

export function makeArticulatedFuseeChain(linkCount, linkPitch) {
  const root = new THREE.Group();
  const plateRadius = 0.017, boreRadius = 0.0082, pinRadius = 0.0055;
  const plateThickness = 0.008;
  const shape = new THREE.Shape();
  shape.moveTo(-linkPitch / 2, -plateRadius);
  shape.lineTo(linkPitch / 2, -plateRadius);
  shape.absarc(linkPitch / 2, 0, plateRadius, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-linkPitch / 2, plateRadius);
  shape.absarc(-linkPitch / 2, 0, plateRadius, Math.PI / 2, 3 * Math.PI / 2, false);
  shape.closePath();
  for (const x of [-linkPitch / 2, linkPitch / 2]) {
    const bore = new THREE.Path();
    bore.absarc(x, 0, boreRadius, 0, 2 * Math.PI, true);
    shape.holes.push(bore);
  }
  const plateGeometry = new THREE.ExtrudeGeometry(shape, { depth: plateThickness,
    bevelEnabled: false, curveSegments: 8 });
  plateGeometry.translate(0, 0, -plateThickness / 2);
  const evenPlates = new THREE.InstancedMesh(plateGeometry,
    new THREE.MeshStandardMaterial({ color: 0xb6bebb, metalness: 0.28, roughness: 0.55 }), Math.ceil(linkCount / 2) * 3);
  const oddPlates = new THREE.InstancedMesh(plateGeometry,
    new THREE.MeshStandardMaterial({ color: 0x515c5b, metalness: 0.24, roughness: 0.60 }), Math.floor(linkCount / 2) * 2);
  const pins = new THREE.InstancedMesh(new THREE.CylinderGeometry(pinRadius, pinRadius, 0.074, 12),
    new THREE.MeshStandardMaterial({ color: 0x8c9997, metalness: 0.28, roughness: 0.54 }), linkCount + 1);
  root.add(evenPlates, oddPlates, pins);
  const links = Array.from({ length: linkCount }, () => ({
    matrix: new THREE.Matrix4(), hinge: new THREE.Vector3(),
  }));
  const tangent = new THREE.Vector3(), radial = new THREE.Vector3(), hinge = new THREE.Vector3();
  const center = new THREE.Vector3(), position = new THREE.Vector3();
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0), unitScale = new THREE.Vector3(1, 1, 1);
  const setState = (state) => {
    let evenIndex = 0, oddIndex = 0;
    for (let i = 0; i < linkCount; i += 1) {
      const a = state.pins[i], b = state.pins[i + 1];
      tangent.subVectors(b, a).normalize();
      hinge.copy(up).addScaledVector(tangent, -up.dot(tangent)).normalize();
      radial.crossVectors(hinge, tangent).normalize();
      center.copy(a).add(b).multiplyScalar(0.5);
      matrix.makeBasis(tangent, radial, hinge).setPosition(center);
      links[i].matrix.copy(matrix);
      links[i].hinge.copy(hinge);
      for (const offset of i % 2 === 0 ? [-0.026, 0, 0.026] : [-0.013, 0.013]) {
        position.copy(center).addScaledVector(hinge, offset);
        matrix.setPosition(position);
        if (i % 2 === 0) evenPlates.setMatrixAt(evenIndex++, matrix);
        else oddPlates.setMatrixAt(oddIndex++, matrix);
      }
    }
    for (let i = 0; i <= linkCount; i += 1) {
      hinge.copy(links[Math.min(i, linkCount - 1)].hinge);
      if (i > 0 && i < linkCount) hinge.add(links[i - 1].hinge).normalize();
      quaternion.setFromUnitVectors(up, hinge);
      matrix.compose(state.pins[i], quaternion, unitScale);
      pins.setMatrixAt(i, matrix);
    }
    for (const mesh of [evenPlates, oddPlates, pins]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
    }
    root.userData.pinPositions = state.pins;
  };
  root.userData = { continuousFuseeChain: true, articulatedChain: true, linkCount, linkPitch,
    plateRadius, boreRadius, pinRadius, plateThickness, evenPlates, oddPlates, pins, links, setState };
  return root;
}
