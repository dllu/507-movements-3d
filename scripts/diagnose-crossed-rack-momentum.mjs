import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeCrossedRackCandidate} from './lib/crossed-rack-candidate.mjs';
import {makeCrossedRackDynamics,advanceCrossedRackStep} from './lib/crossed-rack-dynamics-study.mjs';
import {renderedPrism,boundaryCone} from './lib/crossed-rack-mesh-prisms.mjs';
import {rotate,sub} from '../src/simulation/finite-plate-geometry.js';
const input=process.env.PROBE_INPUT??'artifacts/review/080-amplitude016-finest-dynamics.json',prefix=process.env.PROBE_PREFIX??'artifacts/review/080-finest-momentum-diagnostic',
 data=JSON.parse(fs.readFileSync(input)),candidate=makeCrossedRackCandidate(data.geometry),u=candidate.root.userData,
 physics=makeCrossedRackDynamics(candidate,data.parameters),prisms=Object.fromEntries(['rack','left','right'].map(k=>[k,renderedPrism(u.parts[k==='rack'?'slottedRack':k+'HookWeb'].geometry)])),
 sources=['scripts/diagnose-crossed-rack-momentum.mjs','scripts/lib/crossed-rack-mesh-prisms.mjs','scripts/lib/crossed-rack-dynamics-study.mjs',
 'scripts/lib/crossed-rack-contact-study.mjs','scripts/lib/crossed-rack-candidate.mjs','scripts/lib/crossed-rack-source.mjs','scripts/lib/alternating-peg-dynamics-study.mjs',
 'scripts/lib/jointed-tappet-dynamics-study.mjs',input].map((file,i)=>{const archive=prefix+'-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
  return{file,archive,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};}),events=[];
const residual=(before,after,F,contacts)=>Math.max(...[0,1,2].map(j=>Math.abs(physics.parameters.inertia[j]*(after.v[j]-before.v[j])+data.dt*physics.parameters.damping[j]*after.v[j]-data.dt*F[j]-contacts.reduce((s,r)=>s+r.impulse*r.J[j],0))));
let maximumReconstructed=0,maximumExact=0,maximumCone=0,maximumBoundary=0;
for(let i=1;i<data.rows.length;i++){
 const before=data.rows[i-1],after=data.rows[i],rows=new Map(physics.constraints(after.x,after.time).rows.map(r=>[r.id,r])),
  contacts=after.contacts.map(r=>({...rows.get(r.id),impulse:r.impulse})),error=residual(before,after,physics.forces(after.x,after.time),contacts);
 maximumReconstructed=Math.max(maximumReconstructed,error);if(error<=1e-7)continue;
 const calls=[],forces=[],wrapped={...physics,constraints:(x,t,...args)=>{const result=physics.constraints(x,t,...args);calls.push({x:[...x],time:t,result});return result;},
  forces:(x,t)=>{const result=physics.forces(x,t);forces.push(result);return result;}},replay=advanceCrossedRackStep(wrapped,before,data.dt);
 assert(replay.okay);assert.deepEqual(replay.state.x,after.x);assert.deepEqual(replay.state.v,after.v);
 // JSON omits the generic stepper's unused `pin: undefined` property.
 assert.deepEqual(JSON.parse(JSON.stringify(replay.diagnostic.contacts)),after.contacts);
 const actualMap=new Map(calls.at(-2).result.rows.map(r=>[r.id,r])),actual=after.contacts.map(r=>({...actualMap.get(r.id),impulse:r.impulse})),
  exact=residual(before,after,forces.at(-1),actual),k=physics.input(after.time),details=[];
 for(const r of actual){
  const coordinate=r.key==='left'?1:2,alpha=calls.at(-2).x[coordinate],P=k.pawls[r.key].pivot,
   R=[r.rackPoint[0],r.rackPoint[1]-calls.at(-2).x[0]],H=rotate(sub(r.pawlPoint,P),-alpha),
   rc=boundaryCone(prisms.rack,R,r.normal),hc=boundaryCone(prisms[r.key],H,rotate(r.normal.map(v=>-v),-alpha)),
   final=rows.get(r.id),normalChange=Math.hypot(...sub(r.normal,final.normal));
  maximumCone=Math.max(maximumCone,rc.residual,hc.residual);maximumBoundary=Math.max(maximumBoundary,rc.distance,hc.distance);
  details.push({id:r.id,impulse:r.impulse,normal:r.normal,reconstructedNormal:final.normal,normalChange,rack:rc,pawl:hc});
 }
 maximumExact=Math.max(maximumExact,exact);events.push({index:i,time:after.time,reconstructedResidual:error,exactResidual:exact,
  finalIterationChange:Math.max(...after.x.map((v,j)=>Math.abs(v-calls.at(-2).x[j]))),details});
 if(events.length<=8)console.log(events.at(-1));
}
const report={movement:80,status:'saved-pose-versus-exact-solver-reaction-diagnostic',productionChanged:false,mechanicsPassed:false,
 eventThreshold:1e-7,events,maximumReconstructed,maximumExact,maximumCone,maximumBoundary,sources,
 qualification:'Every saved step exceeding the momentum residual limit is replayed from its exact archived predecessor. State, velocities and impulse diagnostics must be bit-identical. The last solver constraint evaluation and force evaluation are retained before the final pose check, then tested for momentum balance and actual surface normal cones.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({events:events.length,maximumReconstructed,maximumExact,maximumCone,maximumBoundary});
