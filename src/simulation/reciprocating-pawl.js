import * as THREE from 'three';
import profile from '../data/reciprocating-pawl-profile.js';
import {makeReciprocatingPawlMotion} from './reciprocating-pawl-motion.js';
import {turnedClutchGeometry} from './clutch-section-geometry.js';
import {matte,markShadows} from './primitives.js';

export function makeReciprocatingPawlRatchet(){
  const root=new THREE.Group(),parts={},families={},blocks={},motion=makeReciprocatingPawlMotion(profile),p=motion.parameters;
  for(const name of ['wheel','bar','movingPawl','holdingPawl','rod','fixed']){
    blocks[name]=new THREE.Group();root.add(blocks[name]);
  }
  // Brown crops rod C just below the wheel. It runs on straight past his
  // crop by ROD_RUN_ON and ends in the same rounded end (p62), so the rod is
  // whole when the view is turned; its bottom run lies outside the fit.
  const ROD_RUN_ON=1;
  for(const descriptor of profile.parts){
    const d=descriptor.name==='rodBody'?{...descriptor.shape,polygons:descriptor.shape.polygons.map(rings=>rings.map(
      (ring,index)=>index?ring:ring.map(([x,y])=>[x,y<-.5?y-ROD_RUN_ON:y])))}:descriptor.shape;let geometry;
    if(d.kind==='turned')geometry=turnedClutchGeometry(d.profile,d);
    else{
      const shapes=d.polygons.map(([outer,...holes])=>{
        const shape=new THREE.Shape(outer.map(p=>new THREE.Vector2(...p)));
        shape.holes=holes.map(r=>new THREE.Path(r.map(p=>new THREE.Vector2(...p))));return shape;
      });
      geometry=new THREE.ExtrudeGeometry(shapes,{depth:d.high-d.low,bevelEnabled:false,curveSegments:1});
      geometry.translate(0,0,d.low);
    }
    const mesh=new THREE.Mesh(geometry,matte(new THREE.Color().fromArray(descriptor.color),{metalness:.17,roughness:.61}));
    mesh.name=descriptor.name;mesh.position.fromArray(descriptor.position);blocks[descriptor.family].add(mesh);
    parts[descriptor.name]=mesh;families[descriptor.name]=descriptor.family;
  }
  const update=time=>{
    const state=motion.atTime(time);blocks.wheel.rotation.z=state.wheelAngle;blocks.bar.rotation.z=state.barAngle;
    blocks.movingPawl.position.set(...state.B.pivot,0);blocks.movingPawl.rotation.z=state.angleB;
    blocks.holdingPawl.position.set(...p.PH,0);blocks.holdingPawl.rotation.z=state.angleH;
    blocks.rod.position.set(...state.rodPosition,0);blocks.rod.rotation.z=state.rodAngle;root.userData.kinematics=state;
  };
  root.userData={parts,families,blocks,profile,motion,geometry:p,mass:profile.mass,stateAtTime:motion.atTime,
    mechanism:'reciprocating-rod-vibrating-pawl-ratchet-index',fidelity:'authored',reconstructionStatus:'rebuilt',
    hideGround:true,cameraFov:8,
    // Brown's plate framing: the swept mechanism with rod C to his crop.
    cameraFitBounds:new THREE.Box3(new THREE.Vector3(-1.1018,-1.5175,-.24),new THREE.Vector3(1.0314,1.0278,.173)),fullCameraDirection:new THREE.Vector3(0,0,10),
    shadowCameraHalfExtent:2.5,shadowBias:-.00003,shadowNormalBias:.005,
    animationTiming:{authoredCyclePeriod:p.period},minimumDisplayCycleSeconds:p.period,
    idealConstraints:'Rod C swings on an ordinary round pin in the bar. The prescribed bar stroke includes overtravel; the wheel and both pawls respond continuously to gravity, inertia, bearing damping and an opposing output load. The holding pawl drops after the crest clears, then the wheel settles against it. The regular 34-tooth profile reconstructs the unevenly drawn engraving.'};
  update(0);markShadows(root);return{root,update,motion,cameraDirection:new THREE.Vector3(0,0,10)};
}
