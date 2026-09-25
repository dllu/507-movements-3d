import * as THREE from 'three';
import {makePumpCatchWeightedCandidate} from './pump-catch-weighted-candidate.mjs';
import {makePumpCatchRearDriveCandidate} from './pump-catch-rear-drive.mjs';
import {pumpCatchRopeCenterline,pumpCatchRopeMesh} from './pump-catch-rope-mesh.mjs';
import {poly,circle,plate,disk,ring,turned,familyMass,polygonClipping as clip} from '../../src/simulation/finite-plate-geometry.js';
import {conformingPlateMesh} from '../../src/simulation/conforming-plate-mesh.js';
import {PALETTE,matte,markShadows} from '../../src/simulation/primitives.js';
export {THREE};

const rectangle=(x0,x1,z0,z1)=>poly([[x0,z0],[x1,z0],[x1,z1],[x0,z1]]);
const verticalPlate=(profile,bottom,top)=>conformingPlateMesh(plate(profile,-top,-bottom)).rotateX(Math.PI/2);
const verticalCylinder=(radius,bottom,top)=>disk(radius,-top,-bottom,96).rotateX(Math.PI/2);

// The source stops at the rope. Hidden winding width, cable clamp, sliding
// crosshead and rod guides complete the driven output without inventing pump
// internals. These parts are a separate candidate pending loaded qualification.
export function makePumpCatchCompleteCandidate(){
  const model=makePumpCatchRearDriveCandidate({model:makePumpCatchWeightedCandidate({headBackDepth:.1,heelStop:true})}),u=model.root.userData,s=u.source,
    radius=(s.center[0]-s.visibleRope.x)/s.scale,ropeRadius=s.visibleRope.width/(2*s.scale),ropeLength=4.75,z=-.49,
    bedRadius=radius-ropeRadius,renderBedRadius=bedRadius-.000003,segments=1024,
    floor=(s.center[1]-s.base.top)/s.scale,bottom=(s.center[1]-s.base.bottom)/s.scale,
    baseLeft=(s.base.left-s.center[0])/s.scale,baseRight=(s.base.right-s.center[0])/s.scale;
  const add=(name,geometry,family,color=PALETTE.muted,position=[0,0,0],group=u.blocks[family])=>{
    const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.2,roughness:.58}));mesh.name=name;mesh.position.fromArray(position);
    group.add(mesh);u.parts[name]=mesh;u.families[name]=family;return mesh;
  };
  add('ropeWindingRim',turned([[-.64,1.17],[-.64,1.35],[-.60,1.35],[-.60,renderBedRadius],[-.28,renderBedRadius],[-.28,1.17]],segments),'wheel',PALETTE.driven);
  add('wheelRopeClamp',plate(rectangle(-radius-ropeRadius-.006,-bedRadius-.002,0,.10),-.60,-.41),'wheel',PALETTE.driven);

  // The moving crosshead passes through a real opening in the otherwise solid
  // plinth. Merge its rear extension so the opening has a continuous boundary.
  const old=u.parts.rearBaseExtension;old.removeFromParent();old.geometry.dispose();old.material.dispose();delete u.parts.rearBaseExtension;delete u.families.rearBaseExtension;
  const passage=rectangle(-radius-.325,-radius+.325,-.63,.16),baseProfile=clip.difference(rectangle(baseLeft,baseRight,-1.43,.60),passage);
  u.parts.basePlinth.geometry.dispose();u.parts.basePlinth.geometry=verticalPlate(baseProfile,bottom,floor);
  const pump=new THREE.Group();model.root.add(pump);u.blocks.pump=pump;
  const crosshead=clip.difference(rectangle(-.31,.31,-.12,.12),...[-.25,.25].map(x=>poly(circle([x,0],.03,96))));
  add('pumpCrosshead',verticalPlate(crosshead,-.16,0),'pump',PALETTE.brass);
  add('pumpOutputRod',verticalCylinder(.035,-3.35,-.16),'pump');
  add('ropeLoadFerrule',ring(ropeRadius+.001,.085,-.12,0,96).rotateX(Math.PI/2),'pump',PALETTE.brass);
  const lowerTop=-ropeLength-.16;
  add('pumpLowerBed',verticalPlate(clip.difference(rectangle(-.46,.46,-.18,.18),poly(circle([0,0],.045,96))),-5.05,lowerTop),'fixed',PALETTE.muted,[-radius,0,z]);
  add('pumpBarrelGland',ring(.045,.25,5.05,5.12,96).rotateX(Math.PI/2),'fixed',PALETTE.muted,[-radius,0,z]);
  add('pumpBarrel',ring(.045,.19,5.12,8.2,96).rotateX(Math.PI/2),'fixed',PALETTE.muted,[-radius,0,z]);
  add('pumpBarrelFoot',disk(.25,8.2,8.32,96).rotateX(Math.PI/2),'fixed',PALETTE.muted,[-radius,0,z]);
  for(const [name,x]of [['Left',-.25],['Right',.25]])add('pumpGuide'+name,verticalCylinder(.025,lowerTop,-1.90),'fixed',PALETTE.muted,[-radius+x,0,z]);
  const topProfile=clip.difference(rectangle(-radius-.43,-radius+.43,-.65,-.30),rectangle(-radius-.085,-radius+.085,z-ropeRadius-.0225,.20));
  add('pumpGuideCrossbar',verticalPlate(topProfile,-1.90,-1.75),'fixed');
  for(const [name,x]of [['Left',-.40],['Right',.40]])add('pumpGuidePillar'+name,verticalCylinder(.022,floor,-1.75),'fixed',PALETTE.muted,[-radius+x,0,z]);
  // Two stout hangers continue the pillar lines from the crossbar down to the
  // lower bed, so the bed and the pump barrel under it are carried by the
  // frame rather than by the thin guide rods alone. They stand outside the
  // crosshead's width.
  for(const [name,x]of [['Left',-.40],['Right',.40]])add('pumpBarrelHanger'+name,verticalCylinder(.04,lowerTop,-1.90),'fixed',PALETTE.muted,[-radius+x,0,z]);

  const rope=add('pumpRope',new THREE.BufferGeometry(),'rope',0xb99b63,[0,0,0],model.root);
  rope.material.metalness=0;rope.material.roughness=.93;
  const pixels=new Uint8Array(128*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<128;x++){
    const shade=.82+.18*Math.cos(2*Math.PI*(x/128+3*y/64));pixels.set([255,241,208].map(c=>Math.round(c*shade)).concat(255),(y*128+x)*4);
  }
  const texture=new THREE.DataTexture(pixels,128,64,THREE.RGBAFormat);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.x=ropeLength/.11;texture.needsUpdate=true;rope.material.map=texture;
  const coreSetState=model.setState,setState=({pumpHeight=0,...state}={})=>{
    if(!Number.isFinite(pumpHeight))throw Error('Nonfinite pump height');
    const result=coreSetState(state);pump.position.set(-radius,pumpHeight-ropeLength,z);
    const centerline=pumpCatchRopeCenterline([result.wheelAngle,result.catchAngle+result.wheelAngle,pumpHeight],{radius,ropeLength,z});
    rope.geometry.dispose();rope.geometry=pumpCatchRopeMesh(centerline,{radius:ropeRadius});u.ropeCenterline=centerline;
    model.root.updateMatrixWorld(true);return u.state={...result,pumpHeight};
  };
  u.completeHardware={radius,ropeRadius,ropeLength,z,bedRadius,renderBedRadius,segments,loadMass:1,
    pumpVolume:familyMass(u.parts,u.families,'pump').volume,
    qualification:'Hidden winding rim, fixed cable clamp, pump crosshead, output rod, guide rails and lower bed are reconstruction assumptions. The pump is an ideal vertical slider with normalized mass 1; its density scales the actual moving volume. The rope is massless. The displayed winding bed is relieved by 3e-6 units for the polygonal rope sweep. Pump internals remain outside the source scope.'};
  u.completeHardware.pumpDensity=u.completeHardware.loadMass/u.completeHardware.pumpVolume;
  u.qualification='Complete hardware candidate. The added wheel mass requires fresh contact-derived dynamics and independent force, energy, clearance and source-view qualification.';
  // Contact audits can transform the rigid core without rebuilding a massless
  // rope mesh for every force row. Complete rendered poses always use setState.
  model.setRigidState=coreSetState;
  model.setState=setState;u.setState=setState;setState();markShadows(model.root);return model;
}
