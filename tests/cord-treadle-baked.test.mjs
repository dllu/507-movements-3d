import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {makeCordTreadleModel} from '../src/simulation/baked/cord-treadle.js';
import {sampleBakedMotion} from '../src/simulation/baked/playback.js';
import {idealCordShape} from '../src/simulation/mujoco-cord-treadle/ideal-cord-shape.js';
import {cordTreadleParameters} from '../src/simulation/cord-treadle-motion.js';
const bundle=JSON.parse(gunzipSync(fs.readFileSync('src/simulation/baked/assets/159.json.gz')));
// Pass 103: the sag channel is solved for the elastic cord's tied (unstretched) length.
const tied={...cordTreadleParameters(),cordLength:bundle.cordModel.restLength};
test('159 interpolated slack preserves cord length and the solved profile',()=>{
 let maximumPointError=0,maximumLengthError=0;
 for(let i=0;i<2001;i++){
  const q=sampleBakedMotion(bundle,4*(i+.371)/2001);
  const exact=idealCordShape(q[0],q[1],{geometry:tied}),baked=idealCordShape(q[0],q[1],{bakedAmplitude:q[3],geometry:tied});
  maximumLengthError=Math.max(maximumLengthError,Math.abs(baked.length-exact.length));
  exact.points.forEach((p,j)=>{maximumPointError=Math.max(maximumPointError,Math.hypot(...p.map((x,k)=>x-baked.points[j][k])));});
 }
 console.log({maximumPointError,maximumLengthError});
 assert.ok(maximumPointError<.001);assert.ok(maximumLengthError<.001);
});
test('159 playback has stable buffers, complete bounds, smooth seam and exact restart',()=>{
 const v=makeCordTreadleModel(bundle);
 try{
  const initial=JSON.stringify(v.root.userData.state),cord=v.root.getObjectByName('ideal-cord'),geometry=cord.geometry,positions=geometry.attributes.position.array;
  for(let i=0;i<257;i++){
   v.update(4*(i+.317)/257);
   assert.ok(v.root.userData.cameraFitBounds.clone().expandByScalar(1e-5).containsBox(new THREE.Box3().setFromObject(v.root,true)));
   assert.ok(positions.every(Number.isFinite));
  }
  assert.equal(cord.geometry,geometry);assert.equal(cord.geometry.attributes.position.array,positions);
  v.root.traverse(o=>{if(o.material)assert.equal(o.material.fog,false);});
  v.update(4-1e-8);const before=v.root.userData.state.qpos;
  v.update(4+1e-8);const after=v.root.userData.state.qpos;
  for(const name of bundle.names)assert.ok(Math.abs(before[name]-after[name])<1e-6,name);
  v.reset();assert.equal(JSON.stringify(v.root.userData.state),initial);
 }finally{v.dispose();}
});
