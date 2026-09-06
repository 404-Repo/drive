// driver_racer (round 2 hero rebuild): a stocky helmeted racer that reads as a BODY from the
// chase camera, not a ball on a seat. Wide shoulder yoke and pads rise 0.17 m above the seat
// back, elbows sit outside the torso silhouette so both arms show from behind, forearms run in
// to oversized gloves on the wheel, knees up with boots under the cowl. Helmet 0.34 m: a
// mirrored visor (metalness so it catches the sky), a painted gleam strip on the visor, a
// chin guard, a top fin, a rear lip and the livery stripe over the crown. Joints exactly as the
// TSV: torso at the hips, head at the helmet base, upperArmL/R at the shoulders, forearmL/R at
// the elbows; geometry is a child of each joint so the pivot is the joint. Base at the seat,
// faces +Z.
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
    const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, L, 3, seg || 10), m);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    o.position.copy(A).add(B).multiplyScalar(0.5); parent.add(o); return o;
  };
  // a ring (band) around a limb from a toward b, centred at t along it
  const band = (parent, a, b, t, r, h, m, seg) => {
    const A = V(a), B = V(b); const d = B.clone().sub(A);
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg || 10), m);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    o.position.copy(A).add(d.multiplyScalar(t)); parent.add(o); return o;
  };
  const joint = (parent, name, x, y, z) => { const j = new THREE.Group(); j.name = 'joint_' + name; j.position.set(x, y, z); parent.add(j); return j; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const DS = { side: THREE.DoubleSide };

  const suit = mat('fabric', 0xf1e6d2, 0.8, 0);
  const suitD = mat('fabric', 0xd2c7b2, 0.82, 0);
  const accent = mat('fabric', 0xed5851, 0.8, 0);
  const glove = mat('fabric', 0xe6cf9c, 0.85, 0);
  const helmet = mat('metal', 0xed5851, 0.35, 0.15);
  const helmetStripe = mat('metal', 0xf1e6d2, 0.35, 0.15, DS);
  const trim = mat('metal', 0x3a3f46, 0.45, 0.25);
  const trimL = mat('metal', 0x4a505a, 0.45, 0.25);
  const boot = mat(null, 0x232528, 0.85, 0);
  const visorBack = mat(null, 0x232528, 0.6, 0, DS);
  // the visor: the one mirrored surface the style lock allows. Unnamed and transparent so the
  // surface pass leaves it alone; metalness makes the sky and the sun land on it.
  const visor = mat(null, 0x8fa9d6, 0.10, 0.55, { transparent: true, opacity: 0.88, side: THREE.DoubleSide, envMapIntensity: 3.0 });
  // a painted gleam across the top of the visor, the hand painted highlight of the style lock
  const gleam = mat(null, 0xf1e6d2, 0.3, 0, { transparent: true, opacity: 0.9, side: THREE.DoubleSide });

  // ---- pelvis, belt and legs: fixed to the seat, the torso leans above them
  mesh(g, box(0.40, 0.16, 0.30), suitD, 0, 0.09, 0.02);
  mesh(g, box(0.42, 0.05, 0.32), trim, 0, 0.165, 0.02);
  mesh(g, box(0.09, 0.05, 0.02), accent, 0, 0.165, 0.185);
  for (const sx of [-1, 1]) {
    const hip = [sx * 0.11, 0.12, 0.06], knee = [sx * 0.125, 0.27, 0.24], ankle = [sx * 0.125, 0.10, 0.32];
    limb(g, hip, knee, 0.078, suit);
    mesh(g, new THREE.SphereGeometry(0.085, 10, 7), accent, knee[0], knee[1], knee[2]);
    limb(g, knee, ankle, 0.066, suit);
    band(g, knee, ankle, 0.75, 0.072, 0.05, suitD);
    mesh(g, box(0.13, 0.10, 0.17), boot, sx * 0.125, 0.055, 0.34);
    mesh(g, box(0.134, 0.035, 0.05), accent, sx * 0.125, 0.075, 0.40);
    mesh(g, box(0.134, 0.02, 0.17), trimL, sx * 0.125, 0.11, 0.34);
  }

  // ---- torso joint at the hips
  const torso = joint(g, 'torso', 0, 0.14, -0.02);
  mesh(torso, box(0.44, 0.36, 0.26), suit, 0, 0.22, 0.04);
  // shoulder yoke in the racer's colour: the top of the body, read from above and behind
  mesh(torso, box(0.46, 0.11, 0.28), accent, 0, 0.365, 0.04);
  mesh(torso, box(0.46, 0.012, 0.28), suitD, 0, 0.421, 0.04);
  // chest plate, zip strip, side piping, back band
  mesh(torso, box(0.30, 0.22, 0.03), accent, 0, 0.20, 0.175);
  mesh(torso, box(0.035, 0.30, 0.04), trim, 0, 0.21, 0.18);
  for (const sx of [-1, 1]) mesh(torso, box(0.03, 0.34, 0.27), suitD, sx * 0.225, 0.21, 0.04);
  mesh(torso, box(0.44, 0.10, 0.03), accent, 0, 0.16, -0.10);
  mesh(torso, box(0.20, 0.05, 0.03), suitD, 0, 0.27, -0.10);
  // shoulder pads
  for (const sx of [-1, 1]) mesh(torso, new THREE.SphereGeometry(0.085, 12, 8), accent, sx * 0.225, 0.38, 0.04);
  // collar ring and neck
  mesh(torso, new THREE.TorusGeometry(0.105, 0.035, 8, 14), accent, 0, 0.44, 0.04, PI / 2);
  mesh(torso, new THREE.CylinderGeometry(0.085, 0.085, 0.09, 12), suitD, 0, 0.45, 0.04);

  // ---- head joint at the helmet base
  const head = joint(torso, 'head', 0, 0.46, 0.04);
  const HR = 0.17, HY = 0.15;
  mesh(head, new THREE.SphereGeometry(HR, 20, 14), helmet, 0, HY, 0);
  // visor: a dark band, the mirrored pane over it, a gleam strip near its top, a trim rim above
  mesh(head, new THREE.SphereGeometry(HR + 0.003, 20, 6, PI / 2 - 1.3, 2.6, 1.08, 0.66), visorBack, 0, HY, 0);
  mesh(head, new THREE.SphereGeometry(HR + 0.010, 20, 6, PI / 2 - 1.3, 2.6, 1.08, 0.66), visor, 0, HY, 0);
  mesh(head, new THREE.SphereGeometry(HR + 0.014, 10, 2, PI / 2 - 0.9, 1.8, 1.12, 0.09), gleam, 0, HY, 0);
  mesh(head, new THREE.TorusGeometry(HR + 0.006, 0.016, 6, 16, 2.6), trim, 0, HY + (HR + 0.006) * Math.cos(1.08), 0, PI / 2, 0, PI / 2 - 1.3 + PI);
  for (const sx of [-1, 1]) mesh(head, new THREE.CylinderGeometry(0.035, 0.035, 0.02, 10), trimL, sx * (HR + 0.004), HY + 0.02, 0.01, 0, 0, PI / 2);
  // chin guard and its vent
  mesh(head, box(0.24, 0.10, 0.15), helmet, 0, 0.055, 0.115);
  mesh(head, box(0.16, 0.035, 0.03), trim, 0, 0.055, 0.19);
  // livery stripe over the crown, front and back, and the fin
  mesh(head, new THREE.SphereGeometry(HR + 0.004, 8, 8, PI / 2 - 0.14, 0.28, 0, 1.06), helmetStripe, 0, HY, 0);
  mesh(head, new THREE.SphereGeometry(HR + 0.004, 8, 8, 3 * PI / 2 - 0.14, 0.28, 0, 1.6), helmetStripe, 0, HY, 0);
  mesh(head, box(0.04, 0.11, 0.20), helmetStripe, 0, HY + HR + 0.02, -0.03);
  // rear lip and the neck ring
  mesh(head, box(0.20, 0.03, 0.05), trim, 0, 0.10, -0.155);
  mesh(head, new THREE.CylinderGeometry(0.12, 0.13, 0.05, 16), trim, 0, 0.0, 0.0);

  // ---- arms: shoulders wide, elbows out past the torso, forearms in to the wheel
  g.userData.sockets = {};
  g.userData.joints = { torso, head };
  for (const sx of [-1, 1]) {
    const ua = joint(torso, sx < 0 ? 'upperArmL' : 'upperArmR', sx * 0.225, 0.38, 0.04);
    const elbow = [sx * 0.045, -0.13, 0.15];
    limb(ua, [0, 0, 0], elbow, 0.062, accent);
    band(ua, [0, 0, 0], elbow, 0.62, 0.072, 0.05, suitD);
    const fa = joint(ua, sx < 0 ? 'forearmL' : 'forearmR', elbow[0], elbow[1], elbow[2]);
    mesh(fa, new THREE.SphereGeometry(0.065, 10, 7), accent, 0, 0, 0);
    const grip = [-sx * 0.135, 0.0, 0.17];
    limb(fa, [0, 0, 0], grip, 0.056, suit);
    band(fa, [0, 0, 0], grip, 0.72, 0.066, 0.05, accent);
    mesh(fa, new THREE.SphereGeometry(0.08, 12, 9), glove, grip[0], grip[1], grip[2]);
    mesh(fa, box(0.05, 0.05, 0.06), glove, grip[0] - sx * 0.035, grip[1] + 0.035, grip[2] + 0.035);
    const gs = joint(fa, sx < 0 ? 'gripL' : 'gripR', grip[0], grip[1], grip[2]);
    g.userData.sockets[sx < 0 ? 'gripL' : 'gripR'] = gs;
    g.userData.joints[sx < 0 ? 'upperArmL' : 'upperArmR'] = ua;
    g.userData.joints[sx < 0 ? 'forearmL' : 'forearmR'] = fa;
  }
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
