// lighthouse c1: built from profiles. The tower is one lathe silhouette split into colour
// bands (plinth, stone base band, whitewash, red, whitewash ...), each band a LatheGeometry
// whose top lip flares 2 cm as the painted edge. Gallery deck, lantern drum, dome and finial
// are lathes, the mullions are extruded strips, the lamp is an emissive lathe. The keeper's
// block roof is a barrel vault profile (arc) extruded along X carrying an extruded scalloped
// tile skin, and the door and windows are round headed Shapes extruded from the wall.
// bevelEnabled false everywhere. Door faces plus Z.
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
  const ext = (shape, depth, seg) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: seg || 8 });
  const rect = (w, h, x0, y0) => { const s = new THREE.Shape(); s.moveTo(x0, y0); s.lineTo(x0 + w, y0); s.lineTo(x0 + w, y0 + h); s.lineTo(x0, y0 + h); s.closePath(); return s; };
  const arch = (w, h) => { const s = new THREE.Shape(); const r = w / 2; s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r); s.absarc(0, h - r, r, 0, PI, false); s.lineTo(-r, 0); s.closePath(); return s; };
  const lathe = (parent, pts, segs, m, x, y, z) => mesh(parent, new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), segs), m, x, y, z);

  const wash = fam('plaster', 0xf1e6d2, 0.78, 0);
  const ochre = fam('plaster', 0xe0a862, 0.8, 0);
  const red = fam('plaster', 0xd6402f, 0.7, 0);
  const stone = fam('stone', 0xcdb897, 0.85, 0);
  const shade = fam('stone', 0x8d7b63, 0.9, 0);
  const tile = fam('tile', 0xc4683f, 0.75, 0);
  const olive = fam('timber', 0x7d8b5a, 0.7, 0);
  const teal = fam('timber', 0x3f8f8a, 0.7, 0);
  const metal = fam('metal', 0x3a3f46, 0.45, 0.2);
  const glass = mat(null, 0x8fa9d6, 0.15, 0, { transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const lamp = mat(null, 0xffc48a, 0.5, 0, { emissive: 0xffc48a, emissiveIntensity: 1.1 });
  const dark = mat('plaster', 0x6a5638, 0.9, 0, { side: THREE.DoubleSide });

  // ---------- tower: banded lathes ----------
  const TZ = 1.0, R0 = 2.0, R1 = 1.5, H0 = 0.5, H1 = 13.9, SEG = 20;
  const rAt = (y) => R0 + (R1 - R0) * ((y - H0) / (H1 - H0));
  lathe(g, [[0, 0], [2.45, 0], [2.35, H0 - 0.06], [2.41, H0 - 0.02], [2.41, H0], [0, H0]], SEG, stone.side, 0, 0, TZ);
  const bands = [[H0, 1.44, shade], [1.44, 6.0, wash], [6.0, 7.2, red], [7.2, 12.0, wash], [12.0, 13.2, red], [13.2, H1, wash]];
  for (const [y0, y1, f] of bands) {
    const r0 = rAt(y0), r1 = rAt(y1);
    // body then a flared lip as the painted edge
    lathe(g, [[0, 0], [r0, 0], [r1, y1 - y0 - 0.09], [0, y1 - y0 - 0.09]], SEG, f.side, 0, y0, TZ);
    lathe(g, [[0, 0], [r1 + 0.005, 0], [r1 + 0.03, 0.03], [r1 + 0.03, 0.08], [r1 - 0.01, 0.09], [0, 0.09]], SEG, f.edge, 0, y1 - 0.09, TZ);
  }
  // door: round headed stone surround and olive door, front
  const doorZ = TZ + rAt(1.5);
  mesh(g, ext(arch(1.5, 2.85), 0.5), stone.edge, 0, H0, doorZ - 0.35);
  mesh(g, ext(arch(1.1, 2.55), 0.16), olive.side, 0, H0, doorZ + 0.02);
  for (let i = 1; i < 4; i++) mesh(g, ext(rect(0.05, 2.2, 0, 0), 0.05), olive.base, -0.55 + i * 0.275, H0, doorZ + 0.18);
  mesh(g, ext(rect(1.1, 0.1, -0.55, 0), 0.05), olive.edge, 0, H0 + 1.3, doorZ + 0.18);
  lathe(g, [[0, 0], [0.06, 0], [0.06, 0.06], [0, 0.06]], 8, metal.side, 0.35, H0 + 1.15, doorZ + 0.18).rotation.x = PI / 2;
  // small round headed windows on front, back and one side
  const winGeo = ext(arch(0.7, 1.0), 0.3), glassGeo = ext(arch(0.5, 0.8), 0.08), sillGeo = ext(rect(0.9, 0.12, -0.45, 0), 0.35);
  for (const [y, ang] of [[4.2, 0], [9.4, 0], [4.2, PI], [9.4, PI], [7.0, PI / 2]]) {
    const r = rAt(y);
    const hold = new THREE.Group(); hold.position.set(Math.sin(ang) * r, y - 0.5, TZ + Math.cos(ang) * r); hold.rotation.y = ang; g.add(hold);
    mesh(hold, winGeo, dark, 0, 0, -0.2);
    mesh(hold, glassGeo, glass, 0, 0.1, 0.05);
    mesh(hold, ext(rect(0.06, 0.8, -0.03, 0), 0.08), wash.edge, 0, 0.1, 0.07);
    mesh(hold, sillGeo, stone.top, 0, -0.12, -0.15);
  }

  // ---------- gallery ----------
  const GY = 13.9, GR = 2.35;
  // brackets: twelve small extruded triangles under the deck
  const brk = new THREE.Shape(); brk.moveTo(0, 0); brk.lineTo(0.55, 0); brk.lineTo(0, -0.5); brk.closePath();
  for (let i = 0; i < 12; i++) {
    const a = i * PI / 6, rr = rAt(GY) - 0.02;
    const hold = new THREE.Group(); hold.position.set(Math.sin(a) * rr, GY - 0.02, TZ + Math.cos(a) * rr); hold.rotation.y = a; g.add(hold);
    mesh(hold, ext(brk, 0.26), red.base, 0.13, 0, 0, 0, -PI / 2, 0);
  }
  lathe(g, [[0, 0], [GR - 0.12, 0], [GR, 0.12], [GR, 0.3], [GR - 0.04, 0.36], [0, 0.36]], SEG, red.side, 0, GY, TZ);
  lathe(g, [[0, 0], [GR - 0.06, 0], [GR - 0.1, 0.05], [0, 0.05]], SEG, red.top, 0, GY + 0.36, TZ);
  for (let i = 0; i < 16; i++) {
    const a = i * PI / 8, rr = GR - 0.18;
    lathe(g, [[0, 0], [0.05, 0], [0.04, 1.15], [0, 1.15]], 8, metal.side, Math.sin(a) * rr, GY + 0.4, TZ + Math.cos(a) * rr);
  }
  mesh(g, new THREE.TorusGeometry(GR - 0.18, 0.06, 8, 24), metal.edge, 0, GY + 1.55, TZ, PI / 2, 0, 0);
  mesh(g, new THREE.TorusGeometry(GR - 0.18, 0.04, 8, 24), metal.side, 0, GY + 1.0, TZ, PI / 2, 0, 0);

  // ---------- lantern room ----------
  const LY = GY + 0.4, LR = 1.3, LH = 1.75;
  lathe(g, [[0, 0], [LR + 0.1, 0], [LR + 0.1, 0.24], [LR + 0.02, 0.28], [0, 0.28]], SEG, metal.side, 0, LY, TZ);
  lathe(g, [[0, 0], [LR - 0.05, 0], [LR - 0.05, LH], [0, LH]], 16, glass, 0, LY + 0.28, TZ);
  for (let i = 0; i < 8; i++) {
    const a = i * PI / 4;
    const hold = new THREE.Group(); hold.position.set(Math.sin(a) * LR, LY + 0.28, TZ + Math.cos(a) * LR); hold.rotation.y = a; g.add(hold);
    mesh(hold, ext(rect(0.1, LH, -0.05, 0), 0.1), metal.side, 0, 0, -0.05);
  }
  mesh(g, new THREE.TorusGeometry(LR, 0.05, 6, 16), metal.side, 0, LY + 0.28 + LH / 2, TZ, PI / 2, 0, 0);
  lathe(g, [[0, 0], [LR + 0.04, 0], [LR + 0.14, 0.1], [LR + 0.14, 0.22], [0, 0.22]], SEG, metal.edge, 0, LY + 0.28 + LH, TZ);
  lathe(g, [[0, 0], [0.35, 0], [0.3, 0.6], [0, 0.6]], 12, metal.side, 0, LY + 0.28, TZ);
  lathe(g, [[0, 0], [0.16, 0], [0.19, 0.22], [0.19, 0.45], [0.12, 0.6], [0, 0.66]], 12, lamp, 0, LY + 0.88, TZ);
  // dome and finial as one lathe each
  const DY = LY + 0.28 + LH + 0.22, DR = LR + 0.12;
  const dome = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8 * PI / 2; dome.push([Math.cos(t) * DR, Math.sin(t) * DR]); }
  dome.push([0, DR]);
  lathe(g, [[0, 0]].concat(dome), SEG, metal.side, 0, DY, TZ).scale.y = 0.8;
  for (let i = 0; i < 8; i++) mesh(g, new THREE.TorusGeometry(DR + 0.02, 0.035, 6, 10, PI / 2), metal.edge, 0, DY, TZ, 0, i * PI / 4, 0).scale.y = 0.8;
  lathe(g, [[0, 0], [0.18, 0], [0.14, 0.2], [0.16, 0.24], [0.16, 0.34], [0.06, 0.46], [0.06, 0.6], [0.03, 0.64], [0, 0.64]], 10, metal.edge, 0, DY + DR * 0.8 - 0.02, TZ);

  // ---------- keeper's block with a barrel vault roof ----------
  const KW = 7.0, KD = 4.6, KH = 3.2, KZ = TZ - 2.0, BAND = 0.25;
  mesh(g, ext(rect(KW + 0.06, KD + 0.06, -(KW + 0.06) / 2, -(KD + 0.06) / 2), BAND), wash.base, 0, 0, KZ, -PI / 2, 0, 0);
  mesh(g, ext(rect(KW, KD, -KW / 2, -KD / 2), KH - BAND), wash.side, 0, BAND, KZ, -PI / 2, 0, 0);
  mesh(g, ext(rect(KW + 0.04, KD + 0.04, -(KW + 0.04) / 2, -(KD + 0.04) / 2), 0.9), ochre.side, 0, BAND, KZ, -PI / 2, 0, 0);
  mesh(g, ext(rect(KW + 0.08, KD + 0.08, -(KW + 0.08) / 2, -(KD + 0.08) / 2), 0.06), ochre.edge, 0, BAND + 0.9, KZ, -PI / 2, 0, 0);
  // vault: a segmental arc profile in the (z, y) plane, extruded along x; scalloped tile skin over it
  const VH = 1.2, half = KD / 2 + 0.3, VR = (half * half + VH * VH) / (2 * VH);
  const vault = new THREE.Shape();
  vault.moveTo(-half, 0); vault.lineTo(half, 0);
  const cy = VH - VR, a0 = Math.asin(half / VR);
  vault.absarc(0, cy, VR, PI / 2 - a0, PI / 2 + a0, false);
  vault.closePath();
  const vaultGeo = ext(vault, KW + 0.2, 14);
  mesh(g, vaultGeo, tile.base, KW / 2 + 0.1, KH - 0.05, KZ, 0, -PI / 2, 0);
  // tile courses: rows of arcs running over the vault, one extruded scalloped profile per 0.6 m along x
  const tileProf = new THREE.Shape();
  const nArc = 14, r = 0.2;
  tileProf.moveTo(-half, 0.02); tileProf.lineTo(half, 0.02);
  tileProf.absarc(0, cy, VR + 0.02, PI / 2 - a0, PI / 2 + a0, false);
  tileProf.closePath();
  const tileGeo = new THREE.ExtrudeGeometry(tileProf, { depth: 0.4, bevelEnabled: false, curveSegments: nArc });
  for (let i = 0; i < Math.round((KW + 0.2) / 0.6); i++) {
    const x = -(KW + 0.2) / 2 + 0.3 + i * 0.6;
    mesh(g, tileGeo, i % 2 ? tile.side : tile.edge, x + 0.2, KH - 0.05 + 0.02 + (i % 2) * 0.03, KZ, 0, -PI / 2, 0);
  }
  // rounded vault edge beams along both eaves and a ridge roll
  mesh(g, new THREE.CylinderGeometry(0.16, 0.16, KW + 0.3, 10), tile.edge, 0, KH + 0.02, KZ + half, 0, 0, PI / 2);
  mesh(g, new THREE.CylinderGeometry(0.16, 0.16, KW + 0.3, 10), tile.edge, 0, KH + 0.02, KZ - half, 0, 0, PI / 2);
  mesh(g, new THREE.CylinderGeometry(0.2, 0.2, KW + 0.3, 10), tile.edge, 0, KH - 0.05 + VH + 0.02, KZ, 0, 0, PI / 2);
  // windows: two on the back, one each side, shuttered
  const wGeo = ext(arch(1.0, 1.35), 0.3), wGlass = ext(arch(0.8, 1.15), 0.08), shGeo = ext(rect(0.45, 1.3, 0, 0), 0.08), wSill = ext(rect(1.3, 0.12, -0.65, 0), 0.3);
  for (const [x, z, ry] of [[-2.0, KZ - KD / 2, PI], [2.0, KZ - KD / 2, PI], [-KW / 2, KZ, -PI / 2], [KW / 2, KZ, PI / 2]]) {
    const hold = new THREE.Group(); hold.position.set(x, 1.3, z); hold.rotation.y = ry; g.add(hold);
    mesh(hold, wGeo, dark, 0, 0, -0.2);
    mesh(hold, wGlass, glass, 0, 0.1, 0.05);
    mesh(hold, ext(rect(0.06, 1.15, -0.03, 0), 0.08), wash.edge, 0, 0.1, 0.07);
    mesh(hold, shGeo, teal.side, -0.98, 0, 0.02); mesh(hold, shGeo, teal.side, 0.53, 0, 0.02);
    mesh(hold, wSill, stone.top, 0, -0.12, -0.12);
  }
  // chimney
  mesh(g, ext(rect(0.6, 0.6, -0.3, -0.3), 1.4), wash.side, -2.4, KH + 0.7, KZ - 0.9, -PI / 2, 0, 0);
  mesh(g, ext(rect(0.7, 0.7, -0.35, -0.35), 0.12), tile.side, -2.4, KH + 2.1, KZ - 0.9, -PI / 2, 0, 0);

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
