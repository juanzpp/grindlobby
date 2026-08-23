import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';

describe('native desktop secondary modules',()=>{
  it('wraps Community in the native desktop shell only for desktop=1',async()=>{
    const source=await readFile('app/community/page.tsx','utf8');
    expect(source).toContain("const desktop=query.desktop==='1',lite=query.desktop==='lite'");
    expect(source).toContain('if(desktop)return <DesktopModuleShell section="community"');
    expect(source).toContain('return <div className="web-refresh-scope web-community-v2">{content}</div>;');
  });

  it('wraps Valorant matchmaking and match rooms in the native desktop shell',async()=>{
    const lobby=await readFile('app/competitive/valorant/page.tsx','utf8');
    const match=await readFile('app/competitive/valorant/match/[id]/page.tsx','utf8');
    expect(lobby).toContain('<DesktopModuleShell section="competitive"');
    expect(match).toContain('<DesktopModuleShell section="competitive"');
    expect(lobby).toContain("if(lite)redirect('/desktop-lite?desktop=lite')");
    expect(match).toContain("if(lite)redirect('/desktop-lite?desktop=lite')");
  });

  it('keeps the native module shell visually separate from browser module chrome',async()=>{
    const shell=await readFile('components/desktop/DesktopModuleShell.tsx','utf8');
    const css=await readFile('app/native-modules.css','utf8');
    expect(shell).toContain('className="nd-module-rail"');
    expect(shell).toContain('className="nd-module-topbar"');
    expect(css).toContain('.nd-module-content .community-topbar,.nd-module-content .competitive-top{display:none!important}');
  });

  it('forces Windows rebuilds when native Community or competitive shell changes',async()=>{
    const workflow=await readFile('.github/workflows/desktop-windows.yml','utf8');
    expect(workflow).toContain("- 'app/community/**'");
    expect(workflow).toContain("- 'app/competitive/**'");
    expect(workflow).toContain("- 'app/native-modules.css'");
  });
});
