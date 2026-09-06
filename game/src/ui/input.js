/**
 * ui/input.js - keyboard input for DRIVE, every key in tools/CONTRACT.md.
 *
 *   accelerate      ArrowUp, KeyW          -> throttle +1
 *   brake, reverse  ArrowDown, KeyS        -> throttle -1
 *   steer           ArrowLeft, KeyA (-1)  ArrowRight, KeyD (+1), ramped over 0.12 s for keyboard feel
 *   hop and drift   Space (held)           -> hop
 *   use item        ShiftLeft, KeyE        -> item, one shot per press
 *   start, confirm  Enter, NumpadEnter     -> start, one shot
 *   pause           Escape                 -> pause, one shot
 *
 * Listens on window (a canvas only gets keys while focused, and the first click after a start
 * button press lands elsewhere), swallows the default action of the game keys so the page never
 * scrolls, and leaves keys alone when focus is in a text field. Every key is released on blur.
 *
 * The one shot flags stay true until consume(); the player calls consume() at the end of its
 * update so a press that lands between two frames is never lost.
 *
 * Signature (docs/ARCHITECTURE.md): new Input(domElement); throttle, steer, hop, item, pause,
 * start; consume().
 */

const STEER_RAMP_S = 0.12;

const KEYS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'hop',
  ShiftLeft: 'item', KeyE: 'item', ShiftRight: 'item',
  Enter: 'start', NumpadEnter: 'start',
  Escape: 'pause',
};

const isTyping = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

export class Input {
  constructor(domElement) {
    this.el = domElement || (typeof document !== 'undefined' ? document : null);
    this.down = new Set();          // actions currently held: up, down, left, right, hop, item, start, pause
    this.codes = new Set();         // raw key codes held
    this._item = false; this._pause = false; this._start = false;
    this._steer = 0; this._steerT = performance.now();
    this.enabled = true;
    this._onDown = (e) => this._keydown(e);
    this._onUp = (e) => this._keyup(e);
    this._onBlur = () => this.release();
    addEventListener('keydown', this._onDown, { passive: false });
    addEventListener('keyup', this._onUp);
    addEventListener('blur', this._onBlur);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.release(); });
  }

  _keydown(e) {
    const a = KEYS[e.code];
    if (!a || isTyping(e.target)) return;
    if (!this.enabled) return;
    // the game keys never scroll the page or trigger a focused button (Space, Enter on #startb
    // are the screens' business: those handle Enter themselves, so only swallow Space and arrows)
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    this.codes.add(e.code);
    if (e.repeat) return;
    this.down.add(a);
    if (a === 'item') this._item = true;
    if (a === 'pause') this._pause = true;
    if (a === 'start') this._start = true;
  }

  _keyup(e) {
    const a = KEYS[e.code];
    if (!a) return;
    this.codes.delete(e.code);
    // an action stays down while ANY of its keys is still held (W and ArrowUp together)
    for (const code of this.codes) if (KEYS[code] === a) return;
    this.down.delete(a);
  }

  /** every key up (blur, hidden tab, a screen taking over) */
  release() { this.down.clear(); this.codes.clear(); }

  get throttle() {
    const up = this.down.has('up'), dn = this.down.has('down');
    return up === dn ? 0 : up ? 1 : -1;
  }

  /** the raw steer target, -1, 0, 1 */
  get steerTarget() {
    const l = this.down.has('left'), r = this.down.has('right');
    return l === r ? 0 : l ? -1 : 1;
  }

  /** ramped toward the target over STEER_RAMP_S from the last read (time based, so any frame rate feels the same) */
  get steer() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this._steerT) / 1000);
    this._steerT = now;
    const target = this.steerTarget;
    const step = dt / STEER_RAMP_S;
    if (target === 0) {
      // return to centre a little faster than the ramp out
      if (Math.abs(this._steer) <= step * 1.5) this._steer = 0;
      else this._steer -= Math.sign(this._steer) * step * 1.5;
    } else if (Math.sign(this._steer) !== Math.sign(target) && this._steer !== 0) {
      // reversing direction: pass through centre quickly
      this._steer += target * step * 2;
      if (Math.sign(this._steer) === Math.sign(target) && Math.abs(this._steer) > 1) this._steer = target;
    } else {
      this._steer += target * step;
      if (Math.abs(this._steer) > 1) this._steer = target;
    }
    return this._steer;
  }

  get hop() { return this.down.has('hop'); }
  get item() { return this._item; }
  get pause() { return this._pause; }
  get start() { return this._start; }
  get brake() { return this.down.has('down'); }

  /** resets the one shot flags (item, pause, start) */
  consume() { this._item = false; this._pause = false; this._start = false; }

  dispose() {
    removeEventListener('keydown', this._onDown);
    removeEventListener('keyup', this._onUp);
    removeEventListener('blur', this._onBlur);
  }
}
