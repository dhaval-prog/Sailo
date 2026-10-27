// Sailo · voyage systems
// Ports and passport stamps, daily quests, materials and the shipwright, weather that changes
// sailing speed, seasonal events, fishing, flotillas, notes left at sea, leaderboards, the emote
// wheel, lighthouses, sky effects, the first-voyage guide, return gifts, reminders, graphics
// quality and error reporting. The host (Living Ocean.dc.html) calls into this through window.SailoVoyage.
(function () {
  const TAU = Math.PI * 2, WM = 8015000;
  const ll2w = (lon, lat) => { const s = Math.sin(Math.max(-85, Math.min(85, lat)) * Math.PI / 180); return [(lon + 180) / 360 * WM, (.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * WM]; };
  const w2ll = (gx, gy) => [gx / WM * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * gy / WM))) * 180 / Math.PI];
  const hash = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; };
  const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const pad = n => String(n).padStart(2, '0');
  const dayKey = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const weekKey = () => { const d = new Date(); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const km = u => u * 5 / 1000; // one world unit is five metres
  const fmtKm = v => v >= 100 ? Math.round(v).toLocaleString() + ' km' : v >= 10 ? v.toFixed(0) + ' km' : v.toFixed(1) + ' km';
  const ang = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ago = ts => { const s = (Date.now() - ts) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago'; return Math.round(s / 86400) + ' d ago'; };

  // ── Ports: real harbour cities [name, region, lon, lat] ──────────────────
  const REGIONS = { as: 'Asia', me: 'Middle East', eu: 'Europe', af: 'Africa', na: 'North America', ca: 'Caribbean & Central America', sa: 'South America', oc: 'Oceania' };
  const PORT_LIST = [
    ['Mumbai', 'as', 72.84, 18.94], ['Kochi', 'as', 76.24, 9.97], ['Chennai', 'as', 80.30, 13.10], ['Kolkata', 'as', 88.31, 22.54], ['Visakhapatnam', 'as', 83.30, 17.69], ['Mormugao', 'as', 73.80, 15.41], ['Mangaluru', 'as', 74.81, 12.92], ['Kandla', 'as', 70.22, 23.03], ['Paradip', 'as', 86.68, 20.26], ['Thoothukudi', 'as', 78.19, 8.76], ['Port Blair', 'as', 92.74, 11.67], ['Puducherry', 'as', 79.84, 11.93], ['Kozhikode', 'as', 75.77, 11.25], ['Hazira', 'as', 72.63, 21.08], ['Okha', 'as', 69.08, 22.47], ['Kakinada', 'as', 82.28, 16.98],
    ['Colombo', 'as', 79.85, 6.95], ['Malé', 'as', 73.51, 4.18], ['Chattogram', 'as', 91.80, 22.31], ['Karachi', 'as', 66.98, 24.84], ['Yangon', 'as', 96.17, 16.77],
    ['Singapore', 'as', 103.83, 1.26], ['Port Klang', 'as', 101.39, 3.00], ['Penang', 'as', 100.34, 5.42], ['Laem Chabang', 'as', 100.88, 13.08], ['Phuket', 'as', 98.40, 7.88], ['Ho Chi Minh City', 'as', 106.76, 10.77], ['Da Nang', 'as', 108.22, 16.07], ['Haiphong', 'as', 106.68, 20.86], ['Manila', 'as', 120.96, 14.59], ['Cebu', 'as', 123.90, 10.30], ['Jakarta', 'as', 106.88, -6.10], ['Surabaya', 'as', 112.73, -7.20], ['Benoa', 'as', 115.21, -8.75],
    ['Hong Kong', 'as', 114.17, 22.29], ['Shanghai', 'as', 121.50, 31.23], ['Shenzhen', 'as', 113.90, 22.48], ['Qingdao', 'as', 120.32, 36.07], ['Tianjin', 'as', 117.79, 38.98], ['Busan', 'as', 129.04, 35.10], ['Incheon', 'as', 126.60, 37.46], ['Tokyo', 'as', 139.77, 35.62], ['Yokohama', 'as', 139.64, 35.45], ['Osaka', 'as', 135.43, 34.65], ['Kobe', 'as', 135.19, 34.68], ['Nagasaki', 'as', 129.87, 32.74], ['Keelung', 'as', 121.74, 25.13], ['Kaohsiung', 'as', 120.28, 22.61], ['Vladivostok', 'as', 131.89, 43.11],
    ['Muscat', 'me', 58.57, 23.62], ['Dubai', 'me', 55.27, 25.27], ['Doha', 'me', 51.53, 25.29], ['Jeddah', 'me', 39.17, 21.48], ['Aden', 'me', 44.99, 12.79], ['Haifa', 'me', 35.00, 32.82], ['Limassol', 'me', 33.04, 34.67],
    ['Sydney', 'oc', 151.21, -33.86], ['Melbourne', 'oc', 144.93, -37.84], ['Brisbane', 'oc', 153.17, -27.38], ['Fremantle', 'oc', 115.74, -32.05], ['Darwin', 'oc', 130.84, -12.47], ['Hobart', 'oc', 147.34, -42.88], ['Cairns', 'oc', 145.78, -16.92], ['Auckland', 'oc', 174.77, -36.84], ['Wellington', 'oc', 174.78, -41.28], ['Suva', 'oc', 178.42, -18.14], ['Nouméa', 'oc', 166.44, -22.27], ['Papeete', 'oc', -149.57, -17.53], ['Honolulu', 'oc', -157.87, 21.31],
    ['Los Angeles', 'na', -118.27, 33.73], ['San Francisco', 'na', -122.39, 37.80], ['San Diego', 'na', -117.17, 32.71], ['Seattle', 'na', -122.35, 47.60], ['Vancouver', 'na', -123.11, 49.29], ['Anchorage', 'na', -149.90, 61.22], ['Juneau', 'na', -134.42, 58.30], ['New York', 'na', -74.01, 40.69], ['Boston', 'na', -71.05, 42.36], ['Miami', 'na', -80.17, 25.77], ['Charleston', 'na', -79.93, 32.78], ['Baltimore', 'na', -76.58, 39.27], ['Norfolk', 'na', -76.29, 36.85], ['New Orleans', 'na', -90.06, 29.95], ['Galveston', 'na', -94.79, 29.31], ['Key West', 'na', -81.80, 24.55], ['Portland, Maine', 'na', -70.25, 43.66], ['Halifax', 'na', -63.57, 44.65], ["St. John's", 'na', -52.71, 47.56], ['Québec City', 'na', -71.20, 46.81],
    ['Havana', 'ca', -82.35, 23.14], ['Kingston', 'ca', -76.79, 17.97], ['Nassau', 'ca', -77.34, 25.08], ['San Juan', 'ca', -66.11, 18.47], ['Bridgetown', 'ca', -59.62, 13.10], ['Cartagena', 'ca', -75.53, 10.41], ['Colón', 'ca', -79.90, 9.36], ['Balboa', 'ca', -79.57, 8.95], ['Veracruz', 'ca', -96.13, 19.20], ['Cancún', 'ca', -86.82, 21.16], ['Acapulco', 'ca', -99.90, 16.85], ['Mazatlán', 'ca', -106.42, 23.20],
    ['Callao', 'sa', -77.15, -12.05], ['Valparaíso', 'sa', -71.63, -33.04], ['Buenos Aires', 'sa', -58.36, -34.60], ['Montevideo', 'sa', -56.21, -34.90], ['Rio de Janeiro', 'sa', -43.18, -22.89], ['Santos', 'sa', -46.30, -23.96], ['Salvador', 'sa', -38.51, -12.97], ['Recife', 'sa', -34.87, -8.06], ['Fortaleza', 'sa', -38.48, -3.72], ['Belém', 'sa', -48.50, -1.45], ['Punta Arenas', 'sa', -70.91, -53.16], ['Ushuaia', 'sa', -68.30, -54.81], ['Guayaquil', 'sa', -79.90, -2.20],
    ['London', 'eu', 0.07, 51.50], ['Southampton', 'eu', -1.40, 50.90], ['Liverpool', 'eu', -3.00, 53.41], ['Plymouth', 'eu', -4.14, 50.36], ['Dover', 'eu', 1.32, 51.12], ['Aberdeen', 'eu', -2.08, 57.14], ['Dublin', 'eu', -6.20, 53.35], ['Cork', 'eu', -8.30, 51.85], ['Rotterdam', 'eu', 4.05, 51.95], ['Amsterdam', 'eu', 4.90, 52.38], ['Antwerp', 'eu', 4.40, 51.23], ['Hamburg', 'eu', 9.97, 53.54], ['Copenhagen', 'eu', 12.60, 55.69], ['Oslo', 'eu', 10.74, 59.90], ['Bergen', 'eu', 5.32, 60.40], ['Stockholm', 'eu', 18.08, 59.32], ['Helsinki', 'eu', 24.96, 60.16], ['Tallinn', 'eu', 24.77, 59.45], ['Saint Petersburg', 'eu', 30.20, 59.93], ['Gdańsk', 'eu', 18.66, 54.40], ['Reykjavík', 'eu', -21.93, 64.15], ['Tórshavn', 'eu', -6.77, 62.01], ['Le Havre', 'eu', 0.11, 49.48], ['Brest', 'eu', -4.49, 48.38], ['Marseille', 'eu', 5.36, 43.30], ['Nice', 'eu', 7.28, 43.69], ['Barcelona', 'eu', 2.18, 41.37], ['Valencia', 'eu', -0.32, 39.45], ['Málaga', 'eu', -4.42, 36.71], ['Gibraltar', 'eu', -5.35, 36.14], ['Lisbon', 'eu', -9.15, 38.70], ['Porto', 'eu', -8.69, 41.18], ['Bilbao', 'eu', -3.05, 43.35], ['Genoa', 'eu', 8.92, 44.41], ['Naples', 'eu', 14.27, 40.84], ['Venice', 'eu', 12.34, 45.43], ['Palermo', 'eu', 13.37, 38.13], ['Valletta', 'eu', 14.51, 35.90], ['Piraeus', 'eu', 23.63, 37.94], ['Thessaloniki', 'eu', 22.93, 40.63], ['Istanbul', 'eu', 28.98, 41.01], ['Dubrovnik', 'eu', 18.09, 42.65], ['Split', 'eu', 16.44, 43.50], ['Odesa', 'eu', 30.75, 46.48],
    ['Tangier', 'af', -5.80, 35.78], ['Casablanca', 'af', -7.61, 33.60], ['Dakar', 'af', -17.43, 14.68], ['Abidjan', 'af', -4.02, 5.30], ['Lagos', 'af', 3.38, 6.45], ['Tema', 'af', 0.01, 5.63], ['Luanda', 'af', 13.23, -8.80], ['Cape Town', 'af', 18.43, -33.91], ['Durban', 'af', 31.03, -29.87], ['Port Louis', 'af', 57.50, -20.16], ['Mombasa', 'af', 39.67, -4.06], ['Zanzibar', 'af', 39.19, -6.16], ['Dar es Salaam', 'af', 39.29, -6.82], ['Djibouti', 'af', 43.14, 11.60], ['Tunis', 'af', 10.30, 36.81], ['Algiers', 'af', 3.07, 36.77], ['Alexandria', 'af', 29.87, 31.20], ['Port Said', 'af', 32.30, 31.26], ['Mogadishu', 'af', 45.34, 2.03], ['Victoria', 'af', 55.45, -4.62], ['Toamasina', 'af', 49.42, -18.15]
  ];
  const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const PORTS = PORT_LIST.map(([name, reg, lon, lat]) => { const [gx, gy] = ll2w(lon, lat); return { id: slug(name), name, reg, lon, lat, gx, gy }; });
  const PORT_BY = Object.fromEntries(PORTS.map(p => [p.id, p]));
  const DOCK_R = 420;

  // ── Materials ────────────────────────────────────────────────────────────
  const MATS = { timber: { name: 'Timber', col: '#c89b6a' }, rope: { name: 'Rope', col: '#d9c39a' }, canvas: { name: 'Canvas', col: '#efe6d2' }, nails: { name: 'Nails', col: '#d0a640' } };
  const MAT_KEYS = Object.keys(MATS);
  const matStr = m => Object.entries(m).filter(([, n]) => n > 0).map(([k, n]) => n + ' ' + MATS[k].name.toLowerCase()).join(' · ');

  // ── Shipwright upgrades ─────────────────────────────────────────────────
  const UPG = {
    sail: { name: 'Racing sails', icon: '⛵', lv: ['+6% speed', '+12% speed', '+18% speed'], cost: [{ timber: 2, canvas: 3 }, { timber: 3, canvas: 5, rope: 2 }, { timber: 5, canvas: 8, rope: 4, nails: 2 }], desc: 'Lighter, stiffer sails. Every boat in your fleet sails faster.' },
    hull: { name: 'Storm hull', icon: '🛡', lv: ['Storms slow you 35% less', 'Storms slow you 65% less', 'Sail through storms at full speed'], cost: [{ timber: 3, nails: 2 }, { timber: 5, nails: 4, rope: 1 }, { timber: 8, nails: 6, rope: 3 }], desc: 'A reinforced hull that shrugs off squalls, gusts and heavy seas.' },
    lantern: { name: 'Night lantern', icon: '🏮', lv: ['Spot finds 25% farther at night', 'Spot finds 50% farther at night', 'Spot finds twice as far at night'], cost: [{ timber: 1, rope: 1, nails: 1, canvas: 1 }, { timber: 2, rope: 2, nails: 2, canvas: 1 }, { timber: 3, rope: 3, nails: 3, canvas: 2 }], desc: 'A bright stern lantern. It lights the water around your boat after dark.' },
    net: { name: 'Fishing gear', icon: '🎣', lv: ['Longer strike window', 'Rarer bites', 'Rarer bites and longer window'], cost: [{ rope: 2, timber: 1 }, { rope: 4, nails: 2 }, { rope: 6, nails: 3, canvas: 2 }], desc: 'Better line, hooks and a landing net for the fish that bite.' }
  };

  // ── Seasonal events (month, day ranges; wrap over new year) ─────────────
  const EVENTS = [
    { id: 'lantern', name: 'Lantern Festival', icon: '🏮', from: [10, 15], to: [11, 15], desc: 'Paper lanterns drift on the sea after dark. Lanternfish bite at night, and every discovery gives a bonus material.', qk: 'efish', reward: 'sail:lantern', cos: 'Lantern sails' },
    { id: 'aurora', name: 'Winter Lights', icon: '✨', from: [12, 10], to: [1, 25], desc: 'Northern lights over every sea. Sail after dark to earn tokens, and every discovery gives a bonus material.', qk: 'enight', reward: 'flag:polar', cos: 'Polar flag' },
    { id: 'regatta', name: 'Spring Regatta', icon: '🚩', from: [3, 20], to: [4, 25], desc: 'Fresh spring winds: all quest rewards are doubled. Finish voyages to earn regatta tokens.', qk: 'evoy', reward: 'flag:regatta', cos: 'Regatta flag' },
    { id: 'monsoon', name: 'Monsoon Season', icon: '🌧', from: [6, 15], to: [8, 20], desc: 'Heavy weather washes more debris out to sea. Every discovery gives a bonus material.', qk: 'efind', reward: 'sail:monsoon', cos: 'Monsoon sails' }
  ];
  const EVENT_TOKENS = 5;
  const eventNow = (d = new Date()) => { const md = (d.getMonth() + 1) * 100 + d.getDate(); for (const e of EVENTS) { const a = e.from[0] * 100 + e.from[1], b = e.to[0] * 100 + e.to[1]; if (a <= b ? md >= a && md <= b : md >= a || md <= b) return e; } return null; };
  const eventEnd = e => { const d = new Date(); let y = d.getFullYear(); const end = new Date(y, e.to[0] - 1, e.to[1], 23, 59); if (end < d) end.setFullYear(y + 1); return end; };
  const COSMETICS = { 'sail:lantern': { name: 'Lantern sails', type: 'Sails', col: '#ffb35c' }, 'flag:polar': { name: 'Polar flag', type: 'Flag', col: '#9fe8ff' }, 'flag:regatta': { name: 'Regatta flag', type: 'Flag', col: '#ff5d73' }, 'sail:monsoon': { name: 'Monsoon sails', type: 'Sails', col: '#7c93a8' }, 'flag:passport': { name: 'Navigator flag', type: 'Flag', col: '#2f6fd6' } };

  // ── Fish ─────────────────────────────────────────────────────────────────
  const ALLZ = ['trop', 'sub', 'temp', 'cold'];
  const FISH = {
    sardine: { name: 'Sardine', z: ['trop', 'sub', 'temp'], rar: 'Common', kg: [.05, .2], col: '#9fb6c4' },
    mackerel: { name: 'Mackerel', z: ['sub', 'temp', 'cold'], rar: 'Common', kg: [.3, 1.4], col: '#6f9fb0' },
    snapper: { name: 'Red snapper', z: ['trop', 'sub'], rar: 'Common', kg: [1, 6], col: '#e07a5f' },
    seabass: { name: 'Sea bass', z: ['sub', 'temp'], rar: 'Common', kg: [.5, 5], col: '#9aa7a8' },
    cod: { name: 'Atlantic cod', z: ['temp', 'cold'], rar: 'Common', kg: [1, 12], col: '#a59b82' },
    herring: { name: 'Herring', z: ['temp', 'cold'], rar: 'Common', kg: [.1, .5], col: '#b7c7d1' },
    squid: { name: 'Squid', z: ALLZ, rar: 'Uncommon', kg: [.2, 3], col: '#f0b6c8', night: 1 },
    grouper: { name: 'Grouper', z: ['trop', 'sub'], rar: 'Uncommon', kg: [3, 25], col: '#8c7a5b' },
    mahi: { name: 'Mahi-mahi', z: ['trop', 'sub'], rar: 'Uncommon', kg: [3, 18], col: '#9bd35a' },
    parrot: { name: 'Parrotfish', z: ['trop'], rar: 'Uncommon', kg: [1, 7], col: '#5fd4c4' },
    salmon: { name: 'Salmon', z: ['temp', 'cold'], rar: 'Uncommon', kg: [2, 15], col: '#ff9d80' },
    tuna: { name: 'Yellowfin tuna', z: ['trop', 'sub', 'temp'], rar: 'Rare', kg: [20, 120], col: '#f2c14e' },
    halibut: { name: 'Halibut', z: ['cold', 'temp'], rar: 'Rare', kg: [10, 90], col: '#8a8f80' },
    marlin: { name: 'Blue marlin', z: ['trop', 'sub'], rar: 'Very rare', kg: [80, 400], col: '#3f6fd8' },
    swordfish: { name: 'Swordfish', z: ['sub', 'temp'], rar: 'Very rare', kg: [50, 300], col: '#7d8fa8' },
    boot: { name: 'Old boot', z: ALLZ, rar: 'Junk', kg: [.4, .9], col: '#5b4a3a', junk: 1 },
    lanternfish: { name: 'Lanternfish', z: ALLZ, rar: 'Event', kg: [.02, .1], col: '#ffb35c', ev: 'lantern', night: 1 }
  };
  const FW = { Common: 30, Uncommon: 12, Rare: 4, 'Very rare': 1.1, Junk: 6, Event: 14 };
  const FCOL = { Common: '#e9cf9a', Uncommon: '#9fd8e6', Rare: '#5fd4c4', 'Very rare': '#b79cff', Junk: '#a89c8c', Event: '#ffb35c' };

  // ── Daily quests ─────────────────────────────────────────────────────────
  const QDEF = {
    km: { icon: '⛵', ns: [10, 25, 50], label: n => `Sail ${n} km` },
    finds: { icon: '🧭', ns: [1, 2, 3], label: n => n > 1 ? `Open ${n} discoveries` : 'Open a discovery' },
    wreck: { icon: '⚓', ns: [1], label: () => 'Explore a shipwreck' },
    hail: { icon: '👋', ns: [1, 2], label: n => n > 1 ? `Hail ${n} sailors` : 'Hail a sailor' },
    port: { icon: '🏛', ns: [1], label: () => 'Dock at a port' },
    newport: { icon: '🗺', ns: [1], label: () => "Dock at a port you haven't visited" },
    voyage: { icon: '🏁', ns: [1, 2], label: n => n > 1 ? `Finish ${n} voyages` : 'Finish a voyage' },
    fish: { icon: '🎣', ns: [1, 3], label: n => n > 1 ? `Catch ${n} fish` : 'Catch a fish' },
    emote: { icon: '🎆', ns: [1], label: () => 'Light up the sky with fireworks' },
    night: { icon: '🌙', ns: [5, 10], label: n => `Sail ${n} km after dark` },
    note: { icon: '✉', ns: [1], label: () => 'Leave a note at sea' },
    flotilla: { icon: '⛵⛵', ns: [1], label: () => 'Finish a voyage in a flotilla' },
    efish: { icon: '🏮', ns: [1], label: () => 'Catch a lanternfish after dark', ev: 1 },
    enight: { icon: '✨', ns: [8], label: n => `Sail ${n} km under the night sky`, ev: 1 },
    evoy: { icon: '🚩', ns: [2], label: n => `Finish ${n} regatta voyages`, ev: 1 },
    efind: { icon: '🌧', ns: [2], label: n => `Open ${n} discoveries in the monsoon`, ev: 1 }
  };
  const QPOOL = ['km', 'finds', 'wreck', 'hail', 'port', 'newport', 'voyage', 'fish', 'emote', 'night', 'note', 'flotilla'];

  const EMOTES = [{ k: 'wave', icon: '👋', label: 'Wave' }, { k: 'horn', icon: '📯', label: 'Horn' }, { k: 'fireworks', icon: '🎆', label: 'Fireworks' }, { k: 'salute', icon: '🫡', label: 'Salute' }, { k: 'heart', icon: '❤️', label: 'Love' }, { k: 'laugh', icon: '😄', label: 'Laugh' }, { k: 'music', icon: '🎶', label: 'Sea shanty' }, { k: 'anchor', icon: '⚓', label: 'Anchors aweigh' }];

  const DEMO_NOTES = [['mara', 'The water turns glassy here just before sunset. Wait for it.'], ['tomas', 'Dolphins followed me for ten minutes along this stretch!'], ['ines', 'Left a little sketch of the lighthouse in my log. Lovely spot.'], ['priya', 'Good signal out here. Answered three emails at anchor 🙃'], ['kai', 'Strong current runs east here. Use it.'], ['saoirse', 'Whoever reads this: fair winds and following seas.']];

  // ── Error reporting: collect early, send once the app has an API ─────────
  const ERRQ = window.__sailoErrQ = window.__sailoErrQ || [];
  const errSeen = {};
  const pushErr = (msg, stack, src) => { msg = String(msg || '').slice(0, 300); if (!msg || errSeen[msg] || ERRQ.length > 20) return; errSeen[msg] = 1; ERRQ.push({ msg, stack: String(stack || '').slice(0, 2000), src: String(src || '').slice(0, 300), url: location.pathname, ua: navigator.userAgent.slice(0, 200), at: new Date().toISOString() }); };
  window.addEventListener('error', e => pushErr(e.message, e.error && e.error.stack, (e.filename || '') + ':' + (e.lineno || 0)));
  window.addEventListener('unhandledrejection', e => { const r = e.reason || {}; pushErr(r.message || String(r), r.stack, 'promise'); });
  { const cfg = window.SAILO_CONFIG || {}; if (cfg.sentryDsn) { const sc = document.createElement('script'); sc.src = 'https://browser.sentry-cdn.com/8.33.1/bundle.min.js'; sc.crossOrigin = 'anonymous'; sc.onload = () => { try { window.Sentry.init({ dsn: cfg.sentryDsn, tracesSampleRate: 0, environment: location.hostname }); } catch (e) { } }; document.head.appendChild(sc); } }

  // ── Offline shell: cache the app files so reloads are instant ───────────
  try { if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !/[?&]nosw\b/.test(location.search)) { const had = !!navigator.serviceWorker.controller; let done = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (!had || done) return; done = true; location.reload(); }); window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(r => r.update && r.update()).catch(() => { })); } } catch (e) { }

  const fresh = () => ({ v: 1, km: 0, nightKm: 0, wk: { k: weekKey(), km: 0 }, stamps: {}, mats: { timber: 0, rope: 0, canvas: 0, nails: 0 }, upg: { sail: 0, hull: 0, lantern: 0, net: 0 }, q: null, ev: {}, cos: [], catch: {}, log: [], boatKm: {}, tut: { s: {}, done: 0, off: 0 }, seen: 0, notes: 0 });

  class Voyage {
    constructor(h) {
      this.h = h; this.d = { ...fresh(), ...(h.state.voy || {}) }; this.dirty = false; this.fx = []; this.spouts = []; this.notes = []; this.notesAt = null; this.lb = {}; this.portsKey = ''; this.ports = [];
      this.flo = null; this.slowT = 0; this.whaleT = 40 + Math.random() * 30; this.starT = 8; this.stars = []; this.saveT = 0; this.distQ = 0; this.distT = 0; this.errT = 5; this.remT = 20; this.voyKm = 0;
      if (window.SailoOcean && window.SailoOcean.REWARDS) Object.assign(window.SailoOcean.REWARDS, COSMETICS);
      this.ensureQuests();
    }
    static get PORTS() { return PORTS; }
    static get FISH() { return FISH; }

    // ── Persistence ─────────────────────────────────────────────────────────
    reload(v) { this.d = { ...fresh(), ...(v || {}) }; this.ensureQuests(); this.portsKey = ''; }
    touch() { this.dirty = true; }
    flush() { if (!this.dirty) return; this.dirty = false; this.h.setState({ voy: { ...this.d } }); }
    ui() { return this.h.state.vyUI || {}; }
    setUI(p) { this.h.setState(s => ({ vyUI: { ...(s.vyUI || {}), ...p } })); }
    uid() { const u = this.h.state.auth && this.h.state.auth.user; return (u && u.id) || 'guest'; }

    // ── Materials ───────────────────────────────────────────────────────────
    inv() { const out = { timber: 0, rope: 0, canvas: 0, nails: 0 }; const O = this.h.ocean; if (O) for (const f of Object.values(O.journal.finds)) { const m = /^mat:(\w+)/.exec(f.reward || ''); if (m && out[m[1]] != null) out[m[1]]++; } for (const k of MAT_KEYS) out[k] = Math.max(0, out[k] + (this.d.mats[k] || 0)); return out; }
    give(m, why) { for (const k in m) this.d.mats[k] = (this.d.mats[k] || 0) + m[k]; this.touch(); if (why) this.h.toast(why + ' · +' + matStr(m)); }
    canPay(cost) { const i = this.inv(); return Object.entries(cost).every(([k, n]) => i[k] >= n); }

    // ── Events ──────────────────────────────────────────────────────────────
    event() { return eventNow(); }
    evState(e) { e = e || this.event(); if (!e) return null; const s = this.d.ev[e.id] || (this.d.ev[e.id] = { tokens: 0, y: new Date().getFullYear() }); return s; }
    cosmetics() { return (this.d.cos || []).slice(); }
    grantCos(id) { if (this.d.cos.includes(id)) return; this.d.cos.push(id); this.touch(); const O = this.h.ocean; if (O) O.refreshCosmetics(); const c = COSMETICS[id]; if (c) { this.h.sfx('bell'); this.h.vib([30, 50, 30]); this.h.toast('Unlocked: ' + c.name + ' · equip it in Edit boat'); } }

    // ── Daily quests ────────────────────────────────────────────────────────
    ensureQuests() {
      const day = dayKey(0); if (this.d.q && this.d.q.day === day) return; const r = rng(hash(day + ':' + this.uid())), pool = QPOOL.slice(), list = [];
      const ev = this.event(), n = ev ? 2 : 3; while (list.length < n && pool.length) { const k = pool.splice(Math.floor(r() * pool.length), 1)[0]; list.push(k); }
      if (ev) list.push(ev.qk);
      const mk = k => { const D = QDEF[k], nn = D.ns[Math.floor(r() * D.ns.length)], a = MAT_KEYS[Math.floor(r() * 4)], b = MAT_KEYS[Math.floor(r() * 4)], rw = {}; rw[a] = (rw[a] || 0) + 1 + Math.floor(r() * 2); rw[b] = (rw[b] || 0) + 1 + (D.ns.indexOf(nn) > 0 ? 1 : 0); return { k, n: nn, p: 0, done: 0, claimed: 0, rw }; };
      this.d.q = { day, list: list.map(mk), chest: 0 }; this.touch();
    }
    progress(k, amt = 1) {
      this.ensureQuests(); let hit = false;
      for (const q of this.d.q.list) { if (q.k !== k || q.done) continue; q.p = Math.min(q.n, q.p + amt); hit = true; if (q.p >= q.n - 1e-9) { q.p = q.n; q.done = 1; this.h.sfx('chime'); this.h.vib([20, 40, 20]); this.h.toast('Quest complete: ' + QDEF[k].label(q.n), { label: 'Claim', fn: () => this.open('quests') }); } }
      if (hit) this.touch();
    }
    claim(q) {
      if (!q.done || q.claimed) return; const ev = this.event(), mul = ev && ev.id === 'regatta' ? 2 : 1, rw = {}; for (const k in q.rw) rw[k] = q.rw[k] * mul; q.claimed = 1; this.give(rw, 'Quest reward');
      if (QDEF[q.k].ev && ev) { const s = this.evState(ev); s.tokens = Math.min(EVENT_TOKENS, s.tokens + 1); if (s.tokens >= EVENT_TOKENS) this.grantCos(ev.reward); }
      this.h.sfx('cork'); this.flush();
    }
    claimChest() { const q = this.d.q; if (!q || q.chest || !q.list.every(x => x.claimed)) return; q.chest = 1; this.give({ timber: 1, rope: 1, canvas: 1, nails: 1 }, "Captain's chest"); this.h.celebrate && this.h.celebrate(); this.flush(); }

    // ── Shipwright ──────────────────────────────────────────────────────────
    buy(k) { const U = UPG[k], lv = this.d.upg[k] || 0; if (lv >= U.cost.length) return; const cost = U.cost[lv]; if (!this.canPay(cost)) { this.h.toast('Not enough materials yet. Open discoveries and finish quests to collect more.'); return; } for (const m in cost) this.d.mats[m] = (this.d.mats[m] || 0) - cost[m]; this.d.upg[k] = lv + 1; this.touch(); this.flush(); this.h.sfx('bell'); this.h.vib([30, 40, 30]); this.h.toast(U.name + ' upgraded · ' + U.lv[lv]); }
    hullProt() { return [0, .35, .65, 1][this.d.upg.hull || 0]; }
    reachMul() { const night = (this.h.skyNow && this.h.skyNow.night) || 0; return 1 + [0, .25, .5, 1][this.d.upg.lantern || 0] * clamp((night - .2) / .5, 0, 1); }

    // ── Weather and sailing speed ──────────────────────────────────────────
    windF(b) { const e = this.h.env || {}; const w = clamp((e.wind || 0) / 30, 0, 1), rel = Math.cos(ang(b.h - this.h.wind)); let f = 1 + .2 * rel * w; const ev = this.event(); if (ev && ev.id === 'regatta' && rel > 0) f += .05 * rel; return f; }
    stormF(b) { const e = this.h.env || {}; const prot = b.me ? this.hullProt() : .5; return 1 - .28 * (e.storm || 0) * (1 - prot); }
    speedMul(b) { let f = this.windF(b) * this.stormF(b); if (b.me) f *= 1 + .06 * (this.d.upg.sail || 0); return clamp(f, .6, 1.4); }
    windLine() {
      const H = this.h, me = H.boatsById && H.boatsById.me; if (!me || me.state !== 'sailing') return ''; const e = H.env || {}; const wf = Math.round((this.windF(me) - 1) * 100), sf = Math.round((1 - this.stormF(me)) * 100), up = 6 * (this.d.upg.sail || 0), parts = [];
      parts.push(Math.abs(wf) < 4 ? 'Crosswind' : wf > 0 ? 'Tailwind +' + wf + '%' : 'Headwind −' + Math.abs(wf) + '%'); if (sf >= 3) parts.push('Storm −' + sf + '%'); if (up) parts.push('Sails +' + up + '%'); if ((e.storm || 0) > .35 && this.hullProt() >= 1) parts.push('Storm hull'); return parts.join(' · ');
    }

    // ── Ports ───────────────────────────────────────────────────────────────
    refreshPorts() {
      const H = this.h, [OX, OY] = H.globalOff(), key = OX + ':' + OY + ':' + (H.islands ? H.islands.length : 0); if (key === this.portsKey) return; this.portsKey = key;
      this.ports = PORTS.map(p => { const x0 = p.gx - OX, y0 = p.gy - OY; let x = x0, y = y0, dir; if (Math.abs(x0) < 4e5 && Math.abs(y0) < 4e5) { const q = H.pushOut(x0, y0); x = q[0]; y = q[1]; } const moved = Math.hypot(x - x0, y - y0) > 1; if (moved) dir = Math.atan2(y0 - y, x0 - x); else { let best = null, bd = 1e9; for (const i of H.islands || []) { const dd = Math.hypot(i.cx - x, i.cy - y) - i.ext; if (dd < bd) { bd = dd; best = i; } } dir = best && bd < 900 ? Math.atan2(best.cy - y, best.cx - x) : (hash(p.id) % 628) / 100; } return { ...p, x, y, dir, quay: !moved, seed: hash(p.id) % 1000 }; });
      this.islandLights = (H.islands || []).filter(i => i.R > 900).map(i => { const a = (hash(i.id + i.name) % 628) / 100, pt = i.parts[0], m = pt.f(a); return { x: pt.x + Math.cos(a) * pt.R * m * .97, y: pt.y + Math.sin(a) * pt.R * m * .8 * .97, seed: hash(i.name) % 1000, name: i.name }; });
    }
    nearestPorts(n, from) { const H = this.h, me = from || H.boatsById.me; this.refreshPorts(); return this.ports.map(p => ({ p, d: Math.hypot(p.x - me.x, p.y - me.y) })).sort((a, b) => a.d - b.d).slice(0, n); }
    sailToPort(id) { this.refreshPorts(); const p = this.ports.find(q => q.id === id); if (!p) return; this.startSteer(p); }
    // ── Steering to a port with the on-screen joystick ─────────────────────
    startSteer(p) {
      const H = this.h, me = H.boatsById.me; me.state = 'anchored'; me.path = []; me.dest = null; if (H.buoy) H.buoy.fade = H.t;
      this.voyStart = { gx: me.x + H.globalOff()[0], gy: me.y + H.globalOff()[1], at: Date.now() }; this.voyKm = 0;
      this.steer = { id: p.id, name: p.name, d0: Math.max(1, Math.hypot(p.x - me.x, p.y - me.y)), t0: H.t, routeT: 0, route: null }; this.joy = { x: 0, y: 0 }; this.keys = {};
      H.setState(s => ({ vyUI: { ...(s.vyUI || {}), steer: true, port: null, dock: null, panel: false, boatMenu: false }, searchOpen: false, q: '', sel: null, meOpen: false, fleetOpen: false, journalOpen: false })); H.follow = 'me'; H.camT.z = Math.max(H.camT.z, .9);
      H.sfx('pop'); H.toast('Steer with the joystick and follow the dotted line to ' + p.name + '.'); this.tut('course');
    }
    endSteer(quiet) { if (!this.steer) return; const H = this.h, me = H.boatsById.me; if (me.dest && me.dest.steer) { me.dest = null; if (me.state === 'sailing' || me.state === 'drift') { me.state = 'anchored'; me.path = []; } } const n = this.steer.name; this.steer = null; this.joy = { x: 0, y: 0 }; this.setUI({ steer: false }); this.resetKnob(); if (!quiet) H.toast('Stopped steering to ' + n + '.'); }
    steerPort() { if (!this.steer) return null; this.refreshPorts(); return this.ports.find(q => q.id === this.steer.id) || null; }
    preStep(dt) { // runs before the host moves boats
      const st = this.steer; if (!st) return; const H = this.h, me = H.boatsById.me, p = this.steerPort(); if (!p) { this.endSteer(true); return; }
      let jx = this.joy.x, jy = this.joy.y; const k = this.keys || {}; if (k.l || k.r || k.u || k.d) { jx = (k.r ? 1 : 0) - (k.l ? 1 : 0); jy = (k.d ? 1 : 0) - (k.u ? 1 : 0); const m = Math.hypot(jx, jy) || 1; jx /= m; jy /= m; }
      const mag = Math.min(1, Math.hypot(jx, jy)); if (mag > .12) { const w = H.scr2w(jx, jy, 1), wl = Math.hypot(w[0], w[1]) || 1, T = H.typeOf(me.type), K = H.travelK(), dd = Math.max(40, (mag * T.v - 2) * K * 2); me.path = [[me.x + w[0] / wl * dd, me.y + w[1] / wl * dd]]; me.pi = 0; me.state = 'sailing'; me.dest = { x: p.x, y: p.y, name: p.name, port: p.id, steer: 1 }; me.total = st.d0; me.at = null; }
      else if (me.state === 'sailing') { me.state = 'drift'; me.path = []; }
      if (Math.hypot(p.x - me.x, p.y - me.y) < DOCK_R * .75) { me.state = 'anchored'; me.path = []; me.dest = { x: p.x, y: p.y, name: p.name, port: p.id }; this.steer = null; this.joy = { x: 0, y: 0 }; this.resetKnob(); this.setUI({ steer: false }); H.arrived(me); }
    }
    steerRoute() { const st = this.steer, H = this.h; if (!st) return null; if (!st.route || H.t - st.routeT > 1.5) { const p = this.steerPort(), me = H.boatsById.me; if (!p) return null; const r = H.route(me.x, me.y, p.x, p.y); st.route = r ? r.pts : [[p.x, p.y]]; st.routeT = H.t; } return st.route; }
    navSteer(me) { const p = this.steerPort(); if (!p) return null; const d = Math.hypot(p.x - me.x, p.y - me.y); return { kicker: 'Steering to', title: p.name, sailing: true, pct: Math.round(clamp(1 - d / this.steer.d0, 0, 1) * 100) + '%', eta: fmtKm(km(d)) }; }
    bindJoy() {
      const el = this.h.joyRef && this.h.joyRef.current; if (!el || el === this.joyEl) return; this.joyEl = el; const knob = el.querySelector('[data-knob]');
      const set = e => { const r = el.getBoundingClientRect(), R = r.width / 2, dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R), m = Math.hypot(dx, dy), k = m > R * .62 ? R * .62 / m : 1; this.joy = { x: dx / (R * .62) * Math.min(1, k * 1), y: dy / (R * .62) * Math.min(1, k * 1) }; const jm = Math.hypot(this.joy.x, this.joy.y); if (jm > 1) { this.joy.x /= jm; this.joy.y /= jm; } if (knob) knob.style.transform = `translate(${dx * k}px,${dy * k}px)`; };
      el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); try { el.setPointerCapture(e.pointerId); } catch (x) { } this.joyId = e.pointerId; set(e); });
      el.addEventListener('pointermove', e => { if (this.joyId !== e.pointerId) return; e.preventDefault(); set(e); });
      const up = e => { if (this.joyId !== e.pointerId) return; this.joyId = null; this.joy = { x: 0, y: 0 }; this.resetKnob(); }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      if (!this.keyBound) { this.keyBound = 1; const map = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd' }; const kh = on => e => { if (!this.steer || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return; const k = map[e.key]; if (!k) return; e.preventDefault(); (this.keys || (this.keys = {}))[k] = on; }; window.addEventListener('keydown', kh(true)); window.addEventListener('keyup', kh(false)); }
    }
    resetKnob() { const el = this.joyEl, kn = el && el.querySelector('[data-knob]'); if (kn) kn.style.transform = 'translate(0px,0px)'; }

    dock(p) {
      const H = this.h, s = this.d.stamps[p.id], isNew = !s; this.d.stamps[p.id] = { n: (s ? s.n : 0) + 1, first: s ? s.first : Date.now(), last: Date.now() }; this.touch();
      this.progress('port'); if (isNew) this.progress('newport');
      const n = Object.keys(this.d.stamps).length; if (n >= 10) this.grantCos('flag:passport');
      const me = H.boatsById.me, cs = Math.cos(p.dir), sn = Math.sin(p.dir), moored = [], ppl = H.people(); const pick = H.boats.filter(b => !b.me && (!this.flo || this.flo.id !== b.id) && !H.state.blocked[b.id]).sort((a, b) => hash(p.id + a.id + dayKey(0)) - hash(p.id + b.id + dayKey(0))).slice(0, 2 + hash(p.id + dayKey(0)) % 2);
      pick.forEach((b, i) => { const off = (i + 1) * 46 * (i % 2 ? -1 : 1), q = H.pushOut(p.x - cs * 30 - sn * off, p.y - sn * 30 + cs * off); b.x = q[0]; b.y = q[1]; b.h = p.dir + Math.PI / 2; b.state = 'anchored'; b.path = []; b.dest = null; b.v = 0; b.at = p.name; b.timer = 120 + i * 40; b.wake = []; b.trail = []; moored.push(b.id); });
      this.setUI({ dock: { id: p.id, fresh: isNew, sailors: moored, t: Date.now() }, port: null }); H.sfx(isNew ? 'bell' : 'chime'); H.vib(isNew ? [40, 60, 40] : 20);
      if (isNew) setTimeout(() => H.toast('New passport stamp: ' + p.name + ' · ' + n + ' port' + (n === 1 ? '' : 's') + ' stamped'), 600);
      void ppl; void me;
    }

    // ── Hooks from the host ─────────────────────────────────────────────────
    onCourse(me) { if (this.steer) this.endSteer(true); this.voyStart = { gx: me.x + this.h.globalOff()[0], gy: me.y + this.h.globalOff()[1], at: Date.now() }; this.voyKm = 0; this.tut('course'); if (this.ui().dock) this.setUI({ dock: null }); }
    onArrive(me) {
      const H = this.h, [OX, OY] = H.globalOff(), dest = me.dest; this.progress('voyage'); const ev = this.event(); if (ev && ev.id === 'regatta') this.progress('evoy');
      if (this.voyStart && dest) { this.d.log.unshift({ f: [Math.round(this.voyStart.gx), Math.round(this.voyStart.gy)], t: [Math.round(me.x + OX), Math.round(me.y + OY)], n: dest.name || 'Open water', km: Math.round(this.voyKm * 10) / 10, at: Date.now(), b: me.type }); this.d.log = this.d.log.slice(0, 60); this.touch(); }
      this.voyStart = null; this.tut('arrive');
      if (this.flo) { const f = H.boatsById[this.flo.id]; if (f && Math.hypot(f.x - me.x, f.y - me.y) < 500) { this.progress('flotilla'); this.give({ rope: 1, timber: 1 }, 'Arrived together with ' + H.personName(this.flo.id)); } }
      this.refreshPorts(); let best = null, bd = 1e9; for (const p of this.ports) { const d = Math.hypot(p.x - me.x, p.y - me.y); if (d < bd) { bd = d; best = p; } }
      if (best && (bd < DOCK_R || (dest && dest.port === best.id && bd < DOCK_R * 2))) { this.dock(best); return true; }
      if (this.d.tut && !this.d.tut.done && !this.d.tut.s.find) this.tutCrate();
      return false;
    }
    onFind(kind, d) { this.progress('finds'); if (d && d.cat === 'wreck') this.progress('wreck'); const ev = this.event(); if (ev) { if (ev.id === 'monsoon') this.progress('efind'); if (ev.id !== 'regatta') { const k = MAT_KEYS[hash(kind + Date.now()) % 4]; this.give({ [k]: 1 }, ev.name + ' bonus'); } } this.tut('find'); this.flush(); }
    onHail() { this.progress('hail'); this.tut('hail'); }

    // ── First-voyage guide ──────────────────────────────────────────────────
    tut(step) { const t = this.d.tut; if (!t || t.done || t.s[step]) return; t.s[step] = 1; this.touch(); if (['course', 'arrive', 'find', 'hail'].every(k => t.s[k])) { t.done = 1; this.give({ timber: 2, rope: 2, canvas: 2, nails: 2 }, 'First voyage complete'); this.h.celebrate && this.h.celebrate(); } this.flush(); }
    tutCrate() { const H = this.h, O = H.ocean, me = H.boatsById.me; if (!O || !window.SailoOcean || this.tutSpawned) return; this.tutSpawned = 1; const K = window.SailoOcean.KINDS, [OX, OY] = H.globalOff(); const a = me.h + .5, x = me.x + Math.cos(a) * 140, y = me.y + Math.sin(a) * 140; if (H.isLand(x, y)) return; const id = 'barrel:guide-' + this.uid().replace(/[^A-Za-z0-9]/g, '').slice(0, 24); if (O.journal.finds[id]) return; O.local.push({ id, kind: 'barrel', d: K.barrel, cat: 'float', gx: x + OX, gy: y + OY, seed: 3.7, h: 1.1, hab: 'open', wd: 200, zone: 'trop', born: H.t, ax: 0, ay: 0, per: 500, ph: 0, ph2: 0, st: { bob: 0, sp: 0, sr: 0, spin: 0, dx: 0, dy: 0, init: false } }); setTimeout(() => H.toast('Something is floating nearby. Tap it to take a look.'), 1200); }

    // ── Per-frame update ────────────────────────────────────────────────────
    update(dt) {
      const H = this.h, me = H.boatsById && H.boatsById.me; if (!me) return; const st = H.state, live = !st.authView && !st.loggedOut && st.onboarded;
      // distance sailed (skip world rebases and teleports)
      if (this.pm) { const d = Math.hypot(me.x - this.pm[0], me.y - this.pm[1]); if (d > 0 && d < 3000 && (me.state === 'sailing' || me.v > .5)) { const k = km(d); this.d.km += k; this.voyKm += k; if (this.d.wk.k !== weekKey()) this.d.wk = { k: weekKey(), km: 0 }; this.d.wk.km += k; this.d.boatKm[me.type] = (this.d.boatKm[me.type] || 0) + k; this.distQ += k; this.kmAcc = (this.kmAcc || 0) + k; const night = (H.skyNow && H.skyNow.night) || 0; if (night > .45) { this.d.nightKm += k; this.nkAcc = (this.nkAcc || 0) + k; } this.dirty = true; } }
      this.pm = [me.x, me.y];
      if (this.kmAcc >= .25) { this.progress('km', this.kmAcc); this.kmAcc = 0; }
      if (this.nkAcc >= .25) { this.progress('night', this.nkAcc); const ev = this.event(); if (ev && ev.id === 'aurora') this.progress('enight', this.nkAcc); this.nkAcc = 0; }
      // storm pushes boats sideways unless the hull is upgraded
      const e = H.env || {}; if ((e.storm || 0) > .3 && me.state === 'sailing') { const p = (1 - this.hullProt()) * e.storm * 14 * dt, nx = me.x + Math.cos(H.wind) * p, ny = me.y + Math.sin(H.wind) * p; if (!H.isLand(nx, ny)) { me.x = nx; me.y = ny; } }
      if (this.ui().dock && me.state === 'sailing') this.setUI({ dock: null });
      this.stepFlotilla(dt, me); this.stepFish(dt, me); this.stepFx(dt); if (this.steer) this.bindJoy();
      // whales surface beside slow or anchored boats
      if (live && me.v < 3 && H.marine && H.marine.cfg().on && H.cam.z > .3) { this.slowT += dt; this.whaleT -= dt; if (this.slowT > 20 && this.whaleT <= 0) { this.whaleT = 50 + Math.random() * 45; this.surfaceWhale(me); } } else this.slowT = 0;
      if (st.onboarded && !st.authView) { this.seenT = (this.seenT || 0) - dt; if (this.seenT <= 0) { this.seenT = 30; this.d.seen = Date.now(); this.dirty = true; } }
      // shooting stars
      const S = H.skyNow || { night: 0 }; if (S.night > .6 && (e.cloud || 0) < 45 && !(e.rain > .2)) { this.starT -= dt; if (this.starT <= 0) { this.starT = 6 + Math.random() * 12; this.stars.push({ x: .1 + Math.random() * .7, y: .05 + Math.random() * .35, a: .35 + Math.random() * .5, t0: H.t, L: .12 + Math.random() * .12 }); } }
      this.stars = this.stars.filter(s => H.t - s.t0 < 1);
      // notes nearby
      this.noteT = (this.noteT || 0) - dt; if (live && this.noteT <= 0) { this.noteT = 20; this.loadNotes(); }
      // sync distance, flush errors, reminders, save
      this.distT += dt; if (this.distT > 60) { this.distT = 0; if (this.distQ > .05 && H.isReal() && H.A.addDistance) { const q = this.distQ; this.distQ = 0; H.A.addDistance(q).catch(() => { this.distQ += q; }); } }
      this.errT -= dt; if (this.errT <= 0) { this.errT = 15; this.flushErrors(); }
      this.remT -= dt; if (this.remT <= 0) { this.remT = 60; this.checkReminder(); }
      this.saveT += dt; if (this.saveT > 1.5) { this.saveT = 0; this.flush(); }
    }
    surfaceWhale(me) { const H = this.h; for (let i = 0; i < 6; i++) { const a = Math.random() * TAU, d = 170 + Math.random() * 120, x = me.x + Math.cos(a) * d, y = me.y + Math.sin(a) * d, h = Math.random() * TAU, L = 92; if (H.isLand(x, y) || H.isLand(x + Math.cos(h) * L * 1.6, y + Math.sin(h) * L * 1.6) || (H.marine && H.marine.isWater(x, y) === false)) continue; (H.jumps || (H.jumps = [])).push({ x, y, h, t0: H.t, len: L, T: 3.6, D: L * 1.5, Zp: L * .07, col: '#2e4350' }); this.spouts.push({ x: x + Math.cos(h) * L * .35, y: y + Math.sin(h) * L * .35, t0: H.t + .5 }); if (!this.whaleSeen) { this.whaleSeen = 1; setTimeout(() => H.toast('A whale surfaced beside your boat.'), 900); } return; } }

    // ── Flotilla ────────────────────────────────────────────────────────────
    invite(id) { const H = this.h, nm = H.personName(id); if (H.state.friends[id] !== 'friends') { H.toast('Add ' + nm + ' as a friend first, then you can sail together.'); return; } if (this.flo && this.flo.id === id) { this.leaveFlo(); return; } if (this.flo) this.leaveFlo(true); H.toast('Invited ' + nm + ' to sail with you…'); setTimeout(() => { const b = H.boatsById[id]; if (!b) return; this.flo = { id, t0: H.t }; b.state = 'flotilla'; b.path = []; b.dest = null; b.timer = 1e9; this.h.sfx('horn'); H.flare(id, '⛵'); H.toast(nm + ' joined your flotilla. Set a course and they will sail alongside.'); H.forceUpdate(); }, 1400); }
    leaveFlo(quiet) { const H = this.h; if (!this.flo) return; const b = H.boatsById[this.flo.id]; if (b) { b.state = 'anchored'; b.timer = 4; b.at = null; } if (!quiet) H.toast(H.personName(this.flo.id) + ' left the flotilla.'); this.flo = null; H.forceUpdate(); }
    stepFlotilla(dt, me) {
      if (!this.flo) return; const H = this.h, b = H.boatsById[this.flo.id]; if (!b || H.state.blocked[b.id]) { this.flo = null; return; }
      const L = 46, cs = Math.cos(me.h), sn = Math.sin(me.h), tx = me.x - cs * L * 1.5 - sn * L * 1.1, ty = me.y - sn * L * 1.5 + cs * L * 1.1, d = Math.hypot(tx - b.x, ty - b.y);
      if (d > 4000) { b.x = tx; b.y = ty; } const k = 1 - Math.exp(-dt * 2.2); const nx = b.x + (tx - b.x) * k, ny = b.y + (ty - b.y) * k; if (!H.isLand(nx, ny)) { b.x = nx; b.y = ny; }
      b.h = d > 25 ? b.h + ang(Math.atan2(ty - b.y, tx - b.x) - b.h) * Math.min(1, dt * 3) : b.h + ang(me.h - b.h) * Math.min(1, dt * 2); b.v = Math.max(me.v, d > 40 ? 12 : 0); b.state = 'flotilla'; b.timer = 1e9; b.at = null;
    }

    // ── Fishing ─────────────────────────────────────────────────────────────
    canFish() { const H = this.h, me = H.boatsById && H.boatsById.me, st = H.state; return !!me && me.state !== 'sailing' && me.v < 1.2 && st.onboarded && !st.authView && !st.loggedOut && st.phase === 'free' && !st.photo; }
    fishTap() {
      const H = this.h, f = this.ui().fish || { ph: 'idle' }, me = H.boatsById.me;
      if (f.ph === 'idle' || f.ph === 'result') { if (!this.canFish()) { H.toast('Drop anchor first: fish only bite while you are stopped.'); return; } const a = me.h + Math.PI / 2 * (Math.random() < .5 ? 1 : -1) + (Math.random() - .5) * .6, L = (TYPESafe(H, me.type)) * .5 + 55; this.bob = { x: me.x + Math.cos(a) * L, y: me.y + Math.sin(a) * L, t0: H.t, bite: 0, dip: 0 }; this.biteAt = H.t + 2.4 + Math.random() * 4; this.setUI({ fish: { ph: 'wait' } }); H.sfx('whoosh'); setTimeout(() => H.sfx('cork'), 600); return; }
      if (f.ph === 'wait') { this.bob = null; this.setUI({ fish: { ph: 'result', miss: 'Too early. The fish swam off.' } }); return; }
      if (f.ph === 'bite') { this.catchFish(); }
    }
    stepFish(dt, me) {
      const f = this.ui().fish; if (!f || f.ph === 'idle' || f.ph === 'result') { if (this.bob && (!f || f.ph !== 'bite')) this.bob = null; return; }
      const H = this.h; if (me.state === 'sailing' || me.v > 2) { this.bob = null; this.setUI({ fish: { ph: 'idle' } }); return; }
      if (f.ph === 'wait' && H.t >= this.biteAt) { this.bob && (this.bob.bite = H.t); this.biteEnd = H.t + 1 + .25 * Math.min(2, this.d.upg.net || 0) + ((this.d.upg.net || 0) >= 3 ? .25 : 0); this.setUI({ fish: { ph: 'bite' } }); H.sfx('pop'); H.vib([60, 40, 60]); H.splash && this.bob && H.splash(this.bob.x, this.bob.y, .35); }
      if (f.ph === 'bite' && H.t > this.biteEnd) { this.bob = null; this.setUI({ fish: { ph: 'result', miss: 'It got away. Try again?' } }); }
    }
    catchFish() {
      const H = this.h, me = H.boatsById.me, M = H.marine, zn = M ? M.zoneAt(me.x, me.y).z : 'temp', night = (H.skyNow && H.skyNow.night) || 0, ev = this.event(), net = this.d.upg.net || 0, pool = []; let tot = 0;
      for (const id in FISH) { const s = FISH[id]; if (!s.z.includes(zn)) continue; if (s.ev && (!ev || ev.id !== s.ev || night < .4)) continue; let w = FW[s.rar]; if (s.night) w *= .5 + night; if (net >= 2 && /Rare|Very rare/.test(s.rar)) w *= 1.8; if (s.junk) w *= 1 - net * .2; tot += w; pool.push([id, tot]); }
      const r = Math.random() * tot, id = (pool.find(p => p[1] >= r) || pool[0])[0], s = FISH[id], kg = Math.round((s.kg[0] + Math.pow(Math.random(), 2.2) * (s.kg[1] - s.kg[0])) * 100) / 100, prev = this.d.catch[id], isNew = !prev, best = !prev || kg > prev.best;
      this.d.catch[id] = { n: (prev ? prev.n : 0) + 1, best: Math.max(prev ? prev.best : 0, kg) }; this.touch(); if (!s.junk) this.progress('fish'); if (id === 'lanternfish') this.progress('efish'); this.flush();
      this.bob = null; H.sfx(/Rare|Very rare|Event/.test(s.rar) ? 'chime' : 'splash'); H.vib(30); H.splash && H.splash(me.x, me.y, .3);
      this.setUI({ fish: { ph: 'result', id, kg, isNew, best: best && !isNew } });
    }

    // ── Effects: fireworks, spouts ─────────────────────────────────────────
    stepFx(dt) { for (const p of this.fx) { p.t += dt; if (p.kind === 'rocket') { p.z += p.vz * dt; p.vz -= 60 * dt; if (!p.boom && p.t > p.fuse) { p.boom = 1; const n = 34; for (let i = 0; i < n; i++) { const a = i / n * TAU, el = (Math.random() - .3) * 1.4, sp = 70 + Math.random() * 40; this.fx.push({ kind: 'spark', x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * sp * Math.cos(el), vy: Math.sin(a) * sp * Math.cos(el), vz: Math.sin(el) * sp, t: 0, life: 1.3 + Math.random() * .6, col: p.col }); } this.h.sfx('pop'); } } else if (p.kind === 'spark') { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= 55 * dt; const dmp = Math.exp(-dt * 1.4); p.vx *= dmp; p.vy *= dmp; } } this.fx = this.fx.filter(p => p.kind === 'rocket' ? !p.boom || p.t < p.fuse + .05 : p.t < p.life); this.spouts = this.spouts.filter(s => this.h.t - s.t0 < 3); }
    fireworks(b) { const cols = ['#ff7a59', '#f2c14e', '#5fd4c4', '#b79cff', '#ff9ec4', '#ffffff']; for (let i = 0; i < 3; i++) this.fx.push({ kind: 'rocket', x: b.x + (Math.random() - .5) * 30, y: b.y + (Math.random() - .5) * 30, z: 10, vz: 150 + Math.random() * 40, t: -i * .35, fuse: .9 + Math.random() * .3, col: cols[Math.floor(Math.random() * cols.length)] }); this.h.sfx('whoosh'); }

    // ── Emote wheel ─────────────────────────────────────────────────────────
    emote(k) {
      const H = this.h, E = EMOTES.find(x => x.k === k), me = H.boatsById.me; if (!E) return; if (Date.now() - (this.lastEm || 0) < 900) return; this.lastEm = Date.now(); this.setUI({ wheel: false });
      H.flare('me', E.icon); if (k === 'horn') { H.sfx('horn'); H.vib(80); } else if (k === 'fireworks') { this.fireworks(me); this.progress('emote'); H.vib([20, 30, 20]); } else if (k === 'music') { H.sfx('bell'); } else { H.sfx('pop'); H.vib(15); }
      const R = (H.props.discoveryRadius ?? 170) * 2.4, near = H.boats.filter(b => !b.me && b.presence !== 'parked' && !H.state.blocked[b.id] && Math.hypot(b.x - me.x, b.y - me.y) < R).slice(0, 2);
      const REP = { wave: ['👋', '😄'], horn: ['📯', '👋'], fireworks: ['🎆', '🤩', '👏'], salute: ['🫡', '⚓'], heart: ['❤️', '😊'], laugh: ['😂', '😄'], music: ['🎶', '🪗', '💃'], anchor: ['⚓', '👍'] }[k];
      near.forEach((b, i) => setTimeout(() => { H.flare(b.id, REP[Math.floor(Math.random() * REP.length)]); if (k === 'fireworks' && i === 0) this.fireworks(b); }, 900 + i * 600 + Math.random() * 500));
      if (near.length) { this.onHail(); } this.tut('hail');
    }

    // ── Notes left at sea ───────────────────────────────────────────────────
    async loadNotes(force) {
      const H = this.h, me = H.boatsById.me, [OX, OY] = H.globalOff(), gx = me.x + OX, gy = me.y + OY; if (!force && this.notesAt && Math.hypot(gx - this.notesAt[0], gy - this.notesAt[1]) < 6000 && Date.now() - this.notesAt[2] < 120000) return; this.notesAt = [gx, gy, Date.now()];
      let rows = null; if (H.isReal() && H.A.nearbyNotes) { try { rows = await H.A.nearbyNotes(gx, gy, 40000); } catch (e) { rows = null; } }
      if (!rows) rows = this.demoNotes(gx, gy);
      this.notes = rows.filter(n => !(this.hidden || {})[n.id]);
    }
    demoNotes(gx, gy) {
      const k = 'sailo.notes.demo'; let st = null; try { st = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { }
      if (!st || !st.seed) { st = { seed: [gx, gy], mine: [], likes: {} }; }
      const r = rng(hash(Math.round(st.seed[0] / 5000) + ':' + Math.round(st.seed[1] / 5000))), H = this.h, ppl = H.people(); const out = DEMO_NOTES.map(([pid, body], i) => { const a = r() * TAU, d = 900 + r() * 3600, p = ppl.find(x => x.id === pid); return { id: 'demo-' + i, gx: st.seed[0] + Math.cos(a) * d, gy: st.seed[1] + Math.sin(a) * d, body, author: p ? p.name.split(' ')[0] : 'A sailor', created: Date.now() - (2 + i * 7) * 3600e3, likes: 2 + Math.floor(r() * 14) + (st.likes['demo-' + i] ? 1 : 0), liked: !!st.likes['demo-' + i], demo: true }; });
      for (const m of st.mine) out.push({ ...m, likes: (m.likes || 0) + (st.likes[m.id] ? 1 : 0), liked: !!st.likes[m.id], mine: true });
      try { localStorage.setItem(k, JSON.stringify(st)); } catch (e) { } return out;
    }
    async postNote() {
      const H = this.h, u = this.ui(), body = (u.draft || '').trim(); if (!body) return; if (body.length > 140) { this.setUI({ cErr: 'Keep it to 140 characters.' }); return; } const me = H.boatsById.me, [OX, OY] = H.globalOff(), gx = me.x + OX, gy = me.y + OY; this.setUI({ cBusy: true, cErr: '' });
      if (H.isReal() && H.A.postNote) { const r = await H.A.postNote(gx, gy, body); if (r && r.error) { this.setUI({ cBusy: false, cErr: r.error }); return; } }
      else { const k = 'sailo.notes.demo'; try { const st = JSON.parse(localStorage.getItem(k) || 'null') || { seed: [gx, gy], mine: [], likes: {} }; st.mine.push({ id: 'mine-' + Date.now(), gx, gy, body, author: H.state.me.name || 'You', created: Date.now(), likes: 0 }); st.mine = st.mine.slice(-20); localStorage.setItem(k, JSON.stringify(st)); } catch (e) { } }
      this.d.notes = (this.d.notes || 0) + 1; this.touch(); this.progress('note'); this.setUI({ compose: false, draft: '', cBusy: false }); H.sfx('cork'); H.toast('Note left here. Sailors who pass by can read it.'); await this.loadNotes(true); this.flush();
    }
    async likeNote(n) { const H = this.h; n.liked = !n.liked; n.likes += n.liked ? 1 : -1; H.forceUpdate(); if (H.isReal() && H.A.likeNote && !n.demo) { try { await H.A.likeNote(n.id); } catch (e) { } } else { const k = 'sailo.notes.demo'; try { const st = JSON.parse(localStorage.getItem(k) || 'null'); if (st) { if (n.liked) st.likes[n.id] = 1; else delete st.likes[n.id]; localStorage.setItem(k, JSON.stringify(st)); } } catch (e) { } } }
    async reportNote(n) { const H = this.h; (this.hidden || (this.hidden = {}))[n.id] = 1; this.notes = this.notes.filter(x => x.id !== n.id); this.setUI({ note: null }); if (H.isReal() && H.A.reportNote && !n.demo) { try { await H.A.reportNote(n.id); } catch (e) { } } H.toast('Thanks. That note is hidden and we will take a look.'); }

    // ── Leaderboards ────────────────────────────────────────────────────────
    async loadBoard(kind) { const H = this.h; this.lb[kind] = this.lb[kind] || { rows: null, at: 0 }; if (Date.now() - this.lb[kind].at < 60000 && this.lb[kind].rows) return; this.lb[kind].at = Date.now(); let rows = []; if (H.isReal() && H.A.leaderboard) { try { if (kind === 'km' && this.distQ > .05) { const q = this.distQ; this.distQ = 0; await H.A.addDistance(q); } rows = await H.A.leaderboard(kind) || []; } catch (e) { rows = []; } } this.lb[kind].rows = rows; H.forceUpdate(); }
    myScore(kind) { const H = this.h, O = H.ocean, wk = new Date(weekKey() + 'T00:00:00').getTime(); if (kind === 'km') return this.d.wk.k === weekKey() ? this.d.wk.km : 0; if (kind === 'finds') return O ? Object.values(O.journal.finds).filter(f => f.at >= wk).length : 0; return (H.state.fleet && H.state.fleet.best) || 0; }
    demoScore(id, kind) { const r = rng(hash(id + ':' + kind + ':' + weekKey())); if (kind === 'km') return Math.round(15 + r() * r() * 900); if (kind === 'finds') return Math.floor(r() * r() * 30); return 1 + Math.floor(r() * 45); }

    // ── Reminders and error reports ─────────────────────────────────────────
    flushErrors() { const H = this.h; if (!ERRQ.length || !H.A || !H.A.logError) return; const batch = ERRQ.splice(0, 5); for (const e of batch) H.A.logError(e).catch(() => { }); }
    checkReminder() {
      const H = this.h, n = H.state.notif || {}, f = H.state.fleet || {}; if (!n.device || !n.streak || typeof Notification === 'undefined' || Notification.permission !== 'granted') return; const now = new Date(); if (now.getHours() < 19) return; const today = dayKey(0); if (f.last === today || !(f.streak > 0) || this.d.remind === today) return;
      this.d.remind = today; this.touch(); const body = 'Finish a voyage before midnight to keep your ' + f.streak + '-day streak.'; const show = () => { try { new Notification('Sailo · keep your streak', { body, icon: './favicon.svg', tag: 'streak' }); } catch (e) { } }; try { if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(r => r.showNotification('Sailo · keep your streak', { body, icon: './favicon.svg', tag: 'streak' })).catch(show); else show(); } catch (e) { show(); }
    }
    async toggleReminders() { const H = this.h, n = H.state.notif || {}; if (n.device) { H.setState(s => ({ notif: { ...s.notif, device: false } })); return; } if (typeof Notification === 'undefined') { H.toast("This browser can't show reminders."); return; } let p = Notification.permission; if (p === 'default') { try { p = await Notification.requestPermission(); } catch (e) { } } if (p !== 'granted') { H.toast('Reminders are blocked. Allow notifications for this site in your browser settings.'); return; } H.setState(s => ({ notif: { ...s.notif, device: true, streak: true } })); H.toast("Reminders on. We'll nudge you in the evening if your streak is at risk."); }

    // ── Return gift ─────────────────────────────────────────────────────────
    onEnter() {
      if (this.entered) return; this.entered = 1; const H = this.h, seen = this.d.seen; this.d.seen = Date.now(); this.touch(); if (!seen) return; const hrs = (Date.now() - seen) / 3600e3; if (hrs < 6) return;
      const r = rng(hash(String(seen))), ppl = H.people().filter(p => !H.state.blocked[p.id]), names = []; for (let i = 0; i < 2 + Math.floor(r() * 3) && ppl.length; i++) names.push(ppl.splice(Math.floor(r() * ppl.length), 1)[0].name.split(' ')[0]);
      const units = clamp(1 + Math.floor(hrs / 8), 1, 6), gift = {}; for (let i = 0; i < units; i++) { const k = MAT_KEYS[Math.floor(r() * 4)]; gift[k] = (gift[k] || 0) + 1; }
      const drift = 1 + Math.floor(r() * 4), whales = r() < .5;
      const lines = [{ icon: '⛵', text: names.join(', ').replace(/, ([^,]*)$/, ' and $1') + ' sailed past your mooring.' }, { icon: '📦', text: drift + ' piece' + (drift === 1 ? '' : 's') + ' of debris drifted in on the current.' }]; if (whales) lines.push({ icon: '🐋', text: 'A pod of whales passed by in the night.' }); const ev = this.event(); if (ev) lines.push({ icon: ev.icon, text: ev.name + ' is on now.' });
      setTimeout(() => this.setUI({ ret: { hrs, lines, gift } }), 2500);
    }
    collectGift() { const r = this.ui().ret; if (!r) return; this.give(r.gift); this.flush(); this.setUI({ ret: null }); this.h.sfx('chime'); this.h.toast('Collected · +' + matStr(r.gift)); }

    // ── Drawing (world space, after the sea surface, before boats) ──────────
    inView(x, y, m, x0, y0, x1, y1) { return x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m; }
    drawWorld(c, x0, y0, x1, y1, z, t, night) {
      const H = this.h, E = H.E, sb = H.sbNow || 1, me = H.boatsById.me; this.refreshPorts();
      const SV = H.sunSh || { x: -.8, y: -.2, a: .6 };
      if (z > .04) for (const p of this.ports) { if (!this.inView(p.x, p.y, 400, x0, y0, x1, y1)) continue; p.vis = true; if (z > .2) this.drawPort(c, p, t, night, E, SV); }
      if (z > .25 && this.islandLights) for (const L of this.islandLights) if (this.inView(L.x, L.y, 300, x0, y0, x1, y1)) this.lighthouse(c, L.x, L.y, 54, 7, E, SV, L.seed);
      // steering guide: dotted route to the port
      if (this.steer) { const rt = this.steerRoute(), p = this.steerPort(); if (rt && p) { c.save(); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2.4 / z; c.setLineDash([2 / z, 9 / z]); c.lineCap = 'round'; c.lineDashOffset = -t * 30 / z; c.beginPath(); c.moveTo(me.x, me.y); for (const q of rt) c.lineTo(q[0], q[1]); c.stroke(); c.setLineDash([]); const k = (t * .7) % 1; c.globalAlpha = 1 - k; c.strokeStyle = '#5fd4c4'; c.lineWidth = 2.5 / z; c.beginPath(); c.arc(p.x, p.y, (DOCK_R * .75) * (.4 + k * .6), 0, TAU); c.stroke(); c.restore(); } }
      // notes: small corked floats with a paper scroll
      if (z > .12) for (const n of this.notes) { const [OX, OY] = H.globalOff(), x = n.gx - OX, y = n.gy - OY; n.x = x; n.y = y; if (!this.inView(x, y, 100, x0, y0, x1, y1)) { n.on = false; continue; } n.on = true; const bob = Math.sin(t * 1.6 + (hash(String(n.id)) % 100)) * 1.2, s = Math.max(1, sb * .8); c.globalAlpha = .25; c.fillStyle = '#062a38'; c.beginPath(); c.ellipse(x + 1.5 * s, y + 2 * s, 7 * s, 4 * s, 0, 0, TAU); c.fill(); c.globalAlpha = 1; c.fillStyle = n.mine ? '#5fd4c4' : '#ff9d80'; c.beginPath(); c.ellipse(x, y + bob * .3, 6 * s, 4.2 * s, 0, 0, TAU); c.fill(); c.fillStyle = '#fff6e2'; c.fillRect(x - 3.4 * s + E.x * 5 * s, y - 2.6 * s + E.y * 5 * s + bob * .3, 6.8 * s, 4.8 * s); c.strokeStyle = 'rgba(120,90,50,.6)'; c.lineWidth = .7 * s; c.beginPath(); c.moveTo(x - 2.2 * s + E.x * 5 * s, y - .6 * s + E.y * 5 * s + bob * .3); c.lineTo(x + 2.2 * s + E.x * 5 * s, y - .6 * s + E.y * 5 * s + bob * .3); c.moveTo(x - 2.2 * s + E.x * 5 * s, y + 1 * s + E.y * 5 * s + bob * .3); c.lineTo(x + 1.4 * s + E.x * 5 * s, y + 1 * s + E.y * 5 * s + bob * .3); c.stroke(); const k = (t * .5 + (hash(String(n.id)) % 7) / 7) % 1; c.globalAlpha = (1 - k) * .45; c.strokeStyle = '#ffffff'; c.lineWidth = 1 * s; c.beginPath(); c.ellipse(x, y, (8 + k * 14) * s, (5 + k * 9) * s, 0, 0, TAU); c.stroke(); c.globalAlpha = 1; }
      // flotilla: a dotted tow line between the boats
      if (this.flo) { const b = H.boatsById[this.flo.id]; if (b) { c.save(); c.strokeStyle = 'rgba(95,212,196,.7)'; c.lineWidth = 1.6 / z; c.setLineDash([3 / z, 6 / z]); c.lineDashOffset = -t * 10 / z; c.beginPath(); c.moveTo(me.x, me.y); c.lineTo(b.x, b.y); c.stroke(); c.restore(); } }
      // fishing line and float
      if (this.bob) { const b = this.bob, biting = b.bite && t - b.bite < 1.6, dip = biting ? Math.min(1, (t - b.bite) * 4) : 0, bx = b.x + Math.sin(t * 9) * dip * 1.2, by = b.y; const tip = [me.x + Math.cos(me.h + Math.PI / 2) * 6 + E.x * 26, me.y + Math.sin(me.h + Math.PI / 2) * 6 + E.y * 26]; c.strokeStyle = 'rgba(255,255,255,.65)'; c.lineWidth = .7; c.beginPath(); c.moveTo(tip[0], tip[1]); c.quadraticCurveTo((tip[0] + bx) / 2, (tip[1] + by) / 2 + 10, bx, by); c.stroke(); const k = (t * .7) % 1; c.globalAlpha = (1 - k) * .5; c.strokeStyle = '#fff'; c.beginPath(); c.ellipse(bx, by, 4 + k * 9, 3 + k * 6, 0, 0, TAU); c.stroke(); c.globalAlpha = 1 - dip * .7; c.fillStyle = '#ff5340'; c.beginPath(); c.arc(bx, by - (1 - dip) * 1.5, 2.6, Math.PI, 0); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(bx, by - (1 - dip) * 1.5, 2.6, 0, Math.PI); c.fill(); c.globalAlpha = 1; if (biting) { c.globalAlpha = .7 * (1 - dip * .5); c.strokeStyle = '#fff'; c.lineWidth = 1.2; for (let i = 0; i < 2; i++) { const kk = ((t - b.bite) * 1.4 + i * .5) % 1; c.beginPath(); c.ellipse(bx, by, 3 + kk * 16, 2 + kk * 11, 0, 0, TAU); c.stroke(); } c.globalAlpha = 1; } }
      // whale spouts
      for (const s of this.spouts) { const a = t - s.t0; if (a < 0) continue; for (let i = 0; i < 9; i++) { const u = (a * 1.6 + i / 9) % 1, zz = u * 34, r = (3 + u * 9) * (1 + i % 3 * .2); c.globalAlpha = (1 - u) * .5 * Math.max(0, 1 - a / 3); c.fillStyle = '#f4fbff'; c.beginPath(); c.arc(s.x + E.x * zz + Math.sin(i * 2.3) * u * 6, s.y + E.y * zz + Math.cos(i * 1.7) * u * 4, r, 0, TAU); c.fill(); } c.globalAlpha = 1; }
      // festival lanterns (body; glow is added in drawGlow)
      if (this.lanternsOn(night) && z > .15) for (const L of this.lanterns(x0, y0, x1, y1, t)) { c.fillStyle = '#e8a050'; c.globalAlpha = .9; c.beginPath(); c.ellipse(L.x + E.x * 3, L.y + E.y * 3, 3, 3.6, 0, 0, TAU); c.fill(); c.globalAlpha = 1; }
    }
    lanternsOn(night) { const ev = this.event(); return ev && ev.id === 'lantern' && night > .3; }
    lanterns(x0, y0, x1, y1, t) { const out = [], G = 220, H = this.h, [OX, OY] = H.globalOff(); const i0 = Math.floor((x0 + OX) / G), i1 = Math.floor((x1 + OX) / G), j0 = Math.floor((y0 + OY) / G), j1 = Math.floor((y1 + OY) / G); if ((i1 - i0) * (j1 - j0) > 900) return out; for (let i = i0; i <= i1; i++)for (let j = j0; j <= j1; j++) { const h = hash(i + ',' + j); if (h % 4) continue; const r = rng(h), x = i * G + r() * G - OX + Math.cos(t * .05 + r() * 6) * 18, y = j * G + r() * G - OY + Math.sin(t * .04 + r() * 6) * 18; if (H.isLand(x, y)) continue; out.push({ x, y, f: r() * 6 }); } return out; }
    lighthouse(c, x, y, Ht, r, E, SV, seed) {
      const el = Math.hypot(E.x, E.y) || .001, nx = -E.y / el, ny = E.x / el, r1 = r * .7, at = z => [x + E.x * z, y + E.y * z], rad = z => r + (r1 - r) * z / Ht;
      if (SV.a > .02) { c.globalAlpha = .22 * SV.a; c.fillStyle = '#062a38'; const sx = -SV.y, sy = SV.x, sl = Math.hypot(sx, sy) || 1; c.beginPath(); c.moveTo(x + sx / sl * r, y + sy / sl * r); c.lineTo(x + SV.x * Ht + sx / sl * r1, y + SV.y * Ht + sy / sl * r1); c.lineTo(x + SV.x * Ht - sx / sl * r1, y + SV.y * Ht - sy / sl * r1); c.lineTo(x - sx / sl * r, y - sy / sl * r); c.closePath(); c.fill(); c.globalAlpha = 1; }
      c.fillStyle = '#7d776b'; c.beginPath(); c.ellipse(x, y, r * 1.8, r * 1.35, 0, 0, TAU); c.fill(); c.fillStyle = '#9b958a'; c.beginPath(); c.ellipse(x + E.x * 2, y + E.y * 2, r * 1.6, r * 1.2, 0, 0, TAU); c.fill();
      const red = seed % 3 === 0 ? '#2f5d8a' : '#c8473a', N = 5;
      for (let i = 0; i < N; i++) { const z0 = Ht * i / N, z1 = Ht * (i + 1) / N, a0 = at(z0), a1 = at(z1), r0 = rad(z0), rr = rad(z1); c.fillStyle = i % 2 ? red : '#f5f1e8'; c.beginPath(); c.moveTo(a0[0] + nx * r0, a0[1] + ny * r0); c.lineTo(a1[0] + nx * rr, a1[1] + ny * rr); c.lineTo(a1[0] - nx * rr, a1[1] - ny * rr); c.lineTo(a0[0] - nx * r0, a0[1] - ny * r0); c.closePath(); c.fill(); c.beginPath(); c.ellipse(a0[0], a0[1], r0, r0 * .62, Math.atan2(ny, nx), 0, Math.PI); c.fill(); }
      const b0 = at(0), tp = at(Ht); c.fillStyle = 'rgba(0,0,0,.14)'; c.beginPath(); c.moveTo(b0[0] - nx * r, b0[1] - ny * r); c.lineTo(tp[0] - nx * r1, tp[1] - ny * r1); c.lineTo(tp[0] - nx * r1 * .15, tp[1] - ny * r1 * .15); c.lineTo(b0[0] - nx * r * .15, b0[1] - ny * r * .15); c.closePath(); c.fill();
      c.fillStyle = '#2b3b44'; c.beginPath(); c.ellipse(tp[0], tp[1], r1 * 1.45, r1 * 1.05, 0, 0, TAU); c.fill();
      const lamp = at(Ht + 5); c.fillStyle = '#fff3c4'; c.fillRect(lamp[0] - r1 * .7, lamp[1] - r1 * .5 - E.y * 2, r1 * 1.4, r1 * 1.2); c.fillStyle = red; c.beginPath(); const cap = at(Ht + 9); c.ellipse(cap[0], cap[1], r1 * .95, r1 * .7, 0, 0, TAU); c.fill(); c.fillStyle = '#1f2a30'; c.beginPath(); const tip = at(Ht + 13); c.arc(tip[0], tip[1], 1.4, 0, TAU); c.fill();
      return lamp;
    }
    box(c, P, a0, a1, b0, b1, h, top, side, side2) { const B = [P(a0, b0, 0), P(a1, b0, 0), P(a1, b1, 0), P(a0, b1, 0)], T = [P(a0, b0, h), P(a1, b0, h), P(a1, b1, h), P(a0, b1, h)], q = (pts, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(...pts[0]); for (const p of pts.slice(1)) c.lineTo(...p); c.closePath(); c.fill(); }; for (let i = 0; i < 4; i++) q([B[i], B[(i + 1) % 4], T[(i + 1) % 4], T[i]], i % 2 ? side : (side2 || side)); q(T, top); }
    drawPort(c, p, t, night, E, SV) {
      const cs = Math.cos(p.dir), sn = Math.sin(p.dir), P = (a, b, zz) => [p.x + cs * a - sn * b + E.x * (zz || 0), p.y + sn * a + cs * b + E.y * (zz || 0)], poly = (pts, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(...pts[0]); for (const q of pts.slice(1)) c.lineTo(...q); c.closePath(); c.fill(); };
      if (p.quay) { const Q = [[60, -70], [175, -78], [182, 74], [60, 66]]; poly(Q.map(([a, b]) => { const q = P(a, b, 0); return [q[0] + 4, q[1] + 6]; }), 'rgba(6,42,56,.3)'); this.box(c, P, 60, 180, -72, 70, 7, '#c2bcae', '#8a8478', '#9a9488');
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(...P(60, -72, 7)); c.lineTo(...P(60, 70, 7)); c.stroke();
        this.box(c, P, 110, 160, -60, -18, 22, '#b45a42', '#8e4433', '#9e4b39'); this.box(c, P, 112, 158, 4, 52, 18, '#d9d2c2', '#a59e90', '#b3ac9e'); }
      // timber pier beside the berth, on posts
      const b0 = 20, b1 = 34, a0 = -55, a1 = 64; poly([P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)].map(q => [q[0] + 3, q[1] + 5]), 'rgba(6,42,56,.28)');
      c.strokeStyle = '#5a4128'; c.lineWidth = 2; for (let a = a0 + 3; a <= a1; a += 16) for (const b of [b0 + 2, b1 - 2]) { c.beginPath(); c.moveTo(...P(a, b, 0)); c.lineTo(...P(a, b, 5)); c.stroke(); }
      poly([P(a0, b0, 5), P(a1, b0, 5), P(a1, b1, 5), P(a0, b1, 5)], '#a87b4f'); c.strokeStyle = 'rgba(80,55,30,.45)'; c.lineWidth = .8; for (let a = a0 + 2; a <= a1; a += 5) { c.beginPath(); c.moveTo(...P(a, b0, 5)); c.lineTo(...P(a, b1, 5)); c.stroke(); }
      c.fillStyle = '#3b3b3b'; for (const a of [-30, 0, 30]) { const q = P(a, b0 + 1.5, 7); c.beginPath(); c.arc(q[0], q[1], 1.6, 0, TAU); c.fill(); }
      // moored dinghies on the far side of the pier
      for (const [a, col] of [[-28, '#e4d8c0'], [12, '#5fd4c4'], [44, '#ff9d80']]) { const q = P(a, b1 + 9, 0), bob = Math.sin(t * 1.4 + a) * .4; c.save(); c.translate(q[0], q[1] + bob); c.rotate(p.dir); c.fillStyle = '#6b4a2a'; c.beginPath(); c.ellipse(0, 0, 11, 4.2, 0, 0, TAU); c.fill(); c.fillStyle = col; c.beginPath(); c.ellipse(0, -.6, 9.4, 3, 0, 0, TAU); c.fill(); c.restore(); }
      // breakwater with the lighthouse at its tip
      const bw = [[-60, -52], [40, -60], [44, -48], [-56, -40]]; poly(bw.map(([a, b]) => P(a, b, 0)), '#6f6a60'); poly(bw.map(([a, b]) => P(a, b, 4)), '#99938a');
      p.lamp = this.lighthouse(c, ...P(-58, -46, 4), 64, 8.5, E, SV, p.seed);
    }
    drawGlow(c, night) { // additive pass, after the night tint
      const H = this.h, t = H.t, g = H.glow; if (!g) return; const vis = [];
      if (night > .05) { for (const p of this.ports) if (p.vis && p.lamp) vis.push([p.lamp, p.seed]); if (H.cam.z > .25 && this.islandLights) for (const L of this.islandLights) { const s = H.toScreen(L.x, L.y); if (s.x > -200 && s.x < H.vw + 200 && s.y > -200 && s.y < H.vh + 200) vis.push([[L.x + H.E.x * 58, L.y + H.E.y * 58], L.seed]); } }
      for (const [lp, seed] of vis) { const a = t * .9 + seed; c.globalAlpha = night * .9; c.drawImage(g, lp[0] - 30, lp[1] - 30, 60, 60); for (const off of [0, Math.PI]) { const aa = a + off, L = 520, w = .16, gr = c.createLinearGradient(lp[0], lp[1], lp[0] + Math.cos(aa) * L, lp[1] + Math.sin(aa) * L); gr.addColorStop(0, 'rgba(255,240,190,.42)'); gr.addColorStop(1, 'rgba(255,240,190,0)'); c.fillStyle = gr; c.globalAlpha = night * .7; c.beginPath(); c.moveTo(lp[0], lp[1]); c.lineTo(lp[0] + Math.cos(aa - w) * L, lp[1] + Math.sin(aa - w) * L); c.lineTo(lp[0] + Math.cos(aa + w) * L, lp[1] + Math.sin(aa + w) * L); c.closePath(); c.fill(); } }
      for (const p of this.ports) p.vis = false;
      const me = H.boatsById.me, lv = this.d.upg.lantern || 0; if (lv && night > .2) { const R = (60 + lv * 30) * (H.sbNow || 1); c.globalAlpha = night * .5; c.drawImage(g, me.x - R, me.y - R, R * 2, R * 2); }
      if (this.lanternsOn(night) && H.cam.z > .15) { const x0 = H.cam.x - H.vw / H.cam.z, x1 = H.cam.x + H.vw / H.cam.z, y0 = H.cam.y - H.vh / H.cam.z, y1 = H.cam.y + H.vh / H.cam.z; for (const L of this.lanterns(x0, y0, x1, y1, t)) { const fl = .8 + .2 * Math.sin(t * 6 + L.f); c.globalAlpha = night * .95 * fl; c.drawImage(g, L.x - 22, L.y - 22, 44, 44); c.globalAlpha = night * .4; c.drawImage(g, L.x - 6, L.y + 4, 12, 30); } }
      c.globalAlpha = 1;
    }
    drawFx(c) { if (!this.fx.length) return; const H = this.h; c.save(); c.globalCompositeOperation = 'lighter';
      const E = H.E, sb = H.sbNow || 1; this.spr = this.spr || {}; for (const p of this.fx) { const sp = this.spr[p.col] || (this.spr[p.col] = mkSprite(p.col)); const x = p.x + E.x * p.z, y = p.y + E.y * p.z; if (p.kind === 'rocket') { if (p.t < 0 || p.boom) continue; c.globalAlpha = .9; c.drawImage(sp, x - 4 * sb, y - 4 * sb, 8 * sb, 8 * sb); } else { const k = p.t / p.life; c.globalAlpha = (1 - k) * (.6 + .4 * Math.sin(p.t * 30)); const r = (5 - k * 2) * sb; c.drawImage(sp, x - r, y - r, r * 2, r * 2); } }
      c.restore(); c.globalAlpha = 1;
    }
    drawSky(c, vw, vh, night) { // screen space: aurora and shooting stars on clear nights
      const H = this.h, t = H.t, e = H.env || {}, me = H.boatsById.me; if (night < .35) return; const clear = clamp(1 - (e.cloud || 0) / 70, 0, 1) * (1 - (e.fog || 0)) * (1 - (e.rain || 0) * .8); if (clear < .05) return;
      const lat = Math.abs(w2ll(me.x + H.globalOff()[0], me.y + H.globalOff()[1])[1]), ev = this.event(), au = (ev && ev.id === 'aurora' ? 1 : 0) || clamp((lat - 50) / 8, 0, 1);
      if (au > .02) { c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; const cols = [[110, 255, 170], [120, 230, 190], [170, 140, 255]], A = au * clear * night;
        for (let k = 0; k < 3; k++) { const [r, g, b] = cols[k], base = vh * (.08 + k * .07), amp = vh * .045, pts = []; for (let x = -30; x <= vw + 30; x += 24) pts.push([x, base + Math.sin(x * .004 + t * .22 + k * 1.7) * amp + Math.sin(x * .012 - t * .4 + k) * amp * .35]);
          for (let j = 0; j < 18; j++) { const f = j / 18, off = f * vh * (.12 + .03 * k); c.strokeStyle = `rgba(${r},${g},${b},${(A * .13 * (1 - f) * (1 - f) * (.75 + .25 * Math.sin(t * .9 + k * 2 + j * .3))).toFixed(4)})`; c.lineWidth = 7 + f * 10; c.beginPath(); c.moveTo(pts[0][0], pts[0][1] + off); for (const q of pts) c.lineTo(q[0], q[1] + off + Math.sin(q[0] * .03 + t * 1.3 + j) * 2 * f); c.stroke(); } }
        const rg = c.createLinearGradient(0, vh * .6, 0, vh); rg.addColorStop(0, 'rgba(110,255,170,0)'); rg.addColorStop(.6, `rgba(110,255,170,${(.035 * A).toFixed(3)})`); rg.addColorStop(1, 'rgba(170,140,255,0)'); c.fillStyle = rg; c.fillRect(0, vh * .6, vw, vh * .4); c.restore(); }
      for (const s of this.stars) { const a = t - s.t0, k = a / .9; if (k > 1) continue; const x = s.x * vw + k * s.L * vw, y = s.y * vh + k * s.L * vh * .45, tx = x - s.L * vw * .35, ty = y - s.L * vh * .16, gr = c.createLinearGradient(tx, ty, x, y); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(255,255,255,${(s.a * clear * Math.sin(Math.PI * k)).toFixed(3)})`); c.strokeStyle = gr; c.lineWidth = 1.6; c.beginPath(); c.moveTo(tx, ty); c.lineTo(x, y); c.stroke(); }
    }
    drawHud(c) { // screen space labels
      const H = this.h, z = H.cam.z; if (H.state.photo) return; c.textAlign = 'center'; c.textBaseline = 'middle';
      if (z > .04) for (const p of this.ports) { const s = H.toScreen(p.x, p.y); p.sx = s.x; p.sy = s.y; if (s.x < -60 || s.x > H.vw + 60 || s.y < -30 || s.y > H.vh + 30) continue; const st = this.d.stamps[p.id]; const small = z < .2; c.globalAlpha = 1; c.fillStyle = st ? '#5fd4c4' : '#f4efe6'; c.strokeStyle = '#10232c'; c.lineWidth = 2; c.beginPath(); c.arc(s.x, s.y, small ? 4.5 : 6, 0, TAU); c.fill(); c.stroke(); if (z > .08) { c.font = '600 11px Geist, sans-serif'; const label = (st ? '✓ ' : '⚓ ') + p.name, w = c.measureText(label).width + 14, ly = s.y - (small ? 16 : 22); c.fillStyle = 'rgba(10,27,36,.78)'; c.beginPath(); c.roundRect(s.x - w / 2, ly - 10, w, 20, 10); c.fill(); c.fillStyle = st ? '#9ff0e2' : '#f4efe6'; c.fillText(label, s.x, ly + .5); } }
      if (z > .3) for (const n of this.notes) { if (!n.on) continue; const s = H.toScreen(n.x, n.y); n.sx = s.x; n.sy = s.y; const me = H.boatsById.me; if (Math.hypot(n.x - me.x, n.y - me.y) < 500) { c.font = '500 11px Geist, sans-serif'; const w = 64; c.globalAlpha = .9; c.fillStyle = 'rgba(10,27,36,.72)'; c.beginPath(); c.roundRect(s.x - w / 2, s.y - 30, w, 18, 9); c.fill(); c.fillStyle = '#ffd9c8'; c.fillText('✉ A note', s.x, s.y - 20.5); c.globalAlpha = 1; } }
      if (this.steer) { const p = this.steerPort(); if (p) { const s = H.toScreen(p.x, p.y), cx = H.vw / 2, cy = H.vh / 2; if (s.x < 30 || s.x > H.vw - 30 || s.y < 80 || s.y > H.vh - 30) { const a = Math.atan2(s.y - cy, s.x - cx), m = Math.min((H.vw / 2 - 40) / Math.abs(Math.cos(a) || 1e-6), (H.vh / 2 - 90) / Math.abs(Math.sin(a) || 1e-6)), x = cx + Math.cos(a) * m, y = cy + Math.sin(a) * m; c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = 'rgba(10,27,36,.7)'; c.beginPath(); c.arc(0, 0, 20, 0, TAU); c.fill(); c.fillStyle = '#5fd4c4'; c.beginPath(); c.moveTo(11, 0); c.lineTo(-5, -8); c.lineTo(-1, 0); c.lineTo(-5, 8); c.closePath(); c.fill(); c.restore(); c.font = '600 11px Geist, sans-serif'; c.fillStyle = '#f4efe6'; c.textAlign = 'center'; c.fillText(p.name, x, y + 32); } } }
      c.globalAlpha = 1;
    }
    hit(sx, sy) {
      const H = this.h; for (const n of this.notes) if (n.on && n.sx != null && Math.hypot(n.sx - sx, n.sy - sy) < 24) { const me = H.boatsById.me; if (Math.hypot(n.x - me.x, n.y - me.y) > 900) { H.toast('Sail closer to read this note.'); H.setDest(n.x, n.y, 'A note at sea'); return true; } this.setUI({ note: n.id }); H.sfx('cork'); return true; }
      if (H.cam.z > .04) for (const p of this.ports) if (p.sx != null && Math.hypot(p.sx - sx, p.sy - sy) < 22 && p.sx > -60 && p.sx < H.vw + 60) { this.setUI({ port: p.id, dock: null }); H.sfx('pop'); return true; }
      return false;
    }
  }
  const mkSprite = col => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, '#ffffff'); g.addColorStop(.3, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return c; };
  const TYPESafe = (H, t) => { const T = H.typeOf && H.typeOf(t); return T ? T.len : 30; };

  // ── Values for the page template ─────────────────────────────────────────
  const chip = on => ({ bg: on ? '#f4efe6' : 'transparent', fg: on ? '#10232c' : '#f4efe6' });
  const ini = n => (n || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  Voyage.prototype.open = function (tab) { const H = this.h; H.setState(s => ({ vyUI: { ...(s.vyUI || {}), panel: true, tab: tab || (s.vyUI && s.vyUI.tab) || 'quests', port: null }, fleetOpen: false, journalOpen: false, meOpen: false, sel: null, inbox: false, chat: null, full: false })); if (tab === 'leaders') this.loadBoard((this.ui().lbKind) || 'km'); };
  Voyage.prototype.profileExtras = function (id) {
    const H = this.h, fl = this.flo && this.flo.id === id, fr = H.state.friends[id] === 'friends', r = rng(hash(id + ':log')), first = H.personName(id);
    const ports = []; const pool = PORTS.slice(); for (let i = 0; i < 3; i++) ports.push(pool.splice(Math.floor(r() * pool.length), 1)[0].name);
    const kmT = Math.round(800 + r() * 9000), stamps = 4 + Math.floor(r() * 30), finds = 3 + Math.floor(r() * 60), fish = Math.floor(r() * 40);
    return { floLabel: fl ? 'Leave flotilla' : 'Sail together', floAct: () => this.invite(id), floBg: fl ? 'rgba(95,212,196,.18)' : 'transparent', floTitle: fr ? 'Invite ' + first + ' to sail alongside you' : 'Add ' + first + ' as a friend to sail together', floOp: fr || fl ? 1 : .6,
      logStats: [{ n: kmT.toLocaleString(), l: 'km sailed' }, { n: String(stamps), l: 'Ports stamped' }, { n: String(finds), l: 'Discoveries' }, { n: String(fish), l: 'Fish caught' }], logPorts: 'Recently docked at ' + ports.join(', ').replace(/, ([^,]*)$/, ' and $1') + '.' };
  };
  Voyage.prototype.searchRows = function (ql) { if (!ql) return []; this.refreshPorts(); const me = this.h.boatsById.me; return this.ports.filter(p => p.name.toLowerCase().includes(ql)).slice(0, 6).map(p => ({ label: p.name, sub: 'Port · ' + REGIONS[p.reg] + ' · ' + fmtKm(km(Math.hypot(p.x - me.x, p.y - me.y))) + (this.d.stamps[p.id] ? ' · stamped' : '') + ' · set course', mark: '⚓', color: '#9ff0e2', radius: '10px', pick: () => { this.h.setState({ searchOpen: false, q: '', mbRes: [] }); this.sailToPort(p.id); } })); };
  Voyage.prototype.vals = function () {
    const H = this.h, s = H.state, u = s.vyUI || {}, me = H.boatsById && H.boatsById.me, inv = this.inv(), ev = this.event(), evs = ev ? this.evState(ev) : null; this.ensureQuests();
    const q = this.d.q, claimable = q.list.filter(x => x.done && !x.claimed).length + (q.list.every(x => x.claimed) && !q.chest ? 1 : 0);
    const tab = u.tab || 'quests', tabs = [['quests', 'Quests'], ['passport', 'Passport'], ['ship', 'Ship'], ['log', 'Log'], ['leaders', 'Leaders']].map(([k, l]) => ({ label: l + (k === 'quests' && claimable ? ' · ' + claimable : ''), ...chip(tab === k), pick: () => { this.setUI({ tab: k }); if (k === 'leaders') this.loadBoard(u.lbKind || 'km'); } }));
    const mats = MAT_KEYS.map(k => ({ name: MATS[k].name, n: String(inv[k]), col: MATS[k].col }));
    const out = { vyOpen: !!u.panel && !s.chat && !s.inbox, vyClose: () => this.setUI({ panel: false }), vyOpenPanel: () => this.open(), vyOpenQuests: () => this.open('quests'), vyOpenPassport: () => this.open('passport'), vyOpenShip: () => this.open('ship'), vyOpenLog: () => this.open('log'), vyOpenLeaders: () => this.open('leaders'), vyTabs: tabs, vyMats: mats, vyBadge: String(claimable), vyHasBadge: claimable > 0,
      vyTQ: tab === 'quests', vyTP: tab === 'passport', vyTS: tab === 'ship', vyTL: tab === 'log', vyTB: tab === 'leaders' };
    // quests
    const nextDay = new Date(); nextDay.setHours(24, 0, 0, 0); const hrs = Math.max(1, Math.round((nextDay - Date.now()) / 3600e3));
    Object.assign(out, { vyQuests: q.list.map(x => { const D = QDEF[x.k]; return { icon: D.icon, label: D.label(x.n), prog: (x.k === 'km' || x.k === 'night' || x.k === 'enight' ? (Math.floor(x.p * 10) / 10) : Math.floor(x.p)) + ' / ' + x.n, pct: Math.round(x.p / x.n * 100) + '%', rw: matStr(Object.fromEntries(Object.entries(x.rw).map(([k, n]) => [k, n * (ev && ev.id === 'regatta' ? 2 : 1)]))), canClaim: !!x.done && !x.claimed, claimed: !!x.claimed, open: !x.done, claim: () => this.claim(x), ev: !!D.ev, border: D.ev ? 'rgba(255,179,92,.45)' : 'rgba(255,255,255,.08)' }; }),
      vyChestReady: q.list.every(x => x.claimed) && !q.chest, vyChestDone: !!q.chest, vyChestClaim: () => this.claimChest(), vyQuestReset: 'New quests in ' + hrs + ' h',
      vyEvent: !!ev, vyEvName: ev ? ev.name : '', vyEvIcon: ev ? ev.icon : '', vyEvDesc: ev ? ev.desc : '', vyEvEnds: ev ? 'Ends ' + eventEnd(ev).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '', vyEvTokens: evs ? evs.tokens + ' / ' + EVENT_TOKENS + ' tokens' : '', vyEvPct: evs ? Math.round(evs.tokens / EVENT_TOKENS * 100) + '%' : '0%', vyEvReward: ev ? (this.d.cos.includes(ev.reward) ? 'Unlocked: ' + ev.cos : 'Collect ' + EVENT_TOKENS + ' tokens for the limited ' + ev.cos) : '' });
    // passport
    if (out.vyOpen && tab === 'passport') { this.refreshPorts(); const stamped = Object.keys(this.d.stamps).length; const near = me ? this.nearestPorts(6) : []; out.vyStampCount = stamped + ' of ' + PORTS.length + ' ports stamped'; out.vyStampPct = Math.round(stamped / PORTS.length * 100) + '%'; out.vyNear = near.map(({ p, d }) => ({ name: p.name, sub: REGIONS[p.reg] + ' · ' + fmtKm(km(d)) + (this.d.stamps[p.id] ? ' · stamped ✓' : ''), go: () => this.sailToPort(p.id) }));
      out.vyRegions = Object.keys(REGIONS).map(r => { const ps = PORTS.filter(p => p.reg === r), got = ps.filter(p => this.d.stamps[p.id]); return { name: REGIONS[r], count: got.length + ' / ' + ps.length, stamps: ps.map(p => { const st = this.d.stamps[p.id]; return { name: p.name, on: !!st, op: st ? 1 : .45, bg: st ? 'rgba(95,212,196,.14)' : 'rgba(255,255,255,.03)', border: st ? 'rgba(95,212,196,.5)' : 'rgba(255,255,255,.1)', sub: st ? (st.n > 1 ? st.n + ' visits' : new Date(st.first).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })) : '' }; }) }; }); out.vyNavFlag = this.d.cos.includes('flag:passport') ? 'Navigator flag unlocked' : 'Stamp 10 ports to unlock the Navigator flag'; }
    // shipwright
    if (out.vyOpen && tab === 'ship') out.vyUpg = Object.entries(UPG).map(([k, U]) => { const lv = this.d.upg[k] || 0, max = lv >= U.cost.length, cost = max ? null : U.cost[lv], can = !max && this.canPay(cost); return { icon: U.icon, name: U.name, desc: U.desc, level: max ? 'Max level' : 'Level ' + lv + ' of ' + U.cost.length, now: lv ? U.lv[lv - 1] : 'Not fitted yet', next: max ? '' : 'Next: ' + U.lv[lv], cost: max ? '' : Object.entries(cost).map(([m, n]) => n + ' ' + MATS[m].name.toLowerCase() + (inv[m] < n ? ' (have ' + inv[m] + ')' : '')).join(' · '), can, max, notMax: !max, btnBg: can ? '#ff7a59' : 'rgba(255,255,255,.08)', btnFg: can ? '#1b0f0a' : 'rgba(244,239,230,.55)', buy: () => this.buy(k), pips: U.cost.map((_, i) => ({ bg: i < lv ? '#5fd4c4' : 'rgba(255,255,255,.14)' })) }; });
    // sea log
    if (out.vyOpen && tab === 'log') { const O = H.ocean, finds = O ? Object.values(O.journal.finds) : [], fav = Object.entries(this.d.boatKm).sort((a, b) => b[1] - a[1])[0], T = fav && H.typeOf(fav[0]);       out.vyStats = [{ n: fmtKm(this.d.km), l: 'Sailed in total' }, { n: String(this.d.log.length), l: 'Voyages logged' }, { n: String(Object.keys(this.d.stamps).length), l: 'Ports stamped' }, { n: String(finds.length), l: 'Discoveries' }, { n: String(Object.values(this.d.catch).reduce((a, b) => a + b.n, 0)), l: 'Fish caught' }, { n: fmtKm(this.d.nightKm), l: 'Sailed after dark' }];
      out.vyFav = fav && T ? 'Favourite boat: ' + T.label + ' · ' + fmtKm(fav[1]) : 'Sail a little to find your favourite boat.';
      out.vyHasVoyages = this.d.log.length > 0; out.vyVoyages = this.d.log.slice(0, 8).map(v => ({ to: v.n, sub: fmtKm(v.km) + ' · ' + ago(v.at) + (H.typeOf(v.b) ? ' · ' + H.typeOf(v.b).label : '') }));
      const rank = { Common: 0, Uncommon: 1, Rare: 2, 'Very rare': 3, Legendary: 4 }; out.vyTop = finds.slice().sort((a, b) => (rank[b.rar] || 0) - (rank[a.rar] || 0) || b.at - a.at).slice(0, 3).map(f => ({ name: (window.SailoOcean && window.SailoOcean.KINDS[f.kind] ? window.SailoOcean.KINDS[f.kind].name : f.kind), sub: f.rar + (f.region ? ' · ' + f.region : '') })); out.vyHasTop = out.vyTop.length > 0;
      out.vyCatch = Object.entries(FISH).filter(([, f]) => !f.ev || this.d.catch[f.ev === 'lantern' ? 'lanternfish' : ''] || (ev && ev.id === f.ev)).map(([id, f]) => { const c = this.d.catch[id]; return { name: c ? f.name : '???', sub: c ? (c.n > 1 ? c.n + ' caught · ' : '') + 'best ' + c.best + ' kg' : f.rar, col: c ? f.col : 'rgba(255,255,255,.12)', op: c ? 1 : .55, rarCol: FCOL[f.rar] }; }); out.vyCatchCount = Object.keys(this.d.catch).length + ' of ' + Object.keys(FISH).length + ' species'; }
    // leaderboards
    if (out.vyOpen && tab === 'leaders') { const kind = u.lbKind || 'km', scope = u.lbScope || 'all', unit = kind === 'km' ? ' km' : kind === 'finds' ? '' : ' days', myName = s.me.name || 'You'; const rows = []; const lb = this.lb[kind];
      rows.push({ name: myName, v: this.myScore(kind), me: true, color: s.me.color });
      if (scope === 'all' && lb && lb.rows) for (const r of lb.rows) { if (r.me) { rows[0].v = Math.max(rows[0].v, +r.value || 0); continue; } rows.push({ name: r.name || 'Sailor', v: +r.value || 0, color: '#9fd8e6' }); }
      for (const p of H.people()) { if (s.blocked[p.id]) continue; if (scope === 'friends' && s.friends[p.id] !== 'friends') continue; rows.push({ name: p.name, v: this.demoScore(p.id, kind), color: p.color, demo: true }); }
      rows.sort((a, b) => b.v - a.v); out.vyLb = rows.slice(0, 25).map((r, i) => ({ rank: String(i + 1), name: r.name + (r.me ? ' (you)' : ''), initials: ini(r.name), color: r.color, val: (kind === 'km' ? fmtKm(r.v).replace(' km', '') : String(Math.round(r.v))) + unit, bg: r.me ? 'rgba(255,122,89,.14)' : 'transparent', demo: !!r.demo, weight: r.me ? 600 : 400 }));
      const mine = rows.findIndex(r => r.me); if (mine >= 25) out.vyLb.push({ rank: String(mine + 1), name: myName + ' (you)', initials: ini(myName), color: s.me.color, val: (kind === 'km' ? fmtKm(rows[mine].v).replace(' km', '') : String(Math.round(rows[mine].v))) + unit, bg: 'rgba(255,122,89,.14)', demo: false, weight: 600 });
      out.vyLbKinds = [['km', 'Distance'], ['finds', 'Finds'], ['streak', 'Best streak']].map(([k, l]) => ({ label: l, ...chip(kind === k), pick: () => { this.setUI({ lbKind: k }); this.loadBoard(k); } })); out.vyLbScopes = [['all', 'Everyone'], ['friends', 'Friends']].map(([k, l]) => ({ label: l, ...chip(scope === k), pick: () => this.setUI({ lbScope: k }) }));
      out.vyLbNote = kind === 'streak' ? 'Best daily streak, all time.' : 'This week, resets on Monday. ' + (H.isReal() ? 'Sailors marked demo are simulated.' : 'Demo mode: other sailors are simulated.'); }
    // port and dock card
    const pid = u.port || (u.dock && u.dock.id), P = pid && (this.ports.find(p => p.id === pid) || PORT_BY[pid]);
    if (P && me && !out.vyOpen && !this.steer) { const st = this.d.stamps[P.id], docked = !!(u.dock && u.dock.id === P.id), dist = P.x != null ? km(Math.hypot(P.x - me.x, P.y - me.y)) : 0, ppl = H.people();
      Object.assign(out, { vyCard: true, vyCardName: P.name, vyCardSub: REGIONS[P.reg] + (docked ? ' · docked' : ' · ' + fmtKm(dist) + ' away'), vyCardStamp: st ? 'Stamped' + (st.n > 1 ? ' · ' + st.n + ' visits' : '') + ' · first ' + new Date(st.first).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No stamp yet', vyCardStamped: !!st, vyCardRing: st ? '#5fd4c4' : 'rgba(255,255,255,.3)', vyCardFresh: docked && !!u.dock.fresh, vyCardDocked: docked, vyCardCanGo: !docked,
        vyCardGo: () => this.sailToPort(P.id), vyCardClose: () => this.setUI({ port: null, dock: null }), vyCardPassport: () => this.open('passport'), vyCardNote: () => this.setUI({ compose: true, draft: '', cErr: '' }),
        vyCardSailors: docked ? (u.dock.sailors || []).map(id => { const p = ppl.find(x => x.id === id); return p ? { name: p.name.split(' ')[0], initials: ini(p.name), color: p.color, pick: () => H.select(id) } : null; }).filter(Boolean) : [], vyCardHasSailors: docked && (u.dock.sailors || []).length > 0, vyCardStampRot: ((hash(P.id) % 30) - 15) + 'deg' }); }
    else out.vyCard = false;
    // fishing
    const f = u.fish || { ph: 'idle' }, canF = this.canFish() && !out.vyOpen && !s.sel && !s.fleetOpen && !s.journalOpen; const FI = f.id && FISH[f.id];
    Object.assign(out, { vyCanFish: canF && f.ph === 'idle', vyFishing: f.ph !== 'idle', vyFishWait: f.ph === 'wait', vyFishBite: f.ph === 'bite', vyFishRes: f.ph === 'result', vyFishTap: () => this.fishTap(), vyFishStop: () => { this.bob = null; this.setUI({ fish: { ph: 'idle' } }); },
      vyFishMiss: f.ph === 'result' && !!f.miss, vyFishGot: f.ph === 'result' && !!FI, vyFishMissText: f.miss || '', vyFishName: FI ? FI.name : '', vyFishRar: FI ? FI.rar : '', vyFishRarCol: FI ? FCOL[FI.rar] : '#fff', vyFishCol: FI ? FI.col : '#fff', vyFishKg: FI ? f.kg + ' kg' : '', vyFishNew: !!f.isNew, vyFishBest: !!f.best, vyFishZone: me && H.marine ? { trop: 'Tropical waters', sub: 'Subtropical waters', temp: 'Temperate waters', cold: 'Cold waters' }[H.marine.zoneAt(me.x, me.y).z] : '' });
    // emote wheel
    const R = 92; out.vyWheel = !!u.wheel; out.vyWheelToggle = () => this.setUI({ wheel: !u.wheel }); out.vyEmotes = EMOTES.map((e, i) => { const a = -Math.PI / 2 + i / EMOTES.length * TAU; return { icon: e.icon, label: e.label, send: () => this.emote(e.k), left: (Math.cos(a) * R + 120 - 26) + 'px', top: (Math.sin(a) * R + 120 - 26) + 'px' }; });
    // notes
    const n = u.note && this.notes.find(x => x.id === u.note);
    Object.assign(out, { vyNote: !!n, vyNoteBody: n ? n.body : '', vyNoteBy: n ? (n.mine ? 'You' : n.author) + (n.demo ? ' · demo traveller' : '') : '', vyNoteAge: n ? ago(n.created || Date.now()) : '', vyNoteLikes: n ? String(n.likes || 0) : '0', vyNoteLikeFill: n && n.liked ? '#ff7a59' : 'none', vyNoteLike: () => n && this.likeNote(n), vyNoteReport: () => n && this.reportNote(n), vyNoteCanReport: !!n && !n.mine, vyNoteClose: () => this.setUI({ note: null }),
      vyCompose: !!u.compose, vyComposeOpen: () => H.setState(st => ({ vyUI: { ...(st.vyUI || {}), compose: true, draft: '', cErr: '' }, meOpen: false })), vyComposeClose: () => this.setUI({ compose: false }), vyDraft: u.draft || '', vyOnDraft: e => this.setUI({ draft: e.target.value.slice(0, 140) }), vyCount: (u.draft || '').length + ' / 140', vyPost: e => { e && e.preventDefault && e.preventDefault(); this.postNote(); }, vyPostLabel: u.cBusy ? 'Leaving…' : 'Leave note here', vyCErr: u.cErr || '', vyHasCErr: !!u.cErr });
    // return gift
    const rt = u.ret; Object.assign(out, { vyRet: !!rt && !s.authView, vyRetTitle: rt ? (rt.hrs > 48 ? 'Welcome back, captain' : 'While you were away') : '', vyRetSub: rt ? 'You were gone for ' + (rt.hrs > 48 ? Math.round(rt.hrs / 24) + ' days' : Math.round(rt.hrs) + ' hours') + '.' : '', vyRetLines: rt ? rt.lines : [], vyRetGift: rt ? matStr(rt.gift) : '', vyRetCollect: () => this.collectGift() });
    // first-voyage guide
    const tu = this.d.tut || { s: {} }, steps = [['course', 'Set a course'], ['arrive', 'Reach your destination'], ['find', 'Open a discovery'], ['hail', 'Hail a sailor or send an emote']];
    Object.assign(out, { vyTut: !this.steer && !tu.done && !tu.off && s.onboarded && s.phase === 'free' && !s.authView && !s.loggedOut && !out.vyOpen && !s.sel && !s.photo && !out.vyCard, vyTutSteps: steps.map(([k, l]) => ({ label: l, mark: tu.s[k] ? '✓' : '', bg: tu.s[k] ? '#5fd4c4' : 'transparent', border: tu.s[k] ? '#5fd4c4' : 'rgba(255,255,255,.35)', op: tu.s[k] ? .6 : 1 })), vyTutCount: steps.filter(([k]) => tu.s[k]).length + ' / 4', vyTutSkip: () => { this.d.tut.off = 1; this.touch(); this.flush(); } });
    // own-boat menu
    const anch = this.canFish();
    out.vyBoatMenu = !!u.boatMenu && !out.vyOpen && !s.photo && !this.steer; out.boatMenuRef = H.boatMenuRef;
    out.vyBmItems = [['edit', '✏️', 'Edit boat', () => H.editBoatNow()], ['emote', '😊', 'Emotes', () => this.setUI({ boatMenu: false, wheel: true })], ['fish', '🎣', anch ? 'Fish' : 'Fish · anchor first', () => { this.setUI({ boatMenu: false }); this.fishTap(); }], ['desk', '🧭', "Captain's desk", () => { this.setUI({ boatMenu: false }); this.open(); }], ['me', '👤', 'My profile', () => this.setUI({ boatMenu: false, meProfile: true })]].map(([k, icon, label, act], i, A) => { const a = (-54 + i * 360 / A.length) * Math.PI / 180, R = 104; return { icon, label, act, left: (Math.cos(a) * R - 27) + 'px', top: (Math.sin(a) * R * .92 - 27 - 8) + 'px', op: k === 'fish' && !anch ? .55 : 1, badge: k === 'desk' && claimable ? String(claimable) : '', hasBadge: k === 'desk' && claimable > 0, delay: (i * 40) + 'ms' }; });
    out.vyBoatMenuClose = () => this.setUI({ boatMenu: false });
    // steering
    out.vySteer = !!this.steer && !s.photo; out.joyRef = H.joyRef; out.vySteerName = this.steer ? this.steer.name : ''; out.vySteerEnd = () => this.endSteer();
    // my profile
    if (u.meProfile) { const prof = (s.auth && s.auth.profile) || {}, O = H.ocean, fl = s.fleet || {}, fav = Object.entries(this.d.boatKm).sort((a, b) => b[1] - a[1])[0], FT = fav && H.typeOf(fav[0]), nm = s.me.name || prof.display_name || 'Sailor';
      Object.assign(out, { vyMe: !s.authView, vyMeName: nm, vyMeHandle: prof.username ? '@' + prof.username : 'Your profile', vyMeBio: prof.bio || 'No bio yet. Add one in account settings.', vyMeInit: ini(nm), vyMeColor: s.me.color, vyMeHasPhoto: !!s.me.photo, vyMeNoPhoto: !s.me.photo, vyMePhoto: s.me.photo ? `url("${s.me.photo}")` : 'none', vyMeBoat: (H.typeOf(s.me.type) || {}).label || 'Boat', vyMeBoatImg: H.myThumb ? H.myThumb() : '', vyMeStreak: (fl.streak || 0) + '-day streak · best ' + (fl.best || 0) + ' · ' + (fl.owned || []).length + ' boats',
        vyMeStats: [{ n: fmtKm(this.d.km), l: 'Sailed' }, { n: String(fl.voyages || this.d.log.length), l: 'Voyages' }, { n: String(Object.keys(this.d.stamps).length), l: 'Ports stamped' }, { n: String(O ? Object.keys(O.journal.finds).length : 0), l: 'Discoveries' }, { n: String(Object.values(this.d.catch).reduce((a, b) => a + b.n, 0)), l: 'Fish caught' }, { n: String(Object.values(this.d.upg).reduce((a, b) => a + b, 0)), l: 'Upgrades' }],
        vyMeFav: fav && FT ? 'Favourite boat: ' + FT.label + ' · ' + fmtKm(fav[1]) : '', vyMeHasFav: !!(fav && FT), vyMeVoy: this.d.log.slice(0, 4).map(v => ({ to: v.n, sub: fmtKm(v.km) + ' · ' + ago(v.at) })), vyMeHasVoy: this.d.log.length > 0,
        vyMeClose: () => this.setUI({ meProfile: false }), vyMeEdit: () => { this.setUI({ meProfile: false }); H.editBoatNow(); }, vyMeSettings: () => { this.setUI({ meProfile: false }); H.openSettings(); }, vyMeLog: () => { this.setUI({ meProfile: false }); this.open('log'); } }); }
    else out.vyMe = false;
    // HUD
    const wl = this.windLine(); Object.assign(out, { vyWindLine: wl, vyHasWind: !!wl, vyFlo: !!this.flo, vyFloName: this.flo ? 'Flotilla with ' + H.personName(this.flo.id) : '', vyFloLeave: () => this.leaveFlo(), vyEvChip: ev ? ev.icon + ' ' + ev.name : '', vyHasEv: !!ev, vyTopBtn: !s.mobile, vyStackBtn: !!s.mobile });
    // settings
    const gfx = s.gfx || 'Auto', nt = s.notif || {}; Object.assign(out, { vyGfxRows: ['Auto', 'High', 'Low'].map(g => ({ name: g, ...chip(gfx === g), pick: () => { H.setState({ gfx: g }); H.applyGfx && H.applyGfx(g); } })), vyGfxSub: gfx === 'Auto' ? 'Adjusts to keep the sea smooth' + (H.q ? ' · currently ' + ['high', 'medium', 'low'][H.q] : '') : gfx === 'Low' ? 'Fewer effects for older phones' : 'All effects, sharpest picture', vyRemBg: nt.device ? '#ff7a59' : 'rgba(255,255,255,.18)', vyRemKnob: nt.device ? '18px' : '2px', vyRemToggle: () => this.toggleReminders(), vyRemSub: typeof Notification === 'undefined' ? "Not supported in this browser" : Notification.permission === 'denied' ? 'Blocked in browser settings' : 'An evening nudge when your streak is at risk' });
    return out;
  };

  window.SailoVoyage = Voyage;
})();
