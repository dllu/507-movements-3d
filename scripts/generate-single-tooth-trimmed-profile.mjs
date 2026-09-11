import { readFile, writeFile } from 'node:fs/promises';
import clipping from 'polygon-clipping';
import { makeSingleToothSourceDriver } from './lib/single-tooth-source-driver.mjs';

const studyFile=process.env.STUDY_FILE??'068-seated-relief-3200.json';
const suffix=process.env.CANDIDATE_SUFFIX??'trimmed-source';
const study=JSON.parse(await readFile(`artifacts/review/${studyFile}`,'utf8'));
if(study.failed.length||study.poses!==study.parameters.phaseSteps+1)throw new Error('Complete seated projection required');
const p={...study.parameters,sourceAngle:Math.PI/4,depth:.24,driverSpeed:1,period:2*Math.PI,
  halfPitch:study.parameters.pitch/2,clearance:.00015};
const significant=study.rows.filter(r=>r.advance>1e-8);
p.entryTime=p.sourceAngle-(study.entryEvent?.angle??significant[0].angle);p.exitTime=p.sourceAngle-significant.at(-1).angle;
p.cycleClosureError=study.actualAdvance-p.pitch;
const circle=(x,y,r,n=4096)=>[Array.from({length:n},(_,i)=>[x+r*Math.cos(2*Math.PI*i/n),y+r*Math.sin(2*Math.PI*i/n)])];
const rotate=(poly,a)=>poly.map(ring=>ring.map(([x,y])=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)]));
const cuts=[];
const slot=clipping.union(circle(-p.slotCenter,0,p.slotRadius,1024),
  [[[-1.7,-p.slotRadius],[-p.slotCenter,-p.slotRadius],[-p.slotCenter,p.slotRadius],[-1.7,p.slotRadius]]]);
for(let i=0;i<p.notches;i++) {
  cuts.push(slot.map(poly=>rotate(poly,i*p.pitch)));
  cuts.push(rotate(circle(-p.centerDistance,0,p.driverRadius+.00015),i*p.pitch+p.pitch/2));
}
const output=clipping.difference(circle(0,0,p.outputRadius),...cuts);
if(output.length!==1)throw new Error('Disconnected output');
const driver=makeSingleToothSourceDriver({circleSteps:4096,curveSteps:128,
  upperReliefExtension:p.upperReliefExtension,clipReliefToRim:p.clipReliefToRim,upperReliefMode:p.upperReliefMode});
const data={parameters:p,driver,output:output[0],motionRows:study.rows.map(r=>[r.angle,r.q])};
if(study.entryEvent){
  const {angle,outputAngle}=study.entryEvent;
  const index=data.motionRows.findIndex(row=>row[0]<angle);
  data.motionRows.splice(index,0,[angle,outputAngle]);
}
await writeFile(`scripts/lib/single-tooth-${suffix}-profile.mjs`,
  '// Isolated source-fit and sampled contact candidate; not mechanically certified.\nexport default '+JSON.stringify(data)+';\n',{flag:'wx'});
await writeFile(`artifacts/review/068-${suffix}-profile.json`,JSON.stringify({movement:68,status:'isolated-quasistatic-candidate',
  parameters:p,driverVertices:driver[0].length,outputVertices:output[0][0].length,
  study:studyFile,qualification:'U-notch geometry, constrained sampled motion and relief trimming. Complete independent solid/force/cycle audits remain pending.'},null,2)+'\n',{flag:'wx'});
console.log({driverVertices:driver[0].length,outputVertices:output[0][0].length,cycleClosureError:p.cycleClosureError});
