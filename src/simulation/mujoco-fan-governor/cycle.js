// Six shaft turns per speed cycle. Prescribes only the input shaft, not lift.
export const fanGovernorCycle={period:6*Math.PI,meanSpeed:2,amplitude:.7,phase:.55};
export function fanGovernorCycleDrive(time){
 const g=fanGovernorCycle,omega=2*Math.PI/g.period;
 return {angle:g.phase+g.meanSpeed*time-g.amplitude*Math.sin(omega*time)/omega,
  velocity:g.meanSpeed-g.amplitude*Math.cos(omega*time)};
}
