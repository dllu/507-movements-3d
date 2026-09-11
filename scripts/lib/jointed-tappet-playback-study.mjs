export function sampleJointedTappetPlayback(profile,time,{period=12}={}){
 if(!Number.isFinite(time)||!Number.isFinite(period)||period<=0)throw new Error('Invalid playback clock');
 const elapsed=Math.max(0,time),physicsTime=elapsed*profile.physicsPeriod/period,cycle=Math.floor(physicsTime/profile.physicsPeriod),local=physicsTime-cycle*profile.physicsPeriod,table=cycle===0?profile.first:profile.steady;
 let low=0,high=table.length-1;while(high-low>1){const middle=(low+high)>>1;if(table[middle][0]<=local)low=middle;else high=middle;}
 const a=table[low],b=table[high],fraction=Math.max(0,Math.min(1,(local-a[0])/(b[0]-a[0]))),x=a.slice(1).map((v,k)=>v+fraction*(b[k+1]-v)),
  v=a.slice(1).map((value,k)=>(b[k+1]-value)/(b[0]-a[0])*profile.physicsPeriod/period);
 x[2]+=cycle*profile.geometry.pitch;
 return{q:x[0],alpha:x[1],theta:x[2],holdingAngle:x[3],driverAngle:-2*Math.PI*physicsTime/profile.physicsPeriod,cycle,phase:local/profile.physicsPeriod,physicsTime,period,angularVelocities:v};
}
export function attachJointedTappetPlayback(candidate,profile,options={}){
 const originalSetState=candidate.root.userData.setState;
 candidate.update=time=>{const state=sampleJointedTappetPlayback(profile,time,options);originalSetState(state);Object.assign(candidate.root.userData.kinematics,state);};
 candidate.root.userData.playbackPeriod=options.period??12;candidate.update(0);return candidate;
}
