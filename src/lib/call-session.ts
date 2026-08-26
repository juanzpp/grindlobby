type CallMetrics={rttMs:number|null;bitrateKbps:number|null;packetsLost:number|null;updatedAt:number|null};
type CallSnapshot={lobbyId:string|null;micStream:MediaStream|null;muted:boolean;startedAt:number|null;metrics:CallMetrics};
const state:CallSnapshot={lobbyId:null,micStream:null,muted:false,startedAt:null,metrics:{rttMs:null,bitrateKbps:null,packetsLost:null,updatedAt:null}};
const listeners=new Set<()=>void>();
function emit(){listeners.forEach(fn=>fn())}
export const callSession={
 get snapshot(){return state},
 subscribe(fn:()=>void){listeners.add(fn);return()=>listeners.delete(fn)},
 attach(lobbyId:string,stream:MediaStream){if(state.micStream&&state.micStream!==stream)state.micStream.getTracks().forEach(t=>t.stop());if(state.lobbyId!==lobbyId)state.startedAt=Date.now();state.lobbyId=lobbyId;state.micStream=stream;state.muted=!stream.getAudioTracks().some(t=>t.enabled);emit()},
 setMuted(muted:boolean){state.muted=muted;state.micStream?.getAudioTracks().forEach(t=>{t.enabled=!muted});emit()},
 setMetrics(patch:Partial<CallMetrics>){state.metrics={...state.metrics,...patch,updatedAt:Date.now()};emit()},
 leave(){state.micStream?.getTracks().forEach(t=>t.stop());state.lobbyId=null;state.micStream=null;state.muted=false;state.startedAt=null;state.metrics={rttMs:null,bitrateKbps:null,packetsLost:null,updatedAt:null};emit()},
};
