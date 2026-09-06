/**
 * DRIVE  src/audio/audio.js  (owner: audio)
 *
 * Every sound in the game is an mp3 in ./audio/ generated through Atlas (tools/genaudio.py: ElevenLabs
 * SFX v2 for effects and ambience, Google Lyria 3 Pro for the music). Modelled on refs/rust17/audio.js.
 *
 * Silent until the first gesture: the constructor only binds event handlers. start() (main.js calls it
 * from the start button) creates the AudioContext, fetches and decodes the files, then runs:
 *   - the engine loop, pitched 0.7 to 1.9 by speed with a rev smoothing, plus a boost layer (filtered
 *     noise wind and an engine rate lift) while the kart is over its cap
 *   - the drift scrape loop while a drift is active, pitched by speed, with a tick per charge tier
 *   - per surface roll noise (asphalt hiss, cobble rumble, sand and grass mush; nothing in the air or water)
 *   - positioned one shots for the other seven karts: distance gain and a stereo pan from the listener's
 *     heading (physics.js: forward = (sin h, 0, cos h), right of travel = (-cos h, 0, sin h))
 *   - the sea and gull ambience, and a crowd bed that swells near the grandstand, the piazza and the lay by
 *   - four music states (title, race, final, results), each on its own gain, crossfaded
 * Loops are made seamless at decode time (makeSeamless: trim the codec silence, crossfade the tail into the
 * head) so a Lyria loop cut on a bar and the 4 s engine loop have no click at the seam.
 *
 * state: 'silent' before start(), 'ready' once the context exists, 'playing' once the files are decoded and
 * the engine and music run. Telemetry publishes it; the gate asserts 'silent' before the gesture.
 *
 * Missing files: with ?strict=1 in the URL (karttest sets it) a file that fails to fetch or decode is a hard
 * failure (console.error + throw, window.__AUDIO_MISSING__ lists them); in production it is a warning and the
 * sound is skipped. The countdown beeps have a procedural fallback so the 3, 2, 1, GO is never silent while the
 * files are still decoding on a slow phone.
 *
 * Events consumed (src/game/events.js): countdown, go, itemPickup, itemReady, itemUsed, hit, spin, bump, restart,
 * boostPad, miniTurbo, respawn, fallStart, lapComplete, lapCrossed, finalLap, finish, placeChange, uiClick,
 * shieldUp, shieldPop, buoyLock, bounce, crateDrop, raceEnd.
 */

const FILES = {
  engine_loop: ['engine_loop'], drift_scrape: ['drift_scrape'], buoy_whir: ['buoy_whir'],
  miniturbo_1: ['miniturbo_1'], miniturbo_2: ['miniturbo_2'], miniturbo_3: ['miniturbo_3'],
  boost: ['boost'], pad: ['pad'], item_roulette_tick: ['item_roulette_tick'], item_pickup: ['item_pickup'],
  buoy_launch: ['buoy_launch'], cannonball_fire: ['cannonball_fire'], cannonball_bounce: ['cannonball_bounce_1', 'cannonball_bounce_2'],
  crate_drop: ['crate_drop'], crate_spill: ['crate_spill'], shield_up: ['shield_up'], shield_pop: ['shield_pop'],
  hit_spin: ['hit_spin'], bump: ['bump_1', 'bump_2'], splash: ['splash'], respawn: ['respawn'],
  countdown_beep: ['countdown_beep'], countdown_go: ['countdown_go'], lap_bell: ['lap_bell'], final_lap_sting: ['final_lap_sting'],
  finish_fanfare: ['finish_fanfare'], place_up: ['place_up'], place_down: ['place_down'], ui_click: ['ui_click'],
  ambience_sea_gulls: ['ambience_sea_gulls'], ambience_crowd: ['ambience_crowd'],
  music_title: ['music_title'], music_race: ['music_race'], music_final: ['music_final'], music_results: ['music_results'],
};
// loop seam crossfade in seconds per file (everything listed here loops; the rest are one shots)
const LOOPS = { engine_loop: 0.25, drift_scrape: 0.3, buoy_whir: 0.3, ambience_sea_gulls: 2.0, ambience_crowd: 1.5, music_title: 1.0, music_race: 1.0, music_final: 1.0 };
const MUSIC = { title: 'music_title', race: 'music_race', final: 'music_final', results: 'music_results' };
const VOL = { master: 0.8, music: 0.34, ambience: 0.42, engine: 0.5, sfx: 1.0 };
const VMAX = 24;
// crowd beds (track plan): the start grandstand on the quay, the church hairpin piazza, the cliff entry lay by
const CROWD_SPOTS = [{ x: -122, z: -50, r: 55 }, { x: 160, z: -122, r: 45 }, { x: 76, z: 90, r: 35 }, { x: 60, z: -158, r: 30 }];
const KART_RADIUS_GAIN = 420;   // 1 / (1 + d*d / this): a kart 20 m away is at half gain

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Audio {
  /**
   * @param {object} o
   * @param {{on:Function}} o.events        the game event bus (src/game/events.js)
   * @param {() => object} o.listener       returns the player's KartBody (pos, heading, speed, surface, drift, boost, id)
   * @param {string} [o.base]               './audio/'
   * @param {(id) => object} [o.bodyOf]     optional: KartBody by racer id, for positioned one shots of the other karts
   * @param {boolean} [o.autoPreload]       fetch the mp3 bytes (no context, still silent) once window.__READY__ is true; default true
   */
  constructor({ events, listener, base = './audio/', bodyOf = null, autoPreload = true } = {}) {
    this.events = events || null; this.listener = listener || (() => null); this.base = base; this.bodyOf = bodyOf;
    this.state = 'silent';
    this.ctx = null; this.master = null; this.buffers = new Map(); this.loaded = false; this.missing = [];
    this.strict = /[?&]strict=1/.test(typeof location !== 'undefined' ? location.search : '');
    this.enabled = true;
    this.musicGain = null; this.musicSrc = null; this.musicKey = null; this.musicOut = null; this._pendingMusic = null;
    this.ambienceOn = false; this._pendingAmbience = false; this.amb = null;
    this.engine = null; this.rev = 0.7; this._lastTier = 0; this._lastDrift = false; this._lastBoost = 0;
    this.whir = null; this._recent = new Map(); this._lapSeen = new Set(); this._placeAt = 0;
    this._fetching = null; this._raw = new Map(); this.preloaded = false;
    this._bind();
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => this._visibility());
    // Fetch the bytes once the game is READY (window.__READY__), before any gesture: no AudioContext is created and
    // nothing plays, so the state stays 'silent', but on a phone over 4G the 1.9 MB is already in memory when the
    // button is pressed and the engine and music start within the decode time instead of the download time.
    // Polling after READY keeps the audio fetch out of the 8 s ready budget. autoPreload: false turns it off.
    if (autoPreload && typeof setInterval === 'function') {
      let n = 0;
      this._readyPoll = setInterval(() => {
        if (globalThis.__READY__ === true || ++n > 400) { clearInterval(this._readyPoll); this._readyPoll = null; if (globalThis.__READY__ === true) this.preload(); }
      }, 250);
    }
  }

  // ---------------------------------------------------------------- lifecycle
  /** Fetch the mp3 bytes early (no AudioContext, still silent) so the gesture only has to decode. Optional. */
  preload() {
    if (this._fetching) return this._fetching;
    const stamp = globalThis.__BUILD_STAMP__ ? `?v=${globalThis.__BUILD_STAMP__}` : '';
    const names = new Set(); for (const list of Object.values(FILES)) for (const n of list) names.add(n);
    this._fetching = Promise.all([...names].map(async (n) => {
      try {
        const r = await fetch(`${this.base}${n}.mp3${stamp}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        this._raw.set(n, await r.arrayBuffer());
      } catch (e) { this._raw.set(n, null); }
    })).then(() => { this.preloaded = true; });
    return this._fetching;
  }

  /** Create the context on the first gesture. Safe to call again (resumes a suspended context). */
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) { console.warn('[audio] no AudioContext in this browser'); return; }
    try {
      this.ctx = new AC({ latencyHint: 'interactive' });
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      this.state = 'ready';
      const ctx = this.ctx;
      this.master = ctx.createGain(); this.master.gain.value = VOL.master; this.master.connect(ctx.destination);
      this.sfxGain = ctx.createGain(); this.sfxGain.gain.value = VOL.sfx; this.sfxGain.connect(this.master);
      this.musicGain = ctx.createGain(); this.musicGain.gain.value = VOL.music; this.musicGain.connect(this.master);
      this.ambGain = ctx.createGain(); this.ambGain.gain.value = VOL.ambience; this.ambGain.connect(this.master);
      this.engineGain = ctx.createGain(); this.engineGain.gain.value = VOL.engine; this.engineGain.connect(this.master);
      this.noise = this._noiseBuffer(1.5);
      this._load();
    } catch (e) { console.warn('[audio] start failed', e); this.ctx = null; this.state = 'silent'; }
  }

  async _load() {
    await this.preload();
    const ctx = this.ctx; if (!ctx) return;
    const missing = [];
    await Promise.all([...this._raw.entries()].map(async ([n, ab]) => {
      if (!ab) { missing.push(n); return; }
      try {
        let buf = await ctx.decodeAudioData(ab.slice(0));
        if (LOOPS[n]) buf = makeSeamless(ctx, buf, LOOPS[n]);
        this.buffers.set(n, buf);
      } catch (e) { missing.push(n); }
    }));
    this._raw.clear();
    this.missing = missing;
    if (missing.length) {
      globalThis.__AUDIO_MISSING__ = missing.slice();
      const msg = `[audio] ${missing.length} audio file(s) failed to load: ${missing.join(', ')}`;
      if (this.strict) { console.error(msg); this.loaded = true; this.state = 'ready'; throw new Error(msg); }
      console.warn(msg + ' (skipped)');
    }
    this.loaded = true;
    console.info(`[audio] ${this.buffers.size} sounds decoded${missing.length ? `, ${missing.length} missing` : ''}`);
    this._startEngine();
    if (this._pendingMusic) { const k = this._pendingMusic; this._pendingMusic = null; this.music(k, 0.8); }
    if (this._pendingAmbience || this.ambienceOn) this.ambience(true);
    this.state = 'playing';
  }

  /** Pause and resume the whole mix (Esc). */
  pause(on) {
    if (!this.ctx) return;
    if (on) this.ctx.suspend().catch(() => {}); else this.ctx.resume().catch(() => {});
  }
  setEnabled(on) { this.enabled = !!on; if (this.master) this.master.gain.setTargetAtTime(on ? VOL.master : 0, this.ctx.currentTime, 0.05); }
  _visibility() { if (!this.master || !this.enabled) return; this.master.gain.setTargetAtTime(document.hidden ? 0 : VOL.master, this.ctx.currentTime, 0.05); }

  // ---------------------------------------------------------------- helpers
  _noiseBuffer(sec) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  _buf(key) {
    const list = FILES[key]; if (!list) return null;
    const have = list.filter((n) => this.buffers.has(n));
    if (!have.length) return null;
    return this.buffers.get(have[(Math.random() * have.length) | 0]);
  }
  _me() { try { return this.listener() || null; } catch (e) { return null; } }
  _isMe(id) { const me = this._me(); return !me || id == null || id === me.id || id === 'player'; }
  _posOf(id) {
    if (this.bodyOf) { try { const b = this.bodyOf(id); if (b && b.pos) return b.pos; } catch (e) { /* no body */ } }
    return null;
  }
  /** distance gain and stereo pan of a world position relative to the listener kart */
  _spatial(pos) {
    const me = this._me();
    if (!pos || !me || !me.pos) return { gain: 1, pan: 0, d: 0 };
    const dx = pos.x - me.pos.x, dz = pos.z - me.pos.z, d = Math.hypot(dx, dz);
    const gain = 1 / (1 + (d * d) / KART_RADIUS_GAIN);
    const h = me.heading || 0, rx = -Math.cos(h), rz = Math.sin(h);
    const pan = d > 0.5 ? clamp(((dx * rx + dz * rz) / d) * 0.8, -1, 1) : 0;
    return { gain, pan, d };
  }
  _voice(pos, vol, out) {
    const ctx = this.ctx; if (!ctx) return null;
    const { gain, pan } = this._spatial(pos);
    const g = ctx.createGain(); g.gain.value = vol * gain;
    let node = g;
    if (ctx.createStereoPanner && pos) { const sp = ctx.createStereoPanner(); sp.pan.value = pan; g.connect(sp); node = sp; }
    node.connect(out || this.sfxGain);
    return g;
  }
  /** play a file variant at pos (null = on the listener). jitter in cents. Returns the source or null. */
  _play(key, pos = null, vol = 1, { jitter = 40, rate = 1, out = null, loop = false, delay = 0 } = {}) {
    const ctx = this.ctx; if (!ctx || !this.enabled) return null;
    const buf = this._buf(key); if (!buf) return null;
    const dest = this._voice(pos, vol, out); if (!dest) return null;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = loop;
    src.playbackRate.value = rate * Math.pow(2, ((Math.random() * 2 - 1) * jitter) / 1200);
    src.connect(dest); src.start(ctx.currentTime + delay);
    src.onended = () => { try { src.disconnect(); dest.disconnect(); } catch (e) { /* gone */ } };
    return src;
  }
  /** true when the same (key, id) fired within ms: two modules announcing one thing play one sound */
  _dedupe(key, id, ms) {
    const k = key + '|' + id, now = performance.now(), last = this._recent.get(k) || -1e9;
    if (now - last < ms) return true;
    this._recent.set(k, now); return false;
  }
  _playFor(id, key, volNear, volFar, opts = {}) {
    if (this._isMe(id)) return this._play(key, null, volNear, opts);
    const pos = this._posOf(id);
    if (!pos) return null;   // an AI kart we cannot place: nothing, rather than a sound in the player's ear
    return this._play(key, pos, volFar, opts);
  }

  // ---------------------------------------------------------------- engine, drift, surface (continuous)
  _startEngine() {
    const ctx = this.ctx; if (!ctx || this.engine) return;
    const E = { };
    // engine loop
    E.gain = ctx.createGain(); E.gain.gain.value = 0; E.gain.connect(this.engineGain);
    E.src = this._play('engine_loop', null, 1, { jitter: 0, out: E.gain, loop: true });
    // boost layer: band passed wind
    E.boostGain = ctx.createGain(); E.boostGain.gain.value = 0; E.boostGain.connect(this.engineGain);
    E.boostF = ctx.createBiquadFilter(); E.boostF.type = 'bandpass'; E.boostF.frequency.value = 1400; E.boostF.Q.value = 0.6; E.boostF.connect(E.boostGain);
    E.boostSrc = ctx.createBufferSource(); E.boostSrc.buffer = this.noise; E.boostSrc.loop = true; E.boostSrc.connect(E.boostF); E.boostSrc.start();
    // drift scrape
    E.driftGain = ctx.createGain(); E.driftGain.gain.value = 0; E.driftGain.connect(this.engineGain);
    E.driftSrc = this._play('drift_scrape', null, 1, { jitter: 0, out: E.driftGain, loop: true });
    // surface roll noise: one noise source, a low pass whose cutoff and gain follow the surface
    E.rollGain = ctx.createGain(); E.rollGain.gain.value = 0; E.rollGain.connect(this.engineGain);
    E.rollF = ctx.createBiquadFilter(); E.rollF.type = 'lowpass'; E.rollF.frequency.value = 900; E.rollF.Q.value = 0.5; E.rollF.connect(E.rollGain);
    E.rollSrc = ctx.createBufferSource(); E.rollSrc.buffer = this.noise; E.rollSrc.loop = true; E.rollSrc.playbackRate.value = 0.7; E.rollSrc.connect(E.rollF); E.rollSrc.start();
    // cobble rumble: a second, slower noise through a tight low pass, gated by the surface
    E.rumbleGain = ctx.createGain(); E.rumbleGain.gain.value = 0; E.rumbleGain.connect(this.engineGain);
    E.rumbleF = ctx.createBiquadFilter(); E.rumbleF.type = 'lowpass'; E.rumbleF.frequency.value = 220; E.rumbleF.Q.value = 1.2; E.rumbleF.connect(E.rumbleGain);
    E.rumbleSrc = ctx.createBufferSource(); E.rumbleSrc.buffer = this.noise; E.rumbleSrc.loop = true; E.rumbleSrc.playbackRate.value = 0.35; E.rumbleSrc.connect(E.rumbleF); E.rumbleSrc.start();
    this.engine = E;
  }

  /**
   * Per frame from main.js after the simulation. `s` may be omitted; then the listener body is read.
   * @param {number} dt
   * @param {{speed?:number, drift?:{active:boolean,tier:number,charge:number}, boost?:number, surface?:string, position?:number, lap?:number, state?:string}} [s]
   */
  update(dt = 0.016, s = null) {
    const ctx = this.ctx; if (!ctx || !this.loaded) return;
    const me = this._me();
    const src = s || me || {};
    const speed = Math.abs(src.speed || 0);
    const drift = src.drift || { active: false, tier: 0, charge: 0 };
    const boost = src.boost || 0;
    const surface = src.surface || 'asphalt';
    const state = src.state || (me && me.state) || 'race';
    const grounded = me && me.grounded != null ? me.grounded : true;
    const t = ctx.currentTime, E = this.engine;
    const throttle = me && me.input ? clamp(me.input.throttle || 0, -1, 1) : (speed > 1 ? 1 : 0);
    if (E) {
      // engine: pitch 0.7 at rest to 1.9 at vmax, boost lifts it, a spin or a fall drops the revs
      const dead = state === 'spin' || state === 'fall' || state === 'respawn';
      let target = 0.7 + 1.2 * clamp(speed / VMAX, 0, 1.15) + (boost > 0 ? 0.12 : 0) + (state === 'countdown' && throttle > 0.2 ? 0.45 : 0);
      if (dead) target = 0.62;
      const k = 1 - Math.exp(-dt * (target > this.rev ? 5.5 : 3.2));
      this.rev = clamp(this.rev + (target - this.rev) * k, 0.6, 1.9);
      if (E.src) E.src.playbackRate.setTargetAtTime(this.rev, t, 0.03);
      const eg = dead ? 0.22 : 0.34 + 0.26 * clamp(speed / VMAX, 0, 1) + 0.12 * Math.max(0, throttle);
      E.gain.gain.setTargetAtTime(eg, t, 0.08);
      // boost layer
      E.boostGain.gain.setTargetAtTime(boost > 0 ? 0.28 + 0.1 * clamp(boost, 0, 1) : 0, t, boost > 0 ? 0.05 : 0.25);
      E.boostF.frequency.setTargetAtTime(900 + 900 * clamp(speed / VMAX, 0, 1.2), t, 0.1);
      // drift scrape
      const drifting = !!drift.active && speed > 5 && grounded;
      E.driftGain.gain.setTargetAtTime(drifting ? 0.32 + 0.18 * clamp(speed / VMAX, 0, 1) : 0, t, drifting ? 0.06 : 0.12);
      if (E.driftSrc) E.driftSrc.playbackRate.setTargetAtTime(0.85 + 0.4 * clamp(speed / VMAX, 0, 1), t, 0.1);
      if (drifting && (drift.tier || 0) > this._lastTier) this._play('place_up', null, 0.22, { rate: 1.1 + 0.18 * drift.tier, jitter: 10 });
      this._lastTier = drifting ? (drift.tier || 0) : 0;
      // surface roll noise
      const sp = clamp(speed / VMAX, 0, 1.2), moving = grounded && speed > 1.5 && !dead;
      let rollG = 0, rollF = 900, rumble = 0;
      if (moving) {
        if (surface === 'asphalt' || surface === 'pad' || surface === 'kerb') { rollG = 0.06 + 0.1 * sp; rollF = 700 + 900 * sp; }
        else if (surface === 'cobble') { rollG = 0.08 + 0.1 * sp; rollF = 500 + 500 * sp; rumble = 0.16 + 0.22 * sp; }
        else if (surface === 'sand') { rollG = 0.14 + 0.16 * sp; rollF = 1600 + 800 * sp; }
        else if (surface === 'grass') { rollG = 0.1 + 0.14 * sp; rollF = 1100 + 600 * sp; rumble = 0.05 * sp; }
        // 'air' and 'water': nothing rolls
      }
      E.rollGain.gain.setTargetAtTime(rollG, t, 0.1); E.rollF.frequency.setTargetAtTime(rollF, t, 0.1);
      E.rumbleGain.gain.setTargetAtTime(rumble, t, 0.1);
      if (E.rumbleSrc) E.rumbleSrc.playbackRate.setTargetAtTime(0.25 + 0.3 * sp, t, 0.1);
    }
    // the buoy whir homing on the player: gain rises as it closes (we only know time, not distance)
    if (this.whir) {
      this.whir.t += dt;
      const g = clamp(0.15 + this.whir.t * 0.06, 0.15, 0.55);
      this.whir.gain.gain.setTargetAtTime(g, t, 0.1);
      if (this.whir.t > 8.5) this._stopWhir();
    }
    // ambience beds follow the listener: the crowd swells near the spots, the sea near the water
    if (this.amb && me && me.pos) {
      let crowd = 0.12;
      for (const c of CROWD_SPOTS) { const d = Math.hypot(me.pos.x - c.x, me.pos.z - c.z); crowd = Math.max(crowd, 1 / (1 + (d * d) / (c.r * c.r))); }
      const seaX = clamp((-110 - me.pos.x) / 60, 0, 1), seaZ = clamp((me.pos.z - 60) / 60, 0, 1);
      const sea = 0.55 + 0.45 * Math.max(seaX, seaZ);
      this.amb.crowd.gain.setTargetAtTime(crowd * 0.9, t, 0.4);
      this.amb.sea.gain.setTargetAtTime(sea, t, 0.4);
    }
  }

  // ---------------------------------------------------------------- music and ambience
  /** 'title' | 'race' | 'final' | 'results'; crossfades from whatever plays. Queued until the files are decoded. */
  music(key, fade = 1.5) {
    if (!MUSIC[key]) return;
    if (!this.ctx) { this._pendingMusic = key; return; }
    if (!this.loaded) { this._pendingMusic = key; return; }
    if (this.musicKey === key) return;
    const ctx = this.ctx, t = ctx.currentTime, file = MUSIC[key];
    if (this.musicSrc) {
      const old = this.musicSrc, og = this.musicOut;
      og.gain.cancelScheduledValues(t); og.gain.setValueAtTime(og.gain.value, t); og.gain.linearRampToValueAtTime(0, t + fade);
      setTimeout(() => { try { old.stop(); } catch (e) { /* stopped */ } }, fade * 1000 + 120);
    }
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + fade); g.connect(this.musicGain);
    // the final lap theme comes in hotter than a crossfade: a quick dip and a fast rise
    if (key === 'final') { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + 0.5); }
    const src = this._play(file, null, 1, { jitter: 0, out: g, loop: key !== 'results' });
    this.musicSrc = src; this.musicOut = g; this.musicKey = src ? key : null;
    if (src && key === 'results') src.onended = () => { if (this.musicSrc === src) { this.musicSrc = null; this.musicKey = null; } };
  }
  stopMusic(fade = 1.0) {
    if (!this.musicSrc) return;
    const t = this.ctx.currentTime, old = this.musicSrc, og = this.musicOut;
    og.gain.cancelScheduledValues(t); og.gain.setValueAtTime(og.gain.value, t); og.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => { try { old.stop(); } catch (e) { /* stopped */ } }, fade * 1000 + 120);
    this.musicSrc = null; this.musicKey = null;
  }
  /** the sea, gulls and crowd beds; on by default once the files are decoded */
  ambience(on = true) {
    this.ambienceOn = !!on;
    if (!this.ctx || !this.loaded) { this._pendingAmbience = !!on; return; }
    const ctx = this.ctx, t = ctx.currentTime;
    if (on && !this.amb) {
      const sea = ctx.createGain(); sea.gain.value = 0; sea.connect(this.ambGain);
      const crowd = ctx.createGain(); crowd.gain.value = 0; crowd.connect(this.ambGain);
      const seaSrc = this._play('ambience_sea_gulls', null, 1, { jitter: 0, out: sea, loop: true });
      const crowdSrc = this._play('ambience_crowd', null, 1, { jitter: 0, out: crowd, loop: true });
      sea.gain.setTargetAtTime(0.7, t, 1.0); crowd.gain.setTargetAtTime(0.3, t, 1.0);
      this.amb = { sea, crowd, seaSrc, crowdSrc };
    } else if (!on && this.amb) {
      const A = this.amb; this.amb = null;
      A.sea.gain.setTargetAtTime(0, t, 0.4); A.crowd.gain.setTargetAtTime(0, t, 0.4);
      setTimeout(() => { for (const s of [A.seaSrc, A.crowdSrc]) { try { s && s.stop(); } catch (e) { /* stopped */ } } }, 1600);
    }
  }

  // ---------------------------------------------------------------- one shots
  countdown(n) {
    if (n === 0) { this.go(); return; }
    if (!this._play('countdown_beep', null, 0.7, { jitter: 0 })) this._beep(880, 0.12, 0.35);
  }
  go() { if (!this._play('countdown_go', null, 0.8, { jitter: 0 })) this._beep(1320, 0.5, 0.4); }
  uiClick() { this._play('ui_click', null, 0.5, { jitter: 20 }); }
  /** the 1.2 s roulette: ticks that slow as it settles, then item_pickup from itemReady */
  roulette(id) {
    if (!this._isMe(id)) return;
    const ctx = this.ctx; if (!ctx) return;
    let d = 0, gap = 0.07;
    for (let i = 0; i < 14 && d < 1.15; i++) { this._play('item_roulette_tick', null, 0.45, { jitter: 25, delay: d }); d += gap; gap *= 1.09; }
  }
  itemReady(id) { if (this._isMe(id)) this._play('item_pickup', null, 0.7, { jitter: 10 }); }
  itemUsed(id, key) {
    if (this._dedupe('used_' + key, id, 120)) return;
    switch (key) {
      case 'buoy': this._playFor(id, 'buoy_launch', 0.75, 0.6); break;
      case 'cannonball': this._playFor(id, 'cannonball_fire', 0.8, 0.7); break;
      case 'crate': this._playFor(id, 'crate_drop', 0.6, 0.5); break;
      case 'espresso': this._playFor(id, 'boost', 0.8, 0.45, { jitter: 15 }); break;
      case 'shield': this._playFor(id, 'shield_up', 0.7, 0.45); break;
      default: this._playFor(id, 'item_pickup', 0.4, 0.3);
    }
  }
  hit(target, by, key, shielded) {
    if (key === 'buoy' && this._isMe(target)) this._stopWhir();   // the buoy is spent either way
    if (shielded) { if (!this._dedupe('shield_pop', target, 150)) this._playFor(target, 'shield_pop', 0.8, 0.55); return; }
    if (!this._dedupe('spin', target, 250)) this._playFor(target, 'hit_spin', 0.85, 0.6);
    if (key === 'crate') this._playFor(target, 'crate_spill', 0.7, 0.5);
  }
  spin(id) { if (!this._dedupe('spin', id, 250)) this._playFor(id, 'hit_spin', 0.85, 0.6); }
  bump(a, b, speed = 4) {
    const key = a < b ? a + '_' + b : b + '_' + a;
    if (this._dedupe('bump', key, 200)) return;
    const vol = clamp(0.35 + speed * 0.06, 0.35, 0.9);
    if (this._isMe(a) || this._isMe(b)) { this._play('bump', null, vol, { jitter: 80 }); return; }
    const pa = this._posOf(a), pb = this._posOf(b), p = pa || pb;
    if (p) this._play('bump', p, vol * 0.8, { jitter: 80 });
  }
  boostPad(id) { if (!this._dedupe('pad', id, 400)) this._playFor(id, 'pad', 0.7, 0.4, { jitter: 15 }); }
  miniTurbo(id, tier) {
    const key = 'miniturbo_' + clamp(tier | 0, 1, 3);
    if (!this._dedupe(key, id, 300)) this._playFor(id, key, 0.75, 0.45, { jitter: 20 });
  }
  fallStart(id) { this._playFor(id, 'splash', 0.8, 0.5, { jitter: 30, delay: 0.45 }); }
  respawn(id) { if (!this._dedupe('respawn', id, 500)) this._playFor(id, 'respawn', 0.7, 0.3); }
  lapComplete(id, lap) {
    if (!this._isMe(id)) return;
    const k = 'lap' + lap; if (this._lapSeen.has(k)) return; this._lapSeen.add(k);
    this._play('lap_bell', null, 0.7, { jitter: 0 });
  }
  finalLap(id) {
    if (!this._isMe(id) || this._dedupe('final', 'me', 2000)) return;
    this._play('final_lap_sting', null, 0.85, { jitter: 0 });
    this.music('final', 1.0);
  }
  finish(id, position) {
    if (!this._isMe(id) || this._dedupe('finish', 'me', 3000)) return;
    this._play('finish_fanfare', null, 0.9, { jitter: 0 });
    this.stopMusic(1.2);
    setTimeout(() => { if (this.ctx) this.music('results', 1.0); }, 2600);
  }
  placeChange(id, from, to) {
    if (!this._isMe(id) || from == null || to == null || from === to) return;
    const now = performance.now(); if (now - this._placeAt < 350) return; this._placeAt = now;
    this._play(to < from ? 'place_up' : 'place_down', null, 0.55, { jitter: 10 });
  }
  shieldUp(id) { if (!this._dedupe('used_shield', id, 120)) this._playFor(id, 'shield_up', 0.7, 0.45); }
  shieldPop(id) { if (!this._dedupe('shield_pop', id, 150)) this._playFor(id, 'shield_pop', 0.8, 0.55); }
  bounce(x, z) { this._play('cannonball_bounce', { x, z }, 0.6, { jitter: 60 }); }
  crateDrop(id, x, z) { if (!this._dedupe('used_crate', id, 120)) this._play('crate_drop', this._isMe(id) ? null : { x, z }, 0.55, { jitter: 40 }); }
  buoyLock(target) {
    if (!this._isMe(target) || this.whir || !this.ctx) return;
    const g = this.ctx.createGain(); g.gain.value = 0.15; g.connect(this.sfxGain);
    const src = this._play('buoy_whir', null, 1, { jitter: 0, out: g, loop: true });
    if (src) this.whir = { src, gain: g, t: 0 };
  }
  _stopWhir() {
    const w = this.whir; if (!w) return; this.whir = null;
    const t = this.ctx.currentTime; w.gain.gain.setTargetAtTime(0, t, 0.08);
    setTimeout(() => { try { w.src.stop(); } catch (e) { /* stopped */ } }, 400);
  }
  /** everything race related back to the grid (also runs on the 'restart' event); the title theme is the integrator's call (audio.music('title')) */
  reset() {
    this._lapSeen.clear(); this._stopWhir(); this._recent.clear(); this._lastTier = 0; this._placeAt = 0;
    if (this.engine && this.ctx) { this.rev = 0.7; this.engine.boostGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); this.engine.driftGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); }
  }
  /** procedural beep for the countdown while the files are still decoding */
  _beep(freq, dur, vol) {
    const ctx = this.ctx; if (!ctx || !this.enabled) return; const t = ctx.currentTime;
    const osc = ctx.createOscillator(); osc.type = 'square'; osc.frequency.value = freq;
    const env = ctx.createGain(); env.gain.setValueAtTime(vol * 0.5, t); env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(env); env.connect(this.master); osc.start(t); osc.stop(t + dur + 0.02);
  }

  /** a readout for telemetry and the test page */
  debug() {
    return { state: this.state, ctx: this.ctx ? this.ctx.state : null, preloaded: this.preloaded, decoded: this.buffers.size, missing: this.missing.slice(), music: this.musicKey, rev: +this.rev.toFixed(3), ambience: !!this.amb, whir: !!this.whir, lapsSeen: this._lapSeen.size };
  }

  // ---------------------------------------------------------------- events
  _bind() {
    const ev = this.events; if (!ev || typeof ev.on !== 'function') return;
    const P = (p) => p || {};
    ev.on('countdown', (p) => this.countdown(P(p).n));
    ev.on('go', () => this.go());
    ev.on('uiClick', () => this.uiClick());
    ev.on('itemPickup', (p) => { p = P(p); if (p.key === 'roulette' || p.key == null) this.roulette(p.id); else this.itemReady(p.id); });
    ev.on('itemReady', (p) => this.itemReady(P(p).id));
    ev.on('itemUsed', (p) => this.itemUsed(P(p).id, P(p).key));
    ev.on('hit', (p) => this.hit(P(p).target, P(p).by, P(p).key, !!P(p).shielded));
    ev.on('spin', (p) => this.spin(P(p).id));
    ev.on('bump', (p) => this.bump(P(p).a, P(p).b, P(p).speed));
    ev.on('boostPad', (p) => this.boostPad(P(p).id));
    ev.on('miniTurbo', (p) => this.miniTurbo(P(p).id, P(p).tier));
    ev.on('respawn', (p) => this.respawn(P(p).id));
    ev.on('fallStart', (p) => this.fallStart(P(p).id));
    ev.on('lapComplete', (p) => this.lapComplete(P(p).id, P(p).lap));
    ev.on('lapCrossed', (p) => { p = P(p); if (p.lap > 1) this.lapComplete(p.id, p.lap - 1); });
    ev.on('finalLap', (p) => this.finalLap(P(p).id));
    ev.on('finish', (p) => this.finish(P(p).id, P(p).position));
    ev.on('placeChange', (p) => this.placeChange(P(p).id, P(p).from, P(p).to));
    ev.on('shieldUp', (p) => this.shieldUp(P(p).id));
    ev.on('shieldPop', (p) => this.shieldPop(P(p).id));
    ev.on('buoyLock', (p) => this.buoyLock(P(p).target));
    ev.on('bounce', (p) => this.bounce(P(p).x, P(p).z));
    ev.on('crateDrop', (p) => this.crateDrop(P(p).id, P(p).x, P(p).z));
    ev.on('raceEnd', () => { if (this.musicKey !== 'results') { this.stopMusic(1.0); setTimeout(() => { if (this.ctx) this.music('results', 1.0); }, 1200); } });
    ev.on('restart', () => this.reset());
  }
}

/**
 * Make a decoded buffer loop without a click: trim the codec silence at both ends (up to 120 ms below -48 dB),
 * then crossfade `fade` seconds of the tail into the head (equal power) and drop the tail. Returns a new buffer
 * `fade` seconds shorter. A loop shorter than 3 fades is returned trimmed only.
 */
export function makeSeamless(ctx, buf, fade) {
  const sr = buf.sampleRate, ch = buf.numberOfChannels, thr = 0.004, maxTrim = Math.floor(sr * 0.12);
  let s = 0, e = buf.length;
  const above = (i) => { for (let c = 0; c < ch; c++) if (Math.abs(buf.getChannelData(c)[i]) > thr) return true; return false; };
  while (s < maxTrim && s < e - 1 && !above(s)) s++;
  while (e - 1 > s && buf.length - e < maxTrim && !above(e - 1)) e--;
  const len = e - s, f = Math.min(Math.floor(fade * sr), Math.floor(len / 3));
  if (f < 16) {
    const out = ctx.createBuffer(ch, len, sr);
    for (let c = 0; c < ch; c++) out.getChannelData(c).set(buf.getChannelData(c).subarray(s, e));
    return out;
  }
  const outLen = len - f, out = ctx.createBuffer(ch, outLen, sr);
  for (let c = 0; c < ch; c++) {
    const src = buf.getChannelData(c), dst = out.getChannelData(c);
    for (let i = 0; i < f; i++) {
      const x = i / f, a = Math.sin(x * Math.PI * 0.5), b = Math.cos(x * Math.PI * 0.5);
      dst[i] = src[s + i] * a + src[s + outLen + i] * b;
    }
    dst.set(src.subarray(s + f, s + outLen), f);
  }
  return out;
}
