// kart_wheel c3 (round 1 hero pass): one chunky rolling unit at 20 radial segments. The tyre is a
// revolved section built by hand so the crown carries ten raised tread blocks round the
// circumference (every other segment stands 7 mm proud, flat shaded so the blocks read at speed),
// rounded shoulders, a dished dark metal hub with a rim lip, five box spokes, five hex lug nuts
// and a raised livery centre cap. Axle along X under userData.joints.spin; outboard face is +X.
// Round 2: tread blocks 11 mm proud with a deeper groove so the tread reads from the chase camera,
// and the rubber at roughness 0.6 so the crown carries a soft sun sheen instead of a matte black disc.
export default function (THREE) {
  const g = new THREE.Group();
  const PI = Math.PI;
  const SEG = 20;
  const mat = (name, hex, rough, metal, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: metal || 0 }, extra || {}));
    if (name) m.name = name; return m;
  };
  const mesh = (parent, geo, m, x, y, z, rx, ry, rz) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.rotation.set(rx || 0, ry || 0, rz || 0); parent.add(o); return o;
  };
  const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg || SEG);
  const DS = { side: THREE.DoubleSide };
  const rubber = mat(null, 0x232528, 0.6, 0, DS);
  const tread = rubber;   // one rubber bucket per wheel (integrator, round 1: the tread blocks read by their flat shaded facets, and the second dark material cost 3 draws per kart)
  const dark = mat('metal', 0x3a3f46, 0.45, 0.25, DS);
  const darkL = mat('metal', 0x4c525c, 0.45, 0.25, DS);
  const darkD = mat('metal', 0x30343a, 0.5, 0.25, DS);
  const cap = mat('metal', 0xed5851, 0.35, 0.15);

  const spin = new THREE.Group(); spin.name = 'joint_spin'; spin.position.set(0, 0.229, 0); g.add(spin);

  // revolved section about the X axis: profile rows are (axial x, radius); rings between consecutive
  // rows; radius per row may vary with the segment (the tread blocks). flat: split faces for facets.
  const revolve = (rows, radiusAt, flat) => {
    const pos = [];
    // vertex at row i, column j; when flat the radius of column j + 1 is the radius decided by
    // segment j, so a raised block has vertical walls at both of its circumferential ends
    const P = (i, j, seg) => {
      const a = (j / SEG) * 2 * PI;
      const r = radiusAt(i, ((flat ? seg : j) % SEG + SEG) % SEG);
      return [rows[i][0], Math.cos(a) * r, Math.sin(a) * r];
    };
    for (let i = 0; i + 1 < rows.length; i++) {
      for (let j = 0; j < SEG; j++) {
        const a = P(i, j, j), b = P(i, j + 1, j), c = P(i + 1, j, j), d = P(i + 1, j + 1, j);
        pos.push(...a, ...c, ...b, ...b, ...c, ...d);
        if (flat) {   // the block wall at column j + 1, from this segment's radius to the next one's
          const a2 = P(i, j + 1, j), b2 = P(i, j + 1, j + 1), c2 = P(i + 1, j + 1, j), d2 = P(i + 1, j + 1, j + 1);
          pos.push(...a2, ...c2, ...b2, ...b2, ...c2, ...d2);
        }
      }
    }
    let geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (!flat) geo = mergeVertices(geo);
    geo.computeVertexNormals();
    return geo;
  };
  // smooth ring welding for the shoulders: index by position key
  const mergeVertices = (geo) => {
    const p = geo.attributes.position; const map = new Map(); const idx = []; const out = [];
    for (let i = 0; i < p.count; i++) {
      const k = p.getX(i).toFixed(5) + ',' + p.getY(i).toFixed(5) + ',' + p.getZ(i).toFixed(5);
      let id = map.get(k);
      if (id === undefined) { id = out.length / 3; map.set(k, id); out.push(p.getX(i), p.getY(i), p.getZ(i)); }
      idx.push(id);
    }
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
    g2.setIndex(idx);
    return g2;
  };

  // shoulders (smooth): bead to the crown edge, both sides
  const shoulderL = [[-0.12, 0.128], [-0.112, 0.20], [-0.072, 0.221]];
  const shoulderR = [[0.072, 0.221], [0.112, 0.20], [0.12, 0.128]];
  mesh(spin, revolve(shoulderL, (i) => shoulderL[i][1], false), rubber);
  mesh(spin, revolve(shoulderR, (i) => shoulderR[i][1], false), rubber);
  // crown (flat shaded, gently domed): raised blocks on every other segment with vertical walls
  const crown = [[-0.072, 0.221], [0, 0.223], [0.072, 0.221]];
  const block = (j) => (j % 2 === 0 ? 0.011 : -0.006);
  mesh(spin, revolve(crown, (i, j) => crown[i][1] + block(j), true), tread);

  // hub: a dish with a rim lip on the outboard (+X) face, a flat back plate inboard
  const hub = lathe([[0.128, 0.122], [0.14, 0.108], [0.105, 0.06], [0.05, 0.035]]);
  mesh(spin, hub, dark, 0, 0, 0, 0, 0, -PI / 2);
  mesh(spin, new THREE.CircleGeometry(0.128, SEG), darkD, -0.11, 0, 0, 0, -PI / 2, 0);
  // five spokes from the dish floor to the rim
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 2 * PI + 0.3;
    const s = mesh(spin, new THREE.BoxGeometry(0.044, 0.04, 0.08), dark, 0.068, Math.sin(a) * 0.072, Math.cos(a) * 0.072);
    s.rotation.x = -a;
    // a hex lug nut on the dish between spokes
    const b = a + PI / 5;
    const n = mesh(spin, new THREE.CylinderGeometry(0.014, 0.014, 0.016, 6, 1, true), darkL, 0.052, Math.sin(b) * 0.056, Math.cos(b) * 0.056, 0, 0, PI / 2);
    n.rotation.x = -b;
  }
  // raised centre cap in the livery
  mesh(spin, new THREE.CylinderGeometry(0.046, 0.052, 0.036, 12), cap, 0.085, 0, 0, 0, 0, PI / 2);

  g.userData.joints = { spin };
  g.userData.spinAxis = 'x';
  g.userData.outboard = '+x';
  g.userData.mounts = 'left';
  g.userData.livery = 'metal:' + cap.color.getHexString();

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
