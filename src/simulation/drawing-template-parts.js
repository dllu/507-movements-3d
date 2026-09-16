import * as T from 'three';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
import {fitPistonGuide} from './piston-guide-parts.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
const add=(p,g,m,role)=>{const o=new T.Mesh(g,m);o.userData.role=role;p.add(o);return o;};
// Fixed Gauss quadrature of a unit-speed curve whose curvature tapers to zero
// at the free tip. Derivatives are with respect to total turning angle.
const nodes=[-.9602898564975363,-.7966664774136267,-.525532409916329,-.1834346424956498,.1834346424956498,.525532409916329,.7966664774136267,.9602898564975363];
const weights=[.1012285362903763,.2223810344533745,.3137066458778873,.362683783378362,.362683783378362,.3137066458778873,.2223810344533745,.1012285362903763];
export function taperedBendIntegrals(angle,u=1){
 const out={f:0,g:0,f1:0,g1:0,f2:0,g2:0};
 for(let i=0;i<8;i++){const v=u*(nodes[i]+1)/2,h=2*v-v*v,w=weights[i]*u/2,s=Math.sin(angle*h),c=Math.cos(angle*h);out.f+=w*s;out.g+=w*c;out.f1+=w*h*c;out.g1-=w*h*s;out.f2-=w*h*h*s;out.g2-=w*h*h*c;}
 return out;
}
export function pointedTemplateParameters(width,rise){
 let lo=0,hi=Math.PI/2;
 for(let i=0;i<56;i++){const a=(lo+hi)/2,p=taperedBendIntegrals(a);if(p.f/p.g<width/rise)lo=a;else hi=a;}
 const angle=(lo+hi)/2,p=taperedBendIntegrals(angle);
 return {angle,length:width/p.f};
}
function cordArc(mesh,radius,tube){
 const n=96,m=12,positions=new Float32Array(((n+1)*(m+1)+2)*3),indices=[];
 for(let i=0;i<n;i++)for(let j=0;j<m;j++){const a=i*(m+1)+j,b=a+m+1;indices.push(a,a+1,b,b,a+1,b+1);}
 const cap=(n+1)*(m+1);for(let j=0;j<m;j++)indices.push(cap,j+1,j,cap+1,n*(m+1)+j,n*(m+1)+j+1);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geometry.setIndex(indices);replace(mesh,geometry);
 // Two parallel legs are separated by more than one cord diameter. The wrap
 // changes depth smoothly, with zero depth slope at both tangent joins.
 return (start,end)=>{
  for(let i=0;i<=n;i++){
   const u=i/n,angle=start+(end-start)*u,s=Math.sin(angle),c=Math.cos(angle);
   const z=-.04+.08*(u*u*u*(10+u*(-15+6*u)));
   const dz=.08*30*u*u*(1-u)*(1-u),da=end-start;
   const tangent=new T.Vector3(-radius*s*da,radius*c*da,dz).normalize();
   const radial=new T.Vector3(c,s,0),binormal=new T.Vector3().crossVectors(tangent,radial).normalize();
   for(let j=0;j<=m;j++){
    const v=2*Math.PI*j/m,p=radial.clone().multiplyScalar(radius+tube*Math.cos(v)).addScaledVector(binormal,tube*Math.sin(v));p.z+=z;p.toArray(positions,(i*(m+1)+j)*3);
   }
  }
  positions.set([radius*Math.cos(start),radius*Math.sin(start),-.04,radius*Math.cos(end),radius*Math.sin(end),.04],cap*3);
  geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.computeBoundingBox();
 };

}
function pencilParts(pencil,tall=false){
 const role=part=>pencil.children.find(o=>o.userData.role?.includes(part));
 const barrel=role('pencil-barrel'),cone=pencil.children.find(o=>o.geometry?.type==='CylinderGeometry'&&o!==barrel),point=role('pencil-point');
 if(tall){replace(barrel,new T.CylinderGeometry(.085,.085,1.035,48));barrel.position.z=.4225;}
 replace(cone,new T.CylinderGeometry(.085,.018,.16,48));replace(point,new T.SphereGeometry(.012,24,16));point.position.z=-.248;
 return {barrel,cone,point};
}
export function correctDrawingTemplateParts(root,id,update){
 const d=root.userData,b=d.blocks,g=d.geometry;
 b.workingPencil=pencilParts(b.pencil,id===406);
 if(id===406){
  // The guide rides above the low focus pin; the pencil bears on its right edge.
  b.square.position.z=.685;b.blade.position.x=-.195;b.bladeEnd.position.x=-.100;replace(b.bladeEnd,new T.BoxGeometry(.55,.18,.20));
  for(const tick of b.bladeTicks)tick.position.x=-.195;
  b.stock.position.z=-.325;replace(b.stock,new T.BoxGeometry(g.stockWidth,g.stockHeight,.80));
  b.threadAnchor.position.set(.113,g.directrixY-g.bladeLength,-.390);
  b.anchorStud=add(b.square,new T.CylinderGeometry(.025,.025,.39,24),b.stock.material,'blade-end-cord-anchor-stud');b.anchorStud.rotation.x=Math.PI/2;b.anchorStud.position.set(.113,g.directrixY-g.bladeLength,-.195);
  replace(b.focusThreadLoop,new T.TorusGeometry(.100,.025,12,64));b.focusThreadLoop.position.z=.215;
  b.focusPin.children.find(o=>o.userData.role==='parabola-focus-brass-collar').position.z=.01;
  const bight=b.pencil.children.find(o=>o.userData.role==='white-thread-bight-around-pencil');
  const arc=cordArc(bight,.113,.025);
  d.updateWorkingParts=state=>{
   const f=new T.Vector3(state.focus.x,state.focus.y,.215),p=new T.Vector3(state.pencilPoint.x,state.pencilPoint.y,.215),delta=p.clone().sub(f),length=delta.length(),u=delta.clone().divideScalar(length),c=(.100-.113)/length,n=u.clone().multiplyScalar(c).add(new T.Vector3(-u.y,u.x,0).multiplyScalar(Math.sqrt(1-c*c)));
   b.focusCord.userData.setEndpoints(f.clone().addScaledVector(n,.100),p.clone().addScaledVector(n,.113));
   const a=p.clone().add(new T.Vector3(.113,0,.080)),end=new T.Vector3(state.bladeEnd.x+.113,state.bladeEnd.y,.295);
   b.bladeCord.userData.setEndpoints(a,end);let angle=Math.atan2(n.y,n.x);if(angle<0)angle+=Math.PI*2;arc(angle,0);
  };
 }else{
  const base=poly([[-3.03,-.21],[3.03,-.21],[3.03,.21],[-3.03,.21]]);
  replace(b.baseBar,plate(clip.difference(base,capsule([g.slotLeft+.075,-.02],[g.slotRight-.075,-.02],.075,32)),-.19,.19));b.slot.visible=false;
  replace(b.slideBlock,plate(clip.difference(poly([[-.19,-.065],[.19,-.065],[.19,.065],[-.19,.065]]),poly(circle([0,0],.047,48))),-.22,.22));b.slideBlock.position.z=-.24;
  b.slideRetainers=[-.475,.005].map(z=>{const o=add(b.slide,plate(clip.difference(poly([[-.23,-.105],[.23,-.105],[.23,.105],[-.23,.105]]),poly(circle([0,0],.048,48))),-.025,.025),b.slideBlock.material,'finite-slot-slide-retaining-cheek');o.position.z=z;return o;});
  const pin=b.slide.children.find(o=>o.userData.role==='slide-pin-carrying-cord-loop');replace(pin,new T.CylinderGeometry(.045,.045,.52,40));
  replace(b.cordLoop,new T.TorusGeometry(.080,.025,12,64));
  const [clamp,roller]=b.fulcrumPiece.children;roller.visible=false;
  const envelope=d.pathAtBend(1).innerPoints.filter(p=>p.y<=.46).map(p=>[p.x+.004,p.y]);
  replace(clamp,plate(poly([...envelope,[-1.93,envelope.at(-1)[1]],[-1.93,0]]),-.08,.30));clamp.position.set(0,0,0);
  b.fixedTab=add(root,new T.BoxGeometry(g.barDepth,.20,g.barThickness),b.elasticBar.material,'elastic-bar-root-fixed-tab');b.fixedTab.position.set(g.leftSpringingX+g.barDepth/2,-.10,.12);
  b.tipEye=add(root,plate(clip.difference(poly(circle([0,0],.14,64)),poly(circle([0,0],.089,64))),.03,.21),b.elasticBar.material,'bored-pencil-clamp-at-elastic-bar-tip');
  const collar=b.pencil.children.find(o=>o.userData.role==='white-cord-and-bar-tip-connection-collar');replace(collar,new T.TorusGeometry(.113,.026,12,64));
  d.updateWorkingParts=state=>{b.tipEye.position.set(state.tip.x,state.tip.y,0);const start=new T.Vector3(state.slidePin.x,state.slidePin.y,.33),end=new T.Vector3(state.tip.x,state.tip.y,.33),u=end.clone().sub(start).normalize();b.cord.userData.setEndpoints(start.addScaledVector(u,.105),end.addScaledVector(u,-.139));};
 }
 d.minimumDisplayCycleSeconds=g.cycleDuration;d.workingPartsReview={status:'selected-finite-interfaces',residual:id===406?'The parabola uses the exact ideal point-thread law. Finite cord wraps are a visible thickness allowance, not an exactly constant finite-radius cord length or a tension/friction solve.':'The inextensible template uses a prescribed tapering-curvature family. Its selected arch has no crown overshoot; intermediate shapes are not a solved elastic equilibrium under the changing cord direction.'};
 fitPistonGuide(root,update,g.cycleDuration);d.cameraDirection=new T.Vector3(.7,.5,15);
}
