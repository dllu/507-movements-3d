import * as T from 'three';
import { ring } from './finite-plate-geometry.js';
const tau=2*Math.PI,rot=(p,a)=>new T.Vector2(p.x*Math.cos(a)-p.y*Math.sin(a),p.x*Math.sin(a)+p.y*Math.cos(a)),perp=p=>new T.Vector2(-p.y,p.x),cross=(a,b)=>a.x*b.y-a.y*b.x;
const unwrap=(a,t)=>{while(a-t>Math.PI)a-=tau;while(a-t< -Math.PI)a+=tau;return a;};
const solve=(f,lo,hi)=>{for(let i=0;i<48;i++){const mid=(lo+hi)/2;if(f(mid)>0)lo=mid;else hi=mid;}return(lo+hi)/2;};

// A's winding finger (see fiveSlotGenevaWindingStop) is a radius-R arc
// between two rounded corners (fillets tangent to the arc and to the left
// and right circular reliefs). B turns only when pushed, so its angle is the
// most advanced of the contact constraints that are geometrically valid:
//  - B's slot-mouth corner riding in A's left relief (concave circle),
//  - A's leading fillet bearing on the slot flank (circle against line),
//  - the mouth corner on that fillet, then on the concentric finger arc
//    (the hold: the arc is concentric with A, so B dwells),
//  - A's rim corner driving B's locking pocket home (the tail),
// after which B is locked concentric on A's rim.
const within=(angle,from,to)=>{const span=T.MathUtils.euclideanModulo(to-from,tau);return T.MathUtils.euclideanModulo(angle-from,tau)<=span+1e-9;};
export function makeGeneva212ContactLaw(g){
 const rawMouth=g.slotPolylines[2][0];
 const mouth=g.stopWheelOutline.reduce((a,b)=>a.distanceTo(rawMouth)<b.distanceTo(rawMouth)?a:b);
 const inner=g.slotPolylines[2][1],edge=inner.clone().sub(mouth),length=edge.length(),axis=edge.clone().divideScalar(length),normal=new T.Vector2(edge.y,-edge.x).normalize(),h=normal.dot(mouth);
 const slotInside=g.slotPolylines[2].reduce((sum,p)=>sum.add(p),new T.Vector2()).divideScalar(4),side=Math.sign(normal.dot(slotInside)-h);
 const tip=g.driverLockingArcRaw.at(-1).clone().multiplyScalar(g.constructionScale),theta0=tip.angle(),r=g.driverLockingRadius,D=g.centerDistance;
 const fillet=g.driverLeadingFilletCenter,rho=g.driverFingerFilletRadius,relief=g.driverLeftReliefCenter,reliefRadius=g.driverReliefRadius,R=g.driverFingerRadius;
 const fingerSpan=[g.driverTrailingFilletCenter.angle(),fillet.angle()];
 const filletSpan=[fillet.angle(),relief.clone().sub(fillet).angle()];
 const reliefSpan=[3.769911,fillet.clone().sub(relief).angle()];
 const base=g.driverCenter.clone().sub(g.stopWheelCenter);
 const expected=a=>-g.stopStepAngle*a/g.normalIndexInputAngle;
 const pick=(roots,a)=>roots.map(x=>unwrap(x,expected(a))).sort((x,y)=>Math.abs(x-expected(a))-Math.abs(y-expected(a)))[0];
 // B's mouth corner on a circle of A (centre k in A's frame, radius rc).
 const mouthOnCircle=(k,rc,span,a)=>{
  const w=base.clone().add(rot(k,a)),K=(mouth.lengthSq()+w.lengthSq()-rc*rc)/(2*mouth.length()*w.length());
  if(Math.abs(K)>1)return null;
  const spread=Math.acos(K),roots=[w.angle()-mouth.angle()-spread,w.angle()-mouth.angle()+spread];
  let best=null;
  for(const root of roots){const angle=unwrap(root,expected(a)),m=rot(mouth,angle).sub(w),local=m.angle()-a;
   if(within(local,span[0],span[1])&&(!best||Math.abs(angle-expected(a))<Math.abs(best-expected(a))))best=angle;}
  return best;
 };
 // A's leading fillet bearing on the flank line (offset by its radius).
 const filletOnFlank=a=>{
  const v=rot(fillet,a),q=base.clone().add(v),offset=h+side*rho;
  if(Math.abs(offset)>q.length())return null;
  const arg=q.angle()-normal.angle(),sep=Math.acos(offset/q.length()),angle=pick([arg-sep,arg+sep],a);
  // The contact lies on the drawn flank and on the fillet's arc.
  const local=rot(q,-angle),t=local.clone().sub(mouth).dot(axis);
  if(t<-1e-9||t>length+1e-9)return null;
  if(!within(rot(normal.clone().multiplyScalar(-side),angle-a).angle(),filletSpan[0],filletSpan[1]))return null;
  return angle;
 };
 const plateauRoots=(()=>{const c=(R*R-D*D-mouth.lengthSq())/(2*D*mouth.length()),split=Math.acos(c);return[Math.PI/2-split-mouth.angle(),Math.PI/2+split-mouth.angle()];})();
 const plateau=plateauRoots.map(x=>unwrap(x,-.95)).sort((x,y)=>Math.abs(x+.95)-Math.abs(y+.95))[0];
 const onArc=a=>{const m=rot(mouth,plateau).sub(base);return within(m.angle()-a,fingerSpan[0],fingerSpan[1])?plateau:null;};
 function tail(a){
  const theta=a+theta0,A=r*Math.cos(theta),B=D-r*Math.sin(theta),den=A*A+B*B,N=2*r*(r-D*Math.sin(theta)),derivative=-2*r*D*Math.cos(theta);
  return{angle:2*Math.atan2(A,B)-g.stopStepAngle,speed:N/den,acceleration:derivative/den-N*derivative/den**2};
 }
 const tailEnd=Math.PI/2-theta0;
 const constraints=[
  ['relief-mouth-drive',a=>mouthOnCircle(relief,reliefRadius,reliefSpan,a)],
  ['fillet-flank-drive',filletOnFlank],
  ['fillet-mouth-drive',a=>mouthOnCircle(fillet,rho,filletSpan,a)],
  ['rounded-finger-mouth-hold',onArc],
  ['rim-corner-pocket-drive',a=>a>.6?tail(a).angle:null],
 ];
 const angleAt=a=>{let angle=0,stage='pocket-release';for(const[name,f]of constraints){const value=f(a);if(value!==null&&value<angle){angle=value;stage=name;}}return{angle,stage};};
 // Rates: the tail is closed-form; elsewhere, central differences on the
 // exact closed-form angle of the active constraint.
 const rates=(a,stage)=>{
  if(stage==='rim-corner-pocket-drive'){const t=tail(a);return{speed:t.speed,acceleration:t.acceleration};}
  if(stage==='rounded-finger-mouth-hold'||stage==='pocket-release')return{speed:0,acceleration:0};
  const f=constraints.find(([name])=>name===stage)[1],value=x=>f(x)??angleAt(x).angle,h1=1e-6,h2=1e-4;
  return{speed:(value(a+h1)-value(a-h1))/(2*h1),acceleration:(value(a+h2)-2*value(a)+value(a-h2))/(h2*h2)};
 };
 // Regime boundaries, located on a fine scan and refined by bisection.
 const boundaries=[];let previous=angleAt(0).stage;
 for(let i=1;i<=4000;i++){const a=tailEnd*i/4000,stage=angleAt(a).stage;if(stage!==previous){let lo=tailEnd*(i-1)/4000,hi=a;for(let k=0;k<60;k++){const mid=(lo+hi)/2;if(angleAt(mid).stage===previous)lo=mid;else hi=mid;}boundaries.push({from:previous,to:stage,at:hi});previous=stage;}}
 const boundary=(to)=>boundaries.find(b=>b.to===to)?.at;
 const entryEnd=boundaries.find(b=>b.from==='fillet-flank-drive')?.at??boundary('rounded-finger-mouth-hold');
 const tailStart=boundary('rim-corner-pocket-drive');
 function local(a){
  if(a>=tailEnd)return{angle:-g.stopStepAngle,speed:0,acceleration:0,stage:'concentric-pocket-lock'};
  const q=angleAt(a);return{angle:q.angle,...rates(a,q.stage),stage:q.stage};
 }
 // The world contact point of the active constraint (for inspection).
 function contactAt(a,angle,stage){
    if(stage==='fillet-flank-drive'){const c=rot(fillet,a).add(g.driverCenter),n=rot(normal,angle);return c.addScaledVector(n,-side*rho);}
  if(stage==='rim-corner-pocket-drive')return rot(tip,a).add(g.driverCenter);
  return rot(mouth,angle).add(g.stopWheelCenter);
 }
 function law(input){const clamped=T.MathUtils.clamp(input,0,g.forwardInputLimit),turn=Math.min(3,Math.floor((clamped+1e-12)/tau)),phase=clamped-turn*tau,q=local(Math.max(0,phase));return{...q,angle:q.angle-turn*g.stopStepAngle,turn,phase};}
 return{law,local,contactAt,boundaries,entryEnd,tailStart,tailEnd,plateau,mouth,tip,normal,side,fillet,rho,relief,reliefRadius};
}

// Solve the opposite working faces by reflecting the *actual* profiles into
// the forward solver's frame. Reflecting the old angle law alone would lose
// the source's small asymmetries and would still put B on a withdrawing face.
export function makeGeneva212ReverseContactLaw(g,forward=makeGeneva212ContactLaw(g)){
 const fingerAxis=(g.driverLeadingFilletCenter.angle()+g.driverTrailingFilletCenter.angle())/2;
 const slotAxis=(Math.PI+g.stopStepAngle)/2;
 const reflect=(p,axis)=>rot(new T.Vector2(p.x,-p.y),2*axis);
 const mirrorInput=Math.PI-2*fingerAxis;
 const reflected=makeGeneva212ContactLaw({...g,
  driverLeadingFilletCenter:reflect(g.driverTrailingFilletCenter,fingerAxis),
  driverTrailingFilletCenter:reflect(g.driverLeadingFilletCenter,fingerAxis),
  driverLeftReliefCenter:reflect(g.driverRightReliefCenterRaw.clone().multiplyScalar(g.constructionScale),fingerAxis),
  driverLockingArcRaw:[...g.driverLockingArcRaw].reverse().map(p=>reflect(p,fingerAxis)),
  slotPolylines:g.slotPolylines.map(points=>[...points].reverse().map(p=>reflect(p,slotAxis))),
  stopWheelOutline:g.stopWheelOutline.map(p=>reflect(p,slotAxis)),
 });
 const outputOffset=-g.stopStepAngle;
 const inputMinimum=mirrorInput-reflected.tailEnd;
 const engagementStart=mirrorInput-reflected.boundaries[0].at;
 const terminalAngle=forward.law(g.forwardInputLimit).angle;
 function local(a){
  if(a>=engagementStart)return{angle:outputOffset,speed:0,acceleration:0,stage:'concentric-pocket-lock'};
  const q=reflected.local(mirrorInput-a);
  return {...q,angle:outputOffset-q.angle,acceleration:-q.acceleration,
   stage:q.stage==='pocket-release'?'concentric-pocket-lock':`reverse-${q.stage}`};
 }
 function law(input){
  const clamped=T.MathUtils.clamp(input,inputMinimum,g.forwardInputLimit);
  const turn=Math.min(3,Math.floor((clamped-inputMinimum+1e-12)/tau)),phase=clamped-turn*tau,q=local(phase);
  const angle=q.angle-turn*g.stopStepAngle;
  // At the convex stop, B keeps its attained position while the tooth takes
  // up clearance on the opposite flank. Never snap to the reverse envelope.
  if(angle<terminalAngle)return{angle:terminalAngle,speed:0,acceleration:0,stage:'reverse-terminal-takeup',turn,phase};
  return{...q,angle,turn,phase};
 }
 function contactAt(a,angle,stage){
  const p=reflected.contactAt(mirrorInput-a,outputOffset-angle,stage.replace(/^reverse-/,''));
  return new T.Vector2(2*g.driverCenter.x-p.x,p.y);
 }
 return{law,local,contactAt,inputMinimum,engagementStart,
  boundaries:reflected.boundaries.map(q=>({from:`reverse-${q.from}`,to:`reverse-${q.to}`,at:mirrorInput-q.at})),
  tailEnd:inputMinimum};
}

export function finishGeneva212Contact(model){
 const d=model.root.userData,b=d.blocks,g=d.geometry,branch=makeGeneva212ContactLaw(g),reverse=makeGeneva212ReverseContactLaw(g,branch),source={stateAtInputAngle:d.stateAtInputAngle,stateAtTime:d.stateAtTime,inputStateAtTime:d.inputStateAtTime,timeline:d.timeline,stopWheelAngleAtInputAngle:d.stopWheelAngleAtInputAngle,canonicalStates:d.canonicalStates,canonicalTimes:d.canonicalTimes},oldUpdate=model.update;
 d.sourceKinematics=source;
 // Terminal: A's rounded leading corner bears on the shoulder beside the
 // convex a-b sector; the contact point is taken from the actual final pose.
 {const final=branch.law(g.forwardInputLimit),local=branch.local(final.phase),point=branch.contactAt(final.phase,local.angle,local.stage);
  g.terminalContactPoint=point;g.terminalStopNormal=rot(branch.normal,local.angle).multiplyScalar(-branch.side);
  g.terminalContactStage=local.stage;
  if(b.terminalContactMarker)b.terminalContactMarker.position.set(point.x,point.y,b.terminalContactMarker.position.z);
  const radius=point.clone().sub(g.driverCenter);g.blockedForwardClosingRate=Math.abs(new T.Vector2(-radius.y,radius.x).dot(g.terminalStopNormal));}
 d.contactBranch212={boundaries:branch.boundaries,entryEnd:branch.entryEnd,tailStart:branch.tailStart,tailEnd:branch.tailEnd,plateau:branch.plateau,reverse:{boundaries:reverse.boundaries,engagementStart:reverse.engagementStart,inputMinimum:reverse.inputMinimum,selectedOutputTorqueSign:1},profileTolerance:3e-6,forceSolved:false,selectedOutputTorqueSign:-1};
 d.stopWheelAngleAtInputAngle=(input,v=0)=>(v<0?reverse:branch).law(input).angle;
 d.stateAtInputAngle=(input,v=0,a=0,clockwise=v<0)=>{
  const s=source.stateAtInputAngle(input,v,a),driverAngle=T.MathUtils.clamp(input,reverse.inputMinimum,g.forwardInputLimit);
  s.driverAngle=driverAngle;
  const q=!clockwise&&driverAngle<0?{angle:0,speed:0,acceleration:0,stage:'concentric-pocket-lock',turn:-1,phase:driverAngle}:(clockwise?reverse:branch).law(driverAngle),locked=/concentric-pocket-lock$/.test(q.stage),active=!locked&&q.stage!=='reverse-terminal-takeup',pocketIndex=locked?(q.stage==='reverse-concentric-pocket-lock'?q.turn:q.turn+1):null,lockActive=locked&&pocketIndex<g.lockPocketCenters.length,pocketCenter=lockActive?rot(g.lockPocketCenters[pocketIndex],q.angle).add(g.stopWheelCenter):null;
  return{...s,stage:s.atTerminalStop?s.stage:q.stage,contactMode:s.atTerminalStop?s.stage:q.stage,stopWheelAngle:q.angle,stopWheelAngularSpeed:q.speed*s.driverAngularSpeed,stopWheelAngularAcceleration:q.speed*s.driverAngularAcceleration+q.acceleration*s.driverAngularSpeed**2,outputSteps:-q.angle/g.stopStepAngle,limit:{...s.limit,remainingInputAngle:g.forwardInputLimit-driverAngle,contactPoint:g.terminalContactPoint.clone(),stopNormal:g.terminalStopNormal.clone(),blockedForwardClosingRate:g.blockedForwardClosingRate,convexArcEndpoints:[g.convexStopArc[0],g.convexStopArc.at(-1)].map(p=>rot(p,q.angle).add(g.stopWheelCenter))},
   engagement:{...s.engagement,active:active&&!s.atTerminalStop,activeSlotIndex:active?q.turn+1:null,instantaneousRatio:q.speed,ratioDerivative:q.acceleration,officialPhaseError:Math.abs(q.angle-s.stopWheelAngle),workingContactStage:q.stage},
   lock:{...s.lock,active:lockActive,pocketIndex,pocketCenter,concentricityError:pocketCenter? pocketCenter.distanceTo(g.driverCenter):null,radialClearance:0}};
 };
 // The opposite flank captures the first pocket 3.84 degrees before the old
 // source start. Include that small overrun on both sides of the loop so the
 // last reverse index closes without a jump or an artificial output reset.
 d.timeline={...source.timeline,forwardSegments:source.timeline.forwardSegments.map((s,i)=>i===0?{...s,startAngle:reverse.inputMinimum}:s),inputMinimum:reverse.inputMinimum};
 d.inputStateAtTime=time=>{
  const s=source.inputStateAtTime(time),first=d.timeline.forwardSegments[0];
  if(s.direction==='held-at-source-start')return{...s,angle:reverse.inputMinimum};
  if(s.segment===source.timeline.forwardSegments[0]){
   const f=s.linearFraction,travel=first.endAngle-first.startAngle,sign=s.direction==='unwinding-away-from-stop'?-1:1;
   return{...s,segment:first,angle:first.startAngle+travel*f**3*(10+f*(-15+6*f)),angularSpeed:sign*travel*30*f**2*(f-1)**2/first.duration,angularAcceleration:travel*60*f*(2*f**2-3*f+1)/first.duration**2};
  }
  return s;
 };
 d.stateAtTime=time=>{const s=d.inputStateAtTime(time);return{...d.stateAtInputAngle(s.angle,s.angularSpeed,s.angularAcceleration,s.direction==='unwinding-away-from-stop'),demonstrationDirection:s.direction,phaseTime:s.phaseTime,timelineSegment:s.name,time};};
 d.canonicalTimes={...d.canonicalTimes};
 for(const [i,key]of ['firstIndexComplete','secondIndexComplete','thirdIndexComplete'].entries()){
  const target=i*tau+branch.tailEnd;let lo=0,hi=d.timeline.forwardMotionDuration;
  for(let k=0;k<48;k++){const mid=(lo+hi)/2;if(source.stateAtTime(mid).driverAngle<target)lo=mid;else hi=mid;}d.canonicalTimes[key]=hi;
 }
 d.transmission.workingIndexInputAngle=branch.tailEnd;
 d.canonicalStates=Object.fromEntries(Object.entries(d.canonicalTimes).map(([key,t])=>[key,d.stateAtTime(t)]));
 // These outlines were drawing annotations; they expanded into the working
 // contact plane. The unchanged solid profiles provide their own visible edge.
 for(const key of ['driverEdge','stopWheelEdge','driverFingerHighlight'])if(b[key])b[key].visible=false;
 for(const[hub,bore]of[[b.driverHub,.089],[b.stopWheelHub,.086]]){const box=new T.Box3().setFromBufferAttribute(hub.geometry.attributes.position),outer=Math.max(Math.abs(box.min.x),Math.abs(box.max.x));hub.geometry.dispose();hub.geometry=ring(bore,outer,-.10,.10,96);}
 // Keep the indexes on actual material: the former upper index crossed the
 // empty mouth of a slot, and both bars floated above their supporting faces.
 for(const[index,hub]of[[b.driverIndex,b.driverHub],[b.stopWheelIndex,b.stopWheelHub]]){
  const angle=index.rotation.z;index.geometry.dispose();index.geometry=new T.BoxGeometry(.35,.052,.026);
  index.position.set(.32*Math.cos(angle),.32*Math.sin(angle),hub.position.z+.113);
 }
 d.reconstructionNote='A\u2019s finger stands out to radius 4.7 (source 4.5) with rounded corners. Each direction follows its own pushing contact faces; clockwise motion waits for the right flank to engage. Forward lock captures at 54.78° rather than the source animation’s linear 51° schedule; the reverse return extends 3.84° past the source start to capture the first pocket continuously. Handoff impacts and input motion are prescribed. Friction, inertia and loaded force balance are not simulated.';
 d.sourceAnimation.runtimeReconstructsFiniteContact=true;
 // Brown draws B two indexes into its run: the convex stop face a-b stands
 // beside the top slot and A's finger is at the mouth of the third slot.
 // Display time starts there; states keep the demonstration clock
 // (display time t shows demonstration time t + displayTimeOffset).
 const offset=d.timeline.forwardSegments.find(s=>s.name==='slot-3-index').startTime;d.displayTimeOffset=offset;
 const inner=time=>{oldUpdate(time);const s=d.stateAtTime(time);for(const [parts,angle,speed]of[[[b.driver,b.driverShaft],s.driverAngle,s.driverAngularSpeed],[[b.stopWheel,b.stopWheelShaft],s.stopWheelAngle,s.stopWheelAngularSpeed]])for(const part of parts){part.userData.rotor.rotation.z=angle;part.userData.angularSpeed=speed;}d.kinematics=s;d.contacts={windingFingerSlot:s.engagement.active?s.engagement:null,lockingPocket:s.lock.active?s.lock:null,convexTerminalStop:s.atTerminalStop?s.limit:null};};
 model.update=time=>inner(time+offset);
 model.update(0);return model;
}
