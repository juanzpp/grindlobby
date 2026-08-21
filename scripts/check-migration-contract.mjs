import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';

const migrationDir=join(process.cwd(),'supabase','migrations');
const files=(await readdir(migrationDir)).filter(name=>name.endsWith('.sql')).sort();
if(!files.length){console.error('[migration-contract] no migrations found');process.exit(1)}
const latest=files.at(-1);
const latestSql=await readFile(join(migrationDir,latest),'utf8');
const guard=await readFile(join(process.cwd(),'scripts','verify-schema.mjs'),'utf8');
const versionMatch=guard.match(/expectedVersion="([^"]+)"/);
if(!versionMatch){console.error('[migration-contract] expectedVersion is missing from verify-schema.mjs');process.exit(1)}
const expectedVersion=versionMatch[1];
if(!latestSql.includes("app_schema_state")||!latestSql.includes(`'${expectedVersion}'`)){
  console.error(`[migration-contract] latest migration ${latest} does not publish schema version ${expectedVersion}`);
  process.exit(1);
}
console.log(`[migration-contract] ${latest} matches ${expectedVersion}`);
