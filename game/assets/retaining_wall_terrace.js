// retaining_wall_terrace c3 (fix round 1): c2's heavy rustication at a third of the triangles,
// nothing modelled dropped. The wall is placed 99 times, so every block counts: face blocks are
// five sided (the back face inside the body is never built), each bleached top edge is a plane
// strip, six courses of 0.375 m in a random bond of long and short blocks with four stone tints,
// the plinth of big blocks, the leaning slab body on a 5 degree batter, end blocks wrapping both
// ends, course grooves on the back, the fat plaster cap with a half round front roll, the boxed
// spout with a through hole and two crossed bougainvillea cards at the +x end.
export default function (THREE) {
  const g = new THREE.Group();
  const PI = Math.PI, DS = THREE.DoubleSide;
  const C = (h) => new THREE.Color(h);
  const light = (h, f) => C(h).lerp(C(0xffffff), f).getHex();
  const mat = (name, hex, rough, metal, extra) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: metal || 0 }, extra || {})); if (name) m.name = name; return m; };
  const add = (p, geo, m, x, y, z, rx, ry, rz) => { const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.rotation.set(rx || 0, ry || 0, rz || 0); p.add(o); return o; };
  const box = (p, w, h, d, m, x, y, z, rx, ry, rz) => add(p, new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz);
  // a box without its -z face: for anything seated on a surface that hides its back
  const box5geo = (w, h, d) => { const b = new THREE.BoxGeometry(w, h, d); b.setIndex(new THREE.BufferAttribute(b.index.array.slice(0, 30), 1)); b.clearGroups(); return b; };
  const box5 = (p, w, h, d, m, x, y, z, rx, ry, rz) => add(p, box5geo(w, h, d), m, x, y, z, rx, ry, rz);
  const plate = (p, w, h, m, x, y, z, rx, ry, rz) => add(p, new THREE.PlaneGeometry(w, h), m, x, y, z, rx, ry, rz);

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
  for (let i = 0; i < 7; i++) { const w = i === 3 ? 1.0 : 0.78, x = -L / 2 + 0.41 + i * 0.86; if (x + w / 2 > L / 2 + 0.03) continue; box5(g, w, BASE - 0.04, 0.06, i % 2 ? plinth : plinthB, x, BASE / 2, faceZ(0) + 0.03); }
  box5(g, 0.78, BASE - 0.04, 0.06, plinth, L / 2 - 0.4, BASE / 2, faceZ(0) + 0.03);
  for (const s of [-1, 1]) { box5(g, (faceZ(0) - BACK) * 0.6, BASE - 0.04, 0.08, plinth, s * (L / 2 + 0.02), BASE / 2, faceZ(0) - (faceZ(0) - BACK) * 0.3, 0, s * PI / 2, 0); box5(g, (faceZ(0) - BACK) * 0.36, BASE - 0.04, 0.08, plinthB, s * (L / 2 + 0.02), BASE / 2, BACK + (faceZ(0) - BACK) * 0.18, 0, s * PI / 2, 0); }
  box(g, L + 0.1, 0.03, faceZ(0) - BACK + 0.06, plinthTop, 0, BASE + 0.015, (faceZ(0) + 0.06 + BACK) / 2);

  // Leaning slab body on the plinth: a box tilted by the batter, sunk 0.15 into the plinth
  const bodyH = (H - BASE - CAP + 0.15) / cosA, bodyD = 0.5;      // shallow enough that the leaning back stays inside the footprint
  const Bg = new THREE.Group(); Bg.position.set(0, BASE - 0.15, faceZ(BASE - 0.15) - 0.03); Bg.rotation.x = -ang; g.add(Bg);
  box(Bg, L, bodyH, bodyD, joint, 0, bodyH / 2, -bodyD / 2);
  // vertical back slab and end plates close the wedge behind the leaning body
  box(g, L, H - BASE - CAP + 0.02, 0.08, joint, 0, (BASE + H - CAP) / 2, BACK + 0.04);
  for (const s of [-1, 1]) box(g, 0.02, H - BASE - CAP + 0.02, faceZ(BASE) - 0.03 - BACK, joint, s * (L / 2 - 0.01), (BASE + H - CAP) / 2, (faceZ(BASE) - 0.03 + BACK) / 2);
  // Random bond of face blocks on the tilted body, standing 4 cm proud, five sided, a bleached edge strip on each
  const courses = 6, ch = (H - BASE - CAP) / courses;
  const lens = [0.95, 0.5, 0.7, 0.85, 0.5, 0.65, 0.95, 0.7, 0.5, 0.8];
  let seed = 3;
  for (let c = 0; c < courses; c++) {
    const yl = (c * ch + ch / 2 + 0.15) / cosA;
    let x = -L / 2 + ((c % 3) * 0.25);
    if (x > -L / 2) { const w = x + L / 2 - 0.03; box5(Bg, w, ch - 0.04, 0.04, blocks[(c + 2) % 4], -L / 2 + w / 2 + 0.005, yl, 0.02); }
    while (x < L / 2 - 0.01) {
      const len = Math.min(lens[seed++ % lens.length], L / 2 - x);
      if (len < 0.18) { x += len; continue; }
      const w = len - 0.035, xc = x + len / 2;
      box5(Bg, w, ch - 0.04, 0.04, blocks[seed % 4], xc, yl, 0.02);   // round 2: the 2.8 cm bleached edge plate per block went (sub pixel past 8 m, 110 triangles a module, 99 modules in view at the hairpin exit)
      x += len;
    }
  }
  // End faces: blocks in the same bond wrapping the ends
  for (const s of [-1, 1]) for (let c = 0; c < courses; c++) {
    const ym = BASE + c * ch + ch / 2, zf = faceZ(ym) - 0.03, dd = zf - BACK;
    // round 2: one full depth block per course per end (was two per course; the ends only show where a row steps)
    box5(g, dd - 0.02, ch - 0.04, 0.04, blocks[(c + (s > 0 ? 1 : 2)) % 4], s * (L / 2 + 0.02), ym, (zf + BACK) / 2, 0, s * PI / 2, 0);
  }
  // Back grooves
  for (let c = 1; c <= courses; c++) plate(g, L, 0.03, blockEdge, 0, BASE + c * ch, BACK - 0.005, 0, PI, 0);

  // Fat cap with a half round roll along the front, bleached top
  const cz = faceZ(H - CAP) + 0.06, capD = cz - BACK;
  box(g, L + 0.14, CAP - 0.1, capD, cap, 0, H - CAP / 2 - 0.05, (cz + BACK) / 2);
  box(g, L + 0.12, 0.1, capD - 0.14, cap, 0, H - 0.05, (cz - 0.14 + BACK) / 2);
  add(g, new THREE.CylinderGeometry(0.1, 0.1, L + 0.14, 8, 1, true), capRoll, 0, H - 0.1, cz - 0.1, 0, 0, PI / 2);
  plate(g, L + 0.1, capD - 0.24, capTop, 0, H + 0.005, (cz - 0.24 + BACK) / 2, -PI / 2, 0, 0);
  for (const s of [-1, 1]) add(g, new THREE.SphereGeometry(0.1, 8, 4), capRoll, s * (L / 2 + 0.07), H - 0.1, cz - 0.1);

  // Boxed spout with a through hole near the base at -x
  const sx = -L / 2 + 1.6, sy = BASE + 0.2, sz = faceZ(sy);
  box5(g, 0.34, 0.26, 0.14, blocks[1], sx, sy, sz + 0.05);
  plate(g, 0.3, 0.15, blockEdge, sx, sy + 0.135, sz + 0.05, -PI / 2, 0, 0);
  add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8, 1, true), spout, sx, sy - 0.02, sz + 0.06, PI / 2, 0, 0);
  add(g, new THREE.CircleGeometry(0.06, 8), joint, sx, sy - 0.02, sz + 0.01);

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
