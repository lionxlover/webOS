(function(){
'use strict';
var $=function(s){return document.querySelector(s)},cur=null,timer=null,MOODS=['😄','🙂','😐','😕','😢','😡','😴','🤩'];
function today(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function fmt(s){var p=s.split('-');return new Date(+p[0],p[1]-1,+p[2]).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'})}
function esc(s){return String(s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
function renderList(){var q=$('#q').value.toLowerCase(),all=JStore.all(),h='';
 all.forEach(function(e){if(q&&(e.title+' '+e.body).toLowerCase().indexOf(q)<0)return;
  h+='<div class="item'+(cur&&cur.id===e.id?' on':'')+'" data-id="'+e.id+'"><small>'+fmt(e.date)+' '+e.mood+'</small><b>'+esc(e.title||'Untitled')+'</b><p>'+esc(e.body.slice(0,90))+'</p></div>'});
 $('#list').innerHTML=h||'<p class="muted" style="padding:14px">No entries yet.</p>';$('#cnt').textContent=all.length+' entries';
 Array.prototype.forEach.call(document.querySelectorAll('.item'),function(n){n.onclick=function(){open(JStore.get(n.dataset.id))}})}
function moods(){$('#moods').innerHTML='';MOODS.forEach(function(m){var b=document.createElement('button');b.textContent=m;b.className=cur&&cur.mood===m?'on':'';b.onclick=function(){if(!cur)return;cur.mood=cur.mood===m?'':m;JStore.update(cur.id,{mood:cur.mood});moods();renderList()};$('#moods').appendChild(b)})}
function open(e){cur=e;var on=!!e;['#title','#body','#date','#del'].forEach(function(s){$(s).disabled=!on});
 $('#title').value=on?e.title:'';$('#body').value=on?e.body:'';$('#date').value=on?e.date:today();moods();count();renderList();
 try{parent.postMessage({lx:'title',value:(on&&e.title?e.title+' — ':'')+'Daily Journal'},'*')}catch(x){}}
function count(){var w=($('#body').value.match(/\S+/g)||[]).length;$('#wc').textContent=w+' words'}
function queue(){count();clearTimeout(timer);$('#saved').textContent='Saving...';timer=setTimeout(function(){if(!cur)return;var ok=JStore.update(cur.id,{title:$('#title').value,body:$('#body').value,date:$('#date').value||today()});$('#saved').textContent=ok?'Saved':'Not saved (storage unavailable)';renderList()},350)}
$('#title').oninput=$('#body').oninput=$('#date').onchange=queue;$('#q').oninput=renderList;
$('#new').onclick=function(){open(JStore.add(today()));$('#title').focus()};
$('#del').onclick=function(){if(cur&&confirm('Delete this entry?')){JStore.remove(cur.id);var a=JStore.all();open(a[0]||null)}};
$('#exp').onclick=function(){var t=JStore.all().map(function(e){return '# '+(e.title||'Untitled')+'\n'+e.date+' '+e.mood+'\n\n'+e.body}).join('\n\n---\n\n'),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/markdown'}));a.download='journal.md';a.click()};
var first=JStore.all();if(!first.length){var e=JStore.add(today());JStore.update(e.id,{title:'My first entry',body:'Welcome to your journal. Entries save automatically on this device.',mood:'🙂'});first=JStore.all()}
open(first[0]);
})();
