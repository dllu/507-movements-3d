import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAuthoredCrankMovement} from '../src/simulation/authored-cranks.js';
import {slottedElbowState,slottedElbowParameters,slottedElbowSource} from '../src/simulation/slotted-elbow-motion.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const url='https://507movements.com/mm_156.html',libraryUrl='https://507movements.com/js/anilib.js';
const html=process.env.SOURCE_HTML?fs.readFileSync(process.env.SOURCE_HTML,'utf8'):await(await fetch(url)).text();
const library=process.env.SOURCE_LIBRARY?fs.readFileSync(process.env.SOURCE_LIBRARY,'utf8'):await(await fetch(libraryUrl)).text();
const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('add_model("mm_156")'));assert.ok(script);
const ctx=new Proxy({actx:{imp:[],cyclePos:0}},{get:(o,k)=>k in o?o[k]:()=>{}}),canvas={getContext:()=>ctx,width:525,height:525};
const sandbox={document:{createElement:()=>canvas,getElementById:()=>canvas},requestAnimationFrame:()=>{},setTimeout:()=>{}};sandbox.window=sandbox;vm.createContext(sandbox);vm.runInContext(library,sandbox,{timeout:1000});
let model;const add=sandbox.ae.add_model;sandbox.ae.add_model=(...args)=>model=add(...args);vm.runInContext(script,sandbox,{timeout:1000});
const v=createAuthoredCrankMovement({id:156}),u=v.root.userData,scale=u.geometry.sourceScale;
try{
 const errors={pin:0,bellOutput:0,slider:0},reusableErrors={pin:0,bellOutput:0,slider:0},samples=[];let referenceParameters;
 for(let i=0;i<=720;i++){
  const phase=i/720;sandbox.oracleModel=model;sandbox.oracleContext=ctx;sandbox.oraclePhase=phase;vm.runInContext('oracleModel.draw(oracleContext,"main",oraclePhase)',sandbox,{timeout:1000});
  const state=u.stateAtTime(phase*u.geometry.cyclePeriod),imp=ctx.actx.imp;
  if(!referenceParameters){const pivot=Array.from(imp[0].piv_arm,x=>x*scale),pin=Array.from(imp[1].crank_pin,x=>x*scale),output=Array.from(imp[2].piv_rod,x=>x*scale),slider=Array.from(imp[3].wrist_pin,x=>x*scale),restAngle=Math.atan2(pin[1]-pivot[1],pin[0]-pivot[0]);referenceParameters={pivot,pin,restAngle,includedAngle:Math.atan2(output[1]-pivot[1],output[0]-pivot[0])-restAngle,outputLength:Math.hypot(output[0]-pivot[0],output[1]-pivot[1]),rodLength:Math.hypot(slider[0]-output[0],slider[1]-output[1]),guideX:slider[0],period:4};}
  const reusable=slottedElbowState(phase*4,referenceParameters);
  for(const [name,expected,actual]of [['pin',imp[1].crank_pin,reusable.pin],['bellOutput',imp[2].piv_rod,reusable.output],['slider',imp[3].wrist_pin,reusable.slider]])reusableErrors[name]=Math.max(reusableErrors[name],Math.hypot(expected[0]*scale-actual[0],expected[1]*scale-actual[1]));
  for(const [name,expected,actual] of [['pin',imp[1].crank_pin,state.crankPoint],['bellOutput',imp[2].piv_rod,state.bellOutputPoint],['slider',imp[3].wrist_pin,state.outputSliderPoint]])errors[name]=Math.max(errors[name],Math.hypot(expected[0]*scale-actual.x,expected[1]*scale-actual.y));
  if(i%90===0)samples.push({phase,pin:imp[1].crank_pin,bellOutput:imp[2].piv_rod,slider:imp[3].wrist_pin});
 }
 const imageScale=118/4,initial=samples[0],source=slottedElbowSource;
 const alignment=[['pin',initial.pin,source.crankPin],['pivot',referenceParameters.pivot.map(x=>x/scale),source.pivot],['output',initial.bellOutput,source.output]].map(([name,p,expected])=>{const mapped=[214+imageScale*p[0],209-imageScale*p[1]];return{name,mapped,engraving:expected,errorPixels:Math.hypot(mapped[0]-expected[0],mapped[1]-expected[1])};});
 const report={movement:156,url,libraryUrl,method:'Execute the source animation definition with its actual animation library in an isolated VM and a no-op canvas; read transformed important points at 721 equal cycle phases. Compare current model positions at its four-second period. This tests analytic trajectory agreement, not rendered solids or wall-clock source speed.',sourceHashes:{html:createHash('sha256').update(html).digest('hex'),library:createHash('sha256').update(library).digest('hex')},maximumWorldErrors:errors,reusableFormulaErrors:reusableErrors,diskAlignedSourceLandmarks:alignment,engravingParameters:slottedElbowParameters(),samples,sources:['scripts/compare-slotted-elbow-oracle.mjs','src/simulation/authored-cranks.js','src/simulation/slotted-elbow-motion.js','public/engravings/mm_156.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/156-oracle-comparison.json',JSON.stringify(report,null,2)+'\n');console.log({legacy:errors,reusable:reusableErrors,alignment});[...Object.values(errors),...Object.values(reusableErrors)].forEach(e=>assert.ok(e<1e-6));
}finally{disposeObject3D(v.root);}
