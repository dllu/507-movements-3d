import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const movement=JSON.parse(fs.readFileSync('src/data/movements.json')).movements[131];
function insideSolid(geometry,point){
 const g=geometry.index?geometry.toNonIndexed():geometry,p=g.attributes.position;
 const ray=new THREE.Ray(point,new THREE.Vector3(.2341,.8737,.4123).normalize()),hits=new Set(),target=new THREE.Vector3();
 for(let i=0;i<p.count;i+=3){const vertices=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,i+j));if(ray.intersectTriangle(...vertices,false,target))hits.add(target.distanceTo(point).toFixed(7));}
 if(g!==geometry)g.dispose();return hits.size%2===1;
}
test('132 blind sockets enclose the balls and clear the changing rod angle',()=>{
 const v=createMovementModel(movement),u=v.root.userData,d=u.geometry,b=u.blocks;
 try{
  for(const disk of [b.upperDisk,b.lowerDisk]){
   const g=disk.geometry,p=g.attributes.position,index=g.index,q=g.userData,edges=new Map();
   const key=i=>new THREE.Vector3().fromBufferAttribute(p,i).toArray().map(n=>n.toFixed(7)).join(',');
   for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];for(let j=0;j<3;j++){const pair=[key(ids[j]),key(ids[(j+1)%3])].sort().join('/');edges.set(pair,(edges.get(pair)||0)+1);}}
   assert([...edges.values()].every(n=>n===2),'socket plate must form a closed solid');
   for(const x of [-d.linkHoleRadius,d.linkHoleRadius]){
    const center=new THREE.Vector3(x,0,0),closest=new THREE.Vector3();let minimum=Infinity;
    for(let i=0;i<index.count;i+=3){const triangle=new THREE.Triangle(...[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index.getX(i+j))));minimum=Math.min(minimum,triangle.closestPointToPoint(center,closest).distanceTo(center));}
    assert(minimum-d.rodJointRadius>.0018,'finite seat triangles must clear the complete spherical joint');
    assert(!insideSolid(g,center),'ball centre must be in the cavity, not buried inside solid metal');
    const old=new THREE.CylinderGeometry(q.outerRadius,q.outerRadius,q.depth,128);old.translate(0,q.offsetY*q.sign,0);
    assert(insideSolid(old,center),'former solid disk must fail the containment check');old.dispose();
   }
   assert(q.depth/2+q.offsetY>q.seatRadius,'blind seat needs a closed back wall');
  }
  const shaftRadius=d.rodThickness/Math.sqrt(2); // Encloses each square rod cross-section.
  for(let i=0;i<=720;i++){
   const state=u.stateAtTime(i*d.cyclePeriod/720),cosine=state.diskSeparation/d.linkLength,tangent=state.chordLength/state.diskSeparation;
   for(const disk of [b.upperDisk,b.lowerDisk]){const q=disk.geometry.userData;
    for(let j=0;j<=32;j++){const y=q.openingDepth*j/32;
     // This enclosing oblique cylinder bounds every rod orientation. The
     // actual cone is polygonal, hence use its inscribed radial bound.
     const required=y*tangent+shaftRadius/cosine;
     const available=(q.seatRadius+(q.openingRadius-q.seatRadius)*j/32)*Math.cos(Math.PI/q.segments);
     assert(available-required>.01,'rod must clear the finite flared mouth');
    }
   }
  }
  v.update(0);v.root.updateMatrixWorld(true);
  const rasterY=y=>235-(y-d.upperLinkY)/.016;
  for(const [disk,top,bottom,tolerance] of [[b.upperDisk,208,240,1.5],[b.lowerDisk,338,360,.01]]){
   const bounds=new THREE.Box3().setFromObject(disk);assert(Math.abs(rasterY(bounds.max.y)-top)<tolerance);assert(Math.abs(rasterY(bounds.min.y)-bottom)<tolerance);
  }
  const bellBox=new THREE.Box3().setFromObject(b.upperBell),pedestalBox=new THREE.Box3().setFromObject(b.lowerDiskPedestal);
  assert(bellBox.min.y>d.upperLinkY+d.rodJointRadius+.03);
  assert(pedestalBox.max.y<u.kinematics.lowerDiskY-d.rodJointRadius-.009);
  assert(b.upperSockets.every(s=>s.children.length===0));assert(b.lowerSockets.every(s=>s.children.length===0));
 }finally{disposeObject3D(v.root);}
});
