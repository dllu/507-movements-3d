import fs from 'node:fs';
import {chromium} from 'playwright';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/082-mujoco-browser-v1',errors=[],consoleMessages=[];
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{consoleMessages.push({type:m.type(),text:m.text()});if(m.type()==='error')errors.push(m.text());});
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto((process.env.PROBE_BASE_URL??'http://127.0.0.1:5175')+'/mujoco-082.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.mujoco082,{timeout:45000});
 await page.evaluate(()=>{window.mujoco082.renderer.domElement.addEventListener('webglcontextlost',()=>{window.lostContext=true;});});
 const views=[];
 for(const [name,time,oblique]of [['source',0,false],['quarter',1,false],['half',2,false],['oblique',3,true],['end',12,false]]){
  const state=await page.evaluate(({time,oblique})=>{const v=window.mujoco082;v.setPlaying(false);v.model.reset();v.model.advance(time);v.fit(new v.THREE.Vector3(...(oblique?[-3,2,9]:[0,0,10])));v.renderer.render(v.scene,v.camera);return v.model.root.userData.kinematics;},{time,oblique});
  await page.waitForTimeout(80);if(await page.evaluate(()=>window.lostContext||window.mujoco082.renderer.getContext().isContextLost()))throw Error('WebGL context lost');const file=prefix+'-'+name+'.png';await page.screenshot({path:file,fullPage:true});views.push({name,time,file,state});
 }
 await page.evaluate(()=>{window.mujoco082.model.reset();window.mujoco082.setPlaying(true);});
 for(const [name,time]of [['lower-detail',2.6],['upper-detail',.8],['pulley-detail',1.2]]){
  await page.evaluate(({name,time})=>{const v=window.mujoco082;v.setPlaying(false);v.model.reset();v.model.advance(time);
   const {Vector3}=v.THREE,u=v.model.root.userData,part=u.parts[name.startsWith('lower')?'lowerPawlBody':name.startsWith('upper')?'upperPawlBody':'pulleyBody'];
   const center=part.getWorldPosition(new Vector3());if(name.includes('detail')&&!name.startsWith('pulley'))center.add(new Vector3(-.16,.19,0));
   v.controls.target.copy(center);v.camera.position.copy(center).add(new Vector3(-2,1,8));const half=name.startsWith('pulley')?.45:.48;
   v.camera.left=-half*v.renderer.domElement.clientWidth/v.renderer.domElement.clientHeight;v.camera.right=-v.camera.left;v.camera.top=half;v.camera.bottom=-half;v.camera.updateProjectionMatrix();v.controls.update();v.renderer.render(v.scene,v.camera);
  },{name,time});await page.waitForTimeout(80);if(await page.evaluate(()=>window.lostContext||window.mujoco082.renderer.getContext().isContextLost()))throw Error('WebGL context lost');const file=prefix+'-'+name+'.png';await page.screenshot({path:file,fullPage:true});views.push({name,time,file});
 }
 await page.evaluate(()=>{const v=window.mujoco082;v.fit(new v.THREE.Vector3(-3,2,9));v.model.reset();v.setPlaying(true);const original=v.model.advance;v.updateTimes=[];v.model.advance=dt=>{const start=performance.now(),steps=original(dt);v.updateTimes.push(performance.now()-start);return steps;};});
 const runtime=await page.evaluate(()=>new Promise(resolve=>{let start,last;const frames=[];function tick(now){start??=now;frames.push({wall:(now-start)/1000,interval:last===undefined?0:now-last,physical:window.mujoco082.model.physics.data.time});last=now;if(now-start<8200)requestAnimationFrame(tick);else {window.mujoco082.setPlaying(false);resolve(frames);}}requestAnimationFrame(tick);}));
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);await page.screenshot({path:prefix+'-mobile.png',fullPage:true});
 const performance=await page.evaluate(()=>{const v=window.mujoco082,gl=v.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {updates:v.updateTimes,renderer:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER)};});
 fs.writeFileSync(prefix+'.json',JSON.stringify({errors,consoleMessages,views,runtime,performance},null,2)+'\n');console.log({errors,views:views.length,frames:runtime.length,duration:runtime.at(-1)});
 if(errors.length)process.exitCode=1;
} finally {await browser.close();}
