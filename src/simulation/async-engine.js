import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PALETTE } from './primitives.js';
import { loadMovementModel } from './model-loader.js';
import { disposeMovementModel, disposeObject3D } from './dispose-model.js';

const CAMERA_FIT_MARGIN = 1.08;
const GROUND_CLEARANCE = 0.14;

export function groundFloorFor(model, bounds) {
  const { groundFloorY, sampledFloorY } = model.root.userData;
  return Math.min(
    bounds.min.y - GROUND_CLEARANCE,
    Number.isFinite(sampledFloorY) ? sampledFloorY - GROUND_CLEARANCE : Infinity,
    Number.isFinite(groundFloorY) ? groundFloorY : Infinity,
  );
}

/**
 * Return the shortest camera distance that contains every corner of a box.
 *
 * The old radius multiplier only approximated perspective framing. Tall or
 * wide mechanisms could consequently cross a frustum edge even though their
 * bounding sphere looked reasonable. Projecting all eight corners onto the
 * camera's horizontal and vertical axes gives an exact perspective fit for
 * the authored view direction.
 */
export function perspectiveBoxFitDistance(
  bounds,
  direction,
  verticalFieldOfView,
  aspect,
  margin = CAMERA_FIT_MARGIN,
) {
  const cameraAxis = direction.clone().normalize();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(worldUp, cameraAxis);
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  else right.normalize();
  const viewUp = new THREE.Vector3().crossVectors(cameraAxis, right).normalize();
  const center = bounds.getCenter(new THREE.Vector3());
  const verticalTangent = Math.tan(THREE.MathUtils.degToRad(verticalFieldOfView * 0.5));
  const horizontalTangent = verticalTangent * Math.max(aspect, 0.01);
  let requiredDistance = 0;

  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const offset = new THREE.Vector3(x, y, z).sub(center);
        const depthTowardCamera = offset.dot(cameraAxis);
        const horizontalDistance = Math.abs(offset.dot(right)) / horizontalTangent;
        const verticalDistance = Math.abs(offset.dot(viewUp)) / verticalTangent;
        requiredDistance = Math.max(
          requiredDistance,
          depthTowardCamera + Math.max(horizontalDistance, verticalDistance) * margin,
        );
      }
    }
  }

  return requiredDistance;
}

/**
 * Measure the perspective fit from rendered vertices rather than empty Box3
 * corners. When an authored crop is supplied, geometry outside it is ignored
 * deliberately (for example, long stock passing through a planer).
 */
export function perspectiveObjectFitDistance(
  root,
  bounds,
  direction,
  verticalFieldOfView,
  aspect,
  cropToBounds = false,
  margin = CAMERA_FIT_MARGIN,
) {
  const cameraAxis = direction.clone().normalize();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(worldUp, cameraAxis);
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  else right.normalize();
  const viewUp = new THREE.Vector3().crossVectors(cameraAxis, right).normalize();
  const center = bounds.getCenter(new THREE.Vector3());
  const verticalTangent = Math.tan(THREE.MathUtils.degToRad(verticalFieldOfView * 0.5));
  const horizontalTangent = verticalTangent * Math.max(aspect, 0.01);
  const point = new THREE.Vector3();
  const offset = new THREE.Vector3();
  let requiredDistance = 0;
  let fittedVertexCount = 0;

  root.updateMatrixWorld(true);
  root.traverseVisible((object) => {
    const positions = object.geometry?.getAttribute('position');
    if (!positions) return;
    for (let index = 0; index < positions.count; index += 1) {
      point.fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld);
      if (cropToBounds && !bounds.containsPoint(point)) continue;
      offset.copy(point).sub(center);
      const depthTowardCamera = offset.dot(cameraAxis);
      const horizontalDistance = Math.abs(offset.dot(right)) / horizontalTangent;
      const verticalDistance = Math.abs(offset.dot(viewUp)) / verticalTangent;
      requiredDistance = Math.max(
        requiredDistance,
        depthTowardCamera + Math.max(horizontalDistance, verticalDistance) * margin,
      );
      fittedVertexCount += 1;
    }
  });

  return fittedVertexCount > 0
    ? requiredDistance
    : perspectiveBoxFitDistance(
      bounds,
      cameraAxis,
      verticalFieldOfView,
      aspect,
      margin,
    );
}

export class MovementEngine {
  static async create(container, movement, options = {}) {
    options.signal?.throwIfAborted();
    const model = await loadMovementModel(movement);
    try {
      options.signal?.throwIfAborted();
      return new this(container, movement, {...options, model});
    } catch (error) {
      disposeMovementModel(model);
      throw error;
    }
  }

  constructor(container, movement, options = {}) {
    if (!options.model) throw new TypeError('Load a model with MovementEngine.create before constructing the renderer.');
    this.container = container;
    this.movement = movement;
    this.playing = options.playing ?? true;
    this.speed = options.speed ?? 1;
    this.elapsed = 0;
    this.playbackEnded = false;
    this.onPlaybackChange = options.onPlaybackChange;
    this.disposed = false;
    this.animationFrame = 0;
    this.clock = new THREE.Clock();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.paper);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.05, 100);

    this.renderer = new THREE.WebGLRenderer({
      // Multisampling leaked hidden edges through opaque faces on the review
      // renderer (039). Use a larger single-sample framebuffer instead.
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    // Two pixels per CSS pixel keep edges smooth with a bounded buffer size.
    this.renderer.setPixelRatio(2);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'simulation-canvas';
    this.renderer.domElement.setAttribute('aria-label', `Interactive 3D simulation of movement ${movement.id}: ${movement.title}`);
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.tabIndex = 0;
    container.replaceChildren(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.enablePan = true;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 24;
    this.controls.maxPolarAngle = Math.PI * 0.94;

    this.addLighting();
    this.model = options.model;
    const playbackDuration = this.model.root.userData.playbackDuration;
    this.playbackDuration = Number.isFinite(playbackDuration) && playbackDuration > 0
      ? playbackDuration : Infinity;
    const shadowExtent = this.model.root.userData.shadowCameraHalfExtent;
    if (shadowExtent) {
      // Small, tightly packed mechanisms need the shadow map concentrated
      // around their metalwork to keep tooth shadows from becoming blotches.
      for (const light of this.scene.children.filter((object) => object.isDirectionalLight && object.castShadow)) {
        Object.assign(light.shadow.camera, { left: -shadowExtent, right: shadowExtent, top: shadowExtent, bottom: -shadowExtent });
        light.shadow.camera.updateProjectionMatrix();
        light.shadow.bias = this.model.root.userData.shadowBias ?? light.shadow.bias;
        light.shadow.normalBias = this.model.root.userData.shadowNormalBias ?? light.shadow.normalBias;
      }
    }
    this.renderer.localClippingEnabled = Boolean(this.model.root.userData.localClippingEnabled);
    this.playbackTimeScale = this.model.root.userData.animationTiming
      ?.playbackTimeScale ?? 1;
    this.scene.add(this.model.root);
    this.model.update?.(0, 0);
    this.fitCamera(this.model.cameraDirection);
    this.addGround();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.onDoubleClick = () => this.resetView();
    this.renderer.domElement.addEventListener('dblclick', this.onDoubleClick);
    this.onVisibilityChange = () => {
      this.clock.getDelta();
    };
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.animate();
  }

  addLighting() {
    const hemisphere = new THREE.HemisphereLight(0xffffff, 0x7b766c, 2.15);
    this.scene.add(hemisphere);
    const key = new THREE.DirectionalLight(0xfff9eb, 3.15);
    key.position.set(6, 9, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1536, 1536);
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 28;
    key.shadow.bias = -0.0004;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xb9d8e2, 1.15);
    fill.position.set(-6, 3, 4);
    this.scene.add(fill);
  }

  fitCamera(direction = new THREE.Vector3(6, 4, 8), { preserveView = false } = {}) {
    const previousOffset = this.camera.position.clone().sub(this.controls.target);
    const previousTarget = this.controls.target.clone();
    const previousFitDistance = this.initialCameraPosition?.distanceTo(this.initialTarget);
    this.cameraFitDirection = direction.clone();
    this.camera.fov = this.model.root.userData.cameraFov ?? 36;
    const authoredFitBounds = this.model.root.userData.cameraFitBounds;
    const sampledMotionBounds = this.model.root.userData.sampledMotionBounds;
    const fitsMotion = Boolean(sampledMotionBounds);
    const bounds = authoredFitBounds?.isBox3
      ? authoredFitBounds.clone()
      : new THREE.Box3().setFromObject(this.model.root, true);
    if (fitsMotion && !authoredFitBounds?.isBox3) {
      bounds.union(new THREE.Box3(
        new THREE.Vector3().fromArray(sampledMotionBounds.min),
        new THREE.Vector3().fromArray(sampledMotionBounds.max),
      ));
    }
    if (bounds.isEmpty()) {
      bounds.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(4, 4, 4));
    }
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(sphere.radius, 1.7);
    const distanceScale = this.model.root.userData.cameraDistanceScale ?? 1;
    const aspect = Math.max(1, this.container.clientWidth)
      / Math.max(1, this.container.clientHeight);
    this.camera.aspect = aspect;
    const preferredDistance = Math.max(radius * 2.45, 5.2) * distanceScale;
    const cameraAxis = direction.clone().normalize();
    const renderedFitDistance = fitsMotion ? 0 : perspectiveObjectFitDistance(
      this.model.root,
      bounds,
      cameraAxis,
      this.camera.fov,
      aspect,
      Boolean(authoredFitBounds?.isBox3),
    );
    // Crops are already applied above. Do not cap the distance needed to fit
    // the remaining geometry: that clipped tall mechanisms such as 004.
    // Keep a stable view through the animation. Fitting just the initial
    // vertices cropped rising levers and descending loads later in a cycle.
    const motionFitDistance = fitsMotion
      ? perspectiveBoxFitDistance(bounds, cameraAxis, this.camera.fov, aspect)
      : 0;
    const distance = Math.max(preferredDistance, renderedFitDistance, motionFitDistance);
    // Wide source-complete mechanisms can legitimately require a camera
    // distance beyond the generic interactive ceiling. Keep the model's
    // computed fit authoritative while retaining 24 as the normal minimum
    // orbit limit for compact mechanisms.
    this.controls.maxDistance = Math.max(24, distance * 3);
    this.initialTarget = sphere.center.clone();
    this.initialCameraPosition = sphere.center.clone().add(direction.clone().normalize().multiplyScalar(distance));
    if (preserveView && previousFitDistance > 0) {
      // Retain the user's orbit, pan and relative zoom as the viewport changes.
      this.camera.position.copy(previousTarget).add(previousOffset.multiplyScalar(distance / previousFitDistance));
      this.controls.target.copy(previousTarget);
    } else {
      // Consume pending drag inertia before assigning the reset position.
      // Otherwise OrbitControls applies the old gesture to the fresh view.
      const damping = this.controls.enableDamping;
      this.controls.enableDamping = false;
      this.controls.update();
      this.controls.enableDamping = damping;
      this.camera.position.copy(this.initialCameraPosition);
      this.controls.target.copy(this.initialTarget);
    }
    this.camera.near = Math.max(0.03, distance / 180);
    this.camera.far = distance * 8;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  addGround() {
    const bounds = new THREE.Box3().setFromObject(this.model.root, true);
    const floorY = groundFloorFor(this.model, bounds);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.ShadowMaterial({ opacity: 0.14, depthWrite: false }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = floorY;
    ground.receiveShadow = true;
    ground.visible = !this.model.root.userData.hideGround;
    ground.userData.isEnvironment = true;
    this.scene.add(ground);
    this.ground = ground;
    this.partBounds = new THREE.Box3();
    this.geometryVersions = new WeakMap();
  }

  updateGroundClearance() {
    this.ground.visible = !this.model.root.userData.hideGround;
    // The sampled envelope sets a stable floor before playback. Also guard
    // arbitrary future poses, including geometry that deforms beyond it.
    this.model.root.updateMatrixWorld(true);
    this.model.root.traverseVisible((object) => {
      const geometry = object.geometry;
      const position = geometry?.attributes.position;
      if (!position) return;
      if (!geometry.boundingBox || this.geometryVersions.get(geometry) !== position.version) {
        geometry.computeBoundingBox();
        this.geometryVersions.set(geometry, position.version);
      }
      this.partBounds.copy(geometry.boundingBox).applyMatrix4(object.matrixWorld);
      // The box is a cheap broad-phase check. Its empty rotated corners can
      // extend well below a wheel, so verify an apparent crossing against
      // actual vertices before moving the floor. Most parts skip this scan.
      if (this.partBounds.min.y >= this.ground.position.y + GROUND_CLEARANCE) return;
      const matrix = object.matrixWorld.elements;
      let minimumY = Infinity;
      for (let i = 0; i < position.count; i += 1) {
        const y = position.getX(i) * matrix[1] + position.getY(i) * matrix[5]
          + position.getZ(i) * matrix[9] + matrix[13];
        minimumY = Math.min(minimumY, y);
      }
      this.ground.position.y = Math.min(this.ground.position.y, minimumY - GROUND_CLEARANCE);
    });
  }

  resize() {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    if (this.camera.aspect !== width / height) {
      this.fitCamera(this.cameraFitDirection, { preserveView: true });
    }
    this.renderer.setSize(width, height, false);
  }

  animate = () => {
    if (this.disposed) return;
    this.animationFrame = requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.advance(delta);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  advance(delta) {
    if (!this.playing) return;
    const previous = this.elapsed;
    const scaledDelta = delta * this.speed * this.playbackTimeScale;
    const duration = this.playbackDuration ?? Infinity;
    this.elapsed = Math.min(
      duration,
      previous + scaledDelta,
    );
    this.model.update?.(this.elapsed, Math.min(scaledDelta, duration - previous));
    this.updateGroundClearance();
    if (this.elapsed >= this.playbackDuration) {
      this.playbackEnded = true;
      this.setPlaying(false);
    }
  }

  setPlaying(playing) {
    if (playing && this.playbackEnded) {
      this.elapsed = 0;
      this.playbackEnded = false;
      this.model.update?.(0, 0);
      this.updateGroundClearance();
    }
    this.playing = Boolean(playing);
    this.clock.getDelta();
    this.onPlaybackChange?.({ playing: this.playing, ended: this.playbackEnded, elapsed: this.elapsed });
  }

  togglePlaying() {
    this.setPlaying(!this.playing);
    return this.playing;
  }

  setSpeed(speed) {
    this.speed = THREE.MathUtils.clamp(Number(speed) || 1, 0.1, 3);
  }

  setConfiguration(configuration) {
    if (!this.model.root.userData.setConfiguration) return false;
    this.model.root.userData.setConfiguration(configuration);
    this.elapsed = 0;
    this.playbackEnded = false;
    this.model.update?.(0, 0);
    this.clock.getDelta();
    this.updateGroundClearance();
    this.fitCamera(this.model.root.userData.sectionView === false
      ? this.model.root.userData.fullCameraDirection ?? this.model.cameraDirection
      : this.model.cameraDirection);
    this.onPlaybackChange?.({ playing: this.playing, ended: false, elapsed: 0 });
    return true;
  }

  resetView() {
    this.fitCamera(this.cameraFitDirection);
  }

  restart() {
    this.elapsed = 0;
    this.playbackEnded = false;
    if (this.model.reset) this.model.reset();
    else this.model.update?.(0, 0);
    this.clock.getDelta();
    this.updateGroundClearance();
    this.onPlaybackChange?.({playing: this.playing, ended: false, elapsed: 0});
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.renderer.domElement.removeEventListener('dblclick', this.onDoubleClick);
    this.controls.dispose();
    this.scene.remove(this.model.root);
    disposeMovementModel(this.model);
    disposeObject3D(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
