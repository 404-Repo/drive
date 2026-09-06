// palm_short c2 (fix round 1): c1's planter palm with a real crown. Sixteen frond cards in two
// tiers at the picture's own aspect (not stretched into blades), bent along eight segments,
// rolled about their own axis, the stem end of each picture at the crown (u = 1 on frond a is
// flipped, checked on the atlas); rope tori and lips at lower segment counts.
// A promenade palm planted in a tall tapered column planter. Lathe and cylinder stack: stone shade base band, cream plaster drums
// alternating with painted teal timber bands, a dark metal ring, a rope collar of tori (fabric),
// a terracotta pot rim (tile), then the crown: 14 frond cards in two tiers, a spear, two dead
// fronds, a small ochre and teal leaf tuft at the foot and a sand fillet. Card length along u.
export default function (THREE) {
  const g = new THREE.Group();
  const DS = THREE.DoubleSide;
  const M = (name, color, roughness, extra) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness, metalness: 0 }, extra || {})); m.name = name; return m; };
  const put = (geo, mat, x, y, z, rx, ry, rz, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); (parent || g).add(m); return m; };
  const V2 = (x, y) => new THREE.Vector2(x, y);
  const hash = (i, j) => { const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return s - Math.floor(s); };
  const frondGeo = (L, W, rise, drop, segs, flip) => {
    const geo = new THREE.PlaneGeometry(L, W, segs || 8, 1);
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getX(i) + L / 2) / L, w = p.getY(i);
      p.setXYZ(i, t * L, rise * t - drop * t * t, w);
      if (flip) uv.setX(i, 1 - uv.getX(i));
    }
    geo.computeVertexNormals();
    return geo;
  };

  const baseBand = M('stone', 0x8d7b63, 0.85);
  const cream = M('plaster', 0xe3d5b8, 0.8);
  const creamTop = M('plaster', 0xf1e6d2, 0.75);
  const teal = M('timber', 0x3f8f8a, 0.7);
  const tealLip = M('timber', 0x53a09a, 0.65);
  const ring = M('metal', 0x3a3f46, 0.45, { metalness: 0.2 });
  const rope = M('fabric', 0xb8956a, 0.9);
  const pot = M('tile', 0xc4683f, 0.75);
  const potLip = M('tile', 0xd47c52, 0.7);
  const fa = M('card:palm_frond_a', 0x4f8a45, 0.8, { side: DS });
  const fb = M('card:palm_frond_b', 0x559047, 0.8, { side: DS });
  const dead = M('foliage', 0x9a7a4a, 0.9, { side: DS });
  const tuftA = M('foliage', 0xe0a862, 0.85);
  const tuftB = M('foliage', 0x3f8f8a, 0.85);
  const sand = M('ground', 0xe6cf9c, 0.9);

  const H = 4.3, R0 = 0.55, R1 = 0.36;
  const rad = (y) => R0 - (R0 - R1) * (y / H);
  const drum = (y0, y1, mat, grow) => {
    const s = grow || 1;
    put(new THREE.CylinderGeometry(rad(y1) * s, rad(y0) * s, y1 - y0, 14), mat, 0, (y0 + y1) / 2, 0);
  };
  drum(0, 0.55, baseBand, 1.04);
  let y = 0.55;
  const pattern = [0.55, 0.25, 0.55, 0.25, 0.55, 0.25, 0.55, 0.25, 0.55];
  pattern.forEach((h, i) => {
    const isTeal = i % 2 === 1;
    drum(y, y + h, isTeal ? teal : cream, isTeal ? 1.05 : 1.0);
    // painted lip on each drum top edge
    put(new THREE.CylinderGeometry(rad(y + h) * (isTeal ? 1.07 : 1.03), rad(y + h) * (isTeal ? 1.07 : 1.03), 0.04, 14), isTeal ? tealLip : creamTop, 0, y + h - 0.02, 0);
    y += h;
  });
  // metal rings, rope collar, pot rim
  put(new THREE.CylinderGeometry(rad(H) * 1.08, rad(H) * 1.08, 0.1, 14), ring, 0, H + 0.05, 0);
  for (let i = 0; i < 4; i++) put(new THREE.TorusGeometry(rad(H) * 0.98, 0.06, 6, 12), rope, 0, H + 0.17 + i * 0.11, 0, Math.PI / 2, 0, 0);
  put(new THREE.CylinderGeometry(rad(H) * 1.1, rad(H) * 1.08, 0.1, 14), ring, 0, H + 0.64, 0);
  put(new THREE.CylinderGeometry(0.46, 0.4, 0.3, 14), pot, 0, H + 0.84, 0);
  put(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 14), potLip, 0, H + 1.0, 0);
  const TOP = H + 1.03;

  const crown = new THREE.Group(); crown.position.set(0, TOP + 0.15, 0); g.add(crown);
  put(new THREE.SphereGeometry(0.42, 10, 6), M('foliage', 0x447a3c, 0.85), 0, 0.05, 0, 0, 0, 0, crown);
  // upper tier: 8 fronds standing and arching; lower tier: 8 fronds reaching out and drooping
  const ASPECT = { 'card:palm_frond_a': 1.53, 'card:palm_frond_b': 1.74 };
  const FLIP = { 'card:palm_frond_a': true, 'card:palm_frond_b': false };
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + 0.1 + 0.2 * (hash(i, 1) - 0.5), mat = i % 2 ? fa : fb, L = 2.7 * (0.92 + 0.16 * hash(i, 2));
    const m = put(frondGeo(L, L / ASPECT[mat.name], 1.2, 1.3, 8, FLIP[mat.name]), mat, 0, 0.22, 0, 0, a, 0, crown);
    m.rotation.order = 'YXZ'; m.rotation.x = 0.5 * (hash(i, 3) - 0.5);
  }
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8 + 0.1 + 0.2 * (hash(i, 4) - 0.5), mat = i % 2 ? fb : fa, L = 2.95 * (0.92 + 0.16 * hash(i, 5));
    const m = put(frondGeo(L, L / ASPECT[mat.name], 0.25, 1.8, 8, FLIP[mat.name]), mat, 0, 0.0, 0, 0, a, 0, crown);
    m.rotation.order = 'YXZ'; m.rotation.x = 0.7 * (hash(i, 6) - 0.5);
  }
  const spear = put(frondGeo(0.8, 0.5, 0, 0.12, 3, FLIP[fa.name]), fa, 0, 0.3, 0, 0, 0.9, 1.3, crown);
  spear.rotation.order = 'YXZ';
  for (let i = 0; i < 2; i++) {
    const a = 0.6 + i * 3.0;
    const m = put(frondGeo(1.7, 0.45, -1.5, 0.3, 4, false), dead, Math.cos(a) * 0.45, -0.3, Math.sin(a) * 0.45, 0, a, 0, crown);
    m.rotation.order = 'YXZ';
  }

  // leaf tuft at the foot, ochre and teal
  for (let i = 0; i < 7; i++) {
    const a = 3.6 + i * 0.4, r = 0.62;
    const leaf = put(new THREE.ConeGeometry(0.07, 0.45, 5), i % 2 ? tuftB : tuftA, Math.cos(a) * r, 0.18, Math.sin(a) * r, 0, -a, 0);
    leaf.rotation.order = 'YZX';
    leaf.rotation.z = -1.0;
    leaf.scale.z = 0.45;
  }
  put(new THREE.LatheGeometry([V2(0, 0), V2(1.1, 0), V2(0.95, 0.1), V2(0.62, 0.22), V2(0.3, 0.3), V2(0, 0.32)], 14), sand, 0, 0, 0);

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
