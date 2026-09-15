import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Matrix4} from 'three';
import {triangleTree,meshPairDistance} from '../scripts/lib/star-mangle-pair-distance.mjs';
test('nearest-first traversal preserves exact separated and intersecting box distances',()=>{
 const a=new BoxGeometry(1,1,1,4,4,4),b=new BoxGeometry(1,1,1,5,5,5),at=triangleTree(a),bt=triangleTree(b);
 try{
  for(const offset of [1.001,1.2,2,4]){
   const result=meshPairDistance(at,bt,new Matrix4().makeTranslation(offset,0,0),10);
   assert.ok(Math.abs(result.distance-(offset-1))<1e-8);assert.ok(result.witness);
  }
  for(const angle of [.17,.53,1.1]){
   const transform=new Matrix4().makeTranslation(.7,.1,0).multiply(new Matrix4().makeRotationZ(angle));
   assert.equal(meshPairDistance(at,bt,transform,10).distance,0);
  }
 }finally{a.dispose();b.dispose();}
});
