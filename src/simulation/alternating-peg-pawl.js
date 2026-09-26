import profile from '../data/alternating-peg-profile.js';
import {sampleAlternatingPegMotion} from './alternating-peg-motion.js';
import * as THREE from 'three';
import {PALETTE,matte,markShadows} from './primitives.js';
import {add,sub,rotate,poly,circle,capsule,plate,disk,ring,polygonClipping as clip,familyMass} from './finite-plate-geometry.js';
import {makeAlternatingPegGeometry} from './alternating-peg-geometry.js';
import {spokedWheelGeometry} from './spoked-wheel.js';

export function makeAlternatingPegPawlDrive(){
 const {pinRadius=.049,headRadius=.1,lowerHeadRadius=headRadius,mouthRadius=.070,upperFace=Math.PI/3,lowerFace=-Math.PI/4,mouthAngle=130*Math.PI/180,lowerMouthAngle=null,seatPhase}=profile.geometry;
 const mouthLower=lowerMouthAngle??-mouthAngle,
  motion=makeAlternatingPegGeometry({seatPhase}),p={...motion.parameters,pinRadius,headRadius,lowerHeadRadius,mouthRadius,upperFace,lowerFace,mouthAngle,lowerMouthAngle:mouthLower},root=new THREE.Group(),parts={},families={},blocks={};
 for(const family of ['wheel','lever','upper','lower','fixed']){blocks[family]=new THREE.Group();root.add(blocks[family]);}
 blocks.lever.position.set(...p.A,0);
 const attach=(name,geometry,family,color,position=[0,0,0])=>{
  const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.16,roughness:.61}));mesh.name=name;mesh.position.fromArray(position);blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
 };
 // One four-spoked plate (spoked-wheel.js): each window is two spoke edges
 // and an arc concentric with the wheel, flared generously into the hub and
 // slightly into the rim, as Brown draws it. (Wheel inertia changes by
 // 0.05% from the earlier sharp-cornered windows the motion was baked with.)
 attach('wheelBody',spokedWheelGeometry({outerRadius:1,rimInnerRadius:p.innerRadius,spokes:4,spokeWidth:.2,hubFillet:.17,rimFillet:.02,
  boreRadius:.14,thickness:.11,arcSegments:1024}),'wheel',PALETTE.driven);
 attach('wheelFrontHub',ring(.14,.197,.055,.085),'wheel',PALETTE.driven);
 attach('wheelRearHub',ring(.14,.197,-.115,-.055),'wheel',PALETTE.driven);
 const pegGeometry=disk(pinRadius,.055,.185),capGeometry=disk(pinRadius+.006,.185,.205),pinCenters=[],
  pegRimGeometry=ring(pinRadius-.006,pinRadius+.006,.205,.207),pegRimMaterial=matte(PALETTE.ink,{metalness:.16,roughness:.61});
 for(let i=0;i<24;i++){
  const center=motion.pinAt(i,0);pinCenters.push(center);
  attach('wheelPin'+i,pegGeometry,'wheel',PALETTE.muted,[...center,0]);
  // Brown draws each peg end-on as a small open circle: a pale face inside an
  // inked rim (a surface marking on the cap, not a separate part).
  const cap=attach('wheelPinCap'+i,capGeometry,'wheel',PALETTE.white,[...center,0]),rim=new THREE.Mesh(pegRimGeometry,pegRimMaterial);
  rim.userData.surfaceMarking=true;cap.add(rim);
 }
 attach('wheelAxle',disk(.137,-.32,.10),'fixed',PALETTE.muted);
 attach('wheelAxleCap',disk(.15,.10,.12),'fixed',PALETTE.muted);
 const local=point=>sub(motion.source(point),p.A),top=local([1180.5,452]),leverOutline=[local([1148,1080])];
 for(let i=0;i<=128;i++)leverOutline.push(add(top,rotate([35/p.scale,0],Math.PI-Math.PI*i/128)));
 leverOutline.push(local([1218,1109]));
 const leverShape=clip.difference(poly(leverOutline),poly(circle([0,0],.044)),...['upper','lower'].map(key=>poly(circle(p.arms[key],.037))));
 attach('leverBody',plate(leverShape,.21,.29),'lever',PALETTE.driver);
 attach('fixedPivotA',disk(.041,-.15,.34),'fixed',PALETTE.muted,[...p.A,0]);
 attach('fixedPivotCap',disk(.061,.34,.35),'fixed',PALETTE.muted,[...p.A,0]);
 const determinant=Math.cos(upperFace)*Math.sin(lowerFace)-Math.sin(upperFace)*Math.cos(lowerFace),
  corner=[pinRadius*(Math.sin(lowerFace)-Math.sin(upperFace))/determinant,pinRadius*(Math.cos(upperFace)-Math.cos(lowerFace))/determinant],
  arc=(a,b)=>Array.from({length:97},(_,i)=>{const t=i/96,r=pinRadius+(mouthRadius-pinRadius)*t*t*(3-2*t);return rotate([r,0],a+(b-a)*t);}),
  upper=arc(upperFace,mouthAngle),lower=arc(lowerFace,mouthLower),lowerTip=rotate([mouthRadius,0],mouthLower),
  cavity=[[-.3,.3],...upper.slice().reverse(),corner,...lower,...(lowerMouthAngle===null?[]:[add(lowerTip,rotate([.4,0],mouthLower))]),[-.3,-.3]],profiles={};
 for(const key of ['upper','lower']){
  const L=p.lengths[key],center=[-L,0],outerHead=lowerHeadRadius===headRadius?circle(center,headRadius):Array.from({length:512},(_,i)=>{
    const angle=2*Math.PI*i/512,radius=headRadius-(headRadius-lowerHeadRadius)*Math.min(0,Math.sin(angle))**2;return add(center,rotate([radius,0],angle));
   }),head=clip.difference(poly(outerHead),poly(cavity.map(v=>add(center,v)))),
   body=clip.union(head,capsule([0,0],[-L+headRadius*.65,0],.019),poly(circle([0,0],.056))),shape=clip.difference(body,poly(cavity.map(v=>add(center,v))),poly(circle([0,0],.037))),
   mesh=attach(key+'Pawl',plate(shape,.12,.185),key,PALETTE.brass);
  const outline=mesh.geometry.parameters.shapes[0].getPoints().map(v=>v.toArray());if(outline[0][0]===outline.at(-1)[0]&&outline[0][1]===outline.at(-1)[1])outline.pop();profiles[key]=outline;
  attach(key+'PivotPin',disk(.034,.10,.29),'lever',PALETTE.muted,[...p.arms[key],0]);
  attach(key+'PivotCap',disk(.045,.185,.21),'lever',PALETTE.muted,[...p.arms[key],0]);
 }
 const setState=({q=0,theta=0,upperAngle=p.initialAngles.upper,lowerAngle=p.initialAngles.lower}={})=>{
  blocks.lever.rotation.z=q;blocks.wheel.rotation.z=theta;
  for(const key of ['upper','lower']){blocks[key].position.set(...motion.anchorAt(key,q),0);blocks[key].rotation.z=key==='upper'?upperAngle:lowerAngle;}
  root.userData.kinematics={q,theta,upperAngle,lowerAngle};root.updateMatrixWorld(true);
 };
 const masses=Object.fromEntries(['wheel','lever','upper','lower'].map(family=>[family,familyMass(parts,families,family)]));
 root.userData={parts,families,blocks,geometry:{...p,pinCenters,corner},profiles,masses,motion,setState,hideGround:true,cameraFov:8,
  fullCameraDirection:new THREE.Vector3(0,0,10),shadowCameraHalfExtent:2.5,shadowBias:-.00003,shadowNormalBias:.005,
  mechanism:'alternating-pawl-peg-ratchet-drive',fidelity:'authored',reconstructionStatus:'rebuilt',profile,playbackPeriod:profile.playbackPeriod,
  animationTiming:{authoredCyclePeriod:profile.playbackPeriod},minimumDisplayCycleSeconds:profile.playbackPeriod,
  idealConstraints:'The prescribed rocking lever drives two freely hinged finite pawls. Gravity, inertia and inelastic pin contact determine the cached wheel and pawl motion. Common density, absolute angular damping and bidirectional dry-friction output resistance are reconstruction assumptions. The eight-second physical cycle is displayed in four seconds. The initial drawing pose settles into a one-pitch repeat; tiny physical rollback is retained. The 24 evenly spaced pins regularize the engraving, with phase fitted to its engaged pair.'};
 const stateAtTime=time=>sampleAlternatingPegMotion(time),update=time=>{const state=stateAtTime(time);setState(state);Object.assign(root.userData.kinematics,state);};
 root.userData.stateAtTime=stateAtTime;update(0);markShadows(root);
 // The face-on pegs would streak long shadows over the wheel the plate does not draw.
 for(let i=0;i<24;i++)for(const name of ['wheelPin'+i,'wheelPinCap'+i])parts[name].traverse(o=>{o.castShadow=false;});
 return{root,setState,update,motion,cameraDirection:new THREE.Vector3(0,0,10)};
}
