import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? '/dev/shm/098-views';
const paths = ['src/simulation/mujoco-endless-groove','src/simulation/mujoco']
  .flatMap(dir=>fs.readdirSync(dir).filter(n=>n.endsWith('.js')).map(n=>dir+'/'+n));
paths.push('scripts/capture-mujoco-endless-groove.mjs','scripts/lib/study-report-io.mjs',
  'src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js',
  'src/simulation/engine.js','src/simulation/model-loader.js',
  'src/simulation/dispose-model.js','src/simulation/primitives.js','public/engravings/mm_098.png','package-lock.json',
  'src/main.js','src/styles.css','tests/mujoco-endless-groove.test.mjs','scripts/measure-endless-groove-source.mjs');
const sources = freezeStudySources(paths,prefix), errors = [], warnings = [], views = [];
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page = await browser.newPage({viewport:{width:1450,height:760}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text());});
  await page.route('**/__review_098',r=>r.fulfill({contentType:'text/html',body:
    '<!doctype html><html><head><link rel="icon" href="data:,"><style>body{margin:0}.simulation-canvas{display:block;width:100%;height:100%}</style></head><body></body></html>'}));
  await page.goto('http://127.0.0.1:5174/__review_098',{waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>{
    const {MovementEngine}=await import('/src/simulation/engine.js');
    const {default:catalog}=await import('/src/data/movements.json');
    document.body.innerHTML='<main style="padding:16px;background:#faf8f2"><div id="title" style="font:20px system-ui;height:32px"></div><div style="display:flex;gap:16px"><div id="stage" style="width:700px;height:700px;position:relative"></div><img src="/engravings/mm_098.png" style="width:700px;height:700px;object-fit:contain"></div></main>';
    await document.querySelector('img').decode();
    const e=await MovementEngine.create(document.querySelector('#stage'),catalog.movements[97],{playing:false});
    cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.review098=e;
  });
  for(const spec of [
    {name:'source-front',time:0},{name:'source-overlay',time:0},{name:'source-full',time:0,section:false},{name:'front',time:0},
    {name:'quarter',time:1},{name:'outer',time:2},{name:'return',time:3},
    {name:'oblique',time:.5,direction:[3,2,8]},{name:'rear',time:2,direction:[-3,2,-8],section:false},
    {name:'pin',time:1,detail:'pin',direction:[1,-4,8]},{name:'pivot',time:0,detail:'pivot'},
    {name:'pin-side',time:1,detail:'pin',direction:[5,-6,2]},
    {name:'covered-pin-side',time:1,detail:'pin',direction:[5,-6,2],section:false},
  ]) {
    const state=await page.evaluate(async spec=>{
      const {THREE:{Vector3,OrthographicCamera}}=await import('/src/simulation/mujoco-endless-groove/visual.js');
      const e=window.review098,u=e.model.root.userData;
      document.querySelector('#overlay')?.remove();e.model.update(spec.time);u.setSectionView(spec.section??true);
      e.fitCamera(new Vector3(...(spec.direction??[0,0,10])));let camera=e.camera;
      if(spec.name.startsWith('source-')) {
        const half=525/200,x=(525/2-u.source.axis[0])/100,y=(u.source.axis[1]-525/2)/100;
        camera=new OrthographicCamera(-half,half,half,-half,.01,100);
        camera.position.set(x,y,10);camera.lookAt(x,y,0);camera.updateMatrixWorld();
      }
      if(spec.detail) {
        const center=spec.detail==='pin'?new Vector3(u.profile.crankRadius,0,0).applyMatrix4(u.blocks.input.matrixWorld):new Vector3(...u.profile.pivot,0);
        const half=spec.detail==='pin'?.42:.48;
        camera=new OrthographicCamera(-half,half,half,-half,.01,100);
        camera.position.copy(center).add(new Vector3(...(spec.direction??[3,1,8])));camera.lookAt(center);camera.updateMatrixWorld();
      }
      e.renderer.render(e.scene,camera);
      if(spec.name==='source-overlay') {
        const img=document.createElement('img');img.id='overlay';img.src='/engravings/mm_098.png';
        img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';
        document.querySelector('#stage').append(img);await img.decode();
      }
      document.querySelector('#title').textContent='098 · '+spec.name;
      return u.state;
    },spec);
    const file=prefix+'-'+spec.name+'.png';assert(!fs.existsSync(file));
    await page.screenshot({path:file});views.push({...spec,state,file,sha256:hashStudyFile(file),inspected:false});
  }
  const runtime=await page.evaluate(()=>new Promise(resolve=>{
    const e=window.review098,frames=[];let first,last;
    e.model.reset();e.model.root.userData.setSectionView(true);e.fitCamera(e.model.cameraDirection);
    function frame(now) {
      first??=now;const time=(now-first)/1000,start=performance.now();
      e.model.update(time);const updateMs=performance.now()-start;
      e.renderer.render(e.scene,e.camera);frames.push({time,updateMs,intervalMs:last===undefined?0:now-last});last=now;
      if(time<16.2)requestAnimationFrame(frame);
      else resolve({frames,timeScale:e.playbackTimeScale,fog:e.scene.fog,hideGround:e.model.root.userData.hideGround,
        backend:e.model.root.userData.simulationBackend,state:e.model.root.userData.state});
    }requestAnimationFrame(frame);
  }));
  await page.evaluate(()=>window.review098.dispose());
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:5174/?review=098#/movement/098',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Play',exact:true}).waitFor();
  await page.getByRole('button',{name:'Restart',exact:true}).waitFor();
  for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]) {
    await page.setViewportSize(viewport);await page.getByRole('button',{name:'Reset view',exact:true}).click();
    await page.waitForTimeout(200);const file=prefix+'-'+name+'.png';assert(!fs.existsSync(file));
    await page.screenshot({path:file,fullPage:true});views.push({name,file,sha256:hashStudyFile(file),inspected:false});
  }
  const note=page.getByText('Section view removes the arm’s front cover to reveal its rear groove. With the drawn crank radius, the pin reverses along one side of the loop. The larger working pin, bearing support and hidden depths are reconstructed.',{exact:true});
  await note.evaluate(el=>el.scrollIntoView({block:'center'}));
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
