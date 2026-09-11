import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';

const prefix=process.env.CAPTURE_PREFIX||'ratchet-corrections',
  ids=(process.env.MOVEMENTS||'073,075,076,077').split(','),
  browser=await chromium.launch({channel:'chrome',headless:true}),
  page=await browser.newPage({viewport:{width:1500,height:850}}),errors=[],captures=[];
page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto('http://127.0.0.1:5174/#/about');
  for(const id of ids){
    await page.evaluate(async({id,trajectory})=>{
      window.correctionEngine?.dispose();
      const {MovementEngine}=await import('/src/simulation/engine.js'),
        {default:catalog}=await import('/src/data/movements.json');
      document.body.innerHTML=`<main style="padding:16px;background:#faf8f2;height:850px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:770px"><div id="stage" style="width:726px;height:770px;position:relative"></div><img src="/artifacts/reference/brown-${id}-detail.png" style="width:726px;height:770px;object-fit:contain" /></div></main>`;
      await document.querySelector('img').decode();
      const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[Number(id)-1],{playing:false});
      cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.correctionEngine=e;
      if(id==='077'&&trajectory){
        const data=await(await fetch('/'+trajectory)).json(),{makeAlternatingPegCandidate}=await import('/scripts/lib/alternating-peg-candidate.mjs');
        e.scene.remove(e.model.root);e.model=makeAlternatingPegCandidate(data.geometry);e.scene.add(e.model.root);
        for(const [name,mesh] of Object.entries(e.model.root.userData.parts))if(name.startsWith('wheelPinCap'))mesh.material.color.setHex(0x263d45);
        e.model.update=time=>{const t=Math.max(0,Math.min(data.duration,time*2)),i=Math.min(data.rows.length-2,Math.floor(t/data.dt)),a=data.rows[i],b=data.rows[i+1],f=t/data.dt-i;
          const x=a.x.map((v,k)=>v+(b.x[k]-v)*f);e.model.setState({q:a.q+(b.q-a.q)*f,theta:x[0],upperAngle:x[1],lowerAngle:x[2]});};
      }
    },{id,trajectory:process.env.TRAJECTORY});
    const poses=id==='077'?[['source',0,[0,0,10]],...Array.from({length:8},(_,i)=>['cycle-'+i,4+i*.5,[0,0,10]]),['oblique',6,[-4,3,10]]]:
      [['source',0,[0,0,10]],['oblique',0,[-4,3,10]],['return',id==='075'?1.3:id==='076'?3:1,[0,0,10]]];
    for(const [view,time,direction] of poses){
      const state=await page.evaluate(async({id,view,time,direction})=>{
        const {Vector3}=await import('/node_modules/three/build/three.module.js'),e=window.correctionEngine;
        e.model.update(time);e.model.root.updateMatrixWorld(true);e.fitCamera(new Vector3(...direction));e.renderer.render(e.scene,e.camera);
        document.querySelector('#title').textContent=`${id} · correction review · ${view} · ${time}s`;
        const s=e.model.root.userData.kinematics;return{id,view,time,configuration:e.model.root.userData.configuration,state:s?{q:s.q,theta:s.theta,barAngle:s.barAngle,wheelAngle:s.wheelAngle}:null};
      },{id,view,time,direction});
      const file=`artifacts/review/${prefix}-${id}-${view}.png`;await page.screenshot({path:file});captures.push({file,...state});
    }
  }
  if(process.env.FILMSTRIP==='1'){
    const frames=await page.evaluate(async()=>{
      const {OrthographicCamera}=await import('/node_modules/three/build/three.module.js'),e=window.correctionEngine,
        camera=new OrthographicCamera(-1.05,1.05,.7,-.7,.01,100),frames=[];
      camera.position.set(1.05,.55,10);camera.lookAt(1.05,.55,0);camera.updateMatrixWorld();e.renderer.setSize(360,240,false);
      for(let i=0;i<24;i++){
        const time=4+i/6;e.model.update(time);e.model.root.updateMatrixWorld(true);e.renderer.render(e.scene,camera);
        frames.push({time,image:e.renderer.domElement.toDataURL()});
      }
      return frames;
    });
    await page.setViewportSize({width:1500,height:1690});
    await page.evaluate(frames=>{
      window.correctionEngine.dispose();
      document.body.innerHTML='<main style="padding:12px;background:#faf8f2;font:16px system-ui"><h2>077 · integrated contact sequence · one four-second cycle</h2><div style="display:grid;grid-template-columns:repeat(4,360px);gap:10px">'+frames.map(f=>`<div><img style="display:block;width:360px;height:240px" src="${f.image}"><span>${f.time.toFixed(3)} s</span></div>`).join('')+'</div></main>';
    },frames);
    const file=`artifacts/review/${prefix}-077-filmstrip.png`;await page.screenshot({path:file,fullPage:true});captures.push({file,view:'filmstrip',frames:24});
  }
  await writeFile(`artifacts/review/${prefix}-captures.json`,JSON.stringify({captures,errors},null,2)+'\n',{flag:'wx'});
  if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
