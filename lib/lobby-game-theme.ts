export type LobbyGameTheme={
  key:string;
  label:string;
  banner:string;
  accent:string;
  accent2:string;
};

const themes:Record<string,LobbyGameTheme>={
  valorant:{key:"valorant",label:"VALORANT",banner:"/lobby-games/valorant.svg",accent:"#ff4655",accent2:"#8b5cf6"},
  "ea-fc-27":{key:"ea-fc-27",label:"EA FC 27",banner:"/lobby-games/ea-fc-27.svg",accent:"#8b5cf6",accent2:"#38bdf8"},
  "ea-fc":{key:"ea-fc-27",label:"EA FC 27",banner:"/lobby-games/ea-fc-27.svg",accent:"#8b5cf6",accent2:"#38bdf8"},
  "counter-strike-2":{key:"counter-strike-2",label:"Counter-Strike 2",banner:"/lobby-games/cs2.svg",accent:"#f59e0b",accent2:"#7c3aed"},
  cs2:{key:"counter-strike-2",label:"Counter-Strike 2",banner:"/lobby-games/cs2.svg",accent:"#f59e0b",accent2:"#7c3aed"},
  warzone:{key:"warzone",label:"Warzone",banner:"/lobby-games/warzone.svg",accent:"#84cc16",accent2:"#8b5cf6"},
  fortnite:{key:"fortnite",label:"Fortnite",banner:"/lobby-games/fortnite.svg",accent:"#22d3ee",accent2:"#a855f7"},
  "league-of-legends":{key:"league-of-legends",label:"League of Legends",banner:"/lobby-games/league-of-legends.svg",accent:"#d4af37",accent2:"#2563eb"},
  lol:{key:"league-of-legends",label:"League of Legends",banner:"/lobby-games/league-of-legends.svg",accent:"#d4af37",accent2:"#2563eb"},
};

function normalize(value:string){return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}

export function getGameLobbyTheme(slug?:string|null,name?:string|null):LobbyGameTheme{
  const candidates=[slug,name].filter(Boolean).map(value=>normalize(String(value)));
  for(const candidate of candidates){
    if(themes[candidate])return themes[candidate];
    if(candidate.includes("valorant"))return themes.valorant;
    if(candidate.includes("fc-27")||candidate.includes("ea-fc")||candidate.includes("fifa"))return themes["ea-fc-27"];
    if(candidate.includes("counter-strike")||candidate==="cs-2")return themes["counter-strike-2"];
    if(candidate.includes("warzone")||candidate.includes("call-of-duty"))return themes.warzone;
    if(candidate.includes("fortnite"))return themes.fortnite;
    if(candidate.includes("league")||candidate==="lol")return themes["league-of-legends"];
  }
  return {key:"grind",label:name||"GrindLobby",banner:"/lobby-games/grind.svg",accent:"#8b5cf6",accent2:"#22d3ee"};
}
