import fs from 'node:fs';
import {roundedRackGear} from '../src/simulation/coaxial-gear-geometry.js';
const parameters={module:.12,pressureAngle:25*Math.PI/180,addendum:.8,dedendum:1.05,backlash:.0012,radialClearance:.0003,samples:192,cutterSteps:8192};
const profiles={};
for(const teeth of [14,11]){const g=roundedRackGear({...parameters,teeth,depth:.32,boreRadius:.09});profiles[teeth]=g.userData.outline.slice(0,parameters.samples).map(p=>Number(p.length().toFixed(9)));g.dispose();}
fs.writeFileSync('src/data/planetary-505-profiles.js',`// Offline rounded-rack profiles; regenerate with scripts/generate-planetary-505-profiles.mjs.\nexport const planetary505Parameters=${JSON.stringify(parameters)};\nexport const planetary505Profiles=${JSON.stringify(profiles)};\n`);
