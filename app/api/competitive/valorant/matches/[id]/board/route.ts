import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {assertTrustedMutation,noStoreJson,readJsonBody} from '@/lib/security/request';

const objectSchema=z.object({
  id:z.string().uuid().optional(),
  type:z.enum(['draw','arrow','circle','marker','text','player']),
  data:z.record(z.string(),z.unknown()).default({}),
  version:z.number().int().min(1).optional(),
});
const mutationSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('create'),object:objectSchema.omit({id:true,version:true})}),
  z.object({action:z.literal('update'),object:objectSchema.extend({id:z.string().uuid(),version:z.number().int().min(1)})}),
  z.object({action:z.literal('delete'),id:z.string().uuid()}),
  z.object({action:z.literal('clear')}),
  z.object({action:z.literal('permissions'),editMode:z.enum(['captain','everyone']),iglUserId:z.string().uuid().nullable().optional()}),
]);

async function context(matchId:string,userId:string){
 const admin=createAdminClient();
 const {data:player}=await admin.from('valorant_match_players').select('squad_id').eq('match_id',matchId).eq('user_id',userId).maybeSingle();if(!player)return null;
 const [{data:session},{data:squad}]=await Promise.all([
  admin.from('strategy_sessions').select('id,match_id,squad_id,map_slug,edit_mode,igl_user_id,version,updated_at').eq('match_id',matchId).eq('squad_id',player.squad_id).maybeSingle(),
  admin.from('valorant_squads').select('id,captain_id').eq('id',player.squad_id).maybeSingle(),
 ]);
 if(!session||!squad)return null;
 const canEdit=session.edit_mode==='everyone'||squad.captain_id===userId||session.igl_user_id===userId;
 return {admin,session,squad,canEdit};
}

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 try{const user=await getCurrentUser();if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});const {id}=await params;const ctx=await context(id,user.id);if(!ctx)return noStoreJson({error:'Board não disponível.'},{status:404});const {data:objects,error}=await ctx.admin.from('strategy_objects').select('id,type,data,author_id,version,created_at,updated_at').eq('session_id',ctx.session.id).order('created_at');if(error)throw error;return noStoreJson({session:ctx.session,objects:objects??[],canEdit:ctx.canEdit,isCaptain:ctx.squad.captain_id===user.id});}catch{return noStoreJson({error:'Não foi possível carregar o Grind Board.'},{status:500});}
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  assertTrustedMutation(request);const user=await getCurrentUser();if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});const {id}=await params;const body=mutationSchema.parse(await readJsonBody(request,64_000));const ctx=await context(id,user.id);if(!ctx)return noStoreJson({error:'Board não disponível.'},{status:404});
  if(body.action==='permissions'){
    if(ctx.squad.captain_id!==user.id)return noStoreJson({error:'Somente o capitão pode alterar permissões.'},{status:403});
    if(body.iglUserId){const {data:igl}=await ctx.admin.from('valorant_match_players').select('user_id').eq('match_id',id).eq('squad_id',ctx.session.squad_id).eq('user_id',body.iglUserId).maybeSingle();if(!igl)return noStoreJson({error:'IGL precisa pertencer ao squad.'},{status:400});}
    const {data,error}=await ctx.admin.from('strategy_sessions').update({edit_mode:body.editMode,igl_user_id:body.iglUserId??null,version:ctx.session.version+1,updated_at:new Date().toISOString()}).eq('id',ctx.session.id).select('*').single();if(error)throw error;return noStoreJson({session:data});
  }
  if(!ctx.canEdit)return noStoreJson({error:'Board em modo somente leitura.'},{status:403});
  if(body.action==='create'){
    const {data,error}=await ctx.admin.from('strategy_objects').insert({session_id:ctx.session.id,type:body.object.type,data:body.object.data,author_id:user.id,version:1}).select('*').single();if(error)throw error;return noStoreJson({object:data},{status:201});
  }
  if(body.action==='update'){
    const {data,error}=await ctx.admin.from('strategy_objects').update({type:body.object.type,data:body.object.data,version:body.object.version+1,updated_at:new Date().toISOString()}).eq('id',body.object.id).eq('session_id',ctx.session.id).eq('version',body.object.version).select('*').maybeSingle();if(error)throw error;if(!data)return noStoreJson({error:'O objeto foi alterado por outro jogador. Atualize o board.'},{status:409});return noStoreJson({object:data});
  }
  if(body.action==='delete'){const {error}=await ctx.admin.from('strategy_objects').delete().eq('id',body.id).eq('session_id',ctx.session.id);if(error)throw error;return noStoreJson({ok:true});}
  if(body.action==='clear'){if(ctx.squad.captain_id!==user.id&&ctx.session.igl_user_id!==user.id)return noStoreJson({error:'Somente capitão/IGL pode limpar o board.'},{status:403});const {error}=await ctx.admin.from('strategy_objects').delete().eq('session_id',ctx.session.id);if(error)throw error;return noStoreJson({ok:true});}
  return noStoreJson({error:'Ação inválida.'},{status:400});
 }catch(error){if(error instanceof z.ZodError)return noStoreJson({error:'Ação do board inválida.'},{status:400});return noStoreJson({error:'Não foi possível atualizar o Grind Board.'},{status:500});}
}
