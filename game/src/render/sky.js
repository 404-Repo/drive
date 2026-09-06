/**
 * DRIVE  src/render/sky.js  (owner: render)
 *
 * The sky is the Atlas panorama (sky/sky_pano_2048.webp on the high tier, 1024 on the phone), an
 * equirect generated through Atlas ae7fa487 with the prompt in docs/TRACK-PLAN.md section 9 and
 * remapped offline (work/render/skyprep.py) so the horizon is the middle row and the sun sits at
 * azimuth 250 elevation 14, the seam blended with a 12 percent mirrored crossfade. Drawn on a far
 * sphere pinned to the far plane so it is always behind everything; the panorama's decoded sRGB is
 * scaled by SKY_GAIN into linear radiance and pushed through the renderer's ACES curve like every
 * other pixel.
 *
 * The same texture, filtered by PMREM, is the environment map the lighting rig uses for the fill
 * (scene.userData.skyEnv; the rig owns scene.environment and its intensity) and the sea's reflection.
 *
 * atmosFit: the stops of lighting.js's analytic atmosphere are READ OFF the panorama image (linear,
 * times the gain) at 0, 12, 35, 55 and 85 degrees away from the sun, and handed to
 * lighting.applyAtmosFit, so the aerial perspective, the hills ring and the analytic fallback fade
 * toward the sky that is actually behind them. One atmosphere, not two.
 *
 * `?sky=0` draws the analytic dome (ATMOS) instead, for the A/B; a panorama that fails to load falls
 * back to it with a console.warn (the gate treats a texture 404 as a hard failure).
 *
 * ridge: a world fixed ring of two hazy headland silhouettes at 700 and 1100 m, to the north and
 * east only (the sea is west and south), coloured by the atmosphere at their own haze level so the
 * map edge has something behind it at every land heading. Two draw calls plus the dome.
 *
 *   const sky = await createSky(THREE, { scene, renderer, tier });
 *   sky.update(camera, dt);   per frame
 */
import { sunDirection, SUN_COLOR, SUN_AZIMUTH_DEG, SUN_ELEVATION_DEG, ATMOS_UNIFORMS_GLSL, ATMOS_GLSL, atmosUniforms, applyAtmosFit } from './lighting.js?v=r0-20260906043348';
import { getTier } from './quality.js?v=r0-20260906043348';

/** Linear radiance = decoded panorama x SKY_GAIN. Solved so the sky band at 35 degrees lands near the bar's 185 to 205 sRGB luma. */
export const SKY_GAIN = 1.05;
export const ZENITH_COLOR = 0x6d86b4;    // documentary, the fitted values live in lighting.ATMOS
export const HORIZON_COLOR = 0xf0dcc0;

function knob(name) {
  try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
}
function stamp(url) {
  try { const v = globalThis.__BUILD_STAMP__; return v ? `${url}?v=${v}` : url; } catch (e) { return url; }
}

const SKY_VS = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  p.z = p.w * 0.999999;
  gl_Position = p;
}`;

// panorama dome: u = azimuth from north (-Z) clockwise / 360, v = 0.5 + elevation / 180
const PANO_FS = ATMOS_UNIFORMS_GLSL + ATMOS_GLSL + /* glsl */`
uniform sampler2D uPano;
uniform float uGain, uYaw, uDiscGlow;
uniform vec3 uSun;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float az = atan(d.x, -d.z) + uYaw;
  float v = 0.5 + asin(clamp(d.y, -1.0, 1.0)) / 3.14159265359;
  // Two u parametrisations whose wrap seams sit half a turn apart. At the seam of one the screen
  // space derivative of u jumps by a whole turn, the GPU picks the smallest mip for that pixel column
  // and a one pixel line of the panorama's mean colour stands due north. Sample both (mip selection
  // is per sample, from its own smooth derivatives) and take the one whose u is continuous here.
  // Derivatives are taken outside any branch (a fwidth inside a branch is undefined).
  float uA = fract(az / 6.28318530718);
  float uB = fract(az / 6.28318530718 + 0.5) - 0.5;
  float wA = fwidth(uA), wB = fwidth(uB);
  vec3 sA = texture2D(uPano, vec2(uA, v)).rgb;
  vec3 sB = texture2D(uPano, vec2(uB, v)).rgb;
  vec3 col = (wA <= wB ? sA : sB) * uGain;
  // a small analytic core on the painted sun so the bloom threshold has something to catch
  float sd = max(dot(d, uAtmSunDir), 0.0);
  col += uSun * uDiscGlow * pow(sd, 400.0);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const ANALYTIC_FS = ATMOS_UNIFORMS_GLSL + ATMOS_GLSL + /* glsl */`
uniform vec3 uSun;
uniform float uSunDisc;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 col = atmosSky(d, 1.0);
  float sd = max(dot(d, uAtmSunDir), 0.0);
  float disc = smoothstep(0.99925, 0.99965, sd);
  col = mix(col, uSun * uSunDisc, disc);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const HILL_VS = /* glsl */`
attribute float aHaze;
attribute float aTone;
varying vec3 vDir;
varying float vHaze;
varying float vTone;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = wp.xyz - cameraPosition;
  vHaze = aHaze;
  vTone = aTone;
  vec4 p = projectionMatrix * viewMatrix * wp;
  p.z = p.w * 0.999998;
  gl_Position = p;
}`;
const HILL_FS = ATMOS_UNIFORMS_GLSL + ATMOS_GLSL + /* glsl */`
uniform vec3 uHillLit, uHillShade;
varying vec3 vDir;
varying float vHaze;
varying float vTone;
void main() {
  vec3 d = normalize(vDir);
  float az = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uAtmSunDir.x, 0.0, uAtmSunDir.z))), 0.0);
  vec3 rock = mix(uHillShade, uHillLit, 1.0 - az * 0.6) * vTone;
  rock *= 1.0 + 0.14 * clamp(d.y * 6.0, -1.0, 1.0) * (1.0 - vHaze);
  vec3 sky = atmosSky(normalize(vec3(d.x, max(d.y, 0.012) + 0.14, d.z)), 0.0);   // the haze mixes toward the sky 8 degrees up: bluer than the horizon band, so the headlands read blue grey
  vec3 col = mix(rock, sky, vHaze);
  col = mix(col, sky, smoothstep(0.07, 0.0, d.y) * 0.85);
  col = mix(col, sky, smoothstep(0.014, -0.002, d.y));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Ridge line height in metres at a heading (radians), layered sines with a fixed seed. */
function ridgeHeight(theta, layer) {
  const s = layer === 0
    ? 26 + 20 * Math.sin(theta * 3.0 + 0.4) + 14 * Math.sin(theta * 7.0 + 2.1) + 8 * Math.sin(theta * 13.0 + 1.3) + 4 * Math.sin(theta * 29.0) + 2 * Math.sin(theta * 53.0 + 0.9)
    : 40 + 30 * Math.sin(theta * 2.0 + 1.9) + 18 * Math.sin(theta * 5.0 + 0.7) + 10 * Math.sin(theta * 11.0 + 3.0) + 5 * Math.sin(theta * 23.0 + 0.5) + 3 * Math.sin(theta * 47.0 + 2.2);
  return Math.max(s * 1.05, 4);   // peaks about 6 degrees above the horizon from the quay
}
/** Headlands to the north and east only: full from azimuth 300 through north to 150, gone from 195 to 300 (open sea). */
function landWindow(azDeg) {
  const a = ((azDeg % 360) + 360) % 360;
  if (a >= 300) return Math.min(1, (a - 300) / 30);
  if (a <= 150) return 1;
  if (a < 195) return 1 - (a - 150) / 45;
  return 0;
}

function buildRidge(THREE, atm) {
  const rings = [
    { r: 700, haze: 0.30, layer: 0, tone: 1.0 },
    { r: 1100, haze: 0.48, layer: 1, tone: 0.94 },
  ];
  const N = 480;
  const pos = [], haze = [], tone = [], idx = [];
  let base = 0;
  for (const ring of rings) {
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * Math.PI * 2;                 // azimuth from north, clockwise seen from above
      const x = Math.sin(th) * ring.r, z = -Math.cos(th) * ring.r;
      const w = landWindow(th * 180 / Math.PI);
      const h = ridgeHeight(th, ring.layer) * (ring.r / 700) * w;
      pos.push(x, -60, z, x, -60 + (h + 60) * w, z);   // w = 0 collapses the ring below the horizon over the sea
      haze.push(ring.haze, ring.haze);
      tone.push(ring.tone, ring.tone);
      if (i < N) { const a = base + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    base += (N + 1) * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aHaze', new THREE.Float32BufferAttribute(haze, 1));
  g.setAttribute('aTone', new THREE.Float32BufferAttribute(tone, 1));
  g.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    // hazy blue grey headlands, linear
    uniforms: { ...atm, uHillLit: { value: new THREE.Color(0.14, 0.18, 0.28) }, uHillShade: { value: new THREE.Color(0.085, 0.11, 0.19) } },
    vertexShader: HILL_VS, fragmentShader: HILL_FS,
    side: THREE.DoubleSide, depthWrite: false, depthTest: true, depthFunc: THREE.LessEqualDepth, fog: false, toneMapped: true,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.name = 'ridge';
  mesh.frustumCulled = false;
  mesh.renderOrder = -999;
  mesh.castShadow = false; mesh.receiveShadow = false;
  return mesh;
}

function loadTexture(THREE, url) {
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(url, (t) => resolve(t), undefined, (e) => { console.warn('[sky] failed to load', url, e && (e.message || e.type)); resolve(null); });
  });
}

const srgbToLinear = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };

/**
 * Read the atmosphere stops off the panorama image: mean linear colour of a small patch at each
 * elevation, averaged over five azimuths 70 to 180 degrees away from the sun, times the gain. The
 * sun glow is the excess at 4 degrees above the horizon in the sun's direction.
 */
function fitAtmos(image, gain) {
  const W = 512, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H).data;
  const sample = (azDeg, elDeg, rad = 2) => {
    const u = (((azDeg % 360) + 360) % 360) / 360, v = 0.5 + elDeg / 180;      // v up
    const cx = Math.round(u * W), cy = Math.round((1 - v) * H);
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      const x = ((cx + dx) % W + W) % W, y = Math.max(0, Math.min(H - 1, cy + dy));
      const i = (y * W + x) * 4;
      r += srgbToLinear(data[i]); g += srgbToLinear(data[i + 1]); b += srgbToLinear(data[i + 2]); n++;
    }
    return [r / n * gain, g / n * gain, b / n * gain];
  };
  const away = [70, 110, 180, -110, -70].map((d) => SUN_AZIMUTH_DEG + d);
  const avg = (el, rad) => {
    const acc = [0, 0, 0];
    for (const a of away) { const s = sample(a, el, rad); acc[0] += s[0]; acc[1] += s[1]; acc[2] += s[2]; }
    return acc.map((x) => +(x / away.length).toFixed(4));
  };
  const fit = {
    horizon: avg(1.0, 1), low: avg(12, 2), mid: avg(35, 3), high: avg(55, 3), zenith: avg(85, 3),
    haze: avg(0.4, 1), below: avg(-2.5, 1),
  };
  const nearSun = sample(SUN_AZIMUTH_DEG, 4, 2), base = avg(4, 2);
  fit.sunGlow = nearSun.map((v, i) => +Math.max(0, (v - base[i]) / 0.6).toFixed(4));
  fit.cloud = fit.low.map((v) => +(v * 1.9).toFixed(4));
  // a sanity number for the log: the panorama's mean luma at 35 degrees in sRGB after the gain (before ACES)
  return fit;
}

export async function createSky(THREE, { scene, renderer, tier, base = './sky/' }) {
  const T = getTier(tier);
  const sunDir = sunDirection(THREE);
  const atm = atmosUniforms(THREE);
  const gain = +(knob('skygain') || SKY_GAIN);
  const wantPano = knob('sky') !== '0';

  let pano = null;
  if (wantPano) {
    const res = T.name === 'phone' ? 1024 : 2048;
    pano = await loadTexture(THREE, stamp(`${base}sky_pano_${res}.webp`));
    if (pano) {
      pano.colorSpace = THREE.SRGBColorSpace;
      pano.mapping = THREE.EquirectangularReflectionMapping;
      pano.wrapS = THREE.RepeatWrapping; pano.wrapT = THREE.ClampToEdgeWrapping;
      pano.minFilter = THREE.LinearMipmapLinearFilter; pano.magFilter = THREE.LinearFilter;
      pano.generateMipmaps = true;
      pano.anisotropy = Math.max(1, T.anisotropy || 1);
      pano.needsUpdate = true;
    } else {
      console.warn('[sky] panorama missing: analytic dome in its place (' + base + 'sky_pano_' + res + '.webp)');
    }
  }

  const geo = new THREE.SphereGeometry(80, 48, 28);
  let mat;
  if (pano) {
    mat = new THREE.ShaderMaterial({
      uniforms: { ...atm, uPano: { value: pano }, uGain: { value: gain }, uYaw: { value: (+(knob('skyyaw') || 0)) * Math.PI / 180 }, uSun: { value: new THREE.Color(SUN_COLOR) }, uDiscGlow: { value: 2.5 } },
      vertexShader: SKY_VS, fragmentShader: PANO_FS,
      side: THREE.BackSide, depthWrite: false, depthTest: true, depthFunc: THREE.LessEqualDepth, fog: false, toneMapped: true,
    });
  } else {
    mat = new THREE.ShaderMaterial({
      uniforms: { ...atm, uSun: { value: new THREE.Color(SUN_COLOR) }, uSunDisc: { value: 4.0 } },
      vertexShader: SKY_VS, fragmentShader: ANALYTIC_FS,
      side: THREE.BackSide, depthWrite: false, depthTest: true, depthFunc: THREE.LessEqualDepth, fog: false, toneMapped: true,
    });
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.castShadow = false; mesh.receiveShadow = false;
  scene.add(mesh);

  // the environment map: PMREM of the panorama; the rig sets scene.environment and its intensity
  let envMap = null;
  let atmosFit = null;
  if (pano) {
    try {
      const pm = new THREE.PMREMGenerator(renderer);
      envMap = pm.fromEquirectangular(pano).texture;
      pm.dispose();
    } catch (e) { console.warn('[sky] PMREM failed', e && e.message); envMap = null; }
    try {
      atmosFit = fitAtmos(pano.image, gain);
      applyAtmosFit(atmosFit);
      console.info('[sky] atmosphere refit to the panorama', JSON.stringify(atmosFit));
    } catch (e) { console.warn('[sky] atmosphere fit failed, analytic stops kept', e && e.message); }
  }
  if (!scene.userData) scene.userData = {};
  scene.userData.skyEnv = envMap;

  const ridge = buildRidge(THREE, atm);
  scene.add(ridge);

  let time = 0;
  const _p = new THREE.Vector3();
  function update(camera, dt = 0.016) {
    time += dt;
    atm.uAtmTime.value = time;
    if (camera) { camera.getWorldPosition(_p); mesh.position.copy(_p); }
  }
  function setGain(v) { if (mat.uniforms.uGain) mat.uniforms.uGain.value = v; }
  function dispose() {
    scene.remove(mesh); geo.dispose(); mat.dispose();
    scene.remove(ridge); ridge.geometry.dispose(); ridge.material.dispose();
    if (pano) pano.dispose();
    if (envMap) envMap.dispose();
    if (scene.userData.skyEnv === envMap) scene.userData.skyEnv = null;
  }
  return { mesh, envMap, ridge, atmosFit, panorama: pano, sunDir, gain, update, setGain, dispose, sunAzimuthDeg: SUN_AZIMUTH_DEG, sunElevationDeg: SUN_ELEVATION_DEG };
}
