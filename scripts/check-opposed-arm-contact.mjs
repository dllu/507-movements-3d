import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeOpposedArmCandidate} from './lib/opposed-arm-candidate.mjs';
import {makeOpposedArmForceStudy} from './lib/opposed-arm-forces-study.mjs';
import {makeOpposedArmContactStudy} from './lib/opposed-arm-contact-study.mjs';
const prefix=process.env.PROBE_PREFIX??'079-contact-formulas',model=makeOpposedArmCandidate(),u=model.root.userData,f=makeOpposedArmForceStudy(model),c=makeOpposedArmContactStudy(model),sources=[],rows=[];
for(const file of ['scripts/check-opposed-arm-contact.mjs','scripts/lib/opposed-arm-candidate.mjs','scripts/lib/opposed-arm-forces-study.mjs','scripts/lib/opposed-arm-contact-study.mjs']){
 const bytes=await readFile(file),archive=`artifacts/review/${prefix}-geometry-source-${sources.length}.txt`;
 await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const area=points=>Math.abs(points.reduce((s,a,i)=>{const b=points[(i+1)%points.length];return s+a[0]*b[1]-a[1]*b[0];},0))/2,
 wheelVolume=c.cells.flat().reduce((s,cell)=>{const top=cell.vertices.slice(3);return s+area(top)*(top.reduce((s,v)=>s+v[2],0)/3-cell.vertices[0][2]);},0),
 meshVolume=geometry=>{const p=geometry.attributes.position,index=geometry.index;let sum=0;for(let i=0;i<(index?.count??p.count);i+=3){const v=[0,1,2].map(j=>[0,1,2].map(k=>p.array[(index?index.getX(i+j):i+j)*3+k]));
 sum+=(v[0][0]*(v[1][1]*v[2][2]-v[1][2]*v[2][1])+v[0][1]*(v[1][2]*v[2][0]-v[1][0]*v[2][2])+v[0][2]*(v[1][0]*v[2][1]-v[1][1]*v[2][0]))/6;}return sum;},
 volumeErrors={wheel:Math.abs(wheelVolume-meshVolume(u.parts.wheelBody.geometry))};
for(const name of ['upper','lower'])volumeErrors[name]=Math.abs(c.pawls[name].reduce((s,part)=>s+area(part.vertices.slice(part.vertices.length/2))*(part.maximum[2]-part.minimum[2]),0)-meshVolume(u.parts[name+'Pawl'].geometry));
let checked=0,skipped=0,maximumError=0,maximumInputError=0;const h=2e-7;
for(let i=0;i<24;i++){
 const time=i*f.parameters.period/24,x=[-.02*i,.29+.025*(i%7),.35+.025*(i%5)],contact=c.constraints(x,f.input(time));
 const perturbed=[0,1,2,3].map(axis=>{
  const lo=x.slice(),hi=x.slice();if(axis<3){lo[axis]-=h;hi[axis]+=h;}
  const before=c.constraints(lo,f.input(time-(axis===3?h:0))),after=c.constraints(hi,f.input(time+(axis===3?h:0)));
  return{before:new Map(before.rows.map(r=>[r.id,r])),after:new Map(after.rows.map(r=>[r.id,r]))};
 });
 for(const r of contact.rows)for(let axis=0;axis<4;axis++){
  const a=perturbed[axis].before.get(r.id),b=perturbed[axis].after.get(r.id);
  if(!a||!b||a.axisType!==r.axisType||b.axisType!==r.axisType||a.normal.reduce((s,v,k)=>s+v*b.normal[k],0)<1-1e-9){skipped++;continue;}
  const derivative=(b.gap-a.gap)/(2*h),expected=axis===3?r.inputNormalVelocity:r.J[axis],error=Math.abs(derivative-expected);
  if(axis===3)maximumInputError=Math.max(maximumInputError,error);else maximumError=Math.max(maximumError,error);
  checked++;if(error>1e-5)rows.push({i,time,x,id:r.id,axis,axisType:r.axisType,derivative,expected,error});
 }
}
const passed=Object.values(volumeErrors).every(e=>e<1e-8)&&maximumError<1e-5&&maximumInputError<1e-5&&checked>100,
 report={movement:79,status:passed?'finite-contact-formulas-passed':'finite-contact-formulas-failed',productionChanged:false,mechanicsPassed:false,passed,
 parameters:c.parameters,volumeErrors,checked,skipped,maximumError,maximumInputError,issues:rows,sources,
 qualification:'Prism and convex-partition volumes compared with the actual wheel/body meshes. SAT separation derivatives checked at differentiable sampled configurations; changes of active separating axis are counted as skipped. Boundary normal-cone and full trajectory checks remain outstanding.'};
await writeFile(`artifacts/review/${prefix}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed,volumeErrors,checked,skipped,maximumError,maximumInputError,issues:rows.slice(0,3)});if(!passed)process.exitCode=1;
