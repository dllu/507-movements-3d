import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import clip from 'polygon-clipping';
import {createAuthoredMirrorPolisherMovement as mirror} from '../src/simulation/authored-mirror-polishers.js';
import {createAuthoredLensPolisherMovement as lens} from '../src/simulation/authored-lens-polishers.js';
import {surfacePoints,solidSurface,surfaceTriangles} from './helpers/solid-surface.mjs';

for(const id of [370,393])test(`${id}: finite repaired polishing interfaces over the full input cycle`,()=>{
  const m=(id===370?mirror:lens)({id,description:''}),r=m.root,b=r.userData.blocks;
  const pairs=id===370?[[b.crankShaft,b.crankBearing],[b.crankShaft,b.upperRail],[b.crankPinBoss,b.barBody],[b.crankPinBoss,b.upperEye],[b.barBody,b.upperRail],[b.barBody,b.lowerRail],...b.guidePins.map(p=>[b.barBody,p]),[b.mirrorAxle,b.barBody],[b.sLinkBody,b.ratchetWheel],[b.sLinkBody,b.mirrorBacking],[b.sLinkBody,b.eccentricDisk],[b.sLinkBody,b.rodKeeper],[b.sLinkBody,b.mirrorAxle],[b.sLinkBody,b.lowerRail],...b.guidePins.map(p=>[b.sLinkBody,p]),[b.rodKeeper,b.lowerRail],[b.eccentricDisk,b.barBody],[b.ratchetWheel,b.lowerRail]]
    :[[b.shaft,b.upperBearing],[b.shaft,b.handwheel],[b.ball,b.cupRotor.userData.socket],[b.ballStem,b.cupRotor.userData.socket],[b.ball,b.cupRotor.userData.outerShell],[b.lens.userData.hemisphere,b.cupRotor.userData.outerShell]];
  const samples=new Map(),solids=new Map();for(const[a,c]of pairs){if(!samples.has(a))samples.set(a,surfacePoints(a.geometry));if(!solids.has(c))solids.set(c,solidSurface(c.geometry));}
  const period=id===370?r.userData.geometry.inputCyclePeriod:r.userData.motion.inputCycleDuration;let queries=0;
  for(let i=0;i<=32;i++){
    m.update(period*i/32);r.updateMatrixWorld(true);
    if(id===370){const tr=b.ratchetWheel.matrixWorld.clone().invert().multiply(b.sLinkBody.matrixWorld),ring=r.userData.sLink.polygons[0][0].map(([x,y])=>{const e=r.userData.geometry;const q=new THREE.Vector3(x-e.eccentricity,y,0).applyMatrix4(tr);return[q.x,q.y];});
      const overlap=clip.intersection([[ring]],[[b.ratchetWheel.userData.ratchetProfile.outline]]),area=overlap.reduce((sum,p)=>sum+Math.abs(p[0].reduce((a,v,j)=>{const w=p[0][(j+1)%p[0].length];return a+v[0]*w[1]-v[1]*w[0];},0))/2,0);assert.ok(area<1e-10,`S-link area overlap ${area}`);
    }
    for(const[a,c]of pairs){const transform=c.matrixWorld.clone().invert().multiply(a.matrixWorld),solid=solids.get(c);
      for(const p of samples.get(a)){const q=p.clone().applyMatrix4(transform);queries++;
        if(solid.inside(q))assert.ok(solid.distance(q)<1e-5,`${id}: ${a.userData.role} enters ${c.userData.role} at ${i}: ${solid.distance(q)} (${q.toArray()})`);
      }
    }
  }
  console.log({id,queries});assert.equal(r.userData.hideGround,true);assert.ok(m.cameraDirection);
  r.traverse(o=>{for(const mat of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])assert.equal(mat.fog,false);});
  const ids=()=>{let result=[];r.traverse(o=>{if(o.geometry)result.push(o.geometry.uuid);});return result;};const initial=ids();for(let i=0;i<100;i++)m.update(i*.073);assert.deepEqual(ids(),initial);
});


test('370 S-link hook drops continuously, drives one tooth per turn and rests on the teeth',()=>{
 // Brown's S-shaped eccentric rod hooks the ratchet's left-hand teeth and
 // pushes them down (anticlockwise): one pitch per crank turn, its pose
 // continuous over time, including its finite-rate fall onto the next flank.
 const m=mirror({id:370}),r=m.root,b=r.userData.blocks,g=r.userData.geometry,pitch=2*Math.PI/12,link=b.sLinkBody;
 assert.equal(g.clickHand,1);
 const steps=[];for(const N of [1000,8000]){let previous=null,max=0;for(let i=0;i<=N;i++){m.update(g.inputCyclePeriod*i/N);const a=link.rotation.z;if(previous!==null)max=Math.max(max,Math.abs(a-previous));previous=a;}steps.push(max);}
 assert.ok(steps[1]<steps[0]/4&&steps[1]<.003,`hook steps ${steps}`);
 const s0=r.userData.stateAtTime(0),s1=r.userData.stateAtTime(g.inputCyclePeriod);
 assert.ok(Math.abs(s1.ratchetAngle-s0.ratchetAngle-pitch)<1e-9,'one tooth per turn');
 const ring=r.userData.sLink.polygons[0][0],points=ring.flatMap((p,i)=>{const q=ring[(i+1)%ring.length];return Array.from({length:4},(_,j)=>new THREE.Vector3(p[0]+(q[0]-p[0])*j/4-g.eccentricity,p[1]+(q[1]-p[1])*j/4,0));}),solid=solidSurface(b.ratchetWheel.geometry);let largestGap=0,smallestGap=Infinity,falling=0;
 for(let i=0;i<=64;i++){m.update(g.inputCyclePeriod*i/64);r.updateMatrixWorld(true);const tr=b.ratchetWheel.matrixWorld.clone().invert().multiply(link.matrixWorld);let gap=Infinity;
  for(const p of points){const q=p.clone().applyMatrix4(tr);q.z=0;gap=Math.min(gap,solid.distance(q,gap));}smallestGap=Math.min(smallestGap,gap);
  // Off the teeth only while it falls from the passed tip.
  if(gap>=.01)falling++;else largestGap=Math.max(largestGap,gap);}
 assert.ok(smallestGap>.0005,`smallest gap ${smallestGap}`);assert.ok(largestGap<.01,`largest gap ${largestGap}`);assert.ok(falling<=2,`${falling} poses off the teeth`);
 console.log({smallestGap,largestGap,falling});
});


test('393 closed cup and socket have outward signed volume',()=>{
 const model=lens({id:393}),cup=model.root.userData.blocks.cupRotor.userData;
 for(const mesh of[cup.outerShell,cup.socket]){let volume=0;for(const t of surfaceTriangles(mesh.geometry))volume+=t.a.dot(t.b.clone().cross(t.c))/6;assert.ok(volume>0,`${mesh.userData.role} is inverted`);}
});
