import{writeFile}from'node:fs/promises';
import{makeTiltHammerGravityStudy}from'./lib/tilt-hammer-gravity-study.mjs';
const trials=[];
for(const fallStep of [1/2000,1/4000,1/8000]){
  const model=makeTiltHammerGravityStudy({fallStep}),p=model.parameters,rows=[];
  for(let i=0;i<=2400;i++){
    const state=model.stateAtTime(p.period*i/2400);
    rows.push({...state,gap:model.contact.gap(state.angle,state.q),energy:model.energy(state.q,state.velocity)});
  }
  const freeEnergy=model.energy(model.events.release.q,model.events.release.velocity);
  const energyResidual=Math.max(...model.fall.map(row=>Math.abs(model.energy(row.q,row.velocity)-freeEnergy)));
  const report={parameters:p,mass:{...model.mass,contours:undefined},events:model.events,poses:rows.length,
    minimumGap:Math.min(...rows.map(row=>row.gap)),maximumFreeFallEnergyResidual:energyResidual,
    peakHammerSpeed:Math.max(...rows.map(row=>Math.abs(row.velocity))),
    minimumReaction:Math.min(...rows.filter(row=>row.reaction!==undefined).map(row=>row.reaction)),
    pickupEnergyLoss:model.mass.inertiaPerMass*model.events.entry.velocity**2/2,
    landingEnergyLoss:model.mass.inertiaPerMass*model.events.landing.velocity**2/2,rows};
  trials.push(report);console.log({...report,rows:undefined});
}
await writeFile('artifacts/review/072-gravity-contact-trials.json',JSON.stringify({movement:72,status:'isolated-gravity-contact-trials',productionChanged:false,
 method:'Uniform-density hammer area from the union of traced pieces, rounded nose and pivot foot; no double-counted overlap. A frictionless regulated cam supports the hammer only while its normal force is compressive. Release is the zero-reaction event, followed by RK4 gravity motion and an inelastic workpiece impact. Three fall-step sizes test convergence. This study does not certify complete 3D hardware.',trials},null,2)+'\n',{flag:'wx'});
