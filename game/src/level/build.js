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
import { ASSET, preloadAssets, bakeStatic } from '../../assetlib.js?v=r0-20260906043348';
import { applyMaterials as renderApplyMaterials } from '../render/materials.js?v=r0-20260906043348';
import { expandPlacements, houseWalls, SIZES, COUNTS_EXPECTED, CYLINDER_ASSETS, NO_COLLIDER, DENSITY_ASSETS, SINK, ITEM_BOXES, BOOST_PADS, countPlacements } from './placements.js?v=r0-20260906043348';
import { FILLET_ASSETS, makeFillet } from './fillets.js?v=r0-20260906043348';

const DEG2RAD = Math.PI / 180;
const BLOCK = 30, ORIGIN_X = -210, ORIGIN_Z = -190;
// Bake granularity (integrator, round 0): placements are keyed to the plan's 30 m blocks, but the
// static bake merges 2 x 2 of them (60 m). Measured on the integrated game (work/game/census2.mjs):
// 107 blocks of 30 m gave 1289 baked meshes with 866 in view from the piazza; the whole town is in
// view from three points of the lap, so finer blocks bought no culling and cost 3x the draws.
const BAKE_SPAN = 3;
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
    if (p.asset === 'start_gantry' || p.asset === 'lap_arch' || p.asset === 'town_gate_arch') {
      // arches collide by their piers only
      if (world.addBox) {
        const pier = p.asset === 'start_gantry' ? 1.2 : p.asset === 'lap_arch' ? 0.8 : 1.75;
        const c = Math.cos(yaw), s = Math.sin(yaw);
        for (const side of [-1, 1]) {
          const lx = side * (w / 2 - pier / 2), cx = p.x + lx * c, cz = p.z - lx * s;
          world.addBox(new T.Vector3(cx, y + h / 2, cz), new T.Vector3(pier, h, Math.max(pier, d)), yaw, p.tag); colliders++;
        }
      }
      return;
    }
    if (CYLINDER_ASSETS.has(p.asset) && world.addCylinder) {
      const r = p.asset === 'clock_tower' || p.asset === 'lighthouse' || p.asset === 'fountain' ? Math.min(w, d) / 2 : Math.min(w, d) / 2 * 0.5;
      world.addCylinder(new T.Vector3(p.x, y, p.z), Math.max(0.12, r), h, p.tag); colliders++;
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

  // 5. bake per block
  progress(0.82, 'baking blocks');
  const blocks = new Map();
  let k = 0;
  for (const [key, g] of blockGroups) {
    g.updateMatrixWorld(true);
    const baked = bakeStatic(g);
    // (no '#nocast' suffix: the rig's dithered fade variant of a CARD material dropped its alpha test and
    // the standalone bougainvillea cards drew as 3 x 4 m black squares; main.js hides the fine group by
    // distance instead, and a pop at 140 m on props under 2 m is not visible)
    baked.name = 'block_' + key + (key.endsWith('~fine') ? '_fine' : '');
    baked.userData.fine = key.endsWith('~fine');
    baked.userData.block = key;
    baked.userData.assets = [...blockNames.get(key)];
    baked.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
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
