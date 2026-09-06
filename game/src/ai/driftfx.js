/**
 * DRIVE  src/ai/driftfx.js  (owner: ai)
 *
 * Tyre smoke for every kart that slides. One pooled THREE.Points for all eight karts (one draw
 * call, hidden when nothing is alive), fed from the rear tyres' contact points while a body is
 * drifting, spinning out or carrying real lateral slip. The drift SPARKS (three tier colours off the
 * rear wheels) already live in kart/kartview.js and fire for AI karts as they do for the player; this
 * module adds the smoke the bar shows under a sliding kart: pale puffs that grow, rise, drift with a
 * quarter of the kart's speed and fade inside a second.
 *
 *   const smoke = new DriftSmoke({ scene, tier });
 *   smoke.attach(body.id, view, body);      // once per kart after view.load(); the player too if wanted
 *   smoke.update(dt, camera);               // once per frame after the views updated
 *
 * Reads only public state: body.drift { active, dir, tier }, body.state, body.grounded, body.speed,
 * body.vel, body.heading, body.surface, view.object (world transform) and view.wheels[i].at (the
 * wheel centres in kart space, kartview.js). A view without wheels smokes from the axle line at the
 * TSV defaults. Nothing here writes to a body or a view.
 *
 * Colour follows the surface (style lock palette): a warm pale grey on asphalt and cobbles (never
 * pure white), sand on the beach and the cliff road verges, a dry grass tone on the verges. Every
 * particle is NaN guarded (integrator, round 1: one non finite point drew an 80 px black square
 * through the bloom).
 */
import * as THREE from 'three';

const MAX_KARTS = 8;
const PER_KART = 40;
const FLOATS = 10;                 // x y z vx vy vz life maxLife size rot
const FAR = 120;                   // m from the camera: a kart further off gets no smoke (sub pixel anyway)
const SLIP_MIN = 0.22;             // rad between velocity and heading that counts as a slide outside a drift
const SLIP_SPEED = 7;              // m/s under which nothing slides visibly
const DEFAULT_REAR = [new THREE.Vector3(0.62, 0.29, -0.62), new THREE.Vector3(-0.62, 0.29, -0.62)];
const DEFAULT_FRONT = [new THREE.Vector3(0.62, 0.29, 0.62), new THREE.Vector3(-0.62, 0.29, 0.62)];

const COLOURS = {
  asphalt: new THREE.Color(0xe4dcd0),
  cobble: new THREE.Color(0xe4dcd0),
  pad: new THREE.Color(0xe4dcd0),
  sand: new THREE.Color(0xe6cf9c),
  grass: new THREE.Color(0xc9c59a),
  dirt: new THREE.Color(0xd8c4a0),
};
const COLOUR_DEFAULT = COLOURS.asphalt;

const _p = new THREE.Vector3(), _fw = new THREE.Vector3(), _rt = new THREE.Vector3(), _cp = new THREE.Vector3();
const finite = (v) => Number.isFinite(v);

/** A soft cauliflower puff: a radial falloff with three offset lobes so a rotated point never reads as a disc. */
function puffTexture() {
  const N = 64;
  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, N, N);
  const lobe = (cx, cy, r, a) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,' + a + ')');
    g.addColorStop(0.45, 'rgba(255,255,255,' + (a * 0.55).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
  };
  lobe(N * 0.5, N * 0.5, N * 0.5, 0.9);
  lobe(N * 0.36, N * 0.42, N * 0.3, 0.7);
  lobe(N * 0.62, N * 0.38, N * 0.26, 0.6);
  lobe(N * 0.55, N * 0.66, N * 0.28, 0.6);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class DriftSmoke {
  constructor({ scene, tier = null } = {}) {
    this.scene = scene;
    this.tier = tier;
    this.karts = new Map();          // id -> { view, body, acc, spinT }
    this.n = MAX_KARTS * PER_KART;
    this.state = new Float32Array(this.n * FLOATS);
    this.alive = 0;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.n * 3);
    this.col = new Float32Array(this.n * 3);
    this.size = new Float32Array(this.n);
    this.alpha = new Float32Array(this.n);
    this.rot = new Float32Array(this.n);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('rot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: puffTexture() }, uScale: { value: 400 } },
      vertexShader: `attribute float size; attribute float alpha; attribute float rot;
        varying float vA; varying float vR; varying vec3 vC; uniform float uScale;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        float d = max(0.5, -mv.z);
        gl_PointSize = clamp(size * uScale / d, 0.0, 160.0);
        vA = alpha * clamp(1.0 - d / ${FAR.toFixed(1)}, 0.0, 1.0); vR = rot; vC = color;
        if (!(alpha == alpha) || !(size == size) || !(mv.z == mv.z)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; } }`,
      fragmentShader: `uniform sampler2D uMap; varying float vA; varying float vR; varying vec3 vC;
        void main(){ vec2 c = gl_PointCoord - 0.5; float s = sin(vR), k = cos(vR);
        c = vec2(c.x * k - c.y * s, c.x * s + c.y * k) + 0.5;
        float a = texture2D(uMap, c).a * vA; if (!(a >= 0.004)) discard; a = min(a, 1.0);
        gl_FragColor = vec4(vC, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor = vec4(gl_FragColor.rgb * a, a); }`,   // round 3 (integrator): on the phone tier (direct render) the puffs are tone mapped and encoded like the scene; the composer path leaves both defines off, so the desktop HDR buffer is unchanged (the puffs read as pure white balls on the phone without this)
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.NormalBlending, premultipliedAlpha: true, vertexColors: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.name = 'kart_drift_smoke';
    this.points.renderOrder = 4;   // under the sparks (5)
    this.points.visible = false;
    this.points.castShadow = false; this.points.receiveShadow = false;
    this.head = 0;
    if (scene) scene.add(this.points);
  }

  /** Register a kart. Calling again for the same id replaces the view and body. */
  attach(id, view, body) {
    if (!body) return;
    this.karts.set(id, { view: view || null, body, acc: 0, spinT: 0, wasSpin: false });
  }

  detach(id) { this.karts.delete(id); }

  _spawn(x, y, z, vx, vy, vz, life, size, colour) {
    if (!(finite(x) && finite(y) && finite(z) && finite(vx) && finite(vy) && finite(vz) && finite(life) && finite(size))) return;
    const i = this.head; this.head = (this.head + 1) % this.n;
    const s = this.state, o = i * FLOATS;
    s[o] = x; s[o + 1] = y; s[o + 2] = z; s[o + 3] = vx; s[o + 4] = vy; s[o + 5] = vz;
    s[o + 6] = life; s[o + 7] = life; s[o + 8] = size; s[o + 9] = Math.random() * Math.PI * 2;
    this.col[i * 3] = colour.r; this.col[i * 3 + 1] = colour.g; this.col[i * 3 + 2] = colour.b;
  }

  /** Puffs off one tyre contact point, thrown to the outside of the slide and a little back. */
  _puff(k, at, count, side, strength, colour) {
    const { body, view } = k;
    const o = view ? view.object : null;
    for (let n = 0; n < count; n++) {
      _p.copy(at); _p.y = 0.06;
      if (o) o.localToWorld(_p); else _p.add(body.pos);
      _fw.set(Math.sin(body.heading), 0, Math.cos(body.heading));
      _rt.set(-Math.cos(body.heading), 0, Math.sin(body.heading));   // the kart's right in world space (forward is (sin h, 0, cos h); the kart's +X is its left)
      const out = side * (0.5 + Math.random() * 1.1) * strength;
      const back = -(0.4 + Math.random() * 0.9) * strength;
      const sub = Math.random() * 0.03;
      const vx = body.vel.x * 0.28 + _rt.x * out + _fw.x * back + (Math.random() - 0.5) * 0.4;
      const vz = body.vel.z * 0.28 + _rt.z * out + _fw.z * back + (Math.random() - 0.5) * 0.4;
      const vy = 0.5 + Math.random() * 0.7;
      this._spawn(_p.x - body.vel.x * sub + (Math.random() - 0.5) * 0.12, _p.y + Math.random() * 0.08, _p.z - body.vel.z * sub + (Math.random() - 0.5) * 0.12,
        vx, vy, vz, 0.6 + Math.random() * 0.5, (0.34 + Math.random() * 0.16) * (0.8 + 0.4 * strength), colour);
    }
  }

  update(dt, camera) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.05);
    if (camera) {
      const h = globalThis.innerHeight || 720;
      const fov = camera.fov || 58;
      this.points.material.uniforms.uScale.value = h / (2 * Math.tan(fov * Math.PI / 360));
      _cp.copy(camera.position);
    }
    // emit
    for (const k of this.karts.values()) {
      const b = k.body;
      if (!b || !b.pos || !b.vel) continue;
      const view = k.view;
      if (view && view.object && view.object.visible === false) { k.acc = 0; continue; }
      if (camera && b.pos.distanceTo(_cp) > FAR) { k.acc = 0; continue; }
      const speed = b.speed != null ? Math.abs(b.speed) : Math.hypot(b.vel.x, b.vel.z);
      const grounded = b.grounded !== false;
      const drift = b.drift && b.drift.active && grounded;
      const spinning = b.state === 'spin';
      if (spinning && !k.wasSpin) k.spinT = 0.7;   // a fresh spin out: a burst off all four tyres
      k.wasSpin = spinning;
      let slip = 0;
      if (!drift && grounded && speed > SLIP_SPEED) {
        const vh = Math.atan2(b.vel.x, b.vel.z);
        let a = vh - b.heading; a = Math.atan2(Math.sin(a), Math.cos(a));
        slip = Math.abs(a);
      }
      const sliding = drift || (slip > SLIP_MIN) || (k.spinT > 0 && grounded);
      if (!sliding) { k.acc = 0; continue; }
      const colour = COLOURS[b.surface] || COLOUR_DEFAULT;
      const wheels = view && view.wheels && view.wheels.length >= 4 ? view.wheels : null;
      const rear = wheels ? [wheels[2].at, wheels[3].at] : DEFAULT_REAR;
      const front = wheels ? [wheels[0].at, wheels[1].at] : DEFAULT_FRONT;
      let rate, side, strength;
      if (drift) {
        // + dir is a right hand drift in the steer convention: the smoke goes to the outside (left)
        rate = 30 + 10 * (b.drift.tier || 0) + speed * 0.6;
        side = -(b.drift.dir || 1);
        strength = 0.8 + 0.15 * (b.drift.tier || 0);
      } else if (k.spinT > 0) {
        rate = 60; side = 0; strength = 1.2;
        k.spinT -= dt;
      } else {
        const t = Math.min(1, (slip - SLIP_MIN) / 0.5);
        rate = 8 + 30 * t + speed * 0.3;
        // velocity to the right of the heading: the tyres scrub on the left
        const vh = Math.atan2(b.vel.x, b.vel.z);
        let a = vh - b.heading; a = Math.atan2(Math.sin(a), Math.cos(a));
        side = a > 0 ? -1 : 1;
        strength = 0.5 + 0.6 * t;
      }
      k.acc += dt * rate;
      let n = 0;
      while (k.acc >= 1 && n < 12) {
        k.acc -= 1; n++;
        if (k.spinT > 0 && !drift) { const all = [rear[0], rear[1], front[0], front[1]]; this._puff(k, all[n & 3], 1, (n & 1) ? 1 : -1, strength, colour); }
        else this._puff(k, rear[n & 1], 1, side, strength, colour);
      }
    }
    // integrate
    const s = this.state;
    let alive = 0;
    const drag = Math.pow(0.55, dt);
    for (let i = 0; i < this.n; i++) {
      const o = i * FLOATS;
      let life = s[o + 6];
      if (life <= 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      life -= dt; s[o + 6] = life;
      if (life <= 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      s[o + 3] *= drag; s[o + 5] *= drag; s[o + 4] = s[o + 4] * drag + 0.25 * dt;
      s[o] += s[o + 3] * dt; s[o + 1] += s[o + 4] * dt; s[o + 2] += s[o + 5] * dt;
      const k = 1 - life / s[o + 7];                      // 0 fresh .. 1 gone
      this.pos[i * 3] = s[o]; this.pos[i * 3 + 1] = s[o + 1]; this.pos[i * 3 + 2] = s[o + 2];
      this.size[i] = s[o + 8] * (1 + 2.6 * k);
      const a = (k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88);
      this.alpha[i] = 0.62 * a * a;
      this.rot[i] = s[o + 9] + k * 0.9;
      alive++;
    }
    this.alive = alive;
    this.points.visible = alive > 0;
    if (alive > 0 || this._wasAlive) {
      const g = this.points.geometry;
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
      g.attributes.size.needsUpdate = true; g.attributes.alpha.needsUpdate = true; g.attributes.rot.needsUpdate = true;
    }
    this._wasAlive = alive > 0;
  }

  dispose() {
    if (this.points.parent) this.points.parent.remove(this.points);
    this.points.geometry.dispose();
    this.points.material.uniforms.uMap.value.dispose();
    this.points.material.dispose();
    this.karts.clear();
  }
}
