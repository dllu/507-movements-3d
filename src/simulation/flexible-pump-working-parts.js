import * as THREE from 'three';
import {horizontalRing, horizontalTurned, horizontalPlate} from './horizontal-turbine-solids.js';
import {curvedPipeWall, mergePassageParts} from './finite-fluid-passages.js';
import {boredPlanarLinkGeometry} from './bored-planar-link.js';
import {circle, poly, plate, polygonClipping} from './finite-plate-geometry.js';

const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};

// Layered finite wall; each rectangular side port has returns across the wall thickness.
export function pumpPortedWall(inner,outer,low,high,ports=[]) {
  const levels=[low,high,...ports.flatMap(p=>[Math.max(low,p.y-p.halfHeight),Math.min(high,p.y+p.halfHeight)])].sort((a,b)=>a-b);
  const annulus=polygonClipping.difference(poly(circle([0,0],outer,128)),poly(circle([0,0],inner,128))),parts=[];
  for(let i=0;i<levels.length-1;i++){
    const a=levels[i],b=levels[i+1];if(b-a<1e-8)continue;
    let section=annulus;
    for(const p of ports)if((a+b)/2>p.y-p.halfHeight&&(a+b)/2<p.y+p.halfHeight){
      const x0=p.side>0?0:-outer-.05,x1=p.side>0?outer+.05:0;
      section=polygonClipping.difference(section,poly([[x0,-p.halfWidth],[x1,-p.halfWidth],[x1,p.halfWidth],[x0,p.halfWidth]]));
    }
    parts.push(horizontalPlate(section,a,b));
  }
  return mergePassageParts(parts);
}

function planarLever(body,outline,bores,depth) {
  const bosses=bores.map(p=>poly(circle([p.x,p.y],p.outer,64)));
  replace(body,plate(polygonClipping.difference(polygonClipping.union(outline,...bosses),...bores.map(p=>poly(circle([p.x,p.y],p.inner,96)))),-depth/2,depth/2));
}

function normalizedLink(mesh,length,bore=.134) {
  const geometry=boredPlanarLinkGeometry({length,width:.10,eyeRadius:bore+.065,boreRadius:bore,depth:.10});
  geometry.translate(-length/2,0,0).rotateZ(Math.PI/2).scale(1,1/length,1);
  replace(mesh,geometry);
}

function plateJoint(plateMesh,material,pinRadius=.13,height=.20) {
  const outline=polygonClipping.difference(polygonClipping.union(poly([[-.10,0],[.10,0],[.10,height],[-.10,height]]),poly(circle([0,height],pinRadius+.07,64))),poly(circle([0,height],pinRadius+.004,64)));
  const mount=new THREE.Mesh(plate(outline,.05,.24),material);
  mount.position.set(0,0,0);mount.userData.role='moving-plate-link-clevis';plateMesh.add(mount);
  const pin=new THREE.Mesh(new THREE.CylinderGeometry(pinRadius,pinRadius,.30,32),material);
  pin.rotation.x=Math.PI/2;pin.position.set(0,height,.34);pin.userData.role='moving-plate-link-pin';plateMesh.add(pin);
  return pin;
}

export function correctDoubleActingParts(root) {
  const d=root.userData,b=d.blocks,g=d.geometry;
  replace(b.upperCover,horizontalRing(.074,.99,-.07,.07));
  const [stuffingBody,stuffingBore]=b.stuffingBox.children;
  replace(stuffingBody,horizontalTurned([[-.21,.074],[-.21,.34],[.21,.28],[.21,.074]]));
  replace(stuffingBore,horizontalRing(.074,.185,-.045,.045));stuffingBore.rotation.set(0,0,0);
  const barrelPorts=[];
  const definitions=[['upperSuctionValve1','upperSuctionBranch',true],['lowerSuctionValve2','lowerSuctionBranch',true],['lowerDischargeValve3','lowerDischargeBranch',false],['upperDischargeValve4','upperDischargeBranch',false]];
  definitions.forEach(([key,branchKey,suction],index)=>{
    const valve=b[key],side=Math.sign(valve.position.x),[body,seat]=valve.children;
    replace(body,pumpPortedWall(.345,.40,-.40,.43,[{side:suction?side:-side,y:-.24,halfHeight:.17,halfWidth:.17},{side:suction?-side:side,y:.27,halfHeight:.16,halfWidth:.17}]));
    replace(seat,horizontalRing(.225,.345,-.06,0));seat.rotation.set(0,0,0);seat.position.y=-.08;
    const inletSide=suction?side:-side,outletSide=-inletSide;
    const lowerY=valve.position.y-.24,upperY=valve.position.y+.27;
    const chamberY=suction?upperY:lowerY,mainY=suction?lowerY:upperY;
    barrelPorts.push({side,y:chamberY,halfHeight:.17,halfWidth:.17});
    const barrelEnd=new THREE.Vector3(side*.79,chamberY,0),mainEnd=new THREE.Vector3(side*2.40,mainY,0);
    const lowEnd=valve.position.clone().add(new THREE.Vector3(inletSide*.36,-.24,0));
    const highEnd=valve.position.clone().add(new THREE.Vector3(outletSide*.36,.27,0));
    const lower=new THREE.LineCurve3(suction?mainEnd:barrelEnd,lowEnd),upper=new THREE.LineCurve3(highEnd,suction?barrelEnd:mainEnd);
    replace(b[branchKey],mergePassageParts([curvedPipeWall(lower,.11,.15,12),curvedPipeWall(upper,.11,.15,12)]));
    const flowCurve=new THREE.CatmullRomCurve3([lower.v1,lower.v2,valve.position.clone().add(new THREE.Vector3(0,-.24,0)),valve.position.clone().add(new THREE.Vector3(0,.27,0)),upper.v1,upper.v2]);
    b[branchKey].userData.curve=flowCurve;
    replace(b.branchWaters[index],new THREE.TubeGeometry(flowCurve,72,.085,12,false));
    for(const marker of b.flowMarkerGroups[index])marker.userData.curve=flowCurve;
  });
  replace(b.barrel,pumpPortedWall(.842,1,-1.86,1.86,barrelPorts.map(p=>({...p,y:p.y-.22}))));
  for(const [mesh,side]of[[b.suctionManifold,1],[b.dischargeManifold,-1]]){
    const height=mesh.geometry.parameters.height,ports=definitions.filter(([key])=>Math.sign(b[key].position.x)===side).map(([key,,suction])=>({side:-side,y:b[key].position.y+(suction?-.24:.27)-mesh.position.y,halfHeight:.17,halfWidth:.17}));
    replace(mesh,pumpPortedWall(.265,.31,-height/2,height/2,ports));
  }
  d.solidReview={qualification:'Finite rod passages, piston clearance, ported cylinder/manifolds and valve chambers. Four valve lifts and primed-fluid displacement remain prescribed; pressure, valve impact and sealing losses are not solved.'};
  finish(root);
}

export function correctFlexiblePumpParts(root,id) {
  const d=root.userData,b=d.blocks,g=d.geometry,lantern=id===453;
  const lever=lantern?b.beam:b.lever,body=lever.children[0],pivot=lantern?g.beamPivot:g.leverPivot;
  if(lantern){
    replace(b.pivotAxle,new THREE.CylinderGeometry(.22,.22,1.26,48));
    const outline=poly([[-2.955,-.11],[3.595,-.11],[3.595,.11],[-2.955,.11]]);
    planarLever(body,outline,[{x:0,y:0,inner:.224,outer:.32}],.38);body.position.x=0;
    for(const [rod,top]of[[b.leftConnectingRod,b.leftTopPlate],[b.rightConnectingRod,b.rightTopPlate]]){normalizedLink(rod,g.connectingRodLength);plateJoint(top,rod.material,.13,g.linkEyeHeight);}
    for(const mesh of lever.children)if(mesh.geometry?.type==='CylinderGeometry'&&Math.abs(mesh.position.x)===g.beamPinHalfSpan)replace(mesh,new THREE.CylinderGeometry(.13,.13,.96,32));
    // Pass 70: the chest, channel, riser, post and flap checks are built in
    // authored-lantern-bellows-pumps.js to Brown's section.
    d.updateSolids=()=>{b.leftConnectingRod.position.z=.34;b.rightConnectingRod.position.z=.34;};
  }else{
    const curve=body.geometry.parameters.path,left=[],right=[];
    for(let i=0;i<=64;i++){const p=curve.getPoint(i/64),t=curve.getTangent(i/64).normalize();left.push([p.x-t.y*.115,p.y+t.x*.115]);right.push([p.x+t.y*.115,p.y-t.x*.115]);}
    planarLever(body,poly([...left,...right.reverse()]),[{x:0,y:0,inner:.214,outer:.30}],.23);
    normalizedLink(b.connectingRod,g.connectingRodLength,.144);
    replace(lever.children[2],new THREE.CylinderGeometry(.14,.14,.96,32));
    const lowerPin=plateJoint(b.centerClamp,b.connectingRod.material,.14,g.linkEyeHeight);replace(lowerPin,new THREE.CylinderGeometry(.14,.14,.30,32));
    // Pass 56: the rim and floor stand proud of the wall as plain flanges in
    // the casing's own colour, so no coincident faces z-fight at the wall.
    const rim=polygonClipping.difference(poly(circle([0,0],1.34,128)),poly(circle([0,0],g.diaphragmRadius,128)));
    replace(b.chamberRim,horizontalPlate(rim,-.055,.055));b.chamberRim.rotation.set(0,0,0);b.chamberRim.material=b.chamberBottom.material;
    const floor=polygonClipping.difference(poly(circle([0,0],1.34,128)),poly(circle([0,-.38],.44,96)));
    replace(b.chamberBottom,horizontalPlate(floor,-.07,.07));
    replace(b.chamberShell,pumpPortedWall(1.25,1.31,-(g.diaphragmRimY-g.chamberBottomY)/2,(g.diaphragmRimY-g.chamberBottomY)/2,[{side:1,y:.34-b.chamberShell.position.y,halfHeight:.30,halfWidth:.68}]));
    for(const key of['suctionPipe','deliveryBranch','deliveryRiser']){const pipe=b[key].shell;replace(pipe,curvedPipeWall(pipe.userData.curve,pipe.geometry.parameters.radius-.045,pipe.geometry.parameters.radius,72));}
    for(const valve of[b.suctionValve,b.deliveryValve]){
      const seat=valve.userData.seat,outline=polygonClipping.difference(poly(circle([0,0],.45,128)),poly([[-.19,-.16],[.19,-.16],[.19,.16],[-.19,.16]]),poly([[-.33,-.30],[-.175,-.30],[-.175,.30],[-.33,.30]]));
      const suction=valve===b.suctionValve,lowerRadius=suction?.29:.27;
      replace(valve.userData.body,horizontalTurned([[-.30,lowerRadius-.045],[-.30,lowerRadius],[-.14,.50],[.30,.50],[.40,.31],[.40,.265],[.30,.45],[-.14,.45]]));
      const pair=suction?b.suctionPipe:b.deliveryBranch;
      const points=suction?pair.shell.userData.curve.points.map(p=>p.clone()):[new THREE.Vector3(1.15,.34,.38),new THREE.Vector3(1.5,.34,.38),new THREE.Vector3(2.02,.60,.38),new THREE.Vector3(2.02,.88,.38)];points[points.length-1]=valve.userData.body.position.clone().add(new THREE.Vector3(0,-.30,0));
      const curve=new THREE.CatmullRomCurve3(points);replace(pair.shell,curvedPipeWall(curve,lowerRadius-.045,lowerRadius,64));pair.shell.userData.curve=curve;replace(pair.water,new THREE.TubeGeometry(curve,64,lowerRadius*.60,12,false));
      if(!suction){const points=b.deliveryRiser.shell.userData.curve.points.map(p=>p.clone());points[0]=valve.userData.body.position.clone().add(new THREE.Vector3(0,.40,0));const curve=new THREE.CatmullRomCurve3(points);replace(b.deliveryRiser.shell,curvedPipeWall(curve,.265,.31,48));replace(b.deliveryRiser.water,new THREE.TubeGeometry(curve,48,.18,12,false));}
      replace(seat,horizontalPlate(outline,-.065,0));seat.position.y=valve.position.y-.0325;
    }
    d.updateSolids=()=>{b.connectingRod.position.z=.34;};
  }
  // Correct the old horizontally oriented collar to share the Z-axis fulcrum.
  const collar=root.children.find(o=>o.geometry?.type==='TorusGeometry'&&o.position.distanceTo(pivot)<1e-8);
  if(collar){replace(collar,new THREE.TorusGeometry(lantern?.27:.26,.035,12,48));collar.rotation.set(0,0,0);collar.position.z=.23;}
  d.solidReview={qualification:'Finite lever bores, link eyes, pipe walls, chamber openings and valve seats. Bellows/diaphragm deformation and check timing remain prescribed; pipe junction sealing, flexible stresses and passive fluid/contact dynamics are not solved.'};
  finish(root);
}

function finish(root){
  const d=root.userData;d.hideGround=true;d.minimumDisplayCycleSeconds=d.geometry.cycleDuration;
  root.traverse(o=>{for(const m of o.material?[].concat(o.material):[])m.fog=false;});
}
