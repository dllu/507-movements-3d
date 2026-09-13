import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createAuthoredIntermittentMovement} from '../src/simulation/authored-intermittent.js';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/088-production-rendered-framed',input='artifacts/review/088-production-edge-contact.json',report=readStudyReport(input),
  sources=freezeStudySources([...report.sources.map(s=>s.file),input,'scripts/capture-eccentric-two-stop-framed.mjs','src/simulation/engine.js','artifacts/review/088-production-source-fit.json','artifacts/review/088-production-source-fit.svg'],prefix),
  views=[],errors=[],warnings=[],nodeModel=createAuthoredIntermittentMovement({id:88}),browser=await chromium.launch({channel:'chrome',headless:true});
try{
  verifyStudySources(report.sources);const page=await browser.newPage({viewport:{width:1500,height:800}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text());});
  await page.route('**/__study_088',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><link rel="icon" href="data:,"><style>body{margin:0}.simulation-canvas{display:block;width:100%;height:100%}</style></head><body></body></html>'}));
  await page.goto('http://127.0.0.1:5174/__study_088',{waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>{
    const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json');
    document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:19px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px"></div><img src="/engravings/mm_088.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
    await document.querySelector('img').decode();
    const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[87],{playing:false});cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.eccentricTwoStop=e;
  });
  for(const spec of [{name:'front',time:0,direction:[0,0,10]},{name:'oblique',time:0,direction:[4,3,10]},
    {name:'drive',time:1.8,direction:[4,3,10]},{name:'dwell',time:5.5,direction:[4,3,10]}]){
    const state=await page.evaluate(async spec=>{
      const e=window.eccentricTwoStop;
      e.model.update(spec.time);e.updateGroundClearance();e.fitCamera(e.camera.position.clone().set(...spec.direction));e.renderer.render(e.scene,e.camera);
      document.querySelector('#title').textContent='088 · current production · '+spec.name;
      const bounds=e.renderer.domElement.getBoundingClientRect();if(Math.abs(bounds.width-726)>1||Math.abs(bounds.height-720)>1)throw Error('Unexpected canvas display bounds: '+JSON.stringify(bounds));
      const s=e.model.root.userData.kinematics;return{driverAngle:s.driverAngle,wheelAngle:s.wheelAngle,stage:s.stage};
    },spec),file=prefix+'-'+spec.name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file});nodeModel.update(spec.time);const expected=nodeModel.root.userData.kinematics;
    assert.equal(state.stage,expected.stage);const maximumStateDifference=Math.max(Math.abs(state.driverAngle-expected.driverAngle),Math.abs(state.wheelAngle-expected.wheelAngle));assert(maximumStateDifference<1e-12);
    views.push({...spec,file,sha256:hashStudyFile(file),state,maximumStateDifference});
  }
  await page.setViewportSize({width:780,height:590});
  await page.goto('http://127.0.0.1:5174/artifacts/review/088-production-source-fit.svg');
  const overlayFile=prefix+'-source-overlay.png';assert(!fs.existsSync(overlayFile));await page.screenshot({path:overlayFile});
  const sourceOverlay={file:overlayFile,sha256:hashStudyFile(overlayFile)};
  verifyStudySources(sources);
  const known=[/^THREE.Clock: This module has been deprecated\./,/^THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated\./,/^\[.WebGL-.*GPU stall due to ReadPixels/],
    unexpectedWarnings=warnings.filter(w=>!known.some(r=>r.test(w)));
  fs.writeFileSync(prefix+'-captures.json',JSON.stringify({movement:88,productionChanged:false,mechanicsPassed:false,sources,views,sourceOverlay,errors,warnings,unexpectedWarnings,
    qualification:'Four diagnostic stills of current production geometry beside its local source engraving. These captures are evidence for review, not corrected or accepted reconstruction.'},null,2)+'\n',{flag:'wx'});
  console.log({views:views.length,errors,unexpectedWarnings});assert(!errors.length&&!unexpectedWarnings.length);
}finally{await browser.close();}
