import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchKeyCandidate,THREE} from './lib/weighted-clutch-key-candidate.mjs';
import {makeWeightedClutchKeyNeutral} from './lib/weighted-clutch-key-neutral.mjs';
import {rotate2} from './lib/weighted-clutch-native-contours.mjs';
import {solidSurface} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-key-jaw-impact',
 input=process.env.PROBE_INPUT??'artifacts/review/087-quarter-key-neutral.json',parent=readStudyReport(input),
 priorFile='artifacts/review/087-first-key-impact.json',prior=readStudyReport(priorFile),
 sources=freezeStudySources([...parent.sources.map(s=>s.file),input,priorFile,'scripts/study-weighted-clutch-key-jaw-impact.mjs'],prefix),
 model=makeWeightedClutchKeyCandidate(),u=model.root.userData,rows=[],surfaces=new Map(),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
verifyStudySources(parent.sources);
for(const branch of parent.summaries){
 const original=prior.rows.find(r=>r.direction===branch.direction&&r.staticCoefficient===.78),
  d=makeWeightedClutchKeyNeutral(model,original.profile,original),end=branch.end,q=end.q,v=end.v,
  side=end.oppositeJaw.side,delta=end.oppositeJaw.relativeAngle,m=d.mass(q),derivatives=[];
 assert(end.oppositeJawImpact);
 for(const h of [1e-5,2e-6,4e-7])derivatives.push({h,value:(d.jaws.evaluate(side,delta+h,q[2]).gap-d.jaws.evaluate(side,delta-h,q[2]).gap)/(2*h)});
 const derivative=derivatives.at(-1).value,inputGradient=(side==='left'?-1:1)*u.geometry.mainRatio*derivative,
  jaw={kind:'opposite-jaw-'+side,gap:end.oppositeJaw.gap,gradient:[0,0,side==='left'?1:-1,0,derivative],inputGradient,
   target:-inputGradient*d.parameters.omegaInput},
  constraints=[...d.query(q,end.time).filter(c=>c.gap<2e-8).map(c=>({...c,target:-c.inputGradient*d.parameters.omegaInput})),jaw],
  impact=d.project(v,m,constraints,v[2]),momentum=impact.v.map((value,k)=>m[k]*(value-v[k])-
   impact.active.reduce((s,c)=>s+c.impulse*c.gradient[k]+c.tangentImpulse*(c.tangent?.[k]??0),0)),directions=[];
 for(const eps of [1e-4,2e-5,4e-6]){
  const future=q.map((x,k)=>x+eps*impact.v[k]),time=end.time+eps,phase=d.phase(future,time),opposite=d.opposite(future,time,true),
   former=d.jaws.evaluate(original.side,phase.relative,future[2]);
  directions.push({eps,oppositeGap:opposite.gap,formerGap:former.gap,otherGaps:d.query(future,time).map(c=>({kind:c.kind,gap:c.gap}))});
 }
 const looseSpin=(side==='left'?1:-1)*u.geometry.mainRatio*end.phase.input,p=end.oppositeJaw.witness.pointLoose,
  yz=rotate2(p.slice(1),looseSpin),world=[p[0],...yz],witnessDistances={};
 model.setCoordinates(q,end.phase.input);
 for(const name of [side+'LooseJaw',side+'SlidingJaw']){
  const mesh=u.parts[name];if(!surfaces.has(mesh.geometry))surfaces.set(mesh.geometry,solidSurface(mesh.geometry));
  witnessDistances[name]=surfaces.get(mesh.geometry).signedDistance(new THREE.Vector3(...world).applyMatrix4(mesh.matrixWorld.clone().invert()),.02);
 }
 const row={direction:branch.direction,side,time:end.time,q,velocityBefore:v,velocityAfter:impact.v,phase:end.phase,relativeAngle:delta,
  originalProfile:original.profile,friction:{staticCoefficient:original.staticCoefficient,kineticCoefficient:original.kineticCoefficient},
  mass:m,derivatives,maximumDerivativeDifference:Math.max(...derivatives.map(r=>Math.abs(r.value-derivative))),constraints,impact,
  momentumResidual:momentum,closingRateBefore:dot(jaw.gradient,v)-jaw.target,closingRateAfter:dot(jaw.gradient,impact.v)-jaw.target,
  shaftReverses:v[3]*impact.v[3]<0,clutchReverses:v[4]*impact.v[4]<0,directions,worldWitness:world,witnessDistances};
 rows.push(row);console.log({direction:row.direction,side,time:end.time,delta,before:v,after:impact.v,mode:impact.mode,
  shaftReverses:row.shaftReverses,clutchReverses:row.clutchReverses,active:impact.active.map(c=>c.kind),witnessDistances});
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,rows,
 qualification:'First native opposite-jaw impulse reached continuously from the loaded key-friction withdrawal states. Both shaft and D remain independent; friction uses only an actually loaded feather wall. Derivatives, momentum, Coulomb impulse energy and full-solid witness positions are checked. Loaded seating and a connected second lift remain pending.'})+'\n',{flag:'wx'});
for(const r of rows){
 assert(r.maximumDerivativeDifference<1e-5&&Math.max(...r.momentumResidual.map(Math.abs))<1e-9&&Math.abs(r.impact.impulseEnergyResidual)<1e-9);
 assert(r.impact.active.every(c=>c.impulse> -1e-12)&&Math.abs(r.closingRateAfter)<1e-9);
 assert(Math.max(...Object.values(r.witnessDistances).map(Math.abs))<1e-9&&r.directions.at(-1).oppositeGap> -1e-8);
}
