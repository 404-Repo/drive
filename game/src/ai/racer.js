/**
 * AIRacer: one AI driver for one KartBody.
 *
 * The AI drives through the SAME KartBody as the player: it only writes body.input
 * (throttle, steer, hop, item) every frame, so physics, drift tiers, boosts, spins and
 * respawns are identical for every kart on the grid. Nothing here moves a kart directly.
 *
 * Steering is pure pursuit on the spline: the target is spline.point(progress + lookAhead,
 * targetLateral) with lookAhead = 12 m + 0.6 x speed. The lateral target is the racer's
 * personal offset (-3.5 to +3.5 m) pulled 2.5 m to the inside of the coming corner from entry
 * to apex and to the outside on the exit, plus overtaking and blocking shifts.
 *
 * Speed is planned from the road ahead: at every table row within braking distance the
 * allowed speed is sqrt(9.5 x radius) scaled by skill, and the speed the kart may carry NOW
 * is the smallest sqrt(allowed^2 + 2 x decel x distance). That is a real brake point, not
 * a reaction to the corner it is already in.
 *
 * Curvature is computed HERE from the spline tangents (right turn positive) so this file
 * does not depend on the track module's sign convention for `curvature`.
 *
 * Signature per docs/ARCHITECTURE.md:
 *   new AIRacer({ id, name, body, spline, personality, events })
 *   update(dt, ctx)   ctx = { racers: KartBody[], player: KartBody, items: ItemSystem, time }
 */
import * as THREE from 'three';

/** Defaults matching KART in src/kart/physics.js; pass `kart` to the constructor to override. */
export const KART_DEFAULTS = {
  vmax: 24,
  brake: 16,
  driftTiers: [{ t: 1.1 }, { t: 2.2 }, { t: 3.4 }],
  radius: 0.7,
};

/**
 * The seven named AI racers. Fixed seeds: the field is the same every race. ids follow the
 * style lock livery table (1 is the player, Rafa). Liveries repeated here so main.js can
 * build KartView from this table alone.
 */
export const PERSONALITIES = [
  { id: 2, name: 'Bastian',  offset: -1.0, skill: 0.98, aggression: 0.90, itemDelay: 0.7,
    livery: { body: 0x2f5fc4, suit: 0x2f5fc4, helmet: 0xf1e6d2, stripe: 0x2f5fc4 } },
  { id: 3, name: 'Suvi',   offset:  3.0, skill: 0.88, aggression: 0.50, itemDelay: 1.4,
    livery: { body: 0xf2c230, suit: 0x3a3f46, helmet: 0xf2c230, stripe: 0xf2c230 } },
  { id: 4, name: 'Ingrid', offset: -2.5, skill: 1.00, aggression: 0.30, itemDelay: 1.0,
    livery: { body: 0x3fc7a0, suit: 0xf1e6d2, helmet: 0x3fc7a0, stripe: 0x3fc7a0 } },
  { id: 5, name: 'Nadir',  offset:  1.0, skill: 0.94, aggression: 0.80, itemDelay: 0.6,
    livery: { body: 0x7a4fc9, suit: 0x7a4fc9, helmet: 0xf1e6d2, stripe: 0x7a4fc9 } },
  { id: 6, name: 'Halle',   offset: -3.5, skill: 0.92, aggression: 0.60, itemDelay: 0.9,
    livery: { body: 0xf07a2a, suit: 0xf1e6d2, helmet: 0xf07a2a, stripe: 0xf07a2a } },
  { id: 7, name: 'Vito',   offset:  2.0, skill: 0.90, aggression: 0.20, itemDelay: 1.5,
    livery: { body: 0x1f8fa0, suit: 0x3a3f46, helmet: 0x1f8fa0, stripe: 0x1f8fa0 } },
  { id: 8, name: 'Zola',    offset:  3.5, skill: 0.86, aggression: 0.70, itemDelay: 1.2,
    livery: { body: 0xf1e6d2, suit: 0xed5851, helmet: 0xf1e6d2, stripe: 0xed5851 } },
];

// Tuning. Every number the lead named is here under its name.
const LOOK_BASE = 12;          // m
const LOOK_PER_SPEED = 0.6;    // m per m/s
const CORNER_G = 9.5;          // v = sqrt(CORNER_G x radius)
const INSIDE_PULL = 2.5;       // m toward the inside on entry, the outside on exit
const DRIFT_RADIUS = 22;       // m: a corner tighter than this is drifted
const DRIFT_SWEEP_DEG = 55;    // a corner that turns more than this over 40 m is drifted too
const DRIFT_SWEEP_RADIUS = 48; // ... if its radius is under this
const DRIFT_MIN_SPEED = 12;    // m/s
/**
 * Tunables exposed for A/B in the test page (mutable on purpose; the shipped values are these).
 *   driftSpeedBonus: a drift's yaw is not grip limited, so the corner speed is x this while a
 *     drift is held (kart feel target: 14 m/s drifting vs 9 gripping on the 12 m hairpin).
 *   driftStartMaxOver: no drift starts while the kart is more than this x its planned speed.
 *     Physics cuts braking to 15% in the hop, so hopping at 33 m/s off the cliff road pads into
 *     the lighthouse descent lost 0.35 s of braking and put a kart in the sea. Brake first.
 */
export const TUNING = { driftSpeedBonus: 1.18, driftStartMaxOver: 1.15 };
const OVERTAKE_RANGE = 8;      // m behind a slower kart
const OVERTAKE_LATERAL = 2;    // m: only when we are lined up behind it
const OVERTAKE_HOLD = 2;       // s
const OVERTAKE_GAP = 2.4;      // m: pass this far beside the other kart
const BLOCK_RANGE = 12;        // m: a follower this close is blocked by an aggressive leader
const BLOCK_LATERAL = 4;       // m
const BRAKE_PLAN_DECEL = 9;    // m/s^2 used for brake points (the kart can do 16; margin)
const PLAN_AHEAD = 70;         // m of road scanned for the speed plan
const LATERAL_RATE = 3.0;      // m/s: how fast the lateral target may move
const EDGE_MARGIN = 1.0;       // m kept from the road edge
const STUCK_SPEED = 0.8;       // m/s
const STUCK_TIME = 1.5;        // s
const REVERSE_TIME = 1.0;      // s
const SPIN_RECOVER = 0.4;      // s of no throttle after a spin
const STEER_GAIN = 2.2;        // steer = clamp(angleToTarget x gain)
const CROSS_GAIN = 0.3;        // steer per metre of lateral error (pure pursuit cuts corners by itself)
const CROSS_MAX = 0.8;
const LATERAL_DAMP = 0.12;     // steer per m/s of lateral velocity
const CUT_COMP_MAX = 3.5;      // m: cap on the pursuit corner cut compensation
const DRIFT_START_ERROR = 2.0; // m: no drift starts while the kart is this far off its line
const CORNER_EDGE_EXTRA = 1.6;  // m more edge margin in a tight corner (the pursuit cuts inside on its own)
const HOLD_ITEM_MAX = 14;      // s: use whatever we hold after this even without a target
const BLOCK_HOLD = 1.5;        // s of blocking ...
const BLOCK_REST = 2.5;        // ... then this long back on the racing line (a blocker who never drifts loses)

const TWO_PI = Math.PI * 2;
const wrapAngle = (a) => { a = (a + Math.PI) % TWO_PI; if (a < 0) a += TWO_PI; return a - Math.PI; };
const wrap01 = (p) => { p %= 1; return p < 0 ? p + 1 : p; };
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const moveToward = (v, target, maxStep) => (v < target ? Math.min(target, v + maxStep) : Math.max(target, v - maxStep));

/** Lap length from whatever the spline exposes; 1061 (the plan) as the last resort. */
export function lapLengthOf(spline) {
  const cands = [spline?.lapLength, spline?.length, spline?.LAP_LENGTH];
  for (const c of cands) if (typeof c === 'number' && c > 100) return c;
  const s = spline?.samples;
  if (Array.isArray(s) && s.length > 2) {
    const last = s[s.length - 1];
    const first = s[0];
    if (typeof last.s === 'number') return last.s + Math.hypot(last.x - first.x, last.z - first.z);
  }
  return 1061;
}

/**
 * Per spline cache of signed curvature (right turn positive), width and section, every
 * `step` metres. Shared by all racers on the same spline. Built from spline.at() so it
 * works for any spline that honours the documented signature.
 */
const TRACK_CACHE = new WeakMap();

/**
 * Runtime guard for the steer sign. The documented convention is steer +1 = right, heading
 * (ccw positive) decreasing. If the kart module ships the other sign every AI would spin in
 * circles, so the racers pool evidence (commanded steer vs observed heading change while
 * gripping) over the first second of driving and flip once if it points the other way.
 */
export const STEER_GUARD = { sign: -1, evidence: 0, frames: 0, decided: false };
function observeSteer(steer, dHeading, speed) {
  const g = STEER_GUARD;
  if (g.decided || Math.abs(steer) < 0.3 || speed < 3) return;
  // With sign -1 a positive steer should make the heading DEcrease: expected dh has the sign of (sign x steer).
  g.evidence += Math.sign(g.sign * steer) * dHeading;
  g.frames++;
  if (g.frames >= 40 && Math.abs(g.evidence) > 0.6) {
    if (g.evidence < 0) { g.sign = -g.sign; console.warn('[ai] steer sign convention is inverted; flipped to', g.sign); }
    g.decided = true;
  }
}

/** Multiplier from the internal steer (+1 = right) to the body's convention. */
const steerOut = () => (STEER_GUARD.sign === -1 ? 1 : -1);

export function trackTable(spline) {
  let t = TRACK_CACHE.get(spline);
  if (t) return t;
  const L = lapLengthOf(spline);
  // Lateral sign: the contract says positive to the RIGHT of travel. Check it once against the tangent.
  let latSign = 1;
  try {
    const s0 = spline.at(0.25, {});
    const p0 = spline.point(0.25, 0, new THREE.Vector3());
    const p1 = spline.point(0.25, 1, new THREE.Vector3());
    const rx = -s0.tz, rz = s0.tx;                           // right of travel
    if ((p1.x - p0.x) * rx + (p1.z - p0.z) * rz < 0) { latSign = -1; console.warn('[ai] spline lateral is positive to the LEFT; compensating'); }
  } catch (e) { /* keep the documented convention */ }
  const step = 1.5;
  const n = Math.max(16, Math.round(L / step));
  const ds = L / n;
  const tx = new Float32Array(n), tz = new Float32Array(n);
  const width = new Float32Array(n);
  const section = new Array(n);
  const tmp = {};
  for (let i = 0; i < n; i++) {
    const p = i / n;
    const s = spline.at(p, tmp) || tmp;
    let ax = s.tx, az = s.tz;
    if (typeof ax !== 'number' || typeof az !== 'number') {
      const t3 = spline.tangent(p, new THREE.Vector3());
      ax = t3.x; az = t3.z;
    }
    const len = Math.hypot(ax, az) || 1;
    tx[i] = ax / len; tz[i] = az / len;
    width[i] = typeof s.width === 'number' ? s.width : 11;
    section[i] = typeof s.section === 'string' ? s.section.trim().charAt(0).toUpperCase() : '';
  }
  // Signed curvature from the tangent change over one step, smoothed with its neighbours.
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross = tx[i] * tz[j] - tz[i] * tx[j];       // > 0 when the next tangent is to the RIGHT
    const dot = tx[i] * tx[j] + tz[i] * tz[j];
    raw[i] = Math.atan2(cross, dot) / ds;
  }
  const curv = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let k = -2; k <= 2; k++) acc += raw[(i + k + n) % n];
    curv[i] = acc / 5;
  }
  t = { L, n, ds, curv, width, section, tx, tz, latSign };
  TRACK_CACHE.set(spline, t);
  return t;
}

export class AIRacer {
  constructor({ id, name, body, spline, personality, events = null, kart = null }) {
    this.id = id;
    this.name = name || `AI ${id}`;
    this.body = body;
    this.spline = spline;
    this.events = events;
    this.kart = Object.assign({}, KART_DEFAULTS, kart || {});
    const p = personality || PERSONALITIES[(id - 2 + PERSONALITIES.length) % PERSONALITIES.length];
    this.personality = {
      offset: clamp(p.offset ?? 0, -3.5, 3.5),
      skill: clamp(p.skill ?? 0.9, 0.85, 1.0),
      aggression: clamp(p.aggression ?? 0.5, 0, 1),
      itemDelay: clamp(p.itemDelay ?? 1.0, 0.6, 1.5),
    };
    this.track = trackTable(spline);
    this.L = this.track.L;

    // Set by the Director every frame: multiplier on the speed cap (1 = none).
    this.rubber = 1;
    this.position = 0;

    this.t = 0;
    this.reaction = 0.08 + (1 - this.personality.skill) * 1.6;   // s after GO before the throttle
    this.goTime = null;
    this.lateralTarget = this.personality.offset;
    this.overtake = null;      // { lateral, until }
    this.block = null;         // { lateral, until }
    this.dodge = null;         // { lateral, until }
    this.drift = { want: false, dir: 0, since: 0, cooldownUntil: 0, tierGoal: 1, counterFor: 0 };
    this.recoverUntil = 0;
    this.prevState = body?.state || 'race';
    this.stuckFor = 0;
    this.reverseUntil = 0;
    this.hint = -1;
    this.lateralVel = 0;
    this.prevLateral = 0;
    this.prevHeading = body?.heading || 0;
    this.blockRestUntil = 0;
    this.baseTarget = this.personality.offset;
    this._nearest = null;
    this.pose = { progress: 0, lateral: 0 };
    this.heldKey = null;
    this.heldSince = 0;
    this.usedHeld = false;
    this.stats = { drifts: 0, maxTier: 0, overtakes: 0, blocks: 0, items: {}, reverses: 0 };
    this.debug = {};

    this._target = new THREE.Vector3();
    this._sample = {};
    this._steerSignGuard = { sum: 0, n: 0 };
  }

  /* ------------------------------------------------------------------ helpers */

  /** Progress in [0,1) measured from the start line rather than waypoint 0. */
  static rel(progress, start) { return wrap01(progress - start); }

  /** Metres from this racer to another along the track, in (-L/2, L/2]; positive = ahead. */
  aheadMetres(other) {
    const d = wrap01(this.progressOf(other) - this.pose.progress);
    const m = d * this.L;
    return m > this.L / 2 ? m - this.L : m;
  }

  /**
   * Progress and lateral (right positive) for a body. Uses the body's own fields when the kart
   * module publishes them, else asks the spline, with a per racer hint for the search.
   */
  poseOf(b, out = { progress: 0, lateral: 0 }) {
    const ls = this.track.latSign;
    if (typeof b.progress === 'number' && typeof b.lateral === 'number') {
      out.progress = wrap01(b.progress); out.lateral = ls * b.lateral; return out;
    }
    const nr = this.spline.nearest(b.pos.x, b.pos.z, b === this.body ? this.hint : -1);
    if (b === this.body) this.hint = nr.index;
    out.progress = wrap01(nr.progress); out.lateral = ls * nr.lateral; return out;
  }
  lateralOf(b) { return this.poseOf(b, this._tmpPose || (this._tmpPose = {})).lateral; }
  progressOf(b) { return this.poseOf(b, this._tmpPose || (this._tmpPose = {})).progress; }

  rowAt(progress) { return ((Math.floor(wrap01(progress) * this.track.n) % this.track.n) + this.track.n) % this.track.n; }
  curvAt(progress) { return this.track.curv[this.rowAt(progress)]; }
  widthAt(progress) { return this.track.width[this.rowAt(progress)]; }

  /** Absolute turn angle (radians) and minimum radius over [from, from + metres]. */
  cornerAhead(fromProgress, metres) {
    const tr = this.track;
    const rows = Math.max(1, Math.round(metres / tr.ds));
    const r0 = this.rowAt(fromProgress);
    let sweep = 0, signed = 0, maxK = 0;
    for (let i = 0; i < rows; i++) {
      const k = tr.curv[(r0 + i) % tr.n];
      sweep += Math.abs(k) * tr.ds;
      signed += k * tr.ds;
      if (Math.abs(k) > maxK) maxK = Math.abs(k);
    }
    return { sweep, signed, minRadius: maxK > 1e-4 ? 1 / maxK : Infinity };
  }

  sectionAt(progress) {
    const sp = this.spline;
    if (typeof sp.sectionAt === 'function') {
      const s = sp.sectionAt(progress);
      if (typeof s === 'string' && s) return s.trim().charAt(0).toUpperCase();
    }
    return this.track.section[this.rowAt(progress)] || '';
  }

  /* ------------------------------------------------------------------ update */

  update(dt, ctx = {}) {
    const b = this.body;
    if (!b || !b.input) return;
    this.t += dt;
    const inp = b.input;
    inp.item = false;

    let state = b.state || 'race';
    // A race module that freezes bodies without a 'countdown' body state can say so through ctx.
    if (state === 'race' && ((typeof ctx.countdown === 'number' && ctx.countdown > 0) || ctx.racing === false)) state = 'countdown';
    // Transitions: leaving a spin costs 0.4 s of no throttle; a respawn resets the plan.
    if (this.prevState !== state) {
      if (this.prevState === 'spin') this.recoverUntil = this.t + SPIN_RECOVER;
      if (this.prevState === 'respawn' || this.prevState === 'fall') {
        this.overtake = null; this.block = null; this.dodge = null;
        this.drift.want = false; this.drift.cooldownUntil = this.t + 1.0;
        this.lateralTarget = this.personality.offset;
        this.stuckFor = 0; this.reverseUntil = 0;
      }
      this.prevState = state;
    }

    if (state === 'countdown' || state === 'spin' || state === 'fall' || state === 'respawn' || state === 'finished') {
      this.poseOf(b, this.pose);
      this.prevHeading = b.heading || 0;
      inp.throttle = state === 'finished' ? 0.35 : 0;   // finished karts roll on gently
      inp.steer = state === 'finished' ? this.pursuitSteer(this.personality.offset) * steerOut() : 0;
      this.prevSteer = undefined;
      inp.hop = false;
      this.goTime = null;
      this.debug.mode = state;
      return;
    }
    if (this.goTime === null) this.goTime = this.t;

    const speed = b.speed || 0;
    this.poseOf(b, this.pose);
    const progress = this.pose.progress;
    const lat = this.pose.lateral;
    const halfW = this.widthAt(progress) / 2;
    this.lateralVel = lerp(this.lateralVel, (lat - this.prevLateral) / Math.max(1e-3, dt), 0.5);
    this.prevLateral = lat;
    // Steer sign evidence from the last frame's command (grip states only).
    if (state === 'race' && this.prevSteer !== undefined) observeSteer(this.prevSteer, wrapAngle((b.heading || 0) - this.prevHeading), speed);
    this.prevHeading = b.heading || 0;
    const lookAhead = LOOK_BASE + LOOK_PER_SPEED * Math.max(0, speed);
    const pLook = wrap01(progress + lookAhead / this.L);

    // Everyone on track, deduplicated, without me.
    const others = this.collectOthers(ctx);

    /* ---- lateral target: offset + corner pull + overtake + block + dodge ---- */
    let target = this.personality.offset + this.cornerPull(pLook);
    this.baseTarget = target;
    this.updateOvertake(others, halfW);
    this.updateBlock(others, halfW, pLook);
    this.updateDodge(ctx, others, halfW);
    if (this.overtake && this.t < this.overtake.until) target = this.overtake.lateral; else this.overtake = null;
    if (this.block && this.t < this.block.until) target = lerp(target, this.block.lateral, 0.7 * this.personality.aggression);
    else if (this.block) { this.block = null; this.blockRestUntil = this.t + BLOCK_REST; }
    if (this.dodge && this.t < this.dodge.until) target = this.dodge.lateral; else this.dodge = null;
    const tightness = clamp(Math.abs(this.curvAt(pLook)) * 45, 0, 1);   // 1 from radius 45 m down
    const edge = Math.max(0.5, halfW - EDGE_MARGIN - this.kart.radius - CORNER_EDGE_EXTRA * tightness);
    target = clamp(target, -edge, edge);
    this.lateralTarget = moveToward(this.lateralTarget, target, LATERAL_RATE * dt);

    /* ---- speed plan ----
     * corner: the speed the road ahead allows (brake points), scaled by skill and the band.
     * cap: vmax x rubber. Physics enforces its own cap, so the AI only lifts for the band when
     * the band is BELOW vmax; over the cap on a boost (pad, espresso, mini turbo) it keeps the
     * throttle down and lets the over speed decay on its own, it never brakes a boost away. */
    const boosting = (b.boost || 0) > 0;
    const cap = this.kart.vmax * this.rubber;
    const bandCap = this.rubber < 1 ? cap : Infinity;
    const corner = this.planSpeed(progress);
    const planned = boosting ? corner : Math.min(corner, bandCap, this.kart.vmax * Math.max(1, this.rubber));

    /* ---- steering ---- */
    let steer = this.pursuitSteer(this.lateralTarget, pLook);

    /* ---- drift ---- */
    const drifting = this.updateDrift(progress, speed, state, steer, corner);
    if (this.drift.want) {
      // The hop needs steer held toward the corner to lock the drift. Inside the drift the
      // pursuit steer passes through IN FULL (counter steer widens the arc; clamping it ran
      // every kart off the inside kerb in the first test); only a dead straight wheel gets a
      // nudge toward the drift side so the drift is not cancelled by a zero steer.
      // During the hop: follow the line, but with at least a third of the lock toward the
      // corner so the landing reads as a drift that way. Full lock here threw karts across
      // the road in the first test.
      // Physics re-reads the drift side from the steer sign on EVERY hop frame until it lands,
      // and on the 16% lighthouse descent the hop lands late; a fixed 0.4 s of forced steer let a
      // pursuit correction flip a right drift to a left one and put Suvi in the sea. Hold the
      // side until the drift is locked (or the 0.7 s lock failure releases it).
      const locked = !!(b.drift && b.drift.active);
      if (!locked) steer = this.drift.dir * Math.max(0.35, steer * this.drift.dir);
      else if (Math.abs(steer) < 0.08) steer = 0.08 * this.drift.dir;
      // Track how long we have been at full counter steer: the drift is tighter than the corner.
      if (steer * this.drift.dir < -0.9) this.drift.counterFor += dt; else this.drift.counterFor = 0;
    }

    /* ---- throttle ---- */
    let throttle;
    const sinceGo = this.t - this.goTime;
    if (sinceGo < this.reaction) throttle = 0;
    else if (this.t < this.recoverUntil) throttle = 0;
    else if (speed > corner * 1.08) throttle = -1;                     // brake for the corner
    else if (speed > corner * 1.0) throttle = 0;                       // coast down to it
    else if (!boosting && speed > bandCap * 1.02) throttle = 0;        // over the band cap: lift
    else if (!boosting && speed > planned * 0.97) throttle = 0.5;
    else throttle = 1;
    if (drifting && throttle < 0.6 && speed < corner * 1.15) throttle = 0.6;   // a drift needs drive
    // Off the road and still sliding AWAY from it (grass or sand on the outside of a corner):
    // brake until the slide stops, then the pursuit steer brings the kart back. Holding the
    // throttle here carried a kart 10 m across the beach into the sea.
    const offRoad = b.onRoad === false || (b.onRoad === undefined && Math.abs(lat) > halfW + 0.3);
    if (offRoad && Math.abs(lat) > halfW + 1.0 && Math.sign(this.lateralVel) === Math.sign(lat) && Math.abs(this.lateralVel) > 1.5 && speed > 4) {
      throttle = -1; this.drift.want = false;
      this.stats.offRoadBrakes = (this.stats.offRoadBrakes || 0) + 1;
    }

    /* ---- stuck against a wall: back out ---- */
    if (this.t < this.reverseUntil) {
      throttle = -1; steer = -steer;
    } else {
      if (Math.abs(speed) < STUCK_SPEED && throttle > 0.5 && sinceGo > 2) this.stuckFor += dt; else this.stuckFor = 0;
      if (this.stuckFor > STUCK_TIME) {
        this.stuckFor = 0; this.reverseUntil = this.t + REVERSE_TIME; this.stats.reverses++;
        this.drift.want = false;
      }
    }

    inp.throttle = clamp(throttle, -1, 1);
    inp.steer = clamp(steer, -1, 1) * steerOut();   // internal steer is +1 = right, heading decreasing
    this.prevSteer = inp.steer;
    inp.hop = this.drift.want;

    /* ---- items ---- */
    this.updateItems(ctx, others, progress, speed);

    // Documented assumption: KartBody honours body.rubber as a multiplier on its speed cap.
    b.rubber = this.rubber;

    this.debug.mode = drifting ? 'drift' : (this.overtake ? 'overtake' : (this.block ? 'block' : 'race'));
    this.debug.planned = planned;
    this.debug.lateralTarget = this.lateralTarget;
    this.debug.steer = inp.steer;
    this.debug.throttle = inp.throttle;
  }

  collectOthers(ctx) {
    const out = [];
    const seen = new Set([this.body]);
    const push = (o) => { if (o && !seen.has(o) && o.id !== this.id) { seen.add(o); out.push(o); } };
    if (Array.isArray(ctx.racers)) for (const r of ctx.racers) push(r && r.body ? r.body : r);
    push(ctx.player);
    return out;
  }

  /**
   * +2.5 m to the inside of the coming corner from entry to apex, to the outside on the exit.
   * When the NEXT corner turns the other way the exit stays on the current inside instead:
   * that is the outside of the next corner, the side you set up from. Without it a right
   * hairpin into a left sweeper delivered every kart onto the left kerb.
   */
  cornerPull(pLook) {
    const k = this.curvAt(pLook);
    const kBefore = Math.abs(this.curvAt(pLook - 6 / this.L));
    const kAfter = Math.abs(this.curvAt(pLook + 6 / this.L));
    const mag = Math.abs(k);
    if (mag < 1 / 120) {
      // On a straight: drift toward the outside of the next corner so the entry has room.
      const next = this.cornerAhead(pLook, 45);
      if (next.minRadius < 60 && Math.abs(next.signed) > THREE.MathUtils.degToRad(25)) {
        return -Math.sign(next.signed) * INSIDE_PULL * 0.6;
      }
      return 0;
    }
    const strength = clamp(mag * 45, 0, 1);               // full pull from radius 45 m down
    // entry: curvature still rising ahead; exit: falling. Apex sits between.
    const phase = clamp((kAfter - kBefore) / Math.max(1e-4, mag) * 4, -1, 1);
    const inside = Math.sign(k);                          // right turn => inside is +lateral (right)
    if (phase < 0) {
      const next = this.cornerAhead(pLook + 12 / this.L, 40);
      const opposite = Math.sign(next.signed) === -inside && Math.abs(next.signed) > THREE.MathUtils.degToRad(20);
      if (opposite) return INSIDE_PULL * inside * (-phase) * strength;   // stay on this inside for the next entry
    }
    return INSIDE_PULL * inside * phase * strength;
  }

  updateOvertake(others, halfW) {
    if (this.overtake && this.t < this.overtake.until) return;
    const b = this.body;
    const me = this.pose.lateral;
    for (const o of others) {
      const d = this.aheadMetres(o);
      if (d <= 0.5 || d > OVERTAKE_RANGE) continue;
      const ol = this.lateralOf(o);
      if (Math.abs(ol - me) > OVERTAKE_LATERAL) continue;
      if ((o.speed || 0) > (b.speed || 0) + 0.5) continue;   // it is pulling away, no pass
      const roomLeft = ol + halfW, roomRight = halfW - ol;
      const side = roomRight > roomLeft ? 1 : -1;
      const gap = OVERTAKE_GAP + 0.6 * this.personality.aggression;
      this.overtake = { lateral: ol + side * gap, until: this.t + OVERTAKE_HOLD, targetId: o.id };
      this.stats.overtakes++;
      return;
    }
  }

  /** Aggressive leaders mirror the lateral of a follower within 12 m on straights. */
  updateBlock(others, halfW, pLook) {
    if (this.personality.aggression <= 0.6) return;
    if (this.block && this.t < this.block.until) return;
    if (this.t < this.blockRestUntil) return;
    if (this.drift.want) return;
    if (Math.abs(this.curvAt(pLook)) > 1 / 60) return;    // never block into a corner
    const me = this.pose.lateral;
    for (const o of others) {
      const d = this.aheadMetres(o);
      if (d >= -0.5 || d < -BLOCK_RANGE) continue;
      if ((o.speed || 0) < (this.body.speed || 0) - 1) continue;   // not closing: nothing to block
      const ol = this.lateralOf(o);
      if (Math.abs(ol - me) > BLOCK_LATERAL) continue;
      this.block = { lateral: ol, until: this.t + BLOCK_HOLD };
      this.stats.blocks++;
      return;
    }
  }

  /** Steer round a dropped hazard sitting in our lane within 18 m (if the item system exposes them). */
  updateDodge(ctx, others, halfW) {
    if (this.dodge && this.t < this.dodge.until) return;
    const list = hazardList(ctx.items);
    if (!list || !list.length) return;
    const b = this.body;
    const fx = Math.sin(b.heading || 0), fz = Math.cos(b.heading || 0);
    for (const h of list) {
      const p = h.pos || h.position || h;
      if (typeof p.x !== 'number') continue;
      const dx = p.x - b.pos.x, dz = p.z - b.pos.z;
      const ahead = dx * fx + dz * fz;
      if (ahead < 2 || ahead > 18) continue;
      const side = -dx * fz + dz * fx;                    // + when the hazard is on our right
      if (Math.abs(side) > 1.6) continue;
      const me = this.pose.lateral;
      const dir = side > 0 ? -1 : 1;                      // go the other way
      let lat = me + dir * 2.2;
      if (Math.abs(lat) > halfW - EDGE_MARGIN) lat = me - dir * 2.2;
      this.dodge = { lateral: lat, until: this.t + 1.2 };
      return;
    }
  }

  /**
   * Smallest speed we may carry now so every corner within braking distance is takeable.
   * Infinity on a straight (the caller applies the cap). The band scales corner speeds too:
   * an AI behind the player corners up to 10% faster (v^2/R stays under the 13 m/s^2 grip in
   * physics), an AI ahead corners slower, so the band shows even where physics ignores it.
   */
  planSpeed(progress, cap = Infinity) {
    const tr = this.track;
    const skill = this.personality.skill * clamp(this.rubber, 0.85, 1.10) * (this.drift.want ? TUNING.driftSpeedBonus : 1);
    const r0 = this.rowAt(progress);
    const rows = Math.round(PLAN_AHEAD / tr.ds);
    let best = cap;
    for (let i = 0; i <= rows; i++) {
      const k = Math.abs(tr.curv[(r0 + i) % tr.n]);
      if (k < 1e-4) continue;
      const allowed = Math.sqrt(CORNER_G / k) * skill;
      if (allowed >= best) continue;
      const d = i * tr.ds;
      const now = Math.sqrt(allowed * allowed + 2 * BRAKE_PLAN_DECEL * d);
      if (now < best) best = now;
    }
    return Math.max(6, best);
  }

  /**
   * Pure pursuit: steer toward spline.point(pLook, lateral). Returns -1..1, +1 = right.
   * A pursuit point L metres ahead on a curve of radius R makes the kart cut R(1 - cos(L/2R))
   * inside the line (3 m on the chicane), so the point is pushed that far to the outside:
   * the kart then tracks the line it was given instead of the chord.
   */
  pursuitSteer(lateral, pLook = null) {
    const b = this.body;
    const speed = b.speed || 0;
    const look = LOOK_BASE + LOOK_PER_SPEED * Math.max(0, speed);
    if (pLook === null) pLook = wrap01((b.progress || 0) + look / this.L);
    const k = this.curvAt(pLook);
    const mag = Math.abs(k);
    let aim = lateral;
    if (mag > 1e-4) {
      const R = 1 / mag;
      const cut = Math.min(CUT_COMP_MAX, R * (1 - Math.cos(Math.min(1.4, look / (2 * R)))));
      const halfW = this.widthAt(pLook) / 2;
      aim = clamp(lateral - Math.sign(k) * cut, -(halfW - this.kart.radius), halfW - this.kart.radius);
    }
    const tgt = this.spline.point(pLook, this.track.latSign * aim, this._target);
    const dx = tgt.x - b.pos.x, dz = tgt.z - b.pos.z;
    const want = Math.atan2(dx, dz);                     // heading 0 faces +Z, ccw from above
    const delta = wrapAngle(want - (b.heading || 0));    // > 0 means turn left (ccw)
    // steer +1 is RIGHT (heading decreasing), so a left turn is a negative steer.
    // Cross track feedback: a kart sitting right of its line (lateral > target) steers left.
    const cross = clamp(-(this.pose.lateral - lateral) * CROSS_GAIN, -CROSS_MAX, CROSS_MAX);
    const damp = clamp(-this.lateralVel * LATERAL_DAMP, -0.4, 0.4);   // moving right fast => ease left
    return clamp(-delta * STEER_GAIN + cross + damp, -1, 1);
  }

  /** Decide whether to start, hold or release a drift. Returns true while drifting. */
  updateDrift(progress, speed, state, steer, corner = Infinity) {
    const d = this.drift;
    const b = this.body;
    const active = !!(b.drift && b.drift.active);
    if (d.want) {
      const held = this.t - d.since;
      const remaining = this.cornerAhead(progress, 20);
      const charge = b.drift?.charge || 0;
      const tierT = this.kart.driftTiers[Math.min(d.tierGoal, this.kart.driftTiers.length) - 1]?.t ?? 1.1;
      const cornerDone = remaining.sweep < THREE.MathUtils.degToRad(10);
      const tierReached = charge >= tierT + 0.1;
      const failedToLock = held > 0.7 && !active;
      const wrongWay = Math.sign(remaining.signed || d.dir) !== d.dir && remaining.sweep > THREE.MathUtils.degToRad(15);
      // Running out of road on the inside (the drift is tighter than the line) or the outside
      // (too fast for it): let go and the kart gets its grip back.
      const halfW = this.widthAt(progress) / 2;
      const lat = this.pose.lateral;
      const latVel = this.lateralVel;                       // m/s, + toward the right
      const outOfRoad = Math.abs(lat) > halfW - 1.2 && Math.sign(latVel) === Math.sign(lat) && Math.abs(latVel) > 0.6;
      const tooTight = d.counterFor > 0.35;
      const tooFast = speed > corner * 1.35;   // a pad or mini turbo landed mid drift: let go and brake on the ground
      if (cornerDone || (tierReached && remaining.sweep < THREE.MathUtils.degToRad(25)) || failedToLock || wrongWay ||
          outOfRoad || tooTight || tooFast || speed < 7 || state !== 'race' && state !== 'drift' && state !== 'hop' || held > 6) {
        d.want = false; d.counterFor = 0;
        d.cooldownUntil = this.t + (failedToLock || tooTight || outOfRoad || tooFast ? 1.2 : 0.8);
        if (tooFast) this.stats.driftFast = (this.stats.driftFast || 0) + 1;
        if (outOfRoad) this.stats.driftBail = (this.stats.driftBail || 0) + 1;
        if (tooTight) this.stats.driftTight = (this.stats.driftTight || 0) + 1;
        if (active && b.drift.tier > this.stats.maxTier) this.stats.maxTier = b.drift.tier;
      }
      return d.want;
    }
    if (this.t < d.cooldownUntil || speed < DRIFT_MIN_SPEED || state !== 'race' || !b.grounded && b.grounded !== undefined) return false;
    if (speed > corner * TUNING.driftStartMaxOver) return false;   // too fast for the corner: brake first, drift after
    if (this.t < this.reverseUntil || this.t < this.recoverUntil) return false;
    // Only from on the line and on the road: a drift started from the grass is a crash.
    const halfWNow = this.widthAt(progress) / 2;
    if (this.block && this.t < this.block.until) return false;   // a block is a straight line move, not a corner
    if (Math.abs(this.pose.lateral - this.lateralTarget) > DRIFT_START_ERROR || Math.abs(this.pose.lateral) > halfWNow - 0.5) return false;
    // The corner just ahead: from 4 m to 44 m out.
    const ahead = this.cornerAhead(progress + 4 / this.L, 40);
    const signedDeg = THREE.MathUtils.radToDeg(Math.abs(ahead.signed));   // one direction only: an S bend is not a corner
    const tight = ahead.minRadius < DRIFT_RADIUS && signedDeg > 20;
    const long = signedDeg > DRIFT_SWEEP_DEG && ahead.minRadius < DRIFT_SWEEP_RADIUS;
    if (!tight && !long) return false;
    const dir = Math.sign(ahead.signed) || 0;
    if (!dir) return false;
    // Less skilled racers drift less often and hold less charge.
    const hash = Math.sin(this.id * 12.9898 + Math.floor(this.t) * 78.233) * 43758.5453;
    const roll = hash - Math.floor(hash);
    if (roll > 0.35 + 0.65 * this.personality.skill) { d.cooldownUntil = this.t + 1.0; return false; }
    d.want = true; d.dir = dir; d.since = this.t; d.counterFor = 0;
    d.tierGoal = this.personality.skill >= 0.97 ? 3 : this.personality.skill >= 0.9 ? 2 : 1;
    this.stats.drifts++;
    return true;
  }

  /* ------------------------------------------------------------------ items */

  heldItem(items) {
    if (!items) return null;
    const held = items.held;
    let key = null;
    if (held && typeof held.get === 'function') key = held.get(this.id);
    else if (held && typeof held === 'object') key = held[this.id];
    else if (typeof items.heldBy === 'function') key = items.heldBy(this.id);
    if (!key || key === 'roulette') return null;
    return key;
  }

  updateItems(ctx, others, progress, speed) {
    const items = ctx.items;
    const key = this.heldItem(items);
    if (key !== this.heldKey) { this.heldKey = key; this.heldSince = this.t; this.usedHeld = false; }
    if (!key || this.usedHeld) return;
    const heldFor = this.t - this.heldSince;
    if (heldFor < this.personality.itemDelay) return;
    const b = this.body;
    const me = this.pose.lateral;

    let nearestAhead = null, nearestBehind = null;
    for (const o of others) {
      const d = this.aheadMetres(o);
      if (d > 0 && (!nearestAhead || d < nearestAhead.d)) nearestAhead = { o, d };
      if (d < 0 && (!nearestBehind || -d < -nearestBehind.d)) nearestBehind = { o, d };
    }
    let fire = false, backwards = false;
    const overdue = heldFor > HOLD_ITEM_MAX;
    switch (key) {
      case 'buoy': {
        if (nearestAhead && nearestAhead.d <= 60) fire = true;
        else if (nearestBehind && -nearestBehind.d <= 12 && Math.abs(this.lateralOf(nearestBehind.o) - me) < 2) { fire = true; backwards = true; }
        else if (overdue) fire = true;
        break;
      }
      case 'cannonball': {
        const straight = this.cornerAhead(progress, 30).sweep < THREE.MathUtils.degToRad(12);
        if (nearestAhead && nearestAhead.d <= 30 && straight && Math.abs(this.lateralOf(nearestAhead.o) - me) < 2.5) fire = true;
        else if (nearestBehind && -nearestBehind.d <= 10 && straight && Math.abs(this.lateralOf(nearestBehind.o) - me) < 2) { fire = true; backwards = true; }
        else if (overdue && straight) fire = true;
        break;
      }
      case 'crate': {
        if (nearestBehind && -nearestBehind.d <= 15) fire = true;
        else if (overdue) fire = true;
        break;
      }
      case 'shield': {
        const locked = isLockedOn(items, this.id);
        const incoming = projectileBehind(items, b, 20);
        if (locked || incoming) fire = true;
        else if (overdue) fire = true;
        break;
      }
      case 'espresso': {
        const sec = this.sectionAt(progress);
        const farBehind = nearestAhead && nearestAhead.d > 60;
        const noOneAhead = !nearestAhead;
        const bendy = this.cornerAhead(progress, 40).minRadius < 30;
        if ((sec === 'A' || sec === 'C' || sec === 'H') && !bendy) fire = true;
        else if ((farBehind || noOneAhead) && !bendy) fire = true;
        else if (overdue) fire = true;
        break;
      }
      default:
        if (overdue) fire = true;
    }
    if (!fire) return;
    if (items && typeof items.use === 'function') {
      // ItemSystem.use returns false when the body is in an inert state (hop landing, spin edge):
      // keep the item and try again next frame instead of forgetting it.
      if (items.use(this.id, backwards) === false) return;
    } else if (this.events && typeof this.events.emit === 'function') {
      this.events.emit('useItem', { id: this.id, backwards });
    }
    this.usedHeld = true;
    this.stats.items[key] = (this.stats.items[key] || 0) + 1;
    this.debug.lastItem = { key, backwards, t: this.t };
  }
}

/* -------------------------------------------------------------------- probes into the item system */

function isLockedOn(items, id) {
  if (!items) return false;
  try {
    if (typeof items.lockedOn === 'function') return !!items.lockedOn(id);
    if (items.projectiles && typeof items.projectiles.lockedOn === 'function') return !!items.projectiles.lockedOn(id);
  } catch (e) { /* a probe, never fatal */ }
  return false;
}

function listOf(container) {
  if (!container) return null;
  for (const k of ['live', 'list', 'active', 'items', 'pool', 'alive']) {
    const v = container[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v.values === 'function') return Array.from(v.values());
  }
  return Array.isArray(container) ? container : null;
}

function hazardList(items) { return listOf(items?.hazards) || listOf(items?.hazardList); }

function projectileBehind(items, body, range) {
  const list = listOf(items?.projectiles);
  if (!list) return false;
  const fx = Math.sin(body.heading || 0), fz = Math.cos(body.heading || 0);
  for (const pr of list) {
    if (!pr || pr.by === body.id || pr.owner === body.id || pr.from === body.id || pr.dead) continue;
    const p = pr.pos || pr.position || pr;
    if (typeof p.x !== 'number') continue;
    const dx = p.x - body.pos.x, dz = p.z - body.pos.z;
    const ahead = dx * fx + dz * fz;
    if (ahead < 0 && ahead > -range && Math.abs(-dx * fz + dz * fx) < 4) return true;
  }
  return false;
}
