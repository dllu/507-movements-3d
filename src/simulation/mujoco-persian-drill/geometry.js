import * as THREE from 'three';
import {makePersianDrillProfile} from './profile.js';
import {threadAngles,helicalThread,threadContactCells,polygonCylinder} from '../mujoco-screw/thread-geometry.js';
import {turned,plate,poly} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {makePersianDrillSection} from './section.js';
export {THREE};
export function makePersianDrillGeometry(options={}) {
 const root=new THREE.Group(),parts={},families={},blocks={},cells={stock:[],grip:[]},f=makePersianDrillProfile(options);
 for(const n of ['head','stock','grip']){blocks[n]=new THREE.Group();root.add(blocks[n]);}
 const add=(name,g,family,color)=>{const m=new THREE.Mesh(g,matte(color,{metalness:.18,roughness:.55}));m.name=name;blocks[family].add(m);parts[name]=m;families[name]=family;return m;};
 const angles=list=>[...new Set(list.flatMap(t=>threadAngles(t,f.segments)))].sort((a,b)=>a-b),outerAngles=angles(f.external),innerAngles=angles(f.internal);
 add('head',turned(f.headProfile,128),'head',PALETTE.frame);
 add('core',polygonCylinder(f.core,f.coreLow,f.coreHigh,outerAngles),'stock',PALETTE.driven);
 for(const [i,t]of f.external.entries()){add('stockThread'+i,helicalThread(t,outerAngles),'stock',PALETTE.driven);cells.stock.push(...threadContactCells(t,f.segments));}
 add('chuck',polygonCylinder(f.chuckRadius,f.chuckLow,f.chuckHigh,Array.from({length:97},(_,i)=>2*Math.PI*i/96)),'stock',PALETTE.driven);
 const bit=plate(poly(f.bitOutline),-f.bitDepth/2,f.bitDepth/2);bit.rotateX(Math.PI/2);add('bit',bit,'stock',PALETTE.ink);
 add('grip',turned(f.gripProfile,128),'grip',PALETTE.driver);
 for(const [i,t]of f.internal.entries()){add('gripThread'+i,helicalThread(t,innerAngles),'grip',PALETTE.driver);cells.grip.push(...threadContactCells(t,f.segments));}
 for(const family of Object.keys(cells))cells[family]=cells[family].map(c=>c.map(p=>p.map(Math.fround)));
 root.rotation.x=-Math.PI/2;Object.assign(root.userData,{parts,families,blocks,cells,profile:f,source:f.source,hideGround:true,shadowCameraHalfExtent:2.5,shadowBias:-.00002,shadowNormalBias:.0005});
 const section=makePersianDrillSection(root,parts,f,blocks.grip);Object.assign(root.userData,{section,setSectionView:section.set,localClippingEnabled:true});
 markShadows(root);root.updateMatrixWorld(true);return {root,focus:new THREE.Vector3(0,-.2,0),cameraDirection:new THREE.Vector3(1,.5,10)};
}
