import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {makeWiperStampDrive} from '../src/simulation/wiper-stamp.js';
import {surfaceTriangles,surfacePoints,solidSurface} from './helpers/solid-surface.mjs';

const near=(a,b,tolerance=1e-9)=>assert(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const dispose=m=>m.root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});

test('085 uses symmetric wipers, a flat projection, bored guides and the rotating shaft',()=>{
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

test('085 wipers are identical and 180 degrees apart; playback tracks the finite cap within the bound',()=>{
  const m=makeWiperStampDrive(),u=m.root.userData,[first,second]=u.profiles.wipers.map(p=>p[0][0]);
  assert.equal(first.length,second.length);
  for(let i=0;i<first.length;i++){near(second[i][0],-first[i][0],1e-12);near(second[i][1],-first[i][1],1e-12);}
  // Point symmetry of the whole cap outline under a half turn.
  const outline=u.profiles.camOuter[0][0];
  for(const p of outline){const q=[-p[0],-p[1]];let d=Infinity;for(const r of outline)d=Math.min(d,Math.hypot(r[0]-q[0],r[1]-q[1]));assert(d<2e-3,`asymmetric at ${p}`);}
  for(let i=0;i<=600;i++){const s=u.stateAtTime(13*i/600);assert(s.projection*u.source.scale<=.002+1e-10);}
  // Both lifts in a cycle are identical.
  for(let i=0;i<=100;i++){const t=1+2*i/100;near(u.stateAtTime(t).stampY,u.stateAtTime(t+2).stampY,1e-6);}
  assert.throws(()=>u.stateAtTime(NaN));assert.throws(()=>u.stateAtTime(Infinity));dispose(m);
});

test('085 retains startup, upward release and gravity fall, and repeats seamlessly from bed dwell',()=>{
  const m=makeWiperStampDrive(),u=m.root.userData,at=u.stateAtTime;
  near(at(0).stampY,0);assert(at(.05).stampY>0);near(at(.05).stampY,u.motion.contact.support(at(.05).camAngle).height,1e-5);assert(at(2.08).stampY>at(2.06).stampY);assert(at(2.2).stampY<at(2.10).stampY);
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
