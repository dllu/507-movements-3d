import * as THREE from 'three';
import profile from '../data/tilt-hammer-profile.js';
import{makeTiltHammerMotion}from'./tilt-hammer-motion.js';
import{turnedClutchGeometry}from'./clutch-section-geometry.js';
import{matte,markShadows}from'./primitives.js';

export function makeFourLobeTiltHammer(){
  const motion=makeTiltHammerMotion(profile),p=motion.parameters,root=new THREE.Group();
  const input=new THREE.Group(),hammer=new THREE.Group(),fixed=new THREE.Group();root.add(input,hammer,fixed);
  hammer.position.set(...p.pivot,0);const parts={},families={},parents={input,hammer,fixed};
  const plate=descriptor=>{
    const shapes=descriptor.polygons.map(([outer,...holes])=>{
      const shape=new THREE.Shape(outer.map(q=>new THREE.Vector2(...q)));
      shape.holes=holes.map(ring=>new THREE.Path(ring.map(q=>new THREE.Vector2(...q))));return shape;
    });
    const geometry=new THREE.ExtrudeGeometry(shapes,{depth:descriptor.depth,bevelEnabled:false,curveSegments:1});
    geometry.translate(0,0,descriptor.low);return geometry;
  };
  for(const descriptor of profile.parts){
    const d=descriptor.shape;let geometry;
    if(d.kind==='turned')geometry=turnedClutchGeometry(d.profile,d);
    else if(d.kind==='plate')geometry=plate(d);
    else{
      const ring=[];
      for(let lobe=0;lobe<4;lobe++)for(let i=0;i<=d.segments;i++){
        const angle=p.pitch*i/d.segments,dx=Math.cos(angle),dy=Math.sin(angle),v=p.flankCenter[0]*dx+p.flankCenter[1]*dy;
        const radius=v+Math.sqrt(p.flankRadius**2-(p.flankCenter[0]**2+p.flankCenter[1]**2)+v*v);
        const x=radius*dx,y=radius*dy,rotation=lobe*p.pitch;
        ring.push([x*Math.cos(rotation)-y*Math.sin(rotation),x*Math.sin(rotation)+y*Math.cos(rotation)]);
      }
      geometry=plate({...d,polygons:[[[...ring,ring[0]]]]});
    }
    const mesh=new THREE.Mesh(geometry,matte(new THREE.Color().fromArray(descriptor.color),{metalness:.16,roughness:.62}));
    mesh.name=descriptor.name;mesh.position.fromArray(descriptor.position);parents[descriptor.family].add(mesh);
    parts[descriptor.name]=mesh;families[descriptor.name]=descriptor.family;
  }
  const update=time=>{
    const state=motion.atTime(time);input.rotation.z=state.angle;hammer.rotation.z=state.q;
    root.userData.kinematics=state;
  };
  root.userData={parts,families,blocks:{input,hammer,fixed},geometry:p,profile,motion,stateAtTime:motion.atTime,
    mechanism:'four-circular-lobe-gravity-tilt-hammer',fidelity:'authored',reconstructionStatus:'rebuilt',
    hideGround:true,cameraFov:8,fullCameraDirection:new THREE.Vector3(0,0,10),
    shadowCameraHalfExtent:6,shadowBias:-.00012,shadowNormalBias:.005,
    animationTiming:{authoredCyclePeriod:p.period},minimumDisplayCycleSeconds:3,
    idealConstraints:'A regulated clockwise cam lifts the hammer through its rounded nose. Contact force determines release at the lobe tip, then gravity brings the striker onto a fixed workpiece. The rear pivot pin is fixed; bearing friction and workpiece deformation are omitted. Pickup and landing impacts are inelastic.'};
  update(0);markShadows(root);return{root,update,motion,cameraDirection:new THREE.Vector3(0,0,10)};
}
