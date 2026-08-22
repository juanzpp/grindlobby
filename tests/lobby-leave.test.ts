import {readFile} from 'node:fs/promises'
import {describe,expect,it} from 'vitest'
import {isExplicitLobbyLeave} from '@/lib/lobby-leave'

describe('lobby leave intent',()=>{
  it('treats a normal explicit POST as leave',()=>{
    const request=new Request('https://grindlobby.onrender.com/api/lobbies/00000000-0000-0000-0000-000000000001/leave',{method:'POST',headers:{'sec-fetch-mode':'cors'}})
    expect(isExplicitLobbyLeave(request)).toBe(true)
  })

  it('defers pagehide/sendBeacon traffic',()=>{
    const beacon=new Request('https://grindlobby.onrender.com/api/lobbies/00000000-0000-0000-0000-000000000001/leave',{method:'POST',headers:{'sec-fetch-mode':'no-cors','content-type':'application/json'}})
    expect(isExplicitLobbyLeave(beacon)).toBe(false)
  })

  it('allows a decoupled frontend to mark JSON leave explicitly',()=>{
    const request=new Request('https://grindlobby.onrender.com/api/lobbies/00000000-0000-0000-0000-000000000001/leave?intent=explicit',{method:'POST',headers:{'content-type':'application/json','sec-fetch-mode':'cors'}})
    expect(isExplicitLobbyLeave(request)).toBe(true)
  })

  it('revokes LiveKit access after an explicit membership leave',async()=>{
    const route=await readFile('app/api/lobbies/[id]/leave/route.ts','utf8')
    const livekit=await readFile('lib/livekit-admin.ts','utf8')
    expect(route).toContain('disconnectLobbyParticipant(id,user.id)')
    expect(route).toContain('closeLiveKitLobbyRoom(id)')
    expect(livekit).toContain('removeParticipant(liveKitLobbyRoomName(lobbyId),userId')
    expect(livekit).toContain('revokeTokenTs:BigInt(Math.floor(Date.now()/1000))')
    expect(livekit).toContain('deleteRoom(liveKitLobbyRoomName(lobbyId))')
  })
})
