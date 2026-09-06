/**
 * DRIVE  src/items/items.js  (owner: items)
 *
 * The item system: boxes and roulette, the five original items, projectiles, hazards, shields, boost pad
 * triggers, and the small effects they need (burst particles, espresso speed lines). Built to the
 * signatures in docs/ARCHITECTURE.md; every assumption about the other modules is in work/items/NOTES.md.
 *
 *   const items = new ItemSystem({ scene, world, spline, bodies, views, events, tier, anchors, pads });
 *   await items.load();            // ASSET keepHierarchy + applyMaterials local per item, pooled
 *   items.update(dt);              // boxes, roulette, projectiles, hazards, shields, pads, effects
 *   items.use(id, backwards);      // consumes the held item, emits 'itemUsed' { id, key, backwards }
 *   items.onHit(target, by, key);  // spin out unless shielded; emits 'hit' { target, by, key, shielded }
 *
 * Events emitted (game/events.js names first): 'itemPickup' { id, key: 'roulette' } when a box is taken,
 * 'itemReady' { id, key } when the roulette lands, 'itemUsed' { id, key, backwards }, 'hit' { target, by,
 * key, shielded }, 'boostPad' { id, pad }, 'shieldUp' { id }, 'shieldPop' { id, by, key }, 'shieldEnd'
 * { id }, 'bounce' { key, x, z, n }, 'buoyLock' { target, by }, 'crateDrop', 'crateLand', 'boxTaken'.
 * Events consumed: 'useItem' { id, backwards } from kart/player.js.
 *
 * Draw budget: one draw per material bucket per pooled asset (about 3 for the box, 1 to 2 each for buoy,
 * cannonball, crate and shield) plus one Points and one LineSegments for the effects: about 12 at peak,
 * against the 40 the lead allowed. Nothing here is baked and nothing uses .clone(true) of a merged asset.
 */
import * as THREE from 'three';
import { preloadAssets } from '../../assetlib.js?v=r1-20260906113009';
import { InstancePool, Boxes, Pads, loadItemAsset, assetUrl, INERT_STATES, idOf } from './boxes.js?v=r1-20260906113009';
import { Projectiles } from './projectiles.js?v=r1-20260906113009';
import { Hazards } from './hazards.js?v=r1-20260906113009';

export const ITEMS = {
  buoy:       { asset: 'chaser_buoy',  speed: 34, lock: 60, life: 8,  hit: 'spin' },
  cannonball: { asset: 'cannonball',   speed: 30, bounces: 3, life: 6, hit: 'spin' },
  crate:      { asset: 'spill_crate',  drop: 2,  life: 25, max: 6, hit: 'spin' },
  espresso:   { asset: 'espresso_cup', boost: 10, dur: 2.2 },
  shield:     { asset: 'foam_shield',  dur: 8 },
};
export const ITEM_KEYS = ['buoy', 'cannonball', 'crate', 'espresso', 'shield'];

// index 0 = 1st ... 7 = 8th; weights in ITEM_KEYS order: buoy, cannonball, crate, espresso, shield
export const WEIGHTS_BY_POSITION = [
  [0, 3, 5, 0, 4], [1, 3, 4, 1, 3], [2, 3, 3, 2, 2], [3, 2, 2, 3, 2], [4, 2, 1, 4, 1], [5, 1, 1, 5, 1], [5, 1, 0, 6, 1], [6, 0, 0, 7, 1],
];

/** docs/TRACK-PLAN.md 7.2, the fallback when the level does not hand over its anchors (y = road y, asked of the spline). */
export const ITEM_BOX_ROWS = [
  { x: -139, z: -84 }, { x: -135.6, z: -84 }, { x: -132.2, z: -84 }, { x: -128.8, z: -84 },
  { x: 0, z: -162.5 }, { x: 0, z: -159 }, { x: 0, z: -155.5 },
  { x: 62, z: 50 }, { x: 65.3, z: 50 }, { x: 68.7, z: 50 }, { x: 72, z: 50 },
  { x: -97, z: 110.5 }, { x: -97, z: 114 }, { x: -97, z: 117.5 },
];
/**
 * Second, staggered row behind each planned row (round 1 fix for 0 to 3 pickups per 600 m). The plan's
 * rows are 3 or 4 boxes 3.4 m apart; 8 karts pass a row inside the respawn time, so a mid pack kart met
 * nothing but gaps. Each row gets a second row SECOND_ROW_GAP m further along the racing direction with
 * a box in every gap of the first (n - 1 boxes offset by half the spacing), the double stagger the genre
 * uses. Rows are recognised as anchors within ROW_JOIN m of each other; the along direction is the
 * spline tangent at the row centre; y stays null so Boxes reads spline.roadY under each new box, and a
 * box that would leave the ribbon (roadY NaN) is dropped. Without a spline the anchors pass unchanged.
 */
export const SECOND_ROW_GAP = 4.5;
const ROW_JOIN = 6;
export function staggerRows(anchors, spline) {
  if (!spline || typeof spline.nearest !== 'function' || typeof spline.tangent !== 'function') return anchors.slice();
  const rows = [];
  for (const a of anchors) {
    let row = rows.find((r) => r.some((b) => Math.hypot(b.x - a.x, b.z - a.z) <= ROW_JOIN));
    if (!row) { row = []; rows.push(row); }
    row.push(a);
  }
  const out = anchors.slice();
  const t = new THREE.Vector3();
  for (const row of rows) {
    if (row.length < 2) continue;
    const cx = row.reduce((s, b) => s + b.x, 0) / row.length, cz = row.reduce((s, b) => s + b.z, 0) / row.length;
    const n = spline.nearest(cx, cz);
    if (!n || !Number.isFinite(n.progress)) continue;
    spline.tangent(n.progress, t);
    const len = Math.hypot(t.x, t.z) || 1;
    const ax = (t.x / len) * SECOND_ROW_GAP, az = (t.z / len) * SECOND_ROW_GAP;
    // sort along the row's own axis so the gaps are between neighbours
    const dx = row[row.length - 1].x - row[0].x, dz = row[row.length - 1].z - row[0].z;
    const sorted = row.slice().sort((p, q) => (p.x * dx + p.z * dz) - (q.x * dx + q.z * dz));
    for (let i = 0; i + 1 < sorted.length; i++) {
      const x = (sorted[i].x + sorted[i + 1].x) / 2 + ax, z = (sorted[i].z + sorted[i + 1].z) / 2 + az;
      if (typeof spline.roadY === 'function' && !Number.isFinite(spline.roadY(x, z))) continue;
      out.push({ x, z, y: null, second: true });
    }
  }
  return out;
}
export const BOOST_PAD_ANCHORS = [
  { x: -137, z: -100, rot: 180 }, { x: -131, z: -100, rot: 180 }, { x: 60, z: -155.7, rot: 90 }, { x: 64, z: 30, rot: 0 },
  { x: -90, z: 114, rot: 270 }, { x: -102, z: 114, rot: 270 }, { x: -147, z: 27, rot: 165 },
];

const LEAVE_ONE_RANGE = 70;   // m: an AI leaves a row's last box for an empty handed racer this close behind
                              // (covers the 2 s respawn at the 34 m/s top speed, 68 m: a taker just outside the
                              // range has its box back before the racer behind reaches it)
const LANE_TOL = 2.0;         // m: an AI also leaves the last standing box within this lateral of the player's lane
                              // (inside the 2.1 m reach; at 3.5 the kept box sat 2.7 m outside the player's lane
                              // and the player passed it; the double row has a box every 1.7 m so 2 or 3 qualify)
const ROULETTE_TIME = 1.2;
const ROULETTE_TICK = 0.09;
const _col = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0), _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _c = new THREE.Vector3();
const _q = new THREE.Quaternion(), _e = new THREE.Euler();

/**
 * Two draws of effects for the whole subsystem: a Points cloud for bursts (shield pop, crate spill, splash,
 * bounce chips, buoy hit) and a LineSegments for the espresso speed lines round every boosted kart.
 */
class Effects {
  constructor(scene, { bursts = 24, perBurst = 20, karts = 8, linesPerKart = 18 } = {}) {
    this.perBurst = perBurst;
    this.bursts = [];
    const n = bursts * perBurst;
    this.pPos = new Float32Array(n * 3).fill(-1000);
    this.pCol = new Float32Array(n * 3);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({
      size: 0.16, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.points.name = 'items:bursts';
    this.points.frustumCulled = false;
    for (let i = 0; i < bursts; i++) this.bursts.push({ t: 0, dur: 0, base: i * perBurst, count: 0, origin: new THREE.Vector3(), vel: new Float32Array(perBurst * 3), free: true });

    this.karts = karts;
    this.linesPerKart = linesPerKart;
    const ln = karts * linesPerKart * 2;
    this.lPos = new Float32Array(ln * 3).fill(-1000);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(this.lPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
      color: 0xffc48a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.lines.name = 'items:speedlines';
    this.lines.frustumCulled = false;
    // a fixed ring pattern per line so the streaks do not shimmer
    this.ring = [];
    let seed = 7;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let j = 0; j < linesPerKart; j++) this.ring.push({ a: (j / linesPerKart) * Math.PI * 2 + rnd() * 0.3, r: 1.1 + rnd() * 1.0, ph: rnd() * 3, len: 1.8 + rnd() * 1.6 });
    this.group = new THREE.Group();
    this.group.name = 'items:effects';
    this.group.add(this.points, this.lines);
    this.points.visible = false;   // idle effects draw nothing
    this.lines.visible = false;
    this.linesOn = new Set();
    if (scene) scene.add(this.group);
    this.rng = Math.random;
  }
  get draws() { return 2; }
  get drawsNow() { return (this.points.visible ? 1 : 0) + (this.lines.visible ? 1 : 0); }

  burst(pos, hex, count = 16, speed = 4, dur = 0.5) {
    if (!pos || !(Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z))) return;   // a NaN particle draws a black square
    let b = this.bursts.find((x) => x.free);
    if (!b) { b = this.bursts.reduce((o, x) => (x.t / x.dur > o.t / o.dur ? x : o), this.bursts[0]); }
    b.free = false; b.t = 0; b.dur = dur; b.count = Math.min(count, this.perBurst);
    b.origin.set(pos.x, pos.y, pos.z);
    _col.setHex(hex);
    for (let i = 0; i < this.perBurst; i++) {
      const k = (b.base + i) * 3;
      if (i < b.count) {
        const th = this.rng() * Math.PI * 2, el = this.rng() * 0.9 + 0.2, sp = speed * (0.45 + this.rng() * 0.7);
        b.vel[i * 3] = Math.cos(th) * Math.cos(el) * sp;
        b.vel[i * 3 + 1] = Math.sin(el) * sp;
        b.vel[i * 3 + 2] = Math.sin(th) * Math.cos(el) * sp;
        this.pCol[k] = _col.r; this.pCol[k + 1] = _col.g; this.pCol[k + 2] = _col.b;
      } else {
        this.pPos[k + 1] = -1000;
      }
    }
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  speedLines(index, body, k, age) {
    if (index >= this.karts) return;
    this.linesOn.add(index);
    this.lines.visible = true;
    const heading = Number.isFinite(body.heading) ? body.heading : 0;
    _fwd.set(Math.sin(heading), 0, Math.cos(heading));
    _right.crossVectors(_fwd, _up);
    _c.set(body.pos.x, body.pos.y + 0.7, body.pos.z);
    const stream = age * 26;
    for (let j = 0; j < this.linesPerKart; j++) {
      const r = this.ring[j];
      const o = (index * this.linesPerKart + j) * 6;
      const rad = r.r * (0.85 + 0.15 * k);
      const cx = _c.x + _right.x * Math.cos(r.a) * rad, cz = _c.z + _right.z * Math.cos(r.a) * rad;
      const cy = _c.y + Math.sin(r.a) * rad * 0.65;
      const head = 2.0 - ((stream + r.ph * 1.7) % 3.2);
      const len = r.len * k;
      this.lPos[o] = cx + _fwd.x * head; this.lPos[o + 1] = cy; this.lPos[o + 2] = cz + _fwd.z * head;
      this.lPos[o + 3] = cx + _fwd.x * (head - len); this.lPos[o + 4] = cy; this.lPos[o + 5] = cz + _fwd.z * (head - len);
    }
  }
  hideLines(index) {
    if (index >= this.karts) return;
    const o = index * this.linesPerKart * 6;
    for (let i = 0; i < this.linesPerKart * 6; i++) this.lPos[o + i] = -1000;
    this.linesOn.delete(index);
    if (!this.linesOn.size) this.lines.visible = false;
  }

  update(dt) {
    let live = 0;
    for (const b of this.bursts) {
      if (b.free) continue;
      live++;
      b.t += dt;
      const done = b.t >= b.dur;
      for (let i = 0; i < b.count; i++) {
        const k = (b.base + i) * 3;
        if (done) { this.pPos[k + 1] = -1000; continue; }
        this.pPos[k] = b.origin.x + b.vel[i * 3] * b.t;
        this.pPos[k + 1] = b.origin.y + b.vel[i * 3 + 1] * b.t - 4.5 * b.t * b.t;
        this.pPos[k + 2] = b.origin.z + b.vel[i * 3 + 2] * b.t;
      }
      if (done) { b.free = true; live--; }
    }
    this.points.visible = live > 0;
    this.points.geometry.attributes.position.needsUpdate = true;
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
}

export class ItemSystem {
  /**
   * @param anchors    level.itemBoxAnchors [{ x, y, z }]; falls back to ITEM_BOX_ROWS with y from spline.roadY
   * @param pads       level.padAnchors [{ x, y, z, rot }]; falls back to BOOST_PAD_ANCHORS
   * @param positionOf (id) => 1..8 live race position; falls back to a sort by lap + progress
   * @param rng        () => 0..1 for the roulette, Math.random by default
   * @param playerId   the human's body id (main.js puts the player first in `bodies`, so bodies[0] by default);
   *                   the AI leave the last standing box of a row when an empty handed racer is close behind
   */
  constructor({ scene, world = null, spline = null, bodies = [], views = new Map(), events = null, tier = null,
                anchors = null, pads = null, positionOf = null, rng = Math.random, viewShield = 'auto', playerId = undefined }) {
    this.scene = scene;
    this.world = world;
    this.spline = spline;
    this.bodies = bodies;
    this.views = views || new Map();
    this.events = events;
    this.tier = tier;
    this.anchors = anchors;
    this.padAnchors = pads;
    this.positionOf = positionOf;
    this.playerId = playerId !== undefined ? playerId : (bodies.length ? idOf(bodies[0], 0) : 1);
    this.rng = rng;
    this.viewShield = viewShield;
    this.held = new Map();
    this.roulette = new Map();     // id -> { t, shown, tick }
    this.shields = new Map();      // id -> { t, slot, index }
    this.espresso = new Map();     // id -> { t, age }
    this.used = new Map();
    this.hits = new Map();
    this.dealt = new Map();
    this.pools = {};
    this.loaded = false;
    this.missing = [];
    this.effects = new Effects(scene, { karts: Math.max(8, bodies.length) });
    if (events && typeof events.on === 'function') {
      events.on('useItem', (p) => { if (p && p.id !== undefined) this.use(p.id, !!p.backwards); });
    }
  }

  /** Preload the five item assets plus item_box and boost_pad, build the pools, the boxes and the pads. */
  async load() {
    const names = ['item_box', ...ITEM_KEYS.map((k) => ITEMS[k].asset)];
    const protos = {};
    // sub metre items read their surface at half the tile; the 2.4 m shield shell at the full tile
    const detailOf = (n) => (n === 'foam_shield' ? 1 : 0.5);
    await Promise.all(names.map(async (n) => { protos[n] = await loadItemAsset(n, { detail: detailOf(n) }); if (!protos[n]) this.missing.push(n); }));
    // the level places boost_pad and shows espresso_cup through kartview; warming the merged cache costs nothing
    await preloadAssets([assetUrl('boost_pad')]);

    let anchors = this.anchors;
    if (!anchors || !anchors.length) anchors = ITEM_BOX_ROWS.map((r) => ({ x: r.x, z: r.z, y: null }));
    anchors = staggerRows(anchors, this.spline);   // the level's rows plus a staggered second row each
    let pads = this.padAnchors;
    if (!pads || !pads.length) pads = BOOST_PAD_ANCHORS.map((p) => ({ ...p, y: null }));

    const n = Math.max(8, this.bodies.length);
    this.pools.item_box = new InstancePool(protos.item_box, anchors.length, { name: 'item_box' });
    this.pools.chaser_buoy = new InstancePool(protos.chaser_buoy, 8, { name: 'chaser_buoy' });
    this.pools.cannonball = new InstancePool(protos.cannonball, 8, { name: 'cannonball' });
    this.pools.spill_crate = new InstancePool(protos.spill_crate, ITEMS.crate.max, { name: 'spill_crate' });
    this.pools.foam_shield = new InstancePool(protos.foam_shield, n, { name: 'foam_shield', castShadow: false });
    for (const p of Object.values(this.pools)) if (this.scene) this.scene.add(p.group);

    this.boxes = new Boxes({
      scene: this.scene, anchors, bodies: this.bodies, events: this.events, pool: this.pools.item_box, spline: this.spline,
      onPickup: (body, index, box) => this.pickup(body, index, box),
    });
    this.pads = new Pads({ anchors: pads, bodies: this.bodies, events: this.events });
    const onHit = (target, by, key) => this.onHit(target, by, key);
    this.projectiles = new Projectiles({
      scene: this.scene, world: this.world, spline: this.spline, bodies: this.bodies, events: this.events, onHit, effects: this.effects,
      pools: { buoy: this.pools.chaser_buoy, cannonball: this.pools.cannonball },
      specs: { buoy: { speed: ITEMS.buoy.speed, lock: ITEMS.buoy.lock, life: ITEMS.buoy.life }, cannonball: { speed: ITEMS.cannonball.speed, bounces: ITEMS.cannonball.bounces, life: ITEMS.cannonball.life } },
    });
    this.hazards = new Hazards({
      scene: this.scene, world: this.world, spline: this.spline, bodies: this.bodies, events: this.events, onHit, effects: this.effects,
      pool: this.pools.spill_crate, max: ITEMS.crate.max, life: ITEMS.crate.life, drop: ITEMS.crate.drop, rng: this.rng,
    });
    this.loaded = true;
    return this;
  }

  /** Draw calls this subsystem adds to a frame at most (every pool live, effects on). */
  get draws() {
    let d = this.effects.draws;
    for (const p of Object.values(this.pools)) d += p.draws;
    return d;
  }
  /** Draw calls this frame (idle pools and idle effects are invisible). */
  get drawsNow() {
    let d = this.effects.drawsNow;
    for (const p of Object.values(this.pools)) d += p.drawsNow;
    return d;
  }

  bodyOf(id) {
    for (let i = 0; i < this.bodies.length; i++) if (idOf(this.bodies[i], i) === id) return this.bodies[i];
    return null;
  }
  indexOf(id) {
    for (let i = 0; i < this.bodies.length; i++) if (idOf(this.bodies[i], i) === id) return i;
    return -1;
  }
  viewOf(id) {
    if (!this.views) return null;
    if (typeof this.views.get === 'function') return this.views.get(id) || null;
    return this.views[id] || null;
  }

  /** Live race position 1..n for a racer: the game's callback, else a sort by lap + progress. */
  position(id) {
    if (typeof this.positionOf === 'function') {
      const p = this.positionOf(id);
      if (Number.isFinite(p) && p >= 1) return p;
    }
    const order = this.bodies.map((b, i) => ({ id: idOf(b, i), r: (b && Number.isFinite(b.lap) ? b.lap : 0) + (b && Number.isFinite(b.progress) ? b.progress : 0) }));
    order.sort((a, b) => b.r - a.r);
    const k = order.findIndex((o) => o.id === id);
    return k < 0 ? this.bodies.length : k + 1;
  }

  /**
   * Box touched: only a kart holding nothing takes it, and an AI kart leaves the LAST standing box of a row
   * when a racer holding nothing is within LEAVE_ONE_RANGE m behind it (the eight karts leave the grid as
   * one pack and reach the first row inside the respawn time, so without this a mid pack player met only
   * gaps: round 1 measured 0 to 3 pickups per 600 m). When that racer is the player, the AI also leaves
   * the last standing box within LANE_TOL m of the player's lane: the pack is within a second of each
   * other at the first row, and a box left at the far end of the row was passing 4 m outside the player's
   * 2.1 m reach (round 1 touch run: 1 pickup in 600 m with every box in the player's lane down). The player
   * is never refused a box.
   */
  pickup(body, index, box = null) {
    const id = idOf(body, index);
    if (this.held.get(id)) return false;
    if (box && id !== this.playerId && this.boxes) {
      if (this.boxes.liveInRow(box) <= 1 && this.emptyHandedBehind(body, id)) return false;
      const p = this.playerBehind(body);
      if (p && this.boxes.liveNearLane(box, p.pos.x, p.pos.z, LANE_TOL) <= 1) return false;
    }
    this.held.set(id, 'roulette');
    this.roulette.set(id, { t: ROULETTE_TIME, shown: ITEM_KEYS[Math.floor(this.rng() * ITEM_KEYS.length)], tick: 0 });
    this.setHeldView(id, 'roulette');
    this.emit('itemPickup', { id, key: 'roulette' });
    return true;
  }

  /** True when a live racer other than `id` that holds nothing is within LEAVE_ONE_RANGE m and behind `body`. */
  emptyHandedBehind(body, id) {
    const fx = Math.sin(body.heading || 0), fz = Math.cos(body.heading || 0);
    for (let i = 0; i < this.bodies.length; i++) {
      const o = this.bodies[i];
      if (!o || o === body || !o.pos || INERT_STATES.has(o.state)) continue;
      const oid = idOf(o, i);
      if (oid === id || this.held.get(oid)) continue;
      const dx = o.pos.x - body.pos.x, dz = o.pos.z - body.pos.z;
      if (dx * dx + dz * dz > LEAVE_ONE_RANGE * LEAVE_ONE_RANGE) continue;
      if (dx * fx + dz * fz < 0) return true;
    }
    return false;
  }

  /** The player's body when the player holds nothing and is within LEAVE_ONE_RANGE m behind `body`, else null. */
  playerBehind(body) {
    if (this.held.get(this.playerId)) return null;
    for (let i = 0; i < this.bodies.length; i++) {
      const o = this.bodies[i];
      if (!o || o === body || !o.pos || idOf(o, i) !== this.playerId || INERT_STATES.has(o.state)) continue;
      const dx = o.pos.x - body.pos.x, dz = o.pos.z - body.pos.z;
      if (dx * dx + dz * dz > LEAVE_ONE_RANGE * LEAVE_ONE_RANGE) return null;
      return dx * Math.sin(body.heading || 0) + dz * Math.cos(body.heading || 0) < 0 ? o : null;
    }
    return null;
  }

  /** The key the HUD shows while the roulette spins (cycles every 90 ms), else the held key. */
  rouletteKey(id) {
    const r = this.roulette.get(id);
    return r ? r.shown : (this.held.get(id) || null);
  }

  rollFor(id) {
    const pos = THREE.MathUtils.clamp(Math.round(this.position(id)), 1, WEIGHTS_BY_POSITION.length);
    const w = WEIGHTS_BY_POSITION[pos - 1];
    let total = 0;
    for (const x of w) total += x;
    if (total <= 0) return 'espresso';
    let r = this.rng() * total;
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return ITEM_KEYS[i]; }
    return ITEM_KEYS[w.length - 1];
  }

  /** Debug and AI helper: hand a racer an item directly (also `?item=` on the dev path via main.js). */
  give(id, key) {
    if (!ITEMS[key]) return false;
    this.roulette.delete(id);
    this.held.set(id, key);
    this.setHeldView(id, key);
    this.emit('itemReady', { id, key });
    return true;
  }

  setHeldView(id, key) {
    const v = this.viewOf(id);
    if (v && typeof v.setItemHeld === 'function') { try { v.setItemHeld(key); } catch { /* the view is optional here */ } }
  }

  emit(name, payload) { if (this.events && typeof this.events.emit === 'function') this.events.emit(name, payload); }

  /** Consumes the held item. Returns true when something was used. */
  use(id, backwards = false) {
    const key = this.held.get(id);
    if (!key || key === 'roulette') return false;
    const body = this.bodyOf(id);
    if (!body || INERT_STATES.has(body.state)) return false;
    if (backwards === undefined || backwards === null) backwards = !!(body.input && body.input.throttle < 0);
    this.held.set(id, null);
    this.setHeldView(id, null);
    this.used.set(id, (this.used.get(id) || 0) + 1);
    switch (key) {
      case 'buoy':
      case 'cannonball':
        this.projectiles.fire(key, body, !!backwards);
        break;
      case 'crate':
        this.hazards.drop('crate', body);
        break;
      case 'espresso':
        if (typeof body.applyBoost === 'function') body.applyBoost(ITEMS.espresso.boost, ITEMS.espresso.dur);
        this.espresso.set(id, { t: ITEMS.espresso.dur, age: 0 });
        break;
      case 'shield':
        this.shieldOn(id, body);
        break;
      default:
        break;
    }
    this.emit('itemUsed', { id, key, backwards: !!backwards });
    return true;
  }

  shieldOn(id, body) {
    const had = this.shields.get(id);
    const index = this.indexOf(id);
    const view = this.viewOf(id);
    const useView = this.viewShield === true || (this.viewShield === 'auto' && view && typeof view.setShield === 'function');
    let slot = had ? had.slot : -1;
    if (!useView && slot < 0) slot = this.pools.foam_shield.acquire();
    this.shields.set(id, { t: ITEMS.shield.dur, slot, index, view: !!useView });
    body.shielded = true;
    if (useView) { try { view.setShield(true); } catch { /* optional */ } }
    if (!had) this.effects.burst(body.pos, 0xbfe8f0, 12, 2.5, 0.4);
    this.emit('shieldUp', { id });
  }

  shieldOff(id, popped = false) {
    const s = this.shields.get(id);
    if (!s) return;
    this.shields.delete(id);
    const body = this.bodyOf(id);
    if (body) body.shielded = false;
    if (s.view) { const v = this.viewOf(id); if (v && typeof v.setShield === 'function') { try { v.setShield(false); } catch { /* optional */ } } }
    if (s.slot >= 0) this.pools.foam_shield.release(s.slot);
    if (!popped) this.emit('shieldEnd', { id });
  }

  /** A projectile or hazard reached a racer: pop the shield or spin the kart. */
  onHit(targetId, byId, key) {
    const body = this.bodyOf(targetId);
    if (!body) return false;
    if (INERT_STATES.has(body.state) || body.state === 'spin') return false;
    if ((Number.isFinite(body.invuln) && body.invuln > 0) || body.invulnerable === true) return false;
    const shielded = !!(this.shields.has(targetId) || body.shielded);
    if (shielded) {
      this.shieldOff(targetId, true);
      this.effects.burst({ x: body.pos.x, y: body.pos.y + 0.6, z: body.pos.z }, 0xbfe8f0, 20, 6, 0.6);
      this.emit('shieldPop', { id: targetId, by: byId, key });
      this.emit('hit', { target: targetId, by: byId, key, shielded: true });
      return true;
    }
    if (typeof body.spinOut === 'function') body.spinOut();
    this.hits.set(targetId, (this.hits.get(targetId) || 0) + 1);
    if (byId !== undefined && byId !== null && byId !== targetId) this.dealt.set(byId, (this.dealt.get(byId) || 0) + 1);
    this.emit('hit', { target: targetId, by: byId, key, shielded: false });
    return true;
  }

  /** Is a buoy homing on this racer (ai/racer.js raises the shield on this). */
  lockedOn(id) { return this.projectiles ? this.projectiles.lockedOn(id) : false; }

  /** 0..1 espresso speed line intensity for a racer, for post.setSpeedLines on the player. */
  speedLines(id) {
    const e = this.espresso.get(id);
    if (!e) return 0;
    return THREE.MathUtils.clamp(Math.min(e.age / 0.25, e.t / 0.4), 0, 1);
  }

  countHits(id) { return this.hits.get(id) || 0; }
  countUsed(id) { return this.used.get(id) || 0; }
  countDealt(id) { return this.dealt.get(id) || 0; }

  update(dt) {
    if (!this.loaded) return;
    dt = Math.min(dt, 0.05);
    this.boxes.update(dt);
    // roulette timers
    for (const [id, r] of this.roulette) {
      r.t -= dt;
      r.tick += dt;
      if (r.tick >= ROULETTE_TICK) { r.tick = 0; r.shown = ITEM_KEYS[Math.floor(this.rng() * ITEM_KEYS.length)]; }
      if (r.t <= 0) {
        const key = this.rollFor(id);
        this.roulette.delete(id);
        this.held.set(id, key);
        this.setHeldView(id, key);
        this.emit('itemReady', { id, key });
      }
    }
    this.projectiles.update(dt);
    this.hazards.update(dt);
    this.pads.update(dt);
    // shields: timers and the pooled shell following its kart
    for (const [id, s] of this.shields) {
      s.t -= dt;
      const body = this.bodyOf(id);
      if (s.t <= 0 || !body) { this.shieldOff(id); continue; }
      if (s.slot >= 0) {
        const h = this.pools.foam_shield.size.y || 2.4;
        _q.setFromEuler(_e.set(0, s.t * 0.9, Math.sin(s.t * 2.1) * 0.08));
        this.pools.foam_shield.place(s.slot, body.pos.x, body.pos.y + 0.5 - h / 2, body.pos.z, 0, 1, _q);
      }
    }
    // espresso speed lines
    for (const [id, e] of this.espresso) {
      e.t -= dt; e.age += dt;
      const index = this.indexOf(id), body = this.bodyOf(id);
      if (e.t <= 0 || !body) { this.espresso.delete(id); if (index >= 0) this.effects.hideLines(index); continue; }
      if (index >= 0) this.effects.speedLines(index, body, this.speedLines(id), e.age);
    }
    this.effects.update(dt);
  }

  /** Back to the grid: everything cleared, boxes restored, counters zeroed. */
  reset() {
    this.held.clear();
    this.roulette.clear();
    for (const id of [...this.shields.keys()]) this.shieldOff(id);
    for (const [id] of this.espresso) { const i = this.indexOf(id); if (i >= 0) this.effects.hideLines(i); }
    this.espresso.clear();
    this.used.clear(); this.hits.clear(); this.dealt.clear();
    if (this.projectiles) this.projectiles.clear();
    if (this.hazards) this.hazards.clear();
    if (this.boxes) { this.boxes.reset(); this.boxes.taken = 0; }
    if (this.pads) { this.pads.reset(); this.pads.triggers = 0; }
    for (const b of this.bodies) if (b) b.shielded = false;
  }

  /** Diagnostics for telemetry and the gate. */
  stats() {
    return {
      draws: this.draws, drawsNow: this.drawsNow, missing: [...this.missing],
      boxesTaken: this.boxes ? this.boxes.taken : 0, padTriggers: this.pads ? this.pads.triggers : 0,
      fired: this.projectiles ? this.projectiles.fired : 0, bounces: this.projectiles ? this.projectiles.bounces : 0,
      dropped: this.hazards ? this.hazards.dropped : 0,
      projectiles: this.projectiles ? this.projectiles.count : 0, crates: this.hazards ? this.hazards.count : 0,
      shields: this.shields.size,
    };
  }
}
