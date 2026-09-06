/**
 * track/road.js - the road ribbon of docs/TRACK-PLAN.md section 3 (road build) and section 6.
 *
 * One mesh per 30 m block (section 10), built from the spline table every 1.5 m:
 *   - the road surface between -width/2 and +width/2 with the interpolated bank, 15 strips across
 *     so the paint lands on its own quads: an edge line each side (whitewash, 0.20 m) and a
 *     centre dash (0.12 m, 3 m on 3 m off) on the asphalt sections A, F, G, H, I only;
 *   - a kerb SUBSTRATE outside each edge where the plan puts a kerb: 0.6 m wide, 0.24 m tall,
 *     top whitewash where kerb_module stations are exported (the asset sits on it and its own
 *     top at 0.26 to 0.30 m clears the substrate), warm stone where the kerb is a plain town
 *     kerb without a race module;
 *   - a 2.5 m pavement at 0.30 m (cobble slabs) through the town sections A(east), B, C, D, E, F;
 *     a 0.6 m asphalt shoulder at kerb top height on G, H, I; the quay deck strip on A west;
 *   - a 2 m warm stone sill across the road at the two surface changes (waypoints 7 and 32);
 *   - the chequered start band 1 m deep at progress 0.037 (0.5 m squares);
 *   - tyre marks: two 0.35 m bands 1.1 m apart on the racing line through every corner,
 *     10 percent darker, as vertex colour on their own thin layer;
 *   - vertex colour carries the style lock palette plus 3 percent value noise, so the render
 *     agent's applyRoadMaterial (tint x texel / mean) keeps the palette.
 *
 * Attributes on every tile: position, normal, uv, color, aSurface, aAcross.
 *   uv       METRIC on both axes: u = s / 4, v = 0.5 + lateral / 4 (one uv unit = 4 m). The
 *            contract said "v across 0..1"; that stretches a square texel to 11 to 14 m across
 *            against 4 m along, so the metric v is used and the 0..1 value is in aAcross.
 *   aSurface 0 asphalt, 1 cobble, 2 kerb substrate, 3 pavement, 4 shoulder, 5 paint, 6 sill,
 *            7 chequer, 8 tyre mark, 9 quay deck
 *   aAcross  0..1 across the road width (below 0 or above 1 on kerbs and pavements)
 * Tiles: receiveShadow true, userData { kind: 'road', block, sMin, sMax, surfaces }.
 */
import * as THREE from 'three';
import { Spline, START_PROGRESS } from './spline.js?v=r0-20260906041519';

export const ROAD = {
  KERB_W: 0.6, KERB_H: 0.24,          // substrate; the kerb_module asset (0.30 tall) sits on the road at the kerb base
  PAVE_W: 2.5, PAVE_H: 0.30,          // pavement at kerb top height (style lock)
  SHOULDER_W: 0.6, QUAY_W: 1.0,
  EDGE_LINE: 0.20, DASH_W: 0.12, DASH_ON: 3.0, DASH_OFF: 3.0,
  SILL_LEN: 2.0, TYRE_W: 0.35, TYRE_TRACK: 1.1, TYRE_DARKEN: 0.10,
  WALL_OFFSET: 1.8,                   // guard wall centre beyond the kerb outer edge (plan: 1.2 m outside the kerb) + half the wall
  CLIFF_DROP: 4.6,                    // cliff face begins width/2 + 0.6 kerb + 4 m of verge (plan 4.3)
  GAP_HALF: 6.0,                      // the three fall gaps are 12 m wide
  BLOCK: 30, BLOCK_X0: -210, BLOCK_Z0: -190,
};

// Style lock palette (sRGB hex), converted to linear by THREE.Color at use.
export const PALETTE = {
  asphalt: 0x4d5058, cobble: 0x9a8f80, whitewash: 0xf1e6d2, warmStone: 0xcdb897, stoneShade: 0x8d7b63,
  pavement: 0xa39684, shoulder: 0x585b62, sand: 0xe6cf9c,
};

export const PAD_DEFS = [   // TRACK-PLAN 7.2, rot in degrees (chevrons point along the racing direction), 3 m wide x 4 m long
  { id: 'B1a', x: -137, z: -100, rot: 180 }, { id: 'B1b', x: -131, z: -100, rot: 180 },
  { id: 'B2', x: 60, z: -155.7, rot: 90 }, { id: 'B3', x: 64, z: 30, rot: 0 },
  { id: 'B4a', x: -90, z: 114, rot: 270 }, { id: 'B4b', x: -102, z: 114, rot: 270 },
  { id: 'B5', x: -147, z: 27, rot: 165 },
];
export const PAD_HALF = { x: 1.5, z: 2.0 };

const DEG = Math.PI / 180;
const SURF = { asphalt: 0, cobble: 1, kerb: 2, pavement: 3, shoulder: 4, paint: 5, sill: 6, chequer: 7, tyre: 8, quay: 9 };

// ------------------------------------------------------------------------------------ helpers
function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function smooth(t) { return t * t * (3 - 2 * t); }
/** Deterministic value noise in [0, 1) at a wavelength (metres). Shared with terrain.js. */
export function noise2(x, z, wavelength = 1) {
  x /= wavelength; z /= wavelength;
  const ix = Math.floor(x), iz = Math.floor(z), fx = smooth(x - ix), fz = smooth(z - iz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}
export function smoothstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function mod(a, n) { return ((a % n) + n) % n; }

/**
 * The cross section kind on one side at a distance s (TRACK-PLAN section 3 road build, section 6).
 * side: -1 left of travel, +1 right. Returns { kind, white } where
 *   kind  'pavement' kerb substrate + 2.5 m pavement (town), 'kerb' kerb substrate + shoulder,
 *         'shoulder' plain 0.6 m shoulder, 'quay' the 1 m quay deck strip (A west)
 *   white true where kerb_module stations run (the substrate top is whitewash)
 * terrain.js uses the same function so the flatten bands agree with the ribbon.
 */
export function sideProfile(spline, s, side) {
  const R = (a, b) => spline.inWaypointRange(s, a, b);
  if (R(0, 7)) return side < 0 ? { kind: 'quay', white: false } : { kind: 'pavement', white: false };          // A
  if (R(7, 11)) return { kind: 'pavement', white: true };                                                        // B both
  if (R(11, 20)) return { kind: 'pavement', white: side > 0 ? true : R(12, 16) };                               // C outer, inner at the S bends
  if (R(20, 32)) return { kind: 'pavement', white: true };                                                       // D, E both
  if (R(32, 40)) return { kind: 'pavement', white: R(32, 39) };                                                  // F through the chicane
  if (R(40, 44)) return { kind: 'kerb', white: true };                                                           // G both
  if (R(44, 50)) return { kind: 'kerb', white: side > 0 };                                                       // H inner; sea side carries the wall
  return { kind: 'kerb', white: side > 0 ? true : R(55, 59) };                                                   // I inner; beach side from wp 55
}
/** True where the town pavement band applies (used by terrain.js for the +0.30 flatten band). */
export function hasPavement(spline, s, side) { return sideProfile(spline, s, side).kind === 'pavement'; }

/** Road surface y at a lateral offset (bank inside the width, flat beyond the edge). */
export function yAt(q, l) {
  const h = q.width / 2;
  const lb = l < -h ? -h : l > h ? h : l;
  return q.y - lb * Math.tan(q.bank * DEG);
}

// ------------------------------------------------------------------------------ tile builder
class TileBuilder {
  constructor(key) {
    this.key = key; this.pos = []; this.nrm = []; this.uv = []; this.col = []; this.surf = []; this.across = []; this.idx = [];
    this.sMin = Infinity; this.sMax = -Infinity; this.surfaces = new Set();
  }
  vertex(x, y, z, n, u, v, c, surf, across) {
    this.pos.push(x, y, z); this.nrm.push(n.x, n.y, n.z); this.uv.push(u, v); this.col.push(c.r, c.g, c.b);
    this.surf.push(surf); this.across.push(across);
    return this.pos.length / 3 - 1;
  }
  /**
   * a0 a1 on the first row (left to right), b0 b1 on the second row, wound counter clockwise
   * about `n` (the intended face normal) so FrontSide culling keeps the face whichever way the
   * strip runs: the geometric normal of (a0, a1, b0) is compared with n and the quad is mirrored
   * when they disagree (vertical kerb faces on the two sides run opposite ways).
   */
  quad(a0, a1, b0, b1, n) {
    const p = this.pos;
    const ax = p[a0 * 3], ay = p[a0 * 3 + 1], az = p[a0 * 3 + 2];
    const ux = p[a1 * 3] - ax, uy = p[a1 * 3 + 1] - ay, uz = p[a1 * 3 + 2] - az;
    const vx = p[b0 * 3] - ax, vy = p[b0 * 3 + 1] - ay, vz = p[b0 * 3 + 2] - az;
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * n.x + cy * n.y + cz * n.z >= 0) this.idx.push(a0, a1, b0, a1, b1, b0);
    else this.idx.push(a1, a0, b1, a0, b0, b1);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aSurface', new THREE.Float32BufferAttribute(this.surf, 1));
    g.setAttribute('aAcross', new THREE.Float32BufferAttribute(this.across, 1));
    g.setIndex(this.idx);
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}

/**
 * Build the ribbon. `spline` is a Spline (see spline.js). Returns
 * { tiles, kerbs, wallStations, padStations, pads, surfaceAt, heightAt, probe, material }.
 */
export function buildRoad(THREE_, spline, opts = {}) {
  const rows = spline.samples, N = spline.count, ds = spline.ds, L = spline.length;
  const C = {};
  for (const k of Object.keys(PALETTE)) C[k] = new THREE.Color(PALETTE[k]);
  const UP = new THREE.Vector3(0, 1, 0);
  const tmpN = new THREE.Vector3(), tmpC = new THREE.Color();
  const tiles = new Map();
  const blockKey = (x, z) => Math.floor((x - ROAD.BLOCK_X0) / ROAD.BLOCK) + '_' + Math.floor((z - ROAD.BLOCK_Z0) / ROAD.BLOCK);
  const tileFor = (x, z) => { const k = blockKey(x, z); let t = tiles.get(k); if (!t) { t = new TileBuilder(k); tiles.set(k, t); } return t; };

  // sills at the two surface changes; the start band
  const sills = [spline.waypointS[7], spline.waypointS[32]];
  const startS = START_PROGRESS * L;

  // per row: cornerness (max |curvature| within 12 m) and the racing line lateral
  const corner = new Float32Array(N), rline = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let m = 0;
    for (let d = -8; d <= 8; d++) m = Math.max(m, Math.abs(rows[mod(i + d, N)].curvature));
    corner[i] = clamp(m / 0.03, 0, 1);
    const ka = rows[mod(i + 8, N)].curvature, kb = rows[mod(i - 8, N)].curvature, k0 = rows[i].curvature;
    rline[i] = 0.35 * rows[i].width * Math.tanh((ka - kb + 0.6 * k0) / 0.03);
  }

  /** vertex colour with 3 percent noise; `dark` darkens (tyre marks). */
  function tone(base, s, l, dark = 0) {
    const n = (noise2(s, l, 1.2) - 0.5) * 0.04 + (noise2(s, l, 5) - 0.5) * 0.03;
    const f = (1 + n) * (1 - dark);
    return tmpC.copy(base).multiplyScalar(f);
  }
  /** base colour of the road surface at lateral l for the pair starting at row i (paint aware). */
  function roadColourAt(i, sMid, l, surfOut) {
    const r = rows[i];
    const h = r.width / 2;
    for (const ss of sills) if (Math.abs(sMid - ss) < ROAD.SILL_LEN / 2) { surfOut.v = SURF.sill; return C.warmStone; }
    const asphalt = r.surface === 'asphalt';
    if (asphalt) {
      if (Math.abs(l) > h - ROAD.EDGE_LINE) { surfOut.v = SURF.paint; return C.whitewash; }
      const dashOn = mod(sMid, ROAD.DASH_ON + ROAD.DASH_OFF) < ROAD.DASH_ON;
      if (dashOn && Math.abs(l) < ROAD.DASH_W / 2) { surfOut.v = SURF.paint; return C.whitewash; }
    }
    surfOut.v = asphalt ? SURF.asphalt : SURF.cobble;
    return asphalt ? C.asphalt : C.cobble;
  }

  const so = { v: 0 };
  // emit one quad between rows a (s = sa) and b (s = sb) spanning lateral la0..la1 / lb0..lb1 with heights ya0.. (absolute)
  function emit(tb, a, b, sa, sb, la0, la1, lb0, lb1, ya0, ya1, yb0, yb1, na, nb, colour, surf) {
    const wa = a.width, wb = b.width;
    const v0 = tb.vertex(a.x + a.nx * la0, ya0, a.z + a.nz * la0, na, sa / 4, 0.5 + la0 / 4, colour, surf, 0.5 + la0 / wa);
    const v1 = tb.vertex(a.x + a.nx * la1, ya1, a.z + a.nz * la1, na, sa / 4, 0.5 + la1 / 4, colour, surf, 0.5 + la1 / wa);
    const v2 = tb.vertex(b.x + b.nx * lb0, yb0, b.z + b.nz * lb0, nb, sb / 4, 0.5 + lb0 / 4, colour, surf, 0.5 + lb0 / wb);
    const v3 = tb.vertex(b.x + b.nx * lb1, yb1, b.z + b.nz * lb1, nb, sb / 4, 0.5 + lb1 / 4, colour, surf, 0.5 + lb1 / wb);
    tb.quad(v0, v1, v2, v3, na);
    tb.surfaces.add(surf); tb.sMin = Math.min(tb.sMin, sa); tb.sMax = Math.max(tb.sMax, sb);
  }
  // a flat layer strip at a constant lateral pair with a y offset over the road surface
  function stripFlat(tb, a, b, sa, sb, l0, l1, dy, na, nb, colour, surf) {
    emit(tb, a, b, sa, sb, l0, l1, l0, l1, yAt(a, l0) + dy, yAt(a, l1) + dy, yAt(b, l0) + dy, yAt(b, l1) + dy, na, nb, colour, surf);
  }

  const nA = new THREE.Vector3(), nB = new THREE.Vector3(), sideN = new THREE.Vector3();

  for (let i = 0; i < N; i++) {
    const a = rows[i], b = rows[(i + 1) % N];
    const sa = a.s, sb = a.s + ds;              // sb continues past the lap end so u never jumps back
    const sMid = sa + ds / 2;
    const tb = tileFor((a.x + b.x) / 2, (a.z + b.z) / 2);
    Spline.normalOf(a, nA); Spline.normalOf(b, nB);
    const ha = a.width / 2, hb = b.width / 2;

    // ---- road surface: 15 strips, fixed by fraction so the paint gets its own quads
    const E = ROAD.EDGE_LINE, D = ROAD.DASH_W / 2;
    // lateral stops: edge line, 6 interior strips, centre dash, 6 interior strips, edge line
    const stops = (h) => {
      const arr = [-h, -h + E];
      for (let k = 1; k < 6; k++) arr.push((-h + E) + ((-D) - (-h + E)) * (k / 6));
      arr.push(-D, D);
      for (let k = 1; k < 6; k++) arr.push(D + ((h - E) - D) * (k / 6));
      arr.push(h - E, h);
      return arr;
    };
    const SA = stops(ha), SB = stops(hb);
    for (let k = 0; k < SA.length - 1; k++) {
      const lm = (SA[k] + SA[k + 1]) / 2;
      const base = roadColourAt(i, sMid, lm, so);
      const col = tone(base, sMid, lm);
      emit(tb, a, b, sa, sb, SA[k], SA[k + 1], SB[k], SB[k + 1], yAt(a, SA[k]), yAt(a, SA[k + 1]), yAt(b, SB[k]), yAt(b, SB[k + 1]), nA, nB, col, so.v);
    }

    // ---- tyre marks through corners (own layer 6 mm up)
    if (corner[i] > 0.08) {
      const inten = corner[i];
      const rl = rline[i];
      for (const off of [-ROAD.TYRE_TRACK / 2, ROAD.TYRE_TRACK / 2]) {
        const c0 = clamp(rl + off - ROAD.TYRE_W / 2, -ha + 0.05, ha - 0.05), c1 = clamp(rl + off + ROAD.TYRE_W / 2, -ha + 0.05, ha - 0.05);
        if (c1 - c0 < 0.05) continue;
        const base = roadColourAt(i, sMid, (c0 + c1) / 2, so);
        const col = tone(base, sMid, c0, ROAD.TYRE_DARKEN * inten);
        stripFlat(tb, a, b, sa, sb, c0, c1, 0.006, nA, nB, col, SURF.tyre);
      }
    }

    // ---- each side: kerb substrate, pavement or shoulder, apron
    for (const side of [-1, 1]) {
      const prof = sideProfile(spline, sMid, side);
      const ea = side * ha, eb = side * hb;   // edge lateral
      const yea = yAt(a, ea), yeb = yAt(b, eb);
      sideN.set(a.nx * -side, 0, a.nz * -side);  // faces the road
      const K = ROAD.KERB_W, KH = ROAD.KERB_H;
      const o = (l) => side * l;               // outward lateral helper (positive metres beyond the edge)
      if (prof.kind === 'pavement' || prof.kind === 'kerb') {
        // kerb inner face (vertical)
        emit(tb, a, b, sa, sb, ea, ea, eb, eb, yea, yea + KH, yeb, yeb + KH, sideN, sideN, tone(C.warmStone, sMid, ea), SURF.kerb);
        // kerb top
        const top = prof.white ? C.whitewash : C.warmStone;
        emit(tb, a, b, sa, sb, ea, ea + o(K), eb, eb + o(K), yea + KH, yea + KH, yeb + KH, yeb + KH, UP, UP, tone(top, sMid, ea + o(K / 2)), SURF.kerb);
        if (prof.kind === 'pavement') {
          const PH = ROAD.PAVE_H, PW = ROAD.PAVE_W;
          // riser from kerb top to pavement
          emit(tb, a, b, sa, sb, ea + o(K), ea + o(K), eb + o(K), eb + o(K), yea + KH, yea + PH, yeb + KH, yeb + PH, sideN, sideN, tone(C.stoneShade, sMid, ea), SURF.kerb);
          // pavement in two strips so the noise reads
          for (let k = 0; k < 2; k++) {
            const l0 = K + PW * k / 2, l1 = K + PW * (k + 1) / 2;
            emit(tb, a, b, sa, sb, ea + o(l0), ea + o(l1), eb + o(l0), eb + o(l1), yea + PH, yea + PH, yeb + PH, yeb + PH, UP, UP, tone(C.pavement, sMid, ea + o((l0 + l1) / 2)), SURF.pavement);
          }
          // apron dropping under the terrain
          emit(tb, a, b, sa, sb, ea + o(K + PW), ea + o(K + PW + 0.5), eb + o(K + PW), eb + o(K + PW + 0.5), yea + PH, yea + PH - 0.10, yeb + PH, yeb + PH - 0.10, UP, UP, tone(C.pavement, sMid, ea + o(K + PW)), SURF.pavement);
        } else {
          const SW = ROAD.SHOULDER_W;
          emit(tb, a, b, sa, sb, ea + o(K), ea + o(K + SW), eb + o(K), eb + o(K + SW), yea + KH, yea + KH - 0.02, yeb + KH, yeb + KH - 0.02, UP, UP, tone(C.shoulder, sMid, ea + o(K + SW / 2)), SURF.shoulder);
          emit(tb, a, b, sa, sb, ea + o(K + SW), ea + o(K + SW + 0.5), eb + o(K + SW), eb + o(K + SW + 0.5), yea + KH - 0.02, yea - 0.06, yeb + KH - 0.02, yeb - 0.06, UP, UP, tone(C.shoulder, sMid, ea + o(K + SW)), SURF.shoulder);
        }
      } else if (prof.kind === 'shoulder') {
        const SW = ROAD.SHOULDER_W;
        emit(tb, a, b, sa, sb, ea, ea + o(SW), eb, eb + o(SW), yea, yea - 0.01, yeb, yeb - 0.01, UP, UP, tone(C.shoulder, sMid, ea + o(SW / 2)), SURF.shoulder);
        emit(tb, a, b, sa, sb, ea + o(SW), ea + o(SW + 0.5), eb + o(SW), eb + o(SW + 0.5), yea - 0.01, yea - 0.12, yeb - 0.01, yeb - 0.12, UP, UP, tone(C.shoulder, sMid, ea + o(SW)), SURF.shoulder);
      } else if (prof.kind === 'quay') {
        const QW = ROAD.QUAY_W;
        emit(tb, a, b, sa, sb, ea, ea + o(QW), eb, eb + o(QW), yea, yea, yeb, yeb, UP, UP, tone(C.warmStone, sMid, ea + o(QW / 2)), SURF.quay);
      }
    }
  }

  // ---- chequered start band: 2 rows of 0.5 m squares across the width at progress 0.037
  {
    const q0 = spline.atDistance(startS - 0.5, {}), q1 = spline.atDistance(startS, {}), q2 = spline.atDistance(startS + 0.5, {});
    const rowsQ = [q0, q1, q2];
    const h = q1.width / 2;
    const n = Math.round(h * 2 / 0.5);
    const tb = tileFor(q1.x, q1.z);
    for (let j = 0; j < 2; j++) {
      const a = rowsQ[j], b = rowsQ[j + 1];
      Spline.normalOf(a, nA); Spline.normalOf(b, nB);
      for (let k = 0; k < n; k++) {
        const l0 = -h + k * 0.5, l1 = l0 + 0.5;
        const white = (j + k) % 2 === 0;
        const col = tone(white ? C.whitewash : C.asphalt, a.s, l0);
        emit(tb, a, b, a.s, b.s, l0, l1, l0, l1, yAt(a, l0) + 0.008, yAt(a, l1) + 0.008, yAt(b, l0) + 0.008, yAt(b, l1) + 0.008, nA, nB, col, SURF.chequer);
      }
    }
  }

  // ---- meshes
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.0, name: 'road' });
  material.userData.surface = 'ground';
  const meshes = [];
  for (const [key, tb] of tiles) {
    const g = tb.build();
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true; m.castShadow = false;
    m.name = 'road_' + key;
    m.userData = { kind: 'road', block: key, sMin: tb.sMin, sMax: tb.sMax, surfaces: Array.from(tb.surfaces) };
    meshes.push(m);
  }

  // ---- stations for the level builder
  const kerbs = [];
  for (const side of [-1, 1]) {
    // walk s in 0.5 m steps to find the white runs, then a station every 4 m inside each run
    let runStart = -1;
    const step = 0.5;
    const flush = (sEnd) => {
      if (runStart < 0) return;
      const len = sEnd - runStart;
      const count = Math.max(1, Math.round(len / 4));
      const pitch = len / count;                    // stretch the pitch a hair so the run closes on modules
      for (let k = 0; k < count; k++) kerbs.push(kerbStation(runStart + pitch * (k + 0.5), side));
      runStart = -1;
    };
    for (let s = 0; s <= L + 1e-6; s += step) {
      const white = s < L && sideProfile(spline, s, side).white;
      if (white && runStart < 0) runStart = s;
      if (!white && runStart >= 0) flush(s);
    }
    flush(L);
  }
  function kerbStation(s, side) {
    const q = spline.atDistance(s, {});
    const h = q.width / 2;
    const lat = side * (h + ROAD.KERB_W / 2);
    const ox = q.nx * side, oz = q.nz * side;          // outward (the module's +Z; its road side is -Z)
    const rot = mod(Math.atan2(ox, oz) / DEG, 360);
    return { x: q.x + q.nx * lat, z: q.z + q.nz * lat, y: yAt(q, side * h), rot, side: side < 0 ? 'L' : 'R', progress: s / L, s, section: q.section };
  }

  // guard wall on the sea (left) side from wp 41 to wp 53, gaps 12 m at x -12 (43..44), x -94 (48..49), wp 52
  const gapS = [];
  const findX = (xTarget, wpA, wpB) => {
    let best = null, bd = Infinity;
    for (const r of rows) if (r.s >= spline.waypointS[wpA] && r.s < spline.waypointS[wpB] && Math.abs(r.x - xTarget) < bd) { bd = Math.abs(r.x - xTarget); best = r; }
    return best ? best.s : (spline.waypointS[wpA] + spline.waypointS[wpB]) / 2;
  };
  gapS.push(findX(-12, 43, 44), findX(-94, 48, 49), spline.waypointS[52]);
  const wallStations = [];
  {
    const s0 = spline.waypointS[41], s1 = spline.waypointS[53];
    const count = Math.round((s1 - s0) / 4), pitch = (s1 - s0) / count;
    for (let k = 0; k < count; k++) {
      const s = s0 + pitch * (k + 0.5);
      const q = spline.atDistance(s, {});
      const h = q.width / 2;
      const lat = -(h + ROAD.WALL_OFFSET);
      const ox = -q.nx, oz = -q.nz;
      const gap = gapS.some((g) => Math.abs(s - g) < ROAD.GAP_HALF);
      wallStations.push({ x: q.x + q.nx * lat, z: q.z + q.nz * lat, y: yAt(q, -h), rot: mod(Math.atan2(ox, oz) / DEG, 360), progress: s / L, s, gap, side: 'L' });
    }
  }

  // boost pads
  const pads = PAD_DEFS.map((p) => {
    const y = spline.roadY(p.x, p.z);
    const rad = p.rot * DEG;
    return { ...p, y: Number.isNaN(y) ? 0 : y, cos: Math.cos(rad), sin: Math.sin(rad) };
  });
  const padStations = pads.map((p) => ({ id: p.id, x: p.x, z: p.z, y: p.y, rot: p.rot }));
  function padAt(x, z) {
    for (const p of pads) {
      const dx = x - p.x, dz = z - p.z;
      // world -> local: inverse of rotation.y = rot ( local +Z -> (sin, cos) )
      const lx = dx * p.cos - dz * p.sin;
      const lz = dx * p.sin + dz * p.cos;
      if (Math.abs(lx) <= PAD_HALF.x && Math.abs(lz) <= PAD_HALF.z) return p;
    }
    return null;
  }

  // ---- queries
  const qTmp = {};
  /**
   * Cross section probe under (x, z): { y, surface, zone, lateral, q } or null when the ribbon is
   * absent there (the terrain takes over). zone: road | kerb | pavement | shoulder | apron | quay.
   */
  function probe(x, z, hint = -1) {
    const n = spline.nearest(x, z, hint);
    const q = spline.atDistance(n.s, qTmp);
    const h = q.width / 2, l = n.lateral, al = Math.abs(l), side = l < 0 ? -1 : 1;
    const yEdge = yAt(q, side * h);
    if (al <= h) {
      const pad = padAt(x, z);
      return { y: yAt(q, l), surface: pad ? 'pad' : q.surface, zone: 'road', lateral: l, q, index: n.index, progress: n.progress };
    }
    const prof = sideProfile(spline, n.s, side);
    const K = ROAD.KERB_W;
    if (prof.kind === 'pavement' || prof.kind === 'kerb') {
      if (al <= h + K) return { y: yEdge + ROAD.KERB_H, surface: q.surface, zone: 'kerb', lateral: l, q, index: n.index, progress: n.progress };
      if (prof.kind === 'pavement') {
        if (al <= h + K + ROAD.PAVE_W) return { y: yEdge + ROAD.PAVE_H, surface: 'cobble', zone: 'pavement', lateral: l, q, index: n.index, progress: n.progress };
        if (al <= h + K + ROAD.PAVE_W + 0.5) { const t = (al - (h + K + ROAD.PAVE_W)) / 0.5; return { y: yEdge + ROAD.PAVE_H - 0.10 * t, surface: 'cobble', zone: 'apron', lateral: l, q, index: n.index, progress: n.progress }; }
        return null;
      }
      const SW = ROAD.SHOULDER_W;
      if (al <= h + K + SW) return { y: yEdge + ROAD.KERB_H - 0.02, surface: 'asphalt', zone: 'shoulder', lateral: l, q, index: n.index, progress: n.progress };
      if (al <= h + K + SW + 0.5) { const t = (al - (h + K + SW)) / 0.5; return { y: yEdge + ROAD.KERB_H - 0.02 - (ROAD.KERB_H + 0.04) * t, surface: 'asphalt', zone: 'apron', lateral: l, q, index: n.index, progress: n.progress }; }
      return null;
    }
    if (prof.kind === 'shoulder') {
      const SW = ROAD.SHOULDER_W;
      if (al <= h + SW) return { y: yEdge - 0.01, surface: 'asphalt', zone: 'shoulder', lateral: l, q, index: n.index, progress: n.progress };
      if (al <= h + SW + 0.5) { const t = (al - (h + SW)) / 0.5; return { y: yEdge - 0.01 - 0.11 * t, surface: 'asphalt', zone: 'apron', lateral: l, q, index: n.index, progress: n.progress }; }
      return null;
    }
    if (prof.kind === 'quay') {
      if (al <= h + ROAD.QUAY_W) return { y: yEdge, surface: 'asphalt', zone: 'quay', lateral: l, q, index: n.index, progress: n.progress };
      return null;
    }
    return null;
  }
  function surfaceAt(x, z) { const p = probe(x, z); return p ? p.surface : null; }
  function heightAt(x, z) { const p = probe(x, z); return p ? p.y : NaN; }

  return {
    tiles: meshes, kerbs, wallStations, padStations, pads, gapS,
    surfaceAt, heightAt, probe, padAt, material, sideProfile: (s, side) => sideProfile(spline, s, side),
    params: ROAD, SURF,
  };
}
