import fs from 'node:fs';
import crypto from 'node:crypto';
import {chromium} from 'playwright';
const prefix=process.argv[2]??'082-first-candidate',hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),
 files=['scripts/lib/treadle-ratchet-candidate.mjs','scripts/lib/treadle-ratchet-linkage.mjs','scripts/lib/treadle-ratchet-source.mjs','scripts/capture-treadle-ratchet-candidate.mjs'],
 hashes=Object.fromEntries(files.map(f=>[f,hash(f)])),browser=await chromium.launch({channel:'chrome',headless:true}),
 page=await browser.newPage({viewport:{width:1500,height:800}}),views=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5174/#/about');
 await page.evaluate(async()=>{
  const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json'),
   {makeTreadleRatchetCandidate}=await import('/scripts/lib/treadle-ratchet-candidate.mjs');
  document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-082-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
  await document.querySelector('img').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[81],{playing:false});
  cancelAnimationFrame(e.animationFrame);e.animationFrame=0;e.scene.remove(e.model.root);
  e.model.root.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});
  e.model=makeTreadleRatchetCandidate();e.scene.add(e.model.root);e.updateGroundClearance();window.treadleCandidate=e;
 });
 for(const [name,direction] of [['source-aligned',[0,0,10]],['source-overlay',[0,0,10]],['oblique',[-4,3,10]],['rear',[4,3,-10]]]){
  await page.evaluate(async({name,direction})=>{
   const {Vector3,OrthographicCamera}=await import('/node_modules/three/build/three.module.js'),e=window.treadleCandidate;
   document.querySelector('#overlay')?.remove();e.fitCamera(new Vector3(...direction));let camera=e.camera;
   if(name.startsWith('source-')){
    const p=e.model.root.userData.geometry.source,h=Math.max(1250,1350*720/726)/p.scale,w=h*726/720,
     cx=(675-p.center[0])/p.scale,cy=(p.center[1]-625)/p.scale;
    camera=new OrthographicCamera(-w/2,w/2,h/2,-h/2,.01,100);camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();
   }
   e.renderer.render(e.scene,camera);
   if(name==='source-overlay'){
    const overlay=document.createElement('img');overlay.id='overlay';overlay.src='/artifacts/reference/brown-082-detail.png';
    overlay.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';document.querySelector('#stage').append(overlay);await overlay.decode();
   }
   document.querySelector('#title').textContent='082 · unverified geometry candidate · '+name;
  },{name,direction});
  const file='artifacts/review/'+prefix+'-'+name+'.png';if(fs.existsSync(file))throw Error('Existing capture '+file);
  await page.screenshot({path:file});views.push({file,name,sha256:hash(file),inspected:false});
 }
 for(const [f,h] of Object.entries(hashes))if(hash(f)!==h)throw Error('Source changed '+f);
 fs.writeFileSync('artifacts/review/'+prefix+'-captures.json',JSON.stringify({movement:82,mechanicsPassed:false,productionChanged:false,views,errors,hashes},null,2)+'\n',{flag:'wx'});
 console.log({views:views.length,errors});
}finally{await browser.close();}
