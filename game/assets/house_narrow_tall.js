// house_narrow_tall c0: primitive assembly. Walls, plinth and cornice are boxes; the attic is a
// three sided cylinder prism scaled to the roof pitch; roof slabs are tilted boxes carrying
// half round rib cylinders as tile runs; the door head and ridge are half cylinders; every
// facade is built in its own outward facing group so all four sides carry windows.
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

  const WW = 0xf1e6d2, OCH = 0xe0a862, STN = 0xcdb897, SHD = 0x8d7b63, TER = 0xc4683f, RED = 0xd6402f, TEAL = 0x3f8f8a, OLV = 0x7d8b5a, MD = 0x3a3f46;
  const wall = mat('plaster', 0xe9ddc7, 0.82), wallEdge = mat('plaster', WW, 0.8), wallBase = mat('plaster', dark(0xe9ddc7), 0.85);
  const plinth = mat('stone', STN, 0.8), plinthTop = mat('stone', bleach(STN), 0.78), baseBand = mat('stone', SHD, 0.85);
  const roof = mat('tile', TER, 0.78, 0, { side: DS }), roofTop = mat('tile', bleach(TER), 0.76), roofEdge = mat('tile', light(TER, 0.1), 0.76), roofUnder = mat('timber', dark(0xb08a5a, 0.1), 0.8);
  const shut = mat('timber', TEAL, 0.72), shutEdge = mat('timber', light(TEAL, 0.1), 0.7);
  const door = mat('timber', OLV, 0.72), doorEdge = mat('timber', light(OLV, 0.1), 0.7);
  const stone = mat('stone', STN, 0.8), stoneTop = mat('stone', bleach(STN), 0.78);
  const rail = mat('metal', MD, 0.45, 0.2), pipe = mat('metal', light(MD, 0.3), 0.45, 0.2);
  const awnR = mat('fabric', RED, 0.85), awnW = mat('fabric', WW, 0.85);
  const glass = mat(null, 0x8fa9d6, 0.15, 0, { transparent: true, opacity: 0.85 });
  const frameM = mat('timber', 0xdcd0ba, 0.7);
  const chimCap = mat('stone', bleach(STN), 0.78);

  const W = 7.2, D = 8.8, EAVE = 9.6, RIDGE = 11.25, OV = 0.4;
  // base band, plinth, wall, quoins, cornice
  box(g, W + 0.16, 0.35, D + 0.16, baseBand, 0, 0.175, 0);
  box(g, W + 0.12, 0.55, D + 0.12, plinth, 0, 0.625, 0);
  box(g, W + 0.16, 0.04, D + 0.16, plinthTop, 0, 0.92, 0);
  box(g, W, EAVE - 0.9, D, wall, 0, 0.9 + (EAVE - 0.9) / 2, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.08, EAVE - 0.95 - 0.35, 0.08, wallEdge, sx * W / 2, 0.95 + (EAVE - 0.95 - 0.35) / 2, sz * D / 2);
  box(g, W + 0.3, 0.22, D + 0.3, wallEdge, 0, EAVE - 0.35, 0);
  box(g, W + 0.36, 0.05, D + 0.36, plinthTop, 0, EAVE - 0.22, 0);

  // attic prism: three sided cylinder, axis along x, one vertex up, scaled to the pitch
  const rise = RIDGE - EAVE - 0.05, r = D / (2 * 0.8660254);
  const attic = add(g, new THREE.CylinderGeometry(r, r, W, 3, 1, false, PI / 2, PI * 2), wall, 0, 0, 0, 0, 0, PI / 2);
  attic.scale.x = rise / (1.5 * r);
  attic.position.y = EAVE + 0.5 * r * attic.scale.x - 0.02;

  // two slopes: a group per slope, local +z runs downhill, local y is the slope normal
  const runH = D / 2 + OV, ang = Math.atan2(RIDGE - EAVE + 0.15, runH), len = Math.hypot(runH, RIDGE - EAVE + 0.15);
  for (const s of [1, -1]) {
    const S = new THREE.Group(); S.position.set(0, (EAVE - 0.15 + RIDGE) / 2, s * runH / 2); S.rotation.x = s * ang; g.add(S);
    box(S, W + 2 * OV, 0.1, len, roofTop, 0, 0.0, 0);
    box(S, W + 2 * OV, 0.06, len, roofUnder, 0, -0.08, 0);
    box(S, W + 2 * OV + 0.04, 0.18, 0.1, roofEdge, 0, -0.03, len / 2 - 0.02);
    const n = Math.floor((W + 2 * OV) / 0.4);
    for (let i = 0; i <= n; i++) add(S, new THREE.CylinderGeometry(0.075, 0.075, len - 0.1, 6, 1, true), roof, -(W + 2 * OV) / 2 + 0.12 + i * 0.4, 0.09, -0.02, PI / 2, 0, 0);
    for (let i = 0; i < 6; i++) box(S, 0.12, 0.14, 0.4, roofUnder, (i - 2.5) * (W + 2 * OV - 0.6) / 5, -0.18, len / 2 - 0.3);
  }
  add(g, new THREE.CylinderGeometry(0.16, 0.16, W + 2 * OV, 10, 1, false, 0, PI), roofTop, 0, RIDGE + 0.02, 0, 0, 0, PI / 2);
  // chimney at the back right
  const cz = -2.2, cy0 = EAVE - 0.15 + (runH - 2.2) / runH * (RIDGE - EAVE) - 0.3;
  box(g, 0.7, 11.45 - cy0, 0.7, wall, 2.4, (cy0 + 11.45) / 2, cz);
  box(g, 0.86, 0.14, 0.86, chimCap, 2.4, 11.52, cz);
  box(g, 0.5, 0.12, 0.5, baseBand, 2.4, 11.65, cz);

  // facade helpers in a local frame: x across, y up, z out of the wall
  const face = (rotY, px, pz) => { const F = new THREE.Group(); F.position.set(px, 0, pz); F.rotation.y = rotY; g.add(F); return F; };
  const win = (F, x, y0, w, h, shutters) => {
    box(F, w, h, 0.02, glass, x, y0 + h / 2, 0.01);
    box(F, w + 0.2, 0.1, 0.08, frameM, x, y0 + h - 0.05, 0.04);
    box(F, w + 0.2, 0.1, 0.08, frameM, x, y0 + 0.05, 0.04);
    box(F, 0.1, h, 0.08, frameM, x - w / 2 - 0.05, y0 + h / 2, 0.04);
    box(F, 0.1, h, 0.08, frameM, x + w / 2 + 0.05, y0 + h / 2, 0.04);
    box(F, 0.06, h, 0.05, frameM, x, y0 + h / 2, 0.035);
    box(F, w, 0.06, 0.05, frameM, x, y0 + h * 0.62, 0.035);
    box(F, w + 0.5, 0.12, 0.24, stone, x, y0 - 0.06, 0.08);
    box(F, w + 0.54, 0.03, 0.26, stoneTop, x, y0 + 0.01, 0.09);
    box(F, w + 0.44, 0.16, 0.1, wallEdge, x, y0 + h + 0.12, 0.03);
    if (shutters) for (const s of [-1, 1]) {
      const sx = x + s * (w / 2 + 0.1 + w / 4 + 0.02);
      box(F, w / 2 + 0.04, h, 0.06, shut, sx, y0 + h / 2, 0.03);
      for (let k = 0; k < 4; k++) box(F, w / 2 - 0.06, 0.06, 0.03, shutEdge, sx, y0 + h * (0.15 + k * 0.23), 0.07);
    }
  };
  const balcony = (F, x, y0, w, depth) => {
    box(F, w, 0.16, depth, stone, x, y0 + 0.08, depth / 2);
    box(F, w + 0.04, 0.04, depth + 0.02, stoneTop, x, y0 + 0.18, depth / 2 + 0.01);
    box(F, w + 0.04, 0.06, 0.06, stoneTop, x, y0 + 0.02, depth + 0.03);
    for (let i = 0; i < 3; i++) box(F, 0.3, 0.3, depth - 0.15, stone, x + (i - 1) * (w / 2 - 0.5), y0 - 0.15, (depth - 0.15) / 2);
    const yR = y0 + 0.2;
    const post = (px, pz, t) => box(F, t, 1.0, t, rail, px, yR + 0.5, pz);
    post(x - w / 2 + 0.05, depth - 0.05, 0.09); post(x + w / 2 - 0.05, depth - 0.05, 0.09);
    const n = Math.round(w / 0.22);
    for (let i = 1; i < n; i++) post(x - w / 2 + i * (w / n), depth - 0.05, 0.05);
    for (const s of [-1, 1]) { for (let i = 1; i < 4; i++) post(x + s * (w / 2 - 0.05), depth * i / 4, 0.05); }
    box(F, w, 0.08, 0.08, rail, x, yR + 1.0, depth - 0.05);
    box(F, w, 0.05, 0.05, rail, x, yR + 0.12, depth - 0.05);
    for (const s of [-1, 1]) { box(F, 0.08, 0.08, depth, rail, x + s * (w / 2 - 0.05), yR + 1.0, depth / 2); box(F, 0.05, 0.05, depth, rail, x + s * (w / 2 - 0.05), yR + 0.12, depth / 2); }
  };
  const arch = (F, x, y, rad, thick, zc, m) => add(F, new THREE.CylinderGeometry(rad, rad, thick, 12, 1, false, -PI / 2, PI), m, x, y, zc, -PI / 2, 0, 0);
  const roundDoor = (F, x, w, h) => {
    const rad = w / 2, hs = h - rad;
    box(F, w + 0.32, hs, 0.07, stone, x, hs / 2, 0.035); arch(F, x, hs, rad + 0.16, 0.07, 0.035, stone);
    box(F, w, hs, 0.1, door, x, hs / 2 + 0.02, 0.05); arch(F, x, hs, rad, 0.1, 0.05, door);
    for (const s of [-1, 1]) box(F, 0.12, hs - 0.5, 0.03, doorEdge, x + s * (w / 4), hs / 2 + 0.05, 0.11);
    box(F, w, 0.1, 0.06, doorEdge, x, hs - 0.05, 0.11);
    add(F, new THREE.CircleGeometry(rad - 0.08, 12, 0, PI), glass, x, hs + 0.02, 0.11);
    for (const a of [PI / 4, PI / 2, 3 * PI / 4]) box(F, 0.05, rad - 0.1, 0.03, doorEdge, x + Math.cos(a) * (rad - 0.1) / 2, hs + 0.02 + Math.sin(a) * (rad - 0.1) / 2, 0.12, 0, 0, a - PI / 2);
    box(F, w + 0.5, 0.12, 0.5, stoneTop, x, 0.06, 0.25);
  };
  const awning = (F, x, y, w, depth) => {
    const A = new THREE.Group(); A.position.set(x, y, 0); A.rotation.x = 0.38; F.add(A);
    const n = Math.round(w / 0.28);
    for (let i = 0; i < n; i++) box(A, w / n, 0.05, depth, i % 2 ? awnW : awnR, -w / 2 + (i + 0.5) * w / n, 0, depth / 2);
    box(A, w + 0.02, 0.14, 0.05, awnR, 0, -0.06, depth);
    for (const s of [-1, 1]) box(A, 0.05, 0.05, depth, rail, s * (w / 2 - 0.05), -0.05, depth / 2);
  };

  // front (+z)
  const F = face(0, 0, D / 2);
  roundDoor(F, 1.9, 1.0, 2.4);
  awning(F, 1.9, 2.8, 1.7, 0.75);
  win(F, -1.5, 1.05, 1.1, 1.7, true);
  win(F, -1.5, 3.4, 1.0, 2.0, true); win(F, 1.7, 3.4, 1.0, 2.0, true);
  balcony(F, 0.1, 3.14, 4.9, 1.0);
  win(F, -1.5, 7.3, 1.0, 1.7, true); win(F, 1.7, 7.3, 1.0, 1.7, true);
  // drain pipe down the front left corner
  add(F, new THREE.CylinderGeometry(0.06, 0.06, 9.0, 10), pipe, -3.42, 0.4 + 4.5, 0.12);
  add(F, new THREE.CylinderGeometry(0.06, 0.06, 0.3, 10), pipe, -3.42, 0.32, 0.25, PI / 2, 0, 0);
  for (const y of [2.0, 5.2, 8.4]) box(F, 0.18, 0.06, 0.16, pipe, -3.42, y, 0.06);
  // back (-z)
  const B = face(PI, 0, -D / 2);
  for (let f = 0; f < 3; f++) { win(B, -1.8, f * 3.2 + 1.1, 1.0, 1.6, f > 0); win(B, 1.8, f * 3.2 + 1.1, 1.0, 1.6, f > 0); }
  box(B, 1.0, 2.2, 0.1, door, 0, 1.1, 0.05); box(B, 1.2, 0.14, 0.08, wallEdge, 0, 2.28, 0.04);
  // sides (+x and -x)
  for (const s of [1, -1]) {
    const S = face(s * PI / 2, s * W / 2, 0);
    win(S, -2.0, 1.3, 0.9, 1.2, false);
    for (let f = 1; f < 3; f++) { win(S, -2.0, f * 3.2 + 1.1, 1.0, 1.6, true); win(S, 2.0, f * 3.2 + 1.1, 1.0, 1.6, true); }
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
