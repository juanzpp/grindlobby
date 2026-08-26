export function debugFinalSourcePlugin(){
  return {
    name:"grindlobby-debug-final-source",
    enforce:"post",
    transform(code,id){
      if(!id.endsWith("main.jsx"))return null;
      const tokens=["function HomeView","function Activity","function ActiveCall","function OnlineFriends","function LobbiesView","function CommunityView","function FriendsView","function MessagesView","function TournamentsView","function EventsView","function StoreView","function ProfileView","function SettingsView"];
      console.log("=== GRIND FINAL COMPONENT TRACE ===");
      for(const token of tokens){
        const at=code.indexOf(token);
        console.log(token+" @ "+at);
        if(at>=0)console.log(code.slice(Math.max(0,at-220),Math.min(code.length,at+520)).replace(/\n/g,"\\n"));
      }
      console.log("=== END GRIND FINAL COMPONENT TRACE ===");
      return null;
    }
  };
}
