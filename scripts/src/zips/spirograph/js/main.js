(function(){
'use strict';
var cv=document.getElementById('c'),x=cv.getContext('2d'),$=function(s){return document.querySelector(s)},job=0;
function fit(){var r=cv.getBoundingClientRect(),d=window.devicePixelRatio||1;cv.width=r.width*d;cv.height=r.height*d;x.setTransform(d,0,0,d,0,0)}
function size(){return cv.getBoundingClientRect()}
function draw(){var id=++job,R=+$('#R').value,r=+$('#r').value,d=+$('#d').value,rect=size(),cx=rect.width/2,cy=rect.height/2,sc=Math.min(rect.width,rect.height)/2.2/(R-r+d+1),
 turns=Spiro.turns(R,r),total=Math.PI*2*turns,steps=Math.min(24000,Math.ceil(turns*360)),i=0,hue=+$('#hue').value,prev=null;
 x.lineWidth=+$('#w').value;x.lineCap='round';$('#info').textContent=turns+' turn'+(turns>1?'s':'')+' to close · '+steps+' segments';
 (function chunk(){if(id!==job)return;var end=Math.min(steps,i+400);for(;i<=end;i++){var t=total*i/steps,p=Spiro.point(R,r,d,t),X=cx+p[0]*sc,Y=cy+p[1]*sc;
   if(prev){x.strokeStyle='hsl('+((hue+i/steps*160)%360)+',85%,62%)';x.beginPath();x.moveTo(prev[0],prev[1]);x.lineTo(X,Y);x.stroke()}prev=[X,Y]}
  if(i<steps)requestAnimationFrame(chunk)})()}
function clear(){job++;x.clearRect(0,0,size().width,size().height)}
$('#draw').onclick=draw;$('#clr').onclick=clear;
$('#rnd').onclick=function(){$('#R').value=80+Math.random()*120|0;$('#r').value=8+Math.random()*100|0;$('#d').value=10+Math.random()*150|0;$('#hue').value=Math.random()*360|0;clear();draw()};
$('#png').onclick=function(){var a=document.createElement('a');a.href=cv.toDataURL('image/png');a.download='spirograph.png';a.click()};
['R','r','d','w','hue'].forEach(function(k){$('#'+k).onchange=function(){clear();draw()}});
addEventListener('resize',function(){fit();draw()});fit();draw();
try{parent.postMessage({lx:'title',value:'Spirograph'},'*')}catch(e){}
})();
