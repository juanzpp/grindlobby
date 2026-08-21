import {getCurrentUser} from "@/lib/auth";
import {createAdminClient} from "@/lib/supabase/admin";
import {noStoreJson} from "@/lib/security/request";
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from "@/lib/security/rate-limit";

type RankRow={user_id:string;game_id:number;rank_name:string;points:number;wins:number;losses:number;updated_at:string};
type PlayerProfile={
  id:string;username:string;display_name:string;avatar:string|null;status:string;created_at:string;
  account_level:number|null;favorite_game:string|null;
};

function rankMatches(rank:RankRow|null|undefined){return rank?(rank.wins??0)+(rank.losses??0):0}
function rankWinRate(rank:RankRow|null|undefined){const matches=rankMatches(rank);return matches?Math.round(((rank?.wins??0)/matches)*100):null}
function betterRank(next:RankRow,current?:RankRow){
  if(!current)return true;
  if(next.points!==current.points)return next.points>current.points;
  const nextMatches=rankMatches(next),currentMatches=rankMatches(current);
  if(nextMatches!==currentMatches)return nextMatches>currentMatches;
  return (rankWinRate(next)??0)>(rankWinRate(current)??0);
}

export async function GET(request:Request){
  try{
    const user=await getCurrentUser();
    if(!user)return noStoreJson({error:"Não autorizado."},{status:401});
    await enforceRateLimit(request,{scope:"dashboard-read",limit:120,windowSeconds:600,subject:user.id});

    const admin=createAdminClient();
    const [{data:games},{data:ranks},{data:allCompetitiveRanks},{data:allLobbies},{data:onlineProfiles},{data:myMemberships},{data:profile}]=await Promise.all([
      admin.from("games").select("id,name,slug").order("id").limit(12),
      admin.from("user_game_ranks").select("user_id,game_id,rank_name,points,wins,losses,updated_at").eq("user_id",user.id),
      admin.from("user_game_ranks").select("user_id,game_id,rank_name,points,wins,losses,updated_at").order("points",{ascending:false}).limit(200),
      admin.from("lobbies").select("id,owner_id,game_id,name,description,visibility,max_members,status,created_at").eq("status","open").order("created_at",{ascending:false}).limit(40),
      admin.from("profiles").select("id,username,display_name,avatar,status,created_at,account_level,favorite_game").eq("status","online").neq("id",user.id).limit(20),
      admin.from("lobby_members").select("lobby_id,role,joined_at,last_seen_at").eq("user_id",user.id).order("joined_at",{ascending:false}),
      admin.from("profiles").select("account_level,account_xp,created_at,favorite_game").eq("id",user.id).maybeSingle(),
    ]);

    const allRanks=(allCompetitiveRanks??[]) as RankRow[];
    const bestRankByUser=new Map<string,RankRow>();
    for(const rank of allRanks){
      const hasCompetitiveHistory=(rank.points??0)>0||rankMatches(rank)>0;
      if(!hasCompetitiveHistory)continue;
      const current=bestRankByUser.get(rank.user_id);
      if(betterRank(rank,current))bestRankByUser.set(rank.user_id,rank);
    }

    const topCandidateIds=Array.from(bestRankByUser.keys()).slice(0,80);
    const {data:topProfiles}=topCandidateIds.length
      ?await admin.from("profiles").select("id,username,display_name,avatar,status,created_at,account_level,favorite_game").in("id",topCandidateIds)
      :{data:[] as PlayerProfile[]};

    const gameMap=new Map((games??[]).map(game=>[Number(game.id),game]));
    const playerSnapshot=(person:PlayerProfile,rank:RankRow|undefined,statusLabel?:string)=>({
      id:person.id,
      name:person.display_name||person.username,
      username:person.username,
      avatar:person.avatar,
      status:person.status,
      statusLabel:statusLabel??(person.status==="online"?"Online":"Offline"),
      level:person.account_level??0,
      rankName:rank?.rank_name??"Iniciante",
      points:rank?.points??0,
      winRate:rankWinRate(rank),
      matches:rankMatches(rank),
      streak:null as number|null,
      favoriteGame:person.favorite_game||gameMap.get(rank?.game_id??-1)?.name||"",
      memberSince:person.created_at??null,
    });

    const topPlayers=(topProfiles??[] as PlayerProfile[])
      .map(person=>playerSnapshot(person,bestRankByUser.get(person.id)))
      .filter(person=>person.points>0||person.matches>0)
      .sort((a,b)=>b.points-a.points||b.matches-a.matches||(b.winRate??0)-(a.winRate??0)||b.level-a.level)
      .slice(0,8);

    const cutoff=new Date(Date.now()-30_000).toISOString();
    const mine=new Set((myMemberships??[]).map(member=>member.lobby_id));
    const activeMine=new Set((myMemberships??[]).filter(member=>member.last_seen_at&&member.last_seen_at>cutoff).map(member=>member.lobby_id));
    const lobbies=(allLobbies??[]).filter(lobby=>lobby.visibility==="public"||lobby.owner_id===user.id||mine.has(lobby.id));
    const lobbyIds=lobbies.map(lobby=>lobby.id);
    const ownerIds=Array.from(new Set(lobbies.map(lobby=>lobby.owner_id))) as string[];
    const currentLobbyId=(myMemberships??[]).find(member=>activeMine.has(member.lobby_id)&&lobbies.some(lobby=>lobby.id===member.lobby_id))?.lobby_id??null;

    const [{data:memberships},{data:owners}]=await Promise.all([
      lobbyIds.length?admin.from("lobby_members").select("lobby_id,user_id,role,joined_at,last_seen_at").in("lobby_id",lobbyIds):Promise.resolve({data:[] as Array<{lobby_id:string;user_id:string;role:string;joined_at:string;last_seen_at:string|null}>}),
      ownerIds.length?admin.from("profiles").select("id,username,display_name,avatar,status,created_at,account_level,favorite_game").in("id",ownerIds):Promise.resolve({data:[] as PlayerProfile[]}),
    ]);

    const memberUserIds=currentLobbyId?Array.from(new Set((memberships??[]).filter(member=>member.lobby_id===currentLobbyId).map(member=>member.user_id))):[];
    const {data:currentProfiles}=memberUserIds.length
      ?await admin.from("profiles").select("id,username,display_name,avatar,status,created_at,account_level,favorite_game").in("id",memberUserIds)
      :{data:[] as PlayerProfile[]};

    const allRelevantIds=Array.from(new Set([...(onlineProfiles??[]).map(person=>person.id),...memberUserIds,...ownerIds]));
    const {data:relevantRanks}=allRelevantIds.length
      ?await admin.from("user_game_ranks").select("user_id,game_id,rank_name,points,wins,losses,updated_at").in("user_id",allRelevantIds)
      :{data:[] as RankRow[]};
    const bestRelevantRank=new Map<string,RankRow>();
    for(const rank of relevantRanks??[]){const current=bestRelevantRank.get(rank.user_id);if(betterRank(rank,current))bestRelevantRank.set(rank.user_id,rank)}

    const rankMap=new Map((ranks??[]).map(rank=>[rank.game_id,rank]));
    const ownerMap=new Map((owners??[] as PlayerProfile[]).map(owner=>[owner.id,owner]));
    const profileMap=new Map((currentProfiles??[] as PlayerProfile[]).map(member=>[member.id,member]));
    const counts=new Map<string,number>();
    for(const member of memberships??[]){if(member.last_seen_at&&member.last_seen_at>cutoff)counts.set(member.lobby_id,(counts.get(member.lobby_id)??0)+1)}

    const gameCards=(games??[]).map(game=>{
      const rank=rankMap.get(game.id);
      const wins=rank?.wins??0,losses=rank?.losses??0,matches=wins+losses,points=rank?.points??0;
      return {
        id:game.id,name:game.name,slug:game.slug,rank:rank?.rank_name??"Sem rank",points,wins,losses,matches,
        winRate:matches?Math.round((wins/matches)*100):0,
        progress:rank?Math.min(99,Math.max(0,points%100)):0,
        nextDivision:rank?"Próxima divisão em "+(100-(points%100))+" RP":"Complete sua primeira partida ranqueada",
      };
    });

    const lobbyCards=lobbies.slice(0,12).map(lobby=>({
      ...lobby,
      game:lobby.game_id?gameMap.get(Number(lobby.game_id))??null:null,
      owner:ownerMap.get(lobby.owner_id)??null,
      memberCount:counts.get(lobby.id)??0,
      joined:activeMine.has(lobby.id),
    }));
    const currentLobby=lobbyCards.find(lobby=>lobby.id===currentLobbyId)??null;
    const currentMembers=currentLobby
      ?(memberships??[]).filter(member=>member.lobby_id===currentLobby.id&&member.last_seen_at&&member.last_seen_at>cutoff).map(member=>{
        const person=profileMap.get(member.user_id);
        return {
          userId:member.user_id,
          role:member.role,
          joinedAt:member.joined_at,
          profile:person??null,
          player:person?playerSnapshot(person,bestRelevantRank.get(person.id),"Em Call"):null,
        };
      })
      :[];

    const online=(onlineProfiles??[] as PlayerProfile[]).map(person=>({
      ...person,
      player:playerSnapshot(person,bestRelevantRank.get(person.id)),
    }));

    return noStoreJson({
      games:gameCards,
      lobbies:lobbyCards,
      currentLobby:currentLobby?{...currentLobby,members:currentMembers}:null,
      online,
      topPlayers,
      account:{level:profile?.account_level??0,xp:profile?.account_xp??0},
      entitlements:{tier:user.account_tier==="pro"||user.app_role==="admin"?"pro":"free",isAdmin:user.app_role==="admin"},
      stats:{online:online.length+1,activeLobbies:lobbies.length,myLobbies:activeMine.size,rank:ranks?.length?Math.max(...ranks.map(rank=>rank.points)):0},
    });
  }catch(error){
    if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);
    return noStoreJson({error:"Não foi possível carregar o dashboard."},{status:500});
  }
}
