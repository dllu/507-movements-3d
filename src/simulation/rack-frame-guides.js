import * as THREE from 'three';
import { PALETTE } from './primitives.js';

// Straight run-ons for a reciprocating rack frame whose end stubs Brown breaks
// off at the plate edge (114-116). Each stub continues straight, as a coaxial
// piece of the moving frame, far enough that its clean square end never
// travels in past the drawn break. No guides, posts, bearings or tie bars are
// added: Brown draws none, and the p60 support policy keeps undrawn supports
// out unless a fixed pivot or guide would otherwise be unreadable.
//
// `add(name, geometry, family, color)` attaches a mesh; `stubs` are in the
// moving family's local frame: {tipX, y, halfHeight, halfDepth, sign} with
// sign +1 for the right-hand stub. `travel` gives the frame's largest
// displacement to the left and right of the modelled pose.
export function addStubRunOns({ add, movingFamily, stubs, travel, color = PALETTE.driven }) {
  const ends = [];
  for (const [i, stub] of stubs.entries()) {
    const inward = stub.sign > 0 ? travel.left : travel.right;
    const extEnd = stub.tipX + stub.sign * (inward + .05);
    const [lo, hi] = [stub.tipX, extEnd].sort((a, b) => a - b);
    add(`stubExtension${i}`, new THREE.BoxGeometry(hi - lo, 2 * stub.halfHeight, 2 * stub.halfDepth)
      .translate((lo + hi) / 2, stub.y, 0), movingFamily, color);
    ends.push(extEnd);
  }
  return { ends };
}
