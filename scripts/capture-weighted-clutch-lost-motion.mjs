import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-lost-motion',
  frozen=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json'),
  verify=()=>{for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);};
verify();
const sources=freezeStudySources(['scripts/capture-weighted-clutch-lost-motion.mjs','scripts/lib/weighted-clutch-lost-motion-candidate.mjs',
  'scripts/lib/weighted-clutch-candidate.mjs','scripts/lib/weighted-clutch-lost-motion.mjs','scripts/lib/weighted-clutch-source.mjs','scripts/lib/weighted-clutch-linkage.mjs','scripts/lib/study-report-io.mjs',
  'src/simulation/engine.js','src/simulation/primitives.js','src/simulation/bevel-geometry.js',
  'src/simulation/jaw-clutch-geometry.js','src/simulation/finite-plate-geometry.js',
  'src/simulation/conforming-plate-mesh.js','src/simulation/clutch-section-geometry.js',
  'artifacts/reference/brown-087-detail.png'],prefix),
  browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],warnings=[],views=[];
try{
  const page=await browser.newPage({viewport:{width:1500,height:800}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text());});
  await page.goto('http://127.0.0.1:5174/#/about');
  const geometry=await page.evaluate(async()=>{
    const{MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json'),
      {makeWeightedClutchLostMotionCandidate}=await import('/scripts/lib/weighted-clutch-lost-motion-candidate.mjs');
    document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-087-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
    await document.querySelector('img').decode();
    const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[86],{playing:false});
    cancelAnimationFrame(e.animationFrame);e.animationFrame=0;e.scene.remove(e.model.root);
    e.model.root.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});
    e.model=makeWeightedClutchLostMotionCandidate();e.scene.add(e.model.root);e.updateGroundClearance();
    e.scene.traverse(o=>{if(o.isDirectionalLight&&o.shadow){const u=e.model.root.userData,s=o.shadow;s.bias=u.shadowBias;s.normalBias=u.shadowNormalBias;
      Object.assign(s.camera,{left:-u.shadowCameraHalfExtent,right:u.shadowCameraHalfExtent,top:u.shadowCameraHalfExtent,bottom:-u.shadowCameraHalfExtent});s.camera.updateProjectionMatrix();}});
    window.weightedCandidate=e;
    const u=e.model.root.userData;
    return{parts:Object.keys(u.parts).length,state:u.state,parameters:u.geometry,coupling:u.lostMotion.parameters,sourceAdjustments:u.sourceAdjustments};
  });
  const specs=[
    {name:'source',direction:[0,0,10]},
    {name:'source-overlay',direction:[0,0,10]},
    {name:'front',direction:[0,0,10]},
    {name:'oblique',direction:[4,3,10]},
    {name:'rear',direction:[-4,3,-10]},
    {name:'clutch-detail',direction:[0,0,10],center:[0,-.6,0],width:4.2},
    {name:'quadrant-detail',direction:[0,0,10],center:[.32,-1.23,0],width:2.8},
    {name:'stud-detail',direction:[0,0,10],center:[5.1,-.45,0],width:2.8},
    {name:'forward-vertical',direction:[0,0,10],overCenter:true},
    {name:'left-engaged',direction:[0,0,10],leftStop:true},
    {name:'left-clutch-detail',direction:[0,0,10],leftStop:true,center:[0,-.6,0],width:4.2},
    {name:'left-quadrant-detail',direction:[0,0,10],leftStop:true,center:[-.40,-1.23,0],width:2.8},
    {name:'return-vertical',direction:[0,0,10],overCenter:true,returning:true},
    {name:'weight-crossing-oblique',direction:[4,2,10],leverFraction:5/12,center:[.18,-.33,1.45],width:2.1},
    {name:'left-pivot-rear',direction:[-4,2,-10],leftStop:true,center:[0,-1.88,1.28],width:1.0},
  ];
  for(const spec of specs){
    await page.evaluate(async({name,direction,center,width,overCenter,leftStop,returning,leverFraction})=>{
      const{THREE:{Vector3,OrthographicCamera}}=await import('/scripts/lib/weighted-clutch-lost-motion-candidate.mjs'),
        e=window.weightedCandidate,u=e.model.root.userData,p=u.source;
      document.querySelector('#overlay')?.remove();
      e.model.setState({leverAngle:leftStop?u.lostMotion.parameters.leverLeft:overCenter?u.linkage.parameters.overCenterAngle:
        (leverFraction??0)*u.lostMotion.parameters.leverLeft,direction:returning?'rightward':'leftward'});
      e.fitCamera(new Vector3(...direction));let camera=e.camera;
      if(name.startsWith('source')){
        const h=Math.max(p.height,p.width*720/726)/p.scale,w=h*726/720,cx=(p.width/2-p.origin[0])/p.scale,cy=(p.origin[1]-p.height/2)/p.scale;
        camera=new OrthographicCamera(-w/2,w/2,h/2,-h/2,.01,100);camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();
      }
      if(center){camera=new OrthographicCamera(-width/2,width/2,width/2*720/726,-width/2*720/726,.01,100);
        camera.position.copy(new Vector3(...direction).normalize().multiplyScalar(10).add(new Vector3(...center)));
        camera.lookAt(...center);camera.updateMatrixWorld();}
      e.renderer.render(e.scene,camera);
      if(name==='source-overlay'){
        const img=document.createElement('img');img.id='overlay';img.src='/artifacts/reference/brown-087-detail.png';
        img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';
        document.querySelector('#stage').append(img);await img.decode();
      }
      document.querySelector('#title').textContent='087 · lost-motion hypothesis · '+name+' · rod pins adjusted 75 source pixels';
    },spec);
    const file=prefix+'-'+spec.name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file});
    views.push({...spec,file,sha256:hashStudyFile(file),inspected:false});
  }
  verify();verifyStudySources(sources);
  const known=[/^THREE.Clock: This module has been deprecated\./,/^THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated\./,/^\[.WebGL-.*GPU stall due to ReadPixels/],
    unexpectedWarnings=warnings.filter(w=>!known.some(r=>r.test(w)));
  fs.writeFileSync(prefix+'-captures.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
    qualification:'Fifteen static views of the lost-motion hypothesis, with explicit 75-pixel rod-pin changes. The measured fulcrums, weight projection and G upper arm are retained; weight depth and hidden spacers provide clearance. No gravity trajectory, stud-driven reversal, loaded jaw contact or continuous hardware clearance is qualified.',
    geometry,views,errors,warnings,unexpectedWarnings,sources},null,2)+'\n',{flag:'wx'});
  console.log({views:views.length,geometry,errors,unexpectedWarnings});assert(!errors.length&&!unexpectedWarnings.length);
}finally{await browser.close();}
