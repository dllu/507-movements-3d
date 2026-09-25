import * as THREE from 'three';
import {replaceWithLaidRope} from '../laid-rope.js';

export function weightedCordGeometry(g,leverAngle){
 const angle=-leverAngle+g.leverIncludedAngle,s=g.sourceScale;
 const leverAttachment={x:g.sourceLeverPivot.x+g.outputArmLength*Math.cos(angle)/s,y:g.sourceLeverPivot.y+g.outputArmLength*Math.sin(angle)/s};
 const dx=leverAttachment.x-g.sourcePulleyCenter.x,dy=leverAttachment.y-g.sourcePulleyCenter.y,d2=dx*dx+dy*dy,r=g.pulleyPitchRadius/s;
 const incomingLength=Math.sqrt(d2-r*r),scale=r*r/d2,perpendicular=r*incomingLength/d2;
 const incomingTangent={x:g.sourcePulleyCenter.x+dx*scale-dy*perpendicular,y:g.sourcePulleyCenter.y+dy*scale+dx*perpendicular};
 const incomingTangentAngle=(Math.atan2(incomingTangent.y-g.sourcePulleyCenter.y,incomingTangent.x-g.sourcePulleyCenter.x)+2*Math.PI)%(2*Math.PI);
 return {leverAttachment,incomingTangent,incomingTangentAngle,incomingLength,wrapLength:r*(2*Math.PI-incomingTangentAngle)};
}

/**
 * Brown hatches 154's cord as a laid rope. The centreline runs straight from
 * the lever eye to the pulley, wraps the pulley at its pitch radius and drops
 * to the weight. The rope's lever end is fastened, so its lay stays fixed to
 * that end (travel 0) and the strands carry over the pulley as the path
 * changes. Buffers are reused while the sample count is unchanged.
 */
export function updateWeightedCord(mesh,g,weightY,cordState){
 const segments=128,s=g.sourceScale,c=cordState,points=[];
 const ax=(c.leverAttachment.x-g.sourceDiskCenter.x)*s,ay=(g.sourceDiskCenter.y-c.leverAttachment.y)*s;
 const tx=(c.incomingTangent.x-g.sourceDiskCenter.x)*s,ty=(g.sourceDiskCenter.y-c.incomingTangent.y)*s;
 const straight=c.incomingLength*s,arc=c.wrapLength*s,vertical=g.pulleyCenter.y-weightY-.56,total=straight+arc+vertical;
 for(let i=0;i<=segments;i++){
  const distance=total*i/segments;let x,y;
  if(distance<=straight){const t=distance/straight;x=ax+(tx-ax)*t;y=ay+(ty-ay)*t;}
  else if(distance<straight+arc){const a=c.incomingTangentAngle+(distance-straight)/g.pulleyPitchRadius;x=g.pulleyCenter.x+g.pulleyPitchRadius*Math.cos(a);y=g.pulleyCenter.y-g.pulleyPitchRadius*Math.sin(a);}
  else{x=g.pulleyCenter.x+g.pulleyPitchRadius;y=g.pulleyCenter.y-(distance-straight-arc);}
  points.push(new THREE.Vector3(x,y,g.cordPlaneZ));
 }
 const path=new THREE.CatmullRomCurve3(points,false,'centripetal',.35);path.arcLengthDivisions=512;
 replaceWithLaidRope(mesh,path,{radius:g.cordRadius,travel:0,tubularSegments:segments});
 mesh.userData.crossSection='laid-rope';
}

export function syncWeightedBellCrank(model,state){
 const u=model.root.userData,b=u.blocks,g=u.geometry,[disk,lever,lift]=state.qpos;
 b.diskRotor.rotation.z=disk;b.lever.rotation.z=lever;
 b.weight.position.y=(g.sourceDiskCenter.y-g.sourceWeightCenter.y)*g.sourceScale+lift;
 b.pulleyRotor.rotation.z=lift/g.pulleyPitchRadius;
 updateWeightedCord(b.cord,g,b.weight.position.y,weightedCordGeometry(g,lever));
 b.contactMarker.visible=false;u.physicsState=state;model.root.updateMatrixWorld(true);
}
