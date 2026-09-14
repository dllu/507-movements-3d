// One clockwise wrap with tangent free spans. Height changes uniformly with
// planar arc length, giving a continuous helix and separated entry/exit strands.
export function bowDrillCordPath(lower,upper,radius,segments=144){
 if(![lower,upper].every(p=>p.length===3&&p.every(Number.isFinite))||!Number.isFinite(radius)||radius<=0||!Number.isInteger(segments)||segments<8)throw new RangeError('Invalid 124 cord path');
 const length=p=>Math.hypot(p[0],p[1]),a=Math.atan2(lower[1],lower[0])-Math.acos(radius/length(lower)),b=Math.atan2(upper[1],upper[0])+Math.acos(radius/length(upper)),rawSweep=((a-b)%(2*Math.PI)+2*Math.PI)%(2*Math.PI),sweep=rawSweep<Math.PI?rawSweep+2*Math.PI:rawSweep,entry=[radius*Math.cos(a),radius*Math.sin(a)],exit=[radius*Math.cos(b),radius*Math.sin(b)],first=Math.hypot(entry[0]-lower[0],entry[1]-lower[1]),last=Math.hypot(upper[0]-exit[0],upper[1]-exit[1]),arc=radius*sweep,total=first+arc+last;
 if(!Number.isFinite(total)||sweep<Math.PI)throw new RangeError('Invalid 124 tangent wrap');
 const at=s=>{let p;if(s<first){const t=s/first;p=[lower[0]+t*(entry[0]-lower[0]),lower[1]+t*(entry[1]-lower[1])];}else if(s<first+arc){const theta=a-(s-first)/radius;p=[radius*Math.cos(theta),radius*Math.sin(theta)];}else{const t=(s-first-arc)/last;p=[exit[0]+t*(upper[0]-exit[0]),exit[1]+t*(upper[1]-exit[1])];}return[...p,lower[2]+s/total*(upper[2]-lower[2])];};
 return{points:Array.from({length:segments+1},(_,i)=>at(total*i/segments)),first,last,arc,sweep,total,length:Math.hypot(total,upper[2]-lower[2]),entry:at(first),exit:at(first+arc)};
}

// Uniform rigid sections approximate the curved wrap with chords. Expand the
// initial centerline until the actual chord envelope clears the drum exactly.
export function bowDrillClearCordPath(lower,upper,pitchRadius,segments=96){
 let radius=pitchRadius,path,minimum;
 for(let iteration=0;iteration<16;iteration++){
  path=bowDrillCordPath(lower,upper,radius,segments);minimum=Infinity;
  for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/(dx*dx+dy*dy)));minimum=Math.min(minimum,Math.hypot(a[0]+t*dx,a[1]+t*dy));}
  if(Math.abs(minimum-pitchRadius)<1e-12)return{...path,radius,minimumSectionRadius:minimum};
  radius+=pitchRadius-minimum;
 }
 throw new Error('124 initial cord clearance did not converge');
}
