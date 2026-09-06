// stone_guardwall c2: a second reading of the reference as a wall of individually chamfered blocks. Every block is a
// hand built prism whose (z, y) profile has 1.5 cm chamfers on its top corners, so the painted edge is a real face and
// the running bond reads at 40 m. Blocks wrap the open end as headers. The cap and the pier cap are chamfered prisms
// with bleached top faces. 4.0 x 0.54 x 0.98 overall (wall 0.42 thick, cap 0.50 wide, pier 0.50 with a 0.54 cap slab).
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
  // prism: closed convex [z, y] profile, clockwise seen from +X (bottom from minus z to plus z, then up), swept x0..x1.
  // roles maps edge index -> material; caps take the base material.
  const prism = (pts, x0, x1, base, roles) => {
    const buckets = new Map();
    const push = (m, tri) => { if (!buckets.has(m)) buckets.set(m, []); buckets.get(m).push(...tri); };
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const m = (roles && roles[i]) || base;
      const p00 = [x0, a[1], a[0]], p01 = [x1, a[1], a[0]], p10 = [x0, b[1], b[0]], p11 = [x1, b[1], b[0]];
      push(m, [...p00, ...p11, ...p10, ...p00, ...p01, ...p11]);
    }
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
  // chamferBox: a box whose four top edges carry a chamfer ch; bottom and sides in base, chamfer faces in edge, top in top
  const chamferBox = (xc, yc, zc, sx, sy, sz, ch, base, top, edge) => {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const B = [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]];          // bottom ring
    const M = [[-hx, hy - ch, -hz], [hx, hy - ch, -hz], [hx, hy - ch, hz], [-hx, hy - ch, hz]];  // top of the vertical sides
    const T = [[-hx + ch, hy, -hz + ch], [hx - ch, hy, -hz + ch], [hx - ch, hy, hz - ch], [-hx + ch, hy, hz - ch]];  // top face
    const buckets = new Map();
    const tri = (m, a, b, c) => { if (!buckets.has(m)) buckets.set(m, []); buckets.get(m).push(a[0] + xc, a[1] + yc, a[2] + zc, b[0] + xc, b[1] + yc, b[2] + zc, c[0] + xc, c[1] + yc, c[2] + zc); };
    const quad = (m, a, b, c, d) => { tri(m, a, c, b); tri(m, a, d, c); };
    quad(base, B[0], B[3], B[2], B[1]);                 // bottom, facing down
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      quad(base, B[i], B[j], M[j], M[i]);               // side, outward: ring is clockwise seen from above so this faces out
      quad(edge, M[i], M[j], T[j], T[i]);               // chamfer
    }
    quad(top, T[0], T[1], T[2], T[3]);                  // top, facing up
    for (const [m, arr] of buckets) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      geo.computeVertexNormals();
      g.add(new THREE.Mesh(geo, m));
    }
  };
  const block = (xc, yc, zc, lx, ly, lz, base, top, edge, ch) => chamferBox(xc, yc, zc, lx, ly, lz, ch, base, top, edge);

  const STONE = 0xcdb897, SHADE = 0x8d7b63;
  const joint = mat('stone', SHADE, 0.9);
  const baseBand = mat('stone', tint(SHADE, 0.92, true), 0.9);
  const capM = mat('stone', tint(STONE, 1.06), 0.8);
  const capTop = mat('stone', tint(STONE, 1.2), 0.8);
  const capEdge = mat('stone', tint(STONE, 1.16), 0.8);
  const fs = [0.96, 1.0, 1.04, 1.07];
  const bodyM = fs.map((f) => mat('stone', tint(STONE, f), 0.85));
  const topM = fs.map((f) => mat('stone', tint(STONE, f * 1.14), 0.85));
  const edgeM = fs.map((f) => mat('stone', tint(STONE, f * 1.10), 0.85));

  const WX0 = -1.45, WX1 = 2.0, WL = WX1 - WX0, WXC = (WX0 + WX1) / 2;
  const T = 0.42, BASE_H = 0.20, CAP_Y0 = 0.78, CAP_H = 0.12;

  // base band with a chamfered top edge
  prism([[-T / 2 - 0.01, 0], [T / 2 + 0.01, 0], [T / 2 + 0.01, BASE_H - 0.015], [T / 2 - 0.005, BASE_H], [-T / 2 + 0.005, BASE_H], [-T / 2 - 0.01, BASE_H - 0.015]], WX0, WX1, baseBand);
  // core in joint colour
  prism([[-T / 2 + 0.02, BASE_H], [T / 2 - 0.02, BASE_H], [T / 2 - 0.02, CAP_Y0], [-T / 2 + 0.02, CAP_Y0]], WX0 + 0.01, WX1 - 0.01, joint);
  // blocks, running bond, one header block at the open end per course
  const courseH = (CAP_Y0 - BASE_H) / 3, gap = 0.015;
  for (let ci = 0; ci < 3; ci++) {
    const y = BASE_H + courseH * (ci + 0.5);
    const offset = ci % 2 ? 0.3 : 0;
    let x = WX0, k = ci;
    if (offset) { block(WX0 + 0.15, y, 0, 0.3 - gap, courseH - gap, T, bodyM[k % 4], topM[k % 4], edgeM[k % 4], 0.015); x += 0.3; k++; }
    while (x < WX1 - 0.02) {
      const len = Math.min(0.6, WX1 - x);
      block(x + len / 2, y, 0, len - gap, courseH - gap, T, bodyM[k % 4], topM[k % 4], edgeM[k % 4], 0.015);
      x += len; k++;
    }
  }
  // cap: chamfered profile 0.54 wide, bleached top face
  prism([[-0.25, CAP_Y0], [0.25, CAP_Y0], [0.25, CAP_Y0 + CAP_H - 0.05], [0.20, CAP_Y0 + CAP_H], [-0.20, CAP_Y0 + CAP_H], [-0.25, CAP_Y0 + CAP_H - 0.05]],
    WX0 - 0.01, WX1 + 0.01, capM, { 2: capEdge, 3: capTop, 4: capEdge });

  // pier: base band, joint core, three chamfered blocks, chamfered cap slab
  const PX = -1.75, PS = 0.50;
  const pierBlock = (yc, ly, s, base, top, edge, ch) => chamferBox(PX, yc, 0, s, ly, s, ch, base, top, edge);
  prism([[-PS / 2 - 0.02, 0], [PS / 2 + 0.02, 0], [PS / 2 + 0.02, BASE_H - 0.015], [PS / 2 + 0.005, BASE_H], [-PS / 2 - 0.005, BASE_H], [-PS / 2 - 0.02, BASE_H - 0.015]], PX - PS / 2 - 0.02, PX + PS / 2 + 0.02, baseBand);
  const pierCourse = (0.88 - BASE_H) / 3;
  for (let i = 0; i < 3; i++) {
    const y = BASE_H + pierCourse * (i + 0.5);
    pierBlock(y, pierCourse - gap, PS, bodyM[(i + 1) % 4], topM[(i + 1) % 4], edgeM[(i + 1) % 4], 0.015);
  }
  pierBlock(0.93, 0.10, 0.54, capM, capTop, capEdge, 0.03);

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
