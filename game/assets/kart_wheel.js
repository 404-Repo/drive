// kart_wheel c3: c1 trimmed to the triangle band: fewer lathe rows, lip folded into the hub profile. One revolved tyre section with rounded shoulders and a
// gently domed tread, groove rings, a revolved dished hub with a rim lip, box spokes and
// a livery centre cap. Axle along X under userData.joints.spin.
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
  const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg || 20);
  const DS = { side: THREE.DoubleSide };
  const rubber = mat(null, 0x232528, 0.85, 0, DS);
  const tread = mat(null, 0x2d3035, 0.85, 0, DS);
  const dark = mat('metal', 0x3a3f46, 0.45, 0.25, DS);
  const darkL = mat('metal', 0x4c525c, 0.45, 0.25, DS);
  const darkD = mat('metal', 0x30343a, 0.5, 0.25, DS);
  const cap = mat('metal', 0xed5851, 0.35, 0.15);

  const spin = new THREE.Group(); spin.name = 'joint_spin'; spin.position.set(0, 0.22, 0); g.add(spin);
  // tyre section: (radius, axial); revolved about Y then laid along X (+Y becomes +X)
  const tyre = lathe([[0.125, -0.12], [0.185, -0.118], [0.212, -0.098], [0.221, -0.06], [0.221, 0.06], [0.212, 0.098], [0.185, 0.118], [0.125, 0.12]]);
  mesh(spin, tyre, tread, 0, 0, 0, 0, 0, -PI / 2);
  for (const x of [-0.05, -0.017, 0.017, 0.05]) mesh(spin, new THREE.CylinderGeometry(0.2245, 0.2245, 0.01, 20, 1, true), rubber, x, 0, 0, 0, 0, PI / 2);
  // hub dish with a lip, outboard face at +X
  const hub = lathe([[0.125, 0.125], [0.138, 0.112], [0.11, 0.09], [0.10, 0.03], [0.05, 0.03]]);
  mesh(spin, hub, dark, 0, 0, 0, 0, 0, -PI / 2);
  mesh(spin, new THREE.CircleGeometry(0.125, 20), darkD, -0.11, 0, 0, 0, -PI / 2, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 2 * PI + 0.3;
    const s = mesh(spin, new THREE.BoxGeometry(0.04, 0.036, 0.075), dark, 0.07, Math.sin(a) * 0.07, Math.cos(a) * 0.07);
    s.rotation.x = -a;
  }
  mesh(spin, new THREE.CylinderGeometry(0.045, 0.05, 0.03, 10), cap, 0.09, 0, 0, 0, 0, PI / 2);

  g.userData.joints = { spin };
  g.userData.spinAxis = 'x';
  g.userData.outboard = '+x';
  g.userData.mounts = 'left';
  g.userData.livery = 'metal:' + cap.color.getHexString();

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
