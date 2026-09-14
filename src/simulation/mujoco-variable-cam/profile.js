import {createAuthoredCamMovement} from '../authored-cams.js';
import {disposeObject3D} from '../dispose-model.js';
/** Reuse the independently joined circular-arc reconstruction offline only. */
export function variableCamProfile(samplesPerArc=64){
 const model=createAuthoredCamMovement({id:138});
 try{
  const g=model.root.userData.geometry,points=[];
  for(const step of g.profileTraversal){
   const a=g.profileArcs[step.arcIndex];
   const start=step.reverse?a.endAngle:a.startAngle,end=step.reverse?a.startAngle:a.endAngle;
   for(let i=0;i<samplesPerArc;i++){
    const t=start+(end-start)*i/samplesPerArc;
    points.push([a.center.x+a.radius*Math.cos(t),a.center.y+a.radius*Math.sin(t)]);
   }
  }
  return {points,initialRadius:model.root.userData.stateAtTime(0).profile.radius};
 }finally{disposeObject3D(model.root);}
}
