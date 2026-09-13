import * as THREE from 'three';
import source from './source.js';
import {makeGroovedHeartProfile} from './profile.js';
import {plate,poly,circle,disk,ring,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};

export function makeGroovedHeartGeometry(options={}) {
  const root=new THREE.Group(),parts={},families={},blocks={},profile=makeGroovedHeartProfile(options);
  const attach=(name,geometry,family,color,position=[0,0,0])=>{
    if(!blocks[family]){blocks[family]=new THREE.Group();root.add(blocks[family]);}
    const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.14,roughness:.6}));
    mesh.name=name;mesh.position.fromArray(position);blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
  };
  const shaftRadius=source.shaftRadius/100,hubRadius=source.hubRadius/100,rimThickness=.03;
  const diskRadius=Math.max(source.diskRadius/100,profile.maximum+profile.halfWidth+rimThickness);
  const bore=poly(circle([0,0],shaftRadius+.0015,128)),outline=poly(circle([0,0],diskRadius,256));
  const floorProfile=clip.difference(outline,bore),innerProfile=clip.difference(poly(profile.inner),bore),outerProfile=clip.difference(outline,poly(profile.outer));
  attach('floor',plate(floorProfile,-.30,-.18),'input',0xb95036);
  attach('inner',plate(innerProfile,-.18,.10),'input',PALETTE.driver);
  attach('outer',plate(outerProfile,-.18,.10),'input',PALETTE.driver);
  attach('frontHub',ring(shaftRadius+.0015,hubRadius,.10,.18,128),'input',PALETTE.driver);
  attach('rearHub',ring(shaftRadius+.0015,hubRadius,-.38,-.30,128),'input',PALETTE.driver);
  attach('shaft',disk(shaftRadius,-.8,.19,128),'input',PALETTE.ink);
  const barRadius=(source.barBottom-source.barTop)/200,barZ=.33,barEnd=(source.barEnd-source.eye[0])/100,stemRadius=.030;
  const eyeProfile=clip.difference(clip.union(poly(circle([0,0],barRadius,96)),poly([[0,-barRadius],[.30,-barRadius],[.30,barRadius],[0,barRadius]])),poly(circle([0,0],stemRadius+.001,64)));
  attach('barEye',plate(eyeProfile,barZ-barRadius,barZ+barRadius),'follower',PALETTE.driven);
  attach('bar',disk(barRadius,.30,barEnd,96),'follower',PALETTE.driven,[0,0,barZ]).rotation.y=Math.PI/2;
  attach('pin',disk(profile.pinRadius,-.17,.16,128),'follower',PALETTE.brass);
  attach('pinStem',disk(stemRadius,.16,barZ+barRadius,64),'follower',PALETTE.ink);
  attach('pinHead',disk(source.pinHeadRadius/100,barZ+barRadius,barZ+barRadius+.025,64),'follower',PALETTE.ink);
  const guideCenters=[2.28,2.42],guideHalfLength=.055,backZ=-.60;
  for(const [i,x] of guideCenters.entries()){
    const shape=clip.union(poly(circle([0,0],.21,96)),poly([[0,-.07],[barZ-backZ,-.07],[barZ-backZ,.07],[0,.07]]));
    const hole=poly(circle([0,0],barRadius+.003,96));
    attach('guide'+i,plate(clip.difference(shape,hole),-guideHalfLength,guideHalfLength),'frame',PALETTE.muted,[x,0,barZ]).rotation.y=Math.PI/2;
  }
  const rear=clip.difference(clip.union(poly(circle([0,0],.25,96)),poly([[0,-.07],[2.49,-.07],[2.49,.07],[0,.07]])),poly(circle([0,0],shaftRadius+.003,128)));
  attach('rearFrame',plate(rear,backZ-.08,backZ+.08),'frame',PALETTE.muted);
  blocks.follower.position.x=profile.minimum;
  Object.assign(root.userData,{parts,families,blocks,source,profile,profiles:{floorProfile,innerProfile,outerProfile},hideGround:true,
    geometry:{shaftRadius,hubRadius,diskRadius,rimThickness,barRadius,barZ,barEnd,stemRadius,guideCenters,guideHalfLength,backZ}});
  markShadows(root);root.updateMatrixWorld(true);
  return {root,focus:new THREE.Vector3(.60,0,0),cameraDirection:new THREE.Vector3(1,.6,10)};
}
