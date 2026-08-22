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

  it('keeps voice telemetry compatible with Lovable bearer auth',async()=>{
    const source=await readFile('app/api/lobbies/[id]/voice/metrics/route.ts','utf8');
    expect(source).toContain('getCurrentUser(request)');
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
});
