import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import loadMujoco from '@mujoco/mujoco';
import {makeCordTreadlePhysics,TREADLE_CORD} from '../src/simulation/mujoco-cord-treadle/physics.js';
import {cordTreadleRigidProperties} from '../src/simulation/mujoco-cord-treadle/inertia.js';
import {makeCordTreadleSolids} from '../src/simulation/mujoco-cord-treadle/solids.js';
import {idealCordShape} from '../src/simulation/mujoco-cord-treadle/ideal-cord-shape.js';
import {cordTreadleParameters} from '../src/simulation/cord-treadle-motion.js';
import {simulateCordLoop} from '../src/simulation/mujoco-cord-treadle/cord-dynamics.js';
import {sampleBakedMotion} from '../src/simulation/baked/playback.js';
import {encodeSmoothArray,decodeArray} from '../src/simulation/baked/mujoco-bake-format.js';
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const mujoco=await loadMujoco(),rigidProperties=cordTreadleRigidProperties();
// Pass 103: the driving cord is elastic (TREADLE_CORD), so the take-up ramps
// instead of jerking the resting treadle to speed in one step. It is tied
// shorter than the drawn taut length by its working stretch: the tied length
// is solved (secant) so that the treadle passes the ideal inextensible cord's
// angle at the loop start (the drawn crank phase).
const runNative=elasticCord=>{const q=makeCordTreadlePhysics(mujoco,{rigidProperties,floor:true,timestep:.000125,elasticCord}),rows=[];
 try{for(let tick=0;tick<=128000;tick++){assert.ok(Math.abs(q.data.time-tick*q.timestep)<1e-7);if(tick>=88000)rows.push([q.data.time,...q.data.qpos,...q.data.qvel]);if(tick<128000)q.step();}return{rows,timestep:q.timestep,cordLength:q.description.cordLength};}finally{q.dispose();}};
const treadleAtLoopStart=rows=>{const i=rows.findIndex(s=>s[1]>=6*Math.PI),a=rows[i-1],b=rows[i];return a[2]+(6*Math.PI-a[1])/(b[1]-a[1])*(b[2]-a[2]);};
const ideal=runNative(null),target=treadleAtLoopStart(ideal.rows);
let tieA=ideal.cordLength,errA=treadleAtLoopStart(runNative({...TREADLE_CORD,restLength:tieA}).rows)-target,tieB=ideal.cordLength*.99,run=runNative({...TREADLE_CORD,restLength:tieB}),errB=treadleAtLoopStart(run.rows)-target;
for(let i=0;i<8&&Math.abs(errB)>1e-7;i++){const next=tieB-errB*(tieB-tieA)/(errB-errA);tieA=tieB;errA=errB;tieB=next;run=runNative({...TREADLE_CORD,restLength:tieB});errB=treadleAtLoopStart(run.rows)-target;}
assert.ok(Math.abs(errB)<1e-6,'cord retie '+errB);
const cordModel={...TREADLE_CORD,restLength:tieB,drawnLength:ideal.cordLength,loopStartTreadle:target,loopStartError:errB};
const p={timestep:run.timestep},v=makeCordTreadleSolids();
try{
 const native=run.rows;
 const reference=6*Math.PI,cross=native.findIndex(s=>s[1]>=reference);assert.ok(cross>0);
 const a=native[cross-1],b=native[cross],sourceTime=a[0]+(reference-a[1])/(b[1]-a[1])*(b[0]-a[0]);
 const at=time=>{const index=Math.max(0,Math.min(native.length-2,Math.floor((time-native[0][0])/p.timestep))),a=native[index],b=native[index+1],t=(time-a[0])/(b[0]-a[0]);assert.ok(t>=-1e-6&&t<=1+1e-6);return a.slice(1).map((x,i)=>x+t*(b[i+1]-x));};
 const tied={...cordTreadleParameters(),cordLength:cordModel.restLength};
 const evaluate=time=>{const q=at(sourceTime+time),s=idealCordShape(q[0]-reference,q[1],{segments:8,geometry:tied});return[time,q[0]-reference,q[1],s.pulleyAngle,s.amplitude];};
 const first=evaluate(0),last=evaluate(4),turns=[2*Math.PI,0,0,0],closure=last.slice(1).map((x,i)=>x-first[i+1]-turns[i]);closure.forEach(x=>assert.ok(Math.abs(x)<1e-6));
 const velocityClosure=at(sourceTime+4).slice(2).map((x,i)=>x-at(sourceTime)[i+2]);velocityClosure.forEach(x=>assert.ok(Math.abs(x)<1e-5));
 const motion=[first];let refinements=0;
 const refine=(a,b,depth)=>{const mid=evaluate((a[0]+b[0])/2),errors=mid.slice(1).map((x,i)=>Math.abs(x-(a[i+1]+b[i+1])/2));
  const rigid=errors[0]>1e-6||errors[1]>2e-6||errors[2]>2e-6;
  // The legacy sag-amplitude channel grows with the square root of the slack,
  // so at the exact slack onset it cannot meet the tolerance at any spacing;
  // accept the finest interval there (the rendered cord is the chain below).
  if(rigid||(errors[3]>.0001&&(depth>0||Math.max(a[4],b[4])>.01))){assert.ok(depth>0,'Adaptive bake failed');refinements++;refine(a,mid,depth-1);refine(mid,b,depth-1);}else motion.push(b);
 };
 for(let i=1;i<=2000;i++)refine(motion.at(-1),evaluate(i*.002),16);
 motion[motion.length-1]=[4,...first.slice(1).map((x,i)=>x+turns[i])];
 // The visible cord's own dynamics (cord-dynamics.js), driven by the recorded
 // pin, eye and pulley and run to its periodic steady state.
 const loop=simulateCordLoop(t=>sampleBakedMotion({motion,names:['disk','treadle','pulley','amplitude'],turns,period:4,loopStart:0,loopEnd:4},t).slice(0,3),{period:4,geometry:tied,elastic:TREADLE_CORD});
 assert.ok(loop.closure<.01,'cord loop closure '+loop.closure);
 const cord={segments:loop.segments,frames:loop.frames,period:loop.period,closure:loop.closure,options:loop.options,points:encodeSmoothArray(loop.points,2*(loop.segments+1),1e-5)};
 {const decoded=decodeArray(cord.points);assert.equal(decoded.length,loop.points.length);decoded.forEach((x,i)=>assert.ok(Math.abs(x-loop.points[i])<2e-5));}
 const bounds=new THREE.Box3(),blocks=v.root.userData.blocks;
 for(let i=0;i<loop.points.length;i+=2)bounds.expandByPoint(new THREE.Vector3(loop.points[i],loop.points[i+1],.64));
 for(let i=0;i<motion.length;i+=5){const row=motion[i];v.update({disk:row[1],treadle:row[2],pulley:row[3]});bounds.union(new THREE.Box3().setFromObject(v.root,true));for(const point of idealCordShape(row[1],row[2],{bakedAmplitude:row[4],geometry:tied}).points)bounds.expandByPoint(new THREE.Vector3(...point));}
 bounds.expandByScalar(.06);v.update({disk:0,treadle:0,pulley:0});
 for(const [name,body] of Object.entries(blocks)){
  body.name='body:'+name;const groups=new Map();
  for(const mesh of body.children){mesh.updateMatrix();let geometry=mesh.geometry.clone();if(geometry.index){const old=geometry;geometry=old.toNonIndexed();old.dispose();}for(const key of Object.keys(geometry.attributes))if(!['position','normal'].includes(key))geometry.deleteAttribute(key);geometry.applyMatrix4(mesh.matrix);const list=groups.get(mesh.material)??[];list.push(geometry);groups.set(mesh.material,list);mesh.geometry.dispose();}
  body.clear();for(const [material,geometries]of groups){const mesh=new THREE.Mesh(mergeGeometries(geometries),material);geometries.forEach(g=>g.dispose());mesh.castShadow=mesh.receiveShadow=true;body.add(mesh);}
 }
 v.root.traverse(o=>o.userData={});
 const sources=['scripts/bake-cord-treadle.mjs','src/simulation/mujoco-cord-treadle/physics.js','src/simulation/mujoco-cord-treadle/inertia.js','src/simulation/mujoco-cord-treadle/solids.js','src/simulation/mujoco-cord-treadle/ideal-cord-shape.js','src/simulation/mujoco-cord-treadle/cord-dynamics.js','src/simulation/mujoco-cord-treadle/elastic-cord.js','src/simulation/baked/mujoco-bake-format.js','src/simulation/cord-treadle-motion.js','src/simulation/mujoco/simulation.js','src/simulation/finite-plate-geometry.js'].map(file=>({file,sha256:hash(file)}));
 const metadata={version:1,movement:159,names:['disk','treadle','pulley','amplitude'],turns,period:4,loopStart:0,loopEnd:4,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},focus:bounds.getCenter(new THREE.Vector3()).toArray(),cameraDirection:[.02,.02,15],sourceTime,closure,velocityClosure,refinements,cordModel,sources,assumptions:'Native passive treadle driven through an elastic, heavy, tension-only cord (elastic-cord.js: strain-stiffening stretch in series with the sag of its own weight, plus damping; about 1% working strain; stiffness assumed), tied short by its working stretch so the loop-start pose matches the ideal inextensible cord. The visible cord is a one-way-coupled chain with mass (cord-dynamics.js): the diagonal run is a limp point-mass rope under gravity with light damping, the groove and vertical run follow the recorded pulley; it does not load the treadle.'};
 const file='src/simulation/baked/assets/159.json.gz';fs.writeFileSync(file,gzipSync(JSON.stringify({...metadata,motion,cord,object:v.root.toJSON()}),{level:9}));
 fs.writeFileSync('src/simulation/baked/assets/159.provenance.json',JSON.stringify({...metadata,cord:{segments:cord.segments,frames:cord.frames,closure:cord.closure,options:cord.options},samples:motion.length,bytes:fs.statSync(file).size,sha256:hash(file)},null,2)+'\n');
 console.log({sourceTime,samples:motion.length,refinements,bytes:fs.statSync(file).size,closure,velocityClosure});
}finally{v.dispose();}
