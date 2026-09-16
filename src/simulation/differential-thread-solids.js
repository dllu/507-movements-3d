import * as THREE from 'three';
import {helicalThread,threadAngles} from './mujoco-screw/thread-geometry.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
function thread(profile,axis='z',quarter=false){let g=helicalThread(profile,threadAngles(profile,128));if(quarter)g.rotateZ(Math.PI/2);if(axis==='x')g.rotateY(Math.PI/2);if(axis==='y')g.rotateX(-Math.PI/2);return g;}
function annulus(inner,outer,depth){return boredLatheGeometry([{radial:outer,axial:-depth/2},{radial:outer,axial:depth/2}],inner,64);}
function spurBore(gear,bore,depth=null){
 const rotor=gear.userData.rotor,body=rotor.children[0],p=body.geometry.parameters,shape=p.shapes.clone(),hole=new THREE.Path();hole.absarc(0,0,bore,0,2*Math.PI,true);shape.holes.push(hole);
 replace(body,new THREE.ExtrudeGeometry(shape,{...p.options,curveSegments:48}).translate(0,0,-p.options.depth/2));body.userData.boreRadius=bore;
 const hub=rotor.children[1],hp=hub.geometry.parameters;replace(hub,annulus(bore,Math.max(hp.radiusTop,bore+.03),depth??hp.height));hub.userData.boreRadius=bore;
 const mark=rotor.children[3],start=Math.max(bore+.045,gear.userData.radius*.22),end=Math.max(start+.06,gear.userData.radius*.72);
 replace(mark,new THREE.BoxGeometry(end-start,.04,.024));mark.position.x=(start+end)/2;
}
export function correctDifferentialThreads(root,id){
 const b=root.userData.blocks,g=root.userData.geometry;
 root.userData.hideGround=true;
 if(id===260){
  const pitch=g.screwLead,external={inner:g.screwCoreRadius,outer:.367,low:g.externalThreadStartX,high:g.externalThreadEndX,width:pitch/2,lead:pitch/(2*Math.PI),phase:g.externalThreadStartX};
  const internal={inner:g.screwCoreRadius+.002,outer:.369,low:g.fixedGearStationX-g.nutWidth/2,high:g.fixedGearStationX+g.nutWidth/2,width:pitch/2-.004,lead:external.lead,phase:external.phase+pitch/2};
  replace(b.externalThread,thread(external,'x',true));replace(b.internalThread,thread(internal,'x',true));
  replace(b.nutSleeve,annulus(.369,g.nutOuterRadius,g.nutWidth));b.nutSleeve.material.transparent=false;b.nutSleeve.material.opacity=1;b.nutSleeve.userData.role='bored-rotating-nut-secured-in-wheel-E-hub';
  // makeAxialCylinder already orients its Y-axis to X.
  for(const [gear,r,d]of[[b.longPinionF,.142,g.longPinionFaceWidth+.04],[b.pinionB,.142],[b.wheelD,.237],[b.wheelE,.371]])spurBore(gear,r,d);
  // Each crosshead has a real passage, including the rotating nut journal.
  for(const [bridge,radius,height,axisY]of[[b.tallStandardTop,.195,.80,g.upperAxisY],[b.rightStandardTop,.512,1.44,g.lowerAxisY]]){
   const p=bridge.geometry.parameters,shape=new THREE.Shape();shape.moveTo(-p.depth/2,-height/2);shape.lineTo(p.depth/2,-height/2);shape.lineTo(p.depth/2,height/2);shape.lineTo(-p.depth/2,height/2);shape.closePath();
   const hole=new THREE.Path();hole.absarc(0,axisY-bridge.position.y,radius,0,2*Math.PI,true);shape.holes.push(hole);
   replace(bridge,new THREE.ExtrudeGeometry(shape,{depth:p.width,bevelEnabled:false,curveSegments:64}).translate(0,0,-p.width/2).rotateY(Math.PI/2));bridge.userData.boreRadius=radius;
  }
  for(const bar of b.rightStandardBars){replace(bar,new THREE.BoxGeometry(.25,2,.3));bar.position.y=-2.27;}
  const sleeveExtension=new THREE.Mesh(annulus(.369,.51,.58).rotateZ(Math.PI/2),b.internalThread.material);sleeveExtension.position.x=2.24;sleeveExtension.userData.role='nut-journal-extension-through-fixed-bearing';b.nutAssembly.add(sleeveExtension);b.nutJournal=sleeveExtension;
  // A stationary bored collar locates the nut extension; its supports tie
  // it to both upright bars without crossing the screw passage.
  replace(b.fixedNutBearing,annulus(.512,.72,.23).rotateX(Math.PI/2));b.fixedNutBearing.position.x=2.3;
  b.contactMarkerBE.visible=false;b.contactMarkerFD.visible=false;
  root.userData.threadProfiles={external,internal};root.userData.minimumDisplayCycleSeconds=18;
  root.userData.reconstructionNote='Two unequal gear reductions turn the screw and its axially fixed nut at different speeds. Their relative rotation produces the slow axial feed. The displayed reversal and thread proportions are reconstructed.';
 }else if(id===266){
  const profiles={};
  for(const [key,pitch,start,end,bearing,x,depth]of[['fixed',g.fixedThreadPitch,g.fixedThreadStart,g.fixedThreadEnd,b.fixedBearing,g.fixedBearingX,g.fixedBearingDepth],['moving',g.movingThreadPitch,g.movingThreadStart,g.movingThreadEnd,b.movingBearing,g.movingBearingInitialX,g.movingBearingDepth]]){
   const external={inner:g.shaftCoreRadius,outer:.205,low:start,high:end,width:pitch/2,lead:pitch/(2*Math.PI),phase:start};
   const internal={inner:g.shaftCoreRadius+.002,outer:.226,low:-depth/2,high:depth/2,width:pitch/2-.004,lead:external.lead,phase:start+pitch/2-x};
   replace(b[`${key}Thread`],thread(external));b[`${key}Thread`].material.color.copy(b.shaftCore.material.color);
   const mesh=new THREE.Mesh(thread(internal,'x'),b[`${key}BearingBody`].material);mesh.userData.role=`${key}-matching-internal-square-thread`;bearing.add(mesh);b[`${key}InternalThread`]=mesh;
   for(const collar of b[`${key}BearingCollars`])replace(collar,annulus(.208,.28,.025).rotateX(Math.PI/2));
   profiles[key]={external,internal};
  }
  b.fixedContactMarker.visible=false;b.movingContactMarker.visible=false;
  root.userData.threadProfiles=profiles;root.userData.minimumDisplayCycleSeconds=12;
  root.userData.reconstructionNote='Each turn advances the shaft by the coarse pitch; the finer thread subtracts from that motion, leaving 0.06 units of bearing travel per turn. The demonstration reverses before either nut runs off its thread.';
 }
 root.traverse(o=>{for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material)material.fog=false;});
}
export function correctWormRack(root){
 const b=root.userData.blocks,g=root.userData.geometry,pitch=g.rackToothPitch,lead=pitch/(2*Math.PI);
 const profile={inner:g.wormCoreRadius,outer:.78,low:g.wormThreadMinimumY,high:g.wormThreadMaximumY,width:.32,lead,phase:g.sourceActiveToothY};
 replace(b.wormThread,thread(profile,'y'));
 b.wormThread.material.color.copy(b.wormCore.material.color);b.wormThread.userData.profile='integral-square-thread';
 // Helicoidal rack flanks match the actual square-thread worm across the
 // finite tooth width, rather than intersecting it as flat rectangular bars.
 for(const tooth of b.rackTeeth){const p=tooth.geometry.parameters,geometry=new THREE.BoxGeometry(p.width,p.height,p.depth,12,1,16),a=geometry.attributes.position;for(let i=0;i<a.count;i++){const x=a.getX(i)+tooth.position.x,z=a.getZ(i);a.setY(i,a.getY(i)+lead*Math.atan2(z,g.wormAxisX-x));}geometry.computeVertexNormals();replace(tooth,geometry);}
 for(const o of[b.base,b.baseStem,b.rearPost,...b.wormBearings,...b.rackGuides,b.contactIndex,b.threadIndex])o.visible=false;
 b.rotationIndex.position.set(.18,1.75,0);
 root.userData.threadProfiles={external:profile};root.userData.hideGround=true;root.userData.minimumDisplayCycleSeconds=8;
 root.userData.reconstructionNote='One worm turn moves the rack by one tooth pitch. The integral thread and mating flanks are reconstructed across their width; the smooth reversal keeps this finite rack in view.';
 root.userData.cameraFitBounds=new THREE.Box3(new THREE.Vector3(-1.10,-3.10,-1.05),new THREE.Vector3(1.40,4.45,.82));
 root.userData.sampledMotionBounds={min:root.userData.cameraFitBounds.min.toArray(),max:root.userData.cameraFitBounds.max.toArray()};
 root.traverse(o=>{for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material)material.fog=false;});
}
