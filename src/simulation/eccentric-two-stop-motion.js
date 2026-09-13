export function makeEccentricTwoStopMotion(profile) {
  const {samples,repeat,omega,displayPeriod} = profile,rate=repeat.period/displayPeriod;
  function atTime(time) {
    if(!Number.isFinite(time))throw Error('Nonfinite eccentric two-stop time');
    const modelTime=Math.max(0,time)*rate;
    const cycles=modelTime<repeat.start?0:Math.floor((modelTime-repeat.start)/repeat.period),localTime=modelTime-cycles*repeat.period;
    let lo=0,hi=samples.length-1;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(samples[mid][0]<=localTime)lo=mid;else hi=mid;}
    const a=samples[lo],b=samples[hi],f=(localTime-a[0])/(b[0]-a[0]);
    return {inputAngle:omega*modelTime,outputAngle:a[1]+f*(b[1]-a[1])+cycles*repeat.outputDelta,localTime,modelTime};
  }
  return {atTime,rate,period:displayPeriod};
}
