import assert from 'node:assert/strict';
const prefix='__FRP_TEST__ ';
async function request(body,method='POST'){const r=await fetch('http://localhost:3000/api/records',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,...await r.json()}}
async function records(){return (await (await fetch('http://localhost:3000/api/state')).json()).records}
const data={title:prefix+'checklist',description:'Please ask @Russ and @Russ. Email x@Greg is not a mention.',team:'AIM',assignee:'Ben',status:'To do',priority:'Normal',blocked:true,due:'',checklist:[{id:'test-item',text:'Tested on robot',done:false}]};
let created=await request({kind:'task',actor:'Kaitlyn',data});assert.equal(created.status,201);assert.ok(created.undoId);
let state=await records();let notices=state.filter(r=>r.kind==='notification'&&r.data.target==='task:'+created.id);assert.deepEqual(notices.map(n=>n.data.recipient).sort(),['Ben','Russ']);
assert.equal((await request({id:created.id,version:1,actor:'Ben',data:{status:'Done'}},'PATCH')).status,400);
let completed=await request({id:created.id,version:1,actor:'Ben',data:{status:'Done',checklist:[{id:'test-item',text:'Tested on robot',done:true}]}},'PATCH');assert.equal(completed.status,200);
assert.equal((await request({undoId:completed.undoId,actor:'Greg'})).status,403);
assert.equal((await request({undoId:completed.undoId,actor:'Ben'})).status,200);
state=await records();let task=state.find(r=>r.id===created.id);assert.equal(task.data.status,'To do');assert.equal(task.data.checklist[0].done,false);
assert.equal((await request({undoId:completed.undoId,actor:'Ben'})).status,409);
let archived=await request({id:task.id,version:task.version,actor:'Kaitlyn',data:{archived:true}},'PATCH');assert.equal(archived.status,200);assert.equal((await records()).find(r=>r.id===task.id).data.archived,true);
assert.equal((await request({undoId:archived.undoId,actor:'Kaitlyn'})).status,200);assert.ok(!(await records()).find(r=>r.id===task.id).data.archived);
const notification=notices.find(n=>n.data.recipient==='Russ');assert.equal((await request({id:notification.id,version:notification.version,actor:'Russ',data:{read:true}},'PATCH')).status,200);assert.equal((await request({id:notification.id,version:notification.version+1,actor:'Greg',data:{read:false}},'PATCH')).status,403);
const comment=await request({kind:'comment',actor:'Luke',data:{target:'file:octocat/Hello-World/README',text:prefix+'@Nate could you review this?',resolved:false,team:'Launch'}});assert.equal(comment.status,201);
const reply=await request({kind:'comment',actor:'Nate',data:{target:'file:octocat/Hello-World/README',replyTo:comment.id,text:prefix+'review reply',resolved:false,team:'Launch'}});assert.equal(reply.status,201);
assert.equal((await request({kind:'comment',actor:'Nate',data:{target:'file:other/repo/file',replyTo:comment.id,text:prefix+'invalid reply',resolved:false}})).status,400);
const meeting=await request({kind:'meeting',actor:'Greg',data:{title:prefix+'meeting',date:'2026-09-25',team:'All teams',notes:'Talked about @Claire’s next steps.',decisions:'Test before competition.',actions:[{id:'action-1',text:prefix+'test autonomous',team:'Launch',assignee:'Claire',due:'2026-09-28'}]}});assert.equal(meeting.status,201);
const attempts=await Promise.all([1,2].map(()=>request({convert:true,meetingId:meeting.id,version:1,actionId:'action-1',actor:'Greg'})));assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);
state=await records();const note=state.find(r=>r.id===meeting.id),linked=note.data.actions[0].taskId;assert.ok(linked);assert.equal(state.filter(r=>r.kind==='task'&&r.data.title===prefix+'test autonomous').length,1);assert.equal(state.find(r=>r.id===linked).data.assignee,'Claire');
const again=await request({convert:true,meetingId:meeting.id,version:note.version,actionId:'action-1',actor:'Greg'});assert.equal(again.taskId,linked);
// Concurrent edits must create one change log and one set of notifications.
const latest=(await records()).find(r=>r.id===created.id);
const race=await Promise.all(['Greg','Zane'].map(actor=>request({id:latest.id,version:latest.version,actor,data:{description:'Please ask @Nate'}},'PATCH')));assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
state=await records();assert.equal(state.filter(r=>r.kind==='activity'&&r.data.recordId===latest.id&&r.data.afterVersion===latest.version+1).length,1);assert.equal(state.filter(r=>r.kind==='notification'&&r.data.target==='task:'+latest.id&&r.data.recipient==='Nate').length,1);
console.log('Passed: checklist completion rules; mention deduplication and attribution; notification read ownership; archive/restore; version-safe undo; threaded code replies; atomic, repeat-safe meeting-to-task conversion; concurrent edits without duplicate activity or notifications.');
