// driver_racer c0 (pass 2, knees, boots and glove reach pulled back 3 cm for depth): primitive assembly. Sphere helmet with partial sphere visor band and
// stripe, box chest with piping, capsule limbs, sphere gloves. Joints: torso at the hips,
// head at the helmet base, upperArmL/R at the shoulders, forearmL/R at the elbows.
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
  const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  // a capsule limb from a to b in the parent's frame, caps overlapping both joints
  const limb = (parent, a, b, r, m, seg) => {
    const A = V(a), B = V(b); const d = B.clone().sub(A); const L = d.length();
    const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, L, 4, seg || 12), m);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    o.position.copy(A).add(B).multiplyScalar(0.5); parent.add(o); return o;
  };
  const joint = (parent, name, x, y, z) => { const j = new THREE.Group(); j.name = 'joint_' + name; j.position.set(x, y, z); parent.add(j); return j; };
  const DS = { side: THREE.DoubleSide };
  const suit = mat('fabric', 0xf1e6d2, 0.8, 0);
  const suitD = mat('fabric', 0xd2c7b2, 0.82, 0);
  const accent = mat('fabric', 0xed5851, 0.8, 0);
  const glove = mat('fabric', 0xe6cf9c, 0.85, 0);
  const helmet = mat('metal', 0xed5851, 0.35, 0.15);
  const helmetStripe = mat('metal', 0xf1e6d2, 0.35, 0.15, DS);
  const trim = mat('metal', 0x3a3f46, 0.45, 0.25);
  const boot = mat(null, 0x232528, 0.85, 0);
  const visorBack = mat(null, 0x232528, 0.6, 0, DS);
  const visor = mat(null, 0x8fa9d6, 0.15, 0, { transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  // pelvis, lap and legs stay with the kart; the torso joint leans above them
  mesh(g, new THREE.BoxGeometry(0.36, 0.16, 0.30), suitD, 0, 0.09, 0.03);
  mesh(g, new THREE.BoxGeometry(0.30, 0.012, 0.24), suit, 0, 0.172, 0.03);
  mesh(g, new THREE.BoxGeometry(0.34, 0.05, 0.31), trim, 0, 0.155, 0.03);
  for (const sx of [-1, 1]) {
    limb(g, [sx * 0.10, 0.12, 0.05], [sx * 0.11, 0.24, 0.25], 0.07, suit);
    limb(g, [sx * 0.11, 0.24, 0.25], [sx * 0.11, 0.08, 0.32], 0.06, accent);
    mesh(g, new THREE.SphereGeometry(0.075, 12, 8), suit, sx * 0.11, 0.24, 0.25);
    mesh(g, new THREE.BoxGeometry(0.11, 0.09, 0.16), boot, sx * 0.11, 0.055, 0.335);
    mesh(g, new THREE.BoxGeometry(0.114, 0.05, 0.05), accent, sx * 0.11, 0.06, 0.395);
  }
  const torso = joint(g, 'torso', 0, 0.14, -0.02);
  mesh(torso, new THREE.BoxGeometry(0.40, 0.34, 0.24), suit, 0, 0.22, 0.04);
  mesh(torso, new THREE.BoxGeometry(0.42, 0.012, 0.26), suitD, 0, 0.226, 0.04);
  mesh(torso, new THREE.BoxGeometry(0.26, 0.22, 0.03), accent, 0, 0.21, 0.165);
  mesh(torso, new THREE.BoxGeometry(0.42, 0.10, 0.04), accent, 0, 0.14, -0.08);
  for (const sx of [-1, 1]) {
    mesh(torso, new THREE.BoxGeometry(0.04, 0.34, 0.04), accent, sx * 0.20, 0.22, 0.14);
    mesh(torso, new THREE.BoxGeometry(0.04, 0.34, 0.04), accent, sx * 0.20, 0.22, -0.06);
    mesh(torso, new THREE.SphereGeometry(0.075, 12, 8), accent, sx * 0.21, 0.36, 0.04);
  }
  const collar = mesh(torso, new THREE.TorusGeometry(0.10, 0.035, 8, 16), accent, 0, 0.425, 0.04, PI / 2);
  mesh(torso, new THREE.CylinderGeometry(0.09, 0.09, 0.06, 14), suitD, 0, 0.43, 0.04);
  // head
  const head = joint(torso, 'head', 0, 0.46, 0.04);
  mesh(head, new THREE.SphereGeometry(0.18, 24, 16), helmet, 0, 0.17, 0);
  mesh(head, new THREE.SphereGeometry(0.183, 20, 6, PI / 2 - 1.35, 2.7, 1.12, 0.62), visorBack, 0, 0.17, 0);
  mesh(head, new THREE.SphereGeometry(0.19, 20, 6, PI / 2 - 1.35, 2.7, 1.12, 0.62), visor, 0, 0.17, 0);
  mesh(head, new THREE.TorusGeometry(0.187, 0.014, 6, 20, 2.7), trim, 0, 0.17 + 0.187 * Math.cos(1.12), 0, PI / 2, 0, PI / 2 - 1.35 + PI);
  mesh(head, new THREE.SphereGeometry(0.184, 8, 8, PI / 2 - 0.14, 0.28, 0, 1.1), helmetStripe, 0, 0.17, 0);
  mesh(head, new THREE.SphereGeometry(0.184, 8, 8, 3 * PI / 2 - 0.14, 0.28, 0, 1.6), helmetStripe, 0, 0.17, 0);
  mesh(head, new THREE.BoxGeometry(0.22, 0.09, 0.12), helmet, 0, 0.07, 0.13);
  mesh(head, new THREE.BoxGeometry(0.16, 0.04, 0.04), trim, 0, 0.08, 0.19);
  mesh(head, new THREE.BoxGeometry(0.04, 0.12, 0.16), helmetStripe, 0, 0.395, -0.02, 0.0);
  mesh(head, new THREE.CylinderGeometry(0.12, 0.13, 0.05, 20), trim, 0, 0.0, 0.0);
  // arms with the gloves out to the wheel
  for (const sx of [-1, 1]) {
    const ua = joint(torso, sx < 0 ? 'upperArmL' : 'upperArmR', sx * 0.21, 0.36, 0.04);
    limb(ua, [0, 0, 0], [sx * 0.03, -0.10, 0.16], 0.06, suit);
    const fa = joint(ua, sx < 0 ? 'forearmL' : 'forearmR', sx * 0.03, -0.10, 0.16);
    mesh(fa, new THREE.SphereGeometry(0.065, 12, 8), accent, 0, 0, 0);
    limb(fa, [0, 0, 0], [-sx * 0.08, 0.02, 0.12], 0.05, suit);
    mesh(fa, new THREE.CylinderGeometry(0.065, 0.06, 0.05, 12), accent, -sx * 0.065, 0.017, 0.10, PI / 2 - 0.5, 0, -sx * 0.5);
    mesh(fa, new THREE.SphereGeometry(0.075, 14, 10), glove, -sx * 0.09, 0.03, 0.15);
    mesh(fa, new THREE.BoxGeometry(0.05, 0.05, 0.05), glove, -sx * 0.13, 0.05, 0.17);
    const grip = joint(fa, sx < 0 ? 'gripL' : 'gripR', -sx * 0.09, 0.03, 0.15);
    if (!g.userData.sockets) g.userData.sockets = {};
    g.userData.sockets[sx < 0 ? 'gripL' : 'gripR'] = grip;
    g.userData.joints = g.userData.joints || {};
    g.userData.joints[sx < 0 ? 'upperArmL' : 'upperArmR'] = ua;
    g.userData.joints[sx < 0 ? 'forearmL' : 'forearmR'] = fa;
  }
  g.userData.joints.torso = torso; g.userData.joints.head = head;
  void collar;
  g.userData.livery = 'fabric:' + suit.color.getHexString();
  g.userData.suitAccent = 'fabric:' + accent.color.getHexString();
  g.userData.helmet = 'metal:' + helmet.color.getHexString();

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
