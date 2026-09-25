import * as T from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {boredPlanarLinkGeometry} from './bored-planar-link.js';
import {plate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
const find=(r,name)=>{let result;r.traverse(o=>{if(o.userData.role===name)result=o;});return result;};
const ring=(outer,inner,length)=>boredLatheGeometry([{axial:-length/2,radial:outer},{axial:length/2,radial:outer}],inner,96);
const add=(parent,g,material,role)=>{const o=new T.Mesh(g,material);o.userData.role=role;parent.add(o);return o;};
const axle=(parent,material,role,length=.31)=>{const o=add(parent,new T.CylinderGeometry(.080,.080,length,64).rotateX(Math.PI/2),material,role);return o;};

export function correctDoorCloserParts(model){
 const{root}=model,d=root.userData,b=d.blocks,g=d.geometry,oldUpdate=model.update;
 const forks=[];
 for(const prefix of['frame-side','door-side']){
  const socket=find(root,`${prefix}-socket-fixed-to-support`),pin=find(root,`${prefix}-vertical-turning-pin`),rotor=pin.parent;
  replace(socket,ring(.19,.089,.25));
  // Brown draws each pin as a long upright bar below its eye.
  const bottom=2.40,top=g.endpointY-.18;
  replace(pin,new T.CylinderGeometry(.085,.085,top-bottom,64));pin.position.y=(top+bottom)/2;
  const oldEye=find(root,`${prefix}-link-end-eye`),oldTab=find(root,`${prefix}-pin-orientation-yoke`),index=find(root,`${prefix}-white-pin-turn-index`);
  oldEye.visible=false;oldTab.visible=false;
  index.position.set(.10,g.endpointY-.161,.065);index.scale.set(.60,1,1);
  const fork=new T.Group();fork.userData.role=`${prefix}-transverse-toggle-clevis`;fork.position.y=g.endpointY;rotor.add(fork);
  const shape=clip.difference(clip.union(poly([[-.15,-.24],[.15,-.24],[.15,0],[-.15,0]]),poly(circle([0,0],.15,64))),poly(circle([0,0],.083,96)));
  const ears=[];for(const z of[-.04,.17]){const ear=add(fork,plate(shape,-.02,.02),pin.material,`${prefix}-bored-clevis-ear`);ear.position.z=z;ears.push(ear);}
  const bridge=add(fork,new T.BoxGeometry(.30,.07,.25),pin.material,`${prefix}-clevis-bridge`);bridge.position.set(0,-.205,.065);
  const jointPin=axle(fork,pin.material,`${prefix}-transverse-toggle-pin`);jointPin.position.z=.065;
  const cap=add(fork,ring(.115,.077,.025).rotateX(Math.PI/2),pin.material,`${prefix}-transverse-pin-retainer`);cap.position.z=.2325;
  forks.push({fork,ears,bridge,jointPin,cap,verticalPin:pin,socket});
 }
 // The pins stand in bored socket blocks fixed on the top edge of the door
 // and on the wall beside the opening; the door hangs on three knuckles with
 // leaves on the wall and on the door, clear of each other.
 {
  const top=2.30,blockTop=2.60,t=g.doorThickness;
  const block=()=>plate(clip.difference(poly([[-.22,-.20],[.22,-.20],[.22,.20],[-.22,.20]]),poly(circle([0,0],.089,96))),top,blockTop).rotateX(-Math.PI/2);
  for(const[role,x]of[['frame-pin-socket-bracket',-g.framePinOffset],['door-pin-socket-bracket',g.doorPinRadius]]){const o=find(root,role);replace(o,block());o.position.set(x,0,0);}
  // The socket rings sit on the blocks; the long pins stand clear above them.
  for(const{socket}of forks){socket.position.y=blockTop+.125;}
  for(const prefix of['frame-side','door-side'])find(root,`${prefix}-socket-upper-lip`).position.y=blockTop+.25;
  const wall=find(root,'fixed-wall-beside-door-opening');replace(wall,new T.BoxGeometry(2.13,top,t));wall.position.set(-1.185,top/2,-t/2);
  const door=find(root,'moving-door-panel');replace(door,new T.BoxGeometry(g.doorWidth-.12,top,t));door.position.set(.06+g.doorWidth/2,top/2,-t/2);
  const barrels=[];root.traverse(o=>{if(o.userData.role==='one-of-three-fixed-axis-door-hinge-barrels')barrels.push(o);});
  for(const barrel of barrels){
   const wallLeaf=add(wall.parent,new T.BoxGeometry(.10,.30,.07),barrel.material,'fixed-hinge-leaf-on-wall');wallLeaf.position.set(-.163,barrel.position.y,-.065);
   const doorLeaf=add(door.parent,new T.BoxGeometry(.10,.30,.07),barrel.material,'door-hinge-leaf-on-door');doorLeaf.position.set(.163,barrel.position.y,-.065);
  }
 }
 // Both rigid links retain their analytic endpoints but occupy separate axial
 // layers on a common transverse axis; only rigid transforms change at runtime.
 const links=[];for(const[parent,layer]of[[b.frameToggleLink,.065],[b.doorToggleLink,-.065],[b.suspension,0]]){
  for(const child of parent.children)child.visible=false;
  const length=parent===b.suspension?g.weightSuspensionLength:g.linkLength;
  const mesh=add(parent,boredPlanarLinkGeometry({length,width:parent===b.suspension?.055:.13,eyeRadius:parent===b.suspension?.12:.15,boreRadius:.083,depth:parent===b.suspension?.035:.08}),parent.children[0].material,`${parent.userData.role}-finite-bored-link`);
  links.push({mesh,layer});
 }
 b.toggleEye.visible=false;b.toggleIndex.position.set(0,.12,.24);
 const centerPin=axle(b.toggleJoint,b.toggleEye.material,'central-toggle-transverse-axle',.43);
 const centerCaps=[];for(const z of[-.2275,.2275]){const cap=add(b.toggleJoint,ring(.12,.077,.025).rotateX(Math.PI/2),b.toggleEye.material,'central-toggle-axle-retainer');cap.position.z=z;centerCaps.push(cap);}
 // Separate the weight eye and suspension plate on the same finite lower pin.
 b.weightEye.position.z=.15;find(root,'weight-neck').position.z=.13;
 const weightPin=axle(b.weight,b.toggleEye.material,'weight-eye-transverse-suspension-pin',.29);weightPin.position.set(0,g.weightEyeOffsetY,.045);
 const weightCap=add(b.weight,ring(.115,.077,.025).rotateX(Math.PI/2),b.toggleEye.material,'weight-suspension-pin-retainer');weightCap.position.set(0,g.weightEyeOffsetY,.2025);
 function place(mesh,start,end,normal,offset){const x=end.clone().sub(start).normalize(),y=new T.Vector3().crossVectors(normal,x);mesh.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,normal));mesh.position.copy(start).addScaledVector(normal,offset);}
 model.update=time=>{oldUpdate(time);const s=d.kinematics,chord=s.doorAnchor.clone().sub(s.frameAnchor).setY(0).normalize(),normal=new T.Vector3(-chord.z,0,chord.x);place(links[0].mesh,s.frameAnchor,s.apex,normal,links[0].layer);place(links[1].mesh,s.doorAnchor,s.apex,normal,links[1].layer);place(links[2].mesh,s.apex,s.weightEye,normal,0);b.toggleJoint.rotation.y=s.framePinYaw;b.weight.rotation.y=s.framePinYaw;};
 d.workingJoints={forks,links:links.map(o=>o.mesh),centerPin,centerCaps,weightPin,weightCap};
 d.reconstructionNote='The hanging weight closes an exact equal-link toggle. Door motion is prescribed; gravity torque is calculated quasistatically. Joint friction, impact, weight swing and load-dependent closing speed are not simulated. Forks and axially separated eyes are inferred construction details.';
 d.hideGround=true;d.minimumDisplayCycleSeconds=10;
 root.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)m.fog=false;});
 const bounds=new T.Box3();for(let i=0;i<=32;i++){model.update(10*i/32);root.updateMatrixWorld(true);root.traverseVisible(o=>{if(o.geometry){o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});}model.update(0);d.cameraFitBounds=bounds;d.cameraDistanceScale=1.03;model.cameraDirection=new T.Vector3(1.8,1.2,12);return model;
}
