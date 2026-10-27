# Handoff: Sailo — Living Ocean, Fleet, Marine Life & Accounts

## Overview
Sailo is a social sailing world: every person is a boat on a real-world map. Users sign up, set up a profile, receive their first boat (The Drifter), pick a home port and sail. They meet nearby sailors, make friends and chat, build a daily voyage streak that unlocks 24 boats, and watch underwater marine life swim beneath them. The weather and time of day are live.

## About the Design Files
The files in this bundle are **design references created in HTML**. They are a working prototype that shows the intended look and behaviour, not production code to ship directly. Your task is to **recreate this design in the target codebase** (e.g. React / React Native / Next.js + Supabase) using its established patterns. If there is no codebase yet, choose a fitting stack. Recommended: React + a WebGL map layer (Mapbox GL) + a canvas or WebGL ocean renderer.

The `supabase/` folder is different: it is **real backend code**, intended to be used as-is (after review).

## Fidelity
**High-fidelity.** Colours, type, spacing, copy and interactions are final. Recreate them pixel-for-pixel.

## Files
- `Living Ocean.dc.html`: the whole prototype (template + logic in one file). Open it in a browser next to `support.js`.
  - Template (top of file): every screen and panel, with inline styles. Those inline styles are the spec.
  - Logic class (bottom `<script>`): world, rendering, boats, fleet, marine engine (`class Marine`), auth adapters (`demoAuth`, `realAuth`) and onboarding.
- `support.js`: the prototype's runtime. Not needed in production.
- `supabase/schema.sql`: tables, RLS, triggers, RPCs, storage bucket. Idempotent.
- `supabase/functions/username-login/index.ts`: username login without exposing email addresses to the client.
- `supabase/functions/delete-account/index.ts`: real account deletion (storage + auth user, cascading rows).

---

## Design Tokens
**Colours**
- Ocean (map water) `#1d6b86`. Land base `#3a8f8a` / `#4a9f8f`. Parks `#4f9e7c`. Buildings `#6fb3a8`.
- Shallows rings (inner→outer): `#8cefe0`, `#4fd6d2`, `#33bfc6`, `#2a9fb4`.
- Glass panel `rgba(10,27,36,.86–.97)` with `backdrop-filter: blur(18px)` and border `1px solid rgba(255,255,255,.12–.14)`.
- Ink `#f4efe6`. Muted ink: `rgba(244,239,230,.66–.82)`.
- Primary (coral) `#ff7a59`, hover `#ff8d70`, text on primary `#1b0f0a`. Link/accent coral `#ff9d80`.
- Turquoise accent `#7fd3df` / `#9fe3ec`. Success `#7fe0c8`. Destructive `#e8604c`.
- Sand `#f1d496` (top) / `#d2a865` (rim) / `#fae6b8` (dune). Palm greens `#2f8b3d`→`#62c45a`. Rock `#7f98a1`→`#e1eaec`.

**Type**
- Display: *Instrument Serif* 400 (titles 30–32px; hero clamp(46px, 8vw, 96px), line-height .95).
- UI: *Geist* 400/500/600 (body 13.5–15px).
- Data: *Geist Mono* 11–13px.
- Kickers: 10.5px, letter-spacing .14em, uppercase.

**Radii:** chips 999px · inputs/buttons 10–14px · cards 16–18px · panels 22–24px.
**Shadows:** panels `0 20px 60px rgba(3,14,20,.45)`; modals `0 30px 80px rgba(3,14,20,.55–.6)`.
**Buttons:** primary 50px tall (radius 14); ghost 48px with a `rgba(255,255,255,.18)` border; press state `transform: scale(.97)` over .15s.
**Motion:** `loPop` (translateY 10px + scale .96 → none, .2–.35s), `loUp` (translateY 24px, .35–.6s, cubic-bezier(.2,.8,.2,1)), `loFade`. All are disabled under `prefers-reduced-motion`.

---

## Screens / Views

### 1. Restoring splash (`showRestoring`)
Shown first while an existing session is checked. Prevents the login screen flashing. Centred logo, plus a pulsing dot and the text "Getting your boat ready…".

### 2. Welcome (`isIntro`)
- Full-bleed live ocean behind it: the camera follows the user's boat at zoom ~1.6, with real clouds, sun and waves. A gradient darkens toward the bottom.
- Bottom-left stack, max-width 720:
  - Logo (44px).
  - "Sail. Discover. Connect."
  - The paragraph.
  - **Get started** (coral pill, 52px).
  - **Log in** (glass pill).
  - Demo-traveller disclaimer.

### 3. Auth card (`showAuthCard`)
A centred 440px glass card over a blurred, dimmed ocean. It shows a "Demo mode" pill when no Supabase anon key is set. Views:
- **Sign up**
  - Fields: Full name, Username (with an `@` prefix and live availability: "Checking…", then "@name is available" in `#7fe0c8` or "That username is taken." in `#ff9d80`), Email, Password + Confirm (Show/Hide toggle).
  - Errors under each field, plus one form-level alert.
  - Buttons: "Create account", "or", "Continue with Google", "Already have an account? Log in".
- **Log in**: Email or username, Password, "Forgot password?", Log in, Google, "Don't have an account? Sign up".
- **Forgot password**: Email field + "Send reset link". The confirmation screen always reads: "If an account exists for this email, we'll send you a password reset link."
- **Verify email**: "We sent a verification link to {email}…". Buttons: "I've verified · continue", "Resend email" (60s countdown), "Use another email".
- **Reset password** (opened from the recovery link): New + Confirm, then "Update password".
- **Link problem** (expired/invalid link): "Request a new reset link", Log in, Sign up.
- **Onboarding 1/5 — Profile**:
  - Live preview card: avatar, display name, @username · The Drifter, bio.
  - Fields: Display name (max 40), Username, optional photo upload (square-cropped to 160px JPEG), optional bio (160, with counter).
  - "Continue". The same view serves as **Edit profile** from settings, with Cancel/Save buttons.
- **Onboarding 4/5 — Starting region**:
  - "Use my approximate location" (browser permission; area only).
  - Country search list, then optional state/region chips.
  - "Set sail from {state}, {country}".
- **Onboarding 5/5 — Welcome**: five numbered rows (Sail anywhere, Discover nearby boats, View profiles, Make friends, Grow your fleet), then "Enter Sailo".

### 4. Onboarding 2/5 — The Drifter (`isOnbBoat`)
- A bottom sheet (max 420) over the **live in-world boat**: the camera zooms to 2.4 and the user can drag to orbit and pinch to zoom.
- Content:
  - Title "The Drifter".
  - Sub-line "Wooden rowboat · Common · Unlocked".
  - Italic quote "Every great voyage begins with a small boat."
  - Description.
  - **Start my journey** button.
- The boat is auto-unlocked and equipped.

### 5. Onboarding 3/5 — Customise (existing customise sheet)
Name, hull type (Sloop / Brigantine / Galleon / Rowboat), hull colour, photo. The button reads "Continue".

### 6. World HUD (unchanged)
- Top-left: place/time pill, nav card, weather.
- Top-right:
  - Fleet pill: boat icon + streak number, plus a coral dot if no voyage has been made today.
  - Search, inbox, avatar menu. The menu has: Account settings, My Fleet, Edit boat, Replay intro, **Log out**, Leave the ocean.
- Bottom-right: zoom, camera and visibility controls.

### 7. Settings modal → Account section
- Avatar, display name, @username, email, and a Verified / Not verified badge.
- Buttons in a 2-column grid: Edit profile · Photo & username · Change password (email accounts only, inline form) · Privacy (opens the visibility panel) · Notifications (inline toggles: Friend requests, New messages, Streak reminders).
- Log out · Delete account.

### 8. Delete account modal
- Explains consequences.
- Confirmation: type your username, plus your password for email accounts (re-authentication).
- Buttons: "Keep my account" / "Delete my account" (`#e8604c`).

### 9. My Fleet panel
Right-side panel (400px; bottom sheet on mobile):
- Streak hero (52px serif number) and a 7-day dot strip.
- Status line ("Finish a voyage today to keep your N-day streak."), next unlock, and a 2-column grid of 24 boats.
- Each tile shows glyph, name, hull · rarity, and Launch / Sailing / a locked progress bar.

### 10. Settings → Ocean experience · Marine life
On/off, Fish density (Low/Medium/High), Underwater visibility (Realistic/Enhanced), Animation quality (Low/Medium/High). Visual-only, per user.

---

## Interactions & Behaviour

### Auth state machine (`authView`)
`restoring` → `welcome` | `signup` | `login` | `forgot` → `forgotSent` | `verify` | `reset` | `expired` → `onbProfile` → `onbBoat` → `onbCustomize` → `onbRegion` → `onbWelcome` → `null` (in world).

**On launch:**
1. `getSession()`.
2. If a session exists: load the profile, load the game state (`user_state` + `get_fleet()`) and restore the position/boat.
3. If `onboarding_completed` is false, resume onboarding at Profile.
4. Otherwise enter the world. If the user was mid-voyage, show "Continue journey?".

**Supabase events:**
- `PASSWORD_RECOVERY` opens Reset.
- `SIGNED_IN` (from an OAuth or email-link redirect) runs afterAuth.
- An unexpected `SIGNED_OUT` shows Welcome with "Your session ended."

**URL errors:** `error_code=otp_expired` (or similar) shows the Expired view. The URL is then cleaned with `history.replaceState`.

### Validation and security
- **Username**: `^[A-Za-z0-9._]{3,20}$`, case-insensitive unique (`citext`). A reserved list is enforced both client- and server-side, plus a light profanity filter on the client.
- **Password**: ≥ 8 characters, no composition rules. Correct `autocomplete` values: `username`, `email`, `new-password`, `current-password`.
- **Login errors are generic**: "That email or username and password don't match."
- **Client throttling**: after 5 failed logins, the form locks for 30s. Supabase's own rate limits still apply.
- **Buttons** are disabled while busy (labels change to "Logging in…", etc.).
- **Unverified users** cannot get past the Verify view.

### Streaks
A **finished voyage** (arriving at a destination) is the qualifying activity; logging in alone doesn't count. The server RPC `record_voyage(tz)` owns the date maths, has a 20s anti-spam window and unlocks boats. Unlocks are permanent even if the streak lapses.

### Logout
Ends the Supabase session. In live mode it also clears the local game cache, because the server holds the truth. Returns to Welcome. Server data is kept.

### Delete account
Re-authenticates, then calls the `delete-account` edge function. That function removes avatar files and deletes the auth user, and all rows cascade.

### Marine life
Implemented in `class Marine`:
- 20 species chosen by latitude zone + habitat; schools follow a leader-and-slot model.
- Visibility depends on depth, weather, sun and view angle; silhouettes are distorted by waves; seabed shadows appear in shallow water.
- Boat reactions are per species. Detail drops with zoom (LOD) and there is a fish-count budget.

For production, port this to GPU-instanced sprites/meshes in the ocean shader pass.

---

## State to persist (`user_state.data`)
`me` (name, hull type, colour, boat id, photo), `loc` (home port), `pos` `[x, y, heading]` in world units, `dest`, `at`, `vis`, `disc`, social cache (`likes`, `friends`, `convos`, `unread`, `blocked`), `marine` prefs, `notif` prefs.

Boats and streaks are **not** client-writable. They live in `user_boats` / `user_streaks` and change only through RPCs.

---

## Backend setup (Supabase project `dfytxscebupuqwehsojc`)
1. In the SQL editor, run `supabase/schema.sql`.
2. Auth → Providers:
   - Enable Email (with **Confirm email** on).
   - Enable Google (client ID/secret from Google Cloud; add the Supabase callback URL there).
3. Auth → URL Configuration: add your app origin(s) to **Site URL** and **Redirect URLs**.
4. Deploy the edge functions:
   - `supabase functions deploy username-login --no-verify-jwt`
   - `supabase functions deploy delete-account`
5. In the prototype, paste the project's **anon (public) key** into the `supabaseAnonKey` tweak. **Never use the service-role key on the client.** Without a key, the prototype runs in clearly labelled **Demo mode**: accounts are stored on the device only, and the email-link steps are stand-in buttons.

### Known limits of the prototype (fix in production)
- **Session storage:** supabase-js keeps the session in `localStorage` on the web. Prefer httpOnly cookie sessions via a server (e.g. `@supabase/ssr`) or SecureStore/Keychain on mobile.
- **Demo travellers:** other boats, friends and messages are demo data mirrored into `user_state`. Real multi-user presence and messaging need their own tables plus Realtime channels with RLS.
- **Apple Sign-In:** hidden, because it isn't configured.
- **Not yet verified:** OAuth, email delivery and account deletion have only been built, not tested against the live project. Verify each in your environment before claiming they work.

## Assets
There are no raster assets; everything is drawn on a canvas or with inline SVG icons. Fonts come from Google Fonts. The map is Mapbox GL v3.8.0; put your own token in `config.js` (see `config.example.js`). Weather comes from Open-Meteo (no key needed).

---

## Running this repo
- Copy `config.example.js` to `config.js` and put your Mapbox public token in it. `config.js` is git-ignored, so the token never reaches GitHub. Without it the map tiles don't load (the ocean, boats and screens still work).
- `npm start` serves the app at http://localhost:3000 (`index.html` opens `Living Ocean.dc.html`, keeping any `?query`/`#hash` so Supabase auth redirects still work).
- Any static host works too: publish the repo root, no build step. Create `config.js` on the host as part of the deploy.
- **Vercel:** import the repo with Framework Preset "Other" and no build command. Set `MAPBOX_TOKEN` (and optionally `SUPABASE_ANON_KEY`) in Project Settings → Environment Variables, then redeploy. `api/config.js` serves them as `/config.js` (see `vercel.json`).
- With `SUPABASE_ANON_KEY` set, the app leaves demo mode and uses Supabase, so run the backend setup above first, and add your Vercel domain to Supabase Auth → URL Configuration.
- The browser needs to reach unpkg.com, cdn.jsdelivr.net, api.mapbox.com, fonts.googleapis.com and api.open-meteo.com.

## Additions since the handoff
- **Sea:** sun glitter and moon path, rolling swell bands, caustics in the shallows, shore foam that washes in and out, wind-driven whitecaps, glowing wakes and fish at night.
- **Boats:** pennants that stream with the wind, red/green side lights and lanterns at night, rarity looks (Rare sail stripe, Epic gold trim, Legendary glow and golden wake), boat names on the stern when zoomed in, rocking at anchor, sails that luff head-to-wind, hull styles (Classic, Painted, Two-tone, Striped) with a trim colour.
- **Animation:** arrival celebration (splash, bell, rings, "+1 voyage", fleet pill glow), full-screen unlock reveal, drop-in destination buoy, launch splash, rolling streak numbers.
- **Fun:** hail nearby boats (wave, anchor, dolphin, horn), messages in bottles, photo mode with postcard export, whale breaches, dolphins racing the bow, gulls following you out of port, fish scattering when you tap the water.
- **Sound:** sound effects and vibration (on by default, toggle in settings); ocean sound now adds lapping waves and creaks.
- **Colour:** live time and weather by default, a golden-hour welcome screen, warmer dawn and dusk, rarity colours in My Fleet.
- **Messages in bottles** use the `bottles` and `bottle_reports` tables plus the `random_bottles` RPC (bottom of `supabase/schema.sql`). Without them the app falls back to demo notes.
- Add `?debug` to the URL to expose the app as `window.__sailo` for testing.

## Ocean discoveries (`ocean-objects.js`)
A separate module (`window.SailoOcean`) that plugs into the main renderer and reuses its waves, weather, currents, habitat data and camera.
- **37 kinds** in three groups: floating debris (crates, barrels, driftwood, planks, nets, rope, buoys, lifebuoys, suitcases, masts, containers, dinghies, lanterns, treasure chests), shipwrecks (rowboat to a giant mysterious wreck) and seabed finds (anchors, cannons, amphorae, a sunken aircraft, ruins…).
- **Shared world:** the ocean is split into ~3.5 km cells in global coordinates; each cell seeds its own objects, so every sailor sees the same wreck at the same place with the same id. Wrecks and seabed finds never move; surface debris drifts on a shared clock and reshuffles every 4 hours. Spawning follows habitat (reef, coast, open, deep) and climate zone, and skips land.
- **Physics:** floating objects sample the wave field at several points for heave, pitch and roll, with mass-specific damping; barrels and logs roll; light objects drift more with the wind; rain and storms add splashes; storms wash up temporary debris; snow settles on flat tops; fog hides distant objects.
- **Underwater:** wrecks and finds are drawn beneath the surface with depth-based visibility (cloud, rain, storm, chop), water distortion, sediment, algae and coral; masts and prows of shallow wrecks break the surface; small fish gather around wrecks.
- **Discovery:** nearby finds get a subtle ring and label; tap to inspect (spinning 3D preview), then Open / Collect / Explore / Salvage, mark the location, or continue sailing. Everything lands in the **Ocean Journal** (menu → Ocean Journal) with stats, marked locations, collection and every kind as a tile.
- **Rewards:** picked on the server by `claim_find()` (bottom of `supabase/schema.sql`): one reward per object per sailor, treasure chests can only be claimed once worldwide (first sailor wins, synced over Realtime), and claims are rate-limited. Flag and sail rewards can be equipped under Edit boat → Treasure. In demo mode everything is stored on the device.

## Fleet designs
- Each of the 24 fleet boats has its own design in `DESIGNS` (Living Ocean.dc.html), covering length, speed, acceleration, turning, hull shape (`HULLS`), rig and signature details (outriggers, oars, funnels, gunports, lanterns and more). Fleet boats are registered as `b_<id>` types; the custom-boat picker still offers the four base types.
- Shadows follow the sun: they fall east to west through the day, lengthen at low sun, and fade under cloud, fog, rain and at night.
- Steam boats (Monsoon, Aurora, Tempest) give off funnel smoke that billows, lightens and drifts with the wind.
- My Fleet tiles show a live render of each boat with speed and size ratings. Locked boats show as dark silhouettes.
- Older saves that stored a fleet boat with a base type move onto that boat's design on load (`migMe`).

## Voyages (`sailo-voyage.js`)
The voyage module adds the play-and-reward loop on top of the sea. The page calls into it through `window.SailoVoyage`.
- **Ports and passport.** 179 real harbour cities are ports, each with a pier, breakwater and lighthouse. Arriving within about 2 km docks you, stamps your passport and moors a few sailors beside you. Stamping 10 ports unlocks the Navigator flag. Ports also appear in search.
- **Daily quests.** Three quests each day, picked from the day and your account, reward materials. Finishing all three opens the captain's chest.
- **Materials and the shipwright.** Timber, rope, canvas and nails from finds and quests pay for four upgrades: racing sails (speed), storm hull (less storm slowdown and drift), night lantern (spot finds farther after dark) and fishing gear.
- **Weather that matters.** A tailwind speeds you up and a headwind slows you. Storms slow you and push you sideways unless your hull is upgraded. The nav card shows the effect while you sail.
- **Seasonal events.** Lantern Festival (Oct 15 – Nov 15), Winter Lights (Dec 10 – Jan 25), Spring Regatta (Mar 20 – Apr 25) and Monsoon Season (Jun 15 – Aug 20). Each has its own quest, event tokens and a limited sail or flag.
- **Fishing.** While anchored, cast, wait for the float to dip, then strike. The catch depends on the climate zone, time of day and your gear, and is recorded in the catch log.
- **Social.** Sail in a flotilla with a friend, leave notes at sea for others to read, see weekly leaderboards for distance, finds and best streak, and send emotes from the emote wheel. Profiles show a sea log.
- **World.** Lighthouse beams at night, whales that surface beside slow boats, dolphins that bow-ride more often, festival lanterns, aurora and shooting stars on clear nights.
- **Your boat menu.** Tap your own boat for a ring of actions: Edit boat, Emotes, Fish (when anchored), Captain's desk and My profile.
- **Steering to ports.** Choosing a port (Passport, a port card or search) draws a dotted route; steer with the on-screen joystick (or arrow keys / WASD). The boat slides along coastlines and docks when it reaches the port.
- **Guide and return.** A first-voyage checklist (with a guaranteed crate to find), a "while you were away" gift after six hours or more, and optional evening streak reminders on the device.
- **Technical.** Graphics setting (Auto, High, Low; Auto starts lower on low-memory devices), a service worker (`sw.js`) that caches the app shell so the sea appears immediately and the app opens offline, and client error reports stored in `client_errors` (plus Sentry if `SENTRY_DSN` is set in Vercel).

Backend (in `supabase/schema.sql`, applied to `dfytxscebupuqwehsojc`): `sea_notes`, `note_likes` and `note_reports` (read through `nearby_notes()`, liked through `toggle_note_like()`, hidden after 3 reports, 5 notes per hour); `sail_weeks` with `add_distance()` (client-reported, capped at 5,000 km per call and 200,000 km per week) and `leaderboard()`; `client_errors` (insert-only, rate-limited). Quests, stamps, upgrades and the catch log are stored with the rest of the game state in `user_state`.

Other sailors in the world are demo travellers. Flotillas, moored sailors and leaderboard entries marked "demo" use them.

## 3D boat models (`sailo-models.js`)
- The Tugboat (`models/tugboat.glb`, Rare, unlocks at 10 voyages) Tide Runner (`models/sailboat.glb`, a racing sloop) and Saffron (`models/gaff-cutter.glb`, a gaff cutter) are real glTF models rendered with three.js 0.160 (loaded from unpkg through the import map in the page head, only when a model boat is first needed).
- Each frame the model is drawn into an offscreen WebGL canvas using the game's own oblique projection (heading, camera rotation and tilt, bob, pitch and roll), clipped at sea level, and copied into the sea canvas. The model's 200 parts are merged into one mesh per paint colour.
- The funnel position feeds the existing smoke; wake, shadow, night lights, fleet thumbnails and the unlock reveal work as for other boats. Until the model loads, a 2D stand-in tug is drawn.
- To add another model: drop the `.glb` in `models/`, add an entry to `MODELS` in `sailo-models.js` (bow, stern, funnel and waterline node names), add a `DESIGNS` entry with `model:'<id>'`, a `FLEET` entry and a `boat_catalog` row.
