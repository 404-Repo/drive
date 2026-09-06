/**
 * DRIVE  src/items/hazards.js  (owner: items)
 *
 * The dropped hazard: a Spill Crate lands 2 m behind the kart, falls the last 0.4 m with a small bounce,
 * rests on the road, and spins out the next kart within its hit radius. 25 s life, at most 6 alive at
 * once (the oldest is removed), the dropping kart is immune to its own crate for 0.6 s. Lives in an
 * InstancePool (boxes.js) so six crates are one draw per material bucket of the asset.
 *
 * A hit calls onHit(targetId, byId, 'crate') on the ItemSystem, which decides spin or shield pop.
 */
import * as THREE from 'three';
import { InstancePool, INERT_STATES, idOf } from './boxes.js?v=r0-20260906043348';

const _q = new THREE.Quaternion(), _e = new THREE.Euler();

export class Hazards {
  constructor({ scene, world = null, spline = null, bodies = [], pool = null, events = null, onHit = null, effects = null,
                max = 6, life = 25, hit = 1.0, drop = 2.0, rng = Math.random }) {
    this.scene = scene;
    this.world = world;
    this.spline = spline;
    this.bodies = bodies;
    this.events = events;
    this.onHit = onHit;
    this.effects = effects;
    this.max = max;
    this.life = life;
    this.hit = hit;
    this.dropBack = drop;
    this.rng = rng;
    this.pool = pool || new InstancePool(null, max, { name: 'spill_crate' });
    if (scene && this.pool.group.parent !== scene) scene.add(this.pool.group);
    this.live = [];
    this.dropped = 0;
  }

  get count() { return this.live.length; }

  groundY(x, z, fallback) {
    let y = NaN;
    if (this.spline && typeof this.spline.roadY === 'function') y = this.spline.roadY(x, z);
    if (!Number.isFinite(y) && this.world && typeof this.world.groundAt === 'function') {
      let g = null;
      try { g = this.world.groundAt(x, z); } catch { g = null; }
      if (g && Number.isFinite(g.y) && g.surface !== 'water' && g.surface !== 'air') y = g.y;
    }
    return Number.isFinite(y) ? y : fallback;
  }

  drop(key, from) {
    if (key !== 'crate' || !from || !from.pos) return null;
    if (this.live.length >= this.max) this.kill(0);   // the oldest goes
    const slot = this.pool.acquire();
    if (slot < 0) return null;
    const heading = Number.isFinite(from.heading) ? from.heading : 0;
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const x = from.pos.x - fx * this.dropBack, z = from.pos.z - fz * this.dropBack;
    const byIndex = this.bodies.indexOf(from);
    const c = {
      slot, by: idOf(from, byIndex), byBody: from, age: 0, life: this.life,
      x, z, ground: this.groundY(x, z, from.pos.y), startY: from.pos.y + 0.4,
      yaw: heading + Math.PI + (this.rng() - 0.5) * 0.6,   // the open front faces the karts behind
    };
    this.live.push(c);
    this.dropped++;
    this.pool.place(slot, x, c.startY, z, c.yaw);
    if (this.events && this.events.emit) this.events.emit('crateDrop', { id: c.by, x, z });
    return c;
  }

  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const c = this.live[i];
      c.age += dt;
      c.life -= dt;
      if (c.life <= 0) { this.kill(i); continue; }
      // the fall: 0.3 s down, a 0.12 m hop, then at rest; the spill puff on the first touch
      let y = c.ground;
      if (c.age < 0.3) y = THREE.MathUtils.lerp(c.startY, c.ground, c.age / 0.3);
      else if (c.age < 0.55) y = c.ground + Math.sin((c.age - 0.3) / 0.25 * Math.PI) * 0.12;
      if (!c.landed && c.age >= 0.3) {
        c.landed = true;
        if (this.effects) this.effects.burst({ x: c.x, y: c.ground + 0.2, z: c.z }, 0xf1e6d2, 14, 3, 0.5);
        if (this.events && this.events.emit) this.events.emit('crateLand', { id: c.by, x: c.x, z: c.z });
      }
      const tilt = c.age < 0.3 ? (0.3 - c.age) * 1.2 : 0;
      _q.setFromEuler(_e.set(tilt, c.yaw, 0, 'YXZ'));
      this.pool.place(c.slot, c.x, y, c.z, 0, 1, _q);
      if (c.age < 0.25) continue;   // still in the air
      for (let b = 0; b < this.bodies.length; b++) {
        const body = this.bodies[b];
        if (!body || !body.pos || INERT_STATES.has(body.state) || body.state === 'spin') continue;
        if (body === c.byBody && c.age < 0.6) continue;
        const dx = body.pos.x - c.x, dz = body.pos.z - c.z;
        const r = this.hit + 0.3;   // the crate's hit radius plus the kart's half width
        if (dx * dx + dz * dz > r * r) continue;
        if (Math.abs(body.pos.y - c.ground) > 1.5) continue;
        if (this.onHit) this.onHit(idOf(body, b), c.by, 'crate');
        if (this.effects) this.effects.burst({ x: c.x, y: c.ground + 0.3, z: c.z }, 0xbfe8f0, 20, 5, 0.6);
        this.kill(i);
        break;
      }
    }
  }

  kill(i) {
    const c = this.live[i];
    if (!c) return;
    this.pool.release(c.slot);
    this.live.splice(i, 1);
  }

  clear() { while (this.live.length) this.kill(this.live.length - 1); }
}
