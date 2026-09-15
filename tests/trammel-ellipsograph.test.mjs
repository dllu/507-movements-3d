import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeTrammelEllipsograph} from '../src/simulation/trammel-ellipsograph.js';
test('152 rendered pencil and stud centers match source plan landmarks',()=>{
 const v=makeTrammelEllipsograph();try{
  const b=v.root.userData.blocks;
  for(const [object,pixel] of [[b.horizontalStudAssembly,[207,277.5]],[b.verticalStudAssembly,[263,330]],[b.pencilAssembly,[83,159.5]]]){
   const p=object.getWorldPosition(new THREE.Vector3()),projected=[263+p.x/.014,277.5-p.y/.014];
   assert.ok(Math.hypot(projected[0]-pixel[0],projected[1]-pixel[1])<1.5);
  }
 }finally{v.dispose();}
});
test('152 shoes hold both stud centers and pencil follows one ellipse through a six-second turn',()=>{
 const v=makeTrammelEllipsograph();try{
  const u=v.root.userData,b=u.blocks,g=u.geometry;assert.equal(g.cyclePeriod,6);
  for(let i=0;i<=1024;i++){
   v.update(6*i/1024);
   for(const [j,stud] of [[0,b.horizontalStudAssembly],[1,b.verticalStudAssembly]]){
    const a=stud.getWorldPosition(new THREE.Vector3()),p=b.guideShoes[j].getWorldPosition(new THREE.Vector3());
    assert.ok(Math.hypot(a.x-p.x,a.y-p.y)<1e-12);
   }
   const p=b.pencilAssembly.getWorldPosition(new THREE.Vector3());assert.ok(Math.abs((p.x/g.semiMajor)**2+(p.y/g.semiMinor)**2-1)<1e-12);
  }
  v.reset();assert.ok(b.horizontalStudAssembly.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(-.784,0,.7))<1e-12);
 }finally{v.dispose();}
});
