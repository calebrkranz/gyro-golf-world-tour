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
  setHeaders(res, filePath) {
    // Multiplayer client/server changes must arrive together. Caching an old
    // index.html made one computer silently run an incompatible live protocol.
    if (path.extname(filePath).toLowerCase() === ".html") {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    }
  },
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
      controllerReady: Boolean(player.controllerKey),
      appearance: player.appearance,
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

function closeRoom(room, reason = "A player disconnected. The room was closed.") {
  if (!room || !rooms.has(room.code)) return;
  io.to(room.code).emit("room:closed", { reason });
  for (const player of room.players) {
    const client = player.socketId ? io.sockets.sockets.get(player.socketId) : null;
    if (client) {
      client.leave(room.code);
      client.data.roomCode = null;
      client.data.playerIndex = null;
    }
    player.connected = false;
    player.socketId = null;
  }
  rooms.delete(room.code);
}

function cleanControllerKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9.:/_-]/g, "").slice(0, 180);
}

function cleanDeviceId(value) {
  return String(value || "").trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
}

function cleanColor(value, fallback) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
}

function sanitizeAppearance(value, index = 0) {
  const look = value && typeof value === "object" ? value : {};
  const defaults = [
    { shirtColor: "#58a6ff", ballColor: "#ffffff", skinColor: "#e7b17f", pantsColor: "#26343d", hairColor: "#754521", capColor: "#2d7048", mountColor: "#8b5a36" },
    { shirtColor: "#ff746b", ballColor: "#ffd84a", skinColor: "#9b633f", pantsColor: "#263c2c", hairColor: "#27201b", capColor: "#315d87", mountColor: "#925d3c" },
    { shirtColor: "#ffd34e", ballColor: "#ff7474", skinColor: "#f1c7a2", pantsColor: "#34304b", hairColor: "#b77732", capColor: "#8b3f36", mountColor: "#568b63" },
    { shirtColor: "#8fd56d", ballColor: "#78bfff", skinColor: "#6f432d", pantsColor: "#47352e", hairColor: "#17191b", capColor: "#6f548d", mountColor: "#6b688f" },
  ][Math.max(0, Math.min(3, Math.trunc(index)))] || {};
  const pick = (allowed, candidate, fallback) => allowed.includes(candidate) ? candidate : fallback;
  return {
    shirtColor: cleanColor(look.shirtColor, defaults.shirtColor),
    ballColor: cleanColor(look.ballColor, defaults.ballColor),
    skinColor: cleanColor(look.skinColor, defaults.skinColor),
    pantsColor: cleanColor(look.pantsColor, defaults.pantsColor),
    hairColor: cleanColor(look.hairColor, defaults.hairColor),
    capColor: cleanColor(look.capColor, defaults.capColor),
    shoeColor: cleanColor(look.shoeColor, "#171c20"),
    hairStyle: pick(["short", "long", "curly", "buzz"], String(look.hairStyle || ""), "short"),
    hatStyle: pick(["cap", "visor", "bucket", "none"], String(look.hatStyle || ""), "cap"),
    bodyStyle: pick(["athletic", "slim", "stocky"], String(look.bodyStyle || ""), "athletic"),
    mountStyle: pick(["none", "horse", "dragon", "turtle"], String(look.mountStyle || ""), "none"),
    mountColor: cleanColor(look.mountColor, defaults.mountColor),
  };
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
    sequence: Math.max(0, Math.trunc(finiteNumber(live.sequence))),
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
      const deviceId = cleanDeviceId(payload?.deviceId);
      if (!deviceId) {
        return acknowledge(callback, { ok: false, error: "This browser needs a computer ID. Refresh the new game build." });
      }
      const player = {
        index: 0,
        token,
        deviceId,
        name: cleanName(payload?.name, "Player 1"),
        socketId: socket.id,
        connected: true,
        controllerKey: "",
        appearance: sanitizeAppearance(payload?.appearance, 0),
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
    const deviceId = cleanDeviceId(payload?.deviceId);
    if (!deviceId) {
      return acknowledge(callback, { ok: false, error: "This browser needs a computer ID. Refresh the new game build." });
    }
    if (room.players.some((player) => player.deviceId === deviceId)) {
      return acknowledge(callback, { ok: false, error: "This computer already owns a player in that room. Join from the other computer." });
    }
    const index = room.players.length;
    const token = crypto.randomUUID();
    const player = {
      index,
      token,
      deviceId,
      name: cleanName(payload?.name, `Player ${index + 1}`),
      socketId: socket.id,
      connected: true,
      controllerKey: "",
      appearance: sanitizeAppearance(payload?.appearance, index),
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
    const deviceId = cleanDeviceId(payload?.deviceId);
    const player = room?.players.find((item) =>
      item.token === payload?.token && item.deviceId === deviceId
    );
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

  socket.on("room:appearance", (payload) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players[socket.data.playerIndex];
    if (!room || !player || player.socketId !== socket.id) return;
    player.appearance = sanitizeAppearance(payload?.appearance, player.index);
    touch(room);
    broadcastRoom(room);
  });

  socket.on("room:leave", () => {
    const room = rooms.get(socket.data.roomCode);
    const index = socket.data.playerIndex;
    const player = room?.players[index];
    if (!room || !player) return;
    closeRoom(room, `${player.name} left. The online room was closed for everyone.`);
  });

  socket.on("controller:claim", (payload, callback) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players[socket.data.playerIndex];
    if (!room || !player) {
      return acknowledge(callback, { ok: false, error: "Join an online room first." });
    }
    if (!player.deviceId || player.deviceId !== cleanDeviceId(payload?.deviceId)) {
      return acknowledge(callback, { ok: false, error: "This phone claim belongs to a different computer." });
    }
    const controllerKey = cleanControllerKey(payload?.controllerKey);
    if (!controllerKey) {
      return acknowledge(callback, { ok: false, error: "Enter this computer's phyphox IP first." });
    }
    const duplicate = room.players.find((item) =>
      item.index !== player.index && item.controllerKey === controllerKey
    );
    if (duplicate) {
      return acknowledge(callback, {
        ok: false,
        error: `That phyphox phone is already assigned to ${duplicate.name}. Use a different phone IP on this computer.`,
      });
    }
    player.controllerKey = controllerKey;
    touch(room);
    acknowledge(callback, { ok: true });
    broadcastRoom(room);
  });

  // Render is only the signaling path. Once negotiated, browsers on the same
  // Wi-Fi exchange live swing/ball packets directly over WebRTC.
  socket.on("rtc:signal", (payload) => {
    const room = rooms.get(socket.data.roomCode);
    const fromIndex = socket.data.playerIndex;
    const targetIndex = Math.trunc(Number(payload?.targetIndex));
    const target = room?.players[targetIndex];
    if (!room || !Number.isInteger(fromIndex) || !target?.connected || !target.socketId) return;
    if (targetIndex === fromIndex) return;
    const signal = payload?.signal;
    if (!signal || typeof signal !== "object") return;
    let encoded = "";
    try { encoded = JSON.stringify(signal); } catch (_) { return; }
    if (encoded.length > 120_000) return;
    io.to(target.socketId).emit("rtc:signal", { fromIndex, signal });
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
    const requestedMode = String(payload?.mode || "stroke");
    const mode = ["stroke", "island", "party"].includes(requestedMode) ? requestedMode : "stroke";
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

  // Live packets are visual-only. The authoritative score/turn still comes
  // from turn:submit. A compact ~25 Hz relay keeps hosted spectators smooth;
  // same-Wi-Fi peers normally receive the faster direct WebRTC stream.
  socket.on("shot:live", (payload) => {
    const room = rooms.get(socket.data.roomCode);
    const playerIndex = socket.data.playerIndex;
    if (!room || room.status !== "playing") return;
    if (playerIndex !== room.activeIndex) return;
    if (Number(payload?.holeIndex) !== room.holeIndex) return;

    const now = Date.now();
    if (now - socket.data.lastLiveShotAt < 38) return;
    socket.data.lastLiveShotAt = now;

    const event = sanitizeLiveShot(payload, room, playerIndex);
    socket.to(room.code).emit("shot:live", event);
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
    closeRoom(room, `${player.name} disconnected. The online room was closed for everyone.`);
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
