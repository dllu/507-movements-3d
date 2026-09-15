import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAuthoredCrankMovement} from '../src/simulation/authored-cranks.js';

import {sourceTreadleState,sourceTreadleParameters,sourceTreadleDimensions as source} from '../src/simulation/source-treadle-motion.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const url='https://507movements.com/mm_158.html',libraryUrl='https://507movements.com/js/anilib.js';
const html=process.env.SOURCE_HTML?fs.readFileSync(process.env.SOURCE_HTML,'utf8'):await(await fetch(url)).text();
const library=process.env.SOURCE_LIBRARY?fs.readFileSync(process.env.SOURCE_LIBRARY,'utf8'):await(await fetch(libraryUrl)).text();
const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('add_model("mm_158")'));assert.ok(script);
const ctx=new Proxy({actx:{imp:[],cyclePos:0}},{get:(o,k)=>k in o?o[k]:()=>{}}),canvas={getContext:()=>ctx,width:525,height:525};
const sandbox={document:{createElement:()=>canvas,getElementById:()=>canvas},requestAnimationFrame:()=>{},setTimeout:()=>{}};sandbox.window=sandbox;vm.createContext(sandbox);vm.runInContext(library,sandbox,{timeout:1000});
let model;const add=sandbox.ae.add_model;sandbox.ae.add_model=(...args)=>model=add(...args);vm.runInContext(script,sandbox,{timeout:1000});

const v=createAuthoredCrankMovement({id:158}),u=v.root.userData,scale=u.geometry.sourceScale;
try{
 const errors={pin:0,joint:0,foot:0},solverErrors={...errors},samples=[];let g;
 for(let i=0;i<=720;i++){
  const phase=i/720;sandbox.oracleModel=model;sandbox.oracleContext=ctx;sandbox.oraclePhase=phase;vm.runInContext('oracleModel.draw(oracleContext,"main",oraclePhase)',sandbox,{timeout:1000});const imp=ctx.actx.imp;
  if(!g){const p=point=>Array.from(point,x=>x*scale),pivot=p(imp[0].treadle_pin),pin=p(imp[1].crank_pin),joint=p(imp[3].crank_pin);g={pivot,pin,restAngle:Math.atan2(joint[1]-pivot[1],joint[0]-pivot[0]),rodLength:13*scale,armLength:21*scale,footLength:28*scale,period:4};}
  const old=u.stateAtTime(phase*4),next=sourceTreadleState(phase*4,g),pivot=imp[0].treadle_pin,joint=imp[3].crank_pin,foot=joint.map((x,i)=>pivot[i]+(x-pivot[i])*28/21);
  for(const [name,expected,previous,current]of [['pin',imp[1].crank_pin,old.crankPoint,next.pin],['joint',joint,old.treadlePinPoint,next.joint],['foot',foot,old.treadleFootPoint,next.foot]]){
   errors[name]=Math.max(errors[name],Math.hypot(expected[0]*scale-previous.x,expected[1]*scale-previous.y));solverErrors[name]=Math.max(solverErrors[name],Math.hypot(expected[0]*scale-current[0],expected[1]*scale-current[1]));
  }
  if(i%90===0)samples.push({phase,pin:imp[1].crank_pin,joint,foot});
 }
 const angle=Math.atan2(source.diskCenter[1]-source.crankPin[1],source.crankPin[0]-source.diskCenter[0]),phase=angle/(Math.PI*2);model.draw(ctx,'main',phase);const imp=ctx.actx.imp;
 const alignment=[['pin',imp[1].crank_pin,source.crankPin],['pivot',imp[0].treadle_pin,source.pivot],['joint',imp[3].crank_pin,source.joint]].map(([name,point,expected])=>{const mapped=[source.diskCenter[0]+point[0]*source.diskRadius/10,source.diskCenter[1]-point[1]*source.diskRadius/10];return{name,mapped,engraving:expected,errorPixels:Math.hypot(mapped[0]-expected[0],mapped[1]-expected[1])};});
 const p=sourceTreadleParameters(),r=Math.hypot(...p.pin),d=Math.hypot(...p.pivot);let footLow=Infinity,footHigh=-Infinity;for(let i=0;i<=4096;i++){const state=sourceTreadleState(p.period*i/4096,p);footLow=Math.min(footLow,state.foot[1]);footHigh=Math.max(footHigh,state.foot[1]);}
 const report={movement:158,url,libraryUrl,method:'Execute actual source animation in isolated VM at 721 phases; compare old model and reusable analytic solver with oracle dimensions. Foot is the rigid extension of the oracle treadle joint. Separately align disk center, radius and crank phase with engraving.',sourceHashes:{html:createHash('sha256').update(html).digest('hex'),library:createHash('sha256').update(library).digest('hex')},maximumWorldErrors:errors,reusableSolverErrors:solverErrors,diskAndPhaseAlignedLandmarks:alignment,engravingParameters:p,fullTurnMarginsPixels:{inner:(d-r-Math.abs(p.rodLength-p.armLength))/source.scale,outer:(p.rodLength+p.armLength-d-r)/source.scale},footHeightPixels:{highest:source.diskCenter[1]-footHigh/source.scale,lowest:source.diskCenter[1]-footLow/source.scale},samples,sources:['scripts/compare-source-treadle-oracle.mjs','src/simulation/authored-cranks.js','src/simulation/source-treadle-motion.js','public/engravings/mm_158.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};fs.writeFileSync('docs/validation/158-oracle-comparison.json',JSON.stringify(report,null,2)+'\n');console.log({errors,solverErrors,alignment,margins:report.fullTurnMarginsPixels,foot:report.footHeightPixels});[...Object.values(errors),...Object.values(solverErrors)].forEach(e=>assert.ok(e<1e-6));
}finally{disposeObject3D(v.root);}
