/**
 * DRIVE  src/level/build.js  (owner: level)
 *
 * Turns PLACEMENTS into the town: preloads every asset through ./assetlib.js (copied verbatim,
 * never edited), instances each placement, sits it on the terrain 4 cm deep, hands it to the
 * render module's applyMaterials, adds a contact fillet under every prop in FILLET_ASSETS,
 * registers colliders and the continuous house front walls, bakes static scenery per 30 m block
 * with bakeStatic, keeps movers (boats, buoys, spectator groups) live with keepHierarchy, applies
 * the tier density, publishes visibleAssets for telemetry, and checks the counts against the TSV.
 *
 * Hard rules kept here (BRIEF section 5 items 5, 9 and 11):
 *   - never scale a placed module to fit: the only transforms are position, rotation and a lean
 *   - a placement whose asset FILE does not exist is skipped with one console.warn per asset
 *     (assets land while the engine is built); an asset whose file exists but imports EMPTY
 *     throws, because that is the silent drop that cost Rust 17 three assets for four rounds
 *   - no primitive stands in for a missing asset, ever
 *
 * Signature (docs/ARCHITECTURE.md):
 *   buildLevel(THREE, { scene, world, terrain, spline, road, tier, onProgress })
 *     -> { blocks, movers, colliders, assetNames, counts, itemBoxAnchors, padAnchors, visibleAssets(camera) }
 * Extra optional inputs (documented in work/level/NOTES.md): assetBase (default './assets/'),
 * assetUrl(name) resolver, and a `materials` override for tests.
 */
import * as THREE from 'three';
import { ASSET, preloadAssets, bakeStatic } from '../../assetlib.js?v=r2-20260906125925';
import { applyMaterials as renderApplyMaterials } from '../render/materials.js?v=r2-20260906125925';
import { expandPlacements, houseWalls, SIZES, COUNTS_EXPECTED, CYLINDER_ASSETS, NO_COLLIDER, DENSITY_ASSETS, SINK, ITEM_BOXES, BOOST_PADS, countPlacements } from './placements.js?v=r2-20260906125925';
import { FILLET_ASSETS, makeFillet } from './fillets.js?v=r2-20260906125925';

const DEG2RAD = Math.PI / 180;
const BLOCK = 30, ORIGIN_X = -210, ORIGIN_Z = -190;
// Bake granularity (integrator, round 0): placements are keyed to the plan's 30 m blocks, but the
// static bake merges 2 x 2 of them (60 m). Measured on the integrated game (work/game/census2.mjs):
// 107 blocks of 30 m gave 1289 baked meshes with 866 in view from the piazza; the whole town is in
// view from three points of the lap, so finer blocks bought no culling and cost 3x the draws.
const BAKE_SPAN = 1;          // 30 m cells for the heavy surface buckets (integrator, round 1; was 3 = 90 m for everything)
const BAKE_SPAN_COARSE = 3;   // 90 m blocks for the light buckets (metal, fabric, foliage, cards, glass, lamps)
// The hybrid granularity, measured at the piazza exit (progress 0.505, desktop, camera plus shadow pass):
// 90 m blocks 2.26M tris / 716 calls, 60 m 1.73M / 800, 30 m 1.35M / 1019. Heavy buckets (stone, plaster,
// timber, tile, ground) carry about 85 percent of a block's triangles, the light ones about half of its
// draws, so the heavy buckets bake per 30 m cell and the light ones per 90 m block.
// Light buckets (measured at the same spot on 30 m cells, draws / triangles in view): the three ground sets
// (fillets, pads: 91 / 71k), the local projection variants and unnamed parts (glass, lamps, caps: 37 / 6k), cards,
// canvas (20 / 29k). Everything else (stone, plaster, timber, tile, metal, foliage) stays on the 30 m cells.
const LIGHT_SETS = new Set(['asphalt_worn', 'sand_beach', 'grass_dry', 'canvas_stripe', 'cobble_warm']);   // cobble_warm off the road: pads and kerb beds, 26 draws for 5k triangles
function lightBucket(m) {
  if (!m || Array.isArray(m)) return false;
  const u = m.userData || {};
  if (!u.triSet) return true;
  if (u.triLocal) return true;
  if (m.alphaTest > 0 || String(u.triSet).startsWith('card')) return true;   // cutout cards: 62 draws for 10k triangles at the hairpin exit
  return LIGHT_SETS.has(u.triSet);
}
function coarseKeyOf(fineKey) {
  const [k] = String(fineKey).split('~');   // the ~fine split is dropped: one coarse block per 90 m, always drawn
  const [bx, bz] = k.split('_').map(Number);
  const f = BAKE_SPAN_COARSE / BAKE_SPAN;
  return `c${Math.floor(bx / f)}_${Math.floor(bz / f)}`;
}
// Small props bake into a second group per block, named '#nocast' so the render rig dithers them out
// over the last 8 m before the tier's scatter distance (140 m high, 90 m phone) and main.js hides the
// group past it: "cull distance for small props", the budget lever ARCHITECTURE allows. Houses,
// landmarks, walls, kerbs, trees and cliffs stay in the coarse group at every distance.
const FINE_ASSETS = new Set(['street_lamp', 'harbour_bollard', 'produce_crate_stack', 'bougainvillea_card', 'agave_cluster', 'deck_chair',
  'beach_umbrella', 'tyre_wall', 'sign_chevron_board', 'sign_round_post', 'race_flag_pole', 'bunting_run', 'pit_toolcart', 'cafe_terrace',
  'market_stall', 'rock_boulder', 'results_podium', 'harbour_davit', 'pedalo', 'rowing_boat', 'grandstand_small', 'lifeguard_hut']);
function bakeKeyOf(block) {
  const [bx, bz] = String(block).split('_').map(Number);
  if (!Number.isFinite(bx) || !Number.isFinite(bz)) return String(block);
  return `${Math.floor(bx / BAKE_SPAN)}_${Math.floor(bz / BAKE_SPAN)}`;
}

function stamp(url) {
  const v = typeof window !== 'undefined' ? window.__BUILD_STAMP__ : null;
  return v ? `${url}?v=${v}` : url;
}
function meshCount(obj) {
  let n = 0;
  obj.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.attributes.position && o.geometry.attributes.position.count > 0) n++; });
  return n;
}
/** does the asset module exist at all: a 404 is "not landed yet", anything else is "present" */
async function exists(url) {
  try {
    const r = await fetch(url, { method: 'GET', cache: 'force-cache' });
    return r.ok;
  } catch (e) { return false; }
}
function densityKeep(index, density) {
  if (density >= 1) return true;
  return ((index * 0.6180339887) % 1) < density;   // deterministic golden ratio stride, no rng needed
}

export async function buildLevel(THREE_, opts) {
  const { scene, world, terrain, spline, road, tier, onProgress } = opts;
  const T = THREE_ || THREE;
  const applyMaterials = opts.materials && opts.materials.applyMaterials ? opts.materials.applyMaterials : renderApplyMaterials;
  const assetBase = opts.assetBase || './assets/';
  const assetUrl = opts.assetUrl || ((name) => `${assetBase}${name}.js`);
  const density = typeof tier === 'object' && tier ? (tier.density ?? 1) : (tier === 'phone' ? 0.5 : 1);
  const heightAt = terrain && terrain.heightAt ? (x, z) => terrain.heightAt(x, z) : () => 0;
  const paintAt = terrain && terrain.paintAt ? (x, z) => terrain.paintAt(x, z) : () => 'grass';
  const progress = (f, label) => { if (onProgress) onProgress(Math.max(0, Math.min(1, f)), label); };

  // 1. the list
  let list = expandPlacements({ spline, road, terrain });
  const densityIndex = new Map();
  list = list.filter((p) => {
    if (!DENSITY_ASSETS.has(p.asset)) return true;
    const i = densityIndex.get(p.asset) || 0; densityIndex.set(p.asset, i + 1);
    return densityKeep(i, density);
  });
  const names = [...new Set(list.map((p) => p.asset))].sort();

  // 2. which assets have landed
  progress(0.02, 'checking assets');
  const present = new Set(), missing = new Set();
  await Promise.all(names.map(async (n) => { (await exists(stamp(assetUrl(n))) ? present : missing).add(n); }));
  for (const n of [...missing].sort()) {
    const k = list.filter((p) => p.asset === n).length;
    console.warn(`[level] asset not landed yet: ${n} (${k} placements skipped, no stand in)`);
  }
  const staticNames = names.filter((n) => present.has(n) && !list.some((p) => p.asset === n && p.moving));
  progress(0.05, 'preloading assets');
  await preloadAssets(staticNames.map((n) => stamp(assetUrl(n))));

  // 3. instance and place
  const blockGroups = new Map();     // key -> Group being filled
  const blockNames = new Map();      // key -> Set of asset names
  const blockBoxes = new Map();      // key -> Box3 in world space
  const movers = [];
  const counts = new Map();
  const assetNames = new Set();
  let colliders = 0;
  const emptyChecked = new Set();
  const tmpBox = new T.Box3();

  const groupFor = (key) => {
    let g = blockGroups.get(key);
    if (!g) { g = new T.Group(); g.name = 'block_' + key; blockGroups.set(key, g); blockNames.set(key, new Set()); blockBoxes.set(key, new T.Box3()); }
    return g;
  };
  const addCollider = (p, size, y) => {
    if (!world || NO_COLLIDER.has(p.asset) || p.moving) return;
    const [w, d, h] = size;
    const yaw = p.rot * DEG2RAD;
    if (p.asset === 'rock_tunnel') {
      // the tunnel collides as two side walls with the 12 m opening cut out (clear 12 of the 20 m width)
      if (world.addBox) {
        const c = Math.cos(yaw), s = Math.sin(yaw);
        for (const side of [-1, 1]) {
          const lx = side * 8, cx = p.x + lx * c, cz = p.z - lx * s;
          world.addBox(new T.Vector3(cx, y + h / 2, cz), new T.Vector3(4, h, d), yaw, 'tunnel'); colliders++;
        }
      }
      return;
    }
    // Round 1 (fix, level): every collider that stands ON a drivable margin (the pavement, the quay strip, the
    // lay by) is a cylinder or a chain of cylinders, never a box. The World slides a kart along a face, but a
    // face square to the travel direction has no tangent to slide along, so a kart riding the pavement was
    // pinned by the start gantry's east leg, the gate piers, the market tyre walls and the quay davit (gate
    // runs: 0 to 8 stalls, 15 s against the davit). A round contact deflects: the kart rolls off to one side.
    const cyl = (cx, cz, r, hh, tag) => { world.addCylinder(new T.Vector3(cx, y + hh / 2, cz), r, hh, tag); colliders++; };
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const local = (lx, lz) => [p.x + lx * c + lz * s, p.z - lx * s + lz * c];   // local (x, z) to world for this placement
    if (p.asset === 'start_gantry' || p.asset === 'lap_arch' || p.asset === 'town_gate_arch') {
      // arches collide by their piers only, each a cylinder that covers the square pier's corners
      if (world.addCylinder) {
        const pier = p.asset === 'start_gantry' ? 1.2 : p.asset === 'lap_arch' ? 0.8 : 1.75;
        for (const side of [-1, 1]) {
          const [cx, cz] = local(side * (w / 2 - pier / 2), 0);
          cyl(cx, cz, pier * 0.72, h, p.tag);
        }
      }
      return;
    }
    if (p.asset === 'tyre_wall' && world.addCylinder) {
      // a capsule: three cylinders along the long axis, so the END of a tyre wall is round and a kart that
      // runs along the kerb line into it slides round instead of stopping dead against a 0.7 m flat end
      for (const lx of [-0.62, 0, 0.62]) { const [cx, cz] = local(lx, 0); cyl(cx, cz, 0.42, h, p.tag); }
      return;
    }
    if (p.asset === 'harbour_davit' && world.addCylinder) {
      // the pedestal only (0.6 m square at the base); the jib reaches out 2.8 m at 3.4 m, above a driver's helmet
      cyl(p.x, p.z, 0.5, h, p.tag);
      return;
    }
    if ((p.asset === 'pit_toolcart' || p.asset === 'produce_crate_stack') && world.addCylinder) {
      cyl(p.x, p.z, Math.max(w, d) / 2 * 0.95, h, p.tag);
      return;
    }
    if (CYLINDER_ASSETS.has(p.asset) && world.addCylinder) {
      const r = p.asset === 'clock_tower' || p.asset === 'lighthouse' || p.asset === 'fountain' ? Math.min(w, d) / 2 : Math.min(w, d) / 2 * 0.5;
      world.addCylinder(new T.Vector3(p.x, y + h / 2, p.z), Math.max(0.12, r), h, p.tag); colliders++;   // geometric centre, as addBox
    } else if (world.addBox) {
      world.addBox(new T.Vector3(p.x, y + h / 2, p.z), new T.Vector3(w, h, d), yaw, p.tag); colliders++;
    }
  };

  const n = list.length;
  for (let i = 0; i < n; i++) {
    const p = list[i];
    if (i % 40 === 0) progress(0.08 + 0.72 * (i / n), `placing ${p.asset}`);
    if (missing.has(p.asset)) continue;
    const size = SIZES[p.asset];
    const url = stamp(assetUrl(p.asset));
    let obj = await ASSET(url, { surfaces: false, keepHierarchy: !!p.moving });
    if (meshCount(obj) === 0) {
      // the file exists (checked above) and still produced nothing: this is the silent drop, so it is a hard failure
      throw new Error(`[level] asset ${p.asset} imported EMPTY from ${url}: refusing to build a town with a hole in it`);
    }
    emptyChecked.add(p.asset);
    // height
    const px = p.probe ? p.probe[0] : p.x, pz = p.probe ? p.probe[1] : p.z;
    let y;
    if (typeof p.y === 'number') y = p.y;
    else y = heightAt(px, pz) + (p.lift || 0) + (p.dy || 0) - SINK;
    obj.position.set(p.x, y, p.z);
    obj.rotation.set(0, p.rot * DEG2RAD, 0);
    if (p.tilt) {
      // a lean, never a scale: rotate about a horizontal axis chosen from the placement's own rotation
      const lean = p.tilt * DEG2RAD, dir = (p.rot * 0.7 + p.x * 0.31 + p.z * 0.17) % (Math.PI * 2);
      obj.rotateOnWorldAxis(new T.Vector3(Math.cos(dir), 0, Math.sin(dir)), lean);
    }
    obj.name = p.tag;
    obj.userData.asset = p.asset;
    // unify stays OFF for movers too (integrator, round 0): with unify the spectator groups' crowd cards took
    // the asset's dominant set and rendered as opaque black squares at the lower street and the piazza
    // (rounds/r0 finish run frames 1 and 2)
    if (p.asset === 'kerb_module') paintKerb(T, obj);
    if (p.paint) paintHull(T, obj, p.paint);
    applyMaterials(obj, { asset: p.asset, local: !!p.moving, unify: false });
    counts.set(p.asset, (counts.get(p.asset) || 0) + 1);
    assetNames.add(p.asset);
    addCollider(p, size, y);

    if (p.moving) {
      // Movers bob as a whole (no joint is animated here), so each instance is merged per material
      // through assetlib's bakeStatic in its own local frame (integrator, round 0: 38 movers were 747
      // meshes and 693 draws from the piazza; now about one draw per material per mover).
      if (!/(^|[?&])nomoverbake=1/.test(typeof location !== 'undefined' ? location.search : '')) obj = bakeMover(T, obj);   // ?nomoverbake=1 is the A/B knob
      obj.name = p.tag;
      obj.userData.asset = p.asset;
      obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(obj);
      const bob = p.bob || { amp: 0.05, period: 2.5, roll: 1, pitch: 0.5, phase: 0 };
      const baseY = y, baseRot = p.rot * DEG2RAD;
      let t = bob.phase || 0;
      movers.push({
        asset: p.asset, object: obj, tag: p.tag, x: p.x, z: p.z,
        update(dt) {
          t += dt;
          const w = (Math.PI * 2) / (bob.period || 2.5);
          obj.position.y = baseY + (bob.amp || 0) * Math.sin(t * w);
          obj.rotation.set((bob.pitch || 0) * DEG2RAD * Math.sin(t * w * 0.71 + 1.3), baseRot, (bob.roll || 0) * DEG2RAD * Math.sin(t * w * 0.53));
        },
      });
      continue;
    }

    const bakeKey = bakeKeyOf(p.block) + (FINE_ASSETS.has(p.asset) ? '~fine' : '');
    const g = groupFor(bakeKey);
    g.add(obj);
    blockNames.get(bakeKey).add(p.asset);
    // fillet under props that stand on the terrain (never under things at an absolute y: boats, bunting, cliff rocks; a road station y counts as ground)
    const spec = FILLET_ASSETS[p.asset];
    if (spec && (p.y === null || p.onGround)) {
      const fillet = makeFillet(p, [size[0], size[1]], spec, heightAt, paintAt(p.x, p.z));
      if (fillet) { applyMaterials(fillet, { asset: 'fillet' }); g.add(fillet); }
    }
  }

  // 4. house front walls as continuous collision segments
  if (world && world.addWallSegment) {
    for (const wsg of houseWalls()) {
      const a = new T.Vector3(wsg.a[0], heightAt(wsg.a[0], wsg.a[1]), wsg.a[1]);
      const b = new T.Vector3(wsg.b[0], heightAt(wsg.b[0], wsg.b[1]), wsg.b[1]);
      world.addWallSegment(a, b, wsg.height, 'house_' + wsg.tag); colliders++;
    }
  }

  // 5a. hybrid granularity: move every light bucket mesh (world transform kept) from its 30 m cell group
  // into the 90 m block group, so the heavy buckets cull finely and the light ones do not multiply draws
  if (BAKE_SPAN_COARSE > BAKE_SPAN) {
    for (const [key, g] of [...blockGroups]) {
      if (key.startsWith('c')) continue;
      g.updateMatrixWorld(true);
      const move = [];
      g.traverse((o) => { if (o.isMesh && lightBucket(o.material)) move.push(o); });
      if (!move.length) continue;
      const ck = coarseKeyOf(key);
      const cg = groupFor(ck);
      for (const m of move) cg.attach(m);
      for (const n of blockNames.get(key)) blockNames.get(ck).add(n);
    }
  }

  // 5. bake per block
  progress(0.82, 'baking blocks');
  const blocks = new Map();
  let k = 0;
  for (const [key, g] of blockGroups) {
    g.updateMatrixWorld(true);
    let empty = true; g.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.attributes.position && o.geometry.attributes.position.count > 0) empty = false; });
    if (empty) continue;   // a cell whose every mesh moved to the coarse block
    const baked = bakeStatic(g);
    // (no '#nocast' suffix: the rig's dithered fade variant of a CARD material dropped its alpha test and
    // the standalone bougainvillea cards drew as 3 x 4 m black squares; main.js hides the fine group by
    // distance instead, and a pop at 140 m on props under 2 m is not visible)
    baked.name = 'block_' + key + (key.endsWith('~fine') ? '_fine' : '');
    baked.userData.fine = key.endsWith('~fine');
    baked.userData.block = key;
    baked.userData.assets = [...blockNames.get(key)];
    // a coarse (light bucket) block casts only from its cards (bunting, crowds, fronds) and canvas awnings:
    // fillets, pads, glass, lamp heads and caps have no shadow anyone can see (23 calls and 67k triangles
    // of shadow pass at the piazza exit); the 30 m cells cast from every bucket
    const coarse = key.startsWith('c');
    baked.traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const u = (m && m.userData) || {};
      o.castShadow = !coarse || (m && m.alphaTest > 0) || u.triSet === 'canvas_stripe';
      o.receiveShadow = true;
    });
    tmpBox.setFromObject(baked);
    blockBoxes.get(key).copy(tmpBox);
    baked.userData.box = tmpBox.clone();
    scene.add(baked);
    blocks.set(key, baked);
    if ((++k) % 8 === 0) progress(0.82 + 0.15 * (k / blockGroups.size), 'baking blocks');
  }

  // 6. anchors for items
  const itemBoxAnchors = ITEM_BOXES.map((b) => ({ x: b.x, y: (typeof b.y === 'number' ? b.y : heightAt(b.x, b.z)) + 0.5, z: b.z }));
  const padAnchors = BOOST_PADS.map((b) => ({ x: b.x, y: heightAt(b.x, b.z), z: b.z, rot: b.rot * DEG2RAD }));

  // 7. counts against the TSV (the rule sets are the truth; a 20% gap is logged, never fatal)
  const expected = COUNTS_EXPECTED;
  const planned = countPlacements(list);
  const lines = [];
  for (const [name, exp] of Object.entries(expected)) {
    if (!exp && !planned.get(name)) continue;
    const got = counts.get(name) || 0, plan = planned.get(name) || 0;
    const off = exp ? Math.abs(plan - exp) / exp : 0;
    if (missing.has(name) && plan) lines.push(`${name}: 0 placed of ${plan} planned (asset not landed)`);
    else if (off > 0.2 && plan) lines.push(`${name}: ${got} placed, TSV ${exp} (${Math.round(off * 100)}% off, rule set is the truth)`);
  }
  if (lines.length) console.warn('[level] counts vs docs/OBJECTS.tsv:\n  ' + lines.join('\n  '));
  console.log(`[level] placed ${[...counts.values()].reduce((a, b) => a + b, 0)} objects of ${assetNames.size} assets in ${blocks.size} blocks, ${movers.length} movers, ${colliders} colliders, ${missing.size} assets missing`);

  // 8. visibility for telemetry: asset names in the frustum within 40 m (block boxes and mover positions)
  const frustum = new T.Frustum(), pm = new T.Matrix4(), sph = new T.Sphere(), camPos = new T.Vector3();
  function visibleAssets(camera) {
    if (!camera) return [];
    camera.updateMatrixWorld();
    pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pm);
    camera.getWorldPosition(camPos);
    const out = new Set();
    for (const [key, b] of blocks) {
      const box = b.userData.box;
      if (!box || box.isEmpty()) continue;
      if (box.distanceToPoint(camPos) > 40) continue;
      if (!frustum.intersectsBox(box)) continue;
      for (const nme of b.userData.assets) out.add(nme);
      void key;
    }
    for (const m of movers) {
      const d = Math.hypot(m.object.position.x - camPos.x, m.object.position.z - camPos.z);
      if (d > 40) continue;
      sph.set(m.object.position, 2.5);
      if (frustum.intersectsSphere(sph)) out.add(m.asset);
    }
    return [...out];
  }

  progress(1, 'level ready');
  return { blocks, movers, colliders, assetNames, counts, itemBoxAnchors, padAnchors, visibleAssets, missing, placements: list };
}

/**
 * Kerb paint, per instance, BEFORE applyMaterials bakes colour into the vertices (the same route
 * kartview.js takes for the liveries). Round 1 critic: "kerb red should be hue 0, saturation 0.6 or
 * more, white luma 230 or more; in sun the red reads salmon and in shade maroon", and claim 3's
 * kerbRW counted only 3 of 8 frames. Measured on a lit kerb before this change (work/fix1_level,
 * shot at progress 0.125): red hue 8 sat 0.81 luma 76, white luma 173 sat 0.25, so the WHITE blocks
 * never met the metric's white (luma over 200, saturation under 0.20): whitewash 0xf1e6d2 under the
 * warm sun is cream. What the level can do about it:
 *   - the white stripes become a neutral near white (about 0xf1efec body, 0xf8f7f5 top, saturation 0.03,
 *     still not pure white) so the sun's warmth lands them under 0.20 where the fill reaches them; measured
 *     after: white saturation 0.07 to 0.14 in frame (was 0.25)
 *   - the red stripes turn to hue 4, saturation about 0.75, a shade lighter (about 0xea4438 body) so the
 *     sun does not push them salmon and the shade does not crush them to maroon; measured after: hue 353 to
 *     356, saturation 0.82 in frame (was hue 8, and salmon or maroon by the critic's eye)
 *   - both are renamed 'metal' (the painted set: a flat painted albedo with a specular highlight at
 *     roughness 0.45) instead of 'stone' (the dressed masonry set with its albedo variation): a
 *     painted kerb block is glossy paint on concrete, and the highlight is what lifts the sunlit
 *     faces toward the bar's glossy kerbs
 * The stone strip, the base band and the joint bed keep the asset's stone. Materials are cloned per
 * instance because ASSET() shares them across instances of the prototype.
 */
const _kc = { c: null };
function paintKerb(T, obj) {
  if (!_kc.c) _kc.c = new T.Color();
  const c = _kc.c, cloned = new Map();
  obj.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.color) return;
    let m = cloned.get(o.material);
    if (!m) {
      const src = o.material;
      c.copy(src.color).convertLinearToSRGB();
      const max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b);
      const sat = max > 0 ? (max - min) / max : 0;
      const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
      let hue = 0;
      if (max > min) { const d = max - min; hue = max === c.r ? 60 * (((c.g - c.b) / d + 6) % 6) : max === c.g ? 60 * ((c.b - c.r) / d + 2) : 60 * ((c.r - c.g) / d + 4); }
      const red = (hue < 25 || hue > 335) && sat > 0.5 && lum > 0.25;
      const white = sat < 0.2 && lum > 0.78;
      if (!red && !white) { cloned.set(src, src); return; }
      m = src.clone();
      // keep the part's own value (the top is bleached, the chamfer a shade lighter) and replace hue and saturation
      // red: hue 4, HSV saturation about 0.75, lightness lifted 12 percent (a saturated red has a low luma by
      // construction, 0.2126 R + 0.7152 G + 0.0722 B; the metric's red needs luma over 50 in the frame, and the
      // measured in frame red was 42 to 50 at the darker value). white: HSV saturation 0.03, lightness 0.93 to 0.97.
      // round 2: HSL saturation 0.92 and lightness 0.48 to 0.58 (was 0.80 and 0.52 to 0.62). Under the round 2 rig the
      // red stripes read HSV saturation p50 0.56 to 0.60 in frame (fix_level_3/5/7, 12 to 13k kerb pixels a frame, half of
      // them under the bar's 0.6): the warm sun and the fill add green and blue to a light red faster than to a deep one
      if (red) m.color.setHSL(4 / 360, 0.92, Math.min(0.58, Math.max(0.48, 0.5 * (max + min) * 1.04)), T.SRGBColorSpace);
      else m.color.setHSL(40 / 360, 0.14, Math.min(0.97, Math.max(0.93, 0.5 * (max + min) * 1.07)), T.SRGBColorSpace);
      m.name = 'metal';
      m.roughness = 0.45; m.metalness = 0.06;
      cloned.set(src, m);
    }
    if (m !== o.material) o.material = m;
  });
}

/**
 * Painted boats (round 2, critic item 5: "painted boats" among the saturated objects the bar has and the
 * build lacked). Per instance, before applyMaterials, the same route as paintKerb and the kart liveries:
 * every material of the boat in the asset's timber teal family (hue 165 to 195, saturation over 0.3: the
 * hull planks, their dark band, edge strip and top) is cloned and moved to the livery hue and saturation
 * of `hex` (a style lock livery colour, placements.BOAT_PAINT), keeping the part's own lightness offset
 * from the base teal so the painted edge and the base band survive. Gunwale, boot top, deck, wheelhouse,
 * rope and iron keep the asset's colours and names. Materials are cloned because ASSET() shares them
 * between the instances of a prototype.
 */
const _hp = { c: null, t: null, hsl: { h: 0, s: 0, l: 0 }, thsl: { h: 0, s: 0, l: 0 }, base: { h: 0, s: 0, l: 0 } };
function paintHull(T, obj, hex) {
  if (!_hp.c) { _hp.c = new T.Color(); _hp.t = new T.Color(); }
  const c = _hp.c, t = _hp.t, cloned = new Map();
  t.setHex(hex, T.SRGBColorSpace); t.getHSL(_hp.thsl, T.SRGBColorSpace);
  c.setHex(0x3f8f8a, T.SRGBColorSpace); c.getHSL(_hp.base, T.SRGBColorSpace);
  obj.traverse((o) => {
    if (!o.isMesh || !o.material || Array.isArray(o.material) || !o.material.color) return;
    let m = cloned.get(o.material);
    if (!m) {
      const src = o.material;
      src.color.getHSL(_hp.hsl, T.SRGBColorSpace);
      const hue = _hp.hsl.h * 360;
      const teal = hue > 165 && hue < 195 && _hp.hsl.s > 0.3;
      if (!teal) { cloned.set(src, src); return; }
      m = src.clone();
      m.color.setHSL(_hp.thsl.h, _hp.thsl.s, Math.min(0.85, Math.max(0.12, _hp.thsl.l + (_hp.hsl.l - _hp.base.l))), T.SRGBColorSpace);
      cloned.set(src, m);
    }
    if (m !== o.material) o.material = m;
  });
}

/** block key helper shared with telemetry (TRACK-PLAN section 10) */
/** Merge a mover instance per material in its local frame; the returned group carries the same transform. */
function bakeMover(T, obj) {
  const pos = obj.position.clone(), quat = obj.quaternion.clone(), scl = obj.scale.clone();
  const ud = obj.userData;
  obj.position.set(0, 0, 0); obj.quaternion.identity(); obj.scale.set(1, 1, 1);
  obj.updateMatrixWorld(true);
  let baked;
  try { baked = bakeStatic(obj); } catch (e) { console.warn('[level] mover bake failed, kept live:', e && e.message); baked = null; }
  if (!baked || meshCount(baked) === 0) { obj.position.copy(pos); obj.quaternion.copy(quat); obj.scale.copy(scl); return obj; }
  baked.position.copy(pos); baked.quaternion.copy(quat); baked.scale.copy(scl);
  baked.userData = Object.assign({}, ud, baked.userData);
  return baked;
}
export function blockKey(x, z) { return `${Math.floor((x - ORIGIN_X) / BLOCK)}_${Math.floor((z - ORIGIN_Z) / BLOCK)}`; }
