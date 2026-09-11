import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const trajectoryFile=process.env.CAPTURE_TRAJECTORY??'artifacts/review/078-amplitude-038.json',trajectory=JSON.parse(await readFile(trajectoryFile,'utf8')),geometry=trajectory.geometry,
 prefix=process.env.CAPTURE_PREFIX??'078-relieved-dynamic-candidate',browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1500,height:800}}),captures=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5174/#/about');
 await page.evaluate(async geometry=>{
  const{MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json'),{makePullPawlCandidate}=await import('/scripts/lib/pull-pawl-candidate.mjs');
  document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img id="source" src="/artifacts/reference/brown-078-detail.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>';
  await document.querySelector('#source').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[77],{playing:false});cancelAnimationFrame(e.animationFrame);e.animationFrame=0;
  e.scene.remove(e.model.root);e.model.root.traverse(x=>{x.geometry?.dispose();if(Array.isArray(x.material))x.material.forEach(m=>m.dispose());else x.material?.dispose();});
  e.model=makePullPawlCandidate(geometry);e.scene.add(e.model.root);e.updateGroundClearance();window.pullCandidate=e;
  const u=e.model.root.userData;for(const light of e.scene.children.filter(x=>x.isDirectionalLight&&x.castShadow)){
   Object.assign(light.shadow.camera,{left:-u.shadowCameraHalfExtent,right:u.shadowCameraHalfExtent,top:u.shadowCameraHalfExtent,bottom:-u.shadowCameraHalfExtent});light.shadow.camera.updateProjectionMatrix();light.shadow.bias=u.shadowBias;light.shadow.normalBias=u.shadowNormalBias;
  }
 },geometry);
 const initialViews=[['source',[0,0,10]],['source-aligned',[0,0,10]],['oblique',[-4,3,10]],['rear',[4,3,-10]],['left-detail',[-2,1,5]],['right-detail',[-2,1,5]]];
 const dynamicViews=Array.from({length:9},(_,i)=>{const time=trajectory.parameters.period*(1+i/8),pose=trajectory.rows.reduce((best,row)=>Math.abs(row.time-time)<Math.abs(best.time-time)?row:best);return['cycle-'+i,[-3,2,10],pose];});
 for(const[view,direction,pose]of[...initialViews.map(v=>[...v,trajectory.rows[0]]),...dynamicViews]){
  const state=await page.evaluate(async({view,direction,pose})=>{
   const{Vector3,OrthographicCamera}=await import('/node_modules/three/build/three.module.js'),e=window.pullCandidate,u=e.model.root.userData,p=u.geometry;
   u.setState(pose?{q:pose.q,theta:pose.x[0],leftAngle:pose.x[1],rightAngle:pose.x[2]}:{});e.fitCamera(new Vector3(...direction));e.renderer.render(e.scene,e.camera);
   if(view==='source-aligned'){
    const height=1300/p.scale,width=height*726/720,cx=(635-p.center[0])/p.scale,cy=(p.center[1]-650)/p.scale,camera=new OrthographicCamera(-width/2,width/2,height/2,-height/2,.01,100);
    camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();e.renderer.render(e.scene,camera);
   }else if(view.endsWith('-detail')){
    const key=view.startsWith('left')?'left':'right',N=p.hooks[key],focus=new Vector3(...N,.15);e.camera.position.copy(focus).add(new Vector3(...direction).multiplyScalar(.65));e.camera.lookAt(focus);e.camera.near=.005;e.camera.updateProjectionMatrix();e.camera.updateMatrixWorld();e.renderer.render(e.scene,e.camera);
   }
   document.querySelector('#title').textContent='078 · finite contact dynamics · '+view+(pose?' · t = '+pose.time.toFixed(2)+' s':'');return u.kinematics;
  },{view,direction,pose});
  const file='artifacts/review/'+prefix+'-'+view+'.png';await page.screenshot({path:file});captures.push({file,view,direction,time:pose?.time,state,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),inspected:false});
 }
 if(errors.length)throw new Error(errors.join('\n'));const sources=[];for(const file of [trajectoryFile,'scripts/capture-pull-pawl-dynamics.mjs','scripts/lib/pull-pawl-candidate.mjs','scripts/lib/pull-pawl-contact-study.mjs'])sources.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
 await writeFile('artifacts/review/'+prefix+'-captures.json',JSON.stringify({movement:77,status:'isolated-dynamic-candidate-views',trajectoryFile,geometry,productionChanged:false,mechanicsPassed:false,captures,errors,sources,qualification:'Source-scale candidate and one cycle of exploratory contact dynamics. These captures alone do not validate time-step convergence, energy balance or complete 3D clearance. Per-pose camera refitting does not establish suitable playback timing.'},null,2)+'\n',{flag:'wx'});console.log({captures:captures.length,errors});
}finally{await browser.close();}
