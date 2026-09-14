# Gyro Golf World Tour

Gyro Golf World Tour is a browser-based 3D golf game with phyphox motion controls, mouse fallback controls, generated courses, Island Hopper, Tour Career, room-code online multiplayer, cosmetic animal mounts, and arcade party modes.

## Online Fix 9

- Phyphox polling now requests and processes every new timestamped phone sample instead of discarding all but the last sample in each Wi-Fi response. Swing motion stays high-rate even when HTTP requests finish slowly.
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
- **Coin Collect** creates four treasure holes with large airborne coins and per-player collection totals.
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

- Online rooms support **Stroke Play**, **Island Hopper**, and **Party Wheel**.
- Only those three cards remain visible after a room is created or joined.
- Moon Golf, Mega Cup, Bounce Blitz, Wild Conditions, Target Golf, and Coin Collect remain available for local pass-and-play.
- Each computer owns exactly one online player and connects only that player's phyphox phone. A persistent browser ID and room token prevent one computer from claiming another player's controller.
- In local pass-and-play, every player also has an isolated phone slot. Leaving a slot blank makes that player mouse-only; Player 1's phone is never shared automatically.
- The host starts the round and advances after everyone finishes each hole.
- Every spectator sees the active player's live club motion and ball flight. Only the active player's browser can detect impact or submit the shot.
- Online players retain their complete customized golfer and mount appearance on every computer.
- Every resting player ball remains visible on the course between turns.
- Courses are deterministic: every player receives the same seed and generated layout.
- Rooms are kept in memory. A free Render service can sleep or restart, which clears active rooms; create a new room if that happens.
