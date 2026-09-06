// pine_umbrella c1: profile sweeps. The trunk is a LatheGeometry with a root flare, bent after
// construction into the lean; the crown is a stepped lathe dome in three tiers like the
// reference's stacked layers, with a lighter lathe cap for the bleached top, and six pine bough
// cards hanging off the rim tilted down. Three branches as two segment limbs. Lathe root mound,
// lathe grass fillet on a sand ring.
export default function (THREE) {
  const g = new THREE.Group();
  const DS = THREE.DoubleSide;
  const M = (name, color, roughness, extra) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness, metalness: 0 }, extra || {})); m.name = name; return m; };
  const put = (geo, mat, x, y, z, rx, ry, rz, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); (parent || g).add(m); return m; };
  const V2 = (x, y) => new THREE.Vector2(x, y);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const UP = V3(0, 1, 0);
  const limb = (a, b, ra, rb, mat, seg) => {
    const d = b.clone().sub(a), L = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rb, ra, L, seg || 12), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UP, d.normalize());
    g.add(m);
    return m;
  };

  const bark = M('timber', 0x7a4a3c, 0.85);
  const barkBase = M('timber', 0x5e3a30, 0.9);
  const lip = M('timber', 0x8f5a48, 0.8);
  const crownA = M('foliage', 0x2f5e3a, 0.85);
  const crownB = M('foliage', 0x2b5836, 0.85);
  const crownTop = M('foliage', 0x6f8a5c, 0.8);
  const ba = M('card:pine_bough_a', 0x2f5e3a, 0.85, { side: DS });
  const bb = M('card:pine_bough_b', 0x33623d, 0.85, { side: DS });
  const grass = M('ground', 0x9aa64a, 0.9);
  const sand = M('ground', 0xe6cf9c, 0.9);

  // trunk lathe with root flare, bent along x by lean(y)
  const FORK = 5.0;
  const lean = (y) => 1.6 * Math.pow(Math.max(0, y) / FORK, 1.4);
  const bend = (geo) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + lean(p.getY(i)));
    geo.computeVertexNormals();
    return geo;
  };
  put(bend(new THREE.LatheGeometry([V2(0, 0), V2(0.75, 0), V2(0.62, 0.3), V2(0.44, 0.7), V2(0.38, 0.88), V2(0, 0.88)], 14)), barkBase, 0, 0, 0);
  put(bend(new THREE.LatheGeometry([V2(0, 0.88), V2(0.36, 0.88), V2(0.32, 2.0), V2(0.27, 3.5), V2(0.22, FORK), V2(0, FORK)], 14)), bark, 0, 0, 0);
  [0.88, 2.0, 3.5].forEach((y) => put(new THREE.CylinderGeometry(0.4 - 0.036 * y, 0.4 - 0.036 * y, 0.06, 14, 1, true), lip, lean(y), y, 0));
  const fork = V3(lean(FORK), FORK, 0);
  put(new THREE.SphereGeometry(0.25, 10, 7), bark, fork.x, fork.y, fork.z);

  // crown centre and three branches to it
  const CX = fork.x - 0.6, CY = 8.2, CZ = 0.2;
  const ends = [V3(CX - 2.6, CY + 0.7, CZ - 1.4), V3(CX + 2.8, CY + 0.8, CZ + 0.6), V3(CX + 0.2, CY + 1.0, CZ + 2.6)];
  ends.forEach((e) => {
    const mid = fork.clone().lerp(e, 0.5).add(V3(0, 0.35, 0));
    limb(fork, mid, 0.2, 0.15, bark);
    limb(mid, e, 0.15, 0.1, bark);
  });

  // stepped crown dome, three tiers, each its own lathe so tints alternate
  const tier = (y0, y1, r0, r1, r2, mat) => put(new THREE.LatheGeometry([V2(0, y0), V2(r0, y0), V2(r1, y0 + (y1 - y0) * 0.45), V2(r2, y1), V2(0, y1)], 20), mat, CX, 0, CZ);
  tier(CY - 0.6, CY + 0.35, 3.0, 4.95, 4.4, crownA);
  tier(CY + 0.3, CY + 1.3, 3.6, 4.3, 3.5, crownB);
  tier(CY + 1.25, CY + 2.2, 2.6, 3.3, 2.3, crownA);
  put(new THREE.LatheGeometry([V2(0, CY + 2.18), V2(2.35, CY + 2.18), V2(2.0, CY + 2.4), V2(0.8, CY + 2.5), V2(0, CY + 2.52)], 20), crownTop, CX, 0, CZ);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + 0.4;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 3.4), i % 2 ? ba : bb);
    card.position.set(CX + Math.cos(a) * 2.6, CY - 0.25 + 0.5 * (i % 2), CZ + Math.sin(a) * 2.6);
    card.rotation.order = 'YXZ';
    card.rotation.set(-Math.PI / 2 + 0.33, -a + Math.PI / 2, 0);
    g.add(card);
  }

  // root mound and fillet
  put(new THREE.LatheGeometry([V2(0, 0), V2(1.7, 0), V2(1.2, 0.3), V2(0.8, 0.6), V2(0.5, 0.75), V2(0, 0.8)], 12), barkBase, 0, 0, 0);
  put(new THREE.LatheGeometry([V2(0, 0), V2(2.4, 0), V2(2.15, 0.1), V2(1.6, 0.18), V2(0, 0.2)], 16), grass, 0, 0, 0);
  put(new THREE.LatheGeometry([V2(0, 0), V2(2.9, 0), V2(2.55, 0.06), V2(0, 0.06)], 16), sand, 0, 0, 0);

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
