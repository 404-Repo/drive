/**
 * DRIVE  src/render/post.js  (owner: render; lifted from refs/rust17/post.js, restrained)
 *
 * High tier: EffectComposer on a 4x MSAA half float target (antialias on the WebGLRenderer is
 * discarded the moment a composer renders into its own target), a RenderPass, a depth only SSAO
 * (8 directions x 3 steps in a 0.6 m hemisphere, normals reconstructed from depth, never touching
 * the sky or anything past 60 m), a threshold bloom that catches only what is brighter than lit
 * whitewash (emissive lenses, the item box cores, boost flares, the sun core), the OutputPass (ACES
 * and sRGB, the same curve the renderer would apply), and one display space pass that is the three
 * way grade (shadows a touch cool, highlights a touch warm, midtones untouched, all under 6
 * percent), the speed lines (radial streaks on boost, alpha under 0.25 at full) and the black fade
 * for respawns and screens. No film grain, no vignette, no global tint, no desaturation: Ben
 * reverted a heavier pass because he saw no difference.
 *
 * Phone tier: renderer.render directly; speed lines and fade are one overlay quad drawn only while
 * either is above zero.
 *
 * renderer.info.autoReset is switched off here and the rig resets it once per frame at the top of
 * render(), so after post.render() returns, renderer.info holds the WHOLE frame (scene, shadow map
 * and every post pass) for telemetry to read as draws and tris.
 *
 *   const post = createPost(THREE, { renderer, scene, camera, tier });
 *   post.render(dt); post.setSpeedLines(t); post.setFade(t); post.resize(w, h); post.setCamera(cam);
 */
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { getTier } from './quality.js?v=r6-20260906191941';

/**
 * Bloom threshold in linear HDR. Round 1: lit whitewash measured 0.62 to 0.72 and the threshold was 0.92. Round 2
 * runs the sun at 12 (lighting.js), which puts lit whitewash at about 3.0 linear before the ACES curve, so the
 * threshold is 4.0: no diffuse surface blooms, only the sun's specular hot spots on paint and wet kerb tops,
 * additive flares and the sun disc (`?bloomt=` for the A/B).
 */
export const BLOOM = { threshold: 4.0, strength: 0.28, radius: 0.35, radius0: 0.0, cap: 8.0, wideFloor: 0.5 };
/**
 * Round 4 (targeted motion cues, render item 1): the bloom is for the sun's highlights and the boost flame, not
 * for turning a drift spark streak into a disc. Three guards, all A/B knobs (`?bloomcap=`, `?bloomr0=`,
 * `?bloomfloor=`; the old pass is cap=1e9 r0=0.35 floor=0):
 *   cap        the most luminance one pixel may inject into the bloom (after the threshold weight). A dozen additive
 *              spark sprites stack to 40 to 60 linear at the tyre and the two quarter resolution blurs spread that
 *              energy into a 60 to 75 px disc (measured on work/fix4_render/d066: pale discs the size of the tyre);
 *              the halo's radius grows with the log of the energy, so bounding the energy bounds the disc. A soft
 *              knee from cap/2 up to cap, so nothing plateaus.
 *   radius0    the first blur level's radius (the second keeps `radius`): the tight glow round a thin feature.
 *   wideFloor  what the second, wide level ignores: its input is the first level's output minus this floor, so a
 *              thin streak (diluted by the tight blur to well under the floor) gets the tight glow only, while an
 *              extended bright area (the boost flame stack, the sun disc, a hot specular patch) still carries the
 *              wide halo it has now.
 */
export const GRADE = { shadowCool: [0.975, 0.99, 1.045], highlightWarm: [1.04, 1.01, 0.965] };   // each channel within 6 percent of 1
export const SPEED_LINES_MAX = 0.35;   // round 4 (kart -> render): Ben asked 0.35 max; round 3 had 0.42, 0.22 was invisible at 33 m/s

function knob(name) {
  try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
}

const QUAD_VS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Display space, after OutputPass (ACES applied, sRGB encoded): grade, speed lines, fade.
const FINAL_FS = /* glsl */`
uniform sampler2D tDiffuse;
uniform vec3 uShadow, uHighlight;
uniform float uGrade, uSpeed, uFade, uTime, uAspect;
varying vec2 vUv;
float hsh(float p) { return fract(sin(p * 127.1) * 43758.5453); }
void main() {
  vec3 col = texture2D(tDiffuse, vUv).rgb;
  // three way grade: weight by display luma, midtones untouched
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float ws = (1.0 - l) * (1.0 - l) * (1.0 - l);
  float wh = l * l * l;
  vec3 g = mix(vec3(1.0), uShadow, ws) * mix(vec3(1.0), uHighlight, wh);
  col *= mix(vec3(1.0), g, uGrade);
  // speed lines: radial streaks in the outer field, scrolling inward
  if (uSpeed > 0.001) {
    vec2 c = (vUv - 0.5) * vec2(uAspect, 1.0);
    float r = length(c);
    float ang = atan(c.y, c.x);
    float seg = floor(ang * 96.0 + 0.5);
    float seed = hsh(seg);
    float within = abs(fract(ang * 96.0 + 0.5) - 0.5) * 2.0;          // 0 at the streak centre, 1 at its edge
    float phase = fract(r * 1.6 - uTime * (2.0 + seed * 2.5) + seed * 7.0);
    float streak = smoothstep(0.45, 0.85, phase) * (1.0 - smoothstep(0.15, 0.45, within)) * step(0.55, hsh(seg + 3.7));
    float field = smoothstep(0.42, 0.72, r);   // round 4: the field starts beyond the kart box (bottom near r 0.38) so the lines never touch the kart
    float a = streak * field * uSpeed;
    col = mix(col, vec3(1.0, 0.97, 0.90), a);
  }
  col *= 1.0 - uFade;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// Phone overlay: speed lines and fade only, alpha blended over the direct render.
const OVERLAY_FS = /* glsl */`
uniform float uSpeed, uFade, uTime, uAspect;
varying vec2 vUv;
float hsh(float p) { return fract(sin(p * 127.1) * 43758.5453); }
void main() {
  float a = 0.0; vec3 col = vec3(0.0);
  if (uSpeed > 0.001) {
    vec2 c = (vUv - 0.5) * vec2(uAspect, 1.0);
    float r = length(c);
    float ang = atan(c.y, c.x);
    float seg = floor(ang * 96.0 + 0.5);
    float seed = hsh(seg);
    float within = abs(fract(ang * 96.0 + 0.5) - 0.5) * 2.0;
    float phase = fract(r * 1.6 - uTime * (2.0 + seed * 2.5) + seed * 7.0);
    float streak = smoothstep(0.45, 0.85, phase) * (1.0 - smoothstep(0.15, 0.45, within)) * step(0.55, hsh(seg + 3.7));
    float field = smoothstep(0.42, 0.72, r);   // round 4: the field starts beyond the kart box (bottom near r 0.38) so the lines never touch the kart
    a = streak * field * uSpeed;
    col = vec3(1.0, 0.97, 0.90);
  }
  // fade: black over everything
  col = mix(col, vec3(0.0), uFade);
  a = a + uFade - a * uFade;
  gl_FragColor = vec4(col, a);
}`;

// Depth only SSAO. Runs in linear HDR before bloom so the darkening is lit like everything else.
const AO_FS = /* glsl */`
uniform sampler2D tDiffuse, tDepth;
uniform vec2 uRes;
uniform float uNear, uFar, uRadius, uStrength, uProjScale;
uniform mat4 uProjInv;
varying vec2 vUv;
vec3 viewPos(vec2 uv) {
  float z = texture2D(tDepth, uv).x;
  vec4 clip = vec4(uv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
  vec4 v = uProjInv * clip;
  return v.xyz / v.w;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 col = texture2D(tDiffuse, vUv).rgb;
  vec3 P = viewPos(vUv);
  float d = -P.z;
  if (d > 60.0 || d < 0.05 || d > uFar * 0.98) { gl_FragColor = vec4(col, 1.0); return; }
  vec2 px = 1.0 / uRes;
  vec3 Px = viewPos(vUv + vec2(px.x, 0.0)) - P, Py = viewPos(vUv + vec2(0.0, px.y)) - P;
  vec3 Nx = P - viewPos(vUv - vec2(px.x, 0.0)), Ny = P - viewPos(vUv - vec2(0.0, px.y));
  vec3 dx = abs(Px.z) < abs(Nx.z) ? Px : Nx, dy = abs(Py.z) < abs(Ny.z) ? Py : Ny;
  vec3 N = normalize(cross(dx, dy));
  float rPx = clamp(uRadius * uRes.y * uProjScale / d, 3.0, 80.0);
  float ang = hash(gl_FragCoord.xy) * 6.2832;
  float occ = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = ang + float(i) * 0.7854;
    vec2 dir = vec2(cos(a), sin(a));
    float best = 0.0;
    for (int j = 1; j <= 3; j++) {
      vec2 suv = vUv + dir * px * rPx * (float(j) / 3.0) * (0.6 + 0.4 * hash(gl_FragCoord.xy + float(j)));
      if (suv.x < 0.0 || suv.y < 0.0 || suv.x > 1.0 || suv.y > 1.0) break;
      vec3 S = viewPos(suv) - P;
      float len = length(S);
      float h = dot(S, N) / max(len, 1e-4);
      float w = 1.0 - smoothstep(uRadius * 0.5, uRadius * 1.5, len);
      best = max(best, h * w);
    }
    occ += max(best - 0.12, 0.0);
  }
  occ = clamp(occ / 8.0 * 1.6, 0.0, 1.0);
  // fade the effect out over the last 20 m so nothing pops at the 60 m cut
  float ao = 1.0 - occ * uStrength * (1.0 - smoothstep(40.0, 60.0, d));
  gl_FragColor = vec4(col * ao, 1.0);
}`;

// Threshold bloom, in house (integrator, round 0). UnrealBloomPass composited its result by drawing
// ADDITIVELY straight onto the composer's 4x MSAA half float read buffer, and on this GPU that draw
// intermittently came back as a hard edged black region over the left half of the frame while the
// scene was heavy (work/game/probe3.mjs: 12 of 30 frames with ?ao=0, 0 of 20 with ?bloom=0). This pass
// keeps every bloom step on small non multisampled targets and composites through a normal full
// screen write into the composer's write buffer, the same path the AO and grade passes already use.
const BRIGHT_FS = /* glsl */`
uniform sampler2D tDiffuse; uniform float uThreshold, uKnee, uCap; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  // a single NaN or Inf pixel in the scene buffer (a degenerate normal on a clearcoat or a card edge) would
  // otherwise be spread by the two blurs into a hard edged 80 px black square (round 0 and 1 filmstrips)
  if (!(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b)) c = vec3(0.0);
  c = min(c, vec3(256.0));
  float l = max(max(c.r, c.g), c.b);
  float soft = clamp((l - uThreshold + uKnee) / (2.0 * uKnee), 0.0, 1.0);
  soft = soft * soft * uKnee;
  float w = max(soft, l - uThreshold) / max(l, 1e-4);
  vec3 o = c * w;
  // per pixel energy cap with a soft knee from cap/2 to cap (round 4: stacked additive sparks)
  float ol = max(max(o.r, o.g), o.b);
  float hk = uCap * 0.5;
  if (ol > hk) o *= (hk + hk * (1.0 - exp(-(ol - hk) / hk))) / ol;
  gl_FragColor = vec4(o, 1.0);
}`;
const BLUR_FS = /* glsl */`
uniform sampler2D tDiffuse; uniform vec2 uStep; uniform float uFloor; varying vec2 vUv;
// uFloor is subtracted from every sample (0 on every pass but the wide level's first, round 4: a thin streak the
// tight level has already diluted under the floor never reaches the wide halo)
vec3 tap(vec2 uv) { return max(texture2D(tDiffuse, uv).rgb - uFloor, 0.0); }
void main() {
  vec3 c = tap(vUv) * 0.2270270270;
  c += (tap(vUv + uStep * 1.3846153846) + tap(vUv - uStep * 1.3846153846)) * 0.3162162162;
  c += (tap(vUv + uStep * 3.2307692308) + tap(vUv - uStep * 3.2307692308)) * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;
const COMP_FS = /* glsl */`
uniform sampler2D tDiffuse, tTight, tWide; uniform float uStrength, uFloor; varying vec2 vUv;
// the tight level keeps everything up to the floor, the wide level carries only the excess above it (round 4): the
// total energy is the old pass's, but a thin streak, whose tight glow never reaches the floor, gets no wide halo
void main() {
  vec3 bloom = min(texture2D(tTight, vUv).rgb, vec3(uFloor)) + texture2D(tWide, vUv).rgb;
  gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb + bloom * uStrength, 1.0); }`;

class ThresholdBloomPass extends Pass {
  constructor(THREE, w, h, { threshold, strength, radius, radius0 = radius, cap = 1e9, wideFloor = 0 }) {
    super();
    this.THREE = THREE;
    this.strength = strength; this.radius = radius; this.radius0 = radius0; this.wideFloor = wideFloor;
    const opts = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.rtBright = new THREE.WebGLRenderTarget(1, 1, opts);
    this.rtA = new THREE.WebGLRenderTarget(1, 1, opts);
    this.rtB = new THREE.WebGLRenderTarget(1, 1, opts);
    this.rtC = new THREE.WebGLRenderTarget(1, 1, opts);   // the wide level's output; rtB keeps the tight level's
    const mat = (fs, uniforms) => new THREE.ShaderMaterial({ uniforms, vertexShader: QUAD_VS, fragmentShader: fs, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
    this.bright = mat(BRIGHT_FS, { tDiffuse: { value: null }, uThreshold: { value: threshold }, uKnee: { value: 0.25 }, uCap: { value: cap } });
    this.blur = mat(BLUR_FS, { tDiffuse: { value: null }, uStep: { value: new THREE.Vector2() }, uFloor: { value: 0 } });
    this.comp = mat(COMP_FS, { tDiffuse: { value: null }, tTight: { value: null }, tWide: { value: null }, uStrength: { value: strength }, uFloor: { value: wideFloor } });
    this.quad = new FullScreenQuad(this.bright);
    this.setSize(w, h);
  }
  setSize(w, h) {
    this.rtBright.setSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
    const qw = Math.max(1, Math.round(w / 4)), qh = Math.max(1, Math.round(h / 4));
    this.rtA.setSize(qw, qh); this.rtB.setSize(qw, qh); this.rtC.setSize(qw, qh);
    this.qw = qw; this.qh = qh;
  }
  setStrength(v) { this.comp.uniforms.uStrength.value = v; }
  /** Live A/B of every bloom number (work/fix4_render/driftshot.mjs drives it through __DBG__.post.bloom). */
  setParams({ threshold, strength, radius, radius0, cap, wideFloor } = {}) {
    if (threshold !== undefined) this.bright.uniforms.uThreshold.value = threshold;
    if (cap !== undefined) this.bright.uniforms.uCap.value = cap;
    if (strength !== undefined) this.setStrength(strength);
    if (radius !== undefined) this.radius = radius;
    if (radius0 !== undefined) this.radius0 = radius0;
    if (wideFloor !== undefined) { this.wideFloor = wideFloor; this.comp.uniforms.uFloor.value = wideFloor; }
    return this.params();
  }
  params() { return { threshold: this.bright.uniforms.uThreshold.value, strength: this.comp.uniforms.uStrength.value, radius: this.radius, radius0: this.radius0, cap: this.bright.uniforms.uCap.value, wideFloor: this.wideFloor }; }
  render(renderer, writeBuffer, readBuffer) {
    const autoClear = renderer.autoClear; renderer.autoClear = false;
    // bright pass at half resolution
    this.bright.uniforms.tDiffuse.value = readBuffer.texture; this.quad.material = this.bright;
    renderer.setRenderTarget(this.rtBright); renderer.clear(); this.quad.render(renderer);
    // two separable blurs at quarter resolution: a tight level (radius0, kept in rtB) then a wide one (radius, rtC)
    // that only sees what is still above wideFloor after the tight level, so a thin streak stops at the tight
    // glow while an extended bright area carries the wide halo (round 4)
    this.quad.material = this.blur;
    let src = this.rtBright;
    for (let i = 0; i < 2; i++) {
      const step = 1 + (i === 0 ? this.radius0 : this.radius);
      const dst = i === 0 ? this.rtB : this.rtC;
      this.blur.uniforms.uFloor.value = i === 1 ? this.wideFloor : 0;
      this.blur.uniforms.tDiffuse.value = src.texture; this.blur.uniforms.uStep.value.set(step / this.qw, 0);
      renderer.setRenderTarget(this.rtA); renderer.clear(); this.quad.render(renderer);
      this.blur.uniforms.uFloor.value = 0;
      this.blur.uniforms.tDiffuse.value = this.rtA.texture; this.blur.uniforms.uStep.value.set(0, step / this.qh);
      renderer.setRenderTarget(dst); renderer.clear(); this.quad.render(renderer);
      src = dst;
    }
    // composite: a plain write into the write buffer (never an additive draw onto the read buffer)
    this.comp.uniforms.tDiffuse.value = readBuffer.texture; this.comp.uniforms.tTight.value = this.rtB.texture; this.comp.uniforms.tWide.value = this.rtC.texture;
    this.quad.material = this.comp;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    this.quad.render(renderer);
    renderer.autoClear = autoClear;
  }
  dispose() { this.rtBright.dispose(); this.rtA.dispose(); this.rtB.dispose(); this.rtC.dispose(); this.bright.dispose(); this.blur.dispose(); this.comp.dispose(); this.quad.dispose(); }
}

export function createPost(THREE, { renderer, scene, camera, tier }) {
  const T = getTier(tier);
  const qAo = knob('ao') !== null ? +knob('ao') : 1;
  const qBloom = knob('bloom') !== null ? +knob('bloom') : 1;
  const qGrade = knob('grade') !== null ? +knob('grade') : 1;
  const size = renderer.getSize(new THREE.Vector2());
  let speed = 0, fade = 0, time = 0;
  renderer.info.autoReset = false;

  if (T.post) {
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      samples: 4,
      type: THREE.HalfFloatType,
      colorSpace: THREE.LinearSRGBColorSpace,
      depthTexture: new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType),
    });
    const composer = new EffectComposer(renderer, rt);
    composer.setSize(size.x, size.y);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const ao = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: rt.depthTexture },
        uRes: { value: new THREE.Vector2(size.x, size.y) },
        uNear: { value: camera.near }, uFar: { value: camera.far },
        uRadius: { value: 0.6 }, uStrength: { value: 0.7 * qAo },
        uProjScale: { value: 0.866 },
        uProjInv: { value: camera.projectionMatrixInverse.clone() },
      },
      vertexShader: QUAD_VS, fragmentShader: AO_FS,
    });
    ao.material.depthTest = false; ao.material.depthWrite = false;   // the composer buffers share one depth texture; a full screen quad must never write it
    ao.enabled = qAo > 0;
    composer.addPass(ao);

    const num = (name, d) => { const v = knob(name); const n = v === null ? NaN : parseFloat(v); return Number.isFinite(n) ? n : d; };
    const bloom = new ThresholdBloomPass(THREE, size.x, size.y, {
      threshold: num('bloomt', BLOOM.threshold), strength: BLOOM.strength * qBloom, radius: num('bloomr', BLOOM.radius),
      radius0: num('bloomr0', BLOOM.radius0), cap: num('bloomcap', BLOOM.cap), wideFloor: num('bloomfloor', BLOOM.wideFloor),
    });
    bloom.enabled = qBloom > 0;
    composer.addPass(bloom);

    composer.addPass(new OutputPass());

    const final = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uShadow: { value: new THREE.Vector3(...GRADE.shadowCool) },
        uHighlight: { value: new THREE.Vector3(...GRADE.highlightWarm) },
        uGrade: { value: qGrade }, uSpeed: { value: 0 }, uFade: { value: 0 }, uTime: { value: 0 },
        uAspect: { value: size.x / size.y },
      },
      vertexShader: QUAD_VS, fragmentShader: FINAL_FS,
    });
    final.material.depthTest = false; final.material.depthWrite = false;
    composer.addPass(final);

    return {
      composer, renderPass, ao, bloom, final, tier: T,
      render(dt = 0.016) {
        renderer.info.reset();
        time += dt;
        const cam = renderPass.camera;
        ao.uniforms.uProjInv.value.copy(cam.projectionMatrixInverse);
        ao.uniforms.uNear.value = cam.near; ao.uniforms.uFar.value = cam.far;
        ao.uniforms.uProjScale.value = 1 / (2 * Math.tan(cam.fov * Math.PI / 360));
        final.uniforms.uSpeed.value = speed * SPEED_LINES_MAX;
        final.uniforms.uFade.value = fade;
        final.uniforms.uTime.value = time;
        composer.render(dt);
      },
      setSpeedLines(t) { speed = Math.max(0, Math.min(1, t || 0)); },
      setFade(t) { fade = Math.max(0, Math.min(1, t || 0)); },
      resize(w, h) {
        composer.setSize(w, h);
        bloom.setSize(w, h);
        ao.uniforms.uRes.value.set(w, h);
        final.uniforms.uAspect.value = w / h;
      },
      setCamera(cam) { renderPass.camera = cam; },
      dispose() { composer.dispose(); rt.dispose(); },
    };
  }

  // Phone tier: direct render plus an overlay quad only while speed lines or fade are active.
  const ovScene = new THREE.Scene();
  const ovCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const ovMat = new THREE.ShaderMaterial({
    uniforms: { uSpeed: { value: 0 }, uFade: { value: 0 }, uTime: { value: 0 }, uAspect: { value: size.x / size.y } },
    vertexShader: QUAD_VS, fragmentShader: OVERLAY_FS,
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
  });
  const ov = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ovMat);
  ov.frustumCulled = false;
  ovScene.add(ov);
  let cam = camera;

  return {
    composer: null, tier: T,
    render(dt = 0.016) {
      renderer.info.reset();
      time += dt;
      renderer.render(scene, cam);
      if (speed > 0.005 || fade > 0.002) {
        ovMat.uniforms.uSpeed.value = speed * SPEED_LINES_MAX;
        ovMat.uniforms.uFade.value = fade;
        ovMat.uniforms.uTime.value = time;
        renderer.autoClear = false;
        renderer.render(ovScene, ovCam);
        renderer.autoClear = true;
      }
    },
    setSpeedLines(t) { speed = Math.max(0, Math.min(1, t || 0)); },
    setFade(t) { fade = Math.max(0, Math.min(1, t || 0)); },
    resize(w, h) { ovMat.uniforms.uAspect.value = w / h; },
    setCamera(c) { cam = c; },
    dispose() { ov.geometry.dispose(); ovMat.dispose(); },
  };
}
