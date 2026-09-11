import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createMovementModel,applyDisplayTiming} from '../src/simulation/registry.js';
import {surfaceTriangles,surfacePoints,solidSurface} from './helpers/solid-surface.mjs';
import {triangleTree,meshPairDistance} from '../scripts/lib/star-mangle-pair-distance.mjs';
const catalog=JSON.parse(await readFile(new URL('../src/data/movements.json',import.meta.url)));
const model=createMovementModel(catalog.movements[64]),{parts,geometry:p,stateAtTime}=model.root.userData;
const near=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<tolerance,`${a} versus ${b}`);
const atPhase=phase=>{const time=(p.sourceGamma-p.gammaStart+phase)/p.inputSpeed;model.update(time);model.root.updateMatrixWorld(true);return time;};
const trees=new Map(),tree=mesh=>{if(!trees.has(mesh))trees.set(mesh,triangleTree(new THREE.BufferGeometry().setFromPoints(surfaceTriangles(mesh.geometry).filter(t=>Math.abs(t.getNormal(new THREE.Vector3()).z)<.01).flatMap(t=>[t.a,t.b,t.c]))));return trees.get(mesh);};
const closest=(a,b,maximum=.02)=>meshPairDistance(tree(parts[a]),tree(parts[b]),parts[b].matrixWorld.clone().invert().multiply(parts[a].matrixWorld),maximum);
const centers={input:new THREE.Vector3(),output:new THREE.Vector3(p.D,0,0),stop:new THREE.Vector3(...p.pivot,0)};
const contact=(a,b,first,second)=>{
 const result=closest(a,b);assert.ok(result.witness,`${a}/${b}: working witness`);assert.ok(result.distance<1e-5,`${a}/${b}: finite working gap`);
 const w=result.witness,A=new THREE.Vector3().fromArray(w.a).applyMatrix4(parts[b].matrixWorld),B=new THREE.Vector3().fromArray(w.b).applyMatrix4(parts[b].matrixWorld);
 const n=result.distance>1e-9?B.clone().sub(A).normalize():new THREE.Vector3().fromArray(w.aNormal).transformDirection(parts[b].matrixWorld);
 return {a:A.clone().sub(centers[first]).cross(n.clone().negate()).z,b:B.clone().sub(centers[second]).cross(n).z,gap:result.distance};
};

test('065 finite rounded tappet joins its flat face and brings a full pitch to rest',()=>{
 const span=p.gammaStart-p.gammaEnd,join=p.gammaStart-p.gammaTipStart,h=1e-6;
 for(const phase of [join,span]){
  const time=atPhase(phase),left=stateAtTime(time-h),center=stateAtTime(time),right=stateAtTime(time+h);
  near(left.outputAngle,right.outputAngle,4e-6);
  near((center.outputAngle-left.outputAngle)/h,(right.outputAngle-center.outputAngle)/h,5e-5);
 }
 const endTime=atPhase(span);near(stateAtTime(endTime).outputAngle,p.pitch);
 near((stateAtTime(endTime).outputAngle-stateAtTime(endTime-1e-5).outputAngle)/1e-5,0,1e-4);
 let previous=-Infinity,minStop=0;
 for(let i=0;i<=512;i++){
  const time=atPhase(span*i/512),state=stateAtTime(time);assert.ok(state.outputAngle>=previous-1e-12);previous=state.outputAngle;minStop=Math.min(minStop,state.stopAngle);
 }
 assert.ok(minStop<-.22&&minStop>-.23);
 for(const phase of [.8,1.7,3.9,6.1]){const t=atPhase(phase);near(stateAtTime(t).stopAngle,0);near(stateAtTime(t).outputAngle,p.pitch);}
});

test('065 all 22 physical solids are closed and have outward stored normals',()=>{
 assert.equal(Object.keys(parts).length,22);
 for(const[name,mesh]of Object.entries(parts)){
  const g=mesh.geometry,edges=new Map();let volume=0;
  for(const[i,face]of surfaceTriangles(g).entries()){
   const normal=face.getNormal(new THREE.Vector3()),stored=new THREE.Vector3();
   for(let j=0;j<3;j++)stored.add(new THREE.Vector3().fromBufferAttribute(g.attributes.normal,g.index?g.index.getX(i*3+j):i*3+j));
   assert.ok(normal.dot(stored)>0,`${name}: outward nondegenerate triangle`);volume+=face.a.dot(face.b.clone().cross(face.c))/6;
   const keys=[face.a,face.b,face.c].map(q=>q.toArray().map(x=>Math.round(x*1e9)).join(','));
   for(let j=0;j<3;j++){const a=keys[j],b=keys[(j+1)%3],k=a<b?`${a}/${b}`:`${b}/${a}`,e=edges.get(k)??{count:0,direction:0};e.count++;e.direction+=a<b?1:-1;edges.set(k,e);}
  }
  assert.ok(volume>0,`${name}: positive volume`);assert.ok([...edges.values()].every(e=>e.count===2&&e.direction===0),`${name}: two opposing faces per edge`);
 }
});

test('065 actual contact normals transmit compatible motion with positive reactions',()=>{
 const span=p.gammaStart-p.gammaEnd;
 for(let i=0;i<11;i++){
  const time=atPhase(span*(i+.317)/11),h=1e-5,before=stateAtTime(time-h),after=stateAtTime(time+h);
  const wd=(after.outputAngle-before.outputAngle)/(2*h),ws=(after.stopAngle-before.stopAngle)/(2*h);
  const t=contact('tappet','stud0','input','output'),s=contact('stopBody','stud2','stop','output'),c=contact('driverDisk','stopToe','input','stop');
  for(const[q,wa,wb]of[[t,-p.inputSpeed,wd],[s,ws,wd],[c,-p.inputSpeed,ws]])assert.ok(Math.abs(q.a*wa+q.b*wb)<.006,'actual normal power residual');
  assert.ok(t.b>0&&c.b>0&&s.a<0,'finite normals have the required driving and opposing moments');
  const ns=.25,nt=(1-s.b*ns)/t.b,nc=-s.a*ns/c.b;
  assert.ok(nt>0&&nc>0);near(t.b*nt+s.b*ns,1);near(c.b*nc+s.a*ns,0);
 }
});

test('065 two adjacent studs and the input rim lock both output directions',()=>{
 for(const cycle of [0,3,8]){
  atPhase(1+cycle*Math.PI*2);
  const nearest=Array.from({length:10},(_,i)=>({name:'stud'+i,gap:closest('stopBody','stud'+i,.05).distance})).sort((a,b)=>a.gap-b.gap).slice(0,2);
  const contacts=nearest.map(q=>contact('stopBody',q.name,'stop','output')),cam=contact('driverDisk','stopToe','input','stop');
  assert.ok(contacts[0].b*contacts[1].b<0,'opposite output moments');
  const constraints=[[0,cam.b],...contacts.map(q=>[q.b,q.a])];
  for(let i=0;i<1440;i++){
   const a=Math.PI*2*i/1440,min=Math.min(...constraints.map(([x,y])=>x*Math.cos(a)+y*Math.sin(a)));
   assert.ok(min<-.1,'every nonzero output/stop velocity violates a contact constraint');
  }
 }
});

test('065 finite toe, pivot bore and axial contact layers clear their neighbors',()=>{
 const pairs=[['driverDisk','stopToe'],['drivenDisk','stopBody'],['drivenDisk','tappet'],['stopBody','fixedPivot'],['tappet','frontPivotHead'],['stopBody','frontPivotHead'],['stopBody','rearPivotHead']];
 const data=Object.fromEntries([...new Set(pairs.flat())].map(name=>[name,{solid:solidSurface(parts[name].geometry),points:surfacePoints(parts[name].geometry)}]));
 for(const phase of [.00001,.249984,.281232,.327663,.499958,.501,3.8]){
  atPhase(phase);
  for(const[a,b]of pairs)for(const[from,to]of[[a,b],[b,a]]){
   const matrix=parts[to].matrixWorld.clone().invert().multiply(parts[from].matrixWorld),samples=data[from].points;
   for(let i=0;i<samples.length;i+=7){const q=samples[i].clone().applyMatrix4(matrix),solid=data[to].solid;assert.ok(!solid.inside(q)||solid.distance(q)<1e-6,`${from} enters ${to} at ${phase}`);}
  }
 }
});

test('065 default timing exposes the short index and still honors a slower requested cycle',()=>{
 const timing=applyDisplayTiming(model,catalog.movements[64]).root.userData.animationTiming;
 near(timing.displayCycleDuration,5);assert.ok((p.gammaStart-p.gammaEnd)/(p.inputSpeed*timing.playbackTimeScale)>.39);
 near(applyDisplayTiming(model,catalog.movements[64],8).root.userData.animationTiming.displayCycleDuration,8);
 applyDisplayTiming(model,catalog.movements[64]);
});
