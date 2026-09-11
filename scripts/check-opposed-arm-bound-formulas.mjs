import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeOpposedArmCandidate} from './lib/opposed-arm-candidate.mjs';
import {makeOpposedArmForceStudy} from './lib/opposed-arm-forces-study.mjs';
import {makeOpposedArmContactStudy} from './lib/opposed-arm-contact-study.mjs';
import {makeOpposedArmPrimaryBounds} from './lib/opposed-arm-primary-bounds.mjs';
const input='artifacts/review/079-load6-finer.json',secondaryFile='artifacts/review/079-finer-secondary-bounds.json',prefix='079-bound-formulas',
 run=JSON.parse(await readFile(input,'utf8')),secondary=JSON.parse(await readFile(secondaryFile,'utf8')),model=makeOpposedArmCandidate(run.geometry),
 u=model.root.userData,p=u.geometry,f=makeOpposedArmForceStudy(model,run.parameters),c=makeOpposedArmContactStudy(model),bounds=makeOpposedArmPrimaryBounds(model,f,c),issues=[],sources=[],
 maxima={velocityRatio:0,accelerationRatio:0,linkVelocityRatio:0,linkAccelerationRatio:0,boreCenterError:0,boreAxisError:0},
 indices=new Set(Array.from({length:41},(_,i)=>1+Math.round((run.rows.length-2)*i/40)));
for(let k=0;k<3;k++)indices.add(run.rows.reduce((best,row,i)=>i>0&&Math.abs(row.v[k])>Math.abs(run.rows[best].v[k])?i:best,1));
let vertexChecks=0,boreChecks=0;
const vertices=Object.fromEntries(['upper','lower'].map(key=>{const pos=u.parts[key+'Pawl'].geometry.attributes.position,points=[],seen=new Set();
 for(let i=0;i<pos.count;i++){const v=new THREE.Vector3().fromBufferAttribute(pos,i),id=v.toArray().join(',');if(!seen.has(id)){seen.add(id);points.push(v);}}return[key,points];}));
for(const index of indices){
 const a=run.rows[index-1],b=run.rows[index],dt=b.time-a.time,t=(a.time+b.time)/2,h=dt/8,v=b.x.map((x,k)=>(x-a.x[k])/dt),
  xAt=time=>a.x.map((x,k)=>x+(time-a.time)*v[k]),states=[t-h,t,t+h].map(time=>{
   const x=xAt(time),k=f.input(time);u.setState({sliderX:k.sliderX,theta:x[0],upperBeta:x[1],lowerBeta:x[2]});
   const inverse=u.parts.wheelBody.matrixWorld.clone().invert();return Object.fromEntries(['upper','lower'].map(key=>[key,vertices[key].map(point=>point.clone().applyMatrix4(u.parts[key+'Pawl'].matrixWorld).applyMatrix4(inverse))]));
  });
 for(const [j,key]of ['upper','lower'].entries()){
  const r=p.arms[key].pivotRadius,rho=Math.max(...vertices[key].map(v=>v.length())),phid=bounds.parameters.derivatives[key].velocity+Math.abs(v[0]),betad=Math.abs(v[j+1]),
   velocityBound=(r+rho)*phid+rho*betad,accelerationBound=(r+rho)*(bounds.parameters.derivatives[key].acceleration+phid**2)+2*rho*phid*betad+rho*betad**2,
   actual=f.input(t).arms[key];
  maxima.linkVelocityRatio=Math.max(maxima.linkVelocityRatio,Math.abs(actual.psiVelocity)/bounds.parameters.derivatives[key].velocity);
  maxima.linkAccelerationRatio=Math.max(maxima.linkAccelerationRatio,Math.abs(actual.psiAcceleration)/bounds.parameters.derivatives[key].acceleration);
  for(let i=0;i<vertices[key].length;i++){
   const velocity=states[2][key][i].clone().sub(states[0][key][i]).multiplyScalar(1/(2*h)).length(),
    acceleration=states[2][key][i].clone().add(states[0][key][i]).addScaledVector(states[1][key][i],-2).multiplyScalar(1/(h*h)).length();
   maxima.velocityRatio=Math.max(maxima.velocityRatio,velocity/velocityBound);maxima.accelerationRatio=Math.max(maxima.accelerationRatio,acceleration/accelerationBound);vertexChecks++;
   if(velocity>velocityBound+1e-6||acceleration>accelerationBound+1e-4)issues.push({index,key,vertex:i,velocity,velocityBound,acceleration,accelerationBound});
  }
 }
}
// Validate the eight declared bearing chains against independently composed
// scene matrices across a complete input period and both pawl angle limits.
for(let i=0;i<=100;i++){
 const k=f.input(i*f.parameters.period/100);u.setState({sliderX:k.sliderX,theta:i*.17,upperBeta:secondary.beta.upper[i%2],lowerBeta:secondary.beta.lower[i%2]});
 for(const bore of secondary.bores){
  const b=u.parts[bore.bore],s=u.parts[bore.shaft],key=bore.bore.startsWith('upper')?'upper':'lower';let centerS,axisS;
  if(bore.axis===0){centerS=new THREE.Vector3(...p.arms[key].pivot,p.pivotZ);axisS=new THREE.Vector3(Math.cos(p.arms[key].sourceAngle),Math.sin(p.arms[key].sourceAngle),0);}
  else{centerS=new THREE.Vector3(...bore.shaftCenter);axisS=new THREE.Vector3(0,0,1);}
  const centerB=new THREE.Vector3(...bore.center).applyMatrix4(b.parent.matrixWorld),worldS=centerS.applyMatrix4(s.parent.matrixWorld),
   axisB=new THREE.Vector3(bore.axis===0?1:0,0,bore.axis===2?1:0).transformDirection(b.parent.matrixWorld),worldAxisS=axisS.transformDirection(s.parent.matrixWorld),
   centerError=centerB.distanceTo(worldS),axisError=1-Math.abs(axisB.dot(worldAxisS));
  maxima.boreCenterError=Math.max(maxima.boreCenterError,centerError);maxima.boreAxisError=Math.max(maxima.boreAxisError,Math.abs(axisError));boreChecks++;
  if(centerError>1e-12||Math.abs(axisError)>1e-12)issues.push({i,bore:bore.bore,shaft:bore.shaft,centerError,axisError});
 }
}
for(const file of ['scripts/check-opposed-arm-bound-formulas.mjs','scripts/lib/opposed-arm-primary-bounds.mjs','scripts/check-opposed-arm-secondary-bounds.mjs',
 'scripts/lib/opposed-arm-candidate.mjs','scripts/lib/opposed-arm-forces-study.mjs','scripts/lib/opposed-arm-contact-study.mjs',input,secondaryFile]){
 const bytes=await readFile(file),archive=`artifacts/review/${prefix}-geometry-source-${sources.length}.txt`;await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const passed=issues.length===0,report={movement:79,status:'bound-formula-cross-check',productionChanged:false,mechanicsPassed:false,passed,intervals:indices.size,vertexChecks,boreChecks,maxima,issues,sources,
 qualification:'Independent scene-matrix finite differences check the analytic relative-vertex speed/acceleration bounds, and scene-matrix bearing centers and axes check all eight declared common chains. Sampled formula validation supplements the continuous mathematical bounds; it does not replace them or qualify the currently rejected primary interpolation.'};
await writeFile(`artifacts/review/${prefix}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed,vertexChecks,boreChecks,maxima,issues:issues.slice(0,3)});if(!passed)process.exitCode=1;
