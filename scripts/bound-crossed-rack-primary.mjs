import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeCrossedRackCandidate} from './lib/crossed-rack-candidate.mjs';
import {makeCrossedRackDynamics} from './lib/crossed-rack-dynamics-study.mjs';
import {makeCrossedRackTriangleBounds} from './lib/crossed-rack-triangle-bounds.mjs';
const input=process.env.PROBE_INPUT??'artifacts/review/080-amplitude016-finest-dynamics.json',prefix=process.env.PROBE_PREFIX??'artifacts/review/080-finest-primary-bounds',
 data=JSON.parse(fs.readFileSync(input)),candidate=makeCrossedRackCandidate(data.geometry),physics=makeCrossedRackDynamics(candidate,data.parameters),
 tolerance=1e-6,roundoff=1e-12,bounds=makeCrossedRackTriangleBounds(candidate,physics,{tolerance,roundoff}),issues=[],
 sources=['scripts/bound-crossed-rack-primary.mjs','scripts/lib/crossed-rack-triangle-bounds.mjs','scripts/lib/crossed-rack-mesh-prisms.mjs',
 'scripts/lib/pull-pawl-triangle-bounds.mjs','scripts/lib/crossed-rack-candidate.mjs','scripts/lib/crossed-rack-source.mjs',
 'scripts/lib/crossed-rack-dynamics-study.mjs','scripts/lib/crossed-rack-contact-study.mjs',input].map((file,i)=>{
  const archive=prefix+'-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);return{file,archive,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
 });
assert.equal(data.failures.length,0);assert.equal(data.rows.length,Math.round(data.duration/data.dt)+1);
let checkedIntervals=0,subdivisions=0,maximumDepth=0,failedIntervals=0,minimumWitnessSeparation=Infinity;
const check=(a,b,index,depth=0)=>{
 maximumDepth=Math.max(maximumDepth,depth);const r=bounds.check(a,b);
 if(r.okay){checkedIntervals++;return true;}
 if(depth>=14||r.witness.midpointSeparation< -tolerance){
  minimumWitnessSeparation=Math.min(minimumWitnessSeparation,r.witness.midpointSeparation);
  if(issues.length<50)issues.push({index,depth,start:a.row,end:b.row,midpoint:r.middle.row,witness:r.witness});return false;
 }
 subdivisions++;const left=check(a,r.middle,index,depth+1),right=check(r.middle,b,index,depth+1);return left&&right;
};
let a=bounds.evaluate(data.rows[0]);
for(let i=1;i<data.rows.length;i++){
 const b=bounds.evaluate(data.rows[i]);if(!check(a,b,i-1))failedIntervals++;a=b;
 if(i%10000===0)console.log({i,checkedIntervals,subdivisions,failedIntervals,maximumDepth});
}
const passed=failedIntervals===0,report={movement:80,status:'continuous-primary-prism-bounds',productionChanged:false,mechanicsPassed:false,passed,
 intervalCount:data.rows.length-1,checkedIntervals,subdivisions,maximumDepth,failedIntervals,tolerance,roundoff,minimumWitnessSeparation,
 completeTrajectory:true,pairs:[['slottedRack','leftHookWeb'],['slottedRack','rightHookWeb']],stats:bounds.stats,
 prisms:Object.fromEntries(Object.entries(bounds.profiles).map(([k,p])=>[k,p.validation])),issues,sources,
 qualification:'Complete actual Float32 cap triangles, including the rack slot, are compared in the translating rack frame. Fixed separating axes and endpoint support bounds include analytic sinusoidal-pivot curvature and linear-angle rotation curvature over each entire playback interval. Adaptive subdivision reduces bounds without changing the piecewise-linear free coordinates or analytic input. The held input at its zero-speed reversal is C1 and obeys the same piecewise acceleration bound. Failed midpoint witnesses are retained; other part pairs remain separate.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,issues:issues.slice(0,3),sources:undefined});if(!passed)process.exitCode=1;
