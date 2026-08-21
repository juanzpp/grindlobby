import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';
import {shouldUseScreenSimulcast} from '../lib/webrtc/mediaPolicy';

describe('screen share performance policy',()=>{
  it('uses a single encode layer for 720p30 and below',()=>{
    expect(shouldUseScreenSimulcast(360,30)).toBe(false);
    expect(shouldUseScreenSimulcast(480,30)).toBe(false);
    expect(shouldUseScreenSimulcast(720,30)).toBe(false);
  });

  it('keeps adaptive layers for high-cost Pro capture',()=>{
    expect(shouldUseScreenSimulcast(1080,60)).toBe(true);
  });

  it('wires the production publisher to the policy',async()=>{
    const source=await readFile('components/stream/ScreenShare.tsx','utf8');
    expect(source).toContain('simulcast:shouldUseScreenSimulcast');
    expect(source).not.toContain('simulcast:true');
  });

  it('remains stable under repeated quality decisions',()=>{
    let adaptive=0,single=0;
    for(let i=0;i<100_000;i++){
      const high=i%7===0;
      const enabled=shouldUseScreenSimulcast(high?1080:720,high?60:30);
      if(enabled)adaptive++;else single++;
    }
    expect(adaptive).toBeGreaterThan(0);
    expect(single).toBeGreaterThan(adaptive);
  });
});
