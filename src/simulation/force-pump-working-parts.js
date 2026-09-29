import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {addDome,clackHinge,roundPortedBarrel} from './lift-pump-working-parts.js';
import {horizontalRing,horizontalTurned} from './horizontal-turbine-solids.js';
import {curvedPipeWall,mergePassageParts} from './finite-fluid-passages.js';
import {capsule,circle,poly,plate,polygonClipping} from './finite-plate-geometry.js';
import {latheSectionGeometry} from './cutaway-section.js';
import {creaseIndexedNormals} from './crease-normals.js';
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};

function risingElbow(startX,axisX,entryY,radius){
  const cx=axisX+radius,cy=entryY+radius;
  const points=[new THREE.Vector3(startX,entryY,0)];
  for(let i=0;i<=48;i++){const a=-Math.PI/2-i*Math.PI/96;points.push(new THREE.Vector3(cx+radius*Math.cos(a),cy+radius*Math.sin(a),0));}
  return new THREE.CatmullRomCurve3(points);
}

// The chamber's piecewise-linear radius permits exact integration of each
// frustum. The rendered liquid/air split uses the existing ideal volume ratio.
function chamberContents(mesh,profile){
  replace(mesh,new THREE.CylinderGeometry(1,1,1,64,32,false));
  const position=mesh.geometry.attributes.position,unit=position.array.slice();
  const radiusAt=y=>{
    for(let i=1;i<profile.length;i++)if(y<=profile[i][0]){
      const [a,r]=profile[i-1],[b,s]=profile[i];return THREE.MathUtils.lerp(r,s,(y-a)/(b-a));
    }return profile.at(-1)[1];
  };
  const volumeTo=height=>{
    let volume=0;
    for(let i=1;i<profile.length;i++){
      const [a,r]=profile[i-1],[b,s]=profile[i];if(height<=a)break;
      const h=Math.min(height,b)-a,end=r+(s-r)*h/(b-a);
      volume+=Math.PI*h*(r*r+r*end+end*end)/3;
    }return volume;
  };
  const low=profile[0][0],high=profile.at(-1)[0],total=volumeTo(high);
  const levelAt=fraction=>{let a=low,b=high;for(let i=0;i<40;i++){const m=(a+b)/2;if(volumeTo(m)<fraction*total)a=m;else b=m;}return(a+b)/2;};
  const update=(bottom,top)=>{
    for(let i=0;i<position.count;i++){
      const y=THREE.MathUtils.lerp(bottom,top,unit[i*3+1]+.5),r=radiusAt(y);
      position.setXYZ(i,unit[i*3]*r,y,unit[i*3+2]*r);
    }
    mesh.scale.set(1,1,1);mesh.position.y=0;position.needsUpdate=true;
    mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
  };
  return{update,levelAt,volumeTo,total,low,high,radiusAt};
}

// Closed pipe wall along curve from t0 to 1 (arc-length parameter) whose
// start is trimmed per generator: generator j begins at the first u >= t0
// where inside(point) >= 0 (a signed distance to the surface it meets), and
// its rings are spread from there to the end. Same topology as
// curvedPipeWall, so the wall stays watertight.
export function saddleEndPipeWall(curve,t0,inner,outer,segments,sides,inside){
  const frames=curve.computeFrenetFrames(segments*4,false),positions=[],indices=[];
  const frameAt=u=>Math.min(segments*4,Math.max(0,Math.round(u*segments*4)));
  const offset=(u,radius,angle)=>{const k=frameAt(u);return curve.getPointAt(u).addScaledVector(frames.normals[k],radius*Math.cos(angle)).addScaledVector(frames.binormals[k],radius*Math.sin(angle));};
  const starts=[outer,inner].map(radius=>Array.from({length:sides},(_,j)=>{
    const angle=j*2*Math.PI/sides;let lo=t0,hi=Math.min(1,t0+.5);
    if(inside(offset(lo,radius,angle))>=0)return lo;
    for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(inside(offset(mid,radius,angle))>=0)hi=mid;else lo=mid;}
    return hi;
  }));
  const radii=[outer,inner];
  radii.forEach((radius,r)=>{for(let i=0;i<=segments;i++)for(let j=0;j<sides;j++){
    const u0=starts[r][j],u=Math.min(1,u0+(1-u0)*i/segments);positions.push(...offset(u,radius,j*2*Math.PI/sides).toArray());}});
  const off=(segments+1)*sides;
  for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){
    const a=i*sides+j,b=i*sides+(j+1)%sides,c=b+sides,d=a+sides;
    indices.push(a,b,c,a,c,d,off+a,off+c,off+b,off+a,off+d,off+c);
  }
  for(let j=0;j<sides;j++){
    const a=j,b=(j+1)%sides,c=segments*sides+j,d=segments*sides+(j+1)%sides;
    indices.push(a,off+b,b,a,off+a,off+b,c,d,off+d,c,off+d,off+c);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);return creaseIndexedNormals(g);
}

export function correctForcePumpParts(root,id){
  const d=root.userData,b=d.blocks,g=d.geometry,air=id===451,pumpX=air?g.pumpX:0;
  b.base.visible=false;b.sourceWell.visible=false;b.sourceWater.visible=false;
  b.barrel.material.opacity=.18;b.cylinderWater.material.opacity=.26;
  for(const o of root.children)if(o.geometry?.type==='TorusGeometry'&&o.position.y < -1.8)o.visible=false;
  // Pass 80: the delivery pipe leaves through a round port it fills (the
  // hole's edge lies within the pipe wall), where a larger square port left
  // a gap round the pipe; the pipe starts in the barrel wall, not the bore.
  replace(b.barrel,roundPortedBarrel(.705,.79,-1.27,air?2.21:2.25,air?-.15:-.72,air?.245:.26,-1));
  b.barrel.position.set(pumpX,0,0);
  const p=b.suctionPipe.geometry.parameters;
  // Pass 80: the suction pipe rises to butt on the underside of the check
  // seat ring (it stopped 0.025-0.035 short), with its water column.
  const seatBottom=g.suctionValveSeatY-.065,pipeTop=seatBottom-b.suctionPipe.position.y;
  const taper=(r0,r1,h)=>r0+(r1-r0)*(pipeTop+p.height/2)/h;
  replace(b.suctionPipe,horizontalTurned([[-p.height/2,p.radiusBottom-.045],[-p.height/2,p.radiusBottom],
    [pipeTop,taper(p.radiusBottom,p.radiusTop,p.height)],[pipeTop,taper(p.radiusBottom,p.radiusTop,p.height)-.045]]));
  // Pass 88: the water column stops 0.006 under the seat ring, so its top
  // face does not lie on the seat's underside.
  {const w=b.suctionWater.geometry.parameters,bottom=-w.height/2,height=pipeTop-.006-bottom,top=w.radiusBottom+(w.radiusTop-w.radiusBottom)*height/w.height;
   replace(b.suctionWater,new THREE.CylinderGeometry(top,w.radiusBottom,height,48).translate(0,bottom+height/2,0));}
  replace(b.suctionValveSeat,horizontalRing(.30,.704,-.065,.035));b.suctionValveSeat.rotation.set(0,0,0);
  // Pass 88: the piston's dark packing was a torus round the body's top
  // edge that ran into the body and 0.03 into the barrel wall; it is now a
  // flat packing ring seated on the body's top face, 0.005 clear of the bore.
  {const packing=b.piston.children.find(o=>o.geometry?.type==='TorusGeometry');
   if(packing){replace(packing,horizontalRing(.56,.70,0,.04));packing.rotation.set(0,0,0);}}
  // Brown's handle is a flat bar pinned straight to the rod top; its left
  // end rides on a swing link hung from a lug cast on the barrel side
  // (Movement 450; 451 is "the same as above"). Layers along z: handle
  // +-0.10, rod clevis cheeks at +-0.12..0.18, swing link -0.20..-0.13,
  // lug -0.31..-0.21 grown out of the barrel wall; pins pass through bores.
  const L1=g.leverRodPinRadius,Ls=g.swingLinkLength,bore=.063;
  const path=b.lever.children[0].geometry.parameters.path.getPoints(96).map(p=>[p.x,p.y]);
  // Pass 101: the bar ends in Brown's ring (it ended in a black ball).
  const grip=path.at(-1);
  const bar=polygonClipping.union(...path.slice(1).map((p,i)=>capsule(path[i],p,.085,16)),
    poly(circle([0,0],.15,64)),poly(circle([L1,0],.15,64)),poly(circle(grip,.21,96)));
  replace(b.lever.children[0],plate(polygonClipping.difference(bar,poly(circle([0,0],bore,48)),poly(circle([L1,0],bore,48)),
    poly(circle(grip,.12,96))),-.10,.10));
  b.lever.children[3].visible=false;
  b.lever.children[0].userData.role='hand-lever-flat-bar-pinned-to-rod-top';
  // Pass 92: each pin is a plain cylinder whose axis the mesh turns onto z
  // (was baked into the buffer), so the pin's round axis is its own; the
  // handle's eyes (r 0.15) stand 1.5 pin radii round both handle pins.
  const zPin=(mesh,radius,low,high)=>{const geometry=new THREE.CylinderGeometry(radius,radius,high-low,32).translate(0,(low+high)/2,0);
    mesh.scale.set(1,1,1);mesh.rotation.set(Math.PI/2,0,0);replace(mesh,geometry);};
  const fulcrumPin=b.lever.children[1],rodPin=b.lever.children[2];
  fulcrumPin.position.set(0,0,0);zPin(fulcrumPin,.06,-.21,.11);fulcrumPin.userData.role='handle-fulcrum-pin-through-swing-link';
  zPin(rodPin,.06,-.19,.19);rodPin.userData.role='rod-top-pin-through-handle-and-clevis';
  // Swing link, in its own frame: lug pin at the origin, handle pin at +x.
  // 450 draws a straight link; 451 draws it bowed outward.
  const bow=air?.10:0,centre=Array.from({length:25},(_,i)=>[Ls*i/24,bow*Math.sin(Math.PI*i/24)]);
  const linkShape=polygonClipping.union(...centre.slice(1).map((p,i)=>capsule(centre[i],p,.05,12)),
    poly(circle([0,0],.115,64)),poly(circle([Ls,0],.115,64)));
  replace(b.swingLink,plate(polygonClipping.difference(linkShape,poly(circle([0,0],bore,48)),poly(circle([Ls,0],bore,48))),-.20,-.13));
  b.swingLink.position.set(g.lugPin.x,g.lugPin.y,0);
  const lowerPin=new THREE.Mesh(new THREE.BufferGeometry(),b.pumpRod.material);zPin(lowerPin,.06,-.32,-.12);
  lowerPin.position.set(g.lugPin.x,g.lugPin.y,0);lowerPin.userData.role='fixed-swing-link-pin-in-barrel-lug';root.add(lowerPin);b.lugPin=lowerPin;
  // The lug: a boss round the pin swept down into the barrel's outer wall.
  const P=[g.lugPin.x,g.lugPin.y],wallX=pumpX-.70;
  const lug=polygonClipping.difference(polygonClipping.union(poly(circle(P,.13,64)),
    poly([[P[0],P[1]+.13],[wallX,P[1]+.02],[wallX,P[1]-.42],[P[0]+.10,P[1]-.30],[P[0],P[1]-.13]])),poly(circle(P,bore,48)));
  replace(b.pivotSupport,plate(lug,-.31,-.21));b.pivotSupport.position.set(0,0,0);b.pivotSupport.rotation.set(0,0,0);b.pivotSupport.scale.set(1,1,1);
  // Clevis on the rod top: a crosshead below the handle and two bored cheeks.
  const cheek=polygonClipping.difference(polygonClipping.union(poly(circle([0,0],.11,64)),poly([[-.11,-.30],[.11,-.30],[.11,0],[-.11,0]])),poly(circle([0,0],bore,48)));
  const clevisGeometry=mergeGeometries([plate(cheek,.12,.18),plate(cheek,-.18,-.12),
    plate(poly([[-.11,-.36],[.11,-.36],[.11,-.24],[-.11,-.24]]),-.179,.179)]);
  const clevis=new THREE.Mesh(clevisGeometry,b.pumpRod.material);clevis.userData.role='rod-top-clevis-straddling-handle';root.add(clevis);b.rodClevis=clevis;
  let inlet,output,liquid,gas;
  if(!air){
    const axisX=-1.48;inlet=risingElbow(-.71,axisX,-.72,.40);
    const upper=new THREE.LineCurve3(new THREE.Vector3(axisX,g.deliveryValveSeatY+.42,0),new THREE.Vector3(axisX,3.45,0));
    replace(b.deliveryPipe,mergePassageParts([curvedPipeWall(inlet,.235,.29,80),curvedPipeWall(upper,.235,.29,24)]));
    replace(b.deliveryValveBody,horizontalTurned([[-.40,.235],[-.40,.29],[-.23,.48],[.30,.48],[.42,.29],[.42,.235],[.30,.425],[-.23,.425]]));
    b.deliveryValveBody.position.set(axisX,g.deliveryValveSeatY,0);b.deliveryValveBody.scale.set(1,1,1);
    replace(b.deliveryValveSeat,horizontalRing(.245,.425,-.055,.035));b.deliveryValveSeat.rotation.set(0,0,0);
    output=new THREE.CurvePath();output.add(inlet);output.add(new THREE.LineCurve3(inlet.getPoint(1),upper.getPoint(0)));output.add(upper);
    // Pass 82: the valve chamber stands full of water round the flap (a
    // turned body just inside the chamber's bore) between the rising elbow's
    // water and the riser's, instead of a pipe-sized column through the flap.
    const y0=inlet.getPoint(1).y,y1=upper.getPoint(0).y,cy=g.deliveryValveSeatY;
    const chamberWater=new THREE.LatheGeometry([[0,y0],[.225,y0],[.415,cy-.23],[.415,cy+.30],[.225,y1],[0,y1]].map(([r,y])=>new THREE.Vector2(r,y)),64).translate(axisX,0,0);
    replace(b.deliveryWater,mergeGeometries([new THREE.TubeGeometry(inlet,96,.18,16,false),chamberWater,new THREE.TubeGeometry(upper,24,.18,16,false)]));
  }else{
    const x=g.chamberCenter.x;g.chamberCenter.y=2.15;
    inlet=risingElbow(pumpX-.71,x,-.15,.55);
    replace(b.pumpDeliveryPipe,curvedPipeWall(inlet,.215,.27,96));
    replace(b.pumpDeliveryWater,new THREE.TubeGeometry(inlet,96,.18,16,false));
    // Pass 80: the valve box under the bulb has a floor the delivery pipe
    // enters (its end stood open 0.2 inside the neck's bore), and the side
    // outlet leaves through a round port it fills.
    replace(b.chamberNeck,mergePassageParts([roundPortedBarrel(.475,.53,.40,1.20,.95,.205,-1),horizontalRing(.245,.53,.335,.395)]));b.chamberNeck.position.set(x,0,0);
    // Brown's vessel is a smooth bulb: a rounded bottom rising from the neck
    // to its widest girth, closed by an elliptical dome round the dip tube.
    // Dense sampling keeps the piecewise-linear volume law while the
    // rendered outline reads round.
    const vessel=wall=>{
      // Pass 80: the dome's top opening fits the dip tube (0.20 outside),
      // where a 0.225 opening left the air vessel open round it.
      const points=[],girth=.98-wall,topR=.255-wall;
      for(let i=0;i<=24;i++){const a=Math.PI/2*i/24;points.push([2.55-(1.35-wall)*Math.cos(a),.53-wall+.45*Math.sin(a)]);}
      const end=Math.acos(topR/girth);
      for(let i=1;i<=24;i++){const a=end*i/24;points.push([2.55+(1.15-wall)*Math.sin(a),girth*Math.cos(a)]);}
      return points;
    };
    const outer=vessel(0);
    const inner=vessel(.055);
    replace(b.chamberShell,horizontalTurned([...outer,...inner.slice().reverse()]));b.chamberShell.position.set(x,0,0);b.chamberShell.scale.set(1,1,1);
    b.deliveryValveSeat.position.x=x;
    replace(b.deliveryValveSeat,horizontalRing(.24,.475,-.055,.035));b.deliveryValveSeat.rotation.set(0,0,0);
    const profile=[[.40,.453],[1.30,.453],...vessel(.077).filter(([y])=>y>1.31)];
    liquid=chamberContents(b.chamberWater,profile);gas=chamberContents(b.compressedAir,profile);
    b.chamberWater.position.x=x;b.compressedAir.position.x=x;b.compressedAir.material.opacity=.14;
    d.chamberEnvelope={profile,...liquid};
    // Brown's side outlet leaves the neck, sweeps under the bulb's rounded
    // bottom and rises beside it. The dip is kept shallow enough that the
    // centreline radius stays above 0.32 everywhere (the pipe's outer radius
    // is 0.24), so the inner wall of the bend never folds into a sliver.
    const sideFull=new THREE.CatmullRomCurve3([[x,.95],[x-.40,.95],[x-.78,.88],[x-1.10,.90],[x-1.35,1.08],[x-1.46,1.40],[x-1.47,1.80],[x-1.47,2.75]].map(([px,py])=>new THREE.Vector3(px,py,0)),false,'centripetal');
    // Pass 80: the outlet starts in the neck wall (it began on the neck's
    // axis, a stub across the valve box above the check).
    let t0=0;while(sideFull.getPointAt(t0).x>x-.50)t0+=.0005;
    const side=new THREE.Curve();side.getPoint=(t,target=new THREE.Vector3())=>sideFull.getPointAt(t0+(1-t0)*t,target);
    // Pass 86: the pipe's square-cut end met the round neck with a wedge gap
    // at its sides (the neck face curves away from a flat end). The wall now
    // starts inside the bore, and each of its generators begins where it
    // crosses the mid-wall cylinder (r 0.50 of the 0.475-0.53 wall), so the
    // whole end is a saddle seated in the neck wall round the 0.205 port.
    let t1=0;while(sideFull.getPointAt(t1).x>x-.40)t1+=.0005;
    const outletWall=saddleEndPipeWall(sideFull,t1,.17,.24,80,24,p=>Math.hypot(p.x-x,p.z)-.50);
    replace(b.selectedOutlet,outletWall);replace(b.selectedOutletWater,new THREE.TubeGeometry(side,80,.15,14,false));output=side;
    const dip=new THREE.LineCurve3(new THREE.Vector3(x,1.25,0),new THREE.Vector3(x,4.10,0));
    replace(b.alternativeOutlet,curvedPipeWall(dip,.145,.20,32));
    // Pass 70: the open dip tube's water stands at the side mouth's level
    // (the same air pressure lifts both takeoffs), from its foot in the
    // chamber water; nothing rises above that level, so its open top is dry.
    // Pass 88: the column stands 0.006 inside the tube's bore (it lay on
    // the bore and on the tube's end face).
    {const foot=1.25,top=2.75;replace(b.alternativeOutletWater,latheSectionGeometry([[0,foot],[.139,foot],[.139,top],[0,top]],{segments:64}).translate(0,0,-.004));b.alternativeOutletWater.position.set(x,0,0);d.dipTubeWaterTop=top;}
    for(const o of root.children)if(o.geometry?.type==='TorusGeometry'&&o.position.x===x)o.visible=false;
  }
  // Pass 82: Brown draws both checks as clack flaps with a raised knob,
  // tilted when open (450's suction, 451's delivery) and flat on the seat when
  // shut (450's delivery, 451's suction). Each is now a flat plate hinged at
  // its left edge on a pin carried by two journals standing on the seat ring
  // (the shared p78 clack hinge), lying flat on its seat when shut and
  // turning up to FLAP_OPEN when the flow opens it.
  const FLAP_OPEN=THREE.MathUtils.degToRad(30);
  const flap=(disk,seat,axisX,seatTop,radius,spec)=>{
    replace(disk,new THREE.CylinderGeometry(radius,radius,.09,64));
    const pivot=new THREE.Group();pivot.position.set(axisX-radius-.05,seatTop+.045,0);root.add(pivot);
    disk.removeFromParent();disk.position.set(radius+.05,0,0);disk.rotation.set(0,0,0);disk.scale.set(1,1,1);pivot.add(disk);
    const hinge=clackHinge({pivot,frame:root,side:1,disk,seatMaterial:seat.material,pinRadius:.025,
      pinLength:2*spec.journalZ+.05,boss:.042,arm:.04,journal:spec.journal,journalZ:spec.journalZ});
    const dome=addDome(disk,spec.dome);
    return {pivot,dome,...hinge};
  };
  const suctionTop=g.suctionValveSeatY+.035;
  b.suctionFlap=flap(b.suctionValveDisk,b.suctionValveSeat,pumpX,suctionTop,air?.43:.44,
    {journalZ:.30,journal:{radius:.05,foot:[-.09,-.025],footRadius:.025},dome:.12});
  b.deliveryFlap=air?flap(b.deliveryValveDisk,b.deliveryValveSeat,g.chamberCenter.x,g.deliveryValveSeatY+.035,.31,
    {journalZ:.16,journal:{radius:.045,foot:[-.05,-.025],footRadius:.025},dome:.09})
    :flap(b.deliveryValveDisk,b.deliveryValveSeat,-1.48,g.deliveryValveSeatY+.035,.30,
    {journalZ:.115,journal:{radius:.04,foot:[-.025,-.025],footRadius:.025},dome:.09});
  g.maximumFlapAngle=FLAP_OPEN;
  d.updateSolids=state=>{
    clevis.position.copy(state.pistonRodJoint);
    for(const [f,disk,open] of [[b.suctionFlap,b.suctionValveDisk,state.suctionValveOpen],[b.deliveryFlap,b.deliveryValveDisk,state.deliveryValveOpen]]){
      disk.position.set(disk.geometry.parameters.radiusTop+.05,0,0);f.pivot.rotation.z=FLAP_OPEN*open;
    }
    if(air){
      const level=liquid.levelAt(state.chamberWaterVolume/g.chamberTotalInternalVolume);
      liquid.update(liquid.low,level);gas.update(level,gas.high);d.chamberEnvelope.level=level;
      b.inletMarkers.forEach((m,i)=>m.position.copy(inlet.getPointAt(THREE.MathUtils.euclideanModulo(i/b.inletMarkers.length+state.phase*2,1))));
      b.outletMarkers.forEach((m,i)=>m.position.copy(output.getPointAt(THREE.MathUtils.euclideanModulo(i/b.outletMarkers.length+state.phase,1))));
    }else b.deliveryMarkers.forEach((m,i)=>m.position.copy(output.getPointAt(THREE.MathUtils.euclideanModulo(i/b.deliveryMarkers.length+state.phase*2,1))));
  };
  d.minimumDisplayCycleSeconds=g.cycleDuration;d.hideGround=true;
  d.solidReview={qualification:'Finite rod journals, valve seats, open wall passages and fitted chamber-content envelopes. Check timing, fluid displacement and the air-pressure law remain prescribed; forces, leakage, priming and pressure-tight sealing are not validated.'};
  root.traverse(o=>{for(const mat of o.material?[].concat(o.material):[])mat.fog=false;});
  const bounds=new THREE.Box3(),point=new THREE.Vector3();
  for(let i=0;i<=32;i++){
    d.update(g.cycleDuration*i/32);root.updateMatrixWorld(true);
    root.traverseVisible(o=>{const p=o.geometry?.attributes.position;if(p)for(let j=0;j<p.count;j++)bounds.expandByPoint(point.fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld));});
  }
  d.cameraFitBounds=bounds.expandByScalar(.12);d.cameraDirection=new THREE.Vector3(.35,.45,15);d.cameraDistanceScale=1.07;d.cameraFov=12;
}
