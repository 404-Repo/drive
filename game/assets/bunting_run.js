// bunting_run c1: geometry. A cord swept as a tube along a sagging parabola (ends at 1.2 m, 0.72 m sag), 22 pennants
// hung from it as hand built strips that taper to a point and curl alternately toward plus and minus Z as if in a
// breeze (this gives the 0.2 m depth), each with a lighter hem at the top. Five fabric colours in rotation.
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (name, hex, rough, metal, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: metal || 0 }, extra || {}));
    if (name) m.name = name; return m;
  };
  const tint = (hex, f) => { const c = new THREE.Color(hex); c.r = Math.min(1, c.r * f); c.g = Math.min(1, c.g * f); c.b = Math.min(1, c.b * f); return c.getHex(); };
  const DS = { side: THREE.DoubleSide };

  const L = 11.0, TOP = 1.2, SAG = 0.72;
  const yc = (x) => TOP - SAG * (1 - (2 * x / L) * (2 * x / L));
  // cord: tube along the parabola
  const pts = [];
  for (let i = 0; i <= 24; i++) { const x = -L / 2 + (L * i) / 24; pts.push(new THREE.Vector3(x, yc(x), 0)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const cord = new THREE.Mesh(new THREE.TubeGeometry(curve, 22, 0.02, 5, false), mat('fabric', 0x3a3f46, 0.9, 0, DS));
  g.add(cord);
  // end knots
  for (const s of [-1, 1]) {
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat('fabric', 0x3a3f46, 0.9));
    k.position.set(s * L / 2, TOP, 0); g.add(k);
  }

  const colours = [0xed5851, 0xf1e6d2, 0xf2c230, 0x3fc7a0, 0xd8388a];
  const mats = colours.map((h) => mat('fabric', h, 0.8, 0, DS));
  const hems = colours.map((h) => mat('fabric', tint(h, 1.18), 0.8, 0, DS));
  const W = 0.30, H = 0.45, ROWS = 3;
  const N = 22, pitch = L / N;
  const posOf = new Map();
  const add = (m, tri) => { if (!posOf.has(m)) posOf.set(m, []); posOf.get(m).push(...tri); };
  for (let i = 0; i < N; i++) {
    const xc = -L / 2 + pitch * (i + 0.5);
    const swing = (i % 2 ? 1 : -1) * 0.10;
    const ci = i % colours.length;
    // rows of the strip: t from 0 (cord) to 1 (tip); half width shrinks to 0, z curls with t squared
    const row = (t) => {
      const hw = (W / 2) * (1 - t);
      const y0 = yc(xc) - 0.02 - H * t;
      const slope = (yc(xc + 0.01) - yc(xc - 0.01)) / 0.02;
      const z = swing * t * t;
      return [[xc - hw, y0 - slope * hw, z], [xc + hw, y0 + slope * hw, z]];
    };
    for (let r = 0; r < ROWS; r++) {
      const a = row(r / ROWS), b = row((r + 1) / ROWS);
      const m = r === 0 ? hems[ci] : mats[ci];
      if (r < ROWS - 1) {
        add(m, [...a[0], ...a[1], ...b[1], ...a[0], ...b[1], ...b[0]]);
      } else {
        add(m, [...a[0], ...a[1], ...b[0]]);
      }
    }
    // the hem is only the top 0.04 m: split the first row into a hem strip and a body part
    // (done by giving row 0 the hem material and keeping it short)
  }
  for (const [m, arr] of posOf) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, m));
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
