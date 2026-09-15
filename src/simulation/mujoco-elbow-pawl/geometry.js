import * as THREE from 'three';
import {plate,poly,circle,ring,disk,polygonClipping as clip} from '../finite-plate-geometry.js';
import {segmentClampContactCells} from '../mujoco-segment-clamp/contact.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {disposeObject3D} from '../dispose-model.js';

/** Unregistered source-based working candidate; support and sweep qualification remain open. */
export function makeElbowPawlGeometry({teeth=23,phase=132.8715838509317*Math.PI/180-.020,rootRadius=1.83,tipRadius=2.10,collisionTolerance=.0002,side='right'}={}){
 if(!['right','left'].includes(side))throw new RangeError('Invalid pawl installation side');
 const root=new THREE.Group(),blocks={},parts={},families={},cells={},contactApproximation={};
 const local=([x,y])=>[(x-226)/100,(300-y)/100];
 const f={side,teeth,phase,pitch:2*Math.PI/teeth,rootRadius,tipRadius,pawlPivot:local([232,37]),crank:local([477,300]),rodEnd:local([477,-70])};
 f.rodVector=f.rodEnd.map((v,i)=>v-f.crank[i]);f.rodLength=Math.hypot(...f.rodVector);
 for(const name of ['carrier','output','pawl','rod']){blocks[name]=new THREE.Group();root.add(blocks[name]);}
 const add=(name,geometry,family,color)=>{const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.15,roughness:.6}));mesh.name=name;blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;};
 if(side==='left')f.phase=2*Math.atan2(f.pawlPivot[1],f.pawlPivot[0])-phase;
 const points=[],point=(r,a)=>[r*Math.cos(a),r*Math.sin(a)];
 for(let i=0;i<teeth;i++){const a=f.phase+i*f.pitch;points.push(point(rootRadius,a-.25*f.pitch),point(tipRadius,a-.25*f.pitch),point(tipRadius,a+.25*f.pitch),point(rootRadius,a+.25*f.pitch));}
 add('cog',plate(clip.difference(poly(points),poly(circle([0,0],.424,128))),-.16,.16),'output',PALETTE.driven);
 add('shaft',disk(.42,-.35,.76,128),'output',PALETTE.ink);
 const body=new THREE.Shape();body.moveTo(161,300);body.lineTo(196,38);body.bezierCurveTo(199,-7,263,-11,269,34);body.lineTo(284,204);body.quadraticCurveTo(289,256,339,258);body.lineTo(478,259);body.bezierCurveTo(531,260,532,333,481,340);body.lineTo(236,370);body.bezierCurveTo(192,378,151,350,161,300);
 add('elbow',plate(clip.difference(poly(body.getPoints(48).map(p=>local(p.toArray()))),poly(circle([0,0],.424,128))),.24,.44),'carrier',PALETTE.driver);
 add('centerFace',ring(.424,.65,.44,.50,128),'carrier',PALETTE.ink);
 const click=new THREE.Shape();click.moveTo(212,18);click.quadraticCurveTo(232,5,253,25);click.quadraticCurveTo(314,65,348,0);click.lineTo(368,5);click.lineTo(327,142);click.lineTo(309,134);click.lineTo(316,109);click.quadraticCurveTo(307,72,270,63);click.lineTo(229,62);click.quadraticCurveTo(202,52,212,18);
 const pawlLocal=p=>local(p).map((x,i)=>x-f.pawlPivot[i]);
 add('click',plate(clip.difference(poly(click.getPoints(48).map(p=>pawlLocal(p.toArray()))),poly(circle([0,0],.184,96))),-.12,.12),'pawl',PALETTE.brass);blocks.pawl.position.set(...f.pawlPivot,0);
 const pin=add('clickPin',disk(.18,-.12,.24,96),'carrier',PALETTE.ink);pin.position.set(...f.pawlPivot,0);
 const face=add('clickPinFace',disk(.18,.44,.49,96),'carrier',PALETTE.ink);face.position.set(...f.pawlPivot,0);
 const rodShape=clip.difference(clip.union(poly(circle([0,0],.40,96)),poly([[-.15,0],[.15,0],[.15,f.rodLength],[-.15,f.rodLength]]),poly(circle([0,f.rodLength],.23,96))),poly(circle([0,0],.224,96)),poly(circle([0,f.rodLength],.104,96)));
 add('rod',plate(rodShape,.50,.70),'rod',PALETTE.driver);blocks.rod.position.set(...f.crank,0);
 const crank=add('crankPin',disk(.22,.44,.75,96),'carrier',PALETTE.ink);crank.position.set(...f.crank,0);
 if(side==='left')parts.click.geometry.applyMatrix4(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(...f.pawlPivot,0).normalize(),Math.PI));
 for(const name of ['cog','click']){const {cells:pieces,...description}=segmentClampContactCells(parts[name].geometry,collisionTolerance);cells[name]=pieces;contactApproximation[name]=description;}
 Object.assign(root.userData,{profile:f,parts,families,blocks,cells,contactApproximation,hideGround:true});
 markShadows(root);root.updateMatrixWorld(true);return{root,focus:new THREE.Vector3(.5,.7,0),cameraDirection:new THREE.Vector3(.02,.03,15),dispose:()=>disposeObject3D(root)};
}
