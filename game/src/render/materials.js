/**
 * DRIVE  src/render/materials.js  (owner: render; lifted from refs/rust17/materials.js)
 *
 * Real PBR surfaces on every object, from the twelve Atlas PATINA sets in ./textures/, applied by
 * TRIPLANAR projection so no asset needs UVs. Rust 17's blind critic's deciding property on round 1
 * was "every object is one flat albedo"; this is what fixed it.
 *
 * How it fits the pipeline (nothing in assetlib.js, surfaces.js or the assets is touched):
 *
 *   ASSET(url, { surfaces: false })         the loader: flat colours, recipe NAMES on the materials
 *   applyMaterials(obj, opts)               THIS MODULE
 *     phase 1  pick a material SET per part from the recipe name first (plaster | stone | timber |
 *              tile | metal | fabric | foliage | ground, surfaces.classify() for unnamed parts) and
 *              the part colour second, and put that set's textures on the part's material as an
 *              identity
 *     phase 2  bake.js vertexiseMaterials(): colour, roughness and metalness go into vertex
 *              attributes and every part of one set shares ONE material value
 *     phase 3  swap that shared material for the TriplanarMaterial of the set, shared across every
 *              asset in the game, so assetlib's bakeStatic() merges a block to one mesh per set
 *   bakeStatic(block)                        unchanged (the level builder, per 30 m block)
 *
 * THE TINT RULE: the asset's own colour is in the `color` vertex attribute, the texture is
 * normalised to its mean (albedo = tint x texel / mean), so the palette in style/STYLE-LOCK.md
 * survives on average and the texture carries only the surface: cobble joints, tile courses, plank
 * grooves, plaster mottle. Same for roughness. Metalness is the asset's own.
 * MACRO VARIATION: the same tile read once more at 1/9 of the frequency modulates albedo and
 * roughness, so three tiles side by side never read as three copies.
 * EDGE WEAR at half of Rust 17's strength: where the normal leaves the projection axes (chamfers,
 * cylinder shoulders) the surface goes a shade lighter and smoother, the style lock's painted edge.
 * This town is clean: wear is a colour shift, never a stain.
 *
 * Space: static bakes carry world positions in their vertices, so the projection reads the WORLD
 * position through modelMatrix, which is the identity for a baked block and the real matrix for
 * anything not baked. Anything that moves (karts, drivers, item boxes, boats) projects in its own
 * LOCAL space instead (opts.local) so the surface sticks to the part as it moves.
 *
 * CARDS: a material named 'card:<name>' is an alpha tested double sided plane wearing one of the
 * Atlas cutouts in ./textures/card_<name>.webp through the plane's own uvs (CardMaterial); one
 * shared material per card across the game. The asset gives every card material a UNIQUE colour or
 * assetlib welds them by value. Shadows come from three's depth material, which copies map and
 * alphaTest, so a frond throws a leaflet shaped shadow.
 *
 * ROAD and TERRAIN: the two meshes that are not assets take RoadMaterial (asphalt and cobble sets
 * blended by a per vertex surface weight, kerb white and paint lines from vertex colour) and
 * TerrainMaterial (a splat of grass, sand, cobble, rock and asphalt by the paint attribute),
 * both driven by the same tint rule from their vertex colours.
 *
 *   await preloadMaterials(tier)                    once, before the level (main.js step 2)
 *   applyMaterials(obj, { asset, local })          after ASSET(), per instance
 *   applyRoadMaterial(road.tiles, road)            after buildRoad
 *   applyTerrainMaterial(terrain.tiles, terrain)   after buildTerrain
 */
import * as THREE from 'three';
import { VertexPBRMaterial, vertexiseMaterials } from './bake.js?v=r0-20260906043348';
import { classify, RECIPES } from '../../surfaces.js?v=r0-20260906043348';
import { sunDirection, SUN_COLOR, SUN_INTENSITY } from './lighting.js?v=r0-20260906043348';
import { getTier } from './quality.js?v=r0-20260906043348';

/**
 * The sets. `scale` is metres per tile. `normal` is the normal map strength, `albedo` and `rough`
 * how much of the texture's variation is used (1 = all of it), `wear` the edge wear amount.
 * `recipe` is the surfaces.js name that picks the set.
 */
export const SETS = {
  asphalt_worn:     { scale: 3.0, recipe: 'ground', road: true,  normal: 0.6, albedo: 1.0, rough: 0.8, wear: 0.0 },
  cobble_warm:      { scale: 2.0, recipe: 'stone',  road: true,  normal: 0.9, albedo: 1.0, rough: 0.8, wear: 0.2 },
  sand_beach:       { scale: 1.5, recipe: 'ground',              normal: 0.5, albedo: 1.0, rough: 0.7, wear: 0.0 },
  grass_dry:        { scale: 2.0, recipe: 'ground',              normal: 0.6, albedo: 0.9, rough: 0.7, wear: 0.0 },
  rock_cliff:       { scale: 3.0, recipe: 'stone',  rock: true,  normal: 1.0, albedo: 1.0, rough: 0.8, wear: 0.3 },
  plaster_warm:     { scale: 2.5, recipe: 'plaster',             normal: 0.6, albedo: 0.9, rough: 0.7, wear: 0.2 },
  stone_warm:       { scale: 2.0, recipe: 'stone',               normal: 0.9, albedo: 1.0, rough: 0.8, wear: 0.2 },
  terracotta_tile:  { scale: 1.2, recipe: 'tile',                normal: 1.0, albedo: 1.0, rough: 0.8, wear: 0.2 },
  timber_painted:   { scale: 1.0, recipe: 'timber',              normal: 0.8, albedo: 0.9, rough: 0.8, wear: 0.5 },
  metal_painted:    { scale: 1.5, recipe: 'metal',               normal: 0.6, albedo: 0.8, rough: 0.8, wear: 0.5 },
  canvas_stripe:    { scale: 0.8, recipe: 'fabric',              normal: 0.7, albedo: 0.8, rough: 0.7, wear: 0.1 },
  foliage_leaf:     { scale: 0.6, recipe: 'foliage',             normal: 0.9, albedo: 1.0, rough: 0.8, wear: 0.0 },
};

/**
 * The cards. `sss` is the backlight: a thin leaf lit from behind glows, so the card adds emissive =
 * albedo x sun x sss where the sun is on the far side of the card from the viewer (a fraction of the
 * Lambert term). `tint` is how far the card's colour is pulled toward the asset's material colour
 * (0 = the picture as is, 1 = the full tint rule). The alpha cut is 0.5 for every card.
 */
export const CARDS = {
  palm_frond_a:    { sss: 0.15, tint: 0.30 },
  palm_frond_b:    { sss: 0.15, tint: 0.30 },
  palm_frond_c:    { sss: 0.12, tint: 0.30 },
  pine_bough_a:    { sss: 0.08, tint: 0.35 },
  pine_bough_b:    { sss: 0.08, tint: 0.35 },
  bougainvillea_a: { sss: 0.12, tint: 0.20 },
  bougainvillea_b: { sss: 0.12, tint: 0.20 },
  bunting_a:       { sss: 0.06, tint: 0.00 },
  flag_a:          { sss: 0.06, tint: 0.00 },
  crowd_a:         { sss: 0.00, tint: 0.00 },
  crowd_b:         { sss: 0.00, tint: 0.00 },
  crowd_c:         { sss: 0.00, tint: 0.00 },
};
const CARD_PREFIX = 'card:';

/** Sets that ship a 1024 basecolor and normal for the high tier: the two road surfaces, most of every frame. */
const HERO_1024 = new Set(['asphalt_worn', 'cobble_warm']);
/** Assets whose 'stone' is rock, not dressed masonry. */
const ROCK_ASSETS = /rock_|boulder|sea_stack|cliff|tunnel/;

// ------------------------------------------------------------------------------------------ textures
const TEX = {};                  // set -> { map, normal, rough, mean: Color, roughMean, res }
const TEX_TO_SET = new Map();    // basecolor texture -> set name (the phase 1 identity)
const CARD_TEX = {};             // card -> { map, mean: Color, aspect }
const TEX_TO_CARD = new Map();
let loading = null;
let NORMAL_FLIP = 1.0;           // +1: OpenGL green up. Measured against the height maps in work/render/convert.py (green correlation negative = OpenGL) for every set.

function stamp(url) {
  try { const v = globalThis.__BUILD_STAMP__; return v ? `${url}?v=${v}` : url; } catch (e) { return url; }
}

function meanOf(image, srgb, alphaWeighted = false) {
  // mean in LINEAR space from a 32 x 32 downsample; alphaWeighted: the mean of what a card SHOWS
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, 32, 32);
  const d = ctx.getImageData(0, 0, 32, 32).data;
  let r = 0, g = 0, b = 0, n = 0;
  const lin = (v) => { v /= 255; return srgb ? (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)) : v; };
  for (let i = 0; i < d.length; i += 4) {
    const w = alphaWeighted ? d[i + 3] / 255 : 1;
    if (w <= 0) continue;
    r += lin(d[i]) * w; g += lin(d[i + 1]) * w; b += lin(d[i + 2]) * w; n += w;
  }
  n = Math.max(n, 1e-6);
  return [r / n, g / n, b / n];
}

/**
 * Load every set for the tier: basecolor and normal at tier.texRes for the HERO sets, 512 otherwise,
 * roughness at 512 always; then the cards. Basecolor is sRGB, normal and roughness are linear data;
 * mipmaps on, anisotropy from the tier. Resolves when every texture is decoded and its mean known.
 * A set that fails to load is logged and simply not applied (the part keeps its flat colour); the
 * gate treats the 404 as a hard failure.
 */
export function preloadMaterials(tier = {}, base = './textures/') {
  if (loading) return loading;
  const T = getTier(tier);
  const aniso = Math.max(1, T.anisotropy || 1);
  const heroRes = T.texRes || 512;
  const loader = new THREE.TextureLoader();
  const failed = [];
  const one = (url, srgb) => new Promise((resolve) => {
    loader.load(stamp(url), (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = aniso;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.needsUpdate = true;
      resolve(t);
    }, undefined, (e) => { failed.push(url); console.warn('[materials] failed to load', url, e && (e.message || e.type)); resolve(null); });
  });
  loading = (async () => {
    const t0 = performance.now();
    // Every set loads at 512 before READY; the hero sets' 1024 maps (1.0 MB of the 2.2 MB texture
    // budget) arrive AFTER window.__READY__ and are swapped into the same texture objects, so the
    // materials never change and the 8 s on 4G budget is not spent on them (integrator, round 0).
    const upgrades = [];
    await Promise.all(Object.keys(SETS).map(async (set) => {
      const res = 512;
      const [map, normal, rough] = await Promise.all([
        one(`${base}${set}_basecolor_${res}.webp`, true),
        one(`${base}${set}_normal_${res}.webp`, false),
        one(`${base}${set}_roughness_512.webp`, false),
      ]);
      if (!map || !normal) return;
      const mean = meanOf(map.image, true);
      const rm = rough ? meanOf(rough.image, false) : [1, 1, 1];
      TEX[set] = { map, normal, rough, mean: new THREE.Color(mean[0], mean[1], mean[2]), roughMean: rm[0], res };
      TEX_TO_SET.set(map, set);
      if (HERO_1024.has(set) && heroRes > 512) upgrades.push(set);
    }));
    if (upgrades.length) {
      const swap = (dst, src) => { if (!dst || !src) return; dst.image = src.image; dst.needsUpdate = true; };
      const run = async () => {
        for (const set of upgrades) {
          const [map, normal] = await Promise.all([one(`${base}${set}_basecolor_${heroRes}.webp`, true), one(`${base}${set}_normal_${heroRes}.webp`, false)]);
          if (!map || !normal) continue;
          swap(TEX[set].map, map); swap(TEX[set].normal, normal);
          TEX[set].res = heroRes;
        }
        console.info(`[materials] hero sets upgraded to ${heroRes}: ${upgrades.join(', ')}`);
      };
      const waitReady = () => { if (typeof window !== 'undefined' && window.__READY__) run(); else setTimeout(waitReady, 250); };
      setTimeout(waitReady, 250);
    }
    await Promise.all(Object.keys(CARDS).map(async (card) => {
      const map = await one(`${base}card_${card}.webp`, true);
      if (!map) return;
      map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
      map.needsUpdate = true;
      const mean = meanOf(map.image, true, true);
      CARD_TEX[card] = { map, mean: new THREE.Color(mean[0], mean[1], mean[2]), aspect: map.image.width / map.image.height };
      TEX_TO_CARD.set(map, card);
    }));
    console.info(`[materials] ${Object.keys(TEX).length}/${Object.keys(SETS).length} sets, ${Object.keys(CARD_TEX).length}/${Object.keys(CARDS).length} cards loaded in ${(performance.now() - t0).toFixed(0)} ms` + (failed.length ? `; FAILED: ${failed.join(' ')}` : ''));
    return TEX;
  })();
  return loading;
}
export function loadedSets() { return TEX; }
export function loadedCards() { return CARD_TEX; }
/** The card a material asks for by name ('card:palm_frond_a' -> 'palm_frond_a'), or null. */
export function cardOf(m) {
  const n = m && m.name;
  return n && n.startsWith(CARD_PREFIX) && CARDS[n.slice(CARD_PREFIX.length)] ? n.slice(CARD_PREFIX.length) : null;
}
/** Width / height of a card's picture, so an asset can size its plane to the cutout. Null before preload. */
export function cardAspect(card) { return CARD_TEX[card] ? CARD_TEX[card].aspect : null; }
export function setNormalFlip(v) { NORMAL_FLIP = v; }

// ------------------------------------------------------------------------------------------ classification
const _c = new THREE.Color();
function hsl(m) {
  _c.copy(m.color).convertLinearToSRGB();
  const r = _c.r, g = _c.g, b = _c.b;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  let hue = 0;
  if (max > min) {
    const d = max - min;
    if (max === r) hue = 60 * (((g - b) / d) % 6);
    else if (max === g) hue = 60 * ((b - r) / d + 2);
    else hue = 60 * ((r - g) / d + 4);
    if (hue < 0) hue += 360;
  }
  return { sat, lum, hue, r, g, b };
}

/**
 * Recipe name first, colour second. Returns a set name or null (glass, emissive lenses and near
 * black rubber keep the material they arrived with, as the style lock says).
 */
export function chooseSet(m, asset = '', local = false) {
  if (!m || !m.color) return null;
  if (m.name && SETS[m.name]) return m.name;   // an asset may name a set outright
  if (m.transparent && m.opacity < 0.95) return null;
  if (m.emissive && m.emissive.getHex() && (m.emissiveIntensity || 1) > 0.5) return null;
  const { sat, lum, hue, r, g, b } = hsl(m);
  let recipe = m.name && RECIPES[m.name] ? m.name : null;
  if (!recipe) {
    if (lum < 0.16) return null;                 // tyres, rubber, near black trim: left alone
    recipe = classify(m);
    if (!recipe) return null;
  }
  switch (recipe) {
    case 'ground': {
      // sand fillets on the beach, grass in town, cobble on the pads, asphalt on the quay: by the part's colour
      if (hue >= 55 && hue <= 160 && g >= r * 0.95 && sat > 0.2) return 'grass_dry';
      if (sat < 0.14 && lum < 0.45) return 'asphalt_worn';
      if (lum > 0.62 && hue >= 25 && hue <= 60) return 'sand_beach';
      return 'cobble_warm';
    }
    case 'stone': return ROCK_ASSETS.test(asset) ? 'rock_cliff' : 'stone_warm';
    case 'plaster': return 'plaster_warm';
    case 'timber': return 'timber_painted';
    case 'tile': return 'terracotta_tile';
    case 'foliage': return 'foliage_leaf';
    case 'fabric': return 'canvas_stripe';
    case 'metal': return 'metal_painted';
    default: return null;
  }
}

// ------------------------------------------------------------------------------------------ the triplanar material
const TRI_PARS_VS = /* glsl */`
attribute vec2 aRM;
varying vec2 vRM;
varying vec3 vTriPos;
varying vec3 vTriNrm;
uniform float uTriLocal;`;

const TRI_VS = /* glsl */`
{
  vec4 triW = modelMatrix * vec4( transformed, 1.0 );
  vec3 triN = normalize( mat3( modelMatrix ) * objectNormal );
  vTriPos = mix( triW.xyz, transformed, uTriLocal );
  vTriNrm = mix( triN, objectNormal, uTriLocal );
}`;

const TRI_PARS_FS = /* glsl */`
varying vec2 vRM;
varying vec3 vTriPos;
varying vec3 vTriNrm;
uniform sampler2D uTriMap;
uniform sampler2D uTriNormal;
uniform sampler2D uTriRough;
uniform vec4 uTriK;          // x: 1 / metres per tile, y: normal strength, z: albedo strength, w: roughness strength
uniform vec3 uTriMean;       // mean linear albedo of the tile
uniform float uTriRoughMean;
uniform float uTriLocal;
uniform float uTriNFlip;
uniform float uTriWear;
uniform mat4 modelMatrix;`;

/**
 * The projection. Per axis a right handed tangent frame (T, B, N) with T x B = N, so the normal
 * map's green is always "up the tile" in world space and the sign flips on the negative faces keep
 * the tile unmirrored:
 *   X: T = (0,0,-s), B = (0,1,0), N = (s,0,0)   uv = (-s z, y)
 *   Y: T = (1,0,0),  B = (0,0,-s), N = (0,s,0)  uv = (x, -s z)
 *   Z: T = (s,0,0),  B = (0,1,0), N = (0,0,s)   uv = (s x, y)
 * Whiteout blend per projection, then the three are summed by the blend weights and renormalised.
 * Weights are |n| cut by 0.2 and raised to the 4th, so an axis aligned face samples ONE projection
 * (3 texture reads) and a 45 degree edge blends over a tight band.
 */
function triSampleGLSL(P, withRough, planar) {
  const map = `u${P}Map`, nrm = `u${P}Nrm`, rgh = `u${P}Rgh`, K = `u${P}K`;
  const read = (axis) => {
    const [uv, nT, out] = axis === 'x'
      ? ['vec2( -s.x * p.z, p.y )', 'vec3( -s.x * n.z, n.y, s.x * n.x )', 'vec3( s.x * w.z, w.y, -s.x * w.x )']
      : axis === 'y'
        ? ['vec2( p.x, -s.y * p.z )', 'vec3( n.x, -s.y * n.z, s.y * n.y )', 'vec3( w.x, s.y * w.z, -s.y * w.y )']
        : ['vec2( s.z * p.x, p.y )', 'vec3( s.z * n.x, n.y, s.z * n.z )', 'vec3( s.z * w.x, w.y, s.z * w.z )'];
    return `
    { vec2 uv = ${uv};
      alb_${P} += texture2D( ${map}, uv ).rgb * bw.${axis};
      vec3 t = texture2D( ${nrm}, uv ).xyz * 2.0 - 1.0; t.y *= uTriNFlip; t.xy *= ${K}.y;
      vec3 nT = ${nT};
      vec3 w = vec3( t.xy + nT.xy, abs( t.z ) * nT.z );
      nrm_${P} += ${out} * bw.${axis};
      ${withRough ? `rgh_${P} += texture2D( ${rgh}, uv ).r * bw.${axis};` : ''} }`;
  };
  return /* glsl */`
  vec3 alb_${P} = vec3( 0.0 ); vec3 nrm_${P} = vec3( 0.0 ); float rgh_${P} = 0.0;
  { vec3 p = vTriPos * ${K}.x;
    ${planar ? read('y') : `if ( bw.x > 0.0 ) ${read('x')}\n    if ( bw.y > 0.0 ) ${read('y')}\n    if ( bw.z > 0.0 ) ${read('z')}`}
  }`;
}
// the blend weights and signs every projection block above reads; `n` is the world (or local) normal
const TRI_WEIGHTS = /* glsl */`
  vec3 n = normalize( vTriNrm );
  #ifdef DOUBLE_SIDED
    n *= gl_FrontFacing ? 1.0 : -1.0;
  #endif
  vec3 bw = abs( n );
  bw = max( bw - 0.2, 0.0 );
  bw = bw * bw; bw = bw * bw;
  bw /= ( bw.x + bw.y + bw.z + 1e-5 );
  vec3 s = vec3( n.x < 0.0 ? -1.0 : 1.0, n.y < 0.0 ? -1.0 : 1.0, n.z < 0.0 ? -1.0 : 1.0 );`;
const TRI_PLANAR_WEIGHTS = /* glsl */`
  vec3 n = normalize( vTriNrm );
  vec3 bw = vec3( 0.0, 1.0, 0.0 );
  vec3 s = vec3( 1.0, n.y < 0.0 ? -1.0 : 1.0, 1.0 );`;

const TRI_FS = /* glsl */`
vec3 triN; float triR;
{
  ${TRI_WEIGHTS}
  ${triSampleGLSL('Tri', true, false).replace(/uTriNrm\b/g, 'uTriNormal').replace(/uTriRgh\b/g, 'uTriRough')}
  vec3 ratio = clamp( alb_Tri / max( uTriMean, vec3( 0.02 ) ), 0.2, 3.0 );
  diffuseColor.rgb *= mix( vec3( 1.0 ), ratio, uTriK.z );
  triN = normalize( nrm_Tri );
  triR = clamp( mix( 1.0, rgh_Tri / max( uTriRoughMean, 0.05 ), uTriK.w ), 0.2, 1.6 );
  // MACRO VARIATION: the same tile read at 1/9 of the frequency on the dominant projection; its luminance
  // against the tile mean modulates albedo and roughness by up to 30 percent
  {
    vec3 pm = vTriPos * uTriK.x * 0.111;
    vec2 uvm = bw.y >= bw.x && bw.y >= bw.z ? vec2( pm.x, -s.y * pm.z ) : ( bw.x >= bw.z ? vec2( -s.x * pm.z, pm.y ) : vec2( s.z * pm.x, pm.y ) );
    vec3 m = texture2D( uTriMap, uvm + vec2( 0.37, 0.61 ) ).rgb;
    float lm = dot( m, vec3( 0.3, 0.59, 0.11 ) ) / max( dot( uTriMean, vec3( 0.3, 0.59, 0.11 ) ), 0.02 );
    lm = clamp( lm, 0.5, 1.8 );
    diffuseColor.rgb *= mix( 1.0, lm, 0.30 );
    triR *= mix( 1.0, 1.0 / lm, 0.2 );
  }
  // EDGE WEAR at half strength: off axis faces (chamfers, shoulders) go a shade lighter and smoother, the painted edge
  {
    float offAxis = 1.0 - max( bw.x, max( bw.y, bw.z ) );
    float wear = smoothstep( 0.08, 0.45, offAxis ) * uTriWear;
    diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * 1.22 + vec3( 0.04 ), wear * 0.7 );
    triR = mix( triR, triR * 0.75, wear );
  }
}`;

const TRI_ROUGH_FS = /* glsl */`float roughnessFactor = clamp( vRM.x * triR, 0.04, 1.0 );`;
const TRI_METAL_FS = /* glsl */`float metalnessFactor = vRM.y;`;
const TRI_NORMAL_FS = /* glsl */`
{
  vec3 nW = mix( triN, normalize( mat3( modelMatrix ) * triN ), uTriLocal );
  normal = normalize( ( viewMatrix * vec4( nW, 0.0 ) ).xyz );
}`;

export class TriplanarMaterial extends VertexPBRMaterial {
  constructor(set, params) {
    super(params);
    if (set) {
      const S = SETS[set];
      this.userData = { __vrm: true, surface: S.recipe, triSet: set, triLocal: 0, triDetail: 1 };
      this.name = S.recipe;
      // IDENTITY, not a uv map: assetlib's bakeStatic merges by material VALUES and its key reads the map
      // uuids; with no map every set was equal by value and a block collapsed to one bucket. The shader
      // replaces map_fragment whole, so the uv sampling three would do with USE_MAP never runs.
      if (TEX[set]) this.map = TEX[set].map;
    }
  }
  onBeforeCompile(shader) {
    const set = this.userData.triSet, S = SETS[set], T = TEX[set];
    if (!S || !T) return;
    shader.uniforms.uTriMap = { value: T.map };
    shader.uniforms.uTriNormal = { value: T.normal };
    shader.uniforms.uTriRough = { value: T.rough || T.normal };
    const detail = this.userData.triDetail || 1;
    shader.uniforms.uTriK = { value: new THREE.Vector4(1 / (S.scale * detail), S.normal, S.albedo, T.rough ? S.rough : 0) };
    shader.uniforms.uTriMean = { value: T.mean };
    shader.uniforms.uTriWear = { value: S.wear !== undefined ? S.wear : 0.2 };
    shader.uniforms.uTriRoughMean = { value: T.roughMean };
    shader.uniforms.uTriLocal = { value: this.userData.triLocal ? 1 : 0 };
    shader.uniforms.uTriNFlip = { value: NORMAL_FLIP };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>' + TRI_PARS_VS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRM = aRM;')
      .replace('#include <project_vertex>', '#include <project_vertex>' + TRI_VS);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>' + TRI_PARS_FS)
      .replace('#include <map_fragment>', TRI_FS)
      .replace('#include <roughnessmap_fragment>', TRI_ROUGH_FS)
      .replace('#include <metalnessmap_fragment>', TRI_METAL_FS)
      .replace('#include <normal_fragment_maps>', TRI_NORMAL_FS + '\n#include <normal_fragment_maps>');
  }
  customProgramCacheKey() { return 'drive_tri'; }
}
Object.defineProperty(TriplanarMaterial.prototype, 'isTriplanar', { value: true });

// ------------------------------------------------------------------------------------------ cards
const CARD_PARS_FS = /* glsl */`
uniform vec3 uCardInvMean;
uniform vec4 uCardK;         // x: tint toward the asset colour, y: backlight
uniform vec3 uCardSunW;      // direction toward the sun, world
uniform vec3 uCardSun;       // sun colour x intensity / pi`;
const CARD_COLOR_FS = /* glsl */`diffuseColor.rgb *= mix( vec3( 1.0 ), vColor * uCardInvMean, uCardK.x );`;
// a card is a leaf, not a wall: both faces shade from the SAME normal (the asset bends its normals toward up
// and outward so a crown reads as one lit mass, not as a fan of planes each lit or unlit by its own facing)
const CARD_NORMAL_FS = /* glsl */`
#ifdef DOUBLE_SIDED
  normal = normalize( vNormal );
#endif`;
const CARD_EMISSIVE_FS = /* glsl */`
{
  vec3 cgp = - vViewPosition;
  vec3 cgN = normalize( cross( dFdx( cgp ), dFdy( cgp ) ) );
  vec3 csun = normalize( ( viewMatrix * vec4( uCardSunW, 0.0 ) ).xyz );
  float cback = max( 0.0, - dot( cgN, csun ) );
  totalEmissiveRadiance += diffuseColor.rgb * uCardSun * ( uCardK.y * cback );
}`;

let SUN_W = sunDirection(THREE).clone().normalize(), SUN_RGB = new THREE.Color(SUN_COLOR).multiplyScalar(SUN_INTENSITY / Math.PI);
export function setCardSun(dirToSun, color, intensity) {
  SUN_W = dirToSun.clone().normalize();
  SUN_RGB = new THREE.Color(color).multiplyScalar(intensity / Math.PI);
}

/**
 * One alpha tested, double sided VertexPBR per card, shared by every asset in the game. The picture
 * goes through three's own map path (uv 0..1 across the plane, sRGB decode, mipmaps, alphaTest 0.5)
 * and the depth material picks map and alphaTest up for the shadow. isVertexPBR stays true so the
 * rig's chain (CSM, bounce, aerial perspective, cull fade) applies as to everything else.
 */
export class CardMaterial extends VertexPBRMaterial {
  constructor(card, params) {
    super(params);
    if (card && CARD_TEX[card]) {
      this.userData = { __vrm: true, surface: 'foliage', card, triSet: CARD_PREFIX + card };
      this.name = 'foliage';
      this.map = CARD_TEX[card].map;
      this.alphaTest = 0.5;
      this.side = THREE.DoubleSide;
      this.transparent = false;
      this.alphaToCoverage = true;   // softer cut on the MSAA target; a no op without MSAA (phone tier)
    }
  }
  onBeforeCompile(shader) {
    VertexPBRMaterial.prototype.onBeforeCompile.call(this, shader);
    const card = this.userData.card, C = CARDS[card], T = CARD_TEX[card];
    if (!C || !T) return;
    shader.uniforms.uCardInvMean = { value: new THREE.Vector3(1 / Math.max(T.mean.r, 0.02), 1 / Math.max(T.mean.g, 0.02), 1 / Math.max(T.mean.b, 0.02)) };
    shader.uniforms.uCardK = { value: new THREE.Vector4(C.tint, C.sss, 0, 0) };
    shader.uniforms.uCardSunW = { value: SUN_W };
    shader.uniforms.uCardSun = { value: SUN_RGB };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>' + CARD_PARS_FS)
      .replace('#include <color_fragment>', CARD_COLOR_FS)
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>' + CARD_NORMAL_FS)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>' + CARD_EMISSIVE_FS);
  }
  customProgramCacheKey() { return 'drive_card'; }
}
Object.defineProperty(CardMaterial.prototype, 'isCard', { value: true });

const CARD_SHARED = new Map();
const WARNED_CARDS = new Set();
function cardSharedFor(card, m) {
  const key = [card, m.depthWrite ? 1 : 0, m.flatShading ? 1 : 0].join('|');
  let t = CARD_SHARED.get(key);
  if (!t) {
    t = new CardMaterial(card);
    t.depthWrite = m.depthWrite; t.flatShading = m.flatShading;
    CARD_SHARED.set(key, t);
  }
  return t;
}

const SHARED = new Map();   // set|side|transparent|opacity|emissive|... -> TriplanarMaterial, shared across every asset
function sharedFor(set, m, local, detail = 1) {
  const key = [set, m.side, m.transparent ? 1 : 0, m.opacity, m.emissive ? m.emissive.getHexString() : '-', m.emissiveIntensity,
    m.alphaTest, m.depthWrite ? 1 : 0, m.flatShading ? 1 : 0, local ? 'L' : 'W', detail].join('|');
  let t = SHARED.get(key);
  if (!t) {
    t = new TriplanarMaterial(set);
    t.side = m.side; t.transparent = m.transparent; t.opacity = m.opacity;
    if (m.emissive) t.emissive.copy(m.emissive);
    t.emissiveIntensity = m.emissiveIntensity; t.alphaTest = m.alphaTest; t.depthWrite = m.depthWrite; t.flatShading = m.flatShading;
    t.userData.triLocal = local ? 1 : 0;
    t.userData.triDetail = detail;
    SHARED.set(key, t);
  }
  return t;
}

/**
 * Texture one loaded asset, in place of a vertexiseMaterials() call:
 *   applyMaterials(obj, { asset: 'house_narrow_tall' })          static, world projection
 *   applyMaterials(obj, { asset: 'kart_chassis', local: true })  moving, local projection
 * `local` projects in the object's own space so the surface travels with it. `unify` puts every
 * textured part of the asset on ONE set (the one with the most vertices): only for single material
 * articulated things; it is OFF by default because a house would lose its roof tile to its plaster.
 * `detail` scales the tile (0.5 on a 1.2 m kart: a 1.5 m paint tile is one flat colour across it).
 * Returns { tagged, swapped, sets }.
 */
export function applyMaterials(root, opts = {}) {
  const asset = opts.asset || '';
  const local = !!opts.local;
  const detail = opts.detail || 1;
  const unify = !!opts.unify;
  const stats = { tagged: 0, swapped: 0, sets: new Set() };
  if (!root) return stats;
  if (!Object.keys(TEX).length) { vertexiseMaterials(root, { unify }); return stats; }

  // phase 1: choose a set per part and mark the part's material with the set's textures
  const chosen = [];
  const counts = new Map();
  const cards = [], orphans = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
    const m = o.material;
    if (!m.isMeshStandardMaterial || m.isVertexPBR) return;
    const card = cardOf(m);
    if (card) { if (CARD_TEX[card]) cards.push([o, card]); else orphans.push([o, card]); return; }
    let set = opts.set || chooseSet(m, asset, local);
    if (!set || !TEX[set]) return;
    chosen.push([o, set]);
    if (unify) counts.set(set, (counts.get(set) || 0) + o.geometry.attributes.position.count * (o.isInstancedMesh ? o.count : 1));
  });
  let force = null;
  if (unify && counts.size) force = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const clones = new Map();   // source material -> its tagged clone (materials may be shared between parts)
  for (const [o, set0] of chosen) {
    const set = force || set0;
    const T = TEX[set];
    const src = o.material;
    const ck = src.uuid + '|' + set;
    let mm = clones.get(ck);
    if (!mm) {
      mm = src.clone();
      mm.name = src.name;
      mm.map = T.map; mm.normalMap = T.normal; mm.roughnessMap = T.rough || null;
      mm.normalScale = new THREE.Vector2(1, 1);
      clones.set(ck, mm);
    }
    o.material = mm;
    stats.tagged++;
    stats.sets.add(set);
  }
  // a card whose picture did not load is dropped, not drawn: a card plane with no map is a solid rectangle
  for (const [o, card] of orphans) {
    if (!WARNED_CARDS.has(card)) { WARNED_CARDS.add(card); console.warn(`[materials] card ${card} not loaded: its planes are dropped from ${asset || 'asset'}`); }
    o.removeFromParent();
  }
  for (const [o, card] of cards) {
    const src = o.material;
    const ck = src.uuid + '|card:' + card;
    let mm = clones.get(ck);
    if (!mm) {
      mm = src.clone();
      mm.name = src.name;
      mm.map = CARD_TEX[card].map; mm.normalMap = null; mm.roughnessMap = null;
      mm.transparent = false; mm.opacity = 1; mm.alphaTest = 0.5; mm.side = THREE.DoubleSide;
      clones.set(ck, mm);
    }
    o.material = mm;
    stats.tagged++;
    stats.sets.add(CARD_PREFIX + card);
  }

  // phase 2: colour, roughness and metalness into the vertices, one VertexPBR per surface (bake.js)
  vertexiseMaterials(root, { unify });

  // phase 3: the shared triplanar material of the set in place of the per asset VertexPBR
  root.traverse((o) => {
    if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
    const m = o.material;
    if (!m.isVertexPBR || m.isTriplanar || m.isCard) return;
    const card = m.map ? TEX_TO_CARD.get(m.map) : null;
    if (card) { o.material = cardSharedFor(card, m); stats.swapped++; return; }
    const set = m.map ? TEX_TO_SET.get(m.map) : null;
    if (!set) return;
    o.material = sharedFor(set, m, local, detail);
    stats.swapped++;
  });
  return stats;
}

// ------------------------------------------------------------------------------------------ road
const PALETTE = { asphalt: 0x4d5058, cobble: 0x9a8f80, pad: 0x4d5058, grass: 0x9aa64a, sand: 0xe6cf9c, rock: 0xcdb897, kerb: 0xf1e6d2 };
const _m4 = new THREE.Matrix4(), _v3 = new THREE.Vector3();

function ensureVertexAttrs(mesh, colorFor, rough) {
  const g = mesh.geometry;
  const pos = g.attributes.position;
  const n = pos.count;
  mesh.updateMatrixWorld(true);
  _m4.copy(mesh.matrixWorld);
  const world = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { _v3.fromBufferAttribute(pos, i).applyMatrix4(_m4); world[i * 3] = _v3.x; world[i * 3 + 1] = _v3.y; world[i * 3 + 2] = _v3.z; }
  if (!g.attributes.color) {
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const c = colorFor(world[i * 3], world[i * 3 + 2], i); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  if (!g.attributes.aRM) {
    const rm = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { rm[i * 2] = rough; rm[i * 2 + 1] = 0; }
    g.setAttribute('aRM', new THREE.BufferAttribute(rm, 2));
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return world;
}

const ROAD_PARS_VS = /* glsl */`
attribute vec2 aRM;
attribute float aSurf;
varying vec2 vRM;
varying float vSurf;
varying vec3 vTriPos;
varying vec3 vTriNrm;`;
const ROAD_VS = /* glsl */`
{
  vec4 triW = modelMatrix * vec4( transformed, 1.0 );
  vTriPos = triW.xyz;
  vTriNrm = normalize( mat3( modelMatrix ) * objectNormal );
  vSurf = aSurf;
}`;
const ROAD_PARS_FS = /* glsl */`
varying vec2 vRM;
varying float vSurf;
varying vec3 vTriPos;
varying vec3 vTriNrm;
uniform sampler2D uAMap, uANrm, uARgh, uBMap, uBNrm, uBRgh;
uniform vec4 uAK, uBK;
uniform vec3 uAMean, uBMean;
uniform vec2 uRoughMeans;
uniform float uTriNFlip;`;
const ROAD_FS = /* glsl */`
vec3 triN; float triR;
{
  ${TRI_WEIGHTS}
  float sm = smoothstep( 0.3, 0.7, vSurf );
  vec3 ratio = vec3( 1.0 ); vec3 nrm = vec3( 0.0 ); float rgh = 1.0;
  if ( sm < 0.999 ) {
    ${triSampleGLSL('A', true, false)}
    ratio = alb_A / max( uAMean, vec3( 0.02 ) ); nrm = nrm_A; rgh = rgh_A / max( uRoughMeans.x, 0.05 );
  }
  if ( sm > 0.001 ) {
    ${triSampleGLSL('B', true, false)}
    vec3 rB = alb_B / max( uBMean, vec3( 0.02 ) );
    ratio = mix( ratio, rB, sm ); nrm = mix( nrm, nrm_B, sm ); rgh = mix( rgh, rgh_B / max( uRoughMeans.y, 0.05 ), sm );
  }
  ratio = clamp( ratio, 0.2, 3.0 );
  float albK = mix( uAK.z, uBK.z, sm ), rghK = mix( uAK.w, uBK.w, sm );
  diffuseColor.rgb *= mix( vec3( 1.0 ), ratio, albK );
  triN = normalize( nrm );
  triR = clamp( mix( 1.0, rgh, rghK ), 0.2, 1.6 );
  // macro variation at 1/9 frequency on the dominant set
  {
    float kx = mix( uAK.x, uBK.x, sm ) * 0.111;
    vec2 uvm = vec2( vTriPos.x, -vTriPos.z ) * kx + vec2( 0.37, 0.61 );
    vec3 m = sm < 0.5 ? texture2D( uAMap, uvm ).rgb : texture2D( uBMap, uvm ).rgb;
    vec3 mean = sm < 0.5 ? uAMean : uBMean;
    float lm = clamp( dot( m, vec3( 0.3, 0.59, 0.11 ) ) / max( dot( mean, vec3( 0.3, 0.59, 0.11 ) ), 0.02 ), 0.5, 1.8 );
    diffuseColor.rgb *= mix( 1.0, lm, 0.25 );
    triR *= mix( 1.0, 1.0 / lm, 0.2 );
  }
}`;
const WORLD_NORMAL_FS = /* glsl */`
{
  normal = normalize( ( viewMatrix * vec4( triN, 0.0 ) ).xyz );
}`;

/** Asphalt and cobble by a per vertex surface weight (aSurf: 0 asphalt, 1 cobble), the tint from vertex colour. */
export class RoadMaterial extends VertexPBRMaterial {
  constructor(params) {
    super(params);
    this.userData = { __vrm: true, surface: 'ground', road: true };
    this.name = 'ground';
    if (TEX.asphalt_worn) this.map = TEX.asphalt_worn.map;
  }
  onBeforeCompile(shader) {
    const A = TEX.asphalt_worn, B = TEX.cobble_warm, SA = SETS.asphalt_worn, SB = SETS.cobble_warm;
    if (!A || !B) return;
    shader.uniforms.uAMap = { value: A.map }; shader.uniforms.uANrm = { value: A.normal }; shader.uniforms.uARgh = { value: A.rough || A.normal };
    shader.uniforms.uBMap = { value: B.map }; shader.uniforms.uBNrm = { value: B.normal }; shader.uniforms.uBRgh = { value: B.rough || B.normal };
    shader.uniforms.uAK = { value: new THREE.Vector4(1 / SA.scale, SA.normal, SA.albedo, A.rough ? SA.rough : 0) };
    shader.uniforms.uBK = { value: new THREE.Vector4(1 / SB.scale, SB.normal, SB.albedo, B.rough ? SB.rough : 0) };
    shader.uniforms.uAMean = { value: A.mean }; shader.uniforms.uBMean = { value: B.mean };
    shader.uniforms.uRoughMeans = { value: new THREE.Vector2(A.roughMean, B.roughMean) };
    shader.uniforms.uTriNFlip = { value: NORMAL_FLIP };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>' + ROAD_PARS_VS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRM = aRM;')
      .replace('#include <project_vertex>', '#include <project_vertex>' + ROAD_VS);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>' + ROAD_PARS_FS)
      .replace('#include <map_fragment>', ROAD_FS)
      .replace('#include <roughnessmap_fragment>', TRI_ROUGH_FS)
      .replace('#include <metalnessmap_fragment>', TRI_METAL_FS)
      .replace('#include <normal_fragment_maps>', WORLD_NORMAL_FS + '\n#include <normal_fragment_maps>');
  }
  customProgramCacheKey() { return 'drive_road'; }
}
let ROAD_MAT = null;

/**
 * The road ribbon tiles (track/road.js) take the shared RoadMaterial. Per vertex: `color` (kept if the
 * track wrote paint lines and tyre marks into it, else the surface colour), `aRM` (roughness 0.85),
 * `aSurf` (kept if present, else 0 asphalt / 1 cobble from road.surfaceAt at the vertex's world
 * position; the kerb and pavement strips outside the road take the tile's majority surface).
 * Returns the number of tiles converted.
 */
export function applyRoadMaterial(tiles, road) {
  const list = Array.isArray(tiles) ? tiles : (tiles && tiles.tiles) ? tiles.tiles : (tiles ? [tiles] : []);
  if (!TEX.asphalt_worn || !TEX.cobble_warm) { console.warn('[materials] road: asphalt or cobble set not loaded, tiles keep their material'); return 0; }
  if (!ROAD_MAT) ROAD_MAT = new RoadMaterial();
  const surfAt = road && typeof road.surfaceAt === 'function' ? (x, z) => road.surfaceAt(x, z) : () => 'asphalt';
  const cA = new THREE.Color(PALETTE.asphalt), cC = new THREE.Color(PALETTE.cobble);
  let n = 0;
  for (const t of list) {
    if (!t || !t.isMesh || !t.geometry) continue;
    const g = t.geometry;
    const cnt = g.attributes.position.count;
    let surf = null;
    if (!g.attributes.aSurf) {
      surf = new Float32Array(cnt);
      const tmp = new Float32Array(cnt); let cob = 0, asp = 0;
      const world = ensureVertexAttrs(t, (x, z) => (surfAt(x, z) === 'cobble' ? cC : cA), 0.85);
      for (let i = 0; i < cnt; i++) {
        const s = surfAt(world[i * 3], world[i * 3 + 2]);
        tmp[i] = s === 'cobble' ? 1 : (s === null || s === undefined ? -1 : 0);
        if (tmp[i] === 1) cob++; else if (tmp[i] === 0) asp++;
      }
      const majority = cob > asp ? 1 : 0;
      for (let i = 0; i < cnt; i++) surf[i] = tmp[i] < 0 ? majority : tmp[i];
      g.setAttribute('aSurf', new THREE.BufferAttribute(surf, 1));
    } else {
      ensureVertexAttrs(t, (x, z) => (surfAt(x, z) === 'cobble' ? cC : cA), 0.85);
    }
    t.material = ROAD_MAT;
    t.receiveShadow = true;
    n++;
  }
  return n;
}

// ------------------------------------------------------------------------------------------ terrain
const TERRAIN_SETS = ['grass_dry', 'sand_beach', 'cobble_warm', 'rock_cliff', 'asphalt_worn'];   // aSplat xyzw + asphalt remainder
const TER_PARS_VS = /* glsl */`
attribute vec2 aRM;
attribute vec4 aSplat;
varying vec2 vRM;
varying vec4 vSplat;
varying vec3 vTriPos;
varying vec3 vTriNrm;`;
const TER_VS = /* glsl */`
{
  vec4 triW = modelMatrix * vec4( transformed, 1.0 );
  vTriPos = triW.xyz;
  vTriNrm = normalize( mat3( modelMatrix ) * objectNormal );
  vSplat = aSplat;
}`;
const TER_PARS_FS = /* glsl */`
varying vec2 vRM;
varying vec4 vSplat;
varying vec3 vTriPos;
varying vec3 vTriNrm;
uniform sampler2D uGMap, uGNrm, uSMap, uSNrm, uCMap, uCNrm, uRMap, uRNrm, uPMap, uPNrm;
uniform vec4 uGK, uSK, uCK, uRK, uPK;
uniform vec3 uGMean, uSMean, uCMean, uRMean, uPMean;
uniform float uTriNFlip;`;
function terLayer(P, weight, planar) {
  return /* glsl */`
  if ( ${weight} > 0.002 ) {
    ${triSampleGLSL(P, false, planar)}
    ratio += clamp( alb_${P} / max( u${P}Mean, vec3( 0.02 ) ), 0.2, 3.0 ) * ${weight};
    nrm += nrm_${P} * ${weight};
    float lum_${P} = dot( alb_${P}, vec3( 0.3, 0.59, 0.11 ) ) / max( dot( u${P}Mean, vec3( 0.3, 0.59, 0.11 ) ), 0.02 );
    rgh += clamp( 1.0 / max( lum_${P}, 0.4 ), 0.7, 1.3 ) * ${weight};
  }`;
}
const TER_FS = /* glsl */`
vec3 triN; float triR;
{
  ${TRI_WEIGHTS}
  vec4 sw = clamp( vSplat, 0.0, 1.0 );
  float wP = clamp( 1.0 - ( sw.x + sw.y + sw.z + sw.w ), 0.0, 1.0 );
  float tot = sw.x + sw.y + sw.z + sw.w + wP + 1e-4;
  sw /= tot; wP /= tot;
  vec3 ratio = vec3( 0.0 ); vec3 nrm = vec3( 0.0 ); float rgh = 0.0;
  // rock is triplanar (the cliff face is steep); the flat surfaces are planar on world xz
  ${terLayer('G', 'sw.x', true)}
  ${terLayer('S', 'sw.y', true)}
  ${terLayer('C', 'sw.z', true)}
  ${terLayer('R', 'sw.w', false)}
  ${terLayer('P', 'wP', true)}
  diffuseColor.rgb *= ratio;
  triN = normalize( nrm );
  triR = clamp( rgh, 0.2, 1.6 );
  // macro variation at 1/9 frequency: the dominant layer's tile read large
  {
    float wMax = max( max( sw.x, sw.y ), max( max( sw.z, sw.w ), wP ) );
    vec2 uvm = vec2( vTriPos.x, -vTriPos.z ) * 0.111;
    vec3 m; vec3 mean; float k;
    if ( wMax == sw.x ) { k = uGK.x; m = texture2D( uGMap, uvm * k + 0.37 ).rgb; mean = uGMean; }
    else if ( wMax == sw.y ) { k = uSK.x; m = texture2D( uSMap, uvm * k + 0.37 ).rgb; mean = uSMean; }
    else if ( wMax == sw.z ) { k = uCK.x; m = texture2D( uCMap, uvm * k + 0.37 ).rgb; mean = uCMean; }
    else if ( wMax == sw.w ) { k = uRK.x; m = texture2D( uRMap, uvm * k + 0.37 ).rgb; mean = uRMean; }
    else { k = uPK.x; m = texture2D( uPMap, uvm * k + 0.37 ).rgb; mean = uPMean; }
    float lm = clamp( dot( m, vec3( 0.3, 0.59, 0.11 ) ) / max( dot( mean, vec3( 0.3, 0.59, 0.11 ) ), 0.02 ), 0.5, 1.8 );
    diffuseColor.rgb *= mix( 1.0, lm, 0.28 );
  }
}`;

/** Splat of grass, sand, cobble, rock (aSplat xyzw) and asphalt (the remainder), the tint from vertex colour. */
export class TerrainMaterial extends VertexPBRMaterial {
  constructor(params) {
    super(params);
    this.userData = { __vrm: true, surface: 'ground', terrain: true };
    this.name = 'ground';
    if (TEX.grass_dry) this.map = TEX.grass_dry.map;
  }
  onBeforeCompile(shader) {
    const P = ['G', 'S', 'C', 'R', 'P'];
    for (let i = 0; i < 5; i++) {
      const set = TERRAIN_SETS[i], T = TEX[set], S = SETS[set];
      if (!T) return;
      shader.uniforms[`u${P[i]}Map`] = { value: T.map };
      shader.uniforms[`u${P[i]}Nrm`] = { value: T.normal };
      shader.uniforms[`u${P[i]}K`] = { value: new THREE.Vector4(1 / S.scale, S.normal, S.albedo, 0) };
      shader.uniforms[`u${P[i]}Mean`] = { value: T.mean };
    }
    shader.uniforms.uTriNFlip = { value: NORMAL_FLIP };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>' + TER_PARS_VS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRM = aRM;')
      .replace('#include <project_vertex>', '#include <project_vertex>' + TER_VS);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>' + TER_PARS_FS)
      .replace('#include <map_fragment>', TER_FS)
      .replace('#include <roughnessmap_fragment>', TRI_ROUGH_FS)
      .replace('#include <metalnessmap_fragment>', TRI_METAL_FS)
      .replace('#include <normal_fragment_maps>', WORLD_NORMAL_FS + '\n#include <normal_fragment_maps>');
  }
  customProgramCacheKey() { return 'drive_terrain'; }
}
let TERRAIN_MAT = null;
const PAINT_INDEX = { grass: 0, sand: 1, cobble: 2, rock: 3, asphalt: 4 };

/**
 * The terrain tiles (track/terrain.js) take the shared TerrainMaterial. Per vertex: `color` (kept if
 * the track painted it, else the palette colour of terrain.paintAt), `aRM` (roughness 0.88),
 * `aSplat` vec4 (kept if the track wrote set weights grass, sand, cobble, rock; else one hot from
 * terrain.paintAt, asphalt being the remainder). Returns the number of tiles converted.
 */
export function applyTerrainMaterial(tiles, terrain) {
  const list = Array.isArray(tiles) ? tiles : (tiles && tiles.tiles) ? tiles.tiles : (tiles ? [tiles] : []);
  if (TERRAIN_SETS.some((s) => !TEX[s])) { console.warn('[materials] terrain: a ground set is missing, tiles keep their material'); return 0; }
  if (!TERRAIN_MAT) TERRAIN_MAT = new TerrainMaterial();
  const paintAt = terrain && typeof terrain.paintAt === 'function' ? (x, z) => terrain.paintAt(x, z) : () => 'grass';
  const cols = { grass: new THREE.Color(PALETTE.grass), sand: new THREE.Color(PALETTE.sand), cobble: new THREE.Color(PALETTE.cobble), rock: new THREE.Color(PALETTE.rock), asphalt: new THREE.Color(PALETTE.asphalt) };
  let n = 0;
  for (const t of list) {
    if (!t || !t.isMesh || !t.geometry) continue;
    const g = t.geometry;
    const cnt = g.attributes.position.count;
    const world = ensureVertexAttrs(t, (x, z) => cols[paintAt(x, z)] || cols.grass, 0.88);
    if (!g.attributes.aSplat || g.attributes.aSplat.itemSize !== 4) {
      const sp = new Float32Array(cnt * 4);
      for (let i = 0; i < cnt; i++) {
        const k = PAINT_INDEX[paintAt(world[i * 3], world[i * 3 + 2])];
        if (k !== undefined && k < 4) sp[i * 4 + k] = 1;   // asphalt = all zero
        else if (k === undefined) sp[i * 4] = 1;
      }
      g.setAttribute('aSplat', new THREE.BufferAttribute(sp, 4));
    }
    t.material = TERRAIN_MAT;
    t.receiveShadow = true;
    n++;
  }
  return n;
}
