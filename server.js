"use strict";

const crypto = require("node:crypto");
const path = require("node:path");
const express = require("express");
const http = require("node:http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  transports: ["websocket", "polling"],
  maxHttpBufferSize: 200_000,
  // A player may open public/index.html as a local file so the browser can
  // still reach phyphox over HTTP, while Socket.IO connects to Render HTTPS.
  cors: { origin: true, methods: ["GET", "POST"] },
});

const PORT = Number(process.env.PORT) || 3000;
const ROOM_LIMIT = 4;
const ROOM_TTL_MS = 30 * 60 * 1000;
const rooms = new Map();

app.disable("x-powered-by");
app.get("/health", (_req, res) => res.json({ ok: true, rooms: rooms.size }));
app.use(express.static(path.join(__dirname, "public"), {
  etag: true,
  maxAge: "1h",
}));

function cleanName(value, fallback = "Player") {
  const name = String(value || "").replace(/[<>\u0000-\u001f]/g, "").trim();
  return (name || fallback).slice(0, 18);
}

function cleanCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function newCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 100; attempt += 1) {
    let code = "";
    for (let i = 0; i < 6; i += 1) {
      code += alphabet[crypto.randomInt(alphabet.length)];
    }
    if (!rooms.has(code)) return code;
  }
  throw new Error("Could not allocate a room code");
}

function publicRoom(room) {
  return {
    code: room.code,
    hostIndex: room.hostIndex,
    status: room.status,
    activeIndex: room.activeIndex,
    holeIndex: room.holeIndex,
    round: room.round,
    players: room.players.map((player) => ({
      index: player.index,
      name: player.name,
      connected: player.connected,
      scores: player.scores,
    })),
    turnStates: Array.from(room.turnStates.entries()).map(([playerIndex, state]) => ({ playerIndex, state })),
  };
}

function touch(room) {
  room.updatedAt = Date.now();
}

function nextConnectedPlayer(room, fromIndex) {
  for (let step = 1; step <= room.players.length; step += 1) {
    const index = (fromIndex + step) % room.players.length;
    const player = room.players[index];
    if (player.connected && !room.finishedThisHole.has(index)) return index;
  }
  return -1;
}

function broadcastRoom(room) {
  io.to(room.code).emit("room:state", publicRoom(room));
}

function attachPlayer(socket, room, player) {
  if (socket.data.roomCode && socket.data.roomCode !== room.code) {
    socket.leave(socket.data.roomCode);
  }
  socket.join(room.code);
  socket.data.roomCode = room.code;
  socket.data.playerIndex = player.index;
  player.socketId = socket.id;
  player.connected = true;
  touch(room);
}

function acknowledge(callback, payload) {
  if (typeof callback === "function") callback(payload);
}

function sanitizeTurnState(value) {
  const state = value && typeof value === "object" ? value : {};
  return {
    x: Number.isFinite(Number(state.x)) ? Number(state.x) : 0,
    z: Number.isFinite(Number(state.z)) ? Number(state.z) : 0,
    strokes: Math.max(0, Math.min(30, Math.trunc(Number(state.strokes) || 0))),
    finished: Boolean(state.finished),
    lastShotText: String(state.lastShotText || "—").slice(0, 80),
    lastShape: String(state.lastShape || "—").slice(0, 30),
    selected: String(state.selected || "").slice(0, 4),
  };
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sanitizeLiveShot(value, room, playerIndex) {
  const live = value && typeof value === "object" ? value : {};
  const kind = ["address", "swing", "ball"].includes(live.kind) ? live.kind : "address";
  const ballState = ["rest", "flight", "roll", "cup"].includes(live.ballState)
    ? live.ballState
    : "rest";
  const clamp = (number, min, max) => Math.max(min, Math.min(max, number));
  return {
    playerIndex,
    holeIndex: room.holeIndex,
    kind,
    ballState,
    swingPhase: String(live.swingPhase || "ADDRESS").slice(0, 16),
    swingDeg: clamp(finiteNumber(live.swingDeg), -120, 120),
    faceDeg: clamp(finiteNumber(live.faceDeg), -45, 45),
    position: {
      x: clamp(finiteNumber(live.position?.x), -2500, 2500),
      y: clamp(finiteNumber(live.position?.y), -500, 1000),
      z: clamp(finiteNumber(live.position?.z), -2500, 2500),
    },
    velocity: {
      x: clamp(finiteNumber(live.velocity?.x), -500, 500),
      y: clamp(finiteNumber(live.velocity?.y), -500, 500),
      z: clamp(finiteNumber(live.velocity?.z), -500, 500),
    },
    sentAt: Date.now(),
  };
}

io.on("connection", (socket) => {
  socket.data.lastLiveShotAt = 0;
  socket.on("room:create", (payload, callback) => {
    try {
      const code = newCode();
      const token = crypto.randomUUID();
      const player = {
        index: 0,
        token,
        name: cleanName(payload?.name, "Player 1"),
        socketId: socket.id,
        connected: true,
        scores: {},
      };
      const room = {
        code,
        hostIndex: 0,
        status: "lobby",
        activeIndex: 0,
        holeIndex: 0,
        round: null,
        players: [player],
        turnStates: new Map(),
        finishedThisHole: new Set(),
        updatedAt: Date.now(),
      };
      rooms.set(code, room);
      attachPlayer(socket, room, player);
      acknowledge(callback, { ok: true, token, playerIndex: 0, room: publicRoom(room) });
      broadcastRoom(room);
    } catch (error) {
      acknowledge(callback, { ok: false, error: "Could not create the room." });
    }
  });

  socket.on("room:join", (payload, callback) => {
    const code = cleanCode(payload?.code);
    const room = rooms.get(code);
    if (!room) return acknowledge(callback, { ok: false, error: "Room not found." });
    if (room.status !== "lobby") {
      return acknowledge(callback, { ok: false, error: "That round has already started." });
    }
    if (room.players.length >= ROOM_LIMIT) {
      return acknowledge(callback, { ok: false, error: "That room is full." });
    }
    const index = room.players.length;
    const token = crypto.randomUUID();
    const player = {
      index,
      token,
      name: cleanName(payload?.name, `Player ${index + 1}`),
      socketId: socket.id,
      connected: true,
      scores: {},
    };
    room.players.push(player);
    attachPlayer(socket, room, player);
    acknowledge(callback, { ok: true, token, playerIndex: index, room: publicRoom(room) });
    broadcastRoom(room);
  });

  socket.on("room:resume", (payload, callback) => {
    const code = cleanCode(payload?.code);
    const room = rooms.get(code);
    const player = room?.players.find((item) => item.token === payload?.token);
    if (!room || !player) {
      return acknowledge(callback, { ok: false, error: "Saved room expired." });
    }
    attachPlayer(socket, room, player);
    acknowledge(callback, {
      ok: true,
      token: player.token,
      playerIndex: player.index,
      room: publicRoom(room),
    });
    broadcastRoom(room);
  });

  socket.on("room:rename", (payload) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players[socket.data.playerIndex];
    if (!room || !player) return;
    player.name = cleanName(payload?.name, player.name);
    touch(room);
    broadcastRoom(room);
  });

  socket.on("room:leave", () => {
    const room = rooms.get(socket.data.roomCode);
    const index = socket.data.playerIndex;
    const player = room?.players[index];
    if (!room || !player) return;
    player.connected = false;
    player.socketId = null;
    socket.leave(room.code);
    socket.data.roomCode = null;
    socket.data.playerIndex = null;
    touch(room);
    broadcastRoom(room);
  });

  socket.on("game:start", (payload, callback) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || socket.data.playerIndex !== room.hostIndex) {
      return acknowledge(callback, { ok: false, error: "Only the host can start." });
    }
    if (room.status !== "lobby") {
      return acknowledge(callback, { ok: false, error: "The round already started." });
    }
    if (room.players.length < 2 || room.players.some((player) => !player.connected)) {
      return acknowledge(callback, { ok: false, error: "Two connected players are required." });
    }
    const mode = payload?.mode === "island" ? "island" : "stroke";
    room.round = {
      mode,
      seed: String(payload?.seed || "ONLINE").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24) || "ONLINE",
      biome: String(payload?.biome || "auto").slice(0, 16),
      routing: String(payload?.routing || "balanced").slice(0, 16),
    };
    room.status = "playing";
    room.activeIndex = 0;
    room.holeIndex = 0;
    room.turnStates.clear();
    room.finishedThisHole.clear();
    touch(room);
    acknowledge(callback, { ok: true });
    io.to(room.code).emit("game:started", publicRoom(room));
  });

  // Live packets are visual-only and deliberately lossy. The authoritative
  // score/turn still comes from turn:submit, while spectators receive enough
  // club and ball state to watch the active player in real time.
  socket.on("shot:live", (payload) => {
    const room = rooms.get(socket.data.roomCode);
    const playerIndex = socket.data.playerIndex;
    if (!room || room.status !== "playing") return;
    if (playerIndex !== room.activeIndex) return;
    if (Number(payload?.holeIndex) !== room.holeIndex) return;

    const now = Date.now();
    if (now - socket.data.lastLiveShotAt < 40) return;
    socket.data.lastLiveShotAt = now;

    const event = sanitizeLiveShot(payload, room, playerIndex);
    socket.to(room.code).volatile.emit("shot:live", event);
  });

  socket.on("turn:submit", (payload, callback) => {
    const room = rooms.get(socket.data.roomCode);
    const playerIndex = socket.data.playerIndex;
    if (!room || room.status !== "playing") {
      return acknowledge(callback, { ok: false, error: "Room is not playing." });
    }
    if (playerIndex !== room.activeIndex || Number(payload?.holeIndex) !== room.holeIndex) {
      return acknowledge(callback, { ok: false, error: "That is not the active turn." });
    }
    const state = sanitizeTurnState(payload?.state);
    room.turnStates.set(playerIndex, state);
    if (state.finished) {
      room.finishedThisHole.add(playerIndex);
      room.players[playerIndex].scores[room.holeIndex] = state.strokes;
    }

    const connectedPlayers = room.players.filter((player) => player.connected);
    const allFinished = connectedPlayers.length > 0 && connectedPlayers.every((player) => room.finishedThisHole.has(player.index));
    if (allFinished) {
      room.status = "hole-complete";
    } else {
      const next = nextConnectedPlayer(room, playerIndex);
      if (next >= 0) room.activeIndex = next;
    }
    touch(room);
    const event = {
      playerIndex,
      holeIndex: room.holeIndex,
      state,
      activeIndex: room.activeIndex,
      holeComplete: allFinished,
      room: publicRoom(room),
    };
    acknowledge(callback, { ok: true });
    io.to(room.code).emit("turn:state", event);
  });

  socket.on("hole:advance", (_payload, callback) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || socket.data.playerIndex !== room.hostIndex) {
      return acknowledge(callback, { ok: false, error: "Only the host can continue." });
    }
    if (room.status !== "hole-complete") {
      return acknowledge(callback, { ok: false, error: "Finish the hole first." });
    }
    room.holeIndex += 1;
    room.activeIndex = 0;
    room.status = "playing";
    room.turnStates.clear();
    room.finishedThisHole.clear();
    touch(room);
    acknowledge(callback, { ok: true });
    io.to(room.code).emit("hole:advanced", publicRoom(room));
  });

  socket.on("hole:skip", (payload, callback) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || socket.data.playerIndex !== room.hostIndex) {
      return acknowledge(callback, { ok: false, error: "Only the host can skip a hole." });
    }
    if (room.status !== "playing") {
      return acknowledge(callback, { ok: false, error: "The room is not on an active hole." });
    }
    const maxScore = Math.max(3, Math.min(12, Math.trunc(Number(payload?.maxScore) || 8)));
    for (const player of room.players) {
      room.finishedThisHole.add(player.index);
      player.scores[room.holeIndex] = maxScore;
      room.turnStates.set(player.index, {
        x: 0,
        z: 0,
        strokes: maxScore,
        finished: true,
        lastShotText: "Skipped hole",
        lastShape: "—",
        selected: "",
      });
    }
    room.status = "hole-complete";
    touch(room);
    acknowledge(callback, { ok: true });
    io.to(room.code).emit("hole:skipped", { maxScore, room: publicRoom(room) });
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players[socket.data.playerIndex];
    if (!room || !player || player.socketId !== socket.id) return;
    player.connected = false;
    player.socketId = null;
    touch(room);
    broadcastRoom(room);
  });
});

setInterval(() => {
  const expiry = Date.now() - ROOM_TTL_MS;
  for (const [code, room] of rooms) {
    if (room.updatedAt < expiry && room.players.every((player) => !player.connected)) {
      rooms.delete(code);
    }
  }
}, 60_000).unref();

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Gyro Golf World Tour listening on port ${PORT}`);
});
