import fs from 'node:fs';
import crypto from 'node:crypto';
const read=name=>JSON.parse(fs.readFileSync(`/dev/shm/139-native-${name}.json`));
const base=read('refined'),runs={timestep:read('time-refined'),contact:read('contact-refined'),long:read('long')};
const comparisons={};
for(const name of ['timestep','contact']){
 let rack=0,crank=0,rod=0;
 for(let i=0;i<base.rows.length;i++){
  const a=base.rows[i],b=runs[name].rows[i];
  if(Math.abs(a[0]-b[0])>1e-7)throw Error('Mismatched sample times');
  rack=Math.max(rack,100*Math.hypot(a[2]-b[2],a[3]-b[3]));
  crank=Math.max(crank,100*.585*Math.abs(a[4]-b[4]));rod=Math.max(rod,100*.575*Math.abs(a[4]+a[5]-b[4]-b[5]));
 }
 comparisons[name]={maximumRackPositionDifferencePixels:rack,maximumCrankTipDifferencePixels:crank,maximumRodTipAngleDifferencePixels:rod};
}
const summaries=Object.fromEntries(Object.entries(runs).map(([name,r])=>[name,{counterMass:r.counterMass,timestep:r.timestep,contactTime:r.contactTime,seconds:r.rows.at(-1)[0],resets:r.resets,maximumPenetrationPixels:r.penetration*100}]));
const sources=['scripts/probe-internal-rack.mjs','scripts/compare-internal-rack-refinement.mjs','src/simulation/mujoco-internal-rack/profile.js','src/data/internal-rack-dimensions.js'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
const report={sources,comparisons,runs:summaries,caveat:'Separate timestep and contact-stiffness sensitivity of the existing mass/inertia candidate. This does not yet validate the reconstructed hardware inertias.'};
fs.writeFileSync('docs/validation/139-refinement.json',JSON.stringify(report,null,2)+'\n');console.log(report);
