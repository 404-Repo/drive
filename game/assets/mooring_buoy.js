// mooring_buoy c3: c0 fixed to the TSV height. Primitive assembly, 0.9 x 0.9 x 1.3 m. A kerb red
// sphere 0.9 across with a proud whitewash band round its middle and a lighter red crown disc, a
// visible dark rubber skirt at the waterline, a short dark metal post with a collar, a small
// cone cap and a shackle ring on top (the post and ring together 0.32 m), a short rope stub
// hanging from a dark eye under the base. Joint: body, pivot at the sphere centre (the
// waterline), for the bob and tilt.
// Round 2 (triangle budget, 8 placed): sphere 16 x 11, rings at 16, rubber torus 5 x 14. 1736 -> about 1200 tris.
export default function (THREE) {
  const g = new THREE.Group();
  const col = (hex, l = 0, s = 0) => new THREE.Color(hex).offsetHSL(0, s, l);
  const mat = (hex, name, rough, l = 0, s = 0, metal = 0) => {
    const m = new THREE.MeshStandardMaterial({ color: col(hex, l, s), roughness: rough, metalness: metal });
    if (name) m.name = name; return m;
  };
  const red = mat(0xd6402f, 'metal', 0.45, 0, 0, 0.15);
  const redTop = mat(0xd6402f, 'metal', 0.42, 0.08, -0.05, 0.15);
  const redBase = mat(0xd6402f, 'metal', 0.5, -0.12, -0.05, 0.15);
  const white = mat(0xf1e6d2, 'metal', 0.45, 0, 0, 0.1);
  const whiteTop = mat(0xf1e6d2, 'metal', 0.42, 0.03, -0.03, 0.1);
  const iron = mat(0x3a3f46, 'metal', 0.45, 0, 0, 0.25);
  const ironEdge = mat(0x3a3f46, 'metal', 0.42, 0.1, 0, 0.25);
  const rubber = mat(0x232528, null, 0.85);
  const rope = mat(0xc9b07f, 'fabric', 0.9);
  const add = (parent, geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); parent.add(o); return o;
  };

  const R = 0.45, ROPE = 0.07;
  const body = new THREE.Group(); body.name = 'buoy_body'; body.position.set(0, ROPE + R, 0); g.add(body);
  // Sphere in three colour zones: lower red (darker), whitewash band, upper red, crown disc.
  add(body, new THREE.SphereGeometry(R, 16, 11), red, 0, 0, 0);
  add(body, new THREE.SphereGeometry(R + 0.004, 16, 5, 0, Math.PI * 2, Math.PI * 0.68, Math.PI * 0.32), redBase, 0, 0, 0);
  add(body, new THREE.CylinderGeometry(R + 0.012, R + 0.012, 0.2, 16), white, 0, 0.0, 0);
  add(body, new THREE.CylinderGeometry(R + 0.014, R + 0.014, 0.015, 16), whiteTop, 0, 0.1, 0);
  add(body, new THREE.CylinderGeometry(0.2, 0.26, 0.04, 16), redTop, 0, R - 0.06, 0);
  // Rubber skirt at the waterline, standing proud of the sphere, and a dark base eye with the rope stub.
  add(body, new THREE.TorusGeometry(R * 0.74, 0.045, 5, 14), rubber, 0, -R * 0.6, 0, Math.PI / 2, 0, 0);
  add(body, new THREE.CylinderGeometry(0.05, 0.06, 0.06, 10), iron, 0, -R - 0.01, 0);
  add(body, new THREE.CylinderGeometry(0.022, 0.03, ROPE, 8), rope, 0, -R - ROPE / 2 - 0.01, 0);
  add(body, new THREE.SphereGeometry(0.035, 8, 6), rope, 0, -R - ROPE, 0);
  // Post 0.16 with a foot collar, a head collar, a cone cap and the shackle ring on top.
  add(body, new THREE.CylinderGeometry(0.05, 0.06, 0.18, 10), iron, 0, R - 0.02 + 0.09, 0);
  add(body, new THREE.CylinderGeometry(0.08, 0.08, 0.04, 10), ironEdge, 0, R + 0.01, 0);
  add(body, new THREE.CylinderGeometry(0.065, 0.065, 0.03, 10), ironEdge, 0, R + 0.16, 0);
  add(body, new THREE.ConeGeometry(0.05, 0.05, 10), iron, 0, R + 0.2, 0);
  add(body, new THREE.TorusGeometry(0.065, 0.022, 8, 14), ironEdge, 0, R + 0.275, 0, 0, 0, 0);

  g.userData.joints = { body };

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
