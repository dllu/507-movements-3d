import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Box3} from 'three';
import {sourceTreadleDimensions as source,sourceTreadleParameters,sourceTreadleState} from '../src/simulation/source-treadle-motion.js';
import {makeSourceTreadle} from '../src/simulation/source-treadle.js';
test('158 preserves measured joint centers and projects the foot onto the treadle',()=>{
 const g=sourceTreadleParameters(),s=sourceTreadleState(0,g),pixel=p=>[source.diskCenter[0]+p[0]/source.scale,source.diskCenter[1]-p[1]/source.scale];
 for(const [actual,expected]of [[s.pin,[205,295]],[g.pivot,[421,418]],[s.joint,[181,412]]])assert.ok(Math.hypot(...pixel(actual).map((x,i)=>x-expected[i]))<1e-10);
 assert.ok(Math.hypot(...pixel(s.foot).map((x,i)=>x-source.foot[i]))<1);
});
test('158 closes its links throughout a full turn and keeps its foot above the base',()=>{
 const g=sourceTreadleParameters();let previous,low=Infinity,high=-Infinity,minAngle=Infinity,maxAngle=-Infinity;
 for(let i=0;i<=4096;i++){
  const s=sourceTreadleState(g.period*i/4096,g);
  for(const [a,b,length]of [[s.pin,[0,0],Math.hypot(...g.pin)],[s.pin,s.joint,g.rodLength],[s.joint,g.pivot,g.armLength],[s.foot,g.pivot,g.footLength]])assert.ok(Math.abs(Math.hypot(a[0]-b[0],a[1]-b[1])-length)<1e-12);
  const dx=g.pivot[0]-s.pin[0],dy=g.pivot[1]-s.pin[1];assert.ok(dx*(s.joint[1]-s.pin[1])-dy*(s.joint[0]-s.pin[0])<0);
  if(previous)assert.ok(Math.abs(s.treadleAngle-previous.treadleAngle)<.01);previous=s;low=Math.min(low,s.foot[1]);high=Math.max(high,s.foot[1]);minAngle=Math.min(minAngle,s.treadleAngle);maxAngle=Math.max(maxAngle,s.treadleAngle);
 }
 // Pass 92: Brown's 0.85-radius throw rocks the treadle about 49 degrees.
 const rock=(maxAngle-minAngle)*180/Math.PI;assert.ok(high-low>1);assert.ok(rock>45&&rock<53);assert.ok(low-.084>(240-448)*source.scale);
 const a=sourceTreadleState(0,g),b=sourceTreadleState(g.period,g);for(const name of ['pin','joint','foot'])assert.ok(Math.hypot(...a[name].map((x,i)=>x-b[name][i]))<1e-12);
 assert.throws(()=>sourceTreadleState(0,{...g,rodLength:.01}),/toggle/);
});
test('158 rendered joints remain connected with fixed geometry, clear framing and no fog',()=>{
 const v=makeSourceTreadle(),u=v.root.userData;
 try{
  const geometries=Object.values(u.parts).map(p=>p.geometry);
  for(let i=0;i<=512;i++){
   v.update(u.geometry.period*i/512);const s=u.state;
   for(const [part,local,expected]of [[u.parts.crankPin,new Vector3(),s.pin],[u.parts.treadlePin,new Vector3(),s.joint],[u.blocks.rod,new Vector3(u.geometry.rodLength,0,0),s.joint],[u.blocks.treadle,new Vector3(u.geometry.footLength,0,0),s.foot]]){
    const p=part.localToWorld(local);assert.ok(Math.hypot(p.x-expected[0],p.y-expected[1])<1e-12);
   }
   assert.ok(u.cameraFitBounds.containsBox(new Box3().setFromObject(v.root,true)));assert.deepEqual(Object.values(u.parts).map(p=>p.geometry),geometries);
  }
  v.root.traverse(o=>{if(o.material)assert.equal(o.material.fog,false);});assert.equal(u.hideGround,true);v.reset();assert.equal(u.state.time,0);
 }finally{v.dispose();}
});
test('158 crank pin sits at Brown\'s 0.85 throw and clears the treadle it passes',()=>{
 const g=sourceTreadleParameters();assert.ok(Math.abs(Math.hypot(...g.pin)/(source.diskRadius*source.scale)-.845)<.005);
 let min=Infinity;
 for(let i=0;i<=2048;i++){const s=sourceTreadleState(g.period*i/2048,g),d=[s.foot[0]-g.pivot[0],s.foot[1]-g.pivot[1]],L2=d[0]**2+d[1]**2;
  const t=Math.max(0,Math.min(1,((s.pin[0]-g.pivot[0])*d[0]+(s.pin[1]-g.pivot[1])*d[1])/L2));min=Math.min(min,Math.hypot(s.pin[0]-g.pivot[0]-t*d[0],s.pin[1]-g.pivot[1]-t*d[1]));}
 // retainer radius 0.165 plus treadle half-width 0.084
 assert.ok(min>.165+.084+.2);
});
