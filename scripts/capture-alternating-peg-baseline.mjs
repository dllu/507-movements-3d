import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1500,height:800}}),errors=[],captures=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5174/#/about');
 const initial=await page.evaluate(async()=>{
  const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json');
  document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative;min-height:0"></div><img id="source" src="/artifacts/reference/brown-077-detail.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>';
  await document.querySelector('#source').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[76],{playing:false});cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.pegBaseline=e;
  return{geometry:e.model.root.userData.geometry,timing:e.model.root.userData.animationTiming,cameraDirection:e.model.cameraDirection.toArray()};
 });
 const poses=[['initial',.16,null],['source-plane',.25,[0,0,10]],['source-aligned',.25,[0,0,10]],['upper-drive',.1,[0,0,10]],['lower-drive',.65,[0,0,10]],['upper-return',.87,[0,0,10]],['lower-pin-intrusion',.11979166666666667,[0,0,10]],['oblique',.3,[-4,3,10]],['rear',.11979166666666667,[4,3,-10]]];
 for(const[view,phase,direction]of poses){
  const state=await page.evaluate(async({view,phase,direction})=>{
   const{Vector3,OrthographicCamera}=await import('/node_modules/three/build/three.module.js'),e=window.pegBaseline,p=e.model.root.userData.geometry;
   e.model.update((phase-p.initialCyclePhase)/p.cyclesPerSecond);e.model.root.updateMatrixWorld(true);e.fitCamera(direction?new Vector3(...direction):e.model.cameraDirection);e.renderer.render(e.scene,e.camera);
   if(view==='source-aligned'){
    const scale=433.5789672975984/2.02,height=1300/scale,width=height*726/720,cx=(650-456.9848887445678)/scale,cy=(837.6559823723948-650)/scale,camera=new OrthographicCamera(-width/2,width/2,height/2,-height/2,.01,100);
    camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();e.renderer.render(e.scene,camera);
   }
   document.querySelector('#title').textContent=`077 · original model · ${view} · phase ${phase.toFixed(5)}`;return e.model.root.userData.kinematics;
  },{view,phase,direction});
  const file=`artifacts/review/077-baseline-${view}.png`;await page.screenshot({path:file,fullPage:true});captures.push({file,view,phase,direction,state,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),inspected:false});
 }
 const sources=[];for(const file of ['scripts/capture-alternating-peg-baseline.mjs','src/simulation/authored-intermittent.js','src/simulation/engine.js','artifacts/reference/brown-077-detail.png'])sources.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
 await writeFile('artifacts/review/077-baseline-captures.json',JSON.stringify({movement:77,status:'original-model-baseline-captures',productionChanged:false,mechanicsPassed:false,initial,captures,errors,sources},null,2)+'\n',{flag:'wx'});console.log({captures:captures.length,errors});if(errors.length)process.exitCode=1;
}finally{await browser.close();}
