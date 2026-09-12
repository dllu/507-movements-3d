import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-native-lifting',input='artifacts/review/087-first-stud-lifts.json',
 report=readStudyReport(input),baseline=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json'),
 verify=()=>{for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);},
 sources=freezeStudySources([...report.sources.map(s=>s.file),'scripts/capture-weighted-clutch-stud-lifts.mjs',input,
  'src/simulation/engine.js','artifacts/reference/brown-087-detail.png'],prefix);
verify();assert.equal(report.poses.length,18);assert.deepEqual(report.issues,[]);
const errors=[],warnings=[],views=[],browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1500,height:800}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text());});
 await page.goto('http://127.0.0.1:5174/#/about');
 await page.evaluate(async()=>{
  const{MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json'),
   {makeWeightedClutchLostMotionCandidate}=await import('/scripts/lib/weighted-clutch-lost-motion-candidate.mjs');
  document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-087-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
  await document.querySelector('img').decode();
  const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[86],{playing:false});
  cancelAnimationFrame(e.animationFrame);e.animationFrame=0;e.scene.remove(e.model.root);
  e.model.root.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});
  e.model=makeWeightedClutchLostMotionCandidate();e.scene.add(e.model.root);e.updateGroundClearance();
  e.scene.traverse(o=>{if(o.isDirectionalLight&&o.shadow){const u=e.model.root.userData,s=o.shadow;s.bias=u.shadowBias;s.normalBias=u.shadowNormalBias;
   Object.assign(s.camera,{left:-u.shadowCameraHalfExtent,right:u.shadowCameraHalfExtent,top:u.shadowCameraHalfExtent,bottom:-u.shadowCameraHalfExtent});s.camera.updateProjectionMatrix();}});
  window.weightedCandidate=e;
 });
 const specs=[
  {name:'forward-start',pose:0},{name:'forward-middle',pose:4},{name:'forward-vertical',pose:8},
  {name:'return-start',pose:9},{name:'return-middle',pose:13},{name:'return-vertical',pose:17},
  {name:'source-overlay',pose:0},{name:'source-oblique',pose:0,direction:[4,3,10]},
  {name:'return-rear',pose:9,direction:[-4,3,-10]},
  {name:'forward-contact-detail',pose:0,center:[5.1,-.3,1.25],width:1.5},
  {name:'return-contact-detail',pose:9,center:[5.2,-.72,1.25],width:1.5},
  {name:'forward-contact-oblique',pose:4,direction:[4,3,10],center:[5.2,-.4,1.25],width:1.7},
  {name:'return-contact-oblique',pose:9,direction:[4,3,10],center:[5.2,-.6,1.25],width:1.7},
 ];
 for(const spec of specs){
  const state=report.poses[spec.pose].state;
  await page.evaluate(async({spec,state})=>{
   const{THREE:{Vector3,OrthographicCamera}}=await import('/scripts/lib/weighted-clutch-lost-motion-candidate.mjs'),
    e=window.weightedCandidate,p=e.model.root.userData.source,direction=new Vector3(...(spec.direction??[0,0,10]));
   document.querySelector('#overlay')?.remove();e.model.setState(state);e.fitCamera(direction);let camera=e.camera;
   if(spec.name==='source-overlay'){
    const h=Math.max(p.height,p.width*720/726)/p.scale,w=h*726/720,cx=(p.width/2-p.origin[0])/p.scale,cy=(p.origin[1]-p.height/2)/p.scale;
    camera=new OrthographicCamera(-w/2,w/2,h/2,-h/2,.01,100);camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();
   }
   if(spec.center){
    const center=new Vector3(...spec.center),w=spec.width,h=w*720/726;
    camera=new OrthographicCamera(-w/2,w/2,h/2,-h/2,.01,100);camera.position.copy(direction.normalize().multiplyScalar(10).add(center));
    camera.lookAt(center);camera.updateMatrixWorld();
   }
   e.renderer.render(e.scene,camera);
   if(spec.name==='source-overlay'){
    const img=document.createElement('img');img.id='overlay';img.src='/artifacts/reference/brown-087-detail.png';
    img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';
    document.querySelector('#stage').append(img);await img.decode();
   }
   document.querySelector('#title').textContent='087 · native lifting contact · '+spec.name+' · rod pins adjusted 75 source pixels';
  },{spec,state});
  const file=prefix+'-'+spec.name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file});
  views.push({...spec,state,file,sha256:hashStudyFile(file),inspected:false});
 }
 verify();verifyStudySources(sources);
 const known=[/^THREE.Clock: This module has been deprecated\./,/^THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated\./,/^\[.WebGL-.*GPU stall due to ReadPixels/],
  unexpectedWarnings=warnings.filter(w=>!known.some(r=>r.test(w)));
 fs.writeFileSync(prefix+'-captures.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  input:{file:input,sha256:hashStudyFile(input)},sources,views,errors,warnings,unexpectedWarnings,
  qualification:'Thirteen static views from separately solved native stud lifting branches. E and its bevel gears rotate to actual contact; motor phase preserves each engaged jaw pair. The source overlay exposes the unchanged 75-pixel rod-pin departure. Gravity fall, clutch transition, full reversal timing and continuous hardware clearance remain pending.'},null,2)+'\n',{flag:'wx'});
 console.log({views:views.length,errors,unexpectedWarnings});assert(!errors.length&&!unexpectedWarnings.length);
}finally{await browser.close();}
