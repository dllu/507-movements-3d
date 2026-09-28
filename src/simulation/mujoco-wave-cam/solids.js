import {waveCamProfileAngles} from './adaptive-profile.js';
import {makeWaveCamUpdater} from './update-solids.js';
import * as THREE from 'three';
import {plate,poly,circle,capsule,ring,disk,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {disposeObject3D} from '../dispose-model.js';
import {waveCamGeometry,waveCamHeight} from './profile.js';

// Closed annular face cam. Separate normal domains retain the sharp top/rim
// boundaries; the lower face and cylindrical walls shade smoothly within each.
export function waveCamVisibleGeometry(g=waveCamGeometry()){
 const radii=Array.from({length:5},(_,i)=>2.69+(g.outerRadius-2.69)*i/4),angles=waveCamProfileAngles({segments:180,tolerance:.0003,heightFunctions:[a=>waveCamHeight(a,g)]}),positions=[],indices=[];
 function grid(rows,columns,point,reverse=false){
  const offset=positions.length/3;
  for(let i=0;i<rows;i++)for(let j=0;j<columns;j++)positions.push(...point(i,j));
  for(let i=0;i<rows-1;i++)for(let j=0;j<columns-1;j++){
   const a=offset+i*columns+j,b=a+columns,c=b+1,d=a+1;
   indices.push(...(reverse?[a,c,b,a,d,c]:[a,b,c,a,c,d]));
  }
 }
 const xyz=(a,r,y)=>[r*Math.sin(a),y,r*Math.cos(a)];
 grid(angles.length,radii.length,(i,j)=>xyz(angles[i],radii[j],waveCamHeight(angles[i],g)));
 grid(angles.length,2,(i,j)=>xyz(angles[i],j?g.outerRadius:2.69,g.topY),true);
 grid(angles.length,2,(i,j)=>xyz(angles[i],g.outerRadius,j?g.topY:waveCamHeight(angles[i],g)));
 grid(angles.length,2,(i,j)=>xyz(angles[i],2.69,j?g.topY:waveCamHeight(angles[i],g)),true);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();return geometry;
}

export function makeWaveCamSolids(){
 const g=waveCamGeometry(),root=new THREE.Group(),parts={},families={},blocks={},materials=new Map();
 const dx=g.rollerX-g.pivot[0],dy=g.rollerY-g.pivot[1],arm=Math.hypot(dx,dy),theta=Math.atan2(dy,dx),leftLength=Math.hypot(g.outputPin[0]-g.pivot[0],g.outputPin[1]-g.pivot[1]);
 const left=[g.pivot[0]-leftLength*Math.cos(theta),g.pivot[1]-leftLength*Math.sin(theta)];
 const group=name=>{const b=new THREE.Group();b.name='body:'+name;root.add(b);blocks[name]=b;return b;};
 group('fixed');group('cam');group('rocker');group('roller');group('output');
 const add=(name,geometry,family,color,position=[0,0,0])=>{
  if(!materials.has(color)){const m=matte(color);m.fog=false;materials.set(color,m);}
  const mesh=new THREE.Mesh(geometry,materials.get(color));mesh.name=name;mesh.position.set(...position);blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
 };
 add('wavedCam',waveCamVisibleGeometry(g),'cam',PALETTE.driver);
 add('camWeb',ring(g.innerRadius,2.69,3.92,g.topY,192).rotateX(-Math.PI/2),'cam',PALETTE.driver);
 const shaftProfile=[[0,-.68],[.07,-.674],[.135,-.63],[.175,-.50],[.195,-.23],[.255,.08],[.414,.346],[.414,3.3],[.504,4.37],[.504,5.89],[0,5.89]].map(p=>new THREE.Vector2(...p));
 add('shaftAndGrip',new THREE.LatheGeometry(shaftProfile,128),'cam',PALETTE.ink);
 add('upperCollar',ring(.508,.756,4,4.378,128).rotateX(-Math.PI/2),'cam',PALETTE.brass);
 const eyeRadius=.324,bore=.148;
 const lever=clip.difference(clip.union(capsule([-leftLength,0],[arm,0],.126,32),...[-leftLength,0,arm].map(x=>poly(circle([x,0],eyeRadius,96)))),...[-leftLength,0,arm].map(x=>poly(circle([x,0],bore,96))));
 add('oscillatingRod',plate(lever,2.86,2.98),'rocker',PALETTE.driven);
 add('rollerWheel',ring(bore,g.rollerRadius,-g.rollerDepth/2,g.rollerDepth/2,192),'roller',PALETTE.brass);
 for(const [name,x]of [['output',-leftLength],['roller',arm]]){
  add(name+'Pin',disk(.144,2.66,3.01,96),'rocker',PALETTE.ink,[x,0,0]);
  add(name+'PinHead',disk(.16,3.005,3.055,96),'rocker',PALETTE.ink,[x,0,0]);
 }
 add('fulcrumPin',disk(.144,2.78,3.01,96),'fixed',PALETTE.ink,[g.pivot[0],g.pivot[1],0]);
 add('fulcrumPinHead',disk(.16,3.005,3.055,96),'fixed',PALETTE.ink,[g.pivot[0],g.pivot[1],0]);
 // The caption requires rectilinear output. Its small transverse pin travel
 // (x -0.068 to -0.001 about the output line in the bake; the slot keeps its
 // wider -0.12 to 0.015 allowance) is hidden inside the round eye; eye and bar
 // are centred on the middle of that travel so the eye stays within 0.034 of
 // concentric with the pin. The unpictured vertical guide remains ideal.
 const eyeX=-.0345;
 const output=clip.difference(clip.union(poly(circle([eyeX,0],eyeRadius,96)),capsule([eyeX,-.20],[eyeX,-2.304],.126,32)),capsule([-.12,0],[.015,0],bore,64));
 add('uprightBar',plate(output,2.68,2.80),'output',PALETTE.driven);
 const sync=makeWaveCamUpdater(root,{...g,left});
 const initial={cam:0,rocker:theta,rollerAngle:0,rollerCenter:[g.rollerX,g.rollerY,g.rollerZ],outputY:left[1]};sync(initial);markShadows(root);
 Object.assign(root.userData,{parts,families,blocks,geometry:{...g,arm,theta,leftLength,left},hideGround:true,reconstructionStatus:'unregistered-source-assembly',reconstructionNote:'Source-shaped waved cam, finite roller and oscillating rod. The output eye hides inferred transverse pin travel; its vertical guide and the fulcrum support are ideal and unpictured.'});
 return{root,sync,dispose:()=>disposeObject3D(root)};
}
