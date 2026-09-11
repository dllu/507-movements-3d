import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeCrossedRackCandidate} from './lib/crossed-rack-candidate.mjs';
import {makeCrossedRackDynamics} from './lib/crossed-rack-dynamics-study.mjs';
import {makeCrossedRackTriangleBounds} from './lib/crossed-rack-triangle-bounds.mjs';
const input=process.env.PROBE_INPUT??'artifacts/review/080-fixed-normal-finest-dynamics.json',prefix=process.env.PROBE_PREFIX??'artifacts/review/080-finite-playback',
 data=JSON.parse(fs.readFileSync(input)),model=makeCrossedRackCandidate(data.geometry),u=model.root.userData,physics=makeCrossedRackDynamics(model,data.parameters),
 tolerance=1e-6,pixelTolerance=.001,bounds=makeCrossedRackTriangleBounds(model,physics,{tolerance}),radii=[1,0,0],familyRadii={fixed:0,rack:0,lever:0,left:0,right:0},
 sources=['scripts/prepare-crossed-rack-playback.mjs','scripts/lib/crossed-rack-candidate.mjs','scripts/lib/crossed-rack-source.mjs',
 'scripts/lib/crossed-rack-dynamics-study.mjs','scripts/lib/crossed-rack-contact-study.mjs','scripts/lib/crossed-rack-triangle-bounds.mjs',
 'scripts/lib/crossed-rack-mesh-prisms.mjs','scripts/lib/pull-pawl-triangle-bounds.mjs',input].map((file,i)=>{
  const archive=prefix+'-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
  return{file,archive,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
 });
assert.equal(data.failures.length,0);assert.equal(data.rows.length,Math.round(data.duration/data.dt)+1);
for(const [name,mesh]of Object.entries(u.parts)){
 const p=mesh.geometry.attributes.position,family=u.families[name];
 for(let i=0;i<p.count;i++)familyRadii[family]=Math.max(familyRadii[family],Math.hypot(p.getX(i)+mesh.position.x,p.getY(i)+mesh.position.y));
}
radii[1]=familyRadii.left;radii[2]=familyRadii.right;
const selected=[0],accepted=[],evaluation=new Map(),at=i=>{if(!evaluation.has(i))evaluation.set(i,bounds.evaluate(data.rows[i]));return evaluation.get(i);};
let rejectedCompressionIntervals=0,largestAcceptedError=0,maximumProofDepth=0,acceptedProofIntervals=0;
const certify=(a,b,depth=0)=>{
 const r=bounds.check(a,b);if(r.okay)return{leaves:1,depth};
 if(depth>=14||r.witness.midpointSeparation< -tolerance)return null;
 const left=certify(a,r.middle,depth+1);if(!left)return null;
 const right=certify(r.middle,b,depth+1);if(!right)return null;
 return{leaves:left.leaves+right.leaves,depth:Math.max(left.depth,right.depth)};
};
const simplify=(low,high)=>{
 const a=data.rows[low],b=data.rows[high];let error=0,split=(low+high)>>1;
 for(let i=low+1;i<high;i++){
  const row=data.rows[i],f=(row.time-a.time)/(b.time-a.time),e=Math.max(...row.x.map((v,j)=>Math.abs(v-a.x[j]-f*(b.x[j]-a.x[j]))*radii[j]*u.geometry.scale));
  if(e>error){error=e;split=i;}
 }
 if(error<=pixelTolerance){
  const proof=certify(at(low),at(high));
  if(proof){selected.push(high);accepted.push({low,high,error,...proof});largestAcceptedError=Math.max(largestAcceptedError,error);
   acceptedProofIntervals+=proof.leaves;maximumProofDepth=Math.max(maximumProofDepth,proof.depth);return;}
  rejectedCompressionIntervals++;
 }
 assert(high-low>1,'Original interpolation interval must pass complete primary bounds: '+low);
 simplify(low,split);simplify(split,high);
};
// Retain the two original knots bracketing the drive stop. This separates
// the moving input from its held segment and keeps the camera curvature
// allowance tight without inventing a new pose or changing the clock.
const stopIndex=data.parameters.stopAt===null?-1:data.rows.findIndex(r=>r.time>=data.parameters.stopAt),
 forced=Array.from(new Set([0,...(stopIndex>0?[stopIndex-1,stopIndex]:[]),data.rows.length-1])).sort((a,b)=>a-b);
for(let i=1;i<forced.length;i++)simplify(forced[i-1],forced[i]);
// Every rendered vertex is bounded by its endpoint boxes and the analytic
// pivot/rotation chord error. Rack translation is linear in this profile.
const motionBox=new THREE.Box3();let motionPadding=0;
for(let i=0;i<selected.length;i++){
 const row=data.rows[selected[i]],q=physics.input(row.time).q;u.setState({q,rackY:row.x[0],leftAngle:row.x[1],rightAngle:row.x[2]});motionBox.union(new THREE.Box3().setFromObject(model.root));
 if(i===0)continue;const previous=data.rows[selected[i-1]],h=row.time-previous.time,
  K=data.parameters.stopAt!==null&&previous.time>=data.parameters.stopAt?0:(data.parameters.amplitude*data.parameters.omega**2+(data.parameters.amplitude*data.parameters.omega)**2)*h*h;
 motionPadding=Math.max(motionPadding,familyRadii.lever*K/8);
 for(const [j,key]of ['left','right'].entries())motionPadding=Math.max(motionPadding,
  (Math.hypot(...u.geometry.anchors[key])*K+familyRadii[key]*(row.x[j+1]-previous.x[j+1])**2)/8);
}
motionBox.expandByScalar(motionPadding+1e-12);u.setState();
const profile={movement:80,geometry:data.geometry,physics:data.parameters,physicsDuration:data.duration,physicsPeriod:data.parameters.period,
 playbackPeriod:4,playbackDuration:4*data.duration/data.parameters.period,inputStopTime:data.parameters.stopAt,
 rows:selected.map(i=>[data.rows[i].time,...data.rows[i].x]),motionBounds:{min:motionBox.min.toArray(),max:motionBox.max.toArray()},
 qualification:'Finite whole-rack travel. Linear free coordinates and analytic lever input are continuously bounded. Input holds at a zero-speed reversal; playback clamps at its final pose and requires explicit replay. Startup and physical handoff rollback are retained.'};
fs.writeFileSync(prefix+'-profile.json',JSON.stringify(profile)+'\n',{flag:'wx'});
const report={movement:80,status:'finite-playback-compression-and-primary-bounds',productionChanged:false,mechanicsPassed:false,passed:true,
 originalKnots:data.rows.length,selectedKnots:selected.length,selectedIndices:selected,forcedIndices:forced,pixelTolerance,largestAcceptedError,radii,
 tolerance,rejectedCompressionIntervals,maximumProofDepth,acceptedProofIntervals,accepted,stats:bounds.stats,
 motionBounds:profile.motionBounds,motionPadding,playbackPeriod:profile.playbackPeriod,playbackDuration:profile.playbackDuration,
 profile:{file:prefix+'-profile.json',sha256:crypto.createHash('sha256').update(fs.readFileSync(prefix+'-profile.json')).digest('hex')},sources,
 qualification:'All discarded original knots are checked against their proposed chord using actual pawl radii and rack displacement at the source scale. Because both free-coordinate curves are linear between the union knots, their entire difference is bounded. Every accepted segment also passes actual-mesh continuous primary triangle separation. Segments that fail compression clearance are split at original knots; no coordinate is projected or physically altered. Display duration is a proposed setting pending rendered playback review.'};
fs.writeFileSync(prefix+'-preparation.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({originalKnots:data.rows.length,selectedKnots:selected.length,largestAcceptedError,rejectedCompressionIntervals,
 maximumProofDepth,acceptedProofIntervals,motionPadding,playbackDuration:profile.playbackDuration});
