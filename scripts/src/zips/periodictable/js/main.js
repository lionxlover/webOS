(function(){
'use strict';
var grid=document.getElementById('grid'),det=document.getElementById('det'),q=document.getElementById('q'),off={},els=[],cur=null;
function cell(e){var c=window.CATS[e[4]],d=document.createElement('div');d.className='el';d.style.background=c[1];
 d.style.gridColumn=e[5];d.style.gridRow=e[6];d.innerHTML='<span>'+e[0]+'</span><b>'+e[1]+'</b><span>'+Math.round(e[3])+'</span>';
 d.onclick=function(){select(e)};d.title=e[2];d._e=e;grid.appendChild(d);els.push(d)}
window.ELEMENTS.forEach(cell);
// spacer labels for f-block rows
[['*',6,3,'La-Lu'],['**',7,3,'Ac-Lr']].forEach(function(l){var d=document.createElement('div');d.className='lab';d.style.gridRow=l[1];d.style.gridColumn=3;d.textContent=l[0];d.style.paddingLeft='0';d.style.textAlign='center';d.style.fontSize='10px';d.style.color='#8b94ab';grid.appendChild(d)});
els.forEach(function(d){if(d._e[6]>=9)d.style.marginTop=d._e[6]==9?'14px':'0'});
var lg=document.getElementById('legend');
Object.keys(window.CATS).forEach(function(k){var s=document.createElement('span');s.textContent=window.CATS[k][0];s.style.background=window.CATS[k][1];
 s.onclick=function(){off[k]=!off[k];s.className=off[k]?'off':'';filter()};lg.appendChild(s)});
function filter(){var t=q.value.trim().toLowerCase();els.forEach(function(d){var e=d._e,hit=!t||e[2].toLowerCase().indexOf(t)>=0||e[1].toLowerCase()===t||String(e[0])===t;d.classList.toggle('dim',!hit||!!off[e[4]])})}
q.oninput=filter;
var ST={solid:'Solid',liquid:'Liquid',gas:'Gas'};
function config(z){var o=[['1s',2],['2s',2],['2p',6],['3s',2],['3p',6],['4s',2],['3d',10],['4p',6],['5s',2],['4d',10],['5p',6],['6s',2],['4f',14],['5d',10],['6p',6],['7s',2],['5f',14],['6d',10],['7p',6]],r=[];
 for(var i=0;i<o.length&&z>0;i++){var n=Math.min(z,o[i][1]);r.push(o[i][0]+'<sup>'+n+'</sup>');z-=n}return r.join(' ')}
function select(e){cur=e;els.forEach(function(d){d.classList.toggle('sel',d._e===e)});var c=window.CATS[e[4]];
 det.innerHTML='<div class="big" style="color:'+c[1]+'">'+e[1]+'</div><h2>'+e[2]+'</h2><dl><dt>Number</dt><dd>'+e[0]+'</dd><dt>Mass</dt><dd>'+e[3]+' u</dd><dt>Type</dt><dd>'+c[0]+'</dd><dt>Group</dt><dd>'+(e[6]>=9?'f-block':e[5])+'</dd><dt>Period</dt><dd>'+(e[6]>=9?(e[6]==9?6:7):e[6])+'</dd><dt>At 20 C</dt><dd>'+ST[e[7]]+'</dd></dl><p style="margin-top:10px;font-size:11px;color:#8b94ab;word-break:break-word">'+config(e[0])+'</p>';
 try{parent.postMessage({lx:'title',value:e[2]+' — Periodic Table'},'*')}catch(x){}
 try{localStorage.setItem('pt.last',e[0])}catch(x){}}
var last=1;try{last=+localStorage.getItem('pt.last')||1}catch(x){}
select(window.ELEMENTS[last-1]);
})();
