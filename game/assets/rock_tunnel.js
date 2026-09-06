// rock_tunnel c3: c0 (primitive assembly) with a fix pass after the sheet: the portal face
// plate is now warm stone and carries the slab courses across it (stone shade ledge strips
// at every course joint and short vertical joints, stopping at the voussoir ring) instead of
// one flat dark plate; the rooftop tufts and agaves are trimmed so the height sits within
// 10 percent of the 12 m brief. Otherwise c0: The rock buttress is stacked slab courses (boxes with
// per course jitter, warm stone sides, bleached tops, a recessed stone shade ledge between
// courses); below the crown each course is two boxes flanking the bore, above it one. Each
// portal carries a face plate with the elliptical opening (the one extrude, so nothing sees
// through), a ring of voussoir boxes with a whitewash painted edge band and stacked jambs.
// The bore is an elliptical half cylinder plus two walls, DoubleSide, with warm lamp lenses.
// Parapet blocks, tufts and two agaves on top. Road axis is Z, portals at plus and minus Z.
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
  // slab with a bleached top and painted top edge strips (front and back only, the long edges that read)
  const slab = (w, h, d, f, x, y, z) => {
    box(g, w, h - 0.05, d, f.side, x, y + (h - 0.05) / 2, z);
    box(g, w - 0.1, 0.05, d - 0.1, f.top, x, y + h - 0.025, z);
    for (const sz of [-1, 1]) box(g, w, 0.06, 0.06, f.edge, x, y + h - 0.03, z + sz * (d / 2 - 0.03));
    for (const sx of [-1, 1]) box(g, 0.06, 0.06, d - 0.12, f.edge, x + sx * (w / 2 - 0.03), y + h - 0.03, z);
  };
  // deterministic jitter
  let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

  const stone = fam('stone', 0xcdb897, 0.85, 0);
  const stoneB = fam('stone', 0xd3bf9d, 0.85, 0);
  const shade = fam('stone', 0x8d7b63, 0.9, 0);
  const wash = mat('stone', 0xf1e6d2, 0.78, 0);
  const inner = mat('stone', 0x7a6b56, 0.9, 0, { side: THREE.DoubleSide });
  const pine = fam('foliage', 0x2f5e3a, 0.85, 0);
  const palm = fam('foliage', 0x4f8a45, 0.85, 0);
  const metal = mat('metal', 0x3a3f46, 0.45, 0.2);
  const lamp = mat(null, 0xffc48a, 0.5, 0, { emissive: 0xffc48a, emissiveIntensity: 1.0 });

  const W = 20, D = 24, H = 12, OW = 6.0, SPR = 3.6, CROWN = 6.0, RING = 0.8;
  const OH = CROWN - SPR; // half height of the elliptical arch
  // outer ring ellipse (where the slab ends stop)
  const RX = OW + RING, RY = OH + RING;
  const edgeAt = (y) => (y <= SPR ? RX : (y >= SPR + RY ? 0 : RX * Math.sqrt(Math.max(0, 1 - ((y - SPR) / RY) ** 2))));

  // ---------- slab courses ----------
  const courses = [[0, 1.3], [1.3, 2.7], [2.7, 4.0], [4.0, 5.3], [5.3, 6.7], [6.7, 8.1], [8.1, 9.4], [9.4, 10.6], [10.6, 11.6]];
  for (let i = 0; i < courses.length; i++) {
    const [y0, y1] = courses[i], h = y1 - y0;
    const ins = 0.15 + rnd() * 0.45 + (i > 6 ? (i - 6) * 0.35 : 0); // upper courses step back
    const wC = W - 2 * ins, dC = D - 0.2 - rnd() * 0.4, zC = (rnd() - 0.5) * 0.3;
    const f = i % 2 ? stone : stoneB;
    const e = edgeAt(y0 + 0.01);
    if (e > 0 && y0 < SPR + RY) {
      // two flanking slabs; their inner ends stop just outside the voussoir ring at this course's base
      const inW = wC / 2 - e;
      if (inW > 0.2) { slab(inW, h, dC, f, e + inW / 2, y0, zC); slab(inW, h, dC, f, -(e + inW / 2), y0, zC); }
    } else slab(wC, h, dC, f, 0, y0, zC);
    // recessed ledge above each course (stone shade), the deep horizontal joint
    if (i < courses.length - 1) {
      const eN = edgeAt(y1 + 0.01);
      if (eN > 0 && y1 < SPR + RY) { for (const s of [-1, 1]) box(g, wC / 2 - eN - 0.6, 0.12, dC - 0.6, shade.side, s * (eN + (wC / 2 - eN) / 2), y1 - 0.02, zC); }
      else box(g, wC - 1.2, 0.12, dC - 0.6, shade.side, 0, y1 - 0.02, zC);
    }
  }
  // base band: the lowest course is stone shade on its outside faces
  for (const s of [-1, 1]) box(g, W / 2 - RX - 0.02, 0.9, D + 0.06, shade.side, s * (RX + (W / 2 - RX) / 2 + 0.02), 0.45, 0);

  // ---------- portals: face plate with the elliptical opening, voussoir ring, jambs ----------
  const plate = new THREE.Shape(); plate.moveTo(-W / 2 + 0.6, 0); plate.lineTo(W / 2 - 0.6, 0); plate.lineTo(W / 2 - 0.6, 11.0); plate.lineTo(-W / 2 + 0.6, 11.0); plate.closePath();
  const hole = new THREE.Path(); hole.moveTo(-OW, 0); hole.lineTo(OW, 0); hole.lineTo(OW, SPR); hole.absellipse(0, SPR, OW, OH, 0, PI, false); hole.lineTo(-OW, 0); hole.closePath();
  plate.holes.push(hole);
  const plateGeo = new THREE.ExtrudeGeometry(plate, { depth: 1.0, bevelEnabled: false, curveSegments: 12 });
  for (const sz of [-1, 1]) {
    mesh(g, plateGeo, sz > 0 ? stone.side : stoneB.side, 0, 0, sz > 0 ? D / 2 - 1.05 : -D / 2 + 0.05);
    const zf = sz * (D / 2 - 0.1);
    // slab courses carried across the portal face: a stone shade ledge at every course joint,
    // from the voussoir ring out to the plate edge, plus two or three short vertical joints per course
    const zj = sz * (D / 2 - 0.05) + sz * 0.05;
    for (let i = 0; i < courses.length - 1; i++) {
      const y1 = courses[i][1], y0 = courses[i][0];
      if (y1 > 10.9) continue;
      const e = (y1 < SPR + RY) ? Math.max(edgeAt(y1 + 0.01) + RING + 0.15, 0) : 0;
      const outer = W / 2 - 0.6;
      if (e > 0.2 && e < outer - 0.3) { for (const s of [-1, 1]) box(g, outer - e, 0.14, 0.12, shade.side, s * (e + (outer - e) / 2), y1, zj); }
      else if (e <= 0.2) {
        // above the keystone: full width in two halves so the strip does not cut through it
        const ks = (y1 < SPR + OH + RING + 0.5) ? 0.7 : 0;
        for (const s of [-1, 1]) box(g, outer - ks, 0.14, 0.12, shade.side, s * (ks + (outer - ks) / 2), y1, zj);
      }
      // vertical joints inside this course, jittered, kept outside the ring and the keystone
      const nJ = 2 + (i % 2);
      for (let k = 0; k < nJ; k++) for (const s of [-1, 1]) {
        const ex = Math.max(edgeAt(y0 + 0.01), edgeAt(y1 - 0.01)) + RING + 0.5;
        const span = outer - 0.4 - ex; if (span < 0.6) continue;
        const x = ex + (k + 0.5 + (rnd() - 0.5) * 0.6) * span / nJ;
        box(g, 0.12, y1 - y0 - 0.3, 0.1, shade.side, s * x, (y0 + y1) / 2, zj);
      }
    }
    // voussoirs along the ellipse (mid radius)
    const N = 13;
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N, a = PI * (1 - t);
      const mx = OW + RING / 2, my = OH + RING / 2;
      const x = Math.cos(a) * mx, y = SPR + Math.sin(a) * my;
      const ang = Math.atan2(my * Math.cos(a), -mx * Math.sin(a)); // tangent direction
      const hold = new THREE.Group(); hold.position.set(x, y, zf); hold.rotation.z = ang; g.add(hold);
      box(hold, 0.92, RING, 0.9, i % 2 ? stone.side : stoneB.side, 0, 0, sz * 0.15);
      box(hold, 0.94, 0.1, 0.94, wash, 0, RING / 2 - 0.05, sz * 0.15);
      box(hold, 0.94, RING, 0.08, stone.edge, 0, 0, sz * 0.62);
    }
    // jambs: stacked blocks either side below the spring
    for (let j = 0; j < 4; j++) for (const s of [-1, 1]) {
      box(g, RING, SPR / 4 - 0.04, 0.9, j % 2 ? stone.side : stoneB.side, s * (OW + RING / 2), (j + 0.5) * SPR / 4, zf + sz * 0.15);
      box(g, 0.1, SPR / 4 - 0.04, 0.94, wash, s * (OW + RING - 0.05), (j + 0.5) * SPR / 4, zf + sz * 0.15);
    }
    // keystone
    box(g, 1.1, RING + 0.3, 1.0, stone.edge, 0, SPR + OH + RING / 2 + 0.1, zf + sz * 0.2);
  }

  // ---------- bore: elliptical half cylinder and two walls, warm lamp lenses ----------
  const bore = mesh(g, new THREE.CylinderGeometry(OW, OW, D - 0.2, 16, 1, true, PI / 2, PI), inner, 0, SPR, 0, PI / 2, 0, 0);
  bore.scale.set(1, 1, OH / OW);
  for (const s of [-1, 1]) box(g, 0.1, SPR, D - 0.2, inner, s * OW, SPR / 2, 0);
  for (const s of [-1, 1]) for (const zl of [-6, 6]) {
    box(g, 0.3, 0.5, 0.3, metal, s * (OW - 0.15), 3.0, zl);
    box(g, 0.22, 0.32, 0.34, lamp, s * (OW - 0.15), 3.0, zl);
    box(g, 0.14, 0.6, 0.14, metal, s * (OW - 0.07), 3.5, zl);
  }

  // ---------- top: parapet blocks, tufts, agaves ----------
  const TOP = 11.6;
  for (const sz of [-1, 1]) for (let i = 0; i < 9; i++) {
    const w = 1.5 + rnd() * 0.5, x = -8 + i * 2 + (rnd() - 0.5) * 0.3;
    slab(w, 0.55 + rnd() * 0.2, 0.9, stone, x, TOP, sz * (D / 2 - 3.2 - rnd() * 0.4));
  }
  const tuft = (x, z, r) => { mesh(g, new THREE.SphereGeometry(r, 8, 6), pine.side, x, TOP + r * 0.55, z).scale.set(1, 0.7, 1); mesh(g, new THREE.SphereGeometry(r * 0.7, 8, 6), pine.edge, x + r * 0.5, TOP + r * 0.6, z - r * 0.3).scale.set(1, 0.7, 1); };
  tuft(-5.5, 6.5, 1.0); tuft(-2.5, 7.4, 0.9); tuft(1.5, 7.0, 1.0); tuft(6.5, 6.8, 0.9); tuft(4.5, -7.2, 1.0); tuft(-6.0, -6.6, 1.0); tuft(0.0, -0.5, 1.0); tuft(-3.5, 2.0, 0.9);
  const agave = (x, z) => {
    for (let i = 0; i < 9; i++) {
      const a = i * PI * 2 / 9, tilt = 0.75 + (i % 2) * 0.25;
      const o = mesh(g, new THREE.ConeGeometry(0.22, 1.3, 6), i % 2 ? palm.side : palm.edge, x + Math.sin(a) * 0.55, TOP + 0.5, z + Math.cos(a) * 0.55);
      o.rotation.set(Math.cos(a) * tilt, 0, -Math.sin(a) * tilt);
    }
    mesh(g, new THREE.ConeGeometry(0.18, 1.3, 6), palm.edge, x, TOP + 0.65, z);
  };
  agave(4.0, 5.2); agave(-6.5, -3.0);

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
