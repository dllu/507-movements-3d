import fs from 'node:fs';
import {makePumpCatchBoundsContact} from './lib/pump-catch-bounds-contact.mjs';
import {pumpCatchRope} from './lib/pump-catch-rope.mjs';
import * as THREE from 'three';
import {makePumpCatchCompleteCandidate} from './lib/pump-catch-complete-candidate.mjs';
import {makePumpCatchSlackDynamics} from './lib/pump-catch-slack-dynamics.mjs';
import {surfaceTriangles,solidSurface} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,verifyStudySources,freezeStudySources} from './lib/study-report-io.mjs';

const input=process.env.PROBE_INPUT??'artifacts/review/086-quarter-ms-hybrid.json.gz',prefix=process.env.PROBE_PREFIX??'artifacts/review/086-quarter-ms-hybrid-forces',data=readStudyReport(input);verifyStudySources(data.sources);
const model=makePumpCatchCompleteCandidate(),u=model.root.userData,dynamics=makePumpCatchSlackDynamics(model,data.parameters),cache=new Map(),issues=[],contact=makePumpCatchBoundsContact(model);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),errors={boundary:0,cone:0,moment:0,momentum:0,position:0,stage:0,stageGap:0},counts={reactions:0,boundaries:0,failedReactions:0,smoothStages:0};
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
  model.setRigidState({wheelAngle:r.q[0],catchAngle:r.q[1]-r.q[0],camAngle:data.angularSpeed*r.time});
  for(const c of r.active){counts.reactions++;for(let k=0;k<3;k++)reaction[k]+=c.impulse*c.gradient[k];if(['pump-stop','rope'].includes(c.kind))continue;
    const point=[...c.point,c.pointZ??.06],normal=[...c.normal,0],other=c.otherPart??{cam:'pointedCamC',shaft:'inputShaft',stop:'fixedTripStop'}[c.kind],checks=[boundary(u.parts[c.catchPart??'hookedCatchB'],point,normal.map(v=>-v)),boundary(u.parts[other],point,normal)];
    const P=new THREE.Vector3().setFromMatrixPosition(u.blocks.catch.matrixWorld),arm=(point[0]-P.x)*normal[1]-(point[1]-P.y)*normal[0],
      expected=c.kind==='heel'?[-arm,arm,0]:[P.x*normal[1]-P.y*normal[0],arm,0];
    for(let k=0;k<3;k++)errors.moment=Math.max(errors.moment,Math.abs(c.gradient[k]-expected[k]));
    counts.boundaries+=2;for(const b of checks){errors.boundary=Math.max(errors.boundary,b.distance);errors.cone=Math.max(errors.cone,b.cone);}
    if(c.impulse<0||checks.some(b=>b.distance>1e-7||b.cone>2e-5)){counts.failedReactions++;if(issues.length<30)issues.push({time:r.time,c,checks});}
  }
  for(let k=0;k<3;k++){if(!r.integration)errors.momentum=Math.max(errors.momentum,Math.abs(dot(m.M[k],delta)-h*m.force[k]-reaction[k]));errors.position=Math.max(errors.position,Math.abs(r.q[k]-before.q[k]-h*(r.transportVelocity??r.v)[k]));}
  if(r.integration){
    const weights=[1/6,1/3,1/3,1/6],offsets=[0,.5,.5,1],meanReaction=[0,0,0];
    if(r.integration!=='rk4-linear-constraints'||r.stages.length!==4)throw Error('Unknown smooth integrator');
    for(let j=0;j<4;j++){
      const s=r.stages[j],mass=dynamics.at(s.q,s.v),stageReaction=[0,0,0],previous=j===0?null:r.stages[j-1];counts.smoothStages++;
      if(s.weight!==weights[j])throw Error('Changed quadrature weight');
      for(let k=0;k<3;k++){
        errors.stage=Math.max(errors.stage,Math.abs(s.q[k]-before.q[k]-(previous?h*offsets[j]*previous.v[k]:0)),
          Math.abs(s.v[k]-before.v[k]-(previous?h*offsets[j]*previous.acceleration[k]:0)));
      }
      for(const c of s.reactions){
        if(c.force< -1e-9)throw Error('Negative smooth reaction');
        const end=r.active.find(a=>a.kind===c.kind);if(!end)throw Error('Missing smooth reaction at endpoint');
        for(let k=0;k<3;k++){
          errors.moment=Math.max(errors.moment,Math.abs(c.gradient[k]-end.gradient[k]));stageReaction[k]+=c.force*c.gradient[k];
          meanReaction[k]+=h*weights[j]*c.force*c.gradient[k];
        }
        errors.stage=Math.max(errors.stage,Math.abs(dot(c.gradient,s.v)));
      }
      for(let k=0;k<3;k++)errors.momentum=Math.max(errors.momentum,Math.abs(dot(mass.M[k],s.acceleration)-mass.force[k]-stageReaction[k]));
      const gap=Math.min(contact.minimumRawGap(s.q,data.angularSpeed*(before.time+offsets[j]*h)),pumpCatchRope(s.q,data.parameters).gap,
        s.q[2]-(data.parameters.pumpStopHeight??-Infinity));errors.stageGap=Math.max(errors.stageGap,-gap);
    }
    for(let k=0;k<3;k++){
      errors.stage=Math.max(errors.stage,Math.abs(r.q[k]-before.q[k]-h*r.stages.reduce((sum,s,j)=>sum+weights[j]*s.v[k],0)),
        Math.abs(r.v[k]-before.v[k]-h*r.stages.reduce((sum,s,j)=>sum+weights[j]*s.acceleration[k],0)));
      errors.momentum=Math.max(errors.momentum,Math.abs(meanReaction[k]-reaction[k]));
    }
  }
  const tension=(r.active.find(c=>c.kind==='rope')?.impulse??0)/h;
  if(tension<minimumTension){minimumTension=tension;minimumTensionTime=r.time;}maximumTension=Math.max(maximumTension,tension);
  if(r.slack<-1e-7||r.q[2]<(data.parameters.pumpStopHeight??-Infinity)-1e-7||r.active.some(c=>c.impulse<0)){counts.failedReactions++;if(issues.length<30)issues.push({kind:'unilateral-load',time:r.time,q:r.q,slack:r.slack});}

}
verifyStudySources(data.sources);const sources=freezeStudySources([input,'scripts/check-pump-catch-hybrid-forces.mjs','scripts/lib/pump-catch-weighted-candidate.mjs','tests/helpers/solid-surface.mjs',...data.sources.map(s=>s.file)],prefix);
const report={movement:86,status:'independent-slack-rope-spatial-and-momentum-audit',passed:!counts.failedReactions&&errors.moment<1e-8&&errors.momentum<1e-7&&errors.position<1e-9&&minimumTension>=-1e-7&&errors.stage<1e-8&&errors.stageGap<2e-8,
  mechanicsPassed:false,candidateIntegrated:false,productionChanged:false,input,counts,errors,minimumTension,minimumTensionTime,maximumTension,issues,sources,
  qualification:'Every endpoint reaction is checked against both actual mesh triangle normal cones and boundaries. Momentum uses physical velocity; position uses the explicitly saved transport velocity when the impact solver separates them. Smooth stages additionally satisfy full three-coordinate force balance, zero velocity at their linear constraints, RK stage/endpoint reconstruction, nonnegative reactions and actual finite-gap checks. Impact rows retain the independent discrete momentum audit. Rope impulses and slack must be nonnegative. Force magnitudes are interval averages for rigid impacts; no finite material stress or continuous-clearance qualification is claimed.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined,issues:issues.slice(0,3)});if(!report.passed)process.exitCode=1;
