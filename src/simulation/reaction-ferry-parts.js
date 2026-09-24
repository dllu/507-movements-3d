import * as T from 'three';
import {plate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';
import {horizontalRing,horizontalPlate} from './horizontal-turbine-solids.js';
import {hollowPipeBall} from './folding-joint-parts.js';
import {mergePassageParts} from './finite-fluid-passages.js';
import {fitPistonGuide} from './piston-guide-parts.js';
const rectangle=(x0,y0,x1,y1)=>poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
const add=(parent,geometry,material,role,position)=>{const o=new T.Mesh(geometry,material);o.userData.role=role;if(position)o.position.copy(position);parent.add(o);return o;};

export function correctReactionFerry(root){
 const d=root.userData,b=d.blocks,g=d.geometry;
 b.river.position.y=g.waterY-.09;
 const outline=poly(b.hull.geometry.parameters.shapes.getPoints(64).map(p=>[p.x,p.y*.65]));
 const wells=[rectangle(.92,-.27,1.38,.27),rectangle(1.67,-.27,2.14,.27)];
 const postHole=poly(circle([g.sternFromBow,0],.075,64));
 replace(b.hull,mergePassageParts([
  plate(clip.difference(outline,...wells,postHole,poly(circle([0,0],.14,64))),0,.17),
  plate(clip.difference(outline,postHole),.17,.34),
 ]));
 b.hull.position.y=-.03;
 replace(b.deck,plate(clip.difference(rectangle(.77,-.3445,2.39,.3445),...wells),0,.1));
 b.deck.position.set(0,.04,0);b.deck.rotation.x=Math.PI/2;
 for(let i=0;i<2;i++){
  const [x0,x1]=i?[1.67,2.14]:[.92,1.38];
  replace(b.cockpitFrames[i],horizontalPlate(clip.difference(rectangle(x0-.045,-.315,x1+.045,.315),wells[i]),.025,.075));
  b.cockpitFrames[i].position.set(0,0,0);b.cockpitFrames[i].rotation.set(0,0,0);b.cockpitFrames[i].scale.set(1,1,1);
 }
 // A vertical blade and stock sit in the current; a separate tiller remains
 // visible in Brown's plan view. The previous horizontal plank floated above it.
 const post=b.rudderPivot.children[0];replace(post,new T.CylinderGeometry(.07,.07,.88,32));post.position.y=-.24;
 replace(b.rudderBlade,new T.BoxGeometry(.91,.54,.10));b.rudderBlade.position.set(.685,-.48,0);
 const bladeBracket=add(b.rudderPivot,new T.BoxGeometry(.42,.08,.08),post.material,'submerged-rudder-blade-bracket',new T.Vector3(.18,-.70,0));
 const tiller=add(b.rudderPivot,new T.BoxGeometry(1.12,.07,.12),b.rudderBlade.material,'rudder-tiller',new T.Vector3(.50,.08,0));
 // Brown's tiller ends flat; the former white ball tip is not drawn.
 const rudderTip=b.rudderPivot.children[2];b.rudderPivot.remove(rudderTip);rudderTip.geometry.dispose();
 const bearing=add(b.boat,horizontalRing(.075,.135,-.07,.07,64),post.material,'bored-rudder-stock-bearing',new T.Vector3(g.sternFromBow,-.20,0));
 // Inferred compact swivels join the taut line to fixed anchor and bow.
 const anchorPost=b.anchor.children[0];replace(anchorPost,new T.CylinderGeometry(.12,.15,.42,32));anchorPost.position.y=-.335;
 const anchorEye=b.anchor.children[1];replace(anchorEye,hollowPipeBall(.135,.105,.098,64));anchorEye.position.set(0,0,0);anchorEye.rotation.set(0,0,0);
 replace(b.bowRing,hollowPipeBall(.135,.105,.080,64));b.bowRing.position.set(0,0,0);b.bowRing.rotation.set(0,0,0);
 b.ropeStartMarker.userData.role='anchor-rope-swivel-ball';b.ropeEndMarker.userData.role='bow-rope-swivel-ball';
 // A slim mounting foot joins the bow socket to the hull behind the line entry.
 const bowFoot=add(b.boat,new T.BoxGeometry(.20,.09,.10),post.material,'bow-swivel-mount',new T.Vector3(.13,-.17,0));
 d.ferryWorkingParts={post,bearing,tiller,bladeBracket,anchorPost,anchorEye,bowFoot};
 d.minimumDisplayCycleSeconds=g.cycleDuration;
 d.reconstructionNote='The upstream tether fixes the bow to a circular path. The rudder reverses for the return crossing. This demonstration prescribes the crossing and steering; current forces, cable tension and buoyancy are not solved.';
 fitPistonGuide(root,d.update,g.cycleDuration);
 d.cameraDirection=new T.Vector3(0,18,2);d.cameraFov=12;d.cameraDistanceScale=1.02;
 root.traverse(o=>{if([].concat(o.material??[]).some(m=>m.transparent)){o.castShadow=false;o.receiveShadow=false;}});
}
