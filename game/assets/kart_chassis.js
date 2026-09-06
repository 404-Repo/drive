// kart_chassis c1: profile sweeps. Nose, seat and rear cowl are side profiles extruded
// across the width; pods are rounded rectangles extruded along the length; the bumper
// and exhausts are TubeGeometry along curves; headrest and hub cup are Lathes. Up
// facing triangles of each sweep are split off into the bleached tint.
// Round 1 (hero detail): a low rear wing on two struts behind the headrest, exhausts with heat
// rings, a nose number disc, a fat rear bumper with livery corner caps, a livery tail band.
// Round 2: the wing drops to 0.47 m so the driver's torso shows above it; the seat back carries a
// livery shell with a cream stripe; a framed rear number plate; the seat socket at z -0.08.
// Round 3 (the blind critic: "a matte block toy ... two flat glowing headlight polygons"): the
// glowing exhaust tips are gone; the exhausts are CHROME pipes (metalness 1, roughness 0.2,
// material.userData.finish 'chrome', which kartview swaps onto its chrome material) that exit
// outward and up through chrome tip rings with a dark recessed bore, so from the chase camera
// they read as two open pipes, never as lamps. Two real round lamps sit on the nose cheeks in
// chrome bezels with a glass lens that does not emit (it is 18:40, the sun wins). The rear cowl
// is a rounded engine cover with a spine ridge, two intake scoops and vented side skirts; the
// rear plate carries a chunky seven segment race number (digits 1 to 8 as geometry, never
// letters; numeral 1 visible, the others hidden until kartview picks the racer's own); two
// sponsor decals per side (a cream chevron pair and a teal roundel on each pod top, a cream
// speed stripe along each pod flank) plus diagonal stripes on the cowl and wing. Every livery
// face keeps its painted edge and bleached top; the paint itself is the clearcoat in kartview.
export default function (THREE) {
  const g = new THREE.Group();
  const PI = Math.PI;
  const tint = (hex, l, s) => {
    const c = new THREE.Color(hex); const h = { h: 0, s: 0, l: 0 }; c.getHSL(h);
    c.setHSL(h.h, Math.max(0, Math.min(1, h.s * (s === undefined ? 1 : s))), Math.max(0, Math.min(1, h.l * (1 + l))));
    return c.getHex();
  };
  const mat = (name, hex, rough, metal, extra) => {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: metal || 0 }, extra || {}));
    if (name) m.name = name; return m;
  };
  const mesh = (parent, geo, m, x, y, z, rx, ry, rz) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.rotation.set(rx || 0, ry || 0, rz || 0); parent.add(o); return o;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt, rb, h, seg) => new THREE.CylinderGeometry(rt, rb, h, seg || 14);
  const tube = (parent, a, b, r, m, seg) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const d = B.clone().sub(A); const L = d.length();
    const o = new THREE.Mesh(cyl(r, r, L, seg || 8), m);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    o.position.copy(A).add(B).multiplyScalar(0.5); parent.add(o); return o;
  };
  // profile drawn in (z, y), swept across X and centred on x0
  const sweepX = (shape, width, x0) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 5 });
    geo.rotateY(-PI / 2); geo.translate(x0 + width / 2, 0, 0); return geo;
  };
  // profile drawn in (x, y), swept along Z and centred on z0
  const sweepZ = (shape, depth, z0) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 });
    geo.translate(0, 0, z0 - depth / 2); return geo;
  };
  const rrect = (w, h, r, cx, cy) => {
    const s = new THREE.Shape(); const x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2;
    s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r); s.lineTo(x1, y1 - r);
    s.quadraticCurveTo(x1, y1, x1 - r, y1); s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r);
    s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0); return s;
  };
  // split a geometry into up facing triangles and the rest, so tops can take the bleached tint
  const splitUp = (geo, thresh) => {
    const src = geo.index ? geo.toNonIndexed() : geo;
    const P = src.attributes.position, N = src.attributes.normal; const up = [], rest = [];
    for (let i = 0; i < P.count; i += 3) {
      const ny = (N.getY(i) + N.getY(i + 1) + N.getY(i + 2)) / 3;
      const dst = ny > thresh ? up : rest;
      for (let k = 0; k < 3; k++) dst.push(P.getX(i + k), P.getY(i + k), P.getZ(i + k));
    }
    const mk = (arr) => { const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); b.computeVertexNormals(); return b; };
    return [mk(up), mk(rest)];
  };
  const sweepXTwoTone = (shape, width, x0, mSide, mTop) => {
    const [up, rest] = splitUp(sweepX(shape, width, x0), 0.35);
    if (up.attributes.position.count) mesh(g, up, mTop);
    if (rest.attributes.position.count) mesh(g, rest, mSide);
  };
  // painted edge tubes along the top of a (z, y) profile at both cap sides
  const edgeTubes = (shape, halfW, yMin, r, m) => {
    const pts = shape.getPoints(6).filter((p) => p.y > yMin);
    for (let i = 0; i + 1 < pts.length; i++) {
      for (const sx of [-1, 1]) tube(g, [sx * halfW, pts[i].y, pts[i].x], [sx * halfW, pts[i + 1].y, pts[i + 1].x], r, m, 8);
    }
    return pts;
  };

  const LIVERY = 0xed5851;
  const liv = mat('metal', LIVERY, 0.35, 0.15);
  const livL = mat('metal', tint(LIVERY, 0.11, 0.95), 0.35, 0.15);
  const livD = mat('metal', tint(LIVERY, -0.18, 0.92), 0.38, 0.15);
  const livShell = mat('metal', LIVERY, 0.35, 0.15, { side: THREE.DoubleSide });
  const livLShell = mat('metal', livL.color.getHex(), 0.35, 0.15, { side: THREE.DoubleSide });
  const dark = mat('metal', 0x3a3f46, 0.45, 0.25);
  const darkL = mat('metal', 0x4a505a, 0.45, 0.25);
  const pan = mat('metal', 0x565c64, 0.5, 0.2);
  const panL = mat('metal', 0x666c75, 0.5, 0.2);
  const cream = mat('metal', 0xf1e6d2, 0.4, 0.1);
  const creamD = mat('metal', 0xd9cfbc, 0.42, 0.1);
  const teal = mat('metal', 0x3f8f8a, 0.45, 0.2);
  const tealD = mat('metal', 0x2f7a76, 0.45, 0.2);
  const rubber = mat(null, 0x232528, 0.85, 0);
  const rubberL = mat(null, 0x30343a, 0.85, 0);
  const bore = mat(null, 0x232528, 0.7, 0);
  // chrome: kartview swaps meshes with finish 'chrome' onto its mirror material on the hero kart; an AI kart
  // keeps these values in the vertex bake (metalness 1, roughness 0.2 under the rig's environment)
  const chrome = mat('metal', 0xd8dde3, 0.2, 1.0); chrome.userData.finish = 'chrome';
  const chromeD = mat('metal', 0xb9c0c8, 0.22, 1.0); chromeD.userData.finish = 'chrome';
  // lamp glass: unnamed so the surface pass skips it; no emissive, the lamps are off in daylight
  const glass = mat(null, 0x8fa9d6, 0.15, 0.0);
  const glassIn = mat(null, 0x5f7596, 0.3, 0.0);

  // pan and frame
  mesh(g, sweepZ(rrect(0.56, 0.06, 0.02, 0, 0.03), 1.30, -0.05), pan);
  mesh(g, box(0.48, 0.012, 1.20), panL, 0, 0.066, -0.05);
  for (const sx of [-1, 1]) {
    tube(g, [sx * 0.29, 0.085, -0.75], [sx * 0.29, 0.085, 0.65], 0.022, dark, 8);
    tube(g, [sx * 0.29, 0.085, 0.65], [sx * 0.10, 0.085, 0.76], 0.022, dark, 8);
  }
  tube(g, [-0.10, 0.085, 0.76], [0.10, 0.085, 0.76], 0.022, dark, 8);
  tube(g, [-0.29, 0.085, -0.75], [0.29, 0.085, -0.75], 0.022, dark, 8);
  for (const z of [0.50, -0.50]) {
    tube(g, [-0.60, 0.10, z], [0.60, 0.10, z], 0.025, dark, 8);
    for (const sx of [-1, 1]) mesh(g, cyl(0.042, 0.042, 0.05, 12), chromeD, sx * 0.50, 0.10, z, 0, 0, PI / 2);
  }

  // side pods: rounded rectangle profile swept along Z, painted edge tubes, bleached top plate
  for (const sx of [-1, 1]) {
    const x = sx * 0.40;
    mesh(g, sweepZ(rrect(0.30, 0.24, 0.06, x, 0.18), 0.90, -0.10), liv);
    const band = new THREE.Shape();
    band.moveTo(x - 0.153, 0.16); band.lineTo(x - 0.153, 0.12); band.quadraticCurveTo(x - 0.153, 0.058, x - 0.09, 0.058);
    band.lineTo(x + 0.09, 0.058); band.quadraticCurveTo(x + 0.153, 0.058, x + 0.153, 0.12); band.lineTo(x + 0.153, 0.16); band.closePath();
    mesh(g, sweepZ(band, 0.904, -0.10), livD);
    mesh(g, box(0.19, 0.01, 0.84), livL, x, 0.304, -0.10);
    for (const s2 of [-1, 1]) tube(g, [x + s2 * 0.1324, 0.2824, -0.55], [x + s2 * 0.1324, 0.2824, 0.35], 0.016, livL, 8);
    mesh(g, sweepZ(rrect(0.22, 0.16, 0.05, x, 0.19), 0.03, 0.365), cream);
    mesh(g, sweepZ(rrect(0.22, 0.16, 0.05, x, 0.19), 0.03, -0.565), cream);
    for (const z of [-0.45, -0.10, 0.25]) mesh(g, cyl(0.016, 0.016, 0.02, 8), chromeD, x + sx * 0.155, 0.22, z, 0, 0, PI / 2);
    // sponsor decal 1: a cream chevron pair on the pod top, pointing forward
    for (const [zc, w] of [[0.16, 0.16], [0.04, 0.16]]) {
      for (const s2 of [-1, 1]) mesh(g, box(0.026, 0.006, w), cream, x + s2 * 0.045, 0.312, zc, 0, s2 * 0.62, 0);
    }
    // sponsor decal 2: a teal roundel with a cream ring and a dark wave bar
    mesh(g, cyl(0.062, 0.062, 0.006, 20), cream, x, 0.312, -0.28);
    mesh(g, cyl(0.048, 0.048, 0.007, 20), teal, x, 0.313, -0.28);
    mesh(g, box(0.064, 0.008, 0.014), cream, x, 0.315, -0.28);
    mesh(g, box(0.040, 0.008, 0.010), tealD, x, 0.316, -0.28);
    // speed stripe along the pod flank: cream over a dark hairline, sitting proud of the paint
    mesh(g, box(0.008, 0.045, 0.62), cream, x + sx * 0.153, 0.205, -0.12);
    mesh(g, box(0.009, 0.010, 0.62), dark, x + sx * 0.153, 0.175, -0.12);
    mesh(g, box(0.008, 0.028, 0.16), teal, x + sx * 0.153, 0.205, 0.30);
  }

  // seat: side profile swept 0.46 wide
  const seatS = new THREE.Shape();
  seatS.moveTo(-0.42, 0.06); seatS.lineTo(0.01, 0.06); seatS.lineTo(0.01, 0.16); seatS.lineTo(-0.30, 0.16);
  seatS.quadraticCurveTo(-0.38, 0.17, -0.38, 0.24); seatS.lineTo(-0.44, 0.52); seatS.quadraticCurveTo(-0.45, 0.56, -0.49, 0.555);
  seatS.lineTo(-0.53, 0.52); seatS.lineTo(-0.50, 0.22); seatS.lineTo(-0.50, 0.06); seatS.closePath();
  mesh(g, sweepX(seatS, 0.46, 0), rubber);
  mesh(g, box(0.16, 0.012, 0.36), rubberL, 0, 0.166, -0.16);
  mesh(g, box(0.16, 0.28, 0.012), rubberL, 0, 0.38, -0.406, -0.197);
  // the seat back's outer shell in the livery, the surface the chase camera sees most
  mesh(g, box(0.50, 0.36, 0.035), livD, 0, 0.36, -0.522, -0.10);
  mesh(g, box(0.52, 0.03, 0.04), livL, 0, 0.54, -0.54, -0.10);
  mesh(g, box(0.07, 0.30, 0.04), cream, 0, 0.36, -0.53, -0.10);
  for (const sx of [-1, 1]) {
    mesh(g, box(0.06, 0.32, 0.09), rubber, sx * 0.24, 0.38, -0.44, -0.197);
    mesh(g, box(0.06, 0.06, 0.28), rubber, sx * 0.24, 0.19, -0.15);
    tube(g, [sx * 0.15, 0.06, -0.58], [sx * 0.15, 0.50, -0.58], 0.02, dark, 8);
  }
  const hrPts = [[0, -0.215], [0.05, -0.20], [0.07, -0.17], [0.075, -0.14], [0.075, 0.14], [0.07, 0.17], [0.05, 0.20], [0, 0.215]].map((p) => new THREE.Vector2(p[0], p[1]));
  mesh(g, new THREE.LatheGeometry(hrPts, 14), rubberL, 0, 0.545, -0.56, 0, 0, PI / 2);
  mesh(g, box(0.03, 0.16, 0.02), cream, 0, 0.545, -0.485);

  // nose: spine profile plus two lower cheeks, up faces bleached, painted edge tubes on the spine
  const spine = new THREE.Shape();
  spine.moveTo(0.10, 0.06); spine.lineTo(0.10, 0.33); spine.quadraticCurveTo(0.12, 0.37, 0.18, 0.37);
  spine.quadraticCurveTo(0.45, 0.35, 0.62, 0.22); spine.quadraticCurveTo(0.70, 0.17, 0.70, 0.12); spine.lineTo(0.70, 0.06); spine.closePath();
  sweepXTwoTone(spine, 0.30, 0, liv, livL);
  edgeTubes(spine, 0.15, 0.20, 0.016, livL);
  const cheek = new THREE.Shape();
  cheek.moveTo(0.10, 0.06); cheek.lineTo(0.10, 0.26); cheek.quadraticCurveTo(0.12, 0.30, 0.18, 0.30);
  cheek.quadraticCurveTo(0.42, 0.28, 0.58, 0.16); cheek.quadraticCurveTo(0.66, 0.12, 0.66, 0.09); cheek.lineTo(0.66, 0.06); cheek.closePath();
  for (const sx of [-1, 1]) sweepXTwoTone(cheek, 0.08, sx * 0.19, liv, livL);
  mesh(g, box(0.46, 0.05, 0.004), livD, 0, 0.085, 0.098);
  // number disc set into the slope, with a cream twin stripe running down the spine behind it
  const ang = Math.atan2(0.13, 0.44);
  mesh(g, cyl(0.115, 0.115, 0.014, 20), dark, 0, 0.332, 0.36, ang);
  mesh(g, cyl(0.10, 0.10, 0.02, 20), cream, 0, 0.344, 0.364, ang);
  mesh(g, cyl(0.035, 0.035, 0.012, 12), liv, 0, 0.358, 0.368, ang);
  for (const sx of [-1, 1]) mesh(g, box(0.022, 0.006, 0.14), cream, sx * 0.04, 0.372, 0.18, -0.06);
  // round lamps on the cheeks: chrome bezel, glass lens over a dark reflector, no emissive
  for (const sx of [-1, 1]) {
    const lx = sx * 0.19, ly = 0.215, lz = 0.585, tilt = -0.62;   // the cheek slope faces forward and up
    const bez = mesh(g, cyl(0.052, 0.052, 0.03, 16), chrome, lx, ly, lz, tilt + PI / 2);
    mesh(g, cyl(0.040, 0.040, 0.032, 16), glassIn, lx, ly, lz, tilt + PI / 2);
    const lens = mesh(g, cyl(0.036, 0.036, 0.012, 16), glass, lx, ly, lz, tilt + PI / 2);
    lens.position.add(new THREE.Vector3(0, Math.cos(tilt) * 0.014, -Math.sin(tilt) * 0.014));
    bez.position.add(new THREE.Vector3(0, Math.cos(tilt) * 0.004, -Math.sin(tilt) * 0.004));
  }

  // front bumper: fat tube along an arc, thinner blade tube below
  const arcPts = (R, y, zc, half, n) => { const a = []; for (let i = 0; i <= n; i++) { const t = PI / 2 - half + (2 * half * i) / n; a.push(new THREE.Vector3(R * Math.cos(t), y, zc + R * Math.sin(t))); } return a; };
  const bumperCurve = new THREE.CatmullRomCurve3(arcPts(0.50, 0.20, 0.245, 0.575, 6));
  mesh(g, new THREE.TubeGeometry(bumperCurve, 14, 0.055, 10, false), rubber);
  const bladeCurve = new THREE.CatmullRomCurve3(arcPts(0.47, 0.105, 0.245, 0.50, 6));
  mesh(g, new THREE.TubeGeometry(bladeCurve, 12, 0.03, 8, false), rubber);
  for (const sx of [-1, 1]) {
    mesh(g, new THREE.SphereGeometry(0.055, 10, 8), rubber, sx * 0.50 * Math.sin(0.575), 0.20, 0.245 + 0.50 * Math.cos(0.575));
    mesh(g, new THREE.SphereGeometry(0.03, 8, 6), rubber, sx * 0.47 * Math.sin(0.50), 0.105, 0.245 + 0.47 * Math.cos(0.50));
    tube(g, [sx * 0.20, 0.10, 0.60], [sx * 0.20, 0.19, 0.70], 0.018, dark, 8);
  }

  // steering
  tube(g, [0, 0.186, 0.518], [0, 0.50, 0.14], 0.02, dark, 8);
  const steer = new THREE.Group(); steer.name = 'joint_steer'; steer.position.set(0, 0.52, 0.12); steer.rotation.x = 0.698; g.add(steer);
  mesh(steer, new THREE.TorusGeometry(0.12, 0.022, 10, 20), teal, 0, 0, 0);
  const hubPts = [[0, 0], [0.045, 0], [0.05, 0.01], [0.05, 0.03], [0.03, 0.04], [0, 0.04]].map((p) => new THREE.Vector2(p[0], p[1]));
  mesh(steer, new THREE.LatheGeometry(hubPts, 12), dark, 0, 0, -0.02, PI / 2);
  for (const a of [PI / 2, PI / 2 + 2 * PI / 3, PI / 2 + 4 * PI / 3]) {
    mesh(steer, box(0.11, 0.02, 0.014), dark, Math.cos(a) * 0.065, Math.sin(a) * 0.065, 0, 0, 0, a);
  }

  // rear cowl: a rounded engine cover, a side profile shell swept 0.60 wide, open at the sides
  const cowl = new THREE.Shape();
  cowl.moveTo(-0.56, 0.06); cowl.lineTo(-0.56, 0.30); cowl.quadraticCurveTo(-0.56, 0.40, -0.64, 0.40); cowl.lineTo(-0.72, 0.40);
  cowl.quadraticCurveTo(-0.84, 0.39, -0.84, 0.28); cowl.lineTo(-0.84, 0.18); cowl.lineTo(-0.81, 0.18); cowl.lineTo(-0.81, 0.28);
  cowl.quadraticCurveTo(-0.81, 0.36, -0.72, 0.37); cowl.lineTo(-0.64, 0.37); cowl.quadraticCurveTo(-0.59, 0.37, -0.59, 0.30); cowl.lineTo(-0.59, 0.06); cowl.closePath();
  const [cowlUp, cowlRest] = splitUp(sweepX(cowl, 0.60, 0), 0.35);
  mesh(g, cowlUp, livLShell);
  mesh(g, cowlRest, livShell);
  for (const sx of [-1, 1]) tube(g, [sx * 0.30, 0.395, -0.60], [sx * 0.30, 0.395, -0.74], 0.016, livL, 8);
  tube(g, [-0.30, 0.395, -0.60], [0.30, 0.395, -0.60], 0.016, livL, 8);
  // spine ridge, two intake scoops with cream lips, diagonal cream stripes on the cover
  mesh(g, box(0.06, 0.022, 0.20), livL, 0, 0.405, -0.68);
  for (const sx of [-1, 1]) {
    mesh(g, box(0.13, 0.05, 0.11), dark, sx * 0.17, 0.42, -0.66);
    mesh(g, box(0.13, 0.05, 0.012), rubber, sx * 0.17, 0.42, -0.604);
    mesh(g, box(0.136, 0.012, 0.11), cream, sx * 0.17, 0.448, -0.66);
    mesh(g, box(0.028, 0.006, 0.10), cream, sx * 0.09, 0.404, -0.745, 0, sx * 0.5, 0);
  }
  // vented side skirts on the cowl, in the darker livery with three dark louvres each
  for (const sx of [-1, 1]) {
    mesh(g, box(0.02, 0.22, 0.24), livD, sx * 0.30, 0.19, -0.70);
    for (const z of [-0.63, -0.70, -0.77]) mesh(g, box(0.024, 0.14, 0.028), dark, sx * 0.30, 0.19, z);
    mesh(g, box(0.022, 0.022, 0.24), livL, sx * 0.30, 0.31, -0.70);
  }
  mesh(g, box(0.60, 0.08, 0.034), livD, 0, 0.10, -0.575);
  // engine, visible from the sides and behind
  mesh(g, box(0.34, 0.16, 0.18), dark, 0, 0.16, -0.68);
  for (const sx of [-1, 1]) mesh(g, cyl(0.045, 0.045, 0.08, 12), darkL, sx * 0.09, 0.28, -0.68);
  mesh(g, cyl(0.06, 0.06, 0.03, 14), chromeD, 0.20, 0.16, -0.68, 0, 0, PI / 2);
  mesh(g, box(0.36, 0.08, 0.06), darkL, 0, 0.12, -0.60);
  // exhausts: chrome pipes out of the engine, outward and up, a chrome tip ring and a dark recessed bore
  const exhaustEnd = [];
  for (const sx of [-1, 1]) {
    const pts = [new THREE.Vector3(sx * 0.10, 0.22, -0.70), new THREE.Vector3(sx * 0.19, 0.25, -0.80), new THREE.Vector3(sx * 0.29, 0.30, -0.88), new THREE.Vector3(sx * 0.35, 0.325, -0.92)];
    const curve = new THREE.CatmullRomCurve3(pts);
    mesh(g, new THREE.TubeGeometry(curve, 10, 0.040, 12, false), chrome);
    const tan = curve.getTangent(1); const end = pts[3];
    const ring = mesh(g, cyl(0.052, 0.052, 0.036, 16), chrome, end.x, end.y, end.z); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
    const boreDisc = mesh(g, cyl(0.036, 0.036, 0.012, 16), bore, end.x - tan.x * 0.012, end.y - tan.y * 0.012, end.z - tan.z * 0.012); boreDisc.quaternion.copy(ring.quaternion);
    const mid = curve.getPoint(0.5), midT = curve.getTangent(0.5);
    const clamp = mesh(g, cyl(0.048, 0.048, 0.022, 14), dark, mid.x, mid.y, mid.z); clamp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), midT);
    exhaustEnd.push(end);
  }
  // rear number plate on the cowl's back face: dark frame, cream plate, livery header band, the race number
  mesh(g, box(0.34, 0.20, 0.012), dark, 0, 0.255, -0.806);
  mesh(g, box(0.31, 0.17, 0.016), cream, 0, 0.255, -0.812);
  mesh(g, box(0.31, 0.03, 0.017), livD, 0, 0.335, -0.812);
  for (const sx of [-1, 1]) mesh(g, cyl(0.012, 0.012, 0.01, 6), chromeD, sx * 0.135, 0.31, -0.826, PI / 2);
  // seven segment digits 1 to 8, chunky boxes in the dark livery on the plate face (-Z), 0.11 tall; only
  // numeral 1 is visible here, kartview shows the racer's own and drops the rest before the bake
  {
    const H = 0.11, W = 0.062, T = 0.024, cy = 0.245, D = 0.012, zf = -0.826;
    const SEG = {   // (x, y, w, h) of each segment in the plate's face frame, x positive to the plate's right as seen from behind
      a: [0, H / 2, W, T], b: [W / 2 - T / 2, H / 4, T, H / 2 + T / 2], c: [W / 2 - T / 2, -H / 4, T, H / 2 + T / 2], d: [0, -H / 2, W, T],
      e: [-W / 2 + T / 2, -H / 4, T, H / 2 + T / 2], f: [-W / 2 + T / 2, H / 4, T, H / 2 + T / 2], gg: [0, 0, W, T],
    };
    const DIG = { 1: 'bc', 2: 'abggde', 3: 'abggcd', 4: 'fggbc', 5: 'afggcd', 6: 'afggedc', 7: 'abc', 8: 'abcdefgg' };
    for (let n = 1; n <= 8; n++) {
      const holder = new THREE.Group(); holder.name = 'numeral_' + n; holder.userData.numeral = n; holder.visible = n === 1; g.add(holder);
      const segs = DIG[n].replace('gg', 'G');
      for (const s of segs) {
        const [x, y, w, h] = SEG[s === 'G' ? 'gg' : s];
        // seen from behind (-Z), the plate's right is the kart's -X
        mesh(holder, box(w, h, D), livD, -x, cy + y, zf);
      }
    }
  }
  // rear wing: two raked struts off the cowl, a 1.0 m blade with a bleached top, painted edge tubes, dark end plates
  const wingY = 0.47, wingZ = -0.72;
  for (const sx of [-1, 1]) tube(g, [sx * 0.22, 0.38, -0.62], [sx * 0.22, wingY - 0.01, wingZ + 0.03], 0.02, dark, 8);
  const wingProfile = new THREE.Shape();   // (z, y) side profile of the blade: a thin aerofoil, thicker at the front
  wingProfile.moveTo(wingZ + 0.13, wingY - 0.012); wingProfile.quadraticCurveTo(wingZ + 0.14, wingY + 0.02, wingZ + 0.10, wingY + 0.03);
  wingProfile.lineTo(wingZ - 0.10, wingY + 0.008); wingProfile.quadraticCurveTo(wingZ - 0.13, wingY + 0.004, wingZ - 0.13, wingY - 0.008);
  wingProfile.lineTo(wingZ + 0.13, wingY - 0.012); wingProfile.closePath();
  sweepXTwoTone(wingProfile, 1.00, 0, liv, livL);
  for (const sx of [-1, 1]) {
    mesh(g, box(0.024, 0.11, 0.28), dark, sx * 0.51, wingY + 0.03, wingZ);
    mesh(g, box(0.026, 0.012, 0.29), darkL, sx * 0.51, wingY + 0.085, wingZ);
    mesh(g, cyl(0.03, 0.03, 0.028, 14), liv, sx * 0.51, wingY + 0.035, wingZ, 0, 0, PI / 2);   // livery disc on each end plate
    mesh(g, box(0.10, 0.006, 0.06), cream, sx * 0.32, wingY + 0.032, wingZ + 0.02, 0, sx * 0.55, 0);   // cream slash decal on the blade
  }
  tube(g, [-0.50, wingY + 0.03, wingZ + 0.10], [0.50, wingY + 0.03, wingZ + 0.10], 0.012, livL, 8);
  tube(g, [-0.50, wingY + 0.008, wingZ - 0.11], [0.50, wingY + 0.008, wingZ - 0.11], 0.012, livL, 8);
  // livery tail band under the cowl, between the rear bumper and the engine
  mesh(g, box(0.62, 0.05, 0.03), livD, 0, 0.085, -0.79);
  // rear bumper: a fat rubber bar with livery corner caps
  tube(g, [-0.46, 0.13, -0.81], [0.46, 0.13, -0.81], 0.036, rubber, 12);
  for (const sx of [-1, 1]) {
    tube(g, [sx * 0.46, 0.13, -0.81], [sx * 0.46, 0.13, -0.70], 0.036, rubber, 12);
    mesh(g, new THREE.SphereGeometry(0.048, 12, 8), liv, sx * 0.46, 0.13, -0.81);
    tube(g, [sx * 0.29, 0.085, -0.75], [sx * 0.29, 0.13, -0.81], 0.018, dark, 8);
  }

  const sock = (name, x, y, z) => { const s = new THREE.Group(); s.name = 'socket_' + name; s.position.set(x, y, z); g.add(s); return s; };
  g.userData.sockets = {
    wheelFL: sock('wheelFL', -0.60, 0.10, 0.50), wheelFR: sock('wheelFR', 0.60, 0.10, 0.50),
    wheelRL: sock('wheelRL', -0.60, 0.10, -0.50), wheelRR: sock('wheelRR', 0.60, 0.10, -0.50),
    seat: sock('seat', 0, 0.16, -0.08),
    exhaustL: sock('exhaustL', exhaustEnd[0].x, exhaustEnd[0].y, exhaustEnd[0].z), exhaustR: sock('exhaustR', exhaustEnd[1].x, exhaustEnd[1].y, exhaustEnd[1].z),
    itemHold: sock('itemHold', 0, 1.11, -0.45),
  };
  g.userData.joints = { steer };
  g.userData.steerAxis = 'z';
  g.userData.livery = 'metal:' + liv.color.getHexString();
  g.userData.liveryLight = 'metal:' + livL.color.getHexString();
  g.userData.liveryDark = 'metal:' + livD.color.getHexString();
  g.userData.rideHeight = 0.12;
  g.userData.wheelHalfWidth = 0.12;
  g.userData.exhaustDir = 'outward';   // the pipes exit 20 degrees outward and 10 up: kartview aims the flame along the socket to tail line

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
