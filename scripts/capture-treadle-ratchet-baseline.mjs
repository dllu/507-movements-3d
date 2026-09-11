import fs from 'node:fs';
import crypto from 'node:crypto';
import {chromium} from 'playwright';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
 frozen=JSON.parse(fs.readFileSync('artifacts/review/081-production-source-hashes.json'));
for(const [file,h] of Object.entries(frozen))if(hash(file)!==h)throw Error('Changed input '+file);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1500,height:800}}),views=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5174/#/about');
 await page.evaluate(async()=>{
  const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json');
  document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-082-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
  await document.querySelector('img').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[81],{playing:false});
  cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.treadleBaseline=e;
 });
 for(const [name,phase,direction] of [['source',.12,[0,0,10]],['front-start',0,[0,0,10]],['front-mid',.25,[0,0,10]],
  ['handoff',.5,[0,0,10]],['rear-mid',.75,[0,0,10]],['cycle-end',.999,[0,0,10]],['oblique',.12,[4.2,3,10.6]],['rear',.12,[-4,3,-10]]]){
  const state=await page.evaluate(async({name,phase,direction})=>{
   const {Vector3}=await import('/node_modules/three/build/three.module.js'),e=window.treadleBaseline,g=e.model.root.userData.geometry;
   e.model.update((phase-g.initialCyclePhase)/g.cyclesPerSecond);e.fitCamera(new Vector3(...direction));e.renderer.render(e.scene,e.camera);
   document.querySelector('#title').textContent='082 · original baseline · '+name;return e.model.root.userData.kinematics;
  },{name,phase,direction});
  const file=`artifacts/review/082-baseline-${name}.png`;if(fs.existsSync(file))throw Error('Existing capture '+file);
  await page.screenshot({path:file});views.push({file,name,phase,state,sha256:hash(file),inspected:false});
 }
 for(const [file,h] of Object.entries(frozen))if(hash(file)!==h)throw Error('Changed input '+file);
 fs.writeFileSync('artifacts/review/082-baseline-captures.json',JSON.stringify({movement:82,views,errors,productionChanged:false,sourceCommit:'c13f7ec03ee2dd2d7c0ccb5b0b560373f14fa97e'},null,2)+'\n',{flag:'wx'});
 console.log({views:views.length,errors});if(errors.length)process.exitCode=1;
}finally{await browser.close();}
