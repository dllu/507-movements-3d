import { chromium } from 'playwright';
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1500,height:800},reducedMotion:'reduce'});
const errors=[],captures=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto('http://127.0.0.1:5174/#/about');
  const p=await page.evaluate(async()=>{
    const {MovementEngine}=await import('/src/simulation/engine.js');
    const {default:catalog}=await import('/src/data/movements.json');
    const {makeOpenRimTappetCandidate}=await import('/scripts/lib/open-rim-tappet-candidate.mjs');
    document.body.innerHTML=`<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px">070 · Open-rim tappet candidate</div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-070-detail.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>`;
    const engine=new MovementEngine(document.querySelector('#stage'),catalog.movements[69],{playing:false});
    engine.scene.remove(engine.model.root);engine.model=makeOpenRimTappetCandidate();engine.scene.add(engine.model.root);
    for(const light of engine.scene.children.filter(light=>light.isDirectionalLight&&light.castShadow)){
      const extent=engine.model.root.userData.shadowCameraHalfExtent;
      Object.assign(light.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent});light.shadow.camera.updateProjectionMatrix();
      light.shadow.bias=engine.model.root.userData.shadowBias;light.shadow.normalBias=engine.model.root.userData.shadowNormalBias;
    }
    engine.updateGroundClearance();window.candidate=engine;return engine.model.root.userData.geometry;
  });
  const phases=[['source',[0,0,10],p.initialInputPhase,false],['section',[0,0,10],p.initialInputPhase,true],
    ['oblique',[-4,3,10],p.initialInputPhase,true],['rear',[4,3,-10],p.initialInputPhase,false],
    ['entry',[0,0,10],p.entryAngle,true],['first-corner',[0,0,10],p.firstCornerAngle,true],
    ['tip-side',[0,0,10],p.tipSideAngle,true],['release',[0,0,10],p.releaseAngle,true],
    ['rim-entry',[0,0,10],p.rimEntryAngle,true],['locked',[0,0,10],p.exitAngle+.1,true]];
  for(const[view,direction,angle,section]of phases){
    const time=angle-p.initialInputPhase;
    await page.evaluate(async({view,direction,time,section})=>{
      const{Vector3}=await import('/node_modules/three/build/three.module.js');const e=window.candidate;
      e.model.root.userData.setSectionView(section);e.model.update(time);e.model.root.updateMatrixWorld(true);
      e.fitCamera(new Vector3(...direction));e.renderer.render(e.scene,e.camera);
      document.querySelector('#title').textContent=`070 · ${view} · ${time.toFixed(5)} authored seconds`;
    },{view,direction,time,section});
    const file=`artifacts/review/070-refined-candidate-${view}.png`;await page.screenshot({path:file});
    captures.push({file,view,time,angle,direction,section,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),inspected:false});
  }
  await page.setViewportSize({width:1510,height:1270});await page.goto('http://127.0.0.1:5174/artifacts/review/070-refined-source-overlay.html');
  const file='artifacts/review/070-refined-source-overlay.png';await page.screenshot({path:file});
  captures.push({file,view:'actual-mesh-source-overlay',sha256:createHash('sha256').update(await readFile(file)).digest('hex'),inspected:false});
  if(errors.length)throw new Error(errors.join('\n'));
  await writeFile('artifacts/review/070-refined-candidate-captures.json',JSON.stringify({movement:70,status:'isolated-candidate',captures},null,2)+'\n',{flag:'wx'});
}finally{await browser.close();}
