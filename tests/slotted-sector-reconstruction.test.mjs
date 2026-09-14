import test from 'node:test';
import assert from 'node:assert/strict';
import clip from 'polygon-clipping';
import * as THREE from 'three';
import {makeSlottedSector} from '../src/simulation/slotted-sector.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const area=multi=>multi.reduce((sum,poly)=>sum+poly.reduce((s,r,i)=>s+(i?-1:1)*Math.abs(r.reduce((a,p,j)=>{const q=r[(j+1)%r.length];return a+p[0]*q[1]-q[0]*p[1];},0)/2),0),0);
const rotate=(r,a)=>r.map(([x,y])=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)]);
const distance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
test('131 source-traced assembly has one slotted body, two web pockets and finite working clearance',()=>{
 const v=makeSlottedSector(),u=v.root.userData,d=u.geometry,b=u.blocks,p=u.profiles;
 try{
  assert.equal(u.bodyRings.length,5);assert.equal(d.distance*100,155);assert.equal(d.diskRadius*200,223);assert.equal(d.crankRadius*100,90);
  assert.equal(b.toothMeshes.length,9);assert.equal(d.period,4);
  const rawRack=b.rackTeeth.map(t=>t.geometry.parameters.shapes.getPoints().map(q=>q.toArray()));
  let maxGap=0;
  for(let i=0;i<=720;i++){
   const time=i*d.period/720;v.update(time);v.root.updateMatrixWorld(true);const s=u.state;
   const local=rotate([[s.x,s.y]],-s.rocker)[0];
   const gap=Math.min(...u.slotRing.slice(0,-1).map((a,j)=>distance(local,a,u.slotRing[j+1])))-d.pinRadius;
   assert(gap>.00099&&gap<.00101,'actual pin must fit actual slot');
   const racks=rawRack.map(r=>r.map(([x,y])=>[x+s.rackX,y]));
   const body=u.bodyRings.map(r=>rotate(r,s.rocker));
   for(const r of racks)assert(area(clip.intersection(body,[r]))<1e-11,'body must not overlap rack teeth');
   let nearest=Infinity;
   for(const mesh of b.toothMeshes){const tooth=rotate(p.tooth.map(q=>q.toArray()),s.rocker+mesh.rotation.z);
    if(Math.min(...tooth.map(q=>q[1]))>-d.radius+p.module)continue;
    for(const r of racks){assert(area(clip.intersection([tooth],[r]))<1e-11,'tooth overlap');if(i%6===0)for(const q of tooth)for(let j=0;j<r.length;j++)nearest=Math.min(nearest,distance(q,r[j],r[(j+1)%r.length]));}
   }
   if(i%6===0){maxGap=Math.max(maxGap,nearest);assert(nearest<.002,'must maintain working engagement');}
   const slotBox=new THREE.Box3().setFromObject(b.body),diskBox=new THREE.Box3().setFromObject(b.diskMesh),pinBox=new THREE.Box3().setFromObject(b.crankPin);
   assert(slotBox.min.z-diskBox.max.z>.059);assert(pinBox.min.z<0&&pinBox.max.z>d.depth);
   const barBox=new THREE.Box3().setFromObject(b.rackBody);
   assert(barBox.min.x < d.guideCenters[0]-.125&&barBox.max.x>d.guideCenters[1]+.125,'bar must remain in both guides');
   for(const guide of b.guides)for(const part of guide.children){if(part.name==='guide-bolt')continue;const box=new THREE.Box3().setFromObject(part);for(const tooth of [b.rackBody,...b.rackTeeth])assert(!box.intersectsBox(new THREE.Box3().setFromObject(tooth)),'rack tooth must clear guide');}
   assert(u.cameraFitBounds.containsBox(new THREE.Box3().setFromObject(v.root,true)));
  }
  const s=u.stateAtTime(0),bad=rotate(p.tooth.map(q=>q.toArray()),s.rocker-Math.PI/2+Math.PI/d.teeth);
  assert(rawRack.some(r=>area(clip.intersection([bad],[r.map(([x,y])=>[x+s.rackX,y])]))>.0001),'wrong-phase control');
 }finally{disposeObject3D(v.root);}
});
