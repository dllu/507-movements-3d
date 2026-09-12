import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectClutchKeyFriction} from './lib/weighted-clutch-key-friction.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-key-friction-projector',
 sources=freezeStudySources(['scripts/lib/weighted-clutch-seating-contact.mjs','scripts/lib/weighted-clutch-key-friction.mjs',
  'scripts/check-weighted-clutch-key-friction.mjs'],prefix),rows=[];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
function check(name,free,mass,contacts,options,expected){
 const p=projectClutchKeyFriction(free,mass,contacts,options),momentum=free.map((v,k)=>mass[k]*(p.v[k]-v)-
  p.active.reduce((s,c)=>s+c.impulse*c.gradient[k]+c.tangentImpulse*(c.tangent?.[k]??0),0)),
  residual=Math.max(...momentum.map(Math.abs)),error=Math.max(...p.v.map((v,k)=>Math.abs(v-expected[k])));
 rows.push({name,free,mass,contacts,options,expected,result:p,residual,error});
 assert(error<1e-9,name);assert(residual<1e-10,name);assert(Math.abs(p.impulseEnergyResidual)<1e-10,name);
 assert(p.loss>=-1e-12&&p.frictionWork<=1e-12,name);
 for(const c of contacts)assert(dot(c.gradient,p.v)>=c.target-1e-10,name);
}
const key={kind:'key',friction:'axial-key',gradient:[1,0,0],tangent:[0,0,1],target:0},
 options={staticCoefficient:.78,kineticCoefficient:.42};
try{
 check('static load',[-1,0,.6],[1,1,1],[key],options,[0,0,0]);
 check('breakaway',[-1,0,1],[1,1,1],[key],options,[0,0,.58]);
 check('continue positive slide',[-1,0,.6],[1,1,1],[key],{...options,previousSlip:.6},[0,0,.18]);
 check('continue negative slide',[-1,0,-.6],[1,1,1],[key],{...options,previousSlip:-.6},[0,0,-.18]);
 check('sliding arrest',[-1,0,.2],[1,1,1],[key],{...options,previousSlip:.2},[0,0,0]);
 check('zero normal means zero friction',[0,0,.6],[1,1,1],[key],options,[0,0,.6]);
 check('separating contact',[.2,0,.6],[1,1,1],[key],options,[.2,0,.6]);
 check('moving wall and unequal masses',[-1,0,.4],[2,1,3],[{...key,target:.25}],options,[.25,0,0]);
 // An inclined wedge changes the key reaction when its tangential force acts.
 // Jn=[1,0,-.5], T=[0,0,1]: sliding solution lambda=1.5/(1.25+.5*.42).
 const lambda=1.5/1.46;
 check('coupled normal and tangent',[-1,0,1],[1,1,1],[{...key,gradient:[1,0,-.5]}],
  {...options,previousSlip:1},[-1+lambda,0,1-.92*lambda]);
 // Static friction can be redundant with a normal wall. Its feasible load
 // interval must still be found when the augmented stick matrix is singular.
 check('redundant static tangent',[-1,0,-.4],[1,1,1],[key,{kind:'axial-wall',gradient:[0,0,1],target:0}],options,[0,0,0]);
 check('frictionless limit',[-1,0,.6],[1,1,1],[key],{staticCoefficient:0,kineticCoefficient:0},[0,0,.6]);
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,passed:true,rows})+'\n',{flag:'wx'});
 console.log({cases:rows.length,maxVelocityError:Math.max(...rows.map(r=>r.error)),maxMomentumResidual:Math.max(...rows.map(r=>r.residual))});
}catch(error){fs.writeFileSync(prefix+'-failed.json',JSON.stringify({sources,passed:false,rows,error:error.stack})+'\n',{flag:'wx'});throw error;}
