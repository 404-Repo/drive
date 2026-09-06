// harbour_bollard c1: lathe profile. The whole cast body (base flare, tapered shaft, neck, mushroom cap with a rounded
// rim and a flat top) is one revolved profile; the darker base band and the whitewash band are short revolved sleeves
// a few millimetres proud; a whitewash disc sits in the cap top. Square plate with a chamfer step and hex bolts.
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
  const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg || 14);
  const DS = { side: THREE.DoubleSide };
  const dark = mat('metal', 0x3a3f46, 0.45, 0.25);
  const darkBase = mat('metal', 0x2f343b, 0.5, 0.25);
  const darkTop = mat('metal', 0x464c55, 0.45, 0.25);
  const white = mat('metal', 0xf1e6d2, 0.5, 0.15, DS);

  // plate: two stacked boxes give a chamfer step, bleached top
  mesh(g, new THREE.BoxGeometry(0.5, 0.05, 0.5), darkBase, 0, 0.025, 0);
  mesh(g, new THREE.BoxGeometry(0.46, 0.03, 0.46), dark, 0, 0.065, 0);
  mesh(g, new THREE.BoxGeometry(0.42, 0.008, 0.42), darkTop, 0, 0.084, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    mesh(g, new THREE.CylinderGeometry(0.03, 0.03, 0.03, 6), dark, sx * 0.195, 0.095, sz * 0.195);
  }
  // body profile (radius, y)
  mesh(g, lathe([
    [0, 0.08], [0.165, 0.08], [0.16, 0.12], [0.15, 0.20], [0.128, 0.55], [0.12, 0.70], [0.125, 0.745],
    [0.16, 0.765], [0.195, 0.79], [0.20, 0.82], [0.185, 0.86], [0.145, 0.89], [0.10, 0.90], [0, 0.90],
  ], 14), dark, 0, 0, 0);
  // base band sleeve, darker and cooler
  mesh(g, lathe([[0.163, 0.081], [0.168, 0.081], [0.153, 0.20], [0.148, 0.20]], 14), darkBase, 0, 0, 0);
  // whitewash band sleeve under the cap
  mesh(g, lathe([[0.1305, 0.53], [0.1355, 0.53], [0.1245, 0.68], [0.1195, 0.68]], 14), white, 0, 0, 0);
  // whitewash disc in the cap top
  mesh(g, new THREE.CircleGeometry(0.105, 14), white, 0, 0.904, 0, -PI / 2, 0, 0);

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
