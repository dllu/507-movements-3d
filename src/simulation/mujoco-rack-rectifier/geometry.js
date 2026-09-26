import * as THREE from 'three';
import {rackRectifierSource as s} from './source.js';
import {roundedRackGear} from '../coaxial-gear-geometry.js';
import {plate,poly,polygonClipping as clip,circle,disk} from '../finite-plate-geometry.js';
import {convexPlateCells} from '../mujoco/convex-plate.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {addStubRunOns} from '../rack-frame-guides.js';
export {THREE};
export function makeRackRectifierGeometry({samples=96,cutterSteps=2048,ratchetSamples=64,pawlRadius=.014,ratchetPhase=s.ratchet.phase}={}){
 if(!Number.isInteger(samples)||samples<32||!Number.isInteger(cutterSteps)||cutterSteps<256||!Number.isInteger(ratchetSamples)||ratchetSamples<16||!Number.isFinite(pawlRadius)||pawlRadius<=0||!Number.isFinite(ratchetPhase))throw new RangeError('Invalid 116 geometry options');
 const root=new THREE.Group(),parts={},families={},blocks={},cells={},m=s.pinion.module,R=s.pinion.teeth*m/2,pitch=Math.PI*m,cutterR=R+s.pinion.profileShift*m,alpha=14.5*Math.PI/180,corner=.12*m,clearance=.001,rackAddendum=1.25,rackDedendum=0.62,rootY=cutterR+rackDedendum*m,tipY=cutterR-rackAddendum*m+clearance,amplitude=R*Math.PI/2;
 const f={source:s,axis:s.axis,pitchRadius:R,cutterPitchRadius:cutterR,pitch,module:m,pressureAngle:alpha,rootY,rackTipY:tipY,amplitude,origins:s.pinion.origins,counts:{upper:12,lower:12},samples,cutterSteps,ratchetSamples,pawlRadius,ratchetPhase,gearZ:.18,pawlZ:.38,pawlPivot:s.pawlPivot};
 for(const n of ['frame','upper','lower','output','upperPawl','lowerPawl']){blocks[n]=new THREE.Group();root.add(blocks[n]);}
 const add=(name,g,family,color)=>{const mesh=new THREE.Mesh(g,matte(color,{metalness:.18,roughness:.55}));mesh.name=name;blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;},local=([x,y])=>[(x-s.axis[0])/100,(s.axis[1]-y)/100];
 const path=new THREE.Shape();path.moveTo(35,273);path.bezierCurveTo(41,251,49,229,68,216);path.bezierCurveTo(87,204,105,207,131,206);path.lineTo(389,202);path.bezierCurveTo(425,200,444,210,458,232);path.bezierCurveTo(473,254,466,272,490,273);path.lineTo(505,273);path.lineTo(505,306);path.lineTo(487,306);path.bezierCurveTo(466,306,472,326,452,346);path.bezierCurveTo(438,363,416,369,388,369);path.lineTo(121,373);path.bezierCurveTo(82,374,52,353,36,312);path.closePath();
 const inner=[],left=local([115,s.axis[1]])[0],right=local([390,s.axis[1]])[0],leftEnd=local([s.frame.leftInner,s.axis[1]])[0],rightEnd=local([s.frame.rightInner,s.axis[1]])[0];
 for(let i=0;i<=128;i++){const a=-Math.PI/2+Math.PI*i/128;inner.push([right+(rightEnd-right)*Math.cos(a),rootY*Math.sin(a)]);}for(let i=0;i<=128;i++){const a=Math.PI/2+Math.PI*i/128;inner.push([left+(left-leftEnd)*Math.cos(a),rootY*Math.sin(a)]);}
 const body=clip.difference(poly(path.getPoints(24).map(p=>local(p.toArray()))),poly(inner));
 // Brown draws square-looking teeth. A 14.5 degree pressure angle keeps the
 // flanks steep; the +1-shifted pinion is cut short (addendum .42, dedendum
 // 1.35) to leave broad flat lands, and the rack teeth (addendum 1.25,
 // dedendum .62) reach past the pitch point so contact still overlaps
 // (ratio about 1.35).
 const circleY=tipY+corner,circleX=pitch/4-rackAddendum*m*Math.tan(alpha)-corner*(1/Math.cos(alpha)-Math.tan(alpha)),tooth=[[-(pitch/4+(rackDedendum*m-clearance)*Math.tan(alpha)),rootY]];
 for(let i=0;i<=16;i++){const a=Math.PI+alpha+(Math.PI/2-alpha)*i/16;tooth.push([-circleX+corner*Math.cos(a),circleY+corner*Math.sin(a)]);}tooth.push([circleX,tipY]);for(let i=1;i<=16;i++){const a=-Math.PI/2+(Math.PI/2-alpha)*i/16;tooth.push([circleX+corner*Math.cos(a),circleY+corner*Math.sin(a)]);}tooth.push([pitch/4+(rackDedendum*m-clearance)*Math.tan(alpha),rootY]);
 // Brown draws one solid pinion: the front one is a single strong colour that
 // stands apart from its brass ratchet, the rear one a muted grey behind it.
 const rackShapes={};for(const [name,side,z,color]of [['upper',1,-f.gearZ,PALETTE.muted],['lower',-1,f.gearZ,PALETTE.driver]]){
  const rack=[];for(let i=0;i<12;i++)rack.push(poly(tooth.map(([x,y])=>[x+s.pinion.origins[name]+i*pitch,side*y])));
  // Each rack and its full outer frame slab form one connected solid.
  rackShapes[name]=clip.union(body,...rack);
  add(name+'Rack',plate(rackShapes[name],z-.08,z+.08),'frame',PALETTE.driven);
  const g=roundedRackGear({teeth:s.pinion.teeth,module:m,depth:.16,boreRadius:s.shaftRadius+.002,addendum:.42,dedendum:1.35,pressureAngle:alpha,profileShift:s.pinion.profileShift,tipRadius:corner,samples,cutterSteps});g.rotateZ(s.pinion.phase);g.translate(0,0,z);add(name,g,name,color);
 }
 // Three disjoint axial interiors meet at welded faces.
 add('middleFrame',plate(body,-.10,.10),'frame',PALETTE.driven);
 for(const [name,ps]of [['leftStub',[[8,274],[35,273],[36,312],[8,314]]],['rightStub',[[505,273],[511,273],[514,280],[514,300],[510,307],[505,306]]]])add(name,plate(poly(ps.map(local)),-.08,.08),'frame',PALETTE.driven);
 const rp=2*Math.PI/s.ratchet.teeth,rs=[],aTip=ratchetPhase+(1-s.ratchet.faceFraction)*rp,aRoot=ratchetPhase+rp;
 for(let i=0;i<s.ratchet.teeth;i++)for(let j=0;j<=ratchetSamples;j++){
  const t=j/ratchetSamples,a=ratchetPhase+i*rp+t*(1-s.ratchet.faceFraction)*rp,r=s.ratchet.rootRadius+(s.ratchet.tipRadius-s.ratchet.rootRadius)*t;rs.push([r*Math.cos(a),r*Math.sin(a)]);
 }
 const shape=clip.difference(poly(rs),poly(circle([0,0],s.shaftRadius,96))),a=[s.ratchet.tipRadius*Math.cos(aTip),s.ratchet.tipRadius*Math.sin(aTip)],b=[s.ratchet.rootRadius*Math.cos(aRoot),s.ratchet.rootRadius*Math.sin(aRoot)],edge=new THREE.Vector2(b[0]-a[0],b[1]-a[1]),normal=new THREE.Vector2(edge.y,-edge.x).normalize(),nose=a.map((v,i)=>(v+b[i])/2+(pawlRadius+.00015)*normal.getComponent(i)),offset=nose.map((v,i)=>v-s.pawlPivot[i]);
 f.nose=nose;f.noseOffset=offset;f.ratchetFace={a,b,normal:normal.toArray()};
 for(const [name,z]of [['upper',-f.pawlZ],['lower',f.pawlZ]]){
  add(name+'Ratchet',plate(shape,z-.045,z+.045),'output',PALETTE.brass);
  const thickness=.026,axis=new THREE.Vector2(...offset).normalize(),perp=new THREE.Vector2(-axis.y,axis.x),ps=[];
  for(let i=0;i<=32;i++){const a=Math.PI/2+Math.PI*i/32;ps.push([thickness*(axis.x*Math.cos(a)+perp.x*Math.sin(a)),thickness*(axis.y*Math.cos(a)+perp.y*Math.sin(a))]);}
  for(let i=0;i<=32;i++){const a=-Math.PI/2+Math.PI*i/32;ps.push([offset[0]+pawlRadius*(axis.x*Math.cos(a)+perp.x*Math.sin(a)),offset[1]+pawlRadius*(axis.y*Math.cos(a)+perp.y*Math.sin(a))]);}
  const pawl=clip.difference(poly(ps),poly(circle([0,0],.013,48)));add(name+'Pawl',plate(pawl,z-.04,z+.04),name+'Pawl',PALETTE.muted);
  blocks[name+'Pawl'].position.set(...s.pawlPivot,0);
  const pin=add(name+'PawlPin',disk(.0125,z>0?.26:z-.046,z>0?z+.046:-.26,48),name,PALETTE.ink);pin.position.set(...s.pawlPivot,0);
 }
 add('shaft',disk(s.shaftRadius,-.50,.50,96),'output',PALETTE.ink);
 const cellParts=Object.entries(parts).filter(([name])=>!name.includes('Pin')&&name!=='shaft'&&!name.includes('Stub')).map(([name,mesh])=>[name,mesh.geometry]),buildCells=()=>{for(const [name,geometry] of cellParts){const c=convexPlateCells(geometry);cells[name]={family:families[name],vertices:c.cells.map(p=>[c.low,c.high].flatMap(z=>p.map(q=>[...q,z])))};}};
 Object.assign(root.userData,{parts,families,blocks,profile:f,hideGround:true,shadowCameraHalfExtent:4,shadowBias:-.00002,shadowNormalBias:.0005});
 // Collision cells are for the live simulation only; baked playback never
 // reads them, so they are decomposed on first use (as in 113).
 Object.defineProperty(root.userData,'cells',{configurable:true,enumerable:true,get(){buildCells();Object.defineProperty(root.userData,'cells',{value:cells,writable:true,configurable:true,enumerable:true});return cells;}});
 markShadows(root);root.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(root,true);bounds.expandByVector(new THREE.Vector3(amplitude+.06,.08,.02));root.userData.cameraFitBounds=bounds;
 // Brown breaks the frame's end stubs off at the plate edge. They run on
 // straight, as one piece with the frame, far enough that their clean ends
 // never enter the drawn view; no guides or floor posts are added (p60).
 addStubRunOns({add,movingFamily:'frame',travel:{left:amplitude+.04,right:amplitude+.04},
  stubs:[{tipX:local([8,294])[0],y:local([0,294])[1],halfHeight:(314-274)/200,halfDepth:.08,sign:-1},
   {tipX:local([514,290])[0],y:local([0,290])[1],halfHeight:(300-280)/200,halfDepth:.08,sign:1}]});
 // The output shaft keeps its plain rear stub (part of its native inertia).
 add('shaftTail0',disk(s.shaftRadius,-.696,-.499,96),'output',PALETTE.ink);
 root.updateMatrixWorld(true);
 // The frame slides a full amplitude each way; keep both ends in view.
 root.userData.cameraDistanceScale=1.22;
 // Brown draws the frame and pinions in a flat face view.
 return{root,focus:new THREE.Vector3(0,0,0),cameraDirection:new THREE.Vector3(.02,.015,1)};
}
