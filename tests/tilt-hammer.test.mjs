import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import{makeFourLobeTiltHammer}from'../src/simulation/tilt-hammer.js';
import{makeTiltHammerMotion}from'../src/simulation/tilt-hammer-motion.js';
import profile from '../src/data/tilt-hammer-profile.js';
import{makeTiltHammerContactStudy}from'../scripts/lib/tilt-hammer-contact-study.mjs';
import{solidSurface,surfacePoints}from'./helpers/solid-surface.mjs';
const motion=makeTiltHammerMotion(profile),p=motion.parameters,e=motion.events,study=makeTiltHammerContactStudy();
const at=time=>motion.atTime(time-p.initialTime);
const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const dispose=model=>model.root.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});

test('072 preserves the measured four-lobe cam and the source lever arrangement',()=>{
  const model=makeFourLobeTiltHammer(),data=model.root.userData;
  assert.equal(Object.keys(data.parts).length,15);
  assert.deepEqual([...new Set(Object.values(data.families))].sort(),['fixed','hammer','input']);
  near(p.high*p.scale,209.92077714825875,1e-6);
  near(p.flankRadius*p.scale,206.5437461597015,1e-9);
  near(p.pitch,Math.PI/2,0);
  assert.ok(p.noseOffset[0]<0);
  data.parts.striker.geometry.computeBoundingBox();
  assert.ok(data.parts.striker.geometry.boundingBox.max.x<p.noseOffset[0]);
  assert.ok(data.parts.workpiece.parent===data.blocks.fixed);
  assert.ok(data.parts.socketLiner.parent===data.blocks.fixed);
  // Pass 96: the striker lands flat in its seat in the bloom's dip.
  assert.ok(p.restQ>0.0799&&p.restQ<0.0801);
  dispose(model);
});

test('072 begins in the engraving pose and makes four gravity strikes per input turn',()=>{
  near(motion.atTime(0).angle,0,1e-15);
  for(const time of [-40,-1,0,.37,1,5,30,100]){
    const first=motion.atTime(time),next=motion.atTime(time+p.period),turn=motion.atTime(time+4*p.period);
    near(next.q,first.q,1e-11);near(next.velocity,first.velocity,1e-10);
    near(next.angle-first.angle,-Math.PI/2,1e-12);
    near(turn.angle-first.angle,-2*Math.PI,1e-12);
    assert.equal(next.cycle,first.cycle+1);assert.equal(turn.cycle,first.cycle+4);
  }
  assert.ok(e.entry.time<e.flankEnd.time&&e.flankEnd.time<e.crest.time);
  assert.ok(e.crest.time<e.release.time&&e.release.time<e.landing.time&&e.landing.time<p.period);
});

test('072 respects every finite cam flank and step through all four lobes',()=>{
  let peak=0;
  for(let i=0;i<=2500;i++){
    const time=4*p.period*i/2500,state=at(time);
    assert.ok(study.gap(state.angle,state.q)>-1e-7,`Cam intrusion at ${time}`);
    assert.ok(state.q<=p.restQ+1e-12);peak=Math.max(peak,Math.abs(state.velocity));
    if(state.camContactEngaged)assert.ok(Math.abs(study.gap(state.angle,state.q))<1e-7);
  }
  assert.ok(peak>.71&&peak<.73);
  assert.equal(at((e.landing.time+p.period)/2).stage,'workpiece-dwell');
});

test('072 contact velocity, acceleration and force satisfy the moving-surface constraints',()=>{
  for(const[begin,end]of[[e.entry.time,e.flankEnd.time],[e.flankEnd.time,e.release.time]])
    for(const fraction of [.01,.1,.35,.7,.9,.99]){
      const time=begin+(end-begin)*fraction,h=1e-6,state=at(time),before=at(time-h),after=at(time+h);
      near((after.q-before.q)/(2*h),state.velocity,1e-7);
      near((after.velocity-before.velocity)/(2*h),state.acceleration,1e-6);
      near(-p.omega*state.inputMoment,state.velocity*state.outputMoment,1e-9);
      assert.ok(state.outputMoment<0&&state.reaction>0);
      near(state.reaction*state.outputMoment,
        motion.mass.inertiaPerMass*(state.acceleration-motion.gravityAcceleration(state.q)),1e-8);
    }
  assert.ok(at(e.release.time-1e-4).reaction>0);
  assert.ok(Math.abs(at(e.release.time).reaction)<1e-6);
  assert.ok(motion.contactAtAngle(p.inputStart-p.omega*(e.release.time+1e-4)).reaction<0);
  assert.equal(at(e.release.time+1e-4).stage,'gravity-fall');
});

test('072 free fall follows gravity and conserves energy between release and impact',()=>{
  const initial=at(e.release.time),energy=motion.energy(initial.q,initial.velocity);
  for(let i=1;i<400;i++){
    const time=e.release.time+(e.landing.time-e.release.time)*i/400,state=at(time),h=1e-6;
    assert.equal(state.stage,'gravity-fall');assert.ok(state.velocity>0);
    near(motion.energy(state.q,state.velocity),energy,1e-8);
    near((at(time+h).velocity-at(time-h).velocity)/(2*h),motion.gravityAcceleration(state.q),1e-5);
  }
  near(at(e.landing.time-1e-8).velocity,e.landing.velocity,1e-6);
  assert.equal(at(e.landing.time).velocity,0);
  assert.ok(motion.mass.inertiaPerMass*e.landing.velocity**2/2>1);
});

test('072 preserves contact continuity and exact event classification across cycles',()=>{
  for(let cycle=-3;cycle<=3;cycle++)for(const[name,event]of Object.entries(e)){
    const time=cycle*p.period+event.time,before=at(time-1e-8),exact=at(time),after=at(time+1e-8);
    near(before.q,after.q,2e-8);
    if(name==='entry')assert.ok(exact.camContactEngaged&&exact.velocity<0);
    if(name==='landing')assert.ok(exact.workpieceContactEngaged&&exact.velocity===0);
    if(name==='crest')near(exact.velocity,0,1e-9);
    if(name==='flankEnd')near(before.velocity,after.velocity,3e-8);
  }
});

test('072 rendered working solids clear the cam, workpiece and pivot throughout transitions',()=>{
  const model=makeFourLobeTiltHammer(),parts=model.root.userData.parts;
  const names=['camBody','hammerBody','striker','workpiece','pivotPin','socketLiner'];
  const data=Object.fromEntries(names.map(name=>[name,{mesh:parts[name],solid:solidSurface(parts[name].geometry),samples:surfacePoints(parts[name].geometry)}]));
  const pairs=[['camBody','hammerBody'],['striker','workpiece'],['hammerBody','pivotPin'],['hammerBody','socketLiner']];
  for(const time of [0,...Object.values(e).map(event=>event.time),(e.release.time+e.landing.time)/2]){
    model.update(time-p.initialTime);model.root.updateMatrixWorld(true);
    for(const[first,second]of pairs)for(const[a,b]of[[data[first],data[second]],[data[second],data[first]]]){
      const matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
      for(const sample of a.samples){const point=sample.clone().applyMatrix4(matrix);
        assert.ok(!b.solid.inside(point)||b.solid.distance(point)<=1e-6,`${a.mesh.name} intersects ${b.mesh.name} at ${time}`);
      }
    }
  }
  dispose(model);
});

test('072 has a front source view, supported workpiece and readable strike cadence',()=>{
  const model=makeFourLobeTiltHammer(),data=model.root.userData;
  assert.deepEqual(model.cameraDirection.toArray(),[0,0,10]);assert.equal(data.hideGround,true);
  assert.equal(data.minimumDisplayCycleSeconds,3);model.root.updateMatrixWorld(true);
  const workpiece=new THREE.Box3().setFromObject(data.parts.workpiece),anvil=new THREE.Box3().setFromObject(data.parts.anvil);
  near(workpiece.min.y,anvil.max.y,1e-7);
  const crestToImpact=(e.landing.time-e.crest.time)/p.period*data.minimumDisplayCycleSeconds;
  assert.ok(crestToImpact>.28&&crestToImpact<.4);
  assert.match(data.idealConstraints,/inelastic/);
  dispose(model);
});

test('072 striker seats in the dip of the bloom',async()=>{
  const {default:pc}=await import('polygon-clipping');
  const rot=(v,q)=>[p.pivot[0]+v[0]*Math.cos(q)-v[1]*Math.sin(q),p.pivot[1]+v[0]*Math.sin(q)+v[1]*Math.cos(q)];
  const part=name=>profile.parts.find(x=>x.name===name).shape.polygons,close=r=>[...r,r[0]];
  const bloom=part('workpiece').map(poly=>poly.map(close));
  const area=m=>m.reduce((s,poly)=>s+poly.reduce((t,r,k)=>{let a=0;for(let i=0;i<r.length-1;i++)a+=r[i][0]*r[i+1][1]-r[i+1][0]*r[i][1];return t+(k?-1:1)*Math.abs(a/2);},0),0);
  const hit=(name,q)=>part(name).reduce((s,poly)=>s+area(pc.intersection(poly.map(r=>close(r).map(v=>rot(v,q))),bloom)),0);
  for(const name of ['striker','hammerBody','hammerSleeve'])assert.ok(hit(name,p.restQ)<1e-12,name);
  // A little lower, only the striker meets the bloom: it rests on the seat's floor,
  // not on the rim, and its whole lower face bears (the overlap is a thin strip).
  assert.ok(hit('striker',p.restQ+.002)>2e-4);assert.ok(hit('hammerBody',p.restQ+.002)<1e-12);
  // The striker sits below the rim: its lowest point is under the bloom's rim line.
  const lowest=Math.min(...part('striker')[0][0].map(v=>rot(v,p.restQ)[1]));
  assert.ok(lowest<1.08,`striker bottom ${lowest}`);
});
