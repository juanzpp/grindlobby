import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';

describe('AudioHost lifecycle',()=>{
  it('keeps subscription callbacks fresh without resubscribing on every render',async()=>{
    const source=await readFile('components/AudioHost.tsx','utf8');
    expect(source).toContain('function useLatestRef<T>(value:T)');
    expect(source).toContain('const onStreamChangeRef=useLatestRef(onStreamChange)');
    expect(source).toContain('const startMeterRef=useLatestRef(startMeter)');
    expect(source).toContain('const stopMicTestRef=useLatestRef(stopMicTest)');
    expect(source).toContain('onStreamChangeRef.current?.(existing)');
    expect(source).toContain('startMeterRef.current(existing)');
  });

  it('clears parent microphone state when the active LiveKit room disappears',async()=>{
    const source=await readFile('components/AudioHost.tsx','utf8');
    expect(source).toContain('if(stream.current){stopMeter();stream.current=null;setActive(false);onStreamChangeRef.current?.(null)}');
  });

  it('uses the latest microphone-test cleanup during unmount',async()=>{
    const source=await readFile('components/AudioHost.tsx','utf8');
    expect(source).toContain('stopMicTestRef.current(false);stopMeter();');
  });
});
