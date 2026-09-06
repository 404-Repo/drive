// harbour_wall_module c0: primitive assembly, block by block. 6 x 6 x 2.6 m, long axis X,
// sea is +Z. A battered seaward face (10 degrees) of running bond blocks 1.2 x 0.55 with a
// stone shade base course, a rounded parapet lip, a 2.5 m cap walkway, one step down and a
// lower quay ledge on the landward side, each riser in blocks, ends jointed, a teal mooring
// post on the cap. Every up face bleached, every long convex edge a lighter strip.
export default function (THREE) {
  const g = new THREE.Group();
  const col = (hex, l = 0, s = 0) => new THREE.Color(hex).offsetHSL(0, s, l);
  const mat = (hex, name, rough, l = 0, s = 0) => {
    const m = new THREE.MeshStandardMaterial({ color: col(hex, l, s), roughness: rough, metalness: 0 });
    m.name = name; return m;
  };
  const STONE = 0xcdb897, SHADE = 0x8d7b63, TEAL = 0x3f8f8a;
  const stone = [mat(STONE, 'stone', 0.8), mat(STONE, 'stone', 0.82, -0.03), mat(STONE, 'stone', 0.78, 0.03, -0.02)];
  const stoneTop = mat(STONE, 'stone', 0.75, 0.08, -0.05);
  const stoneEdge = mat(STONE, 'stone', 0.75, 0.11);
  const shade = mat(SHADE, 'stone', 0.86);
  const shadeB = mat(SHADE, 'stone', 0.86, -0.03);
  const mortar = mat(SHADE, 'stone', 0.9, -0.06);
  const teal = mat(TEAL, 'timber', 0.7);
  const tealTop = mat(TEAL, 'timber', 0.68, 0.09, -0.04);
  const add = (parent, geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); parent.add(o); return o;
  };
  const bx = (parent, w, h, d, m, x, y, z, rx, ry, rz) => add(parent, new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz);
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = () => stone[Math.floor(rnd() * 3)];

  const L = 6, BL = 1.2, GAP = 0.03;
  // Running bond course of blocks on a plane facing +Z (local), from x = -L/2 to L/2.
  // Returns nothing; the parent group is placed and rotated to the face.
  const course = (parent, y0, h, depth, m, odd, edge) => {
    const xs = [];
    if (odd) { xs.push([-L / 2, BL / 2]); for (let x = -L / 2 + BL / 2; x < L / 2 - 0.01; x += BL) xs.push([x, Math.min(BL, L / 2 - x)]); }
    else for (let x = -L / 2; x < L / 2 - 0.01; x += BL) xs.push([x, BL]);
    for (const [x0, len] of xs) {
      const inset = rnd() * 0.02;
      const mm = m || pick();
      bx(parent, len - GAP, h - GAP, depth - inset, mm, x0 + len / 2, y0 + h / 2, -(depth - inset) / 2);
      if (edge) bx(parent, len - GAP, 0.04, 0.04, edge, x0 + len / 2, y0 + h - 0.02, -0.02 - inset);
    }
  };

  // Seaward face: pivot at the base line z = 3, leaning back 10 degrees (top toward -Z).
  const face = new THREE.Group(); face.position.set(0, 0, 3.0); face.rotation.x = -10 * Math.PI / 180; g.add(face);
  course(face, 0, 0.6, 0.5, shade, false, null);            // base band, the water line
  course(face, 0.6, 0.55, 0.5, null, true, stoneEdge);
  course(face, 1.15, 0.55, 0.5, null, false, stoneEdge);
  course(face, 1.7, 0.55, 0.5, null, true, stoneEdge);
  // Parapet lip: a box and a round top along X.
  bx(face, L, 0.2, 0.4, stone[0], 0, 2.25 + 0.1, -0.2);
  add(face, new THREE.CylinderGeometry(0.2, 0.2, L, 14), stoneTop, 0, 2.45, -0.2, 0, 0, Math.PI / 2);
  // Mortar backing behind the face blocks so the gaps read dark.
  bx(face, L, 2.45, 0.1, mortar, 0, 1.225, -0.5);

  // Cap walkway and the mass beneath it (z from -0.29 to 2.2).
  bx(g, L, 2.0, 2.5, stone[0], 0, 1.0, 0.96);
  bx(g, L, 0.2, 2.5, stoneTop, 0, 2.1, 0.96);
  bx(g, L, 0.05, 0.05, stoneEdge, 0, 2.2 - 0.025, -0.29 + 0.025);
  for (const x of [-1.0, 1.0]) bx(g, 0.03, 0.012, 2.4, mortar, x, 2.2, 0.96);
  bx(g, 0.03, 0.012, 2.4, mortar, -3 + 0.6, 2.2, 0.96);   // paver joint near the end

  // Step: y 0..1.6, z -1.19..-0.29. Riser blocks above the ledge.
  bx(g, L, 1.6, 0.9, stone[1], 0, 0.8, -0.74);
  bx(g, L, 0.62, 0.02, mortar, 0, 1.3, -1.19 + 0.26);
  bx(g, L, 0.06, 0.9, stoneTop, 0, 1.6 - 0.03, -0.74);
  bx(g, L, 0.05, 0.05, stoneEdge, 0, 1.6 - 0.025, -1.19 + 0.025);
  const riser1 = new THREE.Group(); riser1.position.set(0, 0, -1.19); riser1.rotation.y = Math.PI; g.add(riser1);
  course(riser1, 1.0, 0.57, 0.25, null, true, null);
  // Ledge: y 0..1.0, z -3..-1.19. Riser at z = -3 in a shade base course and one stone course.
  bx(g, L, 1.0, 1.81, stone[1], 0, 0.5, -2.095);
  bx(g, L, 1.0, 0.02, mortar, 0, 0.5, -3.0 + 0.26);
  bx(g, L, 0.06, 1.81, stoneTop, 0, 1.0 - 0.03, -2.095);
  bx(g, L, 0.05, 0.05, stoneEdge, 0, 1.0 - 0.025, -3 + 0.025);
  for (const x of [-1.8, 0.6]) bx(g, 0.03, 0.012, 1.7, mortar, x, 1.0, -2.095);
  const riser2 = new THREE.Group(); riser2.position.set(0, 0, -3.0); riser2.rotation.y = Math.PI; g.add(riser2);
  course(riser2, 0, 0.6, 0.25, shade, false, null);
  course(riser2, 0.6, 0.37, 0.25, null, true, stoneEdge);

  // Ends (x = +-3): the profile is solid, jointed with dark lines and a shade base band.
  for (const s of [-1, 1]) {
    const x = s * 3.0;
    bx(g, 0.012, 0.6, 5.98, shadeB, x + s * 0.006, 0.3, 0.0);
    // course lines
    for (const [y, z0, z1] of [[0.6, -3, 2.9], [1.15, -1.19, 2.8], [1.7, -0.29, 2.7]]) bx(g, 0.02, 0.03, z1 - z0, mortar, x + s * 0.01, y, (z0 + z1) / 2);
    // vertical joints, staggered per course
    for (const [y0, y1, zs] of [[0.6, 1.15, [-0.5, 0.7, 1.9]], [1.15, 1.7, [0.1, 1.3, 2.4]], [1.7, 2.2, [0.6, 1.8]]])
      for (const z of zs) bx(g, 0.02, y1 - y0, 0.03, mortar, x + s * 0.01, (y0 + y1) / 2, z);
    for (const z of [-2.4, -1.6]) bx(g, 0.02, 0.4, 0.03, mortar, x + s * 0.01, 0.8, z);
  }

  // Mooring post on the cap, square teal timber with a bleached cap and edge strips.
  bx(g, 0.3, 0.38, 0.3, teal, 1.6, 2.2 + 0.19, 1.2);
  bx(g, 0.32, 0.05, 0.32, tealTop, 1.6, 2.2 + 0.38 - 0.025, 1.2);

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
