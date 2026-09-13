import * as THREE from 'three';
const tau=2*Math.PI,mod=a=>{const r=((a%tau)+tau)%tau;return r<1e-12||tau-r<1e-12?0:r;};
const point=(r,a,z)=>[r*Math.cos(mod(a)),r*Math.sin(mod(a)),z];
const normal=(x,y,z)=>new THREE.Vector3(x,y,z).normalize().toArray();

function builder() {
  const positions=[],normals=[];
  const triangle=(p,n)=>{
    p=p.map(v=>v.map(Math.fround));
    const a=new THREE.Vector3(...p[0]),cross=new THREE.Vector3(...p[1]).sub(a).cross(new THREE.Vector3(...p[2]).sub(a));
    if(cross.lengthSq()<1e-22)return;
    if(cross.dot(new THREE.Vector3(...n[0]).add(new THREE.Vector3(...n[1])).add(new THREE.Vector3(...n[2])))<0){[p[1],p[2]]=[p[2],p[1]];[n[1],n[2]]=[n[2],n[1]];}
    positions.push(...p.flat());normals.push(...n.flat());
  };
  return {quad:(p,n)=>{triangle([p[0],p[1],p[2]],[n[0],n[1],n[2]]);triangle([p[0],p[2],p[3]],[n[0],n[2],n[3]]);},finish:()=>{
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.computeBoundingBox();g.computeBoundingSphere();return g;
  }};
}

// Include the axial clipping transitions at every turn. The matching core
// or bore uses this same angular grid, so the solids abut exactly.
export function threadAngles(p,segments,extra=[]) {
  const angles=[...Array.from({length:segments},(_,i)=>tau*i/segments),...extra];
  for(const z of [p.low,p.high])for(const sign of [-1,1])angles.push(mod((z-p.phase-sign*p.width/2)/p.lead));
  angles.sort((a,b)=>a-b);const unique=angles.filter((a,i)=>!i||a-angles[i-1]>1e-10);return [...unique,tau];
}

export function threadStations(p,angles) {
  const range=[(p.low-p.width/2-p.phase)/p.lead,(p.high+p.width/2-p.phase)/p.lead].sort((a,b)=>a-b),stations=[];
  for(let turn=Math.floor(range[0]/tau)-1;turn<=Math.ceil(range[1]/tau)+1;turn++)for(const phase of angles.slice(0,-1)) {
    const angle=phase+turn*tau;if(angle<range[0]-1e-9||angle>range[1]+1e-9)continue;
    const center=p.phase+p.lead*angle;
    const snap=z=>Math.abs(z-p.low)<1e-10?p.low:Math.abs(z-p.high)<1e-10?p.high:z;
    stations.push({angle,low:snap(Math.max(p.low,center-p.width/2)),high:snap(Math.min(p.high,center+p.width/2))});
  }
  stations.sort((a,b)=>a.angle-b.angle);return stations;
}

export function helicalThread(p,angles) {
  const mesh=builder(),stations=threadStations(p,angles);
  for(let i=0;i+1<stations.length;i++) {
    const a=stations[i],b=stations[i+1],mid=(a.angle+b.angle)/2,center=p.phase+p.lead*mid;
    for(const [side,r,z0,z1] of [[-1,p.inner,a.low,b.low],[1,p.outer,a.low,b.low]]) {
      const n=t=>[side*Math.cos(mod(t)),side*Math.sin(mod(t)),0];
      mesh.quad([point(r,a.angle,z0),point(r,b.angle,z1),point(r,b.angle,b.high),point(r,a.angle,a.high)],[n(a.angle),n(b.angle),n(b.angle),n(a.angle)]);
    }
    for(const side of [-1,1]) {
      const z=side<0?'low':'high',k=(side<0?center-p.width/2<p.low:center+p.width/2>p.high)?0:p.lead;
      const n=(r,a)=>normal(side*k*Math.sin(mod(a)),-side*k*Math.cos(mod(a)),side*r);
      mesh.quad([point(p.inner,a.angle,a[z]),point(p.outer,a.angle,a[z]),point(p.outer,b.angle,b[z]),point(p.inner,b.angle,b[z])],
        [n(p.inner,a.angle),n(p.outer,a.angle),n(p.outer,b.angle),n(p.inner,b.angle)]);
    }
  }
  const geometry=mesh.finish();geometry.userData.thread={...p,angles};return geometry;
}

export function polygonCylinder(radius,low,high,angles) {
  const mesh=builder();
  for(let i=0;i+1<angles.length;i++) {
    const a=angles[i],b=angles[i+1],na=[Math.cos(a),Math.sin(a),0],nb=[Math.cos(b),Math.sin(b),0];
    mesh.quad([point(radius,a,low),point(radius,b,low),point(radius,b,high),point(radius,a,high)],[na,nb,nb,na]);
    for(const [z,sign] of [[low,-1],[high,1]])mesh.quad([[0,0,z],point(radius,a,z),point(radius,b,z),[0,0,z]],Array(4).fill([0,0,sign]));
  }
  return mesh.finish();
}

export function hexRadius(p,angle) {
  // p.phase indexes the vertices; face normals lie halfway between them.
  const center=p.phase+(Math.floor(mod(angle-p.phase)/(Math.PI/3))+.5)*Math.PI/3;
  return {radius:p.radius*Math.cos(Math.PI/6)/Math.cos(angle-center),normal:center};
}

// Conical chamfers meet the true six planar faces. Their junction height
// varies around each face; it is not a scaled-hexagon bevel.
export function chamferedHex(p,angles) {
  const mesh=builder(),endRadius=p.radius*Math.cos(Math.PI/6),depth=p.radius-endRadius;
  const section=a=>{
    const {radius:r}=hexRadius(p,mod(a)),fraction=(r-endRadius)/depth;
    return [[p.bottomBevel?endRadius:r,p.low],[r,p.low+p.bottomBevel*fraction],[r,p.high-p.topBevel*fraction],[p.topBevel?endRadius:r,p.high]];
  };
  for(let i=0;i+1<angles.length;i++) {
    const a=angles[i],b=angles[i+1],first=section(a),last=section(b),mid=(a+b)/2,face=hexRadius(p,mid).normal;
    for(let edge=0;edge<3;edge++) {
      const za=first[edge],zb=first[edge+1],zc=last[edge+1],zd=last[edge];
      const n=t=>edge===1?[Math.cos(face),Math.sin(face),0]:normal(Math.cos(mod(t)),Math.sin(mod(t)),edge===0?-depth/p.bottomBevel:depth/p.topBevel);
      if((edge===0&&!p.bottomBevel)||(edge===2&&!p.topBevel))continue;
      mesh.quad([point(za[0],a,za[1]),point(zb[0],a,zb[1]),point(zc[0],b,zc[1]),point(zd[0],b,zd[1])],[n(a),n(a),n(b),n(b)]);
    }
    for(const [j,sign] of [[0,-1],[3,1]]) {
      const z=first[j][1],n=Array(4).fill([0,0,sign]);
      mesh.quad([point(p.bore,a,z),point(first[j][0],a,z),point(last[j][0],b,z),point(p.bore,b,z)],n);
    }
    if(p.bore)mesh.quad([point(p.bore,a,p.low),point(p.bore,b,p.low),point(p.bore,b,p.high),point(p.bore,a,p.high)],
      [[-Math.cos(a),-Math.sin(a),0],[-Math.cos(b),-Math.sin(b),0],[-Math.cos(b),-Math.sin(b),0],[-Math.cos(a),-Math.sin(a),0]]);
  }
  return mesh.finish();
}

// Split at every axial clipping transition before making the convex hulls.
// Clipping a whole twisted sector's hull afterward creates a protruding wedge
// at the thread tip, where the true helical cross-section falls to zero.
export function threadContactCells(p,segments) {
  const stations=threadStations(p,threadAngles(p,segments)),cells=[];
  for(let i=0;i+1<stations.length;i++) {
    const points=[stations[i],stations[i+1]].flatMap(s=>[p.inner,p.outer].flatMap(r=>[s.low,s.high].map(z=>point(r,s.angle,z))));
    const unique=[...new Map(points.map(p=>[p.map(v=>v.toFixed(10)).join(','),p])).values()];
    if(unique.length>=4)cells.push(unique);
  }
  return cells;
}
