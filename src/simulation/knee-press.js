import * as THREE from 'three';
import {plate,poly,circle,disk,polygonClipping as clip} from './finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';
import {kneePressGeometry,kneePressState} from './knee-press-motion.js';

export function makeKneePress(){
 const g=kneePressGeometry(),root=new THREE.Group(),parts={},families={},blocks={},materials=new Map();
 const group=name=>{const b=new THREE.Group();b.name='body:'+name;root.add(b);blocks[name]=b;return b;};
 const fixed=group('fixed'),top=group('top'),lever=group('lever'),link=group('link');
 const point=([x,y])=>[(x-239)*.018,4+(73-y)*.018];
 const shape=(draw,origin)=>{const s=new THREE.Shape(),api={move:(x,y)=>s.moveTo(x,y),line:(x,y)=>s.lineTo(x,y),curve:(...p)=>s.bezierCurveTo(...p)};draw(api);s.closePath();return poly(s.getPoints(24).map(p=>{const q=point([p.x,p.y]);return[q[0]-origin[0],q[1]-origin[1]];}));};
 const add=(name,geometry,family,color,position=[0,0,0])=>{if(!materials.has(color)){const m=matte(color);m.fog=false;materials.set(color,m);}const mesh=new THREE.Mesh(geometry,materials.get(color));mesh.name=name;mesh.position.set(...position);blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;};
 // Brown draws the ground and the pressed platen as hatched lines, not slabs:
 // a ground line with 45-degree hatch strokes on the side away from the lever.
 const hatchedLine=(name,family,width,height,center,hatchBelow)=>{
  const g0=new THREE.BoxGeometry(width,.045,.96);g0.translate(0,hatchBelow?height/2-.0225:-height/2+.0225,0);
  const line=add(name,g0,family,PALETTE.ink,center);
  const count=Math.round(width/.16),length=(height-.045)*Math.SQRT2;
  for(let i=0;i<count;i++){const stroke=new THREE.Mesh(new THREE.BoxGeometry(.022,length,.02),line.material);
   stroke.position.set(-width/2+(height/2)+(width-height)*i/(count-1),hatchBelow?-.0225:.0225,.47);stroke.rotation.z=Math.PI/4;
   stroke.name=name+'HatchStroke';line.add(stroke);}
  return line;};
 hatchedLine('base','fixed',6.768,.36,[point([235,491])[0],point([235,491])[1]-.18,-.16],true);
 const blockOutline=poly([[202,454],[279,454],[279,491],[202,491]].map(point)),cup=clip.union(poly(circle(g.foot,.184,96)),poly([[g.foot[0]-.159,g.foot[1]-.092],[g.foot[0]+.159,g.foot[1]-.092],[g.foot[0]+.34,g.foot[1]+.15],[g.foot[0]-.34,g.foot[1]+.15]]));
 add('footCup',plate(clip.difference(blockOutline,cup),-.44,-.12),'fixed',PALETTE.frame);
 add('cupRear',plate(blockOutline,-.54,-.46),'fixed',PALETTE.frame);
 hatchedLine('topPlate','top',4.86,.40,[.072,.56,0],false);
 const cheek=shape(p=>{p.move(218,53);p.line(270,53);p.curve(266,80,256,97,239,98);p.curve(222,98,210,87,216,70);p.line(218,53);},g.top);
 const cheeks=clip.difference(cheek,poly(circle([0,0],.174,96)));
 add('upperCheekFront',plate(cheeks,.18,.32),'top',PALETTE.driven);add('upperCheekRear',plate(cheeks,-.32,-.18),'top',PALETTE.driven);
 add('upperPin',disk(.17,-.35,.35,96),'top',PALETTE.ink);
 const leverOutline=shape(p=>{p.move(222,78);p.curve(222,52,252,51,255,79);p.curve(259,98,265,104,281,112);p.curve(314,125,463,162,499,173);p.curve(502,177,500,188,496,193);p.line(275,143);p.curve(249,136,244,146,231,162);p.curve(214,182,187,169,191,147);p.curve(193,124,211,91,222,78);},g.top);
 add('curvedLever',plate(clip.difference(leverOutline,poly(circle([0,0],.174,96)),poly(circle(g.upper,.174,96))),-.12,.12),'lever',PALETTE.driver);
 add('kneePin',disk(.17,-.44,.15,96),'lever',PALETTE.ink,[...g.upper,0]);
 const lowerOutline=shape(p=>{p.move(190,195);p.curve(190,295,200,404,231,456);p.curve(231,462,235,466,241,466);p.curve(247,466,251,462,251,456);p.curve(266,360,254,263,237,195);p.curve(230,190,224,179,224,162);p.line(202,162);p.curve(204,179,200,190,190,195);},g.foot);
 const kneeRelative=[g.top[0]+g.upper[0]-g.foot[0],g.top[1]+g.upper[1]-g.foot[1]],roundFoot=poly(circle([0,0],.18,96));
 // A true circular tip defines the cup bearing; the taper meets its upper half.
 const trimmed=clip.difference(lowerOutline,poly([[-1,-1],[1,-1],[1,0],[-1,0]]));
 add('taperedLink',plate(clip.difference(clip.union(trimmed,roundFoot,poly(circle(kneeRelative,.30,96))),poly(circle(kneeRelative,.174,96))),-.40,-.16),'link',PALETTE.brass);
 const initialLower=kneePressState(0,g).lowerAngle;
 const update=time=>{const s=kneePressState(time,g);top.position.set(...s.top,0);lever.position.set(...s.top,0);lever.rotation.z=s.angle;link.position.set(...g.foot,0);link.rotation.z=s.lowerAngle-initialLower;root.updateMatrixWorld(true);root.userData.state=s;};
 update(0);const bounds=new THREE.Box3();for(let i=0;i<=128;i++){update(g.period*i/128);bounds.union(new THREE.Box3().setFromObject(root,true));}bounds.expandByScalar(.04);update(0);markShadows(root);
 Object.assign(root.userData,{parts,families,geometry:g,mechanism:'knee-lever-press',simulationBackend:'analytic',fidelity:'authored',reconstructionStatus:'reconstructed',supportsRestart:true,hideGround:true,cameraFitBounds:bounds,cameraFov:8,animationTiming:{authoredCyclePeriod:g.period,displayCycleDuration:g.period,playbackTimeScale:1},reconstructionNote:'The curved lever straightens the knee to raise the upper pressure plate. The lower rounded foot rocks in its cup. Depths and the hidden upper guide are inferred; motion stops just short of dead center.'});
 return{root,update,reset:()=>update(0),focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(.01,.01,15),dispose:()=>disposeObject3D(root)};
}
