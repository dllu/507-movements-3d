// Bounded diagnostic, not a pass/fail collision certificate. Optional output
// belongs in /dev/shm; the retained working defects are expected to be present.
import fs from 'node:fs';
import * as THREE from 'three';
import { createAuthoredQuadrantCatchMovement as create } from '../src/simulation/authored-quadrant-catches.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';
const model = create({ id: 183 }), d = model.root.userData, b = d.blocks;
const pairs = [ ['upperBottomSeatPin', 'lowerQuadrantBand'], ['lowerTopSeatPin', 'upperQuadrantBand'],
  ['upperHandleWorkingTip', 'tappet'], ['lowerHandleWorkingTip', 'tappet'] ];
const cache = new Map();
for (const pair of pairs) for (const name of pair) {
  const mesh = b[name]; cache.set(name, { points: surfacePoints(mesh.geometry), field: solidSurface(mesh.geometry) });
}
const witnesses = {};
for (let i = 0; i <= 64; i++) {
  const time = d.geometry.cyclePeriod * i / 64;
  model.update(time); model.root.updateMatrixWorld(true);
  for (const [a, c] of pairs) for (const [from, to] of [[a, c], [c, a]]) {
    const matrix = b[to].matrixWorld.clone().invert().multiply(b[from].matrixWorld);
    for (const point of cache.get(from).points) {
      const gap = cache.get(to).field.signedDistance(point.clone().applyMatrix4(matrix), .3), name = `${a}/${c}`;
      if (gap < (witnesses[name]?.gap ?? 0)) witnesses[name] = { gap, time };
    }
  }
}
const g = d.geometry, rot = (p, a) => p.clone().rotateAround(new THREE.Vector2(), a);
const upperInLower = u => rot(rot(g.upperBottomSeatLocal, u*g.source184UpperAngle).add(g.upperPivot).sub(g.lowerPivot), -u*g.source184LowerAngle);
const q = upperInLower(0), radial = q.clone().normalize(), insideNormal = radial.clone().negate(),
  terminalAngle = q.angle() + Math.asin(g.latchPinRadius/q.length()), terminalNormal = new THREE.Vector2(Math.sin(terminalAngle), -Math.cos(terminalAngle)),
  dq = upperInLower(1e-6).sub(upperInLower(-1e-6)).multiplyScalar(5e5),
  moment = normal => g.upperBottomSeatLocal.x*normal.y-g.upperBottomSeatLocal.y*normal.x;
const report = { movements: [183, 184], status: 'partial-structural-correction-working-contact-unresolved', poses: 65, witnesses,
  rejectedShortcut: { lowerInnerRimReactionMoment: moment(insideNormal), lowerTerminalReactionMoment: moment(terminalNormal),
    gapDerivativeUnderOldSchedule: dq.dot(terminalNormal),
    meaning: 'A circular inner rim assists the upper weight. A radial terminal can oppose it, but the synchronized schedule immediately penetrates that terminal.' },
  scope: 'Four named actual-surface pairs. Other working and support pairs are not exhaustively audited. Dimensions are model units.' };
const text = JSON.stringify(report, null, 2)+'\n';
if (process.argv[2]) fs.writeFileSync(process.argv[2], text);
console.log(text);
