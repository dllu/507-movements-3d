import * as THREE from 'three';
import source from './source.js';
import {makeSerpentineCamProfile} from './profile.js';
import {barrelLand} from '../mujoco-barrel-cam/groove.js';
import {followerHead} from '../mujoco-barrel-cam/geometry.js';
import {plate,poly,circle,turned,disk,ring,polygonClipping as clip} from '../finite-plate-geometry.js';
import {matte,PALETTE,markShadows} from '../primitives.js';
const rectangle=(l,b,r,t)=>poly([[l,b],[r,b],[r,t],[l,t]]);
const alongX=g=>g.applyMatrix4(new THREE.Matrix4().set(0,0,1,0,1,0,0,0,0,1,0,0,0,0,0,1));
export {THREE};

export function makeSerpentineCamGeometry(options={}) {
  const f=makeSerpentineCamProfile(options),e=source.edges,root=new THREE.Group(),parts={},families={},blocks={},collision={};
  const add=(name,geometry,family,color)=>{
    if(!blocks[family]){blocks[family]=new THREE.Group();root.add(blocks[family]);}
    const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.12,roughness:.62}));mesh.name=name;
    parts[name]=mesh;families[name]=family;blocks[family].add(mesh);return mesh;
  };
  for(const [name,side] of [['leftLand',-1],['rightLand',1]]) {
    const land=barrelLand(f,side);collision[name]=land.cells;add(name,land.geometry,'input',PALETTE.driver);
  }
  add('floor',ring(f.shaftRadius,f.floor,f.left,f.right,f.segments).rotateY(Math.PI/2),'input',PALETTE.driver);
  // Brown breaks the shaft off either side; it ends there as a plain stub
  // (p60 support policy: no added hangers).
  add('shaft',disk(f.shaftRadius,f.x(source.shaftEnds[0]),f.x(source.shaftEnds[1]),f.segments).rotateY(Math.PI/2),'input',PALETTE.driver);
  const header=source.header.map(([x,y],i)=>[x,i===0||i===3?e.ceilingBottom:y]).map(([x,y])=>[f.x(x),f.y(y)]);
  // Brown's hatched ceiling is the section of a fixed beam: model the beam
  // itself as a plain solid running back through the frame (no hatch strokes).
  add('header',plate(poly(header),-.50,.50),'frame',PALETTE.frame);
  for(const side of ['left','right']) {
    const outline=rectangle(f.y(e[side+'GuideBottom']),-.12,f.y(e.ceilingBottom),.12);
    const bore=rectangle(f.rodY-f.rodHalfHeight-.003,-f.rodHalfDepth-.003,f.rodY+f.rodHalfHeight+.003,f.rodHalfDepth+.003);
    add(side+'Guide',alongX(plate(clip.difference(outline,bore),f.x(e[side+'GuideLeft']),f.x(e[side+'GuideRight']))),'frame',PALETTE.frame);
  }
  const pinRadius=source.pin.radius/100;
  // Brown's block and tapered stem, made symmetric about the working pin's
  // axis: a collar round the rod and a round stem (Brown's 7.5 px width)
  // that shoulders onto the pin just above the barrel.
  const h=followerHead(f,{width:(e.headRight-e.headLeft)/100,top:f.y(e.headTop),stemRadius:.0375,stemEnd:f.pinHigh,collarRadius:.07,fillet:.0325});
  const pinHole=poly(circle(h.pinCenter,pinRadius+.0015,128));
  add('rod',plate(clip.difference(rectangle(f.x(source.rodEnds[0]),f.rodY-f.rodHalfHeight,f.x(source.rodEnds[1]),f.rodY+f.rodHalfHeight),pinHole),-f.rodHalfDepth,f.rodHalfDepth),'follower',PALETTE.driven);
  const headContour=h.outline;
  add('head',plate(clip.difference(poly(headContour),pinHole),-h.depth,h.depth),'follower',PALETTE.driven);
  add('stem',h.stem,'follower',PALETTE.driven);
  add('crossPin',disk(pinRadius,-h.depth-.015,h.depth+.015,128).translate(...h.pinCenter,0),'follower',PALETTE.ink);
  const cap=[];
  for(let i=0;i<=24;i++){const a=-Math.PI/2+Math.PI*i/48;cap.push([f.pinLow+f.pinRadius*Math.sin(a),f.pinRadius*Math.cos(a)]);}
  for(let i=0;i<=24;i++){const a=Math.PI*i/48;cap.push([f.pinHigh+f.pinRadius*Math.sin(a),f.pinRadius*Math.cos(a)]);}
  add('shoe',turned(cap,128).rotateX(-Math.PI/2).translate(f.initialTip,0,0),'follower',PALETTE.accent);
  Object.assign(root.userData,{source,profile:f,parts,families,blocks,collision,collisionRepetitions:f.repetitions,headContour,hideGround:true,
    shadowCameraHalfExtent:3,shadowBias:-.00002,shadowNormalBias:.001});
  markShadows(root);root.updateMatrixWorld(true);
  return{root,focus:new THREE.Vector3(-.1,.65,0),cameraDirection:new THREE.Vector3(1,1,10)};
}
