import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredReciprocatingWellLiftMovement as well} from '../src/simulation/authored-reciprocating-well-lifts.js';
import {createAuthoredBailingScoopMovement as scoop} from '../src/simulation/authored-bailing-scoops.js';
import {createAuthoredSwingingGutterPumpMovement as gutter} from '../src/simulation/authored-swinging-gutter-pumps.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const factories=[[459,well],[460,scoop],[461,gutter]];
const meshes=o=>{const out=[];o.traverseVisible(x=>{if(x.geometry&&!x.userData.role?.match(/water|discharge/))out.push(x);});return out;};
function fixture(create,id,run){const m=create({id});try{run(m,m.root.userData);}finally{disposeObject3D(m.root);}}
function sweep(model,d,pairs){
  const cache=new Map(),get=o=>{if(!cache.has(o))cache.set(o,{o,p:surfacePoints(o.geometry),s:solidSurface(o.geometry)});return cache.get(o);};
  for(let i=0;i<=64;i++){
    model.update(d.geometry.cycleDuration*i/64);model.root.updateMatrixWorld(true);
    for(const[aa,cc]of pairs){const a=get(aa),c=get(cc);if(!new THREE.Box3().setFromObject(a.o).intersectsBox(new THREE.Box3().setFromObject(c.o)))continue;
      for(const[v,f]of[[a,c],[c,a]]){const tr=f.o.matrixWorld.clone().invert().multiply(v.o.matrixWorld);
        for(const p of v.p){const q=p.clone().applyMatrix4(tr);if(f.s.box.distanceToPoint(q)>.001)continue;
          assert.ok(f.s.signedDistance(q,.01)>-2e-6,`${v.o.userData.role||v.o.id} / ${f.o.userData.role||f.o.id}, pose ${i}/64`);
        }
      }
    }
  }
}
for(const[id,create]of factories)test(`${id} playback retains geometry and object identities with a readable full-cycle period`,()=>fixture(create,id,(m,d)=>{
  const snapshot=()=>{const a=[];m.root.traverse(o=>a.push([o,o.geometry]));return a;};
  const before=snapshot();for(let i=0;i<200;i++)m.update(i*.137);assert.deepEqual(snapshot(),before);
  assert.equal(d.hideGround,true);assert.equal(d.minimumDisplayCycleSeconds,d.geometry.cycleDuration);
}));

test('459 rope quarters have tangent joins and clear the real pulley grooves; bucket shells clear receivers',()=>fixture(well,459,(m,d)=>{
  const b=d.blocks,g=d.geometry,pairs=[];
  for(const[arc,assembly,bucket,trough]of[[b.leftUpperArc,b.leftAssembly,b.leftBucket,b.leftTrough],[b.rightUpperArc,b.rightAssembly,b.rightBucket,b.rightTrough]]){
    const curve=arc.geometry.parameters.path,left=arc===b.leftUpperArc;
    const top=curve.getPoint(left?1:0),tangent=curve.getTangent(left?1:0);
    assert.ok(Math.abs(top.y-(g.wheelCenterY+g.pulleyRadius))<1e-12);
    assert.ok(tangent.distanceTo(new THREE.Vector3(1,0,0))<1e-12);
    assert.ok(Math.abs(top.z-assembly.pulley.position.z)<1e-12);
    pairs.push([arc,assembly.pulley.userData.tread],[assembly.axle,assembly.pulley.userData.hub]);
    for(const mesh of meshes(bucket.bucket))pairs.push([mesh,trough]);
  }
  sweep(m,d,pairs);
  const p=b.worm.userData.thread.geometry.userData.thread;
  assert.ok(p.width>0);assert.equal(p.inner,g.wormPitchRadius*.68);
  assert.match(d.solidReview.residual,/not contact-qualified/);
}));

test('460 bored pitman and scoop clear their pins, banks, receiver and actual supporting journals',()=>fixture(scoop,460,(m,d)=>{
  const b=d.blocks,pairs=[];
  for(const mover of[b.scoop,b.beam,b.pitman])for(const o of meshes(mover))for(const f of[b.base,b.leftBank,b.rightBank,b.deliveryChannel,...b.journals])pairs.push([o,f]);
  const upper=b.beam.children.find(o=>o.userData.role==='pitman-pin-seated-in-selected-beam-notch');
  for(const rod of b.pitmanBars)for(const pin of[b.scoopConnectionPin,upper])pairs.push([rod,pin]);
  for(const side of b.scoopSidePlates)for(const pin of[b.scoopConnectionPin,b.scoopPivotAxle])pairs.push([side,pin]);
  sweep(m,d,pairs);
  const surface=solidSurface(b.beamBody.geometry);
  for(const r of d.geometry.notchRadii)assert.equal(surface.inside(new THREE.Vector3(r,0,0)),false,'notches are real openings');
  for(let i=1;i<d.geometry.notchRadii.length;i++)assert.equal(surface.inside(new THREE.Vector3((d.geometry.notchRadii[i-1]+d.geometry.notchRadii[i])/2,.03,0)),true,'adjacent notches retain material');
}));

test('461 connected passages, water markers, flaps and pivot clear finite channel walls and supports',()=>fixture(gutter,461,(m,d)=>{
  const b=d.blocks,pairs=[];
  for(const o of meshes(b.swingingGutter))for(const f of[b.base,b.pivotAxle,b.journal,...meshes(b.support)])pairs.push([o,f]);
  for(const{flap,mount}of b.flaps)for(const f of[b.conduitWalls,b.conduitBack,mount.children[1]])pairs.push([flap,f]);
  for(const water of b.waterSlugs)pairs.push([water,b.conduitWalls],[water,b.conduitBack]);
  sweep(m,d,pairs);
  const surface=solidSurface(b.conduitWalls.geometry);
  for(const p of d.geometry.localPathPoints)assert.equal(surface.inside(p),false,'every junction is an actual passage');
  for(const p of d.geometry.junctionLocalPoints)assert.equal(solidSurface(b.conduitBack.geometry).inside(p.clone().setZ(-.20)),true,'finite chamber back remains');
}));

test('460 water remains inside its finite V floor and side plates at every fill pose',()=>fixture(scoop,460,(m,d)=>{
  const b=d.blocks,targets=[...b.scoopFloor,...b.scoopSidePlates].map(o=>({o,s:solidSurface(o.geometry)}));
  for(let i=0;i<=128;i++) {
    m.update(d.geometry.cycleDuration*i/128);m.root.updateMatrixWorld(true);if(!b.scoopWater.visible)continue;
    for(const{o,s}of targets){const tr=o.matrixWorld.clone().invert().multiply(b.scoopWater.matrixWorld);
      for(const p of surfacePoints(b.scoopWater.geometry)){const q=p.clone().applyMatrix4(tr);if(s.box.distanceToPoint(q)>.001)continue;assert.ok(s.signedDistance(q,.01)>-2e-6,`water / scoop at ${i}/128`);}
    }
  }
}));
