import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { boredPlanarLinkGeometry } from './bored-planar-link.js';
import { ratchet, makeFollower } from './maintaining-clock-parts.js';
import { plate, poly, circle, polygonClipping as clip } from './finite-plate-geometry.js';
const TAU=2*Math.PI;
const tube=(r,h,bore)=>boredLatheGeometry([{radial:r,axial:-h/2},{radial:r,axial:h/2}],bore,64);
const rectangle=(w,h,cx=0,cy=0)=>poly([[cx-w/2,cy-h/2],[cx+w/2,cy-h/2],[cx+w/2,cy+h/2],[cx-w/2,cy+h/2]]);
function replace(o,g){o.geometry.dispose();o.geometry=g;}
function presentation(root){root.userData.hideGround=true;root.traverse(o=>{for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])m.fog=false;});}

export function correctMirrorPolisher(root){
  const b=root.userData.blocks,g=root.userData.geometry;
  const body=clip.difference(clip.union(rectangle(g.longBarWidth,g.longBarLength),poly(circle([0,g.longBarLength/2],.18,64))),poly(circle([0,g.longBarLength/2],.122,64)),poly(circle([0,g.longBarLength/2-g.mirrorDistanceFromTopEye],.107,64)));
  replace(b.barBody,plate(body,-.08,.08));replace(b.upperEye,tube(.17,.19,.122));b.upperEyeBore.visible=false;b.lowerRail.position.z=-.25;
  replace(b.upperRail,plate(clip.difference(rectangle(4.40,.35),poly(circle([0,0],.122,64))),-.21,.21));
  replace(b.crankBearing,tube(.19,.48,.122));b.crankBearing.position.z=-.05;
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,1,40),b.crankPinBoss.material);shaft.rotation.x=Math.PI/2;shaft.position.z=-.16;shaft.userData.role='actual-crankshaft-through-fixed-bearing';b.inputRotor.add(shaft);b.crankShaft=shaft;
  const arm=b.inputRotor.children.find(o=>o.userData.role==='crank-arm-to-long-bar-upper-eye');
  replace(arm,boredPlanarLinkGeometry({length:g.crankRadius,width:.13,eyeRadius:.18,boreRadius:.122,depth:.18}));arm.position.set(0,0,.18);
  b.handleArm.position.z=.18;replace(b.crankPinBoss,new THREE.CylinderGeometry(.12,.12,.46,32));b.crankPinBoss.position.z=.06;
  const eccentricShape=clip.difference(poly(circle([0,0],.34,96)),poly(circle([-g.eccentricity,0],.122,64)));
  replace(b.eccentricDisk,plate(eccentricShape,-.06,.06).rotateX(-Math.PI/2));
  replace(b.mirrorBacking,plate(clip.difference(rectangle(g.mirrorSize+.10,g.mirrorSize+.10),poly(circle([0,0],.107,64))),-.075,.075));
  // Brown's mirror is one plain square plate: a silvered block, not a white
  // panel inset in a dark border.
  b.mirrorFace.visible=false;b.mirrorBacking.material=b.mirrorFace.material.clone();b.mirrorBacking.material.color.set(0xc3c9cb);
  // Brown draws no crank or mirror index marks; they stay as hidden references.
  b.mirrorIndex.visible=false;b.shaftIndex.visible=false;
  b.clickCarrier.position.z=.22;b.carrierPivot.visible=false;
  const carrierShape=clip.difference(clip.union(rectangle(g.carrierPivotRadius,.085,g.carrierPivotRadius/2),poly(circle([0,0],.14,48)),poly(circle([g.carrierPivotRadius,0],.13,48))),poly(circle([0,0],.107,48)),poly(circle([g.carrierPivotRadius,0],.082,48)));
  replace(b.carrierArm,plate(carrierShape,-.02,.02));b.carrierArm.position.set(0,0,-.115);
  for(const o of [b.pawlBody,b.pawlTip,b.contactMarker])o.visible=false;
  const pawl=new THREE.Group();pawl.position.set(g.carrierPivotRadius,0,0);pawl.rotation.z=Math.atan2(-.22,.68-g.carrierPivotRadius);b.clickCarrier.add(pawl);
  const length=Math.hypot(.68-g.carrierPivotRadius,.22),stub=new THREE.Mesh(new THREE.BoxGeometry(length,.08,.12),b.pawlBody.material);stub.userData.role='polishing-click-body';pawl.add(stub);
  const phase=g.carrierBaseAngle+Math.atan2(-.22,.68)+.05*g.ratchetToothPitch;
  b.ratchetWheel.rotation.z=0;
  const outline=ratchet(b.ratchetWheel,{radius:g.ratchetOuterRadius,bore:.107,teeth:g.ratchetToothCount,hand:1,phase,depth:.14});
  b.finiteClick=makeFollower(pawl,b.ratchetWheel,[0,0],outline);
  replace(b.finiteClick.pin,new THREE.CylinderGeometry(.08,.08,.485,32));b.finiteClick.pin.position.z=.1075;
  replace(b.eccentricFollower.userData.outer,tube(.043,1,.031));
  root.userData.updatePolishingInterfaces=state=>b.finiteClick.update(state.ratchetAngle-state.carrierAngle);
  root.userData.minimumDisplayCycleSeconds=10;
  root.userData.reconstructionNote='The guided bar follows the crank exactly. Mirror indexing and the eccentric-driven carrier stroke are prescribed, with a geometric overrunning click. The telescoping follower is an illustrative transmission, not a closed rigid linkage or a validated passive ratchet under polishing load.';
  presentation(root);
}

export function correctLensPolisher(root){
  const b=root.userData.blocks,g=root.userData.geometry,cup=b.cupRotor,d=cup.userData;
  const bearing=b.frame.children.find(o=>o.userData.role==='fixed-bearing-around-upright-rotating-shaft');
  replace(bearing,tube(.24,.32,.112));bearing.position.z=0;b.upperBearing=bearing;
  // Pass 57: the bearing arm runs back past the lens and the cup's sweep
  // (radius 1.43) to a plain pillar standing on the table's rear edge, so the
  // shaft's bearing no longer ends in mid-air. Shape y maps to world z - 0.415.
  const pillarNear=-1.47,pillarFar=-1.67;
  const bracketShape=clip.difference(rectangle(.44,.54-(pillarFar+.415),0,(.54+pillarFar+.415)/2),poly(circle([0,.415],.112,64)));
  const bracket=new THREE.Mesh(plate(bracketShape,-.125,.125).rotateX(Math.PI/2),b.frame.children[0].material);bracket.position.set(0,3.86,-.415);b.frame.add(bracket);b.bearingBridge=bracket;
  const tableTop=b.frame.children[0].position.y+.12,pillarTop=3.86-.125;
  const pillar=new THREE.Mesh(new THREE.BoxGeometry(.22,pillarTop-tableTop,pillarNear-pillarFar),b.frame.children[0].material);
  pillar.position.set(0,(pillarTop+tableTop)/2,(pillarNear+pillarFar)/2);pillar.userData.role='fixed-pillar-carrying-shaft-bearing-arm';b.frame.add(pillar);b.bearingPillar=pillar;
  replace(b.handwheel,tube(.72,.23,.112));
  // A compact captured ball fits above the glass; an annular cup opening
  // makes room for its spherical socket without a sphere piercing the pad.
  replace(b.ball,new THREE.SphereGeometry(.075,48,32));
  const shellProfile=[];
  for(let i=0;i<=40;i++){const a=.085+(g.cupCapAngle-.085)*i/40;shellProfile.push(new THREE.Vector2(g.cupOuterRadius*Math.sin(a),g.cupOuterRadius*Math.cos(a)-g.cupOuterRadius));}
  for(let i=40;i>=0;i--){const a=.085+(g.cupCapAngle-.085)*i/40;shellProfile.push(new THREE.Vector2(g.polishingRadius*Math.sin(a),g.polishingRadius*Math.cos(a)-g.cupOuterRadius));}
  shellProfile.push(shellProfile[0].clone());
  replace(d.outerShell,new THREE.LatheGeometry(shellProfile.reverse(),96).translate(0,g.cupOuterRadius,0));d.outerShell.position.y=-g.cupOuterRadius;
  replace(d.polishingLayer,new THREE.SphereGeometry(g.polishingRadius,96,36,0,TAU,.085,g.cupCapAngle-.085));
  d.polishingLayer.material.polygonOffset=true;d.polishingLayer.material.polygonOffsetFactor=-1;d.polishingLayer.material.polygonOffsetUnits=-1;
  const section=[new THREE.Vector2(.13,-.05),new THREE.Vector2(.13,.05)];
  for(let i=0;i<=32;i++){const y=.05-.10*i/32;section.push(new THREE.Vector2(Math.sqrt(.077**2-y*y),y));}
  section.push(section[0].clone());replace(d.socket,new THREE.LatheGeometry(section,64));d.socket.rotation.set(0,0,0);d.socket.position.y=0;
  cup.children.find(o=>o.userData.role==='short-cup-neck-below-ball-socket').visible=false;
  // Slim stem through the socket opening; the broad bent carrier stops above it.
  const ball=b.ball.position.clone(),upper=new THREE.Vector3(.44,2.24,0),direction=upper.clone().sub(ball).normalize();
  b.bentArmLower.userData.setEndpoints(upper,ball.clone().addScaledVector(direction,.15));
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.17,28),b.ball.material);stem.position.copy(ball).addScaledVector(direction,.085);stem.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);stem.userData.role='ball-joint-neck-with-socket-clearance';b.shaftRotor.add(stem);b.ballStem=stem;
  for(const marker of b.lens.userData.fixedSurfaceIndexes){const normal=marker.position.clone().normalize();replace(marker,new THREE.CircleGeometry(.045,24));marker.position.copy(normal).multiplyScalar(g.lensRadius+.001);marker.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);}
  const lensBottom=new THREE.Mesh(new THREE.CircleGeometry(g.lensRadius,96),b.lens.userData.hemisphere.material);lensBottom.rotation.x=Math.PI/2;b.lens.add(lensBottom);b.lensBottom=lensBottom;
  const support=new THREE.Mesh(new THREE.CylinderGeometry(g.lensRadius,g.lensRadius,.10,96),b.frame.children[0].material);support.position.y=-.05;b.frame.add(support);b.lensSupport=support;
  root.userData.minimumDisplayCycleSeconds=12;
  root.userData.reconstructionNote='The cup is eccentric and conformal to the spherical work, with a captured ball joint. Its independent spin is prescribed by a zero-twist transport law. Friction-driven spin, pressure, wear and material removal are not simulated; the polishing surfaces retain a small display separation.';
  root.userData.dynamics.idealizations.push('zero-twist spin is a prescribed kinematic illustration, not a friction-validated passive response');
  root.userData.degreesOfFreedom.note='The cup has a free physical spin DOF; this illustration prescribes it with the zero-twist transport law rather than solving friction and inertia.';
  root.userData.jointReview={ballRadius:.075,socketRadius:.077,cupApertureAngle:.085};
  presentation(root);
}
