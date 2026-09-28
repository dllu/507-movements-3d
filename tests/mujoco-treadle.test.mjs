import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import * as THREE from 'three';
import {makeMujocoTreadle} from '../src/simulation/mujoco-treadle/visual.js';
import {makeTreadleRatchetContact} from '../scripts/lib/treadle-ratchet-contact.mjs';

const mujoco=await loadMujoco();
const distanceToSegment=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy,t=L?Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/L)):0;return Math.hypot(a[0]+t*dx,a[1]+t*dy);};

// Check the actual finite-width strap triangles against a cylinder enclosing
// the pulley, including chord sag between wrap vertices.
function strapClearance(u){
 const g=u.parts.strap.geometry,p=g.attributes.position,index=g.index,center=u.linkage.parameters.pulley;
 let minimum=Infinity;
 for(let i=0;i<index.count;i+=3){const tri=[0,1,2].map(j=>{const k=index.getX(i+j);return [p.getY(k)-center[1],p.getZ(k)];});
  const area=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),winding=tri.map((a,j)=>area(a,tri[(j+1)%3],[0,0]));
  if(Math.abs(area(...tri))>1e-14&&(winding.every(v=>v>0)||winding.every(v=>v<0)))return -u.geometry.pulleyRadius;
  for(let j=0;j<3;j++)minimum=Math.min(minimum,distanceToSegment(tri[j],tri[(j+1)%3]));
 }return minimum-u.geometry.pulleyRadius;
}

test('082 MuJoCo drives only the treadle and preserves the working tooth and pawl outlines',()=>{
 const v=makeMujocoTreadle(mujoco);try {
  const {model,description,joints}=v.physics;
  assert.equal(model.nu,1);assert.equal(model.actuator_trnid[0],mujoco.mj_name2id(model,mujoco.mjtObj.mjOBJ_JOINT.value,'lowerTreadle'));
  assert.ok(description.options.lowerSpring>0);
  // The inferred torsion springs act in physics only; Brown draws none, so none is rendered.
  let springMeshes=0;v.root.traverse(o=>{if(/spring/i.test(o.name))springMeshes++;});assert.equal(springMeshes,0);
  for(const [name,shape]of Object.entries(description.collision)){
   assert.ok(shape.maximumBoundaryError*v.root.userData.geometry.source.scale<.15,name+' collision silhouette is too coarse');
   for(const cell of shape.cells)for(let i=0;i<cell.length;i++){
    const a=cell[i],b=cell[(i+1)%cell.length],c=cell[(i+2)%cell.length];assert.ok((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])>=-1e-12);
   }
  }
  assert.ok(description.equalizer.maximumError<1e-8);
  assert.ok(joints.lowerPawl&&joints.upperPawl&&joints.wheel);
  v.update(.5);const state=Array.from(v.physics.data.qpos);v.update(.5);assert.deepEqual(Array.from(v.physics.data.qpos),state);
  v.update(0);v.update(.5);assert.deepEqual(Array.from(v.physics.data.qpos),state,'seeking must reset and integrate deterministically');
 }finally{v.dispose();}
});

test('082 passive pawls engage and release through fifteen cycles with clear rope and closed pins',t=>{
 const v=makeMujocoTreadle(mujoco),u=v.root.userData,{data,model,bodies,joints}=v.physics,contact=makeTreadleRatchetContact(v);
 const initial=Array.from(data.qpos),scale=u.geometry.source.scale;
 const counts={lower:{engaged:0,free:0,seated:0,riding:0},upper:{engaged:0,free:0,seated:0,riding:0}},g=u.geometry,
  valley=g.source.ratchet.tipPhase+(1-g.options.shortFaceFraction)*g.pitch,wheelAt=[];
 let worstHoldPixels=0;
 let minNativeGap=0,minMuJoCoGap=0,minStrapGap=Infinity,maxPinError=0,maxLengthError=0,maxAngleStep=0;
 let previous=Array.from(data.qpos),poses=0;
 const started=performance.now();
 try{
  for(let step=0;step<120000;step++){
   v.physics.step();const q=Array.from(data.qpos);assert.ok(q.every(Number.isFinite));
   maxAngleStep=Math.max(maxAngleStep,...q.map((x,i)=>Math.abs(x-previous[i])));previous=q;
   if(step%200!==199)continue;
   v.sync();poses++;let hold;if(poses%40===0)wheelAt.push(data.qpos[joints.wheel.q]);
   for(const name of ['lower','upper']){
    const body=bodies[name+'Pawl'],pivot=Array.from(data.xpos.slice(3*body,3*body+2)),q=data.xquat,angle=2*Math.atan2(q[4*body+3],q[4*body]);
    const gap=contact.pair(name,pivot,data.qpos[joints.wheel.q],angle,0).minimumGap;
    minNativeGap=Math.min(minNativeGap,gap);counts[name][gap<.001?'engaged':'free']++;
    // Distance from the pawl's nose to the nearest root of the wheel.
    const n=g.pawlNoses[name],nose=[pivot[0]+n[0]*Math.cos(angle)-n[1]*Math.sin(angle),pivot[1]+n[0]*Math.sin(angle)+n[1]*Math.cos(angle)],
     w=data.qpos[joints.wheel.q],k=Math.round((Math.atan2(nose[1],nose[0])-w-valley)/g.pitch),r=w+valley+k*g.pitch;
    (hold??=[]).push(Math.hypot(nose[0]-g.rootRadius*Math.cos(r),nose[1]-g.rootRadius*Math.sin(r))*scale);
    if(gap<.001)counts[name][hold.at(-1)<.5?'seated':hold.at(-1)>5?'riding':'between']=(counts[name][hold.at(-1)<.5?'seated':hold.at(-1)>5?'riding':'between']??0)+1;
    const rodEnd=new THREE.Vector3(u.linkage.parameters.arms[name==='lower'?0:1].rodLength,0,0).applyMatrix4(u.blocks[name+'Rod'].matrixWorld);
    const arm=u.linkage.parameters.arms[name==='lower'?0:1],pin=new THREE.Vector3(...arm.rodLocal,0).applyMatrix4(u.blocks[name+'Treadle'].matrixWorld);
    maxPinError=Math.max(maxPinError,rodEnd.distanceTo(pin));
   }
   // One pawl always holds the loaded wheel with its nose in a root.
   if(data.time>8)worstHoldPixels=Math.max(worstHoldPixels,Math.min(...hold));
   const contacts=data.contact;
   for(let i=0;i<contacts.size();i++){const c=contacts.get(i);minMuJoCoGap=Math.min(minMuJoCoGap,c.dist);c.delete();}contacts.delete();
   minStrapGap=Math.min(minStrapGap,strapClearance(u));maxLengthError=Math.max(maxLengthError,Math.abs(u.kinematics.cable.length-u.linkage.parameters.targetLength));
  }
  const report={poses,seconds:data.time,wallSeconds:(performance.now()-started)/1000,wheelTeeth:(data.qpos[joints.wheel.q]-.03)/(2*Math.PI/26),counts,
   minNativeGapPixels:minNativeGap*scale,minMuJoCoGapPixels:minMuJoCoGap*scale,minStrapGap,maxPinErrorPixels:maxPinError*scale,maxLengthErrorPixels:maxLengthError*scale,maxAngleStep,worstHoldPixels,
   teethPerCycle:wheelAt.slice(1).map((x,i)=>(x-wheelAt[i])/g.pitch)};
  t.diagnostic(JSON.stringify(report));
  assert.ok(report.wheelTeeth>25,'wheel must advance through the repeated treadle strokes');
  // The springs keep both pawls on the teeth: each is seated in a root while
  // it drives and holds, and rides the ramps while it returns.
  for(const count of Object.values(counts)){assert.ok(count.seated>150,'pawl must seat in a root');assert.ok(count.riding>150,'pawl must ride back over the teeth');}
  assert.ok(worstHoldPixels<1.5,'a pawl must hold the wheel from its root');
  for(const teeth of report.teethPerCycle.slice(2))assert.ok(Math.abs(teeth-2)<.01,'each treadle cycle advances exactly two teeth');
  assert.ok(minNativeGap*scale>-.35,'rendered pawl penetrates a tooth visibly');
  assert.ok(minMuJoCoGap*scale>-.25,'contact solver penetration exceeds the pilot tolerance');
  assert.ok(minStrapGap>0,'finite rope clips the pulley');assert.ok(maxPinError*scale<.15,'rod pin separates from its eye');
  assert.ok(maxLengthError*scale<.1,'equalizer permits visible rope stretch');assert.ok(maxAngleStep<.03,'a passive part jumps');
  v.reset();assert.deepEqual(Array.from(data.qpos),initial,'Restart must reset the complete engine state');
 }finally{v.dispose();}
});

test('082 pawls are one identical plate on equal pivot radii, seated in a root at the source pose',()=>{
 const v=makeMujocoTreadle(mujoco);try {
  const u=v.root.userData,arms=u.linkage.parameters.arms,initial=u.linkage.atTime(0).arms,g=u.geometry;
  assert.equal(arms[0].pawlLocal[0],arms[1].pawlLocal[0]);assert.equal(arms[0].pawlLocal[1],0);
  const turn=initial[0].armAngle-initial[1].armAngle,rot=(q,a)=>[q[0]*Math.cos(a)-q[1]*Math.sin(a),q[0]*Math.sin(a)+q[1]*Math.cos(a)];
  const [lower,upper]=['lower','upper'].map(name=>u.profiles[name+'Pawl']);
  assert.equal(lower.length,1,'one connected plate');assert.equal(lower[0].length,2,'one bore and no other holes');
  const outer=upper[0][0],turned=outer.map(q=>rot(q,turn));
  // Every vertex of the turned upper outline lies on the lower outline.
  for(const q of turned)assert.ok(Math.min(...lower[0][0].map(p=>Math.hypot(p[0]-q[0],p[1]-q[1])))<1e-9);
  assert.ok(Math.hypot(...rot(g.pawlNoses.upper,turn).map((x,i)=>x-g.pawlNoses.lower[i]))<1e-12);
  const {lowerSpring,upperSpring,load}=v.physics.description.options;assert.equal(lowerSpring,upperSpring);assert.ok(load>0);
  // The nose is the drawn root radius and the end face runs up the steep face.
  for(const [i,name] of ['lower','upper'].entries()){
   const n=g.pawlNoses[name],nose=[initial[i].pawlPivot[0]+n[0],initial[i].pawlPivot[1]+n[1]];
   assert.ok(Math.abs(Math.hypot(...nose)-g.rootRadius)<1e-12);
  }
 }finally{v.dispose();}
});
