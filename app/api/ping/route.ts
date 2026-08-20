import {NextResponse} from "next/server";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export async function GET(){
  return NextResponse.json({ok:true,at:Date.now()},{headers:{"Cache-Control":"no-store, no-cache, must-revalidate"}});
}
