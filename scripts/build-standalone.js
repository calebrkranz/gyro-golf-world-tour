"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "public", "index.html");
const audioPath = path.join(root, "public", "coin-collect.mp3");
const outputPath = path.resolve(root, "..", "Gyro Golf World Tour Online.html");

let html = fs.readFileSync(sourcePath, "utf8");
const audio = fs.readFileSync(audioPath).toString("base64");
const marker = "coin:'coin-collect.mp3'";
if (!html.includes(marker)) throw new Error("Coin audio marker is missing");
html = html.replace(marker, `coin:'data:audio/mpeg;base64,${audio}'`);
fs.writeFileSync(outputPath, html);
console.log(`Built ${outputPath}`);
