import * as THREE from 'three';
import source from './source.js';
import {makeSlottedBarProfile} from './profile.js';
import {plate,poly,circle,capsule,disk,rotate,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};
const rectangle=(left,bottom,right,top)=>poly([[left,bottom],[right,bottom],[right,top],[left,top]]);

export function makeSlottedBarGeometry(options={}) {
  const root=new THREE.Group(),parts={},families={},blocks={},f=makeSlottedBarProfile(options);
  const attach=(name,geometry,family,color,position=[0,0,0])=>{
    if(!blocks[family]){blocks[family]=new THREE.Group();root.add(blocks[family]);}
    const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.14,roughness:.6}));mesh.name=name;mesh.position.fromArray(position);
    blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
  };
  const bodyCenter=f.local(source.body),bodyAngle=-source.body[2]-f.sourceAngle;
  const bodyEnds=[-1,1].map(s=>rotate([s*source.body[3]/100,0],bodyAngle).map((v,i)=>v+bodyCenter[i]));
  const neck=poly([[201,177],[219,175],[254,242],[236,250]].map(f.local));
  // Complete the cropped lower handle with a round end, retaining both
  // manually read stem edges over their visible span.
  const handleStart=f.local([312,360]),handleEnd=f.local([357,448]);
  const boss=poly(circle([0,0],source.pivotRadius/100,128)),bore=poly(circle([0,0],source.shaftRadius/100+.002,128));
  const outline=clip.union(capsule(...bodyEnds,source.body[4]/100,128),neck,capsule(handleStart,handleEnd,.115,64),boss);
  attach('lever',plate(clip.difference(outline,f.slot,bore),0,.16),'lever',PALETTE.driver);
  attach('pivotBoss',plate(clip.difference(boss,bore),.16,.20),'lever',PALETTE.driver);
  attach('bar',plate(rectangle(f.barLeft,-f.barHalfHeight,f.barRight,f.barHalfHeight),-.24,-.08),'bar',PALETTE.driven);
  attach('pin',disk(f.pinRadius,-.08,.20,128),'bar',PALETTE.brass);
  attach('pinFace',disk(f.pinRadius,.20,.22,128),'bar',PALETTE.ink);
  attach('pivotShaft',disk(source.shaftRadius/100,-.48,.22,128),'frame',PALETTE.ink);
  const ceiling=source.ceiling.map(f.world),ceilingY=ceiling[0][1];
  const hanger=clip.union(rectangle(ceiling[0][0],ceilingY,ceiling[1][0],ceilingY+.05),
    poly([[178,138],[235,138],[220,162],[191,162]].map(f.world)),poly(circle([0,0],.17,128)));
  attach('hanger',plate(clip.difference(hanger,poly(circle([0,0],source.shaftRadius/100+.002,128))),-.42,-.28),'frame',PALETTE.muted);
  const guideXs=[];
  const permutation=new THREE.Matrix4().set(0,0,1,0,1,0,0,0,0,1,0,0,0,0,0,1);
  for(const [index,guide] of source.guides.entries()) {
    const [left,top]=f.world([guide[0],guide[2]]),[right,bottom]=f.world([guide[1],guide[3]]);
    // A complete rectangular tunnel runs along X through each guide.
    const section=clip.difference(rectangle(bottom,-.32,top,.28),rectangle(f.barY-f.barHalfHeight-.003,-.243,f.barY+f.barHalfHeight+.003,-.077));
    attach('guide'+index,plate(section,left,right).applyMatrix4(permutation),'frame',PALETTE.muted);
    for(const [side,y] of [[0,top-.17],[1,bottom+.17]])attach('bolt'+index+side,disk(.068,.28,.31,64),'frame',PALETTE.ink,[(left+right)/2,y,0]);
    // Each guide is bolted to a plain strap hanging from the ceiling beam
    // behind it (Brown draws the bolts but not what they fasten to).
    attach('guideStrap'+index,new THREE.BoxGeometry(.16,ceilingY+.02-bottom,.10),'frame',PALETTE.muted,[(left+right)/2,(ceilingY+.02+bottom)/2,-.37]);
    guideXs.push(left,right);
  }
  // Brown's hatched ceiling is a solid beam spanning both guides, not a
  // sheet; the pivot hanger hangs from its underside.
  attach('ceilingBeam',new THREE.BoxGeometry(Math.max(...guideXs)-Math.min(...guideXs)+.2,.24,.95),'frame',PALETTE.muted,
    [(Math.max(...guideXs)+Math.min(...guideXs))/2,ceilingY+.02+.12,-.125]);
  blocks.lever.rotation.z=f.sourceAngle;blocks.bar.position.set(f.initialX,f.barY,0);
  Object.assign(root.userData,{parts,families,blocks,source,profile:f,hideGround:true,geometry:{outline,bodyEnds,handleEnd}});
  // The ceiling beam and guide straps run past the plate's framing.
  for(const [name,mesh] of Object.entries(parts))if(/^(ceilingBeam|guideStrap)/.test(name))mesh.userData.beyondPlateCrop=true;
  markShadows(root);root.updateMatrixWorld(true);return {root,focus:new THREE.Vector3(.1,-1.2,0),cameraDirection:new THREE.Vector3(1,.6,10)};
}
