import * as THREE from 'three';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
import {horizontalPlate,horizontalRing,horizontalTurned} from './horizontal-turbine-solids.js';
import {fitPistonGuide} from './piston-guide-parts.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
const rectangle=(w,h)=>poly([[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]);
const smooth=x=>{const t=Math.max(0,Math.min(1,x));return t*t*t*(10+t*(-15+6*t));};

export function correctWaterSealedPump(root){
 const d=root.userData,b=d.blocks,g=d.geometry;
 // Full finite shells remain transparent so the two check routes can be inspected.
 replace(b.tubShell,horizontalRing(g.outerTubInnerRadius,1.03,g.outerTubBottomY,g.outerTubTopY));b.tubShell.position.y=0;
 replace(b.tubBottom,horizontalRing(.09,1.03,g.outerTubBottomY-.13,g.outerTubBottomY));b.tubBottom.position.y=0;
 replace(b.foundation,horizontalPlate(clip.difference(rectangle(4.95,1.72),poly(circle([0,0],.09,64))),-1.08,-.90));b.foundation.position.y=0;
 replace(b.bellShell,horizontalTurned([[-g.bellHeight/2,g.bellInnerRadius],[-g.bellHeight/2,.675],[g.bellHeight/2,.63],[g.bellHeight/2,g.bellInnerRadius]]));
 replace(b.bellRoof,horizontalRing(.082,g.bellOuterRadius,-g.bellRoofThickness/2,g.bellRoofThickness/2));
 replace(b.inletPipe,horizontalRing(.055,.085,g.inletPipeBottomY,g.inletPipeTopY-.0275));b.inletPipe.position.y=0;
 replace(b.lowerInletValveSeat,horizontalRing(.055,.15,-.0275,.0275));
 replace(b.upperOutletPipe,horizontalRing(.052,.078,g.bellHeight/2-.10,g.bellHeight/2+.2225));b.upperOutletPipe.position.y=0;
 replace(b.upperOutletValveSeat,horizontalRing(.052,.14,-.0225,.0225));
 // Relocate the frame behind the two crossing lever planes.
 replace(b.crosshead,plate(clip.difference(clip.union(rectangle(2.36,.22),...[-1,1].map(side=>poly(circle([side*g.leverPivotX,.03],.17,64)))),...[-1,1].map(side=>poly(circle([side*g.leverPivotX,.03],.099,64)))),-.26,.26));
 b.crosshead.position.z=-.65;
 for(const o of b.fixedFrame.children)if(o!==b.crosshead){o.position.z=-.65;if(o.geometry.parameters?.height>3){replace(o,new THREE.BoxGeometry(.20,3.79,.30));o.position.y=1.015;}}
 for(let i=0;i<2;i++){
  const lever=[b.leftLever,b.rightLever][i],side=i===0?1:-1,mid=side*(g.leverInnerArmLength-g.leverOuterArmLength)/2;
  const outline=clip.difference(clip.union(capsule([-side*g.leverOuterArmLength,0],[side*g.leverInnerArmLength,0],.07,24),poly(circle([0,0],.15,64))),poly(circle([0,0],.099,64)));
  const shape=plate(outline,-.065,.065);shape.translate(-mid,0,0).rotateZ(side*Math.PI/2).scale(1,1/(g.leverInnerArmLength+g.leverOuterArmLength),1);replace(lever,shape);
  // Right-hand setRodBetween points toward the left: reflect its local thickness frame.
  const pivot=b.leverPivots[i],bearing=new THREE.Mesh(plate(clip.difference(poly(circle([0,0],.16,64)),poly(circle([0,0],.099,64))),-.065,.065),b.crosshead.material);
  bearing.position.set(pivot.position.x,g.leverPivotY,-.65);root.add(bearing);bearing.userData.role='bored-lever-frame-bearing';
  const low=-.95,high=(i===0?.24:-.24)+.12;
  replace(pivot,new THREE.CylinderGeometry(.095,.095,high-low,32));pivot.position.z=(high+low)/2;
 }
 // Water occupies the annulus outside the bell and the central bore, not its wall.
 const outerHeight=g.externalWaterLineY-g.outerTubBottomY;
 replace(b.outerWater,horizontalRing(.70,.905,-outerHeight/2,outerHeight/2));
 replace(b.outerWaterSurface,new THREE.RingGeometry(.70,.905,64));
 replace(b.internalWaterSurface,new THREE.RingGeometry(.09,g.bellInnerRadius-.003,64));
 b.innerWater=new THREE.Mesh(horizontalRing(.09,g.bellInnerRadius-.003,0,1),b.outerWater.material);root.add(b.innerWater);b.innerWater.userData.role='water-below-internal-hydrostatic-interface';
 b.underRimWater=new THREE.Mesh(horizontalRing(g.bellInnerRadius-.003,.70,0,1),b.outerWater.material);root.add(b.underRimWater);b.underRimWater.userData.role='water-below-moving-bell-rim';
 // Ideal check thresholds determine the event; finite display lift eases at each event.
 const event=(low,high,key)=>{for(let i=0;i<48;i++){const mid=(low+high)/2;if(d.gasStateAtPhase(mid)[key])high=mid;else low=mid;}return(high+low)/2;};
 const exhaust=event(1e-8,.5,'upperOutletValveOpen'),intake=event(.50000001,1-1e-8,'lowerInletValveOpen');
 d.valveLiftAtPhase=phase=>({lower:smooth((phase-intake)/.025)*smooth((1-phase)/.025),upper:smooth((phase-exhaust)/.025)*smooth((.5-phase)/.025)});
 d.updateWorkingParts=state=>{
  const lift=d.valveLiftAtPhase(state.phase);
  b.lowerInletValveDisk.position.y=g.inletPipeTopY+.05+.10*lift.lower;
  b.upperOutletValveDisk.position.y=g.bellHeight/2+.2885+.10*lift.upper;
  b.innerWater.position.y=g.outerTubBottomY;b.innerWater.scale.y=state.internalWaterLineY-g.outerTubBottomY;
  b.underRimWater.position.y=g.outerTubBottomY;b.underRimWater.scale.y=Math.max(.001,state.bellRimY-.046-g.outerTubBottomY);
 };
 d.reconstructionNote='Crossing mirrored levers and constant-length ropes reproduce the engraved suspension. Finite walls and bored checks expose the air path. The ideal pressure thresholds retain the analytical polytropic/hydrostatic law; eased valve lift is illustrative, not integrated valve dynamics. External water level remains prescribed, so finite-tub water conservation and water inertia are not solved; gas volumes/plumes are schematic.';
 d.minimumDisplayCycleSeconds=g.cycleDuration;fitPistonGuide(root,d.update,g.cycleDuration);
 d.cameraDirection=new THREE.Vector3(.6,.7,15);d.cameraFov=12;d.cameraDistanceScale=1.05;
}
