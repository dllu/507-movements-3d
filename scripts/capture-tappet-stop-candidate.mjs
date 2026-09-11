import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1500,height:800},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:5174/#/about');
 await page.evaluate(async()=>{
  const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json'),{makeTappetStopCandidate}=await import('/scripts/lib/tappet-stop-candidate.mjs');
  document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div style="font:20px system-ui;height:40px">065 · Isolated tappet and stop reconstruction</div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/engravings/mm_065.png" style="width:726px;height:720px;object-fit:contain;background:white"/></div></main>';
  const engine=new MovementEngine(document.querySelector('#stage'),catalog.movements[64],{playing:false});
  engine.scene.remove(engine.model.root);engine.model=makeTappetStopCandidate();engine.scene.add(engine.model.root);
  engine.camera.fov=engine.model.root.userData.cameraFov;engine.camera.updateProjectionMatrix();
  engine.ground.visible=false;engine.updateGroundClearance();window.candidate=engine;
 });
 for(const [view,phase,direction]of[['source',null,[0,0,10]],['flat',.18,[0,0,10]],['tip',.42,[0,0,10]],['dwell',1,[0,0,10]],['oblique',null,[-5,3,10]],['rear',.2,[5,3,-10]]]){
  await page.evaluate(async({phase,direction})=>{const{Vector3}=await import('/node_modules/three/build/three.module.js'),engine=window.candidate,p=engine.model.root.userData.geometry;
   engine.model.update(phase===null?0:(p.sourceGamma-p.gammaStart+phase)/p.inputSpeed);engine.model.root.updateMatrixWorld(true);engine.fitCamera(new Vector3(...direction));engine.renderer.render(engine.scene,engine.camera);
  },{phase,direction});await page.screenshot({path:`artifacts/review/${process.env.CAPTURE_PREFIX??'065-candidate-initial'}-${view}.png`});
 }
 if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
