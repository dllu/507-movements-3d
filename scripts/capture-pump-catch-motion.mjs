import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const input=process.env.PROBE_INPUT??'artifacts/review/086-exact-face-half-ms-impact.json.gz',prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-impact-motion',data=readStudyReport(input);
verifyStudySources(data.sources);const frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json'),verify=()=>{for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);};verify();
const sources=freezeStudySources([input,'scripts/capture-pump-catch-motion.mjs',...data.sources.map(s=>s.file),'src/simulation/engine.js','artifacts/reference/brown-086-detail.png'],prefix);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1500,height:800}}),errors=[],warnings=[],views=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text());});
try{
  await page.goto('http://127.0.0.1:5174/#/about');
  await page.evaluate(async()=>{
    const{MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json'),{makePumpCatchCandidate}=await import('/scripts/lib/pump-catch-candidate.mjs');
    document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-086-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
    await document.querySelector('img').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[85],{playing:false});
    cancelAnimationFrame(e.animationFrame);e.animationFrame=0;e.scene.remove(e.model.root);
    e.model.root.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});
    e.model=makePumpCatchCandidate();e.scene.add(e.model.root);e.updateGroundClearance();
    e.scene.traverse(o=>{if(o.isDirectionalLight&&o.shadow){const u=e.model.root.userData,s=o.shadow;s.bias=u.shadowBias;s.normalBias=u.shadowNormalBias;
      Object.assign(s.camera,{left:-u.shadowCameraHalfExtent,right:u.shadowCameraHalfExtent,top:u.shadowCameraHalfExtent,bottom:-u.shadowCameraHalfExtent});s.camera.updateProjectionMatrix();}});
    window.pumpCandidate=e;
  });
  for(const[name,time,section,direction]of [['source',0,false,[0,0,10]],['first-contact',.036,true,[0,0,10]],['seating',.143,true,[0,0,10]],
    ['lift',.6,true,[0,0,10]],['trip',1.25,true,[0,0,10]],['released',1.8,true,[0,0,10]],['return',2.73,true,[0,0,10]],
    ['late-return',2.918,true,[0,0,10]],['end',3,false,[4,3,10]]]){
    let index=data.rows.findIndex(r=>r.time>=time);if(index<0)index=data.rows.length-1;const row=data.rows[index];
    await page.evaluate(async({name,row,section,direction,angularSpeed})=>{
      const{THREE:{Vector3}}=await import('/scripts/lib/pump-catch-candidate.mjs'),e=window.pumpCandidate;
      e.model.setState({wheelAngle:row.q[0],catchAngle:row.q[1]-row.q[0],camAngle:angularSpeed*row.time});
      for(const key of ['frontBearingStandard','frontBearingLip'])e.model.root.userData.parts[key].visible=!section;
      e.fitCamera(new Vector3(...direction));e.renderer.render(e.scene,e.camera);
      document.querySelector('#title').textContent='086 · motion diagnostic · '+name+' · '+row.time.toFixed(4)+' s'+(section?' · front bearing hidden':'');
    },{name,row:{time:row.time,q:row.q},section,direction,angularSpeed:data.angularSpeed});
    const file=prefix+'-'+name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file});views.push({name,file,time:row.time,q:row.q,section,sha256:hashStudyFile(file),inspected:false});
  }
  verify();verifyStudySources(sources);const known=[/^THREE.Clock: This module has been deprecated\./,/^THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated\./,/^\[.WebGL-.*GPU stall due to ReadPixels/],unexpectedWarnings=warnings.filter(w=>!known.some(r=>r.test(w)));
  fs.writeFileSync(prefix+'-captures.json',JSON.stringify({movement:86,productionChanged:false,mechanicsPassed:false,candidateIntegrated:false,input,views,errors,warnings,unexpectedWarnings,sources},null,2)+'\n',{flag:'wx'});
  console.log({views:views.length,errors,unexpectedWarnings});assert(!errors.length&&!unexpectedWarnings.length);
}finally{await browser.close();}
