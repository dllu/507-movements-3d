import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-before-reconstruction',frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json'),
  verify=()=>{for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);};verify();
const sources=freezeStudySources(['scripts/capture-reversing-clutch-baseline.mjs','src/simulation/authored-gears.js','src/simulation/engine.js',
  'src/simulation/registry.js','public/engravings/mm_087.png'],prefix),browser=await chromium.launch({channel:'chrome',headless:true}),
  page=await browser.newPage({viewport:{width:1500,height:800}}),views=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto('http://127.0.0.1:5174/#/about');
  const geometry=await page.evaluate(async()=>{
    const{MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json');
    document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/engravings/mm_087.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
    await document.querySelector('img').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[86],{playing:false});
    cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.reversingBaseline=e;
    const u=e.model.root.userData;return{inputAxis:u.geometry.inputAxis.toArray(),eAxis:u.geometry.eAxis.toArray(),
      leftAxis:u.geometry.leftAxis.toArray(),rightAxis:u.geometry.rightAxis.toArray(),cameraDirection:e.model.cameraDirection?.toArray()};
  });
  for(const[name,direction]of [['default',null],['front',[0,0,10]],['oblique',[5,3,9]]]){
    await page.evaluate(async({name,direction})=>{
      const THREE=await import('/node_modules/three/build/three.module.js'),e=window.reversingBaseline;e.model.update(0);
      e.fitCamera(direction?new THREE.Vector3(...direction):e.model.cameraDirection);e.renderer.render(e.scene,e.camera);
      document.querySelector('#title').textContent='087 · existing production baseline · '+name;
    },{name,direction});
    const file=prefix+'-'+name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file});views.push({name,file,sha256:hashStudyFile(file),inspected:false});
  }
  verify();verifyStudySources(sources);assert(!errors.length);
  fs.writeFileSync(prefix+'-captures.json',JSON.stringify({movement:87,status:'unreviewed-production-source-view-baseline',geometry,views,errors,sources,
    productionChanged:false,mechanicsPassed:false,qualification:'Three static source-comparison views of the unchanged existing production model. No contact or performance qualification is implied.'},null,2)+'\n',{flag:'wx'});
  console.log({views:views.length,geometry,errors});
}finally{await browser.close();}
