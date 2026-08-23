import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';

describe('friends and direct messages contracts',()=>{
  it('ships authenticated, rate-limited friend routes',async()=>{
    const [friends,friendById,search]=await Promise.all([
      readFile('app/api/friends/route.ts','utf8'),
      readFile('app/api/friends/[id]/route.ts','utf8'),
      readFile('app/api/friends/search/route.ts','utf8'),
    ]);
    for(const source of [friends,friendById,search]){
      expect(source).toContain('getCurrentUser(request)');
      expect(source).toContain('enforceRateLimit');
      expect(source).toContain('noStoreJson');
    }
    expect(friends).toContain("from('friendships')");
    expect(friendById).toContain("from('friendships')");
    expect(search).toContain("from('profiles')");
  });

  it('only allows direct messages between accepted friends',async()=>{
    const messages=await readFile('app/api/messages/route.ts','utf8');
    expect(messages).toContain("status','accepted'");
    expect(messages).toContain('Mensagens diretas exigem amizade aceita.');
    expect(messages).toContain("from('direct_messages')");
    expect(messages).toContain('max(4000)');
    expect(messages).toContain("scope:'messages-send'");
  });

  it('keeps the production schema guard in sync with social tables',async()=>{
    const verifier=await readFile('scripts/verify-schema.mjs','utf8');
    expect(verifier).toContain('20260823_friends_direct_messages');
    expect(verifier).toContain('"friendships","direct_messages"');
  });

  it('enables real social tabs in the desktop build and voice reliability hardening',async()=>{
    const [vite,social,voice]=await Promise.all([
      readFile('desktop/ui/vite.config.mjs','utf8'),
      readFile('desktop/ui/social-tabs-transform.mjs','utf8'),
      readFile('desktop/ui/voice-reliability-transform.mjs','utf8'),
    ]);
    expect(vite).toContain('socialTabsTransformPlugin()');
    expect(vite).toContain('voiceReliabilityTransformPlugin()');
    expect(social).toContain('/api/friends');
    expect(social).toContain('/api/messages');
    expect(voice).toContain('RoomEvent.Reconnecting');
    expect(voice).toContain('RoomEvent.TrackUnsubscribed');
    expect(voice).toContain('setScreenShareEnabled(true,{audio:false})');
  });
});
