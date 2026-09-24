import source from './source.js';
import {makeBarrelCamProfile} from '../mujoco-barrel-cam/profile.js';

// Brown draws 107's groove as a snake: a few deep reversals with broad,
// round U-shaped ends joined by steep, nearly crosswise runs. The pitch curve
// is a saturated sine, x = middle + (stroke/2)·tanh(c·sin u)/tanh(c) with
// u = N(θ + φ) − π/2. c = 2 flattens each end into a broad round bottom
// (end radius about 8 pixels) and steepens the runs; it stays smooth (C∞),
// so the pin never meets a corner.
export function serpentineLaw({repetitions,minimum,stroke,phase,sharpness}) {
  const half=stroke/2,middle=minimum+half,scale=Math.tanh(sharpness);
  return angle=>{
    const u=repetitions*(angle+phase)-Math.PI/2,s=Math.sin(u),t=Math.tanh(sharpness*s);
    return{x:middle+half*t/scale,derivative:half*repetitions*sharpness*Math.cos(u)*(1-t*t)/scale};
  };
}

// The steep runs magnify radial pin clearance into axial follower play by
// sqrt(1 + (dx/dθ / r)²), about 3.6 at the peak slope: 0.03 pixels of
// clearance let the follower rattle 0.2 pixels across the runs, so the
// running clearance is 0.01 pixels (106's value).
export function makeSerpentineCamProfile({resolution=32,clearance=.0001,workingRadius=.025,repetitions=8,sharpness=1.5}={}) {
  // The plate shows about four reversals each way across the front half of
  // the drum, so the groove repeats eight times per turn (the earlier fit to
  // the caption's uniform motion chose eleven).
  const period=2*Math.PI/repetitions,count=4*resolution;
  // Uniform angular cells repeat exactly in each sector.
  const angles=Array.from({length:repetitions*count+1},(_,i)=>i*period/count);
  const base=makeBarrelCamProfile({source,repetitions:source.uniformFit.repetitions,angles:[0,Math.PI],clearance,reversalAngle:source.uniformFit.blend/source.uniformFit.repetitions,cutterRadius:workingRadius,pinLowPixel:247,pinHighInset:-.015});
  // Keep the engraved pin position at the start: the phase places the
  // rising run at the measured tip (the measured law's initial point), so
  // the rod keeps its measured guide engagement.
  const fraction=(base.initialTip-base.minimum)/base.stroke,g=2*fraction-1;
  const phase=(Math.asin(Math.atanh(g*Math.tanh(sharpness))/sharpness)+Math.PI/2)/repetitions;
  const law=serpentineLaw({repetitions,minimum:base.minimum,stroke:base.stroke,phase,sharpness});
  const {cutterRadius,pinLow,radii}=base,segments=angles.length-1;
  // Radially ruled walls: sweep the round cutter's angular footprint along
  // the sinusoidal pitch curve at the working radius (as in 106's generator).
  const extent=(r,angle,side)=>{
    const limit=Math.asin(Math.min(1,cutterRadius/r));
    const at=delta=>side*law(angle+delta).x+Math.sqrt(Math.max(0,cutterRadius*cutterRadius-(r*Math.sin(delta))**2));
    let best=-Infinity,index=0;const samples=24;
    for(let i=0;i<=samples;i++){const value=at(limit*(2*i/samples-1));if(value>best){best=value;index=i;}}
    let low=limit*(2*Math.max(0,index-1)/samples-1),high=limit*(2*Math.min(samples,index+1)/samples-1);
    const ratio=(Math.sqrt(5)-1)/2;let a=high-ratio*(high-low),b=low+ratio*(high-low),fa=at(a),fb=at(b);
    for(let i=0;i<32;i++)if(fa>fb){high=b;b=a;fb=fa;a=high-ratio*(high-low);fa=at(a);}else{low=a;a=b;fa=fb;b=low+ratio*(high-low);fb=at(b);}
    return side*Math.max(best,fa,fb);
  };
  const walls=[-1,1].map(side=>{
    const sector=Array.from({length:count},(_,i)=>extent(pinLow,angles[i],side));
    const edge=Array.from({length:segments+1},(_,i)=>sector[i%count]);
    return radii.map(()=>edge);
  });
  return{...base,law,angles,segments,walls,resolution,repetitions,amplitude:base.stroke/2,sharpness,peakSlope:base.stroke/2*repetitions*sharpness/Math.tanh(sharpness),phase,slope:undefined,reversalAngle:undefined,initialTip:law(0).x};
}
