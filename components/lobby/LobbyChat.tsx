"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {MessageSquare,Send} from "lucide-react";
import {RoomEvent,type Room} from "livekit-client";
import {getActiveVoiceLobbyId,subscribeActiveLiveKitRoom} from "@/lib/webrtc/useLobbyVoice";

type ChatMessage={id:string;userId:string;name:string;text:string;sentAt:number};
type Props={lobbyId:string;members:{userId:string;name:string}[]};
const histories=new Map<string,ChatMessage[]>();
const topic="grindlobby-chat-v1";
function addHistory(lobbyId:string,message:ChatMessage){const next=[...(histories.get(lobbyId)??[]),message].slice(-100);histories.set(lobbyId,next);return next}

export default function LobbyChat({lobbyId,members}:Props){
 const [room,setRoom]=useState<Room|null>(null);
 const [messages,setMessages]=useState<ChatMessage[]>(()=>histories.get(lobbyId)??[]);
 const [text,setText]=useState("");const endRef=useRef<HTMLDivElement>(null);
 const names=useMemo(()=>new Map(members.map(item=>[item.userId,item.name])),[members]);
 useEffect(()=>subscribeActiveLiveKitRoom(setRoom),[]);
 useEffect(()=>{const timer=window.setTimeout(()=>setMessages(histories.get(lobbyId)??[]),0);return()=>window.clearTimeout(timer)},[lobbyId]);
 useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth",block:"nearest"})},[messages.length]);
 useEffect(()=>{
  if(!room||getActiveVoiceLobbyId()!==lobbyId)return;
  const receive=(payload:Uint8Array,participant?:{identity:string;name?:string},_kind?:unknown,packetTopic?:string)=>{
   if(packetTopic!==topic||!participant)return;
   try{const raw=JSON.parse(new TextDecoder().decode(payload)) as {id?:string;text?:string;sentAt?:number};const clean=(raw.text??"").trim().slice(0,500);if(!clean)return;const message:ChatMessage={id:raw.id||crypto.randomUUID(),userId:participant.identity,name:participant.name||names.get(participant.identity)||"Player",text:clean,sentAt:Number(raw.sentAt)||Date.now()};setMessages(current=>current.some(item=>item.id===message.id)?current:addHistory(lobbyId,message))}catch{}
  };
  room.on(RoomEvent.DataReceived,receive);
  return()=>{room.off(RoomEvent.DataReceived,receive)};
 },[room,lobbyId,names]);
 async function send(){
  const clean=text.trim().slice(0,500);if(!clean||!room||getActiveVoiceLobbyId()!==lobbyId)return;
  const message:ChatMessage={id:crypto.randomUUID(),userId:room.localParticipant.identity,name:room.localParticipant.name||names.get(room.localParticipant.identity)||"Você",text:clean,sentAt:Date.now()};
  const payload=new TextEncoder().encode(JSON.stringify({id:message.id,text:message.text,sentAt:message.sentAt}));
  await room.localParticipant.publishData(payload,{reliable:true,topic});setMessages(addHistory(lobbyId,message));setText("");
 }
 const connected=Boolean(room&&getActiveVoiceLobbyId()===lobbyId);
 return <div className="lobby-chat">
  <div className="lobby-chat-head"><span><MessageSquare size={14}/>Chat da sala</span><small>{connected?"Tempo real via LiveKit":"Entre no áudio para conversar"}</small></div>
  <div className="lobby-chat-messages" aria-live="polite">
   {!messages.length?<div className="lobby-chat-empty"><MessageSquare size={22}/><b>Comece a conversa</b><span>Mensagens da sessão aparecem aqui em tempo real.</span></div>:messages.map(message=><article key={message.id} className={message.userId===room?.localParticipant.identity?"mine":""}><div><b>{message.name}</b><time>{new Date(message.sentAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</time></div><p>{message.text}</p></article>)}
   <div ref={endRef}/>
  </div>
  <form className="lobby-chat-compose" onSubmit={event=>{event.preventDefault();void send()}}><input value={text} onChange={event=>setText(event.target.value)} disabled={!connected} maxLength={500} placeholder={connected?"Mensagem para a sala…":"Entre no áudio para liberar o chat"}/><button disabled={!connected||!text.trim()} aria-label="Enviar mensagem"><Send size={15}/></button></form>
 </div>;
}
