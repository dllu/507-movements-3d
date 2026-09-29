import * as THREE from 'three';
import {plate, poly, circle, sector, polygonClipping as clip} from './finite-plate-geometry.js';
import {boredCylinderGeometry} from './piston-guide-parts.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';

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
    // p92: one flat plate whose lower end is a semicircle concentric with the
    // pin (r .05 against the .03 pin), so the pin stands centred in a round
    // eye instead of on the square end of a box.
    const lugHalf=.05,lugTop=beamBottom-pinY+.01;
    const lugOutline=clip.union(poly([[-lugHalf,0],[lugHalf,0],[lugHalf,lugTop],[-lugHalf,lugTop]]),poly(circle([0,0],lugHalf,128)));
    const lug=add(root,plate(lugOutline,-.025,.025),b.stopPost.children[0].material,'scale-ring-hook-lug-under-beam');
    lug.position.set(eye.position.x,pinY,eye.position.z-tube-.035);
  }
  // Brown's 244: a hatched wooden block fills the space between the lever D
  // and the top of pulley A (flat top under the lever, straight sides, its
  // bottom the pulley's arc); the jointed strap's end bolts run straight up
  // through the lever to their nuts; and only the stop blocks C and C' are
  // drawn, with no standard. Everything here is stationary.
  {
    const leverBack=g.leverPlaneZ-g.leverDepth/2,blockTop=g.leverCenterY+g.leverThickness/2-.01;
    // p96: every strap hinge pin (the end ones in the bolt forks too) stands
    // centred in the links' thickness, Brown's rivet dots inside the band,
    // not half outside its outer edge; the block and bolts follow the pins.
    {
      const radii=[];
      for(const strap of b.lowerStraps){const p=strap.geometry.attributes.position;for(let i=0;i<p.count;i++)radii.push(Math.hypot(p.getX(i),p.getY(i)));}
      const midRadius=(Math.min(...radii)+Math.max(...radii))/2;
      for(const pin of b.strapPins){const k=midRadius/Math.hypot(pin.position.x,pin.position.y);pin.position.x*=k;pin.position.y*=k;}
      // The two end pins sat on the end links' end faces, half outside;
      // move each into its end link so it has a full eye of metal round it.
      const pins=b.strapPins,angle=p=>Math.atan2(p.position.y,p.position.x);
      for(const [end,next] of [[pins[0],pins[1]],[pins.at(-1),pins.at(-2)]]){
        const a=angle(end),toward=Math.sign(Math.atan2(Math.sin(angle(next)-a),Math.cos(angle(next)-a)));
        const b2=a+toward*(.043+.04)/midRadius+toward*THREE.MathUtils.degToRad(1.1);
        end.position.x=midRadius*Math.cos(b2);end.position.y=midRadius*Math.sin(b2);
      }
    }
    const [first,last]=[b.strapPins[0],b.strapPins.at(-1)];
    const endPins=[first,last].sort((p,q)=>p.position.x-q.position.x);
    const strapTop=Math.max(...b.lowerStraps.map(strap=>{strap.geometry.computeBoundingBox();return strap.geometry.boundingBox.max.y;}));
    const halfWidth=Math.min(...endPins.map(pin=>Math.abs(pin.position.x)))-.055;
    const outline=clip.difference(poly([[-halfWidth,strapTop+.005],[halfWidth,strapTop+.005],[halfWidth,blockTop],[-halfWidth,blockTop]]),
      poly(circle([0,0],g.drumRadius/Math.cos(Math.PI/512),512)));
    const wood=new THREE.MeshStandardMaterial({color:0x8c5d31,roughness:.8,metalness:.02});
    replace(b.upperShoe,plate(outline,-g.brakeDepth/2,leverBack-.005));
    b.upperShoe.material=wood;b.upperShoe.userData.role='upper-wooden-brake-block-under-lever-D';
    b.upperShoe.position.z=0;
    // Its working arc is where the block's straight sides meet the pulley.
    const side=Math.asin(Math.min(1,(strapTop+.005)/g.drumRadius));
    b.upperShoe.userData.startAngle=side;b.upperShoe.userData.endAngle=Math.PI-side;
    for(const part of [...b.shoeHangers,b.leftBandLink,b.rightBandLink])part.traverse(o=>{o.visible=false;});
    // Straight eye bolts: an eye round each strap-end pin, a vertical shank
    // through the lever, and the nut on top.
    b.endBolts=b.clampScrews.map(({screw,nut},index)=>{
      const pin=endPins[index],x=pin.position.x,y=pin.position.y,z=g.leverPlaneZ;
      const top=nut.position.y,radius=.045,eyeOuter=.085;
      screw.traverse(o=>{if(o.isMesh)o.visible=false;});
      const bolt=add(b.brakeAssembly??root,new THREE.CylinderGeometry(radius,radius,top-(y+eyeOuter)+.01,32),nut.material,'straight-strap-end-eye-bolt');
      bolt.position.set(x,(top+y+eyeOuter-.01)/2,z);
      const eye=add(bolt.parent,boredLatheGeometry([{axial:-.045,radial:eyeOuter},{axial:.045,radial:eyeOuter}],.047,64).rotateX(Math.PI/2),nut.material,'strap-end-bolt-eye');
      eye.position.set(x,y,z);
      nut.position.x=x;
      // The strap-end pin reaches forward through the bolt eye.
      const pinMesh=pin.userData.rotor?.children[0]??pin.children[0];
      const pinLow=pin.position.z-pinMesh.geometry.parameters.height/2,pinHigh=z+.07;
      replace(pinMesh,new THREE.CylinderGeometry(.043,.043,pinHigh-pinLow,32));
      pin.position.z=(pinLow+pinHigh)/2;
      return {bolt,eye};
    });
    for(const part of [b.stopPost,...b.stopBridges])part.traverse(o=>{o.visible=false;});
    root.traverse(o=>{if(/^stop-standard-(lower-length|foot)$/.test(o.userData.role??''))o.visible=false;});
    centreProny244OnDrum(root,b,g,wood);
    knuckleProny244Strap(b,g,wood);
  }
  root.userData.minimumDisplayCycleSeconds=g.cyclePeriod;
  root.userData.workingClampReview={
    interfaces:'Unbeveled finite friction liners tangent to the drum, connected fixed stops, an open suspension eye and flush rotation index.',
    residual:'The brake illustrates an already balanced steady operating point. Applied clamp load, Coulomb coefficient and scale weight determine the reported torque algebraically; lever equilibrium is prescribed, not a passive contact/thermal solve. Strap articulation, screw adjustment and detailed pressure distribution remain simplified.',
  };
}
// p106: the articulated strap's hinge pins sat in the 2.2° gaps between the
// links, half in air on the links' end faces. Each inner joint is now a
// knuckle: the leading link ends in a round tongue concentric with the pin
// (one extrusion with the link), the next link's end is a concentric cup a
// running clearance larger, and the pin (a rivet dot) is bored through the
// tongue's middle. The lower lining between drum and strap is Brown's hatched
// wood, like the upper block, instead of a black rim, and stops short of the
// strap's inner face.
function knuckleProny244Strap(b,g,wood) {
  const straps=[...b.lowerStraps].sort((p,q)=>p.userData.strapIndex-q.userData.strapIndex);
  const inner=straps[0].userData.innerRadius,outer=straps[0].userData.outerRadius,mid=(inner+outer)/2;
  const tongue=.046,clearance=.004,pinR=.028,bore=pinR+.0015,seam=clearance/mid;
  const pins=b.strapPins,unwrap=(a,ref)=>a+2*Math.PI*Math.round((ref-a)/(2*Math.PI));
  const boundary=[];
  for(let k=1;k<pins.length-1;k++){
    const a=Math.atan2(pins[k].position.y,pins[k].position.x);
    boundary[k]=k===1?a:unwrap(a,boundary[k-1]+(straps[1].userData.endAngle-straps[1].userData.startAngle));
  }
  const centre=k=>[mid*Math.cos(boundary[k]),mid*Math.sin(boundary[k])];
  straps.forEach((strap,i)=>{
    const d=strap.userData,n=straps.length;
    const lo=i===0?unwrap(d.startAngle,boundary[1]):boundary[i]+seam,hi=i===n-1?unwrap(d.endAngle,boundary[n-1]):boundary[i+1];
    let outline=sector(inner,outer,lo,hi,256);
    if(i<n-1)outline=clip.union(outline,poly(circle(centre(i+1),tongue,128)));
    if(i>0)outline=clip.difference(outline,poly(circle(centre(i),tongue+clearance,128)));
    if(i<n-1)outline=clip.difference(outline,poly(circle(centre(i+1),bore,64)));
    const low=-g.brakeDepth/2,high=g.brakeDepth/2;
    replace(strap,plate(outline,low,high));
    d.knuckle={tongue,clearance,pinRadius:pinR,bore};
  });
  for(let k=1;k<pins.length-1;k++){
    const pin=pins[k],pinMesh=pin.userData.rotor?.children[0]??pin.children[0],h=pinMesh.geometry.parameters.height;
    replace(pinMesh,new THREE.CylinderGeometry(pinR,pinR,h,48));
    const [x,y]=centre(k);pin.position.x=x;pin.position.y=y;
  }
  const backing=b.lowerBandBacking,p=backing.userData,depth=g.brakeDepth*.86;
  replace(backing,plate(sector(g.drumRadius/Math.cos((p.endAngle-p.startAngle)/512),inner-.003,p.startAngle,p.endAngle,256),-depth/2,depth/2));
  backing.material=wood;backing.userData.role='continuous-lower-band-or-chain-backing';
}
// p93: Brown's lever D rests on the wooden block, both centred on the pulley.
// The lever, its nuts and bolts, the scale ring and stops C, C' were all built
// in a plane 0.3 in front, so D never bore on the block. Move that whole
// stationary group back to the pulley's mid-plane (z 0), stop the block under
// D's lower face, and hang the pan centred under its ring. The strap's end
// links fill the mid-plane, so each bolt now ends in a plain fork whose two
// cheeks straddle the end link on its hinge pin.
function centreProny244OnDrum(root,b,g,wood) {
  const dz=-g.leverPlaneZ,half=g.brakeDepth/2;
  for(const o of [b.lever,b.hangerEye,...b.clampScrews.map(c=>c.nut),...b.endBolts.map(e=>e.bolt)])o.position.z+=dz;
  root.traverse(o=>{if(/^scale-ring-hook-(pin|lug-under-beam)$/.test(o.userData.role??''))o.position.z+=dz;});
  const stopDepth=g.leverDepth+.12;
  for(const stop of [b.upperStop,b.lowerStop]){replace(stop,new THREE.BoxGeometry(.42,.16,stopDepth));stop.position.z=0;}
  // The block: flat top under D's lower face, full brake depth.
  const leverBottom=g.leverCenterY-(g.leverThickness??.14)/2;
  const shoe=b.upperShoe;shoe.geometry.computeBoundingBox();
  const {min,max}=shoe.geometry.boundingBox,halfWidth=max.x;
  const outline=clip.difference(poly([[-halfWidth,min.y],[halfWidth,min.y],[halfWidth,leverBottom],[-halfWidth,leverBottom]]),
    poly(circle([0,0],g.drumRadius/Math.cos(Math.PI/512),512)));
  replace(shoe,plate(outline,-half,half));shoe.material=wood;
  // Forked bolt ends round the strap-end pins, clear of the block's sides.
  root.updateMatrixWorld(true);
  const strapBoxes=b.lowerStraps.map(s=>new THREE.Box3().setFromObject(s));
  const strapBack=Math.min(...strapBoxes.map(box=>box.min.z)),strapFront=Math.max(...strapBoxes.map(box=>box.max.z));
  const cheek=.03,gap=.012,eyeR=.075,pinR=.043;
  b.endBolts.forEach(({bolt,eye},index)=>{
    eye.visible=false;
    const x=bolt.position.x,pinY=eye.position.y,side=Math.sign(x);
    const top=pinY+eyeR+.03,boltBottom=bolt.position.y-bolt.geometry.parameters.height/2;
    // Keep the fork outboard of the block's side (x = ±halfWidth).
    const inner=poly([[side>0?halfWidth+.006:-2,-2],[side>0?2:-halfWidth-.006,-2],[side>0?2:-halfWidth-.006,2],[side>0?halfWidth+.006:-2,2]]);
    const cheekOutline=clip.intersection(clip.union(poly(circle([x,pinY],eyeR,96)),poly([[x-.045,pinY],[x+.045,pinY],[x+.045,top],[x-.045,top]])),inner);
    const holed=clip.difference(cheekOutline,poly(circle([x,pinY],pinR+.002,64)));
    const front=add(root,plate(holed,strapFront+gap,strapFront+gap+cheek),bolt.material,'strap-end-bolt-fork-cheek');
    const back=add(root,plate(holed,strapBack-gap-cheek,strapBack-gap),bolt.material,'strap-end-bolt-fork-cheek');
    const bridge=add(root,plate(poly([[x-.045,top-.03],[x+.045,top-.03],[x+.045,Math.max(top,boltBottom+.01)],[x-.045,Math.max(top,boltBottom+.01)]]),strapBack-gap-cheek,strapFront+gap+cheek),bolt.material,'strap-end-bolt-fork-bridge');
    b.endBolts[index].fork=[front,back,bridge];
  });
  // The strap-end pins span the fork like the other hinge pins.
  const pinLow=strapBack-gap-cheek-.006,pinHigh=strapFront+gap+cheek+.006;
  for(const pin of [b.strapPins[0],b.strapPins.at(-1)]){
    const pinMesh=pin.userData.rotor?.children[0]??pin.children[0];
    replace(pinMesh,new THREE.CylinderGeometry(pinR,pinR,pinHigh-pinLow,32));pin.position.z=(pinLow+pinHigh)/2;
  }
  // p96: the inner hinge pins end in short heads just proud of the strap
  // faces instead of long spikes (they were centred in the links above).
  {
    const head=.008;
    for(const pin of b.strapPins.slice(1,-1)){
      const pinMesh=pin.userData.rotor?.children[0]??pin.children[0];
      replace(pinMesh,new THREE.CylinderGeometry(pinR,pinR,strapFront-strapBack+2*head,32));
      pin.position.z=(strapFront+strapBack)/2;
    }
  }
  // p96: Brown's pan carries three different weights: a small block, a
  // cylinder and a bell weight with a ring-handle knob (left to right).
  if(b.scaleWeights?.length===3){
    const [block,,bell]=[...b.scaleWeights].sort((p,q)=>p.position.x-q.position.x);
    const bottom=o=>o.position.y-o.geometry.parameters.height/2;
    const blockBottom=bottom(block);replace(block,new THREE.BoxGeometry(.26,.16,.2));block.position.y=blockBottom+.08;
    block.userData.role='calibrated-scale-weight-block';
    const bellBottom=bottom(bell),profile=[[0,0],[.16,0],[.16,.025],[.13,.06],[.095,.14],[.07,.2],[.055,.225],[.05,.235],[.035,.24],[.035,.25],[.05,.26],[.05,.29],[.035,.305],[0,.31]];
    replace(bell,toCreasedNormals(new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(x,y)),64),Math.PI/6));
    bell.position.y=bellBottom;bell.userData.role='calibrated-scale-weight-bell';
  }
  // Hang the pan centred under the ring.
  root.updateMatrixWorld(true);
  const panBox=new THREE.Box3().setFromObject(b.scalePan),panDz=b.hangerEye.position.z-(panBox.min.z+panBox.max.z)/2;
  for(const o of new Set([b.scalePan,...(b.panRims??[]),...(b.scaleWeights??[])]))if(o.parent===root)o.position.z+=panDz;
  b.cableAnchor=b.hangerEye.position.clone().add(new THREE.Vector3(0,-.145,0));
  for(const cable of b.scaleCables){
    const segment=cable.children[0];
    const offset=new THREE.Vector3(0,segment.scale.y/2,0).applyQuaternion(segment.quaternion);
    const low=[segment.position.clone().add(offset),segment.position.clone().sub(offset)].sort((a,c)=>a.y-c.y)[0];
    low.z+=panDz;cable.userData.setPoints([b.cableAnchor,low]);
  }
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
