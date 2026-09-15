import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {kneePressAtAngle,kneePressGeometry} from '../src/simulation/knee-press-motion.js';
const url='https://507movements.com/mm_164.html',libraryUrl='https://507movements.com/js/anilib.js',html=await(await fetch(url)).text(),library=await(await fetch(libraryUrl)).text();
fs.writeFileSync('/dev/shm/164-source.html',html);fs.writeFileSync('/dev/shm/164-anilib.js',library);
const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('add_model("mm_164")'));assert.ok(script);
const ctx=new Proxy({actx:{imp:[],cyclePos:0}},{get:(o,k)=>k in o?o[k]:()=>{}}),canvas={getContext:()=>ctx,width:525,height:525};
const sandbox={document:{createElement:()=>canvas,getElementById:()=>canvas},requestAnimationFrame:()=>{},setTimeout:()=>{}};sandbox.window=sandbox;vm.createContext(sandbox);vm.runInContext(library,sandbox,{timeout:1000});let model;const add=sandbox.ae.add_model;sandbox.ae.add_model=(...args)=>model=add(...args);vm.runInContext(script,sandbox,{timeout:1000});
let maximum=0;const samples=[];
for(let i=0;i<=720;i++){
 sandbox.oracleModel=model;sandbox.oracleContext=ctx;sandbox.oraclePhase=i/720;vm.runInContext('oracleModel.draw(oracleContext,"main",oraclePhase)',sandbox,{timeout:1000});const imp=ctx.actx.imp,top=Array.from(imp[1].lever_pin),knee=Array.from(imp[2].wrist_pin),foot=[0,0],upper=[-.0625,-2];
 const angle=Math.atan2(knee[1]-top[1],knee[0]-top[0])-Math.atan2(upper[1],upper[0]),state=kneePressAtAngle(angle,{top,foot,upper,lowerLength:8,handle:[10,-1]});
 maximum=Math.max(maximum,Math.hypot(state.knee[0]-knee[0],state.knee[1]-knee[1]),Math.hypot(state.top[0]-top[0],state.top[1]-top[1]));
 if(i%90===0)samples.push({phase:i/720,top,knee,angle});
}
const report={movement:164,url,libraryUrl,method:'Execute the original animation with its library at 721 phases. Compare the independent circle/vertical-guide solution using oracle link dimensions and measured lever angle. Rendering contours come from our measurements of the public-domain engraving, not the oracle drawing.',maximumOracleCoordinateError:maximum,sourceGeometry:kneePressGeometry(),samples,sourceHashes:{html:createHash('sha256').update(html).digest('hex'),library:createHash('sha256').update(library).digest('hex')},sources:['scripts/compare-knee-press-oracle.mjs','src/simulation/knee-press-motion.js','public/engravings/mm_164.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};fs.writeFileSync('docs/validation/164-oracle-comparison.json',JSON.stringify(report,null,2)+'\n');console.log(report);assert.ok(maximum<1e-6);
