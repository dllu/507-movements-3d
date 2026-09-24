import * as T from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { plate, poly, circle, polygonClipping as clip } from './finite-plate-geometry.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
const bore=(outer,inner,length)=>boredLatheGeometry([{axial:-length/2,radial:outer},{axial:length/2,radial:outer}],inner,64);
function box(parent,size,position,material,role){const o=new T.Mesh(new T.BoxGeometry(...size),material);o.position.set(...position);o.userData.role=role;parent.add(o);return o;}

export function correctRunnerTreadParts(root,id){
 const d=root.userData,b=d.blocks,g=d.geometry;
 if(id===375){
  for(const runner of b.edgeRunners){
   replace(runner.userData.stone,bore(g.runnerRadius,.089,g.runnerWidth));
   const hub=runner.userData.rotor.children.find(o=>o.userData.role==='edge-runner-bearing-hub');replace(hub,bore(g.runnerRadius*.15,.089,g.runnerWidth*1.34));
  }
  replace(b.inputBearing,bore(.16,.083,.34));replace(b.lowerBearing,bore(.18,.098,.36));b.lowerBearing.position.y=-1.58;
  replace(b.verticalShaft,new T.CylinderGeometry(.095,.095,3.84,32));b.verticalShaft.position.y=.22;
  // Closed trough retains the original working floor and slopes; underside
  // now reaches the foundation. The central hole remains open for the shaft.
  // Brown's pan is a basin whose outer wall flares outward to the lip.
  const profile=[[.60,-1.06],[.78,-1.40],[1.92,-1.40],[2.10,-1.06],[2.20,-1.06],[1.98,-1.76],[.52,-1.76],[.52,-1.06],[.60,-1.06]];
  replace(b.pan,new T.LatheGeometry(profile.reverse().map(p=>new T.Vector2(...p)),96));
  b.inputBearingSupport=box(b.upperFrame,[.25,.64,.50],[2.45,1.74,-.18],b.inputBearing.material,'standard-joining-input-bearing-to-overhead-frame');
  d.workingPartsReview={scope:'Closed pan, bored runner journals and supported input/lower bearings.',qualification:'Runner centerline rolling is analytical. Finite-width cylindrical runners necessarily scrub across the annular track; bevel tooth loading and grinding forces remain unqualified.'};
 }else if(id===376){
  for(const bearing of b.fixedBearings)replace(bearing,bore(.22,.124,.28));
  // The overhung arm also crosses the journal axis: its end needs a real bore.
  for(const arm of b.bearingArms){const region=clip.difference(poly([[-.96,-.09],[.96,-.09],[.96,.09],[-.96,.09]]),poly(circle([-.93,0],.124,64)));replace(arm,plate(region,-.15,.15));}
  // Lattice chord bars run into the side rings at both ends.
  for(const spoke of b.radialSpokes)replace(spoke,new T.BoxGeometry(2*spoke.userData.halfLength+.04,.12,.060));
  b.treadMounts=[];
  for(const tread of b.treadBoards)for(const side of[-1,1]){
   const angle=tread.userData.index*g.treadPitch;
   const lug=box(b.wheelRotor,[.16,.38,.18],[Math.cos(angle)*1.865,Math.sin(angle)*1.865,side*g.wheelWidth/2],tread.material,'radial-bracket-joining-internal-tread-to-side-ring');lug.rotation.z=angle+Math.PI/2;b.treadMounts.push(lug);
  }
  // Brown draws each face as a broad riveted rim band; it seats on the
  // outer faces of the tread brackets and hides the tread ends.
  b.faceRims=[];b.rimRivets=[];
  const rimBand=clip.difference(poly(circle([0,0],2.10,192)),poly(circle([0,0],1.78,192)));
  for(const side of[-1,1]){
   const z=side*(g.wheelWidth/2+.09),band=new T.Mesh(plate(rimBand,side>0?z:z-.06,side>0?z+.06:z),b.radialSpokes[0].material);
   band.userData.role='riveted-face-rim-band-of-treadwheel';band.userData.side=side;b.wheelRotor.add(band);b.faceRims.push(band);
   for(let i=0;i<16;i++){const a=(i+.5)*Math.PI/8,rivet=new T.Mesh(new T.CylinderGeometry(.035,.035,.02,12),b.axle.material);rivet.rotation.x=Math.PI/2;rivet.position.set(Math.cos(a)*1.94,Math.sin(a)*1.94,z+side*.07);rivet.userData.role='rim-band-rivet-head';b.wheelRotor.add(rivet);b.rimRivets.push(rivet);}
  }
  d.workingPartsReview={scope:'Bored bearing/arm journals and attached cage spokes and treads.',qualification:'The leg animation and balanced mean weight torque remain prescribed. Hoof/tread contact remains unqualified by the mean velocity identity; the body is lowered clear of the axle.'};
 }else{
  replace(b.bearing,bore(.23,.134,.32));
  replace(b.base,new T.BoxGeometry(4.92,.18,4.10));b.base.position.z=.16;
  // Make each handrail standard reach the actual foundation top.
  for(const post of b.railPosts){const top=post.position.y+1.06,bottom=-1.98;replace(post,new T.BoxGeometry(.14,top-bottom,.14));post.position.y=(top+bottom)/2;}
  for(const spoke of b.endSpokes)replace(spoke,new T.BoxGeometry(3.15,.075,.060));
  d.workingPartsReview={scope:'Bored axle bearing, connected spokes and grounded rail standards; radial tread boards and tread-indexed finite sole placement.',qualification:'Finite foot placement uses prescribed stance/swing and two-link leg closure; passive balance, muscle forces and individual reaction loads remain unqualified.'};
 }
}

export function finishRunnerTread(model,id){
 const {root,update}=model,d=root.userData;d.hideGround=true;d.minimumDisplayCycleSeconds=id===375?6:12;
 root.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)m.fog=false;});
 const bounds=new T.Box3();for(let i=0;i<=32;i++){update(4*i/32);root.updateMatrixWorld(true);root.traverseVisible(o=>{if(!o.geometry)return;o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));});}update(0);d.cameraFitBounds=bounds;d.cameraDistanceScale=1.03;return model;
}
