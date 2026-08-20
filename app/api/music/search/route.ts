import {NextRequest,NextResponse} from "next/server";

export const dynamic="force-dynamic";
export const runtime="nodejs";

type JamendoTrack={
  id:string;name:string;duration:number;artist_name:string;audio:string;shareurl?:string;license_ccurl?:string;
};

export async function GET(request:NextRequest){
  const query=request.nextUrl.searchParams.get("q")?.trim();
  if(!query)return NextResponse.json({error:"Digite o nome de uma música ou artista."},{status:400});
  const configured=process.env.JAMENDO_CLIENT_ID?.trim();
  const clientId=configured||(process.env.NODE_ENV!=="production"?"709fa152":"");
  if(!clientId)return NextResponse.json({error:"Busca de música não configurada. Adicione JAMENDO_CLIENT_ID no servidor."},{status:503});
  const url=new URL("https://api.jamendo.com/v3.0/tracks/");
  url.searchParams.set("client_id",clientId);
  url.searchParams.set("format","json");
  url.searchParams.set("limit","12");
  url.searchParams.set("search",query);
  url.searchParams.set("audioformat","mp32");
  url.searchParams.set("type","single albumtrack");
  url.searchParams.set("order","relevance");
  try{
    const response=await fetch(url,{headers:{Accept:"application/json"},next:{revalidate:0}});
    if(!response.ok)throw new Error(`Jamendo ${response.status}`);
    const body=await response.json() as {headers?:{status?:string;error_message?:string};results?:JamendoTrack[]};
    if(body.headers?.status&&body.headers.status!=="success")throw new Error(body.headers.error_message||"Jamendo error");
    const results=(body.results??[]).filter(track=>Boolean(track.audio)).map(track=>({id:track.id,title:track.name,artist:track.artist_name,duration:Number(track.duration)||0,audio:track.audio,shareUrl:track.shareurl,license:track.license_ccurl}));
    return NextResponse.json({results},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error("[GrindLobby Music] search failed",error);
    return NextResponse.json({error:"Não foi possível buscar músicas agora."},{status:502});
  }
}
