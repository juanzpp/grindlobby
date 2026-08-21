import {createHash,randomBytes} from "node:crypto";

export function createLobbyInviteToken(){return randomBytes(24).toString("base64url")}
export function lobbyInviteHash(token:string){return createHash("sha256").update(token).digest("hex")}
