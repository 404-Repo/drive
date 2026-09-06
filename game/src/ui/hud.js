/**
 * ui/hud.js - the in race HUD for DRIVE as DOM, in the 404 deck faces.
 *
 *   position numeral top left in Pilat Extended Black with the ordinal in the pixel face
 *   LAP n/3 top right and the race and best lap times in Helvetica Now Display XBold
 *   item slot top centre: an ink plate with a paper frame, coral base rule and hard offset shadow
 *   (the deck's button language); empty it shows our item box as an outline with a breathing
 *   coral core; the roulette cycles the five icons; icons are inline SVG (original shapes, no text)
 *   countdown 3 2 1 GO in the wide face, centre
 *   banners FINAL LAP, WRONG WAY, FINISH (a coral bar, centre)
 *   place change flash on the numeral, a hit flash, boost speed lines (a restrained radial
 *   streak overlay; setBoost also hands t to an onBoost hook so post.setSpeedLines can follow)
 *   the round tag (r0, r1, ...) in the pixel face bottom right, per tools/CONTRACT.md
 *
 * Signature (docs/ARCHITECTURE.md):
 *   new HUD(container, { round: 'r0', laps: 3 })   creates or reuses #hud
 *   setPosition(p) setLap(lap, total) setItem(key | 'roulette' | null) setTime(race, lapBest)
 *   countdown(n) banner(text) flashPlace(up) setBoost(t) hit() show(bool)
 *
 * The minimap (ui/minimap.js) mounts its canvas inside #hud; everything in here is DOM.
 * Plain hyphens only in every string.
 */
import { ensureFonts, CORAL, INK, PAPER, FONT, WIDE, PIX, h, esc, fmtTime, ordinal } from './screens.js?v=r6-20260906191941';

export const ITEM_KEYS = ['buoy', 'cannonball', 'crate', 'espresso', 'shield'];
export const ITEM_NAMES = { buoy: 'Chaser buoy', cannonball: 'Cannonball', crate: 'Spill crate', espresso: 'Espresso', shield: 'Foam shield' };

// Inline SVG glyphs, 48 x 48 viewBox, original shapes. Coral is the accent, paper the body.
const S = (inner) => `<svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">${inner}</svg>`;
export const ITEM_ICONS = {
  buoy: S(`<path d="M24 5 L30 15 L18 15 Z" fill="${CORAL}"/><rect x="21" y="14" width="6" height="6" fill="${PAPER}"/>
    <ellipse cx="24" cy="30" rx="12" ry="12" fill="${PAPER}"/><path d="M12 30 a12 12 0 0 1 24 0 Z" fill="${CORAL}"/>
    <rect x="12" y="28" width="24" height="4" fill="${INK}" opacity=".35"/><path d="M8 42 q8 -4 16 0 t16 0" stroke="${PAPER}" stroke-width="3" fill="none" opacity=".7"/>`),
  cannonball: S(`<circle cx="24" cy="26" r="15" fill="#3a3f46"/><circle cx="24" cy="26" r="15" fill="none" stroke="${PAPER}" stroke-width="2.5"/>
    <circle cx="18" cy="20" r="4" fill="${PAPER}" opacity=".85"/><path d="M30 6 l4 6 M36 12 l-2 -8" stroke="${CORAL}" stroke-width="3" stroke-linecap="round"/>`),
  crate: S(`<rect x="8" y="16" width="32" height="24" fill="#3f8f8a"/><rect x="8" y="16" width="32" height="5" fill="${PAPER}" opacity=".7"/>
    <rect x="8" y="27" width="32" height="3" fill="${INK}" opacity=".3"/><rect x="8" y="35" width="32" height="3" fill="${INK}" opacity=".3"/>
    <rect x="14" y="8" width="7" height="7" fill="#9fd8ea"/><rect x="24" y="6" width="7" height="7" fill="#9fd8ea" transform="rotate(12 27 9)"/><rect x="33" y="11" width="6" height="6" fill="#9fd8ea"/>
    <path d="M6 42 h36" stroke="${CORAL}" stroke-width="3"/>`),
  espresso: S(`<path d="M12 20 h22 v12 a11 11 0 0 1 -22 0 Z" fill="${PAPER}"/><path d="M34 22 h4 a5 5 0 0 1 0 10 h-4" fill="none" stroke="${PAPER}" stroke-width="3"/>
    <path d="M14 21 h18 v3 h-18 Z" fill="#6b4a2b"/><path d="M8 42 h30" stroke="${PAPER}" stroke-width="3"/>
    <path d="M19 6 q-3 4 0 8 M25 4 q-3 5 0 10 M31 6 q-3 4 0 8" stroke="${CORAL}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`),
  shield: S(`<circle cx="24" cy="24" r="17" fill="#3fb0b8" opacity=".55"/><circle cx="24" cy="24" r="17" fill="none" stroke="${PAPER}" stroke-width="2.5"/>
    <circle cx="16" cy="18" r="4" fill="${PAPER}" opacity=".9"/><circle cx="30" cy="14" r="2.5" fill="${PAPER}" opacity=".8"/><circle cx="32" cy="30" r="3" fill="${PAPER}" opacity=".6"/>
    <path d="M18 30 q6 6 12 0" stroke="${CORAL}" stroke-width="3" fill="none" stroke-linecap="round"/>`),
  roulette: S(`<rect x="10" y="10" width="28" height="28" fill="none" stroke="${PAPER}" stroke-width="3" stroke-dasharray="6 5"/><rect x="19" y="19" width="10" height="10" fill="${CORAL}"/>`),
};
// The empty slot shows our own item box (the glass cube stood on a corner, assets/item_box.js) as an
// outline with its coral core breathing, so an empty slot reads as "waiting for a box", not a placeholder.
const EMPTY_ICON = `<svg class="empty" viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
  <g fill="none" stroke="${PAPER}" stroke-width="2.6" stroke-linejoin="round" opacity=".62">
    <path d="M24 5.5 L40 14.75 L40 33.25 L24 42.5 L8 33.25 L8 14.75 Z"/><path d="M8 14.75 L24 24 L40 14.75 M24 24 L24 42.5"/>
  </g>
  <circle class="core" cx="24" cy="24" r="4.2" fill="${CORAL}"/>
</svg>`;

const CSS = `
#hud{position:fixed;inset:0;z-index:10;pointer-events:none;font-family:${FONT};color:${PAPER};font-weight:800;
  font-variant-numeric:tabular-nums;-webkit-user-select:none;user-select:none;
  --pad:max(18px,env(safe-area-inset-left));--padt:max(14px,env(safe-area-inset-top));--padb:max(14px,env(safe-area-inset-bottom));
  text-shadow:0 2px 0 rgba(16,12,10,.55),0 0 14px rgba(16,12,10,.35)}
#hud.off{display:none}
#hud.dim{opacity:0;transition:opacity .35s}
#hud .pix{font-family:${PIX};font-weight:400;font-size:11px;letter-spacing:.1em;text-transform:uppercase}
#hud .pos{position:absolute;left:var(--pad);top:var(--padt);display:flex;align-items:flex-start;line-height:.85;transform-origin:0 0}
#hud .pos b{font-family:${WIDE};font-weight:900;font-size:clamp(64px,11vw,124px);letter-spacing:-.05em;color:${PAPER};display:block}
#hud .pos small{display:block;font-family:${PIX};font-size:clamp(12px,1.6vw,16px);letter-spacing:.1em;margin:14px 0 0 6px;color:${CORAL};text-transform:uppercase}
#hud .pos.up b{color:#9fd8ea;animation:hudpop .55s ease-out}
#hud .pos.down b{color:${CORAL};animation:hudpop .55s ease-out}
#hud .pos .lbl{position:absolute;left:0;bottom:-16px;opacity:.8}
#hud .tr{position:absolute;right:var(--pad);top:var(--padt);display:flex;flex-direction:column;align-items:flex-end;gap:clamp(16px,2.6vw,26px)}
#hud .lap{text-align:right;line-height:1}
#hud .lap .n{font-size:clamp(30px,4.6vw,52px);letter-spacing:-.03em}
#hud .lap .n i{font-style:normal;color:${CORAL}}
#hud .lap .n em{font-style:normal;font-size:.55em;opacity:.7;margin-left:2px}
#hud .lap .lbl{display:block;opacity:.8;margin-bottom:4px}
#hud .times{text-align:right;line-height:1;padding-top:9px;border-top:3px solid ${CORAL};min-width:6.6em;font-size:clamp(18px,2.4vw,26px)}
#hud .times .lbl{display:block;opacity:.7;margin-bottom:4px}
#hud .times .race{display:block;letter-spacing:-.02em}
#hud .times .best{margin-top:9px;color:#9fd8ea;font-size:.68em}
#hud .times .best .bl{display:block}
#hud .item{position:absolute;left:50%;top:var(--padt);transform:translateX(-50%);width:clamp(66px,9.5vw,92px);height:clamp(66px,9.5vw,92px);
  box-sizing:border-box;border:3px solid ${PAPER};background:rgba(16,12,10,.74);padding:9px 9px 11px;display:flex;align-items:center;justify-content:center;
  box-shadow:5px 5px 0 rgba(16,12,10,.6);transition:border-color .15s,background .15s}
#hud .item::after{content:'';position:absolute;left:-3px;right:-3px;bottom:-3px;height:5px;background:${CORAL}}
#hud .item svg.empty{opacity:.9}
#hud .item svg.empty .core{animation:corepulse 2.2s ease-in-out infinite;transform-origin:24px 24px}
#hud .item.has svg.empty,#hud .item.spin svg.empty{display:none}
#hud .item.has{border-color:${CORAL};background:rgba(16,12,10,.82);box-shadow:5px 5px 0 rgba(16,12,10,.6),0 0 24px rgba(237,88,81,.4)}
#hud .item.spin{border-color:${CORAL};background:rgba(16,12,10,.82)}
#hud .item.spin::after{animation:rulepulse .18s steps(2) infinite}
#hud .item .lbl{position:absolute;left:50%;bottom:-20px;transform:translateX(-50%);white-space:nowrap;opacity:.75}
#hud .item.has .lbl{color:${CORAL};opacity:1}
#hud .item svg{display:block;width:100%;height:100%;filter:drop-shadow(0 2px 0 rgba(16,12,10,.6))}
#hud .item.pop svg{animation:hudpop .45s ease-out}
#hud .count{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);font-family:${WIDE};font-weight:900;font-size:clamp(110px,24vw,260px);letter-spacing:-.06em;
  line-height:1;color:${PAPER};opacity:0;text-shadow:0 6px 0 ${INK},0 0 40px rgba(16,12,10,.5)}
#hud .count.go{color:${CORAL}}
#hud .count.on{animation:cnt .95s cubic-bezier(.2,.9,.3,1) forwards}
#hud .banner{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%) scaleX(0);background:${CORAL};color:${INK};font-family:${WIDE};font-weight:900;
  font-size:clamp(26px,5.5vw,60px);letter-spacing:-.03em;text-transform:uppercase;padding:.12em .5em .1em;white-space:nowrap;opacity:0;transition:transform .18s ease-out,opacity .18s;text-shadow:none;
  box-shadow:8px 8px 0 ${INK}}
#hud .banner.on{transform:translate(-50%,-50%) scaleX(1);opacity:1}
#hud .banner.warn{background:${PAPER};color:${CORAL}}
#hud .banner.warn::before{content:'';display:inline-block;width:.6em;height:.6em;margin:0 .35em 0 0;border:.16em solid ${CORAL};border-width:.16em .16em 0 0;transform:rotate(-135deg) translate(-.05em,.05em);vertical-align:middle}
#hud .lines{position:absolute;inset:0;opacity:0;background:repeating-conic-gradient(from 0deg at 50% 52%,rgba(242,236,226,0) 0deg 3.4deg,rgba(242,236,226,.55) 3.7deg 4.1deg,rgba(242,236,226,0) 4.4deg 7.5deg);
  -webkit-mask-image:radial-gradient(ellipse at 50% 52%,rgba(0,0,0,0) 46%,rgba(0,0,0,1) 88%);mask-image:radial-gradient(ellipse at 50% 52%,rgba(0,0,0,0) 46%,rgba(0,0,0,1) 88%);transition:opacity .08s linear}
#hud .hitf{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at 50% 50%,rgba(237,88,81,0) 45%,rgba(237,88,81,.55) 100%)}
#hud .hitf.on{animation:hitf .5s ease-out}
#hud .round{position:absolute;right:max(10px,env(safe-area-inset-right));bottom:max(6px,env(safe-area-inset-bottom));opacity:.7;font-size:11px}
#hud .round i{font-style:normal;color:${CORAL}}
@keyframes hudpop{0%{transform:scale(1.35)}100%{transform:scale(1)}}
@keyframes cnt{0%{opacity:0;transform:translate(-50%,-50%) scale(1.8)}18%{opacity:1;transform:translate(-50%,-50%) scale(1)}75%{opacity:1;transform:translate(-50%,-50%) scale(.96)}100%{opacity:0;transform:translate(-50%,-50%) scale(.9)}}
@keyframes hitf{0%{opacity:1}100%{opacity:0}}
@keyframes corepulse{0%,100%{opacity:.55;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}}
@keyframes rulepulse{0%{opacity:1}100%{opacity:.35}}
@media (max-width:700px) and (orientation:portrait){
  #hud .tr{gap:14px}
  #hud .times{font-size:17px;padding-top:7px}
  #hud .pos b{font-size:72px}
}
`;

function ensureStyle() {
  ensureFonts();
  if (document.getElementById('ui-style-hud')) return;
  const s = document.createElement('style'); s.id = 'ui-style-hud'; s.textContent = CSS;
  document.head.appendChild(s);
}

export class HUD {
  constructor(container, { round = 'r0', laps = 3 } = {}) {
    ensureStyle();
    this.container = container || document.body;
    this.laps = laps;
    this.round = round;
    let el = this.container.querySelector('#hud') || document.getElementById('hud');
    if (!el) { el = h('<div id="hud"></div>'); this.container.appendChild(el); }
    this.el = el;
    el.innerHTML = '';
    const add = (html) => { const e = h(html); el.appendChild(e); return e; };
    this.lines = add('<div class="lines"></div>');
    this.hitf = add('<div class="hitf"></div>');
    this.posEl = add('<div class="pos"><b>1</b><small>st</small></div>');
    this.trEl = add('<div class="tr"></div>');
    this.lapEl = h('<div class="lap"><span class="lbl pix">Lap</span><div class="n"><i>1</i><em>/' + esc(laps) + '</em></div></div>');
    this.timesEl = h('<div class="times"><div><span class="lbl pix">Time</span><span class="race">0:00.000</span></div><div class="best"><span class="lbl pix">Best lap</span><span class="bl">-</span></div></div>');
    this.trEl.appendChild(this.lapEl); this.trEl.appendChild(this.timesEl);
    this.itemEl = add('<div class="item">' + EMPTY_ICON + '<span class="lbl pix"></span></div>');
    this.countEl = add('<div class="count"></div>');
    this.bannerEl = add('<div class="banner"></div>');
    this.roundEl = add(`<div class="round pix">404 GEN <i>${esc(round)}</i></div>`);
    this._pos = 1; this._item = undefined; this._rouT = 0; this._rouI = 0;
    this._bannerT = 0; this._bannerText = null; this._flashT = 0; this._boost = 0;
    this.onBoost = null;             // (t) => void, for post.setSpeedLines
    this.itemEl.querySelector('.lbl').textContent = 'Item';
    this.setItem(null);
  }

  setPosition(p) {
    const n = Math.max(1, Math.min(8, Math.round(p || 1)));
    if (n === this._pos && this.posEl.querySelector('b').textContent === String(n)) return;
    this._pos = n;
    const o = ordinal(n);
    this.posEl.querySelector('b').textContent = String(o.n);
    this.posEl.querySelector('small').textContent = o.suf;
  }

  setLap(lap, total = this.laps) {
    const n = Math.max(0, Math.round(lap || 0)), t = Math.max(1, Math.round(total || this.laps));
    const shown = n === 0 ? 1 : Math.min(n, t);
    const i = this.lapEl.querySelector('i'), em = this.lapEl.querySelector('em');
    if (i.textContent !== String(shown)) i.textContent = String(shown);
    const tt = '/' + t; if (em.textContent !== tt) em.textContent = tt;
  }

  setTime(race, lapBest) {
    const r = fmtTime(race), b = fmtTime(lapBest);
    const re = this.timesEl.querySelector('.race'), be = this.timesEl.querySelector('.bl');
    if (re.textContent !== r) re.textContent = r;
    if (be.textContent !== b) be.textContent = b;
  }

  /** key in ITEM_KEYS, 'roulette' (cycles icons every 90 ms until the next call) or null */
  setItem(key) {
    if (key === this._item) return;
    clearInterval(this._rouT); this._rouT = 0;
    this._item = key;
    const lbl = this.itemEl.querySelector('.lbl');
    const setIcon = (k) => {
      for (const c of [...this.itemEl.children]) if (c.tagName === 'svg' && !c.classList.contains('empty')) c.remove();
      if (k && ITEM_ICONS[k]) this.itemEl.insertBefore(h(ITEM_ICONS[k]), lbl);
    };
    this.itemEl.classList.remove('has', 'spin', 'pop');
    if (!key) { setIcon(null); lbl.textContent = 'Item'; return; }
    if (key === 'roulette') {
      this.itemEl.classList.add('spin');
      lbl.textContent = '';
      this._rouI = 0;
      setIcon(ITEM_KEYS[0]);
      this._rouT = setInterval(() => { this._rouI = (this._rouI + 1) % ITEM_KEYS.length; setIcon(ITEM_KEYS[this._rouI]); }, 90);
      return;
    }
    setIcon(ITEM_ICONS[key] ? key : 'roulette');
    lbl.textContent = ITEM_NAMES[key] || String(key);
    this.itemEl.classList.add('has');
    // retrigger the pop
    void this.itemEl.offsetWidth;
    this.itemEl.classList.add('pop');
  }

  /** n = 3, 2, 1 shows the numeral; 0 or 'GO' shows GO in coral */
  countdown(n) {
    const go = n === 0 || n === 'GO' || n === 'go';
    const text = go ? 'GO' : String(n);
    if (this._countText === text && this.countEl.classList.contains('on')) return;
    this._countText = text;
    this.countEl.textContent = text;
    this.countEl.classList.remove('on', 'go');
    if (go) this.countEl.classList.add('go');
    void this.countEl.offsetWidth;
    this.countEl.classList.add('on');
    clearTimeout(this._countClear);
    this._countClear = setTimeout(() => { this.countEl.classList.remove('on'); this._countText = null; }, 1000);
  }

  /**
   * banner('FINAL LAP' | 'WRONG WAY' | 'FINISH' | any text, ms = 1600); calling again with the
   * same text refreshes the timer, so a per frame call keeps WRONG WAY up. banner(null) hides.
   */
  banner(text, ms = 1600) {
    clearTimeout(this._bannerT);
    if (!text) { this.bannerEl.classList.remove('on', 'warn'); this._bannerText = null; return; }
    const t = String(text);
    if (t !== this._bannerText) {
      this._bannerText = t;
      this.bannerEl.textContent = t;
      this.bannerEl.classList.toggle('warn', /wrong/i.test(t));
    }
    this.bannerEl.classList.add('on');
    this._bannerT = setTimeout(() => { this.bannerEl.classList.remove('on'); this._bannerText = null; }, ms);
  }

  /** flashes the position numeral: cool when the place went up, coral when it went down */
  flashPlace(up) {
    this.posEl.classList.remove('up', 'down');
    void this.posEl.offsetWidth;
    this.posEl.classList.add(up ? 'up' : 'down');
    clearTimeout(this._flashT);
    this._flashT = setTimeout(() => this.posEl.classList.remove('up', 'down'), 600);
  }

  /** t 0..1: speed line strength on boost; restrained (0.18 opacity at full) */
  setBoost(t) {
    const v = Math.max(0, Math.min(1, +t || 0));
    if (v !== this._boost) {
      this._boost = v;
      this.lines.style.opacity = (v * 0.18).toFixed(3);
      if (this.onBoost) { try { this.onBoost(v); } catch (e) { console.error(e); } }
    }
  }

  hit() {
    this.hitf.classList.remove('on');
    void this.hitf.offsetWidth;
    this.hitf.classList.add('on');
  }

  show(on) { this.el.classList.toggle('off', !on); if (on) this.el.classList.remove('dim'); }

  /** Convenience: one call a frame from the loop with the telemetry shaped fields. */
  update({ position, lap, laps_total, race_time, best_lap, item, boost } = {}) {
    // the screens dim the HUD under the start screen and the results; if the race was started
    // another way (window.__START__, ?autostart=1) and no screen is up, come back on our own
    if (this.el.classList.contains('dim') && !document.getElementById('start')?.classList.contains('on') && !document.getElementById('over')?.classList.contains('on')) this.el.classList.remove('dim');
    if (position != null) this.setPosition(position);
    if (lap != null) this.setLap(lap, laps_total ?? this.laps);
    if (race_time != null) this.setTime(race_time, best_lap);
    if (item !== undefined) this.setItem(item);
    if (boost != null) this.setBoost(boost);
  }
}
