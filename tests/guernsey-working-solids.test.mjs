import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createMovementModel} from '../src/simulation/registry.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
import {guernsey402,guernsey402Design,guernsey402Pallets,guernsey402Lever,wheelClear,bakeGuernsey402} from '../src/simulation/guernsey-anchor.js';
import {guernseyAnchorBake} from '../src/simulation/baked/guernsey-anchor-402.js';
const m=createMovementModel(JSON.parse(readFileSync(new URL('../src/data/movements.json',import.meta.url))).movements[401]),r=m.root,b=r.userData.blocks;
const pairs=[];
for(const[gear,rack]of[[b.upperBalance.workingPinion,b.externalRack],[b.leftBalance.workingPinion,b.internalRack]])for(const tooth of[rack.children[0],...rack.userData.teeth])pairs.push([gear,tooth]);
pairs.push([b.escapeWheelPlate,b.anchorPlate]);
const points=new Map(),solids=new Map();for(const p of pairs.flat()){if(!points.has(p.geometry))points.set(p.geometry,surfacePoints(p.geometry));if(!solids.has(p.geometry))solids.set(p.geometry,solidSurface(p.geometry));}
test('402 actual sector/pinion and anchor/wheel plate surfaces clear over a full cycle',()=>{
 let worst={distance:1};
 for(const time of [...Array.from({length:161},(_,i)=>i/40)]){
  m.update(time);r.updateMatrixWorld(true);
  for(const pair of pairs)for(const[a,z]of[pair,[...pair].reverse()]){
   const mat=z.matrixWorld.clone().invert().multiply(a.matrixWorld),solid=solids.get(z.geometry);
   for(const pt of points.get(a.geometry)){
    const p=pt.clone().applyMatrix4(mat);if(solid.box.distanceToPoint(p)>.003)continue;
    const d=solid.signedDistance(p,.003);
    if(d<worst.distance)worst={distance:d,time,a:a.userData.role,z:z.userData.role};
   }
  }
 }
 console.log(JSON.stringify(worst));
 assert.ok(worst.distance > -2e-5,JSON.stringify(worst));
});

test('402 the baked wheel is the finite anchor contact: regenerable, clear, and one tooth per period',()=>{
 const again=bakeGuernsey402();
 assert.deepEqual(again.angles,guernseyAnchorBake.angles);
 const design=guernsey402Design(),pallets=guernsey402Pallets(design),O=guernsey402.wheelCenter,n=guernseyAnchorBake.angles.length-1;
 near(guernseyAnchorBake.angles[0]-guernseyAnchorBake.angles[n],design.pitch,1e-12);
 for(let i=0;i<=n;i++){const t=guernseyAnchorBake.period*i/n;assert.ok(wheelClear(design,O,guernseyAnchorBake.angles[i]+1e-7,pallets,guernsey402Lever(t)),`bake knot ${i} penetrates`);}
});

test('402 each half period locks on one pallet, impulses, drops and locks on the other',()=>{
 const seen=[];let last=null;
 for(let i=0;i<=800;i++){const s=r.userData.stateAtTime(8*i/800),c=s.activePalletContact;const key=c?c.side:'free';if(key!==last){seen.push(key);last=key;}}
 const locks=seen.filter(k=>k!=='free');
 for(let i=1;i<locks.length;i++)assert.notEqual(locks[i],locks[i-1],'pallets alternate');
 assert.ok(locks.length>=4 && seen.includes('free'),JSON.stringify(seen));
 // Locks are dead or nearly so: the wheel never runs back by more than a
 // small recoil, and advances exactly half a pitch per half period.
 const design=guernsey402Design();
 for(let beat=0;beat<4;beat++){const a=r.userData.stateAtTime(beat*2+.001).wheelAngle,z=r.userData.stateAtTime(beat*2+2.001).wheelAngle;assert.ok(a-z>.35*design.pitch&&a-z<.65*design.pitch,`half-period advance ${a-z}`);near(r.userData.stateAtTime(beat*2+.001).wheelAngle-r.userData.stateAtTime(beat*2+4.001).wheelAngle,design.pitch,1e-9);}
 let recoil=0;for(let i=1;i<=guernseyAnchorBake.angles.length-1;i++)recoil=Math.max(recoil,guernseyAnchorBake.angles[i]-guernseyAnchorBake.angles[i-1]);
 assert.ok(recoil<0.002,`per-step recoil ${recoil}`);
});
function near(a,e,t){assert.ok(Math.abs(a-e)<=t,`${a} vs ${e}`);}

test('402 anchor A and the escape wheel are single plates in one plane with no hidden arms or pins',()=>{
 assert.equal(b.anchorArms.length,0);assert.deepEqual(b.palletBodies,[b.anchorPlate]);
 const a=b.anchorPlate.geometry.userData.plate,w=b.escapeWheelPlate.geometry.userData.plate;
 assert.equal(a.polygons.length,1);assert.equal(w.polygons.length,1);
 m.update(0);r.updateMatrixWorld(true);
 const za=new THREE.Box3().setFromObject(b.anchorPlate),zw=new THREE.Box3().setFromObject(b.escapeWheelPlate);
 assert.ok(Math.abs(za.min.z-zw.min.z)<1e-6 && Math.abs(za.max.z-zw.max.z)<1e-6);
 assert.equal(b.escapeWheelRotor.children.filter(o=>o.isMesh&&o.visible&&/tooth|foot|head|web|rim/.test(o.userData.role)).length,0);
});

test('402 journals clear actual arbor surfaces',()=>{
 m.update(0);r.updateMatrixWorld(true);
 const groups=[
  [b.leverShaft,[b.leverHub,b.leverBearing,b.anchorPlate,...b.rackArms,...b.frameBars]],
  [b.escapeShaft,[b.escapeWheelHub,b.escapeBearing,b.escapeWheelPlate,...b.frameBars]],
  [b.upperBalance.shaft,[b.upperBalance.hub,b.upperBalance.bearing,b.upperBalance.workingPinion,...b.upperBalance.spokes,...b.frameBars]],
  [b.leftBalance.shaft,[b.leftBalance.hub,b.leftBalance.bearing,b.leftBalance.workingPinion,...b.leftBalance.spokes,...b.frameBars]],
 ];
 for(const[shaft,targets]of groups)for(const target of targets){
  const solid=solidSurface(target.geometry),matrix=target.matrixWorld.clone().invert().multiply(shaft.matrixWorld);
  for(const point of surfacePoints(shaft.geometry)){
   const local=point.clone().applyMatrix4(matrix);
   if(solid.box.distanceToPoint(local)>.004)continue;
   assert.ok(solid.signedDistance(local)>-1e-6,`shaft intrudes ${target.userData.role}`);
  }
 }
});

test('402 both involute meshes retain nearby working flanks throughout their oscillation',()=>{
 const samples=[];
 for(const[pinion,rack,label]of[[b.upperBalance.workingPinion,b.externalRack,'external'],[b.leftBalance.workingPinion,b.internalRack,'internal']]){
  let maximumGap=0;
  for(let pose=0;pose<=32;pose++){
   m.update(pose/8);r.updateMatrixWorld(true);let best=Infinity;
   for(const tooth of rack.userData.teeth){
    const matrix=pinion.matrixWorld.clone().invert().multiply(tooth.matrixWorld),solid=solids.get(pinion.geometry);
    for(const p of points.get(tooth.geometry))best=Math.min(best,solid.distance(p.clone().applyMatrix4(matrix),best));
   }
   maximumGap=Math.max(maximumGap,best);assert.ok(best<.003,`${label} flank gap ${best}`);
  }
  samples.push({label,maximumGap});
 }
 console.log(JSON.stringify({gearContact:samples}));
});

test('402 effective camera, scene flags, separate balances and buffers remain stable',()=>{
 assert.ok(m.cameraDirection.z>15);assert.equal(r.userData.hideGround,true);
 assert.equal(r.userData.minimumDisplayCycleSeconds,6);
 const counts=()=>{let n=0;const g=[];r.traverse(o=>{n++;if(o.geometry)g.push(o.geometry.attributes.position);});return{n,g};};
 const before=counts();
 for(let i=0;i<=16;i++){m.update(i/4);r.updateMatrixWorld(true);
  const a=new THREE.Box3().setFromObject(b.upperBalance.rim),z=new THREE.Box3().setFromObject(b.leftBalance.rim);
  assert.ok(a.min.z>z.max.z);
 }
 const after=counts();assert.equal(after.n,before.n);assert.deepEqual(after.g,before.g);
 r.traverse(o=>{for(const mat of[o.material].flat().filter(Boolean))assert.equal(mat.fog,false);if(o.isMesh)assert.equal(o.castShadow,true);});
});
