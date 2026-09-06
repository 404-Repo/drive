// pine_umbrella c3 (fix round 1): the crown is a CANOPY OF ALPHA CARDS, no lathe tiers. Round 1's
// critic read the c1 crown (three stacked lathe domes with six cards hanging under them) as a green
// disc on a stick. Now the trunk is the same lathe with a root flare bent into the lean, three two
// segment branches fork at 5 m, and the crown is eighteen pine bough cutout cards laid nearly flat
// in three rings (outer ring drooping outward, middle ring tilted, inner ring higher and steeper)
// plus three near vertical cards crossing the centre so the canopy has depth from the side, all
// around a small jittered dark core that hides the card junction. From an oblique motion frame the
// silhouette is broken foliage clusters at different heights, never one primitive.
export default function (THREE) {
  const g = new THREE.Group();
  const DS = THREE.DoubleSide;
  const M = (name, color, roughness, extra) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness, metalness: 0 }, extra || {})); m.name = name; return m; };
  const put = (geo, mat, x, y, z, rx, ry, rz, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); (parent || g).add(m); return m; };
  const V2 = (x, y) => new THREE.Vector2(x, y);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const UP = V3(0, 1, 0);
  const hash = (i, j) => { const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return s - Math.floor(s); };
  const limb = (a, b, ra, rb, mat, seg) => {
    const d = b.clone().sub(a), L = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rb, ra, L, seg || 10), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UP, d.normalize());
    g.add(m);
    return m;
  };

  const bark = M('timber', 0x7a4a3c, 0.85);
  const barkBase = M('timber', 0x5e3a30, 0.9);
  const lip = M('timber', 0x8f5a48, 0.8);
  const core = M('foliage', 0x2a5233, 0.9, { flatShading: true });
  // one card material per texture, each a UNIQUE colour so the loader never welds a with b
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

  // crown centre and three branches to it, each forking once more into the canopy
  const CX = fork.x - 0.6, CY = 8.2, CZ = 0.2;
  const ends = [V3(CX - 2.6, CY + 0.5, CZ - 1.4), V3(CX + 2.8, CY + 0.6, CZ + 0.6), V3(CX + 0.2, CY + 0.8, CZ + 2.6)];
  ends.forEach((e, i) => {
    const mid = fork.clone().lerp(e, 0.5).add(V3(0, 0.35, 0));
    limb(fork, mid, 0.2, 0.15, bark);
    limb(mid, e, 0.15, 0.1, bark);
    // a twig off each branch out to the outer ring
    const t = mid.clone().lerp(e, 0.6);
    const dir = e.clone().sub(fork).setY(0).normalize();
    const side = V3(-dir.z, 0, dir.x).multiplyScalar(i % 2 ? 1.4 : -1.4);
    limb(t, t.clone().add(dir.clone().multiplyScalar(1.6)).add(side).add(V3(0, 0.5, 0)), 0.1, 0.06, bark, 8);
  });

  // dark jittered core at the junction so no gap between cards shows sky through the canopy
  const coreGeo = new THREE.IcosahedronGeometry(1.7, 1);
  {
    const p = coreGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const j = 0.82 + 0.36 * hash(i, 7);
      p.setXYZ(i, p.getX(i) * 1.25 * j, p.getY(i) * 0.42 * j, p.getZ(i) * 1.25 * j);
    }
    coreGeo.computeVertexNormals();
  }
  put(coreGeo, core, CX, CY + 0.55, CZ);

  // the canopy: bough cards. Geometry lies flat (u along +x, normal +y); mesh order YZX so the droop
  // about z is applied first, then the yaw, so every card droops OUTWARD along its own radius.
  const cardGeo = (L, W, flipU) => {
    const geo = new THREE.PlaneGeometry(L, W);
    geo.rotateX(-Math.PI / 2);
    // the stem end of the picture sits at u = 1 on bough a and at u = 0 on bough b (checked on the
    // atlas); the card's stem end must be the end nearest the crown centre, so bough a is flipped
    if (flipU) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
    geo.translate(L * 0.32, 0, 0);   // pivot near the stem end, not the card centre
    return geo;
  };
  const card = (mat, L, r, a, y, droop, roll) => {
    const m = new THREE.Mesh(cardGeo(L, L / 1.72, mat === ba), mat);
    m.position.set(CX + Math.cos(a) * r, y, CZ + Math.sin(a) * r);
    m.rotation.order = 'YZX';
    m.rotation.set(roll, -a, -droop);
    g.add(m);
    return m;
  };
  // outer ring: 8 long cards drooping 12 to 20 degrees (the umbrella edge), alternating textures
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + 0.2 + 0.25 * (hash(i, 1) - 0.5);
    card(i % 2 ? ba : bb, 4.8 + 0.5 * hash(i, 2), 1.0, a, CY + 0.1 + 0.5 * (hash(i, 3) - 0.5), 0.2 + 0.15 * hash(i, 4), 0.3 * (hash(i, 5) - 0.5));
  }
  // middle ring: 6 cards higher and nearly flat
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + 0.75 + 0.3 * (hash(i, 11) - 0.5);
    card(i % 2 ? bb : ba, 4.2 + 0.5 * hash(i, 12), 0.5, a, CY + 0.9 + 0.5 * (hash(i, 13) - 0.5), 0.05 + 0.15 * hash(i, 14), 0.4 * (hash(i, 15) - 0.5));
  }
  // inner ring: 4 short flat cards making the flat top
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 1.3 + 0.3 * (hash(i, 21) - 0.5);
    card(i % 2 ? ba : bb, 3.2 + 0.4 * hash(i, 22), 0.2, a, CY + 1.5 + 0.4 * (hash(i, 23) - 0.5), -0.1 + 0.2 * hash(i, 24), 0.5 * (hash(i, 25) - 0.5));
  }
  // three near vertical cards through the centre so the canopy has depth seen from the side
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI / 3 + 0.5;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.6), i % 2 ? bb : ba);
    m.position.set(CX + Math.cos(a) * 0.25, CY + 0.85, CZ + Math.sin(a) * 0.25);
    m.rotation.order = 'YXZ';
    m.rotation.set(0.22 * (hash(i, 31) - 0.5), -a + Math.PI / 2, 0.12 * (hash(i, 32) - 0.5));
    g.add(m);
  }

  // root mound and fillet
  put(new THREE.LatheGeometry([V2(0, 0), V2(1.7, 0), V2(1.2, 0.3), V2(0.8, 0.6), V2(0.5, 0.75), V2(0, 0.8)], 12), barkBase, 0, 0, 0);
  put(new THREE.LatheGeometry([V2(0, 0), V2(2.4, 0), V2(2.15, 0.1), V2(1.6, 0.18), V2(0, 0.2)], 14), grass, 0, 0, 0);
  put(new THREE.LatheGeometry([V2(0, 0), V2(2.9, 0), V2(2.55, 0.06), V2(0, 0.06)], 14), sand, 0, 0, 0);

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
