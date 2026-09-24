import fs from 'node:fs';
import {specialWormParameters} from '../src/simulation/special-worm-parameters.js';
// Radial envelopes of the ACTUAL common worm, with independently specified
// tooth counts and axial offsets. Equal outside diameters do not imply equal
// operating pitch diameters. No wheel-specific change to the common cutter.
const angularSteps=64,phaseSteps=1200,radialSteps=36;
const results={};
for(const [id,p] of Object.entries(specialWormParameters)){
 const axialSteps=p.globoidal?16:8,clearance=p.clearance??.0025;
 const started=Date.now(),N=p.teeth,lead=p.wormPitch/(2*Math.PI),module=p.wormPitch/Math.PI,tangent=Math.tan(p.pressureAngle??Math.PI/9);
 const root=p.wormRadius-(p.dedendum??1.25*module),tip=p.wormRadius+(p.addendum??module);
 const sweep=p.globoidal?.72:.45,step=2*sweep/phaseSteps;
 const wrap=x=>x-p.wormPitch*Math.floor(x/p.wormPitch+.5);
 const boundary=(theta,z,phase)=>{
  const angle=(p.globoidal?-Math.PI/2:Math.PI/2)+theta+phase;
  const sine=Math.sin(angle),cosine=Math.cos(angle);
  const wormAngle=(p.globoidal?1:-1)*N*((p.globoidal?-Math.PI/2:Math.PI/2)+phase-p.wheelPhase);
  const inside=r=>{
   let axial,radial,azimuth,coordinate;
   if(p.globoidal){
    axial=r*cosine;if(Math.abs(axial)>p.wormLength/2)return false;
    const y=r*sine+p.distance;
    azimuth=Math.atan2(y,-z)-wormAngle;
    if(p.hindley){
     // Hindley section: flanks keep their angle to the wheel radius all along
     // the throat. Depth and arc are measured about the wheel centre in each
     // worm meridian (the globoid of revolution of the wheel pitch circle).
     // The worm ends are square planes at |axial| = wormLength/2.
     const rho=Math.hypot(y,z),wheelRadius=Math.hypot(axial,p.distance-rho);
     radial=p.wormRadius+p.pitchRadius-wheelRadius;
     coordinate=p.pitchRadius*Math.atan2(axial,p.distance-rho)+lead*(azimuth-Math.PI/2);
    }else{
     radial=Math.hypot(y,z)-(p.pitchRadius-Math.sqrt(p.pitchRadius**2-axial**2));
     coordinate=p.pitchRadius*Math.asin(axial/p.pitchRadius)+lead*(azimuth-Math.PI/2);
    }
   }else{
    axial=-r*cosine;if(Math.abs(axial)>p.wormLength/2)return false;
    radial=Math.hypot(z+p.offset,r*sine-p.distance);
    azimuth=Math.atan2(r*sine-p.distance,z+p.offset)-wormAngle;
    coordinate=axial-lead*(azimuth-Math.PI*p.wormLength/p.wormPitch);
   }
   return radial<=root || (radial<=tip && Math.abs(wrap(coordinate))+(radial-p.wormRadius)*tangent<=p.wormPitch/4);
  };
  const low=p.pitchRadius-(p.globoidal?.22:.16),high=Math.min(p.outerRadius, p.wormLength/(2*Math.max(1e-12,Math.abs(cosine))));
  if(high<low)return Infinity;
  let before=low;
  for(let i=0;i<=radialSteps;i++){
   const r=low+(high-low)*i/radialSteps;
   if(inside(r)){
    let a=before,b=r;
    for(let j=0;j<27;j++){const c=(a+b)/2;if(inside(c))b=c;else a=c;}
    return b;
   }before=r;
  }return Infinity;
 };
 const radii=[];
 for(let j=0;j<=axialSteps;j++)for(let i=0;i<=angularSteps;i++){
  const theta=2*Math.PI/N*(i/angularSteps-.5),z=p.depth*(j/axialSteps-.5);
  let best=p.outerRadius,at=null;
  for(let k=0;k<=phaseSteps;k++){const phase=-sweep+step*k,value=boundary(theta,z,phase);if(value<best){best=value;at=phase;}}
  if(at!==null){let a=at-step,b=at+step;
   for(let k=0;k<35;k++){const c=a+(b-a)/3,d=b-(b-a)/3,fc=boundary(theta,z,c),fd=boundary(theta,z,d);best=Math.min(best,fc,fd);if(fc<fd)b=d;else a=c;}
  }
  radii.push(Number((best-clearance).toFixed(8)));
 }
 // The finite hourglass cutter leaves sharp end-of-contact corners. A
 // one-cell conservative guard prevents linear grid interpolation bridging
 // those narrow relieved patches. This is a sampled clearance construction,
 // not a qualified loaded contact-normal model.
 if(p.globoidal){const raw=radii.slice();for(let j=0;j<=axialSteps;j++)for(let i=0;i<=angularSteps;i++){
  for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
   const row=Math.max(0,Math.min(axialSteps,j+dj)),col=(i+di+angularSteps)%angularSteps;
   radii[j*(angularSteps+1)+i]=Math.min(radii[j*(angularSteps+1)+i],raw[row*(angularSteps+1)+col]);
  }
 }}
 let seam=0;
 for(let j=0;j<=axialSteps;j++){const a=j*(angularSteps+1),b=a+angularSteps;seam=Math.max(seam,Math.abs(radii[a]-radii[b]));radii[a]=radii[b]=Math.min(radii[a],radii[b]);}
 results[id]={angularCellGuard:Boolean(p.globoidal),angularSteps,axialSteps,phaseSteps,radialSteps,clearance,maximumSeamResidual:seam,radii};
 console.log({id,seconds:(Date.now()-started)/1000,min:Math.min(...radii),max:Math.max(...radii),seam});
}
fs.writeFileSync('src/data/special-worm-wheel-profiles.js','// Offline finite worm cutter envelopes; scripts/generate-special-worm-wheels.mjs\nexport const specialWormCuts='+JSON.stringify(results)+';\n');
