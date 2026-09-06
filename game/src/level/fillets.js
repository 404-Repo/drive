/**
 * DRIVE  src/level/fillets.js  (owner: level)
 *
 * Contact fillets, lifted from refs/rust17/fillets.js (round 17 item 1 there: "nothing meets
 * the ground") and rewritten for the Sorrel Cove set. Every solid prop in FILLET_ASSETS gets a
 * ring of ground round its footprint: the inner edge hugs the base 6 cm up the object, the outer
 * edge lies on the terrain 35 cm out (wider under houses and rocks), a quarter cosine between,
 * every vertex sampling the terrain so the ring follows the slope. The prop itself is sunk 4 cm
 * by build.js so the fillet has something to climb.
 *
 * The colour comes from the terrain paint under the prop (sand on the beach, grass in town,
 * cobble on the pads, rock on the cliff, asphalt on the lay by) and the material is named
 * 'ground', so the render module's applyMaterials puts it on the same PATINA set as the terrain
 * and bakeStatic merges every fillet of one colour in a block into one mesh.
 *
 * Style lock palette, exact hex: sand 0xe6cf9c, grass dry 0x9aa64a, cobble 0x9a8f80, warm stone
 * 0xcdb897 (rock lit faces), asphalt 0x4d5058. The fillet is 8% darker than the paint so it
 * reads as disturbed ground at the foot of the object, not a pale ring (Rust 17 round 19 item 5).
 */
import * as THREE from 'three';

/**
 * Assets that get a fillet, with the footprint shape: a rectangle from the TSV size (default),
 * or a round base of radius r. `width` is how far the ring reaches out, `lift` how far it climbs.
 */
export const FILLET_ASSETS = {
  // town
  house_narrow_tall: { width: 0.5 }, house_wide_2storey: { width: 0.5 }, house_corner_shop: { width: 0.5 },
  house_arcade: { width: 0.5 }, house_balcony_row: { width: 0.5 }, town_stair_module: { width: 0.4 },
  retaining_wall_terrace: { width: 0.4 }, church_belltower: { width: 0.6 }, clock_tower: { width: 0.5 },
  lighthouse: { width: 0.6 }, fountain: { r: 3.0, width: 0.5 }, town_gate_arch: { width: 0.4 },
  rock_tunnel: { width: 0.7 },
  // furniture and venues
  stone_guardwall: { width: 0.3 }, tyre_wall: { width: 0.3 }, harbour_bollard: { r: 0.25, width: 0.25 },
  start_gantry: { width: 0.4 }, lap_arch: { width: 0.4 }, race_flag_pole: { r: 0.2, width: 0.25 },
  grandstand_small: { width: 0.5 }, cafe_terrace: { width: 0.4 }, street_lamp: { r: 0.25, width: 0.3 },
  market_stall: { width: 0.35 }, produce_crate_stack: { width: 0.3 }, pit_toolcart: { width: 0.25 },
  harbour_davit: { width: 0.3 }, sign_chevron_board: { width: 0.25 }, sign_round_post: { r: 0.2, width: 0.25 },
  // nature
  palm_tall: { r: 0.42, width: 0.5, lift: 0.05 }, palm_short: { r: 0.45, width: 0.5, lift: 0.05 },
  pine_umbrella: { r: 0.55, width: 0.6, lift: 0.05 }, rock_cliff_module: { width: 0.6 }, rock_boulder: { width: 0.4 },
  agave_cluster: { r: 0.8, width: 0.3, lift: 0.04 }, beach_umbrella: { r: 0.25, width: 0.35 },
  // beach (boats only when beached: build.js passes y: null placements here, floating ones never)
  deck_chair: { width: 0.2 }, lifeguard_hut: { width: 0.4 }, pedalo: { width: 0.35 }, rowing_boat: { width: 0.35 },
};

/** fillet colour per terrain paint (terrain.paintAt), 8% below the style lock ground colours */
export const FILLET_COLOURS = {
  sand: 0xd4bf90, grass: 0x8e9944, cobble: 0x8e8476, rock: 0xbdaa8b, asphalt: 0x474a51,
};

const _mats = new Map();
function filletMaterial(paint) {
  const key = FILLET_COLOURS[paint] !== undefined ? paint : 'grass';
  let m = _mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: FILLET_COLOURS[key], roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
    m.name = 'ground';
    _mats.set(key, m);
  }
  return m;
}

/**
 * p: placement (x, z, rot in degrees), size: [w, d] metres from the TSV, spec: FILLET_ASSETS entry,
 * heightAt(x, z) the terrain, paint: 'sand' | 'grass' | 'cobble' | 'rock' | 'asphalt' under the prop.
 * Returns a Mesh in world space (position 0) or null when the footprint is too small.
 * Never scales anything: the ring is built from the TSV footprint plus 2 cm.
 */
export function makeFillet(p, size, spec, heightAt, paint = 'grass') {
  const width = spec.width || 0.35, lift = spec.lift || 0.06;
  const a = (p.rot || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  // local (lx, lz) to world through rotation about +Y: x' = x cos + z sin, z' = -x sin + z cos
  const toWorld = (lx, lz) => [p.x + lx * c + lz * s, p.z - lx * s + lz * c];
  const pts = [];
  if (spec.r) {
    const r = spec.r, n = Math.max(10, Math.round((2 * Math.PI * r) / 0.5));
    for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; pts.push([r * Math.cos(t), r * Math.sin(t), Math.cos(t), Math.sin(t)]); }
  } else {
    const hw = size[0] / 2 + 0.02, hd = size[1] / 2 + 0.02;
    if (hw < 0.15 || hd < 0.08) return null;
    const cr = Math.min(0.15, hw, hd);
    const side = (x0, z0, x1, z1, nx, nz) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 0.5)); for (let i = 0; i < n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, nx, nz]); } };
    const arc = (cx, cz, a0) => { for (let i = 0; i < 3; i++) { const t = a0 + (i / 3) * (Math.PI / 2); pts.push([cx + cr * Math.cos(t), cz + cr * Math.sin(t), Math.cos(t), Math.sin(t)]); } };
    side(-hw + cr, -hd, hw - cr, -hd, 0, -1); arc(hw - cr, -hd + cr, -Math.PI / 2);
    side(hw, -hd + cr, hw, hd - cr, 1, 0); arc(hw - cr, hd - cr, 0);
    side(hw - cr, hd, -hw + cr, hd, 0, 1); arc(-hw + cr, hd - cr, Math.PI / 2);
    side(-hw, hd - cr, -hw, -hd + cr, -1, 0); arc(-hw + cr, -hd + cr, Math.PI);
  }
  const RINGS = 2, pos = [], idx = [], n = pts.length;   // 2 rings at 0.5 m spacing (integrator, round 1: 3 rings at 0.35 m were 103k triangles in view at the hairpin exit for a 6 cm lift)
  for (let r = 0; r <= RINGS; r++) {
    const t = r / RINGS;                             // 0 at the object, 1 at the outer edge
    const prof = 1 - Math.sin(t * Math.PI / 2);      // quarter cosine: steep at the object, flat at the edge
    for (let i = 0; i < n; i++) {
      const [lx, lz, nx, nz] = pts[i];
      const [x, z] = toWorld(lx + nx * width * t, lz + nz * width * t);
      const g = heightAt(x, z);
      const y = t === 0 ? g + lift : g + lift * prof;
      pos.push(x, y + 0.01, z);
    }
  }
  for (let r = 0; r < RINGS; r++) for (let i = 0; i < n; i++) {
    const a0 = r * n + i, a1 = r * n + (i + 1) % n, b0 = a0 + n, b1 = a1 + n;
    idx.push(a0, a1, b0, a1, b1, b0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, filletMaterial(paint));
  mesh.name = 'fillet_' + (p.tag || p.asset);
  mesh.castShadow = false; mesh.receiveShadow = true;
  return mesh;
}
