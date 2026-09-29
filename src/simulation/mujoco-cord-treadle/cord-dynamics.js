import {cordTreadleParameters,cordTreadleMetrics} from '../cord-treadle-motion.js';
import {idealCordShape} from './ideal-cord-shape.js';

// Pass 101 (user review: "the cord sagging is fine but ... add some inertia
// to the cord or else it looks too abrupt"). The quasi-static ideal cord
// (ideal-cord-shape.js) jumps into its length-preserving sag the instant
// slack appears: its depth grows with the square root of the slack, so it
// has an infinite rate at onset and again as the slack is taken up.
//
// Here the diagonal run, where the slack collects, is a chain of point
// masses joined by inextensible links (position-based dynamics with Verlet
// integration), under gravity at the rigid bodies' physical scale, with light
// air damping and an anti-kink limit on the angle between links. Its lower end
// follows the recorded crank pin. The cord from the top of the guide pulley
// onwards lies in the groove and hangs straight to the treadle eye, as in the
// ideal: it moves with the recorded pulley without slipping (material at the
// pulley's top has coordinate s_top = incoming0 + r (pulley + entry0 - pi/2)),
// so cord crossing the top joins or leaves the chain with continuous motion.
// Chain links over the pulley's upper-left quarter slide on it frictionlessly;
// the floor is a frictionless contact.
//
// The coupling is one way: the treadle still moves under MuJoCo's ideal
// massless cord, since the cord's weight is small beside the treadle's. The
// loop is run to its periodic steady state and one period is recorded.
export const CORD_DYNAMICS=Object.freeze({segments:64,substep:1/4000,iterations:48,gravity:98.1,damping:3,maximumBend:1.2,bending:0,shortest:.3,ropeRadius:.045,warmupPeriods:8,frames:200});

/**
 * motionAt(t) -> [disk, treadle, pulley] for loop time t >= 0 (periodic).
 */
export function simulateCordLoop(motionAt,{period=4,geometry=cordTreadleParameters(),...options}={}){
 const o={...CORD_DYNAMICS,...options},g=geometry,N=o.segments,rest=g.cordLength/N,R=g.guideRadius,floor=g.groundY+o.ropeRadius;
 const [gx,gy]=g.guide,dt=o.substep,stepsPerPeriod=Math.round(period/dt);
 if(Math.abs(stepsPerPeriod*dt-period)>1e-9)throw new RangeError('The substep must divide the period');
 const framesEvery=stepsPerPeriod/o.frames;if(!Number.isInteger(framesEvery))throw new RangeError('Frames must divide the substeps of a period');
 const [disk0,treadle0]=motionAt(0),start=idealCordShape(disk0,treadle0,{segments:N}).points;
 const x=new Float64Array(N+1),y=new Float64Array(N+1),px=new Float64Array(N+1),py=new Float64Array(N+1);
 start.forEach((p,i)=>{x[i]=px[i]=p[0];y[i]=py[i]=p[1];});
 const reference=cordTreadleMetrics(0,g.initialTreadle,g),drag=1-o.damping*dt,fall=-o.gravity*dt*dt,bendCosine=Math.cos(o.maximumBend/2);
 // Ideal groove-and-vertical-run position of material coordinate s.
 const fixedAt=(s,pulley,m)=>{
  const phase=pulley+reference.entryAngle,top=Math.PI/2;let exit=m.exitAngle;while(exit>top)exit-=2*Math.PI;while(exit<=top-2*Math.PI)exit+=2*Math.PI;
  const sExit=reference.incoming+R*(phase-exit);
  if(s<=sExit){const a=phase-(s-reference.incoming)/R;return[gx+R*Math.cos(a),gy+R*Math.sin(a)];}
  const f=Math.min(1,(s-sExit)/Math.max(1e-9,g.cordLength-sExit)),e=[gx+R*Math.cos(exit),gy+R*Math.sin(exit)];return[e[0]+f*(m.eye[0]-e[0]),e[1]+f*(m.eye[1]-e[1])];
 };
 let free=0;
 const step=t=>{
  const [disk,treadle,pulley]=motionAt(t),m=cordTreadleMetrics(disk,treadle,g);
  const sTop=reference.incoming+R*(pulley+reference.entryAngle-Math.PI/2);
  free=Math.max(1,Math.min(N-1,Math.ceil(sTop/rest)-1));
  // When the cord is taut, MuJoCo's soft tendon limit lets it stretch very
  // slightly; share that stretch along the free links so the chain has a
  // feasible straight state instead of fighting its constraints.
  const anchor=reference.entryAngle+pulley-(free+1)*rest/R+reference.incoming/R;let span=m.entryAngle-anchor;
  const link=Math.max(rest,(m.incoming+R*Math.max(0,span))/(free+1));
  for(let i=1;i<=free;i++){const vx=(x[i]-px[i])*drag,vy=(y[i]-py[i])*drag;px[i]=x[i];py[i]=y[i];x[i]+=vx;y[i]+=vy+fall;}
  px[0]=x[0];py[0]=y[0];x[0]=m.pin[0];y[0]=m.pin[1];
  for(let i=free+1;i<=N;i++){px[i]=x[i];py[i]=y[i];[x[i],y[i]]=i===N?m.eye:fixedAt(i*rest,pulley,m);}
  // Bending stiffness: a light smoothing of the free chain's curvature.
  if(o.bending)for(let i=1;i<=free;i++){x[i]+=o.bending*((x[i-1]+x[i+1])/2-x[i]);y[i]+=o.bending*((y[i-1]+y[i+1])/2-y[i]);}
  for(let k=0;k<o.iterations;k++){
   const forward=k%2===0;
   for(let j=0;j<=free;j++){
    const i=forward?j:free-j,dx=x[i+1]-x[i],dy=y[i+1]-y[i],d=Math.hypot(dx,dy);if(!d)continue;
    const target=d>link?link:d<o.shortest*link?o.shortest*link:d;if(target===d)continue;const wa=i===0?0:1,wb=i+1>free?0:1,w=wa+wb;if(!w)continue;const c=(d-target)/d/w;
    x[i]+=wa*c*dx;y[i]+=wa*c*dy;x[i+1]-=wb*c*dx;y[i+1]-=wb*c*dy;
   }
   // Anti-kink: second neighbours stay at least 2 link cos(maximumBend/2) apart.
   const minimumSpan=2*link*bendCosine;
   if(o.maximumBend<Math.PI)for(let i=1;i<=free;i++){
    const dx=x[i+1]-x[i-1],dy=y[i+1]-y[i-1],d=Math.hypot(dx,dy);if(!d||d>=minimumSpan)continue;
    const wa=i-1===0?0:1,wb=i+1>free?0:1,w=wa+wb;if(!w)continue;const c=(d-minimumSpan)/d/w*.5;
    x[i-1]+=wa*c*dx;y[i-1]+=wa*c*dy;x[i+1]-=wb*c*dx;y[i+1]-=wb*c*dy;
   }
   for(let i=1;i<=free;i++){
    const dx=x[i]-gx,dy=y[i]-gy,d=Math.hypot(dx,dy);if(d<R){x[i]=gx+dx*R/d;y[i]=gy+dy*R/d;}
    if(y[i]<floor)y[i]=floor;
   }
  }
 };
 let tick=0;
 for(;tick<o.warmupPeriods*stepsPerPeriod;tick++)step((tick+1)*dt);
 const width=2*(N+1),points=new Float64Array((o.frames+1)*width);
 const record=f=>{for(let i=0;i<=N;i++){points[f*width+2*i]=x[i];points[f*width+2*i+1]=y[i];}};
 record(0);
 for(let f=1;f<=o.frames;f++){for(let s=0;s<framesEvery;s++){tick++;step(tick*dt);}record(f);}
 // Close the loop: remove the (small) remaining periodic residual linearly.
 let closure=0;
 for(let d=0;d<width;d++)closure=Math.max(closure,Math.abs(points[o.frames*width+d]-points[d]));
 for(let f=0;f<=o.frames;f++){const t=f/o.frames;for(let d=0;d<width;d++)points[f*width+d]-=t*(points[o.frames*width+d]-points[d]);}
 return {segments:N,frames:o.frames,period,rest,points,closure,options:o};
}

/** Interpolated cord centreline (z = 0.64) at a loop time. */
export function sampleCordLoop(cord,time,out=[]){
 const {frames,period,segments}=cord,width=2*(segments+1),phase=((time%period)+period)%period/period*frames;
 const f=Math.min(frames-1,Math.floor(phase)),t=phase-f,a=f*width,b=a+width,p=cord.points;
 for(let i=0;i<=segments;i++){const v=out[i]??(out[i]=[0,0,.64]);v[0]=p[a+2*i]+t*(p[b+2*i]-p[a+2*i]);v[1]=p[a+2*i+1]+t*(p[b+2*i+1]-p[a+2*i+1]);v[2]=.64;}
 out.length=segments+1;
 return out;
}
