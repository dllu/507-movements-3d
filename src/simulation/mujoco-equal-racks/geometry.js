import * as THREE from 'three';
import {equalRacksSource as s} from './source.js';
import {roundedRackGear} from '../coaxial-gear-geometry.js';
import {plate,poly,polygonClipping,disk} from '../finite-plate-geometry.js';
import {convexPlateCells} from '../mujoco/convex-plate.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};
export function makeEqualRacksGeometry({samples=96,cutterSteps=2048,amplitude=.75,addendum=.8,dedendum=1.25}={}){
 if(!Number.isInteger(samples)||samples<32||!Number.isInteger(cutterSteps)||cutterSteps<256||!Number.isFinite(amplitude)||amplitude<=0||amplitude>1||![addendum,dedendum].every(x=>Number.isFinite(x)&&x>0))throw new RangeError('Invalid 115 geometry options');
 const root=new THREE.Group(),parts={},families={},blocks={},cells={},m=s.module,R=s.teeth*m/2,O=s.workingRadius,pitch=Math.PI*m,alpha=Math.PI/9,workingAngle=Math.acos(R*Math.cos(alpha)/O),inv=a=>Math.tan(a)-a,shift=s.teeth*(inv(workingAngle)-inv(alpha))/(2*Math.tan(alpha)),cutterR=R+shift*m,corner=.12*m,clearance=.001;
 const local=([x,y])=>[(Math.cos(s.tilt)*(x-s.axis[0])+Math.sin(s.tilt)*(s.axis[1]-y))/100,(-Math.sin(s.tilt)*(x-s.axis[0])+Math.cos(s.tilt)*(s.axis[1]-y))/100];
 const f={source:s,axis:s.axis,tilt:s.tilt,samples,cutterSteps,module:m,pitchRadius:R,workingRadius:O,pitch,pressureAngle:alpha,workingAngle,profileShift:shift,cutterPitchRadius:cutterR,corner,clearance,addendum,dedendum,amplitude,origins:s.origins,counts:{upper:10,lower:9}};
 for(const n of ['upper','lower','frame']){blocks[n]=new THREE.Group();root.add(blocks[n]);}
 const add=(name,g,family,color)=>{const mesh=new THREE.Mesh(g,matte(color,{metalness:.18,roughness:.55}));mesh.name=name;blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;};
 for(const [name,side,phase,color]of [['upper',1,s.phase,PALETTE.driver],['lower',-1,s.lowerPhase,PALETTE.accent]]){
  blocks[name].position.y=side*O;
  const gear=roundedRackGear({teeth:s.teeth,module:m,depth:.24,boreRadius:s.circles[name].radius/100,addendum,dedendum,profileShift:shift,tipRadius:corner,samples,cutterSteps});gear.rotateZ(phase);add(name,gear,name,color);
  add(name+'Shaft',disk(s.circles[name].radius/100,-.22,.18,96),name,PALETTE.ink);
 }
 const path=new THREE.Shape();path.moveTo(20,257);path.bezierCurveTo(37,257,41,248,48,226);path.bezierCurveTo(62,193,84,165,111,150);path.bezierCurveTo(130,138,150,141,179,141);path.lineTo(378,139);path.bezierCurveTo(401,138,420,150,437,165);path.bezierCurveTo(463,188,478,219,486,239);path.bezierCurveTo(491,248,497,250,505,252);path.lineTo(504,316);path.bezierCurveTo(492,316,487,322,482,338);path.bezierCurveTo(465,377,438,412,402,424);path.bezierCurveTo(388,429,369,426,346,427);path.lineTo(144,426);path.bezierCurveTo(117,426,98,414,79,393);path.bezierCurveTo(57,369,47,344,40,329);path.bezierCurveTo(37,323,29,321,20,319);path.closePath();
 const outline=poly(path.getPoints(24).map(p=>local(p.toArray()))),rootY=O+cutterR+.95*m,bottom=O+cutterR-dedendum*m+clearance,inner=[];
 const leftCenter=local([151,s.axis[1]])[0],rightCenter=local([386,s.axis[1]])[0],leftEnd=local([s.frame.leftInner,s.axis[1]])[0],rightEnd=local([s.frame.rightInner,s.axis[1]])[0];
 const cap=(c,t)=>[c[0]+c[1]*t+Math.sqrt(Math.max(0,1-t*t))*(c[2]+c[3]*t+c[4]*t*t),rootY*t];
 for(let i=0;i<=128;i++){const a=-Math.PI/2+Math.PI*i/128;inner.push(cap(s.caps.innerRight,Math.sin(a)));}
 for(let i=0;i<=128;i++){const a=Math.PI/2+Math.PI*i/128;inner.push(cap(s.caps.innerLeft,Math.sin(a)));}
 const body=polygonClipping.difference(outline,poly(inner)),circleY=bottom+corner,circleX=pitch/4-dedendum*m*Math.tan(alpha)-corner*(1/Math.cos(alpha)-Math.tan(alpha)),tooth=[[-(pitch/4+(.95*m-clearance)*Math.tan(alpha)),rootY]];
 for(let i=0;i<=16;i++){const a=Math.PI+alpha+(Math.PI/2-alpha)*i/16;tooth.push([-circleX+corner*Math.cos(a),circleY+corner*Math.sin(a)]);}tooth.push([circleX,bottom]);
 for(let i=1;i<=16;i++){const a=-Math.PI/2+(Math.PI/2-alpha)*i/16;tooth.push([circleX+corner*Math.cos(a),circleY+corner*Math.sin(a)]);}tooth.push([pitch/4+(.95*m-clearance)*Math.tan(alpha),rootY]);
 const racks=[];for(const [name,side]of [['upper',1],['lower',-1]])for(let i=0;i<f.counts[name];i++)racks.push(poly(tooth.map(([x,y])=>[x+s.origins[name]+i*pitch,side*y])));
 add('frame',plate(polygonClipping.union(body,...racks),-.12,.12),'frame',PALETTE.driven);
 const rightWall=y=>505-(y-252)/64;
 for(const [name,points]of [['leftStub',[[8,272],[20,272],[20,307],[8,307]]],['rightStub',[[rightWall(262),262],[518,262],[518,300],[rightWall(300),300]]]])add(name,plate(poly(points.map(local)),-.07,.07),'frame',PALETTE.driven);
 Object.assign(f,{rootY,rackTipY:bottom,leftCenter,rightCenter,leftEnd,rightEnd});
 const cellGeometry=Object.fromEntries(['upper','lower','frame'].map(n=>[n,parts[n].geometry])),buildCells=()=>{for(const [n,g] of Object.entries(cellGeometry)){const c=convexPlateCells(g);cells[n]=c.cells.map(poly=>[c.low,c.high].flatMap(z=>poly.map(p=>[...p,z])));}};
 // Collision cells are for the live simulation only; baked playback never
 // reads them, so they are decomposed on first use (as in 113).
 Object.defineProperty(root.userData,'cells',{configurable:true,enumerable:true,get(){buildCells();Object.defineProperty(root.userData,'cells',{value:cells,writable:true,configurable:true,enumerable:true});return cells;}});
 root.rotation.z=s.tilt;Object.assign(root.userData,{parts,families,blocks,profile:f,hideGround:true,shadowCameraHalfExtent:4,shadowBias:-.00002,shadowNormalBias:.0005});markShadows(root);root.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(root,true);bounds.expandByVector(new THREE.Vector3(amplitude*Math.abs(Math.cos(s.tilt))+.04,amplitude*Math.abs(Math.sin(s.tilt))+.04,.04));root.userData.cameraFitBounds=bounds;root.userData.sampledMotionBounds={min:bounds.min.toArray(),max:bounds.max.toArray()};
 // Brown draws the frame's short end tabs whole, so they end there; no
 // run-ons, guides or floor posts are added (p60 support policy).
 root.updateMatrixWorld(true);
 return{root,focus:new THREE.Vector3(0,0,0),cameraDirection:new THREE.Vector3(1.5,1,10)};
}
