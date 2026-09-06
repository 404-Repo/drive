// boost_pad c1: profile arm. The slab is an extruded rounded rectangle Shape with a second,
// inset rounded rectangle as the bleached top (the rounded edge), the border is an extruded
// rounded ring Shape with a hole, each chevron is one extruded 6 point Shape with a lighter
// extruded top layer. Everything bevelEnabled false, pointing +Z.
export default function (THREE) {
  const g = new THREE.Group();
  const mk = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0.0 }, extra || {}));
  const nm = (m, n) => { m.name = n; return m; };

  const asphalt = nm(mk(0x4d5058, { roughness: 0.9 }), 'ground');
  const asphaltTop = nm(mk(0x585b63, { roughness: 0.88 }), 'ground');
  const asphaltBase = nm(mk(0x3f424a, { roughness: 0.9 }), 'ground');
  const white = nm(mk(0xf1e6d2, { roughness: 0.5, metalness: 0.1 }), 'metal');
  const whiteSide = nm(mk(0xe0d5c1, { roughness: 0.5, metalness: 0.1 }), 'metal');
  const coral = nm(mk(0xed5851, { roughness: 0.5, metalness: 0.1 }), 'metal');
  const coralTop = nm(mk(0xf27a75, { roughness: 0.45, metalness: 0.1 }), 'metal');

  const W = 3.0, L = 4.0, T = 0.044;
  // Shapes are drawn in XY with +Y as the forward (+Z) direction; rotation.x = PI/2 maps
  // local +Y to world +Z and sends the extrusion downward, so each piece is placed at its top.
  const flat = (geo, mat, yTop) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = Math.PI / 2; m.position.y = yTop; g.add(m); return m; };
  const rrect = (w, l, r) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -l / 2); s.lineTo(w / 2 - r, -l / 2); s.quadraticCurveTo(w / 2, -l / 2, w / 2, -l / 2 + r);
    s.lineTo(w / 2, l / 2 - r); s.quadraticCurveTo(w / 2, l / 2, w / 2 - r, l / 2); s.lineTo(-w / 2 + r, l / 2);
    s.quadraticCurveTo(-w / 2, l / 2, -w / 2, l / 2 - r); s.lineTo(-w / 2, -l / 2 + r); s.quadraticCurveTo(-w / 2, -l / 2, -w / 2 + r, -l / 2);
    return s;
  };
  const ex = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 });
  // Slab in three layers: base band, body, bleached inset top (the rounded edge).
  flat(ex(rrect(W, L, 0.12), 0.012), asphaltBase, 0.012);
  flat(ex(rrect(W - 0.03, L - 0.03, 0.11), T - 0.02), asphalt, T - 0.008);
  flat(ex(rrect(W - 0.1, L - 0.1, 0.09), 0.008), asphaltTop, T);
  // Border: rounded ring, 8 cm wide, 0.1 in from the edge.
  const ring = rrect(W - 0.2, L - 0.2, 0.09);
  const hole = rrect(W - 0.36, L - 0.36, 0.06);
  ring.holes.push(new THREE.Path(hole.getPoints(4)));
  flat(ex(ring, 0.006), white, T + 0.006);
  // Chevron shape: 6 points, 2.4 wide, 0.6 deep (arm 0.28 thick, rise 0.32).
  const half = 1.2, rise = 0.32, armT = 0.28;
  const chev = (shrink) => {
    const s = new THREE.Shape();
    const h = half - shrink, t = armT - 2 * shrink, r = rise * (h / half);
    s.moveTo(-h, 0); s.lineTo(0, r); s.lineTo(h, 0); s.lineTo(h, t); s.lineTo(0, r + t); s.lineTo(-h, t); s.closePath();
    return s;
  };
  const chevGeo = ex(chev(0), 0.02), chevTopGeo = ex(chev(0.05), 0.004);
  const pitch = 0.72, z0 = -1.35 - rise / 2;
  for (let i = 0; i < 4; i++) {
    const zc = z0 + i * pitch;
    const a = flat(chevGeo, i % 2 ? whiteSide : coral, T + 0.02); a.position.z = zc;
    const b = flat(chevTopGeo, i % 2 ? white : coralTop, T + 0.024); b.position.z = zc;
  }

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
