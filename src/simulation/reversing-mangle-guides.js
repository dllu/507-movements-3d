import * as THREE from 'three';
import cavities from './baked/reversing-mangle-cavities.js';
import {markShadows, PALETTE} from './primitives.js';
import {circle, poly, plate, polygonClipping as clip} from './finite-plate-geometry.js';
import {boredCylinderGeometry} from './piston-guide-parts.js';

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
  const bore=poly(circle([0,0],.111,96));
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
  update(0);
  d.cameraDistanceScale=1.04;
  markShadows(root);
  return {root,update,cameraDirection:new THREE.Vector3(1.6,.9,16)};
}
