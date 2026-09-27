import * as T from 'three';
import {poly,circle,capsule,plate,polygonClipping as clip} from './finite-plate-geometry.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';

// Position, velocity and acceleration jets keep the inverse linkage law exact.
const j=(x,v=0,a=0)=>({x,v,a}),add=(a,b)=>j(a.x+b.x,a.v+b.v,a.a+b.a),scale=(a,s)=>j(a.x*s,a.v*s,a.a*s),mul=(a,b)=>j(a.x*b.x,a.v*b.x+a.x*b.v,a.a*b.x+2*a.v*b.v+a.x*b.a),inv=a=>j(1/a.x,-a.v/a.x**2,2*a.v*a.v/a.x**3-a.a/a.x**2),acos=a=>{const s=Math.sqrt(1-a.x*a.x);return j(Math.acos(a.x),-a.v/s,-a.a/s-a.x*a.v*a.v/s**3);};
const smooth=x=>x*x*x*(10+x*(-15+6*x)),first=x=>30*x*x*(x-1)*(x-1),second=x=>60*x*(2*x*x-3*x+1);
function travel(phase,start,end,from,to,period){const x=T.MathUtils.clamp((phase-start)/(end-start),0,1),rate=1/((end-start)*period),delta=to-from;return j(from+delta*smooth(x),delta*first(x)*rate,delta*second(x)*rate*rate);}
const point=(r,a)=>new T.Vector2(r*Math.cos(a),r*Math.sin(a));

export function finishRockingPawl232(model){
 const d=model.root.userData,b=d.blocks,g=d.geometry,oldUpdate=model.update;
 const period=6,pitch=g.toothPitch,L=g.groundLength,radius=.065;
 // Pawl C's working end is an oblong finger in the wheel's tooth plane: its
 // working side lies along the square tooth's radial face and its flat end
 // sits just off the root, so it fills the space between two teeth. The
 // reference point is the middle of the finger's flat end.
 const fingerWidth=.15,faceClearance=.004,rootClearance=.012,backlash=.02,
  faceAngle=g.gapMountPhase-g.gapHalfAngle,faceDirection=point(1,faceAngle),normal=point(1,faceAngle+Math.PI/2),
  fingerEndRadius=g.wheelRootRadius+rootClearance,
  seat=faceDirection.clone().multiplyScalar(fingerEndRadius).addScaledVector(normal,faceClearance+fingerWidth/2),
  faceRadius=g.wheelRootRadius+.5*(g.wheelOuterRadius-g.wheelRootRadius),
  noseLocal=seat.clone().sub(new T.Vector2(0,L)),linkLength=noseLocal.length(),linkAngle=noseLocal.angle(),seatRadius=seat.length(),seatAngle=seat.angle(),
  clearRadius=g.wheelOuterRadius+.07,slip=backlash/seatRadius;
 const inverse=(r,angle)=>{const rr=mul(r,r),cosA=mul(add(rr,j(L*L-linkLength*linkLength)),scale(inv(r),1/(2*L))),cosB=mul(add(rr,j(linkLength*linkLength-L*L)),scale(inv(r),1/(2*linkLength)));return{carrier:add(add(angle,acos(cosA)),j(-Math.PI/2)),input:add(add(angle,scale(acos(cosB),-1)),j(-linkAngle))};};
 const source=inverse(j(seatRadius),j(seatAngle));
 // Lift backs the finger off the face as it rises; it travels back one pitch
 // clear of the tips, drops into the next space a little behind the face,
 // takes up that backlash, then draws the wheel one pitch.
 const path=phase=>{let r=j(seatRadius),angle=j(seatAngle),stage='lift';if(phase<.16){r=travel(phase,0,.16,seatRadius,clearRadius,period);angle=travel(phase,0,.16,seatAngle,seatAngle+slip,period);}else if(phase<.4){r=j(clearRadius);angle=travel(phase,.16,.4,seatAngle+slip,seatAngle+pitch+slip,period);stage='back';}else if(phase<.56){r=travel(phase,.4,.56,clearRadius,seatRadius,period);angle=j(seatAngle+pitch+slip);stage='drop';}else if(phase<.62){angle=travel(phase,.56,.62,seatAngle+pitch+slip,seatAngle+pitch,period);stage='capture';}else if(phase<.92){angle=travel(phase,.62,.92,seatAngle+pitch,seatAngle,period);stage='draw';}else stage='reseat';return{r,angle,stage};};
 function state(c){
  const nearest=Math.round(c);if(Math.abs(c-nearest)<1e-12)c=nearest;const cycleIndex=Math.floor(c),phase=c-cycleIndex,{r,angle,stage}=path(phase),ik=inverse(r,angle),a=add(ik.carrier,scale(source.carrier,-1)),beta=add(ik.input,scale(source.input,-1)),P=point(L,Math.PI/2+a.x),Q=point(g.shortLinkLength,beta.x),S=P.clone().add(Q),nose=point(r.x,angle.x),drawing=stage==='draw',complete=stage==='reseat',wheel=drawing?add(angle,j(-seatAngle-pitch-cycleIndex*pitch)):j(-(cycleIndex+(complete?1:0))*pitch);
  const contactActive=drawing||complete||phase===0,contactPoint=point(faceRadius,angle.x+faceAngle-seatAngle),contactNormal=point(1,angle.x+faceAngle-seatAngle-Math.PI/2),contact=contactActive?{pawlPoint:contactPoint,wheelPoint:contactPoint.clone(),surfaceNormal:contactNormal,surfaceTangent:point(1,angle.x+faceAngle-seatAngle),normalVelocityError:0,positionError:0,slidingSpeed:0,outputMomentArm:-faceRadius,forceSolved:false,activeGapIndex:T.MathUtils.euclideanModulo(cycleIndex+(phase>=.4?1:0),g.toothCount)}:null;
  return{cycleCoordinate:c,cycleIndex,cyclePhase:phase,stage,carrierAngle:a.x,carrierAngularSpeed:a.v,carrierAngularAcceleration:a.a,inputAngle:beta.x,inputAngularSpeed:beta.v,inputAngularAcceleration:beta.a,pawlAngle:beta.x,pawlAngularSpeed:beta.v,pawlAngularAcceleration:beta.a,wheelAngle:wheel.x,wheelAngularSpeed:wheel.v,wheelAngularAcceleration:wheel.a,wheelDwelling:!drawing,teethAdvanced:-wheel.x/pitch,driving:drawing,lifting:stage==='lift'||stage==='back',upperGroundPivot:P,inputCouplerPivot:Q,pawlCouplerPivot:S,couplerAngle:Math.PI/2+a.x,couplerAngularSpeed:a.v,couplerLengthError:S.distanceTo(Q)-L,fourBarClosureError:S.clone().sub(Q).distanceTo(P),inputShortLinkLengthError:Q.length()-g.shortLinkLength,outputShortLinkLengthError:S.distanceTo(P)-g.shortLinkLength,hookPoint:nose,hookRadius:r.x,hookPolarAngle:angle.x,pawlLiftClearance:r.x-seatRadius,contact,activeGapIndex:contact?.activeGapIndex??null};
 }
 // A remains the long side of the parallelogram, but is a carrier journalled
 // on the wheel axis: with A fixed, C would swing in and out along one arc and
 // re-enter the space it left, so the caption's "traveling backward" and
 // "drops between two teeth" need A to rock. A's two small holes in Brown's
 // plate stay plain holes in the carrier; no guide pins or brace are added.
 const carrier=new T.Group();carrier.userData.role='232-inferred-rocking-carrier-A';model.root.add(carrier);carrier.add(b.framePlate,b.upperPivotPin);b.carrier=carrier;
 const lo=inverse(j(clearRadius),j(seatAngle+slip)).carrier.x,hi=pitch;
 for(const key of['retainingPivotPin','frameMountBolt']){const pin=b[key];pin.removeFromParent();pin.geometry.dispose();delete b[key];}
 const hub=new T.Mesh(boredLatheGeometry([{axial:-.075,radial:.23},{axial:.075,radial:.23}],.112,96),b.framePlate.material);hub.rotation.x=Math.PI/2;hub.position.z=.49;hub.userData.role='232-carrier-through-bored-central-journal';carrier.add(hub);b.carrierHub=hub;
 // Pawl C lies in the wheel's own tooth plane (p64 in-plane rule). Its body is
 // Brown's sector band, concentric with the wheel just outside the tip circle
 // (source pose), hung from its eye on A's upper pin. The band's square end
 // drops one finger into the tooth space; the finger's own rounded end (the
 // working tip radius) is the part that lifts clear and draws on the flank.
 const bandInner=g.wheelOuterRadius+.06,bandOuter=g.wheelOuterRadius+.36,wheelCentre=[0,-L],
  toLocal=v=>[v.x+wheelCentre[0],v.y+wheelCentre[1]],
  fingerOuter=bandOuter,bandEnd=Math.PI/2+.08,
  // The oblong finger: working side on the tooth face, flat end at the root.
  fingerSide=(offset,radiusAlong)=>toLocal(faceDirection.clone().multiplyScalar(radiusAlong).addScaledVector(normal,offset)),
  finger=poly([fingerSide(faceClearance,fingerEndRadius),fingerSide(faceClearance+fingerWidth,fingerEndRadius),fingerSide(faceClearance+fingerWidth,fingerOuter),fingerSide(faceClearance,fingerOuter)]),
  bandStart=faceAngle+(faceClearance+fingerWidth/2)/((bandInner+bandOuter)/2),
  arcPoints=(r,a0,a1,n)=>Array.from({length:n+1},(_,i)=>{const a=a0+(a1-a0)*i/n;return[wheelCentre[0]+r*Math.cos(a),wheelCentre[1]+r*Math.sin(a)];}),
  band=poly([...arcPoints(bandOuter,bandStart,bandEnd,96),...arcPoints(bandInner,bandEnd,bandStart,96)]);
 const bodyRegion=clip.difference(clip.union(band,finger,poly(circle([0,0],.16,96)),poly(circle([g.shortLinkLength,0],.12,96))),
  poly(circle([0,0],.09,96)),poly(circle([g.shortLinkLength,0],.076,96)));
 const oldBody=b.pawlBody.geometry;b.pawlBody.geometry=plate(bodyRegion,-.1,.1);oldBody.dispose();b.pawlBody.userData.role='232-in-plane-C-band-with-oblong-finger';b.pawl.position.z=0;
 b.workingTip=b.pawlBody;
 // A's upper pin and the coupler pin reach back through C's eyes to its rear face.
 b.upperPivotPin.geometry.dispose();b.upperPivotPin.geometry=new T.CylinderGeometry(.088,.088,.74,64);b.upperPivotPin.position.z=.27;
 b.pawlCouplerPin.geometry.dispose();b.pawlCouplerPin.geometry=new T.CylinderGeometry(.07,.07,1.04,48);
 b.pawlIndex.position.set(1.73,-.71,.085);
 Object.assign(g,{cyclePeriod:period,cyclesPerSecond:1/period,workingTipRadius:radius,fingerWidth,fingerEndRadius,fingerFaceClearance:faceClearance,drawBacklashAngle:slip,drawContactOffset:seat.distanceTo(point(faceRadius,faceAngle)),drawFaceRadius:faceRadius,workingTipLocal:noseLocal,sourceHookRadius:seatRadius,sourceHookPolarAngle:seatAngle,liftedHookRadius:clearRadius,liftedHookPolarAngle:seatAngle+pitch,inputSwing:state(.4).inputAngle,carrierRange:[lo,hi]});g.axialLayers.pawlC={center:0,depth:.2};
 d.previousFixedCarrierApproximation={hookGeometryAtPawlAngle:d.hookGeometryAtPawlAngle,contactSurfaceAtPawlAngle:d.contactSurfaceAtPawlAngle,pawlSurfaceSamples:g.pawlSurfaceSamples};delete d.hookGeometryAtPawlAngle;delete d.contactSurfaceAtPawlAngle;delete g.pawlSurfaceSamples;g.workingHookLocal=noseLocal;
 d.stateAtCycleCoordinate=state;d.stateAtTime=t=>state(t/period);d.canonicalTimes={sourcePose:0,liftComplete:.16*period,backComplete:.4*period,dropComplete:.56*period,driveStart:.62*period,driveMidpoint:.77*period,indexComplete:.92*period,cycleClosure:period};
 d.mechanism='rocking-A-carrier-and-equal-link-parallelogram-lift-a-short-pawl-tip-clear-then-drop-and-draw-on-the-radial-tooth-face';d.transmission={...d.transmission,topology:'parallelogram-with-inferred-rocking-A-carrier',inputStroke:'raise-through-lift-and-back-lower-through-drop-and-draw',returnStrokeWheelDwell:true,outputTeethPerCycle:1};
 d.reconstructionNote='A is reconstructed as a rocking carrier on the wheel axis, preserving the parallelogram; a fixed A would return C along the arc it lifted on. Pawl C lies in the wheel plane: its band runs outside the tips and its oblong finger drops into the space behind the tooth, takes up a small backlash, and draws on the radial tooth face. Carrier lift/drop is prescribed and the wheel dwells by friction (Brown draws no click); trial spring-driven MuJoCo did not validate passive selection. Loads, impact and friction remain unqualified.';
 d.carrierReconstruction={inferred:true,passiveValidated:false,nativeTrial:'trial-springs-jammed-not-used-for-playback',minimumClearRadialGap:.04,radialToothContactRadius:faceRadius};
 model.update=t=>{oldUpdate(t);const s=d.stateAtTime(t);carrier.rotation.z=s.carrierAngle;b.pawl.position.set(s.upperGroundPivot.x,s.upperGroundPivot.y,0);b.pawl.rotation.z=s.pawlAngle;b.inputLever.rotation.z=s.inputAngle;for(const part of[b.wheel,b.outputShaft]){part.userData.rotor.rotation.z=s.wheelAngle;part.userData.angularSpeed=s.wheelAngularSpeed;}b.coupler.userData.setEndpoints(new T.Vector3(s.inputCouplerPivot.x,s.inputCouplerPivot.y,.86),new T.Vector3(s.pawlCouplerPivot.x,s.pawlCouplerPivot.y,.86));b.inputCouplerPin.position.set(s.inputCouplerPivot.x,s.inputCouplerPivot.y,.78);b.pawlCouplerPin.position.set(s.pawlCouplerPivot.x,s.pawlCouplerPivot.y,.42);b.contactMarker.visible=!!s.contact;if(s.contact)b.contactMarker.position.set(s.contact.wheelPoint.x,s.contact.wheelPoint.y,.22);b.pawl.userData.angularSpeed=s.pawlAngularSpeed;b.inputLever.userData.angularSpeed=s.inputAngularSpeed;d.contacts={drawingPawlToothFlank:s.contact};d.kinematics=s;};
 model.root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}for(const mat of(Array.isArray(o.material)?o.material:[o.material]))if(mat)mat.fog=false;});
 const bounds=new T.Box3();for(let i=0;i<=64;i++){model.update(period*i/64);model.root.updateMatrixWorld(true);model.root.traverseVisible(o=>{if(o.geometry){o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});}d.cameraFitBounds=bounds;d.cameraDistanceScale=1.05;model.update(0);return model;
}
