// produce_crate_stack candidate 1: profile sweeps. Each crate side is ONE slotted plate (a
// rectangle Shape with two slot holes) extruded 0.02 m, so the gaps are real holes; corner
// posts overlaid in the other colour. Lemons are lathes with a nipple, the net is an extruded
// lattice Shape folded over the crate lip. Same 4 / 3 / 1 stacking, a 2 degree lean.
// Round 2 (triangle budget, 8 placed): lemons as 5 point lathes at 6 segments, the 12 mm post top
// strips dropped (the post tops read from the posts themselves). 5404 -> about 3900 tris.
export default function (THREE) {
  const g = new THREE.Group();
  const PI = Math.PI, DS = THREE.DoubleSide;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const shade = (hex, l, s, cool) => { const c = new THREE.Color(hex); const h = {}; c.getHSL(h); c.setHSL(h.h, clamp(h.s * (s === undefined ? 1 : s)), clamp(h.l * (1 + l))); if (cool) c.lerp(new THREE.Color(0x4a5a78), cool); return c; };
  const M = (name, color, rough, metal, extra) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal || 0 }, extra || {})); if (name) m.name = name; return m; };
  const fam = (name, hex, rough, metal, extra) => ({ face: M(name, hex, rough, metal, extra), alt: M(name, shade(hex, -0.04), rough, metal, extra), edge: M(name, shade(hex, 0.10), rough, metal, extra), top: M(name, shade(hex, 0.08, 0.95), rough, metal, extra), base: M(name, shade(hex, -0.18, 1, 0.12), rough, metal, extra) });
  const add = (geo, mat, x, y, z, parent) => { const o = new THREE.Mesh(geo, mat); o.position.set(x || 0, y || 0, z || 0); (parent || g).add(o); return o; };
  const bx = (w, h, d, mat, x, y0, z, parent) => add(new THREE.BoxGeometry(w, h, d), mat, x, y0 + h / 2, z, parent);
  const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg || 8);
  const rect = (w, h, x0, y0) => { const s = new THREE.Shape(); s.moveTo(x0, y0); s.lineTo(x0 + w, y0); s.lineTo(x0 + w, y0 + h); s.lineTo(x0, y0 + h); s.closePath(); return s; };
  const hole = (s, w, h, x0, y0) => { const p = new THREE.Path(); p.moveTo(x0, y0); p.lineTo(x0 + w, y0); p.lineTo(x0 + w, y0 + h); p.lineTo(x0, y0 + h); p.closePath(); s.holes.push(p); };
  const plate = (shape, t, mat, x, y, z, parent) => add(new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 2 }), mat, x, y, z, parent);

  const teal = fam('timber', 0x3f8f8a, 0.72, 0);
  const wood = fam('timber', 0xe0a862, 0.72, 0);
  const lemon = M('plaster', 0xf2c230, 0.6, 0), lemon2 = M('plaster', 0xe8b52a, 0.6, 0);
  const net = M('fabric', 0xe6cf9c, 0.85, 0, { side: DS });

  const S = new THREE.Group(); S.rotation.z = -0.04; g.add(S);
  const W = 0.6, D = 0.5, H = 0.4, P = 0.05;
  const panel = (w) => { const s = rect(w, H, -w / 2, 0); for (const y of [0.1, 0.25]) hole(s, w - 2 * P, 0.05, -w / 2 + P, y); return s; };
  const crate = (x, y, z, slats, posts, bottom) => {
    const c = new THREE.Group(); c.position.set(x, y, z); S.add(c);
    plate(panel(W), 0.02, bottom ? slats.base : slats.face, 0, 0, D / 2 - 0.02, c);
    plate(panel(W), 0.02, bottom ? slats.base : slats.face, 0, 0, -D / 2, c);
    const l = plate(panel(D - 0.04), 0.02, slats.alt, W / 2, 0, 0, c); l.rotation.y = -PI / 2;
    const r = plate(panel(D - 0.04), 0.02, slats.alt, -W / 2 + 0.02, 0, 0, c); r.rotation.y = -PI / 2;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bx(P + 0.01, H, P + 0.01, posts.alt, sx * (W / 2 - P / 2), 0, sz * (D / 2 - P / 2), c);
    bx(W - 0.04, 0.02, D - 0.04, slats.base, 0, 0, 0, c);
    for (const sz of [-1, 1]) bx(W + 0.01, 0.03, 0.03, slats.edge, 0, 0.37, sz * (D / 2 - 0.015), c);
    for (const sz of [-1, 1]) bx(W, 0.012, 0.03, slats.top, 0, 0.4, sz * (D / 2 - 0.015), c);
    return c;
  };
  crate(-0.3, 0, 0.25, teal, wood, true); crate(0.3, 0, 0.25, wood, teal, true);
  crate(-0.3, 0, -0.25, wood, teal, true); crate(0.3, 0, -0.25, teal, wood, true);
  crate(-0.3, 0.4, -0.22, teal, wood); crate(0.3, 0.4, -0.22, wood, teal); crate(-0.3, 0.4, 0.25, wood, teal);
  const top = crate(0.02, 0.8, -0.24, teal, wood);
  // lemons: lathe profile with a nipple, on a false floor, plus spilled ones
  const lemonProf = [[0, 0], [0.04, 0.012], [0.048, 0.05], [0.036, 0.085], [0.012, 0.1], [0, 0.104]];
  bx(W - 0.1, 0.25, D - 0.1, wood.base, 0, 0.02, 0, top);
  const lem = (x, y, z, mt, parent, rx, rz) => { const o = add(lathe(lemonProf, 6), mt, x, y, z, parent); o.rotation.x = rx || 0; o.rotation.z = rz || 0; return o; };
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) lem(-0.195 + 0.13 * i, 0.27, -0.13 + 0.13 * j, (i + j) % 2 ? lemon : lemon2, top, 0.3 * ((i + j) % 3 - 1), 0.25 * (i % 2 ? 1 : -1));
  for (const [lx, lz] of [[-0.13, -0.06], [0.0, -0.06], [0.13, -0.06], [-0.06, 0.07]]) lem(lx, 0.35, lz, lemon, top, 0.5, -0.4);
  lem(-0.03, 0.43, 0.0, lemon2, top, 1.2, 0.2);
  for (const [lx, lz, rz] of [[0.2, 0.2, 1.3], [0.33, 0.3, -1.2], [0.26, 0.1, 0.4]]) lem(lx, 0.4, lz, lemon, S, 1.4, rz);
  // net: an extruded lattice, one leaf lying over the lemons, one hanging over the front lip
  const lattice = (w, h, nx, ny, b) => { const s = rect(w, h, -w / 2, -h / 2); const cw = (w - b * (nx + 1)) / nx, ch = (h - b * (ny + 1)) / ny; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) hole(s, cw, ch, -w / 2 + b + i * (cw + b), -h / 2 + b + j * (ch + b)); return s; };
  const n1 = plate(lattice(0.36, 0.3, 4, 3, 0.04), 0.012, net, 0.14, 0.4, 0.06, top); n1.rotation.x = -PI / 2 + 0.25;
  const n2 = plate(lattice(0.36, 0.34, 4, 3, 0.04), 0.012, net, 0.14, 0.24, D / 2 + 0.01, top); n2.rotation.x = 0.1;

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
