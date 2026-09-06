/**
 * DRIVE  src/render/lighting.js  (owner: render; lifted from refs/rust17/lighting.js and re-solved
 * for a stylised sunset town)
 *
 * The rig OWNS the ambient term. Two colour temperatures in every frame is the single most
 * measurable difference between AAA kart frames and AI builds, and it is made here, in the lights,
 * never in post:
 *
 *  1. WARM KEY. The sun, 0xffc9a0 at azimuth 250 (west south west, over the sea) and elevation 14,
 *     so a west face is lit and every shadow falls east north east four times the object's height.
 *     CSM from three/addons/csm/CSM.js, ONE cascade: 4096 over 70 m on the high tier (1.7 cm
 *     texels), 1024 over 45 m on the phone. Contact shadow under a kart is this shadow map and the
 *     low sun; no blob, no decal, no baked AO.
 *  2. COOL FILL. scene.environment is the PMREM of the Atlas sky panorama (sky.js builds it and
 *     leaves it in scene.userData.skyEnv), plus a matching HemisphereLight (soft blue sky over a warm
 *     neutral ground). Without the panorama (?sky=0, or a load failure) an analytic environment of
 *     the ATMOS palette takes its place. Since round 1 the fill is MOST of the light on a shaded
 *     face: a fully shaded road lands at sRGB luma 80 to 120 and cooler than lit (B minus R +20 or
 *     more), the bar's blue grey mid tone, never the near black of round 0 (see the solve table below).
 *  3. GROUND BOUNCE. A warm lit ground term added to the irradiance on vertical faces only (a wall
 *     in shade sees half a hemisphere of sunlit cobble and sand; an underside sees its own shadow).
 *  4. AERIAL PERSPECTIVE, not flat fog. Every material's fog chunk is replaced so the haze colour
 *     is the sky radiance in the pixel's view direction (from the ATMOS stops, which sky.js refits
 *     to the rendered panorama) and the amount grows with distance. scene.fog stays set with its
 *     colour in sRGB (setHex(c, SRGBColorSpace)) so sprites and unpatched materials fog to the
 *     horizon colour, not to a brighter linear value.
 *
 * OFF for this set (Rust 17 had them): the dust film and the south face bleach. The style lock
 * bakes edge highlights, base bands and bleached tops into the assets; a clean town holds no dust.
 *
 * Renderer settings are fixed here, once: sRGB output, ACES filmic, EXPOSURE, PCFSoft shadows.
 *
 *   const rig = createLightingRig(THREE, { scene, renderer, camera, tier });
 *   rig.update(camera);   per frame, after everything moved and before post.render()
 *   rig.refresh();        after the level build, after karts load: patches new materials
 *   rig.patchFog(mat);    the sea and any custom ShaderMaterial that carries three's fog chunks
 *   rig.setFillOccluders([{ x, y, z, yaw, hw, hh, hd, strength }]);   optional, see FILL OCCLUDERS
 */
import { CSM } from 'three/addons/csm/CSM.js';
import { getTier } from './quality.js?v=r2-20260906125925';

/** Sun placement, TRACK-PLAN section 1 and 9. */
export const SUN_AZIMUTH_DEG = 250;
export const SUN_ELEVATION_DEG = 14;
export const SUN_COLOR = 0xffe2c0;     // r1 was 0xffc9a0: linear G/R 0.58 capped lit whitewash at luma 226 whatever the intensity (see the round 2 solve)
/**
 * Solved in work/render/test.html against a whitewash 0xf1e6d2 wall facing the sun and a cobble
 * 0x9a8f80 ground plane half in shadow (work/render/NOTES.md holds the probe numbers): lit whitewash
 * at sRGB luma 200 to 225, shade on cobble at 0.38 to 0.48 of lit cobble.
 */
/**
 * ROUND 1 RE-SOLVE (fix1_render, the critic's deciding property: "everything in shade crushes to near
 * black while whitewash clips to white; the bar's shade is a blue grey mid tone"). The round 0 solve
 * targeted shade at 0.38 to 0.48 of lit cobble, which under a 14 degree sun put a fully shaded road at
 * sRGB luma 15 to 20 (work/fix1_render/sw2_S0_p0.22.png, luma grid). Measured in the real frame at
 * progress 0.22 (lower street, road in the shadow of the house row) with tools/shot.mjs and
 * work/fix1_render/shade.py, the bar's own shaded road patches sitting at luma 36 to 147, median 77:
 *
 *   hemi  env   sun  sky/ground colour      shaded cobble luma / B-R   sunlit plaster
 *   0.34  0.10  4.2  8aa6dc / 5c5e66 (r0)   16 to 20  / +27            204
 *   1.5   0.35  3.0  8aa6dc / 5c5e66        68        / +47            200
 *   1.8   0.35  3.0  a9bbd9 / 7a6e62        88        / +29            200
 *   2.2   0.30  3.0  93acd8 / 6e6660        86        / +40            202
 *   2.0   0.35  3.2  9fb6dc / 746e6a (r1)   see work/fix1_render/NOTES.md, the committed solve
 *
 * The fill is now most of the light on a shaded face, so its colour is what shade LOOKS like: the sky
 * term a soft blue (a notch lighter than the style lock's 0x8fa9d6 so shade is blue grey, not blue), the
 * ground term a warm neutral so a wall in shade takes a little of the lit cobble beside it and reads
 * cooler than its lit face without going the same blue as the road.
 */
/**
 * ROUND 2 RE-SOLVE (fix2_render, the critic's deciding property: "nothing in the frame ever gets bright or
 * vivid: p98 luma 203 to 231 against the bar's 225 to 255, pixels above 245 luma 0.1 percent against 1.1;
 * the sun never lands on anything"). Measured on eight stills at the critic's lap fractions (work/fix2_render/
 * sweep.mjs, HUD hidden, work/fix2_render/measure.py on the body rows 0.14 to 0.84):
 *
 *   sun   colour  exp   hemi  env  wrap  skygain  p98 med  frames p98>=235  frames >245 over 0.5pct
 *   3.2   ffc9a0  0.96  2.0   .35  1     1.05     208      0 of 8           0 of 8      (round 1)
 *   6.0   ffd9b8  0.96  2.0   .35  1     1.05     220      2 of 8           2 of 8
 *   7.5   ffdcc0  0.96  2.0   .35  1     1.05     227      3 of 8           2 of 8
 *   10    ffe4c4  1.0   2.2   .40  1     1.05     236      4 of 8           2 of 8
 *   12    ffe4c4  1.0   2.2   .40  1     1.05     241      5 of 8           4 of 8
 *   11    ffe4c4  1.0   2.2   .40  0.7   1.2      241      6 of 8           4 of 8
 *   12.5  ffe4c4  1.0   2.0   .40  0.65  1.25     241      7 of 8           6 of 8      (this solve)
 *
 * Why the sun alone stalled at 5 of 8: three frames look AWAY from the 14 degree sun (the lower street and
 * the hillside heading east), where every visible face is a top or a side at 24 to 33 percent of the key,
 * and ACES needs about 2.6 linear for 245 sRGB. Three levers, all here: the sun colour (0xffc9a0 is linear
 * G/R 0.58, so luma, which is 72 percent green, could not follow R past 226; 0xffe2c0 is 0.77), the SUN_WRAP
 * softening below (tops at 40 percent of the key instead of 24), and the sky gain (sky.js) so the cumulus
 * tops are sunlit things too. The fill (hemisphere 2.0, PMREM 0.4) stays where round 1 put it: shaded cobble
 * 85 to 110, the bar's blue grey mid tone, and B minus R about +35.
 */
export const SUN_INTENSITY = 12.0;     // r1 was 3.2 (whitewash 205): round 2 solve, lit whitewash 240 to 250 under ACES, see the table above
export const SKY_COLOR = 0x9fb6dc;      // hemisphere sky term (r0 0x8aa6dc): soft blue, the colour of shade on the road
export const GROUND_COLOR = 0x5e6678;   // the ground a vertical face or an underside sees (r1 0x746e6a warm neutral): cool grey blue since round 2 so a shaded WALL is cooler than its lit face, not only the road (critic item 7); the bounce term below keeps its base warm
export const SKY_INTENSITY = 2.0;       // r0 was 0.34: shaded cobble at luma 85 to 95, B minus R about +35
export const ENV_INTENSITY = 0.4;       // r0 was 0.10, r1 0.35: the PMREM of the cumulus panorama (sky/sky_pano_*.webp, round 1) carries cream cloud tops and the horizon glow, so it is less blue than the round 0 sky and can run higher
/** Lit cobble and sand bounce onto vertical faces, linear irradiance. Warm, small: the sun is at 14 degrees so flat ground takes a quarter of the key. */
export const BOUNCE_COLOR = [0.045, 0.030, 0.016];   // r1 0.030/0.020/0.011 under a 3.2 sun; the sun is 3.75x stronger now and this is 0.15 of the physical bounce: most ground beside a wall is in that wall's shadow, and the target shade is cool
export const BOUNCE_UNDER = 0.25;
export const FOG_COLOR = 0xf0dcc0;      // plain Fog colour for unpatched materials (sRGB): the horizon haze
export const FOG_NEAR = 60;
export const FOG_FAR = 520;
export const EXPOSURE = 1.0;            // r1 0.96; the exposure barely moves the top of the ACES curve (0.92 to 1.0 was 3 luma on lit whitewash), the sun does

/**
 * Atmosphere palette, LINEAR radiance before the ACES curve at EXPOSURE. These are the analytic
 * defaults for a golden hour Mediterranean sky; sky.js REFITS every stop to the rendered panorama
 * through applyAtmosFit() so the aerial perspective, the far hills and the fill fade toward the
 * sky that is actually behind them. The sRGB written beside each is the default's display value.
 */
export const ATMOS = {
  horizon: [1.250, 0.780, 0.480],   // 238,214,186 pale apricot at 0 degrees
  low:     [0.640, 0.520, 0.430],   // 222,208,190 at 12 degrees
  mid:     [0.330, 0.360, 0.420],   // 178,188,205 at 35 degrees, the top of a level frame: the blue begins
  high:    [0.210, 0.270, 0.390],   // 138,158,192 at 55 degrees
  zenith:  [0.140, 0.200, 0.340],   // 100,126,178 overhead
  haze:    [1.350, 0.850, 0.520],   // the horizon band, thickest at 0, gone by 8 degrees
  below:   [0.700, 0.560, 0.450],   // the dome under the horizon: the far sea's haze
  sunGlow: [1.0, 0.70, 0.40],
  cloud:   [1.600, 1.250, 1.050],
};

/**
 * Direction FROM the origin TOWARD the sun, unit length. Azimuth from north (-Z) clockwise seen from
 * above; east (+X) is 90; 250 is west south west so x is negative and z positive.
 */
export function sunDirection(THREE, out) {
  const az = SUN_AZIMUTH_DEG * Math.PI / 180, el = SUN_ELEVATION_DEG * Math.PI / 180;
  const c = Math.cos(el);
  const v = out || new THREE.Vector3();
  return v.set(Math.sin(az) * c, Math.sin(el), -Math.cos(az) * c).normalize();
}

/**
 * GLSL atmosphere model shared by the analytic sky dome (sky.js fallback), the aerial perspective in
 * every material, the hills ring and the analytic environment map.
 *   atmosSky(dir, clouds01): linear radiance of the sky in a direction.
 *   aerialAmount(depth, dirY): 0..1 haze mix for a fragment.
 */
export const ATMOS_UNIFORMS_GLSL = /* glsl */`
uniform vec3 uAtmHorizon, uAtmLow, uAtmMid, uAtmHigh, uAtmZenith, uAtmHaze, uAtmBelow, uAtmSunGlow, uAtmCloud;
uniform vec3 uAtmSunDir;
uniform float uAtmGlow, uAtmTime, uAerDensity, uAerLift, uAerStart;
`;
export const ATMOS_GLSL = /* glsl */`
float atmHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float atmNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(atmHash(i), atmHash(i + vec2(1.0, 0.0)), f.x),
             mix(atmHash(i + vec2(0.0, 1.0)), atmHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec3 atmosSky(vec3 d, float clouds) {
  float y = clamp(d.y, -1.0, 1.0);
  float el = asin(y);
  vec3 col = mix(uAtmHorizon, uAtmLow, smoothstep(0.0, 0.21, el));
  col = mix(col, uAtmMid, smoothstep(0.17, 0.61, el));
  col = mix(col, uAtmHigh, smoothstep(0.58, 0.96, el));
  col = mix(col, uAtmZenith, smoothstep(0.90, 1.55, el));
  float band = pow(1.0 - clamp(el / 0.14, 0.0, 1.0), 1.7);
  col = mix(col, uAtmHaze, band * 0.8);
  float sd = max(dot(d, uAtmSunDir), 0.0);
  float glow = pow(sd, 6.0) * 0.18 + pow(sd, 48.0) * 0.5;
  float az = max(dot(normalize(vec3(d.x, 0.0, d.z) + 1e-5), normalize(vec3(uAtmSunDir.x, 0.0, uAtmSunDir.z))), 0.0);
  glow += pow(az, 3.0) * 0.10 * (1.0 - smoothstep(0.0, 0.5, el));
  col += uAtmSunGlow * glow * uAtmGlow;
  if (clouds > 0.0) {
    vec2 p = vec2(atan(d.x, d.z) * 3.2, el * 14.0);
    p.x += uAtmTime * 0.004;
    float n = atmNoise(p * vec2(0.55, 2.0)) * 0.55 + atmNoise(p * vec2(1.4, 4.6) + 3.7) * 0.30 + atmNoise(p * vec2(3.2, 9.0) + 9.1) * 0.15;
    float win = smoothstep(0.14, 0.30, el) * (1.0 - smoothstep(0.55, 0.85, el));
    float c = smoothstep(0.64, 0.82, n) * win * clouds;
    vec3 cc = uAtmCloud + uAtmSunGlow * pow(sd, 3.0) * 0.20;
    col = mix(col, cc, c * 0.40);
  }
  col = mix(col, uAtmBelow, smoothstep(0.004, -0.02, y));
  return col;
}
float aerialAmount(float depth, float dirY) {
  float t = max(depth - uAerStart, 0.0);
  float k = uAerDensity * (1.0 + uAerLift * clamp(dirY, 0.0, 0.5) * 2.0);
  return 1.0 - exp(-t * k);
}
`;

/** One shared set of atmosphere uniforms; every shader that includes ATMOS_GLSL gets these same objects. */
export function createAtmosUniforms(THREE, sunDir) {
  const c = (a) => ({ value: new THREE.Color(a[0], a[1], a[2]) });
  return {
    uAtmHorizon: c(ATMOS.horizon), uAtmLow: c(ATMOS.low), uAtmMid: c(ATMOS.mid), uAtmHigh: c(ATMOS.high), uAtmZenith: c(ATMOS.zenith),
    uAtmHaze: c(ATMOS.haze), uAtmBelow: c(ATMOS.below), uAtmSunGlow: c(ATMOS.sunGlow), uAtmCloud: c(ATMOS.cloud),
    uAtmSunDir: { value: sunDir },
    uAtmGlow: { value: 1.0 },
    uAtmTime: { value: 0 },
    // the map is 410 m across; the lighthouse seen from the harbour (300 m) keeps 45 percent of its own colour,
    // the far headlands ring at 700 m is 80 percent sky
    uAerDensity: { value: 0.0021 },
    uAerLift: { value: 1.2 },
    uAerStart: { value: 8.0 },
  };
}
let _shared = null;
export function atmosUniforms(THREE) {
  if (!_shared) _shared = createAtmosUniforms(THREE, sunDirection(THREE));
  return _shared;
}
/**
 * sky.js hands the stops it read off the rendered panorama here: { horizon, low, mid, high, zenith,
 * haze, below, sunGlow } as linear [r, g, b] (any subset). ATMOS and the live uniforms both change,
 * so a rig built before or after the fit sees the same atmosphere.
 */
const STOP_UNIFORM = { horizon: 'uAtmHorizon', low: 'uAtmLow', mid: 'uAtmMid', high: 'uAtmHigh', zenith: 'uAtmZenith', haze: 'uAtmHaze', below: 'uAtmBelow', sunGlow: 'uAtmSunGlow', cloud: 'uAtmCloud' };
export function applyAtmosFit(fit) {
  if (!fit) return false;
  let n = 0;
  for (const k of Object.keys(STOP_UNIFORM)) {
    const v = fit[k];
    if (!v || v.length !== 3 || !v.every((x) => Number.isFinite(x))) continue;
    ATMOS[k] = [v[0], v[1], v[2]];
    if (_shared) _shared[STOP_UNIFORM[k]].value.setRGB(v[0], v[1], v[2]);
    n++;
  }
  return n > 0;
}

function isLit(m) {
  return !!m && (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial);
}
/** Materials whose shader has the standard fog chunks: those get the aerial perspective. */
function isFoggable(m) {
  return !!m && m.fog !== false && (isLit(m) || m.isMeshBasicMaterial || (m.isShaderMaterial && m.fog === true));
}

/**
 * The aerial perspective patch. Vertex: a world space view vector varying. Fragment: replace
 * fog_fragment with a mix toward the sky radiance in that direction. Runs before tonemapping, in
 * linear HDR, so the dome and the hazed terrain agree at the horizon.
 */
function aerialPatch(shader, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <fog_pars_vertex>', '#include <fog_pars_vertex>\nvarying vec3 vAerDir;')
    .replace('#include <fog_vertex>', '#include <fog_vertex>\nvAerDir = transpose(mat3(viewMatrix)) * mvPosition.xyz;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <fog_pars_fragment>', '#include <fog_pars_fragment>\nvarying vec3 vAerDir;\n' + ATMOS_UNIFORMS_GLSL + ATMOS_GLSL)
    .replace('#include <fog_fragment>', /* glsl */`
#ifdef USE_FOG
  {
    vec3 aerD = normalize(vAerDir);
    float aerA = aerialAmount(vFogDepth, aerD.y);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, atmosSky(aerD, 0.0), aerA);
  }
#endif`);
}

/**
 * Safety net for bake.js materials: if a VertexPBR material's hook did not expand the roughness and
 * metalness includes (three 0.169 hands onBeforeCompile the source UNEXPANDED), do it here so no
 * baked object renders as a rough metal. A no op when bake.js has already done it.
 */
const VRM_ROUGH = /* glsl */`
float roughnessFactor = vRM.x;
#ifdef USE_ROUGHNESSMAP
  vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
  roughnessFactor *= texelRoughness.g;
#endif`;
const VRM_METAL = /* glsl */`
float metalnessFactor = vRM.y;
#ifdef USE_METALNESSMAP
  vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
  metalnessFactor *= texelMetalness.b;
#endif`;
function vrmPatch(shader) {
  if (!shader.fragmentShader.includes('varying vec2 vRM;')) return false;
  if (!shader.fragmentShader.includes('#include <roughnessmap_fragment>')) return false;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <roughnessmap_fragment>', VRM_ROUGH)
    .replace('#include <metalnessmap_fragment>', VRM_METAL);
  return true;
}

/**
 * The ground bounce. Added to `irradiance` right after three's lights_fragment_begin, where the
 * ambient and hemisphere terms have just been summed and before lights_fragment_end folds it through
 * the material's Lambert term, so it is lit exactly as the hemisphere light is (albedo, metalness all
 * apply) and is not a tint. Weight by the WORLD normal: 1 on a vertical face, 0 facing up (cobble in
 * shadow sees only sky), BOUNCE_UNDER facing down.
 */
const BOUNCE_PARS_FS = /* glsl */`
uniform vec3 uBounce;
uniform float uBounceUnder;`;
const BOUNCE_FS = /* glsl */`
{
  vec3 bN = normalize( ( vec4( geometryNormal, 0.0 ) * viewMatrix ).xyz );
  float bW = smoothstep( 0.15, 0.6, 1.0 - abs( bN.y ) ) + clamp( -bN.y, 0.0, 1.0 ) * uBounceUnder;
  irradiance += uBounce * bW;
}`;
const _bounceUniforms = {};
function bounceUniforms(THREE) {
  if (!_bounceUniforms.uBounce) {
    const k = +(knob('bouncek') || 1);   // A/B scale for the solve
    _bounceUniforms.uBounce = { value: new THREE.Color(BOUNCE_COLOR[0] * k, BOUNCE_COLOR[1] * k, BOUNCE_COLOR[2] * k) };
    _bounceUniforms.uBounceUnder = { value: BOUNCE_UNDER };
  }
  return _bounceUniforms;
}
/**
 * SUN WRAP (fix2_render, optional, default off unless SUN_WRAP < 1): a stylised softening of the sun's
 * diffuse term, irradiance = pow(dotNL, SUN_WRAP) instead of dotNL. Under a 14 degree sun every up facing
 * surface (road, kerb top, bonnet) takes 24 percent of the key and can never read sunlit; with 0.7 it takes
 * 37 percent, a face 20 degrees off the sun 47 percent, a face square to the sun still 100, and a face turned
 * away still nothing (the shade side keeps the cool fill only). The CSM shadow is untouched. `?wrap=1` is the
 * plain Lambert A/B.
 */
export const SUN_WRAP = 0.65;
/** Cap on a material's own envMapIntensity (see setupMaterial): 0.8 x the rig's 0.4 fill is the 0.3 the kart paint was tuned to. */
export const PAINT_ENV_CAP = 0.8;
let envCapped = 0;
const WRAP_PARS_FS = /* glsl */`
uniform float uSunWrap;`;
function wrapPatch(shader, THREE, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  const chunk = THREE.ShaderChunk.lights_physical_pars_fragment;
  const line = 'vec3 irradiance = dotNL * directLight.color;';
  if (!chunk || !chunk.includes(line) || !shader.fragmentShader.includes('#include <lights_physical_pars_fragment>')) return false;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>' + WRAP_PARS_FS)
    .replace('#include <lights_physical_pars_fragment>', chunk.replace(line, 'vec3 irradiance = pow( dotNL, uSunWrap ) * directLight.color;'));
  return true;
}
let _wrapU = null;
function wrapUniforms() {
  if (!_wrapU) _wrapU = { uSunWrap: { value: knob('wrap') !== null ? +knob('wrap') : SUN_WRAP } };
  return _wrapU;
}
function bouncePatch(shader, uniforms) {
  // the CSM hook has already replaced lights_pars_begin and lights_fragment_begin with expanded text, so
  // the hooks here are the neighbours that survive: `common` for the uniforms and `lights_fragment_maps`
  Object.assign(shader.uniforms, uniforms);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>' + BOUNCE_PARS_FS)
    .replace('#include <lights_fragment_maps>', BOUNCE_FS + '\n#include <lights_fragment_maps>');
}

/**
 * FILL OCCLUDERS (round 1). A hemisphere light and an environment map have no occlusion, and with the
 * fill now most of the light on a shaded face the inside of the rock tunnel (section H) rendered as a
 * sky blue road under a warm vault (work/fix1_render/sky_U3_p0.80.png). Up to two oriented boxes scale
 * the indirect terms (hemisphere, ambient, ground bounce, PMREM diffuse and specular) down inside them,
 * soft over the last 40 percent of the box along its axis so the fill returns toward the portals.
 * The direct sun is untouched (the CSM shadow already handles it). rig.setFillOccluders([...]) sets
 * them; by default the rig reads the tunnel from level/placements LANDMARKS and the road axis from
 * track/spline (dynamic imports, so a build without those exports simply has no occluder).
 */
const OCC_N = 2;
const OCC_PARS_VS = /* glsl */`
varying vec3 vOccW;`;
const OCC_VS = /* glsl */`
{
  vec4 occWP = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    occWP = batchingMatrix * occWP;
  #endif
  #ifdef USE_INSTANCING
    occWP = instanceMatrix * occWP;
  #endif
  vOccW = (modelMatrix * occWP).xyz;
}`;
const OCC_PARS_FS = /* glsl */`
varying vec3 vOccW;
uniform vec4 uOccBox[${OCC_N}];    // centre xyz, yaw
uniform vec4 uOccHalf[${OCC_N}];   // half extents xyz, strength (0 = unused)
float fillOcclusion() {
  float occ = 1.0;
  for (int i = 0; i < ${OCC_N}; i++) {
    vec4 ob = uOccBox[i]; vec4 oh = uOccHalf[i];
    if (oh.w <= 0.0) continue;
    vec3 d = vOccW - ob.xyz;
    float c = cos(ob.w), s = sin(ob.w);
    vec3 l = vec3(c * d.x - s * d.z, d.y, s * d.x + c * d.z);
    vec3 q = abs(l) / max(oh.xyz, vec3(0.01));
    float inside = (1.0 - smoothstep(0.6, 1.05, q.z)) * (1.0 - smoothstep(0.9, 1.1, max(q.x, q.y)));
    occ *= 1.0 - oh.w * inside;
  }
  return occ;
}`;
const OCC_FS = /* glsl */`
{
  float occF = fillOcclusion();
  #if defined( RE_IndirectDiffuse )
    irradiance *= occF;
    iblIrradiance *= occF;
  #endif
  #if defined( RE_IndirectSpecular )
    radiance *= occF;
  #endif
}`;
let _occU = null;
function occUniforms(THREE) {
  if (!_occU) {
    _occU = {
      uOccBox: { value: Array.from({ length: OCC_N }, () => new THREE.Vector4(0, 0, 0, 0)) },
      uOccHalf: { value: Array.from({ length: OCC_N }, () => new THREE.Vector4(1, 1, 1, 0)) },
    };
  }
  return _occU;
}
function occPatch(shader, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>' + OCC_PARS_VS)
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>' + OCC_VS);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>' + OCC_PARS_FS)
    .replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>' + OCC_FS);
}
/** The default occluder: the rock tunnel, from the level plan and the road axis through it. */
async function defaultOccluders(THREE) {
  try {
    const [pl, sp] = await Promise.all([import('../level/placements.js?v=r2-20260906125925'), import('../track/spline.js?v=r2-20260906125925')]);
    const t = pl.LANDMARKS && pl.LANDMARKS.tunnel, spline = sp.SPLINE;
    if (!t || !spline || typeof spline.nearest !== 'function') return [];
    const n = spline.nearest(t.x, t.z);
    const r = spline.samples[n.index];
    // rock_tunnel is 20 x 24 x 12 with its axis along the road, portal clear 12 wide and 6 high
    return [{ x: t.x, y: r.y + 3.0, z: t.z, yaw: Math.atan2(r.tx, r.tz), hw: 7.0, hh: 3.8, hd: 12.5, strength: 0.8 }];
  } catch (e) { return []; }
}

/** Debug knobs for A/B in the critic rounds: `?bounce=0`, `?fade=0`, `?occ=0`, `?exposure=0.8`, `?hemi=2&env=0.35&sun=3.2`, `?hemic=9fb6dc&groundc=746e6a`. */
function knob(name) {
  try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
}

/**
 * Cull fade: meshes under a group whose name ends in '#clutter', '#nocast' or '#fine' get a copy of
 * their material that dithers the surface out over the last metres before the level's distance
 * switch (Bayer 4 x 4 on the fragment position, in world distance), so a hidden group is never seen
 * to pop. Same draw calls, one extra program variant; shadows are untouched. The level builder may
 * use these group names or ignore them; rig.setCullFade() sets the distances.
 */
const FADE_W = { clutter: 10, scatter: 8, fine: 6 };
function defaultCullFade(T) {
  const phone = T.name === 'phone';
  const c = +(knob('far') || (phone ? 140 : 220)), n = +(knob('farn') || (phone ? 90 : 140)), f = +(knob('finecull') || (phone ? 40 : 60));
  return { clutter: [c - FADE_W.clutter, c], scatter: [n - FADE_W.scatter, n], fine: [f - FADE_W.fine, f] };
}
const FADE_PARS_VS = /* glsl */`
varying float vFadeD;`;
const FADE_VS = /* glsl */`
{
  vec4 fadeWP = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    fadeWP = batchingMatrix * fadeWP;
  #endif
  #ifdef USE_INSTANCING
    fadeWP = instanceMatrix * fadeWP;
  #endif
  fadeWP = modelMatrix * fadeWP;
  vFadeD = length(fadeWP.xyz - cameraPosition);
}`;
const FADE_PARS_FS = /* glsl */`
varying float vFadeD;
uniform vec2 uFadeRange;
float fadeBayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float fadeBayer4(vec2 a) { return fadeBayer2(0.5 * a) * 0.25 + fadeBayer2(a); }`;
const FADE_FS = /* glsl */`
{
  float fadeT = smoothstep(uFadeRange.x, uFadeRange.y, vFadeD);
  if (fadeT > 0.0 && fadeBayer4(gl_FragCoord.xy) < fadeT) discard;
}`;
function fadePatch(shader, uniform) {
  shader.uniforms.uFadeRange = uniform;
  shader.vertexShader = shader.vertexShader
    .replace('#include <fog_pars_vertex>', '#include <fog_pars_vertex>' + FADE_PARS_VS)
    .replace('#include <fog_vertex>', '#include <fog_vertex>' + FADE_VS);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <fog_pars_fragment>', '#include <fog_pars_fragment>' + FADE_PARS_FS)
    .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + FADE_FS);
}
function fadeGroupOf(o) {
  const pn = o.parent ? String(o.parent.name) : '';
  if (pn.endsWith('#clutter')) return 'clutter';
  if (pn.endsWith('#nocast')) return 'scatter';
  if (pn.endsWith('#fine')) return 'fine';
  return null;
}

/**
 * The analytic environment map, used only when the panorama is not available: the ATMOS sky above
 * the horizon (dimmed: the sky as a light, not as a picture) and a warm ground below, filtered by
 * PMREM. Built once.
 */
export const ENV_GROUND = [0.120, 0.100, 0.080];
function buildAnalyticEnvironment(THREE, renderer) {
  const u = atmosUniforms(THREE);
  const envScene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...u, uEnvGround: { value: new THREE.Color(...ENV_GROUND) } },
    vertexShader: /* glsl */`varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: ATMOS_UNIFORMS_GLSL + ATMOS_GLSL + /* glsl */`
uniform vec3 uEnvGround;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 sky = atmosSky(d, 0.0) * 0.55;
  float g = smoothstep(0.10, -0.06, d.y);
  gl_FragColor = vec4(mix(sky, uEnvGround, g), 1.0);
}`,
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), mat);
  envScene.add(dome);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let tex = null;
  try {
    const rt = pmrem.fromScene(envScene, 0.02, 1, 100);
    tex = rt.texture;
  } catch (e) { console.warn('[lighting] analytic environment build failed', e && e.message); }
  pmrem.dispose(); dome.geometry.dispose(); mat.dispose();
  return tex;
}

export function createLightingRig(THREE, { scene, renderer, camera, tier, envMap = null }) {
  const T = getTier(tier);

  // Fixed renderer settings. Set here, once, so no other module can leave the frame in linear space
  // or with a different curve.
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = +(knob('exposure') || EXPOSURE);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const sunDir = sunDirection(THREE);
  const lightDir = sunDir.clone().negate();   // CSM wants the direction light travels
  const atm = atmosUniforms(THREE);

  // Cascaded sun. `lightMargin` is how far behind the cascade box the shadow camera sits along the
  // light direction: at 14 degrees a 24 m church throws 96 m, so casters far up sun of the box still
  // land in it.
  const csm = new CSM({
    camera,
    parent: scene,
    cascades: T.cascades,
    maxFar: T.shadowDist,
    mode: 'practical',
    shadowMapSize: T.shadowMap,
    shadowBias: -0.0002,
    lightDirection: lightDir,
    lightIntensity: +(knob('sun') || SUN_INTENSITY),
    lightNear: 1,
    lightFar: 500,
    lightMargin: 110,
  });
  csm.fade = true;
  const sunHex = knob('sunc') ? parseInt(knob('sunc'), 16) : SUN_COLOR;   // A/B: `?sunc=ffd9b8`
  for (const l of csm.lights) {
    l.color.setHex(sunHex);
    l.shadow.normalBias = T.name === 'phone' ? 0.08 : 0.035;
    l.name = 'sun';
  }
  csm.updateFrustums();
  const sun = csm.lights[0];

  // The cool fill, part one: the hemisphere light. Part two is the environment map below.
  const sky = new THREE.HemisphereLight(SKY_COLOR, GROUND_COLOR, +(knob('hemi') || SKY_INTENSITY));
  if (knob('hemic')) sky.color.setHex(parseInt(knob('hemic'), 16));          // A/B: `?hemic=a9bbd9&groundc=7a6e62`
  if (knob('groundc')) sky.groundColor.setHex(parseInt(knob('groundc'), 16));
  sky.position.set(0, 50, 0);
  sky.name = 'skyfill';
  scene.add(sky);

  // The environment map: the panorama PMREM from sky.js when it exists, else the analytic one.
  let envTex = envMap || (scene.userData && scene.userData.skyEnv) || null;
  let envIsPanorama = !!envTex;
  if (!envTex) { envTex = buildAnalyticEnvironment(THREE, renderer); }
  const envIntensity = +(knob('env') || (envIsPanorama ? ENV_INTENSITY : 1.0));
  function applyEnvironment() {
    // the panorama may finish after the rig was built (createSky resolves first in main.js, but a
    // late fit is harmless): adopt it once
    const late = scene.userData && scene.userData.skyEnv;
    if (late && late !== envTex && !envIsPanorama) { envTex = late; envIsPanorama = true; scene.environmentIntensity = +(knob('env') || ENV_INTENSITY); }
    if (!envTex) return;
    if (scene.environment !== envTex) {
      scene.environment = envTex;
      scene.environmentIntensity = envIntensity;
    }
  }
  applyEnvironment();

  // A plain Fog keeps USE_FOG defined on every material and gives sprites and anything unpatched a
  // horizon coloured haze. Colour set in sRGB, or distant objects fade brighter than the sky.
  const fog = new THREE.Fog(0xffffff, FOG_NEAR, FOG_FAR);
  fog.color.setHex(FOG_COLOR, THREE.SRGBColorSpace);
  if (T.fog !== false) scene.fog = fog;
  if (!scene.background) { scene.background = new THREE.Color(); scene.background.setHex(FOG_COLOR, THREE.SRGBColorSpace); }

  // Material setup. Every lit material goes through csm.setupMaterial once and every foggable
  // material gets the aerial perspective patch. A WeakSet remembers which ones are done.
  const done = new WeakSet();
  const cullFade = defaultCullFade(T);
  const fadeU = { clutter: { value: new THREE.Vector2(...cullFade.clutter) }, scatter: { value: new THREE.Vector2(...cullFade.scatter) }, fine: { value: new THREE.Vector2(...cullFade.fine) } };
  const fadeVariants = new WeakMap();
  const useBounce = knob('bounce') !== '0';
  const useOcc = knob('occ') !== '0';
  const occU = occUniforms(THREE);
  function setupMaterial(m) {
    if (!m || done.has(m)) return false;
    const lit = isLit(m), foggable = isFoggable(m);
    if (!lit && !foggable) return false;
    done.add(m);
    // The rig owns the fill balance (ARCHITECTURE: the PMREM "at low intensity for the fill"). A material
    // that carries its own envMapIntensity multiplier above 1 was calibrated against round 0's
    // environmentIntensity 0.10 (kartview's PaintMaterial: 3.0, "paint reflects more sky than plaster");
    // against the round 1 and 2 fill (0.35 to 0.40) that is a full strength sky mirror and the red kart's
    // sunlit side read salmon (work/fix2_render/cmp6.png rows 1 and 2, `?paint=0` A/B). Cap it here so the
    // product stays what it was tuned for; `?paintenv=3` restores the raw value for the A/B.
    if (lit && typeof m.envMapIntensity === 'number' && m.envMapIntensity > 1) {
      const cap = knob('paintenv') !== null ? +knob('paintenv') : PAINT_ENV_CAP;
      if (m.envMapIntensity > cap) { m.envMapIntensity = cap; envCapped++; }
    }
    const bounce = lit && useBounce ? bounceUniforms(THREE) : null;
    const wrap = lit && m.isMeshStandardMaterial && wrapUniforms().uSunWrap.value !== 1 ? wrapUniforms() : null;
    const occ = lit && useOcc ? occU : null;
    const vrm = lit && !!m.isVertexPBR;
    const fade = m.userData && m.userData.__cullFade && knob('fade') !== '0' ? fadeU[m.userData.__cullFade] : null;
    // CSM replaces onBeforeCompile. If a module (materials, terrain, fx) already hooked the material,
    // keep its hook and run all of them, and keep the program cache key distinct so two materials
    // with different hooks do not share a program.
    const prevHook = m.onBeforeCompile;
    const prevKey = m.customProgramCacheKey ? m.customProgramCacheKey.call(m) : '';
    const hasPrev = typeof prevHook === 'function' && prevHook !== THREE.Material.prototype.onBeforeCompile;
    let csmHook = null;
    if (lit) { csm.setupMaterial(m); csmHook = m.onBeforeCompile; }
    m.onBeforeCompile = function (shader, r) {
      if (hasPrev) prevHook.call(this, shader, r);
      if (csmHook) csmHook.call(this, shader, r);
      if (vrm) vrmPatch(shader);
      if (bounce) bouncePatch(shader, bounce);
      if (wrap) wrapPatch(shader, THREE, wrap);
      if (occ) occPatch(shader, occ);
      if (foggable) aerialPatch(shader, atm);
      if (fade) fadePatch(shader, fade);
    };
    m.customProgramCacheKey = () => (hasPrev ? prevKey : '') + (csmHook ? '|csm' + T.cascades : '') + (vrm ? '|vrmfix' : '') + (bounce ? '|bounce' : '') + (wrap ? '|wrap' : '') + (occ ? '|occ' : '') + (foggable ? '|aer' : '') + (fade ? '|fade' : '');
    m.needsUpdate = true;
    return true;
  }
  /** The fade copy of a material for a cull group; made once per source material and group. */
  function fadeVariant(m, group) {
    if (!m || Array.isArray(m) || !isLit(m)) return m;
    if (m.userData && m.userData.__cullFade) return m;
    let v = fadeVariants.get(m);
    if (!v) { v = {}; fadeVariants.set(m, v); }
    if (!v[group]) {
      const c = m.clone();
      c.userData = Object.assign({}, m.userData, { __cullFade: group });
      c.name = m.name;
      v[group] = c;
    }
    return v[group];
  }
  function refresh(root = scene) {
    applyEnvironment();
    let n = 0;
    root.traverse((o) => {
      let m = o.material;
      if (!m) return;
      if (o.isMesh && !Array.isArray(m)) {
        const g = fadeGroupOf(o);
        if (g) { const fv = fadeVariant(m, g); if (fv !== m) { o.material = fv; m = fv; } }
      }
      if (Array.isArray(m)) { for (const mm of m) if (setupMaterial(mm)) n++; }
      else if (setupMaterial(m)) n++;
    });
    return n;
  }
  /**
   * The aerial perspective hook for the sea and any custom ShaderMaterial: the material must carry
   * three's fog chunks (`#include <fog_pars_vertex>`, `<fog_vertex>`, `<fog_pars_fragment>`,
   * `<fog_fragment>`) and set `fog: true`; its fog_fragment is then replaced with the atmosphere mix.
   * Lit materials go through the full setup (CSM, bounce, aerial).
   */
  function patchFog(m) {
    if (!m) return false;
    if (isLit(m)) return setupMaterial(m);
    if (m.isShaderMaterial) {
      if (m.fog !== true) m.fog = true;
      const vs = m.vertexShader || '', fs = m.fragmentShader || '';
      if (!fs.includes('#include <fog_fragment>') || !vs.includes('#include <fog_vertex>')) {
        console.warn('[lighting] patchFog: ShaderMaterial', m.name || m.uuid, 'has no fog chunks; it will use the plain scene fog only');
        return false;
      }
      return setupMaterial(m);
    }
    return setupMaterial(m);
  }
  function setCullFade(r) {
    if (r && r.clutter) fadeU.clutter.value.set(r.clutter[0], r.clutter[1]);
    if (r && r.scatter) fadeU.scatter.value.set(r.scatter[0], r.scatter[1]);
    if (r && r.fine) fadeU.fine.value.set(r.fine[0], r.fine[1]);
  }
  /**
   * Fill occluders: up to two boxes { x, y, z, yaw, hw, hh, hd, strength } (metres, radians, yaw about y
   * with hd along the rotated z axis; strength 0..1 is how much of the fill is removed at the core).
   * An explicit call wins over the default tunnel box read from the level plan.
   */
  let occExplicit = false;
  function setFillOccluders(list, explicit = true) {
    if (explicit) occExplicit = true;
    const boxes = Array.isArray(list) ? list.slice(0, OCC_N) : [];
    for (let i = 0; i < OCC_N; i++) {
      const b = boxes[i];
      if (b && Number.isFinite(b.x)) {
        occU.uOccBox.value[i].set(b.x, b.y || 0, b.z, b.yaw || 0);
        occU.uOccHalf.value[i].set(b.hw || 1, b.hh || 1, b.hd || 1, Math.max(0, Math.min(1, b.strength === undefined ? 0.8 : b.strength)));
      } else {
        occU.uOccHalf.value[i].w = 0;
      }
    }
  }
  if (useOcc) defaultOccluders(THREE).then((list) => { if (!occExplicit && list.length) { setFillOccluders(list, false); console.info('[lighting] fill occluder at the tunnel', JSON.stringify(list[0])); } });
  refresh();

  let frame = 0;
  let lastNear = camera.near, lastFar = camera.far, lastFov = camera.fov, lastAspect = camera.aspect;
  const _camPos = new THREE.Vector3();

  function update(cam = camera, dt = 0.016) {
    applyEnvironment();
    atm.uAtmTime.value += dt;
    if (cam !== csm.camera || cam.near !== lastNear || cam.far !== lastFar || cam.fov !== lastFov || cam.aspect !== lastAspect) {
      lastNear = cam.near; lastFar = cam.far; lastFov = cam.fov; lastAspect = cam.aspect;
      csm.camera = cam;
      csm.updateFrustums();
    }
    csm.update();   // the cascade box follows the camera frustum: the sun's target follows the camera
    cam.getWorldPosition(_camPos);
    sky.position.set(_camPos.x, _camPos.y + 50, _camPos.z);
    frame++;
    if (frame < 120 || frame % 15 === 0) refresh();
  }

  function setExposure(v) { renderer.toneMappingExposure = v; }
  function setSun(intensity) { for (const l of csm.lights) l.intensity = intensity; }
  function setFill(hemi, env) { if (Number.isFinite(hemi)) sky.intensity = hemi; if (Number.isFinite(env)) { envIntensity && (scene.environmentIntensity = env); } }

  function dispose() {
    csm.dispose(); csm.remove();
    scene.remove(sky);
    if (scene.fog === fog) scene.fog = null;
    if (scene.environment === envTex) scene.environment = null;
    if (envTex && !envIsPanorama) envTex.dispose();
  }

  const rig = {
    sun, sky, fog, csm, sunDir, tier: T, scene, atmos: atm, environment: envTex, envIsPanorama,
    update, refresh, patchFog, setExposure, setSun, setFill, setupMaterial, setCullFade, setFillOccluders, cullFade: fadeU, bounce: bounceUniforms(THREE), occluders: occU, dispose,
  };
  try { globalThis.__RIG__ = rig; } catch (e) { /* no globalThis (tests) */ }
  return rig;
}
