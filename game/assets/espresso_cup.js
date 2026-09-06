// espresso_cup c3: c2's chunky toy reading brought into the item triangle band (16 segment
// cylinders, 5 x 16 tori, 2 x 8 capsules) with a slightly fatter handle. Whitewash cup with
// a fat rolled coral rim, saucer with a coral edge torus and a raised centre well, squared C
// handle from three capsules on +X, coffee fill disc, two hand built twisted steam ribbons.
// Joints: cup, steam.
export default function (THREE) {
  const g = new THREE.Group();
  const mk = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0.0 }, extra || {}));
  const nm = (m, n) => { m.name = n; return m; };

  const white = nm(mk(0xf1e6d2, { side: THREE.DoubleSide }), 'plaster');
  const whiteShade = nm(mk(0xdcd1bd), 'plaster');
  const foot = nm(mk(0xc4b7a0), 'plaster');
  const coral = nm(mk(0xed5851), 'plaster');
  const coralLight = nm(mk(0xf27a75), 'plaster');
  const coffee = new THREE.MeshStandardMaterial({ color: 0x4a2c1a, roughness: 0.3, metalness: 0.0 });
  const steamMat = nm(mk(0xe9dfd0, { roughness: 0.7, side: THREE.DoubleSide }), 'fabric');

  const SEG = 16;
  const cup = new THREE.Group(); cup.name = 'espresso_cup_body';
  g.add(cup);
  const put = (parent, geo, mat, x, y, z, rx, ry, rz) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); parent.add(m); return m;
  };
  // Saucer: whitewash dish, coral edge torus, raised centre well.
  put(cup, new THREE.CylinderGeometry(0.235, 0.2, 0.03, SEG), whiteShade, 0, 0.015, 0);
  put(cup, new THREE.TorusGeometry(0.235, 0.016, 5, SEG), coral, 0, 0.03, 0, Math.PI / 2, 0, 0);
  put(cup, new THREE.CylinderGeometry(0.15, 0.15, 0.012, SEG), white, 0, 0.036, 0);
  // Cup: foot band, body, inner base, fat coral rim torus with a light top ring.
  put(cup, new THREE.CylinderGeometry(0.15, 0.135, 0.04, SEG), foot, 0, 0.062, 0);
  put(cup, new THREE.CylinderGeometry(0.19, 0.15, 0.23, SEG, 1, true), white, 0, 0.195, 0);
  put(cup, new THREE.CylinderGeometry(0.15, 0.15, 0.02, SEG), foot, 0, 0.09, 0);
  put(cup, new THREE.TorusGeometry(0.185, 0.028, 5, SEG), coral, 0, 0.31, 0, Math.PI / 2, 0, 0);
  put(cup, new THREE.TorusGeometry(0.185, 0.01, 4, SEG), coralLight, 0, 0.332, 0, Math.PI / 2, 0, 0);
  put(cup, new THREE.CircleGeometry(0.168, SEG), coffee, 0, 0.285, 0, -Math.PI / 2, 0, 0);
  // Handle: squared C from three fat capsules on +X.
  put(cup, new THREE.CapsuleGeometry(0.03, 0.06, 2, 8), white, 0.235, 0.255, 0, 0, 0, Math.PI / 2);
  put(cup, new THREE.CapsuleGeometry(0.03, 0.12, 2, 8), white, 0.265, 0.19, 0);
  put(cup, new THREE.CapsuleGeometry(0.03, 0.07, 2, 8), white, 0.225, 0.125, 0, 0, 0, Math.PI / 2);

  // Steam: twisted ribbon strips built by hand, rising and narrowing.
  const steam = new THREE.Group(); steam.name = 'espresso_steam';
  steam.position.y = 0.3;
  g.add(steam);
  const twistRibbon = (x0, z0, h, w0, twist, lean, phase) => {
    const N = 16, pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = phase + t * twist;
      const w = w0 * (1 - 0.55 * t);
      const cx = x0 + Math.sin(t * Math.PI * 1.5 + phase) * lean, cz = z0 + Math.cos(t * Math.PI * 1.2 + phase) * lean * 0.6;
      pos.push(cx - Math.cos(a) * w, t * h, cz - Math.sin(a) * w, cx + Math.cos(a) * w, t * h, cz + Math.sin(a) * w);
      if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    return new THREE.Mesh(geo, steamMat);
  };
  steam.add(twistRibbon(-0.04, 0.0, 0.2, 0.032, Math.PI * 2.5, 0.025, 0));
  steam.add(twistRibbon(0.045, 0.01, 0.19, 0.03, Math.PI * 2.5, 0.022, 1.7));

  g.userData.joints = { cup, steam };

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
