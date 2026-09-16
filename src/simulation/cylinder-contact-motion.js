import * as T from 'three';
import data from './baked/cylinder-contact.js';
import {plate,poly,capsule} from './finite-plate-geometry.js';
const pitch=2*Math.PI/15,period=4;
const rotate=(p,a)=>new T.Vector2(p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a));
function evaluate(coefficients,q){let lo=0,hi=data.knots.length-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(data.knots[mid]<=q)lo=mid;else hi=mid;}const c=coefficients[lo],x=q-data.knots[lo];return{angle:((c[0]*x+c[1])*x+c[2])*x+c[3],speed:(3*c[0]*x*x+2*c[1]*x+c[2])/period,acceleration:(6*c[0]*x+2*c[1])/(period*period)};}
const initial=evaluate(data.wheelCoefficients,0).angle,inside=evaluate(data.wheelCoefficients,.5).angle;
export function installCylinderContact(model,id){
 const {root}=model,d=root.userData,b=d.blocks,g=d.geometry,shell=b.workingShell??b.cylinderSection;
 const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
 replace(shell,plate(poly(data.shell),-g.workingBandWidth/2,g.workingBandWidth/2));shell.userData.role='rounded-196-degree-cylinder-with-working-inner-and-outer-locks';
 const headGeometry=plate(poly(data.head),-g.palletDepth/2,g.palletDepth/2),stemPoint=data.headCentroid,radial=Math.hypot(...stemPoint),footPoint=stemPoint.map(v=>v*2.50/radial);
 const footGeometry=plate(capsule(footPoint,stemPoint,.065,24),g.wheelPlaneZ-.10,g.wheelPlaneZ+.10);
 const oldHeadGeometries=new Set(b.palletHeads.map(o=>o.geometry)),oldFootGeometries=new Set();
 b.palletHeads.forEach((head,i)=>{head.geometry=headGeometry;const stem=b.palletStems[i];replace(stem,new T.CylinderGeometry(.035,.035,g.workingPlaneZ-g.wheelPlaneZ,24));stem.position.x=stemPoint[0];stem.position.y=stemPoint[1];const foot=b.palletAssemblies[i].children.find(o=>o.userData.role==='raised-pallet-stem-foot-connected-to-wheel-rim');if(foot){oldFootGeometries.add(foot.geometry);foot.geometry=footGeometry;}});
 for(const geometry of[...oldHeadGeometries,...oldFootGeometries])geometry.dispose();
 for(const o of[...b.palletFaceMarks,b.entryLipRail,b.exitLipRail,b.entryLipTrace,b.exitLipTrace,b.outerLockTrace,b.innerLockTrace,b.contactMarker])o.visible=false;
 replace(b.wheelIndex,new T.BoxGeometry(.045,.045,.006));b.wheelIndex.position.set(...stemPoint,g.workingPlaneZ+g.palletDepth/2+.003);
 for(const marker of b.palletLabelMarkers??[]){const p=rotate(stemPoint,marker.userData.index*pitch);replace(marker,new T.BoxGeometry(.035,.035,.006));marker.position.set(p.x,p.y,g.workingPlaneZ+g.palletDepth/2+.003);}
 const wheelCenter=g.wheelCenter,cylinderCenter=g.cylinderCenter;
 const stateAtTime=time=>{
  const coordinate=time/period,cycleIndex=Math.floor(coordinate),q=coordinate-cycleIndex,B=evaluate(data.balanceCoefficients,q),W=evaluate(data.wheelCoefficients,q),drop=data.dropIntervals.some(([a,z])=>q>=a&&q<z);
  const next=Math.abs(W.angle-(initial-pitch))<.0001,outer=Math.abs(W.angle-initial)<.0001||next,inner=Math.abs(W.angle-inside)<.0001;
  const mode=drop?null:outer?'outside-frictional-rest':inner?'inside-frictional-rest':B.speed<0?'entry-lip-impulse':'exit-lip-impulse';
  const activeToothIndex=((cycleIndex+(next?1:0))%15+15)%15,angle=W.angle+(next?pitch:0),wheelAngle=W.angle-cycleIndex*pitch;let contact=null;
  if(mode){let point,expectedPoint,normal;
   if(outer||inner){point=rotate(data.point,angle).add(wheelCenter);const r=point.clone().sub(cylinderCenter).normalize();expectedPoint=cylinderCenter.clone().addScaledVector(r,outer?data.outerRadius:data.innerRadius);normal=r.multiplyScalar(outer?1:-1);}
   else{const center=rotate(data.curveCenter,angle).add(wheelCenter),lip=rotate(data.lipCenters[B.speed<0?1:0],B.angle).add(cylinderCenter);normal=center.clone().sub(lip).normalize();point=center.clone().addScaledVector(normal,-data.pointRadius);expectedPoint=lip.clone().addScaledVector(normal,data.lipRadius);}
   const toothRadius=point.clone().sub(wheelCenter),lipRadius=expectedPoint.clone().sub(cylinderCenter),toothVelocity=new T.Vector2(-toothRadius.y,toothRadius.x).multiplyScalar(W.speed),cylinderVelocity=new T.Vector2(-lipRadius.y,lipRadius.x).multiplyScalar(B.speed),relativeVelocity=toothVelocity.clone().sub(cylinderVelocity);
   contact={mode,point,expectedPoint,faceNormal:normal,faceTangent:new T.Vector2(-normal.y,normal.x),gap:point.distanceTo(expectedPoint),normalVelocityError:relativeVelocity.dot(normal),relativeSlipSpeed:relativeVelocity.dot(new T.Vector2(-normal.y,normal.x)),wheelMoment:toothRadius.cross(normal),cylinderMoment:-lipRadius.cross(normal),finiteSurfaceValidated:true,forceValidated:false};
  }
  return{cycleIndex,cyclePhase:q,activeToothIndex,currentToothIndex:activeToothIndex,balanceAngle:B.angle,balanceAngularSpeed:B.speed,balanceAngularAcceleration:B.acceleration,wheelAngle,wheelAdvance:initial-W.angle,wheelAngularSpeed:W.speed,wheelAngularAcceleration:W.acceleration,contact,contactActive:!!contact,contactMode:mode,entryImpulseActive:mode==='entry-lip-impulse',exitImpulseActive:mode==='exit-lip-impulse',stage:mode??'prescribed-finite-drop',wheelEvent:mode??'drop'};
 };
 const update=time=>{const s=stateAtTime(time);b.cylinderAssembly.rotation.z=s.balanceAngle;b.wheelRotor.rotation.z=s.wheelAngle;b.contactMarker.visible=false;d.kinematics=s;d.contacts={mode:s.contactMode,activeToothIndex:s.activeToothIndex,contactKind:'finite-curved-tooth-and-rounded-cylinder',finiteSurfaceValidated:true,forceValidated:false,gap:s.contact?.gap??null};};
 d.stateAtTime=stateAtTime;d.stateAtCyclePhase=q=>stateAtTime(q*period);d.cylinderContactBake=data;d.canonicalTimes={outerRest:.1*period,entryImpulseMiddle:.25*period,insideDropMiddle:data.dropIntervals[0]?.reduce((a,z)=>a+z,0)/2*period,innerRest:.5*period,exitImpulseMiddle:.74*period,nextOuterRest:.94*period,oneOscillation:period};d.canonicalStates=Object.fromEntries(Object.entries(d.canonicalTimes).map(([name,t])=>[name,stateAtTime(t)]));
 const entryEnd=data.dropIntervals[0][0],innerLanding=data.dropIntervals[0][1],exitEnd=data.dropIntervals[1][0],outerLanding=data.dropIntervals[1][1],entryStart=data.knots.find(q=>evaluate(data.wheelCoefficients,q).angle<initial-.0001),exitStart=data.knots.find(q=>q>.5&&evaluate(data.wheelCoefficients,q).angle<inside-.0001);
 const entryAdvance=initial-evaluate(data.wheelCoefficients,entryEnd).angle,exitAdvance=inside-evaluate(data.wheelCoefficients,exitEnd).angle,freeDropAdvance=pitch-entryAdvance-exitAdvance;
 d.transmission={...d.transmission,entryImpulseAdvance:entryAdvance,exitImpulseAdvance:exitAdvance,freeDropAdvance,loadedImpulseValidated:false,geometricOppositeImpulses:true};
 d.toothReferencePoint=(angle,index)=>rotate(data.point,angle+index*pitch).add(wheelCenter);d.wheelAngleAtCyclePhase=(cycle,q)=>evaluate(data.wheelCoefficients,q).angle-cycle*pitch;d.wheelStateAtPhase=q=>{const s=stateAtTime(q*period);return{advance:s.wheelAdvance,angularSpeed:s.wheelAngularSpeed,angularAcceleration:s.wheelAngularAcceleration,event:s.wheelEvent};};
 delete d.contactFrameAtPhase;delete d.impulseLocalPointAtPhase;delete d.entryLipPoints;delete d.exitLipPoints;
 d.finiteContactReview={qualification:'Finite tooth, rounded lip, inner/outer rest and neighboring-tooth clearance qualified by sampled geometry; continuous balance and drop timing are prescribed. Native force, friction, impact and spring-energy closure are not validated.',noPassiveForceValidation:true,contactMarkersSuppressed:true};
 d.reconstructionNote='The curved teeth and rounded 196° cylinder follow a historical compass construction. The surface-near geometric path has opposite entry and exit impulse reactions; the tooth point runs on a smaller radius than its heel. The path retains about 0.001 model-unit running clearance, and a small inner-bore allowance clears the opposite heel. Balance motion and finite drop timing are prescribed, including a brief balance pause during drop; spring forces, friction and impacts are not dynamically validated.';
 d.geometry={...g,entryStart,entryEnd,innerLanding,exitStart,exitEnd,outerLanding,entryImpulseAdvance:entryAdvance,exitImpulseAdvance:exitAdvance,freeDropAdvance,balanceAmplitude:Math.PI/3,cylinderShellStartAngle:-10*Math.PI/180,cylinderShellSweep:196*Math.PI/180};
 root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;for(const m of[].concat(o.material))m.fog=false;}});update(0);return{...model,update};
}
