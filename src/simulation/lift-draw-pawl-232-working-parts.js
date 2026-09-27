import {finishRockingPawl232} from './lift-draw-pawl-232-branch.js';
import * as T from 'three';
import {poly,circle,capsule,plate,polygonClipping as clip} from './finite-plate-geometry.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {makeBoredPlanarLink} from './bored-planar-link.js';

const smooth=x=>x*x*x*(10+x*(-15+6*x)),first=x=>30*x*x*(x-1)*(x-1),second=x=>60*x*(2*x*x-3*x+1);
function unexpanded(mesh,extra=[]){
 const {shapes,options}=mesh.geometry.parameters;
 const region=clip.difference(poly(shapes.getPoints(48).map(p=>p.toArray())),...shapes.holes.map(h=>poly(h.getPoints(48).map(p=>p.toArray()))),...extra.map(([x,y,r])=>poly(circle([x,y],r,96))));
 const old=mesh.geometry;mesh.geometry=plate(region,-options.depth/2,options.depth/2);old.dispose();
}

export function finishLiftDrawPawl232(model){
 const d=model.root.userData,b=d.blocks,g=d.geometry,oldUpdate=model.update,oldState=d.stateAtCycleCoordinate;
 // Bevels must not close bores or enlarge the square tooth working section.
 unexpanded(b.wheel.userData.body);unexpanded(b.pawlBody,[[g.shortLinkLength,0,.076]]);
 // Handle B's rounded end runs on the wheel shaft (r .105) with a .0005
 // running fit; the end is rounded out to r .16 to leave a wall round the bore.
 {const lever=b.inputLeverBody,{shapes,options}=lever.geometry.parameters;
  const region=clip.difference(clip.union(poly(shapes.getPoints(48).map(p=>p.toArray())),poly(circle([0,0],.16,96))),
   poly(circle([0,0],.1055,96)),poly(circle([g.shortLinkLength,0],.076,96)));
  lever.geometry.dispose();lever.geometry=plate(region,-options.depth/2,options.depth/2);}
 const frameShape=b.framePlate.geometry.parameters.shapes,frameRegion=clip.difference(clip.union(poly(frameShape.getPoints(48).map(p=>p.toArray())),poly(circle(g.retainingPivot.toArray(),.14,96))),...frameShape.holes.filter(h=>h.getPoints(8)[0].length()>.3).map(h=>poly(h.getPoints(48).map(p=>p.toArray()))),poly(circle(g.retainingPivot.toArray(),.070,96)),poly(circle([0,0],.1055,96)));b.framePlate.geometry.dispose();b.framePlate.geometry=plate(frameRegion,-.07,.07);
 // Carrier A journals on the wheel shaft (r .105) with a .0005 running fit.
 const wheelIndex=b.wheel.userData.index;wheelIndex.geometry.dispose();wheelIndex.geometry=new T.BoxGeometry(.045,.8,.012);wheelIndex.position.set(0,-1.15,.196);
 b.framePlate.position.z=.49;b.inputLever.position.z=.70;
 const oldCoupler=b.coupler;oldCoupler.visible=false;
 const coupler=makeBoredPlanarLink({length:g.groundLength,width:.13,eyeRadius:.115,boreRadius:.076,depth:.12},b.inputLeverBody.material);coupler.userData.role='232-through-bored-parallelogram-coupler';model.root.add(coupler);b.coupler=coupler;
 const radius=.085,clearance=.000003,pivot=g.retainingPivot,faceAngle=-g.gapHalfAngle,tipRadius=2.065,tipAngle=faceAngle+Math.acos((tipRadius*tipRadius+g.wheelOuterRadius**2-(radius+clearance)**2)/(2*tipRadius*g.wheelOuterRadius)),nominalTip=new T.Vector2(tipRadius*Math.cos(tipAngle),tipRadius*Math.sin(tipAngle)),length=nominalTip.distanceTo(pivot),rest=Math.atan2(nominalTip.y-pivot.y,nominalTip.x-pivot.x),lift=.42;
 // Seat at the actual outer corner, rather than burying the roller inside the
 // narrow square tooth gap. The original fixed click pivot remains in place.
 const region=clip.difference(capsule([0,0],[length,0],.13,64),poly(circle([0,0],.071,96)),poly(circle([length,0],.041,96)));
 const oldBody=b.retainingBody.geometry;b.retainingBody.geometry=plate(region,-.05,.05);oldBody.dispose();
 b.retainingClick.position.z=.29;
 const oldNose=b.retainingNose.geometry;b.retainingNose.geometry=boredLatheGeometry([{axial:-.15,radial:radius},{axial:.15,radial:radius}],.041,128);oldNose.dispose();b.retainingNose.position.set(length,0,-.22);
 // The working roller is fastened to the click; the visible body has a bored
 // pivot. Its small axle is behind the roller's face, outside the wheel plane.
 const axle=new T.Mesh(new T.CylinderGeometry(.04,.04,.24,48),b.retainingNose.material);axle.rotation.x=Math.PI/2;axle.position.set(length,0,-.02);b.retainingClick.add(axle);b.retainingNoseAxle=axle;
 b.retainingPivotPin.position.z=.39;b.retainingPivotPin.geometry.dispose();b.retainingPivotPin.geometry=new T.CylinderGeometry(.065,.065,.30,48);
 b.pawlCouplerPin.geometry.dispose();b.pawlCouplerPin.geometry=new T.CylinderGeometry(.07,.07,.88,48);
 b.outputShaft.scale.z=1.3;
 const restTip=pivot.clone().add(new T.Vector2(length*Math.cos(rest),length*Math.sin(rest)));
 Object.assign(g,{retainingLength:length,retainingRestAngle:rest,retainingLift:lift,retainingNoseAtRest:restTip});
 Object.assign(g.axialLayers,{frameA:{center:.49,depth:.14},inputB:{center:.70,depth:.14},coupler:{center:.86,depth:.12},retainingClick:{center:.29,depth:.10}});
 function clickLaw(phase){
  let angle=rest,speed=0,acceleration=0;
  const segment=phase>=.4&&phase<.5?[.4,.1,1]:phase>=.75?[.75,.25,-1]:null;
  if(phase>=.5&&phase<.75)angle+=lift;
  if(segment){const[start,duration,sign]=segment,x=(phase-start)/duration,rate=g.cyclesPerSecond/duration;angle+=lift*(sign===1?smooth(x):1-smooth(x));speed=sign*lift*first(x)*rate;acceleration=sign*lift*second(x)*rate*rate;}
  return{angle,speed,acceleration};
 }
 d.stateAtCycleCoordinate=c=>{const s=oldState(c),q=clickLaw(s.cyclePhase),point=pivot.clone().add(new T.Vector2(length*Math.cos(q.angle),length*Math.sin(q.angle)));return{...s,clickAngle:q.angle,clickAngularSpeed:q.speed,clickAngularAcceleration:q.acceleration,retainingNosePoint:point,retainingNoseRadialLift:point.length()-restTip.length(),retainingClickEngaged:s.cyclePhase<=.4||s.cyclePhase>=1-1e-12};};
 d.stateAtTime=t=>d.stateAtCycleCoordinate(t*g.cyclesPerSecond);
 d.retainingContact={inferredAdjacentGap:0,rollerRadius:radius,seatingClearance:clearance,passiveLiftSolved:false,contactPoint:new T.Vector2(g.wheelOuterRadius*Math.cos(faceAngle),g.wheelOuterRadius*Math.sin(faceAngle))};
 d.sourceAnimation={...d.sourceAnimation,available:false,reason:'The fetched official page has no canvas, inline animation program or ae.add_model registration (checked 2026-09-16).'};
 d.reconstructionNote='The retaining click has a finite seated roller, a prescribed clear lift and bored joints. Its rounded outer-corner contact is inferred; passive spring forces and holding during pre-lift are not solved. The main drawing pawl still intersects the wheel: its rigid return path and prescribed drawing law need a compatible contact reconstruction.';
 d.hideGround=true;d.minimumDisplayCycleSeconds=6;
 model.root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}for(const mat of(Array.isArray(o.material)?o.material:[o.material]))if(mat)mat.fog=false;});
 model.update=t=>{oldUpdate(t);const s=d.stateAtTime(t);b.inputLever.position.z=.70;coupler.userData.setEndpoints(new T.Vector3(s.inputCouplerPivot.x,s.inputCouplerPivot.y,.86),new T.Vector3(s.pawlCouplerPivot.x,s.pawlCouplerPivot.y,.86));b.inputCouplerPin.position.z=.78;b.pawlCouplerPin.position.z=.50;b.retainingClick.rotation.z=s.clickAngle;b.retainingClick.userData.angularSpeed=s.clickAngularSpeed;d.contacts.retainingClick={engaged:s.retainingClickEngaged,nosePoint:s.retainingNosePoint,radialLift:s.retainingNoseRadialLift,passiveLiftSolved:false};d.kinematics=s;};
 model.cameraDirection=new T.Vector3(.6,.45,12);model.update(0);return finishRockingPawl232(model);
}
