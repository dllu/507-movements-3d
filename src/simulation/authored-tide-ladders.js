import * as THREE from 'three';
import { waterVolumeMaterial } from './water-volume.js';
import {
  PALETTE,
  makeDynamicLink,
  markShadows,
  matte,
} from './primitives.js';

import {foldingRod} from './folding-joint-parts.js';
import {fitPistonGuide} from './piston-guide-parts.js';

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function quinticState(parameter) {
  const u = THREE.MathUtils.clamp(parameter, 0, 1);
  return {
    acceleration: 60 * u * (1 - u) * (1 - 2 * u),
    rate: 30 * u ** 2 * (1 - u) ** 2,
    value: u ** 3 * (10 + u * (-15 + 6 * u)),
  };
}

function cylinderAlongZ(radius, length, material, segments = 28) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function makeEndFrame({
  capRadius,
  handrailHeight,
  material,
  pinMaterial,
  postDepthZ,
  postOffsetZ,
  postTopAbovePivot,
  postWidthX,
  railHalfWidth,
  role,
  whiteMaterial,
}) {
  const group = new THREE.Group();
  group.userData.role = role;
  const posts = [];
  const lowerPins = [];
  const upperPins = [];
  const caps = [];

  // postOffsetZ > 0 puts a post outboard of its rail, < 0 inboard. Each pivot
  // pin runs from the middle of the post through the rail's eye and ends just
  // past the rail, so it is carried by the post and nothing else.
  const railOuter = railHalfWidth + 0.085 + 0.02;
  for (const side of [-1, 1]) {
    const postZ = side * (railHalfWidth + postOffsetZ);
    const top = handrailHeight + postTopAbovePivot;
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(postWidthX, top, postDepthZ),
      material,
    );
    post.position.set(0, top / 2, postZ);
    post.userData.role = `${role}-vertical-post`;
    group.add(post);
    posts.push(post);

    const pinInner = postOffsetZ > 0 ? railHalfWidth - 0.24 : Math.abs(postZ);
    const pinOuter = postOffsetZ > 0 ? Math.abs(postZ) : railOuter;
    const pinLength = pinOuter - pinInner;
    const pinZ = side * (pinInner + pinOuter) / 2;
    const lowerPin = cylinderAlongZ(0.13, pinLength, pinMaterial);
    lowerPin.position.set(0, 0, pinZ);
    lowerPin.userData.role = `${role}-lower-stringer-pivot`;
    group.add(lowerPin);
    lowerPins.push(lowerPin);

    const upperPin = cylinderAlongZ(0.13, pinLength, pinMaterial);
    upperPin.position.set(0, handrailHeight, pinZ);
    upperPin.userData.role = `${role}-upper-handrail-pivot`;
    group.add(upperPin);
    upperPins.push(upperPin);

    // Brown's ball finial, seated a little into the post top.
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(capRadius, 24, 16),
      whiteMaterial,
    );
    cap.position.set(0, top + capRadius * 0.8, postZ);
    cap.userData.role = `${role}-white-post-cap`;
    group.add(cap);
    caps.push(cap);
  }

  group.userData.caps = caps;
  group.userData.lowerPins = lowerPins;
  group.userData.posts = posts;
  group.userData.upperPins = upperPins;
  return markShadows(group);
}

function makeTread({
  boardMaterial,
  pinMaterial,
  railHalfWidth,
  treadDepth,
  treadThickness,
  treadWidth,
  whiteMaterial,
  index,
}) {
  const group = new THREE.Group();
  group.userData.role = 'world-horizontal-pivoted-wharf-ladder-tread';
  group.userData.treadIndex = index;

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(treadDepth, treadThickness, treadWidth),
    boardMaterial,
  );
  board.position.set(-treadDepth / 2, 0, 0);
  board.userData.role = 'level-tread-board-pivoted-at-rear-edge';
  group.add(board);

  const rearAxle = cylinderAlongZ(
    0.085,
    railHalfWidth * 2 + 0.2,
    pinMaterial,
    24,
  );
  rearAxle.userData.role = 'tread-rear-edge-stringer-pivot-axle';
  group.add(rearAxle);

  // The front axle ends inboard of the stringers, which it would otherwise
  // cross at high tide when the tread lies level with them.
  const frontEdge = cylinderAlongZ(
    0.055,
    railHalfWidth * 2 - 0.24,
    pinMaterial,
    20,
  );
  frontEdge.position.x = -treadDepth;
  frontEdge.userData.role = 'tread-front-edge-suspension-axle';
  group.add(frontEdge);

  const levelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(treadDepth * 0.55, 0.025, 0.075),
    whiteMaterial,
  );
  levelIndex.position.set(-treadDepth * 0.50, treadThickness / 2 + 0.014, 0);
  levelIndex.userData.role = 'white-horizontal-tread-level-index';
  group.add(levelIndex);

  group.userData.board = board;
  group.userData.frontEdge = frontEdge;
  group.userData.levelIndex = levelIndex;
  group.userData.rearAxle = rearAxle;
  return markShadows(group);
}

function makeWharf({
  dockLower,
  handrailHeight,
  material,
  postDepthZ,
  postWidthX,
  railPlaneZ,
  capRadius,
  deckTopY,
  bedY,
  whiteMaterial,
}) {
  const group = new THREE.Group();
  group.position.copy(dockLower);
  group.userData.role = 'fixed-masonry-wharf-and-guard-rail';

  // One block of masonry, from the deck down to the river bed. Its face lies
  // under the front of the fixed posts, as Brown draws it, but between the
  // posts it is set back so the stringer ends swing clear of it.
  const faceX = -postWidthX / 2 - 0.03, recessX = 0.18, backX = 3.08;
  const recessHalfZ = railPlaneZ - postDepthZ / 2 - 0.01;
  const halfZ = railPlaneZ + postDepthZ / 2 + 0.3;
  const plan = new THREE.Shape([
    [faceX, -halfZ], [backX, -halfZ], [backX, halfZ], [faceX, halfZ],
    [faceX, recessHalfZ], [recessX, recessHalfZ], [recessX, -recessHalfZ],
    [faceX, -recessHalfZ],
  ].map(([x, z]) => new THREE.Vector2(x, z)));
  const wallHeight = deckTopY - bedY;
  const wallGeometry = new THREE.ExtrudeGeometry(plan, {
    bevelEnabled: false,
    depth: wallHeight,
  });
  // Shape (x, z) extruded along +w; map w to -y and z to z.
  wallGeometry.applyMatrix4(new THREE.Matrix4().set(
    1, 0, 0, 0,
    0, 0, -1, deckTopY,
    0, 1, 0, 0,
    0, 0, 0, 1,
  ));
  wallGeometry.computeVertexNormals();
  const wall = new THREE.Mesh(wallGeometry, material);
  wall.userData.role = 'fixed-wharf-wall';
  group.add(wall);

  // Brown's rail panel on each side: the fixed end-frame post (made by the
  // end frame), a far post with its ball, a top and a bottom rail framed
  // between the posts, and two crossed braces set half-lapped in the panel.
  // Every member is let into the posts, the rails or the deck.
  const farX = 2.35;
  const panelLeft = postWidthX / 2, panelRight = farX - postWidthX / 2;
  const postTop = handrailHeight + 0.16;
  const topRailTop = handrailHeight + 0.06, topRailBottom = handrailHeight - 0.26;
  const bottomRailBottom = deckTopY, bottomRailTop = deckTopY + 0.3;
  const railDepth = 0.12;
  for (const side of [-1, 1]) {
    const z = side * railPlaneZ;
    const farPost = new THREE.Mesh(
      new THREE.BoxGeometry(postWidthX, postTop - deckTopY + 0.02, postDepthZ),
      material,
    );
    farPost.position.set(farX, (postTop + deckTopY - 0.02) / 2, z);
    farPost.userData.role = 'fixed-wharf-outer-guard-post';
    group.add(farPost);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(capRadius, 24, 16), whiteMaterial);
    cap.position.set(farX, postTop + capRadius * 0.8, z);
    cap.userData.role = 'fixed-wharf-outer-post-white-cap';
    group.add(cap);

    for (const [role, bottom, top] of [
      ['fixed-wharf-horizontal-guard-rail', topRailBottom, topRailTop],
      ['fixed-wharf-bottom-rail', bottomRailBottom, bottomRailTop],
    ]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(panelRight - panelLeft + 0.04, top - bottom, railDepth),
        material,
      );
      rail.position.set((panelLeft + panelRight) / 2, (top + bottom) / 2, z);
      rail.userData.role = role;
      group.add(rail);
    }

    // Each brace runs corner to corner of the open panel and is let 0.02
    // into the post and rail at each end; the two braces sit either side of
    // the panel's mid-plane so they cross without cutting each other.
    const x0 = panelLeft, x1 = panelRight, y0 = bottomRailTop, y1 = topRailBottom;
    for (const [diagonalSign, lap] of [[1, 0.032], [-1, -0.032]]) {
      const start = new THREE.Vector2(x0, diagonalSign > 0 ? y1 : y0);
      const end = new THREE.Vector2(x1, diagonalSign > 0 ? y0 : y1);
      const width = 0.1;
      const length = start.distanceTo(end);
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      // Trim the brace so its square ends just meet the frame's inner faces.
      const brace = new THREE.Mesh(
        new THREE.BoxGeometry(length - width * 0.9, width, 0.058),
        material,
      );
      brace.position.set((start.x + end.x) / 2, (start.y + end.y) / 2, z + side * lap);
      brace.rotation.z = angle;
      brace.userData.role = 'fixed-wharf-cross-brace';
      group.add(brace);
    }
  }

  return markShadows(group);
}

// Open dinghy hull along x, bow at -x. The sections are U-shaped
// superellipses (half-width w, depth d below the sheer); forward they pinch
// to a point at the stem, aft they end in a flat transom (Brown's hatched
// square stern). The inner surface is one wall thickness in, and it ends a
// wall thickness forward of the transom's outer face.
function boatHullShape({bow, stern, beam, sheerY, sheerRise, sternRise, depth, wall, transomWidth, transomDepth}) {
  const center = (bow + stern) / 2, half = (stern - bow) / 2;
  // Aft of midships the width and depth fall only to the transom's size.
  const kw = (1 - transomWidth ** 2) ** 0.25, kd = Math.sqrt(1 - transomDepth ** 2);
  const halfWidth = (x, inner) => {
    const t = (x - center) / half, k = t > 0 ? kw : 1;
    return Math.max(0, beam * Math.sqrt(Math.max(0, 1 - (k * t) ** 4)) - (inner ? wall : 0));
  };
  const keelDepth = (x, inner) => {
    const t = (x - center) / half, k = t > 0 ? kd : 1;
    return Math.max(0, depth * Math.sqrt(Math.max(0, 1 - (k * t) ** 2)) - (inner ? wall : 0));
  };
  const sheer = (x) => {
    const t = (x - center) / half;
    return sheerY + (t < 0 ? sheerRise : sternRise) * t ** 6;
  };
  // Half-width of the inside of the hull at height y.
  const innerHalfWidthAt = (x, y) => {
    const w = halfWidth(x, true), d = keelDepth(x, true);
    const f = Math.min(1, Math.max(0, (sheer(x) - y) / d));
    return w * (1 - f ** 4) ** 0.25;
  };
  return {bow, stern, wall, halfWidth, keelDepth, sheer, innerHalfWidthAt};
}

function openBoatHullGeometry(shape, rows = 48, columns = 24) {
  const {bow, stern, wall, halfWidth, keelDepth, sheer} = shape;
  const section = (x, inner) => {
    const w = halfWidth(x, inner), d = keelDepth(x, inner), top = sheer(x);
    return Array.from({length: columns + 1}, (_, j) => {
      // Superellipse section (exponent 4): full-bodied sides, rounded bilge.
      const phi = Math.PI * j / columns, c = Math.cos(phi), s = Math.sin(phi);
      return new THREE.Vector3(x, top - d * Math.sqrt(s), w * Math.sign(c) * Math.sqrt(Math.abs(c)));
    });
  };
  const outer = Array.from({length: rows + 1}, (_, i) => section(bow + (stern - bow) * i / rows, false));
  const inner = Array.from({length: rows + 1}, (_, i) => section(bow + (stern - wall - bow) * i / rows, true));
  const positions = [];
  // Every triangle is wound to face the given direction (or, with none,
  // left as ordered).
  const tri = (a, b, c, facing) => {
    if (facing) {
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      if (n.dot(facing) < 0) [b, c] = [c, b];
    }
    for (const p of [a, b, c]) positions.push(p.x, p.y, p.z);
  };
  const quad = (a, b, c, d) => {tri(a, c, b); tri(a, d, c);};
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < columns; j++) {
      quad(outer[i][j], outer[i + 1][j], outer[i + 1][j + 1], outer[i][j + 1]);
      quad(inner[i][j], inner[i][j + 1], inner[i + 1][j + 1], inner[i + 1][j]);
    }
    for (const j of [0, columns]) {
      const [a, b, c, d] = [outer[i][j], outer[i + 1][j], inner[i + 1][j], inner[i][j]];
      if (j === 0) quad(a, d, c, b);else quad(a, b, c, d);
    }
  }
  // Transom: flat outer face at the stern, flat inner face a wall forward,
  // and its top edge between them.
  const fan = (ring, facing) => {
    const middle = ring.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / ring.length);
    for (let j = 0; j < ring.length; j++) tri(middle, ring[j], ring[(j + 1) % ring.length], facing);
  };
  fan(outer[rows], new THREE.Vector3(1, 0, 0));
  fan(inner[rows], new THREE.Vector3(-1, 0, 0));
  const up = new THREE.Vector3(0, 1, 0);
  tri(outer[rows][0], outer[rows][columns], inner[rows][columns], up);
  tri(outer[rows][0], inner[rows][columns], inner[rows][0], up);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function makeFloatAssembly({
  endFrame,
  floatMaterial,
  railHalfWidth,
}) {
  const group = new THREE.Group();
  group.userData.role = 'tide-following-floating-end-assembly';
  group.add(endFrame);

  // Brown's small open dinghy: a raised pointed bow, a flat transom stern,
  // and the floating posts stepped on a thwart a little forward of
  // midships (about 42% of the boat from its bow). Pass 67: the posts
  // stand inboard of the rails and the boat hangs low under the stringers,
  // so it is 2.1 long and about 1.1 broad, near Brown's size beside the
  // ladder.
  const posts = endFrame.userData.posts;
  const bow = -0.88, stern = 1.22, wall = 0.05, sheerY = -0.42, depth = 0.5;
  const center = (bow + stern) / 2, half = (stern - bow) / 2;
  // As Brown draws it, the boat lies well below the stringers' ends, so its
  // beam need only take the posts; the thwart at the widest station reaches
  // a little past them.
  const postOuterZ = Math.max(...posts.map((post) => Math.abs(post.position.z) + 0.09));
  const thwartS = Math.max(Math.abs(0.12 - center), Math.abs(-0.12 - center)) / half;
  const beam = (postOuterZ + 0.1 + wall) / Math.sqrt(1 - thwartS ** 4);
  const shape = boatHullShape({
    bow, stern, beam, sheerY, sheerRise: 0.3, sternRise: 0.04, depth, wall,
    transomWidth: 0.62, transomDepth: 0.55,
  });
  const hull = new THREE.Mesh(openBoatHullGeometry(shape), floatMaterial);
  hull.userData.role = 'floating-open-boat-hull';
  group.add(hull);
  // The thwart spans between the inner walls just below the post feet.
  const thwartTop = -0.5, thwartBottom = -0.56;
  const thwartHalf = Math.min(shape.innerHalfWidthAt(-0.12, thwartBottom), shape.innerHalfWidthAt(0.12, thwartBottom)) - 0.004;
  const thwart = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, thwartTop - thwartBottom, thwartHalf * 2),
    floatMaterial,
  );
  thwart.position.set(0, (thwartTop + thwartBottom) / 2, 0);
  thwart.userData.role = 'boat-thwart-carrying-end-frame-posts';
  group.add(thwart);
  for (const post of posts) {
    const box = new THREE.Box3().setFromBufferAttribute(post.geometry.attributes.position);
    const top = post.position.y + box.max.y, bottom = thwartTop;
    post.geometry.dispose();
    post.geometry = new THREE.BoxGeometry(box.max.x - box.min.x, top - bottom, box.max.z - box.min.z);
    post.position.y = (top + bottom) / 2;
  }
  group.userData.hullShape = shape;

  return markShadows(group);
}

function selfAdjustingWharfLadder(movement) {
  const root = new THREE.Group();

  // Keveney's official schematic supplies a 17-unit stringer, an 8-unit
  // vertical handrail offset, seven treads at 17/7 spacing, and a tide
  // slider whose effective level moves from 0 to -6.  Only their common
  // scale is changed here.
  const sourceLadderLength = 17;
  const sourceHandrailHeight = 8;
  const sourceMaximumTideDrop = 6;
  const sourceStepSpacing = sourceLadderLength / 7;
  const sourceScale = 0.32;
  const ladderLength = sourceLadderLength * sourceScale;
  const handrailHeight = sourceHandrailHeight * sourceScale;
  const maximumTideDrop = sourceMaximumTideDrop * sourceScale;
  const treadCount = 7;
  const treadSpacing = sourceStepSpacing * sourceScale;
  // Shallow enough that the last tread's front axle and rods clear the
  // floating frame's lower pivot.
  const treadDepth = 1.6 * sourceScale;
  const treadThickness = 0.105;
  // Pass 67: a narrower ladder (the side view does not fix its width), so
  // the boat that carries its floating end can keep a dinghy's proportions.
  const railHalfWidth = 0.46;
  // The suspension rods hang this far inboard of the rails, and the treads
  // are narrower still so the rods hang clear of the boards.
  const rodInset = 0.17;
  const treadWidth = (railHalfWidth - rodInset - 0.035 - 0.02) * 2;
  const supportRodLength = Math.hypot(handrailHeight, treadDepth);
  const dockLower = new THREE.Vector3(2.72, 1.58, 0);
  const cycleDuration = 10;
  const descendingEndPhase = 0.40;
  const lowDwellEndPhase = 0.50;
  const ascendingEndPhase = 0.90;

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.10,
    roughness: 0.68,
  });
  const boardMaterial = matte(PALETTE.brass, {
    metalness: 0.07,
    roughness: 0.66,
  });
  const pinMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.46,
  });
  const floatMaterial = matte(PALETTE.driven, {
    metalness: 0.06,
    roughness: 0.64,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0,
    roughness: 0.44,
  });

  // Brown's wharf posts are stout (about 0.35 square at this scale) with
  // ball finials; the floating posts are lighter.
  const wharfPostWidth = 0.34;
  const wharfPostOffset = 0.28;
  const deckTopY = -0.15;
  const tideBedY = -1.4;
  const wharf = makeWharf({
    bedY: tideBedY - dockLower.y,
    capRadius: 0.15,
    deckTopY,
    dockLower,
    handrailHeight,
    material: frameMaterial,
    postDepthZ: wharfPostWidth,
    postWidthX: wharfPostWidth,
    railPlaneZ: railHalfWidth + wharfPostOffset,
    whiteMaterial,
  });
  root.add(wharf);

  const fixedEndFrame = makeEndFrame({
    capRadius: 0.15,
    handrailHeight,
    material: frameMaterial,
    pinMaterial,
    postDepthZ: wharfPostWidth,
    postOffsetZ: wharfPostOffset,
    postTopAbovePivot: 0.16,
    postWidthX: wharfPostWidth,
    railHalfWidth,
    role: 'fixed-wharf-end-frame',
    whiteMaterial,
  });
  fixedEndFrame.position.copy(dockLower);
  // The fixed posts stand on the wharf deck.
  for (const post of fixedEndFrame.userData.posts) {
    const top = post.position.y * 2;
    post.geometry.dispose();
    post.geometry = new THREE.BoxGeometry(wharfPostWidth, top - deckTopY + 0.02, wharfPostWidth);
    post.position.y = (top + deckTopY - 0.02) / 2;
  }
  root.add(fixedEndFrame);

  // The floating posts stand in the plane of the suspension rods, inboard of
  // the rails; the last tread's rods stop short of them at every tide.
  const floatingEndFrame = makeEndFrame({
    capRadius: 0.12,
    handrailHeight,
    material: floatMaterial,
    pinMaterial,
    postDepthZ: 0.16,
    postOffsetZ: -rodInset,
    postTopAbovePivot: 0.16,
    postWidthX: 0.24,
    railHalfWidth,
    role: 'floating-vertical-end-frame',
    whiteMaterial,
  });
  const floatAssembly = makeFloatAssembly({
    endFrame: floatingEndFrame,
    floatMaterial,
    railHalfWidth,
  });
  root.add(floatAssembly);

  // The tide is a body of water from its surface (the mesh origin, which
  // follows the level) down to the bed at the wharf foot, not a thin sheet.
  const water = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 1, railHalfWidth * 2 + 2.8).translate(0, -0.5, 0),
    waterVolumeMaterial(),
  );
  water.renderOrder = 1;
  // It runs into the slot between the wharf posts.
  water.position.x = dockLower.x + 0.18 - 3.6;
  water.userData.role = 'moving-tide-water-level-reference';
  water.castShadow = false;
  water.receiveShadow = true;
  root.add(water);

  const lowerStringers = [];
  const upperHandrails = [];
  const railIndexes = [];
  for (const side of [-1, 1]) {
    const lowerStringer = foldingRod({length: ladderLength, width: .20,
      depth: .17, bore: .134, material: matte(PALETTE.driver),
      role: 'rigid-lower-ladder-stringer', planeZ: 0});
    lowerStringer.userData.role = 'rigid-lower-ladder-stringer';
    lowerStringer.userData.side = side;
    root.add(lowerStringer);
    lowerStringers.push(lowerStringer);
    for (let i = 1; i < treadCount; i++) lowerStringer.userData.addPinEye(i * treadSpacing, .089);

    const upperHandrail = foldingRod({length: ladderLength, width: .16,
      depth: .15, bore: .134, material: matte(PALETTE.driven),
      role: 'parallel-upper-handrail-bar', planeZ: 0});
    upperHandrail.userData.role = 'parallel-upper-handrail-bar';
    upperHandrail.userData.side = side;
    root.add(upperHandrail);
    upperHandrails.push(upperHandrail);
    for (let i = 1; i < treadCount; i++) upperHandrail.userData.addPinEye(i * treadSpacing, .059);
    // Tread 0 hangs from the fixed frame's own upper pivot pin, so the
    // handrail carries pins only at the intermediate treads.
    for (let i = 1; i < treadCount; i++) {
      // From just inboard of the rod to just outboard of the handrail.
      const pinInner = railHalfWidth - rodInset - 0.065, pinOuter = railHalfWidth + 0.105;
      const pin = cylinderAlongZ(.055, pinOuter - pinInner, pinMaterial);
      pin.position.set(i * treadSpacing, 0, -side * (railHalfWidth - (pinInner + pinOuter) / 2));
      pin.userData.role = 'upper-suspension-pivot-pin';
      upperHandrail.add(pin);
    }

    const railIndex = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 18, 12),
      whiteMaterial,
    );
    railIndex.userData.role = 'white-equal-rail-midpoint-index';
    railIndex.userData.side = side;
    root.add(railIndex);
    railIndexes.push(railIndex);
  }

  const treads = [];
  const suspensionRods = [];
  for (let index = 0; index < treadCount; index += 1) {
    const tread = makeTread({
      boardMaterial,
      index,
      pinMaterial,
      railHalfWidth,
      treadDepth,
      treadThickness,
      treadWidth,
      whiteMaterial,
    });
    root.add(tread);
    treads.push(tread);

    const rodsForTread = [];
    for (const side of [-1, 1]) {
      const rod = foldingRod({length: supportRodLength, width: .07,
        depth: .07, bore: .059, material: pinMaterial,
        role: 'constant-length-tread-suspension-rod', planeZ: -side * rodInset});
      rod.userData.role = 'constant-length-tread-suspension-rod';
      rod.userData.side = side;
      rod.userData.treadIndex = index;
      if (index === 0) {
        // Main handrail pivot is larger than intermediate suspension pins.
        rod.userData.addPinEye(0, .134, .169);
      }
      root.add(rod);
      rodsForTread.push(rod);
    }
    suspensionRods.push(rodsForTread);
  }

  const descendingDuration = descendingEndPhase * cycleDuration;
  const ascendingDuration = (
    ascendingEndPhase - lowDwellEndPhase
  ) * cycleDuration;

  const scheduleAtTime = (time) => {
    const wrappedTime = positiveModulo(time, cycleDuration);
    const phase = wrappedTime / cycleDuration;
    if (phase < descendingEndPhase) {
      const smooth = quinticState(phase / descendingEndPhase);
      return {
        acceleration: smooth.acceleration / descendingDuration ** 2,
        fraction: smooth.value,
        rate: smooth.rate / descendingDuration,
        stage: 'tide-falling-ladder-descending',
      };
    }
    if (phase < lowDwellEndPhase) {
      return {
        acceleration: 0,
        fraction: 1,
        rate: 0,
        stage: 'low-tide-dwell',
      };
    }
    if (phase < ascendingEndPhase) {
      const local = (
        phase - lowDwellEndPhase
      ) / (ascendingEndPhase - lowDwellEndPhase);
      const smooth = quinticState(local);
      return {
        acceleration: -smooth.acceleration / ascendingDuration ** 2,
        fraction: 1 - smooth.value,
        rate: -smooth.rate / ascendingDuration,
        stage: 'tide-rising-ladder-ascending',
      };
    }
    return {
      acceleration: 0,
      fraction: 0,
      rate: 0,
      stage: 'high-tide-dwell',
    };
  };

  const stateAtTime = (time) => {
    const schedule = scheduleAtTime(time);
    const tideDrop = maximumTideDrop * schedule.fraction;
    const tideDropRate = maximumTideDrop * schedule.rate;
    const tideDropAcceleration = maximumTideDrop
      * schedule.acceleration;
    const horizontalSpan = Math.sqrt(
      ladderLength ** 2 - tideDrop ** 2,
    );
    const horizontalSpanRate = -tideDrop * tideDropRate
      / horizontalSpan;
    const floatLower = new THREE.Vector3(
      dockLower.x - horizontalSpan,
      dockLower.y - tideDrop,
      0,
    );
    const floatVelocity = new THREE.Vector3(
      -horizontalSpanRate,
      -tideDropRate,
      0,
    );
    const floatHorizontalAcceleration = (
      (tideDropRate ** 2 + tideDrop * tideDropAcceleration)
        / horizontalSpan
      + tideDrop ** 2 * tideDropRate ** 2
        / horizontalSpan ** 3
    );
    const floatAcceleration = new THREE.Vector3(
      floatHorizontalAcceleration,
      -tideDropAcceleration,
      0,
    );
    const ladderInclination = Math.asin(tideDrop / ladderLength);
    const ladderAngularSpeed = tideDropRate / horizontalSpan;
    const ladderAngularAcceleration = tideDropAcceleration
      / horizontalSpan
      + tideDrop * tideDropRate ** 2 / horizontalSpan ** 3;
    const dockUpper = dockLower.clone().add(
      new THREE.Vector3(0, handrailHeight, 0),
    );
    const floatUpper = floatLower.clone().add(
      new THREE.Vector3(0, handrailHeight, 0),
    );
    const stepStates = [];
    for (let index = 0; index < treadCount; index += 1) {
      const stringerFraction = index / treadCount;
      const rearEdgeCenter = dockLower.clone().lerp(
        floatLower,
        stringerFraction,
      );
      const frontEdgeCenter = rearEdgeCenter.clone().add(
        new THREE.Vector3(-treadDepth, 0, 0),
      );
      const upperSupportCenter = rearEdgeCenter.clone().add(
        new THREE.Vector3(0, handrailHeight, 0),
      );
      const rearEdgeVelocity = floatVelocity.clone()
        .multiplyScalar(stringerFraction);
      const supports = [-1, 1].map((side) => {
        const upper = upperSupportCenter.clone();
        upper.z = side * railHalfWidth;
        const lower = frontEdgeCenter.clone();
        lower.z = side * railHalfWidth;
        return {
          length: upper.distanceTo(lower),
          lower,
          side,
          upper,
        };
      });
      stepStates.push({
        frontEdgeCenter,
        index,
        pitchAngle: 0,
        rearEdgeCenter,
        rearEdgeVelocity,
        stringerDistance: stringerFraction * ladderLength,
        stringerFraction,
        supports,
        upperSupportCenter,
      });
    }
    return {
      dockLower: dockLower.clone(),
      dockUpper,
      floatAcceleration,
      floatLower,
      floatUpper,
      floatVelocity,
      horizontalSpan,
      horizontalSpanRate,
      ladderAngularAcceleration,
      ladderAngularSpeed,
      ladderInclination,
      stage: schedule.stage,
      stepStates,
      tideDrop,
      tideDropAcceleration,
      tideDropRate,
      tideFraction: schedule.fraction,
      waterLevel: floatLower.y - 0.78,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    floatAssembly.position.copy(state.floatLower);
    water.position.y = state.waterLevel;
    water.scale.y = Math.max(0.001, state.waterLevel - tideBedY);

    for (let index = 0; index < 2; index += 1) {
      const side = index === 0 ? -1 : 1;
      const dockLowerSide = state.dockLower.clone();
      const floatLowerSide = state.floatLower.clone();
      const dockUpperSide = state.dockUpper.clone();
      const floatUpperSide = state.floatUpper.clone();
      dockLowerSide.z = side * railHalfWidth;
      floatLowerSide.z = side * railHalfWidth;
      dockUpperSide.z = side * railHalfWidth;
      floatUpperSide.z = side * railHalfWidth;
      lowerStringers[index].userData.setEndpoints(
        dockLowerSide,
        floatLowerSide,
      );
      upperHandrails[index].userData.setEndpoints(
        dockUpperSide,
        floatUpperSide,
      );
      lowerStringers[index].userData.endpoints = {
        end: floatLowerSide.clone(),
        start: dockLowerSide.clone(),
      };
      upperHandrails[index].userData.endpoints = {
        end: floatUpperSide.clone(),
        start: dockUpperSide.clone(),
      };
      railIndexes[index].position.copy(dockUpperSide)
        .add(floatUpperSide).multiplyScalar(0.5);
    }

    for (let index = 0; index < treadCount; index += 1) {
      const stepState = state.stepStates[index];
      treads[index].position.copy(stepState.rearEdgeCenter);
      treads[index].rotation.set(0, 0, 0);
      treads[index].userData.pitchAngle = 0;
      treads[index].userData.rearEdgeVelocity =
        stepState.rearEdgeVelocity.clone();
      for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
        const support = stepState.supports[sideIndex];
        suspensionRods[index][sideIndex].userData.setEndpoints(
          support.upper,
          support.lower,
        );
        suspensionRods[index][sideIndex].userData.endpoints = {
          end: support.lower.clone(),
          start: support.upper.clone(),
        };
      }
    }

    root.userData.contacts = {
      railPivots: {
        lowerLengthResidual: state.dockLower.distanceTo(
          state.floatLower,
        ) - ladderLength,
        upperLengthResidual: state.dockUpper.distanceTo(
          state.floatUpper,
        ) - ladderLength,
      },
      treadSupports: state.stepStates.map((stepState) => ({
        pitchError: stepState.pitchAngle,
        rodLengthResiduals: stepState.supports.map(
          (support) => support.length - supportRodLength,
        ),
        treadIndex: stepState.index,
      })),
    };
    root.userData.kinematics = state;
  };

  const highState = stateAtTime(0);
  const lowState = stateAtTime(descendingEndPhase * cycleDuration);
  root.userData = {
    archetype:
      'tide-float-parallelogram-stringers-suspended-horizontal-tread-ladder',
    blocks: {
      fixedEndFrame,
      fixedLowerPins: fixedEndFrame.userData.lowerPins,
      fixedUpperPins: fixedEndFrame.userData.upperPins,
      floatAssembly,
      floatingEndFrame,
      floatingLowerPins: floatingEndFrame.userData.lowerPins,
      floatingUpperPins: floatingEndFrame.userData.upperPins,
      lowerStringers,
      railIndexes,
      suspensionRods,
      treads,
      upperHandrails,
      water,
      wharf,
    },
    constraintResiduals: {
      highLowerRailLength: highState.dockLower.distanceTo(
        highState.floatLower,
      ) - ladderLength,
      highUpperRailLength: highState.dockUpper.distanceTo(
        highState.floatUpper,
      ) - ladderLength,
      lowCircleClosure: lowState.horizontalSpan ** 2
        + lowState.tideDrop ** 2 - ladderLength ** 2,
      lowLowerRailLength: lowState.dockLower.distanceTo(
        lowState.floatLower,
      ) - ladderLength,
      lowUpperRailLength: lowState.dockUpper.distanceTo(
        lowState.floatUpper,
      ) - ladderLength,
      supportRodLength: lowState.stepStates[3].supports[0].length
        - supportRodLength,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      inputs: [
        'vertical tide displacement of the floating ladder end',
      ],
      note:
        'the rigid stringers determine horizontal float drift; equal translated handrails form a parallelogram, and each suspended tread consequently has zero pitch',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'the wharf pivots are fixed and the floating end frame remains vertical',
        'both lower stringers and both upper handrails are rigid and equal',
        'the tide is a prescribed vertical input while the float drifts freely to satisfy the rigid-stringer circle constraint',
        'all pivots are frictionless and the seven treads, rods, float, and rails are massless for kinematic demonstration',
        'absolute scale, board width and thickness, float and wharf construction, duration, easing, colors, and camera are reconstruction decisions',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsMassesBuoyancyOrForces:
        false,
      treatment:
        'exact one-degree-of-freedom tide-driven parallelogram ladder with analytically level suspended treads',
    },
    fidelity: 'authored',
    geometry: {
      dockLower: dockLower.clone(),
      handrailHeight,
      ladderLength,
      maximumTideDrop,
      railHalfWidth,
      sourceHandrailHeight,
      sourceLadderLength,
      sourceMaximumTideDrop,
      sourceScale,
      sourceStepSpacing,
      supportRodLength,
      treadCount,
      treadDepth,
      treadSpacing,
      treadThickness,
      treadWidth,
    },
    mechanism:
      'tide-driven-floating-end-two-rigid-stringers-parallel-handrails-seven-pivoted-and-rod-suspended-self-leveling-treads',
    sourceAnimation: {
      available: true,
      normalizedEventPhases: [
        0,
        descendingEndPhase,
        lowDwellEndPhase,
        ascendingEndPhase,
        1,
      ],
      officialCanvasModelPresent: true,
      sourceEffectiveTideLevels: [0, -6],
      sourceHandrailOffset: 8,
      sourceLadderLength: 17,
      sourcePrescribedAbsoluteTiming: false,
      sourceSliderLocalSegment: [[-20, 3], [-15, 3]],
      sourceSliderTranslations: [[-0.5, -9], [-0.5, -3]],
      sourceStepStations: [
        0,
        -2.428571,
        -4.857143,
        -7.285714,
        -9.714286,
        -12.142857,
        -14.571429,
      ],
      sourceViewBox: [-20, -14, 28, 28],
    },
    sourceReference: {
      brownPlate387: {
        highTideLowerPivotCentersPixels: {
          floating: [66, 191],
          wharf: [340, 198],
        },
        highTideUpperPivotCentersPixels: {
          floating: [66, 68],
          wharf: [340, 69],
        },
        imageHeight: 525,
        imageWidth: 525,
        lowTideLowerPivotCentersPixels: {
          floating: [89, 480],
          wharf: [339, 415],
        },
        lowTideUpperPivotCentersPixels: {
          floating: [89, 387],
          wharf: [338, 328],
        },
        measurementUncertaintyPixels: 12,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the ladder serves wharfs subject to rise and fall of tide',
          'each tread is pivoted at one edge into the wooden string pieces',
          'the other tread edge is supported by rods suspended from the handrail bars',
          'the treads remain horizontal at every ladder position',
        ],
        officialAnimationEvidence:
          'the official canvas defines a 17-unit circular connecting rod, an 8-unit upper-rail offset, seven stations at 17/7 spacing, effective tide levels 0 and -6, and normalized phase boundaries 0, 0.4, 0.5, and 0.9',
        reconstructionDisclosure:
          'the source ratios and seven stations are retained; twin 3D rails, tread width, pontoon, wharf, absolute scale and duration, quintic easing, materials, water plane, and camera are independently engineered rather than copied from the proprietary canvas',
      },
      officialPage: movement.sourceUrl,
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      cycleDuration,
      demonstrationPeriod: cycleDuration,
      events: {
        ascendingStarts: lowDwellEndPhase * cycleDuration,
        descendingStarts: 0,
        highDwellStarts: ascendingEndPhase * cycleDuration,
        lowDwellStarts: descendingEndPhase * cycleDuration,
      },
      normalizedEventPhases: [
        0,
        descendingEndPhase,
        lowDwellEndPhase,
        ascendingEndPhase,
        1,
      ],
      note:
        'official phase proportions are retained while quintic easing gives zero velocity and acceleration at all motion/dwell boundaries',
    },
    transmission: {
      endFrameLaw:
        'floatUpper=floatLower+(0,H,0) and dockUpper=dockLower+(0,H,0), so the upper and lower rails are equal translated links',
      floatCircleLaw:
        'horizontalSpan^2+tideDrop^2=ladderLength^2',
      supportLaw:
        'each support joins rearPivot+(0,H) to rearPivot+(-treadDepth,0), giving constant length sqrt(H^2+treadDepth^2)',
      treadLevelLaw:
        'every rigid tread is translated to its lower-stringer pivot without rotation, so pitch=0 independently of ladder inclination',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.72, -1.18, -2.12),
    new THREE.Vector3(5.78, 4.46, 2.12),
  );
  fitPistonGuide(root, update, cycleDuration);
  root.userData.groundFloorY = tideBedY;
  markShadows(root);
  water.castShadow = false;
  water.receiveShadow = true;
  return {
    cameraDirection: new THREE.Vector3(0.3, 0.25, 12),
    root,
    update,
  };
}

export function createAuthoredTideLadderMovement(movement) {
  if (movement.id !== 387) return null;
  const model = selfAdjustingWharfLadder(movement);
  // Brown's two figures show the one ladder at high and at low water; the
  // single model is animated through both (pass 67), so it is not drawn
  // twice. Brown draws no white rail or tread indices.
  const whiteIndices = [];
  model.root.traverse((object) => {
    if (/^white-/.test(object.userData.role ?? '')) whiteIndices.push(object);
  });
  for (const object of whiteIndices) object.parent.remove(object);
  fitPistonGuide(model.root, model.update, 10);
  return model;
}
