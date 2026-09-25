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
  const tracer=add('tracer',disk(.04,.21,.4),PALETTE.brass,'rod',rod);tracer.position.x=g.length*g.fraction;
  add('wristPin',disk(.14,.07,.57),PALETTE.ink,'slider',slider);
  // Brown breaks the fixed end off with a jagged mark. Model a whole
  // crosshead block riding in a closed fixed guide frame along guideY.
  add('slider',plate(clip.difference(poly([[-.34,-.28],[.34,-.28],[.34,.28],[-.34,.28]]),hole([0,0],.146)),.36,.50),PALETTE.frame,'slider',slider);
  const [gx0,gx1]=[3.55,6.75],gy=g.guideY;
  add('guideFrame',plate(clip.difference(poly([[gx0,gy-.37],[gx1,gy-.37],[gx1,gy+.37],[gx0,gy+.37]]),
    poly([[gx0+.1,gy-.29],[gx1-.1,gy-.29],[gx1-.1,gy+.29],[gx0+.1,gy+.29]])),.36,.50),PALETTE.frame,'fixed');
  // Brown draws neither the crank shaft's bearing nor what holds the guide
  // frame. A slim fixed back bar behind the moving parts carries the shaft
  // end, runs behind the rod's mean line (mostly hidden by it) and joins an
  // open ring under the guide frame, which stands on two posts at its closed right end.
  const frameRing=clip.difference(poly([[gx0,gy-.37],[gx1,gy-.37],[gx1,gy+.37],[gx0,gy+.37]]),
    poly([[gx0+.1,gy-.29],[gx1-.1,gy-.29],[gx1-.1,gy+.29],[gx0+.1,gy+.29]]));
  add('backBar',plate(clip.union(hole([0,0],.32),capsule([0,0],[gx0+.05,gy],.08),frameRing),-.40,-.24),PALETTE.frame,'fixed');
  // Posts only at the closed right end: the rod sweeps past the left end.
  for(const [x,y] of [[gx1-.05,gy-.33],[gx1-.05,gy+.33]]){
    const post=add('guideFramePost',plate(poly([[x-.05,y-.04],[x+.05,y-.04],[x+.05,y+.04],[x-.05,y+.04]]),-.24,.36),PALETTE.frame,'fixed');
    delete parts.guideFramePost;parts[`guideFramePost${Object.keys(parts).filter(n=>n.startsWith('guideFramePost')).length}`]=post;
  }
  // The back bar is bolted to the framing behind the mechanism by two
  // flanges: one behind the crank-shaft boss (the shaft's bearing) and one
  // behind the guide frame's closed end.
  add('shaftBearingFlange',plate(clip.difference(poly([[-.42,-.42],[.42,-.42],[.42,.42],[-.42,.42]]),hole([0,0],.1)),-.48,-.40),PALETTE.frame,'fixed');
  add('guideFrameFlange',plate(poly([[gx1-.9,gy-.45],[gx1+.08,gy-.45],[gx1+.08,gy+.45],[gx1-.9,gy+.45]]),-.48,-.40),PALETTE.frame,'fixed');
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
