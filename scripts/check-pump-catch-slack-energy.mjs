import fs from 'node:fs';
import * as THREE from 'three';
import {makePumpCatchWeightedCandidate} from './lib/pump-catch-weighted-candidate.mjs';
import {makePumpCatchSlackDynamics} from './lib/pump-catch-slack-dynamics.mjs';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';
import {freezeStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-slack-energy-formulas',headBackDepth=Number(process.env.PROBE_HEAD_DEPTH??0),heelStop=process.env.PROBE_HEEL_STOP==='1',model=makePumpCatchWeightedCandidate({headBackDepth,heelStop}),u=model.root.userData,dynamics=makePumpCatchSlackDynamics(model),tetra=[];
for(const[name,mesh]of Object.entries(u.parts))if(['wheel','catch'].includes(u.families[name]))for(const t of surfaceTriangles(mesh.geometry)){
  const points=[t.a,t.b,t.c],mass=t.a.dot(t.b.clone().cross(t.c))/6;tetra.push({family:u.families[name],mesh,mass,points:[new THREE.Vector3(),...points]});}
const errors={energy:0,momentum:0,eulerLagrange:0},rows=[],z=new THREE.Vector3(0,0,1),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
for(let i=0;i<51;i++){
  const q=[-3*i/50,Math.sin(i)*2,1+Math.sin(i*.2)],v=[Math.cos(i)*2,Math.sin(i+.3)*3,Math.cos(i*.3)],expected=dynamics.at(q,v),P=new THREE.Vector3(...u.geometry.pivot,0).applyAxisAngle(z,q[0]);
  model.setState({wheelAngle:q[0],catchAngle:q[1]-q[0],camAngle:-i/5});let kinetic=0,potential=0;const momentum=[0,0,0];
  for(const t of tetra){const p=t.points.map(p=>{
    const world=p.clone().applyMatrix4(t.mesh.matrixWorld),directions=t.family==='wheel'?[z.clone().cross(world),new THREE.Vector3(),new THREE.Vector3()]:[z.clone().cross(P),z.clone().cross(world.clone().sub(P)),new THREE.Vector3()],
      velocity=directions[0].clone().multiplyScalar(v[0]).addScaledVector(directions[1],v[1]);return{world,velocity,directions};}),sum=p.reduce((s,p)=>s.add(p.velocity),new THREE.Vector3());
    kinetic+=t.mass*(sum.lengthSq()+p.reduce((s,p)=>s+p.velocity.lengthSq(),0))/40;potential+=t.mass*dynamics.parameters.gravity*p.reduce((s,p)=>s+p.world.y,0)/4;
    for(let k=0;k<3;k++){const dir=p.reduce((s,p)=>s.add(p.directions[k]),new THREE.Vector3());momentum[k]+=t.mass*(sum.dot(dir)+p.reduce((s,p)=>s+p.velocity.dot(p.directions[k]),0))/20;}
  }
  const{loadMass,radius,gravity}=dynamics.parameters;kinetic+=.5*loadMass*v[2]**2;potential+=loadMass*gravity*q[2];momentum[2]+=loadMass*v[2];
  errors.energy=Math.max(errors.energy,Math.abs(kinetic+potential-expected.energy));for(let k=0;k<3;k++)errors.momentum=Math.max(errors.momentum,Math.abs(momentum[k]-dot(expected.M[k],v)));
  const eps=1e-5,Mderivative=[0,1,2].map(k=>{const a=q.slice(),b=q.slice();a[k]+=eps;b[k]-=eps;const A=dynamics.at(a,v).M,B=dynamics.at(b,v).M;return A.map((row,r)=>row.map((x,c)=>(x-B[r][c])/(2*eps)));});
  for(let k=0;k<3;k++){
    const plus=q.slice(),minus=q.slice();plus[k]+=eps;minus[k]-=eps;
    const potentialDerivative=(dynamics.at(plus,[0,0,0]).energy-dynamics.at(minus,[0,0,0]).energy)/(2*eps),kineticDerivative=.5*dot(v,Mderivative[k].map(row=>dot(row,v))),
      transport=[0,1,2].reduce((s,j)=>s+v[j]*dot(Mderivative[j][k],v),0),force=-potentialDerivative+kineticDerivative-transport;
    errors.eulerLagrange=Math.max(errors.eulerLagrange,Math.abs(force-expected.force[k]));
  }
  rows.push({q,v,kinetic,potential,momentum});
}
const sources=freezeStudySources(['scripts/check-pump-catch-slack-energy.mjs','scripts/lib/pump-catch-weighted-candidate.mjs','scripts/lib/pump-catch-rope.mjs','scripts/lib/pump-catch-candidate.mjs','scripts/lib/pump-catch-source.mjs','scripts/lib/pump-catch-dynamics.mjs','scripts/lib/pump-catch-slack-dynamics.mjs',
  'scripts/lib/pump-catch-contact.mjs','scripts/lib/crossed-rack-mesh-prisms.mjs','src/simulation/finite-plate-geometry.js','src/simulation/conforming-plate-mesh.js',
  'src/simulation/clutch-section-geometry.js','src/simulation/primitives.js','tests/helpers/solid-surface.mjs','scripts/lib/study-report-io.mjs'],prefix);
const report={movement:86,status:'full-mesh-energy-and-free-equations-check',passed:errors.energy<1e-9&&errors.momentum<1e-9&&errors.eulerLagrange<1e-7,
  mechanicsPassed:false,candidateIntegrated:false,productionChanged:false,candidateOptions:u.candidateOptions,errors,poses:rows.length,tetrahedra:tetra.length,rows,sources,
  qualification:'Independent signed-tetrahedron integration of actual world-space wheel and catch meshes checks kinetic/gravitational energy and all three generalized momenta. Finite differences of the mass matrix and potential check the Coriolis and gravity terms. The pump is an independent ideal point load with unilateral rope contact; this checks formulas, not trajectory accuracy or hardware loads.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,rows:undefined,sources:undefined});if(!report.passed)process.exitCode=1;
