import * as THREE from 'three';
import {loadBakedBundle,sampleBakedMotion} from './playback.js';
import {disposeObject3D} from '../dispose-model.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {turned} from '../finite-plate-geometry.js';
import {fanGovernorTrack as track} from '../mujoco-fan-governor/source.js';

// Brown draws a straight-sided trough with a concave dish inside. The baked
// ramps are replaced for display by one clean, smooth solid: a plain
// straight-sided trough whose flat rim stays below the arms over the whole
// lift range, and inside it a ring of two symmetric humps. Each hump's working
// flank is exactly the baked ramp (top = base + curvature*a^2) over the whole
// range the rollers use (a in [-0.84, -0.2]); its back flank mirrors it about
// the crest at a = -1, where no roller ever reaches, so the motion is unchanged.
// One hump per half turn, the second a half turn on (as the baked ramps);
// angle is measured as in fanGovernorTrackCells.
export function fanGovernorTubTop(angle,crestAngle=-1){
 const g=track,a=((angle+2.2)%Math.PI+Math.PI)%Math.PI-2.2;
 return a<=0&&a>=2*crestAngle?g.base+g.curvature*Math.min(a*a,(a-2*crestAngle)**2):g.base;
}
export function fanGovernorTubGeometry(n=720){
 const g=track,rIn=g.radius-g.halfWidth,rOut=g.radius+g.halfWidth,bottom=g.foundation-.12;
 const hump=fanGovernorTubTop;
 const positions=[],indices=[];
 const strip=(pointAt)=>{// rows of (n+1) x 2 vertices, closed in angle
  const start=positions.length/3;
  for(let i=0;i<=n;i++){const angle=2*Math.PI*i/n;for(let j=0;j<2;j++)positions.push(...pointAt(angle,j));}
  for(let i=0;i<n;i++){const a=start+2*i,b=a+2;indices.push(a,b,a+1,a+1,b,b+1);}
 };
 const at=(r,angle,y)=>[r*Math.cos(angle),y,-r*Math.sin(angle)];
 const top=angle=>hump(angle);
 strip((angle,j)=>at(j?rIn:rOut,angle,top(angle)));// top surface
 strip((angle,j)=>at(rOut,angle,j?top(angle):bottom));// outer wall
 strip((angle,j)=>at(rIn,angle,j?bottom:top(angle)));// inner wall
 strip((angle,j)=>at(j?rOut:rIn,angle,bottom));// underside (closes the solid)
 const ring=new THREE.BufferGeometry();ring.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));ring.setIndex(indices);ring.computeVertexNormals();
 // Plain trough: floor, straight outer wall and flat rim, clear of the ring.
 const rim=Math.min(-.42,g.base+.13),outerR=rOut+.09;
 const trough=new THREE.LatheGeometry([[.37,g.foundation],[.37,bottom],[outerR,bottom],[outerR,rim],[rOut+.006,rim],[rOut+.006,g.foundation],[.37,g.foundation]].map(p=>new THREE.Vector2(...p)),192);
 const hub=new THREE.LatheGeometry([[.131,-1.45],[.38,-1.45],[.38,-1.15],[.131,-1.15],[.131,-1.45]].map(p=>new THREE.Vector2(...p)),96);
 return {ring,trough,hub,rim};
}
export function makeFanGovernorModel(bundle){
 const root=new THREE.ObjectLoader().parse(bundle.object),names=['shaft','crosshead','roller0','roller1','collar','lever'];
 const blocks=Object.fromEntries(names.map(name=>[name,root.getObjectByName('body:'+name)]));
 const bounds=new THREE.Box3(new THREE.Vector3(...bundle.bounds.min),new THREE.Vector3(...bundle.bounds.max));let disposed=false;
 // Brown draws the ramps' dish as one symmetric concave arc with a roller at
 // each upper corner. The periodic loop is displayed from the moment the two
 // ramp crests stand at the silhouette edges, 0.26 s after the recorded start;
 // the crosshead then lags about half a radian, so the fans are slightly turned.
 const displayTimeOffset=0.26;
 {const tub=fanGovernorTubGeometry(),driver=blocks.shaft.children.filter(o=>{if(!o.isMesh)return false;o.geometry.computeBoundingBox();return o.geometry.boundingBox.max.x>1;});
  const material=driver[0]?.material;
  for(const mesh of driver){mesh.geometry.dispose();blocks.shaft.remove(mesh);}
  if(material)for(const [name,geometry]of Object.entries(tub)){if(!geometry.isBufferGeometry)continue;const mesh=new THREE.Mesh(geometry,material);mesh.name='tub-'+name;mesh.castShadow=mesh.receiveShadow=true;blocks.shaft.add(mesh);}}
 // Brown caps the bulb's neck above the collar with a stepped finial and a
 // small knob. It is turned on the neck (one solid with the bulb carrier),
 // closing the bore; the spindle, which only has to stay inside the
 // carrier's bore, now ends below the neck top at the lowest lift instead
 // of standing bare above the collar.
 {const carrier=blocks.crosshead.children.find(o=>o.isMesh),spindle=blocks.shaft.children.find(o=>o.isMesh&&!o.name);
  if(carrier&&spindle){
   const neckTop=3.1,spindleTop=2.75,p=spindle.geometry.attributes.position;
   for(let i=0;i<p.count;i++)if(p.getY(i)>spindleTop)p.setY(i,spindleTop);
   p.needsUpdate=true;spindle.geometry.computeBoundingBox();spindle.geometry.computeBoundingSphere();
   const steps=turned([[neckTop,0],[neckTop,.25],[neckTop+.07,.25],[neckTop+.07,.2],[neckTop+.13,.2],[neckTop+.13,.15],[neckTop+.19,.15],[neckTop+.19,.055],[neckTop+.31,.055],[neckTop+.31,0]],192).rotateX(-Math.PI/2);
   steps.deleteAttribute('color');
   const knob=new THREE.SphereGeometry(.1,48,24).translate(0,neckTop+.38,0).toNonIndexed();knob.deleteAttribute('uv');
   const finial=new THREE.Mesh(mergeGeometries([steps,knob]),carrier.material);steps.dispose();knob.dispose();
   finial.name='bulb-neck-finial';finial.castShadow=finial.receiveShadow=true;blocks.crosshead.add(finial);
  }}
 // Brown breaks the regulating lever off at its fulcrum and draws no stand
 // for it (p60 support policy): the baked fixed body's small rear bracket
 // at the lever's fulcrum is dropped, leaving only the fulcrum pin through
 // the lever's end. The shaft's lower bearing stays.
 for(const mesh of root.getObjectByName('body:fixed')?.children??[]){
  const geometry=mesh.geometry;if(!mesh.isMesh||geometry.index)continue;
  geometry.computeBoundingBox();if(geometry.boundingBox.max.x<2||geometry.boundingBox.min.x>2)continue;
  const keep=[];for(const [name,attribute]of Object.entries(geometry.attributes))keep.push([name,attribute,[]]);
  const position=geometry.attributes.position;
  for(let t=0;t<position.count;t+=3){if(Math.min(position.getX(t),position.getX(t+1),position.getX(t+2))>2)continue;
   for(const [,attribute,out]of keep)for(let k=0;k<3;k++)for(let c=0;c<attribute.itemSize;c++)out.push(attribute.array[(t+k)*attribute.itemSize+c]);}
  for(const [name,attribute,out]of keep)geometry.setAttribute(name,new THREE.Float32BufferAttribute(out,attribute.itemSize));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
 }
 root.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])m.fog=false;});
 const update=time=>{
  if(disposed)throw new Error('Movement disposed');
  const [shaft,lift,yaw,roll0,roll1]=sampleBakedMotion(bundle,time+displayTimeOffset);
  blocks.shaft.rotation.y=shaft;blocks.crosshead.position.y=lift;blocks.crosshead.rotation.y=yaw;
  blocks.roller0.rotation.x=roll0;blocks.roller1.rotation.x=roll1;
  blocks.collar.position.y=lift;blocks.lever.rotation.z=-Math.atan2(lift,3);
  root.updateMatrixWorld(true);root.userData.state={time,shaft,lift,yaw,roll0,roll1};
 };
 Object.assign(root.userData,{blocks,mechanism:'air-drag-fan-inclined-plane-governor',simulationBackend:'baked-mujoco',fidelity:'authored',reconstructionStatus:'candidate',supportsRestart:true,hideGround:true,cameraFov:12,cameraFitBounds:bounds,sampledMotionBounds:bundle.bounds,
  animationTiming:{authoredCyclePeriod:bundle.period,displayCycleDuration:bundle.period,playbackTimeScale:1},displayTimeOffset,
  reconstructionNote:'Air drag retards the heavy fan carrier, causing its rollers to climb the rotating ramps. Motion is baked from passive contact dynamics. Ramp curvature, depths, drag and uniform density are reconstructed. The collar and slotted regulating lever follow the lift without a valve load.'});
 // The finial rides above the recorded bodies' bounds: frame it too.
 {const finial=blocks.crosshead.getObjectByName('bulb-neck-finial');
  if(finial)for(let i=0;i<=128;i++){update(bundle.period*i/128);bounds.union(new THREE.Box3().setFromObject(finial,true));}}
 update(0);return {root,update,reset:()=>update(0),focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(0,0,1),dispose:()=>{if(!disposed){disposed=true;disposeObject3D(root);}}};
}
export async function makeBakedFanGovernor(){return makeFanGovernorModel(await loadBakedBundle(new URL('./assets/147.json.gz',import.meta.url)));}
