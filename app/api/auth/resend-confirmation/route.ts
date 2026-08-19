import {NextResponse} from "next/server";import {z} from "zod";import {createClient} from "@/lib/supabase/server";
const schema=z.object({email:z.string().email().max(160)});
export async function POST(request:Request){try{const {email}=schema.parse(await request.json()),supabase=await createClient(),origin=new URL(request.url).origin;await supabase.auth.resend({type:"signup",email,options:{emailRedirectTo:`${origin}/auth/callback?next=/login?status=confirmed`}});return NextResponse.json({ok:true})}catch{return NextResponse.json({ok:true})}}
