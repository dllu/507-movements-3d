import fs from 'node:fs';
import {drumContact as p,drumContactState as state} from '../src/simulation/oscillating-drum-contact.js';
function polygonDistance(q){let best=Infinity,inside=false;const v=p.profile;for(let i=0,j=v.length-1;i<v.length;j=i++){const a=v[j],b=v[i],dx=b[0]-a[0],dy=b[1]-a[1],x=q[0]-a[0],y=q[1]-a[1],t=Math.max(0,Math.min(1,(x*dx+y*dy)/(dx*dx+dy*dy)));best=Math.min(best,Math.hypot(x-t*dx,y-t*dy));if((b[1]>q[1])!==(a[1]>q[1])&&q[0]<(a[0]-b[0])*(q[1]-b[1])/(a[1]-b[1])+b[0])inside=!inside;}return inside?-best:best;}
function gap(lift,time){const a=p.base-lift,x=p.pivot[0]+p.length*Math.cos(a),y=p.pivot[1]+p.length*Math.sin(a),phase=state(time).relativeAngle;let result=Math.hypot(x,y)-p.rootRadius;const at=Math.floor((Math.atan2(y,x)-phase)/p.pitch);for(let j=at-1;j<=at+1;j++){const a=phase+j*p.pitch,c=Math.cos(a),s=Math.sin(a);result=Math.min(result,polygonDistance([c*x+s*y,-s*x+c*y]));}return result-p.rollerRadius;}
// Find a bounded continuous outward path through the free-overrun interval.
// The load interval is held at the exact seating angle. No force integration.
const count=1536,levels=481,maxLift=.75,start=p.releaseTime,end=p.period+p.catchTime,step=maxLift/(levels-1),parents=new Int16Array((count+1)*levels).fill(-1);
let costs=new Float64Array(levels).fill(Infinity);costs[0]=0;
for(let i=1;i<=count;i++){const t=start+(end-start)*i/count,next=new Float64Array(levels).fill(Infinity);for(let j=0;j<levels;j++){const lift=j*step;if(gap(lift,t)<(j===0?-1e-9:.000025))continue;for(let k=Math.max(0,j-7);k<=Math.min(levels-1,j+7);k++){const cost=costs[k]+lift*lift*.002+(j-k)**2*.00001;if(cost<next[j]){next[j]=cost;parents[i*levels+j]=k;}}}costs=next;}
if(!Number.isFinite(costs[0]))throw Error('No bounded overrun path');
const rows=Array(count+1);let at=0;for(let i=count;i>=0;i--){rows[i]=at*step;if(i)at=parents[i*levels+at];}
let residual=0;for(let i=0;i<count;i++)for(const f of[0,.25,.5,.75])residual=Math.min(residual,gap(rows[i]*(1-f)+rows[i+1]*f,start+(end-start)*(i+f)/count));
if(residual<-.00002)throw Error(JSON.stringify({residual}));
fs.writeFileSync(new URL('../src/simulation/oscillating-drum-pawl-data.js',import.meta.url),`// Offline continuous finite-clearance path during the free coast interval.\nexport const drumPawlPath=${JSON.stringify({start,end,rows:rows.map(v=>+v.toFixed(9))})};\n`);console.log({count,residual,catchTime:p.catchTime,releaseTime:p.releaseTime});
