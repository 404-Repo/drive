// sign_round_post candidate 2: a second reading of the reference. The red rim is a rolled
// torus edge around a whitewash disc rather than a flat band, the backing disc is teal
// planks with two visible cleats, the arrow is a Shape with a lighter top edge, the coral
// disc hangs off a side bracket to +x as in the picture, the post is octagonal with a
// collar, the base an octagonal stone with a sand tint top. Faces +Z, mounts back.
export default function (THREE) {
  const g = new THREE.Group();
  const C = (hex, dl, ds) => new THREE.Color(hex).offsetHSL(0, ds || 0, dl || 0);
  const M = (name, hex, rough, dl, ds, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: C(hex, dl, ds), roughness: rough, metalness: 0 }, extra || {}));
    m.name = name; return m;
  };
  const mesh = (geo, mat, x, y, z, parent) => { const o = new THREE.Mesh(geo, mat); o.position.set(x || 0, y || 0, z || 0); (parent || g).add(o); return o; };
  const box = (w, h, d, mat, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);
  const disc = (r, t, segs, mat, x, y, z) => { const o = mesh(new THREE.CylinderGeometry(r, r, t, segs), mat, x, y, z); o.rotation.x = Math.PI / 2; return o; };

  const white = M('metal', 0xf1e6d2, 0.45, -0.02, -0.02, { metalness: 0.1 });
  const red = M('metal', 0xd6402f, 0.45, 0, 0, { metalness: 0.15 });
  const redHi = M('metal', 0xd6402f, 0.45, 0.08, -0.03, { metalness: 0.15 });
  const dark = M('metal', 0x3a3f46, 0.45, 0, 0, { metalness: 0.25 });
  const darkHi = M('metal', 0x3a3f46, 0.42, 0.08, 0, { metalness: 0.25 });
  const darkFoot = M('metal', 0x3a3f46, 0.5, -0.1, -0.03, { metalness: 0.25 });
  const teal = M('timber', 0x3f8f8a, 0.72);
  const teal2 = M('timber', 0x3f8f8a, 0.72, -0.04, -0.02);
  const tealHi = M('timber', 0x3f8f8a, 0.7, 0.06, -0.02);
  const coral = M('metal', 0xed5851, 0.45, 0, 0, { metalness: 0.15 });
  const coralHi = M('metal', 0xed5851, 0.45, 0.08, -0.03, { metalness: 0.15 });
  const stone = M('stone', 0xcdb897, 0.85);
  const stoneShade = M('stone', 0x8d7b63, 0.9);
  const sandTop = M('stone', 0xe6cf9c, 0.85);

  const PZ = -0.09;
  // octagonal stone base with a sand tint top
  mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.07, 8), stoneShade, 0, 0.035, PZ).rotation.y = Math.PI / 8;
  mesh(new THREE.CylinderGeometry(0.125, 0.135, 0.07, 8), stone, 0, 0.105, PZ).rotation.y = Math.PI / 8;
  mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.01, 8), sandTop, 0, 0.145, PZ).rotation.y = Math.PI / 8;
  // octagonal post with foot band, collar and finial
  mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 8), darkFoot, 0, 0.22, PZ);
  mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 8), dark, 0, 1.29, PZ);
  mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.06, 8), darkHi, 0, 1.5, PZ);
  mesh(new THREE.CylinderGeometry(0.055, 0.04, 0.05, 8), darkHi, 0, 2.31, PZ);
  mesh(new THREE.SphereGeometry(0.045, 10, 8), darkHi, 0, 2.35, PZ);

  // backing: teal plank disc made of five horizontal planks clipped to a circle, two cleats
  const DY = 2.2;
  disc(0.42, 0.03, 20, teal2, 0, DY, -0.045);
  for (let i = -2; i <= 2; i++) {
    const hw = Math.sqrt(0.42 * 0.42 - (i * 0.16) * (i * 0.16)) - 0.01;
    box(hw * 2, 0.148, 0.02, i % 2 ? teal : teal2, 0, DY + i * 0.16, -0.04);
  }
  for (const by of [DY - 0.2, DY + 0.2]) { box(0.16, 0.06, 0.06, teal, 0, by, -0.085); box(0.16, 0.012, 0.062, tealHi, 0, by + 0.036, -0.085); }
  for (const by of [DY - 0.2, DY + 0.2]) box(0.08, 0.05, 0.03, dark, 0, by, -0.11);
  // whitewash disc with a rolled red torus rim and a lighter rolled highlight
  disc(0.36, 0.05, 20, white, 0, DY, -0.005);
  mesh(new THREE.TorusGeometry(0.355, 0.045, 10, 20), red, 0, DY, 0.0);
  mesh(new THREE.TorusGeometry(0.355, 0.02, 8, 20), redHi, 0, DY, 0.03);
  // arrow shape pointing +x with a lighter top edge
  const arrow = new THREE.Shape();
  arrow.moveTo(-0.2, 0.045); arrow.lineTo(0.02, 0.045); arrow.lineTo(0.02, 0.12); arrow.lineTo(0.22, 0); arrow.lineTo(0.02, -0.12); arrow.lineTo(0.02, -0.045); arrow.lineTo(-0.2, -0.045); arrow.closePath();
  mesh(new THREE.ExtrudeGeometry(arrow, { depth: 0.02, bevelEnabled: false }), dark, 0, DY, 0.02);
  box(0.2, 0.02, 0.006, darkHi, -0.09, DY + 0.025, 0.043);

  // coral disc on a side bracket to +x
  const CY = 1.62, CX = 0.19;
  box(0.2, 0.05, 0.04, dark, 0.09, CY, PZ + 0.03);
  disc(0.15, 0.05, 16, coral, CX, CY, 0.0);
  disc(0.135, 0.008, 16, coralHi, CX, CY, 0.029);
  box(0.16, 0.04, 0.015, dark, CX, CY, 0.04);
  g.userData.mounts = 'back';

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
