import * as THREE from 'three';
import {plate,poly,circle,capsule,sector as wedge,polygonClipping as clip} from './finite-plate-geometry.js';
import {horizontalRing,horizontalPlate} from './horizontal-turbine-solids.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {bandInvoluteGear,involute} from './band-epicyclic-geometry.js';
import {hollowPipeBall} from './folding-joint-parts.js';
import {curvedPipeWall} from './finite-fluid-passages.js';
import {fitPistonGuide} from './piston-guide-parts.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
const add=(p,g,m,role)=>{const o=new THREE.Mesh(g,m);o.userData.role=role;p.add(o);return o;};
function gear(r,n,depth,bore){const alpha=25*Math.PI/180,module=2*r/n;return bandInvoluteGear({teeth:n,baseRadius:r*Math.cos(alpha),baseHalfAngle:Math.PI/(2*n)+involute(1/Math.cos(alpha))-.001/(2*r),rootRadius:r-1.1*module,tipRadius:r+.7*module,boreRadius:bore,depth,flankSamples:24});}
// A rod-attached spherical eye needs a stable roll frame: the shortest X-to-rod
// rotation can twist its throat into the stud on the spatial diaphragm linkage.
function socketLink(link,length,offset,spatial=false){
 const [beam,start,end]=link.children;start.visible=false;end.visible=false;
 replace(beam,new THREE.BoxGeometry(length-.24,.075,.08));
 const sockets=[0,1].map(()=>add(link,hollowPipeBall(spatial?.13:.145,.105,spatial?.098:.085,64).rotateY(-Math.PI/2),beam.material,'finite-spherical-link-eye'));
 const balls=[0,1].map(()=>add(link,new THREE.SphereGeometry(.10,48,32),beam.material,'captured-link-joint-ball'));
 link.userData.workingSockets=sockets;link.userData.workingBalls=balls;
 link.userData.setEndpoints=(a,b)=>{start.position.copy(a);end.position.copy(b);const direction=b.clone().sub(a).normalize(),side=new THREE.Vector3(-direction.y,direction.x,0).normalize(),q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(direction,side,new THREE.Vector3().crossVectors(direction,side)));beam.position.copy(a).add(b).multiplyScalar(.5);beam.position.z+=offset;beam.quaternion.copy(q);beam.scale.set(1,1,1);for(let i=0;i<2;i++){sockets[i].position.copy(i?b:a);sockets[i].position.z+=offset;sockets[i].quaternion.copy(q);balls[i].position.copy(sockets[i].position);}};
}

// Closed annular strip walls, updated in place; the free end is sealed by its cap.
function hollowStrip(branch){
 const n=branch.userData.segmentCount,count=n+1,positions=new Float32Array(count*8*3),indices=[];
 for(let i=0;i<n;i++)for(let j=0;j<4;j++){
  const a=i*8+j,b=(i+1)*8+j,c=(i+1)*8+(j+1)%4,e=i*8+(j+1)%4;
  indices.push(a,c,b,a,e,c,a+4,b+4,c+4,a+4,c+4,e+4);
 }
 for(const[end,reverse]of[[0,true],[n,false]])for(let j=0;j<4;j++){
  const a=end*8+j,b=end*8+(j+1)%4,c=b+4,e=a+4;
  indices.push(...(reverse?[a,c,b,a,e,c]:[a,b,c,a,c,e]));
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);replace(branch,geometry);
 branch.userData.hollowSection={outer:[.27,.144],inner:[.19,.080]};
 branch.userData.setCenterline=points=>{
  for(let i=0;i<count;i++){
   const t=points[Math.min(n,i+1)].clone().sub(points[Math.max(0,i-1)]).normalize(),normal=new THREE.Vector3(-t.y,t.x,0);
   for(let k=0;k<8;k++){const inner=k>=4,j=k%4,w=inner?.095:.135,h=inner?.040:.072,p=points[i].clone().addScaledVector(normal,([0,3].includes(j)?1:-1)*w);p.z+=(j<2?1:-1)*h;p.toArray(positions,(i*8+k)*3);}
  }
  geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();branch.userData.centerlinePoints=points.map(p=>p.clone());
 };
}

export function correctElasticGaugeParts(root,id,update){
 const d=root.userData,b=d.blocks,g=d.geometry,bourdon=id===499;
 // The diaphragm rod lies behind the gears. Moving the gear pair together
 // preserves its ratio while keeping both short input studs clear of the pinion.
 const gearOffset=bourdon?0:.20,z=g.pinionCenter.z-g.sectorPivot.z+gearOffset,depth=.16;
 const teeth=d.transmission.sectorEquivalentTeeth,n=d.transmission.pinionTeeth;
 const full=gear(g.sectorPitchRadius,teeth,depth,.084),phase=Math.PI/2;
 const outline=full.userData.outline.map(p=>[p.x*Math.cos(phase)-p.y*Math.sin(phase),p.x*Math.sin(phase)+p.y*Math.cos(phase)]);
 const maximum=d.stateAtTime(g.cycleDuration/2).sectorAngle;
 const pins=bourdon?[d.linkage.leftSectorPinLocal,d.linkage.rightSectorPinLocal]:[d.linkage.sectorInputPinLocal];
 const profile=clip.difference(clip.union(clip.intersection(poly(outline),wedge(g.sectorPitchRadius-.13,g.sectorPitchRadius*1.2,Math.PI/2-maximum-.30,Math.PI/2+.30,96)),capsule([0,0],[(g.sectorPitchRadius-.13)*Math.cos(Math.PI/2-maximum-.20),(g.sectorPitchRadius-.13)*Math.sin(Math.PI/2-maximum-.20)],.075,24),...pins.map(p=>capsule([0,0],[p.x,p.y],.095,24)),poly(circle([0,0],.16,64))),poly(circle([0,0],.084,64)),...pins.map(p=>poly(circle([p.x,p.y],.039,48))));
 replace(b.sectorRim,plate(profile,z-depth/2,z+depth/2));b.sectorRim.rotation.set(0,0,0);full.dispose();for(const o of b.sectorTeeth)o.visible=false;
 for(const o of bourdon?[b.leftSectorArm,b.rightSectorArm]:[b.sectorInputArm])o.visible=false;
 replace(b.sectorHub,new THREE.CylinderGeometry(.08,.08,.65,48));b.sectorHub.position.z=z;
 const rotor=b.pinion.userData.rotor;for(const o of rotor.children)o.visible=false;
 const pinionGeometry=gear(g.pinionPitchRadius,n,depth,.060);pinionGeometry.rotateZ(-Math.PI/2+Math.PI/n).translate(0,0,gearOffset);
 b.workingPinion=add(rotor,pinionGeometry,b.sectorHub.material,'finite-involute-pointer-pinion');
 b.pinionShaft=add(root,new THREE.CylinderGeometry(.056,.056,.55,48),b.sectorHub.material,'fixed-journal-through-pointer-pinion');b.pinionShaft.rotation.x=Math.PI/2;b.pinionShaft.position.copy(g.pinionCenter);b.pinionShaft.position.z+=.05+gearOffset;
 b.sectorInputPins=pins.map(p=>{const o=add(b.sector,new THREE.CylinderGeometry(.035,.035,.40,40),b.sectorHub.material,'finite-sector-input-ball-stud');o.rotation.x=Math.PI/2;o.position.set(p.x,p.y,.13);return o;});
 if(bourdon){
  for(let i=0;i<2;i++){socketLink(b.links[i],i?d.linkage.rightLinkLength:d.linkage.leftLinkLength,.34);replace(b.tubeEndPins[i],new THREE.CylinderGeometry(.035,.035,.44,40).translate(0,.13,0));hollowStrip(b.tubeBranches[i]);replace(b.tubeCaps[i],new THREE.BoxGeometry(.075,.28,.16));}
  const curve=b.pressurePassage.geometry.parameters.path;replace(b.pressurePassage,curvedPipeWall(curve,.062,.10,96,24));
  replace(b.inletSocket,horizontalRing(.115,.31,-.64,.64,64));replace(b.inletCollar,horizontalRing(.115,.44,-.15,.15,64));
 }else{
  socketLink(b.connectingRod,d.linkage.connectingRodLength,.16,true);
  replace(b.diaphragmBoss,new THREE.CylinderGeometry(.035,.035,.20,40));
  const curve=b.inletPipe.geometry.parameters.path;replace(b.inletPipe,curvedPipeWall(curve,.145,.17,72,32));replace(b.inletCollar,horizontalRing(.255,.42,-.135,.135,64));
  // Pass 86: the inlet ran up through an open slot the full depth of the
  // chamber wall and ended under clamp ring A, touching it along a line. The
  // slot is now filled by a boss bored round for the pipe (0.17, centred on
  // the pipe at chamber z -0.05), and the pipe ends flush with the wall's
  // inner face, sealed in the bore.
  const port=[[-.18,-1.65],[.18,-1.65],[.18,-1.3],[-.18,-1.3]];
  const boss=horizontalPlate(clip.difference(poly([[-.18,-.26],[.18,-.26],[.18,.26],[-.18,.26]]),poly(circle([0,.05],.17,64))),-1.55,-1.47);
  // Its front edge carries an inner lip (r 1.40-1.48, 0.06 deep) in which
  // clamp ring A (tube 0.095 round r 1.34, 0.22 in front of the chamber's
  // mid-plane) is bedded; the ring had floated 0.045 clear of the wall.
  const lip=plate(clip.difference(poly(circle([0,0],1.48,128)),poly(circle([0,0],1.40,128))),.20,.26);
  replace(b.chamber,mergeGeometries([plate(clip.difference(poly(circle([0,0],1.55,128)),poly(circle([0,0],1.48,128)),poly(port)),-.26,.26),boss,lip].map(g=>{const n=g.index?g.toNonIndexed():g;for(const k of Object.keys(n.attributes))if(!['position','normal'].includes(k))n.deleteAttribute(k);return n;})));b.chamber.rotation.set(0,0,0);
  replace(b.chamberBack,new THREE.CylinderGeometry(1.55,1.55,.05,96).rotateX(Math.PI/2));
 }
 d.minimumDisplayCycleSeconds=g.cycleDuration;d.workingPartsReview={status:'bounded-geometry',residual:'Pressure history and elastic deformation remain prescribed; exact linkage closure is analytical. Elastic stress, hysteresis, backlash dynamics, friction, seals and pressure transients are not simulated.'};
 fitPistonGuide(root,update,g.cycleDuration);d.cameraDirection=new THREE.Vector3(1.4,1.0,15);
}
