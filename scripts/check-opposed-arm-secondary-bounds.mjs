import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeOpposedArmCandidate} from './lib/opposed-arm-candidate.mjs';
import {makeOpposedArmForceStudy} from './lib/opposed-arm-forces-study.mjs';
const input=process.env.PROBE_INPUT??'artifacts/review/079-load6-finer.json',prefix=process.env.PROBE_PREFIX??'079-finer-secondary-bounds',
 run=JSON.parse(await readFile(input,'utf8')),model=makeOpposedArmCandidate(run.geometry),u=model.root.userData,p=u.geometry,
 force=makeOpposedArmForceStudy(model,run.parameters),tolerance=1e-6,guard=1e-11,
 add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),
 mul=(a,s)=>a.map(v=>v*s),cross=(a,b)=>a[0]*b[1]-a[1]*b[0],rotate=(v,a)=>[v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a)],
 pointSegment=(p,a,b)=>{const d=sub(b,a),q=dot(d,d),s=q?Math.max(0,Math.min(1,dot(sub(p,a),d)/q)):0;return Math.hypot(...sub(p,add(a,mul(d,s))));},
 segmentDistance=(a,b,c,d)=>{const v=sub(b,a),w=sub(d,c),s=sub(c,a),den=cross(v,w);
  if(Math.abs(den)>1e-18){const x=cross(s,w)/den,y=cross(s,v)/den;if(x>=0&&x<=1&&y>=0&&y<=1)return 0;}
  return Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));},
 box=points=>({low:[0,1,2].map(i=>Math.min(...points.map(v=>v[i]))),high:[0,1,2].map(i=>Math.max(...points.map(v=>v[i])))}),
 boxGap=(a,b)=>Math.max(...a.low.map((v,i)=>Math.max(v-b.high[i],b.low[i]-a.high[i]))),
 trigRange=(a,b,lo,hi)=>{const f=t=>a*Math.cos(t)+b*Math.sin(t),values=[f(lo),f(hi)],phase=Math.atan2(b,a);
  for(let k=Math.ceil((lo-phase)/Math.PI);phase+k*Math.PI<=hi;k++)values.push(f(phase+k*Math.PI));return[Math.min(...values),Math.max(...values)];};
if(run.failures.length||run.rows.length<2)throw Error('Incomplete trajectory');
const beta=Object.fromEntries(['upper','lower'].map((key,i)=>[key,[Math.min(...run.rows.map(r=>r.x[i+1])),Math.max(...run.rows.map(r=>r.x[i+1]))]])),
 betaBox=(points,key)=>{const [lo,hi]=beta[key],low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
  for(const v of points){const ranges=[[v[0],v[0]],trigRange(v[1],-v[2],lo,hi),trigRange(v[2],v[1],lo,hi)];
   for(let i=0;i<3;i++){low[i]=Math.min(low[i],ranges[i][0]);high[i]=Math.max(high[i],ranges[i][1]);}}
  return{low,high};};
const parts=Object.entries(u.parts).map(([name,mesh])=>{
 mesh.updateMatrix();const g=mesh.geometry,pos=g.attributes.position,points=[],lookup=new Set(),triangles=[];
 for(let i=0;i<pos.count;i++){const v=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrix).toArray(),id=v.join(',');if(!lookup.has(id)){lookup.add(id);points.push(v);}}
 for(let i=0;i<(g.index?.count??pos.count);i+=3)triangles.push([0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(pos,g.index?g.index.getX(i+j):i+j).applyMatrix4(mesh.matrix).toArray()));
 const family=u.families[name],isPawl=['upper','lower'].includes(family),local=box(points),axial=isPawl?betaBox(points,family):local;
 let capsule;
 if(isPawl||family==='wheel')capsule={a:[0,0],b:[0,0],radius:Math.max(...points.map(v=>isPawl?Math.hypot(...v):Math.hypot(v[0],v[1]))),kind:'axis-circle'};
 else{
  const options=[],center=local.low.slice(0,2).map((v,i)=>(v+local.high[i])/2);let xx=0,xy=0,yy=0;
  for(const v of points){const d=sub(v.slice(0,2),center);xx+=d[0]**2;xy+=d[0]*d[1];yy+=d[1]**2;}
  const principal=.5*Math.atan2(2*xy,xx-yy);
  for(const angle of [0,Math.PI/2,principal]){const n=[Math.cos(angle),Math.sin(angle)],t=[-n[1],n[0]],along=points.map(v=>dot(v.slice(0,2),n)),side=points.map(v=>dot(v.slice(0,2),t)),
    s=(Math.min(...side)+Math.max(...side))/2,a=add(mul(n,Math.min(...along)),mul(t,s)),b=add(mul(n,Math.max(...along)),mul(t,s));
   options.push({a,b,radius:Math.max(...points.map(v=>pointSegment(v.slice(0,2),a,b))),kind:'capsule'});}
  capsule=options.sort((a,b)=>a.radius-b.radius)[0];
 }
 capsule.radius+=guard;
 return{name,mesh,family,points,triangles,capsule,low:axial.low[2]+(isPawl?p.pivotZ:0),high:axial.high[2]+(isPawl?p.pivotZ:0),local};
}),byName=Object.fromEntries(parts.map(part=>[part.name,part])),pairId=(a,b)=>[a,b].sort().join('/'),bores=new Map();
const bore=(boreName,shaftName,center,shaftCenter,axis=2)=>{
 const b=byName[boreName],s=byName[shaftName],project=(v,c)=>sub(v,c).filter((_,i)=>i!==axis);let inner=Infinity;
 for(const triangle of b.triangles){const v=triangle.map(v=>project(v,center)),area=cross(sub(v[1],v[0]),sub(v[2],v[0])),signs=v.map((a,i)=>cross(a,v[(i+1)%3]));
  if(Math.abs(area)>1e-18&&(signs.every(v=>v>=0)||signs.every(v=>v<=0))){inner=0;break;}
  for(let i=0;i<3;i++)inner=Math.min(inner,pointSegment([0,0],v[i],v[(i+1)%3]));
 }
 // Radial pin geometry is embedded in the arm's source frame. Its circular
 // projection must be measured about the same radial axis as the journal.
 const shaftPoints=axis===0?s.points.map(v=>{const xy=rotate(sub(v.slice(0,2),p.arms[b.family].pivot),-p.arms[b.family].sourceAngle);return[...xy,v[2]-p.pivotZ];}):s.points,
  outer=Math.max(...shaftPoints.map(v=>Math.hypot(...project(v,shaftCenter))));
 bores.set(pairId(boreName,shaftName),{bore:boreName,shaft:shaftName,axis,center,shaftCenter,inner,outer,gap:inner-outer-guard});
};
for(const key of ['upper','lower']){
 const a=p.arms[key];bore(key+'RadialArm','wheelAxle',[0,0,0],[0,0,0]);
 bore(key+'ConnectingRod',key+'RodPin',[0,0,0],[...a.rodJoint,0]);
 bore(key+'ConnectingRod','sliderJointPin',[a.rodLength,0,0],[0,0,0]);
 bore(key+'PawlJournal',key+'PawlRadialPin',[0,0,0],[0,0,0],0);
}
const derivatives={};
for(const key of ['upper','lower']){
 const a=p.arms[key],R=a.jointRadius,L=a.rodLength,Y=p.sourceSlider[1],xmin=p.sourceSlider[0]-force.parameters.stroke,xmax=p.sourceSlider[0]+force.parameters.stroke,
  dmin=Math.hypot(xmin,Y),dmax=Math.hypot(xmax,Y),C=d=>(d*d+R*R-L*L)/(2*R*d),cmax=Math.max(Math.abs(C(dmin)),Math.abs(C(dmax)));
 if(!(L>R&&xmin>0&&cmax<1))throw Error('Unsupported linkage');
 derivatives[key]=2*(xmax+R)/(2*R*dmin*Math.sqrt(1-cmax*cmax))*force.parameters.stroke*2*Math.PI/force.parameters.period;
}
const inputSpeed=force.parameters.stroke*2*Math.PI/force.parameters.period,
 speed=part=>{const family=part.family,r=Math.max(Math.hypot(...part.capsule.a),Math.hypot(...part.capsule.b));
  if(family==='wheel')return 0;if(family==='slider')return inputSpeed;
  const key=family.startsWith('upper')?'upper':'lower',a=p.arms[key],psi=derivatives[key];
  if(family===key)return a.pivotRadius*psi;
  if(family===key+'Arm')return r*psi;
  return a.jointRadius*psi+r*(inputSpeed+a.jointRadius*psi)/a.rodLength;
 },transform=(part,v,k)=>{
  if(part.family==='wheel')return v;if(part.family==='slider')return add(k.slider,v);
  const key=part.family.startsWith('upper')?'upper':'lower',a=k.arms[key];
  if(part.family===key)return add(a.pivot,v);
  if(part.family===key+'Arm')return rotate(v,a.q);
  return add(a.joint,rotate(v,a.rodAngle));
 },evaluate=time=>{const k=force.input(time);return Object.fromEntries(parts.map(part=>[part.name,{a:transform(part,part.capsule.a,k),b:transform(part,part.capsule.b,k)}]));},pairs=[];
for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)if(parts[i].family!==parts[j].family){
 const a=parts[i],b=parts[j],id=pairId(a.name,b.name),zGap=Math.max(a.low-b.high,b.low-a.high)-guard;let kind='capsules',minimum=Infinity;
 if(zGap>=-tolerance){kind='axial';minimum=zGap;}
 else if(bores.has(id)){kind='bore';minimum=bores.get(id).gap;}
 else if(['upperPawl/wheelBody','lowerPawl/wheelBody'].includes(id)){kind='primary-contact';}
 else{
  const pawn=[a,b].find(part=>['upper','lower'].includes(part.family)),arm=pawn&&(pawn===a?b:a);
  if(pawn&&arm.family===pawn.family+'Arm'){
   const k=p.arms[pawn.family],fixed=arm.points.map(v=>[...rotate(sub(v.slice(0,2),k.pivot),-k.sourceAngle),v[2]-p.pivotZ]),gap=boxGap(betaBox(pawn.points,pawn.family),box(fixed))-guard;
   if(gap>=-tolerance){kind='common-arm-axis';minimum=gap;}
  }
 }
 pairs.push({id,a,b,kind,minimum});
}
const moving=pairs.filter(pair=>pair.kind==='capsules');let previous=evaluate(run.rows[0].time);
for(let i=1;i<run.rows.length;i++){
 const row=run.rows[i],prior=run.rows[i-1],current=evaluate(row.time);
 for(const pair of moving){const a=previous[pair.a.name],b=previous[pair.b.name],c=current[pair.a.name],d=current[pair.b.name],
   lower=Math.min(segmentDistance(a.a,a.b,b.a,b.b),segmentDistance(c.a,c.b,d.a,d.b))-pair.a.capsule.radius-pair.b.capsule.radius-(speed(pair.a)+speed(pair.b))*(row.time-prior.time)/2-guard;
  if(lower<pair.minimum){pair.minimum=lower;pair.witness={time:prior.time,index:i-1};}
 }
 previous=current;
}
const failures=pairs.filter(pair=>pair.kind!=='primary-contact'&&pair.minimum< -tolerance).map(({a,b,...pair})=>pair),sources=[];
for(const file of ['scripts/check-opposed-arm-secondary-bounds.mjs','scripts/lib/opposed-arm-candidate.mjs','scripts/lib/opposed-arm-forces-study.mjs',input]){
 const bytes=await readFile(file),archive=`artifacts/review/${prefix}-geometry-source-${sources.length}.txt`;await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const passed=failures.length===0,classification=Object.fromEntries([...new Set(pairs.map(p=>p.kind))].map(kind=>[kind,pairs.filter(p=>p.kind===kind).length])),
 report={movement:79,status:'continuous-secondary-clearance-study',productionChanged:false,mechanicsPassed:false,passed,tolerance,guard,intervals:run.rows.length-1,
  startTime:run.rows[0].time,endTime:run.rows.at(-1).time,beta,derivatives,classification,pairs:pairs.map(({a,b,...pair})=>pair),bores:[...bores.values()],
  enclosures:parts.map(({name,family,low,high,capsule})=>({name,family,low,high,capsule})),failures,sources,
  qualification:'All independent pairs except the two wheel/pawl contact pairs are bounded throughout the supplied linear-angle trajectory. Actual Float32 vertices define axial ranges, radial holes and enclosing convex capsules; trigonometric extrema bound the radial-axis pawls. Common-arm axes and bores share exact kinematic chains. Capsule distance is 1-Lipschitz and global linkage speed bounds extend endpoint separations to each whole interval. Wheel enclosures cover every orientation. Primary contact clearance is deliberately reported separately and is not implied by this result.'};
await writeFile(`artifacts/review/${prefix}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed,classification,failures,bores:report.bores.map(b=>({bore:b.bore,shaft:b.shaft,gap:b.gap}))});if(!passed)process.exitCode=1;
