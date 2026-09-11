import { readFile, writeFile } from 'node:fs/promises';
import { makeMutilatedBevelCandidate } from './lib/mutilated-bevel-candidate.mjs';
import { applySectorRelief } from './lib/mutilated-bevel-tooth-relief.mjs';
import { prepareBevelAngularOverlap } from './lib/bevel-angular-overlap.mjs';
import { makeMutilatedBevelContactSpline } from './lib/mutilated-bevel-contact-spline.mjs';
import { setSpin } from '../src/simulation/primitives.js';

const motionFile=process.argv[2]??'artifacts/review/074-fitted-contact-motion-1440.json',motion=JSON.parse(await readFile(motionFile,'utf8')),
  relief=JSON.parse(await readFile(motion.relief,'utf8')),model=makeMutilatedBevelCandidate(relief.parameters);applySectorRelief(model,relief);
const {blocks:b,geometry:p}=model.root.userData,overlap=prepareBevelAngularOverlap(b.gearA,b.driverC),offset=motion.steps*(motion.cycles-1),base=motion.rows[offset].coordinate,
  advance=Math.PI*p.ratio,referenceCycle=Math.floor(base),angleOffset=referenceCycle*advance,areaTolerance=1e-13,errorTolerance=2e-7,
  source=motion.rows.slice(offset),extrema=motion.releaseExtrema.filter(e=>e.coordinate>=base&&e.coordinate<=base+1),cache=new Map(),rounds=[];
let evaluations=0;
const exact=x=>{
  if(cache.has(x))return cache.get(x);
  const coordinate=base+x,index=Math.min(motion.steps,Math.floor(x*motion.steps+1e-9));
  let low=source[index].angle;for(const event of extrema)if(event.coordinate<=coordinate)low=Math.max(low,event.angle);
  model.update((coordinate-p.initialCyclePhase)*p.period);
  const evaluate=q=>{setSpin(b.gearA,q);model.root.updateMatrixWorld(true);evaluations++;return overlap().maximumArea;};
  if(evaluate(low)>areaTolerance){
    let high=model.root.userData.kinematics.angleA;
    if(high<=low||evaluate(high)>areaTolerance)throw new Error('No clear spline reference bracket at '+coordinate);
    for(let i=0;i<35;i++){const middle=(low+high)/2;if(evaluate(middle)>areaTolerance)low=middle;else high=middle;}
    low=high;
  }
  const value=low-angleOffset;cache.set(x,value);return value;
};
let nodes=[...source.map(r=>[r.coordinate-base,r.angle-angleOffset]),...extrema.map(r=>[r.coordinate-base,r.angle-angleOffset])]
  .sort((a,b)=>a[0]-b[0]).filter((r,i,a)=>i===0||r[0]-a[i-1][0]>1e-14);
nodes[0][0]=0;nodes.at(-1)[0]=1;
for(const node of nodes)cache.set(node[0],node[1]);
let finished=false;
for(let round=0;round<12;round++){
  const spline=makeMutilatedBevelContactSpline(nodes),additions=[];let maximumError=0,worst=null;
  for(const interval of spline.intervals)for(const fraction of [.211,.5,.789]){
    const x=interval.start+fraction*interval.width,value=exact(x),predicted=spline.at(x).angle,error=Math.abs(predicted-value);
    if(error>maximumError){maximumError=error;worst={x,predicted,actual:value,error};}
    if(error>errorTolerance)additions.push([x,value]);
  }
  const result={round,nodes:nodes.length,additions:additions.length,maximumError,worst,evaluations};rounds.push(result);console.log(result);
  if(!additions.length){finished=true;break;}
  nodes=[...nodes,...additions].sort((a,b)=>a[0]-b[0]);
}
const spline=makeMutilatedBevelContactSpline(nodes),validation=[];
if(finished)for(const interval of spline.intervals)for(const fraction of [.139,.367,.683,.911]){
  const x=interval.start+fraction*interval.width,actual=exact(x),predicted=spline.at(x).angle,error=predicted-actual;
  validation.push({x,error});
}
const maximumValidationError=validation.length?Math.max(...validation.map(r=>Math.abs(r.error))):null;
const report={movement:74,status:'isolated-contact-spline-bake',productionChanged:false,motionFile,relief:motion.relief,parameters:p,
  profile:{base:base-referenceCycle,advance,nodes},rounds,evaluations,referenceQueries:cache.size,errorTolerance,finished,
  validationPoses:validation.length,maximumValidationError,worstValidation:validation.sort((a,b)=>Math.abs(b.error)-Math.abs(a.error)).slice(0,20),
  qualification:'Monotone cubic interpolation of the actual contact solution, with the independently refined release maxima inserted as knots. Refinement probes and fresh validation fractions compare against angular-interference root solves that preserve prior motion and release maxima. This is a numerical interpolation study, not continuous collision or production acceptance. Independent Float32 surface probes must validate the final runtime.'};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/074-contact-spline-bake.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({finished,nodes:nodes.length,maximumValidationError,evaluations});
if(!finished||maximumValidationError>errorTolerance*2)process.exitCode=1;
