import * as THREE from 'three';
import source from './source.js';
import {roundedRackGear} from '../coaxial-gear-geometry.js';
import {plate,poly,circle,ring,disk,polygonClipping as clip} from '../finite-plate-geometry.js';
import {segmentClampContactCells} from '../mujoco-segment-clamp/contact.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};

export function makeCascadedTraverseGeometry({middleShift=.5,addendum=.8,dedendum=1.5,pressureAngle=Math.PI/9,leftPhase=.16147166188269907,samples=96,cutterSteps=2048,collisionTolerance=.00025}={}){
 if(![middleShift,leftPhase].every(Number.isFinite)||![addendum,dedendum,pressureAngle].every(v=>Number.isFinite(v)&&v>0)||pressureAngle>=Math.PI/3||![samples,cutterSteps].every(Number.isInteger)||samples<32||cutterSteps<128||!Number.isFinite(collisionTolerance)||collisionTolerance<0)throw new RangeError('Invalid 125 geometry options');
 const root=new THREE.Group(),blocks={},parts={},families={},cells={},contactApproximation={},contactJobs=[];
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
 // p96: the connecting rods are steel grey, so a rod crossing the face of
 // its own gear still reads apart from the crank (they shared its colour).
 const rodColor=PALETTE.muted;
 for(const n of ['left','middle','right']){
  const shaft=source.circles[n+'Shaft'].radius/100,hub=source.circles[n+'Hub'].radius/100;
  const g=roundedRackGear({teeth:teeth[n],module,depth:.18,boreRadius:shaft,addendum,dedendum,profileShift:n==='middle'?middleShift:-middleShift,pressureAngle,tipRadius:tipRadius*module,samples,cutterSteps});g.rotateZ(phases[n]);g.translate(0,0,-.09);
  add(n+'Gear',g,n,colors[n]);add(n+'Hub',ring(shaft,hub,0,.05,128),n,colors[n]);add(n+'Shaft',disk(shaft,-.30,.07,128),n,PALETTE.ink);
  f.cranks[n]=sub(position[n+'Rod'],position[n]);add(n+'CrankPin',translated(disk(source.circles[n+'Crank'].radius/100,0,n==='left'?.60:.27,96),f.cranks[n]),n,PALETTE.ink);
  {const geometry=g;contactJobs.push(()=>{const approximation=segmentClampContactCells(geometry,collisionTolerance);cells[n+'Gear']=approximation.cells;const{cells:_,...description}=approximation;contactApproximation[n+'Gear']=description;});}
 }
 for(const[n,definition]of Object.entries(source.rods)){
  const{from,to,edgeOffsets}=definition,a=source.circles[from].center,b=source.circles[to].center,d=sub(b,a),L=Math.hypot(...d),normal=[-d[1]/L,d[0]/L],toLocal=p=>sub(local(p),position[n]);
  const quad=[...edgeOffsets.map(t=>a.map((v,i)=>v+t*normal[i])),...[...edgeOffsets].reverse().map(t=>b.map((v,i)=>v+t*normal[i]))],far=toLocal(b),eye=source.circles[n==='transferRod'?'lowerCenterEye':n.replace('Rod','Eye')].radius/100;
  const z=n==='leftRod'||n==='transferRod'?.44:.08,endRadius=source.circles[to].radius/100+.045;
  const shape=clip.difference(clip.union(poly(quad.map(toLocal)),poly(circle([0,0],eye,128)),poly(circle(far,endRadius,128))),poly(circle([0,0],source.circles[from].radius/100+.0015,96)),poly(circle(far,source.circles[to].radius/100+.0015,96)));
  add(n,plate(shape,z,z+.10),n,rodColor);add(n+'Eye',ring(source.circles[from].radius/100+.0015,eye,z+.10,z+.14,128),n,rodColor);f.rodEnds[n]=far;
 }
 // p98: each floating bar is two end arcs concentric with its end pins
 // (radius linkEnd) joined by symmetric cubic bows, G1 with the arcs; the
 // bows' sags (source px) follow Brown's slightly lens-shaped bars and keep
 // the raised centre pin inside. The traced outlines put the pins inboard of
 // the rounded ends.
 const linkEnd={lower:12.5,upper:13},linkSag={lower:[3,6],upper:[7,8]};
 const linkOutline=(n)=>{
  const L=source.circles[n+'LeftPin'].center,R=source.circles[n+'RightPin'].center,re=linkEnd[n],d=sub(R,L),D=Math.hypot(...d),u=[d[0]/D,d[1]/D],down=[-u[1],u[0]],k=D/3;
  const at=(c,m,a,b,r)=>[c[0]+r*(m[0]*a+u[0]*b),c[1]+r*(m[1]*a+u[1]*b)];
  const bow=(m,sag)=>{let lo=0,hi=1.2;for(let i=0;i<60;i++){const x=(lo+hi)/2;(re*(Math.cos(x)-1)+.75*k*Math.sin(x)<sag?lo=x:hi=x);}const x=(lo+hi)/2,c=Math.cos(x),s=Math.sin(x);
   const p0=at(L,m,c,-s,re),p3=at(R,m,c,s,re),c1=[p0[0]+k*(u[0]*c+m[0]*s),p0[1]+k*(u[1]*c+m[1]*s)],c2=[p3[0]-k*(u[0]*c-m[0]*s),p3[1]-k*(u[1]*c-m[1]*s)];
   return{x,points:Array.from({length:49},(_,i)=>{const t=i/48,a=(1-t)**3,b=3*(1-t)**2*t,e=3*(1-t)*t*t,g=t**3;return[a*p0[0]+b*c1[0]+e*c2[0]+g*p3[0],a*p0[1]+b*c1[1]+e*c2[1]+g*p3[1]];})};};
  const up=[-down[0],-down[1]],top=bow(up,linkSag[n][0]),bottom=bow(down,linkSag[n][1]),base=Math.atan2(u[1],u[0]);
  const arc=(c,from,to)=>Array.from({length:47},(_,i)=>{const a=from+(to-from)*(i+1)/48;return[c[0]+re*Math.cos(a),c[1]+re*Math.sin(a)];});
  // Source y points down, so 'down' is base+pi/2 and 'up' is base-pi/2.
  return[...top.points,...arc(R,base-Math.PI/2+top.x,base+Math.PI/2-bottom.x),...[...bottom.points].reverse(),...arc(L,base+Math.PI/2+bottom.x,base+3*Math.PI/2-top.x)];
 };
 for(const n of ['lower','upper']){
  const toLocal=p=>sub(local(p),position[n]),z=n==='lower'?.24:.64,pins=['LeftPin','RightPin','CenterPin'];
  const shape=clip.difference(poly(linkOutline(n).map(toLocal)),...pins.map(p=>poly(circle(toLocal(source.circles[n+p].center),source.circles[n+p].radius/100,96))));
  add(n+'Link',plate(shape,z,z+.10),n,PALETTE.brass);
  for(const p of pins){const name=n+p,point=toLocal(source.circles[name].center),center=p==='CenterPin';f.linkPins[name]=point;add(name,translated(disk(source.circles[name].radius/100,center?z:n==='lower'?.08:.44,center?z+.36:z+.16,96),point),n,PALETTE.ink);}
 }
 const stem=new THREE.Shape();stem.moveTo(178,15);stem.bezierCurveTo(178,9,195,8,195,15);stem.lineTo(195,50);stem.lineTo(194,55);stem.lineTo(201,63);stem.lineTo(202,91);stem.lineTo(169,91);stem.lineTo(170,61);stem.lineTo(178,56);stem.closePath();
 const stemShape=clip.difference(clip.union(poly(stem.getPoints(24).map(p=>sub(local(p.toArray()),position.slider))),poly(circle([0,0],source.circles.upperCenterEye.radius/100,128))),poly(circle([0,0],source.circles.upperCenterPin.radius/100+.0015,128)));
 add('outputStem',plate(stemShape,.84,.94),'slider',PALETTE.driven);
 add('outputEye',ring(source.circles.upperCenterPin.radius/100+.0015,source.circles.upperCenterEye.radius/100,.94,.98,128),'slider',PALETTE.driven);
 const bounds=new THREE.Box3(new THREE.Vector3(-2.55,-2.2,-.4),new THREE.Vector3(2.3,2.9,1.1));
 Object.assign(root.userData,{source,profile:f,blocks,parts,families,hideGround:true,cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},shadowCameraHalfExtent:5,shadowBias:-.00002,shadowNormalBias:.002});
 // Collision cells are for the live simulation only; baked playback never
 // reads them, so they are decomposed on first use (as in 113).
 const buildContacts=()=>{for(const job of contactJobs.splice(0))job();};
 for(const [key,value] of [['cells',cells],['contactApproximation',contactApproximation]])Object.defineProperty(root.userData,key,{configurable:true,enumerable:true,get(){buildContacts();Object.defineProperty(root.userData,key,{value,writable:true,configurable:true,enumerable:true});return value;}});
 markShadows(root);root.updateMatrixWorld(true);return{root,focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(1.3,1,10)};
}
