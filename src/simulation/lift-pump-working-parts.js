import * as THREE from 'three';
import {horizontalRing, horizontalTurned, horizontalPlate} from './horizontal-turbine-solids.js';
import {curvedPipeWall, mergePassageParts} from './finite-fluid-passages.js';
import {boredPlanarLinkGeometry} from './bored-planar-link.js';
import {circle, capsule, poly, plate, polygonClipping} from './finite-plate-geometry.js';
import {sectionMeshInPlace} from './cutaway-section.js';

const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };

// A finite cylinder wall with a side opening. Boundary cells receive returns
// across the wall thickness, so this is an open passage rather than hidden faces.
export function portedBarrel(inner, outer, low, high, portY, portHalfHeight, side) {
  const n = 128, levels = [low, portY-portHalfHeight, portY+portHalfHeight, high];
  const active = (i,j) => j>=0 && j<3 && !(j===1 && Math.cos((i+.5)*2*Math.PI/n)*side>.84);
  const point = (r,y,i) => new THREE.Vector3(r*Math.cos(i*2*Math.PI/n),y,r*Math.sin(i*2*Math.PI/n));
  const positions = [];
  const face = (p, normal) => {
    const cross = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]));
    if(cross.dot(normal)<0)p.reverse();
    for(const k of [0,1,2,0,2,3])positions.push(...p[k].toArray());
  };
  for(let j=0;j<3;j++)for(let i=0;i<n;i++)if(active(i,j)) {
    const a=levels[j],b=levels[j+1],theta=(i+.5)*2*Math.PI/n;
    for(const [r,sign] of [[outer,1],[inner,-1]])face([
      point(r,a,i),point(r,a,i+1),point(r,b,i+1),point(r,b,i),
    ],new THREE.Vector3(sign*Math.cos(theta),0,sign*Math.sin(theta)));
    for(const [next,y,sign] of [[j-1,a,-1],[j+1,b,1]])if(!active(i,next))face([
      point(inner,y,i),point(outer,y,i),point(outer,y,i+1),point(inner,y,i+1),
    ],new THREE.Vector3(0,sign,0));
    for(const [next,k,sign] of [[(i+n-1)%n,i,-1],[(i+1)%n,i+1,1]])if(!active(next,j))face([
      point(inner,a,k),point(outer,a,k),point(outer,b,k),point(inner,b,k),
    ],new THREE.Vector3(-sign*Math.sin(k*2*Math.PI/n),0,sign*Math.cos(k*2*Math.PI/n)));
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
}

// Brown's clack valve: a flat plate with a raised dome, hinged at one edge.
// `side` is +1 when the plate runs toward +x from its hinge. The pin, a bored
// lug on the plate and two journals standing on the seat make the hinge; the
// journals stand where the round plate has already turned away from the pin.
function addDome(disk,radius){
  const h=disk.geometry.parameters.height,profile=[[0,0],[0,radius]];
  for(let i=1;i<=24;i++){const a=i/24*Math.PI/2;profile.push([radius*Math.sin(a),i===24?0:radius*Math.cos(a)]);}
  const dome=new THREE.Mesh(horizontalTurned(profile),disk.material);
  dome.position.y=h/2-.0005;dome.userData.role=`${disk.userData.role}-raised-dome`;disk.add(dome);return dome;
}
function clackHinge({pivot,frame,side,disk,seatMaterial,pinRadius,pinLength,boss,arm,journal,journalZ}){
  const flip=side<0?Math.PI:0;
  const pin=new THREE.Mesh(new THREE.CylinderGeometry(pinRadius,pinRadius,pinLength,32),seatMaterial);
  pin.rotation.x=Math.PI/2;pin.userData.role=`${disk.userData.role}-hinge-pin`;pivot.add(pin);
  const bore=pinRadius+.003;
  const lug=new THREE.Mesh(plate(polygonClipping.difference(polygonClipping.union(poly(circle([0,0],boss,64)),
    poly([[0,-.02],[.20,-.015],[.20,arm],[0,arm]])),poly(circle([0,0],bore,64))),-.06,.06),disk.material);
  lug.rotation.y=flip;lug.userData.role=`bored-${disk.userData.role}-lug`;pivot.add(lug);
  const bearings=[-1,1].map(sign=>{
    const bearing=new THREE.Mesh(plate(polygonClipping.difference(polygonClipping.union(poly(circle([0,0],journal.radius,64)),
      capsule([0,0],journal.foot,journal.footRadius,16)),poly(circle([0,0],bore,64))),-.025,.025),seatMaterial);
    bearing.position.copy(pivot.position);bearing.position.z=sign*journalZ;bearing.rotation.y=flip;
    bearing.userData.role=`fixed-${disk.userData.role}-journal`;frame.add(bearing);return bearing;
  });
  return {pin,lug,bearings};
}

export function correctLiftPumpParts(root, id) {
  const d=root.userData,b=d.blocks,g=d.geometry,modern=id===449;
  b.base.visible=false;
  b.barrel.material.opacity=.18;
  b.lowerChamberWater.material.opacity=.26;
  if(b.spoutWater)b.spoutWater.material.opacity=.45;
  for(const o of root.children)if(o.userData.role?.includes('source-water') ||
    (!o.userData.role && o.geometry?.type==='TorusGeometry' && o.position.y < -1.8))o.visible=false;
  const shellBottom=modern?-1.37:-1.39,shellTop=modern?2.03:2.53;
  replace(b.barrel,portedBarrel(.70,.78,shellBottom,shellTop,modern?1.48:2.18,modern?.34:.30,modern?1:-1));
  b.barrel.position.y=0;
  const p=b.suctionPipe.geometry.parameters;
  replace(b.suctionPipe,horizontalTurned([
    [-p.height/2,p.radiusBottom-.045],[-p.height/2,p.radiusBottom],
    [p.height/2,p.radiusTop],[p.height/2,p.radiusTop-.045],
  ]));
  const footTop=.08-b.footValveDisk.geometry.parameters.height/2;
  replace(b.footValveSeat,horizontalRing(.32,.70,footTop-.10,footTop));
  b.footValveSeat.rotation.set(0,0,0);
  replace(b.pistonBody,horizontalRing(.24,g.pistonRadius,-g.pistonThickness/2,g.pistonThickness/2));
  replace(b.pistonValveSeat,horizontalRing(.24,.34,-.015,.015));
  b.pistonValveSeat.rotation.set(0,0,0);
  const yokeCurve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.47,.1,0),new THREE.Vector3(-.47,.34,0),
    new THREE.Vector3(-.35,.54,0),new THREE.Vector3(0,.62,0),
    new THREE.Vector3(.35,.54,0),new THREE.Vector3(.47,.34,0),new THREE.Vector3(.47,.1,0),
  ]);
  const yoke=new THREE.Mesh(new THREE.TubeGeometry(yokeCurve,64,.055,10,false),b.pumpRod.material);
  yoke.userData.role='bucket-yoke-clearing-moving-check';b.piston.add(yoke);b.yoke=yoke;
  if(modern) {
    replace(b.topCover,horizontalRing(.071,.77,-.07,.07));
    const [body,bore]=b.stuffingBox.children;
    replace(body,horizontalTurned([[-.21,.071],[-.21,.33],[.21,.27],[.21,.071]]));
    replace(bore,horizontalRing(.071,.185,-.045,.045));bore.rotation.set(0,0,0);
    // The rising main opens into the enlarged flap chamber instead of running
    // an unbroken narrow pipe through the moving flap.
    const lower=new THREE.CatmullRomCurve3([
      new THREE.Vector3(.62,1.48,0),new THREE.Vector3(1.12,1.54,0),
      new THREE.Vector3(1.45,1.89,0),new THREE.Vector3(1.45,2.25,0),
    ]);
    const upper=new THREE.LineCurve3(new THREE.Vector3(1.45,3.15,0),new THREE.Vector3(1.45,3.70,0));
    replace(b.deliveryPipe,mergePassageParts([curvedPipeWall(lower,.24,.30,64),curvedPipeWall(upper,.24,.30,12)]));
    replace(b.deliveryBell,horizontalTurned([
      [-.48,.24],[-.48,.30],[-.34,.48],[.30,.48],[.42,.30],[.42,.24],
      [.30,.425],[-.34,.425],
    ]));b.deliveryBell.position.set(1.45,g.deliveryFlapY,0);
    const seatOutline=polygonClipping.difference(poly(circle([0,0],.425,128)),poly(circle([0,0],.21,128)),
      poly([[-.397,-.071],[-.245,-.071],[-.245,.071],[-.397,.071]]));
    replace(b.deliveryFlapSeat,horizontalPlate(seatOutline,-.055,0));
    b.deliveryFlapSeat.rotation.set(0,0,0);
    b.deliveryFlapPivot.position.set(1.13,b.deliveryFlapSeat.position.y+.0375,0);
    // Disk closure covers a circular seat; a bored hinge lug shares its pivot.
    replace(b.deliveryFlap,new THREE.CylinderGeometry(.255,.255,.075,64));
    b.deliveryFlap.position.x=.32;
    const hinge=b.deliveryFlapPivot.children[1];
    hinge.geometry.dispose();hinge.geometry=new THREE.CylinderGeometry(.035,.035,.22,32);
    const lugOutline=polygonClipping.difference(polygonClipping.union(poly(circle([0,0],.065,64)),
      poly([[0,-.02],[.20,-.015],[.20,.07],[0,.04]])),poly(circle([0,0],.038,64)));
    const lug=new THREE.Mesh(plate(lugOutline,-.06,.06),b.deliveryFlap.material);
    lug.userData.role='bored-outlet-flap-lug';
    b.deliveryFlapPivot.add(lug);b.flapHinge=hinge;b.flapLug=lug;
    const bracketOutline=polygonClipping.difference(polygonClipping.union(
      poly(circle([0,0],.07,64)),capsule([0,0],[-.14,-.02],.035,16)),poly(circle([0,0],.038,64)));
    b.flapBearings=[-1,1].map(sign=>{
      const bearing=new THREE.Mesh(plate(bracketOutline,-.025,.025),b.footValveSeat.material);
      bearing.position.copy(b.deliveryFlapPivot.position);bearing.position.z=sign*.10;
      bearing.userData.role='fixed-outlet-flap-journal';root.add(bearing);return bearing;
    });
    // Old ornamental end rims overlap the newly widened chamber.
    for(const o of root.children)if(o.geometry?.type==='TorusGeometry'&&o.position.x===1.45)o.visible=false;
  } else {
    b.pumpRod.visible=false; // The long link meets the yoke crown directly.
    // Pass 70: Brown's wider pump head. The barrel rises to a shoulder just
    // above the bucket's highest stroke, then the head (1.43 times the bore)
    // carries the side spout and ends in an open top with a flange. The water
    // above the bucket continues into the head, which stands full to the
    // spout level.
    const shoulderY=1.97,headTop=2.75,headInner=1.0,headOuter=1.08;
    replace(b.barrel,mergePassageParts([
      // Pieces overlap slightly rather than share faces, so the section's
      // welded cut stays consistently wound.
      horizontalRing(.70,.78,shellBottom,shoulderY-.075),
      horizontalRing(.70,headOuter,shoulderY-.08,shoulderY),
      portedBarrel(headInner,headOuter,shoulderY-.005,headTop-.075,2.20,.23,-1),
      horizontalRing(headInner,1.24,headTop-.08,headTop),
    ]));
    d.pumpHead={shoulderY,headTop,headInner,headOuter};
    const headWater=new THREE.Mesh(new THREE.CylinderGeometry(headInner-.05,headInner-.05,g.spoutWaterLevelY-shoulderY,96).translate(0,(g.spoutWaterLevelY+shoulderY)/2,0),b.upperChamberWater.material);
    headWater.userData.role='water-standing-in-pump-head-at-spout-level';root.add(headWater);b.headWater=headWater;
    const linkGeometry=boredPlanarLinkGeometry({length:g.connectingRodLength,width:.10,eyeRadius:.15,boreRadius:.075,depth:.08});
    linkGeometry.translate(-g.connectingRodLength/2,0,0).rotateZ(Math.PI/2).scale(1,1/g.connectingRodLength,1);
    replace(b.connectingRod,linkGeometry);
    const pivotPin=b.lever.children[1],rodPin=b.lever.children[2];
    replace(pivotPin,new THREE.CylinderGeometry(.19,.19,.75,48));
    replace(rodPin,new THREE.CylinderGeometry(.07/.70,.07/.70,.75/.70,40));
    const jointPin=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.65,40),b.pumpRod.material);
    jointPin.rotation.x=Math.PI/2;jointPin.position.set(0,.62,.1);b.piston.add(jointPin);b.jointPin=jointPin;
    // The lever bracket rises from the head's top flange to the pivot.
    const supportProfile=polygonClipping.difference(poly([[.97,2.75],[1.22,2.75],[1.12,3.10],[1.08,3.40],[.95,3.46],[.69,3.46],[.56,3.30],[.56,3.08],[.72,2.93],[.90,2.85]]),poly(circle([g.leverPivot.x,g.leverPivot.y],.195,96)));
    const support=new THREE.Mesh(plate(supportProfile,-.30,-.20),b.base.material);
    support.userData.role='fixed-bored-lever-bracket';root.add(support);b.leverSupport=support;
    replace(b.spout,curvedPipeWall(b.spout.geometry.parameters.path,.19,.25,72));
  }
  // Pass 70/78: the lower check is Brown's hinged clack flap (449 hinged at
  // its left edge, 448 at its right, where Brown draws its knuckle). It
  // closes flat on the seat ring (0.08 lap over the 0.32 bore) and turns on a
  // pin carried by two journals standing on the seat. The hinge sits inside
  // the suction pipe's rim, so its boss stays clear of the pipe top.
  {const pivot=b.footFlapPivot,side=pivot.position.x<0?1:-1;
   const hinge=clackHinge({pivot,frame:root,side,disk:b.footValveDisk,seatMaterial:b.footValveSeat.material,
     pinRadius:.025,pinLength:.68,boss:.042,arm:.04,journal:{radius:.05,foot:[-.12,-.02],footRadius:.03},journalZ:.31});
   b.footFlapHinge=hinge.pin;b.footFlapLug=hinge.lug;b.footFlapBearings=hinge.bearings;
   hinge.pin.userData.role='lower-flap-hinge-pin';hinge.lug.userData.role='bored-lower-flap-lug';
   for(const o of hinge.bearings)o.userData.role='fixed-lower-flap-journal';
   // A shallow recess in the seat ring's top clears the lug's boss; the ring
   // stays whole beneath it and round the bore, so nothing bypasses the flap.
   const top=.08-b.footValveDisk.geometry.parameters.height/2,x=pivot.position.x,ring=polygonClipping.difference(poly(circle([0,0],.70,128)),poly(circle([0,0],.32,128)));
   const [x0,x1]=side>0?[x-.08,x+.075]:[x-.075,x+.08];
   replace(b.footValveSeat,mergePassageParts([horizontalPlate(ring,top-.10,top-.031),horizontalPlate(polygonClipping.difference(ring,poly([[x0,-.071],[x1,-.071],[x1,.071],[x0,.071]])),top-.030,top)]));}
  // The bucket check is the same clack flap, hinged at its left edge on
  // journals standing on the bucket's seat ring, so it is held as it opens.
  {const pivot=b.pistonFlapPivot;
   const hinge=clackHinge({pivot,frame:b.piston,side:1,disk:b.pistonValveDisk,seatMaterial:b.pistonValveSeat.material,
     pinRadius:.02,pinLength:.50,boss:.036,arm:.035,journal:{radius:.045,foot:[-.07,-.03],footRadius:.025},journalZ:.22});
   b.pistonFlapHinge=hinge.pin;b.pistonFlapLug=hinge.lug;b.pistonFlapBearings=hinge.bearings;}
  b.valveDomes=[addDome(b.footValveDisk,.12),addDome(b.pistonValveDisk,.10)];
  if(b.deliveryFlap)b.valveDomes.push(addDome(b.deliveryFlap,.09));
  // Brown's section as ONE clean cutaway on the plane facing the camera:
  // opaque walls with plain cut faces. The bucket, its packing, the checks
  // and their seats lie inside the sectioned barrel, so they are cut on the
  // same plane (they only translate in y or turn about z, so the plane stays
  // put); rods, pins and the yoke stay whole. The water is cut on the same
  // plane so none stands in front of the walls. 448's side spout lies
  // outside the barrel and stays a whole pipe (a cut half-pipe read as a
  // trough from the side).
  const shells=[b.barrel,b.suctionPipe,modern?b.spout:null,b.deliveryPipe,b.deliveryBell,b.topCover,b.stuffingBox?.children[0],
    b.pistonBody,b.pistonValveSeat,b.pistonValveDisk,b.footValveSeat,b.footValveDisk,
    b.deliveryFlapSeat,b.deliveryFlap,b.flapHinge,b.flapLug,b.footFlapHinge,b.footFlapLug,
    b.pistonFlapHinge,b.pistonFlapLug,...b.valveDomes].filter(Boolean);
  if(b.flapBearings)b.flapBearings[1].visible=false; // its cut-away half would float in front of the section
  if(b.footFlapBearings)b.footFlapBearings[1].visible=false;
  if(b.pistonFlapBearings)b.pistonFlapBearings[1].visible=false;
  const waters=[b.suctionWater,b.lowerChamberWater,b.upperChamberWater,b.headWater,b.spoutWater,b.deliveryWater].filter(Boolean);
  for(const mesh of shells)sectionMeshInPlace(mesh,root);
  if(!modern){b.spout.material=b.barrel.material[0];b.spout.castShadow=b.spout.receiveShadow=true;}
  for(const mesh of waters){const m=mesh.material;sectionMeshInPlace(mesh,root);mesh.material=[m,m];}
  for(const rails of [b.barrelRearFrame,b.barrelRails])if(rails)rails.visible=false;
  d.updateSolids=state=>{if(!modern){b.connectingRod.position.z=.27;
    // The bucket water stops where the head water (with its neck) begins.
    const bottom=state.pistonTopY+.04,top=d.pumpHead.shoulderY;b.upperChamberWater.position.y=(bottom+top)/2;b.upperChamberWater.scale.y=Math.max(.001,top-bottom);b.upperChamberWater.visible=top>bottom;}};
  d.animationTiming.targetCycleDuration=g.cycleDuration;
  d.minimumDisplayCycleSeconds=g.cycleDuration;
  d.hideGround=true;
  d.solidReview={qualification:'Finite bucket passages, valve seats, yoke clearance, rod bores and side-port walls. Check lifts and water displacement remain prescribed; priming, sealing, pressure and passive flap dynamics are not solved.'};
  root.traverse(o=>{for(const m of o.material?[].concat(o.material):[])m.fog=false;});
  const bounds=new THREE.Box3(),point=new THREE.Vector3();
  for(let i=0;i<=64;i++){
    d.update(g.cycleDuration*i/64);root.updateMatrixWorld(true);
    root.traverseVisible(o=>{const p=o.geometry?.attributes.position;if(p)for(let j=0;j<p.count;j++)bounds.expandByPoint(point.fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld));});
  }
  d.cameraFitBounds=bounds.expandByScalar(.10);d.cameraDirection=new THREE.Vector3(.35,.45,15);d.cameraDistanceScale=1.07;d.cameraFov=12;
}
