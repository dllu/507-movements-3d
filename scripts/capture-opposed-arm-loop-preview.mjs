import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const prefix=process.env.PROBE_PREFIX??'079-loop-prototype',browser=await chromium.launch({channel:'chrome',headless:true}),
 page=await browser.newPage({viewport:{width:1500,height:900}}),captures=[],errors=[],checks=[],sources=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`http://127.0.0.1:5174/artifacts/review/${prefix}.html`);await page.waitForFunction(()=>window.opposedLoopPreview);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const layout=await page.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect(),p=window.opposedLoopPreview;return{width:r.width,height:r.height,bufferHeight:p.e.renderer.domElement.height,period:p.period};});
 if(layout.height!==680||layout.bufferHeight!==1360||layout.period!==4)throw Error('Unexpected preview layout');checks.push({kind:'layout',...layout});
 await page.evaluate(()=>window.opposedLoopPreview.setPlaying(true));await page.waitForTimeout(8300);await page.evaluate(()=>window.opposedLoopPreview.setPlaying(false));
 const timing=await page.evaluate(()=>{const p=window.opposedLoopPreview,dt=p.frames.map(f=>f.dt).sort((a,b)=>a-b);return{frames:dt.length,elapsed:p.state.physicsTime*p.period/p.profile.physicsPeriod,
  medianInterval:dt[Math.floor(dt.length/2)],p95Interval:dt[Math.floor(dt.length*.95)],state:p.state};});
 if(timing.frames<40||Math.abs(timing.elapsed-8.3)>.3)throw Error('Live timing failed');checks.push({kind:'live-timing',...timing});
 const checkFraming=async()=>page.evaluate(async()=>{
  const {Vector3}=await import('/node_modules/three/build/three.module.js'),p=window.opposedLoopPreview,escaped=[];let vertices=0;
  for(const [name,mesh]of Object.entries(p.e.model.root.userData.parts)){
   const pos=mesh.geometry.attributes.position;for(let i=0;i<pos.count;i++){
    const point=new Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld).project(p.e.camera);vertices++;
    if(Math.abs(point.x)>1||Math.abs(point.y)>1||Math.abs(point.z)>1)escaped.push({name,vertex:i,point:point.toArray()});
   }
  }return{vertices,escaped,state:p.state};
 });
 for(const [name,time,view]of [['source',0,'front'],['right-limit',1,'front'],['lower-drive',2.1,'front'],['left-limit',3,'front'],['upper-drive',3.9,'front'],['oblique',6.1,'oblique'],['rear',6.1,'rear']]){
  await page.evaluate(({time,view})=>{const p=window.opposedLoopPreview;p.setView(view);p.setTime(time);},{time,view});
  const framing=await checkFraming();if(framing.escaped.length)throw Error('Clipped preview geometry: '+JSON.stringify(framing.escaped[0]));checks.push({kind:'framing',name,...framing});
  const file=`artifacts/review/${prefix}-${name}.png`;await page.screenshot({path:file,fullPage:true});captures.push({file,name,time,view,inspected:false,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
 }
 // Match the complete engraving crop, including object-fit letterboxing,
 // so this review view can be compared at the same scale and origin.
 const alignment=await page.evaluate(async()=>{
  const {OrthographicCamera}=await import('/node_modules/three/build/three.module.js'),p=window.opposedLoopPreview;
  p.setTime(0);p.setView('front');const g=p.e.model.root.userData.geometry,stage=document.querySelector('#stage'),r=stage.getBoundingClientRect(),
   scale=Math.min(r.width/1430,r.height/1380),width=r.width/(scale*g.scale),height=r.height/(scale*g.scale),
   cx=(715-g.center[0])/g.scale,cy=(g.center[1]-690)/g.scale,camera=new OrthographicCamera(-width/2,width/2,height/2,-height/2,.01,100);
  camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();p.e.renderer.render(p.e.scene,camera);
  const overlay=document.querySelector('#source').cloneNode();overlay.id='alignment-overlay';
  Object.assign(overlay.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'contain',opacity:'0',pointerEvents:'none',mixBlendMode:'multiply'});
  stage.append(overlay);await overlay.decode();return{width,height,cx,cy,sourcePixelsPerScreenPixel:1/scale};
 });
 for(const [name,opacity]of [['source-aligned','0'],['source-overlay','.55']]){
  await page.evaluate(value=>document.querySelector('#alignment-overlay').style.opacity=value,opacity);
  const file=`artifacts/review/${prefix}-${name}.png`;await page.screenshot({path:file,fullPage:true});
  captures.push({file,name,time:0,view:'source-aligned',alignment,overlayOpacity:Number(opacity),inspected:false,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
 }
 await page.evaluate(()=>{document.querySelector('#alignment-overlay').remove();window.opposedLoopPreview.setView('front');});
 const period=await page.evaluate(()=>{const p=window.opposedLoopPreview,before=p.state;p.setPeriod(2);return{before,after:p.state};});
 for(const key of ['theta','upperBeta','lowerBeta','sliderX'])if(Math.abs(period.before[key]-period.after[key])>1e-12)throw Error('Changing speed changed pose');checks.push({kind:'period-control',...period});
 await page.click('#restart');if((await page.evaluate(()=>window.opposedLoopPreview.state.physicsTime))!==0)throw Error('Restart failed');
 await page.evaluate(()=>window.opposedLoopPreview.setPeriod(4));await page.setViewportSize({width:390,height:1000});await page.waitForTimeout(100);
 await page.evaluate(()=>{const p=window.opposedLoopPreview;p.setView('front');p.setTime(5);});const framing=await checkFraming(),mobile=await page.evaluate(()=>{
  const r=document.querySelector('#stage').getBoundingClientRect();return{width:r.width,height:r.height,overflow:document.documentElement.scrollWidth>innerWidth};
 });if(framing.escaped.length||mobile.overflow||mobile.height!==420)throw Error('Mobile framing/layout failed');checks.push({kind:'mobile',...mobile,...framing});
 const file=`artifacts/review/${prefix}-mobile.png`;await page.screenshot({path:file,fullPage:true});captures.push({file,name:'mobile',time:5,view:'front',inspected:false,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
 for(const file of ['scripts/capture-opposed-arm-loop-preview.mjs','scripts/lib/opposed-arm-loop-preview.mjs','scripts/lib/opposed-arm-playback.mjs','scripts/lib/opposed-arm-view-bounds.mjs',
  'scripts/lib/opposed-arm-candidate.mjs',`artifacts/review/${prefix}.html`]){
  const bytes=await readFile(file),archive=`artifacts/review/${prefix}-capture-source-${sources.length}.txt`;await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 const report={movement:79,status:'loop-preview-browser-study',productionChanged:false,mechanicsPassed:false,captures,checks,errors,sources,
  qualification:'Live repeating playback, speed/restart controls, and complete actual-vertex framing checks at desktop and mobile sizes. The source trajectory requires separate mechanical clearance qualification. Stills await inspection; no video was recorded or watched.'};
 await writeFile(`artifacts/review/${prefix}-browser.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({captures:captures.length,errors,layout,timing,checks:checks.length});if(errors.length)process.exitCode=1;
}finally{await browser.close();}
