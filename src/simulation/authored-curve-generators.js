import * as THREE from 'three';
import {PALETTE,matte,markShadows} from './primitives.js';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
import {eggGeometry as g,eggAtAngle,eggAtTime} from './egg-curve-motion.js';

export function createAuthoredCurveGeneratorMovement(movement) {
  if(movement.id!==172)return null;
  const root=new THREE.Group(),parts={},families={};
  const add=(name,geometry,color,family,parent=root)=>{
    const mesh=new THREE.Mesh(geometry,matte(color));mesh.material.fog=false;
    mesh.userData.role=name;parts[name]=mesh;families[name]=family;parent.add(mesh);return mesh;
  };
  const disk=(radius,low,high)=>plate(poly(circle([0,0],radius,128)),low,high);
  const hole=(p,r)=>poly(circle(p,r,128));
  const rotor=new THREE.Group(),rod=new THREE.Group(),slider=new THREE.Group();
  root.add(rotor,rod,slider);
  add('shaft',disk(.23,-.24,.1),PALETTE.ink,'fixed');
  const crankOutline=clip.union(capsule([0,0],[g.radius,0],.13),hole([0,0],.36),hole([g.radius,0],.30));
  add('crank',plate(clip.difference(crankOutline,hole([0,0],.236),hole([g.radius,0],.126),
    capsule([.39,0],[g.radius-.34,0],.045)),-.12,.04),PALETTE.driver,'crank',rotor);
  const crankPin=add('crankPin',disk(.12,-.14,.34),PALETTE.ink,'crank',rotor);crankPin.position.x=g.radius;
  const rodOutline=clip.union(capsule([0,0],[g.length,0],.11),hole([0,0],.30),hole([g.length,0],.22));
  add('rod',plate(clip.difference(rodOutline,hole([0,0],.126),hole([g.length,0],.146),
    hole([g.length*g.fraction,0],.046)),.13,.27),PALETTE.driven,'rod',rod);
  // Brown's tracing point is a small ring on the rod: a brass eye seated on
  // the rod's front face round a dark pin in the rod's bore (pass 93; it was
  // a hardly visible nub).
  const tracer=add('tracer',disk(.044,.13,.36),PALETTE.ink,'rod',rod);tracer.position.x=g.length*g.fraction;
  const tracerEye=add('tracerEye',plate(clip.difference(hole([0,0],.1),hole([0,0],.046)),.27,.32),PALETTE.brass,'rod',rod);
  tracerEye.position.x=g.length*g.fraction;
  add('wristPin',disk(.14,.07,.57),PALETTE.ink,'slider',slider);
  // Brown draws the wrist as a large eye, the crank bosses' size, whose
  // flat-topped end runs on to the right and is broken off: the end of a
  // horizontal crosshead bar. Pass 90 models it whole as one flat plate, the
  // eye round and concentric with the wrist pin, the bar running straight on
  // along guideY and ending square 0.6 past the pin, just beyond Brown's
  // break. (The reconstructed square slider block is gone and its guide
  // frame is not shown.)
  add('crossheadEye',plate(clip.difference(clip.union(hole([0,0],.30),poly([[0,-.30],[.6,-.30],[.6,.30],[0,.30]])),
    hole([0,0],.146)),.36,.50),PALETTE.accent,'slider',slider);
  // Pass 90: Brown draws no guide, frame or bearing; the reconstructed guide
  // frame, back bar, posts and flanges (always hidden by the source
  // presentation) are no longer built. The crosshead's line is guideY.
  // Brown's dashed egg is the tracer's path in his notation; it is not drawn.
  const update=time=>{const s=eggAtTime(time);rotor.rotation.z=s.angle;rod.position.set(...s.crank,0);
    rod.rotation.z=s.rodAngle;slider.position.set(...s.wrist,0);root.userData.kinematics=s;};
  Object.assign(root.userData,{parts,families,geometry:g,stateAtInputAngle:eggAtAngle,stateAtTime:eggAtTime,
    fidelity:'authored',hideGround:true,supportsRestart:true,materialsIgnoreSceneFog:true,
    mechanism:'uniform-crank-finite-rod-horizontal-slider-intermediate-point-egg-curve',
    archetype:'uniform-slider-crank-intermediate-coupler-point-egg-curve'});
  const envelope=new THREE.Mesh(new THREE.BoxGeometry(8.4,2.9,1),
    new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,transparent:true,opacity:0,fog:false}));
  envelope.position.set(2.65,0,.2);envelope.userData.cameraFitGuide=true;root.add(envelope);
  update(0);markShadows(root);envelope.castShadow=false;envelope.receiveShadow=false;
  return {root,update,reset:()=>update(0),cameraDirection:new THREE.Vector3(0,0,1)};
}
