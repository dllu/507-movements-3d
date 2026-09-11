import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const motionFile=process.env.MOTION_FILE??'artifacts/review/074-release-endpoint-refined-motion-1440.json',capturePrefix=process.env.CAPTURE_PREFIX??'074-contact-candidate';
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1500,height:800}}),captures=[],errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto('http://127.0.0.1:5174/#/about');
  await page.evaluate(async motionFile=>{
    const [{MovementEngine},{default:catalog},{makeMutilatedBevelCandidate},{applySectorRelief},{setSpin}]=await Promise.all([
      import('/src/simulation/engine.js'),import('/src/data/movements.json'),import('/scripts/lib/mutilated-bevel-candidate.mjs'),
      import('/scripts/lib/mutilated-bevel-tooth-relief.mjs'),import('/src/simulation/primitives.js')]);
    const motion=await(await fetch('/'+motionFile)).json(),relief=await(await fetch('/'+motion.relief)).json();
    document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img id="source" src="/artifacts/reference/brown-074-detail.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>';
    await document.querySelector('#source').decode();const engine=new MovementEngine(document.querySelector('#stage'),catalog.movements[73],{playing:false});
    engine.scene.remove(engine.model.root);engine.model=makeMutilatedBevelCandidate(relief.parameters);applySectorRelief(engine.model,relief);engine.scene.add(engine.model.root);
    const extent=engine.model.root.userData.shadowCameraHalfExtent;
    if(extent)for(const light of engine.scene.children.filter(o=>o.isDirectionalLight&&o.castShadow)){
      Object.assign(light.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent});light.shadow.camera.updateProjectionMatrix();
      light.shadow.bias=engine.model.root.userData.shadowBias??light.shadow.bias;
    }
    const model=engine.model,{blocks:b,geometry:p}=model.root.userData,base=motion.rows[motion.steps*(motion.cycles-1)].coordinate;
    const angleAt=u=>{
      const relative=u-base,cycle=Math.floor(relative),index=Math.round((relative-cycle)*motion.steps);
      if(Math.abs(index/motion.steps-(relative-cycle))>1e-9)throw new Error('Capture must use a solved motion knot');
      return motion.rows[motion.steps*(motion.cycles-1)+index].angle+cycle*Math.PI*p.ratio;
    };
    window.poseCandidate=u=>{model.update((u-p.initialCyclePhase)*p.period);setSpin(b.gearA,angleAt(u));setSpin(b.gearB,angleAt(u+.5));};
    window.poseCandidate(2.25);engine.updateGroundClearance();window.candidate=engine;
  },motionFile);
  const sourceCoordinate=await page.evaluate(()=>window.candidate.model.root.userData.geometry.initialCyclePhase+2);
  const poses=[['source',[0,0,10],sourceCoordinate],['entry',[0,0,10],2.4875],['entry-contact',[0,0,10],2.4916666666666667],
    ['index',[0,0,10],2.75],['release',[0,0,10],2.9875],['release-contact',[0,0,10],2.9944444444444445],
    ['dwell',[0,0,10],3.025],['oblique',[-4,3,10],2.75],['rear',[4,3,-10],2.75]];
  for(const [view,direction,coordinate]of poses){
    await page.evaluate(async({view,direction,coordinate})=>{
      const {Vector3}=await import('/node_modules/three/build/three.module.js'),e=window.candidate;
      window.poseCandidate(coordinate);e.fitCamera(new Vector3(...direction));e.renderer.render(e.scene,e.camera);
      document.querySelector('#title').textContent='074 · relieved contact candidate · '+view+' · input '+((coordinate%1)*360).toFixed(1)+'°';
    },{view,direction,coordinate});
    const file='artifacts/review/'+capturePrefix+'-'+view+'.png';await page.screenshot({path:file});
    captures.push({file,view,direction,coordinate,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),inspected:false});
  }
  if(process.env.SOURCE_OVERLAY==='1'){
    await page.setViewportSize({width:1320,height:1370});
    await page.evaluate(async coordinate=>{
      const {OrthographicCamera}=await import('/node_modules/three/build/three.module.js'),e=window.candidate,
        report=await(await fetch('/artifacts/review/074-source-rim-fit.json')).json(),fit=report.fits.find(r=>r.driverTeeth===40&&r.mode==='separate');
      cancelAnimationFrame(e.animationFrame);e.resizeObserver.disconnect();e.controls.enabled=false;
      window.poseCandidate(coordinate);const [x,y]=fit.origin,s=fit.scale;
      e.camera=new OrthographicCamera(-x/s,(1320-x)/s,y/s,-(1370-y)/s,.01,100);e.camera.position.set(0,0,10);e.camera.lookAt(0,0,0);
      const canvas=e.renderer.domElement;document.body.innerHTML='<main style="position:relative;width:1320px;height:1370px"><img id="overlay-source" src="/artifacts/reference/brown-074-detail.png" style="position:absolute;inset:0;width:1320px;height:1370px"/></main>';
      await document.querySelector('#overlay-source').decode();document.body.style.margin='0';document.querySelector('main').append(canvas);
      canvas.style.cssText='position:absolute;inset:0;width:1320px;height:1370px;opacity:.55';e.renderer.setSize(1320,1370,false);e.renderer.render(e.scene,e.camera);
    },sourceCoordinate);
    const file='artifacts/review/'+capturePrefix+'-overlay.png';await page.screenshot({path:file});
    captures.push({file,view:'orthographic-source-overlay',coordinate:sourceCoordinate,fit:'074-source-rim-fit.json: 40/32 separate widths',
      sha256:createHash('sha256').update(await readFile(file)).digest('hex'),inspected:false});
  }
  if(errors.length)throw new Error(errors.join('\n'));
  await writeFile('artifacts/review/'+capturePrefix+'-captures.json',JSON.stringify({movement:74,status:'isolated-contact-candidate',motionFile,captures},null,2)+'\n',{flag:'wx'});
}finally{await browser.close();}
