import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';
import {bitrateKbpsFromDelta,microphoneLinearGain,perceptualPlaybackGain} from '../lib/webrtc/mediaPolicy';

describe('desktop session soak regressions',()=>{
  it('keeps media policy bounded across repeated desktop session cycles',()=>{
    let previousBytes=0;
    let checksum=0;
    for(let session=0;session<100;session++){
      for(let step=1;step<=200;step++){
        const gain=(session*17+step*13)%501;
        const output=(session*11+step*7)%501;
        const nextBytes=previousBytes+200_000+((session+step)%8192);
        const bitrate=bitrateKbpsFromDelta(nextBytes,previousBytes,15_000);
        expect(bitrate).not.toBeNull();
        expect(bitrate!).toBeGreaterThan(0);
        expect(microphoneLinearGain(gain)).toBeGreaterThanOrEqual(0);
        expect(microphoneLinearGain(gain)).toBeLessThanOrEqual(1.5);
        expect(perceptualPlaybackGain(output)).toBeGreaterThanOrEqual(0);
        expect(perceptualPlaybackGain(output)).toBeLessThanOrEqual(1);
        checksum+=bitrate!;
        previousBytes=nextBytes;
      }
    }
    expect(checksum).toBeGreaterThan(0);
  });

  it('retains serialized microphone publication and device switching guards',async()=>{
    const voice=await readFile('lib/webrtc/useLobbyVoice.ts','utf8');
    expect(voice).toContain('let microphonePublishQueue:Promise<void>=Promise.resolve()');
    expect(voice).toContain('let microphoneSwitchQueue:Promise<unknown>=Promise.resolve()');
    expect(voice).toContain('microphonePublishQueue=microphonePublishQueue.catch(()=>{}).then(operation)');
    expect(voice).toContain('const result=microphoneSwitchQueue.catch(()=>{}).then(operation)');
    expect(voice).toContain('microphoneSwitchQueue=result.then(()=>undefined,()=>undefined)');
    expect(voice).toContain('room!==activeRoom||sessionGeneration!==connectGeneration');
  });

  it('keeps full teardown ordered after local screen-share shutdown',async()=>{
    const voice=await readFile('lib/webrtc/useLobbyVoice.ts','utf8');
    const shareStop=voice.indexOf('setScreenShareEnabled(false)');
    const roomDisconnect=voice.indexOf('room.removeAllListeners();await room.disconnect()',shareStop);
    expect(shareStop).toBeGreaterThanOrEqual(0);
    expect(roomDisconnect).toBeGreaterThan(shareStop);
  });

  it('keeps native mode sticky while the desktop call survives navigation',async()=>{
    const runtime=await readFile('components/DesktopRuntimeMode.tsx','utf8');
    const dock=await readFile('components/PersistentCallDock.tsx','utf8');
    expect(runtime).toContain('const runtimeKey="grindlobby.desktop.runtime"');
    expect(runtime).toContain('sessionStorage.setItem(runtimeKey,requested)');
    expect(runtime).toContain('sessionStorage.getItem(runtimeKey)');
    expect(dock).toContain('subscribeVoiceSession');
    expect(dock).toContain('setLiveKitScreenShareEnabled');
  });
});