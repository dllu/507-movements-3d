import * as THREE from 'three';
import source from './source.js';
import {roundedRackGear} from '../coaxial-gear-geometry.js';
import {plate,poly,circle,ring,disk,capsule,polygonClipping as clip} from '../finite-plate-geometry.js';
import {segmentClampContactCells} from '../mujoco-segment-clamp/contact.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};

export function makeVariableTraverseGeometry({upperTeeth=29,lowerTeeth=23,crankScale=.85,upperShift=-.5,addendum=.8,dedendum=1.5,upperPhase=.1286428026254441,samples=96,cutterSteps=2048,collisionTolerance=.0005}={}){
 if(![upperTeeth,lowerTeeth,samples,cutterSteps].every(Number.isInteger)||Math.min(upperTeeth,lowerTeeth)<8||samples<32||cutterSteps<128||![upperShift,upperPhase].every(Number.isFinite)||![addendum,dedendum,crankScale].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(collisionTolerance)||collisionTolerance<0)throw new RangeError('Invalid 122 geometry options');
 const root=new THREE.Group(),blocks={},parts={},families={},cells={},contactApproximation={},contactJobs=[];
 const bounds0=new THREE.Box3(new THREE.Vector3(-2.3,-2.35,-.2),new THREE.Vector3(3.05,2.15,.95));
 const local=([x,y])=>[(x-source.axis[0])/100,(source.axis[1]-y)/100],sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const axes={upper:[160.56672913119453,194.3319731183004],lower:[202.64896397653337,388.7828992944972]};
 const centers=Object.fromEntries(Object.entries(axes).map(([n,p])=>[n,local(p)]));
 const crankPixels=Object.fromEntries(['upper','lower'].map(n=>[n,axes[n].map((v,i)=>v+crankScale*(source.circles[n+'Crank'].center[i]-v))]));
 const position={upper:centers.upper,lower:centers.lower,upperRod:local(crankPixels.upper),lowerRod:local(crankPixels.lower),floating:local(source.circles.centerPin.center),slider:local(source.circles.centerPin.center)};
 const distance=Math.hypot(...sub(centers.lower,centers.upper)),lineAngle=Math.atan2(centers.lower[1]-centers.upper[1],centers.lower[0]-centers.upper[0]),module=2*distance/(upperTeeth+lowerTeeth);
 const lowerPhase=((upperTeeth+lowerTeeth)*lineAngle+lowerTeeth*Math.PI-upperTeeth*upperPhase-Math.PI)/lowerTeeth;
 const f={source,axes,crankScale,crankPixels,centers,position,distance,lineAngle,module,upperTeeth,lowerTeeth,upperShift,lowerShift:-upperShift,upperPhase,lowerPhase,addendum,dedendum,samples,cutterSteps,ratio:lowerTeeth/upperTeeth,slideDirection:new THREE.Vector2(136,29).normalize().toArray()};
 for(const n of Object.keys(position)){blocks[n]=new THREE.Group();blocks[n].position.set(...position[n],0);root.add(blocks[n]);}
 const add=(name,g,family,color)=>{const mesh=new THREE.Mesh(g,matte(color,{metalness:.15,roughness:.6}));mesh.name=name;blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;};
 const translated=(g,p)=>g.translate(p[0],p[1],0);
 for(const[n,teeth,phase,shift,color]of [['upper',upperTeeth,upperPhase,upperShift,PALETTE.driven],['lower',lowerTeeth,lowerPhase,-upperShift,PALETTE.driver]]){
  const shaft=source.circles[n+'Shaft'].radius/100,hub=source.circles[n+'Hub'].radius/100;
  const g=roundedRackGear({teeth,module,depth:.2,boreRadius:shaft,addendum,dedendum,profileShift:shift,tipRadius:.12*module,samples,cutterSteps});g.rotateZ(phase);g.translate(0,0,.1);
  add(n+'Gear',g,n,color);add(n+'Hub',ring(shaft,hub,.2,.25,128),n,color);add(n+'Shaft',disk(shaft,-.12,.25,128),n,PALETTE.ink);
  f[n+'Crank']=sub(position[n+'Rod'],position[n]);
  add(n+'CrankPin',translated(disk(source.circles[n+'Crank'].radius/100,.2,.47,96),f[n+'Crank']),n,PALETTE.ink);
  {const geometry=parts[n+'Gear'].geometry;contactJobs.push(()=>{const approximation=segmentClampContactCells(geometry,collisionTolerance);cells[n+'Gear']=approximation.cells;const{cells:_,...description}=approximation;contactApproximation[n+'Gear']=description;});}
 }
 for(const[n,endName,edgeOffsets,color]of [['upper','topPin',[-11.21928728485604,6.211138615054426],PALETTE.driven],['lower','bottomPin',[-8.027507908385223,10.115785413830794],PALETTE.driver]]){
  const a=crankPixels[n],b=source.circles[endName].center,d=sub(b,a),L=Math.hypot(...d),normal=[-d[1]/L,d[0]/L],toLocal=p=>sub(local(p),position[n+'Rod']);
  const quad=[...edgeOffsets.map(t=>a.map((v,i)=>v+t*normal[i])),...[...edgeOffsets].reverse().map(t=>b.map((v,i)=>v+t*normal[i]))];
  const far=toLocal(b),eye=source.circles[n+'Eye'].radius/100,endRadius=source.circles[endName==='topPin'?'topEye':'bottomEye'].radius/100;
  f[n+'RodEnd']=far;f[n+'RodLength']=L/100;
  const shape=clip.difference(clip.union(poly(quad.map(toLocal)),poly(circle([0,0],eye,128)),poly(circle(far,endRadius,128))),poly(circle([0,0],source.circles[n+'Crank'].radius/100+.0015,96)),poly(circle(far,source.circles[endName].radius/100+.0015,96)));
  // p96: steel-grey rods read apart from the gear face they cross.
  add(n+'Rod',plate(shape,.26,.38),n+'Rod',PALETTE.muted);
  add(n+'RodEye',ring(source.circles[n+'Crank'].radius/100+.0015,eye,.38,.42,128),n+'Rod',PALETTE.muted);
 }
 // The vertical link is a straight bar of uniform width whose round ends are
 // concentric with its two pins (radius of the drawn pin eyes).
 const floatingLocal=p=>sub(local(p),position.floating);
 const pins=['topPin','bottomPin'],linkRadius=Math.max(source.circles.topEye.radius,source.circles.bottomEye.radius)/100;
 const shape=clip.difference(capsule(...pins.map(n=>floatingLocal(source.circles[n].center)),linkRadius,64),...pins.map(n=>poly(circle(floatingLocal(source.circles[n].center),source.circles[n].radius/100+.0015,96))));
 add('floatingLink',plate(shape,.44,.6),'floating',PALETTE.brass);
 for(const n of pins){const p=floatingLocal(source.circles[n].center);f[n]=p;add(n,translated(disk(source.circles[n].radius/100,.26,.67,96),p),'floating',PALETTE.ink);const eye=source.circles[n==='topPin'?'topEye':'bottomEye'].radius/100;add(n+'Eye',translated(ring(source.circles[n].radius/100+.0015,eye,.6,.64,128),p),'floating',PALETTE.brass);}
 const bar=new THREE.Shape();bar.moveTo(350,174);bar.bezierCurveTo(330,177,333,214,351,219);bar.lineTo(407,209);bar.lineTo(416,195);bar.lineTo(495,180);bar.bezierCurveTo(507,182,510,157,499,156);bar.lineTo(416,174);bar.lineTo(410,176);bar.lineTo(404,169);bar.closePath();
 add('outputBar',plate(clip.difference(poly(bar.getPoints(24).map(p=>floatingLocal(p.toArray()))),poly(circle([0,0],source.circles.centerPin.radius/100+.0015,128))),.66,.8),'slider',PALETTE.driven);
 add('centerPin',disk(source.circles.centerPin.radius/100,.6,.85,128),'floating',PALETTE.ink);
 // Brown breaks the output bar off at the plate edge; it ends there on its
 // own rounded end (no added guide or stand: p60 support policy).
 const bounds=bounds0.clone();
 Object.assign(root.userData,{source,profile:f,blocks,parts,families,hideGround:true,cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},shadowCameraHalfExtent:5,shadowBias:-.00002,shadowNormalBias:.002});
 // Collision cells are for the live simulation only; baked playback never
 // reads them, so they are decomposed on first use (as in 113).
 const buildContacts=()=>{for(const job of contactJobs.splice(0))job();};
 for(const [key,value] of [['cells',cells],['contactApproximation',contactApproximation]])Object.defineProperty(root.userData,key,{configurable:true,enumerable:true,get(){buildContacts();Object.defineProperty(root.userData,key,{value,writable:true,configurable:true,enumerable:true});return value;}});
 markShadows(root);root.updateMatrixWorld(true);return{root,focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(1.3,1,10)};
}
