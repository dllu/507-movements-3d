import {drumContact,drumContactState} from './oscillating-drum-contact.js';
import {drumPawlPath} from './oscillating-drum-pawl-data.js';
import * as T from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
const bore=(outer,inner,length,segments=96)=>boredLatheGeometry([{axial:-length/2,radial:outer},{axial:length/2,radial:outer}],inner,segments);
const role=(root,name)=>{let found;root.traverse(o=>{if(o.userData.role===name)found=o;});return found;};
function mesh(parent,g,material,name){const o=new T.Mesh(g,material);o.userData.role=name;parent.add(o);return o;}
export function correctAxialPinParts(model){
 const d=model.root.userData,b=d.blocks;
 replace(b.pulleyDog,new T.CylinderGeometry(.06,.06,.30,128).rotateY(-d.dogGeometry.pinContactPhase));replace(b.shaftDog,new T.CylinderGeometry(.06,.06,.325,128));
 for(const o of[b.lowerPulley.sheave,b.lowerPulley.hub,...b.lowerPulley.flanges]){const p=o.geometry.parameters;replace(o,bore(p.radiusTop,.089,p.height));}
 for(const pulley of[b.upperPulley,b.lowerPulley]){const profile=[{axial:-.135,radial:.46},{axial:-.040,radial:.46}];for(let i=0;i<=32;i++){const x=-.040+.080*i/32;profile.push({axial:x,radial:.46-Math.sqrt(Math.max(0,.040**2-x*x))});}profile.push({axial:.135,radial:.46});replace(pulley.sheave,boredLatheGeometry(profile,pulley===b.lowerPulley?.089:.079,128));if(pulley.groove)pulley.groove.visible=false;}
 for(const bearing of b.bearingBlocks){const radius=bearing.position.y>0?.079:.089;replace(bearing,plate(clip.difference(poly([[-.14,-.20],[.42,-.20],[.42,.20],[-.14,.20]]),poly(circle([0,0],radius,96))),-.16,.16).rotateY(Math.PI/2));bearing.position.z=0;}

 d.workingPartsReview={qualification:'Finite perpendicular pin axes meet on their sides at the analytically determined phase offset. Axial shifts occur at rest; load, impact and synchronization under power are not simulated.'};return model;
}
export function correctDicksonParts(model){
 const {root}=model,d=root.userData,b=d.blocks,g=d.geometry;
 replace(b.wheelRing,bore(g.wheelOuterRadius,g.wheelInnerRadius,.48,768).rotateX(Math.PI/2));b.wheelRing.position.z=.40;
 for(const[name,pawl,pivot,angle]of[['B',b.bPawl,g.bPawlPivot,g.bSeatedAngle],['C',b.cPawl,g.cPawlPivot,g.cSeatedAngle]]){
  const body=pawl.children[0],outline=body.geometry.parameters.shapes.extractPoints(16).shape.map(p=>p.toArray()),c=Math.cos(angle),s=Math.sin(angle),center=[-c*pivot.x-s*pivot.y,s*pivot.x-c*pivot.y];
  const region=clip.difference(clip.intersection(poly(outline),poly(circle(center,g.wheelInnerRadius,768))),poly(circle([0,0],.083,96)));replace(body,plate(region,-.075,.075));
  const eye=pawl.children[1];replace(eye,bore(.12,.083,.23));
  const pin=mesh(b.leverRotor,new T.CylinderGeometry(.080,.080,.44,48),b.fixedShaft.material,`fixed-lever-pin-for-pawl-${name}`);pin.rotation.x=Math.PI/2;pin.position.copy(pivot);pin.position.z=.45;
  pawl.userData.contact.visible=false;
 }
 for(const[name,outer,length]of[['fixed-rear-bearing',.26,.44],['wheel-D-hub-fast-with-smooth-rim',.31,.34],['lever-A-loose-hub-on-wheel-D-shaft',.28,.30]])replace(role(root,name),bore(outer,.109,length));
 const lever=role(root,'T-shaped-rigid-body-of-lever-A'),shape=lever.geometry.parameters.shapes.extractPoints(16).shape.map(p=>p.toArray());replace(lever,plate(clip.difference(poly(shape),poly(circle([0,0],.27,96))),-.095,.095));
 for(const o of b.wheelRotor.children)if(o.userData.role==='wheel-D-spoke-fast-with-rim-and-hub'){const half=g.wheelInnerRadius*1.025;replace(o,plate(clip.difference(poly([[-half,-.0425],[half,-.0425],[half,.0425],[-half,.0425]]),poly(circle([0,0],.109,96))),-.05,.05));}
 replace(role(root,'translucent-wheel-D-web'),bore(g.wheelInnerRadius-.004,.30,.03).rotateX(Math.PI/2));
 d.workingPartsReview={qualification:'Both opposed pawls now have finite faces in the rim working band and bored hinges. Selection and overrun are prescribed; cord tension, self-wedging friction and load capacity remain unqualified.'};return model;
}
export function correctOscillatingDrum(model){
 const {root}=model,d=root.userData,b=d.blocks,p=drumContact,oldState=d.stateAtTime,oldUpdate=model.update;
 let profile=poly(circle([0,0],p.rootRadius,96));for(let i=0;i<16;i++){const a=i*p.pitch,c=Math.cos(a),s=Math.sin(a);profile=clip.union(profile,poly(p.profile.map(([x,y])=>[c*x-s*y,s*x+c*y])));}profile=clip.difference(profile,poly(circle([0,0],.104,96)));replace(b.ratchetWheel,plate(profile,-.07,.07));
 b.pawlHinge.position.set(...p.pivot,.62);
 replace(b.pawlArm,plate(clip.difference(clip.union(capsule([0,0],[p.length,0],.020,32),poly(circle([0,0],.056,64))),poly(circle([0,0],.044,96))),-.035,.035));b.pawlArm.position.set(0,0,0);
 replace(b.pawlTip,new T.SphereGeometry(p.rollerRadius,32,24));b.pawlTip.position.set(p.length,0,0);b.pawlTip.rotation.set(0,0,0);
 const pin=role(root,'drum-mounted-pawl-pin');replace(pin,new T.CylinderGeometry(.040,.040,.34,48));pin.position.z=-.03;
 const hub=mesh(b.flywheelRotor,bore(.145,.098,.14),b.ratchetWheel.material,'hub-fastening-ratchet-to-shaft');hub.rotation.x=Math.PI/2;hub.position.z=.62;
 const grooved=role(root,'loose-drum-cord-groove'),R=d.geometry.drumRadius,points=[{axial:.44,radial:R},{axial:.634,radial:R}];for(let i=0;i<=24;i++){const z=.636+.068*i/24;points.push({axial:z,radial:R-Math.sqrt(Math.max(0,.034**2-(z-.67)**2))});}points.push({axial:.76,radial:R});replace(grooved,boredLatheGeometry(points,.59,128).rotateX(Math.PI/2));grooved.position.z=0;
 for(const spoke of b.flywheelSpokes)replace(spoke,new T.BoxGeometry(d.geometry.flywheelRadius,.12,.16).translate(d.geometry.flywheelRadius/2,0,0));
 function state(time){const s=oldState(time),q=drumContactState(time);let t=q.localTime;if(t<drumPawlPath.start)t+=p.period;let lift=0;if(!q.locked){const u=(t-drumPawlPath.start)/(drumPawlPath.end-drumPawlPath.start)*(drumPawlPath.rows.length-1),i=Math.max(0,Math.min(drumPawlPath.rows.length-2,Math.floor(u))),f=Math.max(0,Math.min(1,u-i));lift=drumPawlPath.rows[i]*(1-f)+drumPawlPath.rows[i+1]*f;}
  return{...s,flywheelAngle:q.angle,flywheelAngularSpeed:q.speed,pawlLift:lift,pawlMode:q.locked?'driving locked against a finite ratchet face':'overrunning on a prescribed finite-clearance path',carrierCatching:q.locked,ratchetLocked:q.locked,relativeToothPhase:((q.relativeAngle-p.lockPhase)%p.pitch+p.pitch)%p.pitch/p.pitch,driveImpulsePrescribed:q.locked&&Math.abs(q.localTime-p.catchTime)<1e-9};}
 d.stateAtTime=state;d.dynamics={...d.dynamics,displayAssumption:'Prescribed .20 rad/s coasting alternates with exact drum-speed locking; capture is an ideal impact, not an inertia/load simulation.',flywheelAngularSpeed:null,flywheelAdvancePerCycle:2*p.advance,flywheelAdvancePerBeamCycle:p.advance};d.timeline.markedClosurePeriod=48;d.timeline.lockingIntervals=[[p.catchTime,p.releaseTime],[p.period+p.catchTime,p.period+p.releaseTime]];d.geometry.pawlMaximumLift=Math.max(...drumPawlPath.rows);d.degreesOfFreedom.note='Flywheel angle follows a prescribed periodic capture/coast history; inertia and load are not integrated.';d.degreesOfFreedom.storedEnergyStates=0;
 d.workingPartsReview={qualification:'Finite pawl/ratchet locking and continuous free-overrun clearance are reconstructed. The rounded pawl nose is inferred from the source hook. Capture impulse and positive coast speed are prescribed; no flywheel inertia, friction or load has been solved.'};
 model.update=time=>{oldUpdate(time);const s=state(time);b.flywheelRotor.rotation.z=s.flywheelAngle;b.pawlHinge.rotation.z=p.base-s.pawlLift;d.currentState=s;};model.update(0);return model;
}

export function finishOneWayFamily(model,id){const{root,update}=model,d=root.userData;d.reconstructionNote=({360:'The rounded pawl nose and positive flywheel coast are reconstructed. Capture, spring motion and coasting are prescribed; inertia and load forces are not simulated.',361:'The finite pins meet during stopped axial shifting. Engagement under power, belt tension and impact forces are not simulated.',415:'The selected pawl faces fit the inner rim. Reversal and overrun are prescribed; cord tension, self-wedging friction and load capacity are not simulated.'})[id];d.hideGround=true;d.minimumDisplayCycleSeconds=12;root.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)m.fog=false;});const bounds=new T.Box3();for(let i=0;i<=32;i++){update(12*i/32);root.updateMatrixWorld(true);root.traverseVisible(o=>{if(!o.geometry)return;o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));});}update(0);d.cameraFitBounds=bounds;d.cameraDistanceScale=1.04;model.cameraDirection=new T.Vector3(id===361?4:.5,id===361?2:.4,12);return model;}
