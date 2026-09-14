import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Box3,Vector3} from 'three';
import {makeTogglePunch} from '../src/simulation/toggle-punch.js';
test('140 finite moving plates clear the casting, pins and each other',()=>{
 const r=JSON.parse(fs.readFileSync('docs/validation/140-clearance.json'));
 for(const s of r.sources)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(s.file)).digest('hex'),s.sha256,s.file);
 assert.equal(r.samples,721);assert.deepEqual(r.overlaps,{});
});
test('140 round punch clears the guide, lower link and bored shelf throughout its stroke',()=>{
 const v=makeTogglePunch(),{parts,blocks}=v.root.userData;
 try{
  const shaft=parts['punch-shaft'],tip=parts['punch-tip'],shelf=parts['bored-die-shelf'];
  const hole=shelf.geometry.userData.plate.polygons[0][1];
  const center=[-.7,.03];let inradius=Infinity;
  for(let i=0;i<hole.length-1;i++){
   const a=hole[i],b=hole[i+1],dx=b[0]-a[0],dy=b[1]-a[1];if(dx===0&&dy===0)continue;
   inradius=Math.min(inradius,Math.abs(dx*(center[1]-a[1])-dy*(center[0]-a[0]))/Math.hypot(dx,dy));
  }
  const lipBoxes=['left-guide','right-guide','left-guide-lip','right-guide-lip'].map(n=>new Box3().setFromObject(parts[n]));
  for(let i=0;i<=800;i++){
   v.update(i*6/800);
   assert(v.root.userData.cameraFitBounds.containsBox(new Box3().setFromObject(v.root)));
   for(const mesh of [shaft,tip]){
    const box=new Box3().setFromObject(mesh);
    for(const lip of lipBoxes)assert(!box.intersectsBox(lip));
    assert(box.max.z<parts['lower-toggle'].geometry.userData.plate.low);
    assert(box.max.y<blocks.ram.position.y-.046,'shaft stops below the transverse joint bore');
    assert(box.min.y>(216-447)/100,'tip clears the base under the die');
    const p=mesh.geometry.attributes.position;
    for(let j=0;j<p.count;j++){
     const world=mesh.localToWorld(new Vector3().fromBufferAttribute(p,j));
     assert(Math.hypot(world.x-center[0],world.z-center[1])<inradius,'complete round tool fits through die bore');
    }
   }
   assert.equal(blocks.ram.position.x,-.7);
  }
  v.update(2.6);v.reset();assert(Math.abs(v.root.userData.state.angle)<1e-15);
  v.root.traverse(o=>{if(o.material)assert.equal(o.material.fog,false);});
 }finally{v.dispose();}
});
