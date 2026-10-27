// Sailo · Ocean objects: floating debris, shipwrecks and underwater discoveries.
// A self-contained module the main app plugs into (window.SailoOcean). It reuses the
// app's wave field (host.waveH), weather (host.env), currents, habitat data (host.marine)
// and camera/projection (host.E, host.toScreen) instead of keeping its own copies.
//
// World layout is deterministic: the ocean is split into cells in *global* coordinates and
// every cell seeds its own objects, so all sailors see the same wreck in the same place
// with the same id. Surface debris re-seeds every few hours; wrecks and seabed finds never
// move. Rewards are decided on the server (claim_find RPC) when Supabase is configured.
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const CELL = 700;                  // world units per cell (~3.5 km)
  const DEBRIS_EPOCH = 4 * 3600e3;   // surface debris reshuffles every 4 hours
  const fr = x => x - Math.floor(x);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash3 = (a, b, s) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return h >>> 0; };
  const rngOf = seed => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, u) => { const A = hexRgb(a), B = hexRgb(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * u)) + ')'; };
  const shade = (h, f) => 'rgb(' + hexRgb(h).map(v => Math.round(clamp(v * f, 0, 255))) + ')';

  const RAR = {
    Common: { w: 30, col: '#e9cf9a', rank: 0 }, Uncommon: { w: 10, col: '#9fe3b8', rank: 1 }, Rare: { w: 3, col: '#5fd4c4', rank: 2 },
    'Very rare': { w: .8, col: '#b79cff', rank: 3 }, Legendary: { w: .22, col: '#f2c14e', rank: 4 }
  };

  // ── Catalog ───────────────────────────────────────────────────────────────
  // cat: float (surface), wreck (seabed + parts above water), under (seabed finds)
  // hab: habitats from Marine.habAt · size: world units · mass: buoyancy response
  // sub: fraction below the waterline · act: primary action · pool: reward pool
  const K = {
    crate: { cat: 'float', name: 'Wooden crate', rar: 'Common', hab: ['coast', 'open', 'reef'], size: 8, mass: 1.1, sub: .35, act: 'Open', pool: 'crate', desc: 'A salt-swollen shipping crate, still nailed shut.' },
    barrel: { cat: 'float', name: 'Wooden barrel', rar: 'Common', hab: ['coast', 'open'], size: 7, mass: 1.3, sub: .45, act: 'Open', pool: 'barrel', desc: 'An oak barrel rolling in the swell. Something sloshes inside.' },
    driftwood: { cat: 'float', name: 'Driftwood', rar: 'Common', hab: ['coast', 'reef', 'open'], size: 18, mass: .6, sub: .5, act: 'Collect', pool: 'wood', desc: 'Sun-bleached driftwood, smoothed by years at sea.' },
    planks: { cat: 'float', name: 'Wooden planks', rar: 'Common', hab: ['coast', 'open'], size: 12, mass: .5, sub: .3, act: 'Collect', pool: 'wood', desc: 'Loose deck planks, scattered from some distant hull.' },
    net: { cat: 'float', name: 'Fishing net', rar: 'Common', hab: ['coast', 'reef'], size: 22, mass: .4, sub: .8, act: 'Haul in', pool: 'rope', desc: 'A tangled fishing net, half under water. Better hauled out before it snares anything.' },
    rope: { cat: 'float', name: 'Rope bundle', rar: 'Common', hab: ['coast', 'open'], size: 7, mass: .5, sub: .4, act: 'Collect', pool: 'rope', desc: 'A coil of hemp rope, frayed at one end.' },
    fbuoy: { cat: 'float', name: 'Fishing buoy', rar: 'Common', hab: ['coast', 'reef'], size: 6, mass: .8, sub: .5, act: 'Inspect', pool: 'small', desc: 'An abandoned fishing buoy. Its line was cut long ago.' },
    lifebuoy: { cat: 'float', name: 'Empty lifebuoy', rar: 'Uncommon', hab: ['coast', 'open'], size: 8, mass: .4, sub: .3, act: 'Inspect', pool: 'small', desc: 'An empty lifebuoy. The name stencilled on it has faded to nothing.' },
    suitcase: { cat: 'float', name: 'Lost suitcase', rar: 'Uncommon', hab: ['open', 'coast'], size: 7, mass: 1, sub: .55, act: 'Open', pool: 'case', desc: 'A leather suitcase, its buckles green with salt.' },
    mast: { cat: 'float', name: 'Broken mast', rar: 'Uncommon', hab: ['open', 'coast'], size: 34, mass: 1.4, sub: .6, act: 'Inspect', pool: 'wood', desc: 'A snapped mast trailing torn canvas.' },
    cargo: { cat: 'float', name: 'Cargo container', rar: 'Rare', hab: ['open', 'deep'], size: 30, mass: 5, sub: .72, act: 'Inspect', pool: 'cargo', desc: 'A lost shipping container riding low in the water.' },
    dinghy: { cat: 'float', name: 'Abandoned dinghy', rar: 'Rare', hab: ['coast', 'open'], size: 16, mass: 1.6, sub: .25, act: 'Inspect', pool: 'small', desc: 'A small dinghy drifting with no one aboard.' },
    lantern: { cat: 'float', name: 'Floating lantern', rar: 'Rare', hab: ['coast', 'reef', 'open'], size: 6, mass: .3, sub: .2, act: 'Collect', pool: 'lantern', desc: 'A paper lantern, still glowing. Someone let it go on purpose.' },
    chest: { cat: 'float', name: 'Treasure chest', rar: 'Very rare', hab: ['reef', 'coast', 'open'], size: 8, mass: 1.5, sub: .55, act: 'Open', pool: 'chest', excl: true, desc: 'A brass-bound chest, bobbing against all reason. Whoever opens it first keeps what is inside.' },
    bottle: { cat: 'float', name: 'Message in a bottle', rar: 'Uncommon', hab: [], size: 5, mass: .3, sub: .4, act: 'Read', pool: 'small', noSpawn: true, desc: 'A corked bottle with a note rolled up inside.' },

    w_row: { cat: 'wreck', name: 'Broken wooden rowboat', rar: 'Uncommon', hab: ['coast', 'reef'], size: 22, dep: [1.2, 3], act: 'Explore', pool: 'wreck', desc: 'A rowboat split along its keel, half buried in sand.' },
    w_fish: { cat: 'wreck', name: 'Wrecked fishing boat', rar: 'Rare', hab: ['coast', 'reef'], size: 48, dep: [2, 5], act: 'Explore', pool: 'wreck', mast: 1, desc: 'A trawler that ran onto the shallows. Its mast still breaks the surface.' },
    w_sail: { cat: 'wreck', name: 'Sunken sailboat', rar: 'Rare', hab: ['coast', 'reef', 'open'], size: 40, dep: [3, 8], act: 'Explore', pool: 'wreck', mast: 1, desc: 'A sloop resting on her side, sails long gone to the sea.' },
    w_yacht: { cat: 'wreck', name: 'Abandoned yacht', rar: 'Very rare', hab: ['open'], size: 56, dep: [.4, .8], act: 'Explore', pool: 'wreck', listing: 1, desc: 'A white yacht listing hard to one side. The cabin door swings open.' },
    w_pirate: { cat: 'wreck', name: 'Pirate shipwreck', rar: 'Very rare', hab: ['reef', 'coast'], zone: ['trop', 'sub'], size: 100, dep: [3, 7], act: 'Explore', pool: 'pirate', mast: 2, desc: 'A galleon broken across a reef, cannons spilled along the sand.' },
    w_cargo: { cat: 'wreck', name: 'Sunken cargo ship', rar: 'Very rare', hab: ['deep', 'coast'], size: 190, dep: [6, 26], act: 'Explore', pool: 'wreck', desc: 'A cargo ship on the seabed, containers scattered like dropped bricks.' },
    w_viking: { cat: 'wreck', name: 'Broken Viking longship', rar: 'Very rare', hab: ['coast'], zone: ['temp', 'cold'], size: 64, dep: [2, 5], act: 'Explore', pool: 'relic', prow: 1, desc: 'A longship of overlapping planks. A carved dragon prow still points to sea.' },
    w_sub: { cat: 'wreck', name: 'Sunken submarine', rar: 'Legendary', hab: ['deep', 'open'], size: 110, dep: [10, 24], act: 'Explore', pool: 'relic', desc: 'A submarine resting in the dark, its conning tower crusted with life.' },
    w_merchant: { cat: 'wreck', name: 'Ancient merchant ship', rar: 'Legendary', hab: ['reef', 'coast'], size: 80, dep: [3, 7], act: 'Explore', pool: 'relic', desc: 'A merchant ship from another age, its hold full of amphorae.' },
    w_giant: { cat: 'wreck', name: 'Giant mysterious shipwreck', rar: 'Legendary', hab: ['deep'], size: 320, dep: [12, 28], act: 'Explore', pool: 'relic', glow: 1, desc: 'Something enormous lies below. Nobody agrees on what it was.' },

    u_anchor: { cat: 'under', name: 'Old anchor', rar: 'Uncommon', hab: ['reef', 'coast'], size: 7, dep: [1.5, 5], act: 'Salvage', pool: 'relic', desc: 'An iron anchor, fluke buried in the sand.' },
    u_chain: { cat: 'under', name: 'Rusted chain', rar: 'Common', hab: ['reef', 'coast'], size: 12, dep: [1.5, 5], act: 'Salvage', pool: 'small', desc: 'A run of rusted chain, links fused by the sea.' },
    u_cannon: { cat: 'under', name: 'Old cannon', rar: 'Rare', hab: ['reef', 'coast'], size: 9, dep: [2, 6], act: 'Salvage', pool: 'pirate', desc: 'A bronze cannon, green with age.' },
    u_prop: { cat: 'under', name: 'Ship propeller', rar: 'Rare', hab: ['coast', 'open'], size: 8, dep: [3, 9], act: 'Salvage', pool: 'small', desc: 'A three-bladed propeller torn from its shaft.' },
    u_wheel: { cat: 'under', name: 'Broken ship wheel', rar: 'Uncommon', hab: ['reef', 'coast'], size: 7, dep: [1.5, 5], act: 'Salvage', pool: 'relic', desc: "A ship's wheel missing two spokes." },
    u_pots: { cat: 'under', name: 'Ceramic pots', rar: 'Common', hab: ['reef'], size: 6, dep: [1.2, 4], act: 'Salvage', pool: 'relic', desc: 'A cluster of glazed pots, some still sealed.' },
    u_amphora: { cat: 'under', name: 'Ancient amphorae', rar: 'Uncommon', hab: ['reef', 'coast'], size: 5, dep: [1.5, 5], act: 'Salvage', pool: 'relic', desc: 'Clay amphorae from a trade route long forgotten.' },
    u_chest: { cat: 'under', name: 'Sunken treasure chest', rar: 'Very rare', hab: ['reef'], size: 6, dep: [1.5, 4], act: 'Open', pool: 'chest', excl: true, desc: 'A chest on the seabed, lid ajar, something glinting inside.' },
    u_statue: { cat: 'under', name: 'Coral-covered statue', rar: 'Very rare', hab: ['reef'], size: 10, dep: [2, 5], act: 'Salvage', pool: 'relic', desc: 'A stone figure wearing a crown of coral.' },
    u_plane: { cat: 'under', name: 'Sunken aircraft', rar: 'Legendary', hab: ['reef', 'coast'], size: 40, dep: [3, 8], act: 'Explore', pool: 'relic', desc: 'A small aircraft on the seabed, wings intact, fish living in the cockpit.' },
    u_nav: { cat: 'under', name: 'Old navigation equipment', rar: 'Rare', hab: ['reef', 'coast'], size: 5, dep: [1.5, 5], act: 'Salvage', pool: 'relic', desc: 'A sextant and brass compass, wedged between rocks.' },
    u_ruins: { cat: 'under', name: 'Submerged ruins', rar: 'Legendary', hab: ['reef'], zone: ['trop', 'sub'], size: 60, dep: [2, 6], act: 'Explore', pool: 'relic', desc: 'Columns and steps of a drowned city. Its name is lost.' }
  };

  for (const id in K) { const d = K[id]; if (d.cat === 'float') d.size *= id === 'cargo' || id === 'mast' ? 1.15 : 1.5; else if (d.cat === 'under' && d.size < 20) d.size *= 2; }
  const POOLS = {
    crate: ['mat:timber', 'mat:nails', 'mat:canvas', 'decor:bell', 'decor:lantern', 'flag:seaglass'],
    barrel: ['mat:timber', 'mat:rope', 'decor:lantern', 'mat:nails'],
    wood: ['mat:timber', 'mat:nails'], rope: ['mat:rope', 'mat:canvas'], small: ['mat:rope', 'mat:timber', 'mat:canvas'],
    case: ['decor:compassrose', 'decor:bell', 'flag:sunset'], lantern: ['decor:lantern', 'flag:sunset'],
    cargo: ['mat:nails', 'decor:compassrose', 'sail:seafoam'],
    chest: ['flag:jolly', 'flag:aurora', 'sail:saffron', 'sail:midnight', 'sail:rose', 'flag:sunset'],
    wreck: ['relic:compass', 'relic:bell', 'mat:timber', 'sail:seafoam'], pirate: ['relic:coin', 'flag:jolly', 'relic:compass'],
    relic: ['relic:coin', 'relic:amphora', 'relic:figurehead', 'relic:compass']
  };
  const REWARDS = {
    'mat:timber': { name: 'Salvaged timber', type: 'Material' }, 'mat:nails': { name: 'Brass nails', type: 'Material' }, 'mat:canvas': { name: 'Canvas scraps', type: 'Material' }, 'mat:rope': { name: 'Old rope', type: 'Material' },
    'decor:bell': { name: "Ship's bell", type: 'Decoration' }, 'decor:lantern': { name: 'Lantern charm', type: 'Decoration' }, 'decor:compassrose': { name: 'Compass rose decal', type: 'Decoration' },
    'flag:seaglass': { name: 'Sea-glass flag', type: 'Flag', col: '#7fe0c8' }, 'flag:sunset': { name: 'Sunset flag', type: 'Flag', col: '#ff8058' }, 'flag:aurora': { name: 'Aurora flag', type: 'Flag', col: '#8fe3b0' }, 'flag:jolly': { name: 'Jolly Roger', type: 'Flag', col: '#1d1d22' },
    'sail:saffron': { name: 'Saffron sails', type: 'Sails', col: '#f3c46b' }, 'sail:midnight': { name: 'Midnight sails', type: 'Sails', col: '#3a4766' }, 'sail:rose': { name: 'Rose sails', type: 'Sails', col: '#f2b8b8' }, 'sail:seafoam': { name: 'Seafoam sails', type: 'Sails', col: '#bfe9dc' },
    'relic:coin': { name: 'Gold doubloon', type: 'Relic' }, 'relic:compass': { name: 'Brass compass', type: 'Relic' }, 'relic:bell': { name: 'Wreck bell', type: 'Relic' }, 'relic:figurehead': { name: 'Carved figurehead', type: 'Relic' }, 'relic:amphora': { name: 'Ancient amphora', type: 'Relic' }
  };
  const CATS = [['float', 'Floating'], ['wreck', 'Shipwrecks'], ['under', 'Underwater']];
  const HULL = [[.5, 0], [.4, .42], [.22, .82], [-.05, 1], [-.34, .96], [-.48, .74], [-.52, .34], [-.52, -.34], [-.48, -.74], [-.34, -.96], [-.05, -1], [.22, -.82], [.4, -.42]];
  const LIGHT = [-.6, -.8];
  // Same pick on client and server: hash of object id + user id (server uses hashtext; demo uses this).
  const pickReward = (pool, key) => { const l = POOLS[pool] || POOLS.small; let h = 7; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return l[h % l.length]; };

  class Ocean {
    constructor(h) {
      this.h = h; this.cells = new Map(); this.active = []; this.local = []; this.taken = {}; this.flash = null; this.thumbs = {};
      this.journal = { finds: {}, pins: [] }; this.stormT = 30; this.isl = null; this.claimT = 0; this.fishAt = {};
      this.loadLocal();
    }
    static get KINDS() { return K; }
    static get REWARDS() { return REWARDS; }

    // ── Persistence ───────────────────────────────────────────────────────────
    lsKey() { const u = this.h.state.auth && this.h.state.auth.user; return 'sailo.journal.' + (u ? u.id : 'guest'); }
    loadLocal() { try { const j = JSON.parse(localStorage.getItem(this.lsKey()) || 'null'); if (j && j.finds) this.journal = { finds: j.finds, pins: j.pins || [] }; } catch (e) { } }
    saveLocal() { try { localStorage.setItem(this.lsKey(), JSON.stringify(this.journal)); } catch (e) { } }
    async load() { // after sign-in
      this.journal = { finds: {}, pins: [] }; this.loadLocal(); const H = this.h;
      if (Array.isArray(H.state.pins)) this.journal.pins = H.state.pins;
      if (H.isReal() && H.A.loadFinds) { try { const rows = await H.A.loadFinds(); for (const r of rows || []) this.journal.finds[r.object_id] = { kind: r.kind, rar: r.rarity, region: r.region, reward: r.reward, at: Date.parse(r.created_at) || Date.now() }; } catch (e) { } }
      this.saveLocal(); this.refreshCosmetics();
      if (H.isReal() && H.A.subscribeClaims && !this.sub) { try { this.sub = H.A.subscribeClaims(row => { if (row && row.object_id && row.user_id !== (H.state.auth.user || {}).id) this.taken[row.object_id] = 1; }); } catch (e) { } }
    }
    refreshCosmetics() { const own = new Set(); for (const f of Object.values(this.journal.finds)) if (f.reward && /^(flag|sail):/.test(f.reward)) own.add(f.reward); const list = [...own]; const cur = this.h.state.cosmetics || []; if (list.join() !== cur.join()) this.h.setState({ cosmetics: list }); }

    // ── World generation (deterministic per global cell) ──────────────────────
    habitat(x, y) { const M = this.h.marine; if (!M) return null; const zn = M.zoneAt(x, y); return { zn, hb: M.habAt(x, y, zn.z) }; }
    choose(cat, hb, zn, r) {
      const pool = []; let tot = 0;
      for (const id in K) { const d = K[id]; if (d.cat !== cat || d.noSpawn || !d.hab.includes(hb.h) || (d.zone && !d.zone.includes(zn.z))) continue; tot += RAR[d.rar].w; pool.push([id, tot]); }
      if (!tot) return null; const v = r() * tot; return pool.find(p => p[1] >= v)[0];
    }
    gen(ix, iy) {
      const H = this.h, [OX, OY] = H.globalOff(), out = [], epoch = Math.floor(Date.now() / DEBRIS_EPOCH);
      const place = (cat, r, tag, gx, gy) => {
        const x = gx - OX, y = gy - OY; if (H.isLand(x, y)) return null; const env = this.habitat(x, y); if (!env) return null;
        const kind = this.choose(cat, env.hb, env.zn, r); if (!kind) return null; const d = K[kind];
        const o = { id: kind + ':' + ix + ':' + iy + ':' + tag, kind, d, cat, gx, gy, seed: r() * 1000, h: r() * TAU, hab: env.hb.h, wd: env.hb.wd, cold: env.zn.z === 'cold', zone: env.zn.z };
        if (cat === 'float') { o.ax = 20 + r() * 60; o.ay = 20 + r() * 60; o.per = 300 + r() * 600; o.ph = r() * TAU; o.ph2 = r() * TAU; }
        else { const dr = d.dep; o.dep = Math.min(Math.max(.4, env.hb.wd - .3), dr[0] + r() * (dr[1] - dr[0])); }
        o.st = { bob: 0, sp: 0, sr: 0, spin: 0, dx: 0, dy: 0, init: false }; return o;
      };
      // Stable features: wrecks and seabed finds.
      let r = rngOf(hash3(ix, iy, 7771));
      if (r() < .035) { const o = place('wreck', r, 'w', (ix + .2 + r() * .6) * CELL, (iy + .2 + r() * .6) * CELL); if (o) out.push(o); }
      if (r() < .1) { const o = place('under', r, 'u', (ix + r()) * CELL, (iy + r()) * CELL); if (o) out.push(o); }
      // Surface debris, reshuffled each epoch. Sometimes a little group from the same spill.
      r = rngOf(hash3(ix, iy, 9000 + epoch));
      if (r() < .5) {
        const gx = (ix + .1 + r() * .8) * CELL, gy = (iy + .1 + r() * .8) * CELL, n = r() < .3 ? 2 + Math.floor(r() * 3) : 1;
        let first = null;
        for (let i = 0; i < n; i++) {
          const ox = i ? (r() - .5) * 90 : 0, oy = i ? (r() - .5) * 90 : 0; const o = place('float', r, 'f' + epoch + '_' + i, gx + ox, gy + oy);
          if (!o) continue; if (i && first && ['crate', 'barrel', 'planks', 'rope', 'driftwood'].includes(first.kind) && r() < .7) { o.kind = first.kind; o.d = K[first.kind]; o.id = o.kind + ':' + ix + ':' + iy + ':f' + epoch + '_' + i; }
          if (!first) first = o; out.push(o);
        }
      }
      return out;
    }

    // ── Update ───────────────────────────────────────────────────────────────
    update(dt) {
      const H = this.h, z = H.cam.z, me = H.boatsById && H.boatsById.me; if (!me || !H.env || !H.marine) return;
      if (this.isl !== H.islands) { this.isl = H.islands; this.cells.clear(); }
      const [OX, OY] = H.globalOff(), t = H.t, e = H.env;
      const live = !H.state.authView && !H.state.loggedOut;
      this.active = [];
      if (z >= .12) {
        const R = Math.hypot(H.vw || 1, H.vh || 1) / 2 / z + 300, cx = H.cam.x + OX, cy = H.cam.y + OY;
        const keep = new Set(), add = (gx, gy, rad) => { const n = Math.min(4, Math.ceil(rad / CELL)), i0 = Math.floor(gx / CELL), j0 = Math.floor(gy / CELL); for (let i = i0 - n; i <= i0 + n; i++)for (let j = j0 - n; j <= j0 + n; j++)keep.add(i + ',' + j); };
        add(cx, cy, R); add(me.x + OX, me.y + OY, 600);
        for (const k of keep) { if (!this.cells.has(k)) { const [i, j] = k.split(',').map(Number); this.cells.set(k, this.gen(i, j)); } this.active.push(...this.cells.get(k)); }
        for (const k of [...this.cells.keys()]) if (!keep.has(k)) this.cells.delete(k);
      }
      // Storm debris: temporary local clusters near the boat (not shared, they wash away).
      if (live && e.storm > .5) { this.stormT -= dt; if (this.stormT <= 0) { this.stormT = 35 + Math.random() * 40; this.stormDebris(me); } }
      this.local = this.local.filter(o => t - o.born < 150); this.active.push(...this.local);
      const sw = Date.now() / 1000, sb = H.sbNow || 1;
      for (const o of this.active) {
        o.x = o.gx - OX; o.y = o.gy - OY;
        if (o.cat === 'float') { // deterministic drift (shared), plus local wind drag
          const w = TAU / o.per; o.x += Math.sin(sw * w + o.ph) * o.ax; o.y += Math.cos(sw * w * .83 + o.ph2) * o.ay; o.hd = o.h + Math.sin(sw * w * 1.7 + o.ph) * .6;
          const wdg = (o.d.mass < 1 ? .9 : .4) * e.w * .2; o.st.dx += (Math.cos(H.wind) * wdg - o.st.dx) * Math.min(1, dt * .15); o.st.dy += (Math.sin(H.wind) * wdg - o.st.dy) * Math.min(1, dt * .15);
          o.x += o.st.dx; o.y += o.st.dy;
        } else o.hd = o.h;
        if (o.ok === undefined || o.ok === null) { const w = H.marine.isWater(o.x, o.y); if (w !== null) o.ok = w !== false; }
        o.found = !!this.journal.finds[o.id]; o.gone = (o.found && o.cat === 'float' && !['cargo', 'dinghy', 'mast'].includes(o.kind)) || !!this.taken[o.id];
        const s = H.toScreen(o.x, o.y); o.sx = s.x; o.sy = s.y; o.onScreen = s.x > -80 && s.y > -80 && s.x < H.vw + 80 && s.y < H.vh + 80;
        o.dist = Math.hypot(o.x - me.x, o.y - me.y); o.near = o.dist < (240 + o.d.size * .8) * sb;
        if (o.cat === 'float' && o.onScreen) this.physics(o, dt, e);
        if (o.cat === 'wreck' && o.near && !this.fishAt[o.id] && o.ok !== false) { this.fishAt[o.id] = 1; this.wreckFish(o); }
      }
      // Exclusive objects: ask the server which are already claimed (cheap, batched, throttled).
      this.claimT -= dt; if (this.claimT <= 0 && H.isReal() && H.A.oceanClaims) { this.claimT = 20; const ids = this.active.filter(o => o.d.excl && !o.found).map(o => o.id); if (ids.length) H.A.oceanClaims(ids).then(rows => { for (const r of rows || []) if (r.user_id !== (H.state.auth.user || {}).id) this.taken[r.object_id] = 1; }).catch(() => { }); }
      // Discovery cue when a new find comes into range.
      for (const o of this.active) if (o.near && !o.found && !o.gone && o.ok !== false && !o.cued) { o.cued = 1; if (RAR[o.d.rar].rank >= 2) { H.sfx('chime'); } }
    }
    physics(o, dt, e) {
      const H = this.h, d = o.d, L = d.size * .5, cs = Math.cos(o.hd), sn = Math.sin(o.hd), W = (x, y) => H.waveH(x, y);
      const hc = W(o.x, o.y), hf = W(o.x + cs * L, o.y + sn * L), hb = W(o.x - cs * L, o.y - sn * L), hp = W(o.x - sn * L * .6, o.y + cs * L * .6), hs = W(o.x + sn * L * .6, o.y - cs * L * .6);
      const k = Math.min(1, dt * 3.2 / d.mass), heave = (hc * 2 + hf + hb + hp + hs) / 6, sp = clamp((hf - hb) / (2 * L) * 1.4, -.5, .5), sr = clamp((hp - hs) / (1.2 * L) * 1.4, -.5, .5);
      const st = o.st; if (!st.init) { st.init = true; st.bob = heave; st.sp = sp; st.sr = sr; }
      st.bob += (heave * 1.1 - st.bob) * k; st.sp += (sp - st.sp) * k; st.sr += (sr - st.sr) * k;
      if (o.kind === 'barrel' || o.kind === 'driftwood') st.spin += (sr * 3 + Math.sin(H.t * .7 + o.seed) * .2) * dt * (1 + e.chop);
      if ((e.rain > .25 || e.storm > .4) && Math.random() < dt * (e.rain * 2 + e.storm * 3) && H.spray && H.spray.length < 160) { const sb = H.sbNow || 1, a = Math.random() * TAU; H.spray.push({ x: o.x + Math.cos(a) * L * .6, y: o.y + Math.sin(a) * L * .6, z: 0, vx: Math.cos(a) * 6 * sb, vy: Math.sin(a) * 6 * sb, vz: (8 + Math.random() * 10) * sb, g: 50 * sb, r: (.5 + Math.random() * .6) * sb, a: 0, l: .5 }); }
    }
    stormDebris(me) {
      const H = this.h, sb = H.sbNow || 1, [OX, OY] = H.globalOff(), a = me.h + (Math.random() - .5) * 1.6, d = (180 + Math.random() * 140) * sb, bx = me.x + Math.cos(a) * d, by = me.y + Math.sin(a) * d; if (H.isLand(bx, by)) return;
      const kinds = ['planks', 'crate', 'barrel', 'rope', 'driftwood'], n = 3 + Math.floor(Math.random() * 3), id0 = 'storm' + Math.floor(H.t * 10);
      for (let i = 0; i < n; i++) { const kind = kinds[Math.floor(Math.random() * kinds.length)]; this.local.push({ id: kind + ':' + id0 + '_' + i, kind, d: K[kind], cat: 'float', gx: bx + OX + (Math.random() - .5) * 80, gy: by + OY + (Math.random() - .5) * 80, seed: Math.random() * 1000, h: Math.random() * TAU, ax: 10, ay: 10, per: 200, ph: 0, ph2: 0, born: H.t, storm: 1, st: { bob: 0, sp: 0, sr: 0, spin: 0, dx: 0, dy: 0, init: false } }); }
    }
    wreckFish(o) { const M = this.h.marine; try { const zn = M.zoneAt(o.x, o.y), hb = M.habAt(o.x, o.y, zn.z), cf = M.cfg(); if (!cf.on) return; const k = zn.z === 'trop' || zn.z === 'sub' ? 'tropical' : 'mackerel'; M.make(k, o.x + (Math.random() - .5) * o.d.size * .6, o.y + (Math.random() - .5) * o.d.size * .6, hb, zn, cf); } catch (e) { } }

    // ── Projection helpers ────────────────────────────────────────────────────
    proj(x, y, h, st, E) { const cs = Math.cos(h), sn = Math.sin(h), bob = st ? st.bob : 0, sp = st ? st.sp : 0, sr = st ? st.sr : 0; return (lx, ly, lz) => { const l = lz + bob + lx * sp + ly * sr; return [x + lx * cs - ly * sn + l * E.x, y + lx * sn + ly * cs + l * E.y]; }; }
    poly(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++)c.lineTo(pts[i][0], pts[i][1]); c.closePath(); }
    area(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a; }
    // Extruded polygon (local xy, CCW) from z0 to z1. Faces below the waterline are washed out.
    prism(c, P, base, z0, z1, col, top, o) {
      const water = o && o.water || '#145d70', wet = o && o.wet != null ? o.wet : 0, n = base.length;
      const sides = []; for (let i = 0; i < n; i++) { const a = base[i], b = base[(i + 1) % n], nx = b[1] - a[1], ny = -(b[0] - a[0]), nl = Math.hypot(nx, ny) || 1, li = .55 + .45 * ((nx * LIGHT[0] + ny * LIGHT[1]) / nl); sides.push({ a, b, li }); }
      const face = (za, zb, alpha, tint) => { for (const f of sides) { const q = [P(f.a[0], f.a[1], za), P(f.b[0], f.b[1], za), P(f.b[0], f.b[1], zb), P(f.a[0], f.a[1], zb)]; if (this.area(q) <= 0) continue; c.globalAlpha = alpha; c.fillStyle = tint ? mix(shade(col, f.li), water, tint) : shade(col, f.li * (1 - wet * .25)); this.poly(c, q); c.fill(); } };
      const a0 = c.globalAlpha;
      if (z0 < 0) face(z0, Math.min(0, z1), a0 * .55, .6);
      if (z1 > 0) face(Math.max(0, z0), z1, a0, 0);
      c.globalAlpha = a0 * (z1 > 0 ? 1 : .5); c.fillStyle = z1 > 0 ? top : mix(top, water, .55); this.poly(c, base.map(p => P(p[0], p[1], z1))); c.fill(); c.globalAlpha = a0;
    }
    rect(l, w) { return [[l / 2, -w / 2], [l / 2, w / 2], [-l / 2, w / 2], [-l / 2, -w / 2]]; }
    // Lying cylinder along local x (barrels, logs, masts, cannons). spin rotates staves.
    cyl(c, P, L, r, zc, col, spin, o) {
      const N = 12, water = (o && o.water) || '#145d70', strips = [];
      for (let i = 0; i < N; i++) { const a0 = i / N * TAU + spin, a1 = (i + 1) / N * TAU + spin, m = (a0 + a1) / 2, ny = Math.cos(m), nz = Math.sin(m); strips.push({ a0, a1, m, ny, nz, li: .5 + .5 * clamp(ny * LIGHT[1] * -.4 + nz * .8, -1, 1), i }); }
      const p = (x, a) => P(x, Math.cos(a) * r, zc + Math.sin(a) * r), a0 = c.globalAlpha;
      for (const s of strips) {
        const q = [p(-L / 2, s.a0), p(L / 2, s.a0), p(L / 2, s.a1), p(-L / 2, s.a1)]; if (this.area(q) <= 0) continue;
        const sub = zc + s.nz * r < 0; c.globalAlpha = a0 * (sub ? .5 : 1); c.fillStyle = sub ? mix(shade(col, s.li), water, .6) : shade(col, s.li * (o && o.stave && s.i % 2 ? .85 : 1)); this.poly(c, q); c.fill();
      }
      for (const x of [-L / 2, L / 2]) { const cap = []; for (let i = 0; i < N; i++)cap.push(p(x, i / N * TAU)); const ar = this.area(cap); if (x > 0 ? ar < 0 : ar > 0) continue; c.globalAlpha = a0 * .95; c.fillStyle = shade(col, .72); this.poly(c, cap); c.fill(); if (o && o.stave) { c.strokeStyle = 'rgba(40,25,12,.5)'; c.lineWidth = r * .08; c.stroke(); } }
      if (o && o.hoops) { c.globalAlpha = a0; c.strokeStyle = '#3a2a1c'; c.lineWidth = r * .18; for (const hx of o.hoops) { c.beginPath(); let st = false; for (let i = 0; i <= N; i++) { const a = i / N * TAU, z = zc + Math.sin(a) * r; const q = P(hx * L, Math.cos(a) * r * 1.02, z); if (z < -.1) { st = false; continue; } if (!st) { c.moveTo(q[0], q[1]); st = true; } else c.lineTo(q[0], q[1]); } c.stroke(); } }
      c.globalAlpha = a0;
    }
    ripple(c, x, y, R, t, ph, a) { const k = (t * .45 + ph) % 1; c.globalAlpha = a * (1 - k) * .55; c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(.6, R * .05); c.beginPath(); c.ellipse(x, y, R * (.7 + k * .9), R * (.55 + k * .7), 0, 0, TAU); c.stroke(); c.globalAlpha = a; }

    // ── Floating object renderers ────────────────────────────────────────────
    drawFloat(c, o, x, y, s, t, alpha, E, env, preview) {
      const d = o.d, st = o.st, P = this.proj(x, y, o.hd, st, E), L = d.size * s, kind = o.kind, sub = d.sub, acc = env && env.acc > .04 ? env.acc : 0, wet = env ? env.rain : 0;
      c.save(); c.globalAlpha = alpha; c.lineJoin = 'round'; c.lineCap = 'round';
      if (!preview) { c.globalAlpha = alpha * .22; c.fillStyle = '#062a38'; c.beginPath(); c.ellipse(x + L * .12, y + L * .16, L * .6, L * .32, o.hd, 0, TAU); c.fill(); c.globalAlpha = alpha; this.ripple(c, x, y, L * .7, t, o.seed % 1, alpha); }
      const snowTop = (pts, z) => { if (!acc) return; c.globalAlpha = alpha * acc * .9; c.fillStyle = '#f4f8fb'; this.poly(c, pts.map(p => P(p[0] * .8, p[1] * .8, z + .01))); c.fill(); c.globalAlpha = alpha; };
      const wood = '#8a5a32', wood2 = '#b07a45';
      if (kind === 'crate' || kind === 'suitcase' || kind === 'chest') {
        const l = L, w = L * (kind === 'suitcase' ? .62 : .78), hh = L * (kind === 'suitcase' ? .3 : .7), z0 = -hh * sub, z1 = hh * (1 - sub);
        const col = kind === 'crate' ? '#9a6b3c' : kind === 'suitcase' ? '#6b3b26' : '#7a4a22', top = kind === 'crate' ? '#b98a55' : kind === 'suitcase' ? '#83503a' : '#8f5a2b';
        this.prism(c, P, this.rect(l, w), z0, z1, col, top, { wet });
        c.strokeStyle = kind === 'chest' ? '#e2b94d' : 'rgba(50,30,15,.55)'; c.lineWidth = Math.max(.5, L * (kind === 'chest' ? .07 : .04));
        if (kind === 'crate') { for (const f of [-.25, .25]) { c.beginPath(); c.moveTo(...P(-l / 2, w * f, z1)); c.lineTo(...P(l / 2, w * f, z1)); c.stroke(); } c.beginPath(); c.moveTo(...P(-l / 2, -w / 2, z1)); c.lineTo(...P(l / 2, w / 2, z1)); c.stroke(); }
        if (kind === 'chest') { for (const f of [-.3, .3]) { c.beginPath(); c.moveTo(...P(l * f, -w / 2, z1)); c.lineTo(...P(l * f, w / 2, z1)); c.stroke(); } const lk = P(l / 2, 0, z1 * .6); c.fillStyle = '#ffd86b'; c.beginPath(); c.arc(lk[0], lk[1], L * .07, 0, TAU); c.fill(); const g = Math.max(0, Math.sin(t * 3 + o.seed)); if (g > .7) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = alpha * (g - .7) / .3; const q = P(l * .2, -w * .2, z1); c.fillStyle = '#fff3c4'; c.beginPath(); c.arc(q[0], q[1], L * .09, 0, TAU); c.fill(); c.globalCompositeOperation = 'source-over'; c.globalAlpha = alpha; } }
        if (kind === 'suitcase') { const a = P(0, -w * .15, z1), b = P(0, w * .15, z1), m = P(0, 0, z1 + L * .12); c.strokeStyle = '#3a2216'; c.lineWidth = L * .05; c.beginPath(); c.moveTo(...a); c.quadraticCurveTo(...m, ...b); c.stroke(); }
        snowTop(this.rect(l, w), z1);
      } else if (kind === 'barrel') {
        const r = L * .33; this.cyl(c, P, L, r, r * (1 - sub * 2), '#8d5b2e', st.spin, { hoops: [-.32, .32], stave: 1 });
      } else if (kind === 'driftwood') {
        this.cyl(c, P, L, L * .08, 0, '#9c8f7e', st.spin * .3, {}); c.strokeStyle = '#8a7d6b'; c.lineWidth = L * .07; c.beginPath(); c.moveTo(...P(L * .15, 0, L * .03)); c.lineTo(...P(L * .28, L * .2, L * .03)); c.moveTo(...P(-L * .2, 0, L * .03)); c.lineTo(...P(-L * .3, -L * .16, L * .02)); c.stroke();
      } else if (kind === 'planks') {
        for (let i = 0; i < 3; i++) { const yo = (i - 1) * L * .22, xo = (i % 2 ? .12 : -.08) * L, ang = (i - 1) * .18; const cs = Math.cos(ang), sn = Math.sin(ang), PP = (lx, ly, lz) => P(xo + lx * cs - ly * sn, yo + lx * sn + ly * cs, lz); this.prism(c, PP, this.rect(L * .9, L * .14), -L * .02, L * .03, i % 2 ? wood : '#7a4e2b', wood2, { wet }); }
      } else if (kind === 'net') {
        const N = 6; c.strokeStyle = '#4c5f54'; c.lineWidth = Math.max(.4, L * .015); c.globalAlpha = alpha * .75;
        for (let i = 0; i <= N; i++) { c.beginPath(); for (let j = 0; j <= N; j++) { const u = i / N - .5, v = j / N - .5, zz = Math.sin(t * 1.3 + u * 6 + v * 4 + o.seed) * L * .03 - L * .02; const q = P(u * L, v * L * .8, zz); j ? c.lineTo(...q) : c.moveTo(...q); } c.stroke(); c.beginPath(); for (let j = 0; j <= N; j++) { const v = i / N - .5, u = j / N - .5, zz = Math.sin(t * 1.3 + u * 6 + v * 4 + o.seed) * L * .03 - L * .02; const q = P(u * L, v * L * .8, zz); j ? c.lineTo(...q) : c.moveTo(...q); } c.stroke(); }
        c.globalAlpha = alpha; c.fillStyle = '#ff9a3c'; for (let i = 0; i < 5; i++) { const q = P((i / 4 - .5) * L, -L * .42, L * .03); c.beginPath(); c.arc(q[0], q[1], L * .035, 0, TAU); c.fill(); }
      } else if (kind === 'rope') {
        c.strokeStyle = '#a8895c'; c.lineWidth = L * .11; c.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU * 2.6, rr = L * (.12 + i / 40 * .36); const q = P(Math.cos(a) * rr, Math.sin(a) * rr, L * .05); i ? c.lineTo(...q) : c.moveTo(...q); } c.stroke(); c.strokeStyle = 'rgba(90,65,35,.6)'; c.lineWidth = L * .03; c.stroke();
      } else if (kind === 'fbuoy' || kind === 'lifebuoy') {
        if (kind === 'lifebuoy') { const R = L * .4; for (let i = 0; i < 8; i++) { c.strokeStyle = i % 2 ? '#f4efe6' : '#e8604c'; c.lineWidth = L * .2; c.beginPath(); for (let k = 0; k <= 6; k++) { const a = (i + k / 6) / 8 * TAU, q = P(Math.cos(a) * R, Math.sin(a) * R, L * .06); k ? c.lineTo(...q) : c.moveTo(...q); } c.stroke(); } c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = L * .03; c.beginPath(); for (let k = 0; k <= 24; k++) { const a = k / 24 * TAU, q = P(Math.cos(a) * R * .8, Math.sin(a) * R * .8, L * .1); k ? c.lineTo(...q) : c.moveTo(...q); } c.stroke(); }
        else { const q = P(0, 0, L * .2), R = L * .38, g = c.createRadialGradient(q[0] - R * .3, q[1] - R * .35, R * .1, q[0], q[1], R); g.addColorStop(0, '#ffc07a'); g.addColorStop(1, '#d9541e'); c.fillStyle = g; c.beginPath(); c.arc(q[0], q[1], R, 0, TAU); c.fill(); const tp = P(0, 0, L * 1.2), fw = Math.sin(t * 5 + o.seed) * L * .05; c.strokeStyle = '#2b2f36'; c.lineWidth = L * .06; c.beginPath(); c.moveTo(...q); c.lineTo(...tp); c.stroke(); c.fillStyle = '#1d1d22'; c.beginPath(); c.moveTo(...tp); c.lineTo(tp[0] + L * .35, tp[1] + fw + L * .05); c.lineTo(tp[0] + E.x * -L * .2, tp[1] - E.y * L * .2); c.closePath(); c.fill(); }
      } else if (kind === 'mast') {
        this.cyl(c, P, L, L * .045, 0, '#6e4a2c', 0, {}); const fl = t * 3 + o.seed, pts = []; for (let i = 0; i <= 6; i++) { const u = i / 6; pts.push(P((u - .5) * L * .55 - L * .1, L * .05 + Math.sin(fl + u * 4) * L * .03, L * .02)); } for (let i = 6; i >= 0; i--) { const u = i / 6; pts.push(P((u - .5) * L * .55 - L * .1, L * (.22 + (i % 2 ? .05 : -.02)) + Math.sin(fl + u * 4 + 1) * L * .04, L * .01)); } c.fillStyle = 'rgba(230,222,205,.85)'; this.poly(c, pts); c.fill();
      } else if (kind === 'cargo') {
        const l = L, w = L * .4, hh = L * .4, z0 = -hh * sub, z1 = hh * (1 - sub), cols = ['#b8452f', '#2f6f8f', '#c99a2e', '#3f7f5a'], col = cols[Math.floor(o.seed) % cols.length];
        this.prism(c, P, this.rect(l, w), z0, z1, col, shade(col, 1.12), { wet }); c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = Math.max(.4, L * .012); for (let i = 1; i < 10; i++) { c.beginPath(); c.moveTo(...P(-l / 2 + i * l / 10, -w / 2, z1)); c.lineTo(...P(-l / 2 + i * l / 10, w / 2, z1)); c.stroke(); }
        c.strokeStyle = 'rgba(122,62,28,.5)'; c.lineWidth = L * .02; for (let i = 0; i < 4; i++) { const xx = (fr(o.seed * (i + 1) * .37) - .5) * l * .9; c.beginPath(); c.moveTo(...P(xx, -w / 2, z1)); c.lineTo(...P(xx + L * .02, -w / 2, z1 * .2)); c.stroke(); } snowTop(this.rect(l, w), z1);
      } else if (kind === 'dinghy') {
        const w = L * .42, hh = L * .2; for (let i = 0; i < 4; i++) { const k = i / 3; c.fillStyle = ['#4a5560', '#5b6873', '#6c7a85', '#dfe6ea'][i]; this.poly(c, HULL.map(([a, b]) => P(a * L, b * w * .5 * (1 + k * .08), -hh * .3 + hh * k))); c.fill(); }
        c.fillStyle = '#b7c2c8'; this.poly(c, HULL.map(([a, b]) => P(a * L * .86, b * w * .42, hh * .5))); c.fill(); c.strokeStyle = '#7a5a3a'; c.lineWidth = L * .03; c.beginPath(); c.moveTo(...P(-L * .1, -w * .5, hh * .6)); c.lineTo(...P(L * .3, w * .4, hh * .6)); c.stroke();
      } else if (kind === 'lantern') {
        const q = P(0, 0, L * .5), R = L * .4; c.fillStyle = '#f7c56b'; c.beginPath(); c.ellipse(q[0], q[1], R, R * 1.2, 0, 0, TAU); c.fill(); c.fillStyle = '#c4503a'; c.fillRect(q[0] - R * .6, q[1] - R * 1.25, R * 1.2, R * .25); c.fillStyle = 'rgba(255,240,200,.9)'; c.beginPath(); c.arc(q[0], q[1] + R * .2, R * .35, 0, TAU); c.fill();
      } else if (kind === 'bottle') {
        const q = P(0, 0, L * .1); c.fillStyle = '#6fbf9a'; c.beginPath(); c.ellipse(q[0], q[1], L * .5, L * .2, o.hd, 0, TAU); c.fill();
      }
      c.restore();
    }

    // ── Wreck and seabed renderers (drawn in the underwater pass) ────────────
    underAlpha(o, env, night) {
      const C = 6.5 * (o.hab === 'reef' ? 1.35 : o.hab === 'coast' ? 1 : 1.15) * (o.zone === 'trop' ? 1.2 : o.cold ? .8 : 1) * (1 - env.cloud / 100 * .3) * (1 - env.rain * .35) * (1 - env.storm * .65) * (1 - env.chop * .2);
      let a = Math.exp(-o.dep / C) * (1 - night * .75) * (1 - env.fog * .5); if (o.near) a = Math.max(a, .12 + .05 * Math.sin(this.h.t * 2)); return clamp(a, 0, 1);
    }
    drawUnder(c, x0, y0, x1, y1, z, t, night) {
      const H = this.h, env = H.env, E = H.E, sb = H.sbNow || 1; if (!env || z < .12) return;
      for (const o of this.active) {
        if (o.cat === 'float' || o.ok === false || o.gone) continue; const S = o.d.size * sb * 1.1; if (o.x + S < x0 || o.x - S > x1 || o.y + S < y0 || o.y - S > y1) continue;
        const a = this.underAlpha(o, env, night); if (a < .02) continue; o.vis = a;
        const water = night > .5 ? '#071f33' : '#11586b', dk = clamp(o.dep / 14, 0, .85), sx = -E.x * o.dep * 1.6, sy = -E.y * o.dep * 1.6; // refraction offset
        c.save(); c.globalAlpha = a; this.drawSeabed(c, o, o.x + sx, o.y + sy, sb, t, water, dk, night); c.restore();
      }
    }
    drawSeabed(c, o, x, y, s, t, water, dk, night, preview) {
      const d = o.d, L = d.size * s, h = o.hd != null ? o.hd : o.h, cs = Math.cos(h), sn = Math.sin(h), kind = o.kind, R = rngOf(Math.floor(o.seed * 1000) + 3);
      const T = (lx, ly) => [x + lx * cs - ly * sn, y + lx * sn + ly * cs], col = hx => mix(hx, water, dk), wob = preview ? 0 : .6;
      const wv = (p) => [p[0] + Math.sin(p[1] * .07 + t * 1.6) * wob, p[1] + Math.cos(p[0] * .06 - t * 1.4) * wob]; // water distortion
      const pg = (pts, fill) => { c.fillStyle = fill; c.beginPath(); pts.forEach((p, i) => { const q = wv(T(p[0], p[1])); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath(); c.fill(); };
      const line = (pts, stroke, w) => { c.strokeStyle = stroke; c.lineWidth = w; c.beginPath(); pts.forEach((p, i) => { const q = wv(T(p[0], p[1])); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke(); };
      const blob = (lx, ly, r, fill) => { const q = wv(T(lx, ly)); c.fillStyle = fill; c.beginPath(); c.arc(q[0], q[1], r, 0, TAU); c.fill(); };
      const a0 = c.globalAlpha; c.lineCap = 'round'; c.lineJoin = 'round';
      // sediment patch
      if (o.dep < 10) { const q = wv(T(0, 0)); c.fillStyle = col('#d8c08a'); for (const [k, al] of [[1, .1], [.72, .1], [.45, .08]]) { c.globalAlpha = a0 * al; c.beginPath(); c.ellipse(q[0], q[1], L * .66 * k, L * .42 * k, h + .3, 0, TAU); c.fill(); } c.globalAlpha = a0; }
      if (d.cat === 'wreck') {
        const w = L * (kind === 'w_sub' ? .16 : kind === 'w_cargo' ? .18 : kind === 'w_viking' ? .22 : .32), hull = HULL.map(([a, b]) => [a * L, b * w]);
        if (kind === 'w_sub') { pg([[L * .5, 0], [L * .38, w], [-L * .4, w], [-L * .5, 0], [-L * .4, -w], [L * .38, -w]], col('#3d4a52')); pg([[L * .12, w * .5], [L * .12, -w * .5], [-L * .06, -w * .5], [-L * .06, w * .5]], col('#56656e')); }
        else if (kind === 'w_cargo') { pg([[L * .5, 0], [L * .44, w], [-L * .5, w], [-L * .5, -w], [L * .44, -w]], col('#5b3a30')); for (let i = 0; i < 9; i++) { const lx = -L * .4 + i * L * .09; pg([[lx, -w * .8], [lx + L * .07, -w * .8], [lx + L * .07, w * .8], [lx, w * .8]], col(['#b8452f', '#2f6f8f', '#c99a2e'][i % 3])); } for (let i = 0; i < 6; i++)pg([[0, 0], [L * .07, 0], [L * .07, L * .025], [0, L * .025]].map(([a, b]) => [a + (R() - .5) * L * .9, b + (R() < .5 ? -1 : 1) * (w + R() * L * .2)]), col(['#b8452f', '#2f6f8f', '#c99a2e'][i % 3])); }
        else {
          pg(hull, col(kind === 'w_yacht' ? '#e6e9ea' : '#4a3424'));
          if (kind !== 'w_yacht') { // exposed ribs where planks are missing
            const gap = R() * .5 - .25; pg(hull.map(([a, b]) => [a * .86, b * .78]), col('#2f2117'));
            for (let i = -4; i <= 4; i++) { const lx = i / 4 * L * .4; if (Math.abs(lx / L - gap) < .08) continue; line([[lx, -w * .85], [lx, w * .85]], col('#6b4a2e'), Math.max(.5, L * .018)); }
            line([[-L * .48, 0], [L * .5, 0]], col('#5a3d26'), Math.max(.6, L * .025));
          } else { pg(hull.map(([a, b]) => [a * .6 - L * .05, b * .55]), col('#c9d1d4')); }
          if (kind === 'w_viking') { for (let i = 0; i < 5; i++)line([[-L * .45, -w * (.9 - i * .18)], [L * .45, -w * (.9 - i * .18)]], col('#7a5a36'), Math.max(.4, L * .01)); }
          if (kind === 'w_pirate') for (let i = 0; i < 6; i++) { const lx = (R() - .5) * L * .9, ly = (R() < .5 ? -1 : 1) * (w + R() * L * .25); line([[lx, ly], [lx + L * .07, ly + L * .02]], col('#3b3f3a'), L * .028); }
          if (kind === 'w_merchant') for (let i = 0; i < 10; i++) { const lx = (R() - .5) * L * .7, ly = (R() - .5) * w * 1.4; blob(lx, ly, L * .02, col('#b7703e')); }
          if (kind === 'w_giant') { for (let i = 0; i < 7; i++)line([[-L * .4 + i * L * .13, -w], [-L * .38 + i * L * .13, w]], col('#1d2a33'), L * .012); }
          // fallen mast
          line([[-L * .1, 0], [L * .2 + R() * L * .2, w * (1.6 + R())]], col('#5c3d24'), Math.max(.6, L * .03));
        }
        // scattered debris, algae and coral
        for (let i = 0; i < 6; i++) { const lx = (R() - .5) * L * 1.2, ly = (R() - .5) * L * .8; pg([[0, 0], [L * .08, 0], [L * .08, L * .02], [0, L * .02]].map(([a, b]) => [a + lx, b + ly]), col('#5a3d26')); }
        if (o.hab !== 'deep') for (let i = 0; i < 12; i++) { const a = R() * TAU, m = .3 + R() * .6; blob(Math.cos(a) * L * .45 * m, Math.sin(a) * w * 1.1 * m, L * (.012 + R() * .02), col(['#3f7f4a', '#c76b4f', '#d9a05b', '#e98aa0'][i % 4])); }
        if (d.glow && !preview) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = a0 * (.25 + .15 * Math.sin(t * 1.3)) * (.4 + night * .6); for (let i = 0; i < 6; i++) blob(-L * .35 + i * L * .14, Math.sin(i * 2.1) * w * .5, L * .025, '#7ff0ff'); c.globalCompositeOperation = 'source-over'; c.globalAlpha = a0; }
      } else {
        const iron = col('#4d4a45'), bronze = col('#5f7a5c'), clay = col('#b06a3d');
        if (kind === 'u_anchor') { line([[0, -L * .45], [0, L * .35]], iron, L * .07); line([[-L * .3, L * .2], [0, L * .42], [L * .3, L * .2]], iron, L * .07); line([[-L * .18, -L * .3], [L * .18, -L * .3]], iron, L * .06); }
        else if (kind === 'u_chain') { for (let i = 0; i < 8; i++) { const q = wv(T(-L * .5 + i * L * .13, Math.sin(i * .9 + o.seed) * L * .08)); c.strokeStyle = col('#7a4a2a'); c.lineWidth = L * .025; c.beginPath(); c.ellipse(q[0], q[1], L * .07, L * .04, h + (i % 2 ? 1.5 : 0), 0, TAU); c.stroke(); } }
        else if (kind === 'u_cannon') { pg([[L * .5, -L * .07], [L * .5, L * .07], [-L * .35, L * .12], [-L * .45, 0], [-L * .35, -L * .12]], bronze); blob(-L * .48, 0, L * .07, bronze); }
        else if (kind === 'u_prop') { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + o.seed; pg([[0, 0], [Math.cos(a - .3) * L * .45, Math.sin(a - .3) * L * .45], [Math.cos(a + .2) * L * .5, Math.sin(a + .2) * L * .5]], col('#9a7a3a')); } blob(0, 0, L * .1, col('#7a6230')); }
        else if (kind === 'u_wheel') { const q = wv(T(0, 0)); c.strokeStyle = col('#6b4a2e'); c.lineWidth = L * .06; c.beginPath(); c.arc(q[0], q[1], L * .32, 0, TAU); c.stroke(); for (let i = 0; i < 6; i++) { if (i === 2 || i === 4) continue; const a = i / 6 * TAU; line([[0, 0], [Math.cos(a) * L * .48, Math.sin(a) * L * .48]], col('#6b4a2e'), L * .045); } }
        else if (kind === 'u_pots' || kind === 'u_amphora') { for (let i = 0; i < (kind === 'u_pots' ? 5 : 3); i++) { const lx = (R() - .5) * L, ly = (R() - .5) * L * .6, r = L * (kind === 'u_pots' ? .14 : .1); blob(lx, ly, r, clay); if (kind === 'u_amphora') line([[lx, ly], [lx + L * .25, ly + L * .05]], clay, r * .8); } }
        else if (kind === 'u_chest') { pg([[-L * .4, -L * .25], [L * .4, -L * .25], [L * .4, L * .25], [-L * .4, L * .25]], col('#6e4521')); line([[-L * .4, 0], [L * .4, 0]], col('#d6a843'), L * .05); if (!preview) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = a0 * (.3 + .3 * Math.sin(t * 3)); blob(L * .1, 0, L * .12, '#ffd86b'); c.globalCompositeOperation = 'source-over'; c.globalAlpha = a0; } }
        else if (kind === 'u_statue') { blob(0, -L * .32, L * .12, col('#9aa3a0')); pg([[-L * .15, -L * .2], [L * .15, -L * .2], [L * .2, L * .4], [-L * .2, L * .4]], col('#8c9592')); for (let i = 0; i < 6; i++)blob((R() - .5) * L * .4, (R() - .5) * L * .8, L * .05, col(['#e98aa0', '#d9a05b', '#c76b4f'][i % 3])); }
        else if (kind === 'u_plane') { pg([[L * .5, 0], [L * .4, L * .05], [-L * .45, L * .03], [-L * .5, 0], [-L * .45, -L * .03], [L * .4, -L * .05]], col('#8b9298')); pg([[L * .12, 0], [L * .02, L * .5], [-L * .06, L * .5], [-L * .02, 0], [-L * .06, -L * .5], [L * .02, -L * .5]], col('#9aa1a6')); pg([[-L * .38, 0], [-L * .44, L * .14], [-L * .48, L * .14], [-L * .46, 0], [-L * .48, -L * .14], [-L * .44, -L * .14]], col('#9aa1a6')); }
        else if (kind === 'u_nav') { const q = wv(T(0, 0)); c.strokeStyle = col('#b08a3c'); c.lineWidth = L * .07; c.beginPath(); c.arc(q[0], q[1], L * .3, Math.PI * .1, Math.PI * .9); c.stroke(); line([[0, 0], [L * .25, L * .3]], col('#b08a3c'), L * .05); blob(L * .25, -L * .15, L * .12, col('#8a6a2c')); }
        else if (kind === 'u_ruins') { for (let i = 0; i < 6; i++) { const lx = -L * .4 + (i % 3) * L * .4, ly = (i < 3 ? -1 : 1) * L * .25; blob(lx, ly, L * .06, col('#c9c0a8')); } pg([[-L * .45, -L * .1], [L * .45, -L * .1], [L * .45, L * .1], [-L * .45, L * .1]], col('#b7ae96')); line([[-L * .2, -L * .4], [L * .25, -L * .38]], col('#b7ae96'), L * .05); }
      }
      c.globalAlpha = a0;
    }
    // Parts of shallow wrecks that break the surface (masts, prows, a listing hull).
    drawAbove(c, o, t, s, E, alpha) {
      const d = o.d, L = d.size * s, cs = Math.cos(o.h), sn = Math.sin(o.h), at = (lx, ly) => [o.x + lx * cs - ly * sn, o.y + lx * sn + ly * cs];
      const foam = (x, y, r) => { c.globalAlpha = alpha * .7; c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(.6, r * .25); const k = .8 + .2 * Math.sin(t * 2 + o.seed); c.beginPath(); c.ellipse(x, y, r * 1.6 * k, r * 1.2 * k, 0, 0, TAU); c.stroke(); c.globalAlpha = alpha; };
      c.save(); c.globalAlpha = alpha; c.lineCap = 'round';
      if (d.mast) for (let i = 0; i < d.mast; i++) { const [bx, by] = at(-L * .1 + i * L * .25, L * .05), hgt = L * (.35 - i * .08), lean = .5 + i * .2, tx = bx + E.x * hgt + Math.cos(o.h + lean) * hgt * .3, ty = by + E.y * hgt + Math.sin(o.h + lean) * hgt * .3; c.strokeStyle = '#4a3020'; c.lineWidth = Math.max(1, L * .03); c.beginPath(); c.moveTo(bx, by); c.lineTo(tx, ty); c.stroke(); c.strokeStyle = 'rgba(230,222,205,.75)'; c.lineWidth = Math.max(.8, L * .02); c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + Math.cos(t * 3 + i) * L * .06, ty + L * .08); c.stroke(); foam(bx, by, L * .03); }
      if (d.prow) { const [bx, by] = at(L * .46, 0), hgt = L * .16; c.strokeStyle = '#5c3a20'; c.lineWidth = L * .04; c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + E.x * hgt + cs * L * .05, by + E.y * hgt + sn * L * .05, bx + E.x * hgt * 1.2 - cs * L * .02, by + E.y * hgt * 1.2 - sn * L * .02); c.stroke(); foam(bx, by, L * .03); }
      if (d.listing) { const P = this.proj(o.x, o.y, o.h, { bob: 0, sp: 0, sr: .35 }, E), w = L * .3; c.fillStyle = '#e6e9ea'; this.poly(c, HULL.map(([a, b]) => P(a * L, b * w, L * .06))); c.fill(); c.fillStyle = '#c9d1d4'; this.poly(c, HULL.map(([a, b]) => P(a * L * .6 - L * .05, b * w * .55, L * .12))); c.fill(); c.strokeStyle = '#5e6b72'; c.lineWidth = L * .015; c.beginPath(); c.moveTo(...P(0, 0, L * .12)); c.lineTo(...P(0, 0, L * .5)); c.stroke(); foam(o.x, o.y, L * .25); }
      c.restore();
    }

    // ── Surface pass ─────────────────────────────────────────────────────────
    drawSurface(c, x0, y0, x1, y1, z, t, night) {
      const H = this.h, env = H.env, E = H.E, sb = H.sbNow || 1; if (!env || z < .12) return;
      const me = H.boatsById.me, fogR = H.visR ? H.visR() : 1e9;
      for (const o of this.active) {
        if (o.ok === false || o.gone) continue; const S = o.d.size * sb * 1.4; if (o.x + S < x0 || o.x - S > x1 || o.y + S < y0 || o.y - S > y1) continue;
        let a = 1; if (env.fog > .02) { const dd = Math.hypot(o.x - me.x, o.y - me.y); a = 1 - env.fog * clamp((dd - fogR * .4) / fogR, 0, .95); }
        if (o.cat === 'float') { const px = o.d.size * sb * z; if (px < 3) { c.globalAlpha = a * .8; c.fillStyle = '#d9c6a4'; c.beginPath(); c.arc(o.x, o.y, 1.2 / z, 0, TAU); c.fill(); c.globalAlpha = 1; } else this.drawFloat(c, o, o.x, o.y, sb, t, a, E, env); }
        else if (o.cat === 'wreck' && (o.d.mast || o.d.prow || o.d.listing) && o.dep < 4) this.drawAbove(c, o, t, sb, E, a * (o.d.listing ? 1 : clamp(1.3 - o.dep / 4, .3, 1)));
        if (o.near && !o.found) { const k = (t * .8 + o.seed) % 1, R = (o.d.size * .7 + 10) * sb, col = RAR[o.d.rar].col; c.save(); c.globalAlpha = (1 - k) * .55 * a; c.strokeStyle = col; c.lineWidth = 1.4 / z; c.beginPath(); c.ellipse(o.x, o.y, R * (.8 + k * .5), R * (.65 + k * .4), 0, 0, TAU); c.stroke(); c.restore(); }
      }
      // marked locations
      const [OX, OY] = H.globalOff(); for (const p of this.journal.pins) { const x = p.gx - OX, y = p.gy - OY; if (x < x0 || x > x1 || y < y0 || y > y1) continue; const hgt = 18 * sb, tx = x + E.x * hgt, ty = y + E.y * hgt; c.save(); c.strokeStyle = '#2b2f36'; c.lineWidth = 1.2 * sb; c.beginPath(); c.moveTo(x, y); c.lineTo(tx, ty); c.stroke(); c.fillStyle = '#ff7a59'; c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + 9 * sb, ty + 3 * sb + Math.sin(t * 4) * sb); c.lineTo(tx - E.x * 6 * sb, ty - E.y * 6 * sb); c.closePath(); c.fill(); c.globalAlpha = .5; c.strokeStyle = '#ffffff'; c.beginPath(); c.ellipse(x, y, 5 * sb, 3.5 * sb, 0, 0, TAU); c.stroke(); c.restore(); }
    }
    drawGlow(c, night) { // additive, after the night tint
      const H = this.h; if (!H.glow) return; for (const o of this.active) { if (o.gone || o.ok === false || !o.onScreen) continue; const sb = H.sbNow || 1;
        if (o.kind === 'lantern') { const fl = .85 + .15 * Math.sin(H.t * 6 + o.seed), R = 30 * sb; c.globalAlpha = Math.min(1, .35 + night) * fl; c.drawImage(H.glow, o.x - R, o.y - R, R * 2, R * 2); }
        else if (o.kind === 'chest' || o.kind === 'u_chest') { const R = 14 * sb; c.globalAlpha = .4 * night; c.drawImage(H.glow, o.x - R, o.y - R, R * 2, R * 2); }
        else if (o.kind === 'w_giant' && o.near) { const R = 120 * sb; c.globalAlpha = .18 * night; c.drawImage(H.bio || H.glow, o.x - R, o.y - R, R * 2, R * 2); } }
    }
    drawHud(c, t) { // screen space: a small hint above nearby undiscovered objects
      const H = this.h; c.save(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '500 11px Geist, sans-serif';
      for (const o of this.active) { if (!o.near || o.found || o.gone || o.ok === false || !o.onScreen) continue; if (o.cat !== 'float' && (o.vis || 0) < .05) continue; const lbl = o.cat === 'float' ? 'Something floating' : o.cat === 'wreck' ? 'A wreck below' : 'Something on the seabed', y = o.sy - 26 - Math.sin(t * 2.4 + o.seed) * 2, w = c.measureText(lbl).width + 26;
        c.globalAlpha = .9; c.fillStyle = 'rgba(10,27,36,.78)'; c.beginPath(); c.roundRect(o.sx - w / 2, y - 10, w, 20, 10); c.fill(); c.fillStyle = RAR[o.d.rar].col; c.fillText('✦', o.sx - w / 2 + 10, y + .5); c.fillStyle = '#f4efe6'; c.fillText(lbl, o.sx + 6, y + .5); }
      c.restore();
    }
    hit(sx, sy) { let best = null, bd = 1e9; for (const o of this.active) { if (o.gone || o.ok === false || !o.onScreen) continue; if (o.cat !== 'float' && (o.vis || 0) < .05 && !o.near) continue; const r = Math.max(26, o.d.size * (this.h.sbNow || 1) * this.h.cam.z * .55); let d = Math.hypot(o.sx - sx, o.sy - sy); if (o.near && !o.found) d = Math.min(d, Math.hypot(o.sx - sx, o.sy - 26 - sy)); if (d < r && d < bd) { bd = d; best = o; } } return best; }

    // ── Interactions ─────────────────────────────────────────────────────────
    open(o) { const H = this.h; if (!o.near) { H.toast(`Sail closer to reach the ${o.d.name.toLowerCase()}.`); H.setDest(o.x, o.y); return; } H.sfx('pop'); H.setState({ oinsp: { id: o.id, kind: o.kind, mode: 'world', gx: o.gx, gy: o.gy, x: o.x, y: o.y, result: null, busy: false }, sel: null, meOpen: false, fleetOpen: false }); this.prevT = H.t; }
    async act() {
      const H = this.h, s = H.state.oinsp; if (!s || s.busy) return; const d = K[s.kind]; if (this.journal.finds[s.id]) { H.setState({ oinsp: { ...s, result: { status: 'already', reward: this.journal.finds[s.id].reward } } }); return; }
      H.setState({ oinsp: { ...s, busy: true } }); const region = H.regionName(s.x, s.y); let r = null;
      if (H.isReal() && H.A.claimFind) { try { r = await H.A.claimFind(s.id, s.kind, region); } catch (e) { r = { status: 'error' }; } }
      else { const uid = (H.state.auth.user || {}).id || 'guest', ex = d.excl && this.taken[s.id]; r = ex ? { status: 'taken' } : { status: 'new', reward: pickReward(d.pool, s.id + uid) }; }
      if (!r || r.status === 'error') { H.setState({ oinsp: { ...s, busy: false, err: "Couldn't reach the server. Try again." } }); return; }
      if (r.status === 'taken') { this.taken[s.id] = 1; H.setState({ oinsp: { ...s, busy: false, result: r } }); return; }
      this.journal.finds[s.id] = { kind: s.kind, rar: d.rar, region, reward: r.reward || null, at: Date.now(), gx: s.gx, gy: s.gy }; this.saveLocal(); this.refreshCosmetics();
      const rk = RAR[d.rar].rank; H.sfx(rk >= 2 ? 'chime' : 'cork'); H.vib(rk >= 2 ? [30, 60, 30] : 20); if (d.cat === 'float' && H.splash) H.splash(s.x, s.y, .6);
      H.setState({ oinsp: { ...s, busy: false, result: { status: r.status === 'already' ? 'already' : 'new', reward: r.reward } } });
    }
    togglePin() { const H = this.h, s = H.state.oinsp; if (!s) return; const i = this.journal.pins.findIndex(p => p.id === s.id); if (i >= 0) this.journal.pins.splice(i, 1); else this.journal.pins.push({ id: s.id, kind: s.kind, gx: s.gx, gy: s.gy, name: K[s.kind].name, at: Date.now() }); this.saveLocal(); H.setState({ pins: this.journal.pins.slice(), oinsp: { ...s } }); H.toast(i >= 0 ? 'Mark removed.' : 'Location marked. Find it in your Ocean Journal.'); }
    sailTo(p) { const H = this.h, [OX, OY] = H.globalOff(); H.setState({ journalOpen: false, oinsp: null }); H.setDest(p.gx - OX, p.gy - OY, p.name); }
    recordBottle(msg) { if (!msg || !msg.id) return; const id = 'bottle:' + msg.id; if (this.journal.finds[id]) return; const H = this.h, me = H.boatsById.me, [OX, OY] = H.globalOff(); this.journal.finds[id] = { kind: 'bottle', rar: 'Uncommon', region: H.regionName(me.x, me.y), reward: null, at: Date.now(), gx: me.x + OX, gy: me.y + OY, note: msg.body }; this.saveLocal(); if (H.isReal() && H.A.claimFind) H.A.claimFind(id, 'bottle', this.journal.finds[id].region).catch(() => { }); }

    // ── 3D preview (inspect panel) and journal thumbnails ────────────────────
    drawPreview(cv, kind, t, size) {
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), W = size || Math.round(r.width * dpr), Hh = size || Math.round(r.height * dpr); if (!W || !Hh) return;
      if (cv.width !== W || cv.height !== Hh) { cv.width = W; cv.height = Hh; } const c = cv.getContext('2d'), d = K[kind]; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, Hh);
      const fit = d.cat === 'float' ? d.size * 2.5 : d.size * 1.35, sc = Math.min(W, Hh * 1.4) / fit, E = { x: 0, y: -.72 };
      c.setTransform(sc, 0, 0, sc, W / 2, Hh * (d.cat === 'float' ? .62 : .5)); const spin = t * .5, o = { kind, d, seed: 3.7, h: spin, hd: spin, st: { bob: Math.sin(t * 1.4) * d.size * .03, sp: Math.sin(t * 1.1) * .06, sr: Math.sin(t * .9) * .08, spin: t * .6 }, hab: 'reef', dep: 2 };
      if (d.cat === 'float') { c.fillStyle = 'rgba(29,107,134,.85)'; c.beginPath(); c.ellipse(0, 0, d.size * .75, d.size * .26, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(143,240,224,.55)'; c.lineWidth = d.size * .012; c.stroke(); this.drawFloat(c, o, 0, 0, 1, t, 1, E, null, true); }
      else { c.save(); c.scale(1, .55); c.fillStyle = 'rgba(17,88,107,.9)'; c.beginPath(); c.arc(0, 0, d.size * .62, 0, TAU); c.fill(); c.restore(); c.save(); c.scale(1, .55); this.drawSeabed(c, o, 0, 0, 1, t, '#11586b', .05, 0, true); c.restore(); if (d.mast || d.prow || d.listing) { o.x = 0; o.y = 0; this.drawAbove(c, o, t, 1, E, 1); } }
    }
    thumb(kind, locked) { const k = kind + (locked ? ':l' : ''); if (this.thumbs[k]) return this.thumbs[k]; const cv = document.createElement('canvas'); cv.width = cv.height = 120; try { this.drawPreview(cv, kind, 1.2, 120); if (locked) { const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(12,30,40,.92)'; c.fillRect(0, 0, 120, 120); } this.thumbs[k] = cv.toDataURL(); } catch (e) { this.thumbs[k] = ''; } return this.thumbs[k]; }

    // ── Template values ──────────────────────────────────────────────────────
    vals() {
      const H = this.h, s = H.state, ins = s.oinsp, out = { showOInsp: false, showJournal: !!s.journalOpen && !s.chat && !s.inbox, oRef: H.oRef, openJournal: () => H.setState({ journalOpen: true, fleetOpen: false, meOpen: false, sel: null, inbox: false, chat: null }), closeJournal: () => H.setState({ journalOpen: false }) };
      if (ins) {
        const d = K[ins.kind], f = this.journal.finds[ins.id], res = ins.result, rw = res && res.reward ? REWARDS[res.reward] : null, pinned = this.journal.pins.some(p => p.id === ins.id), rar = RAR[d.rar];
        Object.assign(out, { showOInsp: true, oName: d.name, oRar: d.rar, oRarCol: rar.col, oRarBg: 'rgba(' + hexRgb(rar.col) + ',.14)', oDesc: d.desc, oCat: { float: 'Floating', wreck: 'Shipwreck', under: 'Underwater' }[d.cat] + (ins.mode === 'journal' && f ? ' · found ' + new Date(f.at).toLocaleDateString() : ''), oRegion: f ? f.region : H.regionName(ins.x, ins.y),
          oCanAct: ins.mode === 'world' && !res && !f, oActLabel: ins.busy ? 'Working…' : d.act, oAct: () => this.act(), oDone: !!res || !!f, oErr: ins.err || '',
          oResultTitle: res ? (res.status === 'taken' ? 'Someone got here first.' : res.status === 'already' ? 'Already in your journal.' : rw ? 'You found: ' + rw.name : 'Saved to your Ocean Journal.') : f ? (f.reward && REWARDS[f.reward] ? 'You found: ' + REWARDS[f.reward].name : 'In your Ocean Journal.') : '',
          oResultSub: res && res.status === 'taken' ? 'This one could only be claimed once. Keep sailing — the sea has more.' : (rw || (f && f.reward && REWARDS[f.reward])) ? (REWARDS[(res && res.reward) || f.reward].type + (/^(flag|sail):/.test((res && res.reward) || f.reward) ? ' · equip it in Edit boat' : ' · added to your collection')) : f && f.note ? '“' + f.note + '”' : 'Logged in your Ocean Journal.',
          oPinLabel: pinned ? 'Unmark location' : 'Mark location', oPin: () => this.togglePin(), oClose: () => H.setState({ oinsp: null }), oJournal: () => H.setState({ oinsp: null, journalOpen: true }), oInWorld: ins.mode === 'world', oInJournal: ins.mode === 'journal', hasOErr: !!ins.err, oShowJournal: ins.mode === 'world' && (!!res || !!f) });
      }
      if (out.showJournal) {
        const finds = Object.entries(this.journal.finds), byKind = {}; for (const [id, f] of finds) { (byKind[f.kind] = byKind[f.kind] || []).push({ id, ...f }); }
        const kinds = Object.keys(K), foundKinds = kinds.filter(k => byKind[k]), rewards = {}; for (const [, f] of finds) if (f.reward) rewards[f.reward] = (rewards[f.reward] || 0) + 1;
        out.jStats = [{ n: String(foundKinds.length) + '/' + kinds.length, l: 'Kinds found' }, { n: String(finds.filter(([, f]) => K[f.kind] && K[f.kind].cat === 'wreck').length), l: 'Wrecks explored' }, { n: String(finds.filter(([, f]) => K[f.kind] && RAR[K[f.kind].rar].rank >= 2).length), l: 'Rare finds' }];
        out.jSections = CATS.map(([cat, label]) => ({ label, count: kinds.filter(k => K[k].cat === cat && byKind[k]).length + ' of ' + kinds.filter(k => K[k].cat === cat).length, tiles: kinds.filter(k => K[k].cat === cat).map(k => { const l = byKind[k], got = !!l, last = got ? l.sort((a, b) => b.at - a.at)[0] : null, rc = RAR[K[k].rar].col; return { name: got ? K[k].name : '???', sub: got ? (l.length > 1 ? l.length + ' found · ' : '') + (last.region || '') : K[k].rar, img: this.thumb(k, !got), rar: K[k].rar, rarCol: rc, border: got ? 'rgba(' + hexRgb(rc) + ',.45)' : 'rgba(255,255,255,.08)', op: got ? 1 : .7, open: () => { if (!got) return; H.setState({ oinsp: { id: last.id, kind: k, mode: 'journal', gx: last.gx, gy: last.gy, x: 0, y: 0, result: null } }); } }; }) }));
        out.jRewards = Object.entries(rewards).map(([k, n]) => ({ name: (REWARDS[k] || { name: k }).name + (n > 1 ? ' ×' + n : ''), type: (REWARDS[k] || {}).type || '', dot: (REWARDS[k] && REWARDS[k].col) || '#e9cf9a' })); out.jHasRewards = out.jRewards.length > 0;
        out.jPins = this.journal.pins.map(p => ({ name: p.name, sub: 'Marked ' + new Date(p.at).toLocaleDateString(), go: () => this.sailTo(p), remove: () => { this.journal.pins = this.journal.pins.filter(x => x !== p); this.saveLocal(); H.setState({ pins: this.journal.pins.slice() }); } })); out.jHasPins = out.jPins.length > 0;
      }
      return out;
    }
  }
  window.SailoOcean = Ocean;
})();
