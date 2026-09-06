// town_gate_arch c3: c0 (primitive assembly) with the bougainvillea cards pulled in over the
// plus X pier so the overall width sits within 10 percent of the 15 m brief. Otherwise c0: Two stone piers laid in staggered block courses
// (boxes) on a darker base band with a whitewash string course, an elliptical arch of
// voussoir boxes between them with a whitewash spandrel wall, an ochre upper wall with a
// shuttered window, a pitched tile cap with barrel tile cylinders and a rounded ridge, a
// coral shield plaque, two lamp brackets with warm lenses and bougainvillea cards over the
// plus X pier. Spans X, faces plus Z.
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

  const stone = fam('stone', 0xcdb897, 0.85, 0);
  const stoneB = fam('stone', 0xd5c2a2, 0.85, 0);
  const shade = fam('stone', 0x8d7b63, 0.9, 0);
  const wash = fam('plaster', 0xf1e6d2, 0.78, 0);
  const ochre = fam('plaster', 0xe0a862, 0.8, 0);
  const tile = fam('tile', 0xc4683f, 0.75, 0);
  const tileB = mat('tile', 0xcd7349, 0.75, 0);
  const teal = fam('timber', 0x3f8f8a, 0.7, 0);
  const coral = fam('plaster', 0xed5851, 0.7, 0);
  const metal = fam('metal', 0x3a3f46, 0.45, 0.2);
  const glass = mat(null, 0x8fa9d6, 0.15, 0, { transparent: true, opacity: 0.85 });
  const lamp = mat(null, 0xffc48a, 0.5, 0, { emissive: 0xffc48a, emissiveIntensity: 1.0 });
  const dark = mat('plaster', 0x6a5638, 0.9, 0);
  const cardA = mat('card:bougainvillea_a', 0xd8388a, 0.8, 0, { side: THREE.DoubleSide });
  const cardB = mat('card:bougainvillea_b', 0xd9398b, 0.8, 0, { side: THREE.DoubleSide });

  const CLEAR = 11.5, PW = 1.75, PH = 7.0, PD = 1.75, PX = CLEAR / 2 + PW / 2, BAND = 0.8, SPR = 3.6, CROWN = 6.5;
  const HW = CLEAR / 2, HH = CROWN - SPR;

  // ---------- piers ----------
  for (const s of [-1, 1]) {
    const x = s * PX;
    box(g, PW + 0.1, BAND, PD + 0.1, shade.side, x, BAND / 2, 0);
    box(g, PW + 0.14, 0.06, PD + 0.14, shade.edge, x, BAND - 0.03, 0);
    box(g, PW - 0.16, PH - BAND, PD - 0.16, stone.base, x, BAND + (PH - BAND) / 2, 0);
    // block courses on the four faces
    const CH = 0.62, n = Math.floor((PH - BAND - 0.4) / CH);
    for (let ci = 0; ci < n; ci++) {
      const y = BAND + ci * CH, off = ci % 2 ? 0.45 : 0;
      for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, PI], [1, 0, PI / 2], [-1, 0, -PI / 2]]) {
        if ((dx === -s)) { /* inner face toward the arch: still blocked, but under the arch it is hidden anyway */ }
        const hold = new THREE.Group(); hold.position.set(x + dx * (PW / 2 - 0.1), 0, dz * (PD / 2 - 0.1)); hold.rotation.y = ry; g.add(hold);
        for (let bi = -1; bi <= 1; bi++) {
          const bx = bi * 0.9 + off; if (Math.abs(bx) > PW / 2 - 0.35) continue;
          block(hold, 0.82, CH - 0.06, 0.22, (bi + ci) % 2 ? stone : stoneB, bx, y, 0, 0.04);
        }
      }
    }
    // whitewash string course and pier cap
    block(g, PW + 0.4, 0.3, PD + 0.4, wash, x, 3.4, 0, 0.05);
    block(g, PW + 0.5, 0.35, PD + 0.5, wash, x, PH - 0.35, 0, 0.05);
    // lamp bracket on the front face at 5.5 m
    box(g, 0.08, 0.08, 0.7, metal.side, x - s * 0.3, 5.6, PD / 2 + 0.35);
    box(g, 0.08, 0.5, 0.08, metal.side, x - s * 0.3, 5.35, PD / 2 + 0.66);
    box(g, 0.34, 0.42, 0.34, metal.side, x - s * 0.3, 4.9, PD / 2 + 0.66);
    box(g, 0.24, 0.3, 0.24, lamp, x - s * 0.3, 4.9, PD / 2 + 0.66);
    box(g, 0.4, 0.08, 0.4, metal.edge, x - s * 0.3, 5.15, PD / 2 + 0.66);
    box(g, 0.3, 0.06, 0.3, metal.edge, x - s * 0.3, 4.66, PD / 2 + 0.66);
  }

  // ---------- arch: voussoir boxes along the ellipse, spandrel wall in whitewash ----------
  const N = 15, RING = 0.7;
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N, a = PI * (1 - t), mx = HW + RING / 2, my = HH + RING / 2;
    const x = Math.cos(a) * mx, y = SPR + Math.sin(a) * my, ang = Math.atan2(my * Math.cos(a), -mx * Math.sin(a));
    const hold = new THREE.Group(); hold.position.set(x, y, 0); hold.rotation.z = ang; g.add(hold);
    box(hold, 0.86, RING, PD + 0.2, i % 2 ? stone.side : stoneB.side, 0, 0, 0);
    box(hold, 0.9, 0.06, PD + 0.24, stone.edge, 0, RING / 2 - 0.03, 0);
  }
  // spandrel: the wall between the piers from the spring line to the top of the piers, minus the arch (boxes stacked above the ring)
  const spandrelTop = PH;
  for (let i = 0; i < 12; i++) {
    const y0 = SPR + i * (spandrelTop - SPR) / 12, y1 = y0 + (spandrelTop - SPR) / 12;
    // half width of the ring outer ellipse at the top of this slice
    const yr = Math.min(y1, SPR + HH + RING) - SPR, ex = (yr >= HH + RING) ? 0 : (HW + RING) * Math.sqrt(Math.max(0, 1 - (yr / (HH + RING)) ** 2));
    if (ex > 0) { for (const s of [-1, 1]) box(g, HW - ex + 0.1, y1 - y0, PD - 0.1, wash.side, s * (ex + (HW - ex + 0.1) / 2 - 0.05), (y0 + y1) / 2, 0); }
    else box(g, CLEAR + 0.2, y1 - y0, PD - 0.1, wash.side, 0, (y0 + y1) / 2, 0);
  }
  // shield plaque above the crown
  box(g, 1.0, 0.7, 0.14, coral.side, 0, PH - 0.15, PD / 2 + 0.02);
  mesh(g, new THREE.CylinderGeometry(0.5, 0.5, 0.14, 12, 1, false, PI, PI), coral.side, 0, PH - 0.5, PD / 2 + 0.02, PI / 2, 0, 0);
  box(g, 1.06, 0.08, 0.16, coral.edge, 0, PH + 0.18, PD / 2 + 0.02);
  box(g, 0.7, 0.4, 0.04, coral.edge, 0, PH - 0.2, PD / 2 + 0.11);

  // ---------- upper wall: ochre, 2 m, shuttered window, cornice ----------
  const UW = CLEAR + 2 * PW + 0.0, UY = PH, UH = 2.0;
  box(g, UW, UH, PD, ochre.side, 0, UY + UH / 2, 0);
  box(g, UW + 0.2, 0.12, PD + 0.2, ochre.edge, 0, UY + 0.06, 0);
  for (const sz of [-1, 1]) {
    const z = sz * (PD / 2);
    box(g, 1.2, 1.3, 0.2, dark, 0, UY + 1.0, z);
    box(g, 0.9, 1.0, 0.22, glass, 0, UY + 1.0, z);
    box(g, 0.06, 1.0, 0.26, wash.edge, 0, UY + 1.0, z);
    box(g, 0.9, 0.06, 0.26, wash.edge, 0, UY + 1.0, z);
    box(g, 1.4, 0.1, 0.3, wash.top, 0, UY + 0.32, z);
    for (const s of [-1, 1]) { block(g, 0.5, 1.3, 0.08, teal, s * 0.9, UY + 0.4, z + sz * 0.08, 0.03); for (let k = 0; k < 4; k++) box(g, 0.42, 0.04, 0.04, teal.edge, s * 0.9, UY + 0.6 + k * 0.28, z + sz * 0.14); }
  }
  // ---------- tile cap: two pitched slabs with barrel tiles, rounded ridge, verge boards ----------
  const PITCH = 30 * PI / 180, HALF = PD / 2 + 0.45, SLOPE = HALF / Math.cos(PITCH), RISE = HALF * Math.tan(PITCH), EAVE = UY + UH, RW = UW + 0.6;
  for (const sz of [-1, 1]) {
    const rg = new THREE.Group();
    if (sz > 0) { rg.position.set(0, EAVE, HALF); rg.rotation.x = PITCH; } else { rg.position.set(0, EAVE + RISE, 0); rg.rotation.x = -PITCH; }
    g.add(rg);
    box(rg, RW, 0.2, SLOPE, tile.base, 0, 0.1, -SLOPE / 2);
    box(rg, RW - 0.1, 0.05, SLOPE, tile.top, 0, 0.22, -SLOPE / 2);
    for (let i = 0; i < Math.round(RW / 0.55); i++) mesh(rg, new THREE.CylinderGeometry(0.17, 0.17, SLOPE - 0.1, 8, 1, true), i % 2 ? tile.side : tileB, -RW / 2 + 0.27 + i * 0.55, 0.27, -SLOPE / 2, PI / 2, 0, 0);
    for (const sx of [-1, 1]) box(rg, 0.12, 0.42, SLOPE, tile.edge, sx * (RW / 2 - 0.06), 0.21, -SLOPE / 2);
    box(rg, RW, 0.42, 0.12, tile.edge, 0, 0.21, sz > 0 ? -0.06 : -SLOPE + 0.06);
  }
  mesh(g, new THREE.CylinderGeometry(0.3, 0.3, RW, 12), tile.edge, 0, EAVE + RISE + 0.22, 0, 0, 0, PI / 2);
  for (const s of [-1, 1]) mesh(g, new THREE.SphereGeometry(0.3, 12, 8), tile.edge, s * RW / 2, EAVE + RISE + 0.22, 0);

  // ---------- bougainvillea cards over the plus X pier ----------
  mesh(g, new THREE.PlaneGeometry(3.2, 4.2), cardA, PX - 0.25, PH - 0.6, PD / 2 + 0.25, -0.12, 0.25, 0.1);
  mesh(g, new THREE.PlaneGeometry(2.4, 3.2), cardB, PX + 0.3, PH + 0.3, PD / 2 - 0.4, 0.15, -0.9, 0.0);

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
