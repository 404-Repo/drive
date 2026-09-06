// start_gantry c2: the reference reading. Same lattice towers as square bars, but the beam is read as the concept
// shows it: a painted timber teal frame boxing the front board with the board flush in it, solid teal end boxes over
// each tower carrying a diagonal X, a terracotta ledge under the platform, the board's chequer as two offset rows,
// lamps in square dark housings with round warm lenses. Tower feet on coral plates. 18 x 2.4 x 7.5 (rails to 8.15).
export default function (THREE) {
  const g = new THREE.Group();
  const PI = Math.PI;
  const mat = (name, hex, rough, metal, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: metal || 0 }, extra || {}));
    if (name) m.name = name; return m;
  };
  const mesh = (parent, geo, m, x, y, z, rx, ry, rz) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.rotation.set(rx || 0, ry || 0, rz || 0); parent.add(o); return o;
  };
  const dark = mat('metal', 0x3a3f46, 0.45, 0.25);
  const darkHi = mat('metal', 0x4a5059, 0.45, 0.25);
  const darkBase = mat('metal', 0x2d3238, 0.5, 0.25);
  const coral = mat('metal', 0xed5851, 0.4, 0.15);
  const white = mat('plaster', 0xf1e6d2, 0.7);
  const red = mat('plaster', 0xd6402f, 0.7);
  const teal = mat('timber', 0x3f8f8a, 0.7);
  const tealHi = mat('timber', 0x4da39d, 0.7);
  const tealTop = mat('timber', 0x58aea8, 0.7);
  const terracotta = mat('timber', 0xc4683f, 0.7);
  const lens = new THREE.MeshStandardMaterial({ color: 0xffc48a, emissive: 0xffc48a, emissiveIntensity: 1.0, roughness: 0.4 });

  const bar = (a, b, w, m) => {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const geo = new THREE.CylinderGeometry(w * 0.7071, w * 0.7071, len, 4, 1, true);
    const o = new THREE.Mesh(geo, m);
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    o.rotateY(PI / 4);
    g.add(o); return o;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const TOWER_X = [-8.4, 8.4], HALF = 0.54, POST = 0.12, TOP = 6.3, BAYS = 6, BAY = TOP / BAYS;
  for (const tx of TOWER_X) {
    mesh(g, new THREE.BoxGeometry(1.5, 0.06, 1.5), coral, tx, 0.03, 0);
    mesh(g, new THREE.BoxGeometry(1.4, 0.03, 1.4), darkBase, tx, 0.075, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = tx + sx * HALF, z = sz * HALF;
      mesh(g, new THREE.BoxGeometry(POST + 0.02, 0.6, POST + 0.02), darkBase, x, 0.3, z);
      mesh(g, new THREE.BoxGeometry(POST, TOP - 0.6, POST), dark, x, 0.6 + (TOP - 0.6) / 2, z);
    }
    for (let k = 1; k <= BAYS; k++) {
      const y = k * BAY, y0 = y - BAY;
      const c = [[-HALF, -HALF], [HALF, -HALF], [HALF, HALF], [-HALF, HALF]];
      for (let f = 0; f < 4; f++) {
        const a = c[f], b = c[(f + 1) % 4];
        bar(V(tx + a[0], y, a[1]), V(tx + b[0], y, b[1]), 0.08, dark);
        bar(V(tx + a[0], y0, a[1]), V(tx + b[0], y, b[1]), 0.07, darkHi);
        bar(V(tx + a[0], y, a[1]), V(tx + b[0], y0, b[1]), 0.07, darkHi);
      }
    }
  }

  // beam: dark chords and a plain underside grid, the front boxed by a teal timber frame
  const BY0 = 6.3, BY1 = 7.5, BZ = 1.2, CH = 0.14, L = 18.0;
  for (const y of [BY0 + CH / 2, BY1 - CH / 2]) for (const z of [-BZ + CH / 2, BZ - CH / 2]) mesh(g, new THREE.BoxGeometry(L, CH, CH), dark, 0, y, z);
  const NB = 9, BW = L / NB;
  for (let i = 0; i <= NB; i++) {
    const x = -L / 2 + i * BW;
    bar(V(x, BY0, -BZ + CH / 2), V(x, BY1, -BZ + CH / 2), 0.09, dark);
    bar(V(x, BY0 + CH / 2, -BZ), V(x, BY0 + CH / 2, BZ), 0.09, dark);
    bar(V(x, BY1 - CH / 2, -BZ), V(x, BY1 - CH / 2, BZ), 0.09, dark);
    if (i < NB) {
      const x1 = x + BW;
      bar(V(x, BY0, -BZ + CH / 2), V(x1, BY1, -BZ + CH / 2), 0.07, darkHi);
      bar(V(x, BY1, -BZ + CH / 2), V(x1, BY0, -BZ + CH / 2), 0.07, darkHi);
    }
  }
  // teal end boxes over each tower (1.5 long) with an X on their front, and the teal frame around the board
  for (const sx of [-1, 1]) {
    const ex = sx * (L / 2 - 0.75);
    mesh(g, new THREE.BoxGeometry(1.5, BY1 - BY0, 2 * BZ), teal, ex, (BY0 + BY1) / 2, 0);
    mesh(g, new THREE.BoxGeometry(1.5, 0.02, 2 * BZ - 0.1), tealTop, ex, BY1 + 0.01, 0);
    bar(V(ex - 0.6, BY0 + 0.15, BZ + 0.03), V(ex + 0.6, BY1 - 0.15, BZ + 0.03), 0.07, tealHi);
    bar(V(ex - 0.6, BY1 - 0.15, BZ + 0.03), V(ex + 0.6, BY0 + 0.15, BZ + 0.03), 0.07, tealHi);
    bar(V(ex - 0.6, BY0 + 0.15, -BZ - 0.03), V(ex + 0.6, BY1 - 0.15, -BZ - 0.03), 0.07, tealHi);
    bar(V(ex - 0.6, BY1 - 0.15, -BZ - 0.03), V(ex + 0.6, BY0 + 0.15, -BZ - 0.03), 0.07, tealHi);
  }
  const FL = L - 3.0, FY = (BY0 + BY1) / 2, FZ = BZ + 0.02;
  mesh(g, new THREE.BoxGeometry(FL, 0.10, 0.10), tealHi, 0, BY1 - 0.05, FZ);
  mesh(g, new THREE.BoxGeometry(FL, 0.10, 0.10), teal, 0, BY0 + 0.05, FZ);
  mesh(g, new THREE.BoxGeometry(FL - 0.1, BY1 - BY0 - 0.2, 0.05), white, 0, FY, FZ);
  const SQ = 0.25, NSQ = Math.floor((FL - 0.2) / SQ);
  const sqGeo = new THREE.PlaneGeometry(SQ, SQ);
  for (let r = 0; r < 2; r++) for (let i = 0; i < NSQ; i++) {
    if ((i + r) % 2) continue;
    mesh(g, sqGeo, red, -(FL - 0.2) / 2 + SQ * (i + 0.5), BY0 + 0.12 + SQ * (r + 0.5), FZ + 0.027);
  }

  // square lamp housings under the beam with round lenses
  for (let i = 0; i < 5; i++) {
    const x = -3.2 + i * 1.6;
    mesh(g, new THREE.BoxGeometry(0.08, 0.2, 0.08), dark, x, BY0 - 0.1, 0.6);
    mesh(g, new THREE.BoxGeometry(0.44, 0.44, 0.3), dark, x, BY0 - 0.42, 0.6);
    mesh(g, new THREE.BoxGeometry(0.46, 0.46, 0.04), darkHi, x, BY0 - 0.42, 0.75);
    mesh(g, new THREE.CircleGeometry(0.16, 10), lens, x, BY0 - 0.42, 0.775);
  }

  // platform on the minus X tower with a terracotta ledge and a dark rail
  const px = TOWER_X[0];
  mesh(g, new THREE.BoxGeometry(1.7, 0.10, 1.7), terracotta, px, BY1 + 0.05, 0);
  mesh(g, new THREE.BoxGeometry(1.5, 0.02, 1.5), tealTop, px, BY1 + 0.11, 0);
  const RH = 0.6, ry = BY1 + 0.1;
  const corners = [[-0.75, -0.75], [0.75, -0.75], [0.75, 0.75], [-0.75, 0.75]];
  for (const cpt of corners) mesh(g, new THREE.BoxGeometry(0.06, RH, 0.06), dark, px + cpt[0], ry + RH / 2, cpt[1]);
  for (let f = 0; f < 4; f++) {
    if (f === 1) continue;
    const a = corners[f], b = corners[(f + 1) % 4];
    bar(V(px + a[0], ry + RH, a[1]), V(px + b[0], ry + RH, b[1]), 0.06, dark);
    bar(V(px + a[0], ry + RH * 0.5, a[1]), V(px + b[0], ry + RH * 0.5, b[1]), 0.05, dark);
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
