import fs from 'node:fs';
import {createHash} from 'node:crypto';
// Approximate centers read from the 525-pixel original, not dimensioned data.
const p={gear:[263,288],eccentric:[212,264],joint:[247,228],rockerPivot:[469,258]};
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const lengths={input:distance(p.gear,p.eccentric),coupler:distance(p.eccentric,p.joint),output:distance(p.joint,p.rockerPivot),ground:distance(p.gear,p.rockerPivot)};
let inaccessible=0,maximumClosureDeficit=0;
for(let i=0;i<360;i++){
 const a=2*Math.PI*i/360,wrist=[p.gear[0]+lengths.input*Math.cos(a),p.gear[1]+lengths.input*Math.sin(a)],d=distance(wrist,p.rockerPivot);
 const deficit=Math.max(0,Math.abs(lengths.output-lengths.coupler)-d,d-lengths.output-lengths.coupler);
 if(deficit>0)inaccessible++;maximumClosureDeficit=Math.max(maximumClosureDeficit,deficit);
}
const file='public/engravings/mm_148.png';
const report={movement:148,status:'four-bar-interpretation-needs-review',landmarks:p,lengths,
 interpretation:'Treat the left small circular pin as an eccentric fixed to the gear, the upper pin as the coupler/rocker joint, and the right pin as the fixed rocker pivot. This is the existing model interpretation, not a verified reading of the oblong guide.',
 summary:{sampledInputAngles:360,inaccessibleInputAngles:inaccessible,maximumClosureDeficitPixels:maximumClosureDeficit},
 sources:[file,'scripts/measure-geared-crank.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('docs/validation/148-source-linkage.json',JSON.stringify(report,null,2)+'\n');console.log(report.summary);
