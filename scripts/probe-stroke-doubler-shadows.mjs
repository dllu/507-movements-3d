import fs from 'node:fs';
import {chromium} from 'playwright';
import {strokeDoublerStudySources} from './lib/stroke-doubler-study-sources.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/118-shadows';
const sources=freezeStudySources([...strokeDoublerStudySources('scripts/probe-stroke-doubler-shadows.mjs'),'src/simulation/engine.js'],prefix),views=[];
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:1000}});
 await page.route('**/__shadows_118',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><style>.simulation-canvas{display:block;width:100%;height:100%}</style></head><body style="margin:0"><div id="stage" style="width:1000px;height:1000px"></div></body></html>'}));
 await page.goto('http://127.0.0.1:5174/__shadows_118');
 await page.evaluate(async()=>{
  const {MovementEngine}=await import('/src/simulation/engine.js'),{getMujoco}=await import('/src/simulation/mujoco/load.js'),{makeMujocoStrokeDoubler,THREE}=await import('/src/simulation/mujoco-stroke-doubler/visual.js'),{default:catalog}=await import('/src/data/movements.json');
  const model=makeMujocoStrokeDoubler(await getMujoco()),e=new MovementEngine(document.querySelector('#stage'),catalog.movements[117],{model,playing:false});cancelAnimationFrame(e.animationFrame);e.animationFrame=0;model.update(1);
  const camera=new THREE.OrthographicCamera(-.46,.46,.46,-.46,.01,100);camera.position.set(.86,.47,10);camera.lookAt(.86,.47,0);camera.updateMatrixWorld();window.review={e,camera};
 });
 for(const [name,bias,normalBias,enabled]of [['current',-.00002,.003,true],['normal-01',-.00002,.01,true],['bias-0002',-.0002,.003,true],['bias-001',-.001,.003,true],['no-shadows',-.00002,.003,false]]){
  await page.evaluate(({bias,normalBias,enabled})=>{const {e,camera}=window.review;e.renderer.shadowMap.enabled=enabled;for(const l of e.scene.children)if(l.isDirectionalLight&&l.castShadow){l.shadow.bias=bias;l.shadow.normalBias=normalBias;}e.renderer.render(e.scene,camera);},{bias,normalBias,enabled});
  const file=prefix+'-'+name+'.png';await page.screenshot({path:file});views.push({name,bias,normalBias,enabled,file,sha256:hashStudyFile(file)});
 }
 await page.evaluate(()=>window.review.e.dispose());verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,views,qualification:'Render-only shadow comparison at the same native pose. These screenshots are diagnostic, not catalog qualification.'},null,2)+'\n',{flag:'wx'});
}finally{await browser.close();}
