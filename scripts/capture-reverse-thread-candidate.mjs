import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? '/dev/shm/108-views';
const paths = ['src/simulation/mujoco-reverse-thread','src/simulation/mujoco']
  .flatMap(dir=>fs.readdirSync(dir).filter(n=>n.endsWith('.js')).map(n=>dir+'/'+n));
paths.push('scripts/capture-reverse-thread-candidate.mjs','scripts/lib/study-report-io.mjs',
  'src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js',
  'src/simulation/engine.js','src/simulation/model-loader.js',
  'src/simulation/dispose-model.js','src/simulation/primitives.js','public/engravings/mm_108.png','package-lock.json',
  'tests/e2e/mujoco.spec.mjs','src/main.js','src/styles.css','src/data/movements.json','scripts/measure-reverse-thread-source.mjs','src/simulation/coaxial-gear-geometry.js');
const options=JSON.parse(process.env.SIM_OPTIONS??'{}'),period=options.period??10;
const sources = freezeStudySources(paths,prefix), errors = [], warnings = [], views = [];
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page = await browser.newPage({viewport:{width:1450,height:760}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text());});
  await page.route('**/__review_108',r=>r.fulfill({contentType:'text/html',body:
    '<!doctype html><html><head><link rel="icon" href="data:,"><style>body{margin:0}.simulation-canvas{display:block;width:100%;height:100%}</style></head><body></body></html>'}));
  await page.goto('http://127.0.0.1:5174/__review_108',{waitUntil:'domcontentloaded'});
  await page.evaluate(async options=>{
    const {MovementEngine}=await import('/src/simulation/engine.js');
    const {default:catalog}=await import('/src/data/movements.json');
    document.body.innerHTML='<main style="padding:16px;background:#faf8f2"><div id="title" style="font:20px system-ui;height:32px"></div><div style="display:flex;gap:16px"><div id="stage" style="width:700px;height:700px;position:relative"></div><img src="/engravings/mm_108.png" style="width:700px;height:700px;object-fit:contain"></div></main>';
    await document.querySelector('img').decode();
    const {getMujoco}=await import('/src/simulation/mujoco/load.js');
    const {makeMujocoReverseThread}=await import('/src/simulation/mujoco-reverse-thread/visual.js');
    const model=makeMujocoReverseThread(await getMujoco(),options);
    const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[107],{playing:false,model});
    cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.review108=e;
  },options);
  for(const spec of [
    {name:'source-front',time:0},{name:'source-overlay',time:0},{name:'front',time:0},
    {name:'lower',time:2.25},{name:'upper',time:7.25},{name:'quarter',time:2.5},{name:'half',time:5},
    {name:'oblique',time:.5,direction:[3,2,8]},{name:'rear',time:2.5,direction:[-3,2,-8]},
    {name:'groove',time:1,detail:'groove',direction:[2,1,8]},
    {name:'follower',time:0,detail:'follower',direction:[2,2,8]},
    {name:'guide',time:1.416666667,detail:'guide',direction:[2,1,8]},
    {name:'joint',time:0,detail:'joint',direction:[2,1,8]},
  ].map(spec=>({...spec,time:spec.time*period/10}))) {
    const state=await page.evaluate(async spec=>{
      const {THREE:{Vector3,OrthographicCamera}}=await import('/src/simulation/mujoco-reverse-thread/visual.js');
      const e=window.review108,u=e.model.root.userData;
      document.querySelector('#overlay')?.remove();e.model.update(spec.time);
      e.fitCamera(new Vector3(...(spec.direction??[0,0,10])));let camera=e.camera;
      if(spec.name.startsWith('source-')) {
        const half=525/200,x=(525/2-u.profile.axis[0])/100,y=(u.profile.axis[1]-525/2)/100;
        camera=new OrthographicCamera(-half,half,half,-half,.01,100);
        camera.position.set(x,y,10);camera.lookAt(x,y,0);camera.updateMatrixWorld();
      }
      if(spec.detail) {
        const f=u.profile;
        const center=spec.detail==='groove'?new Vector3(0,0,f.radius):spec.detail==='follower'?new Vector3(-f.radius,f.initialY+u.state.qpos[1],0):spec.detail==='guide'?new Vector3(f.guideX,f.initialY+u.state.qpos[1],0):new Vector3(-f.radius-.06,f.initialY+u.state.qpos[1],0);
        const half=spec.detail==='groove'?.5:spec.detail==='follower'?.5:spec.detail==='guide'?.4:.25;
        camera=new OrthographicCamera(-half,half,half,-half,.01,100);
        camera.position.copy(center).add(new Vector3(...(spec.direction??[3,1,8])));camera.lookAt(center);camera.updateMatrixWorld();
      }
      e.renderer.render(e.scene,camera);
      if(spec.name==='source-overlay') {
        const img=document.createElement('img');img.id='overlay';img.src='/engravings/mm_108.png';
        img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';
        document.querySelector('#stage').append(img);await img.decode();
      }
      document.querySelector('#title').textContent='108 · '+spec.name;
      return {...u.state,inputErrorRadians:u.state.qpos[0]-u.physics.description.omega*u.state.time,errorPixels:100*(u.state.qpos[1]-(u.profile.law(u.profile.initialParameter-u.state.qpos[0]).y-u.profile.initialY))};
    },spec);
    const file=prefix+'-'+spec.name+'.png';assert(!fs.existsSync(file));
    await page.screenshot({path:file});views.push({...spec,state,file,sha256:hashStudyFile(file),inspected:false});
  }
  const runtime=await page.evaluate(()=>new Promise(resolve=>{
    const e=window.review108,frames=[];let first,last;
    e.model.reset();e.elapsed=0;e.playbackEnded=false;e.playing=true;e.fitCamera(e.model.cameraDirection);
    function frame(now) {
      first??=now;const time=(now-first)/1000,start=performance.now();
      e.advance(Math.min(last===undefined?0:(now-last)/1000,.05));const updateMs=performance.now()-start;
      const u=e.model.root.userData;
      e.renderer.render(e.scene,e.camera);frames.push({time,simulationTime:u.state.time,updateMs,intervalMs:last===undefined?0:now-last,inputErrorRadians:u.state.qpos[0]-u.physics.description.omega*u.state.time,errorPixels:100*(u.state.qpos[1]-(u.profile.law(u.profile.initialParameter-u.state.qpos[0]).y-u.profile.initialY))});last=now;
      if(time<8.2)requestAnimationFrame(frame);
      else resolve({frames,wallSeconds:(performance.now()-first)/1000,simulationTime:e.model.root.userData.state.time,timeScale:e.playbackTimeScale,fog:e.scene.fog,hideGround:e.model.root.userData.hideGround,
        backend:e.model.root.userData.simulationBackend,state:e.model.root.userData.state});
    }requestAnimationFrame(frame);
  }));
  await page.evaluate(()=>window.review108.dispose());
  const known=[/^THREE.Clock: This module has been deprecated\./,/^THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated\./,/^\[.WebGL-.*GPU stall due to ReadPixels/];
  const unexpectedWarnings=warnings.filter(w=>!known.some(r=>r.test(w)));
  verifyStudySources(sources);
  const maximumInputErrorRadians=Math.max(...views.map(v=>Math.abs(v.state.inputErrorRadians)),...runtime.frames.map(v=>Math.abs(v.inputErrorRadians)));
  const maximumTravelErrorPixels=Math.max(...views.map(v=>Math.abs(v.state.errorPixels)),...runtime.frames.map(v=>Math.abs(v.errorPixels)));
  const passed=maximumTravelErrorPixels<1&&maximumInputErrorRadians<.01&&!errors.length&&!unexpectedWarnings.length&&runtime.backend==='mujoco';
  fs.writeFileSync(prefix+'.json',JSON.stringify({sources,options,qualification:'Candidate playback checks only; contact penetration, load robustness and real-time performance require separate qualification.',maximumTravelErrorPixels,maximumInputErrorRadians,views,runtime,errors,warnings,unexpectedWarnings,passed},null,2)+'\n',{flag:'wx'});
  console.log({passed,maximumTravelErrorPixels,maximumInputErrorRadians,views:views.length,frames:runtime.frames.length,errors,unexpectedWarnings});assert(passed);
} finally {await browser.close();}
