// beach_umbrella c2: hand built canopy. Each of the eight panels is a BufferGeometry fan from
// the apex to a scalloped outer arc (the arc bulges outward between the ribs and dips at them,
// so the scallop is in the panel silhouette itself), curved in section by a dome function,
// alternating kerb red and whitewash, DoubleSide. Lighter edge strips as thin quads along each
// scallop, ribs and hub in metal, ball finial. Two part timber pole with a ferrule, leaning into
// a sand mound, a stake with a towel as a bent plane hanging over an arm.
export default function (THREE) {
  const g = new THREE.Group();
  const DS = THREE.DoubleSide;
  const M = (name, color, roughness, extra) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness, metalness: 0 }, extra || {})); m.name = name; return m; };
  const put = (geo, mat, x, y, z, rx, ry, rz, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); (parent || g).add(m); return m; };

  const red = M('fabric', 0xd6402f, 0.8, { side: DS });
  const white = M('fabric', 0xf1e6d2, 0.8, { side: DS });
  const edgeRed = M('fabric', 0xe0584a, 0.75, { side: DS });
  const edgeWhite = M('fabric', 0xf1e6d2, 0.7, { side: DS });
  const rib = M('metal', 0x3a3f46, 0.45, { metalness: 0.2 });
  const pole = M('timber', 0x3f8f8a, 0.7);
  const poleBase = M('timber', 0x33756f, 0.75);
  const ferrule = M('metal', 0x3a3f46, 0.45, { metalness: 0.2 });
  const finial = M('metal', 0x3fb0b8, 0.4, { metalness: 0.2 });
  const towel = M('fabric', 0x3fc7a0, 0.85, { side: DS });
  const sand = M('ground', 0xe6cf9c, 0.9);

  const LEAN = 0.17, PL = 2.0;
  const rig = new THREE.Group(); rig.position.set(0, 0.3, 0); rig.rotation.z = -LEAN; g.add(rig);
  put(new THREE.CylinderGeometry(0.03, 0.03, PL * 0.55, 10), pole, 0, PL * 0.275, 0, 0, 0, 0, rig);
  put(new THREE.CylinderGeometry(0.028, 0.03, PL * 0.45, 10), pole, 0, PL * 0.775, 0, 0, 0, 0, rig);
  put(new THREE.CylinderGeometry(0.036, 0.036, 0.06, 10), ferrule, 0, PL * 0.55, 0, 0, 0, 0, rig);
  put(new THREE.CylinderGeometry(0.036, 0.036, 0.4, 10), poleBase, 0, 0.2, 0, 0, 0, 0, rig);
  const canopy = new THREE.Group(); canopy.position.y = PL - 0.48; rig.add(canopy);

  const R = 1.2, APEX = 0.5;
  const dome = (r) => APEX * (1 - Math.pow(r / R, 1.7));
  const SEGS = 6;
  for (let i = 0; i < 8; i++) {
    const a0 = i * Math.PI / 4, a1 = (i + 1) * Math.PI / 4;
    const arr = [], edge = [];
    for (let k = 0; k < SEGS; k++) {
      const t0 = k / SEGS, t1 = (k + 1) / SEGS;
      const b0 = a0 + (a1 - a0) * t0, b1 = a0 + (a1 - a0) * t1;
      // scalloped rim radius: dips at the ribs, bulges at the middle of the panel
      const rr0 = R * (0.94 + 0.08 * Math.sin(Math.PI * t0)), rr1 = R * (0.94 + 0.08 * Math.sin(Math.PI * t1));
      const p0 = [Math.cos(b0) * rr0, dome(rr0) - 0.02 * Math.sin(Math.PI * t0), Math.sin(b0) * rr0];
      const p1 = [Math.cos(b1) * rr1, dome(rr1) - 0.02 * Math.sin(Math.PI * t1), Math.sin(b1) * rr1];
      const q0 = [Math.cos(b0) * rr0 * 0.55, dome(rr0 * 0.55), Math.sin(b0) * rr0 * 0.55];
      const q1 = [Math.cos(b1) * rr1 * 0.55, dome(rr1 * 0.55), Math.sin(b1) * rr1 * 0.55];
      arr.push(0, APEX, 0, ...q0, ...q1);
      arr.push(...q0, ...p0, ...p1, ...q0, ...p1, ...q1);
      // edge strip: a thin quad hanging 0.045 below the rim
      const d0 = [p0[0], p0[1] - 0.045, p0[2]], d1 = [p1[0], p1[1] - 0.045, p1[2]];
      edge.push(...p0, ...d0, ...d1, ...p0, ...d1, ...p1);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); geo.computeVertexNormals();
    put(geo, i % 2 ? white : red, 0, 0, 0, 0, 0, 0, canopy);
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(edge, 3)); eg.computeVertexNormals();
    put(eg, i % 2 ? edgeWhite : edgeRed, 0, 0, 0, 0, 0, 0, canopy);
    // rib: a cylinder from just under the hub to just inside the rim, under the fabric
    const ra = new THREE.Vector3(0, APEX - 0.035, 0), rb = new THREE.Vector3(Math.cos(a0) * R * 0.94, dome(R * 0.94) - 0.03, Math.sin(a0) * R * 0.94);
    const rd = rb.clone().sub(ra), rl = rd.length();
    const ribm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, rl, 6), rib);
    ribm.position.copy(ra).add(rb).multiplyScalar(0.5);
    ribm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), rd.normalize());
    canopy.add(ribm);
  }
  put(new THREE.CylinderGeometry(0.07, 0.09, 0.08, 10), rib, 0, APEX + 0.02, 0, 0, 0, 0, canopy);
  put(new THREE.SphereGeometry(0.075, 10, 8), finial, 0, APEX + 0.13, 0, 0, 0, 0, canopy);

  const mound = put(new THREE.SphereGeometry(0.95, 14, 5, 0, Math.PI * 2, 0, Math.PI / 2), sand, 0.1, 0, 0);
  mound.scale.y = 0.33;
  // stake, arm, towel as a bent plane over the arm
  put(new THREE.BoxGeometry(0.06, 0.62, 0.06), pole, 0.5, 0.5, 0.15, 0, 0.3, 0);
  put(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), pole, 0.27, 0.78, 0.08, 0, 0, Math.PI / 2 + 0.15);
  const tw = new THREE.PlaneGeometry(0.34, 0.9, 1, 10);
  const tp = tw.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const s = (tp.getY(i) + 0.45) / 0.9;          // 0 at one hem, 1 at the other
    const ang = Math.PI * s;                       // fold over the arm
    tp.setXYZ(i, tp.getX(i), 0.38 * Math.sin(ang) - 0.02, 0.2 * Math.cos(ang) + 0.12);
  }
  tw.computeVertexNormals();
  put(tw, towel, 0.35, 0.44, 0);

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
