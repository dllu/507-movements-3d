import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredClampMovement} from '../src/simulation/authored-clamps.js';
import {createAuthoredLatheHeadMovement} from '../src/simulation/authored-lathe-heads.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface} from './helpers/solid-surface.mjs';

// Sample actual mesh vertices in both directions. This catches the former solid
// bores and disconnected/overlapping coils independently of ideal pitch curves.
function clearCycle(model, pairs) {
  const queries = pairs.flatMap(([a,b]) => [[a,b],[b,a]]).map(([from,to]) => {
    const p=from.geometry.attributes.position, points=[];
    for(let i=0;i<p.count;i+=Math.max(1,Math.floor(p.count/1800))) points.push(new THREE.Vector3().fromBufferAttribute(p,i));
    return {from,to,points,surface:solidSurface(to.geometry)};
  });
  for(let frame=0;frame<=24;frame++) {
    model.update(frame*model.root.userData.geometry.cyclePeriod/24); model.root.updateMatrixWorld(true);
    for(const {from,to,points,surface} of queries) {
      const matrix=to.matrixWorld.clone().invert().multiply(from.matrixWorld);
      for(const point of points) {
        const p=point.clone().applyMatrix4(matrix);
        assert.ok(!surface.inside(p)||surface.distance(p)<2e-6,
          `${from.userData.role} penetrates ${to.userData.role} at ${frame}, depth ${surface.distance(p)}`);
      }
    }
  }
}
for(const [id,create] of [[190,createAuthoredClampMovement],[285,createAuthoredLatheHeadMovement]]) {
  test(`${id}: integral screw threads mate radially and clear actual bored stationary solids through the cycle`,()=>{
    const model=create({id}),u=model.root.userData,b=u.blocks;
    try {
      const outer=b.externalThread.geometry.userData.thread,inner=b.internalThread.geometry.userData.thread;
      assert.ok(outer.inner<u.geometry.threadCoreRadius,'thread joins the solid core');
      assert.ok(inner.inner<outer.outer-0.07,'finite mating flanks have radial engagement');
      assert.ok(inner.inner>outer.inner&&inner.outer>outer.outer,'crest and root have radial clearance');
      assert.ok(Math.abs(outer.width+inner.width-u.geometry.threadPitch+0.004)<1e-12,'inferred axial running clearance');
      assert.equal(u.hideGround,true);
      model.root.traverse(object=>{for(const m of object.material?[].concat(object.material):[])assert.equal(m.fog,false);});
      const fixed=id===190?[b.nutBody,b.fixedFrame,b.bench]:[b.nut,b.quillSleeve];
      const pairs=[[b.externalThread,b.internalThread],...fixed.flatMap(m=>[[b.externalThread,m],[b.screwCore,m]])];
      if(id===285){
        const guides=[b.fixedKeyGuide,...b.quillGuides];
        for(const guide of guides)for(const moving of [b.quillSleeve,b.quillKey,b.quillIndex])pairs.push([moving,guide]);
        for(const guide of b.quillGuides){const surface=solidSurface(guide.geometry);assert.ok(!surface.inside(new THREE.Vector3(0,0,0)),'bearing center is truly bored');}
      }
      clearCycle(model,pairs);
      const flank = solidSurface(b.internalThread.geometry);
      for(let frame=0;frame<=24;frame++) {
        model.update(frame*u.geometry.cyclePeriod/24); model.root.updateMatrixWorld(true);
        const center=(id===190?b.nutBody:b.nut).getWorldPosition(new THREE.Vector3())
          .applyMatrix4(b.externalThread.matrixWorld.clone().invert());
        const axial=id===190?center.y:center.x,angle=(axial-outer.phase-outer.width/2)/outer.lead;
        const point=new THREE.Vector3(.18*Math.cos(angle),.18*Math.sin(angle),axial);
        if(id===190) point.applyAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
        else point.applyAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2).applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2);
        point.applyMatrix4(b.externalThread.matrixWorld).applyMatrix4(b.internalThread.matrixWorld.clone().invert());
        const gap=flank.signedDistance(point);
        assert.ok(gap>.0019&&gap<.0021,`finite mating flank remains within specified running clearance: ${gap}`);
      }
      if(id===285) {
        const baseTop=new THREE.Box3().setFromObject(b.base).max.y;
        for(const role of ['front-tailstock-casting-column','rear-tailstock-casting-column']) {
          const column=b.frame.children.find(object=>object.userData.role===role);
          assert.ok(Math.abs(new THREE.Box3().setFromObject(column).min.y-baseTop)<1e-6,'casting columns meet the base');
        }
      }
    } finally {disposeObject3D(model.root);}
  });
}
