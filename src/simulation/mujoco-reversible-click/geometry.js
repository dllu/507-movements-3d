import * as THREE from 'three';
import source from './source.js';
import {roundedRackGear} from '../coaxial-gear-geometry.js';
import {plate,poly,circle,ring,disk,polygonClipping as clip} from '../finite-plate-geometry.js';
import {segmentClampContactCells} from '../mujoco-segment-clamp/contact.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};
export function makeReversibleClickGeometry({teeth=24,module=.08944889706458971,phase=.2311197720414366,samples=96,cutterSteps=2048,collisionTolerance=.0002,toothStyle='radial',rootRadius=1.01,tipRadius=1.195,rootSamples=8}={}){
 if(!Number.isInteger(teeth)||teeth<4||!Number.isInteger(samples)||samples<32||!Number.isInteger(cutterSteps)||cutterSteps<128||!Number.isInteger(rootSamples)||rootSamples<2||![module,rootRadius,tipRadius].every(v=>Number.isFinite(v)&&v>0)||tipRadius<=rootRadius||rootRadius<=.184||!Number.isFinite(phase)||!Number.isFinite(collisionTolerance)||collisionTolerance<0)throw new RangeError('Invalid 121 geometry options');
 const root=new THREE.Group(),blocks={},parts={},families={},cells={},contactApproximation={};
 const local=([x,y])=>[(x-source.axis[0])/100,(source.axis[1]-y)/100],f={source,axis:source.axis,teeth,module,phase,pitch:2*Math.PI/teeth,pawlPivot:local(source.circles.pawlPin.center),crank:local(source.circles.crankPin.center),rodEnd:local([410,75]),samples,cutterSteps};
 for(const name of ['carrier','output','pawl','rod']){blocks[name]=new THREE.Group();root.add(blocks[name]);}
 const add=(name,g,family,color)=>{const mesh=new THREE.Mesh(g,matte(color,{metalness:.15,roughness:.6}));mesh.name=name;blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;};
 add('carrierDisk',ring(.185,source.circles.disk.radius/100,-.22,-.06,256),'carrier',PALETTE.driver);
 let gear;
 if(toothStyle==='involute'){gear=roundedRackGear({teeth,module,depth:.2,boreRadius:.1832176,addendum:.8,dedendum:1,tipRadius:.12*module,samples,cutterSteps});gear.rotateZ(phase);gear.translate(0,0,.1);}
 // A reversible cog is contacted by a click, not a mating gear.
 // The near-radial faces let either end lock instead of camming outward.
 else if(toothStyle==='radial'){
  const points=[],point=(r,a)=>[r*Math.cos(a),r*Math.sin(a)];
  for(let i=0;i<teeth;i++){const a=phase+i*f.pitch;points.push(point(rootRadius,a-.26*f.pitch),point(tipRadius,a-.24*f.pitch),point(tipRadius,a+.24*f.pitch),point(rootRadius,a+.26*f.pitch));for(let j=1;j<rootSamples;j++)points.push(point(rootRadius,a+(.26+.48*j/rootSamples)*f.pitch));}
  gear=plate(clip.difference(poly(points),poly(circle([0,0],.1832176,128))),0,.2);
 }else throw new RangeError('Unknown click cog profile');
 Object.assign(f,{toothStyle,rootRadius,tipRadius,rootSamples});add('cog',gear,'output',PALETTE.driven);
 add('hub',ring(.1832176,source.circles.hub.radius/100,.2,.28,128),'output',PALETTE.driven);
 add('hubRing',ring(.1832176,source.circles.hubRing.radius/100,.28,.34,128),'output',PALETTE.frame);
 add('shaft',disk(.1832176,-.3,.39,128),'output',PALETTE.ink);
 const path=new THREE.Shape();path.moveTo(221,112);path.bezierCurveTo(234,104,248,120,262,124);path.bezierCurveTo(286,132,304,118,310,101);path.lineTo(320,102);path.lineTo(305,179);path.quadraticCurveTo(304.5,181,303,181);path.lineTo(298,181);path.quadraticCurveTo(296,181,296,179);path.bezierCurveTo(300,158,286,147,268,147);path.bezierCurveTo(249,145,241,160,226,155);path.bezierCurveTo(211,151,205,135,210,122);path.quadraticCurveTo(213,115,221,112);
 const pawlLocal=p=>{const q=local(p);return q.map((v,i)=>v-f.pawlPivot[i]);};
 const pawlShape=clip.difference(poly(path.getPoints(24).map(p=>pawlLocal(p.toArray()))),poly(circle([0,0],.112,96)));
 add('click',plate(pawlShape,0,.18),'pawl',PALETTE.brass);blocks.pawl.position.set(...f.pawlPivot,0);
 const pin=add('clickPin',disk(.1107,-.06,.24,96),'carrier',PALETTE.ink);pin.position.set(...f.pawlPivot,0);
 const rodLocal=p=>{const q=local(p);return q.map((v,i)=>v-f.crank[i]);};
 const rodShape=clip.difference(clip.union(poly(circle([0,0],source.circles.rodEye.radius/100,128)),poly([[378,256],[422,259],[418,312],[374,309]].map(rodLocal)),poly([[386,257],[398,75],[405,72],[422,81],[411,259]].map(rodLocal))),poly(circle([0,0],.118,96)));
 add('rod',plate(rodShape,.24,.30),'rod',PALETTE.driver);add('rodEye',ring(.118,source.circles.rodEye.radius/100,.30,.44,128),'rod',PALETTE.driver);blocks.rod.position.set(...f.crank,0);
 const crank=add('crankPin',disk(.11597,-.06,.47,96),'carrier',PALETTE.ink);crank.position.set(...f.crank,0);
 for(const name of ['cog','click']){const {cells:pieces,...description}=segmentClampContactCells(parts[name].geometry,collisionTolerance);cells[name]=pieces;contactApproximation[name]=description;}
 f.rodVector=f.rodEnd.map((v,i)=>v-f.crank[i]);f.rodLength=Math.hypot(...f.rodVector);f.pawlFlip=3.3;
 const bounds=new THREE.Box3(new THREE.Vector3(-2.1,-2.1,-.4),new THREE.Vector3(2.1,2.16,.6));
 Object.assign(root.userData,{source,profile:f,parts,families,blocks,cells,contactApproximation,hideGround:true,cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},shadowCameraHalfExtent:4,shadowBias:-.00002,shadowNormalBias:.002});
 markShadows(root);root.updateMatrixWorld(true);return{root,focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(1.3,1,10)};
}
