import * as THREE from 'three';
import source from './source.js';
import {makeScrewProfile} from './profile.js';
import {threadAngles,helicalThread,polygonCylinder,chamferedHex} from './thread-geometry.js';
import {turned} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {makeScrewSection} from './section.js';
export {THREE};

export function makeScrewGeometry(options={}) {
  const root=new THREE.Group(),parts={},families={},blocks={},f=makeScrewProfile(options);
  const attach=(name,geometry,family,color)=>{
    if(!blocks[family]){blocks[family]=new THREE.Group();root.add(blocks[family]);}
    const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.2,roughness:.55}));mesh.name=name;
    blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
  };
  const hexAngles=p=>Array.from({length:6},(_,i)=>(p.phase+i*Math.PI/3)%(2*Math.PI));
  const screwAngles=threadAngles(f.external,f.segments,hexAngles(f.head)),nutAngles=threadAngles(f.internal,f.segments,hexAngles(f.nut));
  attach('core',polygonCylinder(f.coreRadius,f.external.low,0,screwAngles),'screw',PALETTE.frame);
  attach('externalThread',helicalThread(f.external,screwAngles),'screw',PALETTE.frame);
  attach('head',chamferedHex(f.head,screwAngles),'screw',PALETTE.frame);
  const tipProfile=Array.from({length:33},(_,i)=>{const a=Math.PI*i/64;return [f.external.low-(f.external.low-f.tipLow)*Math.cos(a),f.coreRadius*Math.sin(a)];});
  attach('tip',turned([...tipProfile,[f.external.low,0]],256),'screw',PALETTE.frame);
  attach('nutBody',chamferedHex(f.nut,nutAngles),'nut',PALETTE.driver);
  attach('internalThread',helicalThread(f.internal,nutAngles),'nut',PALETTE.driver);
  blocks.nut.position.z=f.nutBase;root.rotation.x=-Math.PI/2;
  Object.assign(root.userData,{parts,families,blocks,source,profile:f,hideGround:true,
    shadowCameraHalfExtent:2.5,shadowBias:-.00002,geometry:{screwAngles,nutAngles}});
  const section=makeScrewSection(root,parts,f);
  Object.assign(root.userData,{section,setSectionView:section.set,localClippingEnabled:true});
  markShadows(root);root.updateMatrixWorld(true);return {root,focus:new THREE.Vector3(0,-1.05,0),cameraDirection:new THREE.Vector3(1,.5,10)};
}
