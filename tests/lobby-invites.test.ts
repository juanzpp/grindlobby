import {readFile} from "node:fs/promises";
import {describe,expect,it} from "vitest";
import {createLobbyInviteToken,lobbyInviteHash} from "../lib/lobby-invites";

describe("lobby invite tokens",()=>{
  it("generates URL-safe high-entropy tokens",()=>{
    const token=createLobbyInviteToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it("hashes deterministically without storing the raw token",()=>{
    const token=createLobbyInviteToken();
    const hash=lobbyInviteHash(token);
    expect(hash).toHaveLength(64);
    expect(hash).toBe(lobbyInviteHash(token));
    expect(hash).not.toContain(token);
  });
  it("does not reuse tokens",()=>{
    expect(createLobbyInviteToken()).not.toBe(createLobbyInviteToken());
  });
  it("never treats a lobby id as an invite token on direct navigation",async()=>{
    const page=await readFile("app/lobby/[id]/page.tsx","utf8");
    expect(page).not.toContain("lobbyInviteHash");
    expect(page).not.toContain("redeem_lobby_invite");
    expect(page).toContain("lobby.visibility!=='public'&&lobby.owner_id!==user.id&&!membership");
    expect(page).toContain("notFound()");
  });
});
