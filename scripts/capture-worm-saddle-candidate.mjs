import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
import {saddleWheelCut} from '../src/simulation/mujoco-worm-saddle/wheel-data.js';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/104-candidate',hob=process.env.HOB_FILE??'src/simulation/mujoco-worm-saddle/wheel-data.js';
const paths=['src/simulation/mujoco-worm-saddle','src/simulation/mujoco'].flatMap(dir=>fs.readdirSync(dir).filter(n=>n.endsWith('.js')).map(n=>dir+'/'+n));
paths.push('scripts/capture-worm-saddle-candidate.mjs','src/simulation/worm-gear-geometry.js','src/simulation/finite-plate-geometry.js',
  'src/simulation/clutch-section-geometry.js','src/simulation/primitives.js','src/simulation/engine.js','public/engravings/mm_104.png',hob);
const sources=freezeStudySources(paths,prefix),browser=await chromium.launch({channel:'chrome',headless:true}),views=[],errors=[];
try {
  const page=await browser.newPage({viewport:{width:1450,height:760}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__104_hob.json',r=>r.fulfill({contentType:'application/json',body:process.env.HOB_FILE?fs.readFileSync(hob,'utf8'):JSON.stringify(saddleWheelCut)}));
  await page.route('**/__review_104',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><link rel="icon" href="data:,"><style>body{margin:0}.simulation-canvas{display:block;width:100%;height:100%}</style></head><body></body></html>'}));
  await page.goto('http://127.0.0.1:5174/__review_104',{waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>{
    const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json');
    const {makeWormSaddleGeometry}=await import('/src/simulation/mujoco-worm-saddle/geometry.js');
    const cut=await (await fetch('/__104_hob.json')).json();
    document.body.innerHTML='<main style="padding:16px;background:#faf8f2"><div id="title" style="font:20px system-ui;height:32px"></div><div style="display:flex;gap:16px"><div id="stage" style="width:700px;height:700px;position:relative"></div><img src="/engravings/mm_104.png" style="width:700px;height:700px;object-fit:contain"></div></main>';
    await document.querySelector('img').decode();
    const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[103],{playing:false,model:{...makeWormSaddleGeometry(cut),update:()=>{}}});
    cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.review104=e;
  });
  for(const spec of [
    {name:'source-front'},{name:'source-overlay'},{name:'front'},
    {name:'oblique',direction:[3,2,8]},{name:'rear',direction:[-3,2,-8]},
    {name:'mesh',detail:'mesh',direction:[2,1,-8]},{name:'shaft',detail:'shaft',direction:[3,2,8]},
    {name:'guide',detail:'guide',direction:[4,-1,8]},
  ]) {
    await page.evaluate(async spec=>{
      const {THREE:{Vector3,OrthographicCamera}}=await import('/src/simulation/mujoco-worm-saddle/visual.js');
      const e=window.review104,f=e.model.root.userData.profile;document.querySelector('#overlay')?.remove();
      e.fitCamera(new Vector3(...(spec.direction??[0,0,10])));let camera=e.camera;
      if(spec.name.startsWith('source-')){const half=525/200,x=(525/2-f.axis[0])/100,y=(f.axis[1]-525/2)/100;
        camera=new OrthographicCamera(-half,half,half,-half,.01,100);camera.position.set(x,y,10);camera.lookAt(x,y,0);camera.updateMatrixWorld();}
      if(spec.detail){const center=new Vector3(0,spec.detail==='mesh'?.86:spec.detail==='guide'?-1.15:0,spec.detail==='shaft'?.25:0),half=spec.detail==='guide'?.7:.4;
        camera=new OrthographicCamera(-half,half,half,-half,.01,100);camera.position.copy(center).add(new Vector3(...spec.direction));camera.lookAt(center);camera.updateMatrixWorld();}
      e.renderer.render(e.scene,camera);
      if(spec.name==='source-overlay'){const img=document.createElement('img');img.id='overlay';img.src='/engravings/mm_104.png';img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';document.querySelector('#stage').append(img);await img.decode();}
      document.querySelector('#title').textContent='104 · candidate geometry · '+spec.name;
    },spec);
    const file=prefix+'-'+spec.name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file});views.push({...spec,file,sha256:hashStudyFile(file),inspected:false});
  }
  await page.evaluate(()=>window.review104.dispose());verifyStudySources(sources);assert.deepEqual(errors,[]);
  fs.writeFileSync(prefix+'.json',JSON.stringify({sources,views,errors,mechanicallyQualified:false},null,2)+'\n',{flag:'wx'});console.log({views:views.length,errors});
}finally{await browser.close();}
