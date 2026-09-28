import * as THREE from 'three';
import {createAuthoredStudDriveMovement} from '../authored-stud-drives.js';
import {plate,poly,circle,ring,disk,polygonClipping as clip} from '../finite-plate-geometry.js';
import {disposeObject3D} from '../dispose-model.js';

// Reconstruction hypothesis: raise the inner input arm above the disk studs,
// retaining only its distal driving face at the original working depth.
export function makeRelievedStudReverser({inputContactMinimum=1.4}={}){
 const model=createAuthoredStudDriveMovement({id:153}),u=model.root.userData,b=u.blocks,g=u.geometry,arm=b.inputArm;
 const material=arm.children[0].material,L=g.leverInputLength,h=g.leverInputHalfWidth;
 if(!(inputContactMinimum>h&&inputContactMinimum<L-h))throw new RangeError('Invalid relieved arm length');
 for(const mesh of [...arm.children]){arm.remove(mesh);mesh.geometry.dispose();}
 const rectangle=(l,r)=>poly([[l,-h],[r,-h],[r,h],[l,h]]);
 const working=new THREE.Mesh(plate(clip.union(rectangle(inputContactMinimum,L),poly(circle([L,0],h,96))),-.10,.34),material);
 working.name='distal-input-driving-face';
 const raised=new THREE.Mesh(plate(clip.difference(rectangle(0,inputContactMinimum),poly(circle([0,0],g.leverPivotRadius,96))),.14,.34),material);raised.name='raised-inner-input-arm';
 arm.add(working,raised);arm.userData.blocks={working,raised};g.inputContactMinimum=inputContactMinimum;
 const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;mesh.rotation.set(0,0,0);};
 replace(b.diskBody,ring(.134,g.diskRadius,-g.diskDepth/2,g.diskDepth/2,128));
 replace(b.diskHub,ring(.134,g.hubRadius,.07,.23,96));
 replace(b.diskHubFace,ring(.134,g.hubRadius*.48,-.020,.0175,96));
 replace(b.leverPivotCollar,ring(.114,g.leverPivotRadius,-.17,.36,96));
 // The elbow's boss is part of the lever, as Brown draws it, not a black
 // disk; its front face cap shows the pivot pin's end as his inner circle.
 b.leverPivotCollar.material=material;
 // Run the fixed elbow pin up through the boss to just behind the face cap,
 // so the eye shows its pin rather than an empty bore.
 {const pin=b.fixedFrame.children.find(o=>o.isMesh&&Math.abs(o.position.x-g.leverPivot.x)<1e-6&&Math.abs(o.position.y-g.leverPivot.y)<1e-6);
  if(!pin)throw new Error('Elbow pivot pin not found');const r=pin.geometry.parameters?.radiusTop??.11;
  pin.geometry.dispose();pin.geometry=disk(r,-.54,g.leverPlaneZ+.38,96);pin.rotation.set(0,0,0);pin.position.set(g.leverPivot.x,g.leverPivot.y,0);pin.name='fixed-elbow-pivot-pin';}
 replace(b.leverPivotFace,ring(.114,g.leverPivotRadius*.48,.17,.208,96));
 for(const guide of b.guideRollers){const parts=guide.userData.blocks;replace(parts.wheel,ring(.089,g.guideRollerRadius,-.17,.17,96));replace(parts.hub,ring(.089,g.guideRollerRadius*.30,-.225,.225,96));}
 // The return arm must clear the front of the bar while meeting its projecting pin.
 const output=b.outputArm,outputMaterial=output.children[0].material;
 for(const mesh of [...output.children]){output.remove(mesh);mesh.geometry.dispose();}
 const oh=g.leverOutputHalfWidth,ol=g.leverOutputLength;
 // Brown's return arm is about 20 source pixels wide, tapering towards its
 // end. Its working (+y) edge, which meets the bar's stud, stays where it was;
 // the idle edge is widened, 0.13 at the eye to 0.075 at the end, and the
 // end is a semicircle tangent to both edges.
 const wide=[.13,.075],tip=[ol-.04,-wide[1]/2],tipRadius=oh+wide[1]/2;
 const outputShape=clip.difference(clip.union(poly([[0,-oh-wide[0]],[tip[0],-oh-wide[1]],[tip[0],oh],[0,oh]]),poly(circle(tip,tipRadius,96))),poly(circle([0,0],g.leverPivotRadius,96).map(([x,y])=>{const a=-output.rotation.z;return [x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];})));
 const outputMesh=new THREE.Mesh(plate(outputShape,-.1,.1),outputMaterial);outputMesh.name='bored-return-arm';output.add(outputMesh);output.position.z=.05;output.userData.blocks={body:outputMesh};
 // Keep visible moving volumes disjoint: studs and hubs start at their host faces.
 for(const assembly of b.pinAssemblies){const p=assembly.userData.blocks;replace(p.pin,disk(g.studRadius,.12-g.studCenterZ,.73-g.studCenterZ,96));replace(p.face,disk(g.studRadius*.72,-.022,.020,96));}
 replace(b.barFrontStud,disk(g.barStudRadius,-.03,.21,96));
 replace(b.barFrontStudFace,disk(g.barStudRadius*.70,-.020,.019,96));
 b.barMotionIndex.removeFromParent();b.barMotionIndex.geometry.dispose();
 for(const guide of b.guideRollers){const p=guide.userData.blocks;replace(p.hub,ring(.089,g.guideRollerRadius*.30,.17,.225,96));p.indexMark.removeFromParent();p.indexMark.geometry.dispose();}
 const fixedMaterial=b.fixedFrame.children[0].material;
 const fixed=(name,geometry)=>{const mesh=new THREE.Mesh(geometry,fixedMaterial);mesh.name=name;b.fixedFrame.add(mesh);return mesh;};
 const theta=-g.sourceLeverRestAngle,stopRadius=.08;
 const stop=new THREE.Vector2(.70,-h-stopRadius).rotateAround(new THREE.Vector2(),theta).add(new THREE.Vector2(g.leverPivot.x,g.leverPivot.y));
 b.leverStop=fixed('physical-elbow-rest-stop',disk(stopRadius,.82,1.0,96).translate(stop.x,stop.y,0));
 fixed('rest-stop-support-shaft',disk(.05,-.42,.82,96).translate(stop.x,stop.y,0));
 const box=(name,x0,x1,y0,y1,z0,z1)=>fixed(name,plate(poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]),z0,z1));
 box('rest-stop-back-bracket',g.leverPivot.x,stop.x,stop.y-.06,stop.y+.06,-.48,-.36);
 const bottom=g.barSourceCenter.y-g.barHeight/2,top=g.barSourceCenter.y+g.barHeight/2;
 for(const x of [-1.4,2.1]){
  box('bar-guide-back-'+x,x-.12,x+.12,bottom-.09,top+.09,.20,.292);
  box('bar-guide-upper-'+x,x-.12,x+.12,top+.008,top+.09,.292,.592);
  box('bar-guide-lower-'+x,x-.12,x+.12,bottom-.09,bottom-.008,.292,.592);
  fixed('bar-guide-standoff-'+x,disk(.07,-.42,.20,64).translate(x,g.barSourceCenter.y,0));
  box('bar-guide-post-'+x,x-.07,x+.07,-1.85,g.barSourceCenter.y,-.48,-.36);
 }
 u.hideGround=true;u.cameraFov=18;u.supportsRestart=true;
 model.cameraDirection.set(.02,.03,15);model.reset=()=>model.update(0);model.dispose=()=>disposeObject3D(model.root);
 model.root.updateMatrixWorld(true);return model;
}
