import {getDb} from '../../../db';
import {isMember,validate,mentionNames,type Data,type Kind} from '../../../lib/model';
export async function POST(req:Request){return mutate(req,false)}
export async function PATCH(req:Request){return mutate(req,true)}
const fail=(error:string,status=400)=>Response.json({error},{status});
async function mutate(req:Request,edit:boolean){try{
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return fail('Request origin is not allowed.',403);
 const raw=await req.text();if(raw.length>60000)return fail('This entry is too long.');
 const body=JSON.parse(raw);if(!isMember(body.actor))return fail('Choose your name first.');
 const db=await getDb();let kind=body.kind as Kind,data=body.data as Data,previous:Data|undefined,id=body.id,expectedVersion=body.version;
 let converted:{id:string;data:Data}|undefined;
 if(body.undoId){
  const log=await db.prepare("SELECT data,actor FROM records WHERE id=? AND kind='activity'").bind(body.undoId).first();
  if(!log||log.actor!==body.actor)return fail('Only the person who made this change can undo it.',403);
  const entry=JSON.parse(log.data as string) as Data;if(!entry.undoable||!entry.previous||!entry.recordId)return fail('This change cannot be undone.');
  id=entry.recordId;expectedVersion=entry.afterVersion;data=entry.previous;edit=true;
 }
 if(body.convert){id=body.meetingId;expectedVersion=body.version;edit=true;}
 if(edit){
  if(typeof id!=='string'||!Number.isInteger(expectedVersion))return fail('Reload this item before saving.');
  const old=await db.prepare('SELECT kind,data,version FROM records WHERE id=?').bind(id).first();
  if(!old)return fail('This item no longer exists.',404);
  if(old.version!==expectedVersion)return fail('Someone updated this item. Reopen it to load their changes before saving or undoing.',409);
  kind=old.kind as Kind;previous=JSON.parse(old.data as string);
  if(kind==='notification'){
   if(previous!.recipient!==body.actor)return fail('Choose the notification recipient’s name first.',403);
   if(typeof body.data?.read!=='boolean')return fail('Invalid notification update.');
   const result=await db.prepare('UPDATE records SET data=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify({...previous,read:body.data.read}),new Date().toISOString(),id,expectedVersion).run();
   return result.meta.changes?Response.json({id,version:expectedVersion+1}):fail('This notification was already updated. Please try again.',409);
  }
  if(body.convert){
   if(kind!=='meeting'||previous!.archived)return fail('Open an active meeting note to create this task.');
   const action=previous!.actions?.find(a=>a.id===body.actionId);if(!action)return fail('Action item not found.',404);
   if(action.taskId)return Response.json({id,taskId:action.taskId,version:old.version});
   const taskId=crypto.randomUUID();converted={id:taskId,data:{title:action.text,description:`From meeting: ${previous!.title}\n${previous!.decisions||''}`.slice(0,6000),team:action.team,assignee:action.assignee,status:'To do',priority:'Normal',blocked:false,due:action.due,checklist:[]}};
   data={...previous,actions:previous!.actions!.map(a=>a.id===action.id?{...a,taskId}:a)};
  }else data=body.undoId?data:{...previous,...data};
  if(kind==='comment'){data.author=previous!.author||body.actor;data.target=previous!.target;data.replyTo=previous!.replyTo;}
  if(kind==='meeting'&&!body.convert&&!body.undoId){
   for(const action of previous!.actions||[]){if(action.taskId&&!data.actions?.some(a=>a.id===action.id&&a.taskId===action.taskId))return fail('Keep linked action items with their tasks. Archive the task separately if it is no longer needed.');}
  }
 }
 if(!data||!validate(kind,data))return fail('Check required fields, dates, checklist items, and team assignments.');
 if(kind==='task'&&data.status==='Done'&&data.checklist?.some(x=>!x.done))return fail('Complete every checklist item before marking this task Done.');
 if(kind==='task'&&data.source){const s=data.source;if(!/^[\w.-]+\/[\w.-]+$/.test(s.repo)||typeof s.path!=='string'||s.path.length>1000||!/^[a-f0-9]{40}$/.test(s.ref)||s.line!==undefined&&(!Number.isInteger(s.line)||s.line<1))return fail('Invalid code reference.');}
 if(kind==='comment'&&!edit){
  data.author=body.actor;
  if(data.target?.startsWith('task:')){const parent=await db.prepare("SELECT id FROM records WHERE id=? AND kind='task'").bind(data.target.slice(5)).first();if(!parent)return fail('The task could not be found.',404);}
  if(data.replyTo){const parent=await db.prepare("SELECT data FROM records WHERE id=? AND kind='comment'").bind(data.replyTo).first();const root=parent?JSON.parse(parent.data as string):null;if(!root||root.target!==data.target||root.replyTo||root.archived)return fail('The discussion changed. Reopen it before replying.');}
 }
 if(kind==='repo'&&!edit){const duplicate=await db.prepare("SELECT id FROM records WHERE kind='repo' AND lower(json_extract(data,'$.repo'))=lower(?)").bind(data.repo).first();if(duplicate)return fail('This repository is already connected.',409);}
 id=edit?id:crypto.randomUUID();const now=new Date().toISOString(),version=edit?expectedVersion+1:1,activityId=crypto.randomUUID();
 const undoable=!body.undoId&&!body.convert&&['task','event','comment','meeting'].includes(kind);
 const action=body.undoId?'undid a change':body.convert?'created a task from meeting notes':data.archived&&!previous?.archived?`archived a ${kind}`:previous?.archived&&!data.archived?`restored a ${kind}`:kind==='comment'?(edit?'updated a discussion':'left a comment'):kind==='repo'?'connected a repository':edit?`updated a ${kind}`:`created a ${kind}`;
 const target=kind==='comment'?data.target:`${kind}:${id}`;
 const activity:Data={text:action,title:data.title||data.repo||data.text?.slice(0,100)||'',team:data.team||'',target,recordId:id,afterVersion:version,undoable,...(undoable?{previous:previous||{...data,archived:true}}:{})};
 const change=edit?db.prepare('UPDATE records SET data=?,version=version+1,actor=?,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(data),body.actor,now,id,expectedVersion):db.prepare('INSERT INTO records(id,kind,data,version,actor,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,kind,JSON.stringify(data),1,body.actor,now,now);
 const log=db.prepare("INSERT INTO records(id,kind,data,version,actor,created_at,updated_at) SELECT ?,'activity',?,1,?,?,? WHERE changes()=1").bind(activityId,JSON.stringify(activity),body.actor,now,now);
 const statements=[change,log];
 const derived=(derivedId:string,derivedKind:string,derivedData:Data)=>db.prepare('INSERT INTO records(id,kind,data,version,actor,created_at,updated_at) SELECT ?,?,?,1,?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE id=?)').bind(derivedId,derivedKind,JSON.stringify(derivedData),body.actor,now,now,activityId);
 if(converted)statements.push(derived(converted.id,'task',converted.data));
 if(!body.undoId&&!data.archived){
  const textOf=(d:Data)=>[d.text,d.description,d.notes,d.decisions,...(d.checklist||[]).map(x=>x.text),...(d.actions||[]).map(x=>x.text)].filter(Boolean).join('\n');
  const oldMentions=new Set(mentionNames(textOf(previous||{})));
  const recipients=new Map<string,string>();
  for(const name of mentionNames(textOf(data)))if(!oldMentions.has(name))recipients.set(name,'mentioned you');
  if(kind==='task'&&data.assignee&&data.assignee!==previous?.assignee)recipients.set(data.assignee,'assigned you a task');
  if(converted?.data.assignee)recipients.set(converted.data.assignee,'assigned you a task from meeting notes');
  for(const [recipient,reason] of recipients){if(recipient===body.actor)continue;statements.push(derived(crypto.randomUUID(),'notification',{recipient,read:false,text:`${body.actor} ${reason}`,title:data.title||data.text?.slice(0,100)||'Team update',target:converted?`task:${converted.id}`:kind==='comment'?`comment:${id}`:target,team:data.team}));}
 }
 const result=await db.batch(statements);if(result[0].meta.changes===0)return fail('Someone updated this item while you were editing. Reopen it to see their changes.',409);
 return Response.json({id,version,...(undoable?{undoId:activityId}:{}),...(converted?{taskId:converted.id}:{})},{status:edit?200:201});
 }catch(e){console.error('Workspace save failed',e);return fail('Unable to save this change. Please try again.',500)}}
