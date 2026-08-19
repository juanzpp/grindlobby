import {NextResponse} from "next/server";import {z} from "zod";import {createClient} from "@/lib/supabase/server";
const schema=z.object({email:z.string().email().max(160)});
export async function POST(request:Request){try{const {email}=schema.parse(await request.json()),supabase=await createClient(),origin=new URL(request.url).origin;await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${origin}/auth/callback?next=/reset-password`})}catch{}return NextResponse.json({ok:true})}
