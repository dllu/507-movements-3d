import * as THREE from 'three';
import {cylindricalWormGeometry} from './worm-gear-geometry.js';
import {makeInstancedWormWheel} from './instanced-worm-wheel.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {specialWormParameters} from './special-worm-parameters.js';
import {specialWormCuts} from '../data/special-worm-wheel-profiles.js';
export function makeSpecialWormWheel(id,boreRadius,material){
 const mesh=makeInstancedWormWheel(specialWormParameters[id],specialWormCuts[id],boreRadius,material);
 mesh.userData.profile='offline-synchronized-finite-worm-envelope';
 mesh.userData.clearance=specialWormCuts[id].clearance;return mesh;
}
// 202's Hindley worm: the straight V section of a long cylindrical worm is
// turned with the wheel radius at every point of the throat, then the solid is
// cut square at +-halfLength and closed by flat end faces round a straight bore.
function hindleyWormGeometry(p,halfLength,boreRadius){
 const virtualLength=2*p.pitchRadius*p.generatedEnvelopment;
 // Deep V thread (Brown's 202): explicit addendum/dedendum and flank angle.
 // Left-handed like the former integral worm: mirror, then the same net
 // quarter-turn phase that worm used.
 const module=p.wormPitch/Math.PI,tangent=Math.tan(p.pressureAngle),rootRadius=p.wormRadius-p.dedendum,tipRadius=p.wormRadius+p.addendum;
 const g=cylindricalWormGeometry({pitchRadius:p.wormRadius,module,length:virtualLength,pressureAngle:p.pressureAngle,angularSteps:128,rootRadius,tipRadius,
  rootHalfWidth:p.wormPitch/4+p.dedendum*tangent,tipHalfWidth:p.wormPitch/4-p.addendum*tangent});
 g.scale(1,-1,1);g.rotateZ(Math.PI/2);
 const pos=g.attributes.position,half=virtualLength/2,out=[],cut=[[],[]];
 // Cut square, the last partial turn would end in knife-edged sickles past
 // each end face. Run the thread out instead: over the last pitch before each
 // end its height above the root shrinks smoothly to zero, so each end face is
 // a clean root disc. The run-out scales the straight virtual worm's radius at
 // fixed (angle, axial position), where the thread is a radial graph, so the
 // mapped solid only loses material.
 const wheelRoot=p.pitchRadius+p.wormRadius-rootRadius,runOut=p.wormPitch;
 const runOutRadius=(r,z)=>{const t=Math.min(1,Math.max(0,(halfLength-Math.abs(wheelRoot*Math.sin(z/p.pitchRadius)))/runOut));return r<=rootRadius||t>=1?r:rootRadius+(r-rootRadius)*t*t*(3-2*t);};
 const map=v=>{const radial=Math.hypot(v.x,v.y),r=runOutRadius(radial,v.z),beta=v.z/p.pitchRadius,wheelRadius=p.pitchRadius+p.wormRadius-r,rho=p.distance-wheelRadius*Math.cos(beta);return new THREE.Vector3(v.x*rho/radial,v.y*rho/radial,wheelRadius*Math.sin(beta));};
 const clip=(poly,side)=>{const res=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=halfLength-side*a.z,db=halfLength-side*b.z;if(da>=0)res.push(a);if((da<0)!==(db<0)){const q=a.clone().lerp(b,da/(da-db));q.z=side*halfLength;res.push(q);}}return res;};
 for(let i=0;i<pos.count;i+=3){
  const v=[0,2,1].map(j=>new THREE.Vector3().fromBufferAttribute(pos,i+j));
  if(v.every(q=>Math.abs(Math.abs(q.z)-half)<1e-7)||v.every(q=>Math.hypot(q.x,q.y)<boreRadius+.002))continue;
  const poly=clip(clip(v.map(map),-1),1);
  for(let k=1;k<poly.length-1;k++)out.push(poly[0],poly[k],poly[k+1]);
  for(let k=0;k<poly.length;k++){const a=poly[k],c=poly[(k+1)%poly.length];
   if(Math.abs(Math.abs(a.z)-halfLength)<1e-9&&Math.abs(c.z-a.z)<1e-12)cut[a.z>0?1:0].push([a,c]);}
 }
 const hole=Array.from({length:48},(_,i)=>new THREE.Vector2(boreRadius*Math.cos(-i*Math.PI/24),boreRadius*Math.sin(-i*Math.PI/24)));
 if(THREE.ShapeUtils.isClockWise(hole))hole.reverse();
 for(const side of[0,1]){
  // Chain the clipped boundary edges on the cut plane into the section loop.
  const z=side?halfLength:-halfLength,key=q=>`${Math.round(q.x*1e7)},${Math.round(q.y*1e7)}`,next=new Map();
  for(const[a,c]of cut[side]){if(key(a)!==key(c))next.set(key(c),a);}
  const start=cut[side][0][1],outer=[];let at=start;
  for(let guard=0;guard<=next.size;guard++){outer.push(new THREE.Vector2(at.x,at.y));at=next.get(key(at));if(!at||key(at)===key(start))break;}
  const points=[...outer,...hole];
  for(const face of THREE.ShapeUtils.triangulateShape(outer,[hole])){
   const tri=face.map(k=>new THREE.Vector3(points[k].x,points[k].y,z));
   const normal=new THREE.Triangle(...tri).getNormal(new THREE.Vector3());if((normal.z>0)!==Boolean(side))tri.reverse();out.push(...tri);
  }
 }
 for(let i=0;i<hole.length;i++){const a=hole[i],b=hole[(i+1)%hole.length];
  const v=[new THREE.Vector3(a.x,a.y,-halfLength),new THREE.Vector3(a.x,a.y,halfLength),new THREE.Vector3(b.x,b.y,halfLength),new THREE.Vector3(b.x,b.y,-halfLength)];
  // Bore faces point toward the axis.
  const tri1=[v[0],v[1],v[2]],tri2=[v[0],v[2],v[3]];const n=new THREE.Triangle(...tri1).getNormal(new THREE.Vector3());const mid=a.clone().add(b).multiplyScalar(.5);
  if(n.x*mid.x+n.y*mid.y>0){tri1.reverse();tri2.reverse();}out.push(...tri1,...tri2);}
 const geometry=new THREE.BufferGeometry();geometry.setFromPoints(out);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 g.dispose();return geometry;
}
export function correctGloboidalWorm(root){
 const b=root.userData.blocks,p=specialWormParameters[202];
 // p93: Brown's worm shaft is a stout round shaft, about 0.09 of the wheel's
 // diameter (the old 0.084 radius read as a wire). Bore the worm for a 0.196
 // shaft; the worm's root (0.308 at its waist) keeps a 0.1 wall.
 const shaftRadius=.196,bore=shaftRadius+.004;
 const geometry=hindleyWormGeometry(p,p.wormLength/2,bore);
 b.wormThread.geometry.dispose();b.wormThread.geometry=geometry;b.wormThread.material.color.copy(b.wormBody.material.color);
 b.wormThread.userData.integralThread=true;b.wormThread.userData.boreRadius=bore;
 root.traverse(o=>{if(o.isMesh&&o.geometry.type==='CylinderGeometry'){let r=o;while(r&&!r.userData.role)r=r.parent;
  if(r?.userData.role==='fixed-center-input-shaft-keyed-to-globoidal-worm'){const q=o.geometry.parameters;o.geometry.dispose();o.geometry=new THREE.CylinderGeometry(shaftRadius,shaftRadius,q.height,48);}}});
 b.wormBody.visible=false;b.wormBody.userData.replacedByIntegralThread=true;
 const rotor=b.wheel.userData.rotor,old=rotor.children[0];
 const wheel=makeSpecialWormWheel(202,.107,old.material);old.removeFromParent();old.geometry.dispose();rotor.add(wheel);b.generatedWheel=wheel;
 rotor.children.find(m=>m.geometry?.type==='TorusGeometry')?.removeFromParent();
 const hub=rotor.children.find(m=>m.geometry?.type==='CylinderGeometry');
 const hp=hub.geometry.parameters;hub.geometry.dispose();hub.geometry=boredLatheGeometry([{radial:hp.radiusTop,axial:-hp.height/2},{radial:hp.radiusTop,axial:hp.height/2}],.107,64);hub.userData.boreRadius=.107;
 b.wheel.userData.toothProfile=wheel.userData.profile;
 for(const object of[b.baseRail,b.rearPost,b.wheelBearingBridge,...b.wormBearings,...b.wormBearingSupports])object.removeFromParent();
 for(const marker of b.contactMarkers)marker.removeFromParent();
 root.traverse(o=>{for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material)material.fog=false;});
 root.userData.hideGround=true;root.userData.materialsIgnoreSceneFog=true;
 root.userData.cameraFitBounds=new THREE.Box3(new THREE.Vector3(-2.55,-2.48,-.8),new THREE.Vector3(2.55,2.9,.8));
 root.userData.reconstructionNote='The single-start hourglass worm advances the 60-tooth wheel one tooth per turn. The concave form follows the engraving; thread section, working widths and shaft fits are reconstructed.';
 root.userData.contactQualification={method:'offline finite synchronized cutter envelope',loadedContactCount:'not established',clearance:specialWormCuts[202].clearance};
}
