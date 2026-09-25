import * as THREE from 'three';
import source from './source.js';
import {makeHeartCamProfile} from './profile.js';
import {plate,poly,circle,disk,ring,polygonClipping as clip} from '../finite-plate-geometry.js';
import {makeSpringRackCoil} from '../spring-rack-coil.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {wallGuide} from '../wall-guide-hardware.js';
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
  const barRadius=(source.barBottom-source.barTop)/200,barZ=-.32,barEnd=2.70;
  const eyeProfile=clip.difference(clip.union(poly(circle([0,0],barRadius,96)),poly([[0,-barRadius],[.3,-barRadius],[.3,barRadius],[0,barRadius]])),poly(circle([0,0],pinRadius+.001,64)));
  attach('barEye',plate(eyeProfile,barZ-barRadius,barZ+barRadius),'follower',PALETTE.driven);
  // Brown's bar to his break, then its coaxial run on into the guides.
  const drawnBarEnd=2.22;
  attach('bar',disk(barRadius,.3,drawnBarEnd,96),'follower',PALETTE.driven,[0,0,barZ]).rotation.y=Math.PI/2;
  attach('barExtension',disk(barRadius,drawnBarEnd,barEnd,96),'follower',PALETTE.driven,[0,0,barZ]).rotation.y=Math.PI/2;
  attach('pin',disk(pinRadius,-.445,.135,64),'follower',PALETTE.ink);
  attach('pinHead',disk(source.axleHeadRadius/100,.135,.155,64),'follower',PALETTE.ink);
  attach('pinBack',disk(.048,-.46,-.445,64),'follower',PALETTE.ink);
  const collar=.35,collarDepth=.035,guideCenters=[2.92,3.10],guideHalfLength=.055,backZ=-.63;
  attach('springSeat',ring(barRadius+.0015,.21,collar,collar+collarDepth,96),'follower',PALETTE.driven,[0,0,barZ]).rotation.y=Math.PI/2;
  // The bar runs on past Brown's break into two fixed guides just beyond
  // the plate's right edge. Each is carried from behind by a narrow web on
  // one plain rear frame bar, hidden behind the follower bar in the plate's
  // view, which also carries the cam shaft's rear bearing.
  const frameFront=backZ+.08,frameEnd=guideCenters.at(-1)+guideHalfLength;
  for(const [i,cx] of guideCenters.entries())
    for(const mesh of wallGuide({name:'guide'+i,axis:'x',halfLength:guideHalfLength,boreRadius:barRadius+.003,outerRadius:.21,zWall:frameFront-barZ}))
      attach(mesh.name,mesh.geometry,'frame',PALETTE.muted,[cx+mesh.position.x,mesh.position.y,barZ+mesh.position.z]).rotation.copy(mesh.rotation);
  const rear=clip.difference(clip.union(poly(circle([0,0],.29,128)),poly([[0,-.105],[frameEnd,-.105],[frameEnd,.105],[0,.105]])),poly(circle([0,0],shaftRadius+.003,128)));
  attach('rearFrame',plate(rear,backZ-.08,frameFront),'frame',PALETTE.muted);
  attach('shaftBearing',ring(shaftRadius+.003,.27,frameFront,-.20,128),'frame',PALETTE.muted);
  for(const [name,mesh] of Object.entries(parts))if(/^(barExtension|guide\d|shaftBearing)/.test(name))mesh.userData.beyondPlateCrop=true;
  const coil=makeSpringRackCoil({turns:6,radius:.165,wireRadius:.010,referenceSpan:1.58,segments:256,sides:12});
  const updateSpring=x=>coil.update(x+collar+collarDepth,guideCenters[0]-guideHalfLength,0,barZ);
  updateSpring(profile.minimum);attach('spring',coil.geometry,'spring',PALETTE.ink).rotation.z=-Math.PI/2;
  blocks.follower.position.x=profile.minimum;blocks.roller.position.x=profile.minimum;
  Object.assign(root.userData,{parts,families,blocks,source,profile,profiles:{camProfile},coil,updateSpring,hideGround:true,
    geometry:{shaftRadius,hubRadius,depth,rollerRadius,pinRadius,barRadius,barZ,barEnd,drawnBarEnd,collar,collarDepth,guideCenters,guideHalfLength,backZ}});
  markShadows(root);root.updateMatrixWorld(true);
  return {root,focus:new THREE.Vector3(.7,0,0),cameraDirection:new THREE.Vector3(1,.6,10)};
}
