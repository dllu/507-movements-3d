import * as THREE from 'three';
import {makeMicrometerProfile} from './profile.js';
import {threadAngles,helicalThread,threadContactCells,polygonCylinder} from '../mujoco-screw/thread-geometry.js';
import {plate,poly,polygonClipping as clip,turned} from '../finite-plate-geometry.js';
import {convexPlateCells} from '../mujoco/convex-plate.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {makeMicrometerSection} from './section.js';
export {THREE};
export function makeMicrometerGeometry(options={}) {
 const f=makeMicrometerProfile(options),root=new THREE.Group(),parts={},families={},blocks={},cells={outer:[],inner:[]},cellParts={outer:[],inner:[]};
 for(const family of ['outer','inner']){blocks[family]=new THREE.Group();root.add(blocks[family]);}
 const add=(name,g,family,vertices)=>{
  const m=new THREE.Mesh(g,matte(family==='outer'?PALETTE.driver:PALETTE.driven,{metalness:.18,roughness:.55}));m.name=name;blocks[family].add(m);parts[name]=m;families[name]=family;
  for(const cell of vertices??[]){cells[family].push(cell.map(v=>v.map(Math.fround)));cellParts[family].push(name);}return m;
 };
 const unionAngles=[...new Set([...threadAngles(f.outer,f.segments),...threadAngles(f.internal,f.segments)])].sort((a,b)=>a-b),innerAngles=threadAngles(f.inner,f.segments);
 const circle=(r,angles)=>poly(angles.slice(0,-1).map(a=>[r*Math.cos(a),r*Math.sin(a)]));
 const cylinderCell=(r,lo,hi,angles)=>[angles.slice(0,-1).flatMap(a=>[lo,hi].map(z=>[r*Math.cos(a),r*Math.sin(a),z]))];
 const body=plate(clip.difference(circle(f.outerCore,unionAngles),circle(f.bore,unionAngles)),0,f.ceiling),c=convexPlateCells(body);
 add('sleeve',body,'outer',c.cells.map(cell=>cell.flatMap(p=>[c.low,c.high].map(z=>[...p,z]))));
 add('head',polygonCylinder(f.outerCore,f.ceiling,f.top,unionAngles),'outer',cylinderCell(f.outerCore,f.ceiling,f.top,unionAngles));
 add('outerThread',helicalThread(f.outer,unionAngles),'outer',threadContactCells(f.outer,f.segments));
 add('internalThread',helicalThread(f.internal,unionAngles),'outer',threadContactCells(f.internal,f.segments));
 add('innerCore',polygonCylinder(f.innerCore,f.innerLow,f.innerHigh,innerAngles),'inner',cylinderCell(f.innerCore,f.innerLow,f.innerHigh,innerAngles));
 add('innerThread',helicalThread(f.inner,innerAngles),'inner',threadContactCells(f.inner,f.segments));
 const profile=Array.from({length:17},(_,i)=>{const a=Math.PI*i/32;return [f.innerLow-(f.innerLow-f.tipLow)*Math.cos(a),f.innerCore*Math.sin(a)];});
 const tip=turned([...profile,[f.innerLow,0]],64),points=[];const p=tip.attributes.position;for(let i=0;i<p.count;i++)points.push([p.getX(i),p.getY(i),p.getZ(i)]);
 add('tip',tip,'inner',[[...new Map(points.map(v=>[v.join(','),v])).values()]]);
 // The fixed outer nut and the inner antirotation guide are ideal constraints;
 // Brown omits both. Retain the engraving's uncluttered two-part silhouette.
 root.rotation.x=-Math.PI/2;Object.assign(root.userData,{profile:f,source:f.source,parts,families,blocks,cells,cellParts,hideGround:true,shadowCameraHalfExtent:2.5,shadowBias:-.00002,shadowNormalBias:.0005});
 const section=makeMicrometerSection(root,parts,f);Object.assign(root.userData,{section,setSectionView:section.set,localClippingEnabled:true});
 markShadows(root);root.updateMatrixWorld(true);return {root,focus:new THREE.Vector3(0,.35,0),cameraDirection:new THREE.Vector3(1,.5,10)};
}
