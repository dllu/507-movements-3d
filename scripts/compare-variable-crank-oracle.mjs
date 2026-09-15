import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {variableRadiusCrankAtAngle,sourceVariableCrankGeometry} from '../src/simulation/variable-radius-crank-motion.js';
const url='https://507movements.com/mm_168.html',libraryUrl='https://507movements.com/js/anilib.js',html=await(await fetch(url)).text(),library=await(await fetch(libraryUrl)).text();
fs.writeFileSync('/dev/shm/168-source.html',html);fs.writeFileSync('/dev/shm/168-anilib.js',library);
const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('add_model("mm_168")'));assert.ok(script);
const ctx=new Proxy({actx:{imp:[],cyclePos:0}},{get:(o,k)=>k in o?o[k]:()=>{}}),canvas={getContext:()=>ctx,width:525,height:525};
const sandbox={document:{createElement:()=>canvas,getElementById:()=>canvas},requestAnimationFrame:()=>{},setTimeout:()=>{}};sandbox.window=sandbox;vm.createContext(sandbox);vm.runInContext(library,sandbox,{timeout:1000});let model;const add=sandbox.ae.add_model;sandbox.ae.add_model=(...args)=>model=add(...args);vm.runInContext(script,sandbox,{timeout:1000});
let maximum=0;const samples=[];
for(let i=0;i<=720;i++){
 sandbox.oracleModel=model;sandbox.oracleContext=ctx;sandbox.oraclePhase=i/720;vm.runInContext('oracleModel.draw(oracleContext,"main",oraclePhase)',sandbox,{timeout:1000});const imp=ctx.actx.imp,pin=Array.from(imp[2].crank_pin),wrist=Array.from(imp[3].wrist_pin),slotPin=Array.from(imp[3].pittman),angle=Math.atan2(pin[1],pin[0]),state=variableRadiusCrankAtAngle(angle);
 maximum=Math.max(maximum,...wrist.map((x,j)=>Math.abs(x-state.wrist[j])),...slotPin.map((x,j)=>Math.abs(x-state.slotPin[j])));
 if(i%90===0)samples.push({phase:i/720,pin,wrist,slotPin});
}
const initial=variableRadiusCrankAtAngle(.2*2*Math.PI);
const projected=(p)=>[286+p[0]*21.6,264-p[1]*21.6];
const sourcePoseComparison=[['auxiliaryPin',[310,217],initial.auxiliaryPin],['slotPin',[123,161],initial.slotPin],['wrist',[473,263],initial.wrist]].map(([name,engraving,p])=>({name,engraving,oracleProjected:projected(p),pixelError:Math.hypot(...projected(p).map((x,i)=>x-engraving[i]))}));
const productionGeometry=sourceVariableCrankGeometry(),production=variableRadiusCrankAtAngle(productionGeometry.phase,productionGeometry);
const productionPoseComparison=[['auxiliaryPin',[310,217],production.auxiliaryPin],['slotPin',[123,161],production.slotPin],['wrist',[473,263],production.wrist]].map(([name,engraving,p])=>{const projected=[286+p[0]/productionGeometry.scale,264-p[1]/productionGeometry.scale];return{name,engraving,projected,pixelError:Math.hypot(...projected.map((x,i)=>x-engraving[i]))};});
const report={productionGeometry,productionPoseComparison,movement:168,url,libraryUrl,method:'Execute the source animation at 721 phases and compare independent angular circle-intersection closure. Approximate source-pose comparison anchors auxiliary shaft at (286,264), uses 216-pixel shaft spacing, and keeps axes parallel to the raster. Source shafts differ in height by three pixels.',maximumOracleCoordinateError:maximum,sourcePoseComparison,samples,sourceHashes:{html:createHash('sha256').update(html).digest('hex'),library:createHash('sha256').update(library).digest('hex')},sources:['scripts/compare-variable-crank-oracle.mjs','src/simulation/variable-radius-crank-motion.js','public/engravings/mm_168.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('docs/validation/168-oracle-comparison.json',JSON.stringify(report,null,2)+'\n');console.log({maximum,sourcePoseComparison});assert.ok(maximum<1e-6);
