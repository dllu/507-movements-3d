import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readStudyReport,freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-fixed-orbit-rendered',input=process.env.PROBE_INPUT??'artifacts/review/087-first-fixed-orbit-geometry.json',
  report=readStudyReport(input),sources=freezeStudySources([...report.sources.map(s=>s.file),input,
    'scripts/capture-weighted-clutch-fixed-orbit-fit.mjs','src/simulation/engine.js',
    'artifacts/reference/brown-087-detail.png'],prefix),views=[],errors=[],warnings=[];
verifyStudySources(report.sources);assert(!report.issues.length&&!report.topologyIssues.length);
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1500,height:800}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text());});
  await page.goto('http://127.0.0.1:5174/#/about');
  await page.evaluate(async options=>{
    const{MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json'),
      {makeWeightedClutchDistributedCandidate}=await import('/scripts/lib/weighted-clutch-distributed-candidate.mjs'),
      {makeWeightedClutchKeyCandidate}=await import('/scripts/lib/weighted-clutch-key-candidate.mjs');
    document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:19px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-087-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
    await document.querySelector('img').decode();
    const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[86],{playing:false});
    cancelAnimationFrame(e.animationFrame);e.animationFrame=0;e.scene.remove(e.model.root);
    e.model.root.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});
    const candidate=makeWeightedClutchDistributedCandidate(options),previous=makeWeightedClutchKeyCandidate();
    previous.setCoordinates([0,previous.root.userData.lostMotion.parameters.shifterRight,0,0,0],0);
    e.model=candidate;e.scene.add(candidate.root);e.updateGroundClearance();
    e.scene.traverse(o=>{if(o.isDirectionalLight&&o.shadow){const u=candidate.root.userData,s=o.shadow;s.bias=u.shadowBias;s.normalBias=u.shadowNormalBias;
      Object.assign(s.camera,{left:-u.shadowCameraHalfExtent,right:u.shadowCameraHalfExtent,top:u.shadowCameraHalfExtent,bottom:-u.shadowCameraHalfExtent});s.camera.updateProjectionMatrix();}});
    window.fixedOrbitClutch={e,candidate,previous};
  },report.options);
  const specs=[
    {name:'source',source:true},{name:'source-overlay',source:true,overlay:true},
    {name:'front'},{name:'oblique',direction:[4,3,10]},{name:'rear',direction:[-4,3,-10]},
    {name:'F-pin-detail',center:[.2,-1.7,0],width:1.6},
    {name:'G-and-stud-detail',center:[4.8,-.55,0],width:3.0},
    {name:'quadrant-detail',center:[.2,-1.3,0],width:2.7},
    {name:'previous-75px-overlay',source:true,overlay:true,previous:true},
  ];
  for(const spec of specs){
    const state=await page.evaluate(async spec=>{
      const{THREE:{Vector3,OrthographicCamera}}=await import('/scripts/lib/weighted-clutch-distributed-candidate.mjs'),
        f=window.fixedOrbitClutch,e=f.e;
      e.scene.remove(e.model.root);e.model=spec.previous?f.previous:f.candidate;e.scene.add(e.model.root);
      document.querySelector('#overlay')?.remove();e.fitCamera(new Vector3(...(spec.direction??[0,0,10])));
      let camera=e.camera;const p=e.model.root.userData.source;
      if(spec.source){
        const h=Math.max(p.height,p.width*720/726)/p.scale,w=h*726/720,
          cx=(p.width/2-p.origin[0])/p.scale,cy=(p.origin[1]-p.height/2)/p.scale;
        camera=new OrthographicCamera(-w/2,w/2,h/2,-h/2,.01,100);camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();
      }
      if(spec.center){
        const h=spec.width*720/726;camera=new OrthographicCamera(-spec.width/2,spec.width/2,h/2,-h/2,.01,100);
        camera.position.copy(new Vector3(...spec.center)).add(new Vector3(0,0,10));camera.lookAt(...spec.center);camera.updateMatrixWorld();
      }
      e.renderer.render(e.scene,camera);
      if(spec.overlay){
        const img=document.createElement('img');img.id='overlay';img.src='/artifacts/reference/brown-087-detail.png';
        img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';
        document.querySelector('#stage').append(img);await img.decode();
      }
      document.querySelector('#title').textContent='087 · '+spec.name+' · '+(spec.previous?'previous 75 px pin hypothesis — proportion comparison only':'fixed stud orbit · maximum feature displacement 32 px · static study');
      return e.model.root.userData.state;
    },spec);
    const file=prefix+'-'+spec.name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file});
    let maximumStateDifference=null;
    if(!spec.previous){
      assert.deepEqual(Object.keys(state).sort(),Object.keys(report.state).sort());
      maximumStateDifference=0;
      for(const[key,value]of Object.entries(state)){
        const actual=Array.isArray(value)?value:[value],expected=Array.isArray(report.state[key])?report.state[key]:[report.state[key]];
        assert.equal(actual.length,expected.length);
        for(let i=0;i<actual.length;i++)maximumStateDifference=Math.max(maximumStateDifference,Math.abs(actual[i]-expected[i]));
      }
      // Chromium and Node can differ by an ULP in derived atan2 quantities.
      // Retain the measured discrepancy instead of requiring byte equality.
      assert(maximumStateDifference<1e-12);
    }
    views.push({...spec,state,maximumStateDifference,file,sha256:hashStudyFile(file),inspected:false});
  }
  verifyStudySources(sources);
  const known=[/^THREE.Clock: This module has been deprecated\./,/^THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated\./,/^\[.WebGL-.*GPU stall due to ReadPixels/],
    unexpectedWarnings=warnings.filter(w=>!known.some(r=>r.test(w)));
  fs.writeFileSync(prefix+'-captures.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
    sources,input,views,errors,warnings,unexpectedWarnings,
    qualification:'Eight source-pose views of the fixed-orbit candidate, including a registered engraving overlay and details, plus one explicitly historical 75-pixel overlay for proportional comparison. These are static geometry views; no animation, speed or full-motion clearance is qualified.'},null,2)+'\n',{flag:'wx'});
  console.log({views:views.length,errors,unexpectedWarnings});assert(!errors.length&&!unexpectedWarnings.length);
}finally{await browser.close();}
