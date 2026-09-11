import{readFile,writeFile}from'node:fs/promises';
import * as THREE from 'three';
import{createMovementModel}from'../src/simulation/registry.js';
import{surfacePoints,solidSurface}from'../tests/helpers/solid-surface.mjs';
const catalog=JSON.parse(await readFile('src/data/movements.json','utf8')),model=createMovementModel(catalog.movements[65]);
const{geometry:p,blocks:b,stateAtTime}=model.root.userData;
const atPhase=phase=>((1+phase)*p.fullTurn-p.initialCycleAngle)/p.wheelAngularSpeed;
const inertiaLowerBound=p.weightMass*p.weightArmLength**2,release=stateAtTime(atPhase(0));
const minimumEnergy=state=>.5*inertiaLowerBound*state.weightedShaftAngularSpeed**2+state.gravityPotentialEnergy;
const initialEnergy=minimumEnergy(release),rows=[];
for(let i=0;i<257;i++){
 const phase=p.fallEndPhase*(i+.173)/258,time=atPhase(phase),state=stateAtTime(time),h=1e-6;
 const acceleration=(stateAtTime(time+h).weightedShaftAngularSpeed-stateAtTime(time-h).weightedShaftAngularSpeed)/(2*h);
 const requiredExtraTorque=inertiaLowerBound*acceleration-state.gravityTorque;
 rows.push({phase,time,stage:state.stage,omega:state.weightedShaftAngularSpeed,acceleration,gravityTorque:state.gravityTorque,
  requiredExtraTorque,minimumEnergy:minimumEnergy(state),minimumEnergyGain:minimumEnergy(state)-initialEnergy});
}
const parts=[['shaftPin',b.shaftPin],['halfCutCollar',b.halfCutCollar]].map(([name,mesh])=>({name,mesh,points:surfacePoints(mesh.geometry),solid:solidSurface(mesh.geometry)}));
const phases=new Set([0,.001,.02,.035,.055,.0699,.07,.2,.49,.5,.501,.65,.9]);for(let i=0;i<65;i++)phases.add((i+.317)/65);
const contacts=[];
for(const phase of [...phases].sort((a,b)=>a-b)){
 model.update(atPhase(phase));model.root.updateMatrixWorld(true);let checks=0,inside=0,maximumDepth=0;
 for(const[from,to]of[[parts[0],parts[1]],[parts[1],parts[0]]]){const matrix=to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
  for(const point of from.points){const q=point.clone().applyMatrix4(matrix);checks++;if(!to.solid.inside(q))continue;const depth=to.solid.distance(q);if(depth<=1e-6)continue;inside++;maximumDepth=Math.max(maximumDepth,depth);}}
 contacts.push({phase,stage:model.root.userData.kinematics.stage,pinEngaged:model.root.userData.kinematics.pinEngaged,lead:model.root.userData.kinematics.weightedShaftLeadAngle,checks,inside,maximumDepth});
}
const summary={gravitySamples:rows.length,inertiaLowerBound,initialMinimumEnergy:initialEnergy,maximumMinimumEnergyGain:Math.max(...rows.map(r=>r.minimumEnergyGain)),maximumRequiredExtraTorque:Math.max(...rows.map(r=>r.requiredExtraTorque)),initialFreeSample:rows[0],
 contactPoses:contacts.length,checks:contacts.reduce((s,r)=>s+r.checks,0),inside:contacts.reduce((s,r)=>s+r.inside,0),maximumPenetration:Math.max(...contacts.map(r=>r.maximumDepth)),penetratingEngagedPoses:contacts.filter(r=>r.pinEngaged&&r.inside).length};
await writeFile('artifacts/review/066-gravity-pin-baseline.json',JSON.stringify({movement:66,status:'production-baseline-diagnostic',productionChanged:false,
 method:'A lower bound on the rotating inertia is the bob treated as a point mass, mL². During the prescribed free fall, its kinetic-plus-potential energy is compared to release energy, and angular acceleration is independently differentiated. Positive growth while speed increases cannot be supplied by passive gravity or nonnegative drag; omitted rigid-body inertia only increases the deficit. The finite pin/collar pair uses bidirectional actual Float32 triangle vertex, edge-midpoint and face-center containment. This diagnostic does not certify the remaining worm, bearing or frame surfaces.',summary,rows,contacts},null,2)+'\n');console.log(summary);
