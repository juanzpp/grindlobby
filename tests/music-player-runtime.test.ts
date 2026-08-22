import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';

describe('Grind Beats YouTube runtime',()=>{
  it('waits for the real YouTube player ready event before loading or controlling media',async()=>{
    const source=await readFile('components/dashboard/LovableWidgets.tsx','utf8');
    expect(source).toContain('[apiReady,setApiReady]');
    expect(source).toContain('[playerReady,setPlayerReady]');
    expect(source).toContain('onReady:event=>{event.target.setVolume(latestRef.current.volume);setPlayerReady(true)}');
    expect(source).toContain('if(!playerReady||!player||track?.provider!=="youtube"||!track.videoId)return');
    expect(source).toContain('[playerReady,track?.provider,track?.videoId,playing,position]');
  });

  it('keeps YouTube event callbacks fresh instead of freezing the first queue state',async()=>{
    const source=await readFile('components/dashboard/LovableWidgets.tsx','utf8');
    expect(source).toContain('callbacksRef.current={onPlayingChange,onEnded,onPosition}');
    expect(source).toContain('const callbacks=callbacksRef.current');
    expect(source).toContain('callbacks.onEnded()');
    expect(source).toContain('callbacksRef.current.onPosition(value)');
  });

  it('restores the global iframe API callback only when it still owns it',async()=>{
    const source=await readFile('components/dashboard/LovableWidgets.tsx','utf8');
    expect(source).toContain('if(window.onYouTubeIframeAPIReady===handler)window.onYouTubeIframeAPIReady=previous');
  });
});
