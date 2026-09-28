import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { plate, poly, circle, polygonClipping } from './finite-plate-geometry.js';
const tube=(r,b,h)=>boredLatheGeometry([{radial:r,axial:-h/2},{radial:r,axial:h/2}],b,64);
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
const add=(parent,geometry,material,role,position)=>{const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.role=role;if(position)mesh.position.copy(position);parent.add(mesh);return mesh;};
export function throstleYarnCurve(frontNip,topGuide,origin,angle,eye,contact){
 const rotate=p=>new THREE.Vector3(...p).applyAxisAngle(new THREE.Vector3(0,1,0),angle).add(origin);
 return new THREE.CatmullRomCurve3([
  frontNip.clone(),new THREE.Vector3(.75,2.4,0),new THREE.Vector3(.80,1.65,0),
  new THREE.Vector3(topGuide.x,1.34,0),topGuide.clone(),
  rotate([0,1.37,0]),rotate([.22,1.37,0]),rotate([.43,1.20,.18]),
  rotate([.83,.80,.18]),rotate([.86,-.40,.18]),rotate([.74,-.58,.15]),eye,
  rotate([.72,-.52,-.13]),contact,
 ],false,'centripetal');
}
export function fanAirflowCurve(side,lane){
 const start=-Math.PI/4+lane*.16-Math.PI*2,points=[];
 for(const z of[2.05,.85,.2])points.push(new THREE.Vector3(Math.cos(start)*.82,Math.sin(start)*.82,side*z));
 for(let i=0;i<=32;i++){
  const angle=THREE.MathUtils.lerp(start,-Math.PI/2,i/32),radius=THREE.MathUtils.lerp(.82,2.7,i/32);
  points.push(new THREE.Vector3(Math.cos(angle)*radius,Math.sin(angle)*radius,side*.08));
 }
 points.push(new THREE.Vector3(3.18,-2.62+lane*.08,side*.08),new THREE.Vector3(4.98,-2.62+lane*.08,side*.08));
 const curve=new THREE.CatmullRomCurve3(points,false,'centripetal');curve.arcLengthDivisions=4096;curve.updateArcLengths();return curve;
}
function fanWall(shape,depth){
 const points=shape.getPoints(32);if(points[0].distanceTo(points.at(-1))<1e-6)points.pop();
 const sides=[[],[]];
 for(let i=0;i<points.length;i++){
  const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],d=b.clone().sub(a).normalize(),n=new THREE.Vector2(-d.y,d.x).multiplyScalar(.07);
  sides[0].push(points[i].clone().add(n).toArray());sides[1].push(points[i].clone().sub(n).toArray());
 }
 return plate(poly([...sides[0],...sides[1].reverse()]),-depth/2,depth/2);
}
export function correctSpinningFanParts(root,id){
 const b=root.userData.blocks,p={};
 if(id===496){
  b.base.visible=false;
  for(const roll of b.drawingRolls){
   const radius=roll.userData.radius,center=Math.sqrt(radius*radius-.05*.05)-.02;
   roll.userData.ribs.forEach((rib,i)=>{replace(rib,new THREE.BoxGeometry(.04,.10,1.55*.96));const a=i*Math.PI/8;rib.position.set(Math.cos(a)*center,Math.sin(a)*center,0);});
   replace(roll.userData.body,tube(radius*.91,.069,1.55));
   const index=roll.children.find(child=>child.userData.role?.endsWith('-visible-index'));
   replace(index,new THREE.BoxGeometry(.29,.045,1.56));index.position.x=.245;
  }
  b.inputSliver.scale.x=.2;b.draftedFiber.scale.x=.2;
  p.rollBridges=[];
  b.rollBearings.forEach(bearing=>{
   replace(bearing,tube(.145,.069,.10));bearing.rotation.x=Math.PI/2;
   const postX=bearing.position.x<0?-2.62:.70,near=postX<bearing.position.x?bearing.position.x-.145:bearing.position.x+.145;
   p.rollBridges.push(add(root,new THREE.BoxGeometry(Math.abs(near-postX)+.04,.13,.14),b.base.material,'roll-bearing-bridge',new THREE.Vector3((near+postX)/2,bearing.position.y,bearing.position.z)));
  });
  const shaft=b.spindle.userData.rotor.children[0];replace(shaft,new THREE.CylinderGeometry(.065,.065,2.965,32));b.spindle.position.y=-.2925;
  replace(b.whorl,tube(.36,.067,.18));
  replace(b.bobbinBarrel,tube(.434,.069,1.42));for(const flange of b.bobbinFlanges)replace(flange,tube(.49,.069,.11));
  replace(b.spindleBearing,tube(.20,.069,.12));b.spindleBearing.rotation.x=0;b.spindleBearing.position.y=-2.05;
  const shape=polygonClipping.difference(poly(circle([0,0],.15,64)),poly(circle([0,0],.105,64)),poly([[.09,-.065],[.20,-.065],[.20,.065],[.09,.065]]));
  p.neck=add(b.flyerAssembly,plate(shape,1.20,1.425).rotateX(-Math.PI/2),b.flyerTopEye.material,'slotted-hollow-flyer-neck');
  replace(b.flyerArms[1],new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
   [0,1.24,0],[.38,1.12,0],[.72,.66,0],[.94,-.18,0],[.92,-.58,0],
  ].map(v=>new THREE.Vector3(...v)),false,'centripetal'),64,.075,10,false));
  p.shaft=shaft;
  root.userData.minimumDisplayCycleSeconds=12;
  root.userData.cameraDirection=new THREE.Vector3(-3,1.2,15);
  root.userData.cameraFitBounds=new THREE.Box3(new THREE.Vector3(-3.95,-2.2,-1.2),new THREE.Vector3(1.65,3.55,1.2));
  root.userData.reconstructionNote='Drafting and differential winding are prescribed at fixed ratios. Flattened roving and the routed yarn illustrate the feed path; fiber friction, tension, bobbin drag, package growth and continuous material deposition are not dynamically solved.';
 }else{
  const shape=b.frontPlate.geometry.parameters.shapes;
  p.wall=add(b.voluteWall,fanWall(shape,1.28),b.voluteWall.children[0].material,'continuous-finite-volute-wall');
  for(const old of b.voluteWall.children.slice(0,-1)){old.visible=false;}
  let radius=0;const positions=b.blades[0].geometry.attributes.position;for(let i=0;i<positions.count;i++)radius=Math.max(radius,Math.hypot(positions.getX(i),positions.getY(i)));
  const target=3.30,scale=target/radius;
  // Pass 96: at t = 0 the blade tips stand at Brown's 1, 5 and 9 o'clock (28 degrees clockwise of the authored set).
  const geometry=b.blades[0].geometry.clone().scale(scale,scale,1).rotateZ(-28*Math.PI/180);for(const blade of b.blades)blade.geometry=geometry;
  root.userData.geometry.impellerOuterRadius=target;
  replace(b.hub,tube(.57,.134,.98));replace(b.hubIndex,new THREE.BoxGeometry(.28,.065,1.02));b.hubIndex.position.x=.36;
  p.spiders=[];
  for(const bearing of b.bearings){
   replace(bearing,tube(.26,.134,.14));bearing.rotation.x=Math.PI/2;
   for(const side of[-1,1]){
    p.spiders.push(add(root,new THREE.BoxGeometry(.16,1.02,.14),bearing.material,'inlet-bearing-spider',new THREE.Vector3(0,side*.75,bearing.position.z)));
    p.spiders.push(add(root,new THREE.BoxGeometry(.16,.16,.52),bearing.material,'inlet-bearing-spider-standoff',new THREE.Vector3(0,side*1.22,Math.sign(bearing.position.z)*.97)));
   }
  }
  root.userData.minimumDisplayCycleSeconds=4;
  root.userData.cameraDirection=new THREE.Vector3(.7,1.0,15);
  root.userData.reconstructionNote='The three-blade rotation follows the official animation. Airflow markers illustrate axial intake and radial discharge; they do not resolve blade interaction, pressure rise or fluid forces.';
 }
 root.userData.spinningFanWorkingParts=p;
 root.userData.hideGround=true;root.userData.cameraDistanceScale=1;
 root.traverse(o=>{for(const m of[].concat(o.material??[])){m.fog=false;if(m.transparent){m.depthWrite=false;o.castShadow=false;o.receiveShadow=false;}}});
}
