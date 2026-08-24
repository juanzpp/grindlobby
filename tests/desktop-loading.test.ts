import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';

describe('GrindLobby loading',()=>{
  it('uses only the official example 07 logo for fullscreen loading',async()=>{
    const component=await readFile('components/feedback/GrindPortalLoading.tsx','utf8');
    expect(component).toContain('/brand/grindlobby-official.png');
    expect(component).toContain('gl-logo-loader');
    expect(component).toContain('gl-logo-loader-image');
    expect(component).not.toContain('gl-desktop-portal-shell');
    expect(component).not.toContain('gl-gate-scene');
    expect(component).not.toContain('progressbar');
    expect(component).not.toContain('GRINDLOBBY</');
  });

  it('keeps the logo animation lightweight',async()=>{
    const css=await readFile('app/brand-official.css','utf8');
    expect(css).toContain('.gl-logo-loader');
    expect(css).toContain('.gl-logo-loader-orbit');
    expect(css).toContain('@keyframes grind-logo-breathe');
    expect(css).toContain('@keyframes grind-orbit-spin');
    expect(css).not.toContain('canvas');
    expect(css).not.toContain('WebGL');
  });

  it('keeps legacy portal CSS isolated from the active loading component',async()=>{
    const component=await readFile('components/feedback/GrindPortalLoading.tsx','utf8');
    expect(component).not.toContain('gl-desktop-energy-scan');
    expect(component).not.toContain('gl-desktop-spark');
    expect(component).not.toContain('gl-desktop-iris');
  });

  it('honors reduced-motion preferences for the active logo loader',async()=>{
    const css=await readFile('app/brand-official.css','utf8');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation: none');
  });
});
