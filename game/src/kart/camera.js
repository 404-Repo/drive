/**
 * DRIVE  src/kart/camera.js  (owner: kart)
 *
 * The chase camera. Round 1 brought it in and down (the round 0 camera, 6.8 m back, 2.4 m up,
 * fov 60 per docs/TRACK-PLAN.md section 9, put the player kart at about 8 percent of the frame
 * height). Round 2 brought it in again: the round 2 blind critic measured the kart at 15 to 22
 * percent of the frame height under the 4.3 m / 1.5 m camera against 35 to 60 percent in every
 * bar frame, with the driver's helmet above the horizon line. Now, landscape:
 *   2.8 m behind the kart along its smoothed heading (3.1 m at vmax), 1.05 m above the ROAD under
 *   the kart (a hop does not lift the camera), looking at a point 6.5 m ahead of the kart 0.55 m
 *   up (rest pitch about -3.1 degrees, horizon near row 0.45, so the helmet top at 1.33 m sits
 *   above the horizon); vertical fov 58 plus 3 degrees at the speed cap and a further 4 on boost.
 *   The kart box (docs/CLAIMS.md kart mask) spans about 0.45 to 0.52 of the frame height at race
 *   pace and the kart reads at about 0.40 by eye (helmet top to tyre bottom).
 * Portrait (the phone) keeps more road in view: 4.4 m back (4.7 at vmax), 1.3 m up, fov 68 (at 3.4 m the
 *   kart filled 70 percent of the phone width and hid the road).
 * Round 3: landscape 3.7 m back, 1.2 m up, look 7.2 m ahead at 0.6 m (see CAMERA below).
 *   Yaw follows the heading through a critically damped spring with a 0.18 s time constant and
 *   lags up to 12 degrees toward the outside during a drift; roll is 60% of the road bank; a
 *   sphere cast from the kart to the camera pulls it in when a wall is between; the camera never
 *   pitches below the horizon minus 20 degrees.
 *
 *   const chase = new ChaseCamera({ camera, world, tier });
 *   chase.snapTo(body);           // at the grid and after a respawn
 *   chase.update(dt, body);       // after the kart views
 *   chase.pitchDeg, chase.rollDeg // published to telemetry for the claims pitch rule
 *   chase.restPitchDeg            // the rest pitch these constants give (telemetry should read it)
 *
 * CHASE is the live camera state kartview.js reads to cull a kart that sits on the camera (the
 * round 1 critic saw AI helmets clipping through the bottom of the frame): the camera, its world
 * position and forward, and the id of the body it follows.
 *
 * Also a small cobble shake (0.02 m at 8 Hz) while the kart rolls over cobbles and a short
 * shake on a spin out. Nothing here touches the body.
 */
import * as THREE from 'three';
import { KART } from './physics.js?v=r3-20260906150928';

// Round 3 (the blind critic: the round 2 camera overshot, the kart box at 0.50 of the frame height against a
// 0.35 to 0.45 target, an AI kart ahead filling a third of the frame): a little higher and further back,
// 3.5 m behind (3.8 at vmax), 1.2 m above the road, looking 7.2 m ahead at 0.6 m (rest pitch -3.2, horizon near
// row 0.45, the helmet top at about 1.3 m sits just above it). Measured kart box: 3.7 m gave 0.33 to 0.35 at race
// pace, 3.5 m the 0.35 to 0.42 the critic asked for (work/fix3_kart/p*.json).
export const CAMERA = {
  distance: 3.5, distanceFast: 3.8, height: 1.2, lookAhead: 7.2, lookHeight: 0.6,
  portraitDistance: 4.4, portraitDistanceFast: 4.7, portraitHeight: 1.3,
  fovLandscape: 58, fovPortrait: 68, fovSpeed: 3, fovBoost: 4,
  yawTau: 0.18, driftLagDeg: 12, bankRoll: 0.6, pitchFloorDeg: -20,
  castRadius: 0.4, heightTau: 0.12, fovTau: 0.25, pullFloor: 2.2, pullLift: 0.8,
  cobbleShake: 0.02, cobbleHz: 8,
};

// Debug knob (never set by the game): ?cam=distance,distanceFast,height,lookAhead,lookHeight,fovLandscape,fovPortrait,portraitDistance,portraitDistanceFast,portraitHeight
// overrides the framing constants so a probe can A/B the chase framing without an edit. Blank fields keep the default.
try {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('cam') : null;
  if (q) {
    const keys = ['distance', 'distanceFast', 'height', 'lookAhead', 'lookHeight', 'fovLandscape', 'fovPortrait', 'portraitDistance', 'portraitDistanceFast', 'portraitHeight'];
    q.split(',').forEach((v, i) => { const n = parseFloat(v); if (Number.isFinite(n) && keys[i]) CAMERA[keys[i]] = n; });
    console.info('[camera] ?cam override ' + keys.map((k) => k + '=' + CAMERA[k]).join(' '));
  }
} catch (e) { /* no location in node */ }

/** The pitch the constants give at rest, degrees (negative is down); telemetry's rest pitch should be this. */
export const REST_PITCH_DEG = -Math.atan2(CAMERA.height - CAMERA.lookHeight, CAMERA.distance + CAMERA.lookAhead) * 180 / Math.PI;

/** Live chase state for the kart views (near camera cull): written every update. */
export const CHASE = { camera: null, position: new THREE.Vector3(), forward: new THREE.Vector3(0, 0, 1), bodyId: null, active: false };

const TAU = Math.PI * 2;
const wrapAngle = (a) => { a = a % TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

const _pos = new THREE.Vector3(), _look = new THREE.Vector3(), _from = new THREE.Vector3(), _dir = new THREE.Vector3();
const _q = new THREE.Quaternion(), _fwd = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();
const _zAxis = new THREE.Vector3(0, 0, 1);

export class ChaseCamera {
  constructor({ camera, world = null, tier = null } = {}) {
    this.camera = camera;
    this.world = world;
    this.tier = tier;
    this.yaw = 0;               // smoothed yaw (heading convention: 0 faces +Z, ccw from above)
    this.yawVel = 0;
    this.groundY = 0;           // smoothed road height under the kart
    this.fov = CAMERA.fovLandscape;
    this.driftLag = 0;          // radians, smoothed
    this.roll = 0;
    this.pitchDeg = 0;
    this.rollDeg = 0;
    this.distance = CAMERA.distance;
    this.shake = 0;
    this.time = 0;
    this.boostVis = 0;
    this.position = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.enabled = true;
    this._snapped = false;
    this._lastState = 'race';
    this.restPitchDeg = REST_PITCH_DEG;
  }

  get portrait() {
    const c = this.camera;
    if (c && typeof c.aspect === 'number') return c.aspect < 1;
    return (globalThis.innerHeight || 1) > (globalThis.innerWidth || 2);
  }

  /** Place the camera instantly behind the body: at the grid and after a respawn. */
  snapTo(body) {
    if (!body) return;
    this.yaw = body.heading; this.yawVel = 0;
    this.groundY = typeof body.groundY === 'number' ? body.groundY : body.pos.y;
    this.driftLag = 0; this.roll = 0; this.shake = 0;
    this.distance = this.portrait ? CAMERA.portraitDistance : CAMERA.distance;
    this.fov = this.portrait ? CAMERA.fovPortrait : CAMERA.fovLandscape;
    this._snapped = true;
    this._place(body, 0, true);
  }

  update(dt, body) {
    if (!body || !this.camera) return;
    if (!(dt > 0)) dt = 1 / 60;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    if (!this._snapped) { this.snapTo(body); return; }

    // a respawn places the kart elsewhere behind the fade: snap when the hold starts
    if (body.state === 'respawn' && body.respawnPhase === 'hold' && this._lastState !== 'hold') this.snapTo(body);
    this._lastState = body.state === 'respawn' ? body.respawnPhase : body.state;
    if (body.state === 'fall') { this._place(body, dt, false); return; }   // the camera stays put and watches the fall

    // yaw: critically damped spring to the heading plus the drift lag
    const drifting = body.drift && body.drift.active;
    const lagTarget = drifting ? body.drift.dir * CAMERA.driftLagDeg * Math.PI / 180 : 0;
    this.driftLag += (lagTarget - this.driftLag) * Math.min(1, dt / 0.3);
    const targetYaw = body.heading + this.driftLag;   // heading falls in a right drift, so +dir lags toward where the kart was pointing
    const w = 2 / CAMERA.yawTau;
    const err = wrapAngle(targetYaw - this.yaw);
    // x'' = w^2 err - 2 w x'
    this.yawVel += (w * w * err - 2 * w * this.yawVel) * dt;
    this.yaw = wrapAngle(this.yaw + this.yawVel * dt);

    // height follows the road, not the hop
    const gy = typeof body.groundY === 'number' && Number.isFinite(body.groundY) ? body.groundY : body.pos.y;
    this.groundY += (gy - this.groundY) * Math.min(1, dt / CAMERA.heightTau);

    // distance and fov with speed and boost
    const sp = clamp(Math.abs(body.speed) / KART.vmax, 0, 1.4);
    const boosting = body.boost > 0 ? 1 : 0;
    this.boostVis += (boosting - this.boostVis) * Math.min(1, dt / 0.2);
    const portrait = this.portrait;
    const dTarget = portrait ? lerp(CAMERA.portraitDistance, CAMERA.portraitDistanceFast, clamp(sp, 0, 1)) : lerp(CAMERA.distance, CAMERA.distanceFast, clamp(sp, 0, 1));
    this.distance += (dTarget - this.distance) * Math.min(1, dt / 0.3);
    const fovBase = portrait ? CAMERA.fovPortrait : CAMERA.fovLandscape;
    const fovTarget = fovBase + CAMERA.fovSpeed * clamp(sp, 0, 1) + CAMERA.fovBoost * this.boostVis;
    this.fov += (fovTarget - this.fov) * Math.min(1, dt / CAMERA.fovTau);

    // roll: 60% of the bank, read from the body's ground tilt
    const bank = body.tilt ? body.tilt.roll : 0;
    this.roll += (bank * CAMERA.bankRoll - this.roll) * Math.min(1, dt / 0.25);

    // shakes
    if (body.state === 'spin' && body.spinT < 0.1) this.shake = Math.max(this.shake, 0.12);
    this.shake = Math.max(0, this.shake - dt * 0.5);

    this._place(body, dt, false);
  }

  _place(body, dt, hard) {
    const cam = this.camera;
    _fwd.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const kx = body.pos.x, kz = body.pos.z;
    const baseY = this.groundY;
    const camH = this.portrait ? CAMERA.portraitHeight : CAMERA.height;

    // desired position: behind along the smoothed heading, above the road
    _pos.set(kx - _fwd.x * this.distance, baseY + camH, kz - _fwd.z * this.distance);
    // look target: ahead of the kart along ITS heading, at 1 m
    const hx = Math.sin(body.heading), hz = Math.cos(body.heading);
    _look.set(kx + hx * CAMERA.lookAhead, baseY + CAMERA.lookHeight, kz + hz * CAMERA.lookAhead);

    // pull in when a wall is between the kart and the camera
    const w = this.world;
    if (w && typeof w.sphereCast === 'function') {
      _from.set(kx, baseY + 1.0, kz);
      let hit = null;
      try { hit = w.sphereCast(_from, _pos, CAMERA.castRadius); } catch (e) { hit = null; }
      if (hit && hit.hit) {
        // never closer than pullFloor: the round 0 floor of 1.2 m put the camera inside the driver's
        // helmet whenever the kart was pinned against a house wall (round 1 gate frame 3); when the
        // wall is nearer than the floor the camera lifts instead, so it looks over the kart's wing
        const full = _from.distanceTo(_pos);
        const hd = (typeof hit.dist === 'number' ? hit.dist : full) - 0.2;
        const d = clamp(hd, CAMERA.pullFloor, full);
        _dir.subVectors(_pos, _from).normalize();
        _pos.copy(_from).addScaledVector(_dir, d);
        if (hd < CAMERA.pullFloor) _pos.y += clamp((CAMERA.pullFloor - hd) * 0.5, 0, CAMERA.pullLift);
      }
    }
    // never under the ground
    if (w && typeof w.groundAt === 'function') {
      let g = null;
      try { g = w.groundAt(_pos.x, _pos.z); } catch (e) { g = null; }
      if (g && typeof g.y === 'number' && Number.isFinite(g.y) && g.surface !== 'water' && g.surface !== 'air') _pos.y = Math.max(_pos.y, g.y + 0.6);
    }

    // pitch floor: the look direction never drops below the horizon minus 20 degrees
    _dir.subVectors(_look, _pos);
    const horiz = Math.hypot(_dir.x, _dir.z);
    let pitch = Math.atan2(_dir.y, horiz);
    const floor = CAMERA.pitchFloorDeg * Math.PI / 180;
    if (pitch < floor) { _dir.y = Math.tan(floor) * horiz; _look.copy(_pos).add(_dir); pitch = floor; }

    // shakes: cobbles at 8 Hz, spin impulse
    if (dt > 0) {
      let amp = 0;
      if (body.cobbleShake && Math.abs(body.speed) > 4) amp += CAMERA.cobbleShake * clamp(Math.abs(body.speed) / 12, 0.3, 1);
      amp += this.shake;
      if (amp > 0) {
        const t = this.time * CAMERA.cobbleHz * TAU;
        _pos.y += Math.sin(t) * amp;
        _pos.x += Math.cos(t * 0.7) * amp * 0.5 * -Math.cos(this.yaw);
        _pos.z += Math.cos(t * 0.7) * amp * 0.5 * Math.sin(this.yaw);
      }
    }

    cam.position.copy(_pos);
    _m.lookAt(_pos, _look, _up);
    cam.quaternion.setFromRotationMatrix(_m);
    if (this.roll) { _q.setFromAxisAngle(_zAxis, this.roll); cam.quaternion.multiply(_q); }
    this.position.copy(_pos); this.target.copy(_look);
    // the live state the kart views read
    CHASE.camera = cam; CHASE.position.copy(_pos); CHASE.forward.copy(_dir).normalize(); CHASE.bodyId = body.id; CHASE.active = true;

    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    this.pitchDeg = pitch * 180 / Math.PI;
    this.rollDeg = this.roll * 180 / Math.PI;
  }
}
