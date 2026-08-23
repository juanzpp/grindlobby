import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';
import {fixNativeBridge} from '../desktop/ui/native-bridge-transform.mjs';

describe('native desktop bridge hardening',()=>{
  it('falls back to Tauri internals instead of silently returning undefined',async()=>{
    const source=await readFile('desktop/ui/src/main.jsx','utf8');
    const transformed=fixNativeBridge(source);
    expect(transformed).toContain('window.__TAURI_INTERNALS__?.invoke');
    expect(transformed).toContain('Cliente desktop não conseguiu acessar o runtime nativo.');
    expect(transformed).not.toContain('const invoke=(command,args={})=>window.__TAURI__?.core?.invoke(command,args);');
  });

  it('only reports invalid credentials for an actual HTTP 401',async()=>{
    const source=await readFile('desktop/ui/src/main.jsx','utf8');
    const transformed=fixNativeBridge(source);
    expect(transformed).toContain('if(response.status===401)');
    expect(transformed).toContain('O cliente desktop não recebeu resposta da API.');
    expect(transformed).toContain('Login aceito, mas a sessão não pôde ser carregada.');
  });

  it('uses the explicit leave contract so lobby membership is actually removed',async()=>{
    const source=await readFile('desktop/ui/src/main.jsx','utf8');
    const transformed=fixNativeBridge(source);
    expect(transformed).toContain('/leave?intent=explicit');
    expect(transformed).not.toContain('`/api/lobbies/${lobby.id}/leave`,{}).catch(()=>{});');
  });

  it('cleans up an active lobby before logout clears the session',async()=>{
    const source=await readFile('desktop/ui/src/main.jsx','utf8');
    const transformed=fixNativeBridge(source);
    expect(transformed).toContain('const lobby=call?.lobby');
    expect(transformed).toContain('if(lobby?.id)await API("POST",`/api/lobbies/${lobby.id}/leave?intent=explicit`');
    expect(transformed.indexOf('/leave?intent=explicit')).toBeLessThan(transformed.indexOf('/api/auth/logout'));
  });
});
