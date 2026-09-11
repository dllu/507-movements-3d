export function sampleCrossedRackProfile(profile,time,{period=profile.playbackPeriod}={}){
 if(!Number.isFinite(time)||!Number.isFinite(period)||period<=0)throw Error('Invalid finite playback time or period');
 const rate=profile.physicsPeriod/period,duration=profile.physicsDuration/rate,
  physicsTime=Math.min(profile.physicsDuration,Math.max(0,time)*rate),rows=profile.rows;
 let low=0,high=rows.length-1;
 while(high-low>1){const middle=(low+high)>>1;if(rows[middle][0]<=physicsTime)low=middle;else high=middle;}
 const a=rows[low],b=rows[high],fraction=Math.max(0,Math.min(1,(physicsTime-a[0])/(b[0]-a[0]))),
  x=a.slice(1).map((v,i)=>v+fraction*(b[i+1]-v)),finished=time>=duration,held=time<0||finished,
  v=a.slice(1).map((v,i)=>held?0:(b[i+1]-v)/(b[0]-a[0])*rate),p=profile.physics,
  stopped=p.stopAt!==null&&physicsTime>=p.stopAt,inputTime=stopped?p.stopAt:physicsTime,
  q=p.amplitude*Math.sin(p.omega*inputTime),qVelocity=held||stopped?0:rate*p.amplitude*p.omega*Math.cos(p.omega*inputTime);
 return{q,rackY:x[0],leftAngle:x[1],rightAngle:x[2],rackVelocity:v[0],angularVelocities:[qVelocity,v[1],v[2]],
  physicsTime,period,duration,finished,inputStopped:stopped};
}
