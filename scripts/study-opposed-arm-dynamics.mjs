import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeOpposedArmCandidate} from './lib/opposed-arm-candidate.mjs';
import {makeOpposedArmForceStudy} from './lib/opposed-arm-forces-study.mjs';
import {makeOpposedArmContactStudy} from './lib/opposed-arm-contact-study.mjs';
import {advanceAlternatingPegStep} from './lib/alternating-peg-dynamics-study.mjs';
const prefix=process.env.PROBE_PREFIX??'079-first-dynamics',resume=process.env.PROBE_RESUME?JSON.parse(await readFile(process.env.PROBE_RESUME,'utf8')):null,
 geometry=JSON.parse(process.env.GEOMETRY_OPTIONS??JSON.stringify(resume?.geometry??{})),options={...(resume?.parameters??{}),...JSON.parse(process.env.PHYSICS_OPTIONS??'{}')},
 model=makeOpposedArmCandidate(geometry),u=model.root.userData,f=makeOpposedArmForceStudy(model,options),c=makeOpposedArmContactStudy(model),
 dt=Number(process.env.PROBE_DT??.002),duration=Number(process.env.PROBE_DURATION??2),sources=[];
let lastContact;
const physics={...f,constraints:(x,time)=>(lastContact=c.constraints(x,f.input(time)))};
for(const file of ['scripts/study-opposed-arm-dynamics.mjs','scripts/lib/opposed-arm-candidate.mjs','scripts/lib/opposed-arm-forces-study.mjs','scripts/lib/opposed-arm-contact-study.mjs',
 'scripts/lib/alternating-peg-dynamics-study.mjs','scripts/lib/jointed-tappet-dynamics-study.mjs',...(process.env.PROBE_RESUME?[process.env.PROBE_RESUME]:[])]){
 const bytes=await readFile(file),archive=`artifacts/review/${prefix}-geometry-source-${sources.length}.txt`;
 await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
let state=resume?Object.fromEntries(['time','x','v','active'].map(key=>[key,resume.rows.at(-1)[key]])):
 {time:0,x:[0,u.geometry.sourceBeta.upper,u.geometry.sourceBeta.lower],v:[0,0,0],active:[]},minimumGap=Infinity,maximumIterations=0,maximumResidual=0;
const startTime=state.time,startTheta=state.x[0];
const rows=[state],failures=[];
for(let i=0;i<Math.round(duration/dt);i++){
 const result=advanceAlternatingPegStep(physics,state,dt);
 if(!result.okay){failures.push(result);break;}state=result.state;const d=result.diagnostic;
 minimumGap=Math.min(minimumGap,d.minimumGap);maximumIterations=Math.max(maximumIterations,d.iterations);maximumResidual=Math.max(maximumResidual,d.residual);
 const contactById=new Map(lastContact.rows.map(row=>[row.id,row])),contacts=d.contacts.map(reaction=>{
  const row=contactById.get(reaction.id);if(!row)throw Error('Missing final contact '+reaction.id);
  return{...reaction,J:row.J,inputNormalVelocity:row.inputNormalVelocity,axisType:row.axisType,cellKind:row.cellKind};
 });
 rows.push({...state,...d,contacts,sliderX:f.input(state.time).sliderX});
 if((i+1)%500===0)console.log({step:i+1,time:state.time,teeth:-state.x[0]/u.geometry.pitch,minimumGap,maximumIterations});
}
const report={movement:79,status:failures.length?'finite-dynamics-study-failed':'finite-dynamics-study-ran',productionChanged:false,mechanicsPassed:false,
 geometry,parameters:f.parameters,contactParameters:c.parameters,dt,duration,startTime,endTime:state.time,resume:process.env.PROBE_RESUME??null,minimumGap,maximumIterations,maximumResidual,rows,failures,sources,
 qualification:'Exploratory three-degree-of-freedom rigid dynamics with prescribed fixed-length slider linkage, radial spring pawls, actual finite-solid SAT constraints and bidirectional output resistance. Loaded-cycle stability, time-step convergence, energy, physical contact normals and full 3D clearance remain unverified.'};
await writeFile(`artifacts/review/${prefix}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({prefix,rows:rows.length,failures:failures.map(f=>({reason:f.reason,time:f.time})),finalTeeth:-state.x[0]/u.geometry.pitch,additionalTeeth:-(state.x[0]-startTheta)/u.geometry.pitch});if(failures.length)process.exitCode=1;
