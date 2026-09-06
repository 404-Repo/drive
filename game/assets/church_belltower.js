// church_belltower c0: primitive assembly. Boxes, cylinders and cones only, with the
// two gable triangles as hand built triangles. Roof built as two pitched groups carrying
// barrel tiles (closed low segment cylinders lying down the slope), a rounded ridge
// cylinder, pilasters, string courses and edge strips as separate boxes so every convex
// edge carries its painted highlight. Tower at the plus X front corner, cypresses and a low
// stone wall flank the steps. Front faces plus Z.
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
  const box = (parent, w, h, d, m, x, y, z, rx, ry, rz) => mesh(parent, new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz);
  // a block with its base at y, plus a bleached top slab and painted edge strips along the top perimeter and vertical corners
  const block = (parent, w, h, d, f, x, y, z, strip) => {
    const s = strip || 0.05;
    box(parent, w, h - s, d, f.side, x, y + (h - s) / 2, z);
    box(parent, w - 2 * s, s, d - 2 * s, f.top, x, y + h - s / 2, z);
    box(parent, w, s, s, f.edge, x, y + h - s / 2, z + d / 2 - s / 2);
    box(parent, w, s, s, f.edge, x, y + h - s / 2, z - d / 2 + s / 2);
    box(parent, s, s, d - 2 * s, f.edge, x + w / 2 - s / 2, y + h - s / 2, z);
    box(parent, s, s, d - 2 * s, f.edge, x - w / 2 + s / 2, y + h - s / 2, z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(parent, s, h - s, s, f.edge, x + sx * (w / 2 - s / 2), y + (h - s) / 2, z + sz * (d / 2 - s / 2));
  };
  const tri = (parent, a, b, c, m) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3)); geo.computeVertexNormals(); return mesh(parent, geo, m); };
  // upper half cylinder: halfCyl with rotation.x = PI/2 has its axis along Z; halfCylX with rotation.z = -PI/2 has its axis along X
  const halfCyl = (r, len, segs) => new THREE.CylinderGeometry(r, r, len, segs, 1, false, PI / 2, PI);
  const halfCylX = (r, len, segs) => new THREE.CylinderGeometry(r, r, len, segs, 1, false, PI, PI);

  const ochre = fam('plaster', 0xe0a862, 0.8, 0);
  const ochreB = fam('plaster', 0xe4b070, 0.8, 0);
  const wash = fam('plaster', 0xf1e6d2, 0.78, 0);
  const stone = fam('stone', 0xcdb897, 0.85, 0);
  const stoneShade = mat('stone', 0x8d7b63, 0.9, 0);
  const stoneShadeEdge = mat('stone', 0x9a886f, 0.88, 0);
  const tile = fam('tile', 0xc4683f, 0.75, 0);
  const tileB = mat('tile', 0xcc7248, 0.75, 0);
  const olive = fam('timber', 0x7d8b5a, 0.7, 0);
  const pine = fam('foliage', 0x2f5e3a, 0.85, 0);
  const pineB = mat('foliage', 0x35683f, 0.85, 0);
  const trunk = mat('timber', 0x6b4a2e, 0.85, 0);
  const metal = mat('metal', 0x3a3f46, 0.45, 0.2);
  const bell = mat('metal', 0x8e8f93, 0.4, 0.25);
  const glass = mat(null, 0x8fa9d6, 0.15, 0, { transparent: true, opacity: 0.85 });
  const dark = mat('plaster', 0x6a5638, 0.9, 0);
  const gable = mat('plaster', 0xe0a862, 0.8, 0, { side: THREE.DoubleSide });
  const gableTint = mat('plaster', 0xdca25c, 0.8, 0, { side: THREE.DoubleSide });

  // ---------- nave ----------
  const NW = 12, ND = 23, EAVE = 10, PITCH = 30 * PI / 180, OVER = 0.5, BASEH = 1.2;
  const zF = ND / 2, zB = -ND / 2;
  // base band then walls
  box(g, NW + 0.1, BASEH, ND + 0.1, ochre.base, 0, BASEH / 2, 0);
  box(g, NW, EAVE - BASEH, ND, ochre.side, 0, BASEH + (EAVE - BASEH) / 2, 0);
  // eaves cornice strip along both long sides (painted edge)
  for (const sx of [-1, 1]) box(g, 0.25, 0.3, ND, ochre.edge, sx * (NW / 2 + 0.02), EAVE - 0.15, 0);
  // corner pilasters, whitewash, with capital and plinth
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = sx * (NW / 2 - 0.1), pz = sz * (ND / 2 - 0.1);
    block(g, 0.7, EAVE - 0.4, 0.7, wash, px, 0, pz, 0.04);
    box(g, 0.95, 0.35, 0.95, wash.edge, px, EAVE - 0.4 + 0.175, pz);
    box(g, 0.9, 0.4, 0.9, wash.base, px, 0.2, pz);
  }
  // mid pilasters on the long sides
  for (const sx of [-1, 1]) for (const pz of [-7, 0, 7]) block(g, 0.5, EAVE - 0.6, 0.5, wash, sx * (NW / 2 + 0.05), 0, pz, 0.04);
  // gables
  const RISE = (NW / 2) * Math.tan(PITCH), RIDGE = EAVE + RISE;
  for (const sz of [-1, 1]) {
    const z = sz * ND / 2;
    tri(g, [-NW / 2, EAVE, z], [NW / 2, EAVE, z], [0, RIDGE, z], sz > 0 ? gable : gableTint);
    // gable inner face (thickness) as a second triangle slightly inside
    tri(g, [-NW / 2, EAVE, z - sz * 0.6], [NW / 2, EAVE, z - sz * 0.6], [0, RIDGE, z - sz * 0.6], gableTint);
    // gable side walls closing the thickness
    box(g, NW, 0.02, 0.6, ochre.side, 0, EAVE, z - sz * 0.3);
  }
  // fill between the two gable triangles with a wedge of boxes so the gable reads solid from the side
  for (let i = 0; i < 12; i++) {
    const t = (i + 0.5) / 12, w = NW * (1 - t), y = EAVE + RISE * t;
    for (const sz of [-1, 1]) box(g, w, RISE / 12, 0.6, ochre.side, 0, y, sz * (ND / 2 - 0.3));
  }
  // roof: two pitched groups, local x runs along the slope, local y is the outward normal,
  // local z along the ridge. Left side is hung from its eave (x runs up), right side from
  // the ridge (x runs down), so both keep a pure rotation with the normal pointing out.
  const SLOPE = (NW / 2 + OVER) / Math.cos(PITCH), RD = ND + 2 * OVER;
  for (const sx of [-1, 1]) {
    const rg = new THREE.Group();
    const ey = EAVE - OVER * Math.tan(PITCH);
    if (sx < 0) { rg.position.set(-(NW / 2 + OVER), ey, 0); rg.rotation.z = PITCH; }
    else { rg.position.set(0, RIDGE, 0); rg.rotation.z = -PITCH; }
    g.add(rg);
    box(rg, SLOPE, 0.28, RD, tile.base, SLOPE / 2, 0.14, 0);
    box(rg, SLOPE, 0.06, RD - 0.2, tile.top, SLOPE / 2, 0.31, 0);
    // barrel tiles running down the slope
    const nT = Math.round(RD / 0.6);
    for (let i = 0; i < nT; i++) {
      const z = -RD / 2 + 0.3 + i * 0.6;
      mesh(rg, new THREE.CylinderGeometry(0.2, 0.2, SLOPE - 0.1, 8, 1, true), i % 2 ? tile.side : tileB, SLOPE / 2, 0.36, z, 0, 0, PI / 2);
    }
    // eave lip (painted edge) at the low end and the gable verges
    const lipX = sx < 0 ? 0.06 : SLOPE - 0.06;
    box(rg, 0.12, 0.5, RD, tile.edge, lipX, 0.25, 0);
    for (const sz of [-1, 1]) box(rg, SLOPE, 0.5, 0.12, tile.edge, SLOPE / 2, 0.25, sz * (RD / 2 - 0.06));
  }
  // rounded ridge
  mesh(g, new THREE.CylinderGeometry(0.42, 0.42, RD, 12), tile.edge, 0, RIDGE + 0.28, 0, PI / 2, 0, 0);
  for (const sz of [-1, 1]) mesh(g, new THREE.SphereGeometry(0.42, 12, 8), tile.edge, 0, RIDGE + 0.28, sz * RD / 2);

  // ---------- front: steps, door, rose window ----------
  const FLOOR = 0.6;
  for (let i = 0; i < 3; i++) block(g, 4.6 - i * 0.5, 0.2, 1.9 - i * 0.6, stone, 0, i * 0.2, zF + 0.95 - i * 0.3, 0.04);
  // door surround in stone
  box(g, 2.8, 3.0, 0.5, stone.side, 0, FLOOR + 1.5, zF + 0.05);
  mesh(g, halfCyl(1.4, 0.5, 14), stone.side, 0, FLOOR + 3.0, zF + 0.05, PI / 2, 0, 0);
  box(g, 2.9, 0.08, 0.55, stone.edge, 0, FLOOR + 3.0, zF + 0.05);
  // door recess and door leaves in shutter olive, planked
  box(g, 2.2, 2.7, 0.3, dark, 0, FLOOR + 1.35, zF + 0.1);
  mesh(g, halfCyl(1.1, 0.3, 14), dark, 0, FLOOR + 2.7, zF + 0.1, PI / 2, 0, 0);
  for (let i = 0; i < 6; i++) box(g, 0.32, 2.6, 0.12, i % 2 ? olive.side : olive.edge, -0.875 + i * 0.35, FLOOR + 1.3, zF + 0.25);
  mesh(g, halfCyl(1.0, 0.12, 14), olive.side, 0, FLOOR + 2.6, zF + 0.25, PI / 2, 0, 0);
  box(g, 2.1, 0.12, 0.14, olive.edge, 0, FLOOR + 1.3, zF + 0.28);
  // rose window
  const RY = 7.2;
  mesh(g, new THREE.TorusGeometry(1.0, 0.2, 10, 20), stone.side, 0, RY, zF + 0.1);
  mesh(g, new THREE.CylinderGeometry(0.9, 0.9, 0.1, 20), glass, 0, RY, zF + 0.05, PI / 2, 0, 0);
  for (let i = 0; i < 6; i++) box(g, 0.12, 1.7, 0.12, stone.edge, 0, RY, zF + 0.12, 0, 0, i * PI / 6);
  mesh(g, new THREE.CylinderGeometry(0.25, 0.25, 0.16, 12), stone.edge, 0, RY, zF + 0.12, PI / 2, 0, 0);
  // rear gable: small round window and a rear door so the back is modelled
  mesh(g, new THREE.TorusGeometry(0.7, 0.16, 10, 16), stone.side, 0, RY, zB - 0.1);
  mesh(g, new THREE.CylinderGeometry(0.62, 0.62, 0.1, 16), glass, 0, RY, zB - 0.05, PI / 2, 0, 0);
  box(g, 1.8, 2.8, 0.4, stone.side, -3.2, FLOOR + 1.4, zB - 0.05);
  box(g, 1.3, 2.4, 0.2, olive.side, -3.2, FLOOR + 1.2, zB - 0.2);
  box(g, 1.9, 0.5, 1.2, stone.side, -3.2, 0.25, zB - 0.6);
  box(g, 1.9, 0.05, 1.2, stone.top, -3.2, 0.52, zB - 0.6);

  // side windows: round headed, recessed, glass with mullions and a stone sill
  const winZ = [-8.5, -4.5, -0.5, 3.5, 7.5];
  for (const sx of [-1, 1]) for (const wz of winZ) {
    const x = sx * (NW / 2 + 0.02);
    box(g, 0.3, 2.6, 1.4, dark, x, 6.3, wz);
    mesh(g, halfCylX(0.7, 0.3, 12), dark, x, 7.6, wz, 0, 0, -PI / 2);
    box(g, 0.34, 2.6, 1.15, glass, x, 6.3, wz);
    box(g, 0.4, 2.6, 0.1, wash.edge, x, 6.3, wz);
    box(g, 0.4, 0.1, 1.2, wash.edge, x, 6.3, wz);
    box(g, 0.5, 0.18, 1.7, stone.top, x + sx * 0.1, 4.95, wz);
    box(g, 0.5, 0.08, 1.7, stone.edge, x + sx * 0.12, 5.08, wz);
  }

  // ---------- bell tower at the plus X front corner ----------
  const TW = 4.0, TX = NW / 2 + TW / 2 - 0.5, TZ = ND / 2 - TW / 2, TB = 1.9;
  const stages = [[0, 7.5], [7.5, 13.5], [13.5, 19.8]];
  box(g, TW + 0.2, TB, TW + 0.2, stoneShade, TX, TB / 2, TZ);
  box(g, TW + 0.24, 0.06, TW + 0.24, stoneShadeEdge, TX, TB - 0.03, TZ);
  for (let i = 0; i < stages.length; i++) {
    const [y0, y1] = stages[i], w = TW - i * 0.12;
    const yb = i === 0 ? TB : y0;
    box(g, w, y1 - yb, w, i === 1 ? stone.side : stone.side, TX, yb + (y1 - yb) / 2, TZ);
    // vertical corner strips, painted edge
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.08, y1 - yb, 0.08, stone.edge, TX + sx * (w / 2), yb + (y1 - yb) / 2, TZ + sz * (w / 2));
    // string course at the top of each stage
    box(g, w + 0.5, 0.3, w + 0.5, stone.side, TX, y1 - 0.15, TZ);
    box(g, w + 0.56, 0.06, w + 0.56, stone.edge, TX, y1 - 0.03, TZ);
    box(g, w + 0.3, 0.08, w + 0.3, stone.top, TX, y1 + 0.04, TZ);
  }
  // stage 2: a slit window on each face; stage 3: round headed opening with a bell on each face
  for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, PI], [1, 0, PI / 2], [-1, 0, -PI / 2]]) {
    const fw = TW - 0.12, x = TX + dx * fw / 2, z = TZ + dz * fw / 2;
    // slit
    box(g, dx ? 0.3 : 0.5, 1.6, dx ? 0.5 : 0.3, dark, x, 10.5, z);
    box(g, dx ? 0.34 : 0.7, 0.16, dx ? 0.7 : 0.34, stone.edge, x, 9.6, z);
    // belfry opening
    const ow = 1.6, oh = 2.2, oy = 15.4;
    const op = new THREE.Group(); op.position.set(x, 0, z); op.rotation.y = ry; g.add(op);
    box(op, ow, oh, 0.6, dark, 0, oy + oh / 2, 0);
    mesh(op, halfCyl(ow / 2, 0.6, 14), dark, 0, oy + oh, 0, PI / 2, 0, 0);
    // stone jambs and arch ring
    for (const sx of [-1, 1]) box(op, 0.25, oh, 0.45, stone.edge, sx * (ow / 2 + 0.12), oy + oh / 2, 0.05);
    mesh(op, new THREE.TorusGeometry(ow / 2 + 0.12, 0.13, 8, 14, PI), stone.edge, 0, oy + oh, 0.05);
    box(op, ow + 0.6, 0.2, 0.5, stone.top, 0, oy - 0.1, 0.05);
  }
  // one bell shape hanging inside the belfry (cone body, sphere crown, clapper)
  mesh(g, new THREE.CylinderGeometry(0.42, 0.62, 0.9, 14), bell, TX, 16.5, TZ);
  mesh(g, new THREE.SphereGeometry(0.42, 14, 8, 0, PI * 2, 0, PI / 2), bell, TX, 16.95, TZ);
  mesh(g, new THREE.CylinderGeometry(0.12, 0.12, 0.3, 8), metal, TX, 17.4, TZ);
  mesh(g, new THREE.SphereGeometry(0.14, 8, 6), metal, TX, 16.0, TZ);
  box(g, TW - 0.2, 0.15, 0.15, metal, TX, 17.6, TZ);
  // pyramid roof with stepped tile courses and a cross finial
  const RB = 19.8, RH = 2.4, RR = (TW / 2 + 0.45) * Math.SQRT2;
  box(g, TW + 0.8, 0.25, TW + 0.8, tile.edge, TX, RB + 0.12, TZ);
  for (let i = 0; i < 4; i++) {
    const t = i / 4, r = RR * (1 - t) + 0.25, h = RH * (1 - t) + 0.2;
    mesh(g, new THREE.ConeGeometry(r, h, 4), i % 2 ? tile.side : tileB, TX, RB + 0.25 + RH * t + h / 2 - 0.15 * i, TZ, 0, PI / 4, 0);
  }
  mesh(g, new THREE.CylinderGeometry(0.28, 0.4, 0.5, 10), stone.edge, TX, RB + RH + 0.35, TZ);
  mesh(g, new THREE.SphereGeometry(0.22, 10, 8), metal, TX, RB + RH + 0.7, TZ);
  box(g, 0.14, 1.3, 0.14, metal, TX, RB + RH + 1.35, TZ);
  box(g, 0.8, 0.14, 0.14, metal, TX, RB + RH + 1.55, TZ);

  // ---------- forecourt: low stone wall and two cypresses ----------
  for (const sx of [-1, 1]) {
    block(g, 3.4, 0.8, 0.5, stone, sx * 4.3, 0, zF + 1.4, 0.05);
    box(g, 3.5, 0.2, 0.5, stoneShade, sx * 4.3, 0.1, zF + 1.4);
    // cypress: trunk and three stacked cones
    const cx = sx * 4.3, cz = zF + 2.6;
    mesh(g, new THREE.CylinderGeometry(0.18, 0.24, 0.9, 8), trunk, cx, 0.45, cz);
    mesh(g, new THREE.ConeGeometry(1.15, 3.2, 10), pine.side, cx, 0.6 + 1.6, cz);
    mesh(g, new THREE.ConeGeometry(0.95, 3.0, 10), pineB, cx, 2.3 + 1.5, cz);
    mesh(g, new THREE.ConeGeometry(0.62, 2.6, 10), pine.edge, cx, 3.8 + 1.3, cz);
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
