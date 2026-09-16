import * as THREE from 'three';
import { boreWormGeometry } from './bored-worm-geometry.js';
import { cylindricalWormGeometry } from './worm-gear-geometry.js';
import { matte, PALETTE } from './primitives.js';

/** A single-start worm with integral straight flanks and a real shaft bore.
 * The pitch-helix samples are analytic references, not the visible surface.
 * Tooth clearance against a wheel must be qualified separately.
 */
export function makeSolidWorm({
  length, radius, pitch, shaftRadius, handedness = 1,
  axis = new THREE.Vector3(1, 0, 0), color = PALETTE.driver,
  pressureAngle = 20 * Math.PI / 180, angularSteps = 96,
}) {
  if (![1, -1].includes(handedness)) throw new Error('Worm handedness must be +1 or -1');
  if (!(length > 0 && pitch > 0 && shaftRadius > 0 && radius > shaftRadius)) {
    throw new Error('Worm dimensions must leave room for its shaft bore');
  }
  const module = pitch / Math.PI;
  const boreRadius = shaftRadius + 0.001;
  // A shallow root is necessary when the source shaft fills a small worm.
  const rootRadius = Math.max(radius - 1.25 * module, boreRadius + module * 0.15);
  if (rootRadius >= radius) throw new Error('Worm root must fit below its pitch cylinder');
  const source = cylindricalWormGeometry({
    pitchRadius: radius, module, length, pressureAngle, angularSteps, rootRadius,
    rootHalfWidth: pitch / 4 + (radius - rootRadius) * Math.tan(pressureAngle),
  });
  const bore = Array.from({ length: 48 }, (_, i) => {
    const a = i * Math.PI / 24;
    return [boreRadius * Math.cos(a), boreRadius * Math.sin(a)];
  });
  const geometry = boreWormGeometry(source, bore);
  source.dispose();
  if (handedness < 0) {
    geometry.scale(1, -1, 1);
    // Reflection reverses winding. Preserve outward-facing triangles/normals.
    for (const attribute of Object.values(geometry.attributes)) {
      for (let i = 0; i < attribute.count; i += 3) {
        for (let c = 0; c < attribute.itemSize; c += 1) {
          const a = (i + 1) * attribute.itemSize + c;
          const b = (i + 2) * attribute.itemSize + c;
          const value = attribute.array[a];
          attribute.array[a] = attribute.array[b];
          attribute.array[b] = value;
        }
      }
    }
  }
  const turns = length / pitch;
  geometry.rotateZ(handedness * Math.PI * turns);
  geometry.userData.handedness = handedness;
  const thread = new THREE.Mesh(geometry, matte(color, { metalness: 0.15, roughness: 0.58 }));
  thread.userData.screwThread = true;
  thread.userData.role = 'integral-straight-flanked-bored-worm';
  const rotor = new THREE.Group();
  rotor.add(thread);
  const root = new THREE.Group();
  root.add(rotor);
  root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis.clone().normalize());
  const pointCount = Math.ceil(turns * 28) + 1;
  const threadPoints = Array.from({ length: pointCount }, (_, i) => {
    const t = i / (pointCount - 1);
    const a = handedness * t * turns * Math.PI * 2;
    return new THREE.Vector3(radius * Math.cos(a), radius * Math.sin(a), length * (t - 0.5));
  });
  Object.assign(root.userData, {
    axis: axis.clone().normalize(), rotor, thread, threadPoints,
    pitchReferenceOnly: true, handedness, length, pitch, radius, turns, starts: 1,
    boreRadius, rootRadius, toothProfile: 'axial-straight-flanked-worm',
  });
  return root;
}
