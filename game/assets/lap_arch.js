// lap_arch c1: profiles. The spandrel beam is one ExtrudeGeometry of a 14 x 1.0 rectangle with the shallow arch cut
// out of its underside between the columns, extruded 1.6 deep; the columns are lathes with a slight entasis, a darker
// base drum and a whitewash capital lathe; the tile cap is an extruded profile with a drip lip, ribbed. The coral band
// follows the arch as a ring sector on both faces with straight runs over the columns, whitewash chevrons on it, six
// discs alternating coral and mint on rods under the arch. 14 x 1.6 x 6.5.
export default function (THREE) {
  const g = new THREE.Group();
  const PI = Math.PI;
  const mat = (name, hex, rough, metal, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: metal || 0 }, extra || {}));
    if (name) m.name = name; return m;
  };
  const mesh = (parent, geo, m, x, y, z, rx, ry, rz) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.rotation.set(rx || 0, ry || 0, rz || 0); parent.add(o); return o;
  };
  const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg || 14);
  const DS = { side: THREE.DoubleSide };
  const stone = mat('stone', 0xcdb897, 0.85);
  const stoneShade = mat('stone', 0x8d7b63, 0.9);
  const plaster = mat('plaster', 0xf1e6d2, 0.75);
  const plasterHi = mat('plaster', 0xfaf1e0, 0.75);
  const tile = mat('tile', 0xc4683f, 0.8);
  const tileTop = mat('tile', 0xd27a50, 0.8);
  const coral = mat('plaster', 0xed5851, 0.7, 0, DS);
  const chev = mat('plaster', 0xf1e6d2, 0.7, 0, DS);
  const coralM = mat('metal', 0xed5851, 0.4, 0.15);
  const mint = mat('metal', 0x3fc7a0, 0.4, 0.15);
  const rod = mat('metal', 0x3a3f46, 0.45, 0.25);

  const CX = 6.2, COL_H = 5.2, BASE_H = 0.5, CAP_H = 0.3, L = 14.0, D = 1.6;
  for (const s of [-1, 1]) {
    const x = s * CX;
    mesh(g, lathe([[0, 0], [0.45, 0], [0.45, 0.1], [0.43, BASE_H], [0.40, BASE_H]], 14), stoneShade, x, 0, 0);
    mesh(g, lathe([[0.40, BASE_H], [0.41, 2.0], [0.385, 4.4], [0.36, COL_H]], 14), stone, x, 0, 0);
    mesh(g, lathe([[0.36, COL_H], [0.46, COL_H + 0.08], [0.56, COL_H + 0.2], [0.58, COL_H + CAP_H], [0, COL_H + CAP_H]], 14), plaster, x, 0, 0);
    mesh(g, new THREE.BoxGeometry(1.2, 0.05, 1.2), plasterHi, x, COL_H + CAP_H + 0.025, 0);
  }
  // spandrel beam: y from 5.55 to 6.38, arch cut out between x = -5.3 and 5.3 rising 0.45
  const Y0 = 5.55, Y1 = 6.38, HALF_SPAN = 5.3, RISE = 0.45;
  const R = (HALF_SPAN * HALF_SPAN + RISE * RISE) / (2 * RISE), CY = Y0 + RISE - R;
  const th = Math.asin(HALF_SPAN / R);
  const sh = new THREE.Shape();
  sh.moveTo(-L / 2, Y0); sh.lineTo(-HALF_SPAN, Y0);
  sh.absarc(0, CY, R, PI / 2 + th, PI / 2 - th, true);
  sh.lineTo(L / 2, Y0); sh.lineTo(L / 2, Y1); sh.lineTo(-L / 2, Y1); sh.lineTo(-L / 2, Y0);
  const beam = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: false, curveSegments: 24 }), plaster);
  beam.position.z = -D / 2; g.add(beam);
  // cornice strip under the tile cap, both faces (painted edge)
  for (const s of [-1, 1]) mesh(g, new THREE.BoxGeometry(L + 0.1, 0.08, 0.06), plasterHi, 0, Y1 - 0.04, s * (D / 2 + 0.03));
  // tile cap: profile with a drip lip on both sides, swept along X, lighter top, ribs
  const cap = new THREE.Shape();
  const hd = D / 2 + 0.12;
  cap.moveTo(-hd, Y1 - 0.02); cap.lineTo(hd, Y1 - 0.02); cap.lineTo(hd, Y1 + 0.08); cap.lineTo(hd - 0.06, Y1 + 0.14);
  cap.lineTo(-hd + 0.06, Y1 + 0.14); cap.lineTo(-hd, Y1 + 0.08); cap.lineTo(-hd, Y1 - 0.02);
  const capMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(cap, { depth: L + 0.3, bevelEnabled: false }), tile);
  capMesh.rotation.y = -PI / 2; capMesh.position.x = L / 2 + 0.15; g.add(capMesh);
  mesh(g, new THREE.BoxGeometry(L + 0.2, 0.01, D + 0.1), tileTop, 0, Y1 + 0.145, 0);
  for (let i = 0; i <= 16; i++) mesh(g, new THREE.BoxGeometry(0.08, 0.05, D + 0.26), tile, -L / 2 - 0.15 + i * ((L + 0.3) / 16), Y1 + 0.16, 0);

  // coral band following the arch (ring sector offset 0.2 above the intrados) plus straight runs over the columns
  const BAND_H = 0.26, RB = R + 0.2 + BAND_H / 2;
  const bandGeo = new THREE.RingGeometry(RB - BAND_H / 2, RB + BAND_H / 2, 24, 1, PI / 2 - th * 0.98, 2 * th * 0.98);
  for (const s of [-1, 1]) {
    const z = s * (D / 2 + 0.006);
    mesh(g, bandGeo, coral, 0, CY, z);
    const yEnd = CY + RB * Math.cos(th * 0.98);
    for (const e of [-1, 1]) mesh(g, new THREE.PlaneGeometry(L / 2 - HALF_SPAN + 0.25, BAND_H), coral, e * (L / 2 - (L / 2 - HALF_SPAN + 0.25) / 2 - 0.02), yEnd, z);
    // chevrons: 12 along the arc pointing outward from the centre, 2 on each straight run
    const place = (x, y, dir, tangent) => {
      for (const half of [-1, 1]) {
        const p = mesh(g, new THREE.PlaneGeometry(0.15, 0.045), chev, x + Math.cos(tangent) * dir * 0.035 * half * -1 + Math.sin(tangent) * half * 0.05 * -1, y + Math.sin(tangent) * dir * 0.035 * half * -1 + Math.cos(tangent) * half * 0.05, z + s * 0.006);
        p.rotation.z = tangent + half * dir * 0.75;
      }
    };
    for (let i = 0; i < 12; i++) {
      const a = -th * 0.9 + (i / 11) * 2 * th * 0.9;            // angle from vertical
      const x = RB * Math.sin(a), y = CY + RB * Math.cos(a);
      place(x, y, x < 0 ? -1 : 1, -a);
    }
    for (const e of [-1, 1]) for (const k of [0.35, 0.95]) place(e * (HALF_SPAN + k), yEnd, e, 0);
  }
  // discs on rods under the arch
  for (let i = 0; i < 6; i++) {
    const x = -4.5 + i * 1.8;
    const yArc = CY + Math.sqrt(R * R - x * x);
    const len = 0.35 + 0.1 * Math.abs(x) / 4.5;
    mesh(g, new THREE.CylinderGeometry(0.02, 0.02, len, 6), rod, x, yArc - len / 2, 0);
    mesh(g, new THREE.CylinderGeometry(0.2, 0.2, 0.05, 14), i % 2 ? mint : coralM, x, yArc - len - 0.2, 0, PI / 2, 0, 0);
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
