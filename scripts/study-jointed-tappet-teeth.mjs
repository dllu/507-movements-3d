import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';

const source='artifacts/reference/brown-076-detail.png',prefix='artifacts/review/076-source-tooth-study',
  tips=[[470,202],[593,239],[716,320],[784,423],[814,560],[811,678],[763,791],[691,873],
    [601,939],[499,974],[385,975],[253,936],[157,861],[88,769],[63,672],[54,551],
    [80,431],[141,337],[238,257],[344,215]],
  fit=circleFit(tips),circleStudy=JSON.parse(await readFile('artifacts/review/076-source-circle-study.json','utf8')),
  hub=circleStudy.hub.center,angles=tips.map(p=>Math.atan2(hub[1]-p[1],p[0]-hub[0]));
for(let i=1;i<angles.length;i++)while(angles[i]>=angles[i-1])angles[i]-=2*Math.PI;
const increments=angles.map((a,i)=>(a-(angles[(i+1)%angles.length]-(i===angles.length-1?2*Math.PI:0)))*180/Math.PI),
  pitch=2*Math.PI/tips.length,phase=angles.reduce((s,a,i)=>s+a+i*pitch,0)/angles.length,
  radius=tips.reduce((s,p)=>s+Math.hypot(p[0]-hub[0],p[1]-hub[1]),0)/tips.length,
  predicted=tips.map((_,i)=>[hub[0]+radius*Math.cos(phase-i*pitch),hub[1]-radius*Math.sin(phase-i*pitch)]),
  errors=predicted.map((p,i)=>Math.hypot(p[0]-tips[i][0],p[1]-tips[i][1])),
  readings={fixedC:[1125,637],jointB:[994,671],workingNose:[758,655],holdingPivot:[271,168],
    holdingNose:[173,352],studD:[1187,358]},
  report={movement:76,status:'manual-source-tooth-and-joint-readings',productionChanged:false,
    source:{file:source,sha256:createHash('sha256').update(await readFile(source)).digest('hex')},
    teeth:tips.length,tips,fit,hub,regularized:{radius,phase,pitch,predicted,errors,
      rms:Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/errors.length),maximum:Math.max(...errors)},
    angularIncrementsDegrees:increments,readings,
    qualification:'Twenty manually identified consecutive tooth tips around the complete visible wheel. Labels and the working pawl obscure some short-face detail but not these outer tips. Each regularized tip is assigned in order to one observed tip; this is not a nearest-neighbor count inference. Joint and nose positions remain provisional readings. The working nose is the upper left end of the hooked dog, separate from the wheel tip at (811,678). No contact solution or production change is claimed.'};
await writeFile(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1425" height="1320"><image width="1425" height="1320" xlink:href="data:image/png;base64,${(await readFile(source)).toString('base64')}"/>`
  +`<circle cx="${hub[0]}" cy="${hub[1]}" r="${radius}" fill="none" stroke="#12c9fb" stroke-width="2"/>`
  +tips.map((p,i)=>`<path d="M${p}L${predicted[i]}" stroke="#ff51db" stroke-width="2"/><circle cx="${p[0]}" cy="${p[1]}" r="5" fill="#ffe52d"/><circle cx="${predicted[i][0]}" cy="${predicted[i][1]}" r="4" fill="#ff51db"/><text x="${p[0]+9}" y="${p[1]-8}" font-size="23" fill="#ffe52d">${i+1}</text>`).join('')
  +Object.entries(readings).map(([name,p])=>`<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="#00ed80"/><text x="${p[0]+8}" y="${p[1]-10}" font-size="18" fill="#00ed80">${name}</text>`).join('')+'</svg>';
await writeFile(prefix+'.svg',svg,{flag:'wx'});
const result=spawnSync('convert',['-background','white',prefix+'.svg',prefix+'.png']);
if(result.status!==0)throw new Error('Source plot render failed');
console.log({teeth:tips.length,tipCircle:{center:fit.center,radius:fit.radius,rms:fit.rmsResidual},
  regularized:report.regularized,angularIncrementsDegrees:increments});
