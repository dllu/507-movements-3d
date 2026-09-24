import * as THREE from 'three';
import {endlessRackProfile} from './profile.js';
import {plate,poly,circle,ring,disk,capsule,polygonClipping as clip} from '../finite-plate-geometry.js';
import {convexPlateCells} from '../mujoco/convex-plate.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import source from './source.js';
export {THREE};
export function makeEndlessRackGeometry(options={}){
 const f=endlessRackProfile(options),root=new THREE.Group(),parts={},families={},blocks={},cells={},axis=source.axis;
 const local=([x,y])=>[(x-axis[0])/100,(axis[1]-y)/100];
 for(const n of ['pinion','carrier','rack','fixed']){blocks[n]=new THREE.Group();root.add(blocks[n]);}
 const add=(n,g,family,color)=>{const mesh=new THREE.Mesh(g,matte(color,{metalness:.18,roughness:.55}));mesh.name=n;blocks[family].add(mesh);parts[n]=mesh;families[n]=family;return mesh;};
 f.rackOffset=options.rackOffset??source.rackOffset;if(!Number.isFinite(f.rackOffset)||Math.abs(f.rackOffset)>f.L)throw new RangeError('Invalid 119 initial rack position');f.phase=(.5-f.offset)*f.pitch/f.R+f.rackOffset/f.R;
 f.gear.scale(1,1,5/6);f.gear.rotateZ(f.phase);add('pinion',f.gear,'pinion',PALETTE.driver);add('shaft',disk(.09,-.10,.61,96),'pinion',PALETTE.ink);add('hub',ring(.09,.12803199,.10,.18,96),'pinion',PALETTE.driver);
 const holes=[[[158.001129251,300.20837447],.06475987],[[159.500196849,335.53392572],.06553978],[[373.170994793,305.030245396],.06628982],[[371.315153254,334.620062139],.06049939]];
 const holesLocal=holes.map(([p,r])=>{const q=local(p);q[0]-=f.rackOffset;return poly(circle(q,r,64));});
 add('rack',plate(clip.difference(f.body,...holesLocal),-.12,.12),'rack',PALETTE.driven);
 // The hidden shank has a flattened rear mounting seat. Its flat face meets
 // the rack rear with finite area; the two solids have disjoint interiors.
 const rodRadius=.145,rodZ=-.24,cut=Math.asin((-.12-rodZ)/rodRadius),section=new THREE.Shape();
 section.absarc(-.015,rodZ,rodRadius,Math.PI-cut,2*Math.PI+cut,false);section.closePath();
 const rod=new THREE.ExtrudeGeometry(section,{depth:5.06,bevelEnabled:false,curveSegments:64});
 rod.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0)));
 rod.translate((261-axis[0])/100-2.53-f.rackOffset,0,0);add('rod',rod,'rack',PALETTE.driven);
 const guide=clip.difference(poly([[241.7482,168.26],[297.3911,168.26],[297.3911,440.04],[241.7482,440.04]].map(local)),capsule([0,-f.H],[0,f.H],.1074545,64));
 add('guide',plate(guide,.24,.40),'fixed',PALETTE.frame);
 f.journalRadius=.105;add('journal',ring(.0908,f.journalRadius,.18,.46,96),'carrier',PALETTE.brass);
 for(const [name,pixels]of [['topBeam',[[65,120],[465,120],[459,137],[467,168],[77,170],[67,153],[75,141]]],['bottomBeam',[[81,441],[458,439],[448,456],[454,482],[77,484],[83,463],[88,456]]]])add(name,plate(poly(pixels.map(local)),.21,.43),'fixed',PALETTE.frame);
 blocks.pinion.position.y=blocks.carrier.position.y=f.H;blocks.rack.position.x=f.rackOffset;
 for(const n of ['pinion','rack']){const c=convexPlateCells(parts[n].geometry);cells[n]=c.cells.map(p=>[c.low,c.high].flatMap(z=>p.map(q=>[...q,z])));}
 const guideOutline=new THREE.LineSegments(new THREE.EdgesGeometry(parts.guide.geometry,20),new THREE.LineBasicMaterial({color:PALETTE.ink}));
 guideOutline.name='section-outline-of-front-guide';blocks.fixed.add(guideOutline);
 const setSectionView=enabled=>{root.userData.sectionView=Boolean(enabled);parts.guide.visible=!enabled;guideOutline.visible=Boolean(enabled);};
 Object.assign(root.userData,{source,parts,families,blocks,cells,profile:f,hideGround:true,shadowCameraHalfExtent:6,shadowNormalBias:.01,shadowBias:-.00002,setSectionView});setSectionView(true);
 markShadows(root);root.updateMatrixWorld(true);const bounds=new THREE.Box3();for(const x of [-f.L-f.H,f.L+f.H])for(const y of [-f.H,f.H]){blocks.rack.position.x=x;blocks.pinion.position.y=blocks.carrier.position.y=y;root.updateMatrixWorld(true);for(const [n,mesh]of Object.entries(parts))if(n!=='rod')bounds.union(new THREE.Box3().setFromObject(mesh,true));}blocks.rack.position.x=f.rackOffset;blocks.pinion.position.y=blocks.carrier.position.y=f.H;root.updateMatrixWorld(true);bounds.expandByScalar(.05);root.userData.sampledMotionBounds={min:bounds.min.toArray(),max:bounds.max.toArray()};
 // Brown draws the whole toothed rack body; only its end rods and the beams
 // are broken off at the plate edges. Fit the rack body's full sweep (the
 // rods are excluded above) so it never leaves the frame.
 root.userData.cameraFitBounds=bounds.clone();
 // Brown draws the endless rack and its guides as a flat elevation and
 // breaks the rack's rod off at both edges, so the fit follows the rack and
 // beams while the long rod ends may leave the frame.
 return{root,focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(.02,.01,1)};
}
