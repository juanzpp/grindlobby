"use client";
import {useEffect,useRef,useState} from "react";
import {voiceIceServers} from "@/lib/webrtc/config";

type DescriptionSignalPayload={negotiationId:string;description:RTCSessionDescriptionInit};
type IceSignalPayload={negotiationId:string;candidate:RTCIceCandidateInit};
type Signal={id:number;sender_id:string;target_id:string|null;signal_type:"offer"|"answer"|"ice-candidate"|"leave";payload:DescriptionSignalPayload|IceSignalPayload|Record<string,never>};
export type RemoteVoicePeer={userId:string;stream:MediaStream|null;status:"Connecting"|"Connected"|"Reconnecting";speaking:boolean;volume:number;muted:boolean};

declare global{
 interface Window{__GRINDLOBBY_VOICE_DEBUG__?:boolean}
}

type QueuedIce={negotiationId:string;candidate:RTCIceCandidateInit};
type PeerEntry={pc:RTCPeerConnection;remoteStream:MediaStream|null;iceQueue:QueuedIce[];retryTimer?:number;disconnectTimer?:number;statsTimer?:number;lastStats?:{timestamp:number;bytesSent:number;bytesReceived:number};answering?:boolean;negotiationId?:string;localAnswer?:RTCSessionDescriptionInit;reconnecting?:boolean;analyser?:AnalyserNode;audioContext?:AudioContext;raf?:number};

const voiceDebug=process.env.NODE_ENV==="development"||process.env.NEXT_PUBLIC_VOICE_DEBUG==="true";
const productionVoiceDebug=process.env.NEXT_PUBLIC_VOICE_DEBUG==="true";
const remoteStreamPeers=new WeakMap<MediaStream,string>();
export const getRemoteVoicePeerId=(stream:MediaStream|null)=>stream?remoteStreamPeers.get(stream):undefined;
const devLog=(event:string,details:Record<string,unknown>={})=>{if(voiceDebug)console.debug(`[GrindLobby Voice] ${event}`,details)};
const devError=(event:string,details:Record<string,unknown>={})=>{if(voiceDebug)console.error(`[GrindLobby Voice] ${event}`,details)};
const trackSummary=(track:MediaStreamTrack|null)=>track?{enabled:track.enabled,muted:track.muted,readyState:track.readyState}:null;
const newNegotiationId=()=>crypto.randomUUID();

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
  let response:Response;
  try{response=await fetch(`/api/lobbies/${lobbyId}/voice/signals`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({targetId,type,payload})});}
  catch(error){devError("signal-post-failed",{type,targetId,error:String(error)});throw error;}
  if(!response.ok){devError("signal-post-failed",{type,targetId,status:response.status});return false;}
  if(type==="offer")devLog("offer-sent",{targetId});
  if(type==="answer")devLog("answer-sent",{targetId});
  if(type==="ice-candidate")devLog("ice-sent",{targetId});
  return true;
 }
 function stopAnalyser(entry:PeerEntry){
  if(entry.raf)cancelAnimationFrame(entry.raf);
  entry.audioContext?.close().catch(error=>devError("analyser-close-failed",{error:String(error)}));
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
  }catch(error){devError("analyser-create-failed",{userId,error:String(error)});}
 }
 function closePeer(userId:string,keepState=false){
  const entry=entries.current.get(userId);
  if(!entry)return;
  if(entry.retryTimer)window.clearTimeout(entry.retryTimer);
  if(entry.disconnectTimer)window.clearTimeout(entry.disconnectTimer);
  if(entry.statsTimer)window.clearInterval(entry.statsTimer);
  stopAnalyser(entry);
  entry.pc.onicecandidate=null;entry.pc.ontrack=null;entry.pc.onconnectionstatechange=null;
  entry.pc.close();
  entries.current.delete(userId);
  if(!keepState)setRemotePeers(current=>current.filter(peer=>peer.userId!==userId));
 }
 async function logPeerStats(userId:string,entry:PeerEntry){
  if(!productionVoiceDebug)return;
  if(entry.pc.connectionState==="closed")return;
  try{
   const report=await entry.pc.getStats();
   let bytesSent=0,bytesReceived=0;
   const outbound:Array<Record<string,unknown>>=[],inbound:Array<Record<string,unknown>>=[];
   report.forEach(item=>{
    if(item.kind!=="audio"&&item.mediaType!=="audio")return;
    if(item.type==="outbound-rtp"&&!item.isRemote){
     const sample={bytesSent:item.bytesSent??0,packetsSent:item.packetsSent??0};
     bytesSent+=Number(item.bytesSent??0);outbound.push(sample);
    }
    if(item.type==="inbound-rtp"&&!item.isRemote){
     const sample={bytesReceived:item.bytesReceived??0,packetsReceived:item.packetsReceived??0,packetsLost:item.packetsLost??0,jitter:item.jitter??0};
     bytesReceived+=Number(item.bytesReceived??0);inbound.push(sample);
    }
   });
   const now=Date.now(),previous=entry.lastStats;
   const transceivers=entry.pc.getTransceivers().map(transceiver=>({direction:transceiver.direction,currentDirection:transceiver.currentDirection,senderTrack:trackSummary(transceiver.sender.track),receiverTrack:trackSummary(transceiver.receiver.track)}));
   devLog("peer-stats",{peerId:userId,signalingState:entry.pc.signalingState,iceConnectionState:entry.pc.iceConnectionState,connectionState:entry.pc.connectionState,transceivers,inboundRtp:inbound,outboundRtp:outbound,bytesSentDelta:previous?bytesSent-previous.bytesSent:null,bytesReceivedDelta:previous?bytesReceived-previous.bytesReceived:null,intervalMs:previous?now-previous.timestamp:null});
   entry.lastStats={timestamp:now,bytesSent,bytesReceived};
  }catch(error){devError("rtp-stats-failed",{peerId:userId,error:String(error)});}
 }
 function startPeerStats(userId:string,entry:PeerEntry){
  if(!productionVoiceDebug||entry.statsTimer)return;
  logPeerStats(userId,entry);
  entry.statsTimer=window.setInterval(()=>logPeerStats(userId,entry),2000);
 }
 function scheduleReconnect(userId:string){
  const entry=entries.current.get(userId);
  if(!entry||entry.retryTimer||entry.reconnecting)return;
  entry.reconnecting=true;
  updatePeer(userId,{status:"Reconnecting",stream:null,speaking:false});
  const retry=window.setTimeout(()=>{
   entry.retryTimer=undefined;
   if(!activeMembers.current.includes(userId)||!localStreamRef.current){entry.reconnecting=false;return;}
   closePeer(userId,true);
  createPeer(userId,localUserId<userId).catch(error=>devError("peer-reconnect-failed",{peerId:userId,error:String(error)}));
  },1500);
  entry.retryTimer=retry;
 }
  async function createPeerInternal(userId:string,initiator:boolean){
  const currentStream=localStreamRef.current;
  if(!currentStream||entries.current.has(userId))return;
  devLog("peer-created",{peerId:userId,remoteUserId:userId,role:initiator?"offerer":"receiver",localUserId});
  addPeerState(userId);
  const pc=new RTCPeerConnection({iceServers:voiceIceServers});
  const entry:PeerEntry={pc,remoteStream:null,iceQueue:[],reconnecting:false};
  entries.current.set(userId,entry);
  const localTracks=currentStream.getAudioTracks();
  devLog("local-audio-tracks",{peerId:userId,count:localTracks.length,tracks:localTracks.map(trackSummary)});
  localTracks.forEach(track=>{
   track.onended=()=>devLog("local-track-ended",{peerId:userId,trackId:track.id});
   const transceiver=pc.addTransceiver(track,{direction:"sendrecv",streams:[currentStream]});
   devLog("sender-attached",{peerId:userId,senderTrack:trackSummary(transceiver.sender.track),receiverTrack:trackSummary(transceiver.receiver.track),direction:transceiver.direction,currentDirection:transceiver.currentDirection});
   const codecs=RTCRtpSender.getCapabilities?.("audio")?.codecs??[];
   const opus=codecs.filter(codec=>codec.mimeType.toLowerCase()==="audio/opus");
  if(opus.length){
   try{transceiver.setCodecPreferences([...opus,...codecs.filter(codec=>codec.mimeType.toLowerCase()!=="audio/opus")]);}
  catch(error){devError("codec-preference-failed",{peerId:userId,error:String(error)});}
  }
  });
  pc.onicecandidate=event=>{
   if(!event.candidate||!entry.negotiationId)return;
   sendSignal(userId,"ice-candidate",{negotiationId:entry.negotiationId,candidate:event.candidate.toJSON()}).catch(error=>devError("ice-send-error",{peerId:userId,error:String(error)}));
  };
  pc.onsignalingstatechange=()=>devLog("signaling-state",{peerId:userId,state:pc.signalingState});
  pc.oniceconnectionstatechange=()=>devLog("ice-connection-state",{peerId:userId,state:pc.iceConnectionState});
  pc.onicegatheringstatechange=()=>devLog("ice-gathering-state",{peerId:userId,state:pc.iceGatheringState});
  pc.ontrack=event=>{
   const stream=event.streams[0]??entry.remoteStream??new MediaStream();
   if(!stream.getTracks().some(track=>track.id===event.track.id))stream.addTrack(event.track);
    devLog("ontrack",{peerId:userId,track:trackSummary(event.track),streamCount:event.streams.length,audioTrackCount:stream.getAudioTracks().length,signalingState:pc.signalingState,iceConnectionState:pc.iceConnectionState,connectionState:pc.connectionState});
   remoteStreamPeers.set(stream,userId);
   entry.remoteStream=stream;
   updatePeer(userId,{stream,status:"Connected"});
   startAnalyser(userId,entry,stream);
  };
  pc.onconnectionstatechange=()=>{
    devLog("connection-state",{peerId:userId,state:pc.connectionState,signalingState:pc.signalingState,iceConnectionState:pc.iceConnectionState,iceGatheringState:pc.iceGatheringState});
   if(pc.connectionState==="connected"){
    if(entry.disconnectTimer)window.clearTimeout(entry.disconnectTimer);
    entry.disconnectTimer=undefined;
    updatePeer(userId,{status:"Connected"});startPeerStats(userId,entry);
   }
   if(pc.connectionState==="failed")scheduleReconnect(userId);
   if(pc.connectionState==="disconnected"&&!entry.disconnectTimer){
    updatePeer(userId,{status:"Reconnecting"});
    entry.disconnectTimer=window.setTimeout(()=>{entry.disconnectTimer=undefined;if(pc.connectionState==="disconnected")scheduleReconnect(userId)},5000);
   }
  };
  if(initiator){
    entry.negotiationId=newNegotiationId();
    const offer=await pc.createOffer({offerToReceiveAudio:true});
    devLog("offer-created",{peerId:userId,negotiationId:entry.negotiationId,offerType:offer.type,sdpLength:offer.sdp?.length??0});
    await pc.setLocalDescription(offer);
    devLog("set-local-description",{peerId:userId,type:pc.localDescription?.type,signalingState:pc.signalingState});
    const localDescription=pc.localDescription;
    if(!localDescription)throw new Error("Local offer was not applied");
    await sendSignal(userId,"offer",{negotiationId:entry.negotiationId,description:localDescription.toJSON()});
  }
 }
 async function createPeer(userId:string,initiator:boolean){
  try{await createPeerInternal(userId,initiator);}
  catch(error){
  devError("peer-create-failed",{peerId:userId,initiator,error:String(error)});
   closePeer(userId);
   updatePeer(userId,{status:"Reconnecting"});
  }
 }
 async function applyQueuedCandidates(entry:PeerEntry,userId:string){
  if(!entry.pc.remoteDescription)return;
  const queued=entry.iceQueue.splice(0);
  for(const queuedCandidate of queued){
   if(queuedCandidate.negotiationId!==entry.negotiationId){devLog("ice-ignored-stale",{peerId:userId,negotiationId:queuedCandidate.negotiationId,activeNegotiationId:entry.negotiationId});continue;}
   try{await entry.pc.addIceCandidate(queuedCandidate.candidate);devLog("ice-applied",{peerId:userId,negotiationId:entry.negotiationId});}
   catch(error){devError("ice-apply-failed",{peerId:userId,error:String(error)});throw error;}
  }
 }
 async function handleSignal(signal:Signal,session:number){
  if(session!==pollingSession.current)return;
  if(signal.sender_id===localUserId)return;
  if(signal.signal_type==="leave"){closePeer(signal.sender_id);return;}
  if(!activeMembers.current.includes(signal.sender_id)||!localStreamRef.current)return;
  if(signal.signal_type==="offer"){
   const senderId=signal.sender_id;
   const payload=signal.payload as DescriptionSignalPayload;
   if(!payload.negotiationId||payload.description?.type!=="offer"){devLog("offer-ignored-stale",{peerId:senderId,reason:"missing-negotiation-id"});return;}
   const offer=payload.description;
   const negotiationId=payload.negotiationId;
  devLog("offer-received",{peerId:senderId,negotiationId,signalingState:entries.current.get(senderId)?.pc.signalingState,hasSdp:Boolean(offer.sdp)});
   let entry=entries.current.get(senderId);
   if(entry?.retryTimer){window.clearTimeout(entry.retryTimer);entry.retryTimer=undefined;entry.reconnecting=false;}
   if(entry&&["failed","closed"].includes(entry.pc.connectionState)){closePeer(senderId,true);entry=undefined;}
   if(!entry){await createPeer(senderId,false);if(session!==pollingSession.current)return;entry=entries.current.get(senderId);}
   if(!entry){devLog("answer-create-failed",{senderId,error:"peer-not-created"});return;}
   if(entry.negotiationId===negotiationId){
    devLog("offer-ignored-duplicate",{peerId:senderId,negotiationId,signalingState:entry.pc.signalingState});
    if(entry.localAnswer)await sendSignal(senderId,"answer",{negotiationId,description:entry.localAnswer});
    return;
   }
   if(entry.answering||entry.pc.signalingState!=="stable"){
    devLog("offer-ignored-stale",{peerId:senderId,negotiationId,activeNegotiationId:entry.negotiationId,signalingState:entry.pc.signalingState});
    return;
   }
   entry.answering=true;entry.negotiationId=negotiationId;entry.localAnswer=undefined;entry.iceQueue=[];
   try{
    await entry.pc.setRemoteDescription(offer);
    devLog("set-remote-description",{peerId:senderId,type:entry.pc.remoteDescription?.type,signalingState:entry.pc.signalingState});
    await applyQueuedCandidates(entry,senderId);
    const answer=await entry.pc.createAnswer();
    devLog("answer-created",{peerId:senderId,answerType:answer.type,sdpLength:answer.sdp?.length??0});
    await entry.pc.setLocalDescription(answer);
    devLog("set-local-description",{peerId:senderId,type:entry.pc.localDescription?.type,signalingState:entry.pc.signalingState});
    const localDescription=entry.pc.localDescription;
    if(!localDescription)throw new Error("Local answer was not applied");
    entry.localAnswer=localDescription.toJSON();
    const sent=await sendSignal(senderId,"answer",{negotiationId,description:entry.localAnswer});
    if(!sent)devLog("answer-send-failed",{senderId});
   }catch(error){
    devError("answer-create-failed",{peerId:senderId,error:String(error),signalingState:entry.pc.signalingState});
   }finally{entry.answering=false;}
  }else if(signal.signal_type==="answer"){
   const payload=signal.payload as DescriptionSignalPayload;
   const entry=entries.current.get(signal.sender_id);
   const signalingStateBefore=entry?.pc.signalingState;
   devLog("signaling-state-before-answer",{peerId:signal.sender_id,negotiationId:payload.negotiationId,signalingState:signalingStateBefore});
   if(!entry||!payload.negotiationId||payload.description?.type!=="answer"||payload.negotiationId!==entry.negotiationId||entry.pc.signalingState!=="have-local-offer"||!entry.pc.localDescription||entry.pc.localDescription.type!=="offer"){
    devLog("answer-ignored-stale",{peerId:signal.sender_id,negotiationId:payload.negotiationId,activeNegotiationId:entry?.negotiationId,signalingState:signalingStateBefore,localDescriptionType:entry?.pc.localDescription?.type??null});
    return;
   }
    try{
     await entry.pc.setRemoteDescription(payload.description);
     devLog("answer-applied",{peerId:signal.sender_id,negotiationId:payload.negotiationId});
     devLog("negotiation-id",{peerId:signal.sender_id,negotiationId:entry.negotiationId});
     devLog("signaling-state-after-answer",{peerId:signal.sender_id,negotiationId:payload.negotiationId,signalingState:entry.pc.signalingState});
     await applyQueuedCandidates(entry,signal.sender_id);
    }catch(error){devError("answer-received-failed",{peerId:signal.sender_id,error:String(error)});}
  }else if(signal.signal_type==="ice-candidate"){
   const payload=signal.payload as IceSignalPayload;
   const entry=entries.current.get(signal.sender_id);
   if(!entry||!payload.negotiationId||payload.negotiationId!==entry.negotiationId){devLog("ice-ignored-stale",{peerId:signal.sender_id,negotiationId:payload.negotiationId,activeNegotiationId:entry?.negotiationId});return;}
   devLog("ice-received",{peerId:signal.sender_id,negotiationId:payload.negotiationId});
   if(entry.pc.remoteDescription)await applyCandidate(entry,payload.candidate,signal.sender_id);else entry.iceQueue.push(payload);
  }
 }
 async function applyCandidate(entry:PeerEntry,candidate:RTCIceCandidateInit,userId:string){
  try{await entry.pc.addIceCandidate(candidate);devLog("ice-applied",{peerId:userId});}
  catch(error){devError("ice-apply-failed",{peerId:userId,error:String(error)});throw error;}
 }
 async function poll(session=pollingSession.current){
  if(session!==pollingSession.current)return;
  if(pollBusy.current)return;
  pollBusy.current=true;
  try{
    const response=await fetch(`/api/lobbies/${lobbyId}/voice/signals?after=${cursor.current}`,{cache:"no-store"});
    if(session!==pollingSession.current||!response?.ok)return;
   const result=await response.json() as {signals:Signal[];cursor:number};
    if(session!==pollingSession.current)return;
   for(const signal of result.signals){if(session!==pollingSession.current)return;await handleSignal(signal,session);}
    if(session===pollingSession.current)cursor.current=result.cursor;
    }catch(error){devError("poll-failed",{error:String(error),session});}
    finally{if(session===pollingSession.current)pollBusy.current=false;}
 }
 function stopPolling(){
    pollingSession.current+=1;
  if(pollTimer.current!==null){window.clearInterval(pollTimer.current);pollTimer.current=null;}
  pollBusy.current=false;
 }
 function sendLeaveOnce(){
  if(leaveSent.current)return;
  leaveSent.current=true;
  for(const userId of [...entries.current.keys()])sendSignal(userId,"leave",{}).catch(error=>devError("leave-send-failed",{peerId:userId,error:String(error)}));
 }
 function closeAllPeers(){
  for(const userId of [...entries.current.keys()])closePeer(userId);
  entries.current.clear();
  setRemotePeers([]);
 }
 async function initializeCursor(session:number){
  const response=await fetch(`/api/lobbies/${lobbyId}/voice/signals?latest=1`,{cache:"no-store"});
  if(session!==pollingSession.current||!response.ok)return false;
  const result=await response.json() as {cursor:number};
  if(session!==pollingSession.current)return false;
  cursor.current=result.cursor;
  devLog("signal-cursor-initialized",{session,cursor:cursor.current});
  return true;
 }
 useEffect(()=>{
  if(!productionVoiceDebug||window.__GRINDLOBBY_VOICE_DEBUG__)return;
  window.__GRINDLOBBY_VOICE_DEBUG__=true;
  console.debug("[GrindLobby Voice] debug-enabled");
 },[]);
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
  initializeCursor(session).then(initialized=>{
   if(!initialized||session!==pollingSession.current)return;
   poll(session).catch(error=>devLog("poll-failed",{error:String(error),session}));
   pollTimer.current=window.setInterval(()=>poll(session).catch(error=>devLog("poll-failed",{error:String(error),session})),500);
  }).catch(error=>devError("signal-cursor-init-failed",{error:String(error),session}));
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
  for(const userId of activeMembers.current.filter(id=>id!==localUserId))createPeer(userId,localUserId<userId).catch(error=>devError("peer-create-failed",{peerId:userId,error:String(error)}));
 },[localStream,localUserId]);
 useEffect(()=>{
   if(!localStreamRef.current)return;
    for(const userId of [...entries.current.keys()])if(!members.includes(userId)){
    sendSignal(userId,"leave",{}).catch(error=>devError("leave-send-failed",{peerId:userId,error:String(error)}));
     closePeer(userId);
    }
    for(const userId of members.filter(id=>id!==localUserId))createPeer(userId,localUserId<userId).catch(error=>devError("peer-member-create-failed",{peerId:userId,error:String(error)}));
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
