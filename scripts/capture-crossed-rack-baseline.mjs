import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1500,height:800}}),captures=[],errors=[],sources=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5174/#/about');
 await page.evaluate(async()=>{
  const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json');
  document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative;min-height:0"></div><img id="source" src="/artifacts/reference/brown-080-detail.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>';
  await document.querySelector('#source').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[79],{playing:false});cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.crossedRackBaseline=e;
 });
 for(const [name,coordinate,direction]of [['source',.25,[0,0,10]],['first-limit',0,[0,0,10]],['second-limit',.5,[0,0,10]],['next-cycle',1.25,[0,0,10]],['oblique',.25,[-4,3,10]],['rear',.25,[4,3,-10]]]){
  const state=await page.evaluate(async({name,coordinate,direction})=>{
   const {Vector3}=await import('/node_modules/three/build/three.module.js'),e=window.crossedRackBaseline,g=e.model.root.userData.geometry,time=(coordinate-g.initialCyclePhase)/g.cyclesPerSecond;
   e.model.update(time);e.fitCamera(new Vector3(...direction));e.renderer.render(e.scene,e.camera);document.querySelector('#title').textContent='080 · original baseline · '+name;return e.model.root.userData.kinematics;
  },{name,coordinate,direction});
  const file=`artifacts/review/080-baseline-${name}.png`;await page.screenshot({path:file});captures.push({file,name,coordinate,direction,state,inspected:false,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
 }
 for(const file of ['scripts/capture-crossed-rack-baseline.mjs','src/simulation/authored-intermittent.js','src/simulation/engine.js','artifacts/reference/brown-080-detail.png']){
  const bytes=await readFile(file),archive=file.endsWith('.png')?file:`artifacts/review/080-baseline-capture-source-${sources.length}.txt`;if(archive!==file)await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 await writeFile('artifacts/review/080-baseline-captures.json',JSON.stringify({movement:80,status:'original-baseline-captures',productionChanged:false,mechanicsPassed:false,captures,errors,sources},null,2)+'\n',{flag:'wx'});console.log({captures:captures.length,errors});if(errors.length)process.exitCode=1;
}finally{await browser.close();}
