// item_box c3: the reference's reading at the TSV size. A 0.6 m glass cube stood on one
// corner (long diagonal vertical, overall 1.0 m tall and about 0.9 m across), chunky
// 0.08 m box section frame bars with a proud painted edge strip, corner blocks, six glass
// panes, a faint inner frame and a glowing coral core with a soft halo. The top corner and
// its three bars are bleached, the bottom corner and its three bars are the darker band.
// Joints: spin (whole cube about the vertical axis, pivot at the cube centre), core.
export default function (THREE) {
  const g = new THREE.Group();
  const mk = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0.05 }, extra || {}));
  const nm = (m, n) => { m.name = n; return m; };

  const frameMid = nm(mk(0xe4d9c5, { roughness: 0.65 }), 'plaster');
  const frameTop = nm(mk(0xf1e6d2, { roughness: 0.6 }), 'plaster');
  const frameBot = nm(mk(0xc6b8a1, { roughness: 0.7 }), 'plaster');
  const strip = nm(mk(0xf1e6d2, { roughness: 0.55 }), 'plaster');
  const inner = nm(mk(0xc2d3ea, { roughness: 0.5 }), 'metal');
  // Glass at 0.6 opacity rather than the TSV's 0.85: at 0.85 the coral core is invisible
  // from every side in the verify render, and the brief needs the core to read.
  const glass = new THREE.MeshStandardMaterial({ color: 0x8fa9d6, roughness: 0.15, metalness: 0.0, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const core = new THREE.MeshStandardMaterial({ color: 0xed5851, roughness: 0.4, emissive: 0xffc48a, emissiveIntensity: 1.0 });
  const halo = new THREE.MeshStandardMaterial({ color: 0xed5851, roughness: 0.5, transparent: true, opacity: 0.25, emissive: 0xffc48a, emissiveIntensity: 0.5, depthWrite: false });

  const E = 0.6, H = E / 2, B = 0.08, S = 0.024;
  const spin = new THREE.Group(); spin.name = 'item_box_spin';
  spin.position.y = (E * Math.sqrt(3)) / 2;
  g.add(spin);
  const cube = new THREE.Group();
  spin.add(cube);

  const put = (geo, mat, x, y, z, rx, ry, rz) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); cube.add(m); return m;
  };
  // Tint by height once stood on the corner: bars touching the (+,+,+) corner are top,
  // bars touching the (-,-,-) corner are the base band, the rest are the middle tint.
  const tint = (a, b) => (a > 0 && b > 0) ? frameTop : (a < 0 && b < 0) ? frameBot : frameMid;
  const off = H - B / 2;
  const barX = new THREE.BoxGeometry(E - B, B, B);
  const barY = new THREE.BoxGeometry(B, E - B, B);
  const barZ = new THREE.BoxGeometry(B, B, E - B);
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) put(barX, tint(sy, sz), 0, sy * off, sz * off);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(barY, tint(sx, sz), sx * off, 0, sz * off);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) put(barZ, tint(sx, sy), sx * off, sy * off, 0);
  // Corner blocks a hair larger than the bars.
  const CB = B + 0.012, cOff = H - CB / 2;
  const corner = new THREE.BoxGeometry(CB, CB, CB);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const mat = (sx > 0 && sy > 0 && sz > 0) ? frameTop : (sx < 0 && sy < 0 && sz < 0) ? frameBot : frameMid;
    put(corner, mat, sx * cOff, sy * cOff, sz * cOff);
  }
  // Painted edge strips along the outer arris of every bar, proud by 6 mm.
  const so = H - S / 2 + 0.006, sl = E - CB - 0.01;
  const sX = new THREE.BoxGeometry(sl, S, S), sY = new THREE.BoxGeometry(S, sl, S), sZ = new THREE.BoxGeometry(S, S, sl);
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) put(sX, strip, 0, sy * so, sz * so);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(sY, strip, sx * so, 0, sz * so);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) put(sZ, strip, sx * so, sy * so, 0);
  // Glass panes set 2 cm inside the frame face.
  const pane = new THREE.PlaneGeometry(E - 2 * B, E - 2 * B);
  const pin = H - 0.02;
  put(pane, glass, 0, 0, pin); put(pane, glass, 0, 0, -pin, 0, Math.PI, 0);
  put(pane, glass, pin, 0, 0, 0, Math.PI / 2, 0); put(pane, glass, -pin, 0, 0, 0, -Math.PI / 2, 0);
  put(pane, glass, 0, pin, 0, -Math.PI / 2, 0, 0); put(pane, glass, 0, -pin, 0, Math.PI / 2, 0, 0);
  // Faint inner frame just inside the bars, seen through the glass.
  const io = H - B - 0.012, IB = 0.02;
  const iX = new THREE.BoxGeometry(2 * io, IB, IB), iY = new THREE.BoxGeometry(IB, 2 * io, IB), iZ = new THREE.BoxGeometry(IB, IB, 2 * io);
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) put(iX, inner, 0, sy * io, sz * io);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(iY, inner, sx * io, 0, sz * io);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) put(iZ, inner, sx * io, sy * io, 0);
  // Core 0.36 m across with a halo.
  const coreJ = new THREE.Group(); coreJ.name = 'item_box_core';
  cube.add(coreJ);
  coreJ.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), core));    // 12 x 8 (was 20 x 14): 29 boxes in the game, the core sits behind the panes
  coreJ.add(new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 7), halo));    // 10 x 7 (was 16 x 12): a 25 percent opacity halo

  // Stand on the corner: the (1,1,1) diagonal becomes vertical; then turn 30 degrees so
  // both x and z sit 15 degrees off a hexagon corner and the plan silhouette is equal
  // (about 0.95 m each way, measured).
  cube.quaternion.setFromUnitVectors(new THREE.Vector3(1, 1, 1).normalize(), new THREE.Vector3(0, 1, 0));
  spin.rotation.y = Math.PI / 6;

  g.userData.joints = { spin, core: coreJ };

  const box = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put2 = (mat) => { for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put2(m.multiplyMatrices(n.matrixWorld, im)); } return; }
    put2(n.matrixWorld);
  });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });
  return g;
}
