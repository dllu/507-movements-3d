import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {makeCordTreadleModel} from '../src/simulation/baked/cord-treadle.js';
import {sampleBakedMotion} from '../src/simulation/baked/playback.js';
import {decodeArray} from '../src/simulation/baked/mujoco-bake-format.js';
import {sampleCordLoop} from '../src/simulation/mujoco-cord-treadle/cord-dynamics.js';
import {idealCordShape} from '../src/simulation/mujoco-cord-treadle/ideal-cord-shape.js';
import {cordTreadleParameters,cordTreadleMetrics} from '../src/simulation/cord-treadle-motion.js';
const bundle=JSON.parse(gunzipSync(fs.readFileSync('src/simulation/baked/assets/159.json.gz')));
const loop={...bundle.cord,points:decodeArray(bundle.cord.points)},g=cordTreadleParameters();
const length=p=>{let s=0;for(let i=1;i<p.length;i++)s+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);return s;};
test('159 cord has inertia: its recorded chain keeps its ends, groove, floor and length',()=>{
 let shortest=Infinity,longest=0;
 for(let i=0;i<800;i++){
  const t=4*(i+.29)/800,q=sampleBakedMotion(bundle,t),m=cordTreadleMetrics(q[0],q[1],g),p=sampleCordLoop(loop,t);
  assert.ok(Math.hypot(p[0][0]-m.pin[0],p[0][1]-m.pin[1])<.02,'pin end '+t);
  assert.ok(Math.hypot(p.at(-1)[0]-m.eye[0],p.at(-1)[1]-m.eye[1])<.02,'eye end '+t);
  for(const [x,y] of p){assert.ok(Math.hypot(x-g.guide[0],y-g.guide[1])>g.guideRadius-2e-3,'outside the pulley groove');assert.ok(y>g.groundY);}
  const l=length(p)/g.cordLength;shortest=Math.min(shortest,l);longest=Math.max(longest,l);
 }
 console.log({shortest,longest});assert.ok(longest<1.01);assert.ok(shortest>.97);
});
test('159 slack forms and clears smoothly, without the ideal profile\'s jump',()=>{
 // Largest centreline change between 0.02 s frames at slack onset, chain vs quasi-static ideal.
 const h=.02,ideal=t=>{const q=sampleBakedMotion(bundle,t);return idealCordShape(q[0],q[1],{segments:loop.segments,bakedAmplitude:q[3]}).points;};
 const chain=t=>sampleCordLoop(loop,t).map(p=>p.slice());
 const worst=(f,lo,hi)=>{let a=0;for(let t=lo;t<hi;t+=h){const p=f(t-h),c=f(t),n=f(t+h);c.forEach((v,i)=>{a=Math.max(a,Math.hypot(n[i][0]-2*v[0]+p[i][0],n[i][1]-2*v[1]+p[i][1])/h/h);});}return a;};
 const onset=[worst(ideal,.05,.6),worst(chain,.05,.6)];console.log({onset});
 assert.ok(onset[1]<onset[0]*.5);
 // Seamless loop.
 const a=sampleCordLoop(loop,4-1e-6),b=sampleCordLoop(loop,0).map(p=>p.slice());a.forEach((p,i)=>assert.ok(Math.hypot(p[0]-b[i][0],p[1]-b[i][1])<1e-3));
});
test('159 playback renders the recorded chain',()=>{
 const v=makeCordTreadleModel(bundle);
 try{v.update(.7);const l=v.root.userData.state.cordLength;assert.ok(Math.abs(l-length(sampleCordLoop(loop,.7)))<1e-9);}finally{v.dispose();}
});
