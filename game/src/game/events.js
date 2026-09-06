/**
 * DRIVE  src/game/events.js  (owner: game)
 *
 * The one event bus every subsystem talks through. Listeners never see each other, a throwing
 * listener never stops the others (it is logged with console.error, which the gate treats as a
 * failure, so a broken handler is found and not hidden), and the last few events are kept in a
 * ring for telemetry and the debugger.
 *
 *   const events = new Events();
 *   const off = events.on('hit', (p) => ...);   // returns the unsubscribe
 *   events.once('go', fn);
 *   events.emit('hit', { target, by, key, shielded });
 *
 * Names and payloads (the contract from docs/ARCHITECTURE.md, plus the ones the modules that
 * shipped in round 0 actually emit, so nobody has to guess):
 *
 *   race.js      'countdown' { n }                 3, 2, 1 at one second intervals
 *                'go' {}                           the bodies unfreeze
 *                'lapComplete' { id, lap, time }   lap = the lap just completed (1..laps), time = that lap's seconds
 *                'finalLap' { id }                 the racer entered the last lap
 *                'finish' { id, position, time }   the racer crossed the line on the final lap
 *                'placeChange' { id, from, to }    live position changed (debounced)
 *                'wrongWay' { id, on }             heading against the tangent for 2 s (on), or recovered (off)
 *                'raceEnd' { standings }           results are ready; standings as race.standings()
 *   physics.js   'miniTurbo' { id, tier }  'spin' { id }  'bump' { a, b, speed }  'fallStart' { id }
 *                'respawn' { id }  'lapCrossed' { id, lap, time }   (physics' own crossing; race.js owns the lap count)
 *   player.js    'useItem' { id, backwards }
 *   items.js     'itemPickup' { id, key: 'roulette' }  'itemReady' { id, key }  'itemUsed' { id, key, backwards }
 *                'hit' { target, by, key, shielded }  'boostPad' { id, pad }  'shieldUp' { id }  'shieldPop' { id, by, key }
 *                'shieldEnd' { id }  'bounce' { key, by, x, z, n }  'buoyLock' { target, by }  'crateDrop'  'crateLand'  'boxTaken'
 *   main.js      'uiClick' {}  'pause' { on }  'restart' {}
 */
export class Events {
  constructor({ ring = 32 } = {}) {
    this.map = new Map();
    this.ring = [];
    this.ringSize = ring;
    this.counts = new Map();
    this.time = 0;
  }

  on(name, fn) {
    if (typeof fn !== 'function') return () => {};
    let list = this.map.get(name);
    if (!list) { list = []; this.map.set(name, list); }
    list.push(fn);
    return () => this.off(name, fn);
  }

  once(name, fn) {
    const off = this.on(name, (p) => { off(); fn(p); });
    return off;
  }

  off(name, fn) {
    const list = this.map.get(name);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
    if (!list.length) this.map.delete(name);
  }

  emit(name, payload) {
    this.counts.set(name, (this.counts.get(name) || 0) + 1);
    this.ring.push({ name, payload, t: this.time });
    if (this.ring.length > this.ringSize) this.ring.shift();
    const list = this.map.get(name);
    if (!list || !list.length) return 0;
    // copy: a listener may unsubscribe itself (once) while we iterate
    const snapshot = list.slice();
    for (const fn of snapshot) {
      try { fn(payload); } catch (e) { console.error(`[events] listener for '${name}' threw:`, e && e.stack ? e.stack : e); }
    }
    return snapshot.length;
  }

  /** the loop advances the bus clock once a frame so the ring carries race time */
  tick(dt) { this.time += dt; }

  listenerCount(name) { const l = this.map.get(name); return l ? l.length : 0; }

  /** the last n events, oldest first, for telemetry and the debugger */
  recent(n = 8) { return this.ring.slice(-n); }

  clear() { this.map.clear(); this.ring.length = 0; this.counts.clear(); }
}

export const EVENT_NAMES = [
  'countdown', 'go', 'lapComplete', 'finalLap', 'finish', 'placeChange', 'wrongWay', 'raceEnd',
  'miniTurbo', 'spin', 'bump', 'fallStart', 'respawn', 'lapCrossed',
  'useItem', 'itemPickup', 'itemReady', 'itemUsed', 'hit', 'boostPad', 'shieldUp', 'shieldPop', 'shieldEnd',
  'bounce', 'buoyLock', 'crateDrop', 'crateLand', 'boxTaken',
  'uiClick', 'pause', 'restart',
];
