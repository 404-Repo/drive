// rock_cliff_module c1: extruded outlines. Each stratum is an ExtrudeGeometry of an irregular
// 16 point outline (jittered ellipse with the back edge clamped straight, so the back face is
// flat: mounts back), bevel off, 1.2 m deep, laid flat. Strata shift sideways as they rise and
// the fifth reaches out for the overhang. Each carries a thin lighter cap extrusion inset 3
// percent (bleached top). Lower third stone shade. Dark fissure extrusions, grass tufts on
// ledges, an agave of extruded leaves on top.
// Round 2 (triangle budget, 71 placed): the bleached cap of each stratum is a flat shape lying on the
// body's top (its 9 cm sides were hidden inside the stratum above), the agave leaves are 5 point
// outlines with a flat inner leaf. 1266 -> about 700 tris, outline and silhouette unchanged.
export default function (THREE) {
  const g = new THREE.Group();
  const DS = THREE.DoubleSide;
  const M = (name, color, roughness, extra) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness, metalness: 0 }, extra || {})); m.name = name; return m; };
  const put = (geo, mat, x, y, z, rx, ry, rz, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); (parent || g).add(m); return m; };
  const hash = (i, j) => { const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return s - Math.floor(s); };

  const shade = M('stone', 0x8d7b63, 0.85, { flatShading: true });
  const shadeB = M('stone', 0x877558, 0.85, { flatShading: true });
  const warm = M('stone', 0xcdb897, 0.8, { flatShading: true });
  const warmB = M('stone', 0xc6b08f, 0.8, { flatShading: true });
  const cap = M('stone', 0xdccaa8, 0.75, { flatShading: true });
  const capLow = M('stone', 0x9c8a70, 0.8, { flatShading: true });
  const fissure = M('stone', 0x7a6a55, 0.9);
  const grass = M('foliage', 0x9aa64a, 0.9, { side: DS });
  const agave = M('foliage', 0x4f8a45, 0.85);
  const agaveEdge = M('foliage', 0x6aa35c, 0.8);

  const BACK = 3.0; // in shape space the back is +y (world -z after laying flat)
  // an outline in shape space: x is world x, y is world -z
  const outlines = [];   // per layer, world (x, z) points of the body outline, for placing fissures on the face
  const outline = (rx, rz, k, scale, cx) => {
    const s = new THREE.Shape();
    const N = 16;
    const cy = BACK - rz * 0.92;   // ellipse centre so the back edge clamps at the back plane
    const pts = [];
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2;
      const j = (1 + 0.16 * (hash(k, i) - 0.5) * 2) * (scale || 1);
      const px = Math.cos(a) * rx * j, py = Math.min(cy + Math.sin(a) * rz * j, BACK);
      if (i === 0) s.moveTo(px, py); else s.lineTo(px, py);
      pts.push([px + (cx || 0), -py]);
    }
    s.closePath();
    if (!scale) outlines[k] = pts;
    return s;
  };
  // front z of layer k at world x: the largest z where the outline crosses x
  const frontZ = (k, x) => {
    const pts = outlines[k]; let best = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      if ((x >= p[0] && x <= q[0]) || (x >= q[0] && x <= p[0])) {
        const t = Math.abs(q[0] - p[0]) < 1e-6 ? 0 : (x - p[0]) / (q[0] - p[0]);
        best = Math.max(best, p[1] + (q[1] - p[1]) * t);
      }
    }
    return best;
  };
  const slab = (rx, rz, k, h, mat, cx, cz, scale) => {
    const geo = h > 0 ? new THREE.ExtrudeGeometry(outline(rx, rz, k, scale, cx), { depth: h, bevelEnabled: false }) : new THREE.ShapeGeometry(outline(rx, rz, k, scale, cx));
    geo.rotateX(-Math.PI / 2);   // shape y -> world -z, depth -> world +y
    geo.computeVertexNormals();
    return put(geo, mat, cx, 0, cz);
  };
  const layers = [
    { y: 0.0, h: 1.2, rx: 3.8, rz: 3.2, mat: shade, capM: capLow, cx: 0.0 },
    { y: 1.2, h: 1.2, rx: 3.6, rz: 3.0, mat: shadeB, capM: capLow, cx: 0.25 },
    { y: 2.4, h: 1.2, rx: 3.35, rz: 2.8, mat: warm, capM: cap, cx: -0.2 },
    { y: 3.6, h: 1.2, rx: 3.0, rz: 2.5, mat: warmB, capM: cap, cx: 0.3 },
    { y: 4.8, h: 1.2, rx: 3.3, rz: 2.85, mat: warm, capM: cap, cx: -0.35 },
    { y: 6.0, h: 1.0, rx: 2.5, rz: 2.15, mat: warmB, capM: cap, cx: 0.1 },
  ];
  layers.forEach((L, k) => {
    const body = slab(L.rx, L.rz, k, L.h, L.mat, L.cx, 0);
    body.position.set(L.cx, L.y, 0);
    const top = slab(L.rx, L.rz, k, 0, L.capM, L.cx, 0, 0.97);
    top.position.set(L.cx, L.y + L.h + 0.005, 0);
  });
  // fissures
  // fissures: dark strips seated on the face of the layer they sit in, proud by 3 cm
  [[-2.4, 0.2, 1.0], [1.9, 0.1, 1.0], [-0.5, 3.65, 1.05], [2.2, 3.7, 1.0], [0.6, 4.9, 1.05], [-1.5, 6.1, 0.8], [1.2, 1.3, 1.0], [-1.8, 2.45, 1.05]].forEach((f) => {
    const k = Math.min(5, Math.floor(f[1] / 1.2));
    const z = frontZ(k, f[0]);
    if (!isFinite(z)) return;
    put(new THREE.BoxGeometry(0.09, f[2], 0.1), fissure, f[0], f[1] + f[2] / 2, z - 0.02, 0, 0, 0.05 * (f[0] > 0 ? 1 : -1));
  });
  const tuftAt = (x, y, z) => { for (let i = 0; i < 3; i++) put(new THREE.PlaneGeometry(0.7, 0.55), grass, x, y + 0.27, z, 0, i * Math.PI / 3, 0); };
  tuftAt(-2.7, 2.4, 1.6); tuftAt(2.3, 3.6, 1.4); tuftAt(0.9, 6.0, 1.7);
  // agave of extruded leaves on top
  const leafShape = (w, L) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(-w * 0.4, L * 0.5); s.lineTo(0, L);
    s.lineTo(w * 0.4, L * 0.5); s.lineTo(w / 2, 0); s.closePath();
    return s;
  };
  const leafOuter = new THREE.ExtrudeGeometry(leafShape(0.2, 0.75), { depth: 0.03, bevelEnabled: false });
  const inner = new THREE.ShapeGeometry(leafShape(0.15, 0.7));
  const ax = -0.8, az = 0.1, ay = 6.98;
  for (let i = 0; i < 9; i++) {
    const a = i * Math.PI * 2 / 9, pitch = i % 2 ? -0.5 : -0.9;
    const j = new THREE.Group(); j.position.set(ax + Math.cos(a) * 0.12, ay, az + Math.sin(a) * 0.12); j.rotation.order = 'YXZ'; j.rotation.set(pitch, -a + Math.PI / 2, 0); g.add(j);
    put(leafOuter, agaveEdge, 0, 0, -0.015, 0, 0, 0, j);
    put(inner, agave, 0, 0.02, 0.016, 0, 0, 0, j);
  }

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
