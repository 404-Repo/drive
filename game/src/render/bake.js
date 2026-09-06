/**
 * DRIVE  src/render/bake.js  (owner: render; lifted from refs/rust17/bake.js)
 *
 * Draw call collapse for generated assets. Every asset arrives with one MeshStandardMaterial per
 * part (a colour, a roughness and a metalness each), so a 30 m block would hold 50 to 150 distinct
 * material values and bakeStatic() could merge nothing across them.
 *
 * The fix moves the per part values into the vertices: colour into a `color` attribute, roughness
 * and metalness into an `aRM` attribute, and every part of the same SURFACE (the same maps, side,
 * emissive, transparency) shares ONE material instance whose shader reads the two attributes back.
 * bakeStatic() (assetlib, untouched) then merges by material value and a block collapses to one
 * mesh per surface. materials.js runs this as its phase 2 and then swaps the shared VertexPBR for
 * the shared TriplanarMaterial of the set (phase 3). The same pass runs on articulated assets
 * (karts, drivers, item boxes) with `local: true` so a kart is one mesh per joint per surface.
 *
 * The material is a subclass with the hook on its prototype, so it survives clone() and chains
 * with the CSM hook the lighting rig adds. Nothing here changes what a part looks like: the exact
 * colour, roughness and metalness the asset author wrote are carried per vertex.
 *
 * onBeforeCompile in three 0.169 receives the shader with its `#include <...>` lines UNEXPANDED,
 * so the include lines are replaced whole (a text replacement on the expanded chunk never
 * matched and every baked object rendered as a rough metal on Rust 17 round 1).
 */
import * as THREE from 'three';

export class VertexPBRMaterial extends THREE.MeshStandardMaterial {
  constructor(params) {
    super(params);
    this.vertexColors = true;
    this.color.set(1, 1, 1);
    this.roughness = 1;
    this.metalness = 1;
  }
  onBeforeCompile(shader) {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aRM;\nvarying vec2 vRM;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRM = aRM;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRM;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vRM.x;\n#ifdef USE_ROUGHNESSMAP\n  vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );\n  roughnessFactor *= texelRoughness.g;\n#endif')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vRM.y;\n#ifdef USE_METALNESSMAP\n  vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );\n  metalnessFactor *= texelMetalness.b;\n#endif');
  }
  customProgramCacheKey() { return 'drive_vrm'; }
}

const SHARED = new Map();
const TAGS = new WeakMap();   // geometry -> 'colour|roughness|metalness' it was baked with
const tex = (t) => (t ? t.uuid : '-');

function surfaceKeyOf(m) {
  return [tex(m.map), tex(m.roughnessMap), tex(m.normalMap), m.side, m.transparent ? 1 : 0, m.opacity,
    m.emissive ? m.emissive.getHexString() : '-', m.emissiveIntensity, m.flatShading ? 1 : 0, m.alphaTest, m.depthWrite ? 1 : 0,
    m.normalScale ? m.normalScale.x.toFixed(2) : '-'].join('|');
}

const KEEP_ATTRS = new Set(['position', 'normal', 'uv', 'color', 'aRM']);
function bakeAttributes(g, color, useOldColor, rough, metal) {
  const n = g.attributes.position.count;
  const old = useOldColor ? g.attributes.color : null;
  const col = new Float32Array(n * 3);
  const rm = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const k = old ? old.getX(i) : 1, l = old ? old.getY(i) : 1, mm = old ? old.getZ(i) : 1;
    col[i * 3] = color.r * k; col[i * 3 + 1] = color.g * l; col[i * 3 + 2] = color.b * mm;
    rm[i * 2] = rough; rm[i * 2 + 1] = metal;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aRM', new THREE.BufferAttribute(rm, 2));
  // one attribute set for everything, or the merge buckets split on the signature
  for (const name of Object.keys(g.attributes)) if (!KEEP_ATTRS.has(name)) g.deleteAttribute(name);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
}

/**
 * Convert every single material mesh under root. Returns the number converted. Materials that are
 * not MeshStandardMaterial (sprites, shader materials) and multi material meshes are split or left
 * alone. Idempotent: a converted material is skipped.
 *   opts.unify   one material for the whole root (karts, drivers): maps from the first textured part
 *   opts.shared  a private shared map (tests)
 */
export function vertexiseMaterials(root, opts = {}) {
  const shared = opts.shared || SHARED;
  const unify = !!opts.unify;
  let unifyMaps = null;
  if (unify) {
    root.traverse((o) => {
      if (unifyMaps || !o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m && m.isMeshStandardMaterial && m.map) unifyMaps = { map: m.map, roughnessMap: m.roughnessMap, normalMap: m.normalMap, normalScale: m.normalScale, name: m.name };
    });
  }
  let n = 0;
  // multi material meshes (one geometry, groups per material): split into one mesh per group first
  const split = [];
  root.traverse((o) => { if (o.isMesh && Array.isArray(o.material) && o.geometry && o.geometry.groups && o.geometry.groups.length) split.push(o); });
  for (const o of split) {
    const parent = o.parent; if (!parent) continue;
    const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    for (const grp of o.geometry.groups) {
      const mat = o.material[grp.materialIndex] || o.material[0];
      const count = grp.count === Infinity ? src.attributes.position.count - grp.start : grp.count;
      if (count <= 0) continue;
      const g = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(src.attributes)) {
        const arr = attr.array.slice(grp.start * attr.itemSize, (grp.start + count) * attr.itemSize);
        g.setAttribute(name, new THREE.BufferAttribute(arr, attr.itemSize, attr.normalized));
      }
      const mesh = new THREE.Mesh(g, mat);
      mesh.position.copy(o.position); mesh.quaternion.copy(o.quaternion); mesh.scale.copy(o.scale);
      mesh.castShadow = o.castShadow; mesh.receiveShadow = o.receiveShadow; mesh.name = o.name;
      parent.add(mesh);
    }
    parent.remove(o);
  }
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.length !== 1) return;
    const m = mats[0];
    if (!m || !m.isMeshStandardMaterial || m.isVertexPBR || m.userData.__vrm) return;
    if (unify && unifyMaps && !m.transparent && !(m.emissive && m.emissive.getHex())) {
      m.map = unifyMaps.map; m.roughnessMap = unifyMaps.roughnessMap; m.normalMap = unifyMaps.normalMap;
      if (unifyMaps.normalScale) m.normalScale = unifyMaps.normalScale.clone();
      m.name = m.name || unifyMaps.name;
    }
    const color = m.color || new THREE.Color(1, 1, 1);
    const rough = typeof m.roughness === 'number' ? m.roughness : 1;
    const metal = typeof m.metalness === 'number' ? m.metalness : 0;
    const tag = `${color.getHexString()}|${rough}|${metal}`;
    let g = o.geometry;
    // geometry is shared between clones of the same asset; a second visitor with a different part
    // colour gets its own copy, an identical one keeps the shared attributes. The tag lives in a
    // WeakMap, not in geometry.userData: BufferGeometry.copy() shares the userData OBJECT by
    // reference, so a tag written there marked the prototype and every later clone arrived
    // "already done" with no attributes.
    const have = TAGS.get(g);
    if (have && have !== tag) { g = g.clone(); o.geometry = g; }
    if (TAGS.get(g) !== tag || !g.attributes.aRM) {
      bakeAttributes(g, color, !!(m.vertexColors && g.attributes.color), rough, metal);
      TAGS.set(g, tag);
    }
    let key = surfaceKeyOf(m);
    if (unify && unifyMaps && m.map === unifyMaps.map) {
      // one bucket per articulated asset: double sided parts are drawn double sided with the rest
      const side = opts.side !== undefined ? opts.side : THREE.DoubleSide;
      key = 'unify|' + unifyMaps.name + '|' + side + '|' + (m.transparent ? 1 : 0);
      m.side = side;
    }
    let sm = shared.get(key);
    if (!sm) {
      sm = new VertexPBRMaterial();
      sm.copy(m);
      sm.color.set(1, 1, 1); sm.roughness = 1; sm.metalness = 1; sm.vertexColors = true;
      sm.name = m.name || '';
      sm.userData = { __vrm: true, surface: m.name || '' };
      shared.set(key, sm);
    }
    o.material = sm;
    n++;
  });
  return n;
}

Object.defineProperty(VertexPBRMaterial.prototype, 'isVertexPBR', { value: true });
