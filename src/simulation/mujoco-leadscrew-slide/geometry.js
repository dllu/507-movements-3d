import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import source from './source.js';
import {makeLeadscrewSlideProfile} from './profile.js';
import {threadAngles,helicalThread,polygonCylinder} from '../mujoco-screw/thread-geometry.js';
import {plate,poly,circle,turned,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {makeLeadscrewSlideSection} from './section.js';
export {THREE};
const rectangle=(left,bottom,right,top)=>poly([[left,bottom],[right,bottom],[right,top],[left,top]]);
const permutation=new THREE.Matrix4().set(0,0,1,0,1,0,0,0,0,1,0,0,0,0,0,1);
const cubic=(a,b,c,d,count=32)=>Array.from({length:count+1},(_,i)=>{const t=i/count;return a.map((v,k)=>(1-t)**3*v+3*(1-t)**2*t*b[k]+3*(1-t)*t*t*c[k]+t**3*d[k]);});
// Remove the matching internal closure faces before joining the neck and
// haunch. This makes one watertight body and avoids a false shaded seam.
function withoutInterface(geometry,y) {
  const attributes=Object.fromEntries(Object.entries(geometry.attributes).map(([name,a])=>[name,{size:a.itemSize,values:[]}])),p=geometry.attributes.position;
  for(let i=0;i<p.count;i+=3)if(![0,1,2].every(j=>Math.abs(p.getY(i+j)-y)<1e-7)) {
    for(const [name,out] of Object.entries(attributes)){const a=geometry.attributes[name];for(let j=0;j<3;j++)for(let k=0;k<a.itemSize;k++)out.values.push(a.array[(i+j)*a.itemSize+k]);}
  }
  const result=new THREE.BufferGeometry();for(const [name,a] of Object.entries(attributes))result.setAttribute(name,new THREE.Float32BufferAttribute(a.values,a.size));geometry.dispose();return result;
}
export function makeLeadscrewSlideGeometry(options={}) {
  const root=new THREE.Group(),parts={},families={},blocks={},f=makeLeadscrewSlideProfile(options);
  const attach=(name,geometry,family,color)=>{
    if(!blocks[family]){blocks[family]=new THREE.Group();root.add(blocks[family]);}
    const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.15,roughness:.6}));mesh.name=name;
    blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
  };
  const aroundX=g=>g.rotateY(Math.PI/2),alongX=(section,low,high)=>plate(section,low,high).applyMatrix4(permutation);
  const screwAngles=threadAngles(f.external,f.segments),nutAngles=threadAngles(f.internal,f.segments);
  attach('core',aroundX(polygonCylinder(f.coreRadius,f.x(source.input[1]),f.external.high,screwAngles)),'screw',PALETTE.driver);
  attach('externalThread',aroundX(helicalThread(f.external,screwAngles)),'screw',PALETTE.driver);
  attach('input',alongX(rectangle(-.155,-.155,.155,.155),f.x(source.input[0]),f.x(source.input[1])),'screw',PALETTE.driver);
  for(const [name,values] of [['leftCollar',source.leftCollar],['rightCollar',source.rightCollar]]) {
    const [left,right,top,bottom]=values,low=f.x(left),high=name==='leftCollar'?f.headLeft-.003:f.x(right),r=(bottom-top)/200;
    attach(name,aroundX(turned([[low,f.coreRadius],[low,r-.015],[low+.01,r],[high-.01,r],[high,r-.015],[high,f.coreRadius]],256)),'screw',PALETTE.driver);
  }
  attach('tip',aroundX(turned([[f.external.high,0],[f.external.high,f.coreRadius],[f.external.high+.045,f.coreRadius*.82],[f.external.high+.045,0]],256)),'screw',PALETTE.driver);
  attach('headstock',alongX(clip.difference(rectangle(f.headBottom,-f.headDepth,f.headTop,f.headDepth),poly(circle([0,0],f.coreRadius+.003,256))),f.headLeft,f.headRight),'frame',PALETTE.frame);
  // Brown breaks the bed off at the right with a jagged line (a drawing
  // convention) and draws the bar beneath the guide as a recessed panel, not
  // an open window. The bed is modelled whole, ending square with the guide.
  const brokenEnd=(left,top,bottom)=>rectangle(left,bottom,f.railEnd,top);
  attach('base',plate(brokenEnd(f.headRight,f.baseTop,f.baseBottom),-.43,.34),'frame',PALETTE.frame);
  attach('bedShoulder',plate(rectangle(0,f.baseTop,f.x(127),f.railBottom),-.43,.34),'frame',PALETTE.frame);
  attach('bedPanel',plate(brokenEnd(f.x(127),f.railBottom,f.baseTop),-.43,.27),'frame',PALETTE.frame);
  // The raised rear edge follows the engraving. A lower running surface
  // supports the foot; its hidden T-slot retains the slide in depth.
  const slot=poly([[f.railTop+.01,-.063],[f.railTop+.01,.063],[f.railTop-.043,.063],[f.railTop-.043,.123],
    [f.railTop-.103,.123],[f.railTop-.103,-.123],[f.railTop-.043,-.123],[f.railTop-.043,-.063]]);
  const guideSection=clip.difference(clip.union(rectangle(f.railBottom,f.railBack,f.railTop,f.railFront),rectangle(f.railBottom,f.railBack,f.railBackTop,-.303)),slot);
  attach('guide',alongX(guideSection,0,f.railEnd),'frame',PALETTE.frame);
  const bore=poly(nutAngles.slice(0,-1).map(a=>[f.internal.outer*Math.sin(a),-f.internal.outer*Math.cos(a)]));
  const neck=alongX(clip.difference(rectangle(f.neckBottom,-f.neckDepth,f.neckTop,f.neckDepth),bore),-f.neckHalf,f.neckHalf);
  const local=p=>{const q=f.world(p);q[0]-=f.carriageBase;return q;};
  const outline=[...cubic([source.edges.footLeft,source.footTop],[241,282],[source.edges.neckLeft,283],[source.edges.neckLeft,267]),
    [source.edges.neckRight,267],...cubic([source.edges.neckRight,267],[source.edges.neckRight,281],[291,282],[source.edges.footRight,source.footTop]).slice(1),
    [source.edges.footRight,source.edges.footBottom],[source.edges.footLeft,source.edges.footBottom]].map(local);
  const joined=[withoutInterface(neck,f.neckBottom),withoutInterface(plate(poly(outline),-f.footDepth,f.footDepth),f.neckBottom)];
  attach('carriageBody',mergeGeometries(joined),'carriage',PALETTE.driven);joined.forEach(g=>g.dispose());
  const keySection=poly([[f.footBottom,-.06],[f.footBottom,.06],[f.railTop-.046,.06],[f.railTop-.046,.12],
    [f.railTop-.10,.12],[f.railTop-.10,-.12],[f.railTop-.046,-.12],[f.railTop-.046,-.06]]);
  attach('guideKey',alongX(keySection,f.footLeft+.04,f.footRight-.04),'carriage',PALETTE.driven);
  attach('internalThread',aroundX(helicalThread(f.internal,nutAngles)),'carriage',PALETTE.driven);
  blocks.carriage.position.x=f.carriageBase;
  Object.assign(root.userData,{parts,families,blocks,source,profile:f,hideGround:true,shadowCameraHalfExtent:3.2,shadowBias:-.00002,
    geometry:{screwAngles,nutAngles,outline,guideSection,keySection}});
  const section=makeLeadscrewSlideSection(root,parts,blocks,f,outline);
  Object.assign(root.userData,{section,setSectionView:section.set,localClippingEnabled:true});
  markShadows(root);for(const cap of section.caps)cap.castShadow=false;
  root.updateMatrixWorld(true);return {root,focus:new THREE.Vector3(1,-.58,0),cameraDirection:new THREE.Vector3(1,1,10)};
}
