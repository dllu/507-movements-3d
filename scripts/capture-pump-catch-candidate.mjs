import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-candidate',frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json');
const verify=()=>{for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);};verify();
const sources=freezeStudySources(['scripts/capture-pump-catch-candidate.mjs','scripts/lib/pump-catch-candidate.mjs','scripts/lib/pump-catch-source.mjs',
  'src/simulation/engine.js','src/simulation/finite-plate-geometry.js','src/simulation/conforming-plate-mesh.js','src/simulation/clutch-section-geometry.js',
  'src/simulation/primitives.js','scripts/lib/study-report-io.mjs','artifacts/reference/brown-086-detail.png'],prefix);
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
  for(const[name,direction]of [['source',[0,0,10]],['source-overlay',[0,0,10]],['front',[0,0,10]],['oblique',[4,3,10]],['rear',[-4,3,-10]],['contact-detail',[0,0,10]],['cam-section',[0,0,10]]]){
    await page.evaluate(async({name,direction})=>{
      const{THREE:{Vector3,OrthographicCamera}}=await import('/scripts/lib/pump-catch-candidate.mjs'),e=window.pumpCandidate,p=e.model.root.userData.source;
      document.querySelector('#overlay')?.remove();e.model.setState();e.fitCamera(new Vector3(...direction));let camera=e.camera;
      for(const key of ['frontBearingStandard','frontBearingLip'])e.model.root.userData.parts[key].visible=name!=='cam-section';
      if(name.startsWith('source')){const h=Math.max(p.height,p.width*720/726)/p.scale,w=h*726/720,cx=(p.width/2-p.center[0])/p.scale,cy=(p.center[1]-p.height/2)/p.scale;
        camera=new OrthographicCamera(-w/2,w/2,h/2,-h/2,.01,100);camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();}
      if(['contact-detail','cam-section'].includes(name)){camera=new OrthographicCamera(-.85,.85,.85*720/726,-.85*720/726,.01,100);
        camera.position.set(-.65,.45,10);camera.lookAt(-.65,.45,0);camera.updateMatrixWorld();}
      e.renderer.render(e.scene,camera);
      if(name==='source-overlay'){const img=document.createElement('img');img.id='overlay';img.src='/artifacts/reference/brown-086-detail.png';
        img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';document.querySelector('#stage').append(img);await img.decode();}
      document.querySelector('#title').textContent='086 · initial geometry study · '+name;
    },{name,direction});
    const file=prefix+'-'+name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file});views.push({name,file,sha256:hashStudyFile(file),inspected:false});
  }
  verify();verifyStudySources(sources);const known=[/^THREE.Clock: This module has been deprecated\./,/^THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated\./,/^\[.WebGL-.*GPU stall due to ReadPixels/],unexpectedWarnings=warnings.filter(w=>!known.some(r=>r.test(w)));
  fs.writeFileSync(prefix+'-captures.json',JSON.stringify({movement:86,productionChanged:false,mechanicsPassed:false,candidateIntegrated:false,views,errors,warnings,unexpectedWarnings,sources},null,2)+'\n',{flag:'wx'});
  console.log({views:views.length,errors,unexpectedWarnings});assert(!errors.length&&!unexpectedWarnings.length);
}finally{await browser.close();}
