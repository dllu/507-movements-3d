import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'/dev/shm/104-baseline';
const sources=freezeStudySources(['scripts/capture-worm-saddle-baseline.mjs','src/simulation/authored-screws.js',
  'src/simulation/engine.js','src/simulation/model-loader.js','src/simulation/primitives.js',
  'src/simulation/registry.js','src/data/movements.json','public/engravings/mm_104.png'],prefix);
const browser=await chromium.launch({channel:'chrome',headless:true}),views=[],errors=[];
try {
  const page=await browser.newPage({viewport:{width:1450,height:760}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/__review_104',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><link rel="icon" href="data:,"><style>body{margin:0}.simulation-canvas{display:block;width:100%;height:100%}</style></head><body></body></html>'}));
  await page.goto('http://127.0.0.1:5174/__review_104',{waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>{
    const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json');
    document.body.innerHTML='<main style="padding:16px;background:#faf8f2"><div id="title" style="font:20px system-ui;height:32px"></div><div style="display:flex;gap:16px"><div id="stage" style="width:700px;height:700px;position:relative"></div><img src="/engravings/mm_104.png" style="width:700px;height:700px;object-fit:contain"></div></main>';
    await document.querySelector('img').decode();
    const {createMovementModel}=await import('/src/simulation/registry.js');
    const movement=catalog.movements[103];
    const e=new MovementEngine(document.querySelector('#stage'),movement,{playing:false,model:createMovementModel(movement)});
    cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.review104=e;
  });
  for(const [name,time,direction] of [['front',0,[0,0,10]],['worm-driven',5,[0,0,10]],['slide-travel',10,[0,0,10]],['oblique',2,[3,2,8]],['rear',12,[-3,2,-8]]]) {
    const state=await page.evaluate(({name,time,direction})=>{
      const e=window.review104;e.model.update(time);e.fitCamera(new e.camera.position.constructor(...direction));e.renderer.render(e.scene,e.camera);
      document.querySelector('#title').textContent='104 · existing baseline · '+name;return e.model.root.userData.kinematics;
    },{name,time,direction});
    const file=prefix+'-'+name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file});
    views.push({name,time,direction,state,file,sha256:hashStudyFile(file),inspected:false});
  }
  await page.evaluate(()=>window.review104.dispose());verifyStudySources(sources);assert.deepEqual(errors,[]);
  fs.writeFileSync(prefix+'.json',JSON.stringify({sources,views,errors,mechanicallyQualified:false},null,2)+'\n',{flag:'wx'});
  console.log({views:views.length,errors});
}finally{await browser.close();}
