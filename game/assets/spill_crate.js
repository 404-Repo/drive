// spill_crate c3: the reference's reading inside the TSV box (0.7 x 0.5 x 0.45). An open
// topped teal fish crate 0.68 x 0.40 x 0.28 that has gone over onto its front: it rests on
// its front top rail with the open mouth facing +Z and tipped 15 degrees toward the ground,
// the back of the crate 0.39 m up. Four slats a side with gaps, corner posts, floor boards
// (now the back wall, seen through the mouth), rope handles on the ends, bleached top
// rails, a darker band on the face that meets the ground. Ice pours out of the mouth as a
// low mound of chunks with three small silver fish on it. Joints: crate, fish.
export default function (THREE) {
  const g = new THREE.Group();
  const mk = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.7, metalness: 0.0 }, extra || {}));
  const nm = (m, n) => { m.name = n; return m; };

  const teal = nm(mk(0x3f8f8a), 'timber');
  const tealTop = nm(mk(0x4fa39d), 'timber');     // bleached faces and painted rails
  const tealBase = nm(mk(0x316f6a), 'timber');    // darker band where it meets the ground
  const rope = nm(mk(0xc9a46a, { roughness: 0.85 }), 'fabric');
  const ice = nm(mk(0xd8e6e8, { roughness: 0.55 }), 'ground');
  const iceLit = nm(mk(0xeef5f5, { roughness: 0.5 }), 'ground');
  const fishMat = nm(mk(0xb8c5cc, { roughness: 0.4, metalness: 0.3 }), 'metal');
  const fishDark = nm(mk(0x7d8c96, { roughness: 0.45, metalness: 0.3 }), 'metal');

  // Crate built upright: W along x, D along z, H up, open top. Front face is +Z.
  const W = 0.68, D = 0.40, H = 0.28, P = 0.045, T = 0.03;
  const crate = new THREE.Group(); crate.name = 'spill_crate_body';
  g.add(crate);
  const put = (parent, geo, mat, x, y, z, rx, ry, rz) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); parent.add(m); return m;
  };
  const post = new THREE.BoxGeometry(P, H, P);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(crate, post, sz > 0 ? tealBase : teal, sx * (W / 2 - P / 2), H / 2, sz * (D / 2 - P / 2));
  // Slats: 4 per side, 0.05 tall, gaps between. The +Z face ends up against the ground.
  const sh = 0.05, gap = (H - 4 * sh) / 3;
  for (let i = 0; i < 4; i++) {
    const y = sh / 2 + i * (sh + gap);
    put(crate, new THREE.BoxGeometry(W - 2 * P, sh, T), tealBase, 0, y, D / 2 - T / 2);
    put(crate, new THREE.BoxGeometry(W - 2 * P, sh, T), i === 3 ? tealTop : teal, 0, y, -(D / 2 - T / 2));
    for (const sx of [-1, 1]) put(crate, new THREE.BoxGeometry(T, sh, D - 2 * P), i === 3 ? tealTop : teal, sx * (W / 2 - T / 2), y, 0);
  }
  // Floor boards along x with small gaps (become the back wall).
  for (let i = 0; i < 4; i++) put(crate, new THREE.BoxGeometry(W - 2 * P, T, 0.07), teal, 0, T / 2, -D / 2 + P + 0.045 + i * 0.087);
  // Bleached top rails on the open rim, slightly proud.
  put(crate, new THREE.BoxGeometry(W, 0.02, P + 0.006), tealTop, 0, H + 0.01, D / 2 - P / 2);
  put(crate, new THREE.BoxGeometry(W, 0.02, P + 0.006), tealTop, 0, H + 0.01, -(D / 2 - P / 2));
  for (const sx of [-1, 1]) put(crate, new THREE.BoxGeometry(P + 0.006, 0.02, D - 2 * P), tealTop, sx * (W / 2 - P / 2), H + 0.01, 0);
  // Rope handles: half tori standing off the end faces.
  for (const sx of [-1, 1]) {
    const r = put(crate, new THREE.TorusGeometry(0.065, 0.017, 6, 10, Math.PI), rope, sx * (W / 2 + 0.014), H * 0.5, 0);
    r.rotation.set(0, Math.PI / 2, 0);
  }
  // Tip it over: rotation.x = 105 degrees sends the open top (+Y) to (0, -0.26, 0.97),
  // forward and a little down, and the front face (+Z) to the ground, leaning 15 degrees.
  const a = 105 * Math.PI / 180;
  crate.rotation.x = a;
  crate.position.set(0, 0, 0);

  // The crate's lowest point is its front top rail: y = (H + 0.02) cos a - (D/2 + 0.003) sin a.
  // Everything on the ground sits on that level so the mound never hangs below the crate.
  const GROUND = (H + 0.02) * Math.cos(a) - (D / 2 + 0.003) * Math.sin(a);

  // Ice: a low flattened mound in front of the mouth plus chunks, kept within 0.5 m of
  // the crate's back so the whole hazard stays inside the 0.5 m TSV depth.
  const mound = new THREE.Group(); mound.name = 'spill_ice';
  g.add(mound);
  const m1 = put(mound, new THREE.SphereGeometry(0.22, 16, 8), ice, 0, GROUND + 0.22 * 0.28, 0.26); m1.scale.set(1.3, 0.28, 0.85);
  const m2 = put(mound, new THREE.SphereGeometry(0.14, 12, 7), iceLit, 0.04, GROUND + 0.14 * 0.45, 0.16); m2.scale.set(1.4, 0.45, 0.9);
  let seed = 23;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const chunk = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 24; i++) {
    const s = 0.03 + rnd() * 0.03;
    const t = rnd(), spread = 0.06 + t * 0.26;
    const x = (rnd() - 0.5) * (0.3 + t * 0.5);
    const z = 0.02 + spread * 0.95;
    const y = GROUND + s * 0.5 + 0.05 * (1 - t) * (1 - t);
    const c = put(mound, chunk, i % 3 ? ice : iceLit, x, y, z, rnd() * 1.2, rnd() * 3.1, rnd() * 1.2);
    c.scale.set(s, s * (0.7 + rnd() * 0.5), s);
  }
  // Three fish: capsule body squashed flat, box tail, dorsal fin.
  const fish = new THREE.Group(); fish.name = 'spill_fish';
  g.add(fish);
  const fishAt = (x, y, z, ry) => {
    const f = new THREE.Group(); f.position.set(x, y, z); f.rotation.y = ry; fish.add(f);
    const b = put(f, new THREE.CapsuleGeometry(0.03, 0.09, 2, 8), fishMat, 0, 0, 0, 0, 0, Math.PI / 2); b.scale.set(1, 1, 0.6);
    put(f, new THREE.BoxGeometry(0.045, 0.05, 0.01), fishDark, -0.1, 0, 0, 0, 0, 0.35);
    put(f, new THREE.BoxGeometry(0.04, 0.018, 0.012), fishDark, 0.0, 0.03, 0);
  };
  fishAt(0.2, GROUND + 0.05, 0.2, 0.3);
  fishAt(-0.18, GROUND + 0.055, 0.26, -1.2);
  fishAt(0.03, GROUND + 0.07, 0.33, 2.0);

  g.userData.joints = { crate, fish };

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
