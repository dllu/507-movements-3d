import source from './source.js';
import {makeBarrelCamProfile} from '../mujoco-barrel-cam/profile.js';
export function makeSerpentineCamProfile({resolution=24,clearance=.0003,workingRadius=.011}={}) {
  const repetitions=source.uniformFit.repetitions,half=Math.PI/repetitions,d=source.uniformFit.blend/repetitions,phase=source.uniformFit.phase;
  // Equal resolution for each rounded reversal and straight flank avoids
  // spending most contact cells on the nearly affine working surfaces.
  const values=[],period=2*half;
  for(let k=0;k<2;k++)for(let i=0;i<resolution;i++)for(const a of [k*half-phase-d+2*d*i/resolution,k*half-phase+d+(half-2*d)*i/resolution])values.push(((a%period)+period)%period);
  const base=[...new Set(values)].sort((a,b)=>a-b);
  const angles=Array.from({length:repetitions},(_,k)=>base.map(a=>a+k*period)).flat();angles.push(angles[0]+2*Math.PI);
  // The measured ink gap overestimates a usable round-pin groove. A 1.1-pixel
  // working radius stays below the minimum pitch-curve radius at the turns.
  return makeBarrelCamProfile({source,repetitions,angles,clearance,reversalAngle:d,cutterRadius:workingRadius,pinLowPixel:247,pinHighInset:-.015});
}
