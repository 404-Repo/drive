// pit_toolcart c1 (pass 2: body depth 0.55, hose hook moved inside the tray): profile sweeps. Body and drawers are rounded rectangle plan shapes
// extruded upward (bevelEnabled false), the tray rim is an extruded ring shape, the tyres
// are LatheGeometry sections with a shoulder, the hose is a TubeGeometry along a helix,
// the push handle a TubeGeometry along a U path, the castors are lathes.
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
  const rrect = (w, d, r) => {
    const s = new THREE.Shape(); const hw = w / 2, hd = d / 2;
    s.moveTo(-hw + r, -hd); s.lineTo(hw - r, -hd); s.absarc(hw - r, -hd + r, r, -PI / 2, 0, false);
    s.lineTo(hw, hd - r); s.absarc(hw - r, hd - r, r, 0, PI / 2, false);
    s.lineTo(-hw + r, hd); s.absarc(-hw + r, hd - r, r, PI / 2, PI, false);
    s.lineTo(-hw, -hd + r); s.absarc(-hw + r, -hd + r, r, PI, 3 * PI / 2, false);
    return s;
  };
  const rrectPath = (w, d, r) => { const p = new THREE.Path(); p.curves = rrect(w, d, r).curves; return p; };
  const ring = (w, d, r, t) => { const s = rrect(w, d, r); s.holes.push(rrectPath(w - 2 * t, d - 2 * t, Math.max(0.005, r - t))); return s; };
  // plan shape extruded upward from y, or a face shape extruded toward +Z from z
  const slab = (parent, shape, h, m, x, y, z) => mesh(parent, new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 3 }), m, x, y, z, -PI / 2, 0, 0);
  const plate = (parent, shape, t, m, x, y, z) => mesh(parent, new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 3 }), m, x, y, z);
  const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg || 20);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const DS = { side: THREE.DoubleSide };
  const body = mat('timber', 0xd6402f, 0.7, 0);
  const bodyEdge = mat('timber', 0xe0564a, 0.68, 0);
  const bodyTop = mat('timber', 0xe25f52, 0.66, 0);
  const bodyBase = mat('timber', 0xaf3526, 0.75, 0);
  const frame = mat('timber', 0xc63a2a, 0.72, 0);
  const drawer = mat('timber', 0x3f8f8a, 0.72, 0);
  const drawer2 = mat('timber', 0x3a8580, 0.74, 0);
  const drawer3 = mat('timber', 0x44978f, 0.72, 0);
  const drawerEdge = mat('timber', 0x52a29d, 0.7, 0);
  const dark = mat('metal', 0x3a3f46, 0.45, 0.25, DS);
  const darkL = mat('metal', 0x4c525c, 0.45, 0.25, DS);
  const tray = mat('metal', 0x30343a, 0.5, 0.2);
  const rubber = mat(null, 0x232528, 0.85, 0, DS);
  const tread = mat(null, 0x2d3035, 0.85, 0, DS);
  const hose = mat('fabric', 0x4a9a93, 0.75, 0);

  const W = 0.78, D = 0.55, Y0 = 0.13, H = 0.67;
  // body in two courses, rounded plan
  slab(g, rrect(W, D, 0.04), 0.25, bodyBase, 0, Y0, 0);
  slab(g, rrect(W, D, 0.04), H - 0.25 - 0.03, body, 0, Y0 + 0.25, 0);
  slab(g, rrect(W - 0.01, D - 0.01, 0.04), 0.03, bodyEdge, 0, Y0 + H - 0.03, 0);
  // tray floor and rim ring with a lighter top ring
  slab(g, rrect(W - 0.06, D - 0.06, 0.03), 0.02, tray, 0, Y0 + H, 0);
  slab(g, ring(W + 0.04, D + 0.04, 0.06, 0.05), 0.05, bodyEdge, 0, Y0 + H, 0);
  slab(g, ring(W + 0.044, D + 0.044, 0.062, 0.054), 0.012, bodyTop, 0, Y0 + H + 0.05, 0);
  // drawer frame plate on the +Z face and three drawer fronts
  const FZ = D / 2;
  plate(g, ring(W - 0.06, H - 0.08, 0.02, 0.04), 0.02, frame, 0, Y0 + 0.02 + (H - 0.08) / 2, FZ);
  const drawers = [[0.60, 0.16, drawer], [0.40, 0.18, drawer2], [0.19, 0.19, drawer3]];
  for (const [dy, dh, dm] of drawers) {
    plate(g, rrect(W - 0.14, dh, 0.02), 0.03, dm, 0, dy + dh / 2, FZ + 0.015);
    plate(g, rrect(W - 0.16, 0.02, 0.008), 0.032, drawerEdge, 0, dy + dh - 0.012, FZ + 0.016);
    mesh(g, lathe([[0, 0], [0.028, 0], [0.025, 0.03], [0.018, 0.04], [0.018, 0.05], [0, 0.05]], 12), dark, 0, dy + dh / 2, FZ + 0.035, PI / 2);
  }
  // tyres: lathe sections, axis Y for the flat ones
  const tyrePts = [[0.06, -0.04], [0.11, -0.04], [0.14, -0.025], [0.15, 0], [0.14, 0.025], [0.11, 0.04], [0.06, 0.04]];
  const tyre = lathe(tyrePts, 20);
  const hub = lathe([[0, -0.015], [0.055, -0.015], [0.065, 0], [0.055, 0.015], [0, 0.015]], 14);
  const TY = Y0 + H + 0.02;
  mesh(g, tyre, rubber, -0.18, TY + 0.04, -0.02); mesh(g, hub, dark, -0.18, TY + 0.04, -0.02);
  mesh(g, tyre, tread, -0.16, TY + 0.12, 0.0); mesh(g, hub, darkL, -0.16, TY + 0.12, 0.0);
  mesh(g, tyre, rubber, 0.14, TY + 0.15, -0.02, PI / 2, 0.25, 0); mesh(g, hub, dark, 0.14, TY + 0.15, -0.02, PI / 2, 0.25, 0);
  // hose: helix tube on a hook
  const hp = []; const turns = 2.5, n = 40;
  for (let i = 0; i <= n; i++) { const t = i / n; const a = t * turns * 2 * PI; hp.push(V(0.30 + Math.cos(a) * 0.075, TY + 0.10 + Math.sin(a) * 0.075, -0.20 + t * 0.10)); }
  mesh(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp), 48, 0.02, 6, false), hose, 0, 0, 0);
  mesh(g, new THREE.CylinderGeometry(0.012, 0.012, 0.20, 8), dark, 0.30, TY + 0.10, -0.18, PI / 2);
  mesh(g, new THREE.CylinderGeometry(0.012, 0.012, 0.11, 8), dark, 0.30, TY + 0.045, -0.27);
  // castors: lathe wheel (axis X) with a fork lathe and stem
  const wheel = lathe([[0, -0.025], [0.045, -0.025], [0.06, -0.015], [0.06, 0.015], [0.045, 0.025], [0, 0.025]], 14);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cx = sx * (W / 2 - 0.10), cz = sz * (D / 2 - 0.09);
    mesh(g, wheel, rubber, cx, 0.06, cz, 0, 0, PI / 2);
    mesh(g, lathe([[0, -0.03], [0.03, -0.03], [0.03, 0.03], [0, 0.03]], 10), darkL, cx, 0.06, cz, 0, 0, PI / 2);
    mesh(g, lathe([[0, 0], [0.045, 0], [0.045, 0.05], [0.02, 0.05], [0.02, 0.08], [0, 0.08]], 10), dark, cx, 0.075, cz);
  }
  // push handle: U tube on the +X side
  const HX = W / 2, HY = Y0 + 0.44;
  const hpath = new THREE.CatmullRomCurve3([V(HX - 0.02, HY, -0.20), V(HX + 0.08, HY, -0.20), V(HX + 0.12, HY, -0.16), V(HX + 0.12, HY, 0.16), V(HX + 0.08, HY, 0.20), V(HX - 0.02, HY, 0.20)], false, 'catmullrom', 0.2);
  mesh(g, new THREE.TubeGeometry(hpath, 24, 0.02, 8, false), dark, 0, 0, 0);
  for (const sz of [-0.20, 0.20]) mesh(g, lathe([[0, 0], [0.032, 0], [0.032, 0.02], [0, 0.02]], 10), darkL, HX, HY, sz, 0, 0, -PI / 2);

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
