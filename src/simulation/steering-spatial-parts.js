import * as THREE from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
const tube=(radius,bore,length)=>boredLatheGeometry([{radial:radius,axial:-length/2},{radial:radius,axial:length/2}],bore,80);
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
export function correctSteeringSolids(root) {
  const b=root.userData.blocks,g=root.userData.geometry;
  const wheelRadius=2.45,wheelX=-1.85,coreRadius=g.drumRadius-g.ropeRadius-.006;
  replace(b.handwheelRim,new THREE.TorusGeometry(wheelRadius,.055,12,96));
  b.handwheelRim.rotation.y=Math.PI/2;b.handwheelRim.position.set(wheelX,0,0);
  for(const [i,spoke]of b.handwheelSpokes.entries()){
    const a=i*Math.PI/4;
    replace(spoke,new THREE.BoxGeometry(.065,wheelRadius-.19,.065));
    spoke.rotation.set(a,0,0);
    spoke.position.set(wheelX,(wheelRadius+.19)/2*Math.cos(a),(wheelRadius+.19)/2*Math.sin(a));
  }
  b.handwheelIndex.position.set(wheelX+.05,wheelRadius*.8,0);
  const wheelHub=new THREE.Mesh(tube(.22,.104,.18),b.handwheelRim.material);
  wheelHub.rotation.z=-Math.PI/2;wheelHub.position.x=wheelX;
  wheelHub.userData.role='bored-handwheel-hub';b.wheelAndBarrel.add(wheelHub);
  replace(b.barrel,tube(coreRadius,.104,.84));b.barrel.rotation.set(0,0,-Math.PI/2);
  for(const [i,flange]of b.barrelFlanges.entries()){
    replace(flange,tube(.52,.104,.055));flange.rotation.set(0,0,-Math.PI/2);flange.position.set((i?1:-1)*g.drumHalfWidth,0,0);
  }
  replace(b.fixedShaft,new THREE.CylinderGeometry(.10,.10,2.92,40));
  b.fixedShaft.rotation.set(0,0,-Math.PI/2);b.fixedShaft.position.set(g.drumCenter.x-.73,g.drumCenter.y,0);
  const shaftBearings=[];
  for(const [i,pedestal]of b.wheelPedestals.entries()){
    const x=g.drumCenter.x+(i?.66:-1.30);
    replace(pedestal,new THREE.BoxGeometry(.24,.30,2.47));pedestal.position.set(x,g.drumCenter.y,-1.415);
    const bearing=new THREE.Mesh(tube(.21,.104,.24),pedestal.material);
    bearing.rotation.z=-Math.PI/2;bearing.position.set(x,g.drumCenter.y,0);
    bearing.userData.role='bored-steering-shaft-bearing';root.add(bearing);shaftBearings.push(bearing);
  }
  b.shaftBearings=shaftBearings;b.wheelHub=wheelHub;
  for(const guide of [b.upperGuide,b.lowerGuide]){
    replace(guide.sheave,tube(.36,.083,.15));guide.sheave.rotation.set(Math.PI/2,0,0);
    const r=g.guideRadius-g.ropeRadius-.005;
    const groove=new THREE.Mesh(boredLatheGeometry([
      {axial:-.13,radial:.51},{axial:-.105,radial:.51},{axial:-.060,radial:r},
      {axial:.060,radial:r},{axial:.105,radial:.51},{axial:.13,radial:.51},
    ],.28,112),guide.groove.material);
    replace(guide.groove,groove.geometry);guide.groove.rotation.x=Math.PI/2;
    guide.index.position.z=.12;
    const pin=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.36,32),b.fixedShaft.material);
    pin.rotation.x=Math.PI/2;pin.userData.role='fixed-bored-sheave-axle';guide.fixed.add(pin);guide.pin=pin;
    const post=new THREE.Mesh(new THREE.BoxGeometry(.18,.25,2.9),b.wheelPedestals[0].material);
    post.position.z=-1.6;post.userData.role='guide-sheave-support';guide.fixed.add(post);guide.post=post;
  }
  b.tiller.position.z=0;
  replace(b.tillerTipBoss,new THREE.CylinderGeometry(.17,.17,.72,40));
  b.tillerTipBoss.position.z=.03;
  for(const sign of [-1,1]){
    const clamp=new THREE.Mesh(new THREE.BoxGeometry(.14,.055,.12),b.tillerTipBoss.material);
    clamp.position.set(-g.tillerLength,sign*.12,g.upperRopePlaneZ);
    clamp.userData.role='fixed-rope-end-clamp-on-tiller';b.tiller.add(clamp);
  }
  const rudderShaft=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,2.62,40),b.rudderHead.material);
  rudderShaft.rotation.x=Math.PI/2;rudderShaft.position.z=-1.44;
  rudderShaft.userData.role='rudder-stock-under-tiller';b.tiller.add(rudderShaft);b.rudderShaft=rudderShaft;
  replace(b.deck,new THREE.BoxGeometry(7.5,6.3,.12));b.deck.position.set(-.05,0,-2.78);
  b.deck.visible=false;
  // Brown's plan shows no deck. Each post and pedestal ends on its own foot
  // plate bolted to the (undrawn) deck, so none stops in mid-air.
  const footTop=-2.72;
  const addFoot=(parent,x,y,role)=>{const foot=new THREE.Mesh(new THREE.BoxGeometry(.52,.52,.08),b.wheelPedestals[0].material);foot.position.set(x,y,footTop-.04);foot.userData.role=role;parent.add(foot);return foot;};
  for(const guide of [b.upperGuide,b.lowerGuide]){
    const localFoot=footTop-guide.fixed.position.z,postTop=-.15;
    guide.post.geometry.dispose();guide.post.geometry=new THREE.BoxGeometry(.18,.25,postTop-localFoot);guide.post.position.z=(postTop+localFoot)/2;
    guide.foot=addFoot(guide.fixed,0,0,'guide-sheave-support-foot');guide.foot.position.z=localFoot-.04;
  }
  for(const pedestal of b.wheelPedestals){
    const top=pedestal.position.z+1.235;
    pedestal.geometry.dispose();pedestal.geometry=new THREE.BoxGeometry(.24,.30,top-footTop);pedestal.position.z=(top+footTop)/2;
    addFoot(root,pedestal.position.x,pedestal.position.y,'handwheel-pedestal-foot');
  }
  root.userData.cameraFitBounds=new THREE.Box3(new THREE.Vector3(-3.90,-3.25,-3.00),new THREE.Vector3(3.80,3.25,2.65));
  root.userData.cameraDirection=new THREE.Vector3(.2,.4,16);
  root.userData.cameraDistanceScale=1.02;root.userData.cameraFov=12;
  root.userData.groundFloorY=-3.26;
  root.userData.spatialReconstruction={barrelAxis:[1,0,0],guideAxes:[0,0,1],coreRadius,ropeRadius:g.ropeRadius,workingPitchRadius:g.drumRadius};
  root.traverse(o=>{for(const m of o.material?[].concat(o.material):[])m.fog=false;});
}
