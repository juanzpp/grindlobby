import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';

describe('native desktop navigation',()=>{
  it('keeps legacy profile and settings links inside the standard desktop shell',async()=>{
    const profile=await readFile('app/profile/page.tsx','utf8');
    const settings=await readFile('app/settings/page.tsx','utf8');
    expect(profile).toContain('redirect("/?desktop=1&view=profile")');
    expect(settings).toContain('redirect("/?desktop=1&view=settings")');
    expect(profile).toContain('redirect("/desktop-lite?desktop=lite")');
    expect(settings).toContain('redirect("/desktop-lite?desktop=lite")');
  });

  it('renders the store inside the native standard shell while preserving the web store',async()=>{
    const store=await readFile('app/loja/page.tsx','utf8');
    expect(store).toContain('if(desktop)return <DesktopHome user={user} initialView="store"/>');
    expect(store).toContain('return <Dashboard user={user} initialView="store"/>');
    expect(store).toContain('if(lite)redirect("/desktop-lite?desktop=lite")');
  });

  it('forces Windows rebuilds for native compatibility routes',async()=>{
    const workflow=await readFile('.github/workflows/desktop-windows.yml','utf8');
    expect(workflow).toContain("- 'app/profile/**'");
    expect(workflow).toContain("- 'app/settings/**'");
    expect(workflow).toContain("- 'app/loja/**'");
  });
});
