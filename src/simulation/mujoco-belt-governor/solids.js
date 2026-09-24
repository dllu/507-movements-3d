import {makeBeltGovernorUpdater} from './update-solids.js';
import * as THREE from 'three';
import {plate,poly,circle,capsule,ring,disk,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {disposeObject3D} from '../dispose-model.js';
import {beltGovernorGeometry} from './geometry.js';
import {governorEquilibrium} from '../mujoco-ball-governor/equilibrium.js';

// Unregistered source assembly. Native hinge coordinates drive every moving
// part; the remote water gate and its support are outside the engraving.
export function makeBeltGovernorSolids({beltSeamSpacing=2.4}={}){
 const g=beltGovernorGeometry(),initial=governorEquilibrium(g.initialSpread,g),root=new THREE.Group();
 const parts={},families={},blocks={},materials=new Map();
 const group=(name,parent=root)=>{const b=new THREE.Group();b.name='body:'+name;parent.add(b);blocks[name]=b;return b;};
 const fixed=group('fixed'),rotor=group('rotor'),sleeve=group('sleeve',rotor);
 const add=(name,geometry,family,color,point=[0,0,0])=>{
  if(!materials.has(color)){const m=matte(color);m.fog=false;materials.set(color,m);}
  const mesh=new THREE.Mesh(geometry,materials.get(color));mesh.name=name;mesh.position.set(...point);blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
 };
 const yGeometry=geometry=>geometry.rotateX(-Math.PI/2),xGeometry=geometry=>geometry.rotateY(Math.PI/2),pixelY=y=>g.topY+(48-y)*.018;
 add('spindle',yGeometry(disk(.10,pixelY(520),pixelY(38),96)),'rotor',PALETTE.ink);
 add('headHub',yGeometry(ring(.104,.145,g.topY-.22,g.topY+.07,96)),'rotor',PALETTE.driven);
 add('headFinialStem',yGeometry(disk(.045,pixelY(41),pixelY(28),64)),'rotor',PALETTE.ink);
 add('headFinial',new THREE.SphereGeometry(.117,32,20),'rotor',PALETTE.driven,[0,pixelY(24),0]);
 const head=clip.difference(capsule([-g.pivotRadius,g.topY],[g.pivotRadius,g.topY],.095,48),...[-1,1].map(sign=>poly(circle([sign*g.pivotRadius,g.topY],.054,64))));
 add('headFront',plate(head,.11,.20),'rotor',PALETTE.driven);add('headRear',plate(head,-.20,-.11),'rotor',PALETTE.driven);
 add('sleeveTube',yGeometry(ring(.106,.145,-.61,.08,96)),'sleeve',PALETTE.brass);
 const crossbar=clip.difference(capsule([-g.sleeveRadius,0],[g.sleeveRadius,0],.10,48),poly([[-.112,-.2],[.112,-.2],[.112,.2],[-.112,.2]]),...[-1,1].map(sign=>poly(circle([sign*g.sleeveRadius,0],.054,64))));
 add('sleeveCrossbar',plate(crossbar,-.085,.085),'sleeve',PALETTE.brass);
 for(const [name,low,high]of [['top',-.33,-.29],['bottom',-.61,-.57]])add('groove'+name,yGeometry(ring(.106,.40,low,high,96)),'sleeve',PALETTE.brass);
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
 // Brown draws two nested, slender inverted-U brackets (outer legs under the
 // top bar, an inner U below it) with a true open center, not a broad legged
 // table. The belt and pulleys pass in front of their legs, so the legs stand
 // in the spindle plane, between the belt's two runs, and the top bars part
 // round the spindle with running clearance (hidden behind it from the
 // front). Only the outer bar's right end deepens forward to seat the bell
 // crank's pedestal.
 const box=(x0,x1,y0,y1)=>poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]),bore=.116,topY0=pixelY(383)-.13,topY1=pixelY(383)+.13;
 const frameShape=clip.union(box(-2.047,-1.867,pixelY(517),pixelY(390)),box(1.967,2.147,pixelY(517),pixelY(390)),
  box(-1.636,-1.476,pixelY(510),pixelY(412)),box(1.566,1.726,pixelY(510),pixelY(412)),
  box(-1.636,-bore,pixelY(422),pixelY(412)),box(bore,1.726,pixelY(422),pixelY(412)));
 add('frame',plate(frameShape,-.09,.09),'fixed',PALETTE.frame);
 add('frameTop',plate(clip.union(box(-2.047,-bore,topY0,topY1),box(bore,2.147,topY0,topY1)),-.09,.09),'fixed',PALETTE.frame);
 add('frameTopSeat',plate(box(g.bellX-.5,2.147,topY0,topY1),.09,1.16),'fixed',PALETTE.frame);
 const mount=poly([[g.bellX-.43,pixelY(378)],[g.bellX+.43,pixelY(378)],[g.bellX+.24,g.bellY-.20],[g.bellX-.24,g.bellY-.20]]);
 add('bellPedestal',plate(mount,.34,1.16),'fixed',PALETTE.frame);
 add('bellBearing',ring(.106,.25,.32,.65,96),'fixed',PALETTE.frame,[g.bellX,g.bellY,0]);
 const bell=group('bell');bell.position.set(g.bellX,g.bellY,0);
 const points=[[259,270],[282,270],[298,290],[311,323],[327,338],[348,343]].map(([x,y])=>new THREE.Vector3((x-348)*.018,(343-y)*.018,0));
 const curve=new THREE.CatmullRomCurve3(points),samples=curve.getPoints(48);
 const curved=clip.union(...samples.slice(1).map((p,i)=>capsule([samples[i].x,samples[i].y],[p.x,p.y],.06,16)));
 const bellShape=clip.difference(clip.union(curved,capsule([0,0],[g.outputArm,0],.072,32),poly(circle([0,0],.25,64)),poly(circle([g.outputArm,0],.17,64))),poly(circle([0,0],.106,64)),poly(circle([g.outputArm,0],.064,64)));
 add('bellFront',plate(bellShape,.16,.20),'bell',PALETTE.driven);
 add('bellRearFork',plate(curved,-.20,-.16),'bell',PALETTE.driven);
 add('bellAxle',disk(.10,-.32,.68,64),'bell',PALETTE.ink);
 add('outputPin',disk(.06,.16,.51,64),'bell',PALETTE.ink,[g.outputArm,0,0]);
 // The fork's two tips straddle the sleeve core inside the annular groove.
 const shoe=group('shoe');
 for(const sign of [-1,1]){add('grooveTip'+sign,disk(.04,sign<0?-.31:.155,sign<0?-.155:.31,48),'bell',PALETTE.ink,[-g.bellX,g.sleeveY-g.grooveDrop-g.bellY,0]);add('grooveRoller'+sign,ring(.043,.115,sign<0?-.29:.21,sign<0?-.21:.29,64),'shoe',PALETTE.ink);}
 const rod=group('rod'),fork=group('fork');
 const rodShape=clip.difference(clip.union(capsule([0,0],[0,-g.rodLength],.06,32),poly(circle([0,0],.16,64)),poly(circle([0,-g.rodLength],.12,64))),poly(circle([0,0],.064,64)),poly(circle([0,-g.rodLength],.054,64)));
 add('connectingRod',plate(rodShape,.35,.47),'rod',PALETTE.brass);
 add('forkPin',disk(.05,.32,.74,64),'fork',PALETTE.ink);
 // A U section surrounds the near belt run with clearance on both edges.
 for(const sign of [-1,1])add('forkEdge'+sign,new THREE.BoxGeometry(.36,.055,.30),'fork',PALETTE.brass,[0,sign*.20,.846]);
 add('forkSpine',new THREE.BoxGeometry(.36,.455,.08),'fork',PALETTE.brass,[0,0,.65]);
 for(const [name,y,family]of [['upper',g.upperPulleyY,'rotor'],['middle',g.middlePulleyY,'loose'],['lower',g.lowerPulleyY,'rotor']]){
  if(family==='loose')group('loose');
  add(name+'Pulley',yGeometry(ring(.106,g.pulleyRadius,y-.144,y+.144,96)),family,name==='middle'?PALETTE.frame:PALETTE.driver);
 }
 const belt=group('belt');
 // The engraving stops before the remote transmission: show both open runs
 // and their half-wrap, without inventing a receiving pulley or gate train.
 const beltPath=[...Array.from({length:97},(_,i)=>{const a=Math.PI/2+Math.PI*i/96;return[(g.pulleyRadius+.0002)*Math.cos(a),(g.pulleyRadius+.0002)*Math.sin(a)];}),[4.48,-(g.pulleyRadius+.0002)],[4.48,-(g.pulleyRadius+.0002)-.025],...Array.from({length:97},(_,i)=>{const a=3*Math.PI/2-Math.PI*i/96;return[((g.pulleyRadius+.0002)+.025)*Math.cos(a),((g.pulleyRadius+.0002)+.025)*Math.sin(a)];}),[4.48,(g.pulleyRadius+.0002)+.025],[4.48,(g.pulleyRadius+.0002)]];
 const beltGeometry=plate(poly(beltPath),-.162,.162);beltGeometry.rotateX(Math.PI/2);
 add('flatBelt',beltGeometry,'belt',PALETTE.ink);
 const seamCount=Math.ceil((8.96+Math.PI*(g.pulleyRadius+.026))/beltSeamSpacing)+1;
 for(let i=0;i<seamCount;i++)add('beltSeam'+i,new THREE.BoxGeometry(.018,.324,.0015),'belt',PALETTE.muted);
 const update=makeBeltGovernorUpdater(root,g,{beltSeamSpacing});
 Object.assign(root.userData,{parts,blocks,families,geometry:g,hideGround:true,sourceScale:.018,reconstructionNote:'Unregistered source assembly. Flat-belt shape follows the native fork; sleeve groove width, fork depths and rear cheeks are inferred. The remote transmission is outside the engraving.'});
 update({spindle:0,leftSpread:g.initialSpread,rightSpread:g.initialSpread,sleeveY:g.sleeveY,bellAngle:0,rodAngle:0,forkY:g.middlePulleyY,qpos:Array(13).fill(0)});markShadows(root);
 return{root,update,dispose:()=>disposeObject3D(root)};
}
