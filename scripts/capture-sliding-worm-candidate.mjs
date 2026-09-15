import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1400,height:850}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/__143_bundle.json',r=>r.fulfill({contentType:'application/json',body:fs.readFileSync('/dev/shm/143-candidate.json','utf8')}));
 await page.route('**/__143_review',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><link rel="icon" href="data:,"><style>body{margin:0;background:#faf8f2}.simulation-canvas{display:block;width:100%;height:100%}</style></head><body><div id="stage" style="width:850px;height:850px;position:relative;display:inline-block"></div><img src="/engravings/mm_143.png" style="width:525px;height:525px;vertical-align:top"></body></html>'}));
 await page.goto('http://127.0.0.1:43966/__143_review');
 const load=await page.evaluate(async()=>{
  const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json'),{makeSlidingWormModel}=await import('/src/simulation/baked/sliding-worm.js');
  const bundle=await(await fetch('/__143_bundle.json')).json(),start=performance.now(),model=makeSlidingWormModel(bundle),parseMs=performance.now()-start;
  const engine=new MovementEngine(document.querySelector('#stage'),catalog.movements[142],{playing:false,model});cancelAnimationFrame(engine.animationFrame);engine.animationFrame=0;window.review143=engine;return {parseMs};
 });
 for(const spec of [{name:'front',direction:[0,0,15]},{name:'source',source:true},{name:'oblique',direction:[4,2,10]},{name:'rear',direction:[-4,2,-10]},{name:'moving',time:4,direction:[0,0,15]}]){
  await page.evaluate(async spec=>{
   const {Vector3,OrthographicCamera}=await import('/node_modules/three/build/three.module.js'),e=window.review143;e.model.update(spec.time??0);e.fitCamera(new Vector3(...(spec.direction??[0,0,15])));let camera=e.camera;
   if(spec.source){camera=new OrthographicCamera(-3.9375,3.9375,3.9375,-3.9375,.01,100);camera.position.set(-.105,1.14375,15);camera.lookAt(-.105,1.14375,0);camera.updateMatrixWorld();}
   e.renderer.render(e.scene,camera);
  },spec);
  await page.screenshot({path:'/dev/shm/143-candidate-'+spec.name+'.png'});
 }
 const playback=await page.evaluate(async()=>{
  const e=window.review143,deltas=[];let last=performance.now();
  for(let i=0;i<90;i++){e.model.update(i*12/90);e.renderer.render(e.scene,e.camera);await new Promise(resolve=>requestAnimationFrame(resolve));const now=performance.now();deltas.push(now-last);last=now;}
  e.model.reset();deltas.sort((a,b)=>a-b);return {frames:90,medianFrameMs:deltas[45],p95FrameMs:deltas[85]};
 });
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(async()=>{const stage=document.querySelector('#stage');stage.style.width='390px';stage.style.height='700px';document.querySelector('img').style.display='none';await new Promise(r=>setTimeout(r,100));const e=window.review143;e.fitCamera(e.cameraFitDirection);e.renderer.render(e.scene,e.camera);});
 await page.screenshot({path:'/dev/shm/143-candidate-mobile.png'});
 await page.evaluate(()=>window.review143.dispose());assert.deepEqual(errors,[]);
 const report={load,playback,errors,assetSha256:createHash('sha256').update(fs.readFileSync('/dev/shm/143-candidate.json.gz')).digest('hex')};
 fs.writeFileSync('/dev/shm/143-candidate-capture.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{await browser.close();}
