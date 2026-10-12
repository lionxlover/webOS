(function(){
'use strict';
var $=function(s){return document.querySelector(s)},tag='';
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function hue(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))%360;return h}
function render(){var q=$('#q').value.toLowerCase(),all=BM.all(),list=all.filter(function(b){return(!tag||b.tags.indexOf(tag)>=0)&&(!q||(b.title+' '+b.url+' '+b.tags.join(' ')).toLowerCase().indexOf(q)>=0)}),s=$('#sort').value;
 list.sort(function(a,b){return s==='az'?a.title.localeCompare(b.title):s==='vis'?(b.v||0)-(a.v||0):(b.t||0)-(a.t||0)});
 $('#grid').innerHTML=list.map(function(b){return '<div class="card"><button class="x" data-x="'+b.id+'" title="Remove">&times;</button><div class="fav" style="background:hsl('+hue(b.title)+',70%,65%)">'+esc(b.title[0].toUpperCase())+'</div><b>'+esc(b.title)+'</b><a href="'+esc(b.url)+'" target="_blank" rel="noopener" data-v="'+b.id+'">'+esc(b.url)+'</a><div class="tg">'+b.tags.map(function(t){return '<i>'+esc(t)+'</i>'}).join('')+'</div></div>'}).join('')||'<p style="color:#8b94ab">Nothing matches.</p>';
 var counts={};all.forEach(function(b){b.tags.forEach(function(t){counts[t]=(counts[t]||0)+1})});
 $('#tags').innerHTML=Object.keys(counts).sort().map(function(t){return '<span class="'+(t===tag?'on':'')+'" data-t="'+esc(t)+'">#'+esc(t)+' '+counts[t]+'</span>'}).join('');
 $('#cnt').textContent=list.length+' of '+all.length+' bookmarks'}
$('#f').onsubmit=function(e){e.preventDefault();BM.add($('#u').value.trim(),$('#t').value.trim(),$('#g').value.split(',').map(function(x){return x.trim().toLowerCase()}).filter(Boolean));$('#f').reset();render()};
$('#grid').onclick=function(e){var x=e.target.dataset;if(x.x){BM.remove(x.x);render()}else if(x.v){var b=BM.all().filter(function(k){return k.id===x.v})[0];if(b){b.v=(b.v||0)+1;BM.save()}}};
$('#tags').onclick=function(e){var t=e.target.dataset.t;if(t!==undefined){tag=tag===t?'':t;render()}};
$('#q').oninput=$('#sort').onchange=render;
$('#exp').onclick=function(){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(BM.all(),null,2)],{type:'application/json'}));a.download='bookmarks.json';a.click()};
$('#imp').onclick=function(){$('#file').click()};
$('#file').onchange=function(e){var f=e.target.files[0];if(!f)return;f.text().then(function(t){try{var j=JSON.parse(t);if(Array.isArray(j)){BM.replace(j.filter(function(b){return b&&b.url}).map(function(b){return{id:b.id||'i'+Math.random().toString(36).slice(2),title:b.title||b.url,url:b.url,tags:b.tags||[],v:b.v||0,t:b.t||Date.now()}}));render()}}catch(x){alert('Not a valid bookmarks file')}})};
render();
})();
