import * as THREE from 'three';

const key=p=>p.join(','),edgeKey=(a,b)=>[key(a),key(b)].sort().join('/');
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);

// Start with the rendered cap triangles so bores, grooves and disconnected
// islands survive. Merge only convex neighbors; never replace a hole by a hull.
export function convexPlateCells(geometry) {
  geometry.computeBoundingBox();
  const {min:{z:low},max:{z:high}}=geometry.boundingBox,p=geometry.attributes.position,index=geometry.index;
  for(let i=0;i<p.count;i++)if(p.getZ(i)!==low&&p.getZ(i)!==high)throw Error('Expected a straight extrusion along Z');
  let cells=[];
  for(let i=0;i<(index?.count??p.count);i+=3) {
    const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);
    if(!ids.every(j=>p.getZ(j)===high))continue;
    const cell=ids.map(j=>[p.getX(j),p.getY(j)]);
    cells.push(THREE.ShapeUtils.area(cell.map(q=>new THREE.Vector2(...q)))>0?cell:cell.reverse());
  }
  if(!cells.length||!(high>low))throw Error('Expected a finite plate with cap triangles');
  const triangleCount=cells.length;
  let changed=true;
  while(changed) {
    changed=false;const owners=new Map();
    search:for(let i=0;i<cells.length;i++)for(let j=0;j<cells[i].length;j++) {
      const cell=cells[i],a=cell[j],b=cell[(j+1)%cell.length],k=edgeKey(a,b),other=owners.get(k);
      if(other===undefined){owners.set(k,i);continue;}
      const boundary=new Map();
      for(const poly of [cells[other],cell])for(let n=0;n<poly.length;n++) {
        const x=poly[n],y=poly[(n+1)%poly.length],e=edgeKey(x,y);
        if(boundary.has(e))boundary.delete(e);else boundary.set(e,[x,y]);
      }
      const successors=new Map([...boundary.values()].map(([x,y])=>[key(x),y])),start=boundary.values().next().value[0],merged=[];
      let q=start;
      do{merged.push(q);q=successors.get(key(q));if(!q||merged.length>boundary.size)break;}while(key(q)!==key(start));
      if(!q||merged.length!==boundary.size||merged.length>64||merged.some((p,n)=>cross(merged[(n+merged.length-1)%merged.length],p,merged[(n+1)%merged.length])< -1e-12))continue;
      cells[other]=merged;cells.splice(i,1);changed=true;break search;
    }
  }
  return {cells,low,high,triangleCount};
}
