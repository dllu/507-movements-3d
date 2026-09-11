import{chromium}from'playwright';
import{readFile,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1500,height:800},reducedMotion:'reduce'}),errors=[],captures=[];
page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto('http://127.0.0.1:5174/#/about');
  const data=await page.evaluate(async()=>{
    const{MovementEngine}=await import('/src/simulation/engine.js');
    const{default:catalog}=await import('/src/data/movements.json');
    const{makeTiltHammerCandidate}=await import('/scripts/lib/tilt-hammer-candidate.mjs');
    document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img id="source" src="/artifacts/reference/brown-072-detail.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>';
    await document.querySelector('#source').decode();
    const engine=new MovementEngine(document.querySelector('#stage'),catalog.movements[71],{playing:false});
    engine.scene.remove(engine.model.root);engine.model=makeTiltHammerCandidate();engine.scene.add(engine.model.root);
    for(const light of engine.scene.children.filter(light=>light.isDirectionalLight&&light.castShadow)){
      const extent=engine.model.root.userData.shadowCameraHalfExtent;
      Object.assign(light.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent});light.shadow.camera.updateProjectionMatrix();
      light.shadow.bias=engine.model.root.userData.shadowBias;light.shadow.normalBias=engine.model.root.userData.shadowNormalBias;
    }
    engine.updateGroundClearance();window.candidate=engine;
    return{p:engine.model.motion.parameters,events:engine.model.motion.events};
  });
  const sourceTime=data.p.inputStart/data.p.omega,{entry,release,landing}=data.events;
  const frames=[['source',[0,0,10],sourceTime],['oblique',[-4,3,10],sourceTime],['rear',[4,3,-10],sourceTime],
    ['pickup',[0,0,10],entry.time],['lifting',[0,0,10],(entry.time+release.time)/2],
    ['release',[0,0,10],release.time],['fall',[0,0,10],(release.time+landing.time)/2],
    ['landing',[0,0,10],landing.time],['dwell',[0,0,10],(landing.time+data.p.period)/2]];
  for(const[view,direction,time]of frames){
    await page.evaluate(async({view,direction,time})=>{
      const{Vector3}=await import('/node_modules/three/build/three.module.js'),e=window.candidate;
      e.model.update(time);e.model.root.updateMatrixWorld(true);e.fitCamera(new Vector3(...direction));
      e.renderer.render(e.scene,e.camera);document.querySelector('#title').textContent=`072 · isolated candidate · ${view} · ${time.toFixed(6)} s`;
    },{view,direction,time});
    const file=`artifacts/review/072-candidate-${view}.png`;await page.screenshot({path:file});
    captures.push({file,view,direction,time,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),inspected:false});
  }
  if(errors.length)throw new Error(errors.join('\n'));
  await writeFile('artifacts/review/072-candidate-captures.json',JSON.stringify({movement:72,status:'isolated-candidate',captures},null,2)+'\n',{flag:'wx'});
}finally{await browser.close();}
