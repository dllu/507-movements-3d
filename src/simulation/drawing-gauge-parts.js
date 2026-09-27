import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {plate,poly,circle,sector,polygonClipping as clip} from './finite-plate-geometry.js';
import {boredJournal,fitPistonGuide} from './piston-guide-parts.js';
import {boredPlanarLinkGeometry} from './bored-planar-link.js';
import {compassGripProfile} from './compass-grip-profile.js';
const rect=(x0,y0,x1,y1)=>poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};

export function finishDrawingGauge(root,update,period,direction=new THREE.Vector3(0,.6,12)){
 root.userData.cameraFov=8;root.userData.cameraDirection=direction;
 fitPistonGuide(root,update,period);
 return {root,update,cameraDirection:direction};
}

export function correctCentrolinead(root){
 const b=root.userData.blocks,g=root.userData.geometry;
 root.remove(b.board,b.boardFrame,b.constructionCircleArc,b.fixedPinChord);
 // Brown draws no pins on the instrument; the two guide pins stay only as
 // plain dark pegs the height of the leg each one bears against, with no
 // collar knob or shank standing out behind the legs.
 for(const [pin,layer] of [[b.fixedPins.lower,-.13],[b.fixedPins.upper,.05]]){
  pin.axle.visible=false;pin.group.remove(pin.axle);
  replace(pin.collar,new THREE.CylinderGeometry(.072,.072,.16,48));
  pin.collar.material=b.centralJoint.material;pin.collar.position.z=layer-pin.group.position.z;
 }
 for(const [index,leg] of Object.values(b.legs).entries()){
  const normal=new THREE.Vector2(-leg.direction.y,leg.direction.x);
  leg.body.position.x+=normal.x*.075;leg.body.position.y+=normal.y*.075;
  leg.backEdge.position.x+=normal.x*(.075+.013);leg.backEdge.position.y+=normal.y*(.075+.013);
  leg.clamp.position.x+=normal.x*.195;leg.clamp.position.y+=normal.y*.195;
  const layer=index?.05:-.13;
  leg.body.position.z=layer;leg.backEdge.position.z=.095+layer;
  const length=g.visibleLegLength;
  const outline=clip.union(rect(-length/2,-.12,length/2,.12),poly(circle([-length/2,-.195],.20,64)));
  const holes=clip.union(poly(circle([-length/2,-.195],.145,64)),poly(circle([.43-length/2,0],.028,48)));
  replace(leg.body,plate(clip.difference(outline,holes),-.08,.08));
  leg.clamp.position.z=.445;
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.026,.026,.62,32),b.centralJoint.material);
  stem.rotation.x=Math.PI/2;stem.position.z=.04-.445;leg.clamp.add(stem);

 }
 // Brown's two clamp slots are long arcs concentric with the joint, about
 // 125 degrees each (25-150 and 212-335 degrees from the blade), with
 // rounded ends; each clamp screw stands in its slot.
 const slotInner=.437,slotOuter=.507,slotMid=(slotInner+slotOuter)/2,slotHalf=(slotOuter-slotInner)/2;
 const slotSpans=[[25,150],[212,335]].map(span=>span.map(THREE.MathUtils.degToRad));
 const slots=Object.values(b.legs).map(leg=>{
  const angle=THREE.MathUtils.euclideanModulo(Math.atan2(leg.clamp.position.y,leg.clamp.position.x),2*Math.PI);
  const [a0,a1]=slotSpans.find(([lo,hi])=>angle>lo&&angle<hi);
  return clip.union(sector(slotInner,slotOuter,a0,a1,96),
   ...[a0,a1].map(a=>poly(circle([slotMid*Math.cos(a),slotMid*Math.sin(a)],slotHalf,32))));
 });
 b.headSlotSpans=slotSpans;
 // The left opening and two real adjustment slots follow the engraved head.
 const headOutline=clip.difference(poly(circle([0,0],.58,96)),
  poly([[-.7,-.31],[-.20,0],[-.7,.31]]),poly(circle([0,0],.145,64)),...slots);
 replace(b.head,plate(headOutline,-.10,.10));b.head.rotation.set(0,0,0);b.head.position.z=.25;
 replace(b.centralJoint,new THREE.CylinderGeometry(.14,.14,.80,48));b.jointIndex.position.z=.53;
 for(const arc of b.adjustmentArcs)b.instrument.remove(arc);
 replace(b.drawingEdge,new THREE.BoxGeometry(g.bladeLength,.025,.022));
 b.drawingEdge.position.set(g.bladeLength/2,-.013,.12);b.drawingEdge.rotation.z=0;
 root.userData.reconstructionNote='Finite guide pins contact offset leg faces. The sweep stops before the head reaches either pin; the exact perspective-line geometry is retained.';
}

export function correctProportionalCompasses(root){
 const b=root.userData.blocks,g=root.userData.geometry;
 root.remove(b.board,b.boardBorder);
 const holes=clip.union(rect(-g.slotWidth/2,g.slotMinimumCoordinate,g.slotWidth/2,g.slotMaximumCoordinate),
  poly(circle([0,g.slotMinimumCoordinate],.18,64)),poly(circle([0,g.slotMaximumCoordinate],.18,64)));
 const outline=clip.union(rect(-g.legWidth/2,-.88,g.legWidth/2,1.47),
  poly(circle([0,1.47],g.bossRadius,64)),poly(circle([0,-.88],g.bossRadius*1.03,64)),
  poly([[-.19,1.5],[0,g.shortArmLength],[.19,1.5]]),
  poly(compassGripProfile.points),poly([[-.09,-1.40],[0,-g.longArmLength],[.09,-1.40]]));
 const legProfile=clip.difference(outline,holes);
 for(const leg of [b.legA,b.legB]){
  replace(leg.spine,plate(legProfile,-g.legDepth/2,g.legDepth/2));leg.spine.position.set(0,0,0);
  for(const part of [leg.upperBoss,leg.lowerBoss,leg.upperPoint,leg.lowerPoint,leg.lowerGrip,
   leg.slot,leg.slotInterior,...leg.scallops,...leg.slotEnds.flatMap(e=>[e.rim,e.opening])])part.visible=false;
  // Narrow sliders occupy the actual openings in each depth layer.
  replace(leg.pivotShoe,plate(clip.difference(rect(-.082,-.20,.082,.20),poly(circle([0,0],.067,64))),-.07,.07));
  leg.pivotShoe.position.z=0;
  for(const tick of leg.scaleTicks){replace(tick,new THREE.BoxGeometry(.11,.030,.030));tick.position.x=-.17;}
  // Both sharp point pairs meet one common measuring plane, despite stacked legs.
  const p=leg.spine.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   const y=p.getY(i),t=y>1.5?(y-1.5)/(g.shortArmLength-1.5):y< -1.40?(-1.40-y)/(g.longArmLength-1.40):0;
   p.setZ(i,p.getZ(i)*(1-t)-leg.group.position.z*t);
  }
  p.needsUpdate=true;leg.spine.geometry.computeVertexNormals();leg.spine.geometry.computeBoundingBox();
  for(const tip of [leg.shortTipIndex,leg.longTipIndex])tip.visible=false;
 }
 const named=role=>b.pivotAssembly.children.find(o=>o.userData.role===role);
 const axle=named('common-pivot-axis-allowing-relative-leg-rotation');
 replace(axle,new THREE.CylinderGeometry(.065,.065,.94,48));axle.position.z=-.10;
 const washer=named('pivot-slide-outer-retaining-washer');
 replace(washer,boredJournal(.39,.067,.10,washer.material).geometry);washer.position.z=-.10;
 const back=boredJournal(.31,.067,.08,washer.material);back.position.z=-.53;b.pivotAssembly.add(back);
 b.pivotAxle=axle;b.rearWasher=back;
 root.userData.reconstructionNote='The slotted legs use true through-openings and separate pivot sliders. The scalloped grip is extracted from the engraving; straight webs, circular slot ends and hidden connections are reconstructed.';
}

export function correctBisectingGauge(root){
 // Brown draws the gauge in isometric on a board lying flat: turn the
 // board face up so the camera can look down across it.
 root.rotation.set(-Math.PI/2,0,0);
 const b=root.userData.blocks,g=root.userData.geometry;
 b.crossbar.position.z=.43;b.crossbarTopIndex.position.z=.565;
 for(const tick of b.crossbarTicks)tick.position.z=.572;
 b.crossbarTopIndex.visible=false;for(const tick of b.crossbarTicks)tick.visible=false;
 b.workpieceEdges.visible=false;
 for(const [i,cheek] of [b.fixedCheek,b.adjustableCheek].entries()){
  const linkZ=i?.13:-.02;
  const profile=clip.difference(rect(-.47,-.25,.47,.558),rect(-.178,.302,.178,.558),rect(-.51,linkZ-.071,-.02,linkZ+.071));
  const lower=plate(profile,-g.cheekThickness/2,g.cheekThickness/2);
  // Local profile axes Y/Z, extrusion X, with preserved outward winding.
  lower.applyMatrix4(new THREE.Matrix4().set(0,0,1,0,1,0,0,0,0,1,0,0,0,0,0,1));
  const capProfile=i?clip.difference(rect(-.17,-.47,.17,.47),poly(circle([0,0],.078,64))):rect(-.17,-.47,.17,.47);
  const cap=plate(capProfile,.558,.75);
  replace(cheek.plate,mergeGeometries([lower,cap]));lower.dispose();cap.dispose();cheek.plate.position.z=0;
  replace(cheek.innerContact,new THREE.BoxGeometry(.006,.80,.30));cheek.innerContact.visible=false;
  cheek.innerContact.position.x=(i?-1:1)*(.17-.003);
  cheek.lowerFoot.position.x=i?.09:-.09;
 }
 for(const [i,link] of [b.leftLink,b.rightLink].entries()){
  const geometry=boredPlanarLinkGeometry({length:g.equalLinkLength,width:.23,eyeRadius:.18,boreRadius:.133,depth:.13});
  geometry.translate(-g.equalLinkLength/2,0,0);replace(link,geometry);link.userData.workingZ=i?.13:-.02;
 }
 for(const anchor of [b.fixedLinkAnchor,b.adjustableLinkAnchor]){
  replace(anchor,new THREE.CylinderGeometry(.13,.13,.40,48));anchor.position.z=.09;
 }
 replace(b.markerCollar,new THREE.CylinderGeometry(.22,.22,.10,48));b.markerCollar.position.z=.15;
 const pin=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.44,48),b.markerCollar.material);
 pin.rotation.x=Math.PI/2;pin.userData.role='marker-pin-through-both-bored-links';b.markingPoint.add(pin);b.markerPin=pin;
 replace(b.markerNeedle,new THREE.ConeGeometry(.07,.28,32));b.markerNeedle.rotation.x=-Math.PI/2;b.markerNeedle.position.z=-.14;
 const stem=b.thumbScrew.children[0];replace(stem,new THREE.CylinderGeometry(.075,.075,.20,32));stem.position.z=.16;b.thumbStem=stem;
 root.userData.reconstructionNote='The cheek opens outward from the wood, with a real crossbar passage and separated bored centering links. Thumb-screw locking and hand traverse remain prescribed; equal-link bisection is exact.';
}
