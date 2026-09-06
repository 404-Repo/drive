// spectator_group candidate 1: three gently curved cards (open cylinder sections, concave to the
// road, so the row reads from an oblique angle and never as one flat plane), each row a joint
// group pivoted at its base, on a chamfered dark ground strip. Joints: crowd, row_a, row_b,
// row_c. DoubleSide, unique card colours, u runs along the arc so the cutout maps across.
export default function (THREE) {
  const g = new THREE.Group();
  const PI = Math.PI, DS = THREE.DoubleSide;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const shade = (hex, l, s, cool) => { const c = new THREE.Color(hex); const h = {}; c.getHSL(h); c.setHSL(h.h, clamp(h.s * (s === undefined ? 1 : s)), clamp(h.l * (1 + l))); if (cool) c.lerp(new THREE.Color(0x4a5a78), cool); return c; };
  const M = (name, color, rough, metal, extra) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal || 0 }, extra || {})); if (name) m.name = name; return m; };
  const add = (geo, mat, x, y, z, parent) => { const o = new THREE.Mesh(geo, mat); o.position.set(x || 0, y || 0, z || 0); (parent || g).add(o); return o; };
  const bx = (w, h, d, mat, x, y0, z, parent) => add(new THREE.BoxGeometry(w, h, d), mat, x, y0 + h / 2, z, parent);

  const crowdA = M('card:crowd_a', 0xc98a5a, 0.85, 0, { side: DS });
  const crowdB = M('card:crowd_b', 0xb0786a, 0.85, 0, { side: DS });
  const crowdC = M('card:crowd_c', 0x9a8fb0, 0.85, 0, { side: DS });
  const strip = M('ground', 0x6e665c, 0.85, 0), stripEdge = M('ground', shade(0x6e665c, 0.1), 0.85, 0), stripTop = M('ground', shade(0x6e665c, 0.08, 0.95), 0.85, 0);

  const R = 10, A = 1.5 / R;   // arc radius and half angle: chord 3.0 m, ends 0.11 m toward the road
  const crowd = new THREE.Group(); crowd.name = 'crowd'; g.add(crowd);
  const row = (name, mat, z, y0, h) => {
    const r = new THREE.Group(); r.name = name; r.position.set(0, y0, z); crowd.add(r);
    add(new THREE.CylinderGeometry(R, R, h, 10, 2, true, PI - A, 2 * A), mat, 0, h / 2, R, r);
    return r;
  };
  const rowA = row('row_a', crowdA, 0.08, 0.05, 1.75);
  const rowB = row('row_b', crowdB, -0.06, 0.15, 1.75);
  const rowC = row('row_c', crowdC, -0.2, 0.25, 1.75);
  bx(3.0, 0.04, 0.4, strip, 0, 0, 0);
  bx(3.0, 0.02, 0.36, stripEdge, 0, 0.04, 0);
  bx(2.96, 0.012, 0.32, stripTop, 0, 0.06, 0);
  g.userData.joints = { crowd, row_a: rowA, row_b: rowB, row_c: rowC };

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
