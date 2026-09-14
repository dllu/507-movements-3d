import {sectorHandoffTravel} from './profile.js';

// Trim radial tooth ends against the rack's reversal path. Ordinary working
// flanks survive wherever the involute and cutter already roll together.
export function relieveSectorHandoffEnds(outline,rack,{centerX,radius,halfSpan,steps=1024,clearance=.0015}){
 const edges=rack.flatMap(p=>p.flatMap(r=>r.slice(1).map((b,i)=>[r[i],b]))),result=outline.map(p=>({angle:Math.atan2(p[1],p[0]),radius:Math.hypot(...p)})),initial=result.map(p=>p.radius);
 for(let i=0;i<=steps;i++){
  const theta=2*Math.PI*i/steps,q=sectorHandoffTravel(theta,radius,halfSpan).position,cs=Math.cos(theta),sn=Math.sin(theta);
  // Rack edge endpoints expressed in the rotating sector's local plane.
  const transformed=edges.map(([a,b])=>[a,b].map(([x,y])=>{x-=centerX;y+=q;return[cs*x-sn*y,sn*x+cs*y];}));
  for(const p of result){
   if(Math.abs(p.angle)<halfSpan-.5)continue;
   const dx=Math.cos(p.angle),dy=Math.sin(p.angle);let limit=p.radius+clearance;
   for(const[a,b]of transformed){const ex=b[0]-a[0],ey=b[1]-a[1],den=dx*ey-dy*ex;if(Math.abs(den)<1e-12)continue;const r=(a[0]*ey-a[1]*ex)/den,u=(a[0]*dy-a[1]*dx)/den;if(r>0&&r<limit&&u>=0&&u<=1)limit=r;}
   p.radius=Math.min(p.radius,limit-clearance);
  }
 }
 return{outline:result.map(p=>[p.radius*Math.cos(p.angle),p.radius*Math.sin(p.angle)]),maximumRemoval:Math.max(...result.map((p,i)=>initial[i]-p.radius)),minimumRadius:Math.min(...result.map(p=>p.radius)),steps,clearance};
}
