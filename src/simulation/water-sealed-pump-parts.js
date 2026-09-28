import * as THREE from 'three';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
import {horizontalPlate,horizontalRing,horizontalTurned} from './horizontal-turbine-solids.js';
import {fitPistonGuide} from './piston-guide-parts.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
const rectangle=(w,h)=>poly([[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]);
const smooth=x=>{const t=Math.max(0,Math.min(1,x));return t*t*t*(10+t*(-15+6*t));};

// Pass 69: Brown's two tubs are coopered barrels. The bell bellies out at
// mid-height and draws in towards its roof and rim; the outer tub is wider at
// its mouth than at its foot. Radii are functions of height in each vessel's
// own frame (bell: about its centre; tub: world y).
export function waterSealedPumpBarrels(g){
 const bellHalf=g.bellHeight/2,tubMid=(g.outerTubTopY+g.outerTubBottomY)/2,tubHalf=(g.outerTubTopY-g.outerTubBottomY)/2;
 const bellOuter=y=>.575+.065*(1-(y/bellHalf)**2),bellWall=.063;
 const tubOuter=y=>1.00+.03*(y-tubMid)/tubHalf+.02*(1-((y-tubMid)/tubHalf)**2),tubWall=.08;
 return{bellOuter,bellInner:y=>bellOuter(y)-bellWall,tubOuter,tubInner:y=>tubOuter(y)-tubWall,bellHalf,tubMid,tubHalf};
}
// Same winding as a plain [axial, radial] wall ring: inner foot, outer face
// upwards, inner face back down.
const barrelProfile=(outer,inner,low,high,n=24)=>{const o=[],i=[];for(let k=0;k<=n;k++){const y=low+(high-low)*k/n;o.push([y,outer(y)]);i.push([y,inner(y)]);}return[i[0],...o,...i.slice(1).reverse()];};

export function correctWaterSealedPump(root){
 const d=root.userData,b=d.blocks,g=d.geometry;
 const barrels=d.barrels=waterSealedPumpBarrels(g);
 // Full finite shells remain transparent so the two check routes can be inspected.
 replace(b.tubShell,horizontalTurned(barrelProfile(barrels.tubOuter,barrels.tubInner,g.outerTubBottomY,g.outerTubTopY)));b.tubShell.position.y=0;
 replace(b.tubBottom,horizontalRing(.09,barrels.tubOuter(g.outerTubBottomY),g.outerTubBottomY-.13,g.outerTubBottomY));b.tubBottom.position.y=0;
 // The tub's bottom is its own staves' wood, flush with the foot (no dark rim).
 b.tubBottom.material=b.tubShell.material;
 replace(b.foundation,horizontalPlate(clip.difference(rectangle(4.95,1.72),poly(circle([0,0],.09,64))),-1.08,-.90));b.foundation.position.y=0;
 replace(b.bellShell,horizontalTurned(barrelProfile(barrels.bellOuter,barrels.bellInner,-g.bellHeight/2,g.bellHeight/2)));
 // The head is set inside the staves' top, its edge following their inner face.
 {const top=g.bellHeight/2,low=top-g.bellRoofThickness,c=b.bellRoof.position.y,n=6,edge=[];for(let k=0;k<=n;k++){const y=low+(top-low)*k/n;edge.push([y-c,barrels.bellInner(y)]);}
  replace(b.bellRoof,horizontalTurned([[low-c,.082],...edge,[top-c,.082]]));}
 replace(b.inletPipe,horizontalRing(.055,.085,g.inletPipeBottomY,g.inletPipeTopY-.0275));b.inletPipe.position.y=0;
 replace(b.lowerInletValveSeat,horizontalRing(.055,.15,-.0275,.0275));
 replace(b.upperOutletPipe,horizontalRing(.052,.078,g.bellHeight/2-.10,g.bellHeight/2+.2225));b.upperOutletPipe.position.y=0;
 replace(b.upperOutletValveSeat,horizontalRing(.052,.14,-.0225,.0225));
 // Each check disk is a wing-guided lift valve: four guide wings under it run
 // in the bore of its seat and pipe (0.002 clear of the bore at the corners),
 // so the lifted disk stays carried on its guide instead of hovering.
 const guide=(disk,bore,halfThickness,length,role)=>{
  const half=Math.sqrt((bore-.002)**2-.006**2),wings=new THREE.Group();
  for(const turn of[0,Math.PI/2]){const wing=new THREE.Mesh(new THREE.BoxGeometry(2*half,length,.012),disk.material);wing.rotation.y=turn;wing.position.y=-halfThickness-length/2;wing.userData.role=`${role}-${turn?2:1}`;wings.add(wing);}
  disk.add(wings);return wings.children;
 };
 b.upperCheckGuide=guide(b.upperOutletValveDisk,.052,.021,.20,'upper-check-disk-guide-wing');
 b.lowerCheckGuide=guide(b.lowerInletValveDisk,.055,.0225,.20,'lower-check-disk-guide-wing');
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
 // Radii follow the barrels: inside the bell's narrowest bore, outside its
 // widest belly and its hoops, and 0.005 inside the tub's staves at every
 // height, so no water enters a wall.
 const bellBore=barrels.bellInner(g.bellHeight/2)-.003,bellBelly=barrels.bellOuter(0)+.035;
 // Pass 88: the water is one closed body of revolution (the outer annulus,
 // the pool under the bell rim and the column inside the bell are one
 // connected region), so no internal faces are drawn between them, and it
 // floats 0.007 above the tub floor so its underside is not coplanar with the
 // floor (z-fighting). Its surfaces are its own top faces: the separate
 // surface sheets that doubled them are removed. Only the rim level (under
 // the rim torus) and the internal level move; their vertices are found by
 // building the profile at two trial levels and are moved in place.
 const floor=g.outerTubBottomY+.007,rimGap=.046,barrel=[];
 for(let k=0;k<=12;k++){const y=floor+(g.externalWaterLineY-floor)*k/12;barrel.push([y,barrels.tubInner(y)-.005]);}
 const waterProfile=(rim,inner)=>[[floor,.09],...barrel,[g.externalWaterLineY,bellBelly],[rim,bellBelly],[rim,bellBore],[inner,bellBore],[inner,.09]];
 const s0=d.gasStateAtPhase(0),rim0=s0.bellRimY-rimGap,inner0=s0.internalWaterLineY;
 const waterGeometry=horizontalTurned(waterProfile(rim0,inner0)),trial=horizontalTurned(waterProfile(rim0+.0123,inner0+.0456));
 const waterY=waterGeometry.attributes.position,trialY=trial.attributes.position,rimVertices=[],innerVertices=[];
 for(let i=0;i<waterY.count;i++){const dy=trialY.getY(i)-waterY.getY(i);if(Math.abs(dy-.0123)<1e-4)rimVertices.push(i);else if(Math.abs(dy-.0456)<1e-4)innerVertices.push(i);}
 trial.dispose();
 replace(b.outerWater,waterGeometry);b.outerWater.position.y=0;b.outerWater.userData.role='water-in-tub-round-and-under-the-bell';
 const setWaterLevels=(rim,inner)=>{for(const i of rimVertices)waterY.setY(i,rim);for(const i of innerVertices)waterY.setY(i,inner);waterY.needsUpdate=true;};
 for(const sheet of[b.outerWaterSurface,b.internalWaterSurface]){sheet.removeFromParent();sheet.geometry.dispose();}
 delete b.outerWaterSurface;delete b.internalWaterSurface;
 // Ideal check thresholds determine the event; finite display lift eases at each event.
 const event=(low,high,key)=>{for(let i=0;i<48;i++){const mid=(low+high)/2;if(d.gasStateAtPhase(mid)[key])high=mid;else low=mid;}return(high+low)/2;};
 const exhaust=event(1e-8,.5,'upperOutletValveOpen'),intake=event(.50000001,1-1e-8,'lowerInletValveOpen');
 d.valveLiftAtPhase=phase=>({lower:smooth((phase-intake)/.025)*smooth((1-phase)/.025),upper:smooth((phase-exhaust)/.025)*smooth((.5-phase)/.025)});
 d.updateWorkingParts=state=>{
  const lift=d.valveLiftAtPhase(state.phase);
  b.lowerInletValveDisk.position.y=g.inletPipeTopY+.05+.10*lift.lower;
  b.upperOutletValveDisk.position.y=g.bellHeight/2+.2885+.10*lift.upper;
  setWaterLevels(state.bellRimY-rimGap,state.internalWaterLineY);
 };
 d.reconstructionNote='Crossing mirrored levers and constant-length ropes reproduce the engraved suspension. Finite walls and bored checks expose the air path. The ideal pressure thresholds retain the analytical polytropic/hydrostatic law; eased valve lift is illustrative, not integrated valve dynamics. External water level remains prescribed, so finite-tub water conservation and water inertia are not solved; gas volumes/plumes are schematic.';
 d.minimumDisplayCycleSeconds=g.cycleDuration;fitPistonGuide(root,d.update,g.cycleDuration);
 d.cameraDirection=new THREE.Vector3(.6,.7,15);d.cameraFov=12;d.cameraDistanceScale=1.05;
}
