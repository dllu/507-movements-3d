import * as THREE from 'three';
import profiles from './baked/gear-finger-stop-teeth.js';
import {circle,poly,plate,polygonClipping as clip} from './finite-plate-geometry.js';
import {boredCylinderGeometry} from './piston-guide-parts.js';
import {markShadows} from './primitives.js';

const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
function extrusion(outline,bore,bottom,top){
  const shape=new THREE.Shape(outline);
  if(bore)shape.holes.push(new THREE.Path([...bore].reverse()));
  return new THREE.ExtrudeGeometry(shape,{depth:top-bottom,bevelEnabled:false,steps:1}).translate(0,0,bottom);
}

export function correctGearFingerStop(model){
  const {root,update}=model,d=root.userData,b=d.blocks,g=d.geometry;
  const workingSupports=[];
  for(const [index,key,teeth,phase] of [[0,'driven',12,0],[1,'driver',10,g.sourceDriverToothCenterPhase]]){
    const assembly=b[`${key}Assembly`],bore=g[`${key}BoreLocal`],center=g[`${key}Center`];
    const outline=profiles[teeth].outline.map(([x,y])=>new THREE.Vector2(x,y).rotateAround(new THREE.Vector2(),phase));
    replace(assembly.gearBody,extrusion(outline,bore,-g.gearDepth/2,g.gearDepth/2));
    assembly.gearBody.geometry.userData.generatedTeeth={...profiles[teeth],outline:undefined};
    g[`${key}GearOutline`]=outline;
    // Keep the source's stop faces in the same common plane, without bevel
    // growth. The square passage continues through gear, finger and clamp hub.
    replace(assembly.fingerBody,plate(clip.difference(poly(g[`${key}FingerLocal`].map(p=>p.toArray())),poly(bore.map(p=>p.toArray()))),-g.fingerDepth/2,g.fingerDepth/2));
    replace(assembly.hub,plate(clip.difference(poly(circle([0,0],.73,96)),poly(bore.map(p=>p.toArray()))),-.17,g.fingerPlaneZ+.13));
    assembly.hub.rotation.set(0,0,0);assembly.hub.position.z=0;
    // Exact keyed shape instead of an axis-aligned block floating in the hole.
    const arbor=b.squareArbors[index===0?1:0];
    const keyed=bore.map(p=>p.clone().multiplyScalar(.998));
    replace(arbor,plate(clip.difference(poly(keyed.map(p=>p.toArray())),poly(circle([0,0],.124,96))),-.18,.72));
    arbor.position.z=0;
    assembly.boreRing.visible=false;
    const old=b.uprights[index];old.visible=false;
    const shape=clip.difference(clip.union(poly([[-.075,-4.25],[.075,-4.25],[.075,0],[-.075,0]]),poly(circle([0,0],.30,96))),poly(circle([0,0],.124,96)));
    const support=new THREE.Mesh(plate(shape,-.09,.09),old.children[0].material);
    support.position.set(center.x,center.y,-.82);support.userData.role=`${key}-bored-fixed-support`;root.add(support);workingSupports.push(support);
    replace(b.bearings[index],boredCylinderGeometry(.24,.124,.16).rotateX(Math.PI/2));
  }
  // This sphere claimed a unique pitch contact while rotating teeth pass it.
  // Rotation indexes already make the constant gear ratio visible.
  b.gearMeshMarker.visible=false;
  b.forwardContactMarker.position.z+=.01;
  b.reverseContactMarker.position.z+=.01;
  d.workingSupports=workingSupports;
  d.reconstructionNote='The 10:12 spur pair uses offline rounded-rack involutes with generated root transitions. A reconstructed 30-degree pressure angle preserves working engagement for these low tooth counts. The source stop fingers and exact opposite rotation are retained. Motion and reversal are prescribed; loading, backlash take-up, friction and impact are not simulated. Keyed joints and hidden support depth are reconstructed.';
  d.hideGround=true;d.minimumDisplayCycleSeconds=d.timeline.demonstrationPeriod;
  root.traverse(o=>{for(const m of[].concat(o.material??[]))m.fog=false;});
  const bounds=new THREE.Box3(),point=new THREE.Vector3();
  for(let i=0;i<=48;i++){
    update(d.timeline.demonstrationPeriod*i/48);root.updateMatrixWorld(true);
    root.traverseVisible(o=>{const p=o.geometry?.attributes.position;if(p)for(let j=0;j<p.count;j++)bounds.expandByPoint(point.fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld));});
  }
  update(0);d.cameraFitBounds=bounds.expandByScalar(.025);d.cameraDistanceScale=1.02;d.cameraFov=12;
  model.cameraDirection=new THREE.Vector3(.7,.6,16);markShadows(root);return model;
}
