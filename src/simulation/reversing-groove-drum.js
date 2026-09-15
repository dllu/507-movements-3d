import * as THREE from 'three';
import {PALETTE, matte, markShadows} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';

const TAU = 2 * Math.PI;
export const grooveDrumGeometry = Object.freeze({
  radius: .56, length: 4.76, floorRadius: .40, slotHalfHeight: .17,
  centerY: .21, amplitude: 1.218, studRadius: .075,
  studCenterRadius: .53, rodX: 1.05, rodRadius: .112,
  rodLength: 5.39, period: 4,
});
export function grooveHeight(angle, g = grooveDrumGeometry) {
  const a = ((angle % TAU) + TAU) % TAU;
  return g.centerY - g.amplitude + 2 * g.amplitude * Math.min(a, TAU - a) / Math.PI;
}
export function grooveDrumState(time, g = grooveDrumGeometry) {
  const phase = TAU * time / g.period, cycle = Math.floor(phase / TAU);
  const a = phase - cycle * TAU, c = Math.cos(a);
  const localAngle = cycle * TAU + (a < Math.PI ? Math.PI / 2 * (1 - c) : Math.PI * 1.5 + Math.PI / 2 * c);
  return {rodY: g.centerY - g.amplitude * c, drumAngle: -localAngle, localAngle};
}

// Closed upper/lower drum solids with an actual channel between their faces.
// Separate quads retain sharp channel edges and smooth cylindrical normals.
function drumHalf(upper, g) {
  const positions = [], normals = [], segments = 512;
  const vertex = (a, r, y) => new THREE.Vector3(r * Math.cos(a), y, -r * Math.sin(a));
  const crossSection = a => {
    const lip = grooveHeight(a, g) + (upper ? 1 : -1) * g.slotHalfHeight;
    const end = (upper ? 1 : -1) * g.length / 2;
    const low = Math.min(lip, end), high = Math.max(lip, end);
    return [[g.floorRadius, low], [g.radius, low], [g.radius, high], [g.floorRadius, high]];
  };
  for (let i = 0; i < segments; i++) {
    const a = TAU * i / segments, b = TAU * (i + 1) / segments;
    const sa = crossSection(a), sb = crossSection(b);
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      const quad = [vertex(a, ...sa[j]), vertex(b, ...sb[j]), vertex(b, ...sb[k]), vertex(a, ...sa[k])];
      for (const indices of [[0, 1, 2], [0, 2, 3]]) {
        const tri = indices.map(n => quad[n]);
        const faceNormal = new THREE.Triangle(...tri).getNormal(new THREE.Vector3());
        for (const point of tri) {
          positions.push(...point.toArray());
          const normal = j === 1 || j === 3
            ? new THREE.Vector3(point.x, 0, point.z).normalize().multiplyScalar(j === 1 ? 1 : -1)
            : faceNormal;
          normals.push(...normal.toArray());
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

export function makeReversingGrooveDrum() {
  const g = grooveDrumGeometry, root = new THREE.Group();
  const rotor = new THREE.Group(), rod = new THREE.Group();
  root.add(rotor, rod);
  const parts = {}, families = {}, materials = new Map();
  const add = (name, geometry, family, color, position = [0, 0, 0]) => {
    if (!materials.has(color)) { const material = matte(color); material.fog = false; materials.set(color, material); }
    const mesh = new THREE.Mesh(geometry, materials.get(color));
    mesh.name = name; mesh.position.set(...position);
    (family === 'rotor' ? rotor : rod).add(mesh);
    parts[name] = mesh; families[name] = family; return mesh;
  };
  add('lowerDrum', drumHalf(false, g), 'rotor', PALETTE.driver);
  add('upperDrum', drumHalf(true, g), 'rotor', PALETTE.driver);
  add('grooveFloor', new THREE.CylinderGeometry(g.floorRadius, g.floorRadius, g.length, 128), 'rotor', PALETTE.ink);
  add('shaft', new THREE.CylinderGeometry(.105, .105, 5.628, 48), 'rotor', PALETTE.ink);
  const rodLocalY = (272 - (79 + 464) / 2) * .014 - (g.centerY - g.amplitude);
  add('rod', new THREE.CylinderGeometry(g.rodRadius, g.rodRadius, g.rodLength, 48), 'rod', PALETTE.driven, [g.rodX, rodLocalY, 0]);
  add('studSeat', new THREE.BoxGeometry(.196, .616, .196), 'rod', PALETTE.brass, [.84, 0, 0]);
  const stemLength = .84 - g.studCenterRadius;
  const stem = add('studStem', new THREE.CylinderGeometry(.055, .055, stemLength, 48), 'rod', PALETTE.ink, [g.studCenterRadius + stemLength / 2, 0, 0]);
  stem.rotation.z = Math.PI / 2;
  add('studTip', new THREE.SphereGeometry(g.studRadius, 48, 32), 'rod', PALETTE.ink, [g.studCenterRadius, 0, 0]);
  const update = time => {
    const state = grooveDrumState(time, g);
    rotor.rotation.y = state.drumAngle; rod.position.y = state.rodY;
    root.updateMatrixWorld(true); root.userData.state = state;
  };
  const bounds = new THREE.Box3();
  for (let i = 0; i <= 128; i++) { update(g.period * i / 128); bounds.union(new THREE.Box3().setFromObject(root, true)); }
  bounds.expandByScalar(.04); update(0); markShadows(root);
  Object.assign(root.userData, {parts, families, geometry: g, mechanism: 'recessed-reversing-spiral-drum',
    simulationBackend: 'analytic', fidelity: 'authored', reconstructionStatus: 'reconstructed', supportsRestart: true,
    hideGround: true, cameraFitBounds: bounds, cameraFov: 8,
    animationTiming: {authoredCyclePeriod: g.period, displayCycleDuration: g.period, playbackTimeScale: 1},
    reconstructionNote: 'Opposite-pitch groove halves guide the reciprocating stud. Harmonic rod motion and continued rotation at the two dead centers are prescribed; inertia and contact forces are not simulated. Groove depth, stud clearance and hidden dimensions are inferred.'});
  return {root, update, reset: () => update(0), focus: bounds.getCenter(new THREE.Vector3()),
    cameraDirection: new THREE.Vector3(.01, .01, 15), dispose: () => disposeObject3D(root)};
}
