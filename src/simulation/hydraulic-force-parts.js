import * as THREE from 'three';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
import {horizontalRing} from './horizontal-turbine-solids.js';
import {boredPlanarLinkGeometry} from './bored-planar-link.js';
import {curvedPipeWall} from './finite-fluid-passages.js';
import {fitPistonGuide} from './piston-guide-parts.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
const mesh=(parent,g,material,role)=>{const o=new THREE.Mesh(g,material);o.userData.role=role;parent.add(o);return o;};

// backHalf keeps only the z<0 half, closed at the cut, as Brown sections
// the cylinders through their axes.
export function sidePortedShell(inner,outer,low,high,portY,halfHeight,side=1,minCos=.982,backHalf=false) {
  const n=128,levels=[low,portY-halfHeight,portY+halfHeight,high],positions=[];
  const active=(i,j)=>j>=0&&j<3&&!(j===1&&Math.cos((i+.5)*2*Math.PI/n)*side>minCos)&&!(backHalf&&Math.sin((i+.5)*2*Math.PI/n)>0);
  const point=(r,y,i)=>new THREE.Vector3(r*Math.cos(i*2*Math.PI/n),y,r*Math.sin(i*2*Math.PI/n));
  const face=(p,normal)=>{if(p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).dot(normal)<0)p.reverse();for(const k of[0,1,2,0,2,3])positions.push(...p[k].toArray());};
  for(let j=0;j<3;j++)for(let i=0;i<n;i++)if(active(i,j)){
    const a=levels[j],b=levels[j+1],theta=(i+.5)*2*Math.PI/n;
    for(const[r,sign]of[[outer,1],[inner,-1]])face([point(r,a,i),point(r,a,i+1),point(r,b,i+1),point(r,b,i)],new THREE.Vector3(sign*Math.cos(theta),0,sign*Math.sin(theta)));
    for(const[next,y,sign]of[[j-1,a,-1],[j+1,b,1]])if(!active(i,next))face([point(inner,y,i),point(outer,y,i),point(outer,y,i+1),point(inner,y,i+1)],new THREE.Vector3(0,sign,0));
    for(const[next,k,sign]of[[(i+n-1)%n,i,-1],[(i+1)%n,i+1,1]])if(!active(next,j))face([point(inner,a,k),point(outer,a,k),point(outer,b,k),point(inner,b,k)],new THREE.Vector3(-sign*Math.sin(k*2*Math.PI/n),0,sign*Math.cos(k*2*Math.PI/n)));
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
}
function pipe(parent,points,inner,outer,material,role){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(parent,curvedPipeWall(curve,inner,outer,64,24),material,role);}

export function correctHydraulicForceParts(root,id) {
  const d=root.userData,b=d.blocks,g=d.geometry,press=id===466,z=g.pumpLeverPivot.z;
  const bar=b.pumpLever.children[0],pin=b.pumpLever.children.find(o=>o.userData.role?.includes('lever')&&o.geometry?.type==='CylinderGeometry'),axle=press?b.leverAxle:b.pumpLeverAxle;
  const pinRadius=press?.10:.085,axleRadius=press?.15:.13;
  const shape=clip.difference(clip.union(poly([[-.48,-.065],[2.20,-.065],[2.20,.065],[-.48,.065]]),poly(circle([0,0],axleRadius+.08,64)),poly(circle([g.pumpLeverPinRadius,0],pinRadius+.055,64))),poly(circle([0,0],axleRadius+.004,64)),poly(circle([g.pumpLeverPinRadius,0],pinRadius+.004,64)));
  replace(bar,plate(shape,-.09,.09));bar.position.x=0;
  replace(pin,new THREE.CylinderGeometry(pinRadius,pinRadius,.74,48));
  const l=g.pumpPitmanLength,link=boredPlanarLinkGeometry({length:l,width:.095,eyeRadius:pinRadius+.055,boreRadius:pinRadius+.004,depth:.08});
  link.translate(-l/2,0,0).rotateZ(Math.PI/2).scale(1,1/l,1);replace(b.pumpPitman,link);
  b.crossheadPin=mesh(root,new THREE.CylinderGeometry(pinRadius,pinRadius,.74,48),pin.material,'finite-crosshead-pitman-pin');b.crossheadPin.rotation.x=Math.PI/2;
  const stand=root.children.find(o=>o.geometry?.type==='BoxGeometry'&&o.position.x===g.pumpLeverPivot.x&&o!==b.pumpCrosshead);
  // 466: Brown's lever post rises above the reservoir, standing on a bracket
  // from the tank's rim rather than passing down through the water.
  const standFoot=press?.66-g.pumpLeverPivot.y:g.groundY+.12-g.pumpLeverPivot.y;
  // 466: Brown draws the post as a slender upright under the right side of
  // the fulcrum eye, so the pendant ball hangs beside it, not in front of it.
  const standX=press?.22:0,standHalf=press?.07:.12;
  const standProfile=clip.difference(clip.union(capsule([standX,standFoot],[standX,press?-.08:0],standHalf,24),poly(circle([0,0],axleRadius+.09,64))),poly(circle([0,0],axleRadius+.004,64)));
  replace(stand,plate(standProfile,-.07,.07));stand.position.copy(g.pumpLeverPivot);stand.position.z=z-.24;b.leverStand=stand;
  const pumpBottom=press?g.pumpCylinderBottomY:-.90,pumpTop=press?g.pumpCylinderTopY:.04;
  replace(b.pumpCylinder,sidePortedShell(g.pumpPlungerRadius+.004,g.pumpPlungerRadius+.075,pumpBottom,pumpTop,press?-.30:-.59,press?.10:.09,press?-1:1,.55,press));
  if(press)b.pumpCylinder.material=b.foundation.material;
  replace(b.inletValve,new THREE.CylinderGeometry(g.pumpPlungerRadius-.005,g.pumpPlungerRadius-.005,press?.045:.040,48));b.pumpCylinder.position.set(g.pumpSliderX,0,z);
  b.checkSeats=[];
  for(const [valve,bottom]of[[b.inletValve,press?pumpBottom+.08:-.82],[b.deliveryValve,press?-.15:-.43]]) {
    const half=valve.geometry.parameters.height/2;
    const seat=mesh(root,horizontalRing(press?.085:.065,press?.17:.14,-.045,0),valve.material,'bored-pump-check-seat');
    seat.position.set(valve.position.x,bottom-half,z);b.checkSeats.push(seat);
  }
  const valveX=b.deliveryValve.position.x,valveLow=press?-.43:-.72,valveHigh=press?.08:-.20;
  const chamberInner=press?.18:.145,chamberOuter=press?.22:.18,portY=press?-.30:-.59;
  b.deliveryChamber=mesh(root,sidePortedShell(chamberInner,chamberOuter,valveLow,valveHigh,portY,press?.105:.095,press?1:-1,.55),b.pumpCylinder.material,'finite-delivery-check-chamber');b.deliveryChamber.position.set(valveX,0,z);
  b.deliveryFloor=mesh(root,new THREE.CylinderGeometry(chamberOuter,chamberOuter,.035,64),b.foundation.material,'closed-delivery-chamber-floor');b.deliveryFloor.position.set(valveX,valveLow-.0175,z);
  b.deliveryCap=mesh(root,horizontalRing(press?.066:.062,chamberOuter,0,.04),b.foundation.material,'bored-delivery-chamber-outlet');b.deliveryCap.position.set(valveX,valveHigh,z);
  replace(b.checkSeats[1],horizontalRing(press?.085:.065,press?.205:.165,-.045,0));
  b.deliveryIntake=pipe(root,[[g.pumpSliderX+(press?-1:1)*(g.pumpPlungerRadius+.005),portY,z],[valveX,portY,z]],press?.066:.062,press?.10:.085,b.foundation.material,'finite-pump-to-delivery-check-intake');
  let update=()=>{};
  if(press) {
    replace(b.ramCylinder,sidePortedShell(g.ramRadius+.004,g.ramRadius+.09,g.ramCylinderBottomY,g.ramCylinderTopY,-.72,.12,1,.982,true));b.ramCylinder.position.y=0;
    b.ramCylinder.material=b.foundation.material;
    b.leverRimBar=mesh(root,new THREE.BoxGeometry(.86,.12,.14),b.foundation.material,'fixed-rim-bracket-carrying-hand-lever-post');b.leverRimBar.position.set(.97,.60,z-.24);
    b.ramFloor=mesh(root,new THREE.CylinderGeometry(g.ramRadius+.09,g.ramRadius+.09,.08,64),b.foundation.material,'closed-ram-cylinder-floor');b.ramFloor.position.set(g.ramAxisX,g.ramCylinderBottomY+.04,0);
    replace(b.ramRod,new THREE.CylinderGeometry(g.ramRadius,g.ramRadius,1.40,64));
    replace(b.movingPlaten,new THREE.BoxGeometry(2.06,.20,1.52));
    for(const column of b.pressFrame.children)if(column!==b.fixedHead)column.position.z=-.55;
    const leftWall=b.pumpReservoir.children.find(o=>o.position.x===.62);
    replace(leftWall,plate(clip.difference(poly([[-.96,-.55],[.96,-.55],[.96,.55],[-.96,.55]]),poly(circle([0,-.19],.18,64))),-.08,.08).rotateY(Math.PI/2));
    const curve=new THREE.CatmullRomCurve3([[valveX,.12,0],[valveX,.28,0],[valveX-.21,.28,0],[valveX-.29,-.20,0],[.78,-.20,0],[.62,-.20,0],[.46,-.20,0],[.10,-.50,0],[-.40,-.72,0],[-.69,-.72,0]].map(p=>new THREE.Vector3(...p)));
    replace(b.pressurePipe,curvedPipeWall(curve,.066,.10,96,24));replace(b.pressureWater,new THREE.TubeGeometry(curve,96,.055,12,false));
    replace(b.inletWater,new THREE.CylinderGeometry(.065,.065,.065,32));b.inletWater.position.y=-.50;
    b.inletPipe=pipe(root,[[g.pumpSliderX,-.532,0],[g.pumpSliderX,pumpBottom+.08-b.inletValve.geometry.parameters.height/2-.045,0]],.067,.09,b.foundation.material,'finite-reservoir-inlet-passage');
    b.reservoirWater.position.y=-.18;
    update=state=>{const bottom=g.ramCylinderBottomY+.08,top=-.13+state.ramLift,height=top-bottom;replaceWaterHeight(b.ramCylinderWater,height,(top+bottom)/2);};
    d.solidReview={status:'qualified-geometry',residual:'Ideal Pascal area/volume laws and prescribed checks/load compression remain; valve sealing, fluid pressure losses and force equilibrium are not dynamically solved.'};
  }
  d.updateSolids=state=>{b.pumpPitman.position.z=z+.28;b.crossheadPin.position.copy(state.crosshead);update(state);};
  d.minimumDisplayCycleSeconds=g.cycleDuration;fitPistonGuide(root,d.update,g.cycleDuration);d.cameraDirection=new THREE.Vector3(2.3,1.9,15);
}
function replaceWaterHeight(water,height,centerY){water.scale.y=height/water.geometry.parameters.height;water.position.y=centerY;}
