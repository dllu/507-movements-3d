import profile from '../data/alternating-peg-profile.js';

// One baked steady cycle (p111, scripts/bake-alternating-peg-gravity.mjs),
// repeated with the wheel one peg pitch further on each cycle. Rows are 1 ms of
// physical time apart; linear interpolation keeps the checked pin clearance.
export function sampleAlternatingPegMotion(time,{period=profile.playbackPeriod}={}){
 if(!Number.isFinite(time)||!Number.isFinite(period)||period<=0)throw Error('Invalid playback clock');
 const physicsTime=Math.max(0,time)*profile.physicsPeriod/period,cycle=Math.floor(physicsTime/profile.physicsPeriod),
  local=physicsTime-cycle*profile.physicsPeriod,table=profile.steady;
 let low=0,high=table.length-1;
 while(high-low>1){const middle=(low+high)>>1;if(table[middle][0]<=local)low=middle;else high=middle;}
 const a=table[low],b=table[high],fraction=Math.max(0,Math.min(1,(local-a[0])/(b[0]-a[0]))),
  values=a.slice(1).map((v,k)=>v+fraction*(b[k+1]-v)),
  angularVelocities=a.slice(1).map((v,k)=>(b[k+1]-v)/(b[0]-a[0])*profile.physicsPeriod/period);
 values[1]+=cycle*profile.pitch;
 return{q:values[0],theta:values[1],upperAngle:values[2],lowerAngle:values[3],physicsTime,cycle,phase:local/profile.physicsPeriod,period,angularVelocities};
}
