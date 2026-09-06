// kerb_module c2: hand built BufferGeometry prisms. Each part is a closed (z, y) polygon swept from x0 to x1,
// and every profile edge becomes its own quad so the chamfer face and the top face can be separate meshes in
// lighter tints with no proud plates and no coplanar seams. Softened corners are real small chamfers in the profile.
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (name, hex, rough, metal, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: metal || 0 }, extra || {}));
    if (name) m.name = name; return m;
  };
  const tint = (hex, f, cool) => {
    const c = new THREE.Color(hex);
    c.r = Math.min(1, c.r * f * (cool ? 0.97 : 1)); c.g = Math.min(1, c.g * f); c.b = Math.min(1, c.b * f * (cool ? 1.05 : 1));
    return c.getHex();
  };
  // profile: array of [z, y] going clockwise seen from plus X (bottom from minus z to plus z, then up). roles: map edgeIndex -> material,
  // anything not listed goes to the base material. Caps (the two X ends) go to the base material too.
  const prism = (pts, x0, x1, base, roles) => {
    const buckets = new Map();
    const push = (m, tri) => { if (!buckets.has(m)) buckets.set(m, []); buckets.get(m).push(...tri); };
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const m = (roles && roles[i]) || base;
      // quad from a to b, x0 to x1; winding so the normal points outward (profile is clockwise seen from +X)
      const p00 = [x0, a[1], a[0]], p01 = [x1, a[1], a[0]], p10 = [x0, b[1], b[0]], p11 = [x1, b[1], b[0]];
      push(m, [...p00, ...p11, ...p10, ...p00, ...p01, ...p11]);
    }
    // caps: fan from vertex 0 (profiles here are convex)
    for (let i = 1; i < n - 1; i++) {
      const a = pts[0], b = pts[i], cpt = pts[i + 1];
      push(base, [x1, a[1], a[0], x1, cpt[1], cpt[0], x1, b[1], b[0]]);
      push(base, [x0, a[1], a[0], x0, b[1], b[0], x0, cpt[1], cpt[0]]);
    }
    for (const [m, arr] of buckets) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      geo.computeVertexNormals();
      g.add(new THREE.Mesh(geo, m));
    }
  };

  const RED = 0xd6402f, WHITE = 0xf1e6d2, STONE = 0xcdb897, SHADE = 0x8d7b63;
  const H = 0.30, BASE = 0.08;

  // base band, darker and cooler, with a 1 cm chamfer on its two long top edges
  prism([[-0.30, 0], [0.30, 0], [0.30, BASE - 0.01], [0.29, BASE], [-0.29, BASE], [-0.30, BASE - 0.01]], -2.0, 2.0, mat('stone', tint(SHADE, 0.9, true), 0.9));
  // joint bed under blocks and stones so the grooves read as shadow
  prism([[-0.285, BASE], [0.285, BASE], [0.285, BASE + 0.012], [-0.285, BASE + 0.012]], -1.99, 1.99, mat('stone', SHADE, 0.9));

  // pavement strip in four stones (running bond offset from the blocks), rounded back edge as a 4.5 cm chamfer
  const stoneCuts = [-2.0, -1.5, -0.5, 0.5, 1.5, 2.0];
  for (let i = 0; i < stoneCuts.length - 1; i++) {
    const x0 = stoneCuts[i] + 0.01, x1 = stoneCuts[i + 1] - 0.01;
    const f = 1 + ((i % 3) - 1) * 0.03;
    const body = mat('stone', tint(STONE, f), 0.85);
    const top = mat('stone', tint(STONE, f * 1.18), 0.85);
    const edge = mat('stone', tint(STONE, f * 1.22), 0.85);
    // clockwise from +X: start bottom inner, go out along the bottom, up the back, over the chamfer, along the top, down the inner face
    prism([[0.16, BASE], [0.30, BASE], [0.30, H - 0.045], [0.255, H], [0.16, H]], x0, x1, body, { 2: edge, 3: top });
  }

  // four blocks, 0.98 long, alternating kerb red and whitewash
  for (let i = 0; i < 4; i++) {
    const x0 = -2.0 + i + 0.01, x1 = x0 + 0.98;
    const base = i % 2 === 0 ? RED : WHITE;
    const f = 1 + (i < 2 ? 0.02 : -0.02);
    const body = mat('stone', tint(base, f), 0.75);
    const top = mat('stone', tint(base, f * 1.16), 0.75);
    const cham = mat('stone', tint(base, f * 1.10), 0.75);
    // clockwise from +X: bottom road corner, bottom inner, up the inner (against the strip), along the top,
    // 2 cm soften, down the 45 degree chamfer, down the short road face
    prism([[-0.30, BASE], [0.16, BASE], [0.16, H], [-0.13, H], [-0.15, H - 0.012], [-0.30, 0.15]], x0, x1, body, { 2: top, 3: cham, 4: cham });
  }

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
