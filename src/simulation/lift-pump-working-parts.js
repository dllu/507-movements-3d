import * as THREE from 'three';
import {horizontalRing, horizontalTurned, horizontalPlate} from './horizontal-turbine-solids.js';
import {curvedPipeWall, mergePassageParts} from './finite-fluid-passages.js';
import {boredPlanarLinkGeometry} from './bored-planar-link.js';
import {circle, capsule, poly, plate, polygonClipping, turned} from './finite-plate-geometry.js';
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

// Pass 80: a finite cylinder wall pierced by a ROUND side port for a pipe
// that runs through the wall (its axis along x, on the `side` of the
// barrel). The hole's staircase edge lies inside the pipe wall (hole radius
// between the pipe's bore and outside radii), so the pipe seals the port
// with no open gap round it.
export function roundPortedBarrel(inner, outer, low, high, portY, holeRadius, side, n = 192) {
  const levels = [low];
  const y0 = portY - holeRadius - .03, y1 = portY + holeRadius + .03, rows = Math.ceil((y1 - y0) / .0125);
  for (let k = 0; k <= rows; k++) levels.push(y0 + (y1 - y0) * k / rows);
  levels.push(high);
  const rows2 = levels.length - 1, mid = (inner + outer) / 2;
  const active = (i,j) => {
    if (j < 0 || j >= rows2) return false;
    const theta = (((i % n) + n) % n + .5) * 2 * Math.PI / n, y = (levels[j] + levels[j + 1]) / 2;
    return !(Math.cos(theta) * side > 0 && (mid * Math.sin(theta)) ** 2 + (y - portY) ** 2 < holeRadius ** 2);
  };
  const point = (r,y,i) => new THREE.Vector3(r*Math.cos(i*2*Math.PI/n),y,r*Math.sin(i*2*Math.PI/n));
  const positions = [];
  const face = (p, normal) => {
    const cross = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]));
    if(cross.dot(normal)<0)p.reverse();
    for(const k of [0,1,2,0,2,3])positions.push(...p[k].toArray());
  };
  for(let j=0;j<rows2;j++)for(let i=0;i<n;i++)if(active(i,j)) {
    const a=levels[j],b=levels[j+1],theta=(i+.5)*2*Math.PI/n;
    for(const [r,sign] of [[outer,1],[inner,-1]])face([
      point(r,a,i),point(r,a,i+1),point(r,b,i+1),point(r,b,i),
    ],new THREE.Vector3(sign*Math.cos(theta),0,sign*Math.sin(theta)));
    for(const [next,y,sign] of [[j-1,a,-1],[j+1,b,1]])if(!active(i,next))face([
      point(inner,y,i),point(outer,y,i),point(outer,y,i+1),point(inner,y,i+1),
    ],new THREE.Vector3(0,sign,0));
    for(const [next,k,sign] of [[i-1,i,-1],[i+1,i+1,1]])if(!active(next,j))face([
      point(inner,a,k),point(outer,a,k),point(outer,b,k),point(inner,b,k),
    ],new THREE.Vector3(-sign*Math.sin(k*2*Math.PI/n),0,sign*Math.cos(k*2*Math.PI/n)));
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
}

// Brown's clack valve: a flat plate with a raised dome, hinged at one edge.
// `side` is +1 when the plate runs toward +x from its hinge. The pin, a bored
// lug on the plate and two journals standing on the seat make the hinge; the
// journals stand where the round plate has already turned away from the pin.
export function addDome(disk,radius){
  const h=disk.geometry.parameters.height,profile=[[0,0],[0,radius]];
  for(let i=1;i<=24;i++){const a=i/24*Math.PI/2;profile.push([radius*Math.sin(a),i===24?0:radius*Math.cos(a)]);}
  const dome=new THREE.Mesh(horizontalTurned(profile),disk.material);
  dome.position.y=h/2-.0005;dome.userData.role=`${disk.userData.role}-raised-dome`;disk.add(dome);return dome;
}
export function clackHinge({pivot,frame,side,disk,seatMaterial,pinRadius,pinLength,boss,arm,journal,journalZ}){
  const flip=side<0?Math.PI:0;
  // Pass 88: where the pin would pass through the flap's rim (448/449), the
  // rim is trimmed flat just clear of the pin's bore; the lug alone carries
  // the flap round the pin, and no pin face lies in the flap's section.
  {const par=disk.geometry.parameters,r=par.radiusTop,h=par.height,px=-disk.position.x,edge=Math.abs(px)-(pinRadius+.003);
   if(edge<r){const x0=Math.sign(px)*edge,x1=Math.sign(px)*(r+.1);
     const g=horizontalPlate(polygonClipping.difference(poly(circle([0,0],r,128)),poly([[x0,-r-.1],[x1,-r-.1],[x1,r+.1],[x0,r+.1]])),-h/2,h/2);
     g.parameters={...par};disk.geometry.dispose();disk.geometry=g;}}
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

// Pass 88: waters stand this far off the section plane and the faces they
// would otherwise share with a solid.
const WATER_GAP=.006;

// 448's water above the bucket and in the pump head as one closed body,
// already sectioned: the back half of the stepped surface of revolution
// (barrel radius from `bottom` to the step, head radius from the step to
// the spout level) and its cut face, set back WATER_GAP behind the plane.
// The vertex layout is independent of `bottom`, so updates copy positions.
function bucketAndHeadWater({barrelRadius:r1,headRadius:r2,step,top},bottom,segments=64){
  const positions=[],normals=[],profile=[[bottom,0],[bottom,r1],[step,r1],[step,r2],[top,r2],[top,0]];
  const faceNormal=[[0,-1],null,[0,-1],null,[0,1]];
  for(let i=0;i<profile.length-1;i++){
    const [y0,a0]=profile[i],[y1,a1]=profile[i+1];
    for(let k=0;k<segments;k++){
      const t0=Math.PI*(1+k/segments),t1=Math.PI*(1+(k+1)/segments);
      const v=(t,y,r)=>[r*Math.cos(t),y,r*Math.sin(t)-WATER_GAP];
      const n=t=>faceNormal[i]?[0,faceNormal[i][1],0]:[Math.cos(t),0,Math.sin(t)];
      for(const [t,y,r] of [[t0,y0,a0],[t1,y0,a0],[t1,y1,a1],[t0,y0,a0],[t1,y1,a1],[t0,y1,a1]]){positions.push(...v(t,y,r));normals.push(...n(t));}
    }
  }
  const cut=[[-r1,bottom],[r1,bottom],[r1,step],[-r1,step],[-r2,step],[r2,step],[r2,top],[-r2,top]];
  for(const [a,b,c] of [[0,1,2],[0,2,3],[4,5,6],[4,6,7]])for(const q of [a,b,c]){positions.push(cut[q][0],cut[q][1],-WATER_GAP);normals.push(0,0,1);}
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  return geometry;
}

// 448's hand lever in its own plane: a band of half-width `width(s)` along
// the old tube centreline (sampled in x, y), flaring (smoothstep over
// `flare`) into the rod eye, the pivot eye and the end ring, with the bores
// and the ring's hole cut out; extruded ±depth.
function flatLeverGeometry(curve,{depth,rodEye,pivotEye,ringOuter=.23,ringInner=.13,bar=.095,tip=.07,flare=.42}){
  const n=160,points=curve.getSpacedPoints(n),end=points[n];
  const eyes=[{x:rodEye.x,y:0,r:rodEye.radius},{x:0,y:0,r:pivotEye.radius},{x:end.x,y:end.y,r:.13}];
  const smooth=t=>{t=Math.min(1,Math.max(0,t));return t*t*(3-2*t);};
  const halfWidth=(point,u)=>{let w=bar+(tip-bar)*smooth((point.x-0.3)/(end.x-0.3));
    for(const e of eyes){const d=Math.hypot(point.x-e.x,point.y-e.y);w=Math.max(w,w+(e.r*.96-w)*(1-smooth(d/flare)));}return w;};
  const left=[],right=[];
  for(let i=0;i<=n;i+=1){const p=points[i],t=curve.getTangentAt(i/n),nx=-t.y,ny=t.x,len=Math.hypot(nx,ny),w=halfWidth(p,i/n);
    left.push([p.x+nx/len*w,p.y+ny/len*w]);right.push([p.x-nx/len*w,p.y-ny/len*w]);}
  const band=poly([...left,...right.reverse()]);
  const outline=polygonClipping.difference(
    polygonClipping.union(band,poly(circle([rodEye.x,0],rodEye.radius,96)),poly(circle([0,0],pivotEye.radius,96)),poly(circle([end.x,end.y],ringOuter,96))),
    poly(circle([rodEye.x,0],rodEye.bore,64)),poly(circle([0,0],pivotEye.bore,64)),poly(circle([end.x,end.y],ringInner,64)));
  return plate(outline,-depth,depth);
}

export function correctLiftPumpParts(root, id) {
  const d=root.userData,b=d.blocks,g=d.geometry,modern=id===449;
  b.base.visible=false;
  b.barrel.material.opacity=.18;
  b.lowerChamberWater.material.opacity=.26;
  if(b.spoutWater)b.spoutWater.material.opacity=.45;
  for(const o of root.children)if(o.userData.role?.includes('source-water') ||
    (!o.userData.role && o.geometry?.type==='TorusGeometry' && o.position.y < -1.8))o.visible=false;
  // Pass 88: 449's barrel stops under the enclosed head (0.07 below its
  // centre) instead of running up inside it.
  const shellBottom=modern?-1.37:-1.39,shellTop=modern?b.topCover.position.y-.07:2.53;
  // Pass 80: 449's rising main passes through a round port that it fills
  // (0.24 bore, 0.30 outside), where a larger square port left a gap round it.
  replace(b.barrel,modern?roundPortedBarrel(.70,.78,shellBottom,shellTop,1.487,.27,1)
    :portedBarrel(.70,.78,shellBottom,shellTop,2.18,.30,-1));
  b.barrel.position.y=0;
  const p=b.suctionPipe.geometry.parameters;
  const footTop=.08-b.footValveDisk.geometry.parameters.height/2;
  // Pass 88: the pipe ends under the seat ring (0.10 deep) instead of
  // running up inside it, so their sections do not overlap.
  const pipeTop=Math.min(p.height/2,b.footValveSeat.position.y+footTop-.10-b.suctionPipe.position.y);
  const pipeTopRadius=p.radiusBottom+(p.radiusTop-p.radiusBottom)*(pipeTop+p.height/2)/p.height;
  replace(b.suctionPipe,horizontalTurned([
    [-p.height/2,p.radiusBottom-.045],[-p.height/2,p.radiusBottom],
    [pipeTop,pipeTopRadius],[pipeTop,pipeTopRadius-.045],
  ]));
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
    const [body,bore]=b.stuffingBox.children;
    replace(body,horizontalTurned([[-.21,.071],[-.21,.33],[.21,.27],[.21,.071]]));
    replace(bore,horizontalRing(.071,.185,-.045,.045));bore.rotation.set(0,0,0);
    // Pass 88: the head covers the barrel's full width and is bored to the
    // stuffing box's taper where the box passes through it; the gland ring
    // sits on the box's top face instead of sinking into it.
    const bodyBottom=b.stuffingBox.position.y+body.position.y-.21-b.topCover.position.y;
    const bodyRadius=y=>.33-.06*(y-bodyBottom)/.42;
    replace(b.topCover,horizontalTurned([[-.07,.071],[-.07,.78],[.07,.78],[.07,bodyRadius(.07)],[bodyBottom,.33],[bodyBottom,.071]]));
    bore.position.y=body.position.y+.21+.045;
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
    // Pass 88: the water above the bucket and the head water are one body:
    // one sectioned surface from the bucket up the barrel, out over a step
    // standing WATER_GAP above the shoulder, to the spout level (see
    // bucketAndHeadWater), rebuilt as the bucket moves.
    d.pumpHeadWater={barrelRadius:g.barrelWaterRadius,headRadius:headInner-.05,step:shoulderY+WATER_GAP,top:g.spoutWaterLevelY};
    const linkGeometry=boredPlanarLinkGeometry({length:g.connectingRodLength,width:.10,eyeRadius:.15,boreRadius:.075,depth:.08});
    linkGeometry.translate(-g.connectingRodLength/2,0,0).rotateZ(Math.PI/2).scale(1,1/g.connectingRodLength,1);
    replace(b.connectingRod,linkGeometry);
    // Pass 96: Brown draws each joint as a pin in a round eye. The lever has
    // a bored eye (0.26 deep, just deeper than the 0.24 lever rod) at its
    // pivot and at its rod end; the link lies against the
    // lever's front face (LINK_Z) and the bracket against its back face, and
    // each pin is only as long as the parts it joins, with a small head just
    // clear of each outer face (no rod standing proud on one side).
    const LEVER_HALF=.13,LINK_LOW=.135,LINK_HIGH=.215,BRACKET_LOW=-.215,BRACKET_HIGH=-.135,CLEAR=.003,HEAD=.02;
    const pinGeometry=(radius,headRadius,low,high)=>turned([[low-CLEAR-HEAD,0],[low-CLEAR-HEAD,headRadius],[low-CLEAR,headRadius],[low-CLEAR,radius],
      [high+CLEAR,radius],[high+CLEAR,headRadius],[high+CLEAR+HEAD,headRadius],[high+CLEAR+HEAD,0]],96);
    const pivotPin=b.lever.children[1],rodPin=b.lever.children[2];
    replace(pivotPin,pinGeometry(.09,.11,BRACKET_LOW,LEVER_HALF));
    replace(rodPin,pinGeometry(.07,.085,-LEVER_HALF,LINK_HIGH));
    for(const pin of [pivotPin,rodPin]){pin.rotation.set(0,0,0);pin.scale.setScalar(1);}
    // Pass 101: Brown's lever is one flat curved bar, not a round tube with
    // drums across it and a ball on the end: one extrusion LEVER_HALF deep
    // along the old centreline, flaring smoothly into round eyes concentric
    // with the pivot and rod pins and ending in a ring, as he draws it.
    const arm=b.lever.children[0];
    replace(arm,flatLeverGeometry(arm.geometry.parameters.path,{
      depth:LEVER_HALF,rodEye:{x:rodPin.position.x,radius:.18,bore:.074},pivotEye:{radius:.20,bore:.095}}));
    arm.userData.role='hand-lever-flat-curved-bar-with-eyes-and-ring-end';
    b.leverEyes=[arm];
    b.lever.children[3].visible=false;
    const jointPin=new THREE.Mesh(pinGeometry(.07,.085,-.055,LINK_HIGH),b.pumpRod.material);
    jointPin.position.set(0,.62,0);b.piston.add(jointPin);b.jointPin=jointPin;
    d.linkZ=(LINK_LOW+LINK_HIGH)/2;
    // The lever bracket rises from the head's top flange to the pivot.
    // Pass 101: one casting with the head's rim: a round boss concentric
    // with the pivot, concave flanks sweeping down into the flange, and a
    // tapering rib running on down the head's outer wall (it used to be an
    // angular block perched on the flange's edge).
    const bezier=(a,c,e,n=24)=>Array.from({length:n+1},(_,i)=>{const t=i/n;return[(1-t)**2*a[0]+2*(1-t)*t*c[0]+t*t*e[0],(1-t)**2*a[1]+2*(1-t)*t*c[1]+t*t*e[1]];});
    const px=g.leverPivot.x,py=g.leverPivot.y;
    const web=poly([...bezier([px-.20,py-.12],[px+.12,py-.26],[.99,2.70]),[.99,2.30],
      ...bezier([1.03,2.30],[1.06,2.62],[1.22,2.70]),...bezier([1.22,2.72],[1.18,2.94],[px+.21,py-.10])]);
    const supportProfile=polygonClipping.difference(polygonClipping.union(poly(circle([px,py],.25,96)),web),poly(circle([px,py],.095,96)));
    const support=new THREE.Mesh(plate(supportProfile,BRACKET_LOW,BRACKET_HIGH),b.base.material);
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
  const waters=[b.suctionWater,b.lowerChamberWater,modern?b.upperChamberWater:null,b.spoutWater,b.deliveryWater].filter(Boolean);
  for(const mesh of shells)sectionMeshInPlace(mesh,root);
  if(!modern){b.spout.material=b.barrel.material[0];b.spout.castShadow=b.spout.receiveShadow=true;}
  // Pass 88: each water section stands WATER_GAP behind the plane, so its
  // cut face does not lie on the cut faces of the checks, seats and pipes
  // inside it (they flickered through it).
  for(const mesh of waters){const m=mesh.material;sectionMeshInPlace(mesh,root);mesh.geometry.translate(0,0,-WATER_GAP);mesh.material=[m,m];}
  if(!modern){
    const w=b.upperChamberWater,h=d.pumpHeadWater;
    w.geometry.dispose();w.geometry=bucketAndHeadWater(h,h.step-.5);w.position.set(0,0,0);w.scale.set(1,1,1);
  }
  for(const rails of [b.barrelRearFrame,b.barrelRails])if(rails)rails.visible=false;
  d.updateSolids=state=>{if(!modern){b.connectingRod.position.z=d.linkZ;
    // The bucket water stops where the head water (with its neck) begins.
    const h=d.pumpHeadWater,w=b.upperChamberWater,next=bucketAndHeadWater(h,Math.min(state.pistonTopY+.04,h.step-.001));
    w.geometry.attributes.position.array.set(next.attributes.position.array);w.geometry.attributes.position.needsUpdate=true;
    w.geometry.computeBoundingBox();w.geometry.computeBoundingSphere();next.dispose();w.position.set(0,0,0);w.scale.set(1,1,1);w.visible=true;}};
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
