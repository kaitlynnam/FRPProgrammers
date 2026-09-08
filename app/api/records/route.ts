import {getDb} from '../../../db';
import {isMember,validate,type Data,type Kind} from '../../../lib/model';
export async function POST(req:Request){return mutate(req,false)}
export async function PATCH(req:Request){return mutate(req,true)}
async function mutate(req:Request,edit:boolean){try{
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return Response.json({error:'Request origin is not allowed.'},{status:403});
 const raw=await req.text();if(raw.length>16000)return Response.json({error:'This entry is too long.'},{status:400});
 const body=JSON.parse(raw);if(!isMember(body.actor))return Response.json({error:'Choose your name first.'},{status:400});
 const db=await getDb();let kind=body.kind as Kind,data=body.data as Data;
 if(edit){const old=await db.prepare('SELECT kind,data FROM records WHERE id=?').bind(body.id).first();if(!old)return Response.json({error:'This item no longer exists.'},{status:404});kind=old.kind as Kind;data={...JSON.parse(old.data as string),...body.data};if(!Number.isInteger(body.version))return Response.json({error:'Reload this item before saving.'},{status:400});}
 if(!data||!validate(kind,data))return Response.json({error:'Check the required fields, dates, and team assignment.'},{status:400});
 if(kind==='task'&&data.source){const s=data.source;if(!/^[\w.-]+\/[\w.-]+$/.test(s.repo)||typeof s.path!=='string'||s.path.length>1000||!/^[a-f0-9]{40}$/.test(s.ref)||s.line!==undefined&&(!Number.isInteger(s.line)||s.line<1))return Response.json({error:'Invalid code reference.'},{status:400});}
 if(kind==='comment'&&!edit)data.author=body.actor;
 if(kind==='repo'&&!edit){const duplicate=await db.prepare("SELECT id FROM records WHERE kind='repo' AND lower(json_extract(data,'$.repo'))=lower(?)").bind(data.repo).first();if(duplicate)return Response.json({error:'This repository is already connected.'},{status:409});}
 if(kind==='comment'&&!edit&&data.target?.startsWith('task:')){const parent=await db.prepare("SELECT id FROM records WHERE id=? AND kind='task'").bind(data.target.slice(5)).first();if(!parent)return Response.json({error:'The task could not be found.'},{status:404});}
 const id=edit?body.id:crypto.randomUUID(),now=new Date().toISOString(),version=edit?body.version+1:1;
 const action=kind==='comment'?(edit?'updated a discussion':'left a comment'):kind==='repo'?'connected a repository':edit?`updated a ${kind}`:`created a ${kind}`;
 const activity=JSON.stringify({text:action,title:data.title||data.repo||data.text?.slice(0,100)||'',team:data.team||'',target:kind==='comment'?data.target:`${kind}:${id}`});
 const change=edit?db.prepare('UPDATE records SET data=?,version=version+1,actor=?,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(data),body.actor,now,id,body.version):db.prepare('INSERT INTO records(id,kind,data,version,actor,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,kind,JSON.stringify(data),1,body.actor,now,now);
 const log=db.prepare("INSERT INTO records(id,kind,data,version,actor,created_at,updated_at) SELECT ?,'activity',?,1,?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE id=? AND version=? AND updated_at=?)").bind(crypto.randomUUID(),activity,body.actor,now,now,id,version,now);
 const result=await db.batch([change,log]);if(result[0].meta.changes===0)return Response.json({error:'Someone updated this item while you were editing. Close and reopen it to see their changes.'},{status:409});
 return Response.json({id,version},{status:edit?200:201});
 }catch(e){console.error('Workspace save failed',e);return Response.json({error:'Unable to save this change. Please try again.'},{status:500})}}
