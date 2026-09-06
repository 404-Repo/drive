// sign_chevron_board candidate 3: candidate 1 with the posts pulled 15 mm forward and smaller foot collars so the depth lands on the 0.30 m brief. Board as a rounded rectangle Shape extruded,
// rim as a rounded rectangle ring Shape extruded proud of the face, three chevron Shapes
// extruded 0.02 with a lighter inner chevron, octagonal posts (8 segment cylinders) with
// lathe foot collars, backing plate and brackets. Faces +Z, mounts back. No letters.
// Round 2 (triangle budget, 31 placed): rounded corners at 2 curve segments. 1368 -> about 1000 tris.
export default function (THREE) {
  const g = new THREE.Group();
  const C = (hex, dl, ds) => new THREE.Color(hex).offsetHSL(0, ds || 0, dl || 0);
  const M = (name, hex, rough, dl, ds, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: C(hex, dl, ds), roughness: rough, metalness: 0 }, extra || {}));
    m.name = name; return m;
  };
  const mesh = (geo, mat, x, y, z, parent) => { const o = new THREE.Mesh(geo, mat); o.position.set(x || 0, y || 0, z || 0); (parent || g).add(o); return o; };
  const box = (w, h, d, mat, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);
  const ext = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 2 });
  const rrect = (cx, cy, w, h, r, path) => {
    const s = path || new THREE.Shape(); const x = cx - w / 2, y = cy - h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); s.closePath(); return s;
  };
  // chevron pointing +x: x0 is the notch side, w the width, h the height, t the arm thickness along x
  const chevron = (x0, cy, w, h, t) => {
    const s = new THREE.Shape();
    s.moveTo(x0, cy + h / 2); s.lineTo(x0 + w - t, cy + h / 2); s.lineTo(x0 + w, cy); s.lineTo(x0 + w - t, cy - h / 2);
    s.lineTo(x0, cy - h / 2); s.lineTo(x0 + t, cy); s.closePath(); return s;
  };

  const face = M('timber', 0xf1e6d2, 0.75, -0.02, -0.02);
  const rim = M('timber', 0x3f8f8a, 0.72, -0.08, -0.04);
  const rimHi = M('timber', 0x3f8f8a, 0.7, 0.05, -0.02);
  const red = M('metal', 0xd6402f, 0.45, 0, 0, { metalness: 0.15 });
  const redHi = M('metal', 0xd6402f, 0.45, 0.08, -0.03, { metalness: 0.15 });
  const post = M('metal', 0x3a3f46, 0.45, 0, 0, { metalness: 0.25 });
  const postHi = M('metal', 0x3a3f46, 0.42, 0.08, 0, { metalness: 0.25 });
  const postFoot = M('metal', 0x3a3f46, 0.5, -0.12, -0.03, { metalness: 0.25 });
  const back = M('timber', 0xcdb897, 0.75);
  const backHi = M('timber', 0xcdb897, 0.72, 0.06, -0.02);

  const BY = 1.0, BW = 2.4, BH = 1.2;
  mesh(ext(rrect(0, BY, BW - 0.16, BH - 0.16, 0.06), 0.06), face, 0, 0, 0.0);
  mesh(ext(rrect(0, BY, BW - 0.1, BH - 0.1, 0.06), 0.04), back, 0, 0, -0.04);
  const ring = rrect(0, BY, BW, BH, 0.1); ring.holes.push(rrect(0, BY, BW - 0.2, BH - 0.2, 0.05, new THREE.Path()));
  mesh(ext(ring, 0.12), rim, 0, 0, -0.03);
  const ringHi = rrect(0, BY, BW - 0.01, BH - 0.01, 0.1); ringHi.holes.push(rrect(0, BY, BW - 0.06, BH - 0.06, 0.08, new THREE.Path()));
  mesh(ext(ringHi, 0.01), rimHi, 0, 0, 0.09);
  box(BW - 0.2, 0.012, 0.12, rimHi, 0, BY + BH / 2 + 0.005, 0.03);
  box(BW - 0.14, 0.03, 0.01, backHi, 0, BY + BH / 2 - 0.09, -0.045);

  for (const x0 of [-0.9, -0.25, 0.4]) {
    mesh(ext(chevron(x0, BY, 0.5, 0.8, 0.19), 0.02), red, 0, 0, 0.06);
    mesh(ext(chevron(x0 + 0.05, BY, 0.4, 0.62, 0.11), 0.008), redHi, 0, 0, 0.08);
  }

  for (const px of [-0.72, 0.72]) {
    mesh(new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.088, 0), new THREE.Vector2(0.088, 0.2), new THREE.Vector2(0.075, 0.25), new THREE.Vector2(0, 0.25)], 8), postFoot, px, 0, -0.125);
    mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.2, 8), post, px, 0.85, -0.125);
    mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.05, 8), postHi, px, 1.475, -0.125);
    for (const by of [BY - 0.35, BY + 0.35]) {
      box(0.18, 0.1, 0.1, post, px, by, -0.09);
      mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 8), postHi, px + 0.06, by, -0.045).rotation.x = Math.PI / 2;
      mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 8), postHi, px - 0.06, by, -0.045).rotation.x = Math.PI / 2;
    }
  }
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
