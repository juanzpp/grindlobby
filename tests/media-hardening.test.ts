import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';
import {
  MAX_MICROPHONE_GAIN_PERCENT,
  MAX_OUTPUT_VOLUME_PERCENT,
  bitrateKbpsFromDelta,
  clampMediaPercent,
  microphoneLinearGain,
  perceptualPlaybackGain,
} from '../lib/webrtc/mediaPolicy';

describe('media hardening policy',()=>{
  it('clamps microphone/output gain to safe production ranges',()=>{
    expect(clampMediaPercent(-50,MAX_MICROPHONE_GAIN_PERCENT)).toBe(0);
    expect(clampMediaPercent(999,MAX_MICROPHONE_GAIN_PERCENT)).toBe(150);
    expect(microphoneLinearGain(100)).toBe(1);
    expect(microphoneLinearGain(200)).toBe(1.5);
    expect(clampMediaPercent(200,MAX_OUTPUT_VOLUME_PERCENT)).toBe(100);
  });

  it('uses a perceptual stream-volume curve so 5% is actually quiet',()=>{
    expect(perceptualPlaybackGain(5)).toBeCloseTo(0.0025,6);
    expect(perceptualPlaybackGain(50)).toBeCloseTo(0.25,6);
    expect(perceptualPlaybackGain(100)).toBe(1);
  });

  it('computes bitrate from byte deltas rather than lifetime counters',()=>{
    expect(bitrateKbpsFromDelta(1_500_000,1_000_000,15_000)).toBe(267);
    expect(bitrateKbpsFromDelta(2_000_000,null,15_000)).toBeNull();
    expect(bitrateKbpsFromDelta(900,1000,15_000)).toBeNull();
    expect(bitrateKbpsFromDelta(1000,900,0)).toBeNull();
  });

  it('survives a large deterministic telemetry/gain stress loop',()=>{
    let previous=0;
    for(let i=1;i<=50_000;i++){
      const current=previous+(i%8192);
      const bitrate=bitrateKbpsFromDelta(current,previous,15_000);
      expect(bitrate).not.toBeNull();
      expect(bitrate!).toBeGreaterThanOrEqual(0);
      expect(microphoneLinearGain(i%500)).toBeLessThanOrEqual(1.5);
      expect(perceptualPlaybackGain(i%500)).toBeLessThanOrEqual(1);
      previous=current;
    }
  });
});

describe('voice lifecycle regressions',()=>{
  it('never converts pagehide into an explicit lobby leave',async()=>{
    const source=await readFile('lib/webrtc/useLobbyVoice.ts','utf8');
    expect(source).not.toContain('sendBeacon');
    expect(source).not.toContain('pagehide');
    expect(source).toContain('disconnectOnPageLeave:false');
  });

  it('protects amplified microphone audio with a limiter',async()=>{
    const source=await readFile('lib/webrtc/useLobbyVoice.ts','utf8');
    expect(source).toContain('createDynamicsCompressor');
    expect(source).toContain('limiter.threshold.value=-3');
  });

  it('serializes microphone publication and invalidates stale session work',async()=>{
    const source=await readFile('lib/webrtc/useLobbyVoice.ts','utf8');
    expect(source).toContain('let microphonePublishQueue:Promise<void>=Promise.resolve()');
    expect(source).toContain('microphonePublishQueue=microphonePublishQueue.catch(()=>{}).then(operation)');
    expect(source).toContain('room!==activeRoom||sessionGeneration!==connectGeneration');
    expect(source).toContain('microphone-publish-failed');
  });

  it('stops raw microphone capture and processing after initial LiveKit failure',async()=>{
    const source=await readFile('lib/webrtc/useLobbyVoice.ts','utf8');
    expect(source).toContain('function stopRawMicrophoneStream');
    expect(source).toContain('if(stream){stopRawMicrophoneStream(stream);if(activeStream===stream)activeStream=null}');
    expect(source).toContain('cleanupMicProcessing();');
  });

  it('switches microphone devices transactionally before stopping the previous stream',async()=>{
    const source=await readFile('lib/webrtc/useLobbyVoice.ts','utf8');
    expect(source).toContain('const previous=activeStream');
    expect(source).toContain('await publishOrReplaceMicrophone(room,next)');
    expect(source).toContain('if(previous&&previous!==next)stopRawMicrophoneStream(previous)');
    expect(source).toContain('stopRawMicrophoneStream(next);');
  });

  it('explicitly stops local screen capture before a full LiveKit teardown',async()=>{
    const source=await readFile('lib/webrtc/useLobbyVoice.ts','utf8');
    const screenStop=source.indexOf('setScreenShareEnabled(false)');
    const roomDisconnect=source.indexOf('room.removeAllListeners();await room.disconnect()',screenStop);
    expect(screenStop).toBeGreaterThanOrEqual(0);
    expect(roomDisconnect).toBeGreaterThan(screenStop);
    expect(source).toContain('if(stopTracks&&room&&room.state!==ConnectionState.Disconnected)');
  });

  it('keeps voice telemetry compatible with Lovable bearer auth',async()=>{
    const source=await readFile('app/api/lobbies/[id]/voice/metrics/route.ts','utf8');
    expect(source).toContain('getCurrentUser(request)');
  });

  it('deduplicates repeated RTC stats and prevents overlapping telemetry reads',async()=>{
    const telemetry=await readFile('lib/webrtc/useVoiceTelemetry.ts','utf8');
    expect(telemetry).toContain('const seenStats=new Set<string>()');
    expect(telemetry).toContain('if(seenStats.has(stat.id))return');
    expect(telemetry).toContain('disposed=false,inFlight=false');
    expect(telemetry).toContain('if(disposed||!room||inFlight)return');
    expect(telemetry).toContain('finally{\n        inFlight=false;');
  });

  it('refreshes valid membership while issuing a token and rejects closed lobbies',async()=>{
    const token=await readFile('app/api/lobbies/[id]/voice/token/route.ts','utf8');
    expect(token).not.toContain('.gt("last_seen_at"');
    expect(token).toContain('update({last_seen_at:new Date().toISOString()})');
    expect(token).toContain('lobby.status!=="open"');
    expect(token).toContain('"grindlobby.screen.maxBitrate"');
  });

  it('recovers remote voice and persistent stream audio from autoplay blocks',async()=>{
    const voice=await readFile('components/RemoteVoiceAudio.tsx','utf8');
    const dock=await readFile('components/PersistentCallDock.tsx','utf8');
    expect(voice).toContain('blockedRemoteAudio');
    expect(voice).toContain('pointerdown');
    expect(dock).toContain('subscribeAudioOutput');
    expect(dock).toContain('audioBlocked');
    expect(dock).toMatch(/element\.play\(\)\.then\(\(\)=>\{setAudioBlocked\(false\);window\.removeEventListener/);
  });

  it('keeps a visible stop control when the local screen share outlives the lobby page',async()=>{
    const dock=await readFile('components/PersistentCallDock.tsx','utf8');
    expect(dock).toContain('setLiveKitScreenShareEnabled');
    expect(dock).toContain('const localShare=session.screenSharers.find');
    expect(dock).toContain('Sua tela está ao vivo');
    expect(dock).toContain('Parar transmissão');
    expect(dock).toContain('!lite&&!inLobby&&remoteShares.length');
  });

  it('keeps desktop diagnostics opt-in and serializes expensive samples',async()=>{
    const diagnostics=await readFile('components/desktop/DesktopPerformanceDiagnostics.tsx','utf8');
    expect(diagnostics).toMatch(/useEffect\(\(\)=>\{\s*if\(!lite\)return;\s*return subscribeActiveLiveKitRoom/);
    expect(diagnostics).toContain('sampleInFlight=false');
    expect(diagnostics).toContain('if(disposed||sampleInFlight)return');
    expect(diagnostics).toContain('const seenStats=new Set<string>()');
    expect(diagnostics).toContain('if(seenStats.has(entry.id))return');
  });
});
