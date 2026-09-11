import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const prefix=process.env.PROBE_PREFIX??'079-shadow-refresh',browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1500,height:900}}),captures=[],errors=[],sources=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5174/artifacts/review/079-finer-preview-sized.html');await page.waitForFunction(()=>window.opposedPreview);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.evaluate(()=>{window.shadowStudyLights=window.opposedPreview.engine.scene.children.filter(l=>l.isDirectionalLight&&l.castShadow);});
 for(const [variant,bias,normalBias,enabled]of [['original',-.00003,.005,true],['unshadowed',0,0,false],['neutral',0,.002,true],['positive',.00001,.002,true]])for(const view of ['front','hub']){
  await page.evaluate(async({variant,bias,normalBias,enabled,view})=>{
   const {OrthographicCamera}=await import('/node_modules/three/build/three.module.js'),p=window.opposedPreview,e=p.engine;p.pause();
   e.renderer.shadowMap.enabled=enabled;e.renderer.shadowMap.needsUpdate=true;
   for(const light of window.shadowStudyLights){light.castShadow=enabled;light.shadow.bias=bias;light.shadow.normalBias=normalBias;}
   e.scene.traverse(object=>{for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[])material.needsUpdate=true;});
   p.setView('front');p.renderAt(0);if(view==='hub'){
    const box=document.querySelector('#stage').getBoundingClientRect(),height=.84*box.height/box.width,camera=new OrthographicCamera(-.42,.42,height/2,-height/2,.01,100);
    camera.position.set(0,0,10);camera.lookAt(0,0,0);camera.updateMatrixWorld();e.renderer.render(e.scene,camera);
   }
   document.querySelector('h1').textContent='079 · shadow study · '+variant+' · '+view;
  },{variant,bias,normalBias,enabled,view});
  const file=`artifacts/review/${prefix}-${variant}-${view}.png`;await page.screenshot({path:file});captures.push({file,variant,view,bias,normalBias,enabled,inspected:false,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
 }
 for(const file of ['scripts/capture-opposed-arm-shadow-study.mjs','scripts/lib/opposed-arm-candidate.mjs','scripts/lib/opposed-arm-preview.mjs','src/simulation/engine.js','artifacts/review/079-finer-preview-sized.html']){
  const bytes=await readFile(file),archive=`artifacts/review/${prefix}-render-source-${sources.length}.txt`;await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 await writeFile(`artifacts/review/${prefix}.json`,JSON.stringify({movement:79,status:'isolated-shadow-study',productionChanged:false,mechanicsPassed:false,captures,errors,sources,
  qualification:'Lighting-only variations on the unchanged candidate geometry, for inspection. No rendering configuration has been adopted by this script.'},null,2)+'\n',{flag:'wx'});
 console.log({captures:captures.length,errors});if(errors.length)process.exitCode=1;
}finally{await browser.close();}
