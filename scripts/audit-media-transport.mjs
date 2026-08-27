import { readFile } from "node:fs/promises";

const roomPath = new URL("../src/routes/sala.$lobbyId.tsx", import.meta.url);
const packagePath = new URL("../package.json", import.meta.url);
const room = await readFile(roomPath, "utf8");
const pkg = JSON.parse(await readFile(packagePath, "utf8"));

const forbidden = [
  "new RTCPeerConnection",
  "stun:stun.l.google.com",
  "stun:stun1.l.google.com",
  'event:"signal"',
  'event: "signal"',
];

const violations = forbidden.filter((needle) => room.includes(needle));
if (violations.length) {
  console.error("Media transport audit failed. P2P/signaling regression found:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

if (!pkg.dependencies?.["livekit-client"] || !pkg.dependencies?.["livekit-server-sdk"]) {
  console.error("Media transport audit failed. LiveKit client/server dependencies are required.");
  process.exit(1);
}

if (!room.includes("livekit-session")) {
  console.error("Media transport audit failed. Lobby room must use the persistent LiveKit session layer.");
  process.exit(1);
}

console.log("Media transport audit passed: SFU transport is enforced and P2P signaling is absent.");
