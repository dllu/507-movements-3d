import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {visibleForegroundBounds,hasFrameMargin} from '../tests/helpers/rendered-frame.mjs';

const browser=await chromium.launch({channel:'chrome',headless:true});
let page=await browser.newPage({viewport:{width:1500,height:800}});
const captures=[],errors=[],checks={},framing={};
page.on('pageerror',e=>errors.push(e.message));
const capture=async(name,data={})=>{
  const file=`artifacts/review/075-integrated-${name}.png`;await page.screenshot({path:file,fullPage:true});
  captures.push({file,...data,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),inspected:false});
};
try{
  await page.goto('http://127.0.0.1:5174/#/about');
  const timing=await page.evaluate(async()=>{
    const {MovementEngine}=await import('/src/simulation/engine.js'),{default:catalog}=await import('/src/data/movements.json');
    document.body.innerHTML='<main style="padding:16px;background:#faf8f2;height:800px;box-sizing:border-box"><div id="title" style="font:20px system-ui;height:40px"></div><div style="display:flex;gap:16px;height:720px"><div id="stage" style="width:726px;height:720px;position:relative"></div><img id="source" src="/artifacts/reference/brown-075-detail.png" style="width:726px;height:720px;object-fit:contain;background:white" /></div></main>';
    await document.querySelector('#source').decode();
    const e=new MovementEngine(document.querySelector('#stage'),catalog.movements[74],{playing:false});
    cancelAnimationFrame(e.animationFrame);e.animationFrame=0;window.integratedPawl=e;
    return e.model.root.userData.animationTiming;
  });
  const poses=[['source',null,[0,0,10]],['source-aligned',null,[0,0,10]],['drive-start',0,[0,0,10]],['drive-middle',.25,[0,0,10]],
    ['drive-end',.5,[0,0,10]],['return-lift',.6,[0,0,10]],['return',.75,[0,0,10]],['settling',.98,[0,0,10]],
    ['oblique',null,[-4,3,10]],['rear',.75,[4,3,-10]]];
  for(const [view,coordinate,direction] of poses){
    const state=await page.evaluate(async({view,coordinate,direction})=>{
      const {Vector3,OrthographicCamera}=await import('/node_modules/three/build/three.module.js'),e=window.integratedPawl,p=e.model.root.userData.geometry,
        phase=coordinate??p.sourcePhase;
      e.model.update((phase-p.sourcePhase)*p.period);e.model.root.updateMatrixWorld(true);e.fitCamera(new Vector3(...direction));e.renderer.render(e.scene,e.camera);
      if(view==='source-aligned'){
        const scale=391.0844456767924,height=1360/scale,width=height*726/720,cx=(625-627.2241913809899)/scale,cy=(641.9135290492636-680)/scale,
          camera=new OrthographicCamera(-width/2,width/2,height/2,-height/2,.01,100);
        camera.position.set(cx,cy,10);camera.lookAt(cx,cy,0);camera.updateMatrixWorld();e.renderer.render(e.scene,camera);
      }
      document.querySelector('#title').textContent=`075 · integrated model · ${view} · phase ${phase.toFixed(4)}`;
      return e.model.root.userData.kinematics;
    },{view,coordinate,direction});
    await capture(view,{view,coordinate,direction,state});
  }
  await page.close();page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5174/#/movement/075');
  const canvas=page.locator('canvas');await canvas.waitFor({state:'visible'});
  const note=page.getByText('The curved pawl B advances the wheel one tooth while the fixed pawl holds it during return.',{exact:false});
  checks.noteVisible=await note.isVisible();
  await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('button',{name:'Reset view',exact:true}).click();
  const stopped=await canvas.screenshot();await page.waitForTimeout(250);checks.pauseStable=(await canvas.screenshot()).equals(stopped);
  await page.getByRole('button',{name:'Play',exact:true}).click();
  for(let i=0;i<15;i++){await page.waitForTimeout(150);if(!(await canvas.screenshot()).equals(stopped)){checks.playChangesFrame=true;break;}}
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  framing.desktop=await visibleForegroundBounds(canvas);checks.desktopFramed=hasFrameMargin(framing.desktop);await capture('desktop-controls',{view:'desktop-controls'});
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Reset view',exact:true}).click();await page.waitForTimeout(250);
  framing.mobile=await visibleForegroundBounds(canvas);checks.mobileFramed=hasFrameMargin(framing.mobile);
  checks.mobileNoHorizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);await capture('mobile-controls',{view:'mobile-controls'});
  await note.scrollIntoViewIfNeeded();checks.mobileNoteReachable=await note.isVisible();await capture('mobile-notes',{view:'mobile-notes'});
  checks.noPageErrors=errors.length===0;
  await writeFile('artifacts/review/075-integrated-captures.json',JSON.stringify({movement:75,status:'integrated-registry-model',timing,captures,checks,framing,errors},null,2)+'\n',{flag:'wx'});
  console.log({views:captures.length,checks,framing,timing});if(Object.values(checks).some(v=>v!==true))process.exitCode=1;
}finally{await browser.close();}
