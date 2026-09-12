export function weightedClutchFlightState(model,row,direction){
 const u=model.root.userData,outputAngle=row.e*u.geometry.eRatio,
  inputAngle=outputAngle/u.geometry.mainRatio*(direction==='CCW'?-1:1);
 if(!['CCW','CW'].includes(direction))throw Error('Unknown lifting direction');
 return model.setState({leverAngle:row.q,direction:direction==='CCW'?'leftward':'rightward',inputAngle,outputAngle});
}

export function selectWeightedClutchFlightPoses(report){
 const rows=report.rows,release=report.events.filter(e=>e.kind==='release').at(-1),end=rows.at(-1).time,
  nearest=time=>rows.reduce((a,b)=>Math.abs(a.time-time)<Math.abs(b.time-time)?a:b),
  samples=[['start',rows[0]],['lifting-middle',nearest(release.time/2)],['release',nearest(release.time)],
   ...[.25,.5,.75].map(t=>['fall-'+t,nearest(release.time+(end-release.time)*t)]),['slot-arrival',rows.at(-1)]];
 if(report.direction==='CW'){
  const contact=report.events.find(e=>e.kind==='contact');
  samples.splice(1,0,['initial-separation',nearest(contact.time/2)],['first-recontact',nearest(contact.time)]);
 }
 return samples.map(([name,row])=>({name,direction:report.direction,row}));
}
