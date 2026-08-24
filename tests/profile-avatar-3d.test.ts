import {readFile} from "node:fs/promises";
import {describe,expect,it} from "vitest";

describe("profile AI character preview",()=>{
  it("uses the native image edit provider when a server key is configured",async()=>{
    const source=await readFile("app/api/profile/avatar-3d/route.ts","utf8");
    expect(source).toContain('https://api.openai.com/v1/images/edits');
    expect(source).toContain('process.env.OPENAI_API_KEY');
    expect(source).toContain('"gpt-image-2"');
    expect(source).toContain('form.append("image[]", image, image.name)');
    expect(source).toContain('form.append("size", "1024x1536")');
    expect(source).toContain('form.append("background", "transparent")');
  });

  it("only fetches profile images from the user-owned GrindLobby storage path",async()=>{
    const source=await readFile("app/api/profile/avatar-3d/route.ts","utf8");
    expect(source).toContain('avatarUrl.hostname !== supabaseUrl.hostname');
    expect(source).toContain('/storage/v1/object/public/profile-assets/${userId}/avatar/');
    expect(source).toContain('redirect: "error"');
    expect(source).toContain('MAX_AVATAR_BYTES = 5 * 1024 * 1024');
  });

  it("keeps generated characters preview-only",async()=>{
    const route=await readFile("app/api/profile/avatar-3d/route.ts","utf8");
    const dock=await readFile("components/profile/ProfileAvatar3DPreviewDock.tsx","utf8");
    expect(route).toContain('persisted: false');
    expect(route).not.toContain('.update({ avatar_3d');
    expect(dock).toContain('A imagem é apenas uma amostra visual do perfil e não é salva automaticamente pelo GrindLobby.');
  });
});
