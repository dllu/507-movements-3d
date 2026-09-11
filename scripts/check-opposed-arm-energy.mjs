import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeOpposedArmCandidate} from './lib/opposed-arm-candidate.mjs';
import {makeOpposedArmForceStudy} from './lib/opposed-arm-forces-study.mjs';
import {makeOpposedArmEnergyStudy} from './lib/opposed-arm-energy-study.mjs';
const model=makeOpposedArmCandidate(),u=model.root.userData,f=makeOpposedArmForceStudy(model),energy=makeOpposedArmEnergyStudy(f,u.geometry),sources=[],rows=[],tetra=[];
for(const file of ['scripts/check-opposed-arm-energy.mjs','scripts/lib/opposed-arm-candidate.mjs','scripts/lib/opposed-arm-forces-study.mjs','scripts/lib/opposed-arm-energy-study.mjs']){
 const bytes=await readFile(file),archive=`artifacts/review/079-energy-formulas-geometry-source-${sources.length}.txt`;
 await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
for(const [name,mesh]of Object.entries(u.parts))if(['wheel','upper','lower'].includes(u.families[name])){
 const g=mesh.geometry,p=g.attributes.position,index=g.index;
 for(let i=0;i<(index?.count??p.count);i+=3){
  const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j)),mass=v[0].dot(v[1].clone().cross(v[2]))/6*f.parameters.density;
  tetra.push({family:u.families[name],mesh,points:[new THREE.Vector3(),...v],mass});
 }
}
let maximumKineticError=0,maximumPotentialError=0,maximumMomentumError=0;
for(let i=0;i<31;i++){
 const time=i*8/31,x=[-.17*i,.12+.05*(i%9),.16+.04*(i%7)],v=[-.15+.005*i,.3*Math.sin(i),-.4*Math.cos(i)],k=f.input(time),
  expected=energy.state(x,v,time),momentum={upper:0,lower:0},z=new THREE.Vector3(0,0,1);let kinetic=0,potential=0;
 u.setState({sliderX:k.sliderX,theta:x[0],upperBeta:x[1],lowerBeta:x[2]});
 for(const t of tetra){
  const key=t.family,psi=key==='wheel'?0:k.arms[key].psi,er=new THREE.Vector3(Math.cos(psi),Math.sin(psi),0),
   P=key==='wheel'?new THREE.Vector3():new THREE.Vector3(...k.arms[key].pivot,u.geometry.pivotZ),pd=key==='wheel'?v[0]:k.arms[key].psiVelocity,bd=key==='wheel'?0:v[key==='upper'?1:2],
   q=t.points.map(p=>{const H=p.clone().applyMatrix4(t.mesh.matrixWorld),yaw=z.clone().cross(H),velocity=yaw.clone().multiplyScalar(pd).addScaledVector(er.clone().cross(H.clone().sub(P)),bd);return{H,yaw,velocity};}),
   sumV=q.reduce((s,row)=>s.add(row.velocity),new THREE.Vector3()),sumYaw=q.reduce((s,row)=>s.add(row.yaw),new THREE.Vector3());
  kinetic+=t.mass*(sumV.lengthSq()+q.reduce((s,row)=>s+row.velocity.lengthSq(),0))/40;
  potential+=t.mass*f.parameters.gravity*q.reduce((s,row)=>s+row.H.y,0)/4;
  if(key!=='wheel')momentum[key]+=t.mass*(sumV.dot(sumYaw)+q.reduce((s,row)=>s+row.velocity.dot(row.yaw),0))/20;
 }
 for(const [index,key]of ['upper','lower'].entries())potential+=.5*f.parameters.spring[key]*(x[index+1]-f.parameters.restBeta[key])**2;
 const errors={kinetic:Math.abs(kinetic-expected.kinetic),potential:Math.abs(potential-expected.potential),momentum:Math.max(...['upper','lower'].map(key=>Math.abs(momentum[key]-expected.pawls[key].psiMomentum)))};
 maximumKineticError=Math.max(maximumKineticError,errors.kinetic);maximumPotentialError=Math.max(maximumPotentialError,errors.potential);maximumMomentumError=Math.max(maximumMomentumError,errors.momentum);rows.push({time,x,v,errors});
}
const passed=maximumKineticError<1e-10&&maximumPotentialError<1e-10&&maximumMomentumError<1e-10,
 report={movement:79,status:passed?'energy-formulas-passed':'energy-formulas-failed',productionChanged:false,mechanicsPassed:false,passed,maximumKineticError,maximumPotentialError,maximumMomentumError,rows,sources,
 qualification:'Kinetic energy, gravity/spring potential and prescribed-angle momentum compared with direct quadrature over the actual rendered wheel and pawl mesh tetrahedra in world coordinates.'};
await writeFile('artifacts/review/079-energy-formulas.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed,maximumKineticError,maximumPotentialError,maximumMomentumError});if(!passed)process.exitCode=1;
