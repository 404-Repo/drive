// rowing_boat c2: a second reading, a flat bottomed skiff built from plan view extrusions. The
// hull is one ExtrudeGeometry of the plan outline (pointed bow, squared transom) with an inset
// hole, so it is a hollow shell with a wall; its vertices are flared outward toward the top so
// the sides lean out like a dory. A lighter timber liner extrusion sits inside, a floor slab
// closes the bottom, three plank seam rings (thin outline extrusions) ring the outside, a
// whitewash gunwale ring on top. Thwarts, foredeck, oars, painter and fender as before.
// 1.6 x 4.2 x 0.8 m, bow +Z, keel at y 0. Joint: hull.
export default function (THREE) {
  const g = new THREE.Group();
  const col = (hex, l = 0, s = 0) => new THREE.Color(hex).offsetHSL(0, s, l);
  const mat = (hex, name, rough, l = 0, s = 0, metal = 0, side) => {
    const m = new THREE.MeshStandardMaterial({ color: col(hex, l, s), roughness: rough, metalness: metal, side: side || THREE.FrontSide });
    if (name) m.name = name; return m;
  };
  const DS = THREE.DoubleSide;
  const TEAL = 0x3f8f8a, WHITE = 0xf1e6d2, LIGHT = 0xd4b07a;
  const teal = mat(TEAL, 'timber', 0.7, 0, 0, 0, DS);
  const tealSeam = mat(TEAL, 'timber', 0.66, 0.1, 0, 0, DS);
  const tealDark = mat(TEAL, 'timber', 0.75, -0.1, -0.04, 0, DS);
  const tealTop = mat(TEAL, 'timber', 0.66, 0.08, -0.04);
  const white = mat(WHITE, 'timber', 0.7, 0, 0, 0, DS);
  const whiteTop = mat(WHITE, 'timber', 0.66, 0.04, -0.03);
  const inner = mat(LIGHT, 'timber', 0.8, 0, 0, 0, DS);
  const innerTop = mat(LIGHT, 'timber', 0.76, 0.06, -0.03);
  const oak = mat(0xb8925f, 'timber', 0.78);
  const rope = mat(0xc9b07f, 'fabric', 0.9);
  const iron = mat(0x3a3f46, 'metal', 0.45, 0, 0, 0.25);
  const rubber = mat(0x232528, null, 0.85);
  const add = (parent, geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); parent.add(o); return o;
  };
  const bx = (parent, w, h, d, m, x, y, z, rx, ry, rz) => add(parent, new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz);

  const hull = new THREE.Group(); hull.name = 'boat_hull'; hull.position.set(0, 0.25, 0); g.add(hull);
  const H = new THREE.Group(); H.position.y = -0.25; hull.add(H);
  const TOP = 0.56;
  // Plan outline at the gunwale, in shape coords (x = beam, y = -length so +Z is the bow after
  // the flat rotation). Half beam as a function of z.
  const hb = (z) => { const u = Math.min(1, Math.max(0, (z + 2.1) / 4.2)); if (u > 0.5) { const t = (u - 0.5) / 0.5; return 0.8 * (Math.sqrt(Math.max(0, 1 - t * t)) * 0.96 + 0.04); } return 0.8 * (0.66 + 0.34 * Math.sqrt(u / 0.5)); };
  const outline = (inset, zBack, zFront) => {
    const s = new THREE.Shape(); const pts = [];
    for (let z = zBack; z <= zFront - 0.001; z += 0.3) pts.push([Math.max(0.02, hb(z) - inset), z]);
    pts.push([Math.max(0.02, hb(zFront) - inset), zFront]);
    s.moveTo(-pts[0][0], -pts[0][1]);
    for (const p of pts) s.lineTo(-p[0], -p[1]);
    s.lineTo(0, -zFront - 0.02 + inset);
    for (let i = pts.length - 1; i >= 0; i--) s.lineTo(pts[i][0], -pts[i][1]);
    s.closePath();
    return s;
  };
  // Flare: scale x about the centreline and z about the boat centre by a factor growing with y.
  const flare = (geo, k0, k1, yTop) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const t = Math.min(1, Math.max(0, y / yTop)); const k = k0 + (k1 - k0) * t;
      const sheer = z > 0 ? (z / 2.1) * (z / 2.1) * 0.22 * t : (-z / 2.1) * 0.05 * t;
      p.setXYZ(i, x * k, y + sheer, z * (0.985 + 0.015 * t));
    }
    p.needsUpdate = true; geo.computeVertexNormals(); return geo;
  };
  // Extrude lying flat: shape x -> world x, shape y -> world -z (rotation.x = -PI/2), depth -> +y.
  const flat = (shapes, depth, m, y, k0, k1) => {
    const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0);
    flare(geo, k0, k1, TOP);
    return add(H, geo, m, 0, 0, 0);
  };
  const wall = outline(0, -2.1, 2.1); wall.holes.push(outline(0.045, -2.06, 2.05));
  flat([wall], TOP - 0.03, teal, 0.03, 0.74, 1.0);
  const liner = outline(0.04, -2.06, 2.05); liner.holes.push(outline(0.075, -2.03, 2.02));
  flat([liner], TOP - 0.09, inner, 0.06, 0.74, 1.0);
  flat([outline(0.04, -2.06, 2.05)], 0.05, innerTop, 0.04, 0.745, 0.745);   // floor slab
  flat([outline(0.02, -2.1, 2.1)], 0.045, tealDark, 0.0, 0.7, 0.72);           // bottom plank, darker base
  // Plank seam rings at three heights, thin outline extrusions standing 1 cm proud.
  for (const y of [0.16, 0.3, 0.44]) { const r = outline(-0.012, -2.1, 2.1); r.holes.push(outline(0.0, -2.08, 2.08)); const k = 0.74 + 0.26 * (y / TOP); flat([r], 0.025, tealSeam, y, k, k + 0.012); }
  // Gunwale ring and cap.
  const gw = outline(-0.06, -2.12, 2.12); gw.holes.push(outline(0.03, -2.06, 2.06));
  flat([gw], 0.08, white, TOP - 0.06, 1.0, 1.02);
  const gc = outline(-0.07, -2.12, 2.12); gc.holes.push(outline(0.02, -2.06, 2.06));
  flat([gc], 0.02, whiteTop, TOP + 0.02, 1.02, 1.02);
  // Thwarts, stern seat, foredeck.
  for (const z of [-0.9, 0.1, 1.0]) { const w = hb(z) * 2 * 0.85 * 0.9; bx(H, w, 0.05, 0.26, teal, 0, 0.32, z); bx(H, w - 0.02, 0.012, 0.24, tealTop, 0, 0.35, z); }
  bx(H, hb(-1.85) * 2 * 0.8, 0.05, 0.35, teal, 0, 0.34, -1.85);
  const fore = new THREE.CylinderGeometry(0.0, 0.58, 0.05, 3, 1); fore.rotateY(Math.PI / 6);
  const fm = add(H, fore, innerTop, 0, TOP + 0.1, 1.72); fm.scale.set(1, 1, 1.2);
  // Oars, stem, fender loop, painter.
  for (const s of [-1, 1]) {
    const o = new THREE.Group(); o.position.set(s * 0.3, 0.42, 0.2); o.rotation.set(0.02, s * 0.06, 0); H.add(o);
    add(o, new THREE.CylinderGeometry(0.025, 0.025, 2.2, 8), oak, 0, 0, 0.1, Math.PI / 2, 0, 0);
    bx(o, 0.14, 0.03, 0.55, oak, 0, 0, -1.25);
    add(o, new THREE.CylinderGeometry(0.035, 0.035, 0.08, 8), iron, 0, 0, 0.4, Math.PI / 2, 0, 0);
  }
  bx(H, 0.08, 0.3, 0.1, teal, 0, TOP + 0.16, 2.1);
  add(H, new THREE.TorusGeometry(0.11, 0.03, 6, 12), rubber, 0, TOP + 0.02, 2.16);
  add(H, new THREE.TorusGeometry(0.16, 0.025, 6, 12, Math.PI * 1.5), rope, 0.32, TOP + 0.02, 1.72, 0, Math.PI / 2, 0.4);
  add(H, new THREE.TorusGeometry(0.1, 0.025, 6, 10), rope, 0.34, TOP - 0.14, 1.66, 0, Math.PI / 2, 0);

  g.userData.joints = { hull };

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
