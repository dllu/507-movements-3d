import * as THREE from 'three';
import source from './source.js';
import {makeQuickReturnProfile} from './profile.js';
import {plate,poly,circle,capsule,disk,ring,rotate,spline,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};

export function makeQuickReturnGeometry(options={}) {
  const root=new THREE.Group(),parts={},families={},blocks={},f=makeQuickReturnProfile(options);
  const attach=(name,geometry,family,color,position=[0,0,0])=>{
    if(!blocks[family]){blocks[family]=new THREE.Group();root.add(blocks[family]);}
    const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.14,roughness:.6}));mesh.name=name;mesh.position.fromArray(position);
    blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
  };
  const shaftRadius=source.shaftRadius/100,hubRadius=source.hubRadius/100,pivotShaftRadius=source.pivotShaftRadius/100;
  attach('disk',ring(shaftRadius,source.diskRadius/100,-.50,-.34,256),'input',PALETTE.driver);
  attach('rearHub',ring(shaftRadius,hubRadius,-.60,-.50,128),'input',PALETTE.driver);
  attach('frontHub',ring(shaftRadius,hubRadius,-.34,-.26,128),'input',PALETTE.driver);
  attach('shaft',disk(shaftRadius,-.85,-.08,128),'input',PALETTE.ink);
  // Two circular ends and their common exterior tangents give the drawn
  // broad crank. It stays behind the lever so its shaft cannot cut the sweep.
  const tangent=Math.acos((hubRadius-f.pinRadius)/f.crankRadius),crank=[];
  for(let i=0;i<=128;i++){const a=tangent+(2*Math.PI-2*tangent)*i/128;crank.push([hubRadius*Math.cos(a),hubRadius*Math.sin(a)]);}
  for(let i=0;i<=64;i++){const a=-tangent+2*tangent*i/64;crank.push([f.crankRadius+f.pinRadius*Math.cos(a),f.pinRadius*Math.sin(a)]);}
  attach('crank',plate(clip.difference(poly(crank),poly(circle([0,0],shaftRadius,128))),-.26,-.12),'input',PALETTE.driver);
  attach('pin',disk(f.pinRadius,-.12,.26,128),'input',PALETTE.brass,[f.crankRadius,0,0]);
  attach('pinFace',disk(f.pinRadius,.26,.28,128),'input',PALETTE.ink,[f.crankRadius,0,0]);
  const bodyStart=f.local(source.body),bodyAngle=-source.body[2]-f.sourceAngle,axis=rotate([1,0],bodyAngle);
  const length=-bodyStart.reduce((s,v,i)=>s+v*axis[i],0),bodyEnd=bodyStart.map((v,i)=>v+length*axis[i]);
  const bore=poly(circle([0,0],pivotShaftRadius+.002,128)),boss=poly(circle([0,0],source.pivotRadius/100,128));
  const output=[source.output[0],...spline(source.output.slice(1,-1)),source.output.at(-1)];
  const outline=clip.difference(clip.union(capsule(bodyStart,bodyEnd,source.body[3]/100,128),boss,poly(output.map(f.local))),bore);
  attach('lever',plate(clip.difference(outline,f.slot),0,.18),'rocker',PALETTE.driven);
  attach('pivotBoss',plate(clip.difference(boss,bore),.18,.24),'rocker',PALETTE.driven);
  attach('pivotShaft',disk(pivotShaftRadius,-.85,.26,128),'frame',PALETTE.ink,[...f.pivot,0]);
  const rearOutline=clip.union(capsule([0,0],f.pivot,.075,32),poly(circle([0,0],.27,96)),poly(circle(f.pivot,.28,96)));
  const rear=clip.difference(rearOutline,poly(circle([0,0],shaftRadius+.003,128)),poly(circle(f.pivot,pivotShaftRadius+.003,128)));
  attach('rearFrame',plate(rear,-.75,-.63),'frame',PALETTE.muted);
  blocks.input.rotation.z=f.phase;blocks.rocker.position.set(...f.pivot,0);blocks.rocker.rotation.z=f.sourceAngle;
  Object.assign(root.userData,{parts,families,blocks,source,profile:f,hideGround:true,geometry:{shaftRadius,pivotShaftRadius,outline,bodyStart,bodyEnd,bodyAngle}});
  markShadows(root);root.updateMatrixWorld(true);return {root,focus:new THREE.Vector3(.8,0,0),cameraDirection:new THREE.Vector3(1,.6,10)};
}
