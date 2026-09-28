// Movement 086 (pass 94): re-solve the loaded cycle without the hidden heel
// lug and wheel stop, so the displayed catch is never held by an invisible
// part. After the trip the catch swings free on its pin (gravity with the
// study's hidden head weighting, and the study's pin damping), lands on cam C
// near the bottom of the return, is lifted by C's back and is picked up by C's
// point. Every other parameter is the qualified study's.
//
//   node scripts/generate-pump-catch-cam-rest.mjs          rewrite the profile
//   node scripts/generate-pump-catch-cam-rest.mjs --check  verify it is current
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makePumpCatchCompleteCandidate} from './lib/pump-catch-complete-candidate.mjs';
import {makePumpCatchBoundsContact} from './lib/pump-catch-bounds-contact.mjs';
import {makePumpCatchSlackDynamics,pumpCatchImpactStep} from './lib/pump-catch-impact-dynamics.mjs';
import {makePumpCatchPrimaryBounds} from './lib/pump-catch-primary-bounds.mjs';
import {makePumpCatchLiveCandidate} from './lib/pump-catch-live-rope.mjs';
import {indexPumpCatchHardware} from './lib/pump-catch-indexed-hardware.mjs';
import {pumpCatchCompleteSources} from './lib/pump-catch-complete-sources.mjs';
import {hashStudyFile} from './lib/study-report-io.mjs';
import * as THREE from 'three';

const output='src/data/pump-catch-profile.js',check=process.argv.includes('--check'),
  step=.00025,period=8,start=.5,duration=start+2*period+.25,angularSpeed=-2*Math.PI/period,pixelTolerance=.002,
  settings={loadMass:1,drag:0,hubDrag:1.5,hingeDrag:.2,pumpDrag:12,pumpStopHeight:0,inputAngularSpeed:angularSpeed};

// The qualified candidate with its heel lug and wheel stop removed. The 0.1
// head backing stays as a hidden mass assumption (it is not displayed).
function heelFreeCandidate(){
  const model=makePumpCatchCompleteCandidate(),u=model.root.userData;
  for(const name of ['catchHeelLug','wheelHeelStop']){u.parts[name].removeFromParent();u.parts[name].geometry.dispose();delete u.parts[name];delete u.families[name];}
  delete u.heelStop;u.candidateOptions={headBackDepth:u.geometry.headBackDepth};return model;
}
const model=heelFreeCandidate(),u=model.root.userData,contact=makePumpCatchBoundsContact(model),dynamics=makePumpCatchSlackDynamics(model,settings);
const rows=[{time:0,q:[0,0,0],v:[0,0,0],active:[],slack:0}];let failure=null,subdivisions=0;
function advance(target,depth=0){
  const before=rows.at(-1),result=pumpCatchImpactStep(dynamics,contact,before,target,target-before.time,angularSpeed);
  if(result.failed){if(depth===8){failure=result;return false;}subdivisions++;const middle=(before.time+target)/2;return advance(middle,depth+1)&&advance(target,depth+1);}
  rows.push({time:result.time,q:result.q,v:result.v,active:[...new Set(result.active.map(c=>c.kind))].sort()});return true;
}
for(let i=1;i<=Math.round(duration/step);i++)if(!advance(i*step))break;
assert(!failure,'Heel-free integration failed: '+failure?.failed);
const indexAt=time=>{const i=rows.findIndex(r=>Math.abs(r.time-time)<1e-9);assert(i>=0,'Missing knot '+time);return i;};

// Two further revolutions must repeat the first settled one and lift fully.
const repeat={start,period,coordinateError:0,velocityError:0,rawCoordinateError:0,rawVelocityError:0,maximumTimeSnap:0},lifts=[0,0];
for(let i=indexAt(start);i<=indexAt(start+period);i++){
  const a=rows[i],b=rows[i+Math.round(period/step)];assert(Math.abs(b.time-a.time-period)<1e-9);
  for(let k=0;k<3;k++){repeat.coordinateError=Math.max(repeat.coordinateError,Math.abs(a.q[k]-b.q[k]));repeat.velocityError=Math.max(repeat.velocityError,Math.abs(a.v[k]-b.v[k]));}
}
repeat.rawCoordinateError=repeat.coordinateError;repeat.rawVelocityError=repeat.velocityError;
for(const r of rows){const c=Math.floor(Math.max(0,r.time-start)/period);if(c<2)lifts[c]=Math.max(lifts[c],r.q[2]);}
assert(repeat.coordinateError<1e-8&&repeat.velocityError<1e-8,'The heel-free cycle does not repeat');
assert(lifts.every(l=>l>2.59),'Every revolution must lift the pump: '+lifts);

// Compress 0..8.5 s to linear spans within 0.002 engraving pixels whose swept
// catch/cam/shaft/stop prisms are certified clear (as the qualified export).
const bounds=makePumpCatchPrimaryBounds(model),radii={wheel:0,catch:0,pivot:Math.hypot(...u.geometry.pivot)};
for(const[name,mesh]of Object.entries(u.parts))if(['wheel','catch'].includes(u.families[name])){
  const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)radii[u.families[name]]=Math.max(radii[u.families[name]],Math.hypot(p.getX(i)+mesh.position.x,p.getY(i)+mesh.position.y));
}
const source=rows.slice(0,indexAt(start+period)+1),error=(a,b)=>{const d=a.map((v,k)=>Math.abs(v-b[k]));return u.source.scale*Math.max(radii.wheel*d[0],radii.pivot*d[0]+radii.catch*d[1],d[2]);};
const kept=new Set([0,source.length-1,indexAt(start)]),stack=[],seeds=[...kept].sort((a,b)=>a-b);let certified=0,geometrySplits=0;
for(let i=1;i<seeds.length;i++)stack.push([seeds[i-1],seeds[i]]);
while(stack.length){
  const[lo,hi]=stack.pop(),a=source[lo],b=source[hi];let maximum=0,worst=-1;
  for(let i=lo+1;i<hi;i++){const f=(source[i].time-a.time)/(b.time-a.time),e=error(source[i].q,a.q.map((v,k)=>v+f*(b.q[k]-v)));if(e>maximum){maximum=e;worst=i;}}
  if(maximum>pixelTolerance){kept.add(worst);stack.push([lo,worst],[worst,hi]);continue;}
  const result=bounds.interval(a,b,angularSpeed);
  if(!result.passed){assert(hi>lo+1,'Uncertifiable single step at '+a.time);const middle=(lo+hi)>>1;kept.add(middle);geometrySplits++;stack.push([lo,middle],[middle,hi]);continue;}
  certified++;
}
const profileRows=[...kept].sort((a,b)=>a-b).map(i=>({time:source[i].time,q:source[i].q}));
assert.equal(certified,profileRows.length-1);

// Motion bounds: the swept production parts (live rope included) over the
// stored knots and midpoints, padded as before.
const live=makePumpCatchLiveCandidate();indexPumpCatchHardware(live);
for(const name of ['catchHeelLug','wheelHeelStop'])if(live.root.userData.parts[name]){live.root.userData.parts[name].removeFromParent();delete live.root.userData.parts[name];}
const box=new THREE.Box3();
for(let i=0;i<profileRows.length;i++)for(const f of i?[.5,1]:[1]){
  const a=profileRows[Math.max(0,i-1)],b=profileRows[i],time=a.time+f*(b.time-a.time),q=a.q.map((v,k)=>v+f*(b.q[k]-v));
  live.setState({wheelAngle:q[0],catchAngle:q[1]-q[0],camAngle:angularSpeed*time,pumpHeight:q[2]});
  for(const mesh of Object.values(live.root.userData.parts))box.union(new THREE.Box3().setFromObject(mesh,true));
}
const motionBounds={min:box.min.toArray().map(v=>v-1e-6),max:box.max.toArray().map(v=>v+1e-6)};

const provenance=['scripts/generate-pump-catch-cam-rest.mjs','scripts/lib/pump-catch-bounds-contact.mjs','scripts/lib/pump-catch-impact-dynamics.mjs',
  'scripts/lib/pump-catch-slack-dynamics.mjs','scripts/lib/pump-catch-primary-bounds.mjs',...pumpCatchCompleteSources].filter((f,i,a)=>a.indexOf(f)===i&&f!=='src/simulation/primitives.js')
  .map(file=>({file,sha256:hashStudyFile(file)}));
const profile={rows:profileRows,repeat,angularSpeed,
  parameters:{...dynamics.parameters,candidateOptions:u.candidateOptions,completeHardware:u.completeHardware,
    heelStop:false,catchRest:'No heel stop: after the trip the catch swings free on its damped pin and comes to rest on cam C.'},
  displayPeriod:4,motionBounds,provenance,
  study:{step,duration,subdivisions,solverStates:rows.length,states:profileRows.length,pixelTolerance,geometrySplits,lifts,
    catchCamContactSeconds:rows.filter(r=>r.time>=start&&r.time<start+period&&r.active.includes('cam')).length*step}};
const text='// Generated by scripts/generate-pump-catch-cam-rest.mjs: heel-free finite-contact re-solve of the qualified study.\nexport default '+JSON.stringify(profile)+';\n';
if(check){assert.equal(fs.readFileSync(output,'utf8'),text,output+' is stale; rerun the generator');console.log('pump-catch profile current');}
else{fs.writeFileSync(output,text);console.log({states:profileRows.length,solverStates:rows.length,subdivisions,geometrySplits,lifts,repeat,motionBounds,camSeconds:profile.study.catchCamContactSeconds});}
