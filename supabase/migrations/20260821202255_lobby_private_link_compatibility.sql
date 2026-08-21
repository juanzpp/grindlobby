insert into public.lobby_invites(lobby_id,token_hash,created_by,expires_at,max_uses,uses,revoked)
select l.id,encode(digest(l.id::text,'sha256'),'hex'),l.owner_id,now()+interval '7 days',100,0,false
from public.lobbies l
where l.status='open' and l.visibility in ('private','friends')
on conflict(token_hash) do nothing;
notify pgrst,'reload schema';