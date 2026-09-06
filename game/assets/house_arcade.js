// house_arcade c0 (fix round 1 triangle pass: glass, mullions and louvres are single planes, rib
// runs at 0.5 m with five segments, rail balusters at 0.25 m; every modelled feature kept).
// Primitive assembly. Square stone piers with base bands carry ring archivolts
// over half cylinder soffits (open, DoubleSide) with spandrel boxes above; the walkway floor and
// dark back wall with two doors sit 2.5 m behind; upper floors are boxes with framed shuttered
// windows on all four faces; the balcony is a slab on corbels with a box baluster rail; the hip
// roof is a hand built BufferGeometry with rib runs per face and three gabled box dormers.
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

  const WW = 0xf1e6d2, ROSE = 0xd9876d, STN = 0xcdb897, SHD = 0x8d7b63, TER = 0xc4683f, OLV = 0x7d8b5a, MD = 0x3a3f46;
  const wall = mat('plaster', ROSE, 0.82), wallB = mat('plaster', 0xd48168, 0.82), wallEdge = mat('plaster', light(ROSE, 0.1), 0.8);
  const gf = mat('plaster', 0xe9ddc7, 0.82, 0, { side: DS }), gfEdge = mat('plaster', WW, 0.8);
  const stone = mat('stone', STN, 0.8, 0, { side: DS }), stoneTop = mat('stone', bleach(STN), 0.78), stoneD = mat('stone', SHD, 0.85), stoneL = mat('stone', light(STN, 0.08), 0.8);
  const roof = mat('tile', TER, 0.78, 0, { side: DS }), roofTop = mat('tile', bleach(TER), 0.76, 0, { side: DS }), roofEdge = mat('tile', light(TER, 0.1), 0.76), roofUnder = mat('timber', dark(0xb08a5a, 0.1), 0.8);
  const shut = mat('timber', OLV, 0.72), shutEdge = mat('timber', light(OLV, 0.1), 0.7), door = mat('timber', OLV, 0.72), doorEdge = mat('timber', light(OLV, 0.1), 0.7);
  const rail = mat('metal', MD, 0.45, 0.2), floorM = mat('ground', 0x9a8f80, 0.85), floorE = mat('ground', 0xa59a8a, 0.85);
  const glass = mat(null, 0x8fa9d6, 0.15, 0, { transparent: true, opacity: 0.85 });
  const frameM = mat('timber', 0xf1e6d2, 0.7), frameE = mat('plaster', WW, 0.75);

  const W = 11.4, D = 8.6, GF = 3.6, EAVE = 10.0, TOP = 11.55, OV = 0.3, RH = (W - D) / 2, PW = 0.6, R = 0.78, SPR = 3.2 - R, WALK = 2.5;
  const XS = [-4.32, -2.16, 0, 2.16, 4.32], PX = [-5.4, -3.24, -1.08, 1.08, 3.24, 5.4];
  // arcade: piers, arches, spandrel along the front and one bay on each side; solid ground floor behind
  const arcadeBay = (F, x, depth) => {
    add(F, new THREE.RingGeometry(R, R + 0.42, 12, 1, 0, PI), stoneL, x, SPR, 0.005);
    add(F, new THREE.RingGeometry(R, R + 0.42, 12, 1, 0, PI), stoneL, x, SPR, -depth - 0.005, 0, PI, 0);
    add(F, new THREE.CylinderGeometry(R, R, depth, 12, 1, true, -PI / 2, PI), stone, x, SPR, -depth / 2, -PI / 2, 0, 0);
    box(F, 2 * R + 0.02, GF - 0.3 - SPR - R, depth, gf, x, (SPR + R + GF - 0.3) / 2, -depth / 2);
    // corner fill between the ring and the pier tops
    for (const s of [-1, 1]) { box(F, 0.3, SPR + R - 0.7 - SPR + 0.3, depth + 0.02, gf, x + s * (R - 0.01), SPR + R - 0.15, -depth / 2); }
  };
  const pier = (F, x, depth) => { box(F, PW, GF - 0.3, depth, stone, x, (GF - 0.3) / 2, -depth / 2); box(F, PW + 0.08, 0.36, depth + 0.08, stoneD, x, 0.18, -depth / 2); box(F, PW + 0.1, 0.12, depth + 0.1, stoneL, x, SPR - 0.06, -depth / 2); };
  const face = (rotY, px, pz) => { const F = new THREE.Group(); F.position.set(px, 0, pz); F.rotation.y = rotY; g.add(F); return F; };
  const FF = face(0, 0, D / 2);
  for (const x of PX) pier(FF, x, PW);
  for (const x of XS) arcadeBay(FF, x, PW);
  box(FF, W + 0.12, 0.3, 0.72, gfEdge, 0, GF - 0.15, -0.3); box(FF, W + 0.2, 0.05, 0.8, stoneTop, 0, GF + 0.02, -0.3);
  // walkway floor, ceiling and back wall with two doors and two windows
  box(g, W, 0.12, WALK + PW, floorM, 0, 0.06, D / 2 - (WALK + PW) / 2); box(g, W + 0.04, 0.03, 0.06, floorE, 0, 0.13, D / 2 - 0.03);
  box(g, W, 0.3, WALK, gf, 0, GF - 0.3 - 0.15, D / 2 - PW - WALK / 2);
  box(g, W, GF, D - WALK - PW, gf, 0, GF / 2, -(WALK + PW) / 2);
  const BW = face(0, 0, D / 2 - PW - WALK);
  for (const x of [-2.16, 2.16]) { box(BW, 1.1, 2.3, 0.1, door, x, 1.15, 0.05); box(BW, 1.34, 0.16, 0.08, stone, x, 2.38, 0.04); for (const s of [-1, 1]) box(BW, 0.4, 1.8, 0.03, doorEdge, x + s * 0.27, 1.2, 0.11); }
  for (const x of [-4.32, 4.32]) { plate(BW, 1.0, 1.3, glass, x, 1.7, 0.02); box(BW, 1.2, 0.1, 0.06, frameM, x, 2.4, 0.03); box(BW, 1.2, 0.1, 0.06, frameM, x, 1.0, 0.03); for (const s of [-1, 1]) box(BW, 0.1, 1.4, 0.06, frameM, x + s * 0.55, 1.7, 0.03); }
  // side bays: one arch at the front bay of each side, stone wall behind
  for (const s of [1, -1]) {
    const F = face(s * PI / 2, s * W / 2, 0); const bx = -s * (D / 2 - PW - WALK / 2);
    pier(F, bx - WALK / 2 - PW / 2 + 0.02, PW); pier(F, bx + WALK / 2 + PW / 2 - 0.02, PW);
    arcadeBay(F, bx, PW);
    box(F, WALK + 2 * PW + 0.16, 0.3, 0.72, gfEdge, bx, GF - 0.15, -0.3);
    box(F, D - WALK - PW + 0.12, 0.3, 0.06, gfEdge, s * (WALK + PW) / 2, GF - 0.15, 0.03);
    box(F, D - WALK - PW, 0.36, 0.08, stoneD, s * (WALK + PW) / 2, 0.18, 0.04);
  }
  box(g, W + 0.1, 0.36, D - WALK - PW + 0.1, stoneD, 0, 0.18, -(WALK + PW) / 2);
  const BK = face(PI, 0, -D / 2);
  box(BK, W + 0.12, 0.3, 0.06, gfEdge, 0, GF - 0.15, 0.03);
  // upper floors
  box(g, W, EAVE - 0.4 - GF, D, wall, 0, (GF + EAVE - 0.4) / 2, 0);
  for (const s of [-1, 1]) box(g, 0.02, EAVE - 0.4 - GF, D + 0.02, wallB, s * W / 2, (GF + EAVE - 0.4) / 2, 0);
  box(g, W + 0.16, 0.14, D + 0.16, gfEdge, 0, 6.85, 0); box(g, W + 0.2, 0.04, D + 0.2, stoneTop, 0, 6.94, 0);
  box(g, W + 0.3, 0.26, D + 0.3, gfEdge, 0, EAVE - 0.27, 0); box(g, W + 0.44, 0.14, D + 0.44, gfEdge, 0, EAVE - 0.07, 0); box(g, W + 0.5, 0.04, D + 0.5, stoneTop, 0, EAVE + 0.02, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.08, EAVE - 0.9 - GF, 0.08, wallEdge, sx * W / 2, (GF + EAVE - 0.5) / 2, sz * D / 2);
  const win = (F, x, y0, w, h) => {
    plate(F, w, h, glass, x, y0 + h / 2, 0.02);
    box(F, w + 0.24, 0.12, 0.08, frameE, x, y0 + h - 0.06, 0.04); box(F, 0.12, h, 0.08, frameE, x - w / 2 - 0.06, y0 + h / 2, 0.04); box(F, 0.12, h, 0.08, frameE, x + w / 2 + 0.06, y0 + h / 2, 0.04);
    plate(F, 0.06, h, frameM, x, y0 + h / 2, 0.06); plate(F, w, 0.06, frameM, x, y0 + h * 0.6, 0.06);
    box(F, w + 0.5, 0.12, 0.24, frameE, x, y0 - 0.06, 0.08); box(F, w + 0.54, 0.03, 0.26, stoneTop, x, y0 + 0.01, 0.09);
    box(F, w + 0.5, 0.18, 0.12, frameE, x, y0 + h + 0.15, 0.04); box(F, w + 0.54, 0.03, 0.14, stoneTop, x, y0 + h + 0.25, 0.05);
    for (const s of [-1, 1]) { const sx = x + s * (w / 2 + 0.12 + w / 4 + 0.02); box(F, w / 2 + 0.04, h, 0.06, shut, sx, y0 + h / 2, 0.03); for (let k = 0; k < 3; k++) plate(F, w / 2 - 0.06, 0.05, shutEdge, sx, y0 + h * (0.2 + k * 0.3), 0.085); }
  };
  for (const x of XS) { win(FF, x, 3.9, 1.1, 2.1); win(FF, x, 7.5, 1.1, 1.7); }
  for (const x of XS) { win(BK, x, 4.3, 1.1, 1.7); win(BK, x, 7.5, 1.1, 1.7); }
  for (const x of [-2.6, 0, 2.6]) { plate(BK, 1.0, 1.4, glass, x, 1.9, 0.02); box(BK, 1.24, 0.1, 0.06, frameM, x, 2.65, 0.03); box(BK, 1.24, 0.1, 0.06, frameM, x, 1.15, 0.03); for (const s of [-1, 1]) box(BK, 0.1, 1.6, 0.06, frameM, x + s * 0.57, 1.9, 0.03); box(BK, 1.4, 0.1, 0.2, stone, x, 1.1, 0.08); }
  for (const s of [1, -1]) { const F = face(s * PI / 2, s * W / 2, 0); for (const x of [-2.9, 0, 2.9]) { win(F, x, 4.3, 1.1, 1.7); win(F, x, 7.5, 1.1, 1.7); } const bx = -s * (D / 2 - PW - WALK / 2); for (const x of [bx - s * 2.9, bx - s * 5.4]) { if (Math.abs(x) < D / 2 - 0.7) { plate(F, 1.0, 1.4, glass, x, 1.9, 0.02); box(F, 1.24, 0.1, 0.06, frameM, x, 2.65, 0.03); box(F, 1.24, 0.1, 0.06, frameM, x, 1.15, 0.03); for (const q of [-1, 1]) box(F, 0.1, 1.6, 0.06, frameM, x + q * 0.57, 1.9, 0.03); box(F, 1.4, 0.1, 0.2, stone, x, 1.1, 0.08); } } }
  // balcony across the first floor
  box(FF, W + 0.2, 0.18, 1.0, stone, 0, GF + 0.09, 0.5); box(FF, W + 0.24, 0.04, 1.02, stoneTop, 0, GF + 0.2, 0.51); box(FF, W + 0.24, 0.06, 0.06, stoneTop, 0, GF + 0.03, 1.02);
  for (const x of PX) box(FF, 0.4, 0.3, 0.9, stoneD, x, GF - 0.15, 0.45);
  const yR = GF + 0.22, n = Math.round((W + 0.2) / 0.25);
  for (let i = 0; i <= n; i++) box(FF, i % 5 ? 0.05 : 0.07, 1.0, 0.05, rail, -(W + 0.2) / 2 + i * (W + 0.2) / n, yR + 0.5, 0.96);
  for (let i = 0; i < n; i += 2) box(FF, 0.12, 0.04, 0.04, rail, -(W + 0.2) / 2 + (i + 1) * (W + 0.2) / n, yR + 0.62, 0.96);
  for (const s of [-1, 1]) for (let i = 1; i < 4; i++) box(FF, 0.05, 1.0, 0.05, rail, s * (W + 0.2) / 2, yR + 0.5, i * 0.25);
  box(FF, W + 0.26, 0.08, 0.08, rail, 0, yR + 1.0, 0.96); box(FF, W + 0.26, 0.05, 0.05, rail, 0, yR + 0.14, 0.96);
  for (const s of [-1, 1]) { box(FF, 0.08, 0.08, 1.0, rail, s * (W + 0.2) / 2, yR + 1.0, 0.5); box(FF, 0.05, 0.05, 1.0, rail, s * (W + 0.2) / 2, yR + 0.14, 0.5); }
  // hip roof with rib runs and three gabled dormers on the front slope
  const hw = W / 2 + OV, hd = D / 2 + OV, EY = EAVE - 0.02, R1 = V(-RH, TOP, 0), R2 = V(RH, TOP, 0);
  const P = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]], pos = [], faces = [];
  const tri = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < 4; i++) { const A = V(P[i][0], EY, P[i][1]), B = V(P[(i + 1) % 4][0], EY, P[(i + 1) % 4][1]); let TL, TR; if (Math.abs(A.z - B.z) < 1e-6) { TL = A.x < B.x ? R1 : R2; TR = A.x < B.x ? R2 : R1; tri(A, B, TR); tri(A, TR, TL); } else { TL = TR = A.x > 0 ? R2 : R1; tri(A, B, TL); } faces.push([A, B, TL, TR]); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); add(g, geo, roofTop);
  box(g, W + 2 * OV, 0.1, D + 2 * OV, roofUnder, 0, EY - 0.05, 0);
  let frontFrame = null;
  for (const [A, B, TL, TR] of faces) {
    const u = B.clone().sub(A).normalize(), Mb = A.clone().add(B).multiplyScalar(0.5), Mt = TL.clone().add(TR).multiplyScalar(0.5);
    const up0 = Mt.clone().sub(Mb), cu = up0.dot(u), upP = up0.clone().sub(u.clone().multiplyScalar(cu)), L = upP.length(), v = upP.clone().normalize(), nrm = new THREE.Vector3().crossVectors(u, v).normalize(); if (nrm.dot(Mb) < 0) { u.negate(); nrm.negate(); }
    const F = new THREE.Group(); F.position.copy(Mb); F.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, nrm)); g.add(F);
    const wB = A.distanceTo(B), wT = TL.distanceTo(TR);
    box(F, wB + 0.04, 0.1, 0.2, roofEdge, 0, 0.02, -0.02);
    for (let s = -wB / 2 + 0.2; s < wB / 2 - 0.1; s += 0.5) { let t = 1; for (let k = 1; k <= 20; k++) { const tt = k / 20, half = (wB + (wT - wB) * tt) / 2; if (Math.abs(s) > half) { t = (k - 1) / 20; break; } } const len = Math.max(0.3, t * L - 0.1); add(F, new THREE.CylinderGeometry(0.075, 0.075, len, 5, 1, true), roof, s, len / 2, 0.075); }
    if (Mb.z > 1) frontFrame = { F, L };
  }
  const cap = (a, b) => { const d = b.clone().sub(a); const o = add(g, new THREE.CylinderGeometry(0.1, 0.1, d.length(), 8), roofTop); o.position.copy(a.clone().add(d.clone().multiplyScalar(0.5))); o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); };
  cap(R1, R2); for (const p of P) cap(V(p[0], EY, p[1]), p[0] > 0 ? R2 : R1);
  for (const x of [-3.2, 0, 3.2]) {
    const Dm = new THREE.Group(); Dm.position.set(x, frontFrame.L * 0.42, 0); frontFrame.F.add(Dm);
    box(Dm, 1.1, 1.0, 0.9, wall, 0, 0.1, 0.55); box(Dm, 0.66, 0.66, 0.06, frameE, 0, 0.3, 1.0); plate(Dm, 0.5, 0.5, glass, 0, 0.3, 1.04);
    for (const s of [-1, 1]) box(Dm, 0.75, 0.08, 1.1, roofTop, s * 0.3, 0.75 - 0.15, 0.5, 0, 0, s * 0.6);
    box(Dm, 0.12, 0.12, 1.12, roofTop, 0, 0.98, 0.5);
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
