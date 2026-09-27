import * as THREE from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {horizontalTurned,horizontalPlate} from './horizontal-turbine-solids.js';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
import {matte,PALETTE} from './primitives.js';
import {WaterStream} from './water-stream.js';
import {ConvexHull} from 'three/addons/math/ConvexHull.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};

// Interior of the open tapered bucket (shared with bucketParts): wall
// thickness, floor top and the full-water surface 0.05 below the rim.
function bucketInterior(height,top,bottom){
  const low=-height/2,high=height/2,thickness=.035,base=low+.060,full=high-.05;
  const radiusAt=y=>bottom+(top-bottom)*(y-low)/height-thickness-.008;
  return {low,high,base,full,radiusAt};
}
// Area of the part of a disc of radius r with z >= d.
const segmentArea=(r,d)=>d>=r?0:d<=-r?Math.PI*r*r:r*r*Math.acos(d/r)-d*Math.sqrt(r*r-d*d);
// Water volume below the level plane cos(t) y - sin(t) z = c in the bucket
// frame, where t is the tip about the ear axis (x) toward +z.
function tiltedVolume(interior,tilt,c,slices=48){
  const {base,high,radiusAt}=interior,cs=Math.cos(tilt),sn=Math.sin(tilt),dy=(high-base)/slices;
  if(Math.abs(sn)<1e-9){
    // Upright: the exact frustum below the level.
    const top=Math.min(high,Math.max(base,c)),a=radiusAt(base),b=radiusAt(top);
    return Math.PI*(top-base)*(a*a+a*b+b*b)/3;
  }
  let v=0;
  for(let i=0;i<slices;i++){
    const y=base+(i+.5)*dy,r=radiusAt(y);
    v+=(Math.abs(sn)<1e-9?(y<=c?Math.PI*r*r:0):segmentArea(r,(cs*y-c)/sn))*dy;
  }
  return v;
}
const fullVolume=interior=>tiltedVolume(interior,0,interior.full);
// Level of the lowest point of the lip when tipped by `tilt`.
const lipLevel=(interior,tilt)=>Math.cos(tilt)*interior.high-Math.sin(tilt)*interior.radiusAt(interior.high);
// Fraction of a full bucket the tipped bucket can still hold (1 upright).
export function bucketCapacityAtTilt(tilt,{height,top,bottom}){
  const interior=bucketInterior(height,top,bottom);
  if(tilt<=0)return 1;
  return Math.min(1,tiltedVolume(interior,tilt,lipLevel(interior,tilt))/fullVolume(interior));
}
// Pass 72 (p72-c): the operator first draws the raised bucket aside, clear
// of the well kerb (over the first 18 % of the top dwell), then tips it about
// its ears (18-66 %) so it spills steadily over the lip onto the ground
// outside, holds it, rights it (72-88 %) and swings it back. While it spills
// the water kept falls smoothly from full to empty and the tip is the one at
// which the tipped bucket holds just that much (bucketCapacityAtTilt), so the
// pour lasts about a third of the dwell instead of a brisk flick.
export const ASIDE_OUT_END=.18,ASIDE_BACK_START=.88;
const TIP_END=.66,RIGHT_START=.72;
const capacityTiltCache=new Map();
function tiltHolding(fraction,dims){
  let lo=0,hi=Math.PI*.75;
  for(let i=0;i<36;i++){const mid=(lo+hi)/2;if(bucketCapacityAtTilt(mid,dims)>fraction)lo=mid;else hi=mid;}
  return (lo+hi)/2;
}
function spillLimits(dims){
  const key=`${dims.height},${dims.top},${dims.bottom}`;
  if(!capacityTiltCache.has(key))capacityTiltCache.set(key,{start:tiltHolding(1-1e-9,dims),end:tiltHolding(1e-9,dims)});
  return capacityTiltCache.get(key);
}
export function asideEmptying(u,dims,maxTilt=THREE.MathUtils.degToRad(118)){
  const ease=x=>{x=Math.min(1,Math.max(0,x));return x*x*x*(x*(6*x-15)+10);};
  const aside=u<ASIDE_OUT_END?ease(u/ASIDE_OUT_END):u<ASIDE_BACK_START?1:1-ease((u-ASIDE_BACK_START)/(1-ASIDE_BACK_START));
  if(u<ASIDE_OUT_END)return {aside,tilt:0,fraction:1};
  if(u>=TIP_END)return {aside,fraction:0,tilt:u<RIGHT_START?maxTilt:maxTilt*(1-ease((u-RIGHT_START)/(ASIDE_BACK_START-RIGHT_START)))};
  const {start,end}=spillLimits(dims),w=(u-ASIDE_OUT_END)/(TIP_END-ASIDE_OUT_END);
  // Up to the lip, spill, then on past the empty tip.
  if(w<.12)return {aside,tilt:start*ease(w/.12),fraction:1};
  if(w<.80){const fraction=1-ease((w-.12)/.68);return {aside,fraction,tilt:fraction<=0?end:fraction>=1?start:tiltHolding(fraction,dims)};}
  return {aside,fraction:0,tilt:end+(maxTilt-end)*ease((w-.80)/.20)};
}

// The bail's turn on the ears for a given tip (zero up to 50 degrees), and
// the resulting offset of the bucket centre that keeps the bail's crown on
// the rope.
export function bailSwing(tilt){
  return (tilt-THREE.MathUtils.degToRad(60))*THREE.MathUtils.smoothstep(tilt,THREE.MathUtils.degToRad(50),THREE.MathUtils.degToRad(70));
}
export function bailHang(tilt,handleRise,target=new THREE.Vector3()){
  const bail=bailSwing(tilt);
  return target.set(0,handleRise*(1-Math.cos(bail)),-handleRise*Math.sin(bail));
}

// A closed tapered wall and floor, with an actual open mouth. The body,
// floor, rim and water hang in a tipper that turns about the ears (the
// bail's pivots, along x at the rim); the bail stays hanging on the rope.
function bucketParts(bucket,water,height,top,bottom,handleRise){
  const [body,floor,rim,handle]=bucket.children;
  const low=-height/2,high=height/2,thickness=.035;
  replace(body,horizontalTurned([[low,bottom],[high,top],[high,top-thickness],[low+.055,bottom-thickness]]));
  replace(floor,new THREE.CylinderGeometry(bottom,bottom,.055,48));floor.position.y=low+.0275;
  const points=[[-top,high],[-top*.74,high+handleRise*.76],[0,high+handleRise],[top*.74,high+handleRise*.76],[top,high]].map(([x,y])=>new THREE.Vector3(x,y,0));
  replace(handle,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),48,.035,12,false));
  const tipper=new THREE.Group();tipper.position.y=high;tipper.userData.role='bucket-tipping-about-its-ears';
  const inner=new THREE.Group();inner.position.y=-high;tipper.add(inner);
  for(const part of [body,floor,rim,water].filter(Boolean))inner.add(part);
  bucket.add(tipper);
  // The bail also turns freely on the ears. Past about 60 degrees of tip the
  // far half of the rim would swing up through the upright bail, so the bail
  // falls toward the pour side, and since the rope holds the bail's crown,
  // the bucket hangs back from it by that much.
  const bailPivot=new THREE.Group();bailPivot.position.y=high;bailPivot.userData.role='bail-turning-on-the-ears';
  handle.position.y-=high;bailPivot.add(handle);bucket.add(bailPivot);
  // The water is the bucket interior (a 48-sided frustum) below the level
  // plane: written as triangles into one fixed buffer. Upright it is the
  // frustum up to the level; tipped it is the convex hull of the interior's
  // corners below the plane and the edges' crossings of it (exact for the
  // polyhedral interior), so a nearly empty tipped bucket holds only a thin
  // wedge at the lip.
  const sides=48,maxTriangles=6*sides+64;
  const geometry=new THREE.BufferGeometry();
  const P=new Float32Array(maxTriangles*9),N=new Float32Array(maxTriangles*9);
  geometry.setAttribute('position',new THREE.BufferAttribute(P,3));
  geometry.setAttribute('normal',new THREE.BufferAttribute(N,3));
  replace(water,geometry);
  const position=geometry.attributes.position,normal=geometry.attributes.normal;
  const interior=bucketInterior(height,top,bottom),{base,radiusAt}=interior,rimY=interior.high-.01;
  const full=fullVolume(interior);
  water.userData.fullVolume=full;
  const cosines=Array.from({length:sides},(_,i)=>Math.cos(2*Math.PI*i/sides)),sines=Array.from({length:sides},(_,i)=>Math.sin(2*Math.PI*i/sides));
  const a=new THREE.Vector3(),b=new THREE.Vector3(),e=new THREE.Vector3(),f=new THREE.Vector3(),nrm=new THREE.Vector3();
  let count=0;
  const tri=(p0,p1,p2)=>{
    if(count>=maxTriangles)return;
    e.subVectors(p1,p0);f.subVectors(p2,p0);nrm.crossVectors(e,f);
    const l=nrm.length();if(l<1e-12)return;nrm.multiplyScalar(1/l);
    const o=count*9;
    for(const [k,p] of [[0,p0],[1,p1],[2,p2]]){P[o+3*k]=p.x;P[o+3*k+1]=p.y;P[o+3*k+2]=p.z;N[o+3*k]=nrm.x;N[o+3*k+1]=nrm.y;N[o+3*k+2]=nrm.z;}
    count++;
  };
  const finish=()=>{
    const cx=0,cy=base,cz=0;
    for(let i=count*9;i<P.length;i+=3){P[i]=cx;P[i+1]=cy;P[i+2]=cz;N[i]=0;N[i+1]=1;N[i+2]=0;}
    position.needsUpdate=true;normal.needsUpdate=true;geometry.computeBoundingSphere();
  };
  const ring=(y,i,target)=>target.set(cosines[i]*radiusAt(y),y,sines[i]*radiusAt(y));
  const c0=new THREE.Vector3(),c1=new THREE.Vector3(),p0=new THREE.Vector3(),p1=new THREE.Vector3(),q0=new THREE.Vector3(),q1=new THREE.Vector3();
  const update=(fraction,tilt=0)=>{
    tipper.rotation.x=tilt;
    // (The factory's bucket centre already hangs back by bailHang.)
    bailPivot.rotation.x=bailSwing(tilt);
    water.position.set(0,0,0);water.scale.set(1,1,1);water.visible=fraction>1e-12; // (the last thin wedge shrinks away, no pop)
    count=0;
    if(!water.visible){finish();return;}
    const cs=Math.cos(tilt),sn=Math.sin(tilt);
    // Level plane holding the water: bisect between the lowest point of the
    // interior and the lip.
    let lo=Math.min(cs*base-sn*radiusAt(base),cs*interior.high-sn*radiusAt(interior.high)),hi=lipLevel(interior,tilt);
    if(tilt===0){lo=base;hi=interior.full;}
    for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(tiltedVolume(interior,tilt,mid)<fraction*full)lo=mid;else hi=mid;}
    const c=(lo+hi)/2;
    if(tilt===0){
      const level=Math.min(rimY,c);
      c0.set(0,base,0);c1.set(0,level,0);
      for(let i=0;i<sides;i++){
        const j=(i+1)%sides;
        ring(base,i,p0);ring(base,j,p1);ring(level,i,q0);ring(level,j,q1);
        tri(p0,q0,q1);tri(p0,q1,p1);tri(c0,p0,p1);tri(c1,q1,q0);
      }
      finish();return;
    }
    // Tipped: hull of the interior corners below the plane and the edge
    // crossings of the plane.
    const level=(p)=>cs*p.y-sn*p.z-c;
    const points=[];
    const cross=(u,v)=>{const du=level(u),dv=level(v);if((du<0)!==(dv<0)){const t=du/(du-dv);points.push(u.clone().lerp(v,t));}};
    for(let i=0;i<sides;i++){
      const j=(i+1)%sides;
      ring(base,i,p0);ring(base,j,p1);ring(rimY,i,q0);ring(rimY,j,q1);
      if(level(p0)<=0)points.push(p0.clone());
      if(level(q0)<=0)points.push(q0.clone());
      cross(p0,q0);cross(p0,p1);cross(q0,q1);
    }
    if(points.length>=4){
      const hull=new ConvexHull().setFromPoints(points);
      for(const face of hull.faces){
        const h=face.edge;
        tri(h.prev.head().point,h.head().point,h.next.head().point);
      }
    }
    finish();
  };
  update.tipper=tipper;update.interior=interior;
  bucket.userData.parts=[body,floor,rim,handle];
  return update;
}

// The pour from a tipped bucket's lip: one continuous stream re-shaped in
// place each frame (no allocation), falling freely from the lip to `endY`.
function makePour(root,parts,endY,dims,rateAt,cyclePeriod){
  const n=18,path={points:Array.from({length:n+1},(_,k)=>new THREE.Vector3(0,-k*.05,0)),speeds:new Array(n+1).fill(1),times:Array.from({length:n+1},(_,k)=>k*.02)};
  const stream=new WaterStream(path,{width:.13,thickness:.05,widthAxis:new THREE.Vector3(1,0,0),widthExponent:.5,
    fadeIn:.05,foam:{start:.9,amount:.35},cyclePeriod,streakRate:1.6,opacity:.5});
  stream.userData.role='water-poured-from-tipped-bucket';stream.visible=false;root.add(stream);
  // Peak spill rate over the dwell, to scale the stream.
  let peak=1e-9;for(let i=0;i<=200;i++)peak=Math.max(peak,-rateAt(i/200));
  const lip=new THREE.Vector3(),axis=new THREE.Vector3();
  return (flowRate,time)=>{
    const flow=Math.max(0,-flowRate)/peak;
    stream.visible=flow>.002;
    // The pour fades in and out with the spill rate instead of switching on.
    stream.material.opacity=.5*THREE.MathUtils.smoothstep(flow,.002,.3);
    if(!stream.visible)return;
    const tipper=parts.tipper;tipper.updateWorldMatrix(true,false);
    lip.set(0,0,dims.top).applyMatrix4(tipper.matrixWorld);
    axis.set(0,1,0).transformDirection(tipper.matrixWorld);
    // Out of the mouth, horizontally along the bucket's tipped axis.
    const reach=Math.hypot(axis.x,axis.z)||1,out=.6*Math.max(.3,reach)/reach;
    const vx=out*axis.x,vy=.6*axis.y,vz=out*axis.z,g=9.81;
    const tEnd=(vy+Math.sqrt(vy*vy+2*g*Math.max(.01,lip.y-endY)))/g;
    for(let k=0;k<=n;k++){const t=tEnd*k/n;path.points[k].set(lip.x+vx*t,lip.y+vy*t-.5*g*t*t,lip.z+vz*t);path.speeds[k]=Math.hypot(vx,vy-g*t,vz);path.times[k]=t;}
    stream.flow=.3+.7*flow;stream.setPath(path);stream.update(time??0);
  };
}

export function correctWellBucketParts(root,id){
  const d=root.userData,b=d.blocks,g=d.geometry;
  if(id===457){
    // Brown's sweep is one straight hewn pole, tapering from the fulcrum to
    // its tip, on a thin pin through the pole and both prongs of the post.
    const [body,pin]=b.beam.children,L=g.longArmLength,S=g.shortArmLength,pinRadius=.07;
    const half=x=>.105+.05*(x+L)/(L+S);
    const outline=clip.difference(clip.union(poly([[-L,-half(-L)],[S,-half(S)],[S,half(S)],[-L,half(-L)]]),
      poly(circle([-L,0],.18,48)),poly(circle([S,0],half(S),32))),
      poly(circle([0,0],pinRadius+.006,48)),poly(circle([-L,0],.134,48)));
    replace(body,plate(outline,-.10,.10));
    replace(b.pivotAxle,new THREE.CylinderGeometry(pinRadius,pinRadius,1.0,24));
    // Brown's forked post: a tree trunk from the ground whose two branch stubs
    // straddle the pole, one behind and one in front, and carry the pin.
    b.support.children.forEach(o=>o.visible=false);
    // The post is timber, in the shared timber tone (as the treadmill boards
    // and wooden buckets), not the grey used for iron frames.
    const wood=matte(PALETTE.brass,{metalness:.01,roughness:.86}),groundTop=.46,crotch=g.beamPivot.y-.95;
    const limb=(from,to,r0,r1)=>{
      const axis=to.clone().sub(from),mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,axis.length(),20),wood);
      mesh.position.copy(from).add(to).multiplyScalar(.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());
      b.support.add(mesh);return mesh;
    };
    const base=new THREE.Vector3(g.beamPivot.x,groundTop-.02,0),fork=new THREE.Vector3(g.beamPivot.x,crotch,0);
    b.trunk=limb(base,fork.clone().setY(crotch+.12),.36,.27);
    b.forks=[-1,1].map(side=>{
      const atPin=new THREE.Vector3(g.beamPivot.x+side*.04,g.beamPivot.y,side*.42);
      const lower=limb(fork,atPin,.22,.15);
      const top=atPin.clone().add(new THREE.Vector3(side*.10,.62,side*.05));
      const upper=limb(atPin,top,.15,.11);
      const knot=new THREE.Mesh(new THREE.SphereGeometry(.15,20,14),wood);knot.position.copy(atPin);b.support.add(knot);
      return upper;
    });
    const water=bucketParts(b.bucket,b.bucketWater,g.bucketHeight,.40,.30,g.bucketHandleRise);
    const dims={height:g.bucketHeight,top:.40,bottom:.30},span=1-g.ascentEndPhase;
    // Drawn aside over the ground, the bucket spills onto the ground's top
    // (y .46) beside the well kerb, not back down the well.
    const pour=makePour(root,water,.46,dims,u=>(asideEmptying(u+1e-4,dims).fraction-asideEmptying(u-1e-4,dims).fraction)/2e-4,g.cycleDuration);
    const ground=clip.difference(poly([[-3.75,-1.35],[3.35,-1.35],[3.35,1.35],[-3.75,1.35]]),poly(circle([g.wellCenterX,0],1.135,128)));
    replace(b.base,horizontalPlate(ground,.39,.46));b.base.position.set(0,0,0);
    replace(b.well,horizontalTurned([[g.wellBottomY,1.075],[g.wellBottomY,1.135],[g.wellRimY,1.135],[g.wellRimY,1.075]]));b.well.position.y=0;
    replace(b.wellRim,new THREE.TorusGeometry(1.135,.08,16,96));
    replace(b.wellWater,new THREE.CylinderGeometry(1.05,1.05,.85,64));b.wellWater.position.y=-2.55;
    b.operatorArrow.visible=false;b.well.material.opacity=.12;
    // The rope terminates on the bail, rather than continuing through it.
    d.updateWorkingParts=state=>{water(state.bucketWaterFraction,state.bucketTilt??0);
      pour(state.bucketWaterFractionRate*g.cycleDuration*span,state.phase*g.cycleDuration);b.operatorArrow.visible=false;};
    b.workingBeam=body;b.ropePin=pin;
  }else{
    const rotor=b.pulley.userData.rotor,tread=b.pulley.userData.tread,R=g.pulleyRadius;
    const profile=[{axial:-.21,radial:R+.03},{axial:-.055,radial:R+.03}];
    for(let i=0;i<=32;i++){const z=-.05+.10*i/32;profile.push({axial:z,radial:R-Math.sqrt(Math.max(0,.05**2-z*z))});}
    profile.push({axial:.055,radial:R+.03},{axial:.21,radial:R+.03});
    replace(tread,boredLatheGeometry(profile,R*.80,128));
    replace(b.pulley.userData.hub,boredLatheGeometry([{axial:-.305,radial:.22},{axial:.305,radial:.22}],.174,80));
    for(const o of rotor.children){
      if(o.geometry?.type==='TorusGeometry')o.visible=false;
      if(o.geometry?.type==='BoxGeometry'&&o.position.x>R*.9)o.visible=false;
    }
    for(const spoke of b.pulley.userData.spokes){replace(spoke,new THREE.BoxGeometry(.44,R*.10,.26));spoke.position.set(.43*Math.cos(spoke.rotation.z),.43*Math.sin(spoke.rotation.z),0);}
    const hanger=b.frame.children.at(-1);
    const shape=clip.difference(clip.union(capsule([0,0],[0,1.17],.11,24),poly(circle([0,0],.225,64))),poly(circle([0,0],.174,64)));
    replace(hanger,plate(shape,-.075,.075));hanger.position.copy(g.pulleyCenter);hanger.position.z=-.40;
    b.hanger=hanger;
    // Pass 72: the posts stand at the back of the roof boards (z -.71 to
    // -.50), clear of a bucket drawn aside in front of them.
    for(const post of b.frame.children.slice(0,2)){replace(post,new THREE.BoxGeometry(.20,4,.21));post.position.set(Math.sign(post.position.x)*1.86,1.40,-.605);}
    // Pass 72: the water stands 0.12 higher (top y -1.97), since the buckets
    // now hang 0.08 higher and the low one must still fill below it.
    replace(b.wellWater,new THREE.BoxGeometry(3.12,1.06,1.72));b.wellWater.position.y=-2.50;
    // Replace the solid transparent block with finite side/rear walls.
    replace(b.shaftWell,plate(clip.difference(poly([[-1.70,-1],[1.70,-1],[1.70,1],[-1.70,1]]),poly([[-1.58,-1.01],[1.58,-1.01],[1.58,.88],[-1.58,.88]])),-1.56,1.56).rotateX(Math.PI/2));
    const left=bucketParts(b.leftBucket.bucket,b.leftBucket.water,g.bucketHeight,g.bucketRadius,g.bucketRadius*.76,g.bucketHandleRise);
    const right=bucketParts(b.rightBucket.bucket,b.rightBucket.water,g.bucketHeight,g.bucketRadius,g.bucketRadius*.76,g.bucketHandleRise);
    const dims={height:g.bucketHeight,top:g.bucketRadius,bottom:g.bucketRadius*.76};
    const rateAt=u=>(asideEmptying(u+1e-4,dims).fraction-asideEmptying(u-1e-4,dims).fraction)/2e-4;
    // Drawn aside over the kerb, each raised bucket spills onto the ground's
    // top beside its post, not back down the shaft.
    const pours=[left,right].map(parts=>makePour(root,parts,g.groundTopY,dims,rateAt,g.cycleDuration));
    // Both emptying dwells last the same fraction of the cycle.
    const perU=g.cycleDuration*(g.exchangeDwellEndPhase-g.outwardEndPhase);
    d.updateWorkingParts=state=>{left(state.leftWaterFraction,state.leftBucketTilt??0);right(state.rightWaterFraction,state.rightBucketTilt??0);
      pours[0]((state.leftBucketTilt?state.leftWaterFractionRate:0)*perU,state.phase*g.cycleDuration);
      pours[1]((state.rightBucketTilt?state.rightWaterFractionRate:0)*perU,state.phase*g.cycleDuration);};
    b.base.visible=false;
  }
  d.hideGround=true;d.minimumDisplayCycleSeconds=g.cycleDuration;
  root.traverse(o=>{for(const mat of o.material?[].concat(o.material):[])mat.fog=false;});
  const bounds=new THREE.Box3(),point=new THREE.Vector3();
  for(let i=0;i<=32;i++){
    d.update(g.cycleDuration*i/32);root.updateMatrixWorld(true);
    root.traverseVisible(o=>{const p=o.geometry?.attributes.position;if(p)for(let j=0;j<p.count;j++)bounds.expandByPoint(point.fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld));});
  }
  d.cameraFitBounds=bounds.expandByScalar(.10);d.cameraDirection=new THREE.Vector3(.6,.55,15);d.cameraDistanceScale=1.06;d.cameraFov=12;
  d.reconstructionNote='Finite journals, open buckets and rope interfaces. Operator motion, filling and emptying remain prescribed; rope tension, friction, bucket swing, slosh and fluid transfer are not solved.';
}
