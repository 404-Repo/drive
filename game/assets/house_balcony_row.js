// house_balcony_row c2 (fix round 1 triangle pass: thin proud strips, louvres, mullions, glass and
// reveals are single planes instead of twelve triangle boxes, balusters are open four sided frustums
// at 0.36 m, pots and ridge tiles at lower segment counts; every modelled feature kept).
// A second reading as a heavier masonry house. Walls are cut bands with real
// recessed french windows behind each balcony, balconies ride a continuous stone base course on
// shaped corbels with square tapered balusters, cloths are two panel bent shapes on the line,
// pots are stacked cylinders, the door sits in a niche under a voussoir arch, the roof is stepped
// courses with rounded tile ends and hand built gable triangles.
export default function (THREE) {
  const g = new THREE.Group();
  const PI = Math.PI, DS = THREE.DoubleSide;
  const C = (h) => new THREE.Color(h);
  const light = (h, f) => C(h).lerp(C(0xffffff), f).getHex();
  const bleach = (h) => { const c = C(h).lerp(C(0xffffff), 0.08); const s = { h: 0, s: 0, l: 0 }; c.getHSL(s); c.setHSL(s.h, s.s * 0.95, s.l); return c.getHex(); };
  const dark = (h, f) => C(h).multiplyScalar(1 - (f || 0.18)).lerp(C(0x8fa9d6), 0.08).getHex();
  const mat = (name, hex, rough, metal, extra) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: metal || 0 }, extra || {})); if (name) m.name = name; return m; };
  const add = (p, geo, m, x, y, z, rx, ry, rz) => { const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.rotation.set(rx || 0, ry || 0, rz || 0); p.add(o); return o; };
  const box = (p, w, h, d, m, x, y, z, rx, ry, rz) => add(p, new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz);
  const plate = (p, w, h, m, x, y, z, rx, ry, rz) => add(p, new THREE.PlaneGeometry(w, h), m, x, y, z, rx, ry, rz);
  const tri = (p, a, b, c, m) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3)); geo.computeVertexNormals(); return add(p, geo, m); };

  const WW = 0xf1e6d2, OCH = 0xe0a862, STN = 0xcdb897, SHD = 0x8d7b63, TER = 0xc4683f, TEAL = 0x3f8f8a, OLV = 0x7d8b5a, FOL = 0x4f8a45, MINT = 0x3fc7a0, YEL = 0xf2c230;
  const wall = mat('plaster', 0xe9ddc7, 0.82), wallB = mat('plaster', 0xe4d7c0, 0.82), wallEdge = mat('plaster', WW, 0.8), reveal = mat('plaster', dark(0xe9ddc7, 0.1), 0.85), baseM = mat('plaster', dark(OCH, 0.08), 0.85), baseTop = mat('plaster', OCH, 0.8);
  const roof = mat('tile', TER, 0.78, 0, { side: DS }), roofTop = mat('tile', bleach(TER), 0.76), roofEdge = mat('tile', light(TER, 0.1), 0.76), roofUnder = mat('timber', dark(0xb08a5a, 0.1), 0.8);
  const stone = mat('stone', STN, 0.8), stoneTop = mat('stone', bleach(STN), 0.78), stoneD = mat('stone', SHD, 0.85), stoneM = mat('stone', dark(STN, 0.1), 0.8), stoneL = mat('stone', light(STN, 0.08), 0.8);
  const rail = mat('timber', TEAL, 0.72), railTop = mat('timber', light(TEAL, 0.1), 0.7);
  const shut = mat('timber', OLV, 0.72), shutEdge = mat('timber', light(OLV, 0.1), 0.7), door = mat('timber', 0xa8865a, 0.75), doorEdge = mat('timber', light(0xa8865a, 0.1), 0.72);
  const clothW = mat('fabric', WW, 0.9), clothM = mat('fabric', MINT, 0.9), clothY = mat('fabric', YEL, 0.9), line = mat('metal', 0x6b6f76, 0.5, 0.1);
  const awnO = mat('fabric', OLV, 0.85), awnW = mat('fabric', WW, 0.85);
  const pot = mat('stone', TER, 0.75), potEdge = mat('stone', light(TER, 0.1), 0.72), leaf = mat('foliage', FOL, 0.85), leafTop = mat('foliage', light(FOL, 0.1), 0.85);
  const glass = mat(null, 0x8fa9d6, 0.15, 0, { transparent: true, opacity: 0.85 });
  const frameM = mat('timber', 0xdcd0ba, 0.7), frameE = mat('plaster', WW, 0.75);

  const W = 8.6, D = 8.4, EAVE = 9.6, RIDGE = 11.25, OV = 0.4, T = 0.36;
  box(g, W + 0.14, 0.9, D + 0.14, baseM, 0, 0.45, 0); box(g, W + 0.18, 0.05, D + 0.18, baseTop, 0, 0.92, 0);
  box(g, W - 2 * T + 0.02, EAVE - 0.9, D - 2 * T + 0.02, reveal, 0, 0.9 + (EAVE - 0.9) / 2, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.08, EAVE - 1.3, 0.08, wallEdge, sx * W / 2, 0.95 + (EAVE - 1.3) / 2, sz * D / 2);
  for (const s of [-1, 1]) { tri(g, [s * W / 2, EAVE - 0.02, D / 2], [s * W / 2, EAVE - 0.02, -D / 2], [s * W / 2, RIDGE - 0.1, 0], s > 0 ? wall : wallB); tri(g, [s * W / 2, EAVE - 0.02, -D / 2], [s * W / 2, EAVE - 0.02, D / 2], [s * W / 2, RIDGE - 0.1, 0], s > 0 ? wall : wallB); }
  const runH = D / 2 + OV, ang = Math.atan2(RIDGE - EAVE + 0.15, runH), len = Math.hypot(runH, RIDGE - EAVE + 0.15), RW = W + 2 * OV;
  for (const s of [1, -1]) {
    const S = new THREE.Group(); S.position.set(0, (EAVE - 0.15 + RIDGE) / 2, s * runH / 2); S.rotation.x = s * ang; g.add(S);
    box(S, RW, 0.06, len, roofUnder, 0, -0.03, 0);
    const n = 9, cl = len / n;
    for (let i = 0; i < n; i++) { box(S, RW, 0.08, cl + 0.12, roofTop, 0, 0.04 + (i % 2) * 0.012, len / 2 - cl * (i + 0.5) - 0.06); box(S, RW, 0.03, 0.08, roof, 0, 0.1 + (i % 2) * 0.012, len / 2 - cl * i - 0.03); }
    box(S, RW + 0.04, 0.16, 0.08, roofEdge, 0, -0.04, len / 2 + 0.02);
    for (let x = -RW / 2 + 0.1; x < RW / 2; x += 0.42) add(S, new THREE.CylinderGeometry(0.075, 0.075, 0.3, 5, 1, true), roof, x, 0.11, len / 2 - 0.1, PI / 2, 0, 0);
    for (let i = 0; i < 6; i++) box(S, 0.12, 0.14, 0.4, roofUnder, (i - 2.5) * (RW - 0.6) / 5, -0.14, len / 2 - 0.3);
  }
  add(g, new THREE.CylinderGeometry(0.17, 0.17, RW, 10, 1, false, 0, PI), roofTop, 0, RIDGE + 0.04, 0, 0, 0, PI / 2);
  const cz = 2.2, cy0 = EAVE - 0.15 + (runH - 2.2) / runH * (RIDGE - EAVE) - 0.3;
  box(g, 0.7, 11.45 - cy0, 0.7, wall, -2.6, (cy0 + 11.45) / 2, cz); box(g, 0.86, 0.14, 0.86, stoneTop, -2.6, 11.52, cz); box(g, 0.5, 0.12, 0.5, stoneD, -2.6, 11.65, cz);

  const face = (rotY, px, pz) => { const F = new THREE.Group(); F.position.set(px, 0, pz); F.rotation.y = rotY; g.add(F); return F; };
  const band = (F, xl, xr, y0, y1, ops, m) => {
    ops = ops.slice().sort((a, b) => a[0] - b[0]); let cur = xl;
    for (const [x, w, yb, yt] of ops) { const pl = x - w / 2; if (pl > cur) box(F, pl - cur, y1 - y0, T, m, (cur + pl) / 2, (y0 + y1) / 2, -T / 2); if (yb > y0) box(F, w, yb - y0, T, m, x, (y0 + yb) / 2, -T / 2); if (y1 > yt) box(F, w, y1 - yt, T, m, x, (yt + y1) / 2, -T / 2); cur = x + w / 2; }
    if (xr > cur) box(F, xr - cur, y1 - y0, T, m, (cur + xr) / 2, (y0 + y1) / 2, -T / 2);
  };
  const win = (F, x, y0, w, h, awn) => {
    const RD = 0.25;
    plate(F, w, h, glass, x, y0 + h / 2, -RD + 0.01);
    plate(F, w + 0.02, RD, reveal, x, y0 + h, -RD / 2, PI / 2, 0, 0); plate(F, RD, h, reveal, x - w / 2, y0 + h / 2, -RD / 2, 0, PI / 2, 0); plate(F, RD, h, reveal, x + w / 2, y0 + h / 2, -RD / 2, 0, -PI / 2, 0);
    plate(F, 0.06, h, frameM, x, y0 + h / 2, -RD + 0.055); plate(F, w - 0.1, 0.06, frameM, x, y0 + h * 0.62, -RD + 0.055);
    box(F, w + 0.4, 0.14, 0.08, wallEdge, x, y0 + h + 0.1, 0.04);
    for (const s of [-1, 1]) { const sx = x + s * (w / 2 + 0.04 + w / 4); box(F, w / 2 - 0.02, h - 0.04, 0.06, shut, sx, y0 + h / 2, 0.03); plate(F, w / 2 - 0.1, 0.05, shutEdge, sx, y0 + h * 0.5, 0.085); for (let k = 0; k < 2; k++) plate(F, 0.05, h * 0.36, shutEdge, sx, y0 + h * (0.27 + k * 0.46), 0.085); }
    if (awn) { box(F, w + 0.3, 0.06, 0.5, awnW, x, y0 + h + 0.24, 0.25); for (let i = 0; i < 5; i += 2) plate(F, (w + 0.3) / 5, 0.5, awnO, x - (w + 0.3) / 2 + (i + 0.5) * (w + 0.3) / 5, y0 + h + 0.275, 0.25, -PI / 2, 0, 0); box(F, w + 0.32, 0.12, 0.04, awnO, x, y0 + h + 0.19, 0.5); }
    else { box(F, w + 0.44, 0.12, RD + 0.2, stone, x, y0 - 0.06, -RD / 2 + 0.1); box(F, w + 0.48, 0.03, RD + 0.22, stoneTop, x, y0 + 0.015, -RD / 2 + 0.11); }
  };
  const cloths = (F, x0, y, z, n) => {
    const mats = [clothW, clothM, clothY]; const span = n * 0.85 + 0.3;
    add(F, new THREE.CylinderGeometry(0.02, 0.02, span, 6), line, x0 + span / 2 - 0.15, y, z, 0, 0, PI / 2);
    for (let i = 0; i < n; i++) { const cx = x0 + 0.3 + i * 0.85; box(F, 0.62, 0.4, 0.04, mats[i % 3], cx, y - 0.2, z - 0.01, 0.12, 0, 0); box(F, 0.62, 0.36, 0.04, mats[i % 3], cx, y - 0.56, z - 0.06, -0.12, 0, 0); box(F, 0.08, 0.1, 0.05, line, cx - 0.25, y - 0.03, z); box(F, 0.08, 0.1, 0.05, line, cx + 0.25, y - 0.03, z); }
  };
  const potPlant = (F, x, y, z) => { add(F, new THREE.CylinderGeometry(0.2, 0.17, 0.16, 8), pot, x, y + 0.08, z); add(F, new THREE.CylinderGeometry(0.26, 0.2, 0.22, 8), pot, x, y + 0.27, z); add(F, new THREE.CylinderGeometry(0.3, 0.28, 0.1, 8), potEdge, x, y + 0.43, z); add(F, new THREE.IcosahedronGeometry(0.38, 1), leaf, x, y + 0.74, z); add(F, new THREE.IcosahedronGeometry(0.24, 0), leafTop, x + 0.1, y + 0.96, z - 0.05); };
  const balcony = (F, w, y0, depth) => {
    box(F, w, 0.2, depth, stone, 0, y0 + 0.1, depth / 2); box(F, w + 0.04, 0.04, depth + 0.02, stoneTop, 0, y0 + 0.22, depth / 2 + 0.01); box(F, w + 0.04, 0.1, 0.1, stoneTop, 0, y0 + 0.05, depth + 0.03);
    box(F, w + 0.1, 0.16, 0.16, stoneL, 0, y0 - 0.08, 0.08);
    for (let i = 0; i < 4; i++) { const bx = -w / 2 + 0.5 + i * (w - 1.0) / 3; box(F, 0.44, 0.36, depth - 0.24, stoneD, bx, y0 - 0.18, (depth - 0.24) / 2); box(F, 0.44, 0.3, 0.6, stoneD, bx, y0 - 0.5, 0.3); box(F, 0.44, 0.24, 0.3, stoneD, bx, y0 - 0.76, 0.15); }
    box(F, w - 0.1, 0.12, 0.16, rail, 0, y0 + 0.3, depth - 0.1); for (const s of [-1, 1]) box(F, 0.16, 0.12, depth - 0.1, rail, s * (w / 2 - 0.08), y0 + 0.3, (depth - 0.1) / 2);
    const yR = y0 + 0.36, n = Math.round(w / 0.36);
    for (let i = 0; i <= n; i++) { const bx = -w / 2 + 0.08 + i * (w - 0.16) / n; add(F, new THREE.CylinderGeometry(0.06, 0.085, 0.56, 4, 1, true), rail, bx, yR + 0.28, depth - 0.1, 0, PI / 4, 0); }
    for (const s of [-1, 1]) for (let i = 1; i < 4; i++) { add(F, new THREE.CylinderGeometry(0.06, 0.085, 0.56, 4, 1, true), rail, s * (w / 2 - 0.08), yR + 0.28, depth * i / 4, 0, PI / 4, 0); }
    box(F, w, 0.1, 0.16, rail, 0, yR + 0.61, depth - 0.1); box(F, w + 0.02, 0.03, 0.18, railTop, 0, yR + 0.675, depth - 0.1);
    for (const s of [-1, 1]) { box(F, 0.16, 0.1, depth - 0.1, rail, s * (w / 2 - 0.08), yR + 0.61, (depth - 0.1) / 2); box(F, 0.18, 0.03, depth - 0.1, railTop, s * (w / 2 - 0.08), yR + 0.675, (depth - 0.1) / 2); }
    cloths(F, -w / 2 + 1.0, yR + 0.62, depth - 0.34, 3);
    potPlant(F, -w / 2 + 0.45, y0 + 0.22, 0.4); potPlant(F, w / 2 - 0.45, y0 + 0.22, 0.4);
  };
  const nicheDoor = (F, x, w, h) => {
    const RD = 0.3, rad = w / 2, hs = h - rad;
    box(F, w, hs, 0.08, door, x, hs / 2, -RD + 0.04); add(F, new THREE.CylinderGeometry(rad, rad, 0.08, 12, 1, false, -PI / 2, PI), door, x, hs, -RD + 0.04, -PI / 2, 0, 0);
    for (const s of [-1, 1]) { plate(F, 0.1, hs - 0.4, doorEdge, x + s * 0.25, hs / 2, -RD + 0.105); box(F, 0.06, hs + rad, RD, reveal, x + s * (w / 2 + 0.03), (hs + rad) / 2, -RD / 2); }
    const nv = 9; for (let i = 0; i < nv; i++) { const a = PI * (i + 0.5) / nv, rr = rad + 0.22; box(F, 0.34, 0.36, 0.14, i % 2 ? stone : stoneM, x + Math.cos(a) * rr, hs + Math.sin(a) * rr, 0.06, 0, 0, a - PI / 2); }
    for (const s of [-1, 1]) box(F, 0.3, hs, 0.12, s > 0 ? stone : stoneM, x + s * (w / 2 + 0.2), hs / 2, 0.06);
    box(F, w + 0.5, 0.12, 0.5, stoneTop, x, 0.06, 0.25);
  };
  const F = face(0, 0, D / 2);
  band(F, -W / 2, W / 2, 0.9, 3.2, [[-2.0, 1.32, 0.9, 2.4], [1.4, 1.0, 1.1, 2.6]], wall);
  for (const fy of [3.2, 6.4]) band(F, -W / 2, W / 2, fy, fy + 3.2, [-2.3, 0, 2.3].map((x) => [x, 0.9, fy + 0.22, fy + 2.42]), wall);
  nicheDoor(F, -2.0, 1.0, 2.4); win(F, 1.4, 1.1, 1.0, 1.5, false);
  for (const fy of [3.2, 6.4]) { for (const x of [-2.3, 0, 2.3]) win(F, x, fy + 0.22, 0.9, 2.2, true); balcony(F, W + 0.2, fy, 1.2); }
  const R = face(PI / 2, W / 2, 0);
  band(R, -D / 2 + T, D / 2 - T, 0.9, 3.2, [[-2.2, 1.0, 1.1, 2.6], [2.2, 1.0, 1.1, 2.6]], wall);
  for (const fy of [3.2, 6.4]) band(R, -D / 2 + T, D / 2 - T, fy, fy + 3.2, [-2.2, 0, 2.2].map((x) => [x, 0.9, fy + 0.22, fy + 2.42]), wall);
  win(R, -2.2, 1.1, 1.0, 1.5, false); win(R, 2.2, 1.1, 1.0, 1.5, false);
  for (const fy of [3.2, 6.4]) { for (const x of [-2.2, 0, 2.2]) win(R, x, fy + 0.22, 0.9, 2.2, true); balcony(R, D + 0.2, fy, 1.2); }
  const B = face(PI, 0, -D / 2), L = face(-PI / 2, -W / 2, 0);
  for (const [FF, half] of [[B, W / 2], [L, D / 2 - T]]) {
    for (let f = 0; f < 3; f++) band(FF, -half, half, f === 0 ? 0.9 : f * 3.2, f * 3.2 + 3.2 - (f === 2 ? 0.4 : 0), [-2.0, 2.0].map((x) => [x, 1.0, f * 3.2 + 1.1, f * 3.2 + 2.7]).concat(FF === B && f === 0 ? [[0, 1.0, 0.9, 2.2]] : []), wallB);
    for (let f = 0; f < 3; f++) for (const x of [-2.0, 2.0]) win(FF, x, f * 3.2 + 1.1, 1.0, 1.6, false);
  }
  box(B, 1.0, 2.2, 0.08, door, 0, 1.1, -0.26); for (const s of [-1, 1]) box(B, 0.06, 2.2, 0.3, reveal, s * 0.53, 1.1, -0.15); box(B, 1.2, 0.14, 0.08, frameE, 0, 2.28, 0.04);
  box(g, W + 0.2, 0.12, D + 0.2, wallEdge, 0, EAVE - 0.42, 0); box(g, W + 0.32, 0.14, D + 0.32, wallEdge, 0, EAVE - 0.29, 0); box(g, W + 0.38, 0.05, D + 0.38, stoneTop, 0, EAVE - 0.195, 0);

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
