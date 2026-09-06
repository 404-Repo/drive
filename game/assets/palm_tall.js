// palm_tall c2: the reference's stepped block reading. The trunk is 22 chunky ten sided
// frustum blocks 0.36 m tall on a stronger S curve, each block carrying a protruding boot wedge
// on alternating sides (the notched steps in the image), two alternating tints, lighter lips, a
// darker base. A foliage core sphere hides the card junction; twelve fronds in three tiers of
// three lengths plus a spear; dates as a cone bunch with beads; a low sand cone.
export default function (THREE) {
  const g = new THREE.Group();
  const DS = THREE.DoubleSide;
  const M = (name, color, roughness, extra) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness, metalness: 0 }, extra || {})); m.name = name; return m; };
  const put = (geo, mat, x, y, z, rx, ry, rz, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); (parent || g).add(m); return m; };
  const frondGeo = (L, W, rise, drop, segs) => {
    const geo = new THREE.PlaneGeometry(L, W, segs || 6, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getX(i) + L / 2) / L, w = p.getY(i);
      p.setXYZ(i, t * L, rise * t - drop * t * t, w);
    }
    geo.computeVertexNormals();
    return geo;
  };

  const tA = M('foliage', 0xc39a5e, 0.8);
  const tB = M('foliage', 0xb88f55, 0.8);
  const tBase = M('foliage', 0x98744a, 0.85);
  const lip = M('foliage', 0xd8b072, 0.75);
  const boot = M('foliage', 0xa8804c, 0.85);
  const collar = M('foliage', 0x8a6a3e, 0.9);
  const core = M('foliage', 0x447a3c, 0.85);
  const fa = M('card:palm_frond_a', 0x4f8a45, 0.8, { side: DS });
  const fb = M('card:palm_frond_b', 0x559047, 0.8, { side: DS });
  const fc = M('card:palm_frond_c', 0x4a8342, 0.8, { side: DS });
  const date = M('foliage', 0xc4683f, 0.7);
  const sand = M('ground', 0xe6cf9c, 0.9);

  const N = 22, H = 0.36, TOP = N * H;
  const lean = (t) => 0.45 * Math.sin(Math.PI * t) + 0.7 * t * t;
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    const rb = 0.25 - 0.075 * t0, rt = 0.25 - 0.075 * t1;
    const y = i * H, x = lean((i + 0.5) / N);
    const mat = y < 0.72 ? tBase : (i % 2 ? tA : tB);
    put(new THREE.CylinderGeometry(rt * 0.95, rb, H, 10), mat, x, y + H / 2, 0);
    put(new THREE.CylinderGeometry(rt * 1.04, rt * 1.04, 0.05, 10), lip, x, y + H - 0.03, 0);
    // boot wedge on alternating sides
    const side = (i % 4) * Math.PI / 2 + 0.4;
    const r = rb * 0.95;
    put(new THREE.BoxGeometry(0.22, 0.16, 0.14), boot, x + Math.cos(side) * r, y + H * 0.72, Math.sin(side) * r, 0, -side, 0.15);
  }
  const cx = lean(1);
  put(new THREE.CylinderGeometry(0.22, 0.4, 0.45, 10), collar, cx, TOP + 0.18, 0);
  put(new THREE.CylinderGeometry(0.3, 0.22, 0.2, 10), collar, cx, TOP + 0.5, 0);

  const crown = new THREE.Group(); crown.position.set(cx, TOP + 0.4, 0); g.add(crown);
  put(new THREE.SphereGeometry(0.5, 10, 6), core, 0, 0.1, 0, 0, 0, 0, crown);
  const tiers = [
    { n: 4, L: 2.6, rise: 1.2, drop: 1.0, y: 0.25, off: 0.0 },
    { n: 4, L: 3.2, rise: 0.6, drop: 1.3, y: 0.1, off: 0.78 },
    { n: 4, L: 3.5, rise: 0.1, drop: 1.7, y: -0.05, off: 0.39 },
  ];
  let k = 0;
  tiers.forEach((tier) => {
    for (let i = 0; i < tier.n; i++) {
      const a = i * Math.PI / 2 + tier.off;
      const m = put(frondGeo(tier.L, 0.95, tier.rise, tier.drop), [fa, fb, fc][k++ % 3], 0, tier.y, 0, 0, a, 0, crown);
      m.rotation.order = 'YXZ';
    }
  });
  const spear = put(frondGeo(0.6, 0.45, 0, 0.1, 3), fb, 0, 0.35, 0, 0, 1.0, 1.1, crown);
  spear.rotation.order = 'YXZ';

  // dates: a hanging cone bunch with beads
  put(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8), collar, cx + 0.4, TOP + 0.05, 0.2, 0.2, 0, -0.35);
  put(new THREE.ConeGeometry(0.22, 0.6, 8), date, cx + 0.5, TOP - 0.5, 0.28, Math.PI, 0, 0);
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9;
    put(new THREE.SphereGeometry(0.08, 8, 6), date, cx + 0.5 + Math.cos(a) * 0.18, TOP - 0.35 - 0.04 * i, 0.28 + Math.sin(a) * 0.18);
  }

  put(new THREE.ConeGeometry(1.2, 0.36, 14), sand, 0, 0.18, 0);

  const box = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put2 = (mat) => { for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put2(m.multiplyMatrices(n.matrixWorld, im)); } return; }
    put2(n.matrixWorld);
  });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });
  return g;
}
