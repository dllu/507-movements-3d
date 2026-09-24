import * as THREE from 'three';
import {segmentClampProfile,segmentClampStroke} from './profile.js';
import source from './source.js';
import {plate,poly,circle,sector,spline,disk,ring,polygonClipping as clip} from '../finite-plate-geometry.js';
import {segmentClampContactCells} from './contact.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};
export function makeSegmentClampGeometry(options={}){
 const f=segmentClampProfile(options),root=new THREE.Group(),blocks={},parts={},families={},cells={};
 const local=([x,y])=>[(x-source.axis[0])/100,(source.axis[1]-y)/100],curve=p=>spline(p.map(local));
 for(const n of ['input','external','internal','fixed']){blocks[n]=new THREE.Group();root.add(blocks[n]);}
 const add=(n,g,family,color)=>{const mesh=new THREE.Mesh(g,matte(color,{metalness:.18,roughness:.55}));mesh.name=n;parts[n]=mesh;families[n]=family;blocks[family].add(mesh);return mesh;};
 // Open curves follow the separate inner and outer engraving edges.
 const leftJaw=poly([...curve([[198,54],[170,78],[154,108],[151,128],[157,159],[173,187],[197,207],[226,219]]),...curve([[226,197],[202,185],[181,167],[171,146],[170,124],[177,94],[189,70],[198,54]])]);
 const rightJaw=poly([...curve([[339,54],[358,77],[371,106],[374,130],[366,162],[350,188],[323,208],[285,222]]),...curve([[282,195],[311,186],[337,168],[353,146],[360,124],[358,103],[351,80],[339,54]])]);
 const externalBand=clip.intersection(poly(f.externalOutline),sector(1.22,2,-123*Math.PI/180,-39*Math.PI/180,160));
 const leftArm=poly([[226,227],[233,239],[196,327],[186,344],[171,336]].map(local)),rightArm=poly([[283,222],[381,297],[374,307],[355,297],[282,237]].map(local));
 const pivot=poly(circle([0,0],.32656634,128)),bore=poly(circle([0,0],.111,128));
 add('externalFrame',plate(clip.difference(clip.union(externalBand,leftArm,rightArm,leftJaw,pivot),bore),.10,.28),'external',PALETTE.brass);
 const outer=poly([...curve([[225,231],[213,252],[183,275],[147,303],[117,332],[95,362],[87,387],[90,415],[103,438],[126,455],[154,469],[184,480],[220,490],[255,496],[285,496],[318,491],[354,481],[386,465],[409,444],[421,420],[423,397],[418,372],[406,348],[387,324],[371,308],[351,288],[326,263],[285,226]]),local([254,213])]);
 const pitch=2*Math.PI/f.internalTeeth,space=a=>f.internalPhase+(Math.round((a-f.internalPhase)/pitch-.5)+.5)*pitch,
  ringStart=space(-119*Math.PI/180),ringEnd=space(-61*Math.PI/180),rootRadius=(f.internalTeeth/2+1)*f.internalModule,
  rootArc=Array.from({length:129},(_,i)=>{const a=ringStart+(ringEnd-ringStart)*i/128;return[rootRadius*Math.cos(a),rootRadius*Math.sin(a)];});
 const inner=poly([...rootArc,...curve([[389,439],[399,424],[404,407],[401,382],[390,357],[375,338],[358,319],[339,298],[316,274],[283,242],[254,231],[230,242],[210,265],[180,291],[150,317],[125,344],[109,371],[104,395],[109,419],[121,435]])]);
 const frame=clip.union(clip.difference(outer,inner),pivot);
 // The enclosing arms pass behind the large pinion during closure. Raise
 // the toothed band and jaw from that rear frame to their working planes.
 const internalBand=clip.intersection(clip.difference(outer,poly(f.internalOutline)),sector(2.35,3.2,ringStart,ringEnd,160));
 add('internalFrame',plate(clip.difference(frame,bore),-.38,-.20),'internal',PALETTE.driven);
 add('internalToothBand',plate(internalBand,-.20,.04),'internal',PALETTE.driven);
 add('internalJawFront',plate(clip.difference(clip.union(rightJaw,pivot),bore),-.20,.04),'internal',PALETTE.driven);
 // Inferred jaw width bridges the two gear planes so the gripping edges can
 // meet in native contact. Each extension meets its frame at a welded face.
 const padRelief=poly(circle([0,0],.34,128));
 add('leftJawPad',plate(clip.difference(leftJaw,padRelief),-.08,.10),'external',PALETTE.brass);
 add('rightJawPad',plate(clip.difference(rightJaw,padRelief),.04,.22),'internal',PALETTE.driven);
 add('smallPinion',f.small,'input',PALETTE.driver);add('largePinion',f.large,'input',PALETTE.driver);
 add('inputShaft',disk(.182,-.21,.38,128),'input',PALETTE.ink);add('compoundHub',ring(.182,.26,.04,.10,128),'input',PALETTE.driver);
 add('pivotShaft',disk(.1093328647,-.46,.40,128),'fixed',PALETTE.ink);add('pivotWasher',ring(.1093328647,.205146433,.28,.35,128),'fixed',PALETTE.frame);
 blocks.input.position.set(...f.input,0);
 const contactGeometry={smallPinion:parts.smallPinion.geometry,largePinion:parts.largePinion.geometry,
  externalTeeth:plate(clip.intersection(parts.externalFrame.geometry.userData.plate.polygons,sector(1.31,1.65,-126*Math.PI/180,-35*Math.PI/180,160)),.10,.28),
  internalTeeth:parts.internalToothBand.geometry,
  leftJaw:plate(clip.difference(leftJaw,padRelief),-.08,.28),rightJaw:plate(clip.difference(rightJaw,padRelief),-.20,.22)};
 const contactApproximation={};for(const[name,g]of Object.entries(contactGeometry)){const {cells:pieces,...description}=segmentClampContactCells(g,options.collisionTolerance??.0005);cells[name]=pieces;contactApproximation[name]=description;if(!Object.values(parts).some(m=>m.geometry===g))g.dispose();}
 const bounds=new THREE.Box3();const stroke=(options.amplitude??segmentClampStroke)+.05;for(let i=0;i<=32;i++){const a=stroke*i/32;blocks.external.rotation.z=-f.externalRatio*a;blocks.internal.rotation.z=f.internalRatio*a;blocks.input.rotation.z=a;root.updateMatrixWorld(true);bounds.union(new THREE.Box3().setFromObject(root,true));}
 for(const block of Object.values(blocks))block.rotation.z=0;root.updateMatrixWorld(true);bounds.expandByScalar(.08);
 Object.assign(root.userData,{source,profile:f,parts,blocks,families,cells,contactApproximation,hideGround:true,cameraFitBounds:bounds,shadowCameraHalfExtent:5,shadowNormalBias:.01,shadowBias:-.00002,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}});
 // Brown draws the clamp flat, face-on.
 markShadows(root);return{root,focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(.15,.1,10)};
}
