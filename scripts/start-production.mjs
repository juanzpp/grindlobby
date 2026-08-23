process.env.HOSTNAME=process.env.HOSTNAME?.trim()||"0.0.0.0";
process.env.PORT=process.env.PORT?.trim()||"3000";

await import("../.next/standalone/server.js");
