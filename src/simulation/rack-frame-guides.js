import * as THREE from 'three';
import { slideSleeve, supportMaterial } from './back-plate-support.js';
import { disk, ring } from './finite-plate-geometry.js';
import { PALETTE } from './primitives.js';

// Fixed guides for a reciprocating rack frame whose end stubs Brown breaks
// off (as 90/91 do for their rods): each stub runs on whole, as a coaxial
// piece of the moving frame, into a rectangular guide just past its reach,
// and the two guides and every fixed shaft's rear bearing hang on one plain
// tie bar behind the mechanism.
//
// `add(name, geometry, family, color)` attaches a mesh; `stubs` are in the
// moving family's local frame: {tipX, y, halfHeight, halfDepth, sign} with
// sign +1 for the right-hand stub. `travel` gives the frame's largest
// displacement to the left and right of the modelled pose. `shafts` are
// {x, y, radius, back, family, local}: back is the z of the shaft's rear end
// and local its centre in the family's own frame (default [0, 0]). With
// `floorY`, guides and bearings stand on posts to that floor instead of a
// tie bar (for open frames whose window a tie bar would cross).
export function addStubGuides({ add, movingFamily, fixedFamily = 'fixed', stubs, travel, shafts = [],
  zWall = -.45, gap = .12, guideLength = .32, wall = .05, clearance = .006, tieHalfHeight = .12, color = PALETTE.driven, floorY }) {
  const guides = [];
  for (const [i, stub] of stubs.entries()) {
    const outward = stub.sign > 0 ? travel.right : travel.left;
    const inward = stub.sign > 0 ? travel.left : travel.right;
    const guideStart = stub.tipX + stub.sign * (outward + gap);
    const guideEnd = guideStart + stub.sign * guideLength;
    const extEnd = guideEnd + stub.sign * (inward + .05);
    const [lo, hi] = [stub.tipX, extEnd].sort((a, b) => a - b);
    add(`stubExtension${i}`, new THREE.BoxGeometry(hi - lo, 2 * stub.halfHeight, 2 * stub.halfDepth)
      .translate((lo + hi) / 2, stub.y, 0), movingFamily, color);
    const center = (guideStart + guideEnd) / 2;
    const sleeve = slideSleeve({ center: new THREE.Vector3(center, stub.y, 0), axis: 'x', length: guideLength,
      innerWidth: 2 * (stub.halfHeight + clearance), innerDepth: 2 * (stub.halfDepth + clearance), wall, zWall });
    sleeve.updateMatrixWorld(true);
    for (const part of [...sleeve.children]) {
      part.geometry.applyMatrix4(part.matrixWorld);
      add(`stubGuide${i}-${part.userData.role}`, part.geometry, fixedFamily, PALETTE.frame);
    }
    guides.push({ x: center, y: stub.y });
  }
  if (floorY !== undefined) {
    // Grounded variant: each guide and the shaft bearings stand on their own
    // posts and feet, leaving an open frame window clear of any tie bar.
    for (const [i, g] of guides.entries()) {
      const stub = stubs[i], postTop = g.y - stub.halfHeight - clearance - wall;
      add(`stubGuidePost${i}`, new THREE.BoxGeometry(.14, postTop - floorY, .12).translate(g.x, (postTop + floorY) / 2, 0), fixedFamily, PALETTE.frame);
      add(`stubGuideFoot${i}`, new THREE.BoxGeometry(.5, .08, .5).translate(g.x, floorY + .04, 0), fixedFamily, PALETTE.frame);
    }
    const byX = new Map();
    for (const [i, shaft] of shafts.entries()) {
      const [lx, ly] = shaft.local ?? [0, 0];
      add(`shaftTail${i}`, disk(shaft.radius, zWall + .004, shaft.back + .001, 96).translate(lx, ly, 0), shaft.family, PALETTE.ink);
      add(`shaftBearing${i}`, ring(shaft.radius + .003, shaft.radius + .13, zWall, Math.min(shaft.back - .03, zWall + .16), 96)
        .translate(shaft.x, shaft.y, 0), fixedFamily, PALETTE.frame);
      add(`shaftBearingPad${i}`, disk(shaft.radius + .15, zWall - .08, zWall, 64).translate(shaft.x, shaft.y, 0), fixedFamily, PALETTE.frame);
      byX.set(shaft.x, Math.max(byX.get(shaft.x) ?? -Infinity, shaft.y));
    }
    for (const [x, top] of byX) {
      add(`shaftPillar${x.toFixed(2)}`, new THREE.BoxGeometry(.2, top - floorY, .08).translate(x, (top + floorY) / 2, zWall - .04), fixedFamily, PALETTE.frame);
      add(`shaftPillarFoot${x.toFixed(2)}`, new THREE.BoxGeometry(.6, .08, .5).translate(x, floorY + .04, zWall - .04), fixedFamily, PALETTE.frame);
    }
    return { guides };
  }
  const xs = guides.map((g) => g.x), y = guides.reduce((sum, g) => sum + g.y, 0) / guides.length;
  const x0 = Math.min(...xs) - .15, x1 = Math.max(...xs) + .15;
  add('guideTieBar', new THREE.BoxGeometry(x1 - x0, 2 * tieHalfHeight, .08).translate((x0 + x1) / 2, y, zWall - .04),
    fixedFamily, PALETTE.frame);
  for (const [i, shaft] of shafts.entries()) {
    const [lx, ly] = shaft.local ?? [0, 0];
    add(`shaftTail${i}`, disk(shaft.radius, zWall + .004, shaft.back + .001, 96).translate(lx, ly, 0), shaft.family, PALETTE.ink);
    const front = Math.min(shaft.back - .03, zWall + .16);
    add(`shaftBearing${i}`, ring(shaft.radius + .003, shaft.radius + .13, zWall, front, 96)
      .translate(shaft.x, shaft.y, 0), fixedFamily, PALETTE.frame);
    if (Math.abs(shaft.y - y) > tieHalfHeight) {
      const [a, b] = [shaft.y, y].sort((p, q) => p - q);
      add(`shaftStrap${i}`, new THREE.BoxGeometry(.2, b - a, .08).translate(shaft.x, (a + b) / 2, zWall - .04),
        fixedFamily, PALETTE.frame);
    }
    add(`shaftBearingPad${i}`, disk(.2, zWall - .08, zWall, 64).translate(shaft.x, shaft.y, 0), fixedFamily, PALETTE.frame);
  }
  return { guides, supportMaterial };
}
