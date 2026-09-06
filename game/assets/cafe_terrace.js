// cafe_terrace candidate 0 (pass 2: domed umbrella with a valance): primitive assembly. Plank deck from boxes, pedestal tables from
// cylinders, ladder back chairs from boxes, umbrellas as ten alternating triangle wedges with a
// torus rim, a planter box with sphere foliage, an A frame chalkboard, six seated crowd cards.
export default function (THREE) {
  const g = new THREE.Group();
  const PI = Math.PI, DS = THREE.DoubleSide;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const shade = (hex, l, s, cool) => { const c = new THREE.Color(hex); const h = {}; c.getHSL(h); c.setHSL(h.h, clamp(h.s * (s === undefined ? 1 : s)), clamp(h.l * (1 + l))); if (cool) c.lerp(new THREE.Color(0x4a5a78), cool); return c; };
  const M = (name, color, rough, metal, extra) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal || 0 }, extra || {})); if (name) m.name = name; return m; };
  const fam = (name, hex, rough, metal, extra) => ({ face: M(name, hex, rough, metal, extra), alt: M(name, shade(hex, -0.04), rough, metal, extra), edge: M(name, shade(hex, 0.10), rough, metal, extra), top: M(name, shade(hex, 0.08, 0.95), rough, metal, extra), base: M(name, shade(hex, -0.18, 1, 0.12), rough, metal, extra) });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const add = (geo, mat, x, y, z, parent) => { const o = new THREE.Mesh(geo, mat); o.position.set(x || 0, y || 0, z || 0); (parent || g).add(o); return o; };
  const bx = (w, h, d, mat, x, y0, z, parent) => add(new THREE.BoxGeometry(w, h, d), mat, x, y0 + h / 2, z, parent);
  const cyl = (rt, rb, h, seg, mat, x, y0, z, parent) => add(new THREE.CylinderGeometry(rt, rb, h, seg, 1, false), mat, x, y0 + h / 2, z, parent);
  const tri = (a, b, c, mat) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 1, 0, 0, 1, 0], 2)); geo.computeVertexNormals(); return add(geo, mat, 0, 0, 0); };

  const deckT = fam('timber', 0xcdb897, 0.72, 0);
  const teal = fam('timber', 0x3f8f8a, 0.7, 0);
  const tableT = fam('timber', 0xc4683f, 0.7, 0);
  const metal = fam('metal', 0x3a3f46, 0.45, 0.2);
  const canvasW = fam('fabric', 0xf1e6d2, 0.8, 0, { side: DS });
  const canvasR = fam('fabric', 0xd6402f, 0.8, 0, { side: DS });
  const planter = fam('timber', 0xe0a862, 0.72, 0);
  const leafA = M('foliage', 0x4f8a45, 0.8, 0), leafB = M('foliage', 0x2f5e3a, 0.8, 0), leafC = M('foliage', 0x5f9a4f, 0.8, 0);
  const flower = M('foliage', 0xd8388a, 0.75, 0);
  const board = M(null, 0x2f3336, 0.8, 0);
  const crowd = M('card:crowd_a', 0xc98a5a, 0.85, 0, { side: DS });

  // deck 8 x 6: dark base band, twenty boards running along z, a lighter lip all round
  bx(8, 0.06, 6, deckT.base, 0, 0, 0);
  for (let k = 0; k < 20; k++) bx(0.38, 0.04, 5.9, k % 3 ? deckT.face : deckT.alt, -4 + 0.2 + 0.4 * k, 0.06, 0);
  bx(8, 0.04, 0.06, deckT.edge, 0, 0.06, 2.97); bx(8, 0.04, 0.06, deckT.edge, 0, 0.06, -2.97);
  bx(0.06, 0.04, 6, deckT.edge, 3.97, 0.06, 0); bx(0.06, 0.04, 6, deckT.edge, -3.97, 0.06, 0);

  const table = (x, z) => {
    cyl(0.26, 0.3, 0.05, 14, metal.base, x, 0.1, z);
    cyl(0.035, 0.035, 0.62, 10, metal.face, x, 0.15, z);
    cyl(0.4, 0.4, 0.05, 14, tableT.face, x, 0.77, z);
    cyl(0.4, 0.4, 0.012, 14, tableT.top, x, 0.82, z);
    add(new THREE.TorusGeometry(0.4, 0.02, 6, 20), tableT.edge, x, 0.82, z).rotation.x = PI / 2;
  };
  const chair = (x, z, a) => {
    const c = new THREE.Group(); c.position.set(x, 0.1, z); c.rotation.y = a; g.add(c);
    bx(0.42, 0.04, 0.42, teal.face, 0, 0.44, 0, c); bx(0.42, 0.012, 0.42, teal.top, 0, 0.48, 0, c);
    for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) bx(0.045, 0.44, 0.045, teal.alt, lx, 0, lz, c);
    for (const lx of [-0.18, 0.18]) bx(0.045, 0.5, 0.045, teal.face, lx, 0.48, -0.19, c);
    bx(0.42, 0.07, 0.03, teal.edge, 0, 0.88, -0.19, c); bx(0.42, 0.06, 0.03, teal.face, 0, 0.7, -0.19, c);
    // seated spectator card on the chair, facing the table
    add(new THREE.PlaneGeometry(0.62, 1.05), crowd, 0, 0.525 + 0.02, -0.05, c);
  };
  const tables = [[-2.6, 1.3], [2.4, 1.5], [-1.3, -1.3], [2.6, -1.2]];
  tables.forEach(([tx, tz], i) => {
    table(tx, tz);
    for (const b of [0.25 * PI + i * 0.5, 1.25 * PI + i * 0.5]) {
      const cx = tx + 0.68 * Math.sin(b), cz = tz + 0.68 * Math.cos(b);
      chair(cx, cz, Math.atan2(tx - cx, tz - cz));
    }
  });

  const umbrella = (x, z) => {
    cyl(0.16, 0.18, 0.05, 10, metal.base, x, 0.1, z);
    cyl(0.03, 0.03, 2.1, 10, metal.face, x, 0.15, z);
    // domed canopy: each of ten wedges is three triangles through a mid ring, then a hanging valance flap
    const R = 1.2, RM = 0.68, N = 10, rim = 2.17, mid = 2.42, top = 2.55;
    for (let k = 0; k < N; k++) {
      const a0 = 2 * PI * k / N, a1 = 2 * PI * (k + 1) / N, mt = k % 2 ? canvasW.top : canvasR.face;
      const m0 = [x + RM * Math.sin(a0), mid, z + RM * Math.cos(a0)], m1 = [x + RM * Math.sin(a1), mid, z + RM * Math.cos(a1)];
      const r0 = [x + R * Math.sin(a0), rim, z + R * Math.cos(a0)], r1 = [x + R * Math.sin(a1), rim, z + R * Math.cos(a1)];
      tri([x, top, z], m0, m1, mt); tri(m0, r0, r1, mt); tri(m0, r1, m1, mt);
      tri(r0, r1, [x + (R + 0.02) * Math.sin((a0 + a1) / 2), rim - 0.14, z + (R + 0.02) * Math.cos((a0 + a1) / 2)], k % 2 ? canvasR.alt : canvasW.face);
    }
    add(new THREE.TorusGeometry(R, 0.03, 6, 20), canvasW.edge, x, rim, z).rotation.x = PI / 2;
    add(new THREE.SphereGeometry(0.05, 10, 8), metal.edge, x, 2.58, z);
  };
  umbrella(-2.4, 0.2); umbrella(2.5, 0.35);

  // planter along the back edge with a base band, lip, soil and foliage
  bx(2.0, 0.15, 0.5, planter.base, 0, 0.1, -2.65);
  bx(2.0, 0.38, 0.5, planter.face, 0, 0.25, -2.65);
  bx(2.06, 0.05, 0.56, planter.edge, 0, 0.63, -2.65);
  bx(2.06, 0.012, 0.56, planter.top, 0, 0.68, -2.65);
  bx(1.9, 0.02, 0.4, M('ground', 0x8d7b63, 0.9, 0), 0, 0.66, -2.65);
  [[-0.75, 0.28, leafA], [-0.3, 0.3, leafB], [0.15, 0.27, leafC], [0.6, 0.3, leafA], [0.85, 0.22, leafB], [-0.5, 0.2, leafC]].forEach(([lx, r, mt]) => add(new THREE.SphereGeometry(r, 8, 6), mt, lx, 0.68 + r * 0.8, -2.65 + (lx > 0 ? 0.05 : -0.05)));
  [[-0.6, 0.1], [0.05, 0.09], [0.75, 0.1]].forEach(([lx, r]) => add(new THREE.SphereGeometry(r, 8, 6), flower, lx, 0.95, -2.5));

  // A frame chalkboard near the front
  const e = new THREE.Group(); e.position.set(0.3, 0.1, 1.9); e.rotation.y = -0.3; g.add(e);
  const f = new THREE.Group(); f.rotation.x = -0.18; e.add(f);
  bx(0.56, 0.76, 0.04, teal.face, 0, 0.12, 0.02, f); bx(0.46, 0.62, 0.02, board, 0, 0.19, 0.045, f);
  bx(0.56, 0.05, 0.05, teal.edge, 0, 0.88, 0.02, f);
  for (const sx of [-0.25, 0.25]) { bx(0.05, 0.9, 0.05, teal.alt, sx, 0, 0.02, f); const l = bx(0.05, 0.9, 0.05, teal.alt, sx, 0, -0.02, e); l.rotation.x = 0.22; l.position.z -= 0.1; }

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
