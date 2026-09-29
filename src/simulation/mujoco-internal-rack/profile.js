import {roundedRackGear} from '../coaxial-gear-geometry.js';
import {capsule,poly,polygonClipping as clip} from '../finite-plate-geometry.js';
import {internalRackDimensions as source} from '../../data/internal-rack-dimensions.js';

export function internalRackPitchDimensions(){
 const module=source.module,teeth=source.pinionTeeth,radius=teeth*module/2;
 const endRadius=source.endTeeth*module/2,orbit=endRadius-radius;
 const span=source.straightTeeth*Math.PI*module,length=2*span+2*Math.PI*orbit;
 const sourcePhase=(1.5*span+Math.PI*orbit+source.sourceRackX)/length;
 return {module,teeth,radius,endRadius,orbit,span,halfSpan:span/2,length,sourcePhase,rotationPerCycle:length/radius};
}
/** Ideal pitch motion, used as a generating path rather than a dynamics claim. */
export function internalRackPitchPose(phase){
 const d=internalRackPitchDimensions(),p=((phase%1)+1)%1;
 const angle=-Math.PI/2+d.rotationPerCycle*(phase-d.sourcePhase);
 let s=p*d.length,x,y;
 if(s<d.span){x=d.halfSpan-s;y=-d.orbit;}
 else if((s-=d.span)<Math.PI*d.orbit){const a=-Math.PI/2-s/d.orbit;x=-d.halfSpan+d.orbit*Math.cos(a);y=d.orbit*Math.sin(a);}
 else if((s-=Math.PI*d.orbit)<d.span){x=-d.halfSpan+s;y=d.orbit;}
 else{const a=Math.PI/2-(s-d.span)/d.orbit;x=d.halfSpan+d.orbit*Math.cos(a);y=d.orbit*Math.sin(a);}
 return {x,y,angle};
}
export function makeConjugateInternalRack({sweepSteps=1024,clearance=.0008,samples=64,cutterSteps=2048,tooth=source.tooth}={}){
 const d=internalRackPitchDimensions(),{radius,module,halfSpan,teeth}=d;
 // A standard 20-degree basic rack (full-radius cutter tips) cuts an ideal
 // involute pinion; sweeping that pinion regenerates trapezoidal basic-rack
 // teeth on the straight runs and conjugate teeth round the ends.
 // (Truncating the rack tips left radial play that let the passive rack
 // drift and jam at the ends, pass 102.)
 const cut={teeth,module,depth:.12,boreRadius:.08,samples,cutterSteps,pressureAngle:tooth.pressureAngle,addendum:tooth.pinionAddendum,dedendum:tooth.pinionDedendum};
 if(tooth.cutterTipRadius!==undefined)cut.tipRadius=tooth.cutterTipRadius*module;
 const gear=roundedRackGear(cut);
 const pinion=gear.userData.outline.map(p=>p.toArray());gear.dispose();
 const cutter=pinion.map(([x,y])=>{const r=Math.hypot(x,y);return[x*(1+clearance/r),y*(1+clearance/r)];});
 const at=(points,phase)=>{const {x,y,angle}=internalRackPitchPose(phase),c=Math.cos(angle),s=Math.sin(angle);return poly(points.map(([a,b])=>[c*a-s*b-x,s*a+c*b-y]));};
 // Hierarchical union keeps the offline swept-cutter operation bounded in memory.
 let batches=Array.from({length:sweepSteps},(_,i)=>at(cutter,i/sweepSteps));
 while(batches.length>1){const next=[];for(let i=0;i<batches.length;i+=2)next.push(i+1<batches.length?clip.union(batches[i],batches[i+1]):batches[i]);batches=next;}
 const opening=batches[0],outer=capsule([-halfSpan,0],[halfSpan,0],d.endRadius+module+.07,128);
 return {...d,pinion,opening,body:clip.difference(outer,opening),at,options:{sweepSteps,clearance,samples,cutterSteps,tooth}};
}
