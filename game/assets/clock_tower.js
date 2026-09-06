// clock_tower c0: primitive assembly. The tapering shaft is a four sided CylinderGeometry
// turned 45 degrees, the corner bands are tilted boxes that follow the taper, dials are
// cylinders with box hands and tick marks, the belfry is four piers with half torus arches
// and a bell, the roof is stacked four sided cones reading as tile courses with a fin
// finial. Base block in warm stone with a darker base band and an arched niche on the
// front, a smaller niche on the back. Front faces plus Z.
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
  // square block with bleached top slab and painted edge strips (top perimeter and vertical corners), base at y
  const block = (parent, w, h, d, f, x, y, z, s) => {
    s = s || 0.05;
    box(parent, w, h - s, d, f.side, x, y + (h - s) / 2, z);
    box(parent, w - 2 * s, s, d - 2 * s, f.top, x, y + h - s / 2, z);
    box(parent, w, s, s, f.edge, x, y + h - s / 2, z + d / 2 - s / 2);
    box(parent, w, s, s, f.edge, x, y + h - s / 2, z - d / 2 + s / 2);
    box(parent, s, s, d - 2 * s, f.edge, x + w / 2 - s / 2, y + h - s / 2, z);
    box(parent, s, s, d - 2 * s, f.edge, x - w / 2 + s / 2, y + h - s / 2, z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(parent, s, h - s, s, f.edge, x + sx * (w / 2 - s / 2), y + (h - s) / 2, z + sz * (d / 2 - s / 2));
  };
  const halfCyl = (r, len, segs) => new THREE.CylinderGeometry(r, r, len, segs, 1, false, PI / 2, PI);
  const sqPrism = (hwBot, hwTop, h, segsY) => new THREE.CylinderGeometry(hwTop * Math.SQRT2, hwBot * Math.SQRT2, h, 4, segsY || 1);

  const stone = fam('stone', 0xcdb897, 0.85, 0);
  const shade = fam('stone', 0x8d7b63, 0.9, 0);
  const rose = fam('plaster', 0xd9876d, 0.8, 0);
  const wash = fam('plaster', 0xf1e6d2, 0.78, 0);
  const tile = fam('tile', 0xc4683f, 0.75, 0);
  const tileB = mat('tile', 0xcd7349, 0.75, 0);
  const metal = mat('metal', 0x3a3f46, 0.45, 0.2);
  const metalE = mat('metal', 0x4a5058, 0.45, 0.2);
  const bell = mat('metal', 0x8e8f93, 0.4, 0.25);
  const dark = mat('stone', 0x5e5240, 0.9, 0, { side: THREE.DoubleSide });

  // ---------- base: plinth, darker band, stone block, niches ----------
  const BW = 4.6, BH = 4.0, BAND = 1.36;
  block(g, 5.0, 0.3, 5.0, shade, 0, 0, 0, 0.05);
  block(g, BW + 0.1, BAND - 0.3, BW + 0.1, shade, 0, 0.3, 0, 0.05);
  block(g, BW, BH - BAND, BW, stone, 0, BAND, 0, 0.06);
  // stone block courses on all four faces (staggered joints), leaving the front niche clear
  const CH = 0.62, nCourse = Math.floor((BH - BAND - 0.35) / CH);
  const stoneB = fam('stone', 0xd5c2a2, 0.85, 0);
  for (let ci = 0; ci < nCourse; ci++) {
    const y = BAND + ci * CH, off = ci % 2 ? 0.55 : 0;
    for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, PI], [1, 0, PI / 2], [-1, 0, -PI / 2]]) {
      const hold = new THREE.Group(); hold.position.set(dx * (BW / 2 - 0.1), 0, dz * (BW / 2 - 0.1)); hold.rotation.y = ry; g.add(hold);
      for (let bi = -2; bi <= 2; bi++) {
        const bx = bi * 1.1 + off;
        if (Math.abs(bx) > BW / 2 - 0.4) continue;
        if (dz === 1 && Math.abs(bx) < 1.35 && y < BAND + 2.3) continue;
        block(hold, 1.02, CH - 0.06, 0.22, (bi + ci) % 2 ? stone : stoneB, bx, y, 0, 0.04);
      }
    }
  }
  // string course at the top of the base, whitewash cap
  block(g, BW + 0.5, 0.35, BW + 0.5, wash, 0, BH - 0.05, 0, 0.05);
  // front arched niche: recess, stone surround, keystone
  const nw = 1.6, nh = 2.9;
  const spring = 0.3 + nh - nw / 2;
  for (const sx of [-1, 1]) block(g, 0.32, spring - 0.3, 0.55, stone, sx * (nw / 2 + 0.16), 0.3, BW / 2 - 0.05, 0.04);
  mesh(g, new THREE.TorusGeometry(nw / 2 + 0.16, 0.17, 8, 16, PI), stone.edge, 0, spring, BW / 2 + 0.05);
  box(g, nw, spring - 0.3, 1.2, dark, 0, 0.3 + (spring - 0.3) / 2, BW / 2 - 0.62);
  mesh(g, halfCyl(nw / 2, 1.2, 14), dark, 0, spring, BW / 2 - 0.62, PI / 2, 0, 0);
  box(g, 0.4, 0.45, 0.3, wash.edge, 0, spring + nw / 2 + 0.1, BW / 2 + 0.12);
  // back and side niches (smaller) so every face carries structure
  for (const [dx, dz, ry] of [[0, -1, PI], [1, 0, PI / 2], [-1, 0, -PI / 2]]) {
    const hold = new THREE.Group(); hold.position.set(dx * BW / 2, 0, dz * BW / 2); hold.rotation.y = ry; g.add(hold);
    box(hold, 1.0, 1.3, 0.5, dark, 0, 1.75, -0.15);
    mesh(hold, halfCyl(0.5, 0.5, 12), dark, 0, 2.4, -0.15, PI / 2, 0, 0);
    box(hold, 1.4, 0.2, 0.5, stone.top, 0, 1.0, 0.05);
    box(hold, 1.4, 0.06, 0.5, stone.edge, 0, 1.13, 0.05);
  }

  // ---------- shaft: tapering square prism in plaster rose with whitewash corner bands ----------
  const S0 = BH + 0.3, S1 = 12.9, SH = S1 - S0, HW0 = 2.2, HW1 = 2.0;
  mesh(g, sqPrism(HW0, HW1, SH), rose.side, 0, S0 + SH / 2, 0, 0, PI / 4, 0);
  // corner bands, tilted to follow the taper
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = 0.42, xb = sx * (HW0 - w / 2 + 0.06), zb = sz * (HW0 - w / 2 + 0.06), xt = sx * (HW1 - w / 2 + 0.06), zt = sz * (HW1 - w / 2 + 0.06);
    const d = new THREE.Vector3(xt - xb, SH, zt - zb), len = d.length();
    const o = box(g, w, len, w, wash.side, (xb + xt) / 2, S0 + SH / 2, (zb + zt) / 2);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    const e = box(g, 0.06, len, w + 0.02, wash.edge, (xb + xt) / 2 + sx * (w / 2 - 0.02), S0 + SH / 2, (zb + zt) / 2);
    e.quaternion.copy(o.quaternion);
  }
  // a horizontal rose band a shade lighter at mid shaft and a small sill line under the dials
  mesh(g, sqPrism(HW0 - 0.09, HW0 - 0.11, 0.3), rose.edge, 0, 8.6, 0, 0, PI / 4, 0);

  // ---------- dials at 12 m on all four faces ----------
  const DY = 11.6, DR = 1.2;
  for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, PI], [1, 0, PI / 2], [-1, 0, -PI / 2]]) {
    const hw = HW0 + (HW1 - HW0) * ((DY - S0) / SH);
    const hold = new THREE.Group(); hold.position.set(dx * hw, DY, dz * hw); hold.rotation.y = ry; g.add(hold);
    mesh(hold, new THREE.CylinderGeometry(DR + 0.16, DR + 0.16, 0.22, 24), metal, 0, 0, 0.05, PI / 2, 0, 0);
    mesh(hold, new THREE.CylinderGeometry(DR, DR, 0.1, 24), wash.top, 0, 0, 0.14, PI / 2, 0, 0);
    for (let i = 0; i < 12; i++) {
      const a = i * PI / 6, big = i % 3 === 0;
      box(hold, big ? 0.12 : 0.08, big ? 0.3 : 0.18, 0.06, metal, Math.sin(a) * (DR - 0.2), Math.cos(a) * (DR - 0.2), 0.22, 0, 0, -a);
    }
    // hands: chunky, at ten past ten so they read from far
    box(hold, 0.14, 0.75, 0.08, metal, 0, 0, 0.25, 0, 0, -0.55).translateY(0.3);
    box(hold, 0.14, 0.55, 0.08, metal, 0, 0, 0.27, 0, 0, 2.05).translateY(0.22);
    mesh(hold, new THREE.CylinderGeometry(0.12, 0.12, 0.12, 10), metalE, 0, 0, 0.28, PI / 2, 0, 0);
  }

  // ---------- projecting stone cornice ----------
  block(g, 2 * HW1 + 0.6, 0.28, 2 * HW1 + 0.6, stone, 0, S1, 0, 0.05);
  block(g, 2 * HW1 + 1.0, 0.32, 2 * HW1 + 1.0, stone, 0, S1 + 0.28, 0, 0.06);
  // small corbel blocks under the cornice
  for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) for (const t of [-1.2, 0, 1.2]) {
    box(g, dx ? 0.4 : 0.35, 0.3, dx ? 0.35 : 0.4, stone.edge, dx * (HW1 + 0.1) + (dz ? t : 0), S1 - 0.15, dz * (HW1 + 0.1) + (dx ? t : 0));
  }

  // ---------- belfry: four piers, round arches, bell, cap ----------
  const BY = S1 + 0.6, PH = 0.65, PW = 0.85, BHW = HW1 - 0.05;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) block(g, PW, PH, PW, rose, sx * (BHW - PW / 2), BY, sz * (BHW - PW / 2), 0.04);
  const AR = (2 * BHW - 2 * PW) / 2 + 0.05;
  for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, 0], [1, 0, PI / 2], [-1, 0, PI / 2]]) {
    mesh(g, new THREE.TorusGeometry(AR, 0.26, 8, 16, PI), rose.edge, dx * (BHW - PW / 2), BY + PH, dz * (BHW - PW / 2), 0, ry, 0).scale.set(1, 0.6, 1);
  }
  // spandrel ring above the arches
  block(g, 2 * BHW, 0.5, 2 * BHW, rose, 0, BY + PH + AR * 0.6 - 0.1, 0, 0.05);
  // corner strips in whitewash on the belfry piers
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.1, PH + 0.4, 0.1, wash.side, sx * BHW, BY + (PH + 0.4) / 2, sz * BHW);
  // bell
  mesh(g, new THREE.CylinderGeometry(0.3, 0.44, 0.6, 14), bell, 0, BY + 0.42, 0);
  mesh(g, new THREE.SphereGeometry(0.3, 14, 8, 0, PI * 2, 0, PI / 2), bell, 0, BY + 0.72, 0);
  mesh(g, new THREE.SphereGeometry(0.1, 8, 6), metal, 0, BY + 0.12, 0);
  box(g, 2 * BHW - 0.5, 0.14, 0.14, metal, 0, BY + 1.1, 0);
  // belfry floor slab (visible through the arches)
  box(g, 2 * BHW - 0.3, 0.15, 2 * BHW - 0.3, stone.top, 0, BY - 0.07, 0);

  // ---------- roof: eaves slab, stepped tile courses, fin finial ----------
  const RB = BY + PH + AR * 0.6 + 0.4, RH = 1.25, RHW = HW1 + 0.5;
  block(g, 2 * RHW, 0.22, 2 * RHW, tile, 0, RB - 0.22, 0, 0.05);
  for (let i = 0; i < 4; i++) {
    const t = i / 4, hw = RHW * (1 - t) + 0.15, h = RH * (1 - t) + 0.18;
    mesh(g, new THREE.ConeGeometry(hw * Math.SQRT2, h, 4), i % 2 ? tile.side : tileB, 0, RB + RH * t + h / 2 - 0.08 * i, 0, 0, PI / 4, 0);
  }
  // hip ridges on the four roof corners in the lighter tile tint
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const d = new THREE.Vector3(-sx * RHW, RH, -sz * RHW), len = d.length();
    const o = box(g, 0.16, len, 0.16, tile.edge, sx * RHW / 2, RB + RH / 2, sz * RHW / 2);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  }
  // fin finial: a flat vertical fin on a small drum, to 17 m
  mesh(g, new THREE.CylinderGeometry(0.16, 0.22, 0.25, 10), stone.edge, 0, RB + RH + 0.12, 0);
  box(g, 0.08, 0.6, 0.45, metal, 0, RB + RH + 0.5, 0);
  mesh(g, new THREE.SphereGeometry(0.1, 8, 6), metalE, 0, RB + RH + 0.82, 0);

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
