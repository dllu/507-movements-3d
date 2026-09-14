import * as THREE from 'three';
import source from './source.js';
import {roundedRackGear} from '../coaxial-gear-geometry.js';
import {plate,poly,circle,ring,disk,polygonClipping as clip} from '../finite-plate-geometry.js';
import {segmentClampContactCells} from '../mujoco-segment-clamp/contact.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};

export function makeCascadedTraverseGeometry({middleShift=.5,addendum=.8,dedendum=1.5,pressureAngle=Math.PI/9,leftPhase=.16147166188269907,samples=96,cutterSteps=2048,collisionTolerance=.00025}={}){
 if(![middleShift,leftPhase].every(Number.isFinite)||![addendum,dedendum,pressureAngle].every(v=>Number.isFinite(v)&&v>0)||pressureAngle>=Math.PI/3||![samples,cutterSteps].every(Number.isInteger)||samples<32||cutterSteps<128||!Number.isFinite(collisionTolerance)||collisionTolerance<0)throw new RangeError('Invalid 125 geometry options');
 const root=new THREE.Group(),blocks={},parts={},families={},cells={},contactApproximation={};
 const local=([x,y])=>[(x-source.axis[0])/100,(source.axis[1]-y)/100],sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const axes={left:[87.67301051966052,379.85778481743716],middle:[220.2617468223709,380.152333309462],right:[384.4100674329652,378.38002688530923]},teeth={left:19,middle:23,right:29};
 const centers=Object.fromEntries(Object.entries(axes).map(([n,p])=>[n,local(p)]));
 const position={...centers,...Object.fromEntries(['left','middle','right'].map(n=>[n+'Rod',local(source.circles[n+'Crank'].center)])),lower:local(source.circles.lowerCenterPin.center),transferRod:local(source.circles.lowerCenterPin.center),upper:local(source.circles.upperCenterPin.center),slider:local(source.circles.upperCenterPin.center)};
 const d1=sub(centers.middle,centers.left),d2=sub(centers.right,centers.middle),module=2*Math.hypot(...d1)/(teeth.left+teeth.middle),a1=Math.atan2(d1[1],d1[0]),a2=Math.atan2(d2[1],d2[0]);
 const phases={left:leftPhase};phases.middle=((teeth.left+teeth.middle)*a1+teeth.middle*Math.PI-teeth.left*phases.left-Math.PI)/teeth.middle;phases.right=((teeth.middle+teeth.right)*a2+teeth.right*Math.PI-teeth.middle*phases.middle-Math.PI)/teeth.right;
 const bottomHalf=Math.PI/4-dedendum*Math.tan(pressureAngle),tipRadius=Math.min(.12,.9*bottomHalf/(1/Math.cos(pressureAngle)-Math.tan(pressureAngle)));if(tipRadius<=0)throw new RangeError('125 cutter tips overlap');
 const f={source,axes,centers,teeth,phases,module,position,middleShift,addendum,dedendum,pressureAngle,tipRadius,samples,cutterSteps,cranks:{},rodEnds:{},linkPins:{}};
 for(const[n,p]of Object.entries(position)){blocks[n]=new THREE.Group();blocks[n].position.set(...p,0);root.add(blocks[n]);}
 const add=(name,g,family,color)=>{const mesh=new THREE.Mesh(g,matte(color,{metalness:.15,roughness:.6}));mesh.name=name;blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;},translated=(g,p)=>g.translate(...p,0);
 const colors={left:PALETTE.driven,middle:PALETTE.brass,right:PALETTE.driver,transfer:PALETTE.driven};
 for(const n of ['left','middle','right']){
  const shaft=source.circles[n+'Shaft'].radius/100,hub=source.circles[n+'Hub'].radius/100;
  const g=roundedRackGear({teeth:teeth[n],module,depth:.18,boreRadius:shaft,addendum,dedendum,profileShift:n==='middle'?middleShift:-middleShift,pressureAngle,tipRadius:tipRadius*module,samples,cutterSteps});g.rotateZ(phases[n]);g.translate(0,0,-.09);
  add(n+'Gear',g,n,colors[n]);add(n+'Hub',ring(shaft,hub,0,.05,128),n,colors[n]);add(n+'Shaft',disk(shaft,-.30,.07,128),n,PALETTE.ink);
  f.cranks[n]=sub(position[n+'Rod'],position[n]);add(n+'CrankPin',translated(disk(source.circles[n+'Crank'].radius/100,0,n==='left'?.60:.27,96),f.cranks[n]),n,PALETTE.ink);
  const approximation=segmentClampContactCells(g,collisionTolerance);cells[n+'Gear']=approximation.cells;const{cells:_,...description}=approximation;contactApproximation[n+'Gear']=description;
 }
 for(const[n,definition]of Object.entries(source.rods)){
  const{from,to,edgeOffsets}=definition,a=source.circles[from].center,b=source.circles[to].center,d=sub(b,a),L=Math.hypot(...d),normal=[-d[1]/L,d[0]/L],toLocal=p=>sub(local(p),position[n]);
  const quad=[...edgeOffsets.map(t=>a.map((v,i)=>v+t*normal[i])),...[...edgeOffsets].reverse().map(t=>b.map((v,i)=>v+t*normal[i]))],far=toLocal(b),eye=source.circles[n==='transferRod'?'lowerCenterEye':n.replace('Rod','Eye')].radius/100;
  const z=n==='leftRod'||n==='transferRod'?.44:.08,endRadius=source.circles[to].radius/100+.045;
  const shape=clip.difference(clip.union(poly(quad.map(toLocal)),poly(circle([0,0],eye,128)),poly(circle(far,endRadius,128))),poly(circle([0,0],source.circles[from].radius/100+.0015,96)),poly(circle(far,source.circles[to].radius/100+.0015,96)));
  add(n,plate(shape,z,z+.10),n,colors[n.replace('Rod','')]);add(n+'Eye',ring(source.circles[from].radius/100+.0015,eye,z+.10,z+.14,128),n,colors[n.replace('Rod','')]);f.rodEnds[n]=far;
 }
 const paths={lower:new THREE.Shape(),upper:new THREE.Shape()},lo=paths.lower,hi=paths.upper;
 lo.moveTo(205,201);lo.bezierCurveTo(203,194,208,189,216,188);lo.bezierCurveTo(251,180,306,186,338,192);lo.bezierCurveTo(356,192,356,214,338,216);lo.bezierCurveTo(299,220,248,219,216,214);lo.bezierCurveTo(208,214,204,210,205,201);
 hi.moveTo(95,96);hi.bezierCurveTo(94,87,100,84,108,83);hi.bezierCurveTo(148,78,205,77,270,92);hi.bezierCurveTo(284,94,289,111,275,114);hi.bezierCurveTo(235,118.688208,156,111.112932,109,110);hi.bezierCurveTo(99,109,96,104,95,96);
 for(const n of ['lower','upper']){
  const toLocal=p=>sub(local(p),position[n]),z=n==='lower'?.24:.64,pins=['LeftPin','RightPin','CenterPin'];
  const shape=clip.difference(poly(paths[n].getPoints(32).map(p=>toLocal(p.toArray()))),...pins.map(p=>poly(circle(toLocal(source.circles[n+p].center),source.circles[n+p].radius/100,96))));
  add(n+'Link',plate(shape,z,z+.10),n,PALETTE.brass);
  for(const p of pins){const name=n+p,point=toLocal(source.circles[name].center),center=p==='CenterPin';f.linkPins[name]=point;add(name,translated(disk(source.circles[name].radius/100,center?z:n==='lower'?.08:.44,center?z+.36:z+.16,96),point),n,PALETTE.ink);}
 }
 const stem=new THREE.Shape();stem.moveTo(178,15);stem.bezierCurveTo(178,9,195,8,195,15);stem.lineTo(195,50);stem.lineTo(194,55);stem.lineTo(201,63);stem.lineTo(202,91);stem.lineTo(169,91);stem.lineTo(170,61);stem.lineTo(178,56);stem.closePath();
 const stemShape=clip.difference(clip.union(poly(stem.getPoints(24).map(p=>sub(local(p.toArray()),position.slider))),poly(circle([0,0],source.circles.upperCenterEye.radius/100,128))),poly(circle([0,0],source.circles.upperCenterPin.radius/100+.0015,128)));
 add('outputStem',plate(stemShape,.84,.94),'slider',PALETTE.driven);
 add('outputEye',ring(source.circles.upperCenterPin.radius/100+.0015,source.circles.upperCenterEye.radius/100,.94,.98,128),'slider',PALETTE.driven);
 const bounds=new THREE.Box3(new THREE.Vector3(-2.55,-2.2,-.4),new THREE.Vector3(2.3,2.9,1.1));
 Object.assign(root.userData,{source,profile:f,blocks,parts,families,cells,contactApproximation,hideGround:true,cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},shadowCameraHalfExtent:5,shadowBias:-.00002,shadowNormalBias:.002});
 markShadows(root);root.updateMatrixWorld(true);return{root,focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(1.3,1,10)};
}
