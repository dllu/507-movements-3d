import * as THREE from 'three';
import {makeHalfNutProfile} from './profile.js';
import {halfThread} from './thread-section.js';
import {threadAngles,helicalThread,threadContactCells} from '../mujoco-screw/thread-geometry.js';
import {plate,poly,circle,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {convexPlateCells} from '../mujoco/convex-plate.js';
export {THREE};

const toX=new THREE.Matrix4().set(0,0,1,0, 1,0,0,0, 0,1,0,0, 0,0,0,1);
const rectangle=(l,b,r,t)=>poly([[l,b],[r,b],[r,t],[l,t]]);
const ring=(outer,inner,angles)=>clip.difference(poly(angles.slice(0,-1).map(a=>[outer*Math.cos(a),outer*Math.sin(a)])),poly(angles.slice(0,-1).map(a=>[inner*Math.cos(a),inner*Math.sin(a)])));
const circleAngles=n=>Array.from({length:n+1},(_,i)=>i*2*Math.PI/n);
export function makeHalfNutGeometry(options={}) {
 const f=makeHalfNutProfile(options),e=f.source.edges,root=new THREE.Group(),parts={},families={},blocks={},cells={roller:[],carriage:[]},cellParts={roller:[],carriage:[]};
 const contact=(family,name,vertices,transform=toX)=>{for(const cell of vertices){cells[family].push(cell.map(v=>new THREE.Vector3(...v.map(Math.fround)).applyMatrix4(transform).toArray().map(Math.fround)));cellParts[family].push(name);}};
 const plateContact=(family,name,g,transform)=>{const c=convexPlateCells(g);contact(family,name,c.cells.map(cell=>cell.flatMap(p=>[c.low,c.high].map(z=>[...p,z]))),transform);};
 for(const name of ['frame','roller','carriage']){blocks[name]=new THREE.Group();root.add(blocks[name]);}
 blocks.roller.position.y=f.spacing;blocks.carriage.rotation.x=-f.selectorAngle;
 const add=(name,g,family,color)=>{const mesh=new THREE.Mesh(g,matte(color,{metalness:.15,roughness:.6}));mesh.name=name;parts[name]=mesh;families[name]=family;blocks[family].add(mesh);return mesh;};
 const alongX=g=>g.applyMatrix4(toX);
 const radialNormals=g=>{const p=g.attributes.position,n=g.attributes.normal;for(let i=0;i<p.count;i++)if(Math.abs(n.getZ(i))<.01){const r=Math.hypot(p.getX(i),p.getY(i)),sign=Math.sign(p.getX(i)*n.getX(i)+p.getY(i)*n.getY(i));n.setXYZ(i,sign*p.getX(i)/r,sign*p.getY(i)/r,0);}return g;};
 const cylinder=(r,lo,hi,n=64)=>alongX(radialNormals(plate(poly(circle([0,0],r,n)),lo,hi)));
 add('rollerShaft',cylinder(f.shaftRadius,f.x(e.leftFrameLeft),f.x(e.rightFrameRight)),'roller',PALETTE.driver);
 contact('roller','rollerShaft',[circleAngles(64).slice(0,-1).flatMap(a=>[f.x(e.leftFrameLeft),f.x(e.rightFrameRight)].map(z=>[f.shaftRadius*Math.cos(a),f.shaftRadius*Math.sin(a),z]))]);
 for(const [i,p]of f.external.entries()) {
  const name=i?'right':'left',angles=threadAngles(p,f.segments);
  add(name+'Root',alongX(radialNormals(plate(ring(f.coreRadius,f.shaftRadius,angles),p.low,p.high))),'roller',PALETTE.driver);
  add(name+'Thread',alongX(helicalThread(p,angles)),'roller',PALETTE.driver);
  contact('roller',name+'Root',[angles.slice(0,-1).flatMap(a=>[p.low,p.high].map(z=>[f.coreRadius*Math.cos(a),f.coreRadius*Math.sin(a),z]))]);
  contact('roller',name+'Thread',threadContactCells(p,f.segments));
 }
 for(const name of ['left','right']) {
  const shape=clip.difference(rectangle(f.y(e[name+'FrameBottom']),-f.frameHalfDepth,f.y(e[name+'FrameTop']),f.frameHalfDepth),
   clip.union(poly(circle([f.spacing,0],f.shaftRadius+f.clearance,64)),poly(circle([0,0],f.rodRadius+f.clearance,64))));
  add(name+'Frame',alongX(plate(shape,f.x(e[name+'FrameLeft']),f.x(e[name+'FrameRight']))),'frame',PALETTE.frame);
 }
 add('rod',cylinder(f.rodRadius,...f.source.rodEnds.map(f.x)),'carriage',PALETTE.driven);
 for(const [i,nut]of f.nuts.entries()) {
  const name=nut.name,section=halfThread(nut.thread,f.segments,nut.side);
  const transform=new THREE.Matrix4().makeRotationX(nut.preAngle).multiply(new THREE.Matrix4().makeTranslation(0,f.spacing,0)).multiply(toX);
  add(name+'NutThread',section.geometry.applyMatrix4(transform),'carriage',PALETTE.accent);
  contact('carriage',name+'NutThread',section.cells,transform);
  const bore=poly(section.angles.slice(0,-1).map(a=>[nut.thread.outer*Math.cos(a),nut.thread.outer*Math.sin(a)]));
  // Match the outer casting in the engraving's initially selected pose. The
  // inactive far casting is tilted relative to its threaded cylindrical bore.
  const delta=nut.preAngle-f.selectorAngle,z0=nut.side>0?0:-f.halfNutDepth,z1=nut.side>0?f.halfNutDepth:0;
  const outer=(y,z)=>[(y+z*Math.sin(delta))/Math.cos(delta)-f.spacing,z];
  const body=clip.difference(poly([outer(nut.bottom,z0),outer(nut.top,z0),outer(nut.top,z1),outer(nut.bottom,z1)]),bore);
  const bodyGeometry=plate(body,nut.low,nut.high);plateContact('carriage',name+'Nut',bodyGeometry,transform);
  add(name+'Nut',bodyGeometry.applyMatrix4(transform),'carriage',PALETTE.accent);
  const collarShape=clip.difference(rectangle(f.y(e[name+'CollarBottom']),-.15,f.y(e[name+'CollarTop']),.15),poly(circle([0,0],f.rodRadius,64)));
  add(name+'Collar',alongX(plate(collarShape,f.x(e[name+'CollarLeft']),f.x(e[name+'CollarRight']))).rotateX(f.selectorAngle),'carriage',PALETTE.driven);
  // An offset strap joins the collar's outer face to the nut's outer face.
  // Its upper end remains visible on the near casting, as in the engraving.
  const a=new THREE.Vector2(.10,nut.side*.15),b=new THREE.Vector2(.90,nut.side*(f.halfNutDepth+.035)),c=new THREE.Vector2(f.spacing+.10,b.y);
  const n0=new THREE.Vector2(-(b.y-a.y),b.x-a.x).normalize(),n1=new THREE.Vector2(0,1);
  const miter=n0.clone().add(n1).multiplyScalar(.035/(1+n0.dot(n1)));n0.multiplyScalar(.035);n1.multiplyScalar(.035);
  const arm=poly([a.clone().add(n0),b.clone().add(miter),c.clone().add(n1),c.clone().sub(n1),b.clone().sub(miter),a.clone().sub(n0)].map(v=>v.toArray()));
  const g=plate(arm,f.x(e[name+'ArmLeft']),f.x(e[name+'ArmRight'])).applyMatrix4(toX).rotateX(nut.preAngle);
  add(name+'Arm',g,'carriage',PALETTE.driven);
 }
 const leverCollar=clip.difference(rectangle(f.y(e.leverCollarBottom),-.15,f.y(e.leverCollarTop),.15),poly(circle([0,0],f.rodRadius,64)));
 add('leverCollar',alongX(plate(leverCollar,f.x(e.leverCollarLeft),f.x(e.leverCollarRight))).rotateX(f.selectorAngle),'carriage',PALETTE.driven);
 const knobY=f.source.knobs.map(k=>f.y(k.center[1]));
 const handle=new THREE.CylinderGeometry(f.leverRadius,f.leverRadius,knobY[0]-knobY[1],32).translate(f.leverX,(knobY[0]+knobY[1])/2,0).rotateX(f.selectorAngle);
 add('lever',handle,'carriage',PALETTE.driven);
 for(const [i,k]of f.source.knobs.entries()) {
  const g=new THREE.SphereGeometry(1,32,20).scale(k.radii[0]/100,k.radii[1]/100,k.radii[0]/100).translate(f.leverX,f.y(k.center[1]),0).rotateX(f.selectorAngle);
  add('knob'+i,g,'carriage',PALETTE.driven);
 }
 Object.assign(root.userData,{source:f.source,profile:f,parts,families,blocks,cells,cellParts,hideGround:true,shadowCameraHalfExtent:3.2,shadowBias:-.00002,shadowNormalBias:.001});
 markShadows(root);root.updateMatrixWorld(true);
 return {root,focus:new THREE.Vector3(.25,.30,0),cameraDirection:new THREE.Vector3(1,1,10)};
}
