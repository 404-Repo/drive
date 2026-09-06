// foam_shield c3: c0's reading brought toward the item triangle band. A 2.4 m translucent
// foam sphere (20 x 12, DoubleSide, 0.35 opacity, faint emissive), twelve bubbles of 0.15 to
// 0.3 m half embedded in the surface (8 x 5 each), a whitewash equator ring with a darker
// underside half. Base at y = 0 so the shell touches the ground at a kart's position.
// Joints: shell, bubbles.
export default function (THREE) {
  const g = new THREE.Group();
  const R = 1.2;

  const shellMat = new THREE.MeshStandardMaterial({ color: 0xb9e4e4, roughness: 0.3, metalness: 0.0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, emissive: 0x3fb0b8, emissiveIntensity: 0.12, depthWrite: false });
  const bubbleMat = new THREE.MeshStandardMaterial({ color: 0xd8f2f2, roughness: 0.2, metalness: 0.0, transparent: true, opacity: 0.62, emissive: 0x3fb0b8, emissiveIntensity: 0.1 });
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xf1e6d2, roughness: 0.55, metalness: 0.05 }); ringMat.name = 'plaster';
  const ringShade = new THREE.MeshStandardMaterial({ color: 0xd9cfbc, roughness: 0.6, metalness: 0.05 }); ringShade.name = 'plaster';

  const shell = new THREE.Group(); shell.name = 'foam_shell';
  shell.position.y = R;
  g.add(shell);
  shell.add(new THREE.Mesh(new THREE.SphereGeometry(R, 20, 12), shellMat));

  // Equator ring: a whitewash torus with a darker half ring tucked under it.
  const ringHi = new THREE.Mesh(new THREE.TorusGeometry(R + 0.012, 0.03, 5, 24), ringMat);
  ringHi.rotation.x = Math.PI / 2; ringHi.position.y = 0.012; shell.add(ringHi);
  const ringLo = new THREE.Mesh(new THREE.TorusGeometry(R + 0.006, 0.026, 4, 24), ringShade);
  ringLo.rotation.x = Math.PI / 2; ringLo.position.y = -0.022; shell.add(ringLo);

  // Twelve bubbles on the surface, deterministic spread, away from the poles.
  const bubbles = new THREE.Group(); bubbles.name = 'foam_bubbles';
  shell.add(bubbles);
  let seed = 3;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < 12; i++) {
    const r = 0.075 + rnd() * 0.075;
    const az = (i / 12) * Math.PI * 2 + rnd() * 0.4;
    const el = (rnd() - 0.5) * 1.5;
    const d = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 5), bubbleMat);
    b.position.copy(d).multiplyScalar(R - r * 0.35);
    bubbles.add(b);
  }

  g.userData.joints = { shell, bubbles };

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
