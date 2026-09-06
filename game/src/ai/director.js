/**
 * Director: rubber banding and standings for the seven AI racers.
 *
 * Every frame each AI gets a speed factor from its race progress gap to the player:
 *   factor = 1 + clamp(gapMetres / 120, -1, 1) x (behind ? 0.10 : 0.12) x skill
 * so an AI 120 m or more behind the player runs at most 10% faster and an AI 120 m or more
 * ahead runs at most 12% slower. The cap is what lets a good player still win: the pack is
 * kept within about 120 m either way and never dragged onto the player's bumper. Whoever
 * leads the race never exceeds 1.06 x vmax. The factor moves at most 0.25 per second so an
 * AI never lurches when the player spins.
 *
 * Race progress is accumulated HERE from wrapped progress deltas (laps + fraction from the
 * start line), so standings do not depend on when the race module increments `lap`.
 *
 * Signature per docs/ARCHITECTURE.md:
 *   new Director({ racers: AIRacer[], player: KartBody, spline })
 *   update(dt); standings() => [{ id, position, raceProgress }]; personalities
 */
import { PERSONALITIES, lapLengthOf } from './racer.js?v=r6-20260906191941';

export const RUBBER = {
  range: 120,        // m over which the band ramps to its cap
  behindMax: 0.10,   // an AI behind the player gets at most +10% speed
  aheadMax: 0.12,    // an AI ahead of the player loses at most 12%
  leaderCap: 1.06,   // the race leader never exceeds this x vmax
  rate: 0.25,        // max change of the factor per second
};

const wrap01 = (p) => { p %= 1; return p < 0 ? p + 1 : p; };
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Director {
  constructor({ racers = [], player = null, spline = null, laps = 3, startProgress = null, enabled = true }) {
    this.racers = racers;
    this.player = player;
    this.spline = spline;
    this.laps = laps;
    this.enabled = enabled;
    this.personalities = PERSONALITIES;
    this.L = lapLengthOf(spline);
    this.start = typeof startProgress === 'number' ? startProgress
      : (typeof spline?.startProgress === 'number' ? spline.startProgress
        : (typeof spline?.START_PROGRESS === 'number' ? spline.START_PROGRESS : 0.037));
    // body -> { dist (laps, continuous), prev (progress) }
    this.track = new Map();
    this._standings = [];
    this.time = 0;
    this._finishCount = 0;
  }

  bodies() {
    const out = [];
    if (this.player) out.push(this.player);
    for (const r of this.racers) if (r && r.body) out.push(r.body);
    return out;
  }

  /** Continuous race progress in laps for a body: 0 at the start line on lap 1. */
  raceProgressOf(body) {
    return this.track.get(body)?.dist ?? 0;
  }

  reset() {
    this.track.clear();
    this._standings = [];
    this._finishCount = 0;
    for (const r of this.racers) { r.rubber = 1; if (r.body) r.body.rubber = 1; }
  }

  _accumulate(body) {
    const p = wrap01(body.progress || 0);
    let rec = this.track.get(body);
    if (!rec) {
      // First sight: distance from the start line in (-0.5, 0.5]; the grid is a little behind it.
      let d0 = wrap01(p - this.start);
      if (d0 > 0.5) d0 -= 1;
      rec = { dist: d0, prev: p };
      this.track.set(body, rec);
      return rec;
    }
    let delta = p - rec.prev;
    if (delta > 0.5) delta -= 1; else if (delta < -0.5) delta += 1;
    // A respawn or reset can teleport a kart; ignore jumps over 200 m in one frame.
    if (Math.abs(delta) * this.L < 200) rec.dist += delta;
    rec.prev = p;
    // The race module owns the finish (body.state = 'finished'); the order is the order we saw it.
    if (body.state === 'finished' && rec.finishOrder == null) {
      rec.finishOrder = typeof body.finishOrder === 'number' ? body.finishOrder : ++this._finishCount;
    }
    return rec;
  }

  update(dt) {
    this.time += dt;
    const bodies = this.bodies();
    for (const b of bodies) this._accumulate(b);

    // Standings by race progress, ties by distance from the centreline (the straighter line ranks first).
    const rows = bodies.map((b) => ({
      id: b.id, body: b,
      raceProgress: this.raceProgressOf(b) / this.laps,
      lateral: Math.abs(b.lateral || 0),
      finishOrder: this.track.get(b)?.finishOrder,
    }));
    rows.sort((a, c) => {
      if (a.finishOrder != null || c.finishOrder != null) {
        if (a.finishOrder != null && c.finishOrder != null) return a.finishOrder - c.finishOrder;
        return a.finishOrder != null ? -1 : 1;
      }
      if (c.raceProgress !== a.raceProgress) return c.raceProgress - a.raceProgress;
      return a.lateral - c.lateral;
    });
    rows.forEach((r, i) => { r.position = i + 1; });
    this._standings = rows;
    const leaderId = rows.length ? rows[0].id : null;

    // Rubber band.
    const playerDist = this.player ? this.raceProgressOf(this.player) : null;
    for (const r of this.racers) {
      if (!r || !r.body) continue;
      const row = rows.find((x) => x.body === r.body);
      if (row) r.position = row.position;
      let want = 1;
      if (this.enabled && playerDist !== null && this.player.state !== 'finished') {
        const gapM = (playerDist - this.raceProgressOf(r.body)) * this.L;   // > 0: the AI is behind the player
        const u = clamp(gapM / RUBBER.range, -1, 1);
        const skill = r.personality?.skill ?? 0.9;
        want = 1 + (u > 0 ? u * RUBBER.behindMax : u * RUBBER.aheadMax) * skill;
      }
      if (r.id === leaderId) want = Math.min(want, RUBBER.leaderCap);
      const step = RUBBER.rate * dt;
      const cur = typeof r.rubber === 'number' ? r.rubber : 1;
      r.rubber = cur < want ? Math.min(want, cur + step) : Math.max(want, cur - step);
      if (r.id === leaderId && r.rubber > RUBBER.leaderCap) r.rubber = RUBBER.leaderCap;
    }
  }

  /** [{ id, position, raceProgress }] for every body (player included), best first. */
  standings() {
    return this._standings.map((r) => ({ id: r.id, position: r.position, raceProgress: r.raceProgress }));
  }

  positionOf(id) {
    const row = this._standings.find((r) => r.id === id);
    return row ? row.position : 0;
  }
}
