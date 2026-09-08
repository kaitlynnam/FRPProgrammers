export const members = ['Kaitlyn','Ben','Claire','Luke','Russ','Greg','Nate','Zane'] as const;
export const students = members.slice(0,4);
export const statuses = ['To do','In progress','Needs mentor review','Done'];
export const teamFor = (name:string) => ['Kaitlyn','Ben'].includes(name)?'AIM':['Claire','Luke'].includes(name)?'Launch':'';
export type Kind = 'task'|'event'|'repo'|'comment'|'activity'|'meeting'|'notification';
export type ChecklistItem={id:string;text:string;done:boolean};
export type ActionItem={id:string;text:string;assignee:string;team:string;due:string;taskId?:string};
export type Data = {archived?:boolean;checklist?:ChecklistItem[];notes?:string;decisions?:string;actions?:ActionItem[];recipient?:string;read?:boolean;replyTo?:string;previous?:Data;afterVersion?:number;undoable?:boolean;recordId?:string;startDate?:string;endDate?:string;author?:string;title?:string;description?:string;team?:string;assignee?:string;status?:string;due?:string;priority?:string;blocked?:boolean;category?:string;date?:string;time?:string;repo?:string;target?:string;text?:string;line?:number;ref?:string;path?:string;resolved?:boolean;source?:{repo:string;path:string;ref:string;line?:number}};
export type Row = {id:string;kind:Kind;data:Data;version:number;actor:string;createdAt:string;updatedAt:string};
export const isMember = (name:unknown):name is string => typeof name==='string' && (members as readonly string[]).includes(name);
export function mentionNames(text:string){return members.filter(name=>new RegExp(`(^|[^\\w@])@${name}\\b`,'i').test(text))}
export function validate(kind:Kind,d:Data){
 const short=(s:unknown,max:number,required=false)=>typeof s==='string'&&s.length<=max&&(!required||s.trim().length>0);
 const checklist=d.checklist===undefined||Array.isArray(d.checklist)&&d.checklist.length<=50&&new Set(d.checklist.map(x=>x.id)).size===d.checklist.length&&d.checklist.every(x=>short(x.id,80,true)&&short(x.text,300,true)&&typeof x.done==='boolean');
 if(d.archived!==undefined&&typeof d.archived!=='boolean')return false;
 if(kind==='task')return short(d.title,160,true)&&short(d.description,6000)&&['AIM','Launch'].includes(d.team||'')&&(d.assignee===''||students.includes(d.assignee as typeof members[number])&&teamFor(d.assignee!)===d.team)&&statuses.includes(d.status||'')&&['Low','Normal','High'].includes(d.priority||'')&&typeof d.blocked==='boolean'&&validDate(d.due||'')&&validDate(d.startDate||'')&&(!d.startDate||!!d.due&&d.startDate<=d.due)&&checklist;
 if(kind==='event')return short(d.title,160,true)&&short(d.description,6000)&&['All teams','AIM','Launch'].includes(d.team||'')&&['Meeting','Milestone','Competition'].includes(d.category||'')&&!!d.date&&validDate(d.date)&&validDate(d.endDate||'')&&(!d.endDate||d.endDate>=d.date)&&(!d.time||/^([01]\d|2[0-3]):[0-5]\d$/.test(d.time));
 if(kind==='repo')return typeof d.repo==='string'&&/^[\w.-]+\/[\w.-]+$/.test(d.repo)&&['AIM','Launch','All teams'].includes(d.team||'');
 if(kind==='comment')return short(d.text,6000,true)&&short(d.target,1000,true)&&typeof d.resolved==='boolean'&&(!d.replyTo||short(d.replyTo,100,true))&&(!d.line||Number.isInteger(d.line)&&d.line>0)&&(!d.ref||/^[a-f0-9]{40}$/.test(d.ref));
 if(kind==='meeting')return short(d.title,160,true)&&short(d.notes,6000)&&short(d.decisions,6000)&&['All teams','AIM','Launch'].includes(d.team||'')&&!!d.date&&validDate(d.date)&&Array.isArray(d.actions)&&d.actions.length<=30&&new Set(d.actions.map(a=>a.id)).size===d.actions.length&&d.actions.every(a=>short(a.id,80,true)&&short(a.text,160,true)&&['AIM','Launch'].includes(a.team)&&(a.assignee===''||students.includes(a.assignee as typeof members[number])&&teamFor(a.assignee)===a.team)&&validDate(a.due)&&(!a.taskId||short(a.taskId,200,true)));
 return false;
}
function validDate(s:string){return typeof s==='string'&&(s===''||/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s)}
