import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const prefix=process.env.CAPTURE_PREFIX??'075-initial-candidate',browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1500,height:800}}),captures=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto('http://127.0.0.1:5174/#/about');
  const sourcePhase=await page.evaluate(async(options)=>{
    const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json'),
      {makeReciprocatingPawlCandidate}=await import('/scripts/lib/reciprocating-pawl-candidate.mjs');
    document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img id="source" src="/artifacts/reference/brown-075-detail.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>';
    await document.querySelector('#source').decode();const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[74],{playing:false});
    e.scene.remove(e.model.root);e.model=makeReciprocatingPawlCandidate(options);e.scene.add(e.model.root);e.updateGroundClearance();window.pawlCandidate=e;
    cancelAnimationFrame(e.animationFrame);e.animationFrame=0;
    const u=e.model.root.userData;
    for(const light of e.scene.children.filter(x=>x.isDirectionalLight&&x.castShadow)){
      Object.assign(light.shadow.camera,{left:-u.shadowCameraHalfExtent,right:u.shadowCameraHalfExtent,top:u.shadowCameraHalfExtent,bottom:-u.shadowCameraHalfExtent});
      light.shadow.camera.updateProjectionMatrix();light.shadow.bias=u.shadowBias;light.shadow.normalBias=u.shadowNormalBias;
    }
    return e.model.root.userData.geometry.sourcePhase;
  },JSON.parse(process.env.GEOMETRY_OPTIONS||'{}'));
  for(const [view,phase,direction] of [['source',sourcePhase,[0,0,10]],['source-aligned',sourcePhase,[0,0,10]],['drive-start',0,[0,0,10]],['drive-end',.5,[0,0,10]],
    ['return-lift',.59,[0,0,10]],['return',.75,[0,0,10]],['oblique',sourcePhase,[-4,3,10]],['rear',.75,[4,3,-10]]]){
    if(process.env.CAPTURE_VIEWS&&!process.env.CAPTURE_VIEWS.split(',').includes(view))continue;
    const state=await page.evaluate(async({view,phase,direction})=>{
      const {Vector3,OrthographicCamera}=await import('/node_modules/three/build/three.module.js'),e=window.pawlCandidate,p=e.model.root.userData.geometry;
      e.model.update((phase-p.sourcePhase)*p.period);e.model.root.updateMatrixWorld(true);e.fitCamera(new Vector3(...direction));e.renderer.render(e.scene,e.camera);
      if(view==='source-aligned'){
        const scale=391.0844456767924,height=1360/scale,width=height*726/720,cx=(625-627.2241913809899)/scale,cy=(641.9135290492636-680)/scale,
          camera=new OrthographicCamera(-width/2,width/2,height/2,-height/2,.01,100);
        camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();e.renderer.render(e.scene,camera);
      }
      document.querySelector('#title').textContent='075 · isolated 3D candidate · '+view;const s=e.model.root.userData.kinematics;
      return{phase:s.phase,barAngle:s.barAngle,wheelAngle:s.wheelAngle,angleB:s.angleB,angleH:s.angleH,rodY:s.rodY};
    },{view,phase,direction});
    const file='artifacts/review/'+prefix+'-'+view+'.png';await page.screenshot({path:file});
    captures.push({file,view,phase,direction,state,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),inspected:false});
  }
  if(errors.length)throw new Error(errors.join('\n'));
  await writeFile('artifacts/review/'+prefix+'-captures.json',JSON.stringify({movement:75,status:'isolated-candidate-render-review',
    productionChanged:false,captures,errors,parameters:await page.evaluate(()=>window.pawlCandidate.model.root.userData.geometry)},null,2)+'\n',{flag:'wx'});
}finally{await browser.close();}
