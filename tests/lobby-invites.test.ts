import {describe,expect,it} from "vitest";
import {createLobbyInviteToken,lobbyInviteHash} from "@/lib/lobby-invites";

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
});
