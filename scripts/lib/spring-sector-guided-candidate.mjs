import {makeSpringSectorCandidate, THREE} from './spring-sector-candidate.mjs';
import {disk, ring, plate, poly, circle, capsule, polygonClipping as clip} from '../../src/simulation/finite-plate-geometry.js';

export {THREE};

// Conformal guide surfaces realize the ideal prismatic constraints. The
// circular hub faces and rear notch covers preserve the engraving's outline.
// Only the prescribed shaft family changes; free bodies and springs remain
// exact copies. The hidden guide construction is a reconstruction choice.
export function makeSpringSectorGuidedCandidate() {
  const model = makeSpringSectorCandidate(), u = model.root.userData;
  for (const [name, mesh] of Object.entries(u.parts)) if (/^(front|rear)GuideRod[01]$/.test(name)) {
    mesh.geometry.computeBoundingBox();
    const {min, max} = mesh.geometry.boundingBox, old = mesh.geometry;
    mesh.geometry = disk(.018, min.z, max.z, 64); old.dispose();
  }
  for (const [name, sign] of [['front', 1], ['rear', -1]]) {
    const cover = u.parts[name + 'HubCover'], radius = u.source.circles.rockshaftEyeOuter.radius / u.source.scale;
    const inner = 25 / u.source.scale, previous = cover.geometry;
    cover.geometry = ring(inner, radius, Math.min(sign * .065, sign * .125), Math.max(sign * .065, sign * .125), 128);
    previous.dispose();
    // The visible face stays circular like B in the engraving. A separate
    // shallow plate behind the sliding sector covers its clearance notch.
    const shape = clip.difference(clip.union(poly(circle([0, 0], radius, 128)), capsule([0, 0], [0, -.175], .12, 48)),
      poly(circle([0, 0], inner, 128)));
    const patch = new THREE.Mesh(plate(shape, Math.min(-sign * .07, -sign * .055), Math.max(-sign * .07, -sign * .055)), cover.material);
    patch.name = name + 'NotchBacking'; patch.position.copy(cover.position);
    patch.castShadow = true; patch.receiveShadow = true;
    u.blocks.shaft.add(patch); u.parts[patch.name] = patch; u.families[patch.name] = 'shaft';
  }
  u.guideFit = {rodRadius: .018, boreRadius: .018, sides: 64,
    qualification: 'Conformal faceted rods and bores realize ideal frictionless prismatic guides, within mesh-coordinate rounding. No clearance, elasticity, friction or bearing-pressure limit is modeled.'};
  model.setState(); return model;
}
