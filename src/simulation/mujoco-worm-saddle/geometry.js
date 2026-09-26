import * as THREE from 'three';
import {makeWormSaddleProfile} from './profile.js';
import {cylindricalWormGeometry} from '../worm-gear-geometry.js';
import {plate,poly,circle,disk,ring,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
const rectangle=(l,b,r,t)=>poly([[l,b],[r,b],[r,t],[l,t]]);
const cubic=(a,b,c,d)=>Array.from({length:33},(_,i)=>{const t=i/32;return a.map((v,k)=>(1-t)**3*v+3*(1-t)**2*t*b[k]+3*(1-t)*t*t*c[k]+t**3*d[k]);});
function cleanPeriodicSeams(g) {
  const p=g.attributes.position,n=g.attributes.normal,positions=[],normals=[];
  for(let i=0;i<p.count;i++)for(const axis of ['y','z'])if(Math.abs(p['get'+axis.toUpperCase()](i))<1e-12)p['set'+axis.toUpperCase()](i,0);
  // Axial clipping can leave a sub-pixel sliver at a grid crossing. Collapse
  // its shortest edge globally, including the adjoining cap, before emitting
  // triangles. This preserves closure within 0.0001 engraving pixel.
  const ids=[],vertices=[],lookup=new Map(),parents=[];
  for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i),key=v.toArray().join(',');
    if(!lookup.has(key)){lookup.set(key,vertices.length);parents.push(vertices.length);vertices.push(v);}ids.push(lookup.get(key));}
  const find=i=>{while(parents[i]!==i)i=parents[i];return i;};
  for(let i=0;i<ids.length;i+=3)for(let j=0;j<3;j++){const a=find(ids[i+j]),b=find(ids[i+(j+1)%3]);if(vertices[a].distanceTo(vertices[b])<1e-6)parents[b]=a;}
  for(let i=0;i<p.count;i+=3){const v=[0,1,2].map(j=>vertices[find(ids[i+j])]);
    if(new THREE.Triangle(...v).getArea()<5e-12)continue;
    for(let j=0;j<3;j++){positions.push(...v[j].toArray());normals.push(n.getX(i+j),n.getY(i+j),n.getZ(i+j));}}
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.dispose();return result;
}

export function saddleWheelGeometry(f,cut) {
  const {angularSteps,axialSteps,radii}=cut,n=angularSteps*f.teeth,stride=n+1,p=[],indices=[];
  const point=(r,a,z)=>[r*Math.cos(a),r*Math.sin(a),z],toothPitch=2*Math.PI/f.teeth;
  const angle=i=>-toothPitch/2+2*Math.PI*i/n;
  for(let j=0;j<=axialSteps;j++)for(let i=0;i<=n;i++)p.push(...point(radii[j*(angularSteps+1)+i%angularSteps],angle(i),f.depth*(j/axialSteps-.5)));
  for(let j=0;j<axialSteps;j++)for(let i=0;i<n;i++){const a=j*stride+i;indices.push(a,a+1,a+stride+1,a,a+stride+1,a+stride);}
  for(const side of [-1,1]) {
    const start=p.length/3,row=side<0?0:axialSteps;
    for(let i=0;i<=n;i++)p.push(...point(radii[row*(angularSteps+1)+i%angularSteps],angle(i),side*f.depth/2),...point(f.shaftRadius,angle(i),side*f.depth/2));
    for(let i=0;i<n;i++){const a=start+2*i,tri=[a,a+2,a+3,a,a+3,a+1];indices.push(...(side<0?tri.reverse():tri));}
  }
  const inner=p.length/3;
  for(let i=0;i<=n;i++)for(const z of [-f.depth/2,f.depth/2])p.push(...point(f.shaftRadius,angle(i),z));
  for(let i=0;i<n;i++){const a=inner+i*2;indices.push(a,a+1,a+3,a,a+3,a+2);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();g.userData.cut=cut;return g;
}

export function makeWormSaddleGeometry(cut,options={}) {
  const f=makeWormSaddleProfile(options),root=new THREE.Group(),parts={},families={},blocks={};
  const add=(name,g,family,color)=>{if(!blocks[family]){blocks[family]=new THREE.Group();root.add(blocks[family]);}
    const mesh=new THREE.Mesh(g,matte(color,{metalness:.15,roughness:.6}));mesh.name=name;blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;};
  const wormParameters={pitchRadius:f.wormPitchRadius,module:f.pitch/Math.PI,length:f.high-f.low,pressureAngle:f.pressureAngle,
    rootRadius:f.wormRoot,tipRadius:f.wormTip,rootHalfWidth:f.rootHalfWidth,tipHalfWidth:f.tipHalfWidth,
    phase:f.phase-f.center-f.pitch*Math.round((f.phase-f.center)/f.pitch),angularSteps:options.wormSegments??256};
  add('worm',cleanPeriodicSeams(cylindricalWormGeometry(wormParameters).rotateY(Math.PI/2).translate(f.center,0,0)),'worm',PALETTE.driver);
  for(const [name,low,high] of [['leftJournal',f.low-.10,f.low],['rightJournal',f.high,f.high+.10]])add(name,disk(f.wormRoot,low,high,256).rotateY(Math.PI/2),'worm',PALETTE.driver);
  const wheelAngle=Math.PI/2+(f.lead*Math.PI/2-f.phase)/f.pitchRadius;
  add('wheel',saddleWheelGeometry(f,cut).rotateZ(wheelAngle),'wheel',PALETTE.driven);
  // The wheel's shaft is steel, turning in the pedestal's bore, with a
  // retaining collar outside the bore (Brown hatches its section there).
  add('shaft',disk(f.shaftRadius,-f.depth/2-.025,.43,cut.angularSteps*f.teeth),'wheel',PALETTE.ink);
  add('shaftCollar',ring(f.shaftRadius,f.shaftRadius+.06,.405,.45,256),'wheel',PALETTE.ink);
  const footLeft=f.world([f.foot.left,0])[0],footRight=f.world([f.foot.right,0])[0],footTop=f.world([0,f.foot.top])[1],footBottom=f.world([0,f.foot.bottom])[1];
  add('foot',plate(rectangle(footLeft,footBottom,footRight,footTop),-.18,.48),'carriage',PALETTE.accent);
  const r=f.bearingRadius,outline=[...cubic([-.36,footTop],[-.26,footTop],[-r,-.52],[-r,0]),
    ...Array.from({length:129},(_,i)=>{const a=Math.PI-Math.PI*i/128;return[r*Math.cos(a),r*Math.sin(a)];}).slice(1),
    ...cubic([r,0],[r+.04,-.65],[.30,footTop],[.42,footTop]).slice(1)];
  add('pedestal',plate(clip.difference(poly(outline),poly(circle([0,0],f.shaftRadius+.003,256))),.126,.40),'carriage',PALETTE.accent);
  const rib=[[-.07,-.27],[-.035,-.32],[-.035,-.83],[-.01,footTop],[.13,footTop],[.065,-.84],[.065,-.28]];
  add('rib',plate(poly(rib),.40,.46),'carriage',PALETTE.accent);
  const floor=footBottom-.002,bedBottom=f.world([0,f.bed.bottom])[1],bedTop=f.world([0,f.bed.top])[1];
  const key=poly([[floor+.002,-.05],[floor+.002,.05],[floor-.032,.05],[floor-.032,.09],[floor-.075,.09],[floor-.075,-.09],[floor-.032,-.09],[floor-.032,-.05]]);
  const slot=poly([[floor+.01,-.053],[floor+.01,.053],[floor-.029,.053],[floor-.029,.093],[floor-.078,.093],[floor-.078,-.093],[floor-.029,-.093],[floor-.029,-.053]]);
  const section=clip.difference(clip.union(rectangle(bedBottom,-.36,floor,.52),rectangle(bedBottom,-.36,bedTop,-.183)),slot);
  const xyz=new THREE.Matrix4().set(0,0,1,0,1,0,0,0,0,1,0,0,0,0,0,1);
  add('guideKey',plate(key,footLeft+.04,footRight-.04).applyMatrix4(xyz),'carriage',PALETTE.accent);
  add('bed',plate(section,f.world([f.bed.left,0])[0],f.world([f.bed.right,0])[0]).applyMatrix4(xyz),'frame',PALETTE.frame);
  // Brown draws no bearings for the screw; its journals end as plain stubs
  // (p60 support policy).
  blocks.worm.position.y=f.distance;
  Object.assign(root.userData,{profile:f,cut,parts,families,blocks,wheelAngle,wormParameters,outline,hideGround:true,
    shadowCameraHalfExtent:3,shadowBias:-.00002,shadowNormalBias:.001});markShadows(root);root.updateMatrixWorld(true);
  return {root,focus:new THREE.Vector3(.1,-.1,0),cameraDirection:new THREE.Vector3(1,1,10)};
}
