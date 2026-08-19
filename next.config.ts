import type { NextConfig } from "next";

function connectionSource(value:string|undefined){
  if(!value)return null;
  try{
    const url=new URL(value);
    const sources=new Set<string>([url.origin]);
    if(url.protocol==="https:")sources.add(`wss://${url.host}`);
    if(url.protocol==="wss:")sources.add(`https://${url.host}`);
    return [...sources];
  }catch{return null}
}

const connectSources=[
  "'self'",
  ...connectionSource(process.env.NEXT_PUBLIC_SUPABASE_URL)??[],
  ...connectionSource(process.env.NEXT_PUBLIC_LIVEKIT_URL)??[],
];
const csp=[
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV==="development"?" 'unsafe-eval'":""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  `connect-src ${connectSources.join(" ")}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(process.env.NODE_ENV==="production"?["upgrade-insecure-requests"]:[]),
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async headers(){
    return [
      {
        source:"/:path*",
        headers:[
          {key:"Content-Security-Policy",value:csp},
          {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
          {key:"Permissions-Policy",value:"camera=(), microphone=(self), display-capture=(self), fullscreen=(self)"},
          {key:"X-Content-Type-Options",value:"nosniff"},
          {key:"X-Frame-Options",value:"DENY"},
          {key:"Cross-Origin-Opener-Policy",value:"same-origin-allow-popups"},
          ...(process.env.NODE_ENV==="production"?[{key:"Strict-Transport-Security",value:"max-age=31536000; includeSubDomains"}]:[]),
        ],
      },
      {
        source:"/api/:path*",
        headers:[{key:"Cache-Control",value:"private, no-store, max-age=0"}],
      },
    ];
  },
};

export default nextConfig;
