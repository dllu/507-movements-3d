import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {eggAtAngle,eggGeometry,eggSource} from '../src/simulation/egg-curve-motion.js';
const url='https://507movements.com/mm_172.html',libraryUrl='https://507movements.com/js/anilib.js',html=await(await fetch(url)).text(),library=await(await fetch(libraryUrl)).text();
fs.writeFileSync('/dev/shm/172-source.html',html);fs.writeFileSync('/dev/shm/172-anilib.js',library);
const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('add_model("mm_172")'));assert.ok(script);
const ctx=new Proxy({actx:{imp:[],cyclePos:0}},{get:(o,k)=>k in o?o[k]:()=>{}}),canvas={getContext:()=>ctx,width:525,height:525};
const sandbox={document:{createElement:()=>canvas,getElementById:()=>canvas},requestAnimationFrame:()=>{},setTimeout:()=>{}};sandbox.window=sandbox;vm.createContext(sandbox);vm.runInContext(library,sandbox,{timeout:1000});let model;const add=sandbox.ae.add_model;sandbox.ae.add_model=(...args)=>model=add(...args);vm.runInContext(script,sandbox,{timeout:1000});

let maximum=0;const samples=[];
for(let i=0;i<=720;i++){
 sandbox.oracleModel=model;sandbox.oracleContext=ctx;sandbox.oraclePhase=i/720;
 vm.runInContext('oracleModel.draw(oracleContext,"main",oraclePhase)',sandbox,{timeout:1000});
 const pin=Array.from(ctx.actx.imp[2].crank_pin),wrist=Array.from(ctx.actx.imp[3].wrist_pin);
 const state=eggAtAngle(Math.atan2(pin[1],pin[0]),{radius:10,length:40,guideY:0,fraction:15/40});
 maximum=Math.max(maximum,...wrist.map((v,j)=>Math.abs(v-state.wrist[j])));
 if(i%90===0)samples.push({phase:i/720,pin,wrist,tracer:state.tracer});
}
const initial=eggAtAngle(eggGeometry.phase);
const sourcePose=['crank','wrist','tracer'].map(name=>{const projected=[107+initial[name][0]/eggSource.scale,258-initial[name][1]/eggSource.scale];return{name,source:eggSource[name],projected,error:Math.hypot(...projected.map((v,i)=>v-eggSource[name][i]))};});
const trace=Array.from({length:2049},(_,i)=>eggAtAngle(i*Math.PI/1024).tracer).map(p=>[107+p[0]/eggSource.scale,258-p[1]/eggSource.scale]);
const reconstructedWitnessBounds=[Math.min(...trace.map(p=>p[0])),Math.min(...trace.map(p=>p[1])),Math.max(...trace.map(p=>p[0])),Math.max(...trace.map(p=>p[1]))];
const report={movement:172,engravingWitnessBounds:[181,189,357,326],reconstructedWitnessBounds,url,libraryUrl,maximumOracleCoordinateError:maximum,samples,sourcePose,production:eggGeometry,oracle:{radius:10,length:40,fraction:15/40},method:'Execute original anilib at 721 phases and compare finite slider-crank closure using oracle dimensions. Production uses separate engraving measurements; tracer position is projected onto the measured rigid rod.',sourceHashes:{html:createHash('sha256').update(html).digest('hex'),library:createHash('sha256').update(library).digest('hex')},sources:['scripts/compare-egg-curve-oracle.mjs','src/simulation/egg-curve-motion.js','public/engravings/mm_172.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('docs/validation/172-oracle.json',JSON.stringify(report,null,2)+'\n');console.log({maximum,sourcePose});assert.ok(maximum<1e-9);
