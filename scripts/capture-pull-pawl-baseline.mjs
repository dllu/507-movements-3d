import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {visibleForegroundBounds,hasFrameMargin} from '../tests/helpers/rendered-frame.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
let page=await browser.newPage({viewport:{width:1500,height:800}});
const captures=[],errors=[],checks={},framing={};
page.on('pageerror',e=>errors.push(e.message));
const capture=async(name,data={})=>{
 const file=`artifacts/review/078-baseline-${name}.png`;await page.screenshot({path:file,fullPage:true});
 captures.push({file,...data,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),inspected:false});
};
try{
 await page.goto('http://127.0.0.1:5174/#/about');
 const timing=await page.evaluate(async()=>{
  const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json');
  document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative;min-height:0"></div><img id="source" src="/artifacts/reference/brown-078-detail.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>';
  await document.querySelector('#source').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[77],{playing:false});
  cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.baselinePullPawl=e;return e.model.root.userData.animationTiming;
 });
 const poses=[['source',0,null,[0,0,10]],['source-aligned',.34375,null,[0,0,10]],['right-pull',.125,null,[0,0,10]],
 ['handoff',1.125,null,[0,0,10]],['left-pull',1.6875,null,[0,0,10]],['right-return',2.21875,null,[0,0,10]],['next-cycle',3.25,null,[0,0,10]],
 ['oblique',.34375,null,[-4,3,10]],['rear',1.6875,null,[4,3,-10]]];
 for(const [view,time,configuration,direction] of poses){
  const state=await page.evaluate(async({view,time,configuration,direction})=>{
   const {Vector3,OrthographicCamera}=await import('/node_modules/three/build/three.module.js'),e=window.baselinePullPawl;
   e.model.update(time);e.fitCamera(new Vector3(...direction));e.renderer.render(e.scene,e.camera);
   if(view==='source-aligned'){
    const scale=379.2944180983833/1.91,height=1300/scale,width=height*726/720,cx=(635-590.1847816329412)/scale,cy=(748.5887383490219-650)/scale,
     camera=new OrthographicCamera(-width/2,width/2,height/2,-height/2,.01,100);
    camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();e.renderer.render(e.scene,camera);
   }
   document.querySelector('#title').textContent=`078 · original baseline · ${view} · ${time.toFixed(4)} s`;
   return e.model.root.userData.kinematics;
  },{view,time,configuration,direction});await capture(view,{view,time,configuration,direction,state});
 }
 const sources=[];for(const file of ['scripts/capture-pull-pawl-baseline.mjs','src/simulation/authored-intermittent.js','src/simulation/primitives.js','src/simulation/engine.js','artifacts/reference/brown-078-detail.png'])sources.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
 await writeFile('artifacts/review/078-baseline-captures.json',JSON.stringify({movement:78,status:'rejected-baseline-captures',productionChanged:false,mechanicsPassed:false,timing,captures,errors,sources},null,2)+'\n',{flag:'wx'});console.log({captures:captures.length,errors});if(errors.length)process.exitCode=1;
}finally{await browser.close();}
