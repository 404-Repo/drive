// deck_chair candidate 3: candidate 2 narrowed to the 0.60 m brief (frame pulled in, 0.105 stripes). Round dowel construction
// (cylinders, 10 segments) with the rear frame OUTSIDE the long rails, a notched
// stretcher with three notch blocks, and the sling as flat facets along the curve with
// rolled hems at both rails and a fold over the top rail.
export default function (THREE) {
  const g = new THREE.Group();
  const C = (hex, dl, ds) => new THREE.Color(hex).offsetHSL(0, ds || 0, dl || 0);
  const M = (name, hex, rough, dl, ds, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: C(hex, dl, ds), roughness: rough, metalness: 0 }, extra || {}));
    m.name = name; return m;
  };
  const mesh = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x || 0, y || 0, z || 0); g.add(o); return o; };
  const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  const UP = new THREE.Vector3(0, 1, 0);
  const dowel = (a, b, r, mat, ext) => {
    const A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(b[0], b[1], b[2]);
    const dir = B.clone().sub(A); const len = dir.length() + 2 * (ext || 0); dir.normalize();
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
    o.position.copy(A).add(B).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(UP, dir);
    g.add(o); return o;
  };
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  const teal = M('timber', 0x3f8f8a, 0.72);
  const tealHi = M('timber', 0x3f8f8a, 0.68, 0.07);
  const tealFoot = M('timber', 0x3f8f8a, 0.78, -0.10, -0.06);
  const peg = M('metal', 0x3a3f46, 0.45, 0, 0, { metalness: 0.2 });
  const red = M('fabric', 0xd6402f, 0.85, 0, 0, { side: THREE.DoubleSide });
  const white = M('fabric', 0xf1e6d2, 0.85, 0, 0, { side: THREE.DoubleSide });
  const redHem = M('fabric', 0xd6402f, 0.85, -0.04);
  const whiteHem = M('fabric', 0xf1e6d2, 0.85, -0.04);

  const R = 0.027;
  const X = 0.205, XO = 0.25;             // long rails inside, rear frame outside
  const footL = [0, R, 0.55], topL = [0, 0.9, -0.45];
  const footR = [0, R, -0.7];
  const pivot = lerp(footL, topL, 0.43 / 0.875);
  const rearTop = lerp(footR, pivot, 1.0 + 0.1 / 0.874);

  for (const s of [-1, 1]) {
    const band = lerp(footL, topL, 0.15 / 0.875);
    dowel([s * X, footL[1], footL[2]], [s * X, band[1], band[2]], R, tealFoot);
    dowel([s * X, band[1], band[2]], [s * X, topL[1], topL[2]], R, teal, 0.03);
    // lighter end discs, the painted edge of every dowel end
    const e1 = mesh(new THREE.CylinderGeometry(R + 0.004, R + 0.004, 0.02, 10), tealHi, s * X, topL[1] + 0.03, topL[2] - 0.03);
    e1.quaternion.setFromUnitVectors(UP, new THREE.Vector3(0, 0.875, -1).normalize());
    const bandR = lerp(footR, pivot, 0.15 / 0.874);
    dowel([s * XO, footR[1], footR[2]], [s * XO, bandR[1], bandR[2]], R, tealFoot);
    dowel([s * XO, bandR[1], bandR[2]], [s * XO, rearTop[1], rearTop[2]], R, teal, 0.03);
    const e2 = mesh(new THREE.CylinderGeometry(R + 0.004, R + 0.004, 0.02, 10), tealHi, s * XO, rearTop[1] + 0.02, rearTop[2] + 0.03);
    e2.quaternion.setFromUnitVectors(UP, new THREE.Vector3(0, 0.425, 0.764).normalize());
    // stretcher side member and its three notch blocks resting on the rear frame
    dowel([s * 0.16, 0.365, 0.5], [s * 0.16, 0.325, -0.22], R, teal);
    for (let k = 0; k < 3; k++) {
      const t = 0.42 + k * 0.08;
      const q = lerp(footR, pivot, t);
      box(0.05, 0.045, 0.05, tealHi, s * XO, q[1] + 0.04, q[2]);
    }
    // hinge bolts through both frames
    const p = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 10), peg, s * 0.2275, pivot[1], pivot[2]);
    p.rotation.z = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 10), peg, s * 0.295, pivot[1], pivot[2]).rotation.z = Math.PI / 2;
  }
  dowel([-0.29, topL[1], topL[2]], [0.29, topL[1], topL[2]], R, teal);
  const fc = lerp(footL, topL, 0.1 / 0.875);
  dowel([-X, fc[1], fc[2]], [X, fc[1], fc[2]], R, teal);
  const rc = lerp(footR, pivot, 0.1 / 0.874);
  dowel([-XO, rc[1], rc[2]], [XO, rc[1], rc[2]], R, teal);
  dowel([-0.28, 0.365, 0.5], [0.28, 0.365, 0.5], R, teal);
  for (const s of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(R + 0.004, R + 0.004, 0.02, 10), tealHi, s * 0.30, topL[1], topL[2]).rotation.z = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(R + 0.004, R + 0.004, 0.02, 10), tealHi, s * 0.29, 0.365, 0.5).rotation.z = Math.PI / 2;
  }

  // sling as flat facets: each segment a rotated plane, stripes 0.11 wide
  const P0 = new THREE.Vector3(0, 0.935, -0.48), P1 = new THREE.Vector3(0, 0.34, -0.27), P2 = new THREE.Vector3(0, 0.4, 0.5);
  const curve = new THREE.QuadraticBezierCurve3(P0, P1, P2);
  const N = 9;
  const pts = curve.getPoints(N);
  const stripeW = 0.105;
  for (let i = 0; i < N; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = a.distanceTo(b);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a).normalize();
    for (let k = 0; k < 5; k++) {
      const plane = new THREE.PlaneGeometry(stripeW, len + 0.004);
      const o = new THREE.Mesh(plane, k % 2 === 0 ? red : white);
      o.position.set(-0.2625 + stripeW * (k + 0.5), mid.y, mid.z);
      o.quaternion.setFromUnitVectors(UP, dir);
      g.add(o);
    }
  }
  // fold over the top rail and rolled hem at the seat rail, striped to match
  for (let k = 0; k < 5; k++) {
    const hm = k % 2 === 0 ? redHem : whiteHem;
    const h1 = mesh(new THREE.CylinderGeometry(0.042, 0.042, stripeW, 12), hm, -0.2625 + stripeW * (k + 0.5), topL[1], topL[2]); h1.rotation.z = Math.PI / 2;
    const h2 = mesh(new THREE.CylinderGeometry(0.042, 0.042, stripeW, 12), hm, -0.2625 + stripeW * (k + 0.5), 0.365, 0.5); h2.rotation.z = Math.PI / 2;
  }
  // the fold hanging behind the top rail
  box(0.525, 0.1, 0.015, red, 0, topL[1] - 0.06, topL[2] - 0.045);

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
