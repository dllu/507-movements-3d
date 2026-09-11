import {chromium} from 'playwright';
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const prefix=process.env.CAPTURE_PREFIX??'081-first-candidate',optionsFile=process.env.CANDIDATE_OPTIONS_FILE,
 input=process.env.CAPTURE_INPUT,trajectory=input?JSON.parse(fs.readFileSync(input)):null,
 options={...(trajectory?.geometry??(optionsFile?JSON.parse(fs.readFileSync(optionsFile)).options:{})),...JSON.parse(process.env.CANDIDATE_OPTIONS??'{}')},
 hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),sources=[];
for(const file of ['scripts/capture-spring-rack-candidate.mjs','scripts/lib/spring-rack-candidate.mjs','scripts/lib/spring-rack-source.mjs','scripts/lib/spring-rack-coil.mjs',
 'src/simulation/finite-plate-geometry.js','src/simulation/engine.js','artifacts/reference/brown-081-detail.png',...(optionsFile?[optionsFile]:[]),...(input?[input]:[])]){
 const archive=file.endsWith('.png')?file:`artifacts/review/${prefix}-capture-source-${sources.length}.txt`;
 if(archive!==file)fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hash(file)});
}
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1500,height:800}}),captures=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5174/#/about');
 await page.evaluate(async options=>{
  const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json'),
   {makeSpringRackCandidate}=await import('/scripts/lib/spring-rack-candidate.mjs');
  document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative;min-height:0"></div><img id="source" src="/artifacts/reference/brown-081-detail.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>';
  await document.querySelector('#source').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[80],{playing:false});cancelAnimationFrame(e.animationFrame);e.animationFrame=0;
  e.scene.remove(e.model.root);e.model.root.traverse(x=>{x.geometry?.dispose();if(Array.isArray(x.material))x.material.forEach(m=>m.dispose());else x.material?.dispose();});
  e.model=makeSpringRackCandidate(options);e.scene.add(e.model.root);e.updateGroundClearance();window.springRackCandidate=e;
  const u=e.model.root.userData;for(const light of e.scene.children.filter(x=>x.isDirectionalLight&&x.castShadow)){
   Object.assign(light.shadow.camera,{left:-u.shadowCameraHalfExtent,right:u.shadowCameraHalfExtent,top:u.shadowCameraHalfExtent,bottom:-u.shadowCameraHalfExtent});
   light.shadow.camera.updateProjectionMatrix();light.shadow.bias=u.shadowBias;light.shadow.normalBias=u.shadowNormalBias;
  }
 },options);
 const views=[['source',[0,0,10]],['source-aligned',[0,0,10]],['source-overlay',[0,0,10]],['oblique',[-4,3,10]],['rear',[4,3,-10]],
  ['gear-detail',[-2,2,6],[755,805]],['spring-detail',[-1,2,6],[640,280]],['lower-guide-detail',[-1,2,6],[635,1170]],['upper-guide-detail',[-1,2,6],[640,490]]];
 if(trajectory)for(const [name,time,direction,focus]of [
  ['entry',1.493,[0,0,10]],['entry-overrun',1.52,[0,0,10]],['lift',2,[0,0,10]],['release',2.434,[0,0,10]],
  ['compressed',2.489,[0,0,10]],['return',2.7,[0,0,10]],['dwell',3,[0,0,10]],
  ['compressed-oblique',2.489,[-4,3,10]],['compressed-rear',2.489,[4,3,-10]],['compressed-spring-detail',2.489,[-1,2,6],[640,220]]]){
  const row=trajectory.rows.reduce((best,r)=>Math.abs(r.time-time)<Math.abs(best.time-time)?r:best);
  views.push([name,direction,focus,{time:row.time,q:row.q,rackY:row.x[0]}]);
 }
 for(const [view,direction,focus,state={q:0,rackY:0}]of views){
  await page.evaluate(async({view,direction,focus,state})=>{
   const {Vector3,OrthographicCamera}=await import('/node_modules/three/build/three.module.js'),e=window.springRackCandidate,u=e.model.root.userData,p=u.geometry.source;
   document.querySelector('#overlay')?.remove();u.setState(state);e.fitCamera(new Vector3(...direction));e.renderer.render(e.scene,e.camera);
   if(view==='source-aligned'||view==='source-overlay'){
    const height=1300/p.scale,width=height*726/720,cx=(640-p.center[0])/p.scale,cy=(p.center[1]-650)/p.scale,
     camera=new OrthographicCamera(-width/2,width/2,height/2,-height/2,.01,100);
    camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();e.renderer.render(e.scene,camera);
    if(view==='source-overlay'){
     const image=document.createElement('img');image.id='overlay';image.src='/artifacts/reference/brown-081-detail.png';
     image.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.55;mix-blend-mode:multiply;pointer-events:none';
     document.querySelector('#stage').append(image);await image.decode();
    }
   }else if(focus){
    const target=new Vector3(...u.source(focus),.1);e.camera.position.copy(target).add(new Vector3(...direction));e.camera.lookAt(target);e.camera.near=.005;
    e.camera.fov=view==='gear-detail'?28:view.includes('spring-detail')?32:16;
    e.camera.updateProjectionMatrix();e.camera.updateMatrixWorld();e.renderer.render(e.scene,e.camera);
   }
   document.querySelector('#title').textContent='081 · isolated candidate · '+view+(state.time===undefined?'':' · t='+state.time+' s');
  },{view,direction,focus,state});
  const file=`artifacts/review/${prefix}-${view}.png`;assert(!fs.existsSync(file),file);await page.screenshot({path:file});captures.push({file,view,direction,focus,state,inspected:false,sha256:hash(file)});
 }
 for(const source of sources)assert.equal(hash(source.file),source.sha256,source.file);
 fs.writeFileSync(`artifacts/review/${prefix}-captures.json`,JSON.stringify({movement:81,status:'isolated-spring-rack-geometry-views',productionChanged:false,
  mechanicsPassed:false,options,captures,errors,sources,qualification:'Source and selected loaded poses of an isolated candidate. Continuous clearance, force/energy checks, refinement and timed playback remain pending.'},null,2)+'\n',{flag:'wx'});
 console.log({captures:captures.length,errors});if(errors.length)process.exitCode=1;
}finally{await browser.close();}
