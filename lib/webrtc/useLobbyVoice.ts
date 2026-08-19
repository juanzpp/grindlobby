"use client";
import {useEffect,useRef,useState} from "react";
import {voiceIceServers} from "@/lib/webrtc/config";

type Signal={id:number;sender_id:string;target_id:string|null;signal_type:"offer"|"answer"|"ice-candidate"|"leave";payload:RTCSessionDescriptionInit|RTCIceCandidateInit};
export type RemoteVoicePeer={userId:string;stream:MediaStream|null;status:"Connecting"|"Connected"|"Reconnecting";speaking:boolean;volume:number;muted:boolean};

type PeerEntry={pc:RTCPeerConnection;remoteStream:MediaStream|null;iceQueue:RTCIceCandidateInit[];retryTimer?:number;answering?:boolean;lastOffer?:string;analyser?:AnalyserNode;audioContext?:AudioContext;raf?:number};

const devLog=(event:string,details:Record<string,unknown>={})=>{
 if(process.env.NODE_ENV==="development")console.debug(`[voice] ${event}`,details);
};

export function useLobbyVoice(lobbyId:string,localUserId:string,members:string[],localStream:MediaStream|null){
 const [remotePeers,setRemotePeers]=useState<RemoteVoicePeer[]>([]);
 const entries=useRef(new Map<string,PeerEntry>());
 const cursor=useRef(0);
 const pollBusy=useRef(false);
 const pollTimer=useRef<number|null>(null);
 const pollingSession=useRef(0);
 const leaveSent=useRef(false);
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
 async function applyQueuedCandidates(entry:PeerEntry,userId:string){
  if(!entry.pc.remoteDescription)return;
  const queued=entry.iceQueue.splice(0);
  for(const candidate of queued){
   try{await entry.pc.addIceCandidate(candidate);devLog("ice-applied",{userId});}
   catch(error){devLog("ice-apply-failed",{userId,error:String(error)});}
  }
 }
 async function handleSignal(signal:Signal){
  if(signal.sender_id===localUserId)return;
  if(signal.signal_type==="leave"){closePeer(signal.sender_id);return;}
  if(!activeMembers.current.includes(signal.sender_id)||!localStreamRef.current)return;
  if(signal.signal_type==="offer"){
   const senderId=signal.sender_id;
   const offer=signal.payload as RTCSessionDescriptionInit;
   const offerKey=offer.sdp||JSON.stringify(offer);
   devLog("offer-received",{senderId,signalingState:entries.current.get(senderId)?.pc.signalingState});
   let entry=entries.current.get(senderId);
   if(!entry){await createPeer(senderId,false);entry=entries.current.get(senderId);}
   if(!entry){devLog("answer-create-failed",{senderId,error:"peer-not-created"});return;}
  if(entry.lastOffer===offerKey)return;
   entry.answering=true;entry.lastOffer=offerKey;
   try{
    if(entry.pc.signalingState==="have-local-offer"){
     devLog("answer-create-failed",{senderId,error:"peer-already-has-local-offer"});
     return;
    }
    await entry.pc.setRemoteDescription(offer);
    await applyQueuedCandidates(entry,senderId);
    const answer=await entry.pc.createAnswer();
    devLog("answer-created",{senderId});
    await entry.pc.setLocalDescription(answer);
    const sent=await sendSignal(senderId,"answer",answer);
    if(!sent)devLog("answer-send-failed",{senderId});
   }catch(error){
    devLog("answer-create-failed",{senderId,error:String(error),signalingState:entry.pc.signalingState});
   }finally{entry.answering=false;}
  }else if(signal.signal_type==="answer"){
  devLog("answer-received",{senderId:signal.sender_id});
   const entry=entries.current.get(signal.sender_id);if(!entry)return;
    try{
     await entry.pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
     await applyQueuedCandidates(entry,signal.sender_id);
    }catch(error){devLog("answer-received-failed",{senderId:signal.sender_id,error:String(error)});}
  }else if(signal.signal_type==="ice-candidate"){
   if(!entries.current.has(signal.sender_id))await createPeer(signal.sender_id,localUserId<signal.sender_id);
   const entry=entries.current.get(signal.sender_id);if(!entry)return;
   const candidate=signal.payload as RTCIceCandidateInit;
  devLog("ice-received",{senderId:signal.sender_id});
   if(entry.pc.remoteDescription)await applyCandidate(entry,candidate,signal.sender_id);else entry.iceQueue.push(candidate);
  }
 }
 async function applyCandidate(entry:PeerEntry,candidate:RTCIceCandidateInit,userId:string){
  try{await entry.pc.addIceCandidate(candidate);devLog("ice-applied",{userId});}
  catch(error){devLog("ice-apply-failed",{userId,error:String(error)});}
 }
 async function poll(session=pollingSession.current){
  if(session!==pollingSession.current)return;
  if(pollBusy.current)return;
  pollBusy.current=true;
  const response=await fetch(`/api/lobbies/${lobbyId}/voice/signals?after=${cursor.current}`,{cache:"no-store"}).catch(()=>null);
  try{
    if(session!==pollingSession.current||!response?.ok)return;
   const result=await response.json() as {signals:Signal[];cursor:number};
    if(session!==pollingSession.current)return;
   for(const signal of result.signals)await handleSignal(signal);
    if(session===pollingSession.current)cursor.current=result.cursor;
    }finally{if(session===pollingSession.current)pollBusy.current=false;}
 }
 function stopPolling(){
    pollingSession.current+=1;
  if(pollTimer.current!==null){window.clearInterval(pollTimer.current);pollTimer.current=null;}
  pollBusy.current=false;
 }
 function sendLeaveOnce(){
  if(leaveSent.current)return;
  leaveSent.current=true;
  for(const userId of [...entries.current.keys()])sendSignal(userId,"leave",{}).catch(()=>{});
 }
 function closeAllPeers(){
  for(const userId of [...entries.current.keys()])closePeer(userId);
  entries.current.clear();
  setRemotePeers([]);
 }
 useEffect(()=>{
  mounted.current=true;
  return()=>{
   mounted.current=false;
   stopPolling();
   sendLeaveOnce();
   closeAllPeers();
  };
 },[lobbyId,localUserId]);
 useEffect(()=>{
  if(!localStream){
   stopPolling();
   sendLeaveOnce();
   closeAllPeers();
   cursor.current=0;
   return;
  }
  leaveSent.current=false;
  cursor.current=0;
  pollBusy.current=false;
  const session=++pollingSession.current;
  poll(session).catch(error=>devLog("poll-failed",{error:String(error),session}));
  pollTimer.current=window.setInterval(()=>poll(session).catch(error=>devLog("poll-failed",{error:String(error),session})),500);
  return stopPolling;
 },[Boolean(localStream),lobbyId,localUserId]);
 useEffect(()=>{
  const previous=localStreamRef.current;
  localStreamRef.current=localStream;
  if(!localStream){
   sendLeaveOnce();
   closeAllPeers();
   return;
  }
  leaveSent.current=false;
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
  stopPolling();
  sendLeaveOnce();
  closeAllPeers();
 }
 return {remotePeers,setPeerVolume,togglePeerMuted,notifyVoiceLeave};
}
