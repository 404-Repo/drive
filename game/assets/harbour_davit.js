// harbour_davit c0: primitive assembly. 1.2 x 3.6 x 3.4 m, the jib reaches toward +Z. A kerb
// red counterweight block, a dark metal pedestal with a flange plate and four bolt heads, a
// round dark mast with a whitewash band, a curved jib of box section built from eight short
// segments along an arc, a pulley wheel at the tip, a cable down to a hook and a hanging slatted
// fish crate, a hand winch drum with a crank on the mast side.
export default function (THREE) {
  const g = new THREE.Group();
  const col = (hex, l = 0, s = 0) => new THREE.Color(hex).offsetHSL(0, s, l);
  const mat = (hex, name, rough, l = 0, s = 0, metal = 0) => {
    const m = new THREE.MeshStandardMaterial({ color: col(hex, l, s), roughness: rough, metalness: metal });
    if (name) m.name = name; return m;
  };
  const iron = mat(0x3a3f46, 'metal', 0.45, 0, 0, 0.25);
  const ironEdge = mat(0x3a3f46, 'metal', 0.42, 0.1, 0, 0.25);
  const ironTop = mat(0x3a3f46, 'metal', 0.42, 0.08, 0, 0.25);
  const ironBase = mat(0x3a3f46, 'metal', 0.5, -0.05, 0, 0.25);
  const jib = mat(0x3f8f8a, 'metal', 0.45, 0, 0, 0.2);
  const jibEdge = mat(0x3f8f8a, 'metal', 0.42, 0.1, -0.02, 0.2);
  const red = mat(0xd6402f, 'metal', 0.5, 0, 0, 0.15);
  const redTop = mat(0xd6402f, 'metal', 0.48, 0.08, -0.05, 0.15);
  const redBase = mat(0xd6402f, 'metal', 0.55, -0.12, -0.05, 0.15);
  const white = mat(0xf1e6d2, 'metal', 0.45, 0, 0, 0.1);
  const timber = mat(0xb8925f, 'timber', 0.78);
  const timberTop = mat(0xb8925f, 'timber', 0.72, 0.08, -0.05);
  const rope = mat(0x6b5a45, 'fabric', 0.9);
  const add = (parent, geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); parent.add(o); return o;
  };
  const bx = (parent, w, h, d, m, x, y, z, rx, ry, rz) => add(parent, new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz);

  const MZ = -0.45;   // mast axis
  // Counterweight block 1.2 x 0.35 x 1.2, darker base band, bleached top, lighter edges.
  bx(g, 1.2, 0.35, 1.2, red, 0, 0.175, MZ);
  bx(g, 1.22, 0.1, 1.22, redBase, 0, 0.05, MZ);
  bx(g, 1.18, 0.02, 1.18, redTop, 0, 0.36, MZ);
  for (const s of [-1, 1]) { bx(g, 1.2, 0.04, 0.04, redTop, 0, 0.33, MZ + s * 0.58); bx(g, 0.04, 0.04, 1.2, redTop, s * 0.58, 0.33, MZ); }
  // Pedestal 0.6 square, 0.6 tall, flange plate with four bolts, a collar for the mast.
  bx(g, 0.6, 0.6, 0.6, iron, 0, 0.35 + 0.3, MZ);
  bx(g, 0.62, 0.12, 0.62, ironBase, 0, 0.35 + 0.06, MZ);
  bx(g, 0.7, 0.06, 0.7, ironTop, 0, 0.95 + 0.03, MZ);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, new THREE.CylinderGeometry(0.04, 0.04, 0.05, 6), ironEdge, sx * 0.27, 1.01, MZ + sz * 0.27);
  add(g, new THREE.CylinderGeometry(0.16, 0.19, 0.16, 14), iron, 0, 1.06, MZ);
  // Mast 0.2 across to y 3.05, a whitewash band, a rounded cap.
  add(g, new THREE.CylinderGeometry(0.1, 0.11, 2.0, 14), iron, 0, 2.05, MZ);
  add(g, new THREE.CylinderGeometry(0.106, 0.106, 0.3, 14), white, 0, 2.55, MZ);
  add(g, new THREE.SphereGeometry(0.1, 12, 8), ironTop, 0, 3.05, MZ);
  // Jib: eight box segments along a quadratic arc from the mast (z MZ + 0.1, y 2.05) to the
  // tip (z 2.3, y 3.35), convex upward; a lighter top strip on every segment.
  const P0 = [MZ + 0.05, 2.0], P1 = [MZ + 1.1, 3.55], P2 = [2.3, 3.32];
  const bez = (t) => [(1 - t) * (1 - t) * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0], (1 - t) * (1 - t) * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1]];
  const NSEG = 8;
  for (let i = 0; i < NSEG; i++) {
    const a = bez(i / NSEG), b = bez((i + 1) / NSEG);
    const dz = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dz, dy) + 0.03;
    const ang = Math.atan2(dy, dz);   // rotation about X that tilts +Z upward is negative
    const seg = new THREE.Group(); seg.position.set(0, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2); seg.rotation.x = -ang; g.add(seg);
    bx(seg, 0.15, 0.15, len, jib, 0, 0, 0);
    bx(seg, 0.16, 0.02, len, jibEdge, 0, 0.08, 0);
  }
  // Tie brace from the mast top to the jib third point, and a gusset at the root.
  {
    const q = bez(0.35), a = [MZ, 3.0];
    const dz = q[0] - a[0], dy = q[1] - a[1], len = Math.hypot(dz, dy);
    bx(g, 0.06, 0.06, len, iron, 0, (a[1] + q[1]) / 2, (a[0] + q[0]) / 2, -Math.atan2(dy, dz), 0, 0);
    bx(g, 0.18, 0.3, 0.22, jib, 0, 2.05, MZ + 0.14);
  }
  // Pulley at the tip: a wheel with a rim and an axle bracket.
  const tip = bez(1);
  add(g, new THREE.CylinderGeometry(0.175, 0.175, 0.06, 16), ironEdge, 0, tip[1] - 0.05, tip[0] + 0.05, 0, 0, Math.PI / 2);
  add(g, new THREE.TorusGeometry(0.175, 0.02, 6, 16), iron, 0, tip[1] - 0.05, tip[0] + 0.05, 0, Math.PI / 2, 0);
  for (const s of [-1, 1]) bx(g, 0.03, 0.2, 0.3, jib, s * 0.06, tip[1] - 0.02, tip[0] + 0.02);
  // Cable down to the hook, the hook, and the hanging crate.
  const cz = tip[0] + 0.05 + 0.17, cy0 = tip[1] - 0.05, hookY = 1.95;
  add(g, new THREE.CylinderGeometry(0.02, 0.02, cy0 - hookY, 6), iron, 0, (cy0 + hookY) / 2, cz);
  add(g, new THREE.TorusGeometry(0.06, 0.02, 6, 12, Math.PI * 1.5), ironEdge, 0, hookY - 0.06, cz, 0, Math.PI / 2, Math.PI * 0.75);
  add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8), iron, 0, hookY, cz);
  // Rope slings from the hook to the crate corners.
  const CY = 1.1, CS = 0.5;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const dx = sx * 0.22, dzz = sz * 0.22, len = Math.hypot(dx, hookY - 0.1 - (CY + 0.35), dzz);
    const r = new THREE.Group(); r.position.set(dx / 2, (hookY - 0.1 + CY + 0.35) / 2, cz + dzz / 2); g.add(r);
    r.lookAt(new THREE.Vector3(dx, hookY - 0.1, cz + dzz).add(r.position).sub(new THREE.Vector3(dx / 2, (hookY - 0.1 + CY + 0.35) / 2, cz + dzz / 2)));
    add(r, new THREE.CylinderGeometry(0.012, 0.012, len, 5), rope, 0, 0, 0, Math.PI / 2, 0, 0);
  }
  // Slatted fish crate 0.5 across, open top, bleached rim.
  const crate = new THREE.Group(); crate.position.set(0, CY, cz); crate.rotation.y = 0.15; g.add(crate);
  bx(crate, CS - 0.06, 0.03, CS - 0.06, timber, 0, 0.015, 0);
  for (const s of [-1, 1]) {
    for (const y of [0.07, 0.17, 0.27]) { bx(crate, CS, 0.07, 0.03, timber, 0, y, s * (CS / 2 - 0.015)); bx(crate, 0.03, 0.07, CS, timber, s * (CS / 2 - 0.015), y, 0); }
    for (const t of [-1, 1]) bx(crate, 0.04, 0.35, 0.04, timber, s * (CS / 2 - 0.02), 0.175, t * (CS / 2 - 0.02));
  }
  bx(crate, CS + 0.02, 0.02, CS + 0.02, timberTop, 0, 0.34, 0);
  bx(crate, CS - 0.14, 0.02, CS - 0.14, ironBase, 0, 0.33, 0);   // dark inside seen from above
  // Winch: drum on the mast side with a crank handle, a small rope wrap.
  const WY = 1.55;
  bx(g, 0.1, 0.2, 0.16, iron, -0.13, WY, MZ);
  add(g, new THREE.CylinderGeometry(0.11, 0.11, 0.16, 12), iron, -0.28, WY, MZ, 0, 0, Math.PI / 2);
  add(g, new THREE.CylinderGeometry(0.125, 0.125, 0.02, 12), ironEdge, -0.37, WY, MZ, 0, 0, Math.PI / 2);
  add(g, new THREE.TorusGeometry(0.105, 0.02, 5, 12), rope, -0.28, WY, MZ, 0, Math.PI / 2, 0);
  bx(g, 0.04, 0.24, 0.04, iron, -0.42, WY + 0.1, MZ);
  add(g, new THREE.CylinderGeometry(0.022, 0.022, 0.18, 8), timber, -0.52, WY + 0.22, MZ, 0, 0, Math.PI / 2);
  // Cable from the winch up the mast to the mast head sheave.
  add(g, new THREE.CylinderGeometry(0.012, 0.012, 3.0 - WY, 5), iron, -0.15, (3.0 + WY) / 2, MZ + 0.09);

  const box = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put = (mat) => { for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put(m.multiplyMatrices(n.matrixWorld, im)); } return; }
    put(n.matrixWorld);
  });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });
  return g;
}
