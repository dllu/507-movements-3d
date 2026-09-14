import fs from 'node:fs';
import crypto from 'node:crypto';
import {polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
import {makeConjugateInternalRack} from '../src/simulation/mujoco-internal-rack/profile.js';
const profile=makeConjugateInternalRack(JSON.parse(process.env.PROFILE_OPTIONS??'{}'));
const area=polygons=>polygons.reduce((sum,p)=>sum+p.reduce((sum,r,i)=>{let a=0;for(let j=0;j<r.length;j++){const q=r[(j+1)%r.length];a+=r[j][0]*q[1]-q[0]*r[j][1];}return sum+(i===0?1:-1)*Math.abs(a)/2;},0),0);
let maximumOverlapArea=0,worstPhase=0;
for(let i=0;i<720;i++){
 const phase=(i+.37)/720,a=area(clip.intersection(profile.body,profile.at(profile.pinion,phase)));
 if(a>maximumOverlapArea){maximumOverlapArea=a;worstPhase=phase;}
}
const sources=['src/data/internal-rack-dimensions.js','src/simulation/mujoco-internal-rack/profile.js','src/simulation/coaxial-gear-geometry.js','src/simulation/finite-plate-geometry.js','scripts/prototype-internal-rack-profile.mjs','package-lock.json'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
const report={sources,options:profile.options,teeth:profile.teeth,poses:720,phaseOffset:.37,maximumOverlapArea,worstPhase,bodyComponents:profile.body.length,openingComponents:profile.opening.length,openingVertices:profile.opening.reduce((n,p)=>n+p.reduce((n,r)=>n+r.length,0),0),caveat:'A generated tooth-clearance prototype along the ideal pitch path; this is not validation of passive motion, preload, linkage forces or source dimensions.'};
fs.writeFileSync(process.env.PROFILE_REPORT??'docs/validation/139-generated-profile.json',JSON.stringify(report,null,2)+'\n');
fs.writeFileSync('/dev/shm/139-generated-profile.json',JSON.stringify({...profile,at:undefined}));console.log(report);
