import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import clip from 'polygon-clipping';
import {createMovementModel,applyDisplayTiming} from '../src/simulation/registry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import profiles from '../src/data/sector-press-teeth.js';
const movement=JSON.parse(fs.readFileSync('src/data/movements.json')).movements[132];
const area=multi=>multi.reduce((sum,poly)=>sum+poly.reduce((s,r,i)=>s+(i?-1:1)*Math.abs(r.reduce((a,p,j)=>{const q=r[(j+1)%r.length];return a+p[0]*q[1]-q[0]*p[1];},0)/2),0),0);
const rotate=(ring,a,x=0,y=0)=>ring.map(([u,v])=>[u*Math.cos(a)-v*Math.sin(a)+x,u*Math.sin(a)+v*Math.cos(a)+y]);
const dist=(p,a,b)=>{const x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y||1)));return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y);};
test('133 generated teeth engage without overlap through the press stroke',()=>{
 for(const source of profiles.sources)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(source.file)).digest('hex'),source.sha256);
 const v=createMovementModel(movement),u=v.root.userData,d=u.geometry,b=u.blocks;
 let maximumOverlap=0,maximumGap=0;
 const sample=(angle,wrong=0,checkGap=false)=>{
  const pinion=rotate(profiles.pinion,u.toothProfiles.pinionMountPhase-6*angle+wrong,b.pinionAssembly.position.x,b.pinionAssembly.position.y);
  let overlap=0,gap=Infinity;
  for(let tooth=0;tooth<13;tooth++){
   const sector=rotate(profiles.sectorTooth,angle+tooth*2*Math.PI/48);
   const center=sector[Math.floor(profiles.settings.samples/2)];
   if(Math.hypot(center[0]-b.pinionAssembly.position.x,center[1]-b.pinionAssembly.position.y)>.7)continue;
   overlap=Math.max(overlap,area(clip.intersection([pinion],[sector])));
   if(checkGap)for(const p of pinion)for(let j=0;j<sector.length;j++)gap=Math.min(gap,dist(p,sector[j],sector[(j+1)%sector.length]));
  }
  return {overlap,gap};
 };
 try{
  for(let i=0;i<=720;i++){const r=sample(i*d.sectorAngularTravel/720,0,i%12===0);maximumOverlap=Math.max(maximumOverlap,r.overlap);if(i%12===0)maximumGap=Math.max(maximumGap,r.gap);}
  console.log({maximumOverlap,maximumGap});assert(maximumOverlap<1e-10);assert(maximumGap<.006);
  assert(sample(0,Math.PI/8).overlap>.001,'wrong-phase control');
  applyDisplayTiming(v,movement);assert.equal(u.animationTiming.displayCycleDuration,6);assert(u.hideGround);assert(u.supportsRestart);
  assert.equal(b.pinionBody.geometry.parameters.options.bevelSize,0);assert.equal(b.pinionBody.geometry.parameters.shapes.holes.length,1);
 }finally{disposeObject3D(v.root);}
});
