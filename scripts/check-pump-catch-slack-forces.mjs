import fs from 'node:fs';
import * as THREE from 'three';
import {makePumpCatchCandidate} from './lib/pump-catch-candidate.mjs';
import {makePumpCatchSlackDynamics} from './lib/pump-catch-slack-dynamics.mjs';
import {surfaceTriangles,solidSurface} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,verifyStudySources,freezeStudySources} from './lib/study-report-io.mjs';

const input=process.env.PROBE_INPUT??'artifacts/review/086-corrected-slack-dynamics.json.gz',prefix=process.env.PROBE_PREFIX??'artifacts/review/086-slack-force-audit',data=readStudyReport(input);verifyStudySources(data.sources);
const model=makePumpCatchCandidate(),u=model.root.userData,dynamics=makePumpCatchSlackDynamics(model,data.parameters),cache=new Map(),issues=[];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),errors={boundary:0,cone:0,momentum:0,position:0},counts={reactions:0,boundaries:0,failedReactions:0};
function boundary(mesh,point,outward){
  if(!cache.has(mesh.name))cache.set(mesh.name,{solid:solidSurface(mesh.geometry),triangles:surfaceTriangles(mesh.geometry).map(t=>({t,n:t.getNormal(new THREE.Vector3()),box:new THREE.Box3().setFromPoints([t.a,t.b,t.c])}))});
  const {solid,triangles}=cache.get(mesh.name),inverse=mesh.matrixWorld.clone().invert(),p=new THREE.Vector3(...point).applyMatrix4(inverse),n=new THREE.Vector3(...outward).transformDirection(inverse),normals=[],closest=new THREE.Vector3();
  const distance=solid.distance(p);for(const{t,n,box}of triangles)if(box.distanceToPoint(p)<1e-7&&t.closestPointToPoint(p,closest).distanceTo(p)<1e-7&&!normals.some(v=>v.distanceTo(n)<1e-10))normals.push(n);
  let cone=Infinity;for(const[i,a]of normals.entries()){
    cone=Math.min(cone,a.clone().multiplyScalar(Math.max(0,a.dot(n))).distanceTo(n));
    for(const b of normals.slice(i+1)){const ab=a.dot(b),det=1-ab*ab;if(det<1e-14)continue;const wa=(a.dot(n)-ab*b.dot(n))/det,wb=(b.dot(n)-ab*a.dot(n))/det;
      if(wa< -1e-8||wb< -1e-8)continue;cone=Math.min(cone,a.clone().multiplyScalar(Math.max(0,wa)).addScaledVector(b,Math.max(0,wb)).distanceTo(n));}
  }return{distance,cone,faces:normals.length};
}
let minimumTension=Infinity,maximumTension=0,minimumTensionTime=null;
for(let i=1;i<data.rows.length;i++){
  const r=data.rows[i],before=data.rows[i-1],h=r.time-before.time,m=dynamics.at(before.q,before.v),delta=r.v.map((v,k)=>v-before.v[k]),reaction=[0,0,0];
  model.setState({wheelAngle:r.q[0],catchAngle:r.q[1]-r.q[0],camAngle:data.angularSpeed*r.time});
  for(const c of r.active){counts.reactions++;for(let k=0;k<3;k++)reaction[k]+=c.impulse*c.gradient[k];if(['pump-stop','rope'].includes(c.kind))continue;
    const point=[...c.point,.06],normal=[...c.normal,0],other={cam:'pointedCamC',shaft:'inputShaft',stop:'fixedTripStop'}[c.kind],checks=[boundary(u.parts.hookedCatchB,point,normal.map(v=>-v)),boundary(u.parts[other],point,normal)];
    counts.boundaries+=2;for(const b of checks){errors.boundary=Math.max(errors.boundary,b.distance);errors.cone=Math.max(errors.cone,b.cone);}
    if(c.impulse<0||checks.some(b=>b.distance>1e-7||b.cone>2e-5)){counts.failedReactions++;if(issues.length<30)issues.push({time:r.time,c,checks});}
  }
  for(let k=0;k<3;k++){errors.momentum=Math.max(errors.momentum,Math.abs(dot(m.M[k],delta)-h*m.force[k]-reaction[k]));errors.position=Math.max(errors.position,Math.abs(r.q[k]-before.q[k]-h*(r.transportVelocity??r.v)[k]));}
  const tension=(r.active.find(c=>c.kind==='rope')?.impulse??0)/h;
  if(tension<minimumTension){minimumTension=tension;minimumTensionTime=r.time;}maximumTension=Math.max(maximumTension,tension);
  if(r.slack<-1e-7||r.active.some(c=>c.impulse<0)){counts.failedReactions++;if(issues.length<30)issues.push({kind:'unilateral-load',time:r.time,q:r.q,slack:r.slack});}

}
verifyStudySources(data.sources);const sources=freezeStudySources([input,'scripts/check-pump-catch-slack-forces.mjs','tests/helpers/solid-surface.mjs',...data.sources.map(s=>s.file)],prefix);
const report={movement:86,status:'independent-slack-rope-spatial-and-momentum-audit',passed:!counts.failedReactions&&errors.momentum<1e-7&&errors.position<1e-9&&minimumTension>=-1e-7,
  mechanicsPassed:false,candidateIntegrated:false,productionChanged:false,input,counts,errors,minimumTension,minimumTensionTime,maximumTension,issues,sources,
  qualification:'Every saved positive reaction is checked against both actual mesh triangle normal cones and boundaries. Momentum uses physical velocity; position uses the explicitly saved transport velocity when the impact solver separates them. Three-coordinate momentum includes the independent pump. Rope impulses and slack must be nonnegative. Force magnitudes are interval averages for rigid impacts; no finite material stress or continuous-clearance qualification is claimed.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined,issues:issues.slice(0,3)});if(!report.passed)process.exitCode=1;
