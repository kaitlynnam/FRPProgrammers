'use client';
import {useState,useRef,type CSSProperties,type PointerEvent,type ReactNode} from 'react';
import type {Row} from '../lib/model';
import {dateRange,dayNumber,dayString,shiftedRange,rangePatch,windowRange} from '../lib/timeline';
import type {Save} from './page';
const localToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const format=(day:number,options:Intl.DateTimeFormatOptions)=>new Date(day*86400000).toLocaleDateString('en-US',{...options,timeZone:'UTC'});
type Drag={row:Row;start:number;end:number;x:number;delta:number;mode:'move'|'start'|'end'};
export default function TimelineView({records,open,save,addEvent,addTask,listRow}:{records:Row[];open:(row:Row)=>void;save:Save;addEvent:()=>void;addTask:()=>void;listRow:(row:Row)=>ReactNode}){
 const [mode,setMode]=useState('Timeline'),[zoom,setZoom]=useState('Month'),[anchor,setAnchor]=useState(localToday),[group,setGroup]=useState('Team'),[collapsed,setCollapsed]=useState<string[]>([]),[drag,setDrag]=useState<Drag|null>(null),[saving,setSaving]=useState(false);
 const activeDrag=useRef<Drag|null>(null),suppressClick=useRef(false),scroll=useRef<HTMLDivElement>(null);
 const [first,last]=windowRange(anchor,zoom),days=last-first+1,cell=zoom==='Week'?105:zoom==='Month'?37:18,width=days*cell,today=dayNumber(localToday());
 const scheduled=records.filter(r=>dateRange(r.kind,r.data)),unscheduled=records.filter(r=>!dateRange(r.kind,r.data));
 const groupName=(r:Row)=>group==='Person'?(r.kind==='task'?r.data.assignee||'Unassigned':'Team events'):group==='Status'?(r.kind==='task'?r.data.status||'To do':'Team events'):r.data.team||'All teams';
 const groups=Array.from(new Set(scheduled.map(groupName))).sort();
 const months:{start:number;count:number;label:string}[]=[];
 for(let i=0;i<days;i++){const label=format(first+i,{month:'long',year:'numeric'});const previous=months[months.length-1];if(previous?.label===label)previous.count++;else months.push({start:i,count:1,label})}
 const focusDate=(date:string)=>{setAnchor(date);scroll.current?.scrollTo({left:0})};
 function begin(event:PointerEvent<HTMLButtonElement>,row:Row,start:number,end:number){
  if(saving||event.button!==0)return;
  const edge=(event.target as HTMLElement).dataset.edge;
  const d:Drag={row,start,end,x:event.clientX,delta:0,mode:edge==='start'?'start':edge==='end'?'end':'move'};
  activeDrag.current=d;setDrag(d);event.currentTarget.setPointerCapture(event.pointerId);
 }
 function move(event:PointerEvent<HTMLButtonElement>){
  if(!activeDrag.current)return;
  const d={...activeDrag.current,delta:Math.round((event.clientX-activeDrag.current.x)/cell)};
  activeDrag.current=d;setDrag(d);
 }
 function finish(){
  const d=activeDrag.current;activeDrag.current=null;setDrag(null);
  if(!d||!d.delta)return;
  suppressClick.current=true;const [start,end]=shiftedRange(d.start,d.end,d.delta,d.mode);
  setSaving(true);void save(d.row.kind,rangePatch(d.row.kind,start,end),d.row).finally(()=>setSaving(false));
 }
 function bar(row:Row){
  const original=dateRange(row.kind,row.data)!;
  const [start,end]=drag?.row.id===row.id?shiftedRange(drag.start,drag.end,drag.delta,drag.mode):original;
  const before=end<first,after=start>last;
  const label=`${row.data.title}: ${dayString(start)}${end!==start?' to '+dayString(end):''}`;
  return <div className="gantt-track" style={{width}}>
   {before||after?<button className={'gantt-outside '+(before?'before':'after')} onClick={()=>focusDate(dayString(start))}>{before?'← ':''}{format(start,{month:'short',day:'numeric'})}{after?' →':''}</button>:
   <button className={'gantt-bar '+(row.kind==='event'?'event-bar ':'')+(row.data.status==='Done'?'done-bar ':'')+(row.data.blocked?'blocked-bar ':'')+(drag?.row.id===row.id?'dragging':'')} style={{left:Math.max(0,start-first)*cell+3,width:Math.max(12,(Math.min(last,end)-Math.max(first,start)+1)*cell-6)}} title={label+' · Drag to reschedule; drag edges to resize. Arrow keys move by one day.'} aria-label={label} disabled={saving} onPointerDown={e=>begin(e,row,...original)} onPointerMove={move} onPointerUp={finish} onPointerCancel={()=>{activeDrag.current=null;setDrag(null)}} onClick={()=>{if(suppressClick.current){suppressClick.current=false;return}open(row)}} onKeyDown={e=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();const [s,t]=shiftedRange(...original,e.key==='ArrowRight'?1:-1,e.shiftKey?'end':'move');setSaving(true);void save(row.kind,rangePatch(row.kind,s,t),row).finally(()=>setSaving(false))}}>
    {start>=first&&<span data-edge="start" className="resize-edge start" aria-hidden="true"/>}
    <span className="bar-caption">{start<first?'‹ ':''}{row.kind==='event'?'◇ ':row.data.status==='Done'?'✓ ':''}{row.data.title}{end>last?' ›':''}</span>
    {end<=last&&<span data-edge="end" className="resize-edge end" aria-hidden="true"/>}
   </button>}
   {today>=first&&today<=last&&<span className="today-line" style={{left:(today-first+.5)*cell}}/>}
  </div>
 }
 return <section className="gantt-panel">
  <div className="gantt-toolbar"><div className="scope-toggle">{['Timeline','List'].map(n=><button key={n} className={mode===n?'scope-selected':''} aria-pressed={mode===n} onClick={()=>setMode(n)}>{n==='Timeline'?'▥':'☷'} {n}</button>)}</div>
   {mode==='Timeline'&&<><strong className="gantt-range-label">{format(first,{month:'short',year:'numeric'})}{zoom==='Quarter'?' – '+format(last,{month:'short'}):zoom==='Week'?' · '+format(first,{day:'numeric'})+'–'+format(last,{day:'numeric'}):''}</strong><div className="gantt-options"><label>Group by<select aria-label="Group timeline by" value={group} onChange={e=>{setGroup(e.target.value);setCollapsed([])}}>{['Team','Person','Status'].map(n=><option key={n}>{n}</option>)}</select></label><select aria-label="Timeline scale" value={zoom} onChange={e=>{setZoom(e.target.value);scroll.current?.scrollTo({left:0})}}>{['Week','Month','Quarter'].map(n=><option key={n}>{n}</option>)}</select><button className="small-button gantt-today" onClick={()=>focusDate(localToday())}>Today</button><button className="gantt-nav" aria-label={'Previous '+zoom.toLowerCase()} onClick={()=>focusDate(dayString(first-1))}>‹</button><button className="gantt-nav" aria-label={'Next '+zoom.toLowerCase()} onClick={()=>focusDate(dayString(last+1))}>›</button></div></>}
  </div>
  {mode==='List'?<div className="gantt-list">{scheduled.length?scheduled.sort((a,b)=>dateRange(a.kind,a.data)![0]-dateRange(b.kind,b.data)![0]).map(listRow):<p className="muted">Add dates to tasks or create an event to start your timeline.</p>}</div>:<>
   <div ref={scroll} className="gantt-scroll" role="region" aria-label="Team schedule, scroll horizontally for dates" tabIndex={0} style={{'--day-width':cell+'px'} as CSSProperties}>
    <div className="gantt-grid" style={{width:230+width}}>
     <div className="gantt-header"><div className="gantt-name-header"><span>WORK & EVENTS</span><small>{scheduled.length} scheduled</small></div><div className="gantt-calendar-header" style={{width}}><div className="gantt-months">{months.map(m=><span key={m.start} style={{width:m.count*cell}}>{m.label}</span>)}</div><div className="gantt-days">{Array.from({length:days},(_,i)=>{const day=first+i,weekend=[0,6].includes(new Date(day*86400000).getUTCDay());return <span className={(day===today?'is-today ':'')+(weekend?'weekend':'')} key={i} style={{width:cell}}><small>{zoom!=='Quarter'?format(day,{weekday:'short'}).slice(0,zoom==='Week'?3:1):''}</small><b>{format(day,{day:'numeric'})}</b></span>})}</div></div></div>
     {groups.map(g=><div key={g}><div className="gantt-group-row"><button className="gantt-group-name" aria-expanded={!collapsed.includes(g)} onClick={()=>setCollapsed(v=>v.includes(g)?v.filter(n=>n!==g):[...v,g])}><span>{collapsed.includes(g)?'›':'⌄'}</span>{g}<small>{scheduled.filter(r=>groupName(r)===g).length}</small></button><div style={{width}}/></div>{!collapsed.includes(g)&&scheduled.filter(r=>groupName(r)===g).sort((a,b)=>dateRange(a.kind,a.data)![0]-dateRange(b.kind,b.data)![0]).map(row=><div className="gantt-data-row" key={row.id}><button className="gantt-item-name" onClick={()=>open(row)}><strong>{row.kind==='event'?'◇ ':'▤ '}{row.data.title}</strong><span>{row.kind==='task'?`${row.data.assignee||'Unassigned'} · ${row.data.status}`:row.data.category}</span></button>{bar(row)}</div>)}</div>)}
     {scheduled.length===0&&<div className="gantt-empty-row"><div className="gantt-empty-label">Your schedule starts here.<small>Add a task with dates or a team event.</small><button className="text-button" onClick={addTask}>＋ Add task</button><button className="text-button" onClick={addEvent}>＋ Add event</button></div><div className="gantt-empty-track" style={{width}}>{today>=first&&today<=last&&<span className="today-line" style={{left:(today-first+.5)*cell}}/>}</div></div>}
    </div>
   </div>
   <div className="gantt-footer"><span><i/> Today</span><span>Click a bar to edit · Drag to move · Drag either edge to resize</span><span>{saving?'Saving schedule…':drag?(()=>{const [s,e]=shiftedRange(drag.start,drag.end,drag.delta,drag.mode);return dayString(s)+' → '+dayString(e)})():'Arrow keys move a focused bar; Shift + arrows resize its end.'}</span></div>
  </>}
  {unscheduled.length>0&&<div className="unscheduled"><div className="section-label">NO DATES YET · {unscheduled.length}</div><div>{unscheduled.map(row=><button key={row.id} onClick={()=>open(row)}>{row.data.title}<span>＋ Set dates</span></button>)}</div></div>}
 </section>
}
