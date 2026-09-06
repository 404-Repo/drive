// quay_edge_module c2: the reference read as pilasters and panels. Two proud corner pilasters
// with their own caps, three coping slabs between them, and the wall face between as pillowed
// blocks (a back plate plus a proud face panel per block, so each stone reads chunky) in two
// courses over a cooler stone shade base course. Ladder recessed beside the -X pilaster, two
// rings, a rubber fender on the coping edge. 6 x 1.2 x 1.6 m, water is -Z, back mounts.
export default function (THREE) {
  const g = new THREE.Group();
  const col = (hex, l = 0, s = 0) => new THREE.Color(hex).offsetHSL(0, s, l);
  const mat = (hex, name, rough, l = 0, s = 0, metal = 0) => {
    const m = new THREE.MeshStandardMaterial({ color: col(hex, l, s), roughness: rough, metalness: metal });
    if (name) m.name = name; return m;
  };
  const STONE = 0xcdb897, SHADE = 0x8d7b63, METAL = 0x3a3f46;
  const stones = [mat(STONE, 'stone', 0.8), mat(STONE, 'stone', 0.82, -0.03), mat(STONE, 'stone', 0.78, 0.03, -0.02), mat(STONE, 'stone', 0.8, 0.05, -0.03)];
  const stoneTop = mat(STONE, 'stone', 0.75, 0.08, -0.05);
  const stoneEdge = mat(STONE, 'stone', 0.75, 0.11);
  const shade = mat(SHADE, 'stone', 0.86, -0.02, -0.03);
  const mortar = mat(SHADE, 'stone', 0.9, -0.07);
  const iron = mat(METAL, 'metal', 0.45, 0, 0, 0.25);
  const ironEdge = mat(METAL, 'metal', 0.42, 0.1, 0, 0.25);
  const rubber = mat(0x232528, null, 0.85);
  const add = (parent, geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); parent.add(o); return o;
  };
  const bx = (parent, w, h, d, m, x, y, z, rx, ry, rz) => add(parent, new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz);
  let seed = 31;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  const L = 6, D = 1.2, H = 1.6, COP = 0.4, zF = -D / 2, zB = D / 2, PW = 0.7;
  // Fill mass (mortar coloured, shows only in the joints).
  bx(g, L - 2 * PW, H - COP, D - 0.12, mortar, 0, (H - COP) / 2, zF + 0.12 + (D - 0.12) / 2);
  // Pillowed block: back plate full size, proud face panel inset 4 cm all round.
  const block = (x, y, z, w, h, m, proud) => {
    bx(g, w - 0.03, h - 0.03, 0.08, m, x, y, z + 0.04);
    bx(g, w - 0.11, h - 0.11, proud, m, x, y, z - proud / 2 + 0.001);
  };
  // Base course 0..0.4 in shade, then two courses 0.4 tall of blocks 0.9 long between pilasters.
  const x0 = -L / 2 + PW, x1 = L / 2 - PW, span = x1 - x0;   // 4.6
  for (let ci = 0; ci < 3; ci++) {
    const y = ci * 0.4 + 0.2;
    const n = ci % 2 ? 5 : 6;
    const bl = span / n;
    for (let i = 0; i < n; i++) {
      const m = ci === 0 ? shade : stones[Math.floor(rnd() * stones.length)];
      block(x0 + bl * (i + 0.5), y, zF, bl, 0.4, m, 0.04 + rnd() * 0.02);
      if (ci > 0) bx(g, bl - 0.14, 0.03, 0.03, stoneEdge, x0 + bl * (i + 0.5), y + 0.2 - 0.07, zF - 0.045);
    }
  }
  // Pilasters: proud 0.08 at both ends, full height, with a bigger cap block 0.1 above the coping.
  for (const s of [-1, 1]) {
    const px = s * (L / 2 - PW / 2);
    bx(g, PW, 0.4, D + 0.08, shade, px, 0.2, 0.0 - 0.04);
    bx(g, PW, H - COP - 0.4, D + 0.08, stones[1], px, 0.4 + (H - COP - 0.4) / 2, -0.04);
    bx(g, PW + 0.06, COP + 0.06, D + 0.14, stones[3], px, H - COP / 2 + 0.03, -0.07);
    bx(g, PW + 0.06, 0.04, D + 0.14, stoneTop, px, H + 0.06 - 0.02, -0.07);
    bx(g, PW + 0.06, 0.04, 0.04, stoneEdge, px, H + 0.06 - 0.02, zF - 0.14 + 0.02);
    bx(g, PW + 0.06, 0.04, 0.04, stoneEdge, px, H + 0.06 - 0.02, zB - 0.02);
    // pilaster joints
    bx(g, PW - 0.04, 0.03, 0.02, mortar, px, 0.8, zF - 0.04 - 0.006);
    bx(g, 0.02, 0.03, D, mortar, px + s * (PW / 2 + 0.006), 0.8, -0.04);
  }
  // Coping between pilasters: three slabs, bleached tops, rounded nose as a half round.
  const cw = span / 3;
  for (let i = 0; i < 3; i++) {
    const cx = x0 + cw * (i + 0.5);
    bx(g, cw - 0.03, COP, D - 0.15, stones[i % 3], cx, H - COP / 2, 0.075);
    bx(g, cw - 0.03, 0.04, D - 0.15, stoneTop, cx, H - 0.02, 0.075);
    bx(g, cw - 0.03, 0.05, 0.05, stoneEdge, cx, H - 0.025, zB - 0.025);
  }
  add(g, new THREE.CylinderGeometry(0.2, 0.2, span, 14, 1, false, 0, Math.PI), stoneTop, 0, H - 0.2, zF + 0.2, 0, Math.PI, Math.PI / 2);
  bx(g, span, COP - 0.2, 0.2, stones[0], 0, H - COP + (COP - 0.2) / 2, zF + 0.1);
  // Fender: rubber strip along the nose between the pilasters.
  add(g, new THREE.CylinderGeometry(0.075, 0.075, span - 0.05, 10), rubber, 0, H - 0.06, zF + 0.05, 0, 0, Math.PI / 2);
  bx(g, span - 0.05, 0.15, 0.06, rubber, 0, H - 0.06, zF + 0.08);

  // Ladder beside the -X pilaster, recessed into the face.
  const lx = x0 + 0.4;
  bx(g, 0.62, H - COP - 0.02, 0.16, mortar, lx, (H - COP) / 2, zF + 0.08);
  for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(0.03, 0.03, H - 0.1, 8), iron, lx + s * 0.25, (H - 0.1) / 2 + 0.05, zF + 0.05);
  for (let i = 0; i < 5; i++) add(g, new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), iron, lx, 0.25 + i * 0.3, zF + 0.05, 0, 0, Math.PI / 2);
  for (const s of [-1, 1]) {
    add(g, new THREE.TorusGeometry(0.12, 0.03, 6, 10, Math.PI / 2), iron, lx + s * 0.25, H - 0.05 - 0.12, zF + 0.05 + 0.12, 0, Math.PI / 2, 0);
    add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.25, 8), iron, lx + s * 0.25, H - 0.05, zF + 0.05 + 0.12 + 0.125, Math.PI / 2, 0, 0);
  }
  // Two rings on plates.
  for (const rx of [-0.3, 1.5]) {
    bx(g, 0.2, 0.2, 0.04, iron, rx, 0.95, zF - 0.06);
    bx(g, 0.2, 0.02, 0.05, ironEdge, rx, 1.04, zF - 0.06);
    add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), iron, rx, 0.95, zF - 0.1, Math.PI / 2, 0, 0);
    add(g, new THREE.TorusGeometry(0.11, 0.025, 6, 14), iron, rx, 0.95 - 0.11, zF - 0.12);
  }

  g.userData.mounts = 'front';   // +Z is the land side, against the quay fill; water is -Z

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
