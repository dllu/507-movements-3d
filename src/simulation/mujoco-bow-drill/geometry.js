import * as THREE from 'three';
import source from './source.js';
import {bowDrillClearCordPath} from './cord-path.js';
import {plate,poly,ring,disk} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};

// Closed circular/elliptic sweep. Separate cap vertices preserve the edge normal.
export function bowDrillTube(points,radii,{sides=24,depthRadii=radii}={}){
 const positions=[],indices=[];
 for(let i=0;i<points.length;i++){
  const tangent=new THREE.Vector3().fromArray(points[Math.min(i+1,points.length-1)]).sub(new THREE.Vector3().fromArray(points[Math.max(i-1,0)])).normalize(),normal=new THREE.Vector3(-tangent.y,tangent.x,0).normalize(),binormal=new THREE.Vector3().crossVectors(tangent,normal).normalize();
  for(let j=0;j<sides;j++){const a=2*Math.PI*j/sides,p=new THREE.Vector3().fromArray(points[i]).addScaledVector(normal,radii[i]*Math.cos(a)).addScaledVector(binormal,depthRadii[i]*Math.sin(a));positions.push(...p.toArray());}
 }
 for(let i=0;i<points.length-1;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=b+sides,d=a+sides;indices.push(a,b,c,a,c,d);}
 for(const[end,reverse]of [[0,true],[points.length-1,false]]){const center=positions.length/3;positions.push(...points[end]);const offset=positions.length/3;for(let j=0;j<sides;j++)positions.push(...positions.slice(3*(end*sides+j),3*(end*sides+j)+3));for(let j=0;j<sides;j++){const a=offset+j,b=offset+(j+1)%sides;indices.push(...(reverse?[center,b,a]:[center,a,b]));}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function makeBowDrillGeometry({amplitude=.9,cordSegments=96,cordTilt=.3}={}){
 if(!Number.isFinite(amplitude)||amplitude<0||!Number.isFinite(cordTilt)||cordTilt<=0)throw new RangeError('Invalid 124 geometry options');
 const root=new THREE.Group(),blocks={},parts={},families={},cordRadius=source.cordWidthPixels/200,pitchRadius=source.circles.rim.radius/100,drumRadius=pitchRadius-cordRadius,local=([x,y],z=0)=>[(x-source.axis[0])/100,(source.axis[1]-y)/100,z],A=local(source.anchors.lower),d=source.direction,n=source.normal;
 const stockAt=s=>{const t=Math.min(1,Math.max(0,(s-1.01)/.05)),b=4*s*(1-s),q=2*s-1,rise=b*(source.coefficients[0]+q*source.coefficients[1]+q*q*source.coefficients[2])/100;return[A[0]+d[0]*source.chordLength/100*s+n[0]*rise,A[1]+d[1]*source.chordLength/100*s+n[1]*rise-.025*t*t*(3-2*t),cordTilt*(s-.5)];},stockRadius=s=>{const r=Math.max(.035,(source.widthCoefficients[0]+s*source.widthCoefficients[1]+s*s*source.widthCoefficients[2])/200),end=s<-.027?(-.027-s)/.009:s>1.06?(s-1.06)/.006:0;return r*Math.sqrt(Math.max(.01,1-end*end));};
 for(const name of ['bow','spindle','cord']){blocks[name]=new THREE.Group();root.add(blocks[name]);}
 const add=(name,g,family,color)=>{const mesh=new THREE.Mesh(g,matte(color,{metalness:.1,roughness:.6}));mesh.name=name;blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;};
 const stockSamples=[...new Set([...Array.from({length:321},(_,i)=>-.036+1.102*i/320),...Array.from({length:17},(_,i)=>-.036+.009*i/16),...Array.from({length:17},(_,i)=>1.06+.006*i/16)].map(s=>Math.round(s*1e9)/1e9))].sort((a,b)=>a-b),stockPoints=stockSamples.map(stockAt);add('stock',bowDrillTube(stockPoints,stockSamples.map(stockRadius)),'bow',PALETTE.driver);
 const lower=local(source.anchors.lowerString,-cordTilt/2),upper=local(source.anchors.upperString,cordTilt/2),cordPath=bowDrillClearCordPath(lower,upper,pitchRadius,cordSegments),bindingPoints={};
 for(const[name,start,end,anchor]of [['lowerBinding',.023,-.015,lower],['upperBinding',1.021,.979,upper]]){
  const frame=s=>{const c=new THREE.Vector3().fromArray(stockAt(s)),t=new THREE.Vector3().fromArray(stockAt(s+.0001)).sub(new THREE.Vector3().fromArray(stockAt(s-.0001))).normalize(),n=new THREE.Vector3(-t.y,t.x,0).normalize(),b=new THREE.Vector3().crossVectors(t,n);return{c,n,b};},f=frame(start),offset=new THREE.Vector3().fromArray(anchor).sub(f.c),phase=Math.atan2(offset.dot(f.b),offset.dot(f.n));
  const coil=[];for(let i=0;i<=144;i++){const s=start+(end-start)*i/144,{c,n,b}=frame(s),a=phase+6*Math.PI*i/144;c.addScaledVector(n,(stockRadius(s)+cordRadius)*Math.cos(a)).addScaledVector(b,(stockRadius(s)+cordRadius)*Math.sin(a));coil.push(c.toArray());}
  // A rounded solid lead joins the free span to the binding. Its overlap is
  // the tied knot, not an additional flexible length or a hidden drive link.
  bindingPoints[name]=coil;add(name,bowDrillTube(coil,coil.map(()=>cordRadius),{sides:24}),'bow',PALETTE.brass);
  const first=new THREE.Vector3().fromArray(anchor),closest=coil.reduce((best,p)=>first.distanceToSquared(new THREE.Vector3(...p))<first.distanceToSquared(new THREE.Vector3(...best))?p:best,coil[0]),last=new THREE.Vector3().fromArray(closest),axis=last.clone().sub(first),lead=new THREE.CapsuleGeometry(cordRadius,axis.length(),12,24);
  const clean=[];for(let i=0;i<lead.index.count;i+=3){const ids=[0,1,2].map(j=>lead.index.getX(i+j)),[a,b,c]=ids.map(j=>new THREE.Vector3().fromBufferAttribute(lead.attributes.position,j));if(b.sub(a).cross(c.sub(a)).lengthSq()>1e-22)clean.push(...ids);}lead.setIndex(clean);
  lead.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize()));lead.translate(...first.add(last).multiplyScalar(.5).toArray());add(name+'Lead',lead,'bow',PALETTE.brass);
 }
 const shaft=source.circles.shaft.radius/100,outer=source.circles.outer.radius/100,hub=source.circles.hub.radius/100;
 add('drum',ring(shaft,drumRadius,-.16,.16,192),'spindle',PALETTE.driven);add('backFlange',ring(shaft,outer,-.20,-.16,192),'spindle',PALETTE.driven);add('frontFlange',ring(shaft,outer,.16,.20,192),'spindle',PALETTE.driven);add('frontLand',ring(shaft,pitchRadius,.20,.22,192),'spindle',PALETTE.driven);add('frontHub',ring(shaft,hub,.22,.24,192),'spindle',PALETTE.driven);add('shaft',disk(shaft,-.9,.24,128),'spindle',PALETTE.ink);
 const bit=plate(poly([[-.12,-.8],[.12,-.8],[.12,-1.15],[.06,-1.32],[0,-1.36],[-.06,-1.32],[-.12,-1.15]]),-.025,.025);bit.rotateX(Math.PI/2);add('bit',bit,'spindle',PALETTE.ink);
 add('initialCord',bowDrillTube(cordPath.points,cordPath.points.map(()=>cordRadius)),'cord',PALETTE.brass);
 const setSectionView=enabled=>{root.userData.sectionView=Boolean(enabled);for(const n of ['frontFlange','frontLand','frontHub'])parts[n].visible=!enabled;};
 const bounds=new THREE.Box3();for(const q of [-amplitude,amplitude]){blocks.bow.position.set(d[0]*q,d[1]*q,0);root.updateMatrixWorld(true);bounds.union(new THREE.Box3().setFromObject(root,true));}blocks.bow.position.set(0,0,0);bounds.expandByScalar(.12);
 Object.assign(root.userData,{source,parts,blocks,families,profile:{amplitude,cordSegments,cordTilt,cordRadius,pitchRadius,drumRadius,lower,upper,cordPath,stockAt,stockRadius,stockSamples,stockPoints,bindingPoints},hideGround:true,setSectionView,cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},shadowCameraHalfExtent:5,shadowBias:-.00002,shadowNormalBias:.001});setSectionView(false);markShadows(root);root.updateMatrixWorld(true);return{root,focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(1.2,1,10)};
}
