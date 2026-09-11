import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const browser=await chromium.launch({channel:'chrome',headless:true}),
  page=await browser.newPage({viewport:{width:1500,height:800}}),captures=[],errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto('http://127.0.0.1:5174/#/about');
  await page.evaluate(async()=>{
    const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json');
    document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img id="source" src="/artifacts/reference/brown-076-detail.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>';
    await document.querySelector('#source').decode();
    window.baselineTappet=new MovementEngine(document.querySelector('#stage'),catalog.movements[75],{playing:false});
  });
  const geometry=await page.evaluate(()=>{
    const p=window.baselineTappet.model.root.userData.geometry;
    return{initial:p.initialCyclePhase,start:p.contactStartPhase,end:p.contactEndPhase,returnEnd:p.returnEndPhase};
  });
  for(const[view,phase,direction]of[['initial',geometry.initial,null],['front',geometry.initial,[0,0,10]],
    ['drive-start',geometry.start,[0,0,10]],['drive-end',geometry.end,[0,0,10]],
    ['return',(geometry.end+geometry.returnEnd)/2,[0,0,10]],['waiting',.8,[0,0,10]],
    ['oblique',geometry.initial,[-4,3,10]],['rear',geometry.initial,[4,3,-10]]]){
    const state=await page.evaluate(async({view,phase,direction})=>{
      const{Vector3}=await import('/node_modules/three/build/three.module.js'),e=window.baselineTappet,p=e.model.root.userData.geometry;
      e.model.update((phase-p.initialCyclePhase)*2*Math.PI/p.driverAngularSpeed);e.model.root.updateMatrixWorld(true);
      e.fitCamera(direction?new Vector3(...direction):e.model.cameraDirection);e.renderer.render(e.scene,e.camera);
      document.querySelector('#title').textContent=`076 · existing model · ${view} · phase ${phase.toFixed(5)}`;
      const k=e.model.root.userData.kinematics;return{stage:k.stage,tappetAngle:k.tappetAngle,drivenAngle:k.drivenAngle,
        driverAngle:k.driverAngle,pawlRelativeAngle:k.pawlRelativeAngle,claimedPawlClearance:k.pawlProfileClearance,
        claimedStudContactError:k.studTappetContactError};
    },{view,phase,direction});
    const file=`artifacts/review/076-baseline-${view}.png`;await page.screenshot({path:file});
    captures.push({file,view,phase,direction,state,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),inspected:false});
  }
  if(errors.length)throw new Error(errors.join('\n'));
  await writeFile('artifacts/review/076-baseline-captures.json',JSON.stringify({movement:76,status:'baseline-render-review',captures,errors},null,2)+'\n',{flag:'wx'});
}finally{await browser.close();}
