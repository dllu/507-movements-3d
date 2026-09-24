import * as THREE from 'three';
import {hatchHeader} from '../mujoco-barrel-cam/hatched-header.js';
import source from './source.js';
import {makeSerpentineCamProfile} from './profile.js';
import {barrelLand} from '../mujoco-barrel-cam/groove.js';
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
  add('shaft',disk(f.shaftRadius,f.x(source.shaftEnds[0]),f.x(source.shaftEnds[1]),f.segments).rotateY(Math.PI/2),'input',PALETTE.driver);
  const header=source.header.map(([x,y],i)=>[x,i===0||i===3?e.ceilingBottom:y]).map(([x,y])=>[f.x(x),f.y(y)]);
  hatchHeader(add('header',plate(poly(header),-.20,.20),'frame',PALETTE.frame),header);
  for(const side of ['left','right']) {
    const outline=rectangle(f.y(e[side+'GuideBottom']),-.12,f.y(e.ceilingBottom),.12);
    const bore=rectangle(f.rodY-f.rodHalfHeight-.003,-f.rodHalfDepth-.003,f.rodY+f.rodHalfHeight+.003,f.rodHalfDepth+.003);
    add(side+'Guide',alongX(plate(clip.difference(outline,bore),f.x(e[side+'GuideLeft']),f.x(e[side+'GuideRight']))),'frame',PALETTE.frame);
  }
  const pinCenter=[f.x(source.pin.center[0]),f.rodY],pinRadius=source.pin.radius/100;
  const pinHole=poly(circle(pinCenter,pinRadius+.0015,128));
  add('rod',plate(clip.difference(rectangle(f.x(source.rodEnds[0]),f.rodY-f.rodHalfHeight,f.x(source.rodEnds[1]),f.rodY+f.rodHalfHeight),pinHole),-f.rodHalfDepth,f.rodHalfDepth),'follower',PALETTE.driven);
  const head=new THREE.Shape();head.moveTo(e.headLeft,e.headTop);head.lineTo(e.headRight,e.headTop);head.lineTo(e.headRight,212);
  head.lineTo(e.stemRight,217);head.lineTo(e.stemRight,229);head.lineTo(f.axis[0]+100*f.initialTip+2,238);head.lineTo(f.axis[0]+100*f.initialTip-2,238);
  head.lineTo(e.stemLeft,229);head.lineTo(e.stemLeft,217);head.lineTo(e.headLeft,212);head.closePath();
  const headContour=head.getPoints(32).map(p=>[f.x(p.x),f.y(p.y)]);
  const headGeometry=plate(clip.difference(poly(headContour),pinHole),f.rodHalfDepth,f.rodHalfDepth+.08),vertices=headGeometry.attributes.position;
  // The thin lower stem bends back from the rod's front face to the working
  // pin's plane. Its complete end remains above the barrel's outer radius.
  for(let i=0;i<vertices.count;i++){const pixelY=f.axis[1]-100*vertices.getY(i),t=THREE.MathUtils.clamp((pixelY-217)/21,0,1);vertices.setZ(i,.1*(1-t)+(vertices.getZ(i)-.1)/.04*(.04*(1-t)+.008*t));}
  headGeometry.computeVertexNormals();headGeometry.computeBoundingBox();headGeometry.computeBoundingSphere();
  add('head',headGeometry,'follower',PALETTE.driven);
  add('crossPin',disk(pinRadius,-f.rodHalfDepth-.015,f.rodHalfDepth+.09,128).translate(...pinCenter,0),'follower',PALETTE.ink);
  const cap=[];
  for(let i=0;i<=24;i++){const a=-Math.PI/2+Math.PI*i/48;cap.push([f.pinLow+f.pinRadius*Math.sin(a),f.pinRadius*Math.cos(a)]);}
  for(let i=0;i<=24;i++){const a=Math.PI*i/48;cap.push([f.pinHigh+f.pinRadius*Math.sin(a),f.pinRadius*Math.cos(a)]);}
  add('shoe',turned(cap,128).rotateX(-Math.PI/2).translate(f.initialTip,0,0),'follower',PALETTE.accent);
  Object.assign(root.userData,{source,profile:f,parts,families,blocks,collision,collisionRepetitions:f.repetitions,headContour,hideGround:true,
    shadowCameraHalfExtent:3,shadowBias:-.00002,shadowNormalBias:.001});
  markShadows(root);root.updateMatrixWorld(true);
  return{root,focus:new THREE.Vector3(-.1,.65,0),cameraDirection:new THREE.Vector3(1,1,10)};
}
