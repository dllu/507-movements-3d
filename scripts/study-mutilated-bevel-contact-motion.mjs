import{readFile,writeFile}from'node:fs/promises';
import{makeMutilatedBevelCandidate}from'./lib/mutilated-bevel-candidate.mjs';
import{applySectorRelief}from'./lib/mutilated-bevel-tooth-relief.mjs';
import{prepareBevelAngularOverlap}from'./lib/bevel-angular-overlap.mjs';
import{setSpin}from'../src/simulation/primitives.js';

const file=process.env.RELIEF_FILE??'artifacts/review/074-continuous-relief-study.json',relief=JSON.parse(await readFile(file,'utf8')),model=makeMutilatedBevelCandidate(relief.parameters);
applySectorRelief(model,relief);const{blocks:b,geometry:p}=model.root.userData,overlap=prepareBevelAngularOverlap(b.gearA,b.driverC);
const steps=Number(process.env.MOTION_STEPS??720),cycles=Number(process.env.MOTION_CYCLES??3),start=.25,areaTolerance=1e-13,
  pitch=2*Math.PI/p.outputTeeth,rows=[],releaseExtrema=[];let angle=model.root.userData.kinematics.angleA,failure=null,evaluations=0;
const evaluateAt=(coordinate,q)=>{model.update((coordinate-p.initialCyclePhase)*p.period);setSpin(b.gearA,q);model.root.updateMatrixWorld(true);evaluations++;return overlap();};
const requiredAngle=(coordinate,previous)=>{
  const initial=evaluateAt(coordinate,previous);if(initial.maximumArea<=areaTolerance)return previous;
  let low=previous,high=model.root.userData.kinematics.angleA;
  if(high<=low||high-low>=pitch/2||evaluateAt(coordinate,high).maximumArea>areaTolerance)throw new Error('Unverified release bracket');
  for(let i=0;i<34;i++){const middle=(low+high)/2;if(evaluateAt(coordinate,middle).maximumArea>areaTolerance)low=middle;else high=middle;}
  return high;
};
for(let step=0;step<=steps*cycles;step++){
  const coordinate=start+step/steps,previous=angle;model.update((coordinate-p.initialCyclePhase)*p.period);
  const evaluate=q=>{setSpin(b.gearA,q);model.root.updateMatrixWorld(true);evaluations++;return overlap();};
  const atPrevious=evaluate(previous);let contact=null;
  if(atPrevious.maximumArea>areaTolerance){
    // The nominal pose is independently checked clear and only supplies a
    // bracket endpoint. A geometric search with expanding jumps can step over
    // the narrow backlash interval and hit the opposite tooth flank.
    let low=previous,high=model.root.userData.kinematics.angleA,state=evaluate(high);
    if(high<=low||high-low>=pitch/2||state.maximumArea>areaTolerance){failure={step,coordinate,previous,high,reason:'No verified nearby forward clearance bracket',state};break;}
    for(let i=0;i<32;i++){
      const middle=(low+high)/2,state=evaluate(middle);
      if(state.maximumArea>areaTolerance){low=middle;contact=state.witness;}else high=middle;
    }
    angle=high;
  }
  let releaseMaximum=null;
  if(process.env.REFINE_RELEASE==='1'&&step&&!model.root.userData.kinematics.indexingA){
    // During release a relieved flank can reach a local maximum and recede
    // between input samples. Passive bearing friction retains the maximum
    // angle reached, rather than following that receding boundary backwards.
    const left=coordinate-1/steps,epsilon=Math.min(1e-6,1/(512*steps)),
      samples=[...Array.from({length:9},(_,i)=>left+i/(8*steps)),left+epsilon,coordinate-epsilon]
        .sort((a,b)=>a-b).map(coordinate=>({coordinate}));
    for(const sample of samples)sample.angle=requiredAngle(sample.coordinate,previous);
    for(let i=1;i<samples.length-1;i++)if(samples[i].angle>samples[i-1].angle+1e-10&&samples[i].angle>=samples[i+1].angle){
      let lo=samples[i-1].coordinate,hi=samples[i+1].coordinate;
      for(let j=0;j<28;j++){
        const x=lo+(hi-lo)/3,y=hi-(hi-lo)/3;
        if(requiredAngle(x,previous)<requiredAngle(y,previous))lo=x;else hi=y;
      }
      const u=(lo+hi)/2,q=requiredAngle(u,previous);
      if(q>angle){angle=q;releaseMaximum={coordinate:u,angle:q};}
    }
    for(const sample of samples)if(sample.angle>angle){angle=sample.angle;releaseMaximum=sample;}
    if(releaseMaximum){releaseExtrema.push(releaseMaximum);contact=null;}
  }
  model.update((coordinate-p.initialCyclePhase)*p.period);
  const final=evaluate(angle);
  rows.push({step,coordinate,angle,advance:angle-previous,ratio:step?(angle-previous)*steps/(2*Math.PI):0,contact,
    maximumOverlapArea:final.maximumArea,nominalAngle:model.root.userData.kinematics.angleA,releaseMaximum});
  if(step%steps===0)console.log({step,coordinate,angle,evaluations});
}
const repeat=[];
for(let i=steps;i<rows.length;i++)repeat.push({step:i,error:rows[i].angle-rows[i-steps].angle-Math.PI*p.ratio});
const finalCycle=rows.filter(r=>r.step>steps*(cycles-1));
const report={movement:74,status:'isolated-contact-continuation',productionChanged:false,relief:file,parameters:p,steps,cycles,evaluations,rows,failure,releaseExtrema,
  peakRatio:Math.max(...rows.map(r=>r.ratio)),finalCycleMovingPoses:finalCycle.filter(r=>r.advance>1e-8).length,
  finalCycleRepeatError:finalCycle.length?Math.max(...repeat.filter(r=>r.step>steps*(cycles-1)).map(r=>Math.abs(r.error))):null,
  qualification:'Quasistatic forward contact continuation with ideal bearing friction retaining an unforced output. When the prior angle intersects an advancing driver tooth, the first nearby forward clearance boundary supplies the candidate angle. This is not a positive lock. Angular overlap still needs a common-radius material proof, force-direction checks, input-step convergence, exact mesh contact and full hardware verification. The half-pitch bound diagnoses branch loss rather than supplying a constraint.'};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/074-contact-motion-study.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({failure,poses:rows.length,evaluations,peakRatio:report.peakRatio,finalCycleMovingPoses:report.finalCycleMovingPoses,finalCycleRepeatError:report.finalCycleRepeatError});
