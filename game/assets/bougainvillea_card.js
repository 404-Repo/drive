// bougainvillea_card c1: profile sweeps. Two blossom cards bent forward at the top so the mass
// cascades away from the wall (vertex bend on a segmented plane), over an ExtrudeGeometry
// trough with a U profile swept along its 1 m length, a lighter extruded rim, an inset soil slab,
// and three stems each of two kinked cylinder segments. Mounts against a wall at the back.
export default function (THREE) {
  const g = new THREE.Group();
  const DS = THREE.DoubleSide;
  const M = (name, color, roughness, extra) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness, metalness: 0 }, extra || {})); m.name = name; return m; };
  const put = (geo, mat, x, y, z, rx, ry, rz, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); (parent || g).add(m); return m; };
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const UP = V3(0, 1, 0);
  const limb = (a, b, ra, rb, mat) => {
    const d = b.clone().sub(a), L = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rb, ra, L, 8), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UP, d.normalize());
    g.add(m);
    return m;
  };

  const ca = M('card:bougainvillea_a', 0xd8388a, 0.85, { side: DS });
  const cb = M('card:bougainvillea_b', 0xcf3383, 0.85, { side: DS });
  const pot = M('tile', 0xc4683f, 0.75);
  const potBase = M('tile', 0x9e5233, 0.8);
  const potRim = M('tile', 0xd47c52, 0.7);
  const soil = M('ground', 0x5a4636, 0.95);
  const stem = M('timber', 0x6b5a3a, 0.9);

  // trough: U profile in the YZ plane extruded along x
  const uShape = (w, h, t) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(w / 2 - t, h); s.lineTo(w / 2 - t, t);
    s.lineTo(-w / 2 + t, t); s.lineTo(-w / 2 + t, h); s.lineTo(-w / 2, h); s.closePath();
    return s;
  };
  const trough = new THREE.ExtrudeGeometry(uShape(0.36, 0.3, 0.05), { depth: 1.0, bevelEnabled: false });
  trough.rotateY(Math.PI / 2);
  const tm = put(trough, pot, -0.5, 0.02, 0);
  tm.position.x = -0.5;
  // darker base band sleeve and lighter rim
  put(new THREE.BoxGeometry(1.02, 0.08, 0.38), potBase, 0, 0.04, 0);
  const rim = new THREE.ExtrudeGeometry(uShape(0.4, 0.04, 0.07), { depth: 1.04, bevelEnabled: false });
  rim.rotateY(Math.PI / 2);
  put(rim, potRim, -0.52, 0.3, 0);
  put(new THREE.BoxGeometry(0.9, 0.03, 0.26), soil, 0, 0.265, 0);
  // stems, kinked
  [[-0.3, -0.05], [0.02, 0.08], [0.3, -0.02]].forEach((s, i) => {
    const a = V3(s[0], 0.27, s[1]), mid = V3(s[0] * 1.2 + 0.05, 0.75, s[1] + 0.03), b = V3(s[0] * 0.9, 1.2, s[1] + 0.06);
    limb(a, mid, 0.035, 0.03, stem);
    limb(mid, b, 0.03, 0.025, stem);
  });

  // cascading cards: bend forward toward the top
  const cardGeo = (w, h, bend) => {
    const geo = new THREE.PlaneGeometry(w, h, 1, 6);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getY(i) + h / 2) / h;
      p.setZ(i, bend * t * t);
    }
    geo.computeVertexNormals();
    return geo;
  };
  const back = put(cardGeo(3.0, 3.3, 0.14), ca, 0, 0.7 + 3.3 / 2, -0.12, 0, 0.02, 0);
  const front = put(cardGeo(2.7, 3.0, 0.08), cb, 0.04, 0.6 + 3.0 / 2, 0.06, 0, -0.025, 0);
  back.rotation.order = 'YXZ'; front.rotation.order = 'YXZ';

  g.userData.mounts = 'back';

  const box = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put2 = (mat) => { for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put2(m.multiplyMatrices(n.matrixWorld, im)); } return; }
    put2(n.matrixWorld);
  });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });
  return g;
}
