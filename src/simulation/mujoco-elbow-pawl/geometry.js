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
 for(const name of ['carrier','output','pawl','rod','slider','fixed']){blocks[name]=new THREE.Group();root.add(blocks[name]);}
 const add=(name,geometry,family,color)=>{const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.15,roughness:.6}));mesh.name=name;blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;};
 if(side==='left')f.phase=2*Math.atan2(f.pawlPivot[1],f.pawlPivot[0])-phase;
 const points=[],point=(r,a)=>[r*Math.cos(a),r*Math.sin(a)];
 for(let i=0;i<teeth;i++){const a=f.phase+i*f.pitch;points.push(point(rootRadius,a-.25*f.pitch),point(tipRadius,a-.25*f.pitch),point(tipRadius,a+.25*f.pitch),point(rootRadius,a+.25*f.pitch));}
 add('cog',plate(clip.difference(poly(points),poly(circle([0,0],.424,128))),-.16,.16),'output',PALETTE.driven);
 add('shaftMiddle',disk(.424,-.16,.16,128),'output',PALETTE.ink);
 add('shaftRear',disk(.42,-.90,-.16,128),'output',PALETTE.ink);
 add('shaftFront',disk(.42,.16,.76,128),'output',PALETTE.ink);
 add('outputRearThrust',ring(.42,.56,.16,.18,128),'output',PALETTE.ink);
 add('outputFrontThrust',ring(.42,.56,.504,.55,128),'output',PALETTE.ink);
 const body=new THREE.Shape();body.moveTo(161,300);body.lineTo(196,38);body.bezierCurveTo(199,-7,263,-11,269,34);body.lineTo(284,204);body.quadraticCurveTo(289,256,339,258);body.lineTo(478,259);body.bezierCurveTo(531,260,532,333,481,340);body.lineTo(236,370);body.bezierCurveTo(192,378,151,350,161,300);
 add('elbow',plate(clip.difference(poly(body.getPoints(48).map(p=>local(p.toArray()))),poly(circle([0,0],.424,128))),.24,.44),'carrier',PALETTE.driver);
 add('centerFace',ring(.424,.65,.44,.50,128),'carrier',PALETTE.ink);
 const click=new THREE.Shape();click.moveTo(212,18);click.quadraticCurveTo(232,5,253,25);click.quadraticCurveTo(314,65,348,0);
 // Brown crops the upper prong at the plate edge (348,0)-(368,5). It is
 // completed 12 source pixels past the crop along its two edges and closed
 // by a semicircle, so no square cut remains in the rotated views.
 {const A=[348,0],B=[368,5],dL=[34/Math.hypot(34,65),-65/Math.hypot(34,65)],dR=[41/Math.hypot(41,137),-137/Math.hypot(41,137)],e=12;
  const a=[A[0]+e*dL[0],A[1]+e*dL[1]],b=[B[0]+e*dR[0],B[1]+e*dR[1]],c=[(a[0]+b[0])/2,(a[1]+b[1])/2],r=Math.hypot(a[0]-b[0],a[1]-b[1])/2;
  const aa=Math.atan2(a[1]-c[1],a[0]-c[0]),ab=Math.atan2(b[1]-c[1],b[0]-c[0]);let d=ab-aa;
  const out=Math.atan2(dL[1]+dR[1],dL[0]+dR[0]),mid=aa+d/2;if(Math.cos(mid-out)<0)d+=d>0?-2*Math.PI:2*Math.PI;
  click.lineTo(...a);for(let i=1;i<=24;i++){const t=aa+d*i/24;click.lineTo(c[0]+r*Math.cos(t),c[1]+r*Math.sin(t));}}
 click.lineTo(327,142);click.lineTo(309,134);click.lineTo(316,109);click.quadraticCurveTo(307,72,270,63);click.lineTo(229,62);click.quadraticCurveTo(202,52,212,18);
 const pawlLocal=p=>local(p).map((x,i)=>x-f.pawlPivot[i]);
 add('click',plate(clip.difference(poly(click.getPoints(48).map(p=>pawlLocal(p.toArray()))),poly(circle([0,0],.184,96))),-.12,.12),'pawl',PALETTE.brass);blocks.pawl.position.set(...f.pawlPivot,0);
 const pin=add('clickPin',disk(.18,-.16,.24,96),'carrier',PALETTE.ink);pin.position.set(...f.pawlPivot,0);
 const face=add('clickPinFace',disk(.18,.44,.49,96),'carrier',PALETTE.ink);face.position.set(...f.pawlPivot,0);
 // Brown breaks the rod off above the plate. It ends plainly in a round end
 // concentric with the ideal top pin; no eye or crosshead is drawn.
 const rodShape=clip.difference(clip.union(poly(circle([0,0],.40,96)),poly([[-.15,0],[.15,0],[.15,f.rodLength],[-.15,f.rodLength]]),poly(circle([0,f.rodLength],.15,96))),poly(circle([0,0],.224,96)));
 add('rod',plate(rodShape,.50,.70),'rod',PALETTE.driver);blocks.rod.position.set(...f.crank,0);
 const crank=add('crankPin',disk(.22,.44,.75,96),'carrier',PALETTE.ink);crank.position.set(...f.crank,0);
 const place=(name,geometry,family,xy,color=PALETTE.ink)=>{const m=add(name,geometry,family,color);m.position.set(...xy,0);return m;};
 add('elbowSleeve',ring(.424,.65,.184,.24,128),'carrier',PALETTE.driver);
 place('pawlRearRetainer',ring(.18,.22,-.16,-.124,96),'carrier',f.pawlPivot);
 place('pawlFrontWasher',ring(.18,.22,.124,.24,96),'carrier',f.pawlPivot);
 place('rodLowerRetainer',ring(.22,.26,.704,.75,96),'carrier',f.crank);
 const rectangle=(x0,x1,y0,y1)=>poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
 add('inputCrosshead',plate(rectangle(-.32,.32,-.16,.16),.16,.46),'slider',PALETTE.driver);
 // The crosshead is the native slide's mass only; the bake leaves it out and
 // the ideal pin constraint joins it to the rod's plain end.
 blocks.slider.position.set(...f.rodEnd,0);
 add('outputBearing',ring(.424,.62,-.72,-.52,128),'fixed',PALETTE.frame);
 add('outputBearingPost',plate(rectangle(-.12,.12,-2.40,-.50),-.82,-.72),'fixed',PALETTE.frame);
 add('base',plate(rectangle(-2.25,3.15,-2.52,-2.40),-.86,-.60),'fixed',PALETTE.frame);
 add('guidePost',plate(rectangle(2.92,3.06,-2.40,4.05),-.82,-.68),'fixed',PALETTE.frame);
 add('guideBackArm',plate(rectangle(2.08,3.06,3.32,3.48),-.82,-.68),'fixed',PALETTE.frame);
 for(const x of [f.rodEnd[0]-.374,f.rodEnd[0]+.374]){
  add('guideRail'+x,plate(rectangle(x-.05,x+.05,2.65,4.05),.156,.46),'fixed',PALETTE.frame);
  place('guideStandoff'+x,disk(.045,-.68,.156,64),'fixed',[x,3.40],PALETTE.frame);
 }
 add('guideBack',plate(rectangle(f.rodEnd[0]-.424,f.rodEnd[0]+.424,2.65,4.05),.12,.156),'fixed',PALETTE.frame);
 if(side==='left')parts.click.geometry.applyMatrix4(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(...f.pawlPivot,0).normalize(),Math.PI));
 for(const name of ['cog','click']){const {cells:pieces,...description}=segmentClampContactCells(parts[name].geometry,collisionTolerance);cells[name]=pieces;contactApproximation[name]=description;}
 // The inner engraved circle is a surface marking, not a tooth root or mass.
 const engraving=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:192},(_,i)=>{const a=2*Math.PI*i/192;return new THREE.Vector3(1.52*Math.cos(a),1.52*Math.sin(a),.162);})),new THREE.LineBasicMaterial({color:PALETTE.ink,fog:false}));
 engraving.name='engraved-wheel-circle';blocks.output.add(engraving);
 Object.assign(root.userData,{profile:f,parts,families,blocks,cells,contactApproximation,hideGround:true});
 markShadows(root);root.updateMatrixWorld(true);return{root,focus:new THREE.Vector3(.5,.7,0),cameraDirection:new THREE.Vector3(.02,.03,15),dispose:()=>disposeObject3D(root)};
}
