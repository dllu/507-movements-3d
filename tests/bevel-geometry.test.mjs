import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { bevelToothGeometry } from '../src/simulation/bevel-geometry.js';

for (const [teeth, angle] of [[10, 0.1], [24, Math.PI / 4], [100, 1.47]]) {
  test(`${teeth}-tooth bevel at ${angle} has closed outward surfaces and conical heels/toes`, () => {
    const outerDistance = 1.08;
    const innerDistance = 0.76;
    const geometry = bevelToothGeometry({
      teeth, pitchConeAngle: angle, outerDistance, innerDistance, toothHeight: 0.14,
    });
    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    const vertices = Array.from({ length: positions.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(positions, i));
    const keys = vertices.map((p) => p.toArray().map((v) => Math.round(v * 1e6)).join(','));
    const edges = new Map();
    let volume = 0;
    const ix = geometry.index.array;
    for (let i = 0; i < ix.length; i += 3) {
      const triangle = [ix[i], ix[i + 1], ix[i + 2]];
      const [a, b, c] = triangle.map((index) => vertices[index]);
      assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).length() > 1e-12, 'no zero-area triangles');
      volume += a.dot(b.clone().cross(c)) / 6;
      for (let j = 0; j < 3; j += 1) {
        const first = keys[triangle[j]];
        const second = keys[triangle[(j + 1) % 3]];
        const key = [first, second].sort().join(':');
        const edge = edges.get(key) ?? { count: 0, direction: 0 };
        edge.count += 1;
        edge.direction += first < second ? 1 : -1;
        edges.set(key, edge);
      }
    }
    assert.ok(volume > 0);
    for (const edge of edges.values()) assert.deepEqual(edge, { count: 2, direction: 0 });

    const endCoordinates = vertices.map((p) => p.z + Math.hypot(p.x, p.y) * Math.tan(angle));
    const endValues = [innerDistance, outerDistance].map((d) => d / Math.cos(angle) ** 2);
    for (const coordinate of endCoordinates) {
      assert.ok(Math.min(...endValues.map((value) => Math.abs(value - coordinate))) < 1e-5,
        'every end vertex is on the corresponding cone normal to the pitch generator');
    }
    const outerVertices = vertices.filter((p, i) => Math.abs(endCoordinates[i] - endValues[1]) < 1e-5);
    assert.ok(Math.max(...outerVertices.map((p) => p.z)) - Math.min(...outerVertices.map((p) => p.z)) > 0.0001,
      'heel has axial relief instead of a flat end plane');
    let hardEdges = 0;
    for (let i = 0; i < keys.length; i += 1) {
      for (let j = i + 1; j < keys.length; j += 1) {
        if (keys[i] === keys[j]
          && new THREE.Vector3().fromBufferAttribute(normals, i).dot(new THREE.Vector3().fromBufferAttribute(normals, j)) < 0.8) hardEdges += 1;
      }
    }
    assert.ok(hardEdges > 0, 'cap and flank normals separate at machined edges');
    geometry.dispose();
  });
}

test('bevel cap normals follow the cone independently of cap triangulation',()=>{
 for(const angle of [.1,.8,1.47]){
  const g=bevelToothGeometry({teeth:36,innerDistance:.5,outerDistance:.7,pitchConeAngle:angle,toothHeight:.06}),p=g.attributes.position,n=g.attributes.normal,count=p.count/6;
  for(let i=0;i<2*count;i++){
   const point=new THREE.Vector3().fromBufferAttribute(p,i),normal=new THREE.Vector3().fromBufferAttribute(n,i),r=Math.hypot(point.x,point.y),radialTangent=new THREE.Vector3(point.x/r,point.y/r,-Math.tan(angle)).normalize(),circumferential=new THREE.Vector3(-point.y/r,point.x/r,0);
   assert.ok(Math.abs(normal.dot(radialTangent))<1e-6);assert.ok(Math.abs(normal.dot(circumferential))<1e-6);assert.ok(i<count?normal.z<0:normal.z>0);
  }
  g.dispose();
 }
});
