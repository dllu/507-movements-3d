import * as THREE from 'three';
import {rackPinionGeometry,rackToothGeometry,RACK_PRESSURE_ANGLE} from './rack-pinion-parts.js';
import {plate,poly,circle,ring,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
const hull=points=>{const p=points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),half=list=>{const out=[];for(const q of list){while(out.length>1&&cross(out.at(-2),out.at(-1),q)<=0)out.pop();out.push(q);}return out.slice(0,-1);};return [...half(p),...half(p.slice().reverse())];};
const rect=(w,h)=>poly([[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]);
// Without an explicit addendum the teeth are cut to a contact ratio of one.
export function stampMeshParameters(radius,teeth,explicitAddendum){
 const pressureAngle=RACK_PRESSURE_ANGLE,base=radius*Math.cos(pressureAngle),pitch=2*Math.PI*radius/teeth;
 const ratioFor=a=>(a/Math.sin(pressureAngle)+Math.sqrt((radius+a)**2-base**2)-radius*Math.sin(pressureAngle))/(pitch*Math.cos(pressureAngle));
 let low=.001,high=radius*.3;
 for(let i=0;i<64;i++){const a=(low+high)/2;if(ratioFor(a)>1)high=a;else low=a;}
 const addendum=explicitAddendum??(low+high)/2,approach=addendum/Math.sin(pressureAngle),pitchContactAngle=approach/base;
 return{addendum,pressureAngle,baseRadius:base,rootRadius:radius-addendum-.006,tipRadius:radius+addendum,contactRatio:explicitAddendum===undefined?1:ratioFor(addendum),
  gearBaseAngle:Math.PI+Math.PI/(2*teeth)+pitchContactAngle,rackOffset:pitch/4-radius*pitchContactAngle};
}
// Brown's rack and mutilated pinion both have square teeth. The rack keeps
// nearly parallel (6 degree) flanks, and each pinion tooth is the envelope
// the rack cuts as it rolls on the pitch circle, so the pair is conjugate
// (exact pitch-line lift, no interference) while both read as square teeth.
// Rack frame: pitch line y=0, tips toward +y by tipDepth, root at -rootDepth.
export const SQUARE_STAMP_TEETH={pressureAngle:6*Math.PI/180,tipDepth:.10,rootDepth:.20,rackThickness:.40,tipClearance:.012,driveBacklash:.0008,returnBacklash:.004};
export function squareStampTeeth(radius,teeth,options=SQUARE_STAMP_TEETH){
 const {pressureAngle,tipDepth,rootDepth,rackThickness,tipClearance,driveBacklash,returnBacklash}=options,pitch=2*Math.PI*radius/teeth,halfPitchAngle=Math.PI/teeth,
  widthAt=y=>rackThickness*pitch/2-y*Math.tan(pressureAngle),
  rack=[[-widthAt(-rootDepth-.02),-rootDepth-.02],[widthAt(-rootDepth-.02),-rootDepth-.02],[widthAt(tipDepth),tipDepth],[-widthAt(tipDepth),tipDepth]];
 // Pinion-tooth frame: tooth along +x; the rack's pitch line is x=radius
 // with its teeth pointing toward -x and a gap centred on the tooth at zero
 // roll. Rolling by theta moves the rack r*theta along y.
 const rootRadius=radius-tipDepth,tipRadius=radius+rootDepth-tipClearance,radii=[],samples=160,rolls=3000;
 for(let i=0;i<=samples;i++)radii.push(rootRadius+(tipRadius-rootRadius)*i/samples);
 const halfWidth=radii.map(()=>halfPitchAngle);
 for(let j=0;j<=rolls;j++){
  const theta=-.62+1.24*j/rolls,c=Math.cos(-theta),sn=Math.sin(-theta);
  for(let k=-2;k<=2;k++){
   const centre=pitch/2+k*pitch+radius*theta;
   const ring=rack.map(([u,v])=>{const x=radius-v,y=centre+u;return[x*c-y*sn,x*sn+y*c];});
   for(let e=0;e<ring.length;e++){
    const [ax,ay]=ring[e],[bx,by]=ring[(e+1)%ring.length],dx=bx-ax,dy=by-ay,aa=dx*dx+dy*dy,bb=2*(ax*dx+ay*dy);
    radii.forEach((rho,i)=>{
     const disc=bb*bb-4*aa*(ax*ax+ay*ay-rho*rho);if(disc<0)return;
     for(const sign of[-1,1]){const t=(-bb+sign*Math.sqrt(disc))/(2*aa);if(t<0||t>1)continue;const angle=Math.atan2(ay+t*dy,ax+t*dx);if(angle>0&&angle<halfWidth[i])halfWidth[i]=angle;}
    });
   }
  }
 }
 // The -y flank leads (it lifts the rack as the pinion turns clockwise with
 // this tooth on its rack side); the trailing flank takes the backlash.
 const lower=radii.map((rho,i)=>{const a=Math.max(0,halfWidth[i]-driveBacklash/rho);return[rho*Math.cos(a),-rho*Math.sin(a)];}),
  upper=radii.map((rho,i)=>{const a=Math.max(0,halfWidth[i]-returnBacklash/rho);return[rho*Math.cos(a),rho*Math.sin(a)];}).reverse(),
  inner=radius-tipDepth-.05,tip=[],from=Math.atan2(lower.at(-1)[1],lower.at(-1)[0]),to=Math.atan2(upper[0][1],upper[0][0]);
 for(let i=1;i<12;i++){const a=from+(to-from)*i/12;tip.push([tipRadius*Math.cos(a),tipRadius*Math.sin(a)]);}
 const tooth=[[inner*Math.cos(halfPitchAngle),-inner*Math.sin(halfPitchAngle)],...lower,...tip,...upper,[inner*Math.cos(halfPitchAngle),inner*Math.sin(halfPitchAngle)]];
 return{rack:rack.map(([u,v])=>[u,v]),tooth,rootRadius,tipRadius,pitch,...options};
}
export function correctStampParts(model){
 const {root}=model,d=root.userData,b=d.blocks,g=d.geometry,square=squareStampTeeth(g.pitchRadius,g.virtualToothCount),
  p={...stampMeshParameters(g.pitchRadius,g.virtualToothCount,g.meshAddendum),addendum:square.tipDepth,rootRadius:square.rootRadius-.006,tipRadius:square.tipRadius,rackRootDepth:square.rootDepth,square};
 const tooth=plate(poly(square.tooth),-g.gearDepth/2,g.gearDepth/2);
 b.gearTeeth.forEach((o,i)=>{replace(o,tooth);o.rotation.z=i*g.toothPitchAngle;});
 // Rack tooth outline is drawn tips toward +y, then turned so the tips face
 // the pinion (+x), like rackToothGeometry.
 const rackTooth=plate(poly(square.rack),-g.rackDepth/2,g.rackDepth/2).rotateZ(-Math.PI/2);
 b.rackTeeth.forEach(o=>{replace(o,rackTooth);o.position.x=g.pitchLineX;});
 g.rackToothTipX=g.pitchLineX+square.tipDepth;g.rackToothRootX=g.pitchLineX-square.rootDepth;g.gearRootRadius=p.rootRadius;g.gearOuterRadius=square.tipRadius;
 replace(b.gearBody,ring(.108,p.rootRadius,-g.gearDepth/2,g.gearDepth/2,96));b.gearBody.rotation.set(0,0,0);
 replace(b.pinionHub,ring(.108,.17,-.36,.36,64));b.pinionHub.rotation.set(0,0,0);
 replace(b.shaftBearing,ring(.108,.25,-.15,.15,64));b.shaftBearing.rotation.set(0,0,0);
 const right=g.pitchLineX-square.rootDepth;
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
function finish(model,seconds,direction){const d=model.root.userData;d.hideGround=true;d.minimumDisplayCycleSeconds=seconds;d.cameraFov=8;d.cameraDistanceScale=1;const bounds=d.geometry.cyclePeriod?[[-.9,-7.6,-.65],[2.4,7.5,1]]:[[-4.6,-.96,-.92],[4.4,4.7,.9]];d.cameraFitBounds=new THREE.Box3(new THREE.Vector3(...bounds[0]),new THREE.Vector3(...bounds[1]));model.cameraDirection=direction;model.root.traverse(o=>{for(const m of[].concat(o.material??[]))m.fog=false;});}
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
 const outer=poly(hull([[-3.26,.39],[-3.26,.82],...circle(g.followerCenterLocal.toArray(),g.followerRadius,96)]));replace(b.helve,plate(clip.difference(outer,poly(circle([0,0],.123,64))),-g.hammerDepth/2,g.hammerDepth/2));
 // The round wear nose projects from the helve face; coincident caps flicker.
 b.helve.position.z=.14;
 const head=b.hammerHead.geometry.parameters,headOutline=poly(head.shapes.extractPoints(32).shape.map(p=>p.toArray())),a=g.impactHammerAngle,y=g.anvilTopY-g.hammerPivot.y,rotate=(x,y)=>[x*Math.cos(a)+y*Math.sin(a),-x*Math.sin(a)+y*Math.cos(a)],above=poly([rotate(-10,y),rotate(10,y),rotate(10,10),rotate(-10,10)]);
 replace(b.hammerHead,plate(clip.intersection(headOutline,above),-.34,.34));
 for(const o of[b.base,b.contactMarker,b.impactMarker,b.camFaceRing,b.camIndicator,b.hammerIndicator,b.helveOutline,b.headOutline,b.movingPivotRing,b.pivotPost])o.visible=false;
 // Brown draws no fulcrum post: a minimal bearing block stays hidden behind the journal block.
 replace(b.pivotBridge,plate(clip.difference(rect(.62,.24),poly(circle([0,0],.123,64))),-.30,.30));
 const oldUpdate=model.update;model.update=time=>{oldUpdate(time);b.contactMarker.visible=false;b.impactMarker.visible=false;};model.update(0);
 // Brown draws the round-topped cam post in front of the wiper wheel on a
 // base block, its two braces beside it. The post, cap and braces move to a
 // plane in front of the wheel and wipers (whose faces end at z=0.22), and
 // the helve is thinned to a plane in front of the wipers so only the proud
 // wear nose meets them.
 const postFront=.28,postDepth=.18,postZ=postFront+postDepth/2;
 {const o=b.camPost,box=new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position),w=box.max.x-box.min.x,h=box.max.y-box.min.y;
  replace(o,plate(clip.difference(rect(w,h),poly(circle([g.camCenter.x-o.position.x,g.camCenter.y-o.position.y],.123,64))),-postDepth/2,postDepth/2));o.position.z=postZ;}
 replace(b.camPostCap,plate(clip.difference(capsule([0,-.23],[0,.23],.32,32),poly(circle([0,.21],.123,64))),-postDepth/2,postDepth/2));b.camPostCap.position.z=postZ;
 for(const brace of[b.camBraceLeft,b.camBraceRight])brace.position.z+=postZ+.48;
 const helveFront=.365,helveBack=.23,helveOutline=poly(hull([[-3.26,.39],[-3.26,.82],...circle(g.followerCenterLocal.toArray(),g.followerRadius,96)]));
 replace(b.helve,plate(clip.difference(helveOutline,poly(circle([0,0],.123,64))),-(helveFront-helveBack)/2,(helveFront-helveBack)/2));root.updateMatrixWorld(true);{const box=new THREE.Box3().setFromObject(b.helve);b.helve.position.z+=(helveFront+helveBack)/2-(box.min.z+box.max.z)/2;}
 const postBox=new THREE.Box3().setFromBufferAttribute(b.camPost.geometry.attributes.position),groundY=b.camPost.position.y+postBox.min.y;
 const postBase=new THREE.Mesh(new THREE.BoxGeometry(2.1,.20,1.3),b.camPost.material);postBase.position.set(g.camCenter.x,groundY-.10,-.10);postBase.userData.fixed=true;postBase.userData.role='fixed-base-block-under-cam-post';b.camPost.parent.add(postBase);b.postBase=postBase;
 d.stampTripParts={};
 d.reconstructionNote='The radial wiper face lifts the rounded tail of a first-order lever. The released hammer follows an assumed compound-pendulum mass model and an ideal inelastic stop. Pickup impulses, contact compliance and rebound are not solved.';
 finish(model,g.driverFullTurnPeriod,new THREE.Vector3(.8,.5,15));
}
