import * as THREE from 'three';
import {plate, poly, circle, sector, polygonClipping as clip} from './finite-plate-geometry.js';
import {boredCylinderGeometry} from './piston-guide-parts.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';

function replace(mesh, geometry) {
  mesh.geometry.dispose();
  mesh.geometry = geometry;
}
function add(parent, geometry, material, role) {
  const part = new THREE.Mesh(geometry, material);
  part.userData.role = role;
  parent.add(part);
  return part;
}
function keyedBore(radius, length) {
  const hole = clip.union(poly(circle([0,0], .136, 128)),
    poly([[.10,-.055],[.19,-.055],[.19,.055],[.10,.055]]));
  return plate(clip.difference(poly(circle([0,0],radius,128)),hole),-length/2,length/2).rotateX(Math.PI/2);
}
function correctPickering(root) {
  const {blocks:b,geometry:g} = root.userData;
  replace(b.lowerFlange, keyedBore(.81,.23));
  replace(b.lowerKeeper, keyedBore(.66,.17));
  replace(b.sleeveBody, keyedBore(.34,.80));
  b.lowerSleeveNeck = add(b.slidingSleeve,keyedBore(.34,.28),b.sleeveBody.material,'bored-neck-joining-sleeve-and-lower-flange');
  b.lowerSleeveNeck.position.y = -.16;
  // A feather is fixed to the shaft. The sleeve slides over its whole length.
  b.governorRotor.add(b.featherKey);
  replace(b.featherKey,new THREE.BoxGeometry(.055,g.sleeveStroke+.80,.09));
  b.featherKey.position.set(.15,(g.sleeveMaximumY+g.sleeveMinimumY)/2-.62,0);
  replace(b.bearingHousing,boredCylinderGeometry(.48,.136,.30));
  // These are shaft shoulders in the source, not floating torus decorations.
  for (const ring of [b.thrustRingUpper,b.thrustRingLower]) {
    replace(ring,keyedBore(.49,.12));ring.rotation.set(0,0,0);
  }
  b.pedestalFoot.visible = b.pedestalStem.visible = b.cameraEnvelope.visible = false;
  const profile=Array.from({length:49},(_,i)=>{
    const axial=-.32+.64*i/48;
    return {axial,radial:.34*Math.sqrt(1-(axial/.36)**2)};
  });
  for (const a of b.springAssemblies) {
    // An oval weight with a real axial passage for the leaf. The historical
    // tapered plugs are represented by two small clamping pads at mid-height.
    replace(a.ball,boredLatheGeometry(profile,.13,96).scale(.58/.34,1,1));
    a.ball.rotation.set(0,0,0);
    a.ballClampPin.visible = false;
    a.clampPads=[-1,1].map(sign=>{
      const pad=add(a.ball,new THREE.BoxGeometry(.12,.09,.05),a.ballClampPin.material,'weight-clamp-pad-beside-leaf');
      pad.position.z=sign*.125;return pad;
    });
    a.ballIndex.visible=false;
  }
  root.userData.minimumDisplayCycleSeconds=16;
  root.userData.workingClampReview={
    interfaces:'Keyed through-bores, a shaft-fixed feather, connected sleeve shoulders, bored lower journal and real leaf passages through the oval weights.',
    residual:'The calibrated radial spring law and changing spindle speed prescribe a quasi-static response. Leaf centerlines conserve length, but bending stress, inertia, gravity, valve load and passive stability are not solved. End clamps and central pads represent fixed material attachments; historical taper plugs and fasteners are simplified.',
  };
}
function correctProny(root) {
  const {blocks:b,geometry:g}=root.userData;
  replace(b.drumBody,new THREE.CylinderGeometry(g.drumRadius,g.drumRadius,g.drumDepth,512));
  // No decorative extrusion bevel may project into the sliding drum surface.
  for (const part of [b.upperShoe,b.lowerBandBacking,...b.lowerStraps]) {
    const p=part.userData,inner=part===b.upperShoe||part===b.lowerBandBacking?g.drumRadius/Math.cos((p.endAngle-p.startAngle)/512):p.innerRadius;
    replace(part,plate(sector(inner,p.outerRadius,p.startAngle,p.endAngle,256),
      -(part===b.lowerBandBacking?g.brakeDepth*.86:g.brakeDepth)/2,
      (part===b.lowerBandBacking?g.brakeDepth*.86:g.brakeDepth)/2));
  }
  // Spin index belongs on the face, not hovering above the rim.
  b.drumIndex.position.z=g.drumDepth/2+.0125;
  b.drumFaceRing.visible=false;
  // Hang the open eye below the lever rather than filling its opening with it.
  b.hangerEye.position.y=g.leverCenterY-.20;
  b.cableAnchor=b.hangerEye.position.clone().add(new THREE.Vector3(0,-.145,0));
  for(const cable of b.scaleCables) {
    const segment=cable.children[0];
    const offset=new THREE.Vector3(0,segment.scale.y/2,0).applyQuaternion(segment.quaternion);
    const ends=[segment.position.clone().add(offset),segment.position.clone().sub(offset)];
    cable.userData.setPoints([b.cableAnchor,ends.sort((a,c)=>a.y-c.y)[0]]);
  }
  // The stop blocks need a real bridge to their rear fixed standard.
  b.stopBridges=[b.upperStop,b.lowerStop].map(stop=>{
    const bridge=add(root,new THREE.BoxGeometry(.10,.12,.50),b.stopPost.children[0].material,'stop-block-to-rear-standard');
    bridge.position.set(stop.position.x,stop.position.y,.045);return bridge;
  });
  // The stops' rear standard stood on nothing: carry it down to a plain foot
  // below the scale pan (clear of the pan and its cords), and hang the scale
  // ring on a short pin in a lug under the beam end instead of leaving it
  // floating below the beam.
  {
    root.updateMatrixWorld(true);
    const postBox=new THREE.Box3().setFromObject(b.stopPost),panBox=new THREE.Box3().setFromObject(b.scalePan);
    const footTop=panBox.min.y-.25,x=(postBox.min.x+postBox.max.x)/2,z=(postBox.min.z+postBox.max.z)/2;
    const standard=add(root,new THREE.BoxGeometry(postBox.max.x-postBox.min.x,postBox.min.y-footTop+.01,postBox.max.z-postBox.min.z),b.stopPost.children[0].material,'stop-standard-lower-length');
    standard.position.set(x,(postBox.min.y+footTop)/2,z);
    const foot=add(root,new THREE.BoxGeometry(.5,.1,.5),b.stopPost.children[0].material,'stop-standard-foot');
    foot.position.set(x,footTop-.05,z);
    const eye=b.hangerEye,tube=eye.geometry.parameters.tube,inner=eye.geometry.parameters.radius-tube,pinRadius=.03;
    const pinY=eye.position.y+inner-pinRadius,beamBottom=g.leverCenterY-.07;
    const pin=add(root,new THREE.CylinderGeometry(pinRadius,pinRadius,.17,32).rotateX(Math.PI/2),eye.material,'scale-ring-hook-pin');
    pin.position.set(eye.position.x,pinY,eye.position.z+.005);
    const lug=add(root,new THREE.BoxGeometry(.1,beamBottom-pinY+.01,.05),b.stopPost.children[0].material,'scale-ring-hook-lug-under-beam');
    lug.position.set(eye.position.x,(beamBottom+pinY)/2,eye.position.z-tube-.035);
  }
  root.userData.minimumDisplayCycleSeconds=g.cyclePeriod;
  root.userData.workingClampReview={
    interfaces:'Unbeveled finite friction liners tangent to the drum, connected fixed stops, an open suspension eye and flush rotation index.',
    residual:'The brake illustrates an already balanced steady operating point. Applied clamp load, Coulomb coefficient and scale weight determine the reported torque algebraically; lever equilibrium is prescribed, not a passive contact/thermal solve. Strap articulation, screw adjustment and detailed pressure distribution remain simplified.',
  };
}
export function correctClampParts(model,id) {
  if(id===287)correctPickering(model.root);else correctProny(model.root);
  const root=model.root,bounds=new THREE.Box3();root.userData.hideGround=true;
  root.traverse(o=>{for(const m of [].concat(o.material??[]))m.fog=false;});
  const period=id===287?root.userData.geometry.responseCyclePeriod:root.userData.geometry.cyclePeriod;
  for(let i=0;i<=48;i++) {
    model.update(period*i/48);root.updateMatrixWorld(true);
    root.traverseVisible(o=>{if(o.geometry){o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});
  }
  root.userData.cameraFitBounds=bounds.expandByScalar(.04);
  root.userData.cameraDistanceScale=1.02;
  model.cameraDirection=id===287?new THREE.Vector3(7.5,.4,13):new THREE.Vector3(.45,.6,15);
  model.update(0);
}
