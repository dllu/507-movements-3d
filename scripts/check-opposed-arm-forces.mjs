import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeOpposedArmCandidate} from './lib/opposed-arm-candidate.mjs';
import {makeOpposedArmForceStudy} from './lib/opposed-arm-forces-study.mjs';
const model=makeOpposedArmCandidate(),u=model.root.userData,physics=makeOpposedArmForceStudy(model),sources=[],tetra={};
for(const file of ['scripts/check-opposed-arm-forces.mjs','scripts/lib/opposed-arm-candidate.mjs','scripts/lib/opposed-arm-forces-study.mjs']){
 const bytes=await readFile(file),archive=`artifacts/review/079-force-formulas-geometry-source-${sources.length}.txt`;
 await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
for(const key of ['upper','lower']){
 tetra[key]=[];
 for(const [name,mesh]of Object.entries(u.parts))if(u.families[name]===key){
  mesh.updateMatrix();const g=mesh.geometry,p=g.attributes.position,index=g.index;
  for(let i=0;i<(index?.count??p.count);i+=3){
   const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrix)),volume=v[0].dot(v[1].clone().cross(v[2]))/6;
   tetra[key].push({points:[new THREE.Vector3(),...v],mass:volume*physics.parameters.density});
  }
 }
}
// Independent direct quadrature of affine rigid-body velocities at the four
// vertices of each signed tetrahedron. No precomputed inertia tensors used.
const direct=(key,beta,psi,bd,pd)=>{
 const R=new THREE.Matrix4().makeRotationZ(psi).multiply(new THREE.Matrix4().makeRotationX(beta)),
  er=new THREE.Vector3(Math.cos(psi),Math.sin(psi),0),ez=new THREE.Vector3(0,0,1),P=er.clone().multiplyScalar(u.geometry.arms[key].pivotRadius);
 let kinetic=0,potential=0,momentum=0;
 for(const t of tetra[key]){
  const rows=t.points.map(p=>{
   const r=p.clone().applyMatrix4(R),H=r.clone().add(P),b=er.clone().cross(r),v=ez.clone().cross(H).multiplyScalar(pd).addScaledVector(b,bd);return{H,b,v};
  }),sumV=rows.reduce((s,r)=>s.add(r.v),new THREE.Vector3()),sumB=rows.reduce((s,r)=>s.add(r.b),new THREE.Vector3());
  kinetic+=t.mass*(sumV.lengthSq()+rows.reduce((s,r)=>s+r.v.lengthSq(),0))/40;
  momentum+=t.mass*(sumV.dot(sumB)+rows.reduce((s,r)=>s+r.v.dot(r.b),0))/20;
  potential+=t.mass*physics.parameters.gravity*rows.reduce((s,r)=>s+r.H.y,0)/4;
 }
 return{kinetic,potential,momentum};
};
let maximumVelocityError=0,maximumAccelerationError=0,maximumForceError=0,maximumInertiaError=0;const rows=[];
for(let i=0;i<61;i++){
 const time=physics.parameters.period*i/61,k=physics.input(time),dt=1e-4,before=physics.input(time-dt),after=physics.input(time+dt),beta=.08+.55*(i%13)/12,bd=-.7+1.4*(i%11)/10;
 for(const [j,key]of ['upper','lower'].entries()){
  const a=k.arms[key],minus=before.arms[key],plus=after.arms[key],velocity=(plus.psi-minus.psi)/(2*dt),acceleration=(plus.psi-2*a.psi+minus.psi)/(dt*dt),
   eps=1e-5,Vminus=direct(key,beta-eps,a.psi,bd,a.psiVelocity),Vplus=direct(key,beta+eps,a.psi,bd,a.psiVelocity),
   pminus=direct(key,beta-bd*dt,a.psi-a.psiVelocity*dt+.5*a.psiAcceleration*dt*dt,bd,a.psiVelocity-a.psiAcceleration*dt),
   pplus=direct(key,beta+bd*dt,a.psi+a.psiVelocity*dt+.5*a.psiAcceleration*dt*dt,bd,a.psiVelocity+a.psiAcceleration*dt),
   force=(Vplus.kinetic-Vminus.kinetic-Vplus.potential+Vminus.potential)/(2*eps)-(pplus.momentum-pminus.momentum)/(2*dt)+physics.parameters.spring[key]*(physics.parameters.restBeta[key]-beta),
   expected=physics.forces([0,beta,beta],time)[j+1],inertia=2*direct(key,beta,a.psi,1,0).kinetic,
   errors={velocity:Math.abs(velocity-a.psiVelocity),acceleration:Math.abs(acceleration-a.psiAcceleration),force:Math.abs(force-expected),inertia:Math.abs(inertia-physics.parameters.inertia[j+1])};
  maximumVelocityError=Math.max(maximumVelocityError,errors.velocity);maximumAccelerationError=Math.max(maximumAccelerationError,errors.acceleration);
  maximumForceError=Math.max(maximumForceError,errors.force);maximumInertiaError=Math.max(maximumInertiaError,errors.inertia);
  rows.push({key,time,beta,bd,force,expected,errors});
 }
}
const maxima={maximumVelocityError,maximumAccelerationError,maximumForceError,maximumInertiaError},passed=maximumVelocityError<1e-8&&maximumAccelerationError<1e-6&&maximumForceError<1e-7&&maximumInertiaError<1e-12,
 report={movement:79,status:passed?'force-formulas-passed':'force-formulas-failed',productionChanged:false,mechanicsPassed:false,passed,maxima,rows,parameters:physics.parameters,sources,
  qualification:'Input velocity and acceleration checked by finite differences. Free-pawl force checked by an independent Euler-Lagrange evaluation integrating actual mesh tetrahedra, including nonzero pawl velocity. No contact dynamics or motion validation is claimed.'};
await writeFile('artifacts/review/079-force-formulas.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed,...maxima,parameters:physics.parameters});if(!passed)process.exitCode=1;
