// retaining_wall_terrace c2: a second reading as heavier rustication. A whole leaning slab on a
// tall plinth of big 0.8 x 0.4 blocks (the reference shows a chunky dark plinth course), the main
// face in a random bond of long and short blocks with four stone tints and a bleached top edge
// on each, deep joints, a fat 0.35 m plaster cap with a half round front roll, a boxed spout with
// a through hole, course grooves on the back, and two crossed bougainvillea cards at the +x end.
export default function (THREE) {
  const g = new THREE.Group();
  const PI = Math.PI, DS = THREE.DoubleSide;
  const C = (h) => new THREE.Color(h);
  const light = (h, f) => C(h).lerp(C(0xffffff), f).getHex();
  const mat = (name, hex, rough, metal, extra) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: metal || 0 }, extra || {})); if (name) m.name = name; return m; };
  const add = (p, geo, m, x, y, z, rx, ry, rz) => { const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.rotation.set(rx || 0, ry || 0, rz || 0); p.add(o); return o; };
  const box = (p, w, h, d, m, x, y, z, rx, ry, rz) => add(p, new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz);

  const STN = 0xcdb897, SHD = 0x8d7b63, WW = 0xf1e6d2;
  const joint = mat('stone', 0x968568, 0.9);
  const blocks = [mat('stone', STN, 0.82), mat('stone', 0xc5ae8c, 0.82), mat('stone', 0xd5c1a1, 0.82), mat('stone', 0xccb494, 0.82)];
  const blockEdge = mat('stone', light(STN, 0.1), 0.78);
  const plinth = mat('stone', SHD, 0.86), plinthB = mat('stone', 0x998669, 0.86), plinthTop = mat('stone', light(SHD, 0.1), 0.84);
  const cap = mat('plaster', 0xe8dcc8, 0.8), capTop = mat('plaster', WW, 0.78), capRoll = mat('plaster', 0xece0cd, 0.78);
  const spout = mat('stone', 0xb9a482, 0.82, 0, { side: DS });
  const cardA = mat('card:bougainvillea_a', 0xd8388a, 0.85, 0, { side: DS }), cardB = mat('card:bougainvillea_b', 0xcf3585, 0.85, 0, { side: DS });

  const L = 6.0, H = 3.0, D = 0.8, BASE = 0.4, CAP = 0.35, ang = 5 * PI / 180, tanB = Math.tan(ang), cosA = Math.cos(ang);
  const faceZ = (y) => D / 2 - tanB * y, BACK = -D / 2;

  // Plinth: 0.4 tall, big blocks 0.8 x 0.4 proud of a dark bed, wrapping the ends
  box(g, L + 0.04, BASE, faceZ(0) - BACK + 0.02, joint, 0, BASE / 2, (faceZ(0) + 0.02 + BACK) / 2);
  for (let i = 0; i < 7; i++) { const w = i === 3 ? 1.0 : 0.78, x = -L / 2 + 0.41 + i * 0.86; if (x + w / 2 > L / 2 + 0.03) continue; box(g, w, BASE - 0.04, 0.06, i % 2 ? plinth : plinthB, x, BASE / 2, faceZ(0) + 0.03); }
  box(g, 0.78, BASE - 0.04, 0.06, plinth, L / 2 - 0.4, BASE / 2, faceZ(0) + 0.03);
  for (const s of [-1, 1]) { box(g, 0.08, BASE - 0.04, (faceZ(0) - BACK) * 0.6, plinth, s * (L / 2 + 0.02), BASE / 2, faceZ(0) - (faceZ(0) - BACK) * 0.3); box(g, 0.08, BASE - 0.04, (faceZ(0) - BACK) * 0.36, plinthB, s * (L / 2 + 0.02), BASE / 2, BACK + (faceZ(0) - BACK) * 0.18); }
  box(g, L + 0.1, 0.03, faceZ(0) - BACK + 0.06, plinthTop, 0, BASE + 0.015, (faceZ(0) + 0.06 + BACK) / 2);

  // Leaning slab body on the plinth: a box tilted by the batter, sunk 0.15 into the plinth
  const bodyH = (H - BASE - CAP + 0.15) / cosA, bodyD = 0.5;      // shallow enough that the leaning back stays inside the footprint
  const Bg = new THREE.Group(); Bg.position.set(0, BASE - 0.15, faceZ(BASE - 0.15) - 0.03); Bg.rotation.x = -ang; g.add(Bg);
  box(Bg, L, bodyH, bodyD, joint, 0, bodyH / 2, -bodyD / 2);
  // vertical back slab and end plates close the wedge behind the leaning body
  box(g, L, H - BASE - CAP + 0.02, 0.08, joint, 0, (BASE + H - CAP) / 2, BACK + 0.04);
  for (const s of [-1, 1]) box(g, 0.02, H - BASE - CAP + 0.02, faceZ(BASE) - 0.03 - BACK, joint, s * (L / 2 - 0.01), (BASE + H - CAP) / 2, (faceZ(BASE) - 0.03 + BACK) / 2);
  // Random bond of face blocks on the tilted body, standing 4 cm proud
  const courses = 7, ch = (H - BASE - CAP) / courses;
  const lens = [0.9, 0.45, 0.6, 0.75, 0.45, 0.6, 0.9, 0.6, 0.45, 0.75];
  let seed = 3;
  for (let c = 0; c < courses; c++) {
    const yl = (c * ch + ch / 2 + 0.15) / cosA;
    let x = -L / 2 + ((c % 3) * 0.2);
    if (x > -L / 2) { const w = x + L / 2 - 0.03; box(Bg, w, ch - 0.04, 0.04, blocks[(c + 2) % 4], -L / 2 + w / 2 + 0.005, yl, 0.02); }
    while (x < L / 2 - 0.01) {
      const len = Math.min(lens[seed++ % lens.length], L / 2 - x);
      if (len < 0.15) { x += len; continue; }
      const w = len - 0.035, xc = x + len / 2;
      box(Bg, w, ch - 0.04, 0.04, blocks[seed % 4], xc, yl, 0.02);
      box(Bg, w - 0.05, 0.025, 0.012, blockEdge, xc, yl + (ch - 0.04) / 2 - 0.014, 0.046);
      x += len;
    }
  }
  // End faces: blocks in the same bond wrapping the ends
  for (const s of [-1, 1]) for (let c = 0; c < courses; c++) {
    const ym = BASE + c * ch + ch / 2, zf = faceZ(ym) - 0.03, dd = zf - BACK;
    const long = (c + (s > 0 ? 0 : 1)) % 2 === 0, d1 = dd * (long ? 0.58 : 0.36), d2 = dd - d1 - 0.035;
    box(g, 0.04, ch - 0.04, d1, blocks[(c + (s > 0 ? 1 : 2)) % 4], s * (L / 2 + 0.02), ym, zf - d1 / 2 - 0.005);
    box(g, 0.04, ch - 0.04, d2, blocks[(c + 3) % 4], s * (L / 2 + 0.02), ym, BACK + d2 / 2 + 0.005);
  }
  // Back grooves
  for (let c = 1; c <= courses; c++) box(g, L, 0.03, 0.02, blockEdge, 0, BASE + c * ch, BACK - 0.01);

  // Fat cap with a half round roll along the front, bleached top
  const cz = faceZ(H - CAP) + 0.06, capD = cz - BACK;
  box(g, L + 0.14, CAP - 0.1, capD, cap, 0, H - CAP / 2 - 0.05, (cz + BACK) / 2);
  box(g, L + 0.12, 0.1, capD - 0.14, cap, 0, H - 0.05, (cz - 0.14 + BACK) / 2);
  add(g, new THREE.CylinderGeometry(0.1, 0.1, L + 0.14, 10), capRoll, 0, H - 0.1, cz - 0.1, 0, 0, PI / 2);
  box(g, L + 0.1, 0.02, capD - 0.24, capTop, 0, H + 0.005, (cz - 0.24 + BACK) / 2);
  for (const s of [-1, 1]) add(g, new THREE.SphereGeometry(0.1, 10, 6), capRoll, s * (L / 2 + 0.07), H - 0.1, cz - 0.1);

  // Boxed spout with a through hole near the base at -x
  const sx = -L / 2 + 1.6, sy = BASE + 0.2, sz = faceZ(sy);
  box(g, 0.34, 0.26, 0.14, blocks[1], sx, sy, sz + 0.05);
  box(g, 0.3, 0.02, 0.15, blockEdge, sx, sy + 0.14, sz + 0.05);
  add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.12, 10, 1, true), spout, sx, sy - 0.02, sz + 0.06, PI / 2, 0, 0);
  add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10), joint, sx, sy - 0.02, sz + 0.02, PI / 2, 0, 0);

  // Two crossed bougainvillea cards over the cap at +x
  const cx = L / 2 - 0.9;
  add(g, new THREE.PlaneGeometry(1.6, 1.3), cardA, cx, H - 0.72, cz + 0.08, -0.05, 0.04, 0);
  add(g, new THREE.PlaneGeometry(1.3, 0.6), cardB, cx + 0.12, H + 0.1, cz - 0.3, -PI / 2 + 0.28, -0.2, 0);

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
