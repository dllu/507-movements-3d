import * as THREE from 'three';
import {portedBarrel} from './lift-pump-working-parts.js';
import {horizontalRing,horizontalTurned} from './horizontal-turbine-solids.js';
import {curvedPipeWall,mergePassageParts} from './finite-fluid-passages.js';
import {boredPlanarLinkGeometry} from './bored-planar-link.js';
import {capsule,circle,poly,plate,polygonClipping} from './finite-plate-geometry.js';
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
  replace(b.barrel,portedBarrel(.705,.79,-1.27,air?2.21:2.25,air?-.15:-.72,.33,-1));
  b.barrel.position.set(pumpX,0,0);
  const p=b.suctionPipe.geometry.parameters;
  replace(b.suctionPipe,horizontalTurned([[-p.height/2,p.radiusBottom-.045],[-p.height/2,p.radiusBottom],
    [p.height/2,p.radiusTop],[p.height/2,p.radiusTop-.045]]));
  replace(b.suctionValveSeat,horizontalRing(.30,.704,-.065,.035));b.suctionValveSeat.rotation.set(0,0,0);
  // The short driven link and its pins occupy a distinct front layer.
  const link=boredPlanarLinkGeometry({length:g.sliderLinkLength,width:.075,eyeRadius:.115,boreRadius:.063,depth:.07});
  link.translate(-g.sliderLinkLength/2,0,0).rotateZ(Math.PI/2).scale(1,1/g.sliderLinkLength,1);replace(b.sliderLink,link);
  const pivot=b.lever.children[1],rodPin=b.lever.children[2];
  replace(pivot,new THREE.CylinderGeometry(.18,.18,.70,40));
  // Clone scale varies in legacy factories; normalize the working rod pin.
  rodPin.scale.set(1,1,1);replace(rodPin,new THREE.CylinderGeometry(.06,.06,.70,40));
  const jointPin=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.58,40),b.pumpRod.material);
  jointPin.rotation.x=Math.PI/2;jointPin.userData.role='piston-rod-link-axle';root.add(jointPin);b.jointPin=jointPin;
  const foot=[pumpX-.70,air?2.21:2.25],pivotPoint=[g.leverPivot.x,g.leverPivot.y];
  const bracket=polygonClipping.difference(polygonClipping.union(capsule(foot,pivotPoint,.10,24),poly(circle(pivotPoint,.23,96))),poly(circle(pivotPoint,.184,96)));
  replace(b.pivotSupport,plate(bracket,-.30,-.20));b.pivotSupport.position.set(0,0,0);b.pivotSupport.rotation.set(0,0,0);b.pivotSupport.scale.set(1,1,1);
  let inlet,output,liquid,gas;
  if(!air){
    const axisX=-1.48;inlet=risingElbow(-.54,axisX,-.72,.40);
    const upper=new THREE.LineCurve3(new THREE.Vector3(axisX,g.deliveryValveSeatY+.42,0),new THREE.Vector3(axisX,3.45,0));
    replace(b.deliveryPipe,mergePassageParts([curvedPipeWall(inlet,.235,.29,80),curvedPipeWall(upper,.235,.29,24)]));
    replace(b.deliveryValveBody,horizontalTurned([[-.40,.235],[-.40,.29],[-.23,.48],[.30,.48],[.42,.29],[.42,.235],[.30,.425],[-.23,.425]]));
    b.deliveryValveBody.position.set(axisX,g.deliveryValveSeatY,0);b.deliveryValveBody.scale.set(1,1,1);
    replace(b.deliveryValveSeat,horizontalRing(.245,.425,-.055,.035));b.deliveryValveSeat.rotation.set(0,0,0);
    output=new THREE.CurvePath();output.add(inlet);output.add(new THREE.LineCurve3(inlet.getPoint(1),upper.getPoint(0)));output.add(upper);
    replace(b.deliveryWater,new THREE.TubeGeometry(output,128,.18,16,false));
  }else{
    const x=g.chamberCenter.x;g.chamberCenter.y=2.15;
    inlet=risingElbow(pumpX-.55,x,-.15,.55);
    replace(b.pumpDeliveryPipe,curvedPipeWall(inlet,.215,.27,96));
    replace(b.pumpDeliveryWater,new THREE.TubeGeometry(inlet,96,.18,16,false));
    replace(b.chamberNeck,portedBarrel(.475,.53,.40,1.20,.95,.23,-1));b.chamberNeck.position.set(x,0,0);
    // Brown's vessel is a smooth bulb: a rounded bottom rising from the neck
    // to its widest girth, closed by an elliptical dome round the dip tube.
    // Dense sampling keeps the piecewise-linear volume law while the
    // rendered outline reads round.
    const vessel=wall=>{
      const points=[],girth=.98-wall,topR=.28-wall;
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
    const side=new THREE.CatmullRomCurve3([[x,.95],[x-.40,.95],[x-.78,.88],[x-1.10,.90],[x-1.35,1.08],[x-1.46,1.40],[x-1.47,1.80],[x-1.47,2.75]].map(([px,py])=>new THREE.Vector3(px,py,0)),false,'centripetal');
    replace(b.selectedOutlet,curvedPipeWall(side,.17,.24,80));replace(b.selectedOutletWater,new THREE.TubeGeometry(side,80,.15,14,false));output=side;
    const dip=new THREE.LineCurve3(new THREE.Vector3(x,1.25,0),new THREE.Vector3(x,4.10,0));
    replace(b.alternativeOutlet,curvedPipeWall(dip,.145,.20,32));b.alternativeCap.position.set(x,4.15,0);
    for(const o of root.children)if(o.geometry?.type==='TorusGeometry'&&o.position.x===x)o.visible=false;
  }
  d.updateSolids=state=>{
    b.sliderLink.position.z=.26;jointPin.position.copy(state.pistonRodJoint);jointPin.position.z=.10;
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
