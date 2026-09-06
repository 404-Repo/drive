// cannonball c0: primitive assembly. Two hemispheres (bleached upper, darker lower) on a
// slightly wider equator band with a lighter top edge ring, a square lug on top, and four
// shallow dents pressed into the shell by displacing vertices. 20 x 14 segments.
export default function (THREE) {
  const g = new THREE.Group();
  const mk = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.5, metalness: 0.25 }, extra || {}));
  const nm = (m, n) => { m.name = n; return m; };

  const upper = nm(mk(0x585e68), 'metal');
  const lower = nm(mk(0x3a3f46), 'metal');
  const band = nm(mk(0x474c54), 'metal');
  const bandEdge = nm(mk(0x6b6660, { roughness: 0.45 }), 'metal'); // warm lighter rim
  const lugMat = nm(mk(0x5c6069), 'metal');
  const lugTop = nm(mk(0x72767e, { roughness: 0.45 }), 'metal');

  const R = 0.215;
  const body = new THREE.Group(); body.name = 'cannonball_body';
  body.position.y = R;
  g.add(body);

  // Press four dents into a sphere geometry: inward displacement with a smooth falloff.
  const dent = (geo, dirs, width, depth) => {
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const len = v.length(); if (len < 1e-6) continue;
      const n = v.clone().divideScalar(len);
      let push = 0;
      for (const d of dirs) {
        const ang = Math.acos(Math.max(-1, Math.min(1, n.dot(d))));
        if (ang < width) { const t = 1 - ang / width; push = Math.max(push, depth * t * t * (3 - 2 * t)); }
      }
      if (push > 0) { v.multiplyScalar((len - push) / len); p.setXYZ(i, v.x, v.y, v.z); }
    }
    p.needsUpdate = true; geo.computeVertexNormals();
  };
  const dirs = [
    new THREE.Vector3(0.7, 0.55, 0.45).normalize(),
    new THREE.Vector3(-0.8, 0.35, -0.4).normalize(),
    new THREE.Vector3(0.3, -0.5, -0.8).normalize(),
    new THREE.Vector3(-0.5, -0.3, 0.8).normalize(),
  ];
  const up = new THREE.SphereGeometry(R, 20, 7, 0, Math.PI * 2, 0, Math.PI / 2);
  const dn = new THREE.SphereGeometry(R, 20, 7, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  dent(up, dirs, 0.42, 0.014); dent(dn, dirs, 0.42, 0.014);
  const upM = new THREE.Mesh(up, upper); upM.scale.y = 0.97; upM.position.y = 0.012; body.add(upM);
  const dnM = new THREE.Mesh(dn, lower); dnM.scale.y = 0.97; dnM.position.y = -0.012; body.add(dnM);
  // Equator band: a shade wider so it reads as a flattened belt, with a lighter top rim.
  const bandM = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.008, R + 0.008, 0.05, 20), band); body.add(bandM);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.004, 0.008, 6, 20), bandEdge);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.026; body.add(rim);
  // Square lug on top with a lighter top plate.
  const lug = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.032, 0.085), lugMat);
  lug.position.y = R * 0.97 + 0.012 + 0.008; body.add(lug);
  const lugCap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.06), lugTop);
  lugCap.position.y = lug.position.y + 0.022; body.add(lugCap);

  g.userData.joints = { body };

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
