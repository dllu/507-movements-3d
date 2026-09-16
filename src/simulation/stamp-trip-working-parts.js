import * as THREE from 'three';
import {rackPinionGeometry,rackToothGeometry,RACK_PRESSURE_ANGLE} from './rack-pinion-parts.js';
import {plate,poly,circle,ring,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
const hull=points=>{const p=points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),half=list=>{const out=[];for(const q of list){while(out.length>1&&cross(out.at(-2),out.at(-1),q)<=0)out.pop();out.push(q);}return out.slice(0,-1);};return [...half(p),...half(p.slice().reverse())];};
const rect=(w,h)=>poly([[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]);
export function stampMeshParameters(radius,teeth){
 const pressureAngle=RACK_PRESSURE_ANGLE,base=radius*Math.cos(pressureAngle),pitch=2*Math.PI*radius/teeth;
 let low=.001,high=radius*.3;
 for(let i=0;i<64;i++){const a=(low+high)/2,contactRatio=(a/Math.sin(pressureAngle)+Math.sqrt((radius+a)**2-base**2)-radius*Math.sin(pressureAngle))/(pitch*Math.cos(pressureAngle));if(contactRatio>1)high=a;else low=a;}
 const addendum=(low+high)/2,approach=addendum/Math.sin(pressureAngle),pitchContactAngle=approach/base;
 return{addendum,pressureAngle,baseRadius:base,rootRadius:radius-addendum-.006,tipRadius:radius+addendum,contactRatio:1,
  gearBaseAngle:Math.PI+Math.PI/(2*teeth)+pitchContactAngle,rackOffset:pitch/4-radius*pitchContactAngle};
}
export function correctStampParts(model){
 const {root}=model,d=root.userData,b=d.blocks,g=d.geometry,p=stampMeshParameters(g.pitchRadius,g.virtualToothCount);
 const complete=rackPinionGeometry({radius:g.pitchRadius,teeth:g.virtualToothCount,addendum:p.addendum,depth:g.gearDepth,bore:.108,backlash:.001});
 const shape=poly(complete.userData.outline.map(v=>v.toArray())),half=Math.PI/g.virtualToothCount,
  wedge=poly([[0,0],[2*Math.cos(half),-2*Math.sin(half)],[2*Math.cos(half),2*Math.sin(half)]]),tooth=plate(clip.intersection(shape,wedge),-g.gearDepth/2,g.gearDepth/2);complete.dispose();
 b.gearTeeth.forEach((o,i)=>{replace(o,tooth);o.rotation.z=i*g.toothPitchAngle;});
 const rackTooth=rackToothGeometry({pitch:g.rackToothPitch,addendum:p.addendum,depth:g.rackDepth,backlash:.001}).rotateZ(-Math.PI/2);
 b.rackTeeth.forEach(o=>{replace(o,rackTooth);o.position.x=g.pitchLineX;});
 replace(b.gearBody,ring(.108,p.rootRadius,-g.gearDepth/2,g.gearDepth/2,96));b.gearBody.rotation.set(0,0,0);
 replace(b.pinionHub,ring(.108,.17,-.36,.36,64));b.pinionHub.rotation.set(0,0,0);
 replace(b.shaftBearing,ring(.108,.25,-.15,.15,64));b.shaftBearing.rotation.set(0,0,0);
 const right=g.pitchLineX-p.addendum-.006;
 replace(b.rackBar,new THREE.BoxGeometry(right+.1,g.rackBarLength,g.rackDepth*.72));b.rackBar.position.x=(right-.1)/2;
 // Retain Brown's guides above and below the pinion; the lower smooth rod
 // is extended so the full six-pitch lift leaves the head below its guide.
 for(const guide of b.guideAssemblies){guide.frontLip.position.z=.44;guide.rearLip.position.z=-.04;replace(guide.leftJaw,new THREE.BoxGeometry(.18,.34,.70));guide.leftJaw.position.z=.20;}
 const source=b.stampDie.geometry.parameters;replace(b.stampDie,new THREE.ExtrudeGeometry(source.shapes,{depth:source.options.depth,bevelEnabled:false}).translate(0,0,-source.options.depth/2));
 for(const o of[b.base,b.rearPost,b.topBridge,b.lowerBridge,b.bearingBridge,b.gearRootOutline,b.pinionIndicator,b.blankSectorIndicator,b.rackTravelIndicator,...b.gearToothFaceLines,...b.rackToothFaceLines])o.visible=false;
 const oldUpdate=model.update;model.update=time=>{oldUpdate(time);b.contactMarker.visible=false;b.impactHalo.visible=false;};model.update(0);
 d.stampTripParts={mesh:p};
 d.reconstructionStatus='partial';
 d.reconstructionNote='Six compatible involute teeth lift a straight rack. The imposed gravity fall still intersects the withdrawing final tooth, and the next tooth has an unresolved entry interference. Release and pickup need a contact-driven reconstruction. A longer lower rod retains the source guide topology and clears the finite head at full lift; rebound and tooth elasticity are not solved.';
 finish(model,4,new THREE.Vector3(.7,.5,15));
}
function finish(model,seconds,direction){const d=model.root.userData;d.hideGround=true;d.minimumDisplayCycleSeconds=seconds;d.cameraFov=8;d.cameraDistanceScale=1;const bounds=d.geometry.cyclePeriod?[[-.9,-7.6,-.65],[2.4,7.5,1]]:[[-4.6,-.85,-.92],[4.4,4.7,.9]];d.cameraFitBounds=new THREE.Box3(new THREE.Vector3(...bounds[0]),new THREE.Vector3(...bounds[1]));model.cameraDirection=direction;model.root.traverse(o=>{for(const m of[].concat(o.material??[]))m.fog=false;});}
export function correctTripHammerParts(model){
 const {root}=model,d=root.userData,b=d.blocks,g=d.geometry;
 for(const name of['camDisk','camHub','movingPivotHub']){const o=b[name],p=o.geometry.parameters;replace(o,ring(.123,p.radiusTop,-p.height/2,p.height/2,64));o.rotation.set(0,0,0);}
 replace(b.camHub,ring(.123,.26,-.18,.18,64));b.camPost.position.z=-.49;
 for(const name of['rearCamBearing','frontPivotBearing','rearPivotBearing']){const o=b[name];replace(o,ring(.123,.27,-.08,.08,64));o.rotation.set(0,0,0);}
 for(const name of['camPost','pivotPost','pivotBridge']){
  const o=b[name],p=o.geometry.parameters,axis=name==='camPost'?g.camCenter:g.hammerPivot;
  replace(o,plate(clip.difference(rect(p.width,p.height),poly(circle([axis.x-o.position.x,axis.y-o.position.y],.123,64))),-p.depth/2,p.depth/2));
 }
 replace(b.camPostCap,plate(clip.difference(capsule([0,-.23],[0,.23],.32,32),poly(circle([0,.21],.123,64))),-.32,.32));
 b.frontPivotBearing.userData.role='fixed-fulcrum-shaft-end-retainer';
 for(const name of['movingJournalBlock']){const o=b[name],p=o.geometry.parameters;replace(o,plate(clip.difference(rect(p.width,p.height),poly(circle([0,0],.123,64))),-p.depth/2,p.depth/2));}
 // The helve crosses the same fulcrum and therefore needs the same bore.
 const outer=poly(hull([[-3.04,.54],[-2.74,.28],[-2.83,.72],...circle(g.followerCenterLocal.toArray(),g.followerRadius,96)]));replace(b.helve,plate(clip.difference(outer,poly(circle([0,0],.123,64))),-g.hammerDepth/2,g.hammerDepth/2));
 // The round wear nose projects from the helve face; coincident caps flicker.
 b.helve.position.z=.14;
 const head=b.hammerHead.geometry.parameters,headOutline=poly(head.shapes.extractPoints(32).shape.map(p=>p.toArray())),a=g.impactHammerAngle,y=g.anvilTopY-g.hammerPivot.y,rotate=(x,y)=>[x*Math.cos(a)+y*Math.sin(a),-x*Math.sin(a)+y*Math.cos(a)],above=poly([rotate(-10,y),rotate(10,y),rotate(10,10),rotate(-10,10)]);
 replace(b.hammerHead,plate(clip.intersection(headOutline,above),-.34,.34));
 for(const o of[b.base,b.contactMarker,b.impactMarker,b.camFaceRing,b.camIndicator,b.hammerIndicator,b.helveOutline,b.headOutline,b.movingPivotRing])o.visible=false;
 const oldUpdate=model.update;model.update=time=>{oldUpdate(time);b.contactMarker.visible=false;b.impactMarker.visible=false;};model.update(0);
 d.stampTripParts={};
 d.reconstructionNote='The radial wiper face lifts the rounded tail of a first-order lever. The released hammer follows an assumed compound-pendulum mass model and an ideal inelastic stop. Pickup impulses, contact compliance and rebound are not solved.';
 finish(model,g.driverFullTurnPeriod,new THREE.Vector3(.8,.5,15));
}
