// kart_chassis c1: profile sweeps. Nose, seat and rear cowl are side profiles extruded
// across the width; pods are rounded rectangles extruded along the length; the bumper
// and exhausts are TubeGeometry along curves; headrest and hub cup are Lathes. Up
// facing triangles of each sweep are split off into the bleached tint.
// Round 1 (hero detail, the chase camera now sits 4.3 m behind): a low rear wing on two
// struts behind the headrest (livery, bleached top, dark end plates, painted edges), fatter
// exhausts with heat rings and glowing tips, a rear number disc on the cowl, a fatter rear
// bumper with livery corner caps, and a livery tail band under the cowl. Height stays under
// the 0.62 m spec plus tolerance (wing end plates top out at 0.65 m).
// Round 2 (the critic: a toy with no highlight, a driver with no body): the wing drops to 0.47 m so
// the seat back and the driver's torso, elbows and shoulders show above it from the chase camera;
// the seat back carries a livery shell with a cream stripe; a framed rear number plate on the cowl
// with a livery disc; the exhausts are polished metal (high metalness, low roughness) so the sun
// lands on them; the seat socket moves to z -0.08 so the driver's gloves reach the wheel.
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
    const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 4 });
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
  const dark = mat('metal', 0x3a3f46, 0.45, 0.25);
  const darkL = mat('metal', 0x4a505a, 0.45, 0.25);
  const pan = mat('metal', 0x565c64, 0.5, 0.2);
  const panL = mat('metal', 0x666c75, 0.5, 0.2);
  const cream = mat('metal', 0xf1e6d2, 0.4, 0.1);
  const teal = mat('metal', 0x3f8f8a, 0.45, 0.2);
  const rubber = mat(null, 0x232528, 0.85, 0);
  const rubberL = mat(null, 0x30343a, 0.85, 0);
  const flare = mat(null, 0x3a3f46, 0.5, 0, { emissive: 0xffc48a, emissiveIntensity: 1.0 });
  const chrome = mat('metal', 0xc9ced4, 0.22, 0.9);
  const chromeD = mat('metal', 0x9aa0a8, 0.28, 0.9);

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
    for (const sx of [-1, 1]) mesh(g, cyl(0.042, 0.042, 0.05, 12), darkL, sx * 0.50, 0.10, z, 0, 0, PI / 2);
  }

  // side pods: rounded rectangle profile swept along Z
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
    for (const z of [-0.45, -0.10, 0.25]) mesh(g, cyl(0.016, 0.016, 0.02, 8), darkL, x + sx * 0.155, 0.22, z, 0, 0, PI / 2);
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
  // number disc set into the slope
  const ang = Math.atan2(0.13, 0.44);
  mesh(g, cyl(0.115, 0.115, 0.014, 20), dark, 0, 0.332, 0.36, ang);
  mesh(g, cyl(0.10, 0.10, 0.02, 20), cream, 0, 0.344, 0.364, ang);
  mesh(g, cyl(0.035, 0.035, 0.012, 12), liv, 0, 0.358, 0.368, ang);

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

  // rear cowl: a hood shell profile swept 0.60 wide, open at the sides and the back low down
  const cowl = new THREE.Shape();
  cowl.moveTo(-0.56, 0.06); cowl.lineTo(-0.56, 0.30); cowl.quadraticCurveTo(-0.56, 0.36, -0.62, 0.36); cowl.lineTo(-0.76, 0.36);
  cowl.quadraticCurveTo(-0.80, 0.36, -0.80, 0.32); cowl.lineTo(-0.80, 0.20); cowl.lineTo(-0.77, 0.20); cowl.lineTo(-0.77, 0.33);
  cowl.lineTo(-0.59, 0.33); cowl.lineTo(-0.59, 0.06); cowl.closePath();
  const [cowlUp, cowlRest] = splitUp(sweepX(cowl, 0.60, 0), 0.35);
  mesh(g, cowlUp, mat('metal', livL.color.getHex(), 0.35, 0.15, { side: THREE.DoubleSide }));
  mesh(g, cowlRest, livShell);
  for (const sx of [-1, 1]) tube(g, [sx * 0.30, 0.355, -0.58], [sx * 0.30, 0.355, -0.78], 0.016, livL, 8);
  tube(g, [-0.30, 0.355, -0.58], [0.30, 0.355, -0.58], 0.016, livL, 8);
  mesh(g, box(0.60, 0.08, 0.034), livD, 0, 0.10, -0.575);
  // engine, visible from the sides and behind
  mesh(g, box(0.34, 0.16, 0.18), dark, 0, 0.16, -0.68);
  for (const sx of [-1, 1]) mesh(g, cyl(0.045, 0.045, 0.08, 12), darkL, sx * 0.09, 0.28, -0.68);
  mesh(g, cyl(0.06, 0.06, 0.03, 14), darkL, 0.20, 0.16, -0.68, 0, 0, PI / 2);
  mesh(g, box(0.36, 0.08, 0.06), darkL, 0, 0.12, -0.60);
  for (const sx of [-1, 1]) {
    const pts = [new THREE.Vector3(sx * 0.10, 0.24, -0.70), new THREE.Vector3(sx * 0.15, 0.27, -0.80), new THREE.Vector3(sx * 0.19, 0.36, -0.88)];
    const curve = new THREE.CatmullRomCurve3(pts);
    mesh(g, new THREE.TubeGeometry(curve, 8, 0.042, 12, false), chrome);
    const tan = curve.getTangent(1); const end = pts[2];
    const tip = mesh(g, cyl(0.03, 0.03, 0.014, 14), flare, end.x, end.y, end.z); tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
    const ring = mesh(g, cyl(0.05, 0.05, 0.026, 14), chromeD, end.x, end.y, end.z); ring.quaternion.copy(tip.quaternion);
    // a heat ring half way along the pipe, lighter metal
    const mid = curve.getPoint(0.55), midT = curve.getTangent(0.55);
    const hr = mesh(g, cyl(0.05, 0.05, 0.02, 14), chromeD, mid.x, mid.y, mid.z); hr.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), midT);
  }
  // rear number plate on the cowl's back face: dark frame, cream plate, livery disc, two bolts
  mesh(g, box(0.34, 0.20, 0.012), dark, 0, 0.255, -0.806);
  mesh(g, box(0.31, 0.17, 0.016), cream, 0, 0.255, -0.812);
  mesh(g, cyl(0.055, 0.055, 0.012, 16), liv, 0, 0.255, -0.824, PI / 2);
  mesh(g, box(0.31, 0.03, 0.017), livD, 0, 0.335, -0.812);
  for (const sx of [-1, 1]) mesh(g, cyl(0.012, 0.012, 0.01, 6), darkL, sx * 0.135, 0.31, -0.826, PI / 2);
  // rear wing: two raked struts off the cowl, a 1.0 m blade with a bleached top, painted edge tubes, dark end plates
  const wingY = 0.47, wingZ = -0.72;
  for (const sx of [-1, 1]) tube(g, [sx * 0.22, 0.36, -0.62], [sx * 0.22, wingY - 0.01, wingZ + 0.03], 0.02, dark, 8);
  const wingProfile = new THREE.Shape();   // (z, y) side profile of the blade: a thin aerofoil, thicker at the front
  wingProfile.moveTo(wingZ + 0.13, wingY - 0.012); wingProfile.quadraticCurveTo(wingZ + 0.14, wingY + 0.02, wingZ + 0.10, wingY + 0.03);
  wingProfile.lineTo(wingZ - 0.10, wingY + 0.008); wingProfile.quadraticCurveTo(wingZ - 0.13, wingY + 0.004, wingZ - 0.13, wingY - 0.008);
  wingProfile.lineTo(wingZ + 0.13, wingY - 0.012); wingProfile.closePath();
  sweepXTwoTone(wingProfile, 1.00, 0, liv, livL);
  for (const sx of [-1, 1]) {
    mesh(g, box(0.024, 0.11, 0.28), dark, sx * 0.51, wingY + 0.03, wingZ);
    mesh(g, box(0.026, 0.012, 0.29), darkL, sx * 0.51, wingY + 0.085, wingZ);
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
    seat: sock('seat', 0, 0.16, -0.08), exhaustL: sock('exhaustL', -0.19, 0.36, -0.88), exhaustR: sock('exhaustR', 0.19, 0.36, -0.88),
    itemHold: sock('itemHold', 0, 1.11, -0.45),
  };
  g.userData.joints = { steer };
  g.userData.steerAxis = 'z';
  g.userData.livery = 'metal:' + liv.color.getHexString();
  g.userData.liveryLight = 'metal:' + livL.color.getHexString();
  g.userData.liveryDark = 'metal:' + livD.color.getHexString();
  g.userData.rideHeight = 0.12;
  g.userData.wheelHalfWidth = 0.12;

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
