import * as THREE from 'three';
import source from './source.js';
import {makeEndlessGrooveProfile} from './profile.js';
import {plate,poly,circle,capsule,disk,ring,rotate,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};

export function makeEndlessGrooveGeometry(options={}) {
  const {diskOpacity=.72}=options;
  const root=new THREE.Group(),parts={},families={},blocks={},profile=makeEndlessGrooveProfile(options),f=profile;
  const attach=(name,geometry,family,color,position=[0,0,0])=>{
    if(!blocks[family]){blocks[family]=new THREE.Group();root.add(blocks[family]);}
    const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.14,roughness:.6}));
    mesh.name=name;mesh.position.fromArray(position);blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
  };
  const shaftRadius=source.shaftRadius/100,pivotShaftRadius=source.pivotShaftRadius/100;
  // Brown views the disk from its own side and dashes the grooved arm behind
  // it; source presentation mirrors and reverses the view, so the translucent
  // disk stands in for those hidden lines. Physics is unaffected.
  const diskMesh=attach('disk',ring(shaftRadius,source.diskRadius/100,-.50,-.30,256),'input',PALETTE.driver);
  if(diskOpacity<1)Object.assign(diskMesh.material,{transparent:true,opacity:diskOpacity,depthWrite:false});diskMesh.renderOrder=1;
  attach('rearHub',ring(shaftRadius,source.hubRadius/100,-.62,-.50,128),'input',PALETTE.driver);
  attach('frontHub',ring(shaftRadius,source.hubRadius/100,-.30,-.26,128),'input',PALETTE.driver);
  attach('shaft',disk(shaftRadius,-.98,-.23,128),'input',PALETTE.ink);
  attach('pin',disk(f.pinRadius,-.30,.11,128),'input',PALETTE.brass,[f.crankRadius,0,0]);
  attach('pinHead',disk(source.pinHeadRadius/100,.11,.13,64),'input',PALETTE.ink,[f.crankRadius,0,0]);
  const bodyCenter=f.local(source.body.center),bodyAngle=-source.body.angle-f.sourceAngle;
  const ends=[-1,1].map(sign=>{const v=rotate([sign*source.body.halfLength/100,0],bodyAngle);return bodyCenter.map((p,i)=>p+v[i]);});
  const bore=poly(circle([0,0],pivotShaftRadius+.002,128));
  const outline=clip.difference(clip.union(capsule(...ends,source.body.radius/100,256),poly(source.neck.map(f.local)),poly(circle([0,0],source.pivotRadius/100,128))),bore);
  attach('outer',plate(clip.difference(outline,f.outer),-.12,.14),'rocker',PALETTE.driven);
  attach('inner',plate(f.inner,-.12,.14),'rocker',PALETTE.driven);
  attach('cover',plate(outline,.14,.24),'rocker',PALETTE.driven);
  // Brown sections the pivot shaft just behind the arm and draws no frame
  // joining the two shafts; neither is part of the native model.
  attach('pivotShaft',disk(pivotShaftRadius,-.34,.26,128),'frame',PALETTE.ink,[...f.pivot,0]);
  blocks.rocker.position.set(...f.pivot,0);blocks.rocker.rotation.z=f.initialAngle;blocks.input.rotation.z=f.phase;blocks.input.position.set(...f.inputCenter,0);
  const setSectionView=enabled=>{root.userData.sectionView=Boolean(enabled);parts.cover.visible=!enabled;};
  Object.assign(root.userData,{parts,families,blocks,source,profile,hideGround:true,setSectionView,
    geometry:{shaftRadius,pivotShaftRadius,outline,bodyCenter,bodyAngle}});
  setSectionView(true);markShadows(root);root.updateMatrixWorld(true);
  return {root,focus:new THREE.Vector3(.7,-.1,0),cameraDirection:new THREE.Vector3(1,.6,10)};
}
