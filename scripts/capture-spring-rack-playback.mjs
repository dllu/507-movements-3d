import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const prefix=process.env.CAPTURE_PREFIX??'081-seamed-playback-preview',input=process.env.CAPTURE_INPUT??'artifacts/review/081-seamed-playback-data.json',data=JSON.parse(fs.readFileSync(input)),
 hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),sources=[];
for(const file of ['scripts/capture-spring-rack-playback.mjs','scripts/lib/spring-rack-playback-study.mjs','scripts/lib/spring-rack-contact-study.mjs',
 'scripts/lib/spring-rack-candidate.mjs','scripts/lib/spring-rack-coil.mjs','scripts/lib/spring-rack-source.mjs','src/simulation/engine.js',input]){
 const archive=`artifacts/review/${prefix}-source-${sources.length}.txt`;fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hash(file)});
}
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1500,height:800}}),errors=[],views=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5174/#/about');
 await page.evaluate(async data=>{
  const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json'),
   {makeSpringRackCandidate}=await import('/scripts/lib/spring-rack-candidate.mjs'),{makeSpringRackPlayback}=await import('/scripts/lib/spring-rack-playback-study.mjs'),
   {Box3,Vector3}=await import('/node_modules/three/build/three.module.js');
  document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-081-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
  await document.querySelector('img').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[80],{playing:false});cancelAnimationFrame(e.animationFrame);e.animationFrame=0;
  e.scene.remove(e.model.root);e.model.root.traverse(x=>{x.geometry?.dispose();if(Array.isArray(x.material))x.material.forEach(m=>m.dispose());else x.material?.dispose();});
  e.model=makeSpringRackCandidate(data.geometry);e.scene.add(e.model.root);const u=e.model.root.userData,motion=makeSpringRackPlayback(e.model,data),bounds=new Box3();
  for(const rackY of [data.range[0],0,data.range[1]]){u.setState({rackY});bounds.union(new Box3().setFromObject(e.model.root,true));}
  const R=u.geometry.outerRadius+1e-6;bounds.union(new Box3(new Vector3(-R,-R,-.135),new Vector3(R,R,.165)));
  u.sampledMotionBounds={min:bounds.min.toArray(),max:bounds.max.toArray()};u.setState();e.fitCamera(new Vector3(0,0,10));e.updateGroundClearance();
  for(const light of e.scene.children.filter(x=>x.isDirectionalLight&&x.castShadow)){
   Object.assign(light.shadow.camera,{left:-6,right:6,top:6,bottom:-6});light.shadow.camera.updateProjectionMatrix();light.shadow.bias=-.00003;light.shadow.normalBias=.003;
  }
  window.springRackPlayback={engine:e,motion,bounds:u.sampledMotionBounds};
 },data);
 const timing=await page.evaluate(()=>new Promise(resolve=>{
  const {engine:e,motion}=window.springRackPlayback,frames=[];let first,last;
  const frame=now=>{
   first??=now;const t=(now-first)/1000,start=performance.now(),state=motion.sample(t);e.model.setState(state);const updateMs=performance.now()-start;
   e.renderer.render(e.scene,e.camera);frames.push({time:t,intervalMs:last===undefined?0:now-last,updateMs,rackY:state.rackY,projection:state.projection});last=now;
   document.querySelector('#title').textContent='081 · isolated playback · four seconds per revolution · '+t.toFixed(2)+' s';
   if(t<12.2)requestAnimationFrame(frame);else resolve({duration:t,frames,bounds:window.springRackPlayback.bounds});
  };requestAnimationFrame(frame);
 }));
 for(const [name,time]of [['source',0],['entry',2.986],['lift',4],['release',4.868],['compressed',4.978],['return',5.4],['dwell',6],['loop',8],['repeat',12]]){
  const state=await page.evaluate(({time,name})=>{
   const {engine:e,motion}=window.springRackPlayback,r=motion.sample(time);e.model.setState(r);e.renderer.render(e.scene,e.camera);
   document.querySelector('#title').textContent='081 · indexed playback · '+name+' · '+time+' display seconds';return r;
  },{name,time});
  const file=`artifacts/review/${prefix}-${name}.png`;assert(!fs.existsSync(file));await page.screenshot({path:file});views.push({file,name,time,state,sha256:hash(file),inspected:false});
 }
 for(const source of sources)assert.equal(hash(source.file),source.sha256,source.file);
 const sorted=timing.frames.slice(1).map(f=>f.intervalMs).sort((a,b)=>a-b),updates=timing.frames.map(f=>f.updateMs).sort((a,b)=>a-b),
  summary={duration:timing.duration,frames:timing.frames.length,fps:(timing.frames.length-1)/timing.duration,
   medianIntervalMs:sorted[Math.floor(sorted.length/2)],p95IntervalMs:sorted[Math.floor(sorted.length*.95)],p95UpdateMs:updates[Math.floor(updates.length*.95)]};
 fs.writeFileSync(`artifacts/review/${prefix}.json`,JSON.stringify({movement:81,status:'isolated-indexed-browser-playback',productionChanged:false,mechanicsPassed:false,
  summary,timing,views,errors,sources,qualification:'A wall-clock browser run spans startup and repeated settled cycles at four display seconds per input revolution. Indexed wire updates and a stable complete-motion camera are exercised. Static captured poses require explicit inspection; complete mechanics and production integration remain pending.'},null,2)+'\n',{flag:'wx'});
 console.log({summary,views:views.length,errors});if(errors.length)process.exitCode=1;
}finally{await browser.close();}
