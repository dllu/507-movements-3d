import{chromium}from'playwright';import{readFile,writeFile,mkdir}from'node:fs/promises';import{createHash}from'node:crypto';
const prefix=process.env.CAPTURE_PREFIX??'076-playback-browser',videoDirectory='artifacts/review/'+prefix+'-video';await mkdir(videoDirectory,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1500,height:800},recordVideo:{dir:videoDirectory,size:{width:1500,height:800}}}),page=await context.newPage(),errors=[],captures=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5174/artifacts/review/076-playback-preview.html');await page.waitForFunction(()=>window.jointedTappetPreview);
 const layout=await page.evaluate(()=>{const s=document.querySelector('#stage').getBoundingClientRect(),i=document.querySelector('#source').getBoundingClientRect(),c=window.jointedTappetPreview.e.renderer.domElement;return{stageWidth:s.width,stageHeight:s.height,sourceWidth:i.width,sourceHeight:i.height,bufferWidth:c.width,bufferHeight:c.height};});
 checks.push({kind:'layout',...layout});if(layout.stageHeight!==680||layout.sourceHeight!==680||layout.bufferHeight>1360)throw new Error('Unexpected preview surface dimensions');
 await page.evaluate(()=>window.jointedTappetPreview.setPlaying(true));
 await page.waitForTimeout(12500);await page.evaluate(()=>window.jointedTappetPreview.setPlaying(false));
 const metrics=await page.evaluate(()=>{const p=window.jointedTappetPreview,dt=p.frames.map(r=>r.dt).sort((a,b)=>a-b);return{frames:dt.length,elapsed:p.state.physicsTime/2,medianInterval:dt[Math.floor(dt.length/2)],p95Interval:dt[Math.floor(dt.length*.95)],maximumInterval:Math.max(...dt),state:p.state};});checks.push({kind:'live-playback',...metrics});
 for(const[view,time,configuration]of [['source',0,'section'],['drive',.53,'section'],['folded',3.26525,'section'],['second-cycle',12.53,'section'],['complete',6,'complete']]){
  await page.selectOption('#configuration',configuration);await page.evaluate(time=>window.jointedTappetPreview.setTime(time),time);
  const state=await page.evaluate(()=>window.jointedTappetPreview.state),file='artifacts/review/'+prefix+'-'+view+'.png';await page.screenshot({path:file});captures.push({file,view,time,configuration,state,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),inspected:false});
 }
 await page.selectOption('#period','8');checks.push({kind:'period-control',state:await page.evaluate(()=>window.jointedTappetPreview.state)});
 await page.click('#reset');checks.push({kind:'reset',state:await page.evaluate(()=>window.jointedTappetPreview.state)});
 if(errors.length)throw new Error(errors.join('\n'));await context.close();const video=await page.video().path();
 const report={movement:76,status:'isolated-playback-browser-check',productionChanged:false,mechanicsPassed:false,period:12,checks,captures,errors,video,qualification:'Live default-clock run plus source, drive, folded, second-cycle and complete views. Video is recorded for review; no claim that it was watched is implied. Production integration and final regression checks remain.'};
 await writeFile('artifacts/review/'+prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({checks,errors,video,captures:captures.length});
}finally{await browser.close();}
