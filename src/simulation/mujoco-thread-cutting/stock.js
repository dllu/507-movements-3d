import * as THREE from 'three';
const tau=2*Math.PI,mod=a=>{const r=((a%tau)+tau)%tau;return r<1e-12||tau-r<1e-12?0:r;};
const point=(r,a,z)=>[r*Math.cos(mod(a)),r*Math.sin(mod(a)),z];
const unit=(x,y,z)=>{const d=Math.hypot(x,y,z);return[x/d,y/d,z/d];};
export function surfaceBuilder() {
 const positions=[],normals=[];
 const triangle=(points,ns)=>{
  points=points.map(p=>p.map(Math.fround));
  const [a,b,c]=points,u=b.map((v,i)=>v-a[i]),v=c.map((x,i)=>x-a[i]);
  const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  if(Math.hypot(...cross)<1e-11)return;
  if(cross.reduce((s,x,i)=>s+x*(ns[0][i]+ns[1][i]+ns[2][i]),0)<0){[points[1],points[2]]=[points[2],points[1]];[ns[1],ns[2]]=[ns[2],ns[1]];}
  positions.push(...points.flat());normals.push(...ns.flat());
 };
 return {positions,normals,quad:(p,n)=>{triangle([p[0],p[1],p[2]],[n[0],n[1],n[2]]);triangle([p[0],p[2],p[3]],[n[0],n[2],n[3]]);}};
}
function cell(mesh,p,a,b) {
 const center=p.phase+p.lead*(a.angle+b.angle)/2;
 for(const [side,r] of [[-1,p.inner],[1,p.outer]]) {
  const n=t=>[side*Math.cos(mod(t)),side*Math.sin(mod(t)),0];
  mesh.quad([point(r,a.angle,a.low),point(r,b.angle,b.low),point(r,b.angle,b.high),point(r,a.angle,a.high)], [n(a.angle),n(b.angle),n(b.angle),n(a.angle)]);
 }
 for(const side of [-1,1]) {
  const z=side<0?'low':'high',k=(side<0?center-p.width/2<p.low:center+p.width/2>p.high)?0:p.lead;
  const n=(r,t)=>unit(side*k*Math.sin(mod(t)),-side*k*Math.cos(mod(t)),side*r);
  mesh.quad([point(p.inner,a.angle,a[z]),point(p.outer,a.angle,a[z]),point(p.outer,b.angle,b[z]),point(p.inner,b.angle,b[z])],
   [n(p.inner,a.angle),n(p.outer,a.angle),n(p.outer,b.angle),n(p.inner,b.angle)]);
 }
}
function cap(mesh,p,s,sign) {
 const n=[-sign*Math.sin(mod(s.angle)),sign*Math.cos(mod(s.angle)),0];
 mesh.quad([point(p.inner,s.angle,s.low),point(p.outer,s.angle,s.low),point(p.outer,s.angle,s.high),point(p.inner,s.angle,s.high)],Array(4).fill(n));
}
export function threadTool(p,center,halfAngle) {
 const mesh=surfaceBuilder(),station=angle=>({angle,low:p.phase+p.lead*angle-p.width/2,high:p.phase+p.lead*angle+p.width/2});
 const first=station(center-halfAngle),last=station(center+halfAngle);
 const full={...p,low:-Infinity,high:Infinity};
 cap(mesh,p,first,-1);
 for(let i=0;i<8;i++)cell(mesh,full,station(first.angle+2*halfAngle*i/8),station(first.angle+2*halfAngle*(i+1)/8));
 cap(mesh,p,last,1);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(mesh.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(mesh.normals,3));return g;
}
