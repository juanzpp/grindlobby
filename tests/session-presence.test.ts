import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';
import {fixNativeBridge} from '../desktop/ui/native-bridge-transform.mjs';

describe('session presence recovery',()=>{
  it('mounts a web heartbeat for authenticated sessions',async()=>{
    const component=await readFile('components/SessionPresenceHeartbeat.tsx','utf8');
    const layout=await readFile('app/layout.tsx','utf8');
    expect(component).toContain('/api/me/presence');
    expect(component).toContain('HEARTBEAT_MS=20_000');
    expect(layout).toContain('<SessionPresenceHeartbeat/>');
  });

  it('marks stale online profiles offline during heartbeat',async()=>{
    const route=await readFile('app/api/me/presence/route.ts','utf8');
    expect(route).toContain('STALE_AFTER_MS=75_000');
    expect(route).toContain('.lt("last_seen_at",cutoff)');
    expect(route).toContain('.update({status:"offline"})');
  });

  it('keeps native authenticated sessions fresh',async()=>{
    const source=await readFile('desktop/ui/src/main.jsx','utf8');
    const transformed=fixNativeBridge(source);
    expect(transformed).toContain('session!=="ready"');
    expect(transformed).toContain('/api/me/presence');
    expect(transformed).toContain('window.setInterval(beat,20000)');
  });

  it('codifies a safe production network bind',async()=>{
    const launcher=await readFile('scripts/start-production.mjs','utf8');
    const pkg=JSON.parse(await readFile('package.json','utf8'));
    expect(launcher).toContain('"0.0.0.0"');
    expect(pkg.scripts.start).toContain('scripts/start-production.mjs');
  });
});
