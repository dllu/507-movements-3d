import * as T from 'three';
import {mergeGeometries, mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {plate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';
import {creaseIndexedNormals} from './crease-normals.js';
import {fitPistonGuide} from './piston-guide-parts.js';
import {makeSeeThrough} from './see-through-part.js';

// Movement 395 geometry (pass 90). The cock is two closed solids:
// - the fixed body: one ring with four port pipes, one flat extrusion of
//   their joined outline, bored by one closed square duct per port that runs
//   from the plug's bore to the open pipe end;
// - the plug: one disc bored by two closed quarter-circle passages of the
//   same square section, which meet the body's ducts face to face at either
//   indexed angle.
// Nothing is open except the four pipe ends, so the cock seals. Brown draws
// the passages inside the plug; the plug takes the standard see-through
// style so they show.
export const COCK_HALF_DEPTH=.30,COCK_DUCT_HALF=.20,COCK_PIPE_HALF=.30;

export function cockPassagePath(radius,endpoint,z,opposite=false){
 const path=new T.CurvePath(),sign=opposite?-1:1;
 const p=(x,y)=>new T.Vector3(sign*x,sign*y,z);
 path.add(new T.LineCurve3(p(0,endpoint),p(0,radius)));
 class Bend extends T.Curve{
  getPoint(t,target=new T.Vector3()){const a=-Math.PI*t/2;return target.copy(p(-radius+radius*Math.cos(a),radius+radius*Math.sin(a)));}
  getTangent(t,target=new T.Vector3()){const a=-Math.PI*t/2;return target.set(sign*Math.sin(a),-sign*Math.cos(a),0);}
 }
 path.add(new Bend());path.add(new T.LineCurve3(p(-radius,0),p(-endpoint,0)));
 return path;
}

// Band of half-width `half` about a planar polyline of [point, unit tangent].
function band(samples,half){
 const left=[],right=[];
 for(const[p,t]of samples){left.push([p[0]-t[1]*half,p[1]+t[0]*half]);right.push([p[0]+t[1]*half,p[1]-t[0]*half]);}
 return poly([...left,...right.reverse()]);
}
function curveSamples(curve,count=96){
 return Array.from({length:count+1},(_,i)=>{const p=curve.getPoint(i/count),t=curve.getTangent(i/count).normalize();return[[p.x,p.y],[t.x,t.y]];});
}

// Fixed pipe centreline: radial through the ring, then bending on Brown's
// passage radius toward the corner the upper figure's passage turns to.
function portPipeSamples(u,side,{inner,straightEnd,bend,sweep,extend=0},count=48){
 const out=[];
 for(let i=0;i<=24;i++){const r=inner+(straightEnd-inner)*i/24;out.push([[u[0]*r,u[1]*r],u]);}
 const c=[u[0]*straightEnd+side[0]*bend,u[1]*straightEnd+side[1]*bend];
 for(let i=1;i<=count;i++){
  const a=sweep*i/count;
  out.push([[c[0]-side[0]*bend*Math.cos(a)+u[0]*bend*Math.sin(a),c[1]-side[1]*bend*Math.cos(a)+u[1]*bend*Math.sin(a)],
   [side[0]*Math.sin(a)+u[0]*Math.cos(a),side[1]*Math.sin(a)+u[1]*Math.cos(a)]]);
 }
 if(extend){const[p,t]=out.at(-1);out.push([[p[0]+t[0]*extend,p[1]+t[1]*extend],t]);}
 return out;
}

// Keep only triangles whose normal z-component passes `keep`; optionally
// reverse their winding (for duct ceilings and floors facing into the duct).
function triangles(geometry,keep,flip=false){
 const g=geometry.index?geometry.toNonIndexed():geometry,p=g.attributes.position.array,out=[];
 for(let i=0;i<p.length;i+=9){
  // z of (c-b) x (a-b)
  const ux=p[i+6]-p[i+3],uy=p[i+7]-p[i+4],vx=p[i]-p[i+3],vy=p[i+1]-p[i+4];
  const uz=p[i+8]-p[i+5],vz=p[i+2]-p[i+5];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,len=Math.hypot(nx,ny,nz)||1;
  if(!keep(nz/len))continue;
  if(flip)out.push(p[i],p[i+1],p[i+2],p[i+6],p[i+7],p[i+8],p[i+3],p[i+4],p[i+5]);
  else for(let k=0;k<9;k++)out.push(p[i+k]);
 }
 geometry.dispose();if(g!==geometry)g.dispose();
 const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(out,3));return result;
}

// One closed flat solid of outline `outline` (|z| <= H) containing the duct
// `duct` (|z| <= h), which opens only where it crosses the outline's edge.
export function voidedPlate(outline,duct,H,h){
 const inside=clip.intersection(outline,duct),solidMiddle=clip.difference(outline,duct);
 const side=z=>Math.abs(z)<.5,up=z=>z>.5,down=z=>z<-.5;
 const parts=[
  triangles(plate(solidMiddle,-h,h),side),
  triangles(plate(outline,h,H),z=>side(z)||up(z)),
  triangles(plate(outline,-H,-h),z=>side(z)||down(z)),
  triangles(plate(inside,-h,h),z=>!side(z),true),
 ];
 const merged=mergeVertices(mergeGeometries(parts),1e-5);parts.forEach(g=>g.dispose());
 merged.deleteAttribute('normal');closeTJunctions(merged);creaseIndexedNormals(merged,Math.PI/6);
 if(!merged.attributes.normal)merged.computeVertexNormals();
 return merged;
}

// The layers meet where one has a vertex part way along another's edge;
// split those edges so the solid is watertight (every edge shared by two
// triangles).
function closeTJunctions(geometry){
 const pos=geometry.attributes.position,count=pos.count,P=i=>new T.Vector3().fromBufferAttribute(pos,i);
 let index=Array.from(geometry.index.array);
 for(let pass=0;pass<4;pass++){
  const uses=new Map(),key=(a,b)=>a<b?a+','+b:b+','+a;
  for(let t=0;t<index.length;t+=3)for(let k=0;k<3;k++){const e=key(index[t+k],index[t+(k+1)%3]);uses.set(e,(uses.get(e)??0)+1);}
  const open=[...uses].filter(([,n])=>n===1).map(([e])=>e.split(',').map(Number));
  if(!open.length)break;
  const onEdge=new Map(),used=new Set(open.flat()),a=new T.Vector3(),b=new T.Vector3(),p=new T.Vector3();
  for(const[i,j]of open){
   a.fromBufferAttribute(pos,i);b.fromBufferAttribute(pos,j);const d=b.clone().sub(a),L2=d.lengthSq(),hits=[];
   for(const v of used){if(v===i||v===j)continue;p.fromBufferAttribute(pos,v);const t=p.clone().sub(a).dot(d)/L2;
    if(t<=1e-6||t>=1-1e-6)continue;if(a.clone().addScaledVector(d,t).distanceToSquared(p)<1e-12)hits.push([t,v]);}
   if(hits.length)onEdge.set(key(i,j),{i,hits:hits.sort((x,y)=>x[0]-y[0]).map(h=>h[1])});
  }
  if(!onEdge.size)break;
  const next=[];
  for(let t=0;t<index.length;t+=3){
   const tri=[index[t],index[t+1],index[t+2]];let split=false;
   for(let k=0;k<3&&!split;k++){const u=tri[k],w=tri[(k+1)%3],c=tri[(k+2)%3],hit=onEdge.get(key(u,w));if(!hit)continue;
    const chain=[u,...(hit.i===u?hit.hits:[...hit.hits].reverse()),w];
    for(let m=0;m+1<chain.length;m++)next.push(chain[m],chain[m+1],c);split=true;}
   if(!split)next.push(...tri);
  }
  index=next;
 }
 geometry.setIndex(index);
 return geometry;
}

const PORTS=[['top-steam-supply',[0,1],[-1,0]],['left-cylinder-end',[-1,0],[0,1]],['right-cylinder-end',[1,0],[0,-1]],['bottom-exhaust',[0,-1],[1,0]]];

export function correctFourWayCock(root){
 const d=root.userData,b=d.blocks;
 for(const channel of Object.values(b.channels)){channel.userData.recess.visible=false;channel.userData.flowCore.visible=false;}
 for(const pipe of Object.values(b.pipes))for(const child of pipe.children)child.visible=false;
 for(const collar of b.portCollars)collar.visible=false;
 d.minimumDisplayCycleSeconds=d.motion.cycleDuration;
 d.reconstructionNote='The cock is sealed: the plug\'s two closed passages meet the body\'s four closed port ducts face to face at either indexed angle; the plug is see-through so its passages show. Flow markers pause during the turn because transient throttling is not modeled.';
 d.cameraDirection=new T.Vector3(.6,.6,15);d.cameraFov=12;
}

// Pass 90: build the two closed solids described at the top of this file.
export function sectionFourWayCockParts(root){
 const d=root.userData,g=d.geometry,b=d.blocks,H=COCK_HALF_DEPTH,h=COCK_DUCT_HALF;
 const pipe={inner:g.bodyInnerRadius-.2,straightEnd:g.bodyOuterRadius,bend:g.pipeBendRadius,sweep:g.pipeBendSweep};
 // Plug: disc bored by the two passages (arcs of radius = plug radius about
 // the outside corners, entering and leaving the rim radially, as drawn).
 const passages=[false,true].map(opposite=>band(curveSamples(cockPassagePath(g.passageRadius,g.plugRadius+.08,0,opposite)),h));
 const disk=poly(circle([0,0],g.plugRadius,192));
 b.plug.geometry.dispose();b.plug.geometry=voidedPlate(disk,clip.union(...passages),H,h);
 b.plug.rotation.set(0,0,0);
 b.plug.material=b.plug.material.clone();b.plug.material.color.set(0xb8995a);
 makeSeeThrough(b.plug);
 // Body: ring and four pipes as one outline, four ducts as one void.
 const annulus=clip.difference(poly(circle([0,0],g.bodyOuterRadius,192)),poly(circle([0,0],g.bodyInnerRadius,192)));
 const pipes=PORTS.map(([,u,s])=>band(portPipeSamples(u,s,{...pipe,inner:g.bodyOuterRadius-.12}),COCK_PIPE_HALF));
 const ducts=PORTS.map(([,u,s])=>band(portPipeSamples(u,s,{...pipe,extend:.1}),h));
 b.housing.geometry.dispose();b.housing.geometry=voidedPlate(clip.union(annulus,...pipes),clip.union(...ducts),H,h);
 b.housing.material=b.housing.material.clone();b.housing.material.color.set(0x59605f);
 d.pipeEnds=PORTS.map(([name,u,s])=>{const[p,t]=portPipeSamples(u,s,pipe).at(-1);return{name,point:new T.Vector3(p[0],p[1],0),tangent:new T.Vector3(t[0],t[1],0)};});
 root.traverse(o=>{if(o.isMesh&&o!==b.plug&&[].concat(o.material??[]).some(m=>m.transparent)){o.castShadow=false;o.receiveShadow=false;}});
 fitPistonGuide(root,d.update,d.motion.cycleDuration);
 // Frame the body and its pipes (the hidden legacy pipe and marker meshes
 // stay out of the fit).
 b.housing.geometry.computeBoundingBox();d.cameraFitBounds=b.housing.geometry.boundingBox.clone().expandByScalar(.05);
}
