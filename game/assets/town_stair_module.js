// town_stair_module c2: a second reading of the reference. Terracotta tile treads set into stone
// risers (each tread overhangs its riser by 3 cm under a rounded stone nosing), flank walls read
// as plaster ochre on a stone plinth with a stone coping that follows the slope as a half round
// roll, square newel piers at both ends with pyramid caps, a wrought bracket with a lantern stub,
// and a wide bowl pot with a domed shrub on the landing.
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
  const ext = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  const poly = (pts) => { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return s; };
  const profX = (p, shape, len, m, x0) => add(p, ext(shape, len), m, x0, 0, 0, 0, -PI / 2, 0);   // (u = world z, v = world y), extruded from x0 toward -x

  const STN = 0xcdb897, SHD = 0x8d7b63, TER = 0xc4683f, OCH = 0xe0a862, FOL = 0x4f8a45, MET = 0x3a3f46;
  const stone = mat('stone', STN, 0.82), stoneTop = mat('stone', bleach(STN), 0.78), stoneEdge = mat('stone', light(STN, 0.11), 0.76), stoneD = mat('stone', SHD, 0.86);
  const cope = mat('stone', light(STN, 0.05), 0.78, 0, { side: DS }), copeTop = mat('stone', bleach(light(STN, 0.05)), 0.76);
  const plasEdge = mat('plaster', light(OCH, 0.1), 0.8), plas = mat('plaster', OCH, 0.84), plasB = mat('plaster', 0xdba25c, 0.84), plasD = mat('plaster', dark(OCH, 0.16), 0.86);
  const tile = mat('tile', TER, 0.8), tileTop = mat('tile', bleach(TER), 0.78), tileEdge = mat('tile', light(TER, 0.1), 0.78);
  const pot = mat('stone', TER, 0.75), potEdge = mat('stone', light(TER, 0.1), 0.72);
  const leaf = mat('foliage', FOL, 0.85), leafTop = mat('foliage', light(FOL, 0.1), 0.85);
  const metal = mat('metal', MET, 0.45, 0.2);

  const N = 14, RISE = 0.145, TREAD = 0.36, SW = 2.2, WT = 0.4, FRONT = 3.0, WALLH = 0.95;
  const stepTop = (i) => (i + 1) * RISE, zFront = (i) => FRONT - i * TREAD;
  const landZ = zFront(N - 1), TOP = stepTop(N - 1);

  // Risers as stone boxes set back 3 cm; treads as tile slabs overhanging them; a round nosing.
  for (let i = 0; i < N; i++) {
    const zf = zFront(i), zb = (i === N - 1) ? -FRONT : zFront(i + 1), t = stepTop(i), d = zf - zb;
    box(g, SW, t - 0.04, d - 0.03, stone, 0, (t - 0.04) / 2, (zf + zb) / 2 - 0.015);           // riser block, recessed
    box(g, SW, 0.04, d, tile, 0, t - 0.02, (zf + zb) / 2);                                       // tile tread
    box(g, SW - 0.06, 0.012, d - 0.1, tileTop, 0, t + 0.006, (zf + zb) / 2 - 0.03);            // bleached tread top
    add(g, new THREE.CylinderGeometry(0.045, 0.045, SW, 8), stoneEdge, 0, t - 0.03, zf - 0.01, 0, 0, PI / 2);   // nosing
    // tile joints across the tread, two per step, a hair proud
    for (const jx of [-SW / 6, SW / 6]) box(g, 0.03, 0.006, d - 0.12, tileEdge, jx, t + 0.014, (zf + zb) / 2 - 0.03);
  }

  // Flank walls: plaster body from the side profile, stone plinth, a stone roll coping on the slope.
  const line = (z) => RISE + (FRONT - z) / TREAD * RISE + WALLH;
  const zF1 = FRONT - 0.5, zB0 = -FRONT + 0.5, hL = TOP + WALLH;
  const ang = Math.atan2(RISE, TREAD);
  const wallProf = poly([[zF1, 0.3], [zF1, line(zF1) - 0.06], [landZ, line(landZ) - 0.06], [zB0, line(landZ) - 0.06], [zB0, 0.3]]);
  for (const s of [-1, 1]) {
    const x = s * (SW / 2 + WT / 2);
    profX(g, wallProf, WT, s > 0 ? plas : plasB, x + WT / 2);
    // stone plinth 0.3 tall with a dark base band, proud of the plaster
    box(g, WT + 0.1, 0.3, 2 * FRONT, stoneD, x, 0.15, 0);
    box(g, WT + 0.12, 0.03, 2 * FRONT + 0.02, stoneTop, x, 0.315, 0);
    // roll coping along the slope: a half round on a flat bed
    const z0 = zF1, z1 = landZ, L = Math.hypot(z0 - z1, line(z1) - line(z0)), mz = (z0 + z1) / 2, my = line(mz) - 0.06;
    box(g, WT + 0.08, 0.06, L, cope, x, my + 0.03, mz, ang, 0, 0);
    add(g, new THREE.CylinderGeometry(0.12, 0.12, L, 10, 1, false, PI / 2, PI), copeTop, x, my + 0.06, mz, PI / 2 + ang, 0, 0);
    box(g, WT + 0.1, 0.02, L, copeTop, x, my + 0.065, mz, ang, 0, 0);
    // landing coping, flat
    const lz = (landZ + zB0) / 2, ll = landZ - zB0;
    box(g, WT + 0.08, 0.06, ll, cope, x, hL - 0.03, lz);
    add(g, new THREE.CylinderGeometry(0.12, 0.12, ll, 10, 1, false, PI / 2, PI), copeTop, x, hL, lz, PI / 2, 0, 0);
    // newel piers, stone, with a pyramid cap
    const pier = (zc, h) => {
      box(g, WT + 0.08, h, 0.5, stone, x, h / 2, zc);
      box(g, WT + 0.12, 0.06, 0.54, stoneEdge, x, h + 0.03, zc);
      add(g, new THREE.ConeGeometry((WT + 0.12) * 0.72, 0.16, 4), stoneTop, x, h + 0.14, zc, 0, PI / 4, 0);
      box(g, WT + 0.14, 0.25, 0.54, stoneD, x, 0.125, zc);
    };
    pier(FRONT - 0.25, line(zF1) + 0.02);
    pier(-FRONT + 0.25, hL + 0.1);
    // a plaster course line on the outer face (a slight lighter band) tilted with the slope
    // outer face dressing: a raised plaster panel frame following the slope, stone quoins at the
    // piers, and three iron pattress discs, so the long side is not one bare plane
    const xo = s * (SW / 2 + WT), fw = 0.06;
    add(g, new THREE.BoxGeometry(0.03, fw, L - 0.5), plasEdge, xo + s * 0.015, line(mz) - 0.2, mz, ang, 0, 0);              // under the coping
    box(g, 0.03, fw, landZ - zF1 - 0.5, plasEdge, xo + s * 0.015, 0.3 + fw / 2 + 0.06, mz);                                   // above the plinth
    box(g, 0.03, line(zF1) - 0.5, fw, plasEdge, xo + s * 0.015, (line(zF1) - 0.5) / 2 + 0.36, zF1 - 0.25);                   // front upright
    box(g, 0.03, line(landZ) - 0.5, fw, plasEdge, xo + s * 0.015, (line(landZ) - 0.5) / 2 + 0.36, landZ + 0.25);            // back upright
    for (let k = 0; k < 3; k++) { const qz = zF1 - 0.03, qy = 0.45 + k * 0.5; box(g, 0.05, 0.22, 0.34 + (k % 2) * 0.16, k % 2 ? stone : stoneEdge, xo + s * 0.02, qy, qz - 0.17 - (k % 2) * 0.08); }
    for (let k = 0; k < 4; k++) { const qz = zB0 + 0.03, qy = 0.45 + k * 0.5; box(g, 0.05, 0.22, 0.34 + (k % 2) * 0.16, k % 2 ? stone : stoneEdge, xo + s * 0.02, qy, qz + 0.17 + (k % 2) * 0.08); }
    for (let k = 0; k < 3; k++) { const dz = zF1 - 0.9 - k * 1.2; add(g, new THREE.CylinderGeometry(0.09, 0.09, 0.04, 8), metal, xo + s * 0.02, line(dz) - 0.62, dz, 0, 0, PI / 2); }
  }

  // Bracket with lantern stub on the outer +x wall
  const bx = SW / 2 + WT + 0.02, bz = 0.2, by = line(bz) - 0.5;
  box(g, 0.08, 0.5, 0.1, metal, bx + 0.03, by, bz);
  box(g, 0.22, 0.06, 0.06, metal, bx + 0.11, by + 0.22, bz);
  box(g, 0.14, 0.05, 0.05, metal, bx + 0.08, by + 0.1, bz, 0, 0, 0.6);
  box(g, 0.1, 0.16, 0.1, metal, bx + 0.19, by + 0.12, bz);
  box(g, 0.12, 0.03, 0.12, metal, bx + 0.19, by + 0.21, bz);

  // Wide bowl pot with a domed shrub on the landing, against the -x wall
  const px = -SW / 2 + 0.5, pz = -FRONT + 0.65, py = TOP + 0.01;
  add(g, new THREE.CylinderGeometry(0.3, 0.2, 0.32, 12), pot, px, py + 0.16, pz);
  add(g, new THREE.CylinderGeometry(0.33, 0.31, 0.07, 12), potEdge, px, py + 0.35, pz);
  add(g, new THREE.SphereGeometry(0.38, 10, 7, 0, PI * 2, 0, PI / 2), leaf, px, py + 0.38, pz);
  add(g, new THREE.SphereGeometry(0.2, 8, 6), leafTop, px + 0.1, py + 0.66, pz - 0.05);
  add(g, new THREE.SphereGeometry(0.16, 8, 6), leaf, px - 0.18, py + 0.6, pz + 0.12);

  g.userData.mounts = 'back';

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
