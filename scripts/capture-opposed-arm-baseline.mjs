import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {visibleForegroundBounds,hasFrameMargin} from '../tests/helpers/rendered-frame.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
let page=await browser.newPage({viewport:{width:1500,height:800}});
const captures=[],errors=[],checks={},framing={};
page.on('pageerror',e=>errors.push(e.message));
const capture=async(name,data={})=>{
 const file=`artifacts/review/079-baseline-${name}.png`;await page.screenshot({path:file,fullPage:true});
 captures.push({file,...data,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),inspected:false});
};
try{
 await page.goto('http://127.0.0.1:5174/#/about');
 const timing=await page.evaluate(async()=>{
  const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json');
  document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative;min-height:0"></div><img id="source" src="/artifacts/reference/brown-079-detail.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>';
  await document.querySelector('#source').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[78],{playing:false});
  cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.baselineOpposedArms=e;return e.model.root.userData.animationTiming;
 });
 const poses=[['source',0,null,[0,0,10]],['source-aligned',.32,null,[0,0,10]],['upper-drive',.4285714285714285,null,[0,0,10]],
 ['right-limit',1.3214285714285714,null,[0,0,10]],['lower-drive',2.214285714285714,null,[0,0,10]],['left-limit',3.107142857142857,null,[0,0,10]],['next-cycle',4,null,[0,0,10]],
 ['oblique',.32,null,[-4,3,10]],['rear',2.214285714285714,null,[4,3,-10]]];
 for(const [view,time,configuration,direction] of poses){
  const state=await page.evaluate(async({view,time,configuration,direction})=>{
   const {Vector3,OrthographicCamera}=await import('/node_modules/three/build/three.module.js'),e=window.baselineOpposedArms;
   e.model.update(time);e.fitCamera(new Vector3(...direction));e.renderer.render(e.scene,e.camera);
   if(view==='source-aligned'){
    const scale=404.7380751709192/2.02,width=1430/scale,height=width*720/726,cx=(715-406.8606816609294)/scale,cy=(777.8594285330751-690)/scale,
     camera=new OrthographicCamera(-width/2,width/2,height/2,-height/2,.01,100);
    camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();e.renderer.render(e.scene,camera);
   }
   document.querySelector('#title').textContent=`079 · original baseline · ${view} · ${time.toFixed(4)} s`;
   return e.model.root.userData.kinematics;
  },{view,time,configuration,direction});await capture(view,{view,time,configuration,direction,state});
 }
 const sources=[];for(const file of ['scripts/capture-opposed-arm-baseline.mjs','src/simulation/authored-intermittent.js','src/simulation/primitives.js','src/simulation/engine.js','artifacts/reference/brown-079-detail.png'])sources.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
 await writeFile('artifacts/review/079-baseline-captures.json',JSON.stringify({movement:79,status:'rejected-baseline-captures',productionChanged:false,mechanicsPassed:false,timing,captures,errors,sources},null,2)+'\n',{flag:'wx'});console.log({captures:captures.length,errors});if(errors.length)process.exitCode=1;
}finally{await browser.close();}
