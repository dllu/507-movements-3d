import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
import {sectorHandoffStudySources} from './lib/sector-handoff-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/123-candidate',options=JSON.parse(process.env.SIM_OPTIONS??'{}'),integrated=process.env.INTEGRATED==='1',baseUrl=process.env.PROBE_BASE_URL??'http://127.0.0.1:43926';
assert(!integrated||!Object.keys(options).length,'Catalog capture uses the registered defaults');
const sources=freezeStudySources([...sectorHandoffStudySources('scripts/capture-sector-handoff-candidate.mjs'),'src/simulation/engine.js','src/simulation/model-loader.js','src/data/movements.json'],prefix);
const browser=await chromium.launch({channel:'chrome',headless:true}),views=[],errors=[],warnings=[];
try {
 const page=await browser.newPage({viewport:{width:1450,height:760}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text());});
 await page.route('**/__review_123',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><link rel="icon" href="data:,"><style>body{margin:0}.simulation-canvas{display:block;width:100%;height:100%}</style></head><body></body></html>'}));
 await page.goto(baseUrl+'/__review_123',{waitUntil:'domcontentloaded'});
 await page.evaluate(async ({options,integrated})=>{
  const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json');
  document.body.innerHTML='<main style="padding:16px;background:#faf8f2"><div id="title" style="font:20px system-ui;height:32px"></div><div style="display:flex;gap:16px"><div id="stage" style="width:700px;height:700px;position:relative"></div><img src="/engravings/mm_123.png" style="width:700px;height:700px;object-fit:contain"></div></main>';
  await document.querySelector('img').decode();
  let model;
  if(integrated){const {loadMovementModel}=await import('/src/simulation/model-loader.js');model=await loadMovementModel(catalog.movements[122]);}
  else {const {getMujoco}=await import('/src/simulation/mujoco/load.js'),{makeMujocoSectorHandoff}=await import('/src/simulation/mujoco-sector-handoff/visual.js');model=makeMujocoSectorHandoff(await getMujoco(),options);}
  const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[122],{playing:false,model});
  cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.review123=e;
 },{options,integrated});
 const specs=process.env.VIEW_SPECS?JSON.parse(process.env.VIEW_SPECS):[
  {name:'source-front',time:0},{name:'source-overlay',time:0},{name:'front',time:0},
  {name:'before-lower-handoff',time:1.45},{name:'lower-reversal',time:1.75},{name:'after-lower-handoff',time:2.05},
  {name:'half-turn',time:3.25},{name:'upper-reversal',time:4.75},{name:'one-turn',time:6.25},{name:'two-turns',time:12.25},
  {name:'cam-reveal',time:1.75,section:true,detail:true,center:[0,-.42,.25],direction:[0,0,10]},
  {name:'section-front',time:0,section:true},{name:'section-upper-reversal',time:4.75,section:true,detail:true,center:[0,.42,.25],direction:[0,0,10]},
  {name:'sector-mesh',time:0,detail:true,center:[-.29,0,.4],direction:[1,1,10]},
  {name:'spur-mesh',time:0,hidden:['leftSector','rightSector','rack'],detail:true,center:[-.73,0,.1],direction:[0,0,10]},
  {name:'oblique',time:0,direction:[3,2,8]},{name:'rear',time:3.25,direction:[-3,2,-8]},
 ];
 for(const spec of specs.sort((a,b)=>a.time-b.time)) {
  const state=await page.evaluate(async spec=>{
   const {THREE:{Vector3,OrthographicCamera}}=await import('/src/simulation/mujoco-sector-handoff/visual.js');
   const e=window.review123,u=e.model.root.userData,f=u.source;
   for(const[n,part]of Object.entries(u.parts))part.visible=!(spec.hidden??[]).includes(n);
   u.setSectionView(spec.section??false);if((spec.hidden??[]).includes('rack'))u.parts.rack.visible=false;
   document.querySelector('#overlay')?.remove();e.model.update(spec.time);e.fitCamera(new Vector3(...(spec.direction??[0,0,10])));let camera=e.camera;
   if(spec.name.startsWith('source-')) {
    const half=525/200,x=(525/2-f.axis[0])/100,y=(f.axis[1]-525/2)/100;
    camera=new OrthographicCamera(-half,half,half,-half,.01,100);camera.position.set(x,y,10);camera.lookAt(x,y,0);camera.updateMatrixWorld();
   }
   if(spec.detail!==undefined) {
    const center=new Vector3(...spec.center),half=.46;
    camera=new OrthographicCamera(-half,half,half,-half,.01,100);camera.position.copy(center).add(new Vector3(...spec.direction));camera.lookAt(center);camera.updateMatrixWorld();
   }
   e.renderer.render(e.scene,camera);
   if(spec.name==='source-overlay') {const img=document.createElement('img');img.id='overlay';img.src='/engravings/mm_123.png';img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';document.querySelector('#stage').append(img);await img.decode();}
   document.querySelector('#title').textContent='123 · '+u.reconstructionStatus+' · '+spec.name;return u.state;
  },spec);
  const file=prefix+'-'+spec.name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file});views.push({...spec,state,file,sha256:hashStudyFile(file),inspected:false});console.log({view:spec.name,time:spec.time});
 }
 const runtime=await page.evaluate(()=>new Promise(resolve=>{
  const e=window.review123,frames=[];for(const part of Object.values(e.model.root.userData.parts))part.visible=true;e.model.root.userData.setSectionView(false);let first,last;e.model.reset();e.elapsed=0;e.playing=true;e.fitCamera(e.model.cameraDirection);
  function frame(now){first??=now;const time=(now-first)/1000,start=performance.now();e.advance(Math.min(last===undefined?0:(now-last)/1000,.05));const updateMs=performance.now()-start;e.renderer.render(e.scene,e.camera);const u=e.model.root.userData;
   frames.push({time,simulationTime:u.state.time,updateMs,intervalMs:last===undefined?0:now-last});last=now;
   if(time<12)requestAnimationFrame(frame);else resolve({frames,wallSeconds:(performance.now()-first)/1000,simulationTime:u.state.time,backend:u.simulationBackend,mechanism:u.mechanism,reconstructionStatus:u.reconstructionStatus,fog:e.scene.fog,hideGround:u.hideGround});
  }requestAnimationFrame(frame);
 }));
 await page.evaluate(()=>window.review123.dispose());
 if(integrated){
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(baseUrl+'/#/movement/123',{waitUntil:'domcontentloaded'});await page.locator('.simulation-canvas').waitFor({state:'visible',timeout:15000});
  for(const spec of [{name:'catalog-desktop',width:1450,height:1000},{name:'catalog-mobile',width:390,height:844}]){
   await page.setViewportSize(spec);await page.waitForTimeout(200);const file=prefix+'-'+spec.name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file,fullPage:true});views.push({...spec,file,sha256:hashStudyFile(file),inspected:false});
  }
 }
 verifyStudySources(sources);assert.deepEqual(errors,[]);
 fs.writeFileSync(prefix+'.json',JSON.stringify({sources,options,integrated,baseUrl,views,runtime,errors,warnings,qualification:(integrated?'Registered catalog factory. ':'Direct factory. ')+'Source interpretation, finite clearance and dynamics require separate validation.'},null,2)+'\n',{flag:'wx'});
 console.log({views:views.length,errors,runtime:{frames:runtime.frames.length,wallSeconds:runtime.wallSeconds,simulationTime:runtime.simulationTime}});
}finally{await browser.close();}
