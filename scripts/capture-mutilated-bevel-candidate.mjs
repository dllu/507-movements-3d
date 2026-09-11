import {chromium}from'playwright';import{readFile,writeFile}from'node:fs/promises';import{createHash}from'node:crypto';
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1500,height:800}}),captures=[],errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto('http://127.0.0.1:5174/#/about');
  await page.evaluate(async()=>{
    const{MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json'),
      {makeMutilatedBevelCandidate}=await import('/scripts/lib/mutilated-bevel-candidate.mjs');
    document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img id="source" src="/artifacts/reference/brown-074-detail.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>';
    await document.querySelector('#source').decode();const engine=new MovementEngine(document.querySelector('#stage'),catalog.movements[73],{playing:false});
    engine.scene.remove(engine.model.root);engine.model=makeMutilatedBevelCandidate();engine.scene.add(engine.model.root);
    engine.updateGroundClearance();window.candidate=engine;
  });
  for(const[view,direction]of [['source',[0,0,10]],['oblique',[-4,3,10]],['rear',[4,3,-10]]]){
    await page.evaluate(async({view,direction})=>{const{Vector3}=await import('/node_modules/three/build/three.module.js'),e=window.candidate;
      e.model.update(0);e.fitCamera(new Vector3(...direction));e.renderer.render(e.scene,e.camera);document.querySelector('#title').textContent='074 · isolated geometry study · '+view;},{view,direction});
    const file='artifacts/review/074-initial-candidate-'+view+'.png';await page.screenshot({path:file});captures.push({file,view,direction,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),inspected:false});
  }
  if(errors.length)throw new Error(errors.join('\n'));
  await writeFile('artifacts/review/074-initial-candidate-captures.json',JSON.stringify({movement:74,status:'isolated-geometry-study',captures,parameters:await page.evaluate(()=>window.candidate.model.root.userData.geometry)},null,2)+'\n',{flag:'wx'});
}finally{await browser.close();}
