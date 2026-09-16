import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { curvedPipeWall } from './finite-fluid-passages.js';
import { plate, poly, circle, polygonClipping } from './finite-plate-geometry.js';
import receiverData from './generated/oscillating-column-port.js';
const tube=(r,b,h)=>boredLatheGeometry([{radial:r,axial:-h/2},{radial:r,axial:h/2}],b,64);
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
const lathe=points=>new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(...p)),96);

export function correctOscillatingColumnParts(root){
 const d=root.userData,b=d.blocks,g=d.geometry,p={};
 b.base.visible=false;
 const receiver=new THREE.BufferGeometry();receiver.setAttribute('position',new THREE.Float32BufferAttribute(receiverData.positions,3));receiver.setIndex(receiverData.indices);
 replace(b.lowerTube,toCreasedNormals(receiver,Math.PI/5));receiver.dispose();
 replace(b.nozzle,tube(.43,.365,g.nozzleTopY-g.nozzleBottomY));
 const outlet=new THREE.LineCurve3(new THREE.Vector3(1.27,-1.49,0),new THREE.Vector3(3.775,-1.49,0));
 replace(b.outletPipe,curvedPipeWall(outlet,.23,.28,4,48));b.outletPipe.position.set(0,0,0);b.outletPipe.rotation.set(0,0,0);
 const floor=b.reservoir.children[3];
 const outline=polygonClipping.difference(poly([[-3.115,-.93],[.96,-.93],[.96,.93],[-3.115,.93]]),poly(circle([0,0],.435,96)));
 replace(floor,plate(outline,-.07,.07).rotateX(Math.PI/2));floor.position.set(0,1.61,0);floor.userData.role='upper-reservoir-floor-with-round-throat';b.reservoir.children[4].visible=false;p.floor=floor;
 replace(b.reservoirWater,new THREE.BoxGeometry(3.93,.50,1.60));b.reservoirWater.position.y=1.935;
 replace(b.nozzleWater,new THREE.CylinderGeometry(.33,.33,1.105,48));b.nozzleWater.position.y=1.1325;
 const rim=root.children.find(o=>o.geometry?.type==='TorusGeometry'&&o.geometry.parameters.radius===.80);
 replace(rim,new THREE.TorusGeometry(.795,.008,10,64));rim.position.y=-.29;p.plateRim=rim;
 p.film=new THREE.Mesh(new THREE.CylinderGeometry(.865,.865,.022,64),b.fallingJet.material);p.film.position.y=-.208;p.film.userData.role='thin-water-film-over-fixed-plate';root.add(p.film);
 replace(b.spillCurtain,lathe([[1.15,-1.43],[1.17,-1.43],[.87,-.21],[.85,-.21],[1.15,-1.43]]));b.spillCurtain.position.set(0,0,0);
 b.spillCurtain.material=b.spillCurtain.material.clone();
 replace(b.lowerWater,lathe([[.177,-1.805],[1.23,-1.805],[1.23,-1.43],[.105,-1.43],[.105,-1.645],[.285,-1.645],[.177,-1.805]]));b.lowerWater.position.set(0,0,0);
 replace(b.outletWater,new THREE.CylinderGeometry(.17,.17,2.73,48));b.outletWater.position.set(2.465,-1.49,0);
 p.stemFoot=root.children.find(o=>o.geometry?.type==='CylinderGeometry'&&o.geometry.parameters.radiusTop===.28&&o.geometry.parameters.height===.22);
 p.fixed=[b.lowerTube,b.lowerFloor,b.nozzle,b.outletPipe,b.plate,b.plateStem,p.stemFoot,p.floor,...root.children.filter(o=>o.geometry?.type==='TorusGeometry'),...b.reservoir.children.filter(o=>o!==p.floor&&o.visible&&o.geometry)];
 p.descendingCurves=b.descendingMarkers.map((_,i)=>{
  const angle=i*2.39996;
  const points=[[.18,1.50],[.18,.60],[.24,-.07],[.72,-.09],[.91,-.34],[1.12,-1.25],[1.12,-1.53]]
   .map(([r,y])=>new THREE.Vector3(r*Math.cos(angle),y,r*Math.sin(angle)));
  const curve=new THREE.CatmullRomCurve3(points,false,'centripetal');curve.arcLengthDivisions=512;curve.updateArcLengths();return curve;
 });
 const progress=(v)=>THREE.MathUtils.euclideanModulo(v,1);
 d.updateFluidInterfaces=(time,state)=>{
  const relativeFlow=state.downwardFlowRate/g.supplyFlowRate;
  const crownGate=THREE.MathUtils.smoothstep(state.coneFraction,.12,.22);
  b.coneCrown.visible=crownGate>0;b.coneCrown.scale.setScalar((.48+.52*state.coneFraction)*crownGate);
  b.spillCurtain.scale.set(1,1,1);b.spillCurtain.material.opacity=.20+.13*Math.min(1.5,relativeFlow);
  const flowScale=THREE.MathUtils.clamp(.72+.28*relativeFlow,.62,1.30);b.outletWater.scale.set(flowScale,1,flowScale);
  // Integral of Q_down = Q_supply - dV_storage/dt. Unlike phase*Q,
  // this travel never reverses or jumps when the prescribed flow rate changes.
  const turn=g.sourcePhase+time/g.cycleDuration-state.upperStorageVolume/(g.supplyFlowRate*g.cycleDuration);
  b.descendingMarkers.forEach((marker,i)=>{
   const u=progress(turn+i/b.descendingMarkers.length);marker.position.copy(p.descendingCurves[i].getPointAt(u));
   marker.visible=true;marker.scale.setScalar(.72*Math.sin(Math.PI*u)*Math.min(1,Math.sqrt(Math.max(0,relativeFlow))));
  });
  b.outletMarkers.forEach((marker,i)=>{
   const u=progress(turn+i/b.outletMarkers.length);marker.position.set(THREE.MathUtils.lerp(1.10,3.80,u),-1.49,0);marker.scale.setScalar(.78*Math.sin(Math.PI*u));
  });
  b.risingMarkers.forEach((marker,i)=>{
   const u=progress(state.upperColumnFraction*1.6+i/b.risingMarkers.length),height=(g.reservoirWaterY-g.plateTopY+.16)*state.upperColumnFraction;
   marker.position.set(.08*Math.sin(i*1.7),g.plateTopY+.12+u*Math.max(0,height-.18),.08);
   const riseGate=Math.min(1,Math.max(0,state.upperStorageVolumeRate)/.055);
   marker.visible=riseGate>0;marker.scale.setScalar(.72*Math.sin(Math.PI*u)*riseGate*Math.min(1,state.upperColumnFraction*5));
  });
  p.markerTravelTurns=turn;
 };
 d.dynamics.fluidModel='The upper-storage scalar balance is exact, while the visible fluid envelopes are illustrative. This is not a CFD solution: cone volume, pressure-wave propagation, turbulence, entrained air, breakup and losses are not solved.';
 for(const marker of[...b.descendingMarkers,...b.risingMarkers,...b.outletMarkers]){marker.castShadow=false;marker.receiveShadow=false;}
 d.oscillatingColumnParts=p;
 d.hideGround=true;d.minimumDisplayCycleSeconds=5.6;d.cameraDistanceScale=1;
 d.cameraDirection=new THREE.Vector3(.35,1.0,15);
 d.reconstructionNote='All solid parts remain fixed, as in the engraving. Cone buildup, checking, raised-column storage and collapse are prescribed fluid envelopes; pressure recovery, free-surface instability and the historical device’s operating threshold are not solved.';
 b.lowerTube.material.opacity=.16;b.fallingJet.material.opacity=.36;b.waterCone.material.opacity=.56;
 root.traverse(o=>{for(const m of[].concat(o.material??[])){m.fog=false;if(m.transparent){m.depthWrite=false;o.castShadow=false;o.receiveShadow=false;}}});
}
