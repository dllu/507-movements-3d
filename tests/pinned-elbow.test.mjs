import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3,Box3} from 'three';
import {pinnedElbowSource,pinnedElbowParameters,pinnedElbowState} from '../src/simulation/pinned-elbow-motion.js';
import {pinnedElbowFittedSource as source} from '../src/simulation/pinned-elbow-fit.js';
import {makePinnedElbow} from '../src/simulation/pinned-elbow.js';
test('157 records its source correction and rejects impossible raw engraving poses',()=>{
 const report=JSON.parse(fs.readFileSync('docs/validation/157-source-fit.json'));assert.deepEqual(source,report.fittedSource);
 const raw=pinnedElbowParameters(pinnedElbowSource);assert.throws(()=>pinnedElbowState(.6*raw.period,raw),/toggle/);
 const g=pinnedElbowParameters(source),s=pinnedElbowState(0,g),pixel=p=>[source.diskCenter[0]+p[0]/source.scale,source.diskCenter[1]-p[1]/source.scale];
 for(const [actual,expected]of [[s.pin,source.crankPin],[g.pivot,source.pivot],[s.input,source.input],[s.output,source.output]])assert.ok(Math.hypot(...pixel(actual).map((x,i)=>x-expected[i]))<1e-10);
});
test('157 bell crank swings near-symmetrically about the drawn pose and the output rod stays near its guide line',()=>{
 const g=pinnedElbowParameters(source);let low=Infinity,high=-Infinity,tilt=0;
 for(let i=0;i<=1440;i++){const s=pinnedElbowState(g.period*i/1440,g),b=(s.bellAngle-g.restAngle)*180/Math.PI;low=Math.min(low,b);high=Math.max(high,b);
  tilt=Math.max(tilt,Math.abs(Math.atan2(s.slider[0]-s.output[0],s.output[1]-s.slider[1]))*180/Math.PI);}
 // Was +21/-75 degrees with an 18 degree rod lean before the p90 refit.
 assert.ok(high-low<80,`swing ${high-low}`);assert.ok(Math.abs(high+low)<30.5,`asymmetry ${high+low}`);assert.ok(tilt<8,`rod tilt ${tilt}`);
});
test('157 closes every rigid link through a full turn on one continuous branch',()=>{
 const g=pinnedElbowParameters(source);let previous,low=Infinity,high=-Infinity;
 for(let i=0;i<=4096;i++){
  const s=pinnedElbowState(g.period*i/4096,g);
  for(const [a,b,length]of [[s.pin,[0,0],Math.hypot(...g.pin)],[s.pin,s.input,g.couplerLength],[s.input,g.pivot,g.inputLength],[s.output,g.pivot,g.outputLength],[s.output,s.slider,g.rodLength]])assert.ok(Math.abs(Math.hypot(a[0]-b[0],a[1]-b[1])-length)<1e-12);
  assert.equal(s.slider[0],g.guideX);const dx=g.pivot[0]-s.pin[0],dy=g.pivot[1]-s.pin[1];assert.ok(dx*(s.input[1]-s.pin[1])-dy*(s.input[0]-s.pin[0])>0);
  if(previous)assert.ok(Math.abs(s.bellAngle-previous.bellAngle)<.01);previous=s;low=Math.min(low,s.slider[1]);high=Math.max(high,s.slider[1]);
 }
 assert.ok(high-low>1);const a=pinnedElbowState(0,g),b=pinnedElbowState(g.period,g);for(const name of ['pin','input','output','slider'])assert.ok(Math.hypot(...a[name].map((x,i)=>x-b[name][i]))<1e-12);
});
test('157 rendered rods terminate at their pins, the output rod hangs to its off-plate guide point, and geometry is retained',()=>{
 const v=makePinnedElbow(),u=v.root.userData;
 try{
  const geometries=Object.values(u.parts).map(p=>p.geometry);
  for(let i=0;i<=256;i++){
   v.update(u.geometry.period*i/256);const s=u.state;
   for(const [part,local,expected]of [[u.parts.crankPin,new Vector3(),s.pin],[u.parts.upperPin,new Vector3(),s.input],[u.parts.outputPin,new Vector3(),s.output],[u.blocks.coupler,new Vector3(u.geometry.couplerLength,0,0),s.input],[u.blocks.rod,new Vector3(u.geometry.rodLength,0,0),s.slider]]){
    const p=part.localToWorld(local);assert.ok(Math.hypot(p.x-expected[0],p.y-expected[1])<1e-12);
   }
   assert.ok(u.cameraFitBounds.containsBox(new Box3().setFromObject(v.root,true)));assert.deepEqual(Object.values(u.parts).map(p=>p.geometry),geometries);
  }
  // Brown draws no guide, crosshead, frame or bearing plates (p60 policy).
  for(const name of ['crosshead','sliderPin','guideBack','base','diskBearingFlange','pivotBearingFlange','guideFlange'])assert.equal(u.parts[name],undefined,name);
  assert.equal(u.blocks.slider.children.length,0);
  v.root.traverse(o=>{if(o.material)assert.equal(o.material.fog,false);});assert.equal(u.hideGround,true);v.reset();assert.equal(u.state.time,0);
 }finally{v.dispose();}
});
