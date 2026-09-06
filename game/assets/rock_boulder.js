// rock_boulder c0: faceted lathe. Three LatheGeometry sweeps with only seven radial segments
// and flat shading (a base band in stone shade, the warm stone body, a bleached top cap), the
// whole scaled 1.2 on x to 2.4 x 2.0 m, a shallow crack strip on one face, a sand fillet ring.
export default function (THREE) {
  const g = new THREE.Group();
  const M = (name, color, roughness, extra) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness, metalness: 0 }, extra || {})); m.name = name; return m; };
  const put = (geo, mat, x, y, z, rx, ry, rz, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); (parent || g).add(m); return m; };
  const V2 = (x, y) => new THREE.Vector2(x, y);

  const body = M('stone', 0xcdb897, 0.8, { flatShading: true });
  const band = M('stone', 0x8d7b63, 0.85, { flatShading: true });
  const top = M('stone', 0xe0d0b0, 0.75, { flatShading: true });
  const crack = M('stone', 0x8d7b63, 0.9);
  const sand = M('ground', 0xe6cf9c, 0.9);

  const rock = new THREE.Group(); rock.scale.set(1.2, 1, 1); rock.rotation.y = 0.2; g.add(rock);
  const SEG = 7;
  put(new THREE.LatheGeometry([V2(0, 0), V2(0.92, 0), V2(1.0, 0.25), V2(0, 0.25)], SEG), band, 0, 0, 0, 0, 0, 0, rock);
  put(new THREE.LatheGeometry([V2(0, 0.25), V2(1.0, 0.25), V2(0.97, 0.8), V2(0.9, 1.25), V2(0.76, 1.5), V2(0, 1.5)], SEG), body, 0, 0, 0, 0, 0, 0, rock);
  put(new THREE.LatheGeometry([V2(0, 1.49), V2(0.78, 1.49), V2(0.7, 1.57), V2(0.35, 1.62), V2(0, 1.62)], SEG), top, 0, 0, 0, 0, 0, 0, rock);
  // crack: a thin dark zigzag of two strips on the front face
  put(new THREE.BoxGeometry(0.04, 0.3, 0.03), crack, -0.22, 0.95, 0.92, 0, 0, 0.35, rock);
  put(new THREE.BoxGeometry(0.04, 0.26, 0.03), crack, -0.14, 0.7, 0.95, 0, 0, -0.4, rock);
  // fillet
  put(new THREE.CylinderGeometry(1.02, 1.08, 0.06, 14), sand, 0, 0.03, 0, 0, 0, 0, rock);

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
