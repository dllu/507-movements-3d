import {makeCordTreadleSolids} from './solids.js';

// Signed tetrahedron integration about each rigid body's local origin. Geometry
// must be closed, consistently wound, and non-overlapping within each body.
export function integrateSolidGeometry(geometry, matrix) {
 const positions=geometry.attributes.position,index=geometry.index;
 const total=index?index.count:positions.count;
 let volume=0;const first=[0,0,0],second=Array(6).fill(0),pairs=[[0,0],[1,1],[2,2],[0,1],[0,2],[1,2]];
 for(let n=0;n<total;n+=3){
  const vertices=[0,1,2].map(k=>{const i=index?index.getX(n+k):n+k;const p=[positions.getX(i),positions.getY(i),positions.getZ(i)];if(!matrix)return p;const e=matrix.elements;return [0,1,2].map(j=>e[j]*p[0]+e[j+4]*p[1]+e[j+8]*p[2]+e[j+12]);});
  const [a,b,c]=vertices,v=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  const sum=[0,1,2].map(j=>a[j]+b[j]+c[j]);volume+=v;
  for(let j=0;j<3;j++)first[j]+=v*sum[j]/4;
  pairs.forEach(([j,k],i)=>{second[i]+=v*(sum[j]*sum[k]+vertices.reduce((s,p)=>s+p[j]*p[k],0))/20;});
 }
 return {volume,first,second};
}

// Assumed reconstruction scale/material, not dimensions supplied by the source.
// Keep kg and seconds while expressing lengths in display units: acceleration
// divides by metresPerUnit; inertias remain kg * display-unit².
export function cordTreadleRigidProperties({metresPerUnit=.1,densityKgPerM3=7200}={}) {
 if(![metresPerUnit,densityKgPerM3].every(x=>Number.isFinite(x)&&x>0))throw new RangeError('Positive physical scale and density required');
 const assembly=makeCordTreadleSolids(),bodies={};
 try{for(const family of ['disk','treadle','pulley']){
  let volume=0;const first=[0,0,0],second=Array(6).fill(0);
  for(const mesh of assembly.root.userData.blocks[family].children){mesh.updateMatrix();const p=integrateSolidGeometry(mesh.geometry,mesh.matrix);if(!(p.volume>0))throw new Error(`Invalid solid volume: ${mesh.name}`);volume+=p.volume;p.first.forEach((v,i)=>first[i]+=v);p.second.forEach((v,i)=>second[i]+=v);}
  const center=first.map(v=>v/volume),rho=densityKgPerM3*metresPerUnit**3,mass=rho*volume;
  const [xx,yy,zz,xy,xz,yz]=second;
  const [x,y,z]=center;
  bodies[family]={volume,mass,center,fullinertia:[rho*(yy+zz)-mass*(y*y+z*z),rho*(xx+zz)-mass*(x*x+z*z),rho*(xx+yy)-mass*(x*x+y*y),-rho*xy+mass*x*y,-rho*xz+mass*x*z,-rho*yz+mass*y*z]};
 }
 return {metresPerUnit,densityKgPerM3,gravity:9.81/metresPerUnit,bodies,assumptions:'0.1 metre per display unit and uniform 7200 kg/m³ rigid material by default. Source gives no dimensions or materials. Rigid solids include inferred anchor studs; cord itself is modeled separately.'};
 }finally{assembly.dispose();}
}
