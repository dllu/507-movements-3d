import * as THREE from 'three';
import profile from '../data/reciprocating-pawl-profile.js';
import {makeReciprocatingPawlMotion} from './reciprocating-pawl-motion.js';
import {turnedClutchGeometry} from './clutch-section-geometry.js';
import {matte,markShadows} from './primitives.js';
import {backBar,footPillar,pinBoss} from './back-plate-support.js';

export function makeReciprocatingPawlRatchet(){
  const root=new THREE.Group(),parts={},families={},blocks={},motion=makeReciprocatingPawlMotion(profile),p=motion.parameters;
  for(const name of ['wheel','bar','movingPawl','holdingPawl','rod','fixed']){
    blocks[name]=new THREE.Group();root.add(blocks[name]);
  }
  for(const descriptor of profile.parts){
    const d=descriptor.shape;let geometry;
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
  // Brown draws no frame. The fixed wheel axle and the holding pawl's pin run
  // back to a plain back bar behind the wheel, carried on a pillar and foot
  // below the wheel (behind it in the plate's view).
  const zBack=-.26,[hx,hy]=p.PH??profile.parts.find(d=>d.name==='holdingPawlPin').position;
  const supports=new THREE.Group();supports.name='backBarSupports';
  supports.add(backBar([{x:hx,y:hy},{x:0,y:0}],{zFront:zBack,width:.14,role:'back-bar'}),
    pinBoss({x:0,y:0,radius:.088,zBack,zFront:-.24,role:'wheel-axle-boss'}),
    pinBoss({x:hx,y:hy,radius:.066,zBack,zFront:-.15,role:'holding-pawl-pin-boss'}),
    footPillar({x:0,yTop:0,yFloor:-1.6,z:zBack-.05,width:.2,footDepth:.4,role:'back-bar-pillar'}));
  blocks.fixed.add(supports);
  const update=time=>{
    const state=motion.atTime(time);blocks.wheel.rotation.z=state.wheelAngle;blocks.bar.rotation.z=state.barAngle;
    blocks.movingPawl.position.set(...state.B.pivot,0);blocks.movingPawl.rotation.z=state.angleB;
    blocks.holdingPawl.position.set(...p.PH,0);blocks.holdingPawl.rotation.z=state.angleH;
    blocks.rod.position.set(...state.rodPosition,0);blocks.rod.rotation.z=state.rodAngle;root.userData.kinematics=state;
  };
  root.userData={parts,families,blocks,profile,motion,geometry:p,mass:profile.mass,stateAtTime:motion.atTime,
    mechanism:'reciprocating-rod-vibrating-pawl-ratchet-index',fidelity:'authored',reconstructionStatus:'rebuilt',
    hideGround:true,cameraFov:8,fullCameraDirection:new THREE.Vector3(0,0,10),
    shadowCameraHalfExtent:2.5,shadowBias:-.00003,shadowNormalBias:.005,
    animationTiming:{authoredCyclePeriod:p.period},minimumDisplayCycleSeconds:p.period,
    idealConstraints:'Rod C swings on an ordinary round pin in the bar. The prescribed bar stroke includes overtravel; the wheel and both pawls respond continuously to gravity, inertia, bearing damping and an opposing output load. The holding pawl drops after the crest clears, then the wheel settles against it. The regular 34-tooth profile reconstructs the unevenly drawn engraving.'};
  update(0);markShadows(root);return{root,update,motion,cameraDirection:new THREE.Vector3(0,0,10)};
}
