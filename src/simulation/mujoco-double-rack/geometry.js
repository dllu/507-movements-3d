import * as THREE from 'three';
import {doubleRackSource as s} from './source.js';
import {relieveSectorEnds} from './end-relief.js';
import {roundedRackGear} from '../coaxial-gear-geometry.js';
import {plate,poly,circle,polygonClipping,disk,ring} from '../finite-plate-geometry.js';
import {convexPlateCells} from '../mujoco/convex-plate.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {addStubRunOns} from '../rack-frame-guides.js';
export {THREE};
// The sector phase leaves clearance at both frame ends. The engraving
// places the right-facing sector too near the middle of the available stroke.
export function makeDoubleRackGeometry({samples=96,cutterSteps=2048,module=.0725,phase=0,sectorCenter=-5*Math.PI/14,sectorSpan=Math.PI,clearance=.001,frameOffset=0,upperOffset=0,endRelief=true,reliefSteps=1024,transitionAngle=.2,reliefClearance=.0008}={}){
 if(!Number.isInteger(samples)||samples<32||!Number.isInteger(cutterSteps)||cutterSteps<256||![module,phase,sectorCenter,sectorSpan,clearance,frameOffset,upperOffset,transitionAngle,reliefClearance].every(Number.isFinite)||module<=0||clearance<0||sectorSpan<=0||sectorSpan>Math.PI*1.2||!Number.isInteger(reliefSteps)||reliefSteps<128||transitionAngle<0||transitionAngle>Math.PI/2||reliefClearance<0||Math.abs(sectorCenter+Math.PI/2)>Math.PI/2-transitionAngle)throw new RangeError('Invalid double-rack geometry options');
 const root=new THREE.Group(),parts={},families={},blocks={},cells={},teeth=14,R=7*module,pitch=Math.PI*module,alpha=Math.PI/9,corner=.12*module,addendum=.8,dedendum=1.45;
 const local=([x,y])=>[(x-s.axis[0])/100,(s.axis[1]-y)/100],rackMean=s.teeth.reduce((sum,p)=>sum+((p.center-s.axis[0])/100-p.index*pitch)/s.teeth.length,0),originBase=R*(phase+Math.PI/2)-pitch/2,rackOrigin=originBase+Math.round((rackMean-originBase)/pitch)*pitch;
 const f={source:s,axis:s.axis,samples,cutterSteps,module,pitchRadius:R,pitch,phase,sectorCenter,sectorSpan,clearance,frameOffset,upperOffset,endRelief,reliefSteps,transitionAngle,reliefClearance,rackOrigin,pressureAngle:alpha,addendum,dedendum,rootY:R+.95*module,rackTipY:R-dedendum*module+clearance,rootRadius:R-dedendum*module,outerRadius:R+addendum*module};
 for(const n of ['pinion','frame']){blocks[n]=new THREE.Group();root.add(blocks[n]);}
 const add=(name,g,family,color)=>{const mesh=new THREE.Mesh(g,matte(color,{metalness:.18,roughness:.55}));mesh.name=name;blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;};
 const full=roundedRackGear({teeth,module,depth:.24,boreRadius:s.circles.shaft.radius/100,addendum,dedendum,tipRadius:corner,samples,cutterSteps}),rotate=([x,y],a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
 if(endRelief)full.userData.outline=relieveSectorEnds(full.userData.outline,{
  ...f,bottom:R-dedendum*module+clearance,corner,pressureAngle:alpha,
  // Use the actual cutter pitch line, displaced by the radial clearance.
  pitchRadius:R,cutterPitchRadius:R+clearance,rootRadius:full.userData.rootRadius,
 });
 // One radial boundary avoids tiny Boolean slivers where the root circle
 // meets an end relieved down to exactly the same radius.
 const outline=full.userData.outline.map(p=>{
  const q=rotate(p.toArray(),phase),a=Math.atan2(q[1],q[0]);
  const delta=Math.atan2(Math.sin(a-sectorCenter),Math.cos(a-sectorCenter));
  const r=Math.abs(delta)<=sectorSpan/2+1e-10?Math.hypot(...q):full.userData.rootRadius;
  return [r*Math.cos(a),r*Math.sin(a)];
 }),outer=poly(outline),bore=poly(circle([0,0],s.circles.shaft.radius/100,128));
 const gear=plate(polygonClipping.difference(outer,bore),-.12,.12);gear.userData.toothProfile=full.userData;full.dispose();add('pinion',gear,'pinion',PALETTE.driver);
 const shaftRadius=s.circles.shaft.radius/100;add('shaft',disk(shaftRadius,-.2,.19,96),'pinion',PALETTE.ink);add('hub',ring(shaftRadius,s.circles.hub.radius/100,.12,.155,96),'pinion',PALETTE.driver);
 const path=new THREE.Shape();path.moveTo(13,281.5);path.lineTo(79,281.5);path.bezierCurveTo(91,281.5,92,276,95,265);path.bezierCurveTo(103,238,122,219,148,213);path.bezierCurveTo(164,209,185,212,214,212);path.lineTo(367,213);path.bezierCurveTo(397,215,422,239,429,262);path.bezierCurveTo(433,275,431,280,449,280);path.lineTo(505,280);path.lineTo(501,305);path.lineTo(446,304.7);path.bezierCurveTo(434,304.7,433,307,429,318);path.bezierCurveTo(420,347,397,369,371,372);path.lineTo(165,373);path.bezierCurveTo(135,369,108,350,97,324);path.bezierCurveTo(92,312,92,305.3,79,305.3);path.lineTo(17,305.3);path.closePath();
 const frameOuter=poly(path.getPoints(16).map(p=>local(p.toArray()))),rootY=R+.95*module,inner=[];
 for(let i=0;i<=128;i++){const a=-Math.PI/2+Math.PI*i/128;inner.push([.90+((s.frame.rightInner-s.axis[0])/100-.90)*Math.cos(a),rootY*Math.sin(a)]);}
 for(let i=0;i<=128;i++){const a=Math.PI/2+Math.PI*i/128;inner.push([-.90+(-.90-(s.frame.leftInner-s.axis[0])/100)*Math.cos(a),rootY*Math.sin(a)]);}
 const body=polygonClipping.difference(frameOuter,poly(inner)),bottom=R-dedendum*module+clearance,circleY=bottom+corner,circleX=pitch/4-dedendum*module*Math.tan(alpha)-corner*(1/Math.cos(alpha)-Math.tan(alpha));
 const tooth=[[-(pitch/4+(rootY-R-clearance)*Math.tan(alpha)),rootY]];
 for(let i=0;i<=16;i++){const a=Math.PI+alpha+(Math.PI/2-alpha)*i/16;tooth.push([-circleX+corner*Math.cos(a),circleY+corner*Math.sin(a)]);}tooth.push([circleX,bottom]);
 for(let i=1;i<=16;i++){const a=-Math.PI/2+(Math.PI/2-alpha)*i/16;tooth.push([circleX+corner*Math.cos(a),circleY+corner*Math.sin(a)]);}tooth.push([pitch/4+(rootY-R-clearance)*Math.tan(alpha),rootY]);
 const racks=[];for(const side of [-1,1])for(let i=0;i<9;i++)racks.push(poly(tooth.map(([x,y])=>[x+rackOrigin+i*pitch+(side===1?upperOffset:0),side*y])));
 const frame=plate(polygonClipping.union(body,...racks),-.12,.12);frame.translate(frameOffset,0,0);add('frame',frame,'frame',PALETTE.driven);
 const cellGeometry=Object.fromEntries(['pinion','frame'].map(n=>[n,parts[n].geometry])),buildCells=()=>{for(const [n,g] of Object.entries(cellGeometry)){const c=convexPlateCells(g);cells[n]=c.cells.map(poly=>[c.low,c.high].flatMap(z=>poly.map(p=>[...p,z])));}};
 // Brown breaks the frame's end stubs off at the plate edge. They run on
 // straight, as one piece with the frame, far enough that their clean ends
 // never enter the drawn view; no guides or floor posts are added (p60).
 addStubRunOns({add,movingFamily:'frame',travel:{left:1.15,right:.7},
  stubs:[{tipX:local([15,0])[0]+frameOffset,y:local([0,(281.5+305.3)/2])[1],halfHeight:(305.3-281.5)/200,halfDepth:.12,sign:-1},
   {tipX:local([503,0])[0]+frameOffset,y:local([0,292.5])[1],halfHeight:(305-280)/200,halfDepth:.12,sign:1}]});
 Object.assign(root.userData,{parts,families,blocks,profile:f,hideGround:true,shadowCameraHalfExtent:4,shadowBias:-.00002,shadowNormalBias:.0005});
 // Collision cells are for the live simulation only; baked playback never
 // reads them, so they are decomposed on first use (as in 113).
 Object.defineProperty(root.userData,'cells',{configurable:true,enumerable:true,get(){buildCells();Object.defineProperty(root.userData,'cells',{value:cells,writable:true,configurable:true,enumerable:true});return cells;}});
 markShadows(root);root.updateMatrixWorld(true);return{root,focus:new THREE.Vector3(0,0,0),cameraDirection:new THREE.Vector3(1.5,1,10)};
}
