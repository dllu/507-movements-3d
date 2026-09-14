import * as THREE from 'three';
import {makeReverseThreadProfile} from './profile.js';
import {reverseThreadLands} from './groove.js';
import {reverseThreadShoe} from './shoe.js';
import {plate,poly,circle,disk,ring,polygonClipping as clip} from '../finite-plate-geometry.js';
import {roundedRackGear} from '../coaxial-gear-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
const rect=(l,b,r,t)=>poly([[l,b],[r,b],[r,t],[l,t]]),alongY=g=>g.rotateX(-Math.PI/2);
export {THREE};
export function makeReverseThreadGeometry(options={}) {
 const f=makeReverseThreadProfile(options),e=f.source.edges,root=new THREE.Group(),parts={},families={},blocks={};
 const add=(name,g,family,color)=>{if(!blocks[family]){blocks[family]=new THREE.Group();root.add(blocks[family]);}const m=new THREE.Mesh(g,matte(color,{metalness:.12,roughness:.62}));m.name=name;blocks[family].add(m);parts[name]=m;families[name]=family;return m;};
 const lands=reverseThreadLands(f);add('lands',lands.geometry,'input',PALETTE.driver);
 // Distinguish the recessed finish so both branches remain legible at a crossing.
 add('floor',alongY(ring(f.shaftRadius,f.floor,f.bottom,f.ceiling,256)),'input',new THREE.Color(PALETTE.driver).multiplyScalar(.45));
 add('shaft',alongY(disk(f.shaftRadius,f.y(f.source.shaftEnds[1]),f.y(f.source.shaftEnds[0]),128)),'input',PALETTE.driver);
 const gearOuter=(e.gearRight-e.gearLeft)/200,teeth=76,module=gearOuter/(teeth/2+1),gear=roundedRackGear({teeth,module,depth:(e.gearBottom-e.gearTop)/100,boreRadius:f.shaftRadius,samples:64,cutterSteps:1024});
 add('gear',alongY(gear).translate(0,f.y((e.gearTop+e.gearBottom)/2),0),'input',PALETTE.driver);
 for(const side of ['upper','lower']) {
  const outline=clip.difference(rect(f.x(e[side+'Left']),-.12,f.x(e[side+'Right']),.12),poly(circle([0,0],f.shaftRadius+.002,128)),poly(circle([f.guideX,0],f.guideRadius+.001,128)));
  add(side+'Rail',alongY(plate(outline,f.y(e[side+'Bottom']),f.y(e[side+'Top']))),'frame',PALETTE.frame);
 }
 add('guide',alongY(disk(f.guideRadius,f.y(f.source.guideEnds[1]),f.y(f.source.guideEnds[0]),128)).translate(f.guideX,0,0),'frame',PALETTE.frame);
 const half=(e.sliderBottom-e.sliderTop)/200,sliderSection=clip.difference(rect(f.x(e.sliderLeft),-.14,f.x(f.source.sliderRight),.14),poly(circle([f.guideX,0],f.guideRadius+.002,128)));
 add('slider',alongY(plate(sliderSection,f.initialY-half,f.initialY+half)),'follower',PALETTE.driven);
 const pivotX=-(f.radius+.09),arm=poly([[f.x(f.source.sliderRight)-.03,f.initialY-.085],[pivotX,f.initialY-.025],[pivotX,f.initialY+.025],[f.x(f.source.sliderRight)-.03,f.initialY+.085]]);
 add('arm',plate(arm,-.035,.035),'follower',PALETTE.driven);
 add('socket',ring(.0205,.031,-f.radius-.09,-f.radius-.025,64).rotateY(Math.PI/2).translate(0,f.initialY,0),'follower',PALETTE.driven);
 // Shoe coordinates use X tangent to the barrel, Y axial and Z radial.
 const shoe=reverseThreadShoe(f);add('shoe',shoe.geometry,'shoe',PALETTE.accent);
 add('spindle',disk(.019,f.shoeZ(0,1),f.radius+.085,64),'shoe',PALETTE.accent);
 Object.assign(root.userData,{source:f.source,profile:f,parts,families,blocks,collision:{lands:lands.cells,shoe:shoe.cells},angles:lands.angles,hideGround:true,shadowCameraHalfExtent:3,shadowBias:-.00002,shadowNormalBias:.001});
 blocks.shoe.position.y=f.initialY;blocks.shoe.quaternion.setFromEuler(new THREE.Euler(0,f.contactAngle,0)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),f.initialTilt));
 markShadows(root);root.updateMatrixWorld(true);
 return{root,focus:new THREE.Vector3(-.5,0,0),cameraDirection:new THREE.Vector3(1,1,10)};
}
