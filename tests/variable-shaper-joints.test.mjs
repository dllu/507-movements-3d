import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAuthoredVariableCrankMovement} from '../src/simulation/authored-variable-cranks.js';
import {solidSurface} from './helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
test('178 rod has through bores, fully engaged pins and retaining heads',()=>{
 const m=createAuthoredVariableCrankMovement({id:178}),b=m.root.userData.blocks;
 try{
  // Brown breaks the rod off before its output end; the whole rod carries its
  // output eye on the tool slide's pin beyond the drawing.
  assert.ok(b.connectingRodOutputEye.parent,'output eye stays on the whole rod');
  for(const[eye,pin,head]of [[b.connectingRodSliderEye,b.sliderFrontBoss,b.wristRetainer],[b.connectingRodOutputEye,b.outputPin,b.outputRetainer]]){
   const surface=solidSurface(eye.geometry);
   assert.equal(surface.inside(new THREE.Vector3(0,0,0)),false,'pin bore is open');
   assert.equal(surface.inside(new THREE.Vector3(.35,0,0)),true,'eye has a solid annulus');
   for(let i=0;i<=64;i++){
    m.update(m.root.userData.geometry.cyclePeriod*i/64);m.root.updateMatrixWorld(true);
    const eb=new THREE.Box3().setFromObject(eye),pb=new THREE.Box3().setFromObject(pin),hb=new THREE.Box3().setFromObject(head);
    assert.ok(pb.min.z<eb.min.z&&pb.max.z>eb.max.z,'pin spans entire eye');
    assert.ok(hb.min.z>eb.max.z,'retaining head clears rod face');
    assert.ok(Math.abs(hb.min.z-pb.max.z)<1e-7,'head meets pin end');
    const pc=pin.getWorldPosition(new THREE.Vector3()),ec=eye.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.hypot(pc.x-ec.x,pc.y-ec.y)<1e-10,'pin and eye stay concentric');
   }
  }
  const web=solidSurface(b.guideBacking.geometry);
  for(const [land,radius] of [[b.innerPlate,m.root.userData.geometry.grooveInnerRadius*.9],
    [b.outerPlate,(m.root.userData.geometry.grooveOuterRadius+m.root.userData.geometry.outerDiskRadius)/2]]){
    const world=b.guideBacking.localToWorld(new THREE.Vector3(radius,0,0));
    assert.ok(web.inside(new THREE.Vector3(radius,0,0)));
    assert.ok(solidSurface(land.geometry).inside(land.worldToLocal(world.clone())), 'rear web joins each fixed land');
  }
  assert.ok(new THREE.Box3().setFromObject(b.guideBacking).max.z < new THREE.Box3().setFromObject(b.circularGrooveShoe).min.z,
    'shoe clears groove floor');
  const shaft=new THREE.Box3().setFromObject(b.inputShaft),rod=new THREE.Box3().setFromObject(b.connectingRodBeam);
  assert.ok(shaft.max.z<rod.min.z,'shaft stays behind rod sweep');
 }finally{disposeObject3D(m.root);}
});
