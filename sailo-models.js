// Sailo · 3D boat models
// Renders glTF boats (for now the Tugboat) with three.js into the 2D sea canvas. The game draws
// with an oblique projection: the sea plane is not foreshortened and heights rise straight up the
// screen by `elev` (|E|). Each frame the model is rendered into an offscreen WebGL canvas with that
// same projection, then copied into the game canvas at the boat's position. Three.js and the model
// load only when a model boat is first needed.
(function () {
  const MODELS = {
    tugboat: { url: './models/tugboat.glb', bow: 'foredeck', stern: 'aft_deck', funnel: 'exhaust_L', waterline: 'boot_stripe' },
    // No boot stripe on the sloop: the waterline sits at the top of the lowest hull strake. Centre on the hull, not the eased-out sails.
    sailboat: { url: './models/sailboat.glb', bow: 'fore_hatch', stern: 'transom_board', waterY: .26, center: 'hull' },
    gaffcutter: { url: './models/gaff-cutter.glb', bow: 'fore_hatch', stern: 'transom_board', waterline: 'boot_top', center: 'hull' }
  };
  const state = {}; let libs = null, R = null, listeners = [];

  const loadLibs = () => libs || (libs = Promise.all([import('three'), import('three/addons/loaders/GLTFLoader.js'), import('three/addons/utils/BufferGeometryUtils.js')]).then(([T, G, U]) => ({ T, GLTFLoader: G.GLTFLoader, U })));

  async function load(id) {
    const def = MODELS[id]; if (!def || state[id]) return; state[id] = { status: 'loading' };
    try {
      const { T, GLTFLoader, U } = await loadLibs(); const gltf = await new GLTFLoader().loadAsync(def.url), root = gltf.scene; root.updateMatrixWorld(true);
      const find = n => root.getObjectByName(n), box = o => new T.Box3().setFromObject(o);
      // Orientation: the model is long along X; the bow is whichever end the foredeck sits on.
      const all = box(root), bowX = box(find(def.bow)).getCenter(new T.Vector3()).x, sternX = box(find(def.stern)).getCenter(new T.Vector3()).x, flip = bowX < sternX ? -1 : 1;
      const cb = def.center && find(def.center) ? box(find(def.center)) : all, wl = def.waterY != null ? def.waterY : find(def.waterline) ? box(find(def.waterline)).min.y : 0, len = cb.max.x - cb.min.x, cx = (cb.max.x + cb.min.x) / 2, cz = (cb.max.z + cb.min.z) / 2;
      // Normalise: origin at the hull centre on the waterline, bow along +x, length 1.
      const norm = new T.Matrix4().makeScale(1 / len, 1 / len, 1 / len).multiply(new T.Matrix4().makeRotationY(flip < 0 ? Math.PI : 0)).multiply(new T.Matrix4().makeTranslation(-cx, -wl, -cz));
      const groups = new Map();
      root.traverse(o => { if (!o.isMesh) return; const g = o.geometry.clone(); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); const ng = g.index ? g.toNonIndexed() : g; ng.applyMatrix4(new T.Matrix4().multiplyMatrices(norm, o.matrixWorld)); if (!ng.attributes.normal) ng.computeVertexNormals(); const m = o.material, key = m.name || m.uuid; if (!groups.has(key)) groups.set(key, { m, list: [] }); groups.get(key).list.push(ng); });
      const plane = new T.Plane(new T.Vector3(0, 1, 0), 0), scene = new T.Scene(), model = new T.Group(); model.matrixAutoUpdate = false; scene.add(model);
      for (const { m, list } of groups.values()) { const geo = U.mergeGeometries(list, false); const mat = new T.MeshStandardMaterial({ color: m.color, roughness: Math.min(.9, (m.roughness ?? .6) + .1), metalness: m.metalness ?? .1, side: T.DoubleSide, clippingPlanes: [plane] }); if (/sail|pennant|jib/i.test(m.name || '')) { mat.emissive = m.color.clone().multiplyScalar(.55); mat.roughness = .95; mat.metalness = 0; } /* canvas reads white from either side */ model.add(new T.Mesh(geo, mat)); }
      const nb = new T.Box3().setFromObject(model); const fun = find(def.funnel) ? (() => { const fb = box(find(def.funnel)), p = new T.Vector3((fb.min.x + fb.max.x) / 2, fb.max.y, (fb.min.z + fb.max.z) / 2).applyMatrix4(norm); return { f: p.x, up: p.y, l: p.z }; })() : null;
      scene.add(new T.HemisphereLight(0xdff0ff, 0x2a4552, 1.25)); const sun = new T.DirectionalLight(0xfff1dc, 2.1); sun.position.set(-1, 2.2, 1.6); scene.add(sun); const rim = new T.DirectionalLight(0x9fd8ff, .5); rim.position.set(1.2, .6, -1); scene.add(rim);
      state[id] = { status: 'ready', T, scene, model, plane, top: nb.max.y, fun, camera: new T.OrthographicCamera(-1, 1, 1, -1, -1e5, 1e5) };
      for (const f of listeners) try { f(id); } catch (e) { }
    } catch (e) { console.warn('model load failed', id, e); state[id] = { status: 'error' }; }
  }

  function renderer(T) { if (R) return R; const cv = document.createElement('canvas'); const r = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, premultipliedAlpha: true }); r.setPixelRatio(1); r.localClippingEnabled = true; r.outputColorSpace = T.SRGBColorSpace; r.setClearColor(0x000000, 0); R = { r, cv, w: 0, h: 0 }; return R; }

  // Draw boat `b` into 2D context `c`. o: { len (world units), E (elevation vector), bob, pitch, roll, yaw }
  function draw(id, c, b, o) {
    const S = state[id]; if (!S || S.status !== 'ready') return false; const T = S.T, m = c.getTransform(), k = Math.hypot(m.a, m.b), rot = Math.atan2(m.b, m.a);
    const px = m.a * b.x + m.c * b.y + m.e, py = m.b * b.x + m.d * b.y + m.f, L = o.len * k, elev = Math.min(.999, Math.hypot(o.E.x, o.E.y)), sphi = elev, cphi = Math.sqrt(1 - elev * elev);
    if (L < 3 || px < -L * 2 || py < -L * 2 || px > c.canvas.width + L * 2 || py > c.canvas.height + L * 2) return true;
    const a = b.h + rot + (o.yaw || 0), ca = Math.cos(a), sa = Math.sin(a), bob = (o.bob || 0) * k;
    // model (x fwd, y up, z lateral) → ground (X, Yd down, Z up) → three (x, y up-screen, z depth)
    const W = new T.Matrix4().makeRotationZ(o.pitch || 0).multiply(new T.Matrix4().makeRotationX(o.roll || 0));
    const G = new T.Matrix4().set(ca * L, 0, -sa * L, 0, sa * L, 0, ca * L, 0, 0, L, 0, bob, 0, 0, 0, 1);
    const P = new T.Matrix4().set(1, 0, 0, 0, 0, -1, elev, 0, 0, sphi, cphi, 0, 0, 0, 0, 1);
    S.model.matrix.copy(P).multiply(G).multiply(W); S.model.matrixWorldNeedsUpdate = true;
    S.plane.normal.set(0, sphi, 1).normalize(); S.plane.constant = 0; // keep only what is above the sea
    const half = Math.ceil(Math.max(L * .62, S.top * L * elev + L * .35) + 4), size = Math.min(1600, half * 2), hs = size / 2;
    const rr = renderer(T); if (rr.w !== size || rr.h !== size) { rr.r.setSize(size, size, false); rr.w = rr.h = size; }
    const cam = S.camera; cam.left = -hs; cam.right = hs; cam.top = hs; cam.bottom = -hs; cam.updateProjectionMatrix();
    rr.r.render(S.scene, cam);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(rr.cv, px - hs, py - hs); c.restore();
    // world position of the funnel top, for smoke
    if (S.fun) { const h = b.h, f = S.fun, Lw = o.len; b._fun = { x: b.x + (f.f * Math.cos(h) - f.l * Math.sin(h)) * Lw, y: b.y + (f.f * Math.sin(h) + f.l * Math.cos(h)) * Lw, z: f.up * Lw + (o.bob || 0) }; }
    return true;
  }

  window.SailoModels = { MODELS, load, draw, ready: id => !!(state[id] && state[id].status === 'ready'), failed: id => !!(state[id] && state[id].status === 'error'), top: id => state[id] && state[id].top, onReady: f => listeners.push(f) };
})();
