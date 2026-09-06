/**
 * DRIVE  src/render/quality.js  (owner: render; lifted from refs/rust17/quality.js)
 *
 * Two tiers only. The numbers are the ones docs/ARCHITECTURE.md fixes; every other module reads
 * them through `tier.density`, `tier.castDist`, `tier.cardsFar` and so on rather than re-deciding
 * what a phone can do.
 *
 *   import { TIERS, detectTier, getTier, applyTierToRenderer } from './src/render/quality.js?v=r1-20260906113009';
 *   const tierName = detectTier();          // 'high' | 'phone'
 *   const tier = getTier(tierName);         // the TIERS entry, with .name attached
 *
 * shadowMap 4096 over 70 m on the high tier is 1.7 cm texels; 1024 over 45 m on the phone is
 * 4.4 cm. One cascade on both: a second cascade doubled the shadow pass triangles on Rust 17 and
 * the budget here is 1.5 M in view. castDist is how far from the camera a block still casts
 * (the level builder reads it); shadowDist is the cascade extent.
 */
export const TIERS = {
  high:  { pixelRatio: 1.5, shadowMap: 4096, cascades: 1, shadowDist: 70, castDist: 40, post: true,  density: 1.0, texRes: 1024, anisotropy: 4, cardsFar: 220, propsFar: 260, fog: true },
  phone: { pixelRatio: 1.0, shadowMap: 1024, cascades: 1, shadowDist: 45, castDist: 30, post: false, density: 0.5, texRes: 512,  anisotropy: 1, cardsFar: 140, propsFar: 180, fog: true },
};
for (const k of Object.keys(TIERS)) TIERS[k].name = k;

/**
 * '?q=high' or '?q=phone' wins. Otherwise a touch device with a small viewport is a phone;
 * everything else is high. Deliberately conservative about calling something a phone: a touch
 * laptop with a 1400 px viewport gets the high tier, a 412 x 915 phone (the karttest viewport)
 * gets phone.
 */
export function detectTier() {
  try {
    const q = new URLSearchParams(location.search).get('q');
    if (q && TIERS[q]) return q;
  } catch (e) { /* no location (tests) */ }
  const touch = (typeof navigator !== 'undefined') &&
    (('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0) || ('ontouchstart' in globalThis));
  const w = globalThis.innerWidth || 1280, h = globalThis.innerHeight || 720;
  // screen.* as well as inner*: a page without a viewport meta (or an emulator with isMobile and no
  // meta) lays out at Chrome's 980 px default and innerWidth lies, while screen.width stays the
  // device's CSS width (412 on the karttest phone). A 1400 px touch laptop stays high on both.
  let sw = w, sh = h;
  try { if (globalThis.screen && globalThis.screen.width) { sw = globalThis.screen.width; sh = globalThis.screen.height; } } catch (e) { /* no screen (tests) */ }
  const small = Math.min(w, h) <= 500 || Math.min(sw, sh) <= 500 || (w * h) <= 1000 * 1000;
  const mobileUA = typeof navigator !== 'undefined' && /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent || '');
  if ((touch && small) || (mobileUA && small)) return 'phone';
  return 'high';
}

/** Accepts a tier name or a tier object and always returns the tier object. */
export function getTier(t) {
  if (!t) return TIERS.high;
  if (typeof t === 'string') return TIERS[t] || TIERS.high;
  return t;
}

/**
 * Renderer settings that belong to the tier: pixel ratio only. The colour pipeline (ACES, sRGB,
 * exposure, shadow map type) is fixed and lives in lighting.js so it cannot be set differently by
 * two callers. Anisotropy is applied per texture in materials.js from tier.anisotropy.
 */
export function applyTierToRenderer(renderer, tier) {
  const T = getTier(tier);
  const dpr = (globalThis.devicePixelRatio || 1);
  renderer.setPixelRatio(Math.min(dpr, T.pixelRatio));
  return T;
}
