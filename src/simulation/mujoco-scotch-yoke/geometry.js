import * as THREE from 'three';
import source from './source.js';
import {plate,poly,circle,capsule,disk,ring,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';

export {THREE};
export function makeScotchYokeGeometry() {
  const root=new THREE.Group(),parts={},families={},blocks={};
  const attach=(name,geometry,family,color,position=[0,0,0])=>{
    if(!blocks[family]){blocks[family]=new THREE.Group();root.add(blocks[family]);}
    const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.14,roughness:.6}));
    mesh.name=name;mesh.position.fromArray(position);blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
  };
  const px=x=>x/100,x=value=>px(value-source.axis[0]),y=value=>px(source.wrist[1]-value);
  const crankRadius=px(source.crankRadius),wristRadius=px(source.wristRadius),shaftRadius=px(source.shaftRadius),clearance=.001;
  const slotRadius=wristRadius+clearance,slotEnds=source.slotEnds.map(x),outerEnds=source.outerEnds.map(x);
  const roots=source.outerY.map(y),outerCenter=(roots[0]+roots[1])/2,outerRadius=(roots[0]-roots[1])/2;
  const outer=capsule([outerEnds[0],outerCenter],[outerEnds[1],outerCenter],outerRadius,128);
  const hole=capsule([slotEnds[0],0],[slotEnds[1],0],slotRadius,128);
  attach('yoke',plate(clip.difference(outer,hole),.23,.49),'yoke',PALETTE.driven);
  attach('disk',ring(shaftRadius+.0015,px(source.diskRadius),-.10,.10,256),'input',PALETTE.driver);
  attach('frontHub',ring(shaftRadius+.0015,px(source.hubRadius),.10,.18,128),'input',PALETTE.driver);
  attach('rearHub',ring(shaftRadius+.0015,px(source.hubRadius),-.16,-.10,128),'input',PALETTE.driver);
  attach('shaft',disk(shaftRadius,-.80,.18,128),'input',PALETTE.ink);
  attach('wrist',disk(wristRadius,.10,.53,128),'input',PALETTE.brass,[crankRadius,0,0]);
  const stemX=x(source.stemX),stemRadius=px(source.stemRadius),stemZ=.36,guideHalfLength=.11;
  const guideCenter=Math.max(...roots.map(Math.abs))+crankRadius+guideHalfLength+.07;
  const stemEnd=guideCenter+guideHalfLength+crankRadius+.04,postX=1.96,postHalfWidth=.06;
  for(const [i,sign] of [1,-1].entries()) {
    const ends=[roots[i],sign*stemEnd].sort((a,b)=>a-b);
    const stem=attach('stem'+i,disk(stemRadius,...ends,96),'yoke',PALETTE.driven,[stemX,0,stemZ]);stem.rotation.x=-Math.PI/2;
    const guideProfile=clip.difference(clip.union(poly(circle([0,0],.25,128)),
      poly([[-.08,0],[.08,0],[.08,.93],[-.08,.93]])),poly(circle([0,0],stemRadius+.005,96)));
    const guide=attach('guide'+i,plate(guideProfile,-guideHalfLength,guideHalfLength),'frame',PALETTE.muted,[stemX,sign*guideCenter,stemZ]);guide.rotation.x=-Math.PI/2;
    attach('crossbar'+i,new THREE.BoxGeometry(2*(postX-postHalfWidth),2*guideHalfLength,.18),'frame',PALETTE.muted,[0,sign*guideCenter,-.57]);
    attach('post'+i,new THREE.BoxGeometry(2*postHalfWidth,2*(guideCenter+guideHalfLength),.18),'frame',PALETTE.muted,[sign*postX,0,-.57]);
  }
  const rear=clip.difference(clip.union(poly(circle([0,0],.29,128)),
    poly([[-postX+postHalfWidth,-.07],[postX-postHalfWidth,-.07],[postX-postHalfWidth,.07],[-postX+postHalfWidth,.07]])),poly(circle([0,0],shaftRadius+.003,128)));
  attach('shaftSupport',plate(rear,-.66,-.48),'frame',PALETTE.muted);
  blocks.input.rotation.z=source.phase;blocks.yoke.position.y=crankRadius*Math.sin(source.phase);
  Object.assign(root.userData,{parts,families,blocks,source,hideGround:true,profiles:{outer,hole},
    geometry:{crankRadius,wristRadius,shaftRadius,clearance,slotRadius,slotEnds,outerEnds,roots,outerRadius,outerCenter,stemX,stemZ,stemRadius,guideHalfLength,guideCenter,stemEnd,postX}});
  markShadows(root);root.updateMatrixWorld(true);
  return {root,focus:new THREE.Vector3(0,0,0),cameraDirection:new THREE.Vector3(.5,.3,10)};
}
