import {cpSync,existsSync,mkdirSync} from "node:fs";
import {join} from "node:path";

const root=process.cwd();
const standalone=join(root,".next","standalone");

if(!existsSync(standalone)){
  console.log("[standalone] no standalone output; nothing to prepare");
  process.exit(0);
}

const copies=[
  [join(root,"public"),join(standalone,"public")],
  [join(root,".next","static"),join(standalone,".next","static")],
];

for(const[source,target]of copies){
  if(!existsSync(source))continue;
  mkdirSync(target,{recursive:true});
  cpSync(source,target,{recursive:true,force:true});
}

console.log("[standalone] public and static assets prepared");
