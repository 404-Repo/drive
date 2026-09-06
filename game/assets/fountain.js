// fountain c1: built from profiles. The basin is one 8 segment LatheGeometry whose profile
// carries the base band step, the wall, the rounded rim (an arc of points) and the inner
// wall down to the water; the pedestal foot, both bowls with their lips and the urn are
// lathes too, the water discs are flat lathes. Lion bosses are small lathes with an extruded
// muzzle. Front faces plus Z (symmetric).
export default function (THREE) {
  const g = new THREE.Group();
  const PI = Math.PI;
  const tint = (hex, l, s) => { const c = new THREE.Color(hex); const h = {}; c.getHSL(h); c.setHSL(h.h, Math.max(0, Math.min(1, h.s + (s || 0))), Math.max(0, Math.min(1, h.l + l))); return c.getHex(); };
  const mat = (name, hex, rough, metal, extra) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: metal || 0 }, extra || {})); if (name) m.name = name; return m; };
  const fam = (name, hex, rough, metal) => ({
    side: mat(name, hex, rough, metal),
    edge: mat(name, tint(hex, 0.08), rough - 0.02, metal),
    top: mat(name, tint(hex, 0.07, -0.05), rough - 0.04, metal),
    base: mat(name, tint(hex, -0.12, -0.03), rough + 0.03, metal),
  });
  const mesh = (parent, geo, m, x, y, z, rx, ry, rz) => { const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); if (rx || ry || rz) o.rotation.set(rx || 0, ry || 0, rz || 0); parent.add(o); return o; };
  const lathe = (pts, segs, m, x, y, z, ry) => mesh(g, new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), segs), m, x || 0, y || 0, z || 0, 0, ry || 0, 0);
  const ext = (shape, depth, seg) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: seg || 6 });
  const rect = (w, h, x0, y0) => { const s = new THREE.Shape(); s.moveTo(x0, y0); s.lineTo(x0 + w, y0); s.lineTo(x0 + w, y0 + h); s.lineTo(x0, y0 + h); s.closePath(); return s; };
  // quarter arc points from angle a0 to a1 about (cx, cy) radius r, n steps
  const arcPts = (cx, cy, r, a0, a1, n) => { const out = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return out; };

  const stone = fam('stone', 0xcdb897, 0.85, 0);
  const stoneB = fam('stone', 0xd4c0a0, 0.85, 0);
  const shade = fam('stone', 0x8d7b63, 0.9, 0);
  const water = mat(null, tint(0x3fb0b8, 0.24, -0.32), 0.2, 0, { transparent: true, opacity: 0.92 });
  const waterD = mat(null, tint(0x3fb0b8, 0.08, -0.2), 0.25, 0);
  const inner = mat('stone', 0xb8a482, 0.88, 0, { side: THREE.DoubleSide });

  // ---------- octagonal basin as three lathes (base band, wall with rim, inner) ----------
  const k = 1 / Math.cos(PI / 8), RB = 3.0 * k, RIM = 0.3, BH = 0.7;
  lathe([[0, 0], [RB + 0.06, 0], [RB + 0.03, 0.23], [RB + 0.06, 0.25], [RB - 0.02, 0.27], [0, 0.27]], 8, shade.side, 0, 0, 0, PI / 8);
  // wall with a rounded rim: rise, out to a lip, quarter arc over the top, down inside to the water level
  const cx = RB - RIM / 2 + 0.08, cyR = BH - RIM / 2 + 0.05, rr = RIM / 2;
  const outer = [[RB - 0.15, 0.25], [RB, 0.27], [RB, BH - 0.32], [RB + 0.08, BH - 0.3], [RB + 0.08, BH - 0.2]].concat(arcPts(cx, cyR, rr, 0, PI / 3, 2));
  lathe(outer, 8, stone.side, 0, 0, 0, PI / 8);
  // bleached crown of the rim (the middle third of the arc), then the inner third and the inner wall down to the floor
  lathe(arcPts(cx, cyR, rr, PI / 3, 2 * PI / 3, 3), 8, stone.top, 0, 0, 0, PI / 8);
  lathe(arcPts(cx, cyR, rr, 2 * PI / 3, PI, 2).concat([[RB - RIM + 0.02, BH - 0.12], [RB - RIM + 0.02, 0.5], [0, 0.5]]), 8, inner, 0, 0, 0, PI / 8);
  lathe([[RB + 0.08, BH - 0.32], [RB + 0.1, BH - 0.31], [RB + 0.1, BH - 0.2], [RB + 0.08, BH - 0.19]], 8, stone.edge, 0, 0, 0, PI / 8);
  // still water disc at 0.55 and a darker meniscus ring against the wall
  lathe([[0, 0.55], [RB - RIM, 0.55], [RB - RIM, 0.53], [0, 0.53]], 8, water, 0, 0, 0, PI / 8);
  lathe([[RB - RIM - 0.08, 0.56], [RB - RIM, 0.56], [RB - RIM, 0.565], [RB - RIM - 0.08, 0.565]], 8, waterD, 0, 0, 0, PI / 8);
  // recessed panel on each face: a thin extruded frame
  for (let i = 0; i < 8; i++) {
    const a = i * PI / 4, r = RB * Math.cos(PI / 8);
    const hold = new THREE.Group(); hold.position.set(Math.sin(a) * r, 0, Math.cos(a) * r); hold.rotation.y = a; g.add(hold);
    const fr = rect(1.6, 0.26, -0.8, 0.3); const hole = new THREE.Path(); hole.moveTo(-0.72, 0.34); hole.lineTo(0.72, 0.34); hole.lineTo(0.72, 0.5); hole.lineTo(-0.72, 0.5); hole.closePath(); fr.holes.push(hole);
    mesh(hold, ext(fr, 0.05), stoneB.edge, 0, 0, 0);
  }

  // corner posts at the eight basin corners (small lathes) and a second groove ring on the wall
  for (let i = 0; i < 8; i++) {
    const a = (i + 0.5) * PI / 4;
    lathe([[0, 0], [0.16, 0], [0.16, 0.02], [0.12, 0.06], [0.12, 0.5], [0.15, 0.54], [0.15, 0.58], [0, 0.58]], 10, stoneB.side, Math.sin(a) * (RB + 0.02), 0.25, Math.cos(a) * (RB + 0.02));
    lathe([[0, 0], [0.16, 0], [0.16, 0.03], [0, 0.03]], 10, stoneB.top, Math.sin(a) * (RB + 0.02), 0.83, Math.cos(a) * (RB + 0.02));
  }
  lathe([[RB, 0.62], [RB + 0.02, 0.62], [RB + 0.02, 0.65], [RB, 0.65]], 8, stone.edge, 0, 0, 0, PI / 8);
  // ---------- pedestal: foot, shaft, two bowls, urn ----------
  lathe([[0, 0.45], [0.82, 0.45], [0.78, 0.9], [0.7, 0.95], [0.66, 1.0], [0, 1.0]], 8, stone.side, 0, 0, 0, PI / 8);
  lathe([[0, 1.0], [0.66, 1.0], [0.66, 1.005], [0, 1.005]], 8, stone.top, 0, 0, 0, PI / 8);
  lathe([[0.36, 1.0], [0.42, 1.0], [0.4, 1.06], [0.33, 1.1], [0.32, 1.28], [0.4, 1.32], [0.42, 1.36]], 14, stone.side);
  // bowl 1: 2.4 across at 1.4, with a rolled lip and an inner face down to its water
  const bowl = (r, y, d, segs) => {
    const pts = [[0, y - d], [r * 0.35, y - d], [r * 0.75, y - d * 0.55], [r * 0.95, y - 0.08], [r, y], [r + 0.02, y + 0.05], [r, y + 0.09], [r - 0.08, y + 0.1], [r - 0.1, y + 0.02], [r - 0.12, y - 0.04], [0, y - 0.04]];
    lathe(pts, segs, stone.side);
    lathe([[0, y + 0.02], [r - 0.13, y + 0.02], [r - 0.13, y], [0, y]], segs, water);
    lathe([[r - 0.08, y + 0.1], [r - 0.12, y + 0.1], [r - 0.12, y + 0.105], [r - 0.08, y + 0.105]], segs, stone.top);
    lathe([[r + 0.02, y + 0.05], [r + 0.04, y + 0.05], [r + 0.04, y + 0.07], [r + 0.02, y + 0.07]], segs, stone.edge);
  };
  bowl(1.2, 1.5, 0.3, 20);
  mesh(g, new THREE.TorusGeometry(1.06, 0.03, 6, 20), stone.edge, 0, 1.3, 0, PI / 2, 0, 0);
  mesh(g, new THREE.TorusGeometry(0.74, 0.03, 6, 20), stone.edge, 0, 1.22, 0, PI / 2, 0, 0);
  lathe([[0.3, 1.5], [0.38, 1.5], [0.34, 1.56], [0.28, 1.62], [0.28, 2.2], [0.34, 2.26], [0.36, 2.3]], 14, stone.side);
  bowl(0.7, 2.45, 0.24, 20);
  mesh(g, new THREE.TorusGeometry(0.6, 0.03, 6, 20), stone.edge, 0, 2.3, 0, PI / 2, 0, 0);
  // urn finial to 3.2
  lathe([[0, 2.45], [0.2, 2.45], [0.16, 2.55], [0.14, 2.6], [0.22, 2.68], [0.26, 2.8], [0.24, 2.92], [0.16, 3.0], [0.2, 3.04], [0.1, 3.06], [0.08, 3.12], [0.05, 3.18], [0, 3.2]], 14, stone.side);
  lathe([[0.2, 3.04], [0.22, 3.04], [0.22, 3.05], [0.2, 3.05]], 14, stone.edge);

  // ---------- four lion head bosses ----------
  const boss = fam('stone', 0xc9b28e, 0.85, 0);
  for (let i = 0; i < 4; i++) {
    const a = i * PI / 2;
    const hold = new THREE.Group(); hold.position.set(Math.sin(a) * 0.86, 0.82, Math.cos(a) * 0.86); hold.rotation.y = a; g.add(hold);
    // head: a lathe with its axis pointing out (+z), mane collar, muzzle block, spout
    const head = new THREE.LatheGeometry([[0, -0.1], [0.18, -0.08], [0.22, 0.02], [0.2, 0.12], [0.12, 0.2], [0, 0.22]].map((p) => new THREE.Vector2(p[0], p[1])), 12);
    mesh(hold, head, boss.side, 0, 0, 0, PI / 2, 0, 0);
    mesh(hold, new THREE.LatheGeometry([[0.2, 0], [0.28, 0], [0.26, 0.06], [0.18, 0.06]].map((p) => new THREE.Vector2(p[0], p[1])), 12), boss.edge, 0, 0, -0.08, PI / 2, 0, 0);
    mesh(hold, ext(rect(0.16, 0.12, -0.08, -0.06), 0.14), boss.edge, 0, -0.05, 0.16);
    // water jet: a quarter torus arc from the mouth down into the basin
    mesh(hold, new THREE.TorusGeometry(0.22, 0.03, 6, 10, PI / 2), waterD, 0, -0.07, 0.24, 0, PI / 2, 0).rotation.set(0, -PI / 2, -PI / 2);
    mesh(hold, new THREE.CylinderGeometry(0.05, 0.02, 0.06, 8), waterD, 0, -0.27, 0.46);
  }

  // base at y=0, centred on x and z (measure vertices, expand instances)
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
