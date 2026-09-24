import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeEccentricTwoStop} from '../src/simulation/eccentric-two-stop.js';
import profile from '../src/data/eccentric-two-stop-profile.js';
import {makeEccentricTwoStopCenteredCandidate} from '../scripts/lib/eccentric-two-stop-centered-candidate.mjs';
import {makeEccentricTwoStopFeatureContact} from '../scripts/lib/eccentric-two-stop-feature-contact.mjs';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
import {nativePlateContours} from '../scripts/lib/weighted-clutch-native-contours.mjs';

const model=makeEccentricTwoStop(),u=model.root.userData,near=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<=t,`${a} differs from ${b}`);
const dispose=model=>{const g=new Set(),m=new Set();model.root.traverse(o=>{if(o.geometry)g.add(o.geometry);if(o.material)m.add(o.material);});g.forEach(g=>g.dispose());m.forEach(m=>m.dispose());};
after(()=>dispose(model));

test('088 source cam, solid stepped stops and press-fit shaft seats preserve checked geometry',()=>{
  const candidate=makeEccentricTwoStopCenteredCandidate(profile.options),v=candidate.root.userData;
  assert.equal(Object.keys(u.parts).length,12);assert.deepEqual(u.geometry,v.geometry);assert.deepEqual(u.source,v.source);
  for(const [name,mesh]of Object.entries(u.parts)){
    const other=v.parts[name],topology=inspectWeightedClutchSolid(mesh.geometry);
    assert.equal(topology.components,1,name);assert.ok(topology.volume>0);assert.equal(topology.unmatchedEdges,0,name);
    assert.equal(topology.degenerate+topology.wrongNormals+topology.nonfinite,0,name);
    for(const [key,attribute]of Object.entries(mesh.geometry.attributes))assert.deepEqual(attribute.array,other.geometry.attributes[key].array,name+'/'+key);
    assert.deepEqual(mesh.geometry.index?.array,other.geometry.index?.array,name+' topology');
  }
  for(const time of [0,.1,1,1.2,3.6,5,5.3,8,9.6,20]){
    const state=u.stateAtTime(time);model.update(time);candidate.setCoordinates(state.inputAngle,state.outputAngle);
    for(const [name,mesh]of Object.entries(u.parts))assert.deepEqual(mesh.matrixWorld.elements,v.parts[name].matrixWorld.elements,name+' pose');
  }
  assert(u.geometry.bodySpan[0]>u.geometry.camSpan[1]);
  assert(u.geometry.footSpan[0]<u.geometry.camSpan[0]&&u.geometry.footSpan[1]>u.geometry.bodySpan[0]);
  assert(u.geometry.footInner-u.source.stopC.left>(u.source.stopC.right-u.source.stopC.left)/2);
  dispose(candidate);
});

test('088 cam edge is a true Archimedean spiral fitted to the engraving waypoints',()=>{
  const outer=nativePlateContours(u.parts.camA.geometry).sort((a,b)=>b.length-a.length)[0],sp=u.geometry.spiral;
  assert.ok(sp.risePerRadian>0&&sp.outerRadius>sp.innerRadius);
  let onSpiral=0;
  for(const [x,y]of outer){
    const dx=x-sp.center[0],dy=y-sp.center[1],r=Math.hypot(dx,dy),
      sweep=THREE.MathUtils.euclideanModulo(sp.stepAngle-Math.atan2(dy,dx),2*Math.PI),expected=sp.innerRadius+sp.risePerRadian*sweep;
    // Vertices on the radial step face lie between the two spiral ends.
    if(Math.abs(r-expected)<2e-5){onSpiral++;continue;}
    assert.ok(Math.min(sweep,2*Math.PI-sweep)<1e-5&&r>=sp.innerRadius-1e-5&&r<=sp.outerRadius+1e-5,'cam vertex off the spiral');
  }
  assert.ok(onSpiral>=u.geometry.camSegments);
  for(const [x,y]of u.source.cam){
    const p=[(x-277)/100,(282-y)/100];let distance=Infinity;
    for(let i=0;i<outer.length;i++){const a=outer[i],b=outer[(i+1)%outer.length],dx=b[0]-a[0],dy=b[1]-a[1],
      t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
      distance=Math.min(distance,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy));}
    assert.ok(distance*100<3.5,'cam departs from a traced point by more than the fit residual');
  }
  assert.deepEqual(u.geometry.O,[.075,.07]);assert.ok(u.geometry.pressFitShaftSeats);
  assert.deepEqual(u.geometry.rearDiskCenterOffset,[0,0]);
  assert.ok(Math.hypot(...u.geometry.rimCenterAdjustmentPixels)<11);
  assert.ok(Math.hypot(...profile.physics.mass.centroid.slice(0,2))<1e-12);
});

test('088 startup joins a repeat without resetting the motor or output wheel',()=>{
  const {repeat}=profile,rate=model.motion.rate;
  assert.deepEqual(u.stateAtTime(-1),u.stateAtTime(0));near(u.stateAtTime(0).inputAngle,0);near(u.stateAtTime(0).outputAngle,0);
  for(const time of [NaN,Infinity,-Infinity])assert.throws(()=>model.update(time),/Nonfinite/);
  assert.equal(repeat.endpointReplaced,false);
  for(let i=0;i<100;i++){
    const time=repeat.start/rate+i*.113,a=u.stateAtTime(time),b=u.stateAtTime(time+8);
    near(b.inputAngle-a.inputAngle,-4*Math.PI);near(b.outputAngle-a.outputAngle,-2*Math.PI);
  }
  for(let cycle=0;cycle<4;cycle++){
    const seam=repeat.end/rate+cycle*8,a=u.stateAtTime(seam-1e-7),b=u.stateAtTime(seam+1e-7);
    near(b.outputAngle,a.outputAngle);near(b.inputAngle-a.inputAngle,2e-7*profile.omega*rate);
  }
  const rest=profile.events.filter(e=>e.kind==='rest');
  assert(rest.length>=3);
  for(let i=1;i<rest.length;i++)near(rest[i].output-rest[i-1].output,-Math.PI,1e-10);
  for(const event of rest) {
    const a=u.stateAtTime(event.time/rate+.05),b=u.stateAtTime(event.time/rate+.5);
    near(a.outputAngle,b.outputAngle);assert.ok(b.inputAngle<a.inputAngle,'motor must keep turning through dwell');
  }
});

test('088 native stop feet clear the actual cam triangles between every playback knot',t=>{
  const contact=makeEccentricTwoStopFeatureContact(model);let minimumGap=Infinity,checks=0;
  for(let i=1;i<profile.samples.length;i++){
    const a=profile.samples[i-1],b=profile.samples[i],time=(a[0]+b[0])/2/model.motion.rate,state=u.stateAtTime(time);
    const c=contact.query(state.inputAngle,state.outputAngle)[0];if(c)minimumGap=Math.min(minimumGap,c.gap);checks++;
    assert.ok(!c||c.gap> -1e-6,'reduced playback clips a finite foot into the cam');
  }
  for(let i=0;i<=240;i++){
    const state=u.stateAtTime(i*32/240),c=contact.query(state.inputAngle,state.outputAngle)[0];
    assert.ok(!c||c.gap> -1e-6,'repeat changes the native clearance');
  }
  t.diagnostic(JSON.stringify({checks,minimumGap}));
});

test('088 the authored camera envelope contains every moving vertex through four cycles',()=>{
  const bounds=u.cameraFitBounds.clone().expandByScalar(1e-7),point=new THREE.Vector3();
  for(let i=0;i<=96;i++){
    model.update(i/3);
    for(const mesh of Object.values(u.parts)){
      const p=mesh.geometry.attributes.position;
      for(let j=0;j<p.count;j++){point.fromBufferAttribute(p,j).applyMatrix4(mesh.matrixWorld);assert.ok(bounds.containsPoint(point),mesh.name+' outside full rotation bounds');}
    }
  }
  assert.equal(u.hideGround,true);assert.equal(u.minimumDisplayCycleSeconds,8);
});
