// street_lamp candidate 1: lathe profiles. Square plinth as four segment lathes, one profiled
// shaft lathe with entasis, collars and the bracket flare, eight reeding rods, four torus
// volutes, a tapered four segment lantern lathe in glass with lathe frame rings and slanted
// corner posts, a four segment pyramid cap lathe, round finial, a lathe bulb lens.
// Round 2 (triangle budget, 36 placed): shaft at 12 segments, reeding rods square, volutes 5 x 7,
// finial and lens at 8 segments. 1608 -> about 1000 tris, silhouette unchanged.
export default function (THREE) {
  const g = new THREE.Group();
  const PI = Math.PI, DS = THREE.DoubleSide;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const shade = (hex, l, s, cool) => { const c = new THREE.Color(hex); const h = {}; c.getHSL(h); c.setHSL(h.h, clamp(h.s * (s === undefined ? 1 : s)), clamp(h.l * (1 + l))); if (cool) c.lerp(new THREE.Color(0x4a5a78), cool); return c; };
  const M = (name, color, rough, metal, extra) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal || 0 }, extra || {})); if (name) m.name = name; return m; };
  const fam = (name, hex, rough, metal, extra) => ({ face: M(name, hex, rough, metal, extra), alt: M(name, shade(hex, -0.04), rough, metal, extra), edge: M(name, shade(hex, 0.10), rough, metal, extra), top: M(name, shade(hex, 0.08, 0.95), rough, metal, extra), base: M(name, shade(hex, -0.18, 1, 0.12), rough, metal, extra) });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const add = (geo, mat, x, y, z, parent) => { const o = new THREE.Mesh(geo, mat); o.position.set(x || 0, y || 0, z || 0); (parent || g).add(o); return o; };
  const cyl = (rt, rb, h, seg, mat, x, y0, z, parent) => add(new THREE.CylinderGeometry(rt, rb, h, seg, 1, false), mat, x, y0 + h / 2, z, parent);
  const bar = (a, b, r, mat) => { const d = V().subVectors(b, a); const L = d.length(); const o = new THREE.Mesh(new THREE.BoxGeometry(r * 2, L, r * 2), mat); o.position.copy(a).add(b).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); g.add(o); return o; };
  const lathe = (pts, seg, mat, sq) => { const o = add(new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg), mat, 0, 0, 0); if (sq) o.rotation.y = PI / 4; return o; };
  const S2 = Math.SQRT2;

  const iron = fam('metal', 0x3a3f46, 0.45, 0.25, { side: DS });
  const glass = M(null, 0x8fa9d6, 0.15, 0, { transparent: true, opacity: 0.85, side: DS });
  const lens = M(null, 0xffc48a, 0.5, 0, { emissive: 0xffc48a, emissiveIntensity: 1.0 });

  // plinth: square lathes (four segments, radius is to the corner). Base band, step, cap
  lathe([[0, 0], [0.25 * S2, 0], [0.25 * S2, 0.25], [0, 0.25]], 4, iron.base, true);
  lathe([[0, 0.25], [0.21 * S2, 0.25], [0.21 * S2, 0.34], [0.17 * S2, 0.34], [0.17 * S2, 0.39], [0, 0.39]], 4, iron.face, true);
  lathe([[0, 0.39], [0.17 * S2, 0.39], [0.17 * S2, 0.4], [0, 0.4]], 4, iron.top, true);
  // shaft with entasis, a foot collar, a mid collar and the bracket flare at 3.6
  lathe([[0.1, 0.4], [0.1, 0.46], [0.07, 0.5], [0.068, 1.6], [0.062, 2.8], [0.058, 3.05], [0.08, 3.1], [0.08, 3.18], [0.055, 3.22], [0.052, 3.5], [0.16, 3.56], [0.17, 3.62], [0.15, 3.66], [0, 3.66]], 12, iron.face);
  lathe([[0.1, 0.46], [0.105, 0.47], [0.075, 0.51]], 12, iron.edge);
  lathe([[0.08, 3.18], [0.085, 3.19], [0.06, 3.22]], 12, iron.edge);
  // reeding: eight rods
  for (let k = 0; k < 8; k++) { const a = k * PI / 4; cyl(0.022, 0.022, 2.4, 4, iron.alt, Math.sin(a) * 0.06, 0.6, Math.cos(a) * 0.06); }
  // four volutes out to 0.4 m
  for (let k = 0; k < 4; k++) {
    const arm = new THREE.Group(); arm.rotation.y = k * PI / 2; arm.position.y = 3.58; g.add(arm);
    add(new THREE.TorusGeometry(0.09, 0.025, 5, 7, 1.5 * PI), iron.edge, 0.29, -0.06, 0, arm).rotation.z = PI / 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.05), iron.face); b.position.set(0.12, -0.02, 0); b.rotation.z = PI / 2 + 0.18; arm.add(b);
  }
  // lantern: tapered square glass lathe, frame rings, slanted corner posts, plate, cap, finial
  lathe([[0.30, 3.68], [0.36, 4.14]], 4, glass, true);
  lathe([[0, 3.64], [0.31, 3.64], [0.31, 3.7], [0.29, 3.7], [0, 3.7]], 4, iron.face, true);
  lathe([[0.34, 4.12], [0.38, 4.12], [0.38, 4.19], [0.44, 4.19], [0.45, 4.21], [0.0, 4.21]], 4, iron.face, true);
  for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 4; bar(V(Math.sin(a) * 0.30, 3.68, Math.cos(a) * 0.30), V(Math.sin(a) * 0.36, 4.14, Math.cos(a) * 0.36), 0.024, iron.face); }
  lathe([[0.45, 4.21], [0.46, 4.23], [0, 4.44]], 4, iron.top, true);
  lathe([[0, 4.44], [0.04, 4.45], [0.05, 4.48], [0.03, 4.5], [0, 4.5]], 8, iron.edge);
  lathe([[0.03, 3.7], [0.03, 3.82], [0.07, 3.86], [0.08, 3.95], [0.05, 4.03], [0, 4.05]], 8, lens);

  const box = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put = (mat) => { for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put(m.multiplyMatrices(n.matrixWorld, im)); } return; }
    put(n.matrixWorld);
  });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });
  return g;
}
