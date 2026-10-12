(function(){
'use strict';
var $=function(s){return document.querySelector(s)},cur=[],locked={},saved=[];
try{saved=JSON.parse(localStorage.getItem('palettes.saved')||'[]')}catch(e){}
function persist(){try{localStorage.setItem('palettes.saved',JSON.stringify(saved))}catch(e){}}
function msg(t){$('#msg').textContent=t;setTimeout(function(){$('#msg').textContent=''},1600)}
function copy(t){return navigator.clipboard?navigator.clipboard.writeText(t).then(function(){msg('Copied '+t)},function(){msg('Clipboard blocked')}):(msg('Clipboard unavailable'),0)}
function gen(){var n=Color.harmony($('#mode').value,$('#base').value);cur=cur.length?n.map(function(c,i){return locked[i]?cur[i]:c}):n;draw()}
function draw(){$('#strip').innerHTML=cur.map(function(c,i){var t=Color.textOn(c),h=Color.hex2hsl(c);return '<div class="sw" data-i="'+i+'" style="background:'+c+';color:'+t+'"><span class="lk">'+(locked[i]?'\u{1F512}':'')+'</span>'+c.toUpperCase()+'<small>hsl '+Math.round(h[0])+' '+Math.round(h[1])+'% '+Math.round(h[2])+'%</small><small>click copy · dbl-click lock</small></div>'}).join('');
 $('#saved').innerHTML=saved.map(function(p,i){return '<div class="mini" data-s="'+i+'" title="Click to load, right-click to delete">'+p.map(function(c){return '<i style="background:'+c+'"></i>'}).join('')+'</div>'}).join('')||'<span style="color:#8b94ab;font-size:12px">Nothing saved yet.</span>'}
$('#strip').onclick=function(e){var s=e.target.closest('.sw');if(s)copy(cur[+s.dataset.i].toUpperCase())};
$('#strip').ondblclick=function(e){var s=e.target.closest('.sw');if(s){locked[s.dataset.i]=!locked[s.dataset.i];draw()}};
$('#saved').onclick=function(e){var s=e.target.closest('.mini');if(s){cur=saved[+s.dataset.s].slice();locked={};draw()}};
$('#saved').oncontextmenu=function(e){var s=e.target.closest('.mini');if(s){e.preventDefault();saved.splice(+s.dataset.s,1);persist();draw()}};
$('#save').onclick=function(){saved.unshift(cur.slice());saved=saved.slice(0,24);persist();draw();msg('Saved')};
$('#css').onclick=function(){copy(':root{\n'+cur.map(function(c,i){return '  --color-'+(i+1)+': '+c+';'}).join('\n')+'\n}')};
$('#gen').onclick=gen;$('#mode').onchange=function(){locked={};gen()};$('#base').oninput=function(){locked={};gen()};
addEventListener('keydown',function(e){if(e.code==='Space'&&e.target.tagName!=='SELECT'){e.preventDefault();gen()}});
gen();
})();
