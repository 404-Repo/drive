/**
 * DRIVE  src/items/projectiles.js  (owner: items)
 *
 * The two thrown items.
 *
 *   Chaser Buoy   fired forward it rides the centreline: progress and lateral offset in the spline's own
 *                 frame, closing at 34 m/s, locking the nearest racer within 60 m ahead and steering its
 *                 lateral toward the target's at 3 rad/s of heading change, 8 s life. With no target it
 *                 holds its own lane, so it never leaves the road. Fired backwards it goes straight.
 *   Cannonball    straight in the firing heading at 30 m/s, rolling on the road (y = road y + radius),
 *                 no gravity, up to 3 bounces off the kerb line (spline width) and off any collider the
 *                 collision world reports through raycast, 6 s life.
 *
 * A hit calls onHit(targetId, byId, key) on the ItemSystem, which decides spin or shield pop and emits
 * 'hit' { target, by, key }. Both items live in InstancePools (boxes.js) so 6 buoys and 6 cannonballs in
 * flight cost one draw per material bucket of their asset.
 *
 * Spline API used (docs/ARCHITECTURE.md track/spline.js): at(progress), point(progress, lateral, out),
 * nearest(x, z), roadY(x, z), samples[]. Direction is taken from finite differences of point() so the
 * sign convention of the spline's normal never matters here.
 */
import * as THREE from 'three';
import { InstancePool, INERT_STATES, idOf } from './boxes.js?v=r0-20260906043348';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _axis = new THREE.Vector3(), _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);

/** Lap length in metres from whatever the spline exposes; the plan's 1061 as the last resort. */
export function lapLengthOf(spline) {
  if (!spline) return 1061;
  if (Number.isFinite(spline.lapLength)) return spline.lapLength;
  if (Number.isFinite(spline.length)) return spline.length;
  if (Array.isArray(spline.samples) && spline.samples.length > 1) {
    const last = spline.samples[spline.samples.length - 1];
    if (Number.isFinite(last.s)) return last.s + 1.5;
  }
  return 1061;
}

/** Signed metres from the centreline for a body, from the body if it knows, else from the spline. */
export function lateralOf(body, spline) {
  if (Number.isFinite(body.lateral)) return body.lateral;
  if (spline && typeof spline.nearest === 'function' && body.pos) {
    const n = spline.nearest(body.pos.x, body.pos.z);
    if (n && Number.isFinite(n.lateral)) return n.lateral;
  }
  return 0;
}

export function progressOf(body, spline) {
  if (Number.isFinite(body.progress)) return body.progress;
  if (spline && typeof spline.nearest === 'function' && body.pos) {
    const n = spline.nearest(body.pos.x, body.pos.z);
    if (n && Number.isFinite(n.progress)) return n.progress;
  }
  return 0;
}

/** Road width at a progress, the plan's 11 m when the spline does not say. */
function widthAt(spline, progress) {
  if (spline && typeof spline.at === 'function') {
    const s = spline.at(progress);
    if (s && Number.isFinite(s.width)) return s.width;
  }
  return 11;
}

const wrap01 = (v) => v - Math.floor(v);

export class Projectiles {
  /**
   * @param pools   { buoy: InstancePool, cannonball: InstancePool } (missing pools become empty pools)
   * @param onHit   (targetId, byId, key) => void
   * @param effects optional { burst(pos, colour, count, speed) } from the ItemSystem
   */
  constructor({ scene, world = null, spline = null, bodies = [], pools = {}, events = null, onHit = null, effects = null,
                specs = {} }) {
    this.scene = scene;
    this.world = world;
    this.spline = spline;
    this.bodies = bodies;
    this.events = events;
    this.onHit = onHit;
    this.effects = effects;
    this.spec = {
      buoy: { speed: 34, lock: 60, life: 8, turn: 3.0, radius: 0.35, hover: 0.45, ...(specs.buoy || {}) },
      cannonball: { speed: 30, bounces: 3, life: 6, radius: 0.225, ...(specs.cannonball || {}) },
    };
    this.pools = {
      buoy: pools.buoy || new InstancePool(null, 6, { name: 'chaser_buoy' }),
      cannonball: pools.cannonball || new InstancePool(null, 6, { name: 'cannonball' }),
    };
    for (const p of Object.values(this.pools)) if (scene && p.group.parent !== scene) scene.add(p.group);
    this.live = [];
    this.lapLength = lapLengthOf(spline);
    this.fired = 0;
    this.bounces = 0;
  }

  get count() { return this.live.length; }

  /** Is any buoy homing on this racer (the AI raises its shield on this). */
  lockedOn(id) {
    for (const p of this.live) if (p.kind === 'buoy' && p.target && idOf(p.target, p.targetIndex) === id) return true;
    return false;
  }

  fire(key, from, backwards = false) {
    if (!from || !from.pos) return null;
    const byIndex = this.bodies.indexOf(from);
    const by = idOf(from, byIndex);
    const heading = Number.isFinite(from.heading) ? from.heading : 0;
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const dir = backwards ? -1 : 1;
    if (key === 'buoy' && !backwards) {
      const slot = this.pools.buoy.acquire();
      if (slot < 0) return null;
      const spec = this.spec.buoy;
      const p = {
        kind: 'buoy', slot, by, byBody: from, age: 0, life: spec.life, homing: true,
        s: wrap01(progressOf(from, this.spline) + 2.0 / this.lapLength),
        lateral: lateralOf(from, this.spline), phi: 0, target: null, targetIndex: -1,
        pos: new THREE.Vector3(from.pos.x + fx * 2.0, from.pos.y + spec.hover, from.pos.z + fz * 2.0),
        yaw: heading, roll: 0,
      };
      this.live.push(p);
      this.fired++;
      return p;
    }
    const isBuoy = key === 'buoy';
    const pool = isBuoy ? this.pools.buoy : this.pools.cannonball;
    const slot = pool.acquire();
    if (slot < 0) return null;
    const spec = isBuoy ? this.spec.buoy : this.spec.cannonball;
    const speed = spec.speed;
    const p = {
      kind: isBuoy ? 'buoy' : 'cannonball', slot, by, byBody: from, age: 0, life: spec.life, homing: false,
      pos: new THREE.Vector3(from.pos.x + fx * dir * 2.0, from.pos.y + (isBuoy ? spec.hover : spec.radius), from.pos.z + fz * dir * 2.0),
      vel: new THREE.Vector3(fx * dir * speed, 0, fz * dir * speed),
      bounces: 0, maxBounces: isBuoy ? 0 : spec.bounces, radius: spec.radius,
      yaw: backwards ? heading + Math.PI : heading, spin: new THREE.Quaternion(), target: null, targetIndex: -1,
    };
    this.live.push(p);
    this.fired++;
    return p;
  }

  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.age += dt;
      p.life -= dt;
      let dead = false;
      if (p.life <= 0) dead = true;
      else if (p.homing) dead = !this.stepHoming(p, dt);
      else dead = !this.stepStraight(p, dt);
      if (!dead) dead = this.hitTest(p);
      if (dead) this.kill(i);
    }
  }

  kill(i) {
    const p = this.live[i];
    this.pools[p.kind].release(p.slot);
    this.live.splice(i, 1);
  }

  clear() { while (this.live.length) this.kill(this.live.length - 1); }

  /** A homing buoy: forward along the centreline, lateral eased toward its target's lateral. */
  stepHoming(p, dt) {
    const spec = this.spec.buoy, spline = this.spline, L = this.lapLength;
    // target: the nearest racer ahead within lock range; drop it once it is behind or far
    if (p.target) {
      const d = wrap01(progressOf(p.target, spline) - p.s) * L;
      if (d > spec.lock + 12 || d < -2 || INERT_STATES.has(p.target.state)) { p.target = null; p.targetIndex = -1; }
    }
    if (!p.target) {
      let best = null, bestD = Infinity, bestI = -1;
      for (let i = 0; i < this.bodies.length; i++) {
        const b = this.bodies[i];
        if (!b || !b.pos || b === p.byBody || INERT_STATES.has(b.state)) continue;
        const d = wrap01(progressOf(b, spline) - p.s) * L;
        if (d > 0.5 && d <= spec.lock && d < bestD) { best = b; bestD = d; bestI = i; }
      }
      if (best && this.events && this.events.emit && best !== p.lastLocked) this.events.emit('buoyLock', { target: idOf(best, bestI), by: p.by });
      p.target = best; p.targetIndex = bestI; if (best) p.lastLocked = best;
    }
    const desiredLat = p.target ? lateralOf(p.target, spline) : p.lateral;
    const desiredPhi = THREE.MathUtils.clamp(Math.atan2(desiredLat - p.lateral, 6), -1.1, 1.1);
    p.phi += THREE.MathUtils.clamp(desiredPhi - p.phi, -spec.turn * dt, spec.turn * dt);
    const half = widthAt(spline, p.s) / 2 - spec.radius;
    p.s = wrap01(p.s + (spec.speed * Math.cos(p.phi) * dt) / L);
    p.lateral = THREE.MathUtils.clamp(p.lateral + spec.speed * Math.sin(p.phi) * dt, -half, half);
    if (spline && typeof spline.point === 'function') {
      spline.point(p.s, p.lateral, _a);
      spline.point(wrap01(p.s + 0.6 / L), p.lateral + Math.tan(p.phi) * 0.6, _b);
      _d.subVectors(_b, _a);
      if (_d.lengthSq() > 1e-8) p.yaw = Math.atan2(_d.x, _d.z);
      p.pos.set(_a.x, _a.y + spec.hover + Math.sin(p.age * 9) * 0.06, _a.z);
    } else {
      // no spline in this scene: fly straight along the yaw
      p.pos.x += Math.sin(p.yaw) * spec.speed * dt;
      p.pos.z += Math.cos(p.yaw) * spec.speed * dt;
    }
    p.roll = THREE.MathUtils.lerp(p.roll, -p.phi * 0.8, Math.min(1, dt * 6));
    _q.setFromEuler(_e.set(0, p.yaw, p.roll, 'YXZ'));
    this.pools.buoy.place(p.slot, p.pos.x, p.pos.y, p.pos.z, 0, 1, _q);
    return true;
  }

  /** A straight projectile: kerb line and collider bounces, rolling on the road. */
  stepStraight(p, dt) {
    const spline = this.spline, world = this.world;
    const stepLen = p.vel.length() * dt;
    // colliders first: tyre walls, bollards, house fronts, through the collision world when it is there
    if (world && typeof world.raycast === 'function' && stepLen > 0) {
      _d.copy(p.vel).normalize();
      let hit = null;
      try { hit = world.raycast(p.pos, _d, stepLen + p.radius + 0.1, { ignoreTag: 'kart' }); } catch { hit = null; }
      // a 'ground' answer is the road climbing under the ball, not a wall; its banked normal must not bounce it
      if (hit && hit.hit && hit.normal && hit.tag !== 'ground') {
        _n.set(hit.normal.x, 0, hit.normal.z);
        if (_n.lengthSq() > 1e-6) {
          _n.normalize();
          if (p.vel.dot(_n) < 0) {
            if (!this.bounce(p, _n)) return false;
          }
        }
      }
    }
    p.pos.addScaledVector(p.vel, dt);
    // the kerb line: the road's own edge from the spline width
    if (spline && typeof spline.nearest === 'function' && typeof spline.point === 'function') {
      const near = spline.nearest(p.pos.x, p.pos.z);
      if (near && Number.isFinite(near.lateral) && Number.isFinite(near.progress)) {
        const half = widthAt(spline, near.progress) / 2 + 0.3 - p.radius;   // the kerb stone is 0.6 m outside the width
        if (Math.abs(near.lateral) > half) {
          const side = Math.sign(near.lateral);
          spline.point(near.progress, side * half, _a);
          spline.point(near.progress, 0, _b);
          _n.subVectors(_a, _b);
          _n.y = 0;
          if (_n.lengthSq() > 1e-6) {
            _n.normalize().negate();   // points back toward the centreline
            const outward = p.vel.dot(_n) < 0;
            p.pos.x = _a.x; p.pos.z = _a.z;
            if (outward && !this.bounce(p, _n)) return false;
          }
        }
      }
    }
    // ride the road surface; off the road and off the ground it is gone
    let y = NaN;
    if (spline && typeof spline.roadY === 'function') y = spline.roadY(p.pos.x, p.pos.z);
    if (!Number.isFinite(y) && world && typeof world.groundAt === 'function') {
      let g = null;
      try { g = world.groundAt(p.pos.x, p.pos.z); } catch { g = null; }
      if (g && Number.isFinite(g.y) && g.surface !== 'water' && g.surface !== 'air') y = g.y;
      else if (g && (g.surface === 'water')) { this.splash(p.pos); return false; }
    }
    if (!Number.isFinite(y)) {
      if (!spline && !world) y = p.pos.y - p.radius;   // bare test scene: keep the launch height
      else return false;
    }
    p.pos.y = y + p.radius;
    // rolling: about the axis perpendicular to travel, at v / r
    if (stepLen > 0) {
      _d.copy(p.vel).normalize();
      _axis.crossVectors(UP, _d);
      if (_axis.lengthSq() > 1e-8) {
        _axis.normalize();
        _q2.setFromAxisAngle(_axis, p.kind === 'cannonball' ? stepLen / p.radius : 0);
        p.spin.premultiply(_q2);
      }
    }
    if (p.kind === 'buoy') _q.setFromEuler(_e.set(0, p.yaw, 0)); else _q.copy(p.spin);
    this.pools[p.kind].place(p.slot, p.pos.x, p.pos.y, p.pos.z, 0, 1, _q);
    return true;
  }

  /** Reflect about a horizontal normal; false when the bounce budget is spent (the item dies). */
  bounce(p, normal) {
    if (p.bounces >= p.maxBounces) { this.puff(p); return false; }
    const vn = p.vel.dot(normal);
    p.vel.addScaledVector(normal, -2 * vn);
    p.vel.multiplyScalar(0.96);
    p.bounces++;
    this.bounces++;
    if (this.events && this.events.emit) this.events.emit('bounce', { key: p.kind, by: p.by, x: p.pos.x, z: p.pos.z, n: p.bounces });
    if (this.effects) this.effects.burst(p.pos, 0xcdb897, 8, 3.5, 0.35);
    return true;
  }

  puff(p) { if (this.effects) this.effects.burst(p.pos, p.kind === 'buoy' ? 0xed5851 : 0x8d7b63, 14, 4.5, 0.5); }
  splash(pos) { if (this.effects) this.effects.burst(pos, 0x3fb0b8, 18, 5, 0.6); }

  /** True when the projectile touched a racer and was consumed. */
  hitTest(p) {
    const own = p.age < 0.45;
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (!b || !b.pos || INERT_STATES.has(b.state) || b.state === 'spin') continue;
      if (b === p.byBody && own) continue;
      const r = (Number.isFinite(b.radius) ? b.radius : 0.7) + (p.kind === 'buoy' ? this.spec.buoy.radius : this.spec.cannonball.radius) + 0.15;
      const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z;
      if (dx * dx + dz * dz > r * r) continue;
      if (Math.abs(b.pos.y - p.pos.y) > 1.8) continue;
      if (this.onHit) this.onHit(idOf(b, i), p.by, p.kind);
      if (this.effects) this.effects.burst(p.pos, p.kind === 'buoy' ? 0xed5851 : 0x3a3f46, 16, 5, 0.5);
      return true;
    }
    return false;
  }
}
