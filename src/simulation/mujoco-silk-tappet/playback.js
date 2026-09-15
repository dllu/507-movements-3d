// The screw has finite travel: stop at the last key instead of wrapping its nut.
export function sampleSilkTappetMotion(bundle,time) {
  if(!Number.isFinite(time)||time<0)throw new RangeError('Invalid tappet playback time');
  const rows=bundle.motion;let lo=0,hi=rows.length-1;
  while(lo+1<hi){const mid=(lo+hi)>>1;if(rows[mid][0]<=time)lo=mid;else hi=mid;}
  const a=rows[lo],b=rows[hi],u=Math.max(0,Math.min(1,(time-a[0])/(b[0]-a[0])));
  return {carrier:a[1]+u*(b[1]-a[1]),wheel:a[2]+u*(b[2]-a[2])};
}
