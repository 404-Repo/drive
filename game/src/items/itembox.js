/**
 * DRIVE  src/items/itembox.js  (owner: items)
 *
 * The item box drawn as an effect, round 3. The critic's round 3 verdict (bar pair 1): "an oversized
 * translucent white cube with a ball in it that sits tilted and floating off the road". Round 2 drew the
 * item_box asset through the InstancePool: a 0.6 m glass cube on its corner (1.0 m tall), its six panes
 * 0.6 opacity DoubleSide sky blue that read as a solid white block, stood on its corner a second time by
 * boxes.js (the asset already stands on one) and floating 0.5 m up with its shadow 2.4 m to the side
 * under the 12 degree sun. This module draws instead:
 *
 *   glass     a 1.2 m cube of rainbow refraction glass: two passes (back faces then front faces, so the
 *             block has depth), a fresnel rim, a thin film tint whose hue turns with the view angle and
 *             the height on the block, bright bevel bands along the twelve edges, the sun's highlight and
 *             a slow sheen band. No depth write, so the road and the core read through it. The front pass
 *             casts the shadow (a solid cube in the shadow map; the low sun lays it on the road from the
 *             base of the box).
 *   core      the coral core sphere from the item_box asset's `core` joint, `coral 404` with the `sun warm`
 *             emissive the style lock gives it, at the cube's centre.
 *
 *   contact   a soft dark blob on the road under each box (an instanced quad, multiply blended), so the box
 *             is seated on the road even though the 12 degree sun lays its cast shadow 0.6 m to the east of
 *             the footprint (the critic's round 3 "floating off the road": a cast shadow alone leaves a gap).
 *
 * Four draws for every box on the track (InstancedMesh x 4), none when no box is up. The pool interface
 * is the one boxes.js InstancePool has (group, size, acquire, release, set, place, hide, releaseAll,
 * draws, drawsNow, empty) so Boxes needs no other change than its placement maths. Colours: the rainbow is
 * an effect tint (the lead's round 3 ask), softened toward whitewash so it stays pastel glass, not neon;
 * `sun warm` 0xffc48a for the highlight, `coral 404` 0xed5851 for the core, both from the style lock's
 * effect set. The glass carries three's fog chunks with `fog: true`, so the rig's refresh() patches it
 * with the aerial perspective like the sea.
 */
import * as THREE from 'three';
import { sunDirection } from '../render/lighting.js?v=r5-20260906181225';

const HIDDEN = new THREE.Matrix4().makeScale(1e-6, 1e-6, 1e-6).setPosition(0, -1000, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();

export const BOX_SIZE = 1.2;             // m, the cube edge (the lead's round 3 size; the asset is 1.0 on its corner)
export const CORE_DIAMETER = 0.56;       // m, the core sphere inside the block (the asset's is 0.36 in a 1.0 m box)

const GLASS_VS = /* glsl */`
attribute vec2 aInst;
uniform float uHalf;
varying vec3 vNw;
varying vec3 vWp;
varying vec3 vLp;
varying vec2 vInst;
varying float vCamD;
#include <fog_pars_vertex>
void main() {
  vInst = aInst;
  vLp = position - vec3(0.0, uHalf, 0.0);
  vec4 mv = vec4(position, 1.0);
  vec4 cc = vec4(0.0, uHalf, 0.0, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    mv = instanceMatrix * mv;
    cc = instanceMatrix * cc;
    n = mat3(instanceMatrix) * n;
  #endif
  vCamD = distance(cameraPosition, (modelMatrix * cc).xyz);   // round 3 (kart -> items): the chase camera drives through a taken box's neighbour; the glass fades out under 2.4 m
  vec4 wp = modelMatrix * mv;
  vWp = wp.xyz;
  vNw = normalize(mat3(modelMatrix) * n);
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const GLASS_FS = /* glsl */`
uniform float uTime;
uniform float uHalf;
uniform float uBack;
uniform vec3 uSun;
uniform vec3 uPale;
uniform vec3 uWarm;
varying vec3 vNw;
varying vec3 vWp;
varying vec3 vLp;
varying vec2 vInst;
varying float vCamD;
#include <fog_pars_fragment>
void main() {
  vec3 n = normalize(vNw);
  if (uBack > 0.5) n = -n;
  vec3 v = normalize(cameraPosition - vWp);
  float ndv = clamp(dot(n, v), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 2.2);
  // bevel bands: on a face one local coordinate sits at the half edge; along an arris a second one does too
  vec3 a = abs(vLp) / uHalf;
  float mid = max(min(a.x, a.y), min(max(a.x, a.y), a.z));
  float edge = smoothstep(0.80, 0.97, mid);
  // rainbow refraction tint: the hue turns with the view angle, the height on the block and time
  float hue = fract(0.6 * ndv + 0.45 * (vLp.y / uHalf) + 0.22 * (vLp.x / uHalf) + uTime * 0.25 + vInst.x * 0.17);
  vec3 rainbow = 0.5 + 0.5 * cos(6.2832 * (hue + vec3(0.0, 0.33, 0.67)));
  rainbow = pow(rainbow, vec3(1.6));   // deeper saturation: the pastel mixes of the cosine palette read as white glass
  vec3 tint = mix(rainbow, uPale, 0.12);
  // the sun's highlight, the one hard specular the glass needs
  vec3 h = normalize(uSun + v);
  float spec = pow(clamp(dot(n, h), 0.0, 1.0), 70.0) * 1.8;
  // a slow sheen band travelling over the block
  float sheen = smoothstep(0.86, 1.0, sin(vLp.y * 3.0 + vLp.x * 2.0 + uTime * 1.5 + vInst.x)) * 0.25;
  float back = uBack > 0.5 ? 1.0 : 0.0;
  float alpha = mix(0.52, 0.26, back) + fres * mix(0.40, 0.30, back) + edge * 0.6 + sheen + spec * 0.5;
  vec3 col = tint * (1.05 + 0.55 * fres) * mix(1.0, 0.75, back) + uPale * edge * 0.9 + uWarm * spec + tint * sheen;
  col = min(col, vec3(2.5));   // under the bloom threshold (4.0): the box never blooms
  float nearFade = smoothstep(1.3, 2.4, vCamD);   // the camera inside the block saw a cream wash over the whole frame
  gl_FragColor = vec4(col, clamp(alpha * vInst.y * nearFade, 0.0, 1.0));
  #include <fog_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// The contact blob: a flat quad on the road under the box, multiply blended (the road's own lit colour
// times a cool shade toward the centre), so it darkens whatever surface it lies on without a hard edge.
const CONTACT_VS = /* glsl */`
attribute vec2 aInst;
varying vec2 vUv;
varying float vA;
void main() {
  vUv = uv;
  vA = aInst.y;
  vec4 mv = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    mv = instanceMatrix * mv;
  #endif
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * mv;
}`;
const CONTACT_FS = /* glsl */`
uniform vec3 uShade;
uniform float uStrength;
varying vec2 vUv;
varying float vA;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.30, d) * uStrength * clamp(vA, 0.0, 1.0);
  gl_FragColor = vec4(mix(vec3(1.0), uShade, a), 1.0);
}`;
export const CONTACT_DIAMETER = 1.7;     // m, the blob's quad; it fades to nothing at the rim
export const CONTACT_STRENGTH = 0.62;    // how dark the centre gets (1 = the shade colour itself)

/** The core sphere geometry out of the item_box prototype's `core` joint, in cube centre space; null when absent. */
function readCore(proto) {
  if (!proto) return null;
  proto.updateMatrixWorld(true);
  let core = null;
  const joints = proto.userData && proto.userData.joints;
  if (joints && joints.core && joints.core.isObject3D) core = joints.core;
  if (!core) proto.traverse((o) => { if (!core && o.name === 'item_box_core') core = o; });
  if (!core) return null;
  let best = null, bestR = 0;
  core.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    o.geometry.computeBoundingSphere();
    const r = o.geometry.boundingSphere ? o.geometry.boundingSphere.radius : 0;
    // the solid core is the smaller sphere; the 0.25 opacity halo round it is the larger one
    if (!best || (r > 0 && r < bestR)) { best = o; bestR = r; }
  });
  if (!best || !(bestR > 0)) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', best.geometry.getAttribute('position').clone());
  if (best.geometry.getAttribute('normal')) g.setAttribute('normal', best.geometry.getAttribute('normal').clone());
  if (best.geometry.index) g.setIndex(best.geometry.index.clone());
  g.center();
  const k = (CORE_DIAMETER / 2) / bestR;
  g.scale(k, k, k);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  return g;
}

export class ItemBoxFX {
  /**
   * @param proto    the loaded item_box prototype (keepHierarchy), or null
   * @param capacity slots, one per box on the track
   */
  constructor(proto, capacity, { name = 'item_box', castShadow = true } = {}) {
    this.name = name;
    this.capacity = capacity;
    this.free = [];
    for (let i = capacity - 1; i >= 0; i--) this.free.push(i);
    this.active = new Set();
    this.size = new THREE.Vector3(BOX_SIZE, BOX_SIZE, BOX_SIZE);
    this.half = BOX_SIZE / 2;
    this.time = 0;
    this.group = new THREE.Group();
    this.group.name = `items:${name}`;
    this.parts = [];

    const sun = sunDirection(THREE, new THREE.Vector3());
    const fogU = THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
    this.uTime = { value: 0 };
    const shared = {
      uTime: this.uTime, uHalf: { value: this.half }, uSun: { value: sun },
      uPale: { value: new THREE.Color(0xf1e6d2) }, uWarm: { value: new THREE.Color(0xffc48a) },
    };
    const glass = (back) => new THREE.ShaderMaterial({
      name: back ? 'items:item_box_glass_back' : 'items:item_box_glass',
      vertexShader: GLASS_VS, fragmentShader: GLASS_FS,
      uniforms: Object.assign({}, fogU, shared, { uBack: { value: back ? 1 : 0 } }),
      transparent: true, depthWrite: false, depthTest: true, side: back ? THREE.BackSide : THREE.FrontSide, fog: true,
    });
    this.inst = new Float32Array(capacity * 2);
    for (let i = 0; i < capacity; i++) { this.inst[i * 2] = (i * 1.7) % 6.28; this.inst[i * 2 + 1] = 1; }
    const instAttr = () => { const a = new THREE.InstancedBufferAttribute(this.inst, 2); a.setUsage(THREE.DynamicDrawUsage); return a; };

    // the block: base at y = 0, centred on x and z, like an asset; the pool matrix centres it before it spins
    const cube = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE);
    cube.translate(0, this.half, 0);
    const cubeBack = cube.clone();
    cube.setAttribute('aInst', instAttr());
    cubeBack.setAttribute('aInst', instAttr());
    this.back = new THREE.InstancedMesh(cubeBack, glass(true), capacity);
    this.back.name = `items:${name}:glass_back`;
    this.front = new THREE.InstancedMesh(cube, glass(false), capacity);
    this.front.name = `items:${name}:glass`;
    this.back.renderOrder = 10; this.front.renderOrder = 11;
    this.back.castShadow = false;
    this.front.castShadow = castShadow;   // the shadow map sees a solid cube: the contact shadow on the road

    // the core: the asset's coral sphere at the block's centre
    let coreGeo = readCore(proto);
    this.coreFromAsset = !!coreGeo;
    if (!coreGeo) coreGeo = new THREE.SphereGeometry(CORE_DIAMETER / 2, 12, 8);
    coreGeo.translate(0, this.half, 0);
    // coral 404 with a coral glow: the round 3 first pass used `sun warm` at 1.0 and the core read as a peach ball
    const coreMat = new THREE.MeshStandardMaterial({ color: 0xed5851, roughness: 0.32, metalness: 0.0, emissive: 0xed5851, emissiveIntensity: 0.55 });
    coreMat.name = 'items:item_box_core';
    this.core = new THREE.InstancedMesh(coreGeo, coreMat, capacity);
    this.core.name = `items:${name}:core`;
    this.core.castShadow = false;
    this.core.renderOrder = 9;

    // the contact blob on the road: flat, base at 0, placed by setContact() (never by set(): a box spins, its shadow does not)
    const blob = new THREE.PlaneGeometry(CONTACT_DIAMETER, CONTACT_DIAMETER);
    blob.rotateX(-Math.PI / 2);
    blob.setAttribute('aInst', instAttr());
    const blobMat = new THREE.ShaderMaterial({
      name: 'items:item_box_contact', vertexShader: CONTACT_VS, fragmentShader: CONTACT_FS,
      uniforms: { uShade: { value: new THREE.Color(0x3a4256) }, uStrength: { value: CONTACT_STRENGTH } },
      transparent: true, blending: THREE.MultiplyBlending, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false, toneMapped: false,
    });
    this.contact = new THREE.InstancedMesh(blob, blobMat, capacity);
    this.contact.name = `items:${name}:contact`;
    this.contact.castShadow = false;
    this.contact.renderOrder = 8;

    for (const m of [this.contact, this.core, this.back, this.front]) {
      m.frustumCulled = false;   // instance bounds are not the geometry bounds; never cull the pool
      m.receiveShadow = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < capacity; i++) m.setMatrixAt(i, HIDDEN);
      m.instanceMatrix.needsUpdate = true;
      this.parts.push(m);
      this.group.add(m);
    }
    this.group.visible = false;   // nothing acquired yet: an idle pool draws nothing
  }

  get draws() { return this.parts.length; }
  get drawsNow() { return this.group.visible ? this.parts.length : 0; }
  get empty() { return false; }

  acquire() {
    if (!this.free.length) return -1;
    const s = this.free.pop();
    this.active.add(s);
    this.group.visible = true;
    return s;
  }
  release(slot) {
    if (slot < 0 || !this.active.has(slot)) return;
    this.active.delete(slot);
    this.free.push(slot);
    this.set(slot, HIDDEN);
    if (!this.active.size) this.group.visible = false;
  }
  set(slot, matrix) {
    if (slot < 0) return;
    for (const p of this.parts) {
      if (p === this.contact && matrix !== HIDDEN) continue;   // the blob is placed by setContact(), flat on the road
      p.setMatrixAt(slot, matrix); p.instanceMatrix.needsUpdate = true;
    }
  }
  /** The contact blob for a slot: centred on x, z, lying on the road at y (call after set(), every frame). */
  setContact(slot, x, y, z, scale = 1) {
    if (slot < 0 || slot >= this.capacity || !this.contact) return;
    _q.identity();
    _p.set(x, y, z);
    _s.setScalar(scale);
    _m.compose(_p, _q, _s);
    this.contact.setMatrixAt(slot, _m);
    this.contact.instanceMatrix.needsUpdate = true;
  }
  /** Position, yaw about +Y, optional full quaternion and uniform scale, base at the given point. */
  place(slot, x, y, z, yaw = 0, scale = 1, quaternion = null) {
    if (quaternion) _q.copy(quaternion); else _q.setFromEuler(_e.set(0, yaw, 0));
    _p.set(x, y, z);
    _s.setScalar(scale);
    _m.compose(_p, _q, _s);
    this.set(slot, _m);
  }
  hide(slot) { this.set(slot, HIDDEN); }
  releaseAll() { for (const s of [...this.active]) this.release(s); }

  /** Per instance alpha (1 normal; boxes.js dims a box that is popping back in). */
  setAlpha(slot, a) {
    if (slot < 0 || slot >= this.capacity) return;
    this.inst[slot * 2 + 1] = a;
    this.front.geometry.attributes.aInst.needsUpdate = true;
    this.back.geometry.attributes.aInst.needsUpdate = true;
    if (this.contact) this.contact.geometry.attributes.aInst.needsUpdate = true;
  }

  update(dt) {
    if (!this.group.visible) return;
    this.time += dt;
    this.uTime.value = this.time;
  }
}
