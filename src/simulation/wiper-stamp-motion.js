import {makeWiperStampContact} from './wiper-stamp-contact.js';

export function makeWiperStampPlayback(model, data) {
  const contact = makeWiperStampContact(model), knots = data.knots, guard = data.camGuard;
  const sample = displayTime => {
    if (!Number.isFinite(displayTime)) throw Error('Nonfinite stamp playback time');
    const elapsed = Math.max(0, displayTime), time = elapsed <= data.end ? elapsed : data.loopStart + (elapsed-data.loopStart)%data.period;
    let low = 0, high = knots.length-1;
    while (low+1<high) {const mid=(low+high)>>1;if(knots[mid][0]<=time)low=mid;else high=mid;}
    const a=knots[low],b=knots[high],fraction=(time-a[0])/(b[0]-a[0]),interpolated=a[1]+fraction*(b[1]-a[1]);
    const camAngle=data.angularSpeed*time,support=contact.support(camAngle),stampY=Math.max(interpolated,model.root.userData.geometry.minimumStampY,
      support ? support.height+guard : -Infinity);
    return {time,elapsed,camAngle,stampY,interpolated,projection:stampY-interpolated,period:data.period,
      cyclePhase:((time%data.period)+data.period)%data.period/data.period};
  };
  return {sample,contact};
}
