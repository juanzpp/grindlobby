"use client";
import {useEffect,useRef,useState} from "react";
import {voiceIceServers} from "@/lib/webrtc/config";

type Signal={id:number;sender_id:string;target_id:string|null;signal_type:"offer"|"answer"|"ice-candidate"|"leave";payload:RTCSessionDescriptionInit|RTCIceCandidateInit};
export type RemoteVoicePeer={userId:string;stream:MediaStream|null;status:"Connecting"|"Connected"|"Reconnecting";speaking:boolean;volume:number;muted:boolean};

type PeerEntry={pc:RTCPeerConnection;remoteStream:MediaStream|null;iceQueue:RTCIceCandidateInit[];retryTimer?:number;analyser?:AnalyserNode;audioContext?:AudioContext;raf?:number};

const devLog=(event:string,details:Record<string,unknown>={})=>{
 if(process.env.NODE_ENV==="development")console.debug(`[voice] ${event}`,details);
};

export function useLobbyVoice(lobbyId:string,localUserId:string,members:string[],localStream:MediaStream|null){
 const [remotePeers,setRemotePeers]=useState<RemoteVoicePeer[]>([]);
 const entries=useRef(new Map<string,PeerEntry>());
 const cursor=useRef(0);
 const pollBusy=useRef(false);
 const mounted=useRef(true);
 const localStreamRef=useRef<MediaStream|null>(localStream);
 const memberKey=members.filter(id=>id!==localUserId).sort().join(",");
 const activeMembers=useRef(members);
 activeMembers.current=members;

 function updatePeer(userId:string,patch:Partial<RemoteVoicePeer>){
  if(!mounted.current)return;
  setRemotePeers(current=>current.map(peer=>peer.userId===userId?{...peer,...patch}:peer));
 }
 function addPeerState(userId:string,status:RemoteVoicePeer["status"]="Connecting"){
  setRemotePeers(current=>current.some(peer=>peer.userId===userId)?current:[...current,{userId,stream:null,status,speaking:false,volume:100,muted:false}]);
 }
 async function sendSignal(targetId:string,type:Signal["signal_type"],payload:Signal["payload"]){
  const response=await fetch(`/api/lobbies/${lobbyId}/voice/signals`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({targetId,type,payload})}).catch(()=>null);
  if(!response?.ok){devLog("signal-post-failed",{type,targetId,status:response?.status,error:response?await response.text().catch(()=>"unreadable"):"network-error"});return false;}
  if(type==="offer")devLog("offer-sent",{targetId});
  if(type==="answer")devLog("answer-sent",{targetId});
  if(type==="ice-candidate")devLog("ice-sent",{targetId});
  return true;
 }
 function stopAnalyser(entry:PeerEntry){
  if(entry.raf)cancelAnimationFrame(entry.raf);
  entry.audioContext?.close().catch(()=>{});
  entry.raf=undefined;entry.analyser=undefined;entry.audioContext=undefined;
 }
 function startAnalyser(userId:string,entry:PeerEntry,stream:MediaStream){
  stopAnalyser(entry);
  try{
   const context=new AudioContext();
   const analyser=context.createAnalyser();
   analyser.fftSize=256;
   context.createMediaStreamSource(stream).connect(analyser);
   entry.audioContext=context;entry.analyser=analyser;
   const data=new Uint8Array(analyser.frequencyBinCount);
   const tick=()=>{
    if(!entries.current.has(userId))return;
    analyser.getByteFrequencyData(data);
    const average=data.reduce((sum,value)=>sum+value,0)/data.length;
    updatePeer(userId,{speaking:average>10});
    entry.raf=requestAnimationFrame(tick);
   };
   tick();
  }catch{}
 }
 function closePeer(userId:string,keepState=false){
  const entry=entries.current.get(userId);
  if(!entry)return;
  if(entry.retryTimer)window.clearTimeout(entry.retryTimer);
  stopAnalyser(entry);
  entry.pc.onicecandidate=null;entry.pc.ontrack=null;entry.pc.onconnectionstatechange=null;
  entry.pc.close();
  entries.current.delete(userId);
  if(!keepState)setRemotePeers(current=>current.filter(peer=>peer.userId!==userId));
 }
 function scheduleReconnect(userId:string){
  const entry=entries.current.get(userId);
  if(entry?.retryTimer)return;
  updatePeer(userId,{status:"Reconnecting",stream:null,speaking:false});
  const retry=window.setTimeout(()=>{
  if(!activeMembers.current.includes(userId)||!localStreamRef.current)return;
   closePeer(userId,true);
   createPeer(userId,localUserId<userId).catch(()=>{});
  },1500);
  if(entry)entry.retryTimer=retry;
 }
  async function createPeerInternal(userId:string,initiator:boolean){
  const currentStream=localStreamRef.current;
  if(!currentStream||entries.current.has(userId))return;
  devLog("peer-created",{userId,role:initiator?"offerer":"receiver",localUserId});
  addPeerState(userId);
  const pc=new RTCPeerConnection({iceServers:voiceIceServers});
  const entry:PeerEntry={pc,remoteStream:null,iceQueue:[]};
  entries.current.set(userId,entry);
  currentStream.getAudioTracks().forEach(track=>{
   track.onended=()=>devLog("local-track-ended",{userId,trackId:track.id});
   const transceiver=pc.addTransceiver(track,{direction:"sendrecv"});
   const codecs=RTCRtpSender.getCapabilities?.("audio")?.codecs??[];
   const opus=codecs.filter(codec=>codec.mimeType.toLowerCase()==="audio/opus");
  if(opus.length){
   try{transceiver.setCodecPreferences([...opus,...codecs.filter(codec=>codec.mimeType.toLowerCase()!=="audio/opus")]);}
   catch(error){devLog("codec-preference-failed",{userId,error:String(error)});}
  }
  });
  pc.onicecandidate=event=>{if(event.candidate)sendSignal(userId,"ice-candidate",event.candidate.toJSON()).catch(error=>devLog("ice-send-error",{userId,error:String(error)}));};
  pc.ontrack=event=>{
   const stream=event.streams[0]||new MediaStream([event.track]);
    devLog("remote-track-received",{userId,trackId:event.track.id});
   entry.remoteStream=stream;
   updatePeer(userId,{stream,status:"Connected"});
   startAnalyser(userId,entry,stream);
  };
  pc.onconnectionstatechange=()=>{
    devLog("connection-state",{userId,state:pc.connectionState});
   if(pc.connectionState==="connected")updatePeer(userId,{status:"Connected"});
   if(["failed","disconnected","closed"].includes(pc.connectionState))scheduleReconnect(userId);
  };
  if(initiator){
    const offer=await pc.createOffer({offerToReceiveAudio:true});
    devLog("offer-created",{userId});
    await pc.setLocalDescription(offer);
    await sendSignal(userId,"offer",offer);
  }
 }
 async function createPeer(userId:string,initiator:boolean){
  try{await createPeerInternal(userId,initiator);}
  catch(error){
   devLog("peer-create-failed",{userId,initiator,error:String(error)});
   closePeer(userId);
   updatePeer(userId,{status:"Reconnecting"});
  }
 }
 async function handleSignal(signal:Signal){
  if(signal.sender_id===localUserId)return;
  if(signal.signal_type==="leave"){closePeer(signal.sender_id);return;}
  if(!activeMembers.current.includes(signal.sender_id)||!localStreamRef.current)return;
  if(signal.signal_type==="offer"){
    devLog("offer-received",{senderId:signal.sender_id});
   if(!entries.current.has(signal.sender_id))await createPeer(signal.sender_id,false);
   const entry=entries.current.get(signal.sender_id);if(!entry)return;
   await entry.pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
   for(const candidate of entry.iceQueue)await entry.pc.addIceCandidate(candidate).catch(()=>{});
   entry.iceQueue=[];
   const answer=await entry.pc.createAnswer();
   await entry.pc.setLocalDescription(answer);
   await sendSignal(signal.sender_id,"answer",answer);
  }else if(signal.signal_type==="answer"){
  devLog("answer-received",{senderId:signal.sender_id});
   const entry=entries.current.get(signal.sender_id);if(!entry)return;
   await entry.pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
   for(const candidate of entry.iceQueue)await entry.pc.addIceCandidate(candidate).catch(()=>{});
   entry.iceQueue=[];
  }else if(signal.signal_type==="ice-candidate"){
   if(!entries.current.has(signal.sender_id))await createPeer(signal.sender_id,localUserId<signal.sender_id);
   const entry=entries.current.get(signal.sender_id);if(!entry)return;
   const candidate=signal.payload as RTCIceCandidateInit;
  devLog("ice-received",{senderId:signal.sender_id});
   if(entry.pc.remoteDescription)await entry.pc.addIceCandidate(candidate).catch(()=>{});else entry.iceQueue.push(candidate);
  }
 }
 async function poll(){
  if(pollBusy.current)return;
  pollBusy.current=true;
  const response=await fetch(`/api/lobbies/${lobbyId}/voice/signals?after=${cursor.current}`,{cache:"no-store"}).catch(()=>null);
  try{
   if(!response?.ok)return;
   const result=await response.json() as {signals:Signal[];cursor:number};
   for(const signal of result.signals)await handleSignal(signal);
   cursor.current=result.cursor;
  }finally{pollBusy.current=false;}
 }
 useEffect(()=>{
  mounted.current=true;
  if(!localStreamRef.current){setRemotePeers([]);return()=>{mounted.current=false};}
    const otherMembers=activeMembers.current.filter(id=>id!==localUserId);
  for(const userId of otherMembers)createPeer(userId,localUserId<userId).catch(()=>{});
  const timer=window.setInterval(()=>poll().catch(()=>{}),500);
  return()=>{
   mounted.current=false;window.clearInterval(timer);
     for(const userId of [...entries.current.keys()])sendSignal(userId,"leave",{}).catch(()=>{});
   for(const userId of [...entries.current.keys()])closePeer(userId);
   entries.current.clear();setRemotePeers([]);
  };
 },[lobbyId,localUserId]);
 useEffect(()=>{
  const previous=localStreamRef.current;
  localStreamRef.current=localStream;
  if(!localStream)return;
  if(previous&&previous!==localStream){
  const newTrack=localStream.getAudioTracks()[0];
  for(const [userId,entry] of entries.current){
   const sender=entry.pc.getSenders().find(item=>item.track?.kind==="audio");
    if(sender&&newTrack){
     newTrack.onended=()=>devLog("local-track-ended",{userId,trackId:newTrack.id});
     sender.replaceTrack(newTrack).then(()=>devLog("local-track-replaced",{userId,trackId:newTrack.id})).catch(error=>devLog("local-track-replace-failed",{userId,error:String(error)}));
    }
  }
  return;
  }
  for(const userId of activeMembers.current.filter(id=>id!==localUserId))createPeer(userId,localUserId<userId).catch(()=>{});
 },[localStream,localUserId]);
 useEffect(()=>{
   if(!localStreamRef.current)return;
    for(const userId of [...entries.current.keys()])if(!members.includes(userId)){
     sendSignal(userId,"leave",{}).catch(()=>{});
     closePeer(userId);
    }
    for(const userId of members.filter(id=>id!==localUserId))createPeer(userId,localUserId<userId).catch(()=>{});
 },[memberKey]);
 function setPeerVolume(userId:string,volume:number){setRemotePeers(current=>current.map(peer=>peer.userId===userId?{...peer,volume}:peer));}
 function togglePeerMuted(userId:string){setRemotePeers(current=>current.map(peer=>peer.userId===userId?{...peer,muted:!peer.muted}:peer));}
 function notifyVoiceLeave(){
  for(const userId of [...entries.current.keys()])sendSignal(userId,"leave",{}).catch(()=>{});
  for(const userId of [...entries.current.keys()])closePeer(userId);
 }
 return {remotePeers,setPeerVolume,togglePeerMuted,notifyVoiceLeave};
}
