import * as THREE from 'three';

// Store a single closed annular tooth sector. The generated radial field is
// periodic, so instances preserve its resolution without duplicating buffers.
export function makeInstancedWormWheel(parameters,cut,boreRadius,material){
 const n=cut.angularSteps,m=cut.axialSteps,pitch=2*Math.PI/parameters.teeth;
 const positions=[],indices=[],stride=n+1;
 const point=(r,a,z)=>[r*Math.cos(a),r*Math.sin(a),z];
 const angle=i=>-pitch/2+pitch*i/n;
 for(let j=0;j<=m;j++)for(let i=0;i<=n;i++)positions.push(...point(cut.radii[j*stride+i],angle(i),parameters.depth*(j/m-.5)));
 for(let j=0;j<m;j++)for(let i=0;i<n;i++){const a=j*stride+i;indices.push(a,a+1,a+stride+1,a,a+stride+1,a+stride);}
 for(const side of [-1,1]){
  const start=positions.length/3,row=side<0?0:m;
  for(let i=0;i<=n;i++)positions.push(...point(cut.radii[row*stride+i],angle(i),side*parameters.depth/2),...point(boreRadius,angle(i),side*parameters.depth/2));
  for(let i=0;i<n;i++){const a=start+2*i,tri=[a,a+2,a+3,a,a+3,a+1];indices.push(...(side<0?tri.reverse():tri));}
 }
 // The plain bore does not need the hob's dense axial grid. Split only its
 // two boundary edges to meet the radial end faces without T-junctions.
 for(let i=0;i<n;i++){
  const boundary=[],leftSteps=i===0?m:1,rightSteps=i===n-1?m:1;
  for(let j=0;j<=leftSteps;j++)boundary.push(point(boreRadius,angle(i),parameters.depth*(j/leftSteps-.5)));
  for(let j=0;j<=rightSteps;j++)boundary.push(point(boreRadius,angle(i+1),parameters.depth*(.5-j/rightSteps)));
  const start=positions.length/3,center=[0,0,0];for(const p of boundary)for(let k=0;k<3;k++)center[k]+=p[k]/boundary.length;
  positions.push(...center,...boundary.flat());
  for(let j=0;j<boundary.length;j++)indices.push(start,start+1+j,start+1+(j+1)%boundary.length);
 }
 // Radial faces close the individual sector; adjacent instances meet here.
 for(const side of [0,n]){
  const start=positions.length/3;
  for(let j=0;j<=m;j++){const z=parameters.depth*(j/m-.5);positions.push(...point(boreRadius,angle(side),z),...point(cut.radii[j*stride+side],angle(side),z));}
  for(let j=0;j<m;j++){const a=start+2*j,tri=[a,a+1,a+3,a,a+3,a+2];indices.push(...(side===n?tri.reverse():tri));}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const mesh=new THREE.InstancedMesh(geometry,material,parameters.teeth);
 for(let i=0;i<parameters.teeth;i++)mesh.setMatrixAt(i,new THREE.Matrix4().makeRotationZ(i*pitch));
 mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
 mesh.userData={teeth:parameters.teeth,angularSteps:n,axialSteps:m,boreRadius};return mesh;
}
