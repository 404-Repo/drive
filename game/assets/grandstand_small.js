// grandstand_small candidate 1 (pass 2: open ended tubes and fewer curve segments to sit inside the band): profile sweeps. The three tier seating block is ONE stepped
// section in (z, y) extruded 11 m along x, the right hand stair is a finer stepped section
// extruded 1 m, the benches are extruded plank sections, the sagging canopy is the same
// section extruded twenty times as alternating stripes, the valance is a scalloped Shape.
// Round scaffold tubes with X bracing under it, seated crowd cards on every tier.
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
  const bar = (a, b, r, mat, seg, parent, open) => { const d = V().subVectors(b, a); const L = d.length(); const o = new THREE.Mesh(seg ? new THREE.CylinderGeometry(r, r, L, seg, 1, !!open) : new THREE.BoxGeometry(r * 2, L, r * 2), mat); o.position.copy(a).add(b).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); (parent || g).add(o); return o; };
  // a section drawn in (z, y) and extruded along x from x0 to x0 + L
  const sect = (shape, L, mat, x0, cs) => { const o = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false, curveSegments: cs || 4 }), mat); o.rotation.y = -PI / 2; o.position.x = x0 + L; g.add(o); return o; };
  const poly = (pts) => { const s = new THREE.Shape(); pts.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]))); return s; };

  const metal = fam('metal', 0x3a3f46, 0.45, 0.2);
  const tube = M('metal', shade(0x3a3f46, -0.04), 0.45, 0.2, { side: DS });
  const deck = fam('timber', 0xcdb897, 0.7, 0);
  const bench = fam('timber', 0xc4683f, 0.7, 0);
  const plaster = fam('plaster', 0xf1e6d2, 0.75, 0);
  const coral = fam('plaster', 0xed5851, 0.7, 0);
  const canvasW = fam('fabric', 0xf1e6d2, 0.8, 0, { side: DS });
  const canvasR = fam('fabric', 0xd6402f, 0.8, 0, { side: DS });
  const crowdA = M('card:crowd_a', 0xc98a5a, 0.8, 0, { side: DS });
  const crowdB = M('card:crowd_b', 0xb0786a, 0.8, 0, { side: DS });

  // tiers: tread from z0 (front) to z1 (back) at height y. Block spans x -6..5, stair 5..6
  const tiers = [{ z0: 2.9, z1: 1.4, y: 1.0 }, { z0: 1.4, z1: -0.1, y: 1.9 }, { z0: -0.1, z1: -1.6, y: 2.8 }];
  const XL = -6.0, XR = 5.0, XC = (XL + XR) / 2, XW = XR - XL;
  const block = [[2.9, 0.88], [2.9, 1.0], [1.4, 1.0], [1.4, 1.9], [-0.1, 1.9], [-0.1, 2.8], [-1.6, 2.8], [-1.6, 2.68], [-0.22, 2.68], [-0.22, 1.78], [1.28, 1.78], [1.28, 0.88]];
  sect(poly(block), XW, deck.face, XL);
  tiers.forEach((t, i) => {
    const d = t.z0 - t.z1, zc = (t.z0 + t.z1) / 2;
    bx(XW, 0.012, d - 0.02, deck.top, XC, t.y, zc);                    // bleached tread
    bx(XW, 0.05, 0.05, deck.edge, XC, t.y - 0.03, t.z0 - 0.025);        // painted nose
    if (i > 0) bx(XW, 0.05, 0.02, deck.alt, XC, t.y - 0.5, t.z0 + 0.01); // riser groove line
    // bench: plank section on five supports, a bleached top and a painted front edge
    const zb = t.z0 - 0.75, yb = t.y + 0.42;
    sect(poly([[zb - 0.21, yb], [zb + 0.21, yb], [zb + 0.21, yb + 0.08], [zb - 0.21, yb + 0.08]]), XW - 0.3, bench.face, XL + 0.15);
    bx(XW - 0.3, 0.012, 0.40, bench.top, XC, yb + 0.08, zb);
    bx(XW - 0.3, 0.04, 0.05, bench.edge, XC, yb + 0.045, zb + 0.215);
    for (let k = 0; k < 5; k++) bx(0.12, 0.42, 0.34, bench.alt, XL + 0.6 + k * (XW - 1.2) / 4, t.y, zb);
    // seated spectators: four cards behind the bench, two card materials alternate
    for (let k = 0; k < 4; k++) add(new THREE.PlaneGeometry(2.55, 1.35), ((k + i) % 2) ? crowdB : crowdA, XL + 0.15 + 1.3 + 2.6 * k, t.y + 0.1 + 0.675, zb - 0.12);
  });

  // right hand stair: fourteen steps from the ground to the top tier, one solid section
  const st = [[2.9, 0]]; let sz = 2.9, sy = 0; const run = 4.5 / 14;
  for (let i = 0; i < 14; i++) { sy += 0.2; st.push([sz, sy]); sz -= run; st.push([sz, sy]); }
  st.push([-1.6, 0]);
  sect(poly(st), 1.0, deck.alt, XR);
  for (let i = 0; i < 14; i++) bx(1.0, 0.012, run - 0.02, deck.top, XR + 0.5, 0.2 * (i + 1), 2.9 - run * (i + 0.5));
  bx(0.04, 0.012, 4.5, deck.edge, XR + 0.98, 0.0, 0.65); // a light seam line at the stair outer edge, on the ground

  // front skirt: whitewash with a dark base band, pilasters, coral top band, bleached cap
  bx(XW, 0.25, 0.16, plaster.base, XC, 0, 2.98);
  bx(XW, 0.63, 0.16, plaster.face, XC, 0.25, 2.98);
  for (let k = 0; k < 4; k++) bx(0.24, 0.63, 0.04, plaster.alt, XL + 1.4 + 2.7 * k, 0.25, 3.08);
  bx(XW + 0.04, 0.12, 0.22, coral.face, XC, 0.88, 2.98);
  bx(XW + 0.04, 0.012, 0.22, coral.top, XC, 1.0, 2.98);
  bx(0.16, 0.25, 0.6, plaster.base, XL + 0.08, 0, 2.6); bx(0.16, 0.63, 0.6, plaster.face, XL + 0.08, 0.25, 2.6); bx(0.22, 0.12, 0.6, coral.face, XL + 0.08, 0.88, 2.6);
  // stair cheek wall on the outer right, stepping with the stair
  bx(0.12, 0.25, 1.4, plaster.base, XR + 1.0 - 0.06, 0, 2.2); bx(0.12, 0.55, 1.4, plaster.face, XR + 1.0 - 0.06, 0.25, 2.2); bx(0.16, 0.08, 1.4, coral.face, XR + 1.0 - 0.06, 0.8, 2.2);

  // scaffold: round tubes, base band on every post, ledgers, X bracing on both sides and the back
  const R = 0.045, xs = [-5.9, -3.2, -0.5, 2.2, 4.9];
  const rows = [{ z: 2.8, top: 0.88 }, { z: 1.32, top: 1.78 }, { z: -0.16, top: 2.68 }, { z: -1.55, top: 2.68 }];
  for (const r of rows) {
    for (const x of xs) { cyl(R, R, 0.25, 10, metal.base, x, 0, r.z); cyl(R, R, r.top - 0.25, 10, metal.face, x, 0.25, r.z); }
    bar(V(-5.9, r.top - 0.12, r.z), V(4.9, r.top - 0.12, r.z), R * 0.8, tube, 10, null, true);
    bar(V(-5.9, 0.35, r.z), V(4.9, 0.35, r.z), R * 0.8, tube, 10, null, true);
  }
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], b = rows[i + 1], yt = Math.min(a.top, b.top) - 0.15;
    bar(V(-5.9, 0.3, a.z), V(-5.9, yt, b.z), 0.03, tube, 8, null, true);
    bar(V(-5.9, yt, a.z), V(-5.9, 0.3, b.z), 0.03, tube, 8, null, true);
  }
  for (let i = 0; i < xs.length - 1; i++) {
    bar(V(xs[i], 0.3, -1.55), V(xs[i + 1], 2.5, -1.55), 0.03, tube, 8, null, true);
    bar(V(xs[i], 2.5, -1.55), V(xs[i + 1], 0.3, -1.55), 0.03, tube, 8, null, true);
  }

  // rails: back of the top tier, left side of every tier, a sloping handrail up the stair
  const railEdge = M('metal', shade(0x3a3f46, 0.10), 0.45, 0.2, { side: DS });
  const rail = (a, b) => { bar(a, b, 0.035, railEdge, 10, null, true); bar(V(a.x, a.y - 0.47, a.z), V(b.x, b.y - 0.47, b.z), 0.03, tube, 10, null, true); };
  for (const x of [-5.9, -3.2, -0.5, 2.2, 4.9, 5.9]) cyl(0.035, 0.035, 1.0, 10, metal.face, x, 2.8, -1.62);
  rail(V(-5.95, 3.77, -1.62), V(5.95, 3.77, -1.62));
  for (const t of tiers) { cyl(0.035, 0.035, 1.0, 10, metal.face, -5.95, t.y, t.z0 - 0.06); rail(V(-5.95, t.y + 0.97, t.z0 - 0.02), V(-5.95, t.y + 0.97, t.z1 - 0.02)); }
  cyl(0.035, 0.035, 0.95, 10, metal.face, 5.97, 0.4, 2.55); cyl(0.035, 0.035, 0.95, 10, metal.face, 5.97, 1.6, 0.5);
  rail(V(5.97, 1.35, 2.7), V(5.97, 3.77, -1.55));

  // canopy: a sagging section extruded as twenty alternating stripes on four round posts
  const CZ0 = 1.75, CZ1 = -2.85, CY = 4.78, SAG = 0.12, CT = 0.07, ZM = (CZ0 + CZ1) / 2;
  const canopyShape = (dy) => { const s = new THREE.Shape(); s.moveTo(CZ0, CY + dy); s.quadraticCurveTo(ZM, CY + dy - 2 * SAG, CZ1, CY + dy); s.lineTo(CZ1, CY + dy - CT); s.quadraticCurveTo(ZM, CY + dy - CT - 2 * SAG, CZ0, CY + dy - CT); s.closePath(); return s; };
  for (let k = 0; k < 20; k++) sect(canopyShape(k % 2 ? 0 : 0.01), 0.62, k % 2 ? canvasW.top : canvasR.face, -6.2 + 0.62 * k, 4);
  for (const [x, z, y0] of [[-6.1, 1.6, 1.0], [6.1, 1.6, 0.0], [-6.1, -2.6, 0.0], [6.1, -2.6, 0.0]]) {
    cyl(0.06, 0.06, 0.25, 10, metal.base, x, y0, z); cyl(0.06, 0.06, CY - CT - 0.25 - y0, 10, metal.face, x, y0 + 0.25, z);
  }
  bx(12.4, 0.1, 0.1, metal.edge, 0, CY - CT - 0.1, CZ0 - 0.1);
  bx(12.4, 0.1, 0.1, metal.edge, 0, CY - CT - 0.1, CZ1 + 0.1);
  // scalloped valance on the front and back eaves, a lighter strip along its top
  const valance = () => { const s = new THREE.Shape(); s.moveTo(-6.2, 0); s.lineTo(6.2, 0); s.lineTo(6.2, -0.1); for (let k = 19; k >= 0; k--) s.absarc(-6.2 + 0.31 + 0.62 * k, -0.1, 0.31, 0, -PI, true); s.lineTo(-6.2, 0); return s; };
  for (const z of [CZ0, CZ1 - 0.04]) {
    add(new THREE.ExtrudeGeometry(valance(), { depth: 0.04, bevelEnabled: false, curveSegments: 3 }), canvasR.alt, 0, CY - CT, z);
    bx(12.44, 0.05, 0.06, canvasW.edge, 0, CY - CT - 0.03, z + 0.02);
  }

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
