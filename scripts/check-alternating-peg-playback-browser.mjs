import {chromium} from 'playwright';import{readFile,writeFile,mkdir}from'node:fs/promises';import{createHash}from'node:crypto';
const prefix=process.env.CAPTURE_PREFIX||'077-long-lip-playback-browser',videoDirectory='artifacts/review/'+prefix+'-video';await mkdir(videoDirectory,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1500,height:800},recordVideo:{dir:videoDirectory,size:{width:1500,height:800}}}),page=await context.newPage(),errors=[],captures=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5174/artifacts/review/077-playback-preview.html');await page.waitForFunction(()=>window.alternatingPegPreview);
 const layout=await page.evaluate(()=>{const stage=document.querySelector('#stage').getBoundingClientRect(),source=document.querySelector('#source').getBoundingClientRect(),p=window.alternatingPegPreview;
  return{stageWidth:stage.width,stageHeight:stage.height,sourceWidth:source.width,sourceHeight:source.height,bufferHeight:p.e.renderer.domElement.height,defaultPeriod:document.querySelector('#period').value};});
 checks.push({kind:'layout',...layout});if(layout.stageHeight!==680||layout.bufferHeight>1360||layout.defaultPeriod!=='4')throw Error('Unexpected layout or default period');
 await page.evaluate(()=>window.alternatingPegPreview.setPlaying(true));await page.waitForTimeout(8250);await page.evaluate(()=>window.alternatingPegPreview.setPlaying(false));
 const metrics=await page.evaluate(()=>{const p=window.alternatingPegPreview,dt=p.frames.map(r=>r.dt).sort((a,b)=>a-b);return{frames:dt.length,elapsed:p.state.physicalTime/2,medianInterval:dt[Math.floor(dt.length/2)],p95Interval:dt[Math.floor(dt.length*.95)],maximumInterval:Math.max(...dt),state:p.state};});checks.push({kind:'live-playback',...metrics});
 for(const[view,time,direction]of[['source',0,'front'],['upper-drive',4.5,'front'],['lower-drive',6,'front'],['next-cycle',8.5,'front'],['oblique',6,'oblique']]){
  await page.selectOption('#view',direction);await page.evaluate(time=>window.alternatingPegPreview.setTime(time),time);
  const result=await page.evaluate(async()=>{const {Vector3}=await import('/node_modules/three/build/three.module.js'),p=window.alternatingPegPreview,e=p.e,escaped=[];
   for(const[name,mesh]of Object.entries(e.model.root.userData.parts)){const positions=mesh.geometry.getAttribute('position');
    for(let i=0;i<positions.count;i++){const v=new Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).project(e.camera);if(Math.abs(v.x)>1||Math.abs(v.y)>1||Math.abs(v.z)>1)escaped.push({name,vertex:i,point:v.toArray()});}}
   return{state:p.state,escaped};});if(result.escaped.length)throw Error('Clipped part: '+JSON.stringify(result.escaped[0]));
  const file='artifacts/review/'+prefix+'-'+view+'.png';await page.screenshot({path:file});captures.push({file,view,time,direction,...result,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),inspected:false});
 }
 await page.selectOption('#period','2');checks.push({kind:'period-control',state:await page.evaluate(()=>window.alternatingPegPreview.state)});
 await page.click('#reset');checks.push({kind:'reset',state:await page.evaluate(()=>window.alternatingPegPreview.state)});
 if(errors.length)throw Error(errors.join('\n'));await context.close();const video=await page.video().path(),files=['scripts/check-alternating-peg-playback-browser.mjs','artifacts/review/077-playback-preview.html','artifacts/review/077-long-lip-finer-preview-data.json','scripts/lib/alternating-peg-candidate.mjs'],sources=[];
 for(const file of files)sources.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
 const report={movement:77,status:'isolated-playback-browser-check',productionChanged:false,mechanicsPassed:false,displayPeriod:4,physicsPeriod:8,checks,captures,errors,video,sources,
  qualification:'Live two-cycle preview with a fixed camera, all actual mesh vertices checked for framing at five poses, and controls. Video is recorded, not automatically reviewed. This interpolation remains uncertified; production integration and regressions are outstanding.'};
 await writeFile('artifacts/review/'+prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({checks,errors,captures:captures.length,video});
}finally{await browser.close();}
