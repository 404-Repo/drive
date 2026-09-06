/**
 * DRIVE  src/items/shield.js  (owner: items)
 *
 * The foam shield as an effect the kart reads through. Round 1 drew the foam_shield asset as it is
 * (a DoubleSide shell at 0.35 opacity plus twelve bubbles at 0.62), which covered the player kart in
 * 4 to 5 of 8 critic frames: the kart's own colour was gone from inside its box. This module draws:
 *
 *   shell     a smooth sphere of the asset's radius with a fresnel rim: about 0.12 fill in the middle,
 *             a bright cyan white rim at the silhouette, a thin film colour drift on the rim, a real
 *             sun highlight (the one specular the bubble needs) and a slow sheen band travelling over
 *             the surface; front faces only, no depth write, so the kart, driver and wheels stay legible
 *   bubbles   the asset's own twelve foam bubbles (the `foam_bubbles` joint) as glassy rim only spheres
 *             riding the shell, so the item keeps its foam character and the 404 asset stays in use
 *   ring      a flat additive sparkle ring on the ground round the kart's base, dashes counter rotating
 *   sparks    sixteen soft additive points per shield rising round the base like foam bubbles
 *
 * Four draws for every shield on the track at once (InstancedMesh x 3 plus one Points), nothing
 * when no shield is up. The shell pops in over 0.25 s and blinks over its last 1.2 s so the player
 * sees it about to drop. Instancing goes through three's own `instanceMatrix` (USE_INSTANCING is
 * defined for a ShaderMaterial on an InstancedMesh); per instance phase and alpha ride an
 * InstancedBufferAttribute. Colours: `sea shallow` 0x3fb0b8 and whitewash for the fill and rim,
 * `sun warm` 0xffc48a for the highlight and the warm sparks (style lock: effects use only those).
 */
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { sunDirection } from '../render/lighting.js?v=r3-20260906150928';

const HIDDEN = new THREE.Matrix4().makeScale(1e-6, 1e-6, 1e-6).setPosition(0, -1000, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const _y = new THREE.Vector3(0, 1, 0);

export const SHIELD_RADIUS = 1.2;        // the foam_shield asset is a 2.4 m sphere; read from the asset when it loads
export const SHIELD_CENTRE_Y = 0.75;     // shell centre above the kart's base: the helmet top (1.75) sits inside
export const SHIELD_POP_IN = 0.25;       // s
export const SHIELD_BLINK = 1.2;         // s before the end the shell starts blinking

const SHELL_VS = /* glsl */`
attribute vec4 aInst;
varying vec3 vNw;
varying vec3 vWp;
varying vec3 vLp;
varying vec4 vInst;
void main() {
  vInst = aInst;
  vLp = position;
  vec4 mv = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    mv = instanceMatrix * mv;
    n = mat3(instanceMatrix) * n;
  #endif
  vec4 wp = modelMatrix * mv;
  vWp = wp.xyz;
  vNw = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const SHELL_FS = /* glsl */`
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uFill;
uniform vec3 uRim;
uniform vec3 uIri;
uniform vec3 uWarm;
uniform float uFillA;
uniform float uRimA;
uniform float uSpec;
uniform float uSheen;
varying vec3 vNw;
varying vec3 vWp;
varying vec3 vLp;
varying vec4 vInst;
void main() {
  vec3 n = normalize(vNw);
  vec3 v = normalize(cameraPosition - vWp);
  float ndv = clamp(dot(n, v), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 3.2);
  // thin film drift on the rim: cyan white toward a lilac, slowly turning
  float band = 0.5 + 0.5 * sin(ndv * 14.0 + uTime * 0.8 + vInst.x);
  vec3 rim = mix(uRim, uIri, band * 0.45);
  // the sun's highlight on the bubble
  vec3 h = normalize(uSun + v);
  float spec = pow(clamp(dot(n, h), 0.0, 1.0), 90.0) * uSpec;
  // a soft sheen band travelling over the surface
  float ang = atan(vLp.z, vLp.x);
  float sheen = smoothstep(0.84, 1.0, sin(vLp.y * 2.2 + ang * 2.0 + uTime * 1.6 + vInst.x)) * uSheen;
  float a = uFillA + fres * uRimA + sheen * (1.0 - fres) + spec * 0.6;
  vec3 col = mix(uFill, rim, clamp(fres * 1.6, 0.0, 1.0)) + uWarm * spec + uRim * sheen * 0.5;
  a *= vInst.y;
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const RING_VS = /* glsl */`
attribute vec4 aInst;
varying vec2 vLp;
varying vec4 vInst;
void main() {
  vInst = aInst;
  vLp = position.xy;
  vec4 mv = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    mv = instanceMatrix * mv;
  #endif
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * mv;
}`;

const RING_FS = /* glsl */`
uniform float uTime;
uniform float uInner;
uniform float uOuter;
uniform vec3 uCool;
uniform vec3 uWarm;
varying vec2 vLp;
varying vec4 vInst;
void main() {
  float r = (length(vLp) - uInner) / (uOuter - uInner);
  float radial = smoothstep(0.0, 0.3, r) * (1.0 - smoothstep(0.4, 1.0, r));
  float ang = atan(vLp.y, vLp.x);
  float d1 = pow(0.5 + 0.5 * sin(ang * 10.0 - uTime * 5.0 + vInst.x), 6.0);
  float d2 = pow(0.5 + 0.5 * sin(ang * 7.0 + uTime * 3.2 + vInst.x * 1.7), 8.0);
  float dashes = 0.22 + 0.9 * d1 + 0.7 * d2;
  vec3 col = mix(uCool, uWarm, d2 * 0.8);
  float a = radial * dashes * vInst.y;
  gl_FragColor = vec4(col * a, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** A soft round dot for the spark points, drawn at load; nothing on disk. */
export function dotTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Pull the shell radius and the merged bubbles geometry (in shell centre space) out of the loaded
 * foam_shield prototype. Missing asset: the defaults, no bubbles.
 */
function readProto(proto) {
  const out = { radius: SHIELD_RADIUS, bubbles: null };
  if (!proto) return out;
  proto.updateMatrixWorld(true);
  let shell = null, bubblesNode = null;
  proto.traverse((o) => { if (o.name === 'foam_shell' && !shell) shell = o; if (o.name === 'foam_bubbles' && !bubblesNode) bubblesNode = o; });
  if (!shell) return out;
  let radius = 0;
  shell.children.forEach((o) => {
    if (!o.isMesh || !o.geometry) return;
    o.geometry.computeBoundingSphere();
    if (o.geometry.boundingSphere) radius = Math.max(radius, o.geometry.boundingSphere.radius);
  });
  if (radius > 0.5 && radius < 3) out.radius = radius;
  if (bubblesNode) {
    const inv = new THREE.Matrix4().copy(shell.matrixWorld).invert();
    const geos = [];
    bubblesNode.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', o.geometry.getAttribute('position').clone());
      if (o.geometry.getAttribute('normal')) g.setAttribute('normal', o.geometry.getAttribute('normal').clone());
      if (o.geometry.index) g.setIndex(o.geometry.index.clone());
      g.applyMatrix4(_m.multiplyMatrices(inv, o.matrixWorld));
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      geos.push(g);
    });
    if (geos.length) {
      try { out.bubbles = BufferGeometryUtils.mergeGeometries(geos, false); } catch (e) { console.warn('[items] shield bubbles not merged: ' + e.message); }
    }
  }
  return out;
}

export class ShieldFX {
  /**
   * @param scene    where the four effect objects go
   * @param proto    the loaded foam_shield prototype (keepHierarchy), or null
   * @param capacity slots, one per racer
   */
  constructor(scene, { proto = null, capacity = 8, sparksPer = 16 } = {}) {
    this.capacity = capacity;
    this.free = [];
    for (let i = capacity - 1; i >= 0; i--) this.free.push(i);
    this.active = new Set();
    this.slots = [];
    for (let i = 0; i < capacity; i++) this.slots.push({ age: 0, left: 0, dur: 1, phase: (i * 1.7) % 6.28, pos: new THREE.Vector3(0, -1000, 0), heading: 0, alpha: 0 });
    const read = readProto(proto);
    this.radius = read.radius;
    this.time = 0;

    const sun = sunDirection(THREE, new THREE.Vector3());
    this.uniforms = {
      uTime: { value: 0 }, uSun: { value: sun },
      uFill: { value: new THREE.Color(0x3fb0b8).lerp(new THREE.Color(0xf1e6d2), 0.55) },
      uRim: { value: new THREE.Color(0xd8f6f8) },
      uIri: { value: new THREE.Color(0xc9b8f0) },
      uWarm: { value: new THREE.Color(0xffc48a) },
      uFillA: { value: 0.12 }, uRimA: { value: 0.85 }, uSpec: { value: 1.6 }, uSheen: { value: 0.2 },
    };
    const shellMat = new THREE.ShaderMaterial({
      name: 'items:shield_shell', vertexShader: SHELL_VS, fragmentShader: SHELL_FS, uniforms: this.uniforms,
      transparent: true, depthWrite: false, depthTest: true, side: THREE.FrontSide, fog: false,
    });
    const bubbleMat = new THREE.ShaderMaterial({
      name: 'items:shield_bubbles', vertexShader: SHELL_VS, fragmentShader: SHELL_FS,
      uniforms: Object.assign({}, this.uniforms, { uFillA: { value: 0.04 }, uRimA: { value: 0.55 }, uSpec: { value: 1.2 }, uSheen: { value: 0.0 } }),
      transparent: true, depthWrite: false, depthTest: true, side: THREE.FrontSide, fog: false,
    });
    const ringU = { uTime: this.uniforms.uTime, uInner: { value: this.radius * 0.92 }, uOuter: { value: this.radius * 1.32 },
      uCool: { value: new THREE.Color(0xbfe8f0) }, uWarm: { value: new THREE.Color(0xffc48a) } };
    const ringMat = new THREE.ShaderMaterial({
      name: 'items:shield_ring', vertexShader: RING_VS, fragmentShader: RING_FS, uniforms: ringU,
      transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    });

    this.inst = new Float32Array(capacity * 4);
    const instAttr = () => { const a = new THREE.InstancedBufferAttribute(this.inst, 4); a.setUsage(THREE.DynamicDrawUsage); return a; };
    const shellGeo = new THREE.SphereGeometry(this.radius, 40, 26);
    shellGeo.setAttribute('aInst', instAttr());
    this.shell = new THREE.InstancedMesh(shellGeo, shellMat, capacity);
    this.shell.name = 'items:shield_shell';
    this.bubbles = null;
    if (read.bubbles) {
      read.bubbles.setAttribute('aInst', instAttr());
      this.bubbles = new THREE.InstancedMesh(read.bubbles, bubbleMat, capacity);
      this.bubbles.name = 'items:shield_bubbles';
    }
    const ringGeo = new THREE.RingGeometry(this.radius * 0.92, this.radius * 1.32, 64, 1);
    ringGeo.setAttribute('aInst', instAttr());
    this.ring = new THREE.InstancedMesh(ringGeo, ringMat, capacity);
    this.ring.name = 'items:shield_ring';
    for (const m of [this.shell, this.bubbles, this.ring]) {
      if (!m) continue;
      m.frustumCulled = false;
      m.castShadow = false; m.receiveShadow = false;
      m.renderOrder = 20;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < capacity; i++) m.setMatrixAt(i, HIDDEN);
      m.instanceMatrix.needsUpdate = true;
    }
    this.ring.renderOrder = 19;

    // sparks: one Points buffer, sparksPer per slot, rising round the base
    this.sparksPer = sparksPer;
    const n = capacity * sparksPer;
    this.sPos = new Float32Array(n * 3).fill(-1000);
    this.sCol = new Float32Array(n * 3);
    this.sSeed = new Float32Array(n * 3);
    let seed = 11;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < n; i++) {
      this.sSeed[i * 3] = rnd() * Math.PI * 2;          // angle
      this.sSeed[i * 3 + 1] = rnd();                    // lift phase
      this.sSeed[i * 3 + 2] = 0.6 + rnd() * 0.8;        // rise speed
      const warm = (i % 5) === 0;
      const c = new THREE.Color(warm ? 0xffc48a : 0xd8f6f8);
      this.sCol[i * 3] = c.r; this.sCol[i * 3 + 1] = c.g; this.sCol[i * 3 + 2] = c.b;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.sPos, 3).setUsage(THREE.DynamicDrawUsage));
    sg.setAttribute('color', new THREE.BufferAttribute(this.sCol, 3));
    const map = dotTexture();
    this.sparks = new THREE.Points(sg, new THREE.PointsMaterial({
      size: 0.11, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, map, alphaMap: map, fog: false,
    }));
    this.sparks.name = 'items:shield_sparks';
    this.sparks.frustumCulled = false;
    this.sparks.renderOrder = 21;

    this.group = new THREE.Group();
    this.group.name = 'items:shield';
    this.group.add(this.shell, this.ring, this.sparks);
    if (this.bubbles) this.group.add(this.bubbles);
    this.group.visible = false;
    if (scene) scene.add(this.group);
  }

  get draws() { return 3 + (this.bubbles ? 1 : 0); }
  get drawsNow() { return this.group.visible ? this.draws : 0; }

  /** Take a slot for a racer's shield; -1 when every slot is out. */
  acquire(dur = 6) {
    if (!this.free.length) return -1;
    const s = this.free.pop();
    this.active.add(s);
    const st = this.slots[s];
    st.age = 0; st.left = dur; st.dur = dur; st.alpha = 0;
    for (let i = 0; i < this.sparksPer; i++) this.sSeed[(s * this.sparksPer + i) * 3 + 1] = (i / this.sparksPer + Math.random() * 0.1) % 1;
    this.group.visible = true;
    return s;
  }

  release(slot) {
    if (slot < 0 || !this.active.has(slot)) return;
    this.active.delete(slot);
    this.free.push(slot);
    this._hide(slot);
    if (!this.active.size) this.group.visible = false;
  }

  _hide(slot) {
    for (const m of [this.shell, this.bubbles, this.ring]) if (m) { m.setMatrixAt(slot, HIDDEN); m.instanceMatrix.needsUpdate = true; }
    for (let i = 0; i < this.sparksPer; i++) this.sPos[(slot * this.sparksPer + i) * 3 + 1] = -1000;
    this.sparks.geometry.attributes.position.needsUpdate = true;
    this.slots[slot].pos.set(0, -1000, 0);
  }

  /** Where the racer is this frame (kart base position and heading) and how long the shield has left. */
  place(slot, x, y, z, heading, left) {
    const st = this.slots[slot];
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) return;
    st.pos.set(x, y, z);
    st.heading = Number.isFinite(heading) ? heading : 0;
    if (Number.isFinite(left)) st.left = left;
  }

  update(dt) {
    if (!this.active.size) return;
    this.time += dt;
    this.uniforms.uTime.value = this.time;
    for (const s of this.active) {
      const st = this.slots[s];
      st.age += dt;
      // pop in with a small overshoot, blink over the last SHIELD_BLINK seconds
      const k = Math.min(1, st.age / SHIELD_POP_IN);
      const scale = k < 1 ? 0.6 + 0.55 * Math.sin(k * Math.PI * 0.5) * (1 + 0.12 * Math.sin(k * Math.PI)) : 1;
      let alpha = k;
      if (st.left < SHIELD_BLINK) alpha *= 0.45 + 0.55 * (Math.floor(st.left * 5) % 2);
      st.alpha = alpha;
      this.inst[s * 4] = st.phase;
      this.inst[s * 4 + 1] = alpha;
      // shell and bubbles: centred on the kart body, turning slowly with a small wobble
      _q.setFromEuler(_e.set(Math.sin(this.time * 1.3 + st.phase) * 0.06, this.time * 0.5 + st.phase, Math.sin(this.time * 1.7 + st.phase) * 0.06));
      _p.set(st.pos.x, st.pos.y + SHIELD_CENTRE_Y, st.pos.z);
      _s.setScalar(scale);
      _m.compose(_p, _q, _s);
      this.shell.setMatrixAt(s, _m);
      if (this.bubbles) this.bubbles.setMatrixAt(s, _m);
      // ring: flat on the ground under the kart
      _q.setFromAxisAngle(_y, st.heading).multiply(_q2.setFromAxisAngle(_x, -Math.PI / 2));
      _p.set(st.pos.x, st.pos.y + 0.06, st.pos.z);
      _s.setScalar(0.5 + 0.5 * scale);
      _m.compose(_p, _q, _s);
      this.ring.setMatrixAt(s, _m);
      // sparks: rise round the base and wrap
      const r = this.radius * 1.12;
      for (let i = 0; i < this.sparksPer; i++) {
        const j = s * this.sparksPer + i;
        const a0 = this.sSeed[j * 3], ph = this.sSeed[j * 3 + 1], sp = this.sSeed[j * 3 + 2];
        const lift = (ph + this.time * 0.35 * sp) % 1;
        const ang = a0 + this.time * 0.9 + lift * 1.2;
        const o = j * 3;
        this.sPos[o] = st.pos.x + Math.cos(ang) * r * (1 + 0.06 * lift);
        this.sPos[o + 1] = st.pos.y + 0.04 + lift * 0.9;
        this.sPos[o + 2] = st.pos.z + Math.sin(ang) * r * (1 + 0.06 * lift);
        if (alpha < 0.5 && (i & 1)) this.sPos[o + 1] = -1000;   // half the sparks blink with the shell
      }
    }
    this.shell.instanceMatrix.needsUpdate = true;
    if (this.bubbles) this.bubbles.instanceMatrix.needsUpdate = true;
    this.ring.instanceMatrix.needsUpdate = true;
    this.shell.geometry.attributes.aInst.needsUpdate = true;
    if (this.bubbles) this.bubbles.geometry.attributes.aInst.needsUpdate = true;
    this.ring.geometry.attributes.aInst.needsUpdate = true;
    this.sparks.geometry.attributes.position.needsUpdate = true;
  }
}
const _q2 = new THREE.Quaternion(), _x = new THREE.Vector3(1, 0, 0);
