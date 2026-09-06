/**
 * DRIVE  src/kart/kartview.js  (owner: kart)
 *
 * One KartView per racer: the visible kart. Assembles kart_chassis, four kart_wheel and
 * driver_racer per instance through ASSET(url, { keepHierarchy: true }) from ./assetlib.js,
 * applies the livery colours (material.color per instance, on cloned materials, BEFORE the
 * render module's applyMaterials bakes colour into vertices), then applyMaterials({ local: true })
 * and a per joint bake so an articulated kart costs about twenty draws instead of sixty.
 *
 *   const view = new KartView({ scene, livery: { body, suit, helmet, stripe }, id });
 *   await view.load();
 *   view.update(dt, body);                 // after body.update
 *   view.setItemHeld('espresso' | null);   // espresso_cup at the itemHold socket
 *   view.setShield(true | false);          // foam_shield round the kart
 *   view.screenBox(camera);               // { x, y, w, h, nx, ny, nw, nh } px, or null
 *
 * Sockets and joints come from the assets' userData (docs/OBJECTS.tsv): chassis sockets
 * wheelFL, wheelFR, wheelRL, wheelRR, seat, exhaustL, exhaustR, itemHold and joint steer; the
 * driver's joints head, torso, upperArmL, upperArmR, forearmL, forearmR. A missing socket falls
 * back to the TSV geometry with a console.warn naming it. A missing ASSET (the loader returns an
 * empty group) is skipped with a console.warn naming the asset; the kart still builds and moves,
 * it just lacks that part. Nothing is ever replaced by a box.
 *
 * Livery, two conventions both honoured, the ARCHITECTURE flag first, the shipped assets' second:
 *   - material.userData.livery === true (chassis, wheel) or 'suit' | 'helmet' | 'stripe' (driver)
 *   - the asset group's userData names the paint by recipe and colour as 'recipe:hex', which
 *     survives the loader's clone as plain data: chassis livery, liveryLight, liveryDark
 *     ('metal:ed5851' etc), wheel livery (the centre cap), driver livery (the suit, 'fabric:..'),
 *     suitAccent (the second suit tone) and helmet ('metal:..'). Materials are matched by NAME and
 *     COLOUR and recoloured on per instance clones: body, body tinted 11% lighter for the painted
 *     edges, 18% darker for the base band; suit, the racer's helmet colour on the suit accent,
 *     helmet, and the stripe on any light 'metal' part of the driver that is not the helmet.
 *
 * Effects (drift sparks in three tier colours, boost exhaust flames) are pooled across ALL karts in
 * one scene: two Points objects and one InstancedMesh of cones, three draws for the field.
 *
 * Round 1 (the blind critic: "a matte matchbox"): the livery parts (body paint, its edge and base
 * tints, the wheel caps, the helmet and its stripe) are swapped AFTER the render module's material
 * pass onto one shared PaintMaterial, a MeshPhysicalMaterial with a clearcoat that reads the baked
 * vertex colour and aRM like the render module's VertexPBR does, so the kart carries a real specular
 * highlight from the sun and a sky reflection while the style lock colour survives per vertex. The
 * paint parts merge into their own bucket per joint (one extra draw per kart). And a kart whose
 * centre is within NEAR_CULL metres of the chase camera (horizontally) is hidden, so an AI kart
 * sitting on the camera no longer pushes a helmet through the bottom of the frame; the followed
 * kart is never culled. Round 2: the camera came in to 2.8 m, so the cull radius dropped from 3.1 m to
 * 2.0 m (3.1 m would have hidden a kart half a length behind the player and alongside it).
 *
 * Round 1 draws: the rear wheels share one spin group on the axle line and bake together (a wheel's
 * worth of draws off every kart, 36 to 32 meshes); `hero: false` in the constructor bakes the
 * steering wheel into the chassis for an AI kart (two more). `?paint=0` is the A/B against the
 * matte baked kart.
 *
 * Round 3 (the blind critic: "a matte block toy ... flat red albedo with no gloss or sky reflection,
 * black cylinder tyres with no tread or rim, two flat glowing headlight polygons, a featureless
 * helmet blob"):
 *   - The paint now REFLECTS THE SKY. three 0.169 overrides a material's envMapIntensity with
 *     scene.environmentIntensity (the rig's 0.4 fill) whenever material.envMap is null, so the
 *     round 1 and 2 clearcoat never had more sky than the plaster. PaintMaterial now takes the rig's
 *     PMREM as its own envMap (adopted in update() once scene.environment exists) at PAINT_ENV, and
 *     the shader scales the baked roughness by PAINT_ROUGH (0.35 in the asset reads as 0.25).
 *     `?kenv=0.9` overrides PAINT_ENV for an A/B.
 *   - CHROME and the VISOR ride in the same clearcoat bucket: an asset material tagged
 *     `userData.finish = 'chrome' | 'visor'` keeps its own colour and its baked metalness 1 and
 *     roughness (0.2 chrome, 0.06 visor) through the vertex bake, and swapPaint puts the mesh on the
 *     PaintMaterial where vertex metalness 1 makes it a sky mirror. Zero extra draws per kart.
 *   - The rear plate's race numeral: the chassis carries `numeral_1..8` holders; the racer's own
 *     (id + 1) is kept and the rest are removed before the bake.
 *   - `paint` is its own option (the ai agent's request): the clearcoat buckets are on for every
 *     kart by default, `hero` only decides which joints stay articulated.
 *   - Drift sparks are bigger, brighter (HDR, so the threshold bloom picks them up) and live long
 *     enough to read in a still, with a hot glow at the sliding tyre's contact point by tier.
 *   - Near cull follows the round 3 camera (3.7 m back): a kart under NEAR_CULL of the camera, or one
 *     whose screen box covers more than NEAR_AREA of the frame, is hidden until it clears.
 *
 * Round 4 (motion cues, Ben's targeted round):
 *   - Drift sparks are STREAKS, not points: one instanced quad mesh for the whole field, each streak
 *     stretched along the tyre's direction of travel (0.15 m at rest to 0.5 m at vmax, shrinking as it
 *     dies), 2 to 3.5 cm wide and never under 1.6 px, tier colours orange, yellow, blue white at 1.4x HDR
 *     so the threshold bloom adds a glow and not a disc. The round 3 contact glow (a 0.55 to 0.85 m soft
 *     point at 1.6x under each tyre) was the 40 px orange disc the desktop filmstrip showed; it is gone.
 *   - TYRE SMOKE on landing and on a kerb hit: pooled puffs (one Points for the field, normal blending,
 *     tone mapped like the scene on the phone path), warm grey by surface, 0.6 to 1.2 s, growing and
 *     fading. The drift smoke itself is ai/driftfx.js (attached by main.js); this pool only adds what it
 *     does not cover. Effects for all karts: sparks 1, flares 1, cones 1, smoke 1 draws.
 *   - Near camera FADE: an AI kart's materials are cloned once at load so its opacity can ramp from 1 at
 *     2.8 m to 0 at 2.0 m from the camera (and to 0 when its screen box passes NEAR_AREA) instead of the
 *     round 3 pop; the followed kart never fades.
 *   - KERB BOUNCE: physics.js kerbHop lifts the body group (not the wheels) by up to about 3 cm, a new hit
 *     compresses the squash spring and rolls the body 1.7 degrees toward the hit side for a quarter second,
 *     and a few dust puffs leave the wheel.
 */
import * as THREE from 'three';
import { ASSET, bakeStatic } from '../../assetlib.js?v=r4-20260906171652';
import { KART } from './physics.js?v=r4-20260906171652';
import { CHASE } from './camera.js?v=r4-20260906171652';

const SPARK_COLOURS = [0xff8a2a, 0xff8a2a, 0xffd23a, 0xd6e6ff];   // index by tier (0 unused): round 4, orange, yellow, blue white (Ben's direction)
const FLARE_COLOUR = 0xffc48a;
const MAX_KARTS = 8;
const SPARKS_PER_KART = 128;
const FLARES_PER_KART = 44;
const SMOKE_PER_KART = 40;
const FLARE_CORE = 0xffe2b0, FLARE_FRINGE = 0xf07a2a;
const SPARK_HDR = 1.4;      // round 4: sparks are written a little above 1.0 so the post's threshold bloom adds a glow, not a disc (round 3: 2.2)
const SPARK_LEN = { min: 0.15, max: 0.5 };   // metres, by the kart's speed over vmax
const SPARK_WIDTH = { min: 0.028, max: 0.045 };
const SMOKE_COLOURS = { asphalt: 0xe4dcd0, cobble: 0xe4dcd0, pad: 0xe4dcd0, sand: 0xe6cf9c, grass: 0xc9c59a };   // warm greys, never pure white (style lock)
const FAR_CULL = 220;   // metres, horizontal: an AI kart beyond this is not drawn (round 2, integrator)
const NEAR_FADE_OUT = 2.0, NEAR_FADE_IN = 2.8;   // metres, horizontal, camera to kart centre: an AI kart is fully faded under the first and fully shown past the second (round 4: a fade, not a pop; round 3 hid under 2.4 m)
const NEAR_AREA = 0.22, NEAR_AREA_SHOW = 0.16;   // fraction of the frame a non player kart's screen box may cover before it is faded out (critic round 3: nothing but the player over 20 percent)
// the hero paint: the rig's PMREM as the paint's own envMap so envMapIntensity is honoured (three 0.169 overrides
// it with scene.environmentIntensity, the 0.4 fill, when material.envMap is null), and a roughness scale on the
// baked value so the style lock's 0.35 body paint reads as the critic's 0.25 under the clearcoat
const PAINT_IOR = (() => { try { const q = new URLSearchParams(globalThis.location ? globalThis.location.search : "").get("kior"); const v = q === null ? NaN : parseFloat(q); return Number.isFinite(v) ? v : 2.0; } catch (e) { return 2.0; } })();   // ?kior= A/B (integrator, round 3)
const PAINT_ENV = (() => { try { const q = new URLSearchParams(globalThis.location ? globalThis.location.search : "").get("kenv"); const v = q === null ? NaN : parseFloat(q); return Number.isFinite(v) ? v : 0.85; } catch (e) { return 0.85; } })();
const PAINT_ROUGH = 0.72;
const PAINT_METAL_FLOOR = 0.25;

/**
 * The clearcoat paint: colour, roughness and metalness come from the vertices the render module's
 * bake wrote (`color`, `aRM`), exactly as its VertexPBR does, on a MeshPhysicalMaterial with a
 * clearcoat layer. onBeforeCompile lives on the prototype so it survives clone() and chains with
 * the lighting rig's CSM, bounce and aerial hooks (the rig keeps a previous hook and runs both).
 * three 0.169 hands onBeforeCompile the includes UNEXPANDED, so the include lines are replaced whole.
 */
class PaintMaterial extends THREE.MeshPhysicalMaterial {
  constructor(params) {
    super(params);
    this.vertexColors = true;
    this.color.set(1, 1, 1);
    this.roughness = 1;
    this.metalness = 1;
    this.clearcoat = 1.0;
    this.clearcoatRoughness = 0.08;
    // honoured only once envMap is set (KartView.update adopts scene.environment); the rig caps values above 1
    this.envMapIntensity = PAINT_ENV;
    this.specularIntensity = 1.0;
    // a high index of refraction lifts the base layer's F0 from 0.04 to about 0.15 (three's clearcoat F0 is a fixed
    // 0.04): the sky lands on the bodywork as a visible band and the sun's highlight is four times brighter.
    // Measured: at ior 1.5 the 0.85 and 1.5 env levels were indistinguishable in a frame (work/fix3_kart/env_sheet.png)
    this.ior = PAINT_IOR;
    this.name = 'kart_paint';
  }
  onBeforeCompile(shader) {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aRM;\nvarying vec2 vRM;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRM = aRM;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRM;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp( vRM.x * ' + PAINT_ROUGH.toFixed(3) + ', 0.04, 1.0 );')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = max( vRM.y, ' + PAINT_METAL_FLOOR.toFixed(2) + ' );');   // a metallic flake floor on the paint; chrome and the visor carry 1.0 in the vertices
  }
  customProgramCacheKey() { return 'drive_paint'; }
}
/** Give every shared paint material the scene's PMREM as its own envMap (once, when it exists). */
function adoptEnvironment(scene) {
  const env = scene && scene.environment;
  if (!env) return;
  for (const m of PAINT.values()) {
    if (m.envMap !== env) { m.envMap = env; m.needsUpdate = true; }
  }
  for (const m of FADE_PAINTS) {
    if (m.envMap !== env) { m.envMap = env; m.needsUpdate = true; }
  }
}
const FADE_PAINTS = new Set();   // round 4: per AI kart clones of the paint (for the near camera fade) that also need the PMREM
const PAINT = new Map();   // side|transparent -> shared PaintMaterial
function paintFor(src) {
  const side = src && src.side !== undefined ? src.side : THREE.FrontSide;
  const key = side + '|' + (src && src.transparent ? 1 : 0);
  let m = PAINT.get(key);
  if (!m) {
    m = new PaintMaterial({ side });
    if (src && src.transparent) { m.transparent = true; m.opacity = src.opacity; }
    PAINT.set(key, m);
  }
  return m;
}
/**
 * Swap every mesh tagged as paint by applyLivery onto the shared PaintMaterial. Runs AFTER the render
 * module's applyMaterials (the vertices then carry colour and aRM) and BEFORE the per joint bake (so
 * the paint parts merge into their own bucket). A mesh whose geometry never got the baked attributes
 * (the materials module failed to load) keeps a plain physical clone of its own colour instead.
 */
const PAINT_OFF = (() => { try { return /[?&]paint=0(&|$)/.test(globalThis.location ? globalThis.location.search : ''); } catch (e) { return false; } })();   // ?paint=0: the A/B against the matte baked kart
function swapPaint(root) {
  let n = 0;
  if (PAINT_OFF) return 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.material || Array.isArray(o.material) || !o.userData || !o.userData.paint) return;
    const g = o.geometry;
    if (g && g.attributes && g.attributes.color && g.attributes.aRM) { o.material = paintFor(o.material); n++; return; }
    const src = o.material;
    if (src && src.isMeshStandardMaterial && !src.isVertexPBR) {
      const m = new THREE.MeshPhysicalMaterial({ color: src.color.clone(), roughness: src.roughness * PAINT_ROUGH, metalness: src.metalness, side: src.side, clearcoat: 1.0, clearcoatRoughness: 0.08, envMapIntensity: PAINT_ENV });
      m.name = 'kart_paint'; o.material = m; n++;
    }
  });
  return n;
}

// The PROMISE is cached, not the result: eight views load concurrently through Promise.all, and a
// flag set by the first caller handed the other seven a null while the import was still pending,
// so only kart 0 ever got its materials (and its draw merge). Never cache a flag across an await.
let _materialsPromise = null;
function loadApplyMaterials() {
  if (_materialsPromise) return _materialsPromise;
  _materialsPromise = (async () => {
    try {
      const m = await import('../render/materials.js?v=r4-20260906171652');
      const fn = typeof m.applyMaterials === 'function' ? m.applyMaterials : null;
      if (!fn) console.warn('[kartview] render/materials.js has no applyMaterials export; karts keep flat colours');
      return fn;
    } catch (e) {
      console.warn('[kartview] render/materials.js not loaded (' + (e && e.message) + '); karts keep flat colours');
      return null;
    }
  })();
  return _materialsPromise;
}

function stamp() {
  const s = typeof window !== 'undefined' ? window.__BUILD_STAMP__ : null;
  return s ? '?v=' + encodeURIComponent(s) : '';
}

function countMeshes(root) {
  let n = 0;
  if (root) root.traverse((o) => { if (o.isMesh) n++; });
  return n;
}

/**
 * Clone the materials of every mesh in `root` whose material carries a livery flag and recolour
 * them. Materials are SHARED between instances by Object3D.clone, so a colour set on the shared
 * material would paint every kart the last livery; the clone is per instance.
 * `pick(m)` returns a hex, or `{ hex, paint: true }` to mark the mesh for the clearcoat paint
 * (swapPaint), or null to leave the material alone.
 */
function applyLivery(root, pick) {
  let touched = 0;
  const cloned = new Map();
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const out = mats.map((m) => {
      if (!m) return m;
      const r = pick(m);
      if (r == null) return m;
      const c = typeof r === 'number' ? r : r.hex;
      if (typeof r === 'object' && r.paint) o.userData.paint = true;
      let mm = cloned.get(m);
      if (!mm) {
        mm = m.clone();
        mm.name = m.name;
        mm.color.setHex(c);
        cloned.set(m, mm);
      }
      touched++;
      return mm;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
  });
  return touched;
}
const paint = (hex) => ({ hex, paint: true });
/** A chrome or visor part keeps its own colour and rides in the clearcoat bucket (vertex metalness 1 makes it a mirror). */
const finishOf = (m) => (m && m.userData && (m.userData.finish === 'chrome' || m.userData.finish === 'visor') && m.color ? paint(m.color.getHex()) : null);

/** Saturation of a material colour in 0..1, for the livery fallback. */
function saturationOf(m) {
  const c = m.color; if (!c) return 0;
  const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b);
  return mx > 1e-4 ? (mx - mn) / mx : 0;
}

/** 'metal:ed5851' -> { name: 'metal', hex: 0xed5851 }, else null. */
function parseRef(s) {
  if (typeof s !== 'string') return null;
  const i = s.indexOf(':'); if (i < 0) return null;
  const hex = parseInt(s.slice(i + 1), 16);
  if (!Number.isFinite(hex)) return null;
  return { name: s.slice(0, i), hex };
}
function matchesRef(m, ref) { return !!(ref && m && m.color && m.name === ref.name && m.color.getHex() === ref.hex); }
const _hsl = { h: 0, s: 0, l: 0 };
const _tc = new THREE.Color();
/** The assets' own tint rule: lightness scaled by (1 + dl), saturation by ds. */
function tintHex(hex, dl, ds) {
  _tc.setHex(hex).getHSL(_hsl);
  _tc.setHSL(_hsl.h, Math.max(0, Math.min(1, _hsl.s * ds)), Math.max(0, Math.min(1, _hsl.l * (1 + dl))));
  return _tc.getHex();
}
/** Perceived luminance 0..1 of a material colour in sRGB. */
function lumOf(m) {
  if (!m || !m.color) return 0;
  _tc.copy(m.color).convertLinearToSRGB();
  return 0.299 * _tc.r + 0.587 * _tc.g + 0.114 * _tc.b;
}
/** Is this material the darker tone of the reference colour (same family, 70 to 96% of its luminance)? */
function isDarkerToneOf(m, refHex) {
  if (!m || !m.color) return false;
  _tc.setHex(refHex);
  const refSat = saturationOf({ color: _tc }), refLum = 0.299 * _tc.r + 0.587 * _tc.g + 0.114 * _tc.b;
  const lum = 0.299 * m.color.r + 0.587 * m.color.g + 0.114 * m.color.b;
  return Math.abs(saturationOf(m) - refSat) < 0.08 && lum > refLum * 0.55 && lum < refLum * 0.96;
}

/**
 * Bake an articulated asset per joint: every mesh is merged into the nearest joint above it (or
 * the root), in that joint's local space, through assetlib's bakeStatic so instancing, attribute
 * signatures and shadow flags are handled by the one loader. The joints stay where they were and
 * keep rotating; the draws per kart drop from every part to one per material per joint.
 */
function bakeArticulated(root, joints) {
  root.updateMatrixWorld(true);
  const jointSet = new Set(joints.filter(Boolean));
  const owners = new Map();   // owner node -> meshes
  const ownerOf = (o) => { let p = o.parent; while (p && p !== root) { if (jointSet.has(p)) return p; p = p.parent; } return root; };
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (jointSet.has(o)) return;                       // a mesh that IS a joint stays
    const owner = ownerOf(o);
    if (!owners.has(owner)) owners.set(owner, []);
    owners.get(owner).push(o);
  });
  const inv = new THREE.Matrix4(), rel = new THREE.Matrix4();
  for (const [owner, meshes] of owners) {
    if (!meshes.length) continue;
    inv.copy(owner.matrixWorld).invert();
    const g = new THREE.Group();
    for (const m of meshes) {
      rel.multiplyMatrices(inv, m.matrixWorld);
      m.removeFromParent();
      rel.decompose(m.position, m.quaternion, m.scale);
      g.add(m);
    }
    const baked = bakeStatic(g);
    baked.name = (owner.name || 'root') + '_baked';
    owner.add(baked);
  }
}

/** Pooled sparks and flares for every kart in one scene. */
class EffectsPool {
  constructor(scene) {
    this.scene = scene;
    this.slots = 0;
    const nS = MAX_KARTS * SPARKS_PER_KART, nF = MAX_KARTS * FLARES_PER_KART;
    const nSm = MAX_KARTS * SMOKE_PER_KART;
    this.sparks = this._streaks(nS);             // round 4: velocity aligned streak quads, one instanced draw
    this.flares = this._points(nF, this._texture(true), 'flares');
    this.smoke = this._puffs(nSm);               // round 4: landing and kerb dust, one draw
    this.sparkState = new Float32Array(nS * 12);  // x y z vx vy vz life maxLife ax ay az len
    this.flareState = new Float32Array(nF * 8);   // x y z vx vy vz life maxLife
    this.smokeState = new Float32Array(nSm * 10); // x y z vx vy vz life maxLife size rot
    this._smokeHead = 0;
    // the exhaust flames: one instanced mesh, four cones per kart (an orange outer flame and a
    // pale yellow core per pipe, coloured per instance), base at the pipe, tip pointing back
    const cone = new THREE.ConeGeometry(0.11, 1, 12, 1, true);
    cone.translate(0, 0.5, 0);
    cone.rotateX(-Math.PI / 2);                     // base at the origin, tip along -Z (backward)
    // round 3: the cones were the "two flat glowing headlight polygons" the blind critic saw on a boosting kart
    // from behind (motion frames 4 and 6). They are now a faint core only; the flame is the sprite stream
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.cones = new THREE.InstancedMesh(cone, coneMat, MAX_KARTS * 4);
    this.cones.frustumCulled = false; this.cones.castShadow = false; this.cones.receiveShadow = false;
    this.cones.name = 'kart_boost_cones';
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const outer = new THREE.Color(FLARE_FRINGE), inner = new THREE.Color(FLARE_CORE);
    for (let i = 0; i < MAX_KARTS * 4; i++) { this.cones.setMatrixAt(i, zero); this.cones.setColorAt(i, (i & 1) ? inner : outer); }
    this.cones.instanceMatrix.needsUpdate = true;
    if (this.cones.instanceColor) this.cones.instanceColor.needsUpdate = true;
    scene.add(this.sparks, this.flares, this.cones, this.smoke);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3();
    this._tmpC = new THREE.Color();
  }
  _texture(soft) {
    const N = 64, cv = document.createElement('canvas'); cv.width = cv.height = N;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    if (soft) { g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
    else { g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.9)'); g.addColorStop(0.8, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  /**
   * Round 4: the spark streaks. An instanced 1 x 1 quad per spark; the vertex shader stretches it in view
   * space along the projected streak axis (iAxis, world metres, the tyre's direction of travel scaled by
   * the streak length) and gives it iWidth metres across, never under 1.6 px. A streak seen end on
   * collapses to a dot the width of the streak. Dead sparks carry alpha 0 and leave the clip volume.
   */
  _streaks(n) {
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    geo.setIndex(base.getIndex());
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('uv', base.getAttribute('uv'));
    geo.instanceCount = n;
    const mk = (size) => new THREE.InstancedBufferAttribute(new Float32Array(n * size), size).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', mk(3)); geo.setAttribute('iAxis', mk(3)); geo.setAttribute('iCol', mk(3)); geo.setAttribute('iAlpha', mk(1)); geo.setAttribute('iWidth', mk(1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uPx: { value: 600 }, uRes: { value: new THREE.Vector2(1280, 720) } },
      // the streak is built in SCREEN space between the projected tail (iPos) and head (iPos + iAxis): a
      // streak along the direction of travel is seen nearly end on from the chase camera, and building it
      // in view space (the first cut) foreshortened every spark to a dot
      vertexShader: `attribute vec3 iPos; attribute vec3 iAxis; attribute vec3 iCol; attribute float iAlpha; attribute float iWidth;
        uniform float uPx; uniform vec2 uRes; varying vec2 vUv; varying vec3 vC; varying float vA;
        void main(){
          vec4 v0 = modelViewMatrix * vec4(iPos, 1.0);
          vec4 v1 = modelViewMatrix * vec4(iPos + iAxis, 1.0);
          vec4 c0 = projectionMatrix * v0, c1 = projectionMatrix * v1;
          bool bad = !(iAlpha == iAlpha) || !(v0.z == v0.z) || !(v1.z == v1.z) || !(iAlpha > 0.0) || c0.w < 0.05 || c1.w < 0.05;
          vec2 hs = uRes * 0.5;
          vec2 p0 = c0.xy / c0.w * hs, p1 = c1.xy / c1.w * hs;
          vec2 d = p1 - p0; float L = length(d);
          vec2 dir = L > 1e-3 ? d / L : vec2(1.0, 0.0);
          float dz = max(0.3, -0.5 * (v0.z + v1.z));
          float wPx = max(iWidth * uPx / dz, 1.6);
          L = max(L, wPx);
          vec2 nrm = vec2(-dir.y, dir.x);
          vec2 p = (p0 + p1) * 0.5 + dir * (position.x * L) + nrm * (position.y * wPx);
          float zn = 0.5 * (c0.z / c0.w + c1.z / c1.w);
          gl_Position = bad ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(p / hs, zn, 1.0);
          vUv = uv; vC = iCol; vA = iAlpha;
        }`,
      fragmentShader: `varying vec2 vUv; varying vec3 vC; varying float vA;
        void main(){
          float x = vUv.x * 2.0 - 1.0, y = vUv.y * 2.0 - 1.0;
          float core = 1.0 - y * y;
          float along = smoothstep(-1.0, 0.15, x) * (1.0 - smoothstep(0.7, 1.0, x));   // tail fades in, hot head, soft tip
          float a = core * core * along * vA;
          if (!(a >= 0.004)) discard;
          gl_FragColor = vec4(vC * a, a);
        }`,
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false; mesh.name = 'kart_sparks'; mesh.renderOrder = 5;
    mesh.castShadow = false; mesh.receiveShadow = false;
    return mesh;
  }
  /** A soft three lobed puff, so a rotated point never reads as a disc. */
  _puffTexture() {
    const N = 64, cv = document.createElement('canvas'); cv.width = cv.height = N;
    const ctx = cv.getContext('2d');
    const lobe = (cx, cy, r, a) => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(0.45, 'rgba(255,255,255,' + (a * 0.55).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
    };
    lobe(N * 0.5, N * 0.5, N * 0.5, 0.9); lobe(N * 0.36, N * 0.42, N * 0.3, 0.7); lobe(N * 0.62, N * 0.38, N * 0.26, 0.6); lobe(N * 0.55, N * 0.66, N * 0.28, 0.6);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  /** Round 4: the smoke puffs (landing, kerb dust). Normal blending, tone mapped like the scene on the direct render path. */
  _puffs(n) {
    const geo = new THREE.BufferGeometry();
    const mk = (size) => new THREE.BufferAttribute(new Float32Array(n * size), size).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', mk(3)); geo.setAttribute('color', mk(3)); geo.setAttribute('size', mk(1)); geo.setAttribute('alpha', mk(1)); geo.setAttribute('rot', mk(1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: this._puffTexture() }, uScale: { value: 400 } },
      vertexShader: `attribute float size; attribute float alpha; attribute float rot;
        varying float vA; varying float vR; varying vec3 vC; uniform float uScale;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        float d = max(0.5, -mv.z);
        gl_PointSize = clamp(size * uScale / d, 0.0, 160.0);
        vA = alpha * clamp(1.0 - d / 120.0, 0.0, 1.0); vR = rot; vC = color;
        if (!(alpha == alpha) || !(size == size) || !(mv.z == mv.z) || !(alpha > 0.0)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; } }`,
      fragmentShader: `uniform sampler2D uMap; varying float vA; varying float vR; varying vec3 vC;
        void main(){ vec2 c = gl_PointCoord - 0.5; float s = sin(vR), k = cos(vR);
        c = vec2(c.x * k - c.y * s, c.x * s + c.y * k) + 0.5;
        float a = texture2D(uMap, c).a * vA; if (!(a >= 0.004)) discard; a = min(a, 1.0);
        gl_FragColor = vec4(vC, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor = vec4(gl_FragColor.rgb * a, a); }`,
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.NormalBlending, premultipliedAlpha: true, vertexColors: true,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false; pts.name = 'kart_smoke'; pts.renderOrder = 4; pts.visible = false;
    pts.castShadow = false; pts.receiveShadow = false;
    return pts;
  }
  _points(n, map, name) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: map }, uScale: { value: 400 } },
      vertexShader: `attribute float size; attribute float alpha; varying float vA; varying vec3 vC; uniform float uScale;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(size * uScale / max(0.5, -mv.z), 0.0, 96.0); vA = alpha; vC = color;
        // a non finite particle (integrator, round 1: one NaN alpha drew an opaque 90 px black square, the
        // 'black card square' class in the round 0 and 1 filmstrips) is thrown out of the clip volume
        if (!(alpha == alpha) || !(size == size) || !(mv.z == mv.z)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; } }`,
      fragmentShader: `uniform sampler2D uMap; varying float vA; varying vec3 vC;
        void main(){ float a = texture2D(uMap, gl_PointCoord).a * vA; if (!(a >= 0.003)) discard; a = min(a, 1.0); gl_FragColor = vec4(vC * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false; pts.name = 'kart_' + name; pts.renderOrder = 5;
    return pts;
  }
  /** The first view to tick in a frame owns the step; every other view just emits. */
  tick(dt, view) {
    if (!this.owner || !this.owner.object.parent) this.owner = view;
    if (this.owner === view) this.update(dt);
  }
  allocate() { if (this.slots >= MAX_KARTS) { console.warn('[kartview] more than ' + MAX_KARTS + ' karts: effects pool full, extra karts get no sparks'); return -1; } return this.slots++; }
  spawn(kind, slot, x, y, z, vx, vy, vz, life, size, hex, hdr = 1, ax = 0, ay = 0, az = 0, len = 0) {
    if (slot < 0) return;
    // never let a non finite value into the pool: a NaN in any attribute renders as an opaque black square
    // (integrator, round 1); warn once with the values so the source can be traced
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) && Number.isFinite(vx) && Number.isFinite(vy) && Number.isFinite(vz) && life > 0 && size > 0 && Number.isFinite(ax) && Number.isFinite(ay) && Number.isFinite(az) && Number.isFinite(len))) {
      if (!this._warnedNaN) { this._warnedNaN = true; console.warn('[kartview] particle spawn failed: non finite', kind, slot, [x, y, z, vx, vy, vz, life, size].map((v) => String(v)).join(' ')); }
      return;
    }
    const spark = kind === 'spark';
    const per = spark ? SPARKS_PER_KART : FLARES_PER_KART;
    const F = spark ? 12 : 8;
    const st = spark ? this.sparkState : this.flareState;
    const base = slot * per;
    // find a dead particle in this kart's range, else the oldest
    let idx = -1, oldest = -1, oldestLife = Infinity;
    for (let i = base; i < base + per; i++) {
      const l = st[i * F + 6];
      if (l <= 0) { idx = i; break; }
      if (l < oldestLife) { oldestLife = l; oldest = i; }
    }
    if (idx < 0) idx = oldest;
    const o = idx * F;
    // pre aged at random: every particle born in one frame would otherwise share one age and fade as a
    // band, and at a low frame rate the trail turns into clumps one frame's travel apart
    const age = spark ? life * (0.45 + 0.55 * Math.random()) : life;
    st[o] = x; st[o + 1] = y; st[o + 2] = z; st[o + 3] = vx; st[o + 4] = vy; st[o + 5] = vz; st[o + 6] = age; st[o + 7] = life;
    const c = this._tmpC.setHex(hex);
    const hb = Number.isFinite(hdr) && hdr > 0 ? hdr : 1;
    if (spark) {
      st[o + 8] = ax; st[o + 9] = ay; st[o + 10] = az; st[o + 11] = len;
      const g = this.sparks.geometry;
      const ca = g.attributes.iCol.array, wa = g.attributes.iWidth.array;
      ca[idx * 3] = c.r * hb; ca[idx * 3 + 1] = c.g * hb; ca[idx * 3 + 2] = c.b * hb;
      wa[idx] = size;
    } else {
      const ca = this.flares.geometry.attributes.color.array, sa = this.flares.geometry.attributes.size.array;
      ca[idx * 3] = c.r * hb; ca[idx * 3 + 1] = c.g * hb; ca[idx * 3 + 2] = c.b * hb;
      sa[idx] = size;
    }
  }
  /** Round 4: one smoke puff into the shared ring (no per kart range: bursts are short and rare). */
  spawnSmoke(x, y, z, vx, vy, vz, life, size, hex) {
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) && Number.isFinite(vx) && Number.isFinite(vy) && Number.isFinite(vz) && life > 0 && size > 0)) return;
    const n = this.smokeState.length / 10;
    const i = this._smokeHead; this._smokeHead = (this._smokeHead + 1) % n;
    const st = this.smokeState, o = i * 10;
    st[o] = x; st[o + 1] = y; st[o + 2] = z; st[o + 3] = vx; st[o + 4] = vy; st[o + 5] = vz;
    st[o + 6] = life; st[o + 7] = life; st[o + 8] = size; st[o + 9] = Math.random() * Math.PI * 2;
    const c = this._tmpC.setHex(hex);
    const ca = this.smoke.geometry.attributes.color.array;
    ca[i * 3] = c.r; ca[i * 3 + 1] = c.g; ca[i * 3 + 2] = c.b;
  }
  setCone(slot, which, worldMatrix, len, rad) {
    if (slot < 0) return;
    const i = (slot * 2 + which) * 2;
    if (len <= 0) { this._m.makeScale(0, 0, 0); this.cones.setMatrixAt(i, this._m); this.cones.setMatrixAt(i + 1, this._m); return; }
    this._m.copy(worldMatrix);
    this._m.decompose(this._p, this._q, this._s);
    this._s.set(rad, rad, len);
    this._m.compose(this._p, this._q, this._s);
    this.cones.setMatrixAt(i, this._m);                 // outer orange flame
    this._s.set(rad * 0.55, rad * 0.55, len * 0.62);
    this._m.compose(this._p, this._q, this._s);
    this.cones.setMatrixAt(i + 1, this._m);             // pale core
  }
  update(dt) {
    const dpr = Math.min(1.5, (globalThis.devicePixelRatio || 1));
    const h = globalThis.innerHeight || 720;
    const uScale = h * 0.6 * dpr;
    this.flares.material.uniforms.uScale.value = uScale;
    // pixels per metre at 1 m for the streak width floor and the puff size (the chase camera's fov when it is live)
    const fov = CHASE.camera && CHASE.camera.fov ? CHASE.camera.fov : 58;
    const px = h / (2 * Math.tan(fov * Math.PI / 360));
    this.sparks.material.uniforms.uPx.value = px;
    this.sparks.material.uniforms.uRes.value.set(globalThis.innerWidth || 1280, h);
    this.smoke.material.uniforms.uScale.value = px;
    this._stepSparks(dt);
    this._step(this.flares, this.flareState, dt, -2.5, 0.90);
    this._stepSmoke(dt);
    this.cones.instanceMatrix.needsUpdate = true;
    if (this.cones.instanceColor) this.cones.instanceColor.needsUpdate = true;
  }
  _stepSparks(dt) {
    const g = this.sparks.geometry, st = this.sparkState;
    const pa = g.attributes.iPos.array, xa = g.attributes.iAxis.array, aa = g.attributes.iAlpha.array;
    const n = st.length / 12;
    const gravity = 9, damp = 0.97;
    for (let i = 0; i < n; i++) {
      const o = i * 12;
      let life = st[o + 6];
      if (life <= 0) { aa[i] = 0; continue; }
      life -= dt; st[o + 6] = life;
      if (!(life > 0)) { st[o + 6] = 0; aa[i] = 0; continue; }
      st[o + 4] -= gravity * dt;
      st[o + 3] *= damp; st[o + 5] *= damp;
      st[o] += st[o + 3] * dt; st[o + 1] += st[o + 4] * dt; st[o + 2] += st[o + 5] * dt;
      pa[i * 3] = st[o]; pa[i * 3 + 1] = st[o + 1]; pa[i * 3 + 2] = st[o + 2];
      const k = life / st[o + 7];
      const len = st[o + 11] * (0.6 + 0.4 * k);   // the streak shortens a little as the spark cools
      xa[i * 3] = st[o + 8] * len; xa[i * 3 + 1] = st[o + 9] * len; xa[i * 3 + 2] = st[o + 10] * len;
      aa[i] = k < 0.7 ? k / 0.7 : 1;
    }
    g.attributes.iPos.needsUpdate = true; g.attributes.iAxis.needsUpdate = true; g.attributes.iAlpha.needsUpdate = true;
    g.attributes.iCol.needsUpdate = true; g.attributes.iWidth.needsUpdate = true;
  }
  _stepSmoke(dt) {
    const g = this.smoke.geometry, st = this.smokeState;
    const pa = g.attributes.position.array, sa = g.attributes.size.array, aa = g.attributes.alpha.array, ra = g.attributes.rot.array;
    const n = st.length / 10;
    const drag = Math.pow(0.55, dt);
    let alive = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 10;
      let life = st[o + 6];
      if (life <= 0) { aa[i] = 0; sa[i] = 0; continue; }
      life -= dt; st[o + 6] = life;
      if (!(life > 0)) { st[o + 6] = 0; aa[i] = 0; sa[i] = 0; continue; }
      st[o + 3] *= drag; st[o + 5] *= drag; st[o + 4] = st[o + 4] * drag + 0.25 * dt;
      st[o] += st[o + 3] * dt; st[o + 1] += st[o + 4] * dt; st[o + 2] += st[o + 5] * dt;
      pa[i * 3] = st[o]; pa[i * 3 + 1] = st[o + 1]; pa[i * 3 + 2] = st[o + 2];
      const k = 1 - life / st[o + 7];   // 0 fresh .. 1 gone
      sa[i] = st[o + 8] * (1 + 2.4 * k);
      const a = k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9;
      aa[i] = 0.72 * a;   // a one shot burst has no stream behind it to stack up, so each puff carries more than a drift puff
      ra[i] = st[o + 9] + k * 0.9;
      alive++;
    }
    this.smoke.visible = alive > 0;
    if (alive > 0 || this._smokeWasAlive) {
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.size.needsUpdate = true; g.attributes.alpha.needsUpdate = true; g.attributes.rot.needsUpdate = true;
    }
    this._smokeWasAlive = alive > 0;
  }
  _step(pts, st, dt, gravity, damp) {
    const pa = pts.geometry.attributes.position.array, aa = pts.geometry.attributes.alpha.array;
    const n = st.length / 8;
    for (let i = 0; i < n; i++) {
      const o = i * 8;
      let life = st[o + 6];
      if (life <= 0) { aa[i] = 0; continue; }
      life -= dt; st[o + 6] = life;
      if (!(life > 0)) { st[o + 6] = 0; aa[i] = 0; continue; }   // also kills a NaN life (NaN <= 0 is false)
      st[o + 4] -= gravity * dt;
      st[o + 3] *= damp; st[o + 5] *= damp;
      st[o] += st[o + 3] * dt; st[o + 1] += st[o + 4] * dt; st[o + 2] += st[o + 5] * dt;
      pa[i * 3] = st[o]; pa[i * 3 + 1] = st[o + 1]; pa[i * 3 + 2] = st[o + 2];
      const k = life / st[o + 7];
      aa[i] = (k < 0.7 ? k / 0.7 : 1) * (gravity < 0 ? 0.55 : 1);   // flares (negative gravity) softer than sparks
    }
    pts.geometry.attributes.position.needsUpdate = true;
    pts.geometry.attributes.alpha.needsUpdate = true;
    pts.geometry.attributes.color.needsUpdate = true;
    pts.geometry.attributes.size.needsUpdate = true;
  }
}

const _pools = new WeakMap();   // scene -> EffectsPool
function poolFor(scene) {
  let p = _pools.get(scene);
  if (!p) { p = new EffectsPool(scene); _pools.set(scene, p); }
  return p;
}

const DEFAULT_SOCKETS = {
  wheelFL: new THREE.Vector3(0.55, 0.22, 0.55), wheelFR: new THREE.Vector3(-0.55, 0.22, 0.55),
  wheelRL: new THREE.Vector3(0.55, 0.22, -0.55), wheelRR: new THREE.Vector3(-0.55, 0.22, -0.55),
  seat: new THREE.Vector3(0, 0.18, -0.15), exhaustL: new THREE.Vector3(0.14, 0.55, -0.82), exhaustR: new THREE.Vector3(-0.14, 0.55, -0.82),
  itemHold: new THREE.Vector3(0, 1.35, -0.4),
};

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m4 = new THREE.Matrix4();
const _up = new THREE.Vector3(), _fw = new THREE.Vector3(), _rt = new THREE.Vector3();
const _box = new THREE.Box3();
const _corner = new THREE.Vector3();
const _zAxis = new THREE.Vector3(0, 0, 1), _xAxis = new THREE.Vector3(1, 0, 0), _yAxis = new THREE.Vector3(0, 1, 0);
const _lx = new THREE.Vector3();
const _euler = new THREE.Euler();

export class KartView {
  constructor({ scene, livery = {}, id = 0, assetBase = './assets/', hero = true, paint = true, numeral = null } = {}) {
    this.scene = scene;
    this.id = id;
    this.hero = !!hero;                          // false: the steering wheel bakes into the chassis (two draws fewer per AI kart)
    this.paint = paint == null ? true : !!paint; // the clearcoat buckets (body, caps, stripes, chrome, visor): on for every kart unless the integrator says otherwise
    this.numeral = numeral == null ? ((id % 8) + 8) % 8 + 1 : numeral;   // the race number on the rear plate, 1 to 8
    this.livery = {
      body: livery.body == null ? 0xed5851 : livery.body,
      suit: livery.suit == null ? 0xf1e6d2 : livery.suit,
      helmet: livery.helmet == null ? (livery.body == null ? 0xed5851 : livery.body) : livery.helmet,
      stripe: livery.stripe == null ? null : livery.stripe,
    };
    if (this.livery.stripe == null) this.livery.stripe = this.livery.helmet;
    this.assetBase = assetBase;
    this.object = new THREE.Group();
    this.object.name = 'kart_' + id;
    this.bodyGroup = new THREE.Group();        // chassis, driver, held item: squashes on a hop
    this.bodyGroup.name = 'kart_body';
    this.object.add(this.bodyGroup);
    this.chassis = null; this.driver = null; this.wheels = []; this.steerJoint = null;
    this.sockets = {};                           // name -> Vector3 in kart space
    this.joints = {};                            // driver joints: name -> { node, baseQ }
    this.loaded = false;
    this.missing = [];
    this.itemHolder = new THREE.Group(); this.itemHolder.name = 'kart_itemHold'; this.bodyGroup.add(this.itemHolder);
    this.shieldHolder = new THREE.Group(); this.shieldHolder.name = 'kart_shield'; this.object.add(this.shieldHolder);
    this.heldKey = null; this.heldObject = null; this.shieldObject = null; this.shieldOn = false;
    this._itemCache = new Map();
    this.pool = scene ? poolFor(scene) : null;
    this.slot = this.pool ? this.pool.allocate() : -1;
    this.squash = 0; this.squashV = 0;
    this._wasGrounded = true; this._prevVy = 0;
    this._smoothUp = new THREE.Vector3(0, 1, 0);
    this._sparkAcc = 0; this._flareAcc = 0;
    this._boostVis = 0;
    this._t = Math.random() * 10;
    this._exhaustM = [new THREE.Matrix4().makeRotationX(0.35).setPosition(DEFAULT_SOCKETS.exhaustL), new THREE.Matrix4().makeRotationX(0.35).setPosition(DEFAULT_SOCKETS.exhaustR)];
    this.wheelR = KART.wheelRadius;
    // round 4
    this.fade = 1;                 // 0..1 near camera opacity (AI karts)
    this.fadeMats = null;          // the per kart material clones the fade drives (AI karts only)
    this._kerbHits = 0;
    if (scene) scene.add(this.object);
  }

  /**
   * Round 4: clone every material under this kart once so its opacity can be driven per kart (the render
   * module shares materials across instances; the paint is one PaintMaterial for the field). Clones are
   * fresh objects, so the lighting rig's refresh patches them like any new material; the paint clones
   * are registered so adoptEnvironment gives them the PMREM too.
   */
  _prepareFade() {
    const map = new Map();
    const out = [];
    const cloneOf = (m) => {
      if (!m) return m;
      let c = map.get(m);
      if (!c) {
        c = m.clone();
        c.name = m.name;
        if (m.isMeshPhysicalMaterial && m.name === 'kart_paint') { c.envMap = m.envMap; c.envMapIntensity = m.envMapIntensity; FADE_PAINTS.add(c); }
        c.userData = Object.assign({}, m.userData || {});
        // permanently transparent (opacity 1 draws exactly as before): three 0.169 keys the program on
        // material.transparent (the OPAQUE define), so toggling it at fade time would compile mid race
        c.userData.__baseOpacity = c.opacity; c.userData.__baseTransparent = c.transparent;
        c.transparent = true;
        map.set(m, c); out.push(c);
      }
      return c;
    };
    this.object.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      o.material = Array.isArray(o.material) ? o.material.map(cloneOf) : cloneOf(o.material);
    });
    this.fadeMats = out;
    this._fadeApplied = 1;
  }
  _applyFade(f) {
    if (!this.fadeMats || f === this._fadeApplied) return;
    this._fadeApplied = f;
    for (const m of this.fadeMats) {
      const base = m.userData && typeof m.userData.__baseOpacity === 'number' ? m.userData.__baseOpacity : 1;
      m.opacity = base * f;
    }
  }

  url(name) { return this.assetBase + name + '.js' + stamp(); }

  async load() {
    const applyMaterials = await loadApplyMaterials();
    const apply = (obj, asset) => { if (applyMaterials) { try { applyMaterials(obj, { local: true, asset }); } catch (e) { console.warn('[kartview] applyMaterials failed on ' + asset + ': ' + (e && e.message)); } } };

    // --- chassis
    const chassis = await ASSET(this.url('kart_chassis'), { keepHierarchy: true });
    let chassisLift = 0.12;
    if (!countMeshes(chassis)) {
      console.warn('[kartview] asset missing: kart_chassis (kart ' + this.id + ' builds without a chassis)');
      this.missing.push('kart_chassis');
      for (const k of Object.keys(DEFAULT_SOCKETS)) this.sockets[k] = DEFAULT_SOCKETS[k].clone();
    } else {
      // livery before the material pass bakes colour into the vertices: the flag, then the
      // asset's 'recipe:hex' declarations (body, its light edge tint, its dark base band)
      const cud = chassis.userData || {};
      const cBody = parseRef(cud.livery), cLight = parseRef(cud.liveryLight), cDark = parseRef(cud.liveryDark);
      const body = this.livery.body, bodyL = tintHex(body, 0.11, 0.95), bodyD = tintHex(body, -0.18, 0.92);
      const P = this.paint ? paint : (hex) => hex;
      let n = applyLivery(chassis, (m) => {
        if (m.userData && m.userData.livery === true) return P(body);
        if (matchesRef(m, cBody)) return P(body);
        if (matchesRef(m, cLight)) return P(bodyL);
        if (matchesRef(m, cDark)) return P(bodyD);
        return this.paint ? finishOf(m) : null;
      });
      if (!n) {
        n = applyLivery(chassis, (m) => (m.name === 'metal' && saturationOf(m) > 0.3 ? P(body) : null));
        console.warn('[kartview] kart_chassis declares no livery (material.userData.livery or userData.livery \'metal:hex\'); recoloured ' + n + ' saturated metal parts instead');
      }
      // the rear plate's race number: keep this racer's numeral holder, drop the other seven before the bake
      {
        const holders = [];
        chassis.traverse((o) => { if (o.userData && typeof o.userData.numeral === 'number') holders.push(o); });
        let kept = 0;
        for (const h of holders) { if (h.userData.numeral === this.numeral) { h.visible = true; kept++; } else h.removeFromParent(); }
        if (holders.length && !kept) console.warn('[kartview] kart_chassis has no numeral_' + this.numeral + ' holder; the plate stays blank');
      }
      apply(chassis, 'kart_chassis');
      swapPaint(chassis);
      chassis.updateMatrixWorld(true);
      const sock = chassis.userData.sockets || {};
      const missingSockets = [];
      for (const k of Object.keys(DEFAULT_SOCKETS)) {
        const node = sock[k];
        if (node && node.isObject3D) { this.sockets[k] = new THREE.Vector3().setFromMatrixPosition(node.matrixWorld); }
        else { this.sockets[k] = DEFAULT_SOCKETS[k].clone(); missingSockets.push(k); }
      }
      if (missingSockets.length) console.warn('[kartview] kart_chassis sockets missing, TSV defaults used: ' + missingSockets.join(', '));
      // steer joint: kept out of the bake so it can turn
      const steer = chassis.userData.joints && chassis.userData.joints.steer;
      const joints = steer && steer.isObject3D && this.hero ? [steer] : [];
      if (!(steer && steer.isObject3D)) console.warn('[kartview] kart_chassis has no joints.steer; the steering wheel stays fixed');
      // exhaust flare frames: position from the socket, pointing back and 20 degrees up (the
      // socket node's own axes are the author's and cannot be trusted to point along the pipe)
      // round 3: the pipes exit outward (userData.exhaustDir), so the flame yaws 20 degrees to its side as well
      const outward = chassis.userData.exhaustDir === 'outward' ? 0.35 : 0;
      for (const [i, k] of ['exhaustL', 'exhaustR'].entries()) {
        const s = this.sockets[k];
        _euler.set(0.35, -Math.sign(s.x || (i === 0 ? 1 : -1)) * outward, 0, 'YXZ');   // the cone tip is -Z; a negative yaw swings it toward +X (the kart's left)
        this._exhaustM[i].makeRotationFromEuler(_euler).setPosition(s.x, s.y, s.z);
      }
      bakeArticulated(chassis, joints);
      // the chassis silhouette is its metal and paint buckets; the small ones (bumper rubber trims, exhaust
      // glow, number disc) add a shadow draw each for nothing anyone can see (integrator, round 1)
      chassis.traverse((o) => { if (o.isMesh && o.geometry) { const g = o.geometry; const t = (g.index ? g.index.count : g.attributes.position.count) / 3; if (t < 300) o.castShadow = false; } });
      if (joints.length) { this.steerJoint = { node: steer, baseQ: steer.quaternion.clone() }; }
      // wheel centres sit at the sockets; lift the chassis so the wheels touch the ground
      const ys = ['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR'].map((k) => this.sockets[k].y);
      const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
      chassisLift = Math.max(0, Math.min(0.25, this.wheelR - avgY));
      chassis.position.y = chassisLift;
      chassis.name = 'kart_chassis';
      this.bodyGroup.add(chassis);
      this.chassis = chassis;
    }
    for (const k of ['seat', 'exhaustL', 'exhaustR', 'itemHold']) this.sockets[k].y += chassisLift;
    this._exhaustM.forEach((m) => { m.elements[13] += chassisLift; });
    this.itemHolder.position.copy(this.sockets.itemHold);

    // --- wheels: four instances. The front pair each get their own pivot (they steer about it);
    // the rear pair share ONE spin group on the rear axle line (same spin, no steer) and bake into
    // one set of meshes, which takes a wheel's worth of draws off every kart.
    const wheelNames = ['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR'];
    const wheelObjs = [];
    for (let i = 0; i < 4; i++) {
      const w = await ASSET(this.url('kart_wheel'), { keepHierarchy: true });
      if (!countMeshes(w)) {
        if (i === 0) { console.warn('[kartview] asset missing: kart_wheel (kart ' + this.id + ' rolls on nothing)'); this.missing.push('kart_wheel'); }
        wheelObjs.push(null);
        continue;
      }
      const wRef = parseRef((w.userData || {}).livery);
      let n = applyLivery(w, (m) => ((m.userData && m.userData.livery === true) || matchesRef(m, wRef) ? (this.paint ? paint(this.livery.body) : this.livery.body) : (this.paint ? finishOf(m) : null)));   // round 3: the cap and the chrome hub share the clearcoat bucket on every kart (one draw a wheel group)
      if (!n && i === 0) console.warn('[kartview] kart_wheel declares no livery cap (material.userData.livery or userData.livery \'metal:hex\')');
      apply(w, 'kart_wheel');
      swapPaint(w);
      const native = w.userData.nativeSize;
      const r = native && native.y > 0.1 ? native.y / 2 : this.wheelR;
      if (i === 0) this.wheelR = r;
      wheelObjs.push(w);
    }
    const wheelX = (s) => (this.chassis && Math.abs(s.x) < 0.75 ? s.x + Math.sign(s.x || 1) * 0.12 : s.x);   // an axle end socket: the wheel sits outboard of it
    // front: own pivot and spin per wheel
    for (let i = 0; i < 2; i++) {
      const s = this.sockets[wheelNames[i]];
      const pivot = new THREE.Group(); pivot.name = 'kart_' + wheelNames[i];
      pivot.position.set(wheelX(s), this.wheelR, s.z);
      const spin = new THREE.Group(); spin.name = 'spin'; pivot.add(spin);
      const w = wheelObjs[i];
      if (w) {
        bakeArticulated(w, []);
        w.position.y = -this.wheelR;              // the asset stands on y = 0; the pivot is the axle
        if (s.x < 0) w.rotation.y = Math.PI;      // right side wheels face outward
        spin.add(w);
      }
      this.wheels.push({ pivot, spin, front: true, at: pivot.position.clone() });
      this.object.add(pivot);
    }
    // rear: one pivot on the axle centre, one spin group, both wheels baked together
    {
      const sL = this.sockets.wheelRL, sR = this.sockets.wheelRR;
      const zRear = (sL.z + sR.z) / 2;
      const pivot = new THREE.Group(); pivot.name = 'kart_wheelRear';
      pivot.position.set(0, this.wheelR, zRear);
      const spin = new THREE.Group(); spin.name = 'spin'; pivot.add(spin);
      for (const [i, s] of [[2, sL], [3, sR]]) {
        const w = wheelObjs[i];
        const at = new THREE.Vector3(wheelX(s), this.wheelR, s.z);
        if (w) {
          w.position.set(at.x, -this.wheelR, s.z - zRear);
          if (s.x < 0) w.rotation.y = Math.PI;
          spin.add(w);
        }
        this.wheels.push({ pivot, spin, front: false, at });
      }
      if (wheelObjs[2] || wheelObjs[3]) bakeArticulated(spin, []);
      this.object.add(pivot);
    }

    // --- driver
    const driver = await ASSET(this.url('driver_racer'), { keepHierarchy: true });
    if (!countMeshes(driver)) {
      console.warn('[kartview] asset missing: driver_racer (kart ' + this.id + ' has an empty seat)');
      this.missing.push('driver_racer');
    } else {
      const L = this.livery;
      const dud = driver.userData || {};
      const dSuit = parseRef(dud.livery), dAccent = parseRef(dud.suitAccent), dHelmet = parseRef(dud.helmet);
      const suitD = tintHex(L.suit, -0.13, 0.95);
      const P = this.paint ? paint : (hex) => hex;
      let n = applyLivery(driver, (m) => {
        const l = m.userData && m.userData.livery;
        if (l === 'suit') return L.suit;
        if (l === 'helmet') return P(L.helmet);
        if (l === 'stripe') return P(L.stripe);
        if (matchesRef(m, dSuit)) return L.suit;
        if (matchesRef(m, dAccent)) return L.helmet;                 // the second suit tone is the racer's colour
        if (matchesRef(m, dHelmet)) return P(L.helmet);
        if (dSuit && m.name === dSuit.name && isDarkerToneOf(m, dSuit.hex)) return suitD;   // the suit's shade tone
        if (dHelmet && m.name === dHelmet.name && !matchesRef(m, dHelmet) && lumOf(m) > 0.45) return P(L.stripe);   // the helmet stripe: the light metal that is not the helmet
        return this.paint ? finishOf(m) : null;                      // the visor mirror and the chrome visor pivots
      });
      if (!n) console.warn('[kartview] driver_racer declares no livery (material.userData.livery or userData.livery/suitAccent/helmet \'recipe:hex\'); driver keeps its own colours');
      apply(driver, 'driver_racer');
      swapPaint(driver);
      const J = driver.userData.joints || {};
      // an AI kart keeps the head and the torso lean as joints and bakes the arms into the torso (4 draws
      // fewer per kart; the hands on the wheel are not readable past the chase distance)
      const names = this.hero ? ['head', 'torso', 'upperArmL', 'upperArmR', 'forearmL', 'forearmR'] : ['head', 'torso'];
      const nodes = [];
      const missing = [];
      for (const k of names) {
        const node = J[k];
        if (node && node.isObject3D) { this.joints[k] = { node, baseQ: node.quaternion.clone() }; nodes.push(node); }
        else missing.push(k);
      }
      if (missing.length) console.warn('[kartview] driver_racer joints missing: ' + missing.join(', ') + ' (that part of the pose is skipped)');
      bakeArticulated(driver, nodes);
      driver.position.copy(this.sockets.seat);
      driver.name = 'driver_racer';
      this.bodyGroup.add(driver);
      this.driver = driver;
    }
    this._measure();
    if (!this.hero) this._prepareFade();
    this.loaded = true;
    return this;
  }

  /** The kart's real bounds in kart space (chassis, wheels, driver), for an honest screen box. */
  _measure() {
    const o = this.object;
    const savedP = o.position.clone(), savedQ = o.quaternion.clone(), savedS = o.scale.clone();
    o.position.set(0, 0, 0); o.quaternion.identity(); o.scale.set(1, 1, 1);
    o.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const gb = new THREE.Box3();
    o.traverse((m) => {
      if (!m.isMesh || !m.geometry || m === this.pool?.cones) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      gb.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
      box.union(gb);
    });
    o.position.copy(savedP); o.quaternion.copy(savedQ); o.scale.copy(savedS);
    o.updateMatrixWorld(true);
    if (Number.isFinite(box.min.x) && Number.isFinite(box.max.y)) this.localBox = box;
    else this.localBox = new THREE.Box3(new THREE.Vector3(-0.9, -0.05, -1.0), new THREE.Vector3(0.9, 1.75, 1.0));
  }

  /** Meshes under this kart, a proxy for its draw calls. */
  drawEstimate() { return countMeshes(this.object) + (this.slot === 0 ? 4 : 0); }

  update(dt, body) {
    if (!body) return;
    this._t += dt;
    const o = this.object;
    o.position.copy(body.pos);

    // orientation: up from the ground normal (smoothed), forward from the heading, spin about up
    const n = body.groundNormal || _yAxis;
    this._smoothUp.lerp(body.grounded ? n : _yAxis, Math.min(1, dt * 10)).normalize();
    _up.copy(this._smoothUp);
    _fw.set(Math.sin(body.heading), 0, Math.cos(body.heading));
    _fw.addScaledVector(_up, -_fw.dot(_up)).normalize();
    _rt.crossVectors(_fw, _up).normalize();       // right of travel
    _lx.copy(_rt).negate();
    _m4.makeBasis(_lx, _up, _fw);                 // three's basis: x = -right (the kart's +X is its left side), y = up, z = forward
    o.quaternion.setFromRotationMatrix(_m4);
    // drift lean into the corner and the spin out
    let lean = 0;
    if (body.drift && body.drift.active) lean = body.drift.dir * (0.05 + 0.02 * body.drift.tier);
    const spin = body.spinAngle || 0;
    if (spin) { _q.setFromAxisAngle(_yAxis, spin); o.quaternion.multiply(_q); }
    if (lean) { _q.setFromAxisAngle(_zAxis, -lean); o.quaternion.multiply(_q); }
    if (body.state === 'fall') { _q.setFromAxisAngle(_xAxis, Math.min(0.9, body.respawnT * 1.5)); o.quaternion.multiply(_q); }
    let visible = !(body.state === 'respawn' && body.fadeAlpha >= 1 && body.respawnPhase === 'fade');
    // near camera FADE (round 4; round 3 was a hard hide): a kart sitting on the chase camera (an AI right
    // behind the player) would push its helmet through the bottom of the frame; the followed kart is never
    // faded. Opacity ramps from 1 at NEAR_FADE_IN to 0 at NEAR_FADE_OUT, and to 0 while the kart's screen
    // box covers more than NEAR_AREA of the frame (critic round 3: nothing but the player over a fifth).
    let fadeTarget = 1;
    if (CHASE.active && CHASE.bodyId !== body.id && CHASE.bodyId !== this.id) {
      const dx = o.position.x - CHASE.position.x, dz = o.position.z - CHASE.position.z;
      const d = Math.hypot(dx, dz);
      fadeTarget = Math.max(0, Math.min(1, (d - NEAR_FADE_OUT) / (NEAR_FADE_IN - NEAR_FADE_OUT)));
      if (d < 9 && CHASE.camera) {
        const sb = this.screenBox(CHASE.camera);
        const area = sb ? sb.nw * sb.nh : 0;
        if (area > NEAR_AREA) this._areaCulled = true;
        else if (area < NEAR_AREA_SHOW) this._areaCulled = false;
      } else this._areaCulled = false;
      if (this._areaCulled) fadeTarget = 0;
      if (d > FAR_CULL) visible = false;   // round 2 (integrator): a kart 220 m off is 4 px wide and cost 7k triangles (all 7 at the grid seen from the hairpin exit)
    } else { this._areaCulled = false; }
    this.fade += (fadeTarget - this.fade) * Math.min(1, dt / 0.08);
    if (Math.abs(this.fade - fadeTarget) < 0.01) this.fade = fadeTarget;
    if (this.fadeMats) { if (this.fade < 0.02) visible = false; else this._applyFade(Math.min(1, this.fade)); }
    else if (this.fade < 0.5) visible = false;   // no clones (the hero when it is not the followed kart): the round 3 hide
    o.visible = visible;
    adoptEnvironment(this.scene);

    // hop squash: stretch on take off, squash on landing, spring back
    const vy = body.vy || 0;
    if (this._wasGrounded && !body.grounded && vy > 1) this.squashV = 1.6;        // take off stretch
    const landedNow = !this._wasGrounded && body.grounded && this._prevVy < -1.5;
    const landVy = this._prevVy;
    if (landedNow) this.squashV = -2.4;  // landing squash
    this._wasGrounded = body.grounded; this._prevVy = vy;
    // round 4: a kerb hit compresses the suspension a little and lifts the body by physics' kerbHop spring
    const kerbHits = body.kerbHits || 0;
    let newKerb = false;
    if (kerbHits > this._kerbHits) { newKerb = true; this.squashV -= 0.9; }
    this._kerbHits = kerbHits;
    this.squashV += -this.squash * 180 * dt - this.squashV * 14 * dt;
    this.squash += this.squashV * dt;
    const sy = 1 + Math.max(-0.22, Math.min(0.14, this.squash));
    this.bodyGroup.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
    const kerbHop = Number.isFinite(body.kerbHop) ? Math.max(-0.01, Math.min(0.05, body.kerbHop)) : 0;
    this.bodyGroup.position.y = kerbHop;
    const kerbT = body.kerbT > 0 ? body.kerbT / 0.25 : 0;
    this.bodyGroup.rotation.z = (body.kerbSide || 0) * 0.03 * kerbT * kerbT;   // 1.7 degrees toward the hit side, easing out
    // landing smoke and kerb dust (round 4): pooled puffs from the rear tyres
    const landed = landedNow;
    if (this.pool && this.slot >= 0 && (landed || newKerb) && Math.abs(body.speed) > 3 && o.visible) {
      const P = this.pool;
      const hex = SMOKE_COLOURS[body.surface] || SMOKE_COLOURS.asphalt;
      const hx = Math.sin(body.heading), hz = Math.cos(body.heading), rx = -hz, rz = hx;
      const impact = landed ? Math.min(1, -landVy / 6) : 0.35;
      const wheels = landed ? [this.wheels[2], this.wheels[3]] : [this.wheels[body.kerbSide > 0 ? 3 : 2]];
      // the puffs leave WITH the kart and shed speed under the pool's drag, so the burst stays a ring round the rear
      // tyres for its short life: a burst left on the road (first cut, a quarter of the kart's speed) was 4 m behind
      // the kart, at the chase camera, inside 0.4 s (hop probe), and a long lived one flies into the lens
      const follow = landed ? 1.0 : 0.9;
      for (const w of wheels) {
        if (!w) continue;
        const side = w.at.x > 0 ? -1 : 1;   // the kart's +X is its left, so +X wheels puff outward to the left (-right)
        const count = landed ? 7 + Math.round(7 * impact) : 4;
        for (let i = 0; i < count; i++) {
          _v.copy(w.at); _v.y = 0.05; o.localToWorld(_v);
          const out = (0.6 + Math.random() * 1.2) * (0.6 + impact), back = -(0.3 + Math.random() * 0.6);
          P.spawnSmoke(_v.x + (Math.random() - 0.5) * 0.15, _v.y + Math.random() * 0.06, _v.z + (Math.random() - 0.5) * 0.15,
            body.vel.x * follow + rx * side * out + hx * back + (Math.random() - 0.5) * 0.4, 0.4 + Math.random() * 0.7 * (0.5 + impact), body.vel.z * follow + rz * side * out + hz * back + (Math.random() - 0.5) * 0.4,
            landed ? 0.5 + Math.random() * 0.3 : 0.35 + Math.random() * 0.15, landed ? (0.2 + Math.random() * 0.12) * (0.8 + 0.5 * impact) : 0.14 + Math.random() * 0.08, hex);
        }
      }
    }

    // wheels: all four roll, the front pair steers
    const spinA = body.wheelSpin || 0;
    for (const w of this.wheels) {
      w.spin.rotation.x = spinA;
      w.pivot.rotation.y = w.front ? -(body.steerAngle || 0) : 0;   // steer right = turn toward -X = negative yaw
    }
    // steering wheel: about the joint's local Z
    if (this.steerJoint) {
      const s = (body.steerAngle || 0) / KART.steerLock;
      _q.setFromAxisAngle(_zAxis, -s * 1.3);
      this.steerJoint.node.quaternion.copy(this.steerJoint.baseQ).multiply(_q);
    }

    // driver pose
    this._poseDriver(dt, body);

    // held item bob and shield spin
    if (this.heldObject) { this.heldObject.rotation.y += dt * 1.6; this.heldObject.position.y = 0.08 * Math.sin(this._t * 3); }
    if (this.shieldObject && this.shieldOn) { this.shieldObject.rotation.y += dt * 0.6; this.shieldObject.rotation.z = 0.08 * Math.sin(this._t * 1.7); }

    // effects
    this._effects(dt, body);
  }

  _poseDriver(dt, body) {
    const J = this.joints;
    if (!this.driver) return;
    const s = (body.steerAngle || 0) / KART.steerLock;             // -1..1, positive right
    const drifting = body.drift && body.drift.active;
    const leanTarget = drifting ? body.drift.dir * 0.32 : s * 0.16;
    this._lean = (this._lean == null ? 0 : this._lean) + (leanTarget - (this._lean || 0)) * Math.min(1, dt * 8);
    const lean = this._lean;
    const spinning = body.state === 'spin';
    const boost = body.boost > 0 ? 1 : 0;
    const set = (name, ex, ey, ez) => {
      const j = J[name]; if (!j) return;
      _q.setFromEuler(_euler.set(ex, ey, ez));
      j.node.quaternion.copy(j.baseQ).multiply(_q);
    };
    // torso leans into the corner (positive z lean = to the driver's right, which is -X)
    set('torso', spinning ? -0.15 : -0.05 * boost, 0, lean * 0.6);
    // head leans further and looks into the corner; up on boost, shakes in a spin
    set('head', spinning ? 0.2 * Math.sin(this._t * 20) : -0.12 * boost, spinning ? 0.4 * Math.sin(this._t * 9) : -s * 0.35 - (drifting ? body.drift.dir * 0.25 : 0), lean * 0.7);
    // arms follow the wheel: a right turn lifts the left hand and drops the right
    const armUp = spinning ? -0.7 : 0;
    set('upperArmL', armUp - s * 0.32, 0, s * 0.1);
    set('upperArmR', armUp + s * 0.32, 0, s * 0.1);
    set('forearmL', s * 0.16, 0, 0);
    set('forearmR', -s * 0.16, 0, 0);
  }

  _effects(dt, body) {
    const P = this.pool;
    if (!P || this.slot < 0) return;
    P.tick(dt, this);
    const o = this.object;
    o.updateMatrixWorld(true);
    // drift sparks from the rear wheels' contact points. Round 4: STREAKS aligned to the tyre's direction of
    // travel, length by speed (SPARK_LEN), thrown backward and a little outward, barely off the ground,
    // left behind on the road (a spark's own world velocity is small; the kart's motion draws the trail)
    const tier = body.drift && body.drift.active ? body.drift.tier : 0;
    if (tier > 0 && body.grounded) {
      this._sparkAcc += dt * (300 + 90 * tier);
      const colour = SPARK_COLOURS[tier];
      const sp = Math.hypot(body.vel.x, body.vel.z);
      const speedK = Math.min(1, sp / KART.vmax);
      const lenBase = SPARK_LEN.min + (SPARK_LEN.max - SPARK_LEN.min) * speedK;
      // the tyre's velocity direction (the slide), the streak axis for every spark this frame
      const tx = sp > 0.5 ? body.vel.x / sp : Math.sin(body.heading), tz = sp > 0.5 ? body.vel.z / sp : Math.cos(body.heading);
      let k = 0;
      while (this._sparkAcc >= 1) {
        this._sparkAcc -= 1;
        const w = this.wheels[2 + ((k++) & 1)];
        if (!w) break;
        _v.copy(w.at); _v.y = 0.03; o.localToWorld(_v);
        _v2.set(Math.sin(body.heading), 0, Math.cos(body.heading));
        const back = -(2.0 + Math.random() * 3.0), side = (Math.random() - 0.5) * 1.4 - body.drift.dir * (0.5 + Math.random() * 1.0);
        const rx = -Math.cos(body.heading), rz = Math.sin(body.heading);
        const sub = dt * Math.random();                  // where along this frame's travel the spark left the tyre
        // axis: the tyre's travel direction with a little of the spark's own scatter, a touch of lift
        let ax = tx * 3 + rx * side * 0.25, ay = 0.12 + Math.random() * 0.2, az = tz * 3 + rz * side * 0.25;
        const al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
        P.spawn('spark', this.slot, _v.x - body.vel.x * sub + (Math.random() - 0.5) * 0.16, _v.y + Math.random() * 0.06, _v.z - body.vel.z * sub + (Math.random() - 0.5) * 0.16,
          _v2.x * back + rx * side, 0.5 + Math.random() * 1.8, _v2.z * back + rz * side,
          0.12 + Math.random() * 0.2, SPARK_WIDTH.min + Math.random() * (SPARK_WIDTH.max - SPARK_WIDTH.min) + 0.004 * tier, colour, SPARK_HDR,
          ax, ay, az, lenBase * (0.7 + 0.3 * Math.random()));
      }
    }
    // boost: exhaust flare sprites and the two cones
    const boosting = body.boost > 0 && body.state !== 'spin' && body.state !== 'fall' && body.state !== 'respawn';
    this._boostVis += ((boosting ? 1 : 0) - this._boostVis) * Math.min(1, dt * (boosting ? 18 : 6));
    const vis = this._boostVis;
    for (let i = 0; i < 2; i++) {
      _m4.multiplyMatrices(this.bodyGroup.matrixWorld, this._exhaustM[i]);
      const len = vis > 0.02 ? (0.45 + 0.3 * vis + 0.12 * Math.sin(this._t * 37 + i * 2) + 0.05 * Math.sin(this._t * 61 + i)) * vis : 0;
      P.setCone(this.slot, i, _m4, len, 0.45 + 0.2 * vis + 0.05 * Math.sin(this._t * 47 + i * 3));
      if (vis > 0.05) {
        // the flame proper: a dense stream of soft licks off each pipe, pale core near the tip and tangerine
        // fringe further back, written above 1.0 so the bloom haloes the jet
        this._flareAcc += dt * 90 * vis;
        while (this._flareAcc >= 1) {
          this._flareAcc -= 1;
          _v.setFromMatrixPosition(_m4);
          _v2.set(Math.sin(body.heading), 0, Math.cos(body.heading));
          const k = Math.random();
          const along = 0.15 + k * 0.9;
          const colour = k < 0.35 ? FLARE_COLOUR : FLARE_FRINGE;
          P.spawn('flare', this.slot, _v.x - _v2.x * along - body.vel.x * dt * Math.random() + (Math.random() - 0.5) * 0.1, _v.y + 0.08 * k + (Math.random() - 0.5) * 0.1, _v.z - _v2.z * along - body.vel.z * dt * Math.random() + (Math.random() - 0.5) * 0.1,
            body.vel.x * 0.85 - _v2.x * (1.5 + Math.random() * 2.5), 0.3 + Math.random() * 1.0, body.vel.z * 0.85 - _v2.z * (1.5 + Math.random() * 2.5),
            0.14 + Math.random() * 0.14, (k < 0.35 ? 0.2 : 0.28) + 0.14 * Math.random(), colour, k < 0.35 ? 2.0 : 1.4);
        }
      }
    }
  }

  async _loadProp(name) {
    if (this._itemCache.has(name)) return this._itemCache.get(name);
    const p = (async () => {
      const obj = await ASSET(this.url(name), { keepHierarchy: true });
      if (!countMeshes(obj)) { console.warn('[kartview] asset missing: ' + name + ' (not shown)'); return null; }
      const applyMaterials = await loadApplyMaterials();
      if (applyMaterials) { try { applyMaterials(obj, { local: true, asset: name }); } catch (e) { console.warn('[kartview] applyMaterials failed on ' + name + ': ' + (e && e.message)); } }
      bakeArticulated(obj, []);
      obj.traverse((m) => { if (m.isMesh) m.castShadow = false; });
      return obj;
    })();
    this._itemCache.set(name, p);
    return p;
  }

  /** Shows espresso_cup above the seat while the espresso is held; any other key shows nothing. */
  setItemHeld(key) {
    if (key === this.heldKey) return;
    this.heldKey = key;
    if (this.heldObject) { this.heldObject.removeFromParent(); this.heldObject = null; }
    if (key !== 'espresso') return;
    this._loadProp('espresso_cup').then((obj) => {
      if (this.heldKey !== 'espresso' || !obj) return;
      obj.scale.setScalar(0.7);
      this.heldObject = obj;
      this.itemHolder.add(obj);
    });
  }

  /** Foam shield: a foam_shield instance parented at the body centre. */
  setShield(on) {
    on = !!on;
    if (on === this.shieldOn) return;
    this.shieldOn = on;
    if (!on) { if (this.shieldObject) this.shieldObject.visible = false; return; }
    if (this.shieldObject) { this.shieldObject.visible = true; return; }
    this._loadProp('foam_shield').then((obj) => {
      if (!obj) return;
      const native = obj.userData.nativeSize;
      const h = native && native.y > 0.5 ? native.y : 2.4;
      obj.position.set(0, 0.75 - h / 2, -0.1);        // the shell's base is at y = 0; centre it on the kart
      obj.traverse((m) => { if (m.isMesh && m.material) { m.material.transparent = true; m.material.depthWrite = false; m.castShadow = false; } });
      this.shieldObject = obj;
      obj.visible = this.shieldOn;
      this.shieldHolder.add(obj);
    });
  }

  /**
   * The kart's screen box in pixels (top left origin) for the claims kart mask, plus the same
   * normalised to the viewport (nx, ny, nw, nh). Null when the kart is behind the camera. The box
   * is the projected bounds of the loaded geometry (round 0 used a fixed 1.8 m tall box that
   * overstated the kart by a third); the critic's frame height check reads nh.
   */
  screenBox(camera, width = globalThis.innerWidth || 1280, height = globalThis.innerHeight || 720) {
    if (!camera) return null;
    this.object.updateMatrixWorld(true);
    if (this.localBox) _box.copy(this.localBox);
    else { _box.min.set(-0.9, -0.05, -1.0); _box.max.set(0.9, 1.75, 1.0); }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, behind = 0;
    for (let i = 0; i < 8; i++) {
      _corner.set(i & 1 ? _box.max.x : _box.min.x, i & 2 ? _box.max.y : _box.min.y, i & 4 ? _box.max.z : _box.min.z);
      _corner.applyMatrix4(this.object.matrixWorld);
      _v2.copy(_corner).applyMatrix4(camera.matrixWorldInverse);
      if (_v2.z > -0.05) { behind++; continue; }
      _corner.project(camera);
      const px = (_corner.x + 1) * 0.5 * width, py = (1 - _corner.y) * 0.5 * height;
      if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py;
    }
    if (behind > 4 || !Number.isFinite(minX)) return null;
    const x = Math.max(0, minX), y = Math.max(0, minY), x2 = Math.min(width, maxX), y2 = Math.min(height, maxY);
    if (x2 <= x || y2 <= y) return null;
    return { x, y, w: x2 - x, h: y2 - y, nx: x / width, ny: y / height, nw: (x2 - x) / width, nh: (y2 - y) / height };
  }

  dispose() {
    this.object.removeFromParent();
  }
}
