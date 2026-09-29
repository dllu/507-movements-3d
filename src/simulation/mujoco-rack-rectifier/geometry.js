import * as THREE from 'three';
import {rackRectifierSource as s} from './source.js';
import {roundedRackGear} from '../coaxial-gear-geometry.js';
import {plate,poly,polygonClipping as clip,circle,disk,turned} from '../finite-plate-geometry.js';
import {convexPlateCells} from '../mujoco/convex-plate.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};
// p106: both pawls are dark steel, apart from the muted grey rear pinion
// they lie on and from the brass ratchets they drive.
const PAWL_STEEL=0x474d52;
export function makeRackRectifierGeometry({samples=96,cutterSteps=2048,ratchetSamples=64,pawlSeat=.0002,hook=35*Math.PI/180,innerMeet=.295,pawlUp=125*Math.PI/180,pawlDown=-60*Math.PI/180,heelFraction=1.15,bossRadius=.044,ratchetPhase=s.ratchet.phase}={}){
 if(!Number.isInteger(samples)||samples<32||!Number.isInteger(cutterSteps)||cutterSteps<256||!Number.isInteger(ratchetSamples)||ratchetSamples<16||!Number.isFinite(pawlSeat)||pawlSeat<=0||pawlSeat>.002||!Number.isFinite(ratchetPhase))throw new RangeError('Invalid 116 geometry options');
 const root=new THREE.Group(),parts={},families={},blocks={},cells={},m=s.pinion.module,R=s.pinion.teeth*m/2,pitch=Math.PI*m,cutterR=R+s.pinion.profileShift*m,alpha=14.5*Math.PI/180,corner=.12*m,clearance=.001,rackAddendum=1.25,rackDedendum=0.62,rootY=cutterR+rackDedendum*m,tipY=cutterR-rackAddendum*m+clearance,amplitude=R*Math.PI/2;
 const f={source:s,axis:s.axis,pitchRadius:R,cutterPitchRadius:cutterR,pitch,module:m,pressureAngle:alpha,rootY,rackTipY:tipY,amplitude,origins:s.pinion.origins,counts:{upper:12,lower:12},samples,cutterSteps,ratchetSamples,pawlSeat,ratchetPhase,gearZ:.18,pawlZ:.38,pawlPivot:s.pawlPivot};
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
 const rp=2*Math.PI/s.ratchet.teeth,rs=[],aTip=ratchetPhase+(1-s.ratchet.faceFraction)*rp,aRoot=ratchetPhase+rp;
 for(let i=0;i<s.ratchet.teeth;i++)for(let j=0;j<=ratchetSamples;j++){
  const t=j/ratchetSamples,a=ratchetPhase+i*rp+t*(1-s.ratchet.faceFraction)*rp,r=s.ratchet.rootRadius+(s.ratchet.tipRadius-s.ratchet.rootRadius)*t;rs.push([r*Math.cos(a),r*Math.sin(a)]);
 }
 const shape=clip.difference(poly(rs),poly(circle([0,0],s.shaftRadius,96))),a=[s.ratchet.tipRadius*Math.cos(aTip),s.ratchet.tipRadius*Math.sin(aTip)],b=[s.ratchet.rootRadius*Math.cos(aRoot),s.ratchet.rootRadius*Math.sin(aRoot)];
 // Pass 93 pawl: Brown's broad crescent leaf, one flat plate in the ratchet's
 // plane. A bored eye boss at the pivot; a convex outer arc tangent to the
 // boss runs to the heel; the inner edge is the arc concentric with the shaft
 // that just touches the boss (it clears the ratchet tips by rc - tipRadius);
 // a straight nose underside, cut at the tooth's valley (hook) angle, drops
 // from that arc to the claw tip, which nests in the root. The working face
 // lies along the ratchet's locking face from the tip to the heel. Built in
 // the seated pose (pawl hinge 0), pawlSeat clear of both flanks.
 // p99: Brown's crescent is about 1.2 eye diameters wide along its whole
 // length and its claw face spans the whole locking face. The working face
 // now runs 1.15 face lengths (past the tooth tip), the boss is r 0.044 and
 // the outer arc leaves it at 125 degrees, so the leaf is about 0.09 wide
 // along its length (inscribed width; the pass-93 leaf was 0.04). The
 // heavier leaf needs the stiffer pawl springs in physics.js.
 const P=s.pawlPivot,rel=q=>[q[0]-P[0],q[1]-P[1]],len=Math.hypot(a[0]-b[0],a[1]-b[1]),u=[(a[0]-b[0])/len,(a[1]-b[1])/len],normal=[-u[1],u[0]],rot=(v,t)=>[v[0]*Math.cos(t)-v[1]*Math.sin(t),v[0]*Math.sin(t)+v[1]*Math.cos(t)],along=(q,d,k)=>[q[0]+k*d[0],q[1]+k*d[1]],unit=w=>{const l=Math.hypot(...w);return[w[0]/l,w[1]/l];};
 const rise=(s.ratchet.tipRadius-s.ratchet.rootRadius)/((1-s.ratchet.faceFraction)*rp),back=unit([rise*Math.cos(aRoot)-s.ratchet.rootRadius*Math.sin(aRoot),rise*Math.sin(aRoot)+s.ratchet.rootRadius*Math.cos(aRoot)]);
 const tip=along(along(rel(b),normal,pawlSeat),u,pawlSeat),heel=along(tip,u,heelFraction*len),under=rot(back,-hook),boreRadius=.013,up=pawlUp,down=pawlDown;
 // The nose underside (tip + t*under) rises to radius innerMeet about the
 // shaft; from there the concave inner arc runs to the boss, tangent to it at
 // angle down (external tangency, so the underside bulges away from the
 // ratchet and the tooth tips pass under it while the pawl clicks).
 const C=rel([0,0]),dx=tip[0]-C[0],dy=tip[1]-C[1],B2=dx*under[0]+dy*under[1],tMeet=-B2+Math.sqrt(B2*B2-(dx*dx+dy*dy-innerMeet*innerMeet)),meet=along(tip,under,tMeet);
 const e=[Math.cos(down),Math.sin(down)],bossBottom=[bossRadius*e[0],bossRadius*e[1]],wi=[bossBottom[0]-meet[0],bossBottom[1]-meet[1]],Ri=-(wi[0]*wi[0]+wi[1]*wi[1])/(2*(e[0]*wi[0]+e[1]*wi[1])),Ci=[bossBottom[0]+Ri*e[0],bossBottom[1]+Ri*e[1]];
 if(!(Ri>0))throw new RangeError('116 pawl inner arc must be concave');
 const arcAt=t=>[Ci[0]+Ri*Math.cos(t),Ci[1]+Ri*Math.sin(t)],aBoss=Math.atan2(bossBottom[1]-Ci[1],bossBottom[0]-Ci[0]),aMeet=Math.atan2(meet[1]-Ci[1],meet[0]-Ci[0]);
 // Outer convex arc: tangent to the boss at angle up, through the heel.
 const d=[Math.cos(up),Math.sin(up)],bossTop=[bossRadius*d[0],bossRadius*d[1]],w=[bossTop[0]-heel[0],bossTop[1]-heel[1]],Ro=(w[0]*w[0]+w[1]*w[1])/(2*(d[0]*w[0]+d[1]*w[1])),Co=[bossTop[0]-Ro*d[0],bossTop[1]-Ro*d[1]];
 const aHeel=Math.atan2(heel[1]-Co[1],heel[0]-Co[0]),aTop=Math.atan2(bossTop[1]-Co[1],bossTop[0]-Co[0]);
 const outline=[tip];
 for(let i=1;i<=8;i++)outline.push(along(tip,u,heelFraction*len*i/8));
 for(let i=1;i<=48;i++){const t=aHeel+(aTop-aHeel)*i/48;outline.push([Co[0]+Ro*Math.cos(t),Co[1]+Ro*Math.sin(t)]);}
 {let t0=up,t1=down;while(t1<=t0)t1+=2*Math.PI;for(let i=1;i<64;i++){const t=t0+(t1-t0)*i/64;outline.push([bossRadius*Math.cos(t),bossRadius*Math.sin(t)]);}}
 // Inner arc from the boss to a small fillet into the nose underside.
 let aM=aMeet;while(aM-aBoss>Math.PI)aM-=2*Math.PI;while(aM-aBoss<-Math.PI)aM+=2*Math.PI;
 const fillet=.01,aK0=aM-Math.sign(aM-aBoss)*fillet/Ri,k0=arcAt(aK0),k2=along(meet,under,-fillet);
 for(let i=0;i<=48;i++)outline.push(arcAt(aBoss+(aK0-aBoss)*i/48));
 for(let i=1;i<8;i++){const t=i/8,m=1-t;outline.push([0,1].map(k=>m*m*k0[k]+2*m*t*meet[k]+t*t*k2[k]));}
 for(let i=0;i<8;i++)outline.push(along(k2,under,-(tMeet-fillet)*i/8));
 const pawl=clip.difference(poly(outline),poly(circle([0,0],boreRadius,48)));
 f.pawlInnerArc={radius:Ri,meetRadius:innerMeet};
 f.pawlTip=tip;f.pawlHeel=heel;f.pawlBoss={radius:bossRadius,bore:boreRadius};f.ratchetFace={a,b,normal};
 for(const [name,z]of [['upper',-f.pawlZ],['lower',f.pawlZ]]){
  add(name+'Ratchet',plate(shape,z-.045,z+.045),'output',PALETTE.brass);
  add(name+'Pawl',plate(pawl,z-.04,z+.04),name+'Pawl',PAWL_STEEL);
  blocks[name+'Pawl'].position.set(...s.pawlPivot,0);
  const pin=add(name+'PawlPin',disk(.0125,z>0?.26:z-.046,z>0?z+.046:-.26,48),name,PALETTE.ink);pin.position.set(...s.pawlPivot,0);
 }
 // One plain shaft, its rear end part of the output's native inertia.
 add('shaft',disk(s.shaftRadius,-.696,.50,96),'output',PALETTE.ink);
 const cellParts=Object.entries(parts).filter(([name])=>!name.includes('Pin')&&name!=='shaft'&&!name.includes('Stub')).map(([name,mesh])=>[name,mesh.geometry]),buildCells=()=>{for(const [name,geometry] of cellParts){const c=convexPlateCells(geometry);cells[name]={family:families[name],vertices:c.cells.map(p=>[c.low,c.high].flatMap(z=>p.map(q=>[...q,z])))};}};
 Object.assign(root.userData,{parts,families,blocks,profile:f,hideGround:true,shadowCameraHalfExtent:4,shadowBias:-.00002,shadowNormalBias:.0005});
 // Collision cells are for the live simulation only; baked playback never
 // reads them, so they are decomposed on first use (as in 113).
 Object.defineProperty(root.userData,'cells',{configurable:true,enumerable:true,get(){buildCells();Object.defineProperty(root.userData,'cells',{value:cells,writable:true,configurable:true,enumerable:true});return cells;}});
 root.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(root,true);bounds.expandByVector(new THREE.Vector3(amplitude+.06,.08,.02));root.userData.cameraFitBounds=bounds;
 // Brown's end stems are round rods broken off at the plate edge. Each is
 // one turned solid on the frame's mid-plane: the left rod flares into the
 // ring's end face; the right one is Brown's plain rod of radius
 // 0.166, as measured: the ellipse at 511-514 is its broken end, not a step
 // down to a thinner rod (p96).
 // They run on straight far enough that their clean ends never
 // enter the drawn view over the frame's travel; no guides or posts (p60).
 const run=amplitude+.04+.05,lx=local([36,0])[0],rx=local([505,0])[0],px=x=>(x-s.axis[0])/100;
 const stem=(name,profile,y)=>add(name,turned(profile,96).rotateY(Math.PI/2).translate(0,local([0,y])[1],0),'frame',PALETTE.driven);
 {const r0=.185,fr=.01,x1=lx+.02,x0=px(8)-run,flare=Array.from({length:9},(_,i)=>{const t=Math.PI/2*i/8;return[lx-fr+fr*Math.sin(t),r0+fr*(1-Math.cos(t))];});
  stem('leftStub',[[x0,0],[x0,r0],...flare,[x1,r0+fr],[x1,0]],292.5);}
 {const x0=rx-.02,x1=px(514)+run;stem('rightStub',[[x0,0],[x0,.166],[x1,.166],[x1,0]],290);}
 // Framing keeps the drawn stems (x 8 to 514), not their run-ons.
 for(const [x,sign] of [[8,-1],[514,1]])bounds.expandByPoint(new THREE.Vector3(px(x)+sign*(amplitude+.06),0,0));
 markShadows(root);root.updateMatrixWorld(true);
 // The frame slides a full amplitude each way; keep both ends in view.
 root.userData.cameraDistanceScale=1.22;
 // Brown draws the frame and pinions in a flat face view.
 return{root,focus:new THREE.Vector3(0,0,0),cameraDirection:new THREE.Vector3(.02,.015,1)};
}
