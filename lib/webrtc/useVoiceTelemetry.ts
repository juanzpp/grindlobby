"use client";

import {useEffect} from "react";
import {ConnectionState,LocalAudioTrack,RemoteAudioTrack,Track,type Room} from "livekit-client";
import {subscribeActiveLiveKitRoom} from "@/lib/webrtc/useLobbyVoice";

type Sample={connectionState:"connected"|"reconnecting"|"disconnected";rttMs:number|null;jitterMs:number|null;packetsLost:number|null;packetsReceived:number|null;bitrateKbps:number|null;participantCount:number};

async function readStats(room:Room):Promise<Sample>{
  const tracks:(LocalAudioTrack|RemoteAudioTrack)[]=[];
  const local=room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
  if(local instanceof LocalAudioTrack)tracks.push(local);
  for(const participant of room.remoteParticipants.values()){
    const track=participant.getTrackPublication(Track.Source.Microphone)?.track;
    if(track instanceof RemoteAudioTrack)tracks.push(track);
  }
  let rtt:number|null=null,jitter:number|null=null,lost=0,received=0,bytes=0;
  for(const track of tracks){
    try{
      const report=await track.getRTCStatsReport();
      report?.forEach(stat=>{
        const row=stat as RTCStats&{currentRoundTripTime?:number;roundTripTime?:number;jitter?:number;packetsLost?:number;packetsReceived?:number;bytesReceived?:number;bytesSent?:number;state?:string};
        if(row.type==="candidate-pair"&&row.state==="succeeded"&&typeof row.currentRoundTripTime==="number")rtt=rtt===null?row.currentRoundTripTime*1000:Math.min(rtt,row.currentRoundTripTime*1000);
        if(row.type==="remote-inbound-rtp"&&typeof row.roundTripTime==="number")rtt=rtt===null?row.roundTripTime*1000:Math.min(rtt,row.roundTripTime*1000);
        if((row.type==="inbound-rtp"||row.type==="remote-inbound-rtp")&&typeof row.jitter==="number")jitter=Math.max(jitter??0,row.jitter*1000);
        if(typeof row.packetsLost==="number"&&row.packetsLost>0)lost+=row.packetsLost;
        if(typeof row.packetsReceived==="number"&&row.packetsReceived>0)received+=row.packetsReceived;
        if(typeof row.bytesReceived==="number")bytes+=row.bytesReceived;
        if(typeof row.bytesSent==="number")bytes+=row.bytesSent;
      });
    }catch{}
  }
  return {connectionState:room.state===ConnectionState.Reconnecting?"reconnecting":room.state===ConnectionState.Connected?"connected":"disconnected",rttMs:rtt===null?null:Math.round(rtt),jitterMs:jitter===null?null:Math.round(jitter*1000)/1000,packetsLost:lost||null,packetsReceived:received||null,bitrateKbps:bytes?Math.round((bytes*8/1000)/15):null,participantCount:room.numParticipants};
}

export function useVoiceTelemetry(lobbyId:string,enabled:boolean){
  useEffect(()=>{
    if(!enabled)return;
    let room:Room|null=null,disposed=false;
    const unsubscribe=subscribeActiveLiveKitRoom(next=>{room=next});
    const send=async()=>{
      if(disposed||!room)return;
      const sample=await readStats(room);
      if(disposed)return;
      void fetch(`/api/lobbies/${lobbyId}/voice/metrics`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(sample),keepalive:true}).catch(()=>{});
    };
    const timer=window.setInterval(()=>void send(),15_000);
    void send();
    return()=>{disposed=true;window.clearInterval(timer);unsubscribe()};
  },[lobbyId,enabled]);
}
