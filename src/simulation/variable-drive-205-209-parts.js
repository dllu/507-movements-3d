import profiles from './generated-variable-drive-205-209.js';
import pinSlotOutline from './generated-pin-slot-208.js';
import * as THREE from 'three';
import {smoothExtrudeGeometry} from './smooth-extrusion.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {plate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
const ring=(radius,bore,depth)=>boredLatheGeometry([{radial:radius,axial:-depth/2},{radial:radius,axial:depth/2}],bore,64);
const outlined=(points,depth,bore)=>{const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(...p))),hole=new THREE.Path();hole.absarc(0,0,bore,0,2*Math.PI,false);shape.holes.push(hole);return smoothExtrudeGeometry(shape,depth,{low:-depth/2});};
const flat=(mesh,bore=null)=>{const p=mesh.geometry.parameters,shape=p.shapes.clone();if(bore!==null){const hole=new THREE.Path();hole.absarc(0,0,bore,0,Math.PI*2,false);shape.holes.push(hole);}replace(mesh,new THREE.ExtrudeGeometry(shape,{depth:p.options.depth,bevelEnabled:false,curveSegments:64}).translate(0,0,-p.options.depth/2));};
// 208's slotted pinion runs from its outer (working) face at -0.055 inward
// to +0.205 along its shaft (local z points toward the wheel centre): Brown
// draws a wide strip, and the inner neighbouring ring stays clear of that
// inward face at every selector position. The slots are the pin envelope over
// this whole slab (scripts/export-208-pin-envelope.mjs).
export const pinion208Slab=Object.freeze([-.055,.205]);
export const pin208End=.46;
// Brown draws 209's forked catch as one solid flat horn: two broad crescent
// tines tapering to points from a common root. The thin wire tubes and loose
// ring are replaced by one flat plate (same centre paths) on a flat stem to a
// bored boss seated on the driven wheel's face.
function forkedHorn209(b){
 const fork=b.fork,tines=b.forkTines,stem=b.forkStem,collar=b.forkCollar;
 if(!fork||!tines?.length||!stem)return;
 const z=tines[0].geometry.parameters.path.getPoint(0).z,path=o=>o.geometry.parameters.path;
 // Source pixels per model unit, from the lower tine's root-to-tip span (39 px).
 const px=path(tines[0]).getPoint(0).distanceTo(path(tines[0]).getPoint(1))/39;
 const blade=(curve,w0,w1,samples=32)=>{
  const left=[],right=[];
  for(let i=0;i<=samples;i++){const t=i/samples,p=curve.getPoint(t),d=curve.getTangent(t),w=THREE.MathUtils.lerp(w0,w1,t)*px/2;
   left.push([p.x-d.y*w,p.y+d.x*w]);right.push([p.x+d.y*w,p.y-d.x*w]);}
  return poly([...left,...right.reverse()]);
 };
 const root=path(stem).getPoint(1);
 let outline;
 const F=fork.userData.functionalFork;
 if(F){
  // p98: the working fork. Its two horns are bands outside the pin's cusp
  // path, tapering to points at the tips; the V between them is the pin's
  // path closed by the chord across the mouth, and everything the pin
  // sweeps over a whole cycle is cut out with finite clearance. A web joins
  // the crotch to the boss round the driven axis.
  const W=F.windowPath,last=W.length-1,band=[];
  for(let i=0;i<last;i+=2){
   const taper=j=>Math.min(j,last-j)/(last/2),a=W[i].point,b=W[Math.min(i+2,last)].point;
   band.push(clip.union(poly(circle([a.x,a.y],F.slotRadius+.018+.075*taper(i)**.6,40)),poly(circle([b.x,b.y],F.slotRadius+.018+.075*taper(Math.min(i+2,last))**.6,40))));
  }
  const hull=pts=>{const p=[...pts].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lo=[],hi=[];for(const q of p){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),q)<=0)lo.pop();lo.push(q);}for(const q of p.reverse()){while(hi.length>1&&cross(hi.at(-2),hi.at(-1),q)<=0)hi.pop();hi.push(q);}return poly([...lo.slice(0,-1),...hi.slice(0,-1)]);};
  // Each band step is the hull of two neighbouring discs (a tapered capsule).
  const bands=band.map(b=>hull(b.flat(2)));
  const sweep=[];for(let i=0;i+1<F.sweep.length;i+=3){const a=F.sweep[i],b=F.sweep[Math.min(i+3,F.sweep.length-1)];sweep.push(hull([...circle([a.x,a.y],F.slotRadius,24),...circle([b.x,b.y],F.slotRadius,24)]));}
  const bottom=F.bottomPoint,web=hull([...circle([0,0],.12,48),...circle([bottom.x,bottom.y],.1,48)]);
  const solid=clip.union(...bands,web,poly(circle([0,0],.27,64)));
  let cut=clip.difference(solid,poly(W.map(({point})=>[point.x,point.y])),...sweep,poly(circle([0,0],.135,64)));
  // Keep the one piece carried by the boss.
  const area=r=>{let s=0;for(let i=0;i+1<r.length;i++)s+=r[i][0]*r[i+1][1]-r[i+1][0]*r[i][1];return Math.abs(s)/2;};
  cut=[cut.reduce((best,piece)=>area(piece[0])>area(best[0])?piece:best)];
  outline=cut;
 }else outline=clip.difference(clip.union(
  ...tines.map(o=>blade(path(o),22,4)),
  blade(new THREE.LineCurve3(new THREE.Vector3(0,0,z),root),15,14),
  poly(circle([0,0],.27,64)),poly(circle([root.x,root.y],9*px,48))),poly(circle([0,0],.135,64)));
 const horn=new THREE.Mesh(plate(outline,z-.05,z+.05),stem.material);
 horn.userData.role='solid-flat-forked-catch-horn';fork.add(horn);
 const boss=new THREE.Mesh(plate(clip.difference(poly(circle([0,0],.27,64)),poly(circle([0,0],.135,64))),.17,z-.05),stem.material);
 boss.userData.role='forked-horn-boss-seated-on-driven-wheel-face';fork.add(boss);
 for(const o of[stem,...tines,collar])if(o)o.visible=false;
 b.forkHorn=horn;b.forkHornBoss=boss;
}
// Local z (in a row's frame) at which a bar reaches 0.01 into the wheel body.
function rimDepth205(row){const bodyHalf=.18,sunk=.01;return Math.abs(row.position.z)-bodyHalf+sunk;}
export function correctVariableDrive(root,id){
 const b=root.userData.blocks;
 if(id===205){
  for(const cam of b.camMeshes){flat(cam,.092);cam.userData.generationGeometry=cam.geometry;replace(cam,outlined(profiles.cam205,.18,.092));}
  // p93: Brown draws every tooth as a plain rectangular bar: long bars in
  // front, and behind them short squares (the rest of each rear bar is hidden
  // by the wheel). Each tooth is now one straight-sided bar just enclosing the
  // old involute tooth (its full width, out to its tip), running in to r 2.62
  // on its wheel face and sunk 0.01 into it; the root keys go. The cams are
  // regenerated against these bars (scripts/generate-205-209-profiles.py).
  const innerX=2.62;
  for(const row of b.wheelRows)for(const tooth of row.userData.teeth){
   flat(tooth);const p=tooth.geometry.attributes.position;let low=Infinity,high=-Infinity,tip=-Infinity,zLow=Infinity,zHigh=-Infinity;
   for(let i=0;i<p.count;i++){low=Math.min(low,p.getY(i));high=Math.max(high,p.getY(i));tip=Math.max(tip,p.getX(i));zLow=Math.min(zLow,p.getZ(i));zHigh=Math.max(zHigh,p.getZ(i));}
   // The row plane faces the wheel on one side: sink the bar 0.01 into it.
   const sink=rimDepth205(row),z0=row.position.z<0?zLow:Math.min(zLow,-sink),z1=row.position.z<0?Math.max(zHigh,sink):zHigh;
   replace(tooth,plate(poly([[innerX,low],[tip,low],[tip,high],[innerX,high]]),z0,z1));
   for(const key of tooth.children)key.visible=false;
   tooth.userData.plainRectangularBar=true;
  }
  for(const hub of b.camHubs)replace(hub,ring(.18,.092,.261));
  replace(b.wheelBody,ring(root.userData.geometry.wheelRootRadius,.102,.36));replace(b.wheelHub,ring(.34,.102,.72));
  for(const o of[...b.baseRails,...b.rearUprights,...b.bearingBridges,...b.bearingRings,...b.wheelFaceRims])o.visible=false;
  root.userData.reconstructionNote='Two opposed involute cams engage alternating rows of eleven wheel teeth, giving one reverse output turn per eleven input turns. The axial separation and inferred 20-degree profiles reconstruct the source animation.';
 }else if(id===208){
  for(const floor of b.slotFloors)floor.visible=false;
  b.pinionWeb.userData.generationGeometry=b.pinionWeb.geometry;replace(b.pinionWeb,outlined(pinSlotOutline,pinion208Slab[1]-pinion208Slab[0],.078).translate(0,0,(pinion208Slab[0]+pinion208Slab[1])/2));for(const tooth of b.pinionTeeth)tooth.visible=false;
  for(const ring of b.pinionFaceRings)ring.visible=false;
  replace(b.pinWheelDisk,ring(1.58,.072,.18));replace(b.pinWheelHub,ring(.19,.072,.56));
  // p101: the pins stop at z 0.46 (0.06 past the pitch line, r 0.94 from the
  // pinion axis). Reaching deeper (0.68, r 0.72) made the pins' sweep undercut
  // every tooth into a slender hook; now each tooth is a clean radial-flank,
  // round-top tooth (scripts/generate-208-pin-envelope.py).
  for(const ringGroup of b.pinRings)for(const pin of ringGroup.children.filter(o=>o.userData.pinWheelPin)){replace(pin,new THREE.CylinderGeometry(.082,.082,pin208End-.085,22));pin.position.z=(.085+pin208End)/2;}
  root.userData.geometry.pinStartZ=.085;root.userData.geometry.pinLength=pin208End-.085;
  replace(b.selectorCollar.children[0],ring(.15,.060,.13));
  // The selector collar sits beside the widened pinion's inward face.
  for(const part of b.selectorCollar.children)part.position.x=pinion208Slab[1]+.13/2+.015;
  for(const o of[b.baseRail,...b.baseFeet,...b.outputBearingPosts,...b.outputBearings,b.inputBearing,b.inputBearingPost])o.visible=false;
  root.userData.reconstructionNote='One slotted pinion slides along its shaft to select eleven, sixteen or twenty-one face pins. Selection is performed while stopped and indexed. The running ratios are prescribed; finite slot clearance and load-free transitions are reconstruction assumptions.';
 }else{
  for(const wheel of[b.driver,b.driven]){for(const [i,tooth]of wheel.userData.toothMeshes.entries()){const p=tooth.geometry.parameters,points=p.shapes.getPoints();for(let j=0;j<2;j++)points[j].addScaledVector(wheel.userData.toothData[i].outwardNormal,-.035);replace(tooth,new THREE.ExtrudeGeometry(new THREE.Shape(points.slice(0,4)),{depth:p.options.depth,bevelEnabled:false}).translate(0,0,-p.options.depth/2));}flat(wheel.userData.body);wheel.userData.smoothTread.visible=false;replace(wheel.userData.hub,ring(.2,.077,.527));}
  b.driven.userData.body.userData.generationGeometry=b.driven.userData.body.geometry;replace(b.driven.userData.body,outlined(profiles.driven209,.34,.135));for(const tooth of b.driven.userData.toothMeshes)tooth.visible=false;
  for(const o of[b.baseRail,...b.baseFeet,...b.bearingPosts,...b.bearings])o.visible=false;
  forkedHorn209(b);
  root.userData.reconstructionNote='Two focus-mounted ellipses alternate smooth rolling with toothed continuation; the right wheel has a generated mating profile with finite clearance. A pin on the driver\'s second tooth runs through the forked catch on the driven wheel at the dead point: the fork\'s V is cut round the pin\'s cusp path with 0.012 clearance, so the pin bears on one horn going in and the other coming out while the teeth take up. The ideal no-slip ellipse law prescribes the motion; the pin load is not simulated.';
 }
 root.userData.hideGround=true;root.userData.minimumDisplayCycleSeconds=12;
 root.traverse(o=>{for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material)material.fog=false;});
}
