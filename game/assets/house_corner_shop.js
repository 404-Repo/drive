// house_corner_shop c0 (fix round 1 triangle pass: glass, mullions and louvres are single planes,
// awning scallops six sided, rib runs at 0.5 m with five segments, balcony posts at 0.25 m, the sign
// discs at 14 segments; every modelled feature kept). Primitive assembly. Two overlapping wall boxes plus a rotated chamfer
// plate form the cut corner; ground floor arches are ring archivolts over half cylinder soffits
// with a dark recess behind; the hip roof over the five sided eave polygon is a hand built
// BufferGeometry with rib cylinders per face; awnings are striped boxes with cylinder scallops;
// the corner sign is a disc on a bracket.
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

  const WW = 0xf1e6d2, OCH = 0xe0a862, STN = 0xcdb897, SHD = 0x8d7b63, TER = 0xc4683f, RED = 0xd6402f, TEAL = 0x3f8f8a, MD = 0x3a3f46;
  const wall = mat('plaster', 0xe9ddc7, 0.82), wallEdge = mat('plaster', WW, 0.8);
  const gf = mat('plaster', OCH, 0.82), gfEdge = mat('plaster', light(OCH, 0.1), 0.8), gfBase = mat('plaster', dark(OCH), 0.85);
  const stone = mat('stone', STN, 0.8), stoneTop = mat('stone', bleach(STN), 0.78), stoneD = mat('stone', SHD, 0.85);
  const roof = mat('tile', TER, 0.78, 0, { side: DS }), roofTop = mat('tile', bleach(TER), 0.76, 0, { side: DS }), roofEdge = mat('tile', light(TER, 0.1), 0.76), roofUnder = mat('timber', dark(0xb08a5a, 0.1), 0.8);
  const shut = mat('timber', TEAL, 0.72), shutEdge = mat('timber', light(TEAL, 0.1), 0.7);
  const rail = mat('metal', MD, 0.45, 0.2), signFace = mat('metal', WW, 0.5, 0.15), signRim = mat('metal', RED, 0.45, 0.2);
  const awnR = mat('fabric', RED, 0.85, 0, { side: DS }), awnW = mat('fabric', WW, 0.85, 0, { side: DS });
  const glass = mat(null, 0x8fa9d6, 0.15, 0, { transparent: true, opacity: 0.85 });
  const inner = mat(null, 0x3d3a3a, 0.9), floorM = mat('ground', 0x9a8f80, 0.85);
  const frameM = mat('timber', TEAL, 0.7), frameE = mat('plaster', WW, 0.75);

  const S = 9.2, H = S / 2, CH = 2.6, GF = 3.6, EAVE = 6.8, TOP = 8.35, OV = 0.4, RH = 0.8;
  // body: two overlapping boxes leave the corner, a rotated plate closes the chamfer
  const wallBox = (m, y0, y1, grow) => {
    const e = grow || 0;
    box(g, S - CH + e, y1 - y0, S + 2 * e, m, -CH / 2, (y0 + y1) / 2, 0);
    box(g, S + 2 * e, y1 - y0, S - CH + e, m, 0, (y0 + y1) / 2, -CH / 2);
    const cw = CH * Math.SQRT2 + 2 * e * 0.83, cx = H - CH / 2 + e * 0.5, cz = cx;
    box(g, cw, y1 - y0, 0.4, m, cx + 0.14, (y0 + y1) / 2, cz + 0.14, 0, -PI / 4, 0);
  };
  wallBox(stoneD, 0, 0.35, 0.1); wallBox(stone, 0.35, 0.9, 0.06); wallBox(stoneTop, 0.9, 0.94, 0.09);
  wallBox(gf, 0.94, GF - 0.3, 0); wallBox(gfEdge, GF - 0.3, GF - 0.02, 0.08); wallBox(stoneTop, GF - 0.02, GF + 0.03, 0.12);
  wallBox(wall, GF + 0.03, EAVE - 0.4, 0); wallBox(wallEdge, EAVE - 0.4, EAVE - 0.14, 0.12); wallBox(wallEdge, EAVE - 0.14, EAVE, 0.2); wallBox(stoneTop, EAVE, EAVE + 0.04, 0.24);
  // hip roof over the offset eave polygon, ridge along x
  const e = H + OV, ce = H - CH + OV * (Math.SQRT2 - 1);
  const P = [[-e, -e], [e, -e], [e, ce], [ce, e], [-e, e]];
  const R1 = V(-RH, TOP, 0), R2 = V(RH, TOP, 0), EY = EAVE - 0.02;
  const pos = [];
  const tri = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  const faces = [];
  for (let i = 0; i < P.length; i++) {
    const A = V(P[i][0], EY, P[i][1]), B = V(P[(i + 1) % P.length][0], EY, P[(i + 1) % P.length][1]);
    const mx = (A.x + B.x) / 2;
    let TL, TR;
    if (Math.abs(A.z - B.z) < 1e-6) { TL = A.x < B.x ? R1 : R2; TR = A.x < B.x ? R2 : R1; tri(A, B, TR); tri(A, TR, TL); }
    else { TL = TR = mx > 0 ? R2 : R1; tri(A, B, TL); }
    faces.push([A, B, TL, TR]);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); add(g, geo, roofTop);
  // soffit and fascia, rib runs per face in a local slope frame
  wallBox(roofUnder, EY - 0.1, EY, OV);
  for (const [A, B, TL, TR] of faces) {
    const u = B.clone().sub(A).normalize(), Mb = A.clone().add(B).multiplyScalar(0.5), Mt = TL.clone().add(TR).multiplyScalar(0.5);
    const up0 = Mt.clone().sub(Mb), cu = up0.dot(u), upP = up0.clone().sub(u.clone().multiplyScalar(cu)), L = upP.length(), v = upP.clone().normalize(), n = new THREE.Vector3().crossVectors(u, v).normalize(); if (n.dot(Mb) < 0) { u.negate(); n.negate(); }
    const F = new THREE.Group(); F.position.copy(Mb); F.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n)); g.add(F);
    const wB = A.distanceTo(B), wT = TL.distanceTo(TR), cT = Mt.clone().sub(Mb).dot(u);
    box(F, wB + 0.04, 0.1, 0.2, roofEdge, 0, 0.02, -0.02);
    for (let s = -wB / 2 + 0.2; s < wB / 2 - 0.1; s += 0.5) {
      // the longest rib that stays inside the face: solve where the hip lines pass s
      let t = 1; for (let k = 1; k <= 20; k++) { const tt = k / 20, half = (wB + (wT - wB) * tt) / 2, c0 = cT * tt; if (s < c0 - half || s > c0 + half) { t = (k - 1) / 20; break; } }
      const len = Math.max(0.3, t * L - 0.1);
      add(F, new THREE.CylinderGeometry(0.075, 0.075, len, 5, 1, true), roof, s, len / 2, 0.075);
    }
  }
  const cap = (a, b) => { const d = b.clone().sub(a); const o = add(g, new THREE.CylinderGeometry(0.1, 0.1, d.length(), 8), roofTop); o.position.copy(a.clone().add(d.clone().multiplyScalar(0.5))); o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); };
  cap(R1, R2); for (const p of P) cap(V(p[0], EY, p[1]), (p[0] > 0 ? R2 : R1));
  box(g, 0.6, 1.3, 0.6, wall, -2.6, 7.4, -2.4); box(g, 0.72, 0.12, 0.72, stoneTop, -2.6, 8.1, -2.4);

  const face = (rotY, px, pz) => { const F = new THREE.Group(); F.position.set(px, 0, pz); F.rotation.y = rotY; g.add(F); return F; };
  // ground floor arched shop opening with a recess, glass and a dark back plane
  const shop = (F, x, w, y0, h, open) => {
    const r = w / 2, hs = y0 + h - r, RD = open ? 1.6 : 0.5;
    add(F, new THREE.RingGeometry(r, r + 0.5, 12, 1, 0, PI), stone, x, hs, -0.015);
    add(F, new THREE.CylinderGeometry(r, r, RD, 12, 1, true, -PI / 2, PI), stone, x, hs, -RD / 2, -PI / 2, 0, 0);
    box(F, 0.12, hs - y0, RD, stone, x - r + 0.06, (y0 + hs) / 2, -RD / 2); box(F, 0.12, hs - y0, RD, stone, x + r - 0.06, (y0 + hs) / 2, -RD / 2);
    for (const s of [-1, 1]) { box(F, 0.3, hs - y0 + 0.1, 0.1, stone, x + s * (r + 0.15), (y0 + hs) / 2, 0.02); box(F, 0.34, 0.12, 0.14, stoneTop, x + s * (r + 0.15), hs + 0.02, 0.03); }
    box(F, w + 0.6, 0.35, 0.1, stoneD, x, y0 + 0.17, 0.02);
    if (open) { box(F, w - 0.2, h - 0.1, 0.02, inner, x, y0 + h / 2 - 0.05, -RD + 0.02); box(F, w - 0.1, 0.1, RD, floorM, x, y0 + 0.05, -RD / 2); box(F, 0.05, h - 0.4, RD - 0.2, inner, x - r + 0.16, y0 + h / 2 - 0.2, -RD / 2 - 0.1); box(F, 0.05, h - 0.4, RD - 0.2, inner, x + r - 0.16, y0 + h / 2 - 0.2, -RD / 2 - 0.1); }
    else {
      box(F, w - 0.2, h - 0.2, 0.02, inner, x, y0 + h / 2 - 0.05, -RD + 0.03);
      plate(F, w - 0.24, hs - y0 - 0.4, glass, x, (y0 + 0.4 + hs) / 2, -0.11); add(F, new THREE.CircleGeometry(r - 0.12, 12, 0, PI), glass, x, hs, -0.11);
      box(F, w - 0.2, 0.1, 0.06, frameM, x, hs - 0.03, -0.1); box(F, 0.08, hs - y0 - 0.4, 0.06, frameM, x, (y0 + 0.4 + hs) / 2, -0.1);
      box(F, w - 0.2, 0.42, 0.1, frameM, x, y0 + 0.21, -0.1); box(F, w - 0.16, 0.05, 0.16, stoneTop, x, y0 + 0.44, -0.08);
    }
  };
  const awning = (F, x, y, w, depth) => {
    const A = new THREE.Group(); A.position.set(x, y, 0); A.rotation.x = 0.3; F.add(A);
    const n = Math.round(w / 0.5);
    for (let i = 0; i < n; i++) box(A, w / n, 0.05, depth, i % 2 ? awnW : awnR, -w / 2 + (i + 0.5) * w / n, 0, depth / 2);
    for (let i = 0; i < n; i++) add(A, new THREE.CylinderGeometry(w / n / 2, w / n / 2, 0.04, 6, 1, false, PI / 2, PI), i % 2 ? awnW : awnR, -w / 2 + (i + 0.5) * w / n, -0.03, depth, PI / 2, 0, 0);
    for (const s of [-1, 1]) { box(A, 0.06, 0.06, depth, rail, s * (w / 2 - 0.05), -0.05, depth / 2); }
    for (const s of [-1, 1]) box(F, 0.06, 0.06, depth * 0.9, rail, x + s * (w / 2 - 0.05), y - 0.35, depth * 0.45, -0.32, 0, 0);
  };
  const win = (F, x, y0, w, h, balc) => {
    plate(F, w, h, glass, x, y0 + h / 2, 0.02);
    box(F, w + 0.24, 0.12, 0.08, frameE, x, y0 + h - 0.06, 0.04); box(F, 0.12, h, 0.08, frameE, x - w / 2 - 0.06, y0 + h / 2, 0.04); box(F, 0.12, h, 0.08, frameE, x + w / 2 + 0.06, y0 + h / 2, 0.04);
    plate(F, 0.06, h, frameM, x, y0 + h / 2, 0.06); plate(F, w, 0.06, frameM, x, y0 + h * 0.6, 0.06);
    box(F, w + 0.5, 0.18, 0.12, frameE, x, y0 + h + 0.15, 0.04); box(F, w + 0.54, 0.03, 0.14, stoneTop, x, y0 + h + 0.25, 0.05);
    for (const s of [-1, 1]) { const sx = x + s * (w / 2 + 0.12 + w / 4 + 0.02); box(F, w / 2 + 0.04, h, 0.06, shut, sx, y0 + h / 2, 0.03); for (let k = 0; k < 3; k++) plate(F, w / 2 - 0.06, 0.05, shutEdge, sx, y0 + h * (0.2 + k * 0.3), 0.085); }
    if (balc) {
      box(F, w + 0.6, 0.12, 0.45, stone, x, y0 - 0.06, 0.22); box(F, w + 0.64, 0.03, 0.47, stoneTop, x, y0 + 0.01, 0.23);
      for (const s of [-1, 1]) box(F, 0.24, 0.24, 0.4, stoneD, x + s * (w / 2 + 0.1), y0 - 0.22, 0.2);
      const n = Math.round((w + 0.5) / 0.25);
      for (let i = 0; i <= n; i++) box(F, 0.05, 0.9, 0.05, rail, x - (w + 0.5) / 2 + i * (w + 0.5) / n, y0 + 0.47, 0.4);
      for (const s of [-1, 1]) box(F, 0.05, 0.9, 0.05, rail, x + s * (w + 0.5) / 2, y0 + 0.47, 0.2);
      box(F, w + 0.56, 0.07, 0.07, rail, x, y0 + 0.92, 0.4); box(F, w + 0.56, 0.05, 0.05, rail, x, y0 + 0.3, 0.4);
      for (const s of [-1, 1]) { box(F, 0.07, 0.07, 0.42, rail, x + s * (w + 0.5) / 2, y0 + 0.92, 0.21); box(F, 0.05, 0.05, 0.42, rail, x + s * (w + 0.5) / 2, y0 + 0.3, 0.21); }
    } else { box(F, w + 0.5, 0.12, 0.24, frameE, x, y0 - 0.06, 0.08); box(F, w + 0.54, 0.03, 0.26, stoneTop, x, y0 + 0.01, 0.09); }
  };
  // street faces: +z (x from -4.6 to 2.0) and +x, plus the chamfer
  const FZ = face(0, 0, H), FX = face(PI / 2, H, 0), FC = face(PI / 4, H - CH / 2, H - CH / 2);
  for (const F of [FZ, FX]) {
    shop(F, -2.7, 2.0, 0.35, 2.55, false); shop(F, -0.3, 2.0, 0.35, 2.55, false);
    awning(F, -1.5, 3.0, 5.4, 1.1);
    win(F, -2.7, 4.5, 1.1, 1.8, true); win(F, -0.3, 4.5, 1.1, 1.8, true);
  }
  shop(FC, 0, 2.0, 0.35, 2.55, true);
  win(FC, 0, 4.5, 1.1, 1.8, true);
  // hanging disc sign on a bracket at the corner
  box(FC, 0.08, 0.08, 1.2, rail, 0.9, 6.3, 0.6); box(FC, 0.08, 0.5, 0.08, rail, 0.9, 6.05, 0.04); box(FC, 0.06, 0.06, 0.9, rail, 0.9, 5.95, 0.5, -0.4, 0, 0);
  for (const s of [-1, 1]) box(FC, 0.05, 0.3, 0.05, rail, 0.9 + s * 0.2, 6.1, 1.1);
  add(FC, new THREE.CylinderGeometry(0.5, 0.5, 0.08, 14), signRim, 0.9, 5.45, 1.1, 0, 0, PI / 2);
  add(FC, new THREE.CylinderGeometry(0.4, 0.4, 0.1, 14), signFace, 0.9, 5.45, 1.1, 0, 0, PI / 2);
  // back and left faces: plainer, three windows per floor and a service door
  const FB = face(PI, 0, -H), FL = face(-PI / 2, -H, 0);
  for (const F of [FB, FL]) { for (const x of [-3.0, 0, 3.0]) { win(F, x, 1.2, 1.1, 1.7, false); win(F, x, 4.5, 1.1, 1.8, false); } }
  box(FB, 1.0, 2.2, 0.1, shut, 1.5, 1.1, 0.05).position.x = 1.5; box(FB, 1.24, 0.14, 0.08, frameE, 1.5, 2.28, 0.04);

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
