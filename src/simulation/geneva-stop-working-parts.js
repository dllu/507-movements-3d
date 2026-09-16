import * as T from 'three';
import {plate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';
import {finishGeneva215Contact} from './geneva-stop-215-contact.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';

// The source's exact working sections are extruded without outward cosmetic
// bevels. A bevel must never enlarge the pin-slot or locking contact envelope.
function unexpanded(o){const {shapes,options}=o.geometry.parameters;const geometry=new T.ExtrudeGeometry(shapes,{depth:options.depth,bevelEnabled:false,curveSegments:32,steps:1});geometry.translate(0,0,-options.depth/2);o.geometry.dispose();o.geometry=geometry;}
export function finishGenevaWorkingParts(model,id){
 const {root,update}=model,d=root.userData,b=d.blocks;
 if(id===215){
  unexpanded(b.lockingCamBody);unexpanded(b.stopWheelBody);d.geometry.stopWheelBevelThickness=0;d.geometry.axialLayerGap=.085;
  const old=b.facePin.geometry,p=old.parameters;b.facePin.geometry=new T.CylinderGeometry(p.radiusTop,p.radiusBottom,p.height,128);old.dispose();
  d.reconstructionNote='The analytical pin law fits the interior radial slots and terminal faces. A short pin-to-slot-mouth collision remains near engagement handoff. Drive and reversal are prescribed; that handoff, friction, impact and loading are not physically qualified.';
 }else d.reconstructionNote='The official animation supplies the indexing schedule. Its broad finger does not maintain exact contact throughout that schedule: small midstroke overlap and intervals of clearance remain. Locking-arc tessellation is improved; loaded indexing is not yet qualified.';
 const supportPlates=[];
 for(let i=0;i<2;i++){
  const center=i===0?d.geometry.driverCenter:d.geometry.stopWheelCenter,old=id===215?b.uprights[i]:b.bearingArms[i],radius=id===215?.119:i===0?.089:.086;
  const outline=id===215?poly([[-.075,-3.72],[.075,-3.72],[.075,0],[-.075,0]]):poly([[-2.2,-.065],[0,-.065],[0,.065],[-2.2,.065]]);
  const region=clip.difference(clip.union(outline,poly(circle([0,0],id===215?.235:.18,96))),poly(circle([0,0],radius,96)));
  const support=new T.Mesh(plate(region,-.08,.08),old.children[0].material);support.position.set(center.x,center.y,id===215?-.8:-.77);support.userData.role=`${id}-bored-fixed-shaft-support-${i}`;support.castShadow=true;support.receiveShadow=true;old.visible=false;root.add(support);supportPlates.push(support);
 }
 d.workingSupports=supportPlates;
 if(id===212)for(const[hub,radius]of[[b.driverHub,.083],[b.stopWheelHub,.080]]){const g=hub.geometry;g.computeBoundingBox();const outer=Math.max(Math.abs(g.boundingBox.min.x),Math.abs(g.boundingBox.max.x));hub.geometry=boredLatheGeometry([{axial:-.10,radial:outer},{axial:.10,radial:outer}],radius,96).rotateX(Math.PI/2);g.dispose();}
 d.hideGround=true;d.minimumDisplayCycleSeconds=id===215?16:14;
 root.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)m.fog=false;});
 const bounds=new T.Box3();for(let i=0;i<=32;i++){update(d.timeline.demonstrationPeriod*i/32);root.updateMatrixWorld(true);root.traverseVisible(o=>{if(o.geometry){o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});}update(0);d.cameraFitBounds=bounds;d.cameraDistanceScale=1.04;model.cameraDirection=new T.Vector3(.6,.5,12);return id===215?finishGeneva215Contact(model):model;
}
