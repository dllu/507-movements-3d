import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const prefix=process.env.CAPTURE_PREFIX??'079-first-candidate',trajectory=process.env.CAPTURE_TRAJECTORY?JSON.parse(await readFile(process.env.CAPTURE_TRAJECTORY,'utf8')):null,
 options=JSON.parse(process.env.GEOMETRY_OPTIONS??JSON.stringify(trajectory?.geometry??{})),pose=JSON.parse(process.env.SOURCE_STATE??'{}'),sources=[];
for(const file of ['scripts/capture-opposed-arm-candidate.mjs','scripts/lib/opposed-arm-candidate.mjs','src/simulation/finite-plate-geometry.js','src/simulation/engine.js','artifacts/reference/brown-079-detail.png',...(process.env.CAPTURE_TRAJECTORY?[process.env.CAPTURE_TRAJECTORY]:[])]){
 const bytes=await readFile(file),sha256=createHash('sha256').update(bytes).digest('hex'),archive=file.endsWith('.png')?file:`artifacts/review/${prefix}-geometry-source-${sources.length}.txt`;
 if(archive!==file)await writeFile(archive,bytes,{flag:'wx'});sources.push({file,sha256,archive});
}
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1500,height:800}}),captures=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5174/#/about');
 await page.evaluate(async options=>{
  const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json'),{makeOpposedArmCandidate}=await import('/scripts/lib/opposed-arm-candidate.mjs');
  document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img id="source" src="/artifacts/reference/brown-079-detail.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>';
  await document.querySelector('#source').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[78],{playing:false});cancelAnimationFrame(e.animationFrame);e.animationFrame=0;
  e.scene.remove(e.model.root);e.model.root.traverse(x=>{x.geometry?.dispose();if(Array.isArray(x.material))x.material.forEach(m=>m.dispose());else x.material?.dispose();});
  e.model=makeOpposedArmCandidate(options);e.scene.add(e.model.root);e.updateGroundClearance();window.opposedCandidate=e;
  const u=e.model.root.userData;
  for(const light of e.scene.children.filter(x=>x.isDirectionalLight&&x.castShadow)){
   Object.assign(light.shadow.camera,{left:-u.shadowCameraHalfExtent,right:u.shadowCameraHalfExtent,top:u.shadowCameraHalfExtent,bottom:-u.shadowCameraHalfExtent});
   light.shadow.camera.updateProjectionMatrix();light.shadow.bias=u.shadowBias;light.shadow.normalBias=u.shadowNormalBias;
  }
 },options);
 const views=[['source',[0,0,10]],['source-aligned',[0,0,10]],['oblique',[-4,3,10]],['rear',[4,3,-10]],['upper-detail',[1,2,5]],['lower-detail',[-1,2,5]]]
  .filter(([name])=>!process.env.CAPTURE_VIEWS||process.env.CAPTURE_VIEWS.split(',').includes(name));
 if(trajectory)for(const time of JSON.parse(process.env.DYNAMIC_TIMES??'[0,2,4,6,8,10,12,14,16]'))views.push(['cycle-'+time,[0,0,10],time]);
 for(const [view,direction,time]of views){
  const row=time===undefined?null:trajectory.rows[Math.min(trajectory.rows.length-1,Math.round(time/trajectory.dt))],currentPose=row?
   {theta:row.x[0],upperBeta:row.x[1],lowerBeta:row.x[2],...(row.sliderX===undefined?{}:{sliderX:row.sliderX})}:pose;
  const state=await page.evaluate(async({view,direction,pose})=>{
   const {Vector3,OrthographicCamera}=await import('/node_modules/three/build/three.module.js'),e=window.opposedCandidate,u=e.model.root.userData,p=u.geometry;
   u.setState(pose);e.fitCamera(new Vector3(...direction));e.renderer.render(e.scene,e.camera);
   if(view==='source-aligned'||view.startsWith('cycle-')){
    const width=1430/p.scale*(view.startsWith('cycle-')?1.08:1),height=width*720/726,cx=(715-p.center[0])/p.scale,cy=(p.center[1]-690)/p.scale,camera=new OrthographicCamera(-width/2,width/2,height/2,-height/2,.01,100);
    camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();e.renderer.render(e.scene,camera);
   }else if(view.endsWith('-detail')){
    const key=view.startsWith('upper')?'upper':'lower',P=u.kinematics.arms[key].pivot,focus=new Vector3(...P,.13);
    e.camera.position.copy(focus).add(new Vector3(...direction).multiplyScalar(.7));e.camera.lookAt(focus);e.camera.near=.005;e.camera.updateProjectionMatrix();e.camera.updateMatrixWorld();e.renderer.render(e.scene,e.camera);
   }
   document.querySelector('#title').textContent='079 · isolated face-ratchet geometry · '+view;return u.kinematics;
  },{view,direction,pose:currentPose});
  const file=`artifacts/review/${prefix}-${view}.png`;await page.screenshot({path:file});captures.push({file,view,direction,time:row?.time,state,framing:view.startsWith('cycle-')?'source camera widened 8% to contain full stroke':view,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),inspected:false});
 }
 if(errors.length)throw Error(errors.join('\n'));
 await writeFile(`artifacts/review/${prefix}-captures.json`,JSON.stringify({movement:79,status:trajectory?'isolated-face-ratchet-dynamics-views':'isolated-face-ratchet-static-views',productionChanged:false,mechanicsPassed:false,captures,errors,options,pose,sources,
  qualification:trajectory?'Sampled poses from an exploratory finite-contact trajectory. Complete sustained operation, convergence, energy and continuous clearance are unverified.':'Geometry-study pose. No free-pawl/output trajectory or finite contact solution has been supplied. Images are not evidence of correct loaded operation.'},null,2)+'\n',{flag:'wx'});
 console.log({captures:captures.length,errors});
}finally{await browser.close();}
