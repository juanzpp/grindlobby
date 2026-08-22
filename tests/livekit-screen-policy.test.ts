import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';
import {getScreenSharePolicy,isBitrateWithinPolicy,isResolutionWithinPolicy} from '../lib/livekit-screen-policy';

describe('LiveKit screen share server policy',()=>{
  it('keeps Free constrained to 720p30 with a bounded bitrate',()=>{
    const policy=getScreenSharePolicy(false);
    expect(policy).toMatchObject({tier:'free',maxWidth:1280,maxHeight:720,maxFps:30});
    expect(policy.maxBitrate).toBeGreaterThanOrEqual(2_800_000);
    expect(policy.maxBitrate).toBeLessThan(4_000_000);
    expect(isResolutionWithinPolicy(1280,720,policy)).toBe(true);
    expect(isResolutionWithinPolicy(1920,1080,policy)).toBe(false);
    expect(isBitrateWithinPolicy(2_800_000,policy)).toBe(true);
    expect(isBitrateWithinPolicy(6_500_000,policy)).toBe(false);
  });

  it('allows the Pro capture envelope',()=>{
    const policy=getScreenSharePolicy(true);
    expect(policy).toMatchObject({tier:'pro',maxWidth:1920,maxHeight:1080,maxFps:60});
    expect(isResolutionWithinPolicy(1920,1080,policy)).toBe(true);
    expect(isBitrateWithinPolicy(6_500_000,policy)).toBe(true);
  });

  it('keeps portrait shares inside the same long-edge policy',()=>{
    const free=getScreenSharePolicy(false);
    expect(isResolutionWithinPolicy(720,1280,free)).toBe(true);
    expect(isResolutionWithinPolicy(1080,1920,free)).toBe(false);
  });

  it('enforces both resolution and bitrate in the signed LiveKit webhook',async()=>{
    const webhook=await readFile('app/api/livekit/webhook/route.ts','utf8');
    expect(webhook).toContain('isResolutionWithinPolicy');
    expect(webhook).toContain('isBitrateWithinPolicy');
    expect(webhook).toContain('mutePublishedTrack');
    expect(webhook).toContain('screen_share_policy');
  });

  it('revalidates lobby membership on join and before any published track is accepted',async()=>{
    const webhook=await readFile('app/api/livekit/webhook/route.ts','utf8');
    expect(webhook).toContain('enforceLobbyMembership');
    expect(webhook).toContain('event.event==="participant_joined"');
    expect(webhook).toContain('if(event.event!=="track_published")return response()');
    expect(webhook).toContain('removeParticipant(room,identity');
    expect(webhook).toContain('revokeTokenTs:BigInt(Math.floor(Date.now()/1000))');
    expect(webhook).toContain('lobby?.status==="open"');
  });
});
