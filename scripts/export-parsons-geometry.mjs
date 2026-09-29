// Movement 394: exports the pinion outline, the path and the rack void (without
// the generated end relief) for scripts/generate-parsons-ends.py.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {parsonsDesign, parsonsPinionOutline, parsonsRackVoid} from '../src/simulation/authored-parsons-racks.js';

export function parsonsEndCarveInputs() {
  const g = parsonsDesign({endCarve: false});
  const pinion = parsonsPinionOutline(g).map((p) => p.map((v) => Number(v.toFixed(9))));
  const design = {
    halfStraight: g.halfStraight, eccentricity: g.eccentricity, pinionPitchRadius: g.pinionPitchRadius,
    endPitchRadius: g.endPitchRadius, pathLength: g.pathLength, pitch: g.pitch, module: g.module,
    endTeeth: g.endTeeth, pinionTeeth: g.pinionTeeth,
  };
  const digest = createHash('sha256').update(JSON.stringify({design, pinion})).digest('hex');
  return {design, pinion, void: parsonsRackVoid(g), digest};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fs.writeFileSync(process.argv[2] ?? '/dev/shm/parsons-geometry.json', JSON.stringify(parsonsEndCarveInputs()));
}
