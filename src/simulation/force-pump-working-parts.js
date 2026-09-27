import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {roundPortedBarrel} from './lift-pump-working-parts.js';
import {horizontalRing,horizontalTurned} from './horizontal-turbine-solids.js';
import {curvedPipeWall,mergePassageParts} from './finite-fluid-passages.js';
import {capsule,circle,poly,plate,polygonClipping} from './finite-plate-geometry.js';
import {latheSectionGeometry} from './cutaway-section.js';
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
  {const w=b.suctionWater.geometry.parameters,bottom=-w.height/2,height=pipeTop-bottom,top=w.radiusBottom+(w.radiusTop-w.radiusBottom)*height/w.height;
   replace(b.suctionWater,new THREE.CylinderGeometry(top,w.radiusBottom,height,48).translate(0,bottom+height/2,0));}
  replace(b.suctionValveSeat,horizontalRing(.30,.704,-.065,.035));b.suctionValveSeat.rotation.set(0,0,0);
  // Brown's handle is a flat bar pinned straight to the rod top; its left
  // end rides on a swing link hung from a lug cast on the barrel side
  // (Movement 450; 451 is "the same as above"). Layers along z: handle
  // +-0.10, rod clevis cheeks at +-0.12..0.18, swing link -0.20..-0.13,
  // lug -0.31..-0.21 grown out of the barrel wall; pins pass through bores.
  const L1=g.leverRodPinRadius,Ls=g.swingLinkLength,bore=.063;
  const path=b.lever.children[0].geometry.parameters.path.getPoints(96).map(p=>[p.x,p.y]);
  const bar=polygonClipping.union(...path.slice(1).map((p,i)=>capsule(path[i],p,.085,16)),
    poly(circle([0,0],.15,64)),poly(circle([L1,0],.15,64)));
  replace(b.lever.children[0],plate(polygonClipping.difference(bar,poly(circle([0,0],bore,48)),poly(circle([L1,0],bore,48))),-.10,.10));
  b.lever.children[0].userData.role='hand-lever-flat-bar-pinned-to-rod-top';
  const zPin=(mesh,radius,low,high)=>{const geometry=new THREE.CylinderGeometry(radius,radius,high-low,32).rotateX(Math.PI/2).translate(0,0,(low+high)/2);
    mesh.scale.set(1,1,1);mesh.rotation.set(0,0,0);replace(mesh,geometry);};
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
    replace(b.deliveryWater,new THREE.TubeGeometry(output,128,.18,16,false));
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
    b.deliveryValveSeat.position.x=x;b.deliveryValveDisk.position.x=x;
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
    replace(b.selectedOutlet,curvedPipeWall(side,.17,.24,80));replace(b.selectedOutletWater,new THREE.TubeGeometry(side,80,.15,14,false));output=side;
    const dip=new THREE.LineCurve3(new THREE.Vector3(x,1.25,0),new THREE.Vector3(x,4.10,0));
    replace(b.alternativeOutlet,curvedPipeWall(dip,.145,.20,32));
    // Pass 70: the open dip tube's water stands at the side mouth's level
    // (the same air pressure lifts both takeoffs), from its foot in the
    // chamber water; nothing rises above that level, so its open top is dry.
    {const foot=1.25,top=2.75;replace(b.alternativeOutletWater,latheSectionGeometry([[0,foot],[.145,foot],[.145,top],[0,top]],{segments:64}).translate(0,0,-.004));b.alternativeOutletWater.position.set(x,0,0);d.dipTubeWaterTop=top;}
    for(const o of root.children)if(o.geometry?.type==='TorusGeometry'&&o.position.x===x)o.visible=false;
  }
  d.updateSolids=state=>{
    clevis.position.copy(state.pistonRodJoint);
    if(air){
      const level=liquid.levelAt(state.chamberWaterVolume/g.chamberTotalInternalVolume);
      liquid.update(liquid.low,level);gas.update(level,gas.high);d.chamberEnvelope.level=level;
      b.deliveryValveDisk.position.x=g.chamberCenter.x;
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
