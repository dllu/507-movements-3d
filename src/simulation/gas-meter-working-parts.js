import * as THREE from 'three';
import {plate,poly,circle,capsule,ring,polygonClipping as clip} from './finite-plate-geometry.js';
import {horizontalRing,horizontalPlate} from './horizontal-turbine-solids.js';
import {curvedPipeWall,mergePassageParts} from './finite-fluid-passages.js';
import {fitPistonGuide} from './piston-guide-parts.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
const add=(p,g,m,role)=>{const o=new THREE.Mesh(g,m);o.userData.role=role;p.add(o);return o;};
const rect=(x,z)=>poly([[-x,-z],[x,-z],[x,z],[-x,z]]);
const slot=(a,b,r)=>capsule(a,b,r,32);
const sheet=(shape,low,high)=>plate(shape,low,high);

export function correctGasMeterParts(root,id,update) {
 const d=root.userData,b=d.blocks,g=d.geometry;
 if(id===481){
  replace(b.caseShell,horizontalRing(g.caseRadiusSceneUnit-.055,g.caseRadiusSceneUnit,-g.caseDepthSceneUnit/2,g.caseDepthSceneUnit/2,96));
  replace(b.journal,mergePassageParts([horizontalRing(.12,.34,-.67,-.50,64),horizontalRing(.12,.34,.50,.67,64)]));
  replace(b.axle,mergePassageParts([horizontalRing(.080,.115,-1.05,-.78,64),horizontalRing(.080,.115,.78,1.05,64)]));
  // Pipe a enters along the axis through the front journal and turns up in
  // the central well, its mouth just above Brown's water line and inside
  // the innermost hook.
  const curve=d.flowPaths.centralInletCurve;
  curve.points=[new THREE.Vector3(0,0,1.52),new THREE.Vector3(0,0,.92),new THREE.Vector3(0,0,.30),new THREE.Vector3(0,.14,.03),new THREE.Vector3(0,g.waterSurfaceY+.06,0)];curve.updateArcLengths();
  replace(b.centralInletPipeA,curvedPipeWall(curve,.040,.055,80,24));
  for(const marker of b.flowMarkers)replace(marker,new THREE.SphereGeometry(.025,16,12));
  b.caseWater.material.opacity=.10;
  const headMaterial=new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.08,depthWrite:false,side:THREE.DoubleSide});
  // The drum heads are whole discs apart from the journal bore: gas enters
  // each chamber B through the hooked mouths round pipe a and leaves through
  // the gaps in the shell, not through ports in the heads.
  b.drumHeads=[];
  for(const z of[-.52,.52]){
   const head=add(b.drum,plate(clip.difference(poly(circle([0,0],g.drumRadiusSceneUnit,128)),poly(circle([0,0],.34,64))),z-.025,z+.025),headMaterial,'finite-ported-drum-head');b.drumHeads.push(head);
  }
  replace(b.rearCaseHead,plate(clip.difference(poly(circle([0,0],g.caseRadiusSceneUnit,128)),poly(circle([0,0],.12,64))),-.025,.025));
 } else if(id===482){
  // Complete finite rectangular mercury channels; liquid remains an envelope.
  const outer=rect(2.26,1.10),outerBore=rect(2.14,1.0),inner=rect(1.80,.80),innerBore=rect(1.75,.75);
  const trough=mergePassageParts([horizontalPlate(clip.difference(outer,outerBore),-.96,-.16),horizontalPlate(clip.difference(inner,innerBore),-.96,-.16),horizontalPlate(clip.difference(outer,innerBore),-1.02,-.96)]);
  const troughMaterial=b.outerMercuryChannels[0].trough.material.clone();troughMaterial.transparent=true;troughMaterial.opacity=.25;troughMaterial.depthWrite=false;b.outerMercuryChannels[0].trough.material=troughMaterial;
  replace(b.outerMercuryChannels[0].trough,trough);b.outerMercuryChannels[0].trough.position.set(0,0,0);b.outerMercuryChannels[1].trough.visible=false;
  replace(b.outerMercuryChannels[0].mercury,horizontalPlate(clip.difference(outerBore,inner),-.955,-.205));b.outerMercuryChannels[0].mercury.position.set(0,0,0);b.outerMercuryChannels[1].mercury.visible=false;
  replace(b.cupHTop,new THREE.BoxGeometry(4.02,.18,2.0));for(const o of b.cupHSkirts)replace(o,new THREE.BoxGeometry(.18,2.22,2.0));
  b.cupCrossSkirts=[];for(const z of[-.95,.95]){const o=add(b.cupH,new THREE.BoxGeometry(3.66,2.22,.10),b.cupHTop.material,'finite-front-or-rear-pressure-cup-skirt');o.position.set(0,.35,z);o.material=o.material.clone();o.material.opacity=.10;o.material.depthWrite=false;b.cupCrossSkirts.push(o);}b.cupHPressureVolume.material.opacity=.035;
  replace(b.housingShell,new THREE.BoxGeometry(5.70,3.75,.08));b.housingShell.position.z=-1.20;
  for(const o of b.housingPosts)replace(o,new THREE.BoxGeometry(.18,3.68,2.40));
  replace(b.housingFloor,horizontalPlate(clip.difference(rect(2.86,1.22),poly(circle([g.valveCenterX,0],.245,64))),-.10,.10));
  replace(b.housingRoof,horizontalPlate(clip.difference(rect(2.725,1.20),poly(circle([g.cupConnectorX,0],.079,64))),-.09,.09));
  replace(b.guideBushing,horizontalRing(.079,.17,-.20,.20,64));
  replace(b.inletPipeE,horizontalRing(.18,.24,-1.14,1.14,64));replace(b.inletFlange,horizontalRing(.18,.47,-.12,.12,64));
  replace(b.outletPipeF,horizontalRing(.20,.27,-.42,.42,64));replace(b.outletFlangeF,horizontalRing(.20,.40,-.11,.11,64));
  const left=b.housingPosts[0];replace(left,plate(clip.difference(rect(1.20,1.84),poly(circle([0,-.69],.275,64))),-.09,.09).rotateY(Math.PI/2));
  const innerBase=b.innerMercuryChannel.children.find(o=>o.userData.role==='fixed-base-of-valve-D-mercury-seat');replace(innerBase,horizontalPlate(clip.difference(rect(.82,.82),poly(circle([0,0],.245,64))),-.10,.10));innerBase.position.y=-1.05;
  b.innerTroughWalls=add(root,mergePassageParts([horizontalPlate(clip.difference(rect(.815,.815),rect(.72,.72)),-.95,-.24),horizontalPlate(clip.difference(rect(.395,.395),rect(.335,.335)),-.95,-.24)]),innerBase.material,'finite-open-mercury-trough-around-D');b.innerTroughWalls.position.x=g.valveCenterX;b.innerTroughWalls.material=troughMaterial;
  replace(b.innerMercuryBlocks[0],horizontalPlate(clip.difference(rect(.72,.72),rect(.395,.395)),-.94,g.innerMercurySurfaceY));b.innerMercuryBlocks[0].position.set(g.valveCenterX,0,0);for(const o of b.innerMercuryBlocks.slice(1))o.visible=false;
  const notchProfile=poly([[-.58,g.valveNotchBottomLocalY],[-.58,.74],[.58,.74],[.58,g.valveNotchBottomLocalY],[.28,g.valveNotchBottomLocalY],[0,g.valveNotchApexLocalY],[-.28,g.valveNotchBottomLocalY]]);
  for(const face of b.valveSkirtFaces)replace(face,plate(notchProfile,-.020,.020));
  replace(b.valveTop,new THREE.BoxGeometry(1.20,.24,1.20));for(const o of [...b.valveNotches,...b.sideNotchIndicators])o.visible=false;
  b.valveGuide.visible=false;replace(b.valveGuideStem,new THREE.CylinderGeometry(.065,.065,.28,32));b.valveGuideStem.position.y=.98;
  replace(b.leverBar,plate(clip.difference(clip.union(slot([-g.leverCupArmSceneUnit,0],[g.leverValveArmSceneUnit,0],.095),poly(circle([0,0],.22,64))),poly(circle([0,0],.164,64)),poly(circle([-g.leverCupArmSceneUnit,0],.074,48)),poly(circle([g.leverValveArmSceneUnit,0],.074,48))),-.07,.07));b.leverBar.position.x=0;
  for(const pin of[b.cupLeverPin,b.valveLeverPin]){replace(pin,new THREE.CylinderGeometry(.070,.070,.40,48));pin.rotation.x=Math.PI/2;}
  b.cupConnector.visible=false;b.valveConnector.visible=false;
  b.sliderSeats=[];
  for(const[parent,x,y]of[[b.cupH,g.cupConnectorX,g.leverPivot.y],[b.valveD,0,g.leverPivot.y]]){
   const o=add(parent,plate(clip.difference(rect(.30,.12),slot([-.22,0],[.22,0],.074)),-.04,.04),b.leverBar.material,'finite-horizontal-pin-slot-for-guided-cup-or-valve');o.position.set(x,y,.54);b.sliderSeats.push(o);
  }
  const cupTie=add(b.cupH,new THREE.CylinderGeometry(.060,.060,.51,32),b.leverBar.material,'rigid-cup-roof-to-sliding-pin-seat');cupTie.position.set(g.cupConnectorX,1.205,.54);
  const stand=clip.difference(clip.union(slot([0,-2.73],[0,0],.10),poly(circle([0,0],.22,64))),poly(circle([0,0],.164,64)));
  b.leverStand=add(root,plate(stand,-.06,.06),b.housingFloor.material,'finite-bored-regulator-fulcrum-stand');b.leverStand.position.copy(g.leverPivot);b.leverStand.position.z=.55;
 }
 d.minimumDisplayCycleSeconds=g.cycleDuration;d.workingPartsReview={status:'bounded-finite-interfaces',residual:'The original drum/bellows motion and gas/mercury pressure laws remain prescribed or quasi-static. Passive pressure-driven dynamics, sealing, leakage and complete fluid occupancy are not solved.'};
 fitPistonGuide(root,update,g.cycleDuration);d.cameraDirection=new THREE.Vector3(1.8,1.2,15);
}
