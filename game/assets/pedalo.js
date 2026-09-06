// pedalo candidate 3: candidate 0 with the sand fillet pulled inside the hull width (1.8 m brief). Capsule pontoons flattened in y with a keel skid,
// the whitewash stripe as side strips with half torus ends, two cream cross beams with bolts,
// a teal slat floor, box bench, half cylinder paddle housings with a spoke motif, pedal
// cranks, a slide from tilted boxes and a mast with a triangular mint pennant. Bow faces +Z.
export default function (THREE) {
  const g = new THREE.Group();
  const C = (hex, dl, ds) => new THREE.Color(hex).offsetHSL(0, ds || 0, dl || 0);
  const M = (name, hex, rough, dl, ds, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: C(hex, dl, ds), roughness: rough, metalness: 0 }, extra || {}));
    m.name = name; return m;
  };
  const mesh = (geo, mat, x, y, z, parent) => { const o = new THREE.Mesh(geo, mat); o.position.set(x || 0, y || 0, z || 0); (parent || g).add(o); return o; };
  const box = (w, h, d, mat, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);

  const yellow = M('timber', 0xf2c230, 0.6);
  const yellowHi = M('timber', 0xf2c230, 0.58, 0.07, -0.05);
  const white = M('timber', 0xf1e6d2, 0.65);
  const cream = M('timber', 0xf1e6d2, 0.7, -0.05, -0.02);
  const creamHi = M('timber', 0xf1e6d2, 0.7, 0.02, -0.02);
  const teal = M('timber', 0x3f8f8a, 0.72);
  const red = M('metal', 0xd6402f, 0.45, 0, 0, { metalness: 0.15, side: THREE.DoubleSide });
  const redDark = M('metal', 0xd6402f, 0.5, -0.12, -0.05, { metalness: 0.15 });
  const mint = M('fabric', 0x3fc7a0, 0.8, 0, 0, { side: THREE.DoubleSide });
  const mastM = M('timber', 0xcdb897, 0.7);
  const metal = M('metal', 0x3a3f46, 0.45, 0, 0, { metalness: 0.2 });
  const keel = new THREE.MeshStandardMaterial({ color: 0x232528, roughness: 0.85 });
  const sand = M('ground', 0xe6cf9c, 0.9);

  // sand the boat is beached on
  mesh(new THREE.CylinderGeometry(0.86, 0.9, 0.04, 20), sand, 0, 0.02, 0).scale.z = 1.7;

  // pontoons
  for (const s of [-1, 1]) {
    const hx = s * 0.6;
    const hull = mesh(new THREE.CapsuleGeometry(0.3, 2.6, 4, 14), yellow, hx, 0.28, 0);
    hull.rotation.x = Math.PI / 2; hull.scale.set(1, 1, 0.8);
    box(0.3, 0.02, 2.4, yellowHi, hx, 0.52, 0);                        // bleached crown strip
    box(0.4, 0.1, 2.3, keel, hx, 0.07, 0);                             // dark keel skid
    for (const t of [-1, 1]) box(0.03, 0.07, 2.6, white, hx + t * 0.295, 0.24, 0);
    const a1 = mesh(new THREE.TorusGeometry(0.295, 0.018, 6, 14, Math.PI), white, hx, 0.24, 1.3); a1.rotation.x = Math.PI / 2;
    const a2 = mesh(new THREE.TorusGeometry(0.295, 0.018, 6, 14, Math.PI), white, hx, 0.24, -1.3); a2.rotation.x = -Math.PI / 2;
  }

  // cross beams with bolts, and the slat floor between the hulls
  for (const bz of [0.95, -0.95]) {
    box(1.8, 0.08, 0.26, cream, 0, 0.56, bz);
    box(1.8, 0.01, 0.26, creamHi, 0, 0.605, bz);
    for (const bx of [-0.75, 0.75]) for (const dz of [-0.08, 0.08]) mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 8), metal, bx, 0.615, bz + dz);
  }
  for (let i = 0; i < 11; i++) box(0.6, 0.04, 0.1, teal, 0, 0.42, -0.8 + i * 0.16);
  for (const s of [-1, 1]) box(0.05, 0.05, 1.7, teal, s * 0.28, 0.38, 0);

  // bench seat on two pedestals, pedals in front
  for (const s of [-1, 1]) box(0.12, 0.43, 0.4, cream, s * 0.4, 0.635, -0.1);
  box(1.1, 0.08, 0.5, cream, 0, 0.86, -0.1);
  box(1.1, 0.01, 0.5, creamHi, 0, 0.905, -0.1);
  const back = box(1.1, 0.42, 0.08, cream, 0, 1.1, -0.36); back.rotation.x = -0.15;
  const backTop = box(1.1, 0.012, 0.08, creamHi, 0, 1.1 + 0.21 * Math.cos(0.15), -0.36 - 0.21 * Math.sin(0.15)); backTop.rotation.x = -0.15;
  const shaft = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 10), metal, 0, 0.6, 0.3); shaft.rotation.z = Math.PI / 2;
  box(0.03, 0.1, 0.03, metal, 0.2, 0.65, 0.3); box(0.1, 0.03, 0.14, metal, 0.2, 0.7, 0.3);
  box(0.03, 0.1, 0.03, metal, -0.2, 0.55, 0.3); box(0.1, 0.03, 0.14, metal, -0.2, 0.5, 0.3);

  // paddle wheel housings behind the seat, one per hull
  for (const s of [-1, 1]) {
    const hx = s * 0.42, hy = 0.48, hz = -0.7;
    const hood = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 16, 1, false, 0, Math.PI), red, hx, hy, hz);
    hood.rotation.z = Math.PI / 2;
    const hub = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 10), metal, hx, hy, hz); hub.rotation.z = Math.PI / 2;
    for (const f of [-1, 1]) for (const a of [0.3, 0.9, 1.57, 2.24, 2.84]) {
      const sp = box(0.02, 0.24, 0.025, redDark, hx + f * 0.075, hy + 0.13 * Math.sin(a), hz + 0.13 * Math.cos(a));
      sp.rotation.x = -(Math.PI / 2 - a) ;
    }
  }

  // slide at the back right
  const sx = 0.35;
  box(0.5, 0.06, 0.35, cream, sx, 1.0, -0.62);
  box(0.5, 0.01, 0.35, creamHi, sx, 1.035, -0.62);
  for (const s of [-1, 1]) box(0.06, 0.58, 0.06, cream, sx + s * 0.2, 0.71, -0.62);
  const ang = Math.atan2(0.37, 0.6), len = Math.hypot(0.37, 0.6);
  const bed = box(0.5, 0.05, len, creamHi, sx, 0.785, -1.1); bed.rotation.x = -ang;
  for (const s of [-1, 1]) { const r = box(0.05, 0.14, len, cream, sx + s * 0.225, 0.785 + 0.06, -1.1); r.rotation.x = -ang; }
  box(0.5, 0.05, 0.2, creamHi, sx, 0.585, -1.48);
  for (const s of [-1, 1]) box(0.05, 0.12, 0.2, cream, sx + s * 0.225, 0.64, -1.48);

  // mast and pennant on the front left beam
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.78, 10), mastM, -0.55, 0.99, 0.95);
  mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10), metal, -0.55, 0.645, 0.95);
  mesh(new THREE.SphereGeometry(0.03, 10, 8), mastM, -0.55, 1.38, 0.95);
  const pen = new THREE.Shape(); pen.moveTo(0, 0); pen.lineTo(0.4, 0.1); pen.lineTo(0, 0.2); pen.closePath();
  mesh(new THREE.ExtrudeGeometry(pen, { depth: 0.012, bevelEnabled: false }), mint, -0.52, 1.16, 0.944);

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
