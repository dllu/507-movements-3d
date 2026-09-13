import * as THREE from 'three';

const vec = values => values.map(x=>Number(x.toPrecision(12))).join(' ');
const determinant = (a,b,c,d) => new THREE.Vector3().subVectors(b,a)
  .dot(new THREE.Vector3().subVectors(c,a).cross(new THREE.Vector3().subVectors(d,a)));

/** A closed contact volume carried by existing beam bodies, with no extra DOFs. */
export function makeBeamSurface({name,points,frames,widths,depth,endNormal,contact}) {
  const count = frames.length, cumulative = [0];
  for (const frame of frames) cumulative.push(cumulative.at(-1)+frame.length);
  const last = frames.at(-1), axes = [new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)]
    .map(axis=>axis.applyQuaternion(last.quaternion));
  const slopes = [1,2].map(i=>-endNormal.dot(axes[i])/endNormal.dot(axes[0]));
  // The cut can reach behind the last element. Keep a cap span of fixed
  // physical length, rather than inverting a tiny terminal tetrahedron.
  const capLength = Math.abs(slopes[0])*widths.at(-1)/2 + Math.abs(slopes[1])*depth/2 + widths.at(-1)/2;
  const capStart = cumulative.at(-1)-capLength;
  if (!(capStart > 0)) throw new RangeError('Beam is too short for its end cut');
  const rings = cumulative.slice(0,-1).flatMap((s,i)=>s < capStart-1e-9 ? [{body:i,x:0,width:widths[i]}] : []);
  let capBody = count-1;
  while (cumulative[capBody] > capStart) capBody--;
  const fraction = (capStart-cumulative[capBody])/frames[capBody].length;
  rings.push({body:capBody,x:capStart-cumulative[capBody],width:widths[capBody]*(1-fraction)+widths[capBody+1]*fraction});
  rings.push({body:count-1,x:last.length,width:widths.at(-1),cut:true});
  const bodies = [], vertices = [], rest = [];
  for (const ring of rings) for (const [sy,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
    const y = sy*ring.width/2, z = sz*depth/2;
    const local = new THREE.Vector3(ring.x+(ring.cut ? slopes[0]*y+slopes[1]*z : 0),y,z);
    bodies.push(name+ring.body);vertices.push(...local.toArray());
    rest.push(local.clone().applyQuaternion(frames[ring.body].quaternion).add(points[ring.body]));
  }
  const tetrahedra = [], volumes = [], faces = new Map();
  for (let i = 0; i < rings.length-1; i++) for (const template of [[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6],[0,5,1,6]]) {
    const ids = template.map(j=>4*i+j);
    let volume = determinant(...ids.map(j=>rest[j]));
    if (volume < 0) { [ids[1],ids[2]] = [ids[2],ids[1]];volume = -volume; }
    if (!(volume > 1e-12)) throw new RangeError('Degenerate beam surface element');
    tetrahedra.push(ids);volumes.push(volume);
    for (let opposite = 0; opposite < 4; opposite++) {
      const face = ids.filter((_,j)=>j !== opposite), key = [...face].sort((a,b)=>a-b).join(',');
      if (faces.has(key)) {faces.delete(key);continue;}
      if (determinant(...face.map(j=>rest[j]),rest[ids[opposite]]) > 0) [face[1],face[2]] = [face[2],face[1]];
      faces.set(key,face);
    }
  }
  // Share normals along each long face, retaining sharp cross-section edges.
  const renderVertices = [], renderIndex = [], indices = new Map();
  for (const face of faces.values()) {
    const ringIds = face.map(i=>Math.floor(i/4));
    const surface = ringIds.every(i=>i===ringIds[0]) ? 'cap'+ringIds[0] : [...new Set(face.map(i=>i%4))].sort().join(',');
    for (const vertex of face) {
      const key = surface+':'+vertex;
      if (!indices.has(key)) {indices.set(key,renderVertices.length);renderVertices.push(vertex);}
      renderIndex.push(indices.get(key));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(renderVertices.flatMap(i=>rest[i].toArray()),3));
  geometry.setIndex(renderIndex);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const xml = `<flex name="${name}" dim="3" radius="0" body="${bodies.join(' ')}" vertex="${vec(vertices)}" element="${tetrahedra.flat().join(' ')}">
    <contact internal="false" selfcollide="none" contype="${contact.mask}" conaffinity="${contact.other | 1}"
      friction="${contact.friction} .001 .001" condim="3" margin=".00001" solref="${contact.time} 1"
      solimp="${contact.impedance} ${1-(1-contact.impedance)/10} .0001"/></flex>`;
  const positions = rest.map(p=>p.clone());
  let minimumVolumeRatio = 1;
  const update = (worldVertices,offset) => {
    positions.forEach((p,i)=>p.fromArray(worldVertices,3*(offset+i)));
    const attribute = geometry.attributes.position;
    renderVertices.forEach((j,i)=>attribute.setXYZ(i,positions[j].x,positions[j].y,positions[j].z));
    attribute.needsUpdate = true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
    minimumVolumeRatio = Math.min(...tetrahedra.map((ids,i)=>determinant(...ids.map(j=>positions[j]))/volumes[i]));
  };
  return {name,xml,geometry,update,vertices,bodies,tetrahedra,faces:[...faces.values()],renderVertexIds:renderVertices,capLength,
    get minimumVolumeRatio() {return minimumVolumeRatio;}};
}
