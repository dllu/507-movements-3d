import * as THREE from 'three';
import cavities from './baked/reversing-mangle-cavities.js';
import {markShadows, PALETTE} from './primitives.js';
import {circle, poly, plate, polygonClipping as clip} from './finite-plate-geometry.js';
import {boredCylinderGeometry} from './piston-guide-parts.js';
import {addMangleUniversalDrive} from './mangle-universal-drive.js';
import {involuteSpurOutline, smoothExtrudeGeometry} from './smooth-extrusion.js';

const CAM194=[0.8,3.4,16];
function area(points) {
  return Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-p[1]*q[0];},0));
}
function channelLoops(data, halfWidth, pitch = false) {
  const g=data.geometry, segments=g.pitchSegments??g.guideSegments;
  const evaluate=g.pitchSegments?data.evaluateArc:data.evaluateGuideArc;
  const left=[],right=[];
  for(const segment of segments) {
    const count=Math.ceil(Math.abs(segment.sweep)*128);
    for(let i=0;i<count;i++) {
      const s=evaluate(segment,i/count),p=pitch?s.point:s.guidePoint;
      const n=new THREE.Vector2(s.tangent.y,-s.tangent.x);
      left.push(p.clone().addScaledVector(n,halfWidth).toArray());
      right.push(p.clone().addScaledVector(n,-halfWidth).toArray());
    }
  }
  return area(left)>area(right)?{outer:poly(left),inner:poly(right)}:{outer:poly(right),inner:poly(left)};
}
function replace(mesh,geometry){mesh.geometry.dispose();mesh.geometry=geometry;mesh.rotation.set(0,0,0);mesh.position.set(0,0,0);}

export function finishReversingMangleGuides(root,update,id) {
  const d=root.userData,b=d.blocks,g=d.geometry;
  const halfWidth=.064,loops=channelLoops(d,halfWidth),disk=poly(circle([0,0],g.wheelRadius,256));
  // The wheel shaft (r 0.075) leaves the backing through a close bore, not a
  // wide annulus that showed a lit crescent from behind.
  const bore=poly(circle([0,0],.079,128));
  const floor=-.06,front=.14;
  replace(b.wheelBody,plate(clip.difference(disk,bore),-.14,floor));
  replace(b.guideGrooveOuter,plate(clip.difference(disk,loops.outer,bore),floor,front));
  replace(b.guideGrooveRecess,plate(clip.difference(loops.inner,bore),floor,front));
  b.guideGrooveOuter.userData.role='finite-outer-wall-of-blind-mangle-guide';
  b.guideGrooveRecess.userData.role='finite-inner-island-of-blind-mangle-guide';
  // Backing, groove walls and root strip are one wheel: one wheel colour,
  // not an ink layer showing as a black rim stripe or back face.
  const ink=new THREE.Color(PALETTE.ink);
  const wheelMaterial=[b.wheelBody,b.guideGrooveOuter].map(m=>m.material).find(m=>!m.color.equals(ink))??b.wheelBody.material;
  b.wheelBody.material=wheelMaterial;
  b.guideGrooveOuter.material=wheelMaterial;
  b.guideGrooveRecess.material=wheelMaterial;
  // This is a bearing collar, not a torus crossing its own guided shaft.
  b.guideFollower.geometry.dispose();
  b.guideFollower.geometry=boredCylinderGeometry(.062,.056,.17);
  b.guideFollower.rotation.x=Math.PI/2;
  if(b.pitchGroove){
    const strip=channelLoops(d,.024,true);
    replace(b.pitchGroove,plate(clip.difference(strip.outer,strip.inner),front,.18));
    b.pitchGroove.userData.role='continuous-root-strip-under-mangle-teeth';
    b.pitchGroove.material=wheelMaterial;
  }
  if(cavities[id]) {
    const cavity=poly(cavities[id].points);
    // 192's teeth border a raised hooked land with the pinion running
    // outside it; 193's pinion runs inside its pitch loop.
    const land=g.toothLandInsidePitchLoop?clip.difference(clip.intersection(disk,cavity),bore):clip.difference(disk,cavity,bore);
    const toothLand=new THREE.Mesh(plate(land,front,.36),b.wheelBody.material);
    toothLand.userData.role='generated-conjugate-mangle-cavity';
    b.wheelRotor.add(toothLand);
    const retired=new Set();
    for(const tooth of b.mangleToothObjects){b.wheelRotor.remove(tooth);retired.add(tooth.geometry);}
    for(const geometry of retired)geometry.dispose();
    b.mangleToothObjects=[];
    b.toothLand=toothLand;
    d.generatedToothCavity={...cavities[id],points:undefined};
    b.wheelRim.position.z=.38;
    b.wheelIndex.position.z=.405;
    const hub=b.wheelRotor.children.find(o=>o.userData.role?.includes('mangle-wheel-hub'));
    if(hub)hub.position.z=.25;
  }
  // The factory's pinion was a chord polyline (seven straight segments per
  // involute flank, a flat chord across each tip and root) with flat-shaded
  // side triangles, so it read as low-poly. Rebuild the same involute tooth
  // (pitch, pressure angle, root, base and tip radii and tooth thickness)
  // exactly: finely sampled involutes, arcs concentric with the pinion at tip
  // and root, one flat extrusion over the same depth with flat end faces,
  // smooth flank normals and creased edges. The cavity is cut by this outline.
  // 194's pinion is instead the offline envelope of its pins
  // (fitRadialPinManglePinion), which this rebuild must not replace.
  if(id!==194){
    const gear=b.pinion.userData.rotor.children[0],old=gear.geometry,u=b.pinion.userData;
    old.computeBoundingBox();let {min:{z:low},max:{z:high}}=old.boundingBox;
    // p93: 192's six-tooth pinion is set by Brown's pitch and the small
    // radius of the tooth row's hooked turns, so it keeps six teeth. Full-depth
    // involutes on six teeth are long pointed petals, though. Cut stub teeth
    // instead (addendum and dedendum 0.8 module), and the wheel's cavity,
    // generated offline from this outline, follows. The face also stood 0.2
    // proud of the wheel's tooth land; trim it to the tooth row plus 0.015.
    if(id===192){
      const m=2*u.pitchRadius/u.teeth;
      u.outerRadius=u.pitchRadius+.8*m;u.rootRadius=u.pitchRadius-.8*m;
      root.updateMatrixWorld(true);
      if(cavities[id]){const offset=(.375)-(gear.getWorldPosition(new THREE.Vector3()).z-b.wheelRotor.getWorldPosition(new THREE.Vector3()).z)-high;high+=offset;}
    }
    const outline=involuteSpurOutline({teeth:u.teeth,pitchRadius:u.pitchRadius,rootRadius:u.rootRadius,outerRadius:u.outerRadius,pressureAngle:u.pressureAngle});
    const shapes=new THREE.Shape(outline),flat=smoothExtrudeGeometry(shapes,high-low,{low,curveSegments:1});
    flat.userData={...old.userData,pinionOutlineShapes:shapes,pinionOutline:outline.map(p=>[p.x,p.y]),toothProfile:'exact-involute-tip-and-root-arcs'};
    flat.parameters={shapes,options:{depth:high-low,bevelEnabled:false}};
    gear.geometry=flat;old.dispose();
    gear.userData.role??='flat-involute-mangle-pinion';
  }
  d.finiteGuide={halfWidth,journalRadius:.055,collarRadius:.062,collarBore:.056,floorZ:floor,frontZ:front,pinionPlaneZ:.37};
  d.sourceAnimation={available:false,officialCanvasModelPresent:false,modelDefinitionsChecked:true};
  d.reconstructionNote='The source supplies no numerical groove section or animated model. The reversing law is prescribed from ideal pitch rolling. A blind groove, connected backing and front-side universal input reconstruct hidden depth interfaces. Forces, friction and clearance take-up are not simulated.' + (id===194?' The retained radial pin row and pinion still interfere; finite tooth contact is not qualified.':' The complementary tooth cavity is cut offline with the actual pinion phase and checked through both reversals.');
  d.minimumDisplayCycleSeconds=d.transmission.cyclePeriod;
  // Rotated local bounding boxes inflate the almost circular wheel by sqrt(2).
  // Fit the visible finite vertices through a whole mechanism cycle instead.
  d.hideGround=true;
  const bounds=new THREE.Box3(),point=new THREE.Vector3(),visible=[];
  root.traverse(o=>{for(const material of [].concat(o.material??[]))material.fog=false;});
  root.traverseVisible(o=>{if(o.geometry?.attributes.position)visible.push(o);});
  for(let pose=0;pose<=64;pose++) {
    update(d.transmission.cyclePeriod*pose/64);root.updateMatrixWorld(true);
    for(const object of visible) {
      const positions=object.geometry.attributes.position;
      for(let i=0;i<positions.count;i++)bounds.expandByPoint(point.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld));
    }
  }
  d.cameraFitBounds=bounds.expandByScalar(.03);
  // The captioned jointed pinion shaft and the plain frame (added after
  // framing): Hooke joints at the input bearing and on the pinion shaft join a
  // telescopic slip shaft; the input shaft turns in a bearing on an arm from a
  // column beside the wheel, and a standard behind the wheel carries its shaft.
  // They replace the factory's ball-ended placeholder joint and its standard.
  for(const key of ['universalSlipShaft','fixedUniversalCross','rearInputShaft','movingUniversalJoint','framePost','frameFoot'])
    b[key]?.parent?.remove(b[key]);
  const box=(o)=>new THREE.Box3().setFromObject(o);
  root.updateMatrixWorld(true);
  const fixedPoint=b.fixedUniversalCross.position;
  let maxDeviation=0;
  for(let pose=0;pose<=128;pose++){update(d.transmission.cyclePeriod*pose/128);const c=d.kinematics.pinionCenter;maxDeviation=Math.max(maxDeviation,Math.hypot(c.x-fixedPoint.x,c.y-fixedPoint.y));}
  update(0);root.updateMatrixWorld(true);
  const universal=addMangleUniversalDrive(root,{fixedPoint,pinionShaftTop:box(b.pinionShaft).max.z,maxDeviation,
    wheelRadius:g.wheelRadius,wheelShaftBack:box(b.wheelShaft).min.z,wheelBackZ:Math.min(box(b.wheelRotor).min.z,-.21)});
  Object.assign(b,{universalDrive:universal.drive,universalFrame:universal.frame,...Object.fromEntries(Object.entries(universal.blocks).map(([k,v])=>['universal'+k[0].toUpperCase()+k.slice(1),v]))});
  d.universalDrive={fixedJoint:universal.J1.clone(),jointSpan:universal.span,maxDeviation};
  const baseUpdate=update;
  update=(time)=>{baseUpdate(time);universal.update(d.kinematics.pinionCenter,d.kinematics.pinionAngle);};
  update(0);
  d.cameraDistanceScale=1.04;
  // A long lens, as 192's: Brown's flat face view, and the jointed shaft
  // standing end-on in front of the wheel is not enlarged by perspective.
  d.cameraFov??=16;
  markShadows(root);
  // 194: a little more from above, so the drive standing out in front of the
  // pinion falls below it rather than across its face and hub.
  return {root,update,cameraDirection:id===194?new THREE.Vector3(CAM194[0],CAM194[1],CAM194[2]):new THREE.Vector3(1.6,.9,16)};
}
