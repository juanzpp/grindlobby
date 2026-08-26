export function referenceLockTransformPlugin(){
  return {
    name:"grindlobby-approved-reference-lock",
    enforce:"post",
    transform(code,id){
      if(!id.endsWith("main.jsx"))return null;
      let fixed=code;

      // The approved desktop navigation follows the reference collage. Profile
      // remains available from the persistent user card; Music is retained as
      // the dedicated product surface requested after the original reference.
      fixed=fixed.replace(
        /const nav=\[[\s\S]*?\];\n return <div className="app-shell">/,
        'const nav=[["home","Início",Home],["lobbies","Lobbies",Gamepad2],["tournaments","Torneios",Trophy],["community","Community",Users],["friends","Amigos",UserRound],["messages","Mensagens",MessageCircle],["music","Música",Music2],["store","Loja",Store],["events","Eventos",CalendarDays],["settings","Configurações",Settings]];\n return <div className="app-shell">'
      );

      fixed=fixed.replace(
        '<CommunityView data={dashboard} notify={notify}/>','<CommunityView data={dashboard} notify={notify} onJoin={joinLobby}/>'
      );

      if(!fixed.includes('import"./reference-lock.css";')){
        if(fixed.includes('import"./login-shell-fix.css";')){
          fixed=fixed.replace('import"./login-shell-fix.css";','import"./login-shell-fix.css";\nimport"./reference-lock.css";');
        }else{
          fixed=fixed.replace('import"./styles.css";','import"./styles.css";\nimport"./reference-lock.css";');
        }
      }
      return fixed===code?null:{code:fixed,map:null};
    }
  };
}
