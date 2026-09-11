import{chromium}from'playwright';
import{readFile,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
const prefix=process.env.CAPTURE_PREFIX??'076-finite-candidate',browser=await chromium.launch({channel:'chrome',headless:true}),
  page=await browser.newPage({viewport:{width:1500,height:800}}),captures=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto('http://127.0.0.1:5174/#/about');
  await page.evaluate(async()=>{
    const{MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json'),
      {makeJointedTappetCandidate}=await import('/scripts/lib/jointed-tappet-candidate.mjs');
    document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img id="source" src="/artifacts/reference/brown-076-detail.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>';
    await document.querySelector('#source').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[75],{playing:false});
    cancelAnimationFrame(e.animationFrame);e.animationFrame=0;e.scene.remove(e.model.root);e.model=makeJointedTappetCandidate();
    e.scene.add(e.model.root);e.renderer.localClippingEnabled=true;e.updateGroundClearance();window.tappetCandidate=e;
    const u=e.model.root.userData;
    for(const light of e.scene.children.filter(x=>x.isDirectionalLight&&x.castShadow)){
      Object.assign(light.shadow.camera,{left:-u.shadowCameraHalfExtent,right:u.shadowCameraHalfExtent,top:u.shadowCameraHalfExtent,bottom:-u.shadowCameraHalfExtent});
      light.shadow.camera.updateProjectionMatrix();light.shadow.bias=u.shadowBias;light.shadow.normalBias=u.shadowNormalBias;
    }
  });
  for(const[view,configuration,q,direction]of[['source','section',0,[0,0,10]],['source-aligned','section',0,[0,0,10]],
    ['oblique','section',0,[-4,3,10]],['rear','section',0,[4,3,-10]],['rest','section',.3,[0,0,10]],
    ['complete-front','complete',0,[0,0,10]],['complete-rear','complete',0,[4,3,-10]]]){
    const state=await page.evaluate(async({view,configuration,q,direction})=>{
      const{Vector3,OrthographicCamera}=await import('/node_modules/three/build/three.module.js'),e=window.tappetCandidate,u=e.model.root.userData,p=u.geometry;
      u.setConfiguration(configuration);u.setState({q});e.fitCamera(new Vector3(...direction));e.renderer.render(e.scene,e.camera);
      if(view==='source-aligned'){
        const width=1425/p.scale,height=width*720/726,cx=(1425/2-p.center[0])/p.scale,cy=(p.center[1]-1320/2)/p.scale,
          camera=new OrthographicCamera(-width/2,width/2,height/2,-height/2,.01,100);
        camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();e.renderer.render(e.scene,camera);
      }
      document.querySelector('#title').textContent='076 · static finite candidate · '+view;return u.kinematics;
    },{view,configuration,q,direction});
    const file='artifacts/review/'+prefix+'-'+view+'.png';await page.screenshot({path:file});
    captures.push({file,view,configuration,q,direction,state,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),inspected:false});
  }
  if(errors.length)throw new Error(errors.join('\n'));
  await writeFile('artifacts/review/'+prefix+'-captures.json',JSON.stringify({movement:76,status:'static-finite-candidate-views',productionChanged:false,
    captures,errors,qualification:'Source and rest poses only. No accepted dynamic trajectory or complete hardware clearance is claimed.'},null,2)+'\n',{flag:'wx'});
}finally{await browser.close();}
