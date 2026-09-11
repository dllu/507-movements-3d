// Signed-distance support for the simple star-shaped traced driver polygon.
// Angular ordering is checked; distance uses all polygon segments through a
// BVH, rather than treating radial depth as Euclidean distance.
export function makeSingleToothStarSolid(ring) {
  const turn=2*Math.PI,angles=[];
  for(const [x,y] of ring) {
    let a=Math.atan2(y,x);
    if(angles.length)while(a<angles.at(-1)-Math.PI)a+=turn;
    if(angles.length&&a<angles.at(-1))throw new Error('Driver is not angularly ordered');
    angles.push(a);
  }
  const edges=ring.map((a,i)=>{
    const b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1];
    return {a,b,dx,dy,lengthSquared:dx*dx+dy*dy,
      min:[Math.min(a[0],b[0]),Math.min(a[1],b[1])],max:[Math.max(a[0],b[0]),Math.max(a[1],b[1])]};
  });
  const build=items=>{
    const min=[Infinity,Infinity],max=[-Infinity,-Infinity];
    for(const e of items)for(let k=0;k<2;k++){min[k]=Math.min(min[k],e.min[k]);max[k]=Math.max(max[k],e.max[k]);}
    if(items.length<9)return {min,max,items};
    const axis=max[0]-min[0]>max[1]-min[1]?0:1;items.sort((a,b)=>a.min[axis]+a.max[axis]-b.min[axis]-b.max[axis]);
    const mid=items.length>>1;return {min,max,left:build(items.slice(0,mid)),right:build(items.slice(mid))};
  };
  const tree=build([...edges]);
  const maximumRadius=Math.max(...ring.map(q=>Math.hypot(...q)));
  const distanceToEdge=(point,e)=>{
    const t=Math.max(0,Math.min(1,((point[0]-e.a[0])*e.dx+(point[1]-e.a[1])*e.dy)/e.lengthSquared));
    return Math.hypot(point[0]-e.a[0]-t*e.dx,point[1]-e.a[1]-t*e.dy);
  };
  const penetration=point=>{
    const radius=Math.hypot(...point);if(radius>maximumRadius)return 0;
    let a=Math.atan2(point[1],point[0]);while(a<angles[0])a+=turn;while(a>=angles[0]+turn)a-=turn;
    let low=0,high=angles.length;
    while(high-low>1){const mid=(low+high)>>1;if(angles[mid]<=a)low=mid;else high=mid;}
    const edge=edges[low],ux=Math.cos(a),uy=Math.sin(a);
    const boundary=(edge.a[0]*edge.b[1]-edge.a[1]*edge.b[0])/(ux*edge.dy-uy*edge.dx);
    if(radius>=boundary)return 0;
    let best=distanceToEdge(point,edge);
    const visit=node=>{
      const dx=Math.max(0,node.min[0]-point[0],point[0]-node.max[0]),dy=Math.max(0,node.min[1]-point[1],point[1]-node.max[1]);
      if(dx*dx+dy*dy>=best*best)return;
      if(node.items)for(const e of node.items)best=Math.min(best,distanceToEdge(point,e));
      else {visit(node.left);visit(node.right);}
    };visit(tree);return best;
  };
  return {penetration,maximumRadius};
}
