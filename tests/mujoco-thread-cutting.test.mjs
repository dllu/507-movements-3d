import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoThreadCutting} from '../src/simulation/mujoco-thread-cutting/visual.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
const mujoco=await loadMujoco();
// Independently integrate the circular blank minus a helical groove. The
// clipped groove width is a difference of four ramps in its center height.
function circularWorkpieceVolume(p, cutAngle) {
 const height=p.high-p.low,center=Math.max(p.low-p.width/2,Math.min(p.high+p.width/2,p.phase+p.lead*cutAngle));
 const square=x=>Math.max(0,x)**2;
 const integral=(square(center+p.width/2-p.low)-square(center-p.width/2-p.low)-square(center+p.width/2-p.high)+square(center-p.width/2-p.high))/2;
 return Math.PI*p.outer*p.outer*height-(p.outer*p.outer-p.inner*p.inner)/2/p.lead*(p.width*height-integral);
}
function assertNoBuriedFlanks(g,p,cutAngle) {
 const position=g.attributes.position,normal=g.attributes.normal;
 for(let i=0;i<position.count;i+=3) {
  const x=(position.getX(i)+position.getX(i+1)+position.getX(i+2))/3;
  const y=(position.getY(i)+position.getY(i+1)+position.getY(i+2))/3;
  const z=(position.getZ(i)+position.getZ(i+1)+position.getZ(i+2))/3;
  const nz=(normal.getZ(i)+normal.getZ(i+1)+normal.getZ(i+2))/3;
  if(Math.abs(nz)<.5||Math.abs(z-p.low)<1e-6||Math.abs(z-p.high)<1e-6)continue;
  const theta=Math.atan2(y,x),target=(z+Math.sign(nz)*p.width/2-p.phase)/p.lead;
  const materialAngle=theta+2*Math.PI*Math.round((target-theta)/(2*Math.PI));
  assert(materialAngle>=cutAngle-1e-6,'a buried flank remains beneath the blank surface');
 }
}
test('109 has closed square threads, involute change gears, a bored carriage and progressively removed stock',t=>{
 const v=makeMujocoThreadCutting(mujoco),u=v.root.userData,f=u.profile;
 try {
  let triangles=0;
  for(const [name,m]of Object.entries(u.parts)) {
   const a=inspectWeightedClutchSolid(m.geometry);assert(a.volume>0,name);assert.equal(a.unmatchedEdges,0,name);assert.equal(a.degenerate+a.nonfinite+a.wrongNormals,0,name);triangles+=a.triangles;
  }
  assert.match(u.parts.leadGear.geometry.userData.toothProfile,/involute/);assert.match(u.parts.workGear.geometry.userData.toothProfile,/involute/);
  u.parts.guide.geometry.computeBoundingBox();
  assert(f.leadZ-u.parts.guide.geometry.boundingBox.max.z>u.parts.leadGear.geometry.userData.outerRadius,'guide crosses the swept input gear');
  assert.ok(Math.abs(Math.hypot(f.dx,f.dz)-f.module*(f.leadTeeth+f.workTeeth)/2)<1e-12);
  assert.ok(f.external.lead*f.workThread.lead<0,'meshing gears require opposite thread handedness');
  const full=u.workpiece.geometry(Infinity),fullAudit=inspectWeightedClutchSolid(full),fullVolume=fullAudit.volume;
  assert.equal(fullAudit.components,1);assert.equal(fullAudit.unmatchedEdges+fullAudit.degenerate+fullAudit.wrongNormals+fullAudit.nonfinite,0);
  assertNoBuriedFlanks(full,f.stock,Infinity);full.dispose();
  const polygonArea=u.workAngles.slice(0,-1).reduce((s,a,i)=>s+f.workRadius*f.workRadius*Math.sin(u.workAngles[i+1]-a)/2,0);
  assert.ok(Math.abs(fullVolume-polygonArea*(f.workThread.high-f.workThread.low))<1e-8,'uncut workpiece is not a complete blank');
  let volume=Infinity;
  for(let i=0;i<=20;i++) {
   const angle=f.contactAngle-u.toolHalfAngle-i/20*20,g=u.workpiece.geometry(angle),a=inspectWeightedClutchSolid(g);
   assertNoBuriedFlanks(g,f.stock,angle);g.dispose();
   assert.equal(a.components,1);assert.equal(a.unmatchedEdges,0);assert.equal(a.degenerate+a.wrongNormals+a.nonfinite,0);assert(a.volume>0&&a.volume<=volume);volume=a.volume;
   assert(Math.abs(a.volume-circularWorkpieceVolume(f.stock,angle))<fullVolume*.0005,'cut volume differs beyond the polygon approximation');
  }
  for(const angle of [-Infinity,0,2*Math.PI,-2*Math.PI]) {
   const g=u.workpiece.geometry(angle),a=inspectWeightedClutchSolid(g);assertNoBuriedFlanks(g,f.stock,angle);g.dispose();
   assert.equal(a.components,1);assert.equal(a.unmatchedEdges+a.degenerate+a.wrongNormals+a.nonfinite,0);
   assert(Math.abs(a.volume-circularWorkpieceVolume(f.stock,angle))<fullVolume*.0005);
  }
  t.diagnostic(JSON.stringify({parts:Object.keys(u.parts).length,triangles,depthOffsetPixels:100*f.dz,cutPitchPixels:100*f.workPitch}));
 }finally{v.dispose();}
});
test('109 transmits the drive and diagnostic loads through ideal native gear and screw constraints',t=>{
 let feedError=0,gearError=0,inputError=0;
 for(const options of [{},{load:2,workTorque:.3},{load:-2,workTorque:-.3}]) {
  const v=makeMujocoThreadCutting(mujoco,options),p=v.physics,f=v.root.userData.profile;
  try {
   assert.equal(p.model.nq,3);assert.equal(p.model.nu,1);assert.equal(p.model.neq,2);assert.equal(p.model.ngeom,0);
   for(let i=0;i<48000;i++) {
    p.step();const q=p.data.qpos;assert.ok([...q,...p.data.qvel].every(Number.isFinite));
    feedError=Math.max(feedError,100*Math.abs(q[2]+f.lead*q[0]));gearError=Math.max(gearError,Math.abs(q[1]-f.ratio*q[0]));inputError=Math.max(inputError,Math.abs(q[0]-p.description.input(p.data.time).angle));
   }
  }finally{v.dispose();}
 }
 t.diagnostic(JSON.stringify({feedErrorPixels:feedError,gearErrorRadians:gearError,inputErrorRadians:inputError}));
 assert(feedError<.001);assert(gearError<.0001);assert(inputError<.01);
});
test('109 outputs depend on the native couplings and all native allocations are released',()=>{
 const v=makeMujocoThreadCutting(mujoco),p=v.physics;
 try {
  mujoco.mj_setState(p.model,p.data,[0,0],mujoco.mjtState.mjSTATE_EQ_ACTIVE.value);p.data.qvel.fill(0);
  for(let i=0;i<1000;i++)p.step();
  assert(Math.abs(p.data.qpos[0])>1);assert.equal(p.data.qpos[1],0);assert(p.data.qpos[2]<-1,'uncoupled carriage should fall under gravity');
 }finally{v.dispose();v.dispose();}
 assert(p.model.isDeleted()&&p.data.isDeleted());
});
test('109 replay is deterministic and return travel does not restore removed material',()=>{
 const v=makeMujocoThreadCutting(mujoco),p=v.physics,u=v.root.userData;
 try {
  v.update(8);const q=Array.from(p.data.qpos),peak=p.progress.maximumWorkAngle,stock=Array.from(u.parts.workpiece.geometry.attributes.position.array);
  v.update(16);assert.equal(p.progress.maximumWorkAngle,peak);assert.deepEqual(Array.from(u.parts.workpiece.geometry.attributes.position.array),stock);
  v.reset();for(let i=0;i<480;i++)v.advance(1/60);assert.deepEqual(Array.from(p.data.qpos),q);assert.equal(p.progress.maximumWorkAngle,peak);assert.deepEqual(Array.from(u.parts.workpiece.geometry.attributes.position.array),stock);
  v.update(2);const early=Array.from(p.data.qpos);v.reset();v.update(2);assert.deepEqual(Array.from(p.data.qpos),early);
 }finally{v.dispose();}
});
