import * as T from 'three';
import {plate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';
import {mergePassageParts} from './finite-fluid-passages.js';
import {fitPistonGuide} from './piston-guide-parts.js';
const rectangle=(x0,y0,x1,y1)=>poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};

export function cockPassagePath(radius,endpoint,z,opposite=false){
 const path=new T.CurvePath(),sign=opposite?-1:1;
 const p=(x,y)=>new T.Vector3(sign*x,sign*y,z);
 path.add(new T.LineCurve3(p(0,endpoint),p(0,radius)));
 class Bend extends T.Curve{
  getPoint(t,target=new T.Vector3()){const a=-Math.PI*t/2;return target.copy(p(-radius+radius*Math.cos(a),radius+radius*Math.sin(a)));}
  getTangent(t,target=new T.Vector3()){const a=-Math.PI*t/2;return target.set(sign*Math.sin(a),-sign*Math.cos(a),0);}
 }
 path.add(new Bend());path.add(new T.LineCurve3(p(-radius,0),p(-endpoint,0)));
 return path;
}

export function correctFourWayCock(root){
 const d=root.userData,b=d.blocks,g=d.geometry,width=.245;
 const cuts=[];
 for(const sign of[1,-1]){
  const curve=cockPassagePath(g.passageRadius,g.plugRadius+.05,0,sign<0);
  const points=Array.from({length:129},(_,i)=>curve.getPoint(i/128)),sides=[[],[]];
  for(let i=0;i<points.length;i++){
   const t=curve.getTangent(i/(points.length-1)),n=new T.Vector3(-t.y,t.x,0);
   sides[0].push(points[i].clone().addScaledVector(n,width).toArray().slice(0,2));
   sides[1].push(points[i].clone().addScaledVector(n,-width).toArray().slice(0,2));
  }
  cuts.push(poly([...sides[0],...sides[1].reverse()]));
 }
 const disk=poly(circle([0,0],g.plugRadius,256));
 // A rear floor and open front form an explicit section through the passages.
 replace(b.plug,mergePassageParts([plate(disk,-g.plugDepth/2,-.17),plate(clip.difference(disk,...cuts),-.17,g.plugDepth/2)]));
 b.plug.rotation.set(0,0,0);
 const ports=[rectangle(-width,-3,width,3),rectangle(-3,-width,3,width)];
 const housing=clip.difference(poly(circle([0,0],g.bodyOuterRadius,256)),poly(circle([0,0],g.bodyInnerRadius,256)),...ports);
 replace(b.housing,plate(housing,-g.bodyDepth/2,g.bodyDepth/2));
 for(const channel of Object.values(b.channels)){
  channel.userData.recess.visible=false;
  const core=channel.userData.flowCore;replace(core,new T.TubeGeometry(channel.userData.curve,96,.155,20));core.position.z=0;
 }
 // Sectioned external pipes: finite side walls and a rear wall expose the bore.
 for(const pipe of Object.values(b.pipes)){
  const [barrel,paintedBore]=pipe.children;paintedBore.visible=false;
  const low=g.bodyInnerRadius,high=g.bodyOuterRadius+g.pipeLength-.08;
  const r=g.pipeRadius;
  const section=mergePassageParts([
   plate(rectangle(-r,low,r,high),-.29,-.24),
   plate(rectangle(-r,low,-width,high),-.24,.12),
   plate(rectangle(width,low,r,high),-.24,.12),
  ]);
  const direction=barrel.position.clone().normalize();
  section.rotateZ(Math.atan2(direction.y,direction.x)-Math.PI/2);
  replace(barrel,section);barrel.position.set(0,0,0);barrel.rotation.set(0,0,0);
 }
 for(const collar of b.portCollars)collar.visible=false;
 d.minimumDisplayCycleSeconds=d.motion.cycleDuration;
 d.reconstructionNote='The open front exposes the two curved passages. Turning the plug swaps admission and exhaust; flow markers pause during the turn because transient throttling is not modeled.';
 fitPistonGuide(root,d.update,d.motion.cycleDuration);
 d.cameraDirection=new T.Vector3(.6,.6,15);d.cameraFov=12;
 root.traverse(o=>{if([].concat(o.material??[]).some(m=>m.transparent)){o.castShadow=false;o.receiveShadow=false;}});
}
