import * as THREE from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {horizontalTurned,horizontalPlate} from './horizontal-turbine-solids.js';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};

// A closed tapered wall and floor, with an actual open mouth.
function bucketParts(bucket,water,height,top,bottom,handleRise){
  const [body,floor,,handle]=bucket.children;
  const low=-height/2,high=height/2,thickness=.035;
  replace(body,horizontalTurned([[low,bottom],[high,top],[high,top-thickness],[low+.055,bottom-thickness]]));
  replace(floor,new THREE.CylinderGeometry(bottom,bottom,.055,48));floor.position.y=low+.0275;
  const points=[[-top,high],[-top*.74,high+handleRise*.76],[0,high+handleRise],[top*.74,high+handleRise*.76],[top,high]].map(([x,y])=>new THREE.Vector3(x,y,0));
  replace(handle,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),48,.035,12,false));
  replace(water,new THREE.CylinderGeometry(1,1,1,48));
  const unit=water.geometry.attributes.position.array.slice(),position=water.geometry.attributes.position;
  const base=low+.060,maxDepth=height-.11;
  const radiusAt=y=>bottom+(top-bottom)*(y-low)/height-thickness-.008;
  const volumeAt=h=>{const a=radiusAt(base),b=radiusAt(base+h);return Math.PI*h*(a*a+a*b+b*b)/3;};
  water.userData.fullVolume=volumeAt(maxDepth);
  const update=fraction=>{
    let lo=0,hi=maxDepth;
    for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(volumeAt(mid)<fraction*water.userData.fullVolume)lo=mid;else hi=mid;}
    const depth=fraction===0?0:(lo+hi)/2;
    for(let i=0;i<position.count;i++){
      const y=base+(unit[3*i+1]+.5)*depth;
      const r=radiusAt(y);
      position.setXYZ(i,unit[3*i]*r,y,unit[3*i+2]*r);
    }
    water.position.y=0;water.scale.set(1,1,1);water.visible=fraction>1e-5;
    position.needsUpdate=true;water.geometry.computeVertexNormals();water.geometry.computeBoundingSphere();
  };
  return update;
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
    const wood=b.support.children[0].material,groundTop=.46,crotch=g.beamPivot.y-.95;
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
    const ground=clip.difference(poly([[-3.75,-1.35],[3.35,-1.35],[3.35,1.35],[-3.75,1.35]]),poly(circle([g.wellCenterX,0],1.135,128)));
    replace(b.base,horizontalPlate(ground,.39,.46));b.base.position.set(0,0,0);
    replace(b.well,horizontalTurned([[g.wellBottomY,1.075],[g.wellBottomY,1.135],[g.wellRimY,1.135],[g.wellRimY,1.075]]));b.well.position.y=0;
    replace(b.wellRim,new THREE.TorusGeometry(1.135,.08,16,96));
    replace(b.wellWater,new THREE.CylinderGeometry(1.05,1.05,.85,64));b.wellWater.position.y=-2.55;
    b.operatorArrow.visible=false;b.well.material.opacity=.12;
    // The rope terminates on the bail, rather than continuing through it.
    d.updateWorkingParts=state=>{water(state.bucketWaterFraction);b.operatorArrow.visible=false;};
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
    for(const post of b.frame.children.slice(0,2)){replace(post,new THREE.BoxGeometry(.20,4,.30));post.position.set(Math.sign(post.position.x)*1.86,1.40,-.55);}
    replace(b.wellWater,new THREE.BoxGeometry(3.12,.94,1.72));b.wellWater.position.y=-2.56;
    // Replace the solid transparent block with finite side/rear walls.
    replace(b.shaftWell,plate(clip.difference(poly([[-1.70,-1],[1.70,-1],[1.70,1],[-1.70,1]]),poly([[-1.58,-1.01],[1.58,-1.01],[1.58,.88],[-1.58,.88]])),-1.56,1.56).rotateX(Math.PI/2));
    const left=bucketParts(b.leftBucket.bucket,b.leftBucket.water,g.bucketHeight,g.bucketRadius,g.bucketRadius*.76,g.bucketHandleRise);
    const right=bucketParts(b.rightBucket.bucket,b.rightBucket.water,g.bucketHeight,g.bucketRadius,g.bucketRadius*.76,g.bucketHandleRise);
    d.updateWorkingParts=state=>{left(state.leftWaterFraction);right(state.rightWaterFraction);};
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
