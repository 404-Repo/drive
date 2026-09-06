/**
 * DRIVE  src/level/crowdrow.js  (owner: level)
 *
 * Round 5 (targeted, Ben: "the fix is depth and irregular silhouettes, not more cards"). Two things
 * the level does to every crowd, both here so build.js stays a placer:
 *
 *   stackCrowd(THREE, obj, seed)
 *     The spectator_group asset ships three 3 m crowd cards 14 cm apart and 10 cm up, so from the chase
 *     camera they collapse into one rectangle. This re seats the three card meshes of one placed
 *     instance as three DEPTH layers: 0.30 m back and 0.30 m up per layer, so the heads of every layer
 *     stand above the heads of the layer in front. Per instance the pictures rotate through the slots
 *     (which cutout is the front row), each layer is drawn at 0.9 to 1.1 of its size and every second
 *     layer is mirrored, so no two groups in a run repeat. Only mesh transforms change: the geometry is
 *     the asset's, shared between instances, and the card material is the render module's one atlas
 *     material, so the layers bake into the block's card bucket like before (0 extra draws). Works on
 *     the near instance (materials still named card:crowd_*) and on the far copies (materials already
 *     the shared CardMaterial): the rows are found by their geometry, not their material.
 *
 *   makeCrowdFront(THREE, spec, seed)
 *     A modelled front row: chunky toy figures (about 340 triangles each, style lock: "figures under
 *     400 triangles", never realistic) that stand ON THE GROUND in front of a crowd's card stack, a
 *     grandstand's skirt or a cafe terrace's deck edge, so the nearest rank of every crowd is geometry
 *     with a real silhouette, a contact shadow and parallax, and the cards read as the ranks behind it.
 *     Palette colours only (style lock), a darker base band (the shoes), a bleached top (the hat crown),
 *     a painted edge (the shoulder ring). Every part is named `metal` (the painted set: flat albedo with
 *     a specular highlight, the kerb's set) so the figures vertexise into the block's existing
 *     metal_painted bucket and cost no draw of their own. Not a placement: the row is generated at build
 *     time like a fillet, so it has no asset file, no TSV row and no collider (the card's box stands
 *     0.35 m behind it).
 */

import { applyCardDepth } from '../render/materials.js?v=r5-20260906181225';

// deterministic per instance: a small hash on the seed and a stream index, no rng state to keep in step
function h01(seed, k) {
  let x = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(k + 1, 0x85ebca77)) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d) >>> 0; x ^= x >>> 12; x = Math.imul(x, 0x297a2d39) >>> 0; x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}
/** a stable integer seed from a placement's position (metres to a tenth) */
export function seedOf(x, z) { return (Math.round(x * 10) * 7919 + Math.round(z * 10) * 104729) | 0; }

const LAYER_BACK = 0.30, LAYER_UP = 0.30;
function rowGeomStats(THREE, g) {
  if (!g.boundingBox) g.computeBoundingBox();
  const b = g.boundingBox;
  return { zc: (b.min.z + b.max.z) / 2, y0: b.min.y, h: b.max.y - b.min.y };
}
/**
 * Re seat one placed spectator_group as three depth layers. `obj` is the wrapper ASSET() returned (or a
 * far copy of it); returns the number of rows re seated (3 when the asset is what the TSV describes).
 */
export function stackCrowd(THREE, obj, seed, end = 0) {
  const rows = [];
  obj.traverse((o) => {
    if (!o.isMesh || !o.material || Array.isArray(o.material) || !o.geometry) return;
    const m = o.material;
    const isCard = m.isCard || (m.name && String(m.name).startsWith('card:'));
    if (isCard) rows.push(o);
  });
  if (rows.length < 2) return 0;
  const stats = rows.map((o) => ({ o, s: rowGeomStats(THREE, o.geometry) }));
  stats.sort((a, b) => b.s.zc - a.s.zc);     // the asset's front row first (largest z faces the road)
  const n = stats.length;
  const front = stats[0].s;
  // An asset that already ships its layers in depth (the round 5 c2 spectator_group: 0.45 m per layer, wider and
  // darker toward the back, end slices swung, its own front figures) keeps its layout, colours and order: only the
  // per layer size (0.9 to 1.1 about the layer's own centre) and the mirror of every second layer are applied, so a
  // run of them never repeats. The re seat below is for the flat round 4 asset (three cards 14 cm apart).
  if (front.zc - stats[n - 1].s.zc >= 0.25) {
    for (let slot = 0; slot < n; slot++) {
      const e = stats[slot];
      const sc = 0.9 + 0.2 * h01(seed, 10 + slot);
      const mirror = ((slot + Math.floor(h01(seed, 20) * 2)) % 2) === 1;
      const g = e.o.geometry.boundingBox, cx = (g.min.x + g.max.x) / 2;
      // scale and mirror about the layer's own centre (x) and base (y) and centroid depth (z): the layer stays where the asset put it
      e.o.position.set(cx - (mirror ? -cx : cx) * sc, e.s.y0 - e.s.y0 * sc, e.s.zc - e.s.zc * sc);
      e.o.scale.set(mirror ? -sc : sc, sc, sc);
      e.o.updateMatrix();
    }
    return n;
  }
  const rot = Math.floor(h01(seed, 0) * n);   // which cutout takes the front slot this instance
  for (let slot = 0; slot < n; slot++) {
    const e = stats[(slot + rot) % n];
    // an end group of a run tapers: its back layers shrink toward the run (0.86, 0.74 of the front layer) and hug the
    // inner side, so the cutout's straight cut edge shows once, on the front layer, where a figure of the front row stands
    const sc = (0.9 + 0.2 * h01(seed, 10 + slot)) * (end ? 1 - 0.14 * slot : 1);
    const xT = end ? -end * 1.5 * (0.14 * slot) : 0;
    const mirror = ((slot + Math.floor(h01(seed, 20) * 2)) % 2) === 1;
    const zT = front.zc - LAYER_BACK * slot, yT = front.y0 + LAYER_UP * slot;
    // scale is about the mesh origin (the asset's ground centre): the row's base moves by y0 * (sc - 1), under a centimetre
    e.o.position.set(xT, yT - e.s.y0 * sc, zT - e.s.zc * sc);
    e.o.scale.set(mirror ? -sc : sc, sc, sc);
    e.o.updateMatrix();
    // render's depth tint per SLOT (fix5_render request): the picture that moved to the back darkens, on this instance's own geometry copy
    if (typeof applyCardDepth === 'function') applyCardDepth(e.o, n > 1 ? slot / (n - 1) : 0);
  }
  return n;
}

// ------------------------------------------------------------------------------------ the front row
const SHIRTS = [0xed5851, 0x2f5fc4, 0xf2c230, 0x3fc7a0, 0x7a4fc9, 0xf07a2a, 0x1f8fa0, 0xf1e6d2, 0xd6402f, 0x3f8f8a];
const TROUSERS = [0x7d8b5a, 0x3a3f46, 0x3f8f8a, 0xe6cf9c, 0x2f5fc4, 0x8d7b63];
const SKINS = [0xf1cfa8, 0xe0a862, 0xc98a5a, 0x8d6a4a];
const HATS = [0xe6cf9c, 0xf1e6d2, 0xd6402f, 0x2f5fc4, 0xf2c230];
const SHOE = 0x3a3f46;
const _matCache = new Map();
// the material NAME is the set the figures join (build.js passes the heavy set the crowd asset itself uses in that cell,
// 'timber_painted' for the c2 step, so the figures ride a bucket the block already draws: 0 extra draws, and the 30 m
// cells cast from every bucket so the figures throw contact shadows)
function matNamed(THREE, hex, rough, name) {
  const k = name + '|' + hex + '|' + rough;
  let m = _matCache.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0 }); m.name = name; _matCache.set(k, m); }
  return m;
}
function lighter(THREE, hex, f) { const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, Math.max(0, hsl.s * 0.95), Math.min(1, hsl.l * (1 + f))); return c.getHex(); }
const _geoCache = new Map();
function geo(THREE, key, make) { let g = _geoCache.get(key); if (!g) { g = make(); _geoCache.set(key, g); } return g; }

/**
 * One figure, feet at y 0, facing +Z, about 1.62 m tall at hf 1 (hf 0.92..1.08 varies the build, never a scale).
 * Parts: shoes, trousers, torso, shoulder ring, head, hat or cap (most of them), two arms with hands (some raised).
 */
function figure(THREE, seed, k, matName) {
  const r = (i) => h01(seed, 100 + k * 16 + i);
  const hf = 0.92 + 0.16 * r(0);
  const g = new THREE.Group();
  const add = (gm, m, x, y, z) => { const o = new THREE.Mesh(gm, m); o.position.set(x, y, z); g.add(o); return o; };
  const mat = (T, hex, rough = 0.6) => matNamed(T, hex, rough, matName);
  const shirt = SHIRTS[Math.floor(r(1) * SHIRTS.length)];
  const trouser = TROUSERS[Math.floor(r(2) * TROUSERS.length)];
  const skin = SKINS[Math.floor(r(3) * SKINS.length)];
  const hat = HATS[Math.floor(r(4) * HATS.length)];
  const hy = (v) => v * hf;
  // shoes: the darker base band
  add(geo(THREE, 'shoes', () => new THREE.BoxGeometry(0.44, 0.10, 0.28)), mat(THREE, SHOE, 0.7), 0, 0.05, 0.02);
  // trousers
  add(new THREE.BoxGeometry(0.38, hy(0.60), 0.26), mat(THREE, trouser), 0, 0.10 + hy(0.30), 0);
  // torso, a shade wider at the shoulders, and the painted shoulder ring
  const yTor = 0.10 + hy(0.60);
  add(new THREE.CylinderGeometry(0.21, 0.18, hy(0.64), 8), mat(THREE, shirt), 0, yTor + hy(0.32), 0);
  add(geo(THREE, 'ring', () => new THREE.CylinderGeometry(0.215, 0.215, 0.04, 8)), mat(THREE, lighter(THREE, shirt, 0.10)), 0, yTor + hy(0.64), 0);
  // head
  const yHead = yTor + hy(0.64) + 0.17;
  add(geo(THREE, 'head', () => new THREE.SphereGeometry(0.165, 8, 6)), mat(THREE, skin, 0.65), 0, yHead, 0.01);
  // hat: a sun hat (brim plus a bleached crown) or a cap with a peak; one in five is bare headed
  const hk = r(5);
  if (hk < 0.55) {
    add(geo(THREE, 'brim', () => new THREE.CylinderGeometry(0.25, 0.25, 0.03, 10)), mat(THREE, hat), 0, yHead + 0.065, 0);
    add(geo(THREE, 'crown', () => new THREE.CylinderGeometry(0.15, 0.16, 0.13, 8)), mat(THREE, lighter(THREE, hat, 0.08)), 0, yHead + 0.145, 0);
  } else if (hk < 0.80) {
    add(geo(THREE, 'cap', () => new THREE.CylinderGeometry(0.17, 0.175, 0.10, 8)), mat(THREE, lighter(THREE, hat, 0.06)), 0, yHead + 0.11, 0);
    add(geo(THREE, 'peak', () => new THREE.BoxGeometry(0.20, 0.03, 0.13)), mat(THREE, hat), 0, yHead + 0.07, 0.19);
  }
  // arms from the shoulder pivot, hanging out a little or raised (two in five)
  const raised = r(6) < 0.4;
  for (const side of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(side * 0.235, yTor + hy(0.58), 0);
    const up = raised && (side < 0 ? r(7) < 0.7 : r(8) < 0.7);
    piv.rotation.z = side * (up ? 2.55 + 0.25 * r(9 + side) : -(0.12 + 0.12 * r(9 + side)));
    piv.rotation.x = up ? -0.25 : 0.10 * (r(11) - 0.5);
    const arm = new THREE.Mesh(geo(THREE, 'arm', () => new THREE.CylinderGeometry(0.05, 0.045, 0.52, 6, 1, true)), mat(THREE, shirt));
    arm.position.set(0, -0.26, 0);
    piv.add(arm);
    const hand = new THREE.Mesh(geo(THREE, 'hand', () => new THREE.SphereGeometry(0.07, 6, 4)), mat(THREE, skin, 0.65));
    hand.position.set(0, -0.54, 0);
    piv.add(hand);
    g.add(piv);
  }
  return g;
}

/**
 * A row of figures in the parent's local frame (facing +Z, spread along X). spec: { slots: [x...], z, fill (how many
 * of the slots stand), jitterX, jitterZ, yaw (degrees, about +Z) }. `groundY(lx, lz)` returns the local y a figure at
 * local (lx, lz) must stand at (build.js samples the terrain there), so a row on a bank follows the slope.
 */
export function makeCrowdFront(THREE, spec, seed, groundY, end = 0, matName = 'metal') {
  const row = new THREE.Group();
  row.name = 'crowd_front';
  const slots = spec.slots.slice();
  let fill = spec.fill;
  if (spec.endSlot && end) { slots.push(end * spec.endSlot); fill++; }   // the figure that stands over the run's outer cut edge
  // drop (slots - fill) slots, chosen per instance, so the cards show between the figures
  const drop = new Set();
  let guard = 0;
  while (drop.size < Math.max(0, slots.length - fill) && guard++ < 50) {
    const d = Math.floor(h01(seed, 40 + guard) * slots.length);
    if (!(spec.endSlot && end && d === slots.length - 1)) drop.add(d);   // the end figure always stands
  }
  let k = 0;
  for (let s = 0; s < slots.length; s++) {
    if (drop.has(s)) continue;
    const f = figure(THREE, seed, k, matName);
    const lx = slots[s] + (h01(seed, 60 + s) - 0.5) * 2 * (spec.jitterX || 0);
    const lz = spec.z + (h01(seed, 80 + s) - 0.5) * 2 * (spec.jitterZ || 0);
    f.position.set(lx, groundY ? groundY(lx, lz) : 0, lz);
    f.rotation.y = ((h01(seed, 90 + s) - 0.5) * 2 * (spec.yaw || 0)) * Math.PI / 180;
    row.add(f);
    k++;
  }
  return row;
}

/** where the front row stands for each host asset, in the host's local frame (its +Z faces the road) */
export const FRONT_SPECS = {
  // three of four slots along the front layer plus one over the run's outer cut edge (the round 5 c2 spectator_group
  // carries no figures of its own and says so in its header: the front row is the level's)
  spectator_group: { slots: [-1.125, -0.375, 0.375, 1.125], z: 0.62, fill: 3, jitterX: 0.10, jitterZ: 0.10, yaw: 25, endSlot: 1.62 },
  // the round 5 c2 grandstand_small (a modelled front tier) and cafe_terrace (14 modelled figures) carry their own
  // front rows inside the asset, so the level adds none there
};
