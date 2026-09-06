// agave_cluster c0: extruded leaves. Eighteen leaves in three rings (seven lying low, six at
// 45 degrees, five upright), each an ExtrudeGeometry of a tapered pointed outline, 0.25 m wide
// at the base, bent outward along its length after construction. The painted edge is a thinner
// lighter leafOuter extrusion of the full outline with a narrower darker slab on top of it, so the
// light rim shows all round. Dark centre cone, sand fillet at the base.
export default function (THREE) {
  const g = new THREE.Group();
  const M = (name, color, roughness, extra) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness, metalness: 0 }, extra || {})); m.name = name; return m; };
  const put = (geo, mat, x, y, z, rx, ry, rz, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); (parent || g).add(m); return m; };

  const leaf = M('foliage', 0x4f8a55, 0.8);
  const leafB = M('foliage', 0x4a8450, 0.8);
  const edge = M('foliage', 0x76ad78, 0.75);
  const centre = M('foliage', 0x2f5e3a, 0.85);
  const sand = M('ground', 0xe6cf9c, 0.9);

  const leafShape = (w, L) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(-w * 0.53, L * 0.15); s.lineTo(-w * 0.46, L * 0.4); s.lineTo(-w * 0.3, L * 0.7); s.lineTo(-w * 0.12, L * 0.9); s.lineTo(0, L);
    s.lineTo(w * 0.12, L * 0.9); s.lineTo(w * 0.3, L * 0.7); s.lineTo(w * 0.46, L * 0.4); s.lineTo(w * 0.53, L * 0.15); s.lineTo(w / 2, 0); s.closePath();
    return s;
  };
  const bent = (geo, L, bend) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = p.getY(i) / L; p.setZ(i, p.getZ(i) - bend * t * t); }
    geo.computeVertexNormals();
    return geo;
  };
  const leafPair = (w, L, bend) => ({
    leafOuter: bent(new THREE.ExtrudeGeometry(leafShape(w, L), { depth: 0.035, bevelEnabled: false }), L, bend),
    inner: bent(new THREE.ExtrudeGeometry(leafShape(w * 0.78, L * 0.96), { depth: 0.06, bevelEnabled: false }), L, bend),
  });
  const rings = [
    { n: 7, L: 1.0, w: 0.25, pitch: 1.25, r: 0.1, y: 0.05, bend: 0.25, off: 0.0 },
    { n: 6, L: 1.0, w: 0.25, pitch: 0.8, r: 0.08, y: 0.06, bend: 0.2, off: 0.45 },
    { n: 5, L: 1.12, w: 0.22, pitch: 0.28, r: 0.05, y: 0.06, bend: 0.12, off: 0.2 },
  ];
  rings.forEach((R, ri) => {
    const pair = leafPair(R.w, R.L, R.bend);
    for (let i = 0; i < R.n; i++) {
      const a = i * Math.PI * 2 / R.n + R.off;
      const j = new THREE.Group();
      j.position.set(Math.cos(a) * R.r, R.y, Math.sin(a) * R.r);
      j.rotation.order = 'YXZ';
      j.rotation.set(-R.pitch, -a + Math.PI / 2, 0);
      g.add(j);
      // the leaf shape is in XY with length along +y; extrude depth along +z is the leaf back
      put(pair.leafOuter, edge, 0, 0, -0.0175, 0, 0, 0, j);
      put(pair.inner, (i + ri) % 2 ? leaf : leafB, 0, 0.02, -0.03, 0, 0, 0, j);
    }
  });
  put(new THREE.ConeGeometry(0.12, 0.5, 8), centre, 0, 0.3, 0);
  put(new THREE.CylinderGeometry(0.62, 0.7, 0.06, 14), sand, 0, 0.03, 0);

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
