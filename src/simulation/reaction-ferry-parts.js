import * as T from 'three';
import {plate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';
import {horizontalRing,horizontalPlate} from './horizontal-turbine-solids.js';
import {hollowPipeBall} from './folding-joint-parts.js';
import {mergePassageParts} from './finite-fluid-passages.js';
import {fitPistonGuide} from './piston-guide-parts.js';
import {LaidRopeGeometry} from './laid-rope.js';
const rectangle=(x0,y0,x1,y1)=>poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
const add=(parent,geometry,material,role,position)=>{const o=new T.Mesh(geometry,material);o.userData.role=role;if(position)o.position.copy(position);parent.add(o);return o;};

export function correctReactionFerry(root){
 const d=root.userData,b=d.blocks,g=d.geometry;
 const outline=poly(b.hull.geometry.parameters.shapes.getPoints(64).map(p=>[p.x,p.y*.65]));
 const wells=[rectangle(.92,-.27,1.38,.27),rectangle(1.67,-.27,2.14,.27)];
 const postHole=poly(circle([g.sternFromBow,0],.075,64));
 // Pass 62: below the gunwale band the hull is a lofted round-bilged body:
 // its sides turn in from the gunwale outline to a flat bottom half the beam
 // 0.30 deeper, and its stem rakes back from the bow while a flat transom
 // stands forward of the rudder stock and bearing (the upper band carries
 // the stock's notch aft of it). The former lower body was a thin slab, so
 // the boat read as a flat, shallow lozenge.
 const transomX=2.44,bandDepth=.17,hullDepth=.47,beamBottom=.5,lengthBottom=.72,rings=12;
 const lowerHull=()=>{
  const ringPoints=clip.intersection(outline,rectangle(-1,-2,transomX,2))[0][0].slice(0,-1);
  // Open the ring at the transom: start just after the starboard corner.
  let area=0;for(let i=0;i<ringPoints.length;i++){const a=ringPoints[i],b=ringPoints[(i+1)%ringPoints.length];area+=a[0]*b[1]-b[0]*a[1];}
  if(area<0)ringPoints.reverse();
  const onTransom=p=>Math.abs(p[0]-transomX)<1e-6;
  let start=ringPoints.findIndex((p,i)=>onTransom(p)&&!onTransom(ringPoints[(i+1)%ringPoints.length]));
  const chain=[];for(let i=0;i<ringPoints.length;i++){const p=ringPoints[(start+i)%ringPoints.length];chain.push(p);if(i>0&&onTransom(p))break;}
  const at=(p,phi)=>{const f=1-Math.cos(phi),x=p[0]<transomX?transomX+(p[0]-transomX)*(1-(1-lengthBottom)*f):p[0];return[x,p[1]*(1-(1-beamBottom)*f),bandDepth+(hullDepth-bandDepth)*Math.sin(phi)];};
  const levels=[...Array(rings+1)].map((_,k)=>chain.map(p=>at(p,k/rings*Math.PI/2)));
  const side=[],index=[];
  for(const level of levels)for(const p of level)side.push(...p);
  const n=chain.length;
  for(let k=0;k<rings;k++)for(let i=0;i<n-1;i++){const a=k*n+i,b=a+1,c=a+n,d=c+1;index.push(a,c,b,b,c,d);}
  const sides=new T.BufferGeometry();sides.setAttribute('position',new T.Float32BufferAttribute(side,3));sides.setIndex(index);sides.computeVertexNormals();
  // Flat caps: the cockpit floor on top, the bottom and the transom.
  const cap=(points2,map,flip)=>{const tris=T.ShapeUtils.triangulateShape(points2.map(p=>new T.Vector2(...p)),[]),pos=[];
   for(const t of tris){const order=flip?[t[0],t[2],t[1]]:t;for(const j of order)pos.push(...map(points2[j]));}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;};
  const top=cap(levels[0].map(p=>[p[0],p[1]]),q=>[q[0],q[1],bandDepth],false);
  const bottom=cap(levels[rings].map(p=>[p[0],p[1]]),q=>[q[0],q[1],hullDepth],true);
  const transom=cap([...levels.map(l=>[l[0][1],l[0][2]]),...levels.slice().reverse().map(l=>[l[n-1][1],l[n-1][2]])],q=>[transomX,q[0],q[1]],false);
  // Orient each cap outward (plate local +z points down into the water).
  const orient=(g,want)=>{g.computeBoundingBox();const nrm=g.attributes.normal,pos=g.attributes.position;let dot=0;for(let i=0;i<nrm.count;i++)dot+=nrm.getX(i)*want[0]+nrm.getY(i)*want[1]+nrm.getZ(i)*want[2];
   if(dot<0){for(let i=0;i<pos.count;i+=3){for(const a of[pos,nrm]){const t=[a.getX(i+1),a.getY(i+1),a.getZ(i+1)];a.setXYZ(i+1,a.getX(i+2),a.getY(i+2),a.getZ(i+2));a.setXYZ(i+2,...t);}}g.computeVertexNormals();}return g;};
  orient(top,[0,0,-1]);orient(bottom,[0,0,1]);orient(transom,[1,0,0]);
  // Side faces wind outward: check against the centroid direction.
  {const c=new T.Vector3(1.4,0,.3),pos=sides.attributes.position,nrm=sides.attributes.normal;let dot=0;for(let i=0;i<pos.count;i++)dot+=(pos.getX(i)-c.x)*nrm.getX(i)+(pos.getY(i)-c.y)*nrm.getY(i);
   if(dot<0){const ix=sides.index.array;for(let i=0;i<ix.length;i+=3){const t=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=t;}sides.computeVertexNormals();}}
  return [sides,top,bottom,transom];
 };
 replace(b.hull,mergePassageParts([
  plate(clip.difference(outline,...wells,postHole,poly(circle([0,0],.14,64))),0,bandDepth),
  ...lowerHull(),
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
 // The anchor stock runs down to the river bed, so the fixed centre is held.
 // Brown's anchor lies on the bed: shank from the ring upstream to the
 // crown, two curved arms with flukes, and a short stock at the ring end.
 const anchorPost=b.anchor.children[0];replace(anchorPost,new T.CylinderGeometry(.07,.08,1.05,24));anchorPost.rotation.set(0,0,Math.PI/2);anchorPost.position.set(-.64,-.07,0);anchorPost.userData.role='anchor-shank-lying-on-river-bed';
 for(const [index,side] of [[2,1],[3,-1]]){const arm=b.anchor.children[index];arm.visible=false;}
 {const crown=new T.Vector3(-1.16,-.07,0);for(const side of[1,-1]){
   const curve=new T.QuadraticBezierCurve3(crown,new T.Vector3(-1.18,-.07,side*.34),new T.Vector3(-.80,-.07,side*.46));
   add(b.anchor,new T.TubeGeometry(curve,16,.055,8,false),anchorPost.material,'anchor-arm');
   const fluke=add(b.anchor,new T.ConeGeometry(.12,.26,3),anchorPost.material,'anchor-fluke',new T.Vector3(-.80,-.07,side*.46));fluke.rotation.set(0,0,-Math.PI/2);fluke.scale.set(1,1,.45);}
  const stock=add(b.anchor,new T.CylinderGeometry(.045,.045,.70,16),anchorPost.material,'anchor-stock',new T.Vector3(-.20,-.07,0));stock.rotation.x=Math.PI/2;
  add(b.anchor,new T.SphereGeometry(.085,16,10),anchorPost.material,'anchor-crown',crown);}
 const anchorEye=b.anchor.children[1];replace(anchorEye,hollowPipeBall(.135,.105,.098,64));anchorEye.position.set(0,0,0);anchorEye.rotation.set(0,0,0);
 replace(b.bowRing,hollowPipeBall(.135,.105,.080,64));b.bowRing.position.set(0,0,0);b.bowRing.rotation.set(0,0,0);
 b.ropeStartMarker.userData.role='anchor-rope-swivel-ball';b.ropeEndMarker.userData.role='bow-rope-swivel-ball';
 // The line ends seated in a blind bore to each swivel ball's centre instead
 // of running through the solid ball (a 0.098 overlap before).
 {
  const radius=b.ropeStartMarker.geometry.parameters.radius,bore=b.rope.geometry.parameters.radiusTop+.002,top=Math.sqrt(radius*radius-bore*bore),points=[];
  const a0=Math.atan2(top,bore);
  for(let i=0;i<=32;i++){const a=-Math.PI/2+(a0+Math.PI/2)*i/32;points.push(new T.Vector2(radius*Math.cos(a),radius*Math.sin(a)));}
  points[0].x=0;points.push(new T.Vector2(bore,0),new T.Vector2(0,0));
  const geometry=new T.LatheGeometry(points,48);
  b.ropeStartMarker.geometry.dispose();b.ropeStartMarker.geometry=geometry;b.ropeEndMarker.geometry=geometry;
 }
 // Brown draws the line slack: a laid rope with two gentle plan-view waves.
 // Its chord stays the tether length, and both ends run straight into the
 // swivel bores; tension and sag are not modelled.
 {
  const L=g.tetherLength,n=161,amplitude=.075,points=[];
  for(let i=0;i<n;i++){const s=i/(n-1),w=Math.sin(Math.PI*s)**2;points.push([amplitude*Math.sin(4*Math.PI*s)*w,(s-.5)*L,0]);}
  const geometry=new LaidRopeGeometry(points.map(p=>new T.Vector3(...p)),160,.04,8);geometry.scale(1,1/L,1);
  b.rope.geometry.dispose();b.rope.geometry=geometry;
 }
 // A slim mounting foot joins the bow socket to the hull behind the line entry.
 const bowFoot=add(b.boat,new T.BoxGeometry(.20,.09,.10),post.material,'bow-swivel-mount',new T.Vector3(.13,-.17,0));
 d.ferryWorkingParts={post,bearing,tiller,bladeBracket,anchorPost,anchorEye,bowFoot};
 d.minimumDisplayCycleSeconds=g.cycleDuration;
 d.reconstructionNote='The upstream tether fixes the bow to a circular path. The rudder reverses for the return crossing. This demonstration prescribes the crossing and steering; current forces, cable tension and buoyancy are not solved.';
 fitPistonGuide(root,d.update,g.cycleDuration);
 d.cameraDirection=new T.Vector3(0,18,2);d.cameraFov=12;d.cameraDistanceScale=1.02;
 root.traverse(o=>{if([].concat(o.material??[]).some(m=>m.transparent)){o.castShadow=false;o.receiveShadow=false;}});
}
