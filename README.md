# Gyro Golf World Tour

Gyro Golf World Tour is a browser-based 3D golf game with phyphox motion controls, mouse fallback controls, generated courses, Island Hopper, Tour Career, room-code online multiplayer, cosmetic animal mounts, and arcade party modes.

## Party Pack 1

- Ride a **horse**, **dragon**, or **giant turtle** without changing swing detection, club collision, or ball physics.
- Give every player's mount its own color in **Customize Character**.
- Play **Moon Golf**, **Mega Cup Mayhem**, and **Bounce Blitz** as local party modes.
- Standard Stroke Play and the online room system retain their established physics and controller behavior.

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
2. Click **Download Phone-Compatible Game** and open the downloaded HTML on each player's computer.
3. Create or join the room normally, then enter and connect that computer's own phyphox IP. The downloaded copy remembers the Render server URL automatically.

The game runs locally for smooth swing input while only turn results travel through Render. Mouse controls work directly on the hosted page without this extra step.

## Online play notes

- Online rooms support **Stroke Play** and **Island Hopper**.
- Party Pack modes are local-only so experimental physics never enter an online room.
- Each computer owns exactly one online player and connects only that player's phyphox phone. A persistent browser ID and room token prevent one computer from claiming another player's controller.
- In local pass-and-play, every player also has an isolated phone slot. Leaving a slot blank makes that player mouse-only; Player 1's phone is never shared automatically.
- The host starts the round and advances after everyone finishes each hole.
- Every spectator sees the active player's live club motion and ball flight. Only the active player's browser can detect impact or submit the shot.
- Every resting player ball remains visible on the course between turns.
- Courses are deterministic: every player receives the same seed and generated layout.
- Rooms are kept in memory. A free Render service can sleep or restart, which clears active rooms; create a new room if that happens.
