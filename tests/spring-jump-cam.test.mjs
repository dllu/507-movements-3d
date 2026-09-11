import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { makeJumpCamMotion } from '../src/simulation/spring-jump-cam-motion.js';
import precomputed from '../src/data/spring-jump-cam-motion.js';
import { surfaceTriangles, surfacePoints, solidSurface } from './helpers/solid-surface.mjs';
import { triangleTree, meshPairDistance } from '../scripts/lib/star-mangle-pair-distance.mjs';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));
const model = createMovementModel(catalog.movements[63]), { parts, blocks, geometry: p, motion } = model.root.userData;
const setTime = time => { model.update(time); model.root.updateMatrixWorld(true); };
const near = (a,b,tolerance=1e-9) => assert.ok(Math.abs(a-b)<tolerance,`${a} ≈ ${b}`);
const trees = new Map(), tree = mesh => {
  if (mesh === parts.leafSpring) return triangleTree(mesh.geometry);
  if (!trees.has(mesh)) trees.set(mesh,triangleTree(mesh.geometry)); return trees.get(mesh);
};
const closest = (a,b,maximum=0.02) => meshPairDistance(tree(a),tree(b),b.matrixWorld.clone().invert().multiply(a.matrixWorld),maximum);

test('064 precomputed motion has current source provenance and reproduces independent integration', async () => {
  for (const [name, hash] of Object.entries(precomputed.sourceHashes)) {
    const source=await readFile(new URL(`../src/simulation/${name}`,import.meta.url));
    assert.equal(createHash('sha256').update(source).digest('hex'),hash,`${name}: regenerate the precomputed motion after edits`);
  }
  const integrated=makeJumpCamMotion();
  for(let i=0;i<=192;i++){
    const time=p.cycleDuration*(i+0.173)/193,a=integrated.atTime(time),b=motion.atTime(time);
    for(const name of ['camAngle','camAngularSpeed','springEnergy','rollerAngle','rollerAngularSpeed','followerAngle'])assert.equal(a[name],b[name],name);
  }
  assert.equal(model.root.userData.mechanism,'worm-driven-spring-cam-with-half-cut-sleeve');
  assert.equal(parts.drivingPin.parent,blocks.input); assert.equal(parts.camPlate.parent,blocks.cam);
  assert.equal(parts.rollerTread.parent,blocks.roller); assert.notEqual(blocks.input,blocks.cam);
  assert.equal(blocks.roller.userData.rotationallySymmetric,true);
  assert.equal(blocks.roller.children.length,1); assert.equal(parts.rollerTread.children.length,0);
  const colors=parts.rollerTread.geometry.attributes.color;
  if(colors)for(let i=1;i<colors.count;i++){
    near(colors.getX(i),colors.getX(0));near(colors.getY(i),colors.getY(0));near(colors.getZ(i),colors.getZ(0));
  }
  const tread=parts.rollerTread.geometry.attributes.position;
  for(let i=0;i<tread.count;i++){
    const radius=Math.hypot(tread.getX(i),tread.getY(i));
    assert.ok(Math.min(Math.abs(radius-p.rollerRadius),Math.abs(radius-p.rollerBore))<1e-7,
      'only an unmarked surface of revolution is excluded from visible rotation timing');
  }
});

test('064 finite parts have closed oriented surfaces, positive volumes and outward stored normals',()=>{
  setTime(0);
  for(const [name,mesh] of Object.entries(parts)){
    const g=mesh.geometry, edges=new Map();let volume=0;
    for(const [i,face] of surfaceTriangles(g).entries()){
      const normal=face.getNormal(new THREE.Vector3());
      const stored=new THREE.Vector3();
      for(let j=0;j<3;j++)stored.add(new THREE.Vector3().fromBufferAttribute(g.attributes.normal,g.index?g.index.getX(3*i+j):3*i+j));
      assert.ok(normal.dot(stored)>0,`${name}: outward normal`);
      volume+=face.a.dot(face.b.clone().cross(face.c))/6;
      const keys=[face.a,face.b,face.c].map(v=>v.toArray().map(x=>Math.round(x*1e9)).join(','));
      for(let j=0;j<3;j++){
        const a=keys[j],b=keys[(j+1)%3],key=a<b?`${a}/${b}`:`${b}/${a}`,e=edges.get(key)??{count:0,direction:0};
        e.count++;e.direction+=a<b?1:-1;edges.set(key,e);
      }
    }
    assert.ok(volume>0,`${name}: positive enclosed volume`);
    assert.ok([...edges.values()].every(e=>e.count===2&&e.direction===0),`${name}: two opposing faces per edge`);
  }
});

test('064 spring preserves its neutral length and fixed root, with torque consistent with stored energy',()=>{
  const initial=motion.atTime(0).leaf.path;
  const energy=angle=>{const c=motion.cam.atAngle(angle),s=motion.spring.atFollower(c.followerAngle);return p.stiffness*(s.lambda-p.freeLambda)**2/2;};
  for(let i=0;i<361;i++){
    const state=motion.atTime(p.cycleDuration*(i+0.271)/361),path=state.leaf.path;let length=0;
    for(let j=1;j<path.length;j++){
      length+=Math.hypot(path[j][0]-path[j-1][0],path[j][1]-path[j-1][1]);
      if(length<p.springFixedLength-0.02)assert.deepEqual(path[j],initial[j]);
    }
    near(length,p.springNeutralLength,1e-11);assert.ok(state.leafForce>0);
    const h=1e-5,derivative=(energy(state.camAngle+h)-energy(state.camAngle-h))/(2*h);
    near(derivative,-state.springTorque,0.001);
  }
});

test('064 spring releases and settles before the unilateral pin catches, within the finite cut',()=>{
  assert.ok(p.peakSpeed>5&&p.peakSpeed<10);assert.ok(p.settledTime>2);
  assert.ok(p.maximumLead<p.availableLead-0.005);
  assert.ok(p.releaseTime<p.catchTime&&p.catchTime<p.cycleDuration);
  for(let i=0;i<721;i++){
    const time=p.cycleDuration*(i+0.283)/721,state=motion.atTime(time);
    assert.ok(state.camLead>-1e-10&&state.camLead<p.availableLead);
    if(state.pinEngaged){assert.ok(state.pinTorque>=-1e-5);near(state.camLead,0);}
    else assert.equal(state.pinTorque,0);
    for(const cycle of [1,2]){
      const next=motion.atTime(time+cycle*p.cycleDuration);
      near(next.camAngle-state.camAngle,cycle*2*Math.PI);near(next.camAngularSpeed,state.camAngularSpeed);
    }
  }
  const impact=motion.integration.catchState;
  near(p.inertia*(p.driverSpeed**2-impact.incomingSpeed**2)/2,impact.driverImpactWork-impact.impactLoss);
  assert.ok(impact.impulse>0&&impact.impactLoss>0);
});

test('064 shafts, follower bores, spring clamp and finite driving edge clear moving neighbors',()=>{
  const pairs=[['frontInputShaft','camSleeve'],['followerPivot','followerLever'],['rollerPin','rollerTread'],
    ['camPlate','wormThread'],['leafSpring','springClamp'],['drivingPin','halfCutSleeveEnd']];
  const data=new Map();
  for(const name of new Set(pairs.flat()))data.set(name,{solid:solidSurface(parts[name].geometry),points:surfacePoints(parts[name].geometry)});
  for(const time of [0.17,p.releaseTime+0.23,2.71,p.catchTime+0.013,12.07]){
    setTime(time);data.set('leafSpring',{solid:solidSurface(parts.leafSpring.geometry),points:surfacePoints(parts.leafSpring.geometry)});
    for(const [a,b] of pairs){
      const distance=closest(parts[a],parts[b],0.01);assert.ok(distance.distance>1e-6,`${a}/${b}: separate skins at ${time}`);
      for(const [from,to] of [[a,b],[b,a]]){
        const matrix=parts[to].matrixWorld.clone().invert().multiply(parts[from].matrixWorld);
        const samples=data.get(from).points;
        for(let j=0;j<samples.length;j+=11){
          const q=samples[j].clone().applyMatrix4(matrix),solid=data.get(to).solid;
          assert.ok(!solid.inside(q)||solid.distance(q)<1e-6,`${from} enters ${to} at ${time}`);
        }
      }
    }
  }
});

test('064 rendered roller rolls on the cam and the curled spring remains on the follower',()=>{
  for(const time of [0.13,0.49,0.54,0.59,0.64,0.72,0.91,2.73,5.13,8.13,12.31]){
    setTime(time);
    for(const [a,b] of [['camPlate','rollerTread'],['leafSpring','followerLever']]){
      const result=closest(parts[a],parts[b]);assert.ok(result.distance>0.00014&&result.distance<0.00016,`${a}/${b}: actual contact clearance`);
      if(a!=='camPlate')continue;
      const pa=new THREE.Vector3().fromArray(result.witness.a).applyMatrix4(parts[b].matrixWorld),pb=new THREE.Vector3().fromArray(result.witness.b).applyMatrix4(parts[b].matrixWorld);
      const qa=pa.clone().applyMatrix4(parts[a].matrixWorld.clone().invert()),qb=pb.clone().applyMatrix4(parts[b].matrixWorld.clone().invert()),h=1e-5;
      setTime(time-h);const beforeA=qa.clone().applyMatrix4(parts[a].matrixWorld),beforeB=qb.clone().applyMatrix4(parts[b].matrixWorld);
      setTime(time+h);const va=qa.clone().applyMatrix4(parts[a].matrixWorld).sub(beforeA).divideScalar(2*h),vb=qb.clone().applyMatrix4(parts[b].matrixWorld).sub(beforeB).divideScalar(2*h);
      assert.ok(va.distanceTo(vb)/Math.max(0.1,va.length(),vb.length())<0.01,'world material velocities agree at the rolling surfaces');
      setTime(time);
    }
  }
});

test('064 actual worm flanks transmit positive wheel torque with the synchronized power ratio',()=>{
  const worm=parts.wormThread,wheel=parts.wormWheel;
  const working=surfaceTriangles(wheel.geometry).filter(face=>{const q=face.getMidpoint(new THREE.Vector3()),n=face.getNormal(new THREE.Vector3());return-q.clone().cross(n).z>0.1*Math.hypot(q.x,q.y);});
  const workingTree=triangleTree(new THREE.BufferGeometry().setFromPoints(working.flatMap(face=>[face.a,face.b,face.c])));
  for(let i=0;i<7;i++){
    setTime(2*Math.PI/(p.wheelTeeth*p.driverSpeed)*(i+0.371)/7);
    const exact=meshPairDistance(tree(worm),workingTree,wheel.matrixWorld.clone().invert().multiply(worm.matrixWorld),0.002);
    assert.ok(exact.distance>1e-6&&exact.distance<0.00008);
    const a=new THREE.Vector3().fromArray(exact.witness.a).applyMatrix4(wheel.matrixWorld),b=new THREE.Vector3().fromArray(exact.witness.b).applyMatrix4(wheel.matrixWorld),force=b.clone().sub(a).normalize();
    const output=b.clone().cross(force).z,input=a.clone().sub(new THREE.Vector3(0,-p.wormCenterDistance,0)).cross(force.clone().negate()).dot(new THREE.Vector3(-1,0,0));
    assert.ok(output>0&&input<0);assert.ok(Math.abs(p.wheelTeeth*input+output)/Math.max(Math.abs(p.wheelTeeth*input),output)<0.02);
  }
});
