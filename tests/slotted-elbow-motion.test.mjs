import test from 'node:test';
import assert from 'node:assert/strict';
import {slottedElbowSource as source,slottedElbowParameters,slottedElbowState} from '../src/simulation/slotted-elbow-motion.js';
test('156 engraving landmarks close at the initial pose',()=>{
 const g=slottedElbowParameters(),s=slottedElbowState(0,g),pixel=p=>[source.diskCenter[0]+p[0]/source.scale,source.diskCenter[1]-p[1]/source.scale];
 for(const [actual,expected]of [[s.pin,[140,157]],[g.pivot,[280,388]],[s.output,[438,289]]])assert.ok(Math.hypot(...pixel(actual).map((x,i)=>x-expected[i]))<1e-10);
});
test('156 full-turn pin, slot, fixed rod and vertical guide constraints close',()=>{
 const g=slottedElbowParameters(),orbit=Math.hypot(...g.pin);let low=Infinity,high=-Infinity;
 for(let i=0;i<=4096;i++){
  const s=slottedElbowState(g.period*i/4096,g),dx=s.pin[0]-g.pivot[0],dy=s.pin[1]-g.pivot[1];
  assert.ok(Math.abs(Math.hypot(...s.pin)-orbit)<1e-12);
  assert.ok(Math.abs(-dx*Math.sin(s.slotAngle)+dy*Math.cos(s.slotAngle))<1e-12);
  assert.ok(s.slotStation>g.nearCapDistance+source.pinRadius*source.scale&&s.slotStation<g.farCapDistance-source.pinRadius*source.scale);
  assert.ok(Math.abs(Math.hypot(s.slider[0]-s.output[0],s.slider[1]-s.output[1])-g.rodLength)<1e-12);assert.equal(s.slider[0],g.guideX);
  low=Math.min(low,s.slider[1]);high=Math.max(high,s.slider[1]);
 }
 assert.ok(high-low>1);const a=slottedElbowState(0,g),b=slottedElbowState(g.period,g);for(const name of ['pin','output','slider'])assert.ok(Math.hypot(...a[name].map((x,i)=>x-b[name][i]))<1e-12);
});

test('156 rendered pin joints follow the solved linkage without changing geometry',async()=>{
 const {makeSlottedElbow}=await import('../src/simulation/slotted-elbow.js');
 const {Vector3,Box3}=await import('three');const v=makeSlottedElbow(),u=v.root.userData;
 try{
  const geometries=Object.values(u.parts).map(p=>p.geometry);
  for(let i=0;i<=256;i++){
   v.update(u.geometry.period*i/256);const s=u.state;
   for(const [part,local,expected]of [[u.parts.crankPin,new Vector3(),s.pin],[u.parts.outputPin,new Vector3(),s.output],[u.blocks.rod,new Vector3(u.geometry.rodLength,0,0),s.slider],[u.parts.sliderPin,new Vector3(),s.slider]]){
    const p=part.localToWorld(local);assert.ok(Math.hypot(p.x-expected[0],p.y-expected[1])<1e-12);
   }
   assert.ok(u.cameraFitBounds.containsBox(new Box3().setFromObject(v.root,true)));
   assert.deepEqual(Object.values(u.parts).map(p=>p.geometry),geometries);
  }
  v.root.traverse(o=>{if(o.material)assert.equal(o.material.fog,false);});assert.equal(u.hideGround,true);
  v.reset();assert.equal(u.state.time,0);
 }finally{v.dispose();}
});
