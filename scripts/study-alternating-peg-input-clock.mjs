import fs from 'node:fs';import crypto from 'node:crypto';
const file=process.env.PROBE_TRAJECTORY||'artifacts/review/077-long-lip-wide-026.json',data=JSON.parse(fs.readFileSync(file)),
 count=512,epsilon=Number(process.env.CLOCK_EPSILON||.30),sigma=.018,period=data.parameters.period,cycle=2,
 samples=Array.from({length:count},(_,i)=>{const time=(cycle+i/count)*period,index=Math.round(time/data.dt);return Math.max(0,data.rows[index].v[0]);}),
 smooth=samples.map((_,i)=>{let sum=0,weight=0;for(let j=-40;j<=40;j++){const w=Math.exp(-.5*(j/count/sigma)**2);sum+=w*samples[(i+j+count)%count];weight+=w;}return sum/weight;}),
 average=smooth.reduce((sum,v)=>sum+v,0)/count,weights=smooth.map(v=>epsilon+(1-epsilon)*v/average),times=[0];
for(let i=0;i<count;i++)times.push(times.at(-1)+(weights[i]+weights[(i+1)%count])/(2*count));
const normalization=times.at(-1);for(let i=0;i<times.length;i++)times[i]/=normalization;for(let i=0;i<weights.length;i++)weights[i]/=normalization;
const knots=Array.from({length:count+1},(_,i)=>{const j=i%count,w=weights[j],derivative=(weights[(j+1)%count]-weights[(j+count-1)%count])*count/2;return{time:times[i],phase:i/count,rate:1/w,acceleration:-derivative/w**3};}),intervals=[],failures=[];
let minimumRate=Infinity,maximumRate=0,maximumAcceleration=0;
for(let i=0;i<count;i++){
 const a=knots[i],b=knots[i+1],h=b.time-a.time,c=[a.phase,h*a.rate,h*h*a.acceleration/2],
  Y=b.phase-c[0]-c[1]-c[2],V=h*b.rate-c[1]-2*c[2],A=h*h*b.acceleration-2*c[2];
 c.push(10*Y-4*V+A/2,-15*Y+7*V-A,6*Y-3*V+A/2);
 // The derivative is a quartic. Its Bernstein control values enclose its
 // range over the entire interval, including between the sampled knots.
 const power=c.slice(1).map((v,j)=>(j+1)*v/h),choose=(n,k)=>{let v=1;for(let j=1;j<=k;j++)v=v*(n-j+1)/j;return v;},
  bernstein=Array.from({length:5},(_,j)=>power.slice(0,j+1).reduce((sum,v,k)=>sum+v*choose(j,k)/choose(4,k),0));
 minimumRate=Math.min(minimumRate,...bernstein);maximumRate=Math.max(maximumRate,...bernstein);
 if(Math.min(...bernstein)<=0)failures.push({interval:i,reason:'clock-rate-not-certified-positive',bernstein});
 for(let j=0;j<=16;j++){const u=j/16,acceleration=c.slice(2).reduce((sum,v,k)=>sum+(k+2)*(k+1)*v*u**k,0)/h**2;maximumAcceleration=Math.max(maximumAcceleration,Math.abs(acceleration));}
 intervals.push({start:a.time,end:b.time,coefficients:c,rateBernstein:bernstein});
}
const report={movement:77,productionChanged:false,mechanicsPassed:false,sourceTrajectory:file,period,cycle,epsilon,sigma,knots,intervals,minimumRate,maximumRate,maximumAcceleration,failures,
 qualification:'A prescribed C2 lever-phase schedule. Time allocation is derived from a previous trial, then frozen. Only the input lever uses this clock; the wheel and pawls must be reintegrated under finite contact dynamics. It does not prescribe or resample output motion.',
 sources:[file,'scripts/study-alternating-peg-input-clock.mjs'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))},
 output=process.env.PROBE_OUTPUT||'artifacts/review/077-input-clock.json';
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log({output,minimumRate,maximumRate,maximumAcceleration,failures});if(failures.length)process.exitCode=1;
