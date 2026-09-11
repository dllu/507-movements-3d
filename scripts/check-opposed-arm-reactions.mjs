import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeOpposedArmCandidate} from './lib/opposed-arm-candidate.mjs';
import {makeOpposedArmForceStudy} from './lib/opposed-arm-forces-study.mjs';
import {makeOpposedArmContactStudy} from './lib/opposed-arm-contact-study.mjs';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';
const input=process.env.PROBE_INPUT??'artifacts/review/079-first-dynamics.json',prefix=process.env.PROBE_PREFIX??'079-first-reactions',r=JSON.parse(await readFile(input,'utf8')),
 model=makeOpposedArmCandidate(r.geometry),u=model.root.userData,f=makeOpposedArmForceStudy(model,r.parameters),c=makeOpposedArmContactStudy(model),sources=[],issues=[],
 startIndex=Number(process.env.PROBE_START_INDEX??0),endIndex=Number(process.env.PROBE_END_INDEX??r.rows.length-1),
 supportPointMode=process.env.PROBE_SUPPORT_POINT==='1',supportChoices=[];
for(const file of ['scripts/check-opposed-arm-reactions.mjs','scripts/lib/opposed-arm-candidate.mjs','scripts/lib/opposed-arm-contact-study.mjs','scripts/lib/opposed-arm-forces-study.mjs','tests/helpers/solid-surface.mjs',input]){
 const bytes=await readFile(file),archive=`artifacts/review/${prefix}-geometry-source-${sources.length}.txt`;
 await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const vec=p=>new THREE.Vector3(...p),cells=new Map(c.cells.flat().map(v=>[v.id,v])),z=new THREE.Vector3(0,0,1),features={};
for(const name of ['wheelBody','upperPawl','lowerPawl'])features[name]=surfaceTriangles(u.parts[name].geometry).map(triangle=>({triangle,box:new THREE.Box3().setFromPoints([triangle.a,triangle.b,triangle.c]),normal:triangle.getNormal(new THREE.Vector3())}));
const solve=(A,b)=>{
 const n=b.length,M=A.map((row,i)=>[...row,b[i]]);
 for(let i=0;i<n;i++){
  let best=i;for(let j=i+1;j<n;j++)if(Math.abs(M[j][i])>Math.abs(M[best][i]))best=j;
  if(Math.abs(M[best][i])<1e-12)return null;[M[i],M[best]]=[M[best],M[i]];const d=M[i][i];for(let k=i;k<=n;k++)M[i][k]/=d;
  for(let j=0;j<n;j++)if(j!==i){const s=M[j][i];for(let k=i;k<=n;k++)M[j][k]-=s*M[i][k];}
 }
 return M.map(row=>row[n]);
};
const coneError=(name,point,target)=>{
 const normals=[],nearest=new THREE.Vector3();let distance=Infinity;
 for(const item of features[name]){
  if(item.box.distanceToPoint(point)>2e-7)continue;
  const d=item.triangle.closestPointToPoint(point,nearest).distanceTo(point);distance=Math.min(distance,d);
  if(d<2e-7&&!normals.some(n=>n.dot(item.normal)>1-1e-10))normals.push(item.normal);
 }
 let residual=Infinity;
 const test=indices=>{
  const A=indices.map(i=>indices.map(j=>normals[i].dot(normals[j]))),b=indices.map(i=>normals[i].dot(target)),w=solve(A,b);if(!w||w.some(v=>v< -1e-8))return;
  const n=indices.reduce((s,k,i)=>s.addScaledVector(normals[k],w[i]),new THREE.Vector3());residual=Math.min(residual,n.distanceTo(target));
 };
 for(let i=0;i<normals.length;i++){test([i]);for(let j=i+1;j<normals.length;j++){test([i,j]);for(let k=j+1;k<normals.length;k++)test([i,j,k]);}}
 return{distance,residual,faces:normals.length};
};
const closest=(A,B)=>{
 let best={distance:Infinity};const save=(a,b)=>{const d=a.distanceTo(b);if(d<best.distance)best={distance:d,a:a.clone(),b:b.clone()};};
 for(const a of A)for(const b of B)save(a,b);
 const edgePoints=(points,others,reverse)=>{
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
   const line=new THREE.Line3(points[i],points[j]);for(const p of others){const q=line.closestPointToPoint(p,true,new THREE.Vector3());if(reverse)save(p,q);else save(q,p);}
  }
 };
 edgePoints(A,B,false);edgePoints(B,A,true);
 for(let i=0;i<A.length;i++)for(let j=i+1;j<A.length;j++)for(let k=0;k<B.length;k++)for(let l=k+1;l<B.length;l++){
  const a=A[i],b=B[k],d=A[j].clone().sub(a),e=B[l].clone().sub(b),w=a.clone().sub(b),aa=d.lengthSq(),bb=d.dot(e),cc=e.lengthSq(),dd=d.dot(w),ee=e.dot(w),den=aa*cc-bb*bb;
  if(den<1e-22)continue;const s=(bb*ee-cc*dd)/den,t=(aa*ee-bb*dd)/den;
  if(s>=0&&s<=1&&t>=0&&t<=1)save(a.clone().addScaledVector(d,s),b.clone().addScaledVector(e,t));
 }
 const facePoints=(points,others,reverse)=>{
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)for(let k=j+1;k<points.length;k++){
   const t=new THREE.Triangle(points[i],points[j],points[k]);if(t.getArea()<1e-14)continue;
   for(const p of others){const q=t.closestPointToPoint(p,new THREE.Vector3());if(reverse)save(p,q);else save(q,p);}
  }
 };
 facePoints(A,B,false);facePoints(B,A,true);return best;
};
let checked=0,maximumSeparation=0,maximumConeError=0,maximumJacobianError=0,maximumBoundaryDistance=0;
for(const [index,state]of r.rows.entries()){
 if(index<startIndex||index>endIndex)continue;
 if(!state.contacts?.length)continue;
 const k=f.input(state.time);u.setState({sliderX:k.sliderX,theta:state.x[0],upperBeta:state.x[1],lowerBeta:state.x[2]});
 const rows=new Map(c.constraints(state.x,k).rows.map(v=>[v.id,v])),worldToWheel=u.parts.wheelBody.matrixWorld.clone().invert();
 for(const reaction of state.contacts){
  const row=rows.get(reaction.id);if(!row){issues.push({index,id:reaction.id,reason:'missing-contact-row'});continue;}
  const name=row.key,normal=vec(row.normal),part=c.pawls[name].find(p=>p.id===row.pin),cell=cells.get(row.cell),pawnToWheel=worldToWheel.clone().multiply(u.parts[name+'Pawl'].matrixWorld),
   P=part.vertices.map(p=>vec(p).applyMatrix4(pawnToWheel)),W=cell.vertices.map(vec),pmin=Math.min(...P.map(v=>v.dot(normal))),wmax=Math.max(...W.map(v=>v.dot(normal))),
   supportP=P.filter(v=>Math.abs(v.dot(normal)-pmin)<1e-8),supportW=W.filter(v=>Math.abs(v.dot(normal)-wmax)<1e-8),
   angle=k.arms[name].psi-state.x[0],er=new THREE.Vector3(Math.cos(angle),Math.sin(angle),0),
   pivot=er.clone().multiplyScalar(u.geometry.arms[name].pivotRadius).add(new THREE.Vector3(0,0,u.geometry.pivotZ)),
   candidates=[{kind:'nearest',...closest(supportP,supportW)},...(supportPointMode?[
    {kind:'pawl-support-center',...closest([vec(row.pawn)],supportW)},
    {kind:'wheel-support-center',...closest(supportP,[vec(row.wheel)])}]:[])],
   score=pair=>Math.max(Math.abs(-z.clone().cross(pair.b).dot(normal)-row.J[0]),
    Math.abs(er.clone().cross(pair.a.clone().sub(pivot)).dot(normal)-row.J[name==='upper'?1:2])),
   pair=candidates.filter(pair=>pair.distance<=2e-7).sort((a,b)=>score(a)-score(b))[0]??candidates[0],
   wheelToPawn=pawnToWheel.clone().invert(),Hlocal=pair.a.clone().applyMatrix4(wheelToPawn),nlocal=normal.clone().negate().transformDirection(wheelToPawn),
   wp=coneError('wheelBody',pair.b,normal),hp=coneError(name+'Pawl',Hlocal,nlocal),
   Jtheta=-z.clone().cross(pair.b).dot(normal),Jbeta=er.clone().cross(pair.a.clone().sub(pivot)).dot(normal),
   jacobianError=Math.max(Math.abs(Jtheta-row.J[0]),Math.abs(Jbeta-row.J[name==='upper'?1:2]));
  if(pair.kind!=='nearest')supportChoices.push({index,time:state.time,id:row.id,kind:pair.kind,separation:pair.distance,jacobianError,
   wheel:wp,pawl:hp,pawnPoint:pair.a.toArray(),wheelPoint:pair.b.toArray(),actualJacobian:[Jtheta,Jbeta],computedJacobian:row.J});
  maximumSeparation=Math.max(maximumSeparation,pair.distance);maximumBoundaryDistance=Math.max(maximumBoundaryDistance,wp.distance,hp.distance);
  maximumConeError=Math.max(maximumConeError,wp.residual,hp.residual);maximumJacobianError=Math.max(maximumJacobianError,jacobianError);checked++;
   if(pair.distance>2e-7||wp.distance>2e-7||hp.distance>2e-7||wp.residual>2e-5||hp.residual>2e-5||jacobianError>2e-6){
    const issue={index,time:state.time,id:row.id,axisType:row.axisType,separation:pair.distance,wheel:wp,pawl:hp,jacobianError,gap:row.gap,impulse:reaction.impulse,
     actualJacobian:[Jtheta,Jbeta],computedJacobian:row.J,normal:row.normal,pawnPoint:pair.a.toArray(),wheelPoint:pair.b.toArray(),supportP:supportP.map(v=>v.toArray()),supportW:supportW.map(v=>v.toArray())};
    issues.push(issue);console.log({issue});
   }
 }
 if(index%100===0)console.log({index,checked,issues:issues.length,maximumSeparation,maximumConeError});
}
const passed=issues.length===0&&checked>0,report={movement:79,status:passed?'physical-contact-reactions-passed':'physical-contact-reactions-failed',productionChanged:false,mechanicsPassed:false,passed,
 startIndex,endIndex,completeTrajectory:startIndex===0&&endIndex===r.rows.length-1,supportPointMode,supportChoices,checked,maximumSeparation,maximumBoundaryDistance,maximumConeError,maximumJacobianError,issues,sources,
 qualification:'Every recorded positive impulse in the requested row-index range is checked for coincident support points on the actual wheel and pawl surfaces, admissible outward triangle normal cones, and agreement with rigid-body contact moment arms. A restricted range is diagnostic only. This does not establish time-step convergence, energy balance, or continuous interpolated clearance.'};
await writeFile(`artifacts/review/${prefix}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed,checked,issues:issues.length,examples:issues.slice(0,3),maximumSeparation,maximumBoundaryDistance,maximumConeError,maximumJacobianError});if(!passed)process.exitCode=1;
