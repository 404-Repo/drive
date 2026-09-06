// market_stall candidate 0: primitive assembly. Box posts with base bands, eave rails and knee
// braces, a front counter with a vertical plank skirt and a whitewash top, a tilted display tray
// with an ice bed, icosahedron ice chunks and capsule fish, two crates, a pitched awning from
// two slabs with stripe boxes and half cylinder scallops, a hanging scale, a chalkboard.
export default function (THREE) {
  const g = new THREE.Group();
  const PI = Math.PI, DS = THREE.DoubleSide;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const shade = (hex, l, s, cool) => { const c = new THREE.Color(hex); const h = {}; c.getHSL(h); c.setHSL(h.h, clamp(h.s * (s === undefined ? 1 : s)), clamp(h.l * (1 + l))); if (cool) c.lerp(new THREE.Color(0x4a5a78), cool); return c; };
  const M = (name, color, rough, metal, extra) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal || 0 }, extra || {})); if (name) m.name = name; return m; };
  const fam = (name, hex, rough, metal, extra) => ({ face: M(name, hex, rough, metal, extra), alt: M(name, shade(hex, -0.04), rough, metal, extra), edge: M(name, shade(hex, 0.10), rough, metal, extra), top: M(name, shade(hex, 0.08, 0.95), rough, metal, extra), base: M(name, shade(hex, -0.18, 1, 0.12), rough, metal, extra) });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const add = (geo, mat, x, y, z, parent) => { const o = new THREE.Mesh(geo, mat); o.position.set(x || 0, y || 0, z || 0); (parent || g).add(o); return o; };
  const bx = (w, h, d, mat, x, y0, z, parent) => add(new THREE.BoxGeometry(w, h, d), mat, x, y0 + h / 2, z, parent);
  const cyl = (rt, rb, h, seg, mat, x, y0, z, parent) => add(new THREE.CylinderGeometry(rt, rb, h, seg, 1, false), mat, x, y0 + h / 2, z, parent);
  const bar = (a, b, r, mat, parent) => { const d = V().subVectors(b, a); const L = d.length(); const o = new THREE.Mesh(new THREE.BoxGeometry(r * 2, L, r * 2), mat); o.position.copy(a).add(b).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); (parent || g).add(o); return o; };

  const teal = fam('timber', 0x3f8f8a, 0.7, 0);
  const wood = fam('timber', 0xcdb897, 0.7, 0);
  const white = fam('timber', 0xf1e6d2, 0.72, 0);
  const canvasW = fam('fabric', 0xf1e6d2, 0.8, 0, { side: DS });
  const canvasR = fam('fabric', 0xd6402f, 0.8, 0, { side: DS });
  const iron = fam('metal', 0x3a3f46, 0.45, 0.25);
  const fishA = M('metal', 0xb5bfc6, 0.5, 0.1), fishB = M('metal', 0x9aa6ae, 0.5, 0.1);
  const ice = M('stone', 0xd8e0e4, 0.6, 0);
  const board = M(null, 0x2f3336, 0.8, 0);

  // frame: four posts with base bands and caps, eave rails, side rails, knee braces, ridge
  const corners = [[-1.4, -1.1], [1.4, -1.1], [-1.4, 1.1], [1.4, 1.1]];
  for (const [x, z] of corners) { bx(0.1, 0.25, 0.1, teal.base, x, 0, z); bx(0.1, 1.95, 0.1, teal.face, x, 0.25, z); bx(0.12, 0.012, 0.12, teal.top, x, 2.2, z); }
  for (const z of [-1.1, 1.1]) { bx(3.0, 0.1, 0.1, teal.face, 0, 2.1, z); bx(3.0, 0.03, 0.03, teal.edge, 0, 2.17, z + 0.05 * Math.sign(z)); }
  for (const x of [-1.4, 1.4]) bx(0.1, 0.1, 2.3, teal.alt, x, 2.1, 0);
  for (const [x, z] of corners) bar(V(x, 1.72, z), V(x - Math.sign(x) * 0.38, 2.1, z), 0.03, teal.alt);
  for (const x of [-1.4, 1.4]) bx(0.08, 0.5, 0.08, teal.face, x, 2.2, 0);
  bx(3.0, 0.1, 0.1, teal.face, 0, 2.62, 0);

  // counter along the front: base band, body, plank skirt, whitewash top with a painted edge
  bx(3.0, 0.25, 0.6, teal.base, 0, 0, 0.8);
  bx(3.0, 0.6, 0.6, teal.face, 0, 0.25, 0.8);
  for (let k = 0; k < 10; k++) bx(0.24, 0.58, 0.02, k % 2 ? teal.alt : teal.edge, -1.35 + 0.3 * k, 0.26, 1.11);
  bx(3.1, 0.06, 0.7, white.face, 0, 0.85, 0.8);
  bx(3.1, 0.012, 0.7, white.top, 0, 0.91, 0.8);
  bx(3.1, 0.04, 0.04, white.edge, 0, 0.87, 1.17);

  // display tray tilted toward the customer: rims, ice bed, ice chunks, two rows of fish
  const tray = new THREE.Group(); tray.position.set(-0.35, 0.93, 0.78); tray.rotation.x = 0.1; g.add(tray);
  bx(1.9, 0.04, 0.56, wood.face, 0, 0, 0, tray);
  for (const z of [0.26, -0.26]) bx(1.9, 0.1, 0.04, wood.edge, 0, 0.04, z, tray);
  for (const x of [0.93, -0.93]) bx(0.04, 0.1, 0.56, wood.edge, x, 0.04, 0, tray);
  bx(1.8, 0.06, 0.46, ice, 0, 0.04, 0, tray);
  for (let k = 0; k < 14; k++) add(new THREE.IcosahedronGeometry(0.05, 0), ice, -0.8 + 0.123 * k, 0.11 + 0.02 * (k % 3), (k % 2 ? 0.14 : -0.15), tray);
  for (let k = 0; k < 12; k++) { const f = add(new THREE.CapsuleGeometry(0.045, 0.2, 3, 6), k % 2 ? fishA : fishB, -0.78 + 0.14 * k, 0.13, (k % 2 ? 0.07 : -0.05), tray); f.rotation.x = PI / 2; f.rotation.z = 0.15 * ((k % 3) - 1); }

  // two stacked crates at the right end of the counter
  for (let i = 0; i < 2; i++) {
    const y0 = 0.92 + 0.32 * i, cx = 1.15, cz = 0.8;
    bx(0.5, 0.3, 0.36, wood.alt, cx, y0, cz);
    for (let s = 0; s < 2; s++) bx(0.52, 0.02, 0.38, wood.base, cx, y0 + 0.09 + 0.11 * s, cz);
    bx(0.52, 0.012, 0.38, wood.top, cx, y0 + 0.3, cz);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bx(0.04, 0.3, 0.04, wood.edge, cx + sx * 0.24, y0, cz + sz * 0.17);
  }

  // pitched awning: two slabs, five red stripe boxes each, painted eave edges, ridge cap
  const pitch = Math.atan(0.6 / 1.2), L = Math.hypot(1.2, 0.6);
  for (const s of [1, -1]) {
    const side = new THREE.Group(); side.position.set(0, 2.5, s * 0.6); side.rotation.x = s * pitch; g.add(side);
    bx(3.1, 0.05, L, canvasW.top, 0, -0.025, 0, side);
    for (let k = 0; k < 5; k++) bx(0.31, 0.02, L, canvasR.face, -1.24 + 0.62 * k, 0.025, 0, side);
    bx(3.14, 0.04, 0.05, canvasW.edge, 0, 0.02, s * (L / 2 - 0.02), side);
  }
  bx(3.14, 0.06, 0.14, canvasR.edge, 0, 2.77, 0);
  // scalloped valance on both eaves
  for (const s of [1, -1]) {
    bx(3.0, 0.1, 0.04, canvasR.alt, 0, 2.1, s * 1.22);
    for (let k = 0; k < 10; k++) { const sc = add(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 6, 1, false, -PI / 2, PI), k % 2 ? canvasW.face : canvasR.face, -1.35 + 0.3 * k, 2.1, s * 1.22); sc.rotation.x = PI / 2; }
  }
  // hanging scale under the front eave rail
  cyl(0.02, 0.02, 0.38, 6, iron.face, 0.25, 1.72, 1.0);
  bx(0.5, 0.04, 0.04, iron.face, 0.25, 1.7, 1.0);
  for (const sx of [-1, 1]) { cyl(0.02, 0.02, 0.24, 6, iron.alt, 0.25 + sx * 0.22, 1.46, 1.0); cyl(0.12, 0.08, 0.04, 10, iron.edge, 0.25 + sx * 0.22, 1.42, 1.0); }
  // chalkboard on the front left post
  bx(0.36, 0.46, 0.04, wood.face, -1.4, 1.15, 1.17);
  bx(0.28, 0.38, 0.02, board, -1.4, 1.19, 1.19);

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
