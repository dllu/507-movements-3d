import profile from '../data/jointed-tappet-profile.js';
import {sampleJointedTappetMotion} from './jointed-tappet-motion.js';
import * as THREE from 'three';
import{PALETTE,matte,markShadows}from'./primitives.js';
import{makeJointedTappetContactProfile}from'./jointed-tappet-contact.js';
import{add,sub,rotate,poly,circle,capsule,sector,spline,plate,disk,ring,polygonClipping as clip,familyMass}from'./finite-plate-geometry.js';

// Tip wedges (flank directions in each pawl's own frame, radians).
// B's lower flank is cut from his corner past the envelope of the tooth tips
// that sweep by it during the lift and fold (Brown pixels; p94 moved these
// points about 8 px into the lobe, clearing the tips by 0.008 now that the
// tappet is set in towards the wheel). B's straight top edge (the upper flank
// of its point) runs from the point to headPixels[0]; p94 lowers it by 7.4°
// (Brown's line ended at [944,645]) so the driven face, which meets it at
// 16.7° when B first touches, never cuts into it.
export const DOG_BEAK={lowerLeft:[[880,784],[866,755],[856,725]],lowerPixel:[836,698],headPixels:[[921.3,666.2],[942.4,663.7],[968,645]]};
// B's reach (p94). With Brown's pivots, B's point swings no nearer the
// axis than 0.030 above its root seat, so it could only push the lower middle
// of the face. The whole tappet (C, B's joint and B, shapes unchanged) is set
// in along the line from C to the axis until the closest point of B's swing
// lies ROOT_REACH_CLEARANCE outside the seat: B's point then slides down the
// face into the root as it lifts (about 11 plate pixels at 1425 px).
export const ROOT_REACH_CLEARANCE=.001;
// The count wheel and its click are turned together 0.06 rad (3.4°)
// clockwise about the axis (the click's pivot moves about 27 plate pixels
// along its circle), so B's point passes over the tip of the tooth behind
// and first meets the face 0.017 above the root; at Brown's phase it strikes
// that tip, and from 0.04 it lands on that tooth's back.
export const CLICK_TURN=-.06;
export const CLICK_WEDGE={upper:2.70,lower:1.50,upperLength:.05,lowerLength:.05};

export function makeJointedTappetCounter({strikeKink=.48,studOverlap=.05,restQ=.48,dogBeak=DOG_BEAK,clickWedge=CLICK_WEDGE,rootReachClearance=ROOT_REACH_CLEARANCE,clickTurn=CLICK_TURN}={}){
  const profileOptions={rootRadius:.87,faceAngle:.045,nosePixels:[792,712],holdingNosePixels:[185,352],seatHolding:true,clickTurn},
    drawn=makeJointedTappetContactProfile(profileOptions).parameters,drawnC=Math.hypot(...drawn.C),
    setIn=drawnC-Math.hypot(drawn.B[0]+drawn.V[0],drawn.B[1]+drawn.V[1])-Math.hypot(...drawn.seat)-rootReachClearance,
    tappetShift=drawn.C.map(v=>-v*setIn/drawnC),
    contact=makeJointedTappetContactProfile({...profileOptions,tappetShift}),p=contact.parameters,
    source=point=>[(point[0]-p.center[0])/p.scale,(p.center[1]-point[1])/p.scale],
    // Points on the tappet and on B move with the tappet's rigid shift.
    tappetSource=point=>add(source(point),tappetShift),
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
  // round past vertical. The struck arm beyond C is therefore bent down by
  // strikeKink so that at rest it lies close to the radius, and D keeps its
  // drawn direction but sits 0.05 inside that arm's resting reach (the rim
  // band is centred on that orbit below). Since p94 the tappet rests at 0.48
  // rad (0.30 before): on the return B's folded point is then drawn past the
  // tip of the tooth it rides and B drops back onto its heel stop clear of
  // the wheel (from 0.30 to 0.44 it stays hung on a tooth back and the next
  // strike loses the count). The kink grows with it (0.30 to 0.48 rad), so
  // the struck arm rests exactly where it did and the strike is unchanged; a
  // smaller kink strikes harder and flings B about its joint. The stud
  // releases the tappet once B has lifted the ratchet about 1.16 teeth, and
  // the ratchet settles back 0.16 tooth onto the click.
  const end=rotate(sub(tappetSource([1282,589]),p.C),-strikeKink),barRadius=41/p.scale,
    restEnd=add(p.C,rotate(end,restQ)),studRadius=24/p.scale,studDirection=source([1187,358]),
    studOrbit=Math.hypot(...restEnd)+barRadius+studRadius-studOverlap;
  // Brown's broad spoke runs radially about 4.6° below D, so D stands on the
  // rim just above the spoke's upper edge (measured on the plate).
  const spokeBelowStud=THREE.MathUtils.degToRad(4.6);
  // Brown draws D inside the rim band. The strike geometry above moves D's
  // orbit 0.27 outside its drawn radius, so the band (Brown's measured width,
  // 744.9 to 921.1 px) is centred on that orbit: D sits mid-band, not on the
  // rim's outer edge.
  const rimWidth=(921.1339022024459-744.8633730551632)/p.scale;
  const bore=.106,axleRadius=.103,driverInner=studOrbit-rimWidth/2,driverOuter=studOrbit+rimWidth/2,
    studVector=studDirection.map(v=>v*studOrbit/Math.hypot(...studDirection)),spokeAngle=Math.atan2(studVector[1],studVector[0])-spokeBelowStud,
    driverRing=clip.difference(poly(circle([0,0],driverOuter,1024)),poly(circle([0,0],driverInner,1024))),
    driverSpokes=Array.from({length:4},(_,i)=>poly([[.12,-.081],[driverInner+.03,-.081],[driverInner+.03,.081],[.12,.081]]
      .map(point=>rotate(point,spokeAngle+i*Math.PI/2)))),
    driverBody=clip.difference(clip.union(driverRing,...driverSpokes,poly(circle([0,0],.19))),poly(circle([0,0],bore)));
  attach('driverBody',plate(driverBody,-.30,-.20),'driver',PALETTE.driver);
  attach('driverRearHub',ring(bore,.19,-.36,-.30),'driver',PALETTE.brass);
  // One stud D stands on each of the four spokes, so the tappet is struck
  // and A counts one tooth every quarter turn of the driver. Brown's window
  // shows only the one stud on his rim segment; the others are the same stud
  // repeated round the complete wheel.
  const studCount=4;
  attach('driverStud',disk(studRadius,-.20,.09),'driver',PALETTE.brass,[...studVector,0]);
  for(let i=1;i<studCount;i++)attach(`driverStud${i}`,disk(studRadius,-.20,.09),'driver',PALETTE.brass,[...rotate(studVector,i*Math.PI/2),0]);
  attach('wheelBody',plate(clip.difference(poly(contact.wheel.points),poly(circle([0,0],bore))),-.06,.06),'wheel',PALETTE.driven);
  attach('wheelFrontHub',ring(bore,.200,.06,.068),'wheel',PALETTE.driven);
  attach('wheelRearHub',ring(bore,.19,-.15,-.06),'wheel',PALETTE.brass);
  attach('commonAxle',disk(axleRadius,-.46,.075),'fixed',PALETTE.muted);
  attach('commonAxleFrontCap',disk(.13,.075,.089),'fixed',PALETTE.muted);
  // Every working part is a plain 2D extrusion in the count wheel's plane.
  // The tappet is one plate outline in three layers: two cheeks and a web
  // whose slot is exactly the space B swings through. B hangs in that slot on
  // the joint pin, and its heel bears on the web at the slot's end, so B is
  // rigid with the bar while it lifts A and folds freely on the return. Brown
  // dots B's upper part behind the tappet end, as the front cheek hides it.
  const Z={wheel:[-.06,.06],dog:[-.04,.04],holding:[-.05,.05],web:[-.045,.045],front:[.045,.075],rear:[-.075,-.045]};
  const barShape=clip.difference(clip.union(capsule(p.B,[0,0],barRadius),capsule([0,0],end,barRadius)),poly(circle([0,0],.056)),poly(circle(p.B,.032)));
  // B is Brown's lobe traced from the plate: a straight top edge to the
  // joint, a heel beyond it and a rounded weight below. His corner is the
  // working tip. It is cut as a wedge to the ratchet's valley: its upper
  // flank lies along the tooth face at first contact and its lower flank
  // clears the back of the tooth below, with a small round point.
  const dogNose=p.V,dogLocal=point=>sub(tappetSource(point),p.PB),brownCorner=dogLocal([805,680]),
    lobeTurn=Math.atan2(dogNose[1],dogNose[0])-Math.atan2(brownCorner[1],brownCorner[0]),
    lobeScale=Math.hypot(...dogNose)/Math.hypot(...brownCorner),lobe=point=>rotate(dogLocal(point).map(v=>v*lobeScale),lobeTurn),
    wedge=(center,radius,upper,lower,upperLength,lowerLength)=>{
      const start=upper+Math.PI/2,stop=lower-Math.PI/2+2*Math.PI,arc=Array.from({length:25},(_,i)=>add(center,rotate([radius,0],start+(stop-start)*i/24)));
      return{arc,upperEnd:add(arc[0],rotate([upperLength,0],upper)),lowerEnd:add(arc.at(-1),rotate([lowerLength,0],lower))};
    },
    headStart=lobe(dogBeak.headPixels[0]),lowerStart=lobe(dogBeak.lowerPixel),
    dogTip=wedge(dogNose,p.noseRadius,Math.atan2(...sub(headStart,dogNose).reverse()),Math.atan2(...sub(lowerStart,dogNose).reverse()),0,0),
    dogHead=spline([...dogBeak.headPixels,[993,629],[1035,665],[1009,708],[966,713]].map(lobe)),
    dogWeight=spline([[966,713],[974,742],[970,771],[953,794],[925,803],[890,799],...dogBeak.lowerLeft,dogBeak.lowerPixel].map(lobe)),
    dogOutline=[...[...dogTip.arc].reverse(),...dogHead,...dogWeight.slice(1)],
    // B's heel: a short sector behind the joint along the bar, between the
    // cheeks. Its counterclockwise face is radial about the joint pin and
    // bears flush on the web's slot end, so the lift loads it as a pure stop
    // torque. It spans heelStart..heelStart+heelSpread above the bar's axis,
    // placed so the fold (about 0.9 rad) swings it to the mirror band below
    // the axis, and it is short (heelRadius), so through B's whole fold it
    // stays inside the tappet's outline and never shows below the bar.
    heelAngle=Math.atan2(-p.B[1],-p.B[0]),heelStart=.325,heelSpread=.25,heelRadius=.165,bossRadius=.112,
    heel=poly([[0,0],...Array.from({length:33},(_,i)=>rotate([heelRadius,0],heelAngle+heelStart+heelSpread*i/32))]),
    dogSolid=clip.union(poly(dogOutline),poly(circle([0,0],bossRadius)),heel),dogShape=clip.difference(dogSolid,poly(circle([0,0],.032)));
  // The slot in the web: B's boss and heel swept through its folding range.
  // Its counterclockwise end is the radial stop face the heel bears on.
  const foldRange=[-.95,0],slotClearance=.004,heelStop=heelAngle+heelStart+heelSpread,
    slotSector=poly([[0,0],...Array.from({length:129},(_,i)=>rotate([heelRadius+slotClearance,0],heelStop+(foldRange[0]-heelSpread-.03)*(1-i/128)))]).map(rings=>rings.map(r=>r.map(q=>add(p.B,q)))),
    slot=clip.union(poly(circle(p.B,.128+slotClearance)),slotSector),
    // The tappet's rest stop: a fixed key on pivot C, inside the web layer
    // and hidden by both cheeks. Its face at restKeyAngle bears flush on the
    // radial end of a cutout in the web when the tappet falls back to restQ.
    restKeyAngle=1.2,restKeySpread=.5,restKeyRadius=.085,restKeyInner=.045,restSweep=[-1.0,restQ],
    restKey=clip.difference(poly([[0,0],...Array.from({length:33},(_,i)=>rotate([restKeyRadius,0],restKeyAngle+restKeySpread*i/32))]),poly(circle([0,0],restKeyInner))),
    restCutout=poly([[0,0],...Array.from({length:129},(_,i)=>rotate([restKeyRadius+slotClearance,0],restKeyAngle-restQ+(restKeySpread+restQ-restSweep[0]+.05)*i/128))]),
    webShape=clip.difference(barShape,slot,restCutout,poly(circle([0,0],.056)));
  attach('tappetBody',plate(barShape,...Z.front),'tappet',PALETTE.brass);
  attach('tappetRearCheek',plate(barShape,...Z.rear),'tappet',PALETTE.brass);
  attach('tappetWeb',plate(webShape,...Z.web),'tappet',PALETTE.brass);
  attach('fixedPivotC',disk(.053,Z.rear[0]-.02,Z.front[1]),'fixed',PALETTE.muted,[...p.C,0]);
  attach('fixedPivotCap',disk(.064,Z.front[1],Z.front[1]+.013),'fixed',PALETTE.muted,[...p.C,0]);
  attach('dogPivotPin',disk(.029,Z.rear[0],Z.front[1]),'tappet',PALETTE.muted,[...p.B,0]);
  attach('dogPivotCap',disk(.046,Z.front[1],Z.front[1]+.01),'tappet',PALETTE.muted,[...p.B,0]);
  attach('dogBody',plate(dogShape,...Z.dog),'dog',PALETTE.brass);
  // The holding click: Brown's hook from its pivot boss, ending in a wedge
  // cut to the valley it drops into, seated in the root at rest.
  const H0=contact.closeH(p.wheelStart),holdingNose=sub(H0.center,p.PH),Hlocal=point=>rotate(sub(source(point),source([271,168])),clickTurn),
    clickTip=wedge(holdingNose,p.noseRadius,clickWedge.upper+clickTurn,clickWedge.lower+clickTurn,clickWedge.upperLength,clickWedge.lowerLength),
    outer=spline([clickTip.upperEnd,...[[177,269],[196,219]].map(Hlocal),rotate([.1,0],3.2+clickTurn)]),
    inner=spline([clickTip.lowerEnd,...[[200,281],[228,244]].map(Hlocal),rotate([.1,0],4.62+clickTurn)]),
    holdingSolid=clip.union(poly([...[...outer].reverse(),...clickTip.arc,...inner]),poly(circle([0,0],.106))),
    holdingShape=clip.difference(holdingSolid,poly(circle([0,0],.039)));
  attach('holdingBody',plate(holdingShape,...Z.holding),'holding',PALETTE.brass);
  // Brown draws no frame, so none is modelled: the fixed pivots C and H are
  // plain stubs, as on the other plates. The tappet returns by its own weight
  // (Brown's text) onto the hidden rest key on pivot C (nothing Brown draws
  // can stop it, and B's point would otherwise run on down the teeth).
  attach('holdingPivotPin',disk(.036,Z.holding[0]-.02,Z.holding[1]),'fixed',PALETTE.muted,[...p.PH,0]);
  attach('holdingPivotCap',disk(.049,Z.holding[1],Z.holding[1]+.013),'fixed',PALETTE.muted,[...p.PH,0]);
  attach('tappetRestKey',plate(restKey,...Z.web),'fixed',PALETTE.muted,[...p.C,0]);
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
  const sweptWorkingParts=new THREE.Box3(new THREE.Vector3(-1.001,-1.001,-.46),new THREE.Vector3(2.3,1.225,.09));
  const sectionFitBounds=sweptWorkingParts.clone().union(segmentAtPlatePose);
  sectionFitBounds.min.z=-.46;sectionFitBounds.max.z=.09;
  root.userData={parts,families,blocks,contact,masses,setState,segmentAtPlatePose,sweptWorkingParts,cameraFitBounds:sectionFitBounds.clone(),
    geometry:{...p,bore,axleRadius,driverInner,driverOuter,studVector,studCount,studRadius,studOrbit,studOverlap,strikeKink,strikeArmStart:[0,0],barRadius,end,restQ,restKeyAngle,restKeySpread,restKeyRadius,restKeyInner,restKeyLever:(restKeyRadius+restKeyInner)/2,Z,foldRange,dogBeak,clickWedge,heelAngle,heelStart,heelSpread,heelRadius,bossRadius,H0Angle:H0.angle,holdingNose},
    outlines:{bar:barShape,web:webShape,dog:dogSolid,holding:holdingSolid},lobe:{turn:lobeTurn,scale:lobeScale},
    hideGround:true,cameraFov:8,fullCameraDirection:new THREE.Vector3(0,0,10),shadowCameraHalfExtent:4,
    shadowBias:-.00005,shadowNormalBias:.005,mechanism:'stud-struck-jointed-tappet-ratchet-counter',fidelity:'authored',reconstructionStatus:'rebuilt',
    profile,playbackPeriod:profile.period,animationTiming:{authoredCyclePeriod:profile.period},minimumDisplayCycleSeconds:profile.period,
    idealConstraints:'Four clockwise studs, one on each spoke of the driver, each strike the jointed tappet in turn; at every strike the 20-tooth count wheel turns counterclockwise and settles one tooth ahead. Gravity, finite normal contact and inelastic impact determine the cached trajectory. Common material density, viscous bearing damping and an opposing output load are reconstruction assumptions, as are B\'s heel stop on the tappet web and the tappet\'s hidden rest key on pivot C. Each strike takes a 6-second physical cycle (a quarter of the driver\'s 24-second turn), displayed in 3 seconds. The complete coaxial driver is modelled; the default view frames Brown\'s window onto rim segment D.'};
  const stateAtTime=time=>sampleJointedTappetMotion(time);
  const update=time=>{const state=stateAtTime(time);setState(state);Object.assign(root.userData.kinematics,state);};
  root.userData.stateAtTime=stateAtTime;
  // Brown draws only rim segment D of the large wheel ("partly represented"),
  // breaking it off above and below. The wheel is modelled complete; the
  // default view frames Brown's window, so the rim runs off its edges.
  update(0);markShadows(root);
  return{root,update,setState,contact,cameraDirection:new THREE.Vector3(0,0,10)};
}
