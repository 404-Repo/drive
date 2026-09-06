// race_flag_pole c1: all geometry, profile arm. Base as a lathe with a rounded stone drum on a metal collar, pole as a
// tapered lathe with a foot band and a finial, the swallow tailed flag as a ShapeGeometry in coral fabric with a
// whitewash disc (both faces) and a lighter hem along the hoist and top, the mint pennant at 3 m as a second shape.
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
  const stone = mat('stone', 0xcdb897, 0.85);
  const stoneTop = mat('stone', 0xdcc9a8, 0.85);
  const coral = mat('fabric', 0xed5851, 0.8, 0, DS);
  const coralHem = mat('fabric', 0xf5776e, 0.8, 0, DS);
  const white = mat('fabric', 0xf1e6d2, 0.8, 0, DS);
  const mint = mat('fabric', 0x3fc7a0, 0.8, 0, DS);
  const mintHem = mat('fabric', 0x5ad4b1, 0.8, 0, DS);

  // base: collar and rounded stone drum, revolved
  mesh(g, lathe([[0, 0], [0.165, 0], [0.165, 0.03], [0.15, 0.035], [0, 0.035]], 14), darkBase, 0, 0, 0);
  mesh(g, lathe([[0, 0.03], [0.15, 0.03], [0.152, 0.11], [0.135, 0.15], [0.06, 0.15]], 14), stone, 0, 0, 0);
  mesh(g, new THREE.CircleGeometry(0.135, 14), stoneTop, 0, 0.151, 0, -PI / 2, 0, 0);
  // pole: foot band, tapered shaft, finial in one revolve each
  mesh(g, lathe([[0.04, 0.14], [0.04, 0.40], [0.034, 0.40]], 10), darkBase, 0, 0, 0);
  mesh(g, lathe([[0.034, 0.40], [0.027, 4.10], [0.02, 4.12], [0.05, 4.16], [0.04, 4.20], [0, 4.21]], 10), dark, 0, 0, 0);
  // swallow tailed flag: hoist at x 0.03, fly to 1.43, top 4.1, bottom 3.2, notch 0.35 deep
  const fl = new THREE.Shape();
  fl.moveTo(0.03, 4.10); fl.lineTo(1.43, 4.10); fl.lineTo(1.08, 3.65); fl.lineTo(1.43, 3.20); fl.lineTo(0.03, 3.20); fl.lineTo(0.03, 4.10);
  mesh(g, new THREE.ShapeGeometry(fl), coral, 0, 0, 0);
  for (const s of [-1, 1]) {
    mesh(g, new THREE.CircleGeometry(0.2, 14), white, 0.55, 3.65, s * 0.003, 0, s > 0 ? 0 : PI, 0);
    mesh(g, new THREE.PlaneGeometry(1.36, 0.035), coralHem, 0.71, 4.08, s * 0.003, 0, s > 0 ? 0 : PI, 0);
    mesh(g, new THREE.PlaneGeometry(0.04, 0.9), coralHem, 0.05, 3.65, s * 0.003, 0, s > 0 ? 0 : PI, 0);
  }
  // mint pennant at 3 m
  const pen = new THREE.Shape();
  pen.moveTo(0.03, 3.10); pen.lineTo(0.63, 3.06); pen.lineTo(0.63, 2.98); pen.lineTo(0.03, 2.92); pen.lineTo(0.03, 3.10);
  mesh(g, new THREE.ShapeGeometry(pen), mint, 0, 0, 0);
  for (const s of [-1, 1]) mesh(g, new THREE.PlaneGeometry(0.58, 0.025), mintHem, 0.325, 3.085, s * 0.003, 0, s > 0 ? 0 : PI, 0);

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
