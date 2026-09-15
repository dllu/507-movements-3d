import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lostMotionBrickAtAngle,lostMotionBrickGeometry} from '../src/simulation/lost-motion-brick-press-motion.js';
const url='https://507movements.com/mm_166.html',libraryUrl='https://507movements.com/js/anilib.js',html=await(await fetch(url)).text(),library=await(await fetch(libraryUrl)).text();
fs.writeFileSync('/dev/shm/166-source.html',html);fs.writeFileSync('/dev/shm/166-anilib.js',library);
const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('add_model("mm_166")'));assert.ok(script);
const ctx=new Proxy({actx:{imp:[],cyclePos:0}},{get:(o,k)=>k in o?o[k]:()=>{}}),canvas={getContext:()=>ctx,width:525,height:525};
const sandbox={document:{createElement:()=>canvas,getElementById:()=>canvas},requestAnimationFrame:()=>{},setTimeout:()=>{}};sandbox.window=sandbox;vm.createContext(sandbox);vm.runInContext(library,sandbox,{timeout:1000});let model;const add=sandbox.ae.add_model;sandbox.ae.add_model=(...args)=>model=add(...args);vm.runInContext(script,sandbox,{timeout:1000});
let maximum=0;const samples=[];
for(let i=0;i<=720;i++){
 sandbox.oracleModel=model;sandbox.oracleContext=ctx;sandbox.oraclePhase=i/720;vm.runInContext('oracleModel.draw(oracleContext,"main",oraclePhase)',sandbox,{timeout:1000});const imp=ctx.actx.imp,pin=Array.from(imp[1].crank_pin),slide=Array.from(imp[2].tx_slide),angle=Math.atan2(pin[1],pin[0]),state=lostMotionBrickAtAngle(angle,{crankRadius:5.5,inner:25,outer:28});
 maximum=Math.max(maximum,Math.abs(state.x-slide[0]));
 if(i%90===0)samples.push({phase:i/720,pin,slide,angle,stage:state.stage});
}
const report={movement:166,url,libraryUrl,method:'Execute the original animation with its library at 721 phases. Compare independent two-end slider-crank closure and held-output dwells using oracle dimensions and measured crank angle. Rendering contours come from our measurements of the public-domain engraving, not the oracle drawing.',maximumOracleCoordinateError:maximum,sourceGeometry:lostMotionBrickGeometry(),sourceDwellFraction:lostMotionBrickAtAngle(0,lostMotionBrickGeometry()).dwellFraction,oracleDwellFraction:lostMotionBrickAtAngle(0,{crankRadius:5.5,inner:25,outer:28}).dwellFraction,samples,sourceHashes:{html:createHash('sha256').update(html).digest('hex'),library:createHash('sha256').update(library).digest('hex')},sources:['scripts/compare-lost-motion-oracle.mjs','src/simulation/lost-motion-brick-press-motion.js','public/engravings/mm_166.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};fs.writeFileSync('docs/validation/166-oracle-comparison.json',JSON.stringify(report,null,2)+'\n');console.log(report);assert.ok(maximum<1e-6);
