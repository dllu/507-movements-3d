import * as THREE from 'three';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
import {matte,PALETTE,markShadows} from './primitives.js';
import {cylindricalWormGeometry} from './worm-gear-geometry.js';
import {boreWormGeometry} from './bored-worm-geometry.js';
import {makeInstancedWormWheel} from './instanced-worm-wheel.js';
import {slidingWormDimensions as g,slidingWormAtTime} from './sliding-worm-kinematics.js';
import {disposeObject3D} from './dispose-model.js';
const rectangle=(a,b,c,d)=>poly([[a,b],[c,b],[c,d],[a,d]]);
const disk=(r)=>poly(circle([0,0],r,128));
const ring=(r,bore)=>clip.difference(disk(r),disk(bore));

// Offline assembly. All expensive generated surfaces are supplied by the bake.
export function makeSlidingWormGeometry(cut){
 const root=new THREE.Group(),parts={},blocks={};
 for(const name of ['fixed','shaft','carriage','worm','wheel','rod']){blocks[name]=new THREE.Group();blocks[name].name='body:'+name;}
 root.add(blocks.fixed,blocks.shaft,blocks.carriage,blocks.rod);blocks.carriage.add(blocks.worm,blocks.wheel);
 blocks.shaft.position.y=g.shaftY;blocks.worm.position.y=g.shaftY;
 const materials=Object.fromEntries(['frame','driver','driven','accent','ink'].map(n=>[n,matte(PALETTE[n],{metalness:.15,roughness:.6,fog:false})]));
 const add=(name,geometry,body,color)=>{const mesh=new THREE.Mesh(geometry,materials[color]);mesh.name=name;blocks[body].add(mesh);parts[name]=mesh;return mesh;};
 const xy=(name,shape,low,high,body,color)=>add(name,plate(shape,low,high),body,color);
 // An XY section turned around Y gives a YZ section extruded along X.
 const alongX=(name,shape,low,high,body,color)=>add(name,plate(shape,low,high).rotateY(Math.PI/2),body,color);
 const left=-3.12,right=3.045,baseY=-1.12875;
 xy('base',rectangle(-3.9,baseY-.15,3.69,baseY),-.75,.2,'fixed','frame');
 for(const [side,x]of [['left',left],['right',right]]){
  xy(side+'-post',rectangle(x-.18,baseY,x+.18,g.shaftY+.3),-.65,-.35,'fixed','frame');
  // Local section coordinates are [-worldZ, worldY].
  const bearing=clip.difference(rectangle(-.18,g.shaftY-.2,.65,g.shaftY+.2),poly(circle([0,g.shaftY],.058,128)));
  alongX(side+'-shaft-bearing',bearing,x-.15,x+.15,'fixed','frame');
 }
 xy('guide',rectangle(left+.15,-.24375,right-.15,.19125),-.54,-.36,'fixed','frame');
 xy('left-brace',clip.difference(poly([[-3.86,baseY],[-3.86,baseY+.18],[-3.24,baseY+.72],[-3.12,baseY+.72],[-3.12,baseY]]),poly([[-3.68,baseY+.16],[-3.30,baseY+.52],[-3.30,baseY+.16]])),-.65,-.36,'fixed','frame');
 const sleeve=clip.difference(rectangle(.20,-.4,.66,.35),rectangle(.355,-.24875,.545,.19625));
 alongX('bored-carriage',sleeve,-.99,.99,'carriage','driven');
 for(const [side,x]of [['left',-.60],['right',.60]]){
  const outer=clip.union(poly(circle([0,g.shaftY],.20,128)),rectangle(.18,.2,.32,g.shaftY+.05));
  alongX(side+'-worm-bearing',clip.difference(outer,poly(circle([0,g.shaftY],.148,128))),x-.08,x+.08,'carriage','driven');
 }
 alongX('shaft',disk(.055),-3.94,3.4,'shaft','ink');
 // Key ends before the two fixed plain bearings.
 alongX('longitudinal-key',rectangle(-.0225,.054,.0225,.09),left+.18,right-.18,'shaft','accent');
 alongX('pulley',ring(.78,.056),-3.8,-3.56,'shaft','driver');
 alongX('pulley-index',rectangle(-.035,.40,.035,.68),-3.812,-3.803,'shaft','accent');
 const bore=clip.union(disk(.058),rectangle(-.025,.04,.025,.094))[0][0].slice(0,-1);
 const localBore=bore.map(([x,y])=>[x*Math.cos(g.wormPhase)+y*Math.sin(g.wormPhase),-x*Math.sin(g.wormPhase)+y*Math.cos(g.wormPhase)]);
 const source=cylindricalWormGeometry({pitchRadius:g.wormPitchRadius,module:g.module,length:g.wormLength,pressureAngle:Math.PI/9,angularSteps:512,rootRadius:g.wormPitchRadius-1.25*g.module-.001,tipRadius:g.wormPitchRadius+g.module-.001});
 const worm=boreWormGeometry(source,localBore).rotateY(Math.PI/2).rotateX(g.wormPhase);source.dispose();
 // Axial clipping occasionally leaves a tiny Float32 sliver whose stored
 // analytic normal opposes its triangle. Correct those normals locally.
 const positions=worm.attributes.position,normals=worm.attributes.normal;
 for(let i=0;i<positions.count;i+=3){
  const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(positions,i+j)),normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));
  if(normal.lengthSq()<1e-22)continue;
  const stored=new THREE.Vector3();for(let j=0;j<3;j++)stored.add(new THREE.Vector3().fromBufferAttribute(normals,i+j));
  if(normal.dot(stored)<=0){normal.normalize();for(let j=0;j<3;j++)normals.setXYZ(i+j,normal.x,normal.y,normal.z);}
 }
 add('bored-worm',worm,'worm','driver');
 for(const [name,low,high]of [['left-journal',-.71,-g.wormLength/2],['right-journal',g.wormLength/2,.71]])alongX(name,clip.difference(disk(.145),poly(bore)),low,high,'worm','driver');
 const wheel=makeInstancedWormWheel(g,cut,.132,materials.driven);wheel.name='generated-wheel';wheel.rotation.z=g.wheelPhase;blocks.wheel.add(wheel);parts.wheel=wheel;
 xy('wheel-hub',ring(.23,.132),.15,.25,'wheel','driven');
 xy('wheel-axle',disk(.13),-.23,.28,'carriage','ink');
 xy('wheel-cap',disk(.145),.253,.32,'carriage','ink');
 const wrist=poly(circle(g.crank,.15,128));xy('wrist-boss',wrist,.15,.28,'wheel','accent');
 xy('wrist-pin',poly(circle(g.crank,.075,128)),.27,.565,'wheel','ink');
 xy('fixed-rod-pin',poly(circle(g.fixedPivot,.075,128)),-.37,.565,'fixed','ink');
 const rod=clip.difference(clip.union(capsule([0,0],[g.rodLength,0],.045),disk(.145),poly(circle([g.rodLength,0],.145,128))),disk(.0775),poly(circle([g.rodLength,0],.0775,128)));
 xy('connecting-rod',rod,.45,.54,'rod','accent');
 const update=time=>{const s=slidingWormAtTime(time);blocks.shaft.rotation.x=s.inputAngle;blocks.worm.rotation.x=s.inputAngle;blocks.wheel.rotation.z=s.wheelAngle;blocks.carriage.position.x=s.carriageX;blocks.rod.position.set(...s.wrist,0);blocks.rod.rotation.z=s.rodAngle;root.updateMatrixWorld(true);root.userData.state=s;};
 root.userData={parts,blocks,mechanism:'generated-keyed-worm-traverse-candidate',simulationBackend:'analytic',fidelity:'authored',reconstructionStatus:'candidate',supportsRestart:true,hideGround:true,animationTiming:{authoredCyclePeriod:g.period,displayCycleDuration:g.period,playbackTimeScale:1},reconstructionNote:'Generated keyed worm and wheel candidate. Bearing depths, wheel width and supports are reconstructed; complete contact and assembly review is pending.'};
 markShadows(root);update(0);return {root,update,reset:()=>update(0),focus:new THREE.Vector3(-.15,.1,0),cameraDirection:new THREE.Vector3(.05,.03,15),dispose:()=>disposeObject3D(root)};
}
