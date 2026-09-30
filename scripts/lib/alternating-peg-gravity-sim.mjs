// Planar rigid-body simulation of movement 077 (p111): a crank-driven rocking
// lever C carries two freely hinged hook pawls that fall under gravity onto
// the wheel's pegs. State: wheel angle theta and the two pawls' absolute
// angles; the lever angle q(t) is prescribed (a sinusoid about Brown's pose).
// Contacts are between the pawl solids (analytic union of the hook's annular
// sector, its two round lip caps, the flat shank and the pivot eye) and the
// 24 round pegs, with a stiff spring-damper normal law (inelastic, no bounce)
// and regularized Coulomb friction. The wheel carries a regularized dry
// friction load plus light viscous damping; each pawl pivot has mild viscous
// damping relative to the lever. Integration: semi-implicit Euler at dt.
import {makeAlternatingPegGeometry} from '../../src/simulation/alternating-peg-geometry.js';

const rot=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];

// Hook-head constants shared with alternating-peg-pawl.js.
export function pawlShape(L){
 const pinRadius=.049,socketClearance=.009,backAngle=-40*Math.PI/180,socketRadius=pinRadius+socketClearance,rimRadius=.09,
  capRadius=(rimRadius-socketRadius)/2,midRadius=(rimRadius+socketRadius)/2,capSweep=capRadius/midRadius,
  lipUpper=125*Math.PI/180-capSweep,lipLower=-55*Math.PI/180+capSweep,socketOffset=rot([-socketClearance,0],backAngle),
  head=[-L+socketOffset[0],socketOffset[1]],shankHalf=.029,shankEnd=-L+.075,eye=.056;
 const caps=[lipUpper,lipLower].map(a=>[head[0]+midRadius*Math.cos(a),head[1]+midRadius*Math.sin(a)]);
 // Signed distance from local point p to the pawl solid, with outward unit normal.
 const distance=p=>{
  let best=Infinity,normal=null;
  const take=(d,n)=>{if(d<best){best=d;normal=n;}};
  // Annular sector (socket..rim) between the lip angles; its ends are covered by the caps.
  {const dx=p[0]-head[0],dy=p[1]-head[1],r=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
   let inside=a>=lipLower&&a<=lipUpper;
   if(inside&&r>1e-12){const u=[dx/r,dy/r];
    if(r<socketRadius)take(socketRadius-r,[-u[0],-u[1]]);
    else if(r>rimRadius)take(r-rimRadius,u);
    else{const din=r-socketRadius,dout=rimRadius-r;take(-Math.min(din,dout),din<dout?[-u[0],-u[1]]:u);}}}
  for(const c of caps){const dx=p[0]-c[0],dy=p[1]-c[1],r=Math.hypot(dx,dy);if(r>1e-12)take(r-capRadius,[dx/r,dy/r]);}
  // Shank rectangle [shankEnd,0] x [-shankHalf,shankHalf].
  {const qx=Math.max(shankEnd-p[0],p[0]-0),qy=Math.abs(p[1])-shankHalf;
   if(qx>0||qy>0){const ox=Math.max(qx,0),oy=Math.max(qy,0),d=Math.hypot(ox,oy),sx=p[0]<shankEnd?-1:1;
    take(d,[sx*ox/d,Math.sign(p[1]||1)*oy/d]);}
   else take(Math.max(qx,qy),qx>qy?[p[0]<(shankEnd/2)?-1:1,0]:[0,Math.sign(p[1]||1)]);}
  {const r=Math.hypot(p[0],p[1]);if(r>1e-12)take(r-eye,[p[0]/r,p[1]/r]);}
  return{d:best,n:normal};
 };
 return{distance,head,socketRadius,socketOffset};
}

// Velocity-level (impulse) contact with zero restitution, solved by projected
// Gauss-Seidel each step: a landing pawl or a struck peg stops dead instead of
// bouncing, the wheel's dry-friction load is a true stiction impulse, and
// speculative contacts keep every gap non-negative to first order.
export function simulateAlternatingPeg({
 period=4,amplitude=.245,qmid=.11,g=9.81,density=1000,
 wheelCoulomb=200,wheelViscous=4,pivotDamping=.004,friction=.2,lubrication=3000,baumgarte=.2,margin=.02,skin=2e-6,
 dt=2e-4,cycles=12,recordEvery=5,iterations=60,masses,seatPhase
}={}){
 if(!Number.isFinite(seatPhase))throw Error('seatPhase required (the production peg phase)');
 const geometry=makeAlternatingPegGeometry({seatPhase}),p=geometry.parameters,r=p.pinRadius,omega=2*Math.PI/period;
 // q(t)=qmid+amplitude*sin(omega t+psi), with q(0)=0 on the rising stroke (Brown's drawn pose).
 const psi=Math.asin(-qmid/amplitude);
 const lever=t=>{const s=omega*t+psi;return{q:qmid+amplitude*Math.sin(s),w:amplitude*omega*Math.cos(s),a:-amplitude*omega*omega*Math.sin(s)};};
 const keys=['upper','lower'],shapes=Object.fromEntries(keys.map(k=>[k,pawlShape(p.lengths[k])]));
 const body=Object.fromEntries(keys.map(k=>{const m=masses[k];return[k,{m:density*m.volume,I:density*m.polar,c:[m.centroid[0],m.centroid[1]]}];}));
 const Iw=density*masses.wheel.polar;
 let theta=0,wt=0;const phi={upper:p.initialAngles.upper,lower:p.initialAngles.lower},w={upper:0,lower:0};
 const rows=[],contactLog=[];let minClear=Infinity;
 const total=Math.round(cycles*period/dt);
 for(let step=0;step<=total;step++){
  const t=step*dt,L=lever(t);
  // Contacts at the start of the step.
  const contacts=[];
  for(const k of keys){
   const P=geometry.anchorAt(k,L.q),armW=rot(p.arms[k],L.q),vP=[-armW[1]*L.w,armW[0]*L.w];
   for(let i=0;i<24;i++){
    const c=geometry.pinAt(i,theta),dx=c[0]-P[0],dy=c[1]-P[1];if(dx*dx+dy*dy>2)continue;
    const local=rot([dx,dy],-phi[k]),{d,n}=shapes[k].distance(local),gap=d-r-skin;
    if(gap+skin<minClear)minClear=gap+skin;
    if(gap>margin)continue;
    const nW=rot(n,phi[k]),pc=[c[0]-nW[0]*r,c[1]-nW[1]*r],rp=[pc[0]-P[0],pc[1]-P[1]],tn=[-nW[1],nW[0]];
    // v_rel = Jw*wt + Jk*w_k + b along each direction (peg point minus pawl point).
    const row=dir=>({Jw:dir[0]*-pc[1]+dir[1]*pc[0],Jk:-(dir[0]*-rp[1]+dir[1]*rp[0]),b:-(dir[0]*vP[0]+dir[1]*vP[1])});
    const N=row(nW),T=row(tn);
    contacts.push({k,peg:i,gap,N,T,mN:1/(N.Jw*N.Jw/Iw+N.Jk*N.Jk/body[k].I),mT:1/(T.Jw*T.Jw/Iw+T.Jk*T.Jk/body[k].I),lN:0,lT:0});
   }
  }
  if(step%recordEvery===0){rows.push([t,L.q,theta,phi.upper,phi.lower]);contactLog.push({upper:contacts.filter(c=>c.k==='upper'&&c.gap<1e-4).map(c=>c.peg),lower:contacts.filter(c=>c.k==='lower'&&c.gap<1e-4).map(c=>c.peg)});}
  if(step===total)break;
  // Free velocities: gravity, the pivot's acceleration, pivot and wheel damping.
  for(const k of keys){
   const b=body[k],cW=rot(b.c,phi[k]),armW=rot(p.arms[k],L.q),aP=[-armW[1]*L.a-armW[0]*L.w*L.w,armW[0]*L.a-armW[1]*L.w*L.w];
   const tau=cross(cW,[0,-b.m*g])-b.m*cross(cW,aP)-pivotDamping*(w[k]-L.w);
   w[k]+=dt*tau/b.I;
  }
  wt*=Math.exp(-wheelViscous*dt/Iw);
  // Projected Gauss-Seidel on the contact and stiction impulses.
  let lW=0;const lWmax=wheelCoulomb*dt;
  for(let it=0;it<iterations;it++){
   {const dl=-wt*Iw,old=lW;lW=Math.max(-lWmax,Math.min(lWmax,old+dl));wt+=(lW-old)/Iw;}
   for(const c of contacts){
    const vn=c.N.Jw*wt+c.N.Jk*w[c.k]+c.N.b,target=c.gap>0?-c.gap/dt:-baumgarte*c.gap/dt;
    let dl=c.mN*(target-vn);const old=c.lN;c.lN=Math.max(0,old+dl);dl=c.lN-old;
    wt+=c.N.Jw*dl/Iw;w[c.k]+=c.N.Jk*dl/body[c.k].I;
    const vt=c.T.Jw*wt+c.T.Jk*w[c.k]+c.T.b,maxT=friction*c.lN;
    // Lubricated contact: viscous shear (soft constraint) capped by Coulomb.
    const gamma=1/(lubrication*dt);let dt2=-(vt+gamma*c.lT)/(1/c.mT+gamma);const oldT=c.lT;c.lT=Math.max(-maxT,Math.min(maxT,oldT+dt2));dt2=c.lT-oldT;
    wt+=c.T.Jw*dt2/Iw;w[c.k]+=c.T.Jk*dt2/body[c.k].I;
   }
  }
  theta+=dt*wt;for(const k of keys)phi[k]+=dt*w[k];
 }
 return{rows,contactLog,minClear,maxPen:Math.max(0,-minClear),period,psi,lever,parameters:{period,amplitude,qmid,g,density,wheelCoulomb,wheelViscous,pivotDamping,friction,lubrication,baumgarte,margin,skin,dt,cycles,iterations},geometry};
}
