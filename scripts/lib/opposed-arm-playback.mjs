export function sampleOpposedArmPlayback(profile,time,{period=profile.playbackPeriod}={}){
 if(!Number.isFinite(time)||!Number.isFinite(period)||period<=0)throw Error('Invalid playback time or period');
 const physicsTime=Math.max(0,time)*profile.physicsPeriod/period,cycle=Math.floor(physicsTime/profile.physicsPeriod),
  local=physicsTime-cycle*profile.physicsPeriod,table=cycle===0?profile.first:profile.steady;
 let low=0,high=table.length-1;
 while(high-low>1){const middle=(low+high)>>1;if(table[middle][0]<=local)low=middle;else high=middle;}
 const a=table[low],b=table[high],fraction=Math.max(0,Math.min(1,(local-a[0])/(b[0]-a[0]))),
  values=a.slice(1).map((v,i)=>v+fraction*(b[i+1]-v)),
  angularVelocities=a.slice(1).map((v,i)=>(b[i+1]-v)/(b[0]-a[0])*profile.physicsPeriod/period);
 values[0]-=Math.max(0,cycle-1)*profile.teethPerCycle*profile.pitch;
 return{theta:values[0],upperBeta:values[1],lowerBeta:values[2],
  sliderX:profile.sourceSlider[0]+profile.physics.stroke*Math.sin(2*Math.PI*local/profile.physicsPeriod),
  physicsTime,cycle,phase:local/profile.physicsPeriod,period,angularVelocities};
}

export function attachOpposedArmPlayback(model,profile){
 const u=model.root.userData;
 model.update=time=>{const state=sampleOpposedArmPlayback(profile,time);u.setState(state);Object.assign(u.kinematics,state);return u.kinematics;};
 u.stateAtTime=time=>sampleOpposedArmPlayback(profile,time);u.profile=profile;model.update(0);return model;
}
