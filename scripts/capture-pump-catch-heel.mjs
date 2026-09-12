import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-heel',frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json'),
  controlInput=process.env.PROBE_CONTROL??'artifacts/review/086-current-heel-controls.json',control=readStudyReport(controlInput);verifyStudySources(control.sources);assert(control.passed);
const verify=()=>{for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);};verify();
const sources=freezeStudySources(['scripts/capture-pump-catch-heel.mjs',...control.sources.map(s=>s.file),'src/simulation/engine.js',
  controlInput,'artifacts/reference/brown-086-detail.png'],prefix);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1500,height:800}}),errors=[],warnings=[],views=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text());});
try{
  await page.goto('http://127.0.0.1:5174/#/about');
  await page.evaluate(async()=>{
    const{MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json'),{makePumpCatchWeightedCandidate}=await import('/scripts/lib/pump-catch-weighted-candidate.mjs');
    document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-086-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
    await document.querySelector('img').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[85],{playing:false});
    cancelAnimationFrame(e.animationFrame);e.animationFrame=0;e.scene.remove(e.model.root);
    e.model.root.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});
    e.model=makePumpCatchWeightedCandidate({headBackDepth:.1,heelStop:true});e.scene.add(e.model.root);e.updateGroundClearance();
    e.scene.traverse(o=>{if(o.isDirectionalLight&&o.shadow){const u=e.model.root.userData,s=o.shadow;s.bias=u.shadowBias;s.normalBias=u.shadowNormalBias;
      Object.assign(s.camera,{left:-u.shadowCameraHalfExtent,right:u.shadowCameraHalfExtent,top:u.shadowCameraHalfExtent,bottom:-u.shadowCameraHalfExtent});s.camera.updateProjectionMatrix();}});
    window.pumpCandidate=e;
  });
  const selected=process.env.PROBE_VIEWS?.split(','),poses=[['source',[0,0,10]],['source-overlay',[0,0,10]],['front',[0,0,10]],['oblique',[4,3,10]],['rear',[-4,3,-10]],
    ['heel-open',[-5,0,-5]],['heel-seated',[-5,0,-5]],['heel-axial',[-7,4,-3]]];
  if(selected)assert(selected.every(name=>poses.some(p=>p[0]===name)));
  for(const[name,direction]of poses.filter(p=>!selected||selected.includes(p[0]))){
    await page.evaluate(async({name,direction,angle})=>{
      const{THREE:{Vector3,OrthographicCamera}}=await import('/scripts/lib/pump-catch-candidate.mjs'),e=window.pumpCandidate,u=e.model.root.userData,p=u.source,detail=name.startsWith('heel');
      document.querySelector('#overlay')?.remove();e.model.setState({catchAngle:name==='heel-open'||!detail?0:angle,camAngle:detail?-3:0});
      for(const[name,mesh]of Object.entries(u.parts))mesh.visible=!detail||['hookedCatchB','catchHeadBack','catchPivotPin','catchPivotHead','catchHeelLug','wheelHeelStop'].includes(name);
      e.fitCamera(new Vector3(...direction));let camera=e.camera;
      if(name.startsWith('source')){const h=Math.max(p.height,p.width*720/726)/p.scale,w=h*726/720,cx=(p.width/2-p.center[0])/p.scale,cy=(p.center[1]-p.height/2)/p.scale;
        camera=new OrthographicCamera(-w/2,w/2,h/2,-h/2,.01,100);camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();}
      if(detail){
        const target=new Vector3(u.geometry.pivot[0]+.055,u.geometry.pivot[1]+.075,-.1);
        camera=new OrthographicCamera(-.16,.16,.16*720/726,-.16*720/726,.01,100);camera.position.copy(target).add(new Vector3(...direction));camera.lookAt(target);camera.updateMatrixWorld();
      }
      e.renderer.render(e.scene,camera);
      if(name==='source-overlay'){const img=document.createElement('img');img.id='overlay';img.src='/artifacts/reference/brown-086-detail.png';
        img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';document.querySelector('#stage').append(img);await img.decode();}
      document.querySelector('#title').textContent='086 · finite heel study · '+name+(detail?' · wheel and frame hidden':'');
    },{name,direction,angle:control.actualContactAngle});
    const file=prefix+'-'+name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file});views.push({name,file,sha256:hashStudyFile(file),inspected:false});
  }
  verify();verifyStudySources(sources);const known=[/^THREE.Clock: This module has been deprecated\./,/^THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated\./,/^\[.WebGL-.*GPU stall due to ReadPixels/],unexpectedWarnings=warnings.filter(w=>!known.some(r=>r.test(w)));
  fs.writeFileSync(prefix+'-captures.json',JSON.stringify({movement:86,productionChanged:false,mechanicsPassed:false,candidateIntegrated:false,views,errors,warnings,unexpectedWarnings,sources},null,2)+'\n',{flag:'wx'});
  console.log({views:views.length,errors,unexpectedWarnings});assert(!errors.length&&!unexpectedWarnings.length);
}finally{await browser.close();}
