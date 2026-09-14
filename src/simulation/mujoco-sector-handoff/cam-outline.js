const distance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
function reduce(points,tolerance){let maximum=0,index=0;for(let i=1;i<points.length-1;i++){const d=distance(points[i],points[0],points.at(-1));if(d>maximum){maximum=d;index=i;}}if(maximum<=tolerance)return[points[0],points.at(-1)];return[...reduce(points.slice(0,index+1),tolerance).slice(0,-1),...reduce(points.slice(index),tolerance)];}
// Swept-circle Boolean boundaries contain tiny almost-collinear fragments.
// Bound their replacement chords before constructing the visible cap mesh.
export function simplifyCamOutline(polygons,tolerance=.00005){
 let maximumError=0,originalVertices=0,vertices=0;
 const result=polygons.map(p=>p.map(ring=>{const points=ring.slice(0,-1);let split=1;for(let i=2;i<points.length;i++)if(Math.hypot(points[i][0]-points[0][0],points[i][1]-points[0][1])>Math.hypot(points[split][0]-points[0][0],points[split][1]-points[0][1]))split=i;
  const reduced=[...reduce(points.slice(0,split+1),tolerance).slice(0,-1),...reduce([...points.slice(split),points[0]],tolerance).slice(0,-1)];
  if(reduced.length<3)throw Error('Collapsed cam boundary');for(const q of points)maximumError=Math.max(maximumError,Math.min(...reduced.map((a,i)=>distance(q,a,reduced[(i+1)%reduced.length]))));originalVertices+=points.length;vertices+=reduced.length;return[...reduced,reduced[0]];
 }));
 if(maximumError>tolerance+1e-12)throw Error('Cam boundary simplification exceeded');return{polygons:result,maximumError,originalVertices,vertices,tolerance};
}
