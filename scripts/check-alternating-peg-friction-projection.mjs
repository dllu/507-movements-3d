import fs from 'node:fs';import crypto from 'node:crypto';
import {solvePegFrictionProjection} from './lib/alternating-peg-dynamics-study.mjs';
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0),failures=[],modes={},errors={momentum:0,slack:0,complementarity:0,frictionBound:0,frictionLaw:0},cases=1000;
let seed=773011;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32;};
for(let i=0;i<cases;i++){
 const diagonal=Array.from({length:3},()=>.1+random()*50),inverse=diagonal.map((m,j)=>diagonal.map((_,k)=>j===k?1/m:0)),
  free=Array.from({length:3},()=>random()*4-2),feasible=Array.from({length:3},()=>random()*2-1),
  rows=Array.from({length:i%10},(_,j)=>({id:String(j),J:Array.from({length:3},()=>random()*2-1)})),
  b=rows.map(r=>dot(r.J,feasible)-random()*.4),bound=1+random()*100,result=solvePegFrictionProjection(inverse,free,rows,b,bound);
 if(!result){failures.push({case:i,reason:'manufactured-feasible-projection-failed',diagonal,free,rows,b,bound});continue;}
 modes[result.frictionMode]=(modes[result.frictionMode]||0)+1;
 for(let j=0;j<3;j++)errors.momentum=Math.max(errors.momentum,Math.abs(diagonal[j]*(result.v[j]-free[j])-rows.reduce((sum,row,k)=>sum+row.J[j]*result.impulses[k],0)-(j===0?result.frictionImpulse:0)));
 for(let j=0;j<rows.length;j++){
  const slack=dot(rows[j].J,result.v)-b[j],impulse=result.impulses[j];errors.slack=Math.max(errors.slack,-slack,-impulse);
  errors.complementarity=Math.max(errors.complementarity,Math.abs(slack*impulse));
 }
 errors.frictionBound=Math.max(errors.frictionBound,Math.abs(result.frictionImpulse)-bound);
 errors.frictionLaw=Math.max(errors.frictionLaw,Math.abs(result.frictionImpulse*result.v[0]+bound*Math.abs(result.v[0])));
}
const tolerances={momentum:1e-7,slack:1e-7,complementarity:1e-7,frictionBound:1e-7,frictionLaw:1e-7};
for(const[key,error]of Object.entries(errors))if(error>tolerances[key])failures.push({key,error,tolerance:tolerances[key]});
const files=['scripts/check-alternating-peg-friction-projection.mjs','scripts/lib/alternating-peg-dynamics-study.mjs','scripts/lib/jointed-tappet-dynamics-study.mjs'],
 report={movement:77,passed:failures.length===0,mechanicsPassed:false,productionChanged:false,cases,modes,errors,tolerances,failures,
 qualification:'Manufactured feasible velocity projections checked against the KKT conditions for a strictly convex kinetic projection plus Coulomb dissipation. These conditions establish each returned sampled projection as the global convex optimum; this does not validate time-discrete dynamics or a complete mechanism.',
 sources:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
const output='artifacts/review/077-friction-projection-check.json';fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log({output,passed:report.passed,modes,errors,failures:failures.length});if(failures.length)process.exitCode=1;
