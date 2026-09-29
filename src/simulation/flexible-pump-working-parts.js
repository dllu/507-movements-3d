import * as THREE from 'three';
import {horizontalRing, horizontalTurned, horizontalPlate} from './horizontal-turbine-solids.js';
import {curvedPipeWall, mergePassageParts} from './finite-fluid-passages.js';
import {boredPlanarLinkGeometry} from './bored-planar-link.js';
import {circle, poly, plate, polygonClipping} from './finite-plate-geometry.js';
import {creaseIndexedNormals, creaseLatheNormals} from './crease-normals.js';
import {saddleEndPipeWall} from './force-pump-working-parts.js';

const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};

// Layered finite wall; each rectangular side port has returns across the wall thickness.
// Pass 86: a port may instead be round ({side, y, z, radius}): a hole of that
// radius about a horizontal axis along x at (y, z), fitted to the pipe that
// enters it. The wall is cut by the square round it and the square is filled
// by a patch of the same wall, bored for the pipe.
export function pumpPortedWall(inner,outer,low,high,ports=[]) {
  const patches=[];
  ports=ports.map(p=>{
    if(!p.radius)return p;
    const half=p.radius+(p.margin??.06);
    patches.push(roundPortPatch(inner,outer,p.side,p.y,p.z??0,p.radius,half));
    return {side:p.side,y:p.y,z:p.z??0,halfHeight:half,halfWidth:half};
  });
  const levels=[low,high,...ports.flatMap(p=>[Math.max(low,p.y-p.halfHeight),Math.min(high,p.y+p.halfHeight)])].sort((a,b)=>a-b);
  const annulus=polygonClipping.difference(poly(circle([0,0],outer,128)),poly(circle([0,0],inner,128))),parts=[];
  for(let i=0;i<levels.length-1;i++){
    const a=levels[i],b=levels[i+1];if(b-a<1e-8)continue;
    let section=annulus;
    for(const p of ports)if((a+b)/2>p.y-p.halfHeight&&(a+b)/2<p.y+p.halfHeight){
      const x0=p.side>0?0:-outer-.05,x1=p.side>0?outer+.05:0;
      // horizontalPlate maps the outline's second coordinate to world -z.
      const v=-(p.z??0);
      section=polygonClipping.difference(section,poly([[x0,v-p.halfWidth],[x1,v-p.halfWidth],[x1,v+p.halfWidth],[x0,v+p.halfWidth]]));
    }
    parts.push(horizontalPlate(section,a,b));
  }
  return mergePassageParts([...parts,...patches]);
}

// The square (half side `half`, centred at y, z) of a cylindrical wall
// (radii inner..outer about the y axis, on the side x·side > 0), bored with
// a round hole of `radius` along x. Built on a polar grid round the hole, so
// the bore is truly round and the faces follow the wall's curvature.
function roundPortPatch(inner,outer,side,yc,zc,radius,half,sectors=64,rings=6){
  const at=(t,z,y)=>new THREE.Vector3(side*Math.sqrt(t*t-z*z),y,z);
  const grid=(t)=>Array.from({length:rings+1},(_,j)=>Array.from({length:sectors},(_,k)=>{
    const a=2*Math.PI*k/sectors,c=Math.cos(a),s=Math.sin(a),edge=half/Math.max(Math.abs(c),Math.abs(s)),u=j/rings;
    const r=radius+(edge-radius)*u;return at(t,zc+r*c,yc+r*s);
  }));
  const G=[grid(outer),grid(inner)],positions=[];
  const tri=(a,b,c,out)=>{const n=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a));
    if(n.dot(out)<0)[b,c]=[c,b];positions.push(...a.toArray(),...b.toArray(),...c.toArray());};
  const quad=(a,b,c,d,out)=>{tri(a,b,c,out);tri(a,c,d,out);};
  for(let j=0;j<rings;j++)for(let k=0;k<sectors;k++){
    const k1=(k+1)%sectors;
    for(const [g,sign] of [[G[0],1],[G[1],-1]]){
      const a=g[j][k],out=new THREE.Vector3(a.x,0,a.z).normalize().multiplyScalar(sign);
      quad(a,g[j][k1],g[j+1][k1],g[j+1][k],out);
    }
  }
  for(let k=0;k<sectors;k++){
    const k1=(k+1)%sectors;
    // Bore (facing the hole's axis) and the square's edge (facing out of it).
    for(const [j,sign] of [[0,-1],[rings,1]]){
      const a=G[0][j][k],out=new THREE.Vector3(0,a.y-yc,a.z-zc).normalize().multiplyScalar(sign);
      quad(a,G[0][j][k1],G[1][j][k1],G[1][j][k],out);
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
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

// Pass 109: a pin along z from `back` to `front` (world z of the carrying
// part), with a short head of radius r+head at the front so the link it
// retains shows a deliberate end instead of a bare stub. Built along y for a
// mesh rotated x = pi/2 about z = 0 (local y maps to world z).
function headedPinGeometry(radius,back,front,head=.035,headLength=.025) {
  const profile=[[0,back],[radius,back],[radius,front-headLength],[radius+head,front-headLength],[radius+head,front],[0,front]].map(([x,y])=>new THREE.Vector2(x,y));
  return creaseLatheNormals(new THREE.LatheGeometry(profile,48));
}

// Pass 109: the lug on the moving plate is cast with the plate (its colour),
// its eye the same radius as the link's eye and standing 0.01 behind it, and
// the pin runs through the lug's full depth (flush + 0.01 behind it) and the
// link, ending in a small head in front. The link and lug read as one clean
// joint instead of a stack of black discs with an empty eye.
function plateJoint(plateMesh,link,pinRadius=.13,height=.20,base=0,eyeRadius=.199) {
  const lugBack=.05,linkBack=.29,lugFront=linkBack-.01,linkFront=.39;
  const outline=polygonClipping.difference(polygonClipping.union(poly([[-.10,base],[.10,base],[.10,height],[-.10,height]]),poly(circle([0,height],eyeRadius,64))),poly(circle([0,height],pinRadius+.004,64)));
  const lugMaterial=plateMesh.material??plateMesh.children.find(o=>o.isMesh)?.material;
  const mount=new THREE.Mesh(plate(outline,lugBack,lugFront),lugMaterial);
  mount.position.set(0,0,0);mount.userData.role='moving-plate-link-clevis';plateMesh.add(mount);
  const pin=new THREE.Mesh(headedPinGeometry(pinRadius,lugBack-.01,linkFront+.03),link.material);
  pin.rotation.x=Math.PI/2;pin.position.set(0,height,0);pin.userData.role='moving-plate-link-pin';plateMesh.add(pin);
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
    for(const [rod,top]of[[b.leftConnectingRod,b.leftTopPlate],[b.rightConnectingRod,b.rightTopPlate]]){normalizedLink(rod,g.connectingRodLength);plateJoint(top,rod,.13,g.linkEyeHeight);}
    // Pass 109: each beam pin spans the beam (0.38) and its link (z 0.29-0.39)
    // only: 0.02 proud of the beam's back face, headed in front of the link.
    for(const mesh of lever.children)if(mesh.geometry?.type==='CylinderGeometry'&&Math.abs(mesh.position.x)===g.beamPinHalfSpan){replace(mesh,headedPinGeometry(.13,-.21,.42));mesh.position.z=0;}
    // Pass 70: the chest, channel, riser, post and flap checks are built in
    // authored-lantern-bellows-pumps.js to Brown's section.
    d.updateSolids=()=>{b.leftConnectingRod.position.z=.34;b.rightConnectingRod.position.z=.34;};
  }else{
    const curve=body.geometry.parameters.path,left=[],right=[];
    // Pass 101: Brown's lever tapers to a plain rounded end at the grip
    // (it carried a black cylinder set crosswise, a T-grip he does not draw).
    const tipU=.30,tipWidth=.065,taper=u=>u>=tipU?.115:tipWidth+(.115-tipWidth)*(u/tipU)**2*(3-2*u/tipU);
    for(let i=0;i<=64;i++){const u=i/64,w=taper(u),p=curve.getPoint(u),t=curve.getTangent(u).normalize();left.push([p.x-t.y*w,p.y+t.x*w]);right.push([p.x+t.y*w,p.y-t.x*w]);}
    const tip=curve.getPoint(0);
    planarLever(body,polygonClipping.union(poly([...left,...right.reverse()]),poly(circle([tip.x,tip.y],tipWidth,48))),[{x:0,y:0,inner:.214,outer:.30}],.23);
    lever.children[1].visible=false;
    normalizedLink(b.connectingRod,g.connectingRodLength,.144);
    // Pass 109: the lever pin spans the lever (0.23) and the link only.
    replace(lever.children[2],headedPinGeometry(.14,-.135,.42));lever.children[2].position.z=0;
    // Pass 88: the clevis foot stands 0.006 up inside the clamp's upper
    // disk, off the plane of the disk's underside.
    plateJoint(b.centerClamp,b.connectingRod,.14,g.linkEyeHeight,.006,.209);
    // Pass 56: the rim and floor stand proud of the wall as plain flanges in
    // the casing's own colour, so no coincident faces z-fight at the wall.
    const rim=polygonClipping.difference(poly(circle([0,0],1.34,128)),poly(circle([0,0],g.diaphragmRadius,128)));
    replace(b.chamberRim,horizontalPlate(rim,-.055,.055));b.chamberRim.rotation.set(0,0,0);b.chamberRim.material=b.chamberBottom.material;
    // Pass 88: the suction check body flares below the floor and passes up
    // through it at its full 0.50 radius, in a 0.502 bore; its flare no
    // longer runs through the floor plate (their sections lay on one another).
    const floor=polygonClipping.difference(poly(circle([0,0],1.34,128)),poly(circle([0,-.38],.502,128)));
    replace(b.chamberBottom,horizontalPlate(floor,-.07,.07));
    // Pass 88: the wall stands on the bottom flange's top face and ends
    // under the clamping ring, instead of running 0.07 into the flange and
    // 0.055 into the ring (their sections lay on one another).
    const shellY=b.chamberShell.position.y,wallLow=b.chamberBottom.position.y+.07-shellY,wallHigh=b.chamberRim.position.y-.055-shellY;
    replace(b.chamberShell,pumpPortedWall(1.25,1.31,wallLow,wallHigh,[{side:1,y:.34-shellY,z:.38,radius:.27}]));
    for(const key of['suctionPipe','deliveryBranch','deliveryRiser']){const pipe=b[key].shell;replace(pipe,curvedPipeWall(pipe.userData.curve,pipe.geometry.parameters.radius-.045,pipe.geometry.parameters.radius,72));}
    for(const valve of[b.suctionValve,b.deliveryValve]){
      const seat=valve.userData.seat,outline=polygonClipping.difference(poly(circle([0,0],.45,128)),poly([[-.19,-.16],[.19,-.16],[.19,.16],[-.19,.16]]),poly([[-.33,-.30],[-.175,-.30],[-.175,.30],[-.33,.30]]));
      const suction=valve===b.suctionValve,lowerRadius=suction?.29:.27;
      replace(valve.userData.body,horizontalTurned([[-.30,lowerRadius-.045],[-.30,lowerRadius],[suction?-.20:-.14,.50],[.30,.50],[.40,.31],[.40,.265],[.30,.45],[-.14,.45]]));
      const pair=suction?b.suctionPipe:b.deliveryBranch;
      const points=suction?pair.shell.userData.curve.points.map(p=>p.clone()):[new THREE.Vector3(1.15,.34,.38),new THREE.Vector3(1.5,.34,.38),new THREE.Vector3(2.02,.60,.38),new THREE.Vector3(2.02,.88,.38)];points[points.length-1]=valve.userData.body.position.clone().add(new THREE.Vector3(0,-.30,0));
      const curve=new THREE.CatmullRomCurve3(points);
      if(suction)replace(pair.shell,curvedPipeWall(curve,lowerRadius-.045,lowerRadius,64));
      else{
        // Pass 86: the branch wall starts inside the chamber and each of its
        // generators begins on the wall's mid-radius (1.28), so its end is a
        // saddle seated in the chamber's round port (radius 0.27, the pipe's
        // outside), sealed all round.
        const wallCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(.95,.34,.38),new THREE.Vector3(1.30,.34,.38),...points.slice(1)]);
        replace(pair.shell,saddleEndPipeWall(wallCurve,0,lowerRadius-.045,lowerRadius,72,24,p=>Math.hypot(p.x,p.z)-1.28));
      }pair.shell.userData.curve=curve;replace(pair.water,new THREE.TubeGeometry(curve,64,lowerRadius*.60,12,false));
      if(!suction){const points=b.deliveryRiser.shell.userData.curve.points.map(p=>p.clone());points[0]=valve.userData.body.position.clone().add(new THREE.Vector3(0,.40,0));const curve=new THREE.CatmullRomCurve3(points);replace(b.deliveryRiser.shell,curvedPipeWall(curve,.265,.31,48));replace(b.deliveryRiser.water,new THREE.TubeGeometry(curve,48,.18,12,false));}
      // Pass 86: the flap's knuckle (r 0.07, z ±0.28) lay tangent in the
      // seat's hinge slot. Two lugs cast on the seat now carry it: each is
      // bored for the knuckle round its axis (x -0.25, 0.0325 above the seat
      // top) and stands just outside the narrowed flap (z ±0.21), so the
      // knuckle turns in two bearings instead of resting on a line.
      const axis=[-.25,.0325],lugRing=[[-.35,-.065],[-.15,-.065]];
      for(let i=0;i<=32;i++){const a=Math.PI*i/32;lugRing.push([axis[0]+.10*Math.cos(a),axis[1]+.10*Math.sin(a)]);}
      const lugOutline=polygonClipping.difference(poly(lugRing),poly(circle(axis,.07,64)));
      // plate() extrudes the x-y (y up) outline along z in the seat's frame.
      const lugs=[[.22,.28],[-.28,-.22]].map(([z0,z1])=>plate(lugOutline,z0,z1));
      replace(seat,mergePassageParts([horizontalPlate(outline,-.065,0),...lugs]));seat.position.y=valve.position.y-.0325;
    }
    d.updateSolids=()=>{b.connectingRod.position.z=.34;};
  }
  // Correct the old horizontally oriented collar to share the Z-axis fulcrum.
  const collar=root.children.find(o=>o.geometry?.type==='TorusGeometry'&&o.position.distanceTo(pivot)<1e-8);
  if(collar&&lantern){replace(collar,new THREE.TorusGeometry(.27,.035,12,48));collar.rotation.set(0,0,0);collar.position.z=.23;}
  else if(collar){
    // 454: the collar grips the 0.21 fulcrum pin and seats on the lever's
    // front face (z 0.115); the fixed pin ends flush in the collar.
    const tube=.035,front=.115,pinRadius=.21,back=-.35;collar.rotation.set(0,0,0);collar.position.z=front+tube;
    replace(collar,new THREE.TorusGeometry(pinRadius+tube,tube,12,48));
    replace(b.pivotAxle,new THREE.CylinderGeometry(pinRadius,pinRadius,collar.position.z-back,48));b.pivotAxle.position.z=(collar.position.z+back)/2;
  }
  d.solidReview={qualification:'Finite lever bores, link eyes, pipe walls, chamber openings and valve seats. Bellows/diaphragm deformation and check timing remain prescribed; pipe junction sealing, flexible stresses and passive fluid/contact dynamics are not solved.'};
  finish(root);
}

function finish(root){
  const d=root.userData;d.hideGround=true;d.minimumDisplayCycleSeconds=d.geometry.cycleDuration;
  root.traverse(o=>{for(const m of o.material?[].concat(o.material):[])m.fog=false;});
}
