import fs from 'node:fs';
import crypto from 'node:crypto';
import {roundedRackGear} from '../src/simulation/coaxial-gear-geometry.js';
const settings={module:.105,depth:.26,boreRadius:.07,samples:256,cutterSteps:8192,addendum:.9,dedendum:1.38,tipRadius:.015,backlash:.001,radialClearance:.00002};
const pinion=roundedRackGear({...settings,teeth:8}),sector=roundedRackGear({...settings,teeth:48});
const points=g=>g.userData.outline.map(p=>p.toArray());
const p=points(pinion),s=points(sector).slice(0,settings.samples+1),root=5.6547878541639385*.42-.005;
for(const q of [s.at(-1),s[0]]){const r=Math.hypot(...q);s.push(q.map(x=>x*root/r));}
const sources=['scripts/generate-sector-press-teeth.mjs','src/simulation/coaxial-gear-geometry.js'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
fs.writeFileSync('src/data/sector-press-teeth.js','export default '+JSON.stringify({settings,sources,pinion:p,sectorTooth:s}));pinion.dispose();sector.dispose();
