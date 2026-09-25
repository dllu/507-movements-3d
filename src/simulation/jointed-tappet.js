import profile from '../data/jointed-tappet-profile.js';
import {sampleJointedTappetMotion} from './jointed-tappet-motion.js';
import * as THREE from 'three';
import{PALETTE,matte,markShadows}from'./primitives.js';
import{backBar,footPillar}from'./back-plate-support.js';
import{makeJointedTappetContactProfile}from'./jointed-tappet-contact.js';
import{add,sub,rotate,poly,circle,capsule,sector,spline,plate,disk,ring,polygonClipping as clip,familyMass}from'./finite-plate-geometry.js';

export function makeJointedTappetCounter({strikeKink=.3,studOverlap=.05}={}){
  const contact=makeJointedTappetContactProfile({rootRadius:.87,faceAngle:.045,nosePixels:[792,712],holdingNosePixels:[185,352],seatHolding:true}),p=contact.parameters,
    source=point=>[(point[0]-p.center[0])/p.scale,(p.center[1]-point[1])/p.scale],
    root=new THREE.Group(),blocks={},parts={},families={};
  for(const name of ['driver','wheel','tappet','dog','holding','fixed']){blocks[name]=new THREE.Group();root.add(blocks[name]);}
  blocks.tappet.position.set(...p.C,0);blocks.holding.position.set(...p.PH,0);
  const attach=(name,geometry,family,color,position=[0,0,0])=>{
    const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.16,roughness:.61}));mesh.name=name;mesh.position.fromArray(position);
    blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
  };
  // Brown's straight tappet pivots almost on a radius of the coaxial driver,
  // and a stud on a concentric orbit can only pass once the struck end has
  // swung to the mirror of its rest angle about that radius. Drawn straight,
  // with D at its drawn mid-rim radius (0.27 overlap), the stud flung B
  // round past vertical. The struck arm beyond C is therefore bent down
  // 0.3 rad (17°) so it rests close to the radius, and D keeps its drawn
  // direction but sits 0.05 inside that arm's resting reach, at the rim's
  // outer edge. The stud then releases the tappet once B has lifted the
  // ratchet about 1.2 teeth, enough for the holding pawl to drop in; 0.4 rad
  // with a 0.03 overlap releases before a full tooth and loses the count.
  const end=rotate(sub(source([1282,589]),p.C),-strikeKink),barRadius=41/p.scale,restQ=.30,
    restEnd=add(p.C,rotate(end,restQ)),studRadius=24/p.scale,studDirection=source([1187,358]),
    studOrbit=Math.hypot(...restEnd)+barRadius+studRadius-studOverlap;
  // Brown's broad spoke runs radially about 4.6° below D, so D stands on the
  // rim just above the spoke's upper edge (measured on the plate).
  const spokeBelowStud=THREE.MathUtils.degToRad(4.6);
  const bore=.106,axleRadius=.103,driverInner=744.8633730551632/p.scale,driverOuter=921.1339022024459/p.scale,
    studVector=studDirection.map(v=>v*studOrbit/Math.hypot(...studDirection)),spokeAngle=Math.atan2(studVector[1],studVector[0])-spokeBelowStud,
    driverRing=clip.difference(poly(circle([0,0],driverOuter,1024)),poly(circle([0,0],driverInner,1024))),
    driverSpokes=Array.from({length:4},(_,i)=>poly([[.12,-.081],[driverInner+.03,-.081],[driverInner+.03,.081],[.12,.081]]
      .map(point=>rotate(point,spokeAngle+i*Math.PI/2)))),
    driverBody=clip.difference(clip.union(driverRing,...driverSpokes,poly(circle([0,0],.19))),poly(circle([0,0],bore)));
  attach('driverBody',plate(driverBody,-.30,-.20),'driver',PALETTE.driver);
  attach('driverRearHub',ring(bore,.19,-.36,-.30),'driver',PALETTE.brass);
  attach('driverStud',disk(studRadius,-.20,.172),'driver',PALETTE.brass,[...studVector,0]);
  attach('wheelBody',plate(clip.difference(poly(contact.wheel.points),poly(circle([0,0],bore))),-.06,.06),'wheel',PALETTE.driven);
  attach('wheelFrontHub',ring(bore,.200,.06,.068),'wheel',PALETTE.driven);
  attach('wheelRearHub',ring(bore,.19,-.15,-.06),'wheel',PALETTE.brass);
  attach('commonAxle',disk(axleRadius,-.46,.075),'fixed',PALETTE.muted);
  attach('commonAxleFrontCap',disk(.13,.075,.089),'fixed',PALETTE.muted);
  const barShape=clip.difference(clip.union(capsule(p.B,[0,0],barRadius),capsule([0,0],end,barRadius)),poly(circle([0,0],.056)),poly(circle(p.B,.032))),
    CstopRadius=.0105,CstopOrbit=.082,CstopAngle=restQ+Math.asin(CstopRadius/CstopOrbit),
    Cstop=add(p.C,rotate([CstopOrbit,0],CstopAngle));
  attach('tappetBody',plate(barShape,.095,.17),'tappet',PALETTE.brass);
  attach('tappetRestSector',plate(sector(.065,.099,-Math.PI,0),.075,.095),'tappet',PALETTE.brass);
  attach('fixedPivotC',disk(.053,.053,.253),'fixed',PALETTE.muted,[...p.C,0]);
  attach('fixedPivotCap',disk(.064,.253,.266),'fixed',PALETTE.muted,[...p.C,0]);
  attach('tappetRestPin',disk(CstopRadius,.053,.094),'fixed',PALETTE.muted,[...Cstop,0]);
  attach('tappetRestMount',plate(capsule(p.C,Cstop,.014),.053,.074),'fixed',PALETTE.muted);
  attach('dogPivotPin',disk(.029,.17,.253),'tappet',PALETTE.muted,[...p.B,0]);
  attach('dogPivotCap',disk(.046,.253,.263),'tappet',PALETTE.muted,[...p.B,0]);
  // B is Brown's lobe traced from the plate: a sharp upper-left corner, a
  // straight top edge to the joint, and a rounded weight below. The finite
  // contact nose lies a little below and left of his corner, so his whole
  // outline is turned and scaled about the joint B until the corner sits on
  // the nose; the nose then reads as the lobe's corner, not a spur.
  const dogNose=p.V,dogLocal=point=>sub(source(point),p.PB),brownCorner=dogLocal([805,680]),
    lobeTurn=Math.atan2(dogNose[1],dogNose[0])-Math.atan2(brownCorner[1],brownCorner[0]),
    lobeScale=Math.hypot(...dogNose)/Math.hypot(...brownCorner),lobe=point=>rotate(dogLocal(point).map(v=>v*lobeScale),lobeTurn),
    dogHead=spline([[944,645],[955,642],[993,629],[1035,665],[1009,708],[966,713]].map(lobe)),
    dogWeight=spline([[966,713],[974,742],[970,771],[953,794],[925,803],[890,799],[854,783],[832,763],[813,734],[807,706],[805,680]].map(lobe)),
    dogOutline=[dogNose,...dogHead,...dogWeight.slice(1,-1)],
    dogShape=clip.difference(clip.union(poly(dogOutline),poly(circle([0,0],.112)),poly(circle(dogNose,p.noseRadius))),poly(circle([0,0],.032))),
    dogStopRadius=.012,dogStopOrbit=.075,dogStopFace=Math.PI/2,
    dogStop=add(p.B,rotate([dogStopOrbit,0],dogStopFace+Math.asin(dogStopRadius/dogStopOrbit)));
  attach('dogBody',plate(dogShape,.19,.25),'dog',PALETTE.brass);
  attach('dogNose',disk(p.noseRadius,-.061,.19),'dog',PALETTE.brass,[...dogNose,0]);
  attach('dogStopSector',plate(sector(.042,.099,dogStopFace-Math.PI,dogStopFace),.174,.19),'dog',PALETTE.brass);
  attach('dogStopPin',disk(dogStopRadius,.17,.189),'tappet',PALETTE.muted,[...dogStop,0]);
  const H0=contact.closeH(p.wheelStart),holdingNose=sub(H0.center,p.PH),Hlocal=point=>sub(source(point),p.PH),
    outer=spline([[224,172],[196,219],[177,269],[166,321]].map(Hlocal).concat([holdingNose])),
    inner=spline([[271,210],[226,243],[200,281],[187,318]].map(Hlocal).concat([holdingNose])),
    holdingShape=clip.difference(clip.union(poly([...outer,...inner.slice(0,-1).reverse()]),poly(circle([0,0],.106)),poly(circle(holdingNose,p.noseRadius))),poly(circle([0,0],.039)));
  attach('holdingBody',plate(holdingShape,.19,.25),'holding',PALETTE.brass);
  attach('holdingNose',disk(p.noseRadius,-.061,.19),'holding',PALETTE.brass,[...holdingNose,0]);
  // Brown draws no frame. Both fixed pivots stand on one fixed bracket plate
  // clamped on the fixed common axle, in the gap between the count wheel and
  // the coaxial driver (the driver's spokes and stud sweep everything behind
  // and around them); the axle itself runs back past the driver into a boss
  // on a plain pillar standing on a foot below the large wheel.
  const bracketBack=-.192,bracketFront=-.157;
  attach('holdingPivotPin',disk(.036,bracketFront,.253),'fixed',PALETTE.muted,[...p.PH,0]);
  attach('holdingPivotCap',disk(.049,.253,.263),'fixed',PALETTE.muted,[...p.PH,0]);
  attach('fixedPivotCShank',disk(.053,bracketFront,.053),'fixed',PALETTE.muted,[...p.C,0]);
  attach('fixedPivotBracket',plate(clip.difference(clip.union(capsule([0,0],p.PH,.075),capsule([0,0],p.C,.075),poly(circle([0,0],.2))),
    poly(circle([0,0],axleRadius))),bracketBack,bracketFront),'fixed',PALETTE.frame);
  const axleSupport=new THREE.Group();axleSupport.name='axleBackSupport';
  axleSupport.add(backBar([{x:0,y:0}],{zFront:-.46,width:.36,role:'axle-pad'}),
    footPillar({x:0,yTop:0,yFloor:-2.75,z:-.51,width:.24,footDepth:.5,role:'axle-pillar'}));
  blocks.fixed.add(axleSupport);
  const masses=Object.fromEntries(['driver','wheel','tappet','dog','holding'].map(family=>[family,familyMass(parts,families,family)]));
  const setState=({q=0,alpha=0,theta=p.wheelStart,driverAngle=0,holdingAngle=contact.closeH(theta).angle-H0.angle}={})=>{
    blocks.driver.rotation.z=driverAngle;blocks.wheel.rotation.z=theta;blocks.tappet.rotation.z=q;
    blocks.dog.position.set(...add(p.C,rotate(p.B,q)),0);blocks.dog.rotation.z=q+alpha;blocks.holding.rotation.z=holdingAngle;
    root.userData.kinematics={q,alpha,theta,driverAngle,holdingAngle};root.updateMatrixWorld(true);
  };
  // Brown's plate window: his two broken lines across the rim above and
  // below D, and the rim's inner side. The large wheel itself is modelled
  // whole; the window only sets the default framing.
  const upperA=source([1065,210]),upperB=source([1253,190]),lowerA=source([1030,1050]),lowerB=source([1183,1120]),
    makePlane=(a,b,sign)=>{const d=sub(b,a),normal=new THREE.Vector3(sign*d[1],-sign*d[0],0).normalize();return new THREE.Plane(normal,-normal.x*a[0]-normal.y*a[1]);},
    baseSectionPlanes=[makePlane(upperA,upperB,1),makePlane(lowerA,lowerB,-1),new THREE.Plane(new THREE.Vector3(1,0,0),0)];
  // Segment D at the plate pose (driver angle 0): the ring and stud inside
  // Brown's window.
  const segmentAtPlatePose=new THREE.Box3(),insideWindow=point=>baseSectionPlanes.every(plane=>plane.distanceToPoint(point)>=0);
  for(let i=0;i<2880;i++){const angle=i*Math.PI*2/2880;for(const radius of [driverInner,driverOuter]){
    const point=new THREE.Vector3(radius*Math.cos(angle),radius*Math.sin(angle),0);if(insideWindow(point))segmentAtPlatePose.expandByPoint(point);}}
  segmentAtPlatePose.expandByPoint(new THREE.Vector3(studVector[0]-studRadius,studVector[1]-studRadius,0))
    .expandByPoint(new THREE.Vector3(studVector[0]+studRadius,studVector[1]+studRadius,0));
  // Every non-driver part (A, the pawls, the tappet and its dog) over one
  // displayed period, measured offline from their vertices at 769 poses (A
  // sweeps its tip circle); the 076 tests recompute it.
  const sweptWorkingParts=new THREE.Box3(new THREE.Vector3(-1.001,-1.001,-.46),new THREE.Vector3(2.328,1.202,.266));
  const sectionFitBounds=sweptWorkingParts.clone().union(segmentAtPlatePose);
  sectionFitBounds.min.z=-.46;sectionFitBounds.max.z=.266;
  root.userData={parts,families,blocks,contact,masses,setState,segmentAtPlatePose,sweptWorkingParts,cameraFitBounds:sectionFitBounds.clone(),
    geometry:{...p,bore,axleRadius,driverInner,driverOuter,studVector,studRadius,studOrbit,studOverlap,strikeKink,strikeArmStart:[0,0],barRadius,end,restQ,CstopRadius,CstopOrbit,Cstop,CstopAngle,
      dogStopRadius,dogStopOrbit,dogStopFace,dogStop,H0Angle:H0.angle,holdingNose},
    hideGround:true,cameraFov:8,fullCameraDirection:new THREE.Vector3(0,0,10),shadowCameraHalfExtent:4,
    shadowBias:-.00005,shadowNormalBias:.005,mechanism:'stud-struck-jointed-tappet-ratchet-counter',fidelity:'authored',reconstructionStatus:'rebuilt',
    profile,playbackPeriod:profile.period,animationTiming:{authoredCyclePeriod:profile.period},minimumDisplayCycleSeconds:profile.period,
    idealConstraints:'A clockwise stud drives the jointed tappet; the 20-tooth count wheel turns counterclockwise and settles one tooth ahead. Gravity, finite normal contact and inelastic impact determine the cached trajectory. Common material density, viscous bearing damping and an opposing output load are reconstruction assumptions. The 24-second physical cycle is displayed in 12 seconds. The complete coaxial driver is modelled; the default view frames Brown\'s window onto rim segment D.'};
  const stateAtTime=time=>sampleJointedTappetMotion(time);
  const update=time=>{const state=stateAtTime(time);setState(state);Object.assign(root.userData.kinematics,state);};
  root.userData.stateAtTime=stateAtTime;
  // Brown draws only rim segment D of the large wheel ("partly represented"),
  // breaking it off above and below. The wheel is modelled complete; the
  // default view frames Brown's window, so the rim runs off its edges.
  update(0);markShadows(root);
  return{root,update,setState,contact,cameraDirection:new THREE.Vector3(0,0,10)};
}
