import * as THREE from 'three';
import {makeGear,makeBeam,matte,PALETTE,markShadows} from './primitives.js';
import {footPillar,supportMaterial} from './back-plate-support.js';
import {glandCylinder} from './beyond-crop-hardware.js';

// One world unit is 100 engraving pixels. The irregular drawing is regularized
// to an 18-tooth, 20-degree involute pinion and its conjugate straight racks.
export const pumpRackDimensions=Object.freeze({radius:.855,teeth:18,addendum:.095,dedendum:.12,
 rackLength:3.56,rightRackLength:3.72,rackWidth:.34,depth:.18,period:4,amplitude:Math.PI/3,
 leftY:.34,rightY:-.66,leverAngle:Math.atan2(-211,470),leverHalfLength:2.576});

export function makeOpposedPumpRacks(){
 const d=pumpRackDimensions,root=new THREE.Group(),pitch=2*Math.PI*d.radius/d.teeth;
 const pinion=makeGear({radius:d.radius,teeth:d.teeth,addendum:d.addendum,dedendum:d.dedendum,
  depth:d.depth,chamfer:.004,color:PALETTE.driver});
 const rotor=pinion.userData.rotor,body=rotor.children[0];
 // Preserve the four pierced, curved spokes, rather than a decorative solid disc.
 const shape=body.geometry.parameters.shapes;
 for(let i=0;i<4;i++){
  const hole=new THREE.Path(),a=i*Math.PI/2;
  const p=(x,y)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
  hole.moveTo(...p(.07,.56));
  hole.bezierCurveTo(...p(.08,.19),...p(.19,.08),...p(.56,.07));
  hole.absarc(0,0,Math.hypot(.56,.07),a+Math.atan2(.07,.56),a+Math.atan2(.56,.07),false);
  hole.closePath();shape.holes.push(hole);
 }
 body.geometry.dispose();body.geometry=new THREE.ExtrudeGeometry(shape,{depth:d.depth,bevelEnabled:false,curveSegments:24});
 body.geometry.translate(0,0,-d.depth/2);
 // Generic face indices and decorative torus are absent from the engraving.
 rotor.children.slice(2).forEach(o=>{o.visible=false;});
 // Brown hides the lever behind the pinion and racks: its two arms are
 // seated on the back face of the pinion rim, so nothing crosses the pierced
 // web, and they emerge beyond the racks.
 const leverGroup=new THREE.Group();leverGroup.rotation.z=d.leverAngle;
 for(const sign of [-1,1]){
  const arm=makeBeam(new THREE.Vector3(sign*.6,0,-.145),new THREE.Vector3(sign*d.leverHalfLength,0,-.145),
   {color:PALETTE.driver,depth:.10,thickness:.12});
  const knob=new THREE.Mesh(new THREE.SphereGeometry(.13,24,16),matte(PALETTE.ink));
  knob.position.set(sign*d.leverHalfLength,0,-.23);leverGroup.add(arm,knob);
 }
 rotor.add(leverGroup);root.add(pinion);
 const profiles=[];
 const racks=[[-1,d.leftY],[1,d.rightY]].map(([side,y])=>{
  const rack=new THREE.Group();rack.position.y=y;
  const length=side<0?d.rackLength:d.rightRackLength;
  const xRoot=d.radius+d.dedendum,xTip=d.radius-d.addendum;
  const halfRoot=pitch/4+d.dedendum*Math.tan(Math.PI/9)-.002;
  const halfTip=pitch/4-d.addendum*Math.tan(Math.PI/9)-.002;
  const points=[[xRoot+d.rackWidth,-length/2],[xRoot,-length/2]];
  for(let k=-12;k<=12;k++){
   const cy=k*pitch+pitch/2-y;
   if(cy-halfRoot< -length/2||cy+halfRoot>length/2)continue;
   points.push([xRoot,cy-halfRoot],[xTip,cy-halfTip],[xTip,cy+halfTip],[xRoot,cy+halfRoot]);
  }
  points.push([xRoot,length/2],[xRoot+d.rackWidth,length/2]);
  const profile=points.map(([x,py])=>[side*x,py]);profiles.push(profile);
  const s=new THREE.Shape(profile.map(p=>new THREE.Vector2(...p)));s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:d.depth,bevelEnabled:false,curveSegments:1});g.translate(0,0,-d.depth/2);
  const mesh=new THREE.Mesh(g,matte(PALETTE.driven));rack.add(mesh);root.add(rack);return rack;
 });
 // Brown crops both racks. Each is "attached to the piston of a pump": its
 // lower end carries a piston rod into a closed pump barrel standing on the
 // floor below the plate. The upper ends stop at Brown's drawn rack ends; no
 // guides, uprights or rear bearing are added (p60 support policy).
 const fixedParts=new THREE.Group();fixedParts.name='pumpFrame';root.add(fixedParts);
 const shaftRadius=.1;
 const shaftFront=d.depth/2+.02,shaftBack=-.3;
 const shaft=new THREE.Mesh(new THREE.CylinderGeometry(shaftRadius,shaftRadius,shaftFront-shaftBack,40).rotateX(Math.PI/2),matte(PALETTE.ink));
 shaft.position.z=(shaftFront+shaftBack)/2;shaft.name='pinionShaft';rotor.add(shaft);
 const travelDown=d.radius*d.amplitude*1.5,travelUp=d.radius*d.amplitude*.5;
 const rackX=d.radius+d.dedendum+d.rackWidth/2,barrelTops=[];
 for(const [i,side,y0,length,up,down] of [[0,-1,d.leftY,d.rackLength,travelUp,travelDown],[1,1,d.rightY,d.rightRackLength,travelDown,travelUp]]){
  const rack=racks[i],x=side*rackX,top=length/2,bottom=-length/2;
  // Piston rod into the pump barrel below.
  const lowest=y0-down+bottom,highest=y0+up+bottom,barrelTop=lowest-.12,rodLength=highest-barrelTop+.2,barrelLength=rodLength+(highest-lowest)+.25;
  const rod=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,rodLength+.02,32),matte(PALETTE.muted));
  rod.position.set(x,bottom-rodLength/2+.01,0);rod.name='pistonRod'+i;rack.add(rod);
  const barrel=glandCylinder({x,topY:barrelTop,z:0,length:barrelLength,glandRadius:.1,boreRadius:.26,outerRadius:.32,role:'pump-barrel-'+i});
  barrel.material=supportMaterial();fixedParts.add(barrel);
  fixedParts.add(footPillar({x,yTop:barrelTop-barrelLength,yFloor:barrelTop-barrelLength-.1,z:0,width:.64,footDepth:.8,role:'pump-barrel-foot-'+i}));
  barrelTops.push(barrelTop);
 }
 for(const o of fixedParts.children)o.userData.beyondPlateCrop=true;
 const stateAtTime=time=>{
  const angle=d.amplitude*(Math.sin(2*Math.PI*time/d.period-Math.PI/6)+.5);
  return {angle,leftY:d.leftY-d.radius*angle,rightY:d.rightY+d.radius*angle};
 };
 const update=time=>{const s=stateAtTime(time);rotor.rotation.z=s.angle;racks[0].position.y=s.leftY;racks[1].position.y=s.rightY;root.userData.state=s;};
 update(0);markShadows(root);
 root.traverse(o=>{if(o.material)o.material.fog=false;});
 const bounds=new THREE.Box3(new THREE.Vector3(-2.85,-3,-.4),new THREE.Vector3(2.85,3,.3));
 Object.assign(root.userData,{fidelity:'authored',mechanism:'single-oscillating-pinion-opposed-air-pump-racks',
  simulationBackend:'analytical',hideGround:true,materialsIgnoreSceneFog:true,
  cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
  animationTiming:{authoredCyclePeriod:d.period,displayCycleDuration:d.period,playbackTimeScale:1},
  blocks:{pinion,rotor,body,racks,leverGroup},geometry:{...d,pitch,rackProfiles:profiles},stateAtTime,
  reconstructionNote:'One lever drives equal and opposite racks. The engraving is regularized to matching involute teeth; depths and ideal shaft/slider constraints are reconstructed. A full back-and-forth stroke takes four seconds.'});
 return {root,update,cameraDirection:new THREE.Vector3(.3,.2,10),focus:new THREE.Vector3(0,0,0)};
}
