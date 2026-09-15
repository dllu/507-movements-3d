import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {linkedVariableCrankGeometry, linkedVariableCrankAtAngle} from '../src/simulation/linked-variable-crank-motion.js';

const g = linkedVariableCrankGeometry(), initial = linkedVariableCrankAtAngle(g.phase, g);
const joints = [['auxiliaryPin', [251, 230]], ['wrist', [61, 286]], ['slotPin', [428, 172]], ['mainPin', [489, 218]]]
  .map(([name, engraving]) => {
    const projected = [267 + initial[name][0] / g.scale, 275 - initial[name][1] / g.scale];
    return {name, engraving, projected, pixelError: Math.hypot(...projected.map((x, i) => x - engraving[i]))};
  });
let innerMargin = Infinity, outerMargin = Infinity;
for (let i = 0; i <= 1440; i++) {
  const s = linkedVariableCrankAtAngle(i * 2 * Math.PI / 1440, g);
  innerMargin = Math.min(innerMargin, s.innerMargin); outerMargin = Math.min(outerMargin, s.outerMargin);
}
const sources = ['scripts/measure-linked-variable-crank.mjs', 'src/simulation/linked-variable-crank-motion.js',
  'src/simulation/variable-radius-crank-motion.js', 'public/engravings/mm_169.png']
  .map(file => ({file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
const report = {movement: 169, source: 'https://507movements.com/mm_169.html',
  method: 'Planar joint projection from manually read engraving centers; not whole-contour registration. No source 2D animation is available.',
  geometry: g, joints, poses: 1441, minimumInnerCircleMargin: innerMargin, minimumOuterCircleMargin: outerMargin, sources};
fs.writeFileSync('docs/validation/169-source-closure.json', JSON.stringify(report, null, 2) + '\n');
console.log(report);
