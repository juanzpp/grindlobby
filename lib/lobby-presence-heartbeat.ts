"use client";

type HeartbeatListener=(status:number)=>void;
type HeartbeatEntry={refs:number;timer:number|undefined;inFlight:boolean;listeners:Set<HeartbeatListener>};

const entries=new Map<string,HeartbeatEntry>();

async function ping(lobbyId:string,entry:HeartbeatEntry){
  if(entry.inFlight)return;
  entry.inFlight=true;
  try{
    const response=await fetch(`/api/lobbies/${lobbyId}/heartbeat`,{method:"POST",keepalive:true});
    if(!response.ok)for(const listener of entry.listeners)listener(response.status);
  }catch{
    // Presence is best-effort during transient network loss. LiveKit reconnect
    // and the next heartbeat will recover without tearing down the session.
  }finally{
    entry.inFlight=false;
  }
}

function start(lobbyId:string,entry:HeartbeatEntry){
  if(entry.timer!==undefined||typeof window==="undefined")return;
  void ping(lobbyId,entry);
  entry.timer=window.setInterval(()=>void ping(lobbyId,entry),10_000);
}

function stop(entry:HeartbeatEntry){
  if(entry.timer!==undefined&&typeof window!=="undefined")window.clearInterval(entry.timer);
  entry.timer=undefined;
}

export function retainLobbyPresenceHeartbeat(lobbyId:string,onFailure?:HeartbeatListener){
  if(!lobbyId)return()=>{};
  let entry=entries.get(lobbyId);
  if(!entry){entry={refs:0,timer:undefined,inFlight:false,listeners:new Set()};entries.set(lobbyId,entry)}
  entry.refs+=1;
  if(onFailure)entry.listeners.add(onFailure);
  start(lobbyId,entry);
  let released=false;
  return()=>{
    if(released)return;released=true;
    const current=entries.get(lobbyId);if(!current)return;
    if(onFailure)current.listeners.delete(onFailure);
    current.refs=Math.max(0,current.refs-1);
    if(current.refs===0){stop(current);entries.delete(lobbyId)}
  };
}

export function activeLobbyHeartbeatCount(){return entries.size}
