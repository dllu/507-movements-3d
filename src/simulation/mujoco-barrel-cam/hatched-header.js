import * as THREE from 'three';
import {matte,PALETTE} from '../primitives.js';

/** Presentation only for 106 and 107: Brown draws the fixed ceiling as a thin
 * beam section, hatched on its face with an inked lower edge, not as a solid
 * slab. Paint the header pale and add clipped 45-degree hatch strokes and the
 * lower edge line as children (not parts), so contact and solid audits of the
 * header itself are unchanged. `outline` is the convex header polygon [x, y].
 */
export function hatchHeader(header,outline,{front=.2,spacing=.075,stroke=.02}={}){
  header.material=matte(PALETTE.paper,{metalness:.02,roughness:.9});
  const ink=matte(PALETTE.ink,{metalness:.1,roughness:.6});
  const xs=outline.map(p=>p[0]),ys=outline.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  // Clip the line x - y = c against the convex outline.
  const clipLine=c=>{
    const hits=[];
    for(let i=0;i<outline.length;i++){
      const [ax,ay]=outline[i],[bx,by]=outline[(i+1)%outline.length];
      const fa=ax-ay-c,fb=bx-by-c;
      if(fa===0)hits.push([ax,ay]);
      if(fa*fb<0){const t=fa/(fa-fb);hits.push([ax+(bx-ax)*t,ay+(by-ay)*t]);}
    }
    return hits.length>=2?[hits[0],hits[hits.length-1]]:null;
  };
  const positions=[],indices=[],h=stroke/2/Math.SQRT2;
  for(let c=minX-maxY+spacing/2;c<maxX-minY;c+=spacing){
    const segment=clipLine(c);if(!segment)continue;
    const [[x0,y0],[x1,y1]]=segment[0][0]<segment[1][0]?segment:[segment[1],segment[0]],base=positions.length/3,z=front+.002;
    positions.push(x0-h,y0+h,z,x0+h,y0-h,z,x1+h,y1-h,z,x1-h,y1+h,z);
    indices.push(base,base+1,base+2,base,base+2,base+3);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const hatch=new THREE.Mesh(geometry,ink);hatch.name='header-section-hatching';hatch.userData.surfaceMarking=true;
  const edge=new THREE.Mesh(new THREE.BoxGeometry(maxX-minX,.02,2*front+.004),ink);
  edge.position.set((minX+maxX)/2,minY+.01,0);edge.name='header-lower-edge-line';
  header.add(hatch,edge);
  return header;
}
