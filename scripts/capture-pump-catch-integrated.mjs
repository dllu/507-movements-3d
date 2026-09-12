import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-integrated-final',exported=readStudyReport('artifacts/review/086-production-export.json'),
  sources=freezeStudySources(['scripts/capture-pump-catch-integrated.mjs',...exported.exportedFiles,
    'src/data/display-profiles.js','src/data/display-profiles.json','src/data/movements.json','src/simulation/authored-intermittent.js',
    'src/simulation/registry.js','src/simulation/engine.js','src/simulation/finite-plate-geometry.js','src/simulation/conforming-plate-mesh.js',
    'src/simulation/clutch-section-geometry.js','src/simulation/primitives.js','artifacts/reference/brown-086-detail.png'],prefix),
  browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1500,height:800}}),errors=[],warnings=[],views=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text());});
try{
 await page.goto('http://127.0.0.1:5174/#/about');
 const rendererInfo=await page.evaluate(async()=>{
  const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json');
  document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-086-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
  await document.querySelector('img').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[85],{playing:false});
  cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.pumpReview=e;
  const gl=e.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  return{renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),pixelRatio:e.renderer.getPixelRatio()};
 });
 const runtime=await page.evaluate(()=>new Promise(resolve=>{
  const e=window.pumpReview,frames=[];let first,last;
  const frame=now=>{
   first??=now;const time=(now-first)/1000,start=performance.now();e.model.update(time);
   const updateMs=performance.now()-start;e.renderer.render(e.scene,e.camera);
   frames.push({time,intervalMs:last===undefined?0:now-last,updateMs,...e.model.root.userData.kinematics});last=now;
   document.querySelector('#title').textContent='086 · integrated playback · '+time.toFixed(2)+' s';
   if(time<12.2)requestAnimationFrame(frame);else resolve({duration:time,frames,fog:e.scene.fog,hiddenGround:e.model.root.userData.hideGround,
    timeScale:e.playbackTimeScale,displayCycleDuration:e.model.root.userData.animationTiming.displayCycleDuration,
    repeatsIndefinitely:e.playbackDuration===Infinity,motionBounds:e.model.root.userData.sampledMotionBounds});
  };requestAnimationFrame(frame);
 }));
 const poses=[['source',0],['source-aligned',0],['source-overlay',0],['capture',.0375],['lift',1],['maximum-lift',1.3515],
  ['trip',1.347],['return',2.5],['slack-front',3.6525],['take-up',4.0167],['loop-before',4.25],['loop-after',4.250001],
  ['oblique',0],['slack-oblique',3.6525],['rear',1],['catch-detail',.0375],['trip-detail',1.347]];
 for(const [name,time]of poses){
  const state=await page.evaluate(async({name,time})=>{
   const {THREE:{Vector3,OrthographicCamera}}=await import('/src/simulation/pump-catch-complete-geometry.js'),e=window.pumpReview,s=e.model.root.userData.source;
   document.querySelector('#overlay')?.remove();e.model.update(time);
   e.fitCamera(new Vector3(...(name==='rear'?[-4,2,-10]:name.includes('oblique')?[4,2,10]:[0,0,10])));let camera=e.camera;
   if(name==='source-aligned'||name==='source-overlay'){
    const h=Math.max(1240,1200*720/726)/s.scale,w=h*726/720,cx=(600-s.center[0])/s.scale,cy=(s.center[1]-620)/s.scale;
    camera=new OrthographicCamera(-w/2,w/2,h/2,-h/2,.01,100);camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();
   }
   if(name.endsWith('-detail')){
    const target=new Vector3(...(name==='trip-detail'?[.38,.97,.03]:[-.40,.20,.03])),half=name==='trip-detail'?.80:.95;
    camera=new OrthographicCamera(-half,half,half*720/726,-half*720/726,.01,100);camera.position.copy(target).add(new Vector3(0,0,8));camera.lookAt(target);camera.updateMatrixWorld();
   }
   e.renderer.render(e.scene,camera);document.querySelector('#title').textContent=`086 · integrated model · ${name} · ${time.toFixed(6)} s`;
   if(name==='source-overlay'){
    const image=document.createElement('img');image.id='overlay';image.src='/artifacts/reference/brown-086-detail.png';
    image.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';
    document.querySelector('#stage').append(image);await image.decode();
   }
   return e.model.root.userData.kinematics;
  },{name,time});
  const file=prefix+'-'+name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file});
  views.push({name,time,state,file,sha256:hashStudyFile(file),inspected:false});
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('http://127.0.0.1:5174/?review=086-integrated#/movement/086');
 await page.locator('canvas').waitFor({state:'visible'});await page.getByRole('button',{name:'Play',exact:true}).waitFor();
 for(const [name,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  await page.setViewportSize(viewport);await page.getByRole('button',{name:'Reset view',exact:true}).click();await page.waitForTimeout(200);
  const file=prefix+'-'+name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file,fullPage:true});
  views.push({name,file,sha256:hashStudyFile(file),inspected:false});
 }
 const updates=runtime.frames.map(f=>f.updateMs).sort((a,b)=>a-b),intervals=runtime.frames.slice(1).map(f=>f.intervalMs).sort((a,b)=>a-b),
  summary={duration:runtime.duration,frames:runtime.frames.length,fps:(runtime.frames.length-1)/runtime.duration,
   p95UpdateMs:updates[Math.floor(updates.length*.95)],p95IntervalMs:intervals[Math.floor(intervals.length*.95)],fog:runtime.fog,
   hiddenGround:runtime.hiddenGround,timeScale:runtime.timeScale,displayCycleDuration:runtime.displayCycleDuration,
   repeatsIndefinitely:runtime.repeatsIndefinitely,motionBounds:runtime.motionBounds},
  known=[/^THREE.Clock: This module has been deprecated\./,/^THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated\./,/^\[.WebGL-.*GPU stall due to ReadPixels/],
  unexpectedWarnings=warnings.filter(w=>!known.some(r=>r.test(w)));
 verifyStudySources(sources);const report={movement:86,passed:!errors.length&&!unexpectedWarnings.length&&summary.fog===null&&summary.hiddenGround&&summary.timeScale===1&&summary.displayCycleDuration===4&&summary.repeatsIndefinitely,
  rendererInfo,summary,runtime,views,errors,warnings,unexpectedWarnings,sources};
 fs.writeFileSync(prefix+'-captures.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,runtime:undefined,sources:undefined,views:views.length});
 assert(report.passed);
}finally{await browser.close();}
