import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? '/dev/shm/104-views';
const paths = ['src/simulation/mujoco-worm-saddle','src/simulation/mujoco']
  .flatMap(dir=>fs.readdirSync(dir).filter(n=>n.endsWith('.js')).map(n=>dir+'/'+n));
paths.push('scripts/capture-mujoco-worm-saddle.mjs','scripts/lib/study-report-io.mjs',
  'src/simulation/worm-gear-geometry.js','src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js',
  'src/simulation/engine.js','src/simulation/model-loader.js',
  'src/simulation/dispose-model.js','src/simulation/primitives.js','public/engravings/mm_104.png','package-lock.json',
  'src/main.js','src/styles.css','src/data/movements.json','scripts/measure-worm-saddle-source.mjs','tests/mujoco-worm-saddle.test.mjs');
const sources = freezeStudySources(paths,prefix), errors = [], warnings = [], views = [];
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page = await browser.newPage({viewport:{width:1450,height:760}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text());});
  await page.route('**/__review_104',r=>r.fulfill({contentType:'text/html',body:
    '<!doctype html><html><head><link rel="icon" href="data:,"><style>body{margin:0}.simulation-canvas{display:block;width:100%;height:100%}</style></head><body></body></html>'}));
  await page.goto('http://127.0.0.1:5174/__review_104',{waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>{
    const {MovementEngine}=await import('/src/simulation/engine.js');
    const {default:catalog}=await import('/src/data/movements.json');
    document.body.innerHTML='<main style="padding:16px;background:#faf8f2"><div id="title" style="font:20px system-ui;height:32px"></div><div style="display:flex;gap:16px"><div id="stage" style="width:700px;height:700px;position:relative"></div><img src="/engravings/mm_104.png" style="width:700px;height:700px;object-fit:contain"></div></main>';
    await document.querySelector('img').decode();
    const e=await MovementEngine.create(document.querySelector('#stage'),catalog.movements[103],{playing:false});
    cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.review104=e;
  });
  for(const spec of [
    {name:'source-front',time:0},{name:'source-overlay',time:0},{name:'front',time:0},
    {name:'worm-half',time:2},{name:'worm-limit',time:4},{name:'worm-return',time:6},
    {name:'wheel-half',time:2,mode:'wheel'},{name:'wheel-limit',time:4,mode:'wheel'},{name:'wheel-return',time:6,mode:'wheel'},
    {name:'oblique',time:1,direction:[3,2,8]},{name:'rear',time:3,direction:[-3,2,-8]},
    {name:'mesh',time:2,detail:'mesh',direction:[2,1,-8]},
    {name:'shaft',time:0,detail:'shaft',direction:[3,2,8]},
    {name:'guide',time:4,mode:'wheel',detail:'guide',direction:[4,-1,8]},
  ]) {
    const state=await page.evaluate(async spec=>{
      const {THREE:{Vector3,OrthographicCamera}}=await import('/src/simulation/mujoco-worm-saddle/visual.js');
      const e=window.review104,u=e.model.root.userData;
      document.querySelector('#overlay')?.remove();if(u.configuration!==(spec.mode??'worm'))u.setConfiguration(spec.mode??'worm');e.model.update(spec.time);
      e.fitCamera(new Vector3(...(spec.direction??[0,0,10])));let camera=e.camera;
      if(spec.name.startsWith('source-')) {
        const half=525/200,x=(525/2-u.profile.axis[0])/100,y=(u.profile.axis[1]-525/2)/100;
        camera=new OrthographicCamera(-half,half,half,-half,.01,100);
        camera.position.set(x,y,10);camera.lookAt(x,y,0);camera.updateMatrixWorld();
      }
      if(spec.detail) {
        const f=u.profile;
        const center=new Vector3(u.state.qpos[1],spec.detail==='mesh'?.86:spec.detail==='guide'?-1.15:0,spec.detail==='shaft'?.25:0);
        const half=spec.detail==='guide'?.7:.4;
        camera=new OrthographicCamera(-half,half,half,-half,.01,100);
        camera.position.copy(center).add(new Vector3(...(spec.direction??[3,1,8])));camera.lookAt(center);camera.updateMatrixWorld();
      }
      e.renderer.render(e.scene,camera);
      if(spec.name==='source-overlay') {
        const img=document.createElement('img');img.id='overlay';img.src='/engravings/mm_104.png';
        img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';
        document.querySelector('#stage').append(img);await img.decode();
      }
      document.querySelector('#title').textContent='104 · '+spec.name;
      return u.state;
    },spec);
    const file=prefix+'-'+spec.name+'.png';assert(!fs.existsSync(file));
    await page.screenshot({path:file});views.push({...spec,state,file,sha256:hashStudyFile(file),inspected:false});
  }
  const runtime=await page.evaluate(()=>new Promise(resolve=>{
    const e=window.review104,frames=[];let first,last;
    e.model.reset();e.model.root.userData.setConfiguration('worm');e.fitCamera(e.model.cameraDirection);
    function frame(now) {
      first??=now;const time=(now-first)/1000,start=performance.now();
      e.model.update(time);const updateMs=performance.now()-start;
      e.renderer.render(e.scene,e.camera);frames.push({time,updateMs,intervalMs:last===undefined?0:now-last});last=now;
      if(time<8.2)requestAnimationFrame(frame);
      else resolve({frames,wallSeconds:(now-first)/1000,timeScale:e.playbackTimeScale,fog:e.scene.fog,hideGround:e.model.root.userData.hideGround,
        backend:e.model.root.userData.simulationBackend,state:e.model.root.userData.state});
    }requestAnimationFrame(frame);
  }));
  await page.evaluate(()=>window.review104.dispose());
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:5174/?review=104#/movement/104',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Play',exact:true}).waitFor();
  await page.getByRole('button',{name:'Restart',exact:true}).waitFor();
  for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]) {
    await page.setViewportSize(viewport);await page.getByRole('button',{name:'Reset view',exact:true}).click();
    await page.waitForTimeout(200);const file=prefix+'-'+name+'.png';assert(!fs.existsSync(file));
    await page.screenshot({path:file,fullPage:true});views.push({name,file,sha256:hashStudyFile(file),inspected:false});
  }
  const note=page.getByText('Choose the screw or wheel as input. An ideal gear coupling drives the wheel or slide through matching tooth geometry. Backlash and tooth friction are omitted. Tooth count, bearings, guide, depths and reversing drive are reconstructed.',{exact:true});
  await note.evaluate(el=>el.scrollIntoView({block:'center'}));
  await page.evaluate(()=>window.scrollTo(0,0));
  assert(await note.evaluate(el=>{const a=el.getBoundingClientRect(),b=el.closest('.movement-notes').getBoundingClientRect();return a.top>=b.top&&a.bottom<=b.bottom;}));
  const noteFile=prefix+'-mobile-notes.png';assert(!fs.existsSync(noteFile));
  await page.screenshot({path:noteFile,fullPage:true});views.push({name:'mobile-notes',file:noteFile,sha256:hashStudyFile(noteFile),inspected:false});
  const known=[/^THREE.Clock: This module has been deprecated\./,/^THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated\./,/^\[.WebGL-.*GPU stall due to ReadPixels/];
  const unexpectedWarnings=warnings.filter(w=>!known.some(r=>r.test(w)));
  verifyStudySources(sources);
  const passed=!errors.length&&!unexpectedWarnings.length&&runtime.backend==='mujoco';
  fs.writeFileSync(prefix+'.json',JSON.stringify({sources,views,runtime,errors,warnings,unexpectedWarnings,passed},null,2)+'\n',{flag:'wx'});
  console.log({passed,views:views.length,frames:runtime.frames.length,errors,unexpectedWarnings});assert(passed);
} finally {await browser.close();}
