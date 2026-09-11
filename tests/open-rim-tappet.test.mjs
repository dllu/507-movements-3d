import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeOpenRimTappetIndex } from '../src/simulation/open-rim-tappet.js';
import { makeOpenRimTappetMotion } from '../src/simulation/open-rim-tappet-motion.js';
import profile from '../src/data/open-rim-tappet-profile.js';
import { makeOpenRimTappetStudy } from '../scripts/lib/open-rim-tappet-study.mjs';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';
const motion=makeOpenRimTappetMotion(profile),p=motion.parameters,study=makeOpenRimTappetStudy(p);
const dispose=model=>model.root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});

test('070 has ten studs, source circle proportions and a finite source-shaped tappet',()=>{
  const model=makeOpenRimTappetIndex(),data=model.root.userData;
  assert.equal(Object.keys(data.parts).length,18);
  assert.equal(Object.keys(data.parts).filter(n=>n.startsWith('stud')).length,10);
  assert.deepEqual([...new Set(Object.values(data.families))].sort(),['input','output']);
  assert.ok(Math.abs(p.driverRadius/p.outputRadius-1.06848864176)<1e-9);
  assert.ok(Math.abs(p.rimInner/p.rimOuter-.914203802225)<1e-9);
  assert.ok(p.rimOuter>p.rimInner&&p.rimWidth>.11);
  assert.equal(profile.tappet.length,4);
  assert.ok(p.shortening*p.scale<1.5);
  dispose(model);
});

test('070 section control reveals working parts without changing the motion',()=>{
  const model=makeOpenRimTappetIndex(),data=model.root.userData;
  assert.equal(data.hideGround,true);assert.deepEqual(model.cameraDirection.toArray(),[0,0,10]);
  assert.equal(data.minimumDisplayCycleSeconds,5);assert.equal(data.sectionView,false);
  assert.equal(data.parts.driverCover.visible,true);
  model.update(.35);const before={...data.kinematics};
  data.setSectionView(true);assert.equal(data.parts.driverCover.visible,false);
  assert.equal(data.parts.rim.visible,true);assert.equal(data.parts.tappet.visible,true);
  model.update(.35);assert.deepEqual(data.kinematics,before);
  data.setSectionView(false);assert.equal(data.parts.driverCover.visible,true);
  const box=name=>new THREE.Box3().setFromObject(data.parts[name]);model.root.updateMatrixWorld(true);
  assert.ok(box('driverCover').min.z-box('stud0').max.z>.029);
  assert.ok(box('rim').min.z-box('outputPlate').max.z>.059);
  dispose(model);
});

test('070 stays seated until physical tappet contact and advances exactly one pitch per turn',()=>{
  const before=motion.atAngle(p.entryAngle-1e-5),after=motion.atAngle(p.entryAngle+1e-5);
  assert.equal(before.outputSpeed,0);assert.equal(before.outputAngle,p.initialQ);
  assert.ok(after.outputSpeed<-.9&&after.outputSpeed> -1.1);
  assert.ok(study.atAngle(before.angle)(0)<1e-7);
  assert.ok(study.atAngle(after.angle)(0)>1e-6);
  assert.ok(study.atAngle(after.angle)(after.advance)<1e-7);
  for(const time of [-30,-.2,0,.5,1.05,3,12,70]){
    const a=motion.atTime(time),b=motion.atTime(time+p.period);
    assert.ok(Math.abs(b.outputAngle-a.outputAngle+p.pitch)<1e-11);
    assert.ok(Math.abs(b.inputAngle-a.inputAngle-p.period)<1e-11);
  }
  assert.ok(Math.abs(motion.atTime(10*p.period).outputAngle-motion.atTime(0).outputAngle+2*Math.PI)<1e-11);
});

test('070 exact side and corner contacts clear every finite stud through a full input turn',()=>{
  let previous=p.initialQ,peak=0;
  for(let i=0;i<=2500;i++){
    const angle=p.period*i/2500,state=motion.atAngle(angle);
    assert.ok(state.outputAngle<=previous+1e-11);assert.ok(state.outputSpeed<1e-10);
    assert.ok(study.atAngle(angle)(state.advance)<1e-7,`Finite stud interference at ${angle}`);
    previous=state.outputAngle;peak=Math.max(peak,-state.outputSpeed);
  }
  assert.ok(peak>1.66&&peak<1.68);
  assert.equal(motion.atAngle(p.exitAngle+.01).advance,p.pitch);
  assert.equal(motion.atAngle(p.period-1e-8).outputSpeed,0);
});

test('070 reported velocity agrees with motion and compressive contact through every stage',()=>{
  for(const stage of motion.stages)for(const fraction of [.01,.1,.35,.7,.9,.99]){
    const angle=stage.begin+fraction*(stage.end-stage.begin),state=motion.atAngle(angle),h=1e-7;
    const difference=(motion.atAngle(angle+h).outputAngle-motion.atAngle(angle-h).outputAngle)/(2*h);
    assert.ok(Math.abs(difference-state.outputSpeed)<1e-6);
    const contacts=study.contactsAtAngle(angle,state.advance,1e-7);
    assert.ok(contacts.some(c=>c.outputMoment<0&&c.inputMoment>0
      &&Math.abs(c.inputMoment-c.outputMoment*state.outputSpeed)<1e-7));
  }
});

test('070 geometric events are position-continuous and preserve the resisting-load pause',()=>{
  for(const angle of [p.entryAngle,p.firstCornerAngle,p.tipSideAngle,p.lastCornerAngle,p.releaseAngle,p.rimEntryAngle,p.exitAngle]){
    const a=motion.atAngle(angle-1e-8),b=motion.atAngle(angle+1e-8);
    assert.ok(Math.abs(a.outputAngle-b.outputAngle)<4e-8,`Jump at ${angle}`);
  }
  const paused=motion.atAngle((p.releaseAngle+p.rimEntryAngle)/2);
  assert.equal(paused.outputSpeed,0);assert.equal(paused.outputAngle,p.releaseQ);
  assert.ok(p.pitch-paused.advance>.001&&p.pitch-paused.advance<.002);
  assert.ok(study.atAngle(p.rimEntryAngle+1e-5)(paused.advance)>1e-6);
  assert.ok(motion.atAngle(p.rimEntryAngle+1e-5).outputSpeed<-.2);
  assert.equal(motion.atAngle(p.exitAngle+1e-6).outputSpeed,0);
});

test('070 actual tappet, rim and cover clear the driven stud at contact transitions',()=>{
  const model=makeOpenRimTappetIndex(),parts=model.root.userData.parts;
  const data=Object.fromEntries(['tappet','rim','driverCover','stud0'].map(name=>[name,{mesh:parts[name],
    solid:solidSurface(parts[name].geometry),samples:surfacePoints(parts[name].geometry)}]));
  for(const angle of [p.entryAngle,p.firstCornerAngle,p.tipSideAngle,p.lastCornerAngle,p.releaseAngle,p.rimEntryAngle,p.exitAngle,0]){
    model.update(angle-p.initialInputPhase);model.root.updateMatrixWorld(true);
    for(const name of ['tappet','rim','driverCover'])for(const[a,b]of[[data[name],data.stud0],[data.stud0,data[name]]]){
      const matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
      for(const sample of a.samples){const point=sample.clone().applyMatrix4(matrix);
        assert.ok(!b.solid.inside(point)||b.solid.distance(point)<=1e-6,`${a.mesh.name} penetrates ${b.mesh.name} at ${angle}`);
      }
    }
  }
  dispose(model);
});

test('070 seats in both directions with one interior stud and blocks attempted overtravel',()=>{
  assert.ok(2*p.lockSeat>0&&2*p.lockSeat<.00032);
  const field=study.atAngle(0);
  for(let index=0;index<10;index++)for(const sign of [-1,1]){
    const q=sign*p.lockSeat-index*p.pitch;
    assert.ok(field(p.initialQ-q)<1e-7);
    assert.ok(field(p.initialQ-q-sign*.001)>1e-5);
  }
  const interiorRadius=Math.abs(p.centerDistance-p.studOrbit);
  assert.ok(interiorRadius+p.studRadius<p.rimInner);
});
