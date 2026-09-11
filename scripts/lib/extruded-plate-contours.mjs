// Recover all Float32 side-wall loops, including separate islands and bores.
// Returned loops are CCW and sorted by absolute enclosed area. Callers must
// choose the material boundary and normal direction appropriate to the part.
export function extrudedPlateContours(geometry){
  geometry.computeBoundingBox();const p=geometry.attributes.position,top=geometry.boundingBox.max.z;
  const links=new Map(),vertices=new Map(),key=v=>v.map(x=>Math.round(x*1e10)).join(',');
  for(let i=0;i<(geometry.index?.count??p.count);i+=3){
    const edge=[0,1,2].map(j=>geometry.index?geometry.index.getX(i+j):i+j)
      .filter(index=>p.getZ(index)===top).map(index=>[p.getX(index),p.getY(index)]);
    if(edge.length!==2)continue;const a=key(edge[0]),b=key(edge[1]);if(a===b)continue;
    vertices.set(a,edge[0]);vertices.set(b,edge[1]);
    for(const[from,to]of[[a,b],[b,a]]){if(!links.has(from))links.set(from,new Set());links.get(from).add(to);}
  }
  const unseen=new Set(vertices.keys()),rings=[];
  while(unseen.size){
    const start=unseen.values().next().value,points=[];let current=start,previous=null;
    do{
      if(!unseen.delete(current)||links.get(current)?.size!==2)throw new Error('Broken plate boundary');
      points.push(vertices.get(current));const next=[...links.get(current)].find(k=>k!==previous);previous=current;current=next;
    }while(current!==start);
    const area=points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a[0]*b[1]-a[1]*b[0];},0)/2;
    if(area<0)points.reverse();rings.push({points,area:Math.abs(area)});
  }
  return rings.sort((a,b)=>b.area-a.area);
}
