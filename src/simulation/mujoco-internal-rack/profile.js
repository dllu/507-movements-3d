import {roundedRackGear} from '../coaxial-gear-geometry.js';
import {capsule,poly,polygonClipping as clip} from '../finite-plate-geometry.js';

/** Ideal pitch motion, used as a generating path rather than a dynamics claim. */
export function internalRackPitchPose(phase,{radius=.64,halfSpan=2*Math.PI*.32}={}){
 const p=((phase%1)+1)%1,angle=-Math.PI/2+6*Math.PI*phase;
 let x,y;
 if(p<1/3){x=halfSpan-6*Math.PI*radius*p;y=-radius;}
 else if(p<1/2){const a=-Math.PI/2-6*Math.PI*(p-1/3);x=-halfSpan+radius*Math.cos(a);y=radius*Math.sin(a);}
 else if(p<5/6){x=-halfSpan+6*Math.PI*radius*(p-.5);y=radius;}
 else{const a=Math.PI/2-6*Math.PI*(p-5/6);x=halfSpan+radius*Math.cos(a);y=radius*Math.sin(a);}
 return {x,y,angle};
}
export function makeConjugateInternalRack({sweepSteps=1024,clearance=.002,samples=64,cutterSteps=2048}={}){
 const radius=.64,module=2*radius/9,halfSpan=2*Math.PI*.32;
 const gear=roundedRackGear({teeth:9,module,depth:.3,boreRadius:.10,samples,cutterSteps});
 const pinion=gear.userData.outline.map(p=>p.toArray());gear.dispose();
 const cutter=pinion.map(([x,y])=>{const r=Math.hypot(x,y);return[x*(1+clearance/r),y*(1+clearance/r)];});
 const at=(points,phase)=>{const {x,y,angle}=internalRackPitchPose(phase),c=Math.cos(angle),s=Math.sin(angle);return poly(points.map(([a,b])=>[c*a-s*b-x,s*a+c*b-y]));};
 // Hierarchical union keeps the offline swept-cutter operation bounded in memory.
 let batches=Array.from({length:sweepSteps},(_,i)=>at(cutter,i/sweepSteps));
 while(batches.length>1){const next=[];for(let i=0;i<batches.length;i+=2)next.push(i+1<batches.length?clip.union(batches[i],batches[i+1]):batches[i]);batches=next;}
 const opening=batches[0],outer=capsule([-halfSpan,0],[halfSpan,0],2*radius+module+.17,128);
 return {teeth:9,pinion,opening,body:clip.difference(outer,opening),at,options:{sweepSteps,clearance,samples,cutterSteps},radius,module,halfSpan};
}
