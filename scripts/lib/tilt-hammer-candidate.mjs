import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import{makeTiltHammerGravityStudy}from'./tilt-hammer-gravity-study.mjs';
import{rotate2}from'./tilt-hammer-contact-study.mjs';
import{tiltHammerSource}from'./tilt-hammer-source-profile.mjs';
import{turnedClutchGeometry}from'../../src/simulation/clutch-section-geometry.js';
import{PALETTE,matte,markShadows}from'../../src/simulation/primitives.js';

export function makeTiltHammerCandidate(){
  const motion=makeTiltHammerGravityStudy(),p=motion.parameters,root=new THREE.Group();
  const input=new THREE.Group(),hammer=new THREE.Group(),fixed=new THREE.Group();root.add(input,hammer,fixed);
  hammer.position.set(...p.pivot,0);const parts={},families={};
  const add=(name,geometry,parent,color)=>{
    const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.16,roughness:.62}));mesh.name=name;
    parent.add(mesh);parts[name]=mesh;families[name]=parent===input?'input':parent===hammer?'hammer':'fixed';return mesh;
  };
  const shapes=polygons=>polygons.map(([outer,...holes])=>{
    const shape=new THREE.Shape(outer.map(q=>new THREE.Vector2(...q)));
    shape.holes=holes.map(points=>new THREE.Path(points.map(q=>new THREE.Vector2(...q))));return shape;
  });
  const plate=(polygons,low,high)=>{
    const g=new THREE.ExtrudeGeometry(shapes(polygons),{depth:high-low,bevelEnabled:false,curveSegments:1});g.translate(0,0,low);return g;
  };
  const disk=(radius,low,high,count=1024)=>turnedClutchGeometry([[low,0],[low,radius],[high,radius],[high,0]],{angularSegments:count});
  const ring=(inner,outer,low,high)=>turnedClutchGeometry([[low,inner],[low,outer],[high,outer],[high,inner]],{angularSegments:1024});
  const closed=points=>[...points,points[0]],poly=points=>[[closed(points)]];
  const circle=radius=>Array.from({length:2048},(_,i)=>[radius*Math.cos(i*Math.PI/1024),radius*Math.sin(i*Math.PI/1024)]);
  const total=motion.mass.contours;
  const sleeve=polygonClipping.intersection(total,poly(motion.contact.moving.sleeve));
  const striker=polygonClipping.intersection(total,poly(motion.contact.moving.striker));
  const main=polygonClipping.difference(total,sleeve,striker),bore=poly(circle(motion.mass.pivotBoreRadius));
  add('hammerBody',plate(polygonClipping.difference(main,bore),-.14,.14),hammer,PALETTE.driven);
  add('pivotBoreEnd',disk(motion.mass.pivotBoreRadius,.12,.14,2048),hammer,PALETTE.driven);
  add('hammerSleeve',plate(sleeve,-.14,.14),hammer,PALETTE.muted);
  add('striker',plate(striker,-.14,.14),hammer,PALETTE.muted);
  const cam=[];
  for(let lobe=0;lobe<4;lobe++)for(let i=0;i<=2048;i++){
    const angle=p.pitch*i/2048,radius=motion.contact.radial(angle);
    cam.push(rotate2([radius*Math.cos(angle),radius*Math.sin(angle)],lobe*p.pitch));
  }
  add('camBody',plate(poly(cam),-.1,.1),input,PALETTE.driver);
  add('camHub',disk(59.828986679257746/p.scale,-.13,.14),input,PALETTE.brass);
  add('camShaft',disk(.125,-.5,.18),input,PALETTE.muted);
  const world=q=>[(q[0]-tiltHammerSource.camCenter[0])/p.scale,(tiltHammerSource.camCenter[1]-q[1])/p.scale];
  const sourcePlate=(points,low,high)=>plate(poly(points.map(world)),low,high);
  add('workpiece',plate(poly(motion.contact.workpiece),-.2,.2),fixed,PALETTE.brass);
  // The block top is moved eight source pixels up to support the workpiece.
  add('anvil',sourcePlate([[151,525],[622,525],[622,1050],[151,1050]],-.32,.32),fixed,PALETTE.frame);
  const foundation=[[50,1050],[1178,1050],[1178,810],[1290,810],[1368,690],[1432,690],
    [1432,795],[1569,795],[1569,694],[1625,694],[1695,811],[1815,815],[1815,1156],[50,1156]];
  add('foundation',sourcePlate(foundation,-.5,.3),fixed,PALETTE.frame);
  const socket=[[1432,690],[1455,690],[1455,725]];
  for(let i=0;i<=512;i++){
    const angle=Math.PI-Math.PI*i/512,radius=50+.07;
    socket.push([1505+radius*Math.cos(angle),725+radius*Math.sin(angle)]);
  }
  socket.push([1555,694],[1569,694],[1569,795],[1432,795]);
  add('socketLiner',sourcePlate(socket,-.15,.15),fixed,PALETTE.muted);
  const pivotPin=add('pivotPin',disk(.06485,-.44,.1),fixed,PALETTE.muted);pivotPin.position.set(...p.pivot,0);
  const pivotSupport=[[1448,790],[1448,710],[1470,680],[1540,680],[1563,710],[1563,790]];
  add('pivotRearSupport',sourcePlate(pivotSupport,-.5,-.16),fixed,PALETTE.frame);
  add('camRearBearing',ring(.1252,.205,-.46,-.16),fixed,PALETTE.muted);
  add('camRearPost',sourcePlate([[860,866],[974,866],[974,1050],[860,1050]],-.46,-.2),fixed,PALETTE.frame);
  const update=time=>{
    const state=motion.stateAtTime(time);input.rotation.z=state.angle;hammer.rotation.z=state.q;
    root.userData.kinematics=state;
  };
  root.userData={parts,families,blocks:{input,hammer,fixed},geometry:p,motion,
    mechanism:'four-circular-lobe-gravity-tilt-hammer',fidelity:'authored',reconstructionStatus:'candidate',
    hideGround:true,cameraFov:8,fullCameraDirection:new THREE.Vector3(0,0,10),
    shadowCameraHalfExtent:6,shadowBias:-.00012,shadowNormalBias:.005,
    animationTiming:{authoredCyclePeriod:p.period},minimumDisplayCycleSeconds:3,
    idealConstraints:'A regulated clockwise cam lifts the hammer through its rounded nose. A compressive normal force determines release at the lobe tip, then gravity brings the striker onto a fixed workpiece. The rear pivot pin is fixed; bearing friction and elastic workpiece deformation are omitted. Pickup and landing impacts are inelastic.'};
  update(0);markShadows(root);return{root,update,motion,cameraDirection:new THREE.Vector3(0,0,10)};
}
