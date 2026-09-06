// chaser_buoy c3: c2's reading fixed to the TSV size (0.5 x 0.7 x 0.6). Torpedo capsule
// body 0.4 m across along Z with three proud whitewash hoops (lighter edge rings), a raked
// dorsal fin with a painted top edge, two short stabilisers that stop at 0.25 m from the
// axis, a heavy rubber nose bumper with the coral lens set in it, an exhaust cone at the
// tail. Nose points +Z, base at y = 0 is the body's underside. Joints: body, fin.
export default function (THREE) {
  const g = new THREE.Group();
  const mk = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.45, metalness: 0.15 }, extra || {}));
  const nm = (m, n) => { m.name = n; return m; };

  const coral = nm(mk(0xe8564f), 'metal');
  const coralTop = nm(mk(0xf27a75, { roughness: 0.4 }), 'metal');
  const white = nm(mk(0xf1e6d2), 'metal');
  const whiteShade = nm(mk(0xd6ccb8), 'metal');
  const darkMetal = nm(mk(0x3a3f46, { roughness: 0.5, metalness: 0.25 }), 'metal');
  const rubber = new THREE.MeshStandardMaterial({ color: 0x232528, roughness: 0.85, metalness: 0 });
  const lens = new THREE.MeshStandardMaterial({ color: 0xed5851, roughness: 0.3, emissive: 0xffc48a, emissiveIntensity: 1.1 });

  const R = 0.2, SEG = 14;
  const body = new THREE.Group(); body.name = 'chaser_body';
  body.position.y = R;
  g.add(body);
  const put = (parent, geo, mat, x, y, z, rx, ry, rz) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); parent.add(m); return m;
  };

  // Capsule along Z (built along Y, rotated), squashed a little along its axis so the
  // ends read as fat rounded caps: half length (0.13 + 0.2) * 0.88 = 0.29.
  const cap = put(body, new THREE.CapsuleGeometry(R, 0.26, 3, SEG), coral, 0, 0, 0, Math.PI / 2, 0, 0);
  cap.scale.y = 0.88;
  // Three whitewash hoops, each with a lighter coral edge ring either side (3 sided
  // tube: a painted edge, not a round bead, and a third of the triangles).
  for (const zc of [-0.15, 0, 0.15]) {
    put(body, new THREE.CylinderGeometry(R + 0.012, R + 0.012, 0.07, SEG), white, 0, 0, zc, Math.PI / 2, 0, 0);
    put(body, new THREE.TorusGeometry(R + 0.006, 0.011, 3, SEG), coralTop, 0, 0, zc + 0.04);
    put(body, new THREE.TorusGeometry(R + 0.006, 0.011, 3, SEG), coralTop, 0, 0, zc - 0.04);
  }
  // Nose bumper: rubber cup and fat ring, dark metal socket, lens.
  put(body, new THREE.CylinderGeometry(0.11, 0.135, 0.05, SEG), rubber, 0, 0, 0.27, Math.PI / 2, 0, 0);
  put(body, new THREE.TorusGeometry(0.105, 0.045, 6, SEG), rubber, 0, 0, 0.295);
  put(body, new THREE.CylinderGeometry(0.07, 0.07, 0.02, SEG), darkMetal, 0, 0, 0.3, Math.PI / 2, 0, 0);
  put(body, new THREE.SphereGeometry(0.058, 10, 7), lens, 0, 0, 0.305);
  // Tail exhaust cone and a dark tip.
  put(body, new THREE.CylinderGeometry(0.06, 0.1, 0.06, SEG), darkMetal, 0, 0, -0.3, Math.PI / 2, 0, 0);
  put(body, new THREE.CylinderGeometry(0.045, 0.045, 0.02, SEG), rubber, 0, 0, -0.335, Math.PI / 2, 0, 0);

  // Dorsal fin, pivot at its root on the body's top line. Raked back, tops out at 0.6 m.
  const fin = new THREE.Group(); fin.name = 'chaser_fin';
  fin.position.set(0, R - 0.02, -0.02);
  body.add(fin);
  put(fin, new THREE.BoxGeometry(0.045, 0.19, 0.13), coral, 0, 0.095, -0.03, -0.5, 0, 0);
  put(fin, new THREE.BoxGeometry(0.05, 0.028, 0.14), white, 0, 0.183, -0.075, -0.5, 0, 0);
  put(fin, new THREE.BoxGeometry(0.06, 0.05, 0.2), coral, 0, 0.025, 0.0);
  // Stabilisers: 0.11 m plates from inside the body out to 0.25 m from the axis, swept
  // back and raked up a touch, with a whitewash tip strip.
  for (const s of [-1, 1]) {
    put(body, new THREE.BoxGeometry(0.12, 0.04, 0.15), coral, s * 0.185, -0.01, -0.06, 0, s * -0.25, s * 0.12);
    put(body, new THREE.BoxGeometry(0.018, 0.044, 0.15), whiteShade, s * 0.246, 0.0, -0.08, 0, s * -0.25, s * 0.12);
  }

  g.userData.joints = { body, fin };

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
