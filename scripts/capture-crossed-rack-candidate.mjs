import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const prefix=process.env.CAPTURE_PREFIX??'080-first-candidate',
 trajectory=process.env.CAPTURE_TRAJECTORY?JSON.parse(await readFile(process.env.CAPTURE_TRAJECTORY)):null,sources=[];
for(const file of ['scripts/capture-crossed-rack-candidate.mjs','scripts/lib/crossed-rack-candidate.mjs','scripts/lib/crossed-rack-source.mjs',
 'src/simulation/finite-plate-geometry.js','src/simulation/engine.js','artifacts/reference/brown-080-detail.png',...(process.env.CAPTURE_TRAJECTORY?[process.env.CAPTURE_TRAJECTORY]:[])]){
 const bytes=await readFile(file),sha256=createHash('sha256').update(bytes).digest('hex'),archive=file.endsWith('.png')?file:`artifacts/review/${prefix}-capture-source-${sources.length}.txt`;
 if(archive!==file)await writeFile(archive,bytes,{flag:'wx'});sources.push({file,sha256,archive});
}
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1500,height:800}}),captures=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5174/#/about');
 await page.evaluate(async trajectory=>{
  const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json'),
   {makeCrossedRackCandidate}=await import('/scripts/lib/crossed-rack-candidate.mjs');
  document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img id="source" src="/artifacts/reference/brown-080-detail.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>';
  await document.querySelector('#source').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[79],{playing:false});cancelAnimationFrame(e.animationFrame);e.animationFrame=0;
  e.scene.remove(e.model.root);e.model.root.traverse(x=>{x.geometry?.dispose();if(Array.isArray(x.material))x.material.forEach(m=>m.dispose());else x.material?.dispose();});
  e.model=makeCrossedRackCandidate(trajectory?.geometry);e.scene.add(e.model.root);e.updateGroundClearance();window.crossedCandidate=e;
  const u=e.model.root.userData;
  if(trajectory){
   const {Box3}=await import('/node_modules/three/build/three.module.js'),bounds=new Box3();
   for(const r of trajectory.rows){u.setState({q:r.q,rackY:r.x[0],leftAngle:r.x[1],rightAngle:r.x[2]});bounds.union(new Box3().setFromObject(e.model.root));}
   u.setState();u.sampledMotionBounds={min:bounds.min.toArray(),max:bounds.max.toArray()};
  }
  for(const light of e.scene.children.filter(x=>x.isDirectionalLight&&x.castShadow)){
   Object.assign(light.shadow.camera,{left:-u.shadowCameraHalfExtent,right:u.shadowCameraHalfExtent,top:u.shadowCameraHalfExtent,bottom:-u.shadowCameraHalfExtent});
   light.shadow.camera.updateProjectionMatrix();light.shadow.bias=u.shadowBias;light.shadow.normalBias=u.shadowNormalBias;
  }
 },trajectory?{geometry:trajectory.geometry,rows:trajectory.rows.map(r=>({q:r.q,x:r.x}))}:null);
 const views=trajectory?[...[0,.2,2,3,4,6,8,12,18,20].map(t=>['motion-'+t,[0,0,10],t]),['oblique',[-4,3,10],10],['rear',[4,3,-10],10]]:
  [['source',[0,0,10]],['source-aligned',[0,0,10]],['source-overlay',[0,0,10]],['oblique',[-4,3,10]],['rear',[4,3,-10]],
  ['crossing-detail',[1,2,6]],['left-hook-detail',[-1,2,6]],['right-hook-detail',[1,2,6]]];
 for(const [view,direction,time]of views){
  const row=trajectory?.rows[Math.min(trajectory.rows.length-1,Math.round(time/trajectory.dt))],state=row?{q:row.q,rackY:row.x[0],leftAngle:row.x[1],rightAngle:row.x[2]}:{};
  await page.evaluate(async({view,direction,state,time})=>{
   const {Vector3,OrthographicCamera}=await import('/node_modules/three/build/three.module.js'),e=window.crossedCandidate,u=e.model.root.userData,p=u.geometry;
   document.querySelector('#overlay')?.remove();u.setState(state);e.fitCamera(new Vector3(...direction));e.renderer.render(e.scene,e.camera);
   if(view==='source-aligned'||view==='source-overlay'){
    const width=1320/p.scale,height=width*720/726,cx=(660-p.center[0])/p.scale,cy=(p.center[1]-645)/p.scale,
     camera=new OrthographicCamera(-width/2,width/2,height/2,-height/2,.01,100);
    camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();e.renderer.render(e.scene,camera);
    if(view==='source-overlay'){
     const image=document.createElement('img');image.id='overlay';image.src='/artifacts/reference/brown-080-detail.png';
     image.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.55;mix-blend-mode:multiply;pointer-events:none';
     document.querySelector('#stage').append(image);await image.decode();
    }
   }else if(view.endsWith('-detail')){
    const xy=u.source(view==='crossing-detail'?[622,496]:view==='left-hook-detail'?[517,656]:[720,664]),focus=new Vector3(...xy,.16);
    e.camera.position.copy(focus).add(new Vector3(...direction));e.camera.lookAt(focus);e.camera.near=.005;
    e.camera.updateProjectionMatrix();e.camera.updateMatrixWorld();e.renderer.render(e.scene,e.camera);
   }
   document.querySelector('#title').textContent='080 · isolated '+(time===undefined?'source geometry':'contact study · physical '+time+' s')+' · '+view;
  },{view,direction,state,time});
  const file=`artifacts/review/${prefix}-${view}.png`;await page.screenshot({path:file});captures.push({file,view,direction,time,state,
   sha256:createHash('sha256').update(await readFile(file)).digest('hex'),inspected:false});
 }
 await writeFile(`artifacts/review/${prefix}-captures.json`,JSON.stringify({movement:80,status:'isolated-crossed-rack-static-views',productionChanged:false,
  mechanicsPassed:false,captures,errors,sources,qualification:trajectory?'Selected exploratory loaded poses with fixed whole-trajectory framing. Convergence, energy, continuous contact, complete clearance and playback remain unverified.':
  'Traced source pose for geometry review. Finite contact, loaded motion, hook clearance and finite travel are unverified.'},null,2)+'\n',{flag:'wx'});
 console.log({captures:captures.length,errors});if(errors.length)process.exitCode=1;
}finally{await browser.close();}
