import {env} from 'cloudflare:workers';
let ready:Promise<unknown>|undefined;
export async function getDb(){
 if(!env.DB)throw new Error('Shared storage is unavailable. Please try again.');
 ready??=env.DB.batch([
  env.DB.prepare('CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY NOT NULL,kind TEXT NOT NULL,data TEXT NOT NULL,version INTEGER DEFAULT 1 NOT NULL,actor TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)'),
  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_records_kind ON records(kind)')
 ]).catch(error=>{ready=undefined;throw error});
 await ready;return env.DB;
}
