import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readStudyReport,freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
import {pumpCatchCompleteSources} from './lib/pump-catch-complete-sources.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-playback',input=process.env.PROBE_INPUT??'artifacts/review/086-first-compressed-motion.json',data=readStudyReport(input),
  hardwareFile=process.env.PROBE_HARDWARE??'artifacts/review/086-refined-hardware-bounds.json',ropeFile=process.env.PROBE_ROPE??'artifacts/review/086-first-rope-controls-baseline.json',
  hardware=readStudyReport(hardwareFile),rope=readStudyReport(ropeFile),sources=freezeStudySources([input,hardwareFile,ropeFile,
    'scripts/capture-pump-catch-playback.mjs','scripts/lib/pump-catch-playback.mjs','scripts/lib/pump-catch-live-rope.mjs',
    'scripts/lib/pump-catch-indexed-hardware.mjs',...pumpCatchCompleteSources,'src/simulation/engine.js'],prefix),live=process.env.PROBE_LIVE==='1',indexed=process.env.PROBE_INDEXED==='1';
for(const report of [data,hardware,rope]){assert(report.passed);verifyStudySources(report.sources);}
const boxes=[...hardware.bodies.map(b=>b.swept),...rope.regions],motionBounds={min:[0,1,2].map(k=>Math.min(...boxes.map(b=>b.min[k]))-1e-6),max:[0,1,2].map(k=>Math.max(...boxes.map(b=>b.max[k]))+1e-6)},
  browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1500,height:800}}),errors=[],warnings=[],views=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text());});
try{
  await page.goto('http://127.0.0.1:5174/#/about');
  const rendererInfo=await page.evaluate(async({data,motionBounds,live,indexed})=>{
    const{MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json'),
      {makePumpCatchCompleteCandidate,THREE}=await import('/scripts/lib/pump-catch-complete-candidate.mjs'),{makePumpCatchPlayback}=await import('/scripts/lib/pump-catch-playback.mjs');
    document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-086-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
    await document.querySelector('img').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[85],{playing:false});cancelAnimationFrame(e.animationFrame);e.animationFrame=0;
    e.scene.remove(e.model.root);e.model.root.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});
    e.model=live?(await import('/scripts/lib/pump-catch-live-rope.mjs')).makePumpCatchLiveCandidate():makePumpCatchCompleteCandidate();e.scene.add(e.model.root);e.model.root.userData.sampledMotionBounds=motionBounds;e.updateGroundClearance();
    if(indexed)(await import('/scripts/lib/pump-catch-indexed-hardware.mjs')).indexPumpCatchHardware(e.model);
    const u=e.model.root.userData;for(const light of e.scene.children.filter(o=>o.isDirectionalLight&&o.castShadow)){
      Object.assign(light.shadow.camera,{left:-u.shadowCameraHalfExtent,right:u.shadowCameraHalfExtent,top:u.shadowCameraHalfExtent,bottom:-u.shadowCameraHalfExtent});
      light.shadow.camera.updateProjectionMatrix();light.shadow.bias=u.shadowBias;light.shadow.normalBias=u.shadowNormalBias;
    }
    e.fitCamera(new THREE.Vector3(0,0,10));window.pumpPlayback={engine:e,motion:makePumpCatchPlayback(data)};
    const gl=e.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
    return{renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),pixelRatio:e.renderer.getPixelRatio()};
  },{data:{rows:data.rows,repeat:data.repeat,angularSpeed:data.angularSpeed},motionBounds,live,indexed});
  const timing=await page.evaluate(()=>new Promise(resolve=>{
    const{engine:e,motion}=window.pumpPlayback,frames=[];let first,last;
    const frame=now=>{
      first??=now;const time=(now-first)/1000,start=performance.now(),state=motion.sample(time);e.model.setState(state);const updateMs=performance.now()-start;
      e.renderer.render(e.scene,e.camera);frames.push({time,intervalMs:last===undefined?0:now-last,updateMs,pumpHeight:state.pumpHeight});last=now;
      document.querySelector('#title').textContent='086 · four display seconds per input revolution · '+time.toFixed(2)+' s';
      if(time<12.2)requestAnimationFrame(frame);else resolve({duration:time,frames});
    };requestAnimationFrame(frame);
  }));
  for(const[name,time,oblique]of [['source',0,false],['lift',1.345,false],['slack',3.6525,true],['loop-before',4.25,false],['loop-after',4.250001,false]]){
    const state=await page.evaluate(async({name,time,oblique})=>{
      const{engine:e,motion}=window.pumpPlayback,{THREE}=await import('/scripts/lib/pump-catch-complete-candidate.mjs'),state=motion.sample(time);e.model.setState(state);
      e.fitCamera(new THREE.Vector3(...(oblique?[4,2,10]:[0,0,10])));e.renderer.render(e.scene,e.camera);
      document.querySelector('#title').textContent='086 · '+name+' · '+time+' display seconds';return state;
    },{name,time,oblique});
    const file=prefix+'-'+name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file});views.push({name,file,time,state,sha256:hashStudyFile(file),inspected:false});
  }
  const intervals=timing.frames.slice(1).map(f=>f.intervalMs).sort((a,b)=>a-b),updates=timing.frames.map(f=>f.updateMs).sort((a,b)=>a-b),
    summary={duration:timing.duration,frames:timing.frames.length,fps:(timing.frames.length-1)/timing.duration,p95IntervalMs:intervals[Math.floor(intervals.length*.95)],p95UpdateMs:updates[Math.floor(updates.length*.95)]},
    known=[/^THREE.Clock: This module has been deprecated\./,/^THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated\./,/^\[.WebGL-.*GPU stall due to ReadPixels/],unexpectedWarnings=warnings.filter(w=>!known.some(r=>r.test(w)));
  verifyStudySources(sources);const report={movement:86,status:'isolated-compressed-browser-playback',passed:!errors.length&&!unexpectedWarnings.length,
    input,live,indexed,rendererInfo,summary,timing,views,errors,warnings,unexpectedWarnings,motionBounds,sources,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false};
  fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,timing:undefined,views:views.length,sources:undefined});assert(report.passed);
}finally{await browser.close();}
