import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAuthoredPendulumSawMovement as create378 } from '../src/simulation/authored-pendulum-saws.js';
import { createAuthoredSpringAssistedTreadleMovement as create416 } from '../src/simulation/authored-spring-assisted-treadles.js';
import { createAuthoredSpringReturnBellHammerMovement as create420 } from '../src/simulation/authored-spring-return-bell-hammers.js';
import { surfacePoints, solidSurface } from './helpers/solid-surface.mjs';
const models=[create378({id:378}),create416({id:416}),create420({id:420})];
// Check both finite surfaces; long pins may have no mesh vertex at an eye's Z plane.
function audit(model,pairs,period,steps=32,extra=[]){
  const fields=pairs.flatMap(([a,b])=>[[a,b],[b,a]]).map(([a,b])=>({a,b,points:surfacePoints(a.geometry),field:solidSurface(b.geometry),min:Infinity}));
  for(const t of [...Array.from({length:steps+1},(_,i)=>period*i/steps),...extra]){
    model.update(t);model.root.updateMatrixWorld(true);
    for(const f of fields){if(f.a.geometry.userData.deforming)f.points=surfacePoints(f.a.geometry);if(f.b.geometry.userData.deforming)f.field=solidSurface(f.b.geometry);const transform=f.b.matrixWorld.clone().invert().multiply(f.a.matrixWorld);
      for(const p of f.points){const q=p.clone().applyMatrix4(transform);if(f.field.box.distanceToPoint(q)>.05)continue;f.min=Math.min(f.min,f.field.signedDistance(q));}}
  }
  return pairs.map((pair,i)=>({pair,min:Math.min(fields[2*i].min,fields[2*i+1].min)}));
}
function clear(results,minimum=0){for(const {pair:[a,b],min}of results)assert.ok(min>minimum,`${a.userData.role}/${b.userData.role}: ${min}`);}
function axialOverlap(a,b){const aa=new THREE.Box3().setFromObject(a),bb=new THREE.Box3().setFromObject(b);return Math.min(aa.max.z,bb.max.z)-Math.max(aa.min.z,bb.min.z);}

test('378 ropes join exact tangent wraps and retain a finite grooved sheave seat',()=>{
  const m=models[0],d=m.root.userData,b=d.blocks,g=d.geometry;
  const results=audit(m,b.pulleyRoots.map((p,i)=>[b.ropes[i],p.userData.rim]),14.4);
  clear(results,.00001);for(const f of results)assert.ok(f.min<.0005);
  for(const t of [0,3.1,7.2]){
    m.update(t);
    for(let i=0;i<2;i++){
      // One continuous laid rope: straight leg, half wrap, straight leg.
      const path=b.ropes[i].geometry.parameters.path,[inner,arc,outer]=path.curves,c=g.pulleyCenters[i];
      assert.equal(b.ropes[i].geometry.type,'LaidRopeGeometry');
      assert.ok(Math.abs(arc.radialStart.length()-g.pulleyRadius)<1e-15);
      assert.ok(arc.center.distanceTo(c)<1e-15);
      assert.ok(inner.v2.distanceTo(arc.getPoint(0))<1e-15&&arc.getPoint(1).distanceTo(outer.v1)<1e-14,'legs meet the wrap');
      assert.ok(Math.abs(inner.v1.x-inner.v2.x)<1e-15&&Math.abs(outer.v1.x-outer.v2.x)<1e-15,'vertical tangent legs');
      assert.equal(inner.v1.z,c.z);
    }
  }
});
test('378 real pin eyes and an open guide replace intersecting solid rods and guide bar',()=>{
  const m=models[0],b=m.root.userData.blocks;
  clear(audit(m,[[b.rodJointPin,b.connectingRod],[b.sawPinMarker,b.connectingRod],
    ...b.carriageGuide.children.map(r=>[b.sawPinMarker,r]),[b.pendulumShaft,b.pendulumHub],
    [b.pendulumShaft,b.pendulumBearing],...b.pulleyRoots.flatMap(p=>[[p.userData.shaft,p.userData.hub],[p.userData.shaft,p.userData.bracket]])],14.4),.001);
  assert.ok(axialOverlap(b.rodJointPin,b.connectingRod)>.09);
  assert.ok(axialOverlap(b.sawPinMarker,b.connectingRod)>.09);
  assert.ok(axialOverlap(b.sawPinMarker,b.carriageGuide)>.11);
  assert.equal(b.carriageGuide.children.length,2);
  assert.ok(Math.abs(b.carriageGuide.children[0].position.y)+Math.abs(b.carriageGuide.children[1].position.y)-.045>.24);
});
test('416 pitman and spring pivot eyes clear their pins with finite axial engagement',()=>{
  const m=models[1],b=m.root.userData.blocks,pairs=[[b.crankPin,b.pitman],[b.treadleJointPin,b.pitman],
    [b.crankPin,b.springCrankEye],[b.crankShaft,b.flywheelHub],[b.crankShaft,b.crankArm],[b.treadleShaft,b.treadleHub]];
  const results=audit(m,pairs,6);clear(results,.0035);for(const f of results)assert.ok(f.min<.005);
  for(const[a,b]of pairs)assert.ok(axialOverlap(a,b)>.05);
  // The coiled spring clears the crank pin, its arbor and key, and the pitman.
  clear(audit(m,[[b.crankPin,b.spring],[b.springAnchorPin,b.spring],[b.arborKey,b.spring],[b.spring,b.pitman]],6));
});
test('420 actual striker/lip and underside spring shoe remain close without crossing solid walls',()=>{
  const m=models[2],b=m.root.userData.blocks,g=m.root.userData.geometry;
  const results=audit(m,[[b.strikerFace,b.bellLip],[b.strikerFace,b.bellBody],
    [b.hammerHead,b.bellLip],[b.hammerHead,b.bellBody],[b.springContactPad,b.hammerArm],
    [b.pivotPin,b.hammerHub],[b.pivotPin,b.bearing]],4,48,[g.strikeTime]);
  clear(results);assert.ok(results[0].min<.0015);assert.ok(results[4].min<.0003);
  m.update(g.strikeTime);m.root.updateMatrixWorld(true);
  assert.ok(b.strikerFace.getWorldPosition(new THREE.Vector3()).distanceTo(m.root.userData.stateAtTime(g.strikeTime).hammerHeadCenter)<1e-14);
  // An upward spring reaction produces the required return torque, throughout the stroke.
  for(let i=0;i<=64;i++){const s=m.root.userData.stateAtTime(4*i/64);assert.ok(s.springContact.x-g.pivot.x>0);assert.ok(s.returnSpringTorque>0);}
  const radial=g.strikeHeadCenter.clone().sub(g.pivot);
  const reaction=g.strikeHeadCenter.clone().sub(new THREE.Vector3(g.bellCenterX-g.bellLipRadius,g.bellBaseY,g.pivot.z)).normalize();
  assert.ok(radial.x*reaction.y-radial.y*reaction.x>.8,'lip reaction opposes the downward striking torque');
  assert.ok(axialOverlap(b.pivotPin,b.hammerHub)>.25);
  // Closed, finite bell wall: the actual shell contains metal and leaves its cavity open.
  const wall=solidSurface(b.bellBody.geometry);
  assert.ok(wall.inside(new THREE.Vector3(.88,.02,0)));
  assert.equal(wall.inside(new THREE.Vector3(.40,.02,0)),false);
});
test('378/416/420 state queries and playback preserve meshes, geometry and readable timing',()=>{
  for(const[m,period]of models.map((m,i)=>[m,[14.4,6,4][i]])){
    const before=[];m.root.traverse(o=>before.push([o,o.geometry]));
    for(let i=0;i<64;i++){m.root.userData.stateAtTime(i*.21);m.update(i*.21);}
    const after=[];m.root.traverse(o=>after.push([o,o.geometry]));assert.deepEqual(after,before);
    assert.equal(m.root.userData.minimumDisplayCycleSeconds,period);assert.equal(m.root.userData.hideGround,true);
    m.root.traverse(o=>{for(const mat of [].concat(o.material??[]))assert.equal(mat.fog,false);});
  }
});


test('416 draws Brown\'s spring A coiled on its arbor and 420 support actually meets its overhead arm',()=>{
  const m=models[1],spring=m.root.userData.blocks.spring,g=m.root.userData.geometry;m.update(0);
  const bounds=spring.geometry.boundingBox,size=bounds.getSize(new THREE.Vector3());
  // A flat strip coiled in one plane round arbor A: its width is the strip width.
  assert.ok(Math.abs(size.z-.10)<1e-6,'planar coiled strip, not a helix');
  // The coil surrounds the arbor and the tail reaches crank pin B's eye.
  assert.ok(bounds.min.x<-.55&&bounds.min.y<-.35&&bounds.max.y>.85,'open outer turn round the arbor');
  const pin=m.root.userData.stateAtTime(0).springAttachment.clone().sub(g.springAnchor);
  assert.ok(Math.abs(bounds.max.x-(pin.x-.13))<.03,'tail ends at the pin eye');
  assert.equal(spring.geometry.userData.deforming,true);
  const b=models[2].root.userData.blocks.fixedBellSupport;
  const post=b.children.find(o=>o.userData.role==='fixed-bell-support-post');
  const arm=b.children.find(o=>o.userData.role==='fixed-overhead-arm-carrying-bell');
  assert.ok(new THREE.Box3().setFromObject(post).intersectsBox(new THREE.Box3().setFromObject(arm)));
});
