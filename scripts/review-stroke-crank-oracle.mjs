import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createAuthoredStrokeCrankMovement} from '../src/simulation/authored-stroke-cranks.js';import {disposeObject3D} from '../src/simulation/dispose-model.js';
const url='https://507movements.com/mm_175.html',libraryUrl='https://507movements.com/js/anilib.js';
const html=await(await fetch(url)).text(),library=await(await fetch(libraryUrl)).text();
fs.writeFileSync('/dev/shm/175-source.html',html);fs.writeFileSync('/dev/shm/175-anilib.js',library);
const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('add_model("mm_175")'));assert.ok(script);
const ctx=new Proxy({actx:{imp:[],cyclePos:0}},{get:(o,k)=>k in o?o[k]:()=>{}}),canvas={getContext:()=>ctx,width:525,height:525};
const sandbox={document:{createElement:()=>canvas,getElementById:()=>canvas},requestAnimationFrame:()=>{},setTimeout:()=>{}};sandbox.window=sandbox;vm.createContext(sandbox);vm.runInContext(library,sandbox,{timeout:1000});let oracle;const add=sandbox.ae.add_model;sandbox.ae.add_model=(...args)=>oracle=add(...args);vm.runInContext(script,sandbox,{timeout:1000});
const m=createAuthoredStrokeCrankMovement({id:175},{reference:true}),d=m.root.userData,g=d.geometry;let maximumError=0;const samples=[];
try{
 for(let i=0;i<=1440;i++){
  const phase=2*i/1440;sandbox.oracleModel=oracle;sandbox.oracleContext=ctx;sandbox.oraclePhase=phase;
  vm.runInContext('oracleModel.draw(oracleContext,"main",oraclePhase)',sandbox,{timeout:1000});
  const crank=Array.from(ctx.actx.imp[1].crank_pin),slider=Array.from(ctx.actx.imp[2].crank_pin),s=d.stateAtCrankTurnCoordinate(phase);
  maximumError=Math.max(maximumError,...crank.map((v,j)=>Math.abs(v*g.sourceAnimationScale-s.crankPin.getComponent(j))),...slider.map((v,j)=>Math.abs(v*g.sourceAnimationScale-s.sliderPin.getComponent(j))));
  if(i%180===0)samples.push({phase,crank,slider});
 }
 const state=d.stateAtTime(0),radius=g.sourceRasterCrankPin.distanceTo(g.sourceRasterCrankCenter),scale=radius/g.crankRadius;
 const features=[['crank pin',g.sourceRasterCrankPin,state.crankPin],['slider pin',g.sourceRasterSliderPin,state.sliderPin]].map(([name,target,p])=>{const projected=[199+p.x*scale,235-p.y*scale];return{name,source:target.toArray(),projected,errorPixels:Math.hypot(projected[0]-target.x,projected[1]-target.y)};});
 const measuredRod=g.sourceRasterSliderPin.distanceTo(g.sourceRasterCrankPin),guideOffset=g.sourceRasterSliderPin.x-g.sourceRasterCrankCenter.x;
 const report={movement:175,status:'reference-dimensions-oracle-agrees',url,libraryUrl,maximumError,samples,features,
 engraving:{crankRadius:radius,guideOffset,rodLength:measuredRod,requiredBranchTransferRodLength:radius+guideOffset},
 oracle:{crankRadius:5,guideOffset:7,rodLength:12},
 crankTurnsBetweenPistonReversals:[g.upperDeadCenterTurn-g.lowerDeadCenterTurn,2-g.upperDeadCenterTurn+g.lowerDeadCenterTurn],
 method:'Execute original anilib at 1441 phases over two crank turns. Compare crank and rod endpoint with the analytic implementation using reference dimensions. Engraving projection registers fixed shaft and crank radius; it is not a free best-fit registration.',
 limitation:'The engraving dimensions do not satisfy L = guide offset + crank radius. A faithful outline and branch-transfer mechanism cannot simultaneously preserve all three measured pin centers.',
 sourceHashes:{html:createHash('sha256').update(html).digest('hex'),library:createHash('sha256').update(library).digest('hex')},sources:['scripts/review-stroke-crank-oracle.mjs','src/simulation/authored-stroke-cranks.js','public/engravings/mm_175.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/175-oracle.json',JSON.stringify(report,null,2)+'\n');console.log({maximumError,features,engraving:report.engraving});assert.ok(maximumError<1e-8);
}finally{disposeObject3D(m.root);}
