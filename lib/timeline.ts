import type {Data} from './model';
const DAY=86_400_000;
export const dayNumber=(date:string)=>Math.round(Date.parse(date+'T00:00:00Z')/DAY);
export const dayString=(day:number)=>new Date(day*DAY).toISOString().slice(0,10);
export function dateRange(kind:string,data:Data):[number,number]|null{
 const end=kind==='task'?data.due:(data.endDate||data.date);
 const start=kind==='task'?(data.startDate||data.due):data.date;
 return start&&end?[dayNumber(start),dayNumber(end)]:null;
}
export function shiftedRange(start:number,end:number,delta:number,mode:'move'|'start'|'end'):[number,number]{
 if(mode==='start')return [Math.min(start+delta,end),end];
 if(mode==='end')return [start,Math.max(start,end+delta)];
 return [start+delta,end+delta];
}
export function rangePatch(kind:string,start:number,end:number):Data{
 return kind==='task'?{startDate:dayString(start),due:dayString(end)}:{date:dayString(start),endDate:dayString(end)};
}
export function windowRange(anchor:string,zoom:string):[number,number]{
 const d=new Date(anchor+'T00:00:00Z');
 if(zoom==='Week'){const start=dayNumber(anchor)-(d.getUTCDay()+6)%7;return [start,start+6]}
 const month=zoom==='Quarter'?Math.floor(d.getUTCMonth()/3)*3:d.getUTCMonth();
 const start=Date.UTC(d.getUTCFullYear(),month,1)/DAY;
 const end=Date.UTC(d.getUTCFullYear(),month+(zoom==='Quarter'?3:1),1)/DAY-1;
 return [start,end];
}
