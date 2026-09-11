import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {visibleForegroundBounds,hasFrameMargin} from '../tests/helpers/rendered-frame.mjs';
const prefix=process.env.CAPTURE_PREFIX??'080-integrated',sources=[];
for(const file of ['scripts/capture-crossed-rack-integrated.mjs','src/simulation/engine.js','src/main.js','src/simulation/registry.js',
 'src/simulation/crossed-rack.js','src/simulation/crossed-rack-geometry.js','src/simulation/crossed-rack-motion.js',
 'src/data/crossed-rack-source.js','src/data/crossed-rack-profile.js','src/data/display-profiles.js','tests/helpers/rendered-frame.mjs']){
 const bytes=await readFile(file),archive=`artifacts/review/${prefix}-capture-source-${sources.length}.txt`;await writeFile(archive,bytes,{flag:'wx'});
 sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const browser=await chromium.launch({channel:'chrome',headless:true});let page=await browser.newPage({viewport:{width:1500,height:800}});
const captures=[],errors=[],checks={},framing={};page.on('pageerror',e=>errors.push(e.message));
const capture=async(view,data={})=>{
 const file=`artifacts/review/${prefix}-${view}.png`;await page.screenshot({path:file,fullPage:true});
 captures.push({file,view,...data,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),inspected:false});
};
try{
 await page.goto('http://127.0.0.1:5174/#/about');
 const timing=await page.evaluate(async()=>{
  const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json');
  document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative;min-height:0"></div><img id="source" src="/artifacts/reference/brown-080-detail.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>';
  await document.querySelector('#source').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[79],{playing:false});
  cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.integratedCrossedRack=e;return e.model.root.userData.animationTiming;
 });
 const poses=[['source',0,[0,0,10]],['source-aligned',0,[0,0,10]],['source-overlay',0,[0,0,10]],['startup',.059375,[0,0,10]],
  ['right-drive',1,[0,0,10]],['rollback',1.5,[0,0,10]],['left-drive',3,[0,0,10]],['next-cycle',4,[0,0,10]],
  ['input-stop',9,[0,0,10]],['final-hold',10,[0,0,10]],['later-hold',100,[0,0,10]],['oblique',5,[-4,3,10]],['rear',5,[4,3,-10]]];
 for(const [view,time,direction]of poses){
  const state=await page.evaluate(async({view,time,direction})=>{
   const {Vector3,OrthographicCamera}=await import('/node_modules/three/build/three.module.js'),e=window.integratedCrossedRack,u=e.model.root.userData,p=u.geometry;
   document.querySelector('#overlay')?.remove();e.model.update(time);e.fitCamera(new Vector3(...direction));e.renderer.render(e.scene,e.camera);
   if(view==='source-aligned'||view==='source-overlay'){
    const width=1320/p.scale,height=width*720/726,cx=(660-p.center[0])/p.scale,cy=(p.center[1]-645)/p.scale,
     camera=new OrthographicCamera(-width/2,width/2,height/2,-height/2,.01,100);camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();e.renderer.render(e.scene,camera);
    if(view==='source-overlay'){
     const image=document.createElement('img');image.id='overlay';image.src='/artifacts/reference/brown-080-detail.png';
     image.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.55;mix-blend-mode:multiply;pointer-events:none';
     document.querySelector('#stage').append(image);await image.decode();
    }
   }
   document.querySelector('#title').textContent=`080 · integrated model · ${view} · ${time.toFixed(4)} s`;return u.kinematics;
  },{view,time,direction});await capture(view,{time,direction,state});
 }
 await page.close();page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5174/#/about');
 await page.evaluate(async()=>{
  // Vite may load the app's engine with a hot-update query. Instrument that
  // exact module instance, preserving the original advance implementation.
  const entry=performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname==='/src/simulation/engine.js').at(-1);
  if(!entry)throw Error('App engine module was not loaded');
  const {MovementEngine}=await import(entry.name),advance=MovementEngine.prototype.advance;
  MovementEngine.prototype.advance=function(...args){window.reviewEngine=this;return advance.apply(this,args);};location.hash='#/movement/080';
 });
 const canvas=page.locator('canvas'),play=page.getByRole('button',{name:'Play',exact:true}),pause=page.getByRole('button',{name:'Pause',exact:true}),replay=page.getByRole('button',{name:'Replay',exact:true});
 await canvas.waitFor({state:'visible'});await play.waitFor({state:'visible'});await page.waitForFunction(()=>Boolean(window.reviewEngine),{},{timeout:5000});
 const initial=await canvas.screenshot();await page.waitForTimeout(200);checks.reducedMotionPaused=(await canvas.screenshot()).equals(initial);await capture('desktop-start');
 await page.getByLabel('Animation speed').selectOption('2');await play.click();await page.waitForTimeout(300);await pause.click();
 const paused=await canvas.screenshot();checks.playChangesFrame=!paused.equals(initial);await page.waitForTimeout(200);checks.pauseStable=(await canvas.screenshot()).equals(paused);
 await play.click();await replay.waitFor({state:'visible',timeout:60000});
 const finalState=await page.evaluate(()=>{const e=window.reviewEngine;return{elapsed:e.elapsed,playing:e.playing,ended:e.playbackEnded,
  state:e.model.root.userData.kinematics,fog:e.scene.fog,groundVisible:e.ground.visible};});
 checks.completedAtTenSeconds=finalState.elapsed===10&&finalState.ended&&!finalState.playing;
 checks.holdsRaisedRack=finalState.state.physicsTime===20&&Math.abs(finalState.state.rackY-0.8924311578471)<1e-12;
 checks.noFogOrGround=finalState.fog===null&&!finalState.groundVisible;
 const raised=await canvas.screenshot();await page.waitForTimeout(250);checks.finalPoseStable=(await canvas.screenshot()).equals(raised);
 await page.getByRole('button',{name:'Reset view',exact:true}).click();checks.resetViewRetainsFinalPose=(await canvas.screenshot()).equals(raised);
 framing.desktop=await visibleForegroundBounds(canvas);checks.desktopFramed=hasFrameMargin(framing.desktop);await capture('desktop-raised',{finalState});
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Reset view',exact:true}).click();await page.waitForTimeout(200);
 framing.mobile=await visibleForegroundBounds(canvas);checks.mobileFramed=hasFrameMargin(framing.mobile);
 checks.mobileNoHorizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);await capture('mobile-raised');
 await replay.click();await pause.waitFor({state:'visible'});await page.waitForTimeout(150);await pause.click();
 const restarted=await page.evaluate(()=>({elapsed:window.reviewEngine.elapsed,ended:window.reviewEngine.playbackEnded,state:window.reviewEngine.model.root.userData.kinematics}));
 checks.replayRestartsFiniteLift=restarted.elapsed<2&&!restarted.ended&&restarted.state.rackY<.3;
 await capture('mobile-replay',{restarted});checks.defaultPeriod=timing.displayCycleDuration===4;checks.noPageErrors=errors.length===0;
 await writeFile(`artifacts/review/${prefix}-captures.json`,JSON.stringify({movement:80,status:'integrated-registry-and-app-playback',timing,captures,checks,framing,errors,sources},null,2)+'\n',{flag:'wx'});
 console.log({views:captures.length,checks,timing});if(Object.values(checks).some(v=>v!==true))process.exitCode=1;
}finally{await browser.close();}
