export function samplePullPawlPlayback(profile,time,{period=profile.playbackPeriod}={}){
 if(!Number.isFinite(time)||!Number.isFinite(period)||period<=0)throw Error('Invalid playback clock');
 const physicsTime=Math.max(0,time)*profile.physicsPeriod/period,cycle=Math.floor(physicsTime/profile.physicsPeriod),
  local=physicsTime-cycle*profile.physicsPeriod,table=cycle===0?profile.first:profile.steady;
 let low=0,high=table.length-1;
 while(high-low>1){const middle=(low+high)>>1;if(table[middle][0]<=local)low=middle;else high=middle;}
 const a=table[low],b=table[high],fraction=Math.max(0,Math.min(1,(local-a[0])/(b[0]-a[0]))),
  values=a.slice(1).map((v,k)=>v+fraction*(b[k+1]-v)),
  angularVelocities=a.slice(1).map((v,k)=>(b[k+1]-v)/(b[0]-a[0])*profile.physicsPeriod/period);
 values[1]+=Math.max(0,cycle-1)*profile.pitch;
 return{q:values[0],theta:values[1],leftAngle:values[2],rightAngle:values[3],physicsTime,cycle,phase:local/profile.physicsPeriod,period,angularVelocities};
}

export function attachPullPawlPlayback(candidate,profile,options={}){
 candidate.update=time=>{const state=samplePullPawlPlayback(profile,time,options);candidate.root.userData.setState(state);Object.assign(candidate.root.userData.kinematics,state);};
 candidate.root.userData.playbackPeriod=options.period??profile.playbackPeriod;candidate.update(0);return candidate;
}
