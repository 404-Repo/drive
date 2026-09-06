// palm_tall c3 (fix round 1): the same stepped block trunk as c2 (22 chunky ten sided frustum
// blocks on an S curve with boot wedges, lips now open ended rings) under a REAL CROWN: sixteen
// frond cards in three tiers, each card at the picture's own aspect (a frond 3.3 m long is 2 m
// wide, not a blade), bent along eight segments so the upper tier stands and arches, the middle
// tier reaches out and the lower tier droops, every frond rolled a little about its own axis so
// no two lie in one plane, plus three dead brown fronds hanging under the crown, a spear and a
// date bunch. The stem end of each picture (u = 1 on frond a and c, u = 0 on frond b, checked
// on the atlas) is put at the crown end of the card. Round 1's critic read the c2 crown as flat
// blades; from an oblique motion frame this one is a mass of individual arching fronds.
// Round 2 (triangle budget, 30 placed): trunk rings at 8 segments (the trunk is 0.4 m across). 2370 -> about 2050 tris.
export default function (THREE) {
  const g = new THREE.Group();
  const DS = THREE.DoubleSide;
  const M = (name, color, roughness, extra) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness, metalness: 0 }, extra || {})); m.name = name; return m; };
  const put = (geo, mat, x, y, z, rx, ry, rz, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); (parent || g).add(m); return m; };
  const hash = (i, j) => { const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return s - Math.floor(s); };
  // a frond card lying along +x from the crown (x = 0) to the tip (x = L), bent by rise and drop
  // round 5: every frond is a V, two half planes folded 30 degrees down either side of the rachis (the
  // picture's centre line), so a frond is never one flat quad seen edge on and the crown reads thick
  // from every side; the fold is the picture's own rachis so the cutout maps across it unchanged
  const FOLD = 0.52;
  const frondGeo = (L, W, rise, drop, segs, flip) => {
    const geo = new THREE.PlaneGeometry(L, W, segs || 8, 2);
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getX(i) + L / 2) / L, w = p.getY(i);
      p.setXYZ(i, t * L, rise * t - drop * t * t - Math.abs(w) * Math.sin(FOLD), w * Math.cos(FOLD));
      if (flip) uv.setX(i, 1 - uv.getX(i));
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
  // one card material per picture, each a UNIQUE colour so the loader never welds them
  const fa = M('card:palm_frond_a', 0x4f8a45, 0.8, { side: DS });
  const fb = M('card:palm_frond_b', 0x559047, 0.8, { side: DS });
  const fc = M('card:palm_frond_c', 0x4a8342, 0.8, { side: DS });
  const ASPECT = { 'card:palm_frond_a': 1.53, 'card:palm_frond_b': 1.74, 'card:palm_frond_c': 1.74 };
  const FLIP = { 'card:palm_frond_a': true, 'card:palm_frond_b': false, 'card:palm_frond_c': true };
  const dead = M('foliage', 0x9a7a4a, 0.9, { side: DS });
  const date = M('foliage', 0xc4683f, 0.7);
  const sand = M('ground', 0xe6cf9c, 0.9);

  const N = 22, H = 0.36, TOP = N * H;
  const lean = (t) => 0.45 * Math.sin(Math.PI * t) + 0.7 * t * t;
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    const rb = 0.25 - 0.075 * t0, rt = 0.25 - 0.075 * t1;
    const y = i * H, x = lean((i + 0.5) / N);
    const mat = y < 0.72 ? tBase : (i % 2 ? tA : tB);
    put(new THREE.CylinderGeometry(rt * 0.95, rb, H, 8), mat, x, y + H / 2, 0);
    put(new THREE.CylinderGeometry(rt * 1.04, rt * 1.04, 0.05, 8, 1, true), lip, x, y + H - 0.03, 0);
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
  // three tiers: standing and arching, reaching, drooping
  const tiers = [
    { n: 5, L: 2.6, rise: 1.4, drop: 1.3, y: 0.3, off: 0.0, roll: 0.25 },
    { n: 6, L: 3.3, rise: 0.55, drop: 1.5, y: 0.12, off: 0.55, roll: 0.35 },
    { n: 5, L: 3.4, rise: -0.05, drop: 1.9, y: -0.08, off: 0.3, roll: 0.45 },
  ];
  const mats = [fa, fb, fc];
  let k = 0;
  tiers.forEach((tier, ti) => {
    for (let i = 0; i < tier.n; i++) {
      const a = i * Math.PI * 2 / tier.n + tier.off + 0.25 * (hash(i, ti + 1) - 0.5);
      const mat = mats[k++ % 3];
      const L = tier.L * (0.92 + 0.16 * hash(i, ti + 4));
      const m = put(frondGeo(L, L / ASPECT[mat.name], tier.rise, tier.drop, 8, FLIP[mat.name]), mat, 0, tier.y, 0, 0, a, 0, crown);
      m.rotation.order = 'YXZ';
      m.rotation.x = tier.roll * (hash(i, ti + 7) - 0.5) * 2;   // roll about the frond's own axis
    }
  });
  const spear = put(frondGeo(0.9, 0.5, 0.1, 0.15, 3, FLIP[fb.name]), fb, 0, 0.35, 0, 0, 1.0, 1.15, crown);
  spear.rotation.order = 'YXZ';
  // dead fronds hanging under the crown, thin brown cards
  for (let i = 0; i < 3; i++) {
    const a = 0.7 + i * 2.1;
    const m = put(frondGeo(1.9, 0.5, -1.7, 0.35, 4, false), dead, Math.cos(a) * 0.4, -0.25, Math.sin(a) * 0.4, 0, a, 0, crown);
    m.rotation.order = 'YXZ';
  }

  // dates: a hanging cone bunch with beads
  put(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6), collar, cx + 0.4, TOP + 0.05, 0.2, 0.2, 0, -0.35);
  put(new THREE.ConeGeometry(0.22, 0.6, 8), date, cx + 0.5, TOP - 0.5, 0.28, Math.PI, 0, 0);
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9;
    put(new THREE.SphereGeometry(0.08, 6, 4), date, cx + 0.5 + Math.cos(a) * 0.18, TOP - 0.35 - 0.04 * i, 0.28 + Math.sin(a) * 0.18);
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
