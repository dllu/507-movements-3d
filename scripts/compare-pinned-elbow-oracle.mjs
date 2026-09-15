import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAuthoredCrankMovement} from '../src/simulation/authored-cranks.js';

import {pinnedElbowState,pinnedElbowSource} from '../src/simulation/pinned-elbow-motion.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const url='https://507movements.com/mm_157.html',libraryUrl='https://507movements.com/js/anilib.js';
const html=process.env.SOURCE_HTML?fs.readFileSync(process.env.SOURCE_HTML,'utf8'):await(await fetch(url)).text();
const library=process.env.SOURCE_LIBRARY?fs.readFileSync(process.env.SOURCE_LIBRARY,'utf8'):await(await fetch(libraryUrl)).text();
const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('add_model("mm_157")'));assert.ok(script);
const ctx=new Proxy({actx:{imp:[],cyclePos:0}},{get:(o,k)=>k in o?o[k]:()=>{}}),canvas={getContext:()=>ctx,width:525,height:525};
const sandbox={document:{createElement:()=>canvas,getElementById:()=>canvas},requestAnimationFrame:()=>{},setTimeout:()=>{}};sandbox.window=sandbox;vm.createContext(sandbox);vm.runInContext(library,sandbox,{timeout:1000});
let model;const add=sandbox.ae.add_model;sandbox.ae.add_model=(...args)=>model=add(...args);vm.runInContext(script,sandbox,{timeout:1000});

const v=createAuthoredCrankMovement({id:157}),u=v.root.userData,scale=u.geometry.sourceScale;
try{
 const errors={pin:0,bellInput:0,bellOutput:0,slider:0},solverErrors={...errors},samples=[];let g;
 for(let i=0;i<=720;i++){
  const phase=i/720;sandbox.oracleModel=model;sandbox.oracleContext=ctx;sandbox.oraclePhase=phase;vm.runInContext('oracleModel.draw(oracleContext,"main",oraclePhase)',sandbox,{timeout:1000});const imp=ctx.actx.imp;
  if(!g){const p=point=>Array.from(point,x=>x*scale),pivot=p(imp[0].bell_pivot),pin=p(imp[1].crank_pin),input=p(imp[3].crank_pin),output=p(imp[3].pushrod_piv),slider=p(imp[4].wrist_pin),restAngle=Math.atan2(input[1]-pivot[1],input[0]-pivot[0]);g={pivot,pin,restAngle,couplerLength:24*scale,inputLength:12*scale,outputLength:12*scale,includedAngle:-Math.PI/2,rodLength:44*scale,guideX:slider[0],period:4};}
  const old=u.stateAtTime(phase*4),next=pinnedElbowState(phase*4,g);
  for(const [name,expected,previous,current]of [['pin',imp[1].crank_pin,old.crankPoint,next.pin],['bellInput',imp[3].crank_pin,old.bellInputPoint,next.input],['bellOutput',imp[3].pushrod_piv,old.bellOutputPoint,next.output],['slider',imp[4].wrist_pin,old.outputSliderPoint,next.slider]]){
   errors[name]=Math.max(errors[name],Math.hypot(expected[0]*scale-previous.x,expected[1]*scale-previous.y));solverErrors[name]=Math.max(solverErrors[name],Math.hypot(expected[0]*scale-current[0],expected[1]*scale-current[1]));
  }
  if(i%90===0)samples.push({phase,pin:imp[1].crank_pin,input:imp[3].crank_pin,output:imp[3].pushrod_piv,slider:imp[4].wrist_pin});
 }
 // Compare at the engraving's crank phase, so a phase offset is not mistaken for
 // a dimensional error. The disk center and radius fix this similarity transform.
 const source=pinnedElbowSource,angle=Math.atan2(source.diskCenter[1]-source.crankPin[1],source.crankPin[0]-source.diskCenter[0]),phase=(angle-Math.PI/2)/(Math.PI*2);model.draw(ctx,'main',phase);const imp=ctx.actx.imp;
 const alignment=[['pin',imp[1].crank_pin,source.crankPin],['pivot',imp[0].bell_pivot,source.pivot],['input',imp[3].crank_pin,source.input],['output',imp[3].pushrod_piv,source.output]].map(([name,point,expected])=>{const mapped=[source.diskCenter[0]+point[0]*source.diskRadius/10,source.diskCenter[1]-point[1]*source.diskRadius/10];return{name,mapped,engraving:expected,errorPixels:Math.hypot(mapped[0]-expected[0],mapped[1]-expected[1])};});
 const report={movement:157,url,libraryUrl,method:'Execute the source definition with its actual animation library in an isolated VM and no-op canvas at 721 phases. Compare old model and reusable analytic solver with oracle dimensions. Separately align disk center, radius and crank phase for a fair engraving landmark comparison.',sourceHashes:{html:createHash('sha256').update(html).digest('hex'),library:createHash('sha256').update(library).digest('hex')},maximumWorldErrors:errors,reusableSolverErrors:solverErrors,diskAndPhaseAlignedLandmarks:alignment,samples,sources:['scripts/compare-pinned-elbow-oracle.mjs','src/simulation/authored-cranks.js','src/simulation/pinned-elbow-motion.js','public/engravings/mm_157.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};fs.writeFileSync('docs/validation/157-oracle-comparison.json',JSON.stringify(report,null,2)+'\n');console.log({errors,solverErrors,alignment});[...Object.values(errors),...Object.values(solverErrors)].forEach(e=>assert.ok(e<1e-6));
}finally{disposeObject3D(v.root);}
