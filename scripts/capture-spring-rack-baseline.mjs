import {chromium} from 'playwright';
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
 frozen=JSON.parse(fs.readFileSync('artifacts/review/080-verification-source-hashes.json'));
for(const [file,expected]of Object.entries(frozen))assert.equal(hash(file),expected,file);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1500,height:800}}),captures=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5174/#/about');
 await page.evaluate(async()=>{
  const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json');
  document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative;min-height:0"></div><img id="source" src="/artifacts/reference/brown-081-detail.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>';
  await document.querySelector('#source').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[80],{playing:false});cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.springRackBaseline=e;
 });
 for(const [name,coordinate,direction]of [['source',.1,[0,0,10]],['entry',.9375,[0,0,10]],['lift',.2,[0,0,10]],['release',1/3,[0,0,10]],
  ['overrun',.375,[0,0,10]],['return',.55,[0,0,10]],['dwell',.75,[0,0,10]],['oblique',.1,[-4,3,10]],['rear',.1,[4,3,-10]]]){
  const state=await page.evaluate(async({name,coordinate,direction})=>{
   const {Vector3}=await import('/node_modules/three/build/three.module.js'),e=window.springRackBaseline,g=e.model.root.userData.geometry,time=(coordinate-g.initialCyclePhase)/g.cyclesPerSecond;
   e.model.update(time);e.fitCamera(new Vector3(...direction));e.renderer.render(e.scene,e.camera);document.querySelector('#title').textContent='081 · original baseline · '+name;return e.model.root.userData.kinematics;
  },{name,coordinate,direction});
  const file=`artifacts/review/081-baseline-${name}.png`;assert(!fs.existsSync(file),file);await page.screenshot({path:file});captures.push({file,name,coordinate,direction,state,inspected:false,sha256:hash(file)});
 }
 const sources=['scripts/capture-spring-rack-baseline.mjs','src/simulation/authored-intermittent.js','src/simulation/engine.js','artifacts/reference/brown-081-detail.png'].map((file,i)=>{
  const archive=file.endsWith('.png')?file:`artifacts/review/081-baseline-capture-source-${i}.txt`;
  if(archive!==file)fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);return{file,archive,sha256:hash(file)};
 });
 for(const [file,expected]of Object.entries(frozen))assert.equal(hash(file),expected,file);
 fs.writeFileSync('artifacts/review/081-baseline-captures.json',JSON.stringify({movement:81,status:'original-baseline-captures',productionChanged:false,mechanicsPassed:false,captures,errors,sources},null,2)+'\n',{flag:'wx'});
 console.log({captures:captures.length,errors,frozenInputs:Object.keys(frozen).length});if(errors.length)process.exitCode=1;
}finally{await browser.close();}
