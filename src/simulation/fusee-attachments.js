import * as THREE from 'three';

// Fixed clevis eyes interleave with the chain's end plates. Their curved
// seats follow the barrel or the fusee riser; the existing chain pin passes
// through the bores, so the end can hinge without stretching a terminal link.
export function makeFuseeChainAnchor({ pinRadius, seatRadius, radialSlope = 0,
  angle = 0, height, offsets }) {
  const eyeRadius = 0.013, boreRadius = 0.0082, thickness = 0.008;
  const halfAngle = Math.asin(eyeRadius / seatRadius);
  const shape = new THREE.Shape();
  const seat = (theta) => {
    const radius = seatRadius + radialSlope * theta;
    return new THREE.Vector2(radius * Math.cos(theta), radius * Math.sin(theta));
  };
  const start = seat(-halfAngle);
  shape.moveTo(start.x, start.y);
  shape.lineTo(pinRadius, -eyeRadius);
  shape.absarc(pinRadius, 0, eyeRadius, -Math.PI / 2, Math.PI / 2, false);
  for (let i = 0; i <= 16; i += 1) {
    const point = seat(halfAngle * (1 - 2 * i / 16));
    shape.lineTo(point.x, point.y);
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(pinRadius, 0, boreRadius, 0, 2 * Math.PI, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 8 });
  geometry.translate(0, 0, -thickness / 2);
  const material = new THREE.MeshStandardMaterial({ color: 0x657370, metalness: 0.3, roughness: 0.57 });
  const root = new THREE.Group();
  for (const offset of offsets) {
    const eye = new THREE.Mesh(geometry, material);
    eye.position.z = offset;
    root.add(eye);
  }
  root.rotation.z = angle;
  root.position.z = height;
  root.userData = { chainEndAnchor: true, pinRadius, seatRadius, radialSlope,
    eyeRadius, boreRadius, thickness, offsets, angle, height,
    pinCenter: new THREE.Vector3(pinRadius, 0, 0) };
  return root;
}

// The ribbon ends are captured in small fixed clamps. These are permanent
// attachment interfaces, with the ribbon seated inside the clamp jaws.
export function makeFuseeSpringClamp({ innerRadius, outerRadius, angle, height = 0.44 }) {
  const clamp = new THREE.Mesh(new THREE.BoxGeometry(outerRadius - innerRadius, 0.024, 0.09),
    new THREE.MeshStandardMaterial({ color: 0x6c7875, metalness: 0.3, roughness: 0.57 }));
  clamp.position.set((innerRadius + outerRadius) / 2 * Math.cos(angle),
    (innerRadius + outerRadius) / 2 * Math.sin(angle), height);
  clamp.rotation.z = angle;
  clamp.userData = { fixedSpringAttachment: true, innerRadius, outerRadius, angle, height };
  return clamp;
}
