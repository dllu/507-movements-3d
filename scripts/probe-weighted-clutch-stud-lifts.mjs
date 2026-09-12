import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchLostMotionCandidate,THREE} from './lib/weighted-clutch-lost-motion-candidate.mjs';
import {inspectWeightedClutchSolid} from './lib/weighted-clutch-solid-audit.mjs';
import {makeWeightedClutchNativeStud} from './lib/weighted-clutch-native-stud.mjs';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-stud-lifts',steps=Number(process.env.PROBE_STEPS??8),
 input='artifacts/review/087-first-native-stud.json',contacts=readStudyReport(input),
 baseline=readStudyReport('artifacts/review/086-integrated-verified-source-hashes.json'),
 verify=()=>{for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);},
 sources=freezeStudySources([...contacts.sources.map(s=>s.file),'scripts/probe-weighted-clutch-stud-lifts.mjs',input],prefix),
 model=makeWeightedClutchLostMotionCandidate(),u=model.root.userData,native=makeWeightedClutchNativeStud(model),
 entries=Object.entries(u.parts),topologyCache=new Map(),cache=new Map(),pairCache=new Map(),topology=[],poses=[],pairs=[],issues=[],
 family=name=>['shaft','pinion'].includes(u.families[name])?'output':u.families[name];
verify();assert(Number.isInteger(steps)&&steps>=2&&contacts.steps%steps===0);
for(const[name,mesh]of entries){
 if(!topologyCache.has(mesh.geometry))topologyCache.set(mesh.geometry,inspectWeightedClutchSolid(mesh.geometry));
 topology.push({name,...topologyCache.get(mesh.geometry)});
}
const topologyIssues=topology.filter(r=>r.components!==1||r.volume<=0||r.degenerate||r.wrongNormals||r.nonfinite||r.unmatchedEdges),
 prepare=mesh=>{
  if(!cache.has(mesh.geometry))cache.set(mesh.geometry,{surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
  return cache.get(mesh.geometry);
 };
let checks=0,maximumContactResidual=0;
for(const direction of ['CCW','CW']){
 const branch=contacts.rows.filter(r=>r.direction===direction);let lastAngle=null;
 for(let step=0;step<=steps;step++){
  const contact=branch[step*contacts.steps/steps];let wheelAngle=contact.wheelAngle;
  if(lastAngle!==null)while(wheelAngle-lastAngle>Math.PI)wheelAngle-=2*Math.PI;
  if(lastAngle!==null)while(wheelAngle-lastAngle< -Math.PI)wheelAngle+=2*Math.PI;
  if(lastAngle!==null)assert((wheelAngle-lastAngle)*(direction==='CCW'?1:-1)>0);lastAngle=wheelAngle;
  const outputAngle=wheelAngle*u.geometry.eRatio,inputAngle=outputAngle/u.geometry.mainRatio*(direction==='CCW'?-1:1),
   state=model.setState({leverAngle:contact.leverAngle,direction:direction==='CCW'?'leftward':'rightward',inputAngle,outputAngle}),
   pose=poses.length,boxes=new Map(entries.map(([name,m])=>{m.geometry.computeBoundingBox();return[name,m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)];})),
   exact=native.evaluate(contact.leverAngle,wheelAngle);
  maximumContactResidual=Math.max(maximumContactResidual,Math.abs(exact.gap));
  let independentPairs=0,separated=0,reused=0,sampled=0,poseIssues=0;
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
   const[an,a]=entries[i],[bn,b]=entries[j];if(family(an)===family(bn))continue;independentPairs++;
   if(!boxes.get(an).intersectsBox(boxes.get(bn))){separated++;continue;}
   const transform=b.matrixWorld.clone().invert().multiply(a.matrixWorld),key=[an,bn,...transform.elements].join(',');
   if(pairCache.has(key)){
    reused++;for(const issue of pairCache.get(key).filter(r=>r.inside)){issues.push({...issue,pose,reused:true});poseIssues++;}continue;
   }
   const pair=[];
   for(const[fromName,from,toName,to,t]of [[an,a,bn,b,transform],[bn,b,an,a,transform.clone().invert()]]){
    const src=prepare(from),dst=prepare(to),point=new THREE.Vector3();let gap=.01,inside=0,witness=null;
    for(const p of src.points){
     checks++;point.copy(p).applyMatrix4(t);if(gap>0&&dst.surface.box.distanceToPoint(point)>=gap)continue;
     const d=dst.surface.signedDistance(point,.01);if(d< -1e-6)inside++;
     if(d<gap){gap=d;witness={local:point.toArray(),world:point.clone().applyMatrix4(to.matrixWorld).toArray()};}
    }
    const row={pose,from:fromName,to:toName,gap,inside,checks:src.points.length,witness};pair.push(row);pairs.push(row);
    if(inside){issues.push(row);poseIssues++;console.log(JSON.stringify(row));}
   }
   pairCache.set(key,pair);sampled++;
  }
  const row={pose,direction,step,state,contact:exact,independentPairs,separated,reused,sampled,issues:poseIssues};poses.push(row);
  console.log(JSON.stringify({pose,direction,step,leverDegrees:state.leverAngle*180/Math.PI,wheelAngle,issues:poseIssues,checks}));
 }
}
verify();verifyStudySources(sources);
const report={movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,input:{file:input,sha256:hashStudyFile(input)},
 sources,steps,topology,topologyIssues,maximumContactResidual,checks,poses,pairs,issues,
 qualification:'Native stud-contact lifting poses with E/output rotation. Motor phase matches C on forward lifting and B on return lifting, so each stroke preserves engaged-jaw phase. These separate branches are not yet connected through gravity fall or clutch reversal. Other hardware pairs use bounds or bidirectional surface samples; they do not establish continuous clearance and can miss narrow edge intersections.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({solids:topology.length,poses:poses.length,checks,issues:issues.length,topologyIssues,maximumContactResidual});
assert(!topologyIssues.length&&!issues.length&&maximumContactResidual<1e-11);
