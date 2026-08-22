import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {getCurrentUser} from "@/lib/auth";
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from "@/lib/security/rate-limit";

export const dynamic="force-dynamic";
export const runtime="nodejs";

type Provider="youtube"|"spotify";
type MusicResult={
  id:string;provider:Provider;title:string;artist:string;duration:number;image:string|null;url:string;videoId?:string;spotifyUri?:string;
};

type SpotifyTokenCache={token:string;expiresAt:number};
let spotifyTokenCache:SpotifyTokenCache|null=null;

const querySchema=z.string().trim().min(1).max(120);
const sourceSchema=z.enum(["all","youtube","spotify"]);

function parseIsoDuration(value:string){
  const match=value.match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if(!match)return 0;
  return Number(match[1]||0)*86400+Number(match[2]||0)*3600+Number(match[3]||0)*60+Number(match[4]||0);
}

async function getSpotifyToken(){
  if(spotifyTokenCache&&spotifyTokenCache.expiresAt>Date.now()+30_000)return spotifyTokenCache.token;
  const clientId=process.env.SPOTIFY_CLIENT_ID?.trim(),clientSecret=process.env.SPOTIFY_CLIENT_SECRET?.trim();
  if(!clientId||!clientSecret)return null;
  const body=new URLSearchParams({grant_type:"client_credentials",client_id:clientId,client_secret:clientSecret});
  const response=await fetch("https://accounts.spotify.com/api/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body,cache:"no-store"});
  if(!response.ok)throw new Error(`Spotify auth ${response.status}`);
  const data=await response.json() as {access_token:string;expires_in:number};
  spotifyTokenCache={token:data.access_token,expiresAt:Date.now()+Math.max(60,data.expires_in-60)*1000};
  return data.access_token;
}

async function searchSpotify(query:string):Promise<MusicResult[]>{
  const token=await getSpotifyToken();
  if(!token)return [];
  const url=new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q",query);url.searchParams.set("type","track");url.searchParams.set("limit","8");url.searchParams.set("market","BR");
  const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
  if(!response.ok)throw new Error(`Spotify ${response.status}`);
  const body=await response.json() as {tracks?:{items?:Array<{id:string;name:string;duration_ms:number;uri:string;external_urls?:{spotify?:string};artists?:Array<{name:string}>;album?:{images?:Array<{url:string}>}}>} };
  return (body.tracks?.items??[]).map(track=>({
    id:`spotify:${track.id}`,provider:"spotify",title:track.name,artist:(track.artists??[]).map(item=>item.name).join(", ")||"Spotify",
    duration:Math.round((track.duration_ms||0)/1000),image:track.album?.images?.[1]?.url??track.album?.images?.[0]?.url??null,
    url:track.external_urls?.spotify??`https://open.spotify.com/track/${track.id}`,spotifyUri:track.uri,
  }));
}

async function searchYouTube(query:string):Promise<MusicResult[]>{
  const apiKey=process.env.YOUTUBE_API_KEY?.trim();
  if(!apiKey)return [];
  const searchUrl=new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part","snippet");searchUrl.searchParams.set("q",query);searchUrl.searchParams.set("type","video");searchUrl.searchParams.set("videoEmbeddable","true");searchUrl.searchParams.set("maxResults","8");searchUrl.searchParams.set("key",apiKey);searchUrl.searchParams.set("regionCode","BR");
  const searchResponse=await fetch(searchUrl,{cache:"no-store"});
  if(!searchResponse.ok)throw new Error(`YouTube search ${searchResponse.status}`);
  const searchBody=await searchResponse.json() as {items?:Array<{id?:{videoId?:string};snippet?:{title?:string;channelTitle?:string;thumbnails?:{medium?:{url:string};high?:{url:string};default?:{url:string}}}}>};
  const items=(searchBody.items??[]).filter(item=>item.id?.videoId);
  const ids=items.map(item=>item.id!.videoId!).join(",");
  const durations=new Map<string,number>();
  if(ids){
    const detailsUrl=new URL("https://www.googleapis.com/youtube/v3/videos");detailsUrl.searchParams.set("part","contentDetails");detailsUrl.searchParams.set("id",ids);detailsUrl.searchParams.set("key",apiKey);
    const detailsResponse=await fetch(detailsUrl,{cache:"no-store"});
    if(detailsResponse.ok){const details=await detailsResponse.json() as {items?:Array<{id:string;contentDetails?:{duration?:string}}>};for(const item of details.items??[])durations.set(item.id,parseIsoDuration(item.contentDetails?.duration??""))}
  }
  return items.map(item=>{const videoId=item.id!.videoId!,snippet=item.snippet;return{
    id:`youtube:${videoId}`,provider:"youtube" as const,title:snippet?.title??"Vídeo do YouTube",artist:snippet?.channelTitle??"YouTube",
    duration:durations.get(videoId)??0,image:snippet?.thumbnails?.high?.url??snippet?.thumbnails?.medium?.url??snippet?.thumbnails?.default?.url??null,
    url:`https://www.youtube.com/watch?v=${videoId}`,videoId,
  }});
}

export async function GET(request:NextRequest){
  try{
    const user=await getCurrentUser(request);
    if(!user)return NextResponse.json({error:"Não autorizado."},{status:401,headers:{"Cache-Control":"no-store"}});
    await enforceRateLimit(request,{scope:"music-search",limit:60,windowSeconds:300,subject:user.id});
    const parsedQuery=querySchema.safeParse(request.nextUrl.searchParams.get("q")??"");
    const parsedSource=sourceSchema.safeParse(request.nextUrl.searchParams.get("source")||"all");
    if(!parsedQuery.success)return NextResponse.json({error:"Digite o nome de uma música ou artista."},{status:400,headers:{"Cache-Control":"no-store"}});
    if(!parsedSource.success)return NextResponse.json({error:"Fonte de música inválida."},{status:400,headers:{"Cache-Control":"no-store"}});
    const query=parsedQuery.data,source=parsedSource.data;
    const youtubeConfigured=Boolean(process.env.YOUTUBE_API_KEY?.trim());
    const spotifyConfigured=Boolean(process.env.SPOTIFY_CLIENT_ID?.trim()&&process.env.SPOTIFY_CLIENT_SECRET?.trim());
    if(!youtubeConfigured&&!spotifyConfigured)return NextResponse.json({error:"Bot de música não configurado. Adicione YOUTUBE_API_KEY e/ou SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET no servidor."},{status:503,headers:{"Cache-Control":"no-store"}});
    const tasks:Promise<MusicResult[]>[]=[];
    if((source==="all"||source==="youtube")&&youtubeConfigured)tasks.push(searchYouTube(query));
    if((source==="all"||source==="spotify")&&spotifyConfigured)tasks.push(searchSpotify(query));
    const settled=await Promise.allSettled(tasks),results=settled.flatMap(item=>item.status==="fulfilled"?item.value:[]).sort((a,b)=>a.provider===b.provider?0:a.provider==="youtube"?-1:1);
    if(!results.length&&settled.some(item=>item.status==="rejected"))console.error("[GrindLobby Music] provider search failed",settled.filter(item=>item.status==="rejected"));
    return NextResponse.json({results,configured:{youtube:youtubeConfigured,spotify:spotifyConfigured}},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    console.error("[GrindLobby Music] search failed",error);
    return NextResponse.json({error:"Não foi possível buscar músicas agora."},{status:502,headers:{"Cache-Control":"no-store"}});
  }
}
