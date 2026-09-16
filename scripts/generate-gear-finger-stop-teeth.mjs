import {writeFile} from 'node:fs/promises';
import {roundedRackGear} from '../src/simulation/coaxial-gear-geometry.js';

// Retain the source pitch radii and phase. Rounded rack generation supplies
// the root transitions. A 30-degree pressure angle avoids the lost working
// interval produced by undercutting this small pair with a 20-degree rack.
const profiles={};
for(const teeth of [10,12]){
  const geometry=roundedRackGear({teeth,module:.48,depth:.4,boreRadius:.12,pressureAngle:Math.PI/6,
    backlash:.001,radialClearance:.0001,samples:512,cutterSteps:8192});
  const d=geometry.userData;
  profiles[teeth]={outline:d.outline.map(p=>p.toArray().map(v=>Math.round(v*1e10)/1e10)),
    module:d.module,pressureAngle:d.pressureAngle,backlash:d.backlash,radialClearance:d.radialClearance,
    samples:d.samples,cutterSteps:d.cutterSteps,toothProfile:d.toothProfile};
  geometry.dispose();console.log({teeth,vertices:profiles[teeth].outline.length});
}
await writeFile(new URL('../src/simulation/baked/gear-finger-stop-teeth.js',import.meta.url),
  `// Generated offline by scripts/generate-gear-finger-stop-teeth.mjs.\nexport default ${JSON.stringify(profiles)};\n`);
