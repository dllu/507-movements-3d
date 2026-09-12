export function makePumpCatchPlayback(data,{displayPeriod=4}={}){
  const {rows,angularSpeed,repeat}=data,loopEnd=repeat.start+repeat.period;
  if(!(displayPeriod>0&&rows.length>1&&rows[0].time===0&&rows.at(-1).time>=loopEnd))throw Error('Invalid pump playback profile');
  const sample=displayTime=>{
    if(!Number.isFinite(displayTime))throw Error('Nonfinite pump playback time');
    const physicalTime=Math.max(0,displayTime)*repeat.period/displayPeriod,
      time=physicalTime<=loopEnd?physicalTime:repeat.start+(physicalTime-repeat.start)%repeat.period;
    let lo=0,hi=rows.length-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(rows[mid].time<=time)lo=mid;else hi=mid;}
    const a=rows[lo],b=rows[hi],f=(time-a.time)/(b.time-a.time),q=a.q.map((v,k)=>v+f*(b.q[k]-v));
    // Continuous input angle also carries the belt texture through loop seams.
    return{physicalTime,time,q,wheelAngle:q[0],catchAngle:q[1]-q[0],pumpHeight:q[2],camAngle:angularSpeed*physicalTime,displayPeriod};
  };
  return{sample,displayPeriod};
}
