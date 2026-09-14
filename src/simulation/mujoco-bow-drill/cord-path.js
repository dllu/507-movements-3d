// One clockwise wrap with tangent free spans. Height changes uniformly with
// planar arc length, giving a continuous helix and separated entry/exit strands.
export function bowDrillCordPath(lower,upper,radius,segments=144){
 const length=p=>Math.hypot(p[0],p[1]),a=Math.atan2(lower[1],lower[0])-Math.acos(radius/length(lower)),b=Math.atan2(upper[1],upper[0])+Math.acos(radius/length(upper)),rawSweep=((a-b)%(2*Math.PI)+2*Math.PI)%(2*Math.PI),sweep=rawSweep<Math.PI?rawSweep+2*Math.PI:rawSweep,entry=[radius*Math.cos(a),radius*Math.sin(a)],exit=[radius*Math.cos(b),radius*Math.sin(b)],first=Math.hypot(entry[0]-lower[0],entry[1]-lower[1]),last=Math.hypot(upper[0]-exit[0],upper[1]-exit[1]),arc=radius*sweep,total=first+arc+last;
 if(!Number.isFinite(total)||sweep<Math.PI)throw new RangeError('Invalid 124 tangent wrap');
 const at=s=>{let p;if(s<first){const t=s/first;p=[lower[0]+t*(entry[0]-lower[0]),lower[1]+t*(entry[1]-lower[1])];}else if(s<first+arc){const theta=a-(s-first)/radius;p=[radius*Math.cos(theta),radius*Math.sin(theta)];}else{const t=(s-first-arc)/last;p=[exit[0]+t*(upper[0]-exit[0]),exit[1]+t*(upper[1]-exit[1])];}return[...p,lower[2]+s/total*(upper[2]-lower[2])];};
 return{points:Array.from({length:segments+1},(_,i)=>at(total*i/segments)),first,last,arc,sweep,total,length:Math.hypot(total,upper[2]-lower[2]),entry:at(first),exit:at(first+arc)};
}
