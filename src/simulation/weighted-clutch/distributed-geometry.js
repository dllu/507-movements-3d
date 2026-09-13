// Promoted from scripts/lib/weighted-clutch-distributed-candidate.mjs; geometry parity is tested.
import source from './source.js';
import {toWeightedClutchWorld as world} from './linkage.js';
import {makeWeightedClutchSourceFit,sourceFitStudContacts} from './source-fit.js';
import {makeWeightedClutchKeyCandidate,THREE} from './key-geometry.js';
import {poly,circle,capsule,plate,disk,polygonClipping as clip} from '../finite-plate-geometry.js';
import {conformingPlateMesh} from '../conforming-plate-mesh.js';
export {THREE};
const sub=(a,b)=>a.map((v,i)=>v-b[i]),rect=(x0,x1,y0,y1)=>poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);

export function canonicalWeightedClutchFit({shifts,freeAngle}){
  const linkage=makeWeightedClutchSourceFit(structuredClone(shifts),freeAngle),L=linkage.parameters;
  // Correct the earlier 0.548-source-pixel eccentricity between the long
  // shaft and E's pinion. Then place the stud at the incoming source contact,
  // counting that placement in the actual source discrepancy.
  L.E[1]=0;L.orbit=Math.hypot(...sub(L.stud,L.E));
  const incoming=sourceFitStudContacts(linkage,0).contacts.filter(c=>c.approachCCW);
  if(incoming.length!==1)throw Error('Ambiguous initial distributed-fit contact');
  L.stud=incoming[0].stud;L.studOffset=sub(L.stud,L.E);
  for(const name of ['E','stud']){
    L.pixels[name]=[L[name][0]*source.scale+source.origin[0],source.origin[1]-L[name][1]*source.scale];
    const original=name==='E'?source.wheelE.hub.center:source.wheelE.stud.center;
    L.shifts[name]=sub(L.pixels[name],original);
  }
  L.maximumDisplacement=Math.max(...Object.values(L.shifts).map(p=>Math.hypot(...p)));
  return linkage;
}

// An independently reviewable source-fit candidate. Previously verified
// factories and their frozen geometry remain unchanged.
export function makeWeightedClutchDistributedCandidate(options){
  const model=makeWeightedClutchKeyCandidate({pinAdjustmentPixels:0}),u=model.root.userData,
    parts=u.parts,old=u.linkage.parameters,linkage=canonicalWeightedClutchFit(options),L=linkage.parameters,
    copy=structuredClone(source),oldC=u.lostMotion.parameters,
    collar=sub(world(source.shifter.collar),L.F),collarRadius=Math.hypot(...collar),collarAngle=Math.atan2(collar[1],collar[0]),
    C={...oldC,collar,shifterRight:L.shifterRight,shifterLeft:L.shifterLeft,leverLeft:L.leverLeft,
      followerAngle:oldC.upper-L.shifterRight};
  const replace=(name,g)=>{parts[name].geometry.dispose();parts[name].geometry=g;};
  const shape=(name,polygons)=>{
    const {low,high}=parts[name].geometry.userData.plate;replace(name,conformingPlateMesh(plate(polygons,low,high)));
  };
  const move=(name,p)=>{parts[name].position.x=p[0];parts[name].position.y=p[1];};
  for(const name of ['lever','quadrant','shifter'])u.blocks[name].position.set(...L.F,0);
  u.blocks.bell.position.set(...L.G,0);
  for(const name of ['LeverFixedPivot','LeverPivotRearSeat'])move(name,L.F);
  for(const name of ['BellFixedPivot','BellPivotRearSeat'])move(name,L.G);
  const tip=sub(world(source.lever.tip),L.F),weight=sub(world(source.lever.weight.center),L.F);
  shape('weightedLever',clip.difference(clip.union(capsule([0,0],tip,source.lever.halfWidth/source.scale,96),
    poly(circle([0,0],source.lever.pivot.radius/source.scale,128))),
    poly(circle([0,0],.157,128)),poly(circle(L.armF,.058,96))));
  move('leverRodPin',L.armF);move('weightF',weight);
  shape('bellCrankG',clip.difference(clip.union(capsule([0,0],L.upper0,source.bell.upperHalfWidth/source.scale,96),
    capsule([0,0],L.armG,source.bell.lowerHalfWidth/source.scale,96),
    poly(circle([0,0],source.bell.pivot.radius/source.scale,128))),poly(circle([0,0],.113,128))));
  move('bellRodPin',L.armG);
  shape('connectingRod',clip.difference(clip.union(capsule([0,0],[L.rodLength,0],.061,96),
    poly(circle([0,0],.092,96)),poly(circle([L.rodLength,0],.136,96))),
    poly(circle([0,0],.058,96)),poly(circle([L.rodLength,0],.074,96))));
  shape('clutchShifterLever',clip.difference(clip.union(capsule([0,0],collar,source.shifter.halfWidth/source.scale,96),
    poly(circle([0,0],.20,128))),poly(circle([0,0],.152,128))));
  replace('clutchShifterBridge',plate(rect(collar[0]-.023,collar[0]+.023,collar[1]-.025,collar[1]+.025),.17,1.24));
  move('clutchForkShoe',collar);
  const follower=[C.radius*Math.cos(C.followerAngle),C.radius*Math.sin(C.followerAngle)],elbow=[.05,.90];
  shape('slotFollowerCarrier',clip.difference(clip.union(capsule([0,0],elbow,.025,64),capsule(elbow,follower,.025,64),
    poly(circle([0,0],.20,128))),poly(circle([0,0],.142,128))));
  move('slotFollowerPin',follower);
  for(const name of ['E','pinion'])u.gears[name].position.set(...L.E,0);
  move('studWheelRearBearing',L.E);
  move('reversingStud',L.studOffset);move('reversingStudPin',L.studOffset);
  const shaftRight=L.E[0]-.58,shaftLeft=(source.shaft.left-source.origin[0])/source.scale;
  replace('outputShaft',disk(u.geometry.shaftRadius,shaftLeft,shaftRight,128));
  const pose=(q,direction)=>{
    if(!['leftward','rightward'].includes(direction))throw Error('Unknown diagnostic direction');
    const s=Math.max(C.shifterRight,Math.min(C.shifterLeft,q+(direction==='leftward'?C.lower:C.upper)-C.followerAngle)),
      shift=collarRadius*Math.cos(collarAngle+s)-collar[0],
      x=direction==='leftward'?Math.min(0,shift+C.forkClearance):Math.max(-C.stroke,shift-C.forkClearance);
    return {leverAngle:q,shifterAngle:s,clutchShift:x,quadrantAngle:q,direction};
  };
  copy.lever.pivot.center=L.pixels.F;copy.lever.rodPin.center=L.pixels.A;
  copy.bell.pivotPin.center=L.pixels.G;copy.bell.rodPin.center=L.pixels.B;copy.bell.upperEnd=L.pixels.upper;
  copy.bell.pivot.center=source.bell.pivot.center.map((x,i)=>x+L.shifts.G[i]);
  for(const name of ['outer','inner','hub','shaft'])copy.wheelE[name].center=source.wheelE[name].center.map((x,i)=>x+L.shifts.E[i]);
  copy.wheelE.stud.center=L.pixels.stud;copy.wheelE.studPin.center=L.pixels.stud;
  copy.quadrant.outer=source.quadrant.outer.map(([method,...values])=>[method,...values.map((x,i)=>x+L.shifts.F[i%2])]);
  u.source=copy;u.linkage=linkage;u.lostMotion={pose,parameters:C};
  Object.assign(u.geometry,{collar,stud:L.studOffset,shaftRight});
  u.sourceAdjustments={distributed:true,shifts:L.shifts,maximumDisplacement:L.maximumDisplacement,
    weightDepth:parts.weightF.position.z,originalF:old.F,initialStudOnAnalyticContact:true,pinionCoaxialWithOutput:true};
  u.qualification='Distributed source-fit geometry, with E/pinion coaxial with the long shaft and initial stud contact included in the reported source displacement. Previous dynamics do not transfer automatically to these changed masses and linkage dimensions. Native contacts, solid clearance, source comparison and new dynamics require independent qualification.';
  model.setCoordinates([0,C.shifterRight,0,0,0],0);
  return {root:model.root,setCoordinates:model.setCoordinates,diagnosticPose:pose,update:()=>{},cameraDirection:model.cameraDirection};
}
