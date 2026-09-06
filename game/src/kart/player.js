/**
 * DRIVE  src/kart/player.js  (owner: kart)
 *
 * Maps the ui module's Input (keyboard) and TouchControls (phone) onto one KartBody's input
 * each frame, and turns the item key into a 'useItem' event.
 *
 *   const player = new Player({ body, input, touch, events, tier });
 *   player.update(dt);      // before body.update(dt)
 *
 * Keyboard: throttle -1..1, steer -1..1, hop held, item one shot. Touch: steer -1..1, hop held,
 * item one shot, brake held; the phone auto accelerates (there is no gas button in r0), so on
 * the phone tier or once a touch is seen the throttle is +1 unless brake is held.
 *
 * The item flag is edge detected here, so it fires once per press whether or not the
 * integrator calls input.consume() (the ui module owns consume; this module never calls it).
 * 'useItem' carries { id, backwards } with backwards true while brake (ArrowDown, S, #bbrake)
 * is held, which fires a projectile backwards.
 */
export class Player {
  constructor({ body, input = null, touch = null, events = null, tier = null } = {}) {
    this.body = body;
    this.input = input;
    this.touch = touch;
    this.events = events;
    this.tier = tier;
    this.autoAccelerate = !!(tier && (tier === 'phone' || tier.name === 'phone')) || !!(touch && touch.enabled);
    this.enabled = true;              // false during screens; the body then coasts
    this._itemWas = false;
    this._touchSeen = false;
    this.itemsUsed = 0;
    this.lastUse = null;
  }

  update(dt) {
    const b = this.body;
    if (!b) return;
    const inp = this.input, t = this.touch;
    const bi = b.input;
    if (!this.enabled) { bi.throttle = 0; bi.steer = 0; bi.hop = false; bi.item = false; return; }

    const touchOn = !!(t && t.enabled);
    if (touchOn) this._touchSeen = true;
    const auto = this.autoAccelerate || this._touchSeen;

    // throttle
    let throttle = inp ? num(inp.throttle) : 0;
    const brakeHeld = !!(t && t.brake) || throttle < -0.5;
    if (auto) throttle = brakeHeld ? -1 : Math.max(throttle, 1);
    if (t && t.brake) throttle = -1;

    // steer: keyboard plus touch, clamped
    let steer = (inp ? num(inp.steer) : 0) + (t ? num(t.steer) : 0);
    if (steer > 1) steer = 1; else if (steer < -1) steer = -1;

    // hop and drift: held
    const hop = !!(inp && inp.hop) || !!(t && t.hop);

    // item: one shot on the rising edge. The keyboard's one shot flag is read first; the held key
    // set is the fallback for an integrator that calls input.consume() BEFORE player.update (a human
    // press lasts several frames, so the edge is still seen once).
    const held = !!(inp && inp.down && typeof inp.down.has === 'function' && inp.down.has('item'));
    const itemNow = !!(inp && inp.item) || held || !!(t && t.item);
    const fire = itemNow && !this._itemWas;
    this._itemWas = itemNow;

    bi.throttle = throttle;
    bi.steer = steer;
    bi.hop = hop;
    bi.item = fire;

    if (fire && b.state !== 'countdown' && b.state !== 'finished') {
      const backwards = brakeHeld;
      this.itemsUsed += 1;
      this.lastUse = { id: b.id, backwards, time: b.time };
      if (this.events && typeof this.events.emit === 'function') this.events.emit('useItem', { id: b.id, backwards });
    }
  }
}

function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : 0; }
