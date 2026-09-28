import fs from 'node:fs';
import crypto from 'node:crypto';
import {roundedRackGear} from '../src/simulation/coaxial-gear-geometry.js';
// Brown draws a 12-tooth pinion with square, flat-topped teeth. At the
// source's 6:1 ratio that makes a 72-tooth equivalent sector. Stub 20-degree
// involutes (addendum 0.75, dedendum 1.0) with a +0.3/-0.3 profile-shift pair
// keep the centre distance and give flat tips of about 0.26 (pinion) and 0.33
// (sector) of the pitch, with contact ratio 1.1 and no pinion undercut.
const settings={module:.07,depth:.26,boreRadius:.07,samples:256,cutterSteps:8192,addendum:.75,dedendum:1,tipRadius:.012,backlash:.001,radialClearance:.00002},shift=.3;
const pinion=roundedRackGear({...settings,teeth:12,profileShift:shift}),sector=roundedRackGear({...settings,teeth:72,profileShift:-shift});
const points=g=>g.userData.outline.map(p=>p.toArray());
const p=points(pinion),s=points(sector).slice(0,settings.samples+1),root=5.6547878541639385*.42-.005;
for(const q of [s.at(-1),s[0]]){const r=Math.hypot(...q);s.push(q.map(x=>x*root/r));}
const sources=['scripts/generate-sector-press-teeth.mjs','src/simulation/coaxial-gear-geometry.js'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
fs.writeFileSync('src/data/sector-press-teeth.js','export default '+JSON.stringify({settings,sources,pinion:p,sectorTooth:s,pinionTeeth:12,sectorEquivalentTeeth:72,profileShift:shift}));pinion.dispose();sector.dispose();
