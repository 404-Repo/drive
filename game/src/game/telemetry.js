/**
 * DRIVE  src/game/telemetry.js  (owner: game)
 *
 * window.__GAME__, refreshed every frame with every field in tools/CONTRACT.md, so the gate
 * (tools/karttest.mjs) and the claims script can read the game like a player would see it.
 *
 *   const telemetry = createTelemetry({ renderer, player, bodies, race, items, camera, chase, tier, level, audio, views, names, round });
 *   telemetry.tick(realDt);      // once a frame, BEFORE the dt clamp: fps comes from real elapsed time
 *   telemetry.publish();         // at the end of the frame
 *
 * fps is frames / real seconds over the last half second, never 1 / clamped dt: a frame that
 * took 200 ms counts as 5 fps, not 20. The same object is mutated every frame (no allocation
 * beyond the racers array) so the gate's polling never sees a half written frame.
 *
 * Beyond the contract: cameraPitch, cameraRoll and cameraRestPitch (degrees) for the claims pitch
 * rule, kartBox for the claims kart mask ({ x, y, w, h } px and { nx, ny, nw, nh } fractions),
 * state (the race state), missingAssets, stamp and round for the debugger.
 */
import { REST_PITCH_DEG } from '../kart/camera.js?v=r6-20260906191941';   // the chase camera's real rest pitch (round 2: -3.1; round 0 hard coded -6.8 here)
export { REST_PITCH_DEG };

class FpsMeter {
  constructor(window = 0.5) { this.window = window; this.frames = 0; this.elapsed = 0; this.fps = 0; this.worst = 0; }
  tick(realDt) {
    if (!(realDt > 0) || realDt > 5) return;   // a tab that was hidden is not a frame time
    this.frames++; this.elapsed += realDt;
    if (realDt > this.worst) this.worst = realDt;
    if (this.elapsed >= this.window) {
      this.fps = Math.round(this.frames / this.elapsed);
      this.frames = 0; this.elapsed = 0; this.worst = 0;
    }
  }
}

export function createTelemetry({ renderer, player, bodies = [], race = null, items = null, camera = null, chase = null,
                                  tier = null, level = null, audio = null, views = null, names = null, round = 'r0' } = {}) {
  const meter = new FpsMeter();
  const G = {
    pos: [0, 0], posY: 0, heading: 0, fps: 0, speed: 0, lap: 0, laps_total: race ? race.laps : 3, position: 1, progress: 0,
    race_progress: 0, race_time: 0, countdown: null, over: false, finished: false, draws: 0, tris: 0,
    items_used: 0, item: null, hits: 0, hits_dealt: 0, respawns: 0, ai_count: Math.max(0, bodies.length - 1),
    racers: [], drift: { active: false, tier: 0, charge: 0, dir: 0 }, boost: 0, surface: 'asphalt', on_road: true, distance: 0,
    quality: tier && tier.name ? tier.name : (typeof tier === 'string' ? tier : 'high'),
    audio: 'silent', visibleAssets: [], blocksVisible: 0, staticMeshes: 0,
    cameraPitch: 0, cameraRoll: 0, cameraRestPitch: REST_PITCH_DEG, camPitch: 0, kartBox: null,
    state: 'grid', missingAssets: [], stamp: (typeof window !== 'undefined' && window.__BUILD_STAMP__) || null, round,
    lap_time: 0, best_lap: null, wrong_way: false, paused: false, events: null,
    item_boxes: [],   // the 14 box positions [{ x, z, up }], up refreshed every frame, so the gate can aim for a live one like a player does
    input: { throttle: 0, steer: 0, hop: false },   // what reached the player body this frame (keyboard or touch), for the gate's trace
    kart_state: 'race',
  };
  const boxList = items && items.boxes && Array.isArray(items.boxes.boxes) ? items.boxes.boxes : null;
  if (boxList) G.item_boxes = boxList.map((b) => ({ x: round2(b.x), z: round2(b.z), up: true }));
  const nameOf = (id) => {
    if (!names) return id === (player && player.id) ? 'Rafa' : `Racer ${id}`;
    if (typeof names.get === 'function') return names.get(id) || `Racer ${id}`;
    return names[id] || `Racer ${id}`;
  };
  // one row per body, allocated once
  G.racers = bodies.map((b) => ({ id: b.id, name: nameOf(b.id), lap: 1, progress: 0, position: 0, x: 0, z: 0, isPlayer: b === player }));
  const staticCount = () => {
    if (!level || !level.blocks) return 0;
    let n = 0;
    for (const g of level.blocks.values()) g.traverse((o) => { if (o.isMesh) n++; });
    return n;
  };
  let staticMeshes = -1;
  let frame = 0;
  const frustum = { count: 0, t: 0 };

  function publish(extra = null) {
    frame++;
    const b = player;
    const racing = race && (race.state === 'racing' || race.state === 'finished');
    if (b) {
      G.pos[0] = round3(b.pos.x); G.pos[1] = round3(b.pos.z); G.posY = round3(b.pos.y);
      G.heading = round3(b.heading);
      G.speed = round2(b.speed);
      G.progress = round4(b.progress);
      G.surface = b.surface || 'asphalt';
      G.on_road = b.onRoad !== undefined ? !!b.onRoad : (G.surface === 'asphalt' || G.surface === 'cobble' || G.surface === 'pad');
      G.distance = round1(b.distance || 0);
      G.respawns = b.respawns || 0;
      G.boost = round2(b.boost || 0);
      G.drift.active = !!(b.drift && b.drift.active);
      G.drift.tier = b.drift ? b.drift.tier | 0 : 0;
      G.drift.charge = round2(b.drift ? b.drift.charge : 0);
      G.drift.dir = b.drift && b.drift.active ? (b.drift.dir | 0) : 0;   // -1 left, +1 right while a drift is locked
      if (b.input) { G.input.throttle = round2(b.input.throttle || 0); G.input.steer = round2(b.input.steer || 0); G.input.hop = !!b.input.hop; }
      G.kart_state = b.state || 'race';
    }
    if (race) {
      const rec = race.record ? race.record(b ? b.id : null) : null;
      G.state = race.state;
      G.laps_total = race.laps;
      G.lap = racing && rec ? rec.lap : 0;
      G.position = rec ? rec.position || 1 : 1;
      G.race_progress = rec ? round4(rec.raceProgress / race.laps) : 0;
      G.race_time = round3(race.time || 0);
      G.countdown = race.countdown;
      G.finished = !!(rec && rec.finished);
      G.over = !!(race.state === 'finished' || (rec && rec.finished));
      G.lap_time = rec ? round3(race.lapTimeOf(rec.id)) : 0;
      G.best_lap = rec && rec.bestLap !== null ? round3(rec.bestLap) : null;
      G.wrong_way = rec ? !!rec.wrongWay : false;
      for (let i = 0; i < bodies.length; i++) {
        const bb = bodies[i], row = G.racers[i], r = race.record ? race.record(bb.id) : null;
        row.lap = racing && r ? r.lap : 0; row.progress = round4(bb.progress); row.position = r ? r.position : 0;
        row.x = round2(bb.pos.x); row.z = round2(bb.pos.z);
      }
      G.ai_count = bodies.filter((bb) => bb !== b).length;
    }
    if (boxList) for (let i = 0; i < boxList.length && i < G.item_boxes.length; i++) G.item_boxes[i].up = !(boxList[i].down > 0) && !(boxList[i].scale < 1);
    if (items && b) {
      const held = items.held && typeof items.held.get === 'function' ? items.held.get(b.id) : null;
      G.item = held === undefined ? null : held;
      G.items_used = typeof items.countUsed === 'function' ? items.countUsed(b.id) : 0;
      G.hits = typeof items.countHits === 'function' ? items.countHits(b.id) : 0;
      G.hits_dealt = typeof items.countDealt === 'function' ? items.countDealt(b.id) : 0;
    }
    if (renderer && renderer.info) { G.draws = renderer.info.render.calls; G.tris = renderer.info.render.triangles; }
    G.fps = meter.fps;
    G.quality = tier && tier.name ? tier.name : G.quality;
    G.audio = audio ? audio.state : 'silent';
    if (chase) {
      G.cameraPitch = round2(chase.pitchDeg || 0); G.camPitch = G.cameraPitch;
      G.cameraRoll = round2(chase.rollDeg || 0);
    }
    // the kart's screen box for the claims mask: every 2nd frame is plenty
    if (views && camera && b && (frame & 1) === 0) {
      const v = typeof views.get === 'function' ? views.get(b.id) : views[b.id];
      const box = v && typeof v.screenBox === 'function' ? v.screenBox(camera, renderer ? renderer.domElement.clientWidth : undefined, renderer ? renderer.domElement.clientHeight : undefined) : null;
      G.kartBox = box ? { x: round1(box.x), y: round1(box.y), w: round1(box.w), h: round1(box.h), nx: round4(box.nx), ny: round4(box.ny), nw: round4(box.nw), nh: round4(box.nh) } : null;
    }
    // visible assets: 4 times a second, it walks 70 block boxes
    if (level && camera && typeof level.visibleAssets === 'function') {
      frustum.t += 1;
      if (frustum.t >= 15 || frame < 3) { frustum.t = 0; G.visibleAssets = level.visibleAssets(camera); G.blocksVisible = countVisibleBlocks(level, camera); }
    }
    if (staticMeshes < 0 && level) staticMeshes = staticCount();
    G.staticMeshes = Math.max(0, staticMeshes);
    if (extra) Object.assign(G, extra);
    if (typeof window !== 'undefined') window.__GAME__ = G;
    return G;
  }

  return { tick: (dt) => meter.tick(dt), publish, meter, data: G };
}

/** Compatibility with the docs/ARCHITECTURE.md name: one call publishes one frame (fps from the last tick). */
let _shared = null;
export function publishTelemetry(ctx, realDt) {
  if (!_shared || _shared.ctx !== ctx) _shared = { ctx, t: createTelemetry(ctx) };
  if (realDt) _shared.t.tick(realDt);
  return _shared.t.publish();
}

function countVisibleBlocks(level, camera) {
  if (!level.blocks) return 0;
  // block boxes against the camera's clip volume, corner by corner (no allocation)
  let n = 0;
  camera.updateMatrixWorld();
  for (const g of level.blocks.values()) if (g.visible !== false && (!g.userData.box || boxInView(g.userData.box, camera))) n++;
  return n;
}
const _v = [0, 0, 0, 1];
function boxInView(box, camera) {
  // conservative: any corner projects inside the clip volume (or the camera is inside the box)
  const m = camera.projectionMatrix.elements, w = camera.matrixWorldInverse.elements;
  const cp = camera.position;
  if (cp.x >= box.min.x && cp.x <= box.max.x && cp.z >= box.min.z && cp.z <= box.max.z) return true;
  for (let i = 0; i < 8; i++) {
    const x = i & 1 ? box.max.x : box.min.x, y = i & 2 ? box.max.y : box.min.y, z = i & 4 ? box.max.z : box.min.z;
    // view space
    const vx = w[0] * x + w[4] * y + w[8] * z + w[12], vy = w[1] * x + w[5] * y + w[9] * z + w[13], vz = w[2] * x + w[6] * y + w[10] * z + w[14];
    // clip space
    _v[0] = m[0] * vx + m[4] * vy + m[8] * vz + m[12];
    _v[1] = m[1] * vx + m[5] * vy + m[9] * vz + m[13];
    _v[3] = m[3] * vx + m[7] * vy + m[11] * vz + m[15];
    const cw = _v[3];
    if (cw > 0 && Math.abs(_v[0]) <= cw && Math.abs(_v[1]) <= cw) return true;
  }
  return false;
}

const round1 = (v) => Math.round(v * 10) / 10;
const round2 = (v) => Math.round(v * 100) / 100;
const round3 = (v) => Math.round(v * 1000) / 1000;
const round4 = (v) => Math.round(v * 10000) / 10000;
