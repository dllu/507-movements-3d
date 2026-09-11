import{writeFile}from'node:fs/promises';
import{makeTiltHammerCandidate}from'./lib/tilt-hammer-candidate.mjs';
import{makeTiltHammerGravityStudy}from'./lib/tilt-hammer-gravity-study.mjs';
const model=makeTiltHammerCandidate(),{parts,families,motion}=model.root.userData,p=motion.parameters;
let volume=0,firstX=0,firstY=0,polar=0;
for(const[name,mesh]of Object.entries(parts))if(families[name]==='hammer'){
  const position=mesh.geometry.attributes.position,index=mesh.geometry.index;
  for(let i=0;i<(index?.count??position.count);i+=3){
    const[a,b,c]=[0,1,2].map(j=>{const at=index?index.getX(i+j):i+j;return[position.getX(at),position.getY(at),position.getZ(at)];});
    const v=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
    volume+=v;firstX+=v*(a[0]+b[0]+c[0])/4;firstY+=v*(a[1]+b[1]+c[1])/4;
    for(const k of [0,1])polar+=v*(a[k]**2+b[k]**2+c[k]**2+a[k]*b[k]+a[k]*c[k]+b[k]*c[k])/10;
  }
}
const actualMass={volume,centroid:[firstX/volume,firstY/volume],inertiaPerMass:polar/volume};
const expectedVolume=motion.mass.area*motion.mass.bodyDepth;
const massErrors={relativeVolume:Math.abs(volume-expectedVolume)/expectedVolume,
  centroid:Math.hypot(...actualMass.centroid.map((v,i)=>v-motion.mass.centroid[i])),
  relativeInertia:Math.abs(actualMass.inertiaPerMass-motion.mass.inertiaPerMass)/motion.mass.inertiaPerMass};
const{entry,release,landing}=motion.events;
let arcEndLow=entry.time,arcEndHigh=release.time;
for(let i=0;i<48;i++){
  const mid=(arcEndLow+arcEndHigh)/2;
  if(motion.contact.boundary(p.inputStart-p.omega*mid).feature.startsWith('arc'))arcEndLow=mid;else arcEndHigh=mid;
}
const arcEnd=(arcEndLow+arcEndHigh)/2;
const integrate=(begin,end,steps)=>{
  let sum=0;const h=(end-begin)/steps;
  for(let i=0;i<=steps;i++){
    // Use one-sided limits at the curvature change. The force can jump,
    // while position and velocity remain continuous at the flank/tip join.
    const t=begin+(end-begin)*i/steps,inside=Math.max(begin+1e-7,Math.min(end-1e-7,t));
    sum+=motion.drivenAt(p.inputStart-p.omega*inside).motorPowerPerMass*(i===0||i===steps?1:i%2?4:2);
  }
  return sum*h/3;
};
const workTrials=[1024,2048,4096].map(steps=>{
  const work=integrate(entry.time,arcEnd,steps)+integrate(arcEnd,release.time,steps);
  const change=motion.energy(release.q,release.velocity)-motion.energy(entry.q,entry.velocity);
  return{steps,work,energyChange:change,residual:work-change};
});
const pickupLoss=motion.mass.inertiaPerMass*entry.velocity**2/2;
const landingLoss=motion.mass.inertiaPerMass*landing.velocity**2/2;
const cycleEnergyResidual=workTrials.at(-1).work+2*pickupLoss-pickupLoss-landingLoss;
const convergence=[];
for(const fallStep of [1/2000,1/4000,1/8000]){
  const trial=makeTiltHammerGravityStudy({fallStep});
  const releaseEnergy=trial.energy(trial.events.release.q,trial.events.release.velocity);
  const maxEnergyResidual=Math.max(...trial.fall.map(row=>Math.abs(trial.energy(row.q,row.velocity)-releaseEnergy)));
  convergence.push({fallStep,landing:trial.events.landing,maximumFreeFallEnergyResidual:maxEnergyResidual});
}
const report={movement:72,status:'isolated-actual-mass-and-energy-audit',productionChanged:false,
  method:'Signed tetrahedra from all actual Float32 hammer triangles independently recover volume, center of mass and polar inertia, including the blind bore and its closed end. Simpson integration of regulated motor power checks contact energy across separate flank/tip intervals. Pickup and landing are inelastic impacts; three RK4 step sizes check the current bored hammer fall. Uniform density and ideal rigid supports are explicit assumptions.',
  actualMass,expectedMass:{...motion.mass,contours:undefined},massErrors,arcEnd,events:motion.events,workTrials,
  pickupLoss,landingLoss,cycleEnergyResidual,convergence};
const failures=[];
if(Object.values(massErrors).some(error=>error>1e-6))failures.push('Actual mass properties differ');
if(Math.abs(cycleEnergyResidual)>1e-5)failures.push('Cycle energy does not balance');
if(convergence.some(row=>row.maximumFreeFallEnergyResidual>1e-9))failures.push('Free-fall energy drift');
report.failures=failures;
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/072-candidate-energy.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({...report,events:undefined});if(failures.length)process.exitCode=1;
