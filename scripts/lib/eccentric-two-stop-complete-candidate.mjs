import {makeEccentricTwoStopCandidate, THREE} from './eccentric-two-stop-candidate.mjs';
import {poly, circle, plate, ring, polygonClipping as clip} from '../../src/simulation/finite-plate-geometry.js';
import {conformingPlateMesh} from '../../src/simulation/conforming-plate-mesh.js';
export {THREE};

// Shaft seats are an interference-free, zero-clearance press-fit idealization.
// The fixed bearings keep their running clearance. Preserve the earlier
// diagnostic geometry so its contact trajectories remain reproducible.
export function makeEccentricTwoStopCompleteCandidate(options = {}) {
  const model = makeEccentricTwoStopCandidate(options), u = model.root.userData;
  for (const [name, bore] of [['camA', .20], ['wheelB', .14]]) {
    const mesh = u.parts[name], {polygons, low, high} = mesh.geometry.userData.plate;
    const geometry = conformingPlateMesh(plate(clip.difference(poly(polygons[0][0]), poly(circle([0,0], bore, 128))), low, high));
    mesh.geometry.dispose(); mesh.geometry = geometry;
  }
  for (const [name, inner, outer, low, high] of [['camHub', .20, .33, .13, .23], ['wheelRearHub', .14, .28, -.21, -.08]]) {
    u.parts[name].geometry.dispose(); u.parts[name].geometry = ring(inner, outer, low, high, 128);
  }
  u.geometry.pressFitShaftSeats = true;
  return model;
}
