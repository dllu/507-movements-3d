import profiles from './generated-variable-drive-205-209.js';
import pinSlotOutline from './generated-pin-slot-208.js';
import * as THREE from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {plate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
const ring=(radius,bore,depth)=>boredLatheGeometry([{radial:radius,axial:-depth/2},{radial:radius,axial:depth/2}],bore,64);
const outlined=(points,depth,bore)=>{const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(...p))),hole=new THREE.Path();hole.absarc(0,0,bore,0,2*Math.PI,false);shape.holes.push(hole);return new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:64}).translate(0,0,-depth/2);};
const flat=(mesh,bore=null)=>{const p=mesh.geometry.parameters,shape=p.shapes.clone();if(bore!==null){const hole=new THREE.Path();hole.absarc(0,0,bore,0,Math.PI*2,false);shape.holes.push(hole);}replace(mesh,new THREE.ExtrudeGeometry(shape,{depth:p.options.depth,bevelEnabled:false,curveSegments:64}).translate(0,0,-p.options.depth/2));};
// 208's slotted pinion runs from its outer (working) face at -0.055 inward
// to +0.205 along its shaft (local z points toward the wheel centre): Brown
// draws a wide strip, and the inner neighbouring ring stays clear of that
// inward face at every selector position. The slots are the pin envelope over
// this whole slab (scripts/export-208-pin-envelope.mjs).
export const pinion208Slab=Object.freeze([-.055,.205]);
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
 const root=path(stem).getPoint(1),outline=clip.union(
  ...tines.map(o=>blade(path(o),22,4)),
  blade(new THREE.LineCurve3(new THREE.Vector3(0,0,z),root),15,14),
  poly(circle([0,0],.27,64)),poly(circle([root.x,root.y],9*px,48)));
 const horn=new THREE.Mesh(plate(clip.difference(outline,poly(circle([0,0],.135,64))),z-.05,z+.05),stem.material);
 horn.userData.role='solid-flat-forked-catch-horn';fork.add(horn);
 const boss=new THREE.Mesh(plate(clip.difference(poly(circle([0,0],.27,64)),poly(circle([0,0],.135,64))),.17,z-.05),stem.material);
 boss.userData.role='forked-horn-boss-seated-on-driven-wheel-face';fork.add(boss);
 for(const o of[stem,...tines,collar])if(o)o.visible=false;
 b.forkHorn=horn;b.forkHornBoss=boss;
}
export function correctVariableDrive(root,id){
 const b=root.userData.blocks;
 if(id===205){
  for(const cam of b.camMeshes){flat(cam,.092);cam.userData.generationGeometry=cam.geometry;replace(cam,outlined(profiles.cam205,.18,.092));}
  for(const row of b.wheelRows)for(const tooth of row.userData.teeth)flat(tooth);
  for(const hub of b.camHubs)replace(hub,ring(.18,.092,.261));
  replace(b.wheelBody,ring(root.userData.geometry.wheelRootRadius,.102,.36));replace(b.wheelHub,ring(.34,.102,.72));
  for(const o of[...b.baseRails,...b.rearUprights,...b.bearingBridges,...b.bearingRings,...b.wheelFaceRims])o.visible=false;
  root.userData.reconstructionNote='Two opposed involute cams engage alternating rows of eleven wheel teeth, giving one reverse output turn per eleven input turns. The axial separation and inferred 20-degree profiles reconstruct the source animation.';
 }else if(id===208){
  for(const floor of b.slotFloors)floor.visible=false;
  b.pinionWeb.userData.generationGeometry=b.pinionWeb.geometry;replace(b.pinionWeb,outlined(pinSlotOutline,pinion208Slab[1]-pinion208Slab[0],.078).translate(0,0,(pinion208Slab[0]+pinion208Slab[1])/2));for(const tooth of b.pinionTeeth)tooth.visible=false;
  for(const ring of b.pinionFaceRings)ring.visible=false;
  replace(b.pinWheelDisk,ring(1.58,.072,.18));replace(b.pinWheelHub,ring(.19,.072,.56));
  for(const ringGroup of b.pinRings)for(const pin of ringGroup.children.filter(o=>o.userData.pinWheelPin)){replace(pin,new THREE.CylinderGeometry(.082,.082,.595,22));pin.position.z=(.085+.68)/2;}
  root.userData.geometry.pinStartZ=.085;root.userData.geometry.pinLength=.595;
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
  root.userData.reconstructionNote='Two focus-mounted ellipses alternate smooth rolling with toothed continuation; the right wheel has a generated mating profile with finite clearance. The ideal no-slip ellipse law prescribes motion; the fork is an illustrative entry guide, without a loaded catch simulation.';
 }
 root.userData.hideGround=true;root.userData.minimumDisplayCycleSeconds=12;
 root.traverse(o=>{for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material)material.fog=false;});
}
