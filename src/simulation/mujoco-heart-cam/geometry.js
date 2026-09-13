import * as THREE from 'three';
import source from './source.js';
import {makeHeartCamProfile} from './profile.js';
import {plate,poly,circle,disk,ring,polygonClipping as clip} from '../finite-plate-geometry.js';
import {makeSpringRackCoil} from '../spring-rack-coil.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};
export function makeHeartCamGeometry(options={}) {
  const root=new THREE.Group(),parts={},families={},blocks={},profile=makeHeartCamProfile(options);
  const attach=(name,geometry,family,color,position=[0,0,0])=>{
    if(!blocks[family]){blocks[family]=new THREE.Group();root.add(blocks[family]);}
    const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.14,roughness:.6}));mesh.name=name;mesh.position.fromArray(position);blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
  };
  const shaftRadius=source.shaftRadius/100,hubRadius=source.hubRadius/100,depth=.20,rollerRadius=profile.rollerRadius,pinRadius=.032;
  const camProfile=clip.difference(poly(profile.points),poly(circle([0,0],shaftRadius+.0015,128)));
  attach('cam',plate(camProfile,-depth/2,depth/2),'input',PALETTE.driver);
  attach('frontHub',ring(shaftRadius+.0015,hubRadius,.1,.145,128),'input',PALETTE.driver);
  attach('rearHub',ring(shaftRadius+.0015,hubRadius,-.17,-.1,128),'input',PALETTE.driver);
  attach('shaft',disk(shaftRadius,-.8,.19,128),'input',PALETTE.ink);
  attach('roller',ring(pinRadius+.001,rollerRadius,-.13,.12,128),'roller',PALETTE.brass);
  const barRadius=(source.barBottom-source.barTop)/200,barZ=-.32,barEnd=2.22;
  const eyeProfile=clip.difference(clip.union(poly(circle([0,0],barRadius,96)),poly([[0,-barRadius],[.3,-barRadius],[.3,barRadius],[0,barRadius]])),poly(circle([0,0],pinRadius+.001,64)));
  attach('barEye',plate(eyeProfile,barZ-barRadius,barZ+barRadius),'follower',PALETTE.driven);
  attach('bar',disk(barRadius,.3,barEnd,96),'follower',PALETTE.driven,[0,0,barZ]).rotation.y=Math.PI/2;
  attach('pin',disk(pinRadius,-.445,.135,64),'follower',PALETTE.ink);
  attach('pinHead',disk(source.axleHeadRadius/100,.135,.155,64),'follower',PALETTE.ink);
  attach('pinBack',disk(.048,-.46,-.445,64),'follower',PALETTE.ink);
  const collar=.35,collarDepth=.035,guideCenters=[2.5,2.65],guideHalfLength=.055,backZ=-.63;
  attach('springSeat',ring(barRadius+.0015,.21,collar,collar+collarDepth,96),'follower',PALETTE.driven,[0,0,barZ]).rotation.y=Math.PI/2;
  for(const [i,cx] of guideCenters.entries()) {
    const outline=clip.union(poly(circle([0,0],.21,96)),poly([[0,-.07],[barZ-backZ,-.07],[barZ-backZ,.07],[0,.07]]));
    const guide=clip.difference(outline,poly(circle([0,0],barRadius+.003,96)));
    attach('guide'+i,plate(guide,-guideHalfLength,guideHalfLength),'frame',PALETTE.muted,[cx,0,barZ]).rotation.y=Math.PI/2;
  }
  const rear=clip.difference(clip.union(poly(circle([0,0],.29,128)),poly([[0,-.075],[2.72,-.075],[2.72,.075],[0,.075]])),poly(circle([0,0],shaftRadius+.003,128)));
  attach('rearFrame',plate(rear,backZ-.08,backZ+.08),'frame',PALETTE.muted);
  const coil=makeSpringRackCoil({turns:6,radius:.165,wireRadius:.010,referenceSpan:1.58,segments:256,sides:12});
  const updateSpring=x=>coil.update(x+collar+collarDepth,guideCenters[0]-guideHalfLength,0,barZ);
  updateSpring(profile.minimum);attach('spring',coil.geometry,'spring',PALETTE.ink).rotation.z=-Math.PI/2;
  blocks.follower.position.x=profile.minimum;blocks.roller.position.x=profile.minimum;
  Object.assign(root.userData,{parts,families,blocks,source,profile,profiles:{camProfile},coil,updateSpring,hideGround:true,
    geometry:{shaftRadius,hubRadius,depth,rollerRadius,pinRadius,barRadius,barZ,barEnd,collar,collarDepth,guideCenters,guideHalfLength,backZ}});
  markShadows(root);root.updateMatrixWorld(true);
  return {root,focus:new THREE.Vector3(.7,0,0),cameraDirection:new THREE.Vector3(1,.6,10)};
}
