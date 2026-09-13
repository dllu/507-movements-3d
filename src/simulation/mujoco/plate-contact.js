import * as THREE from 'three';

const determinant = (a,b,c,d) => new THREE.Vector3().subVectors(b,a)
  .dot(new THREE.Vector3().subVectors(c,a).cross(new THREE.Vector3().subVectors(d,a)));

/** Preserve a finite extruded plate's concavities and holes in rigid contact. */
export function makeRigidPlateContact({name,body,geometry,contact}) {
  const p = geometry.attributes.position, index = geometry.index;
  let low = Infinity, high = -Infinity;
  for (let i = 0; i < p.count; i++) {low=Math.min(low,p.getZ(i));high=Math.max(high,p.getZ(i));}
  if (!(high > low)) throw new RangeError('Contact plate must have positive thickness');
  for (let i = 0; i < p.count; i++) if (p.getZ(i)!==low && p.getZ(i)!==high)
    throw new RangeError('Contact plate must be a straight extrusion along Z');
  const points = [], pointIds = new Map(), triangles = [];
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const ids = [0,1,2].map(j=>index ? index.getX(i+j) : i+j);
    if (!ids.every(j=>p.getZ(j)===high)) continue;
    triangles.push(ids.map(j=>{
      const xy = [p.getX(j),p.getY(j)], key = xy.join(',');
      if (!pointIds.has(key)) {pointIds.set(key,points.length);points.push(xy);}
      return pointIds.get(key);
    }));
  }
  if (!triangles.length) throw new RangeError('Contact plate has no cap triangles');
  const count = points.length, vertices = [low,high].flatMap(z=>points.map(xy=>new THREE.Vector3(...xy,z)));
  const tetrahedra = [], faces = new Map();
  let volume = 0;
  for (const triangle of triangles) {
    // Global vertex ordering gives neighboring prisms the same shared diagonal.
    const [a,b,c] = [...triangle].sort((x,y)=>x-y);
    for (const ids of [[a,b,c,c+count],[a,b,b+count,c+count],[a,a+count,b+count,c+count]]) {
      let v = determinant(...ids.map(j=>vertices[j]));
      if (v < 0) {[ids[1],ids[2]]=[ids[2],ids[1]];v=-v;}
      if (!(v > 1e-14)) throw new RangeError('Degenerate contact plate element');
      volume += v/6;tetrahedra.push(ids);
      for (let opposite = 0; opposite < 4; opposite++) {
        const face = ids.filter((_,j)=>j!==opposite), key = [...face].sort((x,y)=>x-y).join(',');
        if (faces.has(key)) {faces.delete(key);continue;}
        if (determinant(...face.map(j=>vertices[j]),vertices[ids[opposite]]) > 0) [face[1],face[2]]=[face[2],face[1]];
        faces.set(key,face);
      }
    }
  }
  const coordinates = vertices.flatMap(v=>v.toArray());
  const xml = `<flex name="${name}" dim="3" radius="0" body="${body}" vertex="${coordinates.join(' ')}" element="${tetrahedra.flat().join(' ')}">
    <contact internal="false" selfcollide="none" contype="${contact.mask}" conaffinity="${contact.other}"
      friction="${contact.friction} .001 .001" condim="3" margin=".00001" solref="${contact.time} 1"
      solimp="${contact.impedance} ${1-(1-contact.impedance)/10} .0001"/></flex>`;
  return {xml,vertices:coordinates,tetrahedra,faces:[...faces.values()],volume};
}
