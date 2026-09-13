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
  assert.ok(description.options.lowerSpring>0);assert.ok(v.root.getObjectByName('passive-lower-pawl-torsion-spring').visible);
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
 const counts={lower:{engaged:0,free:0},upper:{engaged:0,free:0}};
 let minNativeGap=0,minMuJoCoGap=0,minStrapGap=Infinity,maxPinError=0,maxLengthError=0,maxAngleStep=0;
 let previous=Array.from(data.qpos),poses=0;
 const started=performance.now();
 try{
  for(let step=0;step<120000;step++){
   v.physics.step();const q=Array.from(data.qpos);assert.ok(q.every(Number.isFinite));
   maxAngleStep=Math.max(maxAngleStep,...q.map((x,i)=>Math.abs(x-previous[i])));previous=q;
   if(step%200!==199)continue;
   v.sync();poses++;
   for(const name of ['lower','upper']){
    const body=bodies[name+'Pawl'],pivot=Array.from(data.xpos.slice(3*body,3*body+2)),q=data.xquat,angle=2*Math.atan2(q[4*body+3],q[4*body]);
    const gap=contact.pair(name,pivot,data.qpos[joints.wheel.q],angle,0).minimumGap;
    minNativeGap=Math.min(minNativeGap,gap);counts[name][gap<.001?'engaged':'free']++;
    const rodEnd=new THREE.Vector3(u.linkage.parameters.arms[name==='lower'?0:1].rodLength,0,0).applyMatrix4(u.blocks[name+'Rod'].matrixWorld);
    const arm=u.linkage.parameters.arms[name==='lower'?0:1],pin=new THREE.Vector3(...arm.rodLocal,0).applyMatrix4(u.blocks[name+'Treadle'].matrixWorld);
    maxPinError=Math.max(maxPinError,rodEnd.distanceTo(pin));
   }
   const contacts=data.contact;
   for(let i=0;i<contacts.size();i++){const c=contacts.get(i);minMuJoCoGap=Math.min(minMuJoCoGap,c.dist);c.delete();}contacts.delete();
   minStrapGap=Math.min(minStrapGap,strapClearance(u));maxLengthError=Math.max(maxLengthError,Math.abs(u.kinematics.cable.length-u.linkage.parameters.targetLength));
  }
  const report={poses,seconds:data.time,wallSeconds:(performance.now()-started)/1000,wheelTeeth:(data.qpos[joints.wheel.q]-.03)/(2*Math.PI/26),counts,
   minNativeGapPixels:minNativeGap*scale,minMuJoCoGapPixels:minMuJoCoGap*scale,minStrapGap,maxPinErrorPixels:maxPinError*scale,maxLengthErrorPixels:maxLengthError*scale,maxAngleStep};
  t.diagnostic(JSON.stringify(report));
  assert.ok(report.wheelTeeth>25,'wheel must advance through the repeated treadle strokes');
  for(const count of Object.values(counts)){assert.ok(count.engaged>20);assert.ok(count.free>20);}
  assert.ok(minNativeGap*scale>-.35,'rendered pawl penetrates a tooth visibly');
  assert.ok(minMuJoCoGap*scale>-.25,'contact solver penetration exceeds the pilot tolerance');
  assert.ok(minStrapGap>0,'finite rope clips the pulley');assert.ok(maxPinError*scale<.15,'rod pin separates from its eye');
  assert.ok(maxLengthError*scale<.1,'equalizer permits visible rope stretch');assert.ok(maxAngleStep<.03,'a passive part jumps');
  v.reset();assert.deepEqual(Array.from(data.qpos),initial,'Restart must reset the complete engine state');
 }finally{v.dispose();}
});
