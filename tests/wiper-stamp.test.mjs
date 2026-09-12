import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {makeWiperStampDrive} from '../src/simulation/wiper-stamp.js';
import {makeWiperStampCandidate} from '../scripts/lib/wiper-stamp-candidate.mjs';
import {makeWiperStampPlayback} from '../scripts/lib/wiper-stamp-playback.mjs';
import {surfaceTriangles,surfacePoints,solidSurface} from './helpers/solid-surface.mjs';

const near=(a,b,tolerance=1e-9)=>assert(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const dispose=m=>m.root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});

test('085 uses source-shaped wipers, a flat projection, bored guides and the rotating shaft',()=>{
  const m=createMovementModel({id:85}),u=m.root.userData;
  assert.equal(u.mechanism,'two-wiper-flat-projection-gravity-stamp');assert.equal(u.fidelity,'authored');assert(u.hideGround);
  assert.equal(u.families.inputShaft,'cam');near(u.animationTiming.playbackTimeScale,1);near(u.playbackPeriod,4);
  near((u.geometry.projection.right-u.geometry.projection.left)*u.source.scale,59,1e-5);
  assert(u.geometry.guideEngagementAtRestPixels>18.9);
  const rod=u.parts.rectangularRodA.geometry.boundingBox??new THREE.Box3().setFromBufferAttribute(u.parts.rectangularRodA.geometry.attributes.position);
  for(const [name,y]of [['boredGuide0',1.3],['boredGuide1',-1.25]]){
    const solid=solidSurface(u.parts[name].geometry),x=(rod.min.x+rod.max.x)/2,z=(rod.min.z+rod.max.z)/2;
    assert.equal(solid.inside(new THREE.Vector3(x,y,z)),false,'Rod passage is open');
    assert.equal(solid.inside(new THREE.Vector3(x-.20,y,z)),true,'Guide has a finite side wall');
  }
  dispose(m);
});

test('085 fifteen parts are closed solids with outward winding',()=>{
  const m=makeWiperStampDrive();assert.equal(Object.keys(m.root.userData.parts).length,15);
  for(const[name,mesh]of Object.entries(m.root.userData.parts)){
    const edges=new Map();let volume=0;
    for(const t of surfaceTriangles(mesh.geometry)){
      assert(t.getArea()>1e-14,name+' degenerate face');volume+=t.a.dot(t.b.clone().cross(t.c))/6;
      const keys=[t.a,t.b,t.c].map(v=>v.toArray().join(','));
      for(let i=0;i<3;i++){const a=keys[i],b=keys[(i+1)%3],key=[a,b].sort().join('/'),e=edges.get(key)??{count:0,sign:0};e.count++;e.sign+=a<b?1:-1;edges.set(key,e);}
    }
    assert(volume>0,name+' volume');assert([...edges.values()].every(e=>e.count===2&&e.sign===0),name+' closure');
  }
  dispose(m);
});

test('085 production preserves the reviewed finite geometry and projected motion',()=>{
  const m=makeWiperStampDrive(),u=m.root.userData,candidate=makeWiperStampCandidate(),motion=makeWiperStampPlayback(candidate,u.profile);
  for(const[name,mesh]of Object.entries(u.parts)){
    const original=candidate.root.userData.parts[name];
    for(const attr of ['position','normal'])assert.deepEqual(mesh.geometry.attributes[attr].array,original.geometry.attributes[attr].array,name);
    assert.deepEqual(mesh.geometry.index?.array,original.geometry.index?.array,name);
  }
  for(let i=0;i<=300;i++){
    const time=13*i/300,actual=u.stateAtTime(time),expected=motion.sample(time);assert.deepEqual(actual,expected);
    assert(actual.projection*u.source.scale<=.002+1e-10);m.update(time);candidate.setState(expected);
    for(const[name,mesh]of Object.entries(u.parts))assert.deepEqual(mesh.matrixWorld.elements,candidate.root.userData.parts[name].matrixWorld.elements,name);
  }
  assert.throws(()=>u.stateAtTime(NaN));assert.throws(()=>u.stateAtTime(Infinity));dispose(m);dispose(candidate);
});

test('085 retains startup, upward release and gravity fall, and repeats seamlessly from bed dwell',()=>{
  const m=makeWiperStampDrive(),u=m.root.userData,at=u.stateAtTime;
  near(at(0).stampY,0);assert(at(.02).stampY<0);assert(at(2.08).stampY>at(2.06).stampY);assert(at(2.2).stampY<at(2.10).stampY);
  const acceleration=(at(2.21).stampY-2*at(2.20).stampY+at(2.19).stampY)/.01**2;near(acceleration,-9.81,.08);
  near(at(1).stampY,u.geometry.minimumStampY);near(at(5).stampY,u.geometry.minimumStampY);near(at(5.01).stampY,u.geometry.minimumStampY);
  for(let i=0;i<=200;i++){
    const a=at(1+4*i/200),b=at(5+4*i/200);near(a.stampY,b.stampY);near(Math.sin(a.camAngle),Math.sin(b.camAngle));near(Math.cos(a.camAngle),Math.cos(b.camAngle));
    m.update(1+4*i/200);assert(u.cameraFitBounds.containsBox(new THREE.Box3().setFromObject(m.root,true)));
  }
  dispose(m);
});

test('085 cams, guides and bed have finite clearance during lift, release and impact',()=>{
  const m=makeWiperStampDrive(),u=m.root.userData,parts=Object.entries(u.parts).map(([name,mesh])=>({name,mesh,solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}));
  for(const time of [0,.02,.0465,.12,.192,.25,.37525,1,1.595,2,2.043,2.10,2.2,2.332125,3.784,5.00001]){
    m.update(time);
    for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
      if(u.families[parts[i].name]===u.families[parts[j].name])continue;
      for(const[a,b]of [[parts[i],parts[j]],[parts[j],parts[i]]]){
        const transform=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
        if(!a.solid.box.clone().applyMatrix4(transform).intersectsBox(b.solid.box))continue;
        for(const p of a.points){const q=p.clone().applyMatrix4(transform);if(b.solid.inside(q))assert(b.solid.distance(q)<=1e-6,`${a.name} inside ${b.name} at ${time}`);}
      }
    }
  }
  dispose(m);
});
