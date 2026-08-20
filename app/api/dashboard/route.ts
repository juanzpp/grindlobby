import {getCurrentUser} from "@/lib/auth";
import {createAdminClient} from "@/lib/supabase/admin";
import {noStoreJson} from "@/lib/security/request";
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from "@/lib/security/rate-limit";

export async function GET(request:Request){
  try{
    const user=await getCurrentUser();
    if(!user)return noStoreJson({error:"Não autorizado."},{status:401});
    await enforceRateLimit(request,{scope:"dashboard-read",limit:120,windowSeconds:600,subject:user.id});

    const admin=createAdminClient();
    const [{data:games},{data:ranks},{data:allLobbies},{data:online},{data:myMemberships},{data:profile}]=await Promise.all([
      admin.from("games").select("id,name,slug").order("id").limit(12),
      admin.from("user_game_ranks").select("game_id,rank_name,points,wins,losses").eq("user_id",user.id),
      admin.from("lobbies").select("id,owner_id,game_id,name,description,visibility,max_members,status,created_at").eq("status","open").order("created_at",{ascending:false}).limit(40),
      admin.from("profiles").select("id,username,display_name,avatar,status").eq("status","online").neq("id",user.id).limit(12),
      admin.from("lobby_members").select("lobby_id,role,joined_at,last_seen_at").eq("user_id",user.id).order("joined_at",{ascending:false}),
      admin.from("profiles").select("account_level,account_xp").eq("id",user.id).maybeSingle(),
    ]);

    const cutoff=new Date(Date.now()-30_000).toISOString();
    const mine=new Set((myMemberships??[]).map(member=>member.lobby_id));
    const activeMine=new Set((myMemberships??[]).filter(member=>member.last_seen_at&&member.last_seen_at>cutoff).map(member=>member.lobby_id));
    const lobbies=(allLobbies??[]).filter(lobby=>lobby.visibility==="public"||lobby.owner_id===user.id||mine.has(lobby.id));
    const lobbyIds=lobbies.map(lobby=>lobby.id);
    const gameIds=Array.from(new Set(lobbies.map(lobby=>lobby.game_id).filter(Boolean))) as number[];
    const ownerIds=Array.from(new Set(lobbies.map(lobby=>lobby.owner_id))) as string[];
    const currentLobbyId=(myMemberships??[]).find(member=>activeMine.has(member.lobby_id)&&lobbies.some(lobby=>lobby.id===member.lobby_id))?.lobby_id??null;

    const [{data:memberships},{data:lobbyGames},{data:owners}]=await Promise.all([
      lobbyIds.length?admin.from("lobby_members").select("lobby_id,user_id,role,joined_at,last_seen_at").in("lobby_id",lobbyIds):Promise.resolve({data:[] as Array<{lobby_id:string;user_id:string;role:string;joined_at:string;last_seen_at:string|null}>}),
      gameIds.length?admin.from("games").select("id,name,slug").in("id",gameIds):Promise.resolve({data:[] as Array<{id:number;name:string;slug:string}>}),
      ownerIds.length?admin.from("profiles").select("id,username,display_name,avatar,status").in("id",ownerIds):Promise.resolve({data:[] as Array<{id:string;username:string;display_name:string;avatar:string|null;status:string}>}),
    ]);

    const memberUserIds=currentLobbyId?Array.from(new Set((memberships??[]).filter(member=>member.lobby_id===currentLobbyId).map(member=>member.user_id))):[];
    const {data:currentProfiles}=memberUserIds.length
      ?await admin.from("profiles").select("id,username,display_name,avatar").in("id",memberUserIds)
      :{data:[] as Array<{id:string;username:string;display_name:string;avatar:string|null}>};

    const rankMap=new Map((ranks??[]).map(rank=>[rank.game_id,rank]));
    const gameMap=new Map((lobbyGames??[]).map(game=>[game.id,game]));
    const ownerMap=new Map((owners??[]).map(owner=>[owner.id,owner]));
    const profileMap=new Map((currentProfiles??[]).map(member=>[member.id,member]));
    const counts=new Map<string,number>();
    for(const member of memberships??[]){
      if(member.last_seen_at&&member.last_seen_at>cutoff)counts.set(member.lobby_id,(counts.get(member.lobby_id)??0)+1);
    }

    const gameCards=(games??[]).map(game=>{
      const rank=rankMap.get(game.id);
      const wins=rank?.wins??0,losses=rank?.losses??0,matches=wins+losses,points=rank?.points??0;
      return {
        id:game.id,
        name:game.name,
        slug:game.slug,
        rank:rank?.rank_name??"Sem rank",
        points,
        wins,
        losses,
        matches,
        winRate:matches?Math.round((wins/matches)*100):0,
        progress:rank?Math.min(99,Math.max(0,points%100)):0,
        nextDivision:rank?"Próxima divisão em "+(100-(points%100))+" RP":"Complete sua primeira partida ranqueada",
      };
    });

    const lobbyCards=lobbies.slice(0,12).map(lobby=>({
      ...lobby,
      game:lobby.game_id?gameMap.get(lobby.game_id)??null:null,
      owner:ownerMap.get(lobby.owner_id)??null,
      memberCount:counts.get(lobby.id)??0,
      joined:activeMine.has(lobby.id),
    }));
    const currentLobby=lobbyCards.find(lobby=>lobby.id===currentLobbyId)??null;
    const currentMembers=currentLobby
      ?(memberships??[]).filter(member=>member.lobby_id===currentLobby.id&&member.last_seen_at&&member.last_seen_at>cutoff).map(member=>({
        userId:member.user_id,
        role:member.role,
        joinedAt:member.joined_at,
        profile:profileMap.get(member.user_id)??null,
      }))
      :[];
    return noStoreJson({
      games:gameCards,
      lobbies:lobbyCards,
      currentLobby:currentLobby?{...currentLobby,members:currentMembers}:null,
      online:online??[],
      account:{level:profile?.account_level??1,xp:profile?.account_xp??0},
      entitlements:{
        tier:user.account_tier==="pro"||user.app_role==="admin"?"pro":"free",
        isAdmin:user.app_role==="admin",
      },
      stats:{
        online:(online??[]).length+1,
        activeLobbies:lobbies.length,
        myLobbies:activeMine.size,
        rank:ranks?.length?Math.max(...ranks.map(rank=>rank.points)):0,
      },
    });
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    return noStoreJson({error:"Não foi possível carregar o dashboard."},{status:500});
  }
}
