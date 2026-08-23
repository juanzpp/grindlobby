export function fixNativeBridge(code){
  let fixed=code;

  fixed=fixed.replace(
    'const invoke=(command,args={})=>window.__TAURI__?.core?.invoke(command,args);',
    'const invoke=(command,args={})=>{const bridge=window.__TAURI__?.core?.invoke||window.__TAURI_INTERNALS__?.invoke;if(typeof bridge!=="function")return Promise.reject(new Error("Cliente desktop não conseguiu acessar o runtime nativo."));return bridge(command,args)};'
  );

  fixed=fixed.replace(
    'useEffect(()=>()=>{roomRef.current?.disconnect()},[]);',
    'useEffect(()=>()=>{roomRef.current?.disconnect()},[]);useEffect(()=>{const lobbyId=call?.lobby?.id;if(!lobbyId)return;const beat=()=>API("POST",`/api/lobbies/${lobbyId}/heartbeat`,{}).catch(()=>{});void beat();const timer=window.setInterval(beat,15000);return()=>window.clearInterval(timer)},[call?.lobby?.id]);'
  );

  fixed=fixed.replace(
    'const login=async(identifier,password,remember)=>{const response=await API("POST","/api/auth/login",{identifier,password,remember});if(!response?.ok)throw new Error(errorText(response,"Credenciais inválidas."));await loadDashboard();notify("Bem-vindo ao GrindLobby.")};',
    'const login=async(identifier,password,remember)=>{let response;try{response=await API("POST","/api/auth/login",{identifier,password,remember})}catch(error){throw new Error(error?.message||"Não foi possível conectar ao GrindLobby.")}if(!response)throw new Error("O cliente desktop não recebeu resposta da API.");if(response.status===401)throw new Error("Usuário/e-mail ou senha inválidos.");if(!response.ok)throw new Error(errorText(response,`Falha de autenticação (HTTP ${response.status}).`));const loaded=await loadDashboard();if(!loaded)throw new Error("Login aceito, mas a sessão não pôde ser carregada.");notify("Bem-vindo ao GrindLobby.")};'
  );

  fixed=fixed.replace(
    'const logout=async()=>{try{roomRef.current?.disconnect();roomRef.current=null;await API("POST","/api/auth/logout",{})}finally{setCall(null);setSession("guest");setDashboard(null);notify("Sessão encerrada.")}};',
    'const logout=async()=>{try{const lobby=call?.lobby;roomRef.current?.disconnect();roomRef.current=null;if(lobby?.id)await API("POST",`/api/lobbies/${lobby.id}/leave?intent=explicit`,{}).catch(()=>{});await API("POST","/api/auth/logout",{})}finally{setCall(null);setSession("guest");setDashboard(null);notify("Sessão encerrada.")}};'
  );

  fixed=fixed.replace(
    'await API("POST",`/api/lobbies/${lobby.id}/leave`,{}).catch(()=>{});',
    'await API("POST",`/api/lobbies/${lobby.id}/leave?intent=explicit`,{}).catch(()=>{});'
  );

  return fixed;
}

export function nativeBridgeTransformPlugin(){
  return {
    name:'grindlobby-native-bridge-hardening',
    enforce:'pre',
    transform(code,id){
      if(!id.endsWith('main.jsx'))return null;
      const fixed=fixNativeBridge(code);
      return fixed===code?null:{code:fixed,map:null};
    }
  };
}
