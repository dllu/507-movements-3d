import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readStudyReport,freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-fixed-orbit-reversal-rendered',input=process.env.PROBE_INPUT??'artifacts/review/087-fixed-orbit-reversal-poses.json',
  report=readStudyReport(input),sources=freezeStudySources([...report.sources.map(s=>s.file),input,
    'scripts/capture-weighted-clutch-fixed-orbit-reversal.mjs','src/simulation/engine.js',
    'artifacts/reference/brown-087-detail.png'],prefix),views=[],previews=[],errors=[],warnings=[];
verifyStudySources(report.sources);assert(report.poses.every(p=>!p.issues.length&&!p.topologyIssues.length));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1500,height:800}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text());});
  await page.goto('http://127.0.0.1:5174/#/about');
  await page.evaluate(async options=>{
    const{MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json'),
      {makeWeightedClutchDistributedCandidate}=await import('/scripts/lib/weighted-clutch-distributed-candidate.mjs'),
      {makeWeightedClutchKeyCandidate}=await import('/scripts/lib/weighted-clutch-key-candidate.mjs');
    document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:19px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img src="/artifacts/reference/brown-087-detail.png" style="width:726px;height:720px;object-fit:contain" /></div></main>';
    await document.querySelector('img').decode();
    const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[86],{playing:false});
    cancelAnimationFrame(e.animationFrame);e.animationFrame=0;e.scene.remove(e.model.root);
    e.model.root.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});
    const candidate=makeWeightedClutchDistributedCandidate(options),previous=makeWeightedClutchKeyCandidate();
    previous.setCoordinates([0,previous.root.userData.lostMotion.parameters.shifterRight,0,0,0],0);
    e.model=candidate;e.scene.add(candidate.root);e.updateGroundClearance();
    e.scene.traverse(o=>{if(o.isDirectionalLight&&o.shadow){const u=candidate.root.userData,s=o.shadow;s.bias=u.shadowBias;s.normalBias=u.shadowNormalBias;
      Object.assign(s.camera,{left:-u.shadowCameraHalfExtent,right:u.shadowCameraHalfExtent,top:u.shadowCameraHalfExtent,bottom:-u.shadowCameraHalfExtent});s.camera.updateProjectionMatrix();}});
    window.fixedOrbitClutch={e,candidate,previous};
  },report.options);
  const specs=report.poses.map((pose,i)=>({name:pose.direction+'-'+pose.name,poseIndex:i,direction:pose.cameraDirection,q:pose.q,input:pose.input}));
  for(const spec of specs){
    const state=await page.evaluate(async spec=>{
      const{THREE:{Vector3,OrthographicCamera}}=await import('/scripts/lib/weighted-clutch-distributed-candidate.mjs'),
        f=window.fixedOrbitClutch,e=f.e;
      e.scene.remove(e.model.root);e.model=spec.previous?f.previous:f.candidate;e.scene.add(e.model.root);
      e.model.setCoordinates(spec.q,spec.input);e.updateGroundClearance();
      document.querySelector('#overlay')?.remove();e.fitCamera(new Vector3(...(spec.direction??[0,0,10])));
      let camera=e.camera;const p=e.model.root.userData.source;
      if(spec.source){
        const h=Math.max(p.height,p.width*720/726)/p.scale,w=h*726/720,
          cx=(p.width/2-p.origin[0])/p.scale,cy=(p.origin[1]-p.height/2)/p.scale;
        camera=new OrthographicCamera(-w/2,w/2,h/2,-h/2,.01,100);camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();
      }
      if(spec.center){
        const h=spec.width*720/726;camera=new OrthographicCamera(-spec.width/2,spec.width/2,h/2,-h/2,.01,100);
        camera.position.copy(new Vector3(...spec.center)).add(new Vector3(0,0,10));camera.lookAt(...spec.center);camera.updateMatrixWorld();
      }
      e.renderer.render(e.scene,camera);
      if(spec.overlay){
        const img=document.createElement('img');img.id='overlay';img.src='/artifacts/reference/brown-087-detail.png';
        img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.5;mix-blend-mode:multiply';
        document.querySelector('#stage').append(img);await img.decode();
      }
      document.querySelector('#title').textContent='087 · fixed-orbit reversal · '+spec.name+' · bounded motion study';
      return e.model.root.userData.state;
    },spec);
    const file=prefix+'-'+spec.name+'.png';assert(!fs.existsSync(file));await page.screenshot({path:file});
    let maximumStateDifference=null;
    if(!spec.previous){
      assert.deepEqual(Object.keys(state).sort(),Object.keys(report.poses[spec.poseIndex].state).sort());
      maximumStateDifference=0;
      for(const[key,value]of Object.entries(state)){
        const actual=Array.isArray(value)?value:[value],expected=Array.isArray(report.poses[spec.poseIndex].state[key])?report.poses[spec.poseIndex].state[key]:[report.poses[spec.poseIndex].state[key]];
        assert.equal(actual.length,expected.length);
        for(let i=0;i<actual.length;i++)maximumStateDifference=Math.max(maximumStateDifference,Math.abs(actual[i]-expected[i]));
      }
      // Chromium and Node can differ by an ULP in derived atan2 quantities.
      // Retain the measured discrepancy instead of requiring byte equality.
      assert(maximumStateDifference<1e-12);
    }
    views.push({...spec,state,maximumStateDifference,file,sha256:hashStudyFile(file),inspected:false});
  }
  for(const spec of report.previews){
    const direction=spec.label,all=spec.files.flatMap(file=>readStudyReport(file).rows.map(r=>({time:r.time,q:r.q,input:r.phase.input}))),
      unique=all.filter((r,i)=>i===0||r.time>all[i-1].time),
      startIndex=Math.max(0,unique.findIndex(r=>r.time>=spec.startTime)-1),
      rows=unique.slice(startIndex).filter(r=>r.time<=spec.endTime+1e-12);
    assert(rows.length>1);
    const result=await page.evaluate(async ({rows,direction})=>{
      const {THREE:{Vector3}}=await import('/scripts/lib/weighted-clutch-distributed-candidate.mjs'),f=window.fixedOrbitClutch,e=f.e;
      e.model.setCoordinates(rows[0].q,rows[0].input);e.updateGroundClearance();e.fitCamera(new Vector3(4,3,10));
      document.querySelector('#title').textContent='087 · fixed-orbit transfer · '+direction+' · slowed inspection preview';
      let frameCount=0,index=0,last=null,maximumFrameInterval=0;const duration=8000,start=performance.now();
      return await new Promise(resolve=>{
        function frame(now){
          const fraction=Math.min(1,(now-start)/duration),time=rows[0].time+fraction*(rows.at(-1).time-rows[0].time);
          while(index<rows.length-2&&rows[index+1].time<time)index++;
          const a=rows[index],b=rows[index+1],w=(time-a.time)/(b.time-a.time),q=a.q.map((v,k)=>v+w*(b.q[k]-v)),input=a.input+w*(b.input-a.input);
          e.model.setCoordinates(q,input);e.updateGroundClearance();e.renderer.render(e.scene,e.camera);frameCount++;
          if(last!==null)maximumFrameInterval=Math.max(maximumFrameInterval,now-last);last=now;
          if(fraction===1)resolve({frameCount,maximumFrameInterval,duration,modelStart:rows[0].time,modelEnd:time,state:e.model.root.userData.state});
          else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
    },{rows,direction});
    assert(result.frameCount>30&&Math.abs(result.modelEnd-rows.at(-1).time)<1e-10);
    previews.push({...spec,inputs:spec.files.map(file=>({file,sha256:hashStudyFile(file)})),...result,completed:true});
  }
  verifyStudySources(sources);
  const known=[/^THREE.Clock: This module has been deprecated\./,/^THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated\./,/^\[.WebGL-.*GPU stall due to ReadPixels/],
    unexpectedWarnings=warnings.filter(w=>!known.some(r=>r.test(w)));
  fs.writeFileSync(prefix+'-captures.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
    sources,input,views,previews,errors,warnings,unexpectedWarnings,
    qualification:'Twelve inspected seating/holding/following-lift poses and four slowed eight-second preview executions. First-reversal segments join at unchanged positions and times, and the following encounters retain the integrated held state. These views do not establish repeated transfers, continuous clearance or final whole-cycle speed.'},null,2)+'\n',{flag:'wx'});
  console.log({views:views.length,errors,unexpectedWarnings});assert(!errors.length&&!unexpectedWarnings.length);
}finally{await browser.close();}
