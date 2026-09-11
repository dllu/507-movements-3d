import { readFile, writeFile } from 'node:fs/promises';
import { refinedWormProfile } from './lib/refined-worm-profile.mjs';

const baseline=JSON.parse(await readFile('artifacts/review/031-original-worm-profile.json','utf8'));
const parameters=JSON.parse(baseline.key),start=Date.now();
const profile=refinedWormProfile(parameters,{phaseSteps:1600,radialSteps:80,clearance:0.0004});
await writeFile('artifacts/review/031-corrected-worm-profile.json',JSON.stringify({parameters,profile,seconds:(Date.now()-start)/1000},null,2)+'\n');
console.log({parameters,id:profile.id,samples:profile.radii.length,seconds:(Date.now()-start)/1000});
