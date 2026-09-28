import * as THREE from 'three';
import measured from '../data/crossed-rack-source.js';
import {PALETTE,matte,markShadows} from './primitives.js';
import {sub,rotate,poly,circle,capsule,plate,disk,turned,polygonClipping as clip,familyMass} from './finite-plate-geometry.js';

const source=point=>[(point[0]-measured.center[0])/measured.scale,(measured.center[1]-point[1])/measured.scale];
const outline=commands=>{
 const shape=new THREE.Shape();
 for(const [operation,...values]of commands){
  if(operation==='M')shape.moveTo(...values);else if(operation==='L')shape.lineTo(...values);
  else if(operation==='Q')shape.quadraticCurveTo(...values);else throw Error(operation);
 }
 return shape.getPoints(12).map(p=>p.toArray());
};
// The rack's teeth in world units at rackY=0. Each tooth has a horizontal
// underside from its root (against the rack) out to its tip; the flank below
// it runs from that root down and out to the next tooth's tip.
export function rackTeeth(){
 const edge=(origin,root,tip)=>Array.from({length:measured.teeth},(_,i)=>{
  const y=origin+i*measured.pitch;return{y:source([0,y])[1],root:source([root(i),0])[0],tip:source([tip(i),0])[0]};});
 return{right:edge(measured.toothOrigins.right,i=>697-.8*i,i=>722-.8*i),
  left:edge(measured.toothOrigins.left,i=>546-.1*i,i=>518-.15*i)};
}

// Each pawl is drawn with ideal lines and circular arcs: a round eye
// concentric with its pin, straight arm edges (traced from the engraving)
// filleted into the eye, and a J-hook. Both hooks use the same construction,
// mirrored: at the source pose the hook tip fills the space below tooth
// `tooth` of the rack edge it works on. Its top face lies along the tooth's
// horizontal underside and its lower face parallel to the flank below, each
// `clearance` away; a square end stops `tipDepth` short of the root. The
// lower face runs on past the next tooth's tip into a rounded bottom, square
// to that face, which joins the arm's outer edge; the bowl between the top
// face and the arm's inner edge receives the tooth tip.
const pawlArms={left:{inner:[[471,320],[727,637]],outer:[[486,304],[731,613]],edge:'right',out:1},
 right:{inner:[[791,324],[521,636]],outer:[[774,307],[490,643]],edge:'left',out:-1}};
export const hookDesign={tooth:7,clearance:.002,tipDepth:.03,wall:.115,bowl:.04,bowlClearance:.03,outerRound:1.3,bottomRound:1,eye:34,eyeFillet:10,web:.1};
function hookedPawl(key,P,d=hookDesign){
 const s=measured.scale,add=(a,b)=>[a[0]+b[0],a[1]+b[1]],mul=(a,k)=>[a[0]*k,a[1]*k],dot=(a,b)=>a[0]*b[0]+a[1]*b[1],
  cross=(a,b)=>a[0]*b[1]-a[1]*b[0],unit=a=>mul(a,1/Math.hypot(...a)),ang=a=>Math.atan2(a[1],a[0]),
  arc=(o,r,a0,a1,n)=>Array.from({length:n+1},(_,i)=>{const a=a0+(a1-a0)*i/n;return add(o,[r*Math.cos(a),r*Math.sin(a)]);}),
  sweep=(a0,a1)=>Math.abs(a1-a0)>Math.PI?a1+(a1<a0?2*Math.PI:-2*Math.PI):a1,
  // Round the corner X between an incoming direction and an outgoing one.
  fillet=(X,din,dout,r,n=32)=>{const back=mul(din,-1),th=Math.acos(Math.max(-1,Math.min(1,dot(back,dout)))),
   F=add(X,mul(unit(add(back,dout)),r/Math.sin(th/2))),k=r/Math.tan(th/2),t1=add(X,mul(back,k)),t2=add(X,mul(dout,k)),b0=ang(sub(t1,F));
   return arc(F,r,b0,sweep(b0,ang(sub(t2,F))),n);},
  meet=(p,u,q,v)=>add(p,mul(u,cross(sub(q,p),v)/cross(u,v))),
  {inner,outer,edge,out}=pawlArms[key],teeth=rackTeeth()[edge],k=d.tooth,c=d.clearance,
  // World design pose: q=0, rackY=0, pawl angle 0.
  i0=source(inner[0]),di=unit(sub(source(inner[1]),i0)),o0=source(outer[0]),dO=unit(sub(source(outer[1]),o0)),
  top=teeth[k].y-c,flank=unit([teeth[k+1].tip-teeth[k].root,teeth[k+1].y-teeth[k].y]),
  // Unit normal of the flank pointing up into the tooth space.
  normal=dot([-flank[1],flank[0]],[0,1])>0?[-flank[1],flank[0]]:[flank[1],-flank[0]],
  lowerPoint=add([teeth[k].root,teeth[k].y],mul(normal,c)),
  tipX=teeth[k].root+out*d.tipDepth,A=[tipX,top],B=meet(lowerPoint,flank,[tipX,0],[0,1]),
  // The bowl corner, where the top face meets the arm's inner edge.
  X=meet([0,top],[1,0],i0,di),
  // A bottom square to the lower face, one wall thickness beyond the bowl corner.
  bottom=add(X,mul(flank,d.wall)),C2=meet(lowerPoint,flank,bottom,normal),C1=meet(o0,dO,bottom,normal),
  bowlRoom=Math.abs(X[0]-teeth[k].tip)-d.bowlClearance,
  bowlAngle=Math.acos(Math.max(-1,Math.min(1,dot([-out,0],mul(di,-1))))),
  bowlRadius=Math.min(d.bowl,bowlRoom*Math.tan(bowlAngle/2)),
  foot=(q,dir)=>sub(q,mul(dir,dot(sub(q,P),dir))),iFoot=foot(i0,di),oFoot=foot(o0,dO),
  width=Math.abs(cross(sub(o0,i0),di)),
  body=[oFoot,...fillet(C1,dO,mul(normal,-1),d.outerRound*width),...fillet(C2,mul(normal,-1),mul(flank,-1),d.bottomRound*width),
   B,A,...fillet(X,[out,0],mul(di,-1),bowlRadius),iFoot].map(v=>sub(v,P));
 if(!(bowlRoom>0)||!(Math.abs(C2[0]-teeth[k+1].tip)<Math.abs(C1[0]-teeth[k+1].tip)))throw Error('Hook design does not fit: '+key);
 let shape=clip.union(poly(body),poly(circle([0,0],d.eye/s,256)));
 for(const [q,dir]of [[sub(iFoot,P),di],[sub(oFoot,P),dO]]){
  const outward=unit(q),off=Math.hypot(...q)+d.eyeFillet/s-1e-6,cc=add(mul(outward,off),mul(dir,Math.sqrt((d.eye/s+d.eyeFillet/s)**2-off*off))),
   t1=sub(cc,mul(outward,d.eyeFillet/s)),b0=ang(sub(t1,cc));
  shape=clip.union(shape,poly([[0,0],...arc(cc,d.eyeFillet/s,b0,sweep(b0,ang(mul(cc,-1))),24)]));
 }
 // The web reaching back into the rack plane is the hook below this line.
 const cut=teeth[k].y+d.web-P[1],web=clip.intersection(shape,poly([[-9,cut],[9,cut],[9,-9],[-9,-9]]));
 return{shape,web,design:{A,B,C1,C2,X,bowlRadius,top,flank,tooth:k,edge}};
}

export function makeCrossedRackGeometry({hook=hookDesign}={}){
 const root=new THREE.Group(),parts={},families={},blocks={},profiles={},
  p={center:measured.center,scale:measured.scale,teeth:measured.teeth,pitch:measured.pitch/measured.scale,hook,rackTeeth:rackTeeth(),hooks:{},
   source:measured,initialAngles:{left:0,right:0},anchors:{},layers:{rack:[-.06,.06],lever:[-.22,-.14],left:[.07,.11],right:[.12,.16]}};
 for(const family of ['fixed','rack','lever','left','right']){blocks[family]=new THREE.Group();root.add(blocks[family]);}
 const attach=(name,geometry,family,color,position=[0,0,0])=>{
  const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.18,roughness:.58}));mesh.name=name;mesh.position.fromArray(position);
  parts[name]=mesh;families[name]=family;blocks[family].add(mesh);return mesh;
 };
 const rackCommands=[['M',485,144],['L',758,144],['Q',725,169,714,201],['L',714,measured.toothOrigins.right-13]];
 // Walk the right edge down, then the stem and left edge back up.
 for(let i=0;i<measured.teeth;i++){
  const y=measured.toothOrigins.right+i*measured.pitch;
  rackCommands.push(['L',722-.8*i,y],['L',697-.8*i,y]);
 }
 // Brown breaks the stem off below the teeth (a drawing convention); it is
 // modelled whole, running on to a square end below the view.
 rackCommands.push(['L',683,measured.toothOrigins.right+15*measured.pitch+7],['L',683,1480],
  ['L',556,1480],['L',556,measured.toothOrigins.left+15*measured.pitch+10]);
 for(let i=measured.teeth-1;i>=0;i--){
  const y=measured.toothOrigins.left+i*measured.pitch;
  rackCommands.push(['L',546-.1*i,y],['L',518-.15*i,y]);
 }
 rackCommands.push(['L',525,measured.toothOrigins.left-14],['L',525,200],['Q',516,169,501,150],['L',485,144]);
 const rackOuter=outline(rackCommands).map(source),slot=measured.slot,
  slotRadius=(slot.right-slot.left)/(2*measured.scale),slotX=(slot.left+slot.right)/2,
  slotShape=capsule(source([slotX,slot.top+(slot.right-slot.left)/2]),source([slotX,slot.bottom-(slot.right-slot.left)/2]),slotRadius,128),
  rackShape=clip.difference(poly(rackOuter),slotShape);
 attach('slottedRack',plate(rackShape,...p.layers.rack),'rack',PALETTE.driven);profiles.rack=rackShape;
 const leverCommands=[['M',219,274],['L',276,271],['L',412,251],['L',519,237],['Q',620,229,724,246],
  ['L',805,249],['L',921,266],['L',997,278],['L',1052,281],['L',1052,316],['L',990,317],
  ['L',803,339],['L',723,345],['Q',617,359,498,348],['L',277,316],['L',219,308],['L',219,274]],
  fulcrumRadius=measured.circles.fulcrum.radius/measured.scale,leverShape=clip.difference(poly(outline(leverCommands).map(source)),poly(circle([0,0],fulcrumRadius+.009,128)));
 attach('taperedLever',plate(leverShape,...p.layers.lever),'lever',PALETTE.driver);
 for(const key of ['left','right']){
  const c=measured.circles[key+'Weight'],center=source(c.center),radius=c.radius/measured.scale,
   weight=turned(Array.from({length:65},(_,i)=>[-radius*Math.cos(Math.PI*i/64),i===0||i===64?0:radius*Math.sin(Math.PI*i/64)]),128),
   positions=weight.attributes.position,normals=weight.attributes.normal;
  for(let i=0;i<positions.count;i++){const n=new THREE.Vector3().fromBufferAttribute(positions,i).normalize();normals.setXYZ(i,n.x,n.y,n.z);}
  attach(key+'EndWeight',weight,'lever',PALETTE.driver,[...center,-.18]);
 }
 attach('fixedFulcrum',disk(fulcrumRadius,-.28,.082,128),'fixed',PALETTE.muted);
 attach('fulcrumRearCap',disk(fulcrumRadius+.025,-.298,-.28,128),'fixed',PALETTE.muted);
 for(const key of ['left','right']){
  const c=measured.circles[key+'PawlBore'],P=source(c.center),
   boreRadius=c.radius/measured.scale,pinRadius=boreRadius-2/measured.scale,[low,high]=p.layers[key];
  p.anchors[key]=P;p[key+'BoreRadius']=boreRadius;p[key+'PinRadius']=pinRadius;
  const {shape,web,design}=hookedPawl(key,P,hook),pawl=clip.difference(shape,poly(circle([0,0],boreRadius,128)));p.hooks[key]=design;
  attach(key+'Pawl',plate(pawl,low,high),key,PALETTE.brass);
  attach(key+"HookWeb",plate(web,-.025,low),key,PALETTE.brass);profiles[key]=web;
  // The pin stops just inside the eye's bore: nothing stands in front of
  // the flat pawl plate.
  attach(key+'PawlPin',disk(pinRadius,-.235,high-.004,128),'lever',PALETTE.muted,[...P,0]);
  attach(key+'PinRearCap',disk(boreRadius+.010,-.247,-.235,128),'lever',PALETTE.muted,[...P,0]);
 }
 const anchorAt=(key,q)=>rotate(p.anchors[key],q),
  setState=({q=0,rackY=0,leftAngle=0,rightAngle=0}={})=>{
   blocks.lever.rotation.z=q;blocks.rack.position.y=rackY;
   for(const key of ['left','right']){const P=anchorAt(key,q);blocks[key].position.set(...P,0);blocks[key].rotation.z=key==='left'?leftAngle:rightAngle;}
   root.userData.kinematics={q,rackY,leftAngle,rightAngle,anchors:Object.fromEntries(['left','right'].map(k=>[k,anchorAt(k,q)]))};
   root.updateMatrixWorld(true);return root.userData.kinematics;
  };
 const masses=Object.fromEntries(['rack','left','right'].map(k=>[k,familyMass(parts,families,k)]));
 root.userData={parts,families,blocks,geometry:p,profiles,source,anchorAt,setState,masses,
  hideGround:true,cameraFov:8,shadowCameraHalfExtent:5.5,shadowBias:-.00003,shadowNormalBias:.004,
  mechanism:'crossed-hook-slotted-rack-drive',fidelity:'authored',
  qualification:'Source-measured finite 16-tooth rack, tapered lever and crossed hooked pawls. Axial layers, flush pivot pins without front caps, the hook webs reaching back into the rack plane and the hook tips fitted to the tooth spaces (one mirrored construction of lines and circular arcs) are reconstruction assumptions.'};
 setState();markShadows(root);return{root,setState,update:()=>{},cameraDirection:new THREE.Vector3(0,0,10)};
}
