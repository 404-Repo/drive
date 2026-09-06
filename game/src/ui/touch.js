/**
 * ui/touch.js - real multi touch controls for DRIVE on a phone, per tools/CONTRACT.md.
 *
 * Creates (or fills) #touch with
 *   #steerL  #steerR   the steer pads, bottom left, two halves of one cluster (each 104 x 140 css px
 *                      on a 412 x 915 portrait phone; the contract asks for at least 96 x 120)
 *   #bdrift  #bitem    84 px circles bottom right, drift below item; hold drift, tap item
 *   #bbrake            a 64 px button above them; hold to brake or reverse (the phone auto accelerates,
 *                      so there is no #bgas in r0)
 * every one a real element with a bounding box and touch-action:none.
 *
 * Touches are tracked BY IDENTIFIER: touchstart on a control registers that finger's id against
 * the control, touchmove re-evaluates which steer pad a steering finger is over (so a thumb can
 * slide from left to right without lifting), touchend and touchcancel release ONLY the ids in
 * changedTouches. Three fingers down at once (steer + drift + item) therefore work, and a touch
 * that started on the canvas is never in the map, so it is never stolen and never
 * preventDefault-ed. Pointer events are not used for the pads: on iOS a second finger inside the
 * same element does not get its own pointerdown reliably, touch events do.
 *
 * `enabled` shows the layer: true on a touch device, true once any touch is seen anywhere, or set
 * by the integrator on the phone tier. The layer is always laid out (visibility, not display)
 * so the harness can measure the pads before the start tap, and it is under the screens (z 15
 * versus 20), so the start button gets the tap.
 *
 * Signature (docs/ARCHITECTURE.md): new TouchControls(container); enabled; steer -1..1 (ramped
 * over 0.12 s like the keyboard); hop; item (one shot); brake; consume().
 */
import { ensureFonts, CORAL, INK, PAPER, PIX, WIDE, h, isTouchDevice } from './screens.js?v=r0-20260906041519';

const STEER_RAMP_S = 0.12;

const CSS = `
#touch{position:fixed;inset:0;z-index:15;pointer-events:none;visibility:hidden;font-family:${PIX};color:${PAPER};
  -webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;
  --pad:max(12px,env(safe-area-inset-left));--padr:max(16px,env(safe-area-inset-right));--padb:max(24px,env(safe-area-inset-bottom))}
#touch.on{visibility:visible}
#touch.dim{opacity:0;transition:opacity .25s}
#touch .ctl{position:absolute;pointer-events:auto;touch-action:none;box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex-direction:column;
  background:rgba(16,12,10,.42);border:3px solid rgba(242,236,226,.55);color:${PAPER};text-transform:uppercase;letter-spacing:.1em;font-size:11px;
  box-shadow:0 3px 0 rgba(16,12,10,.5);transition:background .08s,border-color .08s,transform .08s}
#touch .ctl.held{background:rgba(237,88,81,.75);border-color:${PAPER};transform:translateY(2px);box-shadow:0 1px 0 rgba(16,12,10,.5)}
#touch .ctl svg{display:block;width:44%;height:44%;pointer-events:none}
#touch .ctl span{pointer-events:none;margin-top:4px}
#steerL,#steerR{bottom:var(--padb);width:104px;height:140px}
#steerL{left:var(--pad);border-right-width:1.5px}
#steerR{left:calc(var(--pad) + 104px);border-left-width:1.5px}
#bdrift,#bitem{right:var(--padr);width:84px;height:84px;border-radius:50%}
#bdrift{bottom:var(--padb)}
#bitem{bottom:calc(var(--padb) + 84px + 14px)}
#bbrake{right:calc(var(--padr) + 10px);bottom:calc(var(--padb) + 84px + 14px + 84px + 14px);width:64px;height:64px;border-radius:50%;font-size:9px}
#bitem{border-color:${CORAL}}
@media (orientation:landscape){
  #steerL,#steerR{height:120px}
  #bbrake{right:calc(var(--padr) + 84px + 18px);bottom:calc(var(--padb) + 10px)}
}
@media (max-width:360px){#steerL,#steerR{width:96px}#steerR{left:calc(var(--pad) + 96px)}}
`;

function ensureStyle() {
  ensureFonts();
  if (document.getElementById('ui-style-touch')) return;
  const s = document.createElement('style'); s.id = 'ui-style-touch'; s.textContent = CSS;
  document.head.appendChild(s);
}

const CHEV = (dir) => `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="${dir < 0 ? 'M30 8 L14 24 L30 40' : 'M18 8 L34 24 L18 40'}" fill="none" stroke="${PAPER}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const DRIFT = `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 36 q4 -20 24 -22" fill="none" stroke="${PAPER}" stroke-width="5" stroke-linecap="round"/><path d="M26 6 l8 8 l-10 4 Z" fill="${PAPER}"/><path d="M12 40 q6 -4 12 0" fill="none" stroke="${CORAL}" stroke-width="4" stroke-linecap="round"/></svg>`;
const ITEM = `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="10" width="28" height="28" fill="none" stroke="${PAPER}" stroke-width="4"/><rect x="19" y="19" width="10" height="10" fill="${CORAL}"/></svg>`;
const BRAKE = `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="20" width="28" height="8" fill="${PAPER}"/></svg>`;

export class TouchControls {
  constructor(container) {
    ensureStyle();
    this.container = container || document.body;
    let el = this.container.querySelector('#touch') || document.getElementById('touch');
    if (!el) { el = h('<div id="touch"></div>'); this.container.appendChild(el); }
    this.el = el;
    el.innerHTML = '';
    const add = (id, inner, label) => { const b = h(`<div id="${id}" class="ctl" data-ctl="${id}">${inner}<span>${label}</span></div>`); el.appendChild(b); return b; };
    this.steerL = add('steerL', CHEV(-1), 'Left');
    this.steerR = add('steerR', CHEV(1), 'Right');
    this.bitem = add('bitem', ITEM, 'Item');
    this.bdrift = add('bdrift', DRIFT, 'Drift');
    this.bbrake = add('bbrake', BRAKE, 'Brake');
    this.ctl = { steerL: this.steerL, steerR: this.steerR, bdrift: this.bdrift, bitem: this.bitem, bbrake: this.bbrake };

    this.fingers = new Map();       // touch identifier -> control id
    this._item = false;
    this._steer = 0; this._steerT = performance.now();
    this._enabled = false;
    this.seen = false;               // a touch has been seen anywhere on the page

    const opts = { passive: false };
    el.addEventListener('touchstart', (e) => this._start(e), opts);
    el.addEventListener('touchmove', (e) => this._move(e), opts);
    // end and cancel are listened for on the window: the browser targets them at the element the
    // touch STARTED on, which is one of ours whenever the id is in the map, and nothing else
    // otherwise, so only our own ids are ever released here
    addEventListener('touchend', (e) => this._end(e), opts);
    addEventListener('touchcancel', (e) => this._end(e), opts);
    // mouse fallback so the pads also work with a mouse on a touch laptop or in a desktop test
    el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') this._mouse(e, true); });
    addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') this._mouse(e, false); });
    addEventListener('blur', () => this.release());
    // the first touch anywhere (the start button tap included) reveals the controls
    addEventListener('touchstart', () => { this.seen = true; if (!this._enabled) this.enabled = true; }, { passive: true, capture: true });

    this.enabled = isTouchDevice() || /[?&]q=phone\b/.test(location.search) || /[?&]touch=1\b/.test(location.search);
  }

  get enabled() { return this._enabled; }
  set enabled(v) { this._enabled = !!v; this.el.classList.toggle('on', this._enabled); if (!this._enabled) this.release(); }

  _ctlOf(target) { const c = target && target.closest ? target.closest('[data-ctl]') : null; return c ? c.dataset.ctl : null; }

  _start(e) {
    let any = false;
    for (const t of e.changedTouches) {
      const id = this._ctlOf(t.target);
      if (!id) continue;
      any = true;
      this.fingers.set(t.identifier, id);
      if (id === 'bitem') this._item = true;
    }
    if (any) { e.preventDefault(); this._paint(); }
  }

  _move(e) {
    let any = false;
    for (const t of e.changedTouches) {
      const cur = this.fingers.get(t.identifier);
      if (cur === undefined) continue;          // a canvas touch wandering over a pad: not ours
      any = true;
      if (cur === 'steerL' || cur === 'steerR') {
        // a steering thumb may slide between the two halves without lifting
        const over = document.elementFromPoint(t.clientX, t.clientY);
        const id = this._ctlOf(over);
        if (id === 'steerL' || id === 'steerR') this.fingers.set(t.identifier, id);
        else {
          // off the pads: keep steering by which side of the cluster the finger is on
          const r = this.steerL.getBoundingClientRect();
          this.fingers.set(t.identifier, t.clientX < r.right ? 'steerL' : 'steerR');
        }
      }
    }
    if (any) { e.preventDefault(); this._paint(); }
  }

  _end(e) {
    let any = false;
    for (const t of e.changedTouches) {
      if (!this.fingers.has(t.identifier)) continue;
      this.fingers.delete(t.identifier);
      any = true;
    }
    if (any) { if (e.cancelable) e.preventDefault(); this._paint(); }
  }

  _mouse(e, down) {
    const key = 'mouse';
    if (down) {
      const id = this._ctlOf(e.target); if (!id) return;
      this.fingers.set(key, id); if (id === 'bitem') this._item = true; e.preventDefault();
    } else if (this.fingers.has(key)) this.fingers.delete(key);
    this._paint();
  }

  _has(id) { for (const v of this.fingers.values()) if (v === id) return true; return false; }

  _paint() {
    for (const [id, el] of Object.entries(this.ctl)) el.classList.toggle('held', this._has(id));
  }

  /** every finger up (blur, a screen taking over) */
  release() { this.fingers.clear(); this._paint(); }

  /** raw steer target from the pads: left -1, right +1, both or none 0 */
  get steerTarget() {
    const l = this._has('steerL'), r = this._has('steerR');
    return l === r ? 0 : l ? -1 : 1;
  }

  /** ramped toward the target over 0.12 s, the same feel as the keyboard */
  get steer() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this._steerT) / 1000);
    this._steerT = now;
    const target = this.steerTarget;
    const step = dt / STEER_RAMP_S;
    if (target === 0) {
      if (Math.abs(this._steer) <= step * 1.5) this._steer = 0;
      else this._steer -= Math.sign(this._steer) * step * 1.5;
    } else if (Math.sign(this._steer) !== Math.sign(target) && this._steer !== 0) {
      this._steer += target * step * 2;
      if (Math.sign(this._steer) === Math.sign(target) && Math.abs(this._steer) > 1) this._steer = target;
    } else {
      this._steer += target * step;
      if (Math.abs(this._steer) > 1) this._steer = target;
    }
    return this._steer;
  }

  get hop() { return this._has('bdrift'); }
  get brake() { return this._has('bbrake'); }
  get item() { return this._item; }
  /** how many fingers are down on the controls right now (telemetry, tests) */
  get fingerCount() { return this.fingers.size; }

  consume() { this._item = false; }
}
