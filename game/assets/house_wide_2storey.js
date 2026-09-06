// house_wide_2storey c0 (fix round 1 triangle pass: glass, mullions, louvres and door strips are
// single planes, balusters six sided and open at 0.42 m, rib runs at 0.5 m with five segments, pots at
// lower segment counts; every modelled feature kept). Primitive assembly. Boxes for the walls, bands and cornice; the hip roof
// is a hand built four face BufferGeometry carrying half round rib cylinders whose length shrinks
// toward the hips; hip and ridge caps are cylinders; balusters are cylinder and box stacks; pots
// are tapered cylinders with sphere foliage; the bougainvillea is two crossed alpha cards.
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
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const WW = 0xf1e6d2, OCH = 0xe0a862, STN = 0xcdb897, SHD = 0x8d7b63, TER = 0xc4683f, OLV = 0x7d8b5a, FOL = 0x4f8a45;
  const wall = mat('plaster', OCH, 0.82), wallB = mat('plaster', 0xdca35e, 0.82), wallEdge = mat('plaster', light(OCH, 0.1), 0.8), wallBase = mat('plaster', dark(OCH), 0.85);
  const corn = mat('plaster', 0xe9dcc6, 0.8), cornTop = mat('plaster', WW, 0.78);
  const roof = mat('tile', TER, 0.78, 0, { side: DS }), roofTop = mat('tile', bleach(TER), 0.76, 0, { side: DS }), roofEdge = mat('tile', light(TER, 0.1), 0.76), roofUnder = mat('timber', dark(0xb08a5a, 0.1), 0.8);
  const shut = mat('timber', OLV, 0.72), shutEdge = mat('timber', light(OLV, 0.1), 0.7);
  const door = mat('timber', OLV, 0.72), doorEdge = mat('timber', light(OLV, 0.1), 0.7);
  const stone = mat('stone', STN, 0.8), stoneTop = mat('stone', bleach(STN), 0.78), stoneD = mat('stone', SHD, 0.85);
  const pot = mat('stone', TER, 0.75), potEdge = mat('stone', light(TER, 0.1), 0.72), leaf = mat('foliage', FOL, 0.85), leafTop = mat('foliage', light(FOL, 0.1), 0.85);
  const cardA = mat('card:bougainvillea_a', 0xd8388a, 0.85, 0, { side: DS }), cardB = mat('card:bougainvillea_b', 0xcf3585, 0.85, 0, { side: DS });
  const glass = mat(null, 0x8fa9d6, 0.15, 0, { transparent: true, opacity: 0.85 });
  const frameM = mat('timber', 0xf1e6d2, 0.7), frameE = mat('plaster', WW, 0.75);

  const W = 10.8, D = 8.0, EAVE = 6.4, TOP = 8.35, OV = 0.6, RH = (W - D) / 2;
  box(g, W + 0.14, 0.7, D + 0.14, wallBase, 0, 0.35, 0);
  box(g, W + 0.18, 0.05, D + 0.18, wallEdge, 0, 0.72, 0);
  box(g, W, EAVE - 0.7, D, wall, 0, 0.7 + (EAVE - 0.7) / 2, 0);
  for (const s of [-1, 1]) box(g, 0.02, EAVE - 0.7, D + 0.02, wallB, s * W / 2, 0.7 + (EAVE - 0.7) / 2, 0);
  // string course between floors, cornice under the eaves, corner strips
  box(g, W + 0.16, 0.16, D + 0.16, corn, 0, 3.12, 0); box(g, W + 0.2, 0.04, D + 0.2, cornTop, 0, 3.22, 0);
  box(g, W + 0.3, 0.3, D + 0.3, corn, 0, EAVE - 0.35, 0); box(g, W + 0.44, 0.14, D + 0.44, corn, 0, EAVE - 0.13, 0); box(g, W + 0.5, 0.05, D + 0.5, cornTop, 0, EAVE - 0.035, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.08, EAVE - 1.3, 0.08, wallEdge, sx * W / 2, 0.75 + (EAVE - 1.3) / 2, sz * D / 2);
  // hip roof body
  const hw = W / 2 + OV, hd = D / 2 + OV, E = EAVE - 0.02;
  const A = [-hw, E, hd], B = [hw, E, hd], Cc = [hw, E, -hd], Dd = [-hw, E, -hd], R1 = [-RH, TOP, 0], R2 = [RH, TOP, 0];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([...A, ...B, ...R2, ...A, ...R2, ...R1, ...B, ...Cc, ...R2, ...Cc, ...Dd, ...R1, ...Cc, ...R1, ...R2, ...Dd, ...A, ...R1].flat(), 3));
  geo.computeVertexNormals(); add(g, geo, roofTop);
  box(g, W + 2 * OV, 0.1, D + 2 * OV, roofUnder, 0, E - 0.05, 0);
  for (const s of [-1, 1]) { box(g, W + 2 * OV + 0.04, 0.2, 0.1, roofEdge, 0, E - 0.02, s * hd); box(g, 0.1, 0.2, D + 2 * OV + 0.04, roofEdge, s * hw, E - 0.02, 0); }
  // rib runs on the four faces, shortened toward the hips
  const rise = TOP - E, runZ = hd, lenZ = Math.hypot(runZ, rise), angZ = Math.atan2(rise, runZ), runX = hw, lenX = Math.hypot(runX, rise), angX = Math.atan2(rise, runX);
  const rib = (S, x, len, zTop) => add(S, new THREE.CylinderGeometry(0.075, 0.075, len, 5, 1, true), roof, x, 0.075, zTop + len / 2, PI / 2, 0, 0);
  const slope = (yaw, ang, mid, dist) => { const S = new THREE.Group(); S.rotation.order = 'YXZ'; S.rotation.y = yaw; S.rotation.x = ang; S.position.set(Math.sin(yaw) * dist, (E + TOP) / 2, Math.cos(yaw) * dist); g.add(S); return S; };
  for (const yaw of [0, PI]) {
    const S = slope(yaw, angZ, 0, runZ / 2);
    for (let x = -hw + 0.2; x < hw - 0.1; x += 0.5) { const f = Math.abs(x) <= RH ? 1 : 1 - (Math.abs(x) - RH) / (hw - RH); rib(S, x, Math.max(0.3, f * lenZ - 0.1), lenZ / 2 - Math.max(0.3, f * lenZ - 0.1) - 0.02); }
  }
  for (const yaw of [PI / 2, -PI / 2]) {
    const S = slope(yaw, angX, 0, runX / 2);
    for (let x = -hd + 0.2; x < hd - 0.1; x += 0.5) { const f = 1 - Math.abs(x) / hd; rib(S, x, Math.max(0.3, f * lenX - 0.1), lenX / 2 - Math.max(0.3, f * lenX - 0.1) - 0.02); }
  }
  // ridge and hip caps
  const cap = (a, b) => { const d = V(...b).sub(V(...a)); const o = add(g, new THREE.CylinderGeometry(0.11, 0.11, d.length(), 10), roofTop); o.position.copy(V(...a).add(d.clone().multiplyScalar(0.5))); o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); return o; };
  cap(R1, R2); cap(A, R1); cap(B, R2); cap(Cc, R2); cap(Dd, R1);
  // roof terrace parapet block at the back and a chimney
  box(g, 3.0, 1.6, 2.0, corn, 1.2, 7.3, -2.2); box(g, 3.1, 0.12, 2.1, cornTop, 1.2, 8.14, -2.2); box(g, 2.6, 0.02, 1.6, stoneD, 1.2, 8.21, -2.2);
  box(g, 0.6, 1.4, 0.6, corn, -2.4, 7.5, -1.6); box(g, 0.72, 0.12, 0.72, stoneTop, -2.4, 8.24, -1.6);

  const face = (rotY, px, pz) => { const F = new THREE.Group(); F.position.set(px, 0, pz); F.rotation.y = rotY; g.add(F); return F; };
  const win = (F, x, y0, w, h, shutters) => {
    plate(F, w, h, glass, x, y0 + h / 2, 0.02);
    box(F, w + 0.24, 0.12, 0.08, frameE, x, y0 + h - 0.06, 0.04); box(F, w + 0.24, 0.12, 0.08, frameE, x, y0 + 0.06, 0.04);
    box(F, 0.12, h, 0.08, frameE, x - w / 2 - 0.06, y0 + h / 2, 0.04); box(F, 0.12, h, 0.08, frameE, x + w / 2 + 0.06, y0 + h / 2, 0.04);
    plate(F, 0.06, h, frameM, x, y0 + h / 2, 0.06); plate(F, w, 0.06, frameM, x, y0 + h * 0.6, 0.06);
    box(F, w + 0.5, 0.12, 0.24, frameE, x, y0 - 0.06, 0.08); box(F, w + 0.54, 0.03, 0.26, cornTop, x, y0 + 0.01, 0.09);
    box(F, w + 0.5, 0.18, 0.12, frameE, x, y0 + h + 0.15, 0.04); box(F, w + 0.54, 0.03, 0.14, cornTop, x, y0 + h + 0.25, 0.05);
    if (shutters) for (const s of [-1, 1]) {
      const sx = x + s * (w / 2 + 0.12 + w / 4 + 0.02);
      box(F, w / 2 + 0.04, h, 0.06, shut, sx, y0 + h / 2, 0.03);
      for (let k = 0; k < 3; k++) plate(F, w / 2 - 0.06, 0.05, shutEdge, sx, y0 + h * (0.2 + k * 0.3), 0.085);
    }
  };
  const baluster = (F, x, y, z) => { add(F, new THREE.CylinderGeometry(0.075, 0.09, 0.42, 6, 1, true), stone, x, y + 0.31, z); box(F, 0.16, 0.1, 0.16, stone, x, y + 0.05, z); add(F, new THREE.SphereGeometry(0.1, 6, 4), stone, x, y + 0.5, z); box(F, 0.14, 0.08, 0.14, stone, x, y + 0.62, z); };
  const balustrade = (F, x0, x1, y, z, along) => {
    const len = x1 - x0, n = Math.round(len / 0.42);
    for (let i = 0; i <= n; i++) { const t = x0 + i * len / n; if (along) baluster(F, t, y, z); else baluster(F, z, y, t); }
    if (along) { box(F, len + 0.16, 0.14, 0.26, stone, (x0 + x1) / 2, y + 0.73, z); box(F, len + 0.2, 0.04, 0.3, stoneTop, (x0 + x1) / 2, y + 0.82, z); box(F, len + 0.16, 0.12, 0.26, stone, (x0 + x1) / 2, y - 0.06, z); }
    else { box(F, 0.26, 0.14, len + 0.16, stone, z, y + 0.73, (x0 + x1) / 2); box(F, 0.3, 0.04, len + 0.2, stoneTop, z, y + 0.82, (x0 + x1) / 2); box(F, 0.26, 0.12, len + 0.16, stone, z, y - 0.06, (x0 + x1) / 2); }
  };
  const potPlant = (F, x, y, z) => { add(F, new THREE.CylinderGeometry(0.3, 0.22, 0.5, 8), pot, x, y + 0.25, z); add(F, new THREE.CylinderGeometry(0.33, 0.33, 0.08, 8), potEdge, x, y + 0.5, z); add(F, new THREE.SphereGeometry(0.42, 8, 6), leaf, x, y + 0.82, z); add(F, new THREE.SphereGeometry(0.26, 6, 4), leafTop, x + 0.1, y + 1.05, z - 0.05); };

  const F = face(0, 0, D / 2);
  // ground: double door with a stone surround and keystone, two windows
  box(F, 2.4, 3.0, 0.12, stone, 0, 1.5, 0.06); box(F, 1.8, 2.6, 0.08, door, 0, 1.3, 0.1);
  for (const s of [-1, 1]) { plate(F, 0.7, 2.0, doorEdge, s * 0.45, 1.45, 0.165); plate(F, 0.7, 0.35, doorEdge, s * 0.45, 2.42, 0.165); }
  box(F, 0.5, 0.5, 0.14, stoneTop, 0, 2.85, 0.07); box(F, 2.8, 0.12, 0.6, stoneTop, 0, 0.06, 0.3);
  add(F, new THREE.SphereGeometry(0.05, 8, 6), stoneD, 0.12, 1.3, 0.16);
  win(F, -3.6, 1.0, 1.2, 1.7, true); win(F, 3.6, 1.0, 1.2, 1.7, true);
  // first floor: four french windows and the full width balcony
  for (const x of [-3.9, -1.3, 1.3, 3.9]) win(F, x, 3.45, 1.1, 2.1, true);
  box(F, W, 0.18, 1.0, stone, 0, 3.24, 0.5); box(F, W + 0.04, 0.04, 1.02, stoneTop, 0, 3.35, 0.51); box(F, W + 0.04, 0.06, 0.06, stoneTop, 0, 3.18, 1.02);
  for (let i = 0; i < 6; i++) box(F, 0.36, 0.3, 0.9, stoneD, -W / 2 + 0.5 + i * (W - 1.0) / 5, 3.0, 0.45);
  balustrade(F, -W / 2 + 0.2, W / 2 - 0.2, 3.37, 0.86, true);
  balustrade(F, 0.15, 0.86, 3.37, -W / 2 + 0.16, false); balustrade(F, 0.15, 0.86, 3.37, W / 2 - 0.16, false);
  for (const x of [-4.3, 0.0, 4.3]) potPlant(F, x, 3.37, 0.45);
  // bougainvillea climbing the front left corner: two crossed cards
  add(g, new THREE.PlaneGeometry(2.6, 6.2), cardA, -W / 2 + 0.2, 3.6, D / 2 + 0.2, 0, PI / 4, 0);
  add(g, new THREE.PlaneGeometry(2.0, 5.6), cardB, -W / 2 + 0.15, 3.2, D / 2 + 0.3, 0, -PI / 4, 0);
  const Bk = face(PI, 0, -D / 2);
  for (const x of [-3.4, 0, 3.4]) { win(Bk, x, 1.0, 1.1, 1.7, x !== 0); win(Bk, x, 4.2, 1.1, 1.7, true); }
  box(Bk, 1.0, 2.2, 0.1, door, -1.7, 1.1, 0.05); box(Bk, 1.24, 0.14, 0.08, frameE, -1.7, 2.28, 0.04);
  for (const s of [1, -1]) { const S = face(s * PI / 2, s * W / 2, 0); for (const x of [-2.0, 2.0]) { win(S, x, 1.0, 1.1, 1.7, true); win(S, x, 4.2, 1.1, 1.7, true); } }

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
