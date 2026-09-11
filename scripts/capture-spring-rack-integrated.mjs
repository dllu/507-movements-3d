import fs from 'node:fs';
import {chromium} from 'playwright';
const prefix=process.argv[2]??'081-integrated-final',browser=await chromium.launch({channel:'chrome',headless:true}),
 page=await browser.newPage({viewport:{width:1500,height:800}}),errors=[],views=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5174/#/about');
 await page.evaluate(async()=>{
  const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json');
  document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-081-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
  await document.querySelector('img').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[80],{playing:false});
  cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.springRackEngine=e;
 });
 const timing=await page.evaluate(()=>new Promise(resolve=>{
  const e=window.springRackEngine,frames=[];let first,last;
  const frame=now=>{
   first??=now;const time=(now-first)/1000,start=performance.now();e.model.update(time);const updateMs=performance.now()-start;
   e.renderer.render(e.scene,e.camera);frames.push({time,intervalMs:last===undefined?0:now-last,updateMs});last=now;
   document.querySelector('#title').textContent='081 · integrated playback · '+time.toFixed(2)+' s';
   if(time<12.1)requestAnimationFrame(frame);else resolve({duration:time,frames});
  };requestAnimationFrame(frame);
 }));
 const poses=[['source',0,[0,0,10]],['source-aligned',0,[0,0,10]],['entry',2.986,[0,0,10]],['lift',4,[0,0,10]],
  ['release',4.868,[0,0,10]],['compressed',4.978,[0,0,10]],['return',5.4,[0,0,10]],['dwell',6,[0,0,10]],
  ['oblique',4.978,[-4,3,10]],['rear',6,[4,3,-10]],['repeat',12,[0,0,10]]];
 for(const [name,time,direction] of poses){
  const state=await page.evaluate(async({name,time,direction})=>{
   const {Vector3,OrthographicCamera}=await import('/node_modules/three/build/three.module.js'),e=window.springRackEngine;
   e.model.update(time);e.fitCamera(new Vector3(...direction));let camera=e.camera;
   if(name==='source-aligned'){
    const p=e.model.root.userData.geometry,scale=p.source.scale,h=1300/scale,w=h*726/720,cx=(640-p.source.center[0])/scale,cy=(p.source.center[1]-650)/scale;
    camera=new OrthographicCamera(-w/2,w/2,h/2,-h/2,.01,100);camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();
   }
   e.renderer.render(e.scene,camera);document.querySelector('#title').textContent='081 · integrated model · '+name+' · '+time+' s';
   const s=e.model.root.userData.kinematics;return{rackY:s.rackY,q:s.q,spring:s.spring};
  },{name,time,direction});
  const file=`artifacts/review/${prefix}-${name}.png`;await page.screenshot({path:file});views.push({file,name,time,state,inspected:false});
 }
 // Reload the app after replacing its DOM for the source comparison. A hash
 // change alone leaves the router attached to the removed application root.
 await page.goto('http://127.0.0.1:5174/?review=081#/movement/081');await page.locator('canvas').waitFor({state:'visible'});
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  await page.setViewportSize(viewport);await page.getByRole('button',{name:'Reset view',exact:true}).click();await page.waitForTimeout(200);
  const file=`artifacts/review/${prefix}-${name}.png`;await page.screenshot({path:file,fullPage:true});views.push({file,name,inspected:false});
 }
 const updates=timing.frames.map(f=>f.updateMs).sort((a,b)=>a-b),summary={duration:timing.duration,frames:timing.frames.length,
  fps:(timing.frames.length-1)/timing.duration,p95UpdateMs:updates[Math.floor(updates.length*.95)]};
 fs.writeFileSync('artifacts/review/'+prefix+'-captures.json',JSON.stringify({movement:81,summary,views,errors},null,2)+'\n');
 console.log({summary,views:views.length,errors});if(errors.length)process.exitCode=1;
}finally{await browser.close();}
