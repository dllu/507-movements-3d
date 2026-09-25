import * as THREE from 'three';
import profiles from './chain-drive-profiles.js';
import {plate,ring,polygonClipping as clip} from './finite-plate-geometry.js';
const TAPER_SIDE_228=1;
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
// 227: Brown's pulley is a clean, regular six-pointed wheel. Each tooth
// stands through an edge-on loop link; the flat plate links lie on straight
// flats between the teeth. The profile is analytic: a flat under each plate
// link, a concave notch hugging each plate link's round end at the joint (the
// driving face, 0.0008 clear), and concave flanks rising to a sharp point.
export function cleanSprocketProfile227(g,options={}){
 const R=g.pitchRadius,half=g.chainNodeStep/2,e=g.plateLinkEndRadius+(options.clearance??.0008),
  tip=options.tipRadius??2.62,depart=(options.departDegrees??38)*Math.PI/180,tipHalf=options.tipHalfWidth??.2,
  arcSteps=24,curveSteps=40,outer=[];
 const P=(a,r)=>[Math.cos(a)*r,Math.sin(a)*r],rot=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
 // Upper half of the tooth at angle 0: joint N at +half; the valley flat
 // faces direction +2*half; the notch runs from the flat's tangent point
 // (psi = 2*half+pi) round the joint to the departure psi0+depart.
 const N=P(half,R),psi0=2*half+Math.PI,psi1=psi0+depart,D=[N[0]+e*Math.cos(psi1),N[1]+e*Math.sin(psi1)],
  t=[-Math.sin(psi1),Math.cos(psi1)],k=(D[1]-tipHalf)/-t[1],C=[D[0]+k*t[0],D[1]+k*t[1]],T=[tip,0];
 const upper=[];// from the tip down to the valley flat
 for(let i=0;i<=curveSteps;i++){const s=1-i/curveSteps,a=(1-s)*(1-s),b=2*s*(1-s),c=s*s;upper.push([a*D[0]+b*C[0]+c*T[0],a*D[1]+b*C[1]+c*T[1]]);}
 for(let i=1;i<=arcSteps;i++){const psi=psi1-(psi1-psi0)*i/arcSteps;upper.push([N[0]+e*Math.cos(psi),N[1]+e*Math.sin(psi)]);}
 const tooth=[...upper.slice().reverse().map(p=>[p[0],-p[1]]),...upper.slice(1)];
 for(let n=0;n<g.sprocketToothCount;n++)for(const p of tooth)outer.push(rot(p,g.toothCenterPhase+n*g.toothStep));
 outer.push(outer[0]);
 const hole=[];for(let i=0;i<=96;i++)hole.push(P(-i/96*2*Math.PI,g.shaftHoleRadius));
 return [[outer.map(p=>p.map(v=>+v.toFixed(8))),hole.map(p=>p.map(v=>+v.toFixed(8)))]];
}
export function correctChainDrive(model,id){
 const {root}=model,d=root.userData,b=d.blocks,g=d.geometry;
 const wheel=id===227?b.sprocket:id===229?b.wheel:null;
 const originalWheelPolygons=wheel?[wheel.geometry.parameters.shapes.extractPoints(64).shape.map(p=>p.toArray())]:null;
 d.chainDriveParts={originalWheelPolygons};
 if(id===227)replace(wheel,plate(cleanSprocketProfile227(g),-g.sprocketDepth/2,g.sprocketDepth/2));
 else if(profiles[id]){
  if(wheel)replace(wheel,plate(profiles[id],-(g.sprocketDepth??g.wheelDepth)/2,(g.sprocketDepth??g.wheelDepth)/2));
  else {
   // 228: Brown draws slender triangular wedges standing on the rim. Keep
   // the generated driving notch against the rung (up to its centre radius)
   // and cut the rest to a pointed tent about 0.4 wide at the rim and 0.47
   // proud (the apex rises above the generated blank, clear of the rungs).
   const s=TAPER_SIDE_228,taper=[[[[1.55,-.75*s],[2.03,-.75*s],[2.03,-.6*s],[2.42,-.31*s],[1.95,-.08*s],[1.55,-.08*s],[1.55,-.75*s]]]];
   const cap=[[[[2.03,-.47*s],[2.42,-.31*s],[1.99,-.1*s],[2.03,-.47*s]]]];
   const outline=id===228?clip.union(clip.intersection(profiles[id],taper),cap):profiles[id];
   const geometry=plate(outline,-g.toothDepth/2,g.toothDepth/2);for(const tooth of b.teeth)replace(tooth,geometry);
  }
 }
 if(id===228){
  replace(b.disk,ring(g.shaftRadius+.003,g.diskRadius,-g.diskDepth/2,g.diskDepth/2,96));b.disk.rotation.set(0,0,0);
  replace(b.hub,ring(g.shaftRadius+.003,g.hubRadius,-g.hubDepth/2,g.hubDepth/2,64));b.hub.rotation.set(0,0,0);
 }
 if(id!==228)replace(b.hub,ring(g.shaftHoleRadius*(id===227?.72:.68)+.003,g.hubOuterRadius,-(g.hubDepth??.34)/2,(g.hubDepth??.34)/2,64));
 b.cameraEnvelope.visible=false;
 const bounds={227:[[-2.7,-4.7,-.74],[2.7,3.1,.74]],228:[[-2.65,-4.75,-.89],[2.65,3.35,.89]],229:[[-3.5,-2.35,-.64],[3.5,3.25,.64]]}[id];
 d.cameraFitBounds=new THREE.Box3(new THREE.Vector3(...bounds[0]),new THREE.Vector3(...bounds[1]));
 d.cameraFov=8;d.cameraDistanceScale=1;
 d.hideGround=true;d.minimumDisplayCycleSeconds=4;
 d.reconstructionNote='Rigid chain links follow a prescribed, continuous chordal path with exact pitch. Working pulley profiles have finite clearance for entry and exit. Tension, load sharing, backlash take-up and elastic chain dynamics are not solved.';
 root.traverse(o=>{for(const m of [].concat(o.material??[]))m.fog=false;});
 // 228: the plate looks at the disk face from well to the left and above,
 // the shaft running back and up to the left.
 model.cameraDirection=new THREE.Vector3(id===228?-9:.9,id===228?3.6:.6,id===228?7:14);
}
