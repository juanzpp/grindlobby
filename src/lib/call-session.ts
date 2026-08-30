export type CallMetrics={rttMs:number|null;bitrateKbps:number|null;packetsLost:number|null;updatedAt:number|null};
export type CallSnapshot={lobbyId:string|null;micStream:MediaStream|null;muted:boolean;startedAt:number|null;metrics:CallMetrics};
let state:CallSnapshot={lobbyId:null,micStream:null,muted:false,startedAt:null,metrics:{rttMs:null,bitrateKbps:null,packetsLost:null,updatedAt:null}};
const listeners=new Set<()=>void>();function emit(){listeners.forEach(fn=>fn())}
export const callSession={
 get snapshot(){return state},
 subscribe(fn:()=>void){listeners.add(fn);return()=>listeners.delete(fn)},
 attach(lobbyId:string,stream:MediaStream){if(state.micStream&&state.micStream!==stream)state.micStream.getTracks().forEach(t=>t.stop());state={...state,lobbyId,micStream:stream,muted:!stream.getAudioTracks().some(t=>t.enabled),startedAt:state.lobbyId===lobbyId&&state.startedAt?state.startedAt:Date.now()};emit()},
 setMuted(muted:boolean){state.micStream?.getAudioTracks().forEach(t=>{t.enabled=!muted});state={...state,muted};emit()},
 setMetrics(patch:Partial<CallMetrics>){state={...state,metrics:{...state.metrics,...patch,updatedAt:Date.now()}};emit()},
 leave(){
  const leavingLobbyId=state.lobbyId;
  state.micStream?.getTracks().forEach(t=>t.stop());
  state={lobbyId:null,micStream:null,muted:false,startedAt:null,metrics:{rttMs:null,bitrateKbps:null,packetsLost:null,updatedAt:null}};
  emit();
  if(leavingLobbyId&&typeof window!=="undefined"){
   void import("@/lib/livekit-session").then(({livekitSession})=>{
    if(livekitSession.snapshot.lobbyId===leavingLobbyId)void livekitSession.disconnect(false);
   }).catch(()=>{});
  }
 },
};
