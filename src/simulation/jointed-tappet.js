import profile from '../data/jointed-tappet-profile.js';
import {sampleJointedTappetMotion} from './jointed-tappet-motion.js';
import * as THREE from 'three';
import{PALETTE,matte,markShadows}from'./primitives.js';
import{makeJointedTappetContactProfile}from'./jointed-tappet-contact.js';
import{makeExtrudedSectionCaps}from'./extruded-section-caps.js';
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
  const dogNose=p.V,dogLocal=point=>sub(source(point),p.PB),
    dogHead=spline([[944,645],[955,642],[993,629],[1035,665],[1009,708],[966,713]].map(dogLocal)),
    dogWeight=spline([[966,713],[974,742],[970,771],[953,794],[925,803],[890,799],[854,783],[832,763],[813,734],p.nosePixels].map(dogLocal)),
    dogOutline=[dogNose,dogLocal([805,680]),...dogHead,...dogWeight.slice(1,-1)],
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
  attach('holdingPivotPin',disk(.036,-.14,.253),'fixed',PALETTE.muted,[...p.PH,0]);
  attach('holdingPivotCap',disk(.049,.253,.263),'fixed',PALETTE.muted,[...p.PH,0]);
  const masses=Object.fromEntries(['driver','wheel','tappet','dog','holding'].map(family=>[family,familyMass(parts,families,family)]));
  const setState=({q=0,alpha=0,theta=p.wheelStart,driverAngle=0,holdingAngle=contact.closeH(theta).angle-H0.angle}={})=>{
    blocks.driver.rotation.z=driverAngle;blocks.wheel.rotation.z=theta;blocks.tappet.rotation.z=q;
    blocks.dog.position.set(...add(p.C,rotate(p.B,q)),0);blocks.dog.rotation.z=q+alpha;blocks.holding.rotation.z=holdingAngle;
    root.userData.kinematics={q,alpha,theta,driverAngle,holdingAngle};
    // The section window is cut in the driver's own frame, so rim segment D,
    // its stud and the arm carrying it turn rigidly with the large wheel.
    planeRotation.makeRotationZ(driverAngle);sectionPlanes.forEach((plane,i)=>plane.copy(baseSectionPlanes[i]).applyMatrix4(planeRotation));
    for(const section of sections)section.update(driverAngle);root.updateMatrixWorld(true);
  };
  const upperA=source([1065,210]),upperB=source([1253,190]),lowerA=source([1030,1050]),lowerB=source([1183,1120]),
    makePlane=(a,b,sign)=>{const d=sub(b,a),normal=new THREE.Vector3(sign*d[1],-sign*d[0],0).normalize();return new THREE.Plane(normal,-normal.x*a[0]-normal.y*a[1]);},
    baseSectionPlanes=[makePlane(upperA,upperB,1),makePlane(lowerA,lowerB,-1),new THREE.Plane(new THREE.Vector3(1,0,0),0)],
    sectionPlanes=baseSectionPlanes.map(plane=>plane.clone()),planeRotation=new THREE.Matrix4(),
    sectionDefinitions=[{name:'driverBody',polygons:driverBody,low:-.30,high:-.20},
      {name:'driverRearHub',polygons:clip.difference(poly(circle([0,0],.19)),poly(circle([0,0],bore))),low:-.36,high:-.30},
      {name:'driverStud',polygons:poly(circle([0,0],studRadius)),low:-.20,high:.172,offset:studVector}],
    sections=sectionDefinitions.map(d=>{const section=makeExtrudedSectionCaps({...d,planes:sectionPlanes,material:parts[d.name].material});
      root.add(section.root);return section;}),
    setConfiguration=id=>{
      if(!['section','complete'].includes(id))throw new Error('Unknown jointed tappet view');root.userData.configuration=id;
      for(const[name,mesh]of Object.entries(parts))if(families[name]==='driver'){
        mesh.material.clippingPlanes=id==='section'?sectionPlanes:[];mesh.material.clipShadows=true;mesh.material.needsUpdate=true;
      }
      for(const section of sections)section.root.visible=id==='section';
      root.userData.cameraFitBounds=id==='section'?new THREE.Box3(new THREE.Vector3(-1.12,-1.43,-.46),new THREE.Vector3(2.45,1.22,.266)):
        new THREE.Box3(new THREE.Vector3(-driverOuter,-driverOuter,-.46),new THREE.Vector3(driverOuter,driverOuter,.266));
    };
  root.userData={parts,families,blocks,contact,masses,setState,setConfiguration,sections,
    geometry:{...p,bore,axleRadius,driverInner,driverOuter,studVector,studRadius,studOrbit,studOverlap,strikeKink,strikeArmStart:[0,0],barRadius,end,restQ,CstopRadius,CstopOrbit,Cstop,CstopAngle,
      dogStopRadius,dogStopOrbit,dogStopFace,dogStop,H0Angle:H0.angle,holdingNose},
    configurations:[{id:'section',label:'Engraving section'},{id:'complete',label:'Complete wheel'}],configurationLabel:'View',configuration:'section',
    localClippingEnabled:true,hideGround:true,cameraFov:8,fullCameraDirection:new THREE.Vector3(0,0,10),shadowCameraHalfExtent:4,
    shadowBias:-.00005,shadowNormalBias:.005,mechanism:'stud-struck-jointed-tappet-ratchet-counter',fidelity:'authored',reconstructionStatus:'rebuilt',
    profile,playbackPeriod:profile.period,animationTiming:{authoredCyclePeriod:profile.period},minimumDisplayCycleSeconds:profile.period,
    idealConstraints:'A clockwise stud drives the jointed tappet; the 20-tooth count wheel turns counterclockwise and settles one tooth ahead. Gravity, finite normal contact and inelastic impact determine the cached trajectory. Common material density, viscous bearing damping and an opposing output load are reconstruction assumptions. The 24-second physical cycle is displayed in 12 seconds. The engraving section clips only the display of the complete coaxial driver, in the driver\'s own frame.'};
  const stateAtTime=time=>sampleJointedTappetMotion(time);
  const update=time=>{const state=stateAtTime(time);setState(state);Object.assign(root.userData.kinematics,state);};
  root.userData.stateAtTime=stateAtTime;
  // Brown draws only rim segment D of the large wheel, so the engraving
  // section is the initial view; the complete wheel remains selectable.
  setConfiguration('section');update(0);markShadows(root);
  return{root,update,setState,contact,cameraDirection:new THREE.Vector3(0,0,10)};
}
