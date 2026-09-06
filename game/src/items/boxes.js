/**
 * DRIVE  src/items/boxes.js  (owner: items)
 *
 * Item boxes and boost pad triggers, plus the two helpers every other items file uses:
 *
 *   loadItemAsset(name)   ASSET('./assets/<name>.js', { keepHierarchy: true }) then
 *                         applyMaterials(inst, { asset, local: true }) so the PATINA surface travels
 *                         with the part. A missing asset file is a console.warn naming it and a null;
 *                         the caller keeps its logic running with nothing drawn, never a stand in box.
 *   InstancePool          one keepHierarchy prototype becomes N GPU instances: one InstancedMesh per
 *                         material bucket, so 14 boxes cost 3 draws instead of 42 and the whole items
 *                         subsystem stays under 40 draws at peak. Local triplanar projection reads the
 *                         un-instanced `transformed` position (refs/rust17/materials.js TRI_VS), so
 *                         every copy wears the same surface as the prototype. The pool is never baked
 *                         and never walked by a loader, so the InstancedMesh trap in recipe/docs/traps.md
 *                         does not apply; the prototype's own InstancedMesh parts ARE expanded here.
 *                         The shared TriplanarMaterial turns its local normal into a world normal with
 *                         modelMatrix alone, which is right for a kart (one Object3D per kart) and wrong
 *                         for an InstancedMesh copy that spins or rolls: the lit side would stay fixed in
 *                         the world while the box turned. The pool therefore uses ONE clone of each shared
 *                         triplanar material with the instance rotation carried into the normal (a varying
 *                         mat3 from instanceMatrix), under its own program cache key. An idle pool (nothing
 *                         acquired) is invisible, so it costs no draw at all.
 *
 * Boxes: spinning bobbing item_box instances at the level's anchors (plus the staggered second row
 * items.js adds behind each row), standing on one corner as they float 0.5 m above the road. A box is
 * taken when the kart's BODY touches it: box radius 1.4 m plus the kart half width (KART.radius 0.7 m,
 * or the body's own `radius`), so 2.1 m from the box centre. Respawn 2.0 s after a pickup (round 1: at
 * 4 s the pack ahead stripped every row and the player found nothing but gaps, 0 to 3 pickups in 600 m).
 * Boxes within ROW_RADIUS m of each other form a row (`row` on each box); `liveInRow(box)` counts the
 * row's standing boxes so items.js can keep the last one for an empty handed racer close behind, and
 * `liveNearLane(box, x, z, tol)` counts the row's standing boxes within tol m of the lane a kart at (x, z)
 * is in (lateral across the road, from the spline normal at the row centre) so items.js can keep one
 * IN THE PLAYER'S LANE: the whole pack reaches the first row inside a second of each other, and a box
 * left at the far end of the row is no use to a kart 2.1 m wide. Pads: 3 x 4 m trigger volumes
 * at the level's pad anchors, applyBoost(9, 1.4) with a 0.5 s per kart re trigger lock. The pad
 * asset itself is placed and baked by the level; only the trigger lives here.
 */
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { ASSET } from '../../assetlib.js?v=r4-20260906171652';
import { applyMaterials } from '../render/materials.js?v=r4-20260906171652';

const HIDDEN = new THREE.Matrix4().makeScale(1e-6, 1e-6, 1e-6).setPosition(0, -1000, 0);
const _m = new THREE.Matrix4(), _im = new THREE.Matrix4(), _q = new THREE.Quaternion();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();

/** './assets/<name>.js' relative to game/index.html, stamped when publish.sh set a build stamp. */
export function assetUrl(name) {
  const stamp = (typeof window !== 'undefined' && window.__BUILD_STAMP__) ? `?v=${window.__BUILD_STAMP__}` : '';
  return `./assets/${name}.js${stamp}`;
}

/**
 * Load one item prototype the way ARCHITECTURE.md rule 3 says every mover loads: keepHierarchy per
 * instance, then the render module's local material projection. Returns null (after a warning that
 * names the asset) when the file is not there yet, so the build still returns.
 */
export async function loadItemAsset(name, { detail = 1, unify = false } = {}) {
  const url = assetUrl(name);
  const inst = await ASSET(url, { keepHierarchy: true });
  let meshes = 0;
  inst.traverse((o) => { if (o.isMesh) meshes++; });
  if (!meshes) {
    console.warn(`[items] asset missing, skipped: ${name} (${url}) - its item runs invisible until the asset lands`);
    return null;
  }
  try {
    // local projection so the surface travels with the part; detail 0.5 on the sub metre items because a
    // 1.5 to 2.5 m tile across a 0.5 m buoy is one flat colour; unify off so a crate keeps timber AND ice
    applyMaterials(inst, { asset: name, local: true, unify, detail });
  } catch (e) {
    console.warn(`[items] applyMaterials failed on ${name}, flat colours kept: ${e.message}`);
  }
  return inst;
}

const POOL_MATERIALS = new Map();   // shared triplanar material -> its instance aware clone
const INST_ROT_VS = `
#ifdef USE_INSTANCING
  vInstRot = mat3( instanceMatrix );
#else
  vInstRot = mat3( 1.0 );
#endif`;

/**
 * The pool's copy of a shared triplanar material: identical, except the fragment's local to world normal
 * goes through the instance rotation too. Anything that is not triplanar (glass, emissive cores, rubber,
 * flat colours when no set loaded) is used as it is; a plain MeshStandardMaterial already handles
 * instancing correctly.
 */
export function poolMaterial(mat) {
  if (!mat || !mat.isTriplanar) return mat;
  let c = POOL_MATERIALS.get(mat);
  if (c) return c;
  c = mat.clone();
  c.name = mat.name;
  const proto = Object.getPrototypeOf(c);
  c.onBeforeCompile = function (shader, renderer) {
    proto.onBeforeCompile.call(this, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('varying vec3 vTriNrm;', 'varying vec3 vTriNrm;\nvarying mat3 vInstRot;')
      .replace('vTriNrm = mix( triN, objectNormal, uTriLocal );', 'vTriNrm = mix( triN, objectNormal, uTriLocal );' + INST_ROT_VS);
    shader.fragmentShader = shader.fragmentShader
      .replace('varying vec3 vTriNrm;', 'varying vec3 vTriNrm;\nvarying mat3 vInstRot;')
      .replace('normalize( mat3( modelMatrix ) * triN )', 'normalize( mat3( modelMatrix ) * ( vInstRot * triN ) )');
  };
  c.customProgramCacheKey = () => 'drive_tri_pool';
  c.userData.poolClone = true;
  POOL_MATERIALS.set(mat, c);
  return c;
}

/** Same normalisation assetlib uses before a merge: de-index, keep the shared attributes only. */
function mergeParts(geos) {
  if (geos.length === 1) return geos[0];
  const plain = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let common = null;
  for (const g of plain) {
    const names = new Set(Object.keys(g.attributes));
    common = common ? new Set([...common].filter((n) => names.has(n))) : names;
  }
  if (!common || !common.has('position')) return null;
  for (const g of plain) {
    for (const name of Object.keys(g.attributes)) if (!common.has(name)) g.deleteAttribute(name);
    g.morphAttributes = {};
    g.clearGroups();
  }
  try { return BufferGeometryUtils.mergeGeometries(plain, false); } catch { return null; }
}

export class InstancePool {
  /**
   * @param proto   a loaded keepHierarchy instance after applyMaterials, or null (an empty pool that
   *                accepts slots and draws nothing, for an asset that has not landed)
   * @param capacity number of slots
   */
  constructor(proto, capacity, { castShadow = true, name = '' } = {}) {
    this.name = name;
    this.capacity = capacity;
    this.parts = [];
    this.group = new THREE.Group();
    this.group.name = `items:${name}`;
    this.free = [];
    for (let i = capacity - 1; i >= 0; i--) this.free.push(i);
    this.active = new Set();
    this.size = new THREE.Vector3(1, 1, 1);
    if (!proto) return;

    proto.updateMatrixWorld(true);
    const rootInv = new THREE.Matrix4().copy(proto.matrixWorld).invert();
    const buckets = new Map();   // material -> geometries in prototype space
    const push = (mat, g) => { if (!buckets.has(mat)) buckets.set(mat, []); buckets.get(mat).push(g); };
    proto.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.length !== 1) return;
      const rel = new THREE.Matrix4().multiplyMatrices(rootInv, o.matrixWorld);
      if (o.isInstancedMesh) {
        // the prototype's own instances live in its matrices, not its geometry (traps.md)
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, _im);
          const g = o.geometry.clone();
          g.applyMatrix4(_im);
          g.applyMatrix4(rel);
          push(mats[0], g);
        }
        return;
      }
      const g = o.geometry.clone();
      g.applyMatrix4(rel);
      push(mats[0], g);
    });
    const box = new THREE.Box3();
    for (const [mat, geos] of buckets) {
      const geo = mergeParts(geos);
      if (!geo) continue;
      geo.computeBoundingBox();
      box.union(geo.boundingBox);
      const mesh = new THREE.InstancedMesh(geo, poolMaterial(mat), capacity);
      mesh.name = `items:${name}:${mat.name || 'part'}`;
      mesh.frustumCulled = false;          // instance bounds are not the geometry bounds; never cull the pool
      mesh.castShadow = castShadow;
      mesh.receiveShadow = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < capacity; i++) mesh.setMatrixAt(i, HIDDEN);
      mesh.instanceMatrix.needsUpdate = true;
      this.parts.push(mesh);
      this.group.add(mesh);
    }
    if (!box.isEmpty()) box.getSize(this.size);
    this.group.visible = false;   // nothing acquired yet: an idle pool draws nothing
  }
  /** Draw calls at peak (every part drawn once the pool has anything acquired). */
  get draws() { return this.parts.length; }
  /** Draw calls this frame. */
  get drawsNow() { return this.group.visible ? this.parts.length : 0; }
  get empty() { return this.parts.length === 0; }
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
    for (const p of this.parts) { p.setMatrixAt(slot, matrix); p.instanceMatrix.needsUpdate = true; }
  }
  /** Convenience: position, yaw about +Y, optional full quaternion and uniform scale. */
  place(slot, x, y, z, yaw = 0, scale = 1, quaternion = null) {
    if (quaternion) _q.copy(quaternion); else _q.setFromEuler(_e.set(0, yaw, 0));
    _p.set(x, y, z);
    _s.setScalar(scale);
    _m.compose(_p, _q, _s);
    this.set(slot, _m);
  }
  hide(slot) { this.set(slot, HIDDEN); }
  releaseAll() { for (const s of [...this.active]) this.release(s); }
}

/** The kart states during which a body neither takes a box nor takes a hit. */
export const INERT_STATES = new Set(['fall', 'respawn', 'finished', 'countdown']);

export function idOf(body, index = 0) {
  return body && body.id !== undefined && body.id !== null ? body.id : index;
}

const ROW_RADIUS = 12;   // m: boxes closer than this belong to one row (a planned row plus its staggered second row)
const _spin = new THREE.Quaternion();
const _centre = new THREE.Matrix4();

export class Boxes {
  /**
   * @param anchors  Array<{ x, y, z }> from level.itemBoxAnchors. level/build.js hands the box BASE height
   *                 (road under the anchor plus 0.5 m); a raw road height (within 0.3 m of spline.roadY) or a
   *                 null y gets the 0.5 m float added here, so both conventions land the box 0.5 m up.
   * @param onPickup (body, index, box) => boolean   true when the kart took the box (it held nothing and
   *                 was allowed the box); box is the entry of `boxes` with x, z, base, row, down, scale
   *
   * The pool draws the box with its base at y = 0 and `pool.size.y` tall (itembox.js: a 1.2 m block, or the
   * item_box asset through an InstancePool). Round 3: the box stands UPRIGHT and spins about its vertical
   * axis through its centre with a small lean that precesses, and it floats FLOAT_HEIGHT (0.12 m) over the
   * road instead of 0.5 m, so under the 12 degree sun its shadow starts under its own footprint (the critic's
   * round 3 "tilted and floating off the road"). The level hands the box base as road plus 0.5 m; the road
   * height is read from the spline here and the level's offset is ignored whenever the spline has the road.
   */
  constructor({ scene, anchors = [], bodies = [], events = null, pool = null, spline = null, onPickup = null,
                radius = 1.4, kartRadius = 0.7, respawn = 2.0, floatHeight = 0.12, spinRate = 2.0, lean = 0.10, bob = 0.05 }) {
    this.scene = scene;
    this.bodies = bodies;
    this.events = events;
    this.pool = pool || new InstancePool(null, anchors.length, { name: 'item_box' });
    this.onPickup = onPickup;
    this.radius = radius;           // the box's own reach from its centre
    this.kartRadius = kartRadius;   // added per body (body.radius when it has one): the body touching the box counts
    this.respawn = respawn;
    this.spinRate = spinRate;
    this.floatHeight = floatHeight; // m, the box base over the road (the contact blob lies at base minus this)
    this.lean = lean;               // rad, the precessing lean of the spinning block
    this.bob = bob;                 // m, the bob amplitude
    this.time = 0;
    this.taken = 0;   // telemetry: boxes taken this race
    if (scene && this.pool.group.parent !== scene) scene.add(this.pool.group);
    this.half = (Number.isFinite(this.pool.size.y) && this.pool.size.y > 0 ? this.pool.size.y : 1.2) / 2;
    this.boxes = anchors.map((a, i) => {
      const given = typeof a.y === 'number' && Number.isFinite(a.y) ? a.y : NaN;
      let ry = NaN;
      if (spline && typeof spline.roadY === 'function') ry = spline.roadY(a.x, a.z);
      let base;
      if (Number.isFinite(ry)) base = ry + floatHeight;
      else if (Number.isFinite(given)) base = given - 0.5 + floatHeight;   // off the ribbon: the level's road plus 0.5 convention
      else base = floatHeight;
      return { x: a.x, z: a.z, base, row: -1, slot: this.pool.acquire(), phase: i * 0.7, spin: i * 0.9, down: 0, scale: 1 };
    });
    // rows: a box joins the row of the first box within ROW_RADIUS of it (both planned rows and the staggered second rows)
    let rows = 0;
    for (const b of this.boxes) {
      const near = this.boxes.find((o) => o.row >= 0 && Math.hypot(o.x - b.x, o.z - b.z) <= ROW_RADIUS);
      b.row = near ? near.row : rows++;
    }
    this.rows = rows;
    // each row's lateral axis (unit, across the road) and centre, so a kart's lane can be compared with a box's:
    // the spline normal at the row centre when there is a spline, else the line through the row's outermost boxes
    this.rowAxes = [];
    for (let r = 0; r < rows; r++) {
      const members = this.boxes.filter((b) => b.row === r);
      const cx = members.reduce((s, b) => s + b.x, 0) / members.length, cz = members.reduce((s, b) => s + b.z, 0) / members.length;
      let ax = NaN, az = NaN;
      if (spline && typeof spline.nearest === 'function' && typeof spline.at === 'function') {
        const n = spline.nearest(cx, cz);
        const q = n && Number.isFinite(n.progress) ? spline.at(n.progress) : null;
        if (q && Number.isFinite(q.nx) && Number.isFinite(q.nz)) { ax = q.nx; az = q.nz; }
      }
      if (!Number.isFinite(ax)) {
        let far = members[0], fd = -1;
        for (const b of members) { const d = Math.hypot(b.x - cx, b.z - cz); if (d > fd) { fd = d; far = b; } }
        const len = Math.hypot(far.x - cx, far.z - cz) || 1;
        ax = (far.x - cx) / len; az = (far.z - cz) / len;
      }
      this.rowAxes.push({ cx, cz, ax, az });
      for (const b of members) b.lat = (b.x - cx) * ax + (b.z - cz) * az;
    }
  }

  /** Lateral (m across the road) of world (x, z) in the frame of `box`'s row. */
  lateralOf(box, x, z) {
    const a = this.rowAxes[box.row];
    return a ? (x - a.cx) * a.ax + (z - a.cz) * a.az : 0;
  }

  /** Standing boxes in the row of `box` within `tol` m (lateral) of the lane a kart at (x, z) is in, `box` included. */
  liveNearLane(box, x, z, tol = 3.5) {
    const lat = this.lateralOf(box, x, z);
    let n = 0;
    for (const b of this.boxes) if (b.row === box.row && !(b.down > 0) && Math.abs(b.lat - lat) <= tol) n++;
    return n;
  }

  /** Standing boxes (not down; a box popping back in counts) in the row of `box`, `box` itself included. */
  liveInRow(box) {
    let n = 0;
    for (const b of this.boxes) if (b.row === box.row && !(b.down > 0)) n++;
    return n;
  }

  update(dt) {
    this.time += dt;
    for (const b of this.boxes) {
      if (b.down > 0) {
        b.down -= dt;
        if (b.down > 0) continue;
        b.down = 0;
        b.scale = 0.01;   // pops back in over 0.3 s
      }
      if (b.scale < 1) b.scale = Math.min(1, b.scale + dt / 0.3);
      b.spin += this.spinRate * dt;
      const bob = Math.sin(this.time * 2.2 + b.phase) * this.bob;
      // upright, spinning about the vertical axis through its centre, a small lean that precesses with the spin
      const t = this.time * 1.1 + b.phase;
      _spin.setFromEuler(_e.set(Math.sin(t) * this.lean, b.spin, Math.cos(t) * this.lean, 'YXZ'));
      _p.set(b.x, b.base + bob + this.half, b.z);
      _s.setScalar(b.scale);
      _m.compose(_p, _spin, _s);
      _centre.makeTranslation(0, -this.half, 0);   // the pool's block has its base at 0: centre it before the spin
      _m.multiply(_centre);
      this.pool.set(b.slot, _m);
      if (typeof this.pool.setAlpha === 'function') this.pool.setAlpha(b.slot, b.scale);
      // the contact blob lies on the road under the box (base is road plus floatHeight), 2 cm up to clear the ribbon
      if (typeof this.pool.setContact === 'function') this.pool.setContact(b.slot, b.x, b.base - this.floatHeight + 0.02, b.z, b.scale);
      // a box is takeable the moment it is back: the 0.3 s pop in is cosmetic (round 1: the pop in
      // added to the 2 s respawn was exactly the window a kart 50 m behind the taker arrived in)
      for (let i = 0; i < this.bodies.length; i++) {
        const body = this.bodies[i];
        if (!body || !body.pos || INERT_STATES.has(body.state)) continue;
        const dx = body.pos.x - b.x, dz = body.pos.z - b.z;
        const reach = this.radius + (Number.isFinite(body.radius) ? body.radius : this.kartRadius);
        if (dx * dx + dz * dz > reach * reach) continue;
        if (Math.abs(body.pos.y - b.base) > 2.5) continue;
        if (this.onPickup && !this.onPickup(body, i, b)) continue;
        b.down = this.respawn;
        this.pool.hide(b.slot);
        this.taken++;
        if (this.events && this.events.emit) this.events.emit('boxTaken', { id: idOf(body, i), x: b.x, z: b.z });
        break;
      }
    }
  }

  reset() { for (const b of this.boxes) { b.down = 0; b.scale = 1; } }
}

export class Pads {
  /**
   * @param anchors Array<{ x, y, z, rot }> from level.padAnchors. rot is degrees when any anchor's |rot|
   *                exceeds 2 pi (the track plan is in degrees), radians otherwise.
   */
  constructor({ anchors = [], bodies = [], events = null, boost = 9, dur = 1.4, lock = 0.5, width = 3, length = 4, margin = 0.4 }) {
    this.bodies = bodies;
    this.events = events;
    this.boost = boost;
    this.dur = dur;
    this.lock = lock;
    this.hw = width / 2 + margin;
    this.hl = length / 2 + margin;
    const degrees = anchors.some((a) => Math.abs(a.rot || 0) > Math.PI * 2 + 1e-6);
    this.pads = anchors.map((a) => {
      const yaw = degrees ? THREE.MathUtils.degToRad(a.rot || 0) : (a.rot || 0);
      return { x: a.x, y: typeof a.y === 'number' ? a.y : null, z: a.z, cos: Math.cos(yaw), sin: Math.sin(yaw), locks: new Map() };
    });
    this.triggers = 0;   // telemetry
  }

  update(dt) {
    for (let p = 0; p < this.pads.length; p++) {
      const pad = this.pads[p];
      for (const [k, t] of pad.locks) { const left = t - dt; if (left <= 0) pad.locks.delete(k); else pad.locks.set(k, left); }
      for (let i = 0; i < this.bodies.length; i++) {
        const body = this.bodies[i];
        if (!body || !body.pos || INERT_STATES.has(body.state)) continue;
        const dx = body.pos.x - pad.x, dz = body.pos.z - pad.z;
        if (dx * dx + dz * dz > 30) continue;
        // world to pad local: the pad's long axis is its local +Z, rotated by yaw about +Y
        const lx = dx * pad.cos - dz * pad.sin;
        const lz = dx * pad.sin + dz * pad.cos;
        if (Math.abs(lx) > this.hw || Math.abs(lz) > this.hl) continue;
        if (pad.y !== null && Math.abs(body.pos.y - pad.y) > 1.5) continue;
        const id = idOf(body, i);
        if (pad.locks.has(id)) continue;
        pad.locks.set(id, this.lock);
        if (typeof body.applyBoost === 'function') body.applyBoost(this.boost, this.dur);
        this.triggers++;
        if (this.events && this.events.emit) this.events.emit('boostPad', { id, pad: p });
      }
    }
  }

  reset() { for (const pad of this.pads) pad.locks.clear(); }
}
