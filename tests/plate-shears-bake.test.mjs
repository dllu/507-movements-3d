import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {sampleBakedMotion,makeBakedRigidMovement} from '../src/simulation/baked/playback.js';
import {makePlateShearsGeometry} from '../src/simulation/mujoco-plate-shears/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const bytes=fs.readFileSync(new URL('../src/simulation/baked/assets/130.json.gz',import.meta.url)),b=JSON.parse(gunzipSync(bytes));
const provenance=JSON.parse(fs.readFileSync(new URL('../src/simulation/baked/assets/130.provenance.json',import.meta.url)));
test('130 bake matches its source provenance and loops continuously',()=>{
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),provenance.assetSha256);
 for(const s of b.source.simulationSources)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(s.file)).digest('hex'),s.sha256,s.file);
 for(const t of [b.loopEnd,b.loopEnd+4,b.loopEnd+400]){
  const a=sampleBakedMotion(b,t-1e-7),c=sampleBakedMotion(b,t+1e-7);assert(Math.max(...a.map((x,k)=>Math.abs(x-c[k])))<1e-5);
 }
 assert(b.source.maximumPenetrationPixels<.01);
 assert(b.object.geometries.every(g=>g.type==='BufferGeometry'));
});
test('130 gravity opens the jaw and blades have axial clearance throughout the stroke',()=>{
 const v=makeBakedRigidMovement(b,{}),jaw=v.root.getObjectByName('body:jaw');
 const [x,y]=b.source.mass.jaw.centroid;
 try{
  for(let i=0;i<b.motion.length;i+=20){
   const row=b.motion[i];v.update(row[0]);
   assert(x*Math.cos(row[2])-y*Math.sin(row[2])<0,'gravity must produce opening torque');
   const moving=new THREE.Box3().setFromObject(jaw);
   for(const name of ['fixed-jaw','base']){
    const fixed=new THREE.Box3().setFromObject(v.root.getObjectByName(name));
    assert(moving.min.z-fixed.max.z>.0029);
   }
   assert(v.root.userData.cameraFitBounds.containsBox(new THREE.Box3().setFromObject(v.root,true)));
  }
 }finally{v.dispose();}
});
test('130 serialization preserves all source mesh transforms',()=>{
 const source=makePlateShearsGeometry(),cached=makeBakedRigidMovement(b,{});
 try{
  const original=[],copy=[];source.root.updateMatrixWorld(true);cached.root.updateMatrixWorld(true);
  source.root.traverse(o=>{if(o.isMesh)original.push(o);});cached.root.traverse(o=>{if(o.isMesh)copy.push(o);});
  assert.equal(original.length,copy.length);
  original.forEach((mesh,i)=>mesh.matrixWorld.elements.forEach((n,k)=>assert(Math.abs(n-copy[i].matrixWorld.elements[k])<1e-10)));
 }finally{disposeObject3D(source.root);cached.dispose();}
});
test('130 blades close fully and the pivot bores are closed, inward-facing walls (p98)',()=>{
 // Closed phase: the jaw swings far enough that its whole cutting edge
 // passes the fixed blade's top edge.
 const closed=Math.min(...b.motion.filter(row=>row[0]>=b.loopStart).map(row=>row[2]));
 const world=(x,y)=>new THREE.Vector2((x-322)/100,(325-y)/100);
 const edge=new THREE.CubicBezierCurve(world(502,270),world(466,279),world(396,294),world(372,307)).getPoints(40);
 const fixed=[world(372,313),world(507,318)];
 let gap=-Infinity;
 for(const p of edge){const q=p.clone().rotateAround(new THREE.Vector2(),closed);if(q.x<fixed[0].x||q.x>fixed[1].x)continue;
  gap=Math.max(gap,q.y-(fixed[0].y+(fixed[1].y-fixed[0].y)*(q.x-fixed[0].x)/(fixed[1].x-fixed[0].x)));}
 assert(gap<-.03,`cutting edge must pass the fixed edge, gap ${gap}`);
 const v=makePlateShearsGeometry();
 try{
  for(const mesh of [v.root.getObjectByName('fixed-jaw'),v.root.userData.parts.jaw,v.root.userData.parts.cam]){
   const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,p=g.attributes.position;let walls=0;
   const centre=mesh===v.root.userData.parts.cam?new THREE.Vector3():new THREE.Vector3();
   for(let i=0;i<p.count;i+=3){
    const t=new THREE.Triangle(...[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,i+k)));
    const m=t.getMidpoint(new THREE.Vector3()),n=t.getNormal(new THREE.Vector3());
    if(Math.abs(n.z)>.5||Math.hypot(m.x-centre.x,m.y-centre.y)>.12)continue;
    walls++;assert(n.x*(m.x-centre.x)+n.y*(m.y-centre.y)<0,'bore wall must face the bore axis');
   }
   assert(walls>40);
  }
  // The pivot pin stands proud of both outer faces.
  const pin=v.root.children.find(o=>o.isMesh&&o.geometry.type==='CylinderGeometry'&&o.position.x===0);
  const box=new THREE.Box3().setFromObject(pin);assert(box.min.z<-.183-.01&&box.max.z>.16+.01);
 }finally{disposeObject3D(v.root);}
});
