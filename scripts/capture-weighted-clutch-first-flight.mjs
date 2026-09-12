import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-flight-rendered',input='artifacts/review/087-first-flight-solids.json',
 report=readStudyReport(input),trajectories=report.inputs.map(({file})=>readStudyReport(file)),
 baseline=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json'),
 verify=()=>{for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);},
 sources=freezeStudySources([...report.sources.map(s=>s.file),'scripts/capture-weighted-clutch-first-flight.mjs',input,
  'src/simulation/engine.js','artifacts/reference/brown-087-detail.png'],prefix);
verify();verifyStudySources(report.sources);assert.equal(report.poses.length,16);assert.deepEqual(report.issues,[]);
const errors=[],warnings=[],views=[],playback=[],browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:800}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text());});
 await page.goto('http://127.0.0.1:5174/#/about');
 await page.evaluate(async({trajectories,poses})=>{
  const{MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json'),
   {makeWeightedClutchLostMotionCandidate,THREE}=await import('/scripts/lib/weighted-clutch-lost-motion-candidate.mjs');
  document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-087-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
  await document.querySelector('img').decode();
  const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[86],{playing:false});
  cancelAnimationFrame(e.animationFrame);e.animationFrame=0;e.scene.remove(e.model.root);
  e.model.root.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});
  e.model=makeWeightedClutchLostMotionCandidate();e.scene.add(e.model.root);e.updateGroundClearance();
  e.scene.traverse(o=>{if(o.isDirectionalLight&&o.shadow){const u=e.model.root.userData,s=o.shadow;s.bias=u.shadowBias;s.normalBias=u.shadowNormalBias;
   Object.assign(s.camera,{left:-u.shadowCameraHalfExtent,right:u.shadowCameraHalfExtent,top:u.shadowCameraHalfExtent,bottom:-u.shadowCameraHalfExtent});s.camera.updateProjectionMatrix();}});
  const bounds=new THREE.Box3();
  for(const pose of poses){e.model.setState(pose.state);bounds.union(new THREE.Box3().setFromObject(e.model.root));}
  const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const front=()=>{
   const h=1.12*Math.max(size.y,size.x*720/726),w=h*726/720,camera=new THREE.OrthographicCamera(-w/2,w/2,h/2,-h/2,.01,100);
   camera.position.copy(center).add(new THREE.Vector3(0,0,15));camera.lookAt(center);camera.updateMatrixWorld();return camera;
  };
  const state=(row,direction)=>{
   const u=e.model.root.userData,outputAngle=row[2]*u.geometry.eRatio,inputAngle=outputAngle/u.geometry.mainRatio*(direction==='CCW'?-1:1);
   return e.model.setState({leverAngle:row[1],direction:direction==='CCW'?'leftward':'rightward',inputAngle,outputAngle});
  };
  window.weightedFlight={e,trajectories,front,state,bounds:bounds.min.toArray().concat(bounds.max.toArray())};
 },{trajectories:trajectories.map(r=>({direction:r.direction,rows:r.rows.map(r=>[r.time,r.q,r.e])})),poses:report.poses});
 const specs=[];
 for(const direction of ['CCW','CW'])for(const name of ['start','release','fall-0.5','slot-arrival']){
  specs.push({name:direction+'-'+name,pose:report.poses.findIndex(p=>p.direction===direction&&p.name===name)});
 }
 for(const direction of ['CCW','CW'])specs.push({name:direction+'-fall-oblique',pose:report.poses.findIndex(p=>p.direction===direction&&p.name==='fall-0.5'),direction:[4,3,10]});
 for(const name of ['initial-separation','first-recontact'])specs.push({name:'CW-'+name+'-detail',pose:report.poses.findIndex(p=>p.direction==='CW'&&p.name===name),center:[5.2,-.6,1.25],width:1.7});
 for(const spec of specs){
  const pose=report.poses[spec.pose];assert(pose);
  await page.evaluate(async({spec,pose})=>{
   const{THREE:{Vector3,OrthographicCamera}}=await import('/scripts/lib/weighted-clutch-lost-motion-candidate.mjs'),
    f=window.weightedFlight,e=f.e;e.model.setState(pose.state);let camera=f.front();
   if(spec.direction){e.fitCamera(new Vector3(...spec.direction));camera=e.camera;}
   if(spec.center){const w=spec.width,h=w*720/726,center=new Vector3(...spec.center);camera=new OrthographicCamera(-w/2,w/2,h/2,-h/2,.01,100);
    camera.position.copy(center).add(new Vector3(0,0,10));camera.lookAt(center);camera.updateMatrixWorld();}
   e.renderer.render(e.scene,camera);
   document.querySelector('#title').textContent='087 · lift and gravity fall · '+spec.name+' · t = '+pose.time.toFixed(3)+' · 75 px pin adjustment';
  },{spec,pose});
  const file=prefix+'-'+spec.name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file});
  views.push({...spec,time:pose.time,state:pose.state,file,sha256:hashStudyFile(file),inspected:false});
 }
 for(const direction of ['CCW','CW']){
  const result=await page.evaluate(async direction=>{
   const f=window.weightedFlight,rows=f.trajectories.find(r=>r.direction===direction).rows,end=rows.at(-1)[0],camera=f.front(),updates=[],frames=[];
   let index=1,lastTime=-Infinity,maxStep=0,lastClock=null;
   return await new Promise(resolve=>{
    let start;
    function frame(clock){
     start??=clock;const time=Math.min(end,(clock-start)/1000);
     while(index<rows.length-1&&rows[index][0]<time)index++;
     const a=rows[index-1],b=rows[index],t=(time-a[0])/(b[0]-a[0]),row=[time,a[1]+t*(b[1]-a[1]),a[2]+t*(b[2]-a[2])],before=performance.now();
     const state=f.state(row,direction);updates.push(performance.now()-before);f.e.renderer.render(f.e.scene,camera);
     if(lastClock!==null)frames.push(clock-lastClock);lastClock=clock;maxStep=Math.max(maxStep,Number.isFinite(lastTime)?time-lastTime:0);lastTime=time;
     document.querySelector('#title').textContent='087 · '+direction+' lift and gravity fall · '+time.toFixed(2)+' / '+end.toFixed(2)+' time units';
     if(time<end){requestAnimationFrame(frame);return;}
     updates.sort((a,b)=>a-b);resolve({direction,frames:updates.length,duration:time,wallDuration:(clock-start)/1000,
      fps:frames.length/((clock-start)/1000),p95UpdateMs:updates[Math.floor((updates.length-1)*.95)],maxStep,endState:state});
    }
    requestAnimationFrame(frame);
   });
  },direction);
  playback.push(result);console.log(result);
  assert(result.frames>30&&result.endState.leverAngle===trajectories.find(r=>r.direction===direction).rows.at(-1).q);
 }
 verify();verifyStudySources(sources);
 const known=[/^THREE.Clock: This module has been deprecated\./,/^THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated\./,/^\[.WebGL-.*GPU stall due to ReadPixels/],
  unexpectedWarnings=warnings.filter(w=>!known.some(r=>r.test(w)));
 fs.writeFileSync(prefix+'-captures.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  input:{file:input,sha256:hashStudyFile(input)},sources,views,playback,errors,warnings,unexpectedWarnings,
  qualification:'Twelve still views and two timed previews of separate partial linkage trajectories at one illustrative physical time unit per display second. Each stops before the opposite slot-end impact; they do not form a repeating reversal. Uses linear interpolation of the finest numerical knots. Source fidelity, continuous rendered clearance and final full-cycle display speed remain unresolved.'},null,2)+'\n',{flag:'wx'});
 console.log({views:views.length,errors,unexpectedWarnings});assert(!errors.length&&!unexpectedWarnings.length);
}finally{await browser.close();}
