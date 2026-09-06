/**
 * ui/minimap.js - the Sorrel Cove minimap: a canvas #minimap inside #hud.
 *
 * The centreline is drawn ONCE into an offscreen canvas (road ribbon as a dark band with a
 * paper edge, the start line as a coral tick) and blitted every update under the eight racer
 * dots: AI dots small in paper, the player larger in coral with a dark ring. North up: the
 * track plan's -Z is north so screen y grows with world z and screen x with world x, no flip.
 * 160 x 160 css px on desktop, 116 px on a portrait phone (the touch buttons own the bottom
 * right there, so the map sits above them).
 *
 * Signature (docs/ARCHITECTURE.md):
 *   new Minimap(container, spline)   spline has `samples: [{ x, z, progress }]` (track/spline.js);
 *                                    an array of { x, z } or anything with `at(progress01)` also works
 *   update(racers)                   [{ id, x, z, isPlayer }], 8 entries
 */
import { CORAL, INK, PAPER } from './screens.js?v=r3-20260906150928';

const CSS = `
#minimap{position:absolute;right:max(14px,env(safe-area-inset-right));bottom:max(26px,env(safe-area-inset-bottom));width:160px;height:160px;
  pointer-events:none;filter:drop-shadow(0 3px 0 rgba(16,12,10,.55))}
@media (max-width:700px) and (orientation:portrait){#minimap{width:116px;height:116px;bottom:294px;right:12px}}
@media (max-height:520px){#minimap{width:110px;height:110px}}
`;

function ensureStyle() {
  if (document.getElementById('ui-style-minimap')) return;
  const s = document.createElement('style'); s.id = 'ui-style-minimap'; s.textContent = CSS;
  document.head.appendChild(s);
}

/** Pull a closed polyline of { x, z } out of whatever centreline object we were handed. */
function centreline(spline) {
  if (!spline) return [];
  if (Array.isArray(spline)) return spline.map((p) => ({ x: p.x, z: p.z }));
  if (Array.isArray(spline.samples) && spline.samples.length > 2) return spline.samples.map((p) => ({ x: p.x, z: p.z }));
  if (typeof spline.at === 'function') {
    const out = [];
    for (let i = 0; i < 360; i++) { const p = spline.at(i / 360, {}); if (p && isFinite(p.x) && isFinite(p.z)) out.push({ x: p.x, z: p.z }); }
    return out;
  }
  if (Array.isArray(spline.waypoints)) return spline.waypoints.map((p) => ({ x: p.x, z: p.z }));
  return [];
}

export class Minimap {
  constructor(container, spline, { size = 160, startProgress = 0.037 } = {}) {
    ensureStyle();
    const host = container || document.getElementById('hud') || document.body;
    let c = host.querySelector('#minimap') || document.getElementById('minimap');
    if (!c) { c = document.createElement('canvas'); c.id = 'minimap'; host.appendChild(c); }
    this.canvas = c;
    this.ctx = c.getContext('2d');
    this.pts = centreline(spline);
    this.startProgress = startProgress;
    this.size = size;
    this._css = 0; this._dpr = 0;
    this.base = document.createElement('canvas');
    this._fit();
  }

  /** world -> map pixels (device pixels) */
  _fit() {
    const r = this.canvas.getBoundingClientRect();
    const css = Math.max(48, Math.round(r.width || this.size));
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    if (css === this._css && dpr === this._dpr) return false;
    this._css = css; this._dpr = dpr;
    const px = Math.round(css * dpr);
    this.canvas.width = px; this.canvas.height = px;
    this.base.width = px; this.base.height = px;
    const pts = this.pts;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of pts) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z; }
    if (!pts.length) { minX = -1; maxX = 1; minZ = -1; maxZ = 1; }
    const pad = px * 0.11;
    const span = Math.max(maxX - minX, maxZ - minZ, 1);
    this.scale = (px - 2 * pad) / span;
    this.ox = pad + ((px - 2 * pad) - (maxX - minX) * this.scale) / 2 - minX * this.scale;
    this.oz = pad + ((px - 2 * pad) - (maxZ - minZ) * this.scale) / 2 - minZ * this.scale;
    this._drawBase(px);
    return true;
  }

  toMap(x, z) { return [this.ox + x * this.scale, this.oz + z * this.scale]; }

  _drawBase(px) {
    const g = this.base.getContext('2d');
    g.clearRect(0, 0, px, px);
    const pts = this.pts;
    if (pts.length < 2) return;
    const w = px / this._dpr;                      // css px reference for line widths
    const path = new Path2D();
    pts.forEach((p, i) => { const [mx, mz] = this.toMap(p.x, p.z); if (i === 0) path.moveTo(mx, mz); else path.lineTo(mx, mz); });
    path.closePath();
    g.lineJoin = 'round'; g.lineCap = 'round';
    // a soft dark ground halo so the ribbon reads over sky, sea and sand alike
    g.strokeStyle = 'rgba(16,12,10,.45)'; g.lineWidth = 0.115 * w * this._dpr / 1.6; g.stroke(path);
    // paper edge then the dark road
    g.strokeStyle = PAPER; g.lineWidth = 0.062 * w * this._dpr / 1.6; g.stroke(path);
    g.strokeStyle = '#4d5058'; g.lineWidth = 0.038 * w * this._dpr / 1.6; g.stroke(path);
    // the start line: a coral tick across the road at startProgress
    const i = Math.round(this.startProgress * pts.length) % pts.length;
    const a = pts[(i + pts.length - 1) % pts.length], b = pts[(i + 1) % pts.length], c = pts[i];
    const tx = b.x - a.x, tz = b.z - a.z, tl = Math.hypot(tx, tz) || 1;
    const nx = -tz / tl, nz = tx / tl;
    const half = 0.055 * w * this._dpr / 1.6;
    const [cx, cz] = this.toMap(c.x, c.z);
    g.strokeStyle = CORAL; g.lineWidth = 0.02 * w * this._dpr / 1.6;
    g.beginPath(); g.moveTo(cx - nx * half, cz - nz * half); g.lineTo(cx + nx * half, cz + nz * half); g.stroke();
    // N marker, a small paper triangle top right of the map
    g.fillStyle = 'rgba(242,236,226,.75)';
    const s = 0.035 * px;
    g.beginPath(); g.moveTo(px - s * 1.6, s * 2.6); g.lineTo(px - s * 2.4, s * 3.8); g.lineTo(px - s * 0.8, s * 3.8); g.closePath(); g.fill();
  }

  /** racers: [{ id, x, z, isPlayer }] */
  update(racers = []) {
    this._fit();
    const g = this.ctx, px = this.canvas.width;
    g.clearRect(0, 0, px, px);
    g.drawImage(this.base, 0, 0);
    const r = 0.021 * px, rp = 0.034 * px;
    let player = null;
    for (const k of racers) {
      if (!k || !isFinite(k.x) || !isFinite(k.z)) continue;
      if (k.isPlayer) { player = k; continue; }
      const [mx, mz] = this.toMap(k.x, k.z);
      g.beginPath(); g.arc(mx, mz, r, 0, Math.PI * 2);
      g.fillStyle = k.color || PAPER; g.fill();
      g.lineWidth = Math.max(1, 0.006 * px); g.strokeStyle = INK; g.stroke();
    }
    if (player) {
      const [mx, mz] = this.toMap(player.x, player.z);
      g.beginPath(); g.arc(mx, mz, rp, 0, Math.PI * 2);
      g.fillStyle = CORAL; g.fill();
      g.lineWidth = Math.max(1.5, 0.01 * px); g.strokeStyle = INK; g.stroke();
      g.beginPath(); g.arc(mx, mz, rp + 0.012 * px, 0, Math.PI * 2);
      g.lineWidth = Math.max(1, 0.006 * px); g.strokeStyle = PAPER; g.stroke();
    }
  }
}
