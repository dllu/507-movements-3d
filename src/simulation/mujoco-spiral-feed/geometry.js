import * as THREE from 'three';
import source from './source.js';
import {makeSpiralFeedProfile} from './profile.js';
import {plate,poly,circle,disk,ring,capsule,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};

export function makeSpiralFeedGeometry(options={}) {
  const root=new THREE.Group(),parts={},families={},blocks={},profile=makeSpiralFeedProfile(options),f=profile;
  const attach=(name,geometry,family,color,position=[0,0,0])=>{
    if(!blocks[family]){blocks[family]=new THREE.Group();root.add(blocks[family]);}
    const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.14,roughness:.6}));
    mesh.name=name;mesh.position.fromArray(position);blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
  };
  const shaftRadius=source.shaftRadius/100,hubRadius=source.hubRadius/100,journalRadius=.05;
  attach('disk',ring(shaftRadius,source.diskRadius/100,-.26,-.08,256),'input',PALETTE.driver);
  attach('rail',plate(f.polygon,-.08,.16),'input',0x873a2e);
  attach('frontHub',ring(shaftRadius,hubRadius,-.08,.18,128),'input',PALETTE.driver);
  attach('rearHub',ring(shaftRadius,hubRadius,-.39,-.26,128),'input',PALETTE.driver);
  attach('shaft',disk(shaftRadius,-.92,.24,128),'input',PALETTE.ink);
  attach('roller',ring(journalRadius+.001,f.rollerRadius,-.07,.25,128),'roller',PALETTE.brass);
  const neck=source.neck.map(p=>[(p[0]-source.eye[0])/100,(source.eye[1]-p[1])/100]);
  const eyeShape=clip.difference(clip.union(poly(circle([0,0],source.eyeRadius/100,128)),poly(neck)),poly(circle([0,0],journalRadius,64)));
  attach('eye',plate(eyeShape,.28,.42),'follower',PALETTE.driven);
  attach('journal',disk(journalRadius,-.07,.42,64),'follower',PALETTE.ink);
  attach('head',disk(source.headRadius/100,.42,.455,96),'follower',PALETTE.ink);
  // A half section leaves the eye visibly attached to the rod while exposing
  // the roller. These alternate surfaces are excluded from physical mass.
  const half=poly([[-1,-1],[0,-1],[0,1],[-1,1]]),sectionMeshes={
    eye:new THREE.Mesh(plate(clip.intersection(eyeShape,half),.28,.42),parts.eye.material),
    head:new THREE.Mesh(plate(clip.intersection(poly(circle([0,0],source.headRadius/100,96)),half),.42,.455),parts.head.material),
  };
  blocks.follower.add(...Object.values(sectionMeshes));
  const barWidth=(source.barRight-source.barLeft)/100,barDepth=.18,barZ=.35,barStart=(source.neck[2][1]-source.eye[1])/100,barEnd=2.25;
  attach('bar',new THREE.BoxGeometry(barWidth,barEnd-barStart,barDepth),'follower',PALETTE.driven,[0,-(barStart+barEnd)/2,barZ]);
  const guideCenter=[(source.guide[0]+source.guide[2])/200-source.axis[0]/100,source.axis[1]/100-(source.guide[1]+source.guide[3])/200,barZ];
  // Center the ordinary bored guide on the feed axis; the raster's offsets
  // between its eye, bar, block and shaft are small drawing discrepancies.
  guideCenter[0]=0;
  // A 5.5-pixel downward correction clears the eye's neck at full extension.
  guideCenter[1]-=.055;
  const guideHalfWidth=(source.guide[2]-source.guide[0])/200,guideHalfLength=(source.guide[3]-source.guide[1])/200;
  const guideShape=clip.difference(poly([[-guideHalfWidth,-.28],[guideHalfWidth,-.28],[guideHalfWidth,.28],[-guideHalfWidth,.28]]),
    poly([[-barWidth/2-.003,-barDepth/2-.003],[barWidth/2+.003,-barDepth/2-.003],[barWidth/2+.003,barDepth/2+.003],[-barWidth/2-.003,barDepth/2+.003]]));
  attach('guide',plate(guideShape,-guideHalfLength,guideHalfLength),'frame',PALETTE.muted,guideCenter).rotation.x=Math.PI/2;
  const railXs=source.rails.map(x=>(x-source.axis[0])/100),railTop=(source.axis[1]-source.railTop)/100,railEnd=(source.axis[1]-source.railEnd)/100-.06;
  // Brown's two frame uprights run on past his crop to a floor below the
  // rod's lowest reach, each standing on a foot; the crossbar carrying the
  // guide spans them at the guide.
  const floorY=-4.4,railWidth=.09;
  for(const [i,x] of railXs.entries()){
    attach('frameRail'+i,new THREE.BoxGeometry(railWidth,railTop-floorY,.10),'frame',PALETTE.muted,[x,(railTop+floorY)/2,-.51]);
    attach('frameFoot'+i,new THREE.BoxGeometry(.4,.1,.6),'frame',PALETTE.muted,[x,floorY+.05,-.51]);
  }
  attach('frameCrossbar',new THREE.BoxGeometry(railXs[1]-railXs[0]+railWidth,.16,.10),'frame',PALETTE.muted,[(railXs[0]+railXs[1])/2,guideCenter[1],-.51]);
  for(const [i,x] of [-.35,.35].entries())attach('guideBracket'+i,new THREE.BoxGeometry(.10,.22,.53),'frame',PALETTE.muted,[x,guideCenter[1],-.195]);
  const spine=clip.difference(clip.union(capsule([0,0],[0,guideCenter[1]],.1,32),poly(circle([0,0],.37,128))),poly(circle([0,0],shaftRadius+.003,128)));
  attach('bearingSpine',plate(spine,-.72,-.56),'frame',PALETTE.muted);
  // The uprights run on below the plate's framing to their feet.
  for(const [name,mesh] of Object.entries(parts))if(/^frame(Rail|Foot)/.test(name))mesh.userData.beyondPlateCrop=true;
  const initialRadius=f.middleRadius(0);blocks.follower.position.y=-initialRadius;blocks.roller.position.y=-initialRadius;
  const setSectionView=enabled=>{root.userData.sectionView=Boolean(enabled);parts.eye.visible=!enabled;parts.head.visible=!enabled;for(const mesh of Object.values(sectionMeshes))mesh.visible=Boolean(enabled);};
  Object.assign(root.userData,{parts,families,blocks,source,profile,hideGround:true,setSectionView,sectionMeshes,
    geometry:{shaftRadius,hubRadius,journalRadius,barWidth,barDepth,barZ,barStart,barEnd,guideCenter,guideHalfWidth,guideHalfLength,railXs,railTop,railEnd}});
  setSectionView(false);markShadows(root);root.updateMatrixWorld(true);
  return {root,focus:new THREE.Vector3(0,-.8,0),cameraDirection:new THREE.Vector3(1,.6,10)};
}
