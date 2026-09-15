# Gyro Golf World Tour

Gyro Golf World Tour is a browser-based 3D golf game with phyphox motion controls, mouse fallback controls, generated courses, Island Hopper, Tour Career, room-code online multiplayer, cosmetic animal mounts, and arcade party modes.

## Buffered Controller Fix 12

- Adds the bundled `public/gyro-golf-motion-controller.phyphox` v2 experiment with 100 Hz request-mode sensors and ten-second quaternion/acceleration buffers.
- Corrects the game's batch capability detection. A normal empty threshold response no longer permanently downgrades the connection to one-sample polling.
- Confirms a true incompatibility with a separate latest-value probe before using compatibility mode.
- Processes up to 64 recovered samples after a Wi-Fi delay, preserving the measured backswing, downswing, and impact instead of relying on visual prediction.
- Aborts a stalled live sensor request after 650 ms so one hung browser request cannot freeze the entire controller loop for five seconds.
- The hosted settings panel provides both the updated controller and the phone-compatible local game. The local game can still use Render for online rooms.

## Final Modes Update

- **Power-Up Tour** works locally and online. Three Par 8 Grand Prix holes use airborne item gates for Turbo, Super Bounce, Shield, Rival Storm, and Sticky Turf effects. Hosted effects are resolved by the room server before the next turn.
- **Long Haul Championship** works locally and online with a stable Par 6, 7, and 8 rotation built from validated wide routes.
- **Coin Collect** now uses alternating three-coin gates and temporary left/right airborne steering controls.
- Narrow displays keep the mouse-shot panel beside the map and caddie rail, while the wind HUD and world streaks are more visible.
- Controller polling and swing recognition remain on Buffered Controller Fix 12 and were not changed by this modes update.

## Controller Fix 11

- Keeps Fix 10's proven dual-path phyphox polling and makes the rendered club track irregular 70–200 ms phone packets with faster, bounded visual prediction. Shot detection, contact, power, and trajectory physics still use measured samples only.
- Fixes online Next Hole using local navigation while the room was in `hole-complete`; every browser now waits for and loads the server-authoritative hole index, with room-state recovery if a client missed the advance event.
- Rebuilds Coin Collect as five one-shot driving-range stages with three clean flight lanes. Gold coins score 1 point and larger red bonus coins score 3.
- Makes physical wind coupling roughly 70% stronger and increases airborne wind streak readability while keeping preview and live-ball physics matched.

## Controller Fix 10

- Fixes the single-player regression where custom phyphox buffers connected, produced one orientation, then returned empty threshold reads until the game falsely disconnected the phone.
- Uses a dual polling path: timestamped batch retrieval when the experiment supports it and immediate latest-value compatibility polling when it does not.
- Requests the phyphox timestamp reference before its paired quaternion buffers, matching the documented remote-interface order.
- The stale-phone watchdog now receives fresh compatibility samples instead of kicking a working controller to mouse mode.

## Online Fix 9

- Phyphox polling processes every new timestamped phone sample when supported, while Controller Fix 10 automatically preserves the proven latest-value path for custom single-value experiments.
- Chrome's Local Network Access permission is requested explicitly from the hosted HTTPS game; the downloadable local copy remains available as a fallback.
- Same-Wi-Fi live view sends direct snapshots at roughly 40 Hz, with a roughly 20-25 Hz Render relay and short visual prediction to remove spectator stutter.
- Character appearance and horse, dragon, or turtle mounts now synchronize for every online player.
- Joining a room hides local-only game modes and leaves only Stroke Play, Island Hopper, and Party Wheel visible.
- Cherry Blossom, Volcanic, and Aurora Night expand the designer to eight strongly differentiated world themes without adding collision meshes or swing-loop work.

## Party Pack 2

- Ride a **horse**, **dragon**, or **giant turtle** without changing swing detection, club collision, or ball physics.
- Give every player's mount its own color in **Customize Character**.
- Play **Moon Golf**, **Mega Cup Mayhem**, and **Bounce Blitz** as local party modes.
- Standard Stroke Play and the online room system retain their established physics and controller behavior.
- **Target Golf** now removes cup scoring and uses three separate Gold, Silver, and Blue bullseyes.
- **Coin Collect** gives every player five range shots through aligned airborne lanes, with 1-point gold and 3-point red bonus coins.
- **Wild Conditions** now uses major rule changes including hurricane crosswinds, ice fairways, high altitude, heavy gravity, glass greens, and sticky turf.
- **Party Wheel** works in online multiplayer and deterministically chooses a new map/rule for every hole.
- Moon Golf replaces its trees with a lightweight instanced field of floating lunar rocks.
- Three validated random-direction architectures bring the total to 43.

### Control Fix 1

- Corrects a high-DPI resize loop that could make phyphox club movement appear to run at only a few frames per second.
- Gives the phone/club rig render priority while the ball is at address and limits simulated trajectory rebuilds to 10 Hz during a swing.
- Makes Mega Cup a visible 5.6× opening, gives Bounce Blitz a dedicated seven-bounce reaction, and gives Moon Golf a complete lunar sky and course palette.

### Control Fix 2

- Fixes the startup exception that left only the interface and blue background visible.
- Keeps the Moon Golf flag inside the complete hole-layout scope so regular, range, and lunar holes all finish scene initialization.

### Phyphox Priority

- Suspends scenery traversal, minimap redraw, mount idle, optional details, water sparkle, and shadow refresh whenever a connected phone is waiting or swinging.
- Keeps controller polling at its established 25 ms target and limits trajectory simulation to 120 ms while the phone has priority.
- Coin and Party systems are generated only at hole load; no wheel or coin mesh allocation runs inside the swing loop.

## Deploy on Render

1. Upload every file in this project to the root of your GitHub repository.
2. In Render, choose **New + → Blueprint**.
3. Connect the `gyro-golf-world-tour` repository.
4. Render reads `render.yaml`; approve the free web service and deploy it.
5. Open the Render URL. One player creates a room and shares the six-character code. Other players join from their own computers.

No environment variables are required.

## Local test

```bash
npm install
npm start
```

Open `http://localhost:3000` in two browser windows to test a room.

## Using phyphox with the hosted game

Browsers may block an HTTPS page from directly reading a phone's `http://192.168...` phyphox address. If that happens:

1. Open **Settings → Phone & Calibration** on the hosted game.
2. Click **Connect Phone** and choose **Allow** when Chrome asks to access devices on the local network.
3. If the request remains blocked, click **Download Phone-Compatible Game** and open the downloaded HTML on each player's computer.
4. Create or join the room normally, then enter and connect that computer's own phyphox IP. The downloaded copy remembers the Render server URL automatically.

The game runs locally for smooth swing input while only turn results travel through Render. Mouse controls work directly on the hosted page without this extra step.

## Online play notes

- Online rooms support **Stroke Play**, **Island Hopper**, **Party Wheel**, **Power-Up Tour**, **Long Haul**, and **Kart Rally**.
- Only those supported cards remain visible after a room is created or joined.
- Moon Golf, Mega Cup, Bounce Blitz, Wild Conditions, Target Golf, and Coin Collect remain available for local pass-and-play.
- Each computer owns exactly one online player and connects only that player's phyphox phone. A persistent browser ID and room token prevent one computer from claiming another player's controller.
- In local pass-and-play, every player also has an isolated phone slot. Leaving a slot blank makes that player mouse-only; Player 1's phone is never shared automatically.
- The host starts the round and advances after everyone finishes each hole.
- Every spectator sees the active player's live club motion and ball flight. Only the active player's browser can detect impact or submit the shot.
- Online players retain their complete customized golfer and mount appearance on every computer.
- Every resting player ball remains visible on the course between turns.
- Courses are deterministic: every player receives the same seed and generated layout.
- Rooms are kept in memory. A free Render service can sleep or restart, which clears active rooms; create a new room if that happens.

## Kart Rally update

Upload BOTH `public/index.html` and `server.js` together and redeploy Render. All players must refresh onto this build. The title reads "Kart Rally 3D · Aim Fix".

- Kart Rally is a 3D golf-cart racer with chase cameras with a new large smooth circuit each race, three laps, turbo, shield, lightning, and oil.
- Offline: click Kart Rally, then Solo + AI or Local split-screen. Two human players share the screen with two AI racers.
- P1: WASD, Space for item, R rescue. P2: arrow keys, Enter for item, / rescue. Escape pauses offline races.
- Online: create/join the normal room (2–4 computers); host clicks Kart Rally. Everyone races simultaneously. Each computer uses WASD + Space. Server owns pickups, item effects, ordered checkpoints and finish order. Positions stream at 20 Hz with interpolation.
- Leaving an online race closes the room using the existing room lifecycle; create a fresh room for another race. Split-screen is local, not combined with online seats.
- Long Haul now generates Par 6 at 650–745 yards, Par 7 at 780–890 yards, and Par 8 at 930–1,040 yards. Power-Up Tour uses those true Par 8 layouts.
- Coin steering direction corrected; A/D and on-screen buttons both work.
- Power-Up Tour has colored moving ball auras, visible shield mesh, persistent effect text and stronger shot modifiers.
- Alternating light/dark wind streaks improve contrast across course themes.

Validation: syntax checks; 72 generated long routes pass geometry rules; independent local keyboard controls, items/shields/lap completion; two socket clients verify matching tracks, live states, item ownership, checkpoints/finish order and room closure. Physical phyphox hardware and GPU rendering must still be verified on your devices; browser download was unavailable in the build environment.

## 3D and aim correction

Kart Rally now renders with Three.js: perspective chase cameras, separate left/right viewports for local split-screen, 3D carts, curbs, vegetation, glowing items, shield spheres and turbo flames. Racing physics, controls and the online protocol remain the same as the prior Kart Rally update. The kart scene is disposed on exit.

The attached diagnostic report showed disconnected phone face data near -86 degrees. Previously the mouse aiming guides still included that stale data, but mouse launch ignored it. Both guides now exclude phone steering when disconnected or mouse-swinging and reset the smoothed display offset. Calibrated neutral also has zero fixed assisted steering bias. Wind and terrain can still affect a shot after launch.

Validation: JavaScript syntax; geometry finite-value checks; two viewport camera dispatch; independent inputs; repeated scene cleanup/reentry; disconnected-phone steering regression. These tests use a renderer stub and are not a GPU visual test. Physical phone testing remains necessary on the user's hardware.

## Reference circuit and driving audio update

Upload the full package, particularly `public/index.html`, `server.js`, and the NEW root-level `kart-tracks.js`. Redeploy Render and refresh all computers. The title reads "Kart Circuits + Audio". Earlier Kart Rally servers cannot supply these circuits.

Choose a Kart circuit and Kart theme on the main menu before launching. Twenty large stylized outlines are inspired by the supplied chart (Spielberg, Barcelona, Budapest, Monaco, Monza, Nürburg, Silverstone, Spa, Melbourne, Austin, As-Sachir, Greater Noida, Montreal, São Paulo, Yeongam, Singapore, Sepang, Shanghai, Suzuka and Abu Dhabi); these are not surveyed replicas. Random chooses an outline, scale, orientation, elevation phase and theme. Tight layouts expand to keep the 160-unit-wide road from folding at corners. Tracks have rolling elevation and continuous embankments; carts follow the road surface.

All eight existing golf biomes are selectable: Desert, Autumn, Tropical, Alpine, Links, Cherry Blossom, Volcanic and Aurora Night. The live minimap shows the full circuit, finish marker and numbered racer positions.

The supplied car-driving MP3 is embedded. Engine pitch/volume follow speed; it stops during pause, at finish, and on exit. Menu music stops immediately when golf or kart gameplay starts, including online starts, and cannot restart behind a race. The existing sound-effect toggle controls engine audio.

Items: turbo, shield, storm, oil, targeting rocket (slows the nearest rival ahead), star (six seconds of boost and shield), and recovery (clears slowdown and restores speed). Online pickups and effects are server-owned. Local two-player split-screen retains independent controls, item slots and cameras.

Validation: shared client/server geometry byte check; all 20 layouts have finite geometry and checked separation for the widened road; elevation closes at the start line; renderer-stub tests cover minimap, independent controls, audio start/stop, new items and cleanup; two real Socket.IO clients complete matching reference circuits with items, checkpoint/finish state and host room closure. Browser GPU/audio output and physical phyphox were not tested here.


## Kart Contact + Power-ups
Update public/index.html, server.js, and kart-tracks.js together. Karts push each other; oil and homing golf balls cause timed spinouts. Shield blocks an attack; Star protects and enables ram attacks. Road pads and charged cornering (Shift, release) grant boosts. Local AI uses pickups. Each human has an item HUD, and golfer colors/hats appear on drivers. Phyphox polling and swing code are unchanged.
