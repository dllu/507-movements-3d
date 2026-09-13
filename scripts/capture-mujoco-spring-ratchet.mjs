import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

const file = process.env.PROBE_REPORT;
assert(file, 'Set PROBE_REPORT to a saved dynamics probe');
const report = JSON.parse(fs.readFileSync(file));
for (const [path,hash] of Object.entries(report.sourceHashes))
  assert.equal(createHash('sha256').update(fs.readFileSync(path)).digest('hex'),hash,path+' changed after the probe');
const prefix = process.env.PROBE_PREFIX ?? file.replace(/\.json$/,'-views');
const base = process.env.PROBE_BASE_URL ?? 'http://127.0.0.1:5174';
const browser = await chromium.launch({channel:'chrome',headless:true}), errors = [], views = [];
try {
  const page = await browser.newPage({viewport:{width:1500,height:800}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__study073mujoco',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><link rel="icon" href="data:,"><style>canvas{display:block;width:100%;height:100%}</style></head><body></body></html>'}));
  await page.goto(base+'/__study073mujoco');
  await page.evaluate(async parameters => {
    const {MovementEngine} = await import('/src/simulation/engine.js');
    const {getMujoco} = await import('/src/simulation/mujoco/load.js');
    const {makeMujocoSpringRatchet,THREE} = await import('/scripts/lib/mujoco-spring-ratchet-candidate.mjs');
    const {default:catalog} = await import('/src/data/movements.json');
    document.body.style.margin='0';
    document.body.innerHTML='<main style="padding:16px;background:#f3f0e9"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-073-detail.png" style="width:726px;height:720px;object-fit:contain"></div></main>';
    await document.querySelector('img').decode();
    const model=makeMujocoSpringRatchet(await getMujoco(),parameters),engine=new MovementEngine(document.querySelector('#stage'),catalog.movements[72],{playing:false,model});
    cancelAnimationFrame(engine.animationFrame);window.review073={engine,THREE};
    engine.renderer.domElement.addEventListener('webglcontextlost',()=>{window.lostContext=true;});
  },report.parameters);
  assert(await page.evaluate(()=>document.querySelector('canvas').getBoundingClientRect().width===726));
  for (const spec of [
    {name:'source',time:0},{name:'source-overlay',time:0},{name:'press',time:3.5},
    {name:'drive',time:4},{name:'release',time:4.5},{name:'catch',time:5},{name:'dwell',time:7.5},
    {name:'oblique',time:4,direction:[4,2,10]},{name:'rear',time:4.5,direction:[-4,2,-10]},
  ]) {
    const state = spec.time === 0 ? report.initial : report.rows.reduce((a,b)=>Math.abs(a.time-spec.time)<Math.abs(b.time-spec.time)?a:b);
    await page.evaluate(({spec,state})=>{
      const {engine:e,THREE}=window.review073,u=e.model.root.userData,data=e.model.physics.data;
      document.querySelector('#overlay')?.remove();
      data.qpos.set(state.qpos);data.qvel.set(state.qvel);data.time=state.time;e.model.sync();
      e.fitCamera(new THREE.Vector3(...(spec.direction??[0,0,10])));let camera=e.camera;
      if (spec.name.startsWith('source')) {
        const width=1250/u.source.scale,height=width*720/726,cx=(625-u.source.center[0])/u.source.scale,cy=(u.source.center[1]-585)/u.source.scale;
        camera=new THREE.OrthographicCamera(-width/2,width/2,height/2,-height/2,.01,100);
        camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();
      }
      e.renderer.render(e.scene,camera);
      if (spec.name==='source-overlay') {
        const image=document.createElement('img');image.id='overlay';image.src='/artifacts/reference/brown-073-detail.png';
        image.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';document.querySelector('#stage').append(image);
      }
      document.querySelector('#title').textContent='073 · spatial spring experiment · '+spec.name;
    },{spec,state});
    await page.waitForTimeout(60);assert(!await page.evaluate(()=>window.lostContext));
    const path=prefix+'-'+spec.name+'.png';assert(!fs.existsSync(path));await page.screenshot({path});
    views.push({name:spec.name,time:state.time,path,sha256:createHash('sha256').update(fs.readFileSync(path)).digest('hex')});
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(prefix+'.json',JSON.stringify({input:file,sourceHashes:report.sourceHashes,views,errors,qualification:'Saved dynamic poses of an isolated candidate, without completed supports. Not production acceptance.'},null,2)+'\n',{flag:'wx'});
  console.log({views:views.length,errors});
} finally {await browser.close();}
