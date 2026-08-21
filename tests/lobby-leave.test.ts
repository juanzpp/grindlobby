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
})
