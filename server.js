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

// Kart races have their own state channel; golf turns and controller claims are
// never used for racing. The server owns pickups, effects, checkpoints and rank.
const KartTracks=require('./kart-tracks.js');
const kartTrackCache=new WeakMap();
function kartPoint(config,t,lane=0){
 let track=kartTrackCache.get(config);if(!track){track=KartTracks.build(config).points;kartTrackCache.set(config,track);}return KartTracks.point(track,t,lane);
}
function startKart(room){
 const themes=['desert','autumn','tropical','alpine','links','cherry','volcanic','aurora'];
 const config={trackId:room.round.kartTrack==='random'?crypto.randomInt(20):Number(room.round.kartTrack),scale:48+crypto.randomInt(8),rotation:crypto.randomInt(628)/100,phase:crypto.randomInt(628)/100,theme:themes.includes(room.round.biome)?room.round.biome:themes[crypto.randomInt(themes.length)]};
 room.round.kart=config;
 room.kart={startAt:Date.now()+4000,boxes:Array(20).fill(0),hazards:[],finishOrder:[],states:room.players.map((p,i)=>({...kartPoint(config,-.008*i,(i%2?1:-1)*22),index:i,t:((-.008*i)%1+1)%1,speed:0,gates:0,lap:0,item:'',boostUntil:0,shieldUntil:0,slowUntil:0,lastAt:Date.now(),finished:false}))};
 room.round.kartStartAt=room.kart.startAt;
}
setInterval(()=>{
 const now=Date.now();for(const room of rooms.values())if(room.kart&&room.status==='playing'){
  room.kart.hazards=room.kart.hazards.filter(h=>h.until>now);
  io.to(room.code).volatile.emit('kart:snapshot',{now,startAt:room.kart.startAt,states:room.kart.states,boxes:room.kart.boxes,hazards:room.kart.hazards,finishOrder:room.kart.finishOrder});
 }
},50).unref();

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
    battleEffects: Array.isArray(room.battleEffects) ? room.battleEffects : [],
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
    collectedBattleBoxIds: Array.isArray(state.collectedBattleBoxIds)
      ? state.collectedBattleBoxIds.map((id) => String(id).slice(0, 24)).slice(0, 36)
      : [],
    battlePickup: ["boost", "bounce", "shield", "storm", "mud"].includes(state.battlePickup)
      ? state.battlePickup
      : "",
    battleConsumed: Boolean(state.battleConsumed),
  };
}

function nextOpponent(room, fromIndex) {
  for (let step = 1; step < room.players.length; step += 1) {
    const index = (fromIndex + step) % room.players.length;
    if (room.players[index]?.connected) return index;
  }
  return -1;
}

function settleBattlePickup(room, playerIndex, state) {
  if (room.round?.mode !== "battle") return null;
  if (!Array.isArray(room.battleEffects)) {
    room.battleEffects = room.players.map(() => ({ effect: "", shield: false }));
  }
  const current = room.battleEffects[playerIndex] || (room.battleEffects[playerIndex] = { effect: "", shield: false });
  if (state.battleConsumed && current.effect) current.effect = "";
  const pickup = state.battlePickup;
  if (!pickup) return null;
  if (pickup === "shield") {
    current.shield = true;
    return { pickup, targetIndex: playerIndex, blocked: false };
  }
  if (pickup === "boost" || pickup === "bounce") {
    current.effect = pickup;
    return { pickup, targetIndex: playerIndex, blocked: false };
  }
  const targetIndex = nextOpponent(room, playerIndex);
  if (targetIndex < 0) return null;
  const target = room.battleEffects[targetIndex] || (room.battleEffects[targetIndex] = { effect: "", shield: false });
  if (target.shield) {
    target.shield = false;
    return { pickup, targetIndex, blocked: true };
  }
  target.effect = pickup;
  return { pickup, targetIndex, blocked: false };
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
        battleEffects: [],
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
    const mode = ["stroke", "island", "party", "battle", "longhaul", "kart"].includes(requestedMode) ? requestedMode : "stroke";
    room.round = {
      mode,
      seed: String(payload?.seed || "ONLINE").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24) || "ONLINE",
      kartTrack:/^(?:[0-9]|1[0-9])$/.test(String(payload?.kartTrack))?String(payload.kartTrack):'random',
      biome: String(payload?.biome || "auto").slice(0, 16),
      routing: String(payload?.routing || "balanced").slice(0, 16),
    };
    room.status = "playing";
    room.activeIndex = 0;
    room.holeIndex = 0;
    room.turnStates.clear();
    room.finishedThisHole.clear();
    room.battleEffects = room.players.map(() => ({ effect: "", shield: false }));
    if(mode === "kart") startKart(room);
    touch(room);
    acknowledge(callback, { ok: true });
    io.to(room.code).emit("game:started", publicRoom(room));
  });

  // Live packets are visual-only. The authoritative score/turn still comes
  // from turn:submit. A compact ~25 Hz relay keeps hosted spectators smooth;
  // same-Wi-Fi peers normally receive the faster direct WebRTC stream.
  socket.on('kart:state', payload=>{
    const room=rooms.get(socket.data.roomCode),now=Date.now(),race=room?.kart;
    if(!race||room.status!=='playing'||now<race.startAt)return;
    const r=race.states[socket.data.playerIndex];if(!r||r.finished||now-r.lastAt<30)return;
    const {x,y,angle,speed,t}=payload||{};
    if(![x,y,angle,speed,t].every(Number.isFinite)||Math.abs(x)>6000||Math.abs(y)>6000||t<0||t>=1)return;
    const budget=650*Math.min(.5,(now-r.lastAt)/1000)+35;
    if(Math.hypot(x-r.x,y-r.y)>budget&&!payload.rescue)return;
    if(payload.rescue){const q=kartPoint(room.round.kart,r.t);Object.assign(r,q);r.speed=0;}else Object.assign(r,{x,y,angle,speed:Math.max(-85,Math.min(530,speed)),t});
    r.lastAt=now;
    const gate=kartPoint(room.round.kart,((r.gates+1)%4)/4);
    if(Math.hypot(r.x-gate.x,r.y-gate.y)<136){r.gates++;r.lap=Math.floor(r.gates/4);if(r.lap>=3){r.finished=true;race.finishOrder.push(r.index);}}
    if(!r.item)for(let i=0;i<20;i++){if(race.boxes[i]>now)continue;const q=kartPoint(room.round.kart,(i+.5)/20,(i%3-1)*25);if(Math.hypot(r.x-q.x,r.y-q.y)<35){r.item=KartTracks.items[crypto.randomInt(KartTracks.items.length)];race.boxes[i]=now+8000;break;}}
    for(const h of race.hazards)if(h.owner!==r.index&&h.until>now&&Math.hypot(h.x-r.x,h.y-r.y)<45){if(r.shieldUntil>now)r.shieldUntil=0;else r.slowUntil=now+3000;h.until=0;}
    touch(room);
  });
  socket.on('kart:use',()=>{
    const room=rooms.get(socket.data.roomCode),race=room?.kart,now=Date.now();if(!race||now<race.startAt)return;
    const r=race.states[socket.data.playerIndex];if(!r||r.finished||!r.item)return;
    const item=r.item;r.item='';
    if(item==='turbo')r.boostUntil=now+4000;
    if(item==='shield')r.shieldUntil=now+8000;
    if(item==='storm')for(const rival of race.states)if(rival!==r){if(rival.shieldUntil>now)rival.shieldUntil=0;else rival.slowUntil=now+4000;}
    if(item==='star'){r.boostUntil=now+6000;r.shieldUntil=now+6000;r.starUntil=now+6000;}
    if(item==='repair'){r.repairAt=now;r.slowUntil=0;r.shieldUntil=Math.max(r.shieldUntil,now+2000);}
    if(item==='rocket'){const target=race.states.filter(v=>v!==r&&!v.finished).sort((a,b)=>((a.t-r.t+1)%1)-((b.t-r.t+1)%1))[0];if(target){if(target.shieldUntil>now)target.shieldUntil=0;else target.slowUntil=now+4000;}}
    if(item==='oil')race.hazards.push({...kartPoint(room.round.kart,r.t-.012),owner:r.index,until:now+18000});
    io.to(room.code).emit('kart:item',{index:r.index,item});
  });

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
    const battleResult = settleBattlePickup(room, playerIndex, state);
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
      battleResult,
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
    room.battleEffects = room.players.map(() => ({ effect: "", shield: false }));
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
