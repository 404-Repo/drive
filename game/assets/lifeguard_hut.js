// lifeguard_hut candidate 2: a second reading of the reference. The deck wraps the
// left side as well as the front (L shape) as in the picture, the roof is rows of
// half round tile courses on a slab, portholes are recessed rings, the walls carry
// clapboard lines, legs are chamfer edged boxes with a tie beam ring at 1 m.
export default function (THREE) {
  const g = new THREE.Group();
  const C = (hex, dl, ds) => new THREE.Color(hex).offsetHSL(0, ds || 0, dl || 0);
  const M = (name, hex, rough, dl, ds, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: C(hex, dl, ds), roughness: rough, metalness: 0 }, extra || {}));
    m.name = name; return m;
  };
  const mesh = (geo, mat, x, y, z, parent) => { const o = new THREE.Mesh(geo, mat); o.position.set(x || 0, y || 0, z || 0); (parent || g).add(o); return o; };
  const box = (w, h, d, mat, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);
  const UP = new THREE.Vector3(0, 1, 0);
  const strut = (a, b, t, mat, ext) => {
    const A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(b[0], b[1], b[2]);
    const dir = B.clone().sub(A); const len = dir.length() + 2 * (ext || 0); dir.normalize();
    const o = new THREE.Mesh(new THREE.BoxGeometry(t, len, t), mat);
    o.position.copy(A).add(B).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(UP, dir);
    g.add(o); return o;
  };

  const teal = M('timber', 0x3f8f8a, 0.72);
  const tealHi = M('timber', 0x3f8f8a, 0.68, 0.08);
  const tealFoot = M('timber', 0x3f8f8a, 0.78, -0.10, -0.06);
  const plank = M('timber', 0xcdb897, 0.75);
  const plankHi = M('timber', 0xcdb897, 0.72, 0.05, -0.03);
  const wall = M('plaster', 0xf1e6d2, 0.85);
  const wallLine = M('plaster', 0xf1e6d2, 0.85, -0.05, -0.02);
  const wallShade = M('plaster', 0xf1e6d2, 0.85, -0.07, -0.03);
  const door = M('timber', 0xd6402f, 0.7);
  const doorHi = M('timber', 0xd6402f, 0.7, 0.06);
  const shutter = M('timber', 0x3f8f8a, 0.72, -0.03);
  const tile = M('tile', 0xc4683f, 0.8, 0, 0, { side: THREE.DoubleSide });
  const tileDark = M('tile', 0xc4683f, 0.82, -0.08, -0.04);
  const tileHi = M('tile', 0xc4683f, 0.78, 0.07, -0.04);
  const metal = M('metal', 0x3a3f46, 0.45, 0, 0, { metalness: 0.2 });
  const coral = M('metal', 0xed5851, 0.45, 0, 0, { metalness: 0.15 });
  const buoyRed = M('fabric', 0xd6402f, 0.8);
  const buoyWhite = M('fabric', 0xf1e6d2, 0.8);
  const rope = M('fabric', 0xe6cf9c, 0.9, -0.05);
  const glass = new THREE.MeshStandardMaterial({ color: 0x8fa9d6, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.85 });
  const sand = M('ground', 0xe6cf9c, 0.9);
  const sandHi = M('ground', 0xe6cf9c, 0.9, 0.04, -0.03);

  const DECK = 1.87;
  // cabin sits right of centre so the L deck fits in 3 m: cabin x from -0.9 to 1.5? No: keep it inside the roof.
  const CX = 0.2, CZ = -0.35, CW = 2.3, CD = 1.9, CB = DECK, CT = DECK + 2.1;
  // legs: chamfer edged boxes (lighter strips on two vertical edges), darker foot, tie ring at 1 m
  const legs = [[CX - 1.05, CZ - 0.85], [CX + 1.05, CZ - 0.85], [CX - 1.05, CZ + 0.85], [CX + 1.05, CZ + 0.85], [-1.42, 1.27], [1.42, 1.27], [-1.42, CZ - 0.85]];
  for (const [x, z] of legs) {
    box(0.16, 0.25, 0.16, tealFoot, x, 0.125, z);
    box(0.16, DECK - 0.35, 0.16, teal, x, 0.25 + (DECK - 0.35) / 2, z);
    box(0.02, DECK - 0.35, 0.02, tealHi, x + 0.08, 0.25 + (DECK - 0.35) / 2, z + 0.08);
    box(0.02, DECK - 0.35, 0.02, tealHi, x - 0.08, 0.25 + (DECK - 0.35) / 2, z - 0.08);
  }
  const tie = (a, b) => strut([a[0], 1.0, a[1]], [b[0], 1.0, b[1]], 0.1, teal, 0.05);
  const braceX = (a, b) => { strut([a[0], 0.35, a[1]], [b[0], 1.6, b[1]], 0.09, teal); strut([a[0], 1.6, a[1]], [b[0], 0.35, b[1]], 0.09, teal); };
  braceX(legs[0], legs[1]); braceX(legs[2], legs[3]); braceX(legs[1], legs[3]);
  braceX(legs[0], legs[6]); tie(legs[6], legs[2]); tie(legs[2], legs[4]); tie(legs[3], legs[5]); tie(legs[4], legs[5]); tie(legs[6], legs[4]);

  // L deck: front porch full width plus a left side strip
  const planks = (x0, x1, z0, z1, alongX) => {
    if (alongX) { const n = Math.round((x1 - x0) / 0.158); for (let i = 0; i < n; i++) box(0.148, 0.05, z1 - z0, plank, x0 + 0.079 + i * 0.158, DECK - 0.025, (z0 + z1) / 2); }
    else { const n = Math.round((z1 - z0) / 0.158); for (let i = 0; i < n; i++) box(x1 - x0, 0.05, 0.148, plank, (x0 + x1) / 2, DECK - 0.025, z0 + 0.079 + i * 0.158); }
  };
  planks(-1.5, 1.5, 0.62, 1.36, true);
  planks(-1.5, -0.9, CZ - 0.95, 0.62, false);
  box(CW + 0.1, 0.08, CD + 0.1, plank, CX, DECK - 0.06, CZ);
  box(3.0, 0.14, 0.14, teal, 0, DECK - 0.17, 1.33); box(0.14, 0.14, 2.7, teal, -1.44, DECK - 0.17, 0.03);
  box(2.4, 0.14, 0.14, teal, 0.3, DECK - 0.17, CZ - 0.97); box(0.14, 0.14, 2.6, teal, 1.44, DECK - 0.17, 0.05);
  box(3.0, 0.05, 0.05, plankHi, 0, DECK - 0.02, 1.38); box(0.05, 0.05, 2.7, plankHi, -1.49, DECK - 0.02, 0.03);

  // cabin with clapboard lines
  box(CW, 2.1, CD, wall, CX, (CB + CT) / 2, CZ);
  box(CW + 0.04, 0.14, CD + 0.04, wallShade, CX, CB + 0.07, CZ);
  for (let i = 1; i < 6; i++) {
    const y = CB + i * 0.35;
    box(CW + 0.02, 0.03, 0.02, wallLine, CX, y, CZ + CD / 2 + 0.005); box(CW + 0.02, 0.03, 0.02, wallLine, CX, y, CZ - CD / 2 - 0.005);
    box(0.02, 0.03, CD + 0.02, wallLine, CX + CW / 2 + 0.005, y, CZ); box(0.02, 0.03, CD + 0.02, wallLine, CX - CW / 2 - 0.005, y, CZ);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.1, 2.1, 0.1, teal, CX + sx * CW / 2, (CB + CT) / 2, CZ + sz * CD / 2);
  for (const sz of [-1, 1]) box(CW + 0.1, 0.1, 0.1, teal, CX, CT - 0.05, CZ + sz * (CD / 2 + 0.01));
  for (const sx of [-1, 1]) box(0.1, 0.1, CD + 0.06, teal, CX + sx * (CW / 2 + 0.01), CT - 0.05, CZ);
  // door with a small canopy slab, left of centre on the front face
  const FZ = CZ + CD / 2;
  box(0.9, 1.72, 0.1, teal, CX - 0.55, CB + 0.86, FZ + 0.02);
  box(0.74, 1.6, 0.08, door, CX - 0.55, CB + 0.8, FZ + 0.06);
  for (let i = 0; i < 3; i++) box(0.62, 0.04, 0.02, doorHi, CX - 0.55, CB + 0.4 + i * 0.55, FZ + 0.105);
  mesh(new THREE.SphereGeometry(0.045, 10, 8), metal, CX - 0.28, CB + 0.9, FZ + 0.12);
  box(1.0, 0.06, 0.3, tealHi, CX - 0.55, CB + 1.8, FZ + 0.16);
  // recessed portholes on left, right and back; lifebuoy with a rope loop on the front
  const porthole = (x, y, z, axis) => {
    const ring = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 20), teal, x, y, z);
    const inner = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.13, 20), wallShade, x, y, z);
    const gl = mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.03, 20), glass, x, y, z);
    if (axis === 'x') { ring.rotation.z = Math.PI / 2; inner.rotation.z = Math.PI / 2; gl.rotation.z = Math.PI / 2; }
    else { ring.rotation.x = Math.PI / 2; inner.rotation.x = Math.PI / 2; gl.rotation.x = Math.PI / 2; }
  };
  porthole(CX - CW / 2, CB + 1.35, CZ, 'x'); porthole(CX + CW / 2, CB + 1.35, CZ, 'x'); porthole(CX + 0.5, CB + 1.4, CZ - CD / 2, 'z');
  mesh(new THREE.TorusGeometry(0.27, 0.07, 10, 20), buoyRed, CX + 0.55, CB + 1.15, FZ + 0.09);
  for (let k = 0; k < 4; k++) mesh(new THREE.TorusGeometry(0.27, 0.074, 10, 6, Math.PI / 4), buoyWhite, CX + 0.55, CB + 1.15, FZ + 0.09).rotation.z = k * Math.PI / 2 + Math.PI / 8;
  mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 10), rope, CX + 0.55, CB + 1.48, FZ + 0.06);
  // back: a pair of shutters and a downpipe
  box(0.32, 0.9, 0.06, shutter, CX - 0.75, CB + 1.35, CZ - CD / 2 - 0.03); box(0.32, 0.9, 0.06, shutter, CX - 0.4, CB + 1.35, CZ - CD / 2 - 0.03);
  for (let i = 0; i < 5; i++) { box(0.26, 0.04, 0.02, tealHi, CX - 0.75, CB + 1.0 + i * 0.17, CZ - CD / 2 - 0.07); box(0.26, 0.04, 0.02, tealHi, CX - 0.4, CB + 1.0 + i * 0.17, CZ - CD / 2 - 0.07); }
  mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 10), metal, CX + CW / 2 - 0.1, (CB + CT) / 2, CZ - CD / 2 - 0.08);

  // roof: slab per slope with half round tile courses laid along x
  const ridgeY = CT + 0.45, run = 1.15, rise = 0.45;
  const slope = Math.atan2(rise, run), slen = Math.hypot(run, rise);
  for (const s of [1, -1]) {
    const grp = new THREE.Group();
    grp.position.set(CX, ridgeY - rise / 2, CZ + s * run / 2);
    grp.rotation.x = s * slope;
    g.add(grp);
    box(2.9, 0.1, slen, tileDark, 0, 0, 0, grp);
    const rows = 6;
    for (let i = 0; i < rows; i++) {
      const cyl = new THREE.CylinderGeometry(0.07, 0.07, 2.92, 8, 1, false, 0, Math.PI);
      const o = mesh(cyl, i === 0 ? tileHi : tile, 0, 0.05, -slen / 2 + 0.1 + i * (slen - 0.2) / (rows - 1), grp);
      o.rotation.z = Math.PI / 2;
    }
    box(2.94, 0.06, 0.1, tealHi, 0, -0.03, s * slen / 2, grp);
  }
  box(3.0, 0.12, 0.26, tileHi, CX, ridgeY + 0.04, CZ);
  const tri = new THREE.Shape(); tri.moveTo(-0.95, 0); tri.lineTo(0.95, 0); tri.lineTo(0, rise - 0.03); tri.closePath();
  const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: CW, bevelEnabled: false }), wall);
  gable.rotation.y = Math.PI / 2; gable.position.set(CX - CW / 2, CT, CZ); g.add(gable);
  mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 10), coral, CX - 0.8, CT + 0.28, CZ - 0.5);
  mesh(new THREE.SphereGeometry(0.06, 10, 8), coral, CX - 0.8, CT + 0.6, CZ - 0.5);

  // rail around the L deck, gap at the front left for the ladder
  const RT = DECK + 1.0, RM = DECK + 0.55;
  const post = (x, z) => { box(0.09, 1.0, 0.09, teal, x, DECK + 0.5, z); box(0.12, 0.04, 0.12, tealHi, x, DECK + 1.02, z); };
  const rail = (a, b) => { strut([a[0], RT, a[1]], [b[0], RT, b[1]], 0.08, teal); strut([a[0], RM, a[1]], [b[0], RM, b[1]], 0.06, teal); };
  const P = [[-1.45, 1.31], [-1.15, 1.31], [-0.55, 1.31], [0.5, 1.31], [1.45, 1.31], [1.45, 0.68], [-1.45, 0.3], [-1.45, CZ - 0.9], [-1.0, CZ - 0.9]];
  for (const [x, z] of P) post(x, z);
  rail(P[2], P[3]); rail(P[3], P[4]); rail(P[4], P[5]); rail(P[0], P[1]); rail(P[0], P[6]); rail(P[6], P[7]); rail(P[7], P[8]);
  // ladder off the front left of the porch
  const lx = -0.85;
  for (const s of [-1, 1]) strut([lx + s * 0.25, 0.04, 1.68], [lx + s * 0.25, DECK + 0.05, 1.4], 0.08, teal);
  for (let i = 1; i <= 5; i++) { const t = i / 6; mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.5, 10), tealHi, lx, 0.04 + DECK * t, 1.68 - 0.28 * t).rotation.z = Math.PI / 2; }
  // sand fillet
  mesh(new THREE.CylinderGeometry(1.5, 1.55, 0.06, 20), sand, 0, 0.03, 0.15).scale.z = 0.98;
  mesh(new THREE.CylinderGeometry(1.45, 1.5, 0.02, 20), sandHi, 0, 0.07, 0.15).scale.z = 0.98;

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
