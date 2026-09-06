// results_podium c2 (pass 2: lower kerb, discs sized to the visible face): a second reading of the shape. Every mass is a hand built chamfered
// box BufferGeometry (all twelve edges carry a 5 cm chamfer face in the lighter painted
// tint, the up face is a separate bleached surface). The three blocks are separated by
// small reveals, the coral band is a chamfered collar, the kerb stripes are chamfered
// blocks, the discs carry pips and the whole thing stands on a chamfered plinth.
export default function (THREE) {
  const g = new THREE.Group();
  const PI = Math.PI;
  const mat = (name, hex, rough, metal, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: metal || 0 }, extra || {}));
    if (name) m.name = name; return m;
  };
  const mesh = (parent, geo, m, x, y, z, rx, ry, rz) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.rotation.set(rx || 0, ry || 0, rz || 0); parent.add(o); return o;
  };
  // chamfered box centred on the origin: returns three geometries (sides, top, chamfers)
  const chamferBox = (w, h, d, c) => {
    const P = (sx, sy, sz, k) => k === 'x' ? [sx * w / 2, sy * (h / 2 - c), sz * (d / 2 - c)]
      : k === 'y' ? [sx * (w / 2 - c), sy * h / 2, sz * (d / 2 - c)] : [sx * (w / 2 - c), sy * (h / 2 - c), sz * d / 2];
    const sides = [], top = [], chams = [];
    const poly = (arr, pts) => {
      const n = pts.length; let cx = 0, cy = 0, cz = 0;
      for (const p of pts) { cx += p[0] / n; cy += p[1] / n; cz += p[2] / n; }
      const [a, b, e] = pts;
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = e[0] - a[0], vy = e[1] - a[1], vz = e[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * cx + ny * cy + nz * cz < 0) pts = pts.slice().reverse();
      for (let i = 1; i < n - 1; i++) arr.push(...pts[0], ...pts[i], ...pts[i + 1]);
    };
    const S = [-1, 1];
    for (const s of S) {
      poly(sides, [P(s, -1, -1, 'x'), P(s, 1, -1, 'x'), P(s, 1, 1, 'x'), P(s, -1, 1, 'x')]);
      poly(s > 0 ? top : sides, [P(-1, s, -1, 'y'), P(1, s, -1, 'y'), P(1, s, 1, 'y'), P(-1, s, 1, 'y')]);
      poly(sides, [P(-1, -1, s, 'z'), P(1, -1, s, 'z'), P(1, 1, s, 'z'), P(-1, 1, s, 'z')]);
    }
    for (const sy of S) for (const sz of S) poly(chams, [P(-1, sy, sz, 'y'), P(1, sy, sz, 'y'), P(1, sy, sz, 'z'), P(-1, sy, sz, 'z')]);
    for (const sx of S) for (const sz of S) poly(chams, [P(sx, -1, sz, 'x'), P(sx, 1, sz, 'x'), P(sx, 1, sz, 'z'), P(sx, -1, sz, 'z')]);
    for (const sx of S) for (const sy of S) poly(chams, [P(sx, sy, -1, 'x'), P(sx, sy, 1, 'x'), P(sx, sy, 1, 'y'), P(sx, sy, -1, 'y')]);
    for (const sx of S) for (const sy of S) for (const sz of S) poly(chams, [P(sx, sy, sz, 'x'), P(sx, sy, sz, 'y'), P(sx, sy, sz, 'z')]);
    const geo = (arr) => { const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); gg.computeVertexNormals(); return gg; };
    return { sides: geo(sides), top: geo(top), chamfers: geo(chams) };
  };
  // place a chamfered box with its base at y, three materials
  const cbox = (w, h, d, c, mSide, mTop, mCham, x, y, z) => {
    const gg = chamferBox(w, h, d, c);
    mesh(g, gg.sides, mSide, x, y + h / 2, z); mesh(g, gg.top, mTop, x, y + h / 2, z); mesh(g, gg.chamfers, mCham, x, y + h / 2, z);
  };
  const wash = mat('plaster', 0xf1e6d2, 0.8, 0);
  const washEdge = mat('plaster', 0xfaf2e4, 0.78, 0);
  const washTop = mat('plaster', 0xf7efdf, 0.75, 0);
  const washBase = mat('plaster', 0xc9bba4, 0.85, 0);
  const washBaseEdge = mat('plaster', 0xd6c9b2, 0.83, 0);
  const coral = mat('plaster', 0xed5851, 0.7, 0);
  const coralEdge = mat('plaster', 0xf26d67, 0.68, 0);
  const plinth = mat('stone', 0xcdb897, 0.85, 0);
  const plinthTop = mat('stone', 0xd8c6a6, 0.8, 0);
  const plinthBase = mat('stone', 0x8d7b63, 0.9, 0);
  const plinthBaseEdge = mat('stone', 0x9a886f, 0.88, 0);
  const kerbRed = mat('stone', 0xd6402f, 0.7, 0);
  const kerbRedTop = mat('stone', 0xe0564a, 0.68, 0);
  const kerbWhite = mat('stone', 0xf1e6d2, 0.75, 0);
  const kerbWhiteTop = mat('stone', 0xfaf2e4, 0.72, 0);
  const disc = mat('timber', 0x3f8f8a, 0.7, 0);
  const discRim = mat('timber', 0x4a9c96, 0.68, 0);
  const pip = mat('timber', 0xe0a862, 0.65, 0);

  // plinth in two courses
  cbox(6.0, 0.06, 2.4, 0.02, plinthBase, plinthBase, plinthBaseEdge, 0, 0, 0);
  cbox(6.0, 0.06, 2.4, 0.02, plinth, plinthTop, plinthTop, 0, 0.06, 0);

  const BD = 1.9, BZ = -0.2, y0 = 0.12;
  const blocks = [[-2.0, 1.86, 0.68, 2], [0, 1.96, 1.08, 1], [2.0, 1.86, 0.38, 3]];
  for (const [bx, bw, bh, n] of blocks) {
    const band = Math.min(0.13, bh * 0.4);
    cbox(bw, band, BD, 0.02, washBase, washBase, washBaseEdge, bx, y0, BZ);
    cbox(bw, bh - band, BD, 0.05, wash, washTop, washEdge, bx, y0 + band, BZ);
    // coral collar as a chamfered frame of four bars
    const yb = y0 + bh - 0.20;
    cbox(bw + 0.04, 0.15, 0.04, 0.012, coral, coralEdge, coralEdge, bx, yb, BZ + BD / 2);
    cbox(bw + 0.04, 0.15, 0.04, 0.012, coral, coralEdge, coralEdge, bx, yb, BZ - BD / 2);
    cbox(0.04, 0.15, BD + 0.04, 0.012, coral, coralEdge, coralEdge, bx + bw / 2, yb, BZ);
    cbox(0.04, 0.15, BD + 0.04, 0.012, coral, coralEdge, coralEdge, bx - bw / 2, yb, BZ);
    // disc with rim and pips
    const dr = Math.min(0.30, bh * 0.42);
    const dy = y0 + bh * 0.5 + 0.01;
    const dz = BZ + BD / 2 + 0.02;
    mesh(g, new THREE.CylinderGeometry(dr, dr, 0.04, 20), discRim, bx, dy, dz, PI / 2);
    mesh(g, new THREE.CylinderGeometry(dr - 0.035, dr - 0.035, 0.05, 20), disc, bx, dy, dz + 0.005, PI / 2);
    for (let i = 0; i < n; i++) {
      const px = (i - (n - 1) / 2) * 0.14;
      mesh(g, new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12), pip, bx + px, dy, dz + 0.035, PI / 2);
    }
  }
  // kerb stripes as chamfered blocks
  for (let i = 0; i < 6; i++) {
    const red = i % 2 === 0;
    cbox(0.99, 0.18, 0.45, 0.03, red ? kerbRed : kerbWhite, red ? kerbRedTop : kerbWhiteTop, red ? kerbRedTop : kerbWhiteTop, -2.5 + i, 0.0, 0.975);
  }

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
