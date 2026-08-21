import {randomUUID} from 'node:crypto';
import {getCurrentUser} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {canManageCommunity,getCommunityMembership} from '@/lib/community';
import {assertTrustedMutation,InvalidRequestError,noStoreJson} from '@/lib/security/request';
import {enforceRateLimit,RateLimitExceededError,RateLimitUnavailableError,rateLimitResponse} from '@/lib/security/rate-limit';

const allowed=new Map([['image/png','png'],['image/jpeg','jpg'],['image/webp','webp']]);
function hasValidImageSignature(bytes:Uint8Array,mime:string){
  if(mime==='image/png')return bytes.length>=8&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47&&bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a;
  if(mime==='image/jpeg')return bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  if(mime==='image/webp')return bytes.length>=12&&bytes[0]===0x52&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[3]===0x46&&bytes[8]===0x57&&bytes[9]===0x45&&bytes[10]===0x42&&bytes[11]===0x50;
  return false;
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    assertTrustedMutation(request);
    const user=await getCurrentUser(request);if(!user)return noStoreJson({error:'Não autorizado.'},{status:401});
    await enforceRateLimit(request,{scope:'community-upload',limit:20,windowSeconds:600,subject:user.id});
    const {id}=await params;const membership=await getCommunityMembership(id,user.id);if(!canManageCommunity(membership?.role))return noStoreJson({error:'Sem permissão.'},{status:403});
    const form=await request.formData();const file=form.get('file'),kind=String(form.get('kind')??'');
    if(!(file instanceof File)||!['logo','banner'].includes(kind))return noStoreJson({error:'Arquivo inválido.'},{status:400});
    const ext=allowed.get(file.type);if(!ext)return noStoreJson({error:'Use PNG, JPG ou WEBP.'},{status:400});
    const limit=kind==='logo'?5*1024*1024:10*1024*1024;if(file.size<=0||file.size>limit)return noStoreJson({error:`Arquivo deve ter até ${kind==='logo'?5:10}MB.`},{status:400});
    const bytes=new Uint8Array(await file.arrayBuffer());if(!hasValidImageSignature(bytes,file.type))return noStoreJson({error:'O arquivo enviado não corresponde a uma imagem válida.'},{status:400});
    const admin=createAdminClient();const bucketName='community-assets';
    const {data:bucket,error:bucketError}=await admin.storage.getBucket(bucketName);
    if(bucketError){const {error:createError}=await admin.storage.createBucket(bucketName,{public:true,fileSizeLimit:10*1024*1024,allowedMimeTypes:[...allowed.keys()]});if(createError&&!/already exists/i.test(createError.message))throw createError;}
    else if(bucket&&!bucket.public){const {error:updateBucketError}=await admin.storage.updateBucket(bucketName,{public:true,fileSizeLimit:10*1024*1024,allowedMimeTypes:[...allowed.keys()]});if(updateBucketError)throw updateBucketError;}
    const path=`${id}/${kind}/${randomUUID()}.${ext}`;
    const {error:uploadError}=await admin.storage.from(bucketName).upload(path,bytes,{contentType:file.type,cacheControl:'3600',upsert:false});if(uploadError)throw uploadError;
    const {data:url}=admin.storage.from(bucketName).getPublicUrl(path);const column=kind==='logo'?'logo_url':'banner_url';
    const {data:previous}=await admin.from('communities').select('logo_url,banner_url').eq('id',id).maybeSingle();const previousUrl=kind==='logo'?previous?.logo_url:previous?.banner_url;
    const {error:updateError}=await admin.from('communities').update({[column]:url.publicUrl,updated_at:new Date().toISOString()}).eq('id',id);if(updateError){await admin.storage.from(bucketName).remove([path]);throw updateError;}
    if(typeof previousUrl==='string'&&previousUrl.includes(`/storage/v1/object/public/${bucketName}/`)){try{const previousPath=decodeURIComponent(previousUrl.split(`/storage/v1/object/public/${bucketName}/`)[1]?.split('?')[0]??'');if(previousPath&&previousPath!==path&&previousPath.startsWith(`${id}/`))await admin.storage.from(bucketName).remove([previousPath]);}catch{}}
    return noStoreJson({url:url.publicUrl,kind});
  }catch(error){if(error instanceof InvalidRequestError)return noStoreJson({error:error.message},{status:400});if(error instanceof RateLimitExceededError||error instanceof RateLimitUnavailableError)return rateLimitResponse(error);return noStoreJson({error:'Não foi possível enviar a imagem.'},{status:500});}
}
