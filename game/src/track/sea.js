/**
 * track/sea.js - the sea plane, docs/TRACK-PLAN.md section 5.
 *
 * One 1400 x 1400 m plane (64 x 64 segments) at y -1.4 centred on (-100, 0), ONE draw call.
 * A MeshStandardMaterial with its own onBeforeCompile hook so the lighting rig's material walk
 * (CSM, aerial perspective fog, environment reflection) chains onto it like every other lit
 * material; the render agent's `patchFog(material)` is called when passed in the options.
 *   - colour: sea deep 0x1f6f8f grading to sea shallow 0x3fb0b8 where the terrain under the
 *     plane is above -2.0 (the height grid is sampled as a texture in the fragment shader);
 *   - a foam line, a lighter 1.2 m band pulsing where the depth crosses zero;
 *   - two scrolling procedural normal layers (wavelengths 6 m and 1.4 m, speeds 0.4 and 0.9 m/s,
 *     amplitudes 0.06 and 0.02), specular from the scene's sun through the standard BRDF,
 *     reflections through scene.environment or the envMap passed in;
 *   - a 0.15 m vertex swell.
 * Returns { mesh, material, update(dt, camera), level }.
 */
import * as THREE from 'three';

export const SEA = { level: -1.4, size: 1400, cx: -100, cz: 0, segments: 64, deep: 0x1f6f8f, shallow: 0x3fb0b8, foam: 0xdde8e3, roughness: 0.2 };

export function buildSea(THREE_, terrain, opts = {}) {
  const tier = opts.tier || {};
  const G = terrain.grid;
  // ---- terrain heights as a texture (8 bit, -6..26 m over 0..255) for the shallow water gradient
  const bytes = new Uint8Array(G.nx * G.nz);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.round(Math.min(1, Math.max(0, (G.heights[i] + 6) / 32)) * 255);
  const heightTex = new THREE.DataTexture(bytes, G.nx, G.nz, THREE.RedFormat, THREE.UnsignedByteType);
  heightTex.magFilter = THREE.LinearFilter; heightTex.minFilter = THREE.LinearFilter;
  heightTex.wrapS = THREE.ClampToEdgeWrapping; heightTex.wrapT = THREE.ClampToEdgeWrapping;
  heightTex.flipY = false; heightTex.needsUpdate = true;

  const geo = new THREE.PlaneGeometry(SEA.size, SEA.size, SEA.segments, SEA.segments);
  geo.rotateX(-Math.PI / 2);   // baked: local y is world up, the normal attribute is (0, 1, 0)

  const uniforms = {
    uTime: { value: 0 },
    uHeightTex: { value: heightTex },
    uHeightOrigin: { value: new THREE.Vector2(G.x0, G.z0) },
    uHeightInv: { value: new THREE.Vector2(1 / (G.cell * G.nx), 1 / (G.cell * G.nz)) },
    uHeightHalf: { value: new THREE.Vector2(0.5 / G.nx, 0.5 / G.nz) },
    uSeaLevel: { value: SEA.level },
    uDeep: { value: new THREE.Color(SEA.deep) },
    uShallow: { value: new THREE.Color(SEA.shallow) },
    uFoam: { value: new THREE.Color(SEA.foam) },
  };

  const material = new THREE.MeshStandardMaterial({
    color: SEA.deep, roughness: SEA.roughness, metalness: 0.0, name: 'sea',
    envMap: opts.envMap || null, envMapIntensity: 1.0,
  });
  material.userData.sea = true;

  const PARS = /* glsl */`
uniform float uTime;
varying vec3 vSeaW;
`;
  const FRAG_PARS = /* glsl */`
uniform sampler2D uHeightTex;
uniform vec2 uHeightOrigin, uHeightInv, uHeightHalf;
uniform float uSeaLevel;
uniform vec3 uDeep, uShallow, uFoam;
float seaTerrainHeight(vec2 p) {
  vec2 uv = (p - uHeightOrigin) * uHeightInv + uHeightHalf;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return -3.0;
  return texture2D(uHeightTex, uv).r * 32.0 - 6.0;
}
// two scrolling layers; each fades out with view distance before it can alias into moire
vec2 seaWaveGrad(vec2 p, float t, float dist) {
  vec2 d1 = vec2(0.94, 0.34), d2 = vec2(-0.50, 0.87), d3 = vec2(0.17, -0.98);
  float w1 = 1.0 - smoothstep(140.0, 420.0, dist);
  float w2 = 1.0 - smoothstep(25.0, 110.0, dist);
  float k1 = 6.2831853 / 6.0, a1 = 0.06 * w1, s1 = 0.4 * k1;
  vec2 g = a1 * k1 * d1 * cos(dot(p, d1) * k1 + t * s1);
  g += a1 * k1 * d2 * cos(dot(p, d2) * k1 * 1.13 + t * s1 * 0.9) * 0.7;
  g += a1 * k1 * d3 * cos(dot(p, d3) * k1 * 0.87 - t * s1 * 1.1) * 0.5;
  float k2 = 6.2831853 / 1.4, a2 = 0.02 * w2, s2 = 0.9 * k2;
  g += a2 * k2 * d2 * cos(dot(p, d2) * k2 + t * s2);
  g += a2 * k2 * d3 * cos(dot(p, d3) * k2 * 1.21 - t * s2 * 0.8) * 0.6;
  g += a2 * k2 * d1 * cos(dot(p, d1) * k2 * 0.79 + t * s2 * 1.2) * 0.4;
  return g;
}
`;
  material.onBeforeCompile = function (shader) {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + PARS)
      .replace('#include <begin_vertex>', /* glsl */`
#include <begin_vertex>
{
  vec2 wxz = (modelMatrix * vec4(position, 1.0)).xz;
  float sw = 0.15 * sin(wxz.x * 0.08 + uTime * 0.5) * sin(wxz.y * 0.06 - uTime * 0.35);
  transformed.y += sw;
  vSeaW = (modelMatrix * vec4(transformed, 1.0)).xyz;
}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + PARS + FRAG_PARS)
      .replace('#include <color_fragment>', /* glsl */`
#include <color_fragment>
float seaDepth = uSeaLevel - seaTerrainHeight(vSeaW.xz);
float seaShallow = 1.0 - smoothstep(0.4, 2.2, seaDepth);
float seaFoam = (1.0 - smoothstep(0.0, 0.6, abs(seaDepth - 0.2))) * (0.55 + 0.45 * sin(uTime * 1.3 + vSeaW.x * 0.7 + vSeaW.z * 0.5));
seaFoam *= step(-0.4, seaDepth);
seaFoam = clamp(seaFoam, 0.0, 1.0);
diffuseColor.rgb = mix(mix(uDeep, uShallow, seaShallow), uFoam, seaFoam * 0.85);`)
      .replace('#include <roughnessmap_fragment>', /* glsl */`
float roughnessFactor = roughness + seaFoam * 0.5;`)
      .replace('#include <normal_fragment_maps>', /* glsl */`
{
  vec2 g = seaWaveGrad(vSeaW.xz, uTime, length(vViewPosition));
  vec3 wN = normalize(vec3(-g.x, 1.0, -g.y));
  normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
}`);
  };
  material.customProgramCacheKey = () => 'sea';

  if (typeof opts.patchFog === 'function') opts.patchFog(material);

  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(SEA.cx, SEA.level, SEA.cz);
  mesh.receiveShadow = false; mesh.castShadow = false;
  mesh.name = 'sea';
  mesh.userData = { kind: 'sea' };
  mesh.frustumCulled = true;

  function update(dt) { uniforms.uTime.value += Math.min(dt || 0, 0.1); }

  return { mesh, material, uniforms, heightTex, update, level: SEA.level };
}
