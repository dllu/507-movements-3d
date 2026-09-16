import * as THREE from 'three';
import profiles from './baked/reversing-transmission-profiles.js';
import {radialToothGeometry} from './star-mangle-geometry.js';
import {plate,poly,capsule,sector,polygonClipping as clip} from './finite-plate-geometry.js';

const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
function pinionProfile(mesh,outline,depth){
 mesh.userData.sourceOutline=outline;
 replace(mesh,new THREE.ExtrudeGeometry(new THREE.Shape(outline.map(p=>new THREE.Vector2(...p))),
  {depth,bevelEnabled:false,steps:1,curveSegments:1}).translate(0,0,-depth/2));
}
// Split the connected bar at its median plane, retaining two genuine finite
// working faces and the original front/rear mesh placements. No hidden cutters
// or coincident full bars remain in the scene.
function halfBar(profile,side){
 const full=radialToothGeometry(profile).toNonIndexed(),p=full.attributes.position,n=full.attributes.normal,positions=[],normals=[];
 for(let i=0;i<p.count;i+=3){
  if([0,1,2].some(j=>side*p.getZ(i+j)<-1e-9))continue;
  for(let j=0;j<3;j++){positions.push(p.getX(i+j),p.getY(i+j),p.getZ(i+j));normals.push(n.getX(i+j),n.getY(i+j),n.getZ(i+j));}
 }
 const h=profile.heights,r=profile.radii,k=profile.angularSamples/2;
 for(let i=0;i+1<r.length;i++){
  const v=[[r[i],h[i][0],0],[r[i],-h[i][k],0],[r[i+1],-h[i+1][k],0],[r[i+1],h[i+1][0],0]];
  for(const j of side>0?[0,2,1,0,3,2]:[0,1,2,0,2,3]){positions.push(...v[j]);normals.push(0,0,-side);}
 }
 full.dispose();
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
 geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData={profileType:'finite-two-face-cutter-bar',side};return geometry;
}
export function installMangle371Profiles(root){
 const d=root.userData,g=d.geometry,b=d.blocks,data=profiles[371];
 pinionProfile(b.pinion.userData.rotor.children[0],data.outline,g.pinionDepth);
 // The old solid median annulus occupied the pinion addendum's path. Connected
 // inner/outer rails support both faces without filling the working tooth gaps.
 replace(b.wheelBody,plate(clip.union(sector(1.30,1.44,g.firstTerminalAngle,g.secondTerminalAngle,144),sector(1.99,2.08,g.firstTerminalAngle,g.secondTerminalAngle,144)),-.06,.06));
 const geometries=new Map();
 for(const[teeth,side]of[[b.frontFaceTeeth,1],[b.rearFaceTeeth,-1]])for(let i=0;i<teeth.length;i++){
  const key=`${i===0?0:i===teeth.length-1?2:1}/${side}`;
  if(!geometries.has(key))geometries.set(key,halfBar(data.profiles[Number(key[0])],side).translate(-g.toothCenterRadius,0,-side*g.faceToothOffset));
  replace(teeth[i],geometries.get(key));
 }
 d.finiteToothProfiles={generator:'scripts/generate-reversing-transmission-profiles.mjs',kind:'two-face-radial-bars',data};
}
export function installParsons394Profiles(root){
 const d=root.userData,g=d.geometry,b=d.blocks,r=b.rackCarrier.userData,pinion=b.outputRotor.userData.pinion,data=profiles[394];
 pinionProfile(pinion,data.outline,.40);pinion.rotation.z=data.mountingPhase;
 for(let i=0;i<r.teeth.length;i++){
  const tooth=r.teeth[i],matrix=new THREE.Matrix4().compose(new THREE.Vector3(tooth.position.x,tooth.position.y,0),tooth.quaternion,tooth.scale).invert();
  replace(tooth,plate(poly(data.teeth[i]),-.17,.17).applyMatrix4(matrix));
 }
 replace(r.outerRim,plate(clip.difference(capsule([-g.rackHalfStraight,0],[g.rackHalfStraight,0],g.rackPitchHalfHeight+.48,96),capsule([-g.rackHalfStraight,0],[g.rackHalfStraight,0],g.rackPitchHalfHeight+.135,96)),-.12,.18));
 d.finiteToothProfiles={generator:'scripts/generate-reversing-transmission-profiles.mjs',kind:'phased-stadium-rack',data};
}
