// spectator_group c2 (fix round 5, Ben's crowd depth round): a DEPTH SET instead of one card.
// Three crowd card layers 0.45 m apart, each layer the picture cut into five slices at the dips of
// its own top edge (the head gaps, measured on the shipped atlas cutouts: crowd_a, crowd_b, crowd_c
// in work/fix1_render/cards_src) so no slice edge cuts a head; every slice sits at its own height,
// yaw and depth jitter so a layer's top edge is heads, hats, arms and flags at three depths and
// never one straight line; the end slice of every layer swings back 27 degrees so the pictures' cut
// side edges recede. Back layers are wider (3.15 and 3.3 m against 3.0), raised, and darker and
// cooler through a vertex colour (crowd cards have tint 0 in the render table, so the material colour
// cannot darken them; vertexColors + a colour attribute multiplies the picture in the bake, and
// render/materials.js tintCardDepth leaves an authored colour attribute alone). Card heights follow
// each picture's own aspect (never stretched). The modelled FRONT ROW of figures is the level's
// (src/level/crowdrow.js makeCrowdFront stands 3 to 4 figures at z 0.62 in front of every group and
// one over the outer cut edge of a run), so this asset carries none of its own and the two never
// interpenetrate. Joints kept: crowd, row_a, row_b, row_c (nothing animates them since round 2, kept
// for the keepHierarchy loader). Slices are 2 x 2 segment planes curved 4 cm toward the road; the raised
// back row stands on a timber step. 168 tris, card group band 20 to 200.
export default function (THREE) {
  const g = new THREE.Group();
  const PI = Math.PI, DS = THREE.DoubleSide;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const shade = (hex, l, s, cool) => { const c = new THREE.Color(hex); const h = {}; c.getHSL(h); c.setHSL(h.h, clamp(h.s * (s === undefined ? 1 : s)), clamp(h.l * (1 + l))); if (cool) c.lerp(new THREE.Color(0x4a5a78), cool); return c; };
  const M = (name, color, rough, metal, extra) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal || 0 }, extra || {})); if (name) m.name = name; return m; };
  const add = (geo, mat, x, y, z, parent) => { const o = new THREE.Mesh(geo, mat); o.position.set(x || 0, y || 0, z || 0); (parent || g).add(o); return o; };
  const bx = (w, h, d, mat, x, y0, z, parent) => add(new THREE.BoxGeometry(w, h, d), mat, x, y0 + h / 2, z, parent);
  const hash = (i, j) => { const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return s - Math.floor(s); };

  // card materials: unique colours, vertexColors so the per layer darkening rides in the geometry
  const crowdA = M('card:crowd_a', 0xc98a5a, 0.85, 0, { side: DS, vertexColors: true });
  const crowdB = M('card:crowd_b', 0xb0786a, 0.85, 0, { side: DS, vertexColors: true });
  const crowdC = M('card:crowd_c', 0x9a8fb0, 0.85, 0, { side: DS, vertexColors: true });
  const strip = M('ground', 0x6e665c, 0.85, 0), stripTop = M('ground', shade(0x6e665c, 0.08, 0.95), 0.85, 0);

  // the pictures: aspect (height over width) of the shipped cutouts, and the u of the head gaps
  const PIC = {
    crowd_a: { aspect: 0.557, cuts: [0.303, 0.454, 0.728, 0.891] },
    crowd_b: { aspect: 0.497, cuts: [0.121, 0.362, 0.602, 0.723] },
    crowd_c: { aspect: 0.734, cuts: [0.164, 0.355, 0.570, 0.793] },
  };
  // a slice of a crowd picture: a plane over u0..u1 of the picture, width W * (u1 - u0), full picture height
  // end: -1 first slice, +1 last slice, 0 inner. An end slice pivots at its inner edge and is swung back 27
  // degrees, so the picture cut side edge (the atlas crowds are cut through a figure at both sides) recedes
  // behind the row instead of standing as a straight vertical edge against the sky
  const slice = (mat, pic, u0, u1, W, dark, end) => {
    const H = W * pic.aspect, w = W * (u1 - u0);
    const geo = new THREE.PlaneGeometry(w, H, 2, 2);
    const uv = geo.attributes.uv, pp = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) { uv.setX(i, u0 + uv.getX(i) * (u1 - u0)); pp.setZ(i, -0.04 * Math.abs(pp.getX(i) / (w / 2))); }   // 2 x 2 segments, each slice a shallow concave curve toward the road
    geo.computeVertexNormals();
    const col = new Float32Array(uv.count * 3);
    for (let i = 0; i < uv.count; i++) { col[i * 3] = dark[0]; col[i * 3 + 1] = dark[1]; col[i * 3 + 2] = dark[2]; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(geo, mat);
    if (end) { geo.translate(-end * w / 2, 0, 0); m.position.x = (end < 0 ? u1 : u0) * W - W / 2; m.rotation.y = -end * 0.47; }
    else m.position.x = (u0 + u1 - 1) * 0.5 * W;
    m.position.y = H / 2;
    return m;
  };
  const crowd = new THREE.Group(); crowd.name = 'crowd'; g.add(crowd);
  // a layer: the whole picture in slices at their own height, depth and yaw
  const layer = (name, mat, picName, W, z, y0, dark, seed) => {
    const r = new THREE.Group(); r.name = name; r.position.set(0, y0, z); crowd.add(r);
    const pic = PIC[picName], us = [0, ...pic.cuts, 1];
    for (let i = 0; i + 1 < us.length; i++) {
      const end = i === 0 ? -1 : (i + 2 === us.length ? 1 : 0);
      const v = 0.93 + 0.07 * hash(i, seed + 9);   // a slight value step per slice
      const m = slice(mat, pic, us[i], us[i + 1], W, [dark[0] * v, dark[1] * v, dark[2] * v], end);
      m.position.y += 0.03 + 0.09 * hash(i, seed);          // heads at their own heights
      m.position.z += 0.06 * (hash(i, seed + 3) - 0.5);      // never one plane
      m.rotation.y += 0.10 * (hash(i, seed + 5) - 0.5);      // 3 degree yaw scatter
      r.add(m);
    }
    return r;
  };
  // layer darkening: a shade darker AND cooler toward the back (the sky fill in the shade of the row in front)
  const rowA = layer('row_a', crowdA, 'crowd_a', 3.0, 0.0, 0.02, [1.0, 1.0, 1.0], 1);         // front: standing, hats, waving
  const rowB = layer('row_b', crowdC, 'crowd_c', 3.15, -0.45, 0.10, [0.82, 0.84, 0.90], 11);  // mid: flags and raised arms break the top
  const rowC = layer('row_c', crowdB, 'crowd_b', 3.3, -0.90, 0.62, [0.68, 0.71, 0.80], 21);   // back: a raised row, heads over the mid layer

  // the raised back row stands on a timber step (a darker base band under it, a bleached top)
  const step = M('timber', 0x8a6a3e, 0.85, 0), stepTop = M('timber', shade(0x8a6a3e, 0.08, 0.95), 0.85, 0);
  bx(3.3, 0.60, 0.55, step, 0, 0.04, -0.95);
  bx(3.26, 0.012, 0.51, stepTop, 0, 0.64, -0.95);
  // ground strip under the whole set, a shade darker, a bleached top
  bx(3.5, 0.04, 1.5, strip, 0, 0, -0.5);
  bx(3.46, 0.012, 1.46, stripTop, 0, 0.04, -0.5);
  g.userData.joints = { crowd, row_a: rowA, row_b: rowB, row_c: rowC };

  const box = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put = (mat) => { for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put(m.multiplyMatrices(n.matrixWorld, im)); } return; }
    put(n.matrixWorld);
  });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });
  return g;
}
