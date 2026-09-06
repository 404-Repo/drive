// tyre_wall c1: lathe profiles. Each tyre is one revolved section with rounded shoulders, a flat tread and the inner
// hole wall in the same profile, twelve of them three columns by four high (2.0 x 0.7 x 1.2). Belts are extruded
// rounded rectangle rings; straps are boxes. Bottom row darkest, top row lightest, a warm shoulder ring on the top row.
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
  const rubbers = [0x232528, 0x292c30, 0x2c2f33, 0x2f3236].map((h) => mat(null, h, 0.85, 0, DS));
  const shoulder = mat(null, 0x3e3a36, 0.85, 0, DS);
  const hole = mat(null, 0x232528, 0.9, 0, DS);
  const whiteBelt = mat('fabric', 0xf1e6d2, 0.7);
  const redBelt = mat('fabric', 0xd6402f, 0.7);
  const strap = mat('metal', 0x3a3f46, 0.5, 0.2);

  const R = 0.30, RI = 0.17, TH = 0.29, SEG = 14;
  const h = TH / 2;
  // profile (radius, y): inner bottom, out along the bottom, up the rounded shoulder, flat tread, top shoulder, in along the top, down the hole
  const tyreGeo = lathe([[RI, -h], [0.25, -h], [R, -h + 0.06], [R, h - 0.06], [0.25, h], [RI, h], [RI, -h]], SEG);
  // lower rows: the hole wall is hidden by the tyre above, so the profile stops at the top inner edge
  const tyreLowGeo = lathe([[RI, -h], [0.25, -h], [R, -h + 0.06], [R, h - 0.06], [0.25, h], [RI, h]], SEG);
  const shoulderGeo = new THREE.RingGeometry(RI + 0.005, 0.245, SEG, 1);
  const discGeo = new THREE.CircleGeometry(RI, SEG);
  const cols = [-0.64, 0, 0.64];
  for (let row = 0; row < 4; row++) {
    const y = TH * (row + 0.5);
    for (const x of cols) {
      mesh(g, row === 3 ? tyreGeo : tyreLowGeo, rubbers[row], x, y, 0);
      if (row === 3) {
        mesh(g, shoulderGeo, shoulder, x, y + h + 0.002, 0, -PI / 2, 0, 0);
        mesh(g, discGeo, hole, x, y - h + 0.01, 0, -PI / 2, 0, 0);
      }
    }
  }

  const belt = (y0, hgt, m) => {
    const hw = cols[2] + R, hd = R, t = 0.035;
    const rr = (hwid, hdep, rad) => {
      const s = new THREE.Path();
      s.moveTo(-hwid + rad, -hdep);
      s.lineTo(hwid - rad, -hdep);
      s.absarc(hwid - rad, 0, rad, -PI / 2, PI / 2, false);
      s.lineTo(-hwid + rad, hdep);
      s.absarc(-hwid + rad, 0, rad, PI / 2, PI * 1.5, false);
      return s;
    };
    const outer = new THREE.Shape(rr(hw + t, hd + t, hd + t).getPoints(6));
    outer.holes.push(new THREE.Path(rr(hw, hd, hd).getPoints(6)));
    const geo = new THREE.ExtrudeGeometry(outer, { depth: hgt, bevelEnabled: false, curveSegments: 6 });
    const o = new THREE.Mesh(geo, m); o.rotation.x = -PI / 2; o.position.y = y0; g.add(o); return o;
  };
  belt(TH * 3 + 0.06, 0.15, whiteBelt);
  belt(TH * 1 + 0.07, 0.15, redBelt);

  for (let row = 0; row < 4; row++) {
    const y = TH * (row + 0.5);
    for (const x of [-0.32, 0.32]) for (const s of [-1, 1]) mesh(g, new THREE.BoxGeometry(0.10, 0.06, 0.04), strap, x, y, s * 0.27);
  }
  for (const x of [-0.32, 0.32]) mesh(g, new THREE.BoxGeometry(0.12, 0.04, 0.08), strap, x, TH * 4 + 0.01, 0);

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
