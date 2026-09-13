import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const prefix=process.env.PROBE_PREFIX??'/dev/shm/083-mujoco-candidate',base=process.env.PROBE_BASE_URL??'http://127.0.0.1:5174';
const browser=await chromium.launch({channel:'chrome',headless:true}),views=[],errors=[];
try{
  const page=await browser.newPage({viewport:{width:1500,height:800}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/__study083mujoco',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><link rel="icon" href="data:,"><style>canvas{display:block;width:100%;height:100%}</style></head><body></body></html>'}));
  await page.goto(base+'/__study083mujoco');
  await page.evaluate(async()=>{
    const {MovementEngine}=await import('/src/simulation/engine.js');
    const {loadMovementModel}=await import('/src/simulation/model-loader.js');
    const {THREE}=await import('/src/simulation/mujoco-spring-sector/visual.js');
    const {default:catalog}=await import('/src/data/movements.json');
    document.body.style.margin='0';
    document.body.innerHTML='<main style="padding:16px;background:#f3f0e9"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-083-detail.png" style="width:726px;height:720px;object-fit:contain"></div></main>';
    await document.querySelector('img').decode();
    const model=await loadMovementModel(catalog.movements[82]),engine=new MovementEngine(document.querySelector('#stage'),catalog.movements[82],{playing:false,model});
    cancelAnimationFrame(engine.animationFrame);
    engine.renderer.domElement.addEventListener('webglcontextlost',()=>{window.lostContext=true;});
    window.review083={engine,THREE};
  });
  assert(await page.evaluate(() => {
    const canvas = document.querySelector('canvas').getBoundingClientRect(), stage = document.querySelector('#stage').getBoundingClientRect();
    return Math.abs(canvas.width - stage.width) < 1 && Math.abs(canvas.height - stage.height) < 1;
  }), 'capture canvas must fit its CSS stage');
  for(const spec of [
    {name:'source',time:0},{name:'source-overlay',time:0},{name:'front',time:0},
    {name:'quarter',time:1},{name:'half',time:2},{name:'return',time:3},{name:'cycle',time:4},
    {name:'oblique',time:1,direction:[4,3,10]},{name:'rear',time:3,direction:[-4,3,-10]},
    {name:'sector-guides',time:1,detail:'frontGuideFrame',direction:[1,0,-1],half:.6},
    {name:'input-pin',time:2,detail:'inputForkFront',direction:[-2,1,4],half:.65},
    {name:'crown-contact',time:1,detail:'frontSector',direction:[2,1,5],half:1.1,offset:[0,-2.1,0]},
  ]){
    const state=await page.evaluate(spec=>{
      const {engine:e,THREE:{Vector3,OrthographicCamera}}=window.review083,u=e.model.root.userData;
      document.querySelector('#overlay')?.remove();e.model.update(spec.time);e.updateGroundClearance();
      e.fitCamera(new Vector3(...(spec.direction??[0,0,10])));let camera=e.camera;
      if(spec.name.startsWith('source')){
        const h=1250/u.source.scale,w=h*726/720,cx=(560-u.source.center[0])/u.source.scale,cy=(u.source.center[1]-625)/u.source.scale;
        camera=new OrthographicCamera(-w/2,w/2,h/2,-h/2,.01,100);camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();
      }
      if(spec.detail){
        const target=u.parts[spec.detail].getWorldPosition(new Vector3()).add(new Vector3(...(spec.offset??[0,0,0])));
        camera=new OrthographicCamera(-spec.half,spec.half,spec.half*720/726,-spec.half*720/726,.01,100);
        camera.position.copy(target).add(new Vector3(...spec.direction));camera.lookAt(target);camera.updateMatrixWorld();
      }
      e.renderer.render(e.scene,camera);
      if(spec.name==='source-overlay'){
        const image=document.createElement('img');image.id='overlay';image.src='/artifacts/reference/brown-083-detail.png';
        image.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';document.querySelector('#stage').append(image);
      }
      document.querySelector('#title').textContent='083 · MuJoCo · '+spec.name;
      return u.state;
    },spec);
    await page.waitForTimeout(60);assert(!await page.evaluate(()=>window.lostContext));
    const file=prefix+'-'+spec.name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file});views.push({...spec,state,file});
  }
  const runtime=await page.evaluate(()=>new Promise(resolve=>{
    const {engine:e}=window.review083;document.querySelector('#overlay')?.remove();e.fitCamera(e.model.cameraDirection);e.restart();e.setPlaying(true);
    let first,last;const frames=[];
    const frame=now=>{first??=now;const dt=last===undefined?0:(now-last)/1000;last=now;const start=performance.now();e.advance(Math.min(dt,.05));
      const updateMs=performance.now()-start;e.renderer.render(e.scene,e.camera);frames.push({wall:(now-first)/1000,physical:e.model.physics.data.time,updateMs});
      if(now-first<8200)requestAnimationFrame(frame);else resolve({frames,fog:e.scene.fog,groundVisible:e.ground.visible});};requestAnimationFrame(frame);
  }));
  await page.evaluate(()=>window.review083.engine.dispose());assert.deepEqual(errors,[]);
  fs.writeFileSync(prefix+'.json',JSON.stringify({views,runtime,errors,passed:true})+'\n',{flag:'wx'});console.log({views:views.length,frames:runtime.frames.length,final:runtime.frames.at(-1),errors});
}finally{await browser.close();}
