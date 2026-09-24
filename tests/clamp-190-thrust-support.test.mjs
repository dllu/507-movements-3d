import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredClampMovement} from '../src/simulation/authored-clamps.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';

test('190: finite collar supports both cheek edges without penetration and supplies the closing moment',()=>{
  const model=createAuthoredClampMovement({id:190}),u=model.root.userData,b=u.blocks,g=u.geometry;
  try {
    const collar=solidSurface(b.thrustCollar.geometry),collarPoints=surfacePoints(b.thrustCollar.geometry);
    const index=b.screwRotor.children.find(object=>object.userData.role==='white-index-on-rotating-thrust-collar');
    const indexPoints=surfacePoints(index.geometry);
    const cheeks=b.holderCheeks.map(mesh=>({mesh,surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)}));
    let oldLawPenetration=0;
    for(let frame=0;frame<=64;frame++) {
      model.update(frame*g.cyclePeriod/64);model.root.updateMatrixWorld(true);
      const state=u.state,collarInverse=b.thrustCollar.matrixWorld.clone().invert();
      let moment=0,vertical=0,depth=0;
      for(let side=0;side<2;side++) {
        const contact=state.thrustContacts[side],{mesh,surface,points}=cheeks[side],inverse=mesh.matrixWorld.clone().invert();
        const onCheek=contact.point.clone().applyMatrix4(inverse),onCollar=contact.point.clone().applyMatrix4(collarInverse);
        assert.ok(surface.distance(onCheek)<1e-7,'actual straight bearing land reaches the contact');
        assert.ok(collar.distance(onCollar)<6e-6,'finite collar reaches the same contact, within polygon sagitta');
        assert.ok(contact.normal.y>.94,'substantial upward bearing reaction');
        const localNormal=contact.normal.clone().applyAxisAngle(new THREE.Vector3(0,0,1),-state.holderAngle);
        assert.ok(Math.abs(localNormal.x)<1e-14&&localNormal.y>0,'normal belongs to the cheek bottom/inner-edge normal cone');
        assert.ok(Math.abs(contact.normal.x*contact.point.z-contact.normal.z*g.collarContactOffsetX)<1e-14,
          'same normal belongs to the collar radial/top-edge normal cone');
        const arm=contact.point.clone().sub(new THREE.Vector3(g.holderPivot.x,g.holderPivot.y,0));
        const torque=arm.cross(contact.normal).z;
        assert.ok(torque>1.7,'bearing reaction turns the holder toward the work');
        moment+=torque;vertical+=contact.normal.y;depth+=contact.normal.z;
        for(const [from,samples]of[[b.thrustCollar,collarPoints],[index,indexPoints]]) {
          const matrix=inverse.clone().multiply(from.matrixWorld);
          for(const point of samples){const p=point.clone().applyMatrix4(matrix);assert.ok(!surface.inside(p)||surface.distance(p)<2e-7,'collar/index clears the entire finite cheek');}
        }
        const matrix=collarInverse.clone().multiply(mesh.matrixWorld);
        for(const point of points){const p=point.clone().applyMatrix4(matrix);assert.ok(!collar.inside(p)||collar.distance(p)<2e-7,'cheek clears collar solid');}
        // Restore the former axis-only travel with the new real bearing land:
        // it advances too high by offset * -tan(angle) during opening.
        const wrongCenter=new THREE.Vector3(g.screwAxisX,state.screwOriginY-g.collarContactOffsetX*Math.tan(state.holderAngle),0);
        for(const point of collarPoints){const p=point.clone().applyAxisAngle(new THREE.Vector3(0,1,0),state.screwAngle).add(wrongCenter).applyMatrix4(inverse);
          if(surface.inside(p))oldLawPenetration=Math.max(oldLawPenetration,surface.distance(p));}
      }
      assert.ok(Math.abs(depth)<1e-14,'opposed cheek reactions cancel transverse force');
      const workArm=g.holderPivot.x-state.shoeContactPoint.x;
      assert.ok(Math.abs(moment/vertical/workArm-state.leverForceRatio)<1e-13,'force ratio follows finite contact moment');
    }
    assert.ok(oldLawPenetration>.004,'restoring the point-contact law demonstrably penetrates the holder');
  } finally {disposeObject3D(model.root);}
});
