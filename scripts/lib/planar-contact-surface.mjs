// Inspect actual extruded contours, using adjacent edge normal cones at a
// convex vertex. The caller selects outward normals or their opposites.
export function planarContactSurface(ring, { inward=false, gapTolerance=5e-6 } = {}) {
  const edges = ring.map((a,i) => {
    const b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
    return {a,b,index:i,dx,dy,length,normal:inward?[-dy/length,dx/length]:[dy/length,-dx/length],
      min:[Math.min(a[0],b[0]),Math.min(a[1],b[1])],max:[Math.max(a[0],b[0]),Math.max(a[1],b[1])]};
  });
  const cone=i=>[edges[(i+edges.length-1)%edges.length].normal,edges[i%edges.length].normal];
  const build=items=>{
    const min=[Infinity,Infinity],max=[-Infinity,-Infinity];
    for(const e of items)for(let k=0;k<2;k++){min[k]=Math.min(min[k],e.min[k]);max[k]=Math.max(max[k],e.max[k]);}
    if(items.length<9)return{min,max,items};
    const axis=max[0]-min[0]>max[1]-min[1]?0:1;
    items.sort((a,b)=>a.min[axis]+a.max[axis]-b.min[axis]-b.max[axis]);
    const mid=items.length>>1;return{min,max,left:build(items.slice(0,mid)),right:build(items.slice(mid))};
  };
  const tree=build([...edges]);
  const near=(point,accept)=>{
    const visit=node=>{
      const dx=Math.max(0,node.min[0]-point[0],point[0]-node.max[0]),dy=Math.max(0,node.min[1]-point[1],point[1]-node.max[1]);
      if(dx*dx+dy*dy>gapTolerance*gapTolerance)return;
      if(node.items)for(const e of node.items){
        const t=Math.max(0,Math.min(1,((point[0]-e.a[0])*e.dx+(point[1]-e.a[1])*e.dy)/(e.length*e.length)));
        const at=[e.a[0]+t*e.dx,e.a[1]+t*e.dy],distance=Math.hypot(point[0]-at[0],point[1]-at[1]);
        if(distance>gapTolerance)continue;
        const normals=t*e.length<gapTolerance?cone(e.index):(1-t)*e.length<gapTolerance?cone(e.index+1):[e.normal];
        accept({at,distance,normals,edge:e.index});
      }else{visit(node.left);visit(node.right);}
    };visit(tree);
  };
  return{near,samples:edges.flatMap(e=>[{point:e.a,normals:cone(e.index)},
    {point:[(e.a[0]+e.b[0])/2,(e.a[1]+e.b[1])/2],normals:[e.normal]}])};
}

export function forceInNormalCone(force,normals,angleTolerance=.002){
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const relative=wrap(Math.atan2(force[1],force[0])-Math.atan2(normals[0][1],normals[0][0]));
  if(normals.length===1)return Math.abs(relative)<=angleTolerance;
  const span=wrap(Math.atan2(normals[1][1],normals[1][0])-Math.atan2(normals[0][1],normals[0][0]));
  return relative>=Math.min(0,span)-angleTolerance&&relative<=Math.max(0,span)+angleTolerance;
}
