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

// p109: the fusee end of the chain is hooked into a steel block seated on the
// base-flange tread against the riser, so the end reads as anchored rather
// than stopping in the air. In the anchor frame (x radial through the end
// pin, z along the axis, +y the direction the helix would continue) the
// clevis eyes run forward from the terminal pin into the block. The block is
// one annular-sector extrusion: inside face just clear of the riser, bottom
// on the tread, top level with the chain pins' ends; it starts clear of the
// terminal link's round plate ends.
export function makeFuseeChainEndBlock({ pinRadius, riserRadius, radialSlope = 0, angle = 0,
  height, treadDepth, offsets, clearance = 0.022, length = 0.07, outerReach = 0.022, top = 0.037 }) {
  const eyeRadius = 0.013, boreRadius = 0.0082, thickness = 0.008;
  const start = clearance / pinRadius, end = (clearance + length) / pinRadius;
  const inner = (phi) => riserRadius + 0.002 + radialSlope * phi, outer = pinRadius + outerReach;
  const material = new THREE.MeshStandardMaterial({ color: 0x657370, metalness: 0.3, roughness: 0.57 });
  const root = new THREE.Group();
  // Eye: a round end concentric with the pin, running forward along the pin
  // circle into the block.
  const eyeShape = new THREE.Shape();
  const reach = (clearance + 0.012) / pinRadius, samples = 12;
  const along = (radius, phi) => new THREE.Vector2(radius * Math.cos(phi), radius * Math.sin(phi));
  eyeShape.absarc(pinRadius, 0, eyeRadius, Math.PI, 2 * Math.PI, false);
  for (let i = 0; i <= samples; i += 1) { const q = along(pinRadius + eyeRadius, reach * i / samples); eyeShape.lineTo(q.x, q.y); }
  for (let i = samples; i >= 0; i -= 1) { const q = along(pinRadius - eyeRadius, reach * i / samples); eyeShape.lineTo(q.x, q.y); }
  eyeShape.closePath();
  const bore = new THREE.Path();
  bore.absarc(pinRadius, 0, boreRadius, 0, 2 * Math.PI, true);
  eyeShape.holes.push(bore);
  const eyeGeometry = new THREE.ExtrudeGeometry(eyeShape, { depth: thickness, bevelEnabled: false, curveSegments: 16 });
  eyeGeometry.translate(0, 0, -thickness / 2);
  for (const offset of offsets) {
    const eye = new THREE.Mesh(eyeGeometry, material);
    eye.position.z = offset;
    root.add(eye);
  }
  const blockShape = new THREE.Shape(), arc = 24;
  for (let i = 0; i <= arc; i += 1) { const phi = start + (end - start) * i / arc, q = along(outer, phi); if (i) blockShape.lineTo(q.x, q.y); else blockShape.moveTo(q.x, q.y); }
  for (let i = arc; i >= 0; i -= 1) { const phi = start + (end - start) * i / arc, q = along(inner(phi), phi); blockShape.lineTo(q.x, q.y); }
  blockShape.closePath();
  const bottom = -treadDepth - 0.002;
  const blockGeometry = new THREE.ExtrudeGeometry(blockShape, { depth: top - bottom, bevelEnabled: false, curveSegments: 1 });
  blockGeometry.translate(0, 0, bottom);
  const block = new THREE.Mesh(blockGeometry, material);
  block.userData.anchorBlock = true;
  block.userData.role = 'fusee-chain-end-block-on-base-tread';
  root.add(block);
  root.rotation.z = angle;
  root.position.z = height;
  root.userData = { chainEndAnchor: true, pinRadius, seatRadius: riserRadius, radialSlope,
    eyeRadius, boreRadius, thickness, offsets, angle, height, block,
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
