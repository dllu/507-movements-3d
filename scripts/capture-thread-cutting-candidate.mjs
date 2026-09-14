import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
import {threadCuttingStudySources} from './lib/thread-cutting-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/109-browser',options=JSON.parse(process.env.SIM_OPTIONS??'{}');
const sources=freezeStudySources([...threadCuttingStudySources('scripts/capture-thread-cutting-candidate.mjs'),'src/simulation/engine.js','src/simulation/model-loader.js','src/main.js','src/styles.css','src/data/movements.json'],prefix);
const views=[],errors=[],warnings=[],browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1450,height:760}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text());});
 await page.route('**/__review_109',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><link rel="icon" href="data:,"><style>body{margin:0}.simulation-canvas{display:block;width:100%;height:100%}</style></head><body></body></html>'}));
 await page.goto('http://127.0.0.1:5174/__review_109',{waitUntil:'domcontentloaded'});
 await page.evaluate(async options=>{
  const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json');
  document.body.innerHTML='<main style="padding:16px;background:#faf8f2"><div id="title" style="font:20px system-ui;height:32px"></div><div style="display:flex;gap:16px"><div id="stage" style="width:700px;height:700px;position:relative"></div><img src="/engravings/mm_109.png" style="width:700px;height:700px;object-fit:contain"></div></main>';
  await document.querySelector('img').decode();
  const {getMujoco}=await import('/src/simulation/mujoco/load.js'),{makeMujocoThreadCutting}=await import('/src/simulation/mujoco-thread-cutting/visual.js');
  const model=Object.keys(options).length?makeMujocoThreadCutting(await getMujoco(),options):await (await import('/src/simulation/model-loader.js')).loadMovementModel(catalog.movements[108]);
  const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[108],{playing:false,model});
  cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.review109=e;
 },options);
 const period=options.period??24;
 for(const spec of [
  {name:'source-front',time:0},{name:'source-overlay',time:0},{name:'front',time:0},
  {name:'cutting',time:3},{name:'lower',time:6},{name:'return',time:9},{name:'upper',time:18},
  {name:'cycle',time:24},{name:'second-cycle',time:48},
  {name:'oblique',time:2,direction:[3,2,8]},{name:'rear',time:9,direction:[-3,2,-8]},
  {name:'gears',time:1,detail:'gears',direction:[0,10,3]},
  {name:'tool',time:0,detail:'tool',direction:[3,1,8]},
  {name:'tool-cutting',time:3,detail:'tool',direction:[3,1,8]},
  {name:'tool-return',time:9,detail:'tool',direction:[3,1,8]},
  {name:'guide',time:2,detail:'guide',direction:[-3,2,-8]},
  {name:'nut',time:0,detail:'nut',direction:[2,6,8]},
 ].map(s=>({...s,time:s.time*period/24}))) {
  const state=await page.evaluate(async spec=>{
   const {THREE:{Vector3,OrthographicCamera}}=await import('/src/simulation/mujoco-thread-cutting/visual.js');
   const e=window.review109,u=e.model.root.userData,f=u.profile;
   document.querySelector('#overlay')?.remove();e.model.update(spec.time);e.fitCamera(new Vector3(...(spec.direction??[0,0,10])));let camera=e.camera;
   if(spec.name.startsWith('source-')) {
    const half=525/200,x=(525/2-f.axis[0])/100,y=(f.axis[1]-525/2)/100;
    camera=new OrthographicCamera(-half,half,half,-half,.01,100);camera.position.set(x,y,10);camera.lookAt(x,y,0);camera.updateMatrixWorld();
   }
   if(spec.detail) {
    const center=spec.detail==='gears'?new Vector3(0,f.gearY,0):spec.detail==='tool'?new Vector3(f.workX-f.workRadius*f.dx/f.distance,f.armY+u.state.qpos[2],f.workZ+f.workRadius*f.dz/f.distance):spec.detail==='guide'?new Vector3(f.leadX,u.state.qpos[2],f.leadZ-.55):new Vector3(f.leadX,u.state.qpos[2],f.leadZ);
    const half=spec.detail==='gears'?1.4:spec.detail==='tool'?.4:.48;
    camera=new OrthographicCamera(-half,half,half,-half,.01,100);camera.position.copy(center).add(new Vector3(...spec.direction));camera.lookAt(center);camera.updateMatrixWorld();
   }
   e.renderer.render(e.scene,camera);
   if(spec.name==='source-overlay') {const img=document.createElement('img');img.id='overlay';img.src='/engravings/mm_109.png';img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';document.querySelector('#stage').append(img);await img.decode();}
   document.querySelector('#title').textContent='109 · '+spec.name;
   return {...u.state,gearErrorRadians:u.state.qpos[1]-f.ratio*u.state.qpos[0],feedErrorPixels:100*(u.state.qpos[2]+f.lead*u.state.qpos[0])};
  },spec);
  const file=prefix+'-'+spec.name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file});views.push({...spec,state,file,sha256:hashStudyFile(file),inspected:false});
 }
 const runtime=await page.evaluate(()=>new Promise(resolve=>{
  const e=window.review109,frames=[];let first,last;e.model.reset();e.elapsed=0;e.playbackEnded=false;e.playing=true;e.fitCamera(e.model.cameraDirection);
  function frame(now){first??=now;const time=(now-first)/1000,start=performance.now();e.advance(Math.min(last===undefined?0:(now-last)/1000,.05));const updateMs=performance.now()-start;e.renderer.render(e.scene,e.camera);const u=e.model.root.userData;
   frames.push({time,simulationTime:u.state.time,updateMs,intervalMs:last===undefined?0:now-last});last=now;
   if(time<u.animationTiming.authoredCyclePeriod+2)requestAnimationFrame(frame);else resolve({frames,wallSeconds:(performance.now()-first)/1000,simulationTime:u.state.time,backend:u.simulationBackend,fog:e.scene.fog,hideGround:u.hideGround,state:u.state});
  }requestAnimationFrame(frame);
 }));
 await page.evaluate(()=>window.review109.dispose());
 if(!Object.keys(options).length) {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:5174/#/movement/109',{waitUntil:'domcontentloaded'});
  await page.locator('.simulation-canvas').waitFor({timeout:15000});
  await page.getByRole('button',{name:'Restart',exact:true}).waitFor();
  for(const [name,width,height]of [['desktop',1450,1000],['mobile',390,844]]) {
   await page.setViewportSize({width,height});
   await page.getByRole('button',{name:'Reset view',exact:true}).click();
   await page.evaluate(()=>window.scrollTo(0,0));
   const file=prefix+'-'+name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file,fullPage:true});
   views.push({name,file,sha256:hashStudyFile(file),inspected:false});
  }
  const note=page.getByText(/^Change gears set the pitch cut by the guided tool\./);
  await note.evaluate(el=>el.scrollIntoView({block:'center'}));
  assert(await note.evaluate(el=>{const a=el.getBoundingClientRect(),b=el.closest('.movement-notes').getBoundingClientRect();return a.top>=b.top&&a.bottom<=b.bottom;}));
  const file=prefix+'-mobile-notes.png';assert(!fs.existsSync(file));await page.screenshot({path:file});
  views.push({name:'mobile-notes',file,sha256:hashStudyFile(file),inspected:false});
 }
 const known=[/^THREE.Clock: This module has been deprecated\./,/^THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated\./,/^\[.WebGL-.*GPU stall due to ReadPixels/],unexpectedWarnings=warnings.filter(w=>!known.some(r=>r.test(w)));
 const passed=!errors.length&&!unexpectedWarnings.length&&runtime.backend==='mujoco';verifyStudySources(sources);
 fs.writeFileSync(prefix+'.json',JSON.stringify({sources,options,views,runtime,errors,warnings,unexpectedWarnings,passed,qualification:Object.keys(options).length?'Direct candidate factory with study options.':'Default catalog loader and desktop/mobile routes. Source interpretation, finite clearances and ideal-constraint dynamics require their separate evidence.'},null,2)+'\n',{flag:'wx'});
 console.log({passed,views:views.length,frames:runtime.frames.length,errors,unexpectedWarnings});assert(passed);
}finally{await browser.close();}
