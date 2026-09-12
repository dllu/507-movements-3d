import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readStudyReport,freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix='artifacts/review/086-integrated-trip',prior=readStudyReport('artifacts/review/086-integrated-final-captures.json');
assert(prior.passed);verifyStudySources(prior.sources);
const sources=freezeStudySources(['scripts/capture-pump-catch-trip.mjs',...prior.sources.map(s=>s.file)],prefix),
 browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1100,height:760}}),views=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5174/#/about');
 await page.evaluate(async()=>{
  const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json');
  document.body.innerHTML='<main style="padding:16px;background:#faf8f2"><div id="title" style="font:20px system-ui;height:40px"></div><div id="stage" style="width:1068px;height:688px"></div></main>';
  const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[85],{playing:false});cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.tripReview=e;
 });
 for(const [name,time,oblique]of [['approach',1.24,false],['contact',1.265,false],['released',1.30,false],['contact-oblique',1.265,true]]){
  const state=await page.evaluate(async({name,time,oblique})=>{
   const {THREE:{Vector3,OrthographicCamera}}=await import('/src/simulation/pump-catch-complete-geometry.js'),e=window.tripReview,
    target=new Vector3(.010253633,1.869094729,.04),h=1.25,w=h*1068/688,camera=new OrthographicCamera(-w/2,w/2,h/2,-h/2,.01,100);
   camera.position.copy(target).add(new Vector3(...(oblique?[4,2,10]:[0,0,10])));camera.lookAt(target);camera.updateMatrixWorld();
   e.model.update(time);e.renderer.render(e.scene,camera);document.querySelector('#title').textContent=`086 · overhead trip · ${name} · ${time.toFixed(3)} s`;
   return e.model.root.userData.kinematics;
  },{name,time,oblique});
  const file=prefix+'-'+name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file});
  views.push({name,time,state,file,sha256:hashStudyFile(file),inspected:false});
 }
 verifyStudySources(sources);const report={movement:86,passed:errors.length===0,errors,views,sources,
  qualification:'Additional close views center the actual lower-left trip-stop corner at (0.010253633, 1.869094729), bracketing the finite tail contact. The earlier trip-detail capture centered the pivot and did not show this corner.'};
 fs.writeFileSync(prefix+'-captures.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,views:views.length,sources:undefined});assert(report.passed);
}finally{await browser.close();}
