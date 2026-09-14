import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const movement=JSON.parse(fs.readFileSync('src/data/movements.json')).movements[131];
const segment=(a,b)=>{const x=b.x-a.x,z=b.z-a.z,t=Math.max(0,Math.min(1,-(a.x*x+a.z*z)/(x*x+z*z||1)));return Math.hypot(a.x+t*x,a.z+t*z);};
function distanceFromAxis(mesh){
 const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,p=g.attributes.position;
 let minimum=Infinity;
 for(let i=0;i<p.count;i+=3){
  const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,i+j).applyMatrix4(mesh.matrixWorld));
  const cross=(a,b)=>a.x*b.z-a.z*b.x,area=cross(v[0],v[1])+cross(v[1],v[2])+cross(v[2],v[0]);
  const signs=v.map((a,j)=>cross(a,v[(j+1)%3]));
  const contains=Math.abs(area)>1e-12&&(signs.every(x=>x>=-1e-12)||signs.every(x=>x<=1e-12));
  minimum=Math.min(minimum,contains?0:Math.min(...v.map((a,j)=>segment(a,v[(j+1)%3]))));
 }
 if(g!==mesh.geometry)g.dispose();return minimum;
}
test('132 fixed collar and frame have finite shaft clearance through their actual triangulated bores',()=>{
 const v=createMovementModel(movement),u=v.root.userData,d=u.geometry,b=u.blocks;
 try{
  v.root.updateMatrixWorld(true);
  const members=[b.upperBearingCollar,...b.topFrameRails];
  for(const mesh of members){
   assert.equal(mesh.geometry.parameters.shapes.holes.length,1);
   assert(distanceFromAxis(mesh)-d.upperShaftRadius>.0198,'shaft must clear every frame triangle');
   const bounds=new THREE.Box3().setFromObject(mesh),size=bounds.getSize(new THREE.Vector3());
   const former=new THREE.Mesh(new THREE.BoxGeometry(size.x,size.y,size.z));former.position.copy(bounds.getCenter(new THREE.Vector3()));former.updateMatrixWorld(true);
   assert(distanceFromAxis(former)<d.upperShaftRadius,'a solid replacement must fail');former.geometry.dispose();former.material.dispose();
  }
  const shaft=new THREE.Box3().setFromObject(b.upperShaft),frameTop=Math.max(...b.topFrameRails.map(m=>new THREE.Box3().setFromObject(m).max.y));
  assert(shaft.max.y-frameTop>.54,'engraved shaft stub must emerge above the frame');
 }finally{disposeObject3D(v.root);}
});
