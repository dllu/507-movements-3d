import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeOpposedArmCandidate} from './lib/opposed-arm-candidate.mjs';
import {makeOpposedArmForceStudy} from './lib/opposed-arm-forces-study.mjs';
import {makeOpposedArmContactStudy} from './lib/opposed-arm-contact-study.mjs';
import {makeOpposedArmEnergyStudy} from './lib/opposed-arm-energy-study.mjs';
const input=process.env.PROBE_INPUT??'artifacts/review/079-first-dynamics.json',prefix=process.env.PROBE_PREFIX??'079-first-energy',r=JSON.parse(await readFile(input,'utf8')),
 model=makeOpposedArmCandidate(r.geometry),u=model.root.userData,f=makeOpposedArmForceStudy(model,r.parameters),c=makeOpposedArmContactStudy(model),energy=makeOpposedArmEnergyStudy(f,u.geometry),sources=[],issues=[],rows=[],strokes=new Map();
r.rows=r.rows.filter(row=>row.time>=Number(process.env.PROBE_START_TIME??-Infinity)-1e-8&&row.time<=Number(process.env.PROBE_END_TIME??Infinity)+1e-8);
if(r.rows.length<2)throw Error('Requested energy interval has fewer than two states');
for(const file of ['scripts/assess-opposed-arm-dynamics.mjs','scripts/lib/opposed-arm-energy-study.mjs','scripts/lib/opposed-arm-candidate.mjs','scripts/lib/opposed-arm-forces-study.mjs','scripts/lib/opposed-arm-contact-study.mjs',input]){
 const bytes=await readFile(file),archive=`artifacts/review/${prefix}-geometry-source-${sources.length}.txt`;
 await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
let inputWork=0,dampingWork=0,frictionWork=0,positiveResidual=0,negativeResidual=0,maximumPositiveResidual=0,reverseTeeth=0,stoppedTime=0,wrongDirectionDriveTime=0,
 velocityChangeLoss=0,contactVelocityWork=0,correctedResidual=0,absoluteCorrectedResidual=0,maximumCorrectedResidual=0;
const start=r.rows[0],initialEnergy=energy.state(start.x,start.v,start.time).energy,pitch=u.geometry.pitch,period=f.parameters.period;
for(let i=1;i<r.rows.length;i++){
 const a=r.rows[i-1],b=r.rows[i],dt=b.time-a.time;let contacts=b.contacts??[];
 if(contacts.some(row=>!row.J)){
  const computed=new Map(c.constraints(b.x,f.input(b.time)).rows.map(row=>[row.id,row]));
  contacts=contacts.map(row=>{const computedRow=computed.get(row.id);if(!computedRow)throw Error('Missing contact '+row.id);return{...row,J:computedRow.J};});
 }
 const e=energy.interval(a,b,contacts,b.frictionImpulse??0);
 if(!Number.isFinite(e.residual)||e.frictionWork< -1e-10)issues.push({index:i,time:b.time,reason:'invalid-energy-or-friction',residual:e.residual,frictionWork:e.frictionWork});
 inputWork+=e.inputWork;dampingWork+=e.dampingWork;frictionWork+=e.frictionWork;
 positiveResidual+=Math.max(0,e.residual);negativeResidual+=Math.min(0,e.residual);maximumPositiveResidual=Math.max(maximumPositiveResidual,e.residual);
 velocityChangeLoss+=e.velocityChangeLoss;contactVelocityWork+=e.contactVelocityWork;correctedResidual+=e.correctedResidual;
 absoluteCorrectedResidual+=Math.abs(e.correctedResidual);maximumCorrectedResidual=Math.max(maximumCorrectedResidual,Math.abs(e.correctedResidual));
 reverseTeeth+=Math.max(0,b.x[0]-a.x[0])/pitch;if(Math.abs(b.v[0])<1e-5)stoppedTime+=dt;
 const strokeIndex=Math.floor((b.time+period/4-1e-9)/(period/2)),stroke=strokes.get(strokeIndex)??{index:strokeIndex,start:(strokeIndex-.5)*period/2,end:(strokeIndex+.5)*period/2,
  expectedDriver:strokeIndex%2===0?'upper':'lower',sampledStart:a.time,sampledEnd:b.time,clockwiseImpulse:{upper:0,lower:0},driveTime:{upper:0,lower:0},inputWork:{upper:0,lower:0}};
 stroke.sampledEnd=b.time;
 for(const key of ['upper','lower']){
  stroke.clockwiseImpulse[key]+=e.clockwiseImpulse[key];stroke.inputWork[key]+=e.input[key].work;
  if(e.clockwiseImpulse[key]>1e-8){stroke.driveTime[key]+=dt;if(e.input[key].psiSpeed>1e-7)wrongDirectionDriveTime+=dt;}
 }
 strokes.set(strokeIndex,stroke);
 rows.push({time:b.time,teeth:-(b.x[0]-start.x[0])/pitch,wheelVelocity:b.v[0],beta:b.x.slice(1),energy:e.energy,inputWork,dampingWork,frictionWork,
  residual:e.residual,cumulativeResidual:e.energy-initialEnergy-inputWork+dampingWork+frictionWork,velocityChangeLoss:e.velocityChangeLoss,
  contactVelocityWork:e.contactVelocityWork,correctedResidual:e.correctedResidual,clockwiseImpulse:e.clockwiseImpulse});
 if(i%1000===0)console.log({index:i,time:b.time,positiveResidual,negativeResidual});
}
const samples=time=>r.rows.reduce((best,row)=>Math.abs(row.time-time)<Math.abs(best.time-time)?row:best,r.rows[0]),cycles=[];
for(let time=Math.ceil((start.time-1e-8)/period)*period;time+period<=r.rows.at(-1).time+1e-8;time+=period){
 const a=samples(time),b=samples(time+period);cycles.push({start:time,end:time+period,teeth:-(b.x[0]-a.x[0])/pitch,betaDifference:b.x.slice(1).map((v,i)=>v-a.x[i+1]),velocityDifference:b.v.map((v,i)=>v-a.v[i])});
}
const summary={duration:r.rows.at(-1).time-start.time,startTime:start.time,endTime:r.rows.at(-1).time,dt:r.dt,states:r.rows.length,solverFailures:r.failures.length,
 initialEnergy,finalEnergy:rows.at(-1)?.energy,inputWork,dampingWork,frictionWork,netResidual:rows.at(-1)?.cumulativeResidual,positiveResidual,negativeResidual,maximumPositiveResidual,
 velocityChangeLoss,contactVelocityWork,correctedResidual,absoluteCorrectedResidual,maximumCorrectedResidual,
 teeth:-(r.rows.at(-1).x[0]-start.x[0])/pitch,reverseTeeth,stoppedFraction:stoppedTime/(r.rows.at(-1).time-start.time),wrongDirectionDriveTime,cycles,strokes:[...strokes.values()]};
const report={movement:79,status:issues.length?'dynamics-assessment-invalid':'dynamics-assessment-recorded',productionChanged:false,mechanicsPassed:false,summary,issues,rows,sources,
 qualification:energy.qualification+' An assessment record is not a convergence or sustained-operation pass.'};
await writeFile(`artifacts/review/${prefix}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(summary);if(issues.length)process.exitCode=1;
