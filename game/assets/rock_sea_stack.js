// rock_sea_stack candidate 3: candidate 1 with the foam rings and the companion pulled in so the footprint lands on the 12 x 10 m brief. The pillar is one stepped LatheGeometry profile
// (ledges are steps in the profile) in 12 segments, split into a stone shade lower lathe and
// a warm stone upper lathe, then every vertex is pushed radially by a position hashed noise
// so the facets go irregular while the seams stay welded. Ledge lips are their own thin
// lighter lathes, the foam ring and the companion rock are lathes too. Gull and tufts on top.
export default function (THREE) {
  const g = new THREE.Group();
  const C = (hex, dl, ds) => new THREE.Color(hex).offsetHSL(0, ds || 0, dl || 0);
  const M = (name, hex, rough, dl, ds, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: C(hex, dl, ds), roughness: rough, metalness: 0 }, extra || {}));
    m.name = name; return m;
  };
  const mesh = (geo, mat, x, y, z, parent) => { const o = new THREE.Mesh(geo, mat); o.position.set(x || 0, y || 0, z || 0); (parent || g).add(o); return o; };
  const V2 = (x, y) => new THREE.Vector2(x, y);
  // radial jitter keyed on position so duplicated seam vertices move together; flat normals after
  const jitter = (geo, amp, seed) => {
    const p = geo.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const h = Math.sin(Math.round(v.x * 50) * 0.2589 + Math.round(v.y * 50) * 1.5646 + Math.round(v.z * 50) * 0.7543 + seed) * 43758.5453;
      const r = (h - Math.floor(h)) * 2 - 1;
      const len = Math.hypot(v.x, v.z);
      if (len > 0.01) p.setXYZ(i, v.x + v.x / len * r * amp, v.y, v.z + v.z / len * r * amp);
    }
    const n = geo.toNonIndexed(); n.computeVertexNormals(); return n;
  };
  const lathe = (pts, seg, amp, seed) => jitter(new THREE.LatheGeometry(pts, seg), amp, seed);

  const stone = M('stone', 0xcdb897, 0.85);
  const ledge = M('stone', 0xcdb897, 0.82, 0.08, -0.04, { side: THREE.DoubleSide });
  const top = M('stone', 0xcdb897, 0.8, 0.1, -0.06);
  const shade = M('stone', 0x8d7b63, 0.9);
  const shadeLedge = M('stone', 0x8d7b63, 0.88, 0.07, -0.02, { side: THREE.DoubleSide });
  const foam = M('ground', 0xf1e6d2, 0.9, 0, -0.05, { side: THREE.DoubleSide });
  const tuft = M('foliage', 0x2f5e3a, 0.9);
  const gullW = M('fabric', 0xf1e6d2, 0.8);
  const gullD = M('fabric', 0x3a3f46, 0.8);
  const beak = M('fabric', 0xc4683f, 0.8);

  // slabs: height, bottom radius, top radius. The profile steps out 0.35 at each ledge.
  const slabs = [[2.2, 4.6, 4.7], [2.0, 4.4, 4.6], [1.9, 4.5, 4.3], [2.1, 4.0, 4.4], [1.8, 4.2, 4.0], [1.7, 3.7, 3.9], [1.6, 3.5, 3.3]];
  const PX = -0.7, PZ = 0, SZ = 0.9, SPLIT = 4.8;
  const lower = [V2(0, 0)], upper = [];
  const lips = [];
  let y = 0;
  for (const [h, rb, rt] of slabs) {
    const seq = y < SPLIT ? lower : upper;
    if (seq === upper && upper.length === 0) upper.push(V2(lower[lower.length - 1].x, y));
    seq.push(V2(rb, y), V2(rt, y + h - 0.3), V2(rt + 0.35, y + h - 0.25), V2(rt + 0.35, y + h));
    lips.push([rt, y + h, y < SPLIT]);
    y += h;
  }
  upper.push(V2(0, y));
  const lo = mesh(lathe(lower, 12, 0.22, 1.0), shade, PX, 0, PZ); lo.scale.z = SZ;
  const up = mesh(lathe(upper, 12, 0.22, 1.0), stone, PX, 0, PZ); up.scale.z = SZ;
  for (const [rt, ly, low] of lips) {
    const lip = mesh(lathe([V2(rt - 0.1, ly + 0.001), V2(rt + 0.38, ly + 0.001), V2(rt + 0.36, ly - 0.06)], 12, 0.22, 1.0), low ? shadeLedge : ledge, PX, 0, PZ);
    lip.scale.z = SZ;
  }
  const TOP = y;
  const capg = lathe([V2(0, TOP + 0.1), V2(3.2, TOP + 0.1), V2(3.4, TOP - 0.02)], 12, 0.2, 1.0);
  mesh(capg, top, PX, 0, PZ).scale.z = SZ;

  // foam ring
  const ring = mesh(lathe([V2(4.2, 0.05), V2(4.8, 0.5), V2(5.1, 0.45), V2(5.4, 0.05)], 20, 0.25, 7.0), foam, PX, 0, PZ);
  ring.scale.z = SZ;

  // tufts and gull
  for (const [tx, tz, r] of [[1.0, 1.3, 0.7], [-3.0, -1.6, 0.6]]) {
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1;
      const cone = mesh(new THREE.ConeGeometry(r * 0.45, r * 1.1, 6), tuft, PX + tx + Math.cos(a) * r * 0.35, TOP + r * 0.5, PZ + tz + Math.sin(a) * r * 0.35);
      cone.rotation.z = Math.cos(a) * 0.35; cone.rotation.x = Math.sin(a) * 0.35;
    }
  }
  const gx = PX - 1.6, gz = PZ + 1.8;
  const body = mesh(new THREE.SphereGeometry(0.28, 10, 8), gullW, gx, TOP + 0.3, gz); body.scale.set(1, 0.8, 1.5);
  mesh(new THREE.SphereGeometry(0.16, 10, 8), gullW, gx, TOP + 0.58, gz + 0.32);
  const bk = mesh(new THREE.ConeGeometry(0.06, 0.2, 6), beak, gx, TOP + 0.58, gz + 0.5); bk.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) { const w = mesh(new THREE.BoxGeometry(0.2, 0.06, 0.55), gullD, gx + s * 0.2, TOP + 0.36, gz - 0.05); w.rotation.z = s * 0.35; }
  mesh(new THREE.BoxGeometry(0.16, 0.05, 0.25), gullD, gx, TOP + 0.3, gz - 0.45);
  for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 6), beak, gx + s * 0.08, TOP + 0.07, gz);

  // companion rock: a two step lathe, shade below, a ledge lip and a bleached top
  const CX = 4.0, CZ = 1.0;
  mesh(lathe([V2(0, 0), V2(1.75, 0), V2(1.65, 1.4), V2(1.95, 1.5), V2(1.95, 1.6), V2(0, 1.6)], 8, 0.15, 3.0), shade, CX, 0, CZ);
  mesh(lathe([V2(1.6, 1.6), V2(1.3, 3.7), V2(1.45, 3.85), V2(1.2, 4.0), V2(0, 4.0)], 8, 0.15, 3.0), stone, CX, 0, CZ);
  mesh(lathe([V2(0, 4.01), V2(1.1, 4.01), V2(1.2, 3.96)], 8, 0.1, 3.0), top, CX, 0, CZ);
  mesh(lathe([V2(1.5, 0.05), V2(1.8, 0.3), V2(2.0, 0.28), V2(2.1, 0.05)], 14, 0.12, 9.0), foam, CX, 0, CZ);

  const box3 = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put = (mat) => { for (let i = 0; i < p.count; i++) box3.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put(m.multiplyMatrices(n.matrixWorld, im)); } return; }
    put(n.matrixWorld);
  });
  const c = box3.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box3.min.y; o.position.z -= c.z; });
  return g;
}
