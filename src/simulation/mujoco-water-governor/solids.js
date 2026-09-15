import * as THREE from 'three';
import {plate,poly,circle,capsule,ring,disk,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {disposeObject3D} from '../dispose-model.js';
import {waterGovernorGeometry} from './physics.js';
import {governorEquilibrium} from '../mujoco-ball-governor/equilibrium.js';
import {makeWaterGovernorBevels} from './bevel-train.js';

// Unregistered source assembly. Native hinge coordinates drive every moving
// part; the remote water gate and its support are outside the engraving.
export function makeWaterGovernorSolids(){
 const g=waterGovernorGeometry(),initial=governorEquilibrium(g.initialSpread,g),bevel=makeWaterGovernorBevels(),root=new THREE.Group();root.add(bevel.root);
 const parts={...bevel.root.userData.parts},families={...bevel.root.userData.families},blocks={},materials=new Map();
 const group=(name,parent=root)=>{const b=new THREE.Group();b.name='body:'+name;parent.add(b);blocks[name]=b;return b;};
 const fixed=group('fixed'),rotor=group('rotor'),sleeve=group('sleeve',rotor);
 const add=(name,geometry,family,color,point=[0,0,0])=>{
  if(!materials.has(color)){const m=matte(color);m.fog=false;materials.set(color,m);}
  const mesh=new THREE.Mesh(geometry,materials.get(color));mesh.name=name;mesh.position.set(...point);blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
 };
 const yGeometry=geometry=>geometry.rotateX(-Math.PI/2),xGeometry=geometry=>geometry.rotateY(Math.PI/2),pixelY=y=>g.topY+(55-y)*.018;
 const apex=bevel.root.userData.parameters.lowerApex[1],selectorOffset=apex+.108-initial.sleeveY;
 add('spindle',yGeometry(disk(.10,pixelY(485),pixelY(44),96)),'rotor',PALETTE.ink);
 add('headHub',yGeometry(ring(.104,.145,g.topY-.22,g.topY+.07,96)),'rotor',PALETTE.driven);
 add('headFinialStem',yGeometry(disk(.045,pixelY(48),pixelY(33),64)),'rotor',PALETTE.ink);
 add('headFinial',new THREE.SphereGeometry(.117,32,20),'rotor',PALETTE.driven,[0,pixelY(31),0]);
 const head=clip.difference(capsule([-g.pivotRadius,g.topY],[g.pivotRadius,g.topY],.095,48),...[-1,1].map(sign=>poly(circle([sign*g.pivotRadius,g.topY],.054,64))));
 add('headFront',plate(head,.11,.20),'rotor',PALETTE.driven);add('headRear',plate(head,-.20,-.11),'rotor',PALETTE.driven);
 add('sleeveTube',yGeometry(ring(.106,.145,selectorOffset-.20,.08,96)),'sleeve',PALETTE.brass);
 const crossbar=clip.difference(capsule([-g.sleeveRadius,0],[g.sleeveRadius,0],.10,48),poly([[-.112,-.2],[.112,-.2],[.112,.2],[-.112,.2]]),...[-1,1].map(sign=>poly(circle([sign*g.sleeveRadius,0],.054,64))));
 add('sleeveCrossbar',plate(crossbar,-.085,.085),'sleeve',PALETTE.brass);
 add('selectorPin',new THREE.BoxGeometry(.36,.09,.09),'sleeve',PALETTE.brass,[.34,selectorOffset,0]);
 // A recessed shoulder joins the finite pin to the tube; its smaller axial
 // height keeps it behind the working pin faces during backing contact.
 add('selectorShoulder',new THREE.BoxGeometry(.04,.07,.07),'sleeve',PALETTE.brass,[.145,selectorOffset,0]);
 for(const sign of [-1,1]){
  const name=sign<0?'left':'right',upper=group(name+'Upper',rotor),lower=group(name+'Lower',rotor);
  upper.position.set(sign*g.pivotRadius,g.topY,0);
  const upperShape=clip.difference(clip.union(capsule([0,0],[0,-g.ballArm+.50],.054,48),poly(circle([0,0],.095,64)),poly(circle([0,-g.elbowArm],.153,64))),poly(circle([0,0],.054,64)),poly(circle([0,-g.elbowArm],.064,64)));
  add(name+'UpperArm',plate(upperShape,-.075,.075),name+'Upper',PALETTE.driven);
  add(name+'Ball',new THREE.SphereGeometry(g.ballRadius,48,32),name+'Upper',PALETTE.driver,[0,-g.ballArm,0]);
  const lowerShape=clip.difference(clip.union(capsule([0,0],[0,-g.lowerLink],.054,48),poly(circle([0,0],.13,64)),poly(circle([0,-g.lowerLink],.10,64))),poly(circle([0,0],.064,64)),poly(circle([0,-g.lowerLink],.054,64)));
  add(name+'LowerLink',plate(lowerShape,.115,.225),name+'Lower',PALETTE.ink);
  add(name+'HeadPin',disk(.05,-.22,.22,64),'rotor',PALETTE.ink,[sign*g.pivotRadius,g.topY,0]);
  add(name+'ElbowPin',disk(.06,-.09,.25,64),name+'Upper',PALETTE.ink,[0,-g.elbowArm,0]);
  add(name+'SleevePin',disk(.05,-.10,.25,64),'sleeve',PALETTE.ink,[sign*g.sleeveRadius,0,0]);
 }
 for(const [name,center,half]of [['upper',.351,.117],['lower',-.225,.153]]){
  const block=group(name+'Stud');block.position.y=apex;
  const extension=name==='upper'?.025:-.025;
  add(name+'Stud',new THREE.BoxGeometry(.09,2*half+Math.abs(extension),.09),name+'Stud',PALETTE.ink,[.43,center+extension/2,0]);
  families[name+'Stud']=name+'Loose';
 }
 for(const [name,apexY,reach]of [['inputShaft',bevel.root.userData.parameters.topApex[1],2.286],['outputShaft',apex,2.484]]){
  group(name).position.y=apexY;
  add(name,xGeometry(disk(.10,-reach,-.58,96)),name,PALETTE.ink);
  add(name+'Bearing',xGeometry(ring(.106,.18,-1.03,-.91,96)),'fixed',PALETTE.frame,[0,apexY,0]);
 }
 const update=state=>{
  rotor.rotation.y=state.spindle;sleeve.position.y=state.sleeveY;
  for(const sign of [-1,1]){
   const name=sign<0?'left':'right',theta=state[name+'Spread'];blocks[name+'Upper'].rotation.z=sign*theta;
   blocks[name+'Lower'].position.set(sign*(g.pivotRadius+g.elbowArm*Math.sin(theta)),g.topY-g.elbowArm*Math.cos(theta),0);
   blocks[name+'Lower'].rotation.z=sign*(initial.lowerAngle+state.qpos[sign<0?2:4]+theta-g.initialSpread);
  }
  blocks.upperStud.rotation.y=state.upper;blocks.lowerStud.rotation.y=state.lower;
  blocks.inputShaft.rotation.x=state.spindle;blocks.outputShaft.rotation.x=state.output;
  bevel.update(state);root.updateMatrixWorld(true);
 };
 Object.assign(root.userData,{parts,blocks,families,geometry:g,selectorOffset,hideGround:true,sourceScale:.018,reconstructionNote:'Unregistered source assembly driven by native hinge coordinates. Depths, rear cheeks, shaft bearings and stud-root extensions are inferred. The water gate and remote shaft supports are outside the engraving.'});
 update({spindle:0,leftSpread:g.initialSpread,rightSpread:g.initialSpread,sleeveY:initial.sleeveY,upper:0,lower:0,output:0,qpos:Array(9).fill(0)});markShadows(root);
 return{root,update,dispose:()=>disposeObject3D(root)};
}
