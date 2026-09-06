// jetty_module c2: the reference read as a heavy timber frame. Tapered piles, doubled side
// rails (two horizontal bands on each long side as the concept shows), diagonal cross braces in
// the outer bays, cross bearers, planks across with a few visible nail heads, posts with a
// two turn rope wrap and a chamfered cap, a teal handrail with balusters on the -Z side, three
// crates at the +X end and the rope coil at the -X end. 8 x 2.5 x 1.5 m, long axis X.
// Round 2 (triangle budget, 9 placed): rope wraps 4 x 8, coil 6 x 12/10/8, piles at 10 segments, 24 planks
// (0.31 m) each with its bleached top, nail heads dropped, one slat band per crate. 5808 -> about 3200 tris.
export default function (THREE) {
  const g = new THREE.Group();
  const col = (hex, l = 0, s = 0) => new THREE.Color(hex).offsetHSL(0, s, l);
  const mat = (hex, name, rough, l = 0, s = 0, metal = 0) => {
    const m = new THREE.MeshStandardMaterial({ color: col(hex, l, s), roughness: rough, metalness: metal });
    if (name) m.name = name; return m;
  };
  const TIMBER = 0xb8925f, TEAL = 0x3f8f8a, ROPE = 0x6b5a45;
  const timbers = [mat(TIMBER, 'timber', 0.78), mat(TIMBER, 'timber', 0.8, -0.03), mat(TIMBER, 'timber', 0.76, 0.03, -0.02)];
  const timberTop = mat(TIMBER, 'timber', 0.72, 0.08, -0.05);
  const timberEdge = mat(TIMBER, 'timber', 0.72, 0.11);
  const timberDark = mat(TIMBER, 'timber', 0.85, -0.16, -0.05);
  const tide = mat(0xd9cdb5, 'timber', 0.8);
  const teal = mat(TEAL, 'timber', 0.7);
  const tealTop = mat(TEAL, 'timber', 0.68, 0.09, -0.04);
  const rope = mat(ROPE, 'fabric', 0.9);
  const iron = mat(0x3a3f46, 'metal', 0.45, 0, 0, 0.25);
  const add = (parent, geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); parent.add(o); return o;
  };
  const bx = (parent, w, h, d, m, x, y, z, rx, ry, rz) => add(parent, new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz);

  const L = 8, W = 2.5, DECK = 0.6, T = 0.05, POST = 1.05;
  const PX = [-3.6, 0, 3.6], PZ = [-1.0, 1.0];
  // Tapered piles with a dark base, tide mark, chamfered cap and a two turn rope wrap.
  for (const x of PX) for (const z of PZ) {
    add(g, new THREE.CylinderGeometry(0.14, 0.17, POST, 10), timbers[1], x, POST / 2, z);
    add(g, new THREE.CylinderGeometry(0.168, 0.178, 0.34, 10), timberDark, x, 0.17, z);
    add(g, new THREE.CylinderGeometry(0.168, 0.17, 0.06, 10), tide, x, 0.37, z);
    add(g, new THREE.CylinderGeometry(0.1, 0.145, 0.05, 10), timberTop, x, POST + 0.02, z);
    for (let k = 0; k < 2; k++) add(g, new THREE.TorusGeometry(0.165, 0.036, 4, 8), rope, x, DECK + 0.23 + k * 0.07, z, Math.PI / 2, 0, 0);
  }
  // Doubled side rails on the outside of the piles, one high and one low, with bolt heads.
  for (const z of [-1.2, 1.2]) {
    bx(g, L, 0.14, 0.1, timbers[0], 0, 0.5, z);
    bx(g, L - 0.4, 0.12, 0.09, timbers[2], 0, 0.22, z);
    for (const x of PX) for (const y of [0.5, 0.22]) add(g, new THREE.CylinderGeometry(0.025, 0.025, 0.03, 6), iron, x, y, z + Math.sign(z) * 0.055, Math.PI / 2, 0, 0);
  }
  // Diagonal braces in the two outer bays on each long side.
  const bayLen = 3.6, braceLen = Math.hypot(bayLen - 0.5, 0.36);
  const ang = Math.atan2(0.36, bayLen - 0.5);
  for (const z of [-1.28, 1.28]) for (const [xc, sgn] of [[-1.8, 1], [1.8, -1]]) bx(g, braceLen, 0.08, 0.06, timbers[1], xc, 0.36, z, 0, 0, sgn * ang);
  // Cross bearers under the deck at each pile station and between.
  for (const x of [-3.6, -1.8, 0, 1.8, 3.6]) bx(g, 0.15, 0.09, W - 0.1, timbers[2], x, DECK - 0.045, 0);
  // Planks across the jetty with bleached tops, nail heads at the pile stations every plank.
  const n = 24, pitch = L / n;
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + pitch * (i + 0.5);
    bx(g, pitch - 0.02, T, W - 0.02, timbers[i % 3], x, DECK + T / 2, 0);
    bx(g, pitch - 0.03, 0.012, W - 0.04, timberTop, x, DECK + T + 0.005, 0);
  }
  for (const z of [-1, 1]) bx(g, L, 0.08, 0.04, timberEdge, 0, DECK + T - 0.04, z * (W / 2 + 0.02));
  // Handrail on the -Z side with balusters between the posts.
  const zr = -1.0, railY = 1.5;
  bx(g, L - 0.2, 0.07, 0.09, teal, 0, railY, zr);
  bx(g, L - 0.2, 0.02, 0.1, tealTop, 0, railY + 0.045, zr);
  bx(g, L - 0.4, 0.05, 0.06, teal, 0, DECK + T + 0.12, zr);
  for (let x = -3.15; x <= 3.2; x += 0.9) bx(g, 0.06, railY - DECK - T - 0.04, 0.06, teal, x, DECK + T + (railY - DECK - T) / 2, zr);
  // Rope coil at the -X end.
  add(g, new THREE.TorusGeometry(0.22, 0.05, 6, 12), rope, -3.3, DECK + T + 0.05, 0.55, Math.PI / 2, 0, 0);
  add(g, new THREE.TorusGeometry(0.16, 0.05, 6, 10), rope, -3.3, DECK + T + 0.13, 0.55, Math.PI / 2, 0, 0);
  add(g, new THREE.TorusGeometry(0.1, 0.045, 6, 8), rope, -3.3, DECK + T + 0.2, 0.55, Math.PI / 2, 0, 0);
  // Three crates at the +X end.
  const crate = (x, y, z, s, ry) => {
    const c = new THREE.Group(); c.position.set(x, y, z); c.rotation.y = ry; g.add(c);
    bx(c, s, s * 0.8, s, timbers[0], 0, s * 0.4, 0);
    bx(c, s - 0.02, 0.015, s - 0.02, timberTop, 0, s * 0.8 + 0.007, 0);
    for (const e of [-1, 1]) { bx(c, s + 0.02, 0.05, 0.05, timberEdge, 0, s * 0.8 - 0.025, e * (s / 2 - 0.025)); bx(c, 0.05, 0.05, s + 0.02, timberEdge, e * (s / 2 - 0.025), s * 0.8 - 0.025, 0); }
    for (const e of [-1, 1]) { bx(c, s + 0.01, 0.02, 0.02, timberDark, 0, s * 0.4, e * (s / 2 + 0.005)); bx(c, 0.02, 0.02, s + 0.01, timberDark, e * (s / 2 + 0.005), s * 0.4, 0); }
  };
  crate(3.3, DECK + T, 0.5, 0.5, 0.15);
  crate(3.3, DECK + T + 0.4, 0.5, 0.42, -0.3);
  crate(3.25, DECK + T, -0.2, 0.42, 0.4);

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
