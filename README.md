# Gyro Golf World Tour

Gyro Golf World Tour is a browser-based 3D golf game with phyphox motion controls, mouse fallback controls, generated courses, Island Hopper, Tour Career, and room-code online multiplayer.

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

1. Download `public/index.html` and open it directly on each player's computer.
2. Paste your Render URL (for example `https://gyro-golf-world-tour.onrender.com`) into **Online server URL**.
3. Create or join the room normally, then connect that computer's own phyphox phone.

The game runs locally for smooth swing input while only turn results travel through Render. Mouse controls work directly on the hosted page without this extra step.

## Online play notes

- Online rooms support **Stroke Play** and **Island Hopper**.
- Each computer can connect to its own phyphox phone or use mouse controls.
- The host starts the round and advances after everyone finishes each hole.
- Courses are deterministic: every player receives the same seed and generated layout.
- Rooms are kept in memory. A free Render service can sleep or restart, which clears active rooms; create a new room if that happens.
