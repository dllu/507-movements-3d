import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const prefix=process.env.PROBE_PREFIX??'079-finer-preview-sized',browser=await chromium.launch({channel:'chrome',headless:true}),
 page=await browser.newPage({viewport:{width:1500,height:850}}),captures=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`http://127.0.0.1:5174/artifacts/review/${prefix}.html`);await page.waitForFunction(()=>window.opposedPreview);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const layout=await page.evaluate(()=>Object.fromEntries(['#stage','.simulation-canvas','#source'].map(selector=>{
  const r=document.querySelector(selector).getBoundingClientRect();return[selector,{x:r.x,y:r.y,width:r.width,height:r.height}];
 })));
 if(Object.values(layout).some(r=>r.width<300||r.height<300||r.x+r.width>1500||r.y+r.height>850)||Math.abs(layout['#stage'].width-layout['.simulation-canvas'].width)>1)throw Error('Preview layout failed: '+JSON.stringify(layout));
 for(const [name,time,view]of [['source',0,'front'],['initial-seat',.10925,'lower'],['return-crest',.83475,'lower'],['lower-drive',4.20125,'lower'],
  ['upper-drive',7.75025,'upper'],['steady-start',8,'front'],['steady-oblique',12.20125,'oblique'],['steady-end',16,'front']]){
  const state=await page.evaluate(({time,view})=>{const p=window.opposedPreview;p.pause();p.setView(view);return p.renderAt(time);},{time,view}),
   file=`artifacts/review/${prefix}-${name}.png`;
  await page.screenshot({path:file});captures.push({file,name,time,view,state,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),inspected:false});
 }
 await page.evaluate(()=>{const p=window.opposedPreview;p.setView('front');p.renderAt(8);p.play();});
 await page.waitForFunction(()=>window.opposedPreview.metrics().completed,{},{timeout:20000});
 const timing=await page.evaluate(()=>window.opposedPreview.metrics()),sources=[];
 for(const file of ['scripts/capture-opposed-arm-preview.mjs','scripts/lib/opposed-arm-preview.mjs','scripts/lib/opposed-arm-candidate.mjs',`artifacts/review/${prefix}.json`,`artifacts/review/${prefix}.html`]){
  const bytes=await readFile(file),archive=`artifacts/review/${prefix}-capture-geometry-source-${sources.length}.txt`;await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 const elapsed=(timing.completed.wall-timing.started.wall)/1000,expected=(timing.completed.time-timing.started.time)/timing.rate,renderedFrames=timing.completed.frames-timing.started.frames;
 if(errors.length||Math.abs(elapsed-expected)>.2||renderedFrames<20)throw Error('Preview timing or rendering failed: '+JSON.stringify({errors,elapsed,expected,renderedFrames}));
 await writeFile(`artifacts/review/${prefix}-captures.json`,JSON.stringify({movement:79,status:'isolated-preview-rendered',productionChanged:false,mechanicsPassed:false,captures,errors,layout,timing:{...timing,elapsed,expected,renderedFrames},sources,
  qualification:'Eight inspected-pending stills and a timed playback run. No video was recorded or watched. Continuous contact and final production behavior need separate verification.'},null,2)+'\n',{flag:'wx'});
 console.log({captures:captures.length,errors,elapsed,expected,renderedFrames});
}finally{await browser.close();}
