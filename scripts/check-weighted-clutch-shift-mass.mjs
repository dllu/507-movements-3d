import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchIndependentCandidate,THREE} from './lib/weighted-clutch-independent-candidate.mjs';
import {makeWeightedClutchInertia} from './lib/weighted-clutch-inertia.mjs';
import {familyMass} from '../src/simulation/finite-plate-geometry.js';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-shift-mass-check',parent=readStudyReport('artifacts/review/087-first-neutral-shift.json'),
 sources=freezeStudySources([...parent.sources.map(s=>s.file),'scripts/check-weighted-clutch-shift-mass.mjs'],prefix),
 model=makeWeightedClutchIndependentCandidate(),u=model.root.userData,inertia=makeWeightedClutchInertia(model),cache=new Map(),
 components=Object.entries(u.parts).filter(([n])=>['lever','bell','rod','shifter','D','shaft','pinion','E'].includes(u.families[n])).map(([name,mesh])=>{
  if(!cache.has(mesh.geometry)){const dummy=new THREE.Mesh(mesh.geometry);cache.set(mesh.geometry,familyMass({part:dummy},{part:'body'},'body'));}
  const raw=cache.get(mesh.geometry);return{name,mesh,center:raw.centroid,mass:raw.volume*inertia.parameters.density,centralInertia:raw.centralPolar*inertia.parameters.density};
 }),b=inertia.parameters.bodies,outputInertia=b.D.inertia+b.shaft.inertia+b.pinion.inertia+b.E.inertia/u.geometry.eRatio**2,
 samples=[[.2,.01,-.02,.37],[.7,.06,-.12,-2.11],[1.4,.12,-.22,.61]],rows=[];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sample=q=>{
 model.setCoordinates(q,.173);
 return components.map(c=>{const m=c.mesh.matrixWorld.elements;return{center:new THREE.Vector3(...c.center).applyMatrix4(c.mesh.matrixWorld).toArray(),
  axisX:m.slice(0,3),axisY:m.slice(4,7),axisZ:m.slice(8,11)};});
};
let maximumError=0;
for(const q of samples){
 const h=1e-5,center=sample(q),derivatives=[];
 for(let k=0;k<4;k++){
  const a=q.slice(),b=q.slice();a[k]-=h;b[k]+=h;const before=sample(a),after=sample(b);
  derivatives.push(components.map((c,i)=>({v:after[i].center.map((v,j)=>(v-before[i].center[j])/(2*h)),
   omega:dot(center[i].axisY,after[i].axisX.map((v,j)=>(v-before[i].axisX[j])/(2*h))),
   axisDrift:Math.hypot(...after[i].axisZ.map((v,j)=>(v-before[i].axisZ[j])/(2*h)))})));
 }
 const matrix=Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>components.reduce((s,c,k)=>s+c.mass*dot(derivatives[i][k].v,derivatives[j][k].v)+c.centralInertia*derivatives[i][k].omega*derivatives[j][k].omega,0))),
  expected=[inertia.linkage(q[0]).inertia,b.shifter.inertia,b.D.mass,outputInertia];
 for(let i=0;i<4;i++)for(let j=0;j<4;j++)maximumError=Math.max(maximumError,Math.abs(matrix[i][j]-(i===j?expected[i]:0)));
 rows.push({q,matrix,expected,maximumAxisDrift:Math.max(...derivatives.flat().map(d=>d.axisDrift))});
}
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources,
 components:components.map(({mesh,...c})=>c),rows,maximumError,outputInertia,
 qualification:'Independent native per-component mass integrals and finite differences of actual world transforms verify all four inertia coordinates and their cross terms. Includes D translation, shaft/pinion spin and reflected E inertia, within the declared additive-component mass hypothesis.'},null,2)+'\n',{flag:'wx'});
console.log({components:components.length,poses:rows.length,outputInertia,maximumError});assert(maximumError<1e-7&&rows.every(r=>r.maximumAxisDrift<1e-8));
