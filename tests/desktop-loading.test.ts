import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';

describe('desktop portal loading',()=>{
  it('keeps the cinematic portal free of visible progress bars and product-name copy',async()=>{
    const component=await readFile('components/feedback/GrindPortalLoading.tsx','utf8');
    expect(component).toContain('gl-desktop-portal-shell');
    expect(component).toContain('gl-desktop-energy-scan');
    expect(component).not.toContain('progressbar');
    expect(component).not.toContain('GRINDLOBBY</');
  });

  it('scopes the elaborate portal treatment to the native desktop runtime',async()=>{
    const css=await readFile('app/grind-loading-portal.css','utf8');
    expect(css).toContain('.gl-desktop-portal-shell{display:none}');
    expect(css).toContain('.grind-desktop-runtime .gl-desktop-portal-shell');
    expect(css).toContain('.grind-desktop-runtime .gl-loader-logo');
    expect(css).toContain('@keyframes glDesktopIris');
    expect(css).toContain('@keyframes glDesktopScan');
  });

  it('reduces decorative work for the Performance Windows client',async()=>{
    const css=await readFile('app/grind-loading-portal.css','utf8');
    expect(css).toContain('.grind-desktop-lite .gl-desktop-spark{display:none}');
    expect(css).toContain('.grind-desktop-lite .gl-desktop-orbit.orbit-c{display:none}');
  });

  it('honors reduced-motion preferences',async()=>{
    const css=await readFile('app/grind-loading-portal.css','utf8');
    expect(css).toContain('@media(prefers-reduced-motion:reduce)');
  });
});
