import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-baseline',frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json');
const verify=()=>{for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);};verify();
const sources=freezeStudySources(['scripts/capture-pump-catch-baseline.mjs','src/simulation/authored-intermittent.js','src/simulation/registry.js',
  'src/simulation/engine.js','src/data/movements.json','src/simulation/primitives.js','scripts/lib/study-report-io.mjs','artifacts/reference/brown-086-detail.png'],prefix);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1500,height:800}}),errors=[],warnings=[],views=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text());});
try{
  await page.goto('http://127.0.0.1:5174/#/about');
  await page.evaluate(async()=>{
    const{MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json');
    document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-086-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
    await document.querySelector('img').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[85],{playing:false});
    cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.pumpBaseline=e;
  });
  for(const[name,phase,direction]of [['initial',.23,[3.6,2.8,11.8]],['front',.12,[0,0,10]],['waiting',.05,[0,0,10]],
    ['lift',.23,[0,0,10]],['trip-entry',.34,[0,0,10]],['trip-midpoint',.365,[0,0,10]],['release',.39,[0,0,10]],
    ['return',.50,[0,0,10]],['rest',.68,[0,0,10]],['rear',.12,[-4,3,-10]]]){
    const state=await page.evaluate(({name,phase,direction})=>{
      const e=window.pumpBaseline,Vector3=e.camera.position.constructor,g=e.model.root.userData.geometry,time=(phase-g.initialCyclePhase)*g.cyclePeriod;
      e.model.update(time);e.fitCamera(new Vector3(...direction));e.renderer.render(e.scene,e.camera);
      document.querySelector('#title').textContent='086 · existing baseline · '+name;return{time,kinematics:e.model.root.userData.kinematics};
    },{name,phase,direction});
    const file=prefix+'-'+name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file});views.push({name,phase,file,...state,sha256:hashStudyFile(file),inspected:false});
  }
  verify();verifyStudySources(sources);const known=[/^THREE.Clock: This module has been deprecated\./,/^THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated\./,/^\[.WebGL-.*GPU stall due to ReadPixels/];
  const unexpectedWarnings=warnings.filter(w=>!known.some(r=>r.test(w)));
  fs.writeFileSync(prefix+'-captures.json',JSON.stringify({movement:86,productionChanged:false,mechanicsPassed:false,views,errors,warnings,unexpectedWarnings,sources,frozenProductionInputsMatched:Object.keys(frozen).length},null,2)+'\n',{flag:'wx'});
  console.log({views:views.length,errors,unexpectedWarnings});assert(!errors.length&&!unexpectedWarnings.length);
}finally{await browser.close();}
