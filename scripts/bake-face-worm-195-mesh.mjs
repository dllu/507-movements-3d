import fs from 'node:fs';
import face from '../src/data/face-worm-195.js';
import {faceWorm195Geometry} from '../src/simulation/feed-worm-assembly-parts.js';

// Movement 195's display sector: an adaptive simplification of the full
// exact-envelope sector (faceWorm195Geometry over the 133x112 baked grid,
// about 31.7k triangles) down to a few thousand triangles.
//
// Half-edge collapses keep every surviving vertex on the full-resolution
// surface. A collapse is accepted only if every full-resolution sample it
// affects (the removed vertices and face centres, carried by the coarse
// faces that cover them) stays within tolerance when cast along its own
// normal onto the new faces:
//   - no material is added (the coarse surface may stand at most UP above
//     the full surface), so the running clearance to the worm is kept;
//   - at most DOWN is removed;
//   - the interpolated coarse normal at the sample stays within NORMAL of
//     the full normal there, so the shading matches the dense mesh.
// Crease lines (land edges, cliff and wall creases, the rim) are collapsed
// only along themselves and within FEATURE of their polyline; crease
// junctions and open edges are locked. The two seam profiles, which meet the
// neighbouring instances, are thinned identically in advance so adjacent
// sectors share their vertices. Corner normals are taken from the dense
// surface: each coarse corner uses the dense face fan normal in the
// direction the coarse face covers, so flat lands, smooth flanks and creases
// shade as the dense mesh does.
const UP=1e-5,DOWN=Number(process.env.DOWN??4e-4),NORMAL=Number(process.env.NORMAL??4)*Math.PI/180,FEATURE=Number(process.env.FEATURE??1.5e-4);
const pitch=2*Math.PI/face.teeth;

const fine=faceWorm195Geometry(face);
const P=fine.attributes.position,N=fine.attributes.normal,I=fine.index.array;
// Weld by position.
const weld=new Map(),pos=[],vid=new Int32Array(P.count);
for(let k=0;k<P.count;k++){const key=P.getX(k)+','+P.getY(k)+','+P.getZ(k);let w=weld.get(key);if(w===undefined){w=pos.length;weld.set(key,w);pos.push([P.getX(k),P.getY(k),P.getZ(k)]);}vid[k]=w;}
const nv=pos.length;
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(a[0],a[1],a[2]),unit=a=>{const l=len(a)||1;return[a[0]/l,a[1]/l,a[2]/l];};
const faceNormal=(a,b,c)=>cross(sub(pos[b],pos[a]),sub(pos[c],pos[a]));
// Dense faces with their corner normals.
const dense=[];for(let f=0;f<I.length;f+=3){const v=[vid[I[f]],vid[I[f+1]],vid[I[f+2]]];if(v[0]===v[1]||v[1]===v[2]||v[0]===v[2])continue;
 dense.push({v,n:[0,1,2].map(e=>[N.getX(I[f+e]),N.getY(I[f+e]),N.getZ(I[f+e])]),area:len(faceNormal(...v))});}
const denseAround=Array.from({length:nv},()=>[]);dense.forEach((f,k)=>f.v.forEach((v,e)=>denseAround[v].push([k,e])));
// A feature edge is an open edge or one whose two faces' corner normals differ.
const edgeKey=(a,b)=>a<b?a*nv+b:b*nv+a;
const edgeFaces=new Map();dense.forEach((f,k)=>{for(let e=0;e<3;e++){const a=f.v[e],b=f.v[(e+1)%3],key=edgeKey(a,b);if(!edgeFaces.has(key))edgeFaces.set(key,[]);edgeFaces.get(key).push([k,e]);}});
const feature=new Set(),same=(p,q)=>Math.abs(p[0]-q[0])+Math.abs(p[1]-q[1])+Math.abs(p[2]-q[2])<1e-5;
const openVertex=new Uint8Array(nv);
for(const[key,list]of edgeFaces){const a=Math.floor(key/nv),b=key%nv;
 if(list.length!==2){feature.add(key);if(list.length<2){openVertex[a]=openVertex[b]=1;}continue;}
 const normalAt=([k,e],v)=>dense[k].n[dense[k].v.indexOf(v)];
 if(!same(normalAt(list[0],a),normalAt(list[1],a))||!same(normalAt(list[0],b),normalAt(list[1],b)))feature.add(key);}
// Seam vertices lie on the sector's two bounding half-planes.
const theta=v=>Math.atan2(pos[v][1],pos[v][0]);
const seamSide=v=>Math.abs(theta(v)+pitch/2)<1e-6?-1:Math.abs(theta(v)-pitch/2)<1e-6?1:0;
// Thin the seam top profiles identically: the (r,z) polyline of feature
// edges joining seam vertices on the upper surface.
const seamKeep=new Set();
{const profile=side=>{const vs=[];for(let v=0;v<nv;v++)if(seamSide(v)===side)vs.push(v);return vs;};
 for(const side of[-1,1]){
  const vs=profile(side),rz=v=>[Math.hypot(pos[v][0],pos[v][1]),pos[v][2]];
  // Keep backing corners and any seam vertex that is not on exactly two seam feature edges.
  const nbr=new Map(vs.map(v=>[v,[]]));
  for(const key of feature){const a=Math.floor(key/nv),b=key%nv;if(nbr.has(a)&&nbr.has(b)){nbr.get(a).push(b);nbr.get(b).push(a);}}
  // Walk the top chain from the inner radius outwards.
  const top=vs.filter(v=>pos[v][2]>face.back+1e-6);
  const start=top.reduce((s,v)=>rz(v)[0]<rz(s)[0]-1e-12||(Math.abs(rz(v)[0]-rz(s)[0])<1e-12&&rz(v)[1]>rz(s)[1])?v:s,top[0]);
  const chain=[start],seen=new Set([start]);
  for(;;){const last=chain.at(-1),next=nbr.get(last).filter(v=>!seen.has(v)&&pos[v][2]>face.back+1e-6);if(!next.length)break;
   next.sort((a,b)=>rz(a)[0]-rz(b)[0]||rz(b)[1]-rz(a)[1]);chain.push(next[0]);seen.add(next[0]);}
  // Douglas-Peucker in (r,z): below-only is not needed here (the seam is
  // matched by the neighbour), but the same tolerance as the crease lines.
  const keep=new Uint8Array(chain.length);keep[0]=keep[chain.length-1]=1;
  const dp=(i,j)=>{if(j<=i+1)return;const a=rz(chain[i]),b=rz(chain[j]),d=[b[0]-a[0],b[1]-a[1]],l=Math.hypot(...d)||1;let worst=-1,at=-1;
   for(let k=i+1;k<j;k++){const p=rz(chain[k]),e=Math.abs((p[0]-a[0])*d[1]-(p[1]-a[1])*d[0])/l;
    // Vertical cliff pairs (same r) are kept.
    const q=rz(chain[k-1]);const cliff=Math.abs(p[0]-q[0])<1e-12;if(cliff||e>worst){worst=cliff?Infinity:e;at=k;if(cliff)break;}}
   if(worst>FEATURE){keep[at]=1;dp(i,at);dp(at,j);}};
  dp(0,chain.length-1);
  // Keep both ends of every vertical step too.
  for(let k=1;k<chain.length;k++)if(Math.abs(rz(chain[k])[0]-rz(chain[k-1])[0])<1e-12){keep[k]=keep[k-1]=1;}
  chain.forEach((v,k)=>{if(keep[k])seamKeep.add(side+':'+rz(v)[0].toFixed(9)+':'+rz(v)[1].toFixed(9));});
 }
}
const seamLocked=v=>{const s=seamSide(v);if(!s)return false;if(pos[v][2]<=face.back+1e-6)return true;const r=Math.hypot(pos[v][0],pos[v][1]),key=':'+r.toFixed(9)+':'+pos[v][2].toFixed(9);
 // A seam vertex survives if either side keeps it, so both sides agree.
 return seamKeep.has('-1'+key)||seamKeep.has('1'+key);};

// Coarse mesh state.
const faces=dense.map(f=>f.v.slice()),alive=new Uint8Array(faces.length).fill(1);
const around=Array.from({length:nv},()=>new Set());faces.forEach((f,k)=>f.forEach(v=>around[v].add(k)));
const featureCount=v=>{let n=0;const seen=new Set();for(const f of around[v])for(const w of faces[f])if(w!==v&&!seen.has(w)){seen.add(w);if(feature.has(edgeKey(v,w)))n++;}return n;};
// The bore arcs (top and back, radius innerRadius) keep only the vertices
// every pitch/8, the corners of the 192-sided lathed wheel centre that meets
// them, so the two polygons coincide with no crack between them.
const BORE_STEP=pitch/8,onBore=v=>Math.abs(Math.hypot(pos[v][0],pos[v][1])-face.innerRadius)<1e-6;
const boreCorner=v=>{const k=(theta(v)+pitch/2)/BORE_STEP;return Math.abs(k-Math.round(k))<1e-6;};
const locked=new Uint8Array(nv);for(let v=0;v<nv;v++)if(openVertex[v]||seamLocked(v)||(onBore(v)&&boreCorner(v)))locked[v]=1;

// Dense normal at vertex v for a coarse face (v,a,b): the dense corner whose
// face lies in the direction the coarse face covers.
const denseNormal=(v,a,b,fn)=>{
 const d=unit([...unit(sub(pos[a],pos[v]))].map((q,k)=>q+unit(sub(pos[b],pos[v]))[k]));let best=null,score=-Infinity;
 for(const[k,e]of denseAround[v]){const f=dense[k];if(f.area<1e-14)continue;const o=f.v.filter(w=>w!==v),m=unit(unit(sub(pos[o[0]],pos[v])).map((q,i)=>q+unit(sub(pos[o[1]],pos[v]))[i])),s=dot(m,d)+dot(unit(faceNormal(...f.v)),fn);
  if(s>score){score=s;best=f.n[e];}}
 return best;};

// Samples: smooth dense vertices and every dense face centre.
const samples=[];
dense.forEach((f,k)=>{if(f.area<1e-14)return;const p=[0,1,2].map(i=>(pos[f.v[0]][i]+pos[f.v[1]][i]+pos[f.v[2]][i])/3),n=unit([0,1,2].map(i=>f.n[0][i]+f.n[1][i]+f.n[2][i]));samples.push({p,n,face:k});});
for(let v=0;v<nv;v++){if(featureCount(v))continue;const k=denseAround[v][0];if(!k)continue;const n=dense[k[0]].n[k[1]];samples.push({p:pos[v],n,face:k[0]});}
// The bore wall meets the lathed centre, far from the worm: its chords may
// stand proud of the dense arc by up to 2e-4.
samples.forEach(s=>{s.p=s.p.slice();s.up=Math.hypot(s.p[0],s.p[1])<face.innerRadius+.005?2e-4:UP;});
const faceSamples=faces.map(()=>[]);samples.forEach((s,i)=>faceSamples[s.face].push(i));

// Cast sample s along its normal onto candidate faces {f,v,n}; returns the
// nearest hit with its offset t, normal error and barycentric weights.
const cast=(s,cands,at=x=>pos[x])=>{let best=null;
 for(const c of cands){const[a,b,cc]=c.v.map(at),e1=sub(b,a),e2=sub(cc,a),h=cross(s.n,e2),det=dot(e1,h);if(Math.abs(det)<1e-16)continue;
  const inv=1/det,q=sub(s.p,a),u=dot(q,h)*inv;if(u<-1e-7||u>1+1e-7)continue;const qq=cross(q,e1),w=dot(s.n,qq)*inv;if(w<-1e-7||u+w>1+1e-7)continue;
  const t=dot(e2,qq)*inv;if(best&&Math.abs(t)>=Math.abs(best.t))continue;
  const bn=unit([0,1,2].map(i=>(1-u-w)*c.n[0][i]+u*c.n[1][i]+w*c.n[2][i]));best={c,t,weights:[1-u-w,u,w],angle:Math.acos(Math.min(1,dot(bn,s.n)))};}
 return best;};

const minAngle=(t,at=x=>pos[x])=>{let m=Math.PI;for(let e=0;e<3;e++){const p=at(t[e]),x1=unit(sub(at(t[(e+1)%3]),p)),x2=unit(sub(at(t[(e+2)%3]),p));m=Math.min(m,Math.acos(Math.max(-1,Math.min(1,dot(x1,x2)))));}return m;};
const faceN=dense.map(f=>f.n);
// Smooth vertices may sink along their normal (removing material only) so
// that the chords of a collapse do not stand above the dense surface.
const smoothVertex=v=>!openVertex[v]&&!locked[v]&&!featureCount(v)&&!seamSide(v);
const vertexNormal=v=>dense[denseAround[v][0][0]].n[denseAround[v][0][1]];
const sunk=new Float64Array(nv);
const version=new Uint32Array(nv);
// Evaluate collapsing u onto v. Returns null if invalid, else {cost,...}.
let why=0;const fail=k=>{why=k;return null;};
const evaluate=(u,v)=>{
 if(locked[u])return fail(1);
 const nf=featureCount(u),key=edgeKey(u,v);
 if(nf===1||nf>2)return fail(2);
 if(nf===2&&!feature.has(key))return fail(3);
 if(seamSide(u)&&seamSide(u)!==seamSide(v))return fail(4);
 const fu=[...around[u]],shared=fu.filter(f=>faces[f].includes(v));
 if(shared.length!==2)return fail(5);
 // Link condition.
 const ring=w=>{const s=new Set();for(const f of around[w])for(const x of faces[f])if(x!==w)s.add(x);return s;};
 const ru=ring(u),rv=ring(v),opp=new Set(shared.map(f=>faces[f].find(x=>x!==u&&x!==v)));
 for(const x of ru)if(x!==v&&rv.has(x)&&!opp.has(x))return fail(6);
 // Crease polyline deviation.
 if(nf===2){let w=-1;for(const x of ru)if(x!==v&&feature.has(edgeKey(u,x)))w=x;if(w<0)return fail(7);
  const a=pos[w],b=pos[v],d=sub(b,a),t=Math.max(0,Math.min(1,dot(sub(pos[u],a),d)/dot(d,d))),e=len(sub(pos[u],[a[0]+d[0]*t,a[1]+d[1]*t,a[2]+d[2]*t]));
  if(e>FEATURE)return fail(8);
 }
 const canSink=smoothVertex(v),nV=canSink?vertexNormal(v):null,vFaces=[...around[v]].filter(f=>!shared.includes(f));
 const checked=[];for(const f of fu)if(!shared.includes(f)||true)for(const si of faceSamples[f])checked.push(si);
 const vChecked=[];for(const f of vFaces)for(const si of faceSamples[f])vChecked.push(si);
 let pv=pos[v],sink=0;
 for(let iter=0;iter<6;iter++){
  const at=x=>x===v?pv:pos[x];
  // New faces round u.
  const next=[];
  for(const f of fu){if(shared.includes(f))continue;const nvx=faces[f].map(x=>x===u?v:x),old=faceNormal(...faces[f]),nn=cross(sub(at(nvx[1]),at(nvx[0])),sub(at(nvx[2]),at(nvx[0]))),la=len(nn);
   if(la<1e-13)return fail(9);const lo=len(old);if(lo>1e-13&&dot(old,nn)<.5*lo*la)return fail(10);
   // Sliver guard: no new angle under 1 degree, unless the face was already
   // that thin (the long wall strips) and does not get thinner.
   // No face may lie wholly in a seam plane (it would double the side wall)
   // or duplicate a face already there.
   const side=seamSide(nvx[0]);if(side&&seamSide(nvx[1])===side&&seamSide(nvx[2])===side)return fail(11);
   for(const g of around[nvx[1]])if(g!==f&&!shared.includes(g)&&faces[g].includes(nvx[0])&&faces[g].includes(nvx[2])&&faces[g].includes(nvx[1]))return fail(12);
   // Flat faces (corner normals within 3 degrees) may be long and thin.
   const fnn=unit(nn),cn=nvx.map((x,e)=>denseNormal(x,nvx[(e+1)%3],nvx[(e+2)%3],fnn));
   const flat=Math.min(dot(cn[0],cn[1]),dot(cn[1],cn[2]),dot(cn[0],cn[2]))>Math.cos(3*Math.PI/180);
   if(!flat&&minAngle(nvx,at)<Math.min(Math.PI/180,minAngle(faces[f])))return fail(13);
   next.push({f,v:nvx,n:cn});}
  const others=sink?vFaces.map(f=>({f,v:faces[f],n:faceN[f]})):[];
  if(sink)for(const o of others){const old=faceNormal(...o.v),nn=cross(sub(at(o.v[1]),at(o.v[0])),sub(at(o.v[2]),at(o.v[0])));if(dot(old,nn)<.5*len(old)*len(nn))return fail(14);}
  const cands=[...next,...others];
  // Every sample carried by the ring must land on a face within tolerance.
  let worstT=0,worstA=0,need=0;
  for(const si of sink?[...checked,...vChecked]:checked){const s=samples[si],hit=cast(s,cands,at);if(!hit)return fail(15);
   if(hit.t<-DOWN||hit.angle>NORMAL)return fail(16);
   if(hit.t>s.up){if(!canSink)return fail(17);const k=hit.c.v.indexOf(v),w=k<0?0:hit.weights[k];if(w<.05)return fail(18);
    const nf=unit(cross(sub(at(hit.c.v[1]),at(hit.c.v[0])),sub(at(hit.c.v[2]),at(hit.c.v[0])))),g=dot(nV,nf);if(g<.2)return fail(19);
    need=Math.max(need,(hit.t-s.up/2)*Math.max(.2,dot(s.n,nf))/(w*g));}
   worstT=Math.max(worstT,Math.abs(hit.t));worstA=Math.max(worstA,hit.angle);}
  if(!need)return{u,v,next,shared,pv,sink,vFaces,cost:worstT/DOWN+worstA/NORMAL+sink/DOWN+1e-6*len(sub(pos[u],pos[v]))};
  sink+=need*1.05;if(sunk[v]+sink>DOWN)return fail(20);pv=[pos[v][0]-nV[0]*sink,pos[v][1]-nV[1]*sink,pos[v][2]-nV[2]*sink];
 }
 return fail(21);
};
const apply=c=>{
 const{u,v,next,shared,pv,sink,vFaces}=c;const moved=[];
 for(const f of shared){alive[f]=0;for(const x of faces[f])around[x].delete(f);for(const si of faceSamples[f])moved.push(si);faceSamples[f]=[];}
 for(const nf of next){for(const si of faceSamples[nf.f])moved.push(si);faceSamples[nf.f]=[];faces[nf.f]=nf.v;faceN[nf.f]=nf.n;around[v].add(nf.f);}
 const cands=next.map(nf=>({f:nf.f,v:nf.v,n:nf.n}));
 if(sink){pos[v]=pv;sunk[v]+=sink;for(const f of vFaces){for(const si of faceSamples[f])moved.push(si);faceSamples[f]=[];cands.push({f,v:faces[f],n:faceN[f]});}}
 around[u].clear();
 for(const si of moved){const hit=cast(samples[si],cands);faceSamples[hit.c.f].push(si);}
 // Edge (u,x) features move to (v,x).
 for(const nf of next)for(const x of nf.v)if(x!==v&&feature.has(edgeKey(u,x)))feature.add(edgeKey(v,x));
 locked[u]=1;
};
// Greedy: cheapest collapse first, lazily re-evaluated.
class Heap{constructor(){this.a=[];}push(x){const a=this.a;a.push(x);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].cost<=a[i].cost)break;[a[p],a[i]]=[a[i],a[p]];i=p;}}
 pop(){const a=this.a,t=a[0],l=a.pop();if(a.length){a[0]=l;let i=0;for(;;){const L=2*i+1,R=L+1;let m=i;if(L<a.length&&a[L].cost<a[m].cost)m=L;if(R<a.length&&a[R].cost<a[m].cost)m=R;if(m===i)break;[a[m],a[i]]=[a[i],a[m]];i=m;}}return t;}get size(){return this.a.length;}}
const heap=new Heap();
const best=u=>{let b=null;const ring=new Set();for(const f of around[u])for(const x of faces[f])if(x!==u)ring.add(x);for(const v of ring){const c=evaluate(u,v);if(c&&(!b||c.cost<b.cost))b=c;}return b;};
const queue=u=>{const c=best(u);if(c)heap.push({u,cost:c.cost,version:version[u]});};
let collapses=0;
// Sweep until no vertex can go: a vertex blocked when first queued may
// become removable once distant collapses change its surroundings.
for(let sweep=0,before=-1;collapses!==before&&sweep<8;sweep++){before=collapses;for(let u=0;u<nv;u++)if(!locked[u]){version[u]++;queue(u);}
while(heap.size){const{u,version:ver}=heap.pop();if(ver!==version[u]||locked[u])continue;const c=best(u);if(!c)continue;
 const ring=new Set();for(const f of around[u])for(const x of faces[f])ring.add(x);
 apply(c);collapses++;
 // Neighbours are re-queued; anything further is re-evaluated when popped.
 for(const x of ring)if(!locked[x]){version[x]++;queue(x);}
}}
// Output with dense corner normals.
const positions=[],normals=[],index=[],out=new Map();
const emit=(v,n)=>{const p=pos[v],key=[...p,...n].map(q=>Math.round(q*1e6)).join();let k=out.get(key);if(k===undefined){k=positions.length/3;out.set(key,k);positions.push(...p);normals.push(...n);}return k;};
let tris=0;
faces.forEach((f,k)=>{if(!alive[k])return;const fn=faceNormal(...f);if(len(fn)<1e-14)return;const u=unit(fn);
 for(let e=0;e<3;e++)index.push(emit(f[e],denseNormal(f[e],f[(e+1)%3],f[(e+2)%3],u)));tris++;});
const r6=x=>+x.toFixed(6),r4=x=>+x.toFixed(4);
const mesh={teeth:face.teeth,innerRadius:face.innerRadius,outerRadius:face.outerRadius,back:face.back,clearance:face.clearance,
 simplification:{from:dense.length,up:UP,down:DOWN,normalDegrees:+(NORMAL*180/Math.PI).toFixed(3),feature:FEATURE,collapses},
 positions:positions.map(r6),normals:normals.map(r4),index};
const text=`// Adaptive display sector of 195's face wheel; scripts/bake-face-worm-195-mesh.mjs from src/data/face-worm-195.js.\nexport default ${JSON.stringify(mesh)};\n`,file='src/data/face-worm-195-mesh.js';
if(process.argv.includes('--check')){if(fs.readFileSync(file,'utf8')!==text)throw Error('Bake differs');}else if(!process.argv.includes('--dry'))fs.writeFileSync(file,text);
if(process.env.DIAG){const alivev=new Set();faces.forEach((f,k)=>{if(alive[k])f.forEach(v=>alivev.add(v));});let lk=0,op=0,sl=0,f2=0,f0=0,fj=0;for(const v of alivev){if(openVertex[v])op++;else if(seamLocked(v))sl++;const c=featureCount(v);if(c===0)f0++;else if(c===2)f2++;else fj++;}if(process.env.DIAG){const hist={};for(const v of alivev){const r=Math.hypot(pos[v][0],pos[v][1]),z=pos[v][2];const c=featureCount(v);const k=(z<=face.back+1e-6?'back':z===0?'land0':'cut')+':'+(Math.abs(r-face.outerRadius)<1e-6?'RO':Math.abs(r-face.innerRadius)<1e-6?'RI':'mid')+':f'+Math.min(c,3);hist[k]=(hist[k]||0)+1;}console.log(hist);}if(process.env.DIAG)console.log({alive:alivev.size,open:op,seamLocked:sl,smooth:f0,crease:f2,junction:fj,samples:samples.length});}
{const left=[...new Set(faces.flatMap((f,k)=>alive[k]?f:[]))].filter(onBore);if(left.some(v=>!boreCorner(v)))throw Error(`bore arc keeps ${left.filter(v=>!boreCorner(v)).length} off-corner vertices`);}
console.log({denseTriangles:dense.length,triangles:tris,vertices:positions.length/3,collapses,bytes:text.length});
