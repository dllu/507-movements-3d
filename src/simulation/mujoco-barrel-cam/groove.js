import * as THREE from 'three';

// Each annular cross-section triangle extrudes along X to an affine groove
// wall. The resulting six-vertex prism is convex and exactly fills its share
// of the rendered solid, without a hull protruding across a warped quad.
export function barrelLand(f,side) {
  const cells=[],positions=[],normals=[],wall=f.walls[side<0?0:1],end=side<0?f.left:f.right;
  const point=(j,i,x)=>{const a=i===f.segments?0:2*Math.PI*i/f.segments;return[x,f.radii[j]*Math.cos(a),f.radii[j]*Math.sin(a)];};
  const normal=(j,i)=>{
    const a=i===f.segments?0:2*Math.PI*i/f.segments,r=f.radii[j],lo=Math.max(0,j-1),hi=Math.min(f.radii.length-1,j+1),k=i%f.segments;
    const dr=(wall[hi][i]-wall[lo][i])/(f.radii[hi]-f.radii[lo]);
    const da=(wall[j][(k+1)%f.segments]-wall[j][(k+f.segments-1)%f.segments])/(4*Math.PI/f.segments);
    return new THREE.Vector3(-side*r,side*(r*dr*Math.cos(a)-da*Math.sin(a)),side*(r*dr*Math.sin(a)+da*Math.cos(a))).normalize().toArray();
  };
  const triangle=(p,n)=>{
    p=p.map(v=>v.map(Math.fround));const [a,b,c]=p.map(v=>new THREE.Vector3(...v));
    const cross=b.clone().sub(a).cross(c.clone().sub(a));if(cross.lengthSq()<1e-22)return;
    if(cross.dot(new THREE.Vector3(...n[0]).add(new THREE.Vector3(...n[1])).add(new THREE.Vector3(...n[2])))<0){[p[1],p[2]]=[p[2],p[1]];[n[1],n[2]]=[n[2],n[1]];}
    positions.push(...p.flat());normals.push(...n.flat());
  };
  const quad=(p,n)=>{triangle([p[0],p[1],p[2]],[n[0],n[1],n[2]]);triangle([p[0],p[2],p[3]],[n[0],n[2],n[3]]);};
  for(let j=0;j<f.radii.length-1;j++)for(let i=0;i<f.segments;i++) {
    for(const ids of [[[j,i],[j+1,i],[j+1,i+1]],[[j,i],[j+1,i+1],[j,i+1]]]) {
      const face=ids.map(([j,i])=>point(j,i,wall[j][i])),back=ids.map(([j,i])=>point(j,i,end));
      cells.push([...face,...back]);triangle(face,ids.map(([j,i])=>normal(j,i)));
      triangle(back,Array.from({length:3},()=>[side,0,0]));
    }
  }
  for(const [j,sign] of [[0,-1],[f.radii.length-1,1]])for(let i=0;i<f.segments;i++) {
    const radial=k=>{const a=k===f.segments?0:2*Math.PI*k/f.segments;return[0,sign*Math.cos(a),sign*Math.sin(a)];};
    quad([point(j,i,end),point(j,i,wall[j][i]),point(j,i+1,wall[j][i+1]),point(j,i+1,end)],[radial(i),radial(i),radial(i+1),radial(i+1)]);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();return{geometry,cells};
}
