// fishing_boat c1: lofted hull. Eight stations along Z each carry a half section curve from the
// gunwale down to the keel; the hull is swept between them as three vertical bands (teal upper,
// kerb red boot top, darker underwater), all DoubleSide, with a squared transom cap, a deck
// ribbon following the sheer, a whitewash gunwale band and cap rail lofted the same way. On deck:
// plaster wheelhouse with a stepped terracotta roof and three windows, mast, raked boom, furled
// canvas sail, net, coral fenders, bow tyre. 3 x 8.5 x 3.6 m, bow +Z, keel at y 0, waterline 0.5.
// Joint: hull, pivot at the waterline midships.
export default function (THREE) {
  const g = new THREE.Group();
  const col = (hex, l = 0, s = 0) => new THREE.Color(hex).offsetHSL(0, s, l);
  const mat = (hex, name, rough, l = 0, s = 0, metal = 0, side) => {
    const m = new THREE.MeshStandardMaterial({ color: col(hex, l, s), roughness: rough, metalness: metal, side: side || THREE.FrontSide });
    if (name) m.name = name; return m;
  };
  const DS = THREE.DoubleSide;
  const TEAL = 0x3f8f8a, WHITE = 0xf1e6d2, RED = 0xd6402f, TERRA = 0xc4683f, TIMBER = 0xb8925f;
  const teal = mat(TEAL, 'timber', 0.7, 0, 0, 0, DS);
  const tealDark = mat(TEAL, 'timber', 0.75, -0.12, -0.05, 0, DS);
  const tealEdge = mat(TEAL, 'timber', 0.68, 0.1);
  const white = mat(WHITE, 'timber', 0.7, 0, 0, 0, DS);
  const whiteTop = mat(WHITE, 'timber', 0.66, 0.04, -0.03, 0, DS);
  const plaster = mat(WHITE, 'plaster', 0.8, -0.02);
  const plasterBase = mat(WHITE, 'plaster', 0.85, -0.14, -0.03);
  const red = mat(RED, 'timber', 0.6, 0, 0, 0, DS);
  const tile = mat(TERRA, 'tile', 0.8);
  const tileTop = mat(TERRA, 'tile', 0.78, 0.08, -0.05);
  const deck = mat(TIMBER, 'timber', 0.8, 0.04, 0, 0, DS);
  const deckLine = mat(TIMBER, 'timber', 0.85, -0.12);
  const mast = mat(0xa88a62, 'timber', 0.75);
  const canvas = mat(0xe8dcc3, 'fabric', 0.85, 0, 0, 0, DS);
  const canvasTop = mat(0xe8dcc3, 'fabric', 0.85, 0.03);
  const net = mat(0x2f5e3a, 'fabric', 0.9);
  const netB = mat(0x2f5e3a, 'fabric', 0.9, 0.05);
  const coral = mat(0xed5851, 'metal', 0.45, 0, 0, 0.1);
  const iron = mat(0x3a3f46, 'metal', 0.45, 0, 0, 0.25);
  const rope = mat(0x6b5a45, 'fabric', 0.9);
  const rubber = mat(0x232528, null, 0.85);
  const glass = new THREE.MeshStandardMaterial({ color: 0x8fa9d6, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.85 });
  const add = (parent, geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); parent.add(o); return o;
  };
  const bx = (parent, w, h, d, m, x, y, z, rx, ry, rz) => add(parent, new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz);
  const V2 = (x, y) => new THREE.Vector2(x, y);

  const hull = new THREE.Group(); hull.name = 'boat_hull'; hull.position.set(0, 0.5, 0); g.add(hull);
  const H = new THREE.Group(); H.position.y = -0.5; hull.add(H);
  // Stations: z, half beam at the gunwale, gunwale y, keel y.
  const S = [
    { z: -4.25, hb: 1.05, gy: 1.32, ky: 0.22 },
    { z: -3.3, hb: 1.33, gy: 1.28, ky: 0.04 },
    { z: -1.7, hb: 1.47, gy: 1.26, ky: 0.0 },
    { z: 0.0, hb: 1.5, gy: 1.28, ky: 0.0 },
    { z: 1.6, hb: 1.4, gy: 1.38, ky: 0.02 },
    { z: 2.9, hb: 1.05, gy: 1.56, ky: 0.15 },
    { z: 3.8, hb: 0.52, gy: 1.78, ky: 0.45 },
    { z: 4.25, hb: 0.07, gy: 1.95, ky: 0.95 },
  ];
  // Section point: t = 0 at the gunwale, 1 at the keel. Full bilge, vertical topsides.
  const sec = (s, t, off = 0) => { const y = s.gy + (s.ky - s.gy) * t; const x = s.hb * Math.sqrt(Math.max(0, 1 - Math.pow(t, 2.3))) + off; return [x, y]; };
  const tAt = (s, y) => Math.min(1, Math.max(0, (s.gy - y) / (s.gy - s.ky)));
  // Loft a band between two functions of station -> [x, y], both sides, quads between stations.
  const loft = (fA, fB, m, N = 4) => {
    const pos = [], idx = [];
    for (const side of [1, -1]) {
      const base = pos.length / 3;
      for (let i = 0; i < S.length; i++) {
        const a = fA(S[i]), b = fB(S[i]);
        for (let j = 0; j <= N; j++) {
          const u = j / N;
          // interpolate along the section curve between the two t values
          const t = a[2] + (b[2] - a[2]) * u; const p = sec(S[i], t, a[3] || 0);
          pos.push(side * p[0], p[1], S[i].z);
        }
      }
      for (let i = 0; i < S.length - 1; i++) for (let j = 0; j < N; j++) {
        const a = base + i * (N + 1) + j, b = a + 1, c = a + (N + 1), d = c + 1;
        if (side === 1) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    return add(H, geo, m, 0, 0, 0);
  };
  const T = (t, off = 0) => (s) => [0, 0, t, off];
  const Y = (y, off = 0) => (s) => [0, 0, tAt(s, y), off];
  loft(T(0), Y(0.56), teal, 3);            // topsides
  loft(Y(0.56), Y(0.36), red, 1);          // boot top
  loft(Y(0.36), T(1), tealDark, 4);        // underwater, darker base band
  // Gunwale: a whitewash band 0.14 deep proud of the hull, and a flat cap rail on top.
  loft(T(0, 0.03), (s) => [0, 0, tAt(s, s.gy - 0.14), 0.03], white, 1);
  {
    const pos = [], idx = [];
    for (const side of [1, -1]) {
      const base = pos.length / 3;
      for (const s of S) { pos.push(side * (s.hb + 0.04), s.gy + 0.02, s.z, side * Math.max(0, s.hb - 0.1), s.gy + 0.02, s.z); }
      for (let i = 0; i < S.length - 1; i++) { const a = base + i * 2, b = a + 1, c = a + 2, d = c + 1; if (side === 1) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    add(H, geo, whiteTop, 0, 0, 0);
  }
  // Transom cap: fan over the stern section.
  {
    const s = S[0], pos = [0, (s.gy + s.ky) / 2, s.z], idx = [], N = 6;
    for (let j = 0; j <= 2 * N; j++) { const t = j <= N ? j / N : (2 * N - j) / N; const side = j <= N ? 1 : -1; const p = sec(s, t); pos.push(side * p[0], p[1], s.z); }
    for (let j = 1; j <= 2 * N; j++) idx.push(0, j, j + 1);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    add(H, geo, teal, 0, 0, 0);
    bx(H, 2.0, 0.16, 0.05, red, 0, 0.46, s.z - 0.01);
    bx(H, 0.08, 0.7, 0.35, tealDark, 0, 0.5, s.z - 0.12);   // rudder
  }
  // Deck ribbon 0.2 below the gunwale, following the sheer.
  {
    const pos = [], idx = [];
    for (const s of S) { const t = tAt(s, s.gy - 0.2); const p = sec(s, t); pos.push(-p[0] * 0.995, p[1], s.z, p[0] * 0.995, p[1], s.z); }
    for (let i = 0; i < S.length - 1; i++) { const a = i * 2, b = a + 1, c = a + 2, d = c + 1; idx.push(a, c, b, b, c, d); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    add(H, geo, deck, 0, 0, 0);
  }
  const deckY = (z) => { for (let i = 0; i < S.length - 1; i++) if (z <= S[i + 1].z) { const u = (z - S[i].z) / (S[i + 1].z - S[i].z); return S[i].gy + (S[i + 1].gy - S[i].gy) * u - 0.2; } return S[S.length - 1].gy - 0.2; };
  const hbAt = (z) => { for (let i = 0; i < S.length - 1; i++) if (z <= S[i + 1].z) { const u = (z - S[i].z) / (S[i + 1].z - S[i].z); return S[i].hb + (S[i + 1].hb - S[i].hb) * u; } return 0.07; };
  for (let z = -3.8; z < 3.6; z += 0.5) bx(H, hbAt(z) * 1.9, 0.008, 0.02, deckLine, 0, deckY(z) + 0.006, z);
  // Stem post, bow tyre, two coral fenders on ropes.
  bx(H, 0.14, 0.75, 0.16, teal, 0, S[7].gy + 0.15, 4.2);
  bx(H, 0.16, 0.05, 0.18, tealEdge, 0, S[7].gy + 0.5, 4.2);
  add(H, new THREE.TorusGeometry(0.28, 0.1, 8, 16), rubber, 0, 1.5, 4.22);
  for (const z of [-0.6, 1.4]) {
    const x = hbAt(z) + 0.17;
    add(H, new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), rope, x - 0.1, deckY(z) + 0.1, z);
    add(H, new THREE.SphereGeometry(0.2, 14, 10), coral, x, deckY(z) - 0.2, z);
  }
  // Wheelhouse, roof, windows, door.
  const WZ = -2.2, WY = deckY(WZ) + 0.02;
  bx(H, 1.6, 1.8, 1.6, plaster, 0, WY + 0.9, WZ);
  bx(H, 1.62, 0.25, 1.62, plasterBase, 0, WY + 0.125, WZ);
  const win = (w, h, x, y, z, ry) => { const f = new THREE.Group(); f.position.set(x, y, z); f.rotation.y = ry; H.add(f); bx(f, w + 0.12, h + 0.12, 0.05, white, 0, 0, 0.02); bx(f, w, h, 0.08, glass, 0, 0, 0.02); };
  win(0.7, 0.6, 0, WY + 1.25, WZ + 0.8, 0);
  win(0.4, 0.55, 0.8, WY + 1.25, WZ + 0.2, Math.PI / 2);
  win(0.4, 0.55, -0.8, WY + 1.25, WZ + 0.2, -Math.PI / 2);
  win(0.5, 0.5, 0, WY + 1.25, WZ - 0.8, Math.PI);
  bx(H, 0.55, 1.2, 0.05, tealDark, 0.35, WY + 0.65, WZ - 0.8);
  const RY = WY + 1.8;
  bx(H, 1.9, 0.08, 1.9, tile, 0, RY + 0.04, WZ);
  bx(H, 1.92, 0.03, 1.92, tileTop, 0, RY + 0.08, WZ);
  for (let i = 0; i < 4; i++) bx(H, 1.9 - i * 0.42, 0.1, 1.9 - i * 0.42, i % 2 ? tileTop : tile, 0, RY + 0.13 + i * 0.09, WZ);
  bx(H, 0.4, 0.08, 0.4, tileTop, 0, RY + 0.5, WZ);
  // Mast (lathe with a taper and a truck), boom, furled sail as a ridged lathe, three ties.
  const MZ = 0.6, MY = deckY(MZ);
  add(H, new THREE.LatheGeometry([V2(0, 0), V2(0.09, 0), V2(0.07, 1.6), V2(0.055, 3.6 - MY - 0.05), V2(0.07, 3.6 - MY - 0.03), V2(0, 3.6 - MY)], 10), mast, 0, MY, MZ);
  add(H, new THREE.CylinderGeometry(0.075, 0.075, 0.06, 10), iron, 0, MY + 1.35, MZ);
  const boom = new THREE.Group(); boom.position.set(0, MY + 1.4, MZ); boom.rotation.x = -0.35; H.add(boom);
  add(boom, new THREE.CylinderGeometry(0.05, 0.05, 2.4, 10), mast, 0, 0, 1.2, Math.PI / 2, 0, 0);
  const sailGeo = new THREE.LatheGeometry([V2(0.02, 0), V2(0.14, 0.15), V2(0.2, 0.5), V2(0.17, 0.75), V2(0.22, 1.05), V2(0.18, 1.35), V2(0.21, 1.7), V2(0.12, 2.05), V2(0.02, 2.2)], 10);
  add(boom, sailGeo, canvas, 0, -0.18, 0.1, Math.PI / 2, 0, 0);
  for (const zz of [0.45, 1.1, 1.75]) add(boom, new THREE.TorusGeometry(0.2, 0.02, 4, 10), rope, 0, -0.16, zz);
  add(boom, new THREE.CapsuleGeometry(0.06, 1.8, 2, 8), canvasTop, 0, -0.04, 1.15, Math.PI / 2, 0, 0);
  // Forestay to the stem.
  const top = [0, 3.6 - 0.05, MZ], stem = [0, S[7].gy + 0.45, 4.2];
  const dl = Math.hypot(stem[1] - top[1], stem[2] - top[2]);
  add(H, new THREE.CylinderGeometry(0.02, 0.02, dl, 6), rope, 0, (top[1] + stem[1]) / 2, (top[2] + stem[2]) / 2, Math.atan2(stem[2] - top[2], stem[1] - top[1]), 0, 0);
  // Net coil and a foredeck hatch.
  const nm = add(H, new THREE.SphereGeometry(0.55, 14, 10), net, -0.4, deckY(-0.9) + 0.2, -0.9); nm.scale.set(1.2, 0.55, 1);
  add(H, new THREE.TorusGeometry(0.42, 0.1, 6, 14), netB, -0.4, deckY(-0.9) + 0.32, -0.9, Math.PI / 2, 0, 0);
  bx(H, 0.9, 0.12, 0.7, deckLine, 0, deckY(2.6) + 0.06, 2.6);
  bx(H, 0.92, 0.02, 0.72, deck, 0, deckY(2.6) + 0.13, 2.6);

  g.userData.joints = { hull };

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
