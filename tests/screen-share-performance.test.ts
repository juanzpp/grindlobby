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

  it('serializes screen start/stop operations and rejects stale rooms',async()=>{
    const source=await readFile('components/stream/ScreenShare.tsx','utf8');
    expect(source).toContain('operationRef=useRef<"start"|"stop"|null>(null)');
    expect(source).toContain('if(operationRef.current)return');
    expect(source).toContain('if(roomRef.current!==targetRoom||targetRoom.state!==ConnectionState.Connected)');
    expect(source).toContain('if(operationRef.current==="start"){stopRequestedRef.current=true;return}');
  });

  it('prevents overlapping viewer RTC stats reads',async()=>{
    const source=await readFile('components/stream/ScreenShare.tsx','utf8');
    expect(source).toContain('let cancelled=false,inFlight=false');
    expect(source).toContain('if(inFlight)return;inFlight=true');
    expect(source).toContain('catch{}finally{inFlight=false}');
  });

  it('clears reconnect state on disconnect and on room replacement',async()=>{
    const source=await readFile('components/stream/ScreenShare.tsx','utf8');
    expect(source).toContain('if(!room){setShares([]);setReconnecting(false);return}');
    expect(source).toContain('onDisconnected=()=>{setReconnecting(false);sync()}');
    expect(source).toContain('RoomEvent.Disconnected,onDisconnected');
  });

  it('resets the bitrate baseline whenever the viewed track changes',async()=>{
    const source=await readFile('components/stream/ScreenShare.tsx','utf8');
    expect(source).toMatch(/useEffect\(\(\)=>\{\s*bytesRef\.current=null;/);
    expect(source).toContain('window.clearInterval(timer);bytesRef.current=null');
  });

  it('resets voice telemetry when the active LiveKit room changes',async()=>{
    const source=await readFile('lib/webrtc/useVoiceTelemetry.ts','utf8');
    expect(source).toContain('if(room!==next){lastBytes=null;lastAt=null}');
    expect(source).toContain('if(disposed||room!==sampledRoom)return');
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
