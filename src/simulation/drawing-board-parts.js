import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {circle, plate, poly, polygonClipping} from './finite-plate-geometry.js';
import {matte} from './primitives.js';

// Pass 57: the drawing instruments (403, 405, 406) trace their curves on a
// plain drawing board. Its top face is the drawing plane: the traced curve,
// the pencil point and the fixed pins' seats rest on it, and the pins stand in
// blind bores in it. `holes` are [x, y, radius] bores of depth `holeDepth`
// (the board stays solid below them, so nothing shows through from behind).
// The board is plain paper-coloured, sized to the pins and traced curves, and
// lies behind every moving part.
export function addDrawingBoard(root, {min, max, top, thickness = 0.14, holes = [], holeDepth = thickness / 2, role = 'fixed-drawing-board-under-pins-and-traced-curve', color = 0xe9e3d3}) {
  const outline = poly([[min[0], min[1]], [max[0], min[1]], [max[0], max[1]], [min[0], max[1]]]);
  const bored = holes.length ? polygonClipping.difference(outline, ...holes.map(([x, y, r]) => poly(circle([x, y], r, 64)))) : outline;
  const layers = [plate(bored, top - holeDepth, top), plate(outline, top - thickness, top - holeDepth)];
  for (const layer of layers) layer.deleteAttribute('uv');
  const board = new THREE.Mesh(mergeGeometries(layers), matte(color, {metalness: 0, roughness: 0.94}));
  board.userData.role = role;
  board.castShadow = false;board.receiveShadow = true;
  root.add(board);
  return board;
}
