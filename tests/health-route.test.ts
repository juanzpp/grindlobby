import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';

describe('production health endpoint',()=>{
  it('stays public, dynamic and explicitly non-cacheable',async()=>{
    const source=await readFile('app/api/health/route.ts','utf8');
    expect(source).toContain('export const dynamic = "force-dynamic"');
    expect(source).toContain('ok: true');
    expect(source).toContain('status: 200');
    expect(source).toContain('"Cache-Control": "no-store, max-age=0"');
  });
});
